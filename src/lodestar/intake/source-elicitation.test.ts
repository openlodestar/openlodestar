// src/lodestar/intake/source-elicitation.test.ts
/**
 * 来源坐标供给环测试（离线：stub 掉 invokeLLM，不发真实请求）
 *
 * 钉住三件事：
 * 1. **网址可空**——模型只记得机构时留空，绝不因为"看起来像网址"就收下一个拼出来的地址；
 * 2. **复问只做稳定性合并**——同一入口多轮出现记次数，后一轮只补空字段、不覆盖前一轮写法；
 * 3. **失败不断链**——坏 JSON 与调用失败都留 answers 底稿，返回的候选为空而不是抛错。
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

vi.mock('../../llm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../llm')>();
  return { ...actual, invokeLLM: vi.fn() };
});

import { invokeLLM } from '../../llm';
import porcelainPack from '../packs/porcelain';
import type { AnswerRecord } from '../types';
import { elicitSourceEntries, type SourceElicitationOptions } from './source-elicitation';
import { parseSourceRows } from './parse-answer';

const QUESTION = '清代黄花梨躺椅有哪些可采集的权威入口页';

function obj(values: Record<string, string>): string {
  return JSON.stringify(values);
}

/** 一轮应答：模板要求顶层是数组 */
function row(values: Record<string, string>): string {
  return `[${obj(values)}]`;
}

async function run(
  stubbed: string[],
  overrides: Partial<SourceElicitationOptions> = {},
): Promise<{ answers: AnswerRecord[]; result: Awaited<ReturnType<typeof elicitSourceEntries>> }> {
  const answers: AnswerRecord[] = [];
  const queue = [...stubbed];
  (invokeLLM as Mock).mockImplementation(async () => {
    const next = queue.shift();
    if (next === 'THROW') throw new Error('网络超时');
    return { content: next ?? '' };
  });
  const result = await elicitSourceEntries(QUESTION, porcelainPack, {
    runs: overrides.runs ?? stubbed.length,
    minHits: overrides.minHits ?? 1,
    maxCandidates: overrides.maxCandidates ?? 10,
    onAnswer: (answer) => {
      answers.push(answer);
    },
  });
  return { answers, result };
}

describe('候选合并与稳定性', () => {
  beforeEach(() => {
    (invokeLLM as Mock).mockReset();
  });

  it('同一网址两轮出现 → 合并成一条、hits=2；后一轮只补空字段、不覆盖已有写法', async () => {
    const first = row({
      机构: '中国嘉德',
      器物主题: '黄花梨躺椅',
      年代: '清代',
      网址: 'https://example.test/a',
    });
    const second = row({
      机构: '中国嘉德',
      器物主题: '黄花梨躺椅',
      年代: '清中期',
      材质: '黄花梨',
      品类: '古典家具',
      网址: 'https://example.test/a',
    });
    const { result } = await run([first, second], { runs: 2, minHits: 2 });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      url: 'https://example.test/a',
      hits: 2,
      firstRun: 0,
      stable: true,
      fields: { period: '清代', material: '黄花梨', category: '古典家具' },
    });
    expect(result.stats).toMatchObject({ runs: 2, rowsPerRun: [1, 1], mergedDuplicates: 1, urlMissing: 0 });
  });

  it('网址留空时按身份字段合并，并统计"需要下游检索补齐"的条数', async () => {
    const noUrl = row({ 机构: '中国嘉德', 器物主题: '黄花梨躺椅', 年代: '清代', 网址: '' });
    const { result } = await run([noUrl, noUrl], { runs: 2 });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({ url: null, hits: 2 });
    expect(result.stats.urlMissing).toBe(1);
  });

  it('网址列写成机构名（不是 http URL）→ 按没给网址处理，绝不自己拼', async () => {
    const fakeUrl = row({ 机构: '中国嘉德', 器物主题: '黄花梨躺椅', 网址: '中国嘉德官网' });
    const { result } = await run([fakeUrl], { runs: 1 });
    expect(result.candidates[0]?.url).toBeNull();
  });

  it('稳定复现的排前面；超出上限时先保稳定候选', async () => {
    const a = obj({ 器物主题: '黄花梨躺椅', 网址: 'https://example.test/a' });
    const b = obj({ 器物主题: '紫檀宝座', 网址: 'https://example.test/b' });
    const { result } = await run([`[${a},${b}]`, `[${b}]`], { runs: 2, minHits: 2, maxCandidates: 1 });

    expect(result.candidates).toEqual([
      expect.objectContaining({ url: 'https://example.test/b', hits: 2, stable: true }),
    ]);
  });
});

