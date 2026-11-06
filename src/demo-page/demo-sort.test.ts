// src/demo-page/demo-sort.test.ts
/**
 * 「证据分拣」小游戏与冻结语料的一致性测试（离线、零模型调用）
 *
 * 这个页面不重算判定——每条说法的状态是构建时用引擎的维度函数算好、冻结进
 * `docs/assets/demo-sort-data.js` 的。测试守七件事：
 *
 * 1. 每条说法的状态都能用引擎自己的 compareXxxDimension 复算出来（页面没有偷偷放宽）；
 * 2. 六种维度状态一局里都碰得到，不许有一种只写在说明里；
 * 3. 器物卡必须挂在冻结矩阵里真实覆盖的记录上，不是编出来的句子；
 * 4. 「演示用词」标记只给冻结语料里确实没有的写法；
 * 5. 计分规则可复算：命中＝10×倍率、收旁证断连击、误收掉心、超时 0 分；
 * 6. **「只认字面相同」拿不到 S**：逐牌序算三种策略，字面策略与逢旁证就收都必须低于 S 线，
 *    而「中段放旁证、收尾三拍收旁证」的稳健策略必须等于这一牌序的理论最高分；
 * 7. 牌序在局间真的会变（互不相同），同时保住教学约束（第一拍命中、收尾三拍不发命中）。
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
type Action = 'accept' | 'reject' | 'timeout';

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
  index: number;
  lot: {
    comboId: string;
    recordId: string;
    recordTitle: string;
    gate: string;
    values: Record<SlotKey, string>;
  };
  truth: Array<{ slot: SlotKey; evidenceValue: string | null; state: EvidenceDimensionState }>;
  chips: SortChip[];
  settleFrom: number;
}

interface SortOrder {
  id: string;
  label: string;
  rounds: number[][];
  best: number;
  steady: number;
  literal: number;
  eager: number;
}

interface SortData {
  states: Record<EvidenceDimensionState, { label: string; tone: string; rule: string }>;
  scoring: {
    hitBase: number;
    accept: Record<EvidenceDimensionState, number>;
    reject: Record<EvidenceDimensionState, number>;
    acceptCombo: Record<EvidenceDimensionState, 'up' | 'reset'>;
    acceptLife: Record<EvidenceDimensionState, number>;
    multiplier: { per: number; step: number; cap: number };
    lives: number;
    settleBeats: number;
    note: string;
  };
  grades: Array<{ grade: string; ratio: number; label: string }>;
  rounds: SortRound[];
  orders: SortOrder[];
  stats: { chips: number; byState: Record<EvidenceDimensionState, number> };
}

interface SortOutcome {
  points: number;
  combo: 'up' | 'keep' | 'reset';
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
    className: '',
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
    setPointerCapture: () => undefined,
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
  return el;
}

function loadRules(): {
  multiplierOf: (combo: number) => number;
  outcomeOf: (chip: SortChip, action: Action, combo: number) => SortOutcome;
  applyOutcome: (
    score: number,
    combo: number,
    lives: number,
    result: SortOutcome,
  ) => { score: number; combo: number; lives: number };
  chipMs: number[];
  verdictMs: number;
  swipe: number;
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
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(SORT_DATA, 'utf8'), sandbox, { filename: 'demo-sort-data.js' });
  vm.runInContext(fs.readFileSync(SORT_SCRIPT, 'utf8'), sandbox, { filename: 'demo-sort.js' });
  const rules = (sandbox.window as Record<string, unknown>).LODESTAR_SORT_RULES;
  if (!rules) throw new Error('demo-sort.js 没有导出 LODESTAR_SORT_RULES');
  return rules as ReturnType<typeof loadRules>;
}

function compare(
  slot: SlotKey,
  claim: string,
  evidence: string,
): { state: EvidenceDimensionState; note: string } {
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

/** 一段牌序上的打法：策略只看得到（状态、当前连击、第几拍、收尾从第几拍起） */
type Policy = (
  state: EvidenceDimensionState,
  combo: number,
  index: number,
  settleFrom: number,
) => 'accept' | 'reject';

function play(chips: SortChip[], settleFrom: number, policy: Policy): number {
  let score = 0;
  let combo = 0;
  let lives = DATA.scoring.lives;
  for (let index = 0; index < chips.length; index += 1) {
    if (lives <= 0) break;
    const chip = chips[index];
    const result = RULES.outcomeOf(chip, policy(chip.state, combo, index, settleFrom), combo);
    const next = RULES.applyOutcome(score, combo, lives, result);
    score = next.score;
    combo = next.combo;
    lives = next.lives;
  }
  return score;
}

