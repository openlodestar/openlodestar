// 由 src/demo-page/build-sort-data.ts 从 docs/assets/demo-game-data.js 生成，不要手改；
// 改玩法或候选值后重跑 pnpm run demo:sort。
window.LODESTAR_SORT = {
  "generatedAt": "2026-11-06T12:58:37.660Z",
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
      "caliber": 8,
      "edge": 4,
      "conflict": 0,
      "mismatch": 0,
      "unknown": 0
    },
    "reject": {
      "exact": 0,
      "caliber": 0,
      "edge": 0,
      "conflict": 1,
      "mismatch": 1,
      "unknown": 1
    },
    "acceptCombo": {
      "exact": "up",
      "caliber": "reset",
      "edge": "reset",
      "conflict": "reset",
      "mismatch": "reset",
      "unknown": "reset"
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
      "per": 1,
      "step": 1,
      "cap": 3
    },
    "windowBonus": {
      "multiplier": 2,
      "states": [
        "caliber",
        "edge"
      ]
    },
    "lives": 3,
    "roundComboReset": true,
    "timeoutCombo": "reset",
    "timeoutPoints": 0,
    "settleBeats": 3,
    "note": "命中＝10×倍率，倍率只看连续命中：连击 0 是 ×1、1 是 ×2、2 起是 ×3（封顶 ×3）。收下相容 +8、边缘 +4，但连击立刻归零——中段收旁证会打断冲锋，后面每一拍都少拿一倍。每件器物的最后三拍不会再发命中，这三拍收旁证不亏倍率、分值还翻倍（相容 +16、边缘 +8），是兑现窗口；同一个相容，中段收会亏、窗口里收才划算。放走相容/边缘不给分；收下冲突/没对上掉一颗心；放走冲突/没对上/无从判断 +1；放走命中（漏判）、收下无从判断都断连击；换下一件器物时连击清零，倍率回到 ×1。"
  },
  "grades": [
    {
      "grade": "S",
      "ratio": 0.92,
      "label": "接近这一局的最优解：命中没漏，旁证也只在兑现窗口里收"
    },
    {
      "grade": "A",
      "ratio": 0.72,
      "label": "取舍方向对了一半：要么把兑现窗口里的旁证全放走了，要么在中段收旁证断了连击"
    },
    {
      "grade": "B",
      "ratio": 0.5,
      "label": "只按字面分：命中的都收了，但旁证全放走，兑现窗口一分没拿"
    },
    {
      "grade": "C",
      "ratio": 0,
      "label": "先把两个动作的手感练熟"
    }
  ],
  "runs": [
    {
      "id": "run-1",
      "label": "牌局 1",
      "rounds": [
        {
          "id": "round-1",
          "index": 0,
          "lot": {
            "comboId": "g-03",
            "recordId": "rec-poly-2021-yugong-1",
            "recordTitle": "北京保利 · 禹贡Ⅰ—盛清御瓷新风尚（2021年12月5日）",
            "gate": "strong",
            "values": {
              "auctionHouse": "北京保利",
              "dateText": "2021年12月5日",
              "sessionName": "禹贡Ⅲ—盛清御瓷新风尚"
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
              "state": "mismatch"
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
              "value": "2021年11月26日至12月13日",
              "state": "caliber",
              "note": "同一段时间的粗写与细写（证据窗口更宽）",
              "demoOnly": false,
              "fromRecord": false
            },
            {
              "id": "r1-c4",
              "slot": "sessionName",
              "slotLabel": "专场名",
              "short": "专场",
              "value": "禹贡Ⅲ—盛清御瓷新风尚",
              "state": "exact",
              "note": "归一后完全一致",
              "demoOnly": false,
              "fromRecord": false
            },
            {
              "id": "r1-c5",
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
              "id": "r1-c6",
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
              "id": "r1-c7",
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
              "id": "r1-c8",
              "slot": "auctionHouse",
              "slotLabel": "拍卖机构",
              "short": "机构",
              "value": "保利",
              "state": "caliber",
              "note": "同一机构的写法，一方多带地点限定词（可能是分支机构）",
              "demoOnly": false,
              "fromRecord": false
            },
            {
              "id": "r1-c9",
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
              "id": "r1-c10",
              "slot": "dateText",
              "slotLabel": "举办时间",
              "short": "时间",
              "value": "2021年12月2日-6日",
              "state": "caliber",
              "note": "同一段时间的粗写与细写（证据窗口更宽）",
              "demoOnly": false,
              "fromRecord": false
            }
          ],
          "settleFrom": 7
        },
        {
          "id": "round-2",
          "index": 1,
          "lot": {
            "comboId": "g-82",
            "recordId": "rec-poly-2021-yugong-2",
            "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
            "gate": "weak",
            "values": {
              "auctionHouse": "保利拍卖",
              "dateText": "2021年11月15日",
              "sessionName": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术"
            }
          },
          "truth": [
            {
              "slot": "auctionHouse",
              "label": "拍卖机构",
              "evidenceValue": "北京保利",
              "state": "caliber"
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
              "slot": "auctionHouse",
              "slotLabel": "拍卖机构",
              "short": "机构",
              "value": "保利",
              "state": "exact",
              "note": "同一机构，地点限定词一致",
              "demoOnly": false,
              "fromRecord": false
            },
            {
              "id": "r2-c2",
              "slot": "sessionName",
              "slotLabel": "专场名",
              "short": "专场",
              "value": "宸赏—明清御瓷珍玩",
              "state": "mismatch",
              "note": "归一后仍不是同一个名字",
              "demoOnly": false,
              "fromRecord": false
            },
            {
              "id": "r2-c3",
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
              "id": "r2-c4",
              "slot": "dateText",
              "slotLabel": "举办时间",
              "short": "时间",
              "value": "2024年春季",
              "state": "conflict",
              "note": "两段时间的窗口不相交（冲突只作候选，不压成反对）",
              "demoOnly": false,
              "fromRecord": false
            },
            {
              "id": "r2-c5",
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
              "id": "r2-c6",
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
              "id": "r2-c7",
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
              "id": "r2-c8",
              "slot": "dateText",
              "slotLabel": "举办时间",
              "short": "时间",
              "value": "2021年底",
              "state": "caliber",
              "note": "同一段时间的粗写与细写（证据窗口更宽）",
              "demoOnly": true,
              "fromRecord": false
            },
            {
              "id": "r2-c9",
              "slot": "auctionHouse",
              "slotLabel": "拍卖机构",
              "short": "机构",
              "value": "保利香港拍賣",
              "state": "caliber",
              "note": "同一机构的写法，一方多带地点限定词（可能是分支机构）",
              "demoOnly": false,
              "fromRecord": false
            },
            {
              "id": "r2-c10",
              "slot": "sessionName",
              "slotLabel": "专场名",
              "short": "专场",
              "value": "禹貢I - 盛清御瓷新風尚",
              "state": "mismatch",
              "note": "归一后仍不是同一个名字",
              "demoOnly": false,
              "fromRecord": false
            }
          ],
          "settleFrom": 7
        }
      ],
      "orders": [
        {
          "id": "order-1",
          "label": "教学顺序",
          "rounds": [
            [
              0,
              1,
              2,
              3,
              4,
              5,
              6,
              7,
              8,
              9
            ],
            [
              0,
              1,
              2,
              3,
              4,
              5,
              6,
              7,
              8,
              9
            ]
          ],
          "best": 199,
          "steady": 199,
          "literal": 127,
          "eager": 175
        },
        {
          "id": "order-2",
          "label": "牌序 2",
          "rounds": [
            [
              0,
              3,
              5,
              2,
              1,
              4,
              6,
              7,
              9,
              8
            ],
            [
              0,
              2,
              1,
              3,
              5,
              4,
              6,
              9,
              7,
              8
            ]
          ],
          "best": 199,
          "steady": 199,
          "literal": 127,
          "eager": 175
        },
        {
          "id": "order-3",
          "label": "牌序 3",
          "rounds": [
            [
              0,
              4,
              5,
              1,
              3,
              2,
              6,
              9,
              8,
              7
            ],
            [
              0,
              4,
              3,
              2,
              5,
              1,
              6,
              9,
              8,
              7
            ]
          ],
          "best": 199,
          "steady": 199,
          "literal": 127,
          "eager": 175
        },
        {
          "id": "order-4",
          "label": "牌序 4",
          "rounds": [
            [
              0,
              1,
              2,
              3,
              4,
              5,
              6,
              8,
              7,
              9
            ],
            [
              0,
              4,
              2,
              1,
              3,
              5,
              6,
              7,
              8,
              9
            ]
          ],
          "best": 199,
          "steady": 199,
          "literal": 127,
          "eager": 175
        },
        {
          "id": "order-5",
          "label": "牌序 5",
          "rounds": [
            [
              0,
              1,
              5,
              4,
              2,
              3,
              6,
              9,
              8,
              7
            ],
            [
              0,
              1,
              5,
              3,
              4,
              2,
              6,
              8,
              9,
              7
            ]
          ],
          "best": 199,
          "steady": 199,
          "literal": 127,
          "eager": 175
        },
        {
          "id": "order-6",
          "label": "牌序 6",
          "rounds": [
            [
              0,
              4,
              5,
              3,
              2,
              1,
              6,
              7,
              8,
              9
            ],
            [
              0,
              3,
              2,
              1,
              4,
              5,
              6,
              8,
              7,
              9
            ]
          ],
          "best": 199,
          "steady": 199,
          "literal": 127,
          "eager": 175
        }
      ]
    },
    {
      "id": "run-2",
      "label": "牌局 2",
      "rounds": [
        {
          "id": "round-1",
          "index": 0,
          "lot": {
            "comboId": "g-52",
            "recordId": "rec-poly-2021-yugong-2",
            "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
            "gate": "weak",
            "values": {
              "auctionHouse": "保利香港拍賣",
              "dateText": "2021年12月5日",
              "sessionName": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术"
            }
          },
          "truth": [
            {
              "slot": "auctionHouse",
              "label": "拍卖机构",
              "evidenceValue": "北京保利",
              "state": "conflict"
            },
            {
              "slot": "dateText",
              "label": "举办时间",
              "evidenceValue": "2021年秋季",
              "state": "edge"
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
              "id": "r1-c1",
              "slot": "auctionHouse",
              "slotLabel": "拍卖机构",
              "short": "机构",
              "value": "保利香港拍賣",
              "state": "exact",
              "note": "同一机构，地点限定词一致",
              "demoOnly": false,
              "fromRecord": false
            },
            {
              "id": "r1-c2",
              "slot": "sessionName",
              "slotLabel": "专场名",
              "short": "专场",
              "value": "递藏之趣专场",
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
              "value": "2021年底",
              "state": "caliber",
              "note": "同一段时间的粗写与细写（证据窗口更宽）",
              "demoOnly": true,
              "fromRecord": false
            },
            {
              "id": "r1-c4",
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
              "id": "r1-c5",
              "slot": "dateText",
              "slotLabel": "举办时间",
              "short": "时间",
              "value": "不详",
              "state": "unknown",
              "note": "时间写法解析不出，判不了",
              "demoOnly": true,
              "fromRecord": false
            },
            {
              "id": "r1-c6",
              "slot": "auctionHouse",
              "slotLabel": "拍卖机构",
              "short": "机构",
              "value": "北京保利",
              "state": "conflict",
              "note": "同名但地点限定词指向不同城市（香港 / 北京）",
              "demoOnly": false,
              "fromRecord": true
            },
            {
              "id": "r1-c7",
              "slot": "dateText",
              "slotLabel": "举办时间",
              "short": "时间",
              "value": "2021/12/5",
              "state": "exact",
              "note": "证据的日期落在断言主张的范围内",
              "demoOnly": false,
              "fromRecord": false
            },
            {
              "id": "r1-c8",
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
              "id": "r1-c9",
              "slot": "dateText",
              "slotLabel": "举办时间",
              "short": "时间",
              "value": "2021秋季",
              "state": "edge",
              "note": "只在两侧各放宽一个月的窗口边缘擦上，不等于同一件",
              "demoOnly": false,
              "fromRecord": false
            },
            {
              "id": "r1-c10",
              "slot": "dateText",
              "slotLabel": "举办时间",
              "short": "时间",
              "value": "2021年12月",
              "state": "caliber",
              "note": "同一段时间的粗写与细写（证据窗口更宽）",
              "demoOnly": false,
              "fromRecord": false
            }
          ],
          "settleFrom": 7
        },
        {
          "id": "round-2",
          "index": 1,
          "lot": {
            "comboId": "g-20",
            "recordId": "rec-poly-2021-yugong-2",
            "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
            "gate": "weak",
            "values": {
              "auctionHouse": "北京保利",
              "dateText": "2021年8月",
              "sessionName": "中國古董珍玩專場"
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
              "state": "mismatch"
            }
          ],
          "chips": [
            {
              "id": "r2-c1",
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
              "id": "r2-c2",
              "slot": "sessionName",
              "slotLabel": "专场名",
              "short": "专场",
              "value": "递藏之趣专场",
              "state": "mismatch",
              "note": "归一后仍不是同一个名字",
              "demoOnly": false,
              "fromRecord": false
            },
            {
              "id": "r2-c3",
              "slot": "dateText",
              "slotLabel": "举办时间",
              "short": "时间",
              "value": "2021年秋季",
              "state": "caliber",
              "note": "月份紧贴证据季节的开场边界，属于季节词写法的提前量",
              "demoOnly": false,
              "fromRecord": true
            },
            {
              "id": "r2-c4",
              "slot": "dateText",
              "slotLabel": "举办时间",
              "short": "时间",
              "value": "2025春季",
              "state": "conflict",
              "note": "两段时间的窗口不相交（冲突只作候选，不压成反对）",
              "demoOnly": false,
              "fromRecord": false
            },
            {
              "id": "r2-c5",
              "slot": "sessionName",
              "slotLabel": "专场名",
              "short": "专场",
              "value": "中國古董珍玩專場",
              "state": "exact",
              "note": "归一后完全一致",
              "demoOnly": false,
              "fromRecord": false
            },
            {
              "id": "r2-c6",
              "slot": "dateText",
              "slotLabel": "举办时间",
              "short": "时间",
              "value": "不详",
              "state": "unknown",
              "note": "时间写法解析不出，判不了",
              "demoOnly": true,
              "fromRecord": false
            },
            {
              "id": "r2-c7",
              "slot": "dateText",
              "slotLabel": "举办时间",
              "short": "时间",
              "value": "2021年8月",
              "state": "exact",
              "note": "证据的日期落在断言主张的范围内",
              "demoOnly": true,
              "fromRecord": false
            },
            {
              "id": "r2-c8",
              "slot": "dateText",
              "slotLabel": "举办时间",
              "short": "时间",
              "value": "2021年底",
              "state": "caliber",
              "note": "同一段时间的粗写与细写（证据窗口更宽）",
              "demoOnly": true,
              "fromRecord": false
            },
            {
              "id": "r2-c9",
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
              "id": "r2-c10",
              "slot": "sessionName",
              "slotLabel": "专场名",
              "short": "专场",
              "value": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
              "state": "mismatch",
              "note": "归一后仍不是同一个名字",
              "demoOnly": false,
              "fromRecord": true
            }
          ],
          "settleFrom": 7
        }
      ],
      "orders": [
        {
          "id": "order-1",
          "label": "教学顺序",
          "rounds": [
            [
              0,
              1,
              2,
              3,
              4,
              5,
              6,
              7,
              8,
              9
            ],
            [
              0,
              1,
              2,
              3,
              4,
              5,
              6,
              7,
              8,
              9
            ]
          ],
          "best": 199,
          "steady": 199,
          "literal": 127,
          "eager": 175
        },
        {
          "id": "order-2",
          "label": "牌序 2",
          "rounds": [
            [
              0,
              3,
              5,
              2,
              1,
              4,
              6,
              7,
              9,
              8
            ],
            [
              0,
              2,
              1,
              3,
              5,
              4,
              6,
              9,
              7,
              8
            ]
          ],
          "best": 199,
          "steady": 199,
          "literal": 127,
          "eager": 175
        },
        {
          "id": "order-3",
          "label": "牌序 3",
          "rounds": [
            [
              0,
              4,
              5,
              1,
              3,
              2,
              6,
              9,
              8,
              7
            ],
            [
              0,
              4,
              3,
              2,
              5,
              1,
              6,
              9,
              8,
              7
            ]
          ],
          "best": 199,
          "steady": 199,
          "literal": 127,
          "eager": 175
        },
        {
          "id": "order-4",
          "label": "牌序 4",
          "rounds": [
            [
              0,
              1,
              2,
              3,
              4,
              5,
              6,
              8,
              7,
              9
            ],
            [
              0,
              4,
              2,
              1,
              3,
              5,
              6,
              7,
              8,
              9
            ]
          ],
          "best": 199,
          "steady": 199,
          "literal": 127,
          "eager": 175
        },
        {
          "id": "order-5",
          "label": "牌序 5",
          "rounds": [
            [
              0,
              1,
              5,
              4,
              2,
              3,
              6,
              9,
              8,
              7
            ],
            [
              0,
              1,
              5,
              3,
              4,
              2,
              6,
              8,
              9,
              7
            ]
          ],
          "best": 199,
          "steady": 199,
          "literal": 127,
          "eager": 175
        },
        {
          "id": "order-6",
          "label": "牌序 6",
          "rounds": [
            [
              0,
              4,
              5,
              3,
              2,
              1,
              6,
              7,
              8,
              9
            ],
            [
              0,
              3,
              2,
              1,
              4,
              5,
              6,
              8,
              7,
              9
            ]
          ],
          "best": 199,
          "steady": 199,
          "literal": 127,
          "eager": 175
        }
      ]
    },
    {
      "id": "run-3",
      "label": "牌局 3",
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
              "value": "宸赏—明清御瓷珍玩",
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
              "value": "2021年12月",
              "state": "caliber",
              "note": "同一段时间的粗写与细写（证据窗口更宽）",
              "demoOnly": false,
              "fromRecord": false
            },
            {
              "id": "r1-c4",
              "slot": "sessionName",
              "slotLabel": "专场名",
              "short": "专场",
              "value": "禹貢I - 盛清御瓷新風尚",
              "state": "exact",
              "note": "归一后完全一致",
              "demoOnly": false,
              "fromRecord": false
            },
            {
              "id": "r1-c5",
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
              "id": "r1-c6",
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
              "id": "r1-c7",
              "slot": "dateText",
              "slotLabel": "举办时间",
              "short": "时间",
              "value": "2021-12-05",
              "state": "exact",
              "note": "证据的日期落在断言主张的范围内",
              "demoOnly": false,
              "fromRecord": false
            },
            {
              "id": "r1-c8",
              "slot": "auctionHouse",
              "slotLabel": "拍卖机构",
              "short": "机构",
              "value": "保利",
              "state": "caliber",
              "note": "同一机构的写法，一方多带地点限定词（可能是分支机构）",
              "demoOnly": false,
              "fromRecord": false
            },
            {
              "id": "r1-c9",
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
              "id": "r1-c10",
              "slot": "dateText",
              "slotLabel": "举办时间",
              "short": "时间",
              "value": "2021年底",
              "state": "caliber",
              "note": "同一段时间的粗写与细写（证据窗口更宽）",
              "demoOnly": true,
              "fromRecord": false
            }
          ],
          "settleFrom": 7
        },
        {
          "id": "round-2",
          "index": 1,
          "lot": {
            "comboId": "g-62",
            "recordId": "rec-poly-2021-yugong-2",
            "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
            "gate": "weak",
            "values": {
              "auctionHouse": "保利香港拍賣",
              "dateText": "2021年秋季",
              "sessionName": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术"
            }
          },
          "truth": [
            {
              "slot": "auctionHouse",
              "label": "拍卖机构",
              "evidenceValue": "北京保利",
              "state": "conflict"
            },
            {
              "slot": "dateText",
              "label": "举办时间",
              "evidenceValue": "2021年秋季",
              "state": "exact"
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
              "slot": "auctionHouse",
              "slotLabel": "拍卖机构",
              "short": "机构",
              "value": "保利香港拍賣",
              "state": "exact",
              "note": "同一机构，地点限定词一致",
              "demoOnly": false,
              "fromRecord": false
            },
            {
              "id": "r2-c2",
              "slot": "sessionName",
              "slotLabel": "专场名",
              "short": "专场",
              "value": "中國古董珍玩專場",
              "state": "mismatch",
              "note": "归一后仍不是同一个名字",
              "demoOnly": false,
              "fromRecord": false
            },
            {
              "id": "r2-c3",
              "slot": "dateText",
              "slotLabel": "举办时间",
              "short": "时间",
              "value": "2021年底",
              "state": "caliber",
              "note": "同一段时间的粗写与细写（证据窗口更宽）",
              "demoOnly": true,
              "fromRecord": false
            },
            {
              "id": "r2-c4",
              "slot": "dateText",
              "slotLabel": "举办时间",
              "short": "时间",
              "value": "2021年12月2日-6日",
              "state": "conflict",
              "note": "两段时间的窗口不相交（冲突只作候选，不压成反对）",
              "demoOnly": false,
              "fromRecord": false
            },
            {
              "id": "r2-c5",
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
              "id": "r2-c6",
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
              "id": "r2-c7",
              "slot": "dateText",
              "slotLabel": "举办时间",
              "short": "时间",
              "value": "2021年秋季",
              "state": "exact",
              "note": "证据的日期落在断言主张的范围内",
              "demoOnly": false,
              "fromRecord": true
            },
            {
              "id": "r2-c8",
              "slot": "dateText",
              "slotLabel": "举办时间",
              "short": "时间",
              "value": "2021年11月26日至12月13日",
              "state": "caliber",
              "note": "同一段时间的粗写与细写（证据窗口更宽）",
              "demoOnly": false,
              "fromRecord": false
            },
            {
              "id": "r2-c9",
              "slot": "auctionHouse",
              "slotLabel": "拍卖机构",
              "short": "机构",
              "value": "保利",
              "state": "caliber",
              "note": "同一机构的写法，一方多带地点限定词（可能是分支机构）",
              "demoOnly": false,
              "fromRecord": false
            },
            {
              "id": "r2-c10",
              "slot": "sessionName",
              "slotLabel": "专场名",
              "short": "专场",
              "value": "禹贡Ⅰ—盛清御瓷新风尚",
              "state": "mismatch",
              "note": "归一后仍不是同一个名字",
              "demoOnly": false,
              "fromRecord": false
            }
          ],
          "settleFrom": 7
        }
      ],
      "orders": [
        {
          "id": "order-1",
          "label": "教学顺序",
          "rounds": [
            [
              0,
              1,
              2,
              3,
              4,
              5,
              6,
              7,
              8,
              9
            ],
            [
              0,
              1,
              2,
              3,
              4,
              5,
              6,
              7,
              8,
              9
            ]
          ],
          "best": 199,
          "steady": 199,
          "literal": 127,
          "eager": 175
        },
        {
          "id": "order-2",
          "label": "牌序 2",
          "rounds": [
            [
              0,
              3,
              5,
              2,
              1,
              4,
              6,
              7,
              9,
              8
            ],
            [
              0,
              2,
              1,
              3,
              5,
              4,
              6,
              9,
              7,
              8
            ]
          ],
          "best": 199,
          "steady": 199,
          "literal": 127,
          "eager": 175
        },
        {
          "id": "order-3",
          "label": "牌序 3",
          "rounds": [
            [
              0,
              4,
              5,
              1,
              3,
              2,
              6,
              9,
              8,
              7
            ],
            [
              0,
              4,
              3,
              2,
              5,
              1,
              6,
              9,
              8,
              7
            ]
          ],
          "best": 199,
          "steady": 199,
          "literal": 127,
          "eager": 175
        },
        {
          "id": "order-4",
          "label": "牌序 4",
          "rounds": [
            [
              0,
              1,
              2,
              3,
              4,
              5,
              6,
              8,
              7,
              9
            ],
            [
              0,
              4,
              2,
              1,
              3,
              5,
              6,
              7,
              8,
              9
            ]
          ],
          "best": 199,
          "steady": 199,
          "literal": 127,
          "eager": 175
        },
        {
          "id": "order-5",
          "label": "牌序 5",
          "rounds": [
            [
              0,
              1,
              5,
              4,
              2,
              3,
              6,
              9,
              8,
              7
            ],
            [
              0,
              1,
              5,
              3,
              4,
              2,
              6,
              8,
              9,
              7
            ]
          ],
          "best": 199,
          "steady": 199,
          "literal": 127,
          "eager": 175
        },
        {
          "id": "order-6",
          "label": "牌序 6",
          "rounds": [
            [
              0,
              4,
              5,
              3,
              2,
              1,
              6,
              7,
              8,
              9
            ],
            [
              0,
              3,
              2,
              1,
              4,
              5,
              6,
              8,
              7,
              9
            ]
          ],
          "best": 199,
          "steady": 199,
          "literal": 127,
          "eager": 175
        }
      ]
    },
    {
      "id": "run-4",
      "label": "牌局 4",
      "rounds": [
        {
          "id": "round-1",
          "index": 0,
          "lot": {
            "comboId": "g-51",
            "recordId": "rec-poly-2021-yugong-1",
            "recordTitle": "北京保利 · 禹贡Ⅰ—盛清御瓷新风尚（2021年12月5日）",
            "gate": "strong",
            "values": {
              "auctionHouse": "保利香港拍賣",
              "dateText": "2021年12月5日",
              "sessionName": "禹贡Ⅰ—盛清御瓷新风尚"
            }
          },
          "truth": [
            {
              "slot": "auctionHouse",
              "label": "拍卖机构",
              "evidenceValue": "北京保利",
              "state": "conflict"
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
              "value": "保利香港拍賣",
              "state": "exact",
              "note": "同一机构，地点限定词一致",
              "demoOnly": false,
              "fromRecord": false
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
              "value": "2021年12月2日-6日",
              "state": "caliber",
              "note": "同一段时间的粗写与细写（证据窗口更宽）",
              "demoOnly": false,
              "fromRecord": false
            },
            {
              "id": "r1-c4",
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
              "id": "r1-c5",
              "slot": "dateText",
              "slotLabel": "举办时间",
              "short": "时间",
              "value": "不详",
              "state": "unknown",
              "note": "时间写法解析不出，判不了",
              "demoOnly": true,
              "fromRecord": false
            },
            {
              "id": "r1-c6",
              "slot": "auctionHouse",
              "slotLabel": "拍卖机构",
              "short": "机构",
              "value": "北京保利",
              "state": "conflict",
              "note": "同名但地点限定词指向不同城市（香港 / 北京）",
              "demoOnly": false,
              "fromRecord": true
            },
            {
              "id": "r1-c7",
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
              "id": "r1-c8",
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
              "id": "r1-c9",
              "slot": "dateText",
              "slotLabel": "举办时间",
              "short": "时间",
              "value": "2021秋季",
              "state": "edge",
              "note": "只在两侧各放宽一个月的窗口边缘擦上，不等于同一件",
              "demoOnly": false,
              "fromRecord": false
            },
            {
              "id": "r1-c10",
              "slot": "dateText",
              "slotLabel": "举办时间",
              "short": "时间",
              "value": "2021年11月26日至12月13日",
              "state": "caliber",
              "note": "同一段时间的粗写与细写（证据窗口更宽）",
              "demoOnly": false,
              "fromRecord": false
            }
          ],
          "settleFrom": 7
        },
        {
          "id": "round-2",
          "index": 1,
          "lot": {
            "comboId": "g-83",
            "recordId": "rec-poly-2021-yugong-2",
            "recordTitle": "北京保利 · 禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术（2021年秋季）",
            "gate": "weak",
            "values": {
              "auctionHouse": "保利拍卖",
              "dateText": "2021年11月15日",
              "sessionName": "禹贡Ⅲ—盛清御瓷新风尚"
            }
          },
          "truth": [
            {
              "slot": "auctionHouse",
              "label": "拍卖机构",
              "evidenceValue": "北京保利",
              "state": "caliber"
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
              "state": "mismatch"
            }
          ],
          "chips": [
            {
              "id": "r2-c1",
              "slot": "auctionHouse",
              "slotLabel": "拍卖机构",
              "short": "机构",
              "value": "保利拍卖",
              "state": "exact",
              "note": "同一机构，地点限定词一致",
              "demoOnly": true,
              "fromRecord": false
            },
            {
              "id": "r2-c2",
              "slot": "sessionName",
              "slotLabel": "专场名",
              "short": "专场",
              "value": "递藏之趣专场",
              "state": "mismatch",
              "note": "归一后仍不是同一个名字",
              "demoOnly": false,
              "fromRecord": false
            },
            {
              "id": "r2-c3",
              "slot": "dateText",
              "slotLabel": "举办时间",
              "short": "时间",
              "value": "2021秋季",
              "state": "caliber",
              "note": "同一段时间的粗写与细写（证据窗口更宽）",
              "demoOnly": false,
              "fromRecord": false
            },
            {
              "id": "r2-c4",
              "slot": "dateText",
              "slotLabel": "举办时间",
              "short": "时间",
              "value": "2021/12/5",
              "state": "conflict",
              "note": "两段时间的窗口不相交（冲突只作候选，不压成反对）",
              "demoOnly": false,
              "fromRecord": false
            },
            {
              "id": "r2-c5",
              "slot": "sessionName",
              "slotLabel": "专场名",
              "short": "专场",
              "value": "禹贡Ⅲ—盛清御瓷新风尚",
              "state": "exact",
              "note": "归一后完全一致",
              "demoOnly": false,
              "fromRecord": false
            },
            {
              "id": "r2-c6",
              "slot": "dateText",
              "slotLabel": "举办时间",
              "short": "时间",
              "value": "不详",
              "state": "unknown",
              "note": "时间写法解析不出，判不了",
              "demoOnly": true,
              "fromRecord": false
            },
            {
              "id": "r2-c7",
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
              "id": "r2-c8",
              "slot": "dateText",
              "slotLabel": "举办时间",
              "short": "时间",
              "value": "2021年底",
              "state": "caliber",
              "note": "同一段时间的粗写与细写（证据窗口更宽）",
              "demoOnly": true,
              "fromRecord": false
            },
            {
              "id": "r2-c9",
              "slot": "auctionHouse",
              "slotLabel": "拍卖机构",
              "short": "机构",
              "value": "北京保利",
              "state": "caliber",
              "note": "同一机构的写法，一方多带地点限定词（可能是分支机构）",
              "demoOnly": false,
              "fromRecord": true
            },
            {
              "id": "r2-c10",
              "slot": "sessionName",
              "slotLabel": "专场名",
              "short": "专场",
              "value": "宸赏—明清御瓷珍玩",
              "state": "mismatch",
              "note": "归一后仍不是同一个名字",
              "demoOnly": false,
              "fromRecord": false
            }
          ],
          "settleFrom": 7
        }
      ],
      "orders": [
        {
          "id": "order-1",
          "label": "教学顺序",
          "rounds": [
            [
              0,
              1,
              2,
              3,
              4,
              5,
              6,
              7,
              8,
              9
            ],
            [
              0,
              1,
              2,
              3,
              4,
              5,
              6,
              7,
              8,
              9
            ]
          ],
          "best": 199,
          "steady": 199,
          "literal": 127,
          "eager": 175
        },
        {
          "id": "order-2",
          "label": "牌序 2",
          "rounds": [
            [
              0,
              3,
              5,
              2,
              1,
              4,
              6,
              7,
              9,
              8
            ],
            [
              0,
              2,
              1,
              3,
              5,
              4,
              6,
              9,
              7,
              8
            ]
          ],
          "best": 199,
          "steady": 199,
          "literal": 127,
          "eager": 175
        },
        {
          "id": "order-3",
          "label": "牌序 3",
          "rounds": [
            [
              0,
              4,
              5,
              1,
              3,
              2,
              6,
              9,
              8,
              7
            ],
            [
              0,
              4,
              3,
              2,
              5,
              1,
              6,
              9,
              8,
              7
            ]
          ],
          "best": 199,
          "steady": 199,
          "literal": 127,
          "eager": 175
        },
        {
          "id": "order-4",
          "label": "牌序 4",
          "rounds": [
            [
              0,
              1,
              2,
              3,
              4,
              5,
              6,
              8,
              7,
              9
            ],
            [
              0,
              4,
              2,
              1,
              3,
              5,
              6,
              7,
              8,
              9
            ]
          ],
          "best": 199,
          "steady": 199,
          "literal": 127,
          "eager": 175
        },
        {
          "id": "order-5",
          "label": "牌序 5",
          "rounds": [
            [
              0,
              1,
              5,
              4,
              2,
              3,
              6,
              9,
              8,
              7
            ],
            [
              0,
              1,
              5,
              3,
              4,
              2,
              6,
              8,
              9,
              7
            ]
          ],
          "best": 199,
          "steady": 199,
          "literal": 127,
          "eager": 175
        },
        {
          "id": "order-6",
          "label": "牌序 6",
          "rounds": [
            [
              0,
              4,
              5,
              3,
              2,
              1,
              6,
              7,
              8,
              9
            ],
            [
              0,
              3,
              2,
              1,
              4,
              5,
              6,
              8,
              7,
              9
            ]
          ],
          "best": 199,
          "steady": 199,
          "literal": 127,
          "eager": 175
        }
      ]
    }
  ],
  "stats": {
    "chips": 20,
    "byState": {
      "exact": 6,
      "caliber": 6,
      "edge": 1,
      "conflict": 2,
      "mismatch": 3,
      "unknown": 2
    },
    "runs": 4,
    "deckOverlap": [
      {
        "a": "run-1",
        "b": "run-2",
        "shared": 8,
        "sameAnswer": 5
      },
      {
        "a": "run-1",
        "b": "run-3",
        "shared": 16,
        "sameAnswer": 8
      },
      {
        "a": "run-1",
        "b": "run-4",
        "shared": 11,
        "sameAnswer": 7
      },
      {
        "a": "run-2",
        "b": "run-3",
        "shared": 10,
        "sameAnswer": 5
      },
      {
        "a": "run-2",
        "b": "run-4",
        "shared": 13,
        "sameAnswer": 8
      },
      {
        "a": "run-3",
        "b": "run-4",
        "shared": 9,
        "sameAnswer": 4
      }
    ]
  }
};
