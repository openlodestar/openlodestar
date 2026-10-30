// src/integrations/source-blacklist/entries.ts
/**
 * 来源黑名单 — 数据层（JSON 加载 / 缓存）
 *
 * 单一数据源 = `data/source-blacklist.json`，条目格式：
 * `{ domain, path?, reason }`
 *
 * 与白名单的关键差异：**缺失配置不抛错，返回空数组**——
 * 黑名单为空 = 无行为变化；白名单是强依赖，黑名单是可选修正。
 *
 * 条目语义：
 * - 域名级（缺省 path）：屏蔽该域及全部子域；
 * - URL 级（含 path）：hostname 后缀命中且 pathname 归一化后精确相等才屏蔽。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** 人工确认的黑名单成因 */
export type BlacklistReason = 'no-price' | 'anti-crawl' | 'nav-hub' | 'other';

/** 黑名单条目 */
export interface BlacklistEntry {
  domain: string;
  /** 存在 = URL 级条目（仅屏蔽该 hostname 下该精确路径，'/' 即首页） */
  path?: string;
  reason: BlacklistReason;
}

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(moduleDir, '..', '..', '..');

/** 黑名单文件路径；可用 `OPENLODESTAR_BLACKLIST_FILE` 覆盖 */
export function blacklistFilePath(): string {
  const fromEnv = process.env.OPENLODESTAR_BLACKLIST_FILE;
  if (fromEnv && fromEnv.trim() !== '') {
    return path.isAbsolute(fromEnv) ? fromEnv : path.resolve(PACKAGE_ROOT, fromEnv);
  }
  return path.join(PACKAGE_ROOT, 'data', 'source-blacklist.json');
}

let _entriesCache: BlacklistEntry[] | null = null;

function parseEntries(): BlacklistEntry[] {
  if (_entriesCache) return _entriesCache;
  const file = blacklistFilePath();
  if (!fs.existsSync(file)) {
    _entriesCache = [];
    return _entriesCache;
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (!Array.isArray(raw)) {
    _entriesCache = [];
    return _entriesCache;
  }
  _entriesCache = (raw as unknown[]).flatMap((item) => {
    if (item && typeof item === 'object' && 'domain' in item) {
      const entry = item as { domain?: unknown; path?: unknown; reason?: unknown };
      if (typeof entry.domain !== 'string') return [];
      const domain = entry.domain.toLowerCase().trim();
      if (domain.length === 0) return [];
      const reason =
        entry.reason === 'no-price' ||
        entry.reason === 'anti-crawl' ||
        entry.reason === 'nav-hub' ||
        entry.reason === 'other'
          ? entry.reason
          : 'other';
      const pathValue = typeof entry.path === 'string' ? entry.path.trim() : undefined;
      return [
        {
          domain,
          ...(pathValue && pathValue.length > 0 ? { path: pathValue } : {}),
          reason,
        },
      ];
    }
    return [];
  });
  return _entriesCache;
}

/** 全量黑名单条目 */
export function getBlacklistEntries(): BlacklistEntry[] {
  return parseEntries();
}

/** 清空黑名单缓存（修改 JSON 后调用） */
export function resetBlacklistCache(): void {
  _entriesCache = null;
}
