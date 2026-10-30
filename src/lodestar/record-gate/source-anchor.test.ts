// src/lodestar/record-gate/source-anchor.test.ts
/**
 * 来源坐标门禁测试（纯规则，不抓页、不调模型）
 *
 * 钉住来源坐标与事件坐标的三处不同：
 * 1. **判的是入口不是命题**——摊不出详情链接、又不是品类/归档枢纽的页不算入口；
 * 2. **主题对不上才拒页**——年代/材质判不了必须放行（古玩页常只写"清乾隆"这类合写）；
 * 3. **档位看"这是谁家的页"**——来源自家域 / 官方一手 / 两个独立家族任一成立即强，
 *    单一第三方转述页只能是弱坐标，一页都不合格则不产坐标。
 */

import { describe, it, expect } from 'vitest';
import type { DomainPack } from '../packs/pack';
import porcelainPack from '../packs/porcelain';
import { deriveSourceAnchor, type SourceProbePage } from './source-anchor';

const PAGE_TEXT = '清中期 黄花梨躺椅 一对，清代家具专场拍品';

/** 门禁只依赖这几个钩子：字段清单、提及判定、自家域、档位与家族 */
const gatePack: DomainPack = {
  ...porcelainPack,
  sourceFields: () => [
    { key: 'topic', label: '器物主题', role: 'key' },
    { key: 'period', label: '年代', role: 'key' },
    { key: 'sourceName', label: '机构/平台', role: 'secondary' },
  ],
  sourceMentions: (fieldKey, value, text) => {
    if (text.includes(value)) return 'yes';
    // 主题的"没说到"是可靠负信号；年代判不了（页面只写"清乾隆"）必须放行
    return fieldKey === 'topic' ? 'no' : 'unknown';
  },
  sourceHosts: (fields) => (fields.sourceName === '自家平台' ? ['own.example'] : []),
  sourceSearchPhrases: (fields) => [`${(fields.topic ?? '').trim()} ${(fields.sourceName ?? '').trim()}`.trim()],
  tierOf: (host) => (host === 'official.example' ? 'official' : 'unlisted'),
  categoryTagsOf: () => ['瓷器'],
};

const FIELDS = {
  topic: '黄花梨躺椅',
  period: '清代',
  material: '黄花梨',
  sourceName: '中国嘉德',
  category: '古典家具',
};

function page(over: Partial<SourceProbePage> = {}): SourceProbePage {
  return {
    url: 'https://shop.example/lot/1',
    ok: true,
    html: PAGE_TEXT,
    fetcher: 'fetch',
    detailCount: 3,
    hubLike: false,
    ...over,
  };
}

function derive(pages: SourceProbePage[], fields: Record<string, string | null> = FIELDS, pack: DomainPack = gatePack) {
  return deriveSourceAnchor({
    recordId: 'rec-src-1',
    query: '清代黄花梨躺椅有哪些可采集的入口页',
    fields,
    pack,
    pages,
    traceId: 'trace-src-1',
    asOf: '2026-10-24T12:00:00+08:00',
  });
}

describe('入口三问：抓得到、摊得开、说的是这件东西', () => {
  it('一页都抓不到 → 不产坐标，逐页记失败原因', () => {
    const decision = derive([page({ ok: false, html: '', reason: 'HTTP 403' })]);
    expect(decision).toMatchObject({ anchor: null, gate: 'rejected', reason: 'no-entry:fetch-failed:HTTP 403' });
    expect(decision.rejectedPages).toEqual([
      { url: 'https://shop.example/lot/1', reason: 'fetch-failed:HTTP 403' },
    ]);
  });

  it('页面摊不出详情、又不是品类/归档枢纽 → 不是入口（好证据坏入口）', () => {
    const decision = derive([page({ detailCount: 0, hubLike: false })]);
    expect(decision).toMatchObject({ anchor: null, gate: 'rejected' });
    expect(decision.rejectedPages[0]?.reason).toBe('not-an-entry');
  });

  it('详情数为 0 但页面本身是品类枢纽 → 仍算入口', () => {
    const decision = derive([page({ detailCount: 0, hubLike: true })]);
    expect(decision.anchor).not.toBeNull();
    expect(decision.accepted).toEqual(['https://shop.example/lot/1']);
  });

  it('主题对不上 → 拒这一页（主题是入口验收的硬信号）', () => {
    const decision = derive([page({ html: '青花瓷瓶 一对' })]);
    expect(decision).toMatchObject({ anchor: null, gate: 'rejected' });
    expect(decision.rejectedPages[0]?.reason).toBe('source-mismatch:topic');
  });

  it('年代判不了 → 放行，不许把"页面没写年代"升级成拒收', () => {
    const decision = derive([page({ html: '黄花梨躺椅 一对' })]);
    expect(decision.anchor).not.toBeNull();
    expect(decision.rejectedPages).toEqual([]);
  });

  it('一页不合格、另一页合格 → 用合格那页产坐标', () => {
    const bad = page({ url: 'https://bad.example/1', html: '青花瓷瓶' });
    const good = page({ url: 'https://good.example/2' });
    const decision = derive([bad, good]);
    expect(decision.accepted).toEqual(['https://good.example/2']);
    expect(decision.rejectedPages).toEqual([{ url: 'https://bad.example/1', reason: 'source-mismatch:topic' }]);
  });
});

