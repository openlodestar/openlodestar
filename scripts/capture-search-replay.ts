#!/usr/bin/env node
// scripts/capture-search-replay.ts
/**
 * 检索结果采集与冻结（回放样本）
 *
 * 回答一个只有真检索才能回答的问题：**这些查询到底能不能召回可以裁的页面。**
 * 只走 `llm-web`（LLM 自带联网搜索），**不 import、不构造、不调用 serper**。
 *
 * 两步，第二步默认离线：
 *   1. 采集：把一条记录按引擎真实路径（记录级查询构造 → 查询翻译 → 提供者检索 →
 *      候选过滤）跑一遍，把每条查询的原始结果冻进 `examples/replay-search/<名字>/search-results.json`；
 *   2. 回放：`src/lodestar/replay-search.test.ts` 读同一份样本，用冻结结果替代网络，
 *      重跑查询构造与候选过滤，逐条核对读数（`npx vitest run src/lodestar/replay-search.test.ts`）。
 *
 * 硬边界：
 * - 默认**不花钱**：不带 `--allow-spend` 只打印要发哪几条查询就退出；
 * - 查询数上限写死在样本里（默认按引擎的 `maxSearchCalls`，当前 4 条源查询；
 *   加上翻译轨最多翻倍，仍在下限内），脚本不会自己扩成穷举；
 * - 不抓页：采到的只是搜索结果（标题 / 链接 / 摘要）。「能不能裁」按候选过滤 +
 *   摘要是否含本场关键值给出**代理读数**，不冒充逐字回链结论。
 *
 * 用法（仓库根目录）：
 *   npx tsx scripts/capture-search-replay.ts --sample porcelain-2021-autumn            # 只列查询
 *   npx tsx --env-file=.env scripts/capture-search-replay.ts --sample porcelain-2021-autumn --allow-spend
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ClaimRecord } from '../src/lodestar/types';
import type {
  SearchOptions,
  SearchProvider,
  SearchProviderResult,
  SearchResultItem,
} from '../src/integrations/search-providers/types';
import { getSearchProviderFromEnv, registerSearchProvider } from '../src/integrations/search-providers';
import { LlmWebSearchProvider } from '../src/integrations/search-providers/llm-web-provider';
import {
  buildRecordQueries,
  filterAndRankCandidates,
  partitionQueriesByCapabilities,
  retrieveCandidates,
} from '../src/lodestar/adjudicate/retrieval';
import { DEFAULT_CAPS } from '../src/lodestar/adjudicate';
import { atomizeFieldToClaim } from '../src/lodestar/intake/atomize';
import type { AlignedRecord } from '../src/lodestar/intake/record-container';
import { recordFieldsSnapshot } from '../src/lodestar/intake/record-container';
import { normalizeText } from '../src/lodestar/normalize';
import porcelainPack from '../src/lodestar/packs/porcelain';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAMPLE_ROOT = path.join(PACKAGE_ROOT, 'examples', 'replay-search');
const CAPTURE_PROVIDER = 'capture-llm-web';

interface SampleInput {
  /** 样本目录名 */
  slug: string;
  /** 记录里的关键字段（本样本只收关键字段：共现门禁只认它们） */
  fields: Record<string, string>;
  /** 记录的原始句子（落进断言的 rawText，可审计） */
  rawText: string;
  /**
   * 判断"摘要是否在讲本场"的关键词（跨语言，显式列出、可审计）。
   * 不写就退回关键字段值——英文轨的摘要不会出现中文值，会一律判不相关，读数会骗人。
   */
  matchTerms?: string[];
}

interface CapturedTrack {
  language: string | null;
  queries: string[];
  results: SearchResultItem[];
}

function parseArgs(argv: string[]): { slug: string; allowSpend: boolean; recompute: boolean } {
  const index = argv.indexOf('--sample');
  const slug = index >= 0 ? argv[index + 1] : 'porcelain-2021-autumn';
  return {
    slug: slug ?? 'porcelain-2021-autumn',
    allowSpend: argv.includes('--allow-spend'),
    recompute: argv.includes('--recompute'),
  };
}

