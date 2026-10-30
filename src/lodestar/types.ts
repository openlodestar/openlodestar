// src/lodestar/types.ts
/**
 * Lodestar 底稿契约（五份 JSONL 的记录形态）
 *
 * 字段名与取值域是对外契约，不许自决；可选性按"该字段在哪个阶段才存在"决定。
 * 字段语义见各字段注释；
 * 取值域是对外契约——可以加值，不能改已有值的含义。
 */

// ============================================
// 取值域
// ============================================

/** 字段在其记录里的角色：关键字段须被同一页面共现命中，次要字段缺失不阻断记录成立 */
export type FieldRole = 'key' | 'secondary';

/** 断言来源渠道：枚举式提问 / 检索增强提取 / 外部提交（自省抽取与领域记忆字段降为默认，未实施） */
export type ClaimChannel = 'enumerative' | 'retrieval-assisted' | 'external';

/** 断言状态机主链 + 三个旁支终态 */
export type ClaimState =
  | 'pending'
  | 'routing'
  | 'verifying'
  | 'adjudicated'
  | 'rejected'
  | 'paused'
  | 'failed';

/** 证据与断言的关系（抓到页面但不涉及断言也是证据，它是 not_found 结论的组成部分） */
export type EvidenceRelation = 'supports' | 'refutes' | 'irrelevant';

/** 四分类裁决（分类学只路由不打分，档位不是置信度） */
export type Verdict = 'supported' | 'refuted' | 'conflicting' | 'not_found';

/** 证据等级：可核验的事实分级，替代无法校准的伪精确置信度 */
export type EvidenceGrade = 'E0' | 'E1' | 'E2' | 'E3';

/** "查无实据"的三因：可修复的没查完 / 没站点 / 真没有 */
export type NotFoundCause = 'budget' | 'coverage' | 'genuinely_absent';

/** 记录级共现门禁三档 */
export type RecordGate = 'strong' | 'weak' | 'rejected';

/** 坐标档位（下游默认只读 strong 档） */
export type AnchorGrade = 'strong' | 'weak';

/**
 * 坐标形态
 * - `event`：某场事件存在（默认；旧坐标缺这一列时按它读）
 * - `source`：某机构/平台的采集入口存在（品类页、归档页、跨家检索页）
 *
 * 两种形态共用"事实 + 证据 + 再入凭证"的外形，但验收判据不同：
 * event 看关键字段是否同页共现，source 看入口页是否为该主题的真实可再入入口。
 */
export type AnchorKind = 'event' | 'source';

/**
 * 来源权威档位（域知识，由策略包按域名判定；引擎只按档位取权重不问出处）
 *
 * - official = 事件主办方自己的站点（一手权威）
 * - primary = 专门的成交记录档案与艺术媒体报道
 * - aggregator = 聚合/比价/门户/零售类二次转述（不得单独作为 refuted 依据）
 * - unlisted = 不在策略包域名集内（降权，且永不构成 E3）
 */
export type SourceTier = 'official' | 'primary' | 'aggregator' | 'unlisted';

/** 路由结论：verify 送裁决 / decompose 拆分后重入 / reject 拒收 */
export type RoutingDecision = 'verify' | 'decompose' | 'reject';

// ============================================
// claims.jsonl
// ============================================

/** 断言的时间限定（ISO 日期串；精度不足时两端同日或留 null） */
export interface ClaimTimeScope {
  from: string | null;
  to: string | null;
}

/** 来源侧信息：只决定"值不值得花钱查"，不参与任何一次计票（红线：稳定性不是可信度） */
export interface ClaimProvenance {
  stabilityRuns: number;
  stabilityHits: number;
  /** 具体要素是否来自追问诱导 */
  promptedDetail: boolean;
  /** 该断言因主线缺哪类数据才被来查：只用于评测分层，不参与计票 */
  selectionReason: string | null;
}

/** 预筛结论（拒收也要留痕，否则无法复盘"是不是拒错了"） */
export interface TriageInfo {
  passed: boolean;
  reason: string;
}

/** 路由结论 */
export interface RoutingInfo {
  route: RoutingDecision;
  /** 分类档位（L1 存在性 / L2 属性 / L3 统计量……由策略包给出，reject 时为 null） */
  mode: string | null;
  reason: string;
}

