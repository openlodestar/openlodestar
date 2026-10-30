// src/lodestar/intake/prompts.ts
/**
 * Lodestar 提示词渲染（纯函数层：读 YAML 模板 + 填变量，不发请求）
 *
 * 与宿主系统同构：模板在 `src/prompts/lodestar/base/`，经 PromptLoader 渲染，
 * 路径按模块位置解析（红线：不依赖启动目录）。
 */

import { getLodestarLoader } from '@src/prompts';
import { keyFieldKeysOf, type DomainPack, type FieldSpec } from '../packs/pack';

/** 枚举式提问的单轮提示词 */
export function renderEnumeration(pack: DomainPack, question: string): string {
  return getLodestarLoader().render('enumeration-answer', {
    pack_label: pack.label,
    question,
    column_keys: pack
      .fields()
      .map((f) => `「${f.label}」`)
      .join('、'),
    enabledRules: ['abstention_first', 'one_row_one_event', 'no_inferred_values', 'specific_as_you_recall', 'original_wording'],
  });
}

/** 检索增强提取的单轮提示词（检索增强兜底：同一份搜索资料复问多轮，行级一致才过线） */
export function renderEnumerationExtract(pack: DomainPack, question: string, context: string): string {
  return getLodestarLoader().render('enumeration-extract', {
    pack_label: pack.label,
    question,
    context,
    column_keys: pack
      .fields()
      .map((f) => `「${f.label}」`)
      .join('、'),
    enabledRules: ['extract_only_from_material', 'no_unconfirmed_values', 'one_row_one_event', 'no_number_fields', 'original_wording'],
  });
}

/** 来源坐标的入口供给提问（先回答问题、再列来源；网址可留空） */
export function renderSourceEnumeration(pack: DomainPack, question: string): string {
  return getLodestarLoader().render('source-enumeration', {
    pack_label: pack.sourceLabel ?? pack.label,
    question,
    column_keys: (pack.sourceFields?.() ?? [])
      .map((field) => `「${field.label}」`)
      .join('、'),
    enabledRules: [
      'recall_first',
      'url_must_be_recalled',
      'sources_only',
      'entry_preferred',
      'topic_is_the_object',
      'one_row_one_source',
      'original_wording',
    ],
  });
}

/**
 * 来源供给的换措辞复问框架（域无关）。
 *
 * 首轮原样提问，让模型按自己的理解自由回答；后续轮次只补一句"把来源写出来"，
 * 不再像旧版那样每轮都强调"入口页、想不起来就空数组"——那种压力会让模型整轮弃权。
 */
const SOURCE_PARAPHRASE_FRAMES = [
  '{query}',
  '{query}\n请逐条写出你依据的来源；记得机构就写机构，记得页面地址就附上，不记得网址就留空。',
  '请从你掌握的资料出发，回答这个问题并给出来源依据：{query}\n想起多少写多少，不必凑数；一条都想不起就输出空数组 []。',
];

export function sourcePhrasings(question: string, runCount: number): string[] {
  if (runCount <= 0) return [];
  const out: string[] = [];
  for (let i = 0; i < runCount; i++) {
    out.push(SOURCE_PARAPHRASE_FRAMES[i % SOURCE_PARAPHRASE_FRAMES.length]!.replace('{query}', question));
  }
  return out;
}

/** 具体化追问提示词（missing 为该记录里缺值的关键字段） */
export function renderConcretization(pack: DomainPack, records: Array<{ matchKey: string; fields: Record<string, string | null> }>, missing: FieldSpec[]): string {
  return getLodestarLoader().render('concretization', {
    pack_label: pack.label,
    records: JSON.stringify(
      records.map((r) => ({ matchKey: r.matchKey, ...r.fields })),
      null,
      2,
    ),
    ask: `${pack.concretizationAsk(missing)}\n\n需要补全的字段：${missing.map((f) => f.label).join('、')}`,
    enabledRules: ['blank_is_allowed', 'no_deriving', 'keep_identity'],
  });
}

/** 逐源比对提示词（一条断言 × 一个页面 = 一次调用） */
export function renderClaimCompare(input: {
  pack: DomainPack;
  claimText: string;
  url: string;
  fetchedAt: string;
  pageText: string;
  fieldKey: string | null;
}): string {
  return getLodestarLoader().render('claim-compare', {
    claim: input.claimText,
    rules: input.pack.judgementRules(input.fieldKey),
    url: input.url,
    fetched_at: input.fetchedAt,
    page_text: input.pageText,
    rules_extra: input.pack.cooccurrenceRule(),
    enabledRules: [
      'quote_verbatim',
      'page_content_only',
      'irrelevant_is_a_real_answer',
      'refuted_needs_explicit_conflict',
      'content_weight',
    ],
  });
}

/** 原子化 / decompose 重入提示词 */
export function renderClaimAtomize(rawText: string): string {
  return getLodestarLoader().render('claim-atomize', { raw_text: rawText });
}

/** 关键字段清单（提问模板与截断判据共用一份，避免两处各写一遍） */
export function keyFieldSpecs(pack: DomainPack): FieldSpec[] {
  const keys = new Set(keyFieldKeysOf(pack.fields()));
  return pack.fields().filter((f) => keys.has(f.key));
}
