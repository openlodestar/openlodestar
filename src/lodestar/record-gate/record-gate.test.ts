// src/lodestar/record-gate/record-gate.test.ts
/**
 * 记录级门禁测试（离线）
 *
 * 核心是那条负例：**字段全真、组合不存在**——
 * 三个关键字段各自都被独立来源证实，但没有任何一个页面同时说到三件事，
 * 这条记录只能落到弱档，绝不能进强坐标（否则下游拿到的是一个带"已核验"名头的假入口）。
 */

import { describe, it, expect } from 'vitest';
import porcelainPack from '../packs/porcelain';
import { PORCELAIN_KEY_FIELDS } from '../packs/porcelain';
import { decideGate, findCooccurringUrls, minGrade } from './cooccurrence';
import { deriveAnchor, supportingUrlsUnion } from './anchor-export';
import { isReadableAnchor } from '../anchor-source';
import { alignRuns, pickPrimaryVariants } from '../intake/record-container';
import { atomizeFieldToClaim } from '../intake/atomize';
import type { AlignedRecord, MappedRow } from '../intake/record-container';
import type { ClaimRecord, EvidenceRecord, VerdictRecord } from '../types';

const KEY_FIELD_KEYS = PORCELAIN_KEY_FIELDS;

/** 造一条稳定复现三次的记录 + 每字段一条断言 */
function buildRecord(): { record: AlignedRecord; claims: ClaimRecord[] } {
  const row: MappedRow[] = [
    { auctionHouse: '中国嘉德', dateText: '2014年5月', sessionName: '瓷器工艺品专场', location: '北京' },
  ];
  const record = alignRuns([row, row, row], porcelainPack)[0]!;
  const specByKey = new Map(porcelainPack.fields().map((f) => [f.key, f]));
  const claims = pickPrimaryVariants(record).map((variant) =>
    atomizeFieldToClaim({
      queryId: 'q-20261004-test',
      record,
      variant,
      spec: specByKey.get(variant.fieldKey)!,
      pack: porcelainPack,
      channel: 'enumerative',
      selectionReason: 'coverage-gap',
      stabilityRuns: 3,
    }),
  );
  return { record, claims };
}

function verdict(claimId: string, over: Partial<VerdictRecord> = {}): VerdictRecord {
  return {
    claimId,
    verdict: 'supported',
    evidenceGrade: 'E2',
    supportCount: 2,
    refuteCount: 0,
    footprint: {
      queries: ['中国嘉德 2014年5月 瓷器工艺品专场'],
      candidates: [],
      fetched: [],
      failed: [],
      rejected: [],
      budget: { searchCalls: 4, pagesFetched: 6, searchCap: 4, pageCap: 6 },
      candidatesCovered: true,
    },
    traceId: 'trace-test',
    adjudicatedAt: '2026-10-04T10:00:00+08:00',
    ...over,
  };
}

function ev(claimId: string, url: string, over: Partial<EvidenceRecord> = {}): EvidenceRecord {
  const domain = new URL(url).hostname;
  return {
    evidenceId: `ev-${claimId}-${url}`,
    claimId,
    url,
    domain,
    sourceFamily: porcelainPack.sourceFamilyOf(domain),
    tier: porcelainPack.tierOf(domain),
    quote: '2014春季拍卖会瓷器工艺品专场',
    relation: 'supports',
    contentWeight: 1,
    fetchedBy: 'lodestar',
    fetchedAt: '2026-10-04T10:00:00+08:00',
    snapshotRef: 'snapshots/x.html',
    traceId: 'trace-test',
    fieldKey: null,
    recordId: null,
    ...over,
  };
}

