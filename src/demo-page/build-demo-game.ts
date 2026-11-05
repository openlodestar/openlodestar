// src/demo-page/build-demo-game.ts
/**
 * 把"一句话里的槽位组合"冻结成站点用的 `docs/assets/demo-game-data.js`
 * （`window.LODESTAR_DEMO_GAME = {...}`）。
 *
 * 小游戏的玩法是让观众改一句话里的词，再问"这批证据认不认"。页面只做切换，不重算任何判定——
 * 组合矩阵在构建时算好，用的是引擎自己那套维度纯函数（与门禁同一份实现）：
 *
 * 1. 每个槽位先定一个"证据里到底写的什么"（reference）：优先取该记录「支持」行里最强的原文值，
 *    没有支持行再退到反对行、无关行，最后才用断言本身。玩家改的词与这个原文值逐维比对；
 * 2. 每条组合在全部冻结记录里挑一条贴合度最高的（逐维状态折算分相加），
 *    至少两个槽位达到「口径相容」及以上才算这批证据覆盖了这句话；
 * 3. 组合级结论取三个槽位里**最差**的那一维：只要有一维只到口径相容，就不能写成"对上"；
 *    有一维冲突就先否决；有一维没对上就是"证据写的是别的"；解析不出来就是无从判断；
 * 4. 裁决、共现、坐标仍从引擎的冻结记录里原样带过，逐条证据与引文留在 `demo-data.js`，
 *    页面按记录号引用，不复制两份。
 *
 * 候选词里有一小部分是**演示用词**（冻结数据里没有这种写法，但没有它就走不到「口径相容」
 * 「无从判断」这两条路）。它们必须在数据里带 `demoOnly: true`，页面要显式标出来，
 * 不许让观众误以为都是采集来的。
 *
 * 唯一真源是 `examples/<批次>/`；本脚本只读它、只写生成物，中间产物不进版本库。
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import {
  buildCase,
  listExampleNames,
  type DemoCaseData,
  type DemoData,
  type DemoRecord,
} from './build-demo-data';
import { compareInstitutionDimension } from '../lodestar/dimensions/institution';
import { compareTimeDimension } from '../lodestar/dimensions/time';
import { compareTextDimension } from '../lodestar/dimensions/text';
import type { EvidenceDimensionState } from '../lodestar/types';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(MODULE_DIR, '../..');
const DOCS_ASSETS = path.join(PACKAGE_ROOT, 'docs', 'assets');
const DEMO_DATA_PATH = path.join(DOCS_ASSETS, 'demo-data.js');
const OUTPUT_PATH = path.join(DOCS_ASSETS, 'demo-game-data.js');

/** 组合总数上限：再多就会让"逐条核对"变成一份没人读的清单 */
const MAX_COMBOS = 100;

export type GameSlotKey = 'auctionHouse' | 'dateText' | 'sessionName';

export type GameConclusionCode =
  | 'strong'
  | 'weak'
  | 'caliber'
  | 'edge'
  | 'conflict'
  | 'mismatch'
  | 'unknown'
  | 'uncovered';

export interface GameSlotOption {
  value: string;
  /** true = 演示用词：冻结数据里没有这种写法，页面上必须标出来 */
  demoOnly: boolean;
  /** 为什么放这个词（给页面做小字说明） */
  note: string;
}

export interface GameSlot {
  key: GameSlotKey;
  label: string;
  options: GameSlotOption[];
}

const SLOT_LABELS: Record<GameSlotKey, string> = {
  auctionHouse: '拍卖机构',
  dateText: '举办时间',
  sessionName: '专场名',
};

/**
 * 候选词分两类：
 * - 冻结记录里真实出现过的值（`demoOnly: false`）；
 * - 演示用词（`demoOnly: true`）——用户明确允许"编造一些证据以外的词，这也是演示的一部分"，
 *   但没有它们就走不到「口径相容」「无从判断」这两条路。数值本身是合理的同义/含糊写法。
 */
