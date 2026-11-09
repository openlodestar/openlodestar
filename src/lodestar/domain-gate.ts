// src/lodestar/domain-gate.ts
/**
 * 域名真实性闸：抓页前先判地址是否存在
 *
 * 为什么单独一道闸：搜索结果里混着**模型编出来的域名**（例如 `china-guardian.com`，
 * 中国嘉德官网其实是 `cguardian.com`）。这类地址与"真站拒绝抓取"（401/403）性质完全不同：
 * - 地址不存在 → 这条线索本身是假的，从候选里淘汰，**不进证据链、也不算召回成功**；
 * - 真站被拦 → 线索可能成立，只是拿不到正文，归"被拦"，**不能判死**。
 * 混成一类会把真来源误杀。所以本模块只回答一个问题：这个域名解析得到吗。
 *
 * 判据（纯机械，零 HTTP）：
 * 1. DNS 解析成功 → `exists`；
 * 2. NXDOMAIN / ENOTFOUND / ENODATA（明确不存在）→ `nonexistent`，淘汰；
 * 3. 其它解析失败（超时、SERVFAIL、临时网络故障）→ `unknown`，**保留**并标注——
 *    一次解析抖动不该把一个真站判死。
 *
 * 冻结与回放：解析结论写进 `examples/replay-search/<slug>/domains.json`，评分卡离线重算
 * 读它，零网络。域名不在样本里的候选按 `unknown` 处理（保留），不凭缺失判死。
 *
 * 拦不住什么：真实域名但页面已被下架（404/410）、被 robots 或登录墙挡住、内容改版——
 * 这些属于"抓不到页"，不是"地址不存在"，仍按抓页失败分档记。
 */

import dns from 'node:dns/promises';

/** 一个域名的存在性判定 */
export type DomainVerdict = 'exists' | 'nonexistent' | 'unknown';

export interface DomainCheck {
  /** 主机名（已去 www.、小写） */
  domain: string;
  verdict: DomainVerdict;
  /** 判定的原始读数（解析到的地址或错误消息），供人复核 */
  detail?: string;
}

export interface DomainCheckFixture {
  version: 1;
  kind: 'domain-check-replay';
  capturedAt: string;
  checks: DomainCheck[];
}

/** 从 URL 取主机名（去 www.、小写）；解析失败返回空串 */
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * DNS 异常 → 判定。
 *
 * 只有"明确不存在"才淘汰：`ENOTFOUND` / `NXDOMAIN` / `ENODATA` 表示这条记录没有；
 * 超时、SERVFAIL、`EAI_AGAIN` 是"这次没问到"，保留等下次。
 */
export function classifyDnsFailure(error: unknown): { verdict: DomainVerdict; detail: string } {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const code = (error as { code?: string } | null)?.code ?? '';
  if (/ENOTFOUND|NXDOMAIN|ENODATA/i.test(`${code} ${message}`)) {
    return { verdict: 'nonexistent', detail: message };
  }
  return { verdict: 'unknown', detail: message };
}

/** 真的去解析一个域名（只在采集时调用；评分卡不跑它） */
export async function resolveDomain(domain: string): Promise<DomainCheck> {
  if (domain === '') return { domain, verdict: 'unknown', detail: 'URL 解析不出域名' };
  try {
    const records = await dns.lookup(domain, { all: true });
    const addresses = records.map((record) => record.address).slice(0, 3).join(', ');
    return { domain, verdict: 'exists', detail: addresses };
  } catch (error) {
    return { domain, ...classifyDnsFailure(error) };
  }
}

/** 冻结样本里这个域名的判定；不在样本里 → unknown（保留，不凭缺失判死） */
export function domainVerdictOf(fixture: DomainCheckFixture | undefined, url: string): DomainVerdict {
  if (fixture === undefined) return 'unknown';
  const domain = domainOf(url);
  return fixture.checks.find((check) => check.domain === domain)?.verdict ?? 'unknown';
}

/**
 * 按域名判定淘汰候选（单一判据点，采集与评分卡都调它）。
 *
 * 只淘汰 `nonexistent`；`exists` 与 `unknown` 一律保留。
 */
export function gateCandidatesByDomain<T extends { url: string }>(
  items: readonly T[],
  fixture: DomainCheckFixture | undefined,
): { kept: T[]; rejected: Array<{ url: string; domain: string; reason: string }> } {
  const kept: T[] = [];
  const rejected: Array<{ url: string; domain: string; reason: string }> = [];
  for (const item of items) {
    const domain = domainOf(item.url);
    if (domainVerdictOf(fixture, item.url) === 'nonexistent') {
      rejected.push({ url: item.url, domain, reason: '这个地址不存在（域名无法解析），不进证据链' });
      continue;
    }
    kept.push(item);
  }
  return { kept, rejected };
}
