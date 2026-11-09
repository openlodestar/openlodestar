// src/lodestar/live-recall.ts
/**
 * 在线召回率（离线重算，零外部调用）
 *
 * 回答的问题：**引擎决定要问的那些查询，到底有几条能在线捞到"可以裁的页面"。**
 * 它衡量的是检索面，不是判定面——判据再准，捞不回页面也只能判 not_found。
 *
 * 输入是冻结的检索回放样本（`examples/replay-search/<slug>/search-results.json`），
 * 输出是一条比例读数。冻结样本里的原始结果替代网络，路由与候选过滤全部走当前真代码，
 * 所以代码改了（路由、过滤、编造判据）这个读数会跟着变——这正是评分卡要看的。
 *
 * 「可裁」的判据（写死在这里，文档同步）：
 * 1. 通过候选过滤（http、非图片/文档、不在黑名单、标题与域名机构不冲突）；
 * 2. 标题或摘要里出现本场关键值（样本显式列出的 `matchTerms`，跨语言）；
 * 3. **不抓页、不核逐字引用**——这是静态自洽级的代理读数，不是"证据成立"。
 *    所以它回答"有没有页可裁"，不回答"页面是否真的支持这条断言"。
 *
 * 分母口径：**源查询条数**（引擎决定要问的问题数）。0 召回补发的译文并入其源查询，
 * 不重复计入分母；实际检索调用数另记在 `calls`。
 */

import type { SearchResultItem } from '../integrations/search-providers/types';
import type { DomainPack } from './packs/pack';
import { filterAndRankCandidates, planZeroRecallRepairs } from './adjudicate/retrieval';
import { normalizeText } from './normalize';

/** 冻结样本里的一条轨（源轨或补发轨） */
export interface LiveRecallTrack {
  language: string | null;
  queries: string[];
  results: SearchResultItem[];
}

/** 冻结检索样本中本模块需要的最小字段 */
export interface LiveRecallFixture {
  slug: string;
  queries: string[];
  translation: { language: string; queries: string[] } | null;
  tracks: LiveRecallTrack[];
  /** 判断"这条结果在讲本场"的关键词（跨语言，显式列出） */
  matchTerms?: string[];
  /** 没有 matchTerms 时的回退：记录的关键字段值 */
  values?: Record<string, string | null>;
}

export interface LiveRecallRow {
  /** 源查询 */
  query: string;
  /** 源轨返回条数 */
  sourceReturned: number;
  /** 0 召回时补发的译文（没有补发为 null） */
  repairQuery: string | null;
  /** 补发返回条数 */
  repairReturned: number;
  /** 通过过滤且与本场相关的候选页数 */
  adjudicable: number;
  /** 本查询是否召回到至少一条可裁真页 */
  hit: boolean;
}

export interface LiveRecallResult {
  slug: string;
  /** 分母：源查询条数（补发并入源查询，不重复计） */
  issued: number;
  /** 分子：至少一条轨召回到可裁真页的源查询条数 */
  hit: number;
  /** hit / issued（%）；分母为 0 时为 null（未测，不是 0） */
  value: number | null;
  /** 实际检索调用数：源查询 + 0 召回补发 */
  calls: number;
  rows: LiveRecallRow[];
  /** 判据层级：静态自洽（不抓页核逐字引用） */
  basis: 'static-self-consistency-no-fetch';
}

function sameQueries(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** 从冻结样本离线重算在线召回率 */
export function measureLiveRecall(fixture: LiveRecallFixture, pack: DomainPack): LiveRecallResult {
  const sourceTrack =
    fixture.tracks.find((track) => sameQueries(track.queries, fixture.queries)) ?? fixture.tracks[0];
  if (sourceTrack === undefined) {
    return {
      slug: fixture.slug,
      issued: 0,
      hit: 0,
      value: null,
      calls: 0,
      rows: [],
      basis: 'static-self-consistency-no-fetch',
    };
  }

  const translationTrack =
    fixture.translation === null
      ? undefined
      : fixture.tracks.find((track) => track.language === fixture.translation?.language);
  const translatedQueries = fixture.translation?.queries ?? [];

  const answered = new Set(sourceTrack.results.map((item) => item.queryIndex));
  const plan = planZeroRecallRepairs({ queries: fixture.queries, translatedQueries, answeredIndexes: answered });
  const repairSet = new Set(plan.indexes);

  const needles = (fixture.matchTerms ?? Object.values(fixture.values ?? {}))
    .map((value) => normalizeText(value ?? ''))
    .filter((value) => value !== '');

  const rows: LiveRecallRow[] = [];
  for (const [index, query] of fixture.queries.entries()) {
    const sourceItems = sourceTrack.results.filter((item) => item.queryIndex === index);
    let repairQuery: string | null = null;
    let repairItems: SearchResultItem[] = [];
    if (repairSet.has(index)) {
      const translated = translatedQueries[index];
      if (translated !== undefined && translated !== '') {
        repairQuery = translated;
        const repairIndex = translationTrack?.queries.indexOf(translated) ?? -1;
        if (repairIndex >= 0) {
          repairItems = translationTrack!.results.filter((item) => item.queryIndex === repairIndex);
        }
      }
    }

    // 同一 URL 在两条轨里出现两次时只算一条（与引擎合流口径一致）
    const byUrl = new Map<string, SearchResultItem>();
    for (const item of [...sourceItems, ...repairItems]) if (!byUrl.has(item.url)) byUrl.set(item.url, item);
    const allItems = [...byUrl.values()];
    const { candidates } = filterAndRankCandidates(allItems, pack);
    const adjudicable = candidates.filter((candidate) => {
      const item = byUrl.get(candidate.url);
      const text = normalizeText(`${candidate.title} ${item?.snippet ?? ''}`);
      return needles.some((needle) => text.includes(needle));
    });

    rows.push({
      query,
      sourceReturned: sourceItems.length,
      repairQuery,
      repairReturned: repairItems.length,
      adjudicable: adjudicable.length,
      hit: adjudicable.length > 0,
    });
  }

  const issued = fixture.queries.length;
  const hit = rows.filter((row) => row.hit).length;
  return {
    slug: fixture.slug,
    issued,
    hit,
    value: issued === 0 ? null : Math.round((hit / issued) * 1000) / 10,
    calls: issued + plan.indexes.length,
    rows,
    basis: 'static-self-consistency-no-fetch',
  };
}
