// src/demo-page/build-demo-data.ts
/**
 * 把冻结批次渲染成站点用的 `docs/assets/demo-data.js`（`window.LODESTAR_DEMO = {...}`）。
 *
 * 为什么在构建时算完、页面只做切换：
 * 页面要显示的判定（计票、门禁、坐标）必须是**引擎当场算出来的那一份**，而不是页面另写一套
 * 近似规则。这里直接调 `retallyAndRegate`（与 `demo` 命令同一条通路），把结果冻结进数据文件；
 * 页面只按记录切换展示，不重算判定，所以不存在"页面规则与引擎漂移"的可能。
 *
 * 数据里同时保住两件事，缺一不可：
 * 1. 每条证据行带着**构建时断言的字段值**（`fieldValue`），页面按"记录号 + 字段名 + 字段值"匹配；
 * 2. 每个字段的判定也带着当时参与计算的字段值，值变了就整条按"这批证据没覆盖"处理。
 * 证据按断言编号挂靠、编号里没有字段值——不补这一列，字段值一改就会继承旧证据。
 *
 * 唯一真源是 `examples/<批次>/`；本脚本只读它、只写生成物，不进版本库的中间产物。
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { retallyAndRegate } from '../lodestar/engine';
import { gradeRecordDimensions, pickSupportDimensionState } from '../lodestar/dimensions';
import porcelainPack from '../lodestar/packs/porcelain';
import { createStore } from '../lodestar/storage/adapter';
import type {
  AnchorRecord,
  ClaimRecord,
  EvidenceDimensionState,
  EvidenceRecord,
  FieldRole,
  RecordSummary,
  VerdictRecord,
} from '../lodestar/types';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(MODULE_DIR, '../..');
const EXAMPLES_DIR = path.join(PACKAGE_ROOT, 'examples');
const OUTPUT_PATH = path.join(PACKAGE_ROOT, 'docs', 'assets', 'demo-data.js');

/** 演示只收真实案例：合成契约底稿（porcelain）观众回不了原页，不进演示 */
const FIXED_EXAMPLES = ['poly-2021-autumn'];

export interface DemoFieldValue {
  key: string;
  label: string;
  role: FieldRole;
  value: string;
}

export interface DemoFieldVerdict {
  fieldValue: string;
  claimId: string;
  verdict: VerdictRecord['verdict'];
  evidenceGrade: VerdictRecord['evidenceGrade'];
  supportCount: number;
  refuteCount: number;
  notFoundCause: string | null;
  /** 这条断言实际比对过的页面数（按证据行里的不同 URL 计） */
  examinedPages: number;
  /**
   * 该字段的判据状态，只从「支持」的证据行里取。
   * null 表示这条断言没有任何「支持」行 —— 页面不显示判据，免得把无关页的状态挂在字段旁边。
   */
  dimensionState: EvidenceDimensionState | null;
}

export interface DemoEvidenceRow {
  evidenceId: string;
  fieldKey: string;
  /** 构建时这条断言写的字段值；页面按它做匹配，值不相等就当没有这条证据 */
  fieldValue: string;
  relation: EvidenceRecord['relation'];
  quote: string;
  url: string;
  domain: string;
  family: string;
  tier: EvidenceRecord['tier'];
  snapshotFile: string;
  /** 这次抓取的时间（底稿 evidence.jsonl 的 fetchedAt）：证据卡上要能写出"何时抓的" */
  fetchedAt: string;
  note: string | null;
  /** 判据维度（形如 porcelain:dateText）；老证据没有这一列 → null */
  dimension: string | null;
  /** 该证据在本维度上的状态；老证据缺列 → unknown */
  state: EvidenceDimensionState;
  /** 页面里逐字摘出的原文值；老证据没有这一列 → null */
  matchedValue: string | null;
}

export interface DemoSource {
  url: string;
  publisher: string;
  family: string;
  tier: EvidenceRecord['tier'];
  snapshotFile: string;
  excerpt: string;
}

export interface DemoRecord {
  recordId: string;
  caseId: string;
  title: string;
  bucket: 'strong' | 'weak' | 'refuted' | 'not_found';
  fields: DemoFieldValue[];
  evidence: DemoEvidenceRow[];
  computation: {
    gate: RecordSummary['gate'];
    reason: string;
    fieldVerdicts: Record<string, DemoFieldVerdict>;
    keyFieldValues: Record<string, string>;
    cooccurrence: { count: number; pages: string[] };
    /** 判据维度汇总：分数、依据、冲突候选 */
    dimensionGrade: {
      grade: 'strong' | 'weak';
      score: number;
      basis: string;
      conflictDimensions: string[];
      entries: Array<{ dimension: string; label: string; state: EvidenceDimensionState; cap: number }>;
    };
    anchor: {
      grade: AnchorRecord['anchorGrade'];
      evidenceGrade: AnchorRecord['evidenceGrade'];
      urls: string[];
      searchPhrases: string[];
      stale: boolean;
    } | null;
  };
}