function gateFor(claims: ClaimRecord[], evidence: EvidenceRecord[], verdicts: VerdictRecord[]) {
  const keyClaims = claims.filter((c) => KEY_FIELD_KEYS.includes(c.fieldKey ?? ''));
  const byClaim = new Map<string, EvidenceRecord[]>();
  for (const row of evidence) {
    const bucket = byClaim.get(row.claimId);
    if (bucket) bucket.push(row);
    else byClaim.set(row.claimId, [row]);
  }
  return decideGate({
    recordId: claims[0]!.recordId!,
    queryId: claims[0]!.queryId,
    fieldClaimIds: claims.map((c) => c.claimId),
    keyClaimIds: keyClaims.map((c) => c.claimId),
    claims: new Map(claims.map((c) => [c.claimId, c])),
    verdicts: new Map(verdicts.map((v) => [v.claimId, v])),
    evidenceByClaim: byClaim,
    asOf: '2026-10-04T10:00:00+08:00',
  });
}

describe('共现命中判定', () => {
  it('同一页面对全部关键字段都返回 supports 且各带引文 = 命中（两个页面都全中就都算）', () => {
    const { claims } = buildRecord();
    const keyIds = claims.filter((c) => KEY_FIELD_KEYS.includes(c.fieldKey ?? '')).map((c) => c.claimId);
    const shared = 'https://www.cguardian.com/auction/2014-spring-ceramics';
    const other = 'https://www.christies.com/other';
    const urls = findCooccurringUrls(
      keyIds,
      new Map(keyIds.map((id) => [id, [ev(id, shared), ev(id, other)]])),
    );
    expect(urls).toEqual([shared, other]);   // 字典序，确定性输出

    // 只有一页全中时，另一页不算命中——这就是"字段全真但组合不存在"被挡在强档外的机制
    const partial = findCooccurringUrls(keyIds, new Map([
      [keyIds[0]!, [ev(keyIds[0]!, shared), ev(keyIds[0]!, other)]],
      [keyIds[1]!, [ev(keyIds[1]!, shared)]],
      [keyIds[2]!, [ev(keyIds[2]!, shared)]],
    ]));
    expect(partial).toEqual([shared]);
  });

  it('机构年表页只写机构与年份、不含专场主题 → 三个字段凑不到同一页（域内细则的正解）', () => {
    const { claims } = buildRecord();
    const keyIds = claims.filter((c) => KEY_FIELD_KEYS.includes(c.fieldKey ?? '')).map((c) => c.claimId);
    const urls = findCooccurringUrls(keyIds, new Map([
      [keyIds[0]!, [ev(keyIds[0]!, 'https://www.cguardian.com/history')]],
      [keyIds[1]!, [ev(keyIds[1]!, 'https://www.cguardian.com/history')]],
      // 第三个关键字段只有另一家站点提到，页面里没有前两项
      [keyIds[2]!, [ev(keyIds[2]!, 'https://www.polypm.com.cn/other-session')]],
    ]));
    expect(urls).toEqual([]);
  });

  it('引文为空或判 irrelevant 的行不算命中', () => {
    const { claims } = buildRecord();
    const keyIds = claims.filter((c) => KEY_FIELD_KEYS.includes(c.fieldKey ?? '')).map((c) => c.claimId);
    const page = 'https://www.cguardian.com/x';
    const urls = findCooccurringUrls(keyIds, new Map([
      [keyIds[0]!, [ev(keyIds[0]!, page)]],
      [keyIds[1]!, [ev(keyIds[1]!, page, { quote: '' })]],
      [keyIds[2]!, [ev(keyIds[2]!, page, { relation: 'irrelevant' })]],
    ]));
    expect(urls).toEqual([]);
  });
});

