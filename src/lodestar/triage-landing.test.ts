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
 * 重点看**误杀**：按「被拦的句子若漏过去，路由会怎么处理」判定——路由会送核
 * 却被打回才算误杀；路由同样拒的只是提前拒。两类「该核却被拒」的样本单独成节，
 * 并测出「若放行要花多少检索」，用来区分「预算取舍」与「真误杀」。
 * 逐条分析见 `docs/triage-landing.md`。
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
  /** 放行后落到底稿里的路由结论（atomicText → 「route:reason」） */
  routingOf: Map<string, string>;
  /** 被拒断言若绕过预筛，路由会把它们放到哪 */
  counterfactualRoutingOf: Map<string, string>;
  /** 具体化追问实际补回的字段数（0 = 追问过但没补到东西） */
  concretizedFields: number;
  /** 本轮模型调用次数：3 轮复问 + 追问次数 */
  modelCalls: number;
}

/** 底稿里的 claims 翻成「路由结论」表 */
async function routingMap(store: LodestarStore): Promise<Map<string, string>> {
  const rows = await store.query<ClaimRecord>('claims');
  const map = new Map<string, string>();
  for (const row of rows) {
    const label = row.routing ? `${row.routing.route}:${row.routing.reason}` : '未路由';
    map.set(row.atomicText, label);
  }
  return map;
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
  const modelCalls = invokeMock.mock.calls.length;

  let cost = 0;
  let adjudicated = 0;
  let routingOf = new Map<string, string>();
  if (elicitation.claims.length > 0) {
    const store = memoryStore();
    const verified = await runQuery('', {
      pack: offlinePack,
      store,
      externalClaims: elicitation.claims,
      queryLabel: sample.name,
    });
    cost = verified.stats.searchCalls;
    adjudicated = verified.verdicts.length;
    routingOf = await routingMap(store);
  }

  let counterfactualCost: number | null = null;
  let counterfactualRoutingOf = new Map<string, string>();
  if (elicitation.rejectedClaims.length > 0) {
    // 绕过预筛直接送给裁决链：只量"若放行要花多少"、落在哪，不代表这条样本判得对
    const store = memoryStore();
    const verified = await runQuery('', {
      pack: offlinePack,
      store,
      externalClaims: elicitation.rejectedClaims,
      queryLabel: `${sample.name}（若放行）`,
    });
    counterfactualCost = verified.stats.searchCalls;
    counterfactualRoutingOf = await routingMap(store);
  }

  const claimsByField = new Map<string, ClaimRecord>();
  for (const claim of [...elicitation.claims, ...elicitation.rejectedClaims]) {
    if (claim.fieldKey) claimsByField.set(claim.fieldKey, claim);
  }
  return {
    elicitation,
    cost,
    adjudicated,
    counterfactualCost,
    claimsByField,
    routingOf,
    counterfactualRoutingOf,
    concretizedFields: elicitation.stats.concretizedFields,
    modelCalls,
  };
}

function claimOf(observed: Observation, fieldKey: string): ClaimRecord {
  const claim = observed.claimsByField.get(fieldKey);
  expect(claim, `样本里没有 ${fieldKey} 字段的断言`).toBeDefined();
  return claim!;
}

function reasonOf(observed: Observation, fieldKey: string): string {
  return claimOf(observed, fieldKey).triage.reason;
}

/** 放行（或若放行）之后，这条断言在路由层的落点 */
function routeOf(observed: Observation, fieldKey: string, counterfactual = false): string {
  const claim = claimOf(observed, fieldKey);
  const map = counterfactual ? observed.counterfactualRoutingOf : observed.routingOf;
  return map.get(claim.atomicText) ?? '未路由';
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
    // 路由拦不住「这家拍卖行」（主语非空）——预筛是它唯一的闸
    expect(routeOf(observed, 'auctionHouse', true)).toMatch(/^verify:/);
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
    // 拒收不省检索：组级检索已为机构那条付过钱
    expect(observed.counterfactualCost).toBe(4);
  });
});

