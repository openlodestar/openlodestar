// src/lodestar/engine.ts
/**
 * Lodestar 编排入口：一条查询跑完整链
 *
 * 提问 → 逐字段裁决 → 记录级共现门禁 → 坐标导出，全程只由本地命令行触发（引擎只跑离线批处理：
 * 本文件不挂任何路由，也不被任何线上服务 import）。
 *
 * 写入次序是刻意的：**底稿先行**——断言先落 `claims.jsonl`（state=pending），
 * 再逐条推进状态。进程中途被杀时，底稿里留下的是一堆 pending，而不是一片空白，
 * 重跑用 `resumeFromLedger` 按主键继续，不重复花预算。
 *
 * 队列形态的既有约束：并发 1–2（这里取 1，宁慢勿炸，同时控制对外部
 * 搜索与抓取的瞬时压力）；需浏览器而浏览器不可用 → `paused`，不消耗重试预算。
 */

import { extractJsonArray, getRoleModelName, invokeLLM, type ChatMessage } from '@src/llm';
import { getLodestarLoader } from '@src/prompts';
import { NO_ABLATIONS, type AblationState } from '@src/ablation';
import { createLogger } from '@src/utils/logger';
import { keyFieldKeysOf, type DomainPack, type FieldSpec } from './packs/pack';
import porcelainPack from './packs/porcelain';
import { createStore, readSnapshot, type LodestarStore } from './storage/adapter';
import { DEFAULT_ELICITATION_OPTIONS, elicit, type ElicitationOptions, type ElicitationResult } from './intake/elicitation';
import { deterministicClaimId } from './intake/atomize';
import { pickPrimaryVariants, recordFieldsSnapshot, type AlignedRecord } from './intake/record-container';
import { renderClaimAtomize } from './intake/prompts';
import {
  adjudicateClaim,
  DEFAULT_CAPS,
  type AdjudicateClaimResult,
  type AdjudicationCaps,
  type SharedRetrieval,
} from './adjudicate';
import { retally } from './adjudicate/voting';
import { compareClaimToPage } from './adjudicate/compare';
import { pageTextCharBudget, type CapturedPage } from './adjudicate/page-fetch';
import { buildRecordQueries, retrieveCandidates } from './adjudicate/retrieval';
import { decideGate, findCooccurringUrls } from './record-gate/cooccurrence';
import { planRecordPoolGaps } from './record-gate/pool-gaps';
import { deriveAnchor, supportingUrlsUnion } from './record-gate/anchor-export';
import { newTraceId, recordLodestarTrace } from './trace-log';
import { newId } from './ids';
import type {
  AnchorRecord,
  ClaimRecord,
  EvidenceRecord,
  RecordSummary,
  SourceTier,
  VerdictRecord,
} from './types';

/** 运行选项 */
export interface RunQueryOptions {
  pack?: DomainPack;
  store?: LodestarStore;
  ablations?: AblationState;
  intake?: Partial<ElicitationOptions>;
  caps?: Partial<AdjudicationCaps>;
  /** 外部提交已原子化好的断言（跳过提问环，直接入库裁决） */
  externalClaims?: ClaimRecord[];
  /** 提问环产出的进度回调（脚本用来打印实时状态） */
  onStage?: (stage: string, detail?: Record<string, unknown>) => void;
}

/** 一次运行的产出（同时也是各项读数的出数处） */
export interface RunQueryResult {
  queryId: string;
  query: string;
  runId: string;
  packId: string;
  records: AlignedRecord[];
  claims: ClaimRecord[];
  verdicts: VerdictRecord[];
  anchors: AnchorRecord[];
  summaries: RecordSummary[];
  stats: {
    recordsAligned: number;
    claimsAtomized: number;
    claimsAdjudicated: number;
    claimsRejected: number;
    claimsPaused: number;
    claimsFailed: number;
    strongAnchors: number;
    weakAnchors: number;
    searchCalls: number;
    pagesFetched: number;
    compareCalls: number;
    /** not_found 三因占比的分母与分项（未找到成因分类的读数） */
    notFoundCauses: { budget: number; coverage: number; genuinely_absent: number };
    /** 超出单记录字段预算、因此没送查的字段数（落底稿但状态为 rejected） */
    overBudgetFields: number;
  };
  /** 提问环原始统计（稳定率与弃权率的出数处；外部提交路径为 null） */
  elicitation: ElicitationResult['stats'] | null;
  /** 需要浏览器而未得手的断言（`--resume` 的入口） */
  pausedClaimIds: string[];
  failedClaimIds: string[];
}

/** 引擎默认用瓷器包；换域 = 传另一个 DomainPack 进来 */
const DEFAULT_PACK: DomainPack = porcelainPack;

/**
 * 跑一条枚举式提问的完整一圈（提问 → 裁决 → 门禁 → 坐标）。
 *
 * @param query 提问原文
 */
