// src/lodestar/adjudicate/adjudicate-claim.test.ts
/**
 * 裁决内核的预算纪律测试（离线：抓取、比对、底稿落盘全部 mock，不花钱）
 *
 * 钉住的是 2026-10-11 预算优化定下的四条口径：
 * - A1：共用检索的成本记组级账本，断言级 budget.searchCalls 从 0 起算；
 * - A2：失败/被拦的页不消耗抓取名额（pageCap 只数真读到的页）；
 * - A3：同记录断言间共享页面缓存——命中不重抓、不占 pageCap，新抓的页回写缓存；
 * - A4：检索/抓取上限可由 env 覆盖（LODESTAR_MAX_SEARCH_CALLS / LODESTAR_MAX_PAGES）。
 */

import { describe, it, expect, vi, beforeEach, afterAll, type Mock } from 'vitest';
import { NO_ABLATIONS } from '../../ablation';
import porcelainPack from '../packs/porcelain';
import type { ClaimRecord } from '../types';
import type { LodestarStore } from '../storage/adapter';
import type { CapturedPage } from './page-fetch';
import { PageFetchFailedError } from './page-fetch';
import { adjudicateClaim, defaultMaxSearchCalls, defaultMaxPages } from './index';
import type { EvidenceCandidate } from './retrieval';

vi.mock('../../llm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../llm')>();
  return { ...actual, getRoleModelName: vi.fn(() => 'mock-model') };
});

vi.mock('./retrieval', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./retrieval')>();
  return { ...actual, retrieveCandidates: vi.fn() };
});

vi.mock('./page-fetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./page-fetch')>();
  return { ...actual, captureEvidencePage: vi.fn() };
});

vi.mock('./compare', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./compare')>();
  return { ...actual, compareClaimToPage: vi.fn() };
});

vi.mock('../trace-log', () => ({ recordLodestarTrace: vi.fn() }));

import { captureEvidencePage } from './page-fetch';
import { compareClaimToPage } from './compare';

/** 内存版底稿：形状与文件后端一致，测试结束即弃 */
function memoryStore(): LodestarStore {
  const rows = new Map<string, object[]>();
  const bucket = (category: string): object[] => {
    const existing = rows.get(category);
    if (existing) return existing;
    const created: object[] = [];
    rows.set(category, created);
    return created;
  };
  const find = (category: string, id: string): object | undefined =>
    bucket(category).find((r) => (r as { id?: string }).id === id);
  return {
    fileStore: {} as LodestarStore['fileStore'],
    indexTargets: [],
    append: async (category: string, row: object) => {
      bucket(category).push(row);
    },
    get: async (category: string, id: string) => (find(category, id) as never) ?? null,
    query: async (category: string, predicate?: (row: never) => boolean) =>
      (predicate ? bucket(category).filter((r) => predicate(r as never)) : [...bucket(category)]) as never,
    allRows: async (category: string) => [...bucket(category)] as never,
    patch: async (category: string, id: string, patch: Record<string, unknown>) => {
      const row = find(category, id);
      if (!row) return null;
      Object.assign(row, patch);
      return row as never;
    },
  } as unknown as LodestarStore;
}

function claim(over: Partial<ClaimRecord> = {}): ClaimRecord {
  return {
    claimId: 'cl-20261011-test',
    queryId: 'q-1',
    recordId: 'rec-1',
    fieldRole: 'key',
    rawText: '',
    atomicText: '北京保利2021年举办「禹贡Ⅰ」专场',
    subject: '北京保利',
    predicate: '专场主题',
    object: '禹贡Ⅰ',
    timeScope: { from: '2021-01-01', to: '2021-12-31' },
    channel: 'enumerative',
    provenance: { stabilityRuns: 3, stabilityHits: 3, promptedDetail: false, selectionReason: null },
    triage: { passed: true, reason: 'specific-and-decidable' },
    state: 'verifying',
    fieldKey: 'sessionName',
    createdAt: new Date().toISOString(),
    ...over,
  };
}

function candidate(url: string, over: Partial<EvidenceCandidate> = {}): EvidenceCandidate {
  return { url, domain: new URL(url).hostname, sourceFamily: new URL(url).hostname, tier: 'official', title: '标题', position: 1, ...over };
}

function capturedPage(url: string, over: Partial<CapturedPage> = {}): CapturedPage {
  return {
    url,
    // 正文带上断言对象（禹贡Ⅰ）：瓷器包的页面预筛对不含字段值写法的页面判 no，
    // 那是真实纪律——mock 正文必须真的"提到"这场，比对才会被调用
    text: `北京保利 2021年 禹贡Ⅰ 专场拍卖 正文 ${url}`,
    snapshotRef: `snapshots/${encodeURIComponent(url)}.txt`,
    fetchedAt: new Date().toISOString(),
    strategy: 'fetch',
    ...over,
  };
}

