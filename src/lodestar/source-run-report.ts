// src/lodestar/source-run-report.ts
/**
 * 来源坐标运行的**人读记录**（Markdown）
 *
 * 生产脚本每次运行都落一份：提问原文、模型逐轮原话、候选表、每次检索与抓页、
 * 逐候选门禁判定与拒页理由。目的只有一个——跑完能直接打开看，不必再从
 * `answers.jsonl` 与 trace JSON 里拼读数。
 *
 * 纯函数，不读盘不联网；写盘由脚本负责（落点 `lodestar/experiments/`，整目录已 gitignore）。
 */

import type { SourceAnchorDecision } from './record-gate/source-anchor';

export interface SourceRunAnswerView {
  runIndex: number;
  phrasing: string;
  rawText: string | null;
  note: string | null;
}

export interface SourceRunCandidateView {
  fields: Record<string, string | null>;
  url: string | null;
  hits: number;
  stable: boolean;
}

export interface SourceRunSearchView {
  candidateIndex: number;
  query: string;
  resultCount: number;
  pickedUrl: string | null;
}

export interface SourceRunProbeView {
  candidateIndex: number;
  url: string;
  ok: boolean;
  fetcher: string;
  detailCount: number;
  hubLike: boolean;
  reason?: string;
  fetches: number;
}

export interface SourceRunGateView {
  candidateIndex: number;
  gate: SourceAnchorDecision['gate'];
  reason: string;
  accepted: string[];
  rejectedPages: Array<{ url: string; reason: string }>;
  recordId: string | null;
}

export interface SourceRunMeta {
  stamp: string;
  query: string;
  packId: string;
  runs: number;
  maxCandidates: number;
  maxPages: number;
  search: boolean;
  browser: boolean;
  dryRun: boolean;
  traceId: string;
  elapsedMs: number;
}

export interface SourceRunReportInput {
  meta: SourceRunMeta;
  answers: SourceRunAnswerView[];
  candidates: SourceRunCandidateView[];
  searches: SourceRunSearchView[];
  probes: SourceRunProbeView[];
  gates: SourceRunGateView[];
  pagesFetched: number;
}