const HOUSE_OPTIONS: GameSlotOption[] = [
  { value: '北京保利', demoOnly: false, note: '冻结记录里的写法' },
  { value: '中国嘉德国际拍卖有限公司', demoOnly: false, note: '冻结记录里的写法' },
  { value: '保利香港拍賣', demoOnly: false, note: '冻结记录里的写法' },
  {
    value: '保利拍卖',
    demoOnly: true,
    note: '演示用词：底稿里没有这个写法，用来演示「同一家，只是少写了城市」',
  },
];

const DATE_OPTIONS: GameSlotOption[] = [
  { value: '2021年12月5日', demoOnly: false, note: '冻结记录里的写法' },
  { value: '2021年11月15日', demoOnly: false, note: '冻结记录里的写法' },
  { value: '2021年秋季', demoOnly: false, note: '冻结记录里的写法' },
  {
    value: '2021年8月',
    demoOnly: true,
    note: '演示用词：底稿里没有这个日期写法，用来演示「同一场、写法不同」与「冲突候选」的分界',
  },
  {
    value: '去年秋天',
    demoOnly: true,
    note: '演示用词：含糊说法，用来演示「无从判断」',
  },
];

const SESSION_OPTIONS: GameSlotOption[] = [
  { value: '禹贡Ⅰ—盛清御瓷新风尚', demoOnly: false, note: '冻结记录里的写法' },
  {
    value: '禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术',
    demoOnly: false,
    note: '冻结记录里的写法',
  },
  { value: '禹贡Ⅲ—盛清御瓷新风尚', demoOnly: false, note: '冻结记录里的写法' },
  { value: '宸赏—明清御瓷珍玩', demoOnly: false, note: '冻结记录里的写法' },
  { value: '中國古董珍玩專場', demoOnly: false, note: '冻结记录里的写法' },
];

export interface GameDimensionView {
  slot: GameSlotKey;
  label: string;
  /** 玩家写下的词 */
  value: string;
  /** 这批证据里逐字摘到的原文值；取不到就是 null */
  evidenceValue: string | null;
  state: EvidenceDimensionState;
  note: string;
  demoOnly: boolean;
}

export interface GameConclusion {
  code: GameConclusionCode;
  label: string;
  hint: string;
  /** 三个维度折算分之和（只用于排序与说明，不是门禁） */
  score: number;
  /** 一句可读的依据 */
  basis: string;
}

export interface GameMatchedRecord {
  recordId: string;
  caseId: string;
  bucket: 'strong' | 'weak' | 'refuted' | 'not_found';
  score: number;
}

export interface GameCombo {
  id: string;
  /** 三个槽位取值的键，页面按它查表（不靠字符串拼句子） */
  key: string;
  values: Record<GameSlotKey, string>;
  sentence: string;
  status: 'covered' | 'uncovered';
  /** 覆盖时指向 demo-data.js 里的记录；没覆盖为 null */
  recordId: string | null;
  caseId: string | null;
  recordTitle: string | null;
  gate: 'strong' | 'weak' | 'rejected' | null;
  bucket: 'strong' | 'weak' | 'refuted' | 'not_found' | null;
  dimensions: GameDimensionView[];
  conclusion: GameConclusion;
  /** 其余也沾边的记录（按贴合度排），页面据此说明"最接近的还有哪几条" */
  matched: GameMatchedRecord[];
}

export interface GameStats {
  total: number;
  covered: number;
  uncovered: number;
  byConclusion: Record<GameConclusionCode, number>;
  maxCombos: number;
}

export interface GameData {
  generatedAt: string;
  generator: string;
  note: string;
  slots: GameSlot[];
  combos: GameCombo[];
  stats: GameStats;
}

