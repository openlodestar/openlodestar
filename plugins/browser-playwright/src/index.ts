// plugins/browser-playwright/src/index.ts
/**
 * 插件包入口
 *
 * 引擎按包名约定自动发现 `@openlodestar/browser-playwright`：它期望本模块导出
 * `createRenderer()`（或默认导出同一个工厂）。也可以显式注册：
 *
 * ```ts
 * import { registerBrowserPlugin } from 'openlodestar/src/integrations/browser-plugins';
 * import { createRenderer } from '@openlodestar/browser-playwright';
 * registerBrowserPlugin('playwright', createRenderer);
 * ```
 */

import { PlaywrightBrowserRenderer } from './renderer';

export { PlaywrightBrowserRenderer, createPlaywrightModuleLoader } from './renderer';
export type { PlaywrightModule, PlaywrightRendererOptions } from './renderer';
export { BrowserUnavailableError, BROWSER_UNAVAILABLE_CODE } from './browser-unavailable-error';
export type { BrowserUnavailableReason } from './browser-unavailable-error';
export type { BrowserRenderer, BrowserRenderOptions } from './types';

/** 插件名（同时也是引擎 `BROWSER_PLUGIN` 的缺省值） */
export const PLUGIN_NAME = 'playwright';

/** 注册表工厂：每次调用建一个新实例 */
export function createRenderer(): PlaywrightBrowserRenderer {
  return new PlaywrightBrowserRenderer();
}

export default createRenderer;
