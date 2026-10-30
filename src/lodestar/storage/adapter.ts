// src/lodestar/storage/adapter.ts
/**
 * 存储后端适配器（引擎只认这一层，不直接写文件）
 *
 * 决策口径：
 * **底稿永远是文件**，表至多是随时可从文件重建的索引。本期索引开关全关，
 * 因此本适配器只提供文件后端——把 `indexTargets` 传成非空即报错，
 * 这样"没有第二种后端"是代码层面可执行的事实，不是文档里的一句声明。
 *
 * 同时它是"引擎不回写宿主库"的形状约束：本模块只提供
 * Lodestar 自己的写入路径，不 import 宿主系统的任何写库函数。
 */

import { LodestarFileStore, type FileStoreOptions } from './file-store';
import type { LodestarCategory, LodestarRow } from '../types';

export interface StoreOptions extends FileStoreOptions {
  /**
   * 需要同时投影到索引表的类别。本期恒为空数组——索引表后端属"不要什么"清单，
   * 传入任何类别即抛错。
   */
  indexTargets?: LodestarCategory[];
}

export interface LodestarStore {
  readonly fileStore: LodestarFileStore;
  readonly indexTargets: readonly LodestarCategory[];
  append(category: LodestarCategory, row: object): Promise<void>;
  get<T extends object = LodestarRow>(category: LodestarCategory, id: string): Promise<T | null>;
  query<T extends object = LodestarRow>(
    category: LodestarCategory,
    predicate?: (row: T) => boolean,
  ): Promise<T[]>;
  allRows<T extends object = LodestarRow>(category: LodestarCategory): Promise<T[]>;
  patch<T extends object = LodestarRow>(
    category: LodestarCategory,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<T | null>;
}

/**
 * 建store：文件后端恒开；索引开关必须为空。
 */
export function createStore(options: StoreOptions = {}): LodestarStore {
  const indexTargets = options.indexTargets ?? [];
  if (indexTargets.length > 0) {
    throw new Error(
      `indexTargets=[${indexTargets.join(',')}] 非空但索引表后端未实施——` +
        '本期底稿只有文件后端（索引表不在本次范围内）。把它留空即可。',
    );
  }
  const fileStore = new LodestarFileStore(options);
  return {
    fileStore,
    indexTargets,
    append: (category, row) => fileStore.append(category, row),
    get: (category, id) => fileStore.get(category, id),
    query: (category, predicate) => fileStore.query(category, predicate),
    allRows: (category) => fileStore.allRows(category),
    patch: (category, id, patch) => fileStore.patch(category, id, patch),
  };
}

/** 快照写入（证据正文落盘，供引文逐字命中校验；快照属底稿，不进任何表） */
export async function writeSnapshot(store: LodestarStore, ref: string, html: string): Promise<void> {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const target = path.join(store.fileStore.dataDir, ref.replace(/\\/g, '/'));
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, html, 'utf8');
}

/** 快照读回（verify-quotes 脚本与比对环节共用；缺失返回 null） */
export async function readSnapshot(store: LodestarStore, ref: string): Promise<string | null> {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  try {
    return await fs.readFile(path.join(store.fileStore.dataDir, ref.replace(/\\/g, '/')), 'utf8');
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return null;
    throw error;
  }
}
