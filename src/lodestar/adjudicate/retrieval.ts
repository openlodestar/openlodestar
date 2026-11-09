// src/lodestar/adjudicate/retrieval.ts
/**
 * 检索编排（证据发现，不是定位某个实例页）
 *
 * 复用既有搜索提供者与按域定向查询的构造思路，但**判据换了**：
 * 宿主系统的定向查询要"找到那一页"，这里要"唤起该主题的多源证据"，
 * 所以去掉实例级限定词（图录号、单件价格），只留机构 / 时间 / 专场主题。
 *
 * 候选池的过滤与宿主系统也不同，是刻意的：宿主系统那条门禁是**预算守卫**（只在
 * 白名单域上花抓取预算）；证据基数要求"至少两个互相独立的来源"，把池子限死在
 * 白名单里就等于自己决定了自己最多能拿到几档。这里只按黑名单剔垃圾，
 * 白名单不参与准入，只参与排序——白名单外的来源落 `unlisted` 档、降权但留档。
 */

import { extractHostname, normalizedUrlKey } from '../../utils/url-utils';
import { createLogger } from '../../utils/logger';
import { interleaveTracks } from '../../utils/interleave';
import { dominantLanguageClass, toSearchHl, type LanguageClass } from '../../utils/text-language';
import { translateQueries, type TranslationTarget } from '../../services/query-translation';
import {
  createSearchProvider,
  getSearchProviderFromEnv,
  type SearchResultItem,
} from '../../integrations/search-providers';
import { fillTemplate, type DomainPack, type FieldSpec } from '../packs/pack';
import { normalizeText } from '../normalize';
import type { ClaimRecord, SourceTier } from '../types';

/** 一条断言的检索候选来源 */
export interface EvidenceCandidate {
  url: string;
  domain: string;
  sourceFamily: string;
  tier: SourceTier;
  title: string;
  /** 搜索排序位（观测用，不作证据） */
  position: number;
}

/** 记录级共用的一份检索结果（同一记录的各字段判定复用同一候选池） */
export interface SharedRetrieval {
  queries: string[];
  candidates: EvidenceCandidate[];
  searchCalls: number;
  provider: string;
  /** 因提供者能力不足没发出去的查询（见 RetrievalResult.skippedQueries） */
  skippedQueries?: string[];
}

/** 0 召回修复：对源轨返回 0 条的查询补发一次它的译文 */
export interface RetrievalRepair {
  /** 源查询（那条 0 召回的查询） */
  query: string;
  /** 补发用的译文 */
  translatedQuery: string;
  /** 补发返回的条数（0 = 译文也没召回） */
  returned: number;
}

/** 翻译状态：失败或译文不可用时，修复不发生，原因必须留痕（不静默降级） */
export interface RetrievalTranslation {
  target: TranslationTarget;
  failed: boolean;
  /** 完整译文（与源查询逐位对应；失败时为空数组）——回放与在线召回率都读这一份 */
  queries: string[];
  /** 译文与原文相同、无法用来修复的条数（逐位回填原文时会发生） */
  untranslated: number;
  /** 人读原因：翻译失败 / 无可修复查询 / 译文与原文相同 */
  reason: string | null;
}

/**
 * 哪些源查询需要 0 召回补发（纯函数：在线检索与离线回放/评分卡共用同一判据）。
 *
 * @param answeredIndexes 源轨里至少返回 1 条的查询下标
 * @returns indexes = 要补发的源查询下标；unusable = 译文不可用（没翻出来）的下标
 */
export function planZeroRecallRepairs(input: {
  queries: string[];
  translatedQueries: string[];
  answeredIndexes: ReadonlySet<number>;
}): { indexes: number[]; unusable: number[] } {
  // 翻译整体失败（译文为空）：没得比，不把每条查询都记成"译文不可用"
  if (input.translatedQueries.length === 0) return { indexes: [], unusable: [] };
  const unusable: number[] = [];
  const repairIndexes: number[] = [];
  for (const [index, source] of input.queries.entries()) {
    const translated = input.translatedQueries[index];
    // 逐位回填原文 = 这个位置没翻出来：补发它等于把同一条查询再发一遍，白花钱
    if (translated === undefined || translated.trim() === '' || translated.trim() === source.trim()) {
      unusable.push(index);
      continue;
    }
    if (!input.answeredIndexes.has(index)) repairIndexes.push(index);
  }
  return { indexes: repairIndexes, unusable };
}

