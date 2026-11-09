#!/usr/bin/env node
// scripts/scorecard.ts
/**
 * OpenLodestar 评分卡（离线，零外部调用，重跑同分）
 *
 * 只回答一件事：**判定结果比上次好了还是坏了。** 分数只来自判定结果——
 * 用例数、覆盖率、测试通过率是工作量，不是能力，一律不计分（用例数只作附注）。
 *
 * 硬口径：
 * - 没有总分：各分项方向不同（有的越高越好，有的越低越好），硬合成等于先假定
 *   「一条误拒等于几次白花检索」，这个换算站不住；
 * - 样本是固定考卷：批次清单、版本号、SHA-256 锁写进每次输出；样本换了锁就变，
 *   与基线不可直接比较（脚本会明确警告）；
 * - 未测项显示「未测」，不显示 0；
 * - 每次跑追加一行历史（提交、日期、样本版本、各项值），趋势看整张表；
 * - 退步闸只打印红标，不接 CI（先跑几轮看稳不稳）。
 *
 * 用法（仓库根目录）：
 *   npx tsx scripts/scorecard.ts                      # 出分（只读；历史表会被追加一行）
 *   npx tsx scripts/scorecard.ts --no-history         # 只出分，不写历史
 *   npx tsx scripts/scorecard.ts --update-baseline    # 把当前读数定为新基线（样本换版时用）
 *   npx tsx scripts/scorecard.ts --root <目录>        # 只换样本目录（代码仍取本脚本所在的树）；跨提交对照请在各自检出里跑
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore, readSnapshot } from '../src/lodestar/storage/adapter';
import { retallyAndRegate } from '../src/lodestar/engine';
import { quoteMatches } from '../src/lodestar/adjudicate/compare';
import { buildRecordQueries } from '../src/lodestar/adjudicate/retrieval';
import { DEFAULT_CAPS } from '../src/lodestar/adjudicate';
import { measureLiveRecall, type LiveRecallFixture, type LiveRecallResult } from '../src/lodestar/live-recall';
import porcelainPack from '../src/lodestar/packs/porcelain';
import type { ClaimRecord, EvidenceRecord } from '../src/lodestar/types';

const SCRIPT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

interface SampleSet {
  version: string;
  batches: string[];
  /**
   * 在线召回率专用的冻结检索样本（examples/replay-search/<slug>/）。
   * 与判定样本分开记版本与锁：换检索样本不影响门禁类读数，反之亦然。
   */
  liveRecall?: {
    version: string;
    samples: string[];
  };
}

interface GoldRecord {
  batch: string;
  recordId: string;
  gate: 'strong' | 'weak' | 'rejected';
  anchor: 'strong' | 'weak' | null;
  source: string;
}

interface Gold {
  version: number;
  records: GoldRecord[];
  unmeasured: Array<{
    key: string;
    label: string;
    direction: 'up' | 'down';
    meaning: string;
    reason: string;
  }>;
}

interface Metric {
  key: string;
  label: string;
  /** null = 未测（不是 0） */
  value: number | null;
  display: string;
  /** 展示单位：% 或「条」 */
  unit: '%' | '条';
  direction: 'up' | 'down';
  /** 超过这个幅度视为退步（0 = 任何退步都报） */
  threshold: number;
  detail: string;
  meaning: string;
}

interface HistoryRow {
  commit: string;
  date: string;
  recordedAt: string;
  sampleVersion: string;
  sampleHash: string;
  /** 在线召回率样本的版本与锁（与判定样本分开；旧行没有这两个字段） */
  liveRecallSampleVersion?: string;
  liveRecallSampleHash?: string;
  metrics: Record<string, number | null>;
}

interface Args {
  root: string;
  writeHistory: boolean;
  updateBaseline: boolean;
  /** 前后对照时给另一份代码树标上提交号（它可能没有 .git） */
  commit: string | null;
}

function parseArgs(argv: string[]): Args {
  const rootIndex = argv.indexOf('--root');
  const commitIndex = argv.indexOf('--commit');
  return {
    root: rootIndex >= 0 ? path.resolve(argv[rootIndex + 1] ?? SCRIPT_ROOT) : SCRIPT_ROOT,
    writeHistory: !argv.includes('--no-history'),
    updateBaseline: argv.includes('--update-baseline'),
    commit: commitIndex >= 0 ? (argv[commitIndex + 1] ?? null) : null,
  };
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function readJsonl<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as T);
}