describe('记录级门禁三档（负例：字段全真、组合不存在）', () => {
  it('三个关键字段各自 supported、但无共现页面 → 弱坐标', () => {
    const { claims } = buildRecord();
    const keyIds = claims.filter((c) => KEY_FIELD_KEYS.includes(c.fieldKey ?? '')).map((c) => c.claimId);
    const evidence = keyIds.flatMap((id, index) => [
      ev(id, `https://www.cguardian.com/page-${index}`),
      ev(id, `https://www.polypm.com.cn/page-${index}`),
    ]);
    const verdicts = keyIds.map((id) => verdict(id));
    const outcome = gateFor(claims, evidence, verdicts);
    expect(outcome.summary.gate).toBe('weak');
    expect(outcome.summary.reason).toContain('没有任何页面同时命中');
    expect(outcome.cooccurringUrls).toEqual([]);
  });

  it('关键字段全 supported + 共现命中 + 等级 ≥E2 → 强坐标', () => {
    const { claims } = buildRecord();
    const keyIds = claims.filter((c) => KEY_FIELD_KEYS.includes(c.fieldKey ?? '')).map((c) => c.claimId);
    const shared = 'https://www.cguardian.com/auction/2014-spring-ceramics';
    const evidence = keyIds.flatMap((id) => [ev(id, shared), ev(id, `https://www.polypm.com.cn/${id}`)]);
    const outcome = gateFor(claims, evidence, keyIds.map((id) => verdict(id)));
    expect(outcome.summary.gate).toBe('strong');
    expect(outcome.summary.cooccurringEvidenceIds).toHaveLength(3);
    expect(outcome.cooccurringUrls).toEqual([shared.toLowerCase()]);
  });

  it('有共现命中但最低等级只到 E1 → 仍不给强坐标（默认值：支持至少要两个独立来源）', () => {
    const { claims } = buildRecord();
    const keyIds = claims.filter((c) => KEY_FIELD_KEYS.includes(c.fieldKey ?? '')).map((c) => c.claimId);
    const shared = 'https://www.cguardian.com/only-one-source';
    const evidence = keyIds.map((id) => ev(id, shared));
    const outcome = gateFor(claims, evidence, keyIds.map((id) => verdict(id, { evidenceGrade: 'E1', supportCount: 1 })));
    expect(outcome.summary.gate).toBe('weak');
    expect(outcome.summary.reason).toContain('不给强坐标');
  });

  it('任一关键字段被权威来源否定 → 整条记录丢弃并留痕（拒收也要可审计）', () => {
    const { claims } = buildRecord();
    const keyIds = claims.filter((c) => KEY_FIELD_KEYS.includes(c.fieldKey ?? '')).map((c) => c.claimId);
    const shared = 'https://www.cguardian.com/session';
    const evidence = keyIds.map((id) => ev(id, shared));
    const verdicts = keyIds.map((id, i) =>
      i === 0 ? verdict(id, { verdict: 'refuted', evidenceGrade: 'E1', supportCount: 0, refuteCount: 1 }) : verdict(id),
    );
    const outcome = gateFor(claims, evidence, verdicts);
    expect(outcome.summary.gate).toBe('rejected');
    expect(outcome.summary.reason).toContain('refuted');
    expect(outcome.summary.reason).toContain('不入坐标库');
  });

  it('关键字段没裁完时不得凭空补出记录状态', () => {
    const { claims } = buildRecord();
    const keyIds = claims.filter((c) => KEY_FIELD_KEYS.includes(c.fieldKey ?? '')).map((c) => c.claimId);
    const outcome = gateFor(claims, [], keyIds.slice(0, 1).map((id) => verdict(id)));
    expect(outcome.summary.gate).toBe('rejected');
    expect(outcome.summary.reason).toContain('未全部裁决完');
  });

  it('证据等级取更低的一档（坐标继承最弱一环，不是最强一环）', () => {
    expect(minGrade('E3', 'E2')).toBe('E2');
    expect(minGrade('E1', 'E2')).toBe('E1');
  });
});

