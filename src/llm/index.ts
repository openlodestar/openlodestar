// src/llm/index.ts
/**
 * LLM 调用层（OpenAI 兼容 `/chat/completions`）
 *
 * 引擎只依赖这一个入口：`invokeLLM(role, messages, params)`。
 * 没有密钥时调用会抛错——离线测试全部用假件（vi.mock），demo 不需要模型。
 *
 * @example
 * ```ts
 * const { content } = await invokeLLM('text', [{ role: 'user', content: '…' }], { temperature: 0 });
 * ```
 */

import { ROLE_REGISTRY, getRoleModelName, shouldSendThinkingFlag, type LLMRole } from './roles';
import type { ChatMessage, LLMMessages, TokenUsage } from './types';

export { ROLE_REGISTRY, getRoleConfig, getRoleModelName } from './roles';
export type { LLMRole, RoleConfig, SamplingParams } from './roles';
export { extractJson, extractJsonArray, extractJsonWith, JsonParseError } from './parse';
export type { ChatMessage, ContentPart, LLMMessages, TokenUsage } from './types';

/** 调用参数 */
export interface InvokeParams {
  /** 显式模型名（覆盖角色默认） */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** 见 SamplingParams.enableThinking */
  enableThinking?: boolean;
  responseFormat?: { type: 'json_object' | 'text' };
}

/** 调用结果 */
export interface InvokeResult {
  content: string;
  isCacheHit: boolean;
  model: string;
  tokenUsage?: TokenUsage;
}

interface OpenAIChoice {
  message?: { content?: string | Array<{ type?: string; text?: string }> };
}

interface OpenAIResponse {
  choices?: OpenAIChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  error?: { message?: string };
}

function baseUrl(): string {
  return (process.env.LLM_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
}

function apiKey(): string {
  const key = process.env.LLM_API_KEY?.trim();
  if (!key) {
    throw new Error(
      '缺少 LLM_API_KEY：设置环境变量指向任意 OpenAI 兼容服务的密钥后再调用模型（demo 命令不需要）。',
    );
  }
  return key;
}

function extractContent(payload: OpenAIResponse): string {
  const choice = payload.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part?.text === 'string' ? part.text : '')).join('');
  }
  return '';
}

function toMessages(messages: LLMMessages): ChatMessage[] {
  return typeof messages === 'string' ? [{ role: 'user', content: messages }] : messages;
}

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 统一 LLM 调用入口。
 *
 * @param role 角色（text / vision / web-search）
 * @param messages 字符串或 OpenAI 兼容消息数组（支持多模态内容块）
 * @param params 采样参数
 */
export async function invokeLLM(
  role: LLMRole,
  messages: LLMMessages,
  params?: InvokeParams,
): Promise<InvokeResult> {
  const cfg = ROLE_REGISTRY[role];
  const model = getRoleModelName(role, params?.model);
  const body: Record<string, unknown> = {
    model,
    messages: toMessages(messages),
  };
  if (params?.temperature !== undefined) body.temperature = params.temperature;
  if (params?.maxTokens !== undefined) body.max_tokens = params.maxTokens;
  if (params?.responseFormat !== undefined) body.response_format = params.responseFormat;
  if (params?.enableThinking !== undefined && shouldSendThinkingFlag()) {
    body.enable_thinking = params.enableThinking;
  }

  const url = `${baseUrl()}/chat/completions`;
  const key = apiKey();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(cfg.timeout),
      });
      const text = await response.text();
      if (!response.ok) {
        const retryable = RETRYABLE_STATUS.has(response.status);
        lastError = new Error(`LLM HTTP ${response.status}: ${text.slice(0, 500)}`);
        if (retryable && attempt < cfg.maxRetries) {
          await sleep(500 * 2 ** attempt);
          continue;
        }
        throw lastError;
      }
      let payload: OpenAIResponse;
      try {
        payload = JSON.parse(text) as OpenAIResponse;
      } catch {
        throw new Error(`LLM 返回非 JSON 响应：${text.slice(0, 200)}`);
      }
      if (payload.error?.message) {
        throw new Error(`LLM 服务返回错误：${payload.error.message}`);
      }
      const usage = payload.usage;
      const tokenUsage: TokenUsage | undefined = usage
        ? {
            promptTokens: usage.prompt_tokens ?? 0,
            completionTokens: usage.completion_tokens ?? 0,
            totalTokens: usage.total_tokens ?? 0,
          }
        : undefined;
      return { content: extractContent(payload), isCacheHit: false, model, ...(tokenUsage ? { tokenUsage } : {}) };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const name = lastError.name;
      const retryable = name === 'TimeoutError' || name === 'AbortError' || /fetch failed|ECONNRESET|ETIMEDOUT/.test(lastError.message);
      if (retryable && attempt < cfg.maxRetries) {
        await sleep(500 * 2 ** attempt);
        continue;
      }
      throw lastError;
    }
  }
  throw lastError ?? new Error('LLM 调用失败');
}
