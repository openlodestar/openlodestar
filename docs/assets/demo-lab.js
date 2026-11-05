/* docs/assets/demo-lab.js
 *
 * 小游戏页的行为层：句子里的三个词就是操作面。点一个词 → 选一个新词 → 结论、逐维判据
 * 与引文立刻出现在句子下面；觉得这一组值得记下来，再点「收进图鉴」把它计分。
 *
 * 玩法只有一条规则：**每种结论只在第一次被收进图鉴时给分**。同一组重复收是 0 分，
 * 换个组合收同一个结论也是 0 分，所以分数条填满（31 分）就等于八种结论都亲眼看过。
 * 分数、结论与逐维判据都不落盘，浏览器本地存储里只存"收过哪几组"（组合号），
 * 页面每次打开都用当前的冻结矩阵重算，数据换了也不会带着旧分跑。
 *
 * 页面不重算判定、不联网、不读本地文件；组合矩阵是构建时用引擎算好并冻结的，
 * 唯一的安全阀在 demo-game-match.js：查不到组合就显示「这批证据没覆盖」，
 * 不继承旧证据，也不显示成被拒收。
 */
(function () {
  'use strict';

  var data = window.LODESTAR_DEMO_GAME;
  var demoData = window.LODESTAR_DEMO;
  var game = window.LODESTAR_GAME;
  var api = window.LODESTAR_MATCH;
  if (!data || !demoData || !game || !api) return;

  var slotByKey = {};
  data.slots.forEach(function (slot) {
    slotByKey[slot.key] = slot;
  });

  var RELATION_LABELS = { supports: '支持', refutes: '反对', irrelevant: '不涉及' };
  var TIER_LABELS = { official: '官方', primary: '一手报道', aggregator: '聚合站', unlisted: '未列名' };
  var CAUSE_LABELS = {
    budget: '预算用完，还没查完',
    coverage: '这批候选来源没覆盖到',
    genuinely_absent: '这批来源里确实没有'
  };
  var BUCKET_LABELS = {
    strong: '强坐标',
    weak: '弱坐标',
    refuted: '被反驳',
    not_found: '查过没找到'
  };
  var INITIAL_VALUES = {
    auctionHouse: '北京保利',
    dateText: '2021年12月5日',
    sessionName: '禹贡Ⅰ—盛清御瓷新风尚'
  };

  var records = game.recordIndex(demoData);
  var sourceByUrl = {};
  demoData.cases.forEach(function (caseInfo) {
    (caseInfo.sources || []).forEach(function (source) {
      sourceByUrl[source.url] = source;
    });
  });

  var state = {
    values: cloneValues(INITIAL_VALUES),
    openSlot: null,
    lastChangedKey: null,
    progress: loadProgress(),
    confirmReset: false,
    toastTimer: null
  };

  var slotElements = Array.prototype.slice.call(document.querySelectorAll('.slot'));
  var optionsPanel = document.getElementById('slot-options');
  var optionsTitle = document.getElementById('slot-options-title');
  var optionList = document.getElementById('option-list');
  var verdictElement = document.getElementById('verdict');
  var fullPanel = document.getElementById('full-panel');
  var fullBody = document.getElementById('full-body');
  var coverageBody = document.getElementById('coverage-body');
  var coverageCounts = document.getElementById('coverage-counts');
  var scoreValue = document.getElementById('score-value');
  var scoreTarget = document.getElementById('score-target');
  var scoreCount = document.getElementById('score-count');
  var scoreFill = document.getElementById('score-fill');
  var scoreBar = document.getElementById('score-bar');
  var scoreTableBody = document.getElementById('score-table-body');
  var missionList = document.getElementById('mission-list');
  var missionCurrent = document.getElementById('mission-current');
  var toastElement = document.getElementById('toast');
  var reviewSection = document.getElementById('review');
  var reviewBody = document.getElementById('review-body');
  var reviewCount = document.getElementById('review-count');

  function cloneValues(values) {
    return {
      auctionHouse: values.auctionHouse,
      dateText: values.dateText,
      sessionName: values.sessionName
    };
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function slotLabel(key) {
    return slotByKey[key] ? slotByKey[key].label : key;
  }

  function formatTime(value) {
    if (!value) return '时间未记录';
    var parsed = new Date(value);
    if (isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleString('zh-CN', { hour12: false });
  }

  function isChanged() {
    return Object.keys(INITIAL_VALUES).some(function (key) {
      return state.values[key] !== INITIAL_VALUES[key];
    });
  }

  function demoTag() {
    return '<span class="demo-tag" title="演示用词：不在采集回来的页面里">演示用词</span>';
  }

  // ---- 存档：只存组合号，分数与判据每次重算 ----

  function loadProgress() {
    try {
      var raw = window.localStorage.getItem(game.STORAGE_KEY);
      if (!raw) return game.emptyProgress();
      return game.progressFrom(JSON.parse(raw), data);
    } catch (error) {
      return game.emptyProgress();
    }
  }

  function saveProgress() {
    try {
      window.localStorage.setItem(game.STORAGE_KEY, JSON.stringify(state.progress));
    } catch (error) {
      // 隐私模式或配额满：只影响"刷新后还记得"，不影响这一局的计分
    }
  }

  function showToast(text) {
    if (!text) return;
    toastElement.textContent = text;
    toastElement.classList.add('is-visible');
    if (state.toastTimer) window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(function () {
      toastElement.classList.remove('is-visible');
    }, 4200);
  }

  function clearProgress() {
    state.progress = game.emptyProgress();
    state.confirmReset = false;
    try {
      window.localStorage.removeItem(game.STORAGE_KEY);
    } catch (error) {
      // 同上：清不掉也只是刷新后回来
    }
    renderHud();
    renderVerdict();
    renderReview();
    showToast('存档已清空：分数归零，图鉴重新开始。');
  }

  /** 这一组现在值多少分、能不能收——判定卡与按钮都读它 */
  function submissionOf(values) {
    var combo = game.findCombo(data, values);
    var check = game.evaluateSubmission(state.progress, data, combo);
    return { combo: combo, check: check };
  }

  function submitCurrent() {
    var combo = game.findCombo(data, state.values);
    var result = game.submit(state.progress, data, combo);
    if (!result.ok) {
      showToast(rejectionText(result));
      return;
    }
    state.progress = result.progress;
    saveProgress();
    renderHud();
    renderVerdict();
    renderReview();
    if (result.cleared) {
      showToast('+' + result.points + '：' + game.CONCLUSION_LABELS[result.code] + ' 已收入。八档收齐，通关了。');
      reviewSection.open = true;
    } else {
      showToast('+' + result.points + '：' + game.CONCLUSION_LABELS[result.code] + ' 已收进图鉴。');
    }
  }

  function rejectionText(result) {
    if (result.reason === 'repeated-combo') return '这一组已经收过，再收不加分。换一个词试试。';
    if (result.reason === 'conclusion-taken') {
      return (
        '「' +
        game.CONCLUSION_LABELS[result.code] +
        '」已经收过了，同一档再收不加分。去收还没见过的：' +
        missingLabels() +
        '。'
      );
    }
    return '这一组不在冻结矩阵里，收不了。';
  }

  function missingLabels() {
    var scored = game.scoredCodes(state.progress, data);
    var missing = Object.keys(game.CONCLUSION_LABELS).filter(function (code) {
      return !scored[code];
    });
    if (missing.length === 0) return '（已经全收齐了）';
    return missing
      .map(function (code) {
        return game.CONCLUSION_LABELS[code];
      })
      .join('、');
  }

  // ---- 分数条与三章任务 ----

  function renderHud() {
    var score = game.scoreOf(state.progress, data);
    var target = game.targetOf(data);
    var scored = game.scoredCodes(state.progress, data);
    var count = Object.keys(scored).length;
    var cleared = score >= target;

    scoreValue.textContent = String(score);
    scoreTarget.textContent = String(target);
    scoreCount.textContent = '已收 ' + count + ' / ' + Object.keys(game.CONCLUSION_LABELS).length;
    scoreFill.style.width = (target > 0 ? Math.min(100, (score / target) * 100) : 0) + '%';
    scoreBar.setAttribute('aria-valuenow', String(score));
    scoreBar.setAttribute('aria-valuemax', String(target));
    scoreBar.classList.toggle('is-cleared', cleared);

    var missions = game.missionStatus(data, state.progress);
    missionList.innerHTML = missions
      .map(function (mission, index) {
        var current = !mission.complete && missions.slice(0, index).every(function (before) {
          return before.complete;
        });
        var goals = mission.goals
          .map(function (goal) {
            var chip =
              '<span class="chip chip-' +
              escapeHtml(goal.code) +
              '">' +
              escapeHtml(game.CONCLUSION_SHORT[goal.code]) +
              '</span>';
            var points = '<span class="goal-points">+' + goal.points + '</span>';
            if (goal.scored) {
              return (
                '<button type="button" class="goal is-scored" data-combo="' +
                escapeHtml(goal.comboId) +
                '" title="点一下回到收下它的那一组">' +
                chip +
                points +
                '<span class="goal-check">已收</span></button>'
              );
            }
            return (
              '<span class="goal' +
              (current ? ' is-target' : '') +
              '">' +
              chip +
              points +
              '</span>'
            );
          })
          .join('');
        return (
          '<li class="mission' +
          (current ? ' is-current' : '') +
          (mission.complete ? ' is-complete' : '') +
          '"><p class="mission-title">' +
          escapeHtml(mission.title) +
          '<span class="mission-done">' +
          mission.done +
          '/' +
          mission.goals.length +
          '</span></p><div class="mission-goals">' +
          goals +
          '</div></li>'
        );
      })
      .join('');

    var currentMission = game.currentMission(data, state.progress);
    if (cleared) {
      missionCurrent.innerHTML =
        '<strong>通关了。</strong>八种结论各收了一次，共 ' +
        score +
        ' 分。下面「复盘」里能逐组看回自己走过的高分组合与每一维的判据。';
    } else if (currentMission) {
      missionCurrent.innerHTML =
        '<strong>' + escapeHtml(currentMission.title) + '</strong>' + escapeHtml(currentMission.hint);
    } else {
      missionCurrent.textContent = '';
    }

    scoreTableBody.innerHTML = renderScoreTable();
  }

  function renderScoreTable() {
    var scoring = data.scoring;
    var order = ['strong', 'weak', 'caliber', 'edge', 'conflict', 'mismatch', 'unknown', 'uncovered'];
    var rows = order
      .map(function (code) {
        return (
          '<tr><td><span class="chip chip-' +
          escapeHtml(code) +
          '">' +
          escapeHtml(game.CONCLUSION_SHORT[code]) +
          '</span></td><td class="points">+' +
          scoring.byConclusion[code] +
          '</td><td>' +
          escapeHtml(scoring.reasons[code]) +
          '</td></tr>'
        );
      })
      .join('');
    return (
      '<table class="score-table"><thead><tr><th>结论</th><th>分</th><th>为什么是这个分</th></tr></thead><tbody>' +
      rows +
      '</tbody><tfoot><tr><td>通关线</td><td class="points">' +
      scoring.target +
      '</td><td>' +
      escapeHtml(scoring.note) +
      '</td></tr></tfoot></table>'
    );
  }

  // ---- 复盘 ----

  function renderReview() {
    var submissions = state.progress.submissions;
    reviewSection.hidden = submissions.length === 0;
    reviewCount.textContent = submissions.length + ' 组 · ' + game.scoreOf(state.progress, data) + ' 分';
    if (submissions.length === 0) {
      reviewBody.innerHTML = '';
      return;
    }
    var rows = submissions
      .map(function (item, index) {
        var combo = game.comboById(data, item.comboId);
        if (!combo) return '';
        var result = game.resolve(data, demoData, combo.values);
        var dims = (combo.dimensions || [])
          .map(function (dimension) {
            return (
              '<span class="dim dim-' +
              escapeHtml(dimension.state) +
              '">' +
              escapeHtml(dimension.label) +
              ' · ' +
              escapeHtml(game.dimensionLabel(dimension.state)) +
              '</span>'
            );
          })
          .join('');
        return (
          '<button type="button" class="review-row" data-combo="' +
          escapeHtml(combo.id) +
          '" title="点一下回到这一组">' +
          '<span class="review-index">' +
          (index + 1) +
          '</span>' +
          '<span class="chip chip-' +
          escapeHtml(combo.conclusion.code) +
          '">' +
          escapeHtml(game.CONCLUSION_SHORT[combo.conclusion.code]) +
          '</span>' +
          '<span class="review-points">+' +
          game.pointsFor(data, combo.conclusion.code) +
          '</span>' +
          '<span class="review-sentence">' +
          escapeHtml(combo.sentence) +
          '</span>' +
          '<span class="review-dims">' +
          dims +
          '</span>' +
          '<span class="review-reason">' +
          escapeHtml(result.reason || '') +
          '</span></button>'
        );
      })
      .join('');
    reviewBody.innerHTML = rows;
  }

  // ---- 句子与选项 ----

  function updateSentence() {
    slotElements.forEach(function (element) {
      var key = element.getAttribute('data-slot');
      element.textContent = state.values[key];
      element.setAttribute(
        'aria-label',
        slotLabel(key) + '，当前是「' + state.values[key] + '」，按回车或空格打开可换的词'
      );
      if (game.isDemoOnly(data, key, state.values[key])) element.classList.add('is-demo');
      else element.classList.remove('is-demo');
    });
  }

  function updateExpandedState() {
    slotElements.forEach(function (element) {
      var open = state.openSlot === element.getAttribute('data-slot');
      element.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) element.classList.add('is-open');
      else element.classList.remove('is-open');
    });
  }

  function renderOptions(focusValue) {
    var slot = slotByKey[state.openSlot];
    if (!slot) return;
    optionsPanel.hidden = false;
    optionsTitle.textContent = '换「' + slot.label + '」';
    var result = game.resolve(data, demoData, state.values);
    var parts = [];
    slot.options.forEach(function (option) {
      var current = state.values[slot.key] === option.value;
      // 小标说的是"这个词这一维的判据"，不是整句结论——整句结论另写在判定卡上
      var dimension = current
        ? dimensionOfResult(result, slot.key)
        : game.substitutionDimension(data, demoData, state.values, slot.key, option.value);
      var shortLabel = dimension.label;
      var conclusionLabel = game.CONCLUSION_LABELS[dimension.conclusion] || dimension.conclusion;
      parts.push(
        '<button type="button" class="option' +
          (current ? ' is-current' : '') +
          (option.demoOnly ? ' is-demo-option' : '') +
          '" data-value="' +
          escapeHtml(option.value) +
          '" title="' +
          escapeHtml(option.note + '｜换过去整句会判成「' + conclusionLabel + '」') +
          '" aria-pressed="' +
          (current ? 'true' : 'false') +
          '">' +
          escapeHtml(option.value) +
          (option.demoOnly ? demoTag() : '') +
          '<span class="chip chip-' +
          escapeHtml(dimension.state) +
          '">' +
          escapeHtml(shortLabel) +
          '</span></button>'
      );
    });
    if (slot.options.some(function (option) { return option.demoOnly; })) {
      parts.push('<p class="options-legend">' + escapeHtml(game.DEMO_ONLY_LEGEND) + '</p>');
    }
    optionList.innerHTML = parts.join('');
    updateExpandedState();
    if (focusValue) focusOptionByValue(focusValue);
  }

  /**
   * 当前这句话里，某个槽位和证据比成了什么样。
   * 当前组合没覆盖时矩阵里也留着"最接近那条记录"的逐维结果，照样可以显示这一维；
   * 连逐维结果都没有，才退回「没覆盖」。
   */
  function dimensionOfResult(result, slotKey) {
    var dimensions = result.dimensions || [];
    for (var i = 0; i < dimensions.length; i += 1) {
      if (dimensions[i].slot !== slotKey) continue;
      return {
        state: dimensions[i].state,
        conclusion: result.status,
        label: game.dimensionLabel(dimensions[i].state)
      };
    }
    return {
      state: 'uncovered',
      conclusion: result.status,
      label: game.CONCLUSION_LABELS.uncovered
    };
  }

  /** 把焦点放到某个可选词上（键盘打开面板、选完词之后都要用） */
  function focusOptionByValue(value) {
    var buttons = optionList.querySelectorAll('.option');
    for (var i = 0; i < buttons.length; i += 1) {
      if (buttons[i].getAttribute('data-value') === value) {
        buttons[i].focus({ preventScroll: true });
        return;
      }
    }
  }

  function anchorElement() {
    if (!state.openSlot) return null;
    for (var i = 0; i < slotElements.length; i += 1) {
      if (slotElements[i].getAttribute('data-slot') === state.openSlot) return slotElements[i];
    }
    return null;
  }

  /**
   * 把浮层贴在刚点的那个词上。次序是：先放词的上方（句尾的词天然不会冒出屏幕），
   * 上方不够就往页面里借一点滚动余量；仍不够就翻到下方；两头都放不下才夹在视口内。
   * 横向一律夹进视口。浮层是固定定位、不在文档流里，判定卡不会被推走。
   */
  function placeOptions(allowScroll) {
    var anchor = anchorElement();
    if (!anchor || optionsPanel.hidden) return;
    var margin = 8;
    var gap = 8;
    var anchorRect = anchor.getBoundingClientRect();
    var panelRect = optionsPanel.getBoundingClientRect();

    function measure() {
      anchorRect = anchor.getBoundingClientRect();
      panelRect = optionsPanel.getBoundingClientRect();
    }

    var top = anchorRect.top - panelRect.height - gap;
    if (top < margin && allowScroll && window.scrollY > 0) {
      var deficit = Math.min(margin - top, window.scrollY);
      window.scrollBy(0, -deficit);
      measure();
      top = anchorRect.top - panelRect.height - gap;
    }
    if (top < margin) {
      var below = anchorRect.bottom + gap;
      if (below + panelRect.height <= window.innerHeight - margin) {
        top = below;
      } else {
        var maxTop = window.innerHeight - panelRect.height - margin;
        if (maxTop < margin) maxTop = margin;
        if (top > maxTop) top = maxTop;
        if (top < margin) top = margin;
      }
    }

    var left = anchorRect.left;
    var maxLeft = window.innerWidth - panelRect.width - margin;
    if (maxLeft < margin) maxLeft = margin;
    if (left > maxLeft) left = maxLeft;
    if (left < margin) left = margin;

    optionsPanel.style.left = Math.round(left) + 'px';
    optionsPanel.style.top = Math.round(top) + 'px';
  }

  function openOptions(key, focusInto) {
    state.openSlot = key;
    renderOptions(focusInto ? state.values[key] : null);
    placeOptions(true);
  }

  function closeOptions(returnFocus) {
    if (!state.openSlot) return;
    var previousKey = state.openSlot;
    state.openSlot = null;
    optionsPanel.hidden = true;
    optionsPanel.style.left = '';
    optionsPanel.style.top = '';
    optionList.innerHTML = '';
    updateExpandedState();
    if (returnFocus) {
      slotElements.some(function (element) {
        if (element.getAttribute('data-slot') !== previousKey) return false;
        element.focus({ preventScroll: true });
        return true;
      });
    }
  }

  function toggleOptions(key, focusInto) {
    if (state.openSlot === key) closeOptions(true);
    else openOptions(key, focusInto);
  }

  function setValues(next, changedKey) {
    state.values = cloneValues(next);
    state.lastChangedKey = changedKey || null;
    updateSentence();
    renderVerdict();
  }

  function selectOption(key, value) {
    if (!slotByKey[key]) return;
    if (!game.optionOf(data, key, value)) return;
    if (state.values[key] === value) return;
    var next = cloneValues(state.values);
    next[key] = value;
    setValues(next, key);
    if (state.openSlot === key) {
      renderOptions(value);
      placeOptions(false);
    }
  }

  function resetToInitial() {
    closeOptions(false);
    state.lastChangedKey = null;
    state.values = cloneValues(INITIAL_VALUES);
    updateSentence();
    renderVerdict();
  }

  function applyCombo(comboId) {
    var combo = null;
    for (var i = 0; i < data.combos.length; i += 1) {
      if (data.combos[i].id === comboId) {
        combo = data.combos[i];
        break;
      }
    }
    if (!combo) return;
    closeOptions(false);
    var changedKey = null;
    Object.keys(INITIAL_VALUES).some(function (key) {
      if (state.values[key] !== combo.values[key]) {
        changedKey = key;
        return true;
      }
      return false;
    });
    setValues(combo.values, changedKey);
  }

  // ---- 结论 ----

  function renderVerdict() {
    var result = game.resolve(data, demoData, state.values);
    verdictElement.className = 'verdict verdict-' + result.status;
    verdictElement.innerHTML = renderCovered(result);
    if (result.status === 'uncovered') {
      fullPanel.hidden = true;
      fullBody.innerHTML = '';
      return;
    }
    fullPanel.hidden = false;
    fullBody.innerHTML = renderFull(result);
  }

  function statusHead(result) {
    var parts = [];
    parts.push('<div class="verdict-head">');
    parts.push(
      '<span class="badge badge-' +
        escapeHtml(result.status) +
        '">' +
        escapeHtml(result.label) +
        '</span>'
    );
    if (isChanged()) {
      parts.push('<button type="button" class="link-button" data-action="reset">回到原句</button>');
    }
    parts.push('</div>');
    return parts.join('');
  }

  /**
   * 计分口：这一组值多少分、为什么值这个分、能不能收。
   * 三种"0 分"的理由必须分开写——玩家看到 0 分时要知道是重复了、这档收过了，还是已通关。
   */
  function renderClaim(result) {
    var submission = submissionOf(state.values);
    var check = submission.check;
    var code = result.status;
    var points = game.pointsFor(data, code);
    var label;
    var note;
    var disabled = false;
    if (game.isCleared(state.progress, data)) {
      label = '已通关 · 不再计分';
      note = '八种结论各收了一次，共 ' + game.targetOf(data) + ' 分。剩下的时间用来复盘。';
      disabled = true;
    } else if (check.ok) {
      label = '收进图鉴 +' + points;
      note =
        '这一组值 +' +
        points +
        '：它是「' +
        game.CONCLUSION_LABELS[code] +
        '」，这一档还没收过。收下后，同一档的别的组合就都是 0 分了。';
    } else if (check.reason === 'repeated-combo') {
      label = '这组已收 · 0 分';
      note = '这一组值 0：同一组重复收不给分。换掉一个词，去看另一组。';
      disabled = true;
    } else {
      label = '这一档已收 · 0 分';
      note =
        '这一组值 0：「' +
        game.CONCLUSION_LABELS[code] +
        '」已经收过，换个组合收同一档也不加分。还缺：' +
        missingLabels() +
        '。';
      disabled = true;
    }
    return (
      '<div class="claim">' +
      '<button type="button" class="claim-button" data-action="submit"' +
      (disabled ? ' disabled' : '') +
      '>' +
      escapeHtml(label) +
      '</button>' +
      '<span class="claim-note">' +
      escapeHtml(note) +
      '</span></div>'
    );
  }

  function renderCovered(result) {
    var parts = [];
    parts.push(statusHead(result));
    parts.push('<p class="verdict-reason">' + escapeHtml(result.reason) + '</p>');
    parts.push('<p class="verdict-note">' + escapeHtml(result.hint) + '</p>');
    parts.push(renderClaim(result));
    var hint = game.nextHint(result);
    if (hint) {
      parts.push('<p class="verdict-next"><strong>下一步：</strong>' + escapeHtml(hint) + '</p>');
    }
    if (result.status === 'uncovered') {
      parts.push(renderUncoveredDimensions(result));
      return parts.join('');
    }
    parts.push(renderDimensions(result));
    parts.push(renderRecordContext(result));

    if (result.view && result.view.conflictCandidates.length > 0) {
      parts.push(
        '<p class="verdict-note">冲突只作候选：' +
          escapeHtml(
            result.view.conflictCandidates
              .map(function (item) {
                return item.label;
              })
              .join('、')
          ) +
          ' 的判据是「冲突候选」，页面不会把它压成「反对」。</p>'
      );
    }

    if (result.view) {
      var entries = decisiveEntries(result.view, result.status, state.lastChangedKey);
      if (entries.length > 0) {
        parts.push('<div class="decisive">');
        entries.forEach(function (entry) {
          parts.push(renderEvidenceInline(entry));
        });
        parts.push('</div>');
      }
    }
    return parts.join('');
  }

  /** 逐维判据：三个词各自与证据里的原文值比成了什么样，一眼看清 */
  function renderDimensions(result, title) {
    if (!result.dimensions || result.dimensions.length === 0) return '';
    var parts = [];
    parts.push('<div class="dim-layer">');
    parts.push('<p class="dim-title">' + escapeHtml(title || '每一维的判据') + '</p>');
    result.dimensions.forEach(function (dimension) {
      parts.push('<div class="dim-row">');
      parts.push('<span class="dim-slot">' + escapeHtml(dimension.label) + '</span>');
      parts.push('<span class="dim-value">' + escapeHtml(dimension.value) + '</span>');
      if (dimension.demoOnly) parts.push(demoTag());
      parts.push(
        '<span class="dim-evidence">' +
          (dimension.evidenceValue
            ? '证据里写的是 <code>' + escapeHtml(dimension.evidenceValue) + '</code>'
            : '证据里没有可比的原文值') +
          '</span>'
      );
      parts.push(
        '<span class="dim dim-' +
          escapeHtml(dimension.state) +
          '">' +
          escapeHtml(game.dimensionLabel(dimension.state)) +
          '</span>'
      );
      parts.push('<span class="dim-note">' + escapeHtml(dimension.note) + '</span>');
      parts.push('</div>');
    });
    parts.push('</div>');
    return parts.join('');
  }

  /**
   * 没覆盖时也把逐维摆出来——那是"离这句话最近的那条记录"的比对结果。
   * 必须说明它不是结论：三词里最多只有一维沾边，才判成没覆盖。
   */
  function renderUncoveredDimensions(result) {
    if (!result.dimensions || result.dimensions.length === 0) return '';
    var positive = result.dimensions.filter(function (dimension) {
      return (
        dimension.state === 'exact' ||
        dimension.state === 'caliber' ||
        dimension.state === 'edge'
      );
    }).length;
    var parts = [];
    parts.push(
      renderDimensions(result, '离它最近的那条冻结记录，逐维是这样比的')
    );
    parts.push(
      '<p class="verdict-note">这段不是结论：三个词里只有 ' +
        positive +
        ' 维沾边，至少要两维达到「口径相容」及以上才算覆盖。没覆盖既不是被反驳，也不是世界上不存在。</p>'
    );
    return parts.join('');
  }

  function renderRecordContext(result) {
    if (!result.combo || !result.record) return '';
    var combo = result.combo;
    return (
      '<p class="verdict-note">对照记录：<strong>' +
      escapeHtml(combo.recordTitle || result.record.recordId) +
      '</strong>（批次 <code>examples/' +
      escapeHtml(combo.caseId || '') +
      '/</code>）。它的门禁是「' +
      escapeHtml(BUCKET_LABELS[combo.bucket] || combo.bucket || '') +
      '」——这是这条冻结记录本身的结论，与你换掉的词无关。</p>'
    );
  }

  /** 「举办时间 → 2021年11月15日」这样的差异描述，只说变了的那几个槽 */
  function describeDiff(nextValues) {
    var changes = [];
    game.SLOT_KEYS.forEach(function (key) {
      if (state.values[key] !== nextValues[key]) {
        changes.push(slotLabel(key) + ' → ' + nextValues[key]);
      }
    });
    return (changes.length > 1 ? '改 ' + changes.length + ' 个词：' : '只改一个词：') + changes.join('，');
  }

  /**
   * 结论卡上先摆哪几条证据：
   * 被反驳就摆反驳的；换过某个词就先摆那个字段的；否则每个关键字段各摆一条。
   * 最多三条，全量证据在「完整拆解」里。
   */
  function decisiveEntries(view, status, lastKey) {
    var all = [];
    view.fields.forEach(function (field) {
      (field.evidence || []).forEach(function (row) {
        all.push({ field: field, row: row });
      });
    });
    var picked = [];
    function push(entry) {
      if (!entry || picked.length >= 3) return;
      var duplicated = picked.some(function (item) {
        return item.row.evidenceId === entry.row.evidenceId;
      });
      if (!duplicated) picked.push(entry);
    }

    if (status === 'refuted' || status === 'conflict') {
      all.forEach(function (entry) {
        if (entry.row.relation === 'refutes') push(entry);
      });
    }
    if (picked.length === 0 && lastKey) {
      all.forEach(function (entry) {
        if (entry.field.key === lastKey && entry.row.relation === 'supports') push(entry);
      });
    }
    if (picked.length === 0) {
      view.fields.forEach(function (field) {
        if (field.role !== 'key') return;
        all.forEach(function (entry) {
          if (entry.field.key === field.key && entry.row.relation === 'supports') push(entry);
        });
      });
    }
    if (picked.length === 0) {
      all.forEach(function (entry) {
        if (entry.row.relation === 'supports') push(entry);
      });
    }
    return picked;
  }

  function renderEvidenceInline(entry) {
    var row = entry.row;
    var field = entry.field;
    var source = sourceByUrl[row.url] || null;
    var publisher = source ? source.publisher : row.domain;
    var parts = [];
    parts.push('<article class="ev">');
    parts.push('<div class="ev-meta">');
    parts.push('<span class="field-tag">' + escapeHtml(field.label) + '</span>');
    parts.push(
      '<span class="relation relation-' +
        escapeHtml(row.relation) +
        '">' +
        escapeHtml(RELATION_LABELS[row.relation] || row.relation) +
        '</span>'
    );
    parts.push('<span>' + escapeHtml(publisher) + '</span>');
    parts.push('<span>' + escapeHtml(TIER_LABELS[row.tier] || row.tier) + '</span>');
    parts.push('<span>抓取于 ' + escapeHtml(formatTime(row.fetchedAt)) + '</span>');
    parts.push('</div>');
    parts.push('<blockquote>' + escapeHtml(row.quote) + '</blockquote>');
    parts.push(renderEvidenceDimension(row, field));
    parts.push(
      '<p class="ev-link"><a href="' + escapeHtml(row.url) + '">' + escapeHtml(row.url) + '</a></p>'
    );
    parts.push('</article>');
    return parts.join('');
  }

  function renderEvidenceDimension(row, field) {
    var parts = [];
    parts.push('<p class="evidence-dim">');
    parts.push('<span class="dim-tag">维度 · ' + escapeHtml(field.label) + '</span>');
    parts.push(
      '<span class="dim dim-' +
        escapeHtml(row.state) +
        '">' +
        escapeHtml(game.dimensionLabel(row.state)) +
        '</span>'
    );
    parts.push(
      '<span class="matched">原文值：' +
        (row.matchedValue
          ? '<code>' + escapeHtml(row.matchedValue) + '</code>（已过逐字子串校验）'
          : '原文里没有明确写法') +
        '</span>'
    );
    parts.push('</p>');
    return parts.join('');
  }

  // ---- 完整拆解（默认收起，点开才展开全量证据） ----

  function renderFull(result) {
    var view = result.view;
    var combo = result.combo;
    var parts = [];
    parts.push('<h2>这句话被拆成哪几个字段</h2>');
    parts.push('<div class="fields">');
    view.fields.forEach(function (field) {
      parts.push(renderField(field));
    });
    parts.push('</div>');
    parts.push(renderCooccurrence(view));
    parts.push(renderAnchor(view));

    parts.push('<footer class="panel-foot">');
    parts.push(
      '<p>记录 <code>' +
        escapeHtml(view.recordId) +
        '</code> · 批次 <code>examples/' +
        escapeHtml(combo.caseId || '') +
        '/</code> · 组合 <code>' +
        escapeHtml(combo.id) +
        '</code></p>'
    );
    parts.push('<p>判定由引擎在构建数据时算好并冻结，页面只切换展示；引文都来自冻结批次里的页面节选。</p>');
    parts.push('</footer>');
    return parts.join('');
  }

  function renderField(field) {
    var parts = [];
    parts.push('<section class="field field-state-' + escapeHtml(field.state) + '">');
    parts.push('<div class="field-head">');
    parts.push('<span class="field-label">' + escapeHtml(field.label) + '</span>');
    if (field.role === 'key') parts.push('<span class="role">关键字段</span>');
    parts.push('<span class="field-value">' + escapeHtml(field.value) + '</span>');
    parts.push('</div>');

    if (field.state === 'uncovered') {
      parts.push('<p class="verdict-note">这批证据没覆盖：' + escapeHtml(field.reason) + '</p>');
      parts.push('</section>');
      return parts.join('');
    }

    parts.push('<div class="field-verdict">');
    parts.push(
      '<span class="verdict-tag verdict-tag-' +
        escapeHtml(field.verdict) +
        '">' +
        escapeHtml(api.verdictLabel(field.verdict)) +
        '</span>'
    );
    parts.push(
      '<span class="stat">独立支持 ' +
        field.supportCount +
        ' · 反对 ' +
        field.refuteCount +
        '</span>'
    );
    parts.push('<span class="stat">证据等级 ' + escapeHtml(field.evidenceGrade) + '</span>');
    parts.push('<span class="stat">比对过 ' + field.examinedPages + ' 页</span>');
    parts.push('</div>');

    if (field.verdict === 'not_found') {
      parts.push(
        '<p class="verdict-note">' +
          escapeHtml(
            (CAUSE_LABELS[field.notFoundCause] || '这批来源里没有其他说法') +
              '。这是「这批证据里没有」，不是「世界上不存在」。'
          ) +
          '</p>'
      );
    }

    (field.contradictorySupports || []).forEach(function (row) {
      parts.push(
        '<p class="contradiction"><strong>模型裁决与判据不一致</strong>：模型把这一页判成「支持」，' +
          '但判据层认定原文值与断言冲突' +
          (row.matchedValue ? '（原文值 <code>' + escapeHtml(row.matchedValue) + '</code>）' : '') +
          '。按「判据优先」，这一行不计入支持、也不进累计分；模型原来的裁决与原文都保留在下面，供审计回看。</p>'
      );
    });

    parts.push('<div class="evidence">');
    if (field.evidence.length === 0) {
      parts.push('<p class="empty">这个字段一条证据行都没有：这批页面查过了，但没有一处提到它。</p>');
    } else {
      field.evidence.forEach(function (row) {
        parts.push(renderEvidenceRow(row));
      });
    }
    parts.push('</div>');
    parts.push('</section>');
    return parts.join('');
  }

  function renderEvidenceRow(row) {
    var source = sourceByUrl[row.url] || null;
    var publisher = source ? source.publisher : row.domain;
    var parts = [];
    parts.push('<article class="evidence-row">');
    parts.push(
      '<div class="evidence-meta"><span class="relation relation-' +
        escapeHtml(row.relation) +
        '">' +
        escapeHtml(RELATION_LABELS[row.relation] || row.relation) +
        '</span>' +
        '<span>' +
        escapeHtml(publisher) +
        '</span>' +
        '<span>' +
        escapeHtml(TIER_LABELS[row.tier] || row.tier) +
        '</span>' +
        '<span class="stat">抓取于 ' +
        escapeHtml(formatTime(row.fetchedAt)) +
        '</span></div>'
    );
    parts.push('<blockquote>' + escapeHtml(row.quote) + '</blockquote>');
    parts.push(renderEvidenceDimension(row, { label: fieldLabelForKey(row.fieldKey) }));
    if (row.note) parts.push('<p class="verdict-note">' + escapeHtml(row.note) + '</p>');
    parts.push(
      '<p class="ev-link"><a href="' +
        escapeHtml(row.url) +
        '">' +
        escapeHtml(row.url) +
        '</a></p>'
    );
    if (source && source.excerpt) {
      parts.push(
        '<details class="sub"><summary>看这页的快照节选（' +
          escapeHtml(source.snapshotFile) +
          '）</summary><pre>' +
          escapeHtml(source.excerpt) +
          '</pre></details>'
      );
    }
    parts.push('</article>');
    return parts.join('');
  }

  function fieldLabelForKey(key) {
    var found = key;
    (demoData.fields || []).forEach(function (field) {
      if (field.key === key) found = field.label;
    });
    return found;
  }

  function renderCooccurrence(view) {
    var parts = [];
    parts.push('<h3>关键字段是否在同一页上同时出现</h3>');
    parts.push('<div class="cooccur">');
    if (view.cooccurrence.count === 0) {
      parts.push('<p>没有任何页面同时命中全部关键字段——这也是它只到弱档或拒收的原因之一。</p>');
    } else {
      parts.push('<p>命中 <strong>' + view.cooccurrence.count + '</strong> 个页面：</p>');
      parts.push('<ul>');
      view.cooccurrence.pages.forEach(function (url) {
        parts.push('<li><a href="' + escapeHtml(url) + '">' + escapeHtml(url) + '</a></li>');
      });
      parts.push('</ul>');
    }
    parts.push('</div>');
    return parts.join('');
  }

  function renderAnchor(view) {
    var parts = [];
    parts.push('<h3>最后给不给坐标</h3>');
    parts.push('<div class="anchor">');
    if (view.anchor === null) {
      parts.push('<p>不给坐标：整条记录被拒收，坐标库不收这条。</p>');
    } else if (view.anchor.grade === 'strong') {
      parts.push(
        '<p>给<strong>强坐标</strong>（' + escapeHtml(view.anchor.evidenceGrade) + '），下游默认可读。</p>'
      );
    } else {
      parts.push(
        '<p>只给<strong>弱坐标</strong>（' +
          escapeHtml(view.anchor.evidenceGrade) +
          '），默认不可读——单一独立来源撑不起一条可用坐标。</p>'
      );
    }
    if (view.anchor !== null) {
      parts.push('<p class="anchor-label">作证页面：</p><ul>');
      view.anchor.urls.forEach(function (url) {
        parts.push('<li><a href="' + escapeHtml(url) + '">' + escapeHtml(url) + '</a></li>');
      });
      parts.push('</ul>');
      if (view.anchor.searchPhrases.length > 0) {
        parts.push('<p class="anchor-label">再入检索短语：</p><ul>');
        view.anchor.searchPhrases.forEach(function (phrase) {
          parts.push('<li><code>' + escapeHtml(phrase) + '</code></li>');
        });
        parts.push('</ul>');
      }
      if (view.anchor.stale) {
        parts.push('<p class="stale">这条坐标已标为过期，不应再当结论读。</p>');
      }
    }
    parts.push('</div>');
    return parts.join('');
  }

  // ---- 覆盖读数 ----

  function renderCoverage() {
    var stats = game.coverage(data);
    var order = ['strong', 'weak', 'caliber', 'edge', 'conflict', 'mismatch', 'unknown', 'uncovered'];
    coverageBody.innerHTML =
      '<p>' +
      stats.total +
      ' 种组合里，' +
      stats.covered +
      ' 种能落到某条冻结记录上（至少两个词对上或相容），其余 ' +
      stats.uncovered +
      ' 种显示「这批证据没覆盖」。结论取三个词里最差的那一维，所以「有一维只到口径相容」不会被组合级的强坐标盖掉。</p>';

    coverageCounts.innerHTML = order
      .map(function (code) {
        return (
          '<span class="count">' +
          escapeHtml(game.CONCLUSION_LABELS[code]) +
          ' ' +
          stats.byConclusion[code] +
          '</span>'
        );
      })
      .join('');
  }

  // ---- 事件 ----

  slotElements.forEach(function (element) {
    element.addEventListener('click', function (event) {
      toggleOptions(element.getAttribute('data-slot'), event.detail === 0);
    });
    element.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
      event.preventDefault();
      var key = element.getAttribute('data-slot');
      if (state.openSlot === key) focusOptionByValue(state.values[key]);
      else openOptions(key, true);
    });
  });

  optionList.addEventListener('click', function (event) {
    var button = event.target.closest ? event.target.closest('.option') : null;
    if (!button || !state.openSlot) return;
    event.stopPropagation();
    selectOption(state.openSlot, button.getAttribute('data-value'));
  });

  optionList.addEventListener('keydown', function (event) {
    if (
      event.key !== 'ArrowRight' &&
      event.key !== 'ArrowLeft' &&
      event.key !== 'ArrowDown' &&
      event.key !== 'ArrowUp'
    ) {
      return;
    }
    var buttons = Array.prototype.slice.call(optionList.querySelectorAll('.option'));
    var index = buttons.indexOf(document.activeElement);
    if (index === -1) return;
    event.preventDefault();
    var step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : buttons.length - 1;
    buttons[(index + step) % buttons.length].focus({ preventScroll: true });
  });

  verdictElement.addEventListener('click', function (event) {
    if (!event.target.closest) return;
    var reset = event.target.closest('[data-action="reset"]');
    if (reset) {
      resetToInitial();
      return;
    }
    var submit = event.target.closest('[data-action="submit"]');
    if (submit) {
      submitCurrent();
      return;
    }
    var jump = event.target.closest('[data-combo]');
    if (jump) applyCombo(jump.getAttribute('data-combo'));
  });

  missionList.addEventListener('click', function (event) {
    var button = event.target.closest ? event.target.closest('[data-combo]') : null;
    if (!button) return;
    applyCombo(button.getAttribute('data-combo'));
    verdictElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  reviewBody.addEventListener('click', function (event) {
    var button = event.target.closest ? event.target.closest('[data-combo]') : null;
    if (!button) return;
    applyCombo(button.getAttribute('data-combo'));
    verdictElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  var resetProgressButton = document.getElementById('reset-progress');
  resetProgressButton.addEventListener('click', function () {
    if (!state.confirmReset) {
      state.confirmReset = true;
      resetProgressButton.textContent = '再点一次，确认清空';
      resetProgressButton.classList.add('is-confirming');
      window.setTimeout(function () {
        if (!state.confirmReset) return;
        state.confirmReset = false;
        resetProgressButton.textContent = '清空存档';
        resetProgressButton.classList.remove('is-confirming');
      }, 5000);
      return;
    }
    resetProgressButton.textContent = '清空存档';
    resetProgressButton.classList.remove('is-confirming');
    clearProgress();
  });

  document.querySelector('[data-action="close-options"]').addEventListener('click', function () {
    closeOptions(true);
  });

  document.addEventListener('click', function (event) {
    if (!state.openSlot) return;
    if (event.target.closest && event.target.closest('#slot-options')) return;
    if (event.target.closest && event.target.closest('.slot')) return;
    closeOptions(false);
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && state.openSlot) {
      closeOptions(true);
    }
  });

  window.addEventListener('resize', function () {
    if (state.openSlot) placeOptions(false);
  });
  window.addEventListener(
    'scroll',
    function () {
      if (state.openSlot) placeOptions(false);
    },
    { passive: true }
  );

  updateSentence();
  updateExpandedState();
  renderHud();
  renderVerdict();
  renderReview();
  renderCoverage();
})();
