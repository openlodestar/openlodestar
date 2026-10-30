// src/lodestar/ids.ts
/**
 * 底稿主键生成
 *
 * 形态：前缀 + 当日日期 + 随机段，例如 `cl-20261001-a3f2`。
 * id 只要求唯一与可读，不承载顺序语义——顺序一律按 createdAt / asOf 判定。
 */

import { randomBytes } from 'node:crypto';

/** 当日日期串（本地时区，YYYYMMDD） */
export function dateStamp(at: Date = new Date()): string {
  const y = at.getFullYear();
  const m = String(at.getMonth() + 1).padStart(2, '0');
  const d = String(at.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/** 底稿主键前缀表 */
const ID_PREFIX = {
  query: 'q',
  record: 'rec',
  claim: 'cl',
  evidence: 'ev',
  answer: 'ans',
  probe: 'pb',
} as const;

export type IdKind = keyof typeof ID_PREFIX;

/** 生成一个底稿主键（suffixLen 默认 6 位十六进制，足够避开同日碰撞） */
export function newId(kind: IdKind, at: Date = new Date(), suffixLen = 6): string {
  const raw = randomBytes(Math.ceil(suffixLen / 2)).toString('hex');
  return `${ID_PREFIX[kind]}-${dateStamp(at)}-${raw.slice(0, suffixLen)}`;
}

/** 一次性 id 发生器：同一次运行内共享日期串，便于人工按前缀归堆 */
export function makeIdFactory(at: Date = new Date()): (kind: IdKind) => string {
  return (kind) => newId(kind, at);
}