export interface DemoCaseData {
  id: string;
  title: string;
  subtitle: string;
  query: string;
  capturedAt: string;
  sources: DemoSource[];
  records: DemoRecord[];
}

export interface DemoData {
  generatedAt: string;
  generator: string;
  note: string;
  fields: Array<{ key: string; label: string; role: FieldRole }>;
  buckets: Record<DemoRecord['bucket'], number>;
  cases: DemoCaseData[];
}

async function readJsonl<T>(file: string): Promise<T[]> {
  const raw = await fs.readFile(file, 'utf8');
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line) as T);
}

async function copyIfExists(from: string, to: string): Promise<void> {
  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.copyFile(from, to);
}

// 冻结快照本身已经是"含引文的段落 + 上下文"、每页 ≤2000 字符，直接整段展示；
// 不再二次裁剪——再裁一次就可能把后面的引文切掉，页面显示的证据卡就自相矛盾。

interface CaseMeta {
  title?: string;
  subtitle?: string;
  capturedAt?: string;
  sources?: Array<{ url?: string; publisher?: string; family?: string }>;
}

async function readCaseMeta(exampleDir: string): Promise<CaseMeta | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(exampleDir, 'case.json'), 'utf8')) as CaseMeta;
  } catch {
    return null;
  }
}

function bucketOf(summary: RecordSummary, verdicts: Map<string, VerdictRecord>): DemoRecord['bucket'] {
  if (summary.gate === 'strong') return 'strong';
  if (summary.gate === 'weak') return 'weak';
  const keyVerdicts = summary.keyClaimIds.map((claimId) => verdicts.get(claimId)).filter((v) => v !== undefined);
  const refuted = keyVerdicts.some((v) => v.verdict === 'refuted' || v.verdict === 'conflicting');
  return refuted ? 'refuted' : 'not_found';
}

function recordTitle(fields: DemoFieldValue[], recordId: string): string {
  const byKey = new Map(fields.map((field) => [field.key, field.value]));
  const house = byKey.get('auctionHouse') ?? '';
  const session = byKey.get('sessionName') ?? '';
  const date = byKey.get('dateText') ?? '';
  const head = [house, session].filter((part) => part !== '').join(' · ');
  if (head === '') return recordId;
  return date === '' ? head : `${head}（${date}）`;
}

