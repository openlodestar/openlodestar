// src/lodestar/triage-landing.test.ts
/**
 * 预筛落点表（离线：固定模型应答驱动提问环）
 *
 * 为什么要这一份：弃权值、稳定性不足、指代未消解、过于笼统这几类拒收此前只有
 * `triage.ts` 的纯函数单测，没有一条走完「模型作答 → 对齐 → 原子化 → 预筛」的整条输入链。
 * 单测能证明判据写对了，证明不了**句子进来之后实际落在哪**，更证明不了被拒的句子
 * 里有没有可核断言。
 *
 * 做法：三个措辞轮次喂同一批固定行（等价于模型稳定复现），再让放行的断言真跑一遍
 * `runQuery`，量它实际发了几次检索。检索段是 `frozen-stub`（永远返回空结果），
 * 翻译桩固定失败 → 只跑单轨，`searchCalls` 就等于实际查询条数。
 * 没有联网、没有抓页、没有 Serper。
 *
 * 重点看**误杀**：两类「该核却被拒」的样本单独成节，并测出「若放行要花多少检索」，
 * 用来区分「预算取舍」与「真误杀」。逐条分析见 `docs/triage-landing.md`。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClaimRecord } from './types';
import type { LodestarStore } from './storage/adapter';
import { elicit, type ElicitationResult } from './intake/elicitation';
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

/** 去掉浏览器要求：本文件只测预筛落点，不跑环境探针 */
const offlinePack = { ...porcelainPack, requirements: undefined };

const QUERY = '列出近五年含民间瓷器的拍卖专场';

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

/** 一个固定样本：每个元素是一轮模型作答的行；三轮指向同一场（稳定复现） */
interface FixedSample {
  name: string;
  runs: Array<Array<Record<string, string>>>;
  /** 单记录字段预算（缺省 6：让次要字段也能流到预筛，不被预算提前截走） */
  maxFieldsPerRecord?: number;
}

interface Observation {
  elicitation: ElicitationResult;
  /** 放行的断言实际花掉多少次检索（0 = 一条都没送核） */
  cost: number;
  /** 放行后真正出了裁决的断言数（证明"送核"不是只停在统计里） */
  adjudicated: number;
  /** 被预筛拒收的断言若绕过预筛要花多少次检索（null = 没有拒收断言） */
  counterfactualCost: number | null;
  claimsByField: Map<string, ClaimRecord>;
}

/** 同一行跑三轮（固定作答等价于模型稳定复现），预筛后量实际检索成本 */
async function observe(sample: FixedSample): Promise<Observation> {
  invokeMock.mockReset();
  const queue = sample.runs.map((rows) => JSON.stringify(rows));
  invokeMock.mockImplementation(async () => {
    const content = queue.shift() ?? '[]';
    return { content, model: 'mock-model', isCacheHit: false };
  });

  const elicitation = await elicit(QUERY, offlinePack, {
    stabilityRuns: sample.runs.length,
    minStabilityHits: 2,
    retrievalFallback: false,
    maxFieldsPerRecord: sample.maxFieldsPerRecord ?? 6,
  });

  let cost = 0;
  let adjudicated = 0;
  if (elicitation.claims.length > 0) {
    const verified = await runQuery('', {
      pack: offlinePack,
      store: memoryStore(),
      externalClaims: elicitation.claims,
      queryLabel: sample.name,
    });
    cost = verified.stats.searchCalls;
    adjudicated = verified.verdicts.length;
  }

  let counterfactualCost: number | null = null;
  if (elicitation.rejectedClaims.length > 0) {
    // 绕过预筛直接送给裁决链：只量"若放行要花多少"，不代表这条样本判得对
    const verified = await runQuery('', {
      pack: offlinePack,
      store: memoryStore(),
      externalClaims: elicitation.rejectedClaims,
      queryLabel: `${sample.name}（若放行）`,
    });
    counterfactualCost = verified.stats.searchCalls;
  }

  const claimsByField = new Map<string, ClaimRecord>();
  for (const claim of [...elicitation.claims, ...elicitation.rejectedClaims]) {
    if (claim.fieldKey) claimsByField.set(claim.fieldKey, claim);
  }
  return { elicitation, cost, adjudicated, counterfactualCost, claimsByField };
}

function claimOf(observed: Observation, fieldKey: string): ClaimRecord {
  const claim = observed.claimsByField.get(fieldKey);
  expect(claim, `样本里没有 ${fieldKey} 字段的断言`).toBeDefined();
  return claim!;
}

function reasonOf(observed: Observation, fieldKey: string): string {
  return claimOf(observed, fieldKey).triage.reason;
}

/** 三轮同文（稳定复现的基线行） */
function stable(rows: Record<string, string>) {
  return [[rows], [{ ...rows }], [{ ...rows }]];
}

beforeEach(() => {
  searchMock.mockClear();
});