describe('失败不断链：坏 JSON 与调用失败都留底稿', () => {
  beforeEach(() => {
    (invokeLLM as Mock).mockReset();
  });

  it('非 JSON 应答 → 候选为空、parseFailures 记一次、原文照样落盘', async () => {
    const { answers, result } = await run(['抱歉，我想不起来。'], { runs: 1 });
    expect(result.candidates).toEqual([]);
    expect(result.stats.parseFailures).toBe(1);
    expect(answers[0]).toMatchObject({ kind: 'enumeration', rawText: '抱歉，我想不起来。' });
    expect(answers[0]?.note).toContain('解析失败');
  });

  it('调用失败（重试一次仍失败）→ 记为弃权轮，rawText=null 且 note 说明原因', async () => {
    const { answers, result } = await run(['THROW', 'THROW'], { runs: 1 });
    expect(result.candidates).toEqual([]);
    expect(result.stats.parseFailures).toBe(1);
    expect(answers[0]).toMatchObject({ rawText: null });
    expect(answers[0]?.note).toContain('调用失败');
  });

  it('关键字段全空的行被丢弃并计数（空壳不是入口）', async () => {
    const shell = obj({ 机构: '', 器物主题: '', 网址: 'https://example.test/x' });
    const { result } = await run([`[${shell}]`], { runs: 1 });
    expect(result.candidates).toEqual([]);
    expect(result.stats).toMatchObject({ discardedRows: 1, rowsPerRun: [0] });
  });

  it('来源提问单点换模型：把 qwen-max 透传给 invokeLLM', async () => {
    await run([row({ 机构: '中国嘉德', 器物主题: '黄花梨躺椅' })], { runs: 1 });
    const params = (invokeLLM as Mock).mock.calls[0]?.[2] as { model?: string } | undefined;
    expect(params?.model).toBe('qwen-max');
  });
});

describe('作答解析（列名别名 → 来源字段键）', () => {
  it('中文列名与英文列名都能映射；非 http 网址按没给处理', () => {
    const parsed = parseSourceRows(
      JSON.stringify([
        { 机构: '中国嘉德', 器物: '黄花梨躺椅', 朝代: '清代', 网址: 'https://example.test/a' },
        { platform: '1stDibs', topic: 'wing chair', url: 'not-a-url' },
      ]),
      porcelainPack,
    );
    expect(parsed.rows).toEqual([
      {
        url: 'https://example.test/a',
        fields: { sourceName: '中国嘉德', topic: '黄花梨躺椅', period: '清代' },
      },
      {
        url: null,
        fields: { sourceName: '1stDibs', topic: 'wing chair' },
      },
    ]);
    expect(parsed.discarded).toBe(0);
  });

  it('只写了机构、没写器物主题的行也保留（自由回答时这是常见形态）', () => {
    const parsed = parseSourceRows(
      JSON.stringify([
        { 来源: '中国嘉德', 网址: 'https://example.test/gd' },
        { 来源: '1stDibs', 网址: '' },
      ]),
      porcelainPack,
    );
    expect(parsed.rows).toEqual([
      { url: 'https://example.test/gd', fields: { sourceName: '中国嘉德' } },
      { url: null, fields: { sourceName: '1stDibs' } },
    ]);
    expect(parsed.discarded).toBe(0);
  });
});