/** 共用检索桩：默认四条查询（与缺省 searchCap 相等），两个不同域的候选 */
function sharedRetrieval(urls: string[], searchCalls = 4) {
  return { queries: ['q1', 'q2', 'q3', 'q4'].slice(0, searchCalls), candidates: urls.map((u) => candidate(u)), searchCalls, provider: 'mock' };
}

beforeEach(() => {
  (captureEvidencePage as Mock).mockReset().mockImplementation(
    async (_store: LodestarStore, evidenceId: string, url: string) => capturedPage(url, { snapshotRef: `snapshots/${evidenceId}.txt` }),
  );
  (compareClaimToPage as Mock).mockReset().mockResolvedValue({ relation: 'irrelevant', quote: '无关引文', contentWeight: 0.6 });
});

describe('A1：共用检索的断言级预算记 0', () => {
  it('组级检索量不摊到断言头上：searchCalls 为 0，组级次数另记 sharedSearchCalls', async () => {
    const result = await adjudicateClaim({
      store: memoryStore(),
      pack: porcelainPack,
      claim: claim(),
      values: { auctionHouse: '北京保利', dateText: '2021年', sessionName: '禹贡Ⅰ' },
      ablations: NO_ABLATIONS,
      runId: 'run-a1',
      traceId: 'tr-a1',
      sharedRetrieval: sharedRetrieval(['https://a.test/1', 'https://b.test/1'], 4),
    });
    expect(result.footprint?.budget.searchCalls).toBe(0);
    // 组级实发次数单独留痕：不参与本条断言的触顶判定，但读者能看出"不是没检索"
    expect(result.footprint?.budget.sharedSearchCalls).toBe(4);
    expect(result.footprint?.queries).toEqual(['q1', 'q2', 'q3', 'q4']);
  });

  it('自身检索（无共用结果）时断言级预算照实记', async () => {
    const { retrieveCandidates } = await import('./retrieval');
    (retrieveCandidates as Mock).mockResolvedValue({
      queries: ['q1', 'q2'],
      candidates: [candidate('https://a.test/1')],
      searchCalls: 2,
      provider: 'mock',
      rejected: [],
    });
    const result = await adjudicateClaim({
      store: memoryStore(),
      pack: porcelainPack,
      claim: claim(),
      values: { auctionHouse: '北京保利' },
      ablations: NO_ABLATIONS,
      runId: 'run-a1b',
      traceId: 'tr-a1b',
    });
    expect(result.footprint?.budget.searchCalls).toBe(2);
  });
});

describe('A2：失败页不消耗抓取名额', () => {
  it('抓回空的页记进 failed 但 pagesFetched 不增，后续候选照常抓满 pageCap', async () => {
    (captureEvidencePage as Mock).mockImplementation(
      async (_store: LodestarStore, evidenceId: string, url: string) => {
        if (url.includes('dead')) throw new PageFetchFailedError(url, '抓回空页面');
        return capturedPage(url, { snapshotRef: `snapshots/${evidenceId}.txt` });
      },
    );
    const result = await adjudicateClaim({
      store: memoryStore(),
      pack: porcelainPack,
      claim: claim(),
      values: { auctionHouse: '北京保利' },
      caps: { maxPages: 2 },
      ablations: NO_ABLATIONS,
      runId: 'run-a2',
      traceId: 'tr-a2',
      sharedRetrieval: sharedRetrieval([
        'https://dead.test/1',
        'https://a.test/1',
        'https://b.test/1',
        'https://c.test/1',
      ]),
    });
    // 首个候选失败不计数，后面两个成功页用满 pageCap=2，第四个候选没轮到
    expect(result.footprint?.budget.pagesFetched).toBe(2);
    expect(result.footprint?.failed).toEqual([{ url: 'https://dead.test/1', reason: '抓回空页面' }]);
    expect(result.footprint?.fetched).toHaveLength(2);
  });
});

describe('A3：同记录断言间共享页面缓存', () => {
  it('缓存命中的页不重抓、不占本条 pageCap；新抓的页回写缓存', async () => {
    const pageCache = new Map<string, CapturedPage>();
    // 上一条断言已抓过 a.test/1——本条撞见它时应直接复用
    pageCache.set('https://a.test/1', capturedPage('https://a.test/1', { snapshotRef: 'snapshots/prev.txt' }));

    const result = await adjudicateClaim({
      store: memoryStore(),
      pack: porcelainPack,
      claim: claim(),
      values: { auctionHouse: '北京保利' },
      caps: { maxPages: 1 },
      ablations: NO_ABLATIONS,
      runId: 'run-a3',
      traceId: 'tr-a3',
      sharedRetrieval: sharedRetrieval(['https://a.test/1', 'https://b.test/2']),
      sharedPageCache: pageCache,
    });
    // pageCap=1：命中缓存的 a.test/1 不占名额，b.test/2 真抓 1 页——两条都走到了比对
    expect(captureEvidencePage).toHaveBeenCalledTimes(1);
    expect(result.footprint?.budget.pagesFetched).toBe(1);
    expect(result.evidence).toHaveLength(2);
    // 复用页的快照引用指向首抓那一份（同一份字节，引文校验不受影响）
    const reused = result.evidence.find((e) => e.url === 'https://a.test/1');
    expect(reused?.snapshotRef).toBe('snapshots/prev.txt');
    // 新抓的页已回写缓存，同记录下一条断言可复用
    expect(pageCache.get('https://b.test/2')).toBeDefined();
  });
});

