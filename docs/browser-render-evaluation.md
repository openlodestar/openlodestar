# 浏览器渲染：代价与收益评估（本轮只评估，不改依赖、不装浏览器）

> 触发：抓页可核那一轮里，**被拦 6 条 + 脚本壳 2 条**拿不到正文，只能靠真浏览器。
> 结论先说：**当前不建议把渲染接进评分卡的默认采样**，建议保留"缺工具就记 `paused`／`non-html`"的现状；先用现有插件做一次两页定向实测再决定。
> 本文只算账，不写代码、不动 `package.json`、不下载 Chromium。

## 先纠正一个前提：渲染能力已经存在，缺的不是依赖

仓库里已经有 `plugins/browser-playwright/`（独立工作区包，playwright 依赖只写在它自己那份 `package.json` 里），核心包的 `dependencies` 仍然只有 `js-yaml`。单页抓取 `src/integrations/scraper-strategies/single-page-fetch.ts` 的策略是「裸 fetch → 失败后浏览器降级」，而且 `allowBrowser` **默认就是开**。

所以真正待决定的不是"要不要引入浏览器"，而是两件更小的事：

1. **评分卡的抓页采样要不要默认开渲染**（现在 `capture-page-checks.ts` 写死 `allowBrowser: false`）；
2. **要不要把 Chromium 内核列为使用者首次运行的必装项**（现在要手动 `pnpm run browser:install`）。

## 四条可选路径与代价

| 路径 | 要改什么 | 安装体积 | 首次运行 | CI | 离线 |
| --- | --- | --- | --- | --- | --- |
| A. 内置 Playwright（现状能力，改成默认开） | 抓页脚本加 `--allow-browser`；文档写清 `browser:install` | npm 包 **4.7 MB**（已在工作区里）；Chromium 内核本机实测 **684 MB**（chromium 413 MB + headless shell 267 MB + ffmpeg 3 MB） | 不跑 `pnpm run browser:install` 就抛 `BrowserUnavailableError`，断言按 `paused` 处理 | 现在 `pnpm test` 用假模块，**不需要浏览器**；若 CI 要真渲染，得加一步 `browser:install`（可缓存） | 装完之后浏览器启动不依赖外网；但渲染本身仍要联网取页 |
| B. 调系统已装 Chrome / Edge | 插件加一个 `channel` 或 `executablePath` 选项（约十行） | **0**（用系统浏览器） | 机器上得有 Chrome / Edge；Windows 自带 Edge，GitHub 托管 runner 自带 Chrome | 可以，但渲染结果随浏览器版本漂 | 同 A |
| C. 使用者自备外部渲染服务 | 写一个第三方 `BrowserRenderer` 插件并注册，核心不改 | 0 | 要配 endpoint 与凭据 | 要凭据，PR 场景不可用 | **不可**：离线直接没材料，冻结回放也失效 |
| D. 不支持，只标"需要渲染" | 不需要改（现状） | 0 | 无 | 无影响 | 完整 |

三条补充事实：

- **A 的体积主要不是 npm 包，是内核。** `pnpm install` 只装 4.7 MB 的 playwright 包；684 MB 是执行 `playwright install chromium` 之后的磁盘占用。仓库当前**没有**把这一步放进任何默认脚本。
- **B 的代价在可复现性。** 系统 Chrome 自动升级，同一份冻结样本换台机器可能渲染出不同 DOM；要用 B 就得把浏览器版本写进样本说明。
- **C 与"冻结回放、零外部调用"直接冲突。** 评分卡的前提是样本冻结后重跑不再联网，外部渲染服务把这个前提打掉。

## 预估收益：8 条里真正可能核上的只有 1 条

先把 8 条摊开（字段值都是中文：机构、专场名、日期）：

| # | 样本 | 页面 | 失败档 | 站点语言 | 渲染后能核上的可能 |
| --- | --- | --- | --- | --- | --- |
| 1 | porcelain | artnet.com/news/poly-auction-beijing-2021-… | 被拦 403 | 英文 | 极低：字段是中文，英文正文逐字对不上 |
| 2 | porcelain | antiquesandthearts.com/poly-auction-beijing-… | 被拦 403 | 英文 | 极低，同上 |
| 3 | porcelain | artnet.com/auctions/poly-auction-2021-winter-catalog | 被拦 403 | 英文 | 极低，同上 |
| 4 | porcelain | artron.net/auction/2021-winter-poly-auction-catalog | 脚本壳（0 字符） | **中文** | **有**：雅昌的图录页通常列公司、专场、日期；但日期可能写成 `2021-12-05`，逐字判据会判不中 |
| 5 | porcelain | liveauctioneers.com/catalog/poly-auction-2021-winter-catalog | 脚本壳（0 字符） | 英文 | 极低，字段语言不匹配 |
| 6 | cg | artnet.com/auctions/china-guardian-2021-autumn-auction | 被拦 403 | 英文 | 极低 |
| 7 | cg | artnet.com/news/china-guardian-auctions-fall-2021-… | 被拦 403 | 英文 | 极低 |
| 8 | cg | barrons.com/articles/china-guardian-autumn-auction-… | 被拦 401 | 英文 + 付费墙 | 极低：渲染绕不过付费墙 |