/** 一条原子断言（一行一个命题） */
export interface ClaimRecord {
  claimId: string;
  /** 枚举式提问的批次号；外部提交为 null */
  queryId: string | null;
  /** 该断言所属的记录（一场事件）；无记录容器时为 null */
  recordId: string | null;
  fieldRole: FieldRole;
  /** 原始表述（模型/提交者那句话，回溯与人工复核用） */
  rawText: string;
  /** 原子化后的可判定句子 */
  atomicText: string;
  subject: string;
  predicate: string;
  object: string;
  timeScope: ClaimTimeScope;
  channel: ClaimChannel;
  provenance: ClaimProvenance;
  triage: TriageInfo;
  /** 路由阶段之前不存在 */
  routing?: RoutingInfo;
  state: ClaimState;
  /** 记录里该断言对应的字段键（共现门禁按它聚合；外部提交可为 null） */
  fieldKey: string | null;
  createdAt: string;
}

// ============================================
// evidence.jsonl
// ============================================

/** 一行"一个断言 × 一个来源" */
export interface EvidenceRecord {
  evidenceId: string;
  claimId: string;
  url: string;
  domain: string;
  /** 来源家族（跨语言站点 / 主域镜像归并）：同家族多页只算一个独立来源 */
  sourceFamily: string;
  tier: SourceTier;
  /** 逐字引文，必填（全系统唯一可机械核验的部分） */
  quote: string;
  relation: EvidenceRelation;
  /** 引文与断言的直接程度：直接陈述 > 间接推断 */
  contentWeight: number;
  /** 必须是本次自抓：自家派生物一律不得充当证据（证据必须自抓、引文必须逐字） */
  fetchedBy: 'lodestar';
  fetchedAt: string;
  /** 该行自己的正文快照引用（引文逐字命中的比对对象） */
  snapshotRef: string;
  traceId: string;
  /** 该字段所属记录的字段键（共现门禁按 recordId + url 聚合时需要） */
  fieldKey: string | null;
  recordId: string | null;
  /** 抓取失败/判定理由等观测 */
  note?: string;
}

// ============================================
// verdicts.jsonl
// ============================================

/** 检索足迹：not_found 的必备附件，把"我们不知道"变成"我们查了这些、结果是这样" */
export interface SearchFootprint {
  /** 实际执行的查询（含域定向查询） */
  queries: string[];
  /** 候选来源（含未被抓取的） */
  candidates: Array<{ url: string; domain: string; tier: SourceTier }>;
  /** 被抓取并判定的来源 */
  fetched: Array<{ url: string; relation: EvidenceRelation; pageTopic: string | null }>;
  /** 抓取失败及原因 */
  failed: Array<{ url: string; reason: string }>;
  /**
   * 被剔除的候选与拒收的证据（含"引文没在快照里逐字命中"这类）——
   * 拒收也要可审计：读者要能看到我们把什么挡在了计票之外
   */
  rejected: Array<{ url: string; reason: string }>;
  /** 预算使用与触顶观测 */
  budget: { searchCalls: number; pagesFetched: number; searchCap: number; pageCap: number };
  /** 候选是否已覆盖完（未覆盖完就下 not_found 只能记 budget 因） */
  candidatesCovered: boolean;
}

/** 一条断言的终态 */
export interface VerdictRecord {
  claimId: string;
  verdict: Verdict;
  evidenceGrade: EvidenceGrade;
  /** 独立来源数（按来源家族去重后） */
  supportCount: number;
  refuteCount: number;
  notFoundCause?: NotFoundCause;
  footprint: SearchFootprint;
  /** 必填：没有底稿的结论不落库 */
  traceId: string;
  adjudicatedAt: string;
}

// ============================================
// records.jsonl
// ============================================

/**
 * 一条记录（一场事件）的汇总。
 * 容器不自带一套状态机——状态由成员裁决汇总得出。
 */
export interface RecordSummary {
  recordId: string;
  queryId: string | null;
  /** 该记录的全部字段断言号 */
  fieldClaimIds: string[];
  /** 参与门禁判定的关键字段断言号 */
  keyClaimIds: string[];
  gate: RecordGate;
  /** 共现命中的证据行（同一页面命中全部关键字段） */
  cooccurringEvidenceIds: string[];
  /** 门禁理由 / 丢弃原因（拒收也要可审计） */
  reason: string;
  asOf: string;
}

// ============================================
// anchors.jsonl
// ============================================