export async function runQuery(query: string, options: RunQueryOptions = {}): Promise<RunQueryResult> {
  const log = createLogger({ prefix: '[Lodestar Engine] ' });
  const pack = options.pack ?? DEFAULT_PACK;
  const store = options.store ?? createStore();
  const ablations = options.ablations ?? NO_ABLATIONS;
  const caps: AdjudicationCaps = { ...DEFAULT_CAPS, ...(options.caps ?? {}) };

  // 只有外部提交、没有提问原文时跳过提问环：不为"没问"再花一次调用
  const elicited = query.trim() === '' && (options.externalClaims?.length ?? 0) > 0
    ? bundleExternalClaims(options.externalClaims ?? [], pack)
    : await elicit(query, pack, {
        ...options.intake,
        // 底稿起点前移：模型原始应答（复问每轮 + 具体化追问）在解析之前落 answers.jsonl
        onAnswer: (row) => store.append('answers', row),
      });
  options.onStage?.('intake', {
    queryId: elicited.queryId,
    records: elicited.records.length,
    claims: elicited.claims.length,
    rejected: elicited.rejectedClaims.length,
  });

  // ---- 底稿先行：断言（含被预筛拒收的）先落盘，再逐条推进状态 ----
  const allClaims = [...elicited.claims, ...elicited.rejectedClaims];
  for (const claim of allClaims) await store.append('claims', claim);
  for (const claim of elicited.rejectedClaims) {
    await store.patch('claims', claim.claimId, { triage: claim.triage, state: 'rejected' });
  }
  // 外部提交的断言同样入库（它们没有记录容器，门禁自然跳过）
  for (const claim of options.externalClaims ?? []) {
    await store.append('claims', claim);
  }

  // 外部-only 那条分支里， elicited.claims 已经是外部断言本身；再并一次会把每条裁两遍
  const claimsToVerify = dedupeByClaimId([...elicited.claims, ...(options.externalClaims ?? [])]);
  const runId = `lodestar-${elicited.queryId}-${Date.now()}`;
  const adjudicated = await verifyClaims({
    claims: claimsToVerify,
    records: elicited.records,
    pack,
    store,
    ablations,
    caps,
    runId,
    onStage: options.onStage,
  });

  // ---- 记录级门禁与坐标 ----
  const gateOutcome = await applyRecordGate({
    records: elicited.records,
    pack,
    store,
    verdicts: adjudicated.verdicts,
    evidence: adjudicated.evidence,
    query,
    queryId: elicited.queryId,
    runId,
  });

  const stats = summarize(adjudicated, elicited, gateOutcome);
  // 实验隔离读数：提问环统计与当圈配置随 trace 落盘——复盘时对比两条 trace
  // 就能对比"prompt 改动前后"的行数/稳定率，不必回控制台抓打印或翻 answers.jsonl
  const enumerationMeta = getLodestarLoader().getMetadata('enumeration-answer');
  const enumerationParams = getLodestarLoader().getLLMParams('enumeration-answer');
  await recordLodestarTrace({
    runId,
    node: 'LodestarQuery',
    testName: 'lodestar-query',
    traceId: adjudicated.queryTraceId,
    payload: {
      query,
      queryId: elicited.queryId,
      packId: pack.id,
      records: elicited.records.length,
      stats,
      anchors: gateOutcome.anchors,
      elicitation: elicited.stats,
    },
    events: [
      { name: 'intake', attributes: { records: elicited.records.length, claims: elicited.claims.length } },
      { name: 'adjudication', attributes: { verdicts: adjudicated.verdicts.length, paused: stats.claimsPaused } },
      { name: 'record-gate', attributes: { strong: stats.strongAnchors, weak: stats.weakAnchors, rejected: gateOutcome.summaries.filter((s) => s.gate === 'rejected').length } },
    ],
    startedAt: adjudicated.startedAt,
    status: 'success',
    metadata: {
      config: {
        // 本次调用实际生效的模型名（LLM_TEXT_MODEL 覆盖 > 角色默认值），与
        // invokeLLM 内部取的是同一来源——trace 里不记模型，复盘时对比
        // 不同模型档位（qwen-turbo vs qwen3.7-flash 等）的读数就无从归因
        model: getRoleModelName('text'),
        // 本轮候选来自记忆还是检索增强兜底——复盘时对比空读数
        // 是否走了兜底、兜底后行数有没有起来，都看这个字段
        intakeMode: elicited.stats.intakeMode,
        prompt: 'enumeration-answer',
        promptVersion: enumerationMeta.version,
        temperature: enumerationParams.temperature ?? null,
        maxTokens: enumerationParams.max_tokens ?? null,
      },
    },
  });
  log.dev.debug(
    `一圈跑完：强坐标 ${stats.strongAnchors} 条 / 弱坐标 ${stats.weakAnchors} 条 / ` +
      `检索 ${stats.searchCalls} 次 / 抓取 ${stats.pagesFetched} 页`,
  );

  return {
    queryId: elicited.queryId,
    query,
    runId,
    packId: pack.id,
    records: elicited.records,
    claims: allClaims,
    verdicts: adjudicated.verdicts,
    anchors: gateOutcome.anchors,
    summaries: gateOutcome.summaries,
    stats,
    /** 提问环原始统计（稳定率 = stableRecords/records；弃权率看 abstainedRowsPerRun） */
    elicitation: elicited.stats,
    pausedClaimIds: adjudicated.pausedClaimIds,
    failedClaimIds: adjudicated.failedClaimIds,
  };
}


/**
 * 外部提交断言 → 提问环同形的产物（记录容器从断言自身的 recordId + fieldKey 反推）。
 *
 * 记录级门禁要求"同一场事件的几个字段捆在一起"，而外部提交本来就是别人整理好的表，
 * 所以这里只做形状适配、不做任何判断：稳定性记 1 次、复问记 1 轮，
 * 预筛对 `external` 渠道本来就不设复现门槛。
 */
function bundleExternalClaims(claims: ClaimRecord[], pack: DomainPack): ElicitationResult {
  const queryId = claims.find((c) => c.queryId)?.queryId ?? newId('query');
  const records = recordsFromClaims(claims, pack);
  const containerless = claims.filter((c) => !c.recordId || !c.fieldKey);
  return {
    queryId,
    query: '（外部提交，无提问原文）',
    records,
    claims: [...records.flatMap((r) => claims.filter((c) => c.recordId === r.recordId)), ...containerless],
    rejectedClaims: [],
    stats: {
      runs: 0,
      intakeMode: 'memory',
      rowsPerRun: [],
      abstainedRowsPerRun: [],
      parseFailures: 0,
      stableRecords: records.length,
      concretizedFields: 0,
      mergedDuplicates: 0,
      overBudgetFields: 0,
    },
  };
}