还有一条**不在这 8 条里、但渲染能救**的页：porcelain 的 `thevalue.com/auctionnews/117655`。它裸抓回了 720 字符（过了 200 字符的线，被记成"抓到"），实际是脚本壳；渲染后大概率能拿到中文正文。

逐查询推：

- **porcelain 第 1 条源查询**：中文候选只有 thevalue 这一页 → 渲染成功且三个字段逐字命中，才可核。
- **porcelain 第 4 条源查询**：中文候选只有 artron → 同上。
- **cg 两条候选查询**：候选全是英文站或付费墙 → 即使渲染成功，中文机构名/专场名/日期也几乎不可能逐字出现。

**结论区间**：

| 口径 | 渲染后 | 说明 |
| --- | --- | --- |
| 只看用户点名的 8 条 | **0/8 ～ 1/8 = 0～12.5%** | 唯一希望是 artron 一页；日期格式一漂就回到 0 |
| 把 thevalue 也算上（9 页） | **0/8 ～ 2/8 = 0～25%** | 两条 porcelain 查询各赌一页中文正文 |
| 抓页成功率（顺带会好看） | 1/13 → 最多 9/13 ≈ 69% | **这项会明显变好，但它不是目标读数** |

**别拿抓页成功率当收益。** 渲染能让 6 条被拦 + 2 条壳"抓到"，但其中 7 条是英文站，正文里没有我们要的中文字段，可核率最多加 1～2 条。如果只看"抓页成功率从 7.7% 涨到 69%"就拍板引入 684 MB 内核，等于花大钱买了一个不解决核心问题的指标。

**会误判的地方**：以上是按站点语言与字段语言推的，没有真渲染。artnet 可能对无头浏览器继续 403；artron 可能有反爬；thevalue 的正文也可能不含完整专场名。所以给的是区间，不是承诺。

## 对使用者的影响

| 问题 | A 内置 Playwright | B 系统浏览器 | C 外部服务 | D 不支持 |
| --- | --- | --- | --- | --- |
| 安装体积 | +4.7 MB（已含）；内核另 684 MB | 0 | 0 | 0 |
| 首次运行是否要下载浏览器 | **要**（`pnpm run browser:install`） | 不要，但要求机器上有 Chrome/Edge | 不要 | 不要 |
| CI 能否跑 | 现状能（测试用假模块）；要真渲染需加安装步骤 | 能（runner 自带 Chrome），版本不可控 | 要凭据，fork 的 PR 跑不了 | 能 |
| 离线可用性 | 浏览器能离线启动，取页仍需网络 | 同 A | **不可用** | 不受影响 |
| 对"冻结回放"的影响 | 渲染结果要冻进样本才可复现 | 同 A，且受浏览器版本影响 | 无法离线复现 | 无影响 |

## 建议与失效条件

**建议：维持现状（D），不把渲染接进评分卡默认采样，也不把 Chromium 列为必装。**

理由按权重排：

1. 预期收益最多 1～2 条查询、0～25 个百分点，且下限是 0——8 条里 7 条是英文站，字段语言对不上，渲染救不回来。
2. 代价是使用者多下 684 MB，或者依赖机器上恰好有 Chrome；而评分卡的核心承诺是"离线、可复现、零外部调用"。
3. 现状已经把"缺工具"与"抓取失败"分开了：没装浏览器时抛 `BrowserUnavailableError`、断言记 `paused`；抓页样本里记 `non-html` / `blocked`。这比"默认开渲染、装不上就报错"对使用者友好。

**下一步（不改依赖、不装浏览器）**：用本机已缓存的 Chromium 与现有插件，给抓页脚本加一个 `--allow-browser` 开关，只对 **artron + thevalue 两页**跑一次定向实测，把结果写回样本说明。这一步只验证"值不值得"，不改变默认行为。本轮按用户要求**没有执行**。

**这条建议在以下情况失效，届时重新评估：**

- 定向实测两页里有 ≥1 页可核 → 收益成立，可考虑把渲染做成抓页脚本的**显式可选项**（默认仍关），并把"需要渲染"的域名列进文档；
- 真实语料里中文站 / SPA 页占比升到三成以上，`non-html` / `blocked` 成为主要失败档 → 渲染从"锦上添花"变成"主通路"，应改推 B（系统浏览器，零下载）并固定版本；
- CI 需要复现渲染读数 → 必须选 A 并锁 playwright 版本，不能选 B；
- 有人愿意维护第三方渲染服务且接受"离线不可复现" → 走 C，但仍不能进评分卡默认采样。

## 本轮边界（如实）

- **没有改 `package.json`，没有安装浏览器。** 本机的 `ms-playwright` 缓存是之前就有的，本轮只用 `Get-ChildItem` 量了体积，没有启动过浏览器。
- **没有真渲染任何页面**，上面所有收益都是按站点语言与字段语言推的区间，不是实测。
- 这次评估不覆盖：登录墙、验证码、动态加载等待策略、渲染耗时对 15 秒超时的影响。
