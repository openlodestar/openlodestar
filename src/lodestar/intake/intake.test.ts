// src/lodestar/intake/intake.test.ts
/**
 * 输入侧测试（离线：只喂文本夹具，不发任何 LLM 请求）
 *
 * 钉住的是提问环的可跑判据：
 * - 一次提问产出一批记录，每条记录的字段捆在一起（同属一场事件），字段仍是可裁决的单命题；
 * - 每条断言带复问次数、复现次数、是否追问诱导三个标记；
 * - 三招顺序的后果能在数据上看见：具体化补出来的值一律 promptedDetail=true，
 *   且只有整场稳定复现的记录才允许靠它送查。
 */

import { describe, it, expect } from 'vitest';
import porcelainPack from '../packs/porcelain';
import {
  alignRuns,
  applyConcretization,
  capRecords,
  isDiscardableRow,
  pickPrimaryVariants,
  recordFieldsSnapshot,
  selectFieldsForBudget,
  type AlignedRecord,
  type FieldVariant,
  type MappedRow,
} from './record-container';
import { parseConcretizationPatches, parseModelRows } from './parse-answer';
import { applyTriage, mergeDuplicateClaims, triageClaim } from './triage';
import { atomizeFieldToClaim } from './atomize';
import type { ClaimRecord } from '../types';

/** 三轮作答（模型每轮写法不同：简称／全称／多一个"专场"尾词／日期粒度不同） */
const RUN_1: MappedRow[] = [
  { auctionHouse: '中国嘉德', dateText: '2014年5月', sessionName: '瓷器工艺品专场', location: '北京' },
  { auctionHouse: '北京保利', dateText: '2019年', sessionName: '珍瓷雅玩' },
];
const RUN_2: MappedRow[] = [
  { auctionHouse: '嘉德', dateText: '2014-05', sessionName: '瓷器工艺品' },
  { auctionHouse: '北京保利', dateText: '2019', sessionName: '珍瓷雅玩专场' },
];
const RUN_3: MappedRow[] = [
  { auctionHouse: '中国嘉德国际拍卖有限公司', dateText: '2014', sessionName: '瓷器工艺品专场' },
];

function alignThreeRuns(): AlignedRecord[] {
  return alignRuns([RUN_1, RUN_2, RUN_3], porcelainPack);
}


/**
 * "这个字段值不值得花检索预算去查"——判据只有预筛一处实现，
 * 测试也走那一条：把字段原子化成断言，看预筛放不放行。
 */
function worthSending(variant: FieldVariant, record: AlignedRecord, minHits = 2): boolean {
  const specByKey = new Map(porcelainPack.fields().map((f) => [f.key, f]));
  const spec = specByKey.get(variant.fieldKey);
  if (!spec) throw new Error(`夹具字段不在策略包里：${variant.fieldKey}`);
  const claim = atomizeFieldToClaim({
    queryId: 'q-20261004-test',
    record,
    variant,
    spec,
    pack: porcelainPack,
    channel: 'enumerative',
    selectionReason: null,
    stabilityRuns: record.runs,
  });
  return triageClaim({
    claim,
    minStabilityHits: minHits,
    recordStable: record.recordHits >= minHits,
  }).passed;
}

describe('记录容器：一次提问产出一批记录，字段捆在同一场事件上', () => {
  it('三轮作答对齐成两条记录，同场跨轮合并、异场不合并', () => {
    const records = alignThreeRuns();
    expect(records).toHaveLength(2);
    const guardian = records.find((r) => r.matchKey.startsWith('中国嘉德'))!;
    expect(guardian.recordHits).toBe(3);
    const poly = records.find((r) => r.matchKey.startsWith('北京保利'))!;
    expect(poly.recordHits).toBe(2);
  });

  it('字段值变体按等价键归并（"2014年5月"与"2014-05"与"2014"算同一取值复现三次）', () => {
    const guardian = alignThreeRuns().find((r) => r.matchKey.startsWith('中国嘉德'))!;
    const dateVariants = guardian.variants.filter((v) => v.fieldKey === 'dateText');
    expect(dateVariants).toHaveLength(1);
    expect(dateVariants[0]!.hits).toBe(3);
  });

  it('同一轮里重复列同一场只算一次（防止一轮刷满复现次数）', () => {
    const duplicated = alignRuns([[RUN_1[0]!, RUN_1[0]!], [], []], porcelainPack);
    expect(duplicated).toHaveLength(1);
    expect(duplicated[0]!.recordHits).toBe(1);
  });

  it('关键字段全空的行当弃权丢弃，不进记录集', () => {
    expect(isDiscardableRow({ auctionHouse: '', dateText: '', sessionName: null, location: '北京' }, porcelainPack)).toBe(true);
    expect(isDiscardableRow({ auctionHouse: '中国嘉德', dateText: '', sessionName: '' }, porcelainPack)).toBe(false);
    const parsed = parseModelRows('[{"拍卖行":"","时间":"","专场名称":""}]', porcelainPack);
    expect(parsed.rows).toHaveLength(0);
    expect(parsed.discardedAbstained).toBe(1);
  });
});

