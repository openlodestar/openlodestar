// src/lodestar/record-gate/source-anchor.ts
/**
 * 来源坐标（品类/机构入口）的独立门禁
 *
 * 与事件坐标的门禁不是同一件事：事件坐标问"这几个关键字段是不是同一页写的"，
 * 来源坐标问"这页能不能当这件东西的采集入口"。三问全部机械可判：
 * 1. **是入口吗**——页面上得摊得出详情链接，或者它本身就是品类/归档枢纽；
 * 2. **说的是这件东西吗**——策略包给的关键来源字段（主题、年代…）在这页上不能判"没有"；
 * 3. **可再入吗**——页面是我们自己抓通的（ok 且非空），不是模型转述的地址。
 *
 * 档位（下游默认只读 strong，与事件坐标同一条红线）：
 * - strong：来源自己的域上有一页通过验收，或通过验收的页里有官方/一手媒体页，
 *   或两个以上独立来源家族各有一页——任一条成立即算；
 * - weak：只有单一转述页（聚合/零售/未列名域）通过验收；
 * - rejected：没有一页通过验收（不产坐标）。
 *
 * 门禁只读页面的机械读数（详情链接数、是否枢纽、可见文本），不调模型。
 */

import { extractHostname } from '@src/utils/url-utils';
import { visibleText } from '../normalize';
import type { DomainPack, SourceFieldSpec } from '../packs/pack';
import { buildSourceSearchPhrases } from '../search-phrases';
import type { AnchorRecord, EvidenceGrade, SourceTier } from '../types';

/** 一次入口探测的机械读数（抓取与链接计数由调用方做，本模块只判） */
export interface SourceProbePage {
  url: string;
  ok: boolean;
  html: string;
  /** 抓取器标识：fetch / browser / site-adapter / cache */
  fetcher: string;
  /** 按策略包 `isDetailLink` 数出的详情链接数 */
  detailCount: number;
  /** 策略包 `isHubUrl` 判定的枢纽页（品类/归档/列表页） */
  hubLike: boolean;
  /** 抓取失败原因（ok=false 时写） */
  reason?: string;
}

export interface DeriveSourceAnchorInput {
  recordId: string;
  /** 产出这条坐标的提问原文（如"清朝黄花梨躺椅的权威成交记录在哪"） */
  query: string;
  fields: Record<string, string | null>;
  pack: DomainPack;
  /** 候选入口页的探测结果（顺序即优先级，坐标按它取 sourceUrls） */
  pages: SourceProbePage[];
  traceId: string;
  asOf: string;
}

export interface SourceAnchorDecision {
  anchor: AnchorRecord | null;
  gate: 'strong' | 'weak' | 'rejected';
  /** 人读理由（拒收也要说清楚哪几页为什么没过） */
  reason: string;
  /** 通过验收的入口页 */
  accepted: string[];
  /** 逐页淘汰留痕（与事件坐标的 attempts 同一条纪律） */
  rejectedPages: Array<{ url: string; reason: string }>;
}

/** 来源坐标门禁的判定入口（纯函数，不写盘、不联网） */
export function deriveSourceAnchor(input: DeriveSourceAnchorInput): SourceAnchorDecision {
  const { pack } = input;
  const keyFields = (pack.sourceFields?.() ?? []).filter((field) => field.role === 'key');
  const accepted: SourceProbePage[] = [];
  const rejectedPages: Array<{ url: string; reason: string }> = [];

  for (const page of input.pages) {
    const verdict = judgePage(page, keyFields, pack, input.fields);
    if (verdict === null) accepted.push(page);
    else rejectedPages.push({ url: page.url, reason: verdict });
  }

  if (accepted.length === 0) {
    return {
      anchor: null,
      gate: 'rejected',
      reason:
        rejectedPages.length === 0
          ? 'no-candidate-pages'
          : `no-entry:${rejectedPages.map((page) => page.reason).join(',')}`,
      accepted: [],
      rejectedPages,
    };
  }

  const hosts = accepted.map((page) => extractHostname(page.url)).filter((host) => host !== '');
  const ownHosts = pack.sourceHosts?.(input.fields) ?? [];
  const own = hosts.some((host) => hostMatchesAny(host, ownHosts));
  const families = new Set(hosts.map((host) => pack.sourceFamilyOf(host)).filter((family) => family !== ''));
  const authoritative = hosts.some((host) => {
    const tier: SourceTier = pack.tierOf(host);
    return tier === 'official' || tier === 'primary';
  });
  const strong = own || authoritative || families.size >= 2;
  const sourceUrls = dedupe(accepted.map((page) => page.url));

  const anchor: AnchorRecord = {
    recordId: input.recordId,
    kind: 'source',
    query: input.query,
    fields: input.fields,
    anchorGrade: strong ? 'strong' : 'weak',
    evidenceGrade: evidenceGradeOf({ own, authoritative, families: families.size }),
    searchPhrases: buildSourceSearchPhrases(input.fields, pack),
    sourceUrls,
    categoryTags: sourceCategoryTags(input.fields, pack),
    footprintRef: `source-probes:${input.traceId}`,
    traceId: input.traceId,
    asOf: input.asOf,
    stale: false,
  };

  return {
    anchor,
    gate: strong ? 'strong' : 'weak',
    reason: strong
      ? own
        ? 'source-host-entry'
        : authoritative
          ? 'authoritative-entry'
          : 'independent-families'
      : 'single-third-party-entry',
    accepted: sourceUrls,
    rejectedPages,
  };
}

/** 一页的验收：返回 null 表示通过，否则返回淘汰理由 */
function judgePage(
  page: SourceProbePage,
  keyFields: SourceFieldSpec[],
  pack: DomainPack,
  fields: Record<string, string | null>,
): string | null {
  if (!page.ok || page.html.trim() === '') return `fetch-failed:${page.reason ?? 'empty'}`;
  if (page.detailCount === 0 && !page.hubLike) return 'not-an-entry';

  const text = visibleText(page.html);
  for (const field of keyFields) {
    const value = fields[field.key];
    if (typeof value !== 'string' || value.trim() === '') continue;
    const mention = pack.sourceMentions?.(field.key, value, text) ?? 'unknown';
    // 判不了放行；只有包明确说"这页没说到这件东西"才拒绝
    if (mention === 'no') return `source-mismatch:${field.key}`;
  }
  return null;
}

function evidenceGradeOf(input: {
  own: boolean;
  authoritative: boolean;
  families: number;
}): EvidenceGrade {
  if (input.own) return 'E3';
  if (input.authoritative || input.families >= 2) return 'E2';
  return 'E1';
}

/** 类目标签：来源侧没有"专场类目"这种字段，按 品类 取（包按自己的词表判定，本模块不自造标签） */
function sourceCategoryTags(
  fields: Record<string, string | null>,
  pack: DomainPack,
): string[] {
  const tags = pack.categoryTagsOf({ recordId: '', fields, rawText: '' });
  const category = (fields.category ?? '').trim();
  return category === '' || tags.includes(category) ? tags : [...tags, category];
}

function hostMatchesAny(host: string, hosts: readonly string[]): boolean {
  const left = host.toLowerCase();
  return hosts.some((target) => {
    const right = target.toLowerCase();
    if (right === '') return false;
    return left === right || left.endsWith(`.${right}`) || right.endsWith(`.${left}`);
  });
}

function dedupe(urls: string[]): string[] {
  return [...new Set(urls)].sort();
}
