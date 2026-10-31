// src/lodestar/packs/porcelain/index.ts
/**
 * 瓷器（古玩拍卖）领域证据策略包
 *
 * 本包回答四件引擎不回答的事：
 * 1. 一条"拍卖会专场"记录由哪些字段构成，其中哪些算**关键字段**（共现门禁的门槛）；
 * 2. 本域里"什么算一致 / 什么算矛盾 / 什么算同一页面命中"；
 * 3. 哪些域名是官方源、哪些是一手报道、哪些是聚合站（域名集只从宿主系统的来源白名单只读派生）；
 * 4. 哪些链接算"这一场的详情页"（坐标臂整场摊开用）。
 *
 * 战略范围台账已裁：专注古玩垂直领域、以瓷器为示例，不承诺第二域跑通。
 * 换域 = 换一个包，引擎不改（策略包可换性有单测断言）。
 */

import type { ClaimTimeScope, RoutingInfo } from '../../types';
import { blockedReasonOf, WHITELIST_ENTRIES, type WhitelistEntry } from './sources';
import {
  canonicalHouseName,
  categoryTagsFrom,
  COLUMN_ALIASES,
  DETAIL_PATH_HINTS,
  familyOf,
  HUB_PATH_HINTS,
  knownHostsOf,
  normalizeSessionName,
  officialHostsOfHouse,
  parseTimeScope,
  registrableDomain,
  SOURCE_CHANNELS,
  SOURCE_COLUMN_ALIASES,
  tierOf,
} from './rules';
import { pageMentions, querySurfaces, quoteBearsFieldClue, sourceMentions } from './slots';
import { normalizeText } from '../../normalize';
import {
  fillTemplate,
  keyFieldKeysOf,
  type DomainPack,
  type EntryPassage,
  type FieldSpec,
  type ParsedRecord,
  type RouteInput,
  type SourceFieldSpec,
} from '../pack';

/** 字段清单：机构 + 年份 + 专场主题为关键字段（实测后可收窄，改这里不改引擎） */
const FIELDS: FieldSpec[] = [
  {
    key: 'auctionHouse',
    label: '拍卖机构',
    role: 'key',
    predicate: '主办机构',
    subjectKeys: ['self'],
    claimTemplate: '{dateText}「{sessionName}」专场由{self}举办',
    queryTemplates: [
      '{auctionHouse} {dateText} {sessionName} 拍卖 专场',
      '{auctionHouse} {dateText} 拍卖 图录 {category}',
      '"{sessionName}" {auctionHouse} auction results',
    ],
    askNote: '写机构全称（如"中国嘉德"而非"嘉德"）',
  },
  {
    key: 'dateText',
    label: '举办时间',
    role: 'key',
    predicate: '举办时间',
    subjectKeys: ['auctionHouse'],
    claimTemplate: '{auctionHouse}于{self}举办「{sessionName}」专场',
    queryTemplates: [
      '{auctionHouse} {dateText} {sessionName}',
      '{auctionHouse} {dateText} 拍卖 预展 地点',
    ],
    askNote: '尽量到年月（"2014年5月"优于"2014年"）',
  },
  {
    key: 'sessionName',
    label: '专场名称',
    role: 'key',
    predicate: '专场主题',
    subjectKeys: ['auctionHouse'],
    claimTemplate: '{auctionHouse}{dateText}举办的专场名称为「{self}」',
    queryTemplates: [
      '"{sessionName}" {auctionHouse} {dateText}',
      '{auctionHouse} {dateText} {sessionName} 拍品',
    ],
    askNote: '专场原名，不要改写成描述',
  },
  {
    key: 'location',
    label: '举办地点',
    role: 'secondary',
    predicate: '举办地点',
    subjectKeys: ['auctionHouse'],
    claimTemplate: '{auctionHouse}{dateText}的「{sessionName}」专场举办地为{self}',
    queryTemplates: ['{auctionHouse} {dateText} 拍卖 {location}'],
  },
  {
    key: 'category',
    label: '专场类目',
    role: 'secondary',
    predicate: '专场类目',
    subjectKeys: ['auctionHouse'],
    claimTemplate: '{auctionHouse}{dateText}的「{sessionName}」专场以{self}为主要门类',
    queryTemplates: ['{auctionHouse} {dateText} {category} 专场'],
  },
  {
    key: 'totalHammer',
    label: '总成交额',
    role: 'secondary',
    predicate: '总成交额',
    subjectKeys: ['auctionHouse'],
    claimTemplate: '{auctionHouse}{dateText}的「{sessionName}」专场总成交额为{self}',
    // 统计量属聚合裁决范畴（本期不做），路由会把它打成 decompose
    queryTemplates: ['{auctionHouse} {dateText} {sessionName} 总成交额'],
  },
  // 专场编号/图录号/lots 号这类编号字段已整类移除（2026-10-09 用户裁决）：
  // 实测枚举渠道模型产出的编号全是编造（嘉德系出现 0123/0456/0789 占位串），
  // 而编号对共现门禁毫无贡献——真值只能来自页面证据，不由模型生成。
];

