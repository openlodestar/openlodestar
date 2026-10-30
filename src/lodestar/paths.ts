// src/lodestar/paths.ts
/**
 * 底稿目录与路径解析
 *
 * 路径一律按**当前模块真实位置**派生（禁止 `process.cwd()`）：本仓库是 ESM，
 * 从哪个目录启动都不该改变读写落点。
 *
 * 默认底稿目录是包根下的 `lodestar/`（六份 .jsonl + 证据正文快照）；
 * 整目录可用 `OPENLODESTAR_DATA_DIR` 覆盖（相对路径按包根解析）。
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LodestarCategory } from './types';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

/** 包根（src/lodestar/paths.ts → 上两级） */
export const PACKAGE_ROOT = path.resolve(moduleDir, '..', '..');

function resolveFromRoot(value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(PACKAGE_ROOT, value);
}

const dataDirFromEnv = process.env.OPENLODESTAR_DATA_DIR?.trim();

/** 底稿目录：六份 .jsonl + 证据正文快照（测试用适配器构造参数指向临时目录） */
export const LODESTAR_DATA_DIR = dataDirFromEnv ? resolveFromRoot(dataDirFromEnv) : path.join(PACKAGE_ROOT, 'lodestar');

/** 证据正文快照（引文逐字命中的比对对象，一行一文件） */
export const LODESTAR_SNAPSHOT_DIR = path.join(LODESTAR_DATA_DIR, 'snapshots');

/** 某类别的底稿文件绝对路径 */
export function categoryFile(category: LodestarCategory, baseDir: string = LODESTAR_DATA_DIR): string {
  return path.join(baseDir, `${category}.jsonl`);
}

/**
 * 坐标导出文件路径（下游只读它，缺失即空集）。
 *
 * `OPENLODESTAR_ANCHORS_FILE` 可覆盖（相对路径按包根解析），
 * 默认 `<数据目录>/anchors.jsonl`。
 */
export function anchorsFilePath(): string {
  const fromEnv = process.env.OPENLODESTAR_ANCHORS_FILE?.trim();
  if (fromEnv) return resolveFromRoot(fromEnv);
  return categoryFile('anchors');
}

/** 快照文件引用（写进 evidence.snapshotRef，相对底稿目录，可移植） */
export function snapshotRefFor(evidenceId: string): string {
  return path.posix.join('snapshots', `${evidenceId}.html`);
}

/** 快照引用 → 绝对路径 */
export function snapshotAbsolutePath(ref: string, baseDir: string = LODESTAR_DATA_DIR): string {
  // 兼容三种写法：纯文件名 / snapshots/xxx / 绝对路径
  if (path.isAbsolute(ref)) return ref;
  const normalized = ref.replace(/\\/g, '/');
  if (normalized.startsWith('snapshots/')) {
    return path.join(baseDir, normalized);
  }
  return path.join(LODESTAR_SNAPSHOT_DIR, path.basename(normalized));
}
