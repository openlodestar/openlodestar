// src/demo-page/demo-lab.test.ts
/**
 * 小游戏页与冻结组合矩阵的一致性测试（离线、零模型调用）
 *
 * 守四件事：
 * 1. 页面上的每条组合都能在冻结数据里逐条对上：裁决、门禁、共现、坐标、证据条数一致；
 * 2. 「有记录可查」与「这批证据没覆盖」是两种不同状态——没覆盖的组合不许挂任何记录，
 *    更不许显示成「被拒收」；被反驳的组合必须真的有一条 refutes 证据；
 * 3. 换一个槽位就能跨到另一条记录/没覆盖，证明页面没有偷偷继承旧证据；
 * 4. 组合数 × 覆盖数的读数与冻结矩阵一致，且组合总数不超过 100。
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { quoteMatches } from '../lodestar/adjudicate/compare';

const ROOT = path.resolve(import.meta.dirname, '../..');
const DOCS = path.join(ROOT, 'docs');

type SlotKey = 'auctionHouse' | 'dateText' | 'sessionPrefix' | 'sessionSubtitle';
type Bucket = 'strong' | 'weak' | 'refuted' | 'not_found';

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
  relation: 'supports' | 'refutes' | 'irrelevant';
  quote: string;
  url: string;
  domain: string;
  family: string;
  tier: string;
  snapshotFile: string;
  fetchedAt: string;
  note: string | null;
}

interface DemoFieldVerdict {
  claimId: string;
  fieldValue: string;
  verdict: string;
  evidenceGrade: string;
  supportCount: number;
  refuteCount: number;
  notFoundCause: string | null;
  examinedPages: number;
}

interface DemoRecord {
  recordId: string;
  caseId: string;
  title: string;
  bucket: Bucket;
  fields: DemoField[];
  evidence: DemoEvidence[];
  computation: {
    gate: 'strong' | 'weak' | 'rejected';
    reason: string;
    fieldVerdicts: Record<string, DemoFieldVerdict>;
    keyFieldValues: Record<string, string>;
    cooccurrence: { count: number; pages: string[] };
    anchor: {
      grade: 'strong' | 'weak';
      evidenceGrade: string;
      urls: string[];
      searchPhrases: string[];
      stale: boolean;
    } | null;
  };
}

interface DemoCase {
  id: string;
  title: string;
  query: string;
  capturedAt: string;
  sources: Array<{ url: string; publisher: string; excerpt: string; snapshotFile: string }>;
  records: DemoRecord[];
}

interface DemoData {
  generatedAt: string;
  buckets: Record<Bucket, number>;
  cases: DemoCase[];
}

interface DemoMatchApi {
  matchEvidence: (record: DemoRecord, field: DemoField) => DemoEvidence[];
  buildView: (record: DemoRecord) => RecordView;
  verdictLabel: (verdict: string | undefined) => string;
}

interface FieldView {
  key: string;
  label: string;
  role: 'key' | 'secondary';
  value: string;
  state: 'covered' | 'uncovered';
  verdict?: string;
  supportCount?: number;
  refuteCount?: number;
  evidenceGrade?: string;
  notFoundCause?: string | null;
  examinedPages?: number;
  evidence: DemoEvidence[];
}

interface RecordView {
  gate: 'strong' | 'weak' | 'rejected' | 'uncovered';
  bucket: string;
  reason: string;
  fields: FieldView[];
  cooccurrence: { count: number; pages: string[] };
  anchor: {
    grade: string;
    evidenceGrade: string;
    urls: string[];
    searchPhrases: string[];
    stale: boolean;
  } | null;
}

interface GameComputation {
  gate: 'strong' | 'weak' | 'rejected';
  bucket: Bucket;
  keyFieldValues: Record<string, string>;
  fieldVerdicts: Record<string, DemoFieldVerdict>;
  cooccurrence: { count: number; pages: string[] };
  anchor: {
    grade: 'strong' | 'weak';
    evidenceGrade: string;
    urls: string[];
    searchPhrases: string[];
    stale: boolean;
  } | null;
  evidenceCount: number;
}

interface GameCombo {
  id: string;
  key: string;
  values: Record<SlotKey, string>;
  sentence: string;
  status: 'covered' | 'uncovered';
  recordId: string | null;
  caseId: string | null;
  matched: Array<{ recordId: string; caseId: string; gate: string; bucket: Bucket }>;
  computation: GameComputation | null;
}

interface GameData {
  generatedAt: string;
  generator: string;
  note: string;
  slots: Array<{ key: SlotKey; label: string; options: string[] }>;
  combos: GameCombo[];
  stats: {
    total: number;
    covered: number;
    uncovered: number;
    byStatus: Record<Bucket, number>;
    maxCombos: number;
  };
}

interface GameResolveResult {
  status: Bucket | 'uncovered';
  label: string;
  hint: string;
  reason: string;
  combo: GameCombo | null;
  record: DemoRecord | null;
  view: RecordView | null;
}

interface GameApi {
  SLOT_KEYS: SlotKey[];
  STATUS_LABELS: Record<Bucket | 'uncovered', string>;
  STATUS_SHORT: Record<Bucket | 'uncovered', string>;
  STATUS_HINTS: Record<Bucket | 'uncovered', string>;
  comboKey: (values: Record<SlotKey, string>) => string;
  findCombo: (data: GameData, values: Record<SlotKey, string>) => GameCombo | null;
  recordIndex: (data: DemoData) => Record<string, DemoRecord>;
  resolve: (data: GameData, demo: DemoData, values: Record<SlotKey, string>) => GameResolveResult;
  coverage: (data: GameData) => {
    total: number;
    covered: number;
    uncovered: number;
    byStatus: Record<Bucket, number>;
  };
  substitutionStatus: (
    data: GameData,
    demo: DemoData,
    values: Record<SlotKey, string>,
    slotKey: SlotKey,
    option: string,
  ) => Bucket | 'uncovered';
  distanceOf: (a: Record<SlotKey, string>, b: Record<SlotKey, string>) => number;
  nearbyCovered: (
    data: GameData,
    values: Record<SlotKey, string>,
    limit?: number,
  ) => Array<{ id: string; values: Record<SlotKey, string>; status: Bucket; distance: number }>;
}

function loadPageScripts(): { demo: DemoData; game: GameData; match: DemoMatchApi; api: GameApi } {
  const sandbox: { window: Record<string, unknown> } = { window: {} };
  vm.createContext(sandbox);
  for (const file of [
    'assets/demo-data.js',
    'assets/demo-match.js',
    'assets/demo-game-data.js',
    'assets/demo-game-match.js',
  ]) {
    const code = fs.readFileSync(path.join(DOCS, file), 'utf8');
    vm.runInContext(code, sandbox, { filename: file });
  }
  return {
    demo: sandbox.window.LODESTAR_DEMO as DemoData,
    game: sandbox.window.LODESTAR_DEMO_GAME as GameData,
    match: sandbox.window.LODESTAR_MATCH as DemoMatchApi,
    api: sandbox.window.LODESTAR_GAME as GameApi,
  };
}

const { demo, game, match, api } = loadPageScripts();

const SESSION_SEPARATOR = '—';
const INITIAL_VALUES: Record<SlotKey, string> = {
  auctionHouse: '北京保利',
  dateText: '2021年12月5日',
  sessionPrefix: '禹贡Ⅰ',
  sessionSubtitle: '盛清御瓷新风尚',
};

function allRecords(): DemoRecord[] {
  return demo.cases.flatMap((item) => item.records);
}

function recordById(): Map<string, DemoRecord> {
  return new Map(allRecords().map((record) => [record.recordId, record]));
}

/** 记录的四个关键取值（专场名拆成主名与副题） */
function keyValuesOf(record: DemoRecord): Record<SlotKey, string> | null {
  const byKey = new Map(record.fields.map((field) => [field.key, field.value]));
  const house = byKey.get('auctionHouse') ?? '';
  const date = byKey.get('dateText') ?? '';
  const session = byKey.get('sessionName') ?? '';
  const at = session.indexOf(SESSION_SEPARATOR);
  if (house === '' || date === '' || at <= 0) return null;
  return {
    auctionHouse: house,
    dateText: date,
    sessionPrefix: session.slice(0, at),
    sessionSubtitle: session.slice(at + SESSION_SEPARATOR.length),
  };
}