/**
 * 来源坐标的字段清单（"某件器物的可采集入口"这类坐标，不是一个具体场次）。
 *
 * 主题与年代是关键字段：入口页必须说到这件东西（主题判"no"即拒收）；
 * 年代判不了只放行——古玩页常写"清乾隆"这类合写，机械规则不该据此判死。
 * 机构/平台与品类是次要字段：品类入口页往往不写机构名。
 */
const SOURCE_FIELDS: SourceFieldSpec[] = [
  {
    key: 'topic',
    label: '器物主题',
    role: 'key',
    askNote: '只写器物本身（如"黄花梨躺椅"）；年代、材质另填',
  },
  {
    key: 'period',
    label: '年代',
    role: 'key',
    askNote: '朝代或时期（如"清代"、"清中期"）',
  },
  { key: 'material', label: '材质', role: 'secondary' },
  {
    key: 'sourceName',
    label: '机构/平台',
    role: 'secondary',
    askNote: '拍卖行、古玩商或交易平台名称（如"中国嘉德"、"1stDibs"）',
  },
  { key: 'category', label: '品类', role: 'secondary' },
];

/** 模型返回的列名 → 本包字段键（列名各次作答都可能不同，别名表在 rules.ts） */
function mapColumns(
  row: Record<string, unknown>,
  aliases: Record<string, string[]>,
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  const aliasToKey = new Map<string, string>();
  for (const [key, names] of Object.entries(aliases)) {
    aliasToKey.set(key.toLowerCase(), key);
    for (const alias of names) aliasToKey.set(alias.toLowerCase(), key);
  }
  for (const [rawKey, rawValue] of Object.entries(row)) {
    const target = aliasToKey.get(String(rawKey).trim().toLowerCase());
    if (!target) continue;
    if (typeof rawValue !== 'string' && typeof rawValue !== 'number') continue;
    const text = String(rawValue).trim();
    if (text === '' || /^(?:无|未知|不确定|n\/?a|none|unknown|-+)$/i.test(text)) continue;
    out[target] = text;
  }
  return out;
}

/**
 * 本域内判定细则：逐条写给"逐源比对"那一次模型调用。
 * 每条都在回答一个具体的错判形态（机构简称、页脚年份、名称含瓷器但拍品是杂项…）。
 */
const JUDGEMENT_RULES: Record<string, string> = {
  auctionHouse:
    '页面须把该机构写在这场拍卖的主办方位置。机构简称与全称视为同一主体（"嘉德"＝"中国嘉德"、"保利"＝"北京保利"）；' +
    '机构名只出现在页头导航、友情推荐、合作媒体或新闻链接里不算命中。' +
    '**同一主体的排版差异不构成矛盾**：括号有无与全半角（"中国嘉德（香港）"＝"中国嘉德香港"＝"香港嘉德"）、' +
    '中英文混用、"拍卖有限公司"这类尾缀有无，都算同一家——但地区/子公司（香港、北京）不同属于不同主体，要按矛盾处理。',
  dateText:
    '年份须是该场的**举办年份**。页面上的收录时间、更新时间、文章发布时间、Copyright 年份、"始建于"年份一律不算；' +
    '断言给到月份而页面只给到年份且季度相符，判 supports 但注明精度不足。' +
    '**季度式与月份式是同一件事的两种写法**：页面写"2021秋季艺术品拍卖会"而断言写"2021年11月"（11 月落在秋季档 9–12 月内）判 supports；' +
    '页面只写"4月7日"这类无年份的日期时，须与同段或标题里的年份连读才算说到。',
  sessionName:
    '以专场名称与该场的拍品构成共同判断。仅名称含"瓷器"但拍品以杂项、书画为主，判 refutes；' +
    '名称为断言所述专场的子场（如"瓷器（一）"）判 supports 并注明。' +
    '**专场名的标点与编号写法不算差异**：书名号与引号的有无、主副标题之间的破折号被改成空格或整段省略、' +
    '罗马数字与阿拉伯数字互写（"藏瓷II"＝"藏瓷2"）、尾缀"专场/拍卖会"有无，都按同一名处理；' +
    '但**编号不同属于不同场次**（"藏瓷I"与"藏瓷II"是两场），不能因为名称大部分相同就判同一场。',
  location: '地点须与该场实际拍卖地/预展地一致；同一机构在多地设展时，任一地命中即为 supports 并写明是哪一地。',
  category: '以该场图录的门类划分或拍品构成判断，不以下拉导航判断。',
  totalHammer: '总成交额只在页面明确写出该场总额时判断；把若干单件价格相加得到的数字不算。',
  __default:
    '判定只依据页面正文写明的事实。搜索引擎摘要、缓存摘要、图片 alt 文本不作为依据；' +
    '页面没有谈到这条断言时判 irrelevant，不要勉强判矛盾。' +
    '本域内的同义写法（简称与全称、括号与连排、季度与月份、书名号与破折号、罗马与阿拉伯编号）按同一样东西处理，' +
    '**不得因为它们字面不同就判 irrelevant**——但引文仍须从页面原样复制，不许把两种写法混在一起抄。',
};

