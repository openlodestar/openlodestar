// src/lodestar/branch-landing.test.ts
/**
 * 断言类型分支的端到端落点（离线：检索提供者换成冻结桩，翻译与拆分用假件）
 *
 * 为什么要这一份：冻结语料里的 39 条断言全是"某拍行某年举办某专场"这一类，
 * 路由的另外五个分支（物品级个体断言 / 聚合统计 / 未来事件 / 自指 / 主观评价）
 * 只有策略包层的单测，没有一条走完"入库 → 路由 → 检索（或拒收）"。
 *
 * 这份测试喂的是**外部提交**渠道（`externalClaimToRecord` + `runQuery('', ...)`）：
 * 外部提交不经过提问环的预筛，落点从路由开始——这是渠道设计，不是漏了一步。
 *
 * 每个样本都真跑一遍 `runQuery`，并记下实际花掉的检索次数。
 * 检索段是冻结桩（`frozen-stub`，永远返回空结果）；翻译桩固定失败 → 只跑单轨，
 * 所以 `searchCalls` 等于实际发出的查询条数。没有抓页、没有比对调用、没有联网。
 *
 * 2026-11-09 的修法：未来事件补相对年份词（有过去年份在场时按混合句放行）、
 * 主观评价与真伪判断只看命题字段（谓语＋宾语）而不是整句子串。
 * 结构判据的失效场景（提取把评价写进主语／原子句、隐晦评价没有词表词）见
 * `docs/assertion-routing-e2e.md`，不要把那几类当成"规则保证能拦住"。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClaimRecord, VerdictRecord } from './types';
import type { LodestarStore } from './storage/adapter';
import { externalClaimToRecord } from './intake/atomize';
import { runQuery } from './engine';
import porcelainPack from './packs/porcelain';

const { searchMock, invokeMock } = vi.hoisted(() => ({
  searchMock: vi.fn(async (queries: string[], _options?: { numResults?: number; language?: string }) => ({
    results: [] as Array<{ url: string; title: string; snippet: string; position: number; queryIndex: number }>,
  })),
  invokeMock: vi.fn(
    async (
      _role: string,
      _messages: Array<{ role: string; content: string }>,
      _options?: unknown,
    ): Promise<{ content: string; model: string; isCacheHit: boolean }> => ({
      content: '[]',
      model: 'mock-model',
      isCacheHit: false,
    }),
  ),
}));

vi.mock('../integrations/search-providers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../integrations/search-providers')>();
  return {
    ...actual,
    createSearchProvider: () => ({
      name: 'frozen-stub',
      capabilities: { siteOperator: true },
      search: searchMock,
    }),
    getSearchProviderFromEnv: () => 'frozen-stub',
  };
});

// 翻译桩固定失败：检索退回单轨，searchCalls 就是查询条数，读数不受翻译轨干扰
vi.mock('../services/query-translation', () => ({
  translateQueries: vi.fn(async () => ({ queries: [], cacheHit: false, model: '', failed: true })),
}));

vi.mock('../llm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../llm')>();
  return { ...actual, invokeLLM: invokeMock, getRoleModelName: vi.fn(() => 'mock-model') };
});

vi.mock('./trace-log', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./trace-log')>();
  return { ...actual, recordLodestarTrace: vi.fn(async () => undefined) };
});

/** 去掉浏览器要求：本文件只测路由与落点，不跑环境探针 */
const offlinePack = { ...porcelainPack, requirements: undefined };

/** 内存版底稿：形状与文件后端一致，测试结束即弃 */
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

/** 一句真实越界说法（不带记录容器，单条送查） */
interface Sample {
  text: string;
  subject: string;
  predicate: string;
  object: string;
}

