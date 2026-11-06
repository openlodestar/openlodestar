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
}

export interface SortScoring {
  hitBase: number;
  accept: Record<EvidenceDimensionState, number>;
  reject: Record<EvidenceDimensionState, number>;
  /** 收下后连击怎么走：+1 / freeze / reset */
  acceptCombo: Record<EvidenceDimensionState, 'up' | 'freeze' | 'reset'>;
  acceptLife: Record<EvidenceDimensionState, number>;
  multiplier: { per: number; step: number; cap: number };
  lives: number;
  timeoutCombo: 'reset';
  timeoutPoints: 0;
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

export interface SortData {
  generatedAt: string;
  generator: string;
  note: string;
  states: Record<EvidenceDimensionState, SortStateMeta>;
  scoring: SortScoring;
  grades: Array<{ grade: 'S' | 'A' | 'B' | 'C'; min: number; label: string }>;
  perfectScore: number;
  rounds: SortRound[];
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
 * 两轮、每轮十条，顺序是排好的教学弧线：
 *
 * 第一条一定是「完全对上」——玩家的第一次上甩就命中，不用读任何说明就知道往上是对的；
 * 第二条是「没对上」——往下甩也对，两个动作各自被确认一次；
 * 之后才依次塞进相容、冲突、边缘、无从判断。
 *
 * 第二轮换一件器物、换一个日期精度（11 月 15 日而不是 12 月 5 日），
 * 于是同一条「2021年秋季」从「边缘相容」变成「口径相容」——
 * 同一个写法、不同的断言精度，判据就不同，这是第二轮真正要玩家感到的东西。
 */
const ROUND_PLAN: Array<{
  lotId: string;
  beats: Array<{ slot: SlotKey; state: EvidenceDimensionState }>;
}> = [
  {
    lotId: 'g-01',
    beats: [
      { slot: 'auctionHouse', state: 'exact' },
      { slot: 'sessionName', state: 'mismatch' },
      { slot: 'dateText', state: 'exact' },
      { slot: 'dateText', state: 'caliber' },
      { slot: 'auctionHouse', state: 'conflict' },
      { slot: 'sessionName', state: 'exact' },
      { slot: 'dateText', state: 'edge' },
      { slot: 'dateText', state: 'unknown' },
      { slot: 'auctionHouse', state: 'caliber' },
      { slot: 'auctionHouse', state: 'mismatch' },
    ],
  },
  {
    lotId: 'g-07',
    beats: [
      { slot: 'dateText', state: 'exact' },
      { slot: 'auctionHouse', state: 'caliber' },
      { slot: 'sessionName', state: 'mismatch' },
      { slot: 'dateText', state: 'caliber' },
      { slot: 'auctionHouse', state: 'exact' },
      { slot: 'dateText', state: 'conflict' },
      { slot: 'auctionHouse', state: 'conflict' },
      { slot: 'sessionName', state: 'exact' },
      { slot: 'dateText', state: 'unknown' },
      { slot: 'auctionHouse', state: 'mismatch' },
    ],
  },
];

/** 分值表：与页面读到的 `scoring` 是同一份，测试会逐项核对 */
const SCORING: SortScoring = {
  hitBase: 10,
  accept: { exact: 0, caliber: 3, edge: 1, conflict: 0, mismatch: 0, unknown: 0 },
  reject: { exact: 0, caliber: 2, edge: 2, conflict: 2, mismatch: 2, unknown: 1 },
  acceptCombo: {
    exact: 'up',
    caliber: 'freeze',
    edge: 'freeze',
    conflict: 'reset',
    mismatch: 'reset',
    unknown: 'freeze',
  },
  acceptLife: { exact: 0, caliber: 0, edge: 0, conflict: -1, mismatch: -1, unknown: 0 },
  multiplier: { per: 3, step: 0.5, cap: 3 },
  lives: 3,
  timeoutCombo: 'reset',
  timeoutPoints: 0,
  note:
    '命中＝10×倍率；倍率＝1+⌊连击÷3⌋×0.5，最高×3。' +
    '放走不算错，但只拿小分；收下相容证据会冻住连击，收下冲突/没对上掉一颗心。',
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
  const chips: SortChip[] = plan.beats.map((beat, beatIndex) => {
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
  };
}

/** 倍率只跟连击数有关，页面与这里必须是同一条公式 */
function multiplierOf(combo: number): number {
  const { per, step, cap } = SCORING.multiplier;
  return Math.min(cap, 1 + Math.floor(combo / per) * step);
}

/**
 * 满分局：完全对上的收下、其余的放走。
 * 分数线按它折算，玩家能自己算出来为什么差了几分——不是拍脑袋定的目标分。
 */
function perfectScoreOf(rounds: SortRound[]): number {
  let score = 0;
  let combo = 0;
  for (const round of rounds) {
    for (const chip of round.chips) {
      if (chip.state === 'exact') {
        score += Math.round(SCORING.hitBase * multiplierOf(combo));
        combo += 1;
      } else {
        score += SCORING.reject[chip.state];
        combo += 1;
      }
    }
  }
  return score;
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

  const perfectScore = perfectScoreOf(rounds);

  return {
    generatedAt: new Date().toISOString(),
    generator: 'src/demo-page/build-sort-data.ts',
    note:
      '由冻结矩阵 docs/assets/demo-game-data.js 生成，不要手改。' +
      '每条证据的状态是构建时用引擎的维度函数算出来的，页面只查表。',
    states: STATES,
    scoring: SCORING,
    grades: [
      { grade: 'S', min: Math.round(perfectScore * 0.9), label: '每条都判对了' },
      { grade: 'A', min: Math.round(perfectScore * 0.7), label: '只放过了几条相容证据' },
      { grade: 'B', min: Math.round(perfectScore * 0.45), label: '把相容当成了支撑' },
      { grade: 'C', min: 0, label: '还没分出相容与对上' },
    ],
    perfectScore,
    rounds,
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
  process.stdout.write(
    `写入 ${path.relative(PACKAGE_ROOT, OUTPUT_PATH)}：${perRound.join('，')}；` +
      `六态 ${JSON.stringify(data.stats.byState)}；满分局 ${data.perfectScore}\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
