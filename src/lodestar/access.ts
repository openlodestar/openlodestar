// src/lodestar/access.ts
/**
 * access 层——坐标的"再入"增强（与证据页的"作证"职责分离）
 *
 * 背景（2026-10-10 实测）：坐标试摊对 `rec-known-poly2021autumn` 全军覆没——
 * 8 页新闻页天然摊不出拍品详情（淘汰是正确裁决），而唯一可能是入口的官方专场页
 * （polypm auction_index / artron 预展中心）全是 JS 渲染空壳，裸 fetch 看不见拍品链接。
 * 结论：证据页不等于入口页。access 层把两件事拆开：
 * 1. **入口候选按源权威档位排序**（官方站 > 一手档案/媒体 > 聚合 > 名录外），
 *    而不是把证据页无差别全喂给试摊——官方站天然是入口候选，新闻页天然不是；
 * 2. **试摊结论带抓取器标识落库**（anchors.jsonl 的 `access` 列，patch 追加）：
 *    "能不能摊开"以抓取能力为前提，同一页面裸 fetch 判死、浏览器渲染可能就通，
 *    结论不标 fetcher 就会被当成页面本身的属性。
 *
 * 本模块不 import 任何抓取器：fetchHtml / extractDetails 由调用方注入
 * （demo 注入 toy-fetch + 坐标臂提取器；宿主系统注入 scraper-strategies 链路），
 * 引擎核保持离线可测。
 */

import { createStore } from './storage/adapter';
import type { AnchorAccess, AnchorRecord, EvidenceRecord, SourceTier } from './types';
import type { DomainPack } from './packs/pack';

const TIER_ORDER: Record<SourceTier, number> = { official: 0, primary: 1, aggregator: 2, unlisted: 3 };

/** 抓取器注入的返回形态（与 examples/porcelain/toy-fetch.ts 的 ToyFetchResult 同构） */
export type AccessFetchResult = { ok: true; html: string } | { ok: false; reason: string };

/**
 * 入口候选排序：官方站优先，同档内按 URL 字典序（确定性输出）。
 * 排序只决定"先试谁"，不做任何剔除——新闻页也留在候选里，试摊自己裁决。
 */
export function rankAccessCandidates(urls: string[], pack: DomainPack): string[] {
  const scored = urls.map((url) => {
    let tier: SourceTier = 'unlisted';
    try {
      tier = pack.tierOf(new URL(url).hostname);
    } catch {
      /* 解析不了按 unlisted 排最后 */
    }
    return { url, rank: TIER_ORDER[tier] };
  });
  return scored
    .sort((a, b) => a.rank - b.rank || a.url.localeCompare(b.url))
    .map((s) => s.url);
}

/**
 * 入口候选 = 坐标自带来源 + 与该记录有关的证据页（supports / refutes）。
 *
 * `irrelevant` 行虽然也是"抓过的页"，但它对这条记录不作证——实测保利官网页里混着地址/联系方式页，
 * 把它们送进试摊只会把"无关页摊不出详情"误记成"站点不可用"。
 */
export function accessCandidateUrls(
  anchorUrls: readonly string[],
  evidence: ReadonlyArray<Pick<EvidenceRecord, 'url' | 'relation'>>,
): string[] {
  const relevant = evidence
    .filter((row) => row.relation === 'supports' || row.relation === 'refutes')
    .map((row) => row.url);
  return [...new Set([...anchorUrls, ...relevant])];
}

/** 试摊输入：候选页 + 抓取与提取的注入实现 */
export interface ProbeAccessInput {
  /** 入口候选（调用方可用 rankAccessCandidates 先排序） */
  candidates: string[];
  pack: DomainPack;
  /** 抓一页 HTML（toy-fetch / scraper-strategies 由调用方注入） */
  fetchHtml: (url: string) => Promise<AccessFetchResult>;
  /** 从一页 HTML 提取同域详情链接（坐标臂的 extractSameSiteDetailLinks） */
  extractDetails: (html: string, hubUrl: string) => string[];
  /** 抓取器标识（写进结论，读的人据此判断结论在什么能力下成立） */
  fetcher: string;
  /** 最多试几页（缺省全试——试摊本身只是抓取，不触发搜索计费） */
  maxProbes?: number;
}

/** 试摊输出：落库用的 access 结论 + 运行时的摊出链接（按入口页归堆，下游直接取，不重抓） */
export interface ProbeAccessOutput {
  access: AnchorAccess;
  /** 入口页 → 摊出的详情链接（只记 ok 的页；落库列不含它，链接量可能很大） */
  linksByEntry: Map<string, string[]>;
}

/**
 * 逐证据页试摊：按候选顺序抓页、摊链接，产出 access 结论与摊出链接。
 *
 * entryUrl 取**顺位最高的摊出页**（不是摊得最多的）——官方站摊出 3 条也优先于
 * 聚合站摊出 30 条，权威档位是排序依据，试摊只做"通/不通"的机械裁决。
 * 全军覆没返回 entryUrl: null，attempts 照样留痕（淘汰也是诚实输出）。
 */
export async function probeAnchorAccess(input: ProbeAccessInput): Promise<ProbeAccessOutput> {
  const attempts: AnchorAccess['attempts'] = [];
  const linksByEntry = new Map<string, string[]>();
  const candidates = input.maxProbes ? input.candidates.slice(0, input.maxProbes) : input.candidates;

  for (const url of candidates) {
    const fetched = await input.fetchHtml(url);
    if (!fetched.ok) {
      attempts.push({ url, ok: false, linkCount: 0, reason: fetched.reason });
      continue;
    }
    const links = input.extractDetails(fetched.html, url);
    attempts.push({ url, ok: true, linkCount: links.length });
    if (links.length > 0) linksByEntry.set(url, links);
  }

  const winner = attempts.find((a) => a.ok && a.linkCount > 0) ?? null;
  return {
    access: {
      entryUrl: winner?.url ?? null,
      detailCount: winner?.linkCount ?? 0,
      probedAt: new Date().toISOString(),
      fetcher: input.fetcher,
      attempts,
    },
    linksByEntry,
  };
}

/**
 * 把试摊结论补写进坐标（anchors.jsonl 的唯一合法写法：patch 追加一行，读时取最后一条）。
 * 坐标不存在（recordId 打错）返回 null；坐标文件只追加不改写历史的纪律不变。
 */
export async function persistAnchorAccess(
  recordId: string,
  access: AnchorAccess,
  store = createStore(),
): Promise<AnchorRecord | null> {
  const current = await store.get<AnchorRecord>('anchors', recordId);
  if (!current) return null;
  return store.patch<AnchorRecord>('anchors', recordId, { access });
}
