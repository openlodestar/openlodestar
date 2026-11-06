// src/demo-page/build-sort-data.ts
/**
 * 把「证据分拣」小游戏要用的牌冻结成 `docs/assets/demo-sort-data.js`
 * （`window.LODESTAR_SORT = {...}`）。
 *
 * 玩法只有两个动作：把一条证据**收下**（当作这条断言能用的支撑）或**放走**。
 * 每条证据属于一个维度（机构 / 时间 / 专场），它的判定状态由引擎自己的维度纯函数算出来：
 *
 *   compareInstitutionDimension / compareTimeDimension / compareTextDimension
 *
 * 与门禁、与 `demo-lab.html` 读的是同一份实现——页面不重算、也不放宽，
 * 只把这里冻结的状态查出来展示。六个状态：
 *
 *   exact    完全对上     这条能直接当支撑
 *   caliber  口径相容     说法不同，可能是同一场，但不能算对上
 *   edge     边缘相容     没有矛盾，但这不能证明
 *   conflict 冲突候选     点名了另一个值；冲突只作候选，不压成反对
 *   mismatch 没对上       证据写的是别的值
 *   unknown  无从判断     解析不出可比的说法
 *
 * 唯一真源仍然是 `examples/<批次>/`；中间产物 `docs/assets/demo-game-data.js`
 * 已经由 `build-demo-game.ts` 从它生成，本脚本只读那份冻结矩阵、只写生成物。
 * 不联网、不调用任何模型。
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { compareInstitutionDimension } from '../lodestar/dimensions/institution';
import { compareTimeDimension } from '../lodestar/dimensions/time';
import { compareTextDimension } from '../lodestar/dimensions/text';
import type { EvidenceDimensionState } from '../lodestar/types';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(MODULE_DIR, '../..');
const DOCS = path.join(PACKAGE_ROOT, 'docs');
const GAME_DATA_PATH = path.join(DOCS, 'assets', 'demo-game-data.js');
const DEMO_DATA_PATH = path.join(DOCS, 'assets', 'demo-data.js');
const OUTPUT_PATH = path.join(DOCS, 'assets', 'demo-sort-data.js');

export type SlotKey = 'auctionHouse' | 'dateText' | 'sessionName';

interface GameDimension {
  slot: SlotKey;
  label: string;
  value: string;
  evidenceValue: string | null;
  state: EvidenceDimensionState;
  note: string;
  demoOnly: boolean;
}

interface GameOption {
  value: string;
  demoOnly: boolean;
  note: string;
}

interface GameCombo {
  id: string;
  values: Record<SlotKey, string>;
  status: 'covered' | 'uncovered';
  recordId: string | null;
  recordTitle: string | null;
  gate: 'strong' | 'weak' | 'rejected' | null;
  dimensions: GameDimension[];
  conclusion: { code: string; label: string };
}

interface GameData {
  slots: Array<{ key: SlotKey; label: string; options: GameOption[] }>;
  combos: GameCombo[];
}

export interface SortChip {
  id: string;
  slot: SlotKey;
  slotLabel: string;
  short: string;
  value: string;
  state: EvidenceDimensionState;
  note: string;
  /** true = 冻结语料里没有这个写法，页面必须标「演示用词」 */
  demoOnly: boolean;
  /** true = 这条值就是该记录在这一维的原文值 */
  fromRecord: boolean;
}

export interface SortRound {
  id: string;
  index: number;
  lot: {
    comboId: string;
    recordId: string;
    recordTitle: string;
    gate: 'strong' | 'weak' | 'rejected';
    values: Record<SlotKey, string>;
  };
  /** 冻结记录自己在三维上的原文值与状态（复盘用，不参与玩法） */
  truth: Array<{ slot: SlotKey; label: string; evidenceValue: string | null; state: EvidenceDimensionState }>;
  chips: SortChip[];
  /** 从第几张（0 起）开始是「收尾三拍」——这一段一定不会再发完全对上 */
  settleFrom: number;
}

