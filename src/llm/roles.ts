// src/llm/roles.ts
/**
 * LLM 角色注册表（纯配置，无 IO）
 *
 * 引擎按「能力」声明角色（text / vision / web-search），不感知具体模型；
 * 模型名可用环境变量覆盖。默认值取 OpenAI 兼容的常见型号——任何兼容
 * `/chat/completions` 的服务（OpenAI、DeepSeek、vLLM、Ollama 等）都能直接替换。
 *
 * 环境变量：
 * - `LLM_BASE_URL`（默认 https://api.openai.com/v1）
 * - `LLM_API_KEY`
 * - `LLM_TEXT_MODEL` / `LLM_VISION_MODEL` / `LLM_WEB_MODEL`
 */

/** LLM 角色 */
export type LLMRole = 'text' | 'vision' | 'web-search';

/** 角色配置 */
export interface RoleConfig {
  /** 模型名环境变量（未设置时用 defaultModel） */
  modelEnv: string;
  /** 默认模型名 */
  defaultModel: string;
  /** 最大重试次数（429 / 5xx / 网络错误） */
  maxRetries: number;
  /** 请求超时（毫秒） */
  timeout: number;
}

export const ROLE_REGISTRY: Record<LLMRole, RoleConfig> = {
  text: {
    modelEnv: 'LLM_TEXT_MODEL',
    defaultModel: 'gpt-4o-mini',
    maxRetries: 3,
    timeout: 180_000,
  },
  vision: {
    modelEnv: 'LLM_VISION_MODEL',
    defaultModel: 'gpt-4o',
    maxRetries: 3,
    timeout: 180_000,
  },
  'web-search': {
    modelEnv: 'LLM_WEB_MODEL',
    defaultModel: 'gpt-4o-mini',
    maxRetries: 3,
    timeout: 120_000,
  },
};

/** 采样参数 */
export interface SamplingParams {
  /** 显式模型名（只给单点换模型的节点用；缺省按角色环境变量或默认值） */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /**
   * 思考模式开关。部分服务（如 DashScope 兼容模式）用 `enable_thinking` 控制；
   * 本客户端只在请求体里附带该字段（OpenAI 等服务会忽略未知字段）。
   */
  enableThinking?: boolean;
  /** 响应格式（JSON mode 用 { type: 'json_object' }） */
  responseFormat?: { type: 'json_object' | 'text' };
}

/** 角色配置查询（纯函数） */
export function getRoleConfig(role: LLMRole): RoleConfig {
  return ROLE_REGISTRY[role];
}

/** 查询角色当前生效的模型名（显式覆盖 > 环境变量 > 默认值） */
export function getRoleModelName(role: LLMRole, override?: string): string {
  const explicit = override?.trim();
  if (explicit) return explicit;
  const cfg = ROLE_REGISTRY[role];
  return process.env[cfg.modelEnv]?.trim() || cfg.defaultModel;
}

/** 去掉 OpenAI 不认的扩展字段前的开关：`LLM_SEND_THINKING=1` 时附带 enable_thinking */
function shouldSendThinkingFlag(): boolean {
  return process.env.LLM_SEND_THINKING === '1';
}
export { shouldSendThinkingFlag };

/** 环境变量 → 非负整数（允许 0；`Number(x) || 默认值` 会把 0 吃掉） */
function intFromEnv(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

/**
 * "一问一答"类调用的超时与重试覆盖：逐页比对与查询翻译。
 *
 * 角色默认的 180 秒 ×（1 + 3 次重试）是给长输出留的最坏值，但一次卡死的比对因此可以
 * 吃掉 4 × 180 + 3.5 ≈ 12 分钟——在线重放里这就是一条尾巴拖垮整场。这类调用要的是一
 * 段 JSON 判断，60 秒拿不到就是拿不到，早停早止损。
 *
 * 默认 60 秒 × 2 次尝试（`LODESTAR_QUICK_CALL_TIMEOUT_MS` / `LODESTAR_QUICK_CALL_RETRIES`）。
 */
export function quickCallParams(): { timeoutMs: number; maxRetries: number } {
  return {
    timeoutMs: intFromEnv(process.env.LODESTAR_QUICK_CALL_TIMEOUT_MS, 60_000),
    maxRetries: intFromEnv(process.env.LODESTAR_QUICK_CALL_RETRIES, 1),
  };
}
