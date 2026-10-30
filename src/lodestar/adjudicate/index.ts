// src/lodestar/adjudicate/index.ts
/**
 * 逐字段裁决：路由 → 检索编排 → 抓取 → 逐源比对 → 计票 → 四分类 + 证据等级
 *
 * 预算与停止条件在这里落地（默认值：每条断言检索 4 次 / 抓取 6 页，
 * 可用 `LODESTAR_MAX_SEARCH_CALLS` / `LODESTAR_MAX_PAGES` 覆盖）：
 * 前三种裁决"够证据就停"，`not_found` 必须跑满预算或覆盖完候选才许下判，
 * 并把成因写成 预算耗尽 / 覆盖缺口 / 确证无记录 三选一——
 * "检索不到"只能导向 not_found，不能导向 refuted。
 *
 * 本模块只写 Lodestar 自己的底稿，不 import 宿主系统的任何写库函数。
 */

import { createLogger } from '@src/utils/logger';
import type { AblationState } from '@src/ablation';
import { newId } from '../ids';
import type { DomainPack, FieldSpec } from '../packs/pack';
import type { LodestarStore } from '../storage/adapter';
import type {
  ClaimRecord,
  EvidenceRecord,
  SearchFootprint,
  VerdictRecord,
} from '../types';
import { createHash } from 'node:crypto';
import { getRoleModelName } from '@src/llm';
import { routeClaim } from './routing';
import { retrieveCandidates, type EvidenceCandidate } from './retrieval';
import { captureEvidencePage, PageFetchFailedError, PageNeedsBrowserError, type CapturedPage } from './page-fetch';
import { compareClaimToPage } from './compare';
import { isDecisive, tally } from './voting';
import { recordLodestarTrace } from '../trace-log';

/** 每条断言的检索与抓取上限 */
export interface AdjudicationCaps {
  maxSearchCalls: number;
  maxPages: number;
  numResultsPerQuery: number;
}

/**
 * 每条查询取回的结果数：与宿主系统的文本检索臂同一个 env（`SEARCH_RESULT_COUNT`，缺省 10）。
 * 证据检索要的是"至少两个互相独立的来源"，前几条命中即够，取回更多只多花搜索额度。
 */
export function defaultNumResultsPerQuery(): number {
  const parsed = Number(process.env.SEARCH_RESULT_COUNT);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 10;
}

/** 每条断言的检索次数上限（`LODESTAR_MAX_SEARCH_CALLS`，缺省 4；调大只多花搜索额度） */
export function defaultMaxSearchCalls(): number {
  const parsed = Number(process.env.LODESTAR_MAX_SEARCH_CALLS);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 4;
}

/** 每条断言的抓取页数上限（`LODESTAR_MAX_PAGES`，缺省 6；调大同时放大抓取与比对两层花费） */
export function defaultMaxPages(): number {
  const parsed = Number(process.env.LODESTAR_MAX_PAGES);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 6;
}

export const DEFAULT_CAPS: AdjudicationCaps = {
  maxSearchCalls: defaultMaxSearchCalls(),
  maxPages: defaultMaxPages(),
  numResultsPerQuery: defaultNumResultsPerQuery(),
};

export interface AdjudicateClaimInput {
  store: LodestarStore;
  pack: DomainPack;
  claim: ClaimRecord;
  /** 该断言所属记录的字段快照（查询模板与主语上下文都要用它） */
  values: Record<string, string | null>;
  spec?: FieldSpec;
  caps?: Partial<AdjudicationCaps>;
  ablations: AblationState;
  /** 本次查询的 trace run id */
  runId: string;
  /** 本条断言的底稿 id（verdicts.traceId 必填，没有底稿的结论不落库） */
  traceId: string;
  /**
   * 记录级共用的检索结果（由上层一次检索好再发下来）。
   * 给了就不再为本条断言单独发查询——写着全部关键字段的那一页往往只有某个字段搜得到，
   * 各自检索会让共现门禁永远凑不齐。比对仍逐字段独立。
   */
  sharedRetrieval?: {
    queries: string[];
    candidates: EvidenceCandidate[];
    searchCalls: number;
    provider: string;
    /** 因提供者能力不足没发出去的查询（进足迹；旧调用方可以不传） */
    skippedQueries?: string[];
  };
  /**
   * 记录级共用的页面缓存（A3）：同一场的前一条断言刚抓过的页面直接复用，
   * 不重抓、也不占本条的 pageCap——抓取成本只在首个遇到它的断言付一次。
   * 缓存由上层（engine 的记录组循环）创建并在组内传递，跨记录不共享。
   */
  sharedPageCache?: Map<string, CapturedPage>;
}

