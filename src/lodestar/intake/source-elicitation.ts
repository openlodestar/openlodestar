// src/lodestar/intake/source-elicitation.ts
/**
 * 来源坐标的入口供给提问环（模型记忆 → 候选入口页）
 *
 * 与事件侧的 `elicit()` 不是同一条流水线：事件要"一场场事件"并逐字段核验，
 * 来源坐标要"能再打开的入口页"，核验方式是**抓一页看它摊不摊得开**（入口门禁），
 * 不是逐字段共现。硬塞进事件流水线会把"入口页"当成"记录"去原子化，语义完全错位。
 *
 * 三件纪律：
 * 1. **网址可空**：模型对旧站内页的网址记忆不可靠，只记得机构/平台就留空，
 *    下游用 `searchPhrases` 检索补齐——绝不接受拼出来的网址（抓一轮才知道是假的）；
 * 2. **复问只为稳定性**：同一入口在几轮里出现几次记下来，供生产脚本决定先探哪几个；
 * 3. **不判真伪**：本模块只产候选。页面能不能当入口由 `deriveSourceAnchor` 判。
 */

import { invokeLLM, type ChatMessage } from '@src/llm';
import { getLodestarLoader } from '@src/prompts';
import { createLogger } from '@src/utils/logger';
import { normalizedUrlKey } from '@src/utils/url-utils';
import { newId } from '../ids';
import type { DomainPack } from '../packs/pack';
import type { AnswerRecord } from '../types';
import { parseSourceRows } from './parse-answer';
import { renderSourceEnumeration, sourcePhrasings } from './prompts';

/** 一次模型调用原始应答的落盘回调（与事件侧同形） */
export type SourceAnswerSink = (row: AnswerRecord) => Promise<void> | void;

export interface SourceElicitationOptions {
  /** 换措辞复问次数（含首次提问） */
  runs: number;
  /** 视为稳定复现的最低次数（低于它的候选仍然产出，只是标出来） */
  minHits: number;
  /** 最多保留几个候选入口页 */
  maxCandidates: number;
  onAnswer?: SourceAnswerSink;
}

export const DEFAULT_SOURCE_ELICITATION_OPTIONS: SourceElicitationOptions = {
  runs: 2,
  minHits: 1,
  maxCandidates: 10,
};

/** 一个候选入口页（来自模型记忆；网址可空） */
export interface SourceEntryCandidate {
  /** 模型给的网址（http/https）；没给为 null */
  url: string | null;
  fields: Record<string, string | null>;
  /** 在几轮应答里出现过 */
  hits: number;
  /** 第一次出现的轮次（0 基） */
  firstRun: number;
  /** 是否达到复现门槛 */
  stable: boolean;
}

export interface SourceElicitationResult {
  queryId: string;
  query: string;
  candidates: SourceEntryCandidate[];
  stats: {
    runs: number;
    rowsPerRun: number[];
    /** 关键字段全空被丢弃的空壳行 */
    discardedRows: number;
    parseFailures: number;
    /** 多轮合并掉的重复候选数 */
    mergedDuplicates: number;
    /** 网址为空的候选数（下游要检索补齐） */
    urlMissing: number;
  };
}

/** 候选的合并键：有网址按网址，没有网址按身份字段（同一机构+同一主题算同一条） */
function candidateKey(candidate: { url: string | null; fields: Record<string, string | null> }): string {
  if (candidate.url) return `u:${normalizedUrlKey(candidate.url)}`;
  const identity = ['topic', 'period', 'material', 'sourceName', 'category']
    .map((key) => (candidate.fields[key] ?? '').trim().toLowerCase())
    .join('|');
  return `f:${identity}`;
}

