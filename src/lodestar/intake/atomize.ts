// src/lodestar/intake/atomize.ts
/**
 * 字段原子化（纯函数）
 *
 * 一条记录拆成若干原子断言：一条只装一个命题。模板与谓词来自策略包，
 * 引擎只负责填充与组装——这就是"域知识不进引擎"在输入侧的落点。
 *
 * 拆不出可判定形态的一律留空句子并由预筛拒收，不硬凑。
 */

import { normalizeText } from '../normalize';
import { newId } from '../ids';
import { fillTemplate, type DomainPack, type FieldSpec } from '../packs/pack';
import type { AlignedRecord, FieldVariant } from './record-container';
import { recordFieldsSnapshot } from './record-container';
import type { ClaimChannel, ClaimRecord } from '../types';

/**
 * 断言主键按"记录 + 字段"派生，是确定性的。
 *
 * 为什么不用随机 id：记录级门禁要把一条记录里的关键字段认领回来，而裁决是逐条断言跑的。
 * 用 `rec|fieldKey` 派生，门禁与裁决两侧自然对得上，重跑（resume）也还能按同一把钥匙找回字段。
 */
export function deterministicClaimId(recordId: string, fieldKey: string): string {
  return `cl-${recordId}-${fieldKey}`;
}

/** 原子化输入 */
export interface AtomizeInput {
  queryId: string | null;
  record: AlignedRecord;
  variant: FieldVariant;
  spec: FieldSpec;
  pack: DomainPack;
  channel: ClaimChannel;
  /** 这条断言因为主线缺哪类数据才被来查（只用于评测分层，不参与计票） */
  selectionReason: string | null;
  /** 本条断言所属的复问总次数（写进 provenance.stabilityRuns） */
  stabilityRuns: number;
  at?: Date;
}

/** 从字段规格里取主语来源：`self` 表示焦点字段自己的值 */
function subjectOf(input: AtomizeInput, values: Record<string, string | null>): string {
  const keys = input.spec.subjectKeys && input.spec.subjectKeys.length > 0
    ? input.spec.subjectKeys
    : ['self'];
  for (const key of keys) {
    const value = key === 'self' ? input.variant.value : values[key];
    if (value && normalizeText(value) !== '') return String(value).trim();
  }
  return '';
}

/**
 * 一个字段变体 → 一条原子断言。
 * 焦点值缺位或模板填完是空串时，atomicText 写成"无法构成句子"的形态，
 * 交给预筛按 `no-assertion` 拒收——不在这里偷偷丢弃，否则审计缺口看不见。
 */
export function atomizeFieldToClaim(input: AtomizeInput): ClaimRecord {
  const { record, variant, spec, pack, at = new Date() } = input;
  const values = recordFieldsSnapshot(record);
  const atomicText = fillTemplate(spec.claimTemplate, { ...values, self: variant.value }, spec.key);
  const subject = subjectOf(input, values);
  const scope = pack.timeScopeOf({ recordId: record.recordId, fields: values, rawText: record.rawTexts[0] ?? '' });

  return {
    claimId: deterministicClaimId(record.recordId, spec.key),
    queryId: input.queryId,
    recordId: record.recordId,
    fieldRole: spec.role,
    rawText: record.rawTexts[variant.firstSeenRun] ?? variant.value,
    atomicText,
    subject,
    predicate: spec.predicate,
    object: variant.value,
    timeScope: { from: scope.from, to: scope.to },
    channel: input.channel,
    provenance: {
      stabilityRuns: input.stabilityRuns,
      stabilityHits: variant.hits,
      promptedDetail: variant.promptedDetail,
      selectionReason: input.selectionReason,
    },
    triage: { passed: true, reason: 'pending-triage' },
    state: 'pending',
    fieldKey: spec.key,
    createdAt: at.toISOString(),
  };
}

/** 外部提交的一条已原子化断言（不带记录容器）→ 契约形态 */
export function externalClaimToRecord(input: {
  rawText: string;
  atomicText: string;
  subject: string;
  predicate: string;
  object: string;
  timeScope?: { from?: string | null; to?: string | null };
  selectionReason?: string | null;
  pack: DomainPack;
  fieldKey?: string | null;
  /**
   * 外部提交也能带记录容器：给了 recordId + fieldKey 就按记录字段认领主键，
   * 记录级共现门禁才有东西可分组——不带就只能单条裁决，永远出不了坐标。
   */
  recordId?: string | null;
  queryId?: string | null;
  at?: Date;
}): ClaimRecord {
  const at = input.at ?? new Date();
  const fieldKey = input.fieldKey ?? null;
  const spec = fieldKey ? input.pack.fields().find((f) => f.key === fieldKey) : undefined;
  const recordId = typeof input.recordId === 'string' && input.recordId !== '' ? input.recordId : null;
  return {
    claimId: recordId && fieldKey ? deterministicClaimId(recordId, fieldKey) : newId('claim', at),
    queryId: input.queryId ?? null,
    recordId,
    fieldRole: spec?.role ?? 'secondary',
    rawText: input.rawText,
    atomicText: input.atomicText,
    subject: input.subject,
    predicate: input.predicate,
    object: input.object,
    timeScope: { from: input.timeScope?.from ?? null, to: input.timeScope?.to ?? null },
    channel: 'external',
    provenance: {
      stabilityRuns: 1,
      stabilityHits: 1,
      promptedDetail: false,
      selectionReason: input.selectionReason ?? 'external-submission',
    },
    triage: { passed: true, reason: 'pending-triage' },
    state: 'pending',
    fieldKey,
    createdAt: at.toISOString(),
  };
}
