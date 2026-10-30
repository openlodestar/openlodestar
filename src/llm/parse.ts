// src/llm/parse.ts
/**
 * 统一 JSON 提取（收敛各节点散落的三种提取写法）
 *
 * 提取策略：剥 ```json 围栏 → 定界符切片（对象取首个 { 到末个 }，
 * 数组取首个 [ 到末个 ]）。LLM 在 JSON 前后输出说明文字时仍可正确提取。
 *
 */

/** JSON 提取/解析失败（携带原始内容便于排查） */
export class JsonParseError extends Error {
  constructor(message: string, public readonly rawContent: string) {
    super(message);
    this.name = 'JsonParseError';
  }
}

/** 剥离 Markdown 代码围栏（```json ... ```） */
function stripCodeFence(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith('```')) {
    // 去掉首行围栏（可能带语言标注）与末行围栏
    const firstNewline = trimmed.indexOf('\n');
    if (firstNewline !== -1) {
      const body = trimmed.slice(firstNewline + 1);
      const lastFence = body.lastIndexOf('```');
      return (lastFence !== -1 ? body.slice(0, lastFence) : body).trim();
    }
  }
  return trimmed;
}

/**
 * 提取 JSON 对象：剥围栏 → 首个 { 到末个 }
 * @throws JsonParseError 提取失败或 JSON.parse 失败
 */
export function extractJson(content: string): Record<string, unknown> {
  const cleaned = stripCodeFence(content);
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new JsonParseError('响应中未找到 JSON 对象（无 { } 定界）', content);
  }
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new JsonParseError('提取到的内容不是 JSON 对象', content);
    }
    return parsed;
  } catch (err) {
    if (err instanceof JsonParseError) throw err;
    throw new JsonParseError(`JSON 对象解析失败: ${(err as Error).message}`, content);
  }
}

/**
 * 提取 JSON 数组：剥围栏 → 首个 [ 到末个 ]
 * @throws JsonParseError 提取失败或 JSON.parse 失败
 */
export function extractJsonArray(content: string): unknown[] {
  const cleaned = stripCodeFence(content);
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) {
    throw new JsonParseError('响应中未找到 JSON 数组（无 [ ] 定界）', content);
  }
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    if (!Array.isArray(parsed)) {
      throw new JsonParseError('提取到的内容不是 JSON 数组', content);
    }
    return parsed;
  } catch (err) {
    if (err instanceof JsonParseError) throw err;
    throw new JsonParseError(`JSON 数组解析失败: ${(err as Error).message}`, content);
  }
}

/**
 * 提取 + Schema 校验一步到位（推荐节点使用）
 *
 * @param content LLM 响应文本
 * @param schema zod schema（满足 { parse(value: unknown): T } 形态即可）
 * @throws JsonParseError 提取/解析失败；schema.parse 抛出的校验错误原样透传
 */
export function extractJsonWith<T>(
  content: string,
  schema: { parse: (value: unknown) => T },
): T {
  const obj = extractJson(content);
  return schema.parse(obj);
}
