// src/lodestar/adjudicate/retrieval.test.ts
/**
 * Lodestar 证据检索的路由测试（引擎不依赖宿主线上进程）
 *
 * 断言检索编排的两条纪律：
 * 1. **源轨先发，只对 0 召回的查询补发一次译文**（不是无条件双轨；0 是提供者抖动，
 *    语言探针见 examples/replay-search/probe-language/result.json）；
 * 2. 翻译失败或译文与原文相同时不做补发，原因显式留痕（不静默降级）。
 * 另有编造链接的机械过滤：标题点名机构 ≠ 域名所属机构 → 不进候选池。
 *
 * 与 adjudicate.test.ts 分家的理由：那个文件的自我定位是"离线：不发检索"，
 * 本文件恰恰要发检索（提供者与翻译都给假件，不花钱）。
 *
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { searchMock, translateMock, providerState } = vi.hoisted(() => ({
  searchMock: vi.fn(),
  translateMock: vi.fn(),
  /** 假提供者的能力位：undefined = 不声明（契约缺省视为不支持 site:） */
  providerState: { siteOperator: true as boolean | undefined },
}));

vi.mock('../../integrations/search-providers', () => ({
  createSearchProvider: () => ({
    name: 'fake',
    ...(providerState.siteOperator === undefined
      ? {}
      : { capabilities: { siteOperator: providerState.siteOperator } }),
    search: searchMock,
  }),
  getSearchProviderFromEnv: () => 'fake',
}));

vi.mock('../../services/query-translation', () => ({ translateQueries: translateMock }));

import {
  buildEvidenceQueries,
  buildRecordQueries,
  filterAndRankCandidates,
  retrieveCandidates,
} from './retrieval';
import porcelainPack from '../packs/porcelain';
import type { ClaimRecord } from '../types';
import { createLogger } from '../../utils/logger';

const logger = createLogger({ prefix: '[retrieval-test] ' });

const ZH_QUERY = '中国嘉德（香港） 2024年4月';
const ZH_QUERY_2 = '中国嘉德 2024年4月 春季拍卖会';
const EN_QUERY = 'China Guardian (Hong Kong) April 2024';
const EN_QUERY_2 = 'China Guardian April 2024 spring sale';

/** 造一条搜索结果 */
function hit(url: string, position: number, queryIndex = 0) {
  return { url, title: `T${position}`, snippet: '', position, queryIndex };
}

const CLAIM: ClaimRecord = {
  claimId: 'cl-20261017-test',
  recordId: 'rec-20261017-test',
  fieldKey: 'dateText',
  subject: '中国嘉德',
  predicate: '举办',
  object: '2024年4月',
  atomicText: '中国嘉德 2024年4月 举办',
  sourceHint: null,
} as unknown as ClaimRecord;

function baseInput() {
  return {
    pack: porcelainPack,
    claim: CLAIM,
    values: {},
    maxQueries: 4,
    numResultsPerQuery: 10,
    logger,
    prebuiltQueries: [ZH_QUERY],
  };
}

beforeEach(() => {
  searchMock.mockReset();
  translateMock.mockReset();
  providerState.siteOperator = true;
  searchMock.mockResolvedValue({ results: [], rawResponse: {} });
  // 缺省译文为空（等价于"没翻出来"）：不做补发，能力位测试只数源轨一次
  translateMock.mockResolvedValue({ queries: [], cacheHit: false, model: 'fake', failed: false });
});

describe('buildRecordQueries — 字段轮转', () => {
  it('检索名额按字段轮转，不会全花在第一个字段的模板上', () => {
    const values = {
      auctionHouse: '北京保利',
      dateText: '2021年12月5日',
      sessionName: '禹贡Ⅰ—盛清御瓷新风尚',
    };
    const specs = new Map(porcelainPack.fields().map((field) => [field.key, field]));
    const claims = (['auctionHouse', 'dateText', 'sessionName'] as const).map((fieldKey) => {
      const claim = {
        ...CLAIM,
        claimId: `cl-test-${fieldKey}`,
        fieldKey,
        object: values[fieldKey],
        subject: fieldKey === 'auctionHouse' ? '北京保利' : values.auctionHouse,
        atomicText: `${values.auctionHouse} ${values.dateText} ${values.sessionName}`,
      } as unknown as ClaimRecord;
      return { claim, spec: specs.get(fieldKey) };
    });

    const queries = buildRecordQueries({
      pack: porcelainPack,
      claims,
      values,
      domains: ['polyauction.com.cn'],
      maxQueries: 3,
    });
    const firstOfEach = claims.map(({ claim, spec }) =>
      buildEvidenceQueries({
        pack: porcelainPack,
        claim,
        values,
        spec,
        domains: ['polyauction.com.cn'],
        maxQueries: 3,
      })[0],
    );

    expect(queries).toEqual(firstOfEach);
  });
});

