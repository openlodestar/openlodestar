// src/integrations/net/safe-fetch.ts
/**
 * 出站抓取的安全边界（SSRF 防护）
 *
 * 抓取的 URL 来自搜索返回，属于**不可信输入**：搜索引擎可能返回内网地址，
 * 页面也可能用 302 把人带到云元数据端点（169.254.169.254）。本模块负责：
 *
 * 1. 只允许 http/https，拒绝带用户名/密码的 URL；
 * 2. 拒绝字面量形式的私网/回环/链路本地/保留地址，以及 `localhost`；
 * 3. 域名先解析、再检查解析结果，任何一条落在私网段就整体拒绝（不挑"看起来能用"的那条）；
 * 4. 重定向自己跟：每一跳重新做 1–3，最多 5 跳；
 * 5. 连接固定到校验过的 IP（自定义 `lookup`），避免"校验时公网、连接时私网"的 DNS 重绑定窗口；
 * 6. 响应体积上限与整体超时，防止一张无限流量的页面拖住作业。
 *
 * 仍有一个残余窗口：浏览器渲染插件自行解析域名，无法复用这里的 IP 固定；
 * 调用方在交给浏览器前会再核对一次解析结果，但 DNS 重绑定在理论上仍可能发生。
 * 浏览器插件的定位是"渲染工具"，不是安全边界。
 */

import { promises as dns } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import { brotliDecompressSync, gunzipSync, inflateSync } from 'node:zlib';

/** 拒绝抓取的原因（调用方据此决定是否允许浏览器降级） */
export type UnsafeUrlReason =
  | 'invalid_url'
  | 'protocol'
  | 'credentials'
  | 'private_host'
  | 'private_address'
  | 'resolve_failed';

/** URL 不在允许抓取的范围内：**不得**降级到其它网络通路重试 */
export class UnsafeUrlError extends Error {
  readonly reason: UnsafeUrlReason;

  constructor(reason: UnsafeUrlReason, message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
    this.reason = reason;
  }
}

export function isUnsafeUrlError(error: unknown): error is UnsafeUrlError {
  return error instanceof UnsafeUrlError;
}

/** 一条解析结果 */
export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

/** 单跳响应（重定向也原样返回，由 `safeFetchText` 决定是否继续） */
export interface RawResponse {
  status: number;
  statusText: string;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}

/** 单跳请求：默认实现会固定到已校验的地址；测试可注入替身 */
export type FetchTransport = (
  url: URL,
  addresses: ResolvedAddress[],
  options: { timeoutMs: number; maxBytes: number; headers: Record<string, string> },
) => Promise<RawResponse>;

/** `safeFetchText` 的选项 */
export interface SafeFetchOptions {
  timeoutMs: number;
  headers?: Record<string, string>;
  maxRedirects?: number;
  maxBytes?: number;
  /** 测试注入：域名解析（默认系统 DNS） */
  resolveHost?: (hostname: string) => Promise<ResolvedAddress[]>;
  /** 测试注入：单跳请求（默认固定 IP 连接） */
  transport?: FetchTransport;
}

const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;
const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);

/** 去掉 IPv6 方括号、结尾的点与大小写差异后的主机名 */
function normalizeHostname(hostname: string): string {
  let host = hostname.trim().toLowerCase();
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);
  return host.replace(/\.+$/, '');
}

function parseIpv4(address: string): number[] | null {
  const parts = address.split('.');
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const value = Number(part);
    if (value > 255) return null;
    octets.push(value);
  }
  return octets;
}

function isPrivateIpv4(address: string): boolean {
  const octets = parseIpv4(address);
  if (!octets) return true; // 解析不了就按不安全处理（fail closed）
  const [a, b, c] = octets as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127 || a >= 224) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a === 169 && b === 254) return true; // 链路本地（含云元数据 169.254.169.254）
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true; // 192.0.0/24、TEST-NET-1
  if (a === 192 && b === 88 && c === 99) return true; // 6to4 中继任播
  if (a === 198 && (b === 18 || b === 19)) return true; // 基准测试
  if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
  return false;
}

/** 把 IPv6 展开成 8 个 16 位分组；非法返回 null */
function parseIpv6(address: string): number[] | null {
  const addr = address.split('%')[0]?.toLowerCase() ?? '';
  if (!addr.includes(':')) return null;
  const halves = addr.split('::');
  if (halves.length > 2) return null;

  const toGroups = (text: string): number[] | null => {
    if (text === '') return [];
    const raw = text.split(':');
    const groups: number[] = [];
    for (let i = 0; i < raw.length; i += 1) {
      const part = raw[i] ?? '';
      if (part.includes('.')) {
        if (i !== raw.length - 1) return null;
        const v4 = parseIpv4(part);
        if (!v4) return null;
        groups.push(((v4[0] ?? 0) << 8) | (v4[1] ?? 0));
        groups.push(((v4[2] ?? 0) << 8) | (v4[3] ?? 0));
        continue;
      }
      if (!/^[0-9a-f]{1,4}$/.test(part)) return null;
      groups.push(parseInt(part, 16));
    }
    return groups;
  };

  const head = toGroups(halves[0] ?? '');
  const tail = halves.length === 2 ? toGroups(halves[1] ?? '') : [];
  if (!head || !tail) return null;
  if (halves.length === 2) {
    const zeros = 8 - head.length - tail.length;
    if (zeros < 1) return null;
    return [...head, ...Array<number>(zeros).fill(0), ...tail];
  }
  return head.length === 8 ? head : null;
}