async function runOneSample(sample: Sample): Promise<{
  store: LodestarStore;
  result: Awaited<ReturnType<typeof runQuery>>;
}> {
  const store = memoryStore();
  const claim = externalClaimToRecord({
    rawText: sample.text,
    atomicText: sample.text,
    subject: sample.subject,
    predicate: sample.predicate,
    object: sample.object,
    pack: offlinePack,
    queryId: 'q-branch-landing',
  });
  const result = await runQuery('', {
    pack: offlinePack,
    store,
    externalClaims: [claim],
    queryLabel: '分支落点样本',
  });
  return { store, result };
}

async function claimsOf(store: LodestarStore): Promise<ClaimRecord[]> {
  return store.query<ClaimRecord>('claims');
}

async function verdictsOf(store: LodestarStore): Promise<VerdictRecord[]> {
  return store.query<VerdictRecord>('verdicts');
}

beforeEach(() => {
  searchMock.mockClear();
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({ content: '[]', model: 'mock-model', isCacheHit: false });
});

describe('分支落点：物品级个体断言', () => {
  it('「这件…值 12 万」整条拒收，一次检索都不花', async () => {
    const { store, result } = await runOneSample({
      text: '这件青花缠枝莲纹赏瓶值 12 万元',
      subject: '青花缠枝莲纹赏瓶',
      predicate: '落槌价',
      object: '12 万元',
    });

    const [claim] = await claimsOf(store);
    expect(claim?.routing).toMatchObject({ route: 'reject', mode: 'L5', reason: 'object-level-individual-assertion' });
    expect(claim?.state).toBe('rejected');
    expect(await verdictsOf(store)).toHaveLength(0);
    expect(result.stats.searchCalls).toBe(0);
    expect(searchMock).not.toHaveBeenCalled();
  });
});

describe('分支落点：聚合统计', () => {
  it('「成交率 82%」先拆一层：父不花检索，子按可核断言真花 4 次', async () => {
    invokeMock.mockResolvedValueOnce({
      content: JSON.stringify([
        {
          atomicText: '中国嘉德于2021年11月举办秋季瓷器专场',
          subject: '中国嘉德',
          predicate: '专场举办',
          object: '秋季瓷器专场',
          timeFrom: '2021-11-01',
          timeTo: '2021-11-30',
        },
      ]),
      model: 'mock-model',
      isCacheHit: false,
    });

    const { store, result } = await runOneSample({
      text: '中国嘉德2021年秋季拍卖会瓷器专场成交率为 82%',
      subject: '中国嘉德',
      predicate: '成交率',
      object: '82%',
    });

    const claims = await claimsOf(store);
    const parent = claims.find((claim) => claim.atomicText.includes('82%'));
    const child = claims.find((claim) => claim.atomicText === '中国嘉德于2021年11月举办秋季瓷器专场');

    expect(parent?.routing).toMatchObject({ route: 'decompose', mode: 'L3', reason: 'aggregate-statistic' });
    expect(parent?.state).toBe('verifying');
    expect(child?.routing).toMatchObject({ route: 'verify' });
    expect(child?.state).toBe('adjudicated');
    // 父断言自己不检索；子断言按"主体 + 客体 / 原句 / 两条站内定向"发 4 条
    expect(result.stats.searchCalls).toBe(4);
    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(searchMock.mock.calls[0]?.[0]).toHaveLength(4);
    expect(await verdictsOf(store)).toHaveLength(1);
  });
});

describe('分支落点：未来事件', () => {
  it('写明年份的未来事件当场拒收，不花检索', async () => {
    const futureYear = new Date().getFullYear() + 2;
    const { store, result } = await runOneSample({
      text: `中国嘉德${futureYear}年将举办秋季瓷器专场`,
      subject: '中国嘉德',
      predicate: '专场举办',
      object: '秋季瓷器专场',
    });

    const [claim] = await claimsOf(store);
    expect(claim?.routing).toMatchObject({ route: 'reject', reason: 'future-event' });
    expect(claim?.state).toBe('rejected');
    expect(result.stats.searchCalls).toBe(0);
    expect(searchMock).not.toHaveBeenCalled();
  });

  it('「明年将办」按相对年份拒收，不花检索', async () => {
    const { store, result } = await runOneSample({
      text: '中国嘉德明年将举办秋季瓷器专场',
      subject: '中国嘉德',
      predicate: '专场举办',
      object: '秋季瓷器专场',
    });

    const [claim] = await claimsOf(store);
    expect(claim?.routing).toMatchObject({ route: 'reject', reason: 'future-event' });
    expect(claim?.state).toBe('rejected');
    expect(result.stats.searchCalls).toBe(0);
    expect(searchMock).not.toHaveBeenCalled();
  });
});

