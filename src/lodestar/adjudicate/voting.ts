// src/lodestar/adjudicate/voting.ts
/**
 * 来源独立性与加权计票（纯函数）
 *
 * 这一段是整个审计的可信度承重墙，规则逐条如下：
 * - **异域**：同一来源家族（含跨语言站与镜像）多页只算一个来源；
 * - **非转载**：同家族内保留权威最高的一条计票，其余只作"佐证存在"记录；
 * - **聚合站降权**：aggregator 档权重最低，且**不得单独作为矛盾判定的依据**；
 * - **promptedDetail 降权**：追问诱导补出来的断言，其支持分打折；
 * - **四分类真值条件**与停止条件；not_found 的三因区分。
 *
 * 档位→权重的映射是通用的（official > primary > aggregator）；
 * **哪个域名属于哪档**才是域知识，由策略包的 tierOf 决定，不在本文件。
 */

import type { EvidenceGrade, EvidenceRecord, NotFoundCause, SourceTier, Verdict } from '../types';

/** 权威档位权重（档位由策略包判定，权重阶梯全域通用） */
export const TIER_WEIGHT: Record<SourceTier, number> = {
  official: 1,
  primary: 0.7,
  aggregator: 0.4,
  unlisted: 0.3,
};

/** 追问诱导断言的支持分折扣 */
export const PROMPTED_DETAIL_DISCOUNT = 0.8;

/**
 * 支持分阈值：**只要有一条达标的支持性证据就够下 supported**，独立性由证据等级表达。
 *
 * 取 0.3 而不是 1.0 的理由：默认值表写的是"独立来源少于 2 时只到 E1、不给强坐标"——
 * 言下之意单一来源的直接陈述该判 supported＋E1，而不是判成"查无实据"。
 * 阈值定在 1.0 会让单一 primary 官方报道（0.7）整条落进 not_found，等于把
 * "我们查到了但只有一家说"错报成"我们什么都没查到"，那是两种完全不同的结论。
 * 0.3 仍然挡得住"来路不明的间接推断"（0.3 × 0.6 = 0.18）单独成判。
 */
export const SUPPORT_SCORE_THRESHOLD = 0.3;

/** 可计票的证据（非本管线自抓、无引文的行在这里就被剔除） */
export function isCountable(evidence: EvidenceRecord): boolean {
  return (
    evidence.fetchedBy === 'lodestar' &&
    evidence.quote.trim() !== '' &&
    (evidence.relation === 'supports' || evidence.relation === 'refutes')
  );
}

/**
 * 归并到独立来源：每个来源家族留一条。
 * 选择顺序：权威档位高 → 引文直接程度高 → URL 字典序（保证确定性，同输入必同输出）。
 */
