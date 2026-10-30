// plugins/browser-playwright/src/browser-unavailable-error.ts
/**
 * "浏览器不可用"错误（插件侧实现）
 *
 * 为什么不 import 引擎的同名类：插件是独立包，跨包 `instanceof` 在重复安装/打包后不可靠。
 * 引擎的类型守卫 `isBrowserUnavailableError` 同时认 `code === 'BROWSER_UNAVAILABLE'`，
 * 两端靠这个字符串契约对接；字段形状与引擎 `src/utils/browser-unavailable-error.ts` 一致。
 */

export const BROWSER_UNAVAILABLE_CODE = 'BROWSER_UNAVAILABLE';

export type BrowserUnavailableReason = 'not_installed' | 'launch_failed';

export class BrowserUnavailableError extends Error {
  readonly code = BROWSER_UNAVAILABLE_CODE;
  readonly reason: BrowserUnavailableReason;

  constructor(
    reason: BrowserUnavailableReason,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'BrowserUnavailableError';
    this.reason = reason;
  }
}