/** 导航/分页/动作类锚文本（出现在链接文字里即判"这不是某一件拍品的入口"） */
const DETAIL_ANCHOR_NEGATIVES = /首页|更多|下一页|上一页|返回|登录|注册|分享|下载|查看全部|查看更多|列表|目录/;

/** 详情链接识别的排除项（本域）：枢纽页/附件/下载/分享类参数 */
const DETAIL_NEGATIVES = [
  '/index',
  '/list',
  // 保利的场次列表页形如 auction_list.html?infoId=…，带 infoId 也会被详情特征命中，
  // 必须按文件名整体排除：它是"两跳"里的第一跳（专场页），不是拍品详情。
  'auction_list',
  'auction_index',
  '/search',
  '/category',
  '/login',
  '/register',
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.css',
  '.js',
  'share=',
  'print=',
];

/** 枚举提问的换措辞框架（稳定性复问按顺序循环取用） */
const PARAPHRASE_FRAMES = [
  '{query}只列你确实记得的具体场次；一场都想不起来就输出空数组 []，不要凑数',
  '把{query}逐场列出来，一场一行；只有模糊印象的场次宁可不列',
  '关于{query}，只列你确实记得的具体场次；想不起来就承认不记得，输出 []',
  '请列出{query}，并给出每场的拍卖机构、年份与专场名称；回答短是合格，编造场次是不合格',
];

