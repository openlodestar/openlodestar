// src/lodestar/adjudicate/retrieval.test.ts
/**
 * Lodestar 证据检索的双语双轨测试（引擎不依赖宿主线上进程）
 *
 * 断言检索编排把源轨与反向轨**两条都发出去**（各带对的语言参数），合流按归一化
 * URL 去重、按轨轮转；翻译失败时退回单轨，断言不因此失败。
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

vi.mock('@src/integrations/search-providers', () => ({
  createSearchProvider: () => ({
    name: 'fake',
    ...(providerState.siteOperator === undefined
      ? {}
      : { capabilities: { siteOperator: providerState.siteOperator } }),
    search: searchMock,
  }),
  getSearchProviderFromEnv: () => 'fake',
}));

vi.mock('@src/services/query-translation', () => ({ translateQueries: translateMock }));

import { buildEvidenceQueries, buildRecordQueries, retrieveCandidates } from './retrieval';
import { NO_ABLATIONS } from '@src/ablation';
import porcelainPack from '../packs/porcelain';
import type { ClaimRecord } from '../types';
import { createLogger } from '@src/utils/logger';

const logger = createLogger({ prefix: '[retrieval-test] ' });

const ZH_QUERY = '中国嘉德（香港） 2024年4月';
const EN_QUERY = 'China Guardian (Hong Kong) April 2024';

/** 造一条搜索结果 */
function hit(url: string, position: number) {
  return { url, title: `T${position}`, snippet: '', position, queryIndex: 0 };
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
    ablations: NO_ABLATIONS,
    logger,
    prebuiltQueries: [ZH_QUERY],
  };
}

beforeEach(() => {
  searchMock.mockReset();
  translateMock.mockReset();
  providerState.siteOperator = true;
  searchMock.mockResolvedValue({ results: [], rawResponse: {} });
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

describe('retrieveCandidates — 双语双轨', () => {
  it('两轨都发出：源轨 zh-cn ＋ 反向轨 en，searchCalls 记两轨之和', async () => {
    translateMock.mockResolvedValue({ queries: [EN_QUERY], cacheHit: false, model: 'fake', failed: false });

    const result = await retrieveCandidates(baseInput());

    expect(translateMock).toHaveBeenCalledWith([ZH_QUERY], 'en', expect.anything());
    expect(searchMock).toHaveBeenCalledTimes(2);
    expect(searchMock).toHaveBeenCalledWith([ZH_QUERY], expect.objectContaining({ language: 'zh-cn' }));
    expect(searchMock).toHaveBeenCalledWith([EN_QUERY], expect.objectContaining({ language: 'en' }));
    expect(result.searchCalls).toBe(2);
    expect(result.queries).toEqual([ZH_QUERY]);
  });

  it('合流：跨轨同一页（带 fragment / 追踪参数）只留一条，两轨候选都进池', async () => {
    translateMock.mockResolvedValue({ queries: [EN_QUERY], cacheHit: false, model: 'fake', failed: false });
    const page = 'https://www.cguardian.com/aucenter/lot/123';
    searchMock
      .mockResolvedValueOnce({ results: [hit(page, 1)], rawResponse: {} })
      .mockResolvedValueOnce({
        results: [hit(`${page}?utm_source=newsletter#top`, 1), hit('https://www.sothebys.com/auction/9', 2)],
        rawResponse: {},
      });

    const result = await retrieveCandidates(baseInput());

    expect(result.candidates.map((c) => c.url).sort()).toEqual([
      page,
      'https://www.sothebys.com/auction/9',
    ]);
  });

  it('翻译整体失败 → 退回单轨（只发源轨，searchCalls 不翻倍）', async () => {
    translateMock.mockResolvedValue({ queries: [], cacheHit: false, model: '', failed: true });

    const result = await retrieveCandidates(baseInput());

    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(searchMock).toHaveBeenCalledWith([ZH_QUERY], expect.objectContaining({ language: 'zh-cn' }));
    expect(result.searchCalls).toBe(1);
  });

  it('查询集为空时不触发翻译与检索（保留既有跳过语义）', async () => {
    const result = await retrieveCandidates({ ...baseInput(), prebuiltQueries: [] });

    expect(result.searchCalls).toBe(0);
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
