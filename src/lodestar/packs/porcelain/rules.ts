// src/lodestar/packs/porcelain/rules.ts
/**
 * 瓷器（古玩拍卖）领域策略包的域内细则
 *
 * 这里的东西**全部是域知识**：机构别名、来源家族归并、权威档位、日期写法、
 * 类目词表、详情页形态。引擎不认识任何一个具体域名或列名——分层判据见
 * `packs/pack.ts` 顶部注释。
 */

import { WHITELIST_ENTRIES } from './sources';
import { normalizeText } from '../../normalize';
import { foldGlyphVariants } from '../../../utils/text-language';
import type { SourceTier } from '../../types';

/** registrable domain 之外的多级公共后缀（需要整体保留的国别二级域） */
const MULTI_PART_TLDS = ['com.cn', 'net.cn', 'org.cn', 'gov.cn', 'edu.cn', 'co.uk', 'com.hk', 'com.tw'];

/**
 * 取注册域（去子域，保留国别二级后缀）。
 * 例：www.cguardian.com → cguardian.com；policy.auction.artprice.com → artprice.com；
 *     duoyunxuan.com.cn → duoyunxuan.com.cn
 */
export function registrableDomain(hostname: string): string {
  const host = hostname.toLowerCase().replace(/^\.+|\.+$/g, '');
  if (host === '') return '';
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  const tail = parts.slice(-2).join('.');
  if (MULTI_PART_TLDS.includes(tail) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return tail;
}

/**
 * 已知同族站点的归并表（域知识）：
 * 跨语言站、主域与备用域、重定向落点——同一家族的多个域名只算**一个**独立来源。
 * 值取家族里最稳定的那个注册域。
 */
const FAMILY_ALIASES: Record<string, string> = {
  'ha.com': 'heritageauctions.com',
  'polyauction.com.cn': 'polypm.com.cn',
  'cguardian.com': 'cguardian.com',
  'guardian.com.cn': 'cguardian.com',
  'artprice.com': 'artprice.com',
  'artnet.com': 'artnet.com',
};

/** 域名 → 来源家族（先取注册域，再走别名归并） */
export function familyOf(domain: string): string {
  const registered = registrableDomain(domain);
  if (registered === '') return '';
  return FAMILY_ALIASES[registered] ?? registered;
}

/**
 * 多机构拍卖聚合/比价平台（白名单 category=auction 里的非自营站）。
 * 判据：该平台自己不主办专场，只转述别家的场次与结果——
 * 它们可以佐证存在，但**不得单独作为 refuted 的依据**（来源独立性三判据之一）。
 */
const AUCTION_AGGREGATORS = new Set([
  'invaluable.com',
  'auctionzip.com',
  'the-saleroom.com',
  'icollector.com',
  'barnebys.com',
  'yipai.com',
  'liveauctioneers.com',
  'catawiki.com',
]);

/** 跨家成交价数据库（白名单 category=media 里的聚合侧） */
const PRICE_AGGREGATORS = new Set(['artprice.com', 'artnet.com', 'mutualart.com', 'worthpoint.com', 'artpro.com']);

/** 单一机构的成交图录/报道侧档案（可算一手报道，但权重低于官方源） */
const PRIMARY_REPORTERS = new Set(['artron.net', 'thevalue.com']);

/** 域名 → 白名单 category（宿主系统的来源白名单只读，本包不另建一份域名清单） */
function whitelistCategory(domain: string): string | undefined {
  const registered = registrableDomain(domain);
  if (registered === '') return undefined;
  // 读全量条目（含 candidate）但排除 dead：**档位看内容身份，不看我们此刻抓不抓得动**。
  // 只用 verified 清单会把嘉德官网降成"来路不明"，而它的页面正是该场拍卖的一手记录。
  const entry = WHITELIST_ENTRIES.find(
    (e) => e.status !== 'dead' && registrableDomain(e.domain) === registered,
  );
  return entry?.category;
}

/**
 * 域名 → 权威档位（official > primary > aggregator）。
 *
 * "权威权重先直接用现有站点分级的现成档位，不再新设计一层"——
 * 本函数只做一次映射：白名单 category + 本包的聚合站名单 → 三档。
 * 不在白名单里的域名一律 unlisted（降权，且永不构成 E3）。
 */
export function tierOf(domain: string): SourceTier {
  const registered = registrableDomain(domain);
  if (registered === '') return 'unlisted';
  if (AUCTION_AGGREGATORS.has(registered) || PRICE_AGGREGATORS.has(registered)) return 'aggregator';
  if (PRIMARY_REPORTERS.has(registered)) return 'primary';
  const category = whitelistCategory(registered);
  switch (category) {
    case 'auction':
      return 'official';
    case 'media':
      return 'primary';
    case 'collector_site':
    case 'ecommerce':
      return 'aggregator';
    default:
      return 'unlisted';
  }
}

/** 单个日期串 → 年 / 月 / 日（月日为 null 表示只解析到该精度）；解析不出返回 null */
function parseSingleDate(
  raw: string,
  fallbackYear?: number,
): { year: number; month: number | null; day: number | null } | null {
  // 中文写法先转成分隔符形式：2014年5月18日 → 2014-5-18
  const cleaned = raw
    .replace(/[年月.\/]/g, '-')
    .replace(/日/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
  // 位数多的写法排在前：否则 "12月" 会被 0?[1-9] 先吃掉 "1"、"18日" 被吃掉 "1"
  const match = cleaned.match(
    /(1[89]\d{2}|20\d{2})(?:-?(1[0-2]|0[1-9]|[1-9])(?:-?(3[01]|[12]\d|0[1-9]|[1-9]))?)?/,
  );
  if (match) {
    return {
      year: Number(match[1]),
      month: match[2] ? Number(match[2]) : null,
      day: match[3] ? Number(match[3]) : null,
    };
  }
  // 区间尾段常省略年份（"2014年5月至6月"）：借前侧年份，只认月/日
  if (fallbackYear !== undefined) {
    const partial = cleaned.match(/^(?:-?)?(1[0-2]|0[1-9]|[1-9])(?:-?(3[01]|[12]\d|0[1-9]|[1-9]))?/);
    if (partial) {
      return {
        year: fallbackYear,
        month: Number(partial[1]),
        day: partial[2] ? Number(partial[2]) : null,
      };
    }
  }
  return null;
}

/**
 * 中文拍品日期写法 → 起止日期。
 * 覆盖："2014年5月18日" / "2014-05" / "2014" / "2014春季" / "2014 秋拍" / "2014.5" /
 * "2014年5月18日 - 2014年5月31日" / "2014年5月至6月"。解析不出返回全 null（不猜）。
 */
export function parseTimeScope(text: string | null | undefined): { from: string | null; to: string | null } {
  const empty = { from: null, to: null };
  if (!text) return empty;
  const normalized = String(text).trim();
  if (normalized === '') return empty;

  // 区间写法先劈开：两侧各按单日期解析
  const rangeSplit = normalized.split(/(?:至|~|～|—|－|\s+-\s+|\bto\b)/i);
  const first = parseSingleDate(rangeSplit[0] ?? '');
  if (!first) return empty;
  const last = rangeSplit.length > 1 ? parseSingleDate(rangeSplit[rangeSplit.length - 1] ?? '', first.year) : null;

  const iso = (year: number, month: number, day: number) =>
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  /** 单侧解析结果 → 起止（月份缺失按季度/整年放宽） */
  const spanOf = (parsed: { year: number; month: number | null; day: number | null }, hint: string) => {
    if (parsed.month === null) {
      if (/春|一季|二季度?/.test(hint) && !/秋|冬/.test(hint)) return { y: parsed.year, from: [1, 1], to: [6, 30] };
      if (/秋|冬|四季|年末/.test(hint)) return { y: parsed.year, from: [7, 1], to: [12, 31] };
      return { y: parsed.year, from: [1, 1], to: [12, 31] };
    }
    const lastDay = new Date(Date.UTC(parsed.year, parsed.month, 0)).getUTCDate();
    const day = parsed.day ?? null;
    return {
      y: parsed.year,
      from: [parsed.month, day ?? 1],
      to: [parsed.month, day ?? lastDay],
    };
  };

  const start = spanOf(first, rangeSplit[0] ?? '');
  if (last) {
    const end = spanOf(last, rangeSplit[rangeSplit.length - 1] ?? '');
    return {
      from: iso(start.y, start.from[0], start.from[1]),
      to: iso(end.y, end.to[0], end.to[1]),
    };
  }
  return { from: iso(start.y, start.from[0], start.from[1]), to: iso(start.y, start.to[0], start.to[1]) };
}

/** 模型返回列名各次提问都可能不同，这里把别名归一到本包字段键 */
export const COLUMN_ALIASES: Record<string, string[]> = {
  auctionHouse: ['拍卖行', '拍卖机构', '机构', '行名', '拍卖公司', 'auction house', 'house', 'auctioneer'],
  dateText: ['时间', '年份', '日期', '年月', '举办时间', 'date', 'year'],
  sessionName: ['专场', '专场名称', '场次', '专场主题', '图录专场', 'session', 'sale title', 'sale'],
  location: ['地点', '城市', '地址', 'location', 'city'],
  category: ['类目', '品类', '门类', 'category'],
  totalHammer: ['成交额', '总成交额', '成交总额', 'hammer total', 'total'],
  // catalogRef（专场编号/图录号）已退役（2026-10-09）：编号类字段实测全是模型编造，
  // 这里不留别名——模型自报的编号列在 mapRow 处直接丢弃，进不了记录。
};

/** 陶瓷类目词表（坐标供宿主系统匹配的类目标签由它产出） */
export const CATEGORY_VOCABULARY = [
  '瓷器',
  '陶瓷',
  '青花',
  '粉彩',
  '单色釉',
  '颜色釉',
  '斗彩',
  '五彩',
  '珐琅彩',
  '民窑',
  '官窑',
  '民间瓷器',
  '工艺品',
  '中国艺术',
  'china',
  'porcelain',
];

/**
 * 专场名归一（记录对齐用）：去掉"专场/拍卖会/场次"这类每次作答都可能多写或少写的尾词，
 * 但保留括号编号（"瓷器（一）"与"瓷器（二）"是两场，不能对齐成一场）。
 */
const SESSION_SUFFIX_NOISE = /(?:拍卖会|拍卖图录|专场|拍卖|场次|图录)+$/;

export function normalizeSessionName(text: string | null | undefined): string {
  const base = normalizeText(text ?? '');
  return base.replace(SESSION_SUFFIX_NOISE, '').slice(0, 12);
}

/** 从一段文本里挑出命中的类目词（保持词表顺序，确定性输出） */
export function categoryTagsFrom(texts: Array<string | null | undefined>): string[] {
  const joined = texts.filter((t): t is string => typeof t === 'string' && t !== '').join(' ').toLowerCase();
  if (joined === '') return [];
  const tags: string[] = [];
  for (const term of CATEGORY_VOCABULARY) {
    if (joined.includes(term.toLowerCase()) && !tags.includes(term)) tags.push(term);
  }
  return tags;
}

/**
 * 详情页链接形态（本域）：拍品详情页 /  lot 页 / 图录单件页。
 * 命中任一路径或查询串特征即算；导航与枢纽形态由引擎的通用排除项处理。
 */
export const DETAIL_PATH_HINTS = [
  'product_detail',
  'productdetail',
  '/lot/',
  'lot_detail',
  '/item/',
  '/goods/',
  '/拍品',
  'lotdetail',
  '/detail/',
  'auction_detail',
  'detail.html',
  'detail.php',
  'infoId=',
  'saleid=',
  'lotno=',
];

/**
 * 列表枢纽页的路径形态（本域）：这场/这一季的场次索引与专场列表。
 * **只喂入口解析的排序与重取预算**，不参与"是不是详情页"的判定（后者见上一条）。
 * 保利这类站点把索引页与场次页都做成 `.html`，裸 fetch 常只拿到 JS 外壳——
 * 越像枢纽的页，越值得花一次浏览器重取。
 */
export const HUB_PATH_HINTS = [
  'auction_index',
  'auction_list',
  'auction_calendar',
  '/auction/index',
  '/auction/list',
  '/auction/calendar',
  '/list.',
  '/index.',
  '/catalog',
  '/category',
  '/archive',
  '/calendar',
  '/sales',
  '/auctions',
  '/events',
];

/** 机构别名（简称 / 全称 / 英文名）——比对细则与查询构造共用一份，避免两处各写一遍 */export const HOUSE_ALIASES: Array<[string, string[]]> = [
  ['中国嘉德', ['嘉德', 'guardian', 'cguardian']],
  ['北京保利', ['保利', 'poly', 'polypm']],
  ['北京匡时', ['匡时', 'council']],
  ['西泠印社拍卖', ['西泠', 'xiling']],
  ['中贸圣佳', ['圣佳', 'sungari']],
  ['北京翰海', ['翰海', 'hanhai']],
  ['朵云轩', ['duoyunxuan']],
  ['苏富比', ['sotheby', 'sothebys']],
  ['佳士得', ["christie's", 'christies']],
  ['富艺斯', ['phillips']],
  ['邦瀚斯', ['bonhams']],
  [' Heritage Auctions'.trim(), ['heritage', 'ha.com']],
];

/**
 * 机构/平台名 → 白名单里的已知域（relay 目标域、归档入口与来源坐标验收都靠它）。
 *
 * 按条目名与机构别名互含匹配："保利拍卖在线"含"保利"、"嘉德"就是"中国嘉德"的简称。
 * 匹配不上返回空数组——**不猜域名**。`categories` 可收窄（relay 只跟拍卖行自己的域）。
 */
export function knownHostsOf(
  text: string | null | undefined,
  categories?: readonly string[],
): string[] {
  const canonical = canonicalHouseName(text);
  if (canonical === '') return [];
  const aliases = HOUSE_ALIASES.find(([name]) => name === canonical)?.[1] ?? [];
  const needles = [canonical, ...aliases]
    .map((needle) => foldGlyphVariants(needle).toLowerCase())
    .filter((needle) => needle.length >= 2);
  if (needles.length === 0) return [];
  const hosts = WHITELIST_ENTRIES
    .filter((entry) => entry.status !== 'dead')
    .filter((entry) => !categories || (entry.category !== undefined && categories.includes(entry.category)))
    .filter((entry) => {
      const name = foldGlyphVariants(entry.name ?? '').toLowerCase();
      if (name === '') return false;
      return needles.some((needle) => name.includes(needle) || needle.includes(name));
    })
    .map((entry) => registrableDomain(entry.domain))
    .filter((host) => host !== '');
  return [...new Set(hosts)];
}

/** 拍卖行自己的域（relay 目标域：聚合站的成交记录要跟回拍行官网） */
export function officialHostsOfHouse(text: string | null | undefined): string[] {
  return knownHostsOf(text, ['auction']);
}

/**
 * 已知平台的入口通道（域知识）：归档页给 `archive`，站内检索给 `site-search`。
 *
 * 只列**已从证据页或白名单确认存在的主机与路径族**——这里拼出来的只是候选，
 * 抓不到就照常退档（入口解析对候选失败是 fail-open 的）。加一个平台 = 加一行，引擎不改。
 */
export const SOURCE_CHANNELS: Record<
  string,
  { archive?: { url: string; note: string }; search?: (query: string) => string }
> = {
  'polypm.com.cn': {
    archive: {
      url: 'https://www.polypm.com.cn/auction/auction_list.html?oldData=false',
      note: '保利旧场次索引',
    },
  },
  'artron.net': {
    archive: { url: 'https://auction.artron.net/', note: '雅昌拍卖频道' },
  },
  'ebay.com': {
    search: (query) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}`,
  },
};

/** 来源坐标的行映射（模型作答列名 → 本包来源字段键；含提问模板里逐字出现的列名） */
export const SOURCE_COLUMN_ALIASES: Record<string, string[]> = {
  sourceName: ['机构', '平台', '机构/平台', '机构名称', '来源', '网站', '拍卖行', '拍行', 'platform', 'source', 'site'],
  topic: ['主题', '器物', '器物主题', '物品', '器型', '题材', 'topic', 'item', 'object'],
  period: ['年代', '时期', '朝代', 'period', 'era', 'dynasty'],
  material: ['材质', '材料', 'material'],
  category: ['品类', '类目', '门类', 'category'],
};

/** 把机构写法归一（用于复现比对与"是否同一家"判定） */
export function canonicalHouseName(text: string | null | undefined): string {
  if (!text) return '';
  const value = foldGlyphVariants(String(text).trim()).toLowerCase();
  if (value === '') return '';
  for (const [canonical, aliases] of HOUSE_ALIASES) {
    if (value === canonical.toLowerCase() || aliases.some((a) => value === a.toLowerCase())) return canonical;
    // 汉字两字已成词（"嘉德"），拉丁串要四字以上才够独特（"ha" 这种会到处误命中）
    const minAliasLen = /[a-z]/.test(aliases[0] ?? '') ? 4 : 2;
    if (aliases.some((a) => a.length >= minAliasLen && value.includes(a.toLowerCase()))) return canonical;
  }
  return value;
}
