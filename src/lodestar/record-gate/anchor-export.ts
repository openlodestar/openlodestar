// src/lodestar/record-gate/anchor-export.ts
/**
 * 坐标派生与只读导出（给下游的唯一接口）
 *
 * 三条纪律落在这一层：
 * 1. `traceId` 必填——没有底稿的坐标不落盘（存储适配器同处再拦一次）；
 * 2. **强坐标的 `sourceUrls` 是共现命中的那几个证据页**，不是抓取入口；入口由下游按再入凭证解析；
 * 3. 坐标不回写宿主库：本模块只写 `anchors.jsonl`，一个宿主表都不碰。
 */

import type { DomainPack } from '../packs/pack';
import type { ParsedRecord } from '../packs/pack';
import type { AlignedRecord } from '../intake/record-container';
import { recordFieldsSnapshot } from '../intake/record-container';
import { buildSearchPhrases } from '../search-phrases';
import type { AnchorRecord, EvidenceRecord, RecordSummary, VerdictRecord } from '../types';

/** 坐标派生输入 */
export interface DeriveAnchorInput {
  record: AlignedRecord;
  summary: RecordSummary;
  /** 共现命中的页面（strong 档的 sourceUrls；弱档传支撑页并集） */
  cooccurringUrls: string[];
  /** 关键字段里最低的证据等级 */
  weakestKeyGrade: VerdictRecord['evidenceGrade'] | null;
  /** 产出这批记录的那条枚举式提问原文 */
  query: string;
  pack: DomainPack;
  /** 底稿引用：trace 文件里的这一次裁决 */
  traceId: string;
  /** 参与坐标的断言号（footprintRef 指向它们） */
  keyClaimIds: string[];
}

/**
 * 一条记录 → 一行坐标。
 *
 * 返回 null 的情形：门禁判 rejected，或没有任何共现证据页。
 * 后者必须是 null 而不是空 sourceUrls——坐标的承重面是"事实有同页证据"，
 * 少了它就只是一个断言；但它不是抓取入口，入口由下游按 searchPhrases 等再入凭证解析。
 */
export function deriveAnchor(input: DeriveAnchorInput): AnchorRecord | null {
  if (input.summary.gate === 'rejected') return null;
  const sourceUrls = dedupe(input.cooccurringUrls);
  if (sourceUrls.length === 0) return null;

  const fields = recordFieldsSnapshot(input.record);
  const parsed: ParsedRecord = { recordId: input.record.recordId, fields, rawText: input.record.rawTexts[0] ?? '' };

  return {
    recordId: input.record.recordId,
    query: input.query,
    fields,
    // 检索键：身份的再入凭证（基本项，出坐标时同步产出，无网络产物）
    searchPhrases: buildSearchPhrases(fields, input.pack),
    anchorGrade: input.summary.gate === 'strong' ? 'strong' : 'weak',
    evidenceGrade: input.weakestKeyGrade ?? 'E0',
    sourceUrls,
    categoryTags: input.pack.categoryTagsOf(parsed),
    footprintRef: `verdicts:${[...input.keyClaimIds].sort().join(',')}`,
    traceId: input.traceId,
    asOf: input.summary.asOf,
    stale: false,
  };
}

/**
 * 弱档的支撑页并集：关键字段各自证据页的并集（按域名与 URL 排序，确定性输出），写进 `sourceUrls`。
 * 强档不用它——强档要的恰恰是"同一个页面"，并集会掩盖共现与否的区别。
 */
export function supportingUrlsUnion(
  keyClaimIds: string[],
  evidenceByClaim: Map<string, EvidenceRecord[]>,
): string[] {
  const urls: string[] = [];
  for (const claimId of keyClaimIds) {
    for (const row of evidenceByClaim.get(claimId) ?? []) {
      if (row.relation === 'supports' && row.quote.trim() !== '') urls.push(row.url);
    }
  }
  return dedupe(urls);
}

function dedupe(urls: string[]): string[] {
  return [...new Set(urls)].sort();
}
