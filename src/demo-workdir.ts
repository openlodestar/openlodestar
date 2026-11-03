// src/demo-workdir.ts
/**
 * demo 工作副本的重置规则
 *
 * 单独成模块只为一件事：让"重置不许碰 live 产物"这条能被测试钉住。
 * `src/cli.ts` 在导入时就会执行 `main()`，测试没法安全 import 它。
 *
 * 为什么要有这条：默认示例（porcelain）的工作目录是 `.openlodestar-demo` **根**，
 * 而在线实验的产物写在它下面的 `.openlodestar-demo/live/<runId>/<mode>/`。
 * 在线那一份是花真钱换来的、且明确不可复现（搜索排名、页面可达性随时会变）——
 * 一次免费的离线 demo 不该把它抹掉。2026-11-01 就发生过一次：为补一份读数以免费
 * 命令 `pnpm run demo`，两场付费重放的 trace 与底稿连同目录一起被递归删除。
 */

import fs from 'node:fs/promises';
import path from 'node:path';

/** 在线实验产物的目录名（demo 重置时必须跳过） */
export const LIVE_RUNS_DIR_NAME = 'live';

/**
 * 清空 demo 工作副本，但保留 `live/`。
 *
 * @returns 被删除的顶层条目名（供日志与测试断言用；不含被保留的那些）
 */
export async function resetDemoWorkDir(workDir: string): Promise<string[]> {
  await fs.mkdir(workDir, { recursive: true });
  const removed: string[] = [];
  for (const entry of await fs.readdir(workDir)) {
    if (entry === LIVE_RUNS_DIR_NAME) continue;
    await fs.rm(path.join(workDir, entry), { recursive: true, force: true });
    removed.push(entry);
  }
  return removed;
}