export interface SortScoring {
  hitBase: number;
  /** 收下非命中证据拿固定分（不乘倍率） */
  accept: Record<EvidenceDimensionState, number>;
  reject: Record<EvidenceDimensionState, number>;
  /** 收下之后连击怎么走：只有命中能续连击；收旁证与误收都会断 */
  acceptCombo: Record<EvidenceDimensionState, 'up' | 'reset'>;
  acceptLife: Record<EvidenceDimensionState, number>;
  multiplier: { per: number; step: number; cap: number };
  lives: number;
  /** 连击在每件器物开始时清零 */
  roundComboReset: true;
  timeoutCombo: 'reset';
  timeoutPoints: 0;
  settleBeats: number;
  note: string;
}

export interface SortStateMeta {
  label: string;
  short: string;
  tone: 'hit' | 'caliber' | 'edge' | 'conflict' | 'mismatch' | 'unknown';
  accept: string;
  reject: string;
  rule: string;
}

/** 一种牌序：只存下标，牌面本身仍是 rounds 里的同一批对象 */
export interface SortOrder {
  id: string;
  label: string;
  /** 每一轮的发牌顺序（rounds[i].chips 的下标） */
  rounds: number[][];
  /** 这一牌序的理论最高分（允许预知后续牌，用动态规划求） */
  best: number;
  /** 只按公开规则打（收尾三拍收旁证、其余放走）的得分——S 线按它可达来定 */
  steady: number;
  /** 只认字面相同（完全对上就收、其余放走）的得分，必须够不到 S */
  literal: number;
  /** 见旁证就收、不区分中段与收尾的得分，也必须够不到 S */
  eager: number;
}

export interface SortData {
  generatedAt: string;
  generator: string;
  note: string;
  states: Record<EvidenceDimensionState, SortStateMeta>;
  scoring: SortScoring;
  /** 分数线按「这一牌序的最高分」的比例折算 */
  grades: Array<{ grade: 'S' | 'A' | 'B' | 'C'; ratio: number; label: string }>;
  rounds: SortRound[];
  orders: SortOrder[];
  stats: { chips: number; byState: Record<EvidenceDimensionState, number> };
}

const SLOT_LABELS: Record<SlotKey, string> = {
  auctionHouse: '拍卖机构',
  dateText: '举办时间',
  sessionName: '专场名',
};

const SLOT_SHORT: Record<SlotKey, string> = {
  auctionHouse: '机构',
  dateText: '时间',
  sessionName: '专场',
};

/** 候选值池：全部来自冻结语料或 `demo-game-data.js` 已经标过的候选词，按"玩家最容易混的"排前面 */
const POOL: Record<SlotKey, string[]> = {
  auctionHouse: ['北京保利', '中国嘉德', '保利香港拍賣', '保利拍卖', '保利'],
  dateText: [
    '2021年12月5日',
    '2021年11月15日',
    '2021年秋季',
    '2021年8月',
    '2021年12月2日-6日',
    '去年秋天',
  ],
  sessionName: [
    '禹贡Ⅰ—盛清御瓷新风尚',
    '禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术',
    '禹贡Ⅲ—盛清御瓷新风尚',
    '宸赏—明清御瓷珍玩',
    '中國古董珍玩專場',
  ],
};

/**
 * 每轮十条，分成三段：
 *
 * - 头一拍固定：「完全对上」（第一次上甩就命中，不用读说明）；
 * - 中段六拍打乱：本轮的命中也在这里，且**最后一张固定是命中**——
 *   这样中段收旁证一定会付出「打断连击」的代价，玩家不能靠猜；
 * - 收尾三拍打乱：不发命中，是「兑现窗口」，收旁证在这里才划算。
 *
 * 两种牌序之间，除了第一拍之外全部重排；两轮还换了器物与日期
 * （11 月 15 日而不是 12 月 5 日），于是同一条「2021年秋季」
 * 从「边缘相容」变成「口径相容」——同一个写法、不同的断言精度，
 * 判据就不同，这是第二轮真正要玩家感到的东西。
 */
const HEAD_BEATS = 1;
const SETTLE_BEATS = 3;

