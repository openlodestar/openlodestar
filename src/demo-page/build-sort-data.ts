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
 * 题库不是一副牌：这里按「几组器物 + 每组两轮」生成多个**内容不同**的牌局，
 * 页面每局抽一个、且不与最近两局重复。六态分布、教学约束（第一拍命中、
 * 中段最后一张命中、收尾三拍不发命中）每一局都守住。
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
  /** 从第几张（0 起）开始是「兑现窗口」——这一段一定不会再发完全对上 */
  settleFrom: number;
}

export interface SortScoring {
  hitBase: number;
  /** 收下非命中证据拿固定分（不乘连击倍率） */
  accept: Record<EvidenceDimensionState, number>;
  reject: Record<EvidenceDimensionState, number>;
  /** 收下之后连击怎么走：只有命中能续连击；收旁证与误收都会断 */
  acceptCombo: Record<EvidenceDimensionState, 'up' | 'reset'>;
  acceptLife: Record<EvidenceDimensionState, number>;
  /** 收下冲突候选 / 没对上时的倒扣分（除掉一颗心、断连击之外的可见代价） */
  wrongPenalty: number;
  multiplier: { per: number; step: number; cap: number };
  /** 兑现窗口里收旁证，固定分乘这个倍数；窗口外不乘 */
  windowBonus: { multiplier: number; states: EvidenceDimensionState[] };
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
  /** 只按公开规则打（兑现窗口收旁证、其余放走）的得分——必须等于理论最高分 */
  steady: number;
  /** 只认字面相同（完全对上就收、其余放走）的得分，必须掉到 B 档 */
  literal: number;
  /** 见旁证就收、不区分中段与收尾的得分，也必须够不到 S */
  eager: number;
  /** 读对规则、但在兑现窗口里漏收一条旁证的得分——S 线必须容忍这一次手误 */
  slipOne: number;
  /** 漏收两条窗口旁证——这一档必须掉出 S，分数线才有意义 */
  slipTwo: number;
  /** 读对规则、但误收了一条冲突/没对上——S 要求整局干净，这一档必须掉出 S */
  oneWrong: number;
}

/** 一个牌局：两件器物 + 六种牌序。局与局之间牌面内容不同，不只是换个顺序。 */
export interface SortRun {
  id: string;
  label: string;
  rounds: SortRound[];
  orders: SortOrder[];
}