describe('稳定性判据：只决定值不值得花钱查', () => {
  it('复现次数达标的字段送查；不达标的字段不送', () => {
    const records = alignThreeRuns();
    const guardian = records.find((r) => r.matchKey.startsWith('中国嘉德'))!;
    const poly = records.find((r) => r.matchKey.startsWith('北京保利'))!;
    const location = guardian.variants.find((v) => v.fieldKey === 'location');
    expect(location?.hits).toBe(1);   // 地点只在第一轮出现过
    expect(worthSending(location!, guardian)).toBe(false);
    const session = poly.variants.find((v) => v.fieldKey === 'sessionName')!;
    expect(worthSending(session, poly)).toBe(true);

    const single = alignRuns([[{ auctionHouse: '西泠印社拍卖', dateText: '2018年', sessionName: '瓷器专场' }], [], []], porcelainPack);
    const oneHit = single[0]!.variants.find((v) => v.fieldKey === 'sessionName')!;
    expect(oneHit.hits).toBe(1);
    expect(worthSending(oneHit, single[0]!)).toBe(false);
  });

  it('具体化补出来的字段：整场稳定才送查，写法不同则新建变体并打追问标记', () => {
    const records = alignThreeRuns();
    const guardian = records.find((r) => r.matchKey.startsWith('中国嘉德'))!;
    applyConcretization(records, [{ matchKey: guardian.matchKey, fields: { category: '官窑瓷器' } }], porcelainPack);
    const filled = guardian.variants.find((v) => v.fieldKey === 'category')!;
    expect(filled.promptedDetail).toBe(true);
    expect(filled.hits).toBe(1);
    expect(worthSending(filled, guardian)).toBe(true);

    // 同一取值再补一次只累加次数，不新建变体
    applyConcretization(records, [{ matchKey: guardian.matchKey, fields: { category: '官窑瓷器' } }], porcelainPack);
    expect(guardian.variants.filter((v) => v.fieldKey === 'category')).toHaveLength(1);
    expect(guardian.variants.find((v) => v.fieldKey === 'category')!.hits).toBe(2);

    // 整场不稳（只出现过一轮）时，追问补出来的新字段不足以单独送查
    const shaky = alignRuns(
      [[{ auctionHouse: '朵云轩', dateText: '2015年', sessionName: '瓷器' }], [], []],
      porcelainPack,
    )[0]!;
    applyConcretization([shaky], [{ matchKey: shaky.matchKey, fields: { category: '民窑' } }], porcelainPack);
    const filledOnShaky = shaky.variants.find((v) => v.fieldKey === 'category')!;
    expect(filledOnShaky.promptedDetail).toBe(true);
    expect(filledOnShaky.hits).toBe(1);
    expect(worthSending(filledOnShaky, shaky)).toBe(false);
  });

  it('记录数上限截断的顺序是确定的（复现次数降序 → 首轮出现更早优先 → 对齐键字典序）', () => {
    const many: MappedRow[] = [];
    for (let i = 0; i < 12; i++) {
      many.push({ auctionHouse: `第${i}家拍卖行`, dateText: `20${10 + i}年`, sessionName: `瓷器专场第${i}号` });
    }
    const first = capRecords(alignRuns([many, [], []], porcelainPack), 5);
    const second = capRecords(alignRuns([many, [], []], porcelainPack), 5);
    expect(first.map((r) => r.matchKey)).toEqual(second.map((r) => r.matchKey));
    expect(first).toHaveLength(5);
  });
});