const ROUND_PLAN: Array<{
  lotId: string;
  head: Array<{ slot: SlotKey; state: EvidenceDimensionState }>;
  core: Array<{ slot: SlotKey; state: EvidenceDimensionState }>;
  tail: Array<{ slot: SlotKey; state: EvidenceDimensionState }>;
}> = [
  {
    lotId: 'g-01',
    head: [{ slot: 'auctionHouse', state: 'exact' }],
    // 中段六张打乱，第六张固定是命中（中段最后一张一定是命中）
    core: [
      { slot: 'sessionName', state: 'mismatch' },
      { slot: 'dateText', state: 'caliber' },
      { slot: 'sessionName', state: 'exact' },
      { slot: 'dateText', state: 'unknown' },
      { slot: 'auctionHouse', state: 'conflict' },
      { slot: 'dateText', state: 'exact' },
    ],
    tail: [
      { slot: 'auctionHouse', state: 'caliber' },
      { slot: 'auctionHouse', state: 'caliber' },
      { slot: 'dateText', state: 'edge' },
    ],
  },
  {
    lotId: 'g-07',
    head: [{ slot: 'dateText', state: 'exact' }],
    core: [
      { slot: 'sessionName', state: 'mismatch' },
      { slot: 'auctionHouse', state: 'caliber' },
      { slot: 'dateText', state: 'conflict' },
      { slot: 'auctionHouse', state: 'exact' },
      { slot: 'dateText', state: 'unknown' },
      { slot: 'sessionName', state: 'exact' },
    ],
    tail: [
      { slot: 'auctionHouse', state: 'caliber' },
      { slot: 'dateText', state: 'caliber' },
      { slot: 'sessionName', state: 'mismatch' },
    ],
  },
];

/**
 * 分值表：与页面读到的 `scoring` 是同一份，测试会逐项核对。
 *
 * 这一版让「字面相同就收」不再是最优，办法是给「收旁证」标一个真实代价：
 *
 * - 倍率只由**连续命中**推动：连击 0 是 ×1、1 是 ×2、2 起是 ×3；
 *   收下相容/边缘会给固定分，但连击立刻归零、倍率掉回 ×1。
 *   所以中段（后面还有命中）收旁证，赚 8 分、亏掉后面每一拍的倍率；
 * - 放走相容/边缘不扣分，但也不给分——中段放走是「小亏」，收下是「大亏」；
 * - 每件器物的最后三拍不会再发命中（公开规则）。这三拍收旁证没有倍率可亏，
 *   是唯一的兑现窗口：同一个「口径相容」，中段该放、收尾该收。
 */
const SCORING: SortScoring = {
  hitBase: 10,
  accept: { exact: 0, caliber: 8, edge: 4, conflict: 0, mismatch: 0, unknown: 0 },
  reject: { exact: 0, caliber: 0, edge: 0, conflict: 1, mismatch: 1, unknown: 1 },
  acceptCombo: {
    exact: 'up',
    caliber: 'reset',
    edge: 'reset',
    conflict: 'reset',
    mismatch: 'reset',
    unknown: 'reset',
  },
  acceptLife: { exact: 0, caliber: 0, edge: 0, conflict: -1, mismatch: -1, unknown: 0 },
  multiplier: { per: 1, step: 1, cap: 3 },
  lives: 3,
  roundComboReset: true,
  timeoutCombo: 'reset',
  timeoutPoints: 0,
  settleBeats: SETTLE_BEATS,
  note:
    '命中＝10×倍率，倍率只看连续命中：连击 0 是 ×1、1 是 ×2、2 起是 ×3（封顶 ×3）。' +
    '收下相容 +8、边缘 +4，但连击立刻归零——中段收旁证会打断冲锋，后面每一拍都少拿一倍。' +
    '放走相容/边缘不扣分，但也不给分；中段放走是小亏，收下是大亏。' +
    '每件器物的最后三拍不会再发命中，这三拍收旁证不会亏倍率，是唯一的兑现窗口。' +
    '收下冲突/没对上掉一颗心；放走冲突/没对上/无从判断 +1；放走命中（漏判）、收下无从判断都断连击。',
};

