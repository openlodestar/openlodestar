# 第三方内容声明

本目录（`examples/demo-batch-8/`）除了项目自有内容，还包含从公开网页摘录的第三方文字。
这些文字**不在 OpenLodestar 的 Apache-2.0 授权范围内**，版权归各原出版方所有。

## 摘录了什么

| 来源 | 原文 | 摘录范围 | 原页域名 |
| --- | --- | --- | --- |
| www.cguardian.com | <https://www.cguardian.com/> | 含引文的段落与直接上下文 | www.cguardian.com |
| auction.artron.net | <https://auction.artron.net/org_detail/JG0005> | 含引文的段落与直接上下文 | auction.artron.net |
| www.artzww.com | <https://www.artzww.com/art2017art/wap_doc/29663321.html> | 含引文的段落与直接上下文 | www.artzww.com |
| wwj.beijing.gov.cn | <https://wwj.beijing.gov.cn/bjww/362749/362751/cs88/743733485/index.html> | 含引文的段落与直接上下文 | wwj.beijing.gov.cn |
| news.cafa.edu.cn | <http://news.cafa.edu.cn/MobileNews/independenWeixinContent?contentId=225454392> | 含引文的段落与直接上下文 | news.cafa.edu.cn |

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
