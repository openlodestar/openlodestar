// src/integrations/search-providers/serper-provider.ts
/**
 * Serper 搜索提供者（Google 直代理，site: 与引号短语完全支持）
 *
 * 环境变量：
 * - `SERPER_API_KEY`（必填）
 * - `SERPER_BASE_URL`（可选，默认 https://google.serper.dev）
 * - `SERPER_TIMEOUT_MS`（可选，默认 12000）单次检索请求的超时
 * - `SERPER_RETRIES`（可选，默认 1）连接类失败的瞬时重试次数（不含首次；0 = 关掉）
 * - `SERPER_RETRY_BACKOFF_MS`（可选，默认 500）重试退避基数，按 2 的幂递增
 *
 * 为什么要自己写超时：不设 `signal` 时，一次连不上的请求只能等运行时自带的连接超时
 * （本机实测约 10.7 秒），而"连接建立了对面却不回数据"的挂起只有运行时默认的 300 秒
 * 兜底——一条坏查询就能吃掉五分钟，且整条检索链没有任何一处会打断它。
 *
 * 文档：https://serper.dev/
 */

import type { SearchProvider, SearchProviderResult, SearchOptions, SearchResultItem } from './types';
import { SearchProviderCallError, SearchProviderConfigError } from './errors';

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

/** 环境变量 → 整数，允许 0（`Number(x) || 默认值` 会把 0 吃掉，所以单独写） */
function intFromEnv(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

/**
 * 是不是"根本没走到 HTTP"那一类失败（连接被拒、DNS 挂了、超时中止）。
 *
 * 只有这类值得重试：一次网络抖动不该让整条断言作废。HTTP 状态码错误**不在**此列——
 * Serper 按请求计费，429/5xx 时重试可能再吃一次额度，而且对面正在限流时重试只会加重。
 */
function isTransientNetworkError(error: Error): boolean {
  if (error.name === 'TimeoutError' || error.name === 'AbortError') return true;
  return /fetch failed|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|UND_ERR_/i.test(error.message);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export class SerperProvider implements SearchProvider {
  readonly name = 'serper';
  readonly capabilities = { siteOperator: true as const };

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly backoffMs: number;

  constructor() {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      throw new SearchProviderConfigError(
        '缺少 SERPER_API_KEY：检索证据需要搜索提供者的密钥（demo 命令不需要；或改用 SEARCH_PROVIDER=llm-web 走模型自带联网搜索）。',
      );
    }
    this.apiKey = apiKey;
    this.baseUrl = process.env.SERPER_BASE_URL || 'https://google.serper.dev';
    this.timeoutMs = intFromEnv(process.env.SERPER_TIMEOUT_MS, 12_000);
    this.retries = intFromEnv(process.env.SERPER_RETRIES, 1);
    this.backoffMs = intFromEnv(process.env.SERPER_RETRY_BACKOFF_MS, 500);
  }

  /** 发一次检索请求；连接类失败按 `retries` 重试，其余原样抛出（上层据此分 infra 失败） */
  private async postSearch(payload: unknown): Promise<SerperResponse> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      try {
        const response = await fetch(`${this.baseUrl}/search`, {
          method: 'POST',
          headers: {
            'X-API-KEY': this.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        if (!response.ok) {
          throw new SearchProviderCallError(`Serper API error: ${response.status} ${response.statusText}`);
        }

        return (await response.json()) as SerperResponse;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        if (!isTransientNetworkError(err) || attempt === this.retries) throw err;
        lastError = err;
        await sleep(this.backoffMs * 2 ** attempt);
      }
    }
    throw lastError ?? new SearchProviderCallError('Serper 检索失败：重试次数用尽');
  }

  async search(queries: string[], options?: SearchOptions): Promise<SearchProviderResult> {
    const numResults = options?.numResults || 10;
    const results: SearchResultItem[] = [];

    const searchPromises = queries.map(async (query, queryIndex) => {
      const data = await this.postSearch({
        q: query,
        num: numResults,
        gl: glOf(options?.language),
        hl: options?.language || 'zh-cn',
      });

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
