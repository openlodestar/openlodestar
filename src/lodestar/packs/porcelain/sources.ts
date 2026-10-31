// src/lodestar/packs/porcelain/sources.ts
/**
 * 瓷器域的来源清单（域知识，随包发布）
 *
 * 这里回答两件只在瓷器/古玩拍卖域成立的事：
 * - `WHITELIST_ENTRIES`：哪些站点算来源、各自属于什么分类，供档位判定与家族归并；
 * - `BLACKLIST_ENTRIES`：哪些页面人工确认过"对本域没有证据价值"（无价格、反爬、导航枢纽）。
 *
 * 这些内容曾经放在 `src/integrations/` 与 `data/*.json`，但它们不是引擎能力：
 * 换一个领域，站点清单与无效页判据都会变。现在清单归包所有，引擎只通过
 * `DomainPack.blockedReason` 读取剔除结论，不认识任何具体域名。
 *
 * 档位语义（见 rules.ts）：verified / candidate 都参与档位判定（域名身份不因
 * "此刻抓不抓得动"而降级），dead 不参与；定向检索的准入只用 verified 子集。
 */

/** 来源条目状态 */
export type WhitelistEntryStatus = 'verified' | 'candidate' | 'dead';

/** 来源清单条目 */
export interface WhitelistEntry {
  /** 域名（小写） */
  domain: string;
  /** 来源名称 */
  name: string;
  /** 来源分类（auction / ecommerce / collector_site / media） */
  category?: string;
  /** 状态：缺省视为 verified */
  status?: WhitelistEntryStatus;
}

/** 人工确认的黑名单成因 */
export type BlacklistReason = 'no-price' | 'anti-crawl' | 'nav-hub' | 'other';

/** 黑名单条目 */
export interface BlacklistEntry {
  domain: string;
  /** 存在 = URL 级条目（仅屏蔽该 hostname 下该精确路径，'/' 即首页） */
  path?: string;
  reason: BlacklistReason;
}