export function independentSources(evidence: EvidenceRecord[]): {
  counted: EvidenceRecord[];
  corroborating: EvidenceRecord[];
} {
  const byFamily = new Map<string, EvidenceRecord[]>();
  for (const item of evidence) {
    if (!isCountable(item)) continue;
    const family = item.sourceFamily.trim() === '' ? item.domain : item.sourceFamily;
    const bucket = byFamily.get(family);
    if (bucket) bucket.push(item);
    else byFamily.set(family, [item]);
  }

  const counted: EvidenceRecord[] = [];
  const corroborating: EvidenceRecord[] = [];
  const rank = (e: EvidenceRecord): number => tierRank(e.tier) * 10 + (e.contentWeight >= 1 ? 5 : 0);

  for (const [, group] of [...byFamily.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const sorted = [...group].sort(
      (a, b) => rank(b) - rank(a) || a.url.localeCompare(b.url),
    );
    counted.push(sorted[0]!);
    corroborating.push(...sorted.slice(1));
  }
  return { counted, corroborating };
}

function tierRank(tier: SourceTier): number {
  return tier === 'official' ? 3 : tier === 'primary' ? 2 : tier === 'aggregator' ? 1 : 0;
}

export interface TallyInput {
  /** 该断言的全部证据行（含 irrelevant——它进检索足迹，不进计票） */
  evidence: EvidenceRecord[];
  /** 该断言的具体要素是否来自追问诱导 */
  promptedDetail: boolean;
  /** 预算与覆盖观测（not_found 三因判定用） */
  budget: { searchCalls: number; pagesFetched: number; searchCap: number; pageCap: number };
  /** 候选来源总数与已查看数（覆盖是否穷尽） */
  coverage: { candidateCount: number; examinedCount: number };
}

export interface TallyResult {
  verdict: Verdict;
  evidenceGrade: EvidenceGrade;
  /** 独立来源数（按家族去重后） */
  supportCount: number;
  refuteCount: number;
  notFoundCause?: NotFoundCause;
  scores: { support: number; refute: number };
  /** 参与计票的证据行 id（审计页要能指出"这条结论数了哪几票"） */
  countedEvidenceIds: string[];
  /** 同家族被并掉的佐证行 id */
  corroboratingEvidenceIds: string[];
  reason: string;
}

/**
 * 计票并下四分类结论。
 *
 * 判定次序（顺序本身有意义——先判能不能证伪，再判能不能证实）：
 * 1. 有**权威档**（official/primary）明确反对，且支持侧未同时达标 → refuted；
 * 2. 权威档反对 + 支持侧同时达标（≥2 独立来源）→ conflicting；
 * 3. 支持分达阈值 → supported（等级按独立来源数与是否含官方源分档）；
 * 4. 其余一律 not_found，并说清是哪一种"没查到"。
 *
 * 第 4 类里含一种容易误读的情形：只有聚合站/来路不明站在反对，一条权威档支持也没有。
 * 这时把它记成 refuted 会违反"聚合站不得单独作为矛盾依据"，
 * 记成 supported 又与证据相反——所以记 not_found 且成因写 `coverage`：
 * 这是我们没有覆盖到能裁的站点，而不是世界否定了这条断言（未找到成因的分类正是看这个数）。
 */
export function tally(input: TallyInput): TallyResult {
  const { counted, corroborating } = independentSources(input.evidence);
  const supports = counted.filter((e) => e.relation === 'supports');
  const refutes = counted.filter((e) => e.relation === 'refutes');
  const authoritativeRefutes = refutes.filter((e) => e.tier === 'official' || e.tier === 'primary');

  const supportScore = supports.reduce(
    (sum, e) =>
      sum +
      TIER_WEIGHT[e.tier] *
        e.contentWeight *
        (input.promptedDetail ? PROMPTED_DETAIL_DISCOUNT : 1),
    0,
  );
  const refuteScore = refutes.reduce((sum, e) => sum + TIER_WEIGHT[e.tier] * e.contentWeight, 0);

  const supportMet = supportScore >= SUPPORT_SCORE_THRESHOLD && supports.length >= 1;
  const grade = gradeFor(supports);

  const base = {
    supportCount: supports.length,
    refuteCount: refutes.length,
    scores: { support: round2(supportScore), refute: round2(refuteScore) },
    countedEvidenceIds: counted.map((e) => e.evidenceId),
    corroboratingEvidenceIds: corroborating.map((e) => e.evidenceId),
  };

  if (authoritativeRefutes.length > 0 && !supportMet) {
    return {
      ...base,
      verdict: 'refuted',
      evidenceGrade: gradeForRefute(authoritativeRefutes),
      reason: '权威来源明确反对（聚合站与转载未参与此判定）',
    };
  }
  if (authoritativeRefutes.length > 0 && supportMet) {
    return {
      ...base,
      verdict: 'conflicting',
      evidenceGrade: grade,
      reason: '支持与反对两侧都达到权威门槛',
    };
  }
  if (supportMet) {
    return {
      ...base,
      verdict: 'supported',
      evidenceGrade: grade,
      reason:
        supports.length >= 2
          ? '至少两个独立来源一致'
          : '仅单一独立来源支持——按 E1 出档，不给强坐标',
    };
  }

  // 走到这里说明没有权威档反对（上面已单独成判），此处的反对数即"低档位反对数"
  const cause = notFoundCause(input, refutes.length);
  return {
    ...base,
    verdict: 'not_found',
    evidenceGrade: 'E0',
    notFoundCause: cause,
    reason: notFoundReason(cause, refutes.length),
  };
}

/** not_found 三因：预算耗尽 / 覆盖缺口 / 确证无记录 */
function notFoundCause(input: TallyInput, weakRefutes: number): NotFoundCause {
  const budgetTouched =
    input.budget.searchCalls >= input.budget.searchCap ||
    input.budget.pagesFetched >= input.budget.pageCap;
  const notFullyCovered = input.coverage.examinedCount < input.coverage.candidateCount;
  if (budgetTouched && notFullyCovered) return 'budget';
  // 只有低档位来源在说话 = 能裁的站点没进候选
  if (weakRefutes > 0 || input.coverage.candidateCount === 0) return 'coverage';
  return 'genuinely_absent';
}

function notFoundReason(cause: NotFoundCause, weakRefutes: number): string {
  switch (cause) {
    case 'budget':
      return '预算耗尽前未查完候选（可修复的 not_found，分批重跑即可）';
    case 'coverage':
      return weakRefutes > 0
        ? '只有聚合站或来路不明的来源在反对，能裁定的权威档站点不在候选里（该扩站点包）'
        : '候选来源里没有能承载这条断言证据的站点（该扩站点包）';
    case 'genuinely_absent':
      return '候选已覆盖完、检索已跑满预算，各来源均不涉及该断言';
  }
}

/** 支持侧的证据等级 */
function gradeFor(supports: EvidenceRecord[]): EvidenceGrade {
  if (supports.length === 0) return 'E0';
  if (supports.length === 1) return 'E1';
  const hasOfficial = supports.some((e) => e.tier === 'official');
  return hasOfficial ? 'E3' : 'E2';
}

/** 反对侧的证据等级（口径与支持侧一致，数的是反对的独立来源） */
function gradeForRefute(refutes: EvidenceRecord[]): EvidenceGrade {
  if (refutes.length === 0) return 'E0';
  if (refutes.length === 1) return 'E1';
  const hasOfficial = refutes.some((e) => e.tier === 'official');
  return hasOfficial ? 'E3' : 'E2';
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * 停止条件：什么时候可以不再抓下一页就下判。
 *
 * 前三种裁决"够证据就停"，只有 not_found 要跑满预算或覆盖完候选——
 * 不写清这一点，成本会失控且不同断言之间的预算不可比。
 */
export function isDecisive(
  evidence: EvidenceRecord[],
  promptedDetail: boolean,
  budget: TallyInput['budget'],
  coverage: TallyInput['coverage'],
): boolean {
  const tallyResult = tally({ evidence, promptedDetail, budget, coverage });
  switch (tallyResult.verdict) {
    case 'refuted':
      return true;
    case 'conflicting':
      return true;
    case 'supported':
      // 支持要 ≥2 独立来源才算稳（单一来源随时可能被下一条证据翻成 conflicting）
      return tallyResult.supportCount >= 2;
    default:
      return false;
  }
}

/**
 * 跨轮累计重算一条断言的裁决。
 *
 * 底稿是只追加的：同一条断言在不同轮次里各自抓过、各自比过，证据行都留在 `evidence.jsonl`。
 * 只看本轮证据会把上一轮已经拿到的独立来源丢掉——那不只是浪费钱，还会把
 * "两家来源一致"这一轮判成"预算耗尽"，结论本身就是错的。
 *
 * @param previous 该断言在底稿里的历史裁决（用于继承检索足迹：足迹按轮次各自记）
 */
export function retally(
  claimId: string,
  allEvidence: EvidenceRecord[],
  options: {
    promptedDetail: boolean;
    /** 本轮的预算与覆盖观测；跨轮重算时沿用历史裁决里的足迹 */
    budget: TallyInput['budget'];
    coverage: TallyInput['coverage'];
  },
): TallyResult {
  const rows = allEvidence.filter((e) => e.claimId === claimId);
  return tally({ evidence: rows, ...options });
}
