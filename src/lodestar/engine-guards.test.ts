// src/lodestar/engine-guards.test.ts
/**
 * 整场时间护栏的引擎层测试（离线：裁决内核、检索、抓取、trace 全 mock，不花钱）
 *
 * 钉住 2026-11-01 在线重放归因后定下的四条口径：
 * 1. 连续 infra 空转到阈值就熔断，剩下的断言记 `paused`——**不是** not_found、也不是 failed；
 * 2. 出裁决（含 not_found）把空转计数清零，"零星失败"不会累积成熔断；
 * 3. 截止时刻到点在**组级检索之前**就停：那一发查询是计费调用；
 * 4. 需要浏览器的 `paused` 不算 infra 空转，也不清零——浏览器没装好不该熔断整场。
 *
 * 护栏只改"这场还跑不跑完"，不改任何一条断言的结论，所以四分类与门禁不在本文件覆盖范围。
 */

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { ClaimRecord } from './types';
import type { LodestarStore } from './storage/adapter';
import type { AdjudicateClaimResult, RunTimeGuards } from './adjudicate';
import { adjudicateClaim } from './adjudicate';
import { retrieveCandidates } from './adjudicate/retrieval';
import { runQuery } from './engine';

vi.mock('./adjudicate', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./adjudicate')>();
  return { ...actual, adjudicateClaim: vi.fn() };
});

vi.mock('./adjudicate/retrieval', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./adjudicate/retrieval')>();
  return { ...actual, retrieveCandidates: vi.fn() };
});

// 瓷器包声明"必须有浏览器"，真探针在 CI 上会当场停——护栏测的是收手时机，不是环境自检
vi.mock('./packs/requirements', () => ({ assertPackRequirements: vi.fn(async () => undefined) }));

vi.mock('./trace-log', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./trace-log')>();
  return { ...actual, recordLodestarTrace: vi.fn(async () => undefined) };
});

/** 内存版底稿：按各行自己的主键字段找行（真实文件后端按类别认主键，这里不必复刻那张表） */
function memoryStore(): LodestarStore {
  const rows = new Map<string, Record<string, unknown>[]>();
  const bucket = (category: string): Record<string, unknown>[] => {
    const existing = rows.get(category);
    if (existing) return existing;
    const created: Record<string, unknown>[] = [];
    rows.set(category, created);
    return created;
  };
  const idOf = (row: Record<string, unknown>): string | undefined => {
    for (const key of ['claimId', 'evidenceId', 'summaryId', 'anchorId', 'queryId', 'answerId', 'pageId', 'id']) {
      const value = row[key];
      if (typeof value === 'string') return value;
    }
    return undefined;
  };
  const find = (category: string, id: string) => bucket(category).find((row) => idOf(row) === id);
  return {
    fileStore: {} as LodestarStore['fileStore'],
    indexTargets: [],
    append: async (category: string, row: object) => {
      bucket(category).push(row as Record<string, unknown>);
    },
    get: async (category: string, id: string) => (find(category, id) as never) ?? null,
    query: async (category: string, predicate?: (row: never) => boolean) =>
      (predicate ? bucket(category).filter((row) => predicate(row as never)) : [...bucket(category)]) as never,
    allRows: async (category: string) => [...bucket(category)] as never,
    patch: async (category: string, id: string, patch: Record<string, unknown>) => {
      const row = find(category, id);
      if (!row) return null;
      Object.assign(row, patch);
      return row as never;
    },
  } as unknown as LodestarStore;
}

function claim(index: number): ClaimRecord {
  return {
    claimId: `cl-guard-${index}`,
    queryId: 'q-guard',
    recordId: `rec-guard-${index}`,
    fieldRole: 'key',
    rawText: '',
    atomicText: `北京保利2021年举办「禹贡Ⅰ」专场 ${index}`,
    subject: '北京保利',
    predicate: '专场主题',
    object: `禹贡Ⅰ ${index}`,
    timeScope: { from: '2021-01-01', to: '2021-12-31' },
    channel: 'external',
    provenance: { stabilityRuns: 1, stabilityHits: 1, promptedDetail: false, selectionReason: null },
    triage: { passed: true, reason: 'specific-and-decidable' },
    state: 'pending',
    fieldKey: 'sessionName',
    createdAt: new Date().toISOString(),
  };
}

/** 足迹桩：只有 budget 与 failed/fetched 三个数被护栏读到 */
function footprint(pagesFetched: number, failedPages: number) {
  return {
    queries: ['q1'],
    candidates: [],
    fetched: Array.from({ length: pagesFetched }, (_unused, i) => ({ url: `https://a.test/${i}`, relation: 'irrelevant' as const, pageTopic: null })),
    failed: Array.from({ length: failedPages }, (_unused, i) => ({ url: `https://b.test/${i}`, reason: 'fetch failed' })),
    rejected: [],
    budget: { searchCalls: 1, pagesFetched, searchCap: 4, pageCap: 6 },
    candidatesCovered: true,
  };
}

const infraFailed = (index: number): AdjudicateClaimResult => ({
  claim: claim(index),
  evidence: [],
  failed: '搜索提供者 503',
  footprint: footprint(0, 0),
});

const readSomePages = (index: number): AdjudicateClaimResult => ({
  claim: claim(index),
  evidence: [],
  footprint: footprint(2, 0),
});

const allFetchesFailed = (index: number): AdjudicateClaimResult => ({
  claim: claim(index),
  evidence: [],
  footprint: footprint(0, 3),
});

const needsBrowser = (index: number): AdjudicateClaimResult => ({
  claim: claim(index),
  evidence: [],
  paused: { url: 'https://js.example/1', reason: '需要浏览器' },
  footprint: footprint(0, 0),
});