function ipv4FromGroups(high: number, low: number): string {
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');
}

function isPrivateIpv6(address: string): boolean {
  const groups = parseIpv6(address);
  if (!groups) return true;
  const zero = (start: number, end: number): boolean => groups.slice(start, end).every((v) => v === 0);
  if (zero(0, 8)) return true; // ::
  if (zero(0, 7) && groups[7] === 1) return true; // ::1
  if (zero(0, 5) && groups[5] === 0xffff) return isPrivateIpv4(ipv4FromGroups(groups[6] ?? 0, groups[7] ?? 0));
  if (zero(0, 6)) return true; // IPv4-compatible 与保留段
  if (groups[0] === 0x0064 && groups[1] === 0xff9b && zero(2, 6)) {
    return isPrivateIpv4(ipv4FromGroups(groups[6] ?? 0, groups[7] ?? 0)); // NAT64
  }
  if (groups[0] === 0x2002) return isPrivateIpv4(ipv4FromGroups(groups[1] ?? 0, groups[2] ?? 0)); // 6to4
  if (((groups[0] ?? 0) & 0xfe00) === 0xfc00) return true; // 唯一本地 fc00::/7
  if (((groups[0] ?? 0) & 0xffc0) === 0xfe80) return true; // 链路本地 fe80::/10
  if (((groups[0] ?? 0) & 0xff00) === 0xff00) return true; // 组播 ff00::/8
  if (groups[0] === 0x2001 && groups[1] === 0x0db8) return true; // 文档段
  if (groups[0] === 0x0100 && zero(1, 4)) return true; // 丢弃段 100::/64
  if (groups[0] === 0x2001 && groups[1] === 0) return true; // Teredo 2001::/32
  return false;
}

/** 是否私网/回环/链路本地/保留地址；无法识别的一律按不安全处理 */
export function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family === 6) return isPrivateIpv6(address);
  return true;
}

