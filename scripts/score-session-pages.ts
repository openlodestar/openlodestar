#!/usr/bin/env node
// scripts/score-session-pages.ts
/**
 * 场次层实测（离线，零外部调用）
 *
 * 回答三件事：
 * 1. 单件拍品页的**原文**里到底有没有专场名（模板页单独列，不能当证据）；
 * 2. 46 条事件按场次分组后，机构 / 日期两字段各自命中多少，页面是不是同一批、有没有跨站；
 * 3. 为「三字段能不能成立」提供读数（本脚本不实现路 A / 路 B）。
 *
 * 输入是从主项目库只读导出的 JSON（不联网、不写库）：
 *   npx tsx scripts/score-session-pages.ts --dump <dump.json> [--write]
 *
 * 取正文口径沿用主项目文档的放宽口径：
 *   content_source IS DISTINCT FROM 'adapter_render' AND content_truncated = false
 * 模板页（adapter_render）仍参与打印，但明确标成「不能当证据」，不进原文口径。
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { processHtml } from '../src/integrations/scraper-strategies/scraper-utils';
import { quoteMatches } from '../src/lodestar/adjudicate/compare';
import {
  MIN_USABLE_TEXT_CHARS,
  extractHouseRegions,
  matchDateField,
  matchHouseField,
  type CorpusPageKind,
} from '../src/lodestar/corpus-adjudication';
import { foldGlyphVariants } from '../src/utils/text-language';

interface DumpRow {
  eventId: string;
  pageId: string;
  pageUrl: string;
  pageDomain: string;
  pageTitle: string | null;
  contentSource: string | null;
  contentTruncated: boolean;
  text: string | null;
  eventTime: string | null;
  eventPrecision: string | null;
  sourceArm: string;
  saleUrl: string | null;
  sessionId: string;
  sessionDomain: string;
  sessionExternalId: string;
  sessionCanonicalUrl: string | null;
  sessionName: string | null;
  sessionDate: string | null;
  sessionDatePrecision: string | null;
  sessionHouse: string | null;
}

const OUT_SAMPLE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../examples/corpus-pages/corpus-sessions-2026-11-09.json',
);

/** 页面域名 → 断言用机构名（结构化侧，不经正文） */
function houseOfDomain(domain: string): string | null {
  const host = domain.replace(/^www\./, '').toLowerCase();
  if (host === 'bonhams.com') return 'Bonhams';
  if (host === 'christies.com' || host === 'christies.com.cn') return "Christie's";
  return null;
}

/** 宽松归一：只折字形、小写、去空白与标点——用来区分「写法不同」与「完全没有」 */
function loose(value: string): string {
  return foldGlyphVariants(value).toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
}

function saleNamePresence(
  text: string,
  name: string,
): { verbatim: boolean; normalized: boolean; quote: string | null } {
  const verbatim = quoteMatches(name, text);
  const normalized = loose(text).includes(loose(name));
  let quote: string | null = null;
  if (verbatim) {
    const pattern = name
      .trim()
      .split(/\s+/)
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('\\s*');
    const match = new RegExp(pattern, 'i').exec(text);
    quote = match === null ? null : match[0];
  }
  return { verbatim, normalized, quote };
}

function shortUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname}`.replace(/\/$/, '').slice(0, 72);
  } catch {
    return url.slice(0, 72);
  }
}

function hashOf(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

function parseArgs(argv: string[]): { dump: string; write: boolean } {
  const index = argv.indexOf('--dump');
  if (index < 0) {
    throw new Error('缺 --dump <json>（从主项目库只读导出的 46 条事件）');
  }
  return { dump: path.resolve(argv[index + 1] ?? ''), write: argv.includes('--write') };
}

interface PageRow {
  pageId: string;
  url: string;
  domain: string;
  kind: CorpusPageKind;
  source: 'raw' | 'template';
  truncated: boolean;
  chars: number;
  readable: boolean;
  events: DumpRow[];
  nameVerbatim: boolean;
  nameNormalized: boolean;
  nameQuote: string | null;
  houseStatus: string | null;
  dateStatus: string | null;
}

interface SessionRow {
  sessionId: string;
  domain: string;
  externalId: string;
  name: string | null;
  date: string | null;
  house: string | null;
  events: number;
  pages: number;
  pageDomains: string[];
  crossSite: boolean;
  rawPages: number;
  houseHits: number;
  dateHits: number;
  bothHits: number;
  rawHouseHits: number;
  rawDateHits: number;
  rawBothHits: number;
  templateBothHits: number;
  /** 内部累计：本场次覆盖的页面与页面域 */
  pageIds: Set<string>;
  domains: Set<string>;
  rawPageIds: Set<string>;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const rows = JSON.parse(fs.readFileSync(args.dump, 'utf8')) as DumpRow[];

  const pages = new Map<string, PageRow>();
  const sessions = new Map<string, SessionRow>();

  for (const row of rows) {
    const text = row.text === null ? '' : await processHtml(row.text);
    const source: 'raw' | 'template' = row.contentSource === 'adapter_render' ? 'template' : 'raw';
    const kind: CorpusPageKind = source === 'template' ? 'template' : 'raw';
    const readable = text.length >= MIN_USABLE_TEXT_CHARS;
    const houseAsserted = houseOfDomain(row.pageDomain);
    const house =
      houseAsserted === null
        ? null
        : matchHouseField({ asserted: houseAsserted, regions: extractHouseRegions(row.text ?? '') });
    const date =
      row.eventTime === null ? null : matchDateField({ asserted: row.eventTime, text, url: row.pageUrl });
    const presence =
      row.sessionName === null ? { verbatim: false, normalized: false, quote: null } : saleNamePresence(text, row.sessionName);

    let page = pages.get(row.pageId);
    if (page === undefined) {
      page = {
        pageId: row.pageId,
        url: row.pageUrl,
        domain: row.pageDomain,
        kind,
        source,
        truncated: row.contentTruncated,
        chars: text.length,
        readable,
        events: [],
        nameVerbatim: presence.verbatim,
        nameNormalized: presence.normalized,
        nameQuote: presence.quote,
        houseStatus: house?.status ?? null,
        dateStatus: date?.status ?? null,
      };
      pages.set(row.pageId, page);
    }
    page.events.push(row);

    page.houseStatus = house?.status ?? null;
    page.dateStatus = date?.status ?? null;

    const houseOk = house !== null && (house.status === 'hit' || house.status === 'alias');
    const dateOk = date !== null && (date.status === 'hit' || date.status === 'normalized');
    const both = houseOk && dateOk;

    let session = sessions.get(row.sessionId);
    if (session === undefined) {
      session = {
        sessionId: row.sessionId,
        domain: row.sessionDomain,
        externalId: row.sessionExternalId,
        name: row.sessionName,
        date: row.sessionDate,
        house: row.sessionHouse,
        events: 0,
        pages: 0,
        pageDomains: [],
        crossSite: false,
        rawPages: 0,
        houseHits: 0,
        dateHits: 0,
        bothHits: 0,
        rawHouseHits: 0,
        rawDateHits: 0,
        rawBothHits: 0,
        templateBothHits: 0,
        pageIds: new Set<string>(),
        domains: new Set<string>(),
        rawPageIds: new Set<string>(),
      };
      sessions.set(row.sessionId, session);
    }
    session.events += 1;
    session.pageIds.add(row.pageId);
    session.domains.add(row.pageDomain.replace(/^www\./, ''));
    if (source === 'raw') session.rawPageIds.add(row.pageId);
    if (houseOk) session.houseHits += 1;
    if (dateOk) session.dateHits += 1;
    if (both) session.bothHits += 1;
    if (source === 'raw') {
      session.rawHouseHits += houseOk ? 1 : 0;
      session.rawDateHits += dateOk ? 1 : 0;
      session.rawBothHits += both ? 1 : 0;
    } else if (both) {
      session.templateBothHits += 1;
    }
  }

  for (const session of sessions.values()) {
    session.pages = session.pageIds.size;
    session.pageDomains = [...session.domains];
    const sessionDomain = session.domain.replace(/^www\./, '');
    session.crossSite = [...session.domains].some((domain) => domain !== sessionDomain);
    session.rawPages = session.rawPageIds.size;
  }

  const pageList = [...pages.values()];
  const sessionList = [...sessions.values()].sort((a, b) => b.events - a.events || a.sessionId.localeCompare(b.sessionId));
  const rawPages = pageList.filter((page) => page.source === 'raw');
  const templatePages = pageList.filter((page) => page.source === 'template');
  const rawAdjudicable = rawPages.filter((page) => page.readable && !page.truncated);

  console.log('== 数据概览 ==');
  console.log(
    `事件 ${rows.length} · 页面 ${pageList.length} · 场次 ${sessionList.length}；正文类型：原文 ${rawPages.length}（可裁决 ${rawAdjudicable.length}）· 适配器模板 ${templatePages.length}`,
  );
  console.log(
    `原文页截断 ${rawPages.filter((page) => page.truncated).length} · 模板页截断 ${templatePages.filter((page) => page.truncated).length}；正文阈值 ${MIN_USABLE_TEXT_CHARS} 字符`,
  );

  console.log('');
  console.log('== 问题一：单件页正文里有没有专场名 ==');
  console.log('原文页（放宽口径）：');
  for (const page of rawPages) {
    const presence = page.nameVerbatim ? '逐字出现' : page.nameNormalized ? '归一后出现' : '完全没有';
    console.log(
      `  ${shortUrl(page.url)} | ${page.chars} 字符 | ${presence} | 引文 ${page.nameQuote === null ? '—' : `「${page.nameQuote.slice(0, 60)}」`}`,
    );
  }
  console.log(
    `  小计：逐字出现 ${rawPages.filter((page) => page.nameVerbatim).length}/${rawPages.length}，归一后出现 ${rawPages.filter((page) => page.nameNormalized).length}/${rawPages.length}`,
  );
  console.log('模板页（不能当证据，仅作对照）：');
  console.log(
    `  逐字出现 ${templatePages.filter((page) => page.nameVerbatim).length}/${templatePages.length}，归一后出现 ${templatePages.filter((page) => page.nameNormalized).length}/${templatePages.length}`,
  );

  console.log('');
  console.log('== 问题二：场次层面的两字段 ==');
  console.log('场次 | 名称 | 事件 | 页面 | 页面域 | 跨站 | 原文页 | 机构命中 | 日期命中 | 两者全中(全部页) | 原文页全中 | 模板页全中(仅对照)');
  for (const session of sessionList) {
    const rawNote = session.rawPages === 0 ? '未测(0 页)' : `${session.rawBothHits}/${session.rawPages}`;
    console.log(
      [
        session.externalId,
        (session.name ?? '（缺）').slice(0, 40),
        session.events,
        session.pages,
        session.pageDomains.join(','),
        session.crossSite ? '是' : '否',
        session.rawPages,
        `${session.houseHits}/${session.events}`,
        `${session.dateHits}/${session.events}`,
        `${session.bothHits}/${session.events}`,
        rawNote,
        `${session.templateBothHits}/${session.events - session.rawPages}`,
      ].join(' | '),
    );
  }
  const totalEvents = sessionList.reduce((sum, session) => sum + session.events, 0);
  const totalHouse = sessionList.reduce((sum, session) => sum + session.houseHits, 0);
  const totalDate = sessionList.reduce((sum, session) => sum + session.dateHits, 0);
  const totalBoth = sessionList.reduce((sum, session) => sum + session.bothHits, 0);
  const totalRawBoth = sessionList.reduce((sum, session) => sum + session.rawBothHits, 0);
  console.log(
    `合计：机构 ${totalHouse}/${totalEvents} · 日期 ${totalDate}/${totalEvents} · 两者全中 ${totalBoth}/${totalEvents}；原文页两者全中 ${totalRawBoth}/${rawAdjudicable.length}`,
  );

  if (!args.write) {
    console.log('\n（未写冻结样本；加 --write 才写）');
    return;
  }

  const sample = {
    version: 1,
    kind: 'corpus-session-replay',
    capturedAt: '2026-11-09',
    source: 'shadow_db.price_events join shadow_db.sales（46 条事件 / 10 个场次，只读导出）',
    sampling: '全量：所有能通过 provenance.saleUrl 挂到场次的未作废价格事件',
    cleaner: 'processHtml（与抓页样本同一份）',
    contentRule: "content_source IS DISTINCT FROM 'adapter_render' AND content_truncated = false",
    counts: {
      events: rows.length,
      pages: pageList.length,
      sessions: sessionList.length,
      rawPages: rawPages.length,
      rawAdjudicable: rawAdjudicable.length,
      templatePages: templatePages.length,
      rawNameVerbatim: rawPages.filter((page) => page.nameVerbatim).length,
      rawNameNormalized: rawPages.filter((page) => page.nameNormalized).length,
      templateNameVerbatim: templatePages.filter((page) => page.nameVerbatim).length,
      houseHits: totalHouse,
      dateHits: totalDate,
      bothHits: totalBoth,
      rawBothHits: totalRawBoth,
    },
    pages: pageList.map((page) => ({
      url: page.url,
      domain: page.domain,
      source: page.source,
      truncated: page.truncated,
      chars: page.chars,
      readable: page.readable,
      textHash: hashOf(`${page.url}:${page.chars}`),
      saleNameVerbatim: page.nameVerbatim,
      saleNameNormalized: page.nameNormalized,
      saleNameQuote: page.nameQuote,
      houseStatus: page.houseStatus,
      dateStatus: page.dateStatus,
      events: page.events.map((event) => ({
        eventId: event.eventId,
        sessionId: event.sessionId,
        eventTime: event.eventTime,
      })),
    })),
    sessions: sessionList.map((session) => ({
      sessionId: session.sessionId,
      domain: session.domain,
      externalId: session.externalId,
      name: session.name,
      date: session.date,
      house: session.house,
      events: session.events,
      pages: session.pages,
      pageDomains: session.pageDomains,
      crossSite: session.crossSite,
      rawPages: session.rawPages,
      houseHits: session.houseHits,
      dateHits: session.dateHits,
      bothHits: session.bothHits,
      rawHouseHits: session.rawHouseHits,
      rawDateHits: session.rawDateHits,
      rawBothHits: session.rawBothHits,
      templateBothHits: session.templateBothHits,
    })),
  };
  fs.writeFileSync(OUT_SAMPLE, `${JSON.stringify(sample, null, 2)}\n`, 'utf8');
  console.log(`\n已写入 ${path.relative(process.cwd(), OUT_SAMPLE)}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