const CONCLUSION_LABELS: Record<GameConclusionCode, string> = {
  strong: '强坐标',
  weak: '弱坐标',
  caliber: '只找到相容证据',
  edge: '没有矛盾，但这不能证明',
  conflict: '冲突候选',
  mismatch: '没对上，证据写的是别的',
  unknown: '无从判断',
  uncovered: '这批证据没覆盖',
};

const CONCLUSION_HINTS: Record<GameConclusionCode, string> = {
  strong: '三个词都能在证据里找到同一写法，且撑起这条记录的独立来源够用',
  weak: '三个词都对上了，但撑起这条记录的独立来源不够，只到弱坐标',
  caliber:
    '有证据，但至少一维最多只到「说法不同」——很可能是同一场，只是写法不一样，这不能算对上',
  edge: '有证据，但至少一维只到「没有矛盾，但这不能证明」，撑不起结论',
  conflict: '至少一维的原文值与你的说法冲突；冲突只作候选，不压成「反对」',
  mismatch: '至少一维的证据明确写的是另一个值',
  unknown: '至少一维的说法解析不出来，判不了',
  uncovered: '没有任何一条冻结记录同时在两个词上对上或相容',
};

const STATE_SCORE: Record<EvidenceDimensionState, number> = {
  exact: 3,
  caliber: 2,
  edge: 1,
  unknown: 0,
  mismatch: -1,
  conflict: -2,
};

/** 从差到好：结论取最差的那一维 */
const STATE_SEVERITY: EvidenceDimensionState[] = [
  'conflict',
  'mismatch',
  'unknown',
  'edge',
  'caliber',
  'exact',
];

const SLOT_KEYS: GameSlotKey[] = ['auctionHouse', 'dateText', 'sessionName'];

const GATE_RANK: Record<'strong' | 'weak' | 'rejected', number> = {
  strong: 0,
  weak: 1,
  rejected: 2,
};

function comboKeyOf(values: Record<GameSlotKey, string>): string {
  return SLOT_KEYS.map((key) => values[key]).join('\u0000');
}

function sentenceOf(values: Record<GameSlotKey, string>): string {
  return `${values.auctionHouse} 在 ${values.dateText} 举办了一场名为「${values.sessionName}」的拍卖会。`;
}

function allRecords(cases: DemoCaseData[]): DemoRecord[] {
  return cases.flatMap((item) => item.records);
}

function slotsOf(): GameSlot[] {
  return [
    { key: 'auctionHouse', label: SLOT_LABELS.auctionHouse, options: HOUSE_OPTIONS },
    { key: 'dateText', label: SLOT_LABELS.dateText, options: DATE_OPTIONS },
    { key: 'sessionName', label: SLOT_LABELS.sessionName, options: SESSION_OPTIONS },
  ];
}

/** 这一维用哪份实现比对：与门禁读的是同一套维度函数 */
function compareSlot(
  slot: GameSlotKey,
  claimValue: string,
  evidenceValue: string,
): { state: EvidenceDimensionState; note: string } {
  if (slot === 'auctionHouse') return compareInstitutionDimension(claimValue, evidenceValue);
  if (slot === 'dateText') return compareTimeDimension(claimValue, evidenceValue);
  return compareTextDimension(claimValue, evidenceValue);
}

/**
 * 这条记录在这个字段上"证据到底写的是什么"。
 *
 * 先看「支持」行（模型说这页在支持这条断言），再看「反对」行，最后才用「不涉及」的行；
 * 同一类里取状态最强的那个原文值。全都取不到原文值时才退回断言自己的写法——
 * 退回断言是最后一步，否则「证据从没写过这个专场名」会被当成写过了。
 */
function referenceOf(record: DemoRecord, fieldKey: string): string | null {
  const rows = record.evidence.filter((row) => row.fieldKey === fieldKey);
  for (const relation of ['supports', 'refutes', 'irrelevant'] as const) {
    const bucket = rows.filter((row) => row.relation === relation && row.matchedValue);
    if (bucket.length === 0) continue;
    const best = bucket.slice().sort((a, b) => STATE_SCORE[b.state] - STATE_SCORE[a.state])[0];
    if (best && best.matchedValue) return best.matchedValue;
  }
  const claim = record.fields.find((field) => field.key === fieldKey);
  return claim ? claim.value : null;
}

