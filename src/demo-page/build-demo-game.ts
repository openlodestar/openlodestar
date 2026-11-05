// src/demo-page/build-demo-game.ts
/**
 * 把"一句话里的槽位组合"冻结成站点用的 `docs/assets/demo-game-data.js`
 * （`window.LODESTAR_DEMO_GAME = {...}`）。
 *
 * 小游戏的玩法是让观众改一句话里的四个词，再问"这批证据认不认"。页面只做切换，
 * 不重算任何判定——组合矩阵在构建时算好：
 *
 * 1. 槽位与选项**只从冻结批次里真实出现过的值里取**（构建时逐个核对，取不到就失败）；
 * 2. 每条组合先拿四个值去冻结记录里**精确匹配**（机构 + 时间 + 专场主名 + 副题）；
 *    匹配不到就是"这批证据没覆盖"，不继承任何旧证据，也不判成被拒收；
 * 3. 匹配到多条记录时按门禁优先级（强 > 弱 > 拒收）选一条展示，并把其余记录号一并冻结，
 *    让页面能写清"同一组取值另有几条记录"；
 * 4. 裁决、共现、坐标从引擎的冻结记录里原样带过（同一份 `buildCase` 产出），
 *    逐条证据与引文留在 `demo-data.js`，页面按记录号引用，不复制两份。
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

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(MODULE_DIR, '../..');
const DOCS_ASSETS = path.join(PACKAGE_ROOT, 'docs', 'assets');
const DEMO_DATA_PATH = path.join(DOCS_ASSETS, 'demo-data.js');
const OUTPUT_PATH = path.join(DOCS_ASSETS, 'demo-game-data.js');

/** 冻结记录里专场名的主名与副题之间的分隔符（U+2014） */
const SESSION_SEPARATOR = '—';

/** 组合总数上限：再多就会让"逐条核对"变成一份没人读的清单 */
const MAX_COMBOS = 100;

export type GameSlotKey = 'auctionHouse' | 'dateText' | 'sessionPrefix' | 'sessionSubtitle';

export interface GameSlot {
  key: GameSlotKey;
  label: string;
  options: string[];
}

/** 时间槽的候选：冻结数据里出现过的日期写法（顺序固定，组合编号稳定） */
const DATE_OPTIONS = ['2021年12月5日', '2021年11月15日', '2021年秋季', '2021年12月'];

/** 槽位名固定；候选值在构建时从真实三元组里算出来，不在这里手写 */
const SLOT_LABELS: Record<GameSlotKey, string> = {
  auctionHouse: '拍卖机构',
  dateText: '举办时间',
  sessionPrefix: '专场主名',
  sessionSubtitle: '专场副题',
};

/** 机构 + 专场主名 + 副题的真实共现（时间不参与：它是玩家要换的那个变量） */
export interface GameTriple {
  auctionHouse: string;
  sessionPrefix: string;
  sessionSubtitle: string;
}

function tripleKeyOf(triple: GameTriple): string {
  return [triple.auctionHouse, triple.sessionPrefix, triple.sessionSubtitle].join('\u0000');
}

export interface GameFieldVerdict {
  fieldValue: string;
  verdict: string;
  evidenceGrade: string;
  supportCount: number;
  refuteCount: number;
  notFoundCause: string | null;
  examinedPages: number;
}

export interface GameComputation {
  gate: 'strong' | 'weak' | 'rejected';
  bucket: 'strong' | 'weak' | 'refuted' | 'not_found';
  keyFieldValues: Record<string, string>;
  fieldVerdicts: Record<string, GameFieldVerdict>;
  cooccurrence: { count: number; pages: string[] };
  anchor: {
    grade: 'strong' | 'weak';
    evidenceGrade: string;
    urls: string[];
    searchPhrases: string[];
    stale: boolean;
  } | null;
  /** 这条记录在冻结证据里有多少行（逐条引文在 demo-data.js） */
  evidenceCount: number;
}

export interface GameMatchedRecord {
  recordId: string;
  caseId: string;
  gate: 'strong' | 'weak' | 'rejected';
  bucket: 'strong' | 'weak' | 'refuted' | 'not_found';
}

export interface GameCombo {
  id: string;
  /** 四个槽位取值的精确键，页面按它查表（不靠字符串拼句子） */
  key: string;
  values: Record<GameSlotKey, string>;
  sentence: string;
  status: 'covered' | 'uncovered';
  /** 覆盖时就指向 demo-data.js 里的记录；没覆盖为 null */
  recordId: string | null;
  caseId: string | null;
  /** 同一组取值命中的全部冻结记录（按门禁优先级排），页面据此说明"另有几条" */
  matched: GameMatchedRecord[];
  computation: GameComputation | null;
}

