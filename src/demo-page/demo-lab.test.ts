// src/demo-page/demo-lab.test.ts
/**
 * 小游戏页与冻结组合矩阵的一致性测试（离线、零模型调用）
 *
 * 这一版小游戏不再按字面拼四个值，而是拿玩家写的词与冻结证据里的原文值**逐维比对**。
 * 测试守八件事：
 *
 * 1. 每个槽位至少两个候选；标了「演示用词」的值确实不在冻结数据里出现过；
 * 2. 组合矩阵里每一维的状态都能用引擎自己的维度函数复算出来（页面不另写一套规则）；
 * 3. 组合级结论取最差的那一维：有一维只到口径相容，就不会被组合级的强坐标盖掉；
 * 4. 至少两个维度达到「口径相容」及以上才算覆盖，否则不许挂记录、不许继承证据；
 * 5. 六种维度状态与八种结论在矩阵里都真实可达（各至少一组），「只找到相容证据」不是摆设；
 * 6. 玩法：每种结论只在第一次收录时给分、重复收 0 分、八档收齐正好到通关线；
 * 7. 三章任务把八种结论各要求一次，存档只认组合号（脏存档不会带出假分数）；
 * 8. 文案纪律：口径相容不许写成「对/一致/匹配」，边缘相容必须是「没有矛盾，但这不能证明」。
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { quoteMatches } from '../lodestar/adjudicate/compare';
import { compareInstitutionDimension } from '../lodestar/dimensions/institution';
import { compareTimeDimension } from '../lodestar/dimensions/time';
import { compareTextDimension } from '../lodestar/dimensions/text';
import type { EvidenceDimensionState } from '../lodestar/types';

const ROOT = path.resolve(import.meta.dirname, '../..');
const DOCS = path.join(ROOT, 'docs');

type SlotKey = 'auctionHouse' | 'dateText' | 'sessionName';
type Bucket = 'strong' | 'weak' | 'refuted' | 'not_found';
type ConclusionCode =
  | 'strong'
  | 'weak'
  | 'caliber'
  | 'edge'
  | 'conflict'
  | 'mismatch'
  | 'unknown'
  | 'uncovered';

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
  dimension: string | null;
  state: EvidenceDimensionState;
  matchedValue: string | null;
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
  dimensionState: EvidenceDimensionState | null;
  contradictorySupports: Array<{ matchedValue: string | null; quote: string; url: string }>;
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

interface DemoDerivedExample {
  id: string;
  title: string;
  claim: Array<{ label: string; value: string }>;
  evidence: Array<{ label: string; value: string }>;
  dimensions: Array<{ label: string; state: EvidenceDimensionState; weight: number; note: string }>;
  score: number;
  grade: 'strong' | 'weak';
  summary: string;
}

interface DemoData {
  generatedAt: string;
  buckets: Record<Bucket, number>;
  derivedExamples: DemoDerivedExample[];
  cases: DemoCase[];
}

interface GameSlotOption {
  value: string;
  demoOnly: boolean;
  note: string;
}

interface GameSlot {
  key: SlotKey;
  label: string;
  options: GameSlotOption[];
}

interface GameDimension {
  slot: SlotKey;
  label: string;
  value: string;
  evidenceValue: string | null;
  state: EvidenceDimensionState;
  note: string;
  demoOnly: boolean;
}

interface GameCombo {
  id: string;
  key: string;
  values: Record<SlotKey, string>;
  sentence: string;
  status: 'covered' | 'uncovered';
  recordId: string | null;
  caseId: string | null;
  recordTitle: string | null;
  gate: 'strong' | 'weak' | 'rejected' | null;
  bucket: Bucket | null;
  dimensions: GameDimension[];
  conclusion: { code: ConclusionCode; label: string; hint: string; score: number; basis: string };
  matched: Array<{ recordId: string; caseId: string; bucket: Bucket; score: number }>;
}

interface GameMissionGoal {
  code: ConclusionCode;
  label: string;
  points: number;
}

interface GameMission {
  id: string;
  title: string;
  hint: string;
  goals: GameMissionGoal[];
}

interface GameScoring {
  target: number;
  byConclusion: Record<ConclusionCode, number>;
  reasons: Record<ConclusionCode, string>;
  note: string;
}

interface GameData {
  generatedAt: string;
  generator: string;
  note: string;
  slots: GameSlot[];
  combos: GameCombo[];
  stats: {
    total: number;
    covered: number;
    uncovered: number;
    byConclusion: Record<ConclusionCode, number>;
    maxCombos: number;
  };
  missions: GameMission[];
  scoring: GameScoring;
}

interface GameResolveResult {
  status: ConclusionCode;
  label: string;
  hint: string;
  reason: string;
  combo: GameCombo | null;
  record: DemoRecord | null;
  view: Record<string, unknown> | null;
  dimensions: GameDimension[];
}

interface GameProgress {
  version: 1;
  submissions: Array<{ comboId: string; at: number }>;
}

interface SubmissionResult {
  ok: boolean;
  reason: 'new' | 'repeated-combo' | 'conclusion-taken' | 'unknown-combo';
  points: number;
  code: ConclusionCode;
  progress: GameProgress;
  cleared: boolean;
}

interface MissionState {
  id: string;
  title: string;
  hint: string;
  goals: Array<GameMissionGoal & { comboId: string | null; scored: boolean }>;
  done: number;
  complete: boolean;
}

interface GameApi {
  SLOT_KEYS: SlotKey[];
  CONCLUSION_LABELS: Record<ConclusionCode, string>;
  CONCLUSION_SHORT: Record<ConclusionCode, string>;
  CONCLUSION_HINTS: Record<ConclusionCode, string>;
  DEMO_ONLY_LEGEND: string;
  STORAGE_KEY: string;
  comboKey: (values: Record<SlotKey, string>) => string;
  findCombo: (data: GameData, values: Record<SlotKey, string>) => GameCombo | null;
  comboById: (data: GameData, id: string | null) => GameCombo | null;
  slotOptions: (data: GameData, slotKey: SlotKey) => GameSlotOption[];
  optionOf: (data: GameData, slotKey: SlotKey, value: string) => GameSlotOption | null;
  isDemoOnly: (data: GameData, slotKey: SlotKey, value: string) => boolean;
  dimensionLabel: (state: EvidenceDimensionState) => string;
  worstDimension: (dimensions: GameDimension[]) => GameDimension | null;
  resolve: (data: GameData, demo: DemoData, values: Record<SlotKey, string>) => GameResolveResult;
  substitutionStatus: (
    data: GameData,
    demo: DemoData,
    values: Record<SlotKey, string>,
    slotKey: SlotKey,
    value: string,
  ) => ConclusionCode;
  substitutionDimension: (
    data: GameData,
    demo: DemoData,
    values: Record<SlotKey, string>,
    slotKey: SlotKey,
    value: string,
  ) => { state: EvidenceDimensionState | 'uncovered'; conclusion: ConclusionCode; label: string };
  coverage: (data: GameData) => GameData['stats'];
  recordIndex: (demo: DemoData) => Record<string, DemoRecord>;
  emptyProgress: () => GameProgress;
  progressFrom: (raw: unknown, data: GameData) => GameProgress;
  pointsFor: (data: GameData, code: ConclusionCode) => number;
  targetOf: (data: GameData) => number;
  scoredCodes: (progress: GameProgress, data: GameData) => Record<string, string>;
  scoreOf: (progress: GameProgress, data: GameData) => number;
  isCleared: (progress: GameProgress, data: GameData) => boolean;
  evaluateSubmission: (
    progress: GameProgress,
    data: GameData,
    combo: GameCombo | null,
  ) => { ok: boolean; reason: SubmissionResult['reason']; points: number; code: ConclusionCode };
  submit: (
    progress: GameProgress,
    data: GameData,
    combo: GameCombo | null,
    now?: number,
  ) => SubmissionResult;
  missionStatus: (data: GameData, progress: GameProgress) => MissionState[];
  currentMission: (data: GameData, progress: GameProgress) => MissionState | null;
  nextHint: (result: GameResolveResult) => string;
}

function loadPageScripts(): { demo: DemoData; game: GameData; api: GameApi } {
  const sandbox: { window: Record<string, unknown> } = { window: {} };
  vm.createContext(sandbox);
  for (const file of [
    'assets/demo-data.js',
    'assets/demo-match.js',
    'assets/demo-game-data.js',
    'assets/demo-game-match.js',
  ]) {
    vm.runInContext(fs.readFileSync(path.join(DOCS, file), 'utf8'), sandbox, { filename: file });
  }
  return {
    demo: sandbox.window.LODESTAR_DEMO as DemoData,
    game: sandbox.window.LODESTAR_DEMO_GAME as GameData,
    api: sandbox.window.LODESTAR_GAME as GameApi,
  };
}

const { demo, game, api } = loadPageScripts();

const INITIAL_VALUES: Record<SlotKey, string> = {
  auctionHouse: '北京保利',
  dateText: '2021年12月5日',
  sessionName: '禹贡Ⅰ—盛清御瓷新风尚',
};

function allRecords(): DemoRecord[] {
  return demo.cases.flatMap((item) => item.records);
}

function recordById(): Map<string, DemoRecord> {
  return new Map(allRecords().map((record) => [record.recordId, record]));
}

function coveredCombos(): GameCombo[] {
  return game.combos.filter((combo) => combo.status === 'covered');
}

function comboOf(code: ConclusionCode): GameCombo {
  const combo = game.combos.find((item) => item.conclusion.code === code);
  expect(combo, `没有任何一组组合走到「${code}」`).toBeDefined();
  return combo as GameCombo;
}

function edited(values: Partial<Record<SlotKey, string>>): Record<SlotKey, string> {
  return { ...INITIAL_VALUES, ...values };
}

function compareSlot(slot: SlotKey, claim: string, evidence: string): { state: EvidenceDimensionState } {
  if (slot === 'auctionHouse') return compareInstitutionDimension(claim, evidence);
  if (slot === 'dateText') return compareTimeDimension(claim, evidence);
  return compareTextDimension(claim, evidence);
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
    expect(/\son[a-z]+\s*=/i.test(html)).toBe(false);
    expect(html).toContain('id="verdict"');
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain('id="identify"');
    expect(html).not.toContain('word-bank');
    const labSource = fs.readFileSync(path.join(DOCS, 'assets/demo-lab.js'), 'utf8');
    // 换词是拖卡（零依赖指针事件），结算在开箱那一刻
    expect(labSource).toContain("addEventListener('pointermove'");
    expect(labSource).toContain("addEventListener('pointerup'");
    expect(labSource).toContain("data-action=\"open-chest\"");
    expect(labSource).not.toContain('data-action="submit"');
    // 候选小标读"这一维"的判据，不是整句结论——所以要调 substitutionDimension
    expect(labSource).toContain('substitutionDimension');
    // 存档只在页面层写；规则层是纯函数，拿得到 progress 就能算，不碰浏览器存储
    expect(labSource).toContain('localStorage');
    expect(labSource).toContain('game.STORAGE_KEY');
    const rulesSource = fs.readFileSync(path.join(DOCS, 'assets', 'demo-game-match.js'), 'utf8');
    for (const source of [labSource, rulesSource]) {
      expect(source).not.toContain('fetch(');
      expect(source).not.toContain('XMLHttpRequest');
      expect(source).not.toContain('sessionStorage');
    }
    expect(rulesSource).not.toContain('localStorage');
    const dataScript = fs.readFileSync(path.join(DOCS, 'assets/demo-game-data.js'), 'utf8');
    expect(/^(?:\/\/[^\n]*\n)*window\.LODESTAR_DEMO_GAME = /.test(dataScript)).toBe(true);
  });

  it('原有 demo.html 保持独立：只借顶栏指向小游戏，不引入小游戏的脚本与判定', () => {
    const demoHtml = fs.readFileSync(path.join(DOCS, 'demo.html'), 'utf8');
    expect(demoHtml).not.toContain('LODESTAR_DEMO_GAME');
    expect(demoHtml).not.toContain('demo-game');
    expect(demoHtml).not.toContain('demo-lab.js');
    expect((demoHtml.match(/demo-lab/g) ?? []).length).toBe(1);
    expect(demoHtml).toContain('<a href="demo-lab.html">小游戏</a>');
  });

  it('八种结论各有独立标签，没覆盖不会被写成拒收', () => {
    expect(api.CONCLUSION_LABELS.strong).toBe('强坐标');
    expect(api.CONCLUSION_LABELS.weak).toBe('弱坐标');
    expect(api.CONCLUSION_LABELS.caliber).toBe('只找到相容证据');
    expect(api.CONCLUSION_LABELS.edge).toBe('没有矛盾，但这不能证明');
    expect(api.CONCLUSION_LABELS.conflict).toBe('冲突候选');
    expect(api.CONCLUSION_LABELS.uncovered).toBe('这批证据没覆盖');
    for (const label of Object.values(api.CONCLUSION_LABELS)) {
      expect(label).not.toContain('拒收');
    }
  });
});

describe('槽位候选：每个槽至少两个，演示用词必须标出来', () => {
  it('三个槽位各有至少两个候选，且互不重复', () => {
    expect(game.slots.map((slot) => slot.key)).toEqual(api.SLOT_KEYS);
    for (const slot of game.slots) {
      expect(slot.options.length, `${slot.label} 候选不足 2 个`).toBeGreaterThanOrEqual(2);
      expect(new Set(slot.options.map((option) => option.value)).size).toBe(slot.options.length);
      for (const option of slot.options) {
        expect(option.note.length).toBeGreaterThan(0);
      }
    }
  });

  it('演示用词确实不在冻结数据里出现过，非演示用词必须能逐字找到', () => {
    const records = allRecords();
    for (const slot of game.slots) {
      for (const option of slot.options) {
        const appears = records.some((record) =>
          record.fields.some((field) => field.key === slot.key && field.value === option.value),
        );
        if (option.demoOnly) {
          expect(appears, `「${option.value}」标了演示用词，却真的出现在冻结数据里`).toBe(false);
        } else {
          expect(appears, `「${option.value}」不是演示用词，但冻结数据里找不到`).toBe(true);
        }
      }
    }
  });

  it('至少一个槽位带演示用词，且页面写明它是什么', () => {
    const demoOptions = game.slots.flatMap((slot) =>
      slot.options.filter((option) => option.demoOnly).map((option) => ({ slot, option })),
    );
    expect(demoOptions.length).toBeGreaterThan(0);
    expect(api.DEMO_ONLY_LEGEND).toContain('演示用词');
    const html = fs.readFileSync(path.join(DOCS, 'demo-lab.html'), 'utf8');
    expect(html).toContain('演示用词');
    const labSource = fs.readFileSync(path.join(DOCS, 'assets', 'demo-lab.js'), 'utf8');
    expect(labSource).toContain('demoTag()');
    expect(labSource).toContain('option.demoOnly');
  });
});

describe('组合矩阵：逐维状态由引擎复算，结论取最差的那一维', () => {
  it('组合总量不超过 100，组合键唯一，句子由三个取值拼成', () => {
    expect(game.combos.length).toBeLessThanOrEqual(100);
    expect(game.stats.total).toBe(game.combos.length);
    expect(game.stats.maxCombos).toBe(100);
    const keys = new Set<string>();
    for (const combo of game.combos) {
      expect(keys.has(combo.key)).toBe(false);
      keys.add(combo.key);
      expect(combo.key).toBe(api.comboKey(combo.values));
      for (const slot of game.slots) {
        expect(slot.options.map((option) => option.value)).toContain(combo.values[slot.key]);
      }
      expect(combo.sentence).toContain(combo.values.auctionHouse);
      expect(combo.sentence).toContain(combo.values.dateText);
      expect(combo.sentence).toContain(combo.values.sessionName);
    }
  });

  it('每一维的状态都能用引擎的维度函数复算出来', () => {
    const records = recordById();
    for (const combo of game.combos) {
      expect(combo.dimensions.length).toBe(3);
      for (const dimension of combo.dimensions) {
        expect(dimension.demoOnly).toBe(
          api.isDemoOnly(game, dimension.slot, dimension.value),
        );
        if (dimension.evidenceValue === null) {
          expect(dimension.state).toBe('unknown');
          continue;
        }
        const recomputed = compareSlot(
          dimension.slot,
          dimension.value,
          dimension.evidenceValue,
        );
        expect(
          recomputed.state,
          `组合 ${combo.id} 的「${dimension.label}」状态与引擎复算不一致`,
        ).toBe(dimension.state);
      }
      for (const dimension of combo.dimensions) {
        if (dimension.evidenceValue === null) continue;
        const record = combo.recordId ? records.get(combo.recordId) : null;
        if (!record) continue;
        const evidenceValues = record.evidence
          .filter((row) => row.fieldKey === dimension.slot)
          .map((row) => row.matchedValue)
          .filter((value): value is string => typeof value === 'string');
        const claimValue = record.fields.find((field) => field.key === dimension.slot)?.value;
        expect(
          evidenceValues.includes(dimension.evidenceValue) || dimension.evidenceValue === claimValue,
          `组合 ${combo.id} 的「${dimension.label}」原文值「${dimension.evidenceValue}」既不在证据行里、也不是断言本身`,
        ).toBe(true);
      }
    }
  });

  it('结论等于最差那一维：有口径相容就不能写成对上，有冲突就先否决', () => {
    const severity: EvidenceDimensionState[] = [
      'conflict',
      'mismatch',
      'unknown',
      'edge',
      'caliber',
      'exact',
    ];
    for (const combo of game.combos) {
      if (combo.status !== 'covered') {
        expect(combo.conclusion.code).toBe('uncovered');
        continue;
      }
      const worst = severity.find((state) =>
        combo.dimensions.some((dimension) => dimension.state === state),
      );
      expect(worst).toBeDefined();
      if (worst === 'exact') {
        expect(combo.conclusion.code).toBe(combo.gate === 'strong' ? 'strong' : 'weak');
      } else {
        expect(combo.conclusion.code).toBe(worst);
      }
      expect(api.worstDimension(combo.dimensions)?.state).toBe(worst);
    }
  });

  it('至少两个维度到「口径相容」及以上才算覆盖', () => {
    for (const combo of game.combos) {
      const positive = combo.dimensions.filter(
        (dimension) =>
          dimension.state === 'exact' ||
          dimension.state === 'caliber' ||
          dimension.state === 'edge',
      ).length;
      expect(combo.status).toBe(positive >= 2 ? 'covered' : 'uncovered');
    }
  });
});

describe('覆盖组合与冻结记录逐条一致', () => {
  it('覆盖组合指向的记录、门禁、档位、标题都对得上', () => {
    const records = recordById();
    for (const combo of coveredCombos()) {
      expect(combo.recordId).not.toBeNull();
      const record = records.get(combo.recordId ?? '');
      expect(record, `组合 ${combo.id} 指向了不存在的记录 ${combo.recordId}`).toBeDefined();
      if (!record) continue;
      expect(combo.caseId).toBe(record.caseId);
      expect(combo.gate).toBe(record.computation.gate);
      expect(combo.bucket).toBe(record.bucket);
      expect(combo.recordTitle).toBe(record.title);

      const resolved = api.resolve(game, demo, combo.values);
      expect(resolved.status).toBe(combo.conclusion.code);
      expect(resolved.label).toBe(api.CONCLUSION_LABELS[combo.conclusion.code]);
      expect(resolved.record?.recordId).toBe(record.recordId);
      expect(resolved.view).not.toBeNull();
    }
  });

  it('没覆盖的组合不挂任何记录，也不继承任何证据', () => {
    for (const combo of game.combos.filter((item) => item.status === 'uncovered')) {
      expect(combo.recordId).toBeNull();
      expect(combo.caseId).toBeNull();
      expect(combo.gate).toBeNull();
      expect(combo.bucket).toBeNull();
      const resolved = api.resolve(game, demo, combo.values);
      expect(resolved.status).toBe('uncovered');
      expect(resolved.record).toBeNull();
      expect(resolved.view).toBeNull();
      expect(resolved.combo?.id).toBe(combo.id);
      expect(resolved.reason).toContain('没有一条冻结记录同时在两个词上');
    }
  });

  it('逐字子串校验照旧：原文值必须能在本行引文里逐字找到', () => {
    for (const record of allRecords()) {
      for (const row of record.evidence) {
        expect(row.fetchedAt).toBeTruthy();
        if (!row.matchedValue) continue;
        expect(
          row.quote.replace(/\s+/g, ' ').includes(row.matchedValue.replace(/\s+/g, ' ')),
          `${row.evidenceId} 的原文值「${row.matchedValue}」不在本行引文里`,
        ).toBe(true);
      }
    }
  });

  it('小游戏引用的原文值所在引文，仍能在快照里找到', () => {
    const sourceByUrl = new Map(
      demo.cases.flatMap((item) => item.sources.map((source) => [source.url, source] as const)),
    );
    const records = recordById();
    const checked = new Set<string>();
    for (const combo of coveredCombos()) {
      const record = records.get(combo.recordId ?? '');
      if (!record) continue;
      for (const dimension of combo.dimensions) {
        if (dimension.evidenceValue === null) continue;
        for (const row of record.evidence) {
          if (row.fieldKey !== dimension.slot || row.matchedValue !== dimension.evidenceValue) continue;
          if (checked.has(row.evidenceId)) continue;
          checked.add(row.evidenceId);
          const source = sourceByUrl.get(row.url);
          expect(source, `${row.url} 没有快照节选`).toBeDefined();
          if (source) expect(quoteMatches(row.quote, source.excerpt)).toBe(true);
        }
      }
    }
    expect(checked.size).toBeGreaterThan(0);
  });
});

describe('六种维度状态与八种结论都真实可达', () => {
  it('六种判据状态各至少出现在一个组合里', () => {
    for (const state of ['exact', 'caliber', 'edge', 'conflict', 'mismatch', 'unknown'] as const) {
      const present = game.combos.some((combo) =>
        combo.dimensions.some((dimension) => dimension.state === state),
      );
      expect(present, `判据状态「${api.dimensionLabel(state)}」走不到`).toBe(true);
    }
  });

  it('八种结论各至少有一组，且统计数与矩阵现场数出来的一致', () => {
    const codes: ConclusionCode[] = [
      'strong',
      'weak',
      'caliber',
      'edge',
      'conflict',
      'mismatch',
      'unknown',
      'uncovered',
    ];
    for (const code of codes) {
      const count = game.combos.filter((combo) => combo.conclusion.code === code).length;
      expect(count, `结论「${api.CONCLUSION_LABELS[code]}」一组都走不到`).toBeGreaterThan(0);
      expect(game.stats.byConclusion[code]).toBe(count);
    }
    const stats = api.coverage(game);
    expect(stats.total).toBe(game.combos.length);
    expect(stats.covered).toBe(coveredCombos().length);
    expect(stats.uncovered).toBe(game.combos.length - coveredCombos().length);
  });

  it('「只找到相容证据」这一组确实有一维是口径相容、且没有任何一维冲突', () => {
    const combo = comboOf('caliber');
    expect(combo.dimensions.some((dimension) => dimension.state === 'caliber')).toBe(true);
    expect(combo.dimensions.every((dimension) => dimension.state !== 'conflict')).toBe(true);
    const resolved = api.resolve(game, demo, combo.values);
    expect(resolved.status).toBe('caliber');
    expect(resolved.reason).toContain('口径相容');
    expect(resolved.reason).toContain('不能算对上');
  });

  it('「没有矛盾，但这不能证明」只出现在边缘相容那一组', () => {
    const combo = comboOf('edge');
    expect(combo.dimensions.some((dimension) => dimension.state === 'edge')).toBe(true);
    expect(api.CONCLUSION_LABELS.edge).toBe('没有矛盾，但这不能证明');
    const resolved = api.resolve(game, demo, combo.values);
    expect(resolved.reason).toContain('没有矛盾，但这不能证明');
  });

  it('「没覆盖」不挂记录，「没对上」必须有一维的证据写的是别的值', () => {
    const mismatch = comboOf('mismatch');
    expect(mismatch.dimensions.some((dimension) => dimension.state === 'mismatch')).toBe(true);
    const uncovered = comboOf('uncovered');
    expect(uncovered.recordId).toBeNull();
  });
});

describe('改词即出结论：候选小标与真实结论一致', () => {
  it('三个槽位是可聚焦的换词出口，候选词做成托盘里的可拖卡牌', () => {
    const html = fs.readFileSync(path.join(DOCS, 'demo-lab.html'), 'utf8');
    expect((html.match(/class="slot"/g) ?? []).length).toBe(3);
    expect((html.match(/role="button" tabindex="0" data-slot=/g) ?? []).length).toBe(3);
    // 旧的下拉/一排按钮/浮层选词卡都不在页面里
    expect(html).not.toContain('id="slot-options"');
    expect(html).not.toContain('<select');
    expect(html).not.toContain('<datalist');
    expect(html).not.toContain('<button type="button" class="slot"');
    // 新的三块：候选卡托盘、宝箱坞、下一步提示
    expect(html).toContain('id="tray-list"');
    expect(html).toContain('id="tray-slot"');
    expect(html).toContain('id="chest-dock"');
    expect(html).toContain('id="loop-hint"');
  });

  it('每个候选的小标读的是「这一维」的判据，不是整句结论', () => {
    const states = [INITIAL_VALUES, comboOf('caliber').values, comboOf('edge').values, comboOf('conflict').values];
    for (const values of states) {
      for (const slot of game.slots) {
        for (const option of slot.options) {
          const next = { ...values, [slot.key]: option.value };
          const combo = api.findCombo(game, next);
          const got = api.substitutionDimension(game, demo, values, slot.key, option.value);
          expect(got.label.length).toBeGreaterThan(0);
          if (!combo) {
            expect(got.state).toBe('uncovered');
            continue;
          }
          const dimension = combo.dimensions.find((item) => item.slot === slot.key);
          expect(
            got.state,
            `${slot.label} → ${option.value} 的小标不是这一维的状态`,
          ).toBe(dimension ? dimension.state : 'uncovered');
          expect(got.conclusion).toBe(combo.conclusion.code);
          // 整句结论另有出口，小标不能把它顶掉
          expect(api.substitutionStatus(game, demo, values, slot.key, option.value)).toBe(
            combo.conclusion.code,
          );
        }
      }
    }
  });

  it('没覆盖的组合也留着逐维结果，判定卡才能摆出「最接近那条」的各维状态', () => {
    const uncovered = comboOf('uncovered');
    expect(uncovered.dimensions.length).toBe(3);
    const positive = uncovered.dimensions.filter(
      (dimension) =>
        dimension.state === 'exact' ||
        dimension.state === 'caliber' ||
        dimension.state === 'edge',
    );
    expect(positive.length).toBeLessThan(2);
    const labSource = fs.readFileSync(path.join(DOCS, 'assets', 'demo-lab.js'), 'utf8');
    expect(labSource).toContain('renderUncoveredDimensions');
  });

  it('原句是强坐标；把时间换成 2021年8月 就停到「只找到相容证据」', () => {
    expect(api.resolve(game, demo, INITIAL_VALUES).status).toBe('strong');
    const values = edited({ dateText: '2021年8月', sessionName: '禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术' });
    const resolved = api.resolve(game, demo, values);
    expect(resolved.status).toBe('caliber');
    const timeDimension = resolved.dimensions.find((dimension) => dimension.slot === 'dateText');
    expect(timeDimension?.state).toBe('caliber');
    expect(timeDimension?.evidenceValue).toBe('2021年秋季');
  });

  it('「没覆盖」给的下一步是方向而不是答案：点名还差几维、先动哪一列', () => {
    const res = api.resolve(game, demo, comboOf('uncovered').values);
    const hint = api.nextHint(res);
    expect(hint).toContain('维沾边');
    expect(hint).toContain('至少');
    expect(hint).not.toContain('点下面');
  });

  it('口径相容与冲突候选的下一步用各自的纪律说话', () => {
    expect(api.nextHint(api.resolve(game, demo, comboOf('caliber').values))).toContain('不能算对上');
    expect(api.nextHint(api.resolve(game, demo, comboOf('conflict').values))).toContain('冲突只作候选');
    expect(api.nextHint(api.resolve(game, demo, INITIAL_VALUES))).toBe('');
  });
});

describe('玩法：收进图鉴、按结论计分、防刷分', () => {
  const ORDER: ConclusionCode[] = [
    'strong',
    'weak',
    'caliber',
    'edge',
    'conflict',
    'mismatch',
    'unknown',
    'uncovered',
  ];

  /** 每种结论各收第一次出现的那一组 */
  function playThrough(): { progress: GameProgress; score: number } {
    let progress = api.emptyProgress();
    ORDER.forEach((code, index) => {
      const combo = comboOf(code);
      const result = api.submit(progress, game, combo, 1_700_000_000_000 + index);
      expect(result.ok, `「${code}」收不进去：${result.reason}`).toBe(true);
      progress = result.progress;
    });
    return { progress, score: api.scoreOf(progress, game) };
  }

  it('八种结论各收一次正好到通关线，且六种维度状态全部亲眼见过', () => {
    expect(game.scoring.target).toBe(
      ORDER.reduce((sum, code) => sum + game.scoring.byConclusion[code], 0),
    );
    const { progress, score } = playThrough();
    expect(score).toBe(game.scoring.target);
    expect(api.isCleared(progress, game)).toBe(true);

    const states = new Set<EvidenceDimensionState>();
    for (const item of progress.submissions) {
      const combo = api.comboById(game, item.comboId);
      expect(combo).not.toBeNull();
      for (const dimension of combo?.dimensions ?? []) states.add(dimension.state);
    }
    expect([...states].sort()).toEqual(
      ['caliber', 'conflict', 'edge', 'exact', 'mismatch', 'unknown'].sort(),
    );
  });

  it('通关前不算通关：少收一档就差那一档的分', () => {
    const { progress } = playThrough();
    const last = progress.submissions[progress.submissions.length - 1];
    const partial: GameProgress = {
      version: 1,
      submissions: progress.submissions.filter((item) => item.comboId !== last.comboId),
    };
    expect(api.scoreOf(partial, game)).toBe(
      game.scoring.target - game.scoring.byConclusion.uncovered,
    );
    expect(api.isCleared(partial, game)).toBe(false);
    expect(api.currentMission(game, partial)?.id).toBe('m3');
  });

  it('同一组重复收是 0 分：连收 20 次总分不变', () => {
    const combo = comboOf('strong');
    const first = api.submit(api.emptyProgress(), game, combo, 1);
    expect(first.ok).toBe(true);
    expect(first.points).toBe(game.scoring.byConclusion.strong);
    let progress = first.progress;
    for (let i = 0; i < 20; i += 1) {
      const again = api.submit(progress, game, combo, 2 + i);
      expect(again.ok).toBe(false);
      expect(again.reason).toBe('repeated-combo');
      expect(again.points).toBe(0);
      progress = again.progress;
    }
    expect(api.scoreOf(progress, game)).toBe(first.points);
  });

  it('换个组合收同一个结论，也是 0 分', () => {
    const mismatches = game.combos.filter((combo) => combo.conclusion.code === 'mismatch');
    expect(mismatches.length).toBeGreaterThan(1);
    const first = api.submit(api.emptyProgress(), game, mismatches[0], 1);
    expect(first.ok).toBe(true);
    const again = api.submit(first.progress, game, mismatches[1], 2);
    expect(again.ok).toBe(false);
    expect(again.reason).toBe('conclusion-taken');
    expect(again.points).toBe(0);
    expect(api.scoreOf(again.progress, game)).toBe(first.points);
  });

  it('总分只由「收了哪些结论」决定，与提交顺序无关', () => {
    const forward = playThrough().score;
    let reversed = api.emptyProgress();
    [...ORDER].reverse().forEach((code, index) => {
      reversed = api.submit(reversed, game, comboOf(code), index + 1).progress;
    });
    expect(api.scoreOf(reversed, game)).toBe(forward);
    expect(api.scoreOf(reversed, game)).toBe(game.scoring.target);
  });

  it('存档只认组合号：未知组合、重复组合、重复结论都会被丢掉', () => {
    const { progress } = playThrough();
    const raw = JSON.parse(JSON.stringify(progress)) as GameProgress;
    const dirty = {
      version: 1,
      submissions: [
        { comboId: 'g-999', at: 1 },
        ...raw.submissions,
        ...raw.submissions,
        { comboId: raw.submissions[0].comboId, at: 2 },
      ],
    };
    const restored = api.progressFrom(dirty, game);
    expect(restored.submissions.length).toBe(ORDER.length);
    expect(api.scoreOf(restored, game)).toBe(game.scoring.target);
    expect(api.progressFrom({ version: 2, submissions: [] }, game).submissions).toEqual([]);
    expect(api.progressFrom('nope', game).submissions).toEqual([]);
    expect(api.progressFrom(null, game).submissions).toEqual([]);
  });

  it('三章任务把八种结论各要求一次，每档都真有组合可达', () => {
    const missions = api.missionStatus(game, api.emptyProgress());
    expect(missions.length).toBe(3);
    const required = missions.flatMap((mission) => mission.goals.map((goal) => goal.code));
    expect(required.sort()).toEqual([...ORDER].sort());
    expect(new Set(required).size).toBe(required.length);
    for (const mission of missions) {
      expect(mission.done).toBe(0);
      expect(mission.complete).toBe(false);
      for (const goal of mission.goals) {
        expect(game.combos.some((combo) => combo.conclusion.code === goal.code)).toBe(true);
        expect(goal.points).toBe(game.scoring.byConclusion[goal.code]);
      }
    }
    expect(api.currentMission(game, api.emptyProgress())?.id).toBe('m1');
  });

  it('计分表：每一档都有分与理由，页面把分数表与存档口都摆出来', () => {
    for (const code of ORDER) {
      expect(game.scoring.byConclusion[code]).toBeGreaterThan(0);
      expect(game.scoring.reasons[code].length).toBeGreaterThan(0);
    }
    const descending = [...ORDER].slice(0, 4).map((code) => game.scoring.byConclusion[code]);
    expect(descending).toEqual([...descending].sort((a, b) => b - a));
    const html = fs.readFileSync(path.join(DOCS, 'demo-lab.html'), 'utf8');
    for (const id of [
      'score-value',
      'score-target',
      'score-fill',
      'score-table-body',
      'mission-list',
      'review-body',
      'reset-progress',
      'toast',
    ]) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(api.STORAGE_KEY).toContain('demo-lab');
  });

  it('页面不再提供"一键跳到答案"的入口', () => {
    const html = fs.readFileSync(path.join(DOCS, 'demo-lab.html'), 'utf8');
    const labSource = fs.readFileSync(path.join(DOCS, 'assets', 'demo-lab.js'), 'utf8');
    const rulesSource = fs.readFileSync(path.join(DOCS, 'assets', 'demo-game-match.js'), 'utf8');
    expect(html).not.toContain('reveal-list');
    expect(html).not.toContain('每种结论挑一条');
    expect(labSource).not.toContain('representatives');
    expect(rulesSource).not.toContain('representatives');
    expect(rulesSource).not.toContain('nearbyCovered');
  });
});