describe('retrieveCandidates — 源轨先发 + 0 召回补发', () => {
  it('源轨 0 召回 → 补发一次译文；searchCalls 记源查询 + 补发条数', async () => {
    translateMock.mockResolvedValue({ queries: [EN_QUERY], cacheHit: false, model: 'fake', failed: false });

    const result = await retrieveCandidates(baseInput());

    expect(translateMock).toHaveBeenCalledWith([ZH_QUERY], 'en', expect.anything());
    expect(searchMock).toHaveBeenCalledTimes(2);
    expect(searchMock).toHaveBeenCalledWith([ZH_QUERY], expect.objectContaining({ language: 'zh-cn' }));
    expect(searchMock).toHaveBeenCalledWith([EN_QUERY], expect.objectContaining({ language: 'en' }));
    expect(result.searchCalls).toBe(2);
    expect(result.queries).toEqual([ZH_QUERY]);
    expect(result.repairs).toEqual([{ query: ZH_QUERY, translatedQuery: EN_QUERY, returned: 0 }]);
    expect(result.translation?.failed).toBe(false);
  });

  it('源轨有召回的查询不补发：只补 0 召回的那条', async () => {
    translateMock.mockResolvedValue({
      queries: [EN_QUERY, EN_QUERY_2],
      cacheHit: false,
      model: 'fake',
      failed: false,
    });
    searchMock
      .mockResolvedValueOnce({
        results: [hit('https://www.cguardian.com/auction/1', 1, 0)],
        rawResponse: {},
      })
      .mockResolvedValueOnce({
        results: [hit('https://www.cguardian.com/auction/2', 1, 0)],
        rawResponse: {},
      });

    const result = await retrieveCandidates({ ...baseInput(), prebuiltQueries: [ZH_QUERY, ZH_QUERY_2] });

    // 源轨一次（两条查询），补发一次（只有第二条）
    expect(searchMock).toHaveBeenCalledTimes(2);
    expect(searchMock).toHaveBeenLastCalledWith([EN_QUERY_2], expect.objectContaining({ language: 'en' }));
    expect(result.searchCalls).toBe(3);
    expect(result.repairs.map((repair) => repair.query)).toEqual([ZH_QUERY_2]);
  });

  it('合流：源轨与补发轨的同一页（带 fragment / 追踪参数）只留一条，两轨候选都进池', async () => {
    translateMock.mockResolvedValue({
      queries: [EN_QUERY, EN_QUERY_2],
      cacheHit: false,
      model: 'fake',
      failed: false,
    });
    const page = 'https://www.cguardian.com/aucenter/lot/123';
    searchMock
      // 源轨：第 1 条查询有召回（带追踪参数），第 2 条 0 召回
      .mockResolvedValueOnce({ results: [hit(`${page}?utm_source=newsletter#top`, 1, 0)], rawResponse: {} })
      // 补发轨：同一张页（干净 URL）＋ 另一来源
      .mockResolvedValueOnce({
        results: [hit(page, 1, 0), hit('https://www.sothebys.com/auction/9', 2, 0)],
        rawResponse: {},
      });

    const result = await retrieveCandidates({ ...baseInput(), prebuiltQueries: [ZH_QUERY, ZH_QUERY_2] });

    expect(result.candidates.map((c) => c.url).sort()).toEqual([
      `${page}?utm_source=newsletter#top`,
      'https://www.sothebys.com/auction/9',
    ]);
  });

  it('翻译整体失败 → 不补发，源轨 0 召回显式留痕（不伪装成单轨正常）', async () => {
    translateMock.mockResolvedValue({ queries: [], cacheHit: false, model: '', failed: true });

    const result = await retrieveCandidates(baseInput());

    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(searchMock).toHaveBeenCalledWith([ZH_QUERY], expect.objectContaining({ language: 'zh-cn' }));
    expect(result.searchCalls).toBe(1);
    expect(result.repairs).toEqual([]);
    expect(result.translation?.failed).toBe(true);
    expect(result.translation?.reason).toContain('未做修复');
  });

  it('译文与原文相同（没翻出来）→ 不补发，计数进 untranslated', async () => {
    translateMock.mockResolvedValue({ queries: [ZH_QUERY], cacheHit: false, model: 'fake', failed: false });

    const result = await retrieveCandidates(baseInput());

    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(result.repairs).toEqual([]);
    expect(result.translation?.untranslated).toBe(1);
    expect(result.translation?.reason).toContain('译文与原文相同');
  });

  it('查询集为空时不触发翻译与检索（保留既有跳过语义）', async () => {
    const result = await retrieveCandidates({ ...baseInput(), prebuiltQueries: [] });

    expect(result.searchCalls).toBe(0);
    expect(result.repairs).toEqual([]);
    expect(result.translation).toBeNull();
    expect(searchMock).not.toHaveBeenCalled();
    expect(translateMock).not.toHaveBeenCalled();
  });
});