const STATES: Record<EvidenceDimensionState, SortStateMeta> = {
  exact: {
    label: '完全对上',
    short: '直接支撑',
    tone: 'hit',
    accept: '命中',
    reject: '漏判',
    rule: '这一维按规则归一后一致，可以当作直接支撑',
  },
  caliber: {
    label: '口径相容',
    short: '说法不同',
    tone: 'caliber',
    accept: '只算旁证',
    reject: '放走',
    rule: '可能是同一场，只是写法不同；这不能算对上',
  },
  edge: {
    label: '边缘相容',
    short: '不能证明',
    tone: 'edge',
    accept: '不能当支撑',
    reject: '放走',
    rule: '没有矛盾，但这不能证明',
  },
  conflict: {
    label: '冲突候选',
    short: '指向别的值',
    tone: 'conflict',
    accept: '冲突候选',
    reject: '放走',
    rule: '点名了另一个值；冲突只作候选，不压成反对',
  },
  mismatch: {
    label: '没对上',
    short: '写的不是这个',
    tone: 'mismatch',
    accept: '不是这个值',
    reject: '放走',
    rule: '证据明确写的是另一个值',
  },
  unknown: {
    label: '无从判断',
    short: '判不了',
    tone: 'unknown',
    accept: '判不了',
    reject: '放走',
    rule: '解析不出可比的说法，判不了',
  },
};

function loadGameData(): GameData {
  const sandbox: { window: Record<string, unknown> } = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(GAME_DATA_PATH, 'utf8'), sandbox, {
    filename: 'assets/demo-game-data.js',
  });
  const data = sandbox.window.LODESTAR_DEMO_GAME as GameData | undefined;
  if (!data) throw new Error('demo-game-data.js 没有导出 LODESTAR_DEMO_GAME');
  return data;
}

/** 这一维用哪份实现比对：与门禁读的是同一套维度函数 */
function compareSlot(
  slot: SlotKey,
  claimValue: string,
  evidenceValue: string,
): { state: EvidenceDimensionState; note: string } {
  if (slot === 'auctionHouse') return compareInstitutionDimension(claimValue, evidenceValue);
  if (slot === 'dateText') return compareTimeDimension(claimValue, evidenceValue);
  return compareTextDimension(claimValue, evidenceValue);
}

/**
 * 「演示用词」的判据只看冻结语料：某条记录把它当成断言写过、或某行证据逐字摘到过，
 * 就算真实写法。不靠 `demo-game-data.js` 的候选词清单——那份清单只收了玩法要用的一小撮，
 * 用它判会把「2021年12月2日-6日」这种真在证据里出现过的写法误标成编的。
 */
function loadCorpusValues(): Record<SlotKey, Set<string>> {
  const sandbox: { window: Record<string, unknown> } = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(DEMO_DATA_PATH, 'utf8'), sandbox, {
    filename: 'assets/demo-data.js',
  });
  const demo = sandbox.window.LODESTAR_DEMO as {
    cases?: Array<{
      records?: Array<{
        fields?: Array<{ key: string; value: string }>;
        evidence?: Array<{ fieldKey: string; matchedValue: string | null }>;
      }>;
    }>;
  };
  const values: Record<SlotKey, Set<string>> = {
    auctionHouse: new Set(),
    dateText: new Set(),
    sessionName: new Set(),
  };
  for (const item of demo.cases ?? []) {
    for (const record of item.records ?? []) {
      for (const field of record.fields ?? []) {
        if (field.key in values) values[field.key as SlotKey].add(field.value);
      }
      for (const row of record.evidence ?? []) {
        if (row.fieldKey in values && row.matchedValue) {
          values[row.fieldKey as SlotKey].add(row.matchedValue);
        }
      }
    }
  }
  return values;
}

