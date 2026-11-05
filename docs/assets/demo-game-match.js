/* docs/assets/demo-game-match.js
 *
 * 小游戏的查表与状态映射：页面与测试共用同一份规则。
 *
 * 组合矩阵由 `src/demo-page/build-demo-game.ts` 在构建时算好并冻结，
 * 这里只做三件事：
 * 1. 按三个槽位的取值查组合（查不到就退回「没覆盖」，不猜、不继承旧证据）；
 * 2. 把组合里的逐维状态与结论整理成页面能直接渲染的视图；
 * 3. 给出覆盖读数与「每种结论挑一条」的跳转入口。
 *
 * 结论取三个槽位里最差的那一维，所以「有一维只到口径相容」不会被组合级的强坐标盖掉。
 */
(function (root) {
  'use strict';

  var SLOT_KEYS = ['auctionHouse', 'dateText', 'sessionName'];

  var CONCLUSION_LABELS = {
    strong: '强坐标',
    weak: '弱坐标',
    caliber: '只找到相容证据',
    edge: '没有矛盾，但这不能证明',
    conflict: '冲突候选',
    mismatch: '没对上，证据写的是别的',
    unknown: '无从判断',
    uncovered: '这批证据没覆盖'
  };

  /** 候选按钮上的短标：只有这里是缩写，判定卡上一律用全称 */
  var CONCLUSION_SHORT = {
    strong: '强坐标',
    weak: '弱坐标',
    caliber: '口径相容',
    edge: '边缘相容',
    conflict: '冲突候选',
    mismatch: '没对上',
    unknown: '无从判断',
    uncovered: '没覆盖'
  };

  var CONCLUSION_HINTS = {
    strong: '三个词都能在证据里找到同一写法，且撑起这条记录的独立来源够用',
    weak: '三个词都对上了，但撑起这条记录的独立来源不够，只到弱坐标',
    caliber: '有证据，但至少一维最多只到「说法不同」——很可能是同一场，只是写法不一样，这不能算对上',
    edge: '有证据，但至少一维只到「没有矛盾，但这不能证明」，撑不起结论',
    conflict: '至少一维的原文值与你的说法冲突；冲突只作候选，不压成「反对」',
    mismatch: '至少一维的证据明确写的是另一个值',
    unknown: '至少一维的说法解析不出来，判不了',
    uncovered: '没有任何一条冻结记录同时在两个词上对上或相容'
  };

  /** 与构建脚本同一套严重度：结论取最差的那一维 */
  var STATE_SEVERITY = ['conflict', 'mismatch', 'unknown', 'edge', 'caliber', 'exact'];

  var DEMO_ONLY_LEGEND =
    '带「演示用词」标记的词是演示时编的，不在采集回来的页面里出现过；它们只是为了让「口径相容」「无从判断」这两条路走得通。';

  function comboKey(values) {
    return SLOT_KEYS.map(function (key) {
      return values[key];
    }).join('\u0000');
  }

  function indexCombos(data) {
    var byKey = {};
    (data.combos || []).forEach(function (combo) {
      byKey[combo.key] = combo;
    });
    return byKey;
  }

  function recordIndex(demoData) {
    var byId = {};
    (demoData.cases || []).forEach(function (caseInfo) {
      (caseInfo.records || []).forEach(function (record) {
        byId[record.recordId] = record;
      });
    });
    return byId;
  }

  function findCombo(data, values) {
    var key = comboKey(values);
    for (var i = 0; i < data.combos.length; i += 1) {
      if (data.combos[i].key === key) return data.combos[i];
    }
    return null;
  }

  function slotOptions(data, slotKey) {
    for (var i = 0; i < data.slots.length; i += 1) {
      if (data.slots[i].key === slotKey) return data.slots[i].options;
    }
    return [];
  }

  function optionOf(data, slotKey, value) {
    var options = slotOptions(data, slotKey);
    for (var i = 0; i < options.length; i += 1) {
      if (options[i].value === value) return options[i];
    }
    return null;
  }

  function isDemoOnly(data, slotKey, value) {
    var option = optionOf(data, slotKey, value);
    return !!(option && option.demoOnly);
  }

  function worstDimension(dimensions) {
    var picked = dimensions[0] || null;
    for (var i = 0; i < STATE_SEVERITY.length; i += 1) {
      for (var j = 0; j < dimensions.length; j += 1) {
        if (dimensions[j].state === STATE_SEVERITY[i]) return dimensions[j];
      }
    }
    return picked;
  }

  function dimensionLabel(state) {
    var api = root.LODESTAR_MATCH;
    return (api && api.DIMENSION_STATE_LABELS && api.DIMENSION_STATE_LABELS[state]) || state;
  }

  /** 一句话讲清"为什么是这个结论"：点名最差的那一维，给出两边的写法 */
  function reasonOf(combo) {
    var worst = worstDimension(combo.dimensions || []);
    if (!worst) return CONCLUSION_HINTS[combo.conclusion.code] || '';
    var allExact = (combo.dimensions || []).every(function (dimension) {
      return dimension.state === 'exact';
    });
    if (allExact) return '三个词在证据里都找到了同一写法，每一维都完全对上。';
    var both =
      '你写的是「' +
      worst.value +
      '」' +
      (worst.evidenceValue ? '，证据里写的是「' + worst.evidenceValue + '」' : '，证据里没有可比的原文值');
    var tail;
    if (worst.state === 'exact') tail = '这一维完全对上。';
    else if (worst.state === 'caliber') tail = '这一维只是说法不同，算「口径相容」，不能算对上。';
    else if (worst.state === 'edge') tail = '这一维没有矛盾，但这不能证明。';
    else if (worst.state === 'conflict') tail = '这一维是「冲突候选」——冲突只作候选，不压成反对。';
    else if (worst.state === 'mismatch') tail = '这一维没对上。';
    else tail = '这一维解析不出可比的说法，判不了。';
    return '「' + worst.label + '」这一维：' + both + '。' + tail;
  }

  /**
   * 组合 → 页面视图。查不到组合、记录缺失、组合没覆盖，一律按「没覆盖」处理：
   * 不继承旧证据，也不显示成被拒收。
   */
  function resolve(data, demoData, values) {
    var combo = findCombo(data, values);
    if (!combo || combo.status !== 'covered' || !combo.recordId) {
      return {
        status: 'uncovered',
        label: CONCLUSION_LABELS.uncovered,
        hint: CONCLUSION_HINTS.uncovered,
        reason: uncoveredReason(combo, values),
        combo: combo,
        dimensions: combo ? combo.dimensions : [],
        view: null,
        record: null
      };
    }
    var records = recordIndex(demoData);
    var record = records[combo.recordId];
    if (!record) {
      return {
        status: 'uncovered',
        label: CONCLUSION_LABELS.uncovered,
        hint: CONCLUSION_HINTS.uncovered,
        reason: '组合指向的记录不在当前演示数据里，按「没覆盖」处理。',
        combo: combo,
        dimensions: combo.dimensions,
        view: null,
        record: null
      };
    }
    var api = root.LODESTAR_MATCH;
    var code = combo.conclusion.code;
    return {
      status: code,
      label: CONCLUSION_LABELS[code] || code,
      hint: combo.conclusion.hint || CONCLUSION_HINTS[code] || '',
      reason: reasonOf(combo),
      combo: combo,
      dimensions: combo.dimensions,
      view: api ? api.buildView(record) : null,
      record: record
    };
  }

  function uncoveredReason(combo, values) {
    if (!combo) return '这四个词拼出来的组合不在冻结矩阵里，按「没覆盖」处理。';
    var dims = combo.dimensions || [];
    var best = dims
      .filter(function (dimension) {
        return dimension.state === 'exact' || dimension.state === 'caliber' || dimension.state === 'edge';
      })
      .map(function (dimension) {
        return dimension.label + '（' + dimension.state + '）';
      });
    var head =
      '没有一条冻结记录同时在两个词上对上或相容。最接近的那条记录只有 ' + best.length + ' 维沾边';
    return head + (best.length > 0 ? '：' + best.join('、') : '') + '。';
  }

  /**
   * 换掉某个词之后会走到哪种结论（候选按钮上的小标）。
   * 第二个参数是演示数据，留着只为和 resolve 的调用形状一致；结论只看冻结矩阵。
   */
  function substitutionStatus(data, demoData, values, slotKey, value) {
    var next = {
      auctionHouse: values.auctionHouse,
      dateText: values.dateText,
      sessionName: values.sessionName
    };
    next[slotKey] = value;
    var combo = findCombo(data, next);
    return combo ? combo.conclusion.code : 'uncovered';
  }

  /**
   * 换掉某个词之后，**这一维**与证据比成了什么样。
   * 候选小标要回答的是"这个词本身是哪种判据"，不是整句的结论——整句结论另外写在判定卡上。
   * 换过去的组合即使整体「没覆盖」，矩阵里也留着与最接近那条记录的逐维结果，
   * 这一维照实显示；`conclusion` 让页面在提示里补一句整句会判成什么。
   */
  function substitutionDimension(data, demoData, values, slotKey, value) {
    var next = {
      auctionHouse: values.auctionHouse,
      dateText: values.dateText,
      sessionName: values.sessionName
    };
    next[slotKey] = value;
    var combo = findCombo(data, next);
    if (!combo) {
      return { state: 'uncovered', conclusion: 'uncovered', label: CONCLUSION_LABELS.uncovered };
    }
    var code = combo.conclusion.code;
    var dimensions = combo.dimensions || [];
    for (var i = 0; i < dimensions.length; i += 1) {
      if (dimensions[i].slot === slotKey) {
        return {
          state: dimensions[i].state,
          conclusion: code,
          label: dimensionLabel(dimensions[i].state)
        };
      }
    }
    return { state: 'uncovered', conclusion: code, label: CONCLUSION_LABELS.uncovered };
  }

  function coverage(data) {
    return data.stats;
  }

  /** 每种结论挑一条出来的跳转入口：直接演示"八种结局各一次" */
  function representatives(data) {
    var order = ['strong', 'weak', 'caliber', 'edge', 'conflict', 'mismatch', 'unknown', 'uncovered'];
    var picked = [];
    order.forEach(function (code) {
      for (var i = 0; i < data.combos.length; i += 1) {
        if (data.combos[i].conclusion.code === code) {
          picked.push(data.combos[i]);
          return;
        }
      }
    });
    return picked;
  }

  /** 离当前组合最近的、结论不同的几条组合：给"没覆盖"那条路做下一步 */
  function nearbyCovered(data, values, limit) {
    var current = findCombo(data, values);
    var currentCode = current ? current.conclusion.code : 'uncovered';
    var candidates = [];
    (data.combos || []).forEach(function (combo) {
      if (combo.status !== 'covered') return;
      if (combo.conclusion.code === currentCode) return;
      var diff = 0;
      SLOT_KEYS.forEach(function (key) {
        if (combo.values[key] !== values[key]) diff += 1;
      });
      candidates.push({ combo: combo, diff: diff });
    });
    candidates.sort(function (a, b) {
      return a.diff - b.diff;
    });
    var result = [];
    var seen = {};
    candidates.forEach(function (item) {
      if (result.length >= limit) return;
      var code = item.combo.conclusion.code;
      if (seen[code]) return;
      seen[code] = true;
      result.push({
        id: item.combo.id,
        values: item.combo.values,
        status: code,
        sentence: item.combo.sentence
      });
    });
    return result;
  }

  root.LODESTAR_GAME = {
    SLOT_KEYS: SLOT_KEYS,
    CONCLUSION_LABELS: CONCLUSION_LABELS,
    CONCLUSION_SHORT: CONCLUSION_SHORT,
    CONCLUSION_HINTS: CONCLUSION_HINTS,
    DEMO_ONLY_LEGEND: DEMO_ONLY_LEGEND,
    comboKey: comboKey,
    findCombo: findCombo,
    slotOptions: slotOptions,
    optionOf: optionOf,
    isDemoOnly: isDemoOnly,
    dimensionLabel: dimensionLabel,
    worstDimension: worstDimension,
    reasonOf: reasonOf,
    resolve: resolve,
    substitutionStatus: substitutionStatus,
    substitutionDimension: substitutionDimension,
    coverage: coverage,
    representatives: representatives,
    nearbyCovered: nearbyCovered,
    recordIndex: recordIndex
  };
})(typeof window !== 'undefined' ? window : globalThis);
