#!/usr/bin/env tsx
// src/cli.ts
/**
 * OpenLodestar 命令行入口（本地工具，不进服务进程）
 *
 * 三个命令都只在本地读写底稿，**不触网**：
 * - demo：把示例底稿复制到工作目录，按现存证据重算裁决与记录门禁（零模型调用），
 *   同时跑一遍引文硬校验——用来看清"证据 → 裁决 → 坐标"的完整形状；
 * - verify-quotes：引文逐字命中自家快照 + 引文写到所裁字段（一票否决的硬护栏）；
 * - audit：底稿结构完整性（主键引用、快照存在、强坐标的共现页是否仍成立）。
 *
 * 退出码：0 = 通过；1 = 有违规或执行失败。没有底稿不构成失败（空底稿不是作弊）。
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore, type LodestarStore } from './lodestar/storage/adapter';
import { retallyAndRegate } from './lodestar/engine';
import { findCooccurringUrls } from './lodestar/record-gate/cooccurrence';
import { isReadableAnchor } from './lodestar/anchor-source';
import { parseDemoCase, renderDemoReport, type DemoCase } from './demo-report';
import { inspectEvidence, printEvidenceCheck } from './lodestar/evidence-check';
import { commandLive, liveUsage } from './live';
import porcelainPack from './lodestar/packs/porcelain';
import type {
  AnchorRecord,
  ClaimRecord,
  EvidenceRecord,
  RecordSummary,
  VerdictRecord,
} from './lodestar/types';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
/** 包根（src/cli.ts → 上一级） */
const PACKAGE_ROOT = path.resolve(MODULE_DIR, '..');

const USAGE = `OpenLodestar CLI

Usage:
  tsx src/cli.ts demo            [--example <name>] [--workdir <dir>] [--report <file>] [--limit <n>]
  tsx src/cli.ts verify-quotes   [--data <dir>] [--claim <claimId>] [--limit <n>]
  tsx src/cli.ts audit           [--data <dir>] [--limit <n>]
${liveUsage()}

Commands:
  demo            Recompute verdicts / record gates / anchors from a bundled
                  example ledger (no model or network calls), then verify every
                  quote against its own snapshot. Optionally write a standalone
                  HTML report.
  live            Run the engine against live search and pages. Modes:
                  pages (re-fetch frozen source pages only), replay (submit the
                  frozen claims again), full (elicit from the query), both.
                  Output goes to .openlodestar-demo/live/<runId>/<mode>/.
  verify-quotes   Hard guard: every evidence quote must appear verbatim in that
                  row's own snapshot and must mention the field it was cited for.
  audit           Check ledger integrity: primary-key references, snapshot files,
                  claim-id derivation, and whether strong anchors still co-occur.

Options:
  --example <n>   Example directory under <package>/examples (default: porcelain).
  --data <dir>    Ledger directory (default: <package>/lodestar or OPENLODESTAR_DATA_DIR).
  --workdir <dir> Demo working copy (default: <package>/.openlodestar-demo,
                  or .openlodestar-demo/<example> for non-default examples).
  --report <file> Write a self-contained HTML report (default: <workdir>/demo-report.html).
  --claim <id>    Restrict verify-quotes to one claim.
  --limit <n>     Maximum violations to print (default: 20).
`;

// ============================================
// 通用
// ============================================

interface ParsedArgs {
  command: string;
  flags: Map<string, string>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command = '', ...rest] = argv;
  const flags = new Map<string, string>();
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i] ?? '';
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = rest[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags.set(key, next);
      i += 1;
    } else {
      flags.set(key, 'true');
    }
  }
  return { command, flags };
}

function storeFor(flags: Map<string, string>): LodestarStore {
  const data = flags.get('data');
  return data ? createStore({ baseDir: path.resolve(data) }) : createStore();
}

function limitOf(flags: Map<string, string>): number {
  const raw = Number(flags.get('limit'));
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 20;
}

function bucketFor<K, V>(map: Map<K, V[]>, key: K): V[] {
  const existing = map.get(key);
  if (existing) return existing;
  const created: V[] = [];
  map.set(key, created);
  return created;
}

/** 共现判定与坐标来源比对使用同一套 URL 规范化（去 hash、尾斜杠、大小写） */
function normalizeUrlForCompare(url: string): string {
  const withoutHash = url.split('#')[0] ?? '';
  return withoutHash.replace(/\/+$/, '').toLowerCase();
}

