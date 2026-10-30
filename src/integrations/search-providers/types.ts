// src/integrations/search-providers/types.ts
/**
 * 搜索提供者抽象接口
 *
 * 引擎只需要「一批查询进、一批结果出」。当前提供 Serper 实现；
 * 扩展方式：实现 `SearchProvider` 接口，在 `index.ts` 的工厂里注册。
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
  /** 是否支持 site: 操作符（缺省视为不支持） */
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

/** 支持的搜索提供者名称 */
export type SearchProviderName = 'serper';

/** 名称映射（展示用） */
export const SEARCH_PROVIDERS: Record<SearchProviderName, string> = {
  serper: 'Serper (Google)',
};