export interface GameStats {
  total: number;
  covered: number;
  uncovered: number;
  byStatus: { strong: number; weak: number; refuted: number; not_found: number };
  maxCombos: number;
}

export interface GameData {
  generatedAt: string;
  generator: string;
  note: string;
  slots: GameSlot[];
  /** 机构 + 专场主名 + 副题在冻结数据里真实出现过的三元组；换词时候选必须落在这张表里 */
  triples: GameTriple[];
  combos: GameCombo[];
  stats: GameStats;
}

interface Triple {
  auctionHouse: string;
  dateText: string;
  sessionPrefix: string;
  sessionSubtitle: string;
}

interface Candidate {
  record: DemoRecord;
  caseId: string;
  caseOrder: number;
}

const GATE_RANK: Record<'strong' | 'weak' | 'rejected', number> = {
  strong: 0,
  weak: 1,
  rejected: 2,
};

function comboKeyOf(values: Triple): string {
  return [
    values.auctionHouse,
    values.dateText,
    values.sessionPrefix,
    values.sessionSubtitle,
  ].join('\u0000');
}

/** 记录的关键字段 → 四个槽位的取值；专场名拆不开（没有分隔符）就返回 null */
function tripleOf(record: DemoRecord): Triple | null {
  const byKey = new Map(record.fields.map((field) => [field.key, field.value]));
  const house = byKey.get('auctionHouse') ?? '';
  const date = byKey.get('dateText') ?? '';
  const session = byKey.get('sessionName') ?? '';
  const at = session.indexOf(SESSION_SEPARATOR);
  if (house === '' || date === '' || at <= 0 || at + SESSION_SEPARATOR.length >= session.length) {
    return null;
  }
  return {
    auctionHouse: house,
    dateText: date,
    sessionPrefix: session.slice(0, at),
    sessionSubtitle: session.slice(at + SESSION_SEPARATOR.length),
  };
}

function sentenceOf(values: Triple): string {
  return (
    `${values.auctionHouse} 在 ${values.dateText} 举办了一场名为` +
    `「${values.sessionPrefix}${SESSION_SEPARATOR}${values.sessionSubtitle}」的拍卖会。`
  );
}

function allRecords(cases: DemoCaseData[]): DemoRecord[] {
  return cases.flatMap((item) => item.records);
}

/**
 * 从冻结记录里收「机构 + 主名 + 副题」的真实三元组。
 *
 * 只保留至少有一个时间候选能对上记录的：否则这个三元组生成的所有组合永远是「没覆盖」，
 * 换词规则下也走不到它——例如嘉德的「宸赏—明清御瓷珍玩」举办于 2021年11月26日至12月13日，
 * 四个时间候选一个都不沾，这种凑不出结论的三元组按"凑不出来就减候选"直接减掉。
 */
function collectTriples(records: DemoRecord[], dates: string[]): GameTriple[] {
  const dateSet = new Set(dates);
  const seen = new Map<string, { triple: GameTriple; covered: boolean }>();
  for (const record of records) {
    const four = tripleOf(record);
    if (four === null) continue;
    const triple: GameTriple = {
      auctionHouse: four.auctionHouse,
      sessionPrefix: four.sessionPrefix,
      sessionSubtitle: four.sessionSubtitle,
    };
    const key = tripleKeyOf(triple);
    const entry = seen.get(key) ?? { triple, covered: false };
    if (dateSet.has(four.dateText)) entry.covered = true;
    seen.set(key, entry);
  }
  return [...seen.values()].filter((entry) => entry.covered).map((entry) => entry.triple);
}

/** 槽位 = 名称 + 候选；机构/主名/副题的候选只取真实三元组里出现过的值，时间是固定候选 */
function slotsOf(triples: GameTriple[], dates: string[]): GameSlot[] {
  return (['auctionHouse', 'dateText', 'sessionPrefix', 'sessionSubtitle'] as const).map((key) => ({
    key,
    label: SLOT_LABELS[key],
    options:
      key === 'dateText'
        ? dates.slice()
        : [...new Set(triples.map((triple) => triple[key]))],
  }));
}

/** 选项必须真的在冻结数据里出现过：宁可构建失败，也不许造一个好看的值 */
function assertOptionsFromFrozen(records: DemoRecord[], triples: GameTriple[], slots: GameSlot[]): void {
  const recordTriples = records.map(tripleOf).filter((triple): triple is Triple => triple !== null);
  const seen: Record<GameSlotKey, Set<string>> = {
    auctionHouse: new Set(triples.map((triple) => triple.auctionHouse)),
    dateText: new Set(recordTriples.map((triple) => triple.dateText)),
    sessionPrefix: new Set(triples.map((triple) => triple.sessionPrefix)),
    sessionSubtitle: new Set(triples.map((triple) => triple.sessionSubtitle)),
  };
  for (const slot of slots) {
    if (slot.options.length < 1 || slot.options.length > 4) {
      throw new Error(`槽位「${slot.label}」有 ${slot.options.length} 个候选，应控制在 1–4 个`);
    }
    for (const option of slot.options) {
      if (!seen[slot.key].has(option)) {
        throw new Error(`槽位「${slot.label}」的候选「${option}」没有在冻结数据里出现过`);
      }
    }
  }
}

