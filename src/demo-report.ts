// src/demo-report.ts
/**
 * 离线演示报告（单文件 HTML，无外部依赖）
 *
 * 为什么要有它：`demo` 命令的终端输出适合开发者核账，但不适合拿给第一次接触这个项目的人看。
 * 演示要回答的是一个产品问题——"模型说的这句话，到底凭什么算数、又凭什么不算数"——
 * 所以报告把同一条证据链按"记录 → 关键字段 → 引文 → 裁决 → 门禁 → 坐标"铺开，
 * 让读者能在同一页里从结论走回原句。
 *
 * 三条边界：
 * 1. **只读**：报告只消费 `demo` 已经算出的底稿与裁决，不重新检索、不调用模型、不改底稿。
 * 2. **自包含**：CSS 内联，不引用字体、脚本或图片；断网、单文件也能打开。
 * 3. **可核对**：每个结论旁边都保留证据行号、域名、档位与原文链接；报告不是"另一种真相"。
 */

import path from 'node:path';
import { isReadableAnchor } from './lodestar/anchor-source';
import type {
  AnchorRecord,
  ClaimRecord,
  EvidenceRecord,
  EvidenceGrade,
  RecordGate,
  RecordSummary,
  SourceTier,
  Verdict,
  VerdictRecord,
} from './lodestar/types';

/** 案例卡（`case.json`）——给报告提供标题、叙事与来源说明，不参与裁决 */
export interface DemoCaseSource {
  id: string;
  url: string;
  publisher: string;
  publishedAt: string;
  tier: SourceTier;
  family: string;
  capture: string;
  note?: string;
}

export interface DemoCaseExpectation {
  recordId: string;
  gate: RecordGate;
  anchor: 'strong' | 'weak' | null;
  story: string;
}

export interface DemoCase {
  id: string;
  title: string;
  subtitle: string;
  query: string;
  capturedAt: string;
  summary: string;
  sources: DemoCaseSource[];
  expectations: DemoCaseExpectation[];
  notProven: string[];
  limitations: string[];
}

export interface DemoFieldSpec {
  key: string;
  label: string;
  role: 'key' | 'secondary';
}

export interface DemoGuardViolation {
  evidenceId: string;
  claimId: string;
  url: string;
  reason: string;
}

export interface DemoGuardResult {
  total: number;
  verbatimOk: number;
  clueOk: number;
  violations: DemoGuardViolation[];
  clueUnverifiable: string[];
}

/** 在线实验与离线预期的逐条对照（只有 replay 模式有完整对照；full 模式记录名可能不同） */
export interface DemoLiveExpectationCheck {
  recordId: string;
  expected: string;
  actual: string;
  ok: boolean;
}

/**
 * 在线实验的元信息。
 *
 * 有它时报告必须改口径：不能说"全部离线"、不能把冻结底稿的抓取日期当本次日期、
 * 也不能让读者以为重跑会得到同一批页面。
 */
export interface DemoLiveMeta {
  mode: 'replay' | 'full';
  provider: string;
  caps: {
    maxSearchCalls: number;
    maxPages: number;
    numResultsPerQuery: number;
    maxRecords?: number;
  };
  startedAt: string;
  finishedAt: string;
  command: string;
  expectationChecks: DemoLiveExpectationCheck[];
  notes: string[];
}

export interface DemoReportInput {
  exampleName: string;
  fixtureDir: string;
  workDir: string;
  query: string;
  caseMeta: DemoCase | null;
  fields: DemoFieldSpec[];
  claims: ClaimRecord[];
  evidence: EvidenceRecord[];
  verdicts: VerdictRecord[];
  summaries: RecordSummary[];
  anchors: AnchorRecord[];
  guard: DemoGuardResult;
  generatedAt: string;
  /** 有值 = 这次是在线实验；报告会换掉"离线"口径并加预期对照 */
  liveMeta?: DemoLiveMeta;
}

const TIER_LABEL: Record<SourceTier, string> = {
  official: '官方',
  primary: '一手',
  aggregator: '聚合',
  unlisted: '未列名',
};

const VERDICT_LABEL: Record<Verdict, string> = {
  supported: '成立',
  refuted: '被反驳',
  conflicting: '互相冲突',
  not_found: '未查到',
};

const RELATION_LABEL: Record<EvidenceRecord['relation'], string> = {
  supports: '支持',
  refutes: '反对',
  irrelevant: '不涉及',
};

const GRADE_HINT: Record<EvidenceGrade, string> = {
  E0: '没有可用证据',
  E1: '单一独立来源',
  E2: '两个及以上独立来源（无官方源）',
  E3: '两个及以上独立来源（含官方源）',
};

const GATE_LABEL: Record<RecordGate, string> = {
  strong: '强坐标',
  weak: '弱坐标',
  rejected: '拒收',
};

/**
 * `case.json` 的最小校验。演示数据是仓库自有文件，但报告会把其中的文字当 HTML 渲染，
 * 所以类型与必填项在这里收一次口——宁可退回"无案例卡"的通用报告，也不带病渲染。
 */
