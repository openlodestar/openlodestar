// src/live.test.ts
/**
 * 在线实验入口的纯函数与报告口径测试（不联网、不调模型）
 *
 * 这里只测"规划与措辞"：真实检索/抓取不可能放进单测。核心断言有两条：
 * 1. 预算估算不会把 replay 与 full 混为一谈（两者失败的含义不同）；
 * 2. 在线报告不得继续声称"全部离线"——那是离线 demo 的口径。
 */

import { describe, expect, it } from 'vitest';
import path from 'node:path';
import {
  buildClaimFailureReport,
  compareExpectations,
  detectFrozenKind,
  formatPageTiming,
  parseClaimFilter,
  planLiveRun,
  readExampleClaims,
  readExampleQuery,
  selectClaimsByIds,
  selectEvidenceByClaimIds,
  summarizePageFetches,
  type LiveCaps,
} from './live';
import { renderDemoReport, type DemoCase, type DemoLiveMeta } from './demo-report';
import type { PageFetchLog } from './lodestar/adjudicate';
import type { AnchorRecord, EvidenceRecord, RecordSummary } from './lodestar/types';

const EXAMPLE_DIR = path.resolve(import.meta.dirname, '../examples/poly-2021-autumn');

const CAPS: LiveCaps = {
  maxSearchCalls: 3,
  maxPages: 4,
  numResultsPerQuery: 8,
  maxRecords: 4,
};

function summaryOf(recordId: string, gate: RecordSummary['gate']): RecordSummary {
  return {
    recordId,
    queryId: 'q-test',
    fieldClaimIds: [],
    keyClaimIds: [],
    gate,
    cooccurringEvidenceIds: [],
    reason: 'test',
    asOf: '2026-10-29T00:00:00.000Z',
  };
}

function anchorOf(recordId: string, grade: AnchorRecord['anchorGrade']): AnchorRecord {
  return {
    recordId,
    query: 'q-test',
    fields: {},
    anchorGrade: grade,
    evidenceGrade: grade === 'strong' ? 'E2' : 'E1',
    searchPhrases: [],
    sourceUrls: ['https://example.com/x'],
    categoryTags: [],
    footprintRef: 'test',
    traceId: 'trace-test',
    asOf: '2026-10-29T00:00:00.000Z',
    stale: false,
  };
}

/** pages 模式只读 claimId 与 url，其余字段按底稿形状补齐即可 */
function evidenceOf(claimId: string, url: string): EvidenceRecord {
  return {
    evidenceId: `${claimId}::${url}`,
    claimId,
    url,
    domain: new URL(url).hostname,
    sourceFamily: new URL(url).hostname,
    tier: 'official',
    quote: '北京保利2021年秋季拍卖会',
    relation: 'irrelevant',
    contentWeight: 1,
    fetchedBy: 'lodestar',
    fetchedAt: '2026-10-29T00:00:00.000Z',
    snapshotRef: `snapshots/${claimId}.txt`,
    traceId: 'trace-test',
    fieldKey: 'sessionName',
    recordId: 'rec-a',
  };
}

function liveMeta(checks: DemoLiveMeta['expectationChecks']): DemoLiveMeta {
  return {
    mode: 'replay',
    provider: 'llm-web',
    caps: { maxSearchCalls: 3, maxPages: 4, numResultsPerQuery: 8 },
    startedAt: '2026-10-29T00:00:00.000Z',
    finishedAt: '2026-10-29T00:10:00.000Z',
    command: 'npx tsx --env-file=.env src/cli.ts live --mode replay',
    expectationChecks: checks,
    notes: ['预期来自冻结案例卡'],
  };
}

