// src/integrations/net/safe-fetch.test.ts
/**
 * 出站抓取的安全边界
 *
 * 用假 DNS 与假传输层验证判定逻辑；另起一个只监听 127.0.0.1 的本机服务，
 * 验证单跳请求的读取、体积上限与"重定向由上层决定"。
 */

import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { gzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertPublicUrl,
  isPrivateAddress,
  isUnsafeUrlError,
  requestOnce,
  resolvePublicAddresses,
  safeFetchText,
  type FetchTransport,
  type RawResponse,
  type ResolvedAddress,
} from './safe-fetch';

const PUBLIC: ResolvedAddress[] = [{ address: '93.184.216.34', family: 4 }];

function rawResponse(
  status: number,
  body: string | Buffer = '',
  headers: http.IncomingHttpHeaders = {},
): RawResponse {
  return {
    status,
    statusText: status === 302 ? 'Found' : 'OK',
    headers,
    body: Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8'),
  };
}

function unsafeReason(action: () => unknown): string | undefined {
  try {
    action();
    return undefined;
  } catch (error) {
    return isUnsafeUrlError(error) ? error.reason : `other:${String(error)}`;
  }
}

describe('私网与保留地址判定', () => {
  it.each([
    '0.0.0.0',
    '10.0.0.1',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.0.0.1',
    '192.0.2.1',
    '192.168.1.1',
    '198.18.0.1',
    '198.51.100.7',
    '203.0.113.9',
    '224.0.0.1',
    '255.255.255.255',
    '::',
    '::1',
    '::ffff:127.0.0.1',
    '64:ff9b::a00:1',
    '2002:7f00:1::',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    'ff02::1',
    '2001:db8::1',
    '2001::1',
  ])('拒绝 %s', (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each(['8.8.8.8', '1.1.1.1', '93.184.216.34', '2606:4700:4700::1111', '2001:4860:4860::8888'])(
    '放行公网地址 %s',
    (address) => {
      expect(isPrivateAddress(address)).toBe(false);
    },
  );

  it('无法识别的字符串按不安全处理', () => {
    expect(isPrivateAddress('not-an-ip')).toBe(true);
    expect(isPrivateAddress('')).toBe(true);
  });
});

describe('URL 同步校验', () => {
  it('只允许 http/https', () => {
    expect(unsafeReason(() => assertPublicUrl('file:///etc/passwd'))).toBe('protocol');
    expect(unsafeReason(() => assertPublicUrl('ftp://example.com/x'))).toBe('protocol');
  });

  it('拒绝带凭据的 URL', () => {
    expect(unsafeReason(() => assertPublicUrl('https://user:pass@example.com/'))).toBe('credentials');
  });

  it('拒绝 localhost、其子域与本机字面量', () => {
    expect(unsafeReason(() => assertPublicUrl('http://localhost:3000/'))).toBe('private_host');
    expect(unsafeReason(() => assertPublicUrl('http://a.localhost/'))).toBe('private_host');
    expect(unsafeReason(() => assertPublicUrl('http://127.0.0.1/'))).toBe('private_address');
    expect(unsafeReason(() => assertPublicUrl('http://[::1]/'))).toBe('private_address');
  });

  it('十进制与十六进制写法的 IPv4 也按规范化后的地址拦截', () => {
    expect(unsafeReason(() => assertPublicUrl('http://0x7f000001/'))).toBe('private_address');
    expect(unsafeReason(() => assertPublicUrl('http://2130706433/'))).toBe('private_address');
  });

  it('正常公网 URL 放行', () => {
    expect(assertPublicUrl('https://example.com/a?b=1').hostname).toBe('example.com');
  });
});

describe('DNS 解析结果校验', () => {
  it('任一条解析结果是私网就整体拒绝', async () => {
    const resolveHost = vi.fn(async () => [
      { address: '93.184.216.34', family: 4 as const },
      { address: '10.0.0.5', family: 4 as const },
    ]);
    await expect(resolvePublicAddresses('example.com', resolveHost)).rejects.toMatchObject({
      reason: 'private_address',
    });
  });

  it('解析失败时拒绝（不把失败当放行）', async () => {
    const resolveHost = vi.fn(async () => {
      throw new Error('ENOTFOUND');
    });
    await expect(resolvePublicAddresses('example.com', resolveHost)).rejects.toMatchObject({
      reason: 'resolve_failed',
    });
  });
});

describe('safeFetchText 的重定向与解码', () => {
  it('重定向到私网地址时拒绝，且不会发出第二跳', async () => {
    const resolveHost = vi.fn(async () => PUBLIC);
    const transport = vi.fn(async () => rawResponse(302, '', { location: 'http://127.0.0.1/secret' }));
    await expect(
      safeFetchText('https://example.com/start', { timeoutMs: 1000, resolveHost, transport }),
    ).rejects.toMatchObject({ reason: 'private_address' });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('解析结果是私网时不发请求', async () => {
    const resolveHost = vi.fn(async () => [{ address: '10.0.0.5', family: 4 as const }]);
    const transport = vi.fn(async () => rawResponse(200, '不该到这里'));
    await expect(
      safeFetchText('https://example.com/', { timeoutMs: 1000, resolveHost, transport }),
    ).rejects.toMatchObject({ reason: 'private_address' });
    expect(transport).not.toHaveBeenCalled();
  });

  it('公网重定向逐跳跟随', async () => {
    const resolveHost = vi.fn(async () => PUBLIC);
    const transport = vi
      .fn<FetchTransport>()
      .mockResolvedValueOnce(rawResponse(302, '', { location: 'https://example.org/next' }))
      .mockResolvedValueOnce(rawResponse(200, '到了'));
    const text = await safeFetchText('https://example.com/start', { timeoutMs: 1000, resolveHost, transport });
    expect(text).toBe('到了');
    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport.mock.calls[1]?.[0].hostname).toBe('example.org');
  });

  it('重定向次数超限即停止', async () => {
    const resolveHost = vi.fn(async () => PUBLIC);
    const transport = vi.fn(async () => rawResponse(302, '', { location: 'https://example.com/again' }));
    await expect(
      safeFetchText('https://example.com/start', { timeoutMs: 1000, resolveHost, transport, maxRedirects: 2 }),
    ).rejects.toThrow(/重定向超过 2 次/);
    expect(transport).toHaveBeenCalledTimes(3);
  });

  it('非 2xx 抛出 HTTP 状态', async () => {
    const resolveHost = vi.fn(async () => PUBLIC);
    const transport = vi.fn(async () => rawResponse(403, ''));
    await expect(
      safeFetchText('https://example.com/', { timeoutMs: 1000, resolveHost, transport }),
    ).rejects.toThrow(/HTTP 403/);
  });

  it('gzip 响应按 content-encoding 解压', async () => {
    const resolveHost = vi.fn(async () => PUBLIC);
    const compressed = gzipSync(Buffer.from('<html>压缩过的正文</html>'));
    const transport = vi.fn(async () => rawResponse(200, compressed, { 'content-encoding': 'gzip' }));
    const text = await safeFetchText('https://example.com/', { timeoutMs: 1000, resolveHost, transport });
    expect(text).toContain('压缩过的正文');
  });

  it('不安全的 URL 抛 UnsafeUrlError（供上层决定不降级）', async () => {
    try {
      await safeFetchText('http://127.0.0.1/', { timeoutMs: 1000 });
      expect.unreachable('应当被拒绝');
    } catch (error) {
      expect(isUnsafeUrlError(error)).toBe(true);
    }
  });
});

describe('requestOnce 单跳请求', () => {
  let server: http.Server;
  let base: string;

  beforeEach(async () => {
    server = http.createServer((request, response) => {
      if (request.url === '/redirect') {
        response.writeHead(302, { Location: '/target' });
        response.end();
        return;
      }
      if (request.url === '/big') {
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.end('x'.repeat(4096));
        return;
      }
      if (request.url === '/hang') {
        return; // 永不响应，用来测总时长上限
      }
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end('<html>本机测试页</html>');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    base = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const local: ResolvedAddress[] = [{ address: '127.0.0.1', family: 4 }];

  it('读取响应体', async () => {
    const response = await requestOnce(new URL(`${base}/page`), local, {
      timeoutMs: 2000,
      maxBytes: 1024 * 1024,
      headers: {},
    });
    expect(response.status).toBe(200);
    expect(response.body.toString('utf8')).toContain('本机测试页');
  });

  it('重定向原样返回（不自行跟随）', async () => {
    const response = await requestOnce(new URL(`${base}/redirect`), local, {
      timeoutMs: 2000,
      maxBytes: 1024 * 1024,
      headers: {},
    });
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/target');
  });

  it('响应超过体积上限即中止', async () => {
    await expect(
      requestOnce(new URL(`${base}/big`), local, { timeoutMs: 2000, maxBytes: 1024, headers: {} }),
    ).rejects.toThrow(/字节上限/);
  });

  it('总时长超时即中止（不依赖 socket 空闲）', async () => {
    await expect(
      requestOnce(new URL(`${base}/hang`), local, { timeoutMs: 100, maxBytes: 1024, headers: {} }),
    ).rejects.toThrow(/抓取超时/);
  });
});
