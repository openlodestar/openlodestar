// src/lodestar/page-verification.test.ts
import { describe, expect, it } from 'vitest';
import type { LiveRecallResult } from './live-recall';
import {
  classifyFetchFailure,
  judgePageFields,
  measurePageVerification,
  type PageCheckFixture,
  type PageCheckFetched,
  type PageCheckFailed,
} from './page-verification';

function recall(rows: Array<{ query: string; urls: string[] }>): LiveRecallResult {
  return {
    slug: 'sample',
    issued: rows.length,
    hit: rows.filter((row) => row.urls.length > 0).length,
    value: 0,
    calls: rows.length,
    rows: rows.map((row) => ({
      query: row.query,
      sourceReturned: row.urls.length,
      repairQuery: null,
      repairReturned: 0,
      adjudicable: row.urls.length,
      candidateUrls: row.urls,
      hit: row.urls.length > 0,
    })),
    domainRejected: [],
    basis: 'static-self-consistency-no-fetch',
  };
}

function fetched(url: string, verified: boolean): PageCheckFetched {
  return {
    url,
    domain: 'example.com',
    status: 'fetched',
    chars: 1200,
    textHash: 'abc',
    fields: [
      { key: 'auctionHouse', value: '北京保利', verbatim: verified },
      { key: 'dateText', value: '2021年12月5日', verbatim: verified },
      { key: 'sessionName', value: '禹贡Ⅰ—盛清御瓷新风尚', verbatim: verified },
    ],
    verified,
  };
}

function failed(url: string, failure: PageCheckFailed['failure']): PageCheckFailed {
  return { url, domain: 'example.com', status: 'failed', failure, message: 'x' };
}

function fixture(checks: PageCheckFixture['checks']): PageCheckFixture {
  return {
    version: 1,
    kind: 'page-check-replay',
    slug: 'sample',
    capturedAt: '2026-11-09T00:00:00.000Z',
    policy: { maxPages: 12, perDomainGapMs: 2000, timeoutMs: 15000, allowBrowser: false },
    fields: [
      { key: 'auctionHouse', value: '北京保利' },
      { key: 'dateText', value: '2021年12月5日' },
      { key: 'sessionName', value: '禹贡Ⅰ—盛清御瓷新风尚' },
    ],
    checks,
  };
}

describe('classifyFetchFailure', () => {
  it('超时归「超时」', () => {
    expect(classifyFetchFailure(new Error('抓取超时（15000ms）：https://a.example')).kind).toBe('timeout');
  });

  it('401/403/429/451 归「被拦」', () => {
    for (const code of [401, 403, 429, 451]) {
      expect(classifyFetchFailure(new Error(`HTTP ${code}: Forbidden`)).kind).toBe('blocked');
    }
  });

  it('404/410/5xx 归「跳转死链」', () => {
    for (const code of [404, 410, 500, 503]) {
      expect(classifyFetchFailure(new Error(`HTTP ${code}: x`)).kind).toBe('dead-link');
    }
  });

  it('DNS 解析失败归「跳转死链」', () => {
    expect(classifyFetchFailure(new Error('无法解析主机名 www.nope.example：getaddrinfo ENOTFOUND')).kind).toBe(
      'dead-link',
    );
  });

  it('不安全地址单独一档，不混进「被拦」', () => {
    expect(classifyFetchFailure(new Error('不安全地址，拒绝抓取：http://127.0.0.1/')).kind).toBe('unsafe-url');
  });
});

describe('judgePageFields — 逐字判据', () => {
  const fields = [{ key: 'auctionHouse', value: '北京保利' }];

  it('正文里有原样一段即命中', () => {
    expect(judgePageFields('2021年秋拍由北京保利举办', fields)[0].verbatim).toBe(true);
  });

  it('空白与换行不计（与引文核验同一条）', () => {
    expect(judgePageFields('北京\n  保利', fields)[0].verbatim).toBe(true);
  });

  it('改了字或标点不算命中', () => {
    expect(judgePageFields('北京保利拍卖有限公司的禹贡—盛清御瓷', [{ key: 's', value: '禹贡Ⅰ—盛清御瓷' }])[0].verbatim).toBe(false);
  });

  it('页面没提到就是不命中', () => {
    expect(judgePageFields('这是一篇讲瓷器的文章', fields)[0].verbatim).toBe(false);
  });
});

describe('measurePageVerification', () => {
  it('三个读数分开算，抓不到页不混进成功也不混进失败', () => {
    const result = measurePageVerification({
      fixture: fixture([
        fetched('https://a.example/1', true),
        fetched('https://b.example/2', false),
        failed('https://c.example/3', 'blocked'),
        failed('https://c.example/4', 'timeout'),
      ]),
      recall: recall([
        { query: 'q1', urls: ['https://a.example/1'] },
        { query: 'q2', urls: ['https://b.example/2', 'https://c.example/3'] },
        { query: 'q3', urls: [] },
        { query: 'q4', urls: ['https://c.example/4'] },
      ]),
    });

    expect(result.attempted).toBe(4);
    expect(result.fetched).toBe(2);
    expect(result.verifiedPages).toBe(1);
    expect(result.fetchSuccessRate).toBe(50);
    expect(result.verbatimPassRate).toBe(50);
    expect(result.queryHits).toBe(1);
    expect(result.verifiableRate).toBe(25);
    expect(result.failures.blocked).toBe(1);
    expect(result.failures.timeout).toBe(1);
    expect(result.failures['dead-link']).toBe(0);
    expect(result.rows.map((row) => row.hit)).toEqual([true, false, false, false]);
    expect(result.fieldStats.map((row) => `${row.key} ${row.verbatim}/${row.pages}`)).toEqual([
      'auctionHouse 1/2',
      'dateText 1/2',
      'sessionName 1/2',
    ]);
  });

  it('抓过但已不在当前候选集的页不计入读数', () => {
    const result = measurePageVerification({
      fixture: fixture([fetched('https://old.example/1', true), fetched('https://new.example/2', true)]),
      recall: recall([{ query: 'q1', urls: ['https://new.example/2'] }]),
    });
    expect(result.attempted).toBe(1);
    expect(result.fetched).toBe(1);
    expect(result.orphaned).toBe(1);
  });

  it('一页都没抓：比率是未测（null），不是 0', () => {
    const result = measurePageVerification({
      fixture: fixture([failed('https://c.example/1', 'dead-link')]),
      recall: recall([{ query: 'q1', urls: ['https://c.example/1'] }]),
    });
    expect(result.fetchSuccessRate).toBe(0);
    expect(result.verbatimPassRate).toBeNull();
    expect(result.verifiableRate).toBe(0);
  });

  it('候选集为空：抓页与逐字比率未测，查询级可核率按 0 记（确实没有可核页）', () => {
    const result = measurePageVerification({
      fixture: fixture([]),
      recall: recall([{ query: 'q1', urls: [] }]),
    });
    expect(result.fetchSuccessRate).toBeNull();
    expect(result.verbatimPassRate).toBeNull();
    expect(result.verifiableRate).toBe(0);
  });
});