describe('档位：自家域 / 官方一手 / 两个独立家族', () => {
  it('来源自家域上的页通过验收 → 强坐标 + E3', () => {
    const decision = derive(
      [page({ url: 'https://www.own.example/lot/9' })],
      { ...FIELDS, sourceName: '自家平台' },
    );
    expect(decision).toMatchObject({ gate: 'strong', reason: 'source-host-entry' });
    expect(decision.anchor).toMatchObject({ anchorGrade: 'strong', evidenceGrade: 'E3' });
  });

  it('官方一手页通过验收 → 强坐标 + E2', () => {
    const decision = derive([page({ url: 'https://official.example/lot/9' })]);
    expect(decision).toMatchObject({ gate: 'strong', reason: 'authoritative-entry' });
    expect(decision.anchor?.evidenceGrade).toBe('E2');
  });

  it('两个独立来源家族各有一页 → 强坐标 + E2（互相印证）', () => {
    const decision = derive([
      page({ url: 'https://a.example/lot/1' }),
      page({ url: 'https://b.example/lot/2' }),
    ]);
    expect(decision).toMatchObject({ gate: 'strong', reason: 'independent-families' });
    expect(decision.anchor?.evidenceGrade).toBe('E2');
  });

  it('只有单一第三方页 → 弱坐标 + E1（下游默认不读弱坐标）', () => {
    const decision = derive([page({ url: 'https://shop.example/lot/1' })]);
    expect(decision).toMatchObject({ gate: 'weak', reason: 'single-third-party-entry' });
    expect(decision.anchor).toMatchObject({ anchorGrade: 'weak', evidenceGrade: 'E1' });
  });
});

describe('产出的坐标：字段原样、入口去重、再入凭证可机械复算', () => {
  it('sourceUrls 去重后按字典序、kind=source、footprintRef 指向探测底稿', () => {
    const decision = derive([
      page({ url: 'https://b.example/lot/2' }),
      page({ url: 'https://a.example/lot/1' }),
      page({ url: 'https://a.example/lot/1' }),
    ]);
    expect(decision.anchor).toMatchObject({
      recordId: 'rec-src-1',
      kind: 'source',
      fields: FIELDS,
      sourceUrls: ['https://a.example/lot/1', 'https://b.example/lot/2'],
      footprintRef: 'source-probes:trace-src-1',
      traceId: 'trace-src-1',
      asOf: '2026-10-24T12:00:00+08:00',
      stale: false,
      searchPhrases: ['黄花梨躺椅 中国嘉德'],
    });
  });

  it('类目标签由包给，品类值另并入（不覆盖包的判定结果）', () => {
    const decision = derive([page()]);
    expect(decision.anchor?.categoryTags).toEqual(['瓷器', '古典家具']);
  });

  it('包没声明来源字段 → 没有关键提及要判，入口合格即收', () => {
    const noSourceFields: DomainPack = { ...gatePack, sourceFields: () => [] };
    const decision = derive([page({ html: '与主题无关的页面' })], FIELDS, noSourceFields);
    expect(decision.anchor).not.toBeNull();
    expect(decision.rejectedPages).toEqual([]);
  });
});
