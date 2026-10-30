// src/lodestar/trace-log.ts
/**
 * 裁决底稿挂到既有 TraceStore（不自建 trace 存储）
 *
 * 决策口径：底稿永远是文件，全系统只有一个连接键——裁决与证据上的 `traceId`
 * 直接指向既有 trace 文件，索引在 `traces/index.json`。
 * 于是"点开一条结论能看到它当时查了什么、抓到什么、怎么判的"这件事，
 * 与宿主系统的 trace 复盘走同一通路（宿主的 trace 浏览器与复盘流程可以直接读取）。
 *
 * 宿主系统的采集图有自己的 trace 回调；本模块只服务**非图运行**
 * （本地 CLI 逐条裁决），直接 `traceStore.save`。
 */

import { randomUUID } from 'node:crypto';
import { traceStore, type TraceEvent } from '../trace-config';

/** 一条底稿的阶段名（宿主的 trace 浏览器按它归堆） */
export type LodestarTraceNode = 'LodestarQuery' | 'LodestarClaim';

export interface LodestarTraceInput<TPayload> {
  runId: string;
  node: LodestarTraceNode;
  testName: string;
  traceId: string;
  payload: TPayload;
  events: Array<{ name: string; attributes?: Record<string, unknown> }>;
  startedAt: Date;
  status: 'success' | 'failure';
  error?: { name: string; message: string; stack?: string };
  /**
   * 追加进 trace metadata 的额外键（实验隔离用：跑这圈时的配置标识——prompt 版本、
   * 温度等）。只做合并不改既有键；不传则 metadata 维持两枚固定键。
   */
  metadata?: Record<string, unknown>;
}

/** 新底稿 id（与宿主系统同格式：UUID v4，trace 文件按它命名） */
export function newTraceId(): string {
  return randomUUID();
}

/**
 * 落一条底稿并返回 traceId。
 *
 * 落 trace 失败即抛错：宁可这条裁决不落库，也不留一条"没有底稿的结论"——
 * 这是 verdicts.traceId 必填红线的执行处之一。
 */
export async function recordLodestarTrace<TPayload>(
  input: LodestarTraceInput<TPayload>,
): Promise<string> {
  const endedAt = new Date();
  const events: TraceEvent[] = input.events.map((event, index) => ({
    name: event.name,
    timestamp: new Date(input.startedAt.getTime() + index * 1000).toISOString(),
    level: 'info',
    attributes: event.attributes ?? {},
  }));

  await traceStore.save({
    traceId: input.traceId,
    runId: input.runId,
    nodeName: input.node,
    testName: input.testName,
    schemaVersion: 1,
    status: input.status,
    startedAt: input.startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationMs: endedAt.getTime() - input.startedAt.getTime(),
    input: { state: input.payload },
    output: { traceId: input.traceId, eventCount: events.length },
    events,
    ...(input.error ? { error: input.error } : {}),
    metadata: { graphName: 'Lodestar', pipeline: 'lodestar-audit', ...(input.metadata ?? {}) },
  });
  return input.traceId;
}
