// src/integrations/search-providers/serper-provider.test.ts
/**
 * Serper 提供者单测（假 fetch，不花钱）：请求参数映射、结果映射、HTTP 错误分型、
 * 缺密钥早失败，以及超时与瞬时重试
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SerperProvider } from './serper-provider';
import { SearchProviderCallError, SearchProviderConfigError } from './errors';

const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  process.env.SERPER_API_KEY = 'test-key';
  // 退避压到 0：重试行为要测得到，但不能让测试真等
  process.env.SERPER_RETRY_BACKOFF_MS = '0';
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.SERPER_API_KEY;
  delete process.env.SERPER_BASE_URL;
  delete process.env.SERPER_TIMEOUT_MS;
  delete process.env.SERPER_RETRIES;
  delete process.env.SERPER_RETRY_BACKOFF_MS;
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

/**
 * 超时与瞬时重试。2026-11-01 两场在线重放各有 8/13 条断言卡在检索层：那次既没有超时
 * 也没有重试，一条坏查询只能等运行时的默认值（连不上约 10.7 秒，接了不回数据 300 秒）。
 */
describe('SerperProvider 的超时与重试', () => {
  /** 假 fetch：不看信号就不回，信号一 abort 就以指定错误名拒绝——真 fetch 的超时就是这个形状 */
  function fetchThatRejectsOnAbort(errorName: string, message: string) {
    return (_input: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) return;
        const abort = () => reject(Object.assign(new Error(message), { name: errorName }));
        if (signal.aborted) abort();
        else signal.addEventListener('abort', abort, { once: true });
      });
  }

  it('超时确实挂在请求上（写了 AbortSignal 却没传给 fetch ＝ 空转）', async () => {
    fetchMock.mockResolvedValue(okResponse({ organic: [] }));
    await new SerperProvider().search(['q'], {});
    const signal = fetchMock.mock.calls[0]?.[1]?.signal;
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  it('超时算瞬时：重试一次仍超时才抛出，且抛的是超时错误', async () => {
    process.env.SERPER_TIMEOUT_MS = '5';
    const hanging = vi.fn(fetchThatRejectsOnAbort('TimeoutError', 'The operation was aborted due to timeout'));
    vi.stubGlobal('fetch', hanging);
    await expect(new SerperProvider().search(['q'], {})).rejects.toThrow(/aborted due to timeout/);
    expect(hanging).toHaveBeenCalledTimes(2);
  });

  it('连接类失败（fetch failed）重试一次后成功——一次抖动不该让整条断言作废', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValueOnce(okResponse({ organic: [{ title: 'T', link: 'https://a.test/1', snippet: 'S' }] }));

    const result = await new SerperProvider().search(['q'], {});

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.results.map((item) => item.url)).toEqual(['https://a.test/1']);
  });

  it('重试次数用尽后原样抛出（保持基础设施失败的分型，不许变成阴性结论）', async () => {
    fetchMock.mockRejectedValue(new Error('fetch failed'));
    await expect(new SerperProvider().search(['q'], {})).rejects.toThrow('fetch failed');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('HTTP 状态码错误不重试：Serper 按请求计费，限流时重试只会再吃一次额度', async () => {
    fetchMock.mockResolvedValue(new Response('quota', { status: 429, statusText: 'Too Many Requests' }));
    await expect(new SerperProvider().search(['q'], {})).rejects.toBeInstanceOf(SearchProviderCallError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('SERPER_RETRIES=0 可关掉重试', async () => {
    process.env.SERPER_RETRIES = '0';
    fetchMock.mockRejectedValue(new Error('fetch failed'));
    await expect(new SerperProvider().search(['q'], {})).rejects.toThrow('fetch failed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