export interface SortData {
  generatedAt: string;
  generator: string;
  note: string;
  states: Record<EvidenceDimensionState, SortStateMeta>;
  scoring: SortScoring;
  /** 分数线按「这一牌序的最高分」的比例折算 */
  grades: Array<{
    grade: 'S' | 'A' | 'B' | 'C';
    ratio: number;
    label: string;
    /** 这一档除了分数线，还要求整局没有误收冲突/没对上 */
    requiresClean?: boolean;
  }>;
  runs: SortRun[];
  stats: {
    /** 每个牌局的牌数 */
    chips: number;
    byState: Record<EvidenceDimensionState, number>;
    runs: number;
    /** 两局之间「同维度同写法」的牌有几张，以及其中连答案都一样的几张 */
    deckOverlap: Array<{ a: string; b: string; shared: number; sameAnswer: number }>;
  };
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

/**
 * 候选值池：全部来自冻结语料或 `demo-game-data.js` 已经标过的候选词，另有两条
 * 目录里常见的模糊写法（「2021年底」「不详」），它们在页面上会带「演示用词」标记。
 * 加这两条是为了让「口径相容」与「无从判断」各多一个可选写法——否则每个牌局
 * 的这两档只能落到同一个词上，局与局之间必然逐字重复。
 */
const POOL: Record<SlotKey, string[]> = {
  auctionHouse: ['北京保利', '保利香港拍賣', '保利拍卖', '保利', '中国嘉德国际拍卖有限公司', '中国嘉德'],
  dateText: [
    '2021年12月5日',
    '2021年11月15日',
    '2021年秋季',
    '2021年8月',
    '2021年12月',
    '2021年12月2日-6日',
    '2021年11月26日至12月13日',
    '2021秋季',
    '2021/12/5',
    '2021-12-05',
    '2022年7月14日',
    '2022年秋季',
    '2022春拍',
    '2024年春季',
    '2025年5月7日',
    '2025年8月13日',
    '2025春季',
    '去年秋天',
    '2021年底',
    '不详',
  ],
  sessionName: [
    '禹贡Ⅰ—盛清御瓷新风尚',
    '禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术',
    '禹贡Ⅲ—盛清御瓷新风尚',
    '宸赏—明清御瓷珍玩',
    '中國古董珍玩專場',
    '禹貢I - 盛清御瓷新風尚',
    '递藏之趣专场',
  ],
};

interface Beat {
  slot: SlotKey;
  state: EvidenceDimensionState;
}

const HEAD_BEATS = 1;
const SETTLE_BEATS = 3;

/**
 * 两套十拍骨架，按器物自己的时间断言挑一套：
 *
 * - 头一拍固定「完全对上」：第一次上甩就命中，不用读说明；
 * - 中段六拍打乱，**第六张固定是命中**：中段收旁证一定还有后续命中可亏；
 * - 收尾三拍打乱且不发命中，是兑现窗口。
 *
 * A 套用于 12 月 5 日那件（时间维有「边缘相容」的写法），
 * B 套用于 11 月 15 日那件（同一条「2021年秋季」在这里变成「口径相容」，
 * 时间维没有边缘相容可用，多出来的一拍换成专场维的「没对上」）。
 * 六态在整套牌里必现，每套骨架自身也守「第一拍命中、中段末位命中、收尾无命中」。
 */
const TEMPLATE_EDGE: Beat[] = [
  { slot: 'auctionHouse', state: 'exact' },
  { slot: 'sessionName', state: 'mismatch' },
  { slot: 'dateText', state: 'caliber' },
  { slot: 'sessionName', state: 'exact' },
  { slot: 'dateText', state: 'unknown' },
  { slot: 'auctionHouse', state: 'conflict' },
  { slot: 'dateText', state: 'exact' },
  { slot: 'auctionHouse', state: 'caliber' },
  { slot: 'dateText', state: 'edge' },
  { slot: 'dateText', state: 'caliber' },
];

const TEMPLATE_PLAIN: Beat[] = [
  { slot: 'auctionHouse', state: 'exact' },
  { slot: 'sessionName', state: 'mismatch' },
  { slot: 'dateText', state: 'caliber' },
  { slot: 'dateText', state: 'conflict' },
  { slot: 'sessionName', state: 'exact' },
  { slot: 'dateText', state: 'unknown' },
  { slot: 'dateText', state: 'exact' },
  { slot: 'dateText', state: 'caliber' },
  { slot: 'auctionHouse', state: 'caliber' },
  { slot: 'sessionName', state: 'mismatch' },
];

/**
 * 四个牌局，每个两件器物。第一件固定是 12 月 5 日那场（A 套骨架，只有这一天
 * 在冻结语料里能比对出「边缘相容」）；第二件的日期、机构、专场在四局之间轮换，
 * 让四局的开局器物卡、两件器物的具体写法都不一样。
 */
const RUN_PLANS: Array<{ id: string; lots: [string, string] }> = [
  { id: 'run-1', lots: ['g-03', 'g-82'] },
  { id: 'run-2', lots: ['g-52', 'g-20'] },
  { id: 'run-3', lots: ['g-01', 'g-62'] },
  { id: 'run-4', lots: ['g-51', 'g-83'] },
];

/**
 * 分值表：与页面读到的 `scoring` 是同一份，测试会逐项核对。
 *
 * 让「字面相同就收」掉档的办法，是给「收旁证」标一个**位置相关**的价：
 *
 * - 倍率只由**连续命中**推动：连击 0 是 ×1、1 是 ×2、2 起是 ×3；
 *   收下相容/边缘会给固定分，但连击立刻归零、倍率掉回 ×1。
 *   中段（后面还有命中）收旁证，赚 8 分、亏掉后面每一拍的倍率；
 * - 每件器物的最后三拍不会再发命中（公开规则）。这三拍收旁证没有倍率可亏，
 *   而且固定分翻倍（+8 → +16、+4 → +8）——这是唯一的兑现窗口；
 * - 于是同一个「口径相容」，中段该放、窗口该收。只认字面的人窗口里一分不拿：
 *   六条命中拿满也只有 127 / 199（64%），明确掉到 B 档。
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
  wrongPenalty: 6,
  multiplier: { per: 1, step: 1, cap: 3 },
  windowBonus: { multiplier: 2, states: ['caliber', 'edge'] },
  lives: 3,
  roundComboReset: true,
  timeoutCombo: 'reset',
  timeoutPoints: 0,
  settleBeats: SETTLE_BEATS,
  note:
    '命中＝10×倍率，倍率只看连续命中：连击 0 是 ×1、1 是 ×2、2 起是 ×3（封顶 ×3）。' +
    '收下相容 +8、边缘 +4，但连击立刻归零——中段收旁证会打断冲锋，后面每一拍都少拿一倍。' +
    '每件器物的最后三拍不会再发命中，这三拍收旁证不亏倍率、分值还翻倍（相容 +16、边缘 +8），是兑现窗口；' +
    '同一个相容，中段收会亏、窗口里收才划算。' +
    '放走相容/边缘不给分；收下冲突/没对上倒扣 6 分、掉一颗心、连击归零——S 档要求整局没有这种误收；' +
    '放走冲突/没对上/无从判断 +1；' +
    '放走命中（漏判）、收下无从判断都断连击；换下一件器物时连击清零，倍率回到 ×1。',
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

/** 值在已生成的牌里被用过几次：局与局之间优先挑没用过的写法 */
type Usage = Record<SlotKey, Map<string, number>>;

function emptyUsage(): Usage {
  return { auctionHouse: new Map(), dateText: new Map(), sessionName: new Map() };
}

function usageOf(usage: Usage, slot: SlotKey, claim: string, value: string): number {
  return usage[slot].get(`${claim}\u0000${value}`) ?? 0;
}

/**
 * 给一拍挑一个写法：按「本局还没用过 → 全局用得少 → 轮转起点」排序，
 * 再用回溯保证后面的拍子仍然凑得齐。
 */
function assignValues(
  combo: GameCombo,
  template: Beat[],
  rotatedBy: number,
  usage: Usage,
  used: Set<string>,
): string[] {
  const lists = template.map((beat, beatIndex) => {
    const claim = combo.values[beat.slot];
    const pool = POOL[beat.slot];
    const options = pool.filter((value) => compareSlot(beat.slot, claim, value).state === beat.state);
    if (!options.length) {
      throw new Error(
        `组合 ${combo.id} 的「${SLOT_LABELS[beat.slot]}」凑不出一条「${STATES[beat.state].label}」的证据`,
      );
    }
    // 先从轮转起点把候选切一刀再排序：用得少的优先，用得一样多时按轮转起点往后取，
    // 这样同样的状态在第二、三局会落到不同的写法上（只靠下标偏移会让排序恒定，换汤不换药）。
    const start = (rotatedBy + beatIndex) % options.length;
    const rotated = options.slice(start).concat(options.slice(0, start));
    return rotated
      .map((value, offset) => ({ value, offset, use: usageOf(usage, beat.slot, claim, value) }))
      .sort((a, b) => a.use - b.use || a.offset - b.offset)
      .map((item) => item.value);
  });

  const picks: string[] = [];
  const dfs = (index: number): boolean => {
    if (index === template.length) return true;
    const slot = template[index].slot;
    for (const value of lists[index]) {
      const key = `${slot}\u0000${value}`;
      if (used.has(key)) continue;
      used.add(key);
      picks[index] = value;
      if (dfs(index + 1)) return true;
      used.delete(key);
    }
    return false;
  };
  if (!dfs(0)) {
    throw new Error(`组合 ${combo.id} 的十拍凑不齐：同一维的写法不够用`);
  }
  return picks;
}

function buildRound(
  data: GameData,
  corpus: Record<SlotKey, Set<string>>,
  usage: Usage,
  used: Set<string>,
  lotId: string,
  template: Beat[],
  index: number,
  runIndex: number,
): SortRound {
  const combo = data.combos.find((item) => item.id === lotId);
  if (!combo) throw new Error(`冻结矩阵里找不到组合 ${lotId}`);
  if (combo.status !== 'covered' || !combo.recordId) {
    throw new Error(`组合 ${lotId} 没有挂到冻结记录上，不能当器物卡`);
  }
  const seed = runIndex * 3 + index * 7;
  let values: string[];
  try {
    values = assignValues(combo, template, seed, usage, used);
  } catch (error) {
    // 本局两件器物的写法撞车、退不开时，只保证「同一件器物里不重复」——
    // 宁可跨器物重一句，也不能因为凑不齐就构建失败。
    values = assignValues(combo, template, seed, usage, new Set<string>());
  }
  const chips: SortChip[] = template.map((beat, beatIndex) => {
    const evidenceValue = combo.dimensions.find((dimension) => dimension.slot === beat.slot)?.evidenceValue ?? null;
    const value = values[beatIndex];
    const compared = compareSlot(beat.slot, combo.values[beat.slot], value);
    const usageKey = `${combo.values[beat.slot]}\u0000${value}`;
    usage[beat.slot].set(usageKey, (usage[beat.slot].get(usageKey) ?? 0) + 1);
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

function inWindowBonus(state: EvidenceDimensionState): boolean {
  return SCORING.windowBonus.states.indexOf(state) >= 0;
}

/**
 * 一次判决的结果。与页面 `outcomeOf` 的分支一一对应，两边都由 SCORING 驱动。
 * 这里只算分、连击、心——文案由页面负责。
 */
function actOf(
  state: EvidenceDimensionState,
  action: 'accept' | 'reject',
  combo: number,
  inWindow: boolean,
): { points: number; combo: 'up' | 'keep' | 'reset'; life: number } {
  if (action === 'accept') {
    if (state === 'exact') {
      return { points: Math.round(SCORING.hitBase * multiplierOf(combo)), combo: 'up', life: 0 };
    }
    if (state === 'conflict' || state === 'mismatch') {
      return {
        points: -SCORING.wrongPenalty,
        combo: SCORING.acceptCombo[state],
        life: SCORING.acceptLife[state],
      };
    }
    const points =
      SCORING.accept[state] * (inWindow && inWindowBonus(state) ? SCORING.windowBonus.multiplier : 1);
    return { points, combo: SCORING.acceptCombo[state], life: SCORING.acceptLife[state] };
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

/** 只认字面相同：完全对上就收，其余全放——这条策略必须掉到 B 档 */
const LITERAL_POLICY: Policy = (state) => (state === 'exact' ? 'accept' : 'reject');

/**
 * 稳健策略：只看两眼就能打——一眼看状态，一眼看是不是兑现窗口。
 * 窗口里没有后续命中，收旁证没有代价且分值翻倍；中段收会打断冲锋，所以放走。
 */
const STEADY_POLICY: Policy = (state, _combo, index, settleFrom) => {
  if (state === 'exact') return 'accept';
  if (state !== 'caliber' && state !== 'edge') return 'reject';
  return index >= settleFrom ? 'accept' : 'reject';
};

/** 见旁证就收、不分中段收尾——这条也不该拿到 S */
const EAGER_POLICY: Policy = (state) =>
  state === 'exact' || state === 'caliber' || state === 'edge' ? 'accept' : 'reject';

/**
 * S 线按最优分的 90% 折算，取整后是 180/199。
 *
 * 这一版的目标不是「够得着」而是「够得着且干净」：
 * - 读对规则、只在兑现窗口里收旁证的稳健打法 = 199，稳进 S；
 * - 窗口里漏收一条旁证 = 183，仍在 S 内（认真读一局允许一次手误）；
 * - 漏收两条 = 175、见旁证就收（粗糙打法）= 175，明确进不去；
 * - 误收冲突/没对上除了掉心、断连击，还倒扣 6 分；这类局即使分数摸到 S 线，
 *   也由页面按「S 要求整局没有误收」挡回 A。
 *
 * 上一版取 88.5%（177），S 与粗糙打法只差 2 分，而且误收一条冲突仍能拿 S——
 * 最高档变成了「窗口收全了」而不是「打得干净」。
 */
const S_RATIO = 0.9;

/** 读对规则，但在整局的前 `slips` 个兑现窗口旁证上手滑放走——用来量 S 线的容忍度 */
function steadyWithSlips(
  rounds: SortRound[],
  plan: number[][],
  slips: number,
): number {
  let remaining = slips;
  let total = 0;
  for (let roundIndex = 0; roundIndex < rounds.length; roundIndex += 1) {
    const round = rounds[roundIndex];
    const states = plan[roundIndex].map((chipIndex) => round.chips[chipIndex].state);
    let score = 0;
    let combo = 0;
    let lives = SCORING.lives;
    for (let index = 0; index < states.length; index += 1) {
      if (lives <= 0) break;
      const state = states[index];
      const side = state === 'caliber' || state === 'edge';
      const inWindow = index >= round.settleFrom;
      let action: 'accept' | 'reject';
      if (state === 'exact') action = 'accept';
      else if (side && inWindow && remaining > 0) {
        action = 'reject';
        remaining -= 1;
      } else action = side && inWindow ? 'accept' : 'reject';
      const result = actOf(state, action, combo, inWindow);
      score += result.points;
      lives += result.life;
      combo = result.combo === 'up' ? combo + 1 : result.combo === 'reset' ? 0 : combo;
    }
    total += score;
  }
  return total;
}

/** 读对规则，但整局第一次遇到冲突/没对上时误收——S 要求整局干净，这一档必须掉出去 */
function steadyWithOneWrong(rounds: SortRound[], plan: number[][]): number {
  let wrongUsed = false;
  let total = 0;
  for (let roundIndex = 0; roundIndex < rounds.length; roundIndex += 1) {
    const round = rounds[roundIndex];
    const states = plan[roundIndex].map((chipIndex) => round.chips[chipIndex].state);
    let score = 0;
    let combo = 0;
    let lives = SCORING.lives;
    for (let index = 0; index < states.length; index += 1) {
      if (lives <= 0) break;
      const state = states[index];
      const side = state === 'caliber' || state === 'edge';
      const inWindow = index >= round.settleFrom;
      let action: 'accept' | 'reject';
      if (state === 'exact') action = 'accept';
      else if (state === 'conflict' || state === 'mismatch') {
        action = wrongUsed ? 'reject' : 'accept';
        wrongUsed = true;
      } else action = side && inWindow ? 'accept' : 'reject';
      const result = actOf(state, action, combo, inWindow);
      score += result.points;
      lives += result.life;
      combo = result.combo === 'up' ? combo + 1 : result.combo === 'reset' ? 0 : combo;
    }
    total += score;
  }
  return total;
}

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
    const result = actOf(states[index], policy(states[index], combo, index, settleFrom), combo, index >= settleFrom);
    score += result.points;
    lives += result.life;
    combo = result.combo === 'up' ? combo + 1 : result.combo === 'reset' ? 0 : combo;
  }
  return score;
}

/** 理论最高分：允许预知后续牌，十拍的状态空间很小，直接动态规划 */
function bestScoreOf(states: EvidenceDimensionState[], settleFrom: number): number {
  const memo = new Map<string, number>();
  const go = (index: number, combo: number, lives: number): number => {
    if (index >= states.length || lives <= 0) return 0;
    const key = `${index}|${combo}|${lives}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    let best = 0;
    for (const action of ['accept', 'reject'] as const) {
      const result = actOf(states[index], action, combo, index >= settleFrom);
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
 * 生成一个牌局的六种牌序，并逐牌序验算这些不等式：
 * 只认字面必须掉到 B 档（低于 A 的 72%）、见旁证就收必须够不到 S、
 * 稳健策略必须等于理论最高分、漏一条窗口旁证仍 ≥ S 线、漏两条 < S 线、
 * 误收一条冲突/没对上必须掉出 S。任何一条不成立就构建失败。
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
      best += bestScoreOf(states, round.settleFrom);
      steady += runSequence(states, round.settleFrom, STEADY_POLICY);
      literal += runSequence(states, round.settleFrom, LITERAL_POLICY);
      eager += runSequence(states, round.settleFrom, EAGER_POLICY);
    }
    const slipOne = steadyWithSlips(rounds, plan, 1);
    const slipTwo = steadyWithSlips(rounds, plan, 2);
    const oneWrong = steadyWithOneWrong(rounds, plan);

    const sMin = Math.ceil(best * S_RATIO);
    if (steady !== best) {
      throw new Error(`牌序 ${variant + 1} 的稳健打法不是最优（${steady} ≠ ${best}），最优解不可解释`);
    }
    if (literal >= sMin) {
      throw new Error(`牌序 ${variant + 1} 只靠字面比对就能拿到 S（${literal} ≥ ${sMin}），必须重排`);
    }
    if (literal / best >= 0.72) {
      throw new Error(`牌序 ${variant + 1} 只认字面还有 ${Math.round((literal / best) * 100)}%，没掉到 B 档`);
    }
    if (eager >= sMin) {
      throw new Error(`牌序 ${variant + 1} 见旁证就收也能拿到 S（${eager} ≥ ${sMin}），条件没做成取舍`);
    }
    // S 线必须容得下「读对规则、手滑漏收一条窗口旁证」，否则认真读一局也摸不到最高档
    if (slipOne < sMin) {
      throw new Error(
        `牌序 ${variant + 1} 漏收一条窗口旁证就掉出 S（${slipOne} < ${sMin}），S 线定得过严`,
      );
    }
    // 但两条就掉出去，S 才有区分度
    if (slipTwo >= sMin) {
      throw new Error(`牌序 ${variant + 1} 漏收两条窗口旁证仍是 S（${slipTwo} ≥ ${sMin}），S 线太松`);
    }
    // 误收一条冲突/没对上：即使分数还够线，S 也不该给——这条校验守住「S = 打得干净」
    if (oneWrong >= sMin) {
      throw new Error(
        `牌序 ${variant + 1} 误收一条冲突/没对上仍是 S（${oneWrong} ≥ ${sMin}），S 线没体现干净的代价`,
      );
    }
    orders.push({
      id: `order-${variant + 1}`,
      label: variant === 0 ? '教学顺序' : `牌序 ${variant + 1}`,
      rounds: plan,
      best,
      steady,
      literal,
      eager,
      slipOne,
      slipTwo,
      oneWrong,
    });
  }
  return orders;
}

/**
 * 两局之间的牌面重合：
 * - `shared`：同一维度、同一写法在两边都出现的有几张（逐字相同的说法）；
 * - `sameAnswer`：这些重合里，连判定状态也一样的几张——只有这部分能让「记答案」过关；
 *   其余重合因为器物卡换了、断言不同，同一条说法在这一局是另一种状态。
 */
const DECK_LIMITS = { sameAnswer: 9 };

function deckOverlapOf(a: SortRun, b: SortRun): { shared: number; sameAnswer: number } {
  const states = new Map<string, EvidenceDimensionState>();
  for (const round of a.rounds) {
    for (const chip of round.chips) states.set(`${chip.slot}\u0000${chip.value}`, chip.state);
  }
  let shared = 0;
  let sameAnswer = 0;
  for (const round of b.rounds) {
    for (const chip of round.chips) {
      const key = `${chip.slot}\u0000${chip.value}`;
      const before = states.get(key);
      if (before === undefined) continue;
      shared += 1;
      if (before === chip.state) sameAnswer += 1;
    }
  }
  return { shared, sameAnswer };
}

function buildData(): SortData {
  const data = loadGameData();
  const corpus = loadCorpusValues();
  const usage = emptyUsage();
  const runs: SortRun[] = [];

  for (let runIndex = 0; runIndex < RUN_PLANS.length; runIndex += 1) {
    const plan = RUN_PLANS[runIndex];
    /** 同一个牌局里两件器物不重复用同一句说法（跨器物也不许撞） */
    const usedInRun = new Set<string>();
    const rounds = plan.lots.map((lotId, roundIndex) => {
      const combo = data.combos.find((item) => item.id === lotId);
      if (!combo) throw new Error(`冻结矩阵里找不到组合 ${lotId}`);
      const expected = roundIndex === 0 ? TEMPLATE_EDGE : TEMPLATE_PLAIN;
      const claim = combo.values.dateText;
      const allowed =
        roundIndex === 0
          ? ['2021年12月5日']
          : ['2021年11月15日', '2021年8月', '2021年秋季', '2021年12月5日'];
      if (allowed.indexOf(claim) < 0) {
        throw new Error(
          `${lotId} 的举办时间是「${claim}」，但第 ${roundIndex + 1} 轮骨架只适用于 ${allowed.join(' / ')}`,
        );
      }
      return buildRound(data, corpus, usage, usedInRun, lotId, expected, roundIndex, runIndex);
    });

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
        throw new Error(`牌局 ${plan.id} 里「${STATES[state].label}」一次都碰不到，玩法缺一档`);
      }
    }
    for (const round of rounds) {
      if (round.settleFrom !== round.chips.length - SETTLE_BEATS) {
        throw new Error(`${round.id} 的兑现窗口长度不对`);
      }
      const tail = round.chips.slice(round.settleFrom);
      if (tail.some((chip) => chip.state === 'exact')) {
        throw new Error(`${round.id} 的收尾三拍里出现了完全对上，兑现窗口不成立`);
      }
    }

    runs.push({
      id: plan.id,
      label: `牌局 ${runIndex + 1}`,
      rounds,
      orders: buildOrders(rounds),
    });
  }

  const deckOverlap: SortData['stats']['deckOverlap'] = [];
  for (let a = 0; a < runs.length; a += 1) {
    for (let b = a + 1; b < runs.length; b += 1) {
      const measured = deckOverlapOf(runs[a], runs[b]);
      if (measured.shared >= 20) {
        throw new Error(`${runs[a].id} 与 ${runs[b].id} 的牌面完全一样，题库没有换内容`);
      }
      if (measured.sameAnswer > DECK_LIMITS.sameAnswer) {
        throw new Error(
          `${runs[a].id} 与 ${runs[b].id} 有 ${measured.sameAnswer} 张牌连答案都相同` +
            `（上限 ${DECK_LIMITS.sameAnswer}），靠背答案就能过`,
        );
      }
      deckOverlap.push({ a: runs[a].id, b: runs[b].id, shared: measured.shared, sameAnswer: measured.sameAnswer });
    }
  }
  const openings = runs.map((run) => `${run.rounds[0].lot.comboId}|${run.rounds[0].chips[0].value}`);
  if (new Set(openings).size !== openings.length) {
    throw new Error('有两个牌局的开局一模一样，刷新几次就会看到同一副牌');
  }

  const byState: Record<EvidenceDimensionState, number> = {
    exact: 0,
    caliber: 0,
    edge: 0,
    conflict: 0,
    mismatch: 0,
    unknown: 0,
  };
  for (const chip of runs[0].rounds.flatMap((round) => round.chips)) byState[chip.state] += 1;

  return {
    generatedAt: new Date().toISOString(),
    generator: 'src/demo-page/build-sort-data.ts',
    note:
      '由冻结矩阵 docs/assets/demo-game-data.js 生成，不要手改。' +
      '每条证据的状态是构建时用引擎的维度函数算出来的，页面只查表。',
    states: STATES,
    scoring: SCORING,
    grades: [
      {
        grade: 'S',
        ratio: S_RATIO,
        requiresClean: true,
        label:
          '命中没漏，旁证只在兑现窗口里收，整局没有误收冲突/没对上；漏一条窗口旁证仍在 S 内',
      },
      { grade: 'A', ratio: 0.72, label: '取舍方向对了一半：要么把兑现窗口里的旁证全放走了，要么在中段收旁证断了连击' },
      { grade: 'B', ratio: 0.5, label: '只按字面分：命中的都收了，但旁证全放走，兑现窗口一分没拿' },
      { grade: 'C', ratio: 0, label: '这一局的失分点见下面复盘' },
    ],
    runs,
    stats: {
      chips: runs[0].rounds.reduce((sum, round) => sum + round.chips.length, 0),
      byState,
      runs: runs.length,
      deckOverlap,
    },
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
  const perRun = data.runs.map(
    (run) =>
      `${run.id}（${run.rounds.map((round) => round.lot.values.sessionName.slice(0, 6)).join(' / ')}）`,
  );
  const perOrder = data.runs[0].orders.map(
    (order) => `${order.label} 最优 ${order.best} / 稳健 ${order.steady} / 字面 ${order.literal} / 逢旁证就收 ${order.eager}`,
  );
  const overlap = data.stats.deckOverlap
    .map((item) => `${item.a}-${item.b} 同写法 ${item.shared}/20（连答案也同 ${item.sameAnswer}）`)
    .join('；');
  process.stdout.write(
    `写入 ${path.relative(PACKAGE_ROOT, OUTPUT_PATH)}：${perRun.join('，')}；` +
      `每局六态 ${JSON.stringify(data.stats.byState)}；` +
      `牌序 ${perOrder.join('；')}；重样 ${overlap}\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
