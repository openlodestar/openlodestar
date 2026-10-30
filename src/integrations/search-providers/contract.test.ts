// src/integrations/search-providers/contract.test.ts
/**
 * 契约初版：内置两个提供者都得过；契约本身也得抓得出违规（防空转）
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkSearchProviderContract, resultItemViolations } from './contract';
import { LlmWebSearchProvider } from './llm-web-provider';
import { SerperProvider } from './serper-provider';
import type { SearchProvider } from './types';

beforeEach(() => {
  process.env.SERPER_API_KEY = 'test-key';
  process.env.LLM_API_KEY = 'test-key';
});

afterEach(() => {
  delete process.env.SERPER_API_KEY;
  delete process.env.LLM_API_KEY;
  delete process.env.OPENLODESTAR_LLM_SEARCH_BODY;
});

describe('搜索提供者契约（初版）', () => {
  it('llm-web 过契约', async () => {
    await expect(checkSearchProviderContract(new LlmWebSearchProvider())).resolves.toEqual([]);
  });

  it('serper 过契约', async () => {
    await expect(checkSearchProviderContract(new SerperProvider())).resolves.toEqual([]);
  });

  it('契约能抓出违规（防它自己空转）', async () => {
    const bad: SearchProvider = {
      name: 'Bad Name',
      capabilities: { siteOperator: 'yes' as unknown as boolean },
      // 空查询集返回一条结果：违反「空查询短路」
      search: async () => ({
        results: [{ url: 'ftp://x', title: 't', snippet: 's', position: 0, queryIndex: 0 }],
      }),
    };
    const violations = await checkSearchProviderContract(bad);
    expect(violations.map((v) => v.clause)).toEqual(
      expect.arrayContaining(['name-slug', 'capabilities-shape', 'empty-queries']),
    );
  });

  it('结果项形状检查：合法项 0 违规，非法项逐条报', () => {
    const ok = [{ url: 'https://a.test/1', title: 't', snippet: 's', position: 1, queryIndex: 0 }];
    expect(resultItemViolations(ok, 1)).toEqual([]);

    const bad = [{ url: 'ftp://a', title: 't', snippet: 's', position: 0, queryIndex: 2 }];
    const clauses = resultItemViolations(bad, 1).map((v) => v.clause);
    // url 非 http(s) + position 0 + queryIndex 越界
    expect(clauses).toEqual(['result-shape', 'result-shape', 'result-shape']);
  });
});
