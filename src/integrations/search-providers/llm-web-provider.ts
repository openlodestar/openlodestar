// src/integrations/search-providers/llm-web-provider.ts
/**
 * LLM 自带联网搜索的提供者（缺省）
 *
 * 为什么把它做进核心：在线链路要能「零额外账号」跑通——配好 LLM_API_KEY 就有检索，
 * 按次计费的搜索 API（serper 等）退成可选扩展。
 *
 * 能力声明：`siteOperator: false`。`site:` 定向查询由检索层跳过并记入 skippedQueries，
 * 不降级成普通词（降级会悄悄改变查询语义）。
 *
 * 请求体：不同厂商的联网开关字段不同，用 `OPENLODESTAR_LLM_SEARCH_BODY` 传一段 JSON
 * 合并进 `/chat/completions` 请求体。默认 `{"enable_search":true}`（DashScope 兼容模式）。
 * OpenAI 原生搜索模型示例：`LLM_WEB_MODEL=gpt-4o-search-preview`、
 * `OPENLODESTAR_LLM_SEARCH_BODY='{"web_search_options":{}}'`（该接口不接受 enable_search）。
 *
 * 错误语义：解析不出结果抛 `SearchProviderParseError`，检索层把该断言记 failed。
 * 绝不把「模型没按格式回答」伪装成「没搜到」——后者会变成一条"世界没有证据"的结论。
 */

import { extractJsonArray, invokeLLM } from '@src/llm';
import { SearchProviderCallError, SearchProviderConfigError, SearchProviderParseError } from './errors';
import type { SearchProvider, SearchOptions, SearchProviderResult, SearchResultItem } from './types';

/** 默认请求体扩展：DashScope 兼容模式的联网开关 */
const DEFAULT_BODY_EXTENSION: Record<string, unknown> = { enable_search: true };

/**
 * 读取请求体扩展（构造时校验：配置写坏在建立提供者时就报错，而不是每条查询各报一次）。
 *
 * @throws SearchProviderConfigError 环境变量不是合法 JSON 对象
 */
export function llmSearchBodyFromEnv(): Record<string, unknown> {
  const raw = process.env.OPENLODESTAR_LLM_SEARCH_BODY;
  if (raw === undefined || raw.trim() === '') return { ...DEFAULT_BODY_EXTENSION };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new SearchProviderConfigError(
      `OPENLODESTAR_LLM_SEARCH_BODY 不是合法 JSON：${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new SearchProviderConfigError('OPENLODESTAR_LLM_SEARCH_BODY 必须是 JSON 对象（会逐字段合并进请求体）');
  }
  return { ...(parsed as Record<string, unknown>) };
}

/** 让模型用联网搜索找页面的提示词（要求只回 JSON 数组，宁缺毋滥） */
export function buildLLMWebSearchPrompt(query: string, numResults: number): string {
  return [
    `Use your web search capability to find web pages relevant to this query: ${query}`,
    `Return at most ${numResults} results, best first, as a JSON array.`,
    'Each item must be {"url": "...", "title": "...", "snippet": "..."} where url is an absolute http(s) URL.',
    'Only include pages that actually appeared in search results; never invent or guess URLs.',
    'If nothing relevant was found, return [] exactly.',
    'Output the JSON array only — no prose, no markdown code fence.',
  ].join('\n');
}

/** 单条模型回答 → 结果项；url 不是 http(s) 的条目直接丢（返回 null） */
function toResultItem(item: unknown, position: number, queryIndex: number): SearchResultItem | null {
  if (item === null || typeof item !== 'object') return null;
  const record = item as { url?: unknown; title?: unknown; snippet?: unknown };
  const url = typeof record.url === 'string' ? record.url.trim() : '';
  if (!/^https?:\/\//i.test(url)) return null;
  return {
    url,
    title: typeof record.title === 'string' ? record.title : '',
    snippet: typeof record.snippet === 'string' ? record.snippet : '',
    position,
    queryIndex,
  };
}

export class LlmWebSearchProvider implements SearchProvider {
  readonly name = 'llm-web';
  readonly capabilities = { siteOperator: false as const };

  /** 合并进每次请求体的厂商扩展字段（构造时从 env 解析一次） */
  private readonly extraBody: Record<string, unknown>;

  constructor() {
    if (!process.env.LLM_API_KEY?.trim()) {
      throw new SearchProviderConfigError(
        'llm-web 需要 LLM_API_KEY：它用模型自带的联网搜索找页面。' +
          '或者改用独立搜索 API（SEARCH_PROVIDER=serper 并配 SERPER_API_KEY）。',
      );
    }
    this.extraBody = llmSearchBodyFromEnv();
  }

  async search(queries: string[], options?: SearchOptions): Promise<SearchProviderResult> {
    // 空查询集短路：不发请求、不花钱（契约条款之一）
    if (queries.length === 0) return { results: [] };
    const numResults = options?.numResults ?? 10;

    const answers = await Promise.all(
      queries.map(async (query, queryIndex) => {
        try {
          const response = await invokeLLM(
            'web-search',
            [{ role: 'user', content: buildLLMWebSearchPrompt(query, numResults) }],
            { temperature: 0, extraBody: this.extraBody },
          );
          return { query, queryIndex, content: response.content };
        } catch (error) {
          throw new SearchProviderCallError(
            `llm-web 检索失败（${query}）：${error instanceof Error ? error.message : String(error)}`,
            { cause: error },
          );
        }
      }),
    );

    const results: SearchResultItem[] = [];
    for (const { query, queryIndex, content } of answers) {
      let raw: unknown[];
      try {
        raw = extractJsonArray(content);
      } catch (error) {
        throw new SearchProviderParseError(
          `llm-web 对查询「${query}」的回答不是 JSON 数组：` +
            `${error instanceof Error ? error.message : String(error)}；原文前 200 字：${content.slice(0, 200)}`,
        );
      }
      const items: SearchResultItem[] = [];
      for (const item of raw) {
        const parsed = toResultItem(item, items.length + 1, queryIndex);
        if (parsed) items.push(parsed);
      }
      // 非空数组却一条合法链接都没有 = 模型在编或格式跑偏：抛错，不当作"没搜到"
      if (raw.length > 0 && items.length === 0) {
        throw new SearchProviderParseError(
          `llm-web 对查询「${query}」返回 ${raw.length} 条结果，但没有一条带 http(s) 链接；` +
            `原文前 200 字：${content.slice(0, 200)}`,
        );
      }
      results.push(...items.slice(0, numResults));
    }

    return { results };
  }
}
