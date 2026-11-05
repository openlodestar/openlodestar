// src/demo-page/freeze-batch.ts
/**
 * 把一次 live 运行目录冻结成 `examples/<批次>/`（唯一真源）。
 *
 * 冻结做的事：
 * 1. 只保留"关键字段全部裁决完"的记录——半截记录不能当演示素材；
 * 2. 断言按 claimId 去重（底稿只追加不改写，同一断言会有多条状态行，只留最后一条）；
 * 3. 快照从整页正文裁成"含引文的段落 + 直接上下文"，每页不超过 2000 字符，
 *    并改写 evidence.jsonl 的 snapshotRef 指向裁好的 .txt；
 * 4. 生成 case.json / query.txt / THIRD_PARTY_NOTICES.md，形状与 poly-2021-autumn 一致。
 *
 * 用法：
 *   pnpm exec tsx src/demo-page/freeze-batch.ts \
 *     --run .openlodestar-demo/live/demo-batch-1/full \
 *     --out examples/demo-batch-1 \
 *     --query "……" --title "……" --subtitle "……"
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { locateQuote } from './quote-locate';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SNAPSHOT_LIMIT = 2000;

interface ClaimLike {
  claimId: string;
  recordId: string;
  fieldKey: string | null;
  fieldRole: 'key' | 'secondary';
  object: string;
  atomicText: string;
  state: string;
  triage?: { passed?: boolean };
}

interface EvidenceLike {
  evidenceId: string;
  claimId: string;
  recordId: string;
  fieldKey: string | null;
  url: string;
  domain: string;
  sourceFamily: string;
  tier: string;
  quote: string;
  snapshotRef: string;
  fetchedAt: string;
  note?: string;
  relation: string;
  contentWeight: number;
  fetchedBy: string;
  traceId: string;
}

function parseArgs(argv: string[]): Map<string, string> {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`参数 ${item} 缺少值`);
    }
    args.set(key, value);
    index += 1;
  }
  return args;
}

async function readJsonl<T>(file: string): Promise<T[]> {
  const raw = await fs.readFile(file, 'utf8');
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line) as T);
}

/** 底稿只追加不改写：同一 claimId 有多行状态，最后一行才是当前状态 */
function lastByKey<T>(rows: T[], keyOf: (row: T) => string): T[] {
  const map = new Map<string, T>();
  for (const row of rows) map.set(keyOf(row), row);
  return [...map.values()];
}

/**
 * 裁出"含引文段落 + 上下文"的节选。
 * 每条引文都要落在节选里（verify-quotes 要逐字核对），所以先按每段 ±padding 取窗口，
 * 合并重叠窗口后再压到 2000 字符以内；压不进去就报错，不静默丢引文。
 *
 * 定位引文用 `locateQuote`：边界与 `quoteMatches` 一致，跨标签/空白/实体的引文也能找到。
 */
