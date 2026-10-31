// src/lodestar/intake/elicitation.ts
/**
 * 提问环编排（三招筛选 + 原子化 + 预筛）
 *
 * 顺序是硬约束：**弃权许可 → 稳定性复问 → 具体化追问**。
 * 先具体化会把编造固定下来，污染稳定性测试，
 * 所以这里把三步写成一条不可调头的流水线，而不是三个可调参数。
 *
 * 本模块只做"问"与"拆"，不做任何可信度判断：稳定性高只意味着更值得花预算去查。
 */

import { invokeLLM, type ChatMessage } from '../../llm';
import { createSearchProvider, getSearchProviderFromEnv } from '../../integrations/search-providers';
import { getLodestarLoader } from '../../prompts';
import { createLogger } from '../../utils/logger';
import { newId } from '../ids';
import type { DomainPack, FieldSpec } from '../packs/pack';
import { atomizeFieldToClaim } from './atomize';
import { applyTriage, mergeDuplicateClaims } from './triage';
import {
  alignRuns,
  applyConcretization,
  capRecords,
  pickPrimaryVariants,
  recordFieldsSnapshot,
  selectFieldsForBudget,
  type AlignedRecord,
  type FieldVariant,
  type MappedRow,
} from './record-container';
import { parseConcretizationPatches, parseModelRows } from './parse-answer';
import { keyFieldSpecs, renderConcretization, renderEnumeration, renderEnumerationExtract } from './prompts';
import type { AnswerRecord, ClaimRecord } from '../types';

/** 一次模型调用原始应答的落盘回调（引擎把它接到 answers.jsonl；测试用它收内存数组） */
export type AnswerSink = (row: AnswerRecord) => Promise<void> | void;

/** 一次提问的输入侧参数（默认值是出厂设置，改它们不需要任何人裁决） */
export interface ElicitationOptions {
  /** 换措辞复问次数（含首次提问） */
  stabilityRuns: number;
  /** 视为稳定复现的最低次数 */
  minStabilityHits: number;
  /** 一次提问接受的记录数 */
  maxRecords: number;
  /**
   * 一条记录最多送查几个字段（单查询预算的第二层闸，0 = 不限）。
   * 缺省 3 = 只裁关键字段：共现门禁只认关键字段，次要字段照样落底稿但不花检索预算。
   */
  maxFieldsPerRecord: number;
  /**
   * 检索增强兜底开关：记忆复问整轮全空（rowsPerRun 全 0）时，
   * 先用 web-search 角色做 1 次搜索式调用拿资料，再用同一份资料提取式复问
   * 2 轮（行级一致才过 minStabilityHits 线）。默认开——记忆够用时永远走不到兜底，
   * "保住记忆路线不花钱"由触发条件保证，不需要人手关。
   */
  retrievalFallback: boolean;
  /** 这条查询因为主线缺什么才被来查（只用于评测分层） */
  selectionReason: string | null;
  /**
   * 模型原始应答的落盘出口（底稿起点前移）：复问每轮、具体化追问每次各记一行，
   * 解析之前落盘原文——整轮空答/解析失败/被弃权丢弃的行不再只剩计数。
   * 不传则不落盘（纯内存跑，仅测试用）。
   */
  onAnswer?: AnswerSink;
}

export const DEFAULT_ELICITATION_OPTIONS: ElicitationOptions = {
  stabilityRuns: 3,
  minStabilityHits: 2,
  maxRecords: 30,
  maxFieldsPerRecord: 3,
  retrievalFallback: true,
  selectionReason: 'coverage-gap',
};

/** 检索增强兜底的提取式复问轮数：同一份资料问 2 次，行级一致（recordHits ≥ 2）才过稳定线 */
const RETRIEVAL_EXTRACTION_RUNS = 2;

/** 提问环产出 */
export interface ElicitationResult {
  queryId: string;
  query: string;
  records: AlignedRecord[];
  /** 通过预筛、值得花检索预算的断言 */
  claims: ClaimRecord[];
  /** 被预筛拒收的断言（拒收也要落底稿，否则无法复盘是不是拒错） */
  rejectedClaims: ClaimRecord[];
  stats: {
    runs: number;
    /** 记忆 / 检索增强：本轮候选从哪来（分流读数） */
    intakeMode: 'memory' | 'retrieval-assisted';
    /** 每轮实际返回的行数（兜底触发时含兜底轮） */
    rowsPerRun: number[];
    /** 每轮因"关键字段全空"被丢弃的弃权行数 */
    abstainedRowsPerRun: number[];
    /** 解析失败的轮次（坏 JSON） */
    parseFailures: number;
    stableRecords: number;
    concretizedFields: number;
    mergedDuplicates: number;
    /** 因超出单记录字段预算而未送查的字段数（落底稿但状态为 rejected） */
    overBudgetFields: number;
  };
}

