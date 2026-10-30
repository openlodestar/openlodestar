// src/integrations/source-whitelist/index.ts
/**
 * 来源域名白名单（唯一出口）
 *
 * - entries.ts  数据层：JSON 加载 / 缓存 / verified 过滤
 * - matching.ts 纯函数层：域名 / 名称匹配
 */

export type { WhitelistEntry, WhitelistEntryStatus } from './entries';
export {
  isEffectiveEntry,
  getAllWhitelistEntries,
  getWhitelistEntries,
  whitelistFilePath,
  resetWhitelistCache,
} from './entries';

export {
  isDomainAllowed,
  matchWhitelistEntry,
  sourceNameMatchesDomain,
  resolveSourceDomains,
} from './matching';
