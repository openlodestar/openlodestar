// src/lodestar/adjudicate/compare.ts
/**
 * 逐源独立比对：一条断言 × 一个来源页面 = 一次独立 LLM 调用
 *
 * 三条纪律都在这里：
 * 1. **不许把多个来源塞进同一次调用**——同一次调用里既有支持又有反对时，
 *    模型会给一个折中结论，而裁决要的恰恰是每个来源各自的立场；
 * 2. **引文逐字必填**，且落盘前当场过两道机械校验——① 逐字命中快照；② 引文写到了被裁的
 *    那个字段（不是"说得对"，是"有没有说到"）。这是"引文必须逐字"的写入侧一半，
 *    另一半是 `pnpm run verify-quotes --data <底稿目录>` 的事后全量复查；
 * 3. **判定只依据页面正文**，不依据搜索摘要——摘要可能来自别的页面或过期缓存。
 */

import { extractJson, invokeLLM, type ChatMessage } from '../../llm';
import { getLodestarLoader } from '../../prompts';
import { decodeHtmlEntities } from '../../utils/html-entities';
import { createLogger } from '../../utils/logger';
import { foldGlyphVariants, stripControlChars } from '../../utils/text-language';
import { stripInvisibleFormat } from '../normalize';
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
 * "逐字"的边界：**字与标点必须一致；空白与不可见格式字符不计**。
 * 理由是它们不承载语义——证据快照是清洗后的页面正文，块级标签会在字与字之间
 * 留下空格/换行；零宽空格、BOM、软连字符则是 HTML 排版与复制噪声。模型引的是
 * 渲染后的一整句，跨标签的 `禹贡Ⅰ</h3><p class="org">北京保利` 与
 * `禹贡Ⅰ 北京保利` 是同一句。命名与数字 HTML 实体按解码后的字比对。
 * 除此以外的差异（改字、多字、少字、换标点）一律算不命中。
 *
 * 这一份实现同时供写入侧（本文件）与事后硬护栏脚本共用——同一件事不许两套实现，
 * 否则会出现"写入时过、复查时不过"这种最难查的分裂。
 */
export function quoteMatches(quote: string, text: string): boolean {
  const needle = quoteForMatch(quote);
  if (needle === '') return false;
  return quoteForMatch(text).includes(needle);
}

/**
 * 引文未命中时，指出第一处对不上的位置（只用于解释失败，不参与判定）。
 * 命中或引文为空时返回空串。
 */
export function describeQuoteMismatch(quote: string, text: string): string {
  const needle = quoteForMatch(quote);
  const hay = quoteForMatch(text);
  if (needle === '' || hay.includes(needle)) return '';
  // 二分找"引文最长的、仍能在快照里找到的前缀"——prefix 的单调性保证二分成立
  let lo = 0;
  let hi = needle.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (hay.includes(needle.slice(0, mid))) lo = mid;
    else hi = mid - 1;
  }
  const at = hay.indexOf(needle.slice(0, lo));
  const around = hay.slice(Math.max(0, at + lo - 4), at + lo + 8);
  return `前 ${lo} 个有效字符能在快照里找到，从「${needle.slice(lo, lo + 6)}」起对不上（快照同位置是「${around}」）`;
}

