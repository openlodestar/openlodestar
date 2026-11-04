// src/live.ts
/**
 * 在线实验入口（`live` 命令）
 *
 * 与 `demo` 的分界只有一条：**证据是不是这次自己查的**。
 * - `demo` 读冻结底稿，零模型、零网络；
 * - `live` 真检索、真抓取、真比对，把结果写进被忽略的运行目录，绝不覆盖 `examples/`。
 *
 * 三种实验形态：
 * 1. `pages`：只重抓冻结示例里的来源页，核对"页面还在不在、当时引的那句还在不在"；
 * 2. `replay`：把冻结示例的断言原样提交给引擎（跳过提问环），检验"同一批说法换个时间还站不站得住"；
 * 3. `full`：从提问原文重新跑提问环，检验"整条链路能不能自己产出一批可核对的记录"。
 *
 * 为什么 replay 和 full 要分开：两者失败的含义不同。replay 变了 = 证据面或规则变了；
 * full 变了 = 模型这次列出的场次或字段就不同。混在一起跑，出了差异也归不了因。
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRoleModelName } from './llm';
import { LIVE_RUNS_DIR_NAME } from './demo-workdir';
import { createSearchProvider } from './integrations/search-providers';
import {
  DEFAULT_CAPS,
  resolveRunTimeGuards,
  type AdjudicationCaps,
  type PageFetchLog,
  type RunTimeGuards,
} from './lodestar/adjudicate';
import { captureEvidencePage } from './lodestar/adjudicate/page-fetch';
import { quoteMatches } from './lodestar/adjudicate/compare';
import { isReadableAnchor } from './lodestar/anchor-source';
import { runQuery, type RunQueryResult } from './lodestar/engine';
import { inspectEvidence, printEvidenceCheck, type EvidenceCheck } from './lodestar/evidence-check';
import { assertPackRequirements } from './lodestar/packs/requirements';
import porcelainPack from './lodestar/packs/porcelain';
import { createStore, readSnapshot } from './lodestar/storage/adapter';
import { resetTraceStoreForRun } from './trace-config';
import {
  parseDemoCase,
  renderDemoReport,
  type DemoCase,
  type DemoCaseExpectation,
  type DemoLiveExpectationCheck,
  type DemoLiveMeta,
  type DemoLivePageTiming,
  type DemoLivePageTimingRow,
} from './demo-report';
import type {
  AnchorRecord,
  ClaimRecord,
  EvidenceRecord,
  RecordGate,
  RecordSummary,
  VerdictRecord,
} from './lodestar/types';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(MODULE_DIR, '..');

/** 一次在线实验的形态 */
export type LiveMode = 'replay' | 'full' | 'both' | 'pages';
/** 会调用模型的两种形态 */
export type LiveRunMode = 'replay' | 'full';

export interface LiveCaps extends AdjudicationCaps {
  maxRecords: number;
}

export interface LiveEstimate {
  mode: LiveRunMode;
  /** 参与裁决的断言数（replay 是冻结断言数；full 是按记录上限推的字段数） */
  claims: number;
  records: number;
  /** 提问环调用上限（replay 为 0） */
  intakeCalls: number;
  /** 检索调用上限（查询条数 × 语言轨数 + 查询翻译调用） */
  searchCalls: number;
  /** 抓取页数上限 */
  pages: number;
  /** 比对调用上限（每抓一页最多一次） */
  compares: number;
}

/** 纯规划：不发网络、不读密钥，供 `--dry-run` 与单测使用 */
export function planLiveRun(input: {
  mode: LiveMode;
  claimCount: number;
  recordCount: number;
  caps: LiveCaps;
}): {
  modes: LiveRunMode[];
  pagesOnly: boolean;
  estimates: LiveEstimate[];
  notes: string[];
} {
  const modes: LiveRunMode[] =
    input.mode === 'both' ? ['replay', 'full'] : input.mode === 'pages' ? [] : [input.mode];
  const estimates = modes.map((mode) => estimateLiveRun({
    mode,
    claimCount: mode === 'replay' ? input.claimCount : input.caps.maxRecords * 3,
    recordCount: mode === 'replay' ? input.recordCount : input.caps.maxRecords,
    caps: input.caps,
  }));
  const notes = [
    '以上都是上限：裁决在够证据时会提前停；llm-web 不支持 site:，域定向查询会被跳过，不降级成普通词。',
    '检索调用按"查询条数 × 2 条语言轨（源语言 + 翻译轨）"估算；翻译失败会退回单轨。',
    '比对与抓取不是一一对应：抓回空页、被反爬挡下或页面预筛不通过，都不会花比对调用。',
  ];
  return { modes, pagesOnly: input.mode === 'pages', estimates, notes };
}

export function estimateLiveRun(input: {
  mode: LiveRunMode;
  claimCount: number;
  recordCount: number;
  caps: LiveCaps;
}): LiveEstimate {
  const { caps } = input;
  const records = Math.max(1, input.recordCount);
  const claims = Math.max(1, input.claimCount);
  // 每条记录一次共用检索：查询数 × 2 轨；再加一次整组查询的翻译调用
  const searchCalls = records * caps.maxSearchCalls * 2 + records;
  return {
    mode: input.mode,
    claims,
    records,
    intakeCalls: input.mode === 'full' ? 3 + 1 : 0,
    searchCalls,
    pages: claims * caps.maxPages,
    compares: claims * caps.maxPages,
  };
}

/** 冻结示例的断言读取（只认 jsonl，每行一条；坏行报行号，不静默跳过） */
export async function readExampleClaims(exampleDir: string): Promise<ClaimRecord[]> {
  const file = path.join(exampleDir, 'claims.jsonl');
  const raw = await fs.readFile(file, 'utf8');
  const claims: ClaimRecord[] = [];
  const lines = raw.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!.trim();
    if (line === '') continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      throw new Error(`${file}:${index + 1} 不是合法 JSON：${error instanceof Error ? error.message : String(error)}`);
    }
    if (parsed === null || typeof parsed !== 'object') {
      throw new Error(`${file}:${index + 1} 不是对象`);
    }
    const row = parsed as Partial<ClaimRecord>;
    if (typeof row.claimId !== 'string' || typeof row.recordId !== 'string' || typeof row.fieldKey !== 'string') {
      throw new Error(`${file}:${index + 1} 缺 claimId / recordId / fieldKey`);
    }
    claims.push(row as ClaimRecord);
  }
  return claims;
}

