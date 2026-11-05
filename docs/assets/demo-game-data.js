// 由 src/demo-page/build-demo-game.ts 从 examples/ 与 demo-data.js 生成，不要手改；改槽位或批次后重跑 pnpm run demo:game。
// 组合矩阵只冻结"哪组取值命中哪条冻结记录"与引擎摘要；逐条证据、引文与快照在 demo-data.js，页面按记录号引用。
window.LODESTAR_DEMO_GAME = {
  "generatedAt": "2026-11-05T16:30:08.628Z",
  "generator": "src/demo-page/build-demo-game.ts",
  "note": "组合矩阵在构建时算好：机构 + 专场主名 + 副题只取冻结记录里真实出现过的三元组，每个三元组再与四个时间候选组合；匹配不到记录就是「这批证据没覆盖」，不继承旧证据，也不判成被拒收。裁决、共现、坐标随记录冻结，逐条引文在 demo-data.js。",
  "slots": [
    {
      "key": "auctionHouse",
      "label": "拍卖机构",
      "options": [
        "北京保利"
      ]
    },
    {
      "key": "dateText",
      "label": "举办时间",
      "options": [
        "2021年12月5日",
        "2021年11月15日",
        "2021年秋季",
        "2021年12月"
      ]
    },
    {
      "key": "sessionPrefix",
      "label": "专场主名",
      "options": [
        "禹贡Ⅰ",
        "禹贡Ⅱ",
        "禹贡Ⅲ"
      ]
    },
    {
      "key": "sessionSubtitle",
      "label": "专场副题",
      "options": [
        "盛清御瓷新风尚",
        "郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术"
      ]
    }
  ],
  "triples": [
    {
      "auctionHouse": "北京保利",
      "sessionPrefix": "禹贡Ⅰ",
      "sessionSubtitle": "盛清御瓷新风尚"
    },
    {
      "auctionHouse": "北京保利",
      "sessionPrefix": "禹贡Ⅱ",
      "sessionSubtitle": "郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术"
    },
    {
      "auctionHouse": "北京保利",
      "sessionPrefix": "禹贡Ⅲ",
      "sessionSubtitle": "盛清御瓷新风尚"
    }
  ],
  "combos": [
    {
      "id": "g-01",
      "key": "北京保利\u00002021年12月5日\u0000禹贡Ⅰ\u0000盛清御瓷新风尚",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "2021年12月5日",
        "sessionPrefix": "禹贡Ⅰ",
        "sessionSubtitle": "盛清御瓷新风尚"
      },
      "sentence": "北京保利 在 2021年12月5日 举办了一场名为「禹贡Ⅰ—盛清御瓷新风尚」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-1",
      "caseId": "poly-2021-autumn",
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-1",
          "caseId": "poly-2021-autumn",
          "gate": "strong",
          "bucket": "strong"
        },
        {
          "recordId": "rec-20261104-9ba4ea",
          "caseId": "demo-batch-14",
          "gate": "strong",
          "bucket": "strong"
        },
        {
          "recordId": "rec-20261104-a8e3db",
          "caseId": "demo-batch-11",
          "gate": "weak",
          "bucket": "weak"
        }
      ],
      "computation": {
        "gate": "strong",
        "bucket": "strong",
        "keyFieldValues": {
          "auctionHouse": "北京保利",
          "dateText": "2021年12月5日",
          "sessionName": "禹贡Ⅰ—盛清御瓷新风尚"
        },
        "fieldVerdicts": {
          "auctionHouse": {
            "fieldValue": "北京保利",
            "verdict": "supported",
            "evidenceGrade": "E2",
            "supportCount": 2,
            "refuteCount": 0,
            "notFoundCause": null,
            "examinedPages": 2
          },
          "dateText": {
            "fieldValue": "2021年12月5日",
            "verdict": "supported",
            "evidenceGrade": "E2",
            "supportCount": 2,
            "refuteCount": 0,
            "notFoundCause": null,
            "examinedPages": 2
          },
          "sessionName": {
            "fieldValue": "禹贡Ⅰ—盛清御瓷新风尚",
            "verdict": "supported",
            "evidenceGrade": "E2",
            "supportCount": 2,
            "refuteCount": 0,
            "notFoundCause": null,
            "examinedPages": 2
          },
          "location": {
            "fieldValue": "北京",
            "verdict": "supported",
            "evidenceGrade": "E1",
            "supportCount": 1,
            "refuteCount": 0,
            "notFoundCause": null,
            "examinedPages": 1
          }
        },
        "cooccurrence": {
          "count": 2,
          "pages": [
            "https://amma.artron.net/observation_shownews.php?newid=1104807",
            "https://hk.thevalue.com/articles/poly-auction-beijing-qianlong-yangcai-elephant-robin-egg-glaze-revolving-vase-result"
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
        },
        "evidenceCount": 7
      }
    },
    {
      "id": "g-02",
      "key": "北京保利\u00002021年11月15日\u0000禹贡Ⅰ\u0000盛清御瓷新风尚",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "2021年11月15日",
        "sessionPrefix": "禹贡Ⅰ",
        "sessionSubtitle": "盛清御瓷新风尚"
      },
      "sentence": "北京保利 在 2021年11月15日 举办了一场名为「禹贡Ⅰ—盛清御瓷新风尚」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-1-nov15",
      "caseId": "poly-2021-autumn",
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-1-nov15",
          "caseId": "poly-2021-autumn",
          "gate": "rejected",
          "bucket": "refuted"
        }
      ],
      "computation": {
        "gate": "rejected",
        "bucket": "refuted",
        "keyFieldValues": {
          "auctionHouse": "北京保利",
          "dateText": "2021年11月15日",
          "sessionName": "禹贡Ⅰ—盛清御瓷新风尚"
        },
        "fieldVerdicts": {
          "auctionHouse": {
            "fieldValue": "北京保利",
            "verdict": "supported",
            "evidenceGrade": "E2",
            "supportCount": 2,
            "refuteCount": 0,
            "notFoundCause": null,
            "examinedPages": 2
          },
          "dateText": {
            "fieldValue": "2021年11月15日",
            "verdict": "refuted",
            "evidenceGrade": "E2",
            "supportCount": 0,
            "refuteCount": 2,
            "notFoundCause": null,
            "examinedPages": 2
          },
          "sessionName": {
            "fieldValue": "禹贡Ⅰ—盛清御瓷新风尚",
            "verdict": "supported",
            "evidenceGrade": "E2",
            "supportCount": 2,
            "refuteCount": 0,
            "notFoundCause": null,
            "examinedPages": 2
          }
        },
        "cooccurrence": {
          "count": 0,
          "pages": []
        },
        "anchor": null,
        "evidenceCount": 6
      }
    },
    {
      "id": "g-03",
      "key": "北京保利\u00002021年秋季\u0000禹贡Ⅰ\u0000盛清御瓷新风尚",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "2021年秋季",
        "sessionPrefix": "禹贡Ⅰ",
        "sessionSubtitle": "盛清御瓷新风尚"
      },
      "sentence": "北京保利 在 2021年秋季 举办了一场名为「禹贡Ⅰ—盛清御瓷新风尚」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "matched": [],
      "computation": null
    },
    {
      "id": "g-04",
      "key": "北京保利\u00002021年12月\u0000禹贡Ⅰ\u0000盛清御瓷新风尚",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "2021年12月",
        "sessionPrefix": "禹贡Ⅰ",
        "sessionSubtitle": "盛清御瓷新风尚"
      },
      "sentence": "北京保利 在 2021年12月 举办了一场名为「禹贡Ⅰ—盛清御瓷新风尚」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "matched": [],
      "computation": null
    },
    {
      "id": "g-05",
      "key": "北京保利\u00002021年12月5日\u0000禹贡Ⅱ\u0000郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "2021年12月5日",
        "sessionPrefix": "禹贡Ⅱ",
        "sessionSubtitle": "郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术"
      },
      "sentence": "北京保利 在 2021年12月5日 举办了一场名为「禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "matched": [],
      "computation": null
    },
    {
      "id": "g-06",
      "key": "北京保利\u00002021年11月15日\u0000禹贡Ⅱ\u0000郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "2021年11月15日",
        "sessionPrefix": "禹贡Ⅱ",
        "sessionSubtitle": "郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术"
      },
      "sentence": "北京保利 在 2021年11月15日 举办了一场名为「禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "matched": [],
      "computation": null
    },
    {
      "id": "g-07",
      "key": "北京保利\u00002021年秋季\u0000禹贡Ⅱ\u0000郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "2021年秋季",
        "sessionPrefix": "禹贡Ⅱ",
        "sessionSubtitle": "郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术"
      },
      "sentence": "北京保利 在 2021年秋季 举办了一场名为「禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-2",
      "caseId": "poly-2021-autumn",
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-2",
          "caseId": "poly-2021-autumn",
          "gate": "weak",
          "bucket": "weak"
        }
      ],
      "computation": {
        "gate": "weak",
        "bucket": "weak",
        "keyFieldValues": {
          "auctionHouse": "北京保利",
          "dateText": "2021年秋季",
          "sessionName": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术"
        },
        "fieldVerdicts": {
          "auctionHouse": {
            "fieldValue": "北京保利",
            "verdict": "supported",
            "evidenceGrade": "E1",
            "supportCount": 1,
            "refuteCount": 0,
            "notFoundCause": null,
            "examinedPages": 1
          },
          "dateText": {
            "fieldValue": "2021年秋季",
            "verdict": "supported",
            "evidenceGrade": "E1",
            "supportCount": 1,
            "refuteCount": 0,
            "notFoundCause": null,
            "examinedPages": 1
          },
          "sessionName": {
            "fieldValue": "禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
            "verdict": "supported",
            "evidenceGrade": "E1",
            "supportCount": 1,
            "refuteCount": 0,
            "notFoundCause": null,
            "examinedPages": 1
          }
        },
        "cooccurrence": {
          "count": 1,
          "pages": [
            "https://m.thepaper.cn/newsDetail_forward_15697852"
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
        },
        "evidenceCount": 3
      }
    },
    {
      "id": "g-08",
      "key": "北京保利\u00002021年12月\u0000禹贡Ⅱ\u0000郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "2021年12月",
        "sessionPrefix": "禹贡Ⅱ",
        "sessionSubtitle": "郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术"
      },
      "sentence": "北京保利 在 2021年12月 举办了一场名为「禹贡Ⅱ—郎世宁绘《纯惠皇贵妃油画像》暨重要宫廷艺术」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "matched": [],
      "computation": null
    },
    {
      "id": "g-09",
      "key": "北京保利\u00002021年12月5日\u0000禹贡Ⅲ\u0000盛清御瓷新风尚",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "2021年12月5日",
        "sessionPrefix": "禹贡Ⅲ",
        "sessionSubtitle": "盛清御瓷新风尚"
      },
      "sentence": "北京保利 在 2021年12月5日 举办了一场名为「禹贡Ⅲ—盛清御瓷新风尚」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "matched": [],
      "computation": null
    },
    {
      "id": "g-10",
      "key": "北京保利\u00002021年11月15日\u0000禹贡Ⅲ\u0000盛清御瓷新风尚",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "2021年11月15日",
        "sessionPrefix": "禹贡Ⅲ",
        "sessionSubtitle": "盛清御瓷新风尚"
      },
      "sentence": "北京保利 在 2021年11月15日 举办了一场名为「禹贡Ⅲ—盛清御瓷新风尚」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "matched": [],
      "computation": null
    },
    {
      "id": "g-11",
      "key": "北京保利\u00002021年秋季\u0000禹贡Ⅲ\u0000盛清御瓷新风尚",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "2021年秋季",
        "sessionPrefix": "禹贡Ⅲ",
        "sessionSubtitle": "盛清御瓷新风尚"
      },
      "sentence": "北京保利 在 2021年秋季 举办了一场名为「禹贡Ⅲ—盛清御瓷新风尚」的拍卖会。",
      "status": "uncovered",
      "recordId": null,
      "caseId": null,
      "matched": [],
      "computation": null
    },
    {
      "id": "g-12",
      "key": "北京保利\u00002021年12月\u0000禹贡Ⅲ\u0000盛清御瓷新风尚",
      "values": {
        "auctionHouse": "北京保利",
        "dateText": "2021年12月",
        "sessionPrefix": "禹贡Ⅲ",
        "sessionSubtitle": "盛清御瓷新风尚"
      },
      "sentence": "北京保利 在 2021年12月 举办了一场名为「禹贡Ⅲ—盛清御瓷新风尚」的拍卖会。",
      "status": "covered",
      "recordId": "rec-poly-2021-yugong-3",
      "caseId": "poly-2021-autumn",
      "matched": [
        {
          "recordId": "rec-poly-2021-yugong-3",
          "caseId": "poly-2021-autumn",
          "gate": "rejected",
          "bucket": "not_found"
        }
      ],
      "computation": {
        "gate": "rejected",
        "bucket": "not_found",
        "keyFieldValues": {
          "auctionHouse": "北京保利",
          "dateText": "2021年12月",
          "sessionName": "禹贡Ⅲ—盛清御瓷新风尚"
        },
        "fieldVerdicts": {
          "auctionHouse": {
            "fieldValue": "北京保利",
            "verdict": "supported",
            "evidenceGrade": "E2",
            "supportCount": 2,
            "refuteCount": 0,
            "notFoundCause": null,
            "examinedPages": 2
          },
          "dateText": {
            "fieldValue": "2021年12月",
            "verdict": "supported",
            "evidenceGrade": "E2",
            "supportCount": 2,
            "refuteCount": 0,
            "notFoundCause": null,
            "examinedPages": 2
          },
          "sessionName": {
            "fieldValue": "禹贡Ⅲ—盛清御瓷新风尚",
            "verdict": "not_found",
            "evidenceGrade": "E0",
            "supportCount": 0,
            "refuteCount": 0,
            "notFoundCause": "coverage",
            "examinedPages": 2
          }
        },
        "cooccurrence": {
          "count": 0,
          "pages": []
        },
        "anchor": null,
        "evidenceCount": 6
      }
    }
  ],
  "stats": {
    "total": 12,
    "covered": 4,
    "uncovered": 8,
    "byStatus": {
      "strong": 1,
      "weak": 1,
      "refuted": 1,
      "not_found": 1
    },
    "maxCombos": 100
  }
};
