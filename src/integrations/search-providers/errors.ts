// src/integrations/search-providers/errors.ts
/**
 * 搜索提供者的错误分型
 *
 * 检索层把所有提供者错误都当「infra 失败」处理：该断言记 `failed`，不伪装成 `not_found`。
 * 分型是为了让使用者一眼看出该修哪里，而不是都丢一句 "search failed"：
 *
 * - 配置错误（名字不存在 / 缺密钥 / 环境变量写坏）：修配置即可，重试没有意义；
 * - 调用错误（HTTP 非 2xx、网络中断、模型调用失败）：换提供者或等额度；
 * - 解析错误（返回内容不是约定的结果格式）：提供者或模型的问题。
 *   这里刻意抛错而不是返回空数组——「解析不出来就当没搜到」会把一次模型抽风
 *   变成一条"世界没有证据"的结论，是最危险的静默失败。
 */

export type SearchProviderErrorKind = 'config' | 'call' | 'parse';

export class SearchProviderError extends Error {
  readonly kind: SearchProviderErrorKind;

  constructor(kind: SearchProviderErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'SearchProviderError';
    this.kind = kind;
  }
}

/** 配置问题：未知提供者名、缺 API key、环境变量格式非法 */
export class SearchProviderConfigError extends SearchProviderError {
  constructor(message: string, options?: { cause?: unknown }) {
    super('config', message, options);
    this.name = 'SearchProviderConfigError';
  }
}

/** 调用失败：HTTP 非 2xx、网络中断、底层模型调用失败 */
export class SearchProviderCallError extends SearchProviderError {
  constructor(message: string, options?: { cause?: unknown }) {
    super('call', message, options);
    this.name = 'SearchProviderCallError';
  }
}

/** 返回内容不符合约定格式（不是 JSON 数组 / 没有一条合法链接） */
export class SearchProviderParseError extends SearchProviderError {
  constructor(message: string, options?: { cause?: unknown }) {
    super('parse', message, options);
    this.name = 'SearchProviderParseError';
  }
}
