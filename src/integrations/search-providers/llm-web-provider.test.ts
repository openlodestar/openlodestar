// src/integrations/search-providers/llm-web-provider.test.ts
/**
 * llm-web 提供者单测（假模型，不花钱）：解析、错误分型、请求体扩展、空查询短路
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeInvokeParams {
  extraBody?: Record<string, unknown>;
  temperature?: number;
}

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn<
    (role: string, messages: unknown, params?: FakeInvokeParams) => Promise<{ content: string; isCacheHit: boolean; model: string }>
  >(),
}));

// 只替换网络调用，保留真实的 JSON 提取（extractJsonArray 的剥围栏行为要一起测）
vi.mock('../../llm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../llm')>();
  return { ...actual, invokeLLM: invokeMock };
});

import { LlmWebSearchProvider } from './llm-web-provider';
import { SearchProviderCallError, SearchProviderConfigError, SearchProviderParseError } from './errors';

beforeEach(() => {
  invokeMock.mockReset();
  process.env.LLM_API_KEY = 'test-key';
  delete process.env.OPENLODESTAR_LLM_SEARCH_BODY;
});

afterEach(() => {
  delete process.env.LLM_API_KEY;
  delete process.env.OPENLODESTAR_LLM_SEARCH_BODY;
});

function reply(content: string): { content: string; isCacheHit: boolean; model: string } {
  return { content, isCacheHit: false, model: 'fake' };
}

describe('LlmWebSearchProvider', () => {
  it('围栏 JSON 解析成结果：position 从 1 起、queryIndex 对得上', async () => {
    invokeMock.mockResolvedValue(
      reply('```json\n[{"url":"https://a.test/1","title":"A","snippet":"S1"},{"url":"https://b.test/2","title":"B"}]\n```'),
    );

    const result = await new LlmWebSearchProvider().search(['q1'], { numResults: 10, language: 'zh-cn' });

    expect(result.results).toEqual([
      { url: 'https://a.test/1', title: 'A', snippet: 'S1', position: 1, queryIndex: 0 },
      { url: 'https://b.test/2', title: 'B', snippet: '', position: 2, queryIndex: 0 },
    ]);
    // 默认请求体扩展：DashScope 兼容模式的联网开关
    expect(invokeMock.mock.calls[0]?.[2]?.extraBody).toEqual({ enable_search: true });
    expect(invokeMock.mock.calls[0]?.[0]).toBe('web-search');
  });

  it('多条查询逐条问模型，queryIndex 区分来源', async () => {
    invokeMock.mockImplementation(async (_role, messages) => {
      const prompt = (messages as Array<{ content: string }>)[0]?.content ?? '';
      const url = prompt.includes('q1') ? 'https://a.test/1' : 'https://b.test/2';
      return reply(JSON.stringify([{ url, title: 'T', snippet: 'S' }]));
    });

    const result = await new LlmWebSearchProvider().search(['q1', 'q2'], {});
    expect(invokeMock).toHaveBeenCalledTimes(2);
    expect(result.results.map((r) => [r.url, r.queryIndex])).toEqual([
      ['https://a.test/1', 0],
      ['https://b.test/2', 1],
    ]);
  });

  it('模型答非所问（不是 JSON 数组）→ 解析错误，不伪装成「没搜到」', async () => {
    invokeMock.mockResolvedValue(reply('抱歉，我找不到相关资料。'));
    await expect(new LlmWebSearchProvider().search(['q'], {})).rejects.toBeInstanceOf(SearchProviderParseError);
  });

  it('非空数组但没有一条 http(s) 链接 → 解析错误（模型在编 URL）', async () => {
    invokeMock.mockResolvedValue(reply('[{"url":"ftp://x","title":"t"},{"url":"not-a-url"}]'));
    await expect(new LlmWebSearchProvider().search(['q'], {})).rejects.toBeInstanceOf(SearchProviderParseError);
  });

  it('模型诚实返回 [] → 空结果，不抛', async () => {
    invokeMock.mockResolvedValue(reply('[]'));
    await expect(new LlmWebSearchProvider().search(['q'], {})).resolves.toEqual({ results: [] });
  });

  it('OPENLODESTAR_LLM_SEARCH_BODY 可换请求体扩展（OpenAI 原生搜索模型）', async () => {
    process.env.OPENLODESTAR_LLM_SEARCH_BODY = '{"web_search_options":{}}';
    invokeMock.mockResolvedValue(reply('[]'));
    await new LlmWebSearchProvider().search(['q'], {});
    expect(invokeMock.mock.calls[0]?.[2]?.extraBody).toEqual({ web_search_options: {} });
  });

  it('请求体扩展写坏 → 构造时配置错误（早于任何计费调用）', () => {
    process.env.OPENLODESTAR_LLM_SEARCH_BODY = '{not json';
    expect(() => new LlmWebSearchProvider()).toThrow(SearchProviderConfigError);
    process.env.OPENLODESTAR_LLM_SEARCH_BODY = '["array"]';
    expect(() => new LlmWebSearchProvider()).toThrow(SearchProviderConfigError);
  });

  it('缺 LLM_API_KEY 在构造时就报配置错误', () => {
    delete process.env.LLM_API_KEY;
    expect(() => new LlmWebSearchProvider()).toThrow(SearchProviderConfigError);
  });

  it('模型调用失败包装成调用错误', async () => {
    invokeMock.mockRejectedValue(new Error('429 rate limited'));
    const error = await new LlmWebSearchProvider().search(['q'], {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SearchProviderCallError);
    expect((error as Error).message).toContain('429');
  });

  it('空查询集短路：不调用模型（契约条款）', async () => {
    const result = await new LlmWebSearchProvider().search([], {});
    expect(result).toEqual({ results: [] });
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
