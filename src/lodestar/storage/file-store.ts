// src/lodestar/storage/file-store.ts
/**
 * 文件后端（底稿真相源）
 *
 * 四类动作：
 * - `append`：追加一行 JSON——**这一步成功才算这条记录存在**；
 * - `get`：按主键取一条（含完整底稿）；
 * - `query`：按条件筛（全扫 + 谓词过滤，只承诺小数据量场景）；
 * - `patch`：状态推进——**追加**一条状态变更行，读时取该主键的最后一条，不改写历史行。
 *
 * 落盘前做三件机械校验（证据必须自抓、不建索引、没有底稿的结论不落库）：
 * 裁决与坐标必须带 traceId；证据必须自抓（fetchedBy='lodestar'）且带逐字引文与快照引用。
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { CATEGORY_PRIMARY_KEY, type LodestarCategory, type LodestarRow } from '../types';
import { categoryFile, LODESTAR_DATA_DIR } from '../paths';

/** 落盘被拒（契约不满足）——抛错而不是静默丢弃：底稿完整性优先于跑通 */
export class LedgerContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LedgerContractError';
  }
}

export interface FileStoreOptions {
  /** 底稿目录（默认 <仓库根>/lodestar，已列在 .gitignore；测试指向临时目录） */
  baseDir?: string;
}

/** 一次全扫的结果：按主键保留最后一条 + 撕裂尾行观测 */
export interface CategoryScan<T> {
  /** 主键 → 该主键的最后一条记录 */
  latest: Map<string, T>;
  /** 全部历史行（含同一主键的多次状态变更） */
  all: T[];
  /** 末行是否撕裂（进程中途被杀留下的半行） */
  tornTail: boolean;
}

export class LodestarFileStore {
  private readonly baseDir: string;
  /** 类别 → 主键 → 文件字节偏移（进程内索引，加速按主键取；缺失即全扫） */
  private readonly offsets = new Map<LodestarCategory, Map<string, number>>();
  /** 类别 → 串行写队列（并发 append 不能交错，Windows 上 appendFile 不保证原子） */
  private readonly writeQueue = new Map<LodestarCategory, Promise<void>>();

  constructor(options: FileStoreOptions = {}) {
    this.baseDir = options.baseDir ?? LODESTAR_DATA_DIR;
  }

  get dataDir(): string {
    return this.baseDir;
  }

  fileFor(category: LodestarCategory): string {
    return categoryFile(category, this.baseDir);
  }

  private primaryKeyOf(category: LodestarCategory, row: object): string {
    const keyField = CATEGORY_PRIMARY_KEY[category];
    const value = (row as LodestarRow)[keyField];
    if (typeof value !== 'string' || value.trim() === '') {
      throw new LedgerContractError(`${category} 行缺少主键 ${keyField}，不落盘`);
    }
    return value;
  }

  /** 落盘前的契约校验 */
  private assertRowContract(category: LodestarCategory, row: object): void {
    const record = row as LodestarRow;
    if (category === 'verdicts') {
      const traceId = record.traceId;
      if (typeof traceId !== 'string' || traceId.trim() === '') {
        throw new LedgerContractError('verdicts.traceId 为空：没有底稿的结论不落库');
      }
      if (typeof record.claimId !== 'string' || record.claimId.trim() === '') {
        throw new LedgerContractError('verdicts.claimId 为空：裁决必须挂到一条断言');
      }
    }
    if (category === 'anchors') {
      const traceId = record.traceId;
      if (typeof traceId !== 'string' || traceId.trim() === '') {
        throw new LedgerContractError('anchors.traceId 为空：没有底稿的坐标不落盘');
      }
      const sourceUrls = record.sourceUrls;
      if (!Array.isArray(sourceUrls) || sourceUrls.length === 0) {
        throw new LedgerContractError(
          'anchors.sourceUrls 为空：坐标必须至少带一页通过验收的证据（事件坐标＝共现页，来源坐标＝入口页）',
        );
      }
    }
    if (category === 'evidence') {
      if (record.fetchedBy !== 'lodestar') {
        throw new LedgerContractError(
          `evidence.fetchedBy 必须是 'lodestar'（非本管线自抓的内容不得充当证据），当前=${String(record.fetchedBy)}`,
        );
      }
      const quote = record.quote;
      if (typeof quote !== 'string' || quote.trim() === '') {
        throw new LedgerContractError('evidence.quote 为空：引文逐字必填，无引文的判定不落盘');
      }
      const snapshotRef = record.snapshotRef;
      if (typeof snapshotRef !== 'string' || snapshotRef.trim() === '') {
        throw new LedgerContractError('evidence.snapshotRef 为空：引文没有可比对的快照');
      }
    }
    if (category === 'claims') {
      const state = record.state;
      const known = ['pending', 'routing', 'verifying', 'adjudicated', 'rejected', 'paused', 'failed'];
      if (typeof state !== 'string' || !known.includes(state)) {
        throw new LedgerContractError(`claims.state 非法：${String(state)}（合法值 ${known.join(' / ')}）`);
      }
    }
  }

  /**
   * 追加一行（同主键追加状态变更行，不改写历史）
   */
  async append(category: LodestarCategory, row: object): Promise<void> {
    this.assertRowContract(category, row);
    const id = this.primaryKeyOf(category, row);
    const line = `${JSON.stringify(row)}\n`;
    await this.enqueueWrite(category, async () => {
      await fs.mkdir(this.baseDir, { recursive: true });
      const file = this.fileFor(category);
      const handle = await fs.open(file, 'a');
      try {
        const { size } = await handle.stat();
        await handle.appendFile(line, 'utf8');
        this.rememberOffset(category, id, size);
      } finally {
        await handle.close();
      }
    });
  }