function comboKeyOf(values: Record<SlotKey, string>): string {
  return [
    values.auctionHouse,
    values.dateText,
    values.sessionPrefix,
    values.sessionSubtitle,
  ].join('\u0000');
}

function coveredCombos(): GameCombo[] {
  return game.combos.filter((combo) => combo.status === 'covered');
}

function uncoveredCombos(): GameCombo[] {
  return game.combos.filter((combo) => combo.status === 'uncovered');
}

function comboIn(bucket: Bucket): GameCombo {
  const combo = coveredCombos().find((item) => item.computation?.bucket === bucket);
  expect(combo, `没有 ${bucket} 的覆盖组合`).toBeDefined();
  return combo as GameCombo;
}

function edited(values: Partial<Record<SlotKey, string>>): Record<SlotKey, string> {
  return { ...INITIAL_VALUES, ...values };
}

describe('页面装载与离线约束', () => {
  it('小游戏是单独一页，脚本全部同源且不靠模块加载', () => {
    const html = fs.readFileSync(path.join(DOCS, 'demo-lab.html'), 'utf8');
    for (const script of [
      'assets/demo-data.js',
      'assets/demo-match.js',
      'assets/demo-game-data.js',
      'assets/demo-game-match.js',
      'assets/demo-lab.js',
    ]) {
      expect(html).toContain(`src="${script}"`);
      expect(fs.existsSync(path.join(DOCS, script))).toBe(true);
    }
    expect(html).not.toContain('type="module"');
    expect(html).not.toContain('<form');
    // 内联事件处理器一律不许出现（aria-* 不算）
    expect(/\son[a-z]+\s*=/i.test(html)).toBe(false);
    expect(html).toContain('id="verdict"');
    expect(html).toContain('aria-live="polite"');
    // 改词即出结论：没有单独的「识别」按钮，也没有第二套词库与拖拽
    expect(html).not.toContain('id="identify"');
    expect(html).not.toContain('word-bank');
    const labSource = fs.readFileSync(path.join(DOCS, 'assets/demo-lab.js'), 'utf8');
    expect(labSource).not.toContain('pointermove');
    expect(labSource).not.toContain('drag');
    expect(labSource).toContain('substitutionStatus');
    expect(labSource).toContain('nearbyCovered');
    const dataScript = fs.readFileSync(path.join(DOCS, 'assets/demo-game-data.js'), 'utf8');
    expect(/^(?:\/\/[^\n]*\n)*window\.LODESTAR_DEMO_GAME = /.test(dataScript)).toBe(true);
    for (const file of ['assets/demo-lab.js', 'assets/demo-game-match.js']) {
      const source = fs.readFileSync(path.join(DOCS, file), 'utf8');
      expect(source).not.toContain('fetch(');
      expect(source).not.toContain('XMLHttpRequest');
      expect(source).not.toContain('localStorage');
      expect(source).not.toContain('sessionStorage');
    }
  });

  it('原有 demo.html 保持独立：只借顶栏指向小游戏，不引入小游戏的脚本与判定', () => {
    const demoHtml = fs.readFileSync(path.join(DOCS, 'demo.html'), 'utf8');
    expect(demoHtml).not.toContain('LODESTAR_DEMO_GAME');
    expect(demoHtml).not.toContain('demo-game');
    expect(demoHtml).not.toContain('demo-lab.js');
    // demo-lab 只允许作为顶栏里的相对链接出现一次，不能被塞进页面逻辑
    expect((demoHtml.match(/demo-lab/g) ?? []).length).toBe(1);
    expect(demoHtml).toContain('<a href="demo-lab.html">小游戏</a>');
  });

  it('五个结论各有独立的标签，没覆盖不会被写成拒收', () => {
    expect(api.STATUS_LABELS.strong).toBe('对');
    expect(api.STATUS_LABELS.weak).toContain('单一独立来源');
    expect(api.STATUS_LABELS.refuted).toBe('不对');
    expect(api.STATUS_LABELS.not_found).toContain('查过');
    expect(api.STATUS_LABELS.uncovered).toBe('这批证据没覆盖');
    for (const label of Object.values(api.STATUS_LABELS)) {
      expect(label).not.toContain('拒收');
    }
  });
});