function buildExcerpt(text: string, quotes: string[], url: string): string {
  const spans: Array<{ start: number; end: number }> = [];
  for (const quote of quotes) {
    const at = locateQuote(text, quote);
    if (at === null) throw new Error(`${url}: 引文不在快照正文里：${quote.slice(0, 40)}`);
    spans.push({ start: Math.max(0, at.start - 260), end: Math.min(text.length, at.end + 260) });
  }
  spans.sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last !== undefined && span.start <= last.end) {
      last.end = Math.max(last.end, span.end);
    } else {
      merged.push({ ...span });
    }
  }
  const mark = (slice: string, start: number, end: number): string =>
    `${start > 0 ? '……' : ''}${slice}${end < text.length ? '……' : ''}`;
  const wide = merged.map((span) => mark(text.slice(span.start, span.end), span.start, span.end)).join('\n……\n');
  if (wide.length <= SNAPSHOT_LIMIT) return wide;
  // 上下文收紧到 ±60 字符再试；仍超限就明确失败，别把某条引文悄悄裁掉
  const tightSpans = quotes
    .map((quote) => {
      const at = locateQuote(text, quote);
      if (at === null) throw new Error(`${url}: 引文不在快照正文里：${quote.slice(0, 40)}`);
      return { start: Math.max(0, at.start - 60), end: Math.min(text.length, at.end + 60) };
    })
    .sort((a, b) => a.start - b.start);
  const tightMerged: Array<{ start: number; end: number }> = [];
  for (const span of tightSpans) {
    const last = tightMerged[tightMerged.length - 1];
    if (last !== undefined && span.start <= last.end) {
      last.end = Math.max(last.end, span.end);
    } else {
      tightMerged.push({ ...span });
    }
  }
  const tight = tightMerged
    .map((span) => mark(text.slice(span.start, span.end), span.start, span.end))
    .join('\n……\n');
  if (tight.length <= SNAPSHOT_LIMIT) return tight;
  throw new Error(`${url}: 同一页的多条引文合起来超过 ${SNAPSHOT_LIMIT} 字符，需要先拆页或减少引文`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const runDir = path.resolve(PACKAGE_ROOT, args.get('run') ?? '');
  const outDir = path.resolve(PACKAGE_ROOT, args.get('out') ?? '');
  const query = args.get('query');
  if (!args.has('run') || !args.has('out') || query === undefined) {
    throw new Error('必须给 --run、--out、--query');
  }
  const exampleId = path.basename(outDir);
  const title = args.get('title') ?? exampleId;
  const subtitle = args.get('subtitle') ?? '一次真实在线采集的冻结结果';
  const capturedAt = args.get('captured-at') ?? new Date().toISOString().slice(0, 10);

  const rawClaims = await readJsonl<ClaimLike>(path.join(runDir, 'claims.jsonl'));
  const rawEvidence = await readJsonl<EvidenceLike>(path.join(runDir, 'evidence.jsonl'));
  const claims = lastByKey(rawClaims, (claim) => claim.claimId);

  const recordIds = [...new Set(claims.map((claim) => claim.recordId))];
  const keptRecords: string[] = [];
  const droppedRecords: Array<{ recordId: string; reason: string }> = [];
  for (const recordId of recordIds) {
    const recordClaims = claims.filter((claim) => claim.recordId === recordId);
    const keyClaims = recordClaims.filter((claim) => claim.fieldRole === 'key');
    const adjudicated = keyClaims.filter((claim) => claim.state === 'adjudicated');
    if (keyClaims.length < 2) {
      droppedRecords.push({ recordId, reason: `关键字段只有 ${keyClaims.length} 条，凑不齐一组` });
      continue;
    }
    if (adjudicated.length !== keyClaims.length) {
      droppedRecords.push({
        recordId,
        reason: `关键字段只裁决了 ${adjudicated.length}/${keyClaims.length} 条（其余在提问阶段就被拒或没跑完）`,
      });
      continue;
    }
    keptRecords.push(recordId);
  }
  if (keptRecords.length === 0) {
    throw new Error('这次运行没有一条记录的关键字段全部裁决完，不能冻结成演示批次');
  }

  const keptClaims = claims.filter((claim) => keptRecords.includes(claim.recordId));
  const keptClaimIds = new Set(keptClaims.map((claim) => claim.claimId));
  const keptEvidence = lastByKey(
    rawEvidence.filter((row) => keptClaimIds.has(row.claimId)),
    (row) => row.evidenceId,
  );

  // 快照：同一页的多条引文合并成一份节选
  const snapshotGroups = new Map<string, EvidenceLike[]>();
  for (const row of keptEvidence) {
    const list = snapshotGroups.get(row.snapshotRef) ?? [];
    list.push(row);
    snapshotGroups.set(row.snapshotRef, list);
  }
  const snapshotDir = path.join(outDir, 'snapshots');
  await fs.mkdir(snapshotDir, { recursive: true });
  const newRefByOld = new Map<string, string>();
  const snapshotReport: string[] = [];
  for (const [oldRef, rows] of snapshotGroups) {
    const text = await fs.readFile(path.join(runDir, oldRef), 'utf8');
    const quoteList = [...new Set(rows.map((row) => row.quote))];
    const excerpt = buildExcerpt(text, quoteList, rows[0].url);
    const hash = crypto.createHash('sha256').update(text).digest('hex');
    const slug = `page-${rows[0].evidenceId.split('-').pop() ?? 'x'}`.toLowerCase();
    const newRef = `snapshots/${slug}.txt`;
    const header = [
      '【节选·非全文】',
      `来源：${rows[0].domain}`,
      `原文：${rows[0].url}`,
      `抓取：${rows[0].fetchedAt} · Lodestar 自抓（渲染后本地抽取正文）`,
      `裁剪：保留含引文的段落与直接上下文；全文 ${text.length} 字 → 本节选 ${excerpt.length} 字`,
      `指纹：全文 SHA-256 ${hash}`,
      '说明：本文件不是原文全文。导航、广告、推荐位与页脚已删除；省略处用「……」标出。',
      '────────────────────────────────────────',
    ].join('\n');
    await fs.writeFile(path.join(outDir, newRef), `${header}\n${excerpt}\n`, 'utf8');
    newRefByOld.set(oldRef, newRef);
    snapshotReport.push(`${newRef} ← ${rows[0].url}（${excerpt.length} 字，${rows.length} 条证据）`);
  }

  const frozenEvidence = keptEvidence.map((row) => ({
    ...row,
    snapshotRef: newRefByOld.get(row.snapshotRef) ?? row.snapshotRef,
  }));

  await fs.writeFile(
    path.join(outDir, 'claims.jsonl'),
    `${keptClaims.map((claim) => JSON.stringify(claim)).join('\n')}\n`,
    'utf8',
  );
  await fs.writeFile(
    path.join(outDir, 'evidence.jsonl'),
    `${frozenEvidence.map((row) => JSON.stringify(row)).join('\n')}\n`,
    'utf8',
  );
  await fs.writeFile(path.join(outDir, 'query.txt'), `${query}\n`, 'utf8');

  // case.json：形状与 poly 一致；expectations 留空——演示结论以引擎重算为准，不在这里预写
  const sources = snapshotGroups.size
    ? [...snapshotGroups.entries()].map(([oldRef, rows], index) => ({
        id: `src-${index + 1}`,
        url: rows[0].url,
        publisher: rows[0].domain,
        publishedAt: '',
        tier: rows[0].tier,
        family: rows[0].sourceFamily,
        capture: newRefByOld.get(oldRef) ?? oldRef,
        snapshotKind: 'excerpt',
        capturedAt: rows[0].fetchedAt,
      }))
    : [];
  const caseJson = {
    id: exampleId,
    title,
    subtitle,
    query,
    capturedAt,
    summary:
      `一次真实在线采集的冻结批次，保留 ${keptRecords.length} 条记录、${keptClaims.length} 条断言、` +
      `${frozenEvidence.length} 条证据、${snapshotGroups.size} 份页面节选。` +
      '判定由引擎从这批证据重算，不沿用在线运行的结论。',
    sources,
    expectations: [],
    notProven: keptRecords.map(
      (recordId) =>
        `${recordId}：这只是"这批证据里的结论"。抓取有预算上限，页面也可能随时间变化；` +
        '页面上的"查不到"说的是这批节选里没有，不是世界上不存在。',
    ),
    limitations: [
      '这是一次 live 运行的冻结结果：搜索排名、页面可达性与模型输出都不可复现，同一个问题再跑一次可能得到别的记录。',
      '快照是渲染后正文的节选，不是全文；裁剪规则是"含引文的段落 + 直接上下文"，每页不超过 2000 字符。',
      '只保留关键字段全部裁决完的记录；在提问阶段被稳定性筛掉或没跑完的记录已剔除。',
    ],
  };
  await fs.writeFile(path.join(outDir, 'case.json'), `${JSON.stringify(caseJson, null, 2)}\n`, 'utf8');

  const domainByUrl = new Map(frozenEvidence.map((row) => [row.url, row.domain]));
  const noticeRows = sources
    .map(
      (source) =>
        `| ${source.publisher} | <${source.url}> | 含引文的段落与直接上下文 | ${domainByUrl.get(source.url) ?? ''} |`,
    )
    .join('\n');
  await fs.writeFile(
    path.join(outDir, 'THIRD_PARTY_NOTICES.md'),
    `# 第三方内容声明

本目录（\`examples/${exampleId}/\`）除了项目自有内容，还包含从公开网页摘录的第三方文字。
这些文字**不在 OpenLodestar 的 Apache-2.0 授权范围内**，版权归各原出版方所有。

## 摘录了什么

| 来源 | 原文 | 摘录范围 | 原页域名 |
| --- | --- | --- | --- |
${noticeRows}

## 为什么这样摘

- 目的：演示"一条结论要能逐字回到它的来源"。引文是核验对象，上下文只保留到能读懂引文为止。
- 每份快照都删掉了导航、广告、推荐位与页脚；正文只留含引文的段落与直接上下文，每页不超过 2000 字符。
- 每份快照第一行标「节选·非全文」，并记录原文 URL、抓取时间与全文 SHA-256。

## 署名与用途

- 所有引文都保留了原域名与原页链接。
- 这些摘录仅用于说明核验机制，不对原作品作改写、演绎或商业再利用。
- 如原出版方认为某段摘录超出适当引用范围，请通过仓库 Issue 联系；我们会移除或缩短相应段落。

## 与本目录许可证的关系

- 本目录中项目自有的结构化内容（\`case.json\`、\`claims.jsonl\`、\`evidence.jsonl\`、\`query.txt\`、
  本文件）随仓库按 Apache-2.0 授权。
- 这些文件里的 \`quote\` 字段与 \`snapshots/\` 下的正文摘录仍是第三方文字，版权归原出版方，
  不适用 Apache-2.0。
- 需要完整原文时，请访问上表中的原始链接，以原出版方发布的版本为准。
`,
    'utf8',
  );

  console.log(`froze ${exampleId}`);
  console.log(`  records kept: ${keptRecords.join(', ')}`);
  for (const dropped of droppedRecords) console.log(`  dropped ${dropped.recordId}: ${dropped.reason}`);
  console.log(`  claims=${keptClaims.length} evidence=${frozenEvidence.length} snapshots=${snapshotGroups.size}`);
  for (const line of snapshotReport) console.log(`  ${line}`);
}

main().catch((error) => {
  console.error('Failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
