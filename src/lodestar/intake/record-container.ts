// src/lodestar/intake/record-container.ts
/**
 * 记录容器与稳定性复现计数（纯函数，无 LLM、无 IO）
 *
 * 为什么这一层必须是纯函数：三招筛选的顺序（弃权 → 稳定性 → 具体化）是本管线
 * 输入侧唯一的纪律，顺序颠倒会把编造固定下来。顺序与阈值全部写在这里，
 * 由 `record-container.test.ts` 逐条钉住，不靠提示词自觉。
 *
 * 记录对齐按策略包的 `recordMatchKey`（机构简称、年份写法这类等价关系是域知识）。
 */

import { normalizeText } from '../normalize';
import { newId } from '../ids';
import type { DomainPack, ParsedRecord } from '../packs/pack';

/** 一次作答里的一行（已经过 pack.mapRow 的字段映射） */
export type MappedRow = Record<string, string | null>;

/** 一个字段的一个取值变体：复现次数按它的 matchKey 数 */
export interface FieldVariant {
  fieldKey: string;
  /** 模型写下的原样值 */
  value: string;
  /** 等价键（同键算同一条断言） */
  matchKey: string;
  /** 在多少次复问里出现 */
  hits: number;
  /** 首次出现的作答轮次（0 基） */
  firstSeenRun: number;
  /** 是否来自具体化追问（追问诱导 → 裁决环节降权） */
  promptedDetail: boolean;
}

/** 跨轮次对齐后的一条记录（一场事件） */
export interface AlignedRecord {
  recordId: string;
  /** 对齐键（策略包给） */
  matchKey: string;
  /** 参与对齐的复问总次数 */
  runs: number;
  /** 该记录整体被复现的次数（同 matchKey 出现过的轮次数） */
  recordHits: number;
  /** 字段 → 取值变体列表（同字段可能有多个变体：模型两次给了不同写法） */
  variants: FieldVariant[];
  /** 每轮该行的原始 JSON 文本（回溯用） */
  rawTexts: string[];
}

/** 一行作答是否整行作废：关键字段全空（弃权许可的产物） */
export function isDiscardableRow(row: MappedRow, pack: DomainPack): boolean {
  const keys = pack.fields().filter((f) => f.role === 'key').map((f) => f.key);
  if (keys.length === 0) return Object.values(row).every((v) => !v);
  return keys.every((k) => {
    const value = row[k];
    return value === undefined || value === null || normalizeText(value) === '';
  });
}

/**
 * 把多轮作答对齐成记录集合。
 *
 * 规则：
 * - 按轮次顺序处理，同一 matchKey 视为同一场；
 * - 字段值按 `valueMatchKey` 归并成变体，同变体每轮最多计一次（防止模型在一轮里重复列同一场）；
 * - 每轮内部先按 matchKey 去重（一轮里两行指向同一场 → 只保留第一行）。
 */
export function alignRuns(runs: MappedRow[][], pack: DomainPack): AlignedRecord[] {
  const byKey = new Map<string, AlignedRecord>();

  runs.forEach((rows, runIndex) => {
    const seenThisRun = new Set<string>();
    for (const row of rows) {
      if (isDiscardableRow(row, pack)) continue;
      const record: ParsedRecord = { recordId: '', fields: row, rawText: JSON.stringify(row) };
      const matchKey = pack.recordMatchKey(record);
      if (matchKey === '') continue;
      if (seenThisRun.has(matchKey)) continue;
      seenThisRun.add(matchKey);

      let aligned = byKey.get(matchKey);
      if (!aligned) {
        aligned = {
          recordId: newId('record'),
          matchKey,
          runs: runs.length,
          recordHits: 0,
          variants: [],
          rawTexts: [],
        };
        byKey.set(matchKey, aligned);
      }
      aligned.recordHits += 1;
      aligned.rawTexts.push(record.rawText);

      for (const [fieldKey, value] of Object.entries(row)) {
        if (value === null || value === undefined) continue;
        const trimmed = String(value).trim();
        if (trimmed === '') continue;
        const variantKey = pack.valueMatchKey(fieldKey, trimmed);
        if (variantKey === '') continue;
        const existing = aligned.variants.find(
          (v) => v.fieldKey === fieldKey && v.matchKey === variantKey,
        );
        if (existing) {
          existing.hits += 1;
        } else {
          aligned.variants.push({
            fieldKey,
            value: trimmed,
            matchKey: variantKey,
            hits: 1,
            firstSeenRun: runIndex,
            promptedDetail: false,
          });
        }
      }
    }
  });

  return [...byKey.values()];
}

