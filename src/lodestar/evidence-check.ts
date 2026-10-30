// src/lodestar/evidence-check.ts
/**
 * 引文硬校验（离线 demo、verify-quotes 与在线实验共用）
 *
 * 两道判据缺一不可：
 * 1. 引文必须逐字出现在**这一行自己的快照**里——快照是当初真正喂给比对模型的那份正文；
 *    "逐字"指字与标点一致，空白与不可见格式字符不计（规则见 `quoteMatches`）；
 * 2. 引文必须写到它所支持的字段（`quoteBearsFieldClue`）——防止"页面确实说了这场拍卖"
 *    被拿来给任何一个字段凑数。
 *
 * 在线实验也必须过同一道闸：实时抓回来的页面同样落快照，规则不因"这是在线跑"而放松。
 */

import { describeQuoteMismatch, quoteMatches } from './adjudicate/compare';
import type { DomainPack } from './packs/pack';
import { readSnapshot, type LodestarStore } from './storage/adapter';
import type { ClaimRecord, EvidenceRecord } from './types';

export interface EvidenceViolation {
  evidenceId: string;
  claimId: string;
  url: string;
  reason: string;
}

export interface EvidenceCheck {
  total: number;
  verbatimOk: number;
  clueOk: number;
  violations: EvidenceViolation[];
  /** 取不到字段值、第二道判据未能适用（告警不判失败） */
  clueUnverifiable: string[];
}

export async function inspectEvidence(
  store: LodestarStore,
  rows: EvidenceRecord[],
  claimById: Map<string, ClaimRecord>,
  pack: DomainPack,
): Promise<EvidenceCheck> {
  const check: EvidenceCheck = {
    total: rows.length,
    verbatimOk: 0,
    clueOk: 0,
    violations: [],
    clueUnverifiable: [],
  };

  for (const row of rows) {
    if (row.fetchedBy !== 'lodestar') {
      check.violations.push({
        evidenceId: row.evidenceId,
        claimId: row.claimId,
        url: row.url,
        reason: `fetchedBy=${String(row.fetchedBy)}（证据必须由本管线自抓；自家派生物充当证据即违规）`,
      });
      continue;
    }

    const snapshot = await readSnapshot(store, row.snapshotRef);
    if (snapshot === null) {
      check.violations.push({
        evidenceId: row.evidenceId,
        claimId: row.claimId,
        url: row.url,
        reason: `快照文件缺失（${row.snapshotRef}）——没有可比对的正文，引文无法自证`,
      });
      continue;
    }
    if (!quoteMatches(row.quote, snapshot)) {
      const hint = describeQuoteMismatch(row.quote, snapshot);
      check.violations.push({
        evidenceId: row.evidenceId,
        claimId: row.claimId,
        url: row.url,
        reason: `引文在自家快照里找不到：${row.quote.slice(0, 80)}${hint ? `（${hint}）` : ''}`,
      });
      continue;
    }
    check.verbatimOk += 1;

    if (row.relation === 'irrelevant') continue;
    const claim = claimById.get(row.claimId);
    if (!claim) {
      check.clueUnverifiable.push(`${row.evidenceId}（claim=${row.claimId} 在 claims 底稿里找不到，取不到字段值）`);
      continue;
    }
    const clue = pack.quoteBearsFieldClue(row.fieldKey, claim.object, row.quote);
    if (clue === 'no') {
      check.violations.push({
        evidenceId: row.evidenceId,
        claimId: row.claimId,
        url: row.url,
        reason: `引文没写到所裁字段（${String(row.fieldKey)}=${claim.object}）：${row.quote.slice(0, 60)}`,
      });
      continue;
    }
    check.clueOk += 1;
  }

  return check;
}

export function printEvidenceCheck(check: EvidenceCheck, limit: number): void {
  console.log(
    `Evidence rows: ${check.total} | verbatim ${check.verbatimOk} | field-clue ${check.clueOk} | ` +
      `violations ${check.violations.length}`,
  );
  if (check.clueUnverifiable.length > 0) {
    console.log(`\nWarning: field-clue check not applicable to ${check.clueUnverifiable.length} row(s):`);
    for (const item of check.clueUnverifiable.slice(0, limit)) console.log(`  ? ${item}`);
  }
  for (const violation of check.violations.slice(0, limit)) {
    console.log(`\n  x ${violation.evidenceId}  claim=${violation.claimId}`);
    console.log(`    url: ${violation.url}`);
    console.log(`    reason: ${violation.reason}`);
  }
  if (check.violations.length > limit) {
    console.log(`\n  ... ${check.violations.length - limit} more violation(s) not printed (use --limit).`);
  }
}
