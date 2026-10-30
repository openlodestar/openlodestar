// src/integrations/search-providers/registry.test.ts
/**
 * 注册表：内置提供者、注册/注销、重名、未知名字、env 取名的归一
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SEARCH_PROVIDER,
  createSearchProvider,
  getSearchProviderFromEnv,
  listSearchProviders,
  normalizeSearchProviderName,
  registerSearchProvider,
  unregisterSearchProvider,
} from './index';
import { SearchProviderConfigError } from './errors';
import { BUILTIN_SEARCH_PROVIDERS } from './types';
import type { SearchProvider } from './types';

const TEST_NAME = 'contract-test-provider';
const fake: SearchProvider = { name: TEST_NAME, search: async () => ({ results: [] }) };

afterEach(() => {
  unregisterSearchProvider(TEST_NAME);
  delete process.env.SEARCH_PROVIDER;
});

describe('搜索提供者注册表', () => {
  it('内置 llm-web 与 serper 都在册', () => {
    expect(listSearchProviders()).toEqual(expect.arrayContaining(['llm-web', 'serper']));
  });

  it('展示表与注册表一致（清单不会悄悄过期）', () => {
    for (const name of Object.keys(BUILTIN_SEARCH_PROVIDERS)) {
      expect(listSearchProviders()).toContain(name);
    }
  });

  it('注册后可按名字建出来；注销后再建报配置错误', () => {
    registerSearchProvider(TEST_NAME, () => fake);
    expect(createSearchProvider(TEST_NAME)).toBe(fake);
    unregisterSearchProvider(TEST_NAME);
    expect(() => createSearchProvider(TEST_NAME)).toThrow(SearchProviderConfigError);
  });

  it('重名注册报配置错误（不静默覆盖）', () => {
    registerSearchProvider(TEST_NAME, () => fake);
    expect(() => registerSearchProvider(TEST_NAME, () => fake)).toThrow(/已注册/);
  });

  it('非法名字（非 slug）注册时就被拒绝', () => {
    expect(() => registerSearchProvider('Bad Name', () => fake)).toThrow(SearchProviderConfigError);
    expect(() => registerSearchProvider('', () => fake)).toThrow(SearchProviderConfigError);
  });

  it('未知名字的报错里列出已注册的名字（可自助排查）', () => {
    try {
      createSearchProvider('no-such-provider');
      expect.unreachable('未知名字应当抛错');
    } catch (error) {
      expect(error).toBeInstanceOf(SearchProviderConfigError);
      const message = (error as Error).message;
      expect(message).toContain('serper');
      expect(message).toContain('llm-web');
      expect(message).toContain('registerSearchProvider');
    }
  });

  it('缺省提供者是 llm-web（零额外账号）', () => {
    expect(DEFAULT_SEARCH_PROVIDER).toBe('llm-web');
    expect(getSearchProviderFromEnv()).toBe('llm-web');
  });

  it('SEARCH_PROVIDER 大小写与空白不敏感', () => {
    process.env.SEARCH_PROVIDER = '  Serper  ';
    expect(getSearchProviderFromEnv()).toBe('serper');
    expect(normalizeSearchProviderName(' LLM-WEB ')).toBe('llm-web');
  });

  it('env 指向未注册名字时，建实例这一步抛配置错误（而不是静默退回缺省）', () => {
    process.env.SEARCH_PROVIDER = 'unknown-provider';
    expect(() => createSearchProvider(getSearchProviderFromEnv())).toThrow(SearchProviderConfigError);
  });
});
