// src/integrations/source-whitelist/matching.ts
/**
 * 来源域名白名单 — 纯函数匹配层
 *
 * 域名匹配一律后缀匹配（`hostname === d || hostname.endsWith('.' + d)`），
 * 覆盖 `item.taobao.com` 这类子域名。名称匹配为归一化后的双向包含 + 域名主标签兜底。
 */

import { loadEntries, getVerifiedDomainSet, type WhitelistEntry } from './entries';

/** 判断域名是否在白名单中（后缀匹配，仅 verified 条目） */
export function isDomainAllowed(domain: string): boolean {
  const whitelist = getVerifiedDomainSet();
  const d = domain.toLowerCase().trim();
  if (whitelist.has(d)) return true;
  for (const allowed of whitelist) {
    if (d.endsWith('.' + allowed)) return true;
  }
  return false;
}

/** 按后缀匹配查找 hostname 命中的白名单条目（仅 verified）；未命中返回 null */
export function matchWhitelistEntry(hostname: string): WhitelistEntry | null {
  const h = hostname.toLowerCase().trim();
  if (!h) return null;
  const entries = loadEntries();
  const exact = entries.find((entry) => entry.domain === h);
  if (exact) return exact;
  return entries.find((entry) => h.endsWith('.' + entry.domain)) ?? null;
}

/** 名称归一化：小写、去空白与常见标点 */
function normalizeName(text: string): string {
  return text.toLowerCase().replace(/[\s·，,。.、'’\-—]+/g, '');
}

/** 判断来源名与页面域名是否指向同一来源（三种归一化包含关系） */
export function sourceNameMatchesDomain(hostname: string, sourceName: string | null): boolean {
  if (!sourceName) return false;
  const entry = matchWhitelistEntry(hostname);
  if (!entry) return false;
  const src = normalizeName(sourceName);
  if (!src) return false;
  if (entry.name) {
    const name = normalizeName(entry.name);
    if (name && (src.includes(name) || name.includes(src))) return true;
  }
  const label = entry.domain.split('.')[0] ?? '';
  return label.length >= 3 && src.includes(label);
}

/**
 * sourceName → 白名单域名家族反查（定向查询的输入）。
 *
 * 返回全部命中域名；名称不含任何生效条目时返回 null（调用方静默跳过定向查询）。
 * 仅扫 verified 生效条目——candidate/dead 域名不可作为 `site:` 查询目标。
 */
export function resolveSourceDomains(sourceName: string | null | undefined): string[] | null {
  if (!sourceName) return null;
  const src = normalizeName(sourceName);
  if (!src) return null;
  const hits: string[] = [];
  for (const entry of loadEntries()) {
    let matched = false;
    if (entry.name) {
      const name = normalizeName(entry.name);
      if (name && (src.includes(name) || name.includes(src))) matched = true;
    }
    if (!matched) {
      const label = entry.domain.split('.')[0] ?? '';
      if (label.length >= 3 && src.includes(label)) matched = true;
    }
    if (matched) hits.push(entry.domain);
  }
  return hits.length > 0 ? hits : null;
}
