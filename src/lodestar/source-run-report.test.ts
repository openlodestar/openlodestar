import { describe, it, expect } from 'vitest';
import {
  renderSourceRunReport,
  localStamp,
  type SourceRunReportInput,
} from './source-run-report';

const META: SourceRunReportInput['meta'] = {
  stamp: '20261025-183000',
  query: '如果要在网上查清代黄花梨躺椅的成交行情，你会打开哪些页面？',
  packId: 'porcelain',
  runs: 2,
  maxCandidates: 10,
  maxPages: 6,
  search: true,
  browser: true,
  dryRun: false,
  traceId: 'trace-1',
  elapsedMs: 12345,
};

function input(overrides: Partial<SourceRunReportInput> = {}): SourceRunReportInput {
  return {
    meta: META,
    answers: [
      {
        runIndex: 0,
        phrasing: '如果要在网上查清代黄花梨躺椅的成交行情，你会打开哪些页面？',
        rawText: '[{"机构/平台":"中国嘉德","器物主题":"黄花梨躺椅","品类":"古典家具","网址":""}]',
        note: null,
      },
    ],
    candidates: [
      {
        fields: {
          sourceName: '中国嘉德',
          topic: '黄花梨躺椅',
          period: '清代',
          material: '黄花梨',
          category: '古典家具',
        },
        url: null,
        hits: 2,
        stable: true,
      },
    ],
    searches: [
      { candidateIndex: 0, query: '中国嘉德 清代 黄花梨 黄花梨躺椅', resultCount: 8, pickedUrl: 'https://news.example.com/a' },
    ],
    probes: [
      {
        candidateIndex: 0,
        url: 'https://news.example.com/a',
        ok: true,
        fetcher: 'browser',
        detailCount: 0,
        hubLike: false,
        fetches: 2,
      },
    ],
    gates: [
      {
        candidateIndex: 0,
        gate: 'rejected',
        reason: 'no-entry:not-an-entry',
        accepted: [],
        rejectedPages: [{ url: 'https://news.example.com/a', reason: 'not-an-entry' }],
        recordId: null,
      },
    ],
    pagesFetched: 2,
    ...overrides,
  };
}

describe('来源坐标运行记录', () => {
  it('把原话、候选表、检索、抓页与门禁判定都写进一份可读记录', () => {
    const md = renderSourceRunReport(input());

    expect(md).toContain('# 来源坐标运行记录');
    expect(md).toContain('如果要在网上查清代黄花梨躺椅的成交行情，你会打开哪些页面？');
    expect(md).toContain('### 第 1 轮');
    expect(md).toContain('"机构/平台":"中国嘉德"');
    expect(md).toContain('| 1 | 中国嘉德 | 黄花梨躺椅 | 清代 | 黄花梨 | 古典家具 | （未给） | 稳定 ×2 |');
    expect(md).toContain('检索：`中国嘉德 清代 黄花梨 黄花梨躺椅`，8 条结果');
    expect(md).toContain('抓取：2 次 · browser 取回 · 详情链接 0 · 枢纽页 否');
    expect(md).toContain('判定：**拒收** — no-entry:not-an-entry');
    expect(md).toContain('拒页 https://news.example.com/a — not-an-entry');
    expect(md).toContain('强 0 · 弱 0 · 拒收 1');
    expect(md).toContain('抓取 2 页');
    expect(md).toContain('LodestarQuery_lodestar-source-anchor_trace-1.json');
  });

  it('干跑只落提问与候选，不伪造门禁结论', () => {
    const md = renderSourceRunReport(
      input({
        meta: { ...META, dryRun: true },
        searches: [],
        probes: [],
        gates: [],
        pagesFetched: 0,
      }),
    );

    expect(md).toContain('**干跑**');
    expect(md).toContain('（干跑：未检索、未抓取、未判定）');
    expect(md).toContain('- 干跑：未抓取、未判定、未写坐标');
    expect(md).toContain('干跑不写 trace');
    expect(md).not.toContain('强 0 · 弱 0');
  });

  it('强坐标带出消费命令；表格里的竖线会转义', () => {
    const md = renderSourceRunReport(
      input({
        candidates: [
          {
            fields: { sourceName: '甲|乙', topic: '黄花梨躺椅', category: '古典家具' },
            url: 'https://example.com/list',
            hits: 1,
            stable: false,
          },
        ],
        searches: [],
        probes: [],
        gates: [
          {
            candidateIndex: 0,
            gate: 'strong',
            reason: 'entry-accepted',
            accepted: ['https://example.com/list'],
            rejectedPages: [],
            recordId: 'rec-source-1',
          },
        ],
        pagesFetched: 1,
      }),
    );

    expect(md).toContain('甲\\|乙');
    expect(md).toContain('**强坐标** — entry-accepted');
    expect(md).toContain('--anchor rec-source-1');
    expect(md).toContain('强 1 · 弱 0 · 拒收 0');
  });

  it('调用失败的回答写清原因而不是留空', () => {
    const md = renderSourceRunReport(
      input({
        answers: [
          { runIndex: 0, phrasing: '问题', rawText: null, note: 'LLM 调用失败（重试一次仍无内容）' },
        ],
      }),
    );

    expect(md).toContain('（本轮无回答：LLM 调用失败（重试一次仍无内容））');
  });

  it('文件名时间戳是本地时间且固定长度', () => {
    expect(localStamp(new Date(2026, 0, 2, 3, 4, 5))).toBe('20260102-030405');
  });
});