/** 组合 = 每个真实三元组 × 每个时间候选（三元组之间不交叉拼接，顺序固定） */
function combosOf(triples: GameTriple[], dates: string[]): Triple[] {
  const combos: Triple[] = [];
  for (const triple of triples) {
    for (const dateText of dates) {
      combos.push({
        auctionHouse: triple.auctionHouse,
        dateText,
        sessionPrefix: triple.sessionPrefix,
        sessionSubtitle: triple.sessionSubtitle,
      });
    }
  }
  return combos;
}

function pickCandidate(candidates: Candidate[]): Candidate {
  const sorted = [...candidates].sort(
    (a, b) =>
      GATE_RANK[a.record.computation.gate] - GATE_RANK[b.record.computation.gate] ||
      a.caseOrder - b.caseOrder ||
      a.record.recordId.localeCompare(b.record.recordId),
  );
  const first = sorted[0];
  if (!first) throw new Error('覆盖组合没有任何候选记录');
  return first;
}

function computationOf(record: DemoRecord): GameComputation {
  const fieldVerdicts: Record<string, GameFieldVerdict> = {};
  for (const [fieldKey, verdict] of Object.entries(record.computation.fieldVerdicts)) {
    fieldVerdicts[fieldKey] = {
      fieldValue: verdict.fieldValue,
      verdict: verdict.verdict,
      evidenceGrade: verdict.evidenceGrade,
      supportCount: verdict.supportCount,
      refuteCount: verdict.refuteCount,
      notFoundCause: verdict.notFoundCause,
      examinedPages: verdict.examinedPages,
    };
  }
  const anchor = record.computation.anchor;
  return {
    gate: record.computation.gate,
    bucket: record.bucket,
    keyFieldValues: record.computation.keyFieldValues,
    fieldVerdicts,
    cooccurrence: record.computation.cooccurrence,
    anchor: anchor
      ? {
          grade: anchor.grade,
          evidenceGrade: anchor.evidenceGrade,
          urls: anchor.urls,
          searchPhrases: anchor.searchPhrases,
          stale: anchor.stale,
        }
      : null,
    evidenceCount: record.evidence.length,
  };
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
    if (combo.status !== 'covered' || combo.recordId === null) continue;
    const record = records.get(combo.recordId);
    if (!record) {
      problems.push(`组合 ${combo.id} 指向的 ${combo.recordId} 不在 demo-data.js 里`);
      continue;
    }
    const values = new Map(record.fields.map((field) => [field.key, field.value]));
    const triple = tripleOf(record);
    if (triple === null || comboKeyOf(triple) !== combo.key) {
      problems.push(`组合 ${combo.id} 的取值与 ${combo.recordId} 的字段值不一致`);
    }
    if (!values.has('sessionName')) problems.push(`组合 ${combo.id} 的记录缺 sessionName`);
    if (combo.computation === null || record.computation.gate !== combo.computation.gate) {
      problems.push(`组合 ${combo.id} 的门禁与 ${combo.recordId} 的冻结数据不一致`);
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
  const triples = collectTriples(records, DATE_OPTIONS);
  if (triples.length === 0) {
    throw new Error('冻结数据里没有任何「机构 + 专场主名 + 副题」的真实三元组，无法建组合矩阵');
  }
  const slots = slotsOf(triples, DATE_OPTIONS);
  assertOptionsFromFrozen(records, triples, slots);

  const combosInOrder = combosOf(triples, DATE_OPTIONS);
  if (combosInOrder.length > MAX_COMBOS) {
    throw new Error(`组合总数 ${combosInOrder.length} 超过上限 ${MAX_COMBOS}，请减少每槽选项`);
  }

  // 记录索引：只收四个值都在候选集合里的记录（其余记录不在本小游戏的取值空间内）
  const optionsFor = (key: GameSlotKey): Set<string> =>
    new Set(slots.find((slot) => slot.key === key)?.options ?? []);
  const optionSets: Record<GameSlotKey, Set<string>> = {
    auctionHouse: optionsFor('auctionHouse'),
    dateText: optionsFor('dateText'),
    sessionPrefix: optionsFor('sessionPrefix'),
    sessionSubtitle: optionsFor('sessionSubtitle'),
  };
  const caseOrderByName = new Map(cases.map((item, index) => [item.id, index]));
  const byKey = new Map<string, Candidate[]>();
  for (const item of cases) {
    for (const record of item.records) {
      const triple = tripleOf(record);
      if (triple === null) continue;
      const inScope = (Object.keys(optionSets) as GameSlotKey[]).every((key) =>
        optionSets[key].has(triple[key]),
      );
      if (!inScope) continue;
      const key = comboKeyOf(triple);
      const list = byKey.get(key) ?? [];
      list.push({ record, caseId: item.id, caseOrder: caseOrderByName.get(item.id) ?? 0 });
      byKey.set(key, list);
    }
  }

  const combos: GameCombo[] = [];
  for (const [index, values] of combosInOrder.entries()) {
    const key = comboKeyOf(values);
    const candidates = byKey.get(key) ?? [];
    if (candidates.length === 0) {
      combos.push({
        id: `g-${String(index + 1).padStart(2, '0')}`,
        key,
        values,
        sentence: sentenceOf(values),
        status: 'uncovered',
        recordId: null,
        caseId: null,
        matched: [],
        computation: null,
      });
      continue;
    }
    const chosen = pickCandidate(candidates);
    const matched = candidates
      .slice()
      .sort(
        (a, b) =>
          GATE_RANK[a.record.computation.gate] - GATE_RANK[b.record.computation.gate] ||
          a.caseOrder - b.caseOrder ||
          a.record.recordId.localeCompare(b.record.recordId),
      )
      .map((candidate) => ({
        recordId: candidate.record.recordId,
        caseId: candidate.caseId,
        gate: candidate.record.computation.gate,
        bucket: candidate.record.bucket,
      }));
    combos.push({
      id: `g-${String(index + 1).padStart(2, '0')}`,
      key,
      values,
      sentence: sentenceOf(values),
      status: 'covered',
      recordId: chosen.record.recordId,
      caseId: chosen.caseId,
      matched,
      computation: computationOf(chosen.record),
    });
  }

  const stats: GameStats = {
    total: combos.length,
    covered: 0,
    uncovered: 0,
    byStatus: { strong: 0, weak: 0, refuted: 0, not_found: 0 },
    maxCombos: MAX_COMBOS,
  };
  for (const combo of combos) {
    if (combo.status === 'uncovered' || combo.computation === null) {
      stats.uncovered += 1;
      continue;
    }
    stats.covered += 1;
    stats.byStatus[combo.computation.bucket] += 1;
  }

  // 每类都要有覆盖组合，小游戏才凑得齐四种结局；缺了就直接停下来，不擅自放宽候选
  for (const bucket of ['strong', 'weak', 'refuted', 'not_found'] as const) {
    if (stats.byStatus[bucket] === 0) {
      throw new Error(
        `收窄候选后覆盖组合里没有 ${bucket}，四个结局必须各至少 1 组；` +
          '不要为了凑数把不可组合的候选放回来，先检查冻结数据或候选规则',
      );
    }
  }

  const data: GameData = {
    generatedAt: new Date().toISOString(),
    generator: 'src/demo-page/build-demo-game.ts',
    note:
      '组合矩阵在构建时算好：机构 + 专场主名 + 副题只取冻结记录里真实出现过的三元组，' +
      '每个三元组再与四个时间候选组合；匹配不到记录就是「这批证据没覆盖」，' +
      '不继承旧证据，也不判成被拒收。裁决、共现、坐标随记录冻结，逐条引文在 demo-data.js。',
    slots,
    triples,
    combos,
    stats,
  };

  await verifyAgainstDemoData(data);

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(
    OUTPUT_PATH,
    `// 由 ${data.generator} 从 examples/ 与 demo-data.js 生成，不要手改；改槽位或批次后重跑 pnpm run demo:game。\n` +
      '// 组合矩阵只冻结"哪组取值命中哪条冻结记录"与引擎摘要；逐条证据、引文与快照在 demo-data.js，页面按记录号引用。\n' +
      `window.LODESTAR_DEMO_GAME = ${JSON.stringify(data, null, 2)};\n`,
    'utf8',
  );

  const bytes = (await fs.stat(OUTPUT_PATH)).size;
  console.log(`\nWrote ${path.relative(PACKAGE_ROOT, OUTPUT_PATH)} (${(bytes / 1024).toFixed(1)} KB)`);
  console.log(`Real triples: ${triples.length}`);
  console.log(
    `Slot candidates: ${slots
      .map((slot) => `${slot.key}=${slot.options.length}`)
      .join(' ')}`,
  );
  console.log(
    `Combos: total=${stats.total} covered=${stats.covered} uncovered=${stats.uncovered} — ` +
      ['strong', 'weak', 'refuted', 'not_found']
        .map((bucket) => `${bucket}=${stats.byStatus[bucket as keyof GameStats['byStatus']]}`)
        .join(' '),
  );
}

main().catch((error) => {
  console.error('Failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
