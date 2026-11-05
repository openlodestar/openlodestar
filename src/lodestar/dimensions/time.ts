// src/lodestar/dimensions/time.ts
/**
 * 时间维度：判"页面说的这段时间"与"断言说的这段时间"算不算同一段。
 *
 * 窗口口径全部复用陶瓷包里的 `assertionTimeWindow` / `evidenceTimeWindow`——
 * 季节表只有一份，本文件不写任何月份数字，也不再复制一套边界规则。
 * 细节见 docs/time-window-rules.md。
 */

import { assertionTimeWindow, evidenceTimeWindow } from '../packs/porcelain/rules';
import type { DimensionCompareResult, DimensionSpec } from './index';

interface Window {
  from: string;
  to: string;
}

function overlaps(a: Window, b: Window): boolean {
  return a.from <= b.to && b.from <= a.to;
}

function contains(outer: Window, inner: Window): boolean {
  return outer.from <= inner.from && outer.to >= inner.to;
}

/** 断言写到"日"这一级精度：这种精确值落到扩出来的月份里只算擦边 */
function isDayPrecise(text: string): boolean {
  return /\d{1,2}\s*日/.test(text) || /\d{4}-\d{1,2}-\d{1,2}/.test(text);
}

/**
 * 比较时间维度。
 *
 * - 证据严格窗落在断言窗内（含等值）→ 完全对上；
 * - 两个严格窗相交但证据更宽 → 口径相容（同一段的粗写与细写）；
 * - 严格窗不相交、证据放宽窗却与断言窗相交 → 断言只写到月就口径相容，
 *   写到日就是边缘相容（扩出来的那圈只说明"没被排除"，不等于同一件）；
 * - 放宽窗也不相交 → 明确冲突候选。
 */
export function compareTimeDimension(claimValue: string, matchedValue: string): DimensionCompareResult {
  const claimWindow = assertionTimeWindow(claimValue);
  const evidenceStrict = assertionTimeWindow(matchedValue);
  const evidenceWide = evidenceTimeWindow(matchedValue);
  if (!claimWindow || !evidenceStrict || !evidenceWide) {
    return { state: 'unknown', note: '时间写法解析不出，判不了' };
  }

  if (overlaps(evidenceStrict, claimWindow)) {
    if (contains(claimWindow, evidenceStrict)) {
      return { state: 'exact', note: '证据的日期落在断言主张的范围内' };
    }
    return { state: 'caliber', note: '同一段时间的粗写与细写（证据窗口更宽）' };
  }

  if (overlaps(evidenceWide, claimWindow)) {
    if (isDayPrecise(claimValue)) {
      return { state: 'edge', note: '只在两侧各放宽一个月的窗口边缘擦上，不等于同一件' };
    }
    return { state: 'caliber', note: '断言只写到月，落在证据季节两侧一个月的漂移范围内' };
  }

  return { state: 'conflict', note: '两段时间的窗口不相交（冲突只作候选，不压成反对）' };
}

export const timeDimension: DimensionSpec = {
  id: 'porcelain:dateText',
  label: '举办时间',
  weightCap: 1,
  canStandAlone: false,
  edgeRule:
    '断言写到月、落在证据季节两侧各放宽一个月的范围内＝口径相容；' +
    '断言写到日、只落在这个放宽圈里＝边缘相容（只说明没被排除）。',
  compare: ({ claimValue, matchedValue }) => compareTimeDimension(claimValue, matchedValue),
};
