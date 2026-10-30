// src/lodestar/record-gate/pool-gaps.ts
/**
 * 记录级页面池的"缺口清单"（纯函数，不调模型）
 *
 * 为什么单独成文件：这份清单直接决定钱花在哪几页，必须能在不联网、不调模型的情况下被钉住。
 *
 * 要解决的问题：共现门禁（cooccurrence.ts）要求**同一页面**同时命中全部关键字段，
 * 而每条断言的检索各自只会捞回自己那批候选页——真正同时写着机构、时间、专场名的页面
 * 常常只在其中一个字段的查询结果里露面。于是出现"每个字段都成立、整条记录凑不齐共现"
 * 的弱坐标。补齐的办法不是再检索再抓取，而是把**同一条记录已经抓回来的页面**
 * 喂给还缺的那个关键字段再比一次（一次比对调用，零检索零抓取）。
 *
 * 取舍：只列"这一页已经命中了本记录其它关键字段"的缺口。一页连一个关键字段都没写，
 * 补比对对它是否支持第三个字段也许有价值，但对"凑齐共现"没有——额度先给能凑齐的那些。
 */

import { findCooccurringUrls } from './cooccurrence';
import type { ClaimRecord, EvidenceRecord, SourceTier } from '../types';

/** 一个待补的缺口：一条关键字段断言 × 一条本记录已抓到的页面 */
export interface PoolGapItem {
  recordId: string;
  claimId: string;
  fieldKey: string;
  /** 该页在本记录里的第一条证据行：域名、档位、快照引用、抓取时刻都从它取 */
  page: EvidenceRecord;
  /** 该页已命中的**其它**关键字段数（越大越该先补） */
  hitKeys: number;
}

export interface PoolGapPlan {
  items: PoolGapItem[];
  /** claimId → 该断言的证据行（调用方接着用它做补比对与重算，不必再聚合一次） */
  evidenceByClaim: Map<string, EvidenceRecord[]>;
}

/** 证据按断言归堆；断言号相同的行按证据号去重（跨轮重复抓同一页只算一条） */
export function groupEvidenceByClaim(rows: EvidenceRecord[]): Map<string, EvidenceRecord[]> {
  const byClaim = new Map<string, Map<string, EvidenceRecord>>();
  for (const row of rows) {
    const bucket = byClaim.get(row.claimId) ?? new Map<string, EvidenceRecord>();
    bucket.set(row.evidenceId, row);
    byClaim.set(row.claimId, bucket);
  }
  return new Map([...byClaim].map(([claimId, byId]) => [claimId, [...byId.values()]]));
}

/**
 * 列出可补的缺口并按"性价比"排序：
 * 1. 该页已命中的其它关键字段数（降序）——2 个命中意味着补中第 3 个就直接出强坐标；
 * 2. 档位（official → primary → aggregator → unlisted）——同分时权威页先补，
 *    因为坐标继承的是关键字段里最低的证据等级，补在高档位页上对等级无损；
 * 3. 断言号、URL 字典序——保证同一底稿每次排出同一个清单（可复现）。
 */
export function planRecordPoolGaps(input: {
  claims: ClaimRecord[];
  evidence: EvidenceRecord[];
  keyFieldKeys: string[];
  recordIds?: string[];
}): PoolGapPlan {
  const evidenceByClaim = groupEvidenceByClaim(input.evidence);
  const keyFields = new Set(input.keyFieldKeys);
  const wanted = input.recordIds && input.recordIds.length > 0 ? new Set(input.recordIds) : null;

  /** recordId → (URL → 该页在本记录里的第一条证据行)：同页多次抓到只留一份快照引用 */
  const poolByRecord = new Map<string, Map<string, EvidenceRecord>>();
  for (const row of input.evidence) {
    if (row.recordId === null) continue;
    const pool = poolByRecord.get(row.recordId) ?? new Map<string, EvidenceRecord>();
    if (!pool.has(row.url)) pool.set(row.url, row);
    poolByRecord.set(row.recordId, pool);
  }

  const items: PoolGapItem[] = [];
  for (const [recordId, pool] of poolByRecord) {
    if (wanted && !wanted.has(recordId)) continue;
    const keyClaims = input.claims.filter(
      (c) =>
        c.recordId === recordId &&
        c.fieldKey !== null &&
        keyFields.has(c.fieldKey) &&
        c.routing?.route !== 'reject',
    );
    // 只有一条关键字段的记录不存在"共现"可言（单字段页面即全集）
    if (keyClaims.length < 2) continue;
    const keyClaimIds = keyClaims.map((c) => c.claimId);
    // 已经有页面命中全部关键字段 → 这条记录能出强坐标，一次比对都不该花
    if (findCooccurringUrls(keyClaimIds, evidenceByClaim).length > 0) continue;

    for (const claim of keyClaims) {
      const rows = evidenceByClaim.get(claim.claimId) ?? [];
      const seen = new Set(rows.map((e) => e.url));
      for (const page of pool.values()) {
        if (seen.has(page.url)) continue;
        const hitKeys = keyClaimIds.filter(
          (id) =>
            id !== claim.claimId &&
            (evidenceByClaim.get(id) ?? []).some((e) => e.url === page.url && e.relation === 'supports'),
        ).length;
        if (hitKeys === 0) continue;
        items.push({
          recordId,
          claimId: claim.claimId,
          fieldKey: String(claim.fieldKey),
          page,
          hitKeys,
        });
      }
    }
  }

  const tierRank: Record<SourceTier, number> = { official: 0, primary: 1, aggregator: 2, unlisted: 3 };
  items.sort(
    (a, b) =>
      b.hitKeys - a.hitKeys ||
      tierRank[a.page.tier] - tierRank[b.page.tier] ||
      a.claimId.localeCompare(b.claimId) ||
      a.page.url.localeCompare(b.page.url),
  );
  return { items, evidenceByClaim };
}
