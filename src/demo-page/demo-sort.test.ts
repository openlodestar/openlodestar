// src/demo-page/demo-sort.test.ts
/**
 * 「证据分拣」小游戏与冻结语料的一致性测试（离线、零模型调用）
 *
 * 这个页面不重算判定——每条说法的状态是构建时用引擎的维度函数算好、冻结进
 * `docs/assets/demo-sort-data.js` 的。测试守八件事：
 *
 * 1. 每条说法的状态都能用引擎自己的 compareXxxDimension 复算出来（页面没有偷偷放宽）；
 * 2. 每个牌局里六种维度状态都碰得到，教学约束（第一拍命中、中段末位命中、收尾三拍不发命中）都成立；
 * 3. 器物卡必须挂在冻结矩阵里真实覆盖的记录上，不是编出来的句子；
 * 4. 「演示用词」标记只给冻结语料里确实没有的写法；
 * 5. 计分规则可复算：命中＝10×倍率、收旁证断连击、误收掉心、超时 0 分、兑现窗口里旁证翻倍；
 * 6. **「只认字面相同」拿不到 A**：逐牌序算三种策略，字面策略必须低于最优分的 72%，
 *    逢旁证就收必须够不到 S 线，而「中段放旁证、收尾三拍收旁证」的稳健策略必须等于理论最高分；
 *    S 线抬到 90%，误收一条冲突/没对上既掉出分数线、也被「整局干净」这一关挡回 A；
 * 7. 题库真的换内容：至少四个牌局、开局各不相同、连抽三局不重复、
 *    两局之间连答案都一样的牌不超过上限（记答案过不了关）；
 * 8. 文案与规则对得上：A 档说清「窗口/断连击」，B 档点明「只按字面分」，规则里写了换件清零与窗口翻倍；
 * 9. 节拍跟着难度走：中段短文案仍是最紧的基础秒数，收尾三拍与两行以上/长字数的文案逐级加时。
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
  slipOne: number;
  slipTwo: number;
  oneWrong: number;
}

interface SortRun {
  id: string;
  label: string;
  rounds: SortRound[];
  orders: SortOrder[];
}

interface SortData {
  states: Record<EvidenceDimensionState, { label: string; tone: string; rule: string }>;
  scoring: {
    hitBase: number;
    accept: Record<EvidenceDimensionState, number>;
    reject: Record<EvidenceDimensionState, number>;
    acceptCombo: Record<EvidenceDimensionState, 'up' | 'reset'>;
    acceptLife: Record<EvidenceDimensionState, number>;
    wrongPenalty: number;
    multiplier: { per: number; step: number; cap: number };
    windowBonus: { multiplier: number; states: EvidenceDimensionState[] };
    lives: number;
    settleBeats: number;
    note: string;
  };
  grades: Array<{ grade: string; ratio: number; label: string; requiresClean?: boolean }>;
  runs: SortRun[];
  stats: {
    chips: number;
    byState: Record<EvidenceDimensionState, number>;
    runs: number;
    deckOverlap: Array<{ a: string; b: string; shared: number; sameAnswer: number }>;
  };
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
  outcomeOf: (chip: SortChip, action: Action, combo: number, inWindow: boolean) => SortOutcome;
  applyOutcome: (
    score: number,
    combo: number,
    lives: number,
    result: SortOutcome,
  ) => { score: number; combo: number; lives: number };
  diagnoseLog: (log: Array<{
    action: string;
    state: EvidenceDimensionState;
    inWindow: boolean;
    value: string;
  }>) => {
    text: string;
    count: number;
    wrong: number;
    missed: number;
    windowLost: number;
    midSide: number;
    timeouts: number;
    windowPts: number;
  };
  chipMs: number[];
  verdictMs: number;
  swipe: number;
  pickRun: () => void;
  beatMsFor: (roundIndex: number, inWindow: boolean, lines: number, chars: number) => number;
  windowExtraMs: number;
  lineExtraMs: number;
  charExtraMs: number;
  idleChars: number;
  maxTextExtraMs: number;
  gradeOf: (
    score: number,
    best: number,
    clean: boolean,
  ) => { grade: string; ratio: number; label: string; requiresClean?: boolean };
  state: () => {
    runId: string | null;
    orderId: string | null;
    recentRuns: string[];
    phase: string;
    paused: boolean;
    clockFrozen: boolean;
    pauseKind: string;
    timerRemaining: number;
    waitRemaining: number;
  };
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
const CORPUS = corpusValues();
const S_RATIO = DATA.grades[0].ratio;
const A_RATIO = DATA.grades[1].ratio;

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
    const action = policy(chip.state, combo, index, settleFrom);
    const result = RULES.outcomeOf(chip, action, combo, index >= settleFrom);
    const next = RULES.applyOutcome(score, combo, lives, result);
    score = next.score;
    combo = next.combo;
    lives = next.lives;
  }
  return score;
}

/** 允许预知后续牌的理论最高分（与构建脚本各自独立实现，互相校验） */
function bestOf(chips: SortChip[], settleFrom: number): number {
  const memo = new Map<string, number>();
  const go = (index: number, combo: number, lives: number): number => {
    if (index >= chips.length || lives <= 0) return 0;
    const key = `${index}|${combo}|${lives}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    let best = 0;
    for (const action of ['accept', 'reject'] as const) {
      const result = RULES.outcomeOf(chips[index], action, combo, index >= settleFrom);
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

/** 一副牌（按某个牌序），每拍带上「这一拍属不属于兑现窗口」 */
function playOrder(run: SortRun, order: SortOrder): {
  best: number;
  steady: number;
  literal: number;
  eager: number;
} {
  let best = 0;
  let steady = 0;
  let literal = 0;
  let eager = 0;
  run.rounds.forEach((round, index) => {
    const chips = chipsOfRound(round, order.rounds[index]);
    best += bestOf(chips, round.settleFrom);
    steady += play(chips, round.settleFrom, STEADY);
    literal += play(chips, round.settleFrom, LITERAL);
    eager += play(chips, round.settleFrom, EAGER);
  });
  return { best, steady, literal, eager };
}

/** 读对规则，但在整局的前 `slips` 个兑现窗口旁证上手滑放走（与构建脚本各自独立实现） */
function playWithSlips(run: SortRun, order: SortOrder, slips: number): number {
  let remaining = slips;
  let total = 0;
  run.rounds.forEach((round, roundIndex) => {
    const chips = chipsOfRound(round, order.rounds[roundIndex]);
    let score = 0;
    let combo = 0;
    let lives = DATA.scoring.lives;
    chips.forEach((chip, index) => {
      if (lives <= 0) return;
      const inWindow = index >= round.settleFrom;
      const side = chip.state === 'caliber' || chip.state === 'edge';
      let action: 'accept' | 'reject';
      if (chip.state === 'exact') action = 'accept';
      else if (side && inWindow && remaining > 0) {
        action = 'reject';
        remaining -= 1;
      } else action = side && inWindow ? 'accept' : 'reject';
      const result = RULES.outcomeOf(chip, action, combo, inWindow);
      const next = RULES.applyOutcome(score, combo, lives, result);
      score = next.score;
      combo = next.combo;
      lives = next.lives;
    });
    total += score;
  });
  return total;
}

/** 读对规则，但整局第一次遇到冲突/没对上时误收——S 要求整局干净，这一档必须掉出去 */
function playWithOneWrong(run: SortRun, order: SortOrder): number {
  let wrongUsed = false;
  let total = 0;
  run.rounds.forEach((round, roundIndex) => {
    const chips = chipsOfRound(round, order.rounds[roundIndex]);
    let score = 0;
    let combo = 0;
    let lives = DATA.scoring.lives;
    chips.forEach((chip, index) => {
      if (lives <= 0) return;
      const inWindow = index >= round.settleFrom;
      const side = chip.state === 'caliber' || chip.state === 'edge';
      let action: 'accept' | 'reject';
      if (chip.state === 'exact') action = 'accept';
      else if (chip.state === 'conflict' || chip.state === 'mismatch') {
        action = wrongUsed ? 'reject' : 'accept';
        wrongUsed = true;
      } else action = side && inWindow ? 'accept' : 'reject';
      const result = RULES.outcomeOf(chip, action, combo, inWindow);
      const next = RULES.applyOutcome(score, combo, lives, result);
      score = next.score;
      combo = next.combo;
      lives = next.lives;
    });
    total += score;
  });
  return total;
}

describe('牌面来自冻结语料', () => {
  it('四个牌局、每局两件器物、每件十拍', () => {
    expect(DATA.runs.length).toBeGreaterThanOrEqual(4);
    expect(DATA.stats.runs).toBe(DATA.runs.length);
    for (const run of DATA.runs) {
      expect(run.rounds.length).toBe(2);
      for (const round of run.rounds) {
        expect(round.chips.length).toBe(10);
        expect(round.lot.recordId).toBeTruthy();
        expect(round.settleFrom).toBe(round.chips.length - DATA.scoring.settleBeats);
      }
    }
  });

  it('器物卡挂在冻结矩阵里真实覆盖的组合上', () => {
    for (const run of DATA.runs) {
      for (const round of run.rounds) {
        expect(round.lot.gate === 'strong' || round.lot.gate === 'weak').toBe(true);
        for (const slot of Object.keys(round.lot.values) as SlotKey[]) {
          expect(round.lot.values[slot].length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('每条说法的状态都能用引擎复算出来', () => {
    for (const run of DATA.runs) {
      for (const round of run.rounds) {
        for (const chip of round.chips) {
          const claim = round.lot.values[chip.slot];
          expect(compare(chip.slot, claim, chip.value).state).toBe(chip.state);
        }
      }
    }
  });

  it('「演示用词」标记只给语料里没有的写法', () => {
    for (const run of DATA.runs) {
      for (const round of run.rounds) {
        for (const chip of round.chips) {
          expect(chip.demoOnly).toBe(!CORPUS[chip.slot].has(chip.value));
        }
      }
    }
  });

  it('每局六种状态都碰得到，且守住教学约束', () => {
    for (const run of DATA.runs) {
      const seen = new Set<EvidenceDimensionState>();
      for (const round of run.rounds) {
        round.chips.forEach((chip) => seen.add(chip.state));
        // 第一拍就是命中：第一次上甩不用读说明
        expect(round.chips[0].state).toBe('exact');
        // 中段最后一张仍是命中：中段收旁证一定还有后续命中可亏
        expect(round.chips[round.settleFrom - 1].state).toBe('exact');
        // 收尾三拍不发命中：那才是唯一该收旁证的地方
        for (const chip of round.chips.slice(round.settleFrom)) {
          expect(chip.state).not.toBe('exact');
        }
        // 同一件器物里不重复发同一句说法
        const keys = round.chips.map((chip) => `${chip.slot}\u0000${chip.value}`);
        expect(new Set(keys).size).toBe(keys.length);
      }
      for (const state of STATES) expect(seen.has(state)).toBe(true);
    }
  });
});

describe('题库真的换了内容', () => {
  it('开局各不相同，牌面不是换个顺序', () => {
    const openings = DATA.runs.map((run) => `${run.rounds[0].lot.comboId}|${run.rounds[0].chips[0].value}`);
    expect(new Set(openings).size).toBe(openings.length);
    const pairs = DATA.runs.map((run) => run.rounds.map((round) => round.lot.comboId).join('+'));
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it('两局之间重合的牌面与「连答案都一样」的牌面都在上限内', () => {
    for (const item of DATA.stats.deckOverlap) {
      const a = DATA.runs.find((run) => run.id === item.a);
      const b = DATA.runs.find((run) => run.id === item.b);
      expect(a && b).toBeTruthy();
      if (!a || !b) continue;
      const states = new Map<string, EvidenceDimensionState>();
      for (const round of a.rounds) {
        for (const chip of round.chips) states.set(`${chip.slot}\u0000${chip.value}`, chip.state);
      }
      let shared = 0;
      let sameAnswer = 0;
      for (const round of b.rounds) {
        for (const chip of round.chips) {
          const before = states.get(`${chip.slot}\u0000${chip.value}`);
          if (before === undefined) continue;
          shared += 1;
          if (before === chip.state) sameAnswer += 1;
        }
      }
      expect(item.shared).toBe(shared);
      expect(item.sameAnswer).toBe(sameAnswer);
      // 连打两局，靠背答案最多只能拿到这么多拍
      expect(sameAnswer).toBeLessThanOrEqual(9);
    }
  });

  it('连抽三局不撞回同一副牌', () => {
    let previous = '';
    for (let i = 0; i < 24; i += 1) {
      RULES.pickRun();
      const ids = RULES.state().recentRuns;
      expect(ids.length).toBeLessThanOrEqual(2);
      expect(new Set(ids).size).toBe(ids.length);
      const current = RULES.state().runId || '';
      // 相邻两局一定不同，最近两局里也不会再出现第三局
      expect(current).not.toBe(previous);
      if (ids.length >= 2) expect(ids[0]).not.toBe(current);
      previous = current;
    }
  });

  it('每局有六种牌序，且互不相同', () => {
    for (const run of DATA.runs) {
      expect(run.orders.length).toBe(6);
      const keys = run.orders.map((order) => order.rounds.map((round) => round.join(',')).join('|'));
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe('只认字面拿不到最高档', () => {
  it('稳健策略打满理论最高分，字面策略明确掉到 B 档', () => {
    for (const run of DATA.runs) {
      for (const order of run.orders) {
        const measured = playOrder(run, order);
        const sMin = Math.ceil(measured.best * S_RATIO);
        const aMin = Math.round(measured.best * A_RATIO);
        // 页面记的读数与测试独立复算一致
        expect(measured.best).toBe(order.best);
        expect(measured.steady).toBe(order.steady);
        expect(measured.literal).toBe(order.literal);
        expect(measured.eager).toBe(order.eager);
        // 按公开规则打（中段放旁证、窗口里收）就该等于最优解
        expect(measured.steady).toBe(measured.best);
        // 只认字面：连 A 档都够不到，更够不到 S
        expect(measured.literal).toBeLessThan(aMin);
        expect(measured.literal / measured.best).toBeLessThan(0.72);
        expect(measured.literal).toBeLessThan(sMin);
        // 见旁证就收：断连击的代价让它也够不到 S
        expect(measured.eager).toBeLessThan(sMin);
      }
    }
  });

  it('S 线容得下一次手误，容不下两次', () => {
    for (const run of DATA.runs) {
      for (const order of run.orders) {
        const sMin = Math.ceil(order.best * S_RATIO);
        const one = playWithSlips(run, order, 1);
        const two = playWithSlips(run, order, 2);
        // 页面记的读数与独立复算一致
        expect(one).toBe(order.slipOne);
        expect(two).toBe(order.slipTwo);
        // 读对规则、只漏收一条窗口旁证：仍在 S 内，认真读一局的人摸得到最高档
        expect(one).toBeGreaterThanOrEqual(sMin);
        // 漏两条就掉出去，S 才有区分度
        expect(two).toBeLessThan(sMin);
      }
    }
  });

  it('S 线抬到 90%：盲测的 178 分不再够 S，175 明确进不去', () => {
    // 199 × 90% = 179.1，向上取整为 180——178 过不了，粗糙打法的 175 更过不了
    const sMin = Math.ceil(199 * S_RATIO);
    expect(sMin).toBe(180);
    expect(178).toBeLessThan(sMin);
    expect(175).toBeLessThan(sMin);
  });

  it('误收一条冲突/没对上：分数与干净度都不允许 S', () => {
    for (const run of DATA.runs) {
      for (const order of run.orders) {
        const sMin = Math.ceil(order.best * S_RATIO);
        const dirty = playWithOneWrong(run, order);
        // 页面记的读数与独立复算一致
        expect(dirty).toBe(order.oneWrong);
        // 倒扣 6 分、掉一颗心、断连击——误收一条就不该再摸到 S 线
        expect(dirty).toBeLessThan(sMin);
        // 分数掉出 S 线之外，干净度这一关再挡一次
        expect(RULES.gradeOf(dirty, order.best, false).grade).not.toBe('S');
        expect(RULES.gradeOf(order.best, order.best, true).grade).toBe('S');
        expect(RULES.gradeOf(order.best, order.best, false).grade).not.toBe('S');
      }
    }
  });

  it('兑现窗口里收旁证必须比中段收更划算——最优解奖励「多看一眼位置」', () => {
    const run = DATA.runs[0];
    const round = run.rounds[0];
    const windowChips = round.chips.slice(round.settleFrom);
    const midChips = round.chips.slice(1, round.settleFrom);
    const windowSide = windowChips.find((chip) => chip.state === 'caliber');
    const midSide = midChips.find((chip) => chip.state === 'caliber');
    expect(windowSide).toBeTruthy();
    expect(midSide).toBeTruthy();
    if (!windowSide || !midSide) return;
    const inWindow = RULES.outcomeOf(windowSide, 'accept', 2, true);
    const outWindow = RULES.outcomeOf(midSide, 'accept', 2, false);
    expect(inWindow.points).toBeGreaterThan(outWindow.points);
    expect(inWindow.text).toContain('窗口翻倍');
    expect(outWindow.text).toContain('连击断');
  });

  it('分值与规则表是同一份数据', () => {
    expect(DATA.scoring.hitBase).toBe(10);
    expect(DATA.scoring.windowBonus.multiplier).toBe(2);
    expect(DATA.scoring.windowBonus.states).toEqual(['caliber', 'edge']);
    expect(DATA.scoring.multiplier.cap).toBe(3);
    expect(DATA.scoring.settleBeats).toBe(3);
    expect(RULES.multiplierOf(0)).toBe(1);
    expect(RULES.multiplierOf(1)).toBe(2);
    expect(RULES.multiplierOf(2)).toBe(3);
    expect(RULES.multiplierOf(9)).toBe(3);
  });

  it('超时 = 0 分且连击归零', () => {
    const chip = DATA.runs[0].rounds[0].chips[0];
    const result = RULES.outcomeOf(chip, 'timeout', 2, false);
    expect(result.points).toBe(0);
    expect(result.combo).toBe('reset');
    expect(result.text).toContain('超时');
  });

  it('收下冲突/没对上：倒扣 6 分、掉一颗心、连击断', () => {
    const round = DATA.runs[0].rounds[0];
    const wrong = round.chips.filter(
      (chip) => chip.state === 'conflict' || chip.state === 'mismatch',
    );
    expect(wrong.length).toBeGreaterThan(0);
    for (const chip of wrong) {
      const result = RULES.outcomeOf(chip, 'accept', 2, true);
      expect(result.points).toBe(-DATA.scoring.wrongPenalty);
      expect(result.points).toBe(-6);
      expect(result.life).toBe(-1);
      expect(result.combo).toBe('reset');
      expect(result.verdict).toBe('harm');
      expect(result.text).toContain('倒扣 6 分');
      expect(result.text).toContain('掉一颗心');
    }
  });
});

describe('文案说对了', () => {
  it('A 档不再说「亏了倍率」，说的是窗口与断连击', () => {
    const a = DATA.grades.find((grade) => grade.grade === 'A');
    expect(a).toBeTruthy();
    expect(a ? a.label : '').toContain('兑现窗口');
    expect(a ? a.label : '').toContain('连击');
  });

  it('B 档点明「只按字面分」', () => {
    const b = DATA.grades.find((grade) => grade.grade === 'B');
    expect(b ? b.label : '').toContain('只按字面');
  });

  it('规则里写了换件清零与窗口翻倍', () => {
    expect(DATA.scoring.note).toContain('换下一件');
    expect(DATA.scoring.note).toContain('翻倍');
    expect(DATA.scoring.note).toContain('×1');
  });

  it('页面脚本里窗口文案是行动语言，不是「不会再发命中」', () => {
    const source = fs.readFileSync(SORT_SCRIPT, 'utf8');
    expect(source).toContain('现在收不亏倍率');
    expect(source).toContain('这拍多给 0.8 秒');
    expect(source).not.toContain('这三拍不会再发命中');
    expect(source).toContain('换下一件 · 连击清零');
    expect(source).toContain('这拍 ·');
  });

  it('页面脚本没有用局部变量遮蔽 window', () => {
    const source = fs.readFileSync(SORT_SCRIPT, 'utf8');
    // 上一次改到一半时写的 `var window = inWindow()` 会把 window 变成布尔值，
    // 同一函数里的 window.setTimeout 直接抛错，游戏卡在第一拍。
    expect(source).not.toMatch(/\b(?:var|let|const)\s+window\b/);
  });

  it('判定行写进卡片自身区域（不再作为卡片外的兄弟节点）', () => {
    const html = fs.readFileSync(path.join(DOCS, 'demo-sort.html'), 'utf8');
    const chipBlock = html.slice(html.indexOf('id="chip"'), html.indexOf('id="wait-bar"'));
    expect(chipBlock).toContain('id="verdict-line"');
    expect(chipBlock).toContain('id="chip-value"');
    expect(html).toContain('id="switch-note"');
    expect(html).toContain('id="wait-fill"');
  });

  it('判定行是固定高度占位，文案长短不改卡片高', () => {
    const html = fs.readFileSync(path.join(DOCS, 'demo-sort.html'), 'utf8');
    const rule = html.slice(html.indexOf('.verdict-line{'), html.indexOf('.verdict-line #verdict-label'));
    expect(rule).toContain('height:3.4em');
    expect(rule).not.toContain('min-height');
    // 宽屏那份也要固定高度，不能又用 min-height 把舞台顶起来
    expect(html).not.toContain('min-height:2.5em');
  });

  it('评语按本局实际错误生成，不是通用话术', () => {
    const diag = RULES.diagnoseLog([
      { action: 'reject', state: 'exact', inWindow: false, value: '保利香港' },
      { action: 'reject', state: 'caliber', inWindow: true, value: '中国嘉德' },
      { action: 'accept', state: 'mismatch', inWindow: false, value: '2024年5月' },
      { action: 'accept', state: 'caliber', inWindow: false, value: '北京' },
      { action: 'timeout', state: 'unknown', inWindow: false, value: '—' },
    ]);
    expect(diag.missed).toBe(1);
    expect(diag.wrong).toBe(1);
    expect(diag.windowLost).toBe(1);
    expect(diag.midSide).toBe(1);
    expect(diag.timeouts).toBe(1);
    const doubled = DATA.scoring.accept.caliber * DATA.scoring.windowBonus.multiplier;
    expect(diag.windowPts).toBe(doubled);
    expect(diag.text).toContain('放走 1 条完全对上');
    expect(diag.text).toContain('保利香港');
    expect(diag.text).toContain('收尾窗口里漏收 1 条');
    expect(diag.text).toContain('少拿 ' + doubled + ' 分');
    expect(diag.text).toContain('中段收 1 条旁证');
    expect(diag.text).toContain('超时 1 拍');

    const clean = RULES.diagnoseLog([
      { action: 'accept', state: 'exact', inWindow: false, value: '保利香港' },
      { action: 'reject', state: 'caliber', inWindow: false, value: '中国嘉德' },
      { action: 'accept', state: 'caliber', inWindow: true, value: '北京' },
    ]);
    expect(clean.count).toBe(0);
    expect(clean.text).toContain('没有可再想的');
  });

  it('「语料外写法」徽章挨着这条值，措辞说清不是假数据', () => {
    const html = fs.readFileSync(path.join(DOCS, 'demo-sort.html'), 'utf8');
    const chipBlock = html.slice(html.indexOf('id="chip"'), html.indexOf('id="wait-bar"'));
    expect(chipBlock).toContain('id="chip-tag"');
    expect(chipBlock.indexOf('id="chip-value"')).toBeLessThan(chipBlock.indexOf('id="chip-tag"'));
    expect(chipBlock).toContain('语料外写法');
    expect(chipBlock).not.toContain('演示用词');
    expect(html).toContain('不是假数据');
  });

  it('复盘默认只展开要改的，其余折叠', () => {
    const html = fs.readFileSync(path.join(DOCS, 'demo-sort.html'), 'utf8');
    const source = fs.readFileSync(SORT_SCRIPT, 'utf8');
    expect(html).toContain('id="review-toggle"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('is-collapsed');
    expect(source).toContain('renderReview');
    expect(source).toContain('先看 ');
    expect(source).toContain('该');
  });

  it('开始页能滚时给出可见提示，滚到底换个说法', () => {
    const html = fs.readFileSync(path.join(DOCS, 'demo-sort.html'), 'utf8');
    const source = fs.readFileSync(SORT_SCRIPT, 'utf8');
    expect(html).toContain('id="start-scroll"');
    expect(html).toContain('id="start-scroll-hint"');
    expect(html).toContain('上下滑动查看完整规则');
    expect(source).toContain('updateScrollHint');
    expect(source).toContain('已到底 · 点「开始」开局');
  });

  it('节拍跟着难度走：中段基础不变，收尾三拍与长文案加时', () => {
    expect(RULES.chipMs).toEqual([2600, 2300]);
    expect(RULES.verdictMs).toBe(1200);
    expect(RULES.windowExtraMs).toBe(800);
    // 中段短文案：仍是最紧的 2.6 / 2.3 秒
    expect(RULES.beatMsFor(0, false, 2, 10)).toBe(2600);
    expect(RULES.beatMsFor(1, false, 2, 10)).toBe(2300);
    // 收尾窗口：同一张牌多给 0.8 秒思考「相容还是冲突」
    expect(RULES.beatMsFor(0, true, 2, 10)).toBe(3400);
    expect(RULES.beatMsFor(1, true, 2, 10)).toBe(3100);
    // 值折成两行（标签 1 行 + 值 2 行 = 3 行）再加 0.8 秒
    expect(RULES.beatMsFor(0, false, 3, 12)).toBe(3400);
    expect(RULES.beatMsFor(0, true, 3, 12)).toBe(4200);
    // 28 字长专场名按字数加时：中段 4.04 秒、窗口 4.84 秒
    expect(RULES.beatMsFor(0, false, 2, 32)).toBe(2600 + (32 - RULES.idleChars) * RULES.charExtraMs);
    expect(RULES.beatMsFor(0, true, 2, 32)).toBe(3400 + (32 - RULES.idleChars) * RULES.charExtraMs);
    // 再长的文案封顶 1.8 秒加时
    expect(RULES.beatMsFor(1, true, 6, 80)).toBe(2300 + 800 + RULES.maxTextExtraMs);
    expect(RULES.beatMsFor(1, true, 8, 120)).toBe(2300 + 800 + RULES.maxTextExtraMs);
  });
});

describe('暂停与重来', () => {
  const html = fs.readFileSync(path.join(DOCS, 'demo-sort.html'), 'utf8');
  const source = fs.readFileSync(SORT_SCRIPT, 'utf8');

  it('局中入口清楚：按钮写明键位，开始页也列了 P / Esc', () => {
    expect(html).toContain('id="btn-pause"');
    expect(html).toContain('暂停（P 或 Esc）');
    expect(html).toContain('<b>P</b> / <b>Esc</b> 暂停');
    expect(html).toContain('id="btn-resume"');
    expect(html).toContain('id="btn-restart"');
    expect(source).toContain("key === 'Escape'");
    expect(source).toContain("key === 'p'");
  });

  it('遮罩是不透明的整屏层，不是半透明蒙一层', () => {
    const css = html.slice(html.indexOf('.overlay.is-pause{'), html.indexOf('.pause-card{'));
    expect(css).toContain('background:linear-gradient(180deg,#0C1A33 0%,#070E1C 100%)');
    expect(css).not.toContain('rgba(6,12,24,.86)');
    expect(css).not.toContain('backdrop-filter:blur');
    // 遮罩打开时把游戏壳与顶栏一起从可访问树摘掉
    expect(source).toContain("setAttribute('aria-hidden', 'true')");
    expect(source).toContain("setAttribute('inert'");
    // 连绘制都不参与：浏览器查找 / 选中也拿不到牌面
    expect(html).toContain('body.is-paused .shell,body.is-paused .topbar{visibility:hidden}');
    expect(source).toContain("classList.toggle('is-paused', on)");
  });

  it('tips 是写死的通用规则，不能读当前牌面', () => {
    const list = html.slice(html.indexOf('<ul class="pause-tips">'), html.indexOf('</ul>', html.indexOf('<ul class="pause-tips">')));
    expect((list.match(/<li>/g) || []).length).toBeGreaterThanOrEqual(5);
    for (const word of ['完全对上', '旁证', '冲突候选', '连击', '最后三拍']) {
      expect(list).toContain(word);
    }
    // 脚本从不写这块列表：它没有拿到当前拍次/牌面的入口，也就无法因局而异
    expect(source).not.toContain('pauseTips');
    expect(source).not.toContain('pause-tips');
  });

  it('答题计时与判定停留都记了冻结点，恢复从同一个读数接着走', () => {
    expect(source).toContain('function freezeClock');
    expect(source).toContain("SORT.pauseKind = 'timer'");
    expect(source).toContain("SORT.pauseKind = 'wait'");
    expect(source).toContain('SORT.waitDeadline = now() + waitMs');
    expect(source).toContain('SORT.waitTimer = window.setTimeout(nextBeat, waitMs)');
    // 恢复时用冻结的剩余量重开，而不是重新发一整拍
    expect(source).toContain('SORT.deadline = now() + left');
    expect(source).toContain('window.setTimeout(nextBeat, left)');
  });

  it('恢复前先倒数，倒数期间遮罩不撤、时钟不走', () => {
    expect(source).toContain('function beginResume');
    expect(source).toContain('SORT.countdownLeft = reduced() ? 2 : 3');
    expect(source).toContain('function finishCountdown');
    expect(source).toContain('SORT.phase = \'playing\';\n    resumeClock();');
    // 倒数没结束前不调 resumeClock，答案与计时都不往前走
    const begin = source.slice(source.indexOf('function beginResume'), source.indexOf('function finishCountdown'));
    expect(begin).not.toContain('resumeClock');
  });

  it('重来有二次确认，并且复用结算页那一套开局', () => {
    expect(html).toContain('id="pause-confirm"');
    expect(html).toContain('id="btn-cancel-restart"');
    expect(html).toContain('id="btn-confirm-restart"');
    expect(html).toContain('牌序也会重新抽');
    expect(source).toContain('function requestRestart');
    expect(source).toContain('function cancelRestart');
    const restart = source.slice(source.indexOf('function restartGame'), source.indexOf('// ---- 一拍的结算 ----'));
    expect(restart).toContain('startGame()');
    expect(restart).not.toContain('pickRun()');
  });

  it('暂停时 game 状态对外可读：时钟冻结、冻结的是哪一段', () => {
    const state = RULES.state();
    expect(state.phase).toBe('idle');
    expect(state.paused).toBe(false);
    expect(state.clockFrozen).toBe(false);
    expect(state.pauseKind).toBe('');
    expect(typeof state.timerRemaining).toBe('number');
    expect(typeof state.waitRemaining).toBe('number');
  });
});