/**
 * access 层试摊结论（坐标的增强列，允许后置补写；探不出 entryUrl 为 null 但 attempts 留痕）
 *
 * 与证据页职责分离：sourceUrls 是"作证"用的，access 是"再入"用的——
 * 官方站专场页是好入口坏证据的反例不存在，但新闻页是好证据坏入口的常态。
 * 结论的有效性以 fetcher 为前提：同一页面换抓取能力（裸 fetch ↔ 浏览器渲染）结论可翻转。
 */
export interface AnchorAccess {
  /** 摊得出同域详情链接的最高顺位入口；全军覆没为 null */
  entryUrl: string | null;
  /** entryUrl 摊出的详情链接数 */
  detailCount: number;
  probedAt: string;
  /** 探测时的抓取器标识（toy-fetch / browser-strategy…）：读的人要知道结论在什么能力下成立 */
  fetcher: string;
  /** 逐页试摊留痕（淘汰也是诚实输出的一部分） */
  attempts: Array<{ url: string; ok: boolean; linkCount: number; reason?: string }>;
}

/** 给下游的唯一接口（只读；宿主系统侧读它，永不写它） */
export interface AnchorRecord {
  recordId: string;
  /** 坐标形态；缺列 = event（旧坐标不需要重跑就能被新消费端读懂） */
  kind?: AnchorKind;
  /** 产出它的那条枚举式提问原文 */
  query: string;
  /** 字段键 → 字段值（键由策略包给出，引擎不认识具体域名） */
  fields: Record<string, string | null>;
  anchorGrade: AnchorGrade;
  evidenceGrade: EvidenceGrade;
  /** 检索键：关键字段机械拼出的搜索引擎短语（去标点、空格分隔；身份的再入凭证，无网络产物） */
  searchPhrases: string[];
  /** 共现证据页：为关键字段作证、且同页同时命中全部关键字段的页面地址（不是抓取入口，入口由下游按再入凭证解析） */
  sourceUrls: string[];
  /** 策略包给的类目标签（宿主系统按它自动匹配类目） */
  categoryTags: string[];
  /** 检索足迹引用（底稿在文件与 trace 两侧都只存这个指针） */
  footprintRef: string;
  /** 必填：没有底稿的坐标不落库 */
  traceId: string;
  asOf: string;
  /** 唯一的可更新列：失效只标不删 */
  stale: boolean;
  /** access 层试摊结论（增强列，可后置补写；缺列 = 还没探过，读方按 null 处理） */
  access?: AnchorAccess;
}

// ============================================
// answers.jsonl
// ============================================

/**
 * 一次模型调用原始应答的底稿行（漏斗最前端的观测点）。
 *
 * 为什么单独一份底稿：模型候选此前"用完即弃"——整轮空答、解析失败、被弃权
 * 丢弃的行只剩计数没有原文，人工无法从"刚出发"排查回答质量（如模型本来就
 * 答得差）。本文件在解析之前落盘原文，引擎不解析它、不参与任何重算。
 */
export interface AnswerRecord {
  answerId: string;
  /** 归属的提问（与 claims/records 的 queryId 对得上，倒查入口） */
  queryId: string;
  /**
   * enumeration = 换措辞复问的一轮；concretization = 具体化追问；
   * retrieval-search = 检索增强兜底的搜索上下文（兜底触发时一行，存搜索结果全文）
   */
  kind: 'enumeration' | 'concretization' | 'retrieval-search';
  /** 复问轮次（0 基）；concretization 行为 null */
  runIndex: number | null;
  /** 该轮的提问措辞原文（concretization 行为 null——追问提示在 claims 的字段缺口里可推） */
  phrasing: string | null;
  /** 模型返回原文全文，不截断不解析；调用失败为 null */
  rawText: string | null;
  /** 落盘备注（调用失败原因 / 解析失败摘要） */
  note: string | null;
  createdAt: string;
}

// ============================================
// 类别与主键
// ============================================

/** 六份底稿文件对应的数据类别 */
export type LodestarCategory = 'answers' | 'claims' | 'evidence' | 'verdicts' | 'records' | 'anchors';

/** 各类别的主键字段名（get / 状态推进 / 重建比对都按它取最后一条） */
export const CATEGORY_PRIMARY_KEY: Record<LodestarCategory, string> = {
  answers: 'answerId',
  claims: 'claimId',
  evidence: 'evidenceId',
  verdicts: 'claimId',
  records: 'recordId',
  anchors: 'recordId',
};

/** 一行底稿的通用形态（读写层按类别各自有强类型，见上面的 *Record） */
export type LodestarRow = Record<string, unknown>;