describe('live 规划', () => {
  it('replay 只估检索/抓取，不把提问环算进去', () => {
    const plan = planLiveRun({ mode: 'replay', claimCount: 13, recordCount: 4, caps: CAPS });
    expect(plan.modes).toEqual(['replay']);
    expect(plan.estimates).toHaveLength(1);
    const estimate = plan.estimates[0]!;
    expect(estimate.intakeCalls).toBe(0);
    expect(estimate.searchCalls).toBe(4 * 3 * 2 + 4);
    expect(estimate.pages).toBe(13 * 4);
    expect(estimate.compares).toBe(52);
  });

  it('both 产出两段独立估算；full 的断言数按记录上限 × 3 个关键字段推', () => {
    const plan = planLiveRun({ mode: 'both', claimCount: 13, recordCount: 4, caps: CAPS });
    expect(plan.modes).toEqual(['replay', 'full']);
    const full = plan.estimates.find((estimate) => estimate.mode === 'full');
    expect(full).toBeDefined();
    expect(full!.records).toBe(4);
    expect(full!.claims).toBe(12);
    expect(full!.intakeCalls).toBe(4);
  });

  it('pages 不跑模型，也不产生 replay/full 估算', () => {
    const plan = planLiveRun({ mode: 'pages', claimCount: 13, recordCount: 4, caps: CAPS });
    expect(plan.modes).toEqual([]);
    expect(plan.pagesOnly).toBe(true);
    expect(plan.estimates).toEqual([]);
  });
});

describe('与离线预期的对照', () => {
  it('门禁与坐标都相同才算一致', () => {
    const checks = compareExpectations(
      [
        { recordId: 'rec-a', gate: 'strong', anchor: 'strong', story: '' },
        { recordId: 'rec-b', gate: 'weak', anchor: 'weak', story: '' },
        { recordId: 'rec-c', gate: 'rejected', anchor: null, story: '' },
      ],
      [summaryOf('rec-a', 'strong'), summaryOf('rec-b', 'rejected'), summaryOf('rec-c', 'rejected')],
      [anchorOf('rec-a', 'strong'), anchorOf('rec-b', 'weak')],
    );
    expect(checks.map((check) => check.ok)).toEqual([true, false, true]);
    expect(checks[0]!.actual).toContain('坐标 strong');
    expect(checks[1]!.actual).toContain('拒收');
  });
});

describe('在线报告口径', () => {
  it('有 liveMeta 时不再声称离线，并渲染预期对照', () => {
    const caseMeta: DemoCase = {
      id: 'live-replay',
      title: '测试案例 · 在线重放实验',
      subtitle: '同一批断言重新检索',
      query: '测试提问',
      capturedAt: '2026-10-29',
      summary: '本次在线运行留下 1 条记录。',
      sources: [],
      expectations: [],
      notProven: [],
      limitations: ['在线结果依赖当天网络'],
    };
    const html = renderDemoReport({
      exampleName: 'poly-2021-autumn',
      fixtureDir: EXAMPLE_DIR,
      workDir: 'C:/tmp/live/replay',
      query: '测试提问',
      caseMeta,
      fields: [],
      claims: [],
      evidence: [],
      verdicts: [],
      summaries: [summaryOf('rec-a', 'strong')],
      anchors: [anchorOf('rec-a', 'strong')],
      guard: { total: 0, verbatimOk: 0, clueOk: 0, violations: [], clueUnverifiable: [] },
      generatedAt: '2026-10-29T00:10:00.000Z',
      liveMeta: liveMeta([
        { recordId: 'rec-a', expected: '强档（strong） / 坐标 strong', actual: '强档（strong） / 坐标 strong', ok: true },
      ]),
    });

    expect(html).toContain('live run · replay');
    expect(html).toContain('与离线底稿的对照');
    expect(html).toContain('检索提供者');
    expect(html).not.toContain('offline evidence rebuild');
    expect(html).not.toContain('以上命令全部离线');
    expect(html).toContain('重跑未必得到同一批页面');
  });
});

describe('冻结示例读取', () => {
  it('13 条断言、4 条记录，提问原文可读', async () => {
    const claims = await readExampleClaims(EXAMPLE_DIR);
    expect(claims).toHaveLength(13);
    expect(new Set(claims.map((claim) => claim.recordId)).size).toBe(4);
    expect(await readExampleQuery(EXAMPLE_DIR)).toContain('北京保利2021年秋季拍卖会');
  });
});

