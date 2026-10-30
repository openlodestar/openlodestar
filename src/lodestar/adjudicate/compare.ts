// src/lodestar/adjudicate/compare.ts
/**
 * 逐源独立比对：一条断言 × 一个来源页面 = 一次独立 LLM 调用
 *
 * 三条纪律都在这里：
 * 1. **不许把多个来源塞进同一次调用**——同一次调用里既有支持又有反对时，
 *    模型会给一个折中结论，而裁决要的恰恰是每个来源各自的立场；
 * 2. **引文逐字必填**，且落盘前当场过两道机械校验——① 逐字命中快照；② 引文写到了被裁的
 *    那个字段（不是"说得对"，是"有没有说到"）。这是"引文必须逐字"的写入侧一半，
 *    另一半是 `npm run verify-quotes` 的事后全量复查；
 * 3. **判定只依据页面正文**，不依据搜索摘要——摘要可能来自别的页面或过期缓存。
 */

import { extractJson, invokeLLM, type ChatMessage } from '@src/llm';
import { getLodestarLoader } from '@src/prompts';
import { createLogger } from '@src/utils/logger';
import { foldGlyphVariants } from '@src/utils/text-language';
import { renderClaimCompare } from '../intake/prompts';
import type { DomainPack } from '../packs/pack';
import type { CapturedPage } from './page-fetch';
import type { ClaimRecord, EvidenceRelation } from '../types';

/** 比对结论（引文逐字命中、且写到所裁字段，两道都在落盘前校验） */
export interface ComparisonOutcome {
  relation: EvidenceRelation;
  quote: string;
  contentWeight: number;
  pageTopic: string | null;
  rationale: string;
}

/** 比对失败（结构坏 / 引文不在快照里）——调用方把这条记进足迹，不计票 */
export interface ComparisonRejection {
  rejected: true;
  reason: string;
}

const RELATIONS: EvidenceRelation[] = ['supports', 'refutes', 'irrelevant'];

/**
 * 引文是否逐字命中给定文本（机械匹配，无模型参与）。
 *
 * 只折叠空白并剥掉 Markdown 连接符：清洗正文里 "青花 盘" 与 "青花盘" 是同一句话的
 * 两种排版，不是两条不同的引文；除此以外的差异一律算不命中。
 * 这一份实现同时供写入侧（本文件）与事后硬护栏脚本共用——同一件事不许两套实现，
 * 否则会出现"写入时过、复查时不过"这种最难查的分裂。
 */
export function quoteMatches(quote: string, text: string): boolean {
  const needle = quoteForMatch(quote);
  if (needle === '') return false;
  return quoteForMatch(text).includes(needle);
}

function quoteForMatch(value: string): string {
  return foldGlyphVariants(
    value
      .normalize('NFKC')
      // Markdown 的链接与强调符号是清洗器加上的排版，不是页面里的字
      .replace(/[[\]()*_>#`]/g, '')
      .replace(/\s+/g, ''),
  ).toLowerCase();
}

/** 解析模型返回（纯函数，供单测直接喂文本） */
export function parseComparison(raw: string): ComparisonOutcome | ComparisonRejection {
  let parsed: Record<string, unknown>;
  try {
    parsed = extractJson(raw);
  } catch (error) {
    return { rejected: true, reason: `比对返回不是合法 JSON：${error instanceof Error ? error.message : String(error)}` };
  }
  const relation = typeof parsed.relation === 'string' ? (parsed.relation.trim() as EvidenceRelation) : undefined;
  if (!relation || !RELATIONS.includes(relation)) {
    return { rejected: true, reason: `比对返回的 relation 非法：${String(parsed.relation ?? '（缺失）')}` };
  }
  const quote = typeof parsed.quote === 'string' ? parsed.quote.trim() : '';
  if (quote === '') {
    return { rejected: true, reason: '比对返回缺引文（引文逐字必填，无引文的判定不落库）' };
  }
  const weightRaw = Number(parsed.contentWeight);
  const contentWeight = Number.isFinite(weightRaw) && weightRaw > 0 && weightRaw <= 1 ? weightRaw : 0.6;
  return {
    relation,
    quote,
    contentWeight,
    pageTopic: typeof parsed.pageTopic === 'string' ? parsed.pageTopic.trim() : null,
    rationale: typeof parsed.rationale === 'string' ? parsed.rationale.trim() : '',
  };
}

/**
 * 一次独立比对调用。引文不在快照里、或没写到所裁字段时**只重试一次**（提示它复制原文、
 * 并写清所裁字段那一句），仍不中即拒收这条证据——不许靠调参绕过。
 */
export async function compareClaimToPage(input: {
  claim: ClaimRecord;
  page: CapturedPage;
  pack: DomainPack;
  logger?: ReturnType<typeof createLogger>;
}): Promise<ComparisonOutcome | ComparisonRejection> {
  const log = input.logger ?? createLogger({ prefix: '[Lodestar Compare] ' });
  const params = getLodestarLoader().getLLMParams('claim-compare');
  const basePrompt = renderClaimCompare({
    pack: input.pack,
    claimText: input.claim.atomicText,
    fieldKey: input.claim.fieldKey,
    url: input.page.url,
    fetchedAt: input.page.fetchedAt,
    pageText: input.page.text,
  });

  let lastRejection = '未知失败';
  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt =
      attempt === 0
        ? basePrompt
        : `${basePrompt}\n\n# 上一次失败的原因（这次照着改）\n` +
          `上次给出的引文在正文里逐字找不到：${lastRejection.slice(0, 80)}\n` +
          '这次只做一件事：从上面正文里**选中一小段（10～30 字就够）原样复制过来**——不重排语序、' +
          '不把「」“”换成别的引号、不把两句并成一句、不加"推出/共计"这类原文没有的词。' +
          '**引文还必须写到所裁字段本身**（字段是时间就引写明时间的那句、是机构就引写明哪家拍行的那句、' +
          '是专场名就引写明专场名的那句）——只引到别处的名字或描述不算。' +
          '复制不出来就说明这页给不出证据：判 irrelevant，并原样复制一句页面自述主题的短句。';
    let content: string;
    try {
      const messages: ChatMessage[] = [{ role: 'user', content: prompt }];
      const result = await invokeLLM('text', messages, {
        temperature: params.temperature ?? 0,
        maxTokens: params.max_tokens ?? 800,
        enableThinking: false,
      });
      content = result.content;
    } catch (error) {
      lastRejection = `比对调用失败：${error instanceof Error ? error.message : String(error)}`;
      log.dev.warn(lastRejection);
      continue;
    }

    const outcome = parseComparison(content);
    if ('rejected' in outcome) {
      lastRejection = outcome.reason;
      continue;
    }
    if (!quoteMatches(outcome.quote, input.page.text)) {
      lastRejection = `引文未逐字命中快照：${outcome.quote.slice(0, 60)}`;
      continue;
    }
    // 第二道：逐字命中只证明"这串字在页面上"，不证明它说的是被裁的那个字段
    if (outcome.relation !== 'irrelevant') {
      const clue = input.pack.quoteBearsFieldClue(input.claim.fieldKey, input.claim.object, outcome.quote);
      if (clue === 'no') {
        const label = input.pack.fields().find((f) => f.key === input.claim.fieldKey)?.label ?? '被裁字段';
        lastRejection = `引文没写到所裁字段（引文里没有"${label}"的线索）：${outcome.quote.slice(0, 60)}`;
        continue;
      }
    }
    return outcome;
  }

  return { rejected: true, reason: lastRejection };
}
