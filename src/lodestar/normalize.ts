// src/lodestar/normalize.ts
/**
 * 文本归一化（纯函数，无域知识）
 *
 * 用途只有两处：**去重**与**复现比对**。两者都要求"同一件事的两种写法落到同一个键"，
 * 而领域内的等价关系（机构简称、年份写法）属策略包，不在这里。
 *
 * 归一化不改写原文——claims.rawText / atomicText 永远保留原样，这里只产比较键。
 */

import { decodeHtmlEntities } from '../utils/html-entities';
import { foldGlyphVariants } from '../utils/text-language';

/** 参与折叠的标点与空白（中文全角 + ASCII 常见分隔） */
const PUNCT_PATTERN = /[\s　、，。；：！？"'“”‘’()（）【】《》.,;:!?\-_/\\|]+/g;

/**
 * 不可见格式字符：零宽空格/连接符、BOM、软连字符、方向控制等。
 * 它们来自 HTML 排版与复制噪声，不是页面上的字；比对与去重时一律不计。
 */
const INVISIBLE_FORMAT = /[\u00AD\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF]/g;

/** 去掉不可见格式字符（比较键与引文比对共用同一条规则） */
export function stripInvisibleFormat(input: string): string {
  return input.replace(INVISIBLE_FORMAT, '');
}

/**
 * 归一化文本：全角转半角、**字形折叠（繁/异体→简体正体）**、去标点与空白、拉丁字母小写。
 * 空串与纯符号输入返回空串，由调用方判"无法消解指代"。
 *
 * 字形折叠只服务"同一件事的两种写法落到同一个键"——只折字形，不动语义、不翻译。
 */
export function normalizeText(input: string): string {
  if (typeof input !== 'string') return '';
  const decoded = decodeHtmlEntities(input);
  const widthFixed = foldGlyphVariants(decoded.normalize('NFKC'));
  return stripInvisibleFormat(widthFixed).replace(PUNCT_PATTERN, '').toLowerCase();
}

/** 断言的复现/去重键：主体 × 谓词 × 客体 × 时间范围，缺项以空段占位 */
export function claimKey(parts: {
  subject: string;
  predicate: string;
  object: string;
  timeFrom?: string | null;
  timeTo?: string | null;
}): string {
  return [
    normalizeText(parts.subject),
    normalizeText(parts.predicate),
    normalizeText(parts.object),
    (parts.timeFrom ?? '').slice(0, 10),
    (parts.timeTo ?? '').slice(0, 10),
  ].join('\u0000');
}

/** 两条归一化文本是否近似重合（用于跨渠道去重）：完全等键，或一方包含另一方且长度差有限 */
export function isNearDuplicate(a: string, b: string): boolean {
  if (a === '' || b === '') return false;
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  return shorter.length >= 8 && longer.includes(shorter) && longer.length - shorter.length <= 6;
}

/**
 * 页面可见文本（去脚本、样式、注释与标签）。
 *
 * 用途：年份闸、来源坐标的"入口页有没有说到这个主题"——
 * 脚本常量、样式里的年份或主题词不算"这页在说这件事"。
 */
export function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
}
