// src/lodestar/packs/pack.ts
/**
 * 领域证据策略包的对外契约（引擎 ↔ 域知识的唯一接缝）
 *
 * 分层纪律（引擎只认策略包给的接口；域知识、字段口径、域名清单一律留在包里）：
 * **引擎只做通用动作**——同域、文档序、去重、截断、计票、门禁；
 * **凡"这个领域里什么算关键字段 / 什么算同页命中 / 哪个站更权威 / 哪些链接算详情页"
 * 一律由策略包给出**。换一个问题域就该换一个包，引擎一行不改。
 *
 * 策略包可换性由 `packs/packs.test.ts` 断言：换一个包，路由与关键字段清单跟着变。
 */

import type {
  AnchorKind,
  ClaimTimeScope,
  FieldRole,
  RoutingInfo,
  SourceTier,
} from '../types';

/** 一个字段在本领域里的完整定义 */
export interface FieldSpec {
  /** 字段键（记录容器与坐标 fields 用它） */
  key: string;
  /** 人读标签（提问表头与审计展示用） */
  label: string;
  /** 关键字段须被同一页面共现命中；次要字段允许单源或缺失 */
  role: FieldRole;
  /**
   * 该字段原子化后的句子模板。
   * 占位符 `{self}` 取本字段值，`{otherKey}` 取同记录其它字段的值（缺值留空）。
   */
  claimTemplate: string;
  /** 原子断言的谓词（"主办机构" / "举办年份" / "专场主题"…） */
  predicate: string;
  /**
   * 主语取哪些字段的值（按顺序取第一个非空）。
   * 特殊值 `self` = 本字段自己的值。缺省按 `['self']` 处理。
   */
  subjectKeys?: string[];
  /** 该字段的检索查询模板（同一组占位符规则） */
  queryTemplates: string[];
  /** 提问时对该字段的补充说明（可缺省） */
  askNote?: string;
}

/** 一条已解析的记录（一场事件） */
export interface ParsedRecord {
  recordId: string;
  /** 字段键 → 字段值（缺值为 null） */
  fields: Record<string, string | null>;
  /** 模型那一行的原始文本（回溯用） */
  rawText: string;
}

/**
 * 来源坐标（品类/机构入口）的字段规格。
 * 引擎只按 `role` 取"哪些值必须在入口页上出现"，不认识具体字段名。
 */
export interface SourceFieldSpec {
  key: string;
  label: string;
  role: FieldRole;
  askNote?: string;
}

/** 入口供给段落的形态（域知识：某机构的归档页 / 站内检索 / 品类枢纽） */
export type EntryPassageKind = 'archive' | 'site-search' | 'category';

/** 一条由策略包直接给出的入口候选（不经过搜索召回） */
export interface EntryPassage {
  url: string;
  kind: EntryPassageKind;
  note?: string;
}

export interface EntryPassageInput {
  anchorKind: AnchorKind;
  /** 坐标已核验字段（只读；包据此选机构对应的归档/品类入口） */
  fields: Record<string, string | null>;
  /** 坐标证据页的域名（无 scheme），用于把已知的归档路径拼到真实主机上 */
  evidenceHosts: string[];
}

/** 路由判定需要的最小输入 */
export interface RouteInput {
  atomicText: string;
  subject: string;
  predicate: string;
  object: string;
  fieldKey: string | null;
  fieldRole: FieldRole;
}

/** 详情链接识别的输入（坐标臂"整场摊开"用） */
export interface DetailLinkInput {
  /** 专场页（枢纽页）URL */
  hubUrl: string;
  /** 已解析为绝对的候选链接 */
  candidateUrl: string;
  /** 链接锚文本 */
  anchorText: string;
  /** href 上的路径与查询串 */
  pathname: string;
  search: string;
}

/**
 * 预筛结论（`DomainPack.pageMentions` 的返回值）
 * - `yes`：页面上能找到该字段值的某种写法，照常送去比对；
 * - `no`：一种写法都找不到，**省掉这次模型调用**（不许因此产生证据行）；
 * - `unknown`：本包规则判不了——绝不当成"没有"，照常比对。
 */
export type PageMention = 'yes' | 'no' | 'unknown';

/**
 * 策略包对运行环境的要求（由引擎在开跑前核对，缺什么当场停下）
 *
 * 为什么放在包里而不是引擎里：**同一个引擎，不同领域对网页的期望不同**。
 * 古董拍卖的官方站点普遍是 JS 外壳 + 反爬（正文要等脚本灌进去才出现），
 * 不给浏览器就抓回空壳；而只读新闻/公告的领域全是静态 HTML，给它们强加浏览器依赖
 * 属于凭空增加安装体积与启动延迟。所以"这个域要不要浏览器"是域知识，由包声明。
 */
