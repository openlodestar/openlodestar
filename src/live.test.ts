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
  compareExpectations,
  detectFrozenKind,
  planLiveRun,
  readExampleClaims,
  readExampleQuery,
  type LiveCaps,
} from './live';
import { renderDemoReport, type DemoCase, type DemoLiveMeta } from './demo-report';
import type { AnchorRecord, RecordSummary } from './lodestar/types';

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