interface Evaluation {
  record: DemoRecord;
  caseId: string;
  caseOrder: number;
  dimensions: GameDimensionView[];
  score: number;
  positiveCount: number;
}

function evaluate(
  record: DemoRecord,
  caseId: string,
  caseOrder: number,
  values: Record<GameSlotKey, string>,
  demoOnlyBySlot: Record<GameSlotKey, Set<string>>,
): Evaluation {
  const dimensions: GameDimensionView[] = SLOT_KEYS.map((slot) => {
    const reference = referenceOf(record, slot);
    const compared =
      reference === null
        ? { state: 'unknown' as EvidenceDimensionState, note: '这批证据里没有可比的原文值' }
        : compareSlot(slot, values[slot], reference);
    return {
      slot,
      label: SLOT_LABELS[slot],
      value: values[slot],
      evidenceValue: reference,
      state: compared.state,
      note: compared.note,
      demoOnly: demoOnlyBySlot[slot].has(values[slot]),
    };
  });
  const score = dimensions.reduce((sum, dimension) => sum + STATE_SCORE[dimension.state], 0);
  const positiveCount = dimensions.filter(
    (dimension) => dimension.state === 'exact' || dimension.state === 'caliber' || dimension.state === 'edge',
  ).length;
  return { record, caseId, caseOrder, dimensions, score, positiveCount };
}

function conclusionOf(
  evaluation: Evaluation,
): GameConclusion {
  const worst =
    STATE_SEVERITY.find((state) =>
      evaluation.dimensions.some((dimension) => dimension.state === state),
    ) ?? 'unknown';
  const record = evaluation.record;
  const exact = worst === 'exact';
  const code: GameConclusionCode = exact
    ? record.computation.gate === 'strong'
      ? 'strong'
      : 'weak'
    : worst;
  const dimensionSummary = evaluation.dimensions
    .map((dimension) => `${dimension.label}：${dimension.state}`)
    .join(' · ');
  return {
    code,
    label: CONCLUSION_LABELS[code],
    hint: CONCLUSION_HINTS[code],
    score: evaluation.score,
    basis: dimensionSummary,
  };
}

/** 至少两个槽位达到「口径相容」及以上，才算这批证据覆盖了这句话 */
function covered(evaluation: Evaluation): boolean {
  return evaluation.positiveCount >= 2;
}

function sortEvaluations(items: Evaluation[]): Evaluation[] {
  return items.slice().sort(
    (a, b) =>
      b.score - a.score ||
      b.positiveCount - a.positiveCount ||
      GATE_RANK[a.record.computation.gate] - GATE_RANK[b.record.computation.gate] ||
      a.caseOrder - b.caseOrder ||
      a.record.recordId.localeCompare(b.record.recordId),
  );
}

function allCombos(slots: GameSlot[]): Array<Record<GameSlotKey, string>> {
  const values: Array<Record<GameSlotKey, string>> = [];
  for (const house of slots[0].options) {
    for (const date of slots[1].options) {
      for (const session of slots[2].options) {
        values.push({ auctionHouse: house.value, dateText: date.value, sessionName: session.value });
      }
    }
  }
  return values;
}