/** 样本锁：批次目录里所有参与判定的文件按相对路径排序后逐个哈希 */
function hashSample(root: string, samples: SampleSet): string {
  const hash = crypto.createHash('sha256');
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(jsonl|json|txt)$/.test(entry.name)) files.push(full);
    }
  };
  for (const batch of samples.batches) {
    const dir = path.join(root, 'examples', batch);
    if (fs.existsSync(dir)) walk(dir);
  }
  for (const file of files.sort()) {
    hash.update(path.relative(root, file).replace(/\\/g, '/'));
    // 统一换行再哈希：同一份样本在不同检出设置（CRLF/LF）下必须锁出同一个值
    hash.update(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'));
  }
  return hash.digest('hex');
}

/** 检索样本锁：只用真正参与读数的文件（输入 + 冻结结果），按 slug/文件名排序后逐个哈希 */
function hashLiveRecall(root: string, config: { version: string; samples: string[] }): string {
  const hash = crypto.createHash('sha256');
  const files: string[] = [];
  for (const slug of [...config.samples].sort()) {
    for (const name of ['input.json', 'search-results.json']) {
      const relative = `examples/replay-search/${slug}/${name}`;
      if (fs.existsSync(path.join(root, relative))) files.push(relative);
    }
  }
  for (const relative of files.sort()) {
    hash.update(relative);
    // 与判定样本同一口径：统一换行再哈希，跨检出设置得到同一个锁
    hash.update(fs.readFileSync(path.join(root, relative), 'utf8').replace(/\r\n/g, '\n'));
  }
  return hash.digest('hex');
}

/**
 * 在线召回率：从冻结的检索回放样本离线重算（零外部调用）。
 * 没有配置样本或样本缺失 → 返回 null（显示「未测」，不是 0）。
 */
function computeLiveRecall(
  root: string,
  config: { version: string; samples: string[] } | undefined,
): { result: LiveRecallResult; results: LiveRecallResult[] } | null {
  if (config === undefined || config.samples.length === 0) return null;
  const results: LiveRecallResult[] = [];
  for (const slug of config.samples) {
    const file = path.join(root, 'examples', 'replay-search', slug, 'search-results.json');
    if (!fs.existsSync(file)) return null;
    const fixture = readJson<LiveRecallFixture>(file);
    results.push(measureLiveRecall(fixture, porcelainPack));
  }
  const issued = results.reduce((sum, row) => sum + row.issued, 0);
  const hit = results.reduce((sum, row) => sum + row.hit, 0);
  const calls = results.reduce((sum, row) => sum + row.calls, 0);
  return {
    result: {
      slug: config.samples.join('+'),
      issued,
      hit,
      value: issued === 0 ? null : Math.round((hit / issued) * 1000) / 10,
      calls,
      rows: results.flatMap((row) => row.rows),
      basis: 'static-self-consistency-no-fetch',
    },
    results,
  };
}

/** 把批次复制到临时目录：重算会写 verdicts / summaries / anchors，不许污染仓库里的冻结底稿 */
function copyBatchToTemp(root: string, batch: string): { dir: string; evidenceFile: string } {
  const source = path.join(root, 'examples', batch);
  const target = fs.mkdtempSync(path.join(os.tmpdir(), `ol-scorecard-${batch}-`));
  const copy = (from: string, to: string) => {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
      const src = path.join(from, entry.name);
      const dst = path.join(to, entry.name);
      if (entry.isDirectory()) copy(src, dst);
      else fs.copyFileSync(src, dst);
    }
  };
  copy(source, target);
  // 与 examples.test.ts 同一口径：重算读 evidence.jsonl；有回填产物时用回填版覆盖它，
  // 否则判据三态列（state / dimension）读不到，强记录会被算成 weak。
  const enriched = path.join(target, 'evidence.enriched.jsonl');
  const evidenceFile = fs.existsSync(enriched) ? 'evidence.enriched.jsonl' : 'evidence.jsonl';
  if (evidenceFile === 'evidence.enriched.jsonl') {
    fs.copyFileSync(enriched, path.join(target, 'evidence.jsonl'));
  }
  return { dir: target, evidenceFile };
}