describe('槽位与组合矩阵', () => {
  it('四个槽位、每槽 2–4 个选项，组合数等于选项数的乘积且不超过 100', () => {
    expect(game.slots.map((slot) => slot.key)).toEqual(api.SLOT_KEYS);
    for (const slot of game.slots) {
      expect(slot.options.length).toBeGreaterThanOrEqual(2);
      expect(slot.options.length).toBeLessThanOrEqual(4);
      expect(new Set(slot.options).size).toBe(slot.options.length);
    }
    const product = game.slots.reduce((total, slot) => total * slot.options.length, 1);
    expect(game.combos.length).toBe(product);
    expect(game.combos.length).toBeLessThanOrEqual(100);
    expect(game.stats.total).toBe(game.combos.length);
    expect(game.stats.maxCombos).toBe(100);
  });

  it('每个选项都真的在冻结数据里出现过，没有凭空造值', () => {
    const frozen = allRecords()
      .map(keyValuesOf)
      .filter((values): values is Record<SlotKey, string> => values !== null);
    for (const slot of game.slots) {
      for (const option of slot.options) {
        const seen = frozen.some((values) => values[slot.key] === option);
        expect(seen, `槽位 ${slot.label} 的「${option}」没有在冻结数据里出现过`).toBe(true);
      }
    }
  });

  it('每条组合的取值都来自对应槽位的选项，且组合键唯一', () => {
    const keys = new Set<string>();
    for (const combo of game.combos) {
      for (const slot of game.slots) {
        expect(slot.options).toContain(combo.values[slot.key]);
      }
      const key = comboKeyOf(combo.values);
      expect(combo.key).toBe(key);
      expect(api.comboKey(combo.values)).toBe(key);
      expect(keys.has(key), `组合键重复：${combo.id}`).toBe(false);
      keys.add(key);
      expect(combo.sentence).toContain(combo.values.auctionHouse);
      expect(combo.sentence).toContain(combo.values.dateText);
      expect(combo.sentence).toContain(
        `${combo.values.sessionPrefix}${SESSION_SEPARATOR}${combo.values.sessionSubtitle}`,
      );
    }
  });
});