async function copyDir(from: string, to: string): Promise<void> {
  await fs.mkdir(to, { recursive: true });
  for (const entry of await fs.readdir(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) await copyDir(source, target);
    else await fs.copyFile(source, target);
  }
}

// ============================================
// demo
// ============================================

/** `case.json` 是可选的案例卡；读不懂就退回通用报告，不让演示因文案文件坏掉 */
async function loadDemoCase(exampleDir: string): Promise<DemoCase | null> {
  try {
    const raw = await fs.readFile(path.join(exampleDir, 'case.json'), 'utf8');
    const parsed = parseDemoCase(JSON.parse(raw) as unknown);
    if (parsed === null) {
      console.warn('Warning: case.json failed validation; the HTML report will use generic copy.');
    }
    return parsed;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      console.warn(`Warning: could not read case.json (${error instanceof Error ? error.message : String(error)})`);
    }
    return null;
  }
}

async function commandDemo(flags: Map<string, string>): Promise<number> {
  const exampleName = flags.get('example') ?? 'porcelain';
  if (!/^[a-z0-9][a-z0-9-]*$/.test(exampleName)) {
    console.error(`Invalid --example "${exampleName}": use lowercase letters, digits and dashes.`);
    return 1;
  }
  const exampleDir = path.resolve(PACKAGE_ROOT, 'examples', exampleName);
  const defaultWorkDir =
    exampleName === 'porcelain'
      ? path.join(PACKAGE_ROOT, '.openlodestar-demo')
      : path.join(PACKAGE_ROOT, '.openlodestar-demo', exampleName);
  const workDir = path.resolve(flags.get('workdir') ?? defaultWorkDir);
  const limit = limitOf(flags);

  try {
    await fs.access(path.join(exampleDir, 'claims.jsonl'));
  } catch {
    console.error(`Example not found: examples/${exampleName} (missing claims.jsonl)`);
    return 1;
  }

  await fs.rm(workDir, { recursive: true, force: true });
  await fs.mkdir(workDir, { recursive: true });
  for (const file of ['claims.jsonl', 'evidence.jsonl', 'query.txt']) {
    await fs.copyFile(path.join(exampleDir, file), path.join(workDir, file));
  }
  await copyDir(path.join(exampleDir, 'snapshots'), path.join(workDir, 'snapshots'));
  const query = (await fs.readFile(path.join(workDir, 'query.txt'), 'utf8')).trim();

  const store = createStore({ baseDir: workDir });
  const claimsBefore = await store.query<ClaimRecord>('claims');
  const evidence = await store.allRows<EvidenceRecord>('evidence');
  const claimById = new Map(claimsBefore.map((claim) => [claim.claimId, claim]));
  // 只数正文快照；目录里的 manifest.json 等说明文件不算一份快照
  const snapshotFiles = (await fs.readdir(path.join(workDir, 'snapshots'))).filter((name) =>
    name.endsWith('.txt'),
  );

  console.log('OpenLodestar demo — offline, no model or search calls');
  console.log(`Fixture: ${path.relative(process.cwd(), exampleDir)}`);
  console.log(`Working copy: ${path.relative(process.cwd(), workDir)}`);
  console.log(`Ledger: ${claimsBefore.length} claims, ${evidence.length} evidence rows, ${snapshotFiles.length} snapshots`);
  console.log(`Query: ${query}\n`);

  const outcome = await retallyAndRegate({
    store,
    query,
    note: 'demo: 从示例底稿的全部证据重算，未新增检索与抓取',
  });

  // 状态推进同样是追加行（底稿不可改写），与引擎在线路径一致
  const verdictByClaim = new Map(outcome.verdicts.map((verdict) => [verdict.claimId, verdict]));
  for (const claim of claimsBefore) {
    if (claim.state !== 'adjudicated' && verdictByClaim.has(claim.claimId)) {
      await store.patch('claims', claim.claimId, { state: 'adjudicated' });
    }
  }

  console.log('Verdicts (recomputed from evidence):');
  for (const claim of [...claimsBefore].sort((a, b) => a.claimId.localeCompare(b.claimId))) {
    const verdict = verdictByClaim.get(claim.claimId);
    if (!verdict) {
      console.log(`  ${claim.claimId}  no verdict`);
      continue;
    }
    console.log(
      `  ${claim.claimId}  ${verdict.verdict.padEnd(11)} ${verdict.evidenceGrade}  ` +
        `support=${verdict.supportCount} refute=${verdict.refuteCount}`,
    );
  }

  console.log('\nRecords (co-occurrence gate):');
  for (const summary of [...outcome.summaries].sort((a, b) => a.recordId.localeCompare(b.recordId))) {
    console.log(`  ${summary.recordId}  ${summary.gate.padEnd(8)}  ${summary.reason}`);
  }

  console.log('\nAnchors:');
  for (const anchor of [...outcome.anchors].sort((a, b) => a.recordId.localeCompare(b.recordId))) {
    console.log(
      `  ${anchor.recordId}  ${anchor.anchorGrade.padEnd(6)} ${anchor.evidenceGrade}  ` +
        `sourceUrls=${anchor.sourceUrls.length}  fields=${Object.keys(anchor.fields).length}`,
    );
    for (const url of anchor.sourceUrls) console.log(`    - ${url}`);
  }
  const readable = outcome.anchors.filter((anchor) => isReadableAnchor(anchor)).length;
  console.log(`  Readable anchors (strong and not stale): ${readable}/${outcome.anchors.length}`);

  const check = await inspectEvidence(store, evidence, claimById, porcelainPack);
  console.log('\nQuote hard guard:');
  printEvidenceCheck(check, limit);

  const reportFlag = flags.get('report');
  if (reportFlag !== undefined) {
    const reportPath = reportFlag === 'true'
      ? path.join(workDir, 'demo-report.html')
      : path.resolve(reportFlag);
    const caseMeta = await loadDemoCase(exampleDir);
    const html = renderDemoReport({
      exampleName,
      fixtureDir: exampleDir,
      workDir,
      query,
      caseMeta,
      fields: porcelainPack.fields().map((field) => ({ key: field.key, label: field.label, role: field.role })),
      claims: claimsBefore,
      evidence,
      verdicts: outcome.verdicts,
      summaries: outcome.summaries,
      anchors: outcome.anchors,
      guard: check,
      generatedAt: new Date().toISOString(),
    });
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, html, 'utf8');
    console.log(`\nHTML report: ${path.relative(process.cwd(), reportPath)}`);
  }

  console.log(`\nWrote verdicts/records/anchors to: ${workDir}`);
  console.log(`Re-run: npx tsx src/cli.ts demo --example ${exampleName} (working copy is reset on every run)`);

  return check.violations.length > 0 ? 1 : 0;
}

