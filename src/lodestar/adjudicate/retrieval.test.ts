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

const { searchMock, translateMock } = vi.hoisted(() => ({
  searchMock: vi.fn(),
  translateMock: vi.fn(),
}));

vi.mock('@src/integrations/search-providers', () => ({
  createSearchProvider: () => ({ name: 'fake', search: searchMock }),
  getSearchProviderFromEnv: () => 'serper',
}));

vi.mock('@src/services/query-translation', () => ({ translateQueries: translateMock }));

import { retrieveCandidates } from './retrieval';
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
  searchMock.mockResolvedValue({ results: [], rawResponse: {} });
  translateMock.mockResolvedValue({ queries: [], cacheHit: false, model: 'fake', failed: false });
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