/** 一次 LLM 取回（重试一次仍失败即记为弃权轮次，不让整条查询断链） */
async function askOnce(
  prompt: string,
  log: ReturnType<typeof createLogger>,
  templateName: 'enumeration-answer' | 'enumeration-extract' = 'enumeration-answer',
): Promise<string | null> {
  const params = getLodestarLoader().getLLMParams(templateName);
  const messages: ChatMessage[] = [{ role: 'user', content: prompt }];
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await invokeLLM('text', messages, {
        temperature: params.temperature ?? 0.3,
        maxTokens: params.max_tokens ?? 4000,
        enableThinking: false,
      });
      if (typeof result.content === 'string' && result.content.trim() !== '') return result.content;
    } catch (error) {
      log.dev.warn(`提问第 ${attempt + 1} 次尝试失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return null;
}

/**
 * 检索增强兜底的搜索式调用：走与裁决层同一个搜索提供者（SEARCH_PROVIDER）。
 *
 * 为什么不再直接调 `invokeLLM('web-search')`：那个角色只有模型名，没有「联网」这个动作——
 * 模型会凭记忆写一段泛泛而谈的概述，提取轮拿它当证据只能提取出空数组。搜索提供者才知道
 * 怎么真的发一次搜索（llm-web 带联网开关、serper 走 Google）。返回结果拼成带 URL 的上下文；
 * 失败返回 null，兜底就地放弃（不重试换措辞）。
 */
async function searchOnce(query: string, log: ReturnType<typeof createLogger>): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const provider = createSearchProvider(getSearchProviderFromEnv());
      const { results } = await provider.search([query], { numResults: 10 });
      const context = results
        .map((item, index) => `[${index + 1}] ${item.title}\n${item.url}\n${item.snippet}`)
        .join('\n\n')
        .trim();
      if (context !== '') return context;
      log.dev.warn(`兜底搜索第 ${attempt + 1} 次没有返回任何结果`);
    } catch (error) {
      log.dev.warn(`兜底搜索第 ${attempt + 1} 次尝试失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return null;
}

/**
 * 跑完输入侧一整段：提问 → 复问 → 具体化 → 原子化 → 预筛。
 *
 * @param query 枚举式提问原文（如"列出近五年含民间瓷器的拍卖会（时间、地点、拍卖行）"）
 * @param pack 领域证据策略包
 */
export async function elicit(
  query: string,
  pack: DomainPack,
  overrides: Partial<ElicitationOptions> = {},
): Promise<ElicitationResult> {
  const log = createLogger({ prefix: '[Lodestar Intake] ' });
  const options = { ...DEFAULT_ELICITATION_OPTIONS, ...overrides };
  const queryId = newId('query');
  const phrasings = pack.enumerationPhrasings(query, options.stabilityRuns);

  // ---- 第一步 + 第二步：带弃权出口的提问，换措辞复问 ----
  const runs: MappedRow[][] = [];
  const rowsPerRun: number[] = [];
  const abstainedRowsPerRun: number[] = [];
  let parseFailures = 0;

  /** 原始应答落盘（底稿起点前移）：解析之前记原文，调用失败也记（rawText=null） */
  const recordAnswer = async (
    kind: AnswerRecord['kind'],
    runIndex: number | null,
    phrasing: string | null,
    rawText: string | null,
    note: string | null,
  ): Promise<void> => {
    if (!options.onAnswer) return;
    await options.onAnswer({
      answerId: newId('answer'),
      queryId,
      kind,
      runIndex,
      phrasing,
      rawText,
      note,
      createdAt: new Date().toISOString(),
    });
  };

  for (const [runIndex, phrasing] of phrasings.entries()) {
    const answer = await askOnce(renderEnumeration(pack, phrasing), log);
    if (answer === null) {
      parseFailures += 1;
      await recordAnswer('enumeration', runIndex, phrasing, null, 'LLM 调用失败（重试一次仍无内容），记为弃权轮');
      runs.push([]);
      rowsPerRun.push(0);
      abstainedRowsPerRun.push(0);
      continue;
    }
    const parsed = parseModelRows(answer, pack);
    if (parsed.parseError !== null) parseFailures += 1;
    await recordAnswer(
      'enumeration',
      runIndex,
      phrasing,
      answer,
      parsed.parseError === null ? null : `JSON 解析失败：${String(parsed.parseError)}`,
    );
    runs.push(parsed.rows);
    rowsPerRun.push(parsed.rows.length);
    abstainedRowsPerRun.push(parsed.discardedAbstained);
  }

  // ---- 检索增强兜底（触发条件：记忆复问整轮全空，rowsPerRun 全 0） ----
  // 顺序不可调头：兜底是记忆路线判空之后的补给，记忆够用时永远不触发、不多花一分钱。
  // 预算预先定死：固定 1 次搜索 + 2 轮提取。名单页换词（第二次搜索换指向）2026-10-11
  // 试过一跑即剔除：第 2 次搜索老实回答"名单页没有"，提取用的资料全部来自第 1 次，
  // 净效果只是每次兜底多花 1 次搜索。
  let intakeMode: 'memory' | 'retrieval-assisted' = 'memory';
  // 回调显式标 boolean：不标的话 TS 5.5 会把它推断成类型谓词 `n is 0`，
  // 经 every 的 `this is S[]` 签名把本 if 块内的 rowsPerRun 收窄成 0[]，后面 push(number) 直接报错
  const memoryAllEmpty = rowsPerRun.length > 0 && rowsPerRun.every((n): boolean => n === 0);
  if (memoryAllEmpty && options.retrievalFallback) {
    intakeMode = 'retrieval-assisted';
    log.dev.debug(
      `记忆复问 ${phrasings.length} 轮全空 → 触发检索增强兜底（1 次搜索 + ${RETRIEVAL_EXTRACTION_RUNS} 轮提取式复问）`,
    );
    const context = await searchOnce(query, log);
    if (context !== null) await recordAnswer('retrieval-search', null, query, context, '兜底搜索（原问句）');
    if (context === null) {
      await recordAnswer('retrieval-search', null, null, null, '兜底搜索失败（重试一次仍无内容），放弃兜底');
      log.dev.debug('兜底搜索失败，本轮维持空产出（不换措辞重试）');
    } else {
      for (let i = 0; i < RETRIEVAL_EXTRACTION_RUNS; i++) {
        const runIndex = phrasings.length + i;
        const answer = await askOnce(renderEnumerationExtract(pack, query, context), log, 'enumeration-extract');
        if (answer === null) {
          parseFailures += 1;
          await recordAnswer('enumeration', runIndex, query, null, `检索增强提取第 ${i + 1} 轮调用失败，记为弃权轮`);
          runs.push([]);
          rowsPerRun.push(0);
          abstainedRowsPerRun.push(0);
          continue;
        }
        const parsed = parseModelRows(answer, pack);
        if (parsed.parseError !== null) parseFailures += 1;
        await recordAnswer(
          'enumeration',
          runIndex,
          query,
          answer,
          parsed.parseError === null
            ? `检索增强提取第 ${i + 1}/${RETRIEVAL_EXTRACTION_RUNS} 轮`
            : `检索增强提取第 ${i + 1} 轮 JSON 解析失败：${String(parsed.parseError)}`,
        );
        runs.push(parsed.rows);
        rowsPerRun.push(parsed.rows.length);
        abstainedRowsPerRun.push(parsed.discardedAbstained);
      }
    }
    log.dev.debug(`兜底后行数 [${rowsPerRun.join(',')}]，intakeMode=${intakeMode}`);
  }

  let records = capRecords(alignRuns(runs, pack), options.maxRecords);
  log.dev.debug(
    `复问 ${phrasings.length} 轮：行数 [${rowsPerRun.join(',')}]，弃权行 [${abstainedRowsPerRun.join(',')}]，` +
      `对齐后记录 ${records.length} 条（截断上限 ${options.maxRecords}）`,
  );

  // ---- 第三步：只对已稳定复现、但缺关键字段的记录做具体化追问 ----
  const missingByKey = collectStableRecordsMissingKeyFields(records, pack, options.minStabilityHits);
  let concretizedFields = 0;
  if (missingByKey.length > 0) {
    const patches = await askConcretization(pack, missingByKey, missingByKey.flatMap((m) => m.missing), recordAnswer);
    if (patches.length > 0) {
      applyConcretization(records, patches, pack);
      concretizedFields = patches.reduce(
        (sum, p) => sum + Object.values(p.fields).filter((v) => v !== null && v !== '').length,
        0,
      );
    }
    log.dev.debug(`具体化追问：目标记录 ${missingByKey.length} 条，补回字段 ${concretizedFields} 个`);
  }

  // ---- 原子化：一条记录 → 每字段一条原子断言（超字段预算的仍落底稿，只是不送查） ----
  const claims: ClaimRecord[] = [];
  const overBudgetClaims: ClaimRecord[] = [];
  const keyFields = pack.fields().filter((f) => f.role === 'key').map((f) => f.key);
  const specByKey = new Map(pack.fields().map((f) => [f.key, f]));
  const buildClaim = (record: AlignedRecord, variant: FieldVariant): ClaimRecord | null => {
    const spec = specByKey.get(variant.fieldKey);
    if (!spec) return null;
    return atomizeFieldToClaim({
      queryId,
      record,
      variant,
      spec,
      pack,
      channel: intakeMode === 'retrieval-assisted' ? 'retrieval-assisted' : 'enumerative',
      selectionReason: options.selectionReason,
      stabilityRuns: record.runs,
    });
  };

  for (const record of records) {
    const primary = pickPrimaryVariants(record);
    const { chosen, overBudget } = selectFieldsForBudget(primary, keyFields, options.maxFieldsPerRecord);
    // 未达稳定阈值的字段不再当场跳过：照样落底稿，由预筛按"复现不足"拒收——
    // 跳过的话底稿里只剩"查过的"，弃权率与稳定率就没有分母了（弃权率要数这个）
    for (const variant of chosen) {
      const claim = buildClaim(record, variant);
      if (claim) claims.push(claim);
    }
    for (const variant of overBudget) {
      const claim = buildClaim(record, variant);
      if (!claim) continue;
      claim.triage = { passed: false, reason: 'over-record-field-budget' };
      claim.state = 'rejected';
      overBudgetClaims.push(claim);
    }
  }

  // ---- 去重与预筛 ----
  const { kept, mergedCount } = mergeDuplicateClaims(claims);
  kept.push(...overBudgetClaims);
  const recordStability = new Map<string, boolean>(
    records.map((r) => [r.recordId, r.recordHits >= options.minStabilityHits]),
  );
  const passed = applyTriage(kept, { minStabilityHits: options.minStabilityHits, recordStability });

  return {
    queryId,
    query,
    records,
    claims: passed,
    rejectedClaims: kept.filter((c) => !passed.includes(c)),
    stats: {
      runs: phrasings.length,
      intakeMode,
      rowsPerRun,
      abstainedRowsPerRun,
      parseFailures,
      stableRecords: records.filter((r) => r.recordHits >= options.minStabilityHits).length,
      concretizedFields,
      mergedDuplicates: mergedCount,
      overBudgetFields: overBudgetClaims.length,
    },
  };
}

/** 稳定复现但缺关键字段的记录（含其缺失字段规格） */
interface ConcretizationTarget {
  matchKey: string;
  fields: Record<string, string | null>;
  missing: FieldSpec[];
}

function collectStableRecordsMissingKeyFields(
  records: AlignedRecord[],
  pack: DomainPack,
  minStabilityHits: number,
): ConcretizationTarget[] {
  const keySpecs = keyFieldSpecs(pack);
  const out: ConcretizationTarget[] = [];
  for (const record of records) {
    if (record.recordHits < minStabilityHits) continue;
    const fields = recordFieldsSnapshot(record);
    const missing = keySpecs.filter((spec) => {
      const value = fields[spec.key];
      return value === undefined || value === null || String(value).trim() === '';
    });
    if (missing.length === 0 || missing.length === keySpecs.length) continue;
    out.push({ matchKey: record.matchKey, fields, missing });
  }
  return out;
}

/** 具体化追问一次（缺全部关键字段的记录不问——那等于凭空造一场事件） */
async function askConcretization(
  pack: DomainPack,
  targets: ConcretizationTarget[],
  missingSpecs: FieldSpec[],
  recordAnswer: (
    kind: AnswerRecord['kind'],
    runIndex: number | null,
    phrasing: string | null,
    rawText: string | null,
    note: string | null,
  ) => Promise<void>,
): Promise<Array<{ matchKey: string; fields: MappedRow }>> {
  const log = createLogger({ prefix: '[Lodestar Concretization] ' });
  const prompt = renderConcretization(
    pack,
    targets.map((t) => ({ matchKey: t.matchKey, fields: t.fields })),
    dedupeSpecs(missingSpecs),
  );
  const params = getLodestarLoader().getLLMParams('concretization');
  let content: string;
  try {
    const result = await invokeLLM('text', [{ role: 'user', content: prompt }], {
      temperature: params.temperature ?? 0.2,
      maxTokens: params.max_tokens ?? 2000,
      enableThinking: false,
    });
    content = result.content;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.dev.warn(`具体化追问失败（跳过这一步，不影响已有断言）：${message}`);
    await recordAnswer('concretization', null, null, null, `具体化追问调用失败：${message}`);
    return [];
  }
  const patches = parseConcretizationPatches(content, pack, new Set(targets.map((t) => t.matchKey)));
  await recordAnswer('concretization', null, null, content, null);
  return patches;
}

function dedupeSpecs(specs: FieldSpec[]): FieldSpec[] {
  const seen = new Set<string>();
  const out: FieldSpec[] = [];
  for (const spec of specs) {
    if (seen.has(spec.key)) continue;
    seen.add(spec.key);
    out.push(spec);
  }
  return out;
}
