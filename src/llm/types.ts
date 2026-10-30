// src/llm/types.ts
/**
 * LLM 调用层公共消息类型
 *
 * 形态与现有节点手写的消息字面量对齐（{ role, content: [{ type, text / image_url }] }），
 * 节点迁移时基本零改动。调用方零依赖 LangChain 类型。
 */

/** 多模态内容块 */
export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

/** 聊天消息 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

/** LLM 调用消息：纯文本字符串或消息数组 */
export type LLMMessages = string | ChatMessage[];

/** token 用量 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}