describe('文案纪律', () => {
  it('口径相容不许写成「对 / 一致 / 匹配」', () => {
    const label = api.CONCLUSION_SHORT.caliber;
    expect(label).toBe('口径相容');
    for (const word of ['对', '一致', '匹配']) {
      expect(api.CONCLUSION_LABELS.caliber.includes(word)).toBe(false);
      expect(api.CONCLUSION_HINTS.caliber.includes(`「${word}」`)).toBe(false);
    }
    expect(api.CONCLUSION_LABELS.caliber).toBe('只找到相容证据');
    expect(api.CONCLUSION_HINTS.caliber).toContain('不能算对上');
  });

  it('边缘相容的说明是「没有矛盾，但这不能证明」', () => {
    expect(api.CONCLUSION_LABELS.edge).toBe('没有矛盾，但这不能证明');
    expect(api.CONCLUSION_HINTS.edge).toContain('没有矛盾，但这不能证明');
  });

  it('冲突只作候选，不压成「反对」', () => {
    expect(api.CONCLUSION_SHORT.conflict).toBe('冲突候选');
    expect(api.CONCLUSION_HINTS.conflict).toContain('不压成「反对」');
  });
});

describe('判据与裁决不一致的行：不计入支持、页面要写出来', () => {
  it('模型判支持而判据判冲突的行，支持数被剔掉，且带原文值留档', () => {
    const flagged: Array<{ recordId: string; fieldKey: string; verdict: DemoFieldVerdict }> = [];
    for (const record of allRecords()) {
      for (const [fieldKey, verdict] of Object.entries(record.computation.fieldVerdicts)) {
        if ((verdict.contradictorySupports ?? []).length > 0) {
          flagged.push({ recordId: record.recordId, fieldKey, verdict });
        }
      }
    }
    expect(flagged.length, '这批数据里应当仍有「支持 + 冲突候选」的行').toBeGreaterThan(0);
    for (const item of flagged) {
      const supports = allRecords()
        .find((record) => record.recordId === item.recordId)
        ?.evidence.filter(
          (row) => row.fieldKey === item.fieldKey && row.relation === 'supports',
        );
      expect(supports?.length ?? 0).toBeGreaterThan(0);
      // 剔掉之后支持数必须严格小于原来的支持行数
      expect(item.verdict.supportCount).toBeLessThan(supports?.length ?? 0);
      expect(item.verdict.dimensionState).toBe('conflict');
      for (const row of item.verdict.contradictorySupports) {
        expect(row.url).toMatch(/^https?:\/\//);
        expect(row.quote.length).toBeGreaterThan(0);
      }
    }
  });

  it('两页演示都写了「模型裁决与判据不一致」，不是悄悄改数', () => {
    for (const file of ['assets/demo.js', 'assets/demo-lab.js']) {
      const source = fs.readFileSync(path.join(DOCS, file), 'utf8');
      expect(source).toContain('模型裁决与判据不一致');
      expect(source).toContain('不计入支持');
    }
  });
});

describe('一屏之内：固定视口、面板翻卡、候选不撑页', () => {
  const html = fs.readFileSync(path.join(DOCS, 'demo-lab.html'), 'utf8');
  const labSource = fs.readFileSync(path.join(DOCS, 'assets', 'demo-lab.js'), 'utf8');

  function cssBlock(selector: string): string {
    const at = html.indexOf(`\n${selector}{`);
    expect(at, `找不到 ${selector} 的样式块`).toBeGreaterThan(-1);
    const end = html.indexOf('}', at);
    return html.slice(at, end);
  }

  it('整页定高：body 占满视口不滚动，游戏主体吃剩下的高度', () => {
    const body = cssBlock('body');
    expect(body).toContain('height:100dvh');
    expect(body).toContain('overflow:hidden');
    expect(body).toContain('display:flex');
    const gameBlock = cssBlock('.game');
    expect(gameBlock).toContain('flex:1');
    expect(gameBlock).toContain('min-height:0');
    // 宝箱光晕会溢出动作坞：裁在游戏区里，别让装饰把文档撑出滚动条
    expect(gameBlock).toContain('overflow:clip');
    expect(cssBlock('.stage')).toContain('min-height:0');
  });

  it('判定卡独占绝对定位区域，候选托盘与宝箱坞各占一行，换词不把页面撑高', () => {
    const wrap = cssBlock('.panel-wrap');
    expect(wrap).toContain('position:relative');
    expect(wrap).toContain('flex:1');
    expect(wrap).toContain('min-height:0');
    const verdict = cssBlock('.verdict');
    expect(verdict).toContain('position:absolute');
    expect(verdict).toContain('inset:0');
    // 托盘与动作坞固定在布局里，靠内部横向滚动收纳候选，不撑高页面
    const tray = cssBlock('.tray');
    expect(tray).toContain('flex:0 0 auto');
    const strip = cssBlock('.tray-strip');
    expect(strip).toContain('overflow-x:auto');
    expect(strip).toContain('overscroll-behavior-x:contain');
    const dock = cssBlock('.dock');
    expect(dock).toContain('flex:0 0 auto');
    expect(cssBlock('.chest-dock')).toContain('position:relative');
    // 宝箱与飞分都在这一屏里：宝箱坞占位固定，飞分用 fixed 覆盖层
    expect(cssBlock('.fx-fly')).toContain('position:fixed');
    const sentence = html.match(/<p class="sentence" id="sentence">[\s\S]*?<\/p>/)?.[0] ?? '';
    expect(sentence).toContain('class="slot"');
    expect(sentence).not.toContain('id="slot-options"');
    // 托盘不再靠量位置来浮在句子旁边
    expect(labSource).not.toContain('anchorRect');
    expect(labSource).not.toContain("addEventListener('scroll'");
    expect(labSource).not.toContain("addEventListener('resize'");
  });

  it('长内容收进底部抽屉：任务 / 分数 / 复盘 / 证据 / 说明，点开才展开', () => {
    expect(html).toContain('id="sheet"');
    expect(html).toContain('aria-modal="true"');
    for (const panel of ['missions', 'score', 'review', 'evidence', 'help']) {
      expect(html).toContain(`data-sheet-panel="${panel}"`);
    }
    for (const entry of ['missions', 'score', 'review', 'help']) {
      expect(html).toContain(`data-sheet="${entry}"`);
    }
    expect(html).toContain('id="evidence-inline"');
    expect(html).toContain('id="full-panel"');
    // 抽屉里的长内容自己滚，不带着整页一起滚
    const sheetBody = cssBlock('.sheet-body');
    expect(sheetBody).toContain('overflow:auto');
    expect(labSource).toContain('function openSheet');
    expect(labSource).toContain('function closeSheet');
    expect(labSource).toContain('trapSheetTab');
  });

  it('句子行高只由 line-height 决定，媒体查询里没有手机端覆盖', () => {
    const sentence = cssBlock('.sentence');
    expect(sentence).toContain('line-height:1.9;');
    const media = html.match(/@media \(max-width:560px\)\{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(media).toBeTruthy();
    expect(media).not.toMatch(/\.sentence\{[^}]*line-height/);
    expect(html).not.toContain('line-height:2.15');
  });

  it('词块纵向不占位：行内、无纵向内边距、无纵向边框', () => {
    const slot = cssBlock('.slot');
    expect(slot).toContain('display:inline');
    expect(slot).toContain('padding:0 6px');
    expect(slot).toContain('margin:0');
    expect(slot).not.toContain('inline-block');
    expect(slot).toContain('border-bottom:2px dashed');
    expect(slot).not.toMatch(/border:\s*1px/);
    expect(slot).not.toMatch(/padding:\s*1px/);
  });

  it('动效走 CSS：判定翻面、开箱、粒子、入册、通关礼花，并且尊重「减少动效」', () => {
    for (const keyframe of [
      'card-flip',
      'chest-bob',
      'chest-glow',
      'spark-out',
      'dex-pop',
      'confetti-fall',
      'banner-in',
    ]) {
      expect(html, `缺少 ${keyframe} 动效`).toContain(`@keyframes ${keyframe}`);
    }
    expect(html).toContain('@media (prefers-reduced-motion:reduce)');
    expect(html).toContain('.fx{display:none}');
    expect(labSource).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
    expect(labSource).toContain('function celebrate');
    expect(labSource).toContain('function openChest');
    expect(labSource).toContain('function flyPoints');
  });

  it('音效默认关闭，只在玩家操作时响，不自动播放', () => {
    expect(html).toContain('id="sound-toggle"');
    expect(html).toContain('aria-pressed="false"');
    expect(labSource).toContain('soundOn: false');
    expect(labSource).toContain('AudioContext');
    // 音频节点只在 playTone 里创建，而 playTone 第一句就是"没开就返回"
    const playTone = labSource.slice(labSource.indexOf('function playTone'));
    expect(playTone.indexOf('if (!state.soundOn) return;')).toBeGreaterThan(-1);
    expect(playTone.indexOf('if (!state.soundOn) return;')).toBeLessThan(
      playTone.indexOf('new Ctor()'),
    );
  });

  it('键盘等价路径：聚焦槽位 → 左右方向键切词 → 回车开箱，候选卡也能键盘操作', () => {
    expect(labSource).toContain("element.addEventListener('keydown'");
    expect(labSource).toContain("event.key === 'ArrowLeft' || event.key === 'ArrowRight'");
    expect(labSource).toContain('cycleOption');
    // 回车在槽位上有宝箱就开箱，没有宝箱才把焦点交给当前卡
    expect(labSource).toContain('if (state.chest)');
    expect(labSource).toContain('openChest()');
    expect(labSource).toContain("trayList.addEventListener('keydown'");
    expect(labSource).toContain("event.key === 'Escape'");
    expect(labSource).toContain('focusSlot(state.activeSlot)');
    // 拖拽不是唯一路径：槽位与卡都是可聚焦元素
    expect(html).toContain('role="button" tabindex="0" data-slot=');
  });
});

describe('宝箱领取：判定不直接加分，开箱才结算', () => {
  const html = fs.readFileSync(path.join(DOCS, 'demo-lab.html'), 'utf8');
  const labSource = fs.readFileSync(path.join(DOCS, 'assets/demo-lab.js'), 'utf8');

  it('八档各有自己的箱子配色，重复与该档已收给空箱，通关后不再出箱', () => {
    for (const code of [
      'strong',
      'weak',
      'caliber',
      'edge',
      'conflict',
      'mismatch',
      'unknown',
      'uncovered',
    ]) {
      expect(html, `缺少 ${code} 档宝箱配色`).toContain(`.chest-${code}{`);
    }
    expect(html).toContain('.chest-empty{');
    expect(labSource).toContain("'chest chest-' + chest.code");
    expect(labSource).toContain('chest-empty is-empty');
    // 通关判断在摆箱之前：已通关就不出箱
    expect(labSource).toContain('if (game.isCleared(state.progress, data)) {');
    expect(labSource).toContain('chest-medal');
    // 计分只发生在 openChest 里：换词、拖卡都不会偷偷加分
    expect((labSource.match(/game\.submit\(/g) ?? []).length).toBe(1);
    expect(labSource.indexOf('function openChest')).toBeLessThan(
      labSource.indexOf('game.submit('),
    );
  });

  it('开箱有实感：箱盖开启、光溢出、粒子、分数飞进图鉴格', () => {
    expect(html).toContain('.chest.is-open .chest-lid');
    expect(html).toContain('.chest.is-open .chest-beam');
    expect(html).toContain('.chest.is-open .chest-glow');
    expect(html).toContain('.chest-spark');
    expect(html).toContain('.chest-points');
    expect(html).toContain('.dex-cell.is-arriving');
    expect(labSource).toContain('function spawnSparks');
    expect(labSource).toContain('function flyPoints');
    expect(labSource).toContain('dexCellRect');
    // 飞分用轻量 WAAPI，失败也有兜底，不会卡住不结算
    expect(labSource).toContain('node.animate(');
    expect(labSource).toContain('window.setTimeout(finish, 1000)');
    expect(labSource).toContain('landed');
  });

  it('减少动效时开箱与结算照走：特效降级、状态不等动画', () => {
    expect(labSource).toContain('if (reducedMotion() || !fromRect || !toRect)');
    expect(labSource).toContain('if (reducedMotion()) return;');
    // 分数先落盘、再放动画：动画只是表现层
    const openChest = labSource.slice(labSource.indexOf('function openChest'));
    expect(openChest.indexOf('saveProgress()')).toBeGreaterThan(-1);
    expect(openChest.indexOf('saveProgress()')).toBeLessThan(openChest.indexOf('flyPoints('));
  });

  it('拖拽是零依赖指针事件：拖动、槽位高亮、松手吸附、非法落点回弹', () => {
    expect(labSource).toContain("addEventListener('pointerdown'");
    expect(labSource).toContain("addEventListener('pointerup'");
    expect(labSource).toContain("addEventListener('pointercancel'");
    expect(labSource).toContain('function startGhost');
    expect(labSource).toContain('function snapGhost');
    expect(labSource).toContain('is-drop-target');
    expect(labSource).toContain('document.elementFromPoint');
    // 触屏横滑交给原生滚动，向上拖才是换词
    expect(html).toContain('touch-action:pan-x');
    expect(labSource).toContain('press.touch && Math.abs(dx) > Math.abs(dy)');
    // 没有任何第三方拖拽库
    expect(labSource).not.toContain('Sortable');
    expect(labSource).not.toContain('interact.js');
    expect(labSource).not.toContain('draggable="true"');
    // 拖拽期间不碰判定卡：落定后才 flushCommit
    const moveHandler = labSource.slice(
      labSource.indexOf('function onCardPointerMove'),
      labSource.indexOf('function onCardPointerUp'),
    );
    expect(moveHandler).not.toContain('paintVerdict');
    expect(moveHandler).not.toContain('flushCommit');
  });
});

describe('旁挂产物与推演示例', () => {
  it('回填过的专场名不再把整句报道当成专场名', () => {
    const rows: Array<{ matchedValue?: string | null; dimension?: string | null }> = [];
    for (const dir of fs.readdirSync(path.join(ROOT, 'examples'))) {
      const file = path.join(ROOT, 'examples', dir, 'evidence.enriched.jsonl');
      if (!fs.existsSync(file)) continue;
      rows.push(
        ...fs
          .readFileSync(file, 'utf8')
          .split(/\r?\n/)
          .filter((line) => line.trim() !== '')
          .map((line) => JSON.parse(line) as { matchedValue?: string | null; dimension?: string | null }),
      );
    }
    const sessionRows = rows.filter(
      (row) => row.dimension === 'porcelain:sessionName' && typeof row.matchedValue === 'string',
    );
    expect(sessionRows.length).toBeGreaterThan(0);
    for (const row of sessionRows) {
      const value = row.matchedValue as string;
      expect(value.length, `专场名过长：${value}`).toBeLessThanOrEqual(32);
      expect(/[。！？；，,]/.test(value), `专场名带句读标点：${value}`).toBe(false);
      expect(/(圆满|收官|落幕|举行|举办|开拍|落槌|预展)/.test(value), `专场名是报道句：${value}`).toBe(
        false,
      );
      expect(value.endsWith('拍卖会'), `专场名其实是一场拍卖会的名字：${value}`).toBe(false);
    }
  });

  it('推演示例与采集记录分开摆：两组档位写在数据里，页面上标明不是采集记录', () => {
    const examples = demo.derivedExamples;
    expect(examples.length).toBe(2);
    const byId = new Map(examples.map((item) => [item.id, item]));
    const strongExample = byId.get('derived-autumn-jd');
    const weakExample = byId.get('derived-autumn-dec');
    expect(strongExample?.grade).toBe('strong');
    expect(strongExample?.score).toBe(1.7);
    expect(strongExample?.dimensions.map((dimension) => dimension.state)).toEqual([
      'caliber',
      'exact',
    ]);
    expect(weakExample?.grade).toBe('weak');
    expect(weakExample?.score).toBe(0.3);
    expect(weakExample?.dimensions.map((dimension) => dimension.state)).toEqual(['edge']);

    const demoHtml = fs.readFileSync(path.join(DOCS, 'demo.html'), 'utf8');
    expect(demoHtml).toContain('id="derived"');
    expect(demoHtml).toContain('按规则推演的示例，不是采集记录');
    const demoJs = fs.readFileSync(path.join(DOCS, 'assets', 'demo.js'), 'utf8');
    expect(demoJs).toContain('renderDerived');
    expect(demoJs).toContain('derivedExamples');
  });
});