export async function readExampleQuery(exampleDir: string): Promise<string> {
  return (await fs.readFile(path.join(exampleDir, 'query.txt'), 'utf8')).trim();
}

/** `case.json` 读不懂就返回 null：实验报告不能因为文案文件坏掉而丢结果 */
async function loadCaseMeta(exampleDir: string): Promise<DemoCase | null> {
  try {
    const raw = await fs.readFile(path.join(exampleDir, 'case.json'), 'utf8');
    return parseDemoCase(JSON.parse(raw) as unknown);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      console.warn(`Warning: could not read case.json (${error instanceof Error ? error.message : String(error)})`);
    }
    return null;
  }
}

const GATE_TEXT: Record<RecordGate, string> = {
  strong: '强档',
  weak: '弱档',
  rejected: '拒收',
};

/** 离线预期 vs 本次实际（只对 replay 的同一批 recordId 有意义） */
export function compareExpectations(
  expectations: DemoCaseExpectation[],
  summaries: RecordSummary[],
  anchors: AnchorRecord[],
): DemoLiveExpectationCheck[] {
  const summaryById = new Map(summaries.map((summary) => [summary.recordId, summary]));
  const anchorById = new Map(anchors.map((anchor) => [anchor.recordId, anchor]));
  return expectations.map((expectation) => {
    const summary = summaryById.get(expectation.recordId);
    const anchor = anchorById.get(expectation.recordId);
    const expected = `${GATE_TEXT[expectation.gate]}（${expectation.gate}） / ${
      expectation.anchor ? `坐标 ${expectation.anchor}` : '无坐标'
    }`;
    const actual = summary
      ? `${GATE_TEXT[summary.gate]}（${summary.gate}） / ${
          anchor ? `坐标 ${anchor.anchorGrade}` : '无坐标'
        }`
      : '本次未产出该记录';
    const ok = summary?.gate === expectation.gate
      && (anchor?.anchorGrade ?? null) === expectation.anchor;
    return { recordId: expectation.recordId, expected, actual, ok };
  });
}

// ============================================
// pages：只重抓冻结示例里的来源页
// ============================================

export type FrozenKind = 'full' | 'excerpt';

/** 快照首行的节选标记；没有标记的按全文处理（老底稿都是全文） */
const EXCERPT_MARKER = '【节选';

export function detectFrozenKind(snapshot: string | null): FrozenKind | null {
  if (snapshot === null) return null;
  const firstLine = (snapshot.split(/\r?\n/, 1)[0] ?? '').trim();
  return firstLine.startsWith(EXCERPT_MARKER) ? 'excerpt' : 'full';
}

export interface RefetchRow {
  url: string;
  domain: string;
  status: 'ok' | 'failed';
  /** 冻结物是整页正文还是节选：节选不能与重抓的整页比"是否同文" */
  frozenKind: FrozenKind | null;
  frozenChars: number | null;
  freshChars: number | null;
  /** 折叠空白后是否与冻结快照同文（不是字节级哈希）；节选快照恒为 null */
  sameText: boolean | null;
  quoteTotal: number;
  quoteStillVerbatim: number;
  error?: string;
}

export interface RefetchOutcome {
  runDir: string;
  rows: RefetchRow[];
  frozenSnapshots: number;
  reportPath: string;
}

/**
 * 冻结证据行按 claimId 取子集（`--claim` 在 pages 模式里的落点：只重抓这一条断言用过的页）。
 * 空数组 = 不过滤，原样返回。
 */
export function selectEvidenceByClaimIds(rows: EvidenceRecord[], claimIds: string[]): EvidenceRecord[] {
  if (claimIds.length === 0) return rows;
  const wanted = new Set(claimIds);
  return rows.filter((row) => wanted.has(row.claimId));
}

/**
 * 重抓冻结示例用过的每一页，核对：页面还开不开、当时的引文还在不在；整页快照再加一项"正文变没变"。
 *
 * 节选快照不比全文——节选永远不可能等于重抓的整页，比了只会得出一个恒假的结论。
 *
 * 这一步不调模型、不花搜索额度，只花浏览器时间；它回答的是 "在线版值不值得跑" 的前置问题。
 */