/** 按主键去重：外部提交与提问环产物可能指向同一行，重复裁决等于重复花预算 */
export function dedupeByClaimId(claims: ClaimRecord[]): ClaimRecord[] {
  const seen = new Set<string>();
  const out: ClaimRecord[] = [];
  for (const claim of claims) {
    if (seen.has(claim.claimId)) continue;
    seen.add(claim.claimId);
    out.push(claim);
  }
  return out;
}

/** 单条断言的裁决计数与产物汇总 */
interface VerifiedBundle {
  verdicts: VerdictRecord[];
  evidence: EvidenceRecord[];
  pausedClaimIds: string[];
  failedClaimIds: string[];
  searchCalls: number;
  pagesFetched: number;
  compareCalls: number;
  queryTraceId: string;
  startedAt: Date;
}

/**
 * 逐字段裁决（并发 1：外部搜索与抓取的瞬时压力要可控，且同一来源被多条断言引用时
 * 抓取缓存已在文件后端之外生效，串行更省预算）。
 *
 * decompose 分支：拆一层重入，子断言仍判 decompose 即按"写不出判定规则"停手——
 * 不递归拆分，否则一条查询可以无限放大成本。
 */
async function verifyClaims(input: {
  claims: ClaimRecord[];
  records: AlignedRecord[];
  pack: DomainPack;
  store: LodestarStore;
  ablations: AblationState;
  caps: AdjudicationCaps;
  runId: string;
  onStage?: (stage: string, detail?: Record<string, unknown>) => void;
}): Promise<VerifiedBundle> {
  const log = createLogger({ prefix: '[Lodestar Verify] ' });
  const startedAt = new Date();
  const queryTraceId = newTraceId();
  const recordByKey = new Map(input.records.map((r) => [r.recordId, r]));
  const specByKey = new Map(input.pack.fields().map((f) => [f.key, f]));

  const bundle: VerifiedBundle = {
    verdicts: [],
    evidence: [],
    pausedClaimIds: [],
    failedClaimIds: [],
    searchCalls: 0,
    pagesFetched: 0,
    compareCalls: 0,
    queryTraceId,
    startedAt,
  };

  // 按记录分组做一次性检索：同一场的几个字段共用一份候选池（判定仍逐字段独立调用）。
  // 不分组的断言（外部提交里没带 recordId 的那些）退回按断言各自检索。
  const groups = new Map<string, ClaimRecord[]>();
  for (const claim of input.claims) {
    const key = claim.recordId ?? `__single__${claim.claimId}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(claim);
    else groups.set(key, [claim]);
  }

  for (const [groupKey, groupClaims] of groups) {
    const firstClaim = groupClaims[0]!;
    const record = firstClaim.recordId ? recordByKey.get(firstClaim.recordId) : undefined;
    const groupValues = record ? recordFieldsSnapshot(record) : { self: firstClaim.object };

    let shared: SharedRetrieval | undefined;
    if (record && groupClaims.length > 0) {
      const domains = input.pack.evidenceDomains(
        [firstClaim.object, firstClaim.subject, ...Object.values(groupValues).filter((v): v is string => !!v)].join(' '),
      );
      const queries = buildRecordQueries({
        pack: input.pack,
        claims: groupClaims.map((c) => ({ claim: c, spec: c.fieldKey ? specByKey.get(c.fieldKey) : undefined })),
        values: groupValues,
        domains,
        maxQueries: input.caps.maxSearchCalls,
      });
      try {
        const retrieval = await retrieveCandidates({
          pack: input.pack,
          claim: firstClaim,
          values: groupValues,
          maxQueries: queries.length,
          numResultsPerQuery: input.caps.numResultsPerQuery,
          ablations: input.ablations,
          logger: log,
          prebuiltQueries: queries,
        });
        shared = {
          queries: retrieval.queries,
          candidates: retrieval.candidates,
          searchCalls: retrieval.searchCalls,
          provider: retrieval.provider,
        };
        // 整组共用查询的预算只在组级记一次，避免按断言重复累加
        bundle.searchCalls += retrieval.searchCalls;
      } catch (error) {
        log.dev.warn(`记录 ${groupKey} 的共用检索失败，退回逐条断言各自检索：${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // A3：同记录组内共用一份页面缓存——三个字段各自走候选池时，撞见同一场
    // 前面字段刚抓过的页面直接复用，不重抓、不占后面断言的 pageCap
    const pageCache = new Map<string, CapturedPage>();

    for (const claim of groupClaims) {
    const values = record ? groupValues : { self: claim.object };
    const spec: FieldSpec | undefined = claim.fieldKey ? specByKey.get(claim.fieldKey) : undefined;

    const outcome = await runOne({
      claim,
      values,
      spec,
      pack: input.pack,
      store: input.store,
      ablations: input.ablations,
      caps: input.caps,
      runId: input.runId,
      traceId: newTraceId(),
      depth: 0,
      shared,
      sharedPageCache: pageCache,
    });

    bundle.verdicts.push(...outcome.verdicts);
    bundle.evidence.push(...outcome.evidence);
    bundle.searchCalls += shared ? 0 : outcome.searchCalls;
    bundle.pagesFetched += outcome.pagesFetched;
    bundle.compareCalls += outcome.compareCalls;
    if (outcome.paused) bundle.pausedClaimIds.push(claim.claimId);
    if (outcome.failed) bundle.failedClaimIds.push(claim.claimId);
    input.onStage?.('claim', {
      claimId: claim.claimId,
      recordId: claim.recordId,
      fieldKey: claim.fieldKey,
      verdict: outcome.verdicts[0]?.verdict ?? (outcome.paused ? 'paused' : outcome.failed ? 'failed' : 'rejected'),
      grade: outcome.verdicts[0]?.evidenceGrade,
    });
    }
    void groupKey;
  }

  log.dev.debug(
    `裁决完成 ${input.claims.length} 条：出裁决 ${bundle.verdicts.length}，暂停 ${bundle.pausedClaimIds.length}，失败 ${bundle.failedClaimIds.length}`,
  );
  return bundle;
}

/** 一条断言（含其 decompose 子断言）的裁决，返回累计量 */
async function runOne(input: {
  claim: ClaimRecord;
  values: Record<string, string | null>;
  spec?: FieldSpec;
  pack: DomainPack;
  store: LodestarStore;
  ablations: AblationState;
  caps: AdjudicationCaps;
  runId: string;
  traceId: string;
  depth: number;
  shared?: SharedRetrieval;
  /** 记录组共用的页面缓存（A3），原样透传给裁决内核与 decompose 子断言 */
  sharedPageCache?: Map<string, CapturedPage>;
}): Promise<{
  verdicts: VerdictRecord[];
  evidence: EvidenceRecord[];
  searchCalls: number;
  pagesFetched: number;
  compareCalls: number;
  paused?: boolean;
  failed?: string;
}> {
  const result: AdjudicateClaimResult = await adjudicateClaim({
    store: input.store,
    pack: input.pack,
    claim: input.claim,
    values: input.values,
    spec: input.spec,
    caps: input.caps,
    ablations: input.ablations,
    runId: input.runId,
    traceId: input.traceId,
    sharedRetrieval: input.shared,
    sharedPageCache: input.sharedPageCache,
  });

  const acc = {
    verdicts: result.verdict ? [result.verdict] : [],
    evidence: result.evidence,
    searchCalls: result.footprint?.budget.searchCalls ?? 0,
    pagesFetched: result.footprint?.budget.pagesFetched ?? 0,
    compareCalls: result.footprint ? result.footprint.fetched.length : 0,
    paused: Boolean(result.paused),
    failed: result.failed,
  };
  if (!result.needsDecompose) return acc;
  // 只重入一层：拆完还判 decompose 的子断言，由路由自己按拒收处理
  if (input.depth >= 1) return acc;

  const children = await decomposeClaim(input.claim, input.store);
  for (const child of children) {
    const childRun = await runOne({ ...input, claim: child, depth: input.depth + 1, traceId: newTraceId() });
    acc.verdicts.push(...childRun.verdicts);
    acc.evidence.push(...childRun.evidence);
    acc.searchCalls += childRun.searchCalls;
    acc.pagesFetched += childRun.pagesFetched;
    acc.compareCalls += childRun.compareCalls;
    if (childRun.paused) acc.paused = true;
  }
  return acc;
}

/**
 * decompose 重入：把复合 / 统计断言拆成更简单的原子断言并入库。
 *
 * 拆不出合法形态（模型给不出可判定句子）时返回空数组——父断言就停在 decompose，
 * 这是"我做不到"的正式产出之一，不硬凑成可裁决的样子。
 */
async function decomposeClaim(claim: ClaimRecord, store: LodestarStore): Promise<ClaimRecord[]> {
  const log = createLogger({ prefix: '[Lodestar Decompose] ' });
  const params = getLodestarLoader().getLLMParams('claim-atomize');
  let content: string;
  try {
    const messages: ChatMessage[] = [{ role: 'user', content: renderClaimAtomize(claim.atomicText) }];
    const result = await invokeLLM('text', messages, {
      temperature: params.temperature ?? 0,
      maxTokens: params.max_tokens ?? 1500,
      enableThinking: false,
    });
    content = result.content;
  } catch (error) {
    log.dev.warn(`拆分调用失败，父断言停在 decompose：${error instanceof Error ? error.message : String(error)}`);
    return [];
  }

  let parsed: unknown[];
  try {
    parsed = extractJsonArray(content);
  } catch {
    return [];
  }

  const children: ClaimRecord[] = [];
  for (const element of parsed.slice(0, 3)) {
    if (typeof element !== 'object' || element === null) continue;
    const row = element as Record<string, unknown>;
    const atomicText = typeof row.atomicText === 'string' ? row.atomicText.trim() : '';
    if (atomicText === '' || row.undecidable === true) continue;
    children.push({
      claimId: newId('claim'),
      queryId: claim.queryId,
      recordId: claim.recordId,
      fieldRole: claim.fieldRole,
      rawText: claim.atomicText,
      atomicText,
      subject: typeof row.subject === 'string' ? row.subject : claim.subject,
      predicate: typeof row.predicate === 'string' ? row.predicate : claim.predicate,
      object: typeof row.object === 'string' ? row.object : claim.object,
      timeScope: {
        from: typeof row.timeFrom === 'string' && row.timeFrom !== '' ? row.timeFrom : claim.timeScope.from,
        to: typeof row.timeTo === 'string' && row.timeTo !== '' ? row.timeTo : claim.timeScope.to,
      },
      channel: claim.channel,
      provenance: { ...claim.provenance },
      triage: { passed: true, reason: 'specific-and-decidable' },
      state: 'pending',
      fieldKey: claim.fieldKey,
      createdAt: new Date().toISOString(),
    });
  }
  for (const child of children) await store.append('claims', child);
  return children;
}

/** 记录级门禁 + 坐标落盘 */
async function applyRecordGate(input: {
  records: AlignedRecord[];
  pack: DomainPack;
  store: LodestarStore;
  verdicts: VerdictRecord[];
  evidence: EvidenceRecord[];
  query: string;
  queryId: string | null;
  runId: string;
}): Promise<{ summaries: RecordSummary[]; anchors: AnchorRecord[] }> {
  const verdictByClaim = new Map(input.verdicts.map((v) => [v.claimId, v]));
  const evidenceByClaim = new Map<string, EvidenceRecord[]>();
  for (const row of input.evidence) {
    const bucket = evidenceByClaim.get(row.claimId);
    if (bucket) bucket.push(row);
    else evidenceByClaim.set(row.claimId, [row]);
  }

  const summaries: RecordSummary[] = [];
  const anchors: AnchorRecord[] = [];
  const keyFieldKeys = new Set(keyFieldKeysOf(input.pack.fields()));
  for (const record of input.records) {
    const primary = pickPrimaryVariants(record);
    const fieldClaimIds = primary.map((variant) => deterministicClaimId(record.recordId, variant.fieldKey));
    const keyClaimIds = primary
      .filter((variant) => keyFieldKeys.has(variant.fieldKey))
      .map((variant) => deterministicClaimId(record.recordId, variant.fieldKey));

    if (keyClaimIds.length === 0) continue;

    const claims = keyClaimIds.map((id) => syntheticClaim(id, record.recordId, input.queryId));
    const outcome = decideGate({
      recordId: record.recordId,
      queryId: claims[0]?.queryId ?? null,
      fieldClaimIds,
      keyClaimIds,
      claims: new Map(claims.map((c) => [c.claimId, c])),
      verdicts: verdictByClaim,
      evidenceByClaim,
      asOf: new Date().toISOString(),
    });

    await input.store.append('records', outcome.summary);
    summaries.push(outcome.summary);

    const urls =
      outcome.summary.gate === 'strong'
        ? outcome.cooccurringUrls
        : supportingUrlsUnion(keyClaimIds, evidenceByClaim);
    const anchor = deriveAnchor({
      record,
      summary: outcome.summary,
      cooccurringUrls: urls,
      weakestKeyGrade: outcome.weakestKeyGrade,
      query: input.query,
      pack: input.pack,
      traceId: input.runId,
      keyClaimIds,
    });
    if (anchor) {
      await input.store.append('anchors', anchor);
      anchors.push(anchor);
    }
  }

  return { summaries, anchors };
}

/** 门禁只需要 claimId / recordId / queryId，这里给一个形状正确的轻量对象（不新增存储） */
function syntheticClaim(claimId: string, recordId: string, queryId: string | null): ClaimRecord {
  return {
    claimId,
    queryId,
    recordId,
    fieldRole: 'key',
    rawText: '',
    atomicText: '',
    subject: '',
    predicate: '',
    object: '',
    timeScope: { from: null, to: null },
    channel: 'enumerative',
    provenance: { stabilityRuns: 0, stabilityHits: 0, promptedDetail: false, selectionReason: null },
    triage: { passed: true, reason: 'specific-and-decidable' },
    state: 'adjudicated',
    fieldKey: null,
    createdAt: new Date().toISOString(),
  };
}

/**
 * 从断言行重建记录容器（字段键 → 取值变体）。
 *
 * 两处用得到它：外部提交渠道（本来就没有提问环产物）、以及**跨轮重算门禁**
 * （从底稿读回断言，不需要再问一次模型）。
 */
export function recordsFromClaims(claims: ClaimRecord[], pack: DomainPack): AlignedRecord[] {
  const byRecord = new Map<string, AlignedRecord>();
  for (const claim of claims) {
    if (!claim.recordId || !claim.fieldKey) continue;
    let record = byRecord.get(claim.recordId);
    if (!record) {
      record = {
        recordId: claim.recordId,
        matchKey: claim.recordId,
        runs: Math.max(1, claim.provenance.stabilityRuns),
        recordHits: claim.provenance.stabilityHits,
        variants: [],
        rawTexts: [claim.rawText],
      };
      byRecord.set(claim.recordId, record);
    }
    record.variants.push({
      fieldKey: claim.fieldKey,
      value: claim.object,
      matchKey: pack.valueMatchKey(claim.fieldKey, claim.object),
      hits: claim.provenance.stabilityHits,
      firstSeenRun: 0,
      promptedDetail: claim.provenance.promptedDetail,
    });
  }
  return [...byRecord.values()];
}

/**
 * 跨轮重算：只用底稿，不花任何检索、抓取或模型预算。
 *
 * 为什么要它：底稿是只追加的，同一批断言在四轮里各自抓到过不同的独立来源，
 * 而每轮的裁决只看得见本轮证据——想把"已经查到的东西"合起来看，就得有这一条通路。
 * 重算同样是**追加**一行新裁决（读时取最后一条），历史结论不被改写。
 */
export async function retallyAndRegate(input: {
  store?: LodestarStore;
  pack?: DomainPack;
  recordIds?: string[];
  /** 重算说明写进裁决足迹，事后能看出这行是合起来的、不是新查的 */
  note?: string;
  /** 产出这批记录的提问原文（重算不改变坐标的身份；缺省记为"无新提问"） */
  query?: string;
}): Promise<{ verdicts: VerdictRecord[]; summaries: RecordSummary[]; anchors: AnchorRecord[] }> {
  const store = input.store ?? createStore();
  const pack = input.pack ?? DEFAULT_PACK;
  const log = createLogger({ prefix: '[Lodestar Retally] ' });

  const claims = await store.query<ClaimRecord>('claims');
  const evidenceRows = await store.allRows<EvidenceRecord>('evidence');
  const priorVerdicts = await store.query<VerdictRecord>('verdicts');
  const priorByClaim = new Map(priorVerdicts.map((v) => [v.claimId, v]));
  const targets = claims.filter((c) =>
    input.recordIds && input.recordIds.length > 0
      ? c.recordId !== null && input.recordIds.includes(c.recordId)
      : true,
  );

  const verdicts: VerdictRecord[] = [];
  for (const claim of targets) {
    const rows = mergeEvidenceRows(evidenceRows, claim.claimId);
    if (rows.length === 0) continue;
    const prior = priorByClaim.get(claim.claimId);
    const result = retally(claim.claimId, rows, {
      promptedDetail: claim.provenance.promptedDetail,
      budget: prior?.footprint.budget ?? { searchCalls: 0, pagesFetched: 0, searchCap: 0, pageCap: 0 },
      coverage: {
        candidateCount: prior?.footprint.candidates.length ?? 0,
        examinedCount: prior?.footprint.fetched.length ?? 0,
      },
    });
    const traceId = [...rows].reverse().find((r) => r.traceId !== '')?.traceId ?? prior?.traceId;
    if (!traceId) continue;   // 没有任何底稿可指 → 不落裁决（红线：没有底稿的结论不落库）
    const verdict: VerdictRecord = {
      claimId: claim.claimId,
      verdict: result.verdict,
      evidenceGrade: result.evidenceGrade,
      supportCount: result.supportCount,
      refuteCount: result.refuteCount,
      ...(result.notFoundCause ? { notFoundCause: result.notFoundCause } : {}),
      footprint: {
        ...(prior?.footprint ?? {
          queries: [],
          candidates: [],
          fetched: [],
          failed: [],
          rejected: [],
          budget: { searchCalls: 0, pagesFetched: 0, searchCap: 0, pageCap: 0 },
          candidatesCovered: false,
        }),
        rejected: [
          ...(prior?.footprint.rejected ?? []),
          { url: '(retally)', reason: input.note ?? '跨轮合并底稿已有证据重算，未新增检索与抓取' },
        ],
      },
      traceId,
      adjudicatedAt: new Date().toISOString(),
    };
    await store.append('verdicts', verdict);
    verdicts.push(verdict);
    log.dev.debug(`${claim.claimId} 重算 → ${verdict.verdict}/${verdict.evidenceGrade}（独立支持来源 ${verdict.supportCount}）`);
  }

  const records = recordsFromClaims(targets, pack);
  const gate = await applyRecordGate({
    records,
    pack,
    store,
    verdicts,
    evidence: evidenceRows,
    query: input.query ?? '（跨轮重算，无新提问）',
    queryId: targets.find((c) => c.queryId)?.queryId ?? null,
    runId: `lodestar-retally-${Date.now()}`,
  });
  return { verdicts, summaries: gate.summaries, anchors: gate.anchors };
}

/**
 * 一次比对调用的成本形状：读一份已经在底稿里的正文快照，问模型"这页支不支持这句断言"。
 * 与 `retallyAndRegate` 的区别只在这里**要调模型**：那边纯粹是把既有证据行重新数一遍。
 *
 * 为什么需要它：共现门禁要"同一页面同时命中全部关键字段"，而每个字段的检索各自只会
 * 捞回自己那批候选页——真正同时写着机构、时间、专场名的页面往往只在其中一个字段的
 * 结果里露面。于是"每字段都成立、整条记录凑不齐共现"（弱坐标）。补齐的办法不是再花
 * 一次检索与抓取，而是把同记录已经抓回来的页面喂给还缺的那个字段再比一次。
 *
 * 快照复用不放松任何红线：证据行的 `snapshotRef` 指回当初 Lodestar 自抓的那份正文，
 * 引文逐字校验仍然对着同一串字节；`note` 里写明复用了哪一行，事后能看出这行没重抓。
 */
export async function compareAcrossRecordPool(input: {
  store?: LodestarStore;
  pack?: DomainPack;
  recordIds?: string[];
  /** 本次最多发几次比对调用（钱就花在这里：检索与抓取都是零） */
  maxCompareCalls?: number;
  onStage?: (stage: string, detail?: Record<string, unknown>) => void;
}): Promise<{
  /** 补比之前的缺口（字段 × 已有页面）总数，用于事后判断额度够不够 */
  gaps: number;
  /** 按花费优先级排好的缺口清单（干跑时用它看"这些钱会花在哪几页"） */
  gapPlan: Array<{ recordId: string; fieldKey: string; url: string; tier: SourceTier; hitKeys: number }>;
  evidence: EvidenceRecord[];
  verdicts: VerdictRecord[];
  summaries: RecordSummary[];
  anchors: AnchorRecord[];
  compareCalls: number;
  /** 预筛后仍值得比一次的缺口数（花钱只在 workable 与 maxCompareCalls 的交集里发生） */
  workable: number;
  /** 预筛判"这页根本没有这个字段的说法"而省掉的比对（读本地快照，零花费） */
  prescreened: Array<{ url: string; claimId: string }>;
  rejections: Array<{ url: string; reason: string }>;
}> {
  const store = input.store ?? createStore();
  const pack = input.pack ?? DEFAULT_PACK;
  const maxCompareCalls = input.maxCompareCalls ?? 8;
  const log = createLogger({ prefix: '[Lodestar CrossPool] ' });

  const claims = await store.query<ClaimRecord>('claims');
  const evidenceRows = await store.allRows<EvidenceRecord>('evidence');
  const keyFieldKeys = keyFieldKeysOf(pack.fields());
  const plan = planRecordPoolGaps({
    claims,
    evidence: evidenceRows,
    keyFieldKeys,
    recordIds: input.recordIds,
  });
  const evidenceByClaim = plan.evidenceByClaim;
  const claimById = new Map(claims.map((c) => [c.claimId, c]));
  const keyClaimIdsByRecord = new Map<string, string[]>();
  for (const claim of claims) {
    if (claim.recordId === null || claim.fieldKey === null) continue;
    if (!keyFieldKeys.includes(claim.fieldKey)) continue;
    if (claim.routing?.route === 'reject') continue;
    bucketFor(keyClaimIdsByRecord, claim.recordId).push(claim.claimId);
  }

  const gaps = plan.items;
  const newEvidence: EvidenceRecord[] = [];
  const rejections: Array<{ url: string; reason: string }> = [];
  /** 预筛替我们省掉的比对（读本地快照 + 策略包规则，两者都不花钱），只记账不花额度 */
  const prescreened: Array<{ url: string; claimId: string }> = [];
  let compareCalls = 0;

  /**
   * 先免费过一遍：读本地快照 + 跑策略包的写法规则，把"这页压根没这个字段的说法"的缺口剔掉。
   * 分两趟的理由——预筛不花钱，所以**干跑（额度 0）也要给出剔掉了多少**，否则这个数只有花钱才看得见；
   * 花钱的那趟再按额度截断。
   */
  interface Workable {
    gap: (typeof gaps)[number];
    claim: ClaimRecord;
    page: CapturedPage;
  }
  const workable: Workable[] = [];
  const alreadyDone = (gap: (typeof gaps)[number]): boolean =>
    (evidenceByClaim.get(gap.claimId) ?? []).some((e) => e.url === gap.page.url);
  const coOccurring = (recordId: string): boolean =>
    findCooccurringUrls(keyClaimIdsByRecord.get(recordId) ?? [], evidenceByClaim).length > 0;

  for (const gap of gaps) {
    const claim = claimById.get(gap.claimId);
    if (!claim || claim.fieldKey === null) continue;
    if (coOccurring(gap.recordId) || alreadyDone(gap)) continue;
    const text = await readSnapshot(store, gap.page.snapshotRef);
    if (text === null || text.trim() === '') {
      rejections.push({ url: gap.page.url, reason: `快照缺失或为空：${gap.page.snapshotRef}` });
      continue;
    }
    const page: CapturedPage = {
      url: gap.page.url,
      text: text.slice(0, pageTextCharBudget()),
      snapshotRef: gap.page.snapshotRef,
      fetchedAt: gap.page.fetchedAt,
      strategy: 'cache',
    };
    if (pack.pageMentions(claim.fieldKey, claim.object, page.text) === 'no') {
      prescreened.push({ url: gap.page.url, claimId: gap.claimId });
      continue;
    }
    workable.push({ gap, claim, page });
  }

  for (const item of workable) {
    if (compareCalls >= maxCompareCalls) break;
    const { gap, claim, page: captured } = item;
    // 本轮前几次比对可能刚把这条记录凑齐，也可能同页已被别的断言比过
    if (coOccurring(gap.recordId) || alreadyDone(gap)) continue;

    compareCalls += 1;
    const outcome = await compareClaimToPage({ claim, page: captured, pack, logger: log });
    if ('rejected' in outcome) {
      rejections.push({ url: gap.page.url, reason: outcome.reason });
      continue;
    }
    const row: EvidenceRecord = {
      evidenceId: newId('evidence'),
      claimId: gap.claimId,
      url: gap.page.url,
      domain: gap.page.domain,
      sourceFamily: gap.page.sourceFamily,
      tier: gap.page.tier,
      quote: outcome.quote,
      relation: outcome.relation,
      contentWeight: outcome.contentWeight,
      fetchedBy: 'lodestar',
      fetchedAt: captured.fetchedAt,
      snapshotRef: captured.snapshotRef,
      traceId: gap.page.traceId,
      fieldKey: claim.fieldKey,
      recordId: claim.recordId,
      note:
        `复用 ${gap.page.evidenceId} 已抓正文补比对（本记录页面池，零检索零抓取）` +
        (outcome.pageTopic ? `；页面主题：${outcome.pageTopic}` : ''),
    };
    await store.append('evidence', row);
    newEvidence.push(row);
    bucketFor(evidenceByClaim, gap.claimId).push(row);
    input.onStage?.('cross-pool', {
      claimId: row.claimId,
      url: row.url,
      relation: row.relation,
      reusedSnapshot: row.snapshotRef,
    });
  }

  if (compareCalls === 0 && gaps.length > 0) {
    log.dev.warn(`有 ${gaps.length} 个缺口但比对预算为 0，只重算门禁`);
  }

  const gate = await retallyAndRegate({
    store,
    pack,
    recordIds: input.recordIds,
    note: `记录级页面池补比对 ${compareCalls} 次（新增支持 ${newEvidence.filter((e) => e.relation === 'supports').length} 条），其余证据沿用既有底稿`,
  });
  return {
    gaps: gaps.length,
    gapPlan: gaps.map((g) => ({
      recordId: g.recordId,
      fieldKey: g.fieldKey,
      url: g.page.url,
      tier: g.page.tier,
      hitKeys: g.hitKeys,
    })),
    evidence: newEvidence,
    ...gate,
    compareCalls,
    workable: workable.length,
    prescreened,
    rejections,
  };
}

function bucketFor<K, V>(map: Map<K, V[]>, key: K): V[] {
  const existing = map.get(key);
  if (existing) return existing;
  const created: V[] = [];
  map.set(key, created);
  return created;
}

/** 同一条断言的全部证据行（按证据号去重，跨轮重复抓同一页只算一票） */
function mergeEvidenceRows(rows: EvidenceRecord[], claimId: string): EvidenceRecord[] {
  const byId = new Map<string, EvidenceRecord>();
  for (const row of rows) {
    if (row.claimId !== claimId) continue;
    byId.set(row.evidenceId, row);
  }
  return [...byId.values()];
}

function summarize(
  bundle: VerifiedBundle,
  elicited: {
    records: AlignedRecord[];
    claims: ClaimRecord[];
    rejectedClaims: ClaimRecord[];
    stats?: { overBudgetFields?: number };
  },
  gate: { summaries: RecordSummary[]; anchors: AnchorRecord[] },
): RunQueryResult['stats'] {
  const notFound = bundle.verdicts.filter((v) => v.verdict === 'not_found');
  return {
    recordsAligned: elicited.records.length,
    claimsAtomized: elicited.claims.length,
    claimsAdjudicated: bundle.verdicts.length,
    claimsRejected: elicited.rejectedClaims.length,
    claimsPaused: bundle.pausedClaimIds.length,
    claimsFailed: bundle.failedClaimIds.length,
    strongAnchors: gate.summaries.filter((s) => s.gate === 'strong').length,
    weakAnchors: gate.summaries.filter((s) => s.gate === 'weak').length,
    searchCalls: bundle.searchCalls,
    pagesFetched: bundle.pagesFetched,
    compareCalls: bundle.compareCalls,
    notFoundCauses: {
      budget: notFound.filter((v) => v.notFoundCause === 'budget').length,
      coverage: notFound.filter((v) => v.notFoundCause === 'coverage').length,
      genuinely_absent: notFound.filter((v) => v.notFoundCause === 'genuinely_absent').length,
    },
    overBudgetFields: elicited.stats?.overBudgetFields ?? 0,
  };
}

/**
 * 从底稿继续跑：把 paused / pending / failed 的断言重新驱动一遍。
 *
 * 语义是**重跑而非断点续跑**（复用既有裁决；断点续跑的状态复杂度不值得）：
 * 已落库的证据行保留，新证据照常追加，裁决按最后一条为准。
 */
export async function resumeFromLedger(input: {
  store?: LodestarStore;
  pack?: DomainPack;
  ablations?: AblationState;
  caps?: Partial<AdjudicationCaps>;
  claimIds?: string[];
  query: string;
}): Promise<RunQueryResult> {
  const store = input.store ?? createStore();
  const pack = input.pack ?? DEFAULT_PACK;
  const resumable = await store.query<ClaimRecord>('claims', (c) =>
    input.claimIds
      ? input.claimIds.includes(c.claimId)
      : c.state === 'paused' || c.state === 'pending' || c.state === 'failed',
  );
  const records = await loadRecordsFromLedger(store, pack, resumable);
  const runId = `lodestar-resume-${Date.now()}`;
  const adjudicated = await verifyClaims({
    claims: resumable,
    records,
    pack,
    store,
    ablations: input.ablations ?? NO_ABLATIONS,
    caps: { ...DEFAULT_CAPS, ...(input.caps ?? {}) },
    runId,
  });
  const startedAt = adjudicated.startedAt;
  const gate = await applyRecordGate({
    records,
    pack,
    store,
    verdicts: adjudicated.verdicts,
    evidence: adjudicated.evidence,
    query: input.query,
    queryId: resumable[0]?.queryId ?? null,
    runId,
  });
  const verdicts = await store.query<VerdictRecord>('verdicts');
  const stats = summarize(adjudicated, { records, claims: resumable, rejectedClaims: [] }, gate);
  return {
    queryId: resumable[0]?.queryId ?? newId('query'),
    query: input.query,
    runId,
    packId: pack.id,
    records,
    claims: resumable,
    verdicts,
    anchors: gate.anchors,
    summaries: gate.summaries,
    stats,
    /** 续跑不再提问，提问环统计无从补记 */
    elicitation: null,
    pausedClaimIds: adjudicated.pausedClaimIds,
    failedClaimIds: adjudicated.failedClaimIds,
  };
}

/**
 * 从底稿重建记录容器（重跑时不再问模型）。
 *
 * 记录里的字段值从断言的 object 反推：`fieldKey` 就是记录里的列，
 * `object` 就是那一格的值——这也是原子化纪律反过来成立的证据：
 * 字段级断言留得住记录形状。
 */
async function loadRecordsFromLedger(
  store: LodestarStore,
  pack: DomainPack,
  claims: ClaimRecord[],
): Promise<AlignedRecord[]> {
  const summaries = await store.query<RecordSummary>('records');
  const byRecord = new Map<string, AlignedRecord>();
  const specByKey = new Map(pack.fields().map((f) => [f.key, f]));

  for (const claim of claims) {
    if (!claim.recordId) continue;
    let record = byRecord.get(claim.recordId);
    if (!record) {
      record = {
        recordId: claim.recordId,
        matchKey: claim.recordId,
        runs: Math.max(1, claim.provenance.stabilityRuns),
        recordHits: claim.provenance.stabilityHits,
        variants: [],
        rawTexts: [claim.rawText],
      };
      byRecord.set(claim.recordId, record);
    }
    const fieldKey = claim.fieldKey ?? '';
    record.variants.push({
      fieldKey,
      value: claim.object,
      matchKey: fieldKey === '' ? claim.object : pack.valueMatchKey(fieldKey, claim.object),
      hits: claim.provenance.stabilityHits,
      firstSeenRun: 0,
      promptedDetail: claim.provenance.promptedDetail,
    });
  }

  // 已进门禁的记录按 records.jsonl 的关键字段并回缺失变体（重跑不该丢字段）
  for (const summary of summaries) {
    const record = byRecord.get(summary.recordId);
    if (!record) continue;
    for (const claimId of summary.fieldClaimIds) {
      if (record.variants.some((v) => deterministicClaimId(record.recordId, v.fieldKey) === claimId)) continue;
      const claim = await store.get<ClaimRecord>('claims', claimId);
      if (!claim) continue;
      const fieldKey = claim.fieldKey ?? '';
      const spec = specByKey.get(fieldKey);
      if (!spec) continue;
      record.variants.push({
        fieldKey,
        value: claim.object,
        matchKey: pack.valueMatchKey(fieldKey, claim.object),
        hits: claim.provenance.stabilityHits,
        firstSeenRun: 0,
        promptedDetail: claim.provenance.promptedDetail,
      });
    }
  }
  return [...byRecord.values()];
}

/** 只读导出：当前底稿里的全部强坐标（供下游与人工抽查） */
export async function readAnchors(store: LodestarStore = createStore()): Promise<AnchorRecord[]> {
  return store.query<AnchorRecord>('anchors');
}

export { findCooccurringUrls };