/** 检索执行结果 */
export interface RetrievalResult {
  /** 实际发出的查询（已剔除提供者做不到的；能力位跳过的不在这里，见 skippedQueries） */
  queries: string[];
  candidates: EvidenceCandidate[];
  /** 实际发出的搜索请求数（源查询条数 + 零召回修复条数；serper 一类提供者逐条请求） */
  searchCalls: number;
  /** 被过滤掉的候选与理由（进检索足迹） */
  rejected: Array<{ url: string; reason: string }>;
  /** 搜索提供者名（成本归因用） */
  provider: string;
  /** 因提供者能力不足而没发出去的查询（如不支持 site: 时的域定向查询；不降级成普通词） */
  skippedQueries: string[];
  /** 零召回修复记录（只对源查询返回 0 条的那些） */
  repairs: RetrievalRepair[];
  /** 翻译状态；查询集为空时为 null（没走到翻译） */
  translation: RetrievalTranslation | null;
}

/** 非 HTML 资源（图片 / 视频 / 文档）不抓——与宿主系统同判据，但理由不同：这里抓回来也没有正文可比对 */
const NON_HTML_PATTERN = /\.(jpg|jpeg|png|gif|webp|mp4|pdf|zip|docx?|xlsx?|pptx?)(\?|$)/i;

/** 域定向查询的形态：`site:` 开头（大小写不敏感） */
const SITE_QUERY_PATTERN = /^\s*site:/i;

/**
 * 按提供者能力拆分查询集：不支持 `site:` 的提供者（如 LLM 自带搜索）不发这类查询，
 * 记进 skipped 而不是降级成普通关键词——降级会悄悄改变查询语义，比少搜几条更危险。
 */
export function partitionQueriesByCapabilities(
  queries: string[],
  siteOperator: boolean,
): { executable: string[]; skipped: string[] } {
  if (siteOperator) return { executable: [...queries], skipped: [] };
  const executable: string[] = [];
  const skipped: string[] = [];
  for (const query of queries) (SITE_QUERY_PATTERN.test(query) ? skipped : executable).push(query);
  return { executable, skipped };
}

/**
 * 把各槽换成策略包给的"检索面写法"（首选形态），**只改查询串、不改断言内容**。
 *
 * 为什么要在这一层：实测过"中国嘉德（香港） 2024年4月"这种查询串召不回真页——
 * 拍行自己的页面连排写"中国嘉德香港"、按季写"2024春季拍卖会"。哪些写法等价是域知识，
 * 所以由包给（`querySurfaces`），引擎只是把首选形态填进模板；检索**次数一条不变**。
 * 包认不出来的字段返回空数组，这里就退回原值，绝不因为归一化失败而把槽填空。
 */
function surfacedValues(
  pack: DomainPack,
  fieldKey: string,
  values: Record<string, string | null>,
  selfValue: string,
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  const surfaceOf = (key: string, value: string | null): string | null => {
    if (value === null || value.trim() === '') return value;
    return pack.querySurfaces(key, value)[0] ?? value;
  };
  for (const [key, value] of Object.entries(values)) out[key] = surfaceOf(key, value);
  out.self = surfaceOf(fieldKey, selfValue);
  return out;
}

/**
 * 构造本条断言的查询清单（确定性顺序：策略包模板在前，按域定向在后）。
 *
 * @param maxQueries 检索调用上限（默认值 4）
 */
export function buildEvidenceQueries(input: {
  pack: DomainPack;
  claim: ClaimRecord;
  values: Record<string, string | null>;
  spec?: FieldSpec;
  /** 定向域名（策略包从宿主系统的来源白名单只读派生，已按权威档排序） */
  domains: string[];
  maxQueries: number;
}): string[] {
  const { claim, spec, domains, maxQueries } = input;
  const queries: string[] = [];
  const push = (value: string): void => {
    const cleaned = value.replace(/\s{2,}/g, ' ').trim();
    if (cleaned === '') return;
    if (!queries.includes(cleaned)) queries.push(cleaned);
  };

  const surfaceFieldKey = spec?.key ?? claim.fieldKey ?? '';
  const values = surfacedValues(input.pack, surfaceFieldKey, input.values, claim.object);
  /** 本条断言自己的取值也用检索面形态：{self} 与 keyTerms 都从这一份取 */
  const selfSurface = values.self ?? claim.object;

  if (spec) {
    for (const template of spec.queryTemplates) {
      push(fillTemplate(template, { ...values, self: selfSurface }, spec.key));
    }
  } else {
    push(`${claim.subject} ${selfSurface}`);
    push(`${claim.atomicText}`);
  }

  // 关键词只取主体与客体：年份与专场名是"唤起多源"的抓手，图录号这类实例限定词一律不进
  // 主语是从 spec.subjectKeys 那批字段里取的值，所以按它的来源字段选写法（时间字段的主语往往是机构名）
  const subjectKey = spec?.subjectKeys?.[0] ?? surfaceFieldKey;
  const subjectSurface = input.pack.querySurfaces(subjectKey, claim.subject)[0] ?? claim.subject;
  const keyTerms = [subjectSurface, selfSurface]
    .map((t) => (t ?? '').trim())
    .filter((t) => normalizeText(t) !== '')
    .join(' ')
    .slice(0, 60);
  for (const domain of domains) {
    if (queries.length >= maxQueries) break;
    push(`site:${domain} ${keyTerms}`);
  }

  return queries.slice(0, maxQueries);
}

