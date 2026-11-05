// 由 src/demo-page/build-demo-game.ts 从 examples/ 与 demo-data.js 生成，不要手改；改候选词或批次后重跑 pnpm run demo:game。
// 每条组合只冻结"逐维比对结果 + 组合级结论 + 指向哪条冻结记录"；逐条证据、引文与快照在 demo-data.js。
window.LODESTAR_DEMO_GAME = {
  "generatedAt": "2026-11-05T17:32:14.238Z",
  "generator": "src/demo-page/build-demo-game.ts",
  "note": "组合矩阵在构建时用引擎的维度函数算好：每个词与冻结证据里的原文值逐维比对，结论取最差的那一维；至少两个词达到「口径相容」及以上才算覆盖。标了 demoOnly 的候选是演示用词，不在冻结底稿里出现过，页面必须标出来。",
  "slots": [
    {
      "key": "auctionHouse",
      "label": "拍卖机构",
      "options": [
        {
          "value": "北京保利",
          "demoOnly": false,
          "note": "冻结记录里的写法"
        },
        {
          "value": "中国嘉德国际拍卖有限公司",
          "demoOnly": false,
          "note": "冻结记录里的写法"
        },
        {
          "value": "保利香港拍賣",
          "demoOnly": false,
          "note": "冻结记录里的写法"
        },
        {
          "value": "保利拍卖",
          "demoOnly": true,
          "note": "演示用词：底稿里没有这个写法，用来演示「同一家，只是少写了城市」"
        }
      ]
    },
    {
      "key": "dateText",
      "label": "举办时间",
      "options": [
        {
          "value": "2021年12月5日",
          "demoOnly": false,
          "note": "冻结记录里的写法"
        },
        {
          "value": "2021年11月15日",
          "demoOnly": false,
          "note": "冻结记录里的写法"
        },
        {
          "value": "2021年秋季",
          "demoOnly": false,
          "note": "冻结记录里的写法"
        },
        {
          "value": "2021年8月",
          "demoOnly": true,
          "note": "演示用词：底稿里没有这个日期写法，用来演示「同一场、写法不同」与「冲突候选」的分界"
        },
        {
          "value": "去年秋天",
          "demoOnly": true,
          "note": "演示用词：含糊说法，用来演示「无从判断」"
        }
      ]
    },
    {
      "key": "sessionName",
      "label": "专场名",
      "options": [
        {
          "value": "禹贡Ⅰ—盛清御瓷新风尚",
          "demoOnly": false,
          "note": "冻结记录里的写法"
        },
        {
          "value": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "demoOnly": false,
          "note": "冻结记录里的写法"
        },
        {
          "value": "禹贡Ⅲ—盛清御瓷新风尚",
          "demoOnly": false,
          "note": "冻结记录里的写法"
        },
        {
          "value": "宸赏—明清御瓷珍玩",
          "demoOnly": false,
          "note": "冻结记录里的写法"
        },
        {
          "value": "中國古董珍玩專場",
          "demoOnly": false,
          "note": "冻结记录里的写法"
        }
      ]
    }
  ],
  "combos": [
    {
      "id": "g-01",
      "key": "北京保利\u00002021年12月5日\u0000禹贡Ⅰ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "2021年12月5日",
        "sessionName": "禹贡Ⅰ—盛清御瓷新风尚"
      },
      "sentence": "北京保利 在 2021年12月5日 举办了一场名为「禹贡Ⅰ—盛清御瓷新风尚」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-1",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅰ—盛清御瓷新风尚（2021年12月5日）",
      "gate": "strong",
      "bucket": "strong",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "北京保利",
          "evidenceValue": "北京保利",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年12月5日",
          "evidenceValue": "2021年12月5日",
          "state": "exact",
          "note": "证据的日期落在断言主张的范围内",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅰ—盛清御瓷新风尚",
          "evidenceValue": "禹贡Ⅰ—盛清御瓷新风尚",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "strong",
        "label": "强坐标",
        "hint": "三个词都能在证据里找到同一写法，且撑起这条记录的独立来源够用",
        "score": 9,
        "basis": "拍卖机构：exact · 举办时间：exact · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 9
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 9
        },
        {
          "recordId": "rec-20261104-a8e3db",
          "caseId": "demo-batch-11",
          "bucket": "weak",
          "score": 9
        }
      ]
    },
    {
      "id": "g-02",
      "key": "北京保利\u00002021年12月5日\u0000禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "2021年12月5日",
        "sessionName": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术"
      },
      "sentence": "北京保利 在 2021年12月5日 举办了一场名为「禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "北京保利",
          "evidenceValue": "北京保利",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年12月5日",
          "evidenceValue": "2021年秋季",
          "state": "edge",
          "note": "只在两侧各放宽一个月的窗口边缘擦上，不等于同一件",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "edge",
        "label": "没有矛盾，但这不能证明",
        "hint": "有证据，但至少一维只到「没有矛盾，但这不能证明」，撑不起结论",
        "score": 7,
        "basis": "拍卖机构：exact · 举办时间：edge · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 7
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 5
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 5
        }
      ]
    },
    {
      "id": "g-03",
      "key": "北京保利\u00002021年12月5日\u0000禹贡Ⅲ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "2021年12月5日",
        "sessionName": "禹贡Ⅲ—盛清御瓷新风尚"
      },
      "sentence": "北京保利 在 2021年12月5日 举办了一场名为「禹贡Ⅲ—盛清御瓷新风尚」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-1",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅰ—盛清御瓷新风尚（2021年12月5日）",
      "gate": "strong",
      "bucket": "strong",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "北京保利",
          "evidenceValue": "北京保利",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年12月5日",
          "evidenceValue": "2021年12月5日",
          "state": "exact",
          "note": "证据的日期落在断言主张的范围内",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅲ—盛清御瓷新风尚",
          "evidenceValue": "禹贡Ⅰ—盛清御瓷新风尚",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 5,
        "basis": "拍卖机构：exact · 举办时间：exact · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 5
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 5
        },
        {
          "recordId": "rec-20261104-a8e3db",
          "caseId": "demo-batch-11",
          "bucket": "weak",
          "score": 5
        }
      ]
    },
    {
      "id": "g-04",
      "key": "北京保利\u00002021年12月5日\u0000宸赏—明清御瓷珍玩",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "2021年12月5日",
        "sessionName": "宸赏—明清御瓷珍玩"
      },
      "sentence": "北京保利 在 2021年12月5日 举办了一场名为「宸赏—明清御瓷珍玩」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-1",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅰ—盛清御瓷新风尚（2021年12月5日）",
      "gate": "strong",
      "bucket": "strong",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "北京保利",
          "evidenceValue": "北京保利",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年12月5日",
          "evidenceValue": "2021年12月5日",
          "state": "exact",
          "note": "证据的日期落在断言主张的范围内",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "宸赏—明清御瓷珍玩",
          "evidenceValue": "禹贡Ⅰ—盛清御瓷新风尚",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 5,
        "basis": "拍卖机构：exact · 举办时间：exact · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 5
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 5
        },
        {
          "recordId": "rec-20261104-a8e3db",
          "caseId": "demo-batch-11",
          "bucket": "weak",
          "score": 5
        }
      ]
    },
    {
      "id": "g-05",
      "key": "北京保利\u00002021年12月5日\u0000中國古董珍玩專場",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "2021年12月5日",
        "sessionName": "中國古董珍玩專場"
      },
      "sentence": "北京保利 在 2021年12月5日 举办了一场名为「中國古董珍玩專場」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-1",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅰ—盛清御瓷新风尚（2021年12月5日）",
      "gate": "strong",
      "bucket": "strong",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "北京保利",
          "evidenceValue": "北京保利",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年12月5日",
          "evidenceValue": "2021年12月5日",
          "state": "exact",
          "note": "证据的日期落在断言主张的范围内",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "中國古董珍玩專場",
          "evidenceValue": "禹贡Ⅰ—盛清御瓷新风尚",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 5,
        "basis": "拍卖机构：exact · 举办时间：exact · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 5
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 5
        },
        {
          "recordId": "rec-20261104-a8e3db",
          "caseId": "demo-batch-11",
          "bucket": "weak",
          "score": 5
        }
      ]
    },
    {
      "id": "g-06",
      "key": "北京保利\u00002021年11月15日\u0000禹贡Ⅰ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "2021年11月15日",
        "sessionName": "禹贡Ⅰ—盛清御瓷新风尚"
      },
      "sentence": "北京保利 在 2021年11月15日 举办了一场名为「禹贡Ⅰ—盛清御瓷新风尚」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-1",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅰ—盛清御瓷新风尚（2021年12月5日）",
      "gate": "strong",
      "bucket": "strong",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "北京保利",
          "evidenceValue": "北京保利",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年11月15日",
          "evidenceValue": "2021年12月5日",
          "state": "conflict",
          "note": "两段时间的窗口不相交（冲突只作候选，不压成反对）",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅰ—盛清御瓷新风尚",
          "evidenceValue": "禹贡Ⅰ—盛清御瓷新风尚",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "conflict",
        "label": "冲突候选",
        "hint": "至少一维的原文值与你的说法冲突；冲突只作候选，不压成「反对」",
        "score": 4,
        "basis": "拍卖机构：exact · 举办时间：conflict · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 4
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 4
        },
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 4
        }
      ]
    },
    {
      "id": "g-07",
      "key": "北京保利\u00002021年11月15日\u0000禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "2021年11月15日",
        "sessionName": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术"
      },
      "sentence": "北京保利 在 2021年11月15日 举办了一场名为「禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "北京保利",
          "evidenceValue": "北京保利",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年11月15日",
          "evidenceValue": "2021年秋季",
          "state": "caliber",
          "note": "同一段时间的粗写与细写（证据窗口更宽）",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "caliber",
        "label": "只找到相容证据",
        "hint": "有证据，但至少一维最多只到「说法不同」——很可能是同一场，只是写法不一样，这不能算对上",
        "score": 8,
        "basis": "拍卖机构：exact · 举办时间：caliber · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 8
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 0
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 0
        }
      ]
    },
    {
      "id": "g-08",
      "key": "北京保利\u00002021年11月15日\u0000禹贡Ⅲ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "2021年11月15日",
        "sessionName": "禹贡Ⅲ—盛清御瓷新风尚"
      },
      "sentence": "北京保利 在 2021年11月15日 举办了一场名为「禹贡Ⅲ—盛清御瓷新风尚」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "北京保利",
          "evidenceValue": "北京保利",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年11月15日",
          "evidenceValue": "2021年秋季",
          "state": "caliber",
          "note": "同一段时间的粗写与细写（证据窗口更宽）",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅲ—盛清御瓷新风尚",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 4,
        "basis": "拍卖机构：exact · 举办时间：caliber · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 4
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 0
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 0
        }
      ]
    },
    {
      "id": "g-09",
      "key": "北京保利\u00002021年11月15日\u0000宸赏—明清御瓷珍玩",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "2021年11月15日",
        "sessionName": "宸赏—明清御瓷珍玩"
      },
      "sentence": "北京保利 在 2021年11月15日 举办了一场名为「宸赏—明清御瓷珍玩」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "北京保利",
          "evidenceValue": "北京保利",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年11月15日",
          "evidenceValue": "2021年秋季",
          "state": "caliber",
          "note": "同一段时间的粗写与细写（证据窗口更宽）",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "宸赏—明清御瓷珍玩",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 4,
        "basis": "拍卖机构：exact · 举办时间：caliber · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 4
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 0
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 0
        }
      ]
    },
    {
      "id": "g-10",
      "key": "北京保利\u00002021年11月15日\u0000中國古董珍玩專場",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "2021年11月15日",
        "sessionName": "中國古董珍玩專場"
      },
      "sentence": "北京保利 在 2021年11月15日 举办了一场名为「中國古董珍玩專場」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "北京保利",
          "evidenceValue": "北京保利",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年11月15日",
          "evidenceValue": "2021年秋季",
          "state": "caliber",
          "note": "同一段时间的粗写与细写（证据窗口更宽）",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "中國古董珍玩專場",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 4,
        "basis": "拍卖机构：exact · 举办时间：caliber · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 4
        },
        {
          "recordId": "rec-20261104-f584a0",
          "caseId": "demo-batch-1",
          "bucket": "not_found",
          "score": 4
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 0
        }
      ]
    },
    {
      "id": "g-11",
      "key": "北京保利\u00002021年秋季\u0000禹贡Ⅰ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "2021年秋季",
        "sessionName": "禹贡Ⅰ—盛清御瓷新风尚"
      },
      "sentence": "北京保利 在 2021年秋季 举办了一场名为「禹贡Ⅰ—盛清御瓷新风尚」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "北京保利",
          "evidenceValue": "北京保利",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年秋季",
          "evidenceValue": "2021年秋季",
          "state": "exact",
          "note": "证据的日期落在断言主张的范围内",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅰ—盛清御瓷新风尚",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 5,
        "basis": "拍卖机构：exact · 举办时间：exact · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 5
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 4
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 4
        }
      ]
    },
    {
      "id": "g-12",
      "key": "北京保利\u00002021年秋季\u0000禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "2021年秋季",
        "sessionName": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术"
      },
      "sentence": "北京保利 在 2021年秋季 举办了一场名为「禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "北京保利",
          "evidenceValue": "北京保利",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年秋季",
          "evidenceValue": "2021年秋季",
          "state": "exact",
          "note": "证据的日期落在断言主张的范围内",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "weak",
        "label": "弱坐标",
        "hint": "三个词都对上了，但撑起这条记录的独立来源不够，只到弱坐标",
        "score": 9,
        "basis": "拍卖机构：exact · 举办时间：exact · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 9
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 0
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 0
        }
      ]
    },
    {
      "id": "g-13",
      "key": "北京保利\u00002021年秋季\u0000禹贡Ⅲ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "2021年秋季",
        "sessionName": "禹贡Ⅲ—盛清御瓷新风尚"
      },
      "sentence": "北京保利 在 2021年秋季 举办了一场名为「禹贡Ⅲ—盛清御瓷新风尚」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "北京保利",
          "evidenceValue": "北京保利",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年秋季",
          "evidenceValue": "2021年秋季",
          "state": "exact",
          "note": "证据的日期落在断言主张的范围内",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅲ—盛清御瓷新风尚",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 5,
        "basis": "拍卖机构：exact · 举办时间：exact · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 5
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 0
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 0
        }
      ]
    },
    {
      "id": "g-14",
      "key": "北京保利\u00002021年秋季\u0000宸赏—明清御瓷珍玩",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "2021年秋季",
        "sessionName": "宸赏—明清御瓷珍玩"
      },
      "sentence": "北京保利 在 2021年秋季 举办了一场名为「宸赏—明清御瓷珍玩」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "北京保利",
          "evidenceValue": "北京保利",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年秋季",
          "evidenceValue": "2021年秋季",
          "state": "exact",
          "note": "证据的日期落在断言主张的范围内",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "宸赏—明清御瓷珍玩",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 5,
        "basis": "拍卖机构：exact · 举办时间：exact · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 5
        },
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 4
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 0
        }
      ]
    },
    {
      "id": "g-15",
      "key": "北京保利\u00002021年秋季\u0000中國古董珍玩專場",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "2021年秋季",
        "sessionName": "中國古董珍玩專場"
      },
      "sentence": "北京保利 在 2021年秋季 举办了一场名为「中國古董珍玩專場」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "北京保利",
          "evidenceValue": "北京保利",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年秋季",
          "evidenceValue": "2021年秋季",
          "state": "exact",
          "note": "证据的日期落在断言主张的范围内",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "中國古董珍玩專場",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 5,
        "basis": "拍卖机构：exact · 举办时间：exact · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 5
        },
        {
          "recordId": "rec-20261104-f584a0",
          "caseId": "demo-batch-1",
          "bucket": "not_found",
          "score": 4
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 0
        }
      ]
    },
    {
      "id": "g-16",
      "key": "北京保利\u00002021年8月\u0000禹贡Ⅰ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "2021年8月",
        "sessionName": "禹贡Ⅰ—盛清御瓷新风尚"
      },
      "sentence": "北京保利 在 2021年8月 举办了一场名为「禹贡Ⅰ—盛清御瓷新风尚」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-1",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅰ—盛清御瓷新风尚（2021年12月5日）",
      "gate": "strong",
      "bucket": "strong",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "北京保利",
          "evidenceValue": "北京保利",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年8月",
          "evidenceValue": "2021年12月5日",
          "state": "conflict",
          "note": "两段时间的窗口不相交（冲突只作候选，不压成反对）",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅰ—盛清御瓷新风尚",
          "evidenceValue": "禹贡Ⅰ—盛清御瓷新风尚",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "conflict",
        "label": "冲突候选",
        "hint": "至少一维的原文值与你的说法冲突；冲突只作候选，不压成「反对」",
        "score": 4,
        "basis": "拍卖机构：exact · 举办时间：conflict · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 4
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 4
        },
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 4
        }
      ]
    },
    {
      "id": "g-17",
      "key": "北京保利\u00002021年8月\u0000禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "2021年8月",
        "sessionName": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术"
      },
      "sentence": "北京保利 在 2021年8月 举办了一场名为「禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "北京保利",
          "evidenceValue": "北京保利",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年8月",
          "evidenceValue": "2021年秋季",
          "state": "caliber",
          "note": "月份紧贴证据季节的开场边界，属于季节词写法的提前量",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "caliber",
        "label": "只找到相容证据",
        "hint": "有证据，但至少一维最多只到「说法不同」——很可能是同一场，只是写法不一样，这不能算对上",
        "score": 8,
        "basis": "拍卖机构：exact · 举办时间：caliber · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 8
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 0
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 0
        }
      ]
    },
    {
      "id": "g-18",
      "key": "北京保利\u00002021年8月\u0000禹贡Ⅲ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "2021年8月",
        "sessionName": "禹贡Ⅲ—盛清御瓷新风尚"
      },
      "sentence": "北京保利 在 2021年8月 举办了一场名为「禹贡Ⅲ—盛清御瓷新风尚」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "北京保利",
          "evidenceValue": "北京保利",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年8月",
          "evidenceValue": "2021年秋季",
          "state": "caliber",
          "note": "月份紧贴证据季节的开场边界，属于季节词写法的提前量",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅲ—盛清御瓷新风尚",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 4,
        "basis": "拍卖机构：exact · 举办时间：caliber · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 4
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 0
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 0
        }
      ]
    },
    {
      "id": "g-19",
      "key": "北京保利\u00002021年8月\u0000宸赏—明清御瓷珍玩",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "2021年8月",
        "sessionName": "宸赏—明清御瓷珍玩"
      },
      "sentence": "北京保利 在 2021年8月 举办了一场名为「宸赏—明清御瓷珍玩」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "北京保利",
          "evidenceValue": "北京保利",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年8月",
          "evidenceValue": "2021年秋季",
          "state": "caliber",
          "note": "月份紧贴证据季节的开场边界，属于季节词写法的提前量",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "宸赏—明清御瓷珍玩",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 4,
        "basis": "拍卖机构：exact · 举办时间：caliber · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 4
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 0
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 0
        }
      ]
    },
    {
      "id": "g-20",
      "key": "北京保利\u00002021年8月\u0000中國古董珍玩專場",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "2021年8月",
        "sessionName": "中國古董珍玩專場"
      },
      "sentence": "北京保利 在 2021年8月 举办了一场名为「中國古董珍玩專場」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "北京保利",
          "evidenceValue": "北京保利",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年8月",
          "evidenceValue": "2021年秋季",
          "state": "caliber",
          "note": "月份紧贴证据季节的开场边界，属于季节词写法的提前量",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "中國古董珍玩專場",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 4,
        "basis": "拍卖机构：exact · 举办时间：caliber · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 4
        },
        {
          "recordId": "rec-20261104-f584a0",
          "caseId": "demo-batch-1",
          "bucket": "not_found",
          "score": 4
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 0
        }
      ]
    },
    {
      "id": "g-21",
      "key": "北京保利\u0000去年秋天\u0000禹贡Ⅰ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "去年秋天",
        "sessionName": "禹贡Ⅰ—盛清御瓷新风尚"
      },
      "sentence": "北京保利 在 去年秋天 举办了一场名为「禹贡Ⅰ—盛清御瓷新风尚」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-1",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅰ—盛清御瓷新风尚（2021年12月5日）",
      "gate": "strong",
      "bucket": "strong",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "北京保利",
          "evidenceValue": "北京保利",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "去年秋天",
          "evidenceValue": "2021年12月5日",
          "state": "unknown",
          "note": "时间写法解析不出，判不了",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅰ—盛清御瓷新风尚",
          "evidenceValue": "禹贡Ⅰ—盛清御瓷新风尚",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "unknown",
        "label": "无从判断",
        "hint": "至少一维的说法解析不出来，判不了",
        "score": 6,
        "basis": "拍卖机构：exact · 举办时间：unknown · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 6
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 6
        },
        {
          "recordId": "rec-20261104-a8e3db",
          "caseId": "demo-batch-11",
          "bucket": "weak",
          "score": 6
        }
      ]
    },
    {
      "id": "g-22",
      "key": "北京保利\u0000去年秋天\u0000禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "去年秋天",
        "sessionName": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术"
      },
      "sentence": "北京保利 在 去年秋天 举办了一场名为「禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "北京保利",
          "evidenceValue": "北京保利",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "去年秋天",
          "evidenceValue": "2021年秋季",
          "state": "unknown",
          "note": "时间写法解析不出，判不了",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "unknown",
        "label": "无从判断",
        "hint": "至少一维的说法解析不出来，判不了",
        "score": 6,
        "basis": "拍卖机构：exact · 举办时间：unknown · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 6
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 2
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 2
        }
      ]
    },
    {
      "id": "g-23",
      "key": "北京保利\u0000去年秋天\u0000禹贡Ⅲ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "去年秋天",
        "sessionName": "禹贡Ⅲ—盛清御瓷新风尚"
      },
      "sentence": "北京保利 在 去年秋天 举办了一场名为「禹贡Ⅲ—盛清御瓷新风尚」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "recordTitle": null,
      "gate": null,
      "bucket": null,
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "北京保利",
          "evidenceValue": "北京保利",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "去年秋天",
          "evidenceValue": "2021年12月5日",
          "state": "unknown",
          "note": "时间写法解析不出，判不了",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅲ—盛清御瓷新风尚",
          "evidenceValue": "禹贡Ⅰ—盛清御瓷新风尚",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "uncovered",
        "label": "这批证据没覆盖",
        "hint": "没有任何一条冻结记录同时在两个词上对上或相容",
        "score": 2,
        "basis": "拍卖机构：exact · 举办时间：unknown · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 2
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 2
        },
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 2
        }
      ]
    },
    {
      "id": "g-24",
      "key": "北京保利\u0000去年秋天\u0000宸赏—明清御瓷珍玩",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "去年秋天",
        "sessionName": "宸赏—明清御瓷珍玩"
      },
      "sentence": "北京保利 在 去年秋天 举办了一场名为「宸赏—明清御瓷珍玩」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "recordTitle": null,
      "gate": null,
      "bucket": null,
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "北京保利",
          "evidenceValue": "北京保利",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "去年秋天",
          "evidenceValue": "2021年12月5日",
          "state": "unknown",
          "note": "时间写法解析不出，判不了",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "宸赏—明清御瓷珍玩",
          "evidenceValue": "禹贡Ⅰ—盛清御瓷新风尚",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "uncovered",
        "label": "这批证据没覆盖",
        "hint": "没有任何一条冻结记录同时在两个词上对上或相容",
        "score": 2,
        "basis": "拍卖机构：exact · 举办时间：unknown · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 2
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 2
        },
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 2
        }
      ]
    },
    {
      "id": "g-25",
      "key": "北京保利\u0000去年秋天\u0000中國古董珍玩專場",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "去年秋天",
        "sessionName": "中國古董珍玩專場"
      },
      "sentence": "北京保利 在 去年秋天 举办了一场名为「中國古董珍玩專場」的拍卖会。",
      "status": "covered",
      "recordId": "rec-20261104-f584a0",
      "caseId": "demo-batch-1",
      "recordTitle": "保利香港拍賣 · 中國古董珍玩專場（2022年7月14日）",
      "gate": "rejected",
      "bucket": "not_found",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "北京保利",
          "evidenceValue": "北京保利",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "去年秋天",
          "evidenceValue": "2022年秋季",
          "state": "unknown",
          "note": "时间写法解析不出，判不了",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "中國古董珍玩專場",
          "evidenceValue": "中國古董珍玩專場",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "unknown",
        "label": "无从判断",
        "hint": "至少一维的说法解析不出来，判不了",
        "score": 6,
        "basis": "拍卖机构：exact · 举办时间：unknown · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-20261104-f584a0",
          "caseId": "demo-batch-1",
          "bucket": "not_found",
          "score": 6
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 2
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 2
        }
      ]
    },
    {
      "id": "g-26",
      "key": "中国嘉德国际拍卖有限公司\u00002021年12月5日\u0000禹贡Ⅰ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "中国嘉德国际拍卖有限公司",
        "dateText": "2021年12月5日",
        "sessionName": "禹贡Ⅰ—盛清御瓷新风尚"
      },
      "sentence": "中国嘉德国际拍卖有限公司 在 2021年12月5日 举办了一场名为「禹贡Ⅰ—盛清御瓷新风尚」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-1",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅰ—盛清御瓷新风尚（2021年12月5日）",
      "gate": "strong",
      "bucket": "strong",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "中国嘉德国际拍卖有限公司",
          "evidenceValue": "北京保利",
          "state": "mismatch",
          "note": "不是同一家机构",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年12月5日",
          "evidenceValue": "2021年12月5日",
          "state": "exact",
          "note": "证据的日期落在断言主张的范围内",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅰ—盛清御瓷新风尚",
          "evidenceValue": "禹贡Ⅰ—盛清御瓷新风尚",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 5,
        "basis": "拍卖机构：mismatch · 举办时间：exact · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 5
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 5
        },
        {
          "recordId": "rec-20261104-a8e3db",
          "caseId": "demo-batch-11",
          "bucket": "weak",
          "score": 5
        }
      ]
    },
    {
      "id": "g-27",
      "key": "中国嘉德国际拍卖有限公司\u00002021年12月5日\u0000禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
      "values": {
        "auctionHouse": "中国嘉德国际拍卖有限公司",
        "dateText": "2021年12月5日",
        "sessionName": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术"
      },
      "sentence": "中国嘉德国际拍卖有限公司 在 2021年12月5日 举办了一场名为「禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术」的拍卖会。",
      "status": "covered",
      "recordId": "rec-20261104-bb1fe7",
      "caseId": "demo-batch-3",
      "recordTitle": "中国嘉德国际拍卖有限公司 · 宸赏—明清御瓷珍玩（2021年11月26日至12月13日）",
      "gate": "rejected",
      "bucket": "refuted",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "中国嘉德国际拍卖有限公司",
          "evidenceValue": "中国嘉德",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年12月5日",
          "evidenceValue": "2021年11月26日至12月13日",
          "state": "caliber",
          "note": "同一段时间的粗写与细写（证据窗口更宽）",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "evidenceValue": "宸赏—明清御瓷珍玩",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 4,
        "basis": "拍卖机构：exact · 举办时间：caliber · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 4
        },
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 3
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 1
        }
      ]
    },
    {
      "id": "g-28",
      "key": "中国嘉德国际拍卖有限公司\u00002021年12月5日\u0000禹贡Ⅲ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "中国嘉德国际拍卖有限公司",
        "dateText": "2021年12月5日",
        "sessionName": "禹贡Ⅲ—盛清御瓷新风尚"
      },
      "sentence": "中国嘉德国际拍卖有限公司 在 2021年12月5日 举办了一场名为「禹贡Ⅲ—盛清御瓷新风尚」的拍卖会。",
      "status": "covered",
      "recordId": "rec-20261104-bb1fe7",
      "caseId": "demo-batch-3",
      "recordTitle": "中国嘉德国际拍卖有限公司 · 宸赏—明清御瓷珍玩（2021年11月26日至12月13日）",
      "gate": "rejected",
      "bucket": "refuted",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "中国嘉德国际拍卖有限公司",
          "evidenceValue": "中国嘉德",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年12月5日",
          "evidenceValue": "2021年11月26日至12月13日",
          "state": "caliber",
          "note": "同一段时间的粗写与细写（证据窗口更宽）",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅲ—盛清御瓷新风尚",
          "evidenceValue": "宸赏—明清御瓷珍玩",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 4,
        "basis": "拍卖机构：exact · 举办时间：caliber · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 4
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 1
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 1
        }
      ]
    },
    {
      "id": "g-29",
      "key": "中国嘉德国际拍卖有限公司\u00002021年12月5日\u0000宸赏—明清御瓷珍玩",
      "values": {
        "auctionHouse": "中国嘉德国际拍卖有限公司",
        "dateText": "2021年12月5日",
        "sessionName": "宸赏—明清御瓷珍玩"
      },
      "sentence": "中国嘉德国际拍卖有限公司 在 2021年12月5日 举办了一场名为「宸赏—明清御瓷珍玩」的拍卖会。",
      "status": "covered",
      "recordId": "rec-20261104-bb1fe7",
      "caseId": "demo-batch-3",
      "recordTitle": "中国嘉德国际拍卖有限公司 · 宸赏—明清御瓷珍玩（2021年11月26日至12月13日）",
      "gate": "rejected",
      "bucket": "refuted",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "中国嘉德国际拍卖有限公司",
          "evidenceValue": "中国嘉德",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年12月5日",
          "evidenceValue": "2021年11月26日至12月13日",
          "state": "caliber",
          "note": "同一段时间的粗写与细写（证据窗口更宽）",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "宸赏—明清御瓷珍玩",
          "evidenceValue": "宸赏—明清御瓷珍玩",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "caliber",
        "label": "只找到相容证据",
        "hint": "有证据，但至少一维最多只到「说法不同」——很可能是同一场，只是写法不一样，这不能算对上",
        "score": 8,
        "basis": "拍卖机构：exact · 举办时间：caliber · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 8
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 1
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 1
        }
      ]
    },
    {
      "id": "g-30",
      "key": "中国嘉德国际拍卖有限公司\u00002021年12月5日\u0000中國古董珍玩專場",
      "values": {
        "auctionHouse": "中国嘉德国际拍卖有限公司",
        "dateText": "2021年12月5日",
        "sessionName": "中國古董珍玩專場"
      },
      "sentence": "中国嘉德国际拍卖有限公司 在 2021年12月5日 举办了一场名为「中國古董珍玩專場」的拍卖会。",
      "status": "covered",
      "recordId": "rec-20261104-bb1fe7",
      "caseId": "demo-batch-3",
      "recordTitle": "中国嘉德国际拍卖有限公司 · 宸赏—明清御瓷珍玩（2021年11月26日至12月13日）",
      "gate": "rejected",
      "bucket": "refuted",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "中国嘉德国际拍卖有限公司",
          "evidenceValue": "中国嘉德",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年12月5日",
          "evidenceValue": "2021年11月26日至12月13日",
          "state": "caliber",
          "note": "同一段时间的粗写与细写（证据窗口更宽）",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "中國古董珍玩專場",
          "evidenceValue": "宸赏—明清御瓷珍玩",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 4,
        "basis": "拍卖机构：exact · 举办时间：caliber · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 4
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 1
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 1
        }
      ]
    },
    {
      "id": "g-31",
      "key": "中国嘉德国际拍卖有限公司\u00002021年11月15日\u0000禹贡Ⅰ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "中国嘉德国际拍卖有限公司",
        "dateText": "2021年11月15日",
        "sessionName": "禹贡Ⅰ—盛清御瓷新风尚"
      },
      "sentence": "中国嘉德国际拍卖有限公司 在 2021年11月15日 举办了一场名为「禹贡Ⅰ—盛清御瓷新风尚」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "recordTitle": null,
      "gate": null,
      "bucket": null,
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "中国嘉德国际拍卖有限公司",
          "evidenceValue": "北京保利",
          "state": "mismatch",
          "note": "不是同一家机构",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年11月15日",
          "evidenceValue": "2021年12月5日",
          "state": "conflict",
          "note": "两段时间的窗口不相交（冲突只作候选，不压成反对）",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅰ—盛清御瓷新风尚",
          "evidenceValue": "禹贡Ⅰ—盛清御瓷新风尚",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "uncovered",
        "label": "这批证据没覆盖",
        "hint": "没有任何一条冻结记录同时在两个词上对上或相容",
        "score": 0,
        "basis": "拍卖机构：mismatch · 举办时间：conflict · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 0
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 0
        },
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 0
        }
      ]
    },
    {
      "id": "g-32",
      "key": "中国嘉德国际拍卖有限公司\u00002021年11月15日\u0000禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
      "values": {
        "auctionHouse": "中国嘉德国际拍卖有限公司",
        "dateText": "2021年11月15日",
        "sessionName": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术"
      },
      "sentence": "中国嘉德国际拍卖有限公司 在 2021年11月15日 举办了一场名为「禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "中国嘉德国际拍卖有限公司",
          "evidenceValue": "北京保利",
          "state": "mismatch",
          "note": "不是同一家机构",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年11月15日",
          "evidenceValue": "2021年秋季",
          "state": "caliber",
          "note": "同一段时间的粗写与细写（证据窗口更宽）",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 4,
        "basis": "拍卖机构：mismatch · 举办时间：caliber · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 4
        },
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 0
        },
        {
          "recordId": "rec-20261104-9863c4",
          "caseId": "demo-batch-8",
          "bucket": "not_found",
          "score": 0
        }
      ]
    },
    {
      "id": "g-33",
      "key": "中国嘉德国际拍卖有限公司\u00002021年11月15日\u0000禹贡Ⅲ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "中国嘉德国际拍卖有限公司",
        "dateText": "2021年11月15日",
        "sessionName": "禹贡Ⅲ—盛清御瓷新风尚"
      },
      "sentence": "中国嘉德国际拍卖有限公司 在 2021年11月15日 举办了一场名为「禹贡Ⅲ—盛清御瓷新风尚」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "recordTitle": null,
      "gate": null,
      "bucket": null,
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "中国嘉德国际拍卖有限公司",
          "evidenceValue": "北京保利",
          "state": "mismatch",
          "note": "不是同一家机构",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年11月15日",
          "evidenceValue": "2021年秋季",
          "state": "caliber",
          "note": "同一段时间的粗写与细写（证据窗口更宽）",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅲ—盛清御瓷新风尚",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "uncovered",
        "label": "这批证据没覆盖",
        "hint": "没有任何一条冻结记录同时在两个词上对上或相容",
        "score": 0,
        "basis": "拍卖机构：mismatch · 举办时间：caliber · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 0
        },
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 0
        },
        {
          "recordId": "rec-20261104-9863c4",
          "caseId": "demo-batch-8",
          "bucket": "not_found",
          "score": 0
        }
      ]
    },
    {
      "id": "g-34",
      "key": "中国嘉德国际拍卖有限公司\u00002021年11月15日\u0000宸赏—明清御瓷珍玩",
      "values": {
        "auctionHouse": "中国嘉德国际拍卖有限公司",
        "dateText": "2021年11月15日",
        "sessionName": "宸赏—明清御瓷珍玩"
      },
      "sentence": "中国嘉德国际拍卖有限公司 在 2021年11月15日 举办了一场名为「宸赏—明清御瓷珍玩」的拍卖会。",
      "status": "covered",
      "recordId": "rec-20261104-bb1fe7",
      "caseId": "demo-batch-3",
      "recordTitle": "中国嘉德国际拍卖有限公司 · 宸赏—明清御瓷珍玩（2021年11月26日至12月13日）",
      "gate": "rejected",
      "bucket": "refuted",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "中国嘉德国际拍卖有限公司",
          "evidenceValue": "中国嘉德",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年11月15日",
          "evidenceValue": "2021年11月26日至12月13日",
          "state": "conflict",
          "note": "两段时间的窗口不相交（冲突只作候选，不压成反对）",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "宸赏—明清御瓷珍玩",
          "evidenceValue": "宸赏—明清御瓷珍玩",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "conflict",
        "label": "冲突候选",
        "hint": "至少一维的原文值与你的说法冲突；冲突只作候选，不压成「反对」",
        "score": 4,
        "basis": "拍卖机构：exact · 举办时间：conflict · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 4
        },
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 0
        },
        {
          "recordId": "rec-20261104-9863c4",
          "caseId": "demo-batch-8",
          "bucket": "not_found",
          "score": 0
        }
      ]
    },
    {
      "id": "g-35",
      "key": "中国嘉德国际拍卖有限公司\u00002021年11月15日\u0000中國古董珍玩專場",
      "values": {
        "auctionHouse": "中国嘉德国际拍卖有限公司",
        "dateText": "2021年11月15日",
        "sessionName": "中國古董珍玩專場"
      },
      "sentence": "中国嘉德国际拍卖有限公司 在 2021年11月15日 举办了一场名为「中國古董珍玩專場」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "recordTitle": null,
      "gate": null,
      "bucket": null,
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "中国嘉德国际拍卖有限公司",
          "evidenceValue": "北京保利",
          "state": "mismatch",
          "note": "不是同一家机构",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年11月15日",
          "evidenceValue": "2021年秋季",
          "state": "caliber",
          "note": "同一段时间的粗写与细写（证据窗口更宽）",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "中國古董珍玩專場",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "uncovered",
        "label": "这批证据没覆盖",
        "hint": "没有任何一条冻结记录同时在两个词上对上或相容",
        "score": 0,
        "basis": "拍卖机构：mismatch · 举办时间：caliber · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 0
        },
        {
          "recordId": "rec-20261104-f584a0",
          "caseId": "demo-batch-1",
          "bucket": "not_found",
          "score": 0
        },
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 0
        }
      ]
    },
    {
      "id": "g-36",
      "key": "中国嘉德国际拍卖有限公司\u00002021年秋季\u0000禹贡Ⅰ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "中国嘉德国际拍卖有限公司",
        "dateText": "2021年秋季",
        "sessionName": "禹贡Ⅰ—盛清御瓷新风尚"
      },
      "sentence": "中国嘉德国际拍卖有限公司 在 2021年秋季 举办了一场名为「禹贡Ⅰ—盛清御瓷新风尚」的拍卖会。",
      "status": "covered",
      "recordId": "rec-20261104-bb1fe7",
      "caseId": "demo-batch-3",
      "recordTitle": "中国嘉德国际拍卖有限公司 · 宸赏—明清御瓷珍玩（2021年11月26日至12月13日）",
      "gate": "rejected",
      "bucket": "refuted",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "中国嘉德国际拍卖有限公司",
          "evidenceValue": "中国嘉德",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年秋季",
          "evidenceValue": "2021年11月26日至12月13日",
          "state": "caliber",
          "note": "同一段时间的粗写与细写（证据窗口更宽）",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅰ—盛清御瓷新风尚",
          "evidenceValue": "宸赏—明清御瓷珍玩",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 4,
        "basis": "拍卖机构：exact · 举办时间：caliber · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 4
        },
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 1
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 0
        }
      ]
    },
    {
      "id": "g-37",
      "key": "中国嘉德国际拍卖有限公司\u00002021年秋季\u0000禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
      "values": {
        "auctionHouse": "中国嘉德国际拍卖有限公司",
        "dateText": "2021年秋季",
        "sessionName": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术"
      },
      "sentence": "中国嘉德国际拍卖有限公司 在 2021年秋季 举办了一场名为「禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "中国嘉德国际拍卖有限公司",
          "evidenceValue": "北京保利",
          "state": "mismatch",
          "note": "不是同一家机构",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年秋季",
          "evidenceValue": "2021年秋季",
          "state": "exact",
          "note": "证据的日期落在断言主张的范围内",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 5,
        "basis": "拍卖机构：mismatch · 举办时间：exact · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 5
        },
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 4
        },
        {
          "recordId": "rec-20261104-9863c4",
          "caseId": "demo-batch-8",
          "bucket": "not_found",
          "score": 0
        }
      ]
    },
    {
      "id": "g-38",
      "key": "中国嘉德国际拍卖有限公司\u00002021年秋季\u0000禹贡Ⅲ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "中国嘉德国际拍卖有限公司",
        "dateText": "2021年秋季",
        "sessionName": "禹贡Ⅲ—盛清御瓷新风尚"
      },
      "sentence": "中国嘉德国际拍卖有限公司 在 2021年秋季 举办了一场名为「禹贡Ⅲ—盛清御瓷新风尚」的拍卖会。",
      "status": "covered",
      "recordId": "rec-20261104-bb1fe7",
      "caseId": "demo-batch-3",
      "recordTitle": "中国嘉德国际拍卖有限公司 · 宸赏—明清御瓷珍玩（2021年11月26日至12月13日）",
      "gate": "rejected",
      "bucket": "refuted",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "中国嘉德国际拍卖有限公司",
          "evidenceValue": "中国嘉德",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年秋季",
          "evidenceValue": "2021年11月26日至12月13日",
          "state": "caliber",
          "note": "同一段时间的粗写与细写（证据窗口更宽）",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅲ—盛清御瓷新风尚",
          "evidenceValue": "宸赏—明清御瓷珍玩",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 4,
        "basis": "拍卖机构：exact · 举办时间：caliber · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 4
        },
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 1
        },
        {
          "recordId": "rec-20261104-9863c4",
          "caseId": "demo-batch-8",
          "bucket": "not_found",
          "score": 0
        }
      ]
    },
    {
      "id": "g-39",
      "key": "中国嘉德国际拍卖有限公司\u00002021年秋季\u0000宸赏—明清御瓷珍玩",
      "values": {
        "auctionHouse": "中国嘉德国际拍卖有限公司",
        "dateText": "2021年秋季",
        "sessionName": "宸赏—明清御瓷珍玩"
      },
      "sentence": "中国嘉德国际拍卖有限公司 在 2021年秋季 举办了一场名为「宸赏—明清御瓷珍玩」的拍卖会。",
      "status": "covered",
      "recordId": "rec-20261104-bb1fe7",
      "caseId": "demo-batch-3",
      "recordTitle": "中国嘉德国际拍卖有限公司 · 宸赏—明清御瓷珍玩（2021年11月26日至12月13日）",
      "gate": "rejected",
      "bucket": "refuted",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "中国嘉德国际拍卖有限公司",
          "evidenceValue": "中国嘉德",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年秋季",
          "evidenceValue": "2021年11月26日至12月13日",
          "state": "caliber",
          "note": "同一段时间的粗写与细写（证据窗口更宽）",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "宸赏—明清御瓷珍玩",
          "evidenceValue": "宸赏—明清御瓷珍玩",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "caliber",
        "label": "只找到相容证据",
        "hint": "有证据，但至少一维最多只到「说法不同」——很可能是同一场，只是写法不一样，这不能算对上",
        "score": 8,
        "basis": "拍卖机构：exact · 举办时间：caliber · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 8
        },
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 1
        },
        {
          "recordId": "rec-20261104-9863c4",
          "caseId": "demo-batch-8",
          "bucket": "not_found",
          "score": 0
        }
      ]
    },
    {
      "id": "g-40",
      "key": "中国嘉德国际拍卖有限公司\u00002021年秋季\u0000中國古董珍玩專場",
      "values": {
        "auctionHouse": "中国嘉德国际拍卖有限公司",
        "dateText": "2021年秋季",
        "sessionName": "中國古董珍玩專場"
      },
      "sentence": "中国嘉德国际拍卖有限公司 在 2021年秋季 举办了一场名为「中國古董珍玩專場」的拍卖会。",
      "status": "covered",
      "recordId": "rec-20261104-bb1fe7",
      "caseId": "demo-batch-3",
      "recordTitle": "中国嘉德国际拍卖有限公司 · 宸赏—明清御瓷珍玩（2021年11月26日至12月13日）",
      "gate": "rejected",
      "bucket": "refuted",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "中国嘉德国际拍卖有限公司",
          "evidenceValue": "中国嘉德",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年秋季",
          "evidenceValue": "2021年11月26日至12月13日",
          "state": "caliber",
          "note": "同一段时间的粗写与细写（证据窗口更宽）",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "中國古董珍玩專場",
          "evidenceValue": "宸赏—明清御瓷珍玩",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 4,
        "basis": "拍卖机构：exact · 举办时间：caliber · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 4
        },
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 1
        },
        {
          "recordId": "rec-20261104-f584a0",
          "caseId": "demo-batch-1",
          "bucket": "not_found",
          "score": 0
        }
      ]
    },
    {
      "id": "g-41",
      "key": "中国嘉德国际拍卖有限公司\u00002021年8月\u0000禹贡Ⅰ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "中国嘉德国际拍卖有限公司",
        "dateText": "2021年8月",
        "sessionName": "禹贡Ⅰ—盛清御瓷新风尚"
      },
      "sentence": "中国嘉德国际拍卖有限公司 在 2021年8月 举办了一场名为「禹贡Ⅰ—盛清御瓷新风尚」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "recordTitle": null,
      "gate": null,
      "bucket": null,
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "中国嘉德国际拍卖有限公司",
          "evidenceValue": "北京保利",
          "state": "mismatch",
          "note": "不是同一家机构",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年8月",
          "evidenceValue": "2021年12月5日",
          "state": "conflict",
          "note": "两段时间的窗口不相交（冲突只作候选，不压成反对）",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅰ—盛清御瓷新风尚",
          "evidenceValue": "禹贡Ⅰ—盛清御瓷新风尚",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "uncovered",
        "label": "这批证据没覆盖",
        "hint": "没有任何一条冻结记录同时在两个词上对上或相容",
        "score": 0,
        "basis": "拍卖机构：mismatch · 举办时间：conflict · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 0
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 0
        },
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 0
        }
      ]
    },
    {
      "id": "g-42",
      "key": "中国嘉德国际拍卖有限公司\u00002021年8月\u0000禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
      "values": {
        "auctionHouse": "中国嘉德国际拍卖有限公司",
        "dateText": "2021年8月",
        "sessionName": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术"
      },
      "sentence": "中国嘉德国际拍卖有限公司 在 2021年8月 举办了一场名为「禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "中国嘉德国际拍卖有限公司",
          "evidenceValue": "北京保利",
          "state": "mismatch",
          "note": "不是同一家机构",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年8月",
          "evidenceValue": "2021年秋季",
          "state": "caliber",
          "note": "月份紧贴证据季节的开场边界，属于季节词写法的提前量",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 4,
        "basis": "拍卖机构：mismatch · 举办时间：caliber · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 4
        },
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 0
        },
        {
          "recordId": "rec-20261104-9863c4",
          "caseId": "demo-batch-8",
          "bucket": "not_found",
          "score": 0
        }
      ]
    },
    {
      "id": "g-43",
      "key": "中国嘉德国际拍卖有限公司\u00002021年8月\u0000禹贡Ⅲ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "中国嘉德国际拍卖有限公司",
        "dateText": "2021年8月",
        "sessionName": "禹贡Ⅲ—盛清御瓷新风尚"
      },
      "sentence": "中国嘉德国际拍卖有限公司 在 2021年8月 举办了一场名为「禹贡Ⅲ—盛清御瓷新风尚」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "recordTitle": null,
      "gate": null,
      "bucket": null,
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "中国嘉德国际拍卖有限公司",
          "evidenceValue": "北京保利",
          "state": "mismatch",
          "note": "不是同一家机构",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年8月",
          "evidenceValue": "2021年秋季",
          "state": "caliber",
          "note": "月份紧贴证据季节的开场边界，属于季节词写法的提前量",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅲ—盛清御瓷新风尚",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "uncovered",
        "label": "这批证据没覆盖",
        "hint": "没有任何一条冻结记录同时在两个词上对上或相容",
        "score": 0,
        "basis": "拍卖机构：mismatch · 举办时间：caliber · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 0
        },
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 0
        },
        {
          "recordId": "rec-20261104-9863c4",
          "caseId": "demo-batch-8",
          "bucket": "not_found",
          "score": 0
        }
      ]
    },
    {
      "id": "g-44",
      "key": "中国嘉德国际拍卖有限公司\u00002021年8月\u0000宸赏—明清御瓷珍玩",
      "values": {
        "auctionHouse": "中国嘉德国际拍卖有限公司",
        "dateText": "2021年8月",
        "sessionName": "宸赏—明清御瓷珍玩"
      },
      "sentence": "中国嘉德国际拍卖有限公司 在 2021年8月 举办了一场名为「宸赏—明清御瓷珍玩」的拍卖会。",
      "status": "covered",
      "recordId": "rec-20261104-bb1fe7",
      "caseId": "demo-batch-3",
      "recordTitle": "中国嘉德国际拍卖有限公司 · 宸赏—明清御瓷珍玩（2021年11月26日至12月13日）",
      "gate": "rejected",
      "bucket": "refuted",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "中国嘉德国际拍卖有限公司",
          "evidenceValue": "中国嘉德",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年8月",
          "evidenceValue": "2021年11月26日至12月13日",
          "state": "conflict",
          "note": "两段时间的窗口不相交（冲突只作候选，不压成反对）",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "宸赏—明清御瓷珍玩",
          "evidenceValue": "宸赏—明清御瓷珍玩",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "conflict",
        "label": "冲突候选",
        "hint": "至少一维的原文值与你的说法冲突；冲突只作候选，不压成「反对」",
        "score": 4,
        "basis": "拍卖机构：exact · 举办时间：conflict · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 4
        },
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 0
        },
        {
          "recordId": "rec-20261104-9863c4",
          "caseId": "demo-batch-8",
          "bucket": "not_found",
          "score": 0
        }
      ]
    },
    {
      "id": "g-45",
      "key": "中国嘉德国际拍卖有限公司\u00002021年8月\u0000中國古董珍玩專場",
      "values": {
        "auctionHouse": "中国嘉德国际拍卖有限公司",
        "dateText": "2021年8月",
        "sessionName": "中國古董珍玩專場"
      },
      "sentence": "中国嘉德国际拍卖有限公司 在 2021年8月 举办了一场名为「中國古董珍玩專場」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "recordTitle": null,
      "gate": null,
      "bucket": null,
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "中国嘉德国际拍卖有限公司",
          "evidenceValue": "北京保利",
          "state": "mismatch",
          "note": "不是同一家机构",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年8月",
          "evidenceValue": "2021年秋季",
          "state": "caliber",
          "note": "月份紧贴证据季节的开场边界，属于季节词写法的提前量",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "中國古董珍玩專場",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "uncovered",
        "label": "这批证据没覆盖",
        "hint": "没有任何一条冻结记录同时在两个词上对上或相容",
        "score": 0,
        "basis": "拍卖机构：mismatch · 举办时间：caliber · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 0
        },
        {
          "recordId": "rec-20261104-f584a0",
          "caseId": "demo-batch-1",
          "bucket": "not_found",
          "score": 0
        },
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 0
        }
      ]
    },
    {
      "id": "g-46",
      "key": "中国嘉德国际拍卖有限公司\u0000去年秋天\u0000禹贡Ⅰ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "中国嘉德国际拍卖有限公司",
        "dateText": "去年秋天",
        "sessionName": "禹贡Ⅰ—盛清御瓷新风尚"
      },
      "sentence": "中国嘉德国际拍卖有限公司 在 去年秋天 举办了一场名为「禹贡Ⅰ—盛清御瓷新风尚」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "recordTitle": null,
      "gate": null,
      "bucket": null,
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "中国嘉德国际拍卖有限公司",
          "evidenceValue": "北京保利",
          "state": "mismatch",
          "note": "不是同一家机构",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "去年秋天",
          "evidenceValue": "2021年12月5日",
          "state": "unknown",
          "note": "时间写法解析不出，判不了",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅰ—盛清御瓷新风尚",
          "evidenceValue": "禹贡Ⅰ—盛清御瓷新风尚",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "uncovered",
        "label": "这批证据没覆盖",
        "hint": "没有任何一条冻结记录同时在两个词上对上或相容",
        "score": 2,
        "basis": "拍卖机构：mismatch · 举办时间：unknown · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 2
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 2
        },
        {
          "recordId": "rec-20261104-a8e3db",
          "caseId": "demo-batch-11",
          "bucket": "weak",
          "score": 2
        }
      ]
    },
    {
      "id": "g-47",
      "key": "中国嘉德国际拍卖有限公司\u0000去年秋天\u0000禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
      "values": {
        "auctionHouse": "中国嘉德国际拍卖有限公司",
        "dateText": "去年秋天",
        "sessionName": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术"
      },
      "sentence": "中国嘉德国际拍卖有限公司 在 去年秋天 举办了一场名为「禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "recordTitle": null,
      "gate": null,
      "bucket": null,
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "中国嘉德国际拍卖有限公司",
          "evidenceValue": "北京保利",
          "state": "mismatch",
          "note": "不是同一家机构",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "去年秋天",
          "evidenceValue": "2021年秋季",
          "state": "unknown",
          "note": "时间写法解析不出，判不了",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "uncovered",
        "label": "这批证据没覆盖",
        "hint": "没有任何一条冻结记录同时在两个词上对上或相容",
        "score": 2,
        "basis": "拍卖机构：mismatch · 举办时间：unknown · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 2
        },
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 2
        },
        {
          "recordId": "rec-20261104-9863c4",
          "caseId": "demo-batch-8",
          "bucket": "not_found",
          "score": 2
        }
      ]
    },
    {
      "id": "g-48",
      "key": "中国嘉德国际拍卖有限公司\u0000去年秋天\u0000禹贡Ⅲ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "中国嘉德国际拍卖有限公司",
        "dateText": "去年秋天",
        "sessionName": "禹贡Ⅲ—盛清御瓷新风尚"
      },
      "sentence": "中国嘉德国际拍卖有限公司 在 去年秋天 举办了一场名为「禹贡Ⅲ—盛清御瓷新风尚」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "recordTitle": null,
      "gate": null,
      "bucket": null,
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "中国嘉德国际拍卖有限公司",
          "evidenceValue": "中国嘉德",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "去年秋天",
          "evidenceValue": "2021年11月26日至12月13日",
          "state": "unknown",
          "note": "时间写法解析不出，判不了",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅲ—盛清御瓷新风尚",
          "evidenceValue": "宸赏—明清御瓷珍玩",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "uncovered",
        "label": "这批证据没覆盖",
        "hint": "没有任何一条冻结记录同时在两个词上对上或相容",
        "score": 2,
        "basis": "拍卖机构：exact · 举办时间：unknown · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 2
        },
        {
          "recordId": "rec-20261104-9863c4",
          "caseId": "demo-batch-8",
          "bucket": "not_found",
          "score": 2
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": -2
        }
      ]
    },
    {
      "id": "g-49",
      "key": "中国嘉德国际拍卖有限公司\u0000去年秋天\u0000宸赏—明清御瓷珍玩",
      "values": {
        "auctionHouse": "中国嘉德国际拍卖有限公司",
        "dateText": "去年秋天",
        "sessionName": "宸赏—明清御瓷珍玩"
      },
      "sentence": "中国嘉德国际拍卖有限公司 在 去年秋天 举办了一场名为「宸赏—明清御瓷珍玩」的拍卖会。",
      "status": "covered",
      "recordId": "rec-20261104-bb1fe7",
      "caseId": "demo-batch-3",
      "recordTitle": "中国嘉德国际拍卖有限公司 · 宸赏—明清御瓷珍玩（2021年11月26日至12月13日）",
      "gate": "rejected",
      "bucket": "refuted",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "中国嘉德国际拍卖有限公司",
          "evidenceValue": "中国嘉德",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "去年秋天",
          "evidenceValue": "2021年11月26日至12月13日",
          "state": "unknown",
          "note": "时间写法解析不出，判不了",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "宸赏—明清御瓷珍玩",
          "evidenceValue": "宸赏—明清御瓷珍玩",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "unknown",
        "label": "无从判断",
        "hint": "至少一维的说法解析不出来，判不了",
        "score": 6,
        "basis": "拍卖机构：exact · 举办时间：unknown · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 6
        },
        {
          "recordId": "rec-20261104-9863c4",
          "caseId": "demo-batch-8",
          "bucket": "not_found",
          "score": 2
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": -2
        }
      ]
    },
    {
      "id": "g-50",
      "key": "中国嘉德国际拍卖有限公司\u0000去年秋天\u0000中國古董珍玩專場",
      "values": {
        "auctionHouse": "中国嘉德国际拍卖有限公司",
        "dateText": "去年秋天",
        "sessionName": "中國古董珍玩專場"
      },
      "sentence": "中国嘉德国际拍卖有限公司 在 去年秋天 举办了一场名为「中國古董珍玩專場」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "recordTitle": null,
      "gate": null,
      "bucket": null,
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "中国嘉德国际拍卖有限公司",
          "evidenceValue": "北京保利",
          "state": "mismatch",
          "note": "不是同一家机构",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "去年秋天",
          "evidenceValue": "2022年秋季",
          "state": "unknown",
          "note": "时间写法解析不出，判不了",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "中國古董珍玩專場",
          "evidenceValue": "中國古董珍玩專場",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "uncovered",
        "label": "这批证据没覆盖",
        "hint": "没有任何一条冻结记录同时在两个词上对上或相容",
        "score": 2,
        "basis": "拍卖机构：mismatch · 举办时间：unknown · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-20261104-f584a0",
          "caseId": "demo-batch-1",
          "bucket": "not_found",
          "score": 2
        },
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 2
        },
        {
          "recordId": "rec-20261104-9863c4",
          "caseId": "demo-batch-8",
          "bucket": "not_found",
          "score": 2
        }
      ]
    },
    {
      "id": "g-51",
      "key": "保利香港拍賣\u00002021年12月5日\u0000禹贡Ⅰ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "保利香港拍賣",
        "dateText": "2021年12月5日",
        "sessionName": "禹贡Ⅰ—盛清御瓷新风尚"
      },
      "sentence": "保利香港拍賣 在 2021年12月5日 举办了一场名为「禹贡Ⅰ—盛清御瓷新风尚」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-1",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅰ—盛清御瓷新风尚（2021年12月5日）",
      "gate": "strong",
      "bucket": "strong",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利香港拍賣",
          "evidenceValue": "北京保利",
          "state": "conflict",
          "note": "同名但地点限定词指向不同城市（香港 / 北京）",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年12月5日",
          "evidenceValue": "2021年12月5日",
          "state": "exact",
          "note": "证据的日期落在断言主张的范围内",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅰ—盛清御瓷新风尚",
          "evidenceValue": "禹贡Ⅰ—盛清御瓷新风尚",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "conflict",
        "label": "冲突候选",
        "hint": "至少一维的原文值与你的说法冲突；冲突只作候选，不压成「反对」",
        "score": 4,
        "basis": "拍卖机构：conflict · 举办时间：exact · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 4
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 4
        },
        {
          "recordId": "rec-20261104-a8e3db",
          "caseId": "demo-batch-11",
          "bucket": "weak",
          "score": 4
        }
      ]
    },
    {
      "id": "g-52",
      "key": "保利香港拍賣\u00002021年12月5日\u0000禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
      "values": {
        "auctionHouse": "保利香港拍賣",
        "dateText": "2021年12月5日",
        "sessionName": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术"
      },
      "sentence": "保利香港拍賣 在 2021年12月5日 举办了一场名为「禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利香港拍賣",
          "evidenceValue": "北京保利",
          "state": "conflict",
          "note": "同名但地点限定词指向不同城市（香港 / 北京）",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年12月5日",
          "evidenceValue": "2021年秋季",
          "state": "edge",
          "note": "只在两侧各放宽一个月的窗口边缘擦上，不等于同一件",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "conflict",
        "label": "冲突候选",
        "hint": "至少一维的原文值与你的说法冲突；冲突只作候选，不压成「反对」",
        "score": 2,
        "basis": "拍卖机构：conflict · 举办时间：edge · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 2
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 0
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 0
        }
      ]
    },
    {
      "id": "g-53",
      "key": "保利香港拍賣\u00002021年12月5日\u0000禹贡Ⅲ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "保利香港拍賣",
        "dateText": "2021年12月5日",
        "sessionName": "禹贡Ⅲ—盛清御瓷新风尚"
      },
      "sentence": "保利香港拍賣 在 2021年12月5日 举办了一场名为「禹贡Ⅲ—盛清御瓷新风尚」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "recordTitle": null,
      "gate": null,
      "bucket": null,
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利香港拍賣",
          "evidenceValue": "北京保利",
          "state": "conflict",
          "note": "同名但地点限定词指向不同城市（香港 / 北京）",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年12月5日",
          "evidenceValue": "2021年12月5日",
          "state": "exact",
          "note": "证据的日期落在断言主张的范围内",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅲ—盛清御瓷新风尚",
          "evidenceValue": "禹贡Ⅰ—盛清御瓷新风尚",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "uncovered",
        "label": "这批证据没覆盖",
        "hint": "没有任何一条冻结记录同时在两个词上对上或相容",
        "score": 0,
        "basis": "拍卖机构：conflict · 举办时间：exact · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 0
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 0
        },
        {
          "recordId": "rec-20261104-a8e3db",
          "caseId": "demo-batch-11",
          "bucket": "weak",
          "score": 0
        }
      ]
    },
    {
      "id": "g-54",
      "key": "保利香港拍賣\u00002021年12月5日\u0000宸赏—明清御瓷珍玩",
      "values": {
        "auctionHouse": "保利香港拍賣",
        "dateText": "2021年12月5日",
        "sessionName": "宸赏—明清御瓷珍玩"
      },
      "sentence": "保利香港拍賣 在 2021年12月5日 举办了一场名为「宸赏—明清御瓷珍玩」的拍卖会。",
      "status": "covered",
      "recordId": "rec-20261104-bb1fe7",
      "caseId": "demo-batch-3",
      "recordTitle": "中国嘉德国际拍卖有限公司 · 宸赏—明清御瓷珍玩（2021年11月26日至12月13日）",
      "gate": "rejected",
      "bucket": "refuted",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利香港拍賣",
          "evidenceValue": "中国嘉德",
          "state": "mismatch",
          "note": "不是同一家机构",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年12月5日",
          "evidenceValue": "2021年11月26日至12月13日",
          "state": "caliber",
          "note": "同一段时间的粗写与细写（证据窗口更宽）",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "宸赏—明清御瓷珍玩",
          "evidenceValue": "宸赏—明清御瓷珍玩",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 4,
        "basis": "拍卖机构：mismatch · 举办时间：caliber · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 4
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 0
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 0
        }
      ]
    },
    {
      "id": "g-55",
      "key": "保利香港拍賣\u00002021年12月5日\u0000中國古董珍玩專場",
      "values": {
        "auctionHouse": "保利香港拍賣",
        "dateText": "2021年12月5日",
        "sessionName": "中國古董珍玩專場"
      },
      "sentence": "保利香港拍賣 在 2021年12月5日 举办了一场名为「中國古董珍玩專場」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "recordTitle": null,
      "gate": null,
      "bucket": null,
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利香港拍賣",
          "evidenceValue": "北京保利",
          "state": "conflict",
          "note": "同名但地点限定词指向不同城市（香港 / 北京）",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年12月5日",
          "evidenceValue": "2021年12月5日",
          "state": "exact",
          "note": "证据的日期落在断言主张的范围内",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "中國古董珍玩專場",
          "evidenceValue": "禹贡Ⅰ—盛清御瓷新风尚",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "uncovered",
        "label": "这批证据没覆盖",
        "hint": "没有任何一条冻结记录同时在两个词上对上或相容",
        "score": 0,
        "basis": "拍卖机构：conflict · 举办时间：exact · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 0
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 0
        },
        {
          "recordId": "rec-20261104-a8e3db",
          "caseId": "demo-batch-11",
          "bucket": "weak",
          "score": 0
        }
      ]
    },
    {
      "id": "g-56",
      "key": "保利香港拍賣\u00002021年11月15日\u0000禹贡Ⅰ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "保利香港拍賣",
        "dateText": "2021年11月15日",
        "sessionName": "禹贡Ⅰ—盛清御瓷新风尚"
      },
      "sentence": "保利香港拍賣 在 2021年11月15日 举办了一场名为「禹贡Ⅰ—盛清御瓷新风尚」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "recordTitle": null,
      "gate": null,
      "bucket": null,
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利香港拍賣",
          "evidenceValue": "北京保利",
          "state": "conflict",
          "note": "同名但地点限定词指向不同城市（香港 / 北京）",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年11月15日",
          "evidenceValue": "2021年12月5日",
          "state": "conflict",
          "note": "两段时间的窗口不相交（冲突只作候选，不压成反对）",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅰ—盛清御瓷新风尚",
          "evidenceValue": "禹贡Ⅰ—盛清御瓷新风尚",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "uncovered",
        "label": "这批证据没覆盖",
        "hint": "没有任何一条冻结记录同时在两个词上对上或相容",
        "score": -1,
        "basis": "拍卖机构：conflict · 举办时间：conflict · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": -1
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": -1
        },
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": -1
        }
      ]
    },
    {
      "id": "g-57",
      "key": "保利香港拍賣\u00002021年11月15日\u0000禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
      "values": {
        "auctionHouse": "保利香港拍賣",
        "dateText": "2021年11月15日",
        "sessionName": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术"
      },
      "sentence": "保利香港拍賣 在 2021年11月15日 举办了一场名为「禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利香港拍賣",
          "evidenceValue": "北京保利",
          "state": "conflict",
          "note": "同名但地点限定词指向不同城市（香港 / 北京）",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年11月15日",
          "evidenceValue": "2021年秋季",
          "state": "caliber",
          "note": "同一段时间的粗写与细写（证据窗口更宽）",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "conflict",
        "label": "冲突候选",
        "hint": "至少一维的原文值与你的说法冲突；冲突只作候选，不压成「反对」",
        "score": 3,
        "basis": "拍卖机构：conflict · 举办时间：caliber · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 3
        },
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": -4
        },
        {
          "recordId": "rec-20261104-9863c4",
          "caseId": "demo-batch-8",
          "bucket": "not_found",
          "score": -4
        }
      ]
    },
    {
      "id": "g-58",
      "key": "保利香港拍賣\u00002021年11月15日\u0000禹贡Ⅲ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "保利香港拍賣",
        "dateText": "2021年11月15日",
        "sessionName": "禹贡Ⅲ—盛清御瓷新风尚"
      },
      "sentence": "保利香港拍賣 在 2021年11月15日 举办了一场名为「禹贡Ⅲ—盛清御瓷新风尚」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "recordTitle": null,
      "gate": null,
      "bucket": null,
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利香港拍賣",
          "evidenceValue": "北京保利",
          "state": "conflict",
          "note": "同名但地点限定词指向不同城市（香港 / 北京）",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年11月15日",
          "evidenceValue": "2021年秋季",
          "state": "caliber",
          "note": "同一段时间的粗写与细写（证据窗口更宽）",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅲ—盛清御瓷新风尚",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "uncovered",
        "label": "这批证据没覆盖",
        "hint": "没有任何一条冻结记录同时在两个词上对上或相容",
        "score": -1,
        "basis": "拍卖机构：conflict · 举办时间：caliber · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": -1
        },
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": -4
        },
        {
          "recordId": "rec-20261104-9863c4",
          "caseId": "demo-batch-8",
          "bucket": "not_found",
          "score": -4
        }
      ]
    },
    {
      "id": "g-59",
      "key": "保利香港拍賣\u00002021年11月15日\u0000宸赏—明清御瓷珍玩",
      "values": {
        "auctionHouse": "保利香港拍賣",
        "dateText": "2021年11月15日",
        "sessionName": "宸赏—明清御瓷珍玩"
      },
      "sentence": "保利香港拍賣 在 2021年11月15日 举办了一场名为「宸赏—明清御瓷珍玩」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "recordTitle": null,
      "gate": null,
      "bucket": null,
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利香港拍賣",
          "evidenceValue": "中国嘉德",
          "state": "mismatch",
          "note": "不是同一家机构",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年11月15日",
          "evidenceValue": "2021年11月26日至12月13日",
          "state": "conflict",
          "note": "两段时间的窗口不相交（冲突只作候选，不压成反对）",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "宸赏—明清御瓷珍玩",
          "evidenceValue": "宸赏—明清御瓷珍玩",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "uncovered",
        "label": "这批证据没覆盖",
        "hint": "没有任何一条冻结记录同时在两个词上对上或相容",
        "score": 0,
        "basis": "拍卖机构：mismatch · 举办时间：conflict · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 0
        },
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": -1
        },
        {
          "recordId": "rec-20261104-9863c4",
          "caseId": "demo-batch-8",
          "bucket": "not_found",
          "score": -4
        }
      ]
    },
    {
      "id": "g-60",
      "key": "保利香港拍賣\u00002021年11月15日\u0000中國古董珍玩專場",
      "values": {
        "auctionHouse": "保利香港拍賣",
        "dateText": "2021年11月15日",
        "sessionName": "中國古董珍玩專場"
      },
      "sentence": "保利香港拍賣 在 2021年11月15日 举办了一场名为「中國古董珍玩專場」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "recordTitle": null,
      "gate": null,
      "bucket": null,
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利香港拍賣",
          "evidenceValue": "北京保利",
          "state": "conflict",
          "note": "同名但地点限定词指向不同城市（香港 / 北京）",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年11月15日",
          "evidenceValue": "2021年秋季",
          "state": "caliber",
          "note": "同一段时间的粗写与细写（证据窗口更宽）",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "中國古董珍玩專場",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "uncovered",
        "label": "这批证据没覆盖",
        "hint": "没有任何一条冻结记录同时在两个词上对上或相容",
        "score": -1,
        "basis": "拍卖机构：conflict · 举办时间：caliber · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": -1
        },
        {
          "recordId": "rec-20261104-f584a0",
          "caseId": "demo-batch-1",
          "bucket": "not_found",
          "score": -1
        },
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": -4
        }
      ]
    },
    {
      "id": "g-61",
      "key": "保利香港拍賣\u00002021年秋季\u0000禹贡Ⅰ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "保利香港拍賣",
        "dateText": "2021年秋季",
        "sessionName": "禹贡Ⅰ—盛清御瓷新风尚"
      },
      "sentence": "保利香港拍賣 在 2021年秋季 举办了一场名为「禹贡Ⅰ—盛清御瓷新风尚」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "recordTitle": null,
      "gate": null,
      "bucket": null,
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利香港拍賣",
          "evidenceValue": "北京保利",
          "state": "conflict",
          "note": "同名但地点限定词指向不同城市（香港 / 北京）",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年秋季",
          "evidenceValue": "2021年秋季",
          "state": "exact",
          "note": "证据的日期落在断言主张的范围内",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅰ—盛清御瓷新风尚",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "uncovered",
        "label": "这批证据没覆盖",
        "hint": "没有任何一条冻结记录同时在两个词上对上或相容",
        "score": 0,
        "basis": "拍卖机构：conflict · 举办时间：exact · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 0
        },
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 0
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": -1
        }
      ]
    },
    {
      "id": "g-62",
      "key": "保利香港拍賣\u00002021年秋季\u0000禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
      "values": {
        "auctionHouse": "保利香港拍賣",
        "dateText": "2021年秋季",
        "sessionName": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术"
      },
      "sentence": "保利香港拍賣 在 2021年秋季 举办了一场名为「禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利香港拍賣",
          "evidenceValue": "北京保利",
          "state": "conflict",
          "note": "同名但地点限定词指向不同城市（香港 / 北京）",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年秋季",
          "evidenceValue": "2021年秋季",
          "state": "exact",
          "note": "证据的日期落在断言主张的范围内",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "conflict",
        "label": "冲突候选",
        "hint": "至少一维的原文值与你的说法冲突；冲突只作候选，不压成「反对」",
        "score": 4,
        "basis": "拍卖机构：conflict · 举办时间：exact · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 4
        },
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 0
        },
        {
          "recordId": "rec-20261104-9863c4",
          "caseId": "demo-batch-8",
          "bucket": "not_found",
          "score": -4
        }
      ]
    },
    {
      "id": "g-63",
      "key": "保利香港拍賣\u00002021年秋季\u0000禹贡Ⅲ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "保利香港拍賣",
        "dateText": "2021年秋季",
        "sessionName": "禹贡Ⅲ—盛清御瓷新风尚"
      },
      "sentence": "保利香港拍賣 在 2021年秋季 举办了一场名为「禹贡Ⅲ—盛清御瓷新风尚」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "recordTitle": null,
      "gate": null,
      "bucket": null,
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利香港拍賣",
          "evidenceValue": "北京保利",
          "state": "conflict",
          "note": "同名但地点限定词指向不同城市（香港 / 北京）",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年秋季",
          "evidenceValue": "2021年秋季",
          "state": "exact",
          "note": "证据的日期落在断言主张的范围内",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅲ—盛清御瓷新风尚",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "uncovered",
        "label": "这批证据没覆盖",
        "hint": "没有任何一条冻结记录同时在两个词上对上或相容",
        "score": 0,
        "basis": "拍卖机构：conflict · 举办时间：exact · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 0
        },
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 0
        },
        {
          "recordId": "rec-20261104-9863c4",
          "caseId": "demo-batch-8",
          "bucket": "not_found",
          "score": -4
        }
      ]
    },
    {
      "id": "g-64",
      "key": "保利香港拍賣\u00002021年秋季\u0000宸赏—明清御瓷珍玩",
      "values": {
        "auctionHouse": "保利香港拍賣",
        "dateText": "2021年秋季",
        "sessionName": "宸赏—明清御瓷珍玩"
      },
      "sentence": "保利香港拍賣 在 2021年秋季 举办了一场名为「宸赏—明清御瓷珍玩」的拍卖会。",
      "status": "covered",
      "recordId": "rec-20261104-bb1fe7",
      "caseId": "demo-batch-3",
      "recordTitle": "中国嘉德国际拍卖有限公司 · 宸赏—明清御瓷珍玩（2021年11月26日至12月13日）",
      "gate": "rejected",
      "bucket": "refuted",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利香港拍賣",
          "evidenceValue": "中国嘉德",
          "state": "mismatch",
          "note": "不是同一家机构",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年秋季",
          "evidenceValue": "2021年11月26日至12月13日",
          "state": "caliber",
          "note": "同一段时间的粗写与细写（证据窗口更宽）",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "宸赏—明清御瓷珍玩",
          "evidenceValue": "宸赏—明清御瓷珍玩",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 4,
        "basis": "拍卖机构：mismatch · 举办时间：caliber · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 4
        },
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 0
        },
        {
          "recordId": "rec-20261104-9863c4",
          "caseId": "demo-batch-8",
          "bucket": "not_found",
          "score": -4
        }
      ]
    },
    {
      "id": "g-65",
      "key": "保利香港拍賣\u00002021年秋季\u0000中國古董珍玩專場",
      "values": {
        "auctionHouse": "保利香港拍賣",
        "dateText": "2021年秋季",
        "sessionName": "中國古董珍玩專場"
      },
      "sentence": "保利香港拍賣 在 2021年秋季 举办了一场名为「中國古董珍玩專場」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "recordTitle": null,
      "gate": null,
      "bucket": null,
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利香港拍賣",
          "evidenceValue": "北京保利",
          "state": "conflict",
          "note": "同名但地点限定词指向不同城市（香港 / 北京）",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年秋季",
          "evidenceValue": "2021年秋季",
          "state": "exact",
          "note": "证据的日期落在断言主张的范围内",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "中國古董珍玩專場",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "uncovered",
        "label": "这批证据没覆盖",
        "hint": "没有任何一条冻结记录同时在两个词上对上或相容",
        "score": 0,
        "basis": "拍卖机构：conflict · 举办时间：exact · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 0
        },
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 0
        },
        {
          "recordId": "rec-20261104-f584a0",
          "caseId": "demo-batch-1",
          "bucket": "not_found",
          "score": -1
        }
      ]
    },
    {
      "id": "g-66",
      "key": "保利香港拍賣\u00002021年8月\u0000禹贡Ⅰ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "保利香港拍賣",
        "dateText": "2021年8月",
        "sessionName": "禹贡Ⅰ—盛清御瓷新风尚"
      },
      "sentence": "保利香港拍賣 在 2021年8月 举办了一场名为「禹贡Ⅰ—盛清御瓷新风尚」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "recordTitle": null,
      "gate": null,
      "bucket": null,
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利香港拍賣",
          "evidenceValue": "北京保利",
          "state": "conflict",
          "note": "同名但地点限定词指向不同城市（香港 / 北京）",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年8月",
          "evidenceValue": "2021年12月5日",
          "state": "conflict",
          "note": "两段时间的窗口不相交（冲突只作候选，不压成反对）",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅰ—盛清御瓷新风尚",
          "evidenceValue": "禹贡Ⅰ—盛清御瓷新风尚",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "uncovered",
        "label": "这批证据没覆盖",
        "hint": "没有任何一条冻结记录同时在两个词上对上或相容",
        "score": -1,
        "basis": "拍卖机构：conflict · 举办时间：conflict · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": -1
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": -1
        },
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": -1
        }
      ]
    },
    {
      "id": "g-67",
      "key": "保利香港拍賣\u00002021年8月\u0000禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
      "values": {
        "auctionHouse": "保利香港拍賣",
        "dateText": "2021年8月",
        "sessionName": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术"
      },
      "sentence": "保利香港拍賣 在 2021年8月 举办了一场名为「禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利香港拍賣",
          "evidenceValue": "北京保利",
          "state": "conflict",
          "note": "同名但地点限定词指向不同城市（香港 / 北京）",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年8月",
          "evidenceValue": "2021年秋季",
          "state": "caliber",
          "note": "月份紧贴证据季节的开场边界，属于季节词写法的提前量",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "conflict",
        "label": "冲突候选",
        "hint": "至少一维的原文值与你的说法冲突；冲突只作候选，不压成「反对」",
        "score": 3,
        "basis": "拍卖机构：conflict · 举办时间：caliber · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 3
        },
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": -4
        },
        {
          "recordId": "rec-20261104-9863c4",
          "caseId": "demo-batch-8",
          "bucket": "not_found",
          "score": -4
        }
      ]
    },
    {
      "id": "g-68",
      "key": "保利香港拍賣\u00002021年8月\u0000禹贡Ⅲ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "保利香港拍賣",
        "dateText": "2021年8月",
        "sessionName": "禹贡Ⅲ—盛清御瓷新风尚"
      },
      "sentence": "保利香港拍賣 在 2021年8月 举办了一场名为「禹贡Ⅲ—盛清御瓷新风尚」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "recordTitle": null,
      "gate": null,
      "bucket": null,
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利香港拍賣",
          "evidenceValue": "北京保利",
          "state": "conflict",
          "note": "同名但地点限定词指向不同城市（香港 / 北京）",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年8月",
          "evidenceValue": "2021年秋季",
          "state": "caliber",
          "note": "月份紧贴证据季节的开场边界，属于季节词写法的提前量",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅲ—盛清御瓷新风尚",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "uncovered",
        "label": "这批证据没覆盖",
        "hint": "没有任何一条冻结记录同时在两个词上对上或相容",
        "score": -1,
        "basis": "拍卖机构：conflict · 举办时间：caliber · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": -1
        },
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": -4
        },
        {
          "recordId": "rec-20261104-9863c4",
          "caseId": "demo-batch-8",
          "bucket": "not_found",
          "score": -4
        }
      ]
    },
    {
      "id": "g-69",
      "key": "保利香港拍賣\u00002021年8月\u0000宸赏—明清御瓷珍玩",
      "values": {
        "auctionHouse": "保利香港拍賣",
        "dateText": "2021年8月",
        "sessionName": "宸赏—明清御瓷珍玩"
      },
      "sentence": "保利香港拍賣 在 2021年8月 举办了一场名为「宸赏—明清御瓷珍玩」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "recordTitle": null,
      "gate": null,
      "bucket": null,
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利香港拍賣",
          "evidenceValue": "中国嘉德",
          "state": "mismatch",
          "note": "不是同一家机构",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年8月",
          "evidenceValue": "2021年11月26日至12月13日",
          "state": "conflict",
          "note": "两段时间的窗口不相交（冲突只作候选，不压成反对）",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "宸赏—明清御瓷珍玩",
          "evidenceValue": "宸赏—明清御瓷珍玩",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "uncovered",
        "label": "这批证据没覆盖",
        "hint": "没有任何一条冻结记录同时在两个词上对上或相容",
        "score": 0,
        "basis": "拍卖机构：mismatch · 举办时间：conflict · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 0
        },
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": -1
        },
        {
          "recordId": "rec-20261104-9863c4",
          "caseId": "demo-batch-8",
          "bucket": "not_found",
          "score": -4
        }
      ]
    },
    {
      "id": "g-70",
      "key": "保利香港拍賣\u00002021年8月\u0000中國古董珍玩專場",
      "values": {
        "auctionHouse": "保利香港拍賣",
        "dateText": "2021年8月",
        "sessionName": "中國古董珍玩專場"
      },
      "sentence": "保利香港拍賣 在 2021年8月 举办了一场名为「中國古董珍玩專場」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "recordTitle": null,
      "gate": null,
      "bucket": null,
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利香港拍賣",
          "evidenceValue": "北京保利",
          "state": "conflict",
          "note": "同名但地点限定词指向不同城市（香港 / 北京）",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年8月",
          "evidenceValue": "2021年秋季",
          "state": "caliber",
          "note": "月份紧贴证据季节的开场边界，属于季节词写法的提前量",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "中國古董珍玩專場",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "uncovered",
        "label": "这批证据没覆盖",
        "hint": "没有任何一条冻结记录同时在两个词上对上或相容",
        "score": -1,
        "basis": "拍卖机构：conflict · 举办时间：caliber · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": -1
        },
        {
          "recordId": "rec-20261104-f584a0",
          "caseId": "demo-batch-1",
          "bucket": "not_found",
          "score": -1
        },
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": -4
        }
      ]
    },
    {
      "id": "g-71",
      "key": "保利香港拍賣\u0000去年秋天\u0000禹贡Ⅰ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "保利香港拍賣",
        "dateText": "去年秋天",
        "sessionName": "禹贡Ⅰ—盛清御瓷新风尚"
      },
      "sentence": "保利香港拍賣 在 去年秋天 举办了一场名为「禹贡Ⅰ—盛清御瓷新风尚」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "recordTitle": null,
      "gate": null,
      "bucket": null,
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利香港拍賣",
          "evidenceValue": "北京保利",
          "state": "conflict",
          "note": "同名但地点限定词指向不同城市（香港 / 北京）",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "去年秋天",
          "evidenceValue": "2021年12月5日",
          "state": "unknown",
          "note": "时间写法解析不出，判不了",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅰ—盛清御瓷新风尚",
          "evidenceValue": "禹贡Ⅰ—盛清御瓷新风尚",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "uncovered",
        "label": "这批证据没覆盖",
        "hint": "没有任何一条冻结记录同时在两个词上对上或相容",
        "score": 1,
        "basis": "拍卖机构：conflict · 举办时间：unknown · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 1
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 1
        },
        {
          "recordId": "rec-20261104-a8e3db",
          "caseId": "demo-batch-11",
          "bucket": "weak",
          "score": 1
        }
      ]
    },
    {
      "id": "g-72",
      "key": "保利香港拍賣\u0000去年秋天\u0000禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
      "values": {
        "auctionHouse": "保利香港拍賣",
        "dateText": "去年秋天",
        "sessionName": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术"
      },
      "sentence": "保利香港拍賣 在 去年秋天 举办了一场名为「禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "recordTitle": null,
      "gate": null,
      "bucket": null,
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利香港拍賣",
          "evidenceValue": "北京保利",
          "state": "conflict",
          "note": "同名但地点限定词指向不同城市（香港 / 北京）",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "去年秋天",
          "evidenceValue": "2021年秋季",
          "state": "unknown",
          "note": "时间写法解析不出，判不了",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "uncovered",
        "label": "这批证据没覆盖",
        "hint": "没有任何一条冻结记录同时在两个词上对上或相容",
        "score": 1,
        "basis": "拍卖机构：conflict · 举办时间：unknown · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 1
        },
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": -2
        },
        {
          "recordId": "rec-20261104-9863c4",
          "caseId": "demo-batch-8",
          "bucket": "not_found",
          "score": -2
        }
      ]
    },
    {
      "id": "g-73",
      "key": "保利香港拍賣\u0000去年秋天\u0000禹贡Ⅲ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "保利香港拍賣",
        "dateText": "去年秋天",
        "sessionName": "禹贡Ⅲ—盛清御瓷新风尚"
      },
      "sentence": "保利香港拍賣 在 去年秋天 举办了一场名为「禹贡Ⅲ—盛清御瓷新风尚」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "recordTitle": null,
      "gate": null,
      "bucket": null,
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利香港拍賣",
          "evidenceValue": "中国嘉德",
          "state": "mismatch",
          "note": "不是同一家机构",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "去年秋天",
          "evidenceValue": "2021年11月26日至12月13日",
          "state": "unknown",
          "note": "时间写法解析不出，判不了",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅲ—盛清御瓷新风尚",
          "evidenceValue": "宸赏—明清御瓷珍玩",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "uncovered",
        "label": "这批证据没覆盖",
        "hint": "没有任何一条冻结记录同时在两个词上对上或相容",
        "score": -2,
        "basis": "拍卖机构：mismatch · 举办时间：unknown · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": -2
        },
        {
          "recordId": "rec-20261104-9863c4",
          "caseId": "demo-batch-8",
          "bucket": "not_found",
          "score": -2
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": -3
        }
      ]
    },
    {
      "id": "g-74",
      "key": "保利香港拍賣\u0000去年秋天\u0000宸赏—明清御瓷珍玩",
      "values": {
        "auctionHouse": "保利香港拍賣",
        "dateText": "去年秋天",
        "sessionName": "宸赏—明清御瓷珍玩"
      },
      "sentence": "保利香港拍賣 在 去年秋天 举办了一场名为「宸赏—明清御瓷珍玩」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "recordTitle": null,
      "gate": null,
      "bucket": null,
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利香港拍賣",
          "evidenceValue": "中国嘉德",
          "state": "mismatch",
          "note": "不是同一家机构",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "去年秋天",
          "evidenceValue": "2021年11月26日至12月13日",
          "state": "unknown",
          "note": "时间写法解析不出，判不了",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "宸赏—明清御瓷珍玩",
          "evidenceValue": "宸赏—明清御瓷珍玩",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "uncovered",
        "label": "这批证据没覆盖",
        "hint": "没有任何一条冻结记录同时在两个词上对上或相容",
        "score": 2,
        "basis": "拍卖机构：mismatch · 举办时间：unknown · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 2
        },
        {
          "recordId": "rec-20261104-9863c4",
          "caseId": "demo-batch-8",
          "bucket": "not_found",
          "score": -2
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": -3
        }
      ]
    },
    {
      "id": "g-75",
      "key": "保利香港拍賣\u0000去年秋天\u0000中國古董珍玩專場",
      "values": {
        "auctionHouse": "保利香港拍賣",
        "dateText": "去年秋天",
        "sessionName": "中國古董珍玩專場"
      },
      "sentence": "保利香港拍賣 在 去年秋天 举办了一场名为「中國古董珍玩專場」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "recordTitle": null,
      "gate": null,
      "bucket": null,
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利香港拍賣",
          "evidenceValue": "北京保利",
          "state": "conflict",
          "note": "同名但地点限定词指向不同城市（香港 / 北京）",
          "demoOnly": false
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "去年秋天",
          "evidenceValue": "2022年秋季",
          "state": "unknown",
          "note": "时间写法解析不出，判不了",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "中國古董珍玩專場",
          "evidenceValue": "中國古董珍玩專場",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "uncovered",
        "label": "这批证据没覆盖",
        "hint": "没有任何一条冻结记录同时在两个词上对上或相容",
        "score": 1,
        "basis": "拍卖机构：conflict · 举办时间：unknown · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-20261104-f584a0",
          "caseId": "demo-batch-1",
          "bucket": "not_found",
          "score": 1
        },
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": -2
        },
        {
          "recordId": "rec-20261104-9863c4",
          "caseId": "demo-batch-8",
          "bucket": "not_found",
          "score": -2
        }
      ]
    },
    {
      "id": "g-76",
      "key": "保利拍卖\u00002021年12月5日\u0000禹贡Ⅰ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "保利拍卖",
        "dateText": "2021年12月5日",
        "sessionName": "禹贡Ⅰ—盛清御瓷新风尚"
      },
      "sentence": "保利拍卖 在 2021年12月5日 举办了一场名为「禹贡Ⅰ—盛清御瓷新风尚」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-1",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅰ—盛清御瓷新风尚（2021年12月5日）",
      "gate": "strong",
      "bucket": "strong",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利拍卖",
          "evidenceValue": "北京保利",
          "state": "caliber",
          "note": "同一机构的写法，一方多带地点限定词（可能是分支机构）",
          "demoOnly": true
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年12月5日",
          "evidenceValue": "2021年12月5日",
          "state": "exact",
          "note": "证据的日期落在断言主张的范围内",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅰ—盛清御瓷新风尚",
          "evidenceValue": "禹贡Ⅰ—盛清御瓷新风尚",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "caliber",
        "label": "只找到相容证据",
        "hint": "有证据，但至少一维最多只到「说法不同」——很可能是同一场，只是写法不一样，这不能算对上",
        "score": 8,
        "basis": "拍卖机构：caliber · 举办时间：exact · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 8
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 8
        },
        {
          "recordId": "rec-20261104-a8e3db",
          "caseId": "demo-batch-11",
          "bucket": "weak",
          "score": 8
        }
      ]
    },
    {
      "id": "g-77",
      "key": "保利拍卖\u00002021年12月5日\u0000禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
      "values": {
        "auctionHouse": "保利拍卖",
        "dateText": "2021年12月5日",
        "sessionName": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术"
      },
      "sentence": "保利拍卖 在 2021年12月5日 举办了一场名为「禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利拍卖",
          "evidenceValue": "北京保利",
          "state": "caliber",
          "note": "同一机构的写法，一方多带地点限定词（可能是分支机构）",
          "demoOnly": true
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年12月5日",
          "evidenceValue": "2021年秋季",
          "state": "edge",
          "note": "只在两侧各放宽一个月的窗口边缘擦上，不等于同一件",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "edge",
        "label": "没有矛盾，但这不能证明",
        "hint": "有证据，但至少一维只到「没有矛盾，但这不能证明」，撑不起结论",
        "score": 6,
        "basis": "拍卖机构：caliber · 举办时间：edge · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 6
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 4
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 4
        }
      ]
    },
    {
      "id": "g-78",
      "key": "保利拍卖\u00002021年12月5日\u0000禹贡Ⅲ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "保利拍卖",
        "dateText": "2021年12月5日",
        "sessionName": "禹贡Ⅲ—盛清御瓷新风尚"
      },
      "sentence": "保利拍卖 在 2021年12月5日 举办了一场名为「禹贡Ⅲ—盛清御瓷新风尚」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-1",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅰ—盛清御瓷新风尚（2021年12月5日）",
      "gate": "strong",
      "bucket": "strong",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利拍卖",
          "evidenceValue": "北京保利",
          "state": "caliber",
          "note": "同一机构的写法，一方多带地点限定词（可能是分支机构）",
          "demoOnly": true
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年12月5日",
          "evidenceValue": "2021年12月5日",
          "state": "exact",
          "note": "证据的日期落在断言主张的范围内",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅲ—盛清御瓷新风尚",
          "evidenceValue": "禹贡Ⅰ—盛清御瓷新风尚",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 4,
        "basis": "拍卖机构：caliber · 举办时间：exact · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 4
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 4
        },
        {
          "recordId": "rec-20261104-a8e3db",
          "caseId": "demo-batch-11",
          "bucket": "weak",
          "score": 4
        }
      ]
    },
    {
      "id": "g-79",
      "key": "保利拍卖\u00002021年12月5日\u0000宸赏—明清御瓷珍玩",
      "values": {
        "auctionHouse": "保利拍卖",
        "dateText": "2021年12月5日",
        "sessionName": "宸赏—明清御瓷珍玩"
      },
      "sentence": "保利拍卖 在 2021年12月5日 举办了一场名为「宸赏—明清御瓷珍玩」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-1",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅰ—盛清御瓷新风尚（2021年12月5日）",
      "gate": "strong",
      "bucket": "strong",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利拍卖",
          "evidenceValue": "北京保利",
          "state": "caliber",
          "note": "同一机构的写法，一方多带地点限定词（可能是分支机构）",
          "demoOnly": true
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年12月5日",
          "evidenceValue": "2021年12月5日",
          "state": "exact",
          "note": "证据的日期落在断言主张的范围内",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "宸赏—明清御瓷珍玩",
          "evidenceValue": "禹贡Ⅰ—盛清御瓷新风尚",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 4,
        "basis": "拍卖机构：caliber · 举办时间：exact · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 4
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 4
        },
        {
          "recordId": "rec-20261104-a8e3db",
          "caseId": "demo-batch-11",
          "bucket": "weak",
          "score": 4
        }
      ]
    },
    {
      "id": "g-80",
      "key": "保利拍卖\u00002021年12月5日\u0000中國古董珍玩專場",
      "values": {
        "auctionHouse": "保利拍卖",
        "dateText": "2021年12月5日",
        "sessionName": "中國古董珍玩專場"
      },
      "sentence": "保利拍卖 在 2021年12月5日 举办了一场名为「中國古董珍玩專場」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-1",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅰ—盛清御瓷新风尚（2021年12月5日）",
      "gate": "strong",
      "bucket": "strong",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利拍卖",
          "evidenceValue": "北京保利",
          "state": "caliber",
          "note": "同一机构的写法，一方多带地点限定词（可能是分支机构）",
          "demoOnly": true
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年12月5日",
          "evidenceValue": "2021年12月5日",
          "state": "exact",
          "note": "证据的日期落在断言主张的范围内",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "中國古董珍玩專場",
          "evidenceValue": "禹贡Ⅰ—盛清御瓷新风尚",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 4,
        "basis": "拍卖机构：caliber · 举办时间：exact · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 4
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 4
        },
        {
          "recordId": "rec-20261104-a8e3db",
          "caseId": "demo-batch-11",
          "bucket": "weak",
          "score": 4
        }
      ]
    },
    {
      "id": "g-81",
      "key": "保利拍卖\u00002021年11月15日\u0000禹贡Ⅰ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "保利拍卖",
        "dateText": "2021年11月15日",
        "sessionName": "禹贡Ⅰ—盛清御瓷新风尚"
      },
      "sentence": "保利拍卖 在 2021年11月15日 举办了一场名为「禹贡Ⅰ—盛清御瓷新风尚」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-1",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅰ—盛清御瓷新风尚（2021年12月5日）",
      "gate": "strong",
      "bucket": "strong",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利拍卖",
          "evidenceValue": "北京保利",
          "state": "caliber",
          "note": "同一机构的写法，一方多带地点限定词（可能是分支机构）",
          "demoOnly": true
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年11月15日",
          "evidenceValue": "2021年12月5日",
          "state": "conflict",
          "note": "两段时间的窗口不相交（冲突只作候选，不压成反对）",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅰ—盛清御瓷新风尚",
          "evidenceValue": "禹贡Ⅰ—盛清御瓷新风尚",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "conflict",
        "label": "冲突候选",
        "hint": "至少一维的原文值与你的说法冲突；冲突只作候选，不压成「反对」",
        "score": 3,
        "basis": "拍卖机构：caliber · 举办时间：conflict · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 3
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 3
        },
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 3
        }
      ]
    },
    {
      "id": "g-82",
      "key": "保利拍卖\u00002021年11月15日\u0000禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
      "values": {
        "auctionHouse": "保利拍卖",
        "dateText": "2021年11月15日",
        "sessionName": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术"
      },
      "sentence": "保利拍卖 在 2021年11月15日 举办了一场名为「禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利拍卖",
          "evidenceValue": "北京保利",
          "state": "caliber",
          "note": "同一机构的写法，一方多带地点限定词（可能是分支机构）",
          "demoOnly": true
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年11月15日",
          "evidenceValue": "2021年秋季",
          "state": "caliber",
          "note": "同一段时间的粗写与细写（证据窗口更宽）",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "caliber",
        "label": "只找到相容证据",
        "hint": "有证据，但至少一维最多只到「说法不同」——很可能是同一场，只是写法不一样，这不能算对上",
        "score": 7,
        "basis": "拍卖机构：caliber · 举办时间：caliber · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 7
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": -1
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": -1
        }
      ]
    },
    {
      "id": "g-83",
      "key": "保利拍卖\u00002021年11月15日\u0000禹贡Ⅲ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "保利拍卖",
        "dateText": "2021年11月15日",
        "sessionName": "禹贡Ⅲ—盛清御瓷新风尚"
      },
      "sentence": "保利拍卖 在 2021年11月15日 举办了一场名为「禹贡Ⅲ—盛清御瓷新风尚」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利拍卖",
          "evidenceValue": "北京保利",
          "state": "caliber",
          "note": "同一机构的写法，一方多带地点限定词（可能是分支机构）",
          "demoOnly": true
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年11月15日",
          "evidenceValue": "2021年秋季",
          "state": "caliber",
          "note": "同一段时间的粗写与细写（证据窗口更宽）",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅲ—盛清御瓷新风尚",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 3,
        "basis": "拍卖机构：caliber · 举办时间：caliber · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 3
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": -1
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": -1
        }
      ]
    },
    {
      "id": "g-84",
      "key": "保利拍卖\u00002021年11月15日\u0000宸赏—明清御瓷珍玩",
      "values": {
        "auctionHouse": "保利拍卖",
        "dateText": "2021年11月15日",
        "sessionName": "宸赏—明清御瓷珍玩"
      },
      "sentence": "保利拍卖 在 2021年11月15日 举办了一场名为「宸赏—明清御瓷珍玩」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利拍卖",
          "evidenceValue": "北京保利",
          "state": "caliber",
          "note": "同一机构的写法，一方多带地点限定词（可能是分支机构）",
          "demoOnly": true
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年11月15日",
          "evidenceValue": "2021年秋季",
          "state": "caliber",
          "note": "同一段时间的粗写与细写（证据窗口更宽）",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "宸赏—明清御瓷珍玩",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 3,
        "basis": "拍卖机构：caliber · 举办时间：caliber · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 3
        },
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 0
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": -1
        }
      ]
    },
    {
      "id": "g-85",
      "key": "保利拍卖\u00002021年11月15日\u0000中國古董珍玩專場",
      "values": {
        "auctionHouse": "保利拍卖",
        "dateText": "2021年11月15日",
        "sessionName": "中國古董珍玩專場"
      },
      "sentence": "保利拍卖 在 2021年11月15日 举办了一场名为「中國古董珍玩專場」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利拍卖",
          "evidenceValue": "北京保利",
          "state": "caliber",
          "note": "同一机构的写法，一方多带地点限定词（可能是分支机构）",
          "demoOnly": true
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年11月15日",
          "evidenceValue": "2021年秋季",
          "state": "caliber",
          "note": "同一段时间的粗写与细写（证据窗口更宽）",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "中國古董珍玩專場",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 3,
        "basis": "拍卖机构：caliber · 举办时间：caliber · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 3
        },
        {
          "recordId": "rec-20261104-f584a0",
          "caseId": "demo-batch-1",
          "bucket": "not_found",
          "score": 3
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": -1
        }
      ]
    },
    {
      "id": "g-86",
      "key": "保利拍卖\u00002021年秋季\u0000禹贡Ⅰ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "保利拍卖",
        "dateText": "2021年秋季",
        "sessionName": "禹贡Ⅰ—盛清御瓷新风尚"
      },
      "sentence": "保利拍卖 在 2021年秋季 举办了一场名为「禹贡Ⅰ—盛清御瓷新风尚」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利拍卖",
          "evidenceValue": "北京保利",
          "state": "caliber",
          "note": "同一机构的写法，一方多带地点限定词（可能是分支机构）",
          "demoOnly": true
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年秋季",
          "evidenceValue": "2021年秋季",
          "state": "exact",
          "note": "证据的日期落在断言主张的范围内",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅰ—盛清御瓷新风尚",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 4,
        "basis": "拍卖机构：caliber · 举办时间：exact · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 4
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 3
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 3
        }
      ]
    },
    {
      "id": "g-87",
      "key": "保利拍卖\u00002021年秋季\u0000禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
      "values": {
        "auctionHouse": "保利拍卖",
        "dateText": "2021年秋季",
        "sessionName": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术"
      },
      "sentence": "保利拍卖 在 2021年秋季 举办了一场名为「禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利拍卖",
          "evidenceValue": "北京保利",
          "state": "caliber",
          "note": "同一机构的写法，一方多带地点限定词（可能是分支机构）",
          "demoOnly": true
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年秋季",
          "evidenceValue": "2021年秋季",
          "state": "exact",
          "note": "证据的日期落在断言主张的范围内",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "caliber",
        "label": "只找到相容证据",
        "hint": "有证据，但至少一维最多只到「说法不同」——很可能是同一场，只是写法不一样，这不能算对上",
        "score": 8,
        "basis": "拍卖机构：caliber · 举办时间：exact · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 8
        },
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 0
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": -1
        }
      ]
    },
    {
      "id": "g-88",
      "key": "保利拍卖\u00002021年秋季\u0000禹贡Ⅲ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "保利拍卖",
        "dateText": "2021年秋季",
        "sessionName": "禹贡Ⅲ—盛清御瓷新风尚"
      },
      "sentence": "保利拍卖 在 2021年秋季 举办了一场名为「禹贡Ⅲ—盛清御瓷新风尚」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利拍卖",
          "evidenceValue": "北京保利",
          "state": "caliber",
          "note": "同一机构的写法，一方多带地点限定词（可能是分支机构）",
          "demoOnly": true
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年秋季",
          "evidenceValue": "2021年秋季",
          "state": "exact",
          "note": "证据的日期落在断言主张的范围内",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅲ—盛清御瓷新风尚",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 4,
        "basis": "拍卖机构：caliber · 举办时间：exact · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 4
        },
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 0
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": -1
        }
      ]
    },
    {
      "id": "g-89",
      "key": "保利拍卖\u00002021年秋季\u0000宸赏—明清御瓷珍玩",
      "values": {
        "auctionHouse": "保利拍卖",
        "dateText": "2021年秋季",
        "sessionName": "宸赏—明清御瓷珍玩"
      },
      "sentence": "保利拍卖 在 2021年秋季 举办了一场名为「宸赏—明清御瓷珍玩」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利拍卖",
          "evidenceValue": "北京保利",
          "state": "caliber",
          "note": "同一机构的写法，一方多带地点限定词（可能是分支机构）",
          "demoOnly": true
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年秋季",
          "evidenceValue": "2021年秋季",
          "state": "exact",
          "note": "证据的日期落在断言主张的范围内",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "宸赏—明清御瓷珍玩",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 4,
        "basis": "拍卖机构：caliber · 举办时间：exact · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 4
        },
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 4
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": -1
        }
      ]
    },
    {
      "id": "g-90",
      "key": "保利拍卖\u00002021年秋季\u0000中國古董珍玩專場",
      "values": {
        "auctionHouse": "保利拍卖",
        "dateText": "2021年秋季",
        "sessionName": "中國古董珍玩專場"
      },
      "sentence": "保利拍卖 在 2021年秋季 举办了一场名为「中國古董珍玩專場」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利拍卖",
          "evidenceValue": "北京保利",
          "state": "caliber",
          "note": "同一机构的写法，一方多带地点限定词（可能是分支机构）",
          "demoOnly": true
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年秋季",
          "evidenceValue": "2021年秋季",
          "state": "exact",
          "note": "证据的日期落在断言主张的范围内",
          "demoOnly": false
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "中國古董珍玩專場",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 4,
        "basis": "拍卖机构：caliber · 举办时间：exact · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 4
        },
        {
          "recordId": "rec-20261104-f584a0",
          "caseId": "demo-batch-1",
          "bucket": "not_found",
          "score": 3
        },
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 0
        }
      ]
    },
    {
      "id": "g-91",
      "key": "保利拍卖\u00002021年8月\u0000禹贡Ⅰ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "保利拍卖",
        "dateText": "2021年8月",
        "sessionName": "禹贡Ⅰ—盛清御瓷新风尚"
      },
      "sentence": "保利拍卖 在 2021年8月 举办了一场名为「禹贡Ⅰ—盛清御瓷新风尚」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-1",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅰ—盛清御瓷新风尚（2021年12月5日）",
      "gate": "strong",
      "bucket": "strong",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利拍卖",
          "evidenceValue": "北京保利",
          "state": "caliber",
          "note": "同一机构的写法，一方多带地点限定词（可能是分支机构）",
          "demoOnly": true
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年8月",
          "evidenceValue": "2021年12月5日",
          "state": "conflict",
          "note": "两段时间的窗口不相交（冲突只作候选，不压成反对）",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅰ—盛清御瓷新风尚",
          "evidenceValue": "禹贡Ⅰ—盛清御瓷新风尚",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "conflict",
        "label": "冲突候选",
        "hint": "至少一维的原文值与你的说法冲突；冲突只作候选，不压成「反对」",
        "score": 3,
        "basis": "拍卖机构：caliber · 举办时间：conflict · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 3
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 3
        },
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 3
        }
      ]
    },
    {
      "id": "g-92",
      "key": "保利拍卖\u00002021年8月\u0000禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
      "values": {
        "auctionHouse": "保利拍卖",
        "dateText": "2021年8月",
        "sessionName": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术"
      },
      "sentence": "保利拍卖 在 2021年8月 举办了一场名为「禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利拍卖",
          "evidenceValue": "北京保利",
          "state": "caliber",
          "note": "同一机构的写法，一方多带地点限定词（可能是分支机构）",
          "demoOnly": true
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年8月",
          "evidenceValue": "2021年秋季",
          "state": "caliber",
          "note": "月份紧贴证据季节的开场边界，属于季节词写法的提前量",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "caliber",
        "label": "只找到相容证据",
        "hint": "有证据，但至少一维最多只到「说法不同」——很可能是同一场，只是写法不一样，这不能算对上",
        "score": 7,
        "basis": "拍卖机构：caliber · 举办时间：caliber · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 7
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": -1
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": -1
        }
      ]
    },
    {
      "id": "g-93",
      "key": "保利拍卖\u00002021年8月\u0000禹贡Ⅲ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "保利拍卖",
        "dateText": "2021年8月",
        "sessionName": "禹贡Ⅲ—盛清御瓷新风尚"
      },
      "sentence": "保利拍卖 在 2021年8月 举办了一场名为「禹贡Ⅲ—盛清御瓷新风尚」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利拍卖",
          "evidenceValue": "北京保利",
          "state": "caliber",
          "note": "同一机构的写法，一方多带地点限定词（可能是分支机构）",
          "demoOnly": true
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年8月",
          "evidenceValue": "2021年秋季",
          "state": "caliber",
          "note": "月份紧贴证据季节的开场边界，属于季节词写法的提前量",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅲ—盛清御瓷新风尚",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 3,
        "basis": "拍卖机构：caliber · 举办时间：caliber · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 3
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": -1
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": -1
        }
      ]
    },
    {
      "id": "g-94",
      "key": "保利拍卖\u00002021年8月\u0000宸赏—明清御瓷珍玩",
      "values": {
        "auctionHouse": "保利拍卖",
        "dateText": "2021年8月",
        "sessionName": "宸赏—明清御瓷珍玩"
      },
      "sentence": "保利拍卖 在 2021年8月 举办了一场名为「宸赏—明清御瓷珍玩」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利拍卖",
          "evidenceValue": "北京保利",
          "state": "caliber",
          "note": "同一机构的写法，一方多带地点限定词（可能是分支机构）",
          "demoOnly": true
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年8月",
          "evidenceValue": "2021年秋季",
          "state": "caliber",
          "note": "月份紧贴证据季节的开场边界，属于季节词写法的提前量",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "宸赏—明清御瓷珍玩",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 3,
        "basis": "拍卖机构：caliber · 举办时间：caliber · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 3
        },
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 0
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": -1
        }
      ]
    },
    {
      "id": "g-95",
      "key": "保利拍卖\u00002021年8月\u0000中國古董珍玩專場",
      "values": {
        "auctionHouse": "保利拍卖",
        "dateText": "2021年8月",
        "sessionName": "中國古董珍玩專場"
      },
      "sentence": "保利拍卖 在 2021年8月 举办了一场名为「中國古董珍玩專場」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利拍卖",
          "evidenceValue": "北京保利",
          "state": "caliber",
          "note": "同一机构的写法，一方多带地点限定词（可能是分支机构）",
          "demoOnly": true
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "2021年8月",
          "evidenceValue": "2021年秋季",
          "state": "caliber",
          "note": "月份紧贴证据季节的开场边界，属于季节词写法的提前量",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "中國古董珍玩專場",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "mismatch",
        "label": "没对上，证据写的是别的",
        "hint": "至少一维的证据明确写的是另一个值",
        "score": 3,
        "basis": "拍卖机构：caliber · 举办时间：caliber · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 3
        },
        {
          "recordId": "rec-20261104-f584a0",
          "caseId": "demo-batch-1",
          "bucket": "not_found",
          "score": 3
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": -1
        }
      ]
    },
    {
      "id": "g-96",
      "key": "保利拍卖\u0000去年秋天\u0000禹贡Ⅰ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "保利拍卖",
        "dateText": "去年秋天",
        "sessionName": "禹贡Ⅰ—盛清御瓷新风尚"
      },
      "sentence": "保利拍卖 在 去年秋天 举办了一场名为「禹贡Ⅰ—盛清御瓷新风尚」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-1",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅰ—盛清御瓷新风尚（2021年12月5日）",
      "gate": "strong",
      "bucket": "strong",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利拍卖",
          "evidenceValue": "北京保利",
          "state": "caliber",
          "note": "同一机构的写法，一方多带地点限定词（可能是分支机构）",
          "demoOnly": true
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "去年秋天",
          "evidenceValue": "2021年12月5日",
          "state": "unknown",
          "note": "时间写法解析不出，判不了",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅰ—盛清御瓷新风尚",
          "evidenceValue": "禹贡Ⅰ—盛清御瓷新风尚",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "unknown",
        "label": "无从判断",
        "hint": "至少一维的说法解析不出来，判不了",
        "score": 5,
        "basis": "拍卖机构：caliber · 举办时间：unknown · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 5
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 5
        },
        {
          "recordId": "rec-20261104-a8e3db",
          "caseId": "demo-batch-11",
          "bucket": "weak",
          "score": 5
        }
      ]
    },
    {
      "id": "g-97",
      "key": "保利拍卖\u0000去年秋天\u0000禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
      "values": {
        "auctionHouse": "保利拍卖",
        "dateText": "去年秋天",
        "sessionName": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术"
      },
      "sentence": "保利拍卖 在 去年秋天 举办了一场名为「禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
      "gate": "weak",
      "bucket": "weak",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利拍卖",
          "evidenceValue": "北京保利",
          "state": "caliber",
          "note": "同一机构的写法，一方多带地点限定词（可能是分支机构）",
          "demoOnly": true
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "去年秋天",
          "evidenceValue": "2021年秋季",
          "state": "unknown",
          "note": "时间写法解析不出，判不了",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "unknown",
        "label": "无从判断",
        "hint": "至少一维的说法解析不出来，判不了",
        "score": 5,
        "basis": "拍卖机构：caliber · 举办时间：unknown · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 5
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 1
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 1
        }
      ]
    },
    {
      "id": "g-98",
      "key": "保利拍卖\u0000去年秋天\u0000禹贡Ⅲ—盛清御瓷新风尚",
      "values": {
        "auctionHouse": "保利拍卖",
        "dateText": "去年秋天",
        "sessionName": "禹贡Ⅲ—盛清御瓷新风尚"
      },
      "sentence": "保利拍卖 在 去年秋天 举办了一场名为「禹贡Ⅲ—盛清御瓷新风尚」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "recordTitle": null,
      "gate": null,
      "bucket": null,
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利拍卖",
          "evidenceValue": "北京保利",
          "state": "caliber",
          "note": "同一机构的写法，一方多带地点限定词（可能是分支机构）",
          "demoOnly": true
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "去年秋天",
          "evidenceValue": "2021年12月5日",
          "state": "unknown",
          "note": "时间写法解析不出，判不了",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "禹贡Ⅲ—盛清御瓷新风尚",
          "evidenceValue": "禹贡Ⅰ—盛清御瓷新风尚",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "uncovered",
        "label": "这批证据没覆盖",
        "hint": "没有任何一条冻结记录同时在两个词上对上或相容",
        "score": 1,
        "basis": "拍卖机构：caliber · 举办时间：unknown · 专场名：mismatch"
      },
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 1
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 1
        },
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "bucket": "weak",
          "score": 1
        }
      ]
    },
    {
      "id": "g-99",
      "key": "保利拍卖\u0000去年秋天\u0000宸赏—明清御瓷珍玩",
      "values": {
        "auctionHouse": "保利拍卖",
        "dateText": "去年秋天",
        "sessionName": "宸赏—明清御瓷珍玩"
      },
      "sentence": "保利拍卖 在 去年秋天 举办了一场名为「宸赏—明清御瓷珍玩」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "recordTitle": null,
      "gate": null,
      "bucket": null,
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利拍卖",
          "evidenceValue": "中国嘉德",
          "state": "mismatch",
          "note": "不是同一家机构",
          "demoOnly": true
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "去年秋天",
          "evidenceValue": "2021年11月26日至12月13日",
          "state": "unknown",
          "note": "时间写法解析不出，判不了",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "宸赏—明清御瓷珍玩",
          "evidenceValue": "宸赏—明清御瓷珍玩",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "uncovered",
        "label": "这批证据没覆盖",
        "hint": "没有任何一条冻结记录同时在两个词上对上或相容",
        "score": 2,
        "basis": "拍卖机构：mismatch · 举办时间：unknown · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-20261104-bb1fe7",
          "caseId": "demo-batch-3",
          "bucket": "refuted",
          "score": 2
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 1
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 1
        }
      ]
    },
    {
      "id": "g-100",
      "key": "保利拍卖\u0000去年秋天\u0000中國古董珍玩專場",
      "values": {
        "auctionHouse": "保利拍卖",
        "dateText": "去年秋天",
        "sessionName": "中國古董珍玩專場"
      },
      "sentence": "保利拍卖 在 去年秋天 举办了一场名为「中國古董珍玩專場」的拍卖会。",
      "status": "covered",
      "recordId": "rec-20261104-f584a0",
      "caseId": "demo-batch-1",
      "recordTitle": "保利香港拍賣 · 中國古董珍玩專場（2022年7月14日）",
      "gate": "rejected",
      "bucket": "not_found",
      "dimensions": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "value": "保利拍卖",
          "evidenceValue": "北京保利",
          "state": "caliber",
          "note": "同一机构的写法，一方多带地点限定词（可能是分支机构）",
          "demoOnly": true
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "value": "去年秋天",
          "evidenceValue": "2022年秋季",
          "state": "unknown",
          "note": "时间写法解析不出，判不了",
          "demoOnly": true
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "value": "中國古董珍玩專場",
          "evidenceValue": "中國古董珍玩專場",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false
        }
      ],
      "conclusion": {
        "code": "unknown",
        "label": "无从判断",
        "hint": "至少一维的说法解析不出来，判不了",
        "score": 5,
        "basis": "拍卖机构：caliber · 举办时间：unknown · 专场名：exact"
      },
      "matched": [
        {
          "recordId": "rec-20261104-f584a0",
          "caseId": "demo-batch-1",
          "bucket": "not_found",
          "score": 5
        },
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "bucket": "strong",
          "score": 1
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "bucket": "strong",
          "score": 1
        }
      ]
    }
  ],
  "stats": {
    "total": 100,
    "covered": 68,
    "uncovered": 32,
    "byConclusion": {
      "strong": 1,
      "weak": 1,
      "caliber": 8,
      "edge": 2,
      "conflict": 11,
      "mismatch": 38,
      "unknown": 7,
      "uncovered": 32
    },
    "maxCombos": 100
  }
};
