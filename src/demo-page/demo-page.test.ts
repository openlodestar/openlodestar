// src/demo-page/demo-page.test.ts
/**
 * 交互演示页与冻结数据的一致性测试（离线、零模型调用）
 *
 * 守三件事：
 * 1. 页面数据是引擎算出来的那一份——拿 examples/ 重算一遍，门禁、坐标、逐字段裁决必须一致；
 * 2. 证据按「记录号 + 字段名 + 字段值」匹配——字段值一改就必须报"这批证据没覆盖"，
 *    不许继承旧证据，更不许把值对不上的记录显示成"被拒收"；
 * 3. 页面上能看到的每条引文，确实出现在它引用的那份快照节选里。
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { afterAll, describe, expect, it } from 'vitest';
import { quoteMatches } from '../lodestar/adjudicate/compare';
import { retallyAndRegate } from '../lodestar/engine';
import { createStore } from '../lodestar/storage/adapter';

const ROOT = path.resolve(import.meta.dirname, '../..');
const DOCS = path.join(ROOT, 'docs');
const EXAMPLES = path.join(ROOT, 'examples');
const TEMP_DIRS: string[] = [];

interface DemoField {
  key: string;
  label: string;
  role: 'key' | 'secondary';
  value: string;
}

interface DemoEvidence {
  evidenceId: string;
  fieldKey: string;
  fieldValue: string;
  quote: string;
  url: string;
}

interface DemoFieldVerdict {
  claimId: string;
  fieldValue: string;
  verdict: string;
  supportCount: number;
  refuteCount: number;
}

interface DemoRecord {
  recordId: string;
  caseId: string;
  bucket: 'strong' | 'weak' | 'refuted' | 'not_found';
  fields: DemoField[];
  evidence: DemoEvidence[];
  computation: {
    gate: 'strong' | 'weak' | 'rejected';
    reason: string;
    fieldVerdicts: Record<string, DemoFieldVerdict>;
    keyFieldValues: Record<string, string>;
    cooccurrence: { count: number; pages: string[] };
    anchor: { grade: 'strong' | 'weak'; urls: string[] } | null;
  };
}

interface DemoCase {
  id: string;
  sources: Array<{ url: string; excerpt: string }>;
  records: DemoRecord[];
}

interface DemoData {
  generatedAt: string;
  buckets: Record<'strong' | 'weak' | 'refuted' | 'not_found', number>;
  cases: DemoCase[];
}

interface FieldView {
  key: string;
  value: string;
  state: 'covered' | 'uncovered';
  verdict?: string;
  evidence: DemoEvidence[];
}

interface RecordView {
  gate: 'strong' | 'weak' | 'rejected' | 'uncovered';
  bucket: string;
  gateLabel: string;
  reason: string;
  anchor: { grade: string; urls: string[] } | null;
  fields: FieldView[];
}

interface MatchApi {
  matchEvidence: (record: DemoRecord, field: DemoField) => DemoEvidence[];
  fieldView: (record: DemoRecord, field: DemoField) => FieldView;
  buildView: (record: DemoRecord) => RecordView;
  verdictLabel: (verdict: string | undefined) => string;
}

function loadPageScripts(): { data: DemoData; api: MatchApi } {
  const sandbox: { window: Record<string, unknown> } = { window: {} };
  vm.createContext(sandbox);
  for (const file of ['assets/demo-data.js', 'assets/demo-match.js']) {
    const code = fs.readFileSync(path.join(DOCS, file), 'utf8');
    vm.runInContext(code, sandbox, { filename: file });
  }
  return {
    data: sandbox.window.LODESTAR_DEMO as DemoData,
    api: sandbox.window.LODESTAR_MATCH as MatchApi,
  };
}

async function recomputeExample(exampleId: string): Promise<Awaited<ReturnType<typeof retallyAndRegate>>> {
  const sourceDir = path.join(EXAMPLES, exampleId);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `lodestar-demo-test-${exampleId}-`));
  TEMP_DIRS.push(tempDir);
  fs.copyFileSync(path.join(sourceDir, 'claims.jsonl'), path.join(tempDir, 'claims.jsonl'));
  // 回填产物优先，与 `build-demo-data` 保持同一条读取口径（冻结底稿不动）
  const enriched = path.join(sourceDir, 'evidence.enriched.jsonl');
  fs.copyFileSync(
    fs.existsSync(enriched) ? enriched : path.join(sourceDir, 'evidence.jsonl'),
    path.join(tempDir, 'evidence.jsonl'),
  );
  fs.mkdirSync(path.join(tempDir, 'snapshots'), { recursive: true });
  for (const name of fs.readdirSync(path.join(sourceDir, 'snapshots'))) {
    if (name.endsWith('.txt')) {
      fs.copyFileSync(path.join(sourceDir, 'snapshots', name), path.join(tempDir, 'snapshots', name));
    }
  }
  const query = fs.readFileSync(path.join(sourceDir, 'query.txt'), 'utf8').trim();
  return retallyAndRegate({
    store: createStore({ baseDir: tempDir }),
    query,
    note: 'demo-page.test: 重算对比，未新增检索与抓取',
  });
}

afterAll(() => {
  for (const dir of TEMP_DIRS) fs.rmSync(dir, { recursive: true, force: true });
});

const { data, api } = loadPageScripts();

function allRecords(): DemoRecord[] {
  return data.cases.flatMap((item) => item.records);
}

describe('页面装载', () => {
  it('演示页只引用同源脚本，数据是内嵌常量而不是要去读的文件', () => {
    const html = fs.readFileSync(path.join(DOCS, 'demo.html'), 'utf8');
    for (const script of ['assets/demo-data.js', 'assets/demo-match.js', 'assets/demo.js']) {
      expect(html).toContain(`src="${script}"`);
      expect(fs.existsSync(path.join(DOCS, script))).toBe(true);
    }
    const dataScript = fs.readFileSync(path.join(DOCS, 'assets/demo-data.js'), 'utf8');
    // 可以有一行生成注释，但数据必须是内嵌常量，不能是等着页面去取的文件
    expect(/^(?:\/\/[^\n]*\n)*window\.LODESTAR_DEMO = /.test(dataScript)).toBe(true);
    expect(dataScript).not.toContain('LODESTAR_DEMO.json');
  });

  it('四类判定在数据里都有记录，总组数够切换', () => {
    const buckets = { strong: 0, weak: 0, refuted: 0, not_found: 0 };
    for (const record of allRecords()) buckets[record.bucket] += 1;
    expect(buckets).toEqual(data.buckets);
    // 每一类都至少有两组可切换的冻结记录，页面才不至于只剩一条孤例
    expect(buckets.strong).toBeGreaterThanOrEqual(2);
    expect(buckets.weak).toBeGreaterThanOrEqual(2);
    expect(buckets.refuted).toBeGreaterThanOrEqual(2);
    expect(buckets.not_found).toBeGreaterThanOrEqual(2);
    expect(allRecords().length).toBeGreaterThanOrEqual(8);
  });
});

describe('数据与引擎不漂移', () => {
  it('每个冻结批次的门禁、坐标与逐字段裁决都与引擎重算一致', async () => {
    for (const item of data.cases) {
      const outcome = await recomputeExample(item.id);
      const summaryById = new Map(outcome.summaries.map((summary) => [summary.recordId, summary]));
      const anchorById = new Map(outcome.anchors.map((anchor) => [anchor.recordId, anchor]));
      const verdictById = new Map(outcome.verdicts.map((verdict) => [verdict.claimId, verdict]));
      for (const record of item.records) {
        const summary = summaryById.get(record.recordId);
        expect(summary, `${item.id}/${record.recordId} 在引擎重算里不存在`).toBeDefined();
        if (!summary) continue;
        expect(record.computation.gate).toBe(summary.gate);
        const anchor = anchorById.get(record.recordId) ?? null;
        expect(record.computation.anchor?.grade ?? null).toBe(anchor?.anchorGrade ?? null);
        expect(record.computation.anchor?.urls ?? []).toEqual(anchor?.sourceUrls ?? []);
        for (const [fieldKey, fieldVerdict] of Object.entries(record.computation.fieldVerdicts)) {
          const recomputed = verdictById.get(fieldVerdict.fieldValue === '' ? '' : fieldVerdict.claimId);
          expect(recomputed, `${record.recordId}/${fieldKey} 重算没有裁决`).toBeDefined();
          if (!recomputed) continue;
          expect(fieldVerdict.verdict).toBe(recomputed.verdict);
          expect(fieldVerdict.supportCount).toBe(recomputed.supportCount);
          expect(fieldVerdict.refuteCount).toBe(recomputed.refuteCount);
        }
        for (const field of record.fields) {
          expect(record.computation.fieldVerdicts[field.key]?.fieldValue ?? null).toBe(field.value);
        }
      }
    }
  });

  it('每条证据都带着构建时的字段值，支撑类字段至少有一行匹配证据', () => {
    for (const record of allRecords()) {
      for (const field of record.fields) {
        const fieldVerdict = record.computation.fieldVerdicts[field.key];
        if (!fieldVerdict) continue;
        expect(fieldVerdict.fieldValue).toBe(field.value);
        const rows = api.matchEvidence(record, field);
        if (fieldVerdict.verdict !== 'not_found') {
          expect(rows.length, `${record.recordId}/${field.key} 缺匹配证据`).toBeGreaterThan(0);
        }
        for (const row of rows) expect(row.fieldValue).toBe(field.value);
      }
    }
  });

  it('页面展示的引文确实在它引用的快照节选里', () => {
    for (const item of data.cases) {
      const sourceByUrl = new Map(item.sources.map((source) => [source.url, source]));
      for (const record of item.records) {
        for (const row of record.evidence) {
          const source = sourceByUrl.get(row.url);
          expect(source, `${record.recordId} 引用的 ${row.url} 没有快照节选`).toBeDefined();
          if (!source) continue;
          expect(quoteMatches(row.quote, source.excerpt), `${row.evidenceId} 的引文不在节选里`).toBe(true);
        }
      }
    }
  });
});

describe('字段值一变，证据就不许被继承', () => {
  it('把关键字段的显示值改掉，整条记录只报「这批证据没覆盖」', () => {
    const original = allRecords()[0];
    expect(original).toBeDefined();
    if (!original) return;
    const tampered: DemoRecord = {
      ...original,
      fields: original.fields.map((field) =>
        field.role === 'key' ? { ...field, value: `${field.value}（被改写）` } : field,
      ),
    };
    const view = api.buildView(tampered);
    expect(view.gate).toBe('uncovered');
    expect(view.gateLabel).toBe('无坐标（这批证据没覆盖）');
    expect(view.bucket).toBe('uncovered');
    expect(view.anchor).toBeNull();
    for (const field of original.fields.filter((item) => item.role === 'key')) {
      expect(view.fields.find((item) => item.key === field.key)?.state).toBe('uncovered');
      expect(api.matchEvidence(tampered, tampered.fields.find((item) => item.key === field.key)!)).toEqual([]);
    }
    // 关键一条：字段值对不上时，既不许沿用 supported/refuted，也不许整条被判成 rejected
    for (const field of view.fields) {
      expect(['uncovered', 'covered']).toContain(field.state);
      if (field.state === 'covered') expect(field.verdict).not.toBe('refuted');
    }
    expect(view.reason).toContain('这批证据没覆盖');
  });

  it('只改一个次要字段也会被识别，而不是悄悄沿用旧判定', () => {
    const withSecondary = allRecords().find((record) =>
      record.fields.some((field) => field.role === 'secondary'),
    );
    if (!withSecondary) return;
    const secondary = withSecondary.fields.find((field) => field.role === 'secondary');
    expect(secondary).toBeDefined();
    if (!secondary) return;
    const tampered: DemoRecord = {
      ...withSecondary,
      fields: withSecondary.fields.map((field) =>
        field.key === secondary.key ? { ...field, value: `${field.value}（被改写）` } : field,
      ),
    };
    const view = api.buildView(tampered);
    expect(view.gate).toBe('uncovered');
    expect(view.fields.find((field) => field.key === secondary.key)?.state).toBe('uncovered');
  });
});
