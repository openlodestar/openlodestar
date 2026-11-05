/* docs/assets/demo-game-match.js
 *
 * 小游戏的查表与玩法规则：页面与测试共用同一份实现。
 *
 * 组合矩阵由 `src/demo-page/build-demo-game.ts` 在构建时算好并冻结，
 * 这里只做四件事：
 * 1. 按三个槽位的取值查组合（查不到就退回「没覆盖」，不猜、不继承旧证据）；
 * 2. 把组合里的逐维状态与结论整理成页面能直接渲染的视图；
 * 3. 玩法：一组能不能收进图鉴、值多少分、总分与通关、三章任务进度；
 * 4. 给下一步往哪试探的可读提示。
 *
 * 计分只有一条规则：**每种结论只在第一次收进图鉴时给分**。
 * 于是同一组重复收是 0 分、换个组合收同一个结论也是 0 分，
 * 分数条能填满就等于八种结论都亲眼看过一遍——刷同一组不会多一分。
 *
 * 结论取三个槽位里最差的那一维，所以「有一维只到口径相容」不会被组合级的强坐标盖掉。
 */
(function (root) {
  'use strict';

  var SLOT_KEYS = ['auctionHouse', 'dateText', 'sessionName'];

  /** 存档键：只存"收过哪几组"，分数与逐维判据每次都由冻结矩阵重算，不落盘 */
  var STORAGE_KEY = 'lodestar.demo-lab.progress.v1';

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
    if (allExact) {
      if (combo.conclusion.code === 'weak') {
        return '三个词在证据里都找到了同一写法，但撑起这条记录的独立来源不够，所以只到弱坐标。';
      }
      return '三个词在证据里都找到了同一写法，每一维都完全对上，而且撑起这条记录的独立来源够。';
    }
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
    if (!combo) return '这三个词拼出来的组合不在冻结矩阵里，按「没覆盖」处理。';
    var dims = combo.dimensions || [];
    var best = dims
      .filter(function (dimension) {
        return dimension.state === 'exact' || dimension.state === 'caliber' || dimension.state === 'edge';
      })
      .map(function (dimension) {
        return dimension.label + '（' + dimensionLabel(dimension.state) + '）';
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

  // ---- 玩法：收录、计分、任务、下一步 ----

  function comboById(data, id) {
    if (!id) return null;
    for (var i = 0; i < data.combos.length; i += 1) {
      if (data.combos[i].id === id) return data.combos[i];
    }
    return null;
  }

  function emptyProgress() {
    return { version: 1, submissions: [] };
  }

  /**
   * 读回存档。只认两件事：组合号还在冻结矩阵里、同一结论只留第一次。
   * 分数、结论、逐维判据一概不落盘——重算永远与当前矩阵一致，数据换了也不会带着旧分跑。
   */
  function progressFrom(raw, data) {
    if (!raw || raw.version !== 1 || !Array.isArray(raw.submissions)) return emptyProgress();
    var seenCombo = {};
    var seenCode = {};
    var submissions = [];
    raw.submissions.forEach(function (item) {
      var id = item && item.comboId;
      var combo = comboById(data, id);
      if (!combo || seenCombo[id]) return;
      if (seenCode[combo.conclusion.code]) return;
      seenCombo[id] = true;
      seenCode[combo.conclusion.code] = true;
      submissions.push({ comboId: id, at: typeof item.at === 'number' ? item.at : 0 });
    });
    return { version: 1, submissions: submissions };
  }

  function pointsFor(data, code) {
    return (data.scoring && data.scoring.byConclusion[code]) || 0;
  }

  function targetOf(data) {
    return (data.scoring && data.scoring.target) || 0;
  }

  /** 已收录的结论 → 收它的那一组组合号 */
  function scoredCodes(progress, data) {
    var codes = {};
    progress.submissions.forEach(function (item) {
      var combo = comboById(data, item.comboId);
      if (combo) codes[combo.conclusion.code] = item.comboId;
    });
    return codes;
  }

  function scoreOf(progress, data) {
    var codes = scoredCodes(progress, data);
    var total = 0;
    Object.keys(codes).forEach(function (code) {
      total += pointsFor(data, code);
    });
    return total;
  }

  function isCleared(progress, data) {
    return scoreOf(progress, data) >= targetOf(data);
  }

  /**
   * 这一组能不能收，值多少分。三种不收的理由分开报，页面才能说清"为什么这次是 0 分"：
   * repeated-combo（同一组收过） / conclusion-taken（这个结论收过） / unknown-combo。
   */
  function evaluateSubmission(progress, data, combo) {
    if (!combo) return { ok: false, reason: 'unknown-combo', points: 0, code: 'uncovered' };
    var code = combo.conclusion.code;
    var repeated = progress.submissions.some(function (item) {
      return item.comboId === combo.id;
    });
    if (repeated) return { ok: false, reason: 'repeated-combo', points: 0, code: code };
    var taken = progress.submissions.some(function (item) {
      var other = comboById(data, item.comboId);
      return other && other.conclusion.code === code;
    });
    if (taken) return { ok: false, reason: 'conclusion-taken', points: 0, code: code };
    return { ok: true, reason: 'new', points: pointsFor(data, code), code: code };
  }

  /** 收进图鉴：返回新的进度与是否刚好通关；不收时原样退回进度，不扣分 */
  function submit(progress, data, combo, now) {
    var check = evaluateSubmission(progress, data, combo);
    if (!check.ok) {
      return {
        ok: false,
        reason: check.reason,
        points: 0,
        code: check.code,
        progress: progress,
        cleared: isCleared(progress, data)
      };
    }
    var next = {
      version: 1,
      submissions: progress.submissions.concat([
        { comboId: combo.id, at: typeof now === 'number' ? now : Date.now() }
      ])
    };
    return {
      ok: true,
      reason: 'new',
      points: check.points,
      code: check.code,
      progress: next,
      cleared: isCleared(next, data)
    };
  }

  /** 三章任务的当前进度：每格要么已收（带组合号），要么待收 */
  function missionStatus(data, progress) {
    var codes = scoredCodes(progress, data);
    return (data.missions || []).map(function (mission) {
      var goals = mission.goals.map(function (goal) {
        return {
          code: goal.code,
          label: goal.label,
          points: goal.points,
          comboId: codes[goal.code] || null,
          scored: !!codes[goal.code]
        };
      });
      var done = goals.filter(function (goal) {
        return goal.scored;
      }).length;
      return {
        id: mission.id,
        title: mission.title,
        hint: mission.hint,
        goals: goals,
        done: done,
        complete: done === goals.length
      };
    });
  }

  /** 当前该打哪一章：第一张没打完的；全打完就是 null（已通关） */
  function currentMission(data, progress) {
    var list = missionStatus(data, progress);
    for (var i = 0; i < list.length; i += 1) {
      if (!list[i].complete) return list[i];
    }
    return null;
  }

  /**
   * 下一步往哪试探。不是把答案递过去，而是点名"卡在哪一维、这一维缺的是什么"。
   * 维度行里本来就写着证据的原文值，所以这里不重复报答案，只说该换哪一维。
   */
  function nextHint(result) {
    if (!result) return '';
    var dimensions = result.dimensions || [];
    if (dimensions.length === 0) return '';
    if (result.status === 'uncovered') {
      var positive = dimensions.filter(function (dimension) {
        return (
          dimension.state === 'exact' || dimension.state === 'caliber' || dimension.state === 'edge'
        );
      });
      if (positive.length === 0) {
        return (
          '这一步一个词都没沾边：先把「' +
          dimensions[0].label +
          '」换成证据里出现过的写法，再看另外两维。'
        );
      }
      var weakest = worstDimension(positive);
      return (
        '只有 ' +
        positive.length +
        ' 维沾边，至少要两维到「口径相容」及以上才算覆盖。下一步先动「' +
        (weakest ? weakest.label : '还没对上的一维') +
        '」，把它换成能逐字对上的写法。'
      );
    }
    var worst = worstDimension(dimensions);
    if (!worst || worst.state === 'exact') return '';
    var tails = {
      caliber: '它只是说法不同，不能算对上。想再往前走，这一维就得逐字对上。',
      edge: '它只排除了矛盾，没给正面证据。想让整句变强，得让这一维逐字对上。',
      conflict: '冲突只作候选，不压成反对。换一个不冲突的值，或者把这条留作待核线索。',
      mismatch: '证据明确写的是另一个值。这一维再换，只会换出另一个「没对上」。',
      unknown: '这一维解析不出可比的说法。换一个能解析成时间的写法，别用含糊词。'
    };
    return (
      '卡在「' +
      worst.label +
      '」这一维：' +
      (tails[worst.state] || '这一维还没有可用的判据。')
    );
  }

  root.LODESTAR_GAME = {
    SLOT_KEYS: SLOT_KEYS,
    CONCLUSION_LABELS: CONCLUSION_LABELS,
    CONCLUSION_SHORT: CONCLUSION_SHORT,
    CONCLUSION_HINTS: CONCLUSION_HINTS,
    DEMO_ONLY_LEGEND: DEMO_ONLY_LEGEND,
    STORAGE_KEY: STORAGE_KEY,
    comboKey: comboKey,
    findCombo: findCombo,
    comboById: comboById,
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
    recordIndex: recordIndex,
    emptyProgress: emptyProgress,
    progressFrom: progressFrom,
    pointsFor: pointsFor,
    targetOf: targetOf,
    scoredCodes: scoredCodes,
    scoreOf: scoreOf,
    isCleared: isCleared,
    evaluateSubmission: evaluateSubmission,
    submit: submit,
    missionStatus: missionStatus,
    currentMission: currentMission,
    nextHint: nextHint
  };
})(typeof window !== 'undefined' ? window : globalThis);
