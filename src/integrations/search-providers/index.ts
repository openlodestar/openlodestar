// src/integrations/search-providers/index.ts
/**
 * 搜索提供者工厂
 *
 * 环境变量 `SEARCH_PROVIDER`（目前只支持 `serper`，默认即它）。
 * 新提供者：实现 `SearchProvider`，在 `createSearchProvider` 里加一个分支。
 */

import type { SearchProvider, SearchProviderName } from './types';
import { SerperProvider } from './serper-provider';

export function createSearchProvider(name: SearchProviderName): SearchProvider {
  switch (name) {
    case 'serper':
      return new SerperProvider();
    default:
      throw new Error(`Unknown search provider: ${String(name)}`);
  }
}

export function getSearchProviderFromEnv(): SearchProviderName {
  const provider = process.env.SEARCH_PROVIDER || 'serper';
  if (provider !== 'serper') {
    throw new Error(`Invalid SEARCH_PROVIDER: ${provider}. Must be 'serper'`);
  }
  return provider;
}

export type {
  SearchProvider,
  SearchProviderName,
  SearchProviderResult,
  SearchOptions,
  SearchResultItem,
} from './types';

export { SerperProvider } from './serper-provider';