/**
 * 接受记录数上限截断（默认值：一次提问接受 30 条记录）。
 * 排序判据 = 记录整体复现次数降序 → 首次出现轮次升序 → 对齐键字典序。
 * 第三判据用 matchKey 而不是 recordId：recordId 含随机段，拿它兜底会让同一批输入
 * 两次跑出不同的截断结果，验收里的"截断的确定性顺序"就废了。
 */
export function capRecords(records: AlignedRecord[], maxRecords: number): AlignedRecord[] {
  if (maxRecords <= 0 || records.length <= maxRecords) return records;
  return [...records]
    .sort(
      (a, b) =>
        b.recordHits - a.recordHits ||
        firstRunOf(a) - firstRunOf(b) ||
        a.matchKey.localeCompare(b.matchKey),
    )
    .slice(0, maxRecords);
}

function firstRunOf(record: AlignedRecord): number {
  return record.variants.reduce((min, v) => Math.min(min, v.firstSeenRun), Number.MAX_SAFE_INTEGER);
}

/** 把具体化追问补出来的值并进已有记录（同 matchKey 的变体不新建，只累加次数） */
export function applyConcretization(
  records: AlignedRecord[],
  patches: Array<{ matchKey: string; fields: MappedRow }>,
  pack: DomainPack,
): void {
  const byKey = new Map(records.map((r) => [r.matchKey, r]));
  for (const patch of patches) {
    const record = byKey.get(patch.matchKey);
    if (!record) continue;
    for (const [fieldKey, value] of Object.entries(patch.fields)) {
      if (value === null || value === undefined) continue;
      const trimmed = String(value).trim();
      if (trimmed === '') continue;
      if (pack.fields().every((f) => f.key !== fieldKey)) continue;
      const variantKey = pack.valueMatchKey(fieldKey, trimmed);
      const existing = record.variants.find((v) => v.fieldKey === fieldKey && v.matchKey === variantKey);
      if (existing) {
        existing.hits += 1;
        continue;
      }
      record.variants.push({
        fieldKey,
        value: trimmed,
        matchKey: variantKey,
        hits: 1,
        firstSeenRun: record.runs,
        promptedDetail: true,
      });
    }
  }
}

/** 记录 → 字段快照（每字段取最稳的变体，供断言模板填充） */
export function recordFieldsSnapshot(record: AlignedRecord): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const variant of pickPrimaryVariants(record)) {
    out[variant.fieldKey] = variant.value;
  }
  return out;
}

/**
 * 每字段取"最稳的那个变体"作为待查断言。
 * 其余变体（模型换了写法但次数更少）不进裁决——同一件事不重复花预算，
 * 但它们在底稿里仍作为观测保留（弃权率与稳定率要看总变体数）。
 */
export function pickPrimaryVariants(record: AlignedRecord): FieldVariant[] {
  const best = new Map<string, FieldVariant>();
  for (const variant of record.variants) {
    const current = best.get(variant.fieldKey);
    if (
      !current ||
      variant.hits > current.hits ||
      (variant.hits === current.hits && variant.firstSeenRun < current.firstSeenRun)
    ) {
      best.set(variant.fieldKey, variant);
    }
  }
  return [...best.values()].sort((a, b) => a.fieldKey.localeCompare(b.fieldKey));
}

/**
 * 单查询预算的第二层闸：一条记录最多送查几个字段。
 *
 * 依据：队列预算有两层上限——一次查询接受的记录数、以及**一条记录的字段数**。
 * 少了这一层，一条七个字段都填满的记录就要花七份检索预算，而其中次要字段并不决定这场事件存不存在。
 *
 * 取舍次序：关键字段优先占额度（共现门禁只认它们），同级内按复现次数降序，
 * 再按字段键字典序兜底——同一批输入必得同一批选择，截断才是确定的。
 * 超出的字段**不静默丢弃**：调用方照样为它原子化出断言，只是按"超出字段预算"拒收落底稿。
 */
export function selectFieldsForBudget(
  variants: FieldVariant[],
  keyFieldKeys: string[],
  maxFields: number,
): { chosen: FieldVariant[]; overBudget: FieldVariant[] } {
  const rank = new Map(keyFieldKeys.map((key, index) => [key, index]));
  const ordered = [...variants].sort((a, b) => {
    const roleA = rank.has(a.fieldKey) ? rank.get(a.fieldKey)! : keyFieldKeys.length;
    const roleB = rank.has(b.fieldKey) ? rank.get(b.fieldKey)! : keyFieldKeys.length;
    return (
      roleA - roleB ||
      b.hits - a.hits ||
      a.firstSeenRun - b.firstSeenRun ||
      a.fieldKey.localeCompare(b.fieldKey)
    );
  });
  if (maxFields <= 0 || ordered.length <= maxFields) {
    return { chosen: ordered, overBudget: [] };
  }
  return { chosen: ordered.slice(0, maxFields), overBudget: ordered.slice(maxFields) };
}