/** 允许预知后续牌的理论最高分（与构建脚本各自独立实现，互相校验） */
function bestOf(chips: SortChip[]): number {
  const memo = new Map<string, number>();
  const go = (index: number, combo: number, lives: number): number => {
    if (index >= chips.length || lives <= 0) return 0;
    const key = `${index}|${combo}|${lives}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    let best = 0;
    for (const action of ['accept', 'reject'] as const) {
      const result = RULES.outcomeOf(chips[index], action, combo);
      const next = RULES.applyOutcome(0, combo, lives, result);
      best = Math.max(best, result.points + go(index + 1, next.combo, next.lives));
    }
    memo.set(key, best);
    return best;
  };
  return go(0, 0, DATA.scoring.lives);
}

const LITERAL: Policy = (state) => (state === 'exact' ? 'accept' : 'reject');
const EAGER: Policy = (state) =>
  state === 'exact' || state === 'caliber' || state === 'edge' ? 'accept' : 'reject';
const STEADY: Policy = (state, _combo, index, settleFrom) => {
  if (state === 'exact') return 'accept';
  if (state !== 'caliber' && state !== 'edge') return 'reject';
  return index >= settleFrom ? 'accept' : 'reject';
};

function chipsOfRound(round: SortRound, order: number[]): SortChip[] {
  return order.map((index) => round.chips[index]);
}

const S_RATIO = DATA.grades[0].ratio;

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

  it('每轮第一张都是「完全对上」，第一拍就命中', () => {
    for (const round of DATA.rounds) expect(round.chips[0].state).toBe('exact');
  });

  it('同一轮里不重复发同一条说法', () => {
    for (const round of DATA.rounds) {
      const keys = round.chips.map((chip) => `${chip.slot}\u0000${chip.value}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('收尾三拍不发命中，中段最后一张固定是命中（中段收旁证必亏）', () => {
    for (const round of DATA.rounds) {
      expect(round.settleFrom).toBe(round.chips.length - DATA.scoring.settleBeats);
      for (let index = round.settleFrom; index < round.chips.length; index += 1) {
        expect(round.chips[index].state, `${round.id} 第 ${index + 1} 张`).not.toBe('exact');
      }
      expect(round.chips[round.settleFrom - 1].state).toBe('exact');
    }
  });
});

describe('证据分拣 · 牌序在局间变化', () => {
  it('每种牌序都是完整排列，长度与牌面一致', () => {
    for (const order of DATA.orders) {
      expect(order.rounds).toHaveLength(DATA.rounds.length);
      order.rounds.forEach((sequence, roundIndex) => {
        const length = DATA.rounds[roundIndex].chips.length;
        expect(sequence).toHaveLength(length);
        expect([...sequence].sort((a, b) => a - b)).toEqual(
          Array.from({ length }, (_, index) => index),
        );
      });
    }
  });

  it('不同牌序之间真的不一样（不是同一副牌换个名字）', () => {
    const seen = new Set(DATA.orders.map((order) => JSON.stringify(order.rounds)));
    expect(seen.size).toBe(DATA.orders.length);
    expect(DATA.orders.length).toBeGreaterThanOrEqual(6);
  });

  it('每种牌序都保住教学约束：第一拍命中、收尾三拍不发命中', () => {
    for (const order of DATA.orders) {
      order.rounds.forEach((sequence, roundIndex) => {
        const round = DATA.rounds[roundIndex];
        expect(round.chips[sequence[0]].state).toBe('exact');
        for (let beat = round.settleFrom; beat < sequence.length; beat += 1) {
          expect(round.chips[sequence[beat]].state).not.toBe('exact');
        }
      });
    }
  });

  it('两轮除了第一拍之外都有重排（不会第一局第二局逐字相同）', () => {
    for (const order of DATA.orders.slice(1)) {
      for (let roundIndex = 0; roundIndex < DATA.rounds.length; roundIndex += 1) {
        const sequence = order.rounds[roundIndex];
        expect(sequence.slice(1)).not.toEqual(
          Array.from({ length: sequence.length - 1 }, (_, index) => index + 1),
        );
      }
    }
  });
});