describe('A4：检索/抓取上限可由 env 覆盖', () => {
  const ORIGINAL_SEARCH = process.env.LODESTAR_MAX_SEARCH_CALLS;
  const ORIGINAL_PAGES = process.env.LODESTAR_MAX_PAGES;

  it('设置 env 后上限跟随，缺省回到 4/6', () => {
    process.env.LODESTAR_MAX_SEARCH_CALLS = '7';
    process.env.LODESTAR_MAX_PAGES = '11';
    expect(defaultMaxSearchCalls()).toBe(7);
    expect(defaultMaxPages()).toBe(11);

    delete process.env.LODESTAR_MAX_SEARCH_CALLS;
    delete process.env.LODESTAR_MAX_PAGES;
    expect(defaultMaxSearchCalls()).toBe(4);
    expect(defaultMaxPages()).toBe(6);
  });

  it('非法值（0 / 负数 / 非数字）不生效，落回缺省', () => {
    process.env.LODESTAR_MAX_SEARCH_CALLS = '0';
    process.env.LODESTAR_MAX_PAGES = '-3';
    expect(defaultMaxSearchCalls()).toBe(4);
    expect(defaultMaxPages()).toBe(6);
  });

  afterAll(() => {
    if (ORIGINAL_SEARCH === undefined) delete process.env.LODESTAR_MAX_SEARCH_CALLS;
    else process.env.LODESTAR_MAX_SEARCH_CALLS = ORIGINAL_SEARCH;
    if (ORIGINAL_PAGES === undefined) delete process.env.LODESTAR_MAX_PAGES;
    else process.env.LODESTAR_MAX_PAGES = ORIGINAL_PAGES;
  });
});

describe('A4：声明浏览器必备的包直接渲染证据页', () => {
  it('required 包传 forceBrowser=true；未声明的包不强制', async () => {
    await adjudicateClaim({
      store: memoryStore(),
      pack: porcelainPack,
      claim: claim(),
      values: { auctionHouse: '北京保利' },
      ablations: NO_ABLATIONS,
      runId: 'run-required-pack',
      traceId: 'tr-required-pack',
      sharedRetrieval: sharedRetrieval(['https://a.test/1']),
    });
    expect(captureEvidencePage).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      'https://a.test/1',
      { forceBrowser: true },
    );

    (captureEvidencePage as Mock).mockClear();
    const packWithoutRequirement = { ...porcelainPack, requirements: undefined };

    await adjudicateClaim({
      store: memoryStore(),
      pack: packWithoutRequirement,
      claim: claim(),
      values: { auctionHouse: '北京保利' },
      ablations: NO_ABLATIONS,
      runId: 'run-optional-pack',
      traceId: 'tr-optional-pack',
      sharedRetrieval: sharedRetrieval(['https://a.test/1']),
    });
    expect(captureEvidencePage).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      'https://a.test/1',
      { forceBrowser: false },
    );
  });
});

describe('检索足迹：被能力位跳过的查询可审计', () => {
  it('共用检索里跳过的 site: 查询进 footprint.skippedQueries', async () => {
    const result = await adjudicateClaim({
      store: memoryStore(),
      pack: porcelainPack,
      claim: claim(),
      values: { auctionHouse: '北京保利' },
      ablations: NO_ABLATIONS,
      runId: 'run-capability',
      traceId: 'tr-capability',
      sharedRetrieval: {
        ...sharedRetrieval(['https://a.test/1']),
        skippedQueries: ['site:a.test 北京保利 禹贡Ⅰ'],
      },
    });

    expect(result.footprint?.skippedQueries).toEqual(['site:a.test 北京保利 禹贡Ⅰ']);
    // 发出去的和跳过的分开记：读者能分清"查了没结果"与"这类查询压根没发"
    expect(result.footprint?.queries).toEqual(['q1', 'q2', 'q3', 'q4']);
  });

  it('没有跳过时不多写这个字段（旧底稿形状不变）', async () => {
    const result = await adjudicateClaim({
      store: memoryStore(),
      pack: porcelainPack,
      claim: claim(),
      values: { auctionHouse: '北京保利' },
      ablations: NO_ABLATIONS,
      runId: 'run-no-skip',
      traceId: 'tr-no-skip',
      sharedRetrieval: sharedRetrieval(['https://a.test/1']),
    });

    expect(result.footprint?.skippedQueries).toBeUndefined();
  });
});
