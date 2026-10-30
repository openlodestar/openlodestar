// src/lodestar/record-gate/index.ts
/**
 * 记录层出口：共现门禁 → 强／弱／丢弃 → 坐标派生
 */

export {
  decideGate,
  findCooccurringUrls,
  minGrade,
  type GateInput,
  type GateOutcome,
} from './cooccurrence';
export { deriveAnchor, supportingUrlsUnion, type DeriveAnchorInput } from './anchor-export';
export {
  deriveSourceAnchor,
  type DeriveSourceAnchorInput,
  type SourceAnchorDecision,
  type SourceProbePage,
} from './source-anchor';
