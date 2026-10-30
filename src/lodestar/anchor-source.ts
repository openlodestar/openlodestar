// src/lodestar/anchor-source.ts
/**
 * 坐标文件的**只读**入口（引擎之外的下游消费端共用）
 *
 * 这一层的意义是把边界写死：下游读坐标只有两条通路——读这个导出文件、
 * 或读由它派生的只读视图；不 import 引擎的任何写路径，也不经数据库。
 * 于是"坐标不参与判级"（红线：读方只消费，不反向影响裁决）不是靠自觉，
 * 而是靠这一份模块里根本没有可写的东西。
 *
 * 读法与底稿写法对齐：同一主键允许多行（状态只追加不改写），取**最后一行**为准；
 * 失效标记因此可以只追加一行 `stale: true` 而不动证据与裁决。
 */

import fs from 'node:fs';
import { anchorsFilePath } from './paths';
import type { AnchorRecord } from './types';

/** 坐标文件的读取结果 */
export interface AnchorFileRead {
  /** 每个 recordId 的最后一条坐标（文件不存在时为空数组） */
  anchors: AnchorRecord[];
  /** 文件是否存在（不存在与空文件是两种空态，调用方要能分开看） */
  fileExists: boolean;
  /** 解析失败的行数（坏行不阻断读取，但会计数上报） */
  malformedLines: number;
}

/**
 * 读坐标文件。
 *
 * 缺文件、空文件、行坏掉——三种形态都返回可读结果而不是抛错：
 * 调用方拿不到坐标时的行为必须与"今天没有坐标"逐字节一致，
 * 一次 IO 异常不能让下游作业失败。
 */
export function readAnchorFile(filePath: string = anchorsFilePath()): AnchorFileRead {
  if (!fs.existsSync(filePath)) {
    return { anchors: [], fileExists: false, malformedLines: 0 };
  }
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return { anchors: [], fileExists: true, malformedLines: 0 };
  }

  const latest = new Map<string, AnchorRecord>();
  let malformedLines = 0;
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    try {
      const row = JSON.parse(trimmed) as AnchorRecord;
      if (typeof row.recordId !== 'string' || row.recordId === '') {
        malformedLines += 1;
        continue;
      }
      latest.set(row.recordId, row);
    } catch {
      // 末行撕裂（进程被杀时留下的半行）与坏行都只计数，不影响其余坐标
      malformedLines += 1;
    }
  }
  return { anchors: [...latest.values()], fileExists: true, malformedLines };
}

/**
 * 下游可读判据：默认只读强坐标，且失效的一律不读。
 *
 * 这一条只在这里成文一次——所有消费端都调它，避免两处各写一份过滤条件、
 * 日后一处放宽就悄悄把弱坐标喂进了下游依据。
 */
export function isReadableAnchor(anchor: AnchorRecord): boolean {
  return anchor.anchorGrade === 'strong' && anchor.stale === false;
}

/** 只读视图：当前可作依据的坐标（按 recordId 排序，确定性输出） */
export function readableAnchors(read: AnchorFileRead = readAnchorFile()): AnchorRecord[] {
  return read.anchors.filter(isReadableAnchor).sort((a, b) => a.recordId.localeCompare(b.recordId));
}