/** 一次 LLM 取回（重试一次仍失败即记为弃权轮，不让整条来源供给断链） */
async function askOnce(
  prompt: string,
  log: ReturnType<typeof createLogger>,
): Promise<string | null> {
  const params = getLodestarLoader().getLLMParams('source-enumeration');
  const messages: ChatMessage[] = [{ role: 'user', content: prompt }];
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await invokeLLM('text', messages, {
        ...(params.model ? { model: params.model } : {}),
        temperature: params.temperature ?? 0.3,
        maxTokens: params.max_tokens ?? 3000,
        enableThinking: false,
      });
      if (typeof result.content === 'string' && result.content.trim() !== '') return result.content;
    } catch (error) {
      log.dev.warn(
        `来源供给第 ${attempt + 1} 次尝试失败：${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return null;
}

/**
 * 跑一段来源供给：问题 → 复问 → 按网址（或身份字段）合并 → 截断。
 *
 * @param question 提问原文（如"清朝黄花梨躺椅有哪些可采集的权威入口页"）
 */
export async function elicitSourceEntries(
  question: string,
  pack: DomainPack,
  overrides: Partial<SourceElicitationOptions> = {},
): Promise<SourceElicitationResult> {
  const log = createLogger({ prefix: '[Lodestar Source Intake] ' });
  const options = { ...DEFAULT_SOURCE_ELICITATION_OPTIONS, ...overrides };
  const queryId = newId('query');
  const phrasings = sourcePhrasings(question, options.runs);

  const merged = new Map<string, SourceEntryCandidate>();
  const rowsPerRun: number[] = [];
  let discardedRows = 0;
  let parseFailures = 0;
  let mergedDuplicates = 0;

  for (const [runIndex, phrasing] of phrasings.entries()) {
    const answer = await askOnce(renderSourceEnumeration(pack, phrasing), log);
    if (answer === null) {
      parseFailures += 1;
      rowsPerRun.push(0);
      await options.onAnswer?.({
        answerId: newId('answer'),
        queryId,
        kind: 'enumeration',
        runIndex,
        phrasing,
        rawText: null,
        note: 'LLM 调用失败（重试一次仍无内容），记为弃权轮',
        createdAt: new Date().toISOString(),
      });
      continue;
    }
    const parsed = parseSourceRows(answer, pack);
    if (parsed.parseError !== null) parseFailures += 1;
    discardedRows += parsed.discarded;
    rowsPerRun.push(parsed.rows.length);
    await options.onAnswer?.({
      answerId: newId('answer'),
      queryId,
      kind: 'enumeration',
      runIndex,
      phrasing,
      rawText: answer,
      note: parsed.parseError === null ? null : `JSON 解析失败：${parsed.parseError}`,
      createdAt: new Date().toISOString(),
    });

    for (const row of parsed.rows) {
      const key = candidateKey(row);
      const existing = merged.get(key);
      if (existing) {
        existing.hits += 1;
        // 后一轮补上的字段值只填空位，不覆盖前一轮（同一入口的写法以第一次为准）
        for (const [field, value] of Object.entries(row.fields)) {
          if (value && !existing.fields[field]) existing.fields[field] = value;
        }
        mergedDuplicates += 1;
        continue;
      }
      merged.set(key, { url: row.url, fields: row.fields, hits: 1, firstRun: runIndex, stable: false });
    }
  }

  const candidates = [...merged.values()]
    .map((candidate) => ({ ...candidate, stable: candidate.hits >= options.minHits }))
    // 稳定复现的排前面，其次按出现轮次——生产脚本按这个顺序花抓取预算
    .sort((a, b) => Number(b.stable) - Number(a.stable) || b.hits - a.hits || a.firstRun - b.firstRun)
    .slice(0, options.maxCandidates);

  log.dev.debug(
    `来源供给 ${phrasings.length} 轮：行数 [${rowsPerRun.join(',')}]，候选 ${candidates.length} 条` +
      `（复现合并 ${mergedDuplicates} 条，网址缺失 ${candidates.filter((c) => c.url === null).length} 条）`,
  );

  return {
    queryId,
    query: question,
    candidates,
    stats: {
      runs: phrasings.length,
      rowsPerRun,
      discardedRows,
      parseFailures,
      mergedDuplicates,
      urlMissing: candidates.filter((candidate) => candidate.url === null).length,
    },
  };
}
