# Changelog

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。1.0 之前版本号按 `0.x` 递增，公开接口可能变动。

## [Unreleased]

### Fixed

- 修复一条假反驳。在线实测中断言「禹贡Ⅲ—盛清御瓷新风尚」被一篇写「禹贡Ⅰ—盛清御瓷新风尚」的报道判成 `refutes` 并落库：引文逐字命中快照、也确实写明了专场名，前两道机械护栏都放行了，但它说的是相邻的另一场。同一系列里编号不同的场次只能证明那一场办过，证明不了被裁那一场不存在。这类错把"我没在这页看到"写成"这是错的"，直接伤害本系统的主张——一条记录被拒收的理由必须可信。
- **`pnpm run demo` 不再删掉在线实验的产物**。默认示例（porcelain）的工作副本就是 `.openlodestar-demo` 根目录，而 live 的输出写在它下面的 `live/<runId>/<mode>/`——重置工作副本时那句递归删除会把两者一起抹掉。2026-11-01 实际发生过：为补一份读数以免费命令跑了一次 demo，两场付费在线重放的 trace 与底稿当场没了，只剩终端里的汇总文本。现在重置只清 demo 自己写出的文件，`live/` 整棵子树保留（`src/demo-workdir.ts`，带回归测试）。
- **检索请求有了自己的超时**。`serper` 提供者原先用裸 `fetch`：连不上时只能等运行时自带的连接超时（实测约 10.7 秒），而"连接建立了对面不回数据"的挂起只有运行时默认的 300 秒兜底——一条坏查询能吃掉五分钟，整条检索链没有任何一处会打断它。现在默认 12 秒（`SERPER_TIMEOUT_MS`）。
- **连接类失败补一次瞬时重试**（`SERPER_RETRIES`，默认 1 次，退避 500ms 起按 2 的幂递增）。此前一次网络抖动就直接让整条断言记为 `failed`：2026-11-01 两场重放各有 8/13 条断言卡在这上面，最终四条记录全被拒收的理由是"关键字段没裁完"，而不是任何业务结论。重试不改变分型——仍失败照旧抛出，上层记基础设施失败，不许伪装成"查无实据"。HTTP 状态码错误**不重试**：Serper 按请求计费，限流时重试只会再吃一次额度。
- **离线硬校验在参数出错时不再"静默通过"**。此前命令行选项拼错会被忽略：`audit --dat .openlodestar-demo` 会去核默认底稿（通常不存在），打印 `Ledger integrity: OK` 并退出 0——一次对着空目录的"通过"很容易被读成"核过了"。现在（`demo` / `verify-quotes` / `audit`）遇到不认识的选项、只写选项没给值、多出的位置参数，或 `--data` 点名的目录不存在 / 不是目录，都会说明原因并以退出码 1 结束（`src/cli-input.ts`，带单元测试）。空底稿仍不算失败；默认底稿不存在仍按空底稿处理。

### Changed

- 站点检查（`scripts/check-site.mjs`）的扫描范围从只读 `docs/index.html` 扩到 `docs/*.html`，并允许**内联或同源 `assets/*.js` 的脚本**——交互页需要脚本，但外链、表单、内联事件、远程 CSS 与 `@import` 照旧禁。为 `file://` 双击打开补了四条禁令：`type="module"`、`import`、`fetch`/XHR 读本地、`localStorage`/`sessionStorage`。体积上限：首页 150 KB，演示页与数据脚本各 300 KB。
- "什么算矛盾"收紧（提示词 `claim-compare` 1.3.0 → 1.4.0）：`refuted_needs_explicit_conflict` 删掉"名称指向另一场"这条例外——它正是上面那次误判的依据——改成要求页面**直接否认这条断言**，并逐条列明三种不算矛盾的情形（页面没提到 / 讲的是另一件东西 / 名称字面写法不同）。
- 瓷器包 `sessionName` 领域细则同步补上这条：同系列相邻场次判 `irrelevant` 并在 `pageTopic` 写清讲的是第几场；判 `refutes` 需页面写明该场没办过、取消延期、或自述"本场定名为 X"而 X 与断言互斥。
- 比对落盘前的机械护栏由两道增至三道：反驳方向的引文必须反驳被裁的那个对象。策略包可选实现 `refutationTargetsClaim`；判不了（`unknown`）或策略包没实现都放行——护栏只挡本域能机械认出的那一种错，不许把"规则覆盖不到"升级成拒收。
- 失败重试提示补一句：页面讲的是另一场时判 `irrelevant`，不许判 `refutes`。

### Notes

