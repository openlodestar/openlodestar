// src/lodestar/record-gate/pool-gaps.test.ts
/**
 * 记录级页面池缺口清单测试（离线：不调模型、不抓取）
 *
 * 这份清单决定"下一次模型调用花在哪一页"，所以必须钉住四件事：
 * 1. 已经能出强坐标的记录一个缺口都不列（能免费就不花钱）；
 * 2. 只列"这页已命中本记录其它关键字段"的缺口（对凑齐共现没贡献的页不占额度）；
 * 3. 排序先看"还差几个键就能凑齐"，其次看档位（坐标继承关键字段里最低的等级，
 *    补在高档位页上不额外拉低等级）；
 * 4. 同一底稿每次排出同一个清单——否则钱花在哪不可复现。
 */

import { describe, it, expect } from 'vitest';
import porcelainPack from '../packs/porcelain';
import { PORCELAIN_KEY_FIELDS } from '../packs/porcelain';
import { alignRuns, pickPrimaryVariants } from '../intake/record-container';
import { atomizeFieldToClaim } from '../intake/atomize';
import { planRecordPoolGaps } from './pool-gaps';
import type { MappedRow } from '../intake/record-container';
import type { ClaimRecord, EvidenceRecord, SourceTier } from '../types';

const PAGE_A = 'https://www.chinanews.com/m/cul/2021/11-25/9616104.shtml';
const PAGE_B = 'https://www.cguardian.com/a/2021-autumn-ceramics';
const PAGE_C = 'https://amma.artron.net/observation_shownews.php?newid=1130707';

const SEED: MappedRow = { auctionHouse: '中国嘉德', dateText: '2021年11月', sessionName: '瓷器工艺品专场' };

