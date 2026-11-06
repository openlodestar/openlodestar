// 由 src/demo-page/build-sort-data.ts 从 docs/assets/demo-game-data.js 生成，不要手改；
// 改玩法或候选值后重跑 pnpm run demo:sort。
window.LODESTAR_SORT = {
  "generatedAt": "2026-11-06T08:25:49.605Z",
  "generator": "src/demo-page/build-sort-data.ts",
  "note": "由冻结矩阵 docs/assets/demo-game-data.js 生成，不要手改。每条证据的状态是构建时用引擎的维度函数算出来的，页面只查表。",
  "states": {
    "exact": {
      "label": "完全对上",
      "short": "直接支撑",
      "tone": "hit",
      "accept": "命中",
      "reject": "漏判",
      "rule": "这一维按规则归一后一致，可以当作直接支撑"
    },
    "caliber": {
      "label": "口径相容",
      "short": "说法不同",
      "tone": "caliber",
      "accept": "只算旁证",
      "reject": "放走",
      "rule": "可能是同一场，只是写法不同；这不能算对上"
    },
    "edge": {
      "label": "边缘相容",
      "short": "不能证明",
      "tone": "edge",
      "accept": "不能当支撑",
      "reject": "放走",
      "rule": "没有矛盾，但这不能证明"
    },
    "conflict": {
      "label": "冲突候选",
      "short": "指向别的值",
      "tone": "conflict",
      "accept": "冲突候选",
      "reject": "放走",
      "rule": "点名了另一个值；冲突只作候选，不压成反对"
    },
    "mismatch": {
      "label": "没对上",
      "short": "写的不是这个",
      "tone": "mismatch",
      "accept": "不是这个值",
      "reject": "放走",
      "rule": "证据明确写的是另一个值"
    },
    "unknown": {
      "label": "无从判断",
      "short": "判不了",
      "tone": "unknown",
      "accept": "判不了",
      "reject": "放走",
      "rule": "解析不出可比的说法，判不了"
    }
  },
  "scoring": {
    "hitBase": 10,
    "accept": {
      "exact": 0,
      "caliber": 3,
      "edge": 1,
      "conflict": 0,
      "mismatch": 0,
      "unknown": 0
    },
    "reject": {
      "exact": 0,
      "caliber": 2,
      "edge": 2,
      "conflict": 2,
      "mismatch": 2,
      "unknown": 1
    },
    "acceptCombo": {
      "exact": "up",
      "caliber": "freeze",
      "edge": "freeze",
      "conflict": "reset",
      "mismatch": "reset",
      "unknown": "freeze"
    },
    "acceptLife": {
      "exact": 0,
      "caliber": 0,
      "edge": 0,
      "conflict": -1,
      "mismatch": -1,
      "unknown": 0
    },
    "multiplier": {
      "per": 3,
      "step": 0.5,
      "cap": 3
    },
    "lives": 3,
    "timeoutCombo": "reset",
    "timeoutPoints": 0,
    "note": "命中＝10×倍率；倍率＝1+⌊连击÷3⌋×0.5，最高×3。放走不算错，但只拿小分；收下相容证据会冻住连击，收下冲突/没对上掉一颗心。"
  },
  "grades": [
    {
      "grade": "S",
      "min": 131,
      "label": "每条都判对了"
    },
    {
      "grade": "A",
      "min": 102,
      "label": "只放过了几条相容证据"
    },
    {
      "grade": "B",
      "min": 66,
      "label": "把相容当成了支撑"
    },
    {
      "grade": "C",
      "min": 0,
      "label": "还没分出相容与对上"
    }
  ],
  "perfectScore": 146,
  "rounds": [
    {
      "id": "round-1",
      "index": 0,
      "lot": {
        "comboId": "g-01",
        "recordId": "rec-poly-2021-yugong-1",
        "recordTitle": "北京保利 · 禹贡Ⅰ—盛清御瓷新风尚（2021年12月5日）",
        "gate": "strong",
        "values": {
          "auctionHouse": "北京保利",
          "dateText": "2021年12月5日",
          "sessionName": "禹贡Ⅰ—盛清御瓷新风尚"
        }
      },
      "truth": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "evidenceValue": "北京保利",
          "state": "exact"
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "evidenceValue": "2021年12月5日",
          "state": "exact"
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "evidenceValue": "禹贡Ⅰ—盛清御瓷新风尚",
          "state": "exact"
        }
      ],
      "chips": [
        {
          "id": "r1-c1",
          "slot": "auctionHouse",
          "slotLabel": "拍卖机构",
          "short": "机构",
          "value": "北京保利",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false,
          "fromRecord": true
        },
        {
          "id": "r1-c2",
          "slot": "sessionName",
          "slotLabel": "专场名",
          "short": "专场",
          "value": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false,
          "fromRecord": false
        },
        {
          "id": "r1-c3",
          "slot": "dateText",
          "slotLabel": "举办时间",
          "short": "时间",
          "value": "2021年12月5日",
          "state": "exact",
          "note": "证据的日期落在断言主张的范围内",
          "demoOnly": false,
          "fromRecord": true
        },
        {
          "id": "r1-c4",
          "slot": "dateText",
          "slotLabel": "举办时间",
          "short": "时间",
          "value": "2021年12月2日-6日",
          "state": "caliber",
          "note": "同一段时间的粗写与细写（证据窗口更宽）",
          "demoOnly": false,
          "fromRecord": false
        },
        {
          "id": "r1-c5",
          "slot": "auctionHouse",
          "slotLabel": "拍卖机构",
          "short": "机构",
          "value": "保利香港拍賣",
          "state": "conflict",
          "note": "同名但地点限定词指向不同城市（北京 / 香港）",
          "demoOnly": false,
          "fromRecord": false
        },
        {
          "id": "r1-c6",
          "slot": "sessionName",
          "slotLabel": "专场名",
          "short": "专场",
          "value": "禹贡Ⅰ—盛清御瓷新风尚",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false,
          "fromRecord": true
        },
        {
          "id": "r1-c7",
          "slot": "dateText",
          "slotLabel": "举办时间",
          "short": "时间",
          "value": "2021年秋季",
          "state": "edge",
          "note": "只在两侧各放宽一个月的窗口边缘擦上，不等于同一件",
          "demoOnly": false,
          "fromRecord": false
        },
        {
          "id": "r1-c8",
          "slot": "dateText",
          "slotLabel": "举办时间",
          "short": "时间",
          "value": "去年秋天",
          "state": "unknown",
          "note": "时间写法解析不出，判不了",
          "demoOnly": true,
          "fromRecord": false
        },
        {
          "id": "r1-c9",
          "slot": "auctionHouse",
          "slotLabel": "拍卖机构",
          "short": "机构",
          "value": "保利拍卖",
          "state": "caliber",
          "note": "同一机构的写法，一方多带地点限定词（可能是分支机构）",
          "demoOnly": true,
          "fromRecord": false
        },
        {
          "id": "r1-c10",
          "slot": "auctionHouse",
          "slotLabel": "拍卖机构",
          "short": "机构",
          "value": "中国嘉德",
          "state": "mismatch",
          "note": "不是同一家机构",
          "demoOnly": false,
          "fromRecord": false
        }
      ]
    },
    {
      "id": "round-2",
      "index": 1,
      "lot": {
        "comboId": "g-07",
        "recordId": "rec-poly-2021-yugong-2",
        "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
        "gate": "weak",
        "values": {
          "auctionHouse": "北京保利",
          "dateText": "2021年11月15日",
          "sessionName": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术"
        }
      },
      "truth": [
        {
          "slot": "auctionHouse",
          "label": "拍卖机构",
          "evidenceValue": "北京保利",
          "state": "exact"
        },
        {
          "slot": "dateText",
          "label": "举办时间",
          "evidenceValue": "2021年秋季",
          "state": "caliber"
        },
        {
          "slot": "sessionName",
          "label": "专场名",
          "evidenceValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "exact"
        }
      ],
      "chips": [
        {
          "id": "r2-c1",
          "slot": "dateText",
          "slotLabel": "举办时间",
          "short": "时间",
          "value": "2021年11月15日",
          "state": "exact",
          "note": "证据的日期落在断言主张的范围内",
          "demoOnly": false,
          "fromRecord": false
        },
        {
          "id": "r2-c2",
          "slot": "auctionHouse",
          "slotLabel": "拍卖机构",
          "short": "机构",
          "value": "保利拍卖",
          "state": "caliber",
          "note": "同一机构的写法，一方多带地点限定词（可能是分支机构）",
          "demoOnly": true,
          "fromRecord": false
        },
        {
          "id": "r2-c3",
          "slot": "sessionName",
          "slotLabel": "专场名",
          "short": "专场",
          "value": "禹贡Ⅰ—盛清御瓷新风尚",
          "state": "mismatch",
          "note": "归一后仍不是同一个名字",
          "demoOnly": false,
          "fromRecord": false
        },
        {
          "id": "r2-c4",
          "slot": "dateText",
          "slotLabel": "举办时间",
          "short": "时间",
          "value": "2021年秋季",
          "state": "caliber",
          "note": "同一段时间的粗写与细写（证据窗口更宽）",
          "demoOnly": false,
          "fromRecord": true
        },
        {
          "id": "r2-c5",
          "slot": "auctionHouse",
          "slotLabel": "拍卖机构",
          "short": "机构",
          "value": "北京保利",
          "state": "exact",
          "note": "同一机构，地点限定词一致",
          "demoOnly": false,
          "fromRecord": true
        },
        {
          "id": "r2-c6",
          "slot": "dateText",
          "slotLabel": "举办时间",
          "short": "时间",
          "value": "2021年12月5日",
          "state": "conflict",
          "note": "两段时间的窗口不相交（冲突只作候选，不压成反对）",
          "demoOnly": false,
          "fromRecord": false
        },
        {
          "id": "r2-c7",
          "slot": "auctionHouse",
          "slotLabel": "拍卖机构",
          "short": "机构",
          "value": "保利香港拍賣",
          "state": "conflict",
          "note": "同名但地点限定词指向不同城市（北京 / 香港）",
          "demoOnly": false,
          "fromRecord": false
        },
        {
          "id": "r2-c8",
          "slot": "sessionName",
          "slotLabel": "专场名",
          "short": "专场",
          "value": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
          "state": "exact",
          "note": "归一后完全一致",
          "demoOnly": false,
          "fromRecord": true
        },
        {
          "id": "r2-c9",
          "slot": "dateText",
          "slotLabel": "举办时间",
          "short": "时间",
          "value": "去年秋天",
          "state": "unknown",
          "note": "时间写法解析不出，判不了",
          "demoOnly": true,
          "fromRecord": false
        },
        {
          "id": "r2-c10",
          "slot": "auctionHouse",
          "slotLabel": "拍卖机构",
          "short": "机构",
          "value": "中国嘉德",
          "state": "mismatch",
          "note": "不是同一家机构",
          "demoOnly": false,
          "fromRecord": false
        }
      ]
    }
  ],
  "stats": {
    "chips": 20,
    "byState": {
      "exact": 6,
      "caliber": 4,
      "edge": 1,
      "conflict": 3,
      "mismatch": 4,
      "unknown": 2
    }
  }
};
