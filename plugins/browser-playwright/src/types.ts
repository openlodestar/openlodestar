// plugins/browser-playwright/src/types.ts
/**
 * 浏览器渲染契约（与引擎 `src/integrations/browser-plugins/types.ts` 结构一致）
 *
 * 插件是独立包，不 import 引擎内部源码：两端靠**结构类型**对接，引擎侧有一条
 * 类型兼容测试盯着（把本包的工厂赋给引擎的 `BrowserRenderer`）。
 * 改这里的字段等于改插件契约——引擎那边的对应文件要同步改。
 */

export interface BrowserRenderOptions {
  timeoutMs?: number;
}

export interface BrowserRenderer {
  readonly name: string;
  render(url: string, options?: BrowserRenderOptions): Promise<string>;
  /** 开跑前的可用性探针（可选）：不可用时必须抛 `BrowserUnavailableError` */
  probe?(): Promise<void>;
}