- 新护栏只作用于写入侧（一次比对落库前），不改写历史底稿，也不加进事后硬核验——`verify-quotes` 的两项判据（逐字命中本行自己的快照、写到被裁字段）保持不变。
- 离线读数不变：`poly-2021-autumn` 22 条证据 / verbatim 22 / field-clue 20 / 强 1·弱 1·拒收 2 / 可读坐标 1；`porcelain` 20 条证据 / verbatim 20 / field-clue 20 / 强 1·弱 1·拒收 1 / 可读坐标 1。
- 新增三个环境变量：`SERPER_TIMEOUT_MS`、`SERPER_RETRIES`、`SERPER_RETRY_BACKOFF_MS`（`.env.example` 与 README 的环境变量表都已登记）。
- 本次全部离线可验证，未跑任何计费命令。

### Added

- **交互演示页**（`docs/demo.html` + `docs/assets/demo*.js`）：从冻结批次里切换一条记录，现场展示它被拆成哪几个字段、每个字段的引文与出处、判成强/弱/被反驳/查不到、关键字段是否同页共现、最后给不给坐标。页面不需要服务端、不引第三方资源，`file://` 双击与断网都可用。
  - 判定不由页面重算：`pnpm run demo:data`（`src/demo-page/build-demo-data.ts`）在构建时直接调引擎的 `retallyAndRegate`，把门禁、逐字段裁决、共现页与坐标冻结进 `docs/assets/demo-data.js`。
  - 证据按「记录号 + 字段名 + 字段值」匹配；字段值对不上就让该字段与整条记录显示"这批证据没覆盖"，不继承旧证据、也不判成被拒收（`src/demo-page/demo-page.test.ts` 守着这条）。
  - 新增冻结脚本 `src/demo-page/freeze-batch.ts`（`pnpm run demo:freeze`）：把一次 live 运行裁成 `examples/<批次>/`（只留关键字段全部裁决完的记录，快照裁到含引文段落与上下文、每页 ≤ 2000 字符）。
  - 新增五个冻结批次 `examples/demo-batch-1/3/8/11/14/`（2026-11-04 在线采集，`full` 模式）：连同原有 `poly-2021-autumn` 共 9 组可切换记录——强 2、弱 2、被反驳 2、查不到 3。
- **整场时间护栏**（`RunTimeGuards`，`src/lodestar/adjudicate/index.ts` 定义判据、`src/lodestar/engine.ts` 的记录组循环执行）：两道护栏补在"每条断言花多少预算"之外的整场尺度上。
  - **infra 熔断**：连续 `LODESTAR_INFRA_BREAKER` 条（默认 3）断言撞在基础设施空转上（检索层抛错，或抓回的页面全部没读到正文）就在下一条开跑前收手；出过裁决即清零，所以零星失败不会累积成熔断。`0` 关掉。
  - **墙钟截止时刻**：`live --deadline-minutes <n>`（或 `LODESTAR_DEADLINE_MINUTES`）到点收手；`--mode both` 时两个模式共用同一个时刻，从这条命令的起点算。检查点放在**组级检索之前**——那一发查询是计费调用，等到断言层才发现晚了就白花了。
- **`runQuery` / `resumeFromLedger` 新增 `guards` 选项**，返回值新增 `guardStopped`（`'breaker' | 'deadline'`）与 `guardSkippedClaimIds`；整场 trace 的 `payload.guard` 记下阈值、截止时刻与被跳过的断言号。
- 一问一答的两类调用（逐页比对、查询翻译）改用更短的超时与重试：`LODESTAR_QUICK_CALL_TIMEOUT_MS`（默认 60000）/ `LODESTAR_QUICK_CALL_RETRIES`（默认 1）。角色默认的 180 秒 ×（1+3）次尝试是给长输出留的最坏值，一次卡死就是约 12 分钟。

### Changed

- 被护栏跳过的断言一律记 `paused`，**不记** `not_found`、也不记 `failed`：它们根本没被跑过。护栏只改"这场跑不跑完"，不改任何一条断言的结论，四分类与记录门禁都不动。
- `live` 的终端汇总新增 `timeGuard=` 读数，报告备注在收手时写明原因与跳过的断言号；一场因护栏提前结束的运行仍按成功返回退出码 0。

### Notes

- 新增四个环境变量：`LODESTAR_QUICK_CALL_TIMEOUT_MS`、`LODESTAR_QUICK_CALL_RETRIES`、`LODESTAR_INFRA_BREAKER`、`LODESTAR_DEADLINE_MINUTES`。
- 护栏的八条引擎层测试与四条调用层测试都是离线 mock，未跑任何计费命令。

### Added

