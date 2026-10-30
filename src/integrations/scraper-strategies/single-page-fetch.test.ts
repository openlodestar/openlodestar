// src/integrations/scraper-strategies/single-page-fetch.test.ts
/**
 * 单页抓取：裸 fetch 优先，失败才降级到浏览器插件
 *
 * 钉住的分工：
 * - 浏览器是**插件**：本模块只按名字建实例、调 `render`，不认识 playwright；
 * - 直接抓成功时**不碰浏览器**（静态站领域的常态）；
 * - 插件报"缺工具"时错误原样上行（上层据此判 paused，而不是"查无实据"）；
 * - 不安全的 URL（私网、file: 等）不得降级到浏览器重试——那会绕开 SSRF 防线。
 */

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('../net/safe-fetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../net/safe-fetch')>();
  return {
    ...actual,
    safeFetchText: vi.fn(),
    assertPublicHostResolves: vi.fn(async () => undefined),
  };
});

import { registerBrowserPlugin, unregisterBrowserPlugin } from '../browser-plugins';
import { safeFetchText } from '../net/safe-fetch';
import { BrowserUnavailableError, isBrowserUnavailableError } from '../../utils/browser-unavailable-error';
import { fetchSinglePageHtml } from './single-page-fetch';

const PLUGIN = 'fake-browser';
let render: Mock<(url: string, options?: { timeoutMs?: number }) => Promise<string>>;
const directFetch = vi.mocked(safeFetchText);

beforeEach(() => {
  directFetch.mockReset();
  directFetch.mockResolvedValue('<html><body>静态页</body></html>');
  render = vi.fn(async () => '<html><body>浏览器渲染的正文</body></html>');
  registerBrowserPlugin(PLUGIN, () => ({ name: PLUGIN, render }));
  process.env.BROWSER_PLUGIN = PLUGIN;
});

afterEach(() => {
  unregisterBrowserPlugin(PLUGIN);
  delete process.env.BROWSER_PLUGIN;
});

describe('直接抓取优先', () => {
  it('fetch 成功就用 fetch，不启动浏览器', async () => {
    const result = await fetchSinglePageHtml('https://example.com/a');
    expect(result).toMatchObject({ strategy: 'fetch', ok: true });
    expect(result.html).toContain('静态页');
    expect(render).not.toHaveBeenCalled();
  });

  it('页面为空同样视为拿不到内容（ok=false，交给调用方判失败）', async () => {
    directFetch.mockResolvedValue('   ');
    const result = await fetchSinglePageHtml('https://example.com/a');
    expect(result.ok).toBe(false);
    expect(render).not.toHaveBeenCalled();
  });
});

describe('fetch 失败才降级到浏览器插件', () => {
  it('HTTP 非 2xx → 走插件渲染，策略记为 browser', async () => {
    directFetch.mockRejectedValue(new Error('HTTP 500: Internal Server Error'));
    const result = await fetchSinglePageHtml('https://example.com/a', { timeoutMs: 4321 });
    expect(result).toMatchObject({ strategy: 'browser', ok: true });
    expect(render).toHaveBeenCalledWith('https://example.com/a', { timeoutMs: 4321 });
  });

  it('网络异常（反爬断开）同样降级', async () => {
    directFetch.mockRejectedValue(new Error('ECONNRESET'));
    const result = await fetchSinglePageHtml('https://example.com/a');
    expect(result.strategy).toBe('browser');
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('forceBrowser 跳过 fetch 直接渲染', async () => {
    const result = await fetchSinglePageHtml('https://example.com/a', { forceBrowser: true });
    expect(result.strategy).toBe('browser');
    expect(directFetch).not.toHaveBeenCalled();
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('allowBrowser=false 时 fetch 失败直接抛错，不碰浏览器', async () => {
    directFetch.mockRejectedValue(new Error('HTTP 500: Internal Server Error'));
    await expect(fetchSinglePageHtml('https://example.com/a', { allowBrowser: false })).rejects.toThrow(/HTTP 500/);
    expect(render).not.toHaveBeenCalled();
  });
});

describe('插件缺工具的错误原样上行', () => {
  it('插件抛 BrowserUnavailableError 时不被吞掉（上层才能标 paused）', async () => {
    directFetch.mockRejectedValue(new Error('HTTP 500: Internal Server Error'));
    render.mockRejectedValueOnce(
      new BrowserUnavailableError('launch_failed', '浏览器启动失败：Executable doesn\'t exist'),
    );
    try {
      await fetchSinglePageHtml('https://example.com/a');
      expect.unreachable('缺工具应当抛错');
    } catch (error) {
      expect(isBrowserUnavailableError(error)).toBe(true);
      if (isBrowserUnavailableError(error)) expect(error.reason).toBe('launch_failed');
    }
  });

  it('未注册且找不到约定包时明确报错（不静默退回缺省）', async () => {
    directFetch.mockRejectedValue(new Error('HTTP 500: Internal Server Error'));
    process.env.BROWSER_PLUGIN = 'no-such-plugin';
    await expect(fetchSinglePageHtml('https://example.com/a')).rejects.toThrow(/@openlodestar\/browser-no-such-plugin/);
  });
});