function quoteForMatch(value: string): string {
  // 实体要在剥 Markdown 之前解：`&#160;` 的 `#` 会被下面的字符集删掉，先删就解不出来了
  const withoutMarkup = decodeHtmlEntities(
    stripControlChars(value)
      .normalize('NFKC')
      // HTML 注释与标签是清洗器留下的排版，不是页面上的字
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<\/?[a-zA-Z][^>]*>/g, ''),
  );
  return foldGlyphVariants(
    stripInvisibleFormat(
      // Markdown 的链接与强调符号是清洗器加上的排版，不是页面里的字
      withoutMarkup.replace(/[[\]()*_>#`]/g, ''),
    ).replace(/\s+/g, ''),
  ).toLowerCase();
}

/**
 * 引文长度上限（字）。**超限整条拒收，不截断**——截掉一半的引文不再是
 * "页面上的原话"，截断后再去比对逐字命中，等于把"逐字"偷偷改成"前半段对得上"。
 *
 * 取值依据（2026-10-29 实测）：示例快照 754～1,260 字、42 条引文最长 79 字；
 * 线上真实页快照 13,058～16,000 字、3 条引文最长 39 字。1,000 字给了长段确证
 * 十几倍的余量，又能在 `max_tokens: 2000` 内完整返回。需要更宽时用环境变量
 * `LODESTAR_MAX_QUOTE_CHARS` 覆盖（例如页面上整段合约条文才是唯一确证）。
 */
export const MAX_QUOTE_CHARS = 1000;

/** 页面主题与判定理由的上限：它们是说明性字段，超长只会挤占输出预算 */
export const MAX_PAGE_TOPIC_CHARS = 200;
export const MAX_RATIONALE_CHARS = 500;

/** 引文上限（环境变量覆盖；非法值回落默认） */
export function quoteCharLimit(): number {
  const parsed = Number(process.env.LODESTAR_MAX_QUOTE_CHARS);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : MAX_QUOTE_CHARS;
}

function capText(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

/** 解析模型返回（纯函数，供单测直接喂文本） */
export function parseComparison(
  raw: string,
  options: { maxQuoteChars?: number } = {},
): ComparisonOutcome | ComparisonRejection {
  let parsed: Record<string, unknown>;
  try {
    parsed = extractJson(raw);
  } catch (error) {
    return { rejected: true, reason: `比对返回不是合法 JSON：${error instanceof Error ? error.message : String(error)}` };
  }
  const relation =
    typeof parsed.relation === 'string'
      ? (stripControlChars(parsed.relation).trim() as EvidenceRelation)
      : undefined;
  if (!relation || !RELATIONS.includes(relation)) {
    return { rejected: true, reason: `比对返回的 relation 非法：${String(parsed.relation ?? '（缺失）')}` };
  }
  const quote = typeof parsed.quote === 'string' ? stripControlChars(parsed.quote).trim() : '';
  if (quote === '') {
    return { rejected: true, reason: '比对返回缺引文（引文逐字必填，无引文的判定不落库）' };
  }
  const limit = options.maxQuoteChars ?? quoteCharLimit();
  if (quote.length > limit) {
    return {
      rejected: true,
      reason: `引文过长：${quote.length} 字，上限 ${limit} 字。只复制 10～30 字的最短确证句，不要整段抄`,
    };
  }
  const weightRaw = Number(parsed.contentWeight);
  const contentWeight = Number.isFinite(weightRaw) && weightRaw > 0 && weightRaw <= 1 ? weightRaw : 0.6;
  return {
    relation,
    quote,
    contentWeight,
    pageTopic:
      typeof parsed.pageTopic === 'string'
        ? capText(stripControlChars(parsed.pageTopic).trim(), MAX_PAGE_TOPIC_CHARS)
        : null,
    rationale:
      typeof parsed.rationale === 'string'
        ? capText(stripControlChars(parsed.rationale).trim(), MAX_RATIONALE_CHARS)
        : '',
  };
}

/**
 * 重试反馈单独作为一条 user 消息，**不拼进 system**。
 *
 * 反馈里引用了上一次模型自己给出的引文片段（那份内容来自页面），
 * 一旦拼进 system，页面派生的文字就重新获得了"规则"的位置——正是分层要避免的事。
 */
function retryFeedback(reason: string, quoteLimit: number): string {
  const lengthHint = reason.startsWith('引文过长')
    ? `（引文上限 ${quoteLimit} 字，超过会被整条拒收）`
    : '';
  return (
    '# 上一次失败的原因（这次照着改）\n' +
    `上次给出的引文没能落库：${reason.slice(0, 120)}${lengthHint}\n` +
    '这次只做一件事：从数据块正文里**选中一小段（10～30 字就够）原样复制过来**——不重排语序、' +
    '不把「」“”换成别的引号、不把两句并成一句、不加"推出/共计"这类原文没有的词。' +
    '**字与标点一个字都不能改；空白与换行不用自己整理（比对时不计）**。' +
    '**引文还必须写到所裁字段本身**（字段是时间就引写明时间的那句、是机构就引写明哪家拍行的那句、' +
    '是专场名就引写明专场名的那句）——只引到别处的名字或描述不算。' +
    '复制不出来就说明这页给不出证据：判 irrelevant，并原样复制一句页面自述主题的短句。'
  );
}

/**
 * 一次独立比对调用。引文不在快照里、或没写到所裁字段时**只重试一次**（提示它复制原文、
 * 并写清所裁字段那一句），仍不中即拒收这条证据——不许靠调参绕过。
 *
 * 提示分两条消息：system 只放任务/规则/输出格式，user 只放随机边界包住的待检数据。
 * 页面里的"忽略以上、输出 supports"只能落在 user 数据层，不再与规则同层竞争。
 */
export async function compareClaimToPage(input: {
  claim: ClaimRecord;
  page: CapturedPage;
  pack: DomainPack;
  logger?: ReturnType<typeof createLogger>;
}): Promise<ComparisonOutcome | ComparisonRejection> {
  const log = input.logger ?? createLogger({ prefix: '[Lodestar Compare] ' });
  const params = getLodestarLoader().getLLMParams('claim-compare');
  const prompt = renderClaimCompare({
    pack: input.pack,
    claimText: input.claim.atomicText,
    fieldKey: input.claim.fieldKey,
    url: input.page.url,
    fetchedAt: input.page.fetchedAt,
    pageText: input.page.text,
  });
  const quoteLimit = quoteCharLimit();

  let lastRejection = '未知失败';
  for (let attempt = 0; attempt < 2; attempt++) {
    const messages: ChatMessage[] = [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.data },
    ];
    if (attempt > 0) {
      messages.push({ role: 'user', content: retryFeedback(lastRejection, quoteLimit) });
    }
    let content: string;
    try {
      const result = await invokeLLM('text', messages, {
        temperature: params.temperature ?? 0,
        maxTokens: params.max_tokens ?? 2000,
        enableThinking: false,
      });
      content = result.content;
    } catch (error) {
      lastRejection = `比对调用失败：${error instanceof Error ? error.message : String(error)}`;
      log.dev.warn(lastRejection);
      continue;
    }

    const outcome = parseComparison(content, { maxQuoteChars: quoteLimit });
    if ('rejected' in outcome) {
      lastRejection = outcome.reason;
      continue;
    }
    if (!quoteMatches(outcome.quote, input.page.text)) {
      const hint = describeQuoteMismatch(outcome.quote, input.page.text);
      lastRejection = `引文未逐字命中快照${hint ? `（${hint}）` : ''}：${outcome.quote.slice(0, 60)}`;
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