/**
 * 记录级查询集：把同一记录里各字段的模板拼在一起，一次检索出**共用的候选池**。
 *
 * 为什么要按记录而不是按断言检索：实测里"写着机构＋时间＋专场名的那一页"只有用
 * 专场名才搜得到。按断言各自检索时，另外两个字段的候选池里根本没有这一页，
 * 于是记录级共现门禁永远凑不齐——不是世界没有这个页面，是我们的检索构造看不见它。
 * 逐源独立比对的纪律不变：候选共用，判定仍是一个字段 × 一个页面一次调用。
 */
export function buildRecordQueries(input: {
  pack: DomainPack;
  claims: Array<{ claim: ClaimRecord; spec?: FieldSpec }>;
  values: Record<string, string | null>;
  domains: string[];
  maxQueries: number;
}): string[] {
  /**
   * 按字段轮转取模板，而不是把一个字段的模板先取光。
   *
   * 实测后果：拍卖机构字段自带 3 条模板，顺序取满 `maxQueries=4` 后，日期与专场名
   * 一条查询都进不了共用池——而"写着这场全部关键字段的那一页"通常正是用专场名才搜得到。
   * 于是门禁永远凑不齐共现，问题被错记成"世界没有这个页面"。
   *
   * 轮转不改变每条查询的内容与总次数，只改变"名额先给谁"。
   */
  const perClaim = input.claims.map(({ claim, spec }) =>
    buildEvidenceQueries({
      pack: input.pack,
      claim,
      values: input.values,
      spec,
      domains: input.domains,
      maxQueries: input.maxQueries,
    }),
  );
  const queries: string[] = [];
  const seen = new Set<string>();
  const push = (query: string): boolean => {
    if (seen.has(query)) return false;
    seen.add(query);
    queries.push(query);
    return true;
  };
  for (let depth = 0; queries.length < input.maxQueries; depth++) {
    let tookAny = false;
    for (const list of perClaim) {
      const query = list[depth];
      if (query === undefined) continue;
      tookAny = true;
      push(query);
      if (queries.length >= input.maxQueries) return queries;
    }
    if (!tookAny) break;
  }
  return queries;
}

