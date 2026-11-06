// src/lodestar/dimensions/location.ts
/**
 * 地点维度：判页面上写的地点与断言写的地点是不是同一个。
 *
 * 城市词表与机构维度共用一份；限定词指向不同城市时只作冲突候选，
 * 不自动判"反对"（汇总层统一处理）。
 */

import { cityOf } from './institution';
import type { DimensionCompareResult, DimensionSpec } from './index';

export function compareLocationDimension(
  claimValue: string,
  matchedValue: string,
): DimensionCompareResult {
  const claimCity = cityOf(claimValue);
  const matchedCity = cityOf(matchedValue);
  if (claimCity !== '' && matchedCity !== '') {
    if (claimCity === matchedCity) return { state: 'exact', note: '点名的是同一个城市' };
    return { state: 'conflict', note: `地点指向不同城市（${claimCity} / ${matchedCity}）` };
  }
  const claim = claimValue.trim();
  const matched = matchedValue.trim();
  if (claim !== '' && matched !== '' && (claim.includes(matched) || matched.includes(claim))) {
    return { state: 'caliber', note: '一方是另一方的更宽写法（如"北京"与"北京市"）' };
  }
  return { state: 'mismatch', note: '地点对不上' };
}

export const locationDimension: DimensionSpec = {
  id: 'porcelain:location',
  label: '举办地点',
  weightCap: 0.5,
  canStandAlone: false,
  edgeRule: '同城不同写法＝口径相容；点名不同城市＝明确冲突候选。',
  compare: ({ claimValue, matchedValue }) => compareLocationDimension(claimValue, matchedValue),
};