export interface AdjudicateClaimResult {
  /** 状态已推进的断言 */
  claim: ClaimRecord;
  evidence: EvidenceRecord[];
  verdict?: VerdictRecord;
  /** 路由判为 decompose 时给出：由上层拆分后重入 */
  needsDecompose?: { reason: string };
  /** 需要浏览器而当前不可用：断言停在 paused，不消耗重试预算 */
  paused?: { url: string; reason: string };
  /** infra 失败（搜索 API 异常等）：记 failed，不伪装成阴性结论 */
  failed?: string;
  footprint?: SearchFootprint;
}

/**
 * 跑完整条断言的裁决链，并把证据行、裁决行、状态推进写进底稿。
 */
export async function adjudicateClaim(input: AdjudicateClaimInput): Promise<AdjudicateClaimResult> {
  const log = createLogger({ prefix: '[Lodestar Adjudicate] ' });
  const caps: AdjudicationCaps = { ...DEFAULT_CAPS, ...(input.caps ?? {}) };
  const { store, pack, claim } = input;
  const startedAt = new Date();
  const events: Array<{ name: string; attributes?: Record<string, unknown> }> = [];

  // ---- 路由 ----
  await store.patch('claims', claim.claimId, { state: 'routing' });
  claim.state = 'routing';
  const routing = routeClaim(claim, pack);
  await store.patch('claims', claim.claimId, { routing, state: routing.route === 'reject' ? 'rejected' : 'verifying' });
  claim.routing = routing;
  claim.state = routing.route === 'reject' ? 'rejected' : 'verifying';
  events.push({ name: 'routing', attributes: { route: routing.route, mode: routing.mode, reason: routing.reason } });

  if (routing.route === 'reject') {
    await saveTrace({ input, startedAt, events, payload: { routing, evidence: [], verdict: null }, status: 'success' });
    return { claim, evidence: [] };
  }
  if (routing.route === 'decompose') {
    await saveTrace({ input, startedAt, events, payload: { routing }, status: 'success' });
    return { claim, evidence: [], needsDecompose: { reason: routing.reason } };
  }

  // ---- 检索编排（有共用结果时直接复用，不再为本条断言发查询） ----
  let candidates: EvidenceCandidate[] = [];
  let queries: string[] = [];
  let skippedQueries: string[] = [];
  let searchCalls = 0;
  let sharedSearchCalls: number | undefined;
  let retrievalFailed: string | null = null;
  if (input.sharedRetrieval) {
    candidates = input.sharedRetrieval.candidates;
    queries = input.sharedRetrieval.queries;
    skippedQueries = input.sharedRetrieval.skippedQueries ?? [];
    /**
     * A1：共用检索的成本记在组级账本（engine 的 bundle.searchCalls 只加一次），
     * 断言级预算从 0 起算——否则同一场的每个字段都背一次全组检索量，
     * 开局就"检索触顶"，not_found 的三因归因全被污染成 budget。
     */
    searchCalls = 0;
    sharedSearchCalls = input.sharedRetrieval.searchCalls;
    events.push({
      name: 'retrieval',
      attributes: {
        shared: true,
        queries,
        candidateCount: candidates.length,
        searchCalls: input.sharedRetrieval.searchCalls,
        provider: input.sharedRetrieval.provider,
        ...(skippedQueries.length > 0 ? { skippedQueries } : {}),
      },
    });
  } else
  try {
    const retrieval = await retrieveCandidates({
      pack,
      claim,
      values: input.values,
      spec: input.spec,
      maxQueries: caps.maxSearchCalls,
      numResultsPerQuery: caps.numResultsPerQuery,
      ablations: input.ablations,
      logger: log,
    });
    candidates = retrieval.candidates;
    queries = retrieval.queries;
    skippedQueries = retrieval.skippedQueries ?? [];
    searchCalls = retrieval.searchCalls;
    events.push({
      name: 'retrieval',
      attributes: {
        queries,
        candidateCount: candidates.length,
        provider: retrieval.provider,
        ...(skippedQueries.length > 0 ? { skippedQueries } : {}),
      },
    });
  } catch (error) {
    retrievalFailed = error instanceof Error ? error.message : String(error);
    log.dev.warn(`[${claim.claimId}] 检索失败（infra）：${retrievalFailed}`);
  }
  if (retrievalFailed) {
    await store.patch('claims', claim.claimId, { state: 'failed' });
    claim.state = 'failed';
    return { claim, evidence: [], failed: retrievalFailed };
  }

  // ---- 逐源抓取与独立比对（够证据就停） ----
  const evidence: EvidenceRecord[] = [];
  const failed: Array<{ url: string; reason: string }> = [];
  const rejected: Array<{ url: string; reason: string }> = [];
  const fetched: SearchFootprint['fetched'] = [];
  const visited = new Set<string>();
  /** 已比对过的正文指纹：同一家站的多个 URL 常返回同一份内容，比对第二次就是白花钱 */
  const seenContent = new Set<string>();
  let pagesFetched = 0;
  let paused: { url: string; reason: string } | null = null;

  for (const candidate of candidates) {
    if (pagesFetched >= caps.maxPages) break;
    if (visited.has(candidate.url)) continue;
    visited.add(candidate.url);

    const evidenceId = newId('evidence');
    let page: CapturedPage;
    const cached = input.sharedPageCache?.get(candidate.url);
    if (cached) {
      // A3：同记录前一条断言刚抓过的页面直接复用——快照还是那一份字节，
      // 引文逐字校验不受影响；抓取成本已在首条断言付过，这里不再占本条的 pageCap
      page = cached;
    } else {
      try {
        // 声明浏览器必备的包：证据页直接渲染。这类站点常用 200 返回一个只有导航的
        // JS 空壳，裸 fetch 不报错也拿不到正文，先试裸抓根本等不到降级。
        page = await captureEvidencePage(store, evidenceId, candidate.url, {
          forceBrowser: pack.requirements?.browser === 'required',
        });
        // 失败/被拦的页不计入 pagesFetched（A2）：pageCap 管的是"我们真读了多少页"，
        // 抓回空的、被反爬挡下的页既没花比对钱也没产出证据，不该消耗抓取名额
        pagesFetched += 1;
        input.sharedPageCache?.set(candidate.url, page);
      } catch (error) {
        if (error instanceof PageNeedsBrowserError) {
          paused = { url: candidate.url, reason: error.message };
          break;
        }
        if (error instanceof PageFetchFailedError) {
          failed.push({ url: candidate.url, reason: error.message });
          continue;
        }
        failed.push({ url: candidate.url, reason: error instanceof Error ? error.message : String(error) });
        continue;
      }
    }

    const fingerprint = pageFingerprint(page.text);
    if (seenContent.has(fingerprint)) {
      rejected.push({ url: candidate.url, reason: '正文与已比对过的页面同指纹（同站多 URL 返回同一页），不重复花比对预算' });
      continue;
    }
    seenContent.add(fingerprint);

    /**
     * 页面预筛（策略包规则，不调模型）：正文里连这个字段值的**任何一种写法**都找不到，
     * 就不为这页花那次比对调用。判不了（`unknown`）一律照常比对——预筛错杀等于无声丢证据。
     * 只能省模型调用、省不了抓取：抓取前只有搜索标题可用，误杀率太高，不在这里做。
     */
    const mention = pack.pageMentions(claim.fieldKey ?? '', claim.object, page.text);
    if (mention === 'no') {
      rejected.push({ url: candidate.url, reason: '页面预筛：正文里没有该字段值的任何一种等价写法（策略包规则），省掉这次比对调用' });
      continue;
    }

    const outcome = await compareClaimToPage({ claim, page, pack, logger: log });
    if ('rejected' in outcome) {
      rejected.push({ url: candidate.url, reason: outcome.reason });
      continue;
    }

    const row: EvidenceRecord = {
      evidenceId,
      claimId: claim.claimId,
      url: candidate.url,
      domain: candidate.domain,
      sourceFamily: candidate.sourceFamily,
      tier: candidate.tier,
      quote: outcome.quote,
      relation: outcome.relation,
      contentWeight: outcome.contentWeight,
      fetchedBy: 'lodestar',
      fetchedAt: page.fetchedAt,
      snapshotRef: page.snapshotRef,
      traceId: input.traceId,
      fieldKey: claim.fieldKey,
      recordId: claim.recordId,
      ...(outcome.pageTopic ? { note: `页面主题：${outcome.pageTopic}` } : {}),
    };
    await store.append('evidence', row);
    evidence.push(row);
    fetched.push({ url: candidate.url, relation: outcome.relation, pageTopic: outcome.pageTopic });
    events.push({
      name: 'source-comparison',
      attributes: { url: candidate.url, tier: candidate.tier, relation: outcome.relation },
    });

    if (
      isDecisive(
        evidence,
        claim.provenance.promptedDetail,
        { searchCalls, pagesFetched, searchCap: caps.maxSearchCalls, pageCap: caps.maxPages },
        { candidateCount: candidates.length, examinedCount: visited.size },
      )
    ) {
      break;
    }
  }

  // ---- 计票与四分类 ----
  const footprint: SearchFootprint = {
    queries,
    candidates: candidates.map((c) => ({ url: c.url, domain: c.domain, tier: c.tier })),
    fetched,
    failed,
    rejected,
    budget: {
      searchCalls,
      pagesFetched,
      searchCap: caps.maxSearchCalls,
      pageCap: caps.maxPages,
      ...(sharedSearchCalls !== undefined ? { sharedSearchCalls } : {}),
    },
    candidatesCovered: visited.size >= candidates.length,
    ...(skippedQueries.length > 0 ? { skippedQueries } : {}),
  };

  if (paused) {
    await store.patch('claims', claim.claimId, { state: 'paused' });
    claim.state = 'paused';
    await saveTrace({
      input,
      startedAt,
      events,
      payload: { evidence, footprint, paused },
      status: 'success',
    });
    return { claim, evidence, paused, footprint };
  }

  // 计票读该断言在底稿里的**全部**证据行：只看本轮会把上一轮已拿到的独立来源丢掉
  const ledgerEvidence = await store.query<EvidenceRecord>('evidence', (e) => e.claimId === claim.claimId);
  const cumulative = mergeEvidenceById([...ledgerEvidence, ...evidence]);
  const result = tally({
    evidence: cumulative,
    promptedDetail: claim.provenance.promptedDetail,
    budget: footprint.budget,
    coverage: { candidateCount: candidates.length, examinedCount: visited.size },
  });

  const verdict: VerdictRecord = {
    claimId: claim.claimId,
    verdict: result.verdict,
    evidenceGrade: result.evidenceGrade,
    supportCount: result.supportCount,
    refuteCount: result.refuteCount,
    ...(result.notFoundCause ? { notFoundCause: result.notFoundCause } : {}),
    footprint,
    traceId: input.traceId,
    adjudicatedAt: new Date().toISOString(),
  };
  await store.append('verdicts', verdict);
  await store.patch('claims', claim.claimId, { state: 'adjudicated' });
  claim.state = 'adjudicated';
  events.push({
    name: 'adjudication',
    attributes: {
      verdict: verdict.verdict,
      grade: verdict.evidenceGrade,
      supportCount: verdict.supportCount,
      refuteCount: verdict.refuteCount,
      reason: result.reason,
    },
  });
  await saveTrace({
    input,
    startedAt,
    events,
    payload: { evidence, verdict, footprint, countedEvidenceIds: result.countedEvidenceIds, corroboratingEvidenceIds: result.corroboratingEvidenceIds },
    status: 'success',
  });
  log.dev.debug(
    `[${claim.claimId}] ${verdict.verdict}/${verdict.evidenceGrade}（支持 ${verdict.supportCount} 源，反对 ${verdict.refuteCount} 源，抓 ${pagesFetched} 页）`,
  );

  return { claim, evidence, verdict, footprint };
}

