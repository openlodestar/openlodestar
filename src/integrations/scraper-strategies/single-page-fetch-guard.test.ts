// src/integrations/scraper-strategies/single-page-fetch-guard.test.ts
/**
 * 抓取入口的 SSRF 防线接线
 *
 * 不 mock 安全模块：验证 `fetchSinglePageHtml` 真的把不安全 URL 拦在
 * 裸抓与浏览器渲染之前，且不会发出任何连接。
 */

import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { registerBrowserPlugin, unregisterBrowserPlugin } from '@src/integrations/browser-plugins';
import { isUnsafeUrlError } from '@src/integrations/net/safe-fetch';
import { fetchSinglePageHtml } from './single-page-fetch';

const PLUGIN = 'guard-fake-browser';
let render: Mock<(url: string, options?: { timeoutMs?: number }) => Promise<string>>;
let server: http.Server;
let base: string;
let hits: number;

beforeEach(async () => {
  hits = 0;
  server = http.createServer((_request, response) => {
    hits += 1;
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end('<html>不该被访问到</html>');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  render = vi.fn(async () => '<html>浏览器也不该被调用</html>');
  registerBrowserPlugin(PLUGIN, () => ({ name: PLUGIN, render }));
  process.env.BROWSER_PLUGIN = PLUGIN;
});

afterEach(async () => {
  unregisterBrowserPlugin(PLUGIN);
  delete process.env.BROWSER_PLUGIN;
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function expectUnsafe(error: unknown): void {
  expect(isUnsafeUrlError(error)).toBe(true);
}

describe('不安全 URL 在两条抓取路径之前被拦下', () => {
  it('私网字面量：拒绝且不发起连接、不启动浏览器', async () => {
    try {
      await fetchSinglePageHtml(`${base}/secret`);
      expect.unreachable('应当拒绝');
    } catch (error) {
      expectUnsafe(error);
    }
    expect(hits).toBe(0);
    expect(render).not.toHaveBeenCalled();
  });

  it('localhost：拒绝且不发起连接', async () => {
    await expect(fetchSinglePageHtml(`http://localhost:${(server.address() as AddressInfo).port}/`)).rejects.toThrow(
      /本机地址/,
    );
    expect(hits).toBe(0);
  });

  it('非 http/https 协议：拒绝', async () => {
    await expect(fetchSinglePageHtml('file:///etc/passwd')).rejects.toThrow(/http\/https/);
  });

  it('forceBrowser 同样先过防线', async () => {
    await expect(fetchSinglePageHtml(`${base}/secret`, { forceBrowser: true })).rejects.toThrow(/非公网地址/);
    expect(hits).toBe(0);
    expect(render).not.toHaveBeenCalled();
  });
});