describe('冻结快照的种类', () => {
  it('首行标了节选的按节选处理，没标的按全文处理', () => {
    expect(detectFrozenKind('【节选·非全文】\n来源：某处\n正文……')).toBe('excerpt');
    expect(detectFrozenKind('【节选·非全文】')).toBe('excerpt');
    expect(detectFrozenKind('  雅昌快讯｜标题\n正文……')).toBe('full');
    expect(detectFrozenKind('')).toBe('full');
    expect(detectFrozenKind(null)).toBeNull();
  });

  it('真实案例的四份快照都带节选标记', async () => {
    const fs = await import('node:fs/promises');
    const dir = path.join(EXAMPLE_DIR, 'snapshots');
    const files = (await fs.readdir(dir)).filter((name) => name.endsWith('.txt'));
    expect(files).toHaveLength(4);
    for (const file of files) {
      const text = await fs.readFile(path.join(dir, file), 'utf8');
      expect(detectFrozenKind(text), file).toBe('excerpt');
    }
  });
});

describe('--claim 只重放点名的断言', () => {
  it('逗号与空白都算分隔符，重复的号只留一次', () => {
    expect(parseClaimFilter('cl-1, cl-2  cl-3;cl-1')).toEqual(['cl-1', 'cl-2', 'cl-3']);
    expect(parseClaimFilter('   ')).toEqual([]);
  });

  it('冻结底稿里取子集；点了不存在的号要单列出来，不许静默跑出 0 条', async () => {
    const claims = await readExampleClaims(EXAMPLE_DIR);
    const first = claims[0]!.claimId;
    const second = claims[1]!.claimId;

    const picked = selectClaimsByIds(claims, [first, second]);
    expect(picked.selected.map((claim) => claim.claimId)).toEqual([first, second]);
    expect(picked.missing).toEqual([]);
    // 没点 = 全量：空过滤器不该把这场变成"0 条断言"
    expect(selectClaimsByIds(claims, []).selected).toHaveLength(claims.length);

    // 拼错的号必须被点名：静默的 0 条会被读成"这条断言没结论"
    const withTypo = selectClaimsByIds(claims, [first, 'cl-does-not-exist']);
    expect(withTypo.selected).toHaveLength(1);
    expect(withTypo.missing).toEqual(['cl-does-not-exist']);
  });

  it('pages 模式按 claimId 只重抓对应的证据行', () => {
    const rows = [
      evidenceOf('cl-a', 'https://a.test/1'),
      evidenceOf('cl-b', 'https://b.test/1'),
      evidenceOf('cl-a', 'https://a.test/2'),
    ];
    expect(selectEvidenceByClaimIds(rows, [])).toHaveLength(3);
    expect(selectEvidenceByClaimIds(rows, ['cl-a']).map((row) => row.url)).toEqual([
      'https://a.test/1',
      'https://a.test/2',
    ]);
  });
});

