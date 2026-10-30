// src/lodestar/search-phrases.ts
/**
 * 坐标检索键（searchPhrases）——身份的再入凭证
 *
 * 第一性依据：坐标的最小可用形态不是"自带能直接抓的入口 URL"，而是
 * "身份可信 + 可再检索"。机构+时间+专场名本身就是一组检索键——即使不带任何
 * URL，拿这组短语重新搜索必然能找回专场页。所以检索键是坐标的**基本项**
 * （引擎出坐标时同步产出，无网络、无计费），access 入口 URL 只是它的增强项。
 *
 * 生成纪律（机械：无词表、无启发式路由——不靠词表做匹配路由，只是
 * 把已验证字段值拼成输出物）：
 * 1. 每个关键字段取 `querySurfaces(fieldKey, value)[0]`——包已把"搜索引擎
 *    噪声写法"（全角括号、书名号、破折号）排到后面，第 0 条就是拼检索串的
 *    首选形态；字段没有归一槽时退回原始值；
 * 2. 引擎侧统一再剥一层标点 → 空格（全角/半角通用规则，防某包漏处理）；
 * 3. 两条短语：全键拼合（完整身份）+ 机构+专场（不含时间，专场名检索性最好时
 *    的紧凑形态）。纯拼接，不造新词。
 */

import type { DomainPack } from './packs/pack';
import type { AnchorRecord } from './types';

/** 通用标点（中英全半角、间隔号、破折号族）→ 空格；保留文字、数字与字母 */
const PUNCTUATION =
  /[\s!-/:-@[-`{-~\u00A0-\u00BF\u2000-\u206F\u2E00-\u2E7F\u3000-\u303F\uFF01-\uFF0F\uFF1A-\uFF1F\uFF3B-\uFF40\uFF5B-\uFF65「」『』【】《》〔〕]+/g;

/** 标点剥成空格、折叠空白——任何字段值进检索短语前的最后一道机械清洗 */
export function stripPunctuationToSpaces(text: string): string {
  return text.replace(PUNCTUATION, ' ').replace(/\s{2,}/g, ' ').trim();
}

/** 关键字段的首选检索写法（querySurfaces[0]，缺槽退回原始值） */
function preferredSurface(pack: DomainPack, fieldKey: string, value: string): string {
  const surfaces = pack.querySurfaces(fieldKey, value);
  return surfaces[0] ?? value;
}

/**
 * 由已验证字段机械拼出检索短语（出坐标时同步计算，落进 anchors.jsonl）。
 *
 * 返回顺序：[全键拼合, 机构+专场]；可用的键不足两条时去重后可能只剩一条；
 * 一个可用键都没有返回空数组（调用方照常出坐标——fields 本身就是身份）。
 */
export function buildSearchPhrases(
  fields: Record<string, string | null>,
  pack: DomainPack,
): string[] {
  const keyFields = pack.fields().filter((f) => f.role === 'key');
  const surfaces = keyFields
    .map((f) => {
      const raw = fields[f.key];
      return raw && raw.trim() !== '' ? stripPunctuationToSpaces(preferredSurface(pack, f.key, raw)) : '';
    })
    .filter((s) => s !== '');

  const phrases: string[] = [];
  const push = (phrase: string): void => {
    const t = phrase.replace(/\s{2,}/g, ' ').trim();
    if (t !== '' && !phrases.includes(t)) phrases.push(t);
  };
  push(surfaces.join(' '));
  // 紧凑形态：机构 + 专场（第一个与最后一个关键字段）——专场名独特时它比全键更好用
  if (surfaces.length > 2) push(`${surfaces[0] ?? ''} ${surfaces[surfaces.length - 1] ?? ''}`);
  return phrases;
}

/**
 * 来源坐标的检索短语：主题检索性最好，机构名把结果锁死，所以完整身份在前、紧凑形态在后。
 *
 * 缺 `sourceSearchPhrases`（只会是别的包）时退回机械拼合——按来源字段的角色取全部关键值，
 * 不要求重跑坐标生产。
 */
export function buildSourceSearchPhrases(
  fields: Record<string, string | null>,
  pack: DomainPack,
): string[] {
  const fromPack = pack.sourceSearchPhrases?.(fields) ?? [];
  if (fromPack.length > 0) return fromPack;

  const keyFields = (pack.sourceFields?.() ?? []).filter((f) => f.role === 'key');
  const values = keyFields
    .map((f) => {
      const raw = fields[f.key];
      return raw && raw.trim() !== '' ? stripPunctuationToSpaces(preferredSurface(pack, f.key, raw)) : '';
    })
    .filter((value) => value !== '');
  const phrase = values.join(' ').trim();
  return phrase === '' ? [] : [phrase];
}

/**
 * 读坐标的检索键（旧坐标没有 searchPhrases 列时按字段现算，不要求重跑引擎）。
 *
 * 入参只要求 fields 与 searchPhrases：消费侧（坐标臂入口解析）手里可能只有
 * 坐标的这几个字段，不需要为算短语而伪造一条完整坐标。
 */
export function searchPhrasesOf(
  anchor: Pick<AnchorRecord, 'fields' | 'searchPhrases'> & { kind?: AnchorRecord['kind'] },
  pack: DomainPack,
): string[] {
  if (anchor.searchPhrases) return anchor.searchPhrases;
  return anchor.kind === 'source'
    ? buildSourceSearchPhrases(anchor.fields, pack)
    : buildSearchPhrases(anchor.fields, pack);
}
