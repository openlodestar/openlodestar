// plugins/browser-playwright/src/renderer.test.ts
/**
 * Playwright 渲染插件（不真的启动浏览器：模块形状由夹具注入）
 *
 * 钉住三件事：
 * 1. 模块加载失败 → `BrowserUnavailableError('not_installed')`（不是普通异常）；
 * 2. 启动失败 → `BrowserUnavailableError('launch_failed')`（"缺工具"与"抓取失败"要分得开）；
 * 3. 正常路径按 goto → networkidle 等不到不算失败 → content() 取页，且浏览器一定被关掉。
 */

import { describe, expect, it, vi } from 'vitest';
import { createRenderer } from './index';
import {
  BrowserUnavailableError,
  BROWSER_UNAVAILABLE_CODE,
  createPlaywrightModuleLoader,
  PlaywrightBrowserRenderer,
  type PlaywrightModule,
} from './index';

/** 构造一个最小可用的 playwright 模块夹具 */
function moduleFixture(
  content = '<html><body>正文</body></html>',
  overrides: { launchError?: Error; networkidleError?: Error } = {},
): {
  module: PlaywrightModule;
  page: { goto: ReturnType<typeof vi.fn>; waitForLoadState: ReturnType<typeof vi.fn>; content: ReturnType<typeof vi.fn> };
  close: ReturnType<typeof vi.fn>;
} {
  const page = {
    goto: vi.fn(async () => undefined),
    waitForLoadState: vi.fn(async () => {
      if (overrides.networkidleError) throw overrides.networkidleError;
      return undefined;
    }),
    content: vi.fn(async () => content),
  };
  const close = vi.fn(async () => undefined);
  const module: PlaywrightModule = {
    chromium: {
      launch: vi.fn(async () => {
        if (overrides.launchError) throw overrides.launchError;
        return { newPage: async () => page, close };
      }),
    },
  };
  return { module, page, close };
}

describe('playwright 模块加载失败 → 缺工具（不是抓取失败）', () => {
  it('require 抛错时翻译成 BrowserUnavailableError(not_installed)，并带安装命令', () => {
    const load = createPlaywrightModuleLoader(() => {
      throw new Error("Cannot find module 'playwright'");
    });
    try {
      load();
      expect.unreachable('模块缺失应当抛错');
    } catch (error) {
      expect(error).toBeInstanceOf(BrowserUnavailableError);
      if (error instanceof BrowserUnavailableError) {
        expect(error.reason).toBe('not_installed');
        expect(error.code).toBe(BROWSER_UNAVAILABLE_CODE);
        expect(error.message).toContain('npx playwright install chromium');
      }
    }
  });

  it('加载成功时原样返回模块（不做多余包装）', () => {
    const { module } = moduleFixture();
    const load = createPlaywrightModuleLoader(() => module);
    expect(load()).toBe(module);
  });
});

describe('渲染与探针', () => {
  it('渲染走 goto → 等 networkidle → content，最后一定关浏览器', async () => {
    const { module, page, close } = moduleFixture();
    const renderer = new PlaywrightBrowserRenderer({ loadModule: () => module });
    const html = await renderer.render('https://example.com/a', { timeoutMs: 1234 });

    expect(html).toContain('正文');
    expect(page.goto).toHaveBeenCalledWith('https://example.com/a', { waitUntil: 'domcontentloaded', timeout: 1234 });
    expect(page.waitForLoadState).toHaveBeenCalledWith('networkidle', { timeout: 5_000 });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('等不到 networkidle 不算失败（单页应用的轮询请求会一直挂着）', async () => {
    const { module } = moduleFixture('<html>已渲染</html>', { networkidleError: new Error('Timeout 5000ms exceeded') });
    const renderer = new PlaywrightBrowserRenderer({ loadModule: () => module });
    await expect(renderer.render('https://example.com/a')).resolves.toContain('已渲染');
  });

  it('浏览器启动失败 → BrowserUnavailableError(launch_failed)', async () => {
    const { module } = moduleFixture('', { launchError: new Error('browserType.launch: Executable doesn\'t exist') });
    const renderer = new PlaywrightBrowserRenderer({ loadModule: () => module });
    try {
      await renderer.render('https://example.com/a');
      expect.unreachable('启动失败应当抛错');
    } catch (error) {
      expect(error).toBeInstanceOf(BrowserUnavailableError);
      if (error instanceof BrowserUnavailableError) {
        expect(error.reason).toBe('launch_failed');
        expect(error.message).toContain('Executable doesn');
      }
    }
  });

  it('探针会真启一次浏览器并关掉（用来在开跑前确认可用）', async () => {
    const { module, close } = moduleFixture();
    const renderer = new PlaywrightBrowserRenderer({ loadModule: () => module });
    await renderer.probe();
    expect(module.chromium.launch).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('探针在缺模块时同样报 not_installed，而不是原始 require 异常', async () => {
    const renderer = new PlaywrightBrowserRenderer({
      loadModule: createPlaywrightModuleLoader(() => {
        throw new Error('Cannot find module');
      }),
    });
    try {
      await renderer.probe();
      expect.unreachable('缺模块时探针应当抛错');
    } catch (error) {
      expect(error).toBeInstanceOf(BrowserUnavailableError);
      if (error instanceof BrowserUnavailableError) expect(error.reason).toBe('not_installed');
    }
  });
});

describe('包入口', () => {
  it('工厂按注册表约定给出名字正确的实例', () => {
    expect(createRenderer().name).toBe('playwright');
  });

  it('错误形状带 code / reason / name（引擎按 code 跨包识别）', () => {
    const error = new BrowserUnavailableError('launch_failed', 'x');
    expect(error.code).toBe(BROWSER_UNAVAILABLE_CODE);
    expect(error.reason).toBe('launch_failed');
    expect(error.name).toBe('BrowserUnavailableError');
  });
});
