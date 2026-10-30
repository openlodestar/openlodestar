// src/lodestar/adjudicate/adjudicate.test.ts
/**
 * 裁决内核测试（离线：只喂证据行与文本夹具，不发检索、不抓取、不调模型）
 *
 * 钉住的是裁决内核的判据本体——四分类的真值条件、证据等级分档、
 * 来源独立性三判据（异域 / 非转载 / 聚合站降权）、not_found 三因区分，
 * 以及"引文必须逐字"的写入侧那一半（引文不逐字命中就不算证据）。
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { NO_ABLATIONS } from '../../ablation';
import { createSourceBlacklistService } from '../../integrations/source-blacklist';
import type { SearchResultItem } from '../../integrations/search-providers';
import porcelainPack from '../packs/porcelain';
import type { ClaimRecord, EvidenceRecord } from '../types';
import type { CapturedPage } from './page-fetch';
import { independentSources, isDecisive, tally } from './voting';
import {
  compareClaimToPage,
  describeQuoteMismatch,
  MAX_PAGE_TOPIC_CHARS,
  MAX_QUOTE_CHARS,
  MAX_RATIONALE_CHARS,
  parseComparison,
  quoteCharLimit,
  quoteMatches,
} from './compare';

/** 比对调用要模型、要提示词；这里只钉"引文与字段的关系"，两者都给假件（离线、不花钱） */
vi.mock('../../llm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../llm')>();
  return { ...actual, invokeLLM: vi.fn() };
});
vi.mock('../../prompts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../prompts')>();
  return {
    ...actual,
    getLodestarLoader: () => ({
      getLLMParams: () => ({ temperature: 0, max_tokens: 800 }),
      render: () => '（mock 提示词：正文略）',
    }),
  };
});

import { invokeLLM } from '../../llm';
import { buildEvidenceQueries, filterAndRankCandidates } from './retrieval';
import { routeClaim } from './routing';

const CAPS = { searchCalls: 4, pagesFetched: 6, searchCap: 4, pageCap: 6 };
const FULL_COVERAGE = { candidateCount: 3, examinedCount: 3 };

function evidence(over: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    evidenceId: `ev-${Math.random().toString(16).slice(2, 8)}`,
    claimId: 'cl-20261004-test',
    url: 'https://www.cguardian.com/a/2014-ceramics',
    domain: 'www.cguardian.com',
    sourceFamily: 'cguardian.com',
    tier: 'official',
    quote: '2014春季拍卖会瓷器工艺品专场',
    relation: 'supports',
    contentWeight: 1,
    fetchedBy: 'lodestar',
    fetchedAt: '2026-10-04T10:00:00+08:00',
    snapshotRef: 'snapshots/x.html',
    traceId: 'trace-test',
    fieldKey: 'dateText',
    recordId: 'rec-20261004-test',
    ...over,
  };
}

describe('来源独立性三判据', () => {
  it('同域多页只算一个来源（异域）', () => {
    const { counted, corroborating } = independentSources([
      evidence({ url: 'https://www.cguardian.com/a/1' }),
      evidence({ url: 'https://www.cguardian.com/a/2' }),
    ]);
    expect(counted).toHaveLength(1);
    expect(corroborating).toHaveLength(1);
  });

  it('跨语言站与镜像域归并进同一家族（ha.com 与 heritageauctions.com 是一票不是两票）', () => {
    const { counted } = independentSources([
      evidence({ domain: 'www.ha.com', sourceFamily: porcelainPack.sourceFamilyOf('www.ha.com'), url: 'https://www.ha.com/1' }),
      evidence({ domain: 'www.heritageauctions.com', sourceFamily: porcelainPack.sourceFamilyOf('www.heritageauctions.com'), url: 'https://www.ha.com/2' }),
    ]);
    expect(counted).toHaveLength(1);
  });

  it('同家族内保留权威最高的一条计票，其余只作佐证（非转载）', () => {
    const { counted } = independentSources([
      evidence({ tier: 'aggregator', url: 'https://barnebys.com/x', domain: 'barnebys.com', sourceFamily: 'barnebys.com', contentWeight: 1 }),
      evidence({ tier: 'official', url: 'https://www.cguardian.com/y', contentWeight: 0.6 }),
    ]);
    expect(counted).toHaveLength(2);
  });

  it('irrelevant 不进计票，但支持性证据缺引文也不能算', () => {
    const { counted } = independentSources([
      evidence({ relation: 'irrelevant' }),
      evidence({ quote: '   ', relation: 'supports', domain: 'christies.com', sourceFamily: 'christies.com' }),
    ]);
    expect(counted).toHaveLength(0);
  });
});

describe('四分类真值条件与证据等级', () => {
  it('两个独立来源一致 = E2；含官方一手 = E3', () => {
    const two = tally({
      evidence: [
        evidence({ domain: 'artron.net', sourceFamily: 'artron.net', tier: 'primary', url: 'https://artron.net/1' }),
        evidence({ domain: 'christies.com', sourceFamily: 'christies.com', tier: 'primary', url: 'https://christies.com/1' }),
      ],
      promptedDetail: false,
      budget: CAPS,
      coverage: FULL_COVERAGE,
    });
    expect(two.verdict).toBe('supported');
    expect(two.evidenceGrade).toBe('E2');

    const withOfficial = tally({
      evidence: [
        evidence(),
        evidence({ domain: 'artron.net', sourceFamily: 'artron.net', tier: 'primary', url: 'https://artron.net/1' }),
      ],
      promptedDetail: false,
      budget: CAPS,
      coverage: FULL_COVERAGE,
    });
    expect(withOfficial.evidenceGrade).toBe('E3');
  });

  it('单一独立来源仍算 supported，但只到 E1——强坐标要 ≥E2 是门禁那一层的事', () => {
    const result = tally({ evidence: [evidence()], promptedDetail: false, budget: CAPS, coverage: FULL_COVERAGE });
    expect(result.verdict).toBe('supported');
    expect(result.evidenceGrade).toBe('E1');
    expect(result.supportCount).toBe(1);
    expect(result.reason).toContain('不给强坐标');
  });

  it('一个权威来源明确反对即 refuted，且该来源不得是聚合站', () => {
    const authoritative = tally({
      evidence: [evidence({ relation: 'refutes', quote: '该场为家具专场' })],
      promptedDetail: false,
      budget: CAPS,
      coverage: FULL_COVERAGE,
    });
    expect(authoritative.verdict).toBe('refuted');

    const aggregatorOnly = tally({
      evidence: [
        evidence({
          relation: 'refutes',
          tier: 'aggregator',
          domain: 'barnebys.com',
          sourceFamily: 'barnebys.com',
          url: 'https://www.barnebys.com/x',
          quote: '该场为家具专场',
        }),
      ],
      promptedDetail: false,
      budget: CAPS,
      coverage: FULL_COVERAGE,
    });
    // 聚合站反对不能单独定 refuted → 落 not_found 且成因写"覆盖缺口"
    expect(aggregatorOnly.verdict).toBe('not_found');
    expect(aggregatorOnly.notFoundCause).toBe('coverage');
    expect(aggregatorOnly.reason).toContain('该扩站点包');
  });

  it('两侧都达权威门槛 = conflicting', () => {
    const result = tally({
      evidence: [
        evidence({ domain: 'polypm.com.cn', sourceFamily: 'polypm.com.cn', url: 'https://polypm.com.cn/1' }),
        evidence({ domain: 'christies.com', sourceFamily: 'christies.com', url: 'https://christies.com/1' }),
        evidence({ relation: 'refutes', quote: '该月专场为家具专场', domain: 'www.cguardian.com', sourceFamily: 'cguardian.com', url: 'https://www.cguardian.com/schedule' }),
      ],
      promptedDetail: false,
      budget: CAPS,
      coverage: FULL_COVERAGE,
    });
    expect(result.verdict).toBe('conflicting');
    expect(result.refuteCount).toBe(1);
    expect(result.supportCount).toBe(2);
  });

  it('追问诱导的断言支持分打折：同样的两票，弱档组合会被压到阈值下', () => {
    const weakPair = [
      evidence({ tier: 'aggregator', domain: 'barnebys.com', sourceFamily: 'barnebys.com', url: 'https://barnebys.com/1', contentWeight: 0.6 }),
      evidence({ tier: 'unlisted', domain: 'random-blog.com', sourceFamily: 'random-blog.com', url: 'https://random-blog.com/1', contentWeight: 0.6 }),
    ];
    const plain = tally({ evidence: weakPair, promptedDetail: false, budget: CAPS, coverage: FULL_COVERAGE });
    const prompted = tally({ evidence: weakPair.map((e) => ({ ...e })), promptedDetail: true, budget: CAPS, coverage: FULL_COVERAGE });
    expect(plain.scores.support).toBeGreaterThan(prompted.scores.support);
  });
});

describe('not_found 三因区分', () => {
  it('预算触顶且没查完 → budget', () => {
    const result = tally({
      evidence: [],
      promptedDetail: false,
      budget: { searchCalls: 4, pagesFetched: 6, searchCap: 4, pageCap: 6 },
      coverage: { candidateCount: 9, examinedCount: 3 },
    });
    expect(result.notFoundCause).toBe('budget');
    expect(result.reason).toContain('可修复');
  });

  it('候选池为空 → coverage（该扩站点包，而不是改判定规则）', () => {
    const result = tally({
      evidence: [],
      promptedDetail: false,
      budget: CAPS,
      coverage: { candidateCount: 0, examinedCount: 0 },
    });
    expect(result.notFoundCause).toBe('coverage');
  });

  it('覆盖完、跑满预算、各来源均不相关 → genuinely_absent（最强的 not_found）', () => {
    const result = tally({
      evidence: [evidence({ relation: 'irrelevant', domain: 'x.com', sourceFamily: 'x.com' })],
      promptedDetail: false,
      budget: { searchCalls: 4, pagesFetched: 6, searchCap: 4, pageCap: 6 },
      coverage: { candidateCount: 3, examinedCount: 3 },
    });
    expect(result.verdict).toBe('not_found');
    expect(result.notFoundCause).toBe('genuinely_absent');
  });
});

describe('停止条件：够证据就停，not_found 才跑满', () => {
  it('单一支持的 supported 不停（随时可能被下一条翻成 conflicting）', () => {
    expect(isDecisive([evidence()], false, CAPS, FULL_COVERAGE)).toBe(false);
  });

  it('两个独立支持的来源即停', () => {
    const two = [
      evidence(),
      evidence({ domain: 'christies.com', sourceFamily: 'christies.com', url: 'https://christies.com/1' }),
    ];
    expect(isDecisive(two, false, CAPS, FULL_COVERAGE)).toBe(true);
  });

  it('权威反对到手即停', () => {
    expect(isDecisive([evidence({ relation: 'refutes' })], false, CAPS, FULL_COVERAGE)).toBe(true);
  });
});

describe('引文逐字命中（机械校验）', () => {
  it('空白与 Markdown 排版差异不影响命中，改字则不命中', () => {
    const page = '# 2014春季拍卖会\n\n**瓷器工艺品**专场 将于5月18日举\n行';
    expect(quoteMatches('瓷器工艺品专场', page)).toBe(true);
    expect(quoteMatches('2014春季拍卖会 瓷器工艺品', page)).toBe(true);
    expect(quoteMatches('瓷器工艺品  专场', page)).toBe(true);
    expect(quoteMatches('瓷器家具专场', page)).toBe(false);
    expect(quoteMatches('', page)).toBe(false);
  });

  it('全半角差异算同一句（NFKC 归一），但不允许凭空加字', () => {
    expect(quoteMatches('2014春季拍卖会', '２０１４春季拍卖会')).toBe(true);
    expect(quoteMatches('2014年春季拍卖会', '2014春季拍卖会')).toBe(false);
  });

  it('字形差异（繁体页面 × 简体引文）折成同一句命中（只折字形，不改语义）', () => {
    const page = '清乾隆 青花纏枝蓮紋賞瓶 將於5月18日舉';
    expect(quoteMatches('清乾隆青花缠枝莲纹赏瓶', page)).toBe(true);
    expect(quoteMatches('清乾隆青花纏枝蓮紋賞瓶', page)).toBe(true);
    // 只折字形不改语义：换成另一件东西仍不命中
    expect(quoteMatches('清乾隆青花天球瓶', page)).toBe(false);
  });

  it('HTML 标签是排版：跨标签的引文命中，标签本身不进入比对', () => {
    const page =
      '<h3>禹贡Ⅰ—盛清御瓷新风尚</h3><p class="org">北京保利</p><p class="time">2021-12-05</p>';
    expect(quoteMatches('禹贡Ⅰ—盛清御瓷新风尚 北京保利 2021-12-05', page)).toBe(true);
    expect(quoteMatches('<h3>禹贡Ⅰ—盛清御瓷新风尚</h3>', page)).toBe(true);
    expect(quoteMatches('禹贡Ⅱ—盛清御瓷新风尚 北京保利', page)).toBe(false);
  });

  it('真实案例回归：腾讯转载页的空格不参与比对，省略空格的引文命中', () => {
    // 2026-10-29 在线实测被拒收的那一句；快照原文在字与字之间带空格
    const page = '为期5 天的中国嘉德香港2024春季拍卖会， 4月7日晚上 圆满收官。12个专场';
    expect(quoteMatches('中国嘉德香港2024春季拍卖会，4月7日晚上圆满收官。', page)).toBe(true);
  });

  it('零宽字符、BOM、软连字符是排版噪声：不计入差异，但不能拿来拼句', () => {
    const page = '甲\u200B乙\uFEFF丙\u00AD丁';
    expect(quoteMatches('甲乙丙丁', page)).toBe(true);
    expect(quoteMatches('甲乙丙', page)).toBe(true);
    expect(quoteMatches('甲丙', page)).toBe(false);
    expect(quoteMatches('甲乙丙丁戊', page)).toBe(false);
  });

  it('HTML 命名与数字实体按解码后的字比对', () => {
    expect(quoteMatches('甲&#x4E59;丙', '甲乙丙')).toBe(true);
    expect(quoteMatches('甲 乙', '甲&#160;乙')).toBe(true);
    expect(quoteMatches('甲\u0000乙', '甲乙')).toBe(true);
    expect(quoteMatches('甲&#38;乙', '甲&amp;乙')).toBe(true);
    // 只解一层：&amp;lt; 停在 &lt;，不能二次解成 <
    expect(quoteMatches('&lt;', '&amp;lt;')).toBe(false);
    expect(quoteMatches('甲&#0;乙', '甲乙')).toBe(false);
  });

  it('未命中时指出第一处对不上的位置', () => {
    expect(describeQuoteMismatch('甲乙', '甲乙')).toBe('');
    const hint = describeQuoteMismatch('甲乙丙', '甲乙丁');
    expect(hint).toContain('前 2 个有效字符');
    expect(hint).toContain('丙');
  });
});

describe('比对返回解析', () => {
  it('relation 非法 / 缺引文 / 不是 JSON，三种坏形态各自给出理由', () => {
    expect(parseComparison('{"relation":"maybe","quote":"x"}')).toMatchObject({ rejected: true });
    expect(parseComparison('{"relation":"supports","quote":""}')).toMatchObject({ rejected: true });
    expect(parseComparison('我觉得这页支持该断言')).toMatchObject({ rejected: true });
  });

  it('contentWeight 越界或缺失时落到间接推断档（0.6），不放大权重', () => {
    const parsed = parseComparison('{"relation":"supports","quote":"瓷器专场","contentWeight":9}');
    expect(parsed).toMatchObject({ contentWeight: 0.6 });
  });

  it('正常返回按契约出四件套', () => {
    const parsed = parseComparison(
      '{"relation":"supports","quote":"2014春季拍卖会瓷器工艺品专场","contentWeight":1,"pageTopic":"嘉德2014春拍瓷器专场图录","rationale":"页面直接写明该场"}',
    );
    expect(parsed).toMatchObject({ relation: 'supports', contentWeight: 1, pageTopic: '嘉德2014春拍瓷器专场图录' });
  });
});

describe('比对输出边界（防注入的第三层）', () => {
  it('引文超过上限整条拒收，不截断', () => {
    const parsed = parseComparison(
      JSON.stringify({ relation: 'supports', quote: '甲'.repeat(MAX_QUOTE_CHARS + 1) }),
    );
    expect(parsed).toMatchObject({ rejected: true });
    expect(String((parsed as { reason: string }).reason)).toContain('引文过长');
  });

  it('上限可用环境变量覆盖，非法值回落默认', () => {
    const previous = process.env.LODESTAR_MAX_QUOTE_CHARS;
    try {
      process.env.LODESTAR_MAX_QUOTE_CHARS = '5';
      expect(quoteCharLimit()).toBe(5);
      expect(
        parseComparison(JSON.stringify({ relation: 'supports', quote: '甲乙丙丁戊己' })),
      ).toMatchObject({ rejected: true });
      expect(
        parseComparison(JSON.stringify({ relation: 'supports', quote: '甲乙丙丁戊' })),
      ).toMatchObject({ relation: 'supports' });

      process.env.LODESTAR_MAX_QUOTE_CHARS = 'not-a-number';
      expect(quoteCharLimit()).toBe(MAX_QUOTE_CHARS);
    } finally {
      if (previous === undefined) delete process.env.LODESTAR_MAX_QUOTE_CHARS;
      else process.env.LODESTAR_MAX_QUOTE_CHARS = previous;
    }
  });

  it('控制字符从引文与说明字段里去掉，说明字段超长截断', () => {
    const parsed = parseComparison(
      JSON.stringify({
        relation: 'supports',
        quote: '甲\u0000乙\u0007丙',
        pageTopic: '题'.repeat(MAX_PAGE_TOPIC_CHARS + 10),
        rationale: '理'.repeat(MAX_RATIONALE_CHARS + 10),
      }),
    );
    expect(parsed).toMatchObject({ quote: '甲乙丙' });
    const outcome = parsed as { pageTopic: string; rationale: string };
    expect(outcome.pageTopic).toHaveLength(MAX_PAGE_TOPIC_CHARS + 1);
    expect(outcome.pageTopic.endsWith('…')).toBe(true);
    expect(outcome.rationale).toHaveLength(MAX_RATIONALE_CHARS + 1);
    expect(outcome.rationale.endsWith('…')).toBe(true);
  });
});

describe('检索编排：唤起多源，不定位实例页', () => {
  const claim = (over: Partial<ClaimRecord> = {}): ClaimRecord => ({
    claimId: 'cl-20261004-test',
    queryId: 'q-1',
    recordId: 'rec-1',
    fieldRole: 'key',
    rawText: '',
    atomicText: '中国嘉德于2014年5月举办「瓷器工艺品专场」',
    subject: '中国嘉德',
    predicate: '举办时间',
    object: '2014年5月',
    timeScope: { from: '2014-05-01', to: '2014-05-31' },
    channel: 'enumerative',
    provenance: { stabilityRuns: 3, stabilityHits: 3, promptedDetail: false, selectionReason: null },
    triage: { passed: true, reason: 'specific-and-decidable' },
    state: 'verifying',
    fieldKey: 'dateText',
    createdAt: new Date().toISOString(),
    ...over,
  });

  it('查询来自策略包模板，并按域定向补足到上限；顺序确定、无重复', () => {
    const queries = buildEvidenceQueries({
      pack: porcelainPack,
      claim: claim(),
      values: { auctionHouse: '中国嘉德', dateText: '2014年5月', sessionName: '瓷器工艺品专场' },
      spec: porcelainPack.fields().find((f) => f.key === 'dateText'),
      domains: ['polypm.com.cn', 'cguardian.com', 'christies.com'],
      maxQueries: 4,
    });
    expect(queries).toHaveLength(4);
    expect(queries[0]).toContain('中国嘉德');
    expect(queries[0]).toContain('2014');
    expect(queries[queries.length - 1]).toMatch(/^site:/);
    expect(new Set(queries).size).toBe(queries.length);
    // 实例级限定词不进查询（否则退化成"找那一页"）
    expect(queries.join(' ')).not.toMatch(/图录号|lot/i);
  });

  it('抓取名额按来源家族轮转发放（同站多页不再吃掉整轮抓取预算）', () => {
    const results: SearchResultItem[] = [
      { url: 'https://www.cguardian.com/a/1', title: '官方 1', snippet: '', position: 1, queryIndex: 0 },
      { url: 'https://www.cguardian.com/a/2', title: '官方 2', snippet: '', position: 2, queryIndex: 0 },
      { url: 'https://www.cguardian.com/a/3', title: '官方 3', snippet: '', position: 3, queryIndex: 0 },
      { url: 'https://www.polypm.com.cn/s/1', title: '保利 1', snippet: '', position: 8, queryIndex: 0 },
      { url: 'https://www.polypm.com.cn/s/2', title: '保利 2', snippet: '', position: 9, queryIndex: 0 },
    ];
    const { candidates } = filterAndRankCandidates(
      results,
      porcelainPack,
      createSourceBlacklistService(NO_ABLATIONS),
    );
    // 前 3 条就要覆盖到两个独立来源家族（否则 maxPages=3 时永远拿不到"两个独立来源"）
    const families = new Set(candidates.slice(0, 3).map((c) => c.sourceFamily));
    expect(families.size).toBe(2);
    expect(candidates.map((c) => c.url)).toEqual([
      'https://www.cguardian.com/a/1',
      'https://www.polypm.com.cn/s/1',
      'https://www.cguardian.com/a/2',
      'https://www.polypm.com.cn/s/2',
      'https://www.cguardian.com/a/3',
    ]);
  });

  it('候选过滤：黑名单与非 HTML 被剔，同 URL 取更靠前的排序位，排序按权威档降序', () => {
    const results: SearchResultItem[] = [
      { url: 'https://www.barnebys.com/a', title: '聚合', snippet: '', position: 1, queryIndex: 0 },
      { url: 'https://www.cguardian.com/a', title: '官方', snippet: '', position: 5, queryIndex: 0 },
      { url: 'https://www.cguardian.com/a', title: '官方（重复）', snippet: '', position: 2, queryIndex: 1 },
      { url: 'https://www.cguardian.com/catalog.pdf', title: '图录 PDF', snippet: '', position: 3, queryIndex: 0 },
      { url: 'javascript:void(0)', title: '坏链接', snippet: '', position: 4, queryIndex: 0 },
    ];
    const { candidates, rejected } = filterAndRankCandidates(
      results,
      porcelainPack,
      createSourceBlacklistService(NO_ABLATIONS),
    );
    expect(candidates.map((c) => c.url)).toEqual(['https://www.cguardian.com/a', 'https://www.barnebys.com/a']);
    expect(candidates[0]!.tier).toBe('official');
    expect(candidates[0]!.position).toBe(2);
    expect(rejected.map((r) => r.reason).join(' ')).toMatch(/非 HTML|非 http/);
  });
});

describe('路由：引擎侧前置检查与策略包结论的分工', () => {
  it('空命题与指代未消解在引擎侧就被挡下（不花检索预算）', () => {
    const empty = routeClaim({ object: '  ', subject: '中国嘉德', atomicText: 'x' } as unknown as ClaimRecord, porcelainPack);
    expect(empty).toMatchObject({ route: 'reject', reason: 'empty-proposition' });
    const dangling = routeClaim({ object: '2014年', subject: '', atomicText: '2014年办过瓷器专场' } as unknown as ClaimRecord, porcelainPack);
    expect(dangling).toMatchObject({ route: 'reject', reason: 'unresolvable-reference' });
  });

  it('通过前置检查后交给策略包（域内判据在包里）', () => {
    const routed = routeClaim(
      { object: '2014年5月', subject: '中国嘉德', atomicText: '中国嘉德2014年5月办过瓷器专场', predicate: '举办时间', fieldKey: 'dateText', fieldRole: 'key' } as unknown as ClaimRecord,
      porcelainPack,
    );
    expect(routed).toMatchObject({ route: 'verify', mode: 'L1' });
  });
});

/**
 * 写入侧的第二道机械断言（逐字命中之外的那一半）。
 *
 * 实测病灶：引文逐字命中了，但说的是**专场名**、而被裁的字段是**举办时间**——
 * 这种行会被计票成 supports。护栏要挡的是"引文没说这个字段"，
 * 不是"引文说得不对"（后者是模型的判定职责，机械规则判不了）。
 */
describe('引文须含该字段线索（写入侧第二道断言）', () => {
  const claim = (over: Partial<ClaimRecord> = {}): ClaimRecord => ({
    claimId: 'cl-20261004-clue',
    queryId: 'q-1',
    recordId: 'rec-1',
    fieldRole: 'key',
    rawText: '',
    atomicText: '中国嘉德（香港）于2024年4月举办「大巧若拙——竹月堂藏瓷II」专场',
    subject: '中国嘉德（香港）',
    predicate: '举办时间',
    object: '2024年4月',
    timeScope: { from: '2024-04-01', to: '2024-04-30' },
    channel: 'enumerative',
    provenance: { stabilityRuns: 3, stabilityHits: 3, promptedDetail: false, selectionReason: null },
    triage: { passed: true, reason: 'specific-and-decidable' },
    state: 'verifying',
    fieldKey: 'dateText',
    createdAt: '2026-10-04T10:00:00+08:00',
    ...over,
  });
  const page: CapturedPage = {
    url: 'https://www.artron.net/a/1',
    text: '中国古董珍玩板块集合了十二个专场，包括「大巧若拙——竹月堂藏瓷II」专场',
    snapshotRef: 'snapshots/x.html',
    fetchedAt: '2026-10-04T10:00:00+08:00',
    strategy: 'fetch',
  };

  beforeEach(() => {
    (invokeLLM as Mock).mockReset();
  });

  it('逐字命中、但引文说的是专场名而不是时间 → 拒收（不许静默采信）', async () => {
    (invokeLLM as Mock).mockResolvedValue({
      content:
        '{"relation":"supports","quote":"「大巧若拙——竹月堂藏瓷II」","contentWeight":1,"pageTopic":"嘉德香港春拍","rationale":"页面提到该专场"}',
    });
    const outcome = await compareClaimToPage({ claim: claim(), page, pack: porcelainPack });
    expect(outcome).toMatchObject({ rejected: true });
    expect(String((outcome as { reason: string }).reason)).toContain('字段');
  });

  it('重试仍给不出字段线索即拒收，且只重试一次（两次调用）', async () => {
    (invokeLLM as Mock).mockResolvedValue({
      content: '{"relation":"supports","quote":"中国古董珍玩板块集合了十二个专场","contentWeight":1}',
    });
    const outcome = await compareClaimToPage({ claim: claim(), page, pack: porcelainPack });
    expect(outcome).toMatchObject({ rejected: true });
    expect((invokeLLM as Mock).mock.calls).toHaveLength(2);
  });

  it('引文写到了该字段就照常采信（护栏只挡"没说这个字段"）', async () => {
    (invokeLLM as Mock).mockResolvedValue({
      content: '{"relation":"supports","quote":"4月7日晚上，为期5天的中国嘉德香港2024春季拍卖会","contentWeight":1}',
    });
    const withDate: CapturedPage = { ...page, text: '4月7日晚上，为期5天的中国嘉德香港2024春季拍卖会，圆满结束。' };
    const outcome = await compareClaimToPage({ claim: claim(), page: withDate, pack: porcelainPack });
    expect(outcome).toMatchObject({ relation: 'supports', contentWeight: 1 });
  });

  it('判 irrelevant 的行不受这条约束（不计票的行不问线索）', async () => {
    (invokeLLM as Mock).mockResolvedValue({
      content: '{"relation":"irrelevant","quote":"中国古董珍玩板块集合了十二个专场","contentWeight":0.6}',
    });
    const outcome = await compareClaimToPage({ claim: claim(), page, pack: porcelainPack });
    expect(outcome).toMatchObject({ relation: 'irrelevant' });
    expect((invokeLLM as Mock).mock.calls).toHaveLength(1);
  });
});
