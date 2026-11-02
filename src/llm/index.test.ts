// src/llm/index.test.ts
/**
 * 调用层：厂商扩展字段（extraBody）的合并规则 + 单次超时与重试的可覆盖性
 *
 * 只测离线可验证的部分（假 fetch）：扩展字段进请求体，但基础字段不可被它覆盖；
 * `timeoutMs` / `maxRetries` 真的落到那一次 fetch 上——这是"一问一答的调用别背 12 分钟
 * 尾巴"（quickCallParams）唯一的落地点，不钉住就会在下次改角色注册表时被悄悄改回默认值。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invokeLLM, quickCallParams } from './index';

const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  process.env.LLM_API_KEY = 'test-key';
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.LLM_API_KEY;
  delete process.env.LLM_BASE_URL;
  delete process.env.LODESTAR_QUICK_CALL_TIMEOUT_MS;
  delete process.env.LODESTAR_QUICK_CALL_RETRIES;
});

describe('invokeLLM — extraBody', () => {
  it('扩展字段合并进请求体；model / messages 等基础字段不可被它覆盖', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 }),
    );

    const result = await invokeLLM('web-search', '查一下', {
      temperature: 0,
      extraBody: { enable_search: true, model: 'hijack', messages: 'hijack' },
    });

    expect(result.content).toBe('ok');
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({ enable_search: true, temperature: 0 });
    expect(body.model).not.toBe('hijack');
    expect(Array.isArray(body.messages)).toBe(true);
  });

  it('没给 extraBody 时请求体里不出现厂商字段', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '' } }] }), { status: 200 }));
    await invokeLLM('text', 'hi');
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).not.toHaveProperty('enable_search');
    expect(body).not.toHaveProperty('web_search_options');
  });
});

describe('invokeLLM — 单次超时与重试可被调用方压短', () => {
  /** 假 fetch：响应永不落地，只跟着 signal 醒来——真到点才说明超时值传下去了 */
  function hangingFetch(options: { abortsAfterMs?: number } = {}) {
    return vi.fn(async (_input: string, init?: RequestInit) => {
      await new Promise<void>((resolve) => {
        const signal = init?.signal;
        if (!signal) return;
        if (options.abortsAfterMs !== undefined) {
          setTimeout(() => resolve(), options.abortsAfterMs);
          return;
        }
        if (signal.aborted) resolve();
        else signal.addEventListener('abort', () => resolve(), { once: true });
      });
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    });
  }

  it('params.timeoutMs 生效：到点就抛，不等角色默认的 180 秒', async () => {
    const hanging = hangingFetch();
    fetchMock.mockImplementation(hanging);

    await expect(invokeLLM('text', 'hi', { timeoutMs: 50, maxRetries: 0 })).rejects.toThrow(/timeout/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('params.maxRetries 决定尝试次数：0 = 一次都不重试', async () => {
    fetchMock.mockRejectedValue(new Error('fetch failed'));
    await expect(invokeLLM('text', 'hi', { maxRetries: 0 })).rejects.toThrow('fetch failed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('params.maxRetries=1 时网络错误重试一次（共两次尝试）', async () => {
    // 退避是 500 × 2^attempt，所以这一条会真等约 0.5 秒——不为这点时间引入假定时器，
    // 假定时器会让 AbortSignal.timeout 的计时一起被冻结，读数反而不可信
    fetchMock.mockRejectedValue(new Error('fetch failed'));
    await expect(invokeLLM('text', 'hi', { maxRetries: 1 })).rejects.toThrow('fetch failed');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }, 15_000);

  it('quickCallParams 默认 60 秒 × 2 次尝试，env 可覆盖（0 也算数）', async () => {
    expect(quickCallParams()).toEqual({ timeoutMs: 60_000, maxRetries: 1 });

    process.env.LODESTAR_QUICK_CALL_TIMEOUT_MS = '8000';
    process.env.LODESTAR_QUICK_CALL_RETRIES = '0';
    expect(quickCallParams()).toEqual({ timeoutMs: 8_000, maxRetries: 0 });
    delete process.env.LODESTAR_QUICK_CALL_TIMEOUT_MS;
    delete process.env.LODESTAR_QUICK_CALL_RETRIES;

    process.env.LODESTAR_QUICK_CALL_TIMEOUT_MS = 'not-a-number';
    expect(quickCallParams().timeoutMs).toBe(60_000);
    delete process.env.LODESTAR_QUICK_CALL_TIMEOUT_MS;
  });
});
