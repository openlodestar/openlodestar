// src/lodestar/intake/parse-answer.ts
/**
 * 模型作答 → 记录容器（纯函数，可离线测）
 *
 * 这一层是输入侧唯一的"解析"关口：模型给的是文本，引擎要的是行。
 * 三种坏形态都在这里当场收敛，不留给下游猜测——
 * 非 JSON 数组、数组里混非对象、列名对不上，分别计数上报（弃权率要看它们）。
 */

import { extractJsonArray } from '@src/llm';
import type { DomainPack } from '../packs/pack';
import { isDiscardableRow, type MappedRow } from './record-container';

/** 一次作答的解析结果（含坏形态计数，供上层统计与告警） */
export interface ParsedAnswer {
  rows: MappedRow[];
  /** 模型给的对象行数（含映射后全空的行） */
  rawRowCount: number;
  /** 非对象元素（模型把一行写成了字符串或数字） */
  skippedNonObject: number;
  /** 关键字段全空被丢弃的行（这是弃权许可真的生效的证据） */
  discardedAbstained: number;
  /** 解析失败的原因（JSON 不是数组等）；成功时为 null */
  parseError: string | null;
}

const EMPTY: ParsedAnswer = {
  rows: [],
  rawRowCount: 0,
  skippedNonObject: 0,
  discardedAbstained: 0,
  parseError: null,
};

/**
 * 把模型原文解析成映射后的行。
 *
 * @param text 模型返回的原始内容
 * @param pack 策略包（列名别名与关键字段由它给）
 */
export function parseModelRows(text: string, pack: DomainPack): ParsedAnswer {
  let parsed: unknown[];
  try {
    parsed = extractJsonArray(text);
  } catch (error) {
    return { ...EMPTY, parseError: error instanceof Error ? error.message : String(error) };
  }

  const rows: MappedRow[] = [];
  let rawRowCount = 0;
  let skippedNonObject = 0;
  let discardedAbstained = 0;

  for (const element of parsed) {
    if (typeof element !== 'object' || element === null || Array.isArray(element)) {
      skippedNonObject += 1;
      continue;
    }
    rawRowCount += 1;
    const mapped = pack.mapRow(element as Record<string, unknown>);
    if (isDiscardableRow(mapped, pack)) {
      discardedAbstained += 1;
      continue;
    }
    rows.push(mapped);
  }

  return { rows, rawRowCount, skippedNonObject, discardedAbstained, parseError: null };
}

/** 来源坐标的一条候选入口（网址可空：只记得机构时由下游检索补齐） */
export interface SourceAnswerRow {
  /** 模型给的真实网址；没给或不是 http(s) 时为 null */
  url: string | null;
  fields: Record<string, string | null>;
}

export interface ParsedSourceAnswer {
  rows: SourceAnswerRow[];
  /** 解析失败原因（非 JSON 数组等） */
  parseError: string | null;
  /** 关键来源字段全空被丢弃的行（空壳行，不是入口） */
  discarded: number;
}

/**
 * 来源坐标作答解析：与事件侧共用"模型给文本、引擎要行"的关口，但行里多了网址。
 *
 * 网址只认 http(s)：模型常把机构名写进网址列，或给一个搜索结果的跳转串——
 * 这些都不是可抓的入口，按"没给网址"处理（下游会重新检索），绝不自己拼一个。
 *
 * 只要行里还有**任何一个**来源字段（如只写了机构/平台）就保留：旧判据只认关键字段
 * （主题/年代），会把"记得机构、记不得器物"的行当空壳丢掉，而下游本就允许靠机构名检索。
 */
export function parseSourceRows(text: string, pack: DomainPack): ParsedSourceAnswer {
  let parsed: unknown[];
  try {
    parsed = extractJsonArray(text);
  } catch (error) {
    return { rows: [], parseError: error instanceof Error ? error.message : String(error), discarded: 0 };
  }

  const rows: SourceAnswerRow[] = [];
  let discarded = 0;

  for (const element of parsed) {
    if (typeof element !== 'object' || element === null || Array.isArray(element)) continue;
    const obj = element as Record<string, unknown>;
    const fields = pack.mapSourceRow ? pack.mapSourceRow(obj) : fallbackSourceFields(obj);
    const hasIdentity = Object.values(fields).some(
      (value) => typeof value === 'string' && value.trim() !== '',
    );
    if (!hasIdentity) {
      discarded += 1;
      continue;
    }
    const rawUrl = typeof obj['网址'] === 'string' ? obj['网址'] : typeof obj.url === 'string' ? obj.url : '';
    const url = /^https?:\/\/\S+$/i.test(rawUrl.trim()) ? rawUrl.trim() : null;
    rows.push({ url, fields });
  }

  return { rows, parseError: null, discarded };
}

/** 包没给来源列名别名时的兜底：字段键原样取，只剔除网址列 */
function fallbackSourceFields(obj: Record<string, unknown>): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === '网址' || key === 'url') continue;
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    const text = String(value).trim();
    if (text !== '') out[key] = text;
  }
  return out;
}

/**
 * 具体化追问的应答解析：`matchKey` 必须原样照抄，否则该补丁整条作废
 * （借来的 key 会把 A 场的年份补到 B 场上——记录容器的第一纪律）。
 */
export function parseConcretizationPatches(
  text: string,
  pack: DomainPack,
  allowedMatchKeys: Set<string>,
): Array<{ matchKey: string; fields: MappedRow }> {
  let parsed: unknown[];
  try {
    parsed = extractJsonArray(text);
  } catch {
    return [];
  }
  const out: Array<{ matchKey: string; fields: MappedRow }> = [];
  for (const element of parsed) {
    if (typeof element !== 'object' || element === null || Array.isArray(element)) continue;
    const obj = element as Record<string, unknown>;
    const matchKey = typeof obj.matchKey === 'string' ? obj.matchKey.trim() : '';
    if (matchKey === '' || !allowedMatchKeys.has(matchKey)) continue;
    const rest: Record<string, unknown> = { ...obj };
    delete rest.matchKey;
    const fields = pack.mapRow(rest);
    if (Object.keys(fields).length === 0) continue;
    out.push({ matchKey, fields });
  }
  return out;
}
