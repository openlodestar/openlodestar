// src/lodestar/packs/porcelain/slots.ts
/**
 * 字段值的归一槽（瓷器拍卖域的知识，不进引擎）
 *
 * 存在的理由是一次实测读数：73 次比对里，时间类断言**原样命中 0/27**——断言写"2024年4月"，
 * 页面上写的是"4月7日晚上…中国嘉德香港2024春季拍卖会"；断言写"中国嘉德（香港）"，
 * 页面连排写"中国嘉德香港"；断言写"「禹贡」系列专场"，页面写"禹贡"系列专场。
 * 同一件事的两种写法，字符串层面永不相等。于是两处白花钱：
 * ① 查询串里塞着全角括号与破折号，搜索引擎召不回真页；
 * ② 抓回来的页面上其实写着，模型却按字面判"不相干"。
 *
 * 三条边界（越界就把审计做成了自证）：
 * 1. 归一槽**只喂两处**——拼检索串、预筛候选页。**不回写 `ClaimRecord.object`/`rawText`**：
 *    被核验的命题必须是模型当初说的那句话，否则我们在核验自己造出来的断言。
 * 2. 预筛**只能剔候选，不能造证据**：判"页面上找不到任何一种写法"就省掉那次模型调用；
 *    判"找得到"也只是照常送去比对，绝不因为写法对得上就直接记 supports。
 * 3. 规则判不了的一律返回 `unknown`（当成"可能有"），**绝不当成"没有"**——
 *    预筛的错杀是无声丢掉一条证据，底稿里连"我们看过又不要"都不会留下。
 */

import { normalizeText } from '../../normalize';
import { canonicalHouseName, HOUSE_ALIASES, parseTimeScope } from './rules';
import type { PageMention } from '../pack';

/** 季度档 → 月份区间（春拍 3–6 月、秋拍 9–12 月、跨年档落在 1–2 月；本域常识，别处无意义） */
const SEASON_RANGES: Array<{ word: string; alias: string[]; from: number; to: number }> = [
  { word: '春', alias: ['春季', '春天', '春拍'], from: 3, to: 6 },
  { word: '秋', alias: ['秋季', '金秋', '秋拍'], from: 9, to: 12 },
  { word: '冬', alias: ['冬季', '冬拍', '跨年'], from: 1, to: 2 },
];

/** 一个字段值的归一形态 */
export interface FieldSlot {
  /** 等价集里的代表写法（去括号、去标点后的紧凑形态） */
  canonical: string;
  /** 等价写法集合：判"页面上有没有这种说法"时逐个做包含比对（含 canonical 与原始写法） */
  equals: string[];
  /** 检索串变体，第 0 条为首选（已去掉全角括号、书名号、破折号这类搜索引擎噪声） */
  queryForms: string[];
  /** 时间窗（只有时间类字段能推出；推不出为 null） */
  window: { year: number; monthFrom: number | null; monthTo: number | null } | null;
}

/** 破折号族与书名号：normalizeText 不含全角破折号「——」，所以本模块自己劈 */
const DASHES = /[—–─―]+|--+|～|~/g;
const BRACKETS = /[（(][^）)]*[）)]/g;
const TITLE_MARKS = /[「」『』【】《》“”‘’"'’]/g;

/**
 * 参与"这页上有没有这种写法"比对的匹配键。
 *
 * 为什么不直接用引擎的 `normalizeText`：它只折 ASCII 连字符，不折全角破折号——
 * 专场名的主副标题正是用「——」分隔的，于是断言侧把破折号换成空格、页面侧原样留着，
 * 两边归一后仍不相等（实测踩过）。匹配键在这里再剥一层破折号与间隔号，两侧同走一条规则。
 */
const DASH_CHARS = /[—–─―‐·・]+/g;

export function matchKey(text: string): string {
  return normalizeText(text).replace(DASH_CHARS, '');
}

/**
 * 专场名里的季/编号噪声词（尾部"专场/拍卖会"这类每次作答都可能多写少写）。
 *
 * `系列` 必须在这里：实测坐标写「禹贡」系列专场，真站场次页写的是
 * "禹贡—中国古美术的千年之旅"——不剥"系列"就只剩词干"禹贡系列"，永远匹配不上。
 */
const SESSION_TAIL_NOISE = /(?:艺术品拍卖会|拍卖会|拍卖图录|专场|场次|图录|系列)+$/g;

/** 机构名括号里的地区词：它属于"哪一场"的身份，不能整条丢掉，但要能从连排写法里认出来 */
function regionOf(text: string): string[] {
  return [...text.matchAll(/[（(]([^）)]{1,6})[）)]/g)]
    .map((m) => (m[1] ?? '').trim())
    .filter((r) => r !== '' && !/有限公司|股份|集团|拍卖/.test(r));
}