export function parseDemoCase(raw: unknown): DemoCase | null {
  if (!isRecord(raw)) return null;
  const strings = ['id', 'title', 'subtitle', 'query', 'capturedAt', 'summary'] as const;
  if (strings.some((key) => typeof raw[key] !== 'string')) return null;
  if (!Array.isArray(raw.sources) || !Array.isArray(raw.expectations)) return null;
  if (!Array.isArray(raw.notProven) || !Array.isArray(raw.limitations)) return null;
  const sources: DemoCaseSource[] = [];
  for (const item of raw.sources) {
    if (!isRecord(item)) return null;
    if (
      typeof item.id !== 'string' ||
      typeof item.url !== 'string' ||
      typeof item.publisher !== 'string' ||
      typeof item.publishedAt !== 'string' ||
      typeof item.tier !== 'string' ||
      typeof item.family !== 'string' ||
      typeof item.capture !== 'string'
    ) {
      return null;
    }
    if (!isTier(item.tier)) return null;
    sources.push({
      id: item.id,
      url: item.url,
      publisher: item.publisher,
      publishedAt: item.publishedAt,
      tier: item.tier,
      family: item.family,
      capture: item.capture,
      ...(typeof item.note === 'string' ? { note: item.note } : {}),
    });
  }
  const expectations: DemoCaseExpectation[] = [];
  for (const item of raw.expectations) {
    if (!isRecord(item)) return null;
    if (typeof item.recordId !== 'string' || typeof item.story !== 'string') return null;
    if (item.gate !== 'strong' && item.gate !== 'weak' && item.gate !== 'rejected') return null;
    if (item.anchor !== 'strong' && item.anchor !== 'weak' && item.anchor !== null) return null;
    expectations.push({ recordId: item.recordId, gate: item.gate, anchor: item.anchor, story: item.story });
  }
  const notProven = raw.notProven.filter((item): item is string => typeof item === 'string');
  const limitations = raw.limitations.filter((item): item is string => typeof item === 'string');
  return {
    id: raw.id as string,
    title: raw.title as string,
    subtitle: raw.subtitle as string,
    query: raw.query as string,
    capturedAt: raw.capturedAt as string,
    summary: raw.summary as string,
    sources,
    expectations,
    notProven,
    limitations,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTier(value: string): value is SourceTier {
  return value === 'official' || value === 'primary' || value === 'aggregator' || value === 'unlisted';
}

/** HTML 转义：动态文本一律经过这里，包括引文、字段值与 URL */
function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function displayPath(target: string): string {
  const relative = path.relative(process.cwd(), target);
  return (relative === '' ? target : relative).replace(/\\/g, '/');
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function countBy<T extends string>(items: T[]): Map<T, number> {
  const counts = new Map<T, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return counts;
}

function verdictChip(verdict: VerdictRecord | undefined): string {
  if (!verdict) return '<span class="chip chip-empty">无裁决</span>';
  const cause = verdict.verdict === 'not_found' && verdict.notFoundCause
    ? `<span class="cause">${esc(verdict.notFoundCause)}</span>`
    : '';
  return `<span class="chip chip-${esc(verdict.verdict)}">${esc(VERDICT_LABEL[verdict.verdict])} · ${esc(verdict.verdict)}${cause}</span>`;
}

function gradeChip(grade: EvidenceGrade | undefined): string {
  if (!grade) return '';
  return `<span class="grade" title="${esc(GRADE_HINT[grade])}">${esc(grade)}</span>`;
}

function gateBadge(gate: RecordGate, small = false): string {
  return `<span class="badge badge-${esc(gate)}${small ? ' badge-small' : ''}">${esc(GATE_LABEL[gate])} · ${esc(gate)}</span>`;
}

function tierChip(tier: SourceTier): string {
  return `<span class="tier tier-${esc(tier)}">${esc(TIER_LABEL[tier])}</span>`;
}

function relationChip(relation: EvidenceRecord['relation']): string {
  return `<span class="relation relation-${esc(relation)}">${esc(RELATION_LABEL[relation])}</span>`;
}

function evidenceItem(row: EvidenceRecord): string {
  const note = row.note ? `<p class="ev-note">${esc(row.note)}</p>` : '';
  const claimField = row.fieldKey ? `<span class="ev-field">${esc(row.fieldKey)}</span>` : '';
  const anchor = row.url
    ? `<a class="ev-link" href="${esc(row.url)}" target="_blank" rel="noreferrer">打开原页</a>`
    : '';
  return `<li class="ev" id="${esc(row.evidenceId)}">
    <div class="ev-head">
      ${relationChip(row.relation)}
      ${tierChip(row.tier)}
      <span class="ev-domain">${esc(row.domain)}</span>
      ${claimField}
      <span class="ev-id">${esc(row.evidenceId)}</span>
    </div>
    <blockquote class="quote">${esc(row.quote)}</blockquote>
    ${note}
    <div class="ev-foot">
      <span class="muted">家族 ${esc(row.sourceFamily)}</span>
      <span class="muted">快照 ${esc(row.snapshotRef)}</span>
      ${anchor}
    </div>
  </li>`;
}

function claimBlock(
  claim: ClaimRecord,
  spec: DemoFieldSpec | undefined,
  verdict: VerdictRecord | undefined,
  rows: EvidenceRecord[],
  compact: boolean,
): string {
  const evidenceHtml = rows.length > 0
    ? `<ol class="ev-list">${rows.map((row) => evidenceItem(row)).join('')}</ol>`
    : '<p class="muted">这条断言没有任何证据行。</p>';
  const counts = verdict
    ? `<span class="counts">支持 ${verdict.supportCount} · 反对 ${verdict.refuteCount}</span>`
    : '';
  const body = `<div class="claim-head">
      <div class="claim-name">
        <span class="field-label">${esc(spec?.label ?? claim.fieldKey ?? claim.claimId)}</span>
        <span class="field-key">${esc(claim.fieldKey ?? '')}</span>
      </div>
      <div class="claim-verdict">${verdictChip(verdict)} ${gradeChip(verdict?.evidenceGrade)} ${counts}</div>
    </div>
    <p class="claim-value">${esc(claim.object)}</p>
    <p class="claim-text">${esc(claim.atomicText)}</p>
    ${evidenceHtml}`;
  if (compact) {
    return `<details class="claim claim-compact">
      <summary>${esc(spec?.label ?? claim.fieldKey ?? claim.claimId)}：${esc(claim.object)} ${verdictChip(verdict)}</summary>
      ${body}
    </details>`;
  }
  return `<div class="claim">${body}</div>`;
}

function expectationOf(caseMeta: DemoCase | null, recordId: string): DemoCaseExpectation | undefined {
  return caseMeta?.expectations.find((item) => item.recordId === recordId);
}

/** 一条记录的关键字段裁决摘要（用于总览表） */
function compositionOf(
  summary: RecordSummary,
  verdictByClaim: Map<string, VerdictRecord>,
): string {
  const counts = countBy(
    summary.keyClaimIds.map((claimId) => verdictByClaim.get(claimId)?.verdict ?? 'not_found'),
  );
  const order: Verdict[] = ['supported', 'refuted', 'conflicting', 'not_found'];
  const parts = order
    .filter((verdict) => (counts.get(verdict) ?? 0) > 0)
    .map((verdict) => `${counts.get(verdict)} ${VERDICT_LABEL[verdict]}`);
  return parts.join(' · ');
}

/** 从证据行派生的来源表（即使没有 case.json 也能完整列出） */
interface SourceRow {
  url: string;
  domains: string[];
  families: string[];
  tiers: SourceTier[];
  rows: number;
  publisher?: string;
  publishedAt?: string;
  capture?: string;
}

function sourceRows(input: DemoReportInput): SourceRow[] {
  const byUrl = new Map<string, SourceRow>();
  for (const row of input.evidence) {
    const existing = byUrl.get(row.url);
    if (existing) {
      existing.rows += 1;
      if (!existing.domains.includes(row.domain)) existing.domains.push(row.domain);
      if (!existing.families.includes(row.sourceFamily)) existing.families.push(row.sourceFamily);
      if (!existing.tiers.includes(row.tier)) existing.tiers.push(row.tier);
      continue;
    }
    byUrl.set(row.url, {
      url: row.url,
      domains: [row.domain],
      families: [row.sourceFamily],
      tiers: [row.tier],
      rows: 1,
    });
  }
  for (const source of input.caseMeta?.sources ?? []) {
    const existing = byUrl.get(source.url);
    if (existing) {
      existing.publisher = source.publisher;
      existing.publishedAt = source.publishedAt;
      existing.capture = source.capture;
      if (!existing.families.includes(source.family)) existing.families.push(source.family);
      if (!existing.tiers.includes(source.tier)) existing.tiers.push(source.tier);
      continue;
    }
    byUrl.set(source.url, {
      url: source.url,
      domains: [],
      families: [source.family],
      tiers: [source.tier],
      rows: 0,
      publisher: source.publisher,
      publishedAt: source.publishedAt,
      capture: source.capture,
    });
  }
  const tierRank = (tier: SourceTier): number =>
    tier === 'official' ? 0 : tier === 'primary' ? 1 : tier === 'aggregator' ? 2 : 3;
  return [...byUrl.values()].sort((a, b) => {
    const rankA = Math.min(...a.tiers.map(tierRank));
    const rankB = Math.min(...b.tiers.map(tierRank));
    return rankA - rankB || a.url.localeCompare(b.url);
  });
}

function sourceTable(input: DemoReportInput): string {
  const rows = sourceRows(input);
  if (rows.length === 0) return '<p class="muted">这批底稿没有证据行。</p>';
  const body = rows.map((row) => {
    const publisher = row.publisher ?? row.domains[0] ?? '（域名未记录）';
    const published = row.publishedAt ?? '—';
    const tiers = row.tiers.map((tier) => tierChip(tier)).join(' ');
    const family = row.families.join(' / ');
    return `<tr>
      <td><div class="source-name">${esc(publisher)}</div><a class="source-url" href="${esc(row.url)}" target="_blank" rel="noreferrer">${esc(row.url)}</a></td>
      <td>${tiers}</td>
      <td class="mono">${esc(family)}</td>
      <td>${esc(published)}</td>
      <td class="num">${row.rows}</td>
      <td class="mono">${esc(row.capture ?? '—')}</td>
    </tr>`;
  }).join('');
  return `<div class="table-wrap"><table class="source-table">
    <thead><tr><th>来源</th><th>档位</th><th>来源家族</th><th>发表时间</th><th>引用行</th><th>快照</th></tr></thead>
    <tbody>${body}</tbody>
  </table></div>`;
}

function recordCard(
  input: DemoReportInput,
  summary: RecordSummary,
  verdictByClaim: Map<string, VerdictRecord>,
  evidenceByClaim: Map<string, EvidenceRecord[]>,
  specByKey: Map<string, DemoFieldSpec>,
  anchor: AnchorRecord | undefined,
): string {
  const claimById = new Map(input.claims.map((claim) => [claim.claimId, claim]));
  const expectation = expectationOf(input.caseMeta, summary.recordId);
  const keyClaims = summary.keyClaimIds
    .map((claimId) => claimById.get(claimId))
    .filter((claim): claim is ClaimRecord => claim !== undefined);
  const secondaryClaims = summary.fieldClaimIds
    .filter((claimId) => !summary.keyClaimIds.includes(claimId))
    .map((claimId) => claimById.get(claimId))
    .filter((claim): claim is ClaimRecord => claim !== undefined);
  const title = keyClaims.find((claim) => claim.fieldKey === 'sessionName')?.object
    ?? keyClaims[0]?.object
    ?? summary.recordId;
  const house = keyClaims.find((claim) => claim.fieldKey === 'auctionHouse')?.object;
  const date = keyClaims.find((claim) => claim.fieldKey === 'dateText')?.object;
  const meta = [house, date].filter((value): value is string => Boolean(value)).join(' · ');
  const keyBlocks = keyClaims
    .map((claim) => claimBlock(claim, specByKey.get(claim.fieldKey ?? ''), verdictByClaim.get(claim.claimId), evidenceByClaim.get(claim.claimId) ?? [], false))
    .join('');
  const secondaryBlocks = secondaryClaims
    .map((claim) => claimBlock(claim, specByKey.get(claim.fieldKey ?? ''), verdictByClaim.get(claim.claimId), evidenceByClaim.get(claim.claimId) ?? [], true))
    .join('');
  const story = expectation?.story
    ? `<p class="story">${esc(expectation.story)}</p>`
    : '';
  const anchorHtml = anchor
    ? `<div class="anchor anchor-${esc(anchor.anchorGrade)}">
        <div class="anchor-head">
          ${gateBadge(anchor.anchorGrade)}
          ${gradeChip(anchor.evidenceGrade)}
          <span class="muted">${anchor.anchorGrade === 'strong' ? '共现页即坐标来源；默认可直接使用' : '支撑页并集；默认不可读，只作候选'}</span>
        </div>
        <ol class="url-list">${anchor.sourceUrls.map((url) => `<li><a href="${esc(url)}" target="_blank" rel="noreferrer">${esc(url)}</a></li>`).join('')}</ol>
        ${anchor.searchPhrases.length > 0 ? `<div class="phrases"><span class="muted">再入检索短语</span>${anchor.searchPhrases.map((phrase) => `<span class="phrase">${esc(phrase)}</span>`).join('')}</div>` : ''}
      </div>`
    : `<div class="anchor anchor-none"><strong>不导出坐标。</strong> ${esc(summary.reason)}</div>`;
  return `<section class="record record-${esc(summary.gate)}" id="rec-${esc(summary.recordId)}">
    <header class="record-head">
      <div>
        <div class="record-kicker">${esc(summary.recordId)}</div>
        <h2>${esc(title)}</h2>
        <p class="record-meta">${esc(meta)}</p>
      </div>
      <div class="record-badges">${gateBadge(summary.gate)}</div>
    </header>
    ${story}
    <p class="gate-reason"><span class="muted">门禁判定</span> ${esc(summary.reason)}</p>
    <div class="fields">${keyBlocks}</div>
    ${secondaryBlocks ? `<div class="secondary">${secondaryBlocks}</div>` : ''}
    ${anchorHtml}
  </section>`;
}

export function renderDemoReport(input: DemoReportInput): string {
  const live = input.liveMeta;
  const verdictByClaim = new Map(input.verdicts.map((verdict) => [verdict.claimId, verdict]));
  const evidenceByClaim = new Map<string, EvidenceRecord[]>();
  for (const row of input.evidence) {
    const bucket = evidenceByClaim.get(row.claimId);
    if (bucket) bucket.push(row);
    else evidenceByClaim.set(row.claimId, [row]);
  }
  for (const bucket of evidenceByClaim.values()) {
    bucket.sort((a, b) => {
      const rank = (relation: EvidenceRecord['relation']): number =>
        relation === 'supports' ? 0 : relation === 'refutes' ? 1 : 2;
      return rank(a.relation) - rank(b.relation) || a.evidenceId.localeCompare(b.evidenceId);
    });
  }
  const summaryByRecord = new Map(input.summaries.map((summary) => [summary.recordId, summary]));
  const anchorByRecord = new Map(input.anchors.map((anchor) => [anchor.recordId, anchor]));
  const specByKey = new Map(input.fields.map((field) => [field.key, field]));
  const expectationOrder = input.caseMeta?.expectations.map((item) => item.recordId) ?? [];
  const recordIds = unique([
    ...expectationOrder.filter((recordId) => summaryByRecord.has(recordId)),
    ...input.summaries.map((summary) => summary.recordId).sort(),
  ]);
  const summaries = recordIds
    .map((recordId) => summaryByRecord.get(recordId))
    .filter((summary): summary is RecordSummary => summary !== undefined);

  const verdictCounts = countBy(input.verdicts.map((verdict) => verdict.verdict));
  const gateCounts = countBy(input.summaries.map((summary) => summary.gate));
  const readable = input.anchors.filter((anchor) => isReadableAnchor(anchor)).length;
  const sourceCount = unique(input.evidence.map((row) => row.url)).length;
  const title = input.caseMeta?.title ?? `OpenLodestar 演示：${input.exampleName}`;
  const subtitle = input.caseMeta?.subtitle ?? '从冻结的证据底稿重算裁决、记录门禁与坐标';
  const summaryText = input.caseMeta?.summary
    ?? `这批底稿有 ${input.claims.length} 条断言、${input.evidence.length} 条证据；` +
      `重算后得到 ${input.summaries.length} 条记录，其中 ${gateCounts.get('strong') ?? 0} 条强档、` +
      `${gateCounts.get('weak') ?? 0} 条弱档、${gateCounts.get('rejected') ?? 0} 条拒收。`;

  const overviewRows = summaries.map((summary) => {
    const expectation = expectationOf(input.caseMeta, summary.recordId);
    const anchor = anchorByRecord.get(summary.recordId);
    const anchorCell = anchor
      ? `${gateBadge(anchor.anchorGrade, true)} ${gradeChip(anchor.evidenceGrade)}`
      : '<span class="muted">—</span>';
    const story = expectation?.story
      ?? `${compositionOf(summary, verdictByClaim)}；${summary.reason}`;
    return `<tr>
      <td><a class="record-link" href="#rec-${esc(summary.recordId)}">${esc(summary.recordId)}</a></td>
      <td>${esc(compositionOf(summary, verdictByClaim))}</td>
      <td>${gateBadge(summary.gate, true)}</td>
      <td>${anchorCell}</td>
      <td class="story-cell">${esc(story)}</td>
    </tr>`;
  }).join('');

  const recordCards = summaries.map((summary) =>
    recordCard(input, summary, verdictByClaim, evidenceByClaim, specByKey, anchorByRecord.get(summary.recordId)),
  ).join('');

  const notProven = input.caseMeta?.notProven ?? [];
  const limitations = input.caseMeta?.limitations ?? [];
  const guardOk = input.guard.violations.length === 0;
  const guardViolations = input.guard.violations.map((violation) => `<li><strong>${esc(violation.evidenceId)}</strong> · ${esc(violation.url)}<br><span class="mono">${esc(violation.reason)}</span></li>`).join('');
  const unverifiable = input.guard.clueUnverifiable.map((item) => `<li>${esc(item)}</li>`).join('');
  const verdictLegend = (['supported', 'refuted', 'conflicting', 'not_found'] as Verdict[])
    .map((verdict) => `<span class="legend-item"><span class="chip chip-${verdict}">${esc(VERDICT_LABEL[verdict])}</span><span class="muted">${esc(verdict)}</span></span>`)
    .join('');
  const liveChecks = live?.expectationChecks ?? [];
  const liveCheckRows = liveChecks.map((check) => `<tr>
      <td class="mono">${esc(check.recordId)}</td>
      <td>${esc(check.expected)}</td>
      <td>${esc(check.actual)}</td>
      <td>${check.ok ? '<span class="badge badge-strong badge-small">一致</span>' : '<span class="badge badge-rejected badge-small">不一致</span>'}</td>
    </tr>`).join('');
  const liveNotes = live?.notes ?? [];

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · OpenLodestar</title>
<style>
  :root {
    --ink: #1c1917;
    --muted: #6b6560;
    --faint: #a8a29e;
    --line: #e0dbd3;
    --paper: #f7f3ec;
    --card: #fffdf8;
    --teal: #0f766e;
    --teal-soft: #d9f0ec;
    --amber: #b45309;
    --amber-soft: #fbe9d2;
    --red: #b91c1c;
    --red-soft: #fbe2e2;
    --violet: #6d28d9;
    --violet-soft: #ede4fb;
    --slate-soft: #e7e5e4;
    --mono: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    color: var(--ink);
    background:
      radial-gradient(1100px 420px at 12% -8%, #fff9ed 0%, transparent 62%),
      radial-gradient(900px 380px at 88% 0%, #eef8f5 0%, transparent 58%),
      var(--paper);
    font: 16px/1.75 "Songti SC", "Noto Serif CJK SC", "Source Han Serif SC", Georgia, serif;
  }
  .wrap { max-width: 1120px; margin: 0 auto; padding: 56px 28px 72px; }
  a { color: var(--teal); text-decoration-thickness: 1px; text-underline-offset: 3px; }
  a:hover { color: var(--ink); }
  .eyebrow { font: 600 12px/1.4 var(--mono); letter-spacing: .16em; color: var(--teal); text-transform: uppercase; }
  h1 { margin: 12px 0 10px; font-size: clamp(30px, 4.4vw, 46px); line-height: 1.18; letter-spacing: -.01em; font-weight: 600; }
  .subtitle { margin: 0 0 18px; font-size: 19px; color: #44403c; }
  .lede { max-width: 860px; margin: 0 0 24px; color: var(--muted); }
  .query { margin: 24px 0 0; padding: 16px 18px; border-left: 3px solid var(--teal); background: rgba(255,253,248,.75); border-radius: 0 10px 10px 0; }
  .query .label { font: 600 11px/1 var(--mono); letter-spacing: .12em; color: var(--muted); text-transform: uppercase; }
  .query p { margin: 6px 0 0; font-size: 18px; }
  .meta-line { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 14px; font: 12px/1.5 var(--mono); color: var(--muted); }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(132px, 1fr)); gap: 10px; margin: 28px 0 12px; }
  .stat { padding: 14px 14px 12px; border: 1px solid var(--line); border-radius: 12px; background: rgba(255,253,248,.8); }
  .stat .n { display: block; font: 600 26px/1.1 var(--mono); letter-spacing: -.02em; }
  .stat .k { display: block; margin-top: 4px; font-size: 12px; color: var(--muted); }
  .stat.ok .n { color: var(--teal); }
  .stat.warn .n { color: var(--amber); }
  .stat.bad .n { color: var(--red); }
  h2 { font-size: 25px; line-height: 1.3; margin: 0; font-weight: 600; }
  h3 { font-size: 18px; margin: 0 0 10px; }
  .section { margin-top: 52px; }
  .section-head { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; margin-bottom: 14px; }
  .section-head h2 { font-size: 22px; }
  .section-head .muted { font-size: 13px; }
  .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 14px; background: var(--card); }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th { text-align: left; font: 600 11px/1.3 var(--mono); letter-spacing: .08em; color: var(--muted); text-transform: uppercase; padding: 12px 14px; border-bottom: 1px solid var(--line); background: #fbf8f2; }
  td { padding: 12px 14px; border-bottom: 1px solid #eee9e1; vertical-align: top; }
  tr:last-child td { border-bottom: 0; }
  .story-cell { min-width: 280px; color: #44403c; }
  .record-link { font: 12px/1.4 var(--mono); text-decoration: none; }
  .record { margin-top: 22px; padding: 26px 26px 24px; border: 1px solid var(--line); border-left: 5px solid var(--faint); border-radius: 12px; background: var(--card); box-shadow: 0 1px 0 rgba(28,25,23,.03); scroll-margin-top: 18px; }
  .record-strong { border-left-color: var(--teal); }
  .record-weak { border-left-color: var(--amber); }
  .record-rejected { border-left-color: var(--red); }
  .record-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
  .record-kicker { font: 11px/1.4 var(--mono); letter-spacing: .08em; color: var(--faint); margin-bottom: 5px; }
  .record-meta { margin: 4px 0 0; color: var(--muted); font-size: 14px; }
  .record-badges { padding-top: 4px; }
  .story { margin: 14px 0 0; padding: 12px 14px; background: #fbf8f2; border-radius: 9px; color: #3f3a36; }
  .gate-reason { margin: 10px 0 0; font-size: 14px; color: #44403c; }
  .muted { color: var(--muted); }
  .mono { font-family: var(--mono); font-size: .92em; }
  .badge { display: inline-block; padding: 4px 9px; border-radius: 999px; font: 600 11px/1.4 var(--mono); letter-spacing: .04em; border: 1px solid transparent; white-space: nowrap; }
  .badge-strong { color: var(--teal); background: var(--teal-soft); border-color: #a7dcd4; }
  .badge-weak { color: var(--amber); background: var(--amber-soft); border-color: #efd0a8; }
  .badge-rejected { color: var(--red); background: var(--red-soft); border-color: #efb9b9; }
  .badge-small { padding: 2px 7px; font-size: 10px; }
  .chip { display: inline-block; padding: 2px 8px; border-radius: 6px; font: 600 11px/1.5 var(--mono); white-space: nowrap; border: 1px solid transparent; }
  .chip-supported { color: var(--teal); background: var(--teal-soft); border-color: #b7e1da; }
  .chip-refuted { color: var(--red); background: var(--red-soft); border-color: #efc0c0; }
  .chip-conflicting { color: var(--violet); background: var(--violet-soft); border-color: #d8c6f5; }
  .chip-not_found { color: #57534e; background: var(--slate-soft); border-color: #d6d3d1; }
  .chip-empty { color: var(--muted); background: #f5f5f4; }
  .cause { margin-left: 5px; font-weight: 400; opacity: .75; }
  .grade { display: inline-block; padding: 1px 6px; border: 1px solid var(--line); border-radius: 5px; font: 600 11px/1.5 var(--mono); color: #44403c; background: #fff; cursor: help; }
  .counts { font: 11px/1.5 var(--mono); color: var(--muted); }
  .tier { display: inline-block; padding: 0 6px; border-radius: 4px; font: 600 10px/1.7 var(--mono); letter-spacing: .03em; }
  .tier-official { color: #1d4ed8; background: #e0e9ff; }
  .tier-primary { color: #0f766e; background: #d9f0ec; }
  .tier-aggregator { color: #92400e; background: #fef0d7; }
  .tier-unlisted { color: #57534e; background: #eeeceb; }
  .relation { display: inline-block; padding: 0 6px; border-radius: 4px; font: 600 10px/1.7 var(--mono); }
  .relation-supports { color: var(--teal); background: var(--teal-soft); }
  .relation-refutes { color: var(--red); background: var(--red-soft); }
  .relation-irrelevant { color: #57534e; background: var(--slate-soft); }
  .fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 18px; }
  .fields > .claim:last-child:nth-child(odd) { grid-column: 1 / -1; }
  .claim { border: 1px solid #eae5dd; border-radius: 10px; padding: 15px 15px 12px; background: #fffefb; }
  .claim-head { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; align-items: baseline; }
  .claim-name { display: flex; align-items: baseline; gap: 8px; }
  .field-label { font-weight: 600; }
  .field-key { font: 10px/1.4 var(--mono); color: var(--faint); }
  .claim-verdict { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .claim-value { margin: 9px 0 2px; font-size: 18px; font-weight: 600; }
  .claim-text { margin: 0; font-size: 13px; color: var(--muted); }
  .verdict-reason { margin: 8px 0 0; font-size: 12px; color: #57534e; }
  .ev-list { list-style: none; margin: 12px 0 0; padding: 0; display: grid; gap: 10px; }
  .ev { border-top: 1px dashed #e7e1d8; padding-top: 10px; }
  .ev-head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 12px; }
  .ev-domain { font-family: var(--mono); color: #57534e; }
  .ev-field { font: 10px/1.4 var(--mono); color: var(--faint); }
  .ev-id { margin-left: auto; font: 10px/1.4 var(--mono); color: var(--faint); }
  .quote { margin: 8px 0 0; padding: 8px 12px; border-left: 3px solid #d8d2c8; background: #faf8f4; font-size: 13px; line-height: 1.7; color: #292524; }
  .ev-note { margin: 6px 0 0; font-size: 12px; color: var(--amber); }
  .ev-foot { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 6px; font-size: 11px; }
  .ev-link { font-size: 11px; }
  .secondary { margin-top: 12px; }
  .claim-compact { background: #fbfaf7; }
  .claim-compact summary { cursor: pointer; font-size: 13px; color: #44403c; }
  .claim-compact summary .chip { margin-left: 4px; }
  .anchor { margin-top: 18px; padding: 14px 16px; border-radius: 10px; border: 1px solid #cfe7e2; background: #f2faf8; }
  .anchor-weak { border-color: #efd9b8; background: #fdf7ec; }
  .anchor-none { border-color: #e7c5c5; background: #fdf3f3; color: #7f1d1d; }
  .anchor-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .url-list { margin: 10px 0 0; padding-left: 20px; font-size: 12px; }
  .url-list li { margin: 3px 0; word-break: break-all; }
  .phrases { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-top: 10px; font-size: 11px; }
  .phrase { padding: 2px 7px; border-radius: 5px; background: #fff; border: 1px solid var(--line); font-size: 11px; }
  .callout { margin-top: 16px; padding: 18px 20px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
  .callout ul { margin: 8px 0 0; padding-left: 22px; }
  .callout li { margin: 6px 0; }
  .guard { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-top: 10px; }
  .guard .stat { background: #fffdf8; }
  .guard-ok { border-color: #b7e1da; background: #f2faf8; }
  .guard-bad { border-color: #efc0c0; background: #fdf3f3; }
  .violations { margin: 12px 0 0; padding-left: 20px; color: #7f1d1d; font-size: 13px; }
  .legend { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 12px; font-size: 11px; }
  .legend-item { display: inline-flex; gap: 5px; align-items: center; }
  pre.cmd { margin: 12px 0 0; padding: 14px 16px; overflow-x: auto; background: #1c1917; color: #f5f5f4; border-radius: 10px; font: 12px/1.7 var(--mono); }
  footer { margin-top: 56px; padding-top: 18px; border-top: 1px solid var(--line); color: var(--muted); font-size: 12px; display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  @media (max-width: 760px) {
    .wrap { padding: 34px 16px 48px; }
    .fields { grid-template-columns: 1fr; }
    .record { padding: 18px 16px; }
    .stats { grid-template-columns: repeat(2, 1fr); }
    th, td { padding: 10px; }
  }
  @media print {
    body { background: #fff; }
    .record, .callout, .table-wrap { break-inside: avoid; box-shadow: none; }
    a { color: inherit; }
  }
</style>
</head>
<body>
<main class="wrap">
  <header>
    <div class="eyebrow">OpenLodestar · ${live ? `live run · ${esc(live.mode)}` : 'offline evidence rebuild'}</div>
    <h1>${esc(title)}</h1>
    <p class="subtitle">${esc(subtitle)}</p>
    <p class="lede">${esc(summaryText)}</p>
    <div class="query">
      <span class="label">这次要核的提问</span>
      <p>${esc(input.query)}</p>
    </div>
    <div class="meta-line">
      ${live
        ? `<span>运行目录 ${esc(displayPath(input.workDir))}</span>
      <span>输入底稿 ${esc(displayPath(input.fixtureDir))}</span>
      <span>检索提供者 ${esc(live.provider)}</span>
      <span>预算 检索 ${live.caps.maxSearchCalls} 条/记录 · 抓取 ${live.caps.maxPages} 页/断言${live.caps.maxRecords !== undefined ? ` · 记录上限 ${live.caps.maxRecords}` : ''}</span>
      <span>开始 ${esc(live.startedAt)}</span>
      <span>结束 ${esc(live.finishedAt)}</span>`
        : `<span>底稿 ${esc(displayPath(input.fixtureDir))}</span>
      <span>工作副本 ${esc(displayPath(input.workDir))}</span>
      <span>抓取日期 ${esc(input.caseMeta?.capturedAt ?? '—')}</span>
      <span>报告生成 ${esc(input.generatedAt)}</span>`}
    </div>
    <div class="stats">
      <div class="stat"><span class="n">${input.claims.length}</span><span class="k">条断言</span></div>
      <div class="stat"><span class="n">${input.evidence.length}</span><span class="k">条证据行</span></div>
      <div class="stat"><span class="n">${sourceCount}</span><span class="k">个来源页面</span></div>
      <div class="stat ok"><span class="n">${gateCounts.get('strong') ?? 0}</span><span class="k">条强档记录</span></div>
      <div class="stat warn"><span class="n">${gateCounts.get('weak') ?? 0}</span><span class="k">条弱档记录</span></div>
      <div class="stat bad"><span class="n">${gateCounts.get('rejected') ?? 0}</span><span class="k">条拒收记录</span></div>
      <div class="stat"><span class="n">${readable}/${input.anchors.length}</span><span class="k">可读坐标</span></div>
      <div class="stat ${guardOk ? 'ok' : 'bad'}"><span class="n">${input.guard.violations.length}</span><span class="k">引文违规</span></div>
    </div>
    <div class="legend">
      ${verdictLegend}
      <span class="legend-item"><span class="badge badge-strong badge-small">强坐标</span><span class="muted">关键字段同页共现，默认可用</span></span>
      <span class="legend-item"><span class="badge badge-weak badge-small">弱坐标</span><span class="muted">字段各自成立，默认不可读</span></span>
    </div>
  </header>

  <section class="section">
    <div class="section-head"><h2>一眼看懂</h2><span class="muted">每条记录只回答一个问题：关键字段能不能在同一页上同时站住？</span></div>
    <div class="table-wrap"><table>
      <thead><tr><th>记录</th><th>关键字段裁决</th><th>门禁</th><th>坐标</th><th>这条记录说明了什么</th></tr></thead>
      <tbody>${overviewRows}</tbody>
    </table></div>
  </section>

  ${liveChecks.length > 0 ? `<section class="section">
    <div class="section-head"><h2>与离线底稿的对照</h2><span class="muted">同一条记录：冻结局的预期 vs 本次实时证据的结论</span></div>
    <div class="table-wrap"><table>
      <thead><tr><th>记录</th><th>离线预期</th><th>本次结果</th><th>是否一致</th></tr></thead>
      <tbody>${liveCheckRows}</tbody>
    </table></div>
    ${liveNotes.length > 0 ? `<div class="callout"><ul>${liveNotes.map((note) => `<li>${esc(note)}</li>`).join('')}</ul></div>` : ''}
  </section>` : ''}

  <section class="section">
    <div class="section-head"><h2>证据链</h2><span class="muted">从结论往回走：每条裁决都指得到证据行，每条引文都指得到原页</span></div>
    ${recordCards}
  </section>

  ${notProven.length > 0 ? `<section class="section">
    <div class="section-head"><h2>没有被证明的事</h2><span class="muted">查不到、被反驳、只到弱档，都是正式结论</span></div>
    <div class="callout"><ul>${notProven.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></div>
  </section>` : ''}

  <section class="section">
    <div class="section-head"><h2>来源与档位</h2><span class="muted">同域、转载与镜像只算一个家族；家族数决定证据等级</span></div>
    ${sourceTable(input)}
  </section>

  <section class="section">
    <div class="section-head"><h2>这次运行检查了什么</h2><span class="muted">引文硬护栏：逐字命中自己的快照，并且写到所裁字段</span></div>
    <div class="guard">
      <div class="stat"><span class="n">${input.guard.total}</span><span class="k">证据行</span></div>
      <div class="stat ok"><span class="n">${input.guard.verbatimOk}</span><span class="k">逐字命中</span></div>
      <div class="stat ok"><span class="n">${input.guard.clueOk}</span><span class="k">字段线索通过</span></div>
      <div class="stat ${guardOk ? 'ok guard-ok' : 'bad guard-bad'}"><span class="n">${input.guard.violations.length}</span><span class="k">违规</span></div>
    </div>
    ${!guardOk ? `<ol class="violations">${guardViolations}</ol>` : ''}
    ${unverifiable !== '' ? `<div class="callout"><p class="muted">字段线索判据未能适用的行：</p><ul>${unverifiable}</ul></div>` : ''}
    <pre class="cmd">${live
      ? `npx tsx src/cli.ts verify-quotes --data ${esc(displayPath(input.workDir))}
npx tsx src/cli.ts audit --data ${esc(displayPath(input.workDir))}`
      : `npx tsx src/cli.ts demo --example ${esc(input.exampleName)}
npx tsx src/cli.ts verify-quotes --data ${esc(displayPath(input.workDir))}
npx tsx src/cli.ts audit --data ${esc(displayPath(input.workDir))}`}</pre>
    <p class="muted" style="margin-top:10px;font-size:13px">${live
      ? '本次证据由实时检索与抓取产生，重跑未必得到同一批页面；上面的命令只读复核这份运行底稿与快照，不会重新联网。'
      : '以上命令全部离线：不重新检索、不重新抓取、不调用模型。报告本身只是把这次重算的结果排版出来。'}</p>
  </section>

  ${limitations.length > 0 ? `<section class="section">
    <div class="section-head"><h2>边界</h2><span class="muted">一个诚实的演示，也要说清它没有证明什么</span></div>
    <div class="callout"><ul>${limitations.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></div>
  </section>` : ''}

  <footer>
    <span>OpenLodestar · Apache-2.0 · 生成于 ${esc(input.generatedAt)}</span>
    <span>${esc([...verdictCounts.entries()].map(([key, value]) => `${VERDICT_LABEL[key]} ${value}`).join(' · '))}</span>
  </footer>
</main>
</body>
</html>
`;
}
