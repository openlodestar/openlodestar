// src/demo-workdir.test.ts
/**
 * demo 重置的边界：清自己的工作副本，不碰在线实验的产物
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LIVE_RUNS_DIR_NAME, resetDemoWorkDir } from './demo-workdir';

let workDir = '';

beforeEach(async () => {
  workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lodestar-demo-workdir-'));
});

afterEach(async () => {
  await fs.rm(workDir, { recursive: true, force: true });
});

async function write(rel: string, content = 'x'): Promise<void> {
  const abs = path.join(workDir, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, 'utf8');
}

async function exists(rel: string): Promise<boolean> {
  try {
    await fs.access(path.join(workDir, rel));
    return true;
  } catch {
    return false;
  }
}

describe('resetDemoWorkDir', () => {
  it('清掉上一次 demo 写出的底稿与快照', async () => {
    await write('claims.jsonl', 'stale');
    await write('snapshots/snap-1.txt', 'stale');
    await write('demo-report.html', 'stale');

    const removed = await resetDemoWorkDir(workDir);

    expect(await exists('claims.jsonl')).toBe(false);
    expect(await exists('snapshots/snap-1.txt')).toBe(false);
    expect(removed.sort()).toEqual(['claims.jsonl', 'demo-report.html', 'snapshots']);
  });

  it('保留 live/ 整棵子树（在线重放的 trace 与底稿是花钱换的，不可复现）', async () => {
    const runFile = path.join(LIVE_RUNS_DIR_NAME, '20261101-replay-1', 'replay', 'evidence.jsonl');
    await write('claims.jsonl', 'stale');
    await write(runFile, '{"keep":"me"}');

    await resetDemoWorkDir(workDir);

    expect(await exists(runFile)).toBe(true);
    expect(await exists('claims.jsonl')).toBe(false);
  });

  it('目录不存在时不报错（首次跑 demo 就是这种状态）', async () => {
    const fresh = path.join(workDir, 'not-created-yet');
    await expect(resetDemoWorkDir(fresh)).resolves.toEqual([]);
    await fs.rmdir(fresh);
  });
});
