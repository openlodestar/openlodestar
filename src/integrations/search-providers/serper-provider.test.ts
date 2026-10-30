// src/integrations/search-providers/serper-provider.test.ts
/**
 * Serper 提供者单测（假 fetch，不花钱）：请求参数映射、结果映射、HTTP 错误分型、缺密钥早失败
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SerperProvider } from './serper-provider';
import { SearchProviderCallError, SearchProviderConfigError } from './errors';

const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  process.env.SERPER_API_KEY = 'test-key';
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.SERPER_API_KEY;
  delete process.env.SERPER_BASE_URL;
});

function okResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), { status: 200 });
}

describe('SerperProvider', () => {
  it('请求参数：q/num/gl/hl 按语言映射，organic 映射为结果（queryIndex 对得上）', async () => {
    // 每次调用给新的 Response：body 只能读一次，两条查询不能共用同一个对象
    fetchMock.mockImplementation(async () =>
      okResponse({
        organic: [
          { title: 'T1', link: 'https://a.test/1', snippet: 'S1', position: 1 },
          { title: 'T2', link: 'https://b.test/2', snippet: 'S2' },
        ],
      }),
    );

    const provider = new SerperProvider();
    const result = await provider.search(['瓷器 专场', 'porcelain sale'], { numResults: 5, language: 'zh-cn' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(firstBody).toMatchObject({ q: '瓷器 专场', num: 5, gl: 'cn', hl: 'zh-cn' });

    expect(result.results).toEqual([
      { url: 'https://a.test/1', title: 'T1', snippet: 'S1', position: 1, queryIndex: 0 },
      // position 缺省时用下标补（从 1 起）
      { url: 'https://b.test/2', title: 'T2', snippet: 'S2', position: 2, queryIndex: 0 },
      // 第二条查询的结果接在后面，queryIndex 可区分来源
      { url: 'https://a.test/1', title: 'T1', snippet: 'S1', position: 1, queryIndex: 1 },
      { url: 'https://b.test/2', title: 'T2', snippet: 'S2', position: 2, queryIndex: 1 },
    ]);
  });

  it('英文查询映射到 gl=us（地区偏好，不改查询词）', async () => {
    fetchMock.mockResolvedValue(okResponse({ organic: [] }));
    await new SerperProvider().search(['porcelain'], { language: 'en' });
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({ q: 'porcelain', gl: 'us', hl: 'en' });
  });

  it('HTTP 非 2xx 抛调用错误（上层据此记 failed，而非 not_found）', async () => {
    fetchMock.mockResolvedValue(new Response('quota exceeded', { status: 429, statusText: 'Too Many Requests' }));
    await expect(new SerperProvider().search(['q'], {})).rejects.toBeInstanceOf(SearchProviderCallError);
  });

  it('缺 SERPER_API_KEY 在构造时就报配置错误', () => {
    delete process.env.SERPER_API_KEY;
    expect(() => new SerperProvider()).toThrow(SearchProviderConfigError);
  });

  it('SERPER_BASE_URL 可覆盖请求地址', async () => {
    process.env.SERPER_BASE_URL = 'https://proxy.local';
    fetchMock.mockResolvedValue(okResponse({ organic: [] }));
    await new SerperProvider().search(['q'], {});
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://proxy.local/search');
  });
});
