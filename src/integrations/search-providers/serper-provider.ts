// src/integrations/search-providers/serper-provider.ts
/**
 * Serper 搜索提供者（Google 直代理，site: 与引号短语完全支持）
 *
 * 环境变量：
 * - `SERPER_API_KEY`（必填）
 * - `SERPER_BASE_URL`（可选，默认 https://google.serper.dev）
 *
 * 文档：https://serper.dev/
 */

import type { SearchProvider, SearchProviderResult, SearchOptions, SearchResultItem } from './types';

interface SerperOrganicResult {
  title: string;
  link: string;
  snippet: string;
  position?: number;
}

interface SerperResponse {
  organic?: SerperOrganicResult[];
}

/** 语言参数 → Google 地区参数（只影响排名偏好，不改变查询词） */
function glOf(language: string | undefined): string {
  if (!language) return 'us';
  return language.toLowerCase().startsWith('zh') ? 'cn' : 'us';
}

export class SerperProvider implements SearchProvider {
  readonly name = 'serper';
  readonly capabilities = { siteOperator: true as const };

  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor() {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      throw new Error('缺少 SERPER_API_KEY：检索证据需要搜索提供者的密钥（demo 命令不需要）。');
    }
    this.apiKey = apiKey;
    this.baseUrl = process.env.SERPER_BASE_URL || 'https://google.serper.dev';
  }

  async search(queries: string[], options?: SearchOptions): Promise<SearchProviderResult> {
    const numResults = options?.numResults || 10;
    const results: SearchResultItem[] = [];

    const searchPromises = queries.map(async (query, queryIndex) => {
      const response = await fetch(`${this.baseUrl}/search`, {
        method: 'POST',
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: query,
          num: numResults,
          gl: glOf(options?.language),
          hl: options?.language || 'zh-cn',
        }),
      });

      if (!response.ok) {
        throw new Error(`Serper API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as SerperResponse;
      return (data.organic || []).map((item, idx) => ({
        url: item.link,
        title: item.title || '',
        snippet: item.snippet || '',
        position: item.position || idx + 1,
        queryIndex,
      }));
    });

    const queryResults = await Promise.all(searchPromises);
    for (const queryResult of queryResults) results.push(...queryResult);

    return { results, rawResponse: queryResults };
  }
}