function buildClaims(seed: MappedRow): ClaimRecord[] {
  const record = alignRuns([[seed], [seed], [seed]], porcelainPack)[0]!;
  const specByKey = new Map(porcelainPack.fields().map((f) => [f.key, f]));
  return pickPrimaryVariants(record).map((variant) =>
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
}

function claimOf(claims: ClaimRecord[], fieldKey: string): ClaimRecord {
  const found = claims.find((c) => c.fieldKey === fieldKey);
  if (!found) throw new Error(`夹具里没有字段 ${fieldKey}`);
  return found;
}

function evidence(
  claim: ClaimRecord,
  url: string,
  relation: EvidenceRecord['relation'],
  tier: SourceTier = 'primary',
): EvidenceRecord {
  const domain = new URL(url).hostname;
  return {
    evidenceId: `ev-${claim.fieldKey}-${relation}-${domain}`,
    claimId: claim.claimId,
    url,
    domain,
    sourceFamily: porcelainPack.sourceFamilyOf(domain),
    tier,
    quote: '中国嘉德2021秋季拍卖会瓷器工艺品专场',
    relation,
    contentWeight: relation === 'supports' ? 1 : 0.6,
    fetchedBy: 'lodestar',
    fetchedAt: '2026-10-04T10:00:00+08:00',
    snapshotRef: `snapshots/${domain}.html`,
    traceId: 'trace-test',
    fieldKey: claim.fieldKey,
    recordId: claim.recordId,
  };
}

describe('记录级页面池缺口清单', () => {
  it('三个关键字段差一个、而那页已命中另外两个 → 正好列一个缺口，命中数记 2', () => {
    const claims = buildClaims(SEED);
    const rows = [
      evidence(claimOf(claims, 'auctionHouse'), PAGE_A, 'supports'),
      evidence(claimOf(claims, 'dateText'), PAGE_A, 'supports'),
      // 专场名一次都没比过：它那轮检索捞回的是别的页，共现因此凑不齐
    ];

    const plan = planRecordPoolGaps({ claims, evidence: rows, keyFieldKeys: PORCELAIN_KEY_FIELDS });
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]).toMatchObject({
      claimId: claimOf(claims, 'sessionName').claimId,
      fieldKey: 'sessionName',
      hitKeys: 2,
    });
    expect(plan.items[0]!.page.url).toBe(PAGE_A);
    expect(plan.items[0]!.page.snapshotRef).toBe('snapshots/www.chinanews.com.html');
  });

  it('已经有一页命中全部关键字段 → 零缺口（这条记录能免费出强坐标，一次比对都不该花）', () => {
    const claims = buildClaims(SEED);
    const rows = claims.map((c) => evidence(c, PAGE_A, 'supports'));

    expect(planRecordPoolGaps({ claims, evidence: rows, keyFieldKeys: PORCELAIN_KEY_FIELDS }).items).toEqual([]);
  });

  it('一页连一个关键字段都没写 → 不占额度（补它对凑齐共现没有贡献）', () => {
    const claims = buildClaims(SEED);
    const rows = [
      evidence(claimOf(claims, 'auctionHouse'), PAGE_A, 'supports'),
      // PAGE_C 只被 dateText 比过、且判不相干：别的字段再拿它比一次也凑不出共现
      evidence(claimOf(claims, 'dateText'), PAGE_C, 'irrelevant'),
    ];

    const plan = planRecordPoolGaps({ claims, evidence: rows, keyFieldKeys: PORCELAIN_KEY_FIELDS });
    expect(plan.items.map((g) => `${g.fieldKey}@${g.page.url}`)).toEqual([
      'dateText@' + PAGE_A,
      'sessionName@' + PAGE_A,
    ]);
  });

  it('先按"还差几个键"排，同分时高档位先补；清单可复现', () => {
    const claims = buildClaims(SEED);
    const house = claimOf(claims, 'auctionHouse');
    const date = claimOf(claims, 'dateText');
    const session = claimOf(claims, 'sessionName');
    const rows = [
      // PAGE_A（primary 档）已命中 auctionHouse + dateText → 差 sessionName
      evidence(house, PAGE_A, 'supports'),
      evidence(date, PAGE_A, 'supports'),
      // PAGE_B（official 档）已命中 auctionHouse + sessionName → 差 dateText
      evidence(house, PAGE_B, 'supports', 'official'),
      evidence(session, PAGE_B, 'supports', 'official'),
      // PAGE_C（official 档）只命中 auctionHouse → 差两个键，命中率低，应排后面
      evidence(house, PAGE_C, 'supports', 'official'),
    ];

    const plan = planRecordPoolGaps({ claims, evidence: rows, keyFieldKeys: PORCELAIN_KEY_FIELDS });
    expect(plan.items.map((g) => `${g.fieldKey}@${g.page.url}:${g.hitKeys}`)).toEqual([
      'dateText@' + PAGE_B + ':2',
      'sessionName@' + PAGE_A + ':2',
      'dateText@' + PAGE_C + ':1',
      'sessionName@' + PAGE_C + ':1',
    ]);

    const again = planRecordPoolGaps({ claims, evidence: rows, keyFieldKeys: PORCELAIN_KEY_FIELDS });
    expect(again.items.map((g) => `${g.claimId}@${g.page.url}`)).toEqual(
      plan.items.map((g) => `${g.claimId}@${g.page.url}`),
    );
  });

  it('recordIds 给了就只算那几条记录的缺口', () => {
    const claims = buildClaims(SEED);
    const rows = [
      evidence(claimOf(claims, 'auctionHouse'), PAGE_A, 'supports'),
      evidence(claimOf(claims, 'dateText'), PAGE_A, 'supports'),
    ];

    expect(planRecordPoolGaps({ claims, evidence: rows, keyFieldKeys: PORCELAIN_KEY_FIELDS }).items).toHaveLength(1);
    expect(
      planRecordPoolGaps({
        claims,
        evidence: rows,
        keyFieldKeys: PORCELAIN_KEY_FIELDS,
        recordIds: ['rec-20261004-不存在的记录'],
      }).items,
    ).toEqual([]);
  });

  it('只有一条关键字段的记录不列缺口（单字段页即全集，谈不上共现）', () => {
    const claims = buildClaims({ auctionHouse: '中国嘉德' });
    const rows = [evidence(claims[0]!, PAGE_A, 'supports')];

    expect(planRecordPoolGaps({ claims, evidence: rows, keyFieldKeys: PORCELAIN_KEY_FIELDS }).items).toEqual([]);
  });
});