/** 落本条断言的底稿（快照引用与页面正文都已进 trace 目录之外的底稿目录，这里只存结论链） */
async function saveTrace(input: {
  input: AdjudicateClaimInput;
  startedAt: Date;
  events: Array<{ name: string; attributes?: Record<string, unknown> }>;
  payload: Record<string, unknown>;
  status: 'success' | 'failure';
}): Promise<void> {
  await recordLodestarTrace({
    runId: input.input.runId,
    node: 'LodestarClaim',
    testName: 'lodestar-claim',
    traceId: input.input.traceId,
    payload: {
      claimId: input.input.claim.claimId,
      atomicText: input.input.claim.atomicText,
      packId: input.input.pack.id,
      ...input.payload,
    },
    events: input.events,
    startedAt: input.startedAt,
    status: input.status,
    // 比对调用走 text 角色——模型名随底稿落盘，复盘时才知道这条裁决是谁给的
    metadata: { config: { model: getRoleModelName('text') } },
  });
}

/** 同一条证据行在同一次计票里只能出现一次（跨轮重跑时底稿里会有重复主键的行） */
function mergeEvidenceById(rows: EvidenceRecord[]): EvidenceRecord[] {
  const byId = new Map<string, EvidenceRecord>();
  for (const row of rows) byId.set(row.evidenceId, row);
  return [...byId.values()];
}

export { routeClaim } from './routing';
export {
  buildEvidenceQueries,
  buildRecordQueries,
  filterAndRankCandidates,
  retrieveCandidates,
  type EvidenceCandidate,
  type RetrievalResult,
  type SharedRetrieval,
} from './retrieval';
export { compareClaimToPage, parseComparison, quoteMatches } from './compare';
export {
  independentSources,
  isDecisive,
  tally,
  TIER_WEIGHT,
  SUPPORT_SCORE_THRESHOLD,
  PROMPTED_DETAIL_DISCOUNT,
  type TallyInput,
  type TallyResult,
} from './voting';
export { captureEvidencePage, PageFetchFailedError, PageNeedsBrowserError, PAGE_TEXT_CHAR_BUDGET } from './page-fetch';

/** 正文指纹：折叠空白后取哈希——同一份内容换了 URL 或缩进都算一次，比对第二遍只是白花钱 */
function pageFingerprint(text: string): string {
  return createHash('md5').update(text.replace(/\s+/g, ' ').trim()).digest('hex');
}
