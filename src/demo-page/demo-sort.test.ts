// src/demo-page/demo-sort.test.ts
/**
 * 「证据分拣」小游戏与冻结语料的一致性测试（离线、零模型调用）
 *
 * 这个页面不重算判定——每条说法的状态是构建时用引擎的维度函数算好、冻结进
 * `docs/assets/demo-sort-data.js` 的。测试守六件事：
 *
 * 1. 每条说法的状态都能用引擎自己的 compareXxxDimension 复算出来（页面没有偷偷放宽）；
 * 2. 六种维度状态一局里都碰得到，不许有一种只写在说明里；
 * 3. 器物卡必须挂在冻结矩阵里真实覆盖的记录上，不是编出来的句子；
 * 4. 「演示用词」标记只给冻结语料里确实没有的写法，真出现过的写法不许标成编的；
 * 5. 计分：命中＝10×倍率、相容冻结连击、冲突掉心，倍率分段与上限可复算；
 * 6. 满分局复算出来的分数与数据里的 perfectScore 一致，分数线单调。
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { compareInstitutionDimension } from '../lodestar/dimensions/institution';
import { compareTimeDimension } from '../lodestar/dimensions/time';
import { compareTextDimension } from '../lodestar/dimensions/text';
import type { EvidenceDimensionState } from '../lodestar/types';

const ROOT = path.resolve(import.meta.dirname, '../..');
const DOCS = path.join(ROOT, 'docs');
const SORT_DATA = path.join(DOCS, 'assets', 'demo-sort-data.js');
const SORT_SCRIPT = path.join(DOCS, 'assets', 'demo-sort.js');
const GAME_DATA = path.join(DOCS, 'assets', 'demo-game-data.js');
const DEMO_DATA = path.join(DOCS, 'assets', 'demo-data.js');

type SlotKey = 'auctionHouse' | 'dateText' | 'sessionName';

interface SortChip {
  id: string;
  slot: SlotKey;
  slotLabel: string;
  short: string;
  value: string;
  state: EvidenceDimensionState;
  note: string;
  demoOnly: boolean;
  fromRecord: boolean;
}

interface SortRound {
  id: string;
  lot: { comboId: string; recordId: string; recordTitle: string; gate: string; values: Record<SlotKey, string> };
  truth: Array<{ slot: SlotKey; evidenceValue: string | null; state: EvidenceDimensionState }>;
  chips: SortChip[];
}

interface SortData {
  states: Record<EvidenceDimensionState, { label: string; tone: string; rule: string }>;
  scoring: {
    hitBase: number;
    accept: Record<EvidenceDimensionState, number>;
    reject: Record<EvidenceDimensionState, number>;
    acceptCombo: Record<EvidenceDimensionState, 'up' | 'freeze' | 'reset'>;
    acceptLife: Record<EvidenceDimensionState, number>;
    multiplier: { per: number; step: number; cap: number };
    lives: number;
  };
  grades: Array<{ grade: string; min: number }>;
  perfectScore: number;
  rounds: SortRound[];
  stats: { chips: number; byState: Record<EvidenceDimensionState, number> };
}

interface SortOutcome {
  points: number;
  combo: 'up' | 'freeze' | 'reset';
  life: number;
  tone: string;
  text: string;
  verdict: string;
}

const STATES: EvidenceDimensionState[] = [
  'exact',
  'caliber',
  'edge',
  'conflict',
  'mismatch',
  'unknown',
];

function loadGlobal<T>(file: string, key: string): T {
  const sandbox: { window: Record<string, unknown> } = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
  const value = sandbox.window[key] as T | undefined;
  if (!value) throw new Error(`${path.basename(file)} 没有导出 ${key}`);
  return value;
}

const DATA = loadGlobal<SortData>(SORT_DATA, 'LODESTAR_SORT');

/** 最小的 DOM 替身：让页面脚本能跑起来，只为拿到它真正在用的那份规则表 */
function fakeElement(id: string): Record<string, unknown> {
  const classes = new Set<string>();
  const el: Record<string, unknown> = {
    id,
    textContent: '',
    innerHTML: '',
    hidden: false,
    disabled: false,
    offsetWidth: 0,
    children: [] as unknown[],
    style: {} as Record<string, string>,
    classList: {
      add: (...names: string[]) => names.forEach((name) => classes.add(name)),
      remove: (...names: string[]) => names.forEach((name) => classes.delete(name)),
      toggle: (name: string, force?: boolean) => {
        const on = force === undefined ? !classes.has(name) : force;
        if (on) classes.add(name);
        else classes.delete(name);
        return on;
      },
      contains: (name: string) => classes.has(name),
    },
    setAttribute: () => undefined,
    getAttribute: () => null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    focus: () => undefined,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 120, height: 40, right: 120, bottom: 40 }),
    appendChild: (child: Record<string, unknown>) => {
      child.parentNode = el;
      (el.children as unknown[]).push(child);
      return child;
    },
    removeChild: () => undefined,
    querySelector: () => null,
  };
  if (id === 'hearts') {
    el.children = [fakeElement('heart-1'), fakeElement('heart-2'), fakeElement('heart-3')];
  }
  if (id === 'fx' || id === 'body') el.parentNode = null;
  return el;
}

