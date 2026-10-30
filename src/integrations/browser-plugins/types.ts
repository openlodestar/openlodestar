// src/integrations/browser-plugins/types.ts
/**
 * 浏览器渲染插件契约
 *
 * 为什么是插件而不是内置依赖：不同领域对浏览器的需求完全不同——古玩拍卖的验证页
 * 有反爬、常把正文放在客户端渲染里，必须用真浏览器；只读新闻/百科之类的静态站
 * 裸 fetch 就够。把 playwright 写死在抓取链里，等于让不需要的领域也背上浏览器依赖。
 *
 * 引擎只认这个接口；缺省插件是 playwright（未安装时按需安装），第三方可实现
 * 自己的渲染器（puppeteer、远程浏览器服务等）后调用 `registerBrowserPlugin` 注册。
 */

/** 渲染参数 */
export interface BrowserRenderOptions {
  /** 单页超时（毫秒） */
  timeoutMs?: number;
}

/** 浏览器渲染器 */
export interface BrowserRenderer {
  /** 插件名（用于日志、配置与注册表） */
  readonly name: string;
  /** 取回**渲染后**的完整 HTML（含客户端渲染出的正文） */
  render(url: string, options?: BrowserRenderOptions): Promise<string>;
  /**
   * 开跑前的可用性探针（可选）：插件被策略包声明为"必备"时，引擎会在开跑前调用。
   * 不可用时必须抛 `BrowserUnavailableError`——缺工具与"抓取失败"是两回事。
   */
  probe?(): Promise<void>;
}