export async function buildCase(exampleName: string): Promise<DemoCaseData> {
  const exampleDir = path.join(EXAMPLES_DIR, exampleName);
  // 回填产物（`evidence.enriched.jsonl`）是派生的旁挂文件：存在时优先用它，冻结底稿一个字不动。
  // 判定链仍然是同一条（`retallyAndRegate` 只数既有证据行，不调模型）。
  const enrichedPath = path.join(exampleDir, 'evidence.enriched.jsonl');
  const evidenceSource = (await fs.access(enrichedPath).then(() => true).catch(() => false))
    ? enrichedPath
    : path.join(exampleDir, 'evidence.jsonl');
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `lodestar-demo-${exampleName}-`));
  try {
    await copyIfExists(path.join(exampleDir, 'claims.jsonl'), path.join(tempDir, 'claims.jsonl'));
    await copyIfExists(evidenceSource, path.join(tempDir, 'evidence.jsonl'));
    const snapshotDir = path.join(exampleDir, 'snapshots');
    for (const name of await fs.readdir(snapshotDir)) {
      if (name.endsWith('.txt')) await copyIfExists(path.join(snapshotDir, name), path.join(tempDir, 'snapshots', name));
    }
    const query = (await fs.readFile(path.join(exampleDir, 'query.txt'), 'utf8')).trim();
    const store = createStore({ baseDir: tempDir });
    const outcome = await retallyAndRegate({
      store,
      query,
      note: 'build-demo-data: 从冻结批次的全部证据重算，未新增检索与抓取',
    });

    const claims = await readJsonl<ClaimRecord>(path.join(exampleDir, 'claims.jsonl'));
    const evidenceRows = await readJsonl<EvidenceRecord>(evidenceSource);
    const meta = await readCaseMeta(exampleDir);
    const verdictByClaim = new Map(outcome.verdicts.map((verdict) => [verdict.claimId, verdict]));
    const anchorByRecord = new Map(outcome.anchors.map((anchor) => [anchor.recordId, anchor]));
    const claimById = new Map(claims.map((claim) => [claim.claimId, claim]));
    const packFields = porcelainPack.fields().map((field) => ({ key: field.key, label: field.label, role: field.role }));
    const labelByKey = new Map(packFields.map((field) => [field.key, field.label]));

    // 来源字典：同一页的正文节选只存一份，证据行只引用 URL
    const urls = [...new Set(evidenceRows.map((row) => row.url))];
    const publisherByUrl = new Map<string, string>();
    for (const source of meta?.sources ?? []) {
      if (typeof source.url === 'string' && typeof source.publisher === 'string') {
        publisherByUrl.set(source.url, source.publisher);
      }
    }
    const sources: DemoSource[] = [];
    for (const url of urls) {
      const row = evidenceRows.find((item) => item.url === url);
      if (!row) continue;
      const snapshotText = await fs.readFile(path.join(exampleDir, row.snapshotRef), 'utf8').catch(() => '');
      sources.push({
        url,
        publisher: publisherByUrl.get(url) ?? row.domain,
        family: row.sourceFamily,
        tier: row.tier,
        snapshotFile: row.snapshotRef,
        excerpt: snapshotText,
      });
    }
    sources.sort((a, b) => a.url.localeCompare(b.url));

    const records: DemoRecord[] = [];
    for (const summary of outcome.summaries) {
      const recordClaims = claims.filter((claim) => claim.recordId === summary.recordId);
      const fields: DemoFieldValue[] = [];
      // 关键字段按策略包顺序排前面，次要字段随后；同一记录里字段顺序稳定，页面不随底稿行序跳动
      const ordered = [...recordClaims].sort((a, b) => {
        const rank = (claim: ClaimRecord): number => (claim.fieldRole === 'key' ? 0 : 1);
        const order = (claim: ClaimRecord): number => {
          const index = packFields.findIndex((field) => field.key === claim.fieldKey);
          return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
        };
        return rank(a) - rank(b) || order(a) - order(b) || a.claimId.localeCompare(b.claimId);
      });
      for (const claim of ordered) {
        if (claim.fieldKey === null) continue;
        fields.push({
          key: claim.fieldKey,
          label: labelByKey.get(claim.fieldKey) ?? claim.fieldKey,
          role: claim.fieldRole,
          value: claim.object,
        });
      }

      const fieldVerdicts: Record<string, DemoFieldVerdict> = {};
      const keyFieldValues: Record<string, string> = {};
      for (const claim of recordClaims) {
        if (claim.fieldKey === null) continue;
        const verdict = verdictByClaim.get(claim.claimId);
        if (claim.fieldRole === 'key') keyFieldValues[claim.fieldKey] = claim.object;
        if (!verdict) continue;
        const claimEvidence = evidenceRows.filter((row) => row.claimId === claim.claimId);
        const examinedPages = new Set(claimEvidence.map((row) => row.url)).size;
        fieldVerdicts[claim.fieldKey] = {
          fieldValue: claim.object,
          claimId: claim.claimId,
          verdict: verdict.verdict,
          evidenceGrade: verdict.evidenceGrade,
          supportCount: verdict.supportCount,
          refuteCount: verdict.refuteCount,
          notFoundCause: verdict.notFoundCause ?? null,
          examinedPages,
          dimensionState: pickSupportDimensionState(claimEvidence),
        };
      }

      const cooccurring = summary.cooccurringEvidenceIds
        .map((evidenceId) => evidenceRows.find((row) => row.evidenceId === evidenceId))
        .filter((row) => row !== undefined);
      const cooccurringPages = [...new Set(cooccurring.map((row) => row.url))];

      const recordEvidence = evidenceRows.filter((row) => row.recordId === summary.recordId);
      const evidenceByClaim = new Map<string, EvidenceRecord[]>();
      for (const row of recordEvidence) {
        const bucket = evidenceByClaim.get(row.claimId);
        if (bucket) bucket.push(row);
        else evidenceByClaim.set(row.claimId, [row]);
      }
      const dimensionGrade = gradeRecordDimensions(summary.fieldClaimIds, claimById, evidenceByClaim);

      const anchor = anchorByRecord.get(summary.recordId);

      records.push({
        recordId: summary.recordId,
        caseId: exampleName,
        title: recordTitle(fields, summary.recordId),
        bucket: bucketOf(summary, verdictByClaim),
        fields,
        evidence: recordEvidence.map((row) => {
          const claim = claimById.get(row.claimId);
          return {
            evidenceId: row.evidenceId,
            fieldKey: row.fieldKey ?? '',
            // 断言编号里没有字段值：这一个值就是页面匹配证据的唯一钥匙
            fieldValue: claim?.object ?? '',
            relation: row.relation,
            quote: row.quote,
            url: row.url,
            domain: row.domain,
            family: row.sourceFamily,
            tier: row.tier,
            snapshotFile: row.snapshotRef,
            fetchedAt: row.fetchedAt,
            note: row.note ?? null,
            dimension: row.dimension ?? null,
            state: row.state ?? 'unknown',
            matchedValue: row.matchedValue ?? null,
          };
        }),
        computation: {
          gate: summary.gate,
          reason: summary.reason,
          fieldVerdicts,
          keyFieldValues,
          cooccurrence: { count: cooccurringPages.length, pages: cooccurringPages },
          dimensionGrade: {
            grade: dimensionGrade.grade,
            score: dimensionGrade.score,
            basis: dimensionGrade.basis,
            conflictDimensions: dimensionGrade.conflictDimensions,
            entries: dimensionGrade.entries,
          },
          anchor: anchor
            ? {
                grade: anchor.anchorGrade,
                evidenceGrade: anchor.evidenceGrade,
                urls: anchor.sourceUrls,
                searchPhrases: anchor.searchPhrases ?? [],
                stale: anchor.stale,
              }
            : null,
        },
      });
    }
    records.sort((a, b) => a.recordId.localeCompare(b.recordId));

    return {
      id: exampleName,
      title: meta?.title ?? exampleName,
      subtitle: meta?.subtitle ?? '',
      query,
      capturedAt: meta?.capturedAt ?? '',
      sources,
      records,
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

/** 参与演示的示例目录名（固定示例在前，随后是冻结批次） */
export async function listExampleNames(): Promise<string[]> {
  const batchDirs = (await fs.readdir(EXAMPLES_DIR))
    .filter((name) => /^demo-batch-[a-z0-9-]+$/.test(name))
    .sort();
  return [...FIXED_EXAMPLES, ...batchDirs.filter((name) => !FIXED_EXAMPLES.includes(name))];
}

async function main(): Promise<void> {
  const examples = await listExampleNames();

  const cases: DemoCaseData[] = [];
  for (const exampleName of examples) {
    try {
      await fs.access(path.join(EXAMPLES_DIR, exampleName, 'claims.jsonl'));
    } catch {
      console.warn(`skip ${exampleName}: no claims.jsonl`);
      continue;
    }
    const built = await buildCase(exampleName);
    console.log(
      `${exampleName}: ${built.records.length} record(s) — ` +
        ['strong', 'weak', 'refuted', 'not_found']
          .map((bucket) => `${bucket}=${built.records.filter((record) => record.bucket === bucket).length}`)
          .join(' '),
    );
    cases.push(built);
  }

  const buckets = { strong: 0, weak: 0, refuted: 0, not_found: 0 };
  for (const item of cases) {
    for (const record of item.records) buckets[record.bucket] += 1;
  }

  const data: DemoData = {
    generatedAt: new Date().toISOString(),
    generator: 'src/demo-page/build-demo-data.ts',
    note:
      '判定由引擎在构建时算好并冻结：页面只切换展示，不重算计票、门禁与坐标。' +
      '证据按「记录号＋字段名＋字段值」匹配，字段值对不上就显示「这批证据没覆盖」。',
    fields: porcelainPack.fields().map((field) => ({ key: field.key, label: field.label, role: field.role })),
    buckets,
    cases,
  };

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(
    OUTPUT_PATH,
    `// 由 ${data.generator} 从 examples/ 生成，不要手改；改数据请改冻结批次后重跑 pnpm run demo:data。\n` +
      `window.LODESTAR_DEMO = ${JSON.stringify(data, null, 2)};\n`,
    'utf8',
  );

  const bytes = (await fs.stat(OUTPUT_PATH)).size;
  console.log(`\nWrote ${path.relative(PACKAGE_ROOT, OUTPUT_PATH)} (${(bytes / 1024).toFixed(1)} KB)`);
  console.log(
    `Buckets: strong=${buckets.strong} weak=${buckets.weak} refuted=${buckets.refuted} not_found=${buckets.not_found}`,
  );
  if (buckets.strong < 2 || buckets.weak < 2 || buckets.refuted < 2 || buckets.not_found < 2) {
    console.warn('Warning: 四类里仍有不足 2 组的类别——演示切换会不好看，按方案还需补抓。');
  }
}

// 只在直接执行本文件时跑构建；被 build-demo-game.ts 导入时只取 buildCase，不重复写数据
const isDirectRun =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((error) => {
    console.error('Failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
