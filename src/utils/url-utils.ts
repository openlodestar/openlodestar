// src/utils/url-utils.ts
/**
 * URL 解析原语（纯函数，无依赖）
 *
 * 收敛 extractHostname 的多处重复实现（原先散在抓取器与检索器里）：
 *
 * 统一返回空串表示"无法解析"，由调用方自行归因（域名门禁失败、
 * 观测字段占位等），不在工具层抛出异常。
 */

/**
 * 从 URL 提取 hostname
 *
 * @param url 任意字符串（可能为非法 URL）
 * @returns 解析成功返回 hostname（如 `www.example.com`），失败返回空串
 */
export function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/** 追踪参数名（大小写不敏感前缀/全名匹配）：这些参数不改变页面身份，归一时一律去掉 */
const TRACKING_PARAM_PATTERN = /^(utm_|fbclid$|gclid$|msclkid$|yclid$|_ga$|ref_?$)/i;

/**
 * 归一化 URL 去重键（纯函数，全仓唯一定义点）
 *
 * 用途单一：双语双轨合流时判"两轨拿到的是不是同一张页面"。同一页面在中英两条
 * 搜索里常带不同的 fragment（`#lot-3`）与追踪参数（`?utm_source=...`），按原文
 * 比较会把一条判成两条、白占一份抓取配额。
 *
 * 归一动作只有两样，多一样都可能把**不同**页面并成一个（假去重会静默丢数据）：
 * 1. 去掉 fragment；
 * 2. 去掉追踪参数。
 * 解析失败（非法 URL）原样返回，不在工具层做无根据的清洗。
 *
 */
export function normalizedUrlKey(url: string): string {
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (TRACKING_PARAM_PATTERN.test(key)) parsed.searchParams.delete(key);
    }
    parsed.hash = '';
    const query = parsed.searchParams.toString();
    return `${parsed.origin}${parsed.pathname}${query === '' ? '' : `?${query}`}`;
  } catch {
    return url;
  }
}

/** 文章/新闻页的通用路径形态（只判"不像枢纽"，不是内容判定） */
const ARTICLE_PATH = /\/(?:news|article|articles|story|stories|content|post|posts)\//;

/**
 * 这条 URL 像不像文章/新闻页。
 *
 * 用途只有两个入参判断：浏览器重取预算分配、入口页验收时排除"好证据坏入口"。
 * 判错了代价是多抓或少花一次重取，不会把页面判成不存在的证据。
 */
export function isArticleUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host.startsWith('news.') || host.includes('.news.')) return true;
    return ARTICLE_PATH.test(parsed.pathname.toLowerCase());
  } catch {
    return ARTICLE_PATH.test(url.toLowerCase());
  }
}