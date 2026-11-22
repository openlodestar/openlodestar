// src/lodestar/corpus-adjudication.ts
/**
 * 已入库页面的裁决口径（离线，零外部调用）
 *
 * 与前一轮 `page-verification.ts` 的区别只在**材料**：那一层核的是"自己上网抓回来的页"，
 * 这一层核的是"主项目采集库里已经落库的页面正文"。判据侧解决三件事：
 *
 * 1. **日期按写法归一后比对，引文仍逐字**。同一场日期在页面上可能写成
 *    `12 Dec 2023`（月份缩写）、`2026-09-23T04:20:00+00:00`（ISO 串）、
 *    `2021年12月5日`（中文）或 `November 6`（无年份，年份在 URL 里）。
 *    这些是**同一件事的不同写法**，逐字比对会判成"页面没写"，是判据的错，不是材料的错。
 *    归一只动"怎么比"，不动"拿什么当证据"：返回的引文一律是从页面原文里切出来的原样片段。
 *
 * 2. **机构命中必须落在站点结构位置**（页头/站内导航、面包屑、标题区、场次抬头），
 *    并接受语言差异（走已有的 `HOUSE_ALIASES` 拉丁/汉字别名表，不新建词表）。
 *    `Christie's` 与「佳士得」是同一家；判据返回页面上实际出现的那一种写法作引文。
 *    正文里的顺带提及、推广卡片、员工邮箱、页脚声明一律不算——它们只证明"页面里出现过
 *    这串字"，不证明"这一页是这家拍行的场次/拍品页"。四个区域里没有拍行明文时记「判不了」。
 *
 * 3. **专场字段只在场次层成立**。单件页上不保证有专场名（Christie's 中文站的
 *    面包屑会写，Bonhams 的已入库页面则只有适配器模板），所以缺它时记「未测」，
 *    不记 0——0 的意思是"判了但没中"，
 *    「未测」的意思是"材料不在这一层，判不了"。两者混在一起，读数就没法用。
 *
 * 三个读数分开报（对应评分卡的三档）：
 * - 正文可读率：清洗后正文是否够用（≥200 字符），分母是全部页；
 * - 两字段可核率：机构 + 日期是否都核上，分母是**可裁决页**（原始正文拍行页）；
 * - 三字段可核率：再加专场，分母是**场次层契约已满足**的页；一页都没有时是「未测」。
 *
 * 模板页（抽取器自己拼出来的"正文"）不是证据：它本来就是抽取结果，用它去核抽取结果
 * 等于自证。它们计入「材料不够」，不进两字段分母。
 */

import { quoteMatches } from './adjudicate/compare';
import { AMBIGUOUS_LATIN_ALIASES, HOUSE_ALIASES, canonicalHouseName } from './packs/porcelain/rules';
import { foldGlyphVariants } from '../utils/text-language';
import { MIN_USABLE_TEXT_CHARS } from './page-verification';

export { MIN_USABLE_TEXT_CHARS };

/** 页面在库里的类型：原始正文 / 抽取器模板 / 媒体稿 */
export type CorpusPageKind = 'raw' | 'template' | 'article';

const MONTH_EN: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const MONTH_PATTERN = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';

/** 月份缩写/全称 → 月号；认不出返回 0 */
function monthOf(name: string): number {
  return MONTH_EN[name.toLowerCase().replace(/\.$/, '')] ?? 0;
}

/** 页面里抽出来的一个日期写法（位置用于从原文切引文） */
export interface DateToken {
  /** 页面原文里的原样片段（引文就取它） */
  raw: string;
  /** 在正文里的起始下标 */
  index: number;
  year: number | null;
  month: number;
  day: number;
  /** 写法类别，只用于解释「命中的是哪一种写法」 */
  form: 'iso' | 'zh' | 'day-month-year' | 'month-day-year' | 'day-month' | 'month-day';
}

function validDate(year: number | null, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  if (year !== null && (year < 1000 || year > 2999)) return false;
  return true;
}

/**
 * 抽取正文里的全部日期写法。
 *
 * 先抓带年份的完整日期（ISO / 中文 / 日-月-年 / 月-日-年），占住的区间不再参与
 * 后面的"缺年份"匹配——否则 `2 December 2003` 会被再抓出一段 `December 2003`；
 * 这一步不做，引用片段就可能落在句子的半截上。
 */
