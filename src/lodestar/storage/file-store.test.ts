// src/lodestar/storage/file-store.test.ts
/**
 * 文件后端与适配器契约测试（离线，指向临时目录，不碰仓库底稿）
 *
 * 覆盖：
 * 1. append / get / query / patch 四动作与"同主键取最后一条"的状态推进语义；
 * 2. 落盘前的三条机械红线：裁决缺 traceId 拒落、证据非自抓或无引文拒落、坐标无共现证据页拒落；
 * 3. 末行撕裂（进程中途被杀）可读，中间行坏掉即报错；
 * 4. 索引开关全关——传非空即抛错（本期没有第二种后端）。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LodestarFileStore, LedgerContractError } from './file-store';
import { createStore } from './adapter';
import type { ClaimRecord, EvidenceRecord, VerdictRecord, AnchorRecord } from '../types';

let dir = '';

function claim(over: Partial<ClaimRecord> = {}): ClaimRecord {
  return {
    claimId: 'cl-20261004-aaaaaa',
    queryId: 'q-20261004-aaaaaa',
    recordId: 'rec-20261004-aaaaaa',
    fieldRole: 'key',
    rawText: '2014年5月嘉德办过一场瓷器专场',
    atomicText: '2014年5月，中国嘉德举办过一场瓷器专场',
    subject: '中国嘉德',
    predicate: '举办专场',
    object: '瓷器专场',
    timeScope: { from: '2014-05-01', to: '2014-05-31' },
    channel: 'enumerative',
    provenance: { stabilityRuns: 3, stabilityHits: 2, promptedDetail: false, selectionReason: null },
    triage: { passed: true, reason: 'specific-and-decidable' },
    state: 'pending',
    fieldKey: 'auctionHouse',
    createdAt: new Date('2026-10-04T10:00:00+08:00').toISOString(),
    ...over,
  };
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lodestar-store-'));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('四动作写入契约', () => {
  it('append 之后 get 拿得到，query 可按条件筛', async () => {
    const store = new LodestarFileStore({ baseDir: dir });
    await store.append('claims', claim());
    await store.append('claims', claim({ claimId: 'cl-20261004-bbbbbb', state: 'rejected' }));

    const one = await store.get<ClaimRecord>('claims', 'cl-20261004-aaaaaa');
    expect(one?.atomicText).toContain('瓷器专场');

    const rejected = await store.query<ClaimRecord>('claims', (r) => r.state === 'rejected');
    expect(rejected.map((r) => r.claimId)).toEqual(['cl-20261004-bbbbbb']);
  });

  it('patch 追加状态变更行，历史行不丢，读时取最后一条', async () => {
    const store = new LodestarFileStore({ baseDir: dir });
    await store.append('claims', claim({ state: 'pending' }));
    await store.patch('claims', 'cl-20261004-aaaaaa', { state: 'verifying' });
    await store.patch('claims', 'cl-20261004-aaaaaa', { state: 'adjudicated' });

    const latest = await store.get<ClaimRecord>('claims', 'cl-20261004-aaaaaa');
    expect(latest?.state).toBe('adjudicated');

    const history = await store.allRows<ClaimRecord>('claims');
    expect(history).toHaveLength(3);
    expect(history.map((r) => r.state)).toEqual(['pending', 'verifying', 'adjudicated']);
  });

  it('同一主键并发追加不交错：每行都是合法 JSON', async () => {
    const store = new LodestarFileStore({ baseDir: dir });
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        store.append('evidence', {
          evidenceId: `ev-20261004-${String(i).padStart(6, '0')}`,
          claimId: 'cl-20261004-aaaaaa',
          url: `https://example.com/${i}`,
          domain: 'example.com',
          sourceFamily: 'example.com',
          tier: 'unlisted',
          quote: 'q',
          relation: 'supports',
          contentWeight: 1,
          fetchedBy: 'lodestar',
          fetchedAt: new Date().toISOString(),
          snapshotRef: 'snapshots/x.html',
          traceId: 'trace-1',
          fieldKey: null,
          recordId: null,
        } satisfies EvidenceRecord),
      ),
    );
    const rows = await store.allRows<EvidenceRecord>('evidence');
    expect(rows).toHaveLength(20);
  });

  it('文件不存在时 get/query 返回空态而不是抛错', async () => {
    const store = new LodestarFileStore({ baseDir: dir });
    expect(await store.get('claims', 'nope')).toBeNull();
    expect(await store.query('claims')).toEqual([]);
  });
});

describe('落盘前的机械红线', () => {
  it('裁决缺 traceId 直接拒落（没有底稿的结论不落库）', async () => {
    const store = new LodestarFileStore({ baseDir: dir });
    const bad = {
      claimId: 'cl-20261004-aaaaaa',
      verdict: 'supported',
      evidenceGrade: 'E2',
      supportCount: 2,
      refuteCount: 0,
      footprint: {},
      traceId: '',
      adjudicatedAt: new Date().toISOString(),
    } as unknown as VerdictRecord;
    await expect(store.append('verdicts', bad)).rejects.toThrow(LedgerContractError);
    expect(await store.query('verdicts')).toEqual([]);
  });

  it('证据非本管线自抓 / 无引文 / 无快照引用，三种形态都拒落', async () => {
    const store = new LodestarFileStore({ baseDir: dir });
    const base: EvidenceRecord = {
      evidenceId: 'ev-20261004-aaaaaa',
      claimId: 'cl-20261004-aaaaaa',
      url: 'https://example.com/a',
      domain: 'example.com',
      sourceFamily: 'example.com',
      tier: 'official',
      quote: '本场为瓷器专场',
      relation: 'supports',
      contentWeight: 1,
      fetchedBy: 'lodestar',
      fetchedAt: new Date().toISOString(),
      snapshotRef: 'snapshots/ev-20261004-aaaaaa.html',
      traceId: 'trace-1',
      fieldKey: null,
      recordId: null,
    };
    await expect(
      store.append('evidence', { ...base, fetchedBy: 'main-product' as unknown as 'lodestar' }),
    ).rejects.toThrow(/fetchedBy/);
    await expect(store.append('evidence', { ...base, quote: '  ' })).rejects.toThrow(/quote/);
    await expect(store.append('evidence', { ...base, snapshotRef: '' })).rejects.toThrow(/snapshotRef/);
  });

  it('坐标缺 traceId 或没有共现证据页，拒落', async () => {
    const store = new LodestarFileStore({ baseDir: dir });
    const anchor: AnchorRecord = {
      recordId: 'rec-20261004-aaaaaa',
      query: '列出近五年含民间瓷器的拍卖会',
      fields: { auctionHouse: '中国嘉德' },
      searchPhrases: ['中国嘉德'],
      anchorGrade: 'strong',
      evidenceGrade: 'E2',
      sourceUrls: ['https://www.cguardian.com/a/1'],
      categoryTags: ['瓷器'],
      footprintRef: 'verdicts:cl-20261004-aaaaaa',
      traceId: 'trace-1',
      asOf: new Date().toISOString(),
      stale: false,
    };
    await expect(store.append('anchors', { ...anchor, traceId: '' })).rejects.toThrow(/traceId/);
    await expect(store.append('anchors', { ...anchor, sourceUrls: [] })).rejects.toThrow(/sourceUrls/);
  });

  it('非法状态值拒落', async () => {
    const store = new LodestarFileStore({ baseDir: dir });
    await expect(
      store.append('claims', claim({ state: 'half-done' as unknown as ClaimRecord['state'] })),
    ).rejects.toThrow(/state 非法/);
  });
});

describe('坏文件形态', () => {
  it('末行撕裂（无换行尾的半行）忽略并可观测，前面的完整行照常读', async () => {
    await fs.writeFile(
      path.join(dir, 'claims.jsonl'),
      `${JSON.stringify(claim())}\n{"claimId":"cl-2`,
      'utf8',
    );
    const store = new LodestarFileStore({ baseDir: dir });
    const scan = await store.scan('claims');
    expect(scan.latest.size).toBe(1);
    expect(scan.tornTail).toBe(true);
  });

  it('中间行坏掉即报错：底稿被人为改坏不能装作没看见', async () => {
    await fs.writeFile(
      path.join(dir, 'claims.jsonl'),
      `${JSON.stringify(claim())}\nnot json\n${JSON.stringify(claim({ claimId: 'cl-20261004-cccccc' }))}\n`,
      'utf8',
    );
    const store = new LodestarFileStore({ baseDir: dir });
    await expect(store.scan('claims')).rejects.toThrow(/不是合法 JSON/);
  });
});

describe('适配器开关', () => {
  it('indexTargets 传空得到文件后端，传非空即抛错', () => {
    expect(() => createStore({ baseDir: dir })).not.toThrow();
    expect(() => createStore({ baseDir: dir, indexTargets: ['verdicts'] })).toThrow(/索引表后端未实施/);
  });
});