function loadRules(): {
  multiplierOf: (combo: number) => number;
  outcomeOf: (chip: SortChip, action: 'accept' | 'reject' | 'timeout', combo: number) => SortOutcome;
  applyOutcome: (
    score: number,
    combo: number,
    lives: number,
    result: SortOutcome,
  ) => { score: number; combo: number; lives: number };
  chipMs: number[];
} {
  const body = fakeElement('body');
  const nodes = new Map<string, Record<string, unknown>>();
  const get = (id: string): Record<string, unknown> => {
    let node = nodes.get(id);
    if (!node) {
      node = fakeElement(id);
      node.parentNode = body;
      nodes.set(id, node);
    }
    return node;
  };
  const document = {
    getElementById: (id: string) => get(id),
    createElement: () => fakeElement('created'),
    addEventListener: () => undefined,
    querySelector: () => null,
    hidden: false,
    body,
  };
  const sandbox: Record<string, unknown> = {
    window: {
      matchMedia: () => ({ matches: false }),
      performance: { now: () => Date.now() },
      requestAnimationFrame: () => 1,
      cancelAnimationFrame: () => undefined,
      setTimeout: () => 0,
      clearTimeout: () => undefined,
    },
    document,
    Math,
    String,
    Number,
    Object,
    Array,
    JSON,
    Date,
    console,
  };
  sandbox.window = sandbox.window as Record<string, unknown>;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(SORT_DATA, 'utf8'), sandbox, { filename: 'demo-sort-data.js' });
  vm.runInContext(fs.readFileSync(SORT_SCRIPT, 'utf8'), sandbox, { filename: 'demo-sort.js' });
  const rules = (sandbox.window as Record<string, unknown>).LODESTAR_SORT_RULES;
  if (!rules) throw new Error('demo-sort.js 没有导出 LODESTAR_SORT_RULES');
  return rules as ReturnType<typeof loadRules>;
}

function compare(slot: SlotKey, claim: string, evidence: string): { state: EvidenceDimensionState; note: string } {
  if (slot === 'auctionHouse') return compareInstitutionDimension(claim, evidence);
  if (slot === 'dateText') return compareTimeDimension(claim, evidence);
  return compareTextDimension(claim, evidence);
}

function corpusValues(): Record<SlotKey, Set<string>> {
  const demo = loadGlobal<{
    cases: Array<{
      records: Array<{
        fields: Array<{ key: string; value: string }>;
        evidence: Array<{ fieldKey: string; matchedValue: string | null }>;
      }>;
    }>;
  }>(DEMO_DATA, 'LODESTAR_DEMO');
  const values: Record<SlotKey, Set<string>> = {
    auctionHouse: new Set(),
    dateText: new Set(),
    sessionName: new Set(),
  };
  for (const item of demo.cases) {
    for (const record of item.records) {
      for (const field of record.fields) {
        if (field.key in values) values[field.key as SlotKey].add(field.value);
      }
      for (const row of record.evidence) {
        if (row.fieldKey in values && row.matchedValue) {
          values[row.fieldKey as SlotKey].add(row.matchedValue);
        }
      }
    }
  }
  return values;
}