/** 读回页面现有的融合数据，核对组合矩阵指向的记录确实还在 */
async function verifyAgainstDemoData(data: GameData): Promise<void> {
  let demo: DemoData;
  try {
    const code = await fs.readFile(DEMO_DATA_PATH, 'utf8');
    const sandbox: { window: { LODESTAR_DEMO?: DemoData } } = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: 'demo-data.js' });
    if (!sandbox.window.LODESTAR_DEMO) throw new Error('window.LODESTAR_DEMO 不存在');
    demo = sandbox.window.LODESTAR_DEMO;
  } catch (error) {
    throw new Error(
      `读不到 ${path.relative(PACKAGE_ROOT, DEMO_DATA_PATH)}（${
        error instanceof Error ? error.message : String(error)
      }）；请先跑 pnpm run demo:data`,
    );
  }

  const records = new Map(
    demo.cases.flatMap((item) => item.records.map((record) => [record.recordId, record] as const)),
  );
  const problems: string[] = [];
  for (const combo of data.combos) {
    if (combo.recordId === null) continue;
    const record = records.get(combo.recordId);
    if (!record) {
      problems.push(`组合 ${combo.id} 指向的 ${combo.recordId} 不在 demo-data.js 里`);
      continue;
    }
    if (combo.bucket !== record.bucket) {
      problems.push(`组合 ${combo.id} 的档位与 ${combo.recordId} 的冻结数据不一致`);
    }
    if (combo.gate !== record.computation.gate) {
      problems.push(`组合 ${combo.id} 的门禁与 ${combo.recordId} 的冻结数据不一致`);
    }
    if (combo.recordTitle !== record.title) {
      problems.push(`组合 ${combo.id} 的记录标题与 ${combo.recordId} 不一致`);
    }
  }
  if (problems.length > 0) {
    throw new Error(`组合矩阵与 demo-data.js 不一致，请重跑 pnpm run demo:data：\n- ${problems.join('\n- ')}`);
  }
}