/** 候选过滤与排序：黑名单剔垃圾，权威档优先，同 URL 跨查询只留排序位最靠前的 */
export function filterAndRankCandidates(
  results: SearchResultItem[],
  pack: DomainPack,
): { candidates: EvidenceCandidate[]; rejected: Array<{ url: string; reason: string }> } {
  const candidates = new Map<string, EvidenceCandidate>();
  const rejected: Array<{ url: string; reason: string }> = [];

  for (const item of results) {
    if (!item.url.startsWith('http')) {
      rejected.push({ url: item.url, reason: '非 http/https 链接' });
      continue;
    }
    if (NON_HTML_PATTERN.test(item.url)) {
      rejected.push({ url: item.url, reason: '非 HTML 资源（图片/视频/文档）' });
      continue;
    }
    const blocked = pack.blockedReason?.(item.url) ?? null;
    if (blocked) {
      rejected.push({ url: item.url, reason: blocked });
      continue;
    }
    // 链接自相矛盾（标题点名机构 ≠ 域名所属机构）在进候选池前拦掉：
    // 编造来源最贵的害处是冒充"独立第三方"，把一条断言推成多源共现。
    const conflict = pack.institutionConflictOf?.({ url: item.url, title: item.title }) ?? null;
    if (conflict) {
      rejected.push({ url: item.url, reason: conflict });
      continue;
    }
    const domain = extractHostname(item.url) ?? '';
    if (domain === '') {
      rejected.push({ url: item.url, reason: '无法解析域名' });
      continue;
    }
    const existing = candidates.get(item.url);
    if (existing && existing.position <= item.position) continue;
    candidates.set(item.url, {
      url: item.url,
      domain,
      sourceFamily: pack.sourceFamilyOf(domain),
      tier: pack.tierOf(domain),
      title: item.title,
      position: item.position,
    });
  }

  const tierRank: Record<SourceTier, number> = { official: 0, primary: 1, aggregator: 2, unlisted: 3 };
  const byScore = [...candidates.values()].sort(
    (a, b) =>
      tierRank[a.tier] - tierRank[b.tier] ||
      a.sourceFamily.localeCompare(b.sourceFamily) ||
      a.position - b.position ||
      a.url.localeCompare(b.url),
  );
  // 按来源家族轮转发放抓取名额：纯按权威档排序会让抓取预算全花在一家官网的多个页面上，
  // 而同家族多页只算一个独立来源（"异域"判据：同家族多页只算一个独立来源）——那样"至少两个独立来源"
  // 在预算内永远凑不齐，not_found 会被误记成"查无实据"而不是"没查完"。
  const byFamily = new Map<string, EvidenceCandidate[]>();
  for (const candidate of byScore) {
    const family = candidate.sourceFamily === '' ? candidate.domain : candidate.sourceFamily;
    const queue = byFamily.get(family);
    if (queue) queue.push(candidate);
    else byFamily.set(family, [candidate]);
  }
  const ordered: EvidenceCandidate[] = [];
  const families = [...byFamily.entries()].sort((a, b) => {
    const rankOf = (list: EvidenceCandidate[]): number => tierRank[list[0]!.tier];
    return rankOf(a[1]) - rankOf(b[1]) || a[0].localeCompare(b[0]);
  });
  for (let depth = 0; ordered.length < byScore.length; depth++) {
    let tookAny = false;
    for (const [, queue] of families) {
      const next = queue[depth];
      if (next) {
        ordered.push(next);
        tookAny = true;
      }
    }
    if (!tookAny) break;
  }
  return { candidates: ordered, rejected };
}

/**
 * 执行一次证据检索。
 *
 * 搜索 API 异常向上抛（infra 失败与"查无实据"是两个世界，不能混为一谈）：
 * 上层把该断言记成 `failed`，不伪装成阴性结论。
 *
 * 能力位在这里生效：提供者声明 `siteOperator: false` 时，`site:` 定向查询**不发出**、
 * 记入 `skippedQueries`（足迹可审计），也不降级成普通关键词。
 */