const RULES = loadRules();

describe('证据分拣 · 牌面', () => {
  it('两轮、每轮十条，总条数与统计一致', () => {
    expect(DATA.rounds).toHaveLength(2);
    for (const round of DATA.rounds) expect(round.chips).toHaveLength(10);
    expect(DATA.stats.chips).toBe(20);
  });

  it('六种维度状态一局里都碰得到', () => {
    const seen = new Set(DATA.rounds.flatMap((round) => round.chips.map((chip) => chip.state)));
    for (const state of STATES) expect(seen.has(state)).toBe(true);
    for (const state of STATES) expect(DATA.stats.byState[state]).toBeGreaterThan(0);
  });

  it('每条说法的状态与引擎复算逐字一致（页面不许放宽判定）', () => {
    for (const round of DATA.rounds) {
      for (const chip of round.chips) {
        const recomputed = compare(chip.slot, round.lot.values[chip.slot], chip.value);
        expect(chip.state, `${round.id} ${chip.slot} ${chip.value}`).toBe(recomputed.state);
        expect(chip.note, `${round.id} ${chip.slot} ${chip.value}`).toBe(recomputed.note);
      }
    }
  });

  it('器物卡挂在冻结矩阵里真实覆盖的记录上', () => {
    const game = loadGlobal<{
      combos: Array<{
        id: string;
        status: string;
        recordId: string | null;
        values: Record<SlotKey, string>;
      }>;
    }>(GAME_DATA, 'LODESTAR_DEMO_GAME');
    for (const round of DATA.rounds) {
      const combo = game.combos.find((item) => item.id === round.lot.comboId);
      expect(combo, round.lot.comboId).toBeTruthy();
      expect(combo?.status).toBe('covered');
      expect(combo?.recordId).toBe(round.lot.recordId);
      expect(combo?.values).toEqual(round.lot.values);
    }
  });

  it('「演示用词」只标在冻结语料里确实没有的写法上', () => {
    const corpus = corpusValues();
    for (const round of DATA.rounds) {
      for (const chip of round.chips) {
        expect(chip.demoOnly, `${chip.slot} ${chip.value}`).toBe(!corpus[chip.slot].has(chip.value));
      }
    }
    const demoOnly = DATA.rounds.flatMap((round) => round.chips).filter((chip) => chip.demoOnly);
    expect(demoOnly.length).toBeGreaterThan(0);
  });

  it('每轮第一条都是「完全对上」，第一条动作就命中', () => {
    for (const round of DATA.rounds) expect(round.chips[0].state).toBe('exact');
  });

  it('同一轮里不重复发同一条说法', () => {
    for (const round of DATA.rounds) {
      const keys = round.chips.map((chip) => `${chip.slot}\u0000${chip.value}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe('证据分拣 · 计分', () => {
  it('倍率按连击分段，最高 ×3', () => {
    const { per, step, cap } = DATA.scoring.multiplier;
    expect(RULES.multiplierOf(0)).toBe(1);
    expect(RULES.multiplierOf(per - 1)).toBe(1);
    expect(RULES.multiplierOf(per)).toBeCloseTo(1 + step);
    expect(RULES.multiplierOf(per * 2)).toBeCloseTo(1 + step * 2);
    expect(RULES.multiplierOf(per * 4)).toBeCloseTo(1 + step * 4);
    expect(RULES.multiplierOf(999)).toBe(cap);
  });

  it('收下完全对上＝10×倍率，连击 +1，不掉心', () => {
    const chip = { state: 'exact' } as SortChip;
    expect(RULES.outcomeOf(chip, 'accept', 0).points).toBe(DATA.scoring.hitBase);
    const hot = RULES.outcomeOf(chip, 'accept', 9);
    expect(hot.points).toBe(Math.round(DATA.scoring.hitBase * RULES.multiplierOf(9)));
    expect(hot.combo).toBe('up');
    expect(hot.life).toBe(0);
  });

  it('放走完全对上＝漏判：0 分、连击归零、不掉心', () => {
    const out = RULES.outcomeOf({ state: 'exact' } as SortChip, 'reject', 12);
    expect(out.points).toBe(0);
    expect(out.combo).toBe('reset');
    expect(out.life).toBe(0);
  });

  it('收下相容证据只给小分并冻住连击，冲突与没对上掉心', () => {
    for (const state of ['caliber', 'edge', 'unknown'] as EvidenceDimensionState[]) {
      const out = RULES.outcomeOf({ state } as SortChip, 'accept', 6);
      expect(out.points).toBe(DATA.scoring.accept[state]);
      expect(out.combo).toBe('freeze');
      expect(out.life).toBe(0);
    }
    for (const state of ['conflict', 'mismatch'] as EvidenceDimensionState[]) {
      const out = RULES.outcomeOf({ state } as SortChip, 'accept', 6);
      expect(out.life).toBe(-1);
      expect(out.combo).toBe('reset');
      expect(out.points).toBe(0);
    }
  });

  it('放走任何非完全对上都有小分并推进连击', () => {
    for (const state of ['caliber', 'edge', 'conflict', 'mismatch', 'unknown'] as EvidenceDimensionState[]) {
      const out = RULES.outcomeOf({ state } as SortChip, 'reject', 6);
      expect(out.points).toBe(DATA.scoring.reject[state]);
      expect(out.combo).toBe('up');
      expect(out.life).toBe(0);
    }
  });

  it('超时＝0 分、连击归零、不掉心', () => {
    const out = RULES.outcomeOf({ state: 'exact' } as SortChip, 'timeout', 7);
    expect(out.points).toBe(0);
    expect(out.combo).toBe('reset');
    expect(out.life).toBe(0);
  });

  it('满分局复算出来的分数与数据里的 perfectScore 一致', () => {
    let score = 0;
    let combo = 0;
    let lives = DATA.scoring.lives;
    for (const round of DATA.rounds) {
      for (const chip of round.chips) {
        const action = chip.state === 'exact' ? 'accept' : 'reject';
        const out = RULES.outcomeOf(chip, action, combo);
        const next = RULES.applyOutcome(score, combo, lives, out);
        score = next.score;
        combo = next.combo;
        lives = next.lives;
      }
    }
    expect(score).toBe(DATA.perfectScore);
    expect(lives).toBe(DATA.scoring.lives);
  });

  it('分数线从高到低单调，S 线不到满分', () => {
    const grades = DATA.grades;
    for (let i = 1; i < grades.length; i += 1) {
      expect(grades[i].min).toBeLessThan(grades[i - 1].min);
    }
    expect(grades[0].min).toBeLessThanOrEqual(DATA.perfectScore);
    expect(grades[grades.length - 1].min).toBe(0);
  });
});

describe('证据分拣 · 文案纪律', () => {
  it('六种状态的标题就是引擎那六个，不许换词', () => {
    expect(DATA.states.exact.label).toBe('完全对上');
    expect(DATA.states.caliber.label).toBe('口径相容');
    expect(DATA.states.edge.label).toBe('边缘相容');
    expect(DATA.states.conflict.label).toBe('冲突候选');
    expect(DATA.states.mismatch.label).toBe('没对上');
    expect(DATA.states.unknown.label).toBe('无从判断');
  });

  it('口径相容写着「不能算对上」，边缘相容写着「不能证明」', () => {
    expect(DATA.states.caliber.rule).toContain('不能算对上');
    expect(DATA.states.edge.rule).toContain('不能证明');
    expect(DATA.states.conflict.rule).toContain('不压成反对');
  });

  it('收下冲突/没对上的提示里不出现「命中」', () => {
    for (const state of ['conflict', 'mismatch'] as EvidenceDimensionState[]) {
      const out = RULES.outcomeOf({ state } as SortChip, 'accept', 3);
      expect(out.text).not.toContain('命中');
      expect(out.text).toContain('掉一颗心');
    }
  });
});
