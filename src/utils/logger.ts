// src/utils/logger.ts
/**
 * 最小日志器
 *
 * 引擎只需要两档：`debug`（过程读数，默认不打印）与 `warn`（可降级的异常）。
 * 输出走 stderr，避免污染 CLI 的 stdout 结果。
 *
 * 环境变量：`OPENLODESTAR_LOG=debug|warn|silent`，默认 `warn`。
 */

export type LogLevel = 'debug' | 'warn' | 'silent';

export interface LodestarLogger {
  debug(message: string, ...rest: unknown[]): void;
  warn(message: string, ...rest: unknown[]): void;
  /** 与 debug 同名，保留宿主系统调用形态（log.dev.debug） */
  readonly dev: { debug(message: string, ...rest: unknown[]): void; warn(message: string, ...rest: unknown[]): void };
}

function currentLevel(): LogLevel {
  const raw = (process.env.OPENLODESTAR_LOG ?? 'warn').toLowerCase();
  return raw === 'debug' || raw === 'silent' ? raw : 'warn';
}

/**
 * 创建日志器。
 *
 * @param options.prefix 每条日志的前缀（通常带模块名）
 */
export function createLogger(options: { prefix?: string } = {}): LodestarLogger {
  const prefix = options.prefix ?? '';
  const emit = (level: 'debug' | 'warn', message: string, rest: unknown[]): void => {
    const configured = currentLevel();
    if (configured === 'silent') return;
    if (level === 'debug' && configured !== 'debug') return;
    const line = `${prefix}${message}`;
    if (level === 'warn') console.warn(line, ...rest);
    else console.error(line, ...rest);
  };
  const logger: LodestarLogger = {
    debug: (message, ...rest) => emit('debug', message, rest),
    warn: (message, ...rest) => emit('warn', message, rest),
    get dev() {
      return logger;
    },
  };
  return logger;
}