interface BatchOutcome {
  batch: string;
  gates: Map<string, string>;
  anchors: Map<string, string>;
  evidenceRows: EvidenceRecord[];
  traceable: number;
  totalEvidence: number;
  claims: ClaimRecord[];
  queries: number;
}

async function evaluateBatch(root: string, batch: string): Promise<BatchOutcome> {
  const { dir, evidenceFile } = copyBatchToTemp(root, batch);
  try {
    const store = createStore({ baseDir: dir });
    const query = fs.readFileSync(path.join(dir, 'query.txt'), 'utf8').trim();
    const outcome = await retallyAndRegate({ store, query });
    const evidenceRows = readJsonl<EvidenceRecord>(path.join(dir, evidenceFile));

    let traceable = 0;
    for (const row of evidenceRows) {
      const snapshot = await readSnapshot(store, row.snapshotRef);
      if (snapshot !== null && quoteMatches(row.quote, snapshot)) traceable += 1;
    }

    // 预算口径：用引擎同一套查询构造，按记录分组算条数（离线、确定性）
    const claims = readJsonl<ClaimRecord>(path.join(dir, 'claims.jsonl'));
    const byRecord = new Map<string, ClaimRecord[]>();
    for (const claim of claims) {
      const key = claim.recordId ?? '(no-record)';
      const group = byRecord.get(key) ?? [];
      group.push(claim);
      byRecord.set(key, group);
    }
    let queries = 0;
    for (const group of byRecord.values()) {
      const first = group[0]!;
      const values: Record<string, string | null> = {};
      for (const claim of group) if (claim.fieldKey) values[claim.fieldKey] = claim.object;
      const domains = porcelainPack.evidenceDomains(
        [first.object, first.subject, ...Object.values(values).filter((value): value is string => !!value)].join(' '),
      );
      queries += buildRecordQueries({
        pack: porcelainPack,
        claims: group.map((claim) => ({
          claim,
          spec: porcelainPack.fields().find((field) => field.key === claim.fieldKey),
        })),
        values,
        domains,
        maxQueries: DEFAULT_CAPS.maxSearchCalls,
      }).length;
    }

    return {
      batch,
      gates: new Map(outcome.summaries.map((summary) => [summary.recordId, summary.gate])),
      anchors: new Map(outcome.anchors.map((anchor) => [anchor.recordId, anchor.anchorGrade])),
      evidenceRows,
      traceable,
      totalEvidence: evidenceRows.length,
      claims,
      queries,
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function percent(hit: number, total: number): number {
  return total === 0 ? 0 : Math.round((hit / total) * 1000) / 10;
}

function formatValue(metric: Metric): string {
  if (metric.value === null) return '未测';
  return metric.unit === '%' ? `${metric.value.toFixed(1)}%` : metric.value.toFixed(2);
}

function formatDelta(current: Metric, previous: number | null | undefined): string {
  if (current.value === null) return '未测';
  if (previous === null || previous === undefined) return '（无上次读数）';
  const delta = current.value - previous;
  if (Math.abs(delta) < 0.05) return '= 没变化';
  const arrow = delta > 0 ? '↑' : '↓';
  const text = current.unit === '%' ? `${Math.abs(delta).toFixed(1)} 个百分点` : Math.abs(delta).toFixed(2);
  return `${arrow} ${text}`;
}

function isRegression(metric: Metric, baselineValue: number | null | undefined): boolean {
  if (metric.value === null || baselineValue === null || baselineValue === undefined) return false;
  const delta = metric.value - baselineValue;
  const worse = metric.direction === 'up' ? -delta : delta;
  return worse > metric.threshold;
}

function currentCommit(root: string): { commit: string; date: string } {
  const gitDir = path.join(root, '.git');
  if (!fs.existsSync(gitDir)) return { commit: '未提交', date: new Date().toISOString().slice(0, 10) };
  const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
  if (head.startsWith('ref: ')) {
    const refPath = path.join(gitDir, head.slice(5));
    const loose = fs.existsSync(refPath) ? fs.readFileSync(refPath, 'utf8').trim() : null;
    if (loose) return { commit: loose.slice(0, 7), date: new Date().toISOString().slice(0, 10) };
    const packed = fs.existsSync(path.join(gitDir, 'packed-refs'))
      ? fs.readFileSync(path.join(gitDir, 'packed-refs'), 'utf8')
      : '';
    const line = packed.split(/\r?\n/).find((row) => row.endsWith(head.slice(5)));
    if (line) return { commit: line.split(' ')[0]!.slice(0, 7), date: new Date().toISOString().slice(0, 10) };
    return { commit: '未提交', date: new Date().toISOString().slice(0, 10) };
  }
  return { commit: head.slice(0, 7), date: new Date().toISOString().slice(0, 10) };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const root = args.root;
  // --root 只换考卷目录：模块是按本脚本位置相对导入的，代码不会跟着换。
  // 不做提示的话，跨提交对照会把人骗成"旧代码跑到旧读数"，实际跑的是当前代码。
  if (path.resolve(root) !== SCRIPT_ROOT) {
    console.log(`注意：--root 只更换样本目录；本次跑的是 ${path.relative(SCRIPT_ROOT, root) || root} 里的例子，代码仍取自 ${SCRIPT_ROOT}`);
  }
  const samples = readJson<SampleSet>(path.join(root, 'benchmark/samples.json'));
  const gold = readJson<Gold>(path.join(root, 'benchmark/gold.json'));
  const sampleHash = hashSample(root, samples);
  const liveRecallHash = samples.liveRecall ? hashLiveRecall(root, samples.liveRecall) : null;
  const liveRecall = computeLiveRecall(root, samples.liveRecall);

  const outcomes = new Map<string, BatchOutcome>();
  for (const batch of samples.batches) {
    outcomes.set(batch, await evaluateBatch(root, batch));
  }

  // ---- 分项一：记录门禁与人工金标准的一致率 ----
  const gateHits: string[] = [];
  const gateMisses: string[] = [];
  for (const record of gold.records) {
    const outcome = outcomes.get(record.batch);
    const gate = outcome?.gates.get(record.recordId) ?? '缺失';
    const anchor = outcome?.anchors.get(record.recordId) ?? null;
    const hit = gate === record.gate && anchor === record.anchor;
    (hit ? gateHits : gateMisses).push(
      `${record.batch}/${record.recordId}：期望 ${record.gate}/${record.anchor ?? '无坐标'}，实际 ${gate}/${anchor ?? '无坐标'}`,
    );
  }

  // ---- 分项二／三：该拒的有没有拒；该核的有没有被误拒 ----
  const negatives = gold.records.filter((record) => record.gate === 'rejected');
  const positives = gold.records.filter((record) => record.gate !== 'rejected');
  const negativeHits = negatives.filter((record) => {
    const outcome = outcomes.get(record.batch);
    return outcome?.gates.get(record.recordId) === 'rejected' && !outcome?.anchors.has(record.recordId);
  });
  // 「误拒」只算被整条拒收的；档位降级（strong→weak）由上一项的严格一致率抓，不在这项重复扣分
  const positiveHits = positives.filter((record) => {
    const outcome = outcomes.get(record.batch);
    const gate = outcome?.gates.get(record.recordId);
    return gate !== undefined && gate !== 'rejected' && (outcome?.anchors.has(record.recordId) ?? false);
  });
  const falseRejects = positives.filter((record) => outcomes.get(record.batch)?.gates.get(record.recordId) === 'rejected');

  // ---- 分项四：可追溯率（引文能否逐字回链） ----
  let traceable = 0;
  let evidenceTotal = 0;
  for (const outcome of outcomes.values()) {
    traceable += outcome.traceable;
    evidenceTotal += outcome.totalEvidence;
  }

  // ---- 分项五：每条断言构造的检索条数（预算口径） ----
  const totalQueries = [...outcomes.values()].reduce((sum, outcome) => sum + outcome.queries, 0);
  const totalClaims = [...outcomes.values()].reduce((sum, outcome) => sum + outcome.claims.length, 0);

  const metrics: Metric[] = [
    {
      key: 'gateAgreement',
      label: '门禁与人工金标准一致率',
      value: percent(gateHits.length, gold.records.length),
      display: `${gateHits.length}/${gold.records.length}`,
      unit: '%',
      direction: 'up',
      threshold: 0,
      detail: gateMisses.length === 0 ? '全部一致' : gateMisses.join('；'),
      meaning: '变差意味着：该出坐标的记录被拒、或该拒的被放进坐标库——用户会看到一条站不住的行情。',
    },
    {
      key: 'negativeRejection',
      label: '该拒的有没有拒',
      value: percent(negativeHits.length, negatives.length),
      display: `${negativeHits.length}/${negatives.length}`,
      unit: '%',
      direction: 'up',
      threshold: 0,
      detail: negatives
        .map((record) => `${record.recordId}：${outcomes.get(record.batch)?.gates.get(record.recordId) ?? '缺失'}`)
        .join('；'),
      meaning: '变差意味着：注入的假日期、不存在的专场没有被拦住，错误记录会进坐标库。',
    },
    {
      key: 'positiveNotFalselyRejected',
      label: '该核的有没有被误拒',
      value: percent(positiveHits.length, positives.length),
      display: `${positiveHits.length}/${positives.length}`,
      unit: '%',
      direction: 'up',
      threshold: 0,
      detail:
        falseRejects.length === 0
          ? '没有误拒'
          : `误拒：${falseRejects.map((record) => `${record.batch}/${record.recordId}`).join('、')}`,
      meaning: '变差意味着：证据齐全的真记录被当成假记录丢掉——这是最贵的一种错，用户会失去本来能用的行情。',
    },
    {
      key: 'traceability',
      label: '可追溯率（引文逐字回链）',
      value: percent(traceable, evidenceTotal),
      display: `${traceable}/${evidenceTotal}`,
      unit: '%',
      direction: 'up',
      threshold: 0,
      detail: '每条证据的引文必须逐字出现在它自己的页面快照里',
      meaning: '变差意味着：结论里的引文在页面上找不到原文，用户没法核对，整条证据链失去意义。',
    },
    {
      key: 'liveRecall',
      label: '在线召回率（可裁真页）',
      value: liveRecall?.result.value ?? null,
      display: liveRecall === null ? '未测' : `${liveRecall.result.hit}/${liveRecall.result.issued}`,
      unit: '%',
      direction: 'up',
      threshold: 0,
      detail:
        liveRecall === null
          ? '未配置冻结检索样本（benchmark/samples.json 缺 liveRecall），本项未测'
          : `${liveRecall.results
              .map((row) => `${row.slug} ${row.hit}/${row.issued}`)
              .join('；')}；实际发出 ${liveRecall.result.calls} 条查询` +
            '；判据=静态自洽（通过候选过滤且摘要含本场关键值），不抓页、不核逐字引用',
      meaning: '变差意味着：同样的问题在线越来越捞不到能裁的页面——判据再准，没有页面可裁也只能判 not_found。',
    },
    {
      key: 'retrievalQueriesPerClaim',
      label: '每条断言的构造检索条数',
      value: totalClaims === 0 ? null : Math.round((totalQueries / totalClaims) * 100) / 100,
      display: `${totalQueries} 条查询 / ${totalClaims} 条断言`,
      unit: '条',
      direction: 'down',
      threshold: 0.1,
      detail: `预算口径（按引擎的查询构造离线复算，不含翻译轨加成）；上限 ${DEFAULT_CAPS.maxSearchCalls} 条/记录`,
      meaning: '变差意味着：同一条断言要花更多检索——成本上升；注意条数下降也可能是覆盖变窄，需看门禁一致率是否同步掉。',
    },
  ];

  // 未测项：明确列出，不显示 0
  for (const unmeasured of gold.unmeasured) {
    metrics.push({
      key: unmeasured.key,
      label: unmeasured.label,
      value: null,
      display: '未测',
      unit: '%',
      direction: unmeasured.direction,
      threshold: Number.POSITIVE_INFINITY,
      detail: unmeasured.reason,
      meaning: unmeasured.meaning,
    });
  }

  // ---- 基线 / 历史 ----
  const baselinePath = path.join(root, 'benchmark/baseline.json');
  const historyPath = path.join(root, 'benchmark/history.jsonl');
  const baseline: HistoryRow | null = fs.existsSync(baselinePath) ? readJson<HistoryRow>(baselinePath) : null;
  const history = readJsonl<HistoryRow>(historyPath);
  const previous = history.at(-1) ?? null;
  const meta = args.commit !== null ? { commit: args.commit, date: new Date().toISOString().slice(0, 10) } : currentCommit(root);

  const sampleChanged = baseline !== null && baseline.sampleHash !== sampleHash;
  const liveRecallSampleChanged =
    baseline !== null &&
    liveRecallHash !== null &&
    baseline.liveRecallSampleHash !== undefined &&
    baseline.liveRecallSampleHash !== liveRecallHash;
  const warnings = metrics
    .filter((metric) => isRegression(metric, baseline?.metrics[metric.key]))
    .map((metric) => `⚠ 退步：${metric.label}`);

  console.log('== OpenLodestar 评分卡（离线，零外部调用） ==');
  console.log(`样本集 ${samples.version} · ${samples.batches.length} 批 / ${totalClaims} 条断言 / ${evidenceTotal} 条证据`);
  console.log(
    `样本锁 sha256:${sampleHash.slice(0, 16)}…${sampleChanged ? `（与基线不同：基线 ${baseline!.sampleHash.slice(0, 16)}…，换考卷后读数不可直接比较）` : '（与基线一致）'}`,
  );
  if (samples.liveRecall && liveRecallHash !== null) {
    console.log(
      `检索样本 ${samples.liveRecall.version} · ${samples.liveRecall.samples.join(' / ')} · sha256:${liveRecallHash.slice(0, 16)}…` +
        (liveRecallSampleChanged ? `（与基线不同：基线 ${baseline!.liveRecallSampleHash!.slice(0, 16)}…）` : ''),
    );
  } else {
    console.log('检索样本：未配置（在线召回率显示「未测」）');
  }
  console.log(`提交 ${meta.commit} · ${meta.date}`);
  console.log('');
  console.log('分项                          当前                    基线      方向  说明');
  for (const metric of metrics) {
    const baselineValue = baseline?.metrics[metric.key];
    const baselineDisplay =
      metric.value === null || baselineValue === null || baselineValue === undefined
        ? '—'
        : metric.unit === '%'
          ? `${Number(baselineValue).toFixed(1)}%`
          : Number(baselineValue).toFixed(2);
    const currentDisplay =
      metric.value === null ? '未测' : `${formatValue(metric)}（${metric.display}）`;
    console.log(
      `${metric.label.padEnd(24, ' ')} ${currentDisplay.padEnd(22, ' ')} ${baselineDisplay.padEnd(8, ' ')} ` +
        `${metric.direction === 'up' ? '↑越高越好' : '↓越低越好'}  ${metric.detail}`,
    );
  }
  console.log('');
  console.log('总分：不设。各分项方向不同，硬合成等于先假定「一条误拒等于几次白花检索」，这个换算站不住。');
  console.log('');

  if (previous !== null) {
    console.log(`与上一次（${previous.commit} · ${previous.date}）比：`);
    for (const metric of metrics) {
      console.log(`  ${metric.label.padEnd(24, ' ')} ${formatDelta(metric, previous.metrics[metric.key])}`);
    }
  } else {
    console.log('历史表为空：这是第一次记分。');
  }
  if (warnings.length > 0) {
    console.log('');
    for (const warning of warnings) console.log(warning);
  }

  // ---- 写基线 / 历史（重跑同分时不重复追加） ----
  const row: HistoryRow = {
    commit: meta.commit,
    date: meta.date,
    recordedAt: new Date().toISOString(),
    sampleVersion: samples.version,
    sampleHash,
    ...(samples.liveRecall && liveRecallHash !== null
      ? {
          liveRecallSampleVersion: samples.liveRecall.version,
          liveRecallSampleHash: liveRecallHash,
        }
      : {}),
    metrics: Object.fromEntries(metrics.map((metric) => [metric.key, metric.value])),
  };
  if (args.updateBaseline) {
    fs.writeFileSync(baselinePath, `${JSON.stringify(row, null, 2)}\n`, 'utf8');
    console.log(`\n基线已更新：${path.relative(root, baselinePath)}（样本锁 ${sampleHash.slice(0, 16)}…）`);
  }
  if (args.writeHistory) {
    const sameAsLast =
      previous !== null &&
      previous.commit === row.commit &&
      previous.sampleHash === row.sampleHash &&
      previous.liveRecallSampleHash === row.liveRecallSampleHash &&
      JSON.stringify(previous.metrics) === JSON.stringify(row.metrics);
    if (sameAsLast) {
      console.log('历史表已有同一组读数，未重复追加。');
    } else {
      fs.appendFileSync(historyPath, `${JSON.stringify(row)}\n`, 'utf8');
      console.log(`历史表追加一行：${path.relative(root, historyPath)}`);
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
