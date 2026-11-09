// src/lodestar/page-verification.ts
/**
 * 抓页可核率（离线重算，零外部调用）
 *
 * 回答的问题：**召回到的候选页里，有几条是真抓到、并且在正文里逐字写出了本场的关键字段。**
 *
 * 为什么要有这一层：召回率（`live-recall.ts`）只看到搜索结果的标题与摘要，判据是
 * 「摘要里出现了本场关键词」——那是**静态自洽**（搜索结果自己看着像），不是「页面里真有这条事实」。
 * 本模块把同一批冻结查询的候选页真抓一遍，用引擎同一条逐字判据（`quoteMatches`：
 * 字与标点必须一致，空白与不可见格式字符不计）在正文里核对机构、专场名、日期。
 *
 * 三个读数**分开报，不合成一个**：
 * 1. 静态自洽率：召回层的老读数（不要和下面两个混着看）；
 * 2. 抓页成功率：抓到的页 / 尝试抓的页——抓不到是「缺一类材料」，既不算召回成功也不算失败；
 * 3. 逐字核验通过率：关键字段全部逐字命中的页 / 抓到的页。
 * 另有查询级的「可核率」：至少有一条候选页**抓到且核上**的源查询条数 / 源查询条数。
 *
 * 抓不到页按原因分档（对应完全不同的处理方式）：超时 / 被拦 / 页面结构不符 / 跳转死链 /
 * 不安全地址（最后一种本不该出现，出现说明搜索结果里混进了不可抓的 URL）。
 *
 * 输入是冻结的抓页样本（`examples/replay-search/<slug>/page-checks.json`）：
 * 存的是每页抓取结果与逐字段判定的**读数**，不是页面正文——重跑不需要联网，
 * 也不把第三方正文搬进仓库。代价是：改了逐字判据必须重新抓页，锁会变。
 */

import { quoteMatches } from './adjudicate/compare';
import type { LiveRecallResult } from './live-recall';

/** 抓不到页的原因分档（每一档对应不同的处理方式，不合并） */
export type FetchFailureKind =
  /** 超时：网络慢或站点拖字——换更长的超时／换时段重试 */
  | 'timeout'
  /** 被拦：401/403/429/451——需要浏览器渲染或换通路，不是"没有这页" */
  | 'blocked'
  /** 页面结构不符：抓回来但正文抽不出来（JS 渲染、PDF、空壳页）——需要渲染或换判据 */
  | 'non-html'
  /** 跳转死链：404/410、DNS 失败、连接拒绝、5xx——这页确实拿不到了 */
  | 'dead-link'
  /** 不安全地址：私网/协议/凭据——不该出现在搜索结果里，属数据质量问题 */
  | 'unsafe-url';

export const FETCH_FAILURE_KINDS: FetchFailureKind[] = ['timeout', 'blocked', 'non-html', 'dead-link', 'unsafe-url'];

export const FETCH_FAILURE_LABELS: Record<FetchFailureKind, string> = {
  timeout: '超时',
  blocked: '被拦',
  'non-html': '页面结构不符',
  'dead-link': '跳转死链',
  'unsafe-url': '不安全地址',
};

/** 抓页判"正文抽不出来"的下限（字符数）：低于它按「页面结构不符」记，不按"没核上"记 */
export const MIN_USABLE_TEXT_CHARS = 200;

/** 一页里一个关键字段的逐字判定 */
export interface PageCheckField {
  key: string;
  value: string;
  /** 该值是否逐字出现在这一页的正文里（引擎同一条 `quoteMatches` 判据） */
  verbatim: boolean;
}

/** 抓到了的一页 */
export interface PageCheckFetched {
  url: string;
  domain: string;
  status: 'fetched';
  /** 清洗后的正文字符数 */
  chars: number;
  /** 正文 SHA-256（前 16 位）：换了一版页面能看出来 */
  textHash: string;
  fields: PageCheckField[];
  /** 关键字段是否全部逐字命中 */
  verified: boolean;
}

/** 没抓到的一页（单独一类：不算召回成功，也不算失败） */
export interface PageCheckFailed {
  url: string;
  domain: string;
  status: 'failed';
  failure: FetchFailureKind;
  message: string;
}

export type PageCheck = PageCheckFetched | PageCheckFailed;

/** 采集策略（写进样本，重跑时照此判断读数能不能比） */
export interface PageCheckPolicy {
  /** 单样本最多抓几页 */
  maxPages: number;
  /** 同一域名两次抓取的最小间隔（毫秒），避免把站打到限流 */
  perDomainGapMs: number;
  /** 单页超时 */
  timeoutMs: number;
  /** 是否允许浏览器渲染降级（本样本固定 false：裸抓，失败按原因分档） */
  allowBrowser: boolean;
}

/** 冻结的抓页样本 */
export interface PageCheckFixture {
  version: 1;
  kind: 'page-check-replay';
  slug: string;
  capturedAt: string;
  policy: PageCheckPolicy;
  /** 参与逐字核对的关键字段（机构、专场名、日期） */
  fields: Array<{ key: string; value: string }>;
  checks: PageCheck[];
}

/** 源查询级的一行 */
export interface PageVerificationRow {
  query: string;
  /** 这条查询当前召回到的候选页数（与实时召回口径一致） */
  candidateUrls: number;
  /** 其中抓到且关键字段全部逐字命中的页数 */
  verifiedUrls: number;
  /** 是否至少有一条可核页 */
  hit: boolean;
}

