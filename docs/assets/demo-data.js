// 由 src/demo-page/build-demo-data.ts 从 examples/ 生成，不要手改；改数据请改冻结批次后重跑 pnpm run demo:data。
window.LODESTAR_DEMO = {
  "generatedAt": "2026-11-05T16:52:19.346Z",
  "generator": "src/demo-page/build-demo-data.ts",
  "note": "判定由引擎在构建时算好并冻结：页面只切换展示，不重算计票、门禁与坐标。证据按「记录号＋字段名＋字段值」匹配，字段值对不上就显示「这批证据没覆盖」。",
  "fields": [
    {
      "key": "auctionHouse",
      "label": "拍卖机构",
      "role": "key"
    },
    {
      "key": "dateText",
      "label": "举办时间",
      "role": "key"
    },
    {
      "key": "sessionName",
      "label": "专场名称",
      "role": "key"
    },
    {
      "key": "location",
      "label": "举办地点",
      "role": "secondary"
    },
    {
      "key": "category",
      "label": "专场类目",
      "role": "secondary"
    },
    {
      "key": "totalHammer",
      "label": "总成交额",
      "role": "secondary"
    }
  ],
  "buckets": {
    "strong": 2,
    "weak": 2,
    "refuted": 2,
    "not_found": 3
  },
  "cases": [
    {
      "id": "poly-2021-autumn",
      "title": "北京保利 2021 秋拍「禹贡」专场",
      "subtitle": "四份公开报道的节选，两份真实场次：一份拿到强坐标，一份只到弱档；另外两条候选被拒收",
      "query": "北京保利2021年秋季拍卖会，中国古董珍玩板块有哪些专场？各场的拍卖机构、举办时间、专场名称是什么？",
      "capturedAt": "2026-10-29",
      "sources": [
        {
          "url": "https://amma.artron.net/observation_shownews.php?newid=1104807",
          "publisher": "雅昌艺术市场监测中心（AMMA）",
          "family": "artron.net",
          "tier": "primary",
          "snapshotFile": "snapshots/amma-2021-12-05.txt",
          "excerpt": "【节选·非全文】\n来源：雅昌艺术市场监测中心（AMMA）\n标题：雅昌快讯｜北京保利2021秋拍：清雍正炉钧釉葫芦尊2760万元成交\n原文：https://amma.artron.net/observation_shownews.php?newid=1104807\n发布：2021-12-05 20:26（原文页标注）\n抓取：2026-10-29T16:36:00+08:00 · curl 取服务端 HTML 后本地抽取正文（未执行页面脚本）\n裁剪：保留含引文的自然段与直接上下文；全文 1645 字 → 本节选 271 字\n指纹：全文 SHA-256 d19209b46d80ca8c0e37ff7e6878570da4d1e40f0215066e80899155ff8ffb05（完整抓取档案见 snapshots/manifest.json）\n说明：本文件不是原文全文。导航、广告、图注、推荐位与页脚已删除；省略处用「……」标出。\n────────────────────────────────────────\n雅昌快讯｜北京保利2021秋拍：清雍正炉钧釉葫芦尊2760万元成交\n2021-12-05 20:26:25 来源:雅昌发布 0次浏览\n[北京保利]禹贡Ⅰ—盛清御瓷新风尚\n2021-12-05\n2021年12月5日，北京保利2021秋拍进入到古董珍玩板块。专场“禹贡Ⅰ—盛清御瓷新风尚”涵盖了20余件清三代瓷器珍品。其中，清雍正炉钧孔雀毛釉如意耳葫芦尊引人瞩目。在拍卖现场，此标的从1900万元起拍，经过激烈争夺，2400万元落槌，2760万元成交。\nLot5536\n清雍正 炉钧孔雀毛釉如意耳葫芦尊\n高：27.5 cm\n成交价： 2760万元\n……（略：藏品描述两段）\n责任编辑：王丽静\n"
        },
        {
          "url": "https://hk.thevalue.com/articles/poly-auction-beijing-qianlong-yangcai-elephant-robin-egg-glaze-revolving-vase-result",
          "publisher": "The Value（值點網）",
          "family": "thevalue.com",
          "tier": "primary",
          "snapshotFile": "snapshots/thevalue-2021-12-05.txt",
          "excerpt": "【节选·非全文】\n来源：The Value（值點網）\n标题：2021秋拍最貴瓷器 傳世唯一爐鈞轉心瓶RMB 8,222萬北京保利成交\n原文：https://hk.thevalue.com/articles/poly-auction-beijing-qianlong-yangcai-elephant-robin-egg-glaze-revolving-vase-result\n发布：2021-12-05 22:19（原文页标注）\n抓取：2026-10-29T16:37:00+08:00 · curl 取服务端 HTML 后本地抽取正文（未执行页面脚本）\n裁剪：保留含引文的自然段与直接上下文；全文 3433 字 → 本节选 393 字\n指纹：全文 SHA-256 8f9ea1680e72e14c8b43a5583e25822b7feeace5dd0fdaabc0f6af70c56cb1e4（完整抓取档案见 snapshots/manifest.json）\n说明：本文件不是原文全文。导航、广告、图注、推荐位与页脚已删除；省略处用「……」标出。\n────────────────────────────────────────\n2021秋拍最貴瓷器 傳世唯一爐鈞轉心瓶RMB 8,222萬北京保利成交\n撰文：Kayan Chan\n12月05日, 2021 | 星期日 | 22:19\n2543 次觀看\n北京保利秋拍進行得如火如荼，古董版塊各大專場今日（5號）陸續舉槌。黃花梨巨案「天下一」以RMB 1.15億寫下中國古典家具拍賣紀錄，打響頭炮。\n接下來的清代御瓷專場承接此等氣勢，乾隆 御製胭脂紅地套爐鈞釉「太平有象」轉心瓶以RMB 8,222萬（NT$3.56億）易手，榮登今季秋拍最貴瓷器。\n今晚的「禹貢I - 盛清御瓷新風尚」專場合共帶來26件拍品，僅1件流拍，成交率96%，斬獲RMB 2.94億成交總額，共9件拍品以過千萬人民幣成交，成績堅實。\n……（略：拍品详情、转心瓶背景与其余焦点拍品）\n拍賣詳情\n拍賣行：北京保利\n專場：禹貢I - 盛清御瓷新風尚\n拍賣日期：2021/12/5\n拍品數目：26\n成交：25\n未成交：1\n成交率：96%\n成交總額：RMB 294,745,000\n"
        },
        {
          "url": "https://m.thepaper.cn/newsDetail_forward_15697852",
          "publisher": "澎湃号·湃客「雅昌艺术网」官方账号（原创：李保兴，雅昌艺术网）",
          "family": "artron.net",
          "tier": "primary",
          "snapshotFile": "snapshots/thepaper-2021-12-05.txt",
          "excerpt": "【节选·非全文】\n来源：澎湃号·湃客「雅昌艺术网」官方账号（原创：李保兴，雅昌艺术网）\n标题：北京保利2021秋拍 | 以明清宫廷艺术为主线，发掘更多更好的中国古董珍玩\n原文：https://m.thepaper.cn/newsDetail_forward_15697852\n发布：2021-12-05 09:24（原文页标注）\n抓取：2026-10-29T16:36:00+08:00 · curl 取服务端 HTML 后本地抽取正文（未执行页面脚本）\n裁剪：保留含引文的自然段与直接上下文；全文 9411 字 → 本节选 761 字\n指纹：全文 SHA-256 294f79bea1d62c9ca8c391c5aa37e3e4eb47c1f659946f17e3d6c6d516ffb4e5（完整抓取档案见 snapshots/manifest.json）\n说明：本文件不是原文全文。导航、广告、图注、推荐位与页脚已删除；省略处用「……」标出。\n────────────────────────────────────────\n北京保利2021秋拍 | 以明清宫廷艺术为主线，发掘更多更好的中国古董珍玩_澎湃号·湃客_澎湃新闻-The Paper\n北京保利2021秋拍 | 以明清宫廷艺术为主线，发掘更多更好的中国古董珍玩\n雅昌艺术网雅昌艺术网官方澎湃号\n2021-12-05 09:24\n北京\n原创 李保兴 雅昌艺术网\n今年春拍，北京保利中国古董珍玩部以19.3亿元完美收官，诞生3件亿元作品，26件千万级作品，并打破多项世界拍卖纪录。延续春拍佳绩，本次北京保利2021年秋季拍卖会，再次为众藏家奉献了一场无与伦比的艺术盛筵。其中，中国古董珍玩板块以明清宫廷艺术为主线，亦在其中发掘珍稀的特别艺术门类。\n本季，中国古董珍玩板块集合了十二个专场，囊括器物各个门类：以清乾隆初年郎世宁绘《纯惠皇贵妃油画像》及清乾隆御制洋彩胭脂紫地番莲花卉套炉钧釉太平有象转心瓶领衔的“禹贡”系列专场；以“明末清初黄花梨独板架几式巨型供案”为首之“逍遥座”专场；以“宋‘僊籁’连珠式琴”为首之“仙籁清流——攻玉山房古琴藏珍”藏琴系列；亦囊括瓷器、家具、佛造像、文房等众多稀有珍品专场拍卖，如数于秋拍尽现。\n禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术\n清乾隆初年 郎世宁绘《纯惠皇贵妃油画像》\n纵54.6cm；横41.9cm\n估价待询\n瓷器：以宫廷瓷器为主线\n本季拍卖中，瓷器部分既有以“清乾隆御制洋彩胭脂紫地番莲花卉套炉钧釉太平有象转心瓶”为首的“禹贡Ⅰ——盛清御瓷新风尚”，“佞宋—十面灵璧山居暨诸名藏古陶瓷清翫”，“十面观止——十面灵璧山居诸家藏元明清珍瓷”等数个专场，囊括各类明清御制瓷器，亦囊括有18世纪“西风东渐”的中西结合艺术珍品，甚将各式陶瓷细分到年希尧，唐英督陶期间的新奇门类御窑陶瓷作品，囊括了青花、斗彩、洋彩、珐琅彩等瓷器，皆为时下市场热门品类。\n禹贡Ⅰ—盛清御瓷新风尚\n……（以下略：其余专场与拍品详情）\n"
        },
        {
          "url": "https://www.chinanews.com/m/cul/2021/11-25/9616104.shtml",
          "publisher": "中国新闻网",
          "family": "chinanews.com",
          "tier": "unlisted",
          "snapshotFile": "snapshots/chinanews-2021-11-25.txt",
          "excerpt": "【节选·非全文】\n来源：中国新闻网\n标题：北京保利2021秋拍将举槌 呈现超8000件艺术品\n原文：https://www.chinanews.com/m/cul/2021/11-25/9616104.shtml\n发布：2021-11-25 17:56（原文页标注）\n抓取：2026-10-29T16:35:00+08:00 · curl 取服务端 HTML 后本地抽取正文（未执行页面脚本）\n裁剪：保留含引文的自然段与直接上下文；全文 1087 字 → 本节选 458 字\n指纹：全文 SHA-256 9385e005c43798303a69adaa6b68d34e28ad1daca103b6916d0d49528b671566（完整抓取档案见 snapshots/manifest.json）\n说明：本文件不是原文全文。导航、广告、图注、推荐位与页脚已删除；省略处用「……」标出。\n────────────────────────────────────────\n北京保利2021秋拍将举槌 呈现超8000件艺术品\n2021年11月25日 17:56 中国新闻网\n中新网11月25日电 北京保利拍卖2021秋季艺术品拍卖会新闻发布会日前举行。\n据介绍，北京保利拍卖2021秋拍将呈现中国书画、古代书画、古董珍玩、现当代艺术、珠宝钟表尚品、邮品钱币、以及名酒茗茶等门类，逾40个专场超8000件艺术品。此外，特别甄选来自全球十余位数字艺术家以数字媒介创作而成的NFT作品。\n……（略：中国书画、古代书画板块）\n中国古董珍玩板块共呈现十二个专场，包括以“清乾隆御制洋彩胭脂紫地番莲花卉套炉钧釉太平有象转心瓶”及“清乾隆初年郎世宁绘《纯惠皇贵妃油画像》”领衔的“禹贡”系列专场等。\n……（略：图注与现当代艺术段）\n据悉，北京保利拍卖2021秋季艺术品拍卖会预展将于11月29日在北京开启，预展将持续至各专场拍卖前一日。\n此外，本季秋拍北京保利拍卖与富艺斯拍卖行三度联手，合作推出“二十世纪及当代艺术和设计”专场，囊括常玉、吴冠中、赵无极、朱德群、草间弥生、乔治·康多等中西方艺术大师的力作。联拍将于11月29日、30日在香港、北京两地以视频直播的方式同步拍卖。(完)\n"
        }
      ],
      "records": [
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "title": "北京保利 · 禹贡Ⅰ—盛清御瓷新风尚（2021年12月5日）",
          "bucket": "strong",
          "fields": [
            {
              "key": "auctionHouse",
              "label": "拍卖机构",
              "role": "key",
              "value": "北京保利"
            },
            {
              "key": "dateText",
              "label": "举办时间",
              "role": "key",
              "value": "2021年12月5日"
            },
            {
              "key": "sessionName",
              "label": "专场名称",
              "role": "key",
              "value": "禹贡Ⅰ—盛清御瓷新风尚"
            },
            {
              "key": "location",
              "label": "举办地点",
              "role": "secondary",
              "value": "北京"
            }
          ],
          "evidence": [
            {
              "evidenceId": "ev-poly-0001",
              "fieldKey": "auctionHouse",
              "fieldValue": "北京保利",
              "relation": "supports",
              "quote": "2021年12月5日，北京保利2021秋拍进入到古董珍玩板块。专场“禹贡Ⅰ—盛清御瓷新风尚”涵盖了20余件清三代瓷器珍品。",
              "url": "https://amma.artron.net/observation_shownews.php?newid=1104807",
              "domain": "amma.artron.net",
              "family": "artron.net",
              "tier": "primary",
              "snapshotFile": "snapshots/amma-2021-12-05.txt",
              "fetchedAt": "2026-10-29T00:00:00.000Z",
              "note": null,
              "dimension": "porcelain:auctionHouse",
              "state": "exact",
              "matchedValue": "北京保利"
            },
            {
              "evidenceId": "ev-poly-0002",
              "fieldKey": "dateText",
              "fieldValue": "2021年12月5日",
              "relation": "supports",
              "quote": "2021年12月5日，北京保利2021秋拍进入到古董珍玩板块。专场“禹贡Ⅰ—盛清御瓷新风尚”涵盖了20余件清三代瓷器珍品。",
              "url": "https://amma.artron.net/observation_shownews.php?newid=1104807",
              "domain": "amma.artron.net",
              "family": "artron.net",
              "tier": "primary",
              "snapshotFile": "snapshots/amma-2021-12-05.txt",
              "fetchedAt": "2026-10-29T00:00:00.000Z",
              "note": null,
              "dimension": "porcelain:dateText",
              "state": "exact",
              "matchedValue": "2021年12月5日"
            },
            {
              "evidenceId": "ev-poly-0003",
              "fieldKey": "sessionName",
              "fieldValue": "禹贡Ⅰ—盛清御瓷新风尚",
              "relation": "supports",
              "quote": "2021年12月5日，北京保利2021秋拍进入到古董珍玩板块。专场“禹贡Ⅰ—盛清御瓷新风尚”涵盖了20余件清三代瓷器珍品。",
              "url": "https://amma.artron.net/observation_shownews.php?newid=1104807",
              "domain": "amma.artron.net",
              "family": "artron.net",
              "tier": "primary",
              "snapshotFile": "snapshots/amma-2021-12-05.txt",
              "fetchedAt": "2026-10-29T00:00:00.000Z",
              "note": null,
              "dimension": "porcelain:sessionName",
              "state": "exact",
              "matchedValue": "禹贡Ⅰ—盛清御瓷新风尚"
            },
            {
              "evidenceId": "ev-poly-0004",
              "fieldKey": "auctionHouse",
              "fieldValue": "北京保利",
              "relation": "supports",
              "quote": "拍賣行：北京保利",
              "url": "https://hk.thevalue.com/articles/poly-auction-beijing-qianlong-yangcai-elephant-robin-egg-glaze-revolving-vase-result",
              "domain": "hk.thevalue.com",
              "family": "thevalue.com",
              "tier": "primary",
              "snapshotFile": "snapshots/thevalue-2021-12-05.txt",
              "fetchedAt": "2026-10-29T00:00:00.000Z",
              "note": null,
              "dimension": "porcelain:auctionHouse",
              "state": "exact",
              "matchedValue": "北京保利"
            },
            {
              "evidenceId": "ev-poly-0005",
              "fieldKey": "dateText",
              "fieldValue": "2021年12月5日",
              "relation": "supports",
              "quote": "拍賣日期：2021/12/5",
              "url": "https://hk.thevalue.com/articles/poly-auction-beijing-qianlong-yangcai-elephant-robin-egg-glaze-revolving-vase-result",
              "domain": "hk.thevalue.com",
              "family": "thevalue.com",
              "tier": "primary",
              "snapshotFile": "snapshots/thevalue-2021-12-05.txt",
              "fetchedAt": "2026-10-29T00:00:00.000Z",
              "note": null,
              "dimension": "porcelain:dateText",
              "state": "exact",
              "matchedValue": "2021/12/5"
            },
            {
              "evidenceId": "ev-poly-0006",
              "fieldKey": "sessionName",
              "fieldValue": "禹贡Ⅰ—盛清御瓷新风尚",
              "relation": "supports",
              "quote": "今晚的「禹貢I - 盛清御瓷新風尚」專場合共帶來26件拍品，僅1件流拍，成交率96%，斬獲RMB 2.94億成交總額，共9件拍品以過千萬人民幣成交，成績堅實。",
              "url": "https://hk.thevalue.com/articles/poly-auction-beijing-qianlong-yangcai-elephant-robin-egg-glaze-revolving-vase-result",
              "domain": "hk.thevalue.com",
              "family": "thevalue.com",
              "tier": "primary",
              "snapshotFile": "snapshots/thevalue-2021-12-05.txt",
              "fetchedAt": "2026-10-29T00:00:00.000Z",
              "note": null,
              "dimension": "porcelain:sessionName",
              "state": "exact",
              "matchedValue": "禹貢I - 盛清御瓷新風尚"
            },
            {
              "evidenceId": "ev-poly-0007",
              "fieldKey": "location",
              "fieldValue": "北京",
              "relation": "supports",
              "quote": "据悉，北京保利拍卖2021秋季艺术品拍卖会预展将于11月29日在北京开启，预展将持续至各专场拍卖前一日。",
              "url": "https://www.chinanews.com/m/cul/2021/11-25/9616104.shtml",
              "domain": "www.chinanews.com",
              "family": "chinanews.com",
              "tier": "unlisted",
              "snapshotFile": "snapshots/chinanews-2021-11-25.txt",
              "fetchedAt": "2026-10-29T00:00:00.000Z",
              "note": "页面说的是预展在北京开启；按本包 location 规则，预展地命中即 supports",
              "dimension": "porcelain:location",
              "state": "exact",
              "matchedValue": "北京"
            }
          ],
          "computation": {
            "gate": "strong",
            "reason": "关键字段全部 supported、共现命中 2 个页面、最低证据等级 E2",
            "fieldVerdicts": {
              "auctionHouse": {
                "fieldValue": "北京保利",
                "claimId": "cl-rec-poly-2021-yugong-1-auctionHouse",
                "verdict": "supported",
                "evidenceGrade": "E2",
                "supportCount": 2,
                "refuteCount": 0,
                "notFoundCause": null,
                "examinedPages": 2,
                "dimensionState": "exact"
              },
              "dateText": {
                "fieldValue": "2021年12月5日",
                "claimId": "cl-rec-poly-2021-yugong-1-dateText",
                "verdict": "supported",
                "evidenceGrade": "E2",
                "supportCount": 2,
                "refuteCount": 0,
                "notFoundCause": null,
                "examinedPages": 2,
                "dimensionState": "exact"
              },
              "sessionName": {
                "fieldValue": "禹贡Ⅰ—盛清御瓷新风尚",
                "claimId": "cl-rec-poly-2021-yugong-1-sessionName",
                "verdict": "supported",
                "evidenceGrade": "E2",
                "supportCount": 2,
                "refuteCount": 0,
                "notFoundCause": null,
                "examinedPages": 2,
                "dimensionState": "exact"
              },
              "location": {
                "fieldValue": "北京",
                "claimId": "cl-rec-poly-2021-yugong-1-location",
                "verdict": "supported",
                "evidenceGrade": "E1",
                "supportCount": 1,
                "refuteCount": 0,
                "notFoundCause": null,
                "examinedPages": 1,
                "dimensionState": "exact"
              }
            },
            "keyFieldValues": {
              "auctionHouse": "北京保利",
              "dateText": "2021年12月5日",
              "sessionName": "禹贡Ⅰ—盛清御瓷新风尚"
            },
            "cooccurrence": {
              "count": 2,
              "pages": [
                "https://amma.artron.net/observation_shownews.php?newid=1104807",
                "https://hk.thevalue.com/articles/poly-auction-beijing-qianlong-yangcai-elephant-robin-egg-glaze-revolving-vase-result"
              ]
            },
            "dimensionGrade": {
              "grade": "strong",
              "score": 3.5,
              "basis": "「auctionHouse」「dateText」「location」「sessionName」在各自维度上对上（累计 3.5，≥ 1.2）",
              "conflictDimensions": [],
              "entries": [
                {
                  "dimension": "porcelain:auctionHouse",
                  "label": "auctionHouse",
                  "state": "exact",
                  "cap": 1
                },
                {
                  "dimension": "porcelain:dateText",
                  "label": "dateText",
                  "state": "exact",
                  "cap": 1
                },
                {
                  "dimension": "porcelain:location",
                  "label": "location",
                  "state": "exact",
                  "cap": 0.5
                },
                {
                  "dimension": "porcelain:sessionName",
                  "label": "sessionName",
                  "state": "exact",
                  "cap": 1
                }
              ]
            },
            "anchor": {
              "grade": "strong",
              "evidenceGrade": "E2",
              "urls": [
                "https://amma.artron.net/observation_shownews.php?newid=1104807",
                "https://hk.thevalue.com/articles/poly-auction-beijing-qianlong-yangcai-elephant-robin-egg-glaze-revolving-vase-result"
              ],
              "searchPhrases": [
                "北京保利 2021冬季拍卖会 禹贡Ⅰ 盛清御瓷新风尚",
                "北京保利 禹贡Ⅰ 盛清御瓷新风尚"
              ],
              "stale": false
            }
          }
        },
        {
          "recordId": "rec-poly-2021-yugong-1-nov15",
          "caseId": "poly-2021-autumn",
          "title": "北京保利 · 禹贡Ⅰ—盛清御瓷新风尚（2021年11月15日）",
          "bucket": "refuted",
          "fields": [
            {
              "key": "auctionHouse",
              "label": "拍卖机构",
              "role": "key",
              "value": "北京保利"
            },
            {
              "key": "dateText",
              "label": "举办时间",
              "role": "key",
              "value": "2021年11月15日"
            },
            {
              "key": "sessionName",
              "label": "专场名称",
              "role": "key",
              "value": "禹贡Ⅰ—盛清御瓷新风尚"
            }
          ],
          "evidence": [
            {
              "evidenceId": "ev-poly-0011",
              "fieldKey": "auctionHouse",
              "fieldValue": "北京保利",
              "relation": "supports",
              "quote": "2021年12月5日，北京保利2021秋拍进入到古董珍玩板块。专场“禹贡Ⅰ—盛清御瓷新风尚”涵盖了20余件清三代瓷器珍品。",
              "url": "https://amma.artron.net/observation_shownews.php?newid=1104807",
              "domain": "amma.artron.net",
              "family": "artron.net",
              "tier": "primary",
              "snapshotFile": "snapshots/amma-2021-12-05.txt",
              "fetchedAt": "2026-10-29T00:00:00.000Z",
              "note": null,
              "dimension": "porcelain:auctionHouse",
              "state": "exact",
              "matchedValue": "北京保利"
            },
            {
              "evidenceId": "ev-poly-0012",
              "fieldKey": "sessionName",
              "fieldValue": "禹贡Ⅰ—盛清御瓷新风尚",
              "relation": "supports",
              "quote": "2021年12月5日，北京保利2021秋拍进入到古董珍玩板块。专场“禹贡Ⅰ—盛清御瓷新风尚”涵盖了20余件清三代瓷器珍品。",
              "url": "https://amma.artron.net/observation_shownews.php?newid=1104807",
              "domain": "amma.artron.net",
              "family": "artron.net",
              "tier": "primary",
              "snapshotFile": "snapshots/amma-2021-12-05.txt",
              "fetchedAt": "2026-10-29T00:00:00.000Z",
              "note": null,
              "dimension": "porcelain:sessionName",
              "state": "exact",
              "matchedValue": "禹贡Ⅰ—盛清御瓷新风尚"
            },
            {
              "evidenceId": "ev-poly-0013",
              "fieldKey": "auctionHouse",
              "fieldValue": "北京保利",
              "relation": "supports",
              "quote": "拍賣行：北京保利",
              "url": "https://hk.thevalue.com/articles/poly-auction-beijing-qianlong-yangcai-elephant-robin-egg-glaze-revolving-vase-result",
              "domain": "hk.thevalue.com",
              "family": "thevalue.com",
              "tier": "primary",
              "snapshotFile": "snapshots/thevalue-2021-12-05.txt",
              "fetchedAt": "2026-10-29T00:00:00.000Z",
              "note": null,
              "dimension": "porcelain:auctionHouse",
              "state": "exact",
              "matchedValue": "北京保利"
            },
            {
              "evidenceId": "ev-poly-0014",
              "fieldKey": "sessionName",
              "fieldValue": "禹贡Ⅰ—盛清御瓷新风尚",
              "relation": "supports",
              "quote": "今晚的「禹貢I - 盛清御瓷新風尚」專場合共帶來26件拍品，僅1件流拍，成交率96%，斬獲RMB 2.94億成交總額，共9件拍品以過千萬人民幣成交，成績堅實。",
              "url": "https://hk.thevalue.com/articles/poly-auction-beijing-qianlong-yangcai-elephant-robin-egg-glaze-revolving-vase-result",
              "domain": "hk.thevalue.com",
              "family": "thevalue.com",
              "tier": "primary",
              "snapshotFile": "snapshots/thevalue-2021-12-05.txt",
              "fetchedAt": "2026-10-29T00:00:00.000Z",
              "note": null,
              "dimension": "porcelain:sessionName",
              "state": "exact",
              "matchedValue": "禹貢I - 盛清御瓷新風尚"
            },
            {
              "evidenceId": "ev-poly-0015",
              "fieldKey": "dateText",
              "fieldValue": "2021年11月15日",
              "relation": "refutes",
              "quote": "2021年12月5日，北京保利2021秋拍进入到古董珍玩板块。专场“禹贡Ⅰ—盛清御瓷新风尚”涵盖了20余件清三代瓷器珍品。",
              "url": "https://amma.artron.net/observation_shownews.php?newid=1104807",
              "domain": "amma.artron.net",
              "family": "artron.net",
              "tier": "primary",
              "snapshotFile": "snapshots/amma-2021-12-05.txt",
              "fetchedAt": "2026-10-29T00:00:00.000Z",
              "note": "页面明确写 2021 年 12 月 5 日，与 11 月 15 日冲突",
              "dimension": "porcelain:dateText",
              "state": "conflict",
              "matchedValue": "2021年12月5日"
            },
            {
              "evidenceId": "ev-poly-0016",
              "fieldKey": "dateText",
              "fieldValue": "2021年11月15日",
              "relation": "refutes",
              "quote": "拍賣日期：2021/12/5",
              "url": "https://hk.thevalue.com/articles/poly-auction-beijing-qianlong-yangcai-elephant-robin-egg-glaze-revolving-vase-result",
              "domain": "hk.thevalue.com",
              "family": "thevalue.com",
              "tier": "primary",
              "snapshotFile": "snapshots/thevalue-2021-12-05.txt",
              "fetchedAt": "2026-10-29T00:00:00.000Z",
              "note": "第二个独立来源给出同一日期，反对票达到 E2",
              "dimension": "porcelain:dateText",
              "state": "conflict",
              "matchedValue": "2021/12/5"
            }
          ],
          "computation": {
            "gate": "rejected",
            "reason": "关键字段 cl-rec-poly-2021-yugong-1-nov15-dateText 判为 refuted，整条记录不入坐标库",
            "fieldVerdicts": {
              "auctionHouse": {
                "fieldValue": "北京保利",
                "claimId": "cl-rec-poly-2021-yugong-1-nov15-auctionHouse",
                "verdict": "supported",
                "evidenceGrade": "E2",
                "supportCount": 2,
                "refuteCount": 0,
                "notFoundCause": null,
                "examinedPages": 2,
                "dimensionState": "exact"
              },
              "dateText": {
                "fieldValue": "2021年11月15日",
                "claimId": "cl-rec-poly-2021-yugong-1-nov15-dateText",
                "verdict": "refuted",
                "evidenceGrade": "E2",
                "supportCount": 0,
                "refuteCount": 2,
                "notFoundCause": null,
                "examinedPages": 2,
                "dimensionState": null
              },
              "sessionName": {
                "fieldValue": "禹贡Ⅰ—盛清御瓷新风尚",
                "claimId": "cl-rec-poly-2021-yugong-1-nov15-sessionName",
                "verdict": "supported",
                "evidenceGrade": "E2",
                "supportCount": 2,
                "refuteCount": 0,
                "notFoundCause": null,
                "examinedPages": 2,
                "dimensionState": "exact"
              }
            },
            "keyFieldValues": {
              "auctionHouse": "北京保利",
              "dateText": "2021年11月15日",
              "sessionName": "禹贡Ⅰ—盛清御瓷新风尚"
            },
            "cooccurrence": {
              "count": 0,
              "pages": []
            },
            "dimensionGrade": {
              "grade": "weak",
              "score": 0,
              "basis": "「dateText」明确冲突，先否决强坐标（冲突只作候选，不压成\"反对\"）",
              "conflictDimensions": [
                "dateText"
              ],
              "entries": [
                {
                  "dimension": "porcelain:auctionHouse",
                  "label": "auctionHouse",
                  "state": "exact",
                  "cap": 1
                },
                {
                  "dimension": "porcelain:dateText",
                  "label": "dateText",
                  "state": "conflict",
                  "cap": 1
                },
                {
                  "dimension": "porcelain:sessionName",
                  "label": "sessionName",
                  "state": "exact",
                  "cap": 1
                }
              ]
            },
            "anchor": null
          }
        },
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "title": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
          "bucket": "weak",
          "fields": [
            {
              "key": "auctionHouse",
              "label": "拍卖机构",
              "role": "key",
              "value": "北京保利"
            },
            {
              "key": "dateText",
              "label": "举办时间",
              "role": "key",
              "value": "2021年秋季"
            },
            {
              "key": "sessionName",
              "label": "专场名称",
              "role": "key",
              "value": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术"
            }
          ],
          "evidence": [
            {
              "evidenceId": "ev-poly-0008",
              "fieldKey": "auctionHouse",
              "fieldValue": "北京保利",
              "relation": "supports",
              "quote": "延续春拍佳绩，本次北京保利2021年秋季拍卖会，再次为众藏家奉献了一场无与伦比的艺术盛筵。",
              "url": "https://m.thepaper.cn/newsDetail_forward_15697852",
              "domain": "m.thepaper.cn",
              "family": "artron.net",
              "tier": "primary",
              "snapshotFile": "snapshots/thepaper-2021-12-05.txt",
              "fetchedAt": "2026-10-29T00:00:00.000Z",
              "note": "澎湃号「雅昌艺术网」官方账号转载原创稿（作者李保兴，雅昌艺术网）；sourceFamily 按原创方归并，转载不增加独立来源",
              "dimension": "porcelain:auctionHouse",
              "state": "exact",
              "matchedValue": "北京保利"
            },
            {
              "evidenceId": "ev-poly-0009",
              "fieldKey": "dateText",
              "fieldValue": "2021年秋季",
              "relation": "supports",
              "quote": "延续春拍佳绩，本次北京保利2021年秋季拍卖会，再次为众藏家奉献了一场无与伦比的艺术盛筵。",
              "url": "https://m.thepaper.cn/newsDetail_forward_15697852",
              "domain": "m.thepaper.cn",
              "family": "artron.net",
              "tier": "primary",
              "snapshotFile": "snapshots/thepaper-2021-12-05.txt",
              "fetchedAt": "2026-10-29T00:00:00.000Z",
              "note": "页面只写到 2021 年秋季，没有具体日期；断言也只写到季度，精度相符",
              "dimension": "porcelain:dateText",
              "state": "exact",
              "matchedValue": "2021年秋季"
            },
            {
              "evidenceId": "ev-poly-0010",
              "fieldKey": "sessionName",
              "fieldValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
              "relation": "supports",
              "quote": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
              "url": "https://m.thepaper.cn/newsDetail_forward_15697852",
              "domain": "m.thepaper.cn",
              "family": "artron.net",
              "tier": "primary",
              "snapshotFile": "snapshots/thepaper-2021-12-05.txt",
              "fetchedAt": "2026-10-29T00:00:00.000Z",
              "note": "澎湃号「雅昌艺术网」官方账号转载原创稿；家族归并后仍只有一条独立来源",
              "dimension": "porcelain:sessionName",
              "state": "exact",
              "matchedValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术"
            }
          ],
          "computation": {
            "gate": "weak",
            "reason": "有共现命中页面，但最低证据等级只到 E1（单一独立来源）——不给强坐标",
            "fieldVerdicts": {
              "auctionHouse": {
                "fieldValue": "北京保利",
                "claimId": "cl-rec-poly-2021-yugong-2-auctionHouse",
                "verdict": "supported",
                "evidenceGrade": "E1",
                "supportCount": 1,
                "refuteCount": 0,
                "notFoundCause": null,
                "examinedPages": 1,
                "dimensionState": "exact"
              },
              "dateText": {
                "fieldValue": "2021年秋季",
                "claimId": "cl-rec-poly-2021-yugong-2-dateText",
                "verdict": "supported",
                "evidenceGrade": "E1",
                "supportCount": 1,
                "refuteCount": 0,
                "notFoundCause": null,
                "examinedPages": 1,
                "dimensionState": "exact"
              },
              "sessionName": {
                "fieldValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
                "claimId": "cl-rec-poly-2021-yugong-2-sessionName",
                "verdict": "supported",
                "evidenceGrade": "E1",
                "supportCount": 1,
                "refuteCount": 0,
                "notFoundCause": null,
                "examinedPages": 1,
                "dimensionState": "exact"
              }
            },
            "keyFieldValues": {
              "auctionHouse": "北京保利",
              "dateText": "2021年秋季",
              "sessionName": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术"
            },
            "cooccurrence": {
              "count": 1,
              "pages": [
                "https://m.thepaper.cn/newsDetail_forward_15697852"
              ]
            },
            "dimensionGrade": {
              "grade": "strong",
              "score": 3,
              "basis": "「auctionHouse」「dateText」「sessionName」在各自维度上对上（累计 3，≥ 1.2）",
              "conflictDimensions": [],
              "entries": [
                {
                  "dimension": "porcelain:auctionHouse",
                  "label": "auctionHouse",
                  "state": "exact",
                  "cap": 1
                },
                {
                  "dimension": "porcelain:dateText",
                  "label": "dateText",
                  "state": "exact",
                  "cap": 1
                },
                {
                  "dimension": "porcelain:sessionName",
                  "label": "sessionName",
                  "state": "exact",
                  "cap": 1
                }
              ]
            },
            "anchor": {
              "grade": "weak",
              "evidenceGrade": "E1",
              "urls": [
                "https://m.thepaper.cn/newsDetail_forward_15697852"
              ],
              "searchPhrases": [
                "北京保利 2021秋季拍卖会 禹贡Ⅱ 郎世宁绘纯惠皇贵妃油画像暨重要宫廷艺术",
                "北京保利 禹贡Ⅱ 郎世宁绘纯惠皇贵妃油画像暨重要宫廷艺术"
              ],
              "stale": false
            }
          }
        },
        {
          "recordId": "rec-poly-2021-yugong-3",
          "caseId": "poly-2021-autumn",
          "title": "北京保利 · 禹贡Ⅲ—盛清御瓷新风尚（2021年12月）",
          "bucket": "not_found",
          "fields": [
            {
              "key": "auctionHouse",
              "label": "拍卖机构",
              "role": "key",
              "value": "北京保利"
            },
            {
              "key": "dateText",
              "label": "举办时间",
              "role": "key",
              "value": "2021年12月"
            },
            {
              "key": "sessionName",
              "label": "专场名称",
              "role": "key",
              "value": "禹贡Ⅲ—盛清御瓷新风尚"
            }
          ],
          "evidence": [
            {
              "evidenceId": "ev-poly-0017",
              "fieldKey": "auctionHouse",
              "fieldValue": "北京保利",
              "relation": "supports",
              "quote": "2021年12月5日，北京保利2021秋拍进入到古董珍玩板块。专场“禹贡Ⅰ—盛清御瓷新风尚”涵盖了20余件清三代瓷器珍品。",
              "url": "https://amma.artron.net/observation_shownews.php?newid=1104807",
              "domain": "amma.artron.net",
              "family": "artron.net",
              "tier": "primary",
              "snapshotFile": "snapshots/amma-2021-12-05.txt",
              "fetchedAt": "2026-10-29T00:00:00.000Z",
              "note": "仅证明北京保利在该季办拍；本行不涉及「禹贡Ⅲ」，专场字段另由 sessionName 断言裁决",
              "dimension": "porcelain:auctionHouse",
              "state": "exact",
              "matchedValue": "北京保利"
            },
            {
              "evidenceId": "ev-poly-0018",
              "fieldKey": "dateText",
              "fieldValue": "2021年12月",
              "relation": "supports",
              "quote": "2021年12月5日，北京保利2021秋拍进入到古董珍玩板块。专场“禹贡Ⅰ—盛清御瓷新风尚”涵盖了20余件清三代瓷器珍品。",
              "url": "https://amma.artron.net/observation_shownews.php?newid=1104807",
              "domain": "amma.artron.net",
              "family": "artron.net",
              "tier": "primary",
              "snapshotFile": "snapshots/amma-2021-12-05.txt",
              "fetchedAt": "2026-10-29T00:00:00.000Z",
              "note": "该季拍卖确实在 2021 年 12 月举行；日期成立不等于这个专场存在",
              "dimension": "porcelain:dateText",
              "state": "exact",
              "matchedValue": "2021年12月5日"
            },
            {
              "evidenceId": "ev-poly-0019",
              "fieldKey": "sessionName",
              "fieldValue": "禹贡Ⅲ—盛清御瓷新风尚",
              "relation": "irrelevant",
              "quote": "2021年12月5日，北京保利2021秋拍进入到古董珍玩板块。专场“禹贡Ⅰ—盛清御瓷新风尚”涵盖了20余件清三代瓷器珍品。",
              "url": "https://amma.artron.net/observation_shownews.php?newid=1104807",
              "domain": "amma.artron.net",
              "family": "artron.net",
              "tier": "primary",
              "snapshotFile": "snapshots/amma-2021-12-05.txt",
              "fetchedAt": "2026-10-29T00:00:00.000Z",
              "note": "页面只列「禹贡Ⅰ」，没有「禹贡Ⅲ」；判 irrelevant 不是判假",
              "dimension": "porcelain:sessionName",
              "state": "mismatch",
              "matchedValue": "禹贡Ⅰ—盛清御瓷新风尚"
            },
            {
              "evidenceId": "ev-poly-0020",
              "fieldKey": "auctionHouse",
              "fieldValue": "北京保利",
              "relation": "supports",
              "quote": "拍賣行：北京保利",
              "url": "https://hk.thevalue.com/articles/poly-auction-beijing-qianlong-yangcai-elephant-robin-egg-glaze-revolving-vase-result",
              "domain": "hk.thevalue.com",
              "family": "thevalue.com",
              "tier": "primary",
              "snapshotFile": "snapshots/thevalue-2021-12-05.txt",
              "fetchedAt": "2026-10-29T00:00:00.000Z",
              "note": null,
              "dimension": "porcelain:auctionHouse",
              "state": "exact",
              "matchedValue": "北京保利"
            },
            {
              "evidenceId": "ev-poly-0021",
              "fieldKey": "dateText",
              "fieldValue": "2021年12月",
              "relation": "supports",
              "quote": "拍賣日期：2021/12/5",
              "url": "https://hk.thevalue.com/articles/poly-auction-beijing-qianlong-yangcai-elephant-robin-egg-glaze-revolving-vase-result",
              "domain": "hk.thevalue.com",
              "family": "thevalue.com",
              "tier": "primary",
              "snapshotFile": "snapshots/thevalue-2021-12-05.txt",
              "fetchedAt": "2026-10-29T00:00:00.000Z",
              "note": null,
              "dimension": "porcelain:dateText",
              "state": "exact",
              "matchedValue": "2021/12/5"
            },
            {
              "evidenceId": "ev-poly-0022",
              "fieldKey": "sessionName",
              "fieldValue": "禹贡Ⅲ—盛清御瓷新风尚",
              "relation": "irrelevant",
              "quote": "今晚的「禹貢I - 盛清御瓷新風尚」專場合共帶來26件拍品，僅1件流拍，成交率96%，斬獲RMB 2.94億成交總額，共9件拍品以過千萬人民幣成交，成績堅實。",
              "url": "https://hk.thevalue.com/articles/poly-auction-beijing-qianlong-yangcai-elephant-robin-egg-glaze-revolving-vase-result",
              "domain": "hk.thevalue.com",
              "family": "thevalue.com",
              "tier": "primary",
              "snapshotFile": "snapshots/thevalue-2021-12-05.txt",
              "fetchedAt": "2026-10-29T00:00:00.000Z",
              "note": "页面只列「禹贡Ⅰ」，没有「禹贡Ⅲ」；检索到了相关页面，但没有这条专场的任何说法",
              "dimension": "porcelain:sessionName",
              "state": "mismatch",
              "matchedValue": "禹貢I - 盛清御瓷新風尚"
            }
          ],
          "computation": {
            "gate": "rejected",
            "reason": "关键字段 cl-rec-poly-2021-yugong-3-sessionName 判为 not_found（成因 coverage），整条记录不入坐标库",
            "fieldVerdicts": {
              "auctionHouse": {
                "fieldValue": "北京保利",
                "claimId": "cl-rec-poly-2021-yugong-3-auctionHouse",
                "verdict": "supported",
                "evidenceGrade": "E2",
                "supportCount": 2,
                "refuteCount": 0,
                "notFoundCause": null,
                "examinedPages": 2,
                "dimensionState": "exact"
              },
              "dateText": {
                "fieldValue": "2021年12月",
                "claimId": "cl-rec-poly-2021-yugong-3-dateText",
                "verdict": "supported",
                "evidenceGrade": "E2",
                "supportCount": 2,
                "refuteCount": 0,
                "notFoundCause": null,
                "examinedPages": 2,
                "dimensionState": "exact"
              },
              "sessionName": {
                "fieldValue": "禹贡Ⅲ—盛清御瓷新风尚",
                "claimId": "cl-rec-poly-2021-yugong-3-sessionName",
                "verdict": "not_found",
                "evidenceGrade": "E0",
                "supportCount": 0,
                "refuteCount": 0,
                "notFoundCause": "coverage",
                "examinedPages": 2,
                "dimensionState": null
              }
            },
            "keyFieldValues": {
              "auctionHouse": "北京保利",
              "dateText": "2021年12月",
              "sessionName": "禹贡Ⅲ—盛清御瓷新风尚"
            },
            "cooccurrence": {
              "count": 0,
              "pages": []
            },
            "dimensionGrade": {
              "grade": "strong",
              "score": 2,
              "basis": "「auctionHouse」「dateText」在各自维度上对上（累计 2，≥ 1.2）",
              "conflictDimensions": [],
              "entries": [
                {
                  "dimension": "porcelain:auctionHouse",
                  "label": "auctionHouse",
                  "state": "exact",
                  "cap": 1
                },
                {
                  "dimension": "porcelain:dateText",
                  "label": "dateText",
                  "state": "exact",
                  "cap": 1
                },
                {
                  "dimension": "porcelain:sessionName",
                  "label": "sessionName",
                  "state": "mismatch",
                  "cap": 1
                }
              ]
            },
            "anchor": null
          }
        }
      ]
    },
    {
      "id": "demo-batch-1",
      "title": "2022 年「中国古董珍玩」专场（在线采集冻结）",
      "subtitle": "一次 full 模式的真实采集：机构没查到、日期与专场名各只有一条来源，整条记录不入坐标库",
      "query": "2020至2022年，中国古董珍玩拍卖专场：拍卖机构、举办时间、专场名称",
      "capturedAt": "2026-11-04",
      "sources": [
        {
          "url": "http://www.ikck.com/article-7665",
          "publisher": "www.ikck.com",
          "family": "ikck.com",
          "tier": "unlisted",
          "snapshotFile": "snapshots/page-00903b.txt",
          "excerpt": "【节选·非全文】\n来源：www.ikck.com\n原文：http://www.ikck.com/article-7665\n抓取：2026-11-04T09:18:55.473Z · Lodestar 自抓（渲染后本地抽取正文）\n裁剪：保留含引文的段落与直接上下文；全文 16000 字 → 本节选 540 字\n指纹：全文 SHA-256 ac9152d95d6475e05baa8849d62c5ab137d955b75be48ab68ea79dc6bb6f1070\n说明：本文件不是原文全文。导航、广告、推荐位与页脚已删除；省略处用「……」标出。\n────────────────────────────────────────\n……v><section><div><div><div><div><div><div><h1>北京保利2022秋拍丨瓷珍妙境，唐窑天工</h1><ul><li><i></i>北京保利拍卖</li><li><i></i> 2023年2月01日08时</li></ul><div><div><section><section><section><section><section><section><section><section><section><section><section><p><br></p><p><span>北京保利2022秋季艺术品拍卖会</span></p><p><span>中国古董珍玩专场日程安排</span></p></section><section><br></section></section></section></section></section><p><span><strong>【预展时间】</strong></span></p><p><span>2023年2月18日至各专场拍卖前一日</span></p><p><span><strong>【预展地点】</strong></span></p><p><span>北京国贸大酒店</s……\n"
        },
        {
          "url": "http://wx.ttp.51bidlive.com/news/detail?id=4814",
          "publisher": "wx.ttp.51bidlive.com",
          "family": "51bidlive.com",
          "tier": "unlisted",
          "snapshotFile": "snapshots/page-6bfad1.txt",
          "excerpt": "【节选·非全文】\n来源：wx.ttp.51bidlive.com\n原文：http://wx.ttp.51bidlive.com/news/detail?id=4814\n抓取：2026-11-04T09:15:51.383Z · Lodestar 自抓（渲染后本地抽取正文）\n裁剪：保留含引文的段落与直接上下文；全文 16000 字 → 本节选 556 字\n指纹：全文 SHA-256 011ebb164c6b2e03d4a839a2bfc71f66bd6561e34efeff66ac1a2cfd286ce3d1\n说明：本文件不是原文全文。导航、广告、推荐位与页脚已删除；省略处用「……」标出。\n────────────────────────────────────────\n……strong><span>尺寸：高 19cm；直径 26cm</span></strong></span></p><p><span><strong><span>拍品估价：24,000,000 - 30,000,000 港币</span></strong></span></p><p><span><strong><span>成交价格：22,200,000 港币（约合1954.3万<strong>人民币</strong>）</span></strong></span></p><p><span><strong><span>保利香港2022年秋季拍卖会，中国古董珍玩专场，Lot 3037</span></strong></span></p><p><span>来源：</span></p><p><span>1. 香港苏富比，1996年11月5日，编号721</span></p><p><span>2. 德韾书屋，台北</span></p><p><span>3. 纽约苏富比，2008年3月18日，编号91</span></p><p><span>4. 香港苏富比，2013年4月8日，编号3046</span></p><p><span>5. 纽约佳士得，2019年3月22日，编号1723</span></p>……\n"
        },
        {
          "url": "https://artpro.com/auction-house/129",
          "publisher": "artpro.com",
          "family": "artpro.com",
          "tier": "aggregator",
          "snapshotFile": "snapshots/page-84e44a.txt",
          "excerpt": "【节选·非全文】\n来源：artpro.com\n原文：https://artpro.com/auction-house/129\n抓取：2026-11-04T09:14:50.697Z · Lodestar 自抓（渲染后本地抽取正文）\n裁剪：保留含引文的段落与直接上下文；全文 1544 字 → 本节选 578 字\n指纹：全文 SHA-256 42f668338f0cfe4396450e04ef15178de4f8de01846df15e7f21884d35a534e5\n说明：本文件不是原文全文。导航、广告、推荐位与页脚已删除；省略处用「……」标出。\n────────────────────────────────────────\n……<div><div>语言</div></div><div><div><a>登录/注册</a></div></div><div><a>意见反馈</a></div></div></div><div><div><div><div><span><a>首页</a></span><span><a>拍行</a></span><span><span>保利</span></span></div><div><div><div><img></div><div>保利</div></div><div><div><div><div><div>北京保利国际拍卖有限公司成立于2005年，是中国保利集团下属保利文化集团股份有限公司旗下专业艺术品拍卖平台。公司主营中国及西方艺术品拍卖业务，业务内容涵盖中国书画、古代书画（含古籍文献）、中国古董珍玩、现当代艺术、珠宝钟表尚品、邮品钱币、名酒茗品等。 北京保利拍卖拥有业务精深、信誉良好的专家团队，积累了全球大量优质客户资源，致力于为客户提供涵盖拍卖、私人洽购等在内的艺术品交易全产业链服务。公司下设保利厦门拍卖、保利山东拍卖等分支机构，业务网络覆盖亚洲、欧洲及北美多地。 依托保利集团和保利文化强大的资源优势，有赖于全球藏家的鼎力支持，北京保利拍卖通过不断细分市场，积极创新拍卖方式，努力优化拍品结构，持续精进业务水平，近年来……\n"
        },
        {
          "url": "https://auctiondaily.com/auction-house/poly-auction/",
          "publisher": "auctiondaily.com",
          "family": "auctiondaily.com",
          "tier": "unlisted",
          "snapshotFile": "snapshots/page-d00dcc.txt",
          "excerpt": "【节选·非全文】\n来源：auctiondaily.com\n原文：https://auctiondaily.com/auction-house/poly-auction/\n抓取：2026-11-04T09:17:13.079Z · Lodestar 自抓（渲染后本地抽取正文）\n裁剪：保留含引文的段落与直接上下文；全文 16000 字 → 本节选 612 字\n指纹：全文 SHA-256 0f2147b270065beb97f5da5adb6bdffe2896ed06cabafcc7f8d3c8db7bb7bdcc\n说明：本文件不是原文全文。导航、广告、推荐位与页脚已删除；省略处用「……」标出。\n────────────────────────────────────────\n……sold for HKD 28.2 million (USD 3.5 million). Image courtesy of Poly Auction Hong Kong. Hong Kong-based seller Poly Auction started its journey in 2012. Within ten years, it has secured a leading position in an industry reigned by centuries-old auction houses. To celebrate its 10th anniversary, Poly Auction Hong Kong held a five-day auction event. The auction attained an impressive sale total of more than HKD 1 billion (USD 127 million). The sale included high-profile lots across six departments– Modern and contemporary art, jewels and watches, Chinese ceramics and art, fine Chinese paintings and calli……\n"
        },
        {
          "url": "https://m-news.artron.net/20201222/n1132545.html",
          "publisher": "m-news.artron.net",
          "family": "artron.net",
          "tier": "primary",
          "snapshotFile": "snapshots/page-704f73.txt",
          "excerpt": "【节选·非全文】\n来源：m-news.artron.net\n原文：https://m-news.artron.net/20201222/n1132545.html\n抓取：2026-11-04T09:14:20.974Z · Lodestar 自抓（渲染后本地抽取正文）\n裁剪：保留含引文的段落与直接上下文；全文 16000 字 → 本节选 753 字\n指纹：全文 SHA-256 ed8fcf07ff57e009cbfe1fa9462cedcaf749c044ac79005169f247af5d64f42e\n说明：本文件不是原文全文。导航、广告、推荐位与页脚已删除；省略处用「……」标出。\n────────────────────────────────────────\n……span><b><img>“纤维”提问2022：存在何“缓”？</b></span><span>立即阅读</span></a></li><li><a><span><b><img>春雨斋主人房茂梁：“好运气”的90后古玩经纪人</b></span><span>立即阅读</span></a></li></ul></div><article><a><img></a><div><a>艺术网<span>></span></a><a>新闻<span>></span></a><a>战报</a></div><header><h1>北京保利拍卖2024春拍圆满收官</h1></header><p><span>2024-06-18 18:32:50</span><span>孟语 </span></p><div><a><i><strong>[北京保利]中国书画夜场</strong><span>2024-06-13</span></i><b>点击查看</b></a></div><section><div><p>6月9日-15日，北京保利2024年春季艺术品拍卖会主阶段各专场拍卖圆满收官。本季拍卖各经典夜场依旧亮眼，其他板块也精品不断，7大门类、25个专场、4000余件艺术精品，实现成交总额7.34亿元，超千万元成交拍品7件，58%拍品超高估价成交，落槌总额为低估价131.05%。</p><p><span><strong>中国书画 总成交额1.865亿元</strong></span></p><p>中国书画板块五大专场总成交额1.865亿元，2件拍品超千万元成交，2件拍品超五百万元成交。热络的买气在傅抱石里程碑式代表作《江山如此多娇》的竞拍中尤为明显，其以6382.5万元成交，领衔中国书画板块。高端……\n"
        },
        {
          "url": "https://www.artzww.com/art2017art/wap_doc/24053865.html",
          "publisher": "www.artzww.com",
          "family": "artzww.com",
          "tier": "unlisted",
          "snapshotFile": "snapshots/page-ddbb3b.txt",
          "excerpt": "【节选·非全文】\n来源：www.artzww.com\n原文：https://www.artzww.com/art2017art/wap_doc/24053865.html\n抓取：2026-11-04T09:16:38.166Z · Lodestar 自抓（渲染后本地抽取正文）\n裁剪：保留含引文的段落与直接上下文；全文 16000 字 → 本节选 443 字\n指纹：全文 SHA-256 a6056c82fd9d7da043140902d5d2d7ef7935dba98426e168b0b118e5e9cb26ba\n说明：本文件不是原文全文。导航、广告、推荐位与页脚已删除；省略处用「……」标出。\n────────────────────────────────────────\n<div><div><div><a><img></a></div></div><div><div><input><h2>北京保利拍卖2022春拍精品展登场，七大门类重磅拍品荟萃</h2><div><p>2022年6月24日上午，北京保利拍卖2022春拍精品展在时间博物馆正式启幕，经过精心筹备，本次为期十天的精品展特别甄选七大门类近三百件春拍重磅拍品，以飨藏家。</p><p><img><br></p><p>北京保利拍卖2022春拍精品展现场</p><p><img><br></p><p>北京保利拍卖2022春拍精品展现场</p><p>“北京保利拍卖2022春拍精品导赏直播活动”也于同日举行，各部门专家导览北京保利拍卖2022春拍中国书画，古代书画，中国古董珍玩，现当代艺术，珠宝钟表尚品，名酒茗品，邮品钱币等板块精品。</p><p>作为连续数年稳居全国文物拍卖企业成交额首位的拍卖行业龙头企业，北京保利拍卖去年共完成线上、线下拍卖会28场，缔造6件亿元拍品、124件超千万元拍品……\n"
        }
      ],
      "records": [
        {
          "recordId": "rec-20261104-f584a0",
          "caseId": "demo-batch-1",
          "title": "保利香港拍賣 · 中國古董珍玩專場（2022年7月14日）",
          "bucket": "not_found",
          "fields": [
            {
              "key": "auctionHouse",
              "label": "拍卖机构",
              "role": "key",
              "value": "保利香港拍賣"
            },
            {
              "key": "dateText",
              "label": "举办时间",
              "role": "key",
              "value": "2022年7月14日"
            },
            {
              "key": "sessionName",
              "label": "专场名称",
              "role": "key",
              "value": "中國古董珍玩專場"
            }
          ],
          "evidence": [
            {
              "evidenceId": "ev-20261104-704f73",
              "fieldKey": "auctionHouse",
              "fieldValue": "保利香港拍賣",
              "relation": "irrelevant",
              "quote": "北京保利拍卖2024春拍圆满收官",
              "url": "https://m-news.artron.net/20201222/n1132545.html",
              "domain": "m-news.artron.net",
              "family": "artron.net",
              "tier": "primary",
              "snapshotFile": "snapshots/page-704f73.txt",
              "fetchedAt": "2026-11-04T09:14:20.974Z",
              "note": "页面主题：该页面报道的是北京保利2024年春季艺术品拍卖会的收官战报及成交详情。",
              "dimension": "porcelain:auctionHouse",
              "state": "conflict",
              "matchedValue": "北京保利"
            },
            {
              "evidenceId": "ev-20261104-84e44a",
              "fieldKey": "auctionHouse",
              "fieldValue": "保利香港拍賣",
              "relation": "irrelevant",
              "quote": "北京保利国际拍卖有限公司成立于2005年，是中国保利集团下属保利文化集团股份有限公司旗下专业艺术品拍卖平台。",
              "url": "https://artpro.com/auction-house/129",
              "domain": "artpro.com",
              "family": "artpro.com",
              "tier": "aggregator",
              "snapshotFile": "snapshots/page-84e44a.txt",
              "fetchedAt": "2026-11-04T09:14:50.697Z",
              "note": "页面主题：该页面为北京保利国际拍卖有限公司的机构简介与业务范围介绍。",
              "dimension": "porcelain:auctionHouse",
              "state": "conflict",
              "matchedValue": "北京保利"
            },
            {
              "evidenceId": "ev-20261104-c29d0f",
              "fieldKey": "dateText",
              "fieldValue": "2022年7月14日",
              "relation": "irrelevant",
              "quote": "6月9日-15日，北京保利2024年春季艺术品拍卖会主阶段各专场拍卖圆满收官。",
              "url": "https://m-news.artron.net/20201222/n1132545.html",
              "domain": "m-news.artron.net",
              "family": "artron.net",
              "tier": "primary",
              "snapshotFile": "snapshots/page-704f73.txt",
              "fetchedAt": "2026-11-04T09:14:20.974Z",
              "note": "页面主题：该页面是一篇报道北京保利2024年春季艺术品拍卖会圆满收官及各板块成交情况的新闻战报。",
              "dimension": "porcelain:dateText",
              "state": "conflict",
              "matchedValue": "2024年春季"
            },
            {
              "evidenceId": "ev-20261104-6bfad1",
              "fieldKey": "dateText",
              "fieldValue": "2022年7月14日",
              "relation": "supports",
              "quote": "保利香港2022年秋季拍卖会，中国古董珍玩专场，Lot 3037",
              "url": "http://wx.ttp.51bidlive.com/news/detail?id=4814",
              "domain": "wx.ttp.51bidlive.com",
              "family": "51bidlive.com",
              "tier": "unlisted",
              "snapshotFile": "snapshots/page-6bfad1.txt",
              "fetchedAt": "2026-11-04T09:15:51.383Z",
              "note": "页面主题：盘点2022年度艺术品拍卖市场高价成交瓷器及相关信息的行业回顾文章",
              "dimension": "porcelain:dateText",
              "state": "conflict",
              "matchedValue": "2022年秋季"
            },
            {
              "evidenceId": "ev-20261104-ddbb3b",
              "fieldKey": "dateText",
              "fieldValue": "2022年7月14日",
              "relation": "irrelevant",
              "quote": "北京保利拍卖2022春拍精品展在时间博物馆正式启幕，经过精心筹备，本次为期十天的精品展特别甄选七大门类近三百件春拍重磅拍品，以飨藏家。",
              "url": "https://www.artzww.com/art2017art/wap_doc/24053865.html",
              "domain": "www.artzww.com",
              "family": "artzww.com",
              "tier": "unlisted",
              "snapshotFile": "snapshots/page-ddbb3b.txt",
              "fetchedAt": "2026-11-04T09:16:38.166Z",
              "note": "页面主题：介绍北京保利拍卖2022年春季拍卖会精品展启幕情况及各品类拍品亮点",
              "dimension": "porcelain:dateText",
              "state": "edge",
              "matchedValue": "2022春拍"
            },
            {
              "evidenceId": "ev-20261104-d00dcc",
              "fieldKey": "dateText",
              "fieldValue": "2022年7月14日",
              "relation": "irrelevant",
              "quote": "To celebrate its 10th anniversary, Poly Auction Hong Kong held a five-day auction event.",
              "url": "https://auctiondaily.com/auction-house/poly-auction/",
              "domain": "auctiondaily.com",
              "family": "auctiondaily.com",
              "tier": "unlisted",
              "snapshotFile": "snapshots/page-d00dcc.txt",
              "fetchedAt": "2026-11-04T09:17:13.079Z",
              "note": "页面主题：介绍保利拍卖（香港）的公司背景及其2021至2022年间的拍卖市场动态与新闻摘要",
              "dimension": null,
              "state": "unknown",
              "matchedValue": null
            },
            {
              "evidenceId": "ev-20261104-d92ad2",
              "fieldKey": "sessionName",
              "fieldValue": "中國古董珍玩專場",
              "relation": "irrelevant",
              "quote": "6月9日-15日，北京保利2024年春季艺术品拍卖会主阶段各专场拍卖圆满收官。",
              "url": "https://m-news.artron.net/20201222/n1132545.html",
              "domain": "m-news.artron.net",
              "family": "artron.net",
              "tier": "primary",
              "snapshotFile": "snapshots/page-704f73.txt",
              "fetchedAt": "2026-11-04T09:14:20.974Z",
              "note": "页面主题：介绍北京保利2024年春季艺术品拍卖会的整体成交情况及各专场拍品详情",
              "dimension": "porcelain:sessionName",
              "state": "mismatch",
              "matchedValue": "6月9日-15日，北京保利2024年春季艺术品拍卖会主阶段各专场拍卖圆满收官。"
            },
            {
              "evidenceId": "ev-20261104-eff79b",
              "fieldKey": "sessionName",
              "fieldValue": "中國古董珍玩專場",
              "relation": "supports",
              "quote": "保利香港2022年秋季拍卖会，中国古董珍玩专场，Lot 3037",
              "url": "http://wx.ttp.51bidlive.com/news/detail?id=4814",
              "domain": "wx.ttp.51bidlive.com",
              "family": "51bidlive.com",
              "tier": "unlisted",
              "snapshotFile": "snapshots/page-6bfad1.txt",
              "fetchedAt": "2026-11-04T09:15:51.383Z",
              "note": "页面主题：盘点2022年度艺术品市场高价成交瓷器排行榜及相关拍品来源信息",
              "dimension": "porcelain:sessionName",
              "state": "caliber",
              "matchedValue": "保利香港2022年秋季拍卖会，中国古董珍玩专场，Lot 3037"
            },
            {
              "evidenceId": "ev-20261104-00903b",
              "fieldKey": "sessionName",
              "fieldValue": "中國古董珍玩專場",
              "relation": "irrelevant",
              "quote": "北京保利2022秋季艺术品拍卖会",
              "url": "http://www.ikck.com/article-7665",
              "domain": "www.ikck.com",
              "family": "ikck.com",
              "tier": "unlisted",
              "snapshotFile": "snapshots/page-00903b.txt",
              "fetchedAt": "2026-11-04T09:18:55.473Z",
              "note": "页面主题：该页面讲的是北京保利2022年秋季艺术品拍卖会（含中国古董珍玩专场）的日程安排与拍品介绍",
              "dimension": "porcelain:sessionName",
              "state": "mismatch",
              "matchedValue": "北京保利2022秋季艺术品拍卖会"
            }
          ],
          "computation": {
            "gate": "rejected",
            "reason": "关键字段 cl-rec-20261104-f584a0-auctionHouse 判为 not_found（成因 coverage），整条记录不入坐标库",
            "fieldVerdicts": {
              "auctionHouse": {
                "fieldValue": "保利香港拍賣",
                "claimId": "cl-rec-20261104-f584a0-auctionHouse",
                "verdict": "not_found",
                "evidenceGrade": "E0",
                "supportCount": 0,
                "refuteCount": 0,
                "notFoundCause": "coverage",
                "examinedPages": 2,
                "dimensionState": null
              },
              "dateText": {
                "fieldValue": "2022年7月14日",
                "claimId": "cl-rec-20261104-f584a0-dateText",
                "verdict": "supported",
                "evidenceGrade": "E1",
                "supportCount": 1,
                "refuteCount": 0,
                "notFoundCause": null,
                "examinedPages": 4,
                "dimensionState": "conflict"
              },
              "sessionName": {
                "fieldValue": "中國古董珍玩專場",
                "claimId": "cl-rec-20261104-f584a0-sessionName",
                "verdict": "supported",
                "evidenceGrade": "E1",
                "supportCount": 1,
                "refuteCount": 0,
                "notFoundCause": null,
                "examinedPages": 3,
                "dimensionState": "caliber"
              }
            },
            "keyFieldValues": {
              "auctionHouse": "保利香港拍賣",
              "dateText": "2022年7月14日",
              "sessionName": "中國古董珍玩專場"
            },
            "cooccurrence": {
              "count": 0,
              "pages": []
            },
            "dimensionGrade": {
              "grade": "weak",
              "score": 0,
              "basis": "「auctionHouse」「dateText」明确冲突，先否决强坐标（冲突只作候选，不压成\"反对\"）",
              "conflictDimensions": [
                "auctionHouse",
                "dateText"
              ],
              "entries": [
                {
                  "dimension": "porcelain:auctionHouse",
                  "label": "auctionHouse",
                  "state": "conflict",
                  "cap": 1
                },
                {
                  "dimension": "porcelain:dateText",
                  "label": "dateText",
                  "state": "conflict",
                  "cap": 1
                },
                {
                  "dimension": "porcelain:sessionName",
                  "label": "sessionName",
                  "state": "caliber",
                  "cap": 1
                }
              ]
            },
            "anchor": null
          }
        }
      ]
    },
    {
      "id": "demo-batch-11",
      "title": "2021 年保利「禹贡Ⅰ」专场（在线采集冻结）",
      "subtitle": "一次 full 模式的真实采集：三项关键字段都被支持，但只有一条独立来源——只到弱档，不给强坐标",
      "query": "2021年12月5日北京保利「禹贡Ⅰ—盛清御瓷新风尚」专场的拍卖机构、举办时间、专场名称是什么？",
      "capturedAt": "2026-11-04",
      "sources": [
        {
          "url": "http://wx.ttp.51bidlive.com/news/detail?id=4516",
          "publisher": "wx.ttp.51bidlive.com",
          "family": "51bidlive.com",
          "tier": "unlisted",
          "snapshotFile": "snapshots/page-0646fe.txt",
          "excerpt": "【节选·非全文】\n来源：wx.ttp.51bidlive.com\n原文：http://wx.ttp.51bidlive.com/news/detail?id=4516\n抓取：2026-11-04T10:13:13.708Z · Lodestar 自抓（渲染后本地抽取正文）\n裁剪：保留含引文的段落与直接上下文；全文 16000 字 → 本节选 549 字\n指纹：全文 SHA-256 24df30aceb6a734de8b7ea2f4d0fe6e37d4f15289452c516e151754da47a6d90\n说明：本文件不是原文全文。导航、广告、推荐位与页脚已删除；省略处用「……」标出。\n────────────────────────────────────────\n……an><strong><span>《大清乾隆年制》款</span></strong></span></p><p><span><strong><span>成交价格：82,225,000 人民币</span></strong></span></p><p><span><strong><span>估价待询</span></strong></span></p><p><span><strong><span>尺寸：高 40.2cm</span></strong></span></p><p><span><strong><span>北京保利2021秋季拍卖会 禹贡Ⅰ—盛清御瓷新风尚 Lot 5537</span></strong></span></p><p><span>著录：首都博物馆编，《香江雅集——香港回归祖国20周年特展》，文物出版社，2018年，编号195</span></p><p><span>展览：</span></p><p><span>1.《香江雅集——香港回归祖国20周年特展》，2017年9月30日-12月3日</span></p><p><span>2. 保利艺术研究院、保利艺术博物馆，“弘历的世界II——郎世宁绘《纯惠皇贵妃油画像》暨18世纪盛清宫廷艺术的西洋风”，北京，20……\n"
        },
        {
          "url": "https://artpro.com/news/31111",
          "publisher": "artpro.com",
          "family": "artpro.com",
          "tier": "aggregator",
          "snapshotFile": "snapshots/page-6897fd.txt",
          "excerpt": "【节选·非全文】\n来源：artpro.com\n原文：https://artpro.com/news/31111\n抓取：2026-11-04T10:10:54.345Z · Lodestar 自抓（渲染后本地抽取正文）\n裁剪：保留含引文的段落与直接上下文；全文 5007 字 → 本节选 599 字\n指纹：全文 SHA-256 113477c2cf6d09290f1b6875cd77a935aed1b81de736236c4e73186f5025dbf1\n说明：本文件不是原文全文。导航、广告、推荐位与页脚已删除；省略处用「……」标出。\n────────────────────────────────────────\n……a></div></div></div><div><div><div><div><span><a>首页</a></span><span><a>艺术资讯</a></span><span><span>【2021秋拍总结】北京保利拍卖2021秋拍总成交额33.5亿元 圆满收官</span></span></div><div><div><div><div><p>【2021秋拍总结】北京保利拍卖2021秋拍总成交额33.5亿元 圆满收官</p><div>2021.12.14 16:00</div></div><div><p>2021年12月2日-6日，经过5天的鏖战，北京保利拍卖2021秋季艺术品拍卖会以<strong>总成交额 33.5 亿元圆满收官</strong>。本季秋拍，共产生 <strong>1 件亿元拍品，66 件千万级拍品</strong>。</p></div><div><p>其中，现当代艺术夜场由9件作品组成的“曾梵志艺术专题”斩获了近1.236亿元的总成交额，首现拍场的《祈祷》《智者》分别以3795万元、3565万元成交；中国书画夜场由傅抱石《为罗时慧作柳荫仕女图》领衔共斩获8.1亿元人民币；古代书画夜场的王振鹏《锦标图》以7590万元高价成交，缔造王振鹏个人的第二高价，宋拓《宋御府拓定武兰亭卷——游相兰亭甲之一》以5750万元成交；中国古董珍玩夜场的明末清初 ……\n"
        },
        {
          "url": "https://m-news.artron.net/news/20260915/n1940787.html",
          "publisher": "m-news.artron.net",
          "family": "artron.net",
          "tier": "primary",
          "snapshotFile": "snapshots/page-b03445.txt",
          "excerpt": "【节选·非全文】\n来源：m-news.artron.net\n原文：https://m-news.artron.net/news/20260915/n1940787.html\n抓取：2026-11-04T10:10:12.803Z · Lodestar 自抓（渲染后本地抽取正文）\n裁剪：保留含引文的段落与直接上下文；全文 16000 字 → 本节选 587 字\n指纹：全文 SHA-256 2554c02600fedd21ad058fb1d0f8c2beafaef294cfa94ed7fba935e20f90c685\n说明：本文件不是原文全文。导航、广告、推荐位与页脚已删除；省略处用「……」标出。\n────────────────────────────────────────\n……乾隆时期的御窑瓷器攀上了前所未有的高峰。雍正六年唐英奉命前往景德镇协助年希尧佐理陶务，第二年即派遣幕友吴尧圃前往调查钧窑釉料的配制方法，日后据以研制出数种釉色。雍正十三年（1735）唐英著《陶成纪事》所载新创仿古采今之各式釉色57种，并呈“岁例贡御”，逐成一朝颜色釉之美，在中国陶瓷史上写下了光辉灿烂的一页。尤其是始见于清雍正年间的“炉钧釉”出窑色釉各异，流淌变幻莫测，绝无两件相同，件件别具一格。</span></p><div><div><a><div><div><div><img></div></div><div><h3><span>预展</span>禹贡Ⅰ—盛清御瓷新风尚</h3><p>北京保利</p><p>2021-12-05</p><p>北京东城区朝阳门北大街1号新保利大厦三层</p></div></div></a></div><p><span>本次在</span><strong><span>“</span><span>禹贡Ⅰ—盛清御瓷新风尚”</span></strong><span>专场</span><span>上拍的<strong>清乾隆〈胭脂红地轧道洋彩缠枝花卉套炉钧釉象耳转心瓶〉</strong>的每一用色及纹饰精工至极，独具西洋韵味的缠枝花卉，胭脂红釉色为底的颈部，两侧收紧处饰有造型灵动的双象耳，象首的肤纹褶皱刻画极为细腻，象鼻轻……\n"
        },
        {
          "url": "https://www.sothebys.com/en/buy/auction/2021/the-three-emperors-imperial-porcelain-of-the-kangxi-yongzheng-and-qianlong-reigns-from-the-yidetang-collection",
          "publisher": "www.sothebys.com",
          "family": "sothebys.com",
          "tier": "official",
          "snapshotFile": "snapshots/page-8e90b7.txt",
          "excerpt": "【节选·非全文】\n来源：www.sothebys.com\n原文：https://www.sothebys.com/en/buy/auction/2021/the-three-emperors-imperial-porcelain-of-the-kangxi-yongzheng-and-qianlong-reigns-from-the-yidetang-collection\n抓取：2026-11-04T10:10:05.695Z · Lodestar 自抓（渲染后本地抽取正文）\n裁剪：保留含引文的段落与直接上下文；全文 16000 字 → 本节选 636 字\n指纹：全文 SHA-256 27d35a2a96022c45f00535b633b8965db965df65a9aeb310499e4b2ec1c7522a\n说明：本文件不是原文全文。导航、广告、推荐位与页脚已删除；省略处用「……」标出。\n────────────────────────────────────────\n……><div><div>Top Searches</div></div></div></form></div></div></div><div><a><span>Go to My Favorites</span></a></div><div><a><span>Items in Shopping Bag:</span><span>0</span></a></div></div></div></div><div><div><div><div><div><div><div><img></div><div><div><h1>The Three Emperors: Imperial Porcelain of the Kangxi, Yongzheng and Qianlong reigns from the Yidetang Collection</h1><h1>The Three Emperors: Imperial Porcelain of the Kangxi, Yongzheng and Qianlong reigns from the Yidetang Collection</h1><h1>The Three Emperors: Imperial Porcelain of the Kangxi, Yongzheng and Qianlong reigns from the Yidetang Collection</h1><div><p>Aucti……\n"
        }
      ],
      "records": [
        {
          "recordId": "rec-20261104-a8e3db",
          "caseId": "demo-batch-11",
          "title": "北京保利 · 禹贡Ⅰ—盛清御瓷新风尚（2021年12月5日）",
          "bucket": "weak",
          "fields": [
            {
              "key": "auctionHouse",
              "label": "拍卖机构",
              "role": "key",
              "value": "北京保利"
            },
            {
              "key": "dateText",
              "label": "举办时间",
              "role": "key",
              "value": "2021年12月5日"
            },
            {
              "key": "sessionName",
              "label": "专场名称",
              "role": "key",
              "value": "禹贡Ⅰ—盛清御瓷新风尚"
            }
          ],
          "evidence": [
            {
              "evidenceId": "ev-20261104-b03445",
              "fieldKey": "auctionHouse",
              "fieldValue": "北京保利",
              "relation": "supports",
              "quote": "禹贡Ⅰ—盛清御瓷新风尚 北京保利 2021-12-05",
              "url": "https://m-news.artron.net/news/20260915/n1940787.html",
              "domain": "m-news.artron.net",
              "family": "artron.net",
              "tier": "primary",
              "snapshotFile": "snapshots/page-b03445.txt",
              "fetchedAt": "2026-11-04T10:10:12.803Z",
              "note": "页面主题：介绍北京保利2021秋季拍卖会中国古董珍玩板块的专场设置与重点拍品",
              "dimension": "porcelain:auctionHouse",
              "state": "exact",
              "matchedValue": "北京保利"
            },
            {
              "evidenceId": "ev-20261104-6897fd",
              "fieldKey": "auctionHouse",
              "fieldValue": "北京保利",
              "relation": "irrelevant",
              "quote": "2021年12月2日-6日，经过5天的鏖战，北京保利拍卖2021秋季艺术品拍卖会以总成交额 33.5 亿元圆满收官。",
              "url": "https://artpro.com/news/31111",
              "domain": "artpro.com",
              "family": "artpro.com",
              "tier": "aggregator",
              "snapshotFile": "snapshots/page-6897fd.txt",
              "fetchedAt": "2026-11-04T10:10:54.345Z",
              "note": "页面主题：北京保利拍卖2021秋季艺术品拍卖会的整体成交总结与部分重点拍品回顾。",
              "dimension": "porcelain:auctionHouse",
              "state": "exact",
              "matchedValue": "北京保利"
            },
            {
              "evidenceId": "ev-20261104-8e90b7",
              "fieldKey": "dateText",
              "fieldValue": "2021年12月5日",
              "relation": "irrelevant",
              "quote": "The Three Emperors: Imperial Porcelain of the Kangxi, Yongzheng and Qianlong reigns from the Yidetang Collection",
              "url": "https://www.sothebys.com/en/buy/auction/2021/the-three-emperors-imperial-porcelain-of-the-kangxi-yongzheng-and-qianlong-reigns-from-the-yidetang-collection",
              "domain": "www.sothebys.com",
              "family": "sothebys.com",
              "tier": "official",
              "snapshotFile": "snapshots/page-8e90b7.txt",
              "fetchedAt": "2026-11-04T10:10:05.695Z",
              "note": "页面主题：苏富比2021年10月在香港举办的“一德堂藏康熙、雍正、乾隆朝御瓷”拍卖专场结果页",
              "dimension": null,
              "state": "unknown",
              "matchedValue": null
            },
            {
              "evidenceId": "ev-20261104-fb0344",
              "fieldKey": "dateText",
              "fieldValue": "2021年12月5日",
              "relation": "supports",
              "quote": "预展禹贡Ⅰ—盛清御瓷新风尚 北京保利 2021-12-05",
              "url": "https://m-news.artron.net/news/20260915/n1940787.html",
              "domain": "m-news.artron.net",
              "family": "artron.net",
              "tier": "primary",
              "snapshotFile": "snapshots/page-b03445.txt",
              "fetchedAt": "2026-11-04T10:10:12.803Z",
              "note": "页面主题：介绍北京保利2021年秋季拍卖会中国古董珍玩板块各专场亮点及拍品信息的资讯页面",
              "dimension": "porcelain:dateText",
              "state": "exact",
              "matchedValue": "2021-12-05"
            },
            {
              "evidenceId": "ev-20261104-3b6162",
              "fieldKey": "dateText",
              "fieldValue": "2021年12月5日",
              "relation": "irrelevant",
              "quote": "2021年12月2日-6日，经过5天的鏖战，北京保利拍卖2021秋季艺术品拍卖会以总成交额 33.5 亿元圆满收官。",
              "url": "https://artpro.com/news/31111",
              "domain": "artpro.com",
              "family": "artpro.com",
              "tier": "aggregator",
              "snapshotFile": "snapshots/page-6897fd.txt",
              "fetchedAt": "2026-11-04T10:10:54.345Z",
              "note": "页面主题：北京保利2021年秋季艺术品拍卖会的整体成交额与主要专场回顾",
              "dimension": "porcelain:dateText",
              "state": "caliber",
              "matchedValue": "2021年12月2日-6日"
            },
            {
              "evidenceId": "ev-20261104-0646fe",
              "fieldKey": "dateText",
              "fieldValue": "2021年12月5日",
              "relation": "supports",
              "quote": "北京保利2021秋季拍卖会 禹贡Ⅰ—盛清御瓷新风尚",
              "url": "http://wx.ttp.51bidlive.com/news/detail?id=4516",
              "domain": "wx.ttp.51bidlive.com",
              "family": "51bidlive.com",
              "tier": "unlisted",
              "snapshotFile": "snapshots/page-0646fe.txt",
              "fetchedAt": "2026-11-04T10:13:13.708Z",
              "note": "页面主题：2021年度瓷器拍卖市场回顾及高价拍品成交记录",
              "dimension": "porcelain:dateText",
              "state": "edge",
              "matchedValue": "2021秋季"
            },
            {
              "evidenceId": "ev-20261104-992d5c",
              "fieldKey": "sessionName",
              "fieldValue": "禹贡Ⅰ—盛清御瓷新风尚",
              "relation": "supports",
              "quote": "<h3><span>预展</span>禹贡Ⅰ—盛清御瓷新风尚</h3><p>北京保利</p><p>2021-12-05</p>",
              "url": "https://m-news.artron.net/news/20260915/n1940787.html",
              "domain": "m-news.artron.net",
              "family": "artron.net",
              "tier": "primary",
              "snapshotFile": "snapshots/page-b03445.txt",
              "fetchedAt": "2026-11-04T10:10:12.803Z",
              "note": "页面主题：该页面详细报道了北京保利2021年秋季拍卖会中国古董珍玩板块的各专场设置、重点拍品及预展信息。",
              "dimension": "porcelain:sessionName",
              "state": "exact",
              "matchedValue": "禹贡Ⅰ—盛清御瓷新风尚"
            },
            {
              "evidenceId": "ev-20261104-2418e5",
              "fieldKey": "sessionName",
              "fieldValue": "禹贡Ⅰ—盛清御瓷新风尚",
              "relation": "supports",
              "quote": "北京保利2021秋季拍卖会 禹贡Ⅰ—盛清御瓷新风尚",
              "url": "http://wx.ttp.51bidlive.com/news/detail?id=4516",
              "domain": "wx.ttp.51bidlive.com",
              "family": "51bidlive.com",
              "tier": "unlisted",
              "snapshotFile": "snapshots/page-0646fe.txt",
              "fetchedAt": "2026-11-04T10:13:13.708Z",
              "note": "页面主题：2021年度瓷器市场成交TOP50榜单及拍品详情",
              "dimension": "porcelain:sessionName",
              "state": "exact",
              "matchedValue": "禹贡Ⅰ—盛清御瓷新风尚"
            }
          ],
          "computation": {
            "gate": "weak",
            "reason": "有共现命中页面，但最低证据等级只到 E1（单一独立来源）——不给强坐标",
            "fieldVerdicts": {
              "auctionHouse": {
                "fieldValue": "北京保利",
                "claimId": "cl-rec-20261104-a8e3db-auctionHouse",
                "verdict": "supported",
                "evidenceGrade": "E1",
                "supportCount": 1,
                "refuteCount": 0,
                "notFoundCause": null,
                "examinedPages": 2,
                "dimensionState": "exact"
              },
              "dateText": {
                "fieldValue": "2021年12月5日",
                "claimId": "cl-rec-20261104-a8e3db-dateText",
                "verdict": "supported",
                "evidenceGrade": "E2",
                "supportCount": 2,
                "refuteCount": 0,
                "notFoundCause": null,
                "examinedPages": 4,
                "dimensionState": "exact"
              },
              "sessionName": {
                "fieldValue": "禹贡Ⅰ—盛清御瓷新风尚",
                "claimId": "cl-rec-20261104-a8e3db-sessionName",
                "verdict": "supported",
                "evidenceGrade": "E2",
                "supportCount": 2,
                "refuteCount": 0,
                "notFoundCause": null,
                "examinedPages": 2,
                "dimensionState": "exact"
              }
            },
            "keyFieldValues": {
              "auctionHouse": "北京保利",
              "dateText": "2021年12月5日",
              "sessionName": "禹贡Ⅰ—盛清御瓷新风尚"
            },
            "cooccurrence": {
              "count": 1,
              "pages": [
                "https://m-news.artron.net/news/20260915/n1940787.html"
              ]
            },
            "dimensionGrade": {
              "grade": "strong",
              "score": 3,
              "basis": "「auctionHouse」「dateText」「sessionName」在各自维度上对上（累计 3，≥ 1.2）",
              "conflictDimensions": [],
              "entries": [
                {
                  "dimension": "porcelain:auctionHouse",
                  "label": "auctionHouse",
                  "state": "exact",
                  "cap": 1
                },
                {
                  "dimension": "porcelain:dateText",
                  "label": "dateText",
                  "state": "exact",
                  "cap": 1
                },
                {
                  "dimension": "porcelain:sessionName",
                  "label": "sessionName",
                  "state": "exact",
                  "cap": 1
                }
              ]
            },
            "anchor": {
              "grade": "weak",
              "evidenceGrade": "E1",
              "urls": [
                "http://wx.ttp.51bidlive.com/news/detail?id=4516",
                "https://m-news.artron.net/news/20260915/n1940787.html"
              ],
              "searchPhrases": [
                "北京保利 2021冬季拍卖会 禹贡Ⅰ 盛清御瓷新风尚",
                "北京保利 禹贡Ⅰ 盛清御瓷新风尚"
              ],
              "stale": false
            }
          }
        }
      ]
    },
    {
      "id": "demo-batch-14",
      "title": "2021 年保利「禹贡Ⅰ」专场（结果报道采集冻结）",
      "subtitle": "一次 full 模式的真实采集：三项关键字段都被两条独立来源支持、共现两个页面——强坐标",
      "query": "北京保利2021年12月5日「禹贡Ⅰ—盛清御瓷新风尚」专场拍卖结果报道：拍卖机构、举办时间、专场名称",
      "capturedAt": "2026-11-04",
      "sources": [
        {
          "url": "http://wx.ttp.51bidlive.com/news/detail?id=4516",
          "publisher": "wx.ttp.51bidlive.com",
          "family": "51bidlive.com",
          "tier": "unlisted",
          "snapshotFile": "snapshots/page-706f14.txt",
          "excerpt": "【节选·非全文】\n来源：wx.ttp.51bidlive.com\n原文：http://wx.ttp.51bidlive.com/news/detail?id=4516\n抓取：2026-11-04T10:20:13.891Z · Lodestar 自抓（渲染后本地抽取正文）\n裁剪：保留含引文的段落与直接上下文；全文 16000 字 → 本节选 558 字\n指纹：全文 SHA-256 22c51ae9c7fa43b387dabcf0f7583b4bd959ceb4edf7af9eeafcafccd42c1f68\n说明：本文件不是原文全文。导航、广告、推荐位与页脚已删除；省略处用「……」标出。\n────────────────────────────────────────\n……an><strong><span>《大清乾隆年制》款</span></strong></span></p><p><span><strong><span>成交价格：82,225,000 人民币</span></strong></span></p><p><span><strong><span>估价待询</span></strong></span></p><p><span><strong><span>尺寸：高 40.2cm</span></strong></span></p><p><span><strong><span>北京保利2021秋季拍卖会 禹贡Ⅰ—盛清御瓷新风尚 Lot 5537</span></strong></span></p><p><span>著录：首都博物馆编，《香江雅集——香港回归祖国20周年特展》，文物出版社，2018年，编号195</span></p><p><span>展览：</span></p><p><span>1.《香江雅集——香港回归祖国20周年特展》，2017年9月30日-12月3日</span></p><p><span>2. 保利艺术研究院、保利艺术博物馆，“弘历的世界II——郎世宁绘《纯惠皇贵妃油画像》暨18世纪盛清宫廷艺术的西洋风”，北京，2021年10月15日……\n"
        },
        {
          "url": "https://artpro.com/news/31111",
          "publisher": "artpro.com",
          "family": "artpro.com",
          "tier": "aggregator",
          "snapshotFile": "snapshots/page-6b5480.txt",
          "excerpt": "【节选·非全文】\n来源：artpro.com\n原文：https://artpro.com/news/31111\n抓取：2026-11-04T10:19:16.312Z · Lodestar 自抓（渲染后本地抽取正文）\n裁剪：保留含引文的段落与直接上下文；全文 5007 字 → 本节选 599 字\n指纹：全文 SHA-256 113477c2cf6d09290f1b6875cd77a935aed1b81de736236c4e73186f5025dbf1\n说明：本文件不是原文全文。导航、广告、推荐位与页脚已删除；省略处用「……」标出。\n────────────────────────────────────────\n……a></div></div></div><div><div><div><div><span><a>首页</a></span><span><a>艺术资讯</a></span><span><span>【2021秋拍总结】北京保利拍卖2021秋拍总成交额33.5亿元 圆满收官</span></span></div><div><div><div><div><p>【2021秋拍总结】北京保利拍卖2021秋拍总成交额33.5亿元 圆满收官</p><div>2021.12.14 16:00</div></div><div><p>2021年12月2日-6日，经过5天的鏖战，北京保利拍卖2021秋季艺术品拍卖会以<strong>总成交额 33.5 亿元圆满收官</strong>。本季秋拍，共产生 <strong>1 件亿元拍品，66 件千万级拍品</strong>。</p></div><div><p>其中，现当代艺术夜场由9件作品组成的“曾梵志艺术专题”斩获了近1.236亿元的总成交额，首现拍场的《祈祷》《智者》分别以3795万元、3565万元成交；中国书画夜场由傅抱石《为罗时慧作柳荫仕女图》领衔共斩获8.1亿元人民币；古代书画夜场的王振鹏《锦标图》以7590万元高价成交，缔造王振鹏个人的第二高价，宋拓《宋御府拓定武兰亭卷——游相兰亭甲之一》以5750万元成交；中国古董珍玩夜场的明末清初 ……\n"
        },
        {
          "url": "https://m-news.artron.net/news/20260915/n1940787.html",
          "publisher": "m-news.artron.net",
          "family": "artron.net",
          "tier": "primary",
          "snapshotFile": "snapshots/page-e2f1d2.txt",
          "excerpt": "【节选·非全文】\n来源：m-news.artron.net\n原文：https://m-news.artron.net/news/20260915/n1940787.html\n抓取：2026-11-04T10:18:40.357Z · Lodestar 自抓（渲染后本地抽取正文）\n裁剪：保留含引文的段落与直接上下文；全文 16000 字 → 本节选 1044 字\n指纹：全文 SHA-256 2554c02600fedd21ad058fb1d0f8c2beafaef294cfa94ed7fba935e20f90c685\n说明：本文件不是原文全文。导航、广告、推荐位与页脚已删除；省略处用「……」标出。\n────────────────────────────────────────\n……卉套炉钧釉太平有象转心瓶”为首的“禹贡Ⅰ——盛清御瓷新风尚”，“佞宋—十面灵璧山居暨诸名藏古陶瓷清翫”，“十面观止——十面灵璧山居诸家藏元明清珍瓷”等数个专场，囊括各类明清御制瓷器，亦囊括有18世纪“西风东渐”的中西结合艺术珍品，甚将各式陶瓷细分到年希尧，唐英督陶期间的新奇门类御窑陶瓷作品，囊括了<strong>青花、斗彩、洋彩、珐琅彩</strong><span>等瓷器，</span>皆为时下市场热门品类。</span></p><div><p><div><img></div></p></div><p><span>禹贡Ⅰ—盛清御瓷新风尚</span></p><p><span>清乾隆 粉彩无量寿佛</span></p><p><span>H：29.5cm</span></p><p><span><strong><span>估价：6,500,000-8,500,000 RMB</span></strong></span></p><p><span>在清代御窑史上，唐英是彪炳史册的人物。正是在他的不懈努力下，雍正乾隆时期的御窑瓷器攀上了前所未有的高峰。雍正六年唐英奉命前往景德镇协助年希尧佐理陶务，第二年即派遣幕友吴尧圃前往调查钧窑釉料的配制方法，日后据以研制出数种釉色。雍正十三年（1735）唐英著《陶成纪事》所载新创仿古采今之各式釉色57种，并呈“岁例贡御”，逐成一朝颜色釉之美，在中国陶瓷史上写下了光辉灿烂的一页。尤其是始见于清雍正年间的“炉钧釉”出窑色釉各异，流淌变幻莫测，绝无两件相同，件件别具一格。</span></p><div><div><a><div><div><div><img></div></div><div><h3><span>预展</span>禹贡Ⅰ—盛清御瓷新风尚</h3><p>北京保利</p><p>2021-12-05</p><p>北京东城区朝阳门北大街1号新保利大厦三层</p></div></div></a></div><p><span>本次在</span><strong><span>“</span><span>禹贡Ⅰ—盛清御瓷新风尚”</span></strong><span>专场</span><span>上拍的<strong>清乾隆〈胭脂红地轧道洋彩缠枝花卉套炉钧釉象耳转心瓶〉</strong>的每一用色及纹饰精工至极，独具西洋韵味的缠枝花卉，胭脂红釉色为底的颈部，两侧收紧处饰有造型灵动的双象耳，象首的肤纹褶皱刻画极为细腻，象鼻轻……\n"
        },
        {
          "url": "https://www.phillips.com/article/72692590/phillips-and-poly-auction-partner-for-beijing-hong-kong-auctions",
          "publisher": "www.phillips.com",
          "family": "phillips.com",
          "tier": "official",
          "snapshotFile": "snapshots/page-07e788.txt",
          "excerpt": "【节选·非全文】\n来源：www.phillips.com\n原文：https://www.phillips.com/article/72692590/phillips-and-poly-auction-partner-for-beijing-hong-kong-auctions\n抓取：2026-11-04T10:17:35.901Z · Lodestar 自抓（渲染后本地抽取正文）\n裁剪：保留含引文的段落与直接上下文；全文 13165 字 → 本节选 1417 字\n指纹：全文 SHA-256 6d391f91e5ab83cf0e564a86f059239f956a6c4a8fa95848e9696ececc253189\n说明：本文件不是原文全文。导航、广告、推荐位与页脚已删除；省略处用「……」标出。\n────────────────────────────────────────\n……pan>Editorial</span></a></li></ul></div></div></div></div></nav></div></header><main><div><div><header><h1>Article | Phillips And Poly Auction Partner For Beijing Hong Kong Auctions</h1><h2>Phillips and Poly Auction's Partnership Reaches New Heights</h2><span>The two houses just announced a Beijing- Hong Kong dual-location joint auction for the June 7 -8 20th Century & Contemporary Art & Design Sales.</span><span>Publish date: 30 March 2021</span><span>By: Sarah Bochicchio</span></header><div><div><div><div><div><div><div><img></div></div></div></div></div><div><div><p><strong><span>Gerhard Richter, </span></strong><em><span>Abstraktes Bild (940-7)</span><……\n……\n……iv></div></div><article><div><p><a><span>中文閱讀</span></a><br><br><span> Following their </span><a><u><span>first-ever joint sales last year</span></u></a><span>, which realized a remarkable HK$508 Million/ US$66 Million and set multiple artist auction records, Phillips and Poly Auction are pleased to announce they will continue to partner in presenting their sales of 20th Century & Contemporary Art and Design with a revolutionary and innovative dual-location format this spring. To be held on June 7 – 8, in conjunction with Beijing Poly Spring Auctions week, the sales will be conducted by Phillips auctioneers in Hong Kong with a live feed relayed from Poly’s auction room in Beijing. The auctioneer will be able to take bids from those……\n"
        },
        {
          "url": "https://www.polypm.com.cn/auction/auction_index.html?infoId=4549156646126882816",
          "publisher": "www.polypm.com.cn",
          "family": "polypm.com.cn",
          "tier": "official",
          "snapshotFile": "snapshots/page-6e02cd.txt",
          "excerpt": "【节选·非全文】\n来源：www.polypm.com.cn\n原文：https://www.polypm.com.cn/auction/auction_index.html?infoId=4549156646126882816\n抓取：2026-11-04T10:18:09.307Z · Lodestar 自抓（渲染后本地抽取正文）\n裁剪：保留含引文的段落与直接上下文；全文 3055 字 → 本节选 540 字\n指纹：全文 SHA-256 50aa76ff3f45c876bcf04c13e08496223cd4c2b34ca51fd2cfdeeeb31037a4cf\n说明：本文件不是原文全文。导航、广告、推荐位与页脚已删除；省略处用「……」标出。\n────────────────────────────────────────\n……i><a><img><span>客户中心</span></a></li><li><a><img><span>关于我们</span></a></li></ul><div><input><img></div><div><a><span>EN</span></a><span>中</span><a><span>日</span></a></div></div></nav></header><section><p><a>首页</a><img><a>拍卖会</a></p><div><div><img></div><div><p>保利拍卖二十周年春季艺术品拍卖会</p><p><span>专场总数：</span><span>21场</span></p><p><span>预展时间：</span><span>2025-06-05 - 2025-06-06</span></p><p><span>拍卖时间：</span><span>2025-06-07 - 2025-06-09</span></p><p><span>拍卖地点：</span><span>北京国贸大酒店拍卖厅A / 北京国贸大酒店拍卖厅B / 北京国贸大酒店拍卖厅C</span></p></div></div><p><……\n"
        }
      ],
      "records": [
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "title": "北京保利 · 禹贡Ⅰ—盛清御瓷新风尚（2021年12月5日）",
          "bucket": "strong",
          "fields": [
            {
              "key": "auctionHouse",
              "label": "拍卖机构",
              "role": "key",
              "value": "北京保利"
            },
            {
              "key": "dateText",
              "label": "举办时间",
              "role": "key",
              "value": "2021年12月5日"
            },
            {
              "key": "sessionName",
              "label": "专场名称",
              "role": "key",
              "value": "禹贡Ⅰ—盛清御瓷新风尚"
            }
          ],
          "evidence": [
            {
              "evidenceId": "ev-20261104-07e788",
              "fieldKey": "auctionHouse",
              "fieldValue": "北京保利",
              "relation": "irrelevant",
              "quote": "The two houses just announced a Beijing- Hong Kong dual-location joint auction for the June 7 -8 20th Century & Contemporary Art & Design Sales.",
              "url": "https://www.phillips.com/article/72692590/phillips-and-poly-auction-partner-for-beijing-hong-kong-auctions",
              "domain": "www.phillips.com",
              "family": "phillips.com",
              "tier": "official",
              "snapshotFile": "snapshots/page-07e788.txt",
              "fetchedAt": "2026-11-04T10:17:35.901Z",
              "note": "页面主题：介绍菲利普斯与保利拍卖合作于2021年6月在北京和香港联合举办现当代艺术及设计专场的文章",
              "dimension": null,
              "state": "unknown",
              "matchedValue": null
            },
            {
              "evidenceId": "ev-20261104-6e02cd",
              "fieldKey": "auctionHouse",
              "fieldValue": "北京保利",
              "relation": "irrelevant",
              "quote": "保利拍卖二十周年春季艺术品拍卖会",
              "url": "https://www.polypm.com.cn/auction/auction_index.html?infoId=4549156646126882816",
              "domain": "www.polypm.com.cn",
              "family": "polypm.com.cn",
              "tier": "official",
              "snapshotFile": "snapshots/page-6e02cd.txt",
              "fetchedAt": "2026-11-04T10:18:09.307Z",
              "note": "页面主题：保利拍卖二十周年春季艺术品拍卖会（2025年6月）的专场排期与基本信息",
              "dimension": "porcelain:auctionHouse",
              "state": "caliber",
              "matchedValue": "保利"
            },
            {
              "evidenceId": "ev-20261104-e2f1d2",
              "fieldKey": "auctionHouse",
              "fieldValue": "北京保利",
              "relation": "supports",
              "quote": "预展禹贡Ⅰ—盛清御瓷新风尚\n北京保利\n2021-12-05",
              "url": "https://m-news.artron.net/news/20260915/n1940787.html",
              "domain": "m-news.artron.net",
              "family": "artron.net",
              "tier": "primary",
              "snapshotFile": "snapshots/page-e2f1d2.txt",
              "fetchedAt": "2026-11-04T10:18:40.357Z",
              "note": "页面主题：北京保利2021秋季拍卖会中国古董珍玩板块专场预览与重点拍品介绍",
              "dimension": "porcelain:auctionHouse",
              "state": "exact",
              "matchedValue": "北京保利"
            },
            {
              "evidenceId": "ev-20261104-6b5480",
              "fieldKey": "auctionHouse",
              "fieldValue": "北京保利",
              "relation": "irrelevant",
              "quote": "2021年12月2日-6日，经过5天的鏖战，北京保利拍卖2021秋季艺术品拍卖会以总成交额 33.5 亿元圆满收官。",
              "url": "https://artpro.com/news/31111",
              "domain": "artpro.com",
              "family": "artpro.com",
              "tier": "aggregator",
              "snapshotFile": "snapshots/page-6b5480.txt",
              "fetchedAt": "2026-11-04T10:19:16.312Z",
              "note": "页面主题：该页面是一篇汇总北京保利2021年秋季拍卖会整体成交额及各主要专场亮点的新闻报道。",
              "dimension": "porcelain:auctionHouse",
              "state": "exact",
              "matchedValue": "北京保利"
            },
            {
              "evidenceId": "ev-20261104-706f14",
              "fieldKey": "auctionHouse",
              "fieldValue": "北京保利",
              "relation": "supports",
              "quote": "北京保利2021秋季拍卖会 禹贡Ⅰ—盛清御瓷新风尚 Lot 5537",
              "url": "http://wx.ttp.51bidlive.com/news/detail?id=4516",
              "domain": "wx.ttp.51bidlive.com",
              "family": "51bidlive.com",
              "tier": "unlisted",
              "snapshotFile": "snapshots/page-706f14.txt",
              "fetchedAt": "2026-11-04T10:20:13.891Z",
              "note": "页面主题：2021年度中国瓷器拍卖市场回顾与TOP50高价拍品成交明细",
              "dimension": "porcelain:auctionHouse",
              "state": "exact",
              "matchedValue": "北京保利"
            },
            {
              "evidenceId": "ev-20261104-80500a",
              "fieldKey": "dateText",
              "fieldValue": "2021年12月5日",
              "relation": "irrelevant",
              "quote": "Phillips and Poly Auction are pleased to announce they will continue to partner in presenting their sales of 20th Century & Contemporary Art and Design with a revolutionary and innovative dual-location format this spring.",
              "url": "https://www.phillips.com/article/72692590/phillips-and-poly-auction-partner-for-beijing-hong-kong-auctions",
              "domain": "www.phillips.com",
              "family": "phillips.com",
              "tier": "official",
              "snapshotFile": "snapshots/page-07e788.txt",
              "fetchedAt": "2026-11-04T10:17:35.901Z",
              "note": "页面主题：该页面是一则关于菲利普斯与保利拍卖合作于2021年春季举办两地同步当代艺术与设计专场的新闻报道。",
              "dimension": null,
              "state": "unknown",
              "matchedValue": null
            },
            {
              "evidenceId": "ev-20261104-ebb520",
              "fieldKey": "dateText",
              "fieldValue": "2021年12月5日",
              "relation": "supports",
              "quote": "禹贡Ⅰ—盛清御瓷新风尚</h3><p>北京保利</p><p>2021-12-05</p>",
              "url": "https://m-news.artron.net/news/20260915/n1940787.html",
              "domain": "m-news.artron.net",
              "family": "artron.net",
              "tier": "primary",
              "snapshotFile": "snapshots/page-e2f1d2.txt",
              "fetchedAt": "2026-11-04T10:18:40.357Z",
              "note": "页面主题：介绍北京保利2021年秋季拍卖会中国古董珍玩板块的专场安排及重点拍品",
              "dimension": "porcelain:dateText",
              "state": "exact",
              "matchedValue": "2021-12-05"
            },
            {
              "evidenceId": "ev-20261104-3029b5",
              "fieldKey": "dateText",
              "fieldValue": "2021年12月5日",
              "relation": "irrelevant",
              "quote": "2021年12月2日-6日，经过5天的鏖战，北京保利拍卖2021秋季艺术品拍卖会以总成交额 33.5 亿元圆满收官。",
              "url": "https://artpro.com/news/31111",
              "domain": "artpro.com",
              "family": "artpro.com",
              "tier": "aggregator",
              "snapshotFile": "snapshots/page-6b5480.txt",
              "fetchedAt": "2026-11-04T10:19:16.312Z",
              "note": "页面主题：北京保利2021年秋季艺术品拍卖会的总体成交情况与主要专场回顾",
              "dimension": "porcelain:dateText",
              "state": "caliber",
              "matchedValue": "2021年12月2日-6日"
            },
            {
              "evidenceId": "ev-20261104-a9a316",
              "fieldKey": "dateText",
              "fieldValue": "2021年12月5日",
              "relation": "supports",
              "quote": "北京保利2021秋季拍卖会 禹贡Ⅰ—盛清御瓷新风尚 Lot 5537",
              "url": "http://wx.ttp.51bidlive.com/news/detail?id=4516",
              "domain": "wx.ttp.51bidlive.com",
              "family": "51bidlive.com",
              "tier": "unlisted",
              "snapshotFile": "snapshots/page-706f14.txt",
              "fetchedAt": "2026-11-04T10:20:13.891Z",
              "note": "页面主题：2021年度瓷器拍卖市场回顾及高价拍品成交记录",
              "dimension": "porcelain:dateText",
              "state": "edge",
              "matchedValue": "2021秋季"
            },
            {
              "evidenceId": "ev-20261104-05aef5",
              "fieldKey": "sessionName",
              "fieldValue": "禹贡Ⅰ—盛清御瓷新风尚",
              "relation": "supports",
              "quote": "禹贡Ⅰ—盛清御瓷新风尚",
              "url": "https://m-news.artron.net/news/20260915/n1940787.html",
              "domain": "m-news.artron.net",
              "family": "artron.net",
              "tier": "primary",
              "snapshotFile": "snapshots/page-e2f1d2.txt",
              "fetchedAt": "2026-11-04T10:18:40.357Z",
              "note": "页面主题：介绍北京保利2021秋拍中国古董珍玩板块各专场及重点拍品的资讯",
              "dimension": "porcelain:sessionName",
              "state": "exact",
              "matchedValue": "禹贡Ⅰ—盛清御瓷新风尚"
            },
            {
              "evidenceId": "ev-20261104-03f23d",
              "fieldKey": "sessionName",
              "fieldValue": "禹贡Ⅰ—盛清御瓷新风尚",
              "relation": "supports",
              "quote": "北京保利2021秋季拍卖会 禹贡Ⅰ—盛清御瓷新风尚 Lot 5537",
              "url": "http://wx.ttp.51bidlive.com/news/detail?id=4516",
              "domain": "wx.ttp.51bidlive.com",
              "family": "51bidlive.com",
              "tier": "unlisted",
              "snapshotFile": "snapshots/page-706f14.txt",
              "fetchedAt": "2026-11-04T10:20:13.891Z",
              "note": "页面主题：盘点2021年度瓷器市场成交TOP50的拍品及其所属拍卖行与专场信息",
              "dimension": "porcelain:sessionName",
              "state": "exact",
              "matchedValue": "禹贡Ⅰ—盛清御瓷新风尚"
            }
          ],
          "computation": {
            "gate": "strong",
            "reason": "关键字段全部 supported、共现命中 2 个页面、最低证据等级 E2",
            "fieldVerdicts": {
              "auctionHouse": {
                "fieldValue": "北京保利",
                "claimId": "cl-rec-20261104-9ba4ea-auctionHouse",
                "verdict": "supported",
                "evidenceGrade": "E2",
                "supportCount": 2,
                "refuteCount": 0,
                "notFoundCause": null,
                "examinedPages": 5,
                "dimensionState": "exact"
              },
              "dateText": {
                "fieldValue": "2021年12月5日",
                "claimId": "cl-rec-20261104-9ba4ea-dateText",
                "verdict": "supported",
                "evidenceGrade": "E2",
                "supportCount": 2,
                "refuteCount": 0,
                "notFoundCause": null,
                "examinedPages": 4,
                "dimensionState": "exact"
              },
              "sessionName": {
                "fieldValue": "禹贡Ⅰ—盛清御瓷新风尚",
                "claimId": "cl-rec-20261104-9ba4ea-sessionName",
                "verdict": "supported",
                "evidenceGrade": "E2",
                "supportCount": 2,
                "refuteCount": 0,
                "notFoundCause": null,
                "examinedPages": 2,
                "dimensionState": "exact"
              }
            },
            "keyFieldValues": {
              "auctionHouse": "北京保利",
              "dateText": "2021年12月5日",
              "sessionName": "禹贡Ⅰ—盛清御瓷新风尚"
            },
            "cooccurrence": {
              "count": 2,
              "pages": [
                "http://wx.ttp.51bidlive.com/news/detail?id=4516",
                "https://m-news.artron.net/news/20260915/n1940787.html"
              ]
            },
            "dimensionGrade": {
              "grade": "strong",
              "score": 3,
              "basis": "「auctionHouse」「dateText」「sessionName」在各自维度上对上（累计 3，≥ 1.2）",
              "conflictDimensions": [],
              "entries": [
                {
                  "dimension": "porcelain:auctionHouse",
                  "label": "auctionHouse",
                  "state": "exact",
                  "cap": 1
                },
                {
                  "dimension": "porcelain:dateText",
                  "label": "dateText",
                  "state": "exact",
                  "cap": 1
                },
                {
                  "dimension": "porcelain:sessionName",
                  "label": "sessionName",
                  "state": "exact",
                  "cap": 1
                }
              ]
            },
            "anchor": {
              "grade": "strong",
              "evidenceGrade": "E2",
              "urls": [
                "http://wx.ttp.51bidlive.com/news/detail?id=4516",
                "https://m-news.artron.net/news/20260915/n1940787.html"
              ],
              "searchPhrases": [
                "北京保利 2021冬季拍卖会 禹贡Ⅰ 盛清御瓷新风尚",
                "北京保利 禹贡Ⅰ 盛清御瓷新风尚"
              ],
              "stale": false
            }
          }
        }
      ]
    },
    {
      "id": "demo-batch-3",
      "title": "2021 年嘉德「宸赏」专场（在线采集冻结）",
      "subtitle": "一次 full 模式的真实采集：日期被独立来源直接反驳，机构在预算内没查到，整条记录不入坐标库",
      "query": "中国嘉德2021年秋季拍卖会「宸赏」专场的拍卖机构、举办时间、专场名称",
      "capturedAt": "2026-11-04",
      "sources": [
        {
          "url": "http://wx.ttp.51bidlive.com/news/detail?id=4516",
          "publisher": "wx.ttp.51bidlive.com",
          "family": "51bidlive.com",
          "tier": "unlisted",
          "snapshotFile": "snapshots/page-ac7935.txt",
          "excerpt": "【节选·非全文】\n来源：wx.ttp.51bidlive.com\n原文：http://wx.ttp.51bidlive.com/news/detail?id=4516\n抓取：2026-11-04T09:30:48.418Z · Lodestar 自抓（渲染后本地抽取正文）\n裁剪：保留含引文的段落与直接上下文；全文 16000 字 → 本节选 556 字\n指纹：全文 SHA-256 6b65dfaef52882567402d2210eb39cf67d72bee6843a422f2194083a8ede7259\n说明：本文件不是原文全文。导航、广告、推荐位与页脚已删除；省略处用「……」标出。\n────────────────────────────────────────\n……an>明永乐 釉里红海水锥拱苍龙教子图大梅瓶<br></span></strong></span></p><p><span><strong><span>成交价格：74,750,000 人民币</span></strong></span></p><p><span><strong><span>估价待询</span></strong></span></p><p><span><strong><span>尺寸：高 41.3cm</span></strong></span></p><p><span><strong><span>中国嘉德2021秋季拍卖会 宸赏—明清御瓷珍玩 Lot 3304 </span></strong></span></p><p><span>来源：广东私人旧藏，1980年代购自于归国香港收藏家</span></p><p><span><br></span></p><section><section><section><section><section><p><strong><span>4</span></strong></p></section></section></section><p><br></p></section></section><p><img></p><p><sp……\n"
        },
        {
          "url": "https://amma.artron.net/observation_shownews.php?newid=1095192",
          "publisher": "amma.artron.net",
          "family": "artron.net",
          "tier": "primary",
          "snapshotFile": "snapshots/page-16465e.txt",
          "excerpt": "【节选·非全文】\n来源：amma.artron.net\n原文：https://amma.artron.net/observation_shownews.php?newid=1095192\n抓取：2026-11-04T09:25:47.222Z · Lodestar 自抓（渲染后本地抽取正文）\n裁剪：保留含引文的段落与直接上下文；全文 11659 字 → 本节选 1010 字\n指纹：全文 SHA-256 f3526d87017278ceb71d968c9d3e81ff37cc4cb4dc0b08deee8e63023aa93c5a\n说明：本文件不是原文全文。导航、广告、推荐位与页脚已删除；省略处用「……」标出。\n────────────────────────────────────────\n……div>2021-05-12 10:13:55 作者:中国嘉德拍卖 来源:中国嘉德拍卖 0次浏览</div></div><div><a><strong>[中国嘉德]宸赏——明清御瓷珍玩</strong><span>2021-05-18</span></a><b></b></div><div><div><img><br></div><br><div><a>更多图片</a></div><br><div><section><section><section><section><p><span><strong><span>中国嘉德2021春季拍卖会</span></strong></span></p><p><span><strong><span>宸赏—明清御瓷珍玩 <br></span></strong></span></p><p><span><strong><span> 专场预展 </span></strong></span></p><p><span>5月14日—5月17日</span></p><p><span><strong><span>金茂万丽酒店</span></strong></span></p><p><span><strong><span> 拍卖时间 </span></strong></span></p><p><span>5月18日（星期二）18:30 顺延</span></p><p><span><strong><span> 地点 </span></strong></span></p><p><span>嘉德艺术中心B1层B厅</span></p><p><span>（北京市东城区王府井大街1号）</span></p></section></section></section></section><section><section><section><section><section><section><section><p><span>圆明园中有座温室“恒春圃”，据传乾隆皇帝移植众多四时名花于此处，以期“一年无日不看花”。《御制诗三集卷五十六》中收录有乾隆皇帝咏叹恒春圃中花卉的诗句:“春之为春发群芳，众名不可更仆数，池荷乃值夏方春，菊之春以秋为序，山茶蜡梅春於冬，夫岂不然岂浪许，是则恒春义若斯”。</span></p><section><span>清宫御瓷中可见有不少以花卉为……\n"
        },
        {
          "url": "https://artpro.com/news/23729",
          "publisher": "artpro.com",
          "family": "artpro.com",
          "tier": "aggregator",
          "snapshotFile": "snapshots/page-a05723.txt",
          "excerpt": "【节选·非全文】\n来源：artpro.com\n原文：https://artpro.com/news/23729\n抓取：2026-11-04T09:27:10.956Z · Lodestar 自抓（渲染后本地抽取正文）\n裁剪：保留含引文的段落与直接上下文；全文 7844 字 → 本节选 567 字\n指纹：全文 SHA-256 29339545f5846a11027b26faa8fb6f8a3f25790f1c81ffe7b2f243979210fd2c\n说明：本文件不是原文全文。导航、广告、推荐位与页脚已删除；省略处用「……」标出。\n────────────────────────────────────────\n……</div><div><div><label><div><div><i></i></div><div><input></div></div></label></div></div><div><div>语言</div></div><div><div><a>登录/注册</a></div></div><div><a>意见反馈</a></div></div></div><div><div><div><div><span><a>首页</a></span><span><a>艺术资讯</a></span><span><span>【视频】ArtPro 专访中国嘉德董事总裁胡妍妍谈2021年嘉德香港春拍 生货尖货云集</span></span></div><div><div><div><div><p>【视频】ArtPro 专访中国嘉德董事总裁胡妍妍谈2021年嘉德香港春拍 生货尖货云集</p><div>2021.04.14 18:00</div></div><div><p>2020年面对纷繁复杂的艺术市场形势，中国嘉德对积极抗击疫情、顺应局势调整策略，作为嘉德全球战略中最重要的组成部分嘉德香港，虽然缺席春拍，但是秋拍表现圆满，经过嘉德香港的积极努力，在<strong>2020年实现了盈利，取得相当不错的成绩</strong>。……\n"
        },
        {
          "url": "https://www.cguardian.com/",
          "publisher": "www.cguardian.com",
          "family": "cguardian.com",
          "tier": "official",
          "snapshotFile": "snapshots/page-5be883.txt",
          "excerpt": "【节选·非全文】\n来源：www.cguardian.com\n原文：https://www.cguardian.com/\n抓取：2026-11-04T09:24:40.409Z · Lodestar 自抓（渲染后本地抽取正文）\n裁剪：保留含引文的段落与直接上下文；全文 9520 字 → 本节选 538 字\n指纹：全文 SHA-256 f261d9bf542b5fc297bb2f93e25b47981f869cd3535e8751b8ab48178fff8824\n说明：本文件不是原文全文。导航、广告、推荐位与页脚已删除；省略处用「……」标出。\n────────────────────────────────────────\n……div></div></div></div><div><a>关于我们</a><div><div><div><a>公司介绍</a><a>总公司及办事处</a></div><div><a>人才招聘</a></div></div></div></div></div><div><div><input><div><img></div></div></div></div></div></div><div><div><div><ul></ul></div></div><div><div><div><div><div><span>中国嘉德2026年秋季拍卖会</span><span>查看全部22场</span></div><div><div><img></div><div><div><div><div>瓷器、紫砂及古董珍玩集萃（瓷器）</div><div><div> LOT 251-451</div><div>拍卖地点： 拍卖A厅</div><div>拍卖时间： 11月08日 10:00</div></div></div></div><div><div><div>澄怀一金石文房雅玩</div><div><div> LOT 1861-2220</div><div>拍卖地……\n"
        }
      ],
      "records": [
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "title": "中国嘉德国际拍卖有限公司 · 宸赏—明清御瓷珍玩（2021年11月26日至12月13日）",
          "bucket": "refuted",
          "fields": [
            {
              "key": "auctionHouse",
              "label": "拍卖机构",
              "role": "key",
              "value": "中国嘉德国际拍卖有限公司"
            },
            {
              "key": "dateText",
              "label": "举办时间",
              "role": "key",
              "value": "2021年11月26日至12月13日"
            },
            {
              "key": "sessionName",
              "label": "专场名称",
              "role": "key",
              "value": "宸赏—明清御瓷珍玩"
            }
          ],
          "evidence": [
            {
              "evidenceId": "ev-20261104-5be883",
              "fieldKey": "auctionHouse",
              "fieldValue": "中国嘉德国际拍卖有限公司",
              "relation": "irrelevant",
              "quote": "中国嘉德2026年秋季拍卖会",
              "url": "https://www.cguardian.com/",
              "domain": "www.cguardian.com",
              "family": "cguardian.com",
              "tier": "official",
              "snapshotFile": "snapshots/page-5be883.txt",
              "fetchedAt": "2026-11-04T09:24:40.409Z",
              "note": "页面主题：中国嘉德2026年秋季拍卖会日程及精品赏析页面",
              "dimension": "porcelain:auctionHouse",
              "state": "exact",
              "matchedValue": "中国嘉德"
            },
            {
              "evidenceId": "ev-20261104-a05723",
              "fieldKey": "auctionHouse",
              "fieldValue": "中国嘉德国际拍卖有限公司",
              "relation": "irrelevant",
              "quote": "【视频】ArtPro 专访中国嘉德董事总裁胡妍妍谈2021年嘉德香港春拍 生货尖货云集",
              "url": "https://artpro.com/news/23729",
              "domain": "artpro.com",
              "family": "artpro.com",
              "tier": "aggregator",
              "snapshotFile": "snapshots/page-a05723.txt",
              "fetchedAt": "2026-11-04T09:27:10.956Z",
              "note": "页面主题：该页面主要报道了2021年中国嘉德香港春拍的专访内容及各专场日程安排。",
              "dimension": "porcelain:auctionHouse",
              "state": "exact",
              "matchedValue": "中国嘉德"
            },
            {
              "evidenceId": "ev-20261104-16465e",
              "fieldKey": "dateText",
              "fieldValue": "2021年11月26日至12月13日",
              "relation": "refutes",
              "quote": "拍卖时间 5月18日（星期二）18:30 顺延",
              "url": "https://amma.artron.net/observation_shownews.php?newid=1095192",
              "domain": "amma.artron.net",
              "family": "artron.net",
              "tier": "primary",
              "snapshotFile": "snapshots/page-16465e.txt",
              "fetchedAt": "2026-11-04T09:25:47.222Z",
              "note": "页面主题：雅昌艺术网关于中国嘉德2021春季拍卖会“宸赏—明清御瓷珍玩”专场的资讯与拍品介绍页面",
              "dimension": null,
              "state": "unknown",
              "matchedValue": null
            },
            {
              "evidenceId": "ev-20261104-e4eb15",
              "fieldKey": "sessionName",
              "fieldValue": "宸赏—明清御瓷珍玩",
              "relation": "irrelevant",
              "quote": "中国嘉德2026年秋季拍卖会",
              "url": "https://www.cguardian.com/",
              "domain": "www.cguardian.com",
              "family": "cguardian.com",
              "tier": "official",
              "snapshotFile": "snapshots/page-5be883.txt",
              "fetchedAt": "2026-11-04T09:24:40.409Z",
              "note": "页面主题：该页面展示的是中国嘉德2026年秋季拍卖会的各专场日程与拍品信息。",
              "dimension": "porcelain:sessionName",
              "state": "mismatch",
              "matchedValue": "中国嘉德2026年秋季拍卖会"
            },
            {
              "evidenceId": "ev-20261104-eaf075",
              "fieldKey": "sessionName",
              "fieldValue": "宸赏—明清御瓷珍玩",
              "relation": "irrelevant",
              "quote": "中国嘉德2021春季拍卖会",
              "url": "https://amma.artron.net/observation_shownews.php?newid=1095192",
              "domain": "amma.artron.net",
              "family": "artron.net",
              "tier": "primary",
              "snapshotFile": "snapshots/page-16465e.txt",
              "fetchedAt": "2026-11-04T09:25:47.222Z",
              "note": "页面主题：该页面介绍的是中国嘉德2021年春季拍卖会“宸赏—明清御瓷珍玩”专场的预展安排与部分拍品详情。",
              "dimension": "porcelain:sessionName",
              "state": "mismatch",
              "matchedValue": "中国嘉德2021春季拍卖会"
            },
            {
              "evidenceId": "ev-20261104-ac7935",
              "fieldKey": "sessionName",
              "fieldValue": "宸赏—明清御瓷珍玩",
              "relation": "supports",
              "quote": "中国嘉德2021秋季拍卖会 宸赏—明清御瓷珍玩 Lot 3304",
              "url": "http://wx.ttp.51bidlive.com/news/detail?id=4516",
              "domain": "wx.ttp.51bidlive.com",
              "family": "51bidlive.com",
              "tier": "unlisted",
              "snapshotFile": "snapshots/page-ac7935.txt",
              "fetchedAt": "2026-11-04T09:30:48.418Z",
              "note": "页面主题：该页面主要盘点2021年度瓷器市场成交TOP50的拍品及其所属专场信息。",
              "dimension": "porcelain:sessionName",
              "state": "exact",
              "matchedValue": "宸赏—明清御瓷珍玩"
            }
          ],
          "computation": {
            "gate": "rejected",
            "reason": "关键字段 cl-rec-20261104-bb1fe7-auctionHouse 判为 not_found（成因 coverage），整条记录不入坐标库",
            "fieldVerdicts": {
              "auctionHouse": {
                "fieldValue": "中国嘉德国际拍卖有限公司",
                "claimId": "cl-rec-20261104-bb1fe7-auctionHouse",
                "verdict": "not_found",
                "evidenceGrade": "E0",
                "supportCount": 0,
                "refuteCount": 0,
                "notFoundCause": "coverage",
                "examinedPages": 2,
                "dimensionState": null
              },
              "dateText": {
                "fieldValue": "2021年11月26日至12月13日",
                "claimId": "cl-rec-20261104-bb1fe7-dateText",
                "verdict": "refuted",
                "evidenceGrade": "E1",
                "supportCount": 0,
                "refuteCount": 1,
                "notFoundCause": null,
                "examinedPages": 1,
                "dimensionState": null
              },
              "sessionName": {
                "fieldValue": "宸赏—明清御瓷珍玩",
                "claimId": "cl-rec-20261104-bb1fe7-sessionName",
                "verdict": "supported",
                "evidenceGrade": "E1",
                "supportCount": 1,
                "refuteCount": 0,
                "notFoundCause": null,
                "examinedPages": 3,
                "dimensionState": "exact"
              }
            },
            "keyFieldValues": {
              "auctionHouse": "中国嘉德国际拍卖有限公司",
              "dateText": "2021年11月26日至12月13日",
              "sessionName": "宸赏—明清御瓷珍玩"
            },
            "cooccurrence": {
              "count": 0,
              "pages": []
            },
            "dimensionGrade": {
              "grade": "strong",
              "score": 2,
              "basis": "「auctionHouse」「sessionName」在各自维度上对上（累计 2，≥ 1.2）",
              "conflictDimensions": [],
              "entries": [
                {
                  "dimension": "field:dateText",
                  "label": "dateText",
                  "state": "unknown",
                  "cap": 1
                },
                {
                  "dimension": "porcelain:auctionHouse",
                  "label": "auctionHouse",
                  "state": "exact",
                  "cap": 1
                },
                {
                  "dimension": "porcelain:sessionName",
                  "label": "sessionName",
                  "state": "exact",
                  "cap": 1
                }
              ]
            },
            "anchor": null
          }
        }
      ]
    },
    {
      "id": "demo-batch-8",
      "title": "2025 年中国嘉德「递藏之趣专场」（在线采集冻结）",
      "subtitle": "一次 full 模式的真实采集：日期与专场名拿到单一来源支持，机构在预算内没查到，整条记录仍被拒收",
      "query": "2024年至2025年，北京保利、中国嘉德的中国古董珍玩拍卖专场：拍卖机构、举办时间、专场名称",
      "capturedAt": "2026-11-04",
      "sources": [
        {
          "url": "http://news.cafa.edu.cn/MobileNews/independenWeixinContent?contentId=225454392",
          "publisher": "news.cafa.edu.cn",
          "family": "cafa.edu.cn",
          "tier": "unlisted",
          "snapshotFile": "snapshots/page-ff625a.txt",
          "excerpt": "【节选·非全文】\n来源：news.cafa.edu.cn\n原文：http://news.cafa.edu.cn/MobileNews/independenWeixinContent?contentId=225454392\n抓取：2026-11-04T10:02:34.746Z · Lodestar 自抓（渲染后本地抽取正文）\n裁剪：保留含引文的段落与直接上下文；全文 16000 字 → 本节选 575 字\n指纹：全文 SHA-256 2b781c3488dbd6bb5de08d5fd4daf6bc5d71f0ddf7817d3e8a7980c9186ed9df\n说明：本文件不是原文全文。导航、广告、推荐位与页脚已删除；省略处用「……」标出。\n────────────────────────────────────────\n……pan><img></span></section><section><span><br></span></section><section><span><br></span></section><section><section><section><section><section><p><span><br></span></p></section><section><p><span><br></span></p></section></section><section><section><span><span>5月28日深夜，伴随着中国古代书画日场以88%的优异成交率落槌，中国嘉德2025春季拍卖会落下了帷幕。6500件艺术珍品，37个专场，总成交16亿元，平均成交率80%。16件拍品成交价超过千万元，214件拍品成交价超过百万元。这样一份超出预期的成绩单，犹如和煦的春光，为市场带来了惊喜，送达了暖意，也映照着一个充满生机的未来。</span></span></section></section></section></section></section><p><span><br></span></p><section><img></section><section><span><br></span></section>……\n"
        },
        {
          "url": "https://auction.artron.net/org_detail/JG0005",
          "publisher": "auction.artron.net",
          "family": "artron.net",
          "tier": "primary",
          "snapshotFile": "snapshots/page-8ba8fd.txt",
          "excerpt": "【节选·非全文】\n来源：auction.artron.net\n原文：https://auction.artron.net/org_detail/JG0005\n抓取：2026-11-04T10:00:52.832Z · Lodestar 自抓（渲染后本地抽取正文）\n裁剪：保留含引文的段落与直接上下文；全文 8144 字 → 本节选 537 字\n指纹：全文 SHA-256 9475ae8c82fd5e416b4e1ae2ad931540c9103ecf35aa8d1060f5f2792d78ae3c\n说明：本文件不是原文全文。导航、广告、推荐位与页脚已删除；省略处用「……」标出。\n────────────────────────────────────────\n……li><li><a>中国嘉德2026秋拍第二阶段上海精品展启幕，乐山堂藏宋元名迹首度亮相</a><span>2026-10-31 20:36:32</span></li><li><a>中国嘉德2026秋拍 | 从《铃兰Ⅰ》到《曲膝仰卧裸女Ⅱ》看常玉的减法</a><span>2026-10-30 17:14:44</span></li></ul></div><div><div><ul><li>拍卖预展</li><li>拍卖结果</li><li><a>更多</a></li></ul><div><div><h1><a> 中国嘉德2026秋季拍卖会 </a></h1><p><span>预展时间：</span> 2026.11.05 - 11.26 </p><p><span>预展地点：</span>嘉德艺术中心（北京市东城区王府井大街1号） </p><p><span>拍卖时间：</span>2026.11.08 - 11.28 </p><p><span>拍卖地点：</span>嘉德艺术中心（北京市东城区王府井大街1号） </p></div><div><span>包含专场(22)</span></div><div><ul><li><h1><a> 瓷器、紫砂及古董……\n"
        },
        {
          "url": "https://wwj.beijing.gov.cn/bjww/362749/362751/cs88/743733485/index.html",
          "publisher": "wwj.beijing.gov.cn",
          "family": "beijing.gov.cn",
          "tier": "unlisted",
          "snapshotFile": "snapshots/page-525b77.txt",
          "excerpt": "【节选·非全文】\n来源：wwj.beijing.gov.cn\n原文：https://wwj.beijing.gov.cn/bjww/362749/362751/cs88/743733485/index.html\n抓取：2026-11-04T10:02:07.375Z · Lodestar 自抓（渲染后本地抽取正文）\n裁剪：保留含引文的段落与直接上下文；全文 10152 字 → 本节选 588 字\n指纹：全文 SHA-256 a22783cc1e7a44075e18cd1613c71ae6296187a40c026a7b37d74acce4c68aa4\n说明：本文件不是原文全文。导航、广告、推荐位与页脚已删除；省略处用「……」标出。\n────────────────────────────────────────\n……16日20时—8月22日24时；申报的油画类标的88件，属于文物监管范围的标的0件。</p><p> 6.刻痕心印—20世纪名家木刻版画专场预展时间：2025年8月13日10时—8月16日20时；拍卖时间：2025年8月16日20时—8月22日24时；申报的版画类标的44件，属于文物监管范围的标的0件。</p><p> 7.现当代大师版画专场预展时间：2025年8月13日10时—8月16日20时；拍卖时间：2025年8月16日20时—8月22日24时；申报的版画类标的60件，属于文物监管范围的标的3件。</p><p> 8.递藏之趣专场预展时间：2025年8月13日10时—8月16日20时；拍卖时间：2025年8月16日20时—8月22日24时；申报的瓷杂类标的61件，属于文物监管范围的标的61件。</p><p> 9.蕴玉—私人旧藏古代玉器专场预展时间：2025年8月13日10时—8月16日20时；拍卖时间：2025年8月16日20时—8月22日24时；申报的杂项类标的50件，属于文物监管范围的标的50件。</p><p> 10.蒲庵饕餮-陶瓷美馔之藏专场预展时间：2025年8月13日10时—8月16日20时；拍卖时间：2025年8月16日20时—8月22日24时；申报的杂项类标的20件，属于文物监管范围的标的0件。</p><p> 11.抟泥幻彩—明清瓷器专……\n"
        },
        {
          "url": "https://www.artzww.com/art2017art/wap_doc/29663321.html",
          "publisher": "www.artzww.com",
          "family": "artzww.com",
          "tier": "unlisted",
          "snapshotFile": "snapshots/page-91cbce.txt",
          "excerpt": "【节选·非全文】\n来源：www.artzww.com\n原文：https://www.artzww.com/art2017art/wap_doc/29663321.html\n抓取：2026-11-04T10:01:42.728Z · Lodestar 自抓（渲染后本地抽取正文）\n裁剪：保留含引文的段落与直接上下文；全文 16000 字 → 本节选 429 字\n指纹：全文 SHA-256 6fabdf37a0a14dde79696656669bc2b286bf4d29ce3a90fc64af07d5282ab4b1\n说明：本文件不是原文全文。导航、广告、推荐位与页脚已删除；省略处用「……」标出。\n────────────────────────────────────────\n<div><div><div><a><img></a></div></div><div><div><input><h2>37个专场，6000余件艺术珍品，中国嘉德2025春季拍卖会盛大启幕</h2><div><p><span>2025年5月7日，备受瞩目的中国嘉德2025春季拍卖会在嘉德艺术中心盛大启幕，开启了一场艺术与文化的盛宴。本季春拍集结近6800件艺术珍品，精耕细作37个专场，涵盖艺术品拍卖全部门类，稀世之宝与亲民小品交相辉映，满足藏家个性化、多元化审美需求。</span></p><p><img><br><br></p><p><span>本季春拍分两个阶段第一阶段：二十世纪及当代艺术、瓷器及古董珍玩、金石雅玩及古典家具、珠宝翡翠钟表，5月7日-10日预展，5月11日-13日拍卖。</span></p><p><span>第二阶段：中国书画、古籍善本、佳酿臻茗、邮品钱币，5月21日-24日预展，5月25日-28日拍卖。</span></p……\n"
        },
        {
          "url": "https://www.cguardian.com/",
          "publisher": "www.cguardian.com",
          "family": "cguardian.com",
          "tier": "official",
          "snapshotFile": "snapshots/page-d88a91.txt",
          "excerpt": "【节选·非全文】\n来源：www.cguardian.com\n原文：https://www.cguardian.com/\n抓取：2026-11-04T10:00:28.106Z · Lodestar 自抓（渲染后本地抽取正文）\n裁剪：保留含引文的段落与直接上下文；全文 9520 字 → 本节选 538 字\n指纹：全文 SHA-256 f261d9bf542b5fc297bb2f93e25b47981f869cd3535e8751b8ab48178fff8824\n说明：本文件不是原文全文。导航、广告、推荐位与页脚已删除；省略处用「……」标出。\n────────────────────────────────────────\n……div></div></div></div><div><a>关于我们</a><div><div><div><a>公司介绍</a><a>总公司及办事处</a></div><div><a>人才招聘</a></div></div></div></div></div><div><div><input><div><img></div></div></div></div></div></div><div><div><div><ul></ul></div></div><div><div><div><div><div><span>中国嘉德2026年秋季拍卖会</span><span>查看全部22场</span></div><div><div><img></div><div><div><div><div>瓷器、紫砂及古董珍玩集萃（瓷器）</div><div><div> LOT 251-451</div><div>拍卖地点： 拍卖A厅</div><div>拍卖时间： 11月08日 10:00</div></div></div></div><div><div><div>澄怀一金石文房雅玩</div><div><div> LOT 1861-2220</div><div>拍卖地……\n"
        }
      ],
      "records": [
        {
          "recordId": "rec-20261104-9863c4",
          "caseId": "demo-batch-8",
          "title": "中国嘉德国际拍卖有限公司 · 递藏之趣专场（2025年8月16日20时—8月22日24时）",
          "bucket": "not_found",
          "fields": [
            {
              "key": "auctionHouse",
              "label": "拍卖机构",
              "role": "key",
              "value": "中国嘉德国际拍卖有限公司"
            },
            {
              "key": "dateText",
              "label": "举办时间",
              "role": "key",
              "value": "2025年8月16日20时—8月22日24时"
            },
            {
              "key": "sessionName",
              "label": "专场名称",
              "role": "key",
              "value": "递藏之趣专场"
            }
          ],
          "evidence": [
            {
              "evidenceId": "ev-20261104-d88a91",
              "fieldKey": "auctionHouse",
              "fieldValue": "中国嘉德国际拍卖有限公司",
              "relation": "irrelevant",
              "quote": "中国嘉德2026年秋季拍卖会",
              "url": "https://www.cguardian.com/",
              "domain": "www.cguardian.com",
              "family": "cguardian.com",
              "tier": "official",
              "snapshotFile": "snapshots/page-d88a91.txt",
              "fetchedAt": "2026-11-04T10:00:28.106Z",
              "note": "页面主题：该页面展示了中国嘉德2026年秋季拍卖会的详细日程与拍品场次安排",
              "dimension": "porcelain:auctionHouse",
              "state": "exact",
              "matchedValue": "中国嘉德"
            },
            {
              "evidenceId": "ev-20261104-8ba8fd",
              "fieldKey": "auctionHouse",
              "fieldValue": "中国嘉德国际拍卖有限公司",
              "relation": "irrelevant",
              "quote": "中国嘉德2026秋季拍卖会",
              "url": "https://auction.artron.net/org_detail/JG0005",
              "domain": "auction.artron.net",
              "family": "artron.net",
              "tier": "primary",
              "snapshotFile": "snapshots/page-8ba8fd.txt",
              "fetchedAt": "2026-11-04T10:00:52.832Z",
              "note": "页面主题：该页面为中国嘉德国际拍卖有限公司的机构主页，主要展示了其2026年秋季拍卖会的日程、地点及包含的22个专场信息。",
              "dimension": "porcelain:auctionHouse",
              "state": "exact",
              "matchedValue": "中国嘉德"
            },
            {
              "evidenceId": "ev-20261104-91cbce",
              "fieldKey": "dateText",
              "fieldValue": "2025年8月16日20时—8月22日24时",
              "relation": "irrelevant",
              "quote": "2025年5月7日，备受瞩目的中国嘉德2025春季拍卖会在嘉德艺术中心盛大启幕，开启了一场艺术与文化的盛宴。",
              "url": "https://www.artzww.com/art2017art/wap_doc/29663321.html",
              "domain": "www.artzww.com",
              "family": "artzww.com",
              "tier": "unlisted",
              "snapshotFile": "snapshots/page-91cbce.txt",
              "fetchedAt": "2026-11-04T10:01:42.728Z",
              "note": "页面主题：该页面主要介绍中国嘉德2025年春季拍卖会的启幕时间、分阶段预展与拍卖日程以及各门类专场的拍品情况。",
              "dimension": "porcelain:dateText",
              "state": "conflict",
              "matchedValue": "2025年5月7日"
            },
            {
              "evidenceId": "ev-20261104-525b77",
              "fieldKey": "dateText",
              "fieldValue": "2025年8月16日20时—8月22日24时",
              "relation": "supports",
              "quote": "8.递藏之趣专场预展时间：2025年8月13日10时—8月16日20时；拍卖时间：2025年8月16日20时—8月22日24时；",
              "url": "https://wwj.beijing.gov.cn/bjww/362749/362751/cs88/743733485/index.html",
              "domain": "wwj.beijing.gov.cn",
              "family": "beijing.gov.cn",
              "tier": "unlisted",
              "snapshotFile": "snapshots/page-525b77.txt",
              "fetchedAt": "2026-11-04T10:02:07.375Z",
              "note": "页面主题：北京市文物局关于同意中国嘉德举办第68期文物艺术品线上拍卖会的批复文件",
              "dimension": "porcelain:dateText",
              "state": "conflict",
              "matchedValue": "2025年8月13日"
            },
            {
              "evidenceId": "ev-20261104-ff625a",
              "fieldKey": "dateText",
              "fieldValue": "2025年8月16日20时—8月22日24时",
              "relation": "irrelevant",
              "quote": "5月28日深夜，伴随着中国古代书画日场以88%的优异成交率落槌，中国嘉德2025春季拍卖会落下了帷幕。",
              "url": "http://news.cafa.edu.cn/MobileNews/independenWeixinContent?contentId=225454392",
              "domain": "news.cafa.edu.cn",
              "family": "cafa.edu.cn",
              "tier": "unlisted",
              "snapshotFile": "snapshots/page-ff625a.txt",
              "fetchedAt": "2026-11-04T10:02:34.746Z",
              "note": "页面主题：该页面是一篇关于中国嘉德2025年春季拍卖会圆满收官及亮点的新闻报道。",
              "dimension": "porcelain:dateText",
              "state": "conflict",
              "matchedValue": "2025春季"
            },
            {
              "evidenceId": "ev-20261104-a85101",
              "fieldKey": "sessionName",
              "fieldValue": "递藏之趣专场",
              "relation": "supports",
              "quote": "8.递藏之趣专场预展时间：2025年8月13日10时—8月16日20时；拍卖时间：2025年8月16日20时—8月22日24时；",
              "url": "https://wwj.beijing.gov.cn/bjww/362749/362751/cs88/743733485/index.html",
              "domain": "wwj.beijing.gov.cn",
              "family": "beijing.gov.cn",
              "tier": "unlisted",
              "snapshotFile": "snapshots/page-525b77.txt",
              "fetchedAt": "2026-11-04T10:02:07.375Z",
              "note": "页面主题：北京市文物局批复中国嘉德举办第68期文物艺术品线上拍卖会的官方文件",
              "dimension": "porcelain:sessionName",
              "state": "exact",
              "matchedValue": "递藏之趣专场"
            }
          ],
          "computation": {
            "gate": "rejected",
            "reason": "关键字段 cl-rec-20261104-9863c4-auctionHouse 判为 not_found（成因 coverage），整条记录不入坐标库",
            "fieldVerdicts": {
              "auctionHouse": {
                "fieldValue": "中国嘉德国际拍卖有限公司",
                "claimId": "cl-rec-20261104-9863c4-auctionHouse",
                "verdict": "not_found",
                "evidenceGrade": "E0",
                "supportCount": 0,
                "refuteCount": 0,
                "notFoundCause": "coverage",
                "examinedPages": 2,
                "dimensionState": null
              },
              "dateText": {
                "fieldValue": "2025年8月16日20时—8月22日24时",
                "claimId": "cl-rec-20261104-9863c4-dateText",
                "verdict": "supported",
                "evidenceGrade": "E1",
                "supportCount": 1,
                "refuteCount": 0,
                "notFoundCause": null,
                "examinedPages": 3,
                "dimensionState": "conflict"
              },
              "sessionName": {
                "fieldValue": "递藏之趣专场",
                "claimId": "cl-rec-20261104-9863c4-sessionName",
                "verdict": "supported",
                "evidenceGrade": "E1",
                "supportCount": 1,
                "refuteCount": 0,
                "notFoundCause": null,
                "examinedPages": 1,
                "dimensionState": "exact"
              }
            },
            "keyFieldValues": {
              "auctionHouse": "中国嘉德国际拍卖有限公司",
              "dateText": "2025年8月16日20时—8月22日24时",
              "sessionName": "递藏之趣专场"
            },
            "cooccurrence": {
              "count": 0,
              "pages": []
            },
            "dimensionGrade": {
              "grade": "weak",
              "score": 0,
              "basis": "「dateText」明确冲突，先否决强坐标（冲突只作候选，不压成\"反对\"）",
              "conflictDimensions": [
                "dateText"
              ],
              "entries": [
                {
                  "dimension": "porcelain:auctionHouse",
                  "label": "auctionHouse",
                  "state": "exact",
                  "cap": 1
                },
                {
                  "dimension": "porcelain:dateText",
                  "label": "dateText",
                  "state": "conflict",
                  "cap": 1
                },
                {
                  "dimension": "porcelain:sessionName",
                  "label": "sessionName",
                  "state": "exact",
                  "cap": 1
                }
              ]
            },
            "anchor": null
          }
        }
      ]
    }
  ]
};
