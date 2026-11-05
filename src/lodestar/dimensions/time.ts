// src/lodestar/dimensions/time.ts
/**
 * 时间维度：判"页面说的这段时间"与"断言说的这段时间"算不算同一段。
 *
 * 窗口口径全部复用陶瓷包里的 `assertionTimeWindow` / `evidenceTimeWindow`——
 * 季节表只有一份，本文件不写任何月份数字，也不再复制一套边界规则。
 * 细节见 docs/time-window-rules.md。
 */

import { assertionTimeWindow, evidenceTimeWindow, seasonOfMonth } from '../packs/porcelain/rules';
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

/** 断言写到"月"这一级精度（没有更细的日） */
function isMonthPrecise(text: string): boolean {
  return /\d{1,2}\s*月/.test(text) && !isDayPrecise(text);
}

/** 证据写法带季节词时，放宽窗会比严格窗宽——只有这种情况才有"季节边界"可言 */
function isSeasonWidened(strict: Window, wide: Window): boolean {
  return strict.from !== wide.from || strict.to !== wide.to;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** `YYYY-MM-DD` 所在月份的前一个月（用于判"贴近季节开场边界"） */
function monthBefore(iso: string): Window {
  const [year, month] = iso.split('-').map(Number);
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const lastDay = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
  return {
    from: `${prevYear}-${pad2(prevMonth)}-01`,
    to: `${prevYear}-${pad2(prevMonth)}-${pad2(lastDay)}`,
  };
}

/** 断言的月份（1–12）；不是月级写法返回 null */
function claimMonth(text: string): number | null {
  if (!isMonthPrecise(text)) return null;
  const match = /(\d{1,2})\s*月/.exec(text);
  const month = match ? Number(match[1]) : NaN;
  return month >= 1 && month <= 12 ? month : null;
}

/**
 * 比较时间维度。
 *
 * - 证据严格窗落在断言窗内（含等值）→ 完全对上；
 * - 两个严格窗相交但证据更宽 → 口径相容（同一段的粗写与细写）；
 * - 严格窗不相交、证据放宽窗却与断言窗相交：
 *   - 断言精确到日 → 边缘相容（只说明"没被排除"）；
 *   - 断言只写到月、且正是证据季节开场前的那一个月 → 口径相容（秋拍提前到 8 月末）；
 *   - 断言只写到月、但已经落入下一个季节（秋季对 12 月）→ 边缘相容；
 * - 放宽窗也不相交 → 明确冲突候选。
 *
 * 两个月都是"另一个季节"（8 月属夏、12 月属冬），差别只有位置：
 * 8 月紧贴秋季开场（放宽圈的前沿），12 月已经越过秋季收场。前沿那一个月
 * 是季节词写法在真实素材里最常见的提前量，收场后的月份则是下一季，不能同等待遇。
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
    const month = claimMonth(claimValue);
    if (month !== null && isSeasonWidened(evidenceStrict, evidenceWide)) {
      if (overlaps(claimWindow, monthBefore(evidenceStrict.from))) {
        return { state: 'caliber', note: '月份紧贴证据季节的开场边界，属于季节词写法的提前量' };
      }
      const monthSeason = seasonOfMonth(month);
      if (monthSeason && monthSeason.word !== seasonWordOf(evidenceStrict.from)) {
        return { state: 'edge', note: '断言已落入另一个季节，只能算擦边' };
      }
      return { state: 'edge', note: '月份落在放宽圈但接不上季节边界，按保守档处理' };
    }
    return { state: 'edge', note: '只落在放宽圈里，不能证明属于同一段' };
  }

  return { state: 'conflict', note: '两段时间的窗口不相交（冲突只作候选，不压成反对）' };
}

/** 某个月属于哪个季节词（只用于给"另一个季节"写说明，判定本身看 seasonOfMonth） */
function seasonWordOf(iso: string): string {
  const month = Number(iso.slice(5, 7));
  return seasonOfMonth(month)?.word ?? '';
}

export const timeDimension: DimensionSpec = {
  id: 'porcelain:dateText',
  label: '举办时间',
  weightCap: 1,
  canStandAlone: false,
  edgeRule:
    '断言写到月、且是证据季节开场前的那一个月＝口径相容；' +
    '断言写到月但已落入下一个季节，或断言写到日只落在放宽圈里＝边缘相容（只说明没被排除）。',
  compare: ({ claimValue, matchedValue }) => compareTimeDimension(claimValue, matchedValue),
};