export async function retrieveCandidates(input: {
  pack: DomainPack;
  claim: ClaimRecord;
  values: Record<string, string | null>;
  spec?: FieldSpec;
  maxQueries: number;
  numResultsPerQuery: number;
  logger?: ReturnType<typeof createLogger>;
  /** 记录级已拼好的查询集：给了就不再按本条断言重拼（同一记录共用候选池） */
  prebuiltQueries?: string[];
}): Promise<RetrievalResult> {
  const log = input.logger ?? createLogger({ prefix: '[Lodestar Retrieval] ' });
  const constructed = input.prebuiltQueries ?? buildEvidenceQueries({
    pack: input.pack,
    claim: input.claim,
    values: input.values,
    spec: input.spec,
    domains: input.pack.evidenceDomains(input.claim.object),
    maxQueries: input.maxQueries,
  });

  if (constructed.length === 0) {
    return {
      queries: [],
      candidates: [],
      searchCalls: 0,
      rejected: [],
      skippedQueries: [],
      provider: '',
      repairs: [],
      translation: null,
    };
  }

  const provider = createSearchProvider(getSearchProviderFromEnv());

  // 能力位不是装饰：提供者声明不支持 site: 时，域定向查询跳过并记账（不降级成普通词）
  const { executable: queries, skipped: skippedQueries } = partitionQueriesByCapabilities(
    constructed,
    provider.capabilities?.siteOperator === true,
  );
  if (skippedQueries.length > 0) {
    log.dev.debug(
      `[${input.claim.claimId}] 提供者 ${provider.name} 不支持 site:，跳过 ${skippedQueries.length} 条域定向查询`,
    );
  }
  if (queries.length === 0) {
    return {
      queries,
      candidates: [],
      searchCalls: 0,
      rejected: [],
      skippedQueries,
      provider: provider.name,
      repairs: [],
      translation: null,
    };
  }

  // 零召回修复（不是"双语双轨"）：源轨按自身语言类选搜索地区参数先发出去；
  // **只有返回 0 条的查询**才补发一次它的译文。为什么不再无条件发两条轨：
  // 语言探针（examples/replay-search/probe-language/result.json）显示中文查询不是
  // "永远 0"——同一条窄查询两次分别是 2 条与 0 条，而英文同宽也有 0 条的两条。
  // 0 是提供者的抖动，不是"这门语言查不到"。无条件双轨会让每条查询都付两次钱，
  // 却只买到一次额外的抽样；按 0 补发则把这份预算只花在真正空手的那几条上。
  //
  // 预算不变量：searchCalls = 源查询条数 + 补发条数（补发 ≤ 源查询条数，与旧双轨的
  // 最坏情况相同）；补发不递归，每条查询最多补一次。
  const sourceClass: LanguageClass | null = dominantLanguageClass(queries);
  const target: TranslationTarget = sourceClass === 'en' ? 'zh' : 'en';

  const [sourceResults, translation] = await Promise.all([
    provider.search(queries, { numResults: input.numResultsPerQuery, language: toSearchHl(sourceClass) }),
    // 翻译与源轨并行：不拖慢首屏；翻不出来只是没有修复可用，不是整次检索失败
    translateQueries(queries, target, { logger: log }),
  ]);

  const translatedQueries = translation.failed ? [] : translation.queries;
  const answered = new Set(sourceResults.results.map((item) => item.queryIndex));
  const zeroRecall = queries.map((_, index) => index).filter((index) => !answered.has(index));
  const plan = planZeroRecallRepairs({ queries, translatedQueries, answeredIndexes: answered });
  const unusable = new Set(plan.unusable);
  const repairIndexes = plan.indexes;

  const repairs: RetrievalRepair[] = [];
  let repairQueries: string[] = [];
  let repairResults: SearchResultItem[] = [];
  if (repairIndexes.length > 0) {
    repairQueries = repairIndexes.map((index) => translatedQueries[index]!);
    const response = await provider.search(repairQueries, {
      numResults: input.numResultsPerQuery,
      language: toSearchHl(target),
    });
    repairResults = response.results;
    for (const [slot, index] of repairIndexes.entries()) {
      repairs.push({
        query: queries[index]!,
        translatedQuery: translatedQueries[index]!,
        returned: response.results.filter((item) => item.queryIndex === slot).length,
      });
    }
  }

  const searchCalls = queries.length + repairQueries.length;

  const translationState: RetrievalTranslation = {
    target,
    failed: translation.failed,
    queries: translatedQueries,
    untranslated: unusable.size,
    reason: translation.failed
      ? zeroRecall.length === 0
        ? '翻译失败，但源轨每条查询都有召回，无需修复'
        : `翻译失败：${zeroRecall.length} 条 0 召回查询没有可用译文，未做修复（这不是"世界没有证据"）`
      : unusable.size > 0
        ? `${unusable.size} 条查询的译文与原文相同（没翻出来），对应查询未做修复`
        : null,
  };

  // 合流在 filterAndRankCandidates 之前完成：跨轨按归一化 URL 去重（同一页在两轨里
  // 可能带不同 fragment / 追踪参数），并按轨轮转排列。下游的黑名单剔除、权威档排序
  // 与来源家族轮转一律不动。
  const mergedResults = interleaveTracks(
    [sourceResults.results, repairResults],
    (item) => normalizedUrlKey(item.url),
  );

  const { candidates, rejected } = filterAndRankCandidates(mergedResults, input.pack);

  log.dev.debug(
    `[${input.claim.claimId}] 源查询 ${queries.length} 条${repairs.length > 0 ? ` + 0 召回补发 ${repairs.length} 条` : ''}` +
      `（共 ${searchCalls} 次检索）→ 结果 ${mergedResults.length} 条 → 候选 ${candidates.length} 条（剔除 ${rejected.length} 条）` +
      (translationState.reason === null ? '' : `；${translationState.reason}`),
  );

  return {
    queries,
    candidates,
    searchCalls,
    rejected,
    provider: provider.name,
    skippedQueries,
    repairs,
    translation: translationState,
  };
}