// ============================================
// verify-quotes
// ============================================

async function commandVerifyQuotes(flags: Map<string, string>): Promise<number> {
  const store = storeFor(flags);
  const limit = limitOf(flags);
  const claimFilter = flags.get('claim');
  const all = await store.allRows<EvidenceRecord>('evidence');
  const rows = claimFilter ? all.filter((row) => row.claimId === claimFilter) : all;

  if (rows.length === 0) {
    console.log('No evidence rows to verify (empty ledger or no match for --claim).');
    console.log('An empty ledger is not a failure. Run `pnpm run demo` first if you want data to check.');
    return 0;
  }

  const claims = await store.query<ClaimRecord>('claims');
  const claimById = new Map(claims.map((claim) => [claim.claimId, claim]));
  const check = await inspectEvidence(store, rows, claimById, porcelainPack);
  printEvidenceCheck(check, limit);

  if (check.violations.length > 0) {
    console.log('\nHard guard FAILED: fix fetching or comparison, do not bypass it by tuning.');
    return 1;
  }
  console.log('\nHard guard passed: every quote is verbatim in its own snapshot and mentions the field it supports.');
  return 0;
}

// ============================================
// audit
// ============================================

interface AuditViolation {
  category: string;
  id: string;
  reason: string;
}

const VERDICT_VALUES = new Set(['supported', 'refuted', 'conflicting', 'not_found']);
const GRADE_VALUES = new Set(['E0', 'E1', 'E2', 'E3']);
const GATE_VALUES = new Set(['strong', 'weak', 'rejected']);
const ANCHOR_GRADE_VALUES = new Set(['strong', 'weak']);