export interface PageVerificationResult {
  slug: string;
  /** 分母：尝试抓的页（只含当前候选集里的 URL） */
  attempted: number;
  /** 分子：抓到的页 */
  fetched: number;
  /** 抓到的页里，关键字段全部逐字命中的页数 */
  verifiedPages: number;
  /** 分母：源查询条数（与召回率同一口径） */
  issued: number;
  /** 分子：至少有一条"抓到且核上"候选页的源查询条数 */
  queryHits: number;
  /** 抓页成功率（%）；没有尝试抓页时为 null（未测，不是 0） */
  fetchSuccessRate: number | null;
  /** 逐字核验通过率（%）；没抓到任何页时为 null */
  verbatimPassRate: number | null;
  /** 可核率（%）：queryHits / issued；没有抓页样本时为 null */
  verifiableRate: number | null;
  /** 抓不到页的原因分档 */
  failures: Record<FetchFailureKind, number>;
  /** 每个关键字段的逐字命中情况（定位是哪一维核不上） */
  fieldStats: Array<{ key: string; value: string; pages: number; verbatim: number }>;
  rows: PageVerificationRow[];
  /** 抓过但已不在当前候选集里的 URL 数（代码改动后会出现；不计入三个读数） */
  orphaned: number;
  basis: 'fetch-verbatim-key-fields';
}

function rate(hit: number, total: number): number | null {
  if (total === 0) return null;
  return Math.round((hit / total) * 1000) / 10;
}

function emptyFailures(): Record<FetchFailureKind, number> {
  return { timeout: 0, blocked: 0, 'non-html': 0, 'dead-link': 0, 'unsafe-url': 0 };
}

/**
 * 把抓取异常归到某一档。
 *
 * 判据只看异常消息：`safeFetchText` 对非 2xx 抛 `HTTP <code>: <text>`，对超时抛「抓取超时」，
 * 对 DNS/连接失败抛底层消息。归不出来的一律进「跳转死链」——那是"这页拿不到"的兜底，
 * 不塞进「被拦」（被拦要有 401/403/429/451 这类证据）。
 */
export function classifyFetchFailure(error: unknown): { kind: FetchFailureKind; message: string } {
  const message = error instanceof Error ? error.message : String(error);
  if (/不安全|拒绝抓取|不是合法的 URL|只允许抓取/.test(message)) {
    return { kind: 'unsafe-url', message };
  }
  if (/超时|timeout/i.test(message)) return { kind: 'timeout', message };
  const status = /^HTTP (\d{3})\b/.exec(message);
  if (status !== null) {
    const code = Number(status[1]);
    if (code === 401 || code === 403 || code === 429 || code === 451) {
      return { kind: 'blocked', message };
    }
    return { kind: 'dead-link', message };
  }
  if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH|getaddrinfo|无法解析/i.test(message)) {
    return { kind: 'dead-link', message };
  }
  return { kind: 'dead-link', message };
}

/**
 * 从冻结抓页样本 + 当前召回读数算出四项读数。
 *
 * 分母纪律：抓页样本里的 URL 必须**仍然在当前候选集里**才算一条尝试——
 * 代码改动后候选集缩小/扩张，旧抓页结果不能冒充新候选的读数；落在外面的记进 `orphaned`。
 */
export function measurePageVerification(input: {
  fixture: PageCheckFixture;
  recall: LiveRecallResult;
}): PageVerificationResult {
  const { fixture, recall } = input;
  const candidateUrls = new Set(recall.rows.flatMap((row) => row.candidateUrls));
  const checks = fixture.checks.filter((check) => candidateUrls.has(check.url));
  const orphaned = fixture.checks.length - checks.length;

  const fetched = checks.filter((check): check is PageCheckFetched => check.status === 'fetched');
  const verifiedUrls = new Set(fetched.filter((check) => check.verified).map((check) => check.url));

  const failures = emptyFailures();
  for (const check of checks) {
    if (check.status === 'failed') failures[check.failure] += 1;
  }

  const fieldStats = fixture.fields.map((field) => {
    const judging = fetched.filter((check) => check.fields.some((row) => row.key === field.key));
    const verbatim = judging.filter((check) =>
      check.fields.some((row) => row.key === field.key && row.verbatim),
    );
    return { key: field.key, value: field.value, pages: judging.length, verbatim: verbatim.length };
  });

  const rows: PageVerificationRow[] = recall.rows.map((row) => {
    const hitUrls = row.candidateUrls.filter((url) => verifiedUrls.has(url));
    return {
      query: row.query,
      candidateUrls: row.candidateUrls.length,
      verifiedUrls: hitUrls.length,
      hit: hitUrls.length > 0,
    };
  });

  const queryHits = rows.filter((row) => row.hit).length;
  return {
    slug: fixture.slug,
    attempted: checks.length,
    fetched: fetched.length,
    verifiedPages: verifiedUrls.size,
    issued: recall.issued,
    queryHits,
    fetchSuccessRate: rate(fetched.length, checks.length),
    verbatimPassRate: rate(verifiedUrls.size, fetched.length),
    verifiableRate: rate(queryHits, recall.issued),
    failures,
    fieldStats,
    rows,
    orphaned,
    basis: 'fetch-verbatim-key-fields',
  };
}

/** 一页正文 → 每个关键字段的逐字判定（采集脚本用；纯函数，便于单测） */
export function judgePageFields(
  text: string,
  fields: Array<{ key: string; value: string }>,
): PageCheckField[] {
  return fields.map((field) => ({
    key: field.key,
    value: field.value,
    verbatim: quoteMatches(field.value, text),
  }));
}