describe('证据分拣 · 计分', () => {
  it('倍率只看连续命中：连击 0 是 ×1、1 是 ×2、2 起 ×3（封顶）', () => {
    expect(RULES.multiplierOf(0)).toBe(1);
    expect(RULES.multiplierOf(1)).toBe(2);
    expect(RULES.multiplierOf(2)).toBe(3);
    expect(RULES.multiplierOf(9)).toBe(DATA.scoring.multiplier.cap);
  });

  it('收下完全对上＝10×倍率，连击 +1，不掉心', () => {
    const chip = { state: 'exact' } as SortChip;
    expect(RULES.outcomeOf(chip, 'accept', 0).points).toBe(DATA.scoring.hitBase);
    const hot = RULES.outcomeOf(chip, 'accept', 4);
    expect(hot.points).toBe(Math.round(DATA.scoring.hitBase * RULES.multiplierOf(4)));
    expect(hot.combo).toBe('up');
    expect(hot.life).toBe(0);
  });

  it('放走完全对上＝漏判：0 分、连击归零、不掉心', () => {
    const out = RULES.outcomeOf({ state: 'exact' } as SortChip, 'reject', 2);
    expect(out.points).toBe(0);
    expect(out.combo).toBe('reset');
    expect(out.life).toBe(0);
  });

  it('收下相容/边缘按表给分并断连击，冲突/没对上掉心', () => {
    for (const state of ['caliber', 'edge'] as EvidenceDimensionState[]) {
      const out = RULES.outcomeOf({ state } as SortChip, 'accept', 2);
      expect(out.points).toBe(DATA.scoring.accept[state]);
      expect(out.combo).toBe('reset');
      expect(out.life).toBe(0);
    }
    for (const state of ['conflict', 'mismatch'] as EvidenceDimensionState[]) {
      const out = RULES.outcomeOf({ state } as SortChip, 'accept', 2);
      expect(out.life).toBe(-1);
      expect(out.combo).toBe('reset');
      expect(out.points).toBe(0);
    }
    const unknown = RULES.outcomeOf({ state: 'unknown' } as SortChip, 'accept', 2);
    expect(unknown.points).toBe(0);
    expect(unknown.combo).toBe('reset');
  });

  it('放走非命中按表给分且不动连击（相容/边缘 0 分，其余 +1）', () => {
    for (const state of ['caliber', 'edge', 'conflict', 'mismatch', 'unknown'] as EvidenceDimensionState[]) {
      const out = RULES.outcomeOf({ state } as SortChip, 'reject', 2);
      expect(out.points).toBe(DATA.scoring.reject[state]);
      expect(out.combo).toBe('keep');
      expect(out.life).toBe(0);
    }
  });

  it('超时＝0 分、连击归零、不掉心', () => {
    const out = RULES.outcomeOf({ state: 'exact' } as SortChip, 'timeout', 2);
    expect(out.points).toBe(0);
    expect(out.combo).toBe('reset');
    expect(out.life).toBe(0);
  });

  it('判定文字至少停留 1.2 秒再发下一张（盲测：305ms 读不完）', () => {
    expect(RULES.verdictMs).toBeGreaterThanOrEqual(1200);
  });
});

describe('证据分拣 · 「只认字面相同」拿不到最高档', () => {
  it('逐牌序：稳健策略＝理论最高分，说明最优解按公开规则可达', () => {
    for (const order of DATA.orders) {
      order.rounds.forEach((sequence, roundIndex) => {
        const round = DATA.rounds[roundIndex];
        const chips = chipsOfRound(round, sequence);
        expect(play(chips, round.settleFrom, STEADY), `${order.label} 第 ${roundIndex + 1} 轮`).toBe(
          bestOf(chips),
        );
      });
    }
  });

  it('逐牌序：数据里的 best/steady/literal/eager 与页面结算函数复算一致', () => {
    for (const order of DATA.orders) {
      let best = 0;
      let steady = 0;
      let literal = 0;
      let eager = 0;
      order.rounds.forEach((sequence, roundIndex) => {
        const round = DATA.rounds[roundIndex];
        const chips = chipsOfRound(round, sequence);
        best += bestOf(chips);
        steady += play(chips, round.settleFrom, STEADY);
        literal += play(chips, round.settleFrom, LITERAL);
        eager += play(chips, round.settleFrom, EAGER);
      });
      expect(best, order.label).toBe(order.best);
      expect(steady, order.label).toBe(order.steady);
      expect(literal, order.label).toBe(order.literal);
      expect(eager, order.label).toBe(order.eager);
    }
  });

  it('逐牌序：字面策略与逢旁证就收都够不到 S 线', () => {
    for (const order of DATA.orders) {
      const line = order.best * S_RATIO;
      expect(order.literal, `${order.label} 字面`).toBeLessThan(line);
      expect(order.eager, `${order.label} 逢旁证就收`).toBeLessThan(line);
    }
  });

  it('字面策略显著低于最优，差距来自收尾窗口里的旁证', () => {
    for (const order of DATA.orders) {
      expect(order.literal / order.best).toBeLessThan(0.82);
      expect(order.steady - order.literal).toBeGreaterThan(0);
    }
  });

  it('S 线严格低于满分（满分只有一牌序一条路线能到）', () => {
    expect(S_RATIO).toBeLessThan(1);
    for (const order of DATA.orders) expect(order.best * S_RATIO).toBeLessThan(order.best);
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

  it('S 级文案如实描述，不再写「每条都判对了」', () => {
    const s = DATA.grades.find((grade) => grade.grade === 'S');
    expect(s).toBeTruthy();
    expect(s?.label).not.toContain('每条都判对');
    expect(s?.label).toContain('最优解');
  });

  it('规则说明里必须写到兑现窗口，否则玩家无从知道旁证什么时候收', () => {
    expect(DATA.scoring.note).toContain('最后三拍');
    expect(DATA.scoring.note).toContain('兑现窗口');
  });
});
