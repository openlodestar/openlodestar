// src/lodestar/poly-2021-autumn.test.ts
/**
 * 真实案例底稿自检（离线）
 *
 * 这份底稿与 `examples/porcelain` 的分工不同：瓷器示例验证"契约的每一种形状"，
 * 这份真实案例验证"真实页面上的写法能不能被同一套规则接住"——
 * 繁体/简体、全角/半角、转载归并、同页共现、以及两种拒绝。
 *
 * 它同样纳入测试：真实案例一旦与实现漂移，报告里说的就不再是代码跑出来的结果。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { createStore } from './storage/adapter';
import { retallyAndRegate } from './engine';
import { isReadableAnchor } from './anchor-source';
import { inspectEvidence } from './evidence-check';
import porcelainPack from './packs/porcelain';
import { parseDemoCase, renderDemoReport } from '../demo-report';
import type { ClaimRecord, EvidenceRecord } from './types';

const EXAMPLE_DIR = path.resolve(import.meta.dirname, '../../examples/poly-2021-autumn');

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

/** 与 CLI / 在线实验共用同一道引文硬校验（不再在测试里维护第二份实现） */
async function guardOf(store: ReturnType<typeof createStore>) {
  const rows = await store.allRows<EvidenceRecord>('evidence');
  const claims = await store.query<ClaimRecord>('claims');
  const claimById = new Map(claims.map((claim) => [claim.claimId, claim]));
  return inspectEvidence(store, rows, claimById, porcelainPack);
}

beforeEach(async () => {
  workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openlodestar-poly-'));
  for (const file of ['claims.jsonl', 'evidence.jsonl', 'query.txt', 'case.json']) {
    await fs.copyFile(path.join(EXAMPLE_DIR, file), path.join(workDir, file));
  }
  await copyDir(path.join(EXAMPLE_DIR, 'snapshots'), path.join(workDir, 'snapshots'));
});

afterEach(async () => {
  await fs.rm(workDir, { recursive: true, force: true });
});

