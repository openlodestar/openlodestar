# 第三方内容声明

本目录（`examples/demo-batch-14/`）除了项目自有内容，还包含从公开网页摘录的第三方文字。
这些文字**不在 OpenLodestar 的 Apache-2.0 授权范围内**，版权归各原出版方所有。

## 摘录了什么

| 来源 | 原文 | 摘录范围 | 原页域名 |
| --- | --- | --- | --- |
| www.phillips.com | <https://www.phillips.com/article/72692590/phillips-and-poly-auction-partner-for-beijing-hong-kong-auctions> | 含引文的段落与直接上下文 | www.phillips.com |
| www.polypm.com.cn | <https://www.polypm.com.cn/auction/auction_index.html?infoId=4549156646126882816> | 含引文的段落与直接上下文 | www.polypm.com.cn |
| m-news.artron.net | <https://m-news.artron.net/news/20260915/n1940787.html> | 含引文的段落与直接上下文 | m-news.artron.net |
| artpro.com | <https://artpro.com/news/31111> | 含引文的段落与直接上下文 | artpro.com |
| wx.ttp.51bidlive.com | <http://wx.ttp.51bidlive.com/news/detail?id=4516> | 含引文的段落与直接上下文 | wx.ttp.51bidlive.com |

## 为什么这样摘

- 目的：演示"一条结论要能逐字回到它的来源"。引文是核验对象，上下文只保留到能读懂引文为止。
- 每份快照都删掉了导航、广告、推荐位与页脚；正文只留含引文的段落与直接上下文，每页不超过 2000 字符。
- 每份快照第一行标「节选·非全文」，并记录原文 URL、抓取时间与全文 SHA-256。

## 署名与用途

- 所有引文都保留了原域名与原页链接。
- 这些摘录仅用于说明核验机制，不对原作品作改写、演绎或商业再利用。
- 如原出版方认为某段摘录超出适当引用范围，请通过仓库 Issue 联系；我们会移除或缩短相应段落。

## 与本目录许可证的关系

- 本目录中项目自有的结构化内容（`case.json`、`claims.jsonl`、`evidence.jsonl`、`query.txt`、
  本文件）随仓库按 Apache-2.0 授权。
- 这些文件里的 `quote` 字段与 `snapshots/` 下的正文摘录仍是第三方文字，版权归原出版方，
  不适用 Apache-2.0。
- 需要完整原文时，请访问上表中的原始链接，以原出版方发布的版本为准。
