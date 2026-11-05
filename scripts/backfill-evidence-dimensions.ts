#!/usr/bin/env node
// scripts/backfill-evidence-dimensions.ts
/**
 * 一次性回填：给既有证据行补上 `dimension` / `state` / `matchedValue`。
 *
 * 为什么不直接改冻结底稿：`examples/<批次>/evidence.jsonl` 是历史观测（引文、来源、抓取时间），
 * 回填只是**派生产物**，写到旁挂文件 `evidence.enriched.jsonl`，冻结底稿一个字不动。
 * 演示构建优先读旁挂文件；真实案例底稿仍保持原样，回填效果可随时用本脚本重建。
 *
 * 回填顺序：
 * 1. 规则优先：时间表达、机构名、地点、专场名都由确定性规则从引文里摘逐字片段；
 * 2. 模型兜底：规则摘不出的行，只有显式加 `--llm` 才调用模型，且只让模型摘值；
 * 3. 强制校验：`matchedValue` 必须是该行引文的逐字子串（忽略空白换行），
 *    对不上就留 unknown，绝不凑、不编；
 * 4. 可比读数：覆盖率、状态分布、子串校验失败率打到 stdout。
 *
 * 用法：
 *   pnpm run backfill:evidence -- --case examples/poly-2021-autumn --dry-run
 *   pnpm run backfill:evidence -- --case examples/poly-2021-autumn
 *   pnpm run backfill:evidence -- --case examples/poly-2021-autumn --llm   # 需要 LLM_API_KEY，会产生费用
 *
 * 默认不覆盖已有 `state` 的证据行；要重算全部加 `--force`。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ClaimRecord, EvidenceDimensionState, EvidenceRecord } from '../src/lodestar/types';
import { dimensionForField } from '../src/lodestar/dimensions';
import { CITY_WORDS } from '../src/lodestar/dimensions/institution';
import { HOUSE_ALIASES } from '../src/lodestar/packs/porcelain/rules';
import { quoteMatches } from '../src/lodestar/adjudicate/compare';
import { extractJson, invokeLLM, quickCallParams } from '../src/llm';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

interface Options {
  caseDir: string;
  outPath: string;
  dryRun: boolean;
  force: boolean;
  useLlm: boolean;
}

function parseArgs(argv: string[]): Options {
  const get = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const caseDir = path.resolve(PACKAGE_ROOT, get('--case') ?? 'examples/poly-2021-autumn');
  return {
    caseDir,
    outPath: path.resolve(PACKAGE_ROOT, get('--out') ?? path.join(caseDir, 'evidence.enriched.jsonl')),
    dryRun: argv.includes('--dry-run'),
    force: argv.includes('--force'),
    useLlm: argv.includes('--llm'),
  };
}

function readJsonl<T>(file: string): T[] {
  if (!fs.existsSync(file)) throw new Error(`找不到文件：${file}`);
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as T);
}

/** 从引文里摘第一条日期/季节表达（位置最靠前优先；同位置取更长的写法） */
export function extractDateValue(quote: string): string | null {
  const patterns = [
    // 同月内的日区间要先于单日匹配：`2021年12月2日-6日` 是一场 12 月 2–6 日的拍卖，
    // 只摘到「2021年12月2日」会把它误判成与 12 月 5 日的断言冲突
    /\d{4}年\d{1,2}月\d{1,2}日\s*(?:至|~|～|－|–|—|-)\s*\d{1,2}日/g,
    /\d{4}年\d{1,2}月\d{1,2}日/g,
    /\d{4}[/-]\d{1,2}[/-]\d{1,2}/g,
    /\d{4}年\d{1,2}月/g,
    /\d{4}年?(?:四季|全年|年末)/g,
    /\d{4}年?(?:春|夏|秋|冬)(?:季|拍)?/g,
  ];
  let best: { index: number; length: number; value: string } | null = null;
  for (const pattern of patterns) {
    for (const match of quote.matchAll(pattern)) {
      const index = match.index ?? 0;
      const value = match[0];
      if (!best || index < best.index || (index === best.index && value.length > best.length)) {
        best = { index, length: value.length, value };
      }
    }
  }
  return best?.value ?? null;
}

/** 从引文里摘机构名（取位置最靠前、同位置最长的写法，返回原文片段） */
export function extractHouseValue(quote: string): string | null {
  let best: { index: number; length: number } | null = null;
  const haystack = quote.toLowerCase();
  for (const [canonical, aliases] of HOUSE_ALIASES) {
    for (const name of [canonical, ...aliases]) {
      const index = haystack.indexOf(name.toLowerCase());
      if (index < 0) continue;
      if (!best || index < best.index || (index === best.index && name.length > best.length)) {
        best = { index, length: name.length };
      }
    }
  }
  return best ? quote.slice(best.index, best.index + best.length) : null;
}

/** 专场名：优先中文引号里的片段，其次整行（短行）或断言原值在页面逐字出现的位置 */
export function extractSessionValue(quote: string, claimValue: string): string | null {
  const quoted = /[「“]([^」”]{2,80})[」”]/.exec(quote);
  if (quoted && quoted[1]) return quoted[1];
  if (claimValue !== '' && quote.includes(claimValue)) return claimValue;
  const trimmed = quote.trim();
  return trimmed !== '' && trimmed.length <= 60 ? trimmed : null;
}