describe('分支落点：自指', () => {
  it('「我的训练数据…」整条拒收，不花检索', async () => {
    const { store, result } = await runOneSample({
      text: '我的训练数据里记得这场瓷器专场',
      subject: '我',
      predicate: '记忆来源',
      object: '这场瓷器专场',
    });

    const [claim] = await claimsOf(store);
    expect(claim?.routing).toMatchObject({ route: 'reject', reason: 'self-referential' });
    expect(claim?.state).toBe('rejected');
    expect(result.stats.searchCalls).toBe(0);
    expect(searchMock).not.toHaveBeenCalled();
  });
});

describe('分支落点：主观评价', () => {
  it('命中策略包词表的评语整条拒收，不花检索', async () => {
    const { store, result } = await runOneSample({
      text: '这场瓷器专场极具价值',
      subject: '这场瓷器专场',
      predicate: '评价',
      object: '极具价值',
    });

    const [claim] = await claimsOf(store);
    expect(claim?.routing).toMatchObject({ route: 'reject', reason: 'subjective-value' });
    expect(claim?.state).toBe('rejected');
    expect(result.stats.searchCalls).toBe(0);
    expect(searchMock).not.toHaveBeenCalled();
  });

  it('「我认为这是真品」按真伪判断拒收，不花检索', async () => {
    const { store, result } = await runOneSample({
      text: '我认为这是真品',
      subject: '我',
      predicate: '真伪判断',
      object: '真品',
    });

    const [claim] = await claimsOf(store);
    expect(claim?.routing).toMatchObject({ route: 'reject', reason: 'subjective-value' });
    expect(claim?.state).toBe('rejected');
    expect(result.stats.searchCalls).toBe(0);
    expect(searchMock).not.toHaveBeenCalled();
  });
});

describe('两个方向的错：漏判已收口（可核部分不再被整条丢掉）', () => {
  it('句尾带「值得收藏」的可核断言照常送核，花 4 次检索', async () => {
    const { store, result } = await runOneSample({
      text: '中国嘉德2021年秋季拍卖会瓷器专场推出多件值得收藏的官窑重器',
      subject: '中国嘉德',
      predicate: '专场内容',
      object: '官窑重器',
    });

    const [claim] = await claimsOf(store);
    // 评价词只在原子句里、不在命题字段里：按命题结构判，整句不再是"主观评价"
    expect(claim?.routing).toMatchObject({ route: 'verify' });
    expect(claim?.state).toBe('adjudicated');
    expect(result.stats.searchCalls).toBe(4);
    expect(await verdictsOf(store)).toHaveLength(1);
  });
});

describe('对照：正常可核断言的基线', () => {
  it('「某机构某年某月办过某专场」落 verify，花 4 次检索并出裁决', async () => {
    const { store, result } = await runOneSample({
      text: '中国嘉德2021年秋季拍卖会瓷器专场于2021年11月13日举办',
      subject: '中国嘉德',
      predicate: '专场举办',
      object: '秋季瓷器专场',
    });

    const [claim] = await claimsOf(store);
    expect(claim?.routing).toMatchObject({ route: 'verify' });
    expect(claim?.state).toBe('adjudicated');
    expect(result.stats.searchCalls).toBe(4);
    expect(await verdictsOf(store)).toHaveLength(1);
  });
});