async function commandAudit(flags: Map<string, string>): Promise<number> {
  const store = storeFor(flags);
  const limit = limitOf(flags);
  const claims = await store.query<ClaimRecord>('claims');
  const evidence = await store.allRows<EvidenceRecord>('evidence');
  const verdicts = await store.query<VerdictRecord>('verdicts');
  const summaries = await store.query<RecordSummary>('records');
  const anchors = await store.query<AnchorRecord>('anchors');
  const answers = await store.query('answers');

  const claimById = new Map(claims.map((claim) => [claim.claimId, claim]));
  const evidenceIds = new Set(evidence.map((row) => row.evidenceId));
  const packFieldKeys = new Set(porcelainPack.fields().map((field) => field.key));
  const evidenceByClaim = new Map<string, EvidenceRecord[]>();
  for (const row of evidence) bucketFor(evidenceByClaim, row.claimId).push(row);

  console.log(`Ledger: ${store.fileStore.dataDir}`);
  console.log(
    `  claims=${claims.length} evidence=${evidence.length} verdicts=${verdicts.length} ` +
      `records=${summaries.length} anchors=${anchors.length} answers=${answers.length}\n`,
  );

  const violations: AuditViolation[] = [];
  const add = (category: string, id: string, reason: string): void => {
    violations.push({ category, id, reason });
  };

  // ---- claims ----
  for (const claim of claims) {
    if (claim.fieldKey !== null && !packFieldKeys.has(claim.fieldKey)) {
      add('claims', claim.claimId, `未知字段键 ${claim.fieldKey}（策略包没有这个字段）`);
    }
    if (claim.recordId !== null && claim.fieldKey !== null) {
      const expected = `cl-${claim.recordId}-${claim.fieldKey}`;
      if (claim.claimId !== expected) {
        add('claims', claim.claimId, `记录字段断言的主键不是按记录+字段派生（应为 ${expected}）`);
      }
    }
    if (typeof claim.atomicText !== 'string' || claim.atomicText.trim() === '') {
      add('claims', claim.claimId, 'atomicText 为空');
    }
  }

  // ---- evidence ----
  const check = await inspectEvidence(store, evidence, claimById, porcelainPack);
  for (const violation of check.violations) {
    add('evidence', violation.evidenceId, violation.reason);
  }
  for (const row of evidence) {
    if (!claimById.has(row.claimId)) {
      add('evidence', row.evidenceId, `claim=${row.claimId} 在 claims 底稿里不存在`);
    }
    const host = safeHostname(row.url);
    if (host !== null && host !== row.domain.toLowerCase()) {
      add('evidence', row.evidenceId, `domain=${row.domain} 与 url 主机 ${host} 不一致`);
    }
    if (row.relation !== 'supports' && row.relation !== 'refutes' && row.relation !== 'irrelevant') {
      add('evidence', row.evidenceId, `relation 非法：${String(row.relation)}`);
    }
  }

  // ---- verdicts ----
  for (const verdict of verdicts) {
    if (!claimById.has(verdict.claimId)) {
      add('verdicts', verdict.claimId, '关联的断言在 claims 底稿里不存在');
    }
    if (!VERDICT_VALUES.has(verdict.verdict)) {
      add('verdicts', verdict.claimId, `verdict 非法：${String(verdict.verdict)}`);
    }
    if (!GRADE_VALUES.has(verdict.evidenceGrade)) {
      add('verdicts', verdict.claimId, `evidenceGrade 非法：${String(verdict.evidenceGrade)}`);
    }
    if (typeof verdict.traceId !== 'string' || verdict.traceId.trim() === '') {
      add('verdicts', verdict.claimId, 'traceId 为空（没有底稿的结论不落库）');
    }
    if (
      typeof verdict.supportCount !== 'number' ||
      verdict.supportCount < 0 ||
      typeof verdict.refuteCount !== 'number' ||
      verdict.refuteCount < 0
    ) {
      add('verdicts', verdict.claimId, 'supportCount/refuteCount 不是非负数字');
    }
    const footprint = verdict.footprint;
    if (
      !footprint ||
      !Array.isArray(footprint.queries) ||
      !Array.isArray(footprint.candidates) ||
      !Array.isArray(footprint.fetched) ||
      !Array.isArray(footprint.failed) ||
      !Array.isArray(footprint.rejected) ||
      typeof footprint.candidatesCovered !== 'boolean'
    ) {
      add('verdicts', verdict.claimId, '检索足迹缺失或结构不完整');
    }
  }

  // ---- records ----
  const summaryById = new Map(summaries.map((summary) => [summary.recordId, summary]));
  for (const summary of summaries) {
    if (!GATE_VALUES.has(summary.gate)) {
      add('records', summary.recordId, `gate 非法：${String(summary.gate)}`);
    }
    for (const claimId of [...summary.fieldClaimIds, ...summary.keyClaimIds]) {
      if (!claimById.has(claimId)) add('records', summary.recordId, `引用的断言 ${claimId} 不存在`);
    }
    for (const keyClaimId of summary.keyClaimIds) {
      if (!summary.fieldClaimIds.includes(keyClaimId)) {
        add('records', summary.recordId, `关键字段断言 ${keyClaimId} 不在 fieldClaimIds 里`);
      }
    }
    for (const evidenceId of summary.cooccurringEvidenceIds) {
      if (!evidenceIds.has(evidenceId)) {
        add('records', summary.recordId, `共现证据 ${evidenceId} 在 evidence 底稿里不存在`);
      }
    }
    if (summary.gate === 'strong' && summary.cooccurringEvidenceIds.length === 0) {
      add('records', summary.recordId, '强档记录没有任何共现证据行');
    }
  }

  // ---- anchors ----
  for (const anchor of anchors) {
    if (!ANCHOR_GRADE_VALUES.has(anchor.anchorGrade)) {
      add('anchors', anchor.recordId, `anchorGrade 非法：${String(anchor.anchorGrade)}`);
    }
    if (!GRADE_VALUES.has(anchor.evidenceGrade)) {
      add('anchors', anchor.recordId, `evidenceGrade 非法：${String(anchor.evidenceGrade)}`);
    }
    if (typeof anchor.traceId !== 'string' || anchor.traceId.trim() === '') {
      add('anchors', anchor.recordId, 'traceId 为空（没有底稿的坐标不落库）');
    }
    if (!Array.isArray(anchor.sourceUrls) || anchor.sourceUrls.length === 0) {
      add('anchors', anchor.recordId, 'sourceUrls 为空（坐标至少要带一页通过验收的证据）');
    }
    if (typeof anchor.stale !== 'boolean') {
      add('anchors', anchor.recordId, 'stale 不是布尔值');
    }
    const summary = summaryById.get(anchor.recordId);
    if (!summary) {
      add('anchors', anchor.recordId, '对应的记录汇总在 records 底稿里不存在');
      continue;
    }
    if (anchor.anchorGrade === 'strong') {
      const cooccurring = new Set(findCooccurringUrls(summary.keyClaimIds, evidenceByClaim));
      for (const url of anchor.sourceUrls) {
        if (!cooccurring.has(normalizeUrlForCompare(url))) {
          add('anchors', anchor.recordId, `强坐标来源 ${url} 在现有证据里没有共现命中（坐标已过期或来路不对）`);
        }
      }
    } else {
      const supported = new Set<string>();
      for (const claimId of summary.keyClaimIds) {
        for (const row of evidenceByClaim.get(claimId) ?? []) {
          if (row.relation === 'supports' && row.quote.trim() !== '') {
            supported.add(normalizeUrlForCompare(row.url));
          }
        }
      }
      for (const url of anchor.sourceUrls) {
        if (!supported.has(normalizeUrlForCompare(url))) {
          add('anchors', anchor.recordId, `弱坐标来源 ${url} 不在关键字段的支撑页并集里`);
        }
      }
    }
  }

  // ---- answers ----
  for (const answer of answers) {
    const row = answer as { answerId?: unknown; queryId?: unknown };
    if (typeof row.answerId !== 'string' || row.answerId.trim() === '') {
      add('answers', '(unknown)', 'answerId 为空');
    }
    if (typeof row.queryId !== 'string' || row.queryId.trim() === '') {
      add('answers', String(row.answerId ?? '(unknown)'), 'queryId 为空');
    }
  }

  if (violations.length === 0) {
    console.log('Ledger integrity: OK (references, snapshots, quote provenance, anchor co-occurrence).');
    return 0;
  }

  console.log(`Ledger integrity: ${violations.length} violation(s)`);
  for (const violation of violations.slice(0, limit)) {
    console.log(`\n  x [${violation.category}] ${violation.id}`);
    console.log(`    ${violation.reason}`);
  }
  if (violations.length > limit) {
    console.log(`\n  ... ${violations.length - limit} more violation(s) not printed (use --limit).`);
  }
  return 1;
}

function safeHostname(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

// ============================================
// 入口
// ============================================

async function main(argv: string[]): Promise<number> {
  const { command, flags } = parseArgs(argv);
  if (command === '' || command === '--help' || command === 'help') {
    console.log(USAGE);
    return 0;
  }
  switch (command) {
    case 'demo':
      return commandDemo(flags);
    case 'verify-quotes':
      return commandVerifyQuotes(flags);
    case 'audit':
      return commandAudit(flags);
    case 'live':
      return commandLive(flags);
    default:
      console.error(`Unknown command: ${command}\n`);
      console.log(USAGE);
      return 1;
  }
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error('Failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
