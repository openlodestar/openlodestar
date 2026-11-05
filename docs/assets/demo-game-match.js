/* docs/assets/demo-game-match.js
 *
 * 小游戏的纯逻辑层：把"当前四个槽位的取值"换算成页面要显示的那一条结论。
 *
 * 三条不能破的规则：
 * 1. 先查**构建时冻结的组合矩阵**，不在矩阵里就是「这批证据没覆盖」；
 * 2. 覆盖的组合只指向一条冻结记录，逐条证据仍按「记录号 + 字段名 + 字段值」从 demo-data 取；
 * 3. 任何一步对不上都退回「这批证据没覆盖」，绝不显示成「被反驳」或「被拒收」。
 *
 * 不碰 DOM、不读网络，浏览器与 Node 测试共用同一份实现。
 */
(function (root) {
  'use strict';

  var SLOT_KEYS = ['auctionHouse', 'dateText', 'sessionPrefix', 'sessionSubtitle'];

  var STATUS_LABELS = {
    strong: '强坐标',
    weak: '弱坐标（只有单一独立来源或判据维度不够）',
    refuted: '被反驳',
    not_found: '查过，这批证据里没有',
    uncovered: '这批证据没覆盖'
  };

  /** 选项上的短标签：只够放两三个字，长标签留给结论本身 */
  var STATUS_SHORT = {
    strong: '强',
    weak: '弱',
    refuted: '反驳',
    not_found: '查过没找到',
    uncovered: '没覆盖'
  };

  var STATUS_HINTS = {
    strong: '关键维度各自对上、累计分过线，且关键字段在同一个页面上同时出现。',
    weak: '关键字段都成立，但同一件事只有一篇原创来源或判据维度不够，撑不起强档。',
    refuted: '有独立来源直接反驳其中某个字段，整条记录拒收。',
    not_found: '这些字段都查过了，但这批页面里没有任何一处提到它——这是「这批证据里没有」，不是「世界上不存在」。',
    uncovered: '冻结数据里没有任何一条记录同时写着这四个值，所以没查过。没查过不等于被反驳：既不能说它成立，也不能说它不成立。'
  };

  var UNCOVERED_REASON =
    '这组取值是把冻结数据里不同记录写过的词拼在一起：机构、时间、专场名来自不同场次，' +
    '没有任何一条冻结记录同时写着这四个值。这批证据没覆盖它，不沿用旧结论，也不判成被拒收。';

  function comboKey(values) {
    return SLOT_KEYS.map(function (key) {
      return String(values && values[key] !== undefined ? values[key] : '');
    }).join('\u0000');
  }

  function findCombo(data, values) {
    var key = comboKey(values);
    var combos = data && Array.isArray(data.combos) ? data.combos : [];
    for (var i = 0; i < combos.length; i += 1) {
      if (combos[i].key === key) return combos[i];
    }
    return null;
  }

  function tripleKeyOf(triple) {
    return [
      String(triple && triple.auctionHouse !== undefined ? triple.auctionHouse : ''),
      String(triple && triple.sessionPrefix !== undefined ? triple.sessionPrefix : ''),
      String(triple && triple.sessionSubtitle !== undefined ? triple.sessionSubtitle : '')
    ].join('\u0000');
  }

  /**
   * 某个槽位此刻能选的候选。
   *
   * 机构、专场主名、副题三者必须能构成冻结数据里真实出现过的三元组：换一个词时，
   * 其余两个词保持不动，候选值只有能和它们拼成一个真实三元组时才列出来。
   * 时间槽不参与三元组，始终列全部候选。
   */
  function slotOptions(data, values, slotKey) {
    var slot = null;
    var slots = data && Array.isArray(data.slots) ? data.slots : [];
    slots.forEach(function (item) {
      if (item.key === slotKey) slot = item;
    });
    if (!slot) return [];
    if (slotKey === 'dateText') return slot.options.slice();
    var triples = data && Array.isArray(data.triples) ? data.triples : [];
    if (triples.length === 0) return slot.options.slice();
    var probe = copyValues(values);
    return slot.options.filter(function (option) {
      probe[slotKey] = option;
      var key = tripleKeyOf(probe);
      return triples.some(function (triple) {
        return tripleKeyOf(triple) === key;
      });
    });
  }

  function recordIndex(demoData) {
    var map = {};
    var cases = demoData && Array.isArray(demoData.cases) ? demoData.cases : [];
    cases.forEach(function (caseInfo) {
      (caseInfo.records || []).forEach(function (record) {
        map[record.recordId] = record;
      });
    });
    return map;
  }

  function uncoveredResult(combo, reason) {
    return {
      status: 'uncovered',
      label: STATUS_LABELS.uncovered,
      hint: STATUS_HINTS.uncovered,
      reason: reason || UNCOVERED_REASON,
      combo: combo || null,
      record: null,
      view: null
    };
  }

  /**
   * 当前取值 → 一条可显示的结果。
   * covered 时 status 取自组合矩阵里冻结的 bucket；字段详情用冻结记录的视图。
   */
  function resolve(data, demoData, values) {
    var combo = findCombo(data, values);
    if (!combo) return uncoveredResult(null, '这组取值不在冻结组合矩阵里。');
    if (combo.status !== 'covered' || !combo.recordId) return uncoveredResult(combo);
    var records = recordIndex(demoData);
    var record = records[combo.recordId];
    if (!record) {
      return uncoveredResult(combo, '组合矩阵指向的记录不在冻结数据里，这批证据没覆盖。');
    }
    var api = root.LODESTAR_MATCH;
    if (!api || typeof api.buildView !== 'function') {
      return uncoveredResult(combo, '页面的证据匹配模块没有装载，这批证据没覆盖。');
    }
    var view = api.buildView(record);
    if (view.gate === 'uncovered') {
      return uncoveredResult(combo, '记录里的字段值与组合矩阵对不上，这批证据没覆盖。');
    }
    var status = combo.computation ? combo.computation.bucket : view.bucket;
    if (view.bucket !== status) {
      return uncoveredResult(combo, '组合矩阵与冻结记录的结论对不上，这批证据没覆盖。');
    }
    return {
      status: status,
      label: STATUS_LABELS[status] || STATUS_LABELS.uncovered,
      hint: STATUS_HINTS[status] || STATUS_HINTS.uncovered,
      reason: view.reason,
      combo: combo,
      record: record,
      view: view
    };
  }

  function copyValues(values) {
    var out = {};
    SLOT_KEYS.forEach(function (key) {
      out[key] = values && values[key] !== undefined ? values[key] : '';
    });
    return out;
  }

  /** 两个取值有哪几个槽不一样（0 表示同一组取值） */
  function distanceOf(a, b) {
    var distance = 0;
    SLOT_KEYS.forEach(function (key) {
      if (String(a[key]) !== String(b[key])) distance += 1;
    });
    return distance;
  }

  /**
   * 把某个槽换成某个候选值之后会得到什么结论。
   * 选项上的状态小标就靠它——仍然是查冻结矩阵，不在矩阵里就是「没覆盖」。
   */
  function substitutionStatus(data, demoData, values, slotKey, option) {
    if (SLOT_KEYS.indexOf(slotKey) === -1) return 'uncovered';
    var next = copyValues(values);
    next[slotKey] = option;
    return resolve(data, demoData, next).status;
  }

  var BUCKET_ORDER = { strong: 0, weak: 1, refuted: 2, not_found: 3 };

  /**
   * 离当前取值最近的几条有结论的组合（先比要改几个词，同距离再按结论档位）。
   * 用来在「没覆盖」的时候给出一步就能跳到的去处，省得靠瞎点碰运气。
   */
  function nearbyCovered(data, values, limit) {
    var max = typeof limit === 'number' && limit > 0 ? limit : 3;
    var current = copyValues(values);
    var list = [];
    var combos = data && Array.isArray(data.combos) ? data.combos : [];
    combos.forEach(function (combo) {
      if (combo.status !== 'covered' || !combo.computation) return;
      var distance = distanceOf(combo.values, current);
      if (distance === 0) return;
      list.push({
        id: combo.id,
        values: copyValues(combo.values),
        status: combo.computation.bucket,
        distance: distance
      });
    });
    list.sort(function (a, b) {
      if (a.distance !== b.distance) return a.distance - b.distance;
      var orderA = BUCKET_ORDER[a.status] === undefined ? 9 : BUCKET_ORDER[a.status];
      var orderB = BUCKET_ORDER[b.status] === undefined ? 9 : BUCKET_ORDER[b.status];
      if (orderA !== orderB) return orderA - orderB;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    return list.slice(0, max);
  }

  /** 覆盖读数：从矩阵现场数出来，不另存一份会漂移的手写数字 */
  function coverage(data) {
    var stats = {
      total: 0,
      covered: 0,
      uncovered: 0,
      byStatus: { strong: 0, weak: 0, refuted: 0, not_found: 0 }
    };
    var combos = data && Array.isArray(data.combos) ? data.combos : [];
    combos.forEach(function (combo) {
      stats.total += 1;
      if (combo.status !== 'covered' || !combo.computation) {
        stats.uncovered += 1;
        return;
      }
      stats.covered += 1;
      var bucket = combo.computation.bucket;
      if (stats.byStatus[bucket] !== undefined) stats.byStatus[bucket] += 1;
    });
    return stats;
  }

  root.LODESTAR_GAME = {
    SLOT_KEYS: SLOT_KEYS,
    STATUS_LABELS: STATUS_LABELS,
    STATUS_SHORT: STATUS_SHORT,
    STATUS_HINTS: STATUS_HINTS,
    comboKey: comboKey,
    tripleKeyOf: tripleKeyOf,
    slotOptions: slotOptions,
    findCombo: findCombo,
    recordIndex: recordIndex,
    resolve: resolve,
    coverage: coverage,
    substitutionStatus: substitutionStatus,
    distanceOf: distanceOf,
    nearbyCovered: nearbyCovered
  };
})(typeof window !== 'undefined' ? window : globalThis);
