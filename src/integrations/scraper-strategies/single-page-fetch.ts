// src/integrations/scraper-strategies/single-page-fetch.ts
/**
 * 单页 HTML 获取（不做提取、不落库、不触发事件记录器）
 *
 * 策略：纯 fetch → 浏览器降级（浏览器是可选依赖）。
 *
 * 为什么需要浏览器降级：一部分页面把正文放在客户端渲染的 JS 里，裸 fetch
 * 只能取到导航外壳（外壳非空，容易被误当成抓取成功）。装了 `playwright`
 * 就能渲染后取页；没装时抛 `BrowserUnavailableError`，上行把断言标成
 * `paused`——那是"缺工具"，不是"查无实据"。
 *
 * 抓回的 HTML 会成为证据快照的来源，因此本函数**不读取任何缓存**、
 * **不经过站点适配器**（适配器拼出来的正文不是第三方页面上印着的话）。
 */

import { createRequire } from 'node:module';
import { BrowserUnavailableError } from '@src/utils/browser-unavailable-error';

const requireFromHere = createRequire(import.meta.url);

/** 现代浏览器请求头（降低反爬拦截） */
const SINGLE_PAGE_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
};

/** 单次抓取的超时兜底（默认 25 秒，避免一张慢页拖住整条作业） */
const DEFAULT_TIMEOUT_MS = Number(process.env.OPENLODESTAR_PAGE_TIMEOUT_MS) || 25_000;

/** 抓回的一页 HTML 及其来源策略 */
export interface SinglePageResult {
  url: string;
  html: string;
  strategy: 'cache' | 'site-adapter' | 'fetch' | 'browser';
  /** 是否拿到了内容（空页面返回 false，由调用方判失败） */
  ok: boolean;
}

async function fetchHtmlDirect(url: string, timeoutMs: number): Promise<string> {
  const response = await fetch(url, {
    headers: SINGLE_PAGE_HEADERS,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.text();
}

interface PlaywrightPage {
  goto(url: string, options: { waitUntil: string; timeout: number }): Promise<unknown>;
  waitForLoadState(state: string, options: { timeout: number }): Promise<unknown>;
  content(): Promise<string>;
}

interface PlaywrightBrowser {
  newPage(): Promise<PlaywrightPage>;
  close(): Promise<void>;
}

interface PlaywrightModule {
  chromium: { launch(options?: { headless?: boolean }): Promise<PlaywrightBrowser> };
}

/** 加载可选的 playwright（未安装时抛"浏览器不可用"） */
function loadPlaywright(): PlaywrightModule {
  try {
    return requireFromHere('playwright') as PlaywrightModule;
  } catch (error) {
    throw new BrowserUnavailableError(
      'not_installed',
      `需要浏览器渲染但没有安装 playwright：${(error as Error).message}`,
      { cause: error },
    );
  }
}

async function fetchHtmlWithBrowser(url: string, timeoutMs: number): Promise<string> {
  const playwright = loadPlaywright();
  let browser: PlaywrightBrowser;
  try {
    browser = await playwright.chromium.launch({ headless: true });
  } catch (error) {
    throw new BrowserUnavailableError('launch_failed', `浏览器启动失败：${(error as Error).message}`, {
      cause: error,
    });
  }
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
    return await page.content();
  } finally {
    await browser.close().catch(() => undefined);
  }
}

/**
 * 取回一个 URL 的原始 HTML。
 *
 * @param options.allowBrowser 是否允许浏览器降级（默认允许；关掉即"拿不到就失败"）
 * @param options.forceBrowser 跳过裸 fetch，直接用浏览器渲染后取页
 * @param options.allowSiteAdapter 保留参数位（本仓库不带站点适配器，传什么都不会启用）
 * @param options.forceRefresh 保留参数位（本仓库不做跨次缓存）
 */
export async function fetchSinglePageHtml(
  url: string,
  options: {
    allowBrowser?: boolean;
    forceRefresh?: boolean;
    forceBrowser?: boolean;
    timeoutMs?: number;
    allowSiteAdapter?: boolean;
  } = {},
): Promise<SinglePageResult> {
  const allowBrowser = options.allowBrowser ?? true;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (options.forceBrowser === true) {
    const html = await fetchHtmlWithBrowser(url, timeoutMs);
    return { url, html, strategy: 'browser', ok: html.trim() !== '' };
  }

  try {
    const html = await fetchHtmlDirect(url, timeoutMs);
    return { url, html, strategy: 'fetch', ok: html.trim() !== '' };
  } catch (error) {
    if (!allowBrowser) throw error instanceof Error ? error : new Error(String(error));
  }

  const html = await fetchHtmlWithBrowser(url, timeoutMs);
  return { url, html, strategy: 'browser', ok: html.trim() !== '' };
}

/** 进程收尾时的清理钩子（浏览器场景由 playwright 自行回收，这里保留 API） */
export async function closeSinglePageBrowser(): Promise<void> {
  // 每次抓取都自建/自关浏览器实例，无需全局清理。
}
