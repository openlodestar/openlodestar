#!/usr/bin/env node
// scripts/capture-page-checks.ts
/**
 * 抓页可核率：把已召回候选页真抓一遍，冻成回放样本
 *
 * 回答一个静态自洽读数回答不了的问题：**召回到的页面里，正文真的写出了本场的关键字段吗。**
 * 只抓冻结检索样本里**已经召回**的候选 URL（不扩查、不新搜、不碰 serper），
 * 抓回后按引擎同一条逐字判据（字与标点一致，空白与不可见格式字符不计）核对
 * 机构、专场名、日期三个关键字段。
 *
 * 两步，第二步离线：
 *   1. 采集（`--allow-fetch`）：逐页抓取 → 清洗正文 → 逐字段判定 → 写
 *      `examples/replay-search/<slug>/page-checks.json`（只存读数，不存正文）；
 *   2. 回放：评分卡读同一份样本重算三个读数，零外部调用（`npx tsx scripts/scorecard.ts`）。
 *
 * 硬边界：
 * - 默认**不联网**：不带 `--allow-fetch` 只列要抓哪些 URL 就退出；
 * - 单样本最多 12 页，同一域名两次抓取至少隔 2 秒（不打站）；
 * - 不用浏览器渲染、不重试：抓不到就按原因分档记下来，那是读数的一部分；
 * - 只用冻结查询对应的结果：候选集来自 `search-results.json` 的当前召回读数。
 *
 * 用法（仓库根目录）：
 *   npx tsx scripts/capture-page-checks.ts --sample porcelain-2021-autumn
 *   npx tsx --env-file=.env scripts/capture-page-checks.ts --sample porcelain-2021-autumn --allow-fetch
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchSinglePageHtml } from '../src/integrations/scraper-strategies/single-page-fetch';
import { processHtml } from '../src/integrations/scraper-strategies/scraper-utils';
import { measureLiveRecall, type LiveRecallFixture } from '../src/lodestar/live-recall';
import {
  classifyFetchFailure,
  judgePageFields,
  measurePageVerification,
  MIN_USABLE_TEXT_CHARS,
  type PageCheck,
  type PageCheckPolicy,
  type PageCheckFixture,
} from '../src/lodestar/page-verification';
import porcelainPack from '../src/lodestar/packs/porcelain';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAMPLE_ROOT = path.join(PACKAGE_ROOT, 'examples', 'replay-search');
const MAX_PAGES = 12;
const POLICY: PageCheckPolicy = {
  maxPages: MAX_PAGES,
  perDomainGapMs: 2_000,
  timeoutMs: 15_000,
  allowBrowser: false,
};

interface SampleInput {
  slug: string;
  fields: Record<string, string>;
  rawText: string;
  matchTerms?: string[];
}

function parseArgs(argv: string[]): { slug: string; allowFetch: boolean } {
  const index = argv.indexOf('--sample');
  return {
    slug: index >= 0 ? (argv[index + 1] ?? 'porcelain-2021-autumn') : 'porcelain-2021-autumn',
    allowFetch: argv.includes('--allow-fetch'),
  };
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function textHash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

async function main(): Promise<void> {
  const { slug, allowFetch } = parseArgs(process.argv.slice(2));
  const sampleDir = path.join(SAMPLE_ROOT, slug);
  const inputPath = path.join(sampleDir, 'input.json');
  const searchPath = path.join(sampleDir, 'search-results.json');
  if (!fs.existsSync(inputPath) || !fs.existsSync(searchPath)) {
    throw new Error(`样本不完整（需要 input.json 与 search-results.json）：${path.relative(PACKAGE_ROOT, sampleDir)}`);
  }
  const input = { ...(JSON.parse(fs.readFileSync(inputPath, 'utf8')) as SampleInput), slug };
  const search = JSON.parse(fs.readFileSync(searchPath, 'utf8')) as LiveRecallFixture;
  const matchTerms = input.matchTerms && input.matchTerms.length > 0 ? input.matchTerms : null;
  const recall = measureLiveRecall({ ...search, slug, matchTerms: matchTerms ?? search.matchTerms }, porcelainPack);

  // 只抓"已经召回、且当前仍通过候选过滤"的页；同一 URL 只抓一次
  const seen = new Set<string>();
  const targets: string[] = [];
  for (const row of recall.rows) {
    for (const url of row.candidateUrls) {
      if (seen.has(url)) continue;
      seen.add(url);
      if (targets.length < MAX_PAGES) targets.push(url);
    }
  }

  const fields = Object.entries(input.fields)
    .filter(([key, value]) => (porcelainPack.fields().find((spec) => spec.key === key)?.role === 'key') && value.trim() !== '')
    .map(([key, value]) => ({ key, value: value.trim() }));

  console.log(`样本：${slug}`);
  console.log(`召回读数：${recall.hit}/${recall.issued} 条源查询可裁（${recall.calls} 次检索，已冻结）`);
  console.log(`将抓 ${targets.length} 页（上限 ${MAX_PAGES}，同域名间隔 ${POLICY.perDomainGapMs} ms，超时 ${POLICY.timeoutMs} ms，不用浏览器）：`);
  for (const url of targets) console.log(`  - [${hostOf(url)}] ${url}`);
  console.log(`逐字核对字段：${fields.map((field) => `${field.key}=${field.value}`).join(' · ')}`);

  if (!allowFetch) {
    console.log('\n未带 --allow-fetch：只列清单，不联网、不抓页。');
    return;
  }
  if (process.env.SEARCH_PROVIDER?.trim().toLowerCase() === 'serper') {
    throw new Error('当前 SEARCH_PROVIDER=serper：本脚本不碰搜索，拒绝在 serper 配置下运行');
  }

  const checks: PageCheck[] = [];
  const lastFetchAt = new Map<string, number>();
  for (const [index, url] of targets.entries()) {
    const domain = hostOf(url);
    const previous = lastFetchAt.get(domain);
    if (previous !== undefined) {
      const wait = POLICY.perDomainGapMs - (Date.now() - previous);
      if (wait > 0) await sleep(wait);
    }
    lastFetchAt.set(domain, Date.now());
    const label = `[${index + 1}/${targets.length}] ${domain}`;
    try {
      const page = await fetchSinglePageHtml(url, {
        allowBrowser: POLICY.allowBrowser,
        timeoutMs: POLICY.timeoutMs,
      });
      const text = await processHtml(page.html);
      if (text.trim().length < MIN_USABLE_TEXT_CHARS) {
        checks.push({
          url,
          domain,
          status: 'failed',
          failure: 'non-html',
          message: `正文只有 ${text.trim().length} 字符（低于 ${MIN_USABLE_TEXT_CHARS}），按页面结构不符记`,
        });
        console.log(`${label} 结构不符（正文 ${text.trim().length} 字符）`);
        continue;
      }
      const judged = judgePageFields(text, fields);
      const verified = judged.every((row) => row.verbatim);
      checks.push({
        url,
        domain,
        status: 'fetched',
        chars: text.length,
        textHash: textHash(text),
        fields: judged,
        verified,
      });
      const hits = judged.map((row) => `${row.key}:${row.verbatim ? '✓' : '✗'}`).join(' ');
      console.log(`${label} 抓到 ${text.length} 字符 · ${hits}${verified ? ' · 可核' : ''}`);
    } catch (error) {
      const failure = classifyFetchFailure(error);
      checks.push({ url, domain, status: 'failed', failure: failure.kind, message: failure.message });
      console.log(`${label} ${failure.kind}：${failure.message.slice(0, 120)}`);
    }
  }

  const fixture: PageCheckFixture = {
    version: 1,
    kind: 'page-check-replay',
    slug,
    capturedAt: new Date().toISOString(),
    policy: POLICY,
    fields,
    checks,
  };
  const outPath = path.join(sampleDir, 'page-checks.json');
  fs.writeFileSync(outPath, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');

  const measured = measurePageVerification({ fixture, recall });
  console.log(`\n已冻结：${path.relative(PACKAGE_ROOT, outPath)}`);
  console.log(
    `抓页成功率 ${measured.fetchSuccessRate ?? '未测'}%（${measured.fetched}/${measured.attempted}） · ` +
      `逐字核验通过率 ${measured.verbatimPassRate ?? '未测'}%（${measured.verifiedPages}/${measured.fetched}） · ` +
      `可核率 ${measured.verifiableRate ?? '未测'}%（${measured.queryHits}/${measured.issued}）`,
  );
  const failures = Object.entries(measured.failures).filter(([, count]) => count > 0);
  console.log(
    failures.length === 0
      ? '抓不到页：0 条'
      : `抓不到页：${failures.map(([kind, count]) => `${kind} ${count}`).join(' · ')}`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