describe('原子化：一条断言只装一个命题，字段仍是可判定句子', () => {
  it('关键字段各成一条断言，三个标记齐全', () => {
    const records = alignThreeRuns();
    const guardian = records.find((r) => r.matchKey.startsWith('中国嘉德'))!;
    const specByKey = new Map(porcelainPack.fields().map((f) => [f.key, f]));
    const claims = pickPrimaryVariants(guardian).map((variant) =>
      atomizeFieldToClaim({
        queryId: 'q-20261004-test',
        record: guardian,
        variant,
        spec: specByKey.get(variant.fieldKey)!,
        pack: porcelainPack,
        channel: 'enumerative',
        selectionReason: 'coverage-gap',
        stabilityRuns: guardian.runs,
      }),
    );

    expect(claims.map((c) => c.fieldKey).sort()).toEqual(['auctionHouse', 'dateText', 'location', 'sessionName']);
    const house = claims.find((c) => c.fieldKey === 'auctionHouse')!;
    expect(house.fieldRole).toBe('key');
    expect(house.predicate).toBe('主办机构');
    expect(house.subject).toBe('中国嘉德');
    expect(house.atomicText).toContain('瓷器工艺品专场');
    expect(house.provenance).toMatchObject({ stabilityRuns: 3, stabilityHits: 3, promptedDetail: false });
    expect(house.channel).toBe('enumerative');
    expect(house.state).toBe('pending');
    // rawText 保留模型那一行的原样表述，供人工复核
    expect(JSON.parse(house.rawText).auctionHouse).toBeTruthy();
  });

  it('时间范围由策略包从记录的时间字段解析，三条关键字段共享同一场的时间', () => {
    const guardian = alignThreeRuns().find((r) => r.matchKey.startsWith('中国嘉德'))!;
    const snapshot = recordFieldsSnapshot(guardian);
    expect(porcelainPack.timeScopeOf({ recordId: guardian.recordId, fields: snapshot, rawText: '' }))
      .toEqual({ from: '2014-05-01', to: '2014-05-31' });
  });
});

describe('预筛：便宜的形式判断，拒收也留理由', () => {
  const baseClaim = (over: Partial<ClaimRecord> = {}): ClaimRecord => ({
    claimId: 'cl-20261004-test',
    queryId: 'q-20261004-test',
    recordId: 'rec-20261004-test',
    fieldRole: 'key',
    rawText: '',
    atomicText: '中国嘉德于2014年5月举办「瓷器工艺品专场」',
    subject: '中国嘉德',
    predicate: '举办时间',
    object: '2014年5月',
    timeScope: { from: '2014-05-01', to: '2014-05-31' },
    channel: 'enumerative',
    provenance: { stabilityRuns: 3, stabilityHits: 3, promptedDetail: false, selectionReason: null },
    triage: { passed: true, reason: 'pending-triage' },
    state: 'pending',
    fieldKey: 'dateText',
    createdAt: new Date().toISOString(),
    ...over,
  });

  it.each([
    ['弃权留空', baseClaim({ object: '不记得' }), 'abstained-value'],
    ['指代无法消解', baseClaim({ subject: '那家拍卖行' }), 'unresolvable-reference'],
    ['没有内容', baseClaim({ object: '  ' }), 'no-assertion'],
  ] as const)('预筛项：%s', (_label, claim, expected) => {
    expect(triageClaim({ claim, minStabilityHits: 2, recordStable: true }).reason).toBe(expected);
  });

  it('复现次数不足判 unstable-replay，且 applyTriage 把状态置为 rejected', () => {
    const claims = [baseClaim({ provenance: { stabilityRuns: 3, stabilityHits: 1, promptedDetail: false, selectionReason: null } })];
    const passed = applyTriage(claims, { minStabilityHits: 2, recordStability: new Map([['rec-20261004-test', false]]) });
    expect(passed).toHaveLength(0);
    expect(claims[0]!.state).toBe('rejected');
    expect(claims[0]!.triage.reason).toBe('unstable-replay');
  });

  it('外部提交不受复问门槛约束（它本来就不复问）', () => {
    const claim = baseClaim({
      channel: 'external',
      recordId: null,
      provenance: { stabilityRuns: 1, stabilityHits: 1, promptedDetail: false, selectionReason: 'external-submission' },
    });
    expect(triageClaim({ claim, minStabilityHits: 2, recordStable: false }).passed).toBe(true);
  });

  it('同记录内的重复断言合并并累加稳定次数；不同记录的句子相似不合并', () => {
    const a = baseClaim({ claimId: 'cl-1', provenance: { stabilityRuns: 3, stabilityHits: 2, promptedDetail: false, selectionReason: null } });
    const b = baseClaim({
      claimId: 'cl-2',
      object: '2014年5月',
      atomicText: '中国嘉德于2014年5月办过瓷器工艺品专场',
      provenance: { stabilityRuns: 3, stabilityHits: 1, promptedDetail: false, selectionReason: null },
    });
    const merged = mergeDuplicateClaims([a, b]);
    expect(merged.kept).toHaveLength(1);
    expect(merged.mergedCount).toBe(1);
    expect(merged.kept[0]!.claimId).toBe('cl-1');   // 保留最早来源
    expect(merged.kept[0]!.provenance.stabilityHits).toBe(3);

    const elsewhere = baseClaim({ claimId: 'cl-3', recordId: 'rec-other', object: '2014年5月' });
    expect(mergeDuplicateClaims([a, elsewhere]).kept).toHaveLength(2);
  });
});