describe('预筛落点：字段级拒收与误杀复核（2026-11-09）', () => {
  it('缺机构但日期与专场名具体：预筛拒、路由也拒——是提前拒，不算误杀（实际 0 次、若放行 4 次）', async () => {
    const observed = await observe({
      name: '缺机构-提前拒',
      runs: stable({ dateText: '2014年5月', sessionName: '瓷器工艺品专场' }),
    });

    // 句子本身是可核的：「2014年5月举办『瓷器工艺品专场』」——
    // 只是主语槽（拍卖机构）空着，预筛把"缺主语"读成了"指代没消解"
    expect(claimOf(observed, 'dateText').atomicText).toBe('于2014年5月举办「瓷器工艺品专场」专场');
    expect(reasonOf(observed, 'dateText')).toBe('unresolvable-reference');
    expect(reasonOf(observed, 'sessionName')).toBe('unresolvable-reference');
    expect(observed.cost).toBe(0);
    expect(observed.counterfactualCost).toBe(4);
    // 漏过去也救不回来：路由对"主语为空"同样拒收。预筛在这里是提前拒，不是误杀
    expect(routeOf(observed, 'dateText', true)).toBe('reject:unresolvable-reference');
  });

  it('日期只写「秋季」：放行并标「定位信息不全」，不再整条拒收（2026-11-09 修）', async () => {
    const observed = await observe({
      name: '季节-定位不全',
      runs: stable({ auctionHouse: '中国嘉德', dateText: '秋季', sessionName: '彩瓷雅集' }),
    });

    // 日期这条不再判笼统：放行、打标记，三个关键字段一起送核
    const dateClaim = claimOf(observed, 'dateText');
    expect(dateClaim.triage.reason).toBe('specific-and-decidable');
    expect(dateClaim.triage.locatorIncomplete).toBe(true);
    // 标记只打在弱定位的那一维，机构与专场名不受牵连
    expect(claimOf(observed, 'auctionHouse').triage.locatorIncomplete).toBeUndefined();
    expect(claimOf(observed, 'sessionName').triage.locatorIncomplete).toBeUndefined();
    expect(observed.elicitation.rejectedClaims).toHaveLength(0);
    expect(observed.cost).toBe(4);
    expect(observed.adjudicated).toBe(3);
    // 没有拒收断言，也就没有"若放行"这回事
    expect(observed.counterfactualCost).toBeNull();
    expect(routeOf(observed, 'dateText')).toMatch(/^verify:/);
  });
});

