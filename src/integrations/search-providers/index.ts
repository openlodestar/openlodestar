// src/integrations/search-providers/index.ts
/**
 * 搜索提供者注册表（开放注册，内置 `llm-web` 与 `serper`）
 *
 * 引擎只按名字取提供者（环境变量 `SEARCH_PROVIDER`，缺省 `llm-web`——有 LLM_API_KEY
 * 就能跑通在线链路；`serper` 需要另注册服务并配 SERPER_API_KEY）。
 *
 * 扩展方式（生态入口）：实现 `SearchProvider` 后调用
 * `registerSearchProvider('my-provider', () => new MyProvider())`；
 * 第三方扩展包只要在宿主脚本里先注册、再调 `runQuery`，引擎不 import 具体实现。
 */

import type { SearchProvider } from './types';
import { SearchProviderConfigError } from './errors';
import { SerperProvider } from './serper-provider';
import { LlmWebSearchProvider } from './llm-web-provider';

/** 提供者工厂（延迟到用时才构造：没选中的提供者不校验密钥） */
export type SearchProviderFactory = () => SearchProvider;

const registry = new Map<string, SearchProviderFactory>();

/** 缺省提供者：不要求额外的搜索服务账号 */
export const DEFAULT_SEARCH_PROVIDER = 'llm-web';

/** 名字归一：大小写不敏感、去首尾空白（`SEARCH_PROVIDER=Serper` 也认） */
export function normalizeSearchProviderName(name: string): string {
  return name.trim().toLowerCase();
}

/** 注册提供者；名字必须是小写 slug */
export function registerSearchProvider(name: string, factory: SearchProviderFactory): void {
  const key = normalizeSearchProviderName(name);
  if (key === '') throw new SearchProviderConfigError('搜索提供者名不能为空');
  if (!/^[a-z][a-z0-9-]*$/.test(key)) {
    throw new SearchProviderConfigError(`搜索提供者名必须是小写 slug（字母开头，只含小写字母/数字/连字符）：${name}`);
  }
  if (registry.has(key)) {
    throw new SearchProviderConfigError(`搜索提供者已注册：${key}（先 unregisterSearchProvider 再注册，不静默覆盖）`);
  }
  registry.set(key, factory);
}

/** 注销提供者；返回是否确有该注册（测试与热插拔用） */
export function unregisterSearchProvider(name: string): boolean {
  return registry.delete(normalizeSearchProviderName(name));
}

/** 已注册的提供者名（按字母序） */
export function listSearchProviders(): string[] {
  return [...registry.keys()].sort();
}

/**
 * 按名字建一个提供者实例。
 *
 * @throws SearchProviderConfigError 名字未注册
 */
export function createSearchProvider(name: string): SearchProvider {
  const key = normalizeSearchProviderName(name);
  const factory = registry.get(key);
  if (!factory) {
    throw new SearchProviderConfigError(
      `未知搜索提供者：${name === '' ? '(空)' : name}。已注册：${listSearchProviders().join(', ')}；` +
        `第三方提供者需先调用 registerSearchProvider('名字', factory) 注册。`,
    );
  }
  return factory();
}

/** 从环境变量取提供者名（缺省 llm-web；名字是否注册由 createSearchProvider 检查） */
export function getSearchProviderFromEnv(): string {
  return normalizeSearchProviderName(process.env.SEARCH_PROVIDER ?? DEFAULT_SEARCH_PROVIDER);
}

// 内置提供者（模块加载时注册一次）
registerSearchProvider('llm-web', () => new LlmWebSearchProvider());
registerSearchProvider('serper', () => new SerperProvider());

export type {
  SearchProvider,
  SearchProviderCapabilities,
  SearchProviderResult,
  SearchOptions,
  SearchResultItem,
} from './types';
export { BUILTIN_SEARCH_PROVIDERS } from './types';
export {
  SearchProviderError,
  SearchProviderConfigError,
  SearchProviderCallError,
  SearchProviderParseError,
} from './errors';
export { SerperProvider } from './serper-provider';
export { LlmWebSearchProvider, llmSearchBodyFromEnv } from './llm-web-provider';