function buildRound(
  data: GameData,
  corpus: Record<SlotKey, Set<string>>,
  plan: (typeof ROUND_PLAN)[number],
  index: number,
): SortRound {
  const combo = data.combos.find((item) => item.id === plan.lotId);
  if (!combo) throw new Error(`冻结矩阵里找不到组合 ${plan.lotId}`);
  if (combo.status !== 'covered' || !combo.recordId) {
    throw new Error(`组合 ${plan.lotId} 没有挂到冻结记录上，不能当器物卡`);
  }
  const used = new Set<string>();
  const beats = [...plan.head, ...plan.core, ...plan.tail];
  const chips: SortChip[] = beats.map((beat, beatIndex) => {
    const evidenceValue = combo.dimensions.find((dimension) => dimension.slot === beat.slot)?.evidenceValue ?? null;
    const candidates = POOL[beat.slot];
    const value = candidates.find((candidate) => {
      if (used.has(`${beat.slot}\u0000${candidate}`)) return false;
      return compareSlot(beat.slot, combo.values[beat.slot], candidate).state === beat.state;
    });
    if (!value) {
      throw new Error(
        `第 ${index + 1} 轮的「${SLOT_LABELS[beat.slot]}」凑不出一条「${STATES[beat.state].label}」的证据`,
      );
    }
    used.add(`${beat.slot}\u0000${value}`);
    const compared = compareSlot(beat.slot, combo.values[beat.slot], value);
    return {
      id: `r${index + 1}-c${beatIndex + 1}`,
      slot: beat.slot,
      slotLabel: SLOT_LABELS[beat.slot],
      short: SLOT_SHORT[beat.slot],
      value,
      state: compared.state,
      note: compared.note,
      demoOnly: !corpus[beat.slot].has(value),
      fromRecord: evidenceValue !== null && evidenceValue === value,
    };
  });

  const truth = (['auctionHouse', 'dateText', 'sessionName'] as SlotKey[]).map((slot) => {
    const dimension = combo.dimensions.find((item) => item.slot === slot);
    return {
      slot,
      label: SLOT_LABELS[slot],
      evidenceValue: dimension?.evidenceValue ?? null,
      state: dimension?.state ?? 'unknown',
    };
  });

  return {
    id: `round-${index + 1}`,
    index,
    lot: {
      comboId: combo.id,
      recordId: combo.recordId,
      recordTitle: combo.recordTitle ?? combo.recordId,
      gate: combo.gate ?? 'weak',
      values: { ...combo.values },
    },
    truth,
    chips,
    settleFrom: chips.length - SETTLE_BEATS,
  };
}

/** 倍率只跟连击数有关，页面与这里必须是同一条公式 */
function multiplierOf(combo: number): number {
  const { per, step, cap } = SCORING.multiplier;
  return Math.min(cap, 1 + Math.floor(combo / per) * step);
}

/**
 * 一次判决的结果。与页面 `outcomeOf` 的分支一一对应，两边都由 SCORING 驱动。
 * 这里只算分、连击、心——文案由页面负责。
 */
function actOf(
  state: EvidenceDimensionState,
  action: 'accept' | 'reject',
  combo: number,
): { points: number; combo: 'up' | 'keep' | 'reset'; life: number } {
  if (action === 'accept') {
    if (state === 'exact') {
      return { points: Math.round(SCORING.hitBase * multiplierOf(combo)), combo: 'up', life: 0 };
    }
    return { points: SCORING.accept[state], combo: SCORING.acceptCombo[state], life: SCORING.acceptLife[state] };
  }
  if (state === 'exact') return { points: 0, combo: 'reset', life: 0 };
  return { points: SCORING.reject[state], combo: 'keep', life: 0 };
}

type Policy = (
  state: EvidenceDimensionState,
  combo: number,
  index: number,
  settleFrom: number,
) => 'accept' | 'reject';

/** 只认字面相同：完全对上就收，其余全放——这条策略必须够不到 S */
const LITERAL_POLICY: Policy = (state) => (state === 'exact' ? 'accept' : 'reject');

/**
 * 稳健策略：只看两眼就能打——一眼看状态，一眼看是不是收尾三拍。
 * 收尾三拍没有后续命中，收旁证没有代价；中段收会打断冲锋，所以放走。
 */
const STEADY_POLICY: Policy = (state, _combo, index, settleFrom) => {
  if (state === 'exact') return 'accept';
  if (state !== 'caliber' && state !== 'edge') return 'reject';
  return index >= settleFrom ? 'accept' : 'reject';
};

