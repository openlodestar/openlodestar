// src/demo-page/quote-locate.ts
/**
 * 在快照正文里定位一条引文（冻结与渲染共用）。
 *
 * 边界必须与 `quoteMatches` 完全一致：空白、不可见格式字符、HTML 标签、实体、
 * 全角与繁体差异都不算差异。所以调用方不能用 `indexOf(quote)` 直接找——
 * 实测里有引文跨了 `<h3>`/`<p>` 标签，原始字符串里根本不存在这一段连续文字。
 *
 * 做法：先按"只去空白与不可见字符"的紧凑串直接找；找不到就用引文里分散的短串当锚点，
 * 再用真引擎的 `quoteMatches` 在窗口里复核（不自己重写一套归一化），最后二分收窄到
 * 能覆盖引文的最小原始区间。
 */

import { quoteMatches } from '../lodestar/adjudicate/compare';

const INVISIBLE_FORMAT = /[\u00AD\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF]/;

function compact(text: string): { value: string; indexMap: number[] } {
  let value = '';
  const indexMap: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? '';
    if (/\s/.test(char) || INVISIBLE_FORMAT.test(char)) continue;
    value += char;
    indexMap.push(index);
  }
  return { value, indexMap };
}

/** 把已验证命中的窗口收窄到能覆盖引文的最小原始区间（二分两侧边界） */
function narrowSpan(text: string, quote: string, start: number, end: number): { start: number; end: number } {
  let lo = start;
  let hi = end;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (quoteMatches(quote, text.slice(mid, end))) lo = mid;
    else hi = mid - 1;
  }
  const left = lo;
  lo = left + 1;
  hi = end;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (quoteMatches(quote, text.slice(left, mid))) hi = mid;
    else lo = mid + 1;
  }
  return { start: left, end: lo };
}

export function locateQuote(text: string, quote: string): { start: number; end: number } | null {
  const hay = compact(text);
  const needle = compact(quote).value;
  if (needle === '') return null;
  const direct = hay.value.indexOf(needle);
  if (direct >= 0) {
    const start = hay.indexMap[direct];
    const end = hay.indexMap[direct + needle.length - 1];
    if (start === undefined || end === undefined) return null;
    return { start, end: end + 1 };
  }

  // 引文与正文的差异可能不止空白——标签、实体、全角与繁体都会被 `quoteMatches` 折掉。
  // 用引文里短而分散的片段当锚点，再用真引擎的比对规则复核。
  const anchors: string[] = [];
  for (const length of [14, 10, 7]) {
    for (let offset = 0; offset + length <= needle.length; offset += length - 2) {
      anchors.push(needle.slice(offset, offset + length));
    }
  }
  for (const anchor of anchors) {
    let at = hay.value.indexOf(anchor);
    let attempts = 0;
    while (at >= 0 && attempts < 12) {
      attempts += 1;
      const anchorStart = hay.indexMap[at];
      if (anchorStart !== undefined) {
        for (const pad of [200, 600, 1200, 2500]) {
          const start = Math.max(0, anchorStart - pad);
          const end = Math.min(text.length, anchorStart + quote.length + pad);
          if (quoteMatches(quote, text.slice(start, end))) {
            return narrowSpan(text, quote, start, end);
          }
        }
      }
      at = hay.value.indexOf(anchor, at + 1);
    }
  }
  return null;
}
