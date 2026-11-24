// src/lodestar/intake/triage.ts
/**
 * 预筛（triage）：路由之前的轻量关卡（纯函数）
 *
 * 刻意做轻——只做**不需要检索就能判断**的排除，把预算留给真正需要联网的断言。
 * 产出不是"通过／不通过"二分，而是每条一个理由：拒收也要可审计，
 * 否则日后没法复盘"是不是拒错了"。
 *
 * 分工：预筛管"便宜的形式判断"，路由（adjudicate/routing.ts）管"结合领域证据结构的分类"。
 */

import { claimKey, isNearDuplicate, normalizeText } from '../normalize';
import type { ClaimRecord } from '../types';

/** 预筛项与理由码（理由码写进 claims.triage.reason，评测按它分层） */
export type TriageReason =
  | 'specific-and-decidable'
  | 'no-assertion'
  | 'abstained-value'
  | 'unresolvable-reference'
  | 'not-decidable-vague'
  | 'unstable-replay'
  | 'over-record-field-budget'
  | 'duplicate-merged';

export interface TriageInput {
  claim: ClaimRecord;
  /** 复现次数下限（默认值 2）；不足即不送查 */
  minStabilityHits: number;
  /** 记录整体是否稳定复现（具体化追问补出来的字段靠它背书才允许送查） */
  recordStable: boolean;
  /**
   * 这条字段值是不是"定位信息不全但仍值得核"（由策略包判定，如日期只写季节）。
   * 为 true 时，"写不出精确时间"不再整条拒收，改为放行并打标记。
   */
  locatorIncomplete?: boolean;
}

/** 弃权类占位值（"不记得"的产物，不是断言） */
const ABSTENTION_VALUES = /^(?:无|未知|不确定|不记得|记不清|没印象|n\/?a|none|unknown|unknown)$/i;

/**
 * 单条预筛。
 *
 * 顺序有意义：先看有没有内容（弃权留空），再看指代能不能消解，
 * 再看是不是"泛泛而谈"（没有时间也没有专名的句子写不出判定规则），
 * 最后才是稳定性——稳定性不足不改变命题本身是否可判定，所以它排在形式判断之后。
 */
export function triageClaim(input: TriageInput): { passed: boolean; reason: TriageReason; locatorIncomplete?: boolean } {
  const { claim, minStabilityHits, recordStable } = input;
  const objectNorm = normalizeText(claim.object);

  if (objectNorm === '' || normalizeText(claim.atomicText) === '') {
    return { passed: false, reason: 'no-assertion' };
  }
  if (ABSTENTION_VALUES.test(claim.object.trim())) {
    return { passed: false, reason: 'abstained-value' };
  }
  if (normalizeText(claim.subject) === '' || /^[这那某该]/.test(claim.subject.trim())) {
    return { passed: false, reason: 'unresolvable-reference' };
  }
  const hasTime = claim.timeScope.from !== null || /\d{4}/.test(claim.atomicText);
  if (!hasTime && objectNorm.length < 4) {
    // 定位信息不全（如日期只写"秋季"）：放行并打标记，不整条拒收。
    // 依据是路由会把它送核；拒收则让整条记录永远凑不齐关键字段（2026-11-09 的落点表实测）。
    if (input.locatorIncomplete === true) {
      return { passed: true, reason: 'specific-and-decidable', locatorIncomplete: true };
    }
    return { passed: false, reason: 'not-decidable-vague' };
  }
  const stableEnough =
    claim.provenance.stabilityHits >= minStabilityHits ||
    (claim.provenance.promptedDetail && recordStable) ||
    // 外部提交不走复问，稳定性维度不适用（它的把关由预筛与路由负责）
    claim.channel === 'external';
  if (!stableEnough) {
    return { passed: false, reason: 'unstable-replay' };
  }
  return { passed: true, reason: 'specific-and-decidable' };
}

/** 批量预筛：就地写回 triage 结论，返回通过的那部分 */
export function applyTriage(
  claims: ClaimRecord[],
  options: {
    minStabilityHits: number;
    recordStability: Map<string, boolean>;
    /** 由策略包判定"定位信息不全但仍值得核"（缺省不启用，行为与旧版一致） */
    locatorIncompleteOf?: (claim: ClaimRecord) => boolean;
  },
): ClaimRecord[] {
  for (const claim of claims) {
    // 已有"不通过"结论的不再重判（当前唯一来源是超出单记录字段预算）：
    // 那是上游按预算下的定论，覆盖它等于把"没送查"的字段悄悄送进检索。
    if (!claim.triage.passed) {
      claim.state = 'rejected';
      continue;
    }
    const recordStable = claim.recordId ? options.recordStability.get(claim.recordId) ?? false : false;
    const outcome = triageClaim({
      claim,
      minStabilityHits: options.minStabilityHits,
      recordStable,
      locatorIncomplete: options.locatorIncompleteOf?.(claim) ?? false,
    });
    claim.triage = {
      passed: outcome.passed,
      reason: outcome.reason,
      ...(outcome.locatorIncomplete ? { locatorIncomplete: true } : {}),
    };
    if (!outcome.passed) claim.state = 'rejected';
  }
  return claims.filter((c) => c.triage.passed);
}

/**
 * 跨渠道去重：归一化后高度重合的断言合并，**保留最早来源并累加稳定次数**。
 *
 * 只在同一记录内（或都无记录容器时）合并——两场不同事件里出现的相似句子
 * 是两条不同断言，合并它们等于把组合式幻觉抹平。
 */
export function mergeDuplicateClaims(claims: ClaimRecord[]): { kept: ClaimRecord[]; mergedCount: number } {
  const kept: ClaimRecord[] = [];
  let mergedCount = 0;

  for (const claim of claims) {
    const target = kept.find(
      (candidate) =>
        candidate.recordId === claim.recordId &&
        isSameClaim(candidate, claim),
    );
    if (target) {
      target.provenance = {
        ...target.provenance,
        stabilityHits: target.provenance.stabilityHits + claim.provenance.stabilityHits,
      };
      mergedCount += 1;
      continue;
    }
    kept.push(claim);
  }
  return { kept, mergedCount };
}

function isSameClaim(a: ClaimRecord, b: ClaimRecord): boolean {
  const partsOf = (c: ClaimRecord) => ({
    subject: c.subject,
    predicate: c.predicate,
    object: c.object,
    timeFrom: c.timeScope.from,
    timeTo: c.timeScope.to,
  });
  if (claimKey(partsOf(a)) === claimKey(partsOf(b))) return true;
  return (
    a.subject === b.subject &&
    a.predicate === b.predicate &&
    isNearDuplicate(normalizeText(a.object), normalizeText(b.object))
  );
}
