// src/integrations/source-blacklist/service.ts
/**
 * 来源黑名单 — 服务层（role 命名 API，消融语义内聚于此）
 *
 * 消费方对消融零感知：`source-blacklist` 被消融时限制性判定全部放行、
 * 数据消费返回"无数据"值，系统行为等价于黑名单从未存在过。
 */

import { type AblationState } from '../../ablation';
import { type BlacklistEntry, getBlacklistEntries } from './entries';
import { matchBlacklistEntry, isUrlBlocked } from './matching';

/** 来源黑名单服务 */
export interface SourceBlacklistService {
  isUrlBlocked(url: string): boolean;
  matchUrl(url: string): BlacklistEntry | null;
  getEntries(): BlacklistEntry[];
}

/** 创建来源黑名单服务 */
export function createSourceBlacklistService(ablations: AblationState): SourceBlacklistService {
  const ablated = ablations.isOff('source-blacklist');
  return {
    isUrlBlocked: (url) => !ablated && isUrlBlocked(url),
    matchUrl: (url) => (ablated ? null : matchBlacklistEntry(url)),
    getEntries: () => (ablated ? [] : getBlacklistEntries()),
  };
}