function claims(count: number): ClaimRecord[] {
  return Array.from({ length: count }, (_unused, i) => claim(i + 1));
}

async function run(count: number, guards?: Partial<RunTimeGuards>) {
  const store = memoryStore();
  const result = await runQuery('', { store, externalClaims: claims(count), guards });
  return { store, result };
}

beforeEach(() => {
  (adjudicateClaim as Mock).mockReset();
  (retrieveCandidates as Mock).mockReset().mockResolvedValue({
    queries: ['q1'],
    candidates: [],
    searchCalls: 1,
    provider: 'mock',
    skippedQueries: [],
  });
  delete process.env.LODESTAR_INFRA_BREAKER;
  delete process.env.LODESTAR_DEADLINE_MINUTES;
});

describe('时间护栏：infra 熔断', () => {
  it('连续 3 条空转即收手，剩下的断言记 paused 而不是 failed', async () => {
    (adjudicateClaim as Mock).mockImplementation(async ({ claim: c }) => infraFailed(Number(c.claimId.split('-').pop())));
    const { result } = await run(6, { infraBreakerThreshold: 3 });

    expect(result.guardStopped).toBe('breaker');
    expect(adjudicateClaim).toHaveBeenCalledTimes(3);
    expect(result.guardSkippedClaimIds).toEqual(['cl-guard-4', 'cl-guard-5', 'cl-guard-6']);
    expect(result.pausedClaimIds).toEqual(result.guardSkippedClaimIds);
    expect(result.stats.claimsFailed).toBe(3);
  });

  it('抓回来的页全部没读到正文，同样算空转（与"检索抛错"同一路判据）', async () => {
    (adjudicateClaim as Mock).mockImplementation(async ({ claim: c }) => allFetchesFailed(Number(c.claimId.split('-').pop())));
    const { result } = await run(4, { infraBreakerThreshold: 2 });

    expect(result.guardStopped).toBe('breaker');
    expect(adjudicateClaim).toHaveBeenCalledTimes(2);
    expect(result.guardSkippedClaimIds).toEqual(['cl-guard-3', 'cl-guard-4']);
  });

  it('出裁决把计数清零：零星失败不累积成熔断', async () => {
    const outcomes = [infraFailed(1), infraFailed(2), readSomePages(3), infraFailed(4), infraFailed(5), readSomePages(6)];
    (adjudicateClaim as Mock).mockImplementation(async ({ claim: c }) => {
      const index = Number(c.claimId.split('-').pop());
      return outcomes[index - 1];
    });
    const { result } = await run(6, { infraBreakerThreshold: 3 });

    expect(result.guardStopped).toBeUndefined();
    expect(adjudicateClaim).toHaveBeenCalledTimes(6);
    expect(result.guardSkippedClaimIds).toEqual([]);
  });

  it('阈值 0 = 关掉熔断：再多的 infra 失败也一条条跑完', async () => {
    (adjudicateClaim as Mock).mockImplementation(async ({ claim: c }) => infraFailed(Number(c.claimId.split('-').pop())));
    const { result } = await run(4, { infraBreakerThreshold: 0 });

    expect(result.guardStopped).toBeUndefined();
    expect(adjudicateClaim).toHaveBeenCalledTimes(4);
  });

  it('需要浏览器而暂停的不算空转，也不清零——浏览器没装好不该熔断整场', async () => {
    (adjudicateClaim as Mock).mockImplementation(async ({ claim: c }) => needsBrowser(Number(c.claimId.split('-').pop())));
    const { result } = await run(4, { infraBreakerThreshold: 2 });

    expect(result.guardStopped).toBeUndefined();
    expect(adjudicateClaim).toHaveBeenCalledTimes(4);
    expect(result.pausedClaimIds).toHaveLength(4);
  });

  it('LODESTAR_INFRA_BREAKER 定的默认阈值在没传 guards 时生效', async () => {
    process.env.LODESTAR_INFRA_BREAKER = '2';
    (adjudicateClaim as Mock).mockImplementation(async ({ claim: c }) => infraFailed(Number(c.claimId.split('-').pop())));
    const { result } = await run(4, undefined);

    expect(result.guardStopped).toBe('breaker');
    expect(adjudicateClaim).toHaveBeenCalledTimes(2);
  });
});

describe('时间护栏：整场截止时刻', () => {
  it('到点就在组级检索之前停：一发查询都不花', async () => {
    (adjudicateClaim as Mock).mockResolvedValue(readSomePages(1));
    const { store, result } = await run(4, { deadlineAtMs: Date.now() - 1000 });

    expect(result.guardStopped).toBe('deadline');
    expect(adjudicateClaim).not.toHaveBeenCalled();
    expect(retrieveCandidates).not.toHaveBeenCalled();
    expect(result.guardSkippedClaimIds).toHaveLength(4);
    // 底稿里留下的是 paused，重跑按 paused/pending/failed 重新驱动时能捡回来
    const ledger = await store.query<ClaimRecord>('claims');
    expect(ledger.every((row) => row.state === 'paused')).toBe(true);
  });

  it('没设截止时照旧跑到完（护栏不该改变既有语义）', async () => {
    (adjudicateClaim as Mock).mockImplementation(async ({ claim: c }) => readSomePages(Number(c.claimId.split('-').pop())));
    const { result } = await run(3, undefined);

    expect(result.guardStopped).toBeUndefined();
    expect(result.guardSkippedClaimIds).toEqual([]);
    expect(adjudicateClaim).toHaveBeenCalledTimes(3);
  });
});
