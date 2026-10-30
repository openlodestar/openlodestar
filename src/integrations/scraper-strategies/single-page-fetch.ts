// src/integrations/scraper-strategies/single-page-fetch.ts
/**
 * 单页 HTML 获取（不做提取、不落库、不触发事件记录器）
 *
 * 策略：纯 fetch → 浏览器降级（浏览器是**插件**，不是内置依赖）。
 *
 * 为什么需要浏览器降级：一部分页面把正文放在客户端渲染的 JS 里，或者对裸请求
 * 直接反爬拦截。装了浏览器插件（缺省 `playwright`）就能渲染后取页；插件不可用时
 * 抛 `BrowserUnavailableError`，上行把断言标成 `paused`——那是"缺工具"，不是"查无实据"。
 *
 * 抓回的 HTML 会成为证据快照的来源，因此本函数**不读取任何缓存**、
 * **不经过站点适配器**（适配器拼出来的正文不是第三方页面上印着的话）。
 */

import { resolveBrowserPlugin, getBrowserPluginFromEnv } from '@src/integrations/browser-plugins';
import {
  assertPublicHostResolves,
  assertPublicUrl,
  isUnsafeUrlError,
  safeFetchText,
} from '@src/integrations/net/safe-fetch';

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

async function fetchHtmlDirect(url: URL, timeoutMs: number): Promise<string> {
  return safeFetchText(url, {
    timeoutMs,
    headers: SINGLE_PAGE_HEADERS,
  });
}

/** 走已注册（或按包名约定自动发现）的浏览器插件渲染（插件不可用时抛 BrowserUnavailableError） */
async function fetchHtmlWithBrowser(url: URL, timeoutMs: number): Promise<string> {
  // 浏览器会自行解析域名；渲染前再核对一次，缩小 DNS 重绑定窗口（不能完全消除）
  await assertPublicHostResolves(url);
  const renderer = await resolveBrowserPlugin(getBrowserPluginFromEnv());
  return renderer.render(url.toString(), { timeoutMs });
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
  // 先做同步校验：协议 / 凭据 / localhost / 私网字面量。
  // 不安全的 URL 不进入下面的降级逻辑——换个网络通路重试只会绕开防线。
  const safeUrl = assertPublicUrl(url);

  if (options.forceBrowser === true) {
    const html = await fetchHtmlWithBrowser(safeUrl, timeoutMs);
    return { url, html, strategy: 'browser', ok: html.trim() !== '' };
  }

  try {
    const html = await fetchHtmlDirect(safeUrl, timeoutMs);
    return { url, html, strategy: 'fetch', ok: html.trim() !== '' };
  } catch (error) {
    // DNS 解析到私网、重定向指向私网等，属于"这个 URL 根本不该抓"，
    // 不能降级到浏览器再试一次
    if (isUnsafeUrlError(error)) throw error;
    if (!allowBrowser) throw error instanceof Error ? error : new Error(String(error));
  }

  const html = await fetchHtmlWithBrowser(safeUrl, timeoutMs);
  return { url, html, strategy: 'browser', ok: html.trim() !== '' };
}

/** 进程收尾时的清理钩子（浏览器场景由 playwright 自行回收，这里保留 API） */
export async function closeSinglePageBrowser(): Promise<void> {
  // 每次抓取都自建/自关浏览器实例，无需全局清理。
}
