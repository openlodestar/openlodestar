// src/integrations/source-blacklist/matching.ts
/**
 * 来源黑名单 — 纯函数匹配层（URL 命中判定）
 *
 * 匹配粒度：
 * - 域名级条目（无 path）：hostname 后缀匹配命中即屏蔽（覆盖全部子域）；
 * - URL 级条目（含 path）：hostname 后缀命中 **且** pathname 归一化后精确相等；
 * - pathname 归一化：'' → '/'；query/hash 不参与匹配；
 * - URL 解析失败 → 不屏蔽。
 */

import { getBlacklistEntries, type BlacklistEntry } from './entries';

function normalizePathname(pathname: string): string {
  return pathname.length === 0 ? '/' : pathname;
}

/** 命中判定：返回命中的条目（含 reason），未命中返回 null */
export function matchBlacklistEntry(url: string): BlacklistEntry | null {
  let hostname: string;
  let pathname: string;
  try {
    const parsed = new URL(url);
    hostname = parsed.hostname.toLowerCase();
    pathname = parsed.pathname;
  } catch {
    return null;
  }
  const h = hostname.trim();
  if (!h) return null;
  const normalized = normalizePathname(pathname);
  for (const entry of getBlacklistEntries()) {
    const d = entry.domain;
    const hostMatch = h === d || h.endsWith('.' + d);
    if (!hostMatch) continue;
    if (entry.path === undefined || normalized === entry.path) return entry;
  }
  return null;
}

/** URL 是否命中黑名单 */
export function isUrlBlocked(url: string): boolean {
  return matchBlacklistEntry(url) !== null;
}