export const porcelainPack: DomainPack = {
  id: 'porcelain',
  label: '瓷器拍卖专场',
  sourceLabel: '古玩收藏',

  // 拍卖行的官方站点大多是 JS 外壳 + 反爬：直接抓只拿得到空壳，正文要浏览器渲染才有。
  // 因此本包把浏览器列为必备——开跑前就核对，缺插件当场停下（而不是逐条断言暂停）。
  requirements: { browser: 'required' },

  fields: () => FIELDS,

  mapRow(row) {
    return mapColumns(row, COLUMN_ALIASES);
  },

  timeScopeOf(record: ParsedRecord): ClaimTimeScope {
    const scope = parseTimeScope(record.fields.dateText ?? null);
    return { from: scope.from, to: scope.to };
  },

  categoryTagsOf(record: ParsedRecord): string[] {
    return categoryTagsFrom([record.fields.sessionName, record.fields.category, record.fields.auctionHouse]);
  },

  recordMatchKey(record: ParsedRecord): string {
    const house = canonicalHouseName(record.fields.auctionHouse ?? null);
    const scope = parseTimeScope(record.fields.dateText ?? null);
    const year = scope.from ? scope.from.slice(0, 4) : '';
    // 专场名先剥掉"专场/拍卖会"这类每次都可能多写少写的尾词，再截断（模型两次作答用词长短不同）
    const session = normalizeSessionName(record.fields.sessionName ?? null);
    return `${house}\u0000${year}\u0000${session}`;
  },

  valueMatchKey(fieldKey, value) {
    switch (fieldKey) {
      case 'auctionHouse':
        return canonicalHouseName(value);
      case 'dateText': {
        const scope = parseTimeScope(value);
        return scope.from ? scope.from.slice(0, 4) : normalizeText(value);
      }
      case 'sessionName':
        // 模型两次给"珍瓷雅玩"与"珍瓷雅玩专场"是同一样东西，不该被算成两个变体刷低稳定率
        return normalizeSessionName(value);
      default:
        return normalizeText(value);
    }
  },

  querySurfaces(fieldKey, value) {
    return querySurfaces(fieldKey, value);
  },

  pageMentions(fieldKey, value, pageText) {
    return pageMentions(fieldKey, value, pageText);
  },

  quoteBearsFieldClue(fieldKey, value, quote) {
    return quoteBearsFieldClue(fieldKey, value, quote);
  },

  enumerationPhrasings(query, runCount) {
    if (runCount <= 0) return [];
    const out: string[] = [];
    for (let i = 0; i < runCount; i++) {
      const frame = PARAPHRASE_FRAMES[i % PARAPHRASE_FRAMES.length];
      out.push(frame.replace('{query}', query));
    }
    return out;
  },

  concretizationAsk(missing) {
    if (missing.length === 0) return '';
    const list = missing
      .map((f) => `- ${f.label}${f.askNote ? `（${f.askNote}）` : ''}`)
      .join('\n');
    return [
      '下面这几场事件你还记得更多要素，请逐场补全；',
      '**想不起来的那一项就填"不记得"，不要推测、不要凑一个看起来合理的值**：',
      list,
    ].join('\n');
  },

  route(input: RouteInput): RoutingInfo {
    const text = input.atomicText;

    // 物品级个体断言：永久拒收（单源三重命中，三元条件的第一个就不成立）
    if (/^(?:lot|图录号|拍品编号)\s*[0-9]/i.test(text) || /这件|该件|此件/.test(text)) {
      return { route: 'reject', mode: 'L5', reason: 'object-level-individual-assertion' };
    }
    // 统计聚合类：本期不做聚合裁决，转 decompose（拆成存在性 + 属性再重入）
    if (input.fieldKey === 'totalHammer' || /总成交额|成交额|成交率|均价|共计|总计/.test(text)) {
      return { route: 'decompose', mode: 'L3', reason: 'aggregate-statistic' };
    }
    // 未来事件：当前无法查证
    const currentYear = new Date().getFullYear();
    const fromYear = input.atomicText.match(/(1[89]\d{2}|20\d{2})/);
    if (fromYear && Number(fromYear[1]) > currentYear) {
      return { route: 'reject', mode: null, reason: 'future-event' };
    }
    // 自指（关于模型自己／训练语料）
    if (/训练数据|预训练|我的记忆|模型记忆/.test(text)) {
      return { route: 'reject', mode: null, reason: 'self-referential' };
    }
    // 主观评价：写不出"一致／矛盾"的判定规则
    if (/最精美|极具价值|值得收藏|艺术价值极高/.test(text)) {
      return { route: 'reject', mode: null, reason: 'subjective-value' };
    }
    return {
      route: 'verify',
      mode: input.fieldRole === 'key' ? 'L1' : 'L2',
      reason: 'existence-or-attribute-with-multi-source',
    };
  },

  judgementRules(fieldKey) {
    const specific = fieldKey ? JUDGEMENT_RULES[fieldKey] : undefined;
    return specific ? `${specific}\n${JUDGEMENT_RULES.__default}` : JUDGEMENT_RULES.__default;
  },

  cooccurrenceRule() {
    return (
      '共现命中＝**同一个页面**同时命中全部关键字段（拍卖机构、举办时间、专场名称）且各自带逐字引文。' +
      '机构年表页只写"2021 年办过秋拍"而不含专场名称，不算命中；' +
      '把 A 场的年份与 B 场的专场名称分列在页面的不同位置（如导航栏 + 页脚）不算命中，' +
      '引文必须来自描述该场本身的段落。'
    );
  },

  evidenceDomains(term) {
    const cnTerm = /瓷|陶|青花|粉彩|彩墨|珐琅|中国|民窑|官窑|古玩|玉器|木器/.test(term);
    /** 本域的先验：中文瓷器问题优先查中国拍行的官网（国际大宅的瓷器场次少，命中概率低） */
    const regionalBonus = (domain: string): number =>
      !cnTerm ? 0 : /(^|\.)(cn|com\.cn|net\.cn)$/i.test(domain) ? 0 : 1;
    const rank = (entry: WhitelistEntry): number => {
      const tier = tierOf(entry.domain);
      const tierRank = tier === 'official' ? 0 : tier === 'primary' ? 1 : tier === 'aggregator' ? 2 : 3;
      // verified 先出（可达性已实锤），candidate 垫后——搜索配额先花在查得到结果的域名上
      const statusRank = entry.status === 'verified' || entry.status === undefined ? 0 : 1;
      return tierRank * 2 + statusRank;
    };
    const sorted = WHITELIST_ENTRIES
      .filter((e) => e.status !== 'dead' && typeof e.domain === 'string' && e.domain !== '')
      .sort((a, b) => {
        const domainA = registrableDomain(a.domain);
        const domainB = registrableDomain(b.domain);
        return (
          regionalBonus(domainA) - regionalBonus(domainB) ||
          rank(a) - rank(b) ||
          domainA.localeCompare(domainB)
        );
      });
    return [...new Set(sorted.map((e) => registrableDomain(e.domain)))];
  },

  tierOf,

  sourceFamilyOf: familyOf,

  blockedReason(url) {
    return blockedReasonOf(url);
  },

  isDetailLink({ candidateUrl, pathname, search, hubUrl, anchorText }) {
    const haystack = `${pathname}${search}`.toLowerCase();
    if (DETAIL_NEGATIVES.some((token) => haystack.includes(token))) return false;
    if (candidateUrl.replace(/\/+$/, '') === hubUrl.replace(/\/+$/, '')) return false;
    if (DETAIL_ANCHOR_NEGATIVES.test(anchorText.trim())) return false;
    return DETAIL_PATH_HINTS.some((token) => haystack.includes(token.toLowerCase()));
  },

  isHubUrl(url) {
    let pathAndQuery = url.toLowerCase();
    try {
      const parsed = new URL(url);
      pathAndQuery = `${parsed.pathname}${parsed.search}`.toLowerCase();
    } catch {
      // 解析不了就按原串找——判错了只影响顺序，不会判死一页
    }
    return HUB_PATH_HINTS.some((token) => pathAndQuery.includes(token.toLowerCase()));
  },

  // ============ 来源坐标（器物/品类入口） ============

  sourceFields: () => SOURCE_FIELDS,

  mapSourceRow(row) {
    return mapColumns(row, SOURCE_COLUMN_ALIASES);
  },

  sourceMentions(fieldKey, value, pageText) {
    return sourceMentions(fieldKey, value, pageText);
  },

  sourceSearchPhrases(fields) {
    const pick = (key: string): string => (fields[key] ?? '').trim();
    // 没有器物主题的"入口供给"无从检索：只剩材质/机构会搜回一大片无关页
    if (pick('topic') === '') return [];
    const phrases: string[] = [];
    const push = (parts: string[]): void => {
      const phrase = parts.filter((part) => part !== '').join(' ').trim();
      if (phrase !== '' && !phrases.includes(phrase)) phrases.push(phrase);
    };
    // 完整身份（机构 + 年代 + 材质 + 主题）后再给紧凑形态：主题检索性最好，机构名反而会把结果锁死
    push([pick('sourceName'), pick('period'), pick('material'), pick('topic')]);
    push([pick('period'), pick('material'), pick('topic')]);
    push([pick('material'), pick('topic')]);
    return phrases;
  },

  entryPassages({ fields, evidenceHosts }) {
    const hosts = new Set<string>(evidenceHosts.map((host) => registrableDomain(host)));
    for (const host of knownHostsOf(fields.sourceName)) hosts.add(host);
    for (const host of officialHostsOfHouse(fields.auctionHouse)) hosts.add(host);
    const query = [fields.material, fields.topic]
      .map((value) => (value ?? '').trim())
      .filter((value) => value !== '')
      .join(' ');
    const out: EntryPassage[] = [];
    const seen = new Set<string>();
    for (const host of hosts) {
      const channel = SOURCE_CHANNELS[host];
      if (!channel) continue;
      if (channel.archive && !seen.has(channel.archive.url)) {
        seen.add(channel.archive.url);
        out.push({ url: channel.archive.url, kind: 'archive', note: channel.archive.note });
      }
      if (channel.search && query !== '') {
        const url = channel.search(query);
        if (!seen.has(url)) {
          seen.add(url);
          out.push({ url, kind: 'site-search', note: `站内检索：${query}` });
        }
      }
    }
    return out;
  },

  sourceHosts(fields) {
    const hosts = [
      ...knownHostsOf(fields.sourceName),
      ...officialHostsOfHouse(fields.auctionHouse),
    ];
    return [...new Set(hosts)];
  },

  relayTargetHosts({ fields, evidenceHosts }) {
    const hosts = [
      ...officialHostsOfHouse(fields.auctionHouse),
      ...knownHostsOf(fields.sourceName),
    ];
    return hosts.length > 0 ? [...new Set(hosts)] : evidenceHosts;
  },
};

/** 本包的关键字段键（引擎按它构造共现门禁，不硬编码字段名） */
export const PORCELAIN_KEY_FIELDS = keyFieldKeysOf(FIELDS);

export default porcelainPack;
