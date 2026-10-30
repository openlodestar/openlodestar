// src/integrations/source-blacklist/index.ts
/** 来源黑名单机制（唯一出口） */

export type { BlacklistEntry, BlacklistReason } from './entries';
export { getBlacklistEntries, blacklistFilePath, resetBlacklistCache } from './entries';
export { isUrlBlocked, matchBlacklistEntry } from './matching';
export { createSourceBlacklistService, type SourceBlacklistService } from './service';
