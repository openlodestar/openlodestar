// src/integrations/search-providers/types.ts
/**
 * 搜索提供者抽象接口
 *
 * 引擎只需要「一批查询进、一批结果出」。内置两个实现：
 * - `llm-web`：让模型自带联网搜索（有 LLM_API_KEY 即可，缺省提供者）；
 * - `serper`：独立搜索 API（支持 site:，需要另注册并配 SERPER_API_KEY）。
 *
 * 扩展方式：实现 `SearchProvider`，调用 `registerSearchProvider('名字', factory)` 注册；
 * 第三方包在自己的代码里注册、再调 `runQuery` 即可，引擎不 import 具体实现。
 */

/** 单条搜索结果 */
export interface SearchResultItem {
  url: string;
  title: string;
  snippet: string;
  /** 结果位置/排名（从 1 开始） */
  position: number;
  /** 来自第几条查询（从 0 开始） */
  queryIndex: number;
}

/** 搜索提供者返回结果 */
export interface SearchProviderResult {
  results: SearchResultItem[];
  /** 原始响应（调试用） */
  rawResponse?: unknown;
}

/** 搜索选项 */
export interface SearchOptions {
  /** 每条查询返回的结果数量（默认 10） */
  numResults?: number;
  /** 搜索语言（'zh-cn' / 'en'） */
  language?: string;
}

/** 搜索提供者能力声明 */
export interface SearchProviderCapabilities {
  /**
   * 是否支持 `site:` 操作符（缺省视为不支持）。
   * 检索层按它决定 `site:域名` 定向查询发不发：不支持时跳过并记入 skippedQueries，
   * **不降级成普通关键词**——降级会悄悄改变查询语义。
   */
  siteOperator?: boolean;
}

/** 搜索提供者接口 */
export interface SearchProvider {
  /** 提供者名称（用于日志和 trace） */
  readonly name: string;
  /** 能力声明；不支持的能力不得降级为普通词 */
  readonly capabilities?: SearchProviderCapabilities;
  /** 执行搜索 */
  search(queries: string[], options?: SearchOptions): Promise<SearchProviderResult>;
}

/**
 * 内置提供者的展示名（展示用）。
 * 名字本身是开放字符串：注册表里任何 slug 都能成为可用的提供者名。
 */
export const BUILTIN_SEARCH_PROVIDERS: Record<string, string> = {
  'llm-web': 'LLM 自带联网搜索',
  serper: 'Serper (Google)',
};
