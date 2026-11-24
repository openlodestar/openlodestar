#!/usr/bin/env node
// scripts/score-corpus-pages.ts
/**
 * 已入库页面的裁决复算（离线，零外部调用）
 *
 * 两件事：
 * 1. 不给 `--dump` 时，只读冻结样本，打印三档读数（正文可读率 / 两字段可核率 / 三字段可核率）
 *    与「材料不够 / 判据判不中」的分档；
 * 2. 给 `--dump <文件>` 时，把主项目库只读导出的页面正文重新清洗、重新裁决，打印逐页
 *    改动前后的对照；加 `--write` 时把新判定写回冻结样本。
 *
 * `--dump` 的格式（由只读 SQL 导出，不联网）：
 *   [{ "url": "...", "domain": "...", "text": "<content_snapshot>",
 *      "events": [{ "eventTime": "2023-12-12", "saleUrl": "...", "priceRaw": "..." }] }]
 *
 * 为什么样本里不存全文：第三方正文不搬进仓库；冻结样本只存判定读数与短摘录，
 * 重判时从只读导出重新清洗一遍（正文哈希会核对，换了版本能看出来）。
 *
 * 用法（仓库根目录）：
 *   npx tsx scripts/score-corpus-pages.ts
 *   npx tsx scripts/score-corpus-pages.ts --dump <dump.json> [--write]
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { processHtml } from '../src/integrations/scraper-strategies/scraper-utils';
import {
  MIN_USABLE_TEXT_CHARS,
  extractHouseRegions,
  judgeCorpusPage,
  measureCorpusPages,
  type CorpusPageKind,
  type CorpusPageVerdict,
  type SessionLanguage,
  type SessionLayerRecord,
} from '../src/lodestar/corpus-adjudication';

const DEFAULT_SAMPLE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../examples/corpus-pages/corpus-pages-2026-11-09.json',
);

interface DumpPage {
  url: string;
  domain: string;
  title: string | null;
  text: string;
  events: Array<{ eventTime: string | null; priceRaw: string | null; saleUrl: string | null; sourceArm: string }> | null;
}

interface SamplePage {
  url: string;
  domain: string;
  kind: CorpusPageKind;
  snapshotChars: number;
  truncatedAt50k: boolean;
  plainChars: number;
  readable: boolean;
  eventTime: string | null;
  priceRaw: string | null;
  sourceArm: string | null;
  saleUrl: string | null;
  textHash: string;
  fields?: Array<{ key: string; value: string; verbatim?: boolean; category?: string }>;
  asserted?: { house: string | null; date: string | null; sessionName: string | null; publisher?: string | null };
  judged?: CorpusPageVerdict;
  excerpt: string;
}

interface Sample {
  version: number;
  kind: string;
  capturedAt: string;
  rejudgedAt?: string;
  source: string;
  sampling: unknown;
  judge: Record<string, string>;
  counts: Record<string, number>;
  tiers?: Record<string, unknown>;
  pages: SamplePage[];
}

function parseArgs(argv: string[]): { dump: string | null; write: boolean; sample: string } {
  const dumpIndex = argv.indexOf('--dump');
  const sampleIndex = argv.indexOf('--sample');
  return {
    dump: dumpIndex >= 0 ? path.resolve(argv[dumpIndex + 1] ?? '') : null,
    write: argv.includes('--write'),
    sample: sampleIndex >= 0 ? path.resolve(argv[sampleIndex + 1] ?? DEFAULT_SAMPLE) : DEFAULT_SAMPLE,
  };
}

function assertionsOf(page: SamplePage): {
  house: string | null;
  date: string | null;
  sessionName: string | null;
  publisher: string | null;
} {
  if (page.asserted !== undefined) {
    return {
      house: page.asserted.house,
      date: page.asserted.date,
      sessionName: page.asserted.sessionName,
      publisher: page.asserted.publisher ?? null,
    };
  }
  const value = (key: string) => page.fields?.find((field) => field.key === key)?.value ?? null;
  return {
    house: value('auctionHouse'),
    date: value('dateText'),
    sessionName: value('sessionName'),
    publisher: value('publisher'),
  };
}

/** 断言侧语种：断言由域名映射与结构化字段生成，本轮一律英文/ISO；专场名若有中文则按中文 */
function languageOf(text: string | null): SessionLanguage | null {
  if (text === null || text.trim() === '') return null;
  return /[\u4E00-\u9FFF]/.test(text) ? 'zh' : 'en';
}

