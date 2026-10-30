// src/lodestar/record-gate/cooccurrence.ts
/**
 * 记录级共现门禁（纯函数）
 *
 * 为什么必须有一道记录级门禁：枚举式提问产出的是记录，字段层全真 ≠ 这场事件存在——
 * "嘉德办过瓷器专场"真 + "2021 年嘉德办过秋拍"真，合起来的"2021 年嘉德'中国古风'瓷器专场"
 * 可能根本不存在（组合式幻觉）。按字段入库就会给出一个带"已核验"名头的假坐标，比没有更误导。
 *
 * 判据是共现：**同一页面**同时命中全部关键字段且各自带逐字引文。
 * 这一道闸近乎免费——不新增任何检索或抓取，只对既有证据行按 `url` 聚合一次。
 */

import type { ClaimRecord, EvidenceRecord, RecordSummary, VerdictRecord } from '../types';

/** 门禁输入：一条记录的字段断言 + 各自的证据与裁决 */
export interface GateInput {
  recordId: string;
  queryId: string | null;
  /** 该记录的全部字段断言号 */
  fieldClaimIds: string[];
  /** 参与门禁判定的关键字段断言号（由策略包的字段角色决定） */
  keyClaimIds: string[];
  claims: Map<string, ClaimRecord>;
  verdicts: Map<string, VerdictRecord>;
  /** claimId → 该断言的证据行 */
  evidenceByClaim: Map<string, EvidenceRecord[]>;
  /** 记录级时间戳（坐标会过期，asOf 必填） */
  asOf: string;
}

export interface GateOutcome {
  summary: RecordSummary;
  /** 参与共现判定的关键字段里，最低的证据等级（坐标继承它） */
  weakestKeyGrade: VerdictRecord['evidenceGrade'] | null;
  /** 共现命中的页面（强坐标的 sourceUrls 就是它们；这些是证据页，不保证是抓取入口） */
  cooccurringUrls: string[];
}

/** 证据等级可比较的序（E0 最低） */
const GRADE_ORDER: Record<VerdictRecord['evidenceGrade'], number> = { E0: 0, E1: 1, E2: 2, E3: 3 };

/** 取两个等级里更低的那个 */
export function minGrade(
  a: VerdictRecord['evidenceGrade'],
  b: VerdictRecord['evidenceGrade'],
): VerdictRecord['evidenceGrade'] {
  return GRADE_ORDER[a] <= GRADE_ORDER[b] ? a : b;
}

/**
 * 共现命中的页面：对每个关键字段都存在一条 `supports` 且带引文的证据行，且这些行指向同一个 URL。
 *
 * `irrelevant` 与 `refutes` 都不算命中；引文为空的行（写入侧已拦，这里是双保险）也不算。
 */
export function findCooccurringUrls(
  keyClaimIds: string[],
  evidenceByClaim: Map<string, EvidenceRecord[]>,
): string[] {
  if (keyClaimIds.length === 0) return [];
  const perClaim = keyClaimIds.map((claimId) => {
    const rows = evidenceByClaim.get(claimId) ?? [];
    return new Set(
      rows
        .filter((e) => e.relation === 'supports' && e.quote.trim() !== '')
        .map((e) => normalizeUrlForKey(e.url)),
    );
  });
  const [first, ...rest] = perClaim;
  if (!first) return [];
  const shared = [...first].filter((url) => rest.every((set) => set.has(url)));
  return shared.sort();
}

/** 共现比对时的 URL 规范化：去尾斜杠与 hash，大小写不敏感（同一页的两种写法要能碰上） */
function normalizeUrlForKey(url: string): string {
  const withoutHash = url.split('#')[0] ?? '';
  return withoutHash.replace(/\/+$/, '').toLowerCase();
}

/**
 * 记录级门禁三档（四分类仍只在字段层，这里不新增第五种裁决）：
 *
 * - strong：关键字段全 supported + 存在共现命中页面 + 证据等级 ≥E2；
 * - weak：关键字段全 supported，但没有任何页面共现命中（或等级只到 E1）——标注后仍入库，默认不读；
 * - rejected：任一关键字段 refuted / conflicting / not_found——不入库，裁决与足迹照常留档。
 */
export function decideGate(input: GateInput): GateOutcome {
  const keyVerdicts = input.keyClaimIds
    .map((id) => input.verdicts.get(id))
    .filter((v): v is VerdictRecord => v !== undefined);

  const adjudicatedCount = input.keyClaimIds.filter((id) => input.verdicts.has(id)).length;
  const allKeyClaimsAdjudicated = adjudicatedCount === input.keyClaimIds.length;

  const blocked = keyVerdicts.find((v) => v.verdict !== 'supported');
  const urls = findCooccurringUrls(input.keyClaimIds, input.evidenceByClaim);
  const weakest = keyVerdicts.length > 0
    ? keyVerdicts.reduce((acc, v) => minGrade(acc, v.evidenceGrade), 'E3' as VerdictRecord['evidenceGrade'])
    : null;

  let gate: RecordSummary['gate'];
  let reason: string;

  if (!allKeyClaimsAdjudicated) {
    gate = 'rejected';
    reason = `关键字段未全部裁决完（${adjudicatedCount}/${input.keyClaimIds.length}），记录状态不能凭空补齐`;
  } else if (blocked) {
    gate = 'rejected';
    reason = `关键字段 ${blocked.claimId} 判为 ${blocked.verdict}${blocked.notFoundCause ? `（成因 ${blocked.notFoundCause}）` : ''}，整条记录不入坐标库`;
  } else if (urls.length === 0) {
    gate = 'weak';
    reason = '关键字段各自成立，但没有任何页面同时命中全部关键字段——按弱坐标留档，默认不读';
  } else if (weakest === 'E1' || weakest === 'E0') {
    gate = 'weak';
    reason = `有共现命中页面，但最低证据等级只到 ${weakest}（单一独立来源）——不给强坐标`;
  } else {
    gate = 'strong';
    reason = `关键字段全部 supported、共现命中 ${urls.length} 个页面、最低证据等级 ${weakest}`;
  }

  const cooccurringEvidenceIds = collectEvidenceIdsAtUrls(input.keyClaimIds, input.evidenceByClaim, urls);

  return {
    summary: {
      recordId: input.recordId,
      queryId: input.queryId,
      fieldClaimIds: input.fieldClaimIds,
      keyClaimIds: input.keyClaimIds,
      gate,
      cooccurringEvidenceIds,
      reason,
      asOf: input.asOf,
    },
    weakestKeyGrade: weakest,
    cooccurringUrls: urls,
  };
}

function collectEvidenceIdsAtUrls(
  keyClaimIds: string[],
  evidenceByClaim: Map<string, EvidenceRecord[]>,
  urls: string[],
): string[] {
  const targets = new Set(urls);
  const ids: string[] = [];
  for (const claimId of keyClaimIds) {
    for (const row of evidenceByClaim.get(claimId) ?? []) {
      if (row.relation === 'supports' && targets.has(normalizeUrlForKey(row.url))) ids.push(row.evidenceId);
    }
  }
  return ids.sort();
}