/** 地点：引文里出现的第一个城市词（原样返回词表里的写法） */
export function extractLocationValue(quote: string): string | null {
  return CITY_WORDS.find((city) => quote.includes(city)) ?? null;
}

function extractByRule(fieldKey: string, quote: string, claimValue: string): string | null {
  switch (fieldKey) {
    case 'dateText':
      return extractDateValue(quote);
    case 'auctionHouse':
      return extractHouseValue(quote);
    case 'sessionName':
      return extractSessionValue(quote, claimValue);
    case 'location':
      return extractLocationValue(quote);
    default:
      return null;
  }
}

/** 模型兜底：只摘值，不做比较；返回值仍要过逐字子串校验 */
async function extractWithLlm(fieldKey: string, quote: string, claimValue: string): Promise<string | null> {
  const result = await invokeLLM(
    'text',
    [
      {
        role: 'system',
        content:
          '你只做摘录：从页面原文里摘出该字段值的逐字片段，不做比较、不判断对错、不改写。' +
          '输出 JSON：{"matchedValue":"原文片段"}；页面没写这个字段就输出空串。',
      },
      {
        role: 'user',
        content: `字段：${fieldKey}\n断言值：${claimValue}\n页面原文：\n${quote}`,
      },
    ],
    { temperature: 0, responseFormat: { type: 'json_object' }, ...quickCallParams() },
  );
  const parsed = extractJson(result.content);
  const value = typeof parsed.matchedValue === 'string' ? parsed.matchedValue.trim() : '';
  return value === '' ? null : value;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const claims = readJsonl<ClaimRecord>(path.join(options.caseDir, 'claims.jsonl'));
  const rows = readJsonl<EvidenceRecord>(path.join(options.caseDir, 'evidence.jsonl'));
  const claimById = new Map(claims.map((claim) => [claim.claimId, claim]));

  const counters = {
    total: rows.length,
    preserved: 0,
    resolvedByRule: 0,
    resolvedByLlm: 0,
    unknown: 0,
    substringFailures: 0,
  };
  const stateCounts = new Map<EvidenceDimensionState, number>();

  const enriched: EvidenceRecord[] = [];
  for (const row of rows) {
    const next: EvidenceRecord = { ...row };
    if (!options.force && row.state !== undefined) {
      counters.preserved += 1;
      stateCounts.set(row.state, (stateCounts.get(row.state) ?? 0) + 1);
      enriched.push(next);
      continue;
    }

    const claim = claimById.get(row.claimId);
    const dimension = row.fieldKey ? dimensionForField('porcelain', row.fieldKey) : undefined;
    if (!claim || !dimension) {
      counters.unknown += 1;
      stateCounts.set('unknown', (stateCounts.get('unknown') ?? 0) + 1);
      enriched.push(next);
      continue;
    }

    let matchedValue = extractByRule(row.fieldKey ?? '', row.quote, claim.object);
    let viaLlm = false;
    if (!matchedValue && options.useLlm) {
      matchedValue = await extractWithLlm(row.fieldKey ?? '', row.quote, claim.object);
      viaLlm = matchedValue !== null;
    }
    if (!matchedValue) {
      counters.unknown += 1;
      stateCounts.set('unknown', (stateCounts.get('unknown') ?? 0) + 1);
      enriched.push(next);
      continue;
    }
    if (!quoteMatches(matchedValue, row.quote)) {
      counters.substringFailures += 1;
      counters.unknown += 1;
      stateCounts.set('unknown', (stateCounts.get('unknown') ?? 0) + 1);
      console.warn(`[${row.evidenceId}] matchedValue 不是引文子串，留 unknown：${matchedValue.slice(0, 40)}`);
      enriched.push(next);
      continue;
    }

    const result = dimension.compare({ claimValue: claim.object, matchedValue });
    next.dimension = dimension.id;
    next.state = result.state;
    next.matchedValue = matchedValue;
    counters[viaLlm ? 'resolvedByLlm' : 'resolvedByRule'] += 1;
    stateCounts.set(result.state, (stateCounts.get(result.state) ?? 0) + 1);
    enriched.push(next);
  }

  if (!options.dryRun) {
    fs.writeFileSync(options.outPath, enriched.map((row) => JSON.stringify(row)).join('\n') + '\n', 'utf8');
  }

  const covered = counters.preserved + counters.resolvedByRule + counters.resolvedByLlm;
  const states = Object.fromEntries([...stateCounts.entries()].sort(([a], [b]) => a.localeCompare(b)));
  console.log(
    JSON.stringify(
      {
        case: path.relative(PACKAGE_ROOT, options.caseDir),
        output: options.dryRun ? '(dry-run：未写文件)' : path.relative(PACKAGE_ROOT, options.outPath),
        total: counters.total,
        covered,
        coverage: `${covered}/${counters.total}`,
        preserved: counters.preserved,
        resolvedByRule: counters.resolvedByRule,
        resolvedByLlm: counters.resolvedByLlm,
        unknown: counters.unknown,
        substringFailures: counters.substringFailures,
        substringFailureRate:
          counters.resolvedByRule + counters.resolvedByLlm + counters.substringFailures === 0
            ? 'n/a'
            : `${counters.substringFailures}/${counters.resolvedByRule + counters.resolvedByLlm + counters.substringFailures}`,
        states,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