/** 来源清单（全量，含 candidate / dead） */
export const WHITELIST_ENTRIES: readonly WhitelistEntry[] = [
  { domain: 'sothebys.com', name: '苏富比', category: 'auction', status: 'verified' },
  { domain: 'christies.com', name: '佳士得', category: 'auction', status: 'verified' },
  { domain: 'phillips.com', name: '富艺斯', category: 'auction', status: 'verified' },
  { domain: 'bonhams.com', name: '邦瀚斯', category: 'auction', status: 'verified' },
  { domain: 'heritageauctions.com', name: 'Heritage Auctions', category: 'auction', status: 'verified' },
  { domain: 'ha.com', name: 'Heritage Auctions', category: 'auction', status: 'verified' },
  { domain: 'catawiki.com', name: 'Catawiki', category: 'auction', status: 'verified' },
  { domain: 'invaluable.com', name: 'Invaluable', category: 'auction', status: 'verified' },
  { domain: 'auctionzip.com', name: 'AuctionZip', category: 'auction', status: 'verified' },
  { domain: 'the-saleroom.com', name: 'The Saleroom', category: 'auction', status: 'verified' },
  { domain: 'icollector.com', name: 'iCollector', category: 'auction', status: 'verified' },
  { domain: 'polypm.com.cn', name: '保利拍卖在线', category: 'auction', status: 'verified' },
  { domain: 'council.com.cn', name: '匡时', category: 'auction', status: 'verified' },
  { domain: 'hanhai.net', name: '北京翰海', category: 'auction', status: 'verified' },
  { domain: 'sungari1995.com', name: '中贸圣佳', category: 'auction', status: 'verified' },
  { domain: 'xlysauc.com', name: '西泠印社拍卖', category: 'auction', status: 'verified' },
  { domain: 'duoyunxuan.com.cn', name: '朵云轩', category: 'auction', status: 'verified' },
  { domain: 'polyauction.com.cn', name: '保利拍卖官网', category: 'auction', status: 'candidate' },
  { domain: 'cguardian.com', name: '嘉德', category: 'auction', status: 'candidate' },
  { domain: 'barnebys.com', name: 'Barnebys', category: 'auction', status: 'candidate' },
  { domain: 'yipai.com', name: '易拍全球', category: 'auction', status: 'candidate' },
  { domain: 'liveauctioneers.com', name: 'LiveAuctioneers', category: 'auction', status: 'candidate' },
  { domain: 'ebay.com', name: 'eBay', category: 'ecommerce', status: 'verified' },
  { domain: 'amazon.com', name: 'Amazon', category: 'ecommerce', status: 'verified' },
  { domain: 'etsy.com', name: 'Etsy', category: 'ecommerce', status: 'candidate' },
  { domain: '1stdibs.com', name: '1stDibs', category: 'collector_site', status: 'candidate' },
  { domain: 'rubylane.com', name: 'Ruby Lane', category: 'collector_site', status: 'candidate' },
  { domain: 'mycollect.net', name: '华夏收藏网', category: 'collector_site', status: 'candidate' },
  { domain: 'pamono.com', name: 'Pamono', category: 'collector_site', status: 'candidate' },
  { domain: 'chairish.com', name: 'Chairish', category: 'collector_site', status: 'candidate' },
  { domain: 'trocadero.com', name: 'Trocadero', category: 'collector_site', status: 'candidate' },
  { domain: 'proantic.com', name: 'Proantic', category: 'collector_site', status: 'candidate' },
  { domain: 'vcoins.com', name: 'VCoins', category: 'collector_site', status: 'candidate' },
  { domain: 'ma-shops.com', name: 'MA-Shops', category: 'collector_site', status: 'candidate' },
  { domain: 'artsy.net', name: 'Artsy', category: 'collector_site', status: 'candidate' },
  { domain: 'artron.net', name: '雅昌艺术网', category: 'media', status: 'verified' },
  { domain: 'thevalue.com', name: 'TheValue 值点网', category: 'media', status: 'verified' },
  { domain: 'artprice.com', name: 'Artprice', category: 'media', status: 'verified' },
  { domain: 'artnet.com', name: 'artnet', category: 'media', status: 'verified' },
  { domain: 'mutualart.com', name: 'MutualArt', category: 'media', status: 'candidate' },
  { domain: 'worthpoint.com', name: 'WorthPoint', category: 'media', status: 'candidate' },
  { domain: 'artpro.com', name: 'ArtPro', category: 'media', status: 'candidate' },
];

/** 人工确认的无效页清单 */
export const BLACKLIST_ENTRIES: readonly BlacklistEntry[] = [
  { domain: 'baike.baidu.com', reason: 'no-price' },
  { domain: 'www.dpm.org.cn', reason: 'no-price' },
  { domain: 'zhihu.com', reason: 'anti-crawl' },
  { domain: 'www.polypm.com.cn', path: '/', reason: 'nav-hub' },
];

/** pathname 归一化：'' → '/'；query / hash 不参与匹配 */
function normalizePathname(pathname: string): string {
  return pathname.length === 0 ? '/' : pathname;
}

/**
 * 命中判定：返回命中的条目（含 reason），未命中返回 null。
 *
 * - 域名级条目（无 path）：hostname 后缀匹配命中即屏蔽（覆盖全部子域）；
 * - URL 级条目（含 path）：hostname 后缀命中 **且** pathname 归一化后精确相等；
 * - URL 解析失败 → 不屏蔽。
 */
export function matchBlacklistEntry(url: string): BlacklistEntry | null {
  let hostname: string;
  let pathname: string;
  try {
    const parsed = new URL(url);
    hostname = parsed.hostname.toLowerCase();
    pathname = parsed.pathname;
  } catch {
    return null;
  }
  const normalized = normalizePathname(pathname);
  for (const entry of BLACKLIST_ENTRIES) {
    const hostMatch = hostname === entry.domain || hostname.endsWith(`.${entry.domain}`);
    if (!hostMatch) continue;
    if (entry.path === undefined || normalized === entry.path) return entry;
  }
  return null;
}

/** URL 的域内剔除原因；null = 不剔除（原因文本直接进检索足迹） */
export function blockedReasonOf(url: string): string | null {
  const blocked = matchBlacklistEntry(url);
  if (!blocked) return null;
  return `命中黑名单（${blocked.domain}${blocked.path ?? ''}，${blocked.reason}）`;
}
