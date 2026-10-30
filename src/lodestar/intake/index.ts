// src/lodestar/intake/index.ts
/**
 * 输入侧出口：提问 → 记录容器 → 字段原子化 → 预筛
 *
 * 引擎其它部分只从这里进；解析与计数都是纯函数，只有 `elicit` 触外部（LLM）。
 */

export { DEFAULT_ELICITATION_OPTIONS, elicit, type ElicitationOptions, type ElicitationResult } from './elicitation';
export {
  DEFAULT_SOURCE_ELICITATION_OPTIONS,
  elicitSourceEntries,
  type SourceElicitationOptions,
  type SourceElicitationResult,
  type SourceEntryCandidate,
} from './source-elicitation';
export {
  alignRuns,
  applyConcretization,
  capRecords,
  isDiscardableRow,
  pickPrimaryVariants,
  recordFieldsSnapshot,
  type AlignedRecord,
  type FieldVariant,
  type MappedRow,
} from './record-container';
export { parseConcretizationPatches, parseModelRows, type ParsedAnswer } from './parse-answer';
export { applyTriage, mergeDuplicateClaims, triageClaim, type TriageReason } from './triage';
export { atomizeFieldToClaim, externalClaimToRecord } from './atomize';
export { keyFieldSpecs, renderClaimAtomize, renderClaimCompare, renderConcretization, renderEnumeration } from './prompts';
