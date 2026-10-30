// src/integrations/source-whitelist/entries.ts
/**
 * 来源域名白名单 — 数据层（JSON 加载 / 缓存 / verified 过滤）
 *
 * 单一数据源 = `data/source-whitelist.json`，条目格式：
 * `{ domain, name, category?, status? }`
 *
 * status 语义：
 * - `verified`：已人工核实，生效；
 * - `candidate`：尚未核实，**不参与准入与检索目标**，但参与权威档位判定
 *   （一支已知的头部拍行，其域名身份不因"我们还没抓过"而降级）；
 * - `dead`：已证伪，不生效；
 * - 缺省：按 verified 处理（兼容旧格式）。
 *
 * 全量读取（含 candidate/dead）供策略包判档位与管理端展示；
 * 管线边界的 `site:` 定向只用 verified。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** 白名单条目状态 */
export type WhitelistEntryStatus = 'verified' | 'candidate' | 'dead';

/** 白名单条目 */
export interface WhitelistEntry {
  /** 域名（小写，如 sothebys.com） */
  domain: string;
  /** 来源名称（如"苏富比"） */
  name: string;
  /** 来源分类（auction / ecommerce / collector_site / media） */
  category?: string;
  /** 状态：缺省视为 verified */
  status?: WhitelistEntryStatus;
}

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(moduleDir, '..', '..', '..');

/**
 * 白名单文件路径。
 * 可用 `OPENLODESTAR_WHITELIST_FILE` 覆盖（相对路径按包根解析）。
 */
export function whitelistFilePath(): string {
  const fromEnv = process.env.OPENLODESTAR_WHITELIST_FILE;
  if (fromEnv && fromEnv.trim() !== '') {
    return path.isAbsolute(fromEnv) ? fromEnv : path.resolve(PACKAGE_ROOT, fromEnv);
  }
  return path.join(PACKAGE_ROOT, 'data', 'source-whitelist.json');
}

/** 条目是否生效：显式 candidate / dead 不生效，缺省按 verified 处理 */
export function isEffectiveEntry(entry: Pick<WhitelistEntry, 'status'>): boolean {
  return entry.status === undefined || entry.status === 'verified';
}

let _allEntriesCache: WhitelistEntry[] | null = null;
let _entriesCache: WhitelistEntry[] | null = null;
let _domainsCache: Set<string> | null = null;

function parseAllEntries(): WhitelistEntry[] {
  if (_allEntriesCache) return _allEntriesCache;
  const file = whitelistFilePath();
  if (!fs.existsSync(file)) {
    throw new Error(
      `source-whitelist: 白名单文件不存在（${file}）。` +
        '数据文件随仓库发布；或用 OPENLODESTAR_WHITELIST_FILE 指向自己的清单。',
    );
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (!Array.isArray(raw)) {
    throw new Error(`source-whitelist: ${file} 顶层应为数组`);
  }
  _allEntriesCache = (raw as unknown[]).flatMap((item) => {
    if (typeof item === 'string') {
      return [{ domain: item.toLowerCase().trim(), name: '' }];
    }
    if (item && typeof item === 'object' && 'domain' in item) {
      const entry = item as {
        domain?: unknown;
        name?: unknown;
        category?: unknown;
        status?: unknown;
      };
      if (typeof entry.domain !== 'string') return [];
      const domain = entry.domain.toLowerCase().trim();
      if (domain.length === 0) return [];
      return [
        {
          domain,
          name: typeof entry.name === 'string' ? entry.name.toLowerCase().trim() : '',
          ...(typeof entry.category === 'string' ? { category: entry.category } : {}),
          ...(entry.status === 'verified' || entry.status === 'candidate' || entry.status === 'dead'
            ? { status: entry.status }
            : {}),
        },
      ];
    }
    return [];
  });
  return _allEntriesCache;
}

/** 生效条目（仅 verified）——准入判定与定向检索的唯一入口 */
export function loadEntries(): WhitelistEntry[] {
  if (_entriesCache) return _entriesCache;
  _entriesCache = parseAllEntries().filter(isEffectiveEntry);
  return _entriesCache;
}

/** 生效域名 Set（仅 verified，带缓存） */
export function getVerifiedDomainSet(): Set<string> {
  if (_domainsCache) return _domainsCache;
  _domainsCache = new Set(loadEntries().map((entry) => entry.domain));
  return _domainsCache;
}

/** 全量条目（含 candidate/dead）——策略包判档位、管理端展示用 */
export function getAllWhitelistEntries(): WhitelistEntry[] {
  return parseAllEntries();
}

/** 生效条目列表（verified-only 视角的清单读取） */
export function getWhitelistEntries(): WhitelistEntry[] {
  return loadEntries();
}

/** 清空白名单缓存（修改 JSON 后调用，读侧立即可见） */
export function resetWhitelistCache(): void {
  _allEntriesCache = null;
  _entriesCache = null;
  _domainsCache = null;
}
