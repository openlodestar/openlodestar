// src/lodestar/intake/elicitation.test.ts
/**
 * 提问环原始应答落盘测试（离线：stub 掉 invokeLLM，不发真实请求）
 *
 * 钉住的是"底稿起点前移"契约：复问每轮、具体化追问每次各记一行 answers 底稿，
 * 解析之前落盘原文——调用失败（rawText=null）与解析失败（note 带原因）也要有行，
 * 整轮空答/坏 JSON 不再只剩计数。
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

const { searchMock } = vi.hoisted(() => ({ searchMock: vi.fn() }));

vi.mock('@src/llm', async (importOriginal) => {
  // 只 stub invokeLLM；extractJsonArray 等解析原语要保真（parse-answer 依赖它）
  const actual = await importOriginal<typeof import('@src/llm')>();
  return { ...actual, invokeLLM: vi.fn() };
});

vi.mock('@src/integrations/search-providers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@src/integrations/search-providers')>();
  return {
    ...actual,
    createSearchProvider: () => ({ name: 'fake', search: searchMock }),
    getSearchProviderFromEnv: () => 'fake',
  };
});

import { invokeLLM } from '@src/llm';
import porcelainPack from '../packs/porcelain';
import { elicit } from './elicitation';
import type { AnswerRecord } from '../types';

const GOOD_ROW = '[{"拍卖行":"中国嘉德","时间":"2014年5月","专场名称":"瓷器工艺品专场"}]';

async function run(
  stubbed: string[],
  overrides?: { query?: string; runs?: number },
): Promise<{ answers: AnswerRecord[] }> {
  const answers: AnswerRecord[] = [];
  const queue = [...stubbed];
  (invokeLLM as Mock).mockImplementation(async () => {
    const next = queue.shift();
    if (next === 'THROW') throw new Error('网络超时');
    return { content: next ?? '' };
  });
  await elicit(overrides?.query ?? '列出近五年的瓷器拍卖专场', porcelainPack, {
    stabilityRuns: overrides?.runs ?? stubbed.length,
    onAnswer: (row) => {
      answers.push(row);
    },
  });
  return { answers };
}

describe('原始应答落盘（answers 底稿，底稿起点前移）', () => {
  beforeEach(() => {
    (invokeLLM as Mock).mockReset();
  });

  it('复问每轮一行：正常轮存原文全文，解析失败轮 note 带原因', async () => {
    const { answers } = await run([GOOD_ROW, '抱歉，我想不起来。', GOOD_ROW]);
    expect(answers).toHaveLength(3);
    expect(answers.every((a) => a.kind === 'enumeration')).toBe(true);
    expect(answers.map((a) => a.runIndex)).toEqual([0, 1, 2]);
    expect(answers.every((a) => a.queryId !== '' && a.phrasing !== null)).toBe(true);
    expect(answers[0]!.rawText).toBe(GOOD_ROW);
    expect(answers[0]!.note).toBeNull();
    // 第二轮不是 JSON 数组 → 原文照样落盘，note 记解析失败
    expect(answers[1]!.rawText).toBe('抱歉，我想不起来。');
    expect(answers[1]!.note).toContain('解析失败');
  });

  it('调用失败也有一行（rawText=null），不让失败轮在底稿里消失', async () => {
    const { answers } = await run([GOOD_ROW, 'THROW', 'THROW']);
    const failed = answers[1]!;
    expect(failed.rawText).toBeNull();
    expect(failed.note).toContain('调用失败');
  });

  it('具体化追问记 kind=concretization 行（runIndex/phrasing 为 null，存追问返回原文）', async () => {
    // 两轮同一场、但都缺"专场名称"→ 稳定复现且缺关键字段 → 触发具体化追问
    const missingSession = '[{"拍卖行":"中国嘉德","时间":"2014年5月"}]';
    const patches = '[{"matchKey":"不在允许集合","专场名称":"编的"}]';
    const { answers } = await run([missingSession, missingSession, patches], { runs: 2 });
    const concretization = answers.filter((a) => a.kind === 'concretization');
    expect(concretization).toHaveLength(1);
    expect(concretization[0]!.runIndex).toBeNull();
    expect(concretization[0]!.phrasing).toBeNull();
    expect(concretization[0]!.rawText).toBe(patches);
  });

  it('answerId 与 createdAt 由提问环填充，行结构完整', async () => {
    const { answers } = await run([GOOD_ROW]);
    expect(answers).toHaveLength(1);
    const row = answers[0]!;
    expect(row.answerId).toMatch(/^ans-/);
    expect(Number.isNaN(Date.parse(row.createdAt))).toBe(false);
  });
});

// ============================================
// 检索增强兜底（记忆整轮全空 → 1 次搜索 + 2 轮提取式复问）
// ============================================

describe('检索增强兜底', () => {
  beforeEach(() => {
    (invokeLLM as Mock).mockReset();
    searchMock.mockReset();
    searchMock.mockResolvedValue({
      results: [
        { url: 'https://a.test/1', title: '搜索资料', snippet: '全文……', position: 1, queryIndex: 0 },
      ],
    });
  });

  /** 角色感知的 stub：text 角色按队列出（先记忆后提取）；搜索走 provider mock */
  function stubRoles(memory: string[], extraction: string[]): void {
    const memoryQueue = [...memory];
    const extractionQueue = [...extraction];
    (invokeLLM as Mock).mockImplementation(async () => {
      const next = memoryQueue.length > 0 ? memoryQueue.shift() : extractionQueue.shift();
      if (next === 'THROW') throw new Error('网络超时');
      return { content: next ?? '' };
    });
  }

  it('兜底搜索走搜索提供者，问句就是原问句（不带任何追加指向词）', async () => {
    stubRoles(['[]', '[]', '[]'], [GOOD_ROW, GOOD_ROW]);
    await elicit('列出近五年的瓷器拍卖专场', porcelainPack, { stabilityRuns: 3 });
    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(searchMock.mock.calls[0]![0]).toEqual(['列出近五年的瓷器拍卖专场']);
  });

  it('记忆复问整轮全空 → 触发兜底：1 次搜索 + 2 轮提取，两轮一致过稳定线，渠道标记 retrieval-assisted', async () => {
    stubRoles(['[]', '[]', '[]'], [GOOD_ROW, GOOD_ROW]);
    const answers: AnswerRecord[] = [];
    const result = await elicit('列出近五年的瓷器拍卖专场', porcelainPack, {
      stabilityRuns: 3,
      onAnswer: (row) => {
        answers.push(row);
      },
    });

    expect(result.stats.intakeMode).toBe('retrieval-assisted');
    expect(result.stats.runs).toBe(3); // runs 只记记忆轮数，兜底轮在 rowsPerRun 里
    expect(result.stats.rowsPerRun).toEqual([0, 0, 0, 1, 1]);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]!.recordHits).toBe(2);
    expect(result.claims.length).toBeGreaterThan(0);
    expect(result.claims.every((c) => c.channel === 'retrieval-assisted')).toBe(true);

    // 底稿：搜索一行（内容来自搜索提供者，note 标明来源），提取两轮各一行（note 标记）
    const searchRows = answers.filter((a) => a.kind === 'retrieval-search');
    expect(searchRows).toHaveLength(1);
    expect(searchRows[0]?.rawText).toContain('https://a.test/1');
    expect(searchRows[0]?.rawText).toContain('搜索资料');
    expect(searchRows[0]?.note).toContain('原问句');
    const extractRows = answers.filter((a) => a.note?.includes('检索增强提取'));
    expect(extractRows).toHaveLength(2);
    expect(extractRows.map((a) => a.runIndex)).toEqual([3, 4]);
    // 兜底后调用次数：3 记忆 + 2 提取 = 5（搜索不再借 web-search 角色）
    expect(invokeLLM).toHaveBeenCalledTimes(5);
  });

  it('记忆轮有产出 → 不触发兜底（不多花一次搜索）', async () => {
    stubRoles([GOOD_ROW, GOOD_ROW, GOOD_ROW], []);
    const result = await elicit('列出近五年的瓷器拍卖专场', porcelainPack, { stabilityRuns: 3 });

    expect(result.stats.intakeMode).toBe('memory');
    expect(result.stats.rowsPerRun).toEqual([1, 1, 1]);
    expect(searchMock).not.toHaveBeenCalled();
  });

  it('retrievalFallback 关闭 → 记忆全空也不兜底', async () => {
    stubRoles(['[]', '[]', '[]'], []);
    const result = await elicit('列出近五年的瓷器拍卖专场', porcelainPack, {
      stabilityRuns: 3,
      retrievalFallback: false,
    });

    expect(result.stats.intakeMode).toBe('memory');
    expect(result.records).toHaveLength(0);
    expect(invokeLLM).toHaveBeenCalledTimes(3);
    expect(searchMock).not.toHaveBeenCalled();
  });

  it('提取只命中一轮 → recordHits=1 不过稳定线，断言被预筛拒收（unstable-replay）', async () => {
    stubRoles(['[]', '[]', '[]'], [GOOD_ROW, '[]']);
    const result = await elicit('列出近五年的瓷器拍卖专场', porcelainPack, { stabilityRuns: 3 });

    expect(result.stats.intakeMode).toBe('retrieval-assisted');
    expect(result.records).toHaveLength(1);
    expect(result.records[0]!.recordHits).toBe(1);
    expect(result.claims).toHaveLength(0);
    expect(result.rejectedClaims.length).toBeGreaterThan(0);
    expect(result.rejectedClaims.every((c) => c.triage.reason === 'unstable-replay')).toBe(true);
  });

  it('兜底搜索失败 → 就地放弃，不换措辞重试，intakeMode 仍标记 retrieval-assisted', async () => {
    stubRoles(['[]', '[]', '[]'], []);
    searchMock.mockRejectedValue(new Error('搜索超时'));
    const answers: AnswerRecord[] = [];
    const result = await elicit('列出近五年的瓷器拍卖专场', porcelainPack, {
      stabilityRuns: 3,
      onAnswer: (row) => {
        answers.push(row);
      },
    });

    expect(result.stats.intakeMode).toBe('retrieval-assisted');
    expect(result.records).toHaveLength(0);
    // 搜索重试 2 次都抛错 → 提取轮一次都没跑
    expect(invokeLLM).toHaveBeenCalledTimes(3);
    expect(searchMock).toHaveBeenCalledTimes(2);
    const searchRow = answers.find((a) => a.kind === 'retrieval-search');
    expect(searchRow?.rawText).toBeNull();
    expect(searchRow?.note).toContain('兜底搜索失败');
  });
});