/** 罗马数字 ↔ 阿拉伯数字的编号互转（"藏瓷II"与"藏瓷2"是同一专场） */
const ROMAN_TO_ARABIC: Record<string, string> = {
  I: '1', II: '2', III: '3', IV: '4', V: '5', VI: '6', VII: '7', VIII: '8', IX: '9', X: '10',
};
const ARABIC_TO_ROMAN: Record<string, string> = Object.fromEntries(
  Object.entries(ROMAN_TO_ARABIC).map(([r, a]) => [a, r]),
);

function numeralVariants(text: string): string[] {
  const out: string[] = [];
  const roman = /([IVX]{1,4})$/;
  const arabic = /([0-9]{1,2})$/;
  const compact = text.replace(/\s+$/g, '');
  const m1 = roman.exec(compact);
  if (m1 && ROMAN_TO_ARABIC[m1[1] ?? '']) {
    out.push(compact.replace(roman, ROMAN_TO_ARABIC[m1[1] ?? '']));
    out.push(compact.replace(roman, '').trim());
  }
  const m2 = arabic.exec(compact);
  if (m2 && ARABIC_TO_ROMAN[m2[1] ?? '']) out.push(compact.replace(arabic, ARABIC_TO_ROMAN[m2[1] ?? '']));
  const unicodeRomans = /[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]/;
  if (unicodeRomans.test(text)) {
    out.push(
      text
        .replace(/Ⅰ/g, 'I').replace(/Ⅱ/g, 'II').replace(/Ⅲ/g, 'III').replace(/Ⅳ/g, 'IV').replace(/Ⅴ/g, 'V')
        .replace(/Ⅵ/g, 'VI').replace(/Ⅶ/g, 'VII').replace(/Ⅷ/g, 'VIII').replace(/Ⅸ/g, 'IX').replace(/Ⅹ/g, 'X'),
    );
  }
  return out;
}

/** 从写法里认年份与月份（先给"YYYY年M月"这类规整形态，再退到裸年份） */
function yearMonthOf(text: string): { year: number; month: number | null } | null {
  const scope = parseTimeScope(text);
  const year = scope.from ? Number(scope.from.slice(0, 4)) : Number.NaN;
  const month = scope.from && scope.from.length >= 7 ? Number(scope.from.slice(5, 7)) : Number.NaN;
  if (!Number.isInteger(year) || year < 1900 || year > 2100) return null;
  return { year, month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : null };
}

/** 写法里直接出现的季度词（"2021秋季艺术品拍卖会"没有月份，但季度是明确的） */
function seasonOf(text: string): (typeof SEASON_RANGES)[number] | null {
  for (const range of SEASON_RANGES) {
    if (text.includes(range.word) || range.alias.some((a) => text.includes(a))) return range;
  }
  return null;
}