/** 从 .env 读环境变量（不覆盖已有值、不打印内容）；已经有 LLM_API_KEY 时什么都不做 */
function loadDotEnv(): void {
  if (process.env.LLM_API_KEY?.trim()) return;
  const envPath = path.join(PACKAGE_ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1]!;
    let value = match[2]!.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

/**
 * 一条固定记录 → 断言集（与提问环同一套原子化，只是模型作答换成了固定值）。
 * 关键字段各出一变体，复现次数记 3（等价于三轮稳定复现）。
 */
function buildSample(input: SampleInput): { record: AlignedRecord; claims: ClaimRecord[]; values: Record<string, string | null> } {
  const fields = porcelainPack.fields();
  const variants = fields
    .filter((field) => field.role === 'key' && (input.fields[field.key] ?? '').trim() !== '')
    .map((field) => ({
      fieldKey: field.key,
      value: input.fields[field.key]!.trim(),
      matchKey: porcelainPack.valueMatchKey(field.key, input.fields[field.key]!),
      hits: 3,
      firstSeenRun: 0,
      promptedDetail: false,
    }));
  if (variants.length === 0) throw new Error('样本没有可用的关键字段');

  const record: AlignedRecord = {
    recordId: `rec-replay-${input.slug}`,
    matchKey: input.slug,
    runs: 3,
    recordHits: 3,
    variants,
    rawTexts: [input.rawText],
  };
  const values = recordFieldsSnapshot(record);
  const claims = variants.map((variant) => {
    const spec = fields.find((field) => field.key === variant.fieldKey);
    if (!spec) throw new Error(`策略包里找不到字段 ${variant.fieldKey}`);
    return atomizeFieldToClaim({
      queryId: `q-replay-${input.slug}`,
      record,
      variant,
      spec,
      pack: porcelainPack,
      channel: 'enumerative',
      selectionReason: 'replay-sample',
      stabilityRuns: 3,
    });
  });
  return { record, claims, values };
}

/** 包一层采集：真实结果原样返回，同时按「语言 + 查询集」记下来 */
class CapturingProvider implements SearchProvider {
  readonly name = CAPTURE_PROVIDER;
  readonly capabilities = { siteOperator: false as const };
  readonly tracks: CapturedTrack[] = [];

  async search(queries: string[], options?: SearchOptions): Promise<SearchProviderResult> {
    const inner = new LlmWebSearchProvider();
    const result = await inner.search(queries, options);
    this.tracks.push({ language: options?.language ?? null, queries: [...queries], results: result.results });
    return result;
  }
}

/** 单条查询的读数：返回条数 / 通过候选过滤的条数 / 摘要里含本场关键值的条数 */
function perQueryStats(tracks: CapturedTrack[], keyValues: string[]) {
  const needles = keyValues.map((value) => normalizeText(value)).filter((value) => value !== '');
  const rows: Array<{
    language: string | null;
    query: string;
    returned: number;
    candidates: number;
    onTopic: number;
  }> = [];
  for (const track of tracks) {
    for (const [queryIndex, query] of track.queries.entries()) {
      const items = track.results.filter((item) => item.queryIndex === queryIndex);
      const { candidates } = filterAndRankCandidates(items, porcelainPack);
      const onTopic = candidates.filter((candidate) => {
        const text = normalizeText(`${candidate.title} ${items.find((item) => item.url === candidate.url)?.snippet ?? ''}`);
        return needles.some((needle) => text.includes(needle));
      }).length;
      rows.push({ language: track.language, query, returned: items.length, candidates: candidates.length, onTopic });
    }
  }
  return rows;
}

async function main(): Promise<void> {
  const { slug, allowSpend, recompute } = parseArgs(process.argv.slice(2));
  const sampleDir = path.join(SAMPLE_ROOT, slug);
  const inputPath = path.join(sampleDir, 'input.json');
  if (!fs.existsSync(inputPath)) throw new Error(`样本输入不存在：${path.relative(PACKAGE_ROOT, inputPath)}`);
  const input = { ...(JSON.parse(fs.readFileSync(inputPath, 'utf8')) as SampleInput), slug };
  const matchTerms = input.matchTerms && input.matchTerms.length > 0 ? input.matchTerms : null;

  if (recompute) {
    // 离线重算读数：只读已冻结的搜索结果，不发任何请求
    const fixturePath = path.join(sampleDir, 'search-results.json');
    if (!fs.existsSync(fixturePath)) throw new Error(`没有已冻结的样本：${path.relative(PACKAGE_ROOT, fixturePath)}`);
    const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as {
      tracks: CapturedTrack[];
      values: Record<string, string | null>;
      totals: Record<string, number>;
      [key: string]: unknown;
    };
    const terms = matchTerms ?? Object.values(fixture.values).filter((value): value is string => !!value);
    const perQuery = perQueryStats(fixture.tracks, terms);
    fixture.perQuery = perQuery;
    fixture.totals = {
      ...fixture.totals,
      returned: perQuery.reduce((sum, row) => sum + row.returned, 0),
      perQueryCandidates: perQuery.reduce((sum, row) => sum + row.candidates, 0),
      onTopic: perQuery.reduce((sum, row) => sum + row.onTopic, 0),
    };
    fs.writeFileSync(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
    console.log(`离线重算完成（未发任何检索）：${path.relative(PACKAGE_ROOT, fixturePath)}`);
    console.table(perQuery.map((row) => ({ 查询: row.query, 返回: row.returned, 候选: row.candidates, 摘要命中: row.onTopic })));
    return;
  }

  const { claims, values } = buildSample(input);
  const areas = [
    claims[0]?.object ?? '',
    claims[0]?.subject ?? '',
    ...Object.values(values).filter((value): value is string => !!value),
  ].join(' ');
  const domains = porcelainPack.evidenceDomains(areas);
  const queries = buildRecordQueries({
    pack: porcelainPack,
    claims: claims.map((claim) => ({
      claim,
      spec: porcelainPack.fields().find((field) => field.key === claim.fieldKey),
    })),
    values,
    domains,
    maxQueries: DEFAULT_CAPS.maxSearchCalls,
  });
  const { executable, skipped } = partitionQueriesByCapabilities(queries, false);

  console.log(`样本：${slug}`);
  console.log(`将发出的源查询（${executable.length} 条，上限 ${DEFAULT_CAPS.maxSearchCalls}）：`);
  for (const query of queries) console.log(`  ${executable.includes(query) ? '-' : '（llm-web 不支持 site:，跳过）'} ${query}`);
  if (skipped.length > 0) console.log(`跳过 ${skipped.length} 条 site: 查询（不降级成普通关键词）`);

  if (!allowSpend) {
    console.log('未带 --allow-spend：只列查询，不检索、不花钱。');
    return;
  }

  loadDotEnv();
  if (!process.env.LLM_API_KEY?.trim()) throw new Error('缺少 LLM_API_KEY，无法使用 llm-web 检索');
  if (process.env.SEARCH_PROVIDER && process.env.SEARCH_PROVIDER.trim() !== ''
      && process.env.SEARCH_PROVIDER.trim().toLowerCase() === 'serper') {
    throw new Error('当前 SEARCH_PROVIDER=serper：本脚本只用 llm-web，拒绝运行');
  }

  const provider = new CapturingProvider();
  registerSearchProvider(CAPTURE_PROVIDER, () => provider);
  process.env.SEARCH_PROVIDER = CAPTURE_PROVIDER;
  if (getSearchProviderFromEnv() !== CAPTURE_PROVIDER) throw new Error('提供者切换失败，已中止（不发任何检索）');

  const startedAt = new Date();
  const retrieval = await retrieveCandidates({
    pack: porcelainPack,
    claim: claims[0]!,
    values,
    maxQueries: queries.length,
    numResultsPerQuery: DEFAULT_CAPS.numResultsPerQuery,
    prebuiltQueries: queries,
  });
  const finishedAt = new Date();

  const keyValues = matchTerms ?? Object.values(values).filter((value): value is string => !!value);
  const perQuery = perQueryStats(provider.tracks, keyValues);
  const translationTrack = provider.tracks.find((track) => track.language !== null && track.language !== 'zh-cn');

  const fixture = {
    version: 1 as const,
    kind: 'search-replay' as const,
    slug,
    capturedAt: startedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    provider: 'llm-web',
    webModel: process.env.LLM_WEB_MODEL ?? null,
    caps: {
      maxQueries: DEFAULT_CAPS.maxSearchCalls,
      numResultsPerQuery: DEFAULT_CAPS.numResultsPerQuery,
    },
    input: { fields: input.fields, rawText: input.rawText },
    matchTerms: keyValues,
    recordId: claims[0]!.recordId,
    values,
    domains,
    claims,
    /** 源轨查询（能力过滤后真正发出的那批） */
    queries: retrieval.queries,
    skippedQueries: retrieval.skippedQueries,
    searchCalls: retrieval.searchCalls,
    translation: translationTrack ? { language: translationTrack.language, queries: translationTrack.queries } : null,
    tracks: provider.tracks,
    perQuery,
    totals: {
      returned: perQuery.reduce((sum, row) => sum + row.returned, 0),
      candidates: retrieval.candidates.length,
      perQueryCandidates: perQuery.reduce((sum, row) => sum + row.candidates, 0),
      onTopic: perQuery.reduce((sum, row) => sum + row.onTopic, 0),
      uniqueCandidateUrls: new Set(retrieval.candidates.map((candidate) => candidate.url)).size,
    },
  };

  const outPath = path.join(sampleDir, 'search-results.json');
  fs.writeFileSync(outPath, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');

  console.log(`\n检索完成：${retrieval.searchCalls} 次检索（${provider.tracks.length} 轨），耗时 ${fixture.durationMs} ms`);
  console.log(`候选页 ${retrieval.candidates.length} 条（逐查询去重前合计 ${fixture.totals.perQueryCandidates} 条）`);
  console.table(perQuery.map((row) => ({ 查询: row.query, 返回: row.returned, 候选: row.candidates, 摘要命中: row.onTopic })));
  console.log(`已冻结：${path.relative(PACKAGE_ROOT, outPath)}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