describe('抓取耗时读数', () => {
  const logs: PageFetchLog[] = [
    { url: 'https://a.test/1', path: 'fetch', durationMs: 1_000 },
    { url: 'https://a.test/2', path: 'fetch', durationMs: 3_000 },
    { url: 'https://js.test/1', path: 'browser', durationMs: 25_000 },
    { url: 'https://js.test/2', path: 'browser', durationMs: 5_000 },
    { url: 'https://a.test/1', path: 'cache', durationMs: 0 },
    { url: 'https://dead.test/1', path: 'failed', durationMs: 20_000, reason: '抓回空页面' },
  ];

  it('按通路分行：中位 / 最长 / 合计，合计大的排前面；复用页不进任何耗时合计', () => {
    const timing = summarizePageFetches(logs, { wallMs: 60_000 });
    expect(timing.attempts).toBe(6);
    expect(timing.fetched).toBe(4);
    expect(timing.cached).toBe(1);
    expect(timing.failed).toBe(1);
    expect(timing.fetchedTotalMs).toBe(34_000);
    // 白等的那 20 秒单列：它没产出证据，但确实是花掉的时间
    expect(timing.failedTotalMs).toBe(20_000);
    expect(timing.byPath.map((row) => row.path)).toEqual(['browser', 'failed', 'fetch', 'cache']);
    expect(timing.byPath.find((row) => row.path === 'browser')).toMatchObject({
      attempts: 2,
      medianMs: 15_000,
      maxMs: 25_000,
      totalMs: 30_000,
    });
    expect(timing.byPath.find((row) => row.path === 'cache')!.totalMs).toBe(0);
  });

  it('最慢的几页带通路中文名：终端与报告说的是同一套话', () => {
    const timing = summarizePageFetches(logs, { wallMs: 60_000, slowestCount: 2 });
    expect(timing.slowest.map((item) => item.url)).toEqual(['https://js.test/1', 'https://dead.test/1']);
    expect(timing.slowest[0]!.label).toBe('浏览器渲染');
    expect(timing.slowest[1]!.label).toBe('没抓到');
  });

  it('一场零页时出"零页"汇总而不是崩掉', () => {
    const timing = summarizePageFetches([], { wallMs: 1_000 });
    expect(timing).toMatchObject({ attempts: 0, fetched: 0, failed: 0, byPath: [], slowest: [] });
    expect(timing.fetchedTotalMs).toBe(0);
  });

  it('终端那一行同时报出白等掉的秒数', () => {
    const line = formatPageTiming(summarizePageFetches(logs, { wallMs: 60_000 }));
    expect(line).toContain('failed 1');
    expect(line).toContain('20.0s');
    expect(line).toContain('slowest 25.0s');
  });

  it('full 模式没有对照表，耗时一节与说明照样出现在报告里', () => {
    const caseMeta: DemoCase = {
      id: 'live-full',
      title: '测试案例 · 在线全链路实验',
      subtitle: '模型重新列场次',
      query: '测试提问',
      capturedAt: '2026-11-02',
      summary: '本次在线运行留下 0 条记录。',
      sources: [],
      expectations: [],
      notProven: [],
      limitations: ['在线结果依赖当天网络'],
    };
    const html = renderDemoReport({
      exampleName: 'poly-2021-autumn',
      fixtureDir: EXAMPLE_DIR,
      workDir: 'C:/tmp/live/full',
      query: '测试提问',
      caseMeta,
      fields: [],
      claims: [],
      evidence: [],
      verdicts: [],
      summaries: [],
      anchors: [],
      guard: { total: 0, verbatimOk: 0, clueOk: 0, violations: [], clueUnverifiable: [] },
      generatedAt: '2026-11-02T00:10:00.000Z',
      liveMeta: {
        ...liveMeta([]),
        mode: 'full',
        notes: ['本场被时间护栏收手：跳过 2 条断言，记为 paused。'],
        pageTiming: summarizePageFetches(logs, { wallMs: 60_000 }),
      },
    });

    expect(html).toContain('这一场的时间花在哪');
    expect(html).toContain('浏览器渲染');
    expect(html).toContain('白等掉的合计');
    // 说明原来只随"与离线底稿的对照"渲染，full 模式没有那张表就会整段丢掉
    expect(html).toContain('本场被时间护栏收手');
  });
});

describe('逐条失败的 run-error.json', () => {
  it('单条断言失败的理由汇成一份可翻的账，且不含任何密钥', () => {
    const report = buildClaimFailureReport({
      mode: 'replay',
      provider: 'serper',
      caps: { ...CAPS },
      guards: { infraBreakerThreshold: 3 },
      startedAt: '2026-11-02T00:00:00.000Z',
      finishedAt: '2026-11-02T00:12:00.000Z',
      command: 'npx tsx src/cli.ts live --mode replay',
      failures: [
        { claimId: 'cl-1', recordId: 'rec-a', fieldKey: 'sessionName', assertion: '北京保利2021年举办禹贡Ⅰ专场', reason: '搜索提供者 503' },
        { claimId: 'cl-2', assertion: '北京保利2021年举办禹贡Ⅱ专场', reason: 'fetch failed' },
      ],
    });

    expect(report.kind).toBe('claim-failures');
    expect(report.failedClaims).toBe(2);
    expect(report.claims[0]!.reason).toBe('搜索提供者 503');
    // 第二行没有 recordId/fieldKey：不许凭空补一个空串进去，读的人会被骗
    expect('recordId' in report.claims[1]!).toBe(false);
    // 这份东西是给人贴进 issue 的：整份 JSON 里不能出现任何密钥字样的内容
    expect(JSON.stringify(report)).not.toMatch(/api[_-]?key|Bearer/i);
  });
});