export async function refetchExamplePages(input: {
  exampleDir: string;
  runDir: string;
  /** 只重抓这些断言用过的页（`--claim`）；不传 = 全部 */
  claimIds?: string[];
  onStage?: (stage: string, detail?: Record<string, unknown>) => void;
  captureImpl?: typeof captureEvidencePage;
}): Promise<RefetchOutcome> {
  const capture = input.captureImpl ?? captureEvidencePage;
  await assertPackRequirements(porcelainPack);
  await fs.mkdir(input.runDir, { recursive: true });
  const freshStore = createStore({ baseDir: input.runDir });
  const frozenStore = createStore({ baseDir: input.exampleDir });

  const evidence = selectEvidenceByClaimIds(await readEvidenceRows(input.exampleDir), input.claimIds ?? []);
  const byUrl = new Map<string, EvidenceRecord[]>();
  for (const row of evidence) {
    const bucket = byUrl.get(row.url);
    if (bucket) bucket.push(row);
    else byUrl.set(row.url, [row]);
  }

  const rows: RefetchRow[] = [];
  let index = 0;
  for (const [url, frozenRows] of byUrl) {
    index += 1;
    const first = frozenRows[0]!;
    const frozenSnapshotRef = first.snapshotRef;
    const frozenText = await readSnapshot(frozenStore, frozenSnapshotRef);
    const frozenKind = detectFrozenKind(frozenText);
    const quotes = [...new Set(frozenRows.map((row) => row.quote).filter((quote) => quote.trim() !== ''))];
    input.onStage?.('refetch', { url, index, total: byUrl.size });
    try {
      const fresh = await capture(freshStore, `refetch-${String(index).padStart(2, '0')}`, url, {
        forceRefresh: true,
        forceBrowser: porcelainPack.requirements?.browser === 'required',
      });
      const freshText = fresh.text;
      let sameText: boolean | null = null;
      if (frozenText !== null && frozenKind === 'full') {
        sameText = normalizeForCompare(frozenText) === normalizeForCompare(freshText);
      }
      const quoteStillVerbatim = quotes.filter((quote) => quoteMatches(quote, freshText)).length;
      rows.push({
        url,
        domain: first.domain,
        status: 'ok',
        frozenKind,
        frozenChars: frozenText?.length ?? null,
        freshChars: freshText.length,
        sameText,
        quoteTotal: quotes.length,
        quoteStillVerbatim,
      });
      const frozenNote =
        frozenKind === 'excerpt'
          ? `冻结的是节选（${frozenText?.length ?? '—'} 字），不与整页比全文`
          : `冻结 ${frozenText?.length ?? '—'} 字，正文${
              sameText === true ? '一致' : sameText === false ? '已变化' : '无从比较'
            }`;
      console.log(
        `  ${url}\n    抓回 ${freshText.length} 字；${frozenNote}；` +
          `引文仍逐字命中 ${quoteStillVerbatim}/${quotes.length}`,
      );
    } catch (error) {
      rows.push({
        url,
        domain: first.domain,
        status: 'failed',
        frozenKind,
        frozenChars: frozenText?.length ?? null,
        freshChars: null,
        sameText: null,
        quoteTotal: quotes.length,
        quoteStillVerbatim: 0,
        error: error instanceof Error ? error.message : String(error),
      });
      console.log(`  ${url}\n    抓取失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const reportPath = path.join(input.runDir, 'refetch-report.json');
  await fs.writeFile(
    reportPath,
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        exampleDir: path.relative(PACKAGE_ROOT, input.exampleDir),
        rows,
      },
      null,
      2,
    ),
    'utf8',
  );
  return { runDir: input.runDir, rows, frozenSnapshots: evidence.length, reportPath };
}

async function readEvidenceRows(exampleDir: string): Promise<EvidenceRecord[]> {
  const file = path.join(exampleDir, 'evidence.jsonl');
  const raw = await fs.readFile(file, 'utf8');
  const rows: EvidenceRecord[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    rows.push(JSON.parse(trimmed) as EvidenceRecord);
  }
  return rows;
}

function normalizeForCompare(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

// ============================================
// replay / full：跑一次真实裁决
// ============================================

/**
 * 护栏读数写成一行，终端与 `--dry-run` 用同一句——两处各写一遍迟早会漂。
 * 截止时刻打印成 UTC ISO：本地时区在不同机器上不一样，墙钟读数要能互相比。
 */
export function formatRunTimeGuards(guards: RunTimeGuards): string {
  const breaker = guards.infraBreakerThreshold > 0 ? `stop after ${guards.infraBreakerThreshold} consecutive infra-idle claims` : 'breaker off';
  const deadline = guards.deadlineAtMs === undefined ? 'no deadline' : `deadline ${new Date(guards.deadlineAtMs).toISOString()}`;
  return `${breaker}, ${deadline}`;
}

/** `--claim` 的取值：逗号与空白都算分隔符，去重保序 */
export function parseClaimFilter(raw: string): string[] {
  const ids = new Set<string>();
  for (const part of raw.split(/[,;\s]+/)) {
    if (part !== '') ids.add(part);
  }
  return [...ids];
}

/**
 * 冻结断言按 claimId 取子集。
 *
 * `missing` 必须单独返回：命令行点了底稿里没有的号时，若静默跑出 0 条，读起来就像
 * "这条断言没有结论"——那是最坏的一种失败，它看起来像个结果。
 */
export function selectClaimsByIds(
  claims: ClaimRecord[],
  claimIds: string[],
): { selected: ClaimRecord[]; missing: string[] } {
  if (claimIds.length === 0) return { selected: claims, missing: [] };
  const wanted = new Set(claimIds);
  const present = new Set(claims.map((claim) => claim.claimId));
  return {
    selected: claims.filter((claim) => wanted.has(claim.claimId)),
    missing: claimIds.filter((id) => !present.has(id)),
  };
}

/** 抓取通路的中文名：终端与报告都说人话，不让读者先查 `fetch` / `browser` 指什么 */
const PAGE_PATH_LABEL: Record<PageFetchLog['path'], string> = {
  fetch: '直连抓取',
  browser: '浏览器渲染',
  cache: '同记录组内复用',
  'site-adapter': '站点适配器',
  failed: '没抓到',
};

/** 终端用的秒数写法：一位小数够比较，不必写成 25431 ms */
function formatSeconds(ms: number): string {
  if (ms < 1000) return `${String(Math.round(ms))}ms`;
  const seconds = ms / 1000;
  if (seconds < 120) return `${seconds.toFixed(1)}s`;
  return `${(seconds / 60).toFixed(1)}min`;
}

/**
 * 抓取耗时的一行读数：终端汇总用它与报告同一份数，两处各算一遍迟早会漂。
 *
 * `failed` 也报出来，是因为"白等了多久"是这轮实测里最想要的读数——
 * 检索与渲染花在没抓到正文的页上的时间，一分也不会退回来。
 */
export function formatPageTiming(timing: DemoLivePageTiming): string {
  const attemptsOf = (path: PageFetchLog['path']): number =>
    timing.byPath.find((row) => row.path === path)?.attempts ?? 0;
  const slowest = timing.slowest[0];
  const parts = [
    `fetch ${String(timing.fetched)} page(s) / ${String(timing.attempts)} attempts`,
    `direct ${String(attemptsOf('fetch'))}`,
    `browser ${String(attemptsOf('browser'))}`,
    `cached ${String(attemptsOf('cache'))}`,
    `failed ${String(timing.failed)}`,
    `— ${formatSeconds(timing.fetchedTotalMs)} fetching, ${formatSeconds(timing.failedTotalMs)} spent on attempts that produced nothing`,
  ];
  if (slowest) parts.push(`slowest ${formatSeconds(slowest.durationMs)} (${slowest.path})`);
  return parts.join(' | ');
}

/** 中位数（偶数取中间两数的平均）；空数组返回 0。页与页的耗时差一个数量级，均值会被最长那几页拖走 */
function medianMs(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return Math.round(sorted[mid] ?? 0);
  return Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2);
}

function sumMs(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0);
}

/**
 * 逐次抓取读数汇成报告里的一块。
 *
 * 三条口径要说清，否则这组数会被读反：
 * - 失败的尝试也计时——渲染 25 秒最后什么也没抓到，那 25 秒是真花掉的时间；
 * - `cache` 是同记录组内复用同一份快照，没再花抓取钱，因此不进任何耗时合计；
 * - 裁决链同一时刻只放一个外部请求在飞（并发为 1），所以各行耗时相加就是墙钟占用，
 *   可以直接与 `wallMs` 对照，看这场有多少时间花在"等网页"上。
 */
export function summarizePageFetches(
  logs: PageFetchLog[],
  input: { wallMs: number; slowestCount?: number },
): DemoLivePageTiming {
  const durationsByPath = new Map<PageFetchLog['path'], number[]>();
  for (const log of logs) {
    const bucket = durationsByPath.get(log.path);
    if (bucket) bucket.push(log.durationMs);
    else durationsByPath.set(log.path, [log.durationMs]);
  }
  const byPath: DemoLivePageTimingRow[] = [...durationsByPath.entries()]
    .map(([path, durations]) => ({
      path,
      label: PAGE_PATH_LABEL[path],
      attempts: durations.length,
      medianMs: medianMs(durations),
      maxMs: durations.length > 0 ? Math.max(...durations) : 0,
      totalMs: sumMs(durations),
    }))
    .sort((a, b) => b.totalMs - a.totalMs);
  const fetchedDurations = logs.filter((log) => log.path !== 'cache' && log.path !== 'failed').map((log) => log.durationMs);
  const failedDurations = logs.filter((log) => log.path === 'failed').map((log) => log.durationMs);
  const slowestCount = input.slowestCount ?? 5;
  return {
    attempts: logs.length,
    fetched: fetchedDurations.length,
    cached: logs.filter((log) => log.path === 'cache').length,
    failed: failedDurations.length,
    fetchedTotalMs: sumMs(fetchedDurations),
    failedTotalMs: sumMs(failedDurations),
    wallMs: input.wallMs,
    byPath,
    slowest: [...logs]
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, slowestCount)
      .map((log) => ({ url: log.url, path: log.path, label: PAGE_PATH_LABEL[log.path], durationMs: log.durationMs })),
  };
}

/**
 * 逐条 infra 失败汇成 `run-error.json` 的内容（纯函数，便于离线测）。
 *
 * 为什么需要这一份：单条断言失败时，裁决链只把状态推进到 `failed`，失败理由留在内存与
 * trace 里；而终端一直让用户"去看 run-error.json"——那份文件过去只在整场崩溃时才写。
 * 于是一场 13 条断言里 8 条卡在检索 503 的实验，报告里看不出任何异常，用户翻不到任何理由。
 * 这里不写任何密钥或请求头：这份东西是给人贴进 issue 的。
 */
export function buildClaimFailureReport(input: {
  mode: LiveRunMode;
  provider: string;
  caps: LiveCaps;
  guards: RunTimeGuards;
  startedAt: string;
  finishedAt: string;
  command: string;
  failures: RunQueryResult['claimFailures'];
}): {
  kind: 'claim-failures';
  mode: LiveRunMode;
  provider: string;
  caps: LiveCaps;
  guards: RunTimeGuards;
  startedAt: string;
  finishedAt: string;
  command: string;
  failedClaims: number;
  claims: RunQueryResult['claimFailures'];
} {
  return {
    kind: 'claim-failures',
    mode: input.mode,
    provider: input.provider,
    caps: input.caps,
    guards: input.guards,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    command: input.command,
    failedClaims: input.failures.length,
    claims: input.failures,
  };
}

export interface LiveRunOptions {
  mode: LiveRunMode;
  exampleName: string;
  exampleDir: string;
  runDir: string;
  query: string;
  claims: ClaimRecord[];
  caps: LiveCaps;
  /**
   * 整场时间护栏（缺省见 `defaultRunTimeGuards`：熔断 3 条、不设截止）。
   * `--deadline-minutes` 传的是**绝对时刻**，所以 `both` 模式下 replay 与 full 共用同一个
   * 截止点——花钱的窗口由这条命令的起点决定，而不是每个模式各领一份。
   */
  guards?: Partial<RunTimeGuards>;
  provider: string;
  reportPath: string;
  command: string;
  onStage?: (stage: string, detail?: Record<string, unknown>) => void;
  runQueryImpl?: typeof runQuery;
  inspectImpl?: typeof inspectEvidence;
}

export interface LiveRunOutcome {
  mode: LiveRunMode;
  runDir: string;
  reportPath: string;
  result: RunQueryResult;
  check: EvidenceCheck;
  expectationChecks: DemoLiveExpectationCheck[];
  ledger: {
    claims: number;
    evidence: number;
    verdicts: number;
    records: number;
    anchors: number;
  };
  guardOk: boolean;
  /** 本次抓取耗时读数（终端汇总与报告共用同一份） */
  pageTiming: DemoLivePageTiming;
}

export async function runLiveExperiment(input: LiveRunOptions): Promise<LiveRunOutcome> {
  const runQueryImpl = input.runQueryImpl ?? runQuery;
  const inspect = input.inspectImpl ?? inspectEvidence;
  await assertPackRequirements(porcelainPack);
  await fs.mkdir(input.runDir, { recursive: true });

  // trace 落进本次运行目录：实验之间互不覆盖，也不会混进仓库根的 .traces/
  process.env.OPENLODESTAR_TRACE_DIR = path.join(input.runDir, 'traces');
  process.env.SEARCH_PROVIDER = input.provider;
  resetTraceStoreForRun();

  const store = createStore({ baseDir: input.runDir });
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const guards = resolveRunTimeGuards(input.guards);

  console.log(`\n[live:${input.mode}] run dir: ${path.relative(process.cwd(), input.runDir)}`);
  console.log(`[live:${input.mode}] provider=${input.provider} caps=search ${input.caps.maxSearchCalls}/record, pages ${input.caps.maxPages}/claim${input.mode === 'full' ? `, records ${input.caps.maxRecords}` : ''}`);
  console.log(`[live:${input.mode}] time guards=${formatRunTimeGuards(guards)}`);

  let result: RunQueryResult;
  try {
    result = input.mode === 'replay'
      ? await runQueryImpl('', {
          store,
          pack: porcelainPack,
          caps: input.caps,
          externalClaims: input.claims,
          queryLabel: input.query,
          guards,
          onStage: input.onStage,
        })
      : await runQueryImpl(input.query, {
          store,
          pack: porcelainPack,
          caps: input.caps,
          intake: { maxRecords: input.caps.maxRecords },
          guards,
          onStage: input.onStage,
        });
  } catch (error) {
    // 失败也留档：否则"为什么这一轮没结果"只剩终端里的一段红字
    await fs.writeFile(
      path.join(input.runDir, 'run-error.json'),
      JSON.stringify(
        {
          // 同一个文件两种内容，靠 kind 分：整场崩溃 vs 逐条断言失败（后者见下）
          kind: 'run-crash',
          mode: input.mode,
          provider: input.provider,
          caps: input.caps,
          guards,
          command: input.command,
          startedAt,
          error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
        },
        null,
        2,
      ),
      'utf8',
    );
    throw error;
  }

  const finishedAt = new Date().toISOString();
  const wallMs = Date.now() - startedMs;
  const pageTiming = summarizePageFetches(result.pageFetches, { wallMs });
  // 逐条断言失败也写 run-error.json：整场没崩、但 13 条里 8 条卡在检索 503 的那种实验，
  // 过去只在终端留一行红字，文件里查不到任何理由——而终端那句提示恰恰让用户去看这个文件
  if (result.claimFailures.length > 0) {
    await fs.writeFile(
      path.join(input.runDir, 'run-error.json'),
      JSON.stringify(
        buildClaimFailureReport({
          mode: input.mode,
          provider: input.provider,
          caps: input.caps,
          guards,
          startedAt,
          finishedAt,
          command: input.command,
          failures: result.claimFailures,
        }),
        null,
        2,
      ),
      'utf8',
    );
  }
  const ledgerClaims = await store.query<ClaimRecord>('claims');
  const evidence = await store.allRows<EvidenceRecord>('evidence');
  const verdicts = await store.query<VerdictRecord>('verdicts');
  const summaries = await store.query<RecordSummary>('records');
  const anchors = await store.query<AnchorRecord>('anchors');
  const claimById = new Map(ledgerClaims.map((claim) => [claim.claimId, claim]));
  const check = await inspect(store, evidence, claimById, porcelainPack);
  const frozenCase = await loadCaseMeta(input.exampleDir);
  const expectationChecks = input.mode === 'replay'
    ? compareExpectations(frozenCase?.expectations ?? [], summaries, anchors)
    : [];

  const gateCounts = countBy(summaries.map((summary) => summary.gate));
  const caseMeta: DemoCase = {
    id: `live-${input.mode}`,
    title: `${frozenCase?.title ?? `OpenLodestar 演示：${input.exampleName}`} · 在线${input.mode === 'replay' ? '重放' : '全链路'}实验`,
    subtitle: input.mode === 'replay'
      ? '同一批断言，不靠冻结证据：重新检索、重新抓取、重新比对'
      : '模型重新列场次，再检索、抓取、比对',
    query: input.query,
    capturedAt: finishedAt.slice(0, 10),
    summary:
      `本次在线运行留下 ${ledgerClaims.length} 条断言、${evidence.length} 条证据、${summaries.length} 条记录；` +
      `强档 ${gateCounts.get('strong') ?? 0} 条、弱档 ${gateCounts.get('weak') ?? 0} 条、拒收 ${gateCounts.get('rejected') ?? 0} 条。` +
      `下面每一条结论都指得到本次自抓的快照。`,
    // 来源表只从本次证据派生；不把冻结局的发布者/抓取日期混进来
    sources: [],
    expectations: input.mode === 'replay' ? frozenCase?.expectations ?? [] : [],
    notProven: buildNotProven(summaries, verdicts),
    limitations: buildLiveLimitations(input, evidence),
  };

  const liveMeta: DemoLiveMeta = {
    mode: input.mode,
    provider: input.provider,
    caps: {
      maxSearchCalls: input.caps.maxSearchCalls,
      maxPages: input.caps.maxPages,
      numResultsPerQuery: input.caps.numResultsPerQuery,
      maxRecords: input.mode === 'full' ? input.caps.maxRecords : undefined,
    },
    startedAt,
    finishedAt,
    command: input.command,
    expectationChecks,
    notes: buildLiveNotes(input, evidence, expectationChecks, result),
    pageTiming,
  };

  const html = renderDemoReport({
    exampleName: input.exampleName,
    fixtureDir: input.exampleDir,
    workDir: input.runDir,
    query: input.query,
    caseMeta,
    fields: porcelainPack.fields().map((field) => ({ key: field.key, label: field.label, role: field.role })),
    claims: ledgerClaims,
    evidence,
    verdicts,
    summaries,
    anchors,
    guard: check,
    generatedAt: finishedAt,
    liveMeta,
  });
  await fs.mkdir(path.dirname(input.reportPath), { recursive: true });
  await fs.writeFile(input.reportPath, html, 'utf8');

  const elapsed = ((Date.now() - startedMs) / 1000).toFixed(1);
  console.log(`\n[live:${input.mode}] finished in ${elapsed}s`);
  console.log(
    `[live:${input.mode}] claims=${ledgerClaims.length} evidence=${evidence.length} verdicts=${verdicts.length} ` +
      `records=${summaries.length} anchors=${anchors.length}`,
  );
  console.log(
    `[live:${input.mode}] searchCalls=${result.stats.searchCalls} pagesFetched=${result.stats.pagesFetched} ` +
      `compareCalls=${result.stats.compareCalls} paused=${result.stats.claimsPaused} failed=${result.stats.claimsFailed} ` +
      `not_found(budget/coverage/absent)=` +
      `${result.stats.notFoundCauses.budget}/${result.stats.notFoundCauses.coverage}/${result.stats.notFoundCauses.genuinely_absent}`,
  );

  console.log(`\n[live:${input.mode}] records`);
  for (const summary of [...summaries].sort((a, b) => a.recordId.localeCompare(b.recordId))) {
    console.log(`  ${summary.recordId}  ${summary.gate.padEnd(8)}  ${summary.reason}`);
  }
  console.log(`\n[live:${input.mode}] anchors`);
  for (const anchor of [...anchors].sort((a, b) => a.recordId.localeCompare(b.recordId))) {
    console.log(
      `  ${anchor.recordId}  ${anchor.anchorGrade.padEnd(6)} ${anchor.evidenceGrade}  ` +
        `sourceUrls=${anchor.sourceUrls.length}  fields=${Object.keys(anchor.fields).length}`,
    );
    for (const url of anchor.sourceUrls) console.log(`    - ${url}`);
  }
  const readable = anchors.filter((anchor) => isReadableAnchor(anchor)).length;
  console.log(`  Readable anchors (strong and not stale): ${readable}/${anchors.length}`);

  if (expectationChecks.length > 0) {
    console.log(`\n[live:${input.mode}] expectations`);
    for (const item of expectationChecks) {
      console.log(`  ${item.ok ? 'OK  ' : 'DIFF'}  ${item.recordId}  预期 ${item.expected}  →  本次 ${item.actual}`);
    }
  }

  console.log(`\n[live:${input.mode}] quote hard guard`);
  printEvidenceCheck(check, 20);
  console.log(`\n[live:${input.mode}] HTML report: ${path.relative(process.cwd(), input.reportPath)}`);

  return {
    mode: input.mode,
    runDir: input.runDir,
    reportPath: input.reportPath,
    result,
    check,
    expectationChecks,
    ledger: {
      claims: ledgerClaims.length,
      evidence: evidence.length,
      verdicts: verdicts.length,
      records: summaries.length,
      anchors: anchors.length,
    },
    guardOk: check.violations.length === 0,
    pageTiming,
  };
}

function countBy<T extends string>(items: T[]): Map<T, number> {
  const counts = new Map<T, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return counts;
}

function buildNotProven(summaries: RecordSummary[], verdicts: VerdictRecord[]): string[] {
  const out: string[] = [];
  for (const summary of summaries) {
    if (summary.gate === 'rejected') out.push(`${summary.recordId}：${summary.reason}`);
  }
  for (const verdict of verdicts) {
    if (verdict.verdict === 'not_found' && verdict.notFoundCause) {
      out.push(`${verdict.claimId}：未查到（成因 ${verdict.notFoundCause}；不是"世界不存在"的证明）`);
    }
  }
  return out.slice(0, 12);
}

function buildLiveLimitations(input: LiveRunOptions, evidence: EvidenceRecord[]): string[] {
  const out = [
    '这是在线实验：结论依赖当天的搜索、模型与站点可达性，重跑未必得到同一批页面；可重复的发布物仍是离线冻结示例。',
    `检索提供者 ${input.provider}；提供者不支持 site: 时，域定向查询会被跳过并记入足迹，不会降级成普通词。`,
    '四份冻结页面与本次抓取可能不同；报告里的"与离线底稿的对照"只比较记录级结论，不比较正文。',
    '转载/镜像是否被正确归并取决于来源家族表；家族判错会改变独立来源计数（例如澎湃号转载雅昌原创稿）。',
    `本次预算：每条记录检索 ${input.caps.maxSearchCalls} 条、每条断言抓取 ${input.caps.maxPages} 页` +
      `${input.mode === 'full' ? `、记录上限 ${input.caps.maxRecords}` : ''}；not_found 的成因可能是预算耗尽或覆盖缺口，不等于确证无记录。`,
  ];
  const guards = resolveRunTimeGuards(input.guards);
  out.push(
    `本次时间护栏：${formatRunTimeGuards(guards)}（墙钟，从这一场开跑算起）。` +
      '护栏收手只说明"这场没跑完"，被跳过的断言记 paused，不是查不到；' +
      '同一层的耗时与重试口径见 README 的环境变量表。',
  );
  if (input.mode === 'full') {
    out.push('full 模式由模型重新列场次，记录名与冻结示例不同属正常；不要拿记录名对不上当作失败。');
  }
  const repost = evidence.find((row) => /(^|\.)thepaper\.cn$/i.test(row.domain) || row.domain === 'm.thepaper.cn');
  if (repost) {
    out.push(
      `本次底稿出现了 ${repost.domain}（家族 ${repost.sourceFamily}）：冻结底稿按原创方把它并进 artron.net，` +
        '在线规则按注册域计成独立家族；若同一篇稿的两个落点同时出现，独立来源会偏高——这是本轮要盯的风险点。',
    );
  }
  return out;
}

function buildLiveNotes(
  input: LiveRunOptions,
  evidence: EvidenceRecord[],
  checks: DemoLiveExpectationCheck[],
  result: RunQueryResult,
): string[] {
  const notes = [
    '预期来自 examples/' + input.exampleName + '/case.json；本次结果来自实时证据，不一致不等于系统错误，需逐条看引文。',
  ];
  if (checks.length === 0) {
    notes.push('full 模式不逐条对照冻结记录：模型这次列出的场次可能不同，对照表为空是刻意的。');
  }
  if (result.guardStopped !== undefined) {
    notes.push(
      `本场被时间护栏收手（原因 ${result.guardStopped}），跳过 ${result.guardSkippedClaimIds.length} 条断言：` +
        `${result.guardSkippedClaimIds.join('、')}。这些行是"还没跑"，报告里别按"查不到"读。`,
    );
  }
  const domains = [...new Set(evidence.map((row) => row.domain))].sort();
  if (domains.length > 0) {
    notes.push(`本次实际用到的页面域名：${domains.join('、')}。`);
  }
  return notes;
}

// ============================================
// CLI
// ============================================

export function liveUsage(): string {
  return `  tsx src/cli.ts live [--mode replay|full|both|pages] [--example <name>] [--query <text>]
                        [--root <dir>] [--run-id <id>] [--report <file>] [--max-records <n>]
                        [--max-search-calls <n>] [--max-pages <n>] [--results <n>]
                        [--claim <id>[,<id>...]] [--deadline-minutes <n>] [--provider <name>] [--dry-run]`;
}

interface LiveFlagBag {
  get(key: string): string | undefined;
}

function numberFlag(flags: LiveFlagBag, key: string, fallback: number, min = 1): number {
  const raw = flags.get(key);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < min) {
    throw new Error(`--${key} 需要 >= ${min} 的整数，收到：${raw}`);
  }
  return Math.floor(parsed);
}

function parseMode(raw: string | undefined): LiveMode {
  if (raw === undefined) return 'replay';
  if (raw === 'replay' || raw === 'full' || raw === 'both' || raw === 'pages') return raw;
  throw new Error(`--mode 只接受 replay / full / both / pages，收到：${raw}`);
}

function timestampId(): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function reportPathFor(base: string | undefined, runDir: string, mode: LiveRunMode, both: boolean): string {
  if (base === undefined) return path.join(runDir, 'demo-report.html');
  const resolved = path.resolve(base);
  if (!both) return resolved;
  const ext = path.extname(resolved);
  // 没写扩展名时按"目录"理解，避免把报告写成 `reports-replay.html` 这种同名兄弟文件
  if (ext === '') return path.join(resolved, `demo-report-${mode}.html`);
  const stem = resolved.slice(0, -ext.length);
  return `${stem}-${mode}${ext}`;
}

function assertLiveKeys(provider: string): void {
  if (!process.env.LLM_API_KEY?.trim()) {
    throw new Error('缺少 LLM_API_KEY：在线实验要用模型做比对与（full 模式的）提问环。先按 .env.example 配好 .env，再用 --env-file=.env 启动。');
  }
  if (provider === 'serper' && !process.env.SERPER_API_KEY?.trim()) {
    throw new Error('SEARCH_PROVIDER=serper 但缺少 SERPER_API_KEY。');
  }
}

function providerLabel(): string {
  return (process.env.SEARCH_PROVIDER ?? 'llm-web').trim().toLowerCase() || 'llm-web';
}

function baseUrlHost(): string {
  try {
    return new URL(process.env.LLM_BASE_URL ?? 'https://api.openai.com/v1').host;
  } catch {
    return '(LLM_BASE_URL 不是合法 URL)';
  }
}

/** `live` 命令入口（由 cli.ts 调用；返回退出码） */
export async function commandLive(flags: Map<string, string>): Promise<number> {
  const mode = parseMode(flags.get('mode'));
  const exampleName = flags.get('example') ?? 'poly-2021-autumn';
  if (!/^[a-z0-9][a-z0-9-]*$/.test(exampleName)) {
    console.error(`Invalid --example "${exampleName}": use lowercase letters, digits and dashes.`);
    return 1;
  }
  const exampleDir = path.resolve(PACKAGE_ROOT, 'examples', exampleName);
  // 默认落在 .openlodestar-demo/live/ 下——目录名与 demo 重置时保留的那个条目同源，
  // 两边各写一个字面量的话，"demo 不许删 live"那条守卫就会悄悄失效。
  const root = path.resolve(flags.get('root') ?? path.join(PACKAGE_ROOT, '.openlodestar-demo', LIVE_RUNS_DIR_NAME));
  const runId = flags.get('run-id') ?? timestampId();
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    console.error(`Invalid --run-id "${runId}": use letters, digits, dot, underscore or dash.`);
    return 1;
  }
  const provider = flags.get('provider')?.trim().toLowerCase() || providerLabel();
  const caps: LiveCaps = {
    maxSearchCalls: numberFlag(flags, 'max-search-calls', DEFAULT_CAPS.maxSearchCalls),
    maxPages: numberFlag(flags, 'max-pages', DEFAULT_CAPS.maxPages),
    numResultsPerQuery: numberFlag(flags, 'results', DEFAULT_CAPS.numResultsPerQuery),
    maxRecords: numberFlag(flags, 'max-records', 4),
  };
  // 整场截止时刻按"这条命令的起点"算：--mode both 时 replay 与 full 共用同一个时刻，
  // 花钱的窗口由一次命令行决定，而不是每个模式各领一份。0 = 不设截止（照旧跑到完）。
  const deadlineMinutes = numberFlag(flags, 'deadline-minutes', 0, 0);
  const guards = resolveRunTimeGuards(
    deadlineMinutes > 0 ? { deadlineAtMs: Date.now() + deadlineMinutes * 60_000 } : undefined,
  );
  const limit = numberFlag(flags, 'limit', 20);
  const dryRun = flags.get('dry-run') === 'true';
  const reportBase = flags.get('report');
  // --claim：只重放冻结底稿里点名的那几条断言。full 模式的断言是模型当场生成的，没有号可点，
  // 那里直接报错——"参数看着生效其实被忽略"比报错难查得多。
  const claimFilterRaw = flags.get('claim');
  if (claimFilterRaw === 'true' || claimFilterRaw === '') {
    console.error('--claim 需要 claimId，多个用逗号分隔，例如 --claim cl-20261004-aaaaaa,cl-20261004-aaaaab');
    return 1;
  }
  const claimIds = claimFilterRaw ? parseClaimFilter(claimFilterRaw) : [];
  if (claimIds.length > 0 && mode === 'full') {
    console.error('--claim 只作用于 replay 与 pages：full 模式的断言由模型当场生成，没有可点名的 claimId。');
    return 1;
  }
  const commandLine = [
    'npx tsx --env-file=.env src/cli.ts live',
    `--mode ${mode}`,
    `--example ${exampleName}`,
    ...(flags.get('run-id') ? [`--run-id ${runId}`] : []),
    ...(flags.get('query') ? ['--query <inline>'] : []),
    ...(claimIds.length > 0 ? [`--claim ${claimIds.join(',')}`] : []),
    `--max-search-calls ${caps.maxSearchCalls}`,
    `--max-pages ${caps.maxPages}`,
    `--results ${caps.numResultsPerQuery}`,
    ...(mode === 'full' || mode === 'both' ? [`--max-records ${caps.maxRecords}`] : []),
    ...(deadlineMinutes > 0 ? [`--deadline-minutes ${deadlineMinutes}`] : []),
    `--provider ${provider}`,
    ...(flags.get('report') ? [`--report ${flags.get('report')}`] : []),
  ].join(' ');

  try {
    await fs.access(path.join(exampleDir, 'claims.jsonl'));
  } catch {
    console.error(`Example not found: examples/${exampleName} (missing claims.jsonl)`);
    return 1;
  }

  const allClaims = await readExampleClaims(exampleDir);
  const picked = selectClaimsByIds(allClaims, claimIds);
  if (picked.missing.length > 0) {
    // 点了不存在的号却跑出 0 条，读起来像"这条断言没结论"——那必须报错，不能静默
    console.error(
      `--claim 里有这份底稿不认识的号：${picked.missing.join(', ')}（examples/${exampleName}/claims.jsonl 共 ${allClaims.length} 条断言）`,
    );
    return 1;
  }
  const claims = picked.selected;
  if (claimIds.length > 0) {
    console.log(`Claim filter: ${claims.length} of ${allClaims.length} frozen claim(s)${mode === 'both' ? ' — applies to the replay half only; full generates its own claims' : ''}`);
  }
  const recordCount = new Set(claims.map((claim) => claim.recordId)).size;
  const query = (flags.get('query') ?? await readExampleQuery(exampleDir)).trim();
  const plan = planLiveRun({ mode, claimCount: claims.length, recordCount, caps });

  if (mode === 'pages') {
    const runDir = path.join(root, runId, 'pages');
    const evidence = selectEvidenceByClaimIds(await readEvidenceRows(exampleDir), claimIds);
    const urls = [...new Set(evidence.map((row) => row.url))];
    if (urls.length === 0) {
      // 空集合必须报错：它会被读成"这些页都不存在"，而实际是过滤器没匹配上任何东西
      console.error(
        claimIds.length > 0
          ? `--claim ${claimIds.join(', ')} 在 examples/${exampleName}/evidence.jsonl 里没有对应的页面可重抓。`
          : `examples/${exampleName}/evidence.jsonl 里没有证据行，pages 模式无事可做。`,
      );
      return 1;
    }
    if (dryRun) {
      console.log('OpenLodestar live — dry run (pages)');
      console.log(`Fixture: ${path.relative(process.cwd(), exampleDir)}`);
      console.log(`Pages: ${urls.length} unique source URL(s) from ${evidence.length} evidence row(s)`);
      for (const url of urls) console.log(`  - ${url}`);
      console.log(`Run dir: ${path.relative(process.cwd(), runDir)}`);
      console.log('No model and no search calls in pages mode; it only re-fetches the frozen source pages.');
      await assertPackRequirements(porcelainPack);
      console.log('Browser probe: OK');
      return 0;
    }
    const outcome = await refetchExamplePages({ exampleDir, runDir, claimIds });
    const failed = outcome.rows.filter((row) => row.status === 'failed').length;
    console.log(`\nRefetch report: ${path.relative(process.cwd(), outcome.reportPath)}`);
    console.log(`Pages: ${outcome.rows.length} | failed ${failed} | frozen snapshot rows ${outcome.frozenSnapshots}`);
    return failed > 0 ? 1 : 0;
  }

  const chosenProvider = (() => {
    try {
      const instance = createSearchProvider(provider);
      return { name: instance.name, siteOperator: instance.capabilities?.siteOperator === true };
    } catch (error) {
      throw new Error(`搜索提供者 "${provider}" 不可用：${error instanceof Error ? error.message : String(error)}`);
    }
  })();

  if (dryRun) {
    console.log('OpenLodestar live — dry run (no model or network calls)');
    console.log(`Fixture: ${path.relative(process.cwd(), exampleDir)}`);
    console.log(`Query: ${query}`);
    console.log(
      `Claims: ${claims.length}${claimIds.length > 0 ? ` of ${allClaims.length} (filtered by --claim)` : ''} | records: ${recordCount}`,
    );
    console.log(`Provider: ${chosenProvider.name} (site: ${chosenProvider.siteOperator ? 'supported' : 'skipped, recorded in footprint'})`);
    console.log(`Model: text=${getRoleModelName('text')} web-search=${getRoleModelName('web-search')}`);
    console.log(`Base URL host: ${baseUrlHost()}`);
    console.log(
      `Caps: search ${caps.maxSearchCalls}/record, pages ${caps.maxPages}/claim, results ${caps.numResultsPerQuery}/query` +
        `${mode === 'full' || mode === 'both' ? `, records ${caps.maxRecords}` : ''}`,
    );
    console.log(`Time guards: ${formatRunTimeGuards(guards)} (wall clock, from the start of this command)`);
    for (const estimate of plan.estimates) {
      console.log(
        `  [${estimate.mode}] upper bound: claims ${estimate.claims}, records ${estimate.records}, ` +
          `intake ${estimate.intakeCalls}, search ${estimate.searchCalls}, pages ${estimate.pages}, compares ${estimate.compares}`,
      );
    }
    for (const note of plan.notes) console.log(`  note: ${note}`);
    try {
      assertLiveKeys(chosenProvider.name);
      console.log('Keys: LLM_API_KEY present; provider key check passed (values are never printed).');
    } catch (error) {
      console.log(`Keys: ${error instanceof Error ? error.message : String(error)}`);
      return 1;
    }
    await assertPackRequirements(porcelainPack);
    console.log('Browser probe: OK');
    return 0;
  }

  assertLiveKeys(chosenProvider.name);

  const modes: LiveRunMode[] = plan.modes;
  const outcomes: LiveRunOutcome[] = [];
  for (const runMode of modes) {
    const runDir = path.join(root, runId, runMode);
    const reportPath = reportPathFor(reportBase, runDir, runMode, mode === 'both');
    const outcome = await runLiveExperiment({
      mode: runMode,
      exampleName,
      exampleDir,
      runDir,
      query,
      claims,
      caps,
      guards,
      provider: chosenProvider.name,
      reportPath,
      command: commandLine,
      onStage: (stage, detail) => {
        if (stage === 'claim') {
          const row = detail ?? {};
          console.log(`  [claim] ${String(row.claimId)} → ${String(row.verdict)}${row.grade ? ` ${String(row.grade)}` : ''}`);
        } else if (stage === 'intake') {
          const row = detail ?? {};
          console.log(`  [intake] records=${String(row.records)} claims=${String(row.claims)} rejected=${String(row.rejected)}`);
        } else {
          console.log(`  [${stage}] ${JSON.stringify(detail ?? {})}`);
        }
      },
    });
    outcomes.push(outcome);
  }

  const guardBad = outcomes.filter((outcome) => !outcome.guardOk);
  const failedClaims = outcomes.reduce((sum, outcome) => sum + outcome.result.stats.claimsFailed, 0);
  // 时间护栏收手不算失败：结论只是"这场没跑完"，剩下的断言还是 paused，可续跑
  const stoppedRuns = outcomes.filter((outcome) => outcome.result.guardStopped !== undefined);
  console.log('\nSummary');
  for (const outcome of outcomes) {
    console.log(
      `  ${outcome.mode.padEnd(6)} records=${outcome.ledger.records} evidence=${outcome.ledger.evidence} ` +
        `anchors=${outcome.ledger.anchors} guard=${outcome.guardOk ? 'ok' : 'VIOLATIONS'} ` +
        `timeGuard=${outcome.result.guardStopped ?? 'none'} report=${path.relative(process.cwd(), outcome.reportPath)}`,
    );
    console.log(`         ${formatPageTiming(outcome.pageTiming)}`);
  }
  for (const outcome of stoppedRuns) {
    console.log(
      `  ${outcome.mode}: stopped by time guard (${String(outcome.result.guardStopped)}); ` +
        `skipped by guard=${outcome.result.guardSkippedClaimIds.length} paused total=${outcome.result.pausedClaimIds.length}. ` +
          `They are "not run", not "not found" — rerun with a larger --deadline-minutes, or drive this run's ledger with resumeFromLedger (no --resume flag yet).`,
    );
  }
  if (guardBad.length > 0) {
    console.log('\nHard guard FAILED: fix fetching or comparison, do not bypass it by tuning.');
    return 1;
  }
  if (failedClaims > 0) {
    const errorFiles = outcomes
      .filter((outcome) => outcome.result.claimFailures.length > 0)
      .map((outcome) => path.relative(process.cwd(), path.join(outcome.runDir, 'run-error.json')));
    console.log(
      `\n${failedClaims} claim(s) failed on infra errors (search API / parse / fetch). ` +
        (errorFiles.length > 0
          ? `Per-claim reasons are aggregated in ${errorFiles.join(', ')}; page-by-page timings are in each run's report.`
          : 'Inspect the traces under each run directory.'),
    );
    return 1;
  }
  return 0;
}