describe('预筛落点：四类拒收', () => {
  it('弃权值「不记得」：该字段拒收，同记录的关键字段照常送核（4 次）', async () => {
    const observed = await observe({
      name: '弃权值',
      runs: stable({
        auctionHouse: '中国嘉德',
        dateText: '2021年11月',
        sessionName: '秋季瓷器专场',
        location: '不记得',
      }),
    });

    expect(reasonOf(observed, 'location')).toBe('abstained-value');
    expect(reasonOf(observed, 'auctionHouse')).toBe('specific-and-decidable');
    expect(reasonOf(observed, 'dateText')).toBe('specific-and-decidable');
    expect(reasonOf(observed, 'sessionName')).toBe('specific-and-decidable');
    expect(observed.cost).toBe(4);
    expect(observed.adjudicated).toBe(3);
  });

  it('稳定性不足：只出现一次的地点字段拒收，关键字段不受牵连', async () => {
    const observed = await observe({
      name: '稳定性不足',
      runs: [
        [{ auctionHouse: '中国嘉德', dateText: '2021年11月', sessionName: '秋季瓷器专场', location: '北京' }],
        [{ auctionHouse: '中国嘉德', dateText: '2021年11月', sessionName: '秋季瓷器专场' }],
        [{ auctionHouse: '中国嘉德', dateText: '2021年11月', sessionName: '秋季瓷器专场' }],
      ],
    });

    const location = claimOf(observed, 'location');
    expect(location.triage.reason).toBe('unstable-replay');
    expect(location.provenance.stabilityHits).toBe(1);
    expect(reasonOf(observed, 'sessionName')).toBe('specific-and-decidable');
    expect(observed.cost).toBe(4);
    expect(observed.adjudicated).toBe(3);
  });

  it('指代未消解：「这家拍卖行」当机构：三条关键字段全拒，一次检索都不花', async () => {
    const observed = await observe({
      name: '指代未消解',
      runs: stable({
        auctionHouse: '这家拍卖行',
        dateText: '2021年11月',
        sessionName: '秋季瓷器专场',
      }),
    });

    expect(reasonOf(observed, 'auctionHouse')).toBe('unresolvable-reference');
    expect(reasonOf(observed, 'dateText')).toBe('unresolvable-reference');
    expect(reasonOf(observed, 'sessionName')).toBe('unresolvable-reference');
    expect(observed.cost).toBe(0);
    expect(observed.adjudicated).toBe(0);
    // 若放行：三条关键字段共用一个记录组，仍是 4 条查询
    expect(observed.counterfactualCost).toBe(4);
  });

  it('过于笼统：「早些年 / 瓷杂」两条拒收，只有机构那条送核', async () => {
    const observed = await observe({
      name: '过于笼统',
      runs: stable({ auctionHouse: '中国嘉德', dateText: '早些年', sessionName: '瓷杂' }),
    });

    expect(reasonOf(observed, 'auctionHouse')).toBe('specific-and-decidable');
    expect(reasonOf(observed, 'dateText')).toBe('not-decidable-vague');
    expect(reasonOf(observed, 'sessionName')).toBe('not-decidable-vague');
    expect(observed.cost).toBe(4);
    expect(observed.adjudicated).toBe(1);
  });
});

describe('预筛落点：两类误杀（该核却被拒）', () => {
  it('缺机构但日期与专场名具体：全部判「指代未消解」，实际 0 次、若放行 4 次', async () => {
    const observed = await observe({
      name: '误杀-缺机构',
      runs: stable({ dateText: '2014年5月', sessionName: '瓷器工艺品专场' }),
    });

    // 句子本身是可核的：「2014年5月举办『瓷器工艺品专场』」——
    // 只是主语槽（拍卖机构）空着，预筛把"缺主语"读成了"指代没消解"
    expect(claimOf(observed, 'dateText').atomicText).toBe('于2014年5月举办「瓷器工艺品专场」专场');
    expect(reasonOf(observed, 'dateText')).toBe('unresolvable-reference');
    expect(reasonOf(observed, 'sessionName')).toBe('unresolvable-reference');
    expect(observed.cost).toBe(0);
    expect(observed.counterfactualCost).toBe(4);
  });

  it('日期只写「秋季」而专场名具体：仅日期那条被判「过于笼统」', async () => {
    const observed = await observe({
      name: '误杀-季节',
      runs: stable({ auctionHouse: '中国嘉德', dateText: '秋季', sessionName: '彩瓷雅集' }),
    });

    // 「秋季」没有四位年份、长度不足 4 → 判笼统；但同一条记录里专场名已足以定位
    expect(reasonOf(observed, 'dateText')).toBe('not-decidable-vague');
    expect(reasonOf(observed, 'auctionHouse')).toBe('specific-and-decidable');
    expect(reasonOf(observed, 'sessionName')).toBe('specific-and-decidable');
    // 检索次数与放行时相同（都是 4），代价在记录级：少了一个关键字段的裁决
    expect(observed.cost).toBe(4);
    expect(observed.counterfactualCost).toBe(4);
    expect(observed.adjudicated).toBe(2);
  });
});

describe('预筛落点：对照与预算闸', () => {
  it('对照：三条关键字段齐全且稳定 → 全部送核，出 3 条裁决', async () => {
    const observed = await observe({
      name: '对照',
      runs: stable({
        auctionHouse: '中国嘉德',
        dateText: '2021年11月',
        sessionName: '秋季瓷器专场',
      }),
    });

    expect(reasonOf(observed, 'auctionHouse')).toBe('specific-and-decidable');
    expect(reasonOf(observed, 'dateText')).toBe('specific-and-decidable');
    expect(reasonOf(observed, 'sessionName')).toBe('specific-and-decidable');
    expect(observed.cost).toBe(4);
    expect(observed.adjudicated).toBe(3);
  });

  it('超出字段预算的字段落 rejected，不会被后续预筛覆盖成放行', async () => {
    const observed = await observe({
      name: '超预算',
      maxFieldsPerRecord: 3,
      runs: stable({
        auctionHouse: '中国嘉德',
        dateText: '2021年11月',
        sessionName: '秋季瓷器专场',
        location: '北京',
      }),
    });

    expect(reasonOf(observed, 'location')).toBe('over-record-field-budget');
    expect(observed.elicitation.stats.overBudgetFields).toBe(1);
    // 只有三个关键字段送核；预算外的地点没有偷偷花检索
    expect(observed.cost).toBe(4);
    expect(observed.adjudicated).toBe(3);
  });
});
