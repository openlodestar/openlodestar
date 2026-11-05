<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/openlodestar-lockup-cream-800x200.png">
  <img alt="OpenLodestar" src="assets/openlodestar-lockup-navy-800x200.png" width="400">
</picture>

# OpenLodestar

[![CI](https://github.com/openlodestar/openlodestar/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/openlodestar/openlodestar/actions/workflows/ci.yml)

> 让大模型说的事实变得可核查：它说的每一条都只当候选，逐条拿去公开网页取证，核完才算数——最后留下来的是能重跑、能追到出处的记录。

**English** — OpenLodestar is a verification layer for LLM claims. Every statement is treated as a candidate, checked against public web evidence, and kept only if it survives; each kept verdict carries a re-runnable evidence chain with verbatim quotes, and "not found" is a first-class outcome. Status: early 0.1 — the offline demos and test suite are reproducible, while live search is experimental and not reproducible.

项目主页：<https://openlodestar.github.io/openlodestar/>

## 它产出什么

大模型能一口气说出一堆"它记得"的事，但一条都不带出处：说对了是碰巧，说错了你也看不出来。OpenLodestar 补的正是这个缺口——它产出的不是又一段读着很像样的文字，而是**核过的记录**：

- **每条留下的结论都挂着一条能重跑的证据链**。引用与出处逐字可回查（字与标点要一致；空白与不可见格式字符不计）：`pnpm run verify-quotes --data <底稿目录>` 会对每一条当场复核"这句引文是否真的出现在它自己的那份页面快照里"，出错时能定位到是哪一步错的，不必在"相信"和"不信"之间二选一。
- **"查不到"也是一个正式结论**。查无实据会写清属于哪一种——没查完、没有可用来源、还是确实不存在，不含糊过关。
- **核过的记录，目标是能接着当线索用**。比如"某年某机构办过某场拍卖会"被证实存在之后，理想情况下这条记录本身就指向了下一步该去看哪些页面，不必再从搜索结果里一页页碰运气。（这是设计目标，还没做过对照验证。）

## 它怎么做到的

上面这些结论之所以可信，靠的是三条一直在守的规矩：

- **生成的东西只当候选，永不当结论**。可以让模型先列一批它"记得"的东西，但列出来的必须逐条过了证据才作数；"先生成"不放松后面的核对。
- **证据池不许自证**。核对用的证据只来自外部公开来源，不用自己采集的语料去验证自己产出的东西。
- **能重跑比能跑通重要**。每条结论都留下完整的检索与判定过程，错了要能定位到是哪一步错的。

落到代码上是一条流水线：

```
一条断言（一个命题、一个字段）
   │  路由：verify / decompose / reject
   ▼
检索 ── 双语双轨：源轨 + 整条翻译出的反向轨 ──┐
   │  抓取，并把模型实际会读到的那份正文存成快照   │
   ▼                                             │
逐源比对（一条断言 × 一个页面 = 一次调用）──────────┘
   │  引文必须逐字命中快照（空白不计）、必须写到被裁的那个字段；反驳还得反驳被裁的那个对象
   ▼
按独立来源家族计票 → supported / refuted / conflicting / not_found
   │
   ▼
记录级共现门禁：关键字段是否在同一个页面上同时出现？ → strong / weak / rejected
   │
   ▼
导出坐标（strong 或 weak），并附上用来越后再找到它的检索短语
```

## 它从哪里来

Lodestar 不是为演示专门造的引擎。它在一款**古玩垂域的 RAG 产品**里长出来：店主丢来一张货的照片和一句话，系统要当场给出这类东西的行情框架和一张参考单，还要说清每条判断是从哪条记录、哪个页面来的。逐字引文、来源家族计票、共现门禁、三种拒收，这些判据和底稿格式都是在那条真实链路上磨出来的——不是为了跑通一个 demo 才设计。

本仓库把引擎与策略包抽出来、让它能独立运行，**不包含**那款产品的业务代码、语料库、店主录入端和内部运维工具。那款产品目前只公开了演示版，生产版尚未对外开放；等它准备好面对公众时，这里会补上名称与链接。

抽离的边界大致是：

| 类别 | 内容 |
| --- | --- |
| 原样保留的判据与格式 | 逐字引文硬校验、来源家族归并、E0–E3 证据等级、strong / weak / rejected 门禁、JSONL 底稿与坐标导出 |
| 为独立运行重写的 | 搜索提供者注册表（默认 `llm-web`、可选 `serper`）、浏览器插件包、CLI 与离线 demo |
| 留在宿主、没有带出的 | 业务库与语料、店主录入端、生产部署与内部复盘工具 |

搜索与浏览器渲染都做成了可替换的接口，原因也在这里：抽出来的是引擎，不是那款产品。下文提到「宿主系统」，指的就是它。

## 快速开始

需要 Node.js ≥ 20 和 pnpm（版本已在 `package.json` 里锁定）。

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm run demo        # 合成的契约底稿
pnpm run demo:real   # 真实案例，并生成 HTML 报告
```

这是一个轻量工作区：根目录是核心包，`plugins/browser-playwright/` 是独立的插件包（有自己的 `package.json`，playwright 只写在它那里）。`pnpm install` 会把插件包一并装好；要真渲染网页，再下一次浏览器内核：

```bash
pnpm run browser:install   # 等价于在插件包目录里跑 playwright install chromium
```

`pnpm run demo` **完全离线**——不需要 API key，也不发任何网络请求。它把仓库里自带的示例底稿（`examples/porcelain/`）复制到工作目录，重算裁决、过记录门禁、导出坐标，然后逐条把引文与自己的快照对照一遍：

```
Ledger: 11 claims, 20 evidence rows, 11 snapshots

Verdicts (recomputed from evidence):
  cl-example-2016-poly-november               conflicting E1  support=1 refute=1
  cl-rec-example-2014-cguardian-auctionHouse  supported   E3  support=2 refute=0
  cl-rec-example-2019-sothebys-sessionName    refuted     E1  support=0 refute=1
  ...

Records (co-occurrence gate):
  rec-example-2014-cguardian  strong    关键字段全部 supported、共现命中 2 个页面、最低证据等级 E3
  rec-example-2016-poly       weak      关键字段各自成立，但没有任何页面同时命中全部关键字段
  rec-example-2019-sothebys   rejected  关键字段判为 refuted，整条记录不入坐标库

Anchors:
  rec-example-2014-cguardian  strong E3  sourceUrls=2  fields=4
  rec-example-2016-poly       weak   E3  sourceUrls=6  fields=3
  Readable anchors (strong and not stale): 1/2

Quote hard guard:
Evidence rows: 20 | verbatim 20 | field-clue 20 | violations 0
```

`pnpm run demo:real` 跑的是另一份人工建好的真实案例 `examples/poly-2021-autumn/`：四篇公开报道（雅昌艺术网、The Value、澎湃号转载、中新网）讲北京保利 2021 年秋拍，四条候选记录进去，出来是四个不同的结局——「禹贡Ⅰ」拿到强坐标；「禹贡Ⅱ」只到弱档，因为提到它的那篇只是雅昌原稿的澎湃号转载，归并后仍只有一个独立来源；另外两条是刻意放进去的负样本：把日期说成 11 月 15 日的那条被两家来源当场反驳、整条拒收，在四篇里查不到出处的「禹贡Ⅲ」判为 `not_found`（成因是这批候选没覆盖到），同样拒收。加上 `--report` 会把这次结果连同每条引文、来源档位和拒收理由渲染成一份自包含的 HTML 报告（默认 `.openlodestar-demo/poly-2021-autumn/demo-report.html`），断网也能打开：

```bash
pnpm run demo:real
# 等价于：
pnpm exec tsx src/cli.ts demo --example poly-2021-autumn --report .openlodestar-demo/poly-2021-autumn/demo-report.html
```

为什么要这样组织演示、以及一条结论旁边应该摆哪些东西，见 [docs/demo-design-guide.md](docs/demo-design-guide.md)；案例本身的来源、快照与预期结局见 [examples/poly-2021-autumn/README.md](examples/poly-2021-autumn/README.md)。

### 交互演示：在浏览器里换一条记录

`docs/demo.html` 是给站点用的交互版：从冻结批次里挑一条记录，看它被拆成哪几个字段、每个字段的引文与出处、判成强或弱或被反驳或查不到、关键字段有没有在同一页上同时出现，以及最后给不给坐标。

它不需要服务端，也不引任何第三方资源，双击本地文件、断网都能打开。页面只做切换，**判定是构建时由引擎算好并冻结的**——`docs/assets/demo-data.js` 由 `pnpm run demo:data` 从 `examples/` 生成，页面不重算计票、门禁与坐标。改完底稿要重新生成一遍，再跑 `node scripts/check-site.mjs` 校验站点红线（同源脚本、离线可用、体积上限）。

演示数据里的证据按「记录号 + 字段名 + 字段值」匹配：字段值一旦与构建时不一致，页面只显示"这批证据没覆盖"，不会继承旧证据，也不会把值对不上的记录判成被拒收。这条规则有测试守着。

新增一批演示素材时，先用 `pnpm run demo:freeze` 把一次 live 运行裁成 `examples/<批次>/`（只保留关键字段全部裁决完的记录，快照只留含引文的段落与上下文、每页不超过 2000 字符），再跑 `pnpm run demo:data` 重新生成数据文件。

### 小游戏版演示：换掉一个词，看证据认不认

`docs/demo-lab.html` 把同一句话拆成四个槽位——拍卖机构、举办时间、专场主名、专场副题——让人自己动手改：

> [北京保利] 在 [2021年12月5日] 举办了一场名为「[禹贡Ⅰ]—[盛清御瓷新风尚]」的拍卖会。

点一个词，它上方就弹出可换的词，每个词右边带着这个小标——`对`、`弱`、`不对`、`查过没找到`、`没覆盖`，都是这份冻结矩阵里算出来的。点一个新词，句子换掉，结论与引文立刻更新，没有单独的「识别」按钮要按。撞进「没覆盖」时，卡片会直接给出改一两个词就能落到有结论组合的去处，点一下就到。

句子里每个词都能用键盘聚焦（对外是按钮语义）：Tab 聚焦、回车或空格打开、方向键挑词、回车选中、Esc 收起并回到原词。网页也是触屏直接点。拖动与词库这两种第二操作路径已经去掉。

和上面那页一样，这页也不联网、不引第三方资源、双击就能开，判定是构建时由引擎算好冻结的：`pnpm run demo:game`（`src/demo-page/build-demo-game.ts`）把 2 × 4 × 3 × 3 = 72 种组合逐条去冻结记录里找四个值全部相等的同款，命中就冻结门禁、逐字段裁决、共现与坐标，输出 `docs/assets/demo-game-data.js`。先跑 `pnpm run demo:data` 再跑它。72 种组合里只有 4 种有记录可查（对、弱、不对、查过没找到各一条），其余 68 种是把不同记录拼出来的组合，页面照实说「这批证据没覆盖」，不搬运旧证据、也不判成被拒收——这条界线有测试逐组合守着。

玩法、组合矩阵与覆盖读数见 [docs/demo-lab.md](docs/demo-lab.md)。同一份文档里还写了一个**只在本机跑、不部署**的实时实验服务（`pnpm run demo:lab-server`，`127.0.0.1:3014`，默认拒绝运行，加 `--allow-spend` 才真的花钱查）。

### 在线实验：把同一批断言放进真实链路

`live` 子命令跑的是**在线**链路：查询翻译、搜索、抓页、逐页比对都调用真实服务，结论落在独立目录，不覆盖冻结示例。它用来回答"把这份离线底稿放回今天的互联网，还能得出同样的结论吗"，而不是一份可重复的演示。

```bash
cp .env.example .env   # 填 LLM_API_KEY；搜索用 llm-web（默认）或 serper
pnpm exec tsx --env-file=.env src/cli.ts live --mode replay --provider serper \
  --run-id exp-001 --max-search-calls 3 --max-pages 4 --results 8 --deadline-minutes 30

# 只重放点名的几条断言：定位一条可疑结论时不必再烧一整场
# （断言号取自 examples/<案例>/claims.jsonl 的 claimId）
pnpm exec tsx --env-file=.env src/cli.ts live --mode replay \
  --claim cl-rec-poly-2021-yugong-1-auctionHouse,cl-rec-poly-2021-yugong-1-dateText
```

`--mode` 有四档：

| 模式 | 做什么 | 需要的凭据 |
| --- | --- | --- |
| `replay` | 读取 `examples/poly-2021-autumn/claims.jsonl` 的冻结断言，跳过提问环，只重跑检索、抓取与裁决 | 模型 + 搜索 |
| `full` | 从 `case.json` 的原始问题重新提问，走完整链路（含三轮稳定性复问与具体化追问） | 模型 + 搜索 |
| `both` | 先 `replay` 再 `full`，各占一个子目录 | 模型 + 搜索 |
| `pages` | 只重抓离线底稿里的四个 URL，逐条回查引文是否还在；底稿是节选时不比对整页全文 | 只要浏览器插件 |

输出在 `.openlodestar-demo/live/<runId>/<mode>/`：底稿、trace 和一份 `demo-report.html`。这个 `live/` 子目录**不会被 `pnpm run demo` 清掉**——默认示例的工作目录就是 `.openlodestar-demo` 根，而在线那一份是花真钱换来且不可复现的材料，重置只清 demo 自己写的那些文件。报告会标明这是 live run，并把结果与离线预期逐条对照（记录档位、坐标、引文核查）。先看计划再花钱可以用 `--dry-run`：它只打印案例、查询、提供者、预算上限、密钥是否就位与浏览器探针，不发任何请求。

花钱的实验要能**止损**。`--max-search-calls` / `--max-pages` 管的是单条断言花多少，整场加起来仍然没有上界：2026-11-01 那两场重放里约一半时间是空转——搜索接口不回话、页面抓到超时，后面的断言只能陪着等。两道护栏补在整场尺度上：

- `--deadline-minutes <n>`（或 `LODESTAR_DEADLINE_MINUTES`）给一个墙钟截止时刻，到点就在**下一条断言开跑之前**收手；`--mode both` 时两个模式共用同一个时刻，从这条命令的起点算。
- 连续 `LODESTAR_INFRA_BREAKER` 条（默认 3）断言撞在 infra 空转上就熔断；`0` 关掉。判据是"检索层抛错"或"这条断言抓回的页面全部没读到正文"，出过裁决就清零，所以零星失败不会累积成熔断。

被护栏跳过的断言记成 `paused`，**不是** `not_found`、也不是 `failed`：它们根本没被跑过。报告的备注、终端的 `timeGuard=` 读数和 trace 里的 `guard` 段都会写明这一点，所以看到"坐标比预期少"先分辨是护栏收手还是确实查不到。这一场不因为收手而判失败（退出码仍是 0），要接着跑就拿同一个底稿目录再驱动一次。

`--claim <id>[,<id>...]` 把 `replay` 与 `pages` 收窄到点名的几条断言：一条可疑断言可以单独重放，不必为它再烧一整场。逗号、分号、空白都是分隔符，重复的号只留一次；点了底稿里没有的号会直接报错，不会静默跑出一场"0 条断言"——那种输出很容易被读成"这条查不出结论"。`--mode full` 的断言是运行时现问出来的，不接受这个参数；`--mode both` 时它只作用于 `replay` 那一半。

一场跑完还要能**看懂时间花在哪**。报告新增"这一场的时间花在哪"一节，把每次抓取按通路分行（直连抓取 / 浏览器渲染 / 同记录组内复用 / 没抓到）报出次数、中位耗时、最长与合计，末尾列出最慢的几页；终端汇总也有同一份读数。抓取是串行跑的，所以这些耗时加起来就是这场真正占掉的时间。组内复用不花钱也不占时间，不计进合计；"没抓到"的那几秒是白等掉的，单列一行——它没产出证据，但确实是花掉的钱和时间。

单条断言的失败理由原先只活在内存和 trace 里，跑完就没了。现在只要有一条断言以基础设施失败收场，运行目录下会多一份 `run-error.json`（`kind: "claim-failures"`：断言号、记录号、字段、原话与理由），可以直接贴进 issue；整场崩溃时写在同一路径的是 `kind: "run-crash"`。两份都不含密钥。耗时读数不进底稿——`verdicts.jsonl` 的格式与 `audit` / `verify-quotes` 的判据都没变。

在线结论**不可复现**：搜索排名、页面可达性、反爬与渲染结果随时会变，同一条命令两次跑可能拿到不同页面。因此 live 结果只用于实验与诊断，不是发布物；可发布的是上面 `demo:real` 那份冻结底稿。

2026-10-29 用真实钥匙跑过一次完整实测：硬护栏（逐字引文、底稿审计）全部通过，但默认预算下没有产出可读坐标——6 条 not_found 全部是检索与页预算耗尽，不是"确证不存在"。在线链路在发布前冻结，发布后再逐项改进；期间别把 live 的 0 坐标当成离线案例失效。

另有两道可以对着任意底稿目录跑的硬校验，发现违规就以退出码 1 结束：

```bash
pnpm exec tsx src/cli.ts verify-quotes --data .openlodestar-demo   # 逐字命中 + 引文写到所裁字段
pnpm exec tsx src/cli.ts audit         --data .openlodestar-demo   # 主键引用 / 快照 / 强坐标共现页
```

空底稿不算失败——它只是没有东西可报。但参数这一层是"失败关闭"的：选项拼错（例如把 `--data` 写成 `--dat`）、只写选项没给值、多出一个位置参数，或 `--data` 点名的目录不存在 / 不是目录，都会打印原因并以退出码 1 结束——这些情况都是"没核到你点名的东西"，不能读成"核过了"。默认底稿不存在仍按空底稿处理。

## 仓库里有什么

```
src/
  cli.ts                    四个命令：demo / live / verify-quotes / audit
  live.ts                   在线实验入口：replay / full / both / pages 四种模式
  demo-report.ts            把一次 demo 的结果渲染成自包含的 HTML 报告
  lodestar/
    engine.ts               编排：提问 → 裁决 → 门禁 → 坐标
    intake/                 提问环（允许弃权 → 稳定性复问 → 具体化追问）与答案解析
    adjudicate/             路由、双语检索、抓取与快照、逐源比对、计票
    record-gate/            记录级共现门禁与坐标导出
    storage/                文件底稿适配器（唯一的写入路径）
    packs/                  领域策略包接口 + porcelain（中国古玩拍卖，含域名清单与无效页判据）
    anchor-source.ts        给下游的只读入口
  prompts/                  提示词模板（YAML，每条规则都带 enabled）
  integrations/             搜索提供者（注册表 + 内置 llm-web/serper）、浏览器插件注册表与约定加载、抓取策略、HTML 清洗
  llm/                      OpenAI 兼容调用与重试
  demo-page/                交互演示的数据构建与冻结脚本（docs/demo.html 与 docs/demo-lab.html 的数据由它们生成）
plugins/browser-playwright/ playwright 渲染插件（独立包；自带 package.json 与 playwright 依赖）
examples/porcelain/         最小离线底稿（合成数据，契约测试用）
examples/poly-2021-autumn/  真实案例底稿（公开报道的正文节选 + 抓取档案 + 四条候选记录 + case.json）
examples/demo-batch-*/      在线采集补出来的冻结批次（页面节选 + 来源声明，供交互演示切换）
docs/demo.html              交互演示页：切换记录、看字段引文与判定（断网可开）
docs/demo-lab.html          小游戏版演示页：改句子的四个槽位，看证据认不认（断网可开）
docs/demo-lab.md            小游戏玩法、组合矩阵与覆盖读数；本地实时实验服务的边界
scripts/demo-live-server.mjs 只在本机跑的实时实验服务（不部署，默认拒绝运行）
docs/demo-design-guide.md   演示方法论：一条演示该证明什么、怎么挑素材、怎么摆证据
.env.example                在线链路的环境变量模板（复制为 .env；离线命令不需要）
.github/                    CI 与 issue 模板
CONTRIBUTING.md             参与方式、硬规矩与 PR 检查单
SECURITY.md                 漏洞报告渠道与范围
CODE_OF_CONDUCT.md          协作行为准则
CHANGELOG.md                版本变更
```

参与贡献见 [CONTRIBUTING.md](CONTRIBUTING.md)；安全漏洞按 [SECURITY.md](SECURITY.md) 私密报告，不要开公开 issue；版本变更见 [CHANGELOG.md](CHANGELOG.md)。

## 底稿与不变量

底稿是六份 JSONL 加一堆页面快照。只追加不改写：同一主键的状态变化是新加一行，历史永远在。

| 文件 | 一行代表 | 主键 |
| --- | --- | --- |
| `claims.jsonl` | 一条原子断言（一个命题、一个字段） | `claimId` |
| `evidence.jsonl` | 一条断言 × 一个来源，带逐字引文与快照引用 | `evidenceId` |
| `verdicts.jsonl` | 一条断言的裁决 | `claimId` |
| `records.jsonl` | 一条记录的门禁结果 | `recordId` |
| `anchors.jsonl` | 一条导出的坐标 | `recordId` |
| `answers.jsonl` | 模型原始应答（解析之前先落盘） | `queryId` |

以下几个不变量由代码和测试钉住，不靠自觉：

1. **证据必须由本条管线自抓**：`fetchedBy` 必须是 `lodestar`，宿主系统的派生物不算证据。
2. **引文必须逐字命中**自己的快照，并且必须写到被裁的那个字段；两条任一不满足就拒收。
3. **没有底稿的结论不落库**：裁决与坐标缺 `traceId` 一律拒绝写入。
4. **底稿永远是文件**：没有第二种存储后端，传了非空的索引目标就直接报错。
5. **引擎不回写宿主系统**：只追加自己的底稿与 `anchors.jsonl`。
6. **弱坐标只留档不外发**：下游默认只读 `strong` 且未标记过期（`stale`）的坐标。
7. **判级只在离线跑**：引擎不会被任何线上请求路径 import。

"逐字"的边界：字与标点必须一致；空白与不可见格式字符（零宽空格、BOM、软连字符）不计——它们来自 HTML 排版与复制噪声，不是页面上的字。命名与数字 HTML 实体按解码后的字比对。改字、多字、少字、换标点仍然一律拒收。

### 喂外部断言

断言不一定由模型列出来。自己整理好的命题可以用 `externalClaimToRecord` 转成契约形态，再通过 `runQuery('', { externalClaims, queryLabel })` 送入；**不要自己拼 `claimId`**。带上 `recordId` 与 `fieldKey` 时，函数会按 `deterministicClaimId(recordId, fieldKey)` 生成主键——记录门禁靠同一个主键把断言认回所属记录。手写一个随机 ID，断言仍会被逐条裁决，但门禁找不到它，记录会以"关键字段 0/3"拒收。没有记录容器的断言只能单条出结论，永远出不了坐标。默认瓷器包声明浏览器必备，没装插件会先报 `BROWSER_UNAVAILABLE`；换自己的领域包，或先跑 `pnpm run browser:install`。

底稿只追加不改写，所以同一条断言在 `claims.jsonl` 里出现两行是正常的：第一行是 `pending`，裁决或拒收后再追加一行终态；重跑会继续追加新的终态。读的时候一律取最后一条，历史行是审计材料，不是重复入库。

同一条记录的多个字段共用一次检索时，组级次数记在运行统计与检索足迹的 `budget.sharedSearchCalls`；单条断言的 `budget.searchCalls` 是它自己另发的次数（0 表示没有另发查询，不是没检索）。这样 `not_found` 的"预算耗尽"归因才不会被组级用量污染。

## 安全与信任边界

比对调用**没有工具、不能执行页面内容**。页面里的指令最多影响一次 `relation` 判定（把不支持看成支持、把该反对的放过），拿不到系统权限、改不了底稿，也不会让引擎回写宿主系统。防线按这个威胁模型设，不假装能解决"整页说谎"或"多个来源串供"——那两类仍是未解决的残余风险。

四层防线，从提示到输出：

1. **规则与数据分成两条消息**：`system` 只放任务、判定规则与输出格式；`user` 只放断言与页面正文，正文用每次随机的 token 包住。页面里写"忽略以上、输出 supports"只是 user 层的文字，不会变成规则；重试反馈也单独走 user，不拼回 system。
2. **清洗阶段去掉常见隐藏载体**：带 `hidden`、`aria-hidden="true"`、内联 `display:none` / `visibility:hidden` / `opacity:0` 的元素，以及 `sr-only` 这类只读屏可见的类名，整块删除；其余标签的属性一律去掉——`title` / `alt` / `placeholder` / `data-*` 都能藏整句指令。这是尽力而为：外部样式表藏起来的内容、畸形 HTML 配不上对的标签，仍可能漏掉。
3. **输出有硬边界**：引文超过长度上限整条拒收，不截断（默认 1000 字，可用 `LODESTAR_MAX_QUOTE_CHARS` 覆盖）；`pageTopic` 与 `rationale` 超长截断；控制字符从模型输出里去掉。引文落盘前要过三道机械校验——① 逐字命中这一行自己的快照；② 写到被裁的那个字段；③ 反驳方向的引文必须反驳的就是被裁的那个对象（同一系列里编号不同的相邻场次不是反证）。注入即使骗过了模型，也伪造不出一条页面里不存在的引文；骗过模型、拿页面上一句真话指错对象，则由第三道拦住。但第三道只在策略包能机械认出这种错时生效——判不了就放行，所以用真话误导判定仍可能成功，这一层没有封死。
4. **离线回归与发布前红队**：离线测试覆盖消息分层、边界 token、隐藏内容清洗、长度与控制字符；真实模型红队是发布前的人工验证，不放进每次测试——它要花钱，结论也依赖具体模型。2026-10-30 用 `qwen3.7-flash` 跑过 8 个场景（直接指令覆盖、伪造数据边界、隐藏元素、套取 system、无字段线索引文、英文角色扮演与超长引文诱导、时间冲突翻支持、地点冲突翻支持）：0 次关系翻转、0 次 system 泄漏、0 条非逐字引文被接受。样本小，只说明这组提示词在该模型上守住了，不是对所有模型、所有话术的保证。

**出站抓取（SSRF）**另有一条独立防线：只允许 `http/https`、拒绝带凭据的 URL 与 `localhost`；字面量地址与域名解析结果都按私网/回环/链路本地/保留段整段拒绝（含云元数据地址与 IPv4 映射的 IPv6）；重定向自己跟、每一跳重新校验，最多 5 跳；连接固定到校验过的 IP，压缩校验收到的公网结果，避免"校验时公网、连接时私网"的 DNS 重绑定；响应上限 8 MB。浏览器渲染无法固定 IP，只能在渲染前再核对一次解析结果，理论上仍有重绑定窗口——插件是渲染工具，不是安全边界。

## 读坐标

```ts
import { readableAnchors } from './src/lodestar/anchor-source';

for (const anchor of readableAnchors()) {
  anchor.recordId;      // 稳定主键
  anchor.fields;        // 过了核验的字段
  anchor.searchPhrases; // 以后重新找到它的检索短语
  anchor.sourceUrls;    // 证据共现的那几个页面（是证明，不是抓取入口）
}
```

`readAnchorFile()` 还会返回 `fileExists` 与 `malformedLines`，调用方可以区分"还没有坐标"和"文件坏了"。

## 换一个领域

引擎里不含任何领域知识。字段清单、列名映射、时间范围、等价写法、页面预筛、判定细则、来源档位与来源家族，全部由 `DomainPack` 接口给出；`src/lodestar/packs/porcelain` 是一个完整的示例（中国古玩拍卖）。换领域是实现同一个接口，不是改引擎。

连"这个领域要不要浏览器渲染"也是包声明的（`requirements.browser`），见下一节里的分工。

## 搜索提供者

检索层只认「一批查询进、一批结果出」。内置两个：

- `llm-web`（默认）：让模型自带的联网搜索去找页面，有 `LLM_API_KEY` 就能跑通在线链路，不需要再注册搜索服务；它不支持 `site:` 语法，域定向查询会被跳过并记进检索足迹的 `skippedQueries`，**不降级成普通关键词**。
- `serper`：独立搜索 API，支持 `site:`，需要另注册并配 `SERPER_API_KEY`。

第三方提供者不必改引擎，注册即可：

```ts
import { registerSearchProvider, type SearchProvider } from './src/integrations/search-providers';

class MyProvider implements SearchProvider {
  readonly name = 'my-provider';
  readonly capabilities = { siteOperator: true }; // 不支持就别声明，检索层会跳过这类查询
  async search(queries: string[], options?: { numResults?: number; language?: string }) {
    return { results: [] };
  }
}

registerSearchProvider('my-provider', () => new MyProvider());
process.env.SEARCH_PROVIDER = 'my-provider';
```

契约（`src/integrations/search-providers/contract.ts`，初版）规定了最小接口承诺：名字是 slug、能力位类型正确、空查询集短路、结果项形状。还有一条是错误语义：**返回内容解析不出来时必须抛错，不能返回空数组**——否则一次模型抽风会被记成"世界没有证据"。

## 浏览器插件

证据页抓取按策略包声明分两种：声明浏览器必备的包（瓷器包就是）**直接渲染**，不再先试裸抓；其余包仍是裸 fetch 优先、失败才降级。原因是这类官网常以 HTTP 200 返回一个只有导航和脚本的空壳，裸抓既不报错也拿不到正文——"先试后降级"永远等不到降级。是否强制由调用方按包声明传入（`captureEvidencePage(..., { forceBrowser })`），引擎不替领域做判断。

浏览器渲染的实现放在**独立工作区包** `plugins/browser-playwright/`：它有自己的 `package.json`，playwright 依赖只写在那里面，核心包的 `dependencies` 仍然只有 `js-yaml`。根部的 `pnpm-workspace.yaml` 把两者串成一个工作区，`pnpm install` 会装好插件包；浏览器内核用 `pnpm run browser:install` 单独下载。

引擎解析插件分两步：先查注册表，没有再按**包名约定**加载 `@openlodestar/browser-<名字>`，读出它导出的 `createRenderer()` 后自动注册。所以插件包装好之后，`BROWSER_PLUGIN=playwright` 直接可用；换第三方实现时也可以显式注册：

```ts
import { registerBrowserPlugin, type BrowserRenderer } from './src/integrations/browser-plugins';

class MyRenderer implements BrowserRenderer {
  readonly name = 'my-renderer';
  async render(url: string) { return '<html>…</html>'; }
  async probe() { /* 可选：不可用时抛带 code=BROWSER_UNAVAILABLE 的错误 */ }
}

registerBrowserPlugin('my-renderer', () => new MyRenderer());
process.env.BROWSER_PLUGIN = 'my-renderer';
```

分工分三层，各管各的：

- **策略包声明这个领域要不要浏览器**：古玩拍卖的官方站点普遍是 JS 外壳 + 反爬（直接抓只拿得到空壳），所以瓷器包写的是 `requirements: { browser: 'required' }`；只读新闻、公告这类静态站领域不声明或声明 `optional`，完全不碰浏览器。
- **插件包提供用什么渲染**：`@openlodestar/browser-playwright` 惰性 `require('playwright')`，只有真正要渲染时才加载；模块缺失或浏览器启动失败都抛 `BrowserUnavailableError`，与普通抓取失败区分开。
- **引擎只负责解析与核对**：声明了 `required` 时，`runQuery` / `resumeFromLedger` 会在花第一分检索与模型预算之前探针一次，缺插件或浏览器不可用就当场抛 `BROWSER_UNAVAILABLE`（`src/lodestar/packs/requirements.ts`），而不是逐条断言变成一堆看不出原因的"暂停"。

`demo`、`verify-quotes`、`audit` 三个离线命令不走这条路，不需要装插件或浏览器内核。

## 配置

跑 demo 与跑测试都不需要任何配置。接真实链路（模型 + 搜索 + 抓取）时才需要：

| 变量 | 含义 |
| --- | --- |
| `LLM_BASE_URL` / `LLM_API_KEY` | OpenAI 兼容端点（默认 `https://api.openai.com/v1`） |
| `LLM_TEXT_MODEL` / `LLM_WEB_MODEL` | 比对与检索用的模型名（默认都是 `gpt-4o-mini`） |
| `LLM_SEND_THINKING` | 设为 `1` 时给模型请求附带 `enable_thinking` |
| `SEARCH_PROVIDER` | 搜索提供者：`llm-web`（默认，模型自带联网搜索）或 `serper`；第三方提供者注册后填它的名字 |
| `OPENLODESTAR_LLM_SEARCH_BODY` | 合并进模型请求体的 JSON，用于各家联网开关（默认 `{"enable_search":true}`，适配 DashScope 兼容模式；OpenAI 搜索模型用 `{"web_search_options":{}}`） |
| `BROWSER_PLUGIN` | 浏览器渲染插件名（默认 `playwright`；第三方插件注册后填它的名字） |
| `SERPER_API_KEY` / `SERPER_BASE_URL` | 选 `serper` 时的搜索凭据与可选的端点覆盖 |
| `SERPER_TIMEOUT_MS` / `SERPER_RETRIES` / `SERPER_RETRY_BACKOFF_MS` | 单次检索请求的超时与"根本没走到 HTTP"那类失败的瞬时重试（默认 12000 / 1 / 500，退避按 2 的幂递增；`SERPER_RETRIES=0` 关掉重试）。不设超时时只能等运行时的默认值：连不上约 10.7 秒，而连接建立了对面不回数据是 300 秒。HTTP 状态码错误**不重试**——Serper 按请求计费，限流时重试只会再吃一次额度 |
| `SEARCH_RESULT_COUNT` | 每条查询要几条结果（默认 10） |
| `OPENLODESTAR_DATA_DIR` | 底稿目录（默认仓库根下的 `lodestar/`） |
| `OPENLODESTAR_ANCHORS_FILE` | 单独覆盖坐标文件路径 |
| `OPENLODESTAR_TRACE_DIR` | trace 存放目录（默认仓库根下的 `.traces/`） |
| `OPENLODESTAR_LOG` | `debug` / `warn` / `silent`（默认 `warn`） |
| `OPENLODESTAR_PAGE_TIMEOUT_MS` | 单页抓取超时（默认 25000） |
| `LODESTAR_MAX_SEARCH_CALLS` / `LODESTAR_MAX_PAGES` | 每条断言的预算（默认 4 / 6） |
| `LODESTAR_QUICK_CALL_TIMEOUT_MS` / `LODESTAR_QUICK_CALL_RETRIES` | 一问一答那两类调用（逐页比对、查询翻译）的超时与重试（默认 60000 / 1）。角色默认是 180 秒 ×（1+3）次尝试，一次卡死就是约 12 分钟——这类调用要的是一段 JSON 判断，60 秒拿不到就是拿不到，早停早止损 |
| `LODESTAR_INFRA_BREAKER` | 整场熔断阈值：连续这么多条断言撞在 infra 空转上（检索抛错，或抓回的页全部没读到正文）就收手，剩下的记 `paused`（默认 3；`0` 关掉熔断）。预算管一条断言花多少，护栏管一场最多白等多久——2026-11-01 两场在线重放里约一半时间是这类空转 |
| `LODESTAR_DEADLINE_MINUTES` | 整场墙钟截止时刻（从开跑算起，默认不设）。到点收手，剩下的断言记 `paused`，不是"查不到"。`live` 命令的 `--deadline-minutes` 是同一件事的一次性开关，且优先于本变量 |
| `LODESTAR_PAGE_TEXT_BUDGET` | 送去比对的正文上限，单位字符（默认 16000） |
| `LODESTAR_MAX_QUOTE_CHARS` | 引文长度上限，单位字符（默认 1000；超限整条拒收，不截断） |

在线链路的变量建议集中放在仓库根目录的 `.env`（已在 `.gitignore` 里，不会入库），从 `.env.example` 复制后填写。运行在线命令时用 Node 的 `--env-file=.env` 读取；示例之间的差异用命令行参数（如 `--data`、`--report`）表达，不要复制多份 env 制造漂移。`demo`、`verify-quotes`、`audit` 三个离线命令不需要这些变量。

浏览器渲染是独立的插件包（见「浏览器插件」一节）：缺省 `@openlodestar/browser-playwright` 只装在工作区里，按需加载。策略包声明 `required` 时，证据页逐页直接渲染；其余包只在页面需要浏览器时启用。没装插件而页面又确实要渲染，按包声明的不同有两种表现——声明 `required` 的包开跑前就报错，其余包把这一页记为"需要浏览器"并落到暂停态，不算抓取失败。

## 当前状态

**早期实验阶段（0.1）：离线链路可复现，在线链路还没有达到可用的产出率。** 目前跑得起来的故事线是——提一个问题（例如"近五年有哪些含民间瓷器的拍卖会"）→ 模型凭记忆列出候选 → 逐条联网取证与裁决 → 输出过了核验的记录。成本、失败归因与每轮读数都在公开构建记录里，好坏都写。

具体数字与边界（只代表仓库自带案例和那一次在线运行，不是对任意领域、任意站点的准确率承诺）：

- **离线合成案例** `porcelain`：11 条断言、20 条证据，记录门禁强 1、弱 1、拒收 1；引文逐字 20/20，字段线索 20/20。
- **离线真实案例** `poly-2021-autumn`：13 条断言、22 条证据，强 1、弱 1、拒收 2，可读坐标 1 条；引文逐字 22/22，字段线索 20/20（两条 `irrelevant` 不参与字段线索判定）。
- **测试与 CI**：35 个测试文件、419 条离线用例；CI 还跑两份 demo、两份底稿的引文硬校验与底稿审计。数字以仓库当前提交为准。
- **在线实测**（2026-10-29，真实密钥）：13 条冻结断言重放后 0 个可读坐标；6 条 `not_found` 全部是检索或页预算耗尽，不是"确证不存在"；从提问重跑只产出 1 条记录，也被拒收。硬护栏层 36 条在线引文逐字命中、0 违规。
- **提示注入红队**：8 个场景、0 次关系翻转、0 次 `system` 泄漏、0 条非逐字引文被接受（`qwen3.7-flash`，单模型小样本，不是普遍保证）。
- **发布状态**：在线链路在 0.1.0 冻结，发布后按正确性 → 召回 → 可用性改；0.1.0 暂不发布到 npm（`private: true`），按源码或 CLI 运行；公开接口在 1.0 之前可能变动。

仓库里两份示例的性质不同：`examples/porcelain/` 是**合成的**契约底稿，事件与页面都不对应真实场次，只用来钉接口与做回归；`examples/poly-2021-autumn/` 用的是**真实**公开报道——页面正文按抓取时点存成**节选**（含引文的自然段与直接上下文，不是全文），场次、日期与引文都能逐字对回原文，但快照之外没有联网能力，它证明的是"给定这些页面，结论怎么来、为什么拒"，而不是"现在还能搜到它们"。节选的抓取时间、抓取方式、全文 SHA-256 与裁剪范围记在 `examples/poly-2021-autumn/snapshots/manifest.json`；第三方文字的版权归原出版方，见同目录的 `THIRD_PARTY_NOTICES.md`。其中两条拒收是刻意放进去的对照样本，不是线上跑出来的真实失败。接真实链路要用自己的模型与搜索凭据，本仓库不对第三方站点的可用性与反爬行为作任何承诺。

## 公开构建记录

这个项目按"公开构建"的方式推进——把设计判断、踩到的坑、以及做错的地方一并写下来：

- 专栏（全部篇目）：[segmentfault.com/blog/yita](https://segmentfault.com/blog/yita)
- 第 1 篇：[当 AI 一整天都在说"我不记得"：我补上了搜索，又删掉了两个没用的新功能](https://segmentfault.com/a/1190000048345010)
- 第 2 篇（2026-10-12）与第 3 篇（2026-10-15）已发布，篇目见上方专栏；第 3 篇为《不让"记忆"成为你进步和创新的局限》
- 第 4 篇（2026-10-16）《追了三天的"配额耗尽"，真凶是一个我从没改过的默认值》，篇目见上方专栏；文末点明本文讲的模型角色表 OpenLodestar 也在用同一份
- 第 5 篇（2026-10-17）《我调好了搜索的"地区参数"，然后发现什么都没变：多语言支持的一次重做》，篇目见上方专栏；文末点明同一套检索机制（一个意图产两种语言的查询、各走一次自己的搜索）在 OpenLodestar 里也是同一份实现
- 第 6 篇（2026-10-19）《我差点让店主替我补数据：一次录入设计的返工》，篇目见上方专栏；讲的是"别把系统短板写成用户义务"与"测试照不能由做系统的人拍"（观察者偏差会让尺子虚高），不涉及 OpenLodestar 本体，属宿主系统的录入端设计复盘

## 与 ChainSafe Lodestar 的关系

**没有任何关系。** GitHub 上另有一个以太坊共识客户端项目叫 Lodestar（ChainSafe 出品），本项目与它无任何关联、无代码继承关系，只是名字里都用了 lodestar（意为北极星）这个词。

## License

[Apache-2.0](LICENSE)
