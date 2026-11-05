// src/lodestar/dimensions/index.ts
/**
 * 判据维度注册表与汇总（架构分层里的"判据层"与"汇总层"）
 *
 * 三层分工：
 * - 抽取层（`adjudicate/compare.ts`）只从页面里摘**逐字原文值**，不判这个值算不算对上；
 * - 判据层（本目录下每个维度一份纯函数实现）只把「断言值」与「原文值」比成六态之一；
 * - 汇总层（本文件的 `gradeDimensions`）只认状态，不认时间、城市、季节这类域知识。
 *
 * 加一个维度＝注册一份实现，本文件与裁决链一行不改。
 */

import type { ClaimRecord, EvidenceDimensionState, EvidenceRecord, FieldRole } from '../types';
import { timeDimension } from './time';
import { institutionDimension } from './institution';

/** 比较函数的输入：断言里这个字段的值 + 页面里逐字摘出的原文值 */
export interface DimensionCompareInput {
  claimValue: string;
  matchedValue: string;
}

/** 比较结论：只给状态与一句说明，不给分数（分数在汇总层统一折算） */
export interface DimensionCompareResult {
  state: EvidenceDimensionState;
  note: string;
}

/**
 * 维度契约。新增维度必须回答这几件事，缺一项就不许注册：
 * 维度名（域:字段）、权重上限、能否独立支撑、擦边规则、未知怎么处理。
 */
export interface DimensionSpec {
  /** 维度名，形如 `porcelain:dateText`（带域前缀，跨域同名字段不会撞车） */
  readonly id: string;
  /** 人读标签 */
  readonly label: string;
  /** 该维度对总分的权重上限：关键字段 1.0、次要字段 0.5 */
  readonly weightCap: number;
  /** 本维度能否单独撑起强坐标（现无维度声明为真：两维起步） */
  readonly canStandAlone: boolean;
  /** 本维度的擦边容忍规则（什么算口径差异、什么算擦边），只写在这里 */
  readonly edgeRule: string;
  /** 纯函数：不读库、不调模型、不看环境变量 */
  compare(input: DimensionCompareInput): DimensionCompareResult;
}

const registry = new Map<string, DimensionSpec>();

/** 注册一份维度实现（重复注册同名维度直接报错，避免两份实现悄悄覆盖） */
export function registerDimension(spec: DimensionSpec): void {
  if (registry.has(spec.id)) throw new Error(`维度 ${spec.id} 已注册，不许用第二份实现覆盖`);
  registry.set(spec.id, spec);
}

export function getDimension(id: string): DimensionSpec | undefined {
  return registry.get(id);
}

