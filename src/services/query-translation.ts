// src/services/query-translation.ts
/**
 * 双语查询对（把一批搜索查询整条翻译到另一种语言）
 *
 * 为什么需要它：只改搜索地区参数影响的是排名偏好；查询词本身不换语言，
 * 就永远覆盖不到另一种语言的语料面。这里做的事很窄——一次调用翻一批，
 * 逐位对应，只翻查询面本身，不扩写、不补解释。
 *
 * 降级纪律（不造假）：
 * - 某个位置解析不出译文 → 该位置回填**原文**；
 * - 整体失败（模型抛错 / 解析不出数组）→ 返回空列表 + `failed: true`，
 *   上层只用源轨，检索不因翻译失败而失败。
 */

import { createLogger } from '@src/utils/logger';
import { extractJsonArray, invokeLLM, type ChatMessage } from '@src/llm';
import { getSharedLoader } from '@src/prompts';

/** 目标语言桶（与 text-language 的 LanguageClass 同值域） */
export type TranslationTarget = 'en' | 'zh';

/** 翻译结果（与输入等长、逐位对应） */
export interface QueryTranslationResult {
  queries: string[];
  cacheHit: boolean;
  model: string;
  /** 提供方整体失败（模型异常/解析不出）——上层必须退回单轨 */
  failed: boolean;
}

const PROMPT_NAME = 'query-translation';
const MAX_QUERIES_PER_CALL = 20;
const MAX_TRANSLATION_TOKENS = 2000;

/**
 * 把一批查询整条翻译到目标语言（一次调用翻一批）。
 *
 * @param queries 源轨查询（顺序即输出顺序）
 * @param target 目标语言桶
 */
export async function translateQueries(
  queries: readonly string[],
  target: TranslationTarget,
  options: { logger?: ReturnType<typeof createLogger> } = {},
): Promise<QueryTranslationResult> {
  const log = options.logger ?? createLogger({ prefix: '[QueryTranslation] ' });
  const source = queries
    .map((query) => query.trim())
    .filter((query) => query !== '')
    .slice(0, MAX_QUERIES_PER_CALL);

  if (source.length === 0) {
    return { queries: [], cacheHit: false, model: '', failed: false };
  }

  const loader = getSharedLoader();
  const prompt = loader.render(PROMPT_NAME, {
    target_language: target === 'en' ? 'English' : 'Simplified Chinese',
    queries_json: JSON.stringify(source),
  });
  const llmParams = loader.getLLMParams(PROMPT_NAME);
  const messages: ChatMessage[] = [{ role: 'user', content: prompt }];

  try {
    const result = await invokeLLM('text', messages, {
      temperature: llmParams.temperature,
      maxTokens: MAX_TRANSLATION_TOKENS,
      enableThinking: false,
    });
    const parsed = extractJsonArray(result.content);
    const translated = source.map((original, index) => {
      const candidate = parsed[index];
      return typeof candidate === 'string' && candidate.trim() !== '' ? candidate.trim() : original;
    });
    return { queries: translated, cacheHit: result.isCacheHit, model: result.model, failed: false };
  } catch (error) {
    log.dev.warn('查询翻译失败，反向轨置空并退回单轨', error);
    return { queries: [], cacheHit: false, model: '', failed: true };
  }
}