export interface PackRequirements {
  /**
   * 浏览器渲染的必要性：
   * - `required`：开跑前探针一次，不可用就抛 `BrowserUnavailableError`（不花检索与模型预算）；
   * - `optional` / 缺省：只在"直接抓取拿不到正文"时按需调用，缺工具则该页记"需要浏览器"后暂停。
   */
  browser?: 'required' | 'optional';
}

/** 策略包契约 */
export interface DomainPack {
  /** 包标识（写进坐标与底稿，便于分层统计） */
  readonly id: string;
  /** 人读名称 */
  readonly label: string;
  /**
   * 来源侧的人读领域名（来源提问的角色设定）；缺省用 `label`。
   * 事件域比入口域窄时单独覆盖：例如事件只收“瓷器拍卖专场”，
   * 而入口可以给任何古玩品类的机构/平台页。
   */
  readonly sourceLabel?: string;

  /**
   * 运行环境要求（缺省 = 除"直接抓取"外什么都不需要）。
   * 声明了 `browser: 'required'` 的包，引擎会在花第一分钱之前核对浏览器插件可用。
   */
  readonly requirements?: PackRequirements;

  // ============ 记录容器与字段 ============

  /** 字段清单（含关键字段与次要字段）——共现门禁的门槛由它决定 */
  fields(): FieldSpec[];

  /** 模型返回的一行（列名各次提问都可能不同）→ 本包字段键 */
  mapRow(row: Record<string, unknown>): Record<string, string | null>;

  /** 一条记录的时间范围（从字段值解析，解析不出返回全 null） */
  timeScopeOf(record: ParsedRecord): ClaimTimeScope;

  /** 类目标签：坐标给宿主系统按类目自动匹配的唯一素材 */
  categoryTagsOf(record: ParsedRecord): string[];

  /**
   * 记录对齐键：换措辞复问的多次作答里"是不是同一场"就按它判。
   * 机构简称、年份写法这类等价关系是域知识，所以由包给（引擎只会 normalizeText）。
   */
  recordMatchKey(record: ParsedRecord): string;

  /** 字段值等价键：同一字段的两种写法算不算复现了同一条断言 */
  valueMatchKey(fieldKey: string, value: string): string;

  /**
   * 字段值的**等价写法集合**（第 0 个是拼检索串用的首选形态）。
   *
   * 只喂两处：拼查询串、页面预筛。**不回写断言内容**——被核验的命题永远是
   * `ClaimRecord.object` 那句话，否则我们是在核验自己造的断言（"命题只认模型原话"的另一半）。
   * 换一个问题域这套写法表就完全不同（拍卖域的"季节 ↔ 月份"在别处毫无意义），所以它是包的方法。
   */
  querySurfaces(fieldKey: string, value: string): string[];

  /**
   * 预筛：这页正文对这个字段值**有没有说法**（纯规则，不调模型）。
   *
   * 用途只有一个——判 `no` 时省掉那次按页比对调用。判不了必须返回 `unknown`（照常比对），
   * 因为预筛的错杀等于无声地丢掉一条证据，而它本身不在任何底稿里留下"我们看过又不要"的痕迹。
   */
  pageMentions(fieldKey: string, value: string, pageText: string): PageMention;

  /**
   * 写入侧的第二道机械断言：这串引文**有没有写到**被裁的那个字段（纯规则，不调模型）。
   *
   * 逐字命中只证明"这串字在页面上"，不证明它说的是被裁字段——实测出现过"字段是举办时间、
   * 引文却是专场名"的行照样计票。判 `yes` 放行、判 `no` 拒收（调用方会让模型改一次再判），
   * 判不了必须返回 `unknown` 放行：引擎不许把本域判不了的情况升级成拒收。
   */
  quoteBearsFieldClue(fieldKey: string | null, value: string | null, quote: string): PageMention;

  /** 枚举式提问的措辞变体（第一条即正式提问，其余为换措辞复问；顺序不可颠倒） */
  enumerationPhrasings(query: string, runCount: number): string[];

  /** 具体化追问的话术（只补全要素，不暗示"应该有答案"） */
  concretizationAsk(missing: FieldSpec[]): string;

  // ============ 裁决 ============

  /** 路由：这条断言本包能不能裁、按哪一档裁 */
  route(input: RouteInput): RoutingInfo;

  /** 逐源比对时给模型的判定细则（域内"什么算一致 / 什么算矛盾"） */
  judgementRules(fieldKey: string | null): string;

  /** 共现命中的域内补充判据（"机构年表只写年份不含专场主题，不算命中"这类） */
  cooccurrenceRule(): string;

  /** 定向检索的域名集（必须从宿主系统的来源白名单只读派生，不许自建一份域名清单） */
  evidenceDomains(term: string): string[];

  /** 域名 → 权威档位（复用宿主系统站点分级的现成档位，不再新设计一层） */
  tierOf(domain: string): SourceTier;