export function extractDateTokens(text: string): DateToken[] {
  const tokens: DateToken[] = [];
  const consumed: Array<[number, number]> = [];
  const overlaps = (start: number, end: number): boolean =>
    consumed.some(([from, to]) => start < to && from < end);

  const take = (match: RegExpMatchArray, year: number | null, month: number, day: number, form: DateToken['form']) => {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (!validDate(year, month, day) || overlaps(start, end)) return;
    consumed.push([start, end]);
    tokens.push({ raw: match[0], index: start, year, month, day, form });
  };

  const fullPatterns: Array<{ re: RegExp; handle: (m: RegExpMatchArray) => void }> = [
    {
      // 2026-09-23 / 2026-09-23T04:20:00+00:00
      re: /(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ]\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?/g,
      handle: (m) => take(m, Number(m[1]), Number(m[2]), Number(m[3]), 'iso'),
    },
    {
      // 2021年12月5日（允许日期与"年月日"之间有空格）
      re: /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g,
      handle: (m) => take(m, Number(m[1]), Number(m[2]), Number(m[3]), 'zh'),
    },
    {
      // 12 Dec 2023 / 2 December 2003
      re: new RegExp(`(\\d{1,2})\\s+(${MONTH_PATTERN})\\.?,?\\s+(\\d{4})`, 'gi'),
      handle: (m) => take(m, Number(m[3]), monthOf(m[2]!), Number(m[1]), 'day-month-year'),
    },
    {
      // November 6, 2024 / December 12 2023
      re: new RegExp(`(${MONTH_PATTERN})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})`, 'gi'),
      handle: (m) => take(m, Number(m[3]), monthOf(m[1]!), Number(m[2]), 'month-day-year'),
    },
  ];

  for (const { re, handle } of fullPatterns) {
    for (const match of text.matchAll(re)) handle(match);
  }

  const partialPatterns: Array<{ re: RegExp; handle: (m: RegExpMatchArray) => void }> = [
    {
      // 6 November（缺年份）
      re: new RegExp(`(\\d{1,2})\\s+(${MONTH_PATTERN})\\b`, 'gi'),
      handle: (m) => take(m, null, monthOf(m[2]!), Number(m[1]), 'day-month'),
    },
    {
      // November 6（缺年份；不带逗号也算，带逗号的由正则天然截掉）
      re: new RegExp(`(${MONTH_PATTERN})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'gi'),
      handle: (m) => take(m, null, monthOf(m[1]!), Number(m[2]), 'month-day'),
    },
  ];

  for (const { re, handle } of partialPatterns) {
    for (const match of text.matchAll(re)) handle(match);
  }

  return tokens.sort((a, b) => a.index - b.index);
}

function isoDate(date: { year: number; month: number; day: number }): string {
  const pad = (value: number, width: number) => String(value).padStart(width, '0');
  return `${pad(date.year, 4)}-${pad(date.month, 2)}-${pad(date.day, 2)}`;
}

/**
 * URL 里能独立读出的年份（路径段里的四位年份，如 `/auction/2024/...`）。
 * 只用来补"页面上没写年份"的那一类：它不从断言本身推年份，所以不算循环论证。
 * 出现两个不同年份时返回 null（分不清是场次年还是别的年）。
 */
export function urlYearOf(url: string | null | undefined): number | null {
  if (!url) return null;
  let path = '';
  try {
    path = new URL(url).pathname;
  } catch {
    return null;
  }
  const years = [...path.matchAll(/(?:^|\D)((?:19|20)\d{2})(?=\D|$)/g)].map((m) => Number(m[1]));
  const unique = [...new Set(years)];
  return unique.length === 1 ? unique[0]! : null;
}

/** 断言里的完整日期（年-月-日）；解析不出返回 null */
export function parseAssertedDate(asserted: string): { year: number; month: number; day: number } | null {
  const token = extractDateTokens(asserted).find((row) => row.year !== null);
  return token === undefined ? null : { year: token.year!, month: token.month, day: token.day };
}

/** 日期字段的核对结论 */
export type DateMatchStatus =
  /** 断言原样出现在正文里 */
  | 'hit'
  /** 写法不同但归一后是同一天 */
  | 'normalized'
  /** 月日对得上，但页面没有年份、URL 也给不出独立年份 */
  | 'year-unresolved'
  /** 页面有日期写法，但没有一天等于断言 */
  | 'mismatch'
  /** 页面根本没有日期写法 */
  | 'absent'
  /** 断言本身解析不出完整日期（判据缺材料） */
  | 'unjudgeable';

export interface DateMatch {
  status: DateMatchStatus;
  /** 页面原文片段（从正文里切出来的，逐字）；没有命中时为 null */
  quote: string | null;
  /** 归一后的日期（YYYY-MM-DD）；没命中时为 null */
  normalized: string | null;
  /** 年份从哪来：页面本身 / URL */
  yearSource: 'page' | 'url' | null;
  /** 按旧口径（逐字）是否命中——保留它是为了给出改动前后的对照 */
  verbatim: boolean;
  detail: string;
}

const DATE_STATUS_REASONS: Record<DateMatchStatus, string> = {
  hit: '断言原样出现在正文里',
  normalized: '写法不同，归一后是同一天',
  'year-unresolved': '月日对得上，但页面没有年份、URL 也没有独立年份',
  mismatch: '页面有日期写法，但没有一天等于断言',
  absent: '页面没有日期写法',
  unjudgeable: '断言解析不出完整日期',
};

/**
 * 日期判据：先按旧口径（逐字）判，不中再把两种写法都归一成日历日期比对。
 *
 * 可以归一的差异（同一件事的不同写法）：
 * - 月份全称/缩写（December / Dec / Dec.）；
 * - 日-月-年 与 月-日-年 两种语序；
 * - ISO 串与带时区的时间戳（只看日期部分，时区不改变日期本身）；
 * - 中文「2021年12月5日」；
 * - 页面只写月日、年份在 URL 里且与断言一致（`yearSource: 'url'`）。
 *
 * **不可以归一**（一律判不中，不猜）：
 * - 日、月、年任一不同；
 * - 页面只写到月（如「2023年12月」）——那不是某一天，不能补成 1 日；
 * - 年份要从断言本身推（页面没写、URL 也没有）——那等于用断言证明断言；
 * - 斜杠日期（`03/04/2023`）——日/月语序在两套习惯里都成立，分不清就不判；
 * - 同一页出现多个不同日期的同一天（不同拍品各写一行）——只认与断言相同的那一天，
 *   并取它作引文；一天都没对上时判不中，不做"大概在附近"的推断。
 */
export function matchDateField(input: {
  asserted: string;
  text: string;
  url?: string | null;
}): DateMatch {
  const target = parseAssertedDate(input.asserted);
  if (target === null) {
    return {
      status: 'unjudgeable',
      quote: null,
      normalized: null,
      yearSource: null,
      verbatim: false,
      detail: DATE_STATUS_REASONS.unjudgeable,
    };
  }
  const wanted = isoDate(target);
  const verbatim = quoteMatches(input.asserted, input.text);
  const tokens = extractDateTokens(input.text);

  if (verbatim) {
    const quote = findVerbatimQuote(input.text, input.asserted) ?? input.asserted;
    return {
      status: 'hit',
      quote,
      normalized: wanted,
      yearSource: 'page',
      verbatim: true,
      detail: DATE_STATUS_REASONS.hit,
    };
  }

  const full = tokens.find(
    (token) => token.year === target.year && token.month === target.month && token.day === target.day,
  );
  if (full !== undefined) {
    return {
      status: 'normalized',
      quote: full.raw,
      normalized: wanted,
      yearSource: 'page',
      verbatim: false,
      detail: `${DATE_STATUS_REASONS.normalized}（页面写法「${full.raw}」）`,
    };
  }

  const withoutYear = tokens.find(
    (token) => token.year === null && token.month === target.month && token.day === target.day,
  );
  if (withoutYear !== undefined) {
    const urlYear = urlYearOf(input.url);
    if (urlYear === null) {
      return {
        status: 'year-unresolved',
        quote: withoutYear.raw,
        normalized: null,
        yearSource: null,
        verbatim: false,
        detail: `${DATE_STATUS_REASONS['year-unresolved']}（页面写法「${withoutYear.raw}」）`,
      };
    }
    if (urlYear === target.year) {
      return {
        status: 'normalized',
        quote: withoutYear.raw,
        normalized: wanted,
        yearSource: 'url',
        verbatim: false,
        detail: `${DATE_STATUS_REASONS.normalized}（页面写「${withoutYear.raw}」，年份取自 URL 的 ${urlYear}）`,
      };
    }
    return {
      status: 'mismatch',
      quote: withoutYear.raw,
      normalized: null,
      yearSource: null,
      verbatim: false,
      detail: `页面写「${withoutYear.raw}」，URL 年份是 ${urlYear}，与断言 ${target.year} 不符`,
    };
  }

  // 兜底：页面有日期信息，但不是可比的"某一天"——不能记成「页面没有日期」，那是两回事
  const coarse = tokens.length === 0 ? coarseDateOf(input.text) : null;
  if (coarse !== null) {
    return {
      status: 'mismatch',
      quote: null,
      normalized: null,
      yearSource: null,
      verbatim: false,
      detail: `页面只有${coarse}，不能当成某一天，不归一`,
    };
  }

  return {
    status: tokens.length === 0 ? 'absent' : 'mismatch',
    quote: null,
    normalized: null,
    yearSource: null,
    verbatim: false,
    detail:
      tokens.length === 0
        ? DATE_STATUS_REASONS.absent
        : `${DATE_STATUS_REASONS.mismatch}（页面另有 ${tokens.length} 个日期写法）`,
  };
}

/** 页面里的粗日期（不是某一天）——只用于解释失败，不参与归一 */
function coarseDateOf(text: string): string | null {
  if (/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(text)) {
    return '斜杠日期（如 03/04/2023，日/月语序有歧义）';
  }
  if (/\d{4}\s*年\s*\d{1,2}\s*月(?!\s*\d{1,2}\s*日)/.test(text)) {
    return '「YYYY年M月」这种只到月的写法';
  }
  if (new RegExp(`(${MONTH_PATTERN})\\s*,?\\s*(?:19|20)\\d{2}`, 'i').test(text)) {
    return '「Month YYYY」这种只到月的写法';
  }
  return null;
}

/** 按断言的字符（空白宽松）在原文里找一处原样片段；找不到返回 null */
function findVerbatimQuote(text: string, asserted: string): string | null {
  const parts = asserted.trim().split(/\s+/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (parts.length === 0) return null;
  const match = new RegExp(parts.join('\\s*'), 'i').exec(text);
  return match === null ? null : match[0];
}

/** 机构字段的核对结论 */
export type HouseMatchStatus =
  /** 断言原样出现在结构位置里 */
  | 'hit'
  /** 结构位置上出现的是同一机构的另一种写法（拉丁/汉字/简称/繁简） */
  | 'alias'
  /** 抽不出结构区域，或结构区域里没有拍行明文（正文顺带提及不算） */
  | 'unjudgeable';

export interface HouseMatch {
  status: HouseMatchStatus;
  /** 页面原文片段（页面上实际出现的那一种写法） */
  quote: string | null;
  /** 别名表里的规范名；断言不在表里时为 null */
  canonical: string | null;
  /** 命中的别名/断言原文 */
  matchedAs: string | null;
  verbatim: boolean;
  detail: string;
  /** 命中落在哪个结构位置；整页文本口径或未命中时为 null */
  position?: HouseRegionName | null;
}

/** 机构证据允许出现的结构位置（顺序即优先序） */
export type HouseRegionName = 'header' | 'breadcrumb' | 'title' | 'saleHeading';

export interface HouseRegions {
  /** 页头：`<header>` 与站内导航 `<nav>` */
  header: string;
  /** 面包屑：class/id/aria-label 含 breadcrumb 的容器 */
  breadcrumb: string;
  /** 标题区：`<title>` 与 `<h1>` */
  title: string;
  /** 场次抬头：class/id 同时含 sale/auction 与 title/name/heading/header 的容器 */
  saleHeading: string;
}

export const EMPTY_HOUSE_REGIONS: HouseRegions = {
  header: '',
  breadcrumb: '',
  title: '',
  saleHeading: '',
};

const REGION_LABEL: Record<HouseRegionName, string> = {
  header: '页头/站内导航',
  breadcrumb: '面包屑',
  title: '标题区',
  saleHeading: '场次抬头',
};

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, code: string) => {
    if (code.startsWith('#')) {
      const numeric = code.startsWith('#x') || code.startsWith('#X')
        ? Number.parseInt(code.slice(2), 16)
        : Number.parseInt(code.slice(1), 10);
      return Number.isFinite(numeric) ? String.fromCodePoint(numeric) : whole;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** 片段 HTML → 可见文本（去掉标签、脚本与样式，折叠空白） */
function textOfFragment(fragment: string): string {
  return decodeEntities(
    fragment
      .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function blocksByTag(html: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) out.push(match[1] ?? '');
  return out;
}

function blocksByOpeningTagAttr(html: string, attrPattern: RegExp): string[] {
  const out: string[] = [];
  const regex = /<([a-z][\w-]*)\b([^>]*)>/gi;
  const lower = html.toLowerCase();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    if (!attrPattern.test(match[2] ?? '')) continue;
    const tag = (match[1] ?? '').toLowerCase();
    const end = lower.indexOf(`</${tag}>`, regex.lastIndex);
    if (end < 0) continue;
    out.push(html.slice(regex.lastIndex, end));
  }
  return out;
}

/**
 * 从原始 HTML 里抽出「机构证据允许出现」的四个结构位置。
 *
 * 只取结构，不取全文：页头/站内导航、面包屑、标题区、场次抬头。
 * 正文段落、图注、推广卡片、邮箱/电话、页脚版权与免责声明一律不进这四个区域，
 * 所以「曾由佳士得释出」「illustrated with pieces offered at Christie's」
 * 这类顺带提及不会再被当成拍行证据。
 *
 * 局限：没有 HTML 解析器，用标签与 class/id 的正则近似；嵌套同名标签时可能截短。
 * 抽不出任何区域时，调用方应记「判不了」而不是「没有」。
 */
export function extractHouseRegions(html: string): HouseRegions {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, ' ');
  const header = [...blocksByTag(cleaned, 'header'), ...blocksByTag(cleaned, 'nav')].join(' ');
  const breadcrumb = blocksByOpeningTagAttr(
    cleaned,
    /(?:class|id|aria-label|itemprop|itemtype)\s*=\s*["'][^"']*breadcrumb[^"']*["']/i,
  ).join(' ');
  const title = [...blocksByTag(cleaned, 'title'), ...blocksByTag(cleaned, 'h1')].join(' ');
  const saleHeading = blocksByOpeningTagAttr(
    cleaned,
    /(?:class|id)\s*=\s*["'][^"']*(?:(?:sale|auction)[-_a-z]*(?:title|name|heading|header)|(?:title|name|heading|header)[-_a-z]*(?:sale|auction))[^"']*["']/i,
  ).join(' ');
  return {
    header: textOfFragment(header),
    breadcrumb: textOfFragment(breadcrumb),
    title: textOfFragment(title),
    saleHeading: textOfFragment(saleHeading),
  };
}

/**
 * 只在结构区域里找机构名；四个区域都没有明文就记「判不了」。
 *
 * 先在整个区域集里找逐字写法，再找别名：同一家拍行在页头写简称、
 * 在面包屑写全称时，应该认全称那一处，不能因为页头排序靠前就退回别名。
 */
function matchHouseInRegions(asserted: string, regions: HouseRegions): HouseMatch {
  const entry = aliasEntryOf(asserted);
  const needles = [asserted, ...(entry === null ? [] : [entry.canonical, ...entry.aliases])];
  const order: HouseRegionName[] = ['header', 'breadcrumb', 'title', 'saleHeading'];
  const usable = order.filter((position) => regions[position] !== '');

  for (const position of usable) {
    const regionText = regions[position];
    if (!quoteMatches(asserted, regionText)) continue;
    const quote = findVerbatimQuote(regionText, asserted);
    if (quote === null) continue;
    return {
      status: 'hit',
      quote,
      canonical: entry?.canonical ?? null,
      matchedAs: asserted,
      verbatim: true,
      position,
      detail: `机构名原样出现在${REGION_LABEL[position]}里`,
    };
  }

  for (const position of usable) {
    const found = findNeedleQuote(regions[position], needles);
    if (found === null) continue;
    return {
      status: 'alias',
      quote: found.quote,
      canonical: entry?.canonical ?? null,
      matchedAs: found.needle,
      verbatim: false,
      position,
      detail: `机构名出现在${REGION_LABEL[position]}里，写的是「${found.quote}」`,
    };
  }

  return {
    status: 'unjudgeable',
    quote: null,
    canonical: entry?.canonical ?? null,
    matchedAs: null,
    verbatim: false,
    position: null,
    detail:
      usable.length === 0
        ? '页面没有抽出可用的结构区域（页头/面包屑/标题区/场次抬头），无法按结构位置判'
        : '页头、面包屑、标题区、场次抬头里都没有拍行明文；正文里的顺带提及、推广位、邮箱、页脚声明不算机构证据',
  };
}


/** 断言 → 别名表条目（复用 `canonicalHouseName` 的匹配规则，不做第二套相似度） */
function aliasEntryOf(asserted: string): { canonical: string; aliases: string[] } | null {
  const canonical = canonicalHouseName(asserted);
  const entry = HOUSE_ALIASES.find(([name]) => name === canonical);
  return entry === undefined ? null : { canonical: entry[0], aliases: entry[1] };
}

/** 1:1 的检索用折叠（字形折成简体、小写、弯引号折直引号），下标与原文一一对应 */
function searchable(text: string): string {
  return foldGlyphVariants(text)
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"');
}

/** 命中点是不是落在 URL/域名里（引文要给人看，不能拿 `christies.com` 当机构证据） */
function isUrlLike(text: string, at: number, length: number): boolean {
  const before = text.slice(Math.max(0, at - 12), at).toLowerCase();
  const after = text.slice(at + length, at + length + 8).toLowerCase();
  if (/(?:https?:\/\/|\/\/|www\.)$/.test(before)) return true;
  return /^\.(?:com|cn|net|org|co|io|art)\b/.test(after) || after.startsWith('://');
}

/**
 * 在一组写法里找页面上**最先出现**的一处命中，返回原文切片。
 *
 * 拉丁写法按整词匹配（`poly` 不能命中 `polychrome`），汉字写法按子串；
 * `heritage` / `guardian` / `council` 这类"本身就是普通英文词"的别名剔除——
 * 与标题冲突判据共用同一份黑名单，不在这里另立一套。
 * 落在 URL/域名里的命中跳过：那证明"页面提到过这个域名"，不证明"这页是这家拍的"。
 */
function findNeedleQuote(text: string, needles: string[]): { quote: string; needle: string } | null {
  const haystack = searchable(text);
  const sorted = [...new Set(needles)]
    .filter((needle) => needle.length >= 2)
    .filter((needle) => !needle.includes('.'))
    .filter((needle) => !AMBIGUOUS_LATIN_ALIASES.has(needle.toLowerCase()))
    .sort((a, b) => b.length - a.length);

  let best: { quote: string; needle: string; at: number } | null = null;
  for (const needle of sorted) {
    const needleText = searchable(needle);
    const latin = /^[a-z0-9' ]+$/.test(needleText);
    // 撇号可省：christies 也要能命中 christie's；长度按实际命中算，
    // 否则会多切一个字符（"christies." 就是这么来的）
    const escaped = needleText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "'?");
    const pattern = new RegExp(`(^|[^a-z0-9])(${escaped})([^a-z0-9]|$)`, 'gi');
    let from = 0;
    while (from <= haystack.length) {
      let at = -1;
      let length = needle.length;
      let next = haystack.length + 1;
      if (latin) {
        pattern.lastIndex = from;
        const match = pattern.exec(haystack);
        if (match !== null) {
          at = (match.index ?? 0) + (match[1]?.length ?? 0);
          length = match[2]?.length ?? needle.length;
          next = (match.index ?? 0) + match[0].length;
        }
      } else {
        at = haystack.indexOf(needleText, from);
        next = at + needleText.length;
      }
      if (at < 0) break;
      if (!isUrlLike(text, at, length)) {
        if (best === null || at < best.at) best = { quote: text.slice(at, at + length), needle, at };
        break;
      }
      from = next;
    }
  }
  return best === null ? null : { quote: best.quote, needle: best.needle };
}

/**
 * 机构判据：命中必须落在**站点结构位置**里，正文里怎么说都不算。
 *
 * 为什么改：旧口径是「机构名在页面最早出现即命中」，于是
 * `malmeida@christies.com`（员工邮箱）和推广卡片「illustrated with pieces offered at
 * Christie's」都算命中。这两种都只证明"页面里出现过这串字"，不证明"这一页是这家拍行的
 * 场次／拍品页"。
 *
 * **算证据的结构位置**（只有这四个）：
 * 1. 页头与站内导航：`<header>`、`<nav>`（拍行 logo/站名、返回本场次的导航）；
 * 2. 面包屑：class/id/aria-label 含 `breadcrumb` 的容器（`Christie's › Auctions › …`）；
 * 3. 标题区：`<title>` 与 `<h1>`；
 * 4. 场次抬头：class/id 同时含 `sale|auction` 与 `title|name|heading|header` 的容器。
 *
 * **不算证据的位置**（出现多少次都不算）：正文段落与图注（"此器曾售于佳士得"是转述）、
 * 推广卡片与"相关拍品"（`offered at Christie's` 是在推销别场）、邮箱与电话、页脚版权与
 * 免责声明、图片 alt 与 og/meta 标签。
 *
 * 四个区域里都没有拍行明文时记 `unjudgeable`（判不了），不记 `absent`（没有）：
 * "判不了"是这一层的材料不足以证明归属，"没有"是把材料不足说成了结论。
 *
 * **会漏掉的真命中**（如实写清代价）：
 * - 拍行名只出现在 `<img alt>` 或 CSS 背景图里，页面没有可读的页头文本；
 * - 站点不用 `<header>/<nav>`，页头是 `<div class="top-bar">` 这类无可识别语义的容器；
 * - 拍行名只写在场次抬头的 class 命名里不含 sale/auction 关键词的容器（如 `chr-event__title`）；
 * - 单件页只有面包屑写"Live Auction 21663"这种编号、页头只放 logo 图片，没有拍行明文。
 * 以上会判成"判不了"而不是"命中"——宁可判不了，也不把顺带提及当归属。
 */
export function matchHouseField(input: { asserted: string; regions: HouseRegions }): HouseMatch {
  const asserted = input.asserted.trim();
  if (asserted === '') {
    return {
      status: 'unjudgeable',
      quote: null,
      canonical: null,
      matchedAs: null,
      verbatim: false,
      position: null,
      detail: '断言为空',
    };
  }
  return matchHouseInRegions(asserted, input.regions);
}

/** 旧口径（整页任意位置出现即命中）——只用于改动前后对照，不参与现在的判定 */
function legacyHouseMention(text: string, asserted: string): boolean {
  const entry = aliasEntryOf(asserted);
  const needles = [asserted, ...(entry === null ? [] : [entry.canonical, ...entry.aliases])];
  return quoteMatches(asserted, text) || findNeedleQuote(text, needles) !== null;
}

/**
 * 场次层最小契约：专场名、举办日期、机构、语种、关联键。
 *
 * 为什么必须链到场次层：单件页上不保证有专场名——部分站点（如 Christie's 中文站）
 * 会在面包屑里写，另一些站点的已入库页面只有适配器模板。单件页上"三字段不成立"
 * 主要是因为机构名通常只以域名/logo 出现，正文没有可当证据的拍行明文。
 * 所以场次维度只在场次记录齐了这两项时才判；缺一项就记「未测」。
 *
 * 缺字段怎么标：`evaluateSessionLayer` 返回 `missing` 列表，调用方把该页的场次维度
 * 记成 `not-measured`，**不记 0**——0 是"判了但没中"，未测是"这一层没有材料"。
 */
export const SESSION_LAYER_FIELDS: Array<{
  key: keyof SessionLayerRecord;
  label: string;
  required: boolean;
  note: string;
}> = [
  {
    key: 'sessionKey',
    label: '场次关联键',
    required: true,
    note: '稳定标识（sessionId 或规范化后的场次 URL），用来把单件挂到场次上',
  },
  {
    key: 'sessionName',
    label: '专场名',
    required: true,
    note: '场次页原文写法，保留页面语种（不翻译、不缩写）',
  },
  {
    key: 'sessionDate',
    label: '举办日期',
    required: true,
    note: 'ISO 日期；与单件的事件日期分开存，不从单件反推',
  },
  {
    key: 'houseCanonical',
    label: '机构规范名',
    required: true,
    note: 'HOUSE_ALIASES 的规范名；场次记录自带，不从单件页域名猜',
  },
  {
    key: 'language',
    label: '专场名语种',
    required: true,
    note: 'en / zh；断言与场次名语种不一致时不能逐字比，需要别名表',
  },
  {
    key: 'sessionUrl',
    label: '场次页 URL',
    required: false,
    note: '可选：场次页本身，用于对场次名做二次核验',
  },
];

export type SessionLanguage = 'en' | 'zh';

export interface SessionLayerRecord {
  sessionKey: string | null;
  sessionName: string | null;
  sessionDate: string | null;
  houseCanonical: string | null;
  language: SessionLanguage | null;
  sessionUrl?: string | null;
}

/** 场次维度结论 */
export type SessionMatchStatus =
  /** 契约已满足，专场名与断言一致 */
  | 'measured-match'
  /** 契约已满足，但专场名对不上 */
  | 'measured-mismatch'
  /** 契约已满足，但断言与场次名语种不同（需要场次别名表，本契约下不判） */
  | 'language-mismatch'
  /** 契约没满足（单件页这一层没有材料）：未测，不是 0 */
  | 'not-measured';

export interface SessionMatch {
  status: SessionMatchStatus;
  quote: string | null;
  /** 契约缺了哪几项 */
  missing: string[];
  detail: string;
}

/** 场次记录是否满足契约；缺项按字段 key 列出 */
export function evaluateSessionLayer(record: Partial<SessionLayerRecord> | null | undefined): {
  status: 'measured' | 'not-measured';
  missing: string[];
} {
  const missing = SESSION_LAYER_FIELDS.filter((field) => field.required).filter((field) => {
    const value = record?.[field.key];
    return value === null || value === undefined || String(value).trim() === '';
  }).map((field) => field.key);
  return { status: missing.length === 0 ? 'measured' : 'not-measured', missing };
}

/** 专场名比对的归一：只折字形、去空白与标点，不做语言转换 */
function sessionNameKey(name: string): string {
  return foldGlyphVariants(name).toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
}

/**
 * 场次判据。
 *
 * 语种不同（断言是英文、场次名是中文）时不猜：`language-mismatch` 归到「未测」，
 * Finarte 那页的 `milan` / `Milano` 就是这一类——同一场次的语言差异要由场次别名表
 * 解决，不能靠模糊相似度硬判。
 */
export function matchSessionField(input: {
  assertedName: string | null;
  assertedLanguage: SessionLanguage | null;
  record: Partial<SessionLayerRecord> | null | undefined;
}): SessionMatch {
  const contract = evaluateSessionLayer(input.record);
  if (contract.status === 'not-measured') {
    return {
      status: 'not-measured',
      quote: null,
      missing: contract.missing,
      detail: `场次层缺 ${contract.missing.join('、')}：这一层没有材料，记未测（不是 0）`,
    };
  }
  const name = input.assertedName?.trim() ?? '';
  if (name === '') {
    return {
      status: 'not-measured',
      quote: null,
      missing: ['assertedSessionName'],
      detail: '断言侧没有专场名，判不了专场维度',
    };
  }
  const record = input.record as SessionLayerRecord;
  if (input.assertedLanguage !== null && record.language !== input.assertedLanguage) {
    return {
      status: 'language-mismatch',
      quote: record.sessionName,
      missing: [],
      detail: `断言语种 ${input.assertedLanguage} 与场次名语种 ${record.language} 不同，需要场次别名表才能判（本契约下记未测）`,
    };
  }
  if (sessionNameKey(record.sessionName ?? '') === sessionNameKey(name)) {
    return {
      status: 'measured-match',
      quote: record.sessionName,
      missing: [],
      detail: '专场名与场次记录一致',
    };
  }
  return {
    status: 'measured-mismatch',
    quote: record.sessionName,
    missing: [],
    detail: `断言「${name}」与场次记录的「${record.sessionName ?? ''}」不是同一个写法`,
  };
}

/** 一页的裁决结论（存进冻结样本；评分卡只读它，不读正文） */
export interface CorpusPageVerdict {
  url: string;
  domain: string;
  kind: CorpusPageKind;
  /** 清洗后正文字符数 */
  chars: number;
  /** 正文是否够用（≥200 字符） */
  readable: boolean;
  /** 是否属于"可进入两字段裁决"的材料：原始正文且可读 */
  adjudicable: boolean;
  house: HouseMatch | null;
  date: DateMatch | null;
  session: SessionMatch;
  /** 旧口径读数（整页任意位置出现即命中），保留用于改动前后对照 */
  verbatimBaseline: { house: boolean; date: boolean; twoFields: boolean } | null;
  twoFieldsVerified: boolean;
  threeFieldsVerified: boolean | null;
}

/** 一页的输入：正文 + 断言（断言来自结构化字段，不经正文） */
export interface CorpusPageInput {
  url: string;
  domain: string;
  kind: CorpusPageKind;
  text: string;
  assertedHouse: string | null;
  assertedDate: string | null;
  assertedSessionName: string | null;
  assertedSessionLanguage: SessionLanguage | null;
  /** 场次层记录（本轮库里没有，传 null） */
  sessionRecord: Partial<SessionLayerRecord> | null;
  /**
   * 从原始 HTML 抽出的结构位置。机构判据只认这四个区域，正文不算；
   * 调用方没有 HTML 时传 `EMPTY_HOUSE_REGIONS`，机构一项会记「判不了」。
   */
  houseRegions: HouseRegions;
}

/**
 * 裁一页。
 *
 * - 媒体稿（`article`）不构造拍行断言：机构/日期/专场一律 null，只统计可读性；
 * - 原始正文（`raw`）→ 两字段分母；
 * - 抽取器模板（`template`）→ 仍给出字段判定（用于说明"模板会自证"），但 `adjudicable`
 *   为 false，不进任何分母。
 */
export function judgeCorpusPage(input: CorpusPageInput): CorpusPageVerdict {
  const chars = input.text.length;
  const readable = chars >= MIN_USABLE_TEXT_CHARS;
  const adjudicable = input.kind === 'raw' && readable;
  const session = matchSessionField({
    assertedName: input.assertedSessionName,
    assertedLanguage: input.assertedSessionLanguage,
    record: input.sessionRecord,
  });

  if (input.kind === 'article') {
    return {
      url: input.url,
      domain: input.domain,
      kind: input.kind,
      chars,
      readable,
      adjudicable: false,
      house: null,
      date: null,
      session,
      verbatimBaseline: null,
      twoFieldsVerified: false,
      threeFieldsVerified: null,
    };
  }

  const house =
    input.assertedHouse === null
      ? null
      : matchHouseField({ asserted: input.assertedHouse, regions: input.houseRegions });
  const date =
    input.assertedDate === null
      ? null
      : matchDateField({ asserted: input.assertedDate, text: input.text, url: input.url });
  const houseOk = house !== null && (house.status === 'hit' || house.status === 'alias');
  const dateOk = date !== null && (date.status === 'hit' || date.status === 'normalized');
  const twoFieldsVerified = houseOk && dateOk;
  const threeFieldsVerified =
    session.status === 'not-measured' || session.status === 'language-mismatch'
      ? null
      : twoFieldsVerified && session.status === 'measured-match';
  // 旧口径只用来做改动前后对照：它正是"机构名在整页任何位置出现即命中"那一条
  const baselineHouseHit =
    input.assertedHouse === null ? false : legacyHouseMention(input.text, input.assertedHouse.trim());

  return {
    url: input.url,
    domain: input.domain,
    kind: input.kind,
    chars,
    readable,
    adjudicable,
    house,
    date,
    session,
    verbatimBaseline: {
      house: baselineHouseHit,
      date: date?.verbatim ?? false,
      twoFields: baselineHouseHit && (date?.verbatim ?? false),
    },
    twoFieldsVerified,
    threeFieldsVerified,
  };
}

/** 三档读数 + 「材料不够」与「判据判不中」的分档 */
export interface CorpusTierResult {
  pages: number;
  /** 正文可读率（分母：全部页） */
  readable: number;
  readableRate: number | null;
  /** 可进入两字段裁决的页（原始正文且可读） */
  adjudicable: number;
  /** 两字段（机构+日期）全中 */
  twoFieldHits: number;
  twoFieldRate: number | null;
  /** 旧口径（逐字）两字段全中，仅用于对照 */
  verbatimTwoFieldHits: number;
  /** 场次层契约已满足的页 */
  sessionMeasured: number;
  /** 三字段全中 */
  threeFieldHits: number;
  /** 三字段可核率；场次层一页都没满足时为 null（未测，不是 0） */
  threeFieldRate: number | null;
  /** 材料不够（不进两字段分母） */
  material: {
    template: number;
    article: number;
    unreadable: number;
    truncated: number;
  };
  /** 判据判不中（只在可裁决页里数） */
  judgment: {
    /** 结构位置里没有拍行明文（含抽不出结构区域） */
    houseUnjudgeable: number;
    dateMiss: number;
    dateYearUnresolved: number;
    sessionNotMeasured: number;
  };
}

function rate(hit: number, total: number): number | null {
  if (total === 0) return null;
  return Math.round((hit / total) * 1000) / 10;
}

/**
 * 三档读数。三件事分开数：
 * - 正文可读率的分母是全部页（材料在不在）；
 * - 两字段可核率的分母是可裁决页（模板、媒体稿、不可读页都不进）；
 * - 三字段可核率的分母是场次层契约已满足的页；一页都没有 → 未测。
 */
export function measureCorpusPages(
  pages: CorpusPageVerdict[],
  options: { truncatedUrls?: ReadonlySet<string> } = {},
): CorpusTierResult {
  const readable = pages.filter((page) => page.readable).length;
  const adjudicablePages = pages.filter((page) => page.adjudicable);
  const twoFieldHits = adjudicablePages.filter((page) => page.twoFieldsVerified).length;
  const verbatimTwoFieldHits = adjudicablePages.filter((page) => page.verbatimBaseline?.twoFields === true).length;

  const sessionMeasured = adjudicablePages.filter(
    (page) =>
      page.session.status === 'measured-match' ||
      page.session.status === 'measured-mismatch' ||
      page.session.status === 'language-mismatch',
  );
  const threeFieldHits = sessionMeasured.filter((page) => page.threeFieldsVerified === true).length;

  const truncatedUrls = options.truncatedUrls ?? new Set<string>();
  const material = {
    template: pages.filter((page) => page.kind === 'template').length,
    article: pages.filter((page) => page.kind === 'article').length,
    unreadable: pages.filter((page) => !page.readable).length,
    truncated: pages.filter((page) => truncatedUrls.has(page.url)).length,
  };

  const judgment = {
    houseUnjudgeable: adjudicablePages.filter((page) => page.house?.status === 'unjudgeable').length,
    dateMiss: adjudicablePages.filter(
      (page) => page.date?.status === 'mismatch' || page.date?.status === 'absent',
    ).length,
    dateYearUnresolved: adjudicablePages.filter((page) => page.date?.status === 'year-unresolved').length,
    sessionNotMeasured: adjudicablePages.filter((page) => page.session.status === 'not-measured').length,
  };

  return {
    pages: pages.length,
    readable,
    readableRate: rate(readable, pages.length),
    adjudicable: adjudicablePages.length,
    twoFieldHits,
    twoFieldRate: rate(twoFieldHits, adjudicablePages.length),
    verbatimTwoFieldHits,
    sessionMeasured: sessionMeasured.length,
    threeFieldHits,
    threeFieldRate: rate(threeFieldHits, sessionMeasured.length),
    material,
    judgment,
  };
}
