// src/lodestar/dimensions/institution.ts
/**
 * 机构维度：裁决处地的"同名机构是不是同一家"。
 *
 * 本轮只落实现与测试，用来证明"加一个维度＝注册一份实现，核心代码不动"；
 * 真实案例流程暂不要求它参与判定。
 *
 * 擦边规则（只写在本文件，汇总层不认识任何城市）：
 * - 同名且地点限定词相同 → 完全对上；
 * - 同名但一方没写地点限定词 → 口径相容（可能同一主体，也可能是异地分支）；
 * - 地点限定词明确指向不同城市 → 明确冲突候选；
 * - 机构名对不上 → 没对上。
 */

import { canonicalHouseName } from '../packs/porcelain/rules';
import type { DimensionCompareResult, DimensionSpec } from './index';

/** 地点限定词词表（域知识：机构维度与地点维度共用一份） */
export const CITY_WORDS = [
  '北京',
  '上海',
  '广州',
  '深圳',
  '香港',
  '台北',
  '杭州',
  '南京',
  '成都',
  '重庆',
  '西安',
  '伦敦',
  '纽约',
  '巴黎',
  '东京',
  '新加坡',
];

/** 文本里点名的城市（"北京市"按"北京"算；没写返回空串） */
export function cityOf(text: string): string {
  const value = String(text ?? '');
  return CITY_WORDS.find((city) => value.includes(city)) ?? '';
}

export function compareInstitutionDimension(
  claimValue: string,
  matchedValue: string,
): DimensionCompareResult {
  const claimHouse = canonicalHouseName(claimValue);
  const matchedHouse = canonicalHouseName(matchedValue);
  if (claimHouse === '' || matchedHouse === '') {
    return { state: 'unknown', note: '机构名解析不出，判不了' };
  }
  if (claimHouse !== matchedHouse) {
    return { state: 'mismatch', note: '不是同一家机构' };
  }

  const claimCity = cityOf(claimValue);
  const matchedCity = cityOf(matchedValue);
  if (claimCity !== '' && matchedCity !== '' && claimCity !== matchedCity) {
    return { state: 'conflict', note: `同名但地点限定词指向不同城市（${claimCity} / ${matchedCity}）` };
  }
  if (claimCity === matchedCity) {
    return { state: 'exact', note: '同一机构，地点限定词一致' };
  }
  return { state: 'caliber', note: '同一机构的写法，一方多带地点限定词（可能是分支机构）' };
}

export const institutionDimension: DimensionSpec = {
  id: 'porcelain:auctionHouse',
  label: '拍卖机构',
  weightCap: 1,
  canStandAlone: false,
  edgeRule:
    '同名且地点限定词一致＝完全对上；一方多带限定词＝口径相容；' +
    '限定词指向不同城市＝明确冲突候选。',
  compare: ({ claimValue, matchedValue }) => compareInstitutionDimension(claimValue, matchedValue),
};
