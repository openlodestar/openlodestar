# 检索结果回放（冻结样本）

> 配套脚本：`scripts/capture-search-replay.ts`（采集 / 离线重算）
> 配套测试：`src/lodestar/replay-search.test.ts`（离线回放）
> 样本：`examples/replay-search/porcelain-2021-autumn/`

前两份落点表（断言路由、预筛）证明的是「判得对」。这一份回答另一个问题：**这些查询到底能不能召回可以裁的页面。** 做法是拿一条真实记录，按引擎的真实检索路径跑一遍，把每条查询的原始结果冻下来；之后所有重跑都读冻结样本，不再联网。

## 边界（按批准的硬边界执行）

| 约束 | 实际做法 |
| --- | --- |
| 只用 llm-search，一次都不许碰 serper | 脚本直接 `new LlmWebSearchProvider()`；没有 import serper 模块，且在启动时检查 `SEARCH_PROVIDER=serper` 就拒绝运行 |
| 查询数 ≤ 10，先列出再动手 | 源查询 4 条（引擎的记录级上限），加翻译轨最多 4 条，合计 8 条；采集前先用默认的干跑模式打印清单 |
| 采到就冻成回放样本，之后重跑一律离线 | 结果写入 `search-results.json`；回放测试用冻结结果替换提供者与翻译，零网络 |
| 汇报写清返回条数、能裁的真页、成本 | 见下表与「读数」一节 |

## 查询清单与逐条读数

记录：北京保利 / 2021年12月5日 / 「禹贡Ⅰ—盛清御瓷新风尚」。源轨（中文）4 条，翻译轨（英文）4 条，各是一条 `llm-web` 检索。

| # | 轨 | 查询 | 返回条数 | 通过候选过滤 | 标题与域名自洽且讲本场 |
| --- | --- | --- | --- | --- | --- |
| 1 | 中文 | 北京保利 2021冬季拍卖会 禹贡Ⅰ 盛清御瓷新风尚 拍卖 专场 | 0 | 0 | 0 |
| 2 | 中文 | 北京保利 2021冬季拍卖会 禹贡Ⅰ 盛清御瓷新风尚 | 0 | 0 | 0 |
| 3 | 中文 | "禹贡Ⅰ 盛清御瓷新风尚" 北京保利 2021冬季拍卖会 | 0 | 0 | 0 |
| 4 | 中文 | 北京保利 2021冬季拍卖会 拍卖 图录 | 0 | 0 | 0 |
| 5 | 英文 | Beijing Poly 2021 Winter Auction Yugong I High Qing Imperial Porcelain New Trends auction special sale | 5 | 5 | 5 |
| 6 | 英文 | Beijing Poly 2021 Winter Auction Yugong I High Qing Imperial Porcelain New Trends | 0 | 0 | 0 |
| 7 | 英文 | "Yugong I High Qing Imperial Porcelain New Trends" Beijing Poly 2021 Winter Auction | 0 | 0 | 0 |
| 8 | 英文 | Beijing Poly 2021 Winter Auction auction catalog | 10 | 10 | 7 |

「通过候选过滤」= 引擎的 `filterAndRankCandidates` 认可（http 链接、非图片/文档、不在域名黑名单、可解析域名）。
「标题与域名自洽且讲本场」是**人工按标题与域名判的静态读数**，不是抓页核对的结果——见下节。

## 读数

- **中文轨 4 条全部返回 0 条。** 不是被引擎过滤掉，是提供者本身没给结果（空数组）。同一批查询翻成英文后，有两条能召回，其中一条直接命中「禹贡Ⅰ」这场。
- **能召回的那一类页面确实存在。** 英文轨第 5 条查询的 5 条结果全部与本次事件同名同题：中国日报的预展报道、保利香港官网的北京冬拍页、artnet 的新闻、TheValue 的专场报道（标题逐字含 Yugong I）、Antiques and the Arts 的报道。这说明「机构 + 年份 + 专场名」这套查询构造在英文语料面是有效的。
- **图录类查询暴露了 llm-web 的编造风险。** 第 8 条返回 10 条，其中 3 条的域名与标题自相矛盾：佳士得（christies.com）、苏富比（sothebys.com）、邦瀚斯（bonhams.com）域名下挂着「Poly Auction 2021 Winter Catalog」。这三家不会托管保利的图录，这 3 条**高度疑似模型编造的链接**，不能当候选页用。
- **能裁的「真页」这一轮没有验证到底。** 严格的「能裁」要抓页、读正文、核对逐字引用；本轮边界只到检索，**没有抓任何页面**。上表最后一列只能算静态代理读数：标题与事件对得上、域名不矛盾。按这个口径，15 条候选里 12 条自洽（5 条直接讲本场，7 条是官网/雅昌的冬季或图录页），3 条疑似编造。真实的逐字可裁性需要另批一次抓页验证。

## 成本

| 项 | 次数 | 说明 |
| --- | --- | --- |
| `llm-web` 检索 | 8 次（2 轨 × 4 条查询） | 每次搜索是一条模型联网调用 |
| 查询翻译 | 1 次文本调用 | 中文查询翻成英文轨 |
| 页面抓取 | 0 次 | 本轮边界不含抓页 |
| 耗时 | 约 47 秒 | 两轨并行，受模型联网延迟主导 |

`site:` 定向查询：本样本构造出的 4 条里没有 `site:` 查询，所以没有「因提供者不支持而跳过」的记账。

## 回放怎么跑

```bash
# 采集（会花钱；默认不带 --allow-spend 只打印查询清单）
npx tsx --env-file=.env scripts/capture-search-replay.ts --sample porcelain-2021-autumn --allow-spend

# 只改读数口径（例如补 matchTerms）时离线重算，不发请求
npx tsx scripts/capture-search-replay.ts --sample porcelain-2021-autumn --recompute

# 回放：读冻结样本，用假提供者 + 冻结译文重跑，零网络
npx vitest run src/lodestar/replay-search.test.ts
```

回放测试断言四件事，任何一处漂移都会红：

1. 查询构造结果与冻结时逐条一致（样本换版先在这里暴露）；
2. 检索次数一致（预算记账没被改过）；
3. 每条查询的返回条数一致（同一条查询拿回同一批结果）；
4. 候选过滤后的条数一致（黑名单、去重、排序没被动过）。

样本自带 `version` 与 `capturedAt`；采集用的模型名（`LLM_WEB_MODEL`）与上限（`maxSearchCalls` / `numResultsPerQuery`）也写进样本，换模型或改上限时读数不可直接比较。

## 这次样本的局限

- **只有一条记录、一个提供者。** 中文轨 0 召回是这条记录 + 这个提供者的读数，不能推及全部记录；换记录要另采样本。
- **没有抓页。** 「能裁的真页」目前只到候选过滤与静态自洽判断；逐字回链要下一轮。
- **翻译轨放大了召回。** 如果关掉翻译，这次样本的召回会是 0/4——记录级查询构造本身没问题，卡在中文语料面的提供者召回上。