  /** 域名 → 来源家族（同一机构的中英文站 / 主域与 .com.cn 归并为一个独立来源） */
  sourceFamilyOf(domain: string): string;

  /**
   * 检索候选的域内剔除：返回非空字符串 = 该 URL 不进候选池（文本写进检索足迹）。
   *
   * 哪些页对本域没有证据价值（百科无价格、问答站反爬、导航枢纽）是域知识，
   * 由包持有；引擎不认识具体域名，也不替包判断“该不该封”。
   * 缺省 = 不剔除任何候选。
   */
  blockedReason?(url: string): string | null;

  // ============ 消费侧（坐标臂） ============

  /** 哪些链接算"这一场的详情页"（引擎只做同域 + 文档序 + 去重 + 截断） */
  isDetailLink(input: DetailLinkInput): boolean;

  /**
   * 这条 URL 像不像"这一季/这一场的列表枢纽页"（**只用于排序与浏览器重取预算，不用于验收**）。
   *
   * 入口解析会先试更像枢纽的候选、并在外壳重取时把预算优先花在它们身上。
   * 判错了代价只是顺序，不会把一页判死，所以本钩子可以粗；域内路径形态是域知识，
   * 由包给——引擎不认 `auction_list.html` 这种具体文件名。
   */
  isHubUrl?(url: string): boolean;

  // ============ 入口供给（采集侧） ============

  /**
   * 来源坐标（品类/机构入口）的字段清单。缺省 = 本包只支持事件坐标。
   *
   * 引擎按 `role === 'key'` 的值判断"入口页有没有说到这个主题"，
   * 不认识 `topic` / `material` 这些具体键——换域只换包。
   */
  sourceFields?(): SourceFieldSpec[];

  /**
   * 来源坐标的字段提及判定：入口页有没有说到这个主题。
   *
   * 与 `pageMentions` 的差别在负信号：事件字段的 `no` 只用来省一次模型调用（预筛），
   * 来源坐标的 `no` 是**入口验收**——主题都对不上的页不能当入口。所以来源侧由包给出
   * 明确的"这条里没有这种写法 → no"；判不了仍返回 `unknown`。
   */
  sourceMentions?(fieldKey: string, value: string, pageText: string): PageMention;

  /**
   * 来源坐标的行映射（模型作答列名 → 本包来源字段键）。
   * 缺省按字段键原样取；换域时列名别名是域知识。
   */
  mapSourceRow?(row: Record<string, unknown>): Record<string, string | null>;

  /**
   * 来源坐标的检索短语（模型没给 URL 时的搜索键，也是坐标的再入凭证）。
   * 缺省按字段值空格拼合；域内更好的说法（"清代 黄花梨 躺椅 拍卖"）由包给。
   */
  sourceSearchPhrases?(fields: Record<string, string | null>): string[];

  /**
   * 来源坐标里"这个机构/平台自己的域"（无 scheme）。
   *
   * 入口验收用它认"这页是不是来源自己的页"：来源自己的页通过验收即可算强坐标，
   * 第三方转述页则要两页互证。缺省空数组 = 不认自家页，一律按独立来源数判档。
   */
  sourceHosts?(fields: Record<string, string | null>): string[];

  /**
   * 直接给出的入口候选（归档页、站内检索、品类枢纽）。
   *
   * 存在的意义：搜索引擎对旧站内页的召回不可控（实测 2021 年那场索引页
   * 根本不在搜索结果里），已知路径就该由域知识直接供给，而不是继续换搜索词。
   * 引擎只负责排序、抓取与验收；**这里不写抓取逻辑**。
   */
  entryPassages?(input: EntryPassageInput): EntryPassage[];

  /**
   * 聚合站（成交记录/比价站）页面里，哪些目标主机值得跟过去（relay）。
   *
   * 缺省由引擎用"坐标证据页的域名"兜底：聚合站的作用是把旧场次找回来，
   * 真正的入口仍在拍行自己的域上。包可按域覆盖。
   */
  relayTargetHosts?(input: { fields: Record<string, string | null>; evidenceHosts: string[] }): string[];
}

/**
 * 模板填充：`{self}` 取本字段值，`{key}` 取其它字段值。
 * 缺值替换成空串并折叠多余空白——模板本身要保证缺值时句子仍可读。
 */
export function fillTemplate(
  template: string,
  values: Record<string, string | null>,
  selfKey: string,
): string {
  return template
    .replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (_match, key: string) => {
      const raw = key === 'self' ? values[selfKey] : values[key];
      return raw === undefined || raw === null ? '' : String(raw).trim();
    })
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** 取字段清单里的关键字段键 */
export function keyFieldKeysOf(fields: FieldSpec[]): string[] {
  return fields.filter((f) => f.role === 'key').map((f) => f.key);
}