/** 见旁证就收、不分中段收尾——这条也不该拿到 S */
const EAGER_POLICY: Policy = (state) =>
  state === 'exact' || state === 'caliber' || state === 'edge' ? 'accept' : 'reject';

function runSequence(
  states: EvidenceDimensionState[],
  settleFrom: number,
  policy: Policy,
): number {
  let score = 0;
  let combo = 0;
  let lives = SCORING.lives;
  for (let index = 0; index < states.length; index += 1) {
    if (lives <= 0) break;
    const result = actOf(states[index], policy(states[index], combo, index, settleFrom), combo);
    score += result.points;
    lives += result.life;
    combo = result.combo === 'up' ? combo + 1 : result.combo === 'reset' ? 0 : combo;
  }
  return score;
}

/** 理论最高分：允许预知后续牌，十拍的状态空间很小，直接动态规划 */
function bestScoreOf(states: EvidenceDimensionState[]): number {
  const memo = new Map<string, number>();
  const go = (index: number, combo: number, lives: number): number => {
    if (index >= states.length || lives <= 0) return 0;
    const key = `${index}|${combo}|${lives}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    let best = 0;
    for (const action of ['accept', 'reject'] as const) {
      const result = actOf(states[index], action, combo);
      const nextCombo = result.combo === 'up' ? combo + 1 : result.combo === 'reset' ? 0 : combo;
      best = Math.max(best, result.points + go(index + 1, nextCombo, lives + result.life));
    }
    memo.set(key, best);
    return best;
  };
  return go(0, 0, SCORING.lives);
}

/** 确定性伪随机（线性同余），保证每次构建生成的牌序完全一样 */
function shuffled(length: number, seed: number): number[] {
  const order = Array.from({ length }, (_, index) => index);
  let state = seed;
  for (let i = order.length - 1; i > 0; i -= 1) {
    state = (state * 9301 + 49297) % 233280;
    const j = Math.floor((state / 233280) * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/**
 * 一种牌序 = 头一拍不动 + 中段前五张重排（第六张固定是命中）+ 收尾三拍重排。
 * 教学约束（第一张命中、中段最后一张命中、收尾不发命中）全部保住。
 */
function variantOrder(round: SortRound, seed: number): number[] {
  const length = round.chips.length;
  const coreStart = HEAD_BEATS;
  const coreEnd = round.settleFrom - 1; // 中段最后一张（固定命中）不参与重排
  const head = Array.from({ length: HEAD_BEATS }, (_, index) => index);
  const core = shuffled(coreEnd - coreStart, seed).map((offset) => coreStart + offset);
  const tail = shuffled(length - round.settleFrom, seed + 71).map((offset) => round.settleFrom + offset);
  const order: number[] = [...head, ...core, coreEnd, ...tail];
  if (order.length !== length) throw new Error('牌序长度与牌面不一致');
  return order;
}

/**
 * 生成若干种牌序。同一种牌序的牌面完全一样（六态齐备），只是先后不同；
 * 开局随机抽一种，并保证不与上一局相同。
 */
function buildOrders(rounds: SortRound[]): SortOrder[] {
  const orders: SortOrder[] = [];
  const seeds = [0, 137, 251, 419, 557, 673];
  for (let variant = 0; variant < seeds.length; variant += 1) {
    const plan = rounds.map((round, roundIndex) =>
      variant === 0
        ? round.chips.map((_, index) => index)
        : variantOrder(round, seeds[variant] + roundIndex * 977),
    );

    let best = 0;
    let steady = 0;
    let literal = 0;
    let eager = 0;
    for (let roundIndex = 0; roundIndex < rounds.length; roundIndex += 1) {
      const round = rounds[roundIndex];
      const states = plan[roundIndex].map((chipIndex) => round.chips[chipIndex].state);
      best += bestScoreOf(states);
      steady += runSequence(states, round.settleFrom, STEADY_POLICY);
      literal += runSequence(states, round.settleFrom, LITERAL_POLICY);
      eager += runSequence(states, round.settleFrom, EAGER_POLICY);
    }

    const sMin = Math.round(best * 0.92);
    if (literal >= sMin) {
      throw new Error(`牌序 ${variant} 只靠字面比对就能拿到 S（${literal} ≥ ${sMin}），必须重排`);
    }
    if (eager >= sMin) {
      throw new Error(`牌序 ${variant} 见旁证就收也能拿到 S（${eager} ≥ ${sMin}），条件没做成取舍`);
    }
    if (steady < sMin) {
      throw new Error(`牌序 ${variant} 的稳健打法拿不到 S（${steady} < ${sMin}），分数线定得太高`);
    }
    orders.push({
      id: `order-${variant + 1}`,
      label: variant === 0 ? '教学顺序' : `牌序 ${variant + 1}`,
      rounds: plan,
      best,
      steady,
      literal,
      eager,
    });
  }
  return orders;
}

function buildData(): SortData {
  const data = loadGameData();
  const corpus = loadCorpusValues();
  const rounds = ROUND_PLAN.map((plan, index) => buildRound(data, corpus, plan, index));

  const byState: Record<EvidenceDimensionState, number> = {
    exact: 0,
    caliber: 0,
    edge: 0,
    conflict: 0,
    mismatch: 0,
    unknown: 0,
  };
  for (const round of rounds) {
    for (const chip of round.chips) byState[chip.state] += 1;
  }
  for (const state of Object.keys(byState) as EvidenceDimensionState[]) {
    if (byState[state] === 0) {
      throw new Error(`六种状态里的「${STATES[state].label}」一局都碰不到，玩法缺一档`);
    }
  }
  for (const round of rounds) {
    if (round.settleFrom !== round.chips.length - SETTLE_BEATS) {
      throw new Error(`${round.id} 的收尾窗口长度不对`);
    }
    const tail = round.chips.slice(round.settleFrom);
    if (tail.some((chip) => chip.state === 'exact')) {
      throw new Error(`${round.id} 的收尾三拍里出现了完全对上，兑现窗口不成立`);
    }
  }

  const orders = buildOrders(rounds);

  return {
    generatedAt: new Date().toISOString(),
    generator: 'src/demo-page/build-sort-data.ts',
    note:
      '由冻结矩阵 docs/assets/demo-game-data.js 生成，不要手改。' +
      '每条证据的状态是构建时用引擎的维度函数算出来的，页面只查表。',
    states: STATES,
    scoring: SCORING,
    grades: [
      { grade: 'S', ratio: 0.92, label: '接近这一局的最优解：命中没漏，旁证也只在兑现窗口里收' },
      { grade: 'A', ratio: 0.72, label: '取舍大体正确，几处亏了倍率' },
      { grade: 'B', ratio: 0.5, label: '把旁证当成了命中，或把命中放走了' },
      { grade: 'C', ratio: 0, label: '先把两个动作的手感练熟' },
    ],
    rounds,
    orders,
    stats: { chips: rounds.reduce((sum, round) => sum + round.chips.length, 0), byState },
  };
}

function main(): void {
  const data = buildData();
  const body = [
    '// 由 src/demo-page/build-sort-data.ts 从 docs/assets/demo-game-data.js 生成，不要手改；',
    '// 改玩法或候选值后重跑 pnpm run demo:sort。',
    `window.LODESTAR_SORT = ${JSON.stringify(data, null, 2)};`,
    '',
  ].join('\n');
  fs.writeFileSync(OUTPUT_PATH, body, 'utf8');
  const perRound = data.rounds.map(
    (round) => `${round.id} ${round.chips.length} 条（${round.lot.values.auctionHouse} / ${round.lot.values.dateText}）`,
  );
  const perOrder = data.orders.map(
    (order) => `${order.label} 最优 ${order.best} / 稳健 ${order.steady} / 字面 ${order.literal} / 逢旁证就收 ${order.eager}`,
  );
  process.stdout.write(
    `写入 ${path.relative(PACKAGE_ROOT, OUTPUT_PATH)}：${perRound.join('，')}；` +
      `六态 ${JSON.stringify(data.stats.byState)}；牌序 ${perOrder.join('；')}\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