async function main(): Promise<void> {
  const cases: DemoCaseData[] = [];
  for (const name of await listExampleNames()) {
    try {
      await fs.access(path.join(PACKAGE_ROOT, 'examples', name, 'claims.jsonl'));
    } catch {
      console.warn(`skip ${name}: no claims.jsonl`);
      continue;
    }
    cases.push(await buildCase(name));
  }

  const records = allRecords(cases);
  const slots = slotsOf();
  const combosInOrder = allCombos(slots);
  if (combosInOrder.length > MAX_COMBOS) {
    throw new Error(`组合总数 ${combosInOrder.length} 超过上限 ${MAX_COMBOS}，请减少每槽选项`);
  }

  const slotByKey = new Map(slots.map((slot) => [slot.key, slot]));
  const demoOnlyBySlot = {} as Record<GameSlotKey, Set<string>>;
  for (const key of SLOT_KEYS) {
    const options = slotByKey.get(key)?.options ?? [];
    if (options.length < 2) {
      throw new Error(`槽位「${SLOT_LABELS[key]}」只有 ${options.length} 个候选，至少要 2 个`);
    }
    demoOnlyBySlot[key] = new Set(options.filter((option) => option.demoOnly).map((option) => option.value));
  }

  const caseOrderByName = new Map(cases.map((item, index) => [item.id, index]));
  const combos: GameCombo[] = [];
  for (const [index, values] of combosInOrder.entries()) {
    const evaluations = records
      .filter((record) =>
        SLOT_KEYS.every((key) => record.fields.some((field) => field.key === key)),
      )
      .map((record) =>
        evaluate(
          record,
          record.caseId,
          caseOrderByName.get(record.caseId) ?? 0,
          values,
          demoOnlyBySlot,
        ),
      );
    const ranked = sortEvaluations(evaluations);
    const best = ranked[0];
    const conclusion = best ? conclusionOf(best) : null;
    const isCovered = best !== undefined && covered(best);
    combos.push({
      id: `g-${String(index + 1).padStart(2, '0')}`,
      key: comboKeyOf(values),
      values,
      sentence: sentenceOf(values),
      status: isCovered ? 'covered' : 'uncovered',
      recordId: isCovered && best ? best.record.recordId : null,
      caseId: isCovered && best ? best.caseId : null,
      recordTitle: isCovered && best ? best.record.title : null,
      gate: isCovered && best ? best.record.computation.gate : null,
      bucket: isCovered && best ? best.record.bucket : null,
      dimensions: best ? best.dimensions : [],
      conclusion: isCovered && conclusion
        ? conclusion
        : {
            code: 'uncovered',
            label: CONCLUSION_LABELS.uncovered,
            hint: CONCLUSION_HINTS.uncovered,
            score: best ? best.score : 0,
            basis: best ? conclusionOf(best).basis : '',
          },
      matched: ranked.slice(0, 3).map((item) => ({
        recordId: item.record.recordId,
        caseId: item.caseId,
        bucket: item.record.bucket,
        score: item.score,
      })),
    });
  }

  const byConclusion = Object.fromEntries(
    (
      ['strong', 'weak', 'caliber', 'edge', 'conflict', 'mismatch', 'unknown', 'uncovered'] as GameConclusionCode[]
    ).map((code) => [code, 0]),
  ) as Record<GameConclusionCode, number>;
  for (const combo of combos) byConclusion[combo.conclusion.code] += 1;

  const stats: GameStats = {
    total: combos.length,
    covered: combos.filter((combo) => combo.status === 'covered').length,
    uncovered: combos.filter((combo) => combo.status === 'uncovered').length,
    byConclusion,
    maxCombos: MAX_COMBOS,
  };

  // 八种结论各至少要有一组，小游戏才凑得齐"六种判据状态 + 强/弱 + 没覆盖"；
  // 缺了就直接停下来，不擅自放宽候选或伪造组合。
  const missing = (Object.keys(byConclusion) as GameConclusionCode[]).filter(
    (code) => byConclusion[code] === 0,
  );
  if (missing.length > 0) {
    throw new Error(
      `这些结论一组组合都走不到：${missing.join('、')}。` +
        '请检查候选词是否够用（缺口径相容就补一个同义/粗写词，缺无从判断就补一个含糊说法），' +
        '不要为了凑数把不可比的值硬塞进来。',
    );
  }

  const data: GameData = {
    generatedAt: new Date().toISOString(),
    generator: 'src/demo-page/build-demo-game.ts',
    note:
      '组合矩阵在构建时用引擎的维度函数算好：每个词与冻结证据里的原文值逐维比对，' +
      '结论取最差的那一维；至少两个词达到「口径相容」及以上才算覆盖。' +
      '标了 demoOnly 的候选是演示用词，不在冻结底稿里出现过，页面必须标出来。',
    slots,
    combos,
    stats,
  };

  await verifyAgainstDemoData(data);

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(
    OUTPUT_PATH,
    `// 由 ${data.generator} 从 examples/ 与 demo-data.js 生成，不要手改；改候选词或批次后重跑 pnpm run demo:game。\n` +
      '// 每条组合只冻结"逐维比对结果 + 组合级结论 + 指向哪条冻结记录"；逐条证据、引文与快照在 demo-data.js。\n' +
      `window.LODESTAR_DEMO_GAME = ${JSON.stringify(data, null, 2)};\n`,
    'utf8',
  );

  const bytes = (await fs.stat(OUTPUT_PATH)).size;
  console.log(`\nWrote ${path.relative(PACKAGE_ROOT, OUTPUT_PATH)} (${(bytes / 1024).toFixed(1)} KB)`);
  console.log(
    `Slot candidates: ${slots
      .map((slot) => `${slot.key}=${slot.options.length}（演示用词 ${slot.options.filter((o) => o.demoOnly).length}）`)
      .join(' ')}`,
  );
  console.log(
    `Combos: total=${stats.total} covered=${stats.covered} uncovered=${stats.uncovered}\n` +
      (Object.keys(byConclusion) as GameConclusionCode[])
        .map((code) => `${code}=${byConclusion[code]}`)
        .join(' '),
  );
}

main().catch((error) => {
  console.error('Failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
