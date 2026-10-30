# 第三方内容声明

本目录（`examples/poly-2021-autumn/`）除了项目自有内容，还包含从公开网页摘录的第三方文字。
这些文字**不在 OpenLodestar 的 Apache-2.0 授权范围内**，版权归各原出版方所有。

## 摘录了什么

| 来源 | 原文 | 摘录范围 | 原页标注的发布方 |
| --- | --- | --- | --- |
| 雅昌艺术市场监测中心（AMMA） | <https://amma.artron.net/observation_shownews.php?newid=1104807> | 标题、署名、含引文的导语段、成交事实 | 雅昌发布 |
| The Value（值點網） | <https://hk.thevalue.com/articles/poly-auction-beijing-qianlong-yangcai-elephant-robin-egg-glaze-revolving-vase-result> | 标题、署名、专场统计段、拍賣詳情栏 | The Value |
| 澎湃号·湃客「雅昌艺术网」官方账号（原创：李保兴，雅昌艺术网） | <https://m.thepaper.cn/newsDetail_forward_15697852> | 标题、署名、开篇两段、「禹贡Ⅱ」与「禹贡Ⅰ」标题段 | 澎湃号·湃客 |
| 中国新闻网 | <https://www.chinanews.com/m/cul/2021/11-25/9616104.shtml> | 标题、署名、导语、古董珍玩段、预展段 | 中国新闻网 |

## 为什么这样摘

- 目的：演示"一条结论要能逐字回到它的来源"。引文是核验对象，上下文只保留到能读懂引文为止。
- 每份快照都删掉了导航、广告、图注、推荐位与页脚；正文只留含引文的自然段与直接上下文。
- 每份快照第一行标「节选·非全文」，并记录原文 URL、抓取时间、抓取方式与全文 SHA-256。
- 原文全文与原始 HTML 不在本仓库；全文指纹在 `snapshots/manifest.json`，可用于判断原页
  是否仍是抓取时那一版。

## 署名与用途

- 所有引文都保留了原出版方名称与原页链接。
- 这些摘录仅用于说明核验机制，不对原作品作改写、演绎或商业再利用。
- 如原出版方认为某段摘录超出适当引用范围，请通过仓库 Issue 联系；我们会移除或缩短相应段落。

## 与本目录许可证的关系

- 本目录中项目自有的结构化内容（`case.json`、`claims.jsonl`、`evidence.jsonl`、`query.txt`、
  本文件、`README.md`、`snapshots/manifest.json`）随仓库按 Apache-2.0 授权。
- 这些文件里的 `quote` 字段与 `snapshots/` 下的正文摘录仍是第三方文字，版权归原出版方，
  不适用 Apache-2.0。
- 需要完整原文时，请访问上表中的原始链接，以原出版方发布的版本为准。
