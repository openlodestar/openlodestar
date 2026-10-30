// src/lodestar/examples.test.ts
/**
 * 示例底稿自检（离线）
 *
 * 示例是给第一次读这个仓库的人看的：它的每条引文都必须真能在自家快照里逐字找到，
 * 它的门禁结论（强 / 弱 / 拒收）与四分类裁决也必须与引擎当前实现一致。
 * 示例一旦随实现漂移，就变成了"文档说着、代码不是这么跑"的第二种真相——
 * 所以把示例纳入测试：改坏示例，CI 先红。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createStore, readSnapshot } from './storage/adapter';
import { retallyAndRegate } from './engine';
import { quoteMatches } from './adjudicate/compare';
import { isReadableAnchor } from './anchor-source';
import type { EvidenceRecord } from './types';

const EXAMPLE_DIR = path.resolve(import.meta.dirname, '../../examples/porcelain');

let workDir: string;

async function copyDir(from: string, to: string): Promise<void> {
  await fs.mkdir(to, { recursive: true });
  for (const entry of await fs.readdir(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) await copyDir(source, target);
    else await fs.copyFile(source, target);
  }
}

beforeEach(async () => {
  workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openlodestar-example-'));
  for (const file of ['claims.jsonl', 'evidence.jsonl', 'query.txt']) {
    await fs.copyFile(path.join(EXAMPLE_DIR, file), path.join(workDir, file));
  }
  await copyDir(path.join(EXAMPLE_DIR, 'snapshots'), path.join(workDir, 'snapshots'));
});

afterEach(async () => {
  await fs.rm(workDir, { recursive: true, force: true });
});

describe('瓷器示例底稿', () => {
  it('每条证据都由本管线自抓，引文都能在自己的快照里逐字命中', async () => {
    const store = createStore({ baseDir: workDir });
    const rows = await store.allRows<EvidenceRecord>('evidence');
    expect(rows).toHaveLength(20);
    for (const row of rows) {
      expect(row.fetchedBy, row.evidenceId).toBe('lodestar');
      const snapshot = await readSnapshot(store, row.snapshotRef);
      expect(snapshot, row.snapshotRef).not.toBeNull();
      expect(quoteMatches(row.quote, snapshot ?? ''), row.evidenceId).toBe(true);
    }
  });

  it('离线重算得到四分类裁决、三种门禁档位与两条坐标', async () => {
    const store = createStore({ baseDir: workDir });
    const query = (await fs.readFile(path.join(workDir, 'query.txt'), 'utf8')).trim();
    const outcome = await retallyAndRegate({ store, query });
    const verdictOf = (claimId: string) => {
      const verdict = outcome.verdicts.find((row) => row.claimId === claimId);
      expect(verdict, claimId).toBeDefined();
      return verdict!;
    };

    expect(verdictOf('cl-rec-example-2014-cguardian-auctionHouse')).toMatchObject({
      verdict: 'supported',
      evidenceGrade: 'E3',
      supportCount: 2,
    });
    expect(verdictOf('cl-rec-example-2016-poly-dateText').verdict).toBe('supported');
    expect(verdictOf('cl-rec-example-2019-sothebys-sessionName')).toMatchObject({
      verdict: 'refuted',
      supportCount: 0,
      refuteCount: 1,
    });
    expect(verdictOf('cl-example-2016-poly-november').verdict).toBe('conflicting');

    const gates = new Map(outcome.summaries.map((summary) => [summary.recordId, summary.gate]));
    expect(gates.get('rec-example-2014-cguardian')).toBe('strong');
    expect(gates.get('rec-example-2016-poly')).toBe('weak');
    expect(gates.get('rec-example-2019-sothebys')).toBe('rejected');

    const strong = outcome.anchors.find((anchor) => anchor.recordId === 'rec-example-2014-cguardian');
    expect(strong).toBeDefined();
    expect(strong!.anchorGrade).toBe('strong');
    expect(strong!.sourceUrls).toHaveLength(2);
    expect(strong!.query).toBe(query);
    expect(isReadableAnchor(strong!)).toBe(true);

    const weak = outcome.anchors.find((anchor) => anchor.recordId === 'rec-example-2016-poly');
    expect(weak).toBeDefined();
    expect(weak!.anchorGrade).toBe('weak');
    expect(weak!.sourceUrls).toHaveLength(6);
    expect(isReadableAnchor(weak!)).toBe(false);

    expect(outcome.anchors.some((anchor) => anchor.recordId === 'rec-example-2019-sothebys')).toBe(false);
  });
});
