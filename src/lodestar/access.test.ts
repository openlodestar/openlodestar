// src/lodestar/access.test.ts
/**
 * access 层测试（离线：抓取与提取全部注入，不碰网络）
 *
 * 钉四件事：官方站优先排序、entryUrl 取顺位最高而非摊得最多、
 * 失败留痕（全军覆没 entryUrl=null 但 attempts 记录原因）、
 * 补写走 patch 追加（读时取最后一条，历史行不动）。
 */

import { describe, it, expect } from 'vitest';
import {
  accessCandidateUrls,
  rankAccessCandidates,
  probeAnchorAccess,
  persistAnchorAccess,
  type AccessFetchResult,
} from './access';
import porcelainPack from './packs/porcelain';
import { createStore } from './storage/adapter';
import type { AnchorRecord } from './types';

const NEWS_URL = 'https://www.chinanews.com/cul/2021/11-25/9616104.shtml';
const OFFICIAL_URL = 'https://www.polypm.com.cn/auction/auction_index.html?infoId=abc';
const AGGREGATOR_URL = 'https://cang.cngold.org/paimai/baoli/';

describe('rankAccessCandidates', () => {
  it('官方站排最前，新闻/聚合靠后；同档内按 URL 字典序', () => {
    const ranked = rankAccessCandidates([AGGREGATOR_URL, NEWS_URL, OFFICIAL_URL], porcelainPack);
    expect(ranked[0]).toBe(OFFICIAL_URL);
    expect(ranked).toContain(AGGREGATOR_URL);
    expect(ranked).toContain(NEWS_URL);
    expect(ranked.indexOf(OFFICIAL_URL)).toBeLessThan(ranked.indexOf(AGGREGATOR_URL));
  });

  it('解析不了的 URL 按 unlisted 排最后，不抛错', () => {
    const ranked = rankAccessCandidates(['::not-a-url::', OFFICIAL_URL], porcelainPack);
    expect(ranked[ranked.length - 1]).toBe('::not-a-url::');
  });
});

describe('accessCandidateUrls', () => {
  const ADDRESS_URL = 'https://www.polypm.com.cn/contact';

  it('只收 supports / refutes，剔除 irrelevant，并与坐标自带来源去重', () => {
    const candidates = accessCandidateUrls([NEWS_URL, OFFICIAL_URL], [
      { url: OFFICIAL_URL, relation: 'supports' },
      { url: AGGREGATOR_URL, relation: 'refutes' },
      { url: ADDRESS_URL, relation: 'irrelevant' },
    ]);
    expect(candidates).toEqual([NEWS_URL, OFFICIAL_URL, AGGREGATOR_URL]);
  });

  it('坐标自带来源优先保留，证据页按底稿顺序追加', () => {
    const candidates = accessCandidateUrls([OFFICIAL_URL], [
      { url: AGGREGATOR_URL, relation: 'supports' },
      { url: NEWS_URL, relation: 'supports' },
    ]);
    expect(candidates).toEqual([OFFICIAL_URL, AGGREGATOR_URL, NEWS_URL]);
  });
});

describe('probeAnchorAccess', () => {
  const extractDetails = (html: string): string[] => (html === 'HUB' ? ['https://www.polypm.com.cn/lot/1'] : []);

  it('entryUrl 取顺位最高的摊出页，不是摊得最多的页', async () => {
    const responses = new Map<string, AccessFetchResult>([
      [OFFICIAL_URL, { ok: true, html: 'HUB' }],
      [AGGREGATOR_URL, { ok: true, html: 'ALSO_HUB_BUT_NOT_USED' }],
    ]);
    const output = await probeAnchorAccess({
      candidates: [OFFICIAL_URL, AGGREGATOR_URL],
      pack: porcelainPack,
      fetchHtml: async (url) => responses.get(url) ?? { ok: false, reason: 'missing stub' },
      extractDetails: (html) => (html === 'HUB' ? ['a', 'b', 'c'] : ['x', 'y', 'z', 'w', 'q']),
      fetcher: 'stub',
    });
    expect(output.access.entryUrl).toBe(OFFICIAL_URL);
    expect(output.access.detailCount).toBe(3);
    expect(output.linksByEntry.get(OFFICIAL_URL)).toHaveLength(3);
  });

  it('抓取失败与摊出 0 条都留痕；全军覆没 entryUrl 为 null', async () => {
    const output = await probeAnchorAccess({
      candidates: [NEWS_URL, OFFICIAL_URL],
      pack: porcelainPack,
      fetchHtml: async (url) => (url === NEWS_URL ? { ok: false, reason: 'HTTP 403' } : { ok: true, html: '<p>空壳</p>' }),
      extractDetails: () => [],
      fetcher: 'stub',
    });
    expect(output.access.entryUrl).toBeNull();
    expect(output.access.detailCount).toBe(0);
    expect(output.access.attempts).toEqual([
      { url: NEWS_URL, ok: false, linkCount: 0, reason: 'HTTP 403' },
      { url: OFFICIAL_URL, ok: true, linkCount: 0 },
    ]);
  });

  it('maxProbes 截断候选数', async () => {
    let fetched = 0;
    await probeAnchorAccess({
      candidates: [OFFICIAL_URL, AGGREGATOR_URL, NEWS_URL],
      pack: porcelainPack,
      fetchHtml: async () => {
        fetched += 1;
        return { ok: true, html: '' };
      },
      extractDetails: () => [],
      fetcher: 'stub',
      maxProbes: 1,
    });
    expect(fetched).toBe(1);
  });
});

describe('persistAnchorAccess', () => {
  it('patch 追加一行：读时取最后一条带 access 的坐标，历史行不动', async () => {
    const tmp = await import('node:os');
    const path = await import('node:path');
    const fs = await import('node:fs/promises');
    const dir = await fs.mkdtemp(path.join(tmp.tmpdir(), 'lodestar-access-test-'));
    const isolated = createStore({ baseDir: dir });

    const anchor: Omit<AnchorRecord, 'access'> = {
      recordId: 'rec-test',
      query: 'q',
      fields: { auctionHouse: '北京保利拍卖', dateText: '2021年11月', sessionName: '「禹贡」系列专场' },
      searchPhrases: ['北京保利 禹贡系列专场'],
      anchorGrade: 'strong',
      evidenceGrade: 'E2',
      sourceUrls: [OFFICIAL_URL],
      categoryTags: ['瓷器'],
      footprintRef: 'verdicts:c1',
      traceId: 'trace-test',
      asOf: '2026-10-10T00:00:00.000Z',
      stale: false,
    };
    await isolated.append('anchors', anchor);

    const access = {
      entryUrl: OFFICIAL_URL,
      detailCount: 2,
      probedAt: '2026-10-10T00:00:01.000Z',
      fetcher: 'stub',
      attempts: [{ url: OFFICIAL_URL, ok: true, linkCount: 2 }],
    };
    const updated = await persistAnchorAccess('rec-test', access, isolated);
    expect(updated?.access).toEqual(access);

    // 历史行仍在：allRows 两行（原始 + patch 追加），get 取最后一条
    expect(await isolated.allRows<AnchorRecord>('anchors')).toHaveLength(2);
    const reread = await isolated.get<AnchorRecord>('anchors', 'rec-test');
    expect(reread?.searchPhrases).toEqual(['北京保利 禹贡系列专场']);
    expect(reread?.access?.entryUrl).toBe(OFFICIAL_URL);

    // 坐标不存在返回 null，不抛错
    expect(await persistAnchorAccess('rec-missing', access, isolated)).toBeNull();

    await fs.rm(dir, { recursive: true, force: true });
  });
});