describe('组合矩阵与冻结数据逐条一致', () => {
  it('覆盖组合指向的记录、门禁、共现、坐标与证据条数都对得上', () => {
    const records = recordById();
    const sourceByUrl = new Map(
      demo.cases.flatMap((item) => item.sources.map((source) => [source.url, source] as const)),
    );
    for (const combo of coveredCombos()) {
      expect(combo.recordId).not.toBeNull();
      expect(combo.computation).not.toBeNull();
      if (!combo.recordId || !combo.computation) continue;
      const record = records.get(combo.recordId);
      expect(record, `组合 ${combo.id} 指向了不存在的记录 ${combo.recordId}`).toBeDefined();
      if (!record) continue;
      expect(combo.caseId).toBe(record.caseId);
      expect(combo.computation.gate).toBe(record.computation.gate);
      expect(combo.computation.bucket).toBe(record.bucket);
      expect(combo.computation.keyFieldValues).toEqual(record.computation.keyFieldValues);
      expect(combo.computation.cooccurrence).toEqual(record.computation.cooccurrence);
      expect(combo.computation.anchor).toEqual(record.computation.anchor);
      expect(combo.computation.evidenceCount).toBe(record.evidence.length);

      const values = keyValuesOf(record);
      expect(values).not.toBeNull();
      if (values) {
        expect(comboKeyOf(values)).toBe(combo.key);
        expect(comboKeyOf(values)).toBe(comboKeyOf(combo.values));
      }

      for (const [fieldKey, verdict] of Object.entries(record.computation.fieldVerdicts)) {
        // 组合矩阵里的字段摘要不带 claimId（页面不需要按断言号找证据），其余逐项相等
        expect(combo.computation.fieldVerdicts[fieldKey]).toEqual({
          fieldValue: verdict.fieldValue,
          verdict: verdict.verdict,
          evidenceGrade: verdict.evidenceGrade,
          supportCount: verdict.supportCount,
          refuteCount: verdict.refuteCount,
          notFoundCause: verdict.notFoundCause,
          examinedPages: verdict.examinedPages,
        });
        expect(verdict.fieldValue).toBe(
          record.fields.find((field) => field.key === fieldKey)?.value,
        );
      }

      for (const field of record.fields) {
        const verdict = record.computation.fieldVerdicts[field.key];
        if (!verdict) continue;
        const rows = match.matchEvidence(record, field);
        if (verdict.verdict !== 'not_found') {
          expect(rows.length, `${record.recordId}/${field.key} 没有匹配证据`).toBeGreaterThan(0);
        }
        for (const row of rows) {
          expect(row.fieldValue).toBe(field.value);
          expect(row.fetchedAt, `${row.evidenceId} 缺抓取时间`).toBeTruthy();
          const source = sourceByUrl.get(row.url);
          expect(source, `${row.url} 没有快照节选`).toBeDefined();
          if (source) expect(quoteMatches(row.quote, source.excerpt)).toBe(true);
        }
      }

      const resolved = api.resolve(game, demo, combo.values);
      expect(resolved.status).toBe(record.bucket);
      expect(resolved.label).toBe(api.STATUS_LABELS[record.bucket]);
      expect(resolved.record?.recordId).toBe(record.recordId);
      expect(resolved.view?.bucket).toBe(record.bucket);
      expect(resolved.view?.gate).toBe(record.computation.gate);
    }
  });

  it('没覆盖的组合不挂任何记录，也不继承任何证据', () => {
    const records = recordById();
    for (const combo of uncoveredCombos()) {
      expect(combo.status).toBe('uncovered');
      expect(combo.recordId).toBeNull();
      expect(combo.caseId).toBeNull();
      expect(combo.computation).toBeNull();
      expect(combo.matched).toEqual([]);
      const matchedRecord = Array.from(records.values()).find((record) => {
        const values = keyValuesOf(record);
        return values !== null && comboKeyOf(values) === combo.key;
      });
      expect(matchedRecord, `没覆盖的组合 ${combo.id} 其实有记录`).toBeUndefined();

      const resolved = api.resolve(game, demo, combo.values);
      expect(resolved.status).toBe('uncovered');
      expect(resolved.label).toBe('这批证据没覆盖');
      expect(resolved.record).toBeNull();
      expect(resolved.view).toBeNull();
      expect(resolved.combo?.id).toBe(combo.id);
    }
  });
});