  /** 按主键取一条（含完整底稿）；文件不存在返回 null */
  async get<T extends object = LodestarRow>(
    category: LodestarCategory,
    id: string,
  ): Promise<T | null> {
    const index = this.offsets.get(category)?.get(id);
    if (index !== undefined) {
      const line = await this.readLineAt(this.fileFor(category), index);
      if (line !== null) {
        const parsed = this.parseLine<T>(line);
        if (parsed && this.primaryKeyOf(category, parsed) === id) return parsed;
      }
      this.offsets.get(category)?.delete(id);
    }
    const scan = await this.scan<T>(category);
    return scan.latest.get(id) ?? null;
  }

  /** 按条件筛（全量读进内存 + 谓词过滤；同主键只看最后一条） */
  async query<T extends object = LodestarRow>(
    category: LodestarCategory,
    predicate?: (row: T) => boolean,
  ): Promise<T[]> {
    const scan = await this.scan<T>(category);
    const rows = [...scan.latest.values()];
    return predicate ? rows.filter(predicate) : rows;
  }

  /** 全部历史行（评测与统计脚本按它数"某来源被引用过几次"这类反查） */
  async allRows<T extends object = LodestarRow>(category: LodestarCategory): Promise<T[]> {
    const scan = await this.scan<T>(category);
    return scan.all;
  }

  /**
   * 状态推进：读最后一条 → 合并补丁 → 追加新行。
   * 主键不存在时返回 null（不新建，新建走 append）。
   */
  async patch<T extends object = LodestarRow>(
    category: LodestarCategory,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<T | null> {
    const current = await this.get<T>(category, id);
    if (!current) return null;
    const next = { ...current, ...patch } as T;
    await this.append(category, next);
    return next;
  }

  /** 全扫：按主键保留最后一条，并报告末行是否撕裂 */
  async scan<T extends object = LodestarRow>(category: LodestarCategory): Promise<CategoryScan<T>> {
    const file = this.fileFor(category);
    const latest = new Map<string, T>();
    const all: T[] = [];
    let tornTail = false;

    let content: string;
    try {
      content = await fs.readFile(file, 'utf8');
    } catch (error) {
      if (isNotFound(error)) return { latest, all, tornTail };
      throw error;
    }
    if (content === '') return { latest, all, tornTail };

    const index = new Map<string, number>();
    this.offsets.set(category, index);

    let offset = 0;
    for (const rawLine of splitKeepingOffsets(content)) {
      const parsed = this.parseLine<T>(rawLine.line);
      if (parsed === null) {
        // 只有末行允许撕裂（进程中途被杀）；中间行坏掉说明底稿被人为改坏，必须炸
        if (!rawLine.isLast) {
          throw new LedgerContractError(
            `${category}.jsonl 第 ${offset} 字节处不是合法 JSON——底稿文件被改写或截断，拒绝继续`,
          );
        }
        tornTail = true;
      } else {
        const id = this.primaryKeyOf(category, parsed);
        latest.set(id, parsed);
        all.push(parsed);
        index.set(id, offset);
      }
      offset += Buffer.byteLength(rawLine.line, 'utf8') + (rawLine.endsWithNewline ? 1 : 0);
    }

    return { latest, all, tornTail };
  }

  /** 清掉某类别的进程内索引（外部改动文件后调用） */
  invalidateIndex(category?: LodestarCategory): void {
    if (category) this.offsets.delete(category);
    else this.offsets.clear();
  }

  private parseLine<T extends object>(line: string): T | null {
    const trimmed = line.trim();
    if (trimmed === '') return null;
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      return null;
    }
  }

  private rememberOffset(category: LodestarCategory, id: string, offset: number): void {
    let index = this.offsets.get(category);
    if (!index) {
      index = new Map<string, number>();
      this.offsets.set(category, index);
    }
    index.set(id, offset);
  }

  private async readLineAt(file: string, offset: number): Promise<string | null> {
    let handle: fs.FileHandle | null = null;
    try {
      handle = await fs.open(file, 'r');
      const buffer = Buffer.alloc(256 * 1024);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
      if (bytesRead === 0) return null;
      const text = buffer.subarray(0, bytesRead).toString('utf8');
      const newline = text.indexOf('\n');
      return newline >= 0 ? text.slice(0, newline) : text;
    } catch {
      return null;
    } finally {
      await handle?.close();
    }
  }

  /** 同一类别的写动作串行化（并发 append 交错会写出坏行） */
  private async enqueueWrite(category: LodestarCategory, task: () => Promise<void>): Promise<void> {
    const previous = this.writeQueue.get(category) ?? Promise.resolve();
    const current = previous.then(task, task);
    this.writeQueue.set(
      category,
      current.then(
        () => undefined,
        () => undefined,
      ),
    );
    await current;
  }
}

/** 按 \n 切行，但保留"每行是否自带换行符"信息，供偏移累加 */
function splitKeepingOffsets(content: string): Array<{ line: string; isLast: boolean; endsWithNewline: boolean }> {
  const parts = content.split('\n');
  const out: Array<{ line: string; isLast: boolean; endsWithNewline: boolean }> = [];
  for (let i = 0; i < parts.length; i++) {
    const isLast = i === parts.length - 1;
    if (isLast && parts[i] === '') continue; // 文件以 \n 结尾时的空尾元素
    out.push({ line: parts[i], isLast, endsWithNewline: !isLast });
  }
  return out;
}

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'ENOENT';
}