describe('坐标导出', () => {
  it('强坐标带证据页地址、档位、核验时点与底稿引用；字段捆在同一记录里', () => {
    const { record, claims } = buildRecord();
    const keyIds = claims.filter((c) => KEY_FIELD_KEYS.includes(c.fieldKey ?? '')).map((c) => c.claimId);
    const shared = 'https://www.cguardian.com/auction/2014-spring-ceramics';
    const outcome = gateFor(claims, keyIds.map((id) => ev(id, shared)), keyIds.map((id) => verdict(id)));
    const anchor = deriveAnchor({
      record,
      summary: outcome.summary,
      cooccurringUrls: outcome.cooccurringUrls,
      weakestKeyGrade: outcome.weakestKeyGrade,
      query: '列出近五年含民间瓷器的拍卖会（时间、地点、拍卖行）',
      pack: porcelainPack,
      traceId: 'trace-test',
      keyClaimIds: keyIds,
    });
    expect(anchor).not.toBeNull();
    expect(anchor!.anchorGrade).toBe('strong');
    expect(anchor!.sourceUrls).toEqual([shared.toLowerCase()]);
    expect(anchor!.fields.auctionHouse).toBe('中国嘉德');
    expect(anchor!.categoryTags).toContain('瓷器');
    expect(anchor!.traceId).toBe('trace-test');
    expect(anchor!.asOf).toBe('2026-10-04T10:00:00+08:00');
    expect(anchor!.stale).toBe(false);
    expect(anchor!.footprintRef).toContain('verdicts:');
  });

  it('被丢弃的记录不出坐标；没有共现证据页也不出坐标', () => {
    const { record, claims } = buildRecord();
    const keyIds = claims.filter((c) => KEY_FIELD_KEYS.includes(c.fieldKey ?? '')).map((c) => c.claimId);
    const rejected = gateFor(claims, [], keyIds.map((id) => verdict(id, { verdict: 'not_found', evidenceGrade: 'E0', supportCount: 0 })));
    expect(
      deriveAnchor({
        record,
        summary: rejected.summary,
        cooccurringUrls: [],
        weakestKeyGrade: rejected.weakestKeyGrade,
        query: 'q',
        pack: porcelainPack,
        traceId: 't',
        keyClaimIds: keyIds,
      }),
    ).toBeNull();

    const weak = gateFor(
      claims,
      keyIds.map((id, i) => ev(id, `https://www.cguardian.com/p${i}`)),
      keyIds.map((id) => verdict(id)),
    );
    expect(
      deriveAnchor({
        record,
        summary: weak.summary,
        cooccurringUrls: [],
        weakestKeyGrade: weak.weakestKeyGrade,
        query: 'q',
        pack: porcelainPack,
        traceId: 't',
        keyClaimIds: keyIds,
      }),
    ).toBeNull();
  });

  it('弱档的入口是各字段支撑页并集；下游默认只读强坐标且未失效的那几行', () => {
    const { claims } = buildRecord();
    const keyIds = claims.filter((c) => KEY_FIELD_KEYS.includes(c.fieldKey ?? '')).map((c) => c.claimId);
    const urls = supportingUrlsUnion(keyIds, new Map(keyIds.map((id, i) => [id, [ev(id, `https://www.cguardian.com/p${i}`)]])));
    expect(urls).toHaveLength(3);

    const strong = { ...buildRecord(), anchorGrade: 'strong' as const };
    expect(isReadableAnchor({
      recordId: 'r',
      query: 'q',
      fields: {},
      searchPhrases: [],
      anchorGrade: strong.anchorGrade,
      evidenceGrade: 'E2',
      sourceUrls: ['https://x'],
      categoryTags: [],
      footprintRef: 'f',
      traceId: 't',
      asOf: 'a',
      stale: false,
    })).toBe(true);
    expect(isReadableAnchor({
      recordId: 'r', query: 'q', fields: {}, searchPhrases: [], anchorGrade: 'weak', evidenceGrade: 'E1',
      sourceUrls: ['https://x'], categoryTags: [], footprintRef: 'f', traceId: 't', asOf: 'a', stale: false,
    })).toBe(false);
    expect(isReadableAnchor({
      recordId: 'r', query: 'q', fields: {}, searchPhrases: [], anchorGrade: 'strong', evidenceGrade: 'E3',
      sourceUrls: ['https://x'], categoryTags: [], footprintRef: 'f', traceId: 't', asOf: 'a', stale: true,
    })).toBe(false);
  });
});