export function allDimensions(): DimensionSpec[] {
  return [...registry.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** 字段键 → 维度 id（域前缀由策略包 id 给出） */
export function dimensionIdOf(packId: string, fieldKey: string): string {
  return `${packId}:${fieldKey}`;
}

/** 这个字段接没接维度实现 */
export function dimensionForField(packId: string, fieldKey: string): DimensionSpec | undefined {
  return registry.get(dimensionIdOf(packId, fieldKey));
}

/** 字段角色 → 权重上限：关键字段 1.0、次要字段 0.5 */
export function dimensionCapOf(role: FieldRole): number {
  return role === 'key' ? 1 : 0.5;
}

/** 六态 → 折算系数（只有前三态产生正向分量） */
export const DIMENSION_STATE_WEIGHT: Record<EvidenceDimensionState, number> = {
  exact: 1,
  caliber: 0.7,
  edge: 0.3,
  conflict: 0,
  mismatch: 0,
  unknown: 0,
};

/** 升强坐标的累计分门槛：两条关键维度的口径相容刚好 1.4 过线 */
export const STRONG_SCORE_THRESHOLD = 1.2;

/** 升强坐标的单维下限（相对权重上限的倍数）：至少两维各过 0.7 倍 */
export const STRONG_DIMENSION_FLOOR = 0.7;

/** 汇总用的一条维度状态 */
export interface DimensionEntry {
  dimension: string;
  label: string;
  state: EvidenceDimensionState;
  /** 该维度的权重上限 */
  cap: number;
}

export interface DimensionGrade {
  /** 维度汇总出来的档位；强坐标还须同时满足既有共现门禁 */
  grade: 'strong' | 'weak';
  score: number;
  /** 一句人能读懂的判据说明（强坐标必须能说出"哪两维对上了"） */
  basis: string;
  /** 明确冲突的维度标签（冲突不压成"反对"，只挂候选标记） */
  conflictDimensions: string[];
  /** 全部维度都无从判断（老证据缺列）：汇总层不据此改变旧门禁 */
  allUnknown: boolean;
  entries: DimensionEntry[];
}

/**
 * 跨维度累积。
 *
 * 判定顺序是硬性的：
 * 1. 先看冲突：任一维明确冲突 → 直接判弱坐标，不再算分（是不是同一件只有一个答案）；
 * 2. 再算累计分：每维取 `权重上限 × 状态系数`，缺失/无从判断的维度不进分母；
 * 3. 升强坐标要同时满足两条——累计分 ≥ 1.2，且至少两维各过 0.7 倍上限。
 *
 * 因此单维完全对上只有 1.0，够不到 1.2：没有单一维度能单独构成强坐标，
 * 必须有第二个维度陪跑（这是有意的，见 docs/evidence-grading-proposal.md）。
 */
export function gradeDimensions(entries: DimensionEntry[]): DimensionGrade {
  const byDimension = new Map<string, DimensionEntry>();
  for (const entry of entries) {
    const prior = byDimension.get(entry.dimension);
    // 同一维度多行时，冲突优先；否则取更强的正向状态
    if (!prior || rankState(entry.state) < rankState(prior.state)) byDimension.set(entry.dimension, entry);
  }
  const resolved = [...byDimension.values()].sort((a, b) => a.dimension.localeCompare(b.dimension));

  const conflictDimensions = resolved.filter((e) => e.state === 'conflict').map((e) => e.label);
  if (conflictDimensions.length > 0) {
    return {
      grade: 'weak',
      score: 0,
      basis: `「${conflictDimensions.join('」「')}」明确冲突，先否决强坐标（冲突只作候选，不压成"反对"）`,
      conflictDimensions,
      allUnknown: false,
      entries: resolved,
    };
  }

  let score = 0;
  let strongDimensions = 0;
  for (const entry of resolved) {
    const weight = entry.cap * DIMENSION_STATE_WEIGHT[entry.state];
    score += weight;
    if (DIMENSION_STATE_WEIGHT[entry.state] >= STRONG_DIMENSION_FLOOR) strongDimensions += 1;
  }
  score = Math.round(score * 100) / 100;

  // 没有任何可展开的维度＝没有任何维度说话，同样按"全无从判断"处理
  const allUnknown = resolved.every((e) => e.state === 'unknown');
  const strong = score >= STRONG_SCORE_THRESHOLD && strongDimensions >= 2;
  const qualified = resolved.filter((e) => DIMENSION_STATE_WEIGHT[e.state] >= STRONG_DIMENSION_FLOOR);

  return {
    grade: strong ? 'strong' : 'weak',
    score,
    basis: strong
      ? `「${qualified.map((e) => e.label).join('」「')}」在各自维度上对上（累计 ${score}，≥ ${STRONG_SCORE_THRESHOLD}）`
      : score === 0
        ? '没有任何维度给出正向线索'
        : `累计 ${score} 分，未同时满足「≥ ${STRONG_SCORE_THRESHOLD} 且两维各过 ${STRONG_DIMENSION_FLOOR} 倍上限」`,
    conflictDimensions: [],
    allUnknown,
    entries: resolved,
  };
}

/** 状态排序：数字越小越"强"（冲突排最前，汇总时优先被看见） */
function rankState(state: EvidenceDimensionState): number {
  switch (state) {
    case 'conflict':
      return 0;
    case 'exact':
      return 1;
    case 'caliber':
      return 2;
    case 'edge':
      return 3;
    case 'mismatch':
      return 4;
    default:
      return 5;
  }
}

/**
 * 从一条记录的字段断言与各自的证据行里取每维状态。
 *
 * 老证据行没有 `state` 列 → 记无从判断（缺失维度不进分母，也不升坐标）。
 * 维度名优先取证据行上的 `dimension`；老行没有这一列时按字段键补一个只用于展示的名字。
 */
export function gradeRecordDimensions(
  claimIds: string[],
  claims: Map<string, ClaimRecord>,
  evidenceByClaim: Map<string, EvidenceRecord[]>,
): DimensionGrade {
  const entries: DimensionEntry[] = [];
  for (const claimId of claimIds) {
    const claim = claims.get(claimId);
    if (!claim || claim.fieldKey === null) continue;
    const rows = evidenceByClaim.get(claimId) ?? [];
    const state = pickDimensionState(rows);
    const dimension = rows.find((row) => row.dimension)?.dimension ?? `field:${claim.fieldKey}`;
    entries.push({
      dimension,
      label: claim.fieldKey,
      state,
      cap: dimensionCapOf(claim.fieldRole),
    });
  }
  return gradeDimensions(entries);
}

/** 一条断言的全部证据行 → 该维度状态（冲突优先，其次取最强的正向状态） */
export function pickDimensionState(rows: EvidenceRecord[]): EvidenceDimensionState {
  const withState = rows.filter((row) => row.state !== undefined);
  if (withState.length === 0) return 'unknown';
  if (withState.some((row) => row.state === 'conflict')) return 'conflict';
  const positive = withState.filter((row) => row.relation === 'supports');
  const pool = positive.length > 0 ? positive : withState;
  const order: EvidenceDimensionState[] = ['exact', 'caliber', 'edge', 'mismatch', 'unknown'];
  for (const state of order) {
    if (pool.some((row) => row.state === state)) return state;
  }
  return 'unknown';
}

// 内置维度：加一个维度只在这里多注册一份实现，汇总层与裁决链不认识具体维度
for (const spec of [timeDimension, institutionDimension]) {
  if (!registry.has(spec.id)) registerDimension(spec);
}

