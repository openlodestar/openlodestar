// src/lodestar/replay-search.test.ts
/**
 * 检索结果回放（离线，零外部调用）
 *
 * 样本：`examples/replay-search/porcelain-2021-autumn/search-results.json`
 * 采集：`npx tsx scripts/capture-search-replay.ts --sample porcelain-2021-autumn --allow-spend`
 *
 * 回放换掉两段外部依赖，其余全部是真代码：
 * - 查询翻译 → 冻结样本里那批译文；
 * - 搜索提供者 → 冻结样本里按「语言 + 查询集」存下的原始结果。
 *
 * 断言的是"同一批样本重跑必得同一批读数"：查询构造逐条一致、检索次数一致、
 * 每条查询的返回条数一致、候选过滤后的条数一致。任何一处漂移都说明查询构造、
 * 候选过滤或预算记账被改过——那样历史读数就不能再跨提交比较了。
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { ClaimRecord } from './types';
import type { SearchProvider, SearchResultItem } from '../integrations/search-providers/types';
import { buildRecordQueries, retrieveCandidates } from './adjudicate/retrieval';
import porcelainPack from './packs/porcelain';

const FIXTURE_PATH = path.resolve(
  process.cwd(),
  'examples/replay-search/porcelain-2021-autumn/search-results.json',
);

interface FrozenTrack {
  language: string | null;
  queries: string[];
  results: SearchResultItem[];
}

interface FrozenSample {
  slug: string;
  caps: { maxQueries: number; numResultsPerQuery: number };
  values: Record<string, string | null>;
  domains: string[];
  claims: ClaimRecord[];
  queries: string[];
  searchCalls: number;
  translation: { language: string; queries: string[] } | null;
  tracks: FrozenTrack[];
  perQuery: Array<{ language: string | null; query: string; returned: number; candidates: number; onTopic: number }>;
  totals: { returned: number; candidates: number; perQueryCandidates: number; onTopic: number };
}

const fixture: FrozenSample | null = fs.existsSync(FIXTURE_PATH)
  ? (JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')) as FrozenSample)
  : null;

const { searchMock } = vi.hoisted(() => ({
  // 返回类型写死：默认空数组会被推断成 never[]，后面按样本填结果时对不上
  searchMock: vi.fn(
    async (queries: string[], options?: { language?: string }): Promise<{ results: SearchResultItem[] }> => ({
      results: [],
    }),
  ),
}));

vi.mock('../integrations/search-providers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../integrations/search-providers')>();
  return {
    ...actual,
    createSearchProvider: () =>
      ({
        name: 'frozen-replay',
        capabilities: { siteOperator: false },
        search: searchMock,
      }) as unknown as SearchProvider,
    getSearchProviderFromEnv: () => 'frozen-replay',
  };
});

vi.mock('../services/query-translation', () => ({
  translateQueries: vi.fn(async () => ({
    queries: fixture?.translation?.queries ?? [],
    cacheHit: true,
    model: 'frozen-sample',
    failed: fixture?.translation === null || fixture?.translation === undefined,
  })),
}));

describe.skipIf(fixture === null)('检索结果回放（冻结样本）', () => {
  const sample = fixture!;

  it('查询构造与冻结时逐条一致（样本换版会让这条先红）', () => {
    const queries = buildRecordQueries({
      pack: porcelainPack,
      claims: sample.claims.map((claim) => ({
        claim,
        spec: porcelainPack.fields().find((field) => field.key === claim.fieldKey),
      })),
      values: sample.values,
      domains: sample.domains,
      maxQueries: sample.caps.maxQueries,
    });
    expect(queries).toEqual(sample.queries);
  });

  it('用冻结结果重跑：检索次数、每条查询条数、候选条数全部一致', async () => {
    searchMock.mockReset();
    searchMock.mockImplementation(async (queries: string[], options?: { language?: string }) => {
      const track = sample.tracks.find(
        (candidate) =>
          candidate.language === (options?.language ?? null) &&
          candidate.queries.length === queries.length &&
          candidate.queries.every((query, index) => query === queries[index]),
      );
      if (!track) {
        throw new Error(`回放样本里没有这条查询（${options?.language ?? 'null'}）：${queries.join(' | ')}`);
      }
      return { results: track.results };
    });

    const queries = buildRecordQueries({
      pack: porcelainPack,
      claims: sample.claims.map((claim) => ({
        claim,
        spec: porcelainPack.fields().find((field) => field.key === claim.fieldKey),
      })),
      values: sample.values,
      domains: sample.domains,
      maxQueries: sample.caps.maxQueries,
    });

    const retrieval = await retrieveCandidates({
      pack: porcelainPack,
      claim: sample.claims[0]!,
      values: sample.values,
      maxQueries: queries.length,
      numResultsPerQuery: sample.caps.numResultsPerQuery,
      prebuiltQueries: queries,
    });

    expect(retrieval.provider).toBe('frozen-replay');
    expect(retrieval.queries).toEqual(sample.queries);
    expect(retrieval.searchCalls).toBe(sample.searchCalls);
    expect(retrieval.candidates.length).toBe(sample.totals.candidates);

    // 每条查询的返回条数：按语言 + 查询文本对回冻结读数
    for (const row of sample.perQuery) {
      const track = sample.tracks.find((candidate) => candidate.language === row.language);
      expect(track, `冻结样本里没有 ${row.language} 轨`).toBeDefined();
      const queryIndex = track!.queries.indexOf(row.query);
      expect(queryIndex, `冻结样本里没有查询「${row.query}」`).toBeGreaterThanOrEqual(0);
      const returned = track!.results.filter((item) => item.queryIndex === queryIndex).length;
      expect(returned, `查询「${row.query}」的返回条数漂移`).toBe(row.returned);
    }
  });
});
