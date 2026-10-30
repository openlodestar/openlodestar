// src/utils/browser-unavailable-error.ts
/**
 * "浏览器不可用"可识别错误
 *
 * 契约：抓取链在"需要浏览器"且
 * "浏览器不可用"（找不到浏览器 / 启动被拒 / 连接失败）时，必须抛出本错误，
 * 与普通抓取失败（网络超时、反爬拦截、配额耗尽）严格区分。
 *
 * 这条契约有三个后果：
 * 1. 触发它的任务**不消耗抓取重试预算**（重试不会让它变得可行）；
 * 2. 它向上路由到"暂停待浏览器"而不是"失败"；
 * 3. 它让日志/管理界面能直接回答"这次是不是因为没浏览器"。
 *
 * 判定边界：
 * - 走到浏览器策略 + 浏览器启动/连接失败 → 抛本错误；
 * - 走到浏览器策略 + 页面被反爬拦截或超时 → **不抛**（真抓取失败，正常计数）；
 * - 未走到浏览器策略就失败（fetch 超时、配额耗尽）→ **不抛**。
 *
 */

/** 错误码（跨进程/落库字符串判定用） */
export const BROWSER_UNAVAILABLE_CODE = 'BROWSER_UNAVAILABLE';

/**
 * 浏览器不可用的具体原因
 *
 * - `not_installed`：环境里根本没有可用的浏览器二进制（线上物理禁用的必然结果）
 * - `launch_failed`：有候选二进制但启动/连接被拒（含浏览器进程崩溃）
 */
export type BrowserUnavailableReason = 'not_installed' | 'launch_failed';

/**
 * 浏览器不可用错误（可识别错误类型）
 *
 * 用独立子类而非"带标记的普通 Error"，是为了让 `instanceof` 与 `code` 双重
 * 判定同时可用：子类保证类型收窄，`code` 保证跨进程/序列化边界仍可识别。
 */
export class BrowserUnavailableError extends Error {
  readonly code = BROWSER_UNAVAILABLE_CODE;
  readonly reason: BrowserUnavailableReason;

  constructor(
    reason: BrowserUnavailableReason,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'BrowserUnavailableError';
    this.reason = reason;
  }
}

/** 人类可读的暂停原因（落库到暂停标记 + 供界面展示） */
export function describeBrowserUnavailable(error: BrowserUnavailableError): string {
  return error.reason === 'not_installed'
    ? '需要浏览器，当前环境不可用：未找到可用的浏览器'
    : '需要浏览器，当前环境不可用：浏览器启动失败';
}

/**
 * 类型守卫
 *
 * 不只用 `instanceof`：错误可能被 `cause` 包装、跨模块重复实例化或经
 * JSON 边界传递，此时以 `code` 兜底识别，保证"可识别"这条契约不因包装而失效。
 */
export function isBrowserUnavailableError(error: unknown): error is BrowserUnavailableError {
  if (error instanceof BrowserUnavailableError) {
    return true;
  }
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const candidate = error as { code?: unknown; name?: unknown };
  return candidate.code === BROWSER_UNAVAILABLE_CODE;
}

/**
 * 从任意错误中提取"浏览器不可用"错误（含 cause 链一层）
 *
 * 抓取链的异常常被包一层再抛（如 withTimeout 的 message 包装已丢失类型），
 * 因此同时检查错误自身与其 cause，避免漏判导致任务被误记为真失败。
 */
export function findBrowserUnavailableError(error: unknown): BrowserUnavailableError | null {
  if (isBrowserUnavailableError(error)) {
    return error;
  }
  if (typeof error === 'object' && error !== null && 'cause' in error) {
    const cause = (error as { cause?: unknown }).cause;
    if (isBrowserUnavailableError(cause)) {
      return cause;
    }
  }
  return null;
}