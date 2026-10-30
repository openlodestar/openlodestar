/**
 * 站点级来源线索核实（不调模型）
 *
 * 模型只报"记得哪个网站上有某件器物的内容"，这里把它变成可机械判定的问题：
 * 以域名约束检索（site:），抓回页面后看它有没有同时提到材质与器物。
 *
 * 命中只证明"这个站上有这类内容"，**不证明这页能作为采集入口**——入口性仍归来源门禁。
 */

export interface SiteTopic {
  period: string | null;
  material: string | null;
  topic: string | null;
}

export interface SiteMention {
  material: boolean;
  object: boolean;
  period: boolean;
  matched: boolean;
}

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

/** 去标签与实体后的正文（机械判定的输入；不追求还原排版） */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 站内检索短语：`site:<域> 材质 器物`。
 *
 * 年代不进查询——页面常只写"黄花梨躺椅"而不写朝代，带上"清代"会先把自己筛掉；
 * 年代只作为页面判定的加分项。
 */
export function siteSearchQuery(domain: string, topic: SiteTopic): string | null {
  const object = (topic.topic ?? '').trim();
  if (object === '') return null;
  const material = (topic.material ?? '').trim();
  const phrase = material !== '' && !object.includes(material) ? `${material} ${object}` : object;
  return `site:${domain.trim()} ${phrase}`;
}

const PERIOD_CLUE = /清代|清朝|清中期|清晚期|清早期/;
const MATERIAL_ALIASES: Record<string, string[]> = {
  黄花梨: ['黄花梨', '花梨'],
};

/** 页面是否同时提到材质与器物（年代只记加分，不参与 matched） */
export function topicHits(pageText: string, topic: SiteTopic): SiteMention {
  const hay = pageText.toLowerCase().replace(/\s+/g, '');
  const material = (topic.material ?? '').trim();
  const object = (topic.topic ?? '').trim();
  const materials =
    material === '' ? [] : (MATERIAL_ALIASES[material] ?? [material]).map((word) => word.toLowerCase());
  const materialHit = materials.some((word) => hay.includes(word));
  const core = material !== '' && object.startsWith(material) ? object.slice(material.length).trim() : object;
  const objectHit = (core !== '' ? core : object).toLowerCase().replace(/\s+/g, '');
  const objectPart = objectHit !== '' && hay.includes(objectHit);
  const periodHit = PERIOD_CLUE.test(hay);
  return {
    material: materialHit,
    object: objectPart,
    period: periodHit,
    matched: objectPart && (materials.length === 0 || materialHit),
  };
}

export type SiteVerdict = 'hit' | 'miss' | 'no-domain' | 'no-result' | 'fetch-failed';

export interface SiteVerifyPage {
  url: string;
  ok: boolean;
  fetcher: string;
  plainLength: number;
  mention: SiteMention | null;
  reason?: string;
}

export interface SiteVerifySearch {
  domain: string;
  query: string;
  resultCount: number;
}

export interface SiteVerifySite {
  site: string;
  domains: string[];
  searches: SiteVerifySearch[];
  pages: SiteVerifyPage[];
  verdict: SiteVerdict;
  note?: string;
}

export interface SiteVerifyMeta {
  stamp: string;
  topic: SiteTopic;
  maxPagesPerSite: number;
  maxTotalPages: number;
  browser: boolean;
}

export interface SiteVerifyReportInput {
  meta: SiteVerifyMeta;
  sites: SiteVerifySite[];
}

const VERDICT_LABEL: Record<SiteVerdict, string> = {
  hit: '命中',
  miss: '未命中',
  'no-domain': '无已知域名',
  'no-result': '检索无结果',
  'fetch-failed': '抓取失败',
};

function cell(value: string): string {
  return value.replace(/\|/g, '\\|');
}

function yesNo(value: boolean): string {
  return value ? '✓' : '×';
}

export function renderSiteVerifyReport(input: SiteVerifyReportInput): string {
  const { meta, sites } = input;
  const hit = sites.filter((site) => site.verdict === 'hit').length;
  const miss = sites.filter((site) => site.verdict === 'miss').length;
  const other = sites.length - hit - miss;
  const lines: string[] = [
    '# 站点级来源线索核实',
    '',
    `- 时间：${meta.stamp}`,
    `- 器物：${[meta.topic.period, meta.topic.material, meta.topic.topic].filter((v) => v).join(' ') || '（未指定）'}`,
    `- 参数：每站最多抓 ${meta.maxPagesPerSite} 页 · 总预算 ${meta.maxTotalPages} 页 · 浏览器重抓${meta.browser ? '开' : '关'}`,
    '- 口径：页面同时提到材质与器物才算"站上有这类内容"；**命中不等于入口可采**。',
    '',
    '## 1. 输入与检索',
    '',
    '| # | 网站 | 已知域名 | 站内检索 | 结果数 |',
    '|---|---|---|---|---|',
  ];
  sites.forEach((site, index) => {
    const domain = site.domains.join('、') || '（未解析）';
    const search = site.searches[0];
    lines.push(
      `| ${index + 1} | ${cell(site.site)} | ${cell(domain)} | ${search ? cell(search.query) : '（未检索）'} | ${search ? search.resultCount : '-'} |`,
    );
  });
  lines.push('', '## 2. 逐站结果', '');
  for (const site of sites) {
    lines.push(`### ${site.site} — ${VERDICT_LABEL[site.verdict]}`, '');
    if (site.note) lines.push(`- 说明：${site.note}`, '');
    if (site.pages.length === 0) {
      lines.push('- 未抓取任何页面。', '');
      continue;
    }
    lines.push('| 页面 | 取回 | 材质词 | 器物词 | 年代词 | 判定 |', '|---|---|---|---|---|---|');
    for (const page of site.pages) {
      const mention = page.mention;
      lines.push(
        `| ${cell(page.url)} | ${page.ok ? page.fetcher : `失败（${page.reason ?? '未知'}）`} | ${mention ? yesNo(mention.material) : '-'} | ${mention ? yesNo(mention.object) : '-'} | ${mention ? yesNo(mention.period) : '-'} | ${mention ? (mention.matched ? '命中' : '未命中') : '-'} |`,
      );
    }
    lines.push('');
  }
  lines.push(
    '## 3. 汇总',
    '',
    `- 命中 ${hit} · 未命中 ${miss} · 其他 ${other}（无域名／检索无结果／抓取失败）`,
    '- 本记录只判"站上有这类内容"；能不能采，要再由入口解析与来源门禁判定。',
  );
  return lines.join('\n');
}
