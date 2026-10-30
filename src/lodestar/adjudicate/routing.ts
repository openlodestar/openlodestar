// src/lodestar/adjudicate/routing.ts
/**
 * 路由：断言分类学的职责是路由，不是打分
 *
 * 三档结论——verify（送裁决）/ decompose（拆一层后重入）/ reject（明确拒收）。
 * 判据本体（哪些形态本域裁不了）在策略包，这里只补引擎侧的通用前置检查：
 * 空命题、指代未消解的句子不值得花检索预算，也不进裁决。
 */

import { normalizeText } from '../normalize';
import type { DomainPack } from '../packs/pack';
import type { ClaimRecord, RoutingInfo } from '../types';

/** 引擎侧的拒收理由（域内理由由策略包给，两者不重叠） */
const ENGINE_REJECTS: Array<{ test: (claim: ClaimRecord) => boolean; info: RoutingInfo }> = [
  {
    test: (claim) => normalizeText(claim.object) === '' || normalizeText(claim.atomicText) === '',
    info: { route: 'reject', mode: null, reason: 'empty-proposition' },
  },
  {
    test: (claim) => normalizeText(claim.subject) === '',
    info: { route: 'reject', mode: null, reason: 'unresolvable-reference' },
  },
];

/**
 * 一条断言 → 路由结论。
 *
 * 一个从不说"我做不到"的核查工具不可信：拒收与查无实据都是正式产出，都必须附理由与足迹。
 */
export function routeClaim(claim: ClaimRecord, pack: DomainPack): RoutingInfo {
  for (const reject of ENGINE_REJECTS) {
    if (reject.test(claim)) return reject.info;
  }
  return pack.route({
    atomicText: claim.atomicText,
    subject: claim.subject,
    predicate: claim.predicate,
    object: claim.object,
    fieldKey: claim.fieldKey,
    fieldRole: claim.fieldRole,
  });
}

/** decompose 只重入一层：拆完还判 decompose 的，按"写不出判定规则"拒收 */
export function decomposeDepthAllowed(previous: RoutingInfo | undefined): boolean {
  return previous === undefined;
}
