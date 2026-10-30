// src/llm/index.test.ts
/**
 * 调用层：厂商扩展字段（extraBody）的合并规则
 *
 * 只测离线可验证的部分（假 fetch）：扩展字段进请求体，但基础字段不可被它覆盖。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invokeLLM } from './index';

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