describe('单槽替换：有证据与没覆盖走两条路', () => {
  it('把时间从 12 月 5 日换成 11 月 15 日，得到「不对」且有反驳引文', () => {
    const values = edited({ dateText: '2021年11月15日' });
    const combo = api.findCombo(game, values);
    expect(combo, '这组替换应命中冻结记录').not.toBeNull();
    expect(combo?.status).toBe('covered');
    expect(combo?.computation?.bucket).toBe('refuted');
    const resolved = api.resolve(game, demo, values);
    expect(resolved.status).toBe('refuted');
    expect(resolved.label).toBe('不对');
    expect(resolved.view?.gate).toBe('rejected');
    const refutes = resolved.record?.evidence.filter((row) => row.relation === 'refutes') ?? [];
    expect(refutes.length).toBeGreaterThan(0);
    for (const row of refutes) {
      expect(row.quote.length).toBeGreaterThan(0);
      expect(row.fetchedAt).toBeTruthy();
      expect(row.fieldValue).toBeTruthy();
    }
  });

  it('把专场主名从 禹贡Ⅰ 换成 禹贡Ⅱ，显示「这批证据没覆盖」而不是拒收', () => {
    const values = edited({ sessionPrefix: '禹贡Ⅱ' });
    const combo = api.findCombo(game, values);
    expect(combo, '这组替换应在矩阵里').not.toBeNull();
    expect(combo?.status).toBe('uncovered');
    const resolved = api.resolve(game, demo, values);
    expect(resolved.status).toBe('uncovered');
    expect(resolved.label).toBe('这批证据没覆盖');
    expect(resolved.record).toBeNull();
    expect(resolved.view).toBeNull();
    expect(resolved.reason).toContain('没有任何一条冻结记录同时写着这四个值');
  });

  it('把时间与专场主名一起换到「查过没找到」，与被反驳、没覆盖都不同', () => {
    const values = edited({ dateText: '2021年12月', sessionPrefix: '禹贡Ⅲ' });
    const combo = api.findCombo(game, values);
    expect(combo?.status).toBe('covered');
    expect(combo?.computation?.bucket).toBe('not_found');
    const resolved = api.resolve(game, demo, values);
    expect(resolved.status).toBe('not_found');
    expect(resolved.label).toBe('查过，这批证据里没有');
    const fieldVerdicts = Object.values(resolved.record?.computation.fieldVerdicts ?? {});
    expect(fieldVerdicts.length).toBeGreaterThan(0);
    const sessionVerdict = resolved.record?.computation.fieldVerdicts.sessionName;
    expect(sessionVerdict?.verdict).toBe('not_found');
    expect(sessionVerdict?.notFoundCause).toBe('coverage');
    // 查过但没有，与「没查过」是两回事：记录和逐字段裁决都还在
    expect(resolved.record).not.toBeNull();
    expect(resolved.view).not.toBeNull();
  });
});