const STATUS_LABELS: Record<string, string> = {
  hit: '✓ 逐字',
  normalized: '✓ 归一',
  alias: '✓ 别名',
  'year-unresolved': '△ 缺年',
  mismatch: '✗ 不符',
  absent: '✗ 没有',
  unjudgeable: '— 判不了',
};

function label(status: string | undefined): string {
  return status === undefined ? '—' : STATUS_LABELS[status] ?? status;
}

function hashOf(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

function printTiers(pages: CorpusPageVerdict[], truncatedUrls: ReadonlySet<string>): void {
  const tiers = measureCorpusPages(pages, { truncatedUrls });
  const format = (value: number | null) => (value === null ? '未测' : `${value.toFixed(1)}%`);
  console.log('');
  console.log('== 三档读数 ==');
  console.log(`正文可读率      ${format(tiers.readableRate)}（${tiers.readable}/${tiers.pages} 页，阈值 ${MIN_USABLE_TEXT_CHARS} 字符）`);
  console.log(
    `两字段可核率    ${format(tiers.twoFieldRate)}（${tiers.twoFieldHits}/${tiers.adjudicable} 页可裁决；旧口径整页命中 ${tiers.verbatimTwoFieldHits}/${tiers.adjudicable}）`,
  );
  console.log(
    `三字段可核率    ${format(tiers.threeFieldRate)}（${tiers.threeFieldHits}/${tiers.sessionMeasured} 页场次层契约已满足）` +
      (tiers.threeFieldRate === null ? '——场次维度的材料不在单件页，记未测，不是 0' : ''),
  );
  console.log('');
  console.log('材料不够（不进两字段分母）：');
  console.log(
    `  抽取器模板 ${tiers.material.template} · 媒体稿（不构造拍行断言）${tiers.material.article} · 不可读 ${tiers.material.unreadable} · 卡在 5 万字符 ${tiers.material.truncated}`,
  );
  console.log('判据判不中（只在可裁决页里数）：');
  console.log(
    `  结构位置没写机构 ${tiers.judgment.houseUnjudgeable} · 日期不符/没有 ${tiers.judgment.dateMiss} · 日期缺年 ${tiers.judgment.dateYearUnresolved} · 场次未测 ${tiers.judgment.sessionNotMeasured}`,
  );
}

function printPageTable(pages: Array<{ page: SamplePage; verdict: CorpusPageVerdict }>): void {
  console.log('');
  console.log('== 逐页改动前后 ==');
  console.log('页面 | 类型 | 机构 旧→新 | 日期 旧→新 | 两字段 旧→新 | 专场');
  for (const { page, verdict } of pages) {
    const baseline = verdict.verbatimBaseline;
    const house = `${baseline?.house === true ? '✓' : '✗'} → ${label(verdict.house?.status)}`;
    const dateLabel =
      verdict.date?.status === 'normalized' && verdict.date.yearSource === 'url'
        ? '✓ 归一(URL年)'
        : label(verdict.date?.status);
    const date = `${baseline?.date === true ? '✓' : '✗'} → ${dateLabel}`;
    const two =
      page.kind === 'article' ? '不适用' : `${baseline?.twoFields === true ? '✓' : '✗'} → ${verdict.twoFieldsVerified ? '✓' : '✗'}`;
    const session =
      page.kind === 'article'
        ? '不适用（媒体稿）'
        : verdict.session.status === 'not-measured'
          ? `未测（缺 ${verdict.session.missing.join('、')}）`
          : verdict.session.status;
    console.log(`${shortUrl(page.url)} | ${page.kind} | ${house} | ${date} | ${two} | ${session}`);
  }
}

function shortUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname}`.replace(/\/$/, '').slice(0, 68);
  } catch {
    return url.slice(0, 68);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const sample = JSON.parse(fs.readFileSync(args.sample, 'utf8')) as Sample;
  const truncatedUrls = new Set(sample.pages.filter((page) => page.truncatedAt50k).map((page) => page.url));

  if (args.dump === null) {
    const verdicts = sample.pages.map((page) => {
      if (page.judged === undefined) {
        throw new Error(`样本里缺 judged（先用 --dump 重判一次）：${page.url}`);
      }
      return page.judged;
    });
    printTiers(verdicts, truncatedUrls);
    return;
  }

  const dump = JSON.parse(fs.readFileSync(args.dump, 'utf8')) as DumpPage[];
  const byUrl = new Map(dump.map((page) => [page.url, page]));
  const judgedPages: Array<{ page: SamplePage; verdict: CorpusPageVerdict }> = [];

  for (const page of sample.pages) {
    const source = byUrl.get(page.url);
    if (source === undefined) throw new Error(`导出里没有这一页：${page.url}`);
    const text = await processHtml(source.text);
    const textHash = hashOf(text);
    if (textHash !== page.textHash) {
      throw new Error(`正文哈希对不上（页面换版或清洗器改了）：${page.url} 样本 ${page.textHash} / 现在 ${textHash}`);
    }
    const asserted = assertionsOf(page);
    const event = source.events?.[0] ?? null;
    // 场次层记录：库里只有 saleUrl 这个关联键，专场名/日期/机构/语种都没有
    const sessionRecord: Partial<SessionLayerRecord> | null =
      page.saleUrl === null ? null : { sessionKey: page.saleUrl };
    const verdict = judgeCorpusPage({
      url: page.url,
      domain: page.domain,
      kind: page.kind,
      text,
      assertedHouse: page.kind === 'article' ? null : asserted.house,
      assertedDate: page.kind === 'article' ? null : asserted.date,
      assertedSessionName: page.kind === 'article' ? null : asserted.sessionName,
      assertedSessionLanguage: languageOf(asserted.sessionName),
      sessionRecord,
      houseRegions: extractHouseRegions(source.text),
    });
    page.plainChars = text.length;
    page.readable = verdict.readable;
    page.eventTime = event?.eventTime ?? page.eventTime;
    page.priceRaw = event?.priceRaw ?? page.priceRaw;
    page.saleUrl = event?.saleUrl ?? page.saleUrl;
    page.asserted = {
      house: asserted.house,
      date: asserted.date,
      sessionName: asserted.sessionName,
      ...(asserted.publisher === null ? {} : { publisher: asserted.publisher }),
    };
    page.judged = verdict;
    judgedPages.push({ page, verdict });
  }

  printPageTable(judgedPages);
  printTiers(
    judgedPages.map((row) => row.verdict),
    truncatedUrls,
  );

  if (!args.write) {
    console.log('\n（未写回样本；加 --write 才更新冻结样本）');
    return;
  }

  const verdicts = judgedPages.map((row) => row.verdict);
  const tiers = measureCorpusPages(verdicts, { truncatedUrls });
  const countBy = (pick: (page: SamplePage, verdict: CorpusPageVerdict) => number) =>
    judgedPages.reduce((total, row) => total + pick(row.page, row.verdict), 0);

  const updated: Sample = {
    version: 2,
    kind: 'corpus-page-replay',
    capturedAt: sample.capturedAt,
    rejudgedAt: new Date().toISOString(),
    source: sample.source,
    sampling: sample.sampling,
    judge: {
      cleaner: 'processHtml（与抓页样本同一份）',
      question: '已入库页面上，判据侧能把三字段核到什么程度（分三档，模板页不算证据）',
      minUsableChars: String(MIN_USABLE_TEXT_CHARS),
      houseSource: '域名 → 拍行名手工映射（不经正文），比对走 HOUSE_ALIASES 拉丁/汉字别名',
      dateSource: 'price_events.event_time（结构化字段，不经正文），比对时归一写法、引文仍逐字',
      sessionSource: '场次层记录（sessionKey/sessionName/sessionDate/houseCanonical/language）；本轮库里没有，一律未测',
    },
    counts: {
      pages: sample.pages.length,
      readable: tiers.readable,
      raw: verdicts.filter((page) => page.kind === 'raw').length,
      template: tiers.material.template,
      article: tiers.material.article,
      truncatedAt50k: tiers.material.truncated,
      adjudicable: tiers.adjudicable,
      houseHit: countBy((_page, verdict) => (verdict.house?.status === 'hit' ? 1 : 0)),
      houseAlias: countBy((_page, verdict) => (verdict.house?.status === 'alias' ? 1 : 0)),
      dateHit: countBy((_page, verdict) => (verdict.date?.status === 'hit' ? 1 : 0)),
      dateNormalized: countBy((_page, verdict) => (verdict.date?.status === 'normalized' ? 1 : 0)),
      twoFieldHits: tiers.twoFieldHits,
      verbatimTwoFieldHits: tiers.verbatimTwoFieldHits,
      sessionMeasured: tiers.sessionMeasured,
      threeFieldHits: tiers.threeFieldHits,
    },
    tiers: { ...tiers },
    pages: sample.pages,
  };
  fs.writeFileSync(args.sample, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');
  console.log(`\n已写回 ${path.relative(process.cwd(), args.sample)}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