- **`live --claim <id>[,<id>...]` 只重放点名的断言**。此前一条可疑结论要重验，就得把整场（全部断言 × 检索 × 抓页）再烧一遍。逗号、分号、空白都算分隔符、重复的号只留一次；`--mode replay` 收窄裁决范围，`--mode pages` 按 `claimId` 只重抓对应的证据行，`--mode both` 时只作用于 `replay` 那一半（`full` 的断言是运行时现问出来的，拒绝该参数）。点了底稿里没有的号直接报错——静默跑出一场"0 条断言"会被读成"这条查不出结论"。
- **每页抓取耗时读数**（`PageFetchLog`，`src/lodestar/adjudicate/index.ts`）：记录每一次抓取尝试走的路（直连 / 浏览器渲染 / 同记录组内复用 / 没抓到）、花了多久、失败理由。`runQuery` 与 `resumeFromLedger` 的返回值新增 `pageFetches`，trace 的 `payload` 同带。
- **报告的"这一场的时间花在哪"一节**（仅在线运行）：按通路分行报次数、中位耗时、最长与合计，再列最慢的几页；终端 `Summary` 同一行给出浓缩读数。抓取是串行的（并发为 1），所以合计就是这场真正占掉的时间；组内复用不计入耗时合计，"没抓到"的白等时间单列。
- **逐条失败理由汇总成 `run-error.json`**（`kind: "claim-failures"`）：断言号、记录号、字段键、断言原话与失败理由。此前这些理由只存在于内存和单条 trace 里，跑完就翻不回来了——2026-11-01 那两场重放要靠终端残留的汇总文本反推。整场崩溃的文件同用这个路径，靠 `kind: "run-crash"` 区分；两份都不写密钥。

### Changed

- `AdjudicateClaimResult.pageFetches` 是**必填**字段（不是可选）：新增返回路径时漏记抓取尝试会在编译期失败，而不是让报告少几行。四个 return 站点（裁决 / 暂停 / 失败 / 护栏）都带上自己的读数，检索层抛错这种"一页没抓"的情况返回空数组。
- 运行目录下的崩溃报告新增 `kind` 字段（`run-crash` / `claim-failures`），并记下当时的 `command`——一份没有上下文的堆栈很难复现。

### Fixed

- 在线报告的备注（含上一节的护栏收手说明）此前只在"与离线底稿的对照"表存在时才渲染，`--mode full` 没有对照表就整段丢掉。现在备注随时间一节一起输出。

### Notes

- 耗时读数**不进底稿**：`verdicts.jsonl` 的格式、`audit` 与 `verify-quotes` 的判据都没变，冻结底稿仍能按原样重放。诊断只走内存、trace 与报告三条路。
- 本次全部离线可验证（460 项测试 / 38 个文件、`tsc --noEmit` 干净、两个 demo 与 `audit` 复现原读数、`live --dry-run` 零请求），未跑任何计费命令。

## [0.1.0] - 2026-10-30

首个公开版本：把"模型说的每一条都当候选、逐条拿公开网页取证"做成一条能独立运行的链路。

### Added

- 完整链路：断言 → 检索 → 抓页 → 逐页比对 → 计票 → 记录级门禁 → 坐标导出。
- JSONL 底稿（claims / evidence / verdicts / records / anchors / answers）：只追加，逐字引文与快照引用是落盘前提。
- 三种 `not_found` 归因：预算耗尽、覆盖不足、确证不存在。
- 记录门禁与强/弱/拒收三档；默认只把强坐标交给下游。
- 两个完全离线的示例：`porcelain` 合成契约底稿；`poly-2021-autumn` 真实公开报道案例（节选快照，带抓取档案与第三方声明）。
- CLI：`demo`、`demo:real`、`verify-quotes`、`audit`、`live`（在线实验，含 `--dry-run` 预算估算）。
- 搜索提供者注册表：默认 `llm-web`，可选 `serper`；能力不足的 `site:` 查询会跳过并记入检索足迹。
- 浏览器渲染插件包 `@openlodestar/browser-playwright`：按领域包声明决定是否必备。
- 多语言检索：一个意图生成源语言与翻译两条查询轨。

### Security

- 出站抓取 SSRF 防线：协议与凭据校验、私网与保留地址拒绝、逐跳重定向核对、连接固定到已校验 IP、响应体积上限。
- 提示注入四层防线：规则与页面数据分成两条消息、每次随机的数据边界、隐藏元素与属性清洗、输出长度与控制字符硬边界。
- 真实模型红队 8 个场景：0 次关系翻转、0 次 `system` 泄漏、0 条非逐字引文被接受（单模型小样本，结论有边界）。

### Notes

- 测试与两个 demo 完全离线；`live` 子命令需要模型与搜索凭据，结果不可复现，仅用于实验与诊断。
- 在线链路在 0.1.0 冻结：默认预算下可能拿不到可读坐标，这是已知限制，不是离线案例失效。
