// src/cli-input.ts
/**
 * 离线命令的命令行输入解析与校验
 *
 * 为什么单独拆成模块：`src/cli.ts` 在文件末尾直接调用 `main()`，测试没法 import 它；
 * 而"参数不对要当场退出 1"这条行为本身需要被测试钉住，所以把纯解析与校验放这里。
 *
 * 只覆盖三个离线命令（demo / verify-quotes / audit）。`live` 的参数由 `src/live.ts`
 * 自己解析，不在这一层拦——两层各写一份白名单迟早漂移。
 *
 * 三条失败关闭的规则，针对的都是"没核到你点名的东西，却退出了 0"：
 * 1. 不认识的选项。拼错的 `--dat` 原先被静默忽略，`audit` 于是去核默认底稿（通常不存在），
 *    打印 "Ledger integrity: OK" 并退出 0——对硬校验来说这是一次假绿。
 * 2. 只写选项、没给值。`--data` 单独出现会被解析成字面量 `"true"`，同样是静默换目录。
 * 3. `--data` 点名了却不存在（或不是目录）。这不是"空底稿"，而是"没核到你点名的那一份"。
 *    默认底稿不存在仍按空底稿处理：文档写明空底稿不算失败，这条不改变。
 */

import fs from 'node:fs';
import path from 'node:path';

/** 选项取值方式：`value` 必须有值；`optional-value` 可以只写选项本身（如 `--report`） */
export type FlagKind = 'value' | 'optional-value';

export interface ParsedArgs {
  command: string;
  flags: Map<string, string>;
  /** 既不是选项、也没被前一个选项吃掉的裸参数（如 `audit .openlodestar-demo`） */
  positionals: string[];
}

/** 三个离线命令各自认识的选项。键是选项名（不带前导 `--`） */
export const OFFLINE_COMMAND_FLAGS: Readonly<Record<string, Readonly<Record<string, FlagKind>>>> = {
  demo: { example: 'value', workdir: 'value', report: 'optional-value', limit: 'value' },
  'verify-quotes': { data: 'value', claim: 'value', limit: 'value' },
  audit: { data: 'value', limit: 'value' },
};

export function parseArgs(argv: string[]): ParsedArgs {
  const [command = '', ...rest] = argv;
  const flags = new Map<string, string>();
  const positionals: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i] ?? '';
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = rest[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags.set(key, next);
      i += 1;
    } else {
      flags.set(key, 'true');
    }
  }
  return { command, flags, positionals };
}

/**
 * 校验离线命令的输入。返回一条人话错误（调用方打印后退出 1），合法时返回 `null`。
 * `live` 等不在白名单里的命令一律放行，由各自的解析器负责。
 */
export function validateOfflineArgs(command: string, args: ParsedArgs): string | null {
  const spec = OFFLINE_COMMAND_FLAGS[command];
  if (!spec) return null;

  if (args.positionals.length > 0) {
    return `Unexpected argument "${args.positionals[0]}": offline commands only take --options (did you mean --data ${args.positionals[0]}?).`;
  }

  const known = Object.keys(spec).map((key) => `--${key}`).join(', ');
  for (const [key, value] of args.flags) {
    const kind = Object.prototype.hasOwnProperty.call(spec, key) ? spec[key] : undefined;
    if (kind === undefined) {
      return `Unknown option --${key} for "${command}". Known options: ${known}.`;
    }
    if (kind === 'value' && value === 'true') {
      return `Option --${key} requires a value (got none).`;
    }
  }

  const data = args.flags.get('data');
  if (data !== undefined && data !== 'true') {
    const resolved = path.resolve(data);
    const exists = fs.existsSync(resolved);
    if (!exists) {
      return `Ledger directory not found: ${resolved} (an explicitly named ledger must exist; only the default ledger may be empty).`;
    }
    if (!fs.statSync(resolved).isDirectory()) {
      return `--data is not a directory: ${resolved}`;
    }
  }

  return null;
}
