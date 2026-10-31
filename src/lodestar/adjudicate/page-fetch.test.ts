// src/lodestar/adjudicate/page-fetch.test.ts
/**
 * 证据页抓取的单测（离屏：fetch 通路与快照写入都给假件）
 *
 * 钉住两件事：
 * 1. 裸 fetch 优先 / 浏览器强制这两条路由真的传到了抓取通路；
 * 2. 浏览器不可用与空页面分别归到 `PageNeedsBrowserError` 与 `PageFetchFailedError`，
 *    上层才能把前者记 paused、后者记 failed。
 */

import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('../../integrations/scraper-strategies', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../integrations/scraper-strategies')>();
  return { ...actual, fetchSinglePageHtml: vi.fn() };
});
vi.mock('../storage/adapter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../storage/adapter')>();
  return { ...actual, writeSnapshot: vi.fn() };
});

import { fetchSinglePageHtml } from '../../integrations/scraper-strategies';
import { BrowserUnavailableError } from '../../utils/browser-unavailable-error';
import { createStore } from '../storage/adapter';
import { writeSnapshot } from '../storage/adapter';
import {
  captureEvidencePage,
  PageFetchFailedError,
  PageNeedsBrowserError,
} from './page-fetch';

const PAGE = '<html><body><h1>中国嘉德2026年春季拍卖会</h1><p>2026年5月6日 嘉德艺术中心</p></body></html>';

function store() {
  return createStore({ baseDir: path.join(os.tmpdir(), 'lodestar-page-fetch-test') });
}

beforeEach(() => {
  (fetchSinglePageHtml as Mock).mockReset();
  (writeSnapshot as Mock).mockReset().mockResolvedValue(undefined);
});

describe('抓取路由', () => {
  it('默认先裸 fetch，forceBrowser 原样传给抓取通路', async () => {
    (fetchSinglePageHtml as Mock).mockResolvedValue({ url: 'https://a.test/1', html: PAGE, strategy: 'fetch', ok: true });

    const page = await captureEvidencePage(store(), 'ev-1', 'https://a.test/1');

    expect(fetchSinglePageHtml).toHaveBeenCalledWith('https://a.test/1', {
      forceRefresh: undefined,
      forceBrowser: undefined,
      allowSiteAdapter: false,
    });
    expect(page.strategy).toBe('fetch');
    expect(page.text).toContain('中国嘉德2026年春季拍卖会');
    expect(writeSnapshot).toHaveBeenCalledWith(expect.anything(), 'snapshots/ev-1.html', expect.stringContaining('中国嘉德2026年春季拍卖会'));
  });

  it('forceBrowser=true 时跳过裸 fetch，按浏览器策略取页', async () => {
    (fetchSinglePageHtml as Mock).mockResolvedValue({ url: 'https://a.test/1', html: PAGE, strategy: 'browser', ok: true });

    const page = await captureEvidencePage(store(), 'ev-2', 'https://a.test/1', { forceBrowser: true });

    expect(fetchSinglePageHtml).toHaveBeenCalledWith('https://a.test/1', {
      forceRefresh: undefined,
      forceBrowser: true,
      allowSiteAdapter: false,
    });
    expect(page.strategy).toBe('browser');
  });
});

describe('错误归类', () => {
  it('浏览器不可用 → PageNeedsBrowserError（上层记 paused，不算失败）', async () => {
    (fetchSinglePageHtml as Mock).mockRejectedValue(
      new BrowserUnavailableError('not_installed', '没有装浏览器'),
    );

    await expect(captureEvidencePage(store(), 'ev-3', 'https://a.test/1')).rejects.toBeInstanceOf(
      PageNeedsBrowserError,
    );
  });

  it('抓回空页面 → PageFetchFailedError（记进足迹，继续下一候选）', async () => {
    (fetchSinglePageHtml as Mock).mockResolvedValue({ url: 'https://a.test/1', html: '', strategy: 'fetch', ok: false });

    await expect(captureEvidencePage(store(), 'ev-4', 'https://a.test/1')).rejects.toBeInstanceOf(
      PageFetchFailedError,
    );
  });

  it('普通抓取错误 → PageFetchFailedError，不误判成需要浏览器', async () => {
    (fetchSinglePageHtml as Mock).mockRejectedValue(new Error('HTTP 403: Forbidden'));

    await expect(captureEvidencePage(store(), 'ev-5', 'https://a.test/1')).rejects.toBeInstanceOf(
      PageFetchFailedError,
    );
  });
});