describe('应答解析：坏形态当场收敛，不留给下游猜', () => {
  it('不是 JSON 数组时报错而不是静默空集', () => {
    const parsed = parseModelRows('抱歉，我想不起具体场次。', porcelainPack);
    expect(parsed.parseError).not.toBeNull();
    expect(parsed.rows).toHaveLength(0);
  });

  it('数组里混入非对象元素单独计数', () => {
    const parsed = parseModelRows('[{"拍卖行":"中国嘉德","时间":"2014年","专场名称":"瓷器"},"乱入的一行"]', porcelainPack);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.skippedNonObject).toBe(1);
  });

  it('具体化补丁的 matchKey 不在允许集合内一律作废（禁止跨行拼接要素）', () => {
    const text = '[{"matchKey":"allowed-1","category":"官窑"},{"matchKey":"made-up","category":"民窑"}]';
    const patches = parseConcretizationPatches(text, porcelainPack, new Set(['allowed-1']));
    expect(patches).toEqual([{ matchKey: 'allowed-1', fields: { category: '官窑' } }]);
  });
});

describe('单记录字段预算（第二层预算闸）', () => {
  const KEY = ['auctionHouse', 'dateText', 'sessionName'];

  function variantsOf(fields: Array<[string, number]>): FieldVariant[] {
    return fields.map(([fieldKey, hits], index) => ({
      fieldKey,
      value: `v-${fieldKey}`,
      matchKey: fieldKey,
      hits,
      firstSeenRun: index,
      promptedDetail: false,
    }));
  }

  it('关键字段优先占额度，次要字段排后；次数多的同角色内先选', () => {
    const { chosen, overBudget } = selectFieldsForBudget(
      variantsOf([['location', 5], ['sessionName', 2], ['totalHammer', 9], ['auctionHouse', 2], ['dateText', 2]]),
      KEY,
      3,
    );
    expect(chosen.map((v) => v.fieldKey)).toEqual(['auctionHouse', 'dateText', 'sessionName']);
    expect(overBudget.map((v) => v.fieldKey)).toEqual(['totalHammer', 'location']);
  });

  it('上限为 0 即不限（次要字段也送查）；不超上限时 overBudget 为空', () => {
    const variants = variantsOf([['auctionHouse', 2], ['location', 2]]);
    expect(selectFieldsForBudget(variants, KEY, 0).overBudget).toEqual([]);
    expect(selectFieldsForBudget(variants, KEY, 5).chosen).toHaveLength(2);
  });

  it('同一批输入两次选出的字段集一致（截断确定性）', () => {
    const variants = variantsOf([['category', 1], ['location', 1], ['sessionName', 1], ['dateText', 1], ['auctionHouse', 1]]);
    const a = selectFieldsForBudget(variants, KEY, 3).chosen.map((v) => v.fieldKey);
    const b = selectFieldsForBudget([...variants].reverse(), KEY, 3).chosen.map((v) => v.fieldKey);
    expect(a).toEqual(b);
  });
});

describe('外部提交与提问环产物合并去重（防同一条断言裁两遍）', () => {
  it('同 claimId 只留一条，顺序保持首次出现', async () => {
    const { dedupeByClaimId } = await import('../engine');
    const { externalClaimToRecord } = await import('./atomize');
    const make = (fieldKey: string) =>
      externalClaimToRecord({
        rawText: 'r',
        atomicText: `a-${fieldKey}`,
        subject: '北京保利拍卖',
        predicate: 'p',
        object: `o-${fieldKey}`,
        pack: porcelainPack,
        fieldKey,
        recordId: 'rec-known-poly2021autumn',
        queryId: 'q-known',
      });
    const claims = [make('auctionHouse'), make('dateText'), make('auctionHouse')];
    const deduped = dedupeByClaimId(claims);
    expect(deduped).toHaveLength(2);
    expect(deduped.map((c) => c.fieldKey)).toEqual(['auctionHouse', 'dateText']);
    // 带 recordId + fieldKey 的外部断言用确定性主键，门禁才能把它认回所属记录
    expect(deduped[0]!.claimId).toBe('cl-rec-known-poly2021autumn-auctionHouse');
  });
});
