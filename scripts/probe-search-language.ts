#!/usr/bin/env node
// scripts/probe-search-language.ts
/**
 * 语言探针：同一条事件的查询，中文与英文分别发出去，看提供者到底给不给结果
 *
 * 只回答一个诊断问题：**中文轨 0 召回，是提供者对中文查询本来就不给结果，
 * 还是我们的查询构造（罗马数字、全角引号、词序）有问题。**
 *
 * 做法是控制变量，不是穷举：
 * - 中文从"最宽"到"最窄"排三条（只机构 → 机构+年份 → 机构+年份+专场），
 *   若最宽那条都是 0，说明与查询构造无关；
 * - 英文放一条同样宽的对照，证明同一条链路本身能返回结果。
 *
 * 只走 `llm-web`：不 import、不构造、不调用 serper；启动时发现 SEARCH_PROVIDER=serper 直接拒绝。
 * 默认干跑只打印清单；带 `--allow-spend` 才真正请求。结果写进
 * `examples/replay-search/probe-language/result.json`（证据留档，可复查）。
 *
 * 用法（仓库根目录）：
 *   npx tsx scripts/probe-search-language.ts                  # 只列查询
 *   npx tsx --env-file=.env scripts/probe-search-language.ts --allow-spend
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LlmWebSearchProvider } from '../src/integrations/search-providers/llm-web-provider';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_PATH = path.join(PACKAGE_ROOT, 'examples', 'replay-search', 'probe-language', 'result.json');

/** 控制变量：中文由宽到窄，英文一条对照 */
const PROBES: Array<{ language: 'zh-cn' | 'en'; query: string; note: string }> = [
  { language: 'zh-cn', query: '北京保利 拍卖', note: '最宽：只有机构名' },
  { language: 'zh-cn', query: '北京保利 2021冬季拍卖会', note: '加年份与拍季，无专场名' },
  { language: 'zh-cn', query: '北京保利 2021冬季拍卖会 禹贡 盛清御瓷新风尚', note: '去罗马数字「Ⅰ」、去引号' },
  { language: 'en', query: 'Beijing Poly 2021 Winter Auction', note: '英文对照（同样宽度）' },
  { language: 'zh-cn', query: '北京保利 2021冬季拍卖会 禹贡Ⅰ 盛清御瓷新风尚', note: '与上一条只差罗马数字「Ⅰ」' },
  { language: 'zh-cn', query: '北京保利 2021冬季拍卖会 禹贡Ⅰ 盛清御瓷新风尚 拍卖 专场', note: '冻结样本里的原始查询 #1（逐字）' },
  { language: 'zh-cn', query: '北京保利 2021冬季拍卖会 禹贡 盛清御瓷新风尚', note: '重复上一条窄查询：量一次同题重跑的抖动' },
];

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

async function main(): Promise<void> {
  const allowSpend = process.argv.includes('--allow-spend');
  console.log(`语言探针（${PROBES.length} 条查询，每条一次 llm-web 检索）：`);
  for (const probe of PROBES) console.log(`  [${probe.language}] ${probe.query}   # ${probe.note}`);
  if (!allowSpend) {
    console.log('未带 --allow-spend：只列查询，不检索、不花钱。');
    return;
  }

  loadDotEnv();
  if (!process.env.LLM_API_KEY?.trim()) throw new Error('缺少 LLM_API_KEY，无法使用 llm-web 检索');
  const configured = (process.env.SEARCH_PROVIDER ?? '').trim().toLowerCase();
  if (configured === 'serper') throw new Error('当前 SEARCH_PROVIDER=serper：本探针只用 llm-web，拒绝运行');

  const provider = new LlmWebSearchProvider();
  const startedAt = new Date();
  const rows: Array<{ language: string; query: string; note: string; returned: number; urls: string[] }> = [];
  for (const probe of PROBES) {
    const result = await provider.search([probe.query], { numResults: 10, language: probe.language });
    rows.push({
      language: probe.language,
      query: probe.query,
      note: probe.note,
      returned: result.results.length,
      urls: result.results.map((item) => item.url),
    });
    console.log(`  → [${probe.language}] ${probe.query}：${result.results.length} 条`);
  }
  const finishedAt = new Date();

  const payload = {
    version: 1 as const,
    kind: 'search-language-probe' as const,
    capturedAt: startedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    provider: 'llm-web',
    webModel: process.env.LLM_WEB_MODEL ?? null,
    purpose: '判定中文轨 0 召回是提供者语言行为还是查询构造问题（控制变量：同一事件由宽到窄）',
    probes: rows,
  };
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`\n已冻结：${path.relative(PACKAGE_ROOT, OUT_PATH)}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