/** 本地时间戳（YYYYMMDD-HHmmss），用于文件名 */
export function localStamp(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function cell(value: string | null | undefined): string {
  const text = (value ?? '').trim();
  if (text === '') return '—';
  return text.replace(/\|/g, '\\|').replace(/\s+/g, ' ');
}

function identityOf(candidate: SourceRunCandidateView): string {
  const parts = [candidate.fields.sourceName, candidate.fields.topic, candidate.fields.category]
    .map((value) => (value ?? '').trim())
    .filter((value) => value !== '');
  return parts.length > 0 ? parts.join(' · ') : '（无身份字段）';
}

const GATE_LABEL: Record<SourceAnchorDecision['gate'], string> = {
  strong: '强坐标',
  weak: '弱坐标',
  rejected: '拒收',
};

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function renderSourceRunReport(input: SourceRunReportInput): string {
  const { meta, answers, candidates, searches, probes, gates, pagesFetched } = input;
  const lines: string[] = ['# 来源坐标运行记录', ''];

  lines.push(
    `- 时间：${meta.stamp}`,
    `- 提问：${meta.query}`,
    `- 参数：${meta.runs} 轮 · 候选上限 ${meta.maxCandidates} · 抓取上限 ${meta.maxPages} · 检索${meta.search ? '开' : '关'} · 浏览器重抓${meta.browser ? '开' : '关'}${meta.dryRun ? ' · **干跑**' : ''}`,
    `- 策略包：${meta.packId} ｜ traceId：\`${meta.traceId}\` ｜ 用时：${seconds(meta.elapsedMs)}`,
    '',
    '> 判定理由代码：`not-an-entry` = 这页不是能继续逛的入口（文章、拍品详情等）；`topic-miss` = 页面没提到这件器物；其余见 `source-anchor.ts` 的判定分支。',
    '',
  );

  lines.push('## 1. 模型原始回答', '');
  if (answers.length === 0) {
    lines.push('（本次没有任何回答记录）', '');
  }
  for (const answer of answers) {
    lines.push(`### 第 ${answer.runIndex + 1} 轮`, '');
    lines.push(`提问措辞：${answer.phrasing}`, '');
    if (answer.rawText === null) {
      lines.push(`（本轮无回答：${answer.note ?? '未知原因'}）`, '');
    } else {
      lines.push('```json', answer.rawText.trim(), '```', '');
      if (answer.note) lines.push(`> 备注：${answer.note}`, '');
    }
  }

  lines.push(`## 2. 候选（合并后 ${candidates.length} 条）`, '');
  if (candidates.length === 0) {
    lines.push('（没有候选）', '');
  } else {
    lines.push('| # | 机构/平台 | 主题 | 年代 | 材质 | 品类 | 网址 | 命中 |', '|---|---|---|---|---|---|---|---|');
    candidates.forEach((candidate, index) => {
      lines.push(
        `| ${index + 1} | ${cell(candidate.fields.sourceName)} | ${cell(candidate.fields.topic)} | ${cell(candidate.fields.period)} | ${cell(candidate.fields.material)} | ${cell(candidate.fields.category)} | ${candidate.url === null ? '（未给）' : cell(candidate.url)} | ${candidate.stable ? '稳定' : '单次'} ×${candidate.hits} |`,
      );
    });
    lines.push('');
  }

  lines.push('## 3. 逐候选门禁', '');
  if (meta.dryRun) {
    lines.push('（干跑：未检索、未抓取、未判定）', '');
  } else if (candidates.length === 0) {
    lines.push('（没有候选，未进入抓取）', '');
  } else {
    candidates.forEach((candidate, index) => {
      lines.push(`### 候选 ${index + 1} · ${identityOf(candidate)}`, '');
      const search = searches.find((item) => item.candidateIndex === index);
      const probe = probes.find((item) => item.candidateIndex === index);
      const gate = gates.find((item) => item.candidateIndex === index);

      if (search) {
        lines.push(
          `- 检索：\`${search.query}\`，${search.resultCount} 条结果 → 采用 ${search.pickedUrl === null ? '（无可用结果）' : `\`${search.pickedUrl}\``}`,
        );
      } else if (candidate.url !== null) {
        lines.push(`- 检索：未调用（候选自带网址 \`${candidate.url}\`）`);
      } else {
        lines.push('- 检索：未调用（检索关闭或无可用短语）');
      }
      if (probe) {
        const health = probe.ok
          ? `${probe.fetcher} 取回 · 详情链接 ${probe.detailCount} · 枢纽页 ${probe.hubLike ? '是' : '否'}`
          : `失败（${probe.reason ?? '未知原因'}）`;
        lines.push(`- 抓取：${probe.fetches} 次 · ${health}`);
      }
      if (gate) {
        lines.push(`- 判定：**${GATE_LABEL[gate.gate]}** — ${gate.reason}`);
        for (const page of gate.rejectedPages) {
          lines.push(`  - 拒页 ${page.url} — ${page.reason}`);
        }
        if (gate.recordId !== null) {
          lines.push(`- 坐标：\`${gate.recordId}\``);
          lines.push(
            `  - 消费：\`npx tsx scripts/run-collection-job.ts --subject <id> --arms anchor --anchor ${gate.recordId}\``,
          );
        }
      } else {
        lines.push('- 判定：未判定（抓取预算用尽或候选无网址）');
      }
      lines.push('');
    });
  }

  const strong = gates.filter((item) => item.gate === 'strong').length;
  const weak = gates.filter((item) => item.gate === 'weak').length;
  const rejected = gates.filter((item) => item.gate === 'rejected').length;
  lines.push('## 4. 汇总', '');
  if (meta.dryRun) {
    lines.push('- 干跑：未抓取、未判定、未写坐标', '');
  } else {
    lines.push(
      `- 强 ${strong} · 弱 ${weak} · 拒收 ${rejected}`,
      `- 抓取 ${pagesFetched} 页 · 用时 ${seconds(meta.elapsedMs)}`,
      '',
    );
  }
  lines.push(`- 提问原始回答另存 \`answers.jsonl\`（同一次运行的几轮共用一个 queryId）`, '');
  if (meta.dryRun) {
    lines.push('- 干跑不写 trace', '');
  } else {
    lines.push(
      `- 事件与附件见 trace \`.traces/traces/LodestarQuery_lodestar-source-anchor_${meta.traceId}.json\``,
      '',
    );
  }

  return lines.join('\n');
}