describe('组合数 × 覆盖数读数', () => {
  it('统计数与矩阵现场数出来的一致', () => {
    const stats = api.coverage(game);
    expect(stats.total).toBe(game.combos.length);
    expect(stats.covered).toBe(coveredCombos().length);
    expect(stats.uncovered).toBe(uncoveredCombos().length);
    expect(stats.byStatus).toEqual(game.stats.byStatus);
    expect(stats.total).toBe(stats.covered + stats.uncovered);
  });

  it('四类结论各有覆盖组合，并被分别断言', () => {
    expect(game.stats.covered).toBe(4);
    expect(game.stats.uncovered).toBe(68);
    for (const bucket of ['strong', 'weak', 'refuted', 'not_found'] as const) {
      expect(game.stats.byStatus[bucket], `${bucket} 没有覆盖组合`).toBe(1);
      const combo = comboIn(bucket);
      const record = api.recordIndex(demo)[combo.recordId ?? ''];
      expect(record, `${bucket} 组合的记录缺失`).toBeDefined();
      if (!record) continue;
      if (bucket === 'refuted') {
        expect(record.evidence.some((row) => row.relation === 'refutes')).toBe(true);
      }
      if (bucket === 'not_found') {
        expect(
          Object.values(record.computation.fieldVerdicts).some(
            (verdict) => verdict.verdict === 'not_found',
          ),
        ).toBe(true);
      }
      if (bucket === 'strong') {
        expect(record.computation.anchor?.grade).toBe('strong');
      }
      if (bucket === 'weak') {
        expect(record.computation.cooccurrence.count).toBeGreaterThan(0);
      }
    }
  });

  it('矩阵里的组合号不重复，按页面顺序稳定生成', () => {
    const ids = game.combos.map((combo) => combo.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe('g-01');
    expect(ids[ids.length - 1]).toBe(`g-${String(ids.length).padStart(2, '0')}`);
  });
});

function withValue(
  values: Record<SlotKey, string>,
  key: SlotKey,
  option: string,
): Record<SlotKey, string> {
  const next = { ...values } as Record<SlotKey, string>;
  next[key] = option;
  return next;
}

describe('改词即出结论：新交互的核心路径', () => {
  it('四个槽位是可聚焦的行内元素，不是会撑高行盒的行内大盒子', () => {
    const html = fs.readFileSync(path.join(DOCS, 'demo-lab.html'), 'utf8');
    expect((html.match(/class="slot"/g) ?? []).length).toBe(4);
    expect((html.match(/aria-controls="slot-options"/g) ?? []).length).toBe(4);
    expect((html.match(/role="button" tabindex="0" data-slot=/g) ?? []).length).toBe(4);
    expect(html).toContain('data-action="close-options"');
    // 原生 button 在 Chromium 里 display 恒为 inline-block，它的 margin box 会撑高行盒，
    // 所以槽位改用带 role 的 span，键盘支持改由脚本自己接
    expect(html).not.toContain('<button type="button" class="slot"');
  });

  it('每个可换词的状态小标都等于真实结论，没有一处靠猜', () => {
    const states = [
      INITIAL_VALUES,
      edited({ sessionPrefix: '禹贡Ⅱ' }),
      edited({ auctionHouse: '中国嘉德国际拍卖有限公司' }),
    ];
    for (const values of states) {
      for (const slot of game.slots) {
        for (const option of slot.options) {
          const next = withValue(values, slot.key, option);
          const expected = api.resolve(game, demo, next).status;
          expect(
            api.substitutionStatus(game, demo, values, slot.key, option),
            `${slot.label} → ${option} 的小标与真实结论不一致`,
          ).toBe(expected);
        }
      }
    }
  });

  it('只改一个词就能分别走到「不对」与「没覆盖」，不需要额外确认步骤', () => {
    expect(api.substitutionStatus(game, demo, INITIAL_VALUES, 'dateText', '2021年11月15日')).toBe(
      'refuted',
    );
    expect(api.substitutionStatus(game, demo, INITIAL_VALUES, 'sessionPrefix', '禹贡Ⅱ')).toBe(
      'uncovered',
    );

    const refuted = api.resolve(
      game,
      demo,
      withValue(INITIAL_VALUES, 'dateText', '2021年11月15日'),
    );
    expect(refuted.status).toBe('refuted');
    expect(refuted.view?.gate).toBe('rejected');
    expect(refuted.combo?.id).toBe('g-10');

    const uncovered = api.resolve(
      game,
      demo,
      withValue(INITIAL_VALUES, 'sessionPrefix', '禹贡Ⅱ'),
    );
    expect(uncovered.status).toBe('uncovered');
    expect(uncovered.record).toBeNull();
    expect(uncovered.view).toBeNull();
  });

  it('「没覆盖」时给出的去处都是冻结矩阵里的真组合，且改动数最少', () => {
    const states = [
      edited({ sessionPrefix: '禹贡Ⅱ' }),
      edited({ auctionHouse: '中国嘉德国际拍卖有限公司', sessionPrefix: '禹贡Ⅲ' }),
    ];
    for (const values of states) {
      expect(api.resolve(game, demo, values).status).toBe('uncovered');
      const jumps = api.nearbyCovered(game, values, 3);
      expect(jumps.length).toBeGreaterThan(0);

      const covered = coveredCombos();
      const minDistance = Math.min(...covered.map((combo) => api.distanceOf(combo.values, values)));
      expect(jumps[0].distance).toBe(minDistance);

      jumps.forEach((jump, index) => {
        expect(jump.distance).toBeGreaterThan(0);
        expect(jump.status).not.toBe('uncovered');
        expect(api.findCombo(game, jump.values)?.id).toBe(jump.id);
        expect(api.resolve(game, demo, jump.values).status).toBe(jump.status);
        if (index > 0) expect(jump.distance).toBeGreaterThanOrEqual(jumps[index - 1].distance);
      });
    }
  });

  it('选项小标里「没覆盖」与「被反驳」都出现，页面不会只剩一种结论', () => {
    const seen = new Set<string>();
    for (const combo of game.combos) {
      for (const slot of game.slots) {
        for (const option of slot.options) {
          seen.add(api.substitutionStatus(game, demo, combo.values, slot.key, option));
        }
      }
    }
    expect(seen.has('uncovered')).toBe(true);
    expect(seen.has('refuted')).toBe(true);
    expect(api.STATUS_SHORT.uncovered).toBe('没覆盖');
    expect(api.STATUS_SHORT.refuted).toBe('不对');
    for (const status of ['strong', 'weak', 'refuted', 'not_found', 'uncovered'] as const) {
      expect(api.STATUS_SHORT[status]).toBeTruthy();
    }
  });
});

describe('行距与浮层：不撑高行盒、不推动判定卡', () => {
  const html = fs.readFileSync(path.join(DOCS, 'demo-lab.html'), 'utf8');
  const labSource = fs.readFileSync(path.join(DOCS, 'assets/demo-lab.js'), 'utf8');

  /** 取某个选择器的 CSS 规则块（页面里每个选择器只出现一次） */
  function cssBlock(selector: string): string {
    const at = html.indexOf(`\n${selector}{`);
    expect(at, `找不到 ${selector} 的样式块`).toBeGreaterThan(-1);
    const end = html.indexOf('}', at);
    return html.slice(at, end);
  }

  it('句子行高只由 line-height 决定，媒体查询里不再有手机端覆盖', () => {
    const sentence = cssBlock('.sentence');
    expect(sentence).toContain('line-height:2.4');
    // 手机端曾把行高单独调成 2.15，双行与单行的行距因此跳变；这条覆盖必须消失
    const media = html.match(/@media \(max-width:860px\)\{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(media).toBeTruthy();
    expect(media).not.toContain('.sentence');
    expect(html).not.toContain('line-height:2.15');
  });

  it('词块纵向不占位：行内、无纵向内边距、无纵向边框', () => {
    const slot = cssBlock('.slot');
    expect(slot).toContain('display:inline');
    expect(slot).toContain('padding:0 6px');
    expect(slot).toContain('margin:0');
    expect(slot).not.toContain('inline-block');
    // 只留一条下划线，不能有会在上下方向撑出盒子的边框
    expect(slot).toContain('border-bottom:2px dashed');
    expect(slot).not.toMatch(/border:\s*1px/);
    expect(slot).not.toMatch(/padding:\s*1px/);
  });

  it('候选项是脱离文档流的固定定位浮层，不占句子下方的位置', () => {
    const options = cssBlock('.options');
    expect(options).toContain('position:fixed');
    expect(options).toContain('max-width:calc(100vw - 16px)');
    // 浮层不能是句子的子节点，否则句子换行时会把它一起带走或撑开
    const sentence = html.match(/<p class="sentence" id="sentence">[\s\S]*?<\/p>/)?.[0] ?? '';
    expect(sentence).toContain('class="slot"');
    expect(sentence).not.toContain('id="slot-options"');
    // 定位次序：优先词的上方，上方不够翻到下方，两头都不够才夹进视口
    expect(labSource).toContain('anchorRect.top - panelRect.height - gap');
    expect(labSource).toContain('anchorRect.bottom + gap');
    expect(labSource).toContain('window.innerWidth');
    expect(labSource).toContain('window.innerHeight');
    expect(labSource).toContain("'resize'");
    expect(labSource).toContain("'scroll'");
  });

  it('键盘路径：回车打开并进浮层、方向键选、回车确认、Esc 还焦点', () => {
    expect(labSource).toContain("element.addEventListener('keydown'");
    expect(labSource).toContain("event.key !== 'Enter'");
    expect(labSource).toContain("event.key !== ' '");
    expect(labSource).toContain('focusOptionByValue(state.values[key])');
    expect(labSource).toContain("event.key === 'ArrowRight'");
    expect(labSource).toContain("event.key === 'Escape'");
    // Esc 与「收起」都把焦点还回原来那个词
    expect(labSource).toContain('closeOptions(true)');
    // 点浮层里的词不能顺手把浮层关掉，点别处才关
    expect(labSource).toContain("event.target.closest('#slot-options')");
    expect(labSource).toContain('event.stopPropagation()');
    expect(labSource).toMatch(/closeOptions\(false\)/);
  });
});