describe('预筛落点：五类真实入口输入（2026-11-09）', () => {
  it('可核的完整断言：三条全放行，落在 verify，花 4 次检索', async () => {
    const observed = await observe({
      name: '完整可核',
      runs: stable({ auctionHouse: '中国嘉德', dateText: '2021年11月', sessionName: '秋季瓷器专场' }),
    });

    expect(reasonOf(observed, 'auctionHouse')).toBe('specific-and-decidable');
    expect(reasonOf(observed, 'dateText')).toBe('specific-and-decidable');
    expect(reasonOf(observed, 'sessionName')).toBe('specific-and-decidable');
    expect(observed.modelCalls).toBe(3);
    expect(observed.concretizedFields).toBe(0);
    expect(observed.cost).toBe(4);
    expect(observed.adjudicated).toBe(3);
    expect(routeOf(observed, 'auctionHouse')).toMatch(/^verify:/);
  });

  it('「那件呢」：追问一次没补到东西 → 拒收，省下 4 次检索', async () => {
    const observed = await observe({
      name: '那件呢',
      runs: [
        [{ sessionName: '那件' }],
        [{ sessionName: '那件' }],
        [{ sessionName: '那件' }],
      ],
    });

    // 三轮复问 + 一次具体化追问；追问的应答补不出机构与日期
    expect(observed.modelCalls).toBe(4);
    expect(observed.concretizedFields).toBe(0);
    expect(reasonOf(observed, 'sessionName')).toBe('unresolvable-reference');
    expect(observed.elicitation.claims).toHaveLength(0);
    expect(observed.cost).toBe(0);
    // 若放行，路由同样会拒（主语为空），但组级检索已经先花了 4 次才轮到它拒
    expect(observed.counterfactualCost).toBe(4);
    expect(routeOf(observed, 'sessionName', true)).toBe('reject:unresolvable-reference');
  });

  it('「这个值多少」：三条全判指代未消解 → 0 次；若放行会落 verify、白花 4 次', async () => {
    const observed = await observe({
      name: '这个值多少',
      runs: stable({ auctionHouse: '这个', dateText: '2021年11月', sessionName: '秋季瓷器专场' }),
    });

    expect(reasonOf(observed, 'auctionHouse')).toBe('unresolvable-reference');
    expect(reasonOf(observed, 'dateText')).toBe('unresolvable-reference');
    expect(reasonOf(observed, 'sessionName')).toBe('unresolvable-reference');
    expect(observed.cost).toBe(0);
    expect(observed.counterfactualCost).toBe(4);
    // 放行后不是"再拒一次"，而是三条都进 verify——这才是白花检索的样子
    expect(routeOf(observed, 'dateText', true)).toMatch(/^verify:/);
  });

  it('「瓷器值钱吗」：两条笼统拒收、机构那条放行，检索仍是 4 次', async () => {
    const observed = await observe({
      name: '瓷器值钱吗',
      runs: stable({ auctionHouse: '中国嘉德', dateText: '早些年', sessionName: '瓷器' }),
    });

    expect(reasonOf(observed, 'auctionHouse')).toBe('specific-and-decidable');
    expect(reasonOf(observed, 'dateText')).toBe('not-decidable-vague');
    expect(reasonOf(observed, 'sessionName')).toBe('not-decidable-vague');
    // 拒掉的两条不省检索：同一条记录的组级检索已经为放行的那条付过钱
    expect(observed.cost).toBe(4);
    expect(observed.adjudicated).toBe(1);
    expect(observed.counterfactualCost).toBe(4);
    // 漏过去不会被路由拦：这两条会被当成可核断言送 verify，换来的是"查无实据"的噪音
    expect(routeOf(observed, 'dateText', true)).toMatch(/^verify:/);
    expect(routeOf(observed, 'sessionName', true)).toMatch(/^verify:/);
  });

  it('稳定性不足（只有月份变）：日期那条按不稳定拒收，机构与专场名照常放行', async () => {
    const observed = await observe({
      name: '答案不稳定-月份',
      runs: [
        [{ auctionHouse: '中国嘉德', dateText: '2021年11月', sessionName: '秋季瓷器专场' }],
        [{ auctionHouse: '中国嘉德', dateText: '2021年12月', sessionName: '秋季瓷器专场' }],
        [{ auctionHouse: '中国嘉德', dateText: '2021年10月', sessionName: '秋季瓷器专场' }],
      ],
    });

    // 投票键下沉到月后：三个月份是三条变体、各 1 次，日期不再是稳定复现
    expect(claimOf(observed, 'dateText').triage.reason).toBe('unstable-replay');
    expect(claimOf(observed, 'dateText').provenance.stabilityHits).toBe(1);
    // 同记录里另外两维三轮一致，不替日期陪葬
    expect(reasonOf(observed, 'auctionHouse')).toBe('specific-and-decidable');
    expect(reasonOf(observed, 'sessionName')).toBe('specific-and-decidable');
    expect(observed.elicitation.claims).toHaveLength(2);
    expect(observed.cost).toBe(4);
    expect(observed.adjudicated).toBe(2);
    // 日期那条若放行：同一记录组，仍是 4 条查询，而不是多出 4 条
    expect(observed.counterfactualCost).toBe(4);
    expect(routeOf(observed, 'dateText', true)).toMatch(/^verify:/);
  });

  it('稳定性不足（专场名变了）：九条全拒，省 12 次检索', async () => {
    const observed = await observe({
      name: '答案不稳定-专场名',
      runs: [
        [{ auctionHouse: '中国嘉德', dateText: '2021年11月', sessionName: '秋季瓷器专场' }],
        [{ auctionHouse: '中国嘉德', dateText: '2021年11月', sessionName: '秋季瓷杂专场' }],
        [{ auctionHouse: '中国嘉德', dateText: '2021年11月', sessionName: '秋季古董专场' }],
      ],
    });

    expect(reasonOf(observed, 'auctionHouse')).toBe('unstable-replay');
    expect(reasonOf(observed, 'dateText')).toBe('unstable-replay');
    expect(reasonOf(observed, 'sessionName')).toBe('unstable-replay');
    expect(observed.elicitation.claims).toHaveLength(0);
    expect(observed.cost).toBe(0);
    // 三个记录 × 三条断言若放行 = 12 次
    expect(observed.counterfactualCost).toBe(12);
    // 路由拦不住它：三个互斥的专场名都会被当成可核断言送 verify
    expect(routeOf(observed, 'sessionName', true)).toMatch(/^verify:/);
  });

  it('混合句：可核三条放行，闲聊那条被路由按物品级断言拒，检索不多花', async () => {
    const observed = await observe({
      name: '混合句',
      runs: stable({
        auctionHouse: '中国嘉德',
        dateText: '2021年11月',
        sessionName: '秋季瓷器专场',
        location: '这件器型真漂亮',
      }),
    });

    expect(reasonOf(observed, 'auctionHouse')).toBe('specific-and-decidable');
    expect(reasonOf(observed, 'dateText')).toBe('specific-and-decidable');
    expect(reasonOf(observed, 'sessionName')).toBe('specific-and-decidable');
    // 闲聊被塞进了地点字段、预筛放行，但路由按"物品级个体断言"拒掉，不额外花钱
    expect(reasonOf(observed, 'location')).toBe('specific-and-decidable');
    expect(routeOf(observed, 'location')).toBe('reject:object-level-individual-assertion');
    expect(observed.cost).toBe(4);
    expect(observed.adjudicated).toBe(3);
  });
});

describe('预筛落点：对照与预算闸', () => {
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