function slotOfHouse(value: string): FieldSlot {
  const regions = regionOf(value);
  const base = canonicalHouseName(value.replace(BRACKETS, '').trim()) || value.replace(BRACKETS, '').trim();
  const equals = new Set<string>();
  const queryForms: string[] = [];
  const push = (form: string): void => {
    const t = form.replace(BRACKETS, ' ').replace(/\s{2,}/g, ' ').trim();
    if (t === '' || matchKey(t).length < 2) return;
    if (!equals.has(matchKey(t))) equals.add(matchKey(t));
    if (!queryForms.includes(t)) queryForms.push(t);
  };
  // 连排写法（"中国嘉德香港"）是拍行自己页面上的常见形态，排最前
  for (const region of regions) push(`${base}${region}`);
  push(`${base} ${regions.join(' ')}`);
  const latin = HOUSE_ALIASES.find(([canonical]) => canonical === base)?.[1].find((a) => /^[a-z][a-z.' ]{3,}$/i.test(a));
  if (latin) push(latin);
  push(base);
  push(value);
  return { canonical: normalizeText(base), equals: [...equals], queryForms, window: null };
}

function slotOfDate(value: string): FieldSlot {
  const ym = yearMonthOf(value);
  const season = seasonOf(value);
  const equals = new Set<string>();
  const queryForms: string[] = [];
  const add = (form: string): void => {
    const t = form.trim();
    if (t === '') return;
    if (!equals.has(matchKey(t))) equals.add(matchKey(t));
    if (!queryForms.includes(t)) queryForms.push(t);
  };
  const month = ym?.month ?? null;
  const effectiveSeason = season ?? (ym && month ? SEASON_RANGES.find((r) => month >= r.from && month <= r.to) ?? null : null);
  if (ym) {
    // 页面上真正常见的写法：季度式（"2024春季拍卖会"）优先于月份式
    if (effectiveSeason) {
      add(`${ym.year}${effectiveSeason.word}季拍卖会`);
      add(`${ym.year}年${effectiveSeason.word}季`);
      add(`${ym.year}${effectiveSeason.word}拍`);
    }
    if (month) add(`${ym.year}年${month}月`);
    add(String(ym.year));
  }
  add(value);
  const window = ym
    ? {
        year: ym.year,
        monthFrom: month ?? effectiveSeason?.from ?? null,
        monthTo: month ?? effectiveSeason?.to ?? null,
      }
    : null;
  return { canonical: ym ? String(ym.year) : normalizeText(value), equals: [...equals], queryForms, window };
}

function slotOfSession(value: string): FieldSlot {
  const equals = new Set<string>();
  const queryForms: string[] = [];
  const add = (form: string): void => {
    const t = form.replace(TITLE_MARKS, '').replace(DASHES, ' ').replace(/\s{2,}/g, ' ').trim();
    if (t === '' || matchKey(t).length < 2) return;
    if (!equals.has(matchKey(t))) equals.add(matchKey(t));
    if (!queryForms.includes(t)) queryForms.push(t);
  };
  add(value);
  const bare = value.replace(TITLE_MARKS, '').trim();
  add(bare.replace(SESSION_TAIL_NOISE, ''));
  // 主副标题分开算等价写法：页面上多半只印其中一段（副题常是藏家专题名，检索性最好）
  const parts = bare.split(DASHES).map((p) => p.trim()).filter((p) => normalizeText(p).length >= 2);
  for (const part of parts) {
    add(part);
    add(part.replace(SESSION_TAIL_NOISE, ''));
  }
  if (parts.length > 1) add(parts.join(''));
  for (const variant of numeralVariants(bare)) add(variant);
  return {
    canonical: normalizeText(parts[parts.length - 1] ?? bare),
    equals: [...equals],
    queryForms,
    window: null,
  };
}

function slotOfGeneric(value: string): FieldSlot {
  const compact = value.replace(TITLE_MARKS, '').replace(DASHES, ' ').replace(/\s{2,}/g, ' ').trim();
  return { canonical: matchKey(compact), equals: [matchKey(value)], queryForms: [compact || value], window: null };
}

/** 字段值 → 归一槽（不认识的字段给通用槽，绝不猜） */
export function normalizedSlot(fieldKey: string, value: string | null | undefined): FieldSlot {
  const raw = (value ?? '').trim();
  if (raw === '') return { canonical: '', equals: [], queryForms: [], window: null };
  const slot = buildSlot(fieldKey, raw);
  // 原写法始终算一种等价写法：归一化只**增加**可认的写法，绝不因为归一失败而让原写法认不出
  const asKey = matchKey(raw);
  if (asKey !== '' && !slot.equals.includes(asKey)) slot.equals.push(asKey);
  return slot;
}

function buildSlot(fieldKey: string, raw: string): FieldSlot {
  switch (fieldKey) {
    case 'auctionHouse':
      return slotOfHouse(raw);
    case 'dateText':
    case 'year':
      return slotOfDate(raw);
    case 'sessionName':
      return slotOfSession(raw);
    default:
      return slotOfGeneric(raw);
  }
}

/** 拼检索串用的写法（第 0 条首选；无效值返回空数组，调用方退回原始值） */
export function querySurfaces(fieldKey: string, value: string | null | undefined): string[] {
  return normalizedSlot(fieldKey, value).queryForms;
}

/** 页面上能不能找到这个字段值的某种写法：只用于省一次模型调用，不用于造证据 */
export function pageMentions(fieldKey: string, value: string, pageText: string): PageMention {
  const slot = normalizedSlot(fieldKey, value);
  if (slot.equals.length === 0) return 'unknown';
  const hay = matchKey(pageText);
  if (hay === '') return 'unknown';
  if (slot.equals.some((form) => form !== '' && hay.includes(form))) return 'yes';

  if (fieldKey === 'dateText') {
    const year = slot.window?.year ?? null;
    // 年份都推不出（"近五年"这类）就无从判起；年份出现过也不当 yes——月份/季度对得上才算有说法
    if (year === null) return 'unknown';
    return hay.includes(String(year)) ? 'unknown' : 'no';
  }
  // 只有这两类字段的"整页找不到任何一种写法"是可靠的负信号；其余字段一律放行
  if (fieldKey === 'auctionHouse' || fieldKey === 'sessionName') return 'no';
  return 'unknown';
}

/** 来源坐标里"同一件东西的另一种说法"（域知识；只用于入口验收，不进断言） */
const SOURCE_VALUE_ALIASES: Record<string, (value: string) => string[]> = {
  period(value) {
    // 清代 = 清朝 = 大清：页面标题常写"清乾隆"，正文又写"清代"
    const base = value.replace(/\s/g, '').replace(/(?:代|朝|期)$/, '');
    if (base.length < 2) return [];
    return [`${base}代`, `${base}朝`, `大${base}`];
  },
  material(value) {
    const aliases: Record<string, string[]> = {
      黄花梨: ['花梨', '黄花黎'],
      紫檀: ['小叶紫檀', '檀香紫檀'],
      酸枝: ['红酸枝', '老酸枝'],
    };
    return aliases[value.trim()] ?? [];
  },
};

/** 主题词的"中心词"：中文名词短语的中心词在末尾（"黄花梨躺椅"→"躺椅"） */
function topicHeadOf(value: string): string {
  const compact = value.replace(/\s/g, '');
  if (compact.length <= 2) return compact;
  return compact.slice(-2);
}

/**
 * 来源坐标（品类/机构入口）的字段提及判定——与 `pageMentions` 的差别在负信号：
 * 这里的 `no` 是**入口验收**（主题对不上的页不能当入口），不是省一次模型调用。
 *
 * 主题判"整词或中心词都找不到"为 `no`；年代/材质判不了（页面上常不写，或只写"清乾隆"
 * 这类合写）一律 `unknown` 放行——入口验收宁可多试一页，也不能无声丢掉一条采集通路。
 */
export function sourceMentions(fieldKey: string, value: string, pageText: string): PageMention {
  const raw = (value ?? '').trim();
  if (raw === '') return 'unknown';
  const hay = matchKey(pageText);
  if (hay === '') return 'unknown';
  const slot = normalizedSlot(fieldKey, raw);
  if (slot.equals.some((form) => form !== '' && hay.includes(form))) return 'yes';
  const aliases = SOURCE_VALUE_ALIASES[fieldKey]?.(raw) ?? [];
  if (aliases.some((alias) => alias !== '' && hay.includes(matchKey(alias)))) return 'yes';

  if (fieldKey === 'topic') {
    const head = topicHeadOf(raw);
    if (head !== '' && head !== raw && hay.includes(matchKey(head))) return 'yes';
    return 'no';
  }
  if (fieldKey === 'period' || fieldKey === 'material' || fieldKey === 'category') return 'unknown';
  return 'no';
}

/** 月份写法（"12月5日"与"十二月五日"都算说到时间；年份/季度由 pageTimeCues 认） */
const MONTH_CLUE = /(?:[0-9]{1,2}|十一|十二|十|[一二三四五六七八九])月/;

/** 专场主名里的尾噪声词：断言侧会多写"系列/专场"，页面侧往往不写 */
const SESSION_CORE_NOISE = /(?:系列|艺术品拍卖会|拍卖会|拍卖图录|专场|场次|图录|季)+$/g;

/** 被引号/书名号包住的名称片段（反驳方向引的是页面上那一场"另一个专场名"） */
const QUOTED_FRAGMENT = /[「『【《“‘][^「『【《“”’]{2,}[」』】》”’]/;

/** 机构自指写法：自家公告通篇只写"本公司"，机械规则判不出是哪一家 */
const SELF_REFERENCE = /本公司|我公司|本行|本社|本院|本拍卖行/;

/**
 * 引文里有"该字段类"的线索形态吗？（写入侧的第二道机械断言）
 *
 * 为什么需要它：逐字命中只证明"这串字在页面上"，**不证明它说的是被裁的那个字段**。
 * 实测病灶——被裁字段是举办时间，引文却是「大巧若拙——竹月堂藏瓷II」这句专场名，
 * 照样进了计票。
 *
 * 判据按**字段类形态**判，不按"断言那个值本身的写法"判：反驳方向的引文引的是页面上
 * 那个**相反**的值（页面写"2022年秋季"、断言写"2021年12月5日"），按值判会把合法反驳一并杀掉。
 * 与本模块其他规则同一条纪律：判不了返回 `unknown`（放行照常比对），绝不当成"没有"。
 */
export function quoteBearsFieldClue(
  fieldKey: string | null,
  value: string | null | undefined,
  quote: string,
): PageMention {
  const text = (quote ?? '').trim();
  const raw = (value ?? '').trim();
  if (text === '' || raw === '') return 'unknown';
  switch (fieldKey) {
    case 'dateText':
    case 'year':
      return dateClueIn(text) ? 'yes' : 'no';
    case 'auctionHouse':
      return houseClueIn(text, raw);
    case 'sessionName':
      return sessionClueIn(text, raw);
    default:
      // 本包不认识的字段（地点/成交额…）没有"线索形态"可言，一律放行
      return 'unknown';
  }
}

/** 引文里有没有时间说法（年份、月份、季度三形态任一即可；说得对不对是模型的判定职责） */
function dateClueIn(quote: string): boolean {
  if (pageTimeCues(quote).length > 0) return true;
  return MONTH_CLUE.test(quote) || seasonOf(quote) !== null;
}

/** 引文里有没有机构名（断言那家的等价写法优先认；反驳会引另一家，故也认名册里的任一家） */
function houseClueIn(quote: string, value: string): PageMention {
  const hay = matchKey(quote);
  if (normalizedSlot('auctionHouse', value).equals.some((form) => form !== '' && hay.includes(form))) return 'yes';
  const anyHouse = HOUSE_ALIASES.some(([canonical, aliases]) =>
    [canonical, ...aliases].some((form) => {
      const key = matchKey(form);
      return key.length >= 2 && hay.includes(key);
    }),
  );
  if (anyHouse) return 'yes';
  return SELF_REFERENCE.test(quote) ? 'unknown' : 'no';
}

/** 引文里有没有专场名（断言那场的等价写法或主名；反驳会引另一场，故也认被引号包住的名称片段） */
function sessionClueIn(quote: string, value: string): PageMention {
  const hay = matchKey(quote);
  if (normalizedSlot('sessionName', value).equals.some((form) => form !== '' && hay.includes(form))) return 'yes';
  const core = matchKey(sessionCoreOf(value));
  if (core.length >= 2 && hay.includes(core)) return 'yes';
  return QUOTED_FRAGMENT.test(quote) ? 'yes' : 'no';
}

/** 专场名的主名：剥书名号 → 取破折号前第一段 → 剥"系列/专场/图录"这类尾词 */
function sessionCoreOf(value: string): string {
  const bare = value.replace(TITLE_MARKS, '').trim();
  const first = bare.split(DASHES).map((p) => p.trim()).filter((p) => p !== '')[0] ?? bare;
  return first.replace(SESSION_CORE_NOISE, '').trim();
}

/** 把页面正文里的时间线索抽成可比对的槽（预筛与后续"时间窗是否重叠"的机械校验共用） */
export function pageTimeCues(pageText: string): Array<{ year: number; month: number | null; seasonWord: string | null }> {
  const text = normalizeText(pageText);
  const out: Array<{ year: number; month: number | null; seasonWord: string | null }> = [];
  for (const m of text.matchAll(/(19\d{2}|20\d{2})年?([0-9]{1,2})?月?/g)) {
    const year = Number(m[1]);
    const month = m[2] ? Number(m[2]) : null;
    if (!Number.isInteger(year) || year < 1900 || year > 2100) continue;
    if (month !== null && (month < 1 || month > 12)) continue;
    if (!out.some((c) => c.year === year && c.month === month)) out.push({ year, month, seasonWord: null });
  }
  for (const range of SEASON_RANGES) {
    for (const m of text.matchAll(new RegExp(`(19\\d{2}|20\\d{2})年?${range.word}`, 'g'))) {
      const year = Number(m[1]);
      if (!Number.isInteger(year)) continue;
      for (let month = range.from; month <= range.to; month += 1) {
        if (!out.some((c) => c.year === year && c.month === month)) out.push({ year, month, seasonWord: range.word });
      }
    }
  }
  return out;
}
