#!/usr/bin/env node
// scripts/capture-domain-checks.ts
/**
 * 域名真实性闸的采集：抓页前先判地址是否存在
 *
 * 搜索结果里混着模型编出来的域名（例如 `china-guardian.com`，中国嘉德官网其实是
 * `cguardian.com`）。这类地址与"真站拒绝抓取"（artnet 403、barrons 401）性质不同：
 * - 地址不存在 → 这条线索是假的，从候选里淘汰，不进证据链、也不算召回成功；
 * - 真站被拦 → 线索可能成立，只是拿不到正文，仍按抓页失败记"被拦"。
 *
 * 本脚本只做一件事：对冻结检索样本里出现过的候选域名逐个做 DNS 解析，把结论冻进
 * `examples/replay-search/<slug>/domains.json`。**零 HTTP**（不抓页、不请求站点），
 * 之后评分卡离线重算读这份样本，不再联网。
 *
 * 判据（写死在 `src/lodestar/domain-gate.ts`）：
 * - 解析成功 → `exists`，保留；
 * - NXDOMAIN / ENOTFOUND / ENODATA → `nonexistent`，淘汰；
 * - 其它解析失败（超时、SERVFAIL）→ `unknown`，保留——一次解析抖动不该把真站判死。
 *
 * 用法（仓库根目录）：
 *   npx tsx scripts/capture-domain-checks.ts --sample porcelain-2021-autumn           # 干跑：只列域名
 *   npx tsx scripts/capture-domain-checks.ts --sample porcelain-2021-autumn --allow-dns  # 真解析并冻结
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SearchResultItem } from '../src/integrations/search-providers/types';
import { filterAndRankCandidates } from '../src/lodestar/adjudicate/retrieval';
import { domainOf, resolveDomain, type DomainCheck, type DomainCheckFixture } from '../src/lodestar/domain-gate';
import type { LiveRecallFixture } from '../src/lodestar/live-recall';
import porcelainPack from '../src/lodestar/packs/porcelain';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAMPLE_ROOT = path.join(PACKAGE_ROOT, 'examples', 'replay-search');

function parseArgs(argv: string[]): { slug: string; allowDns: boolean } {
  const index = argv.indexOf('--sample');
  return {
    slug: index >= 0 ? (argv[index + 1] ?? 'porcelain-2021-autumn') : 'porcelain-2021-autumn',
    allowDns: argv.includes('--allow-dns'),
  };
}

/** 冻结样本里出现过的、通过候选过滤的域名（与召回/抓页同一套过滤） */
function candidateDomains(fixture: LiveRecallFixture): string[] {
  const domains = new Set<string>();
  for (const track of fixture.tracks) {
    for (const index of track.queries.keys()) {
      const items = track.results.filter((item: SearchResultItem) => item.queryIndex === index);
      for (const candidate of filterAndRankCandidates(items, porcelainPack).candidates) {
        const domain = domainOf(candidate.url);
        if (domain !== '') domains.add(domain);
      }
    }
  }
  return [...domains].sort();
}

async function main(): Promise<void> {
  const { slug, allowDns } = parseArgs(process.argv.slice(2));
  const sampleDir = path.join(SAMPLE_ROOT, slug);
  const searchPath = path.join(sampleDir, 'search-results.json');
  if (!fs.existsSync(searchPath)) {
    throw new Error(`样本不完整（需要 search-results.json）：${path.relative(PACKAGE_ROOT, searchPath)}`);
  }
  const fixture = JSON.parse(fs.readFileSync(searchPath, 'utf8')) as LiveRecallFixture;
  const domains = candidateDomains(fixture);

  console.log(`样本：${slug}`);
  console.log(`候选域名 ${domains.length} 个（${fixture.tracks.reduce((sum, track) => sum + track.results.length, 0)} 条结果）：`);
  for (const domain of domains) console.log(`  - ${domain}`);

  if (!allowDns) {
    console.log('\n未带 --allow-dns：只列清单，不做 DNS 解析、不联网。');
    return;
  }
  if (process.env.SEARCH_PROVIDER?.trim().toLowerCase() === 'serper') {
    throw new Error('当前 SEARCH_PROVIDER=serper：本脚本不碰搜索，拒绝在 serper 配置下运行');
  }

  const checks: DomainCheck[] = [];
  for (const domain of domains) {
    const check = await resolveDomain(domain);
    checks.push(check);
    console.log(`  ${check.verdict.padEnd(11, ' ')} ${domain}${check.detail ? `（${check.detail.slice(0, 80)}）` : ''}`);
  }

  const fixtureOut: DomainCheckFixture = {
    version: 1,
    kind: 'domain-check-replay',
    capturedAt: new Date().toISOString(),
    checks,
  };
  const outPath = path.join(sampleDir, 'domains.json');
  fs.writeFileSync(outPath, `${JSON.stringify(fixtureOut, null, 2)}\n`, 'utf8');

  const nonexistent = checks.filter((check) => check.verdict === 'nonexistent');
  const unknown = checks.filter((check) => check.verdict === 'unknown');
  console.log(`\n已冻结：${path.relative(PACKAGE_ROOT, outPath)}`);
  console.log(
    `地址不存在 ${nonexistent.length} 个域名（淘汰） · 解析成功 ${checks.length - nonexistent.length - unknown.length} 个 · ` +
      `判不了 ${unknown.length} 个（保留，等下次解析）`,
  );
  if (nonexistent.length > 0) console.log(`淘汰：${nonexistent.map((check) => check.domain).join('、')}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