describe('retrieveCandidates — 能力位生效（site: 不降级）', () => {
  const SITE_QUERY = 'site:cguardian.com 中国嘉德';

  it('提供者不支持 site: → 域定向查询被跳过并记账，不发送、不降级成普通词', async () => {
    providerState.siteOperator = false;

    const result = await retrieveCandidates({ ...baseInput(), prebuiltQueries: [ZH_QUERY, SITE_QUERY] });

    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(searchMock).toHaveBeenCalledWith([ZH_QUERY], expect.objectContaining({ language: 'zh-cn' }));
    expect(result.queries).toEqual([ZH_QUERY]);
    expect(result.skippedQueries).toEqual([SITE_QUERY]);
    expect(result.searchCalls).toBe(1);
  });

  it('未声明 capabilities（缺省视为不支持）同样跳过 site: 查询', async () => {
    providerState.siteOperator = undefined;

    const result = await retrieveCandidates({ ...baseInput(), prebuiltQueries: [ZH_QUERY, SITE_QUERY] });

    expect(result.skippedQueries).toEqual([SITE_QUERY]);
    expect(searchMock).toHaveBeenCalledTimes(1);
  });

  it('声明 siteOperator=true 时 site: 查询照常发出', async () => {
    const result = await retrieveCandidates({ ...baseInput(), prebuiltQueries: [ZH_QUERY, SITE_QUERY] });

    expect(searchMock).toHaveBeenCalledWith([ZH_QUERY, SITE_QUERY], expect.anything());
    expect(result.skippedQueries).toEqual([]);
  });

  it('全部查询都是 site: 且提供者不支持 → 0 次检索，但提供者名仍记下（可归因）', async () => {
    providerState.siteOperator = false;

    const result = await retrieveCandidates({ ...baseInput(), prebuiltQueries: [SITE_QUERY] });

    expect(searchMock).not.toHaveBeenCalled();
    expect(translateMock).not.toHaveBeenCalled();
    expect(result.searchCalls).toBe(0);
    expect(result.skippedQueries).toEqual([SITE_QUERY]);
    expect(result.provider).toBe('fake');
  });
});

describe('filterAndRankCandidates — 编造链接的机械判据', () => {
  /** 造一条原始搜索结果（position 只用于排序） */
  function item(url: string, title: string, position: number) {
    return { url, title, snippet: '', position, queryIndex: 0 };
  }

  it('标题点名别家拍行、域名却属于另一家 → 拦在候选池外并记理由', () => {
    const fabricated = [
      item(
        'https://www.christies.com/en/auction/poly-auction-2021-winter-catalog-12345/',
        "Poly Auction 2021 Winter Catalog | Christie's",
        1,
      ),
      item(
        'https://www.sothebys.com/en/auctions/2021/poly-auction-winter',
        "Poly Auction 2021 Winter Catalog | Sotheby's",
        2,
      ),
      item(
        'https://www.bonhams.com/auctions/26123/poly-auction-2021-winter-catalog/',
        'Poly Auction 2021 Winter Catalog | Bonhams',
        3,
      ),
    ];
    const genuine = [
      item('https://www.cguardian.com/auction/2021', 'China Guardian 2021 Autumn Auctions', 4),
      item('https://www.thevalue.com/auction/poly-2021', 'Poly Auction 2021 winter sale results', 5),
    ];

    const { candidates, rejected } = filterAndRankCandidates([...fabricated, ...genuine], porcelainPack);

    expect(candidates.map((candidate) => candidate.url).sort()).toEqual(
      genuine.map((entry) => entry.url).sort(),
    );
    expect(rejected.filter((entry) => entry.reason.includes('疑似编造'))).toHaveLength(3);
  });

  it('中文标题同样拦：域名属于苏富比、标题写北京保利', () => {
    const { candidates, rejected } = filterAndRankCandidates(
      [
        item('https://www.sothebys.com/zh/auctions/2021/poly', '北京保利 2021冬季拍卖会 禹贡Ⅰ—盛清御瓷新风尚', 1),
        item('https://www.sothebys.com/en/auctions/2021/impressionist', "Sotheby's Impressionist Evening Sale", 2),
      ],
      porcelainPack,
    );

    expect(candidates.map((candidate) => candidate.url)).toEqual([
      'https://www.sothebys.com/en/auctions/2021/impressionist',
    ]);
    expect(rejected[0]?.reason).toContain('北京保利');
  });

  it('普通英文词不触发：heritage / council 不算点名别家拍行', () => {
    const { candidates, rejected } = filterAndRankCandidates(
      [
        item('https://www.sothebys.com/en/stories/cultural-heritage', 'Celebrating Chinese cultural heritage', 1),
        item('https://www.christies.com/en/stories/art-council', 'How the art council shapes collecting', 2),
      ],
      porcelainPack,
    );

    expect(rejected).toEqual([]);
    expect(candidates).toHaveLength(2);
  });

  it('拍行官网讲自己的专场不算冲突', () => {
    const { candidates, rejected } = filterAndRankCandidates(
      [item('https://www.cguardian.com/auction/2021-autumn', '中国嘉德 2021 秋季拍卖会', 1)],
      porcelainPack,
    );

    expect(rejected).toEqual([]);
    expect(candidates).toHaveLength(1);
  });
});
