// src/lodestar/dimensions/text.ts
/**
 * 文本类维度：专场名这类"写法可能差一点、但指的是同一个名字"的字段。
 *
 * 只做可机械复现的比较：先按字形/标点/罗马数字归一，再判相等或包含。
 * 不做语义相似度，也不调用模型——那会把"看起来像"混进"对上了"。
 */

import { foldGlyphVariants } from '../../utils/text-language';
import type { DimensionCompareResult, DimensionSpec } from './index';

const ROMAN_FOLD: Record<string, string> = { 'Ⅰ': 'i', 'Ⅱ': 'ii', 'Ⅲ': 'iii', 'Ⅳ': 'iv', 'Ⅴ': 'v' };

/** 归一：繁简/异体字、罗马数字、空白与常见标点、大小写都不参与比较 */
export function normalizeTextValue(text: string): string {
  const folded = foldGlyphVariants(String(text ?? '')).replace(/[ⅠⅡⅢⅣⅤ]/g, (ch) => ROMAN_FOLD[ch] ?? ch);
  return folded.replace(/[\s—–－\-_·.,，。、"'“”‘’「」『』《》()（）]/g, '').toLowerCase();
}

export function compareTextDimension(claimValue: string, matchedValue: string): DimensionCompareResult {
  const claim = normalizeTextValue(claimValue);
  const matched = normalizeTextValue(matchedValue);
  if (claim === '' || matched === '') {
    return { state: 'unknown', note: '文本值为空，判不了' };
  }
  if (claim === matched) return { state: 'exact', note: '归一后完全一致' };
  if (claim.includes(matched) || matched.includes(claim)) {
    return { state: 'caliber', note: '一方是另一方的截断写法（可能是同一个名字）' };
  }
  return { state: 'mismatch', note: '归一后仍不是同一个名字' };
}

export const sessionNameDimension: DimensionSpec = {
  id: 'porcelain:sessionName',
  label: '专场名',
  weightCap: 1,
  canStandAlone: false,
  edgeRule: '繁简、罗马数字、空白标点不计；一方是另一方的截断写法＝口径相容。',
  compare: ({ claimValue, matchedValue }) => compareTextDimension(claimValue, matchedValue),
};
