// src/trace-config/index.ts
/**
 * 最小 TraceStore：把每次裁决/提问落成一份 JSON 底稿
 *
 * 布局（默认 `./.traces/`，`OPENLODESTAR_TRACE_DIR` 可覆盖）：
 * ```
 * .traces/
 *   traces/<traceId>.json
 *   traces/index.json
 * ```
 *
 * 为什么 trace 是独立文件而不是塞进裁决行：裁决行只放结论与指针，
 * "当时查了什么、抓到什么、怎么判的"放在 trace 里——点开一条结论能看到全过程。
 */

import fs from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(moduleDir, '..', '..');

/** 调试事件 */
export interface TraceEvent {
  name: string;
  timestamp: string;
  durationMs?: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  attributes?: Record<string, unknown>;
}

/** 单次节点执行的完整记录 */
export interface TraceRecord<I = unknown, O = unknown> {
  traceId: string;
  runId: string;
  nodeName: string;
  testName: string;
  schemaVersion: 1;
  status: 'success' | 'failure';
  startedAt: string;
  endedAt: string;
  durationMs: number;
  error?: { name: string; message: string; stack?: string };
  input: { state: I; config?: Record<string, unknown> };
  output: O | null;
  parentTraceId?: string;
  events?: TraceEvent[];
  metadata?: Record<string, unknown>;
}

/** index.json 的单条索引 */
export interface TraceIndexEntry {
  traceId: string;
  file: string;
  nodeName: string;
  testName: string;
  status: 'success' | 'failure';
  startedAt: string;
  durationMs: number;
  runId: string;
  parentTraceId?: string;
}

interface TraceIndex {
  schemaVersion: 1;
  updatedAt: string;
  traces: TraceIndexEntry[];
}

export interface TraceStoreOptions {
  baseDir: string;
  tracesDirName?: string;
}

export class TraceStore {
  private readonly tracesDir: string;
  private readonly indexPath: string;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(options: TraceStoreOptions) {
    this.tracesDir = path.join(options.baseDir, options.tracesDirName ?? 'traces');
    this.indexPath = path.join(this.tracesDir, 'index.json');
    if (!existsSync(this.tracesDir)) mkdirSync(this.tracesDir, { recursive: true });
  }

  private async readIndex(): Promise<TraceIndex> {
    try {
      const content = await fs.readFile(this.indexPath, 'utf-8');
      return JSON.parse(content) as TraceIndex;
    } catch {
      return { schemaVersion: 1, updatedAt: new Date().toISOString(), traces: [] };
    }
  }

  private async writeIndex(index: TraceIndex): Promise<void> {
    const tmp = `${this.indexPath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(index, null, 2), 'utf-8');
    await fs.rename(tmp, this.indexPath);
  }

  /** 落一条 trace（先写记录，再更新索引；索引写入串行化） */
  async save(record: TraceRecord): Promise<void> {
    const file = `${record.traceId}.json`;
    await fs.writeFile(path.join(this.tracesDir, file), JSON.stringify(record, null, 2), 'utf-8');

    this.writeChain = this.writeChain.then(async () => {
      const index = await this.readIndex();
      const entry: TraceIndexEntry = {
        traceId: record.traceId,
        file,
        nodeName: record.nodeName,
        testName: record.testName,
        status: record.status,
        startedAt: record.startedAt,
        durationMs: record.durationMs,
        runId: record.runId,
        ...(record.parentTraceId ? { parentTraceId: record.parentTraceId } : {}),
      };
      const traces = [entry, ...index.traces.filter((item) => item.traceId !== record.traceId)].sort(
        (a, b) => b.startedAt.localeCompare(a.startedAt),
      );
      await this.writeIndex({ schemaVersion: 1, updatedAt: new Date().toISOString(), traces });
    });
    await this.writeChain;
  }
}

const traceBaseDir = process.env.OPENLODESTAR_TRACE_DIR ?? path.resolve(PACKAGE_ROOT, '.traces');

/** 全局 TraceStore 实例 */
export const traceStore = new TraceStore({ baseDir: traceBaseDir });