describe('北京保利 2021 秋拍真实案例', () => {
  it('底稿规模与引文：13 条断言、22 条证据，全部逐字命中自己的快照', async () => {
    const store = createStore({ baseDir: workDir });
    const claims = await store.query<ClaimRecord>('claims');
    const rows = await store.allRows<EvidenceRecord>('evidence');
    expect(claims).toHaveLength(13);
    expect(rows).toHaveLength(22);
    const guard = await guardOf(store);
    expect(guard.violations).toEqual([]);
    expect(guard.verbatimOk).toBe(22);
    expect(guard.clueOk).toBe(20); // 两条 irrelevant 行不参与字段线索判定
  });

  it('快照是节选：带页眉、无版权页脚、字节与指纹和 manifest 对得上', async () => {
    const manifestRaw = await fs.readFile(path.join(EXAMPLE_DIR, 'snapshots/manifest.json'), 'utf8');
    const manifest = JSON.parse(manifestRaw) as {
      sources: Array<{
        id: string;
        snapshot: string;
        fullText: { chars: number; sha256: string };
        excerpt: { bodyChars: number; fileBytes: number; sha256: string };
      }>;
    };
    expect(manifest.sources).toHaveLength(4);

    for (const source of manifest.sources) {
      const buffer = await fs.readFile(path.join(EXAMPLE_DIR, source.snapshot));
      const text = buffer.toString('utf8');
      expect(text.startsWith('【节选·非全文】'), source.id).toBe(true);
      expect(buffer.length, source.id).toBe(source.excerpt.fileBytes);
      expect(createHash('sha256').update(buffer).digest('hex'), source.id).toBe(source.excerpt.sha256);
      // 全文回灌会让字节数直接跳一个量级（原四份合计 39.7 KB），这里卡住回退
      expect(buffer.length, source.id).toBeLessThan(6000);
      expect(text, source.id).not.toMatch(/All Rights Reserved|粤ICP备|特别声明|特別聲明/);
      expect(source.fullText.sha256, source.id).toMatch(/^[0-9a-f]{64}$/);
      expect(source.fullText.chars, source.id).toBeGreaterThan(source.excerpt.bodyChars);
    }
  });

  it('离线重算：强 / 弱 / 两种拒收都由同一套规则算出', async () => {
    const store = createStore({ baseDir: workDir });
    const query = (await fs.readFile(path.join(workDir, 'query.txt'), 'utf8')).trim();
    const outcome = await retallyAndRegate({ store, query });
    const verdictOf = (claimId: string) => {
      const verdict = outcome.verdicts.find((row) => row.claimId === claimId);
      expect(verdict, claimId).toBeDefined();
      return verdict!;
    };

    for (const field of ['auctionHouse', 'dateText', 'sessionName']) {
      expect(verdictOf(`cl-rec-poly-2021-yugong-1-${field}`)).toMatchObject({
        verdict: 'supported',
        evidenceGrade: 'E2',
        supportCount: 2,
      });
    }
    expect(verdictOf('cl-rec-poly-2021-yugong-1-location')).toMatchObject({
      verdict: 'supported',
      evidenceGrade: 'E1',
      supportCount: 1,
    });

    for (const field of ['auctionHouse', 'dateText', 'sessionName']) {
      expect(verdictOf(`cl-rec-poly-2021-yugong-2-${field}`)).toMatchObject({
        verdict: 'supported',
        evidenceGrade: 'E1',
        supportCount: 1,
      });
    }

    expect(verdictOf('cl-rec-poly-2021-yugong-1-nov15-dateText')).toMatchObject({
      verdict: 'refuted',
      evidenceGrade: 'E2',
      supportCount: 0,
      refuteCount: 2,
    });
    expect(verdictOf('cl-rec-poly-2021-yugong-3-sessionName')).toMatchObject({
      verdict: 'not_found',
      evidenceGrade: 'E0',
      notFoundCause: 'coverage',
    });

    const gates = new Map(outcome.summaries.map((summary) => [summary.recordId, summary.gate]));
    expect(gates.get('rec-poly-2021-yugong-1')).toBe('strong');
    expect(gates.get('rec-poly-2021-yugong-2')).toBe('weak');
    expect(gates.get('rec-poly-2021-yugong-1-nov15')).toBe('rejected');
    expect(gates.get('rec-poly-2021-yugong-3')).toBe('rejected');

    const strong = outcome.anchors.find((anchor) => anchor.recordId === 'rec-poly-2021-yugong-1');
    expect(strong).toBeDefined();
    expect(strong!.anchorGrade).toBe('strong');
    expect(strong!.evidenceGrade).toBe('E2');
    expect(strong!.fields.location).toBe('北京');
    expect(strong!.sourceUrls).toHaveLength(2);
    expect(isReadableAnchor(strong!)).toBe(true);

    const weak = outcome.anchors.find((anchor) => anchor.recordId === 'rec-poly-2021-yugong-2');
    expect(weak).toBeDefined();
    expect(weak!.anchorGrade).toBe('weak');
    expect(weak!.sourceUrls).toHaveLength(1);
    expect(isReadableAnchor(weak!)).toBe(false);

    expect(outcome.anchors.some((anchor) => anchor.recordId === 'rec-poly-2021-yugong-1-nov15')).toBe(false);
    expect(outcome.anchors.some((anchor) => anchor.recordId === 'rec-poly-2021-yugong-3')).toBe(false);
  });

  it('案例卡与 HTML 报告：标题、结论与护栏读数都能渲染出来', async () => {
    const store = createStore({ baseDir: workDir });
    const query = (await fs.readFile(path.join(workDir, 'query.txt'), 'utf8')).trim();
    const rawCase = JSON.parse(await fs.readFile(path.join(workDir, 'case.json'), 'utf8')) as unknown;
    const caseMeta = parseDemoCase(rawCase);
    expect(caseMeta).not.toBeNull();
    expect(caseMeta!.query).toBe(query);

    const claims = await store.query<ClaimRecord>('claims');
    const evidence = await store.allRows<EvidenceRecord>('evidence');
    const outcome = await retallyAndRegate({ store, query });
    const guard = await guardOf(store);
    const html = renderDemoReport({
      exampleName: 'poly-2021-autumn',
      fixtureDir: EXAMPLE_DIR,
      workDir,
      query,
      caseMeta,
      fields: porcelainPack.fields().map((field) => ({ key: field.key, label: field.label, role: field.role })),
      claims,
      evidence,
      verdicts: outcome.verdicts,
      summaries: outcome.summaries,
      anchors: outcome.anchors,
      guard,
      generatedAt: '2026-10-29T00:00:00.000Z',
    });

    expect(html).toContain('北京保利 2021 秋拍「禹贡」专场');
    expect(html).toContain('强坐标 · strong');
    expect(html).toContain('弱坐标 · weak');
    expect(html).toContain('不导出坐标');
    expect(html).toContain('引文违规');
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('[object Object]');
  });
});