/** 只允许 http/https、无凭据、非私网字面量与非 localhost；不做 DNS 解析 */
export function assertPublicUrl(raw: string | URL): URL {
  let url: URL;
  try {
    url = new URL(raw.toString());
  } catch {
    throw new UnsafeUrlError('invalid_url', `不是合法的 URL：${String(raw)}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeUrlError('protocol', `只允许抓取 http/https，拒绝 ${url.protocol}`);
  }
  if (url.username !== '' || url.password !== '') {
    throw new UnsafeUrlError('credentials', 'URL 含用户名或密码，已拒绝抓取');
  }
  const host = normalizeHostname(url.hostname);
  if (host === '') throw new UnsafeUrlError('invalid_url', `URL 缺少主机名：${url.toString()}`);
  if (host === 'localhost' || host.endsWith('.localhost')) {
    throw new UnsafeUrlError('private_host', `拒绝抓取本机地址：${host}`);
  }
  if (isIP(host) !== 0 && isPrivateAddress(host)) {
    throw new UnsafeUrlError('private_address', `拒绝抓取非公网地址：${host}`);
  }
  return url;
}

/** 解析域名并要求**所有**结果都是公网地址；失败或落私网都抛 `UnsafeUrlError` */
export async function resolvePublicAddresses(
  hostname: string,
  resolveHost: (hostname: string) => Promise<ResolvedAddress[]> = async (name) => {
    const results = await dns.lookup(name, { all: true, verbatim: true });
    return results.map((item) => ({ address: item.address, family: item.family === 6 ? 6 : 4 }));
  },
): Promise<ResolvedAddress[]> {
  const host = normalizeHostname(hostname);
  let addresses: ResolvedAddress[];
  try {
    addresses = await resolveHost(host);
  } catch (error) {
    throw new UnsafeUrlError(
      'resolve_failed',
      `无法解析主机名 ${host}：${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (addresses.length === 0) throw new UnsafeUrlError('resolve_failed', `主机名 ${host} 没有解析结果`);
  for (const item of addresses) {
    if (isPrivateAddress(item.address)) {
      throw new UnsafeUrlError('private_address', `主机名 ${host} 解析到非公网地址 ${item.address}，已拒绝抓取`);
    }
  }
  return addresses;
}

/** 字面量 IP 的主机不需要 DNS；域名返回 null */
function literalAddress(url: URL): ResolvedAddress | null {
  const host = normalizeHostname(url.hostname);
  const family = isIP(host);
  if (family === 4) return { address: host, family: 4 };
  if (family === 6) return { address: host, family: 6 };
  return null;
}

/**
 * 浏览器渲染前的核对：域名必须解析到公网。
 * 浏览器会自行再解析一次，因此这只能缩小、不能消除 DNS 重绑定窗口。
 */
export async function assertPublicHostResolves(
  url: URL,
  resolveHost?: (hostname: string) => Promise<ResolvedAddress[]>,
): Promise<void> {
  if (literalAddress(url)) return;
  await resolvePublicAddresses(url.hostname, resolveHost);
}

/** 把连接固定到已校验的地址；证书校验仍按原主机名进行 */
function pinnedLookup(addresses: ResolvedAddress[]): LookupFunction {
  return (_hostname, options, callback) => {
    if (options.all) {
      callback(
        null,
        addresses.map((item) => ({ address: item.address, family: item.family })),
      );
      return;
    }
    const first = addresses[0];
    if (!first) {
      callback(new Error('没有可用的解析地址'), '');
      return;
    }
    callback(null, first.address, first.family);
  };
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function decodeBody(body: Buffer, encoding: string | undefined, maxBytes: number): Buffer {
  const normalized = (encoding ?? '').trim().toLowerCase();
  if (normalized === '' || normalized === 'identity') return body;
  const limit = Math.max(maxBytes * 4, 1024 * 1024);
  try {
    if (normalized === 'gzip' || normalized === 'x-gzip') return gunzipSync(body, { maxOutputLength: limit });
    if (normalized === 'deflate') return inflateSync(body, { maxOutputLength: limit });
    if (normalized === 'br') return brotliDecompressSync(body, { maxOutputLength: limit });
  } catch (error) {
    throw new Error(`响应解压失败（content-encoding: ${normalized}）：${error instanceof Error ? error.message : String(error)}`);
  }
  throw new Error(`不支持的 content-encoding: ${normalized}`);
}

/**
 * 单跳 HTTP 请求（默认传输层）。
 *
 * 导出仅供测试与安全审计：它不做 URL/地址校验，调用方必须先把地址校验好。
 */
export async function requestOnce(
  url: URL,
  addresses: ResolvedAddress[],
  options: { timeoutMs: number; maxBytes: number; headers: Record<string, string> },
): Promise<RawResponse> {
  const mod = url.protocol === 'https:' ? https : http;
  return new Promise<RawResponse>((resolve, reject) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const fail = (error: Error): void => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      request.destroy();
      reject(error);
    };

    const request = mod.request(
      url,
      {
        method: 'GET',
        headers: options.headers,
        lookup: pinnedLookup(addresses),
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > options.maxBytes) {
            fail(new Error(`响应超过 ${options.maxBytes} 字节上限`));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => {
          if (settled) return;
          settled = true;
          if (timer) clearTimeout(timer);
          resolve({
            status: response.statusCode ?? 0,
            statusText: response.statusMessage ?? '',
            headers: response.headers,
            body: Buffer.concat(chunks),
          });
        });
        response.on('error', (error: Error) => fail(error));
      },
    );
    // 总时长上限：不只是 socket 空闲超时，防止服务端慢速滴流把一页拖成无限长
    timer = setTimeout(() => {
      fail(new Error(`抓取超时（${options.timeoutMs}ms）`));
    }, options.timeoutMs);
    request.on('error', (error: Error) => fail(error));
    request.end();
  });
}

/**
 * 带安全边界地取回文本（HTML）。
 *
 * @throws {UnsafeUrlError} URL 或任何一跳重定向指向不允许的地址
 */
export async function safeFetchText(rawUrl: string | URL, options: SafeFetchOptions): Promise<string> {
  const deadline = Date.now() + options.timeoutMs;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const headers: Record<string, string> = { 'Accept-Encoding': 'identity', ...(options.headers ?? {}) };
  const transport = options.transport ?? requestOnce;
  let current = assertPublicUrl(rawUrl);

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error(`抓取超时（${options.timeoutMs}ms）`);
    const addresses = literalAddress(current)
      ? [literalAddress(current) as ResolvedAddress]
      : await resolvePublicAddresses(current.hostname, options.resolveHost);
    const response = await transport(current, addresses, { timeoutMs: remaining, maxBytes, headers });

    if (REDIRECT_STATUS.has(response.status)) {
      const location = headerValue(response.headers.location);
      if (!location) throw new Error(`HTTP ${response.status} 重定向缺少 Location`);
      current = assertPublicUrl(new URL(location, current));
      continue;
    }
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return decodeBody(response.body, headerValue(response.headers['content-encoding']), maxBytes).toString('utf8');
  }
  throw new Error(`重定向超过 ${maxRedirects} 次，已停止`);
}
