// plugins/browser-playwright/src/renderer.ts
/**
 * Playwright 浏览器渲染插件
 *
 * 这个包是**可选安装**的：核心引擎不依赖 playwright，只有需要浏览器渲染的领域
 * （或做端到端验证的人）才装它。安装后引擎会按包名约定自动发现
 * `@openlodestar/browser-playwright`，也可以显式注册。
 *
 * 插件在真正要渲染时才 `require('playwright')`；没装就抛 `BrowserUnavailableError`，
 * 由上层区分"缺工具"与"抓取失败"。
 */

import { createRequire } from 'node:module';
import { BrowserUnavailableError } from './browser-unavailable-error';
import type { BrowserRenderer, BrowserRenderOptions } from './types';

const requireFromHere = createRequire(import.meta.url);

const DEFAULT_TIMEOUT_MS = 25_000;

interface PlaywrightPage {
  goto(url: string, options: { waitUntil: string; timeout: number }): Promise<unknown>;
  waitForLoadState(state: string, options: { timeout: number }): Promise<unknown>;
  content(): Promise<string>;
}

interface PlaywrightBrowser {
  newPage(): Promise<PlaywrightPage>;
  close(): Promise<void>;
}

/** playwright 模块的最小形状（只用到 chromium.launch） */
export interface PlaywrightModule {
  chromium: { launch(options?: { headless?: boolean }): Promise<PlaywrightBrowser> };
}

/** 构造参数（只给测试注入用） */
export interface PlaywrightRendererOptions {
  /** 替换真实的模块加载；缺省从本模块解析 `playwright` */
  loadModule?: () => PlaywrightModule;
}

const INSTALL_HINT = 'npm i -D @openlodestar/browser-playwright && npx playwright install chromium';

/**
 * 把"模块加载失败"翻译成"缺工具"。
 * 之所以做成可注入的工厂：真实的 `require('playwright')` 失败在装了 playwright 的机器上复现不了，
 * 测试要能替换掉这一步（缺工具与抓取失败是两种错误，必须钉住这条转换）。
 */
export function createPlaywrightModuleLoader(
  load: () => PlaywrightModule = () => requireFromHere('playwright') as PlaywrightModule,
): () => PlaywrightModule {
  return () => {
    try {
      return load();
    } catch (error) {
      throw new BrowserUnavailableError(
        'not_installed',
        `没有安装 playwright。安装：${INSTALL_HINT}`,
        { cause: error },
      );
    }
  };
}

const loadPlaywrightModule = createPlaywrightModuleLoader();

export class PlaywrightBrowserRenderer implements BrowserRenderer {
  readonly name = 'playwright';
  private readonly loadModule: () => PlaywrightModule;
  private module: PlaywrightModule | null = null;

  constructor(options: PlaywrightRendererOptions = {}) {
    this.loadModule = options.loadModule ?? loadPlaywrightModule;
  }

  private moduleOrThrow(): PlaywrightModule {
    if (this.module === null) {
      this.module = this.loadModule();
    }
    return this.module;
  }

  /** 开跑前探针：模块能加载、浏览器能启动即视为可用（启动失败不消耗抓取预算） */
  async probe(): Promise<void> {
    const playwright = this.moduleOrThrow();
    let browser: PlaywrightBrowser | null = null;
    try {
      browser = await playwright.chromium.launch({ headless: true });
    } catch (error) {
      throw new BrowserUnavailableError(
        'launch_failed',
        `浏览器启动失败：${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    } finally {
      if (browser !== null) await browser.close().catch(() => undefined);
    }
  }

  async render(url: string, options: BrowserRenderOptions = {}): Promise<string> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const playwright = this.moduleOrThrow();
    let browser: PlaywrightBrowser;
    try {
      browser = await playwright.chromium.launch({ headless: true });
    } catch (error) {
      throw new BrowserUnavailableError(
        'launch_failed',
        `浏览器启动失败：${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
      // 等不到 networkidle 不算失败：内容可能已经在了（单页应用的轮询请求会一直挂着）
      await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
      return await page.content();
    } finally {
      await browser.close().catch(() => undefined);
    }
  }
}
