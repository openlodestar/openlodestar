/* docs/assets/demo-lab.js
 *
 * 小游戏页的行为层：三个词就是操作面。点一个词 → 判定卡原地翻成选词卡 → 选一个 →
 * 选词卡收起、判定卡带着新的逐维判据回来。觉得这一组值得记下来，再点「收进图鉴」计分。
 *
 * 布局是一屏定死的：顶栏 / 进度 / 句子 / 判定卡 / 计分口各占一行，判定卡与选词卡共用一个
 * 绝对定位的区域，所以换词不会把页面撑高，长内容（任务、分数表、复盘、证据、说明）都收
 * 进底部抽屉，触发才展开。
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

  var CODE_ORDER = ['strong', 'weak', 'caliber', 'edge', 'conflict', 'mismatch', 'unknown', 'uncovered'];
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
  var PANEL_TITLES = {
    missions: '三章任务',
    score: '分数表',
    review: '复盘 · 收过的组',
    evidence: '这一组的证据',
    help: '规则与边界'
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
    toastTimer: null,
    sheet: null,
    sheetTrigger: null,
    soundOn: false
  };

  var slotElements = Array.prototype.slice.call(document.querySelectorAll('.slot'));
  var optionsPanel = document.getElementById('slot-options');
  var optionsTitle = document.getElementById('slot-options-title');
  var optionList = document.getElementById('option-list');
  var verdictElement = document.getElementById('verdict');
  var claimRow = document.getElementById('claim-row');
  var dexElement = document.getElementById('dex');
  var missionCurrent = document.getElementById('mission-current');
  var fullPanel = document.getElementById('full-panel');
  var fullBody = document.getElementById('full-body');
  var evidenceLead = document.getElementById('evidence-lead');
  var evidenceInline = document.getElementById('evidence-inline');
  var coverageBody = document.getElementById('coverage-body');
  var coverageCounts = document.getElementById('coverage-counts');
  var scoreValue = document.getElementById('score-value');
  var scoreTarget = document.getElementById('score-target');
  var scoreCount = document.getElementById('score-count');
  var scoreFill = document.getElementById('score-fill');
  var scoreBar = document.getElementById('score-bar');
  var scoreTableBody = document.getElementById('score-table-body');
  var missionList = document.getElementById('mission-list');
  var missionDetail = document.getElementById('mission-detail');
  var toastElement = document.getElementById('toast');
  var reviewBody = document.getElementById('review-body');
  var reviewCount = document.getElementById('review-count');
  var sheetElement = document.getElementById('sheet');
  var sheetTitle = document.getElementById('sheet-title');
  var sheetPanels = Array.prototype.slice.call(document.querySelectorAll('[data-sheet-panel]'));
  var sheetCloseButton = sheetElement.querySelector('.sheet-close');
  var resetProgressButton = document.getElementById('reset-progress');
  var soundToggle = document.getElementById('sound-toggle');
  var fxLayer = document.getElementById('fx');

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

  function reducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (error) {
      return false;
    }
  }

  // ---- 音效：默认关闭，只在玩家操作时响，不自动播放 ----

  var audio = { context: null };

  function playTone(frequency, duration, type) {
    if (!state.soundOn) return;
    try {
      var Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      if (!audio.context) audio.context = new Ctor();
      var context = audio.context;
      if (context.state === 'suspended') context.resume();
      var oscillator = context.createOscillator();
      var gain = context.createGain();
      oscillator.type = type || 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.1, context.currentTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + duration + 0.03);
    } catch (error) {
      // 没有音频设备或浏览器拦了音频：静音即可，不打断任何操作
    }
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
    renderVerdict(false);
    renderReview();
    renderSheetIfOpen();
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
    var wasCleared = game.isCleared(state.progress, data);
    var result = game.submit(state.progress, data, combo);
    if (!result.ok) {
      playTone(150, 0.1, 'square');
      var button = claimRow.querySelector('[data-action="submit"]');
      if (button) {
        button.classList.remove('is-nope');
        void button.offsetWidth;
        button.classList.add('is-nope');
      }
      showToast(rejectionText(result));
      return;
    }
    state.progress = result.progress;
    saveProgress();
    renderHud(result.code);
    renderVerdict(false);
    renderReview();
    renderSheetIfOpen();
    playTone(result.cleared ? 880 : 620, 0.16, 'triangle');
    showPoints('+' + result.points);
    pulseScore();
    if (result.cleared && !wasCleared) {
      celebrate();
      showToast('八档收齐，通关了：' + game.targetOf(data) + ' / ' + game.targetOf(data) + '。打开「复盘」逐组回看。');
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

  // ---- 顶部：分数、进度条、八格图鉴、当前章 ----

  function renderHud(popCode) {
    var score = game.scoreOf(state.progress, data);
    var target = game.targetOf(data);
    var scored = game.scoredCodes(state.progress, data);
    var count = Object.keys(scored).length;
    var cleared = score >= target;

    scoreValue.textContent = String(score);
    scoreTarget.textContent = String(target);
    scoreCount.textContent = '已收 ' + count + ' / ' + CODE_ORDER.length;
    scoreFill.style.width = (target > 0 ? Math.min(100, (score / target) * 100) : 0) + '%';
    scoreBar.setAttribute('aria-valuenow', String(score));
    scoreBar.setAttribute('aria-valuemax', String(target));
    scoreBar.classList.toggle('is-cleared', cleared);

    dexElement.innerHTML = CODE_ORDER.map(function (code) {
      var collected = !!scored[code];
      var label = game.CONCLUSION_SHORT[code];
      var points = '+' + game.pointsFor(data, code);
      var inner =
        '<span class="dex-name">' +
        escapeHtml(label) +
        '</span><span class="dex-points">' +
        points +
        '</span>';
      if (collected) {
        return (
          '<li><button type="button" class="dex-cell is-scored' +
          (popCode === code ? ' is-pop' : '') +
          '" data-combo="' +
          escapeHtml(scored[code]) +
          '" title="' +
          escapeHtml(label) + '：点一下回到收下它的那一组">' +
          inner +
          '</button></li>'
        );
      }
      return '<li class="dex-cell" title="还没收过「' + escapeHtml(label) + '」">' + inner + '</li>';
    }).join('');

    var currentMission = game.currentMission(data, state.progress);
    if (cleared) {
      missionCurrent.innerHTML = '<strong>已通关</strong> · 八种结论各收一次 · 点开复盘逐组回看';
    } else if (currentMission) {
      missionCurrent.innerHTML =
        '<strong>' +
        escapeHtml(currentMission.title) +
        '</strong> · ' +
        currentMission.done +
        '/' +
        currentMission.goals.length;
    } else {
      missionCurrent.textContent = '';
    }

    renderMissions();
    scoreTableBody.innerHTML = renderScoreTable();
  }

  function renderScoreTable() {
    var scoring = data.scoring;
    var rows = CODE_ORDER.map(function (code) {
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
    }).join('');
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

  function renderMissions() {
    var missions = game.missionStatus(data, state.progress);
    var current = game.currentMission(data, state.progress);
    missionList.innerHTML = missions
      .map(function (mission) {
        var isCurrent = current && current.id === mission.id;
        var goals = mission.goals
          .map(function (goal) {
            var chip =
              '<span class="chip chip-' +
              escapeHtml(goal.code) +
              '">' +
              escapeHtml(game.CONCLUSION_SHORT[goal.code]) +
              '</span>';
            if (goal.scored) {
              return (
                '<button type="button" class="goal is-scored" data-combo="' +
                escapeHtml(goal.comboId) +
                '" title="点一下回到收下它的那一组">' +
                chip +
                '<span class="goal-points">+' +
                goal.points +
                '</span><span class="goal-check">已收</span></button>'
              );
            }
            return (
              '<span class="goal' +
              (isCurrent ? ' is-target' : '') +
              '">' +
              chip +
              '<span class="goal-points">+' +
              goal.points +
              '</span></span>'
            );
          })
          .join('');
        return (
          '<li class="mission' +
          (isCurrent ? ' is-current' : '') +
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

    if (!current) {
      missionDetail.innerHTML =
        '<strong>三章都打完了。</strong>八种结论各收了一次，' +
        game.scoreOf(state.progress, data) +
        ' 分。复盘里能逐组回看自己走过的高分组合与每一维的判据。';
    } else {
      missionDetail.innerHTML = '<strong>' + escapeHtml(current.title) + '</strong>' + escapeHtml(current.hint);
    }
  }

  // ---- 复盘 ----

  function renderReview() {
    var submissions = state.progress.submissions;
    reviewCount.textContent =
      submissions.length === 0
        ? '还没收过任何一组：把判定卡下面那栏点一下，就能收进图鉴。'
        : submissions.length +
          ' 组 · ' +
          game.scoreOf(state.progress, data) +
          ' 分 · 点任意一行回到那一组';
    if (submissions.length === 0) {
      reviewBody.innerHTML = '<p class="empty">图鉴还是空的。</p>';
      return;
    }
    reviewBody.innerHTML = submissions
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
  }

  // ---- 句子与选词卡 ----

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
    optionsTitle.textContent = '换「' + slot.label + '」';
    var result = game.resolve(data, demoData, state.values);
    var parts = [];
    slot.options.forEach(function (option) {
      var current = state.values[slot.key] === option.value;
      // 小标说的是"这个词这一维的判据"，不是整句结论——整句结论另写在判定卡上
      var dimension = current
        ? dimensionOfResult(result, slot.key)
        : game.substitutionDimension(data, demoData, state.values, slot.key, option.value);
      var conclusionLabel = game.CONCLUSION_LABELS[dimension.conclusion] || dimension.conclusion;
      parts.push(
        '<button type="button" class="option' +
          (current ? ' is-current' : '') +
          '" data-value="' +
          escapeHtml(option.value) +
          '" title="' +
          escapeHtml(option.note + '｜换过去整句会判成「' + conclusionLabel + '」') +
          '" aria-pressed="' +
          (current ? 'true' : 'false') +
          '">' +
          '<span class="option-value">' +
          escapeHtml(option.value) +
          (option.demoOnly ? demoTag() : '') +
          '</span><span class="chip chip-' +
          escapeHtml(dimension.state) +
          '">' +
          escapeHtml(dimension.label) +
          '</span></button>'
      );
    });
    if (slot.options.some(function (option) { return option.demoOnly; })) {
      parts.push('<p class="option-legend">' + escapeHtml(game.DEMO_ONLY_LEGEND) + '</p>');
    }
    optionList.innerHTML = parts.join('');
    updateExpandedState();
    focusOptionByValue(focusValue || state.values[slot.key]);
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

  function focusOptionByValue(value) {
    var buttons = optionList.querySelectorAll('.option');
    for (var i = 0; i < buttons.length; i += 1) {
      if (buttons[i].getAttribute('data-value') === value) {
        buttons[i].focus({ preventScroll: true });
        return;
      }
    }
    if (buttons.length > 0) buttons[0].focus({ preventScroll: true });
  }

  function openOptions(key, focusInto) {
    state.openSlot = key;
    optionsPanel.hidden = false;
    renderOptions(focusInto ? state.values[key] : null);
    updateExpandedState();
    playTone(520, 0.05, 'sine');
  }

  function closeOptions(returnFocus) {
    if (!state.openSlot) return;
    var previousKey = state.openSlot;
    state.openSlot = null;
    optionsPanel.hidden = true;
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
    renderVerdict(true);
  }

  function selectOption(key, value) {
    if (!slotByKey[key]) return;
    if (!game.optionOf(data, key, value)) return;
    if (state.values[key] === value) {
      closeOptions(true);
      return;
    }
    var next = cloneValues(state.values);
    next[key] = value;
    closeOptions(false);
    setValues(next, key);
    playTone(680, 0.07, 'triangle');
    var element = slotElementOf(key);
    if (element) element.focus({ preventScroll: true });
  }

  function slotElementOf(key) {
    for (var i = 0; i < slotElements.length; i += 1) {
      if (slotElements[i].getAttribute('data-slot') === key) return slotElements[i];
    }
    return null;
  }

  function resetToInitial() {
    closeOptions(false);
    state.lastChangedKey = null;
    state.values = cloneValues(INITIAL_VALUES);
    updateSentence();
    renderVerdict(true);
  }

  function applyCombo(comboId) {
    var combo = game.comboById(data, comboId);
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

  // ---- 判定卡 ----

  function renderVerdict(animate) {
    var result = game.resolve(data, demoData, state.values);
    verdictElement.className = 'verdict verdict-' + result.status;
    verdictElement.innerHTML = renderCovered(result);
    renderClaim(result);
    if (animate && !reducedMotion()) {
      verdictElement.classList.remove('is-flash');
      void verdictElement.offsetWidth;
      verdictElement.classList.add('is-flash');
    }
    if (state.sheet === 'evidence') renderEvidence(result);
  }

  function statusHead(result) {
    var parts = [];
    parts.push('<div class="verdict-top">');
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
    if (result.status !== 'uncovered') {
      parts.push('<button type="button" class="link-button" data-action="evidence">看证据 · 拆解</button>');
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
    var ready = false;
    if (game.isCleared(state.progress, data)) {
      label = '已通关 · 不再计分';
      note = '八档已收齐，不再计分。';
      disabled = true;
    } else if (check.ok) {
      label = '收进图鉴 +' + points;
      note = '这一档只算第一次 · +' + points;
      ready = true;
    } else if (check.reason === 'repeated-combo') {
      label = '这组已收 · 0 分';
      note = '同一组重复收不给分';
      disabled = true;
    } else {
      label = '这一档已收 · 0 分';
      note = '还缺 ' + missingLabels().split('、').length + ' 档，点「任务」看';
      disabled = true;
    }
    claimRow.innerHTML =
      '<button type="button" class="claim-button' +
      (ready ? ' is-ready' : '') +
      '" data-action="submit"' +
      (disabled ? ' disabled' : '') +
      '>' +
      escapeHtml(label) +
      '</button><span class="claim-note">' +
      escapeHtml(note) +
      '</span>';
  }

  function renderCovered(result) {
    var parts = [];
    parts.push(statusHead(result));
    parts.push('<p class="verdict-reason">' + escapeHtml(result.reason) + '</p>');
    var hint = game.nextHint(result);
    if (hint) {
      parts.push('<p class="verdict-next"><strong>下一步</strong>' + escapeHtml(hint) + '</p>');
    }
    if (result.status === 'uncovered') {
      parts.push(renderUncoveredDimensions(result));
      return parts.join('');
    }
    parts.push(renderDimensions(result));

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
    return parts.join('');
  }

  /** 逐维判据：三个词各自与证据里的原文值比成了什么样，一眼看清 */
  function renderDimensions(result, title) {
    if (!result.dimensions || result.dimensions.length === 0) return '';
    var parts = [];
    if (title) parts.push('<p class="verdict-note">' + escapeHtml(title) + '</p>');
    parts.push('<ul class="dims">');
    result.dimensions.forEach(function (dimension) {
      var evidenceText = dimension.evidenceValue
        ? '证据：' + dimension.evidenceValue
        : '证据里没有可比的原文值';
      parts.push(
        '<li class="dim-row' +
          (dimension.slot === state.lastChangedKey ? ' is-changed' : '') +
          '" title="' +
          escapeHtml(dimension.label + '：你写的是「' + dimension.value + '」，' + evidenceText) +
          '">'
      );
      parts.push('<span class="dim-slot">' + escapeHtml(dimension.label) + '</span>');
      parts.push('<span class="dim-body">');
      parts.push('<span class="dim-value">' + escapeHtml(dimension.value) + '</span>');
      if (dimension.demoOnly) parts.push(demoTag());
      parts.push('<span class="dim-ev">' + escapeHtml(evidenceText) + '</span>');
      parts.push('</span>');
      parts.push(
        '<span class="dim dim-' +
          escapeHtml(dimension.state) +
          '">' +
          escapeHtml(game.dimensionLabel(dimension.state)) +
          '</span>'
      );
      parts.push('</li>');
    });
    parts.push('</ul>');
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
    parts.push(renderDimensions(result));
    parts.push(
      '<p class="verdict-note">不是结论：三个词里只有 ' +
        positive +
        ' 维沾边，要两维到「口径相容」及以上才算覆盖。没覆盖不是被反驳。'
    );
    return parts.join('');
  }

  function renderRecordContext(result) {
    if (!result.combo || !result.record) return '';
    var combo = result.combo;
    return (
      '<p class="sheet-note">对照记录：<strong>' +
      escapeHtml(combo.recordTitle || result.record.recordId) +
      '</strong>（批次 <code>examples/' +
      escapeHtml(combo.caseId || '') +
      '/</code>）。它的门禁是「' +
      escapeHtml(BUCKET_LABELS[combo.bucket] || combo.bucket || '') +
      '」——这是这条冻结记录本身的结论，与你换掉的词无关。</p>'
    );
  }

  // ---- 证据抽屉 ----

  function renderEvidence(result) {
    result = result || game.resolve(data, demoData, state.values);
    if (!result.view) {
      evidenceLead.textContent = '这句话没有落到任何一条冻结记录上，所以没有可摆的证据。';
      evidenceInline.innerHTML = '';
      fullPanel.hidden = true;
      fullBody.innerHTML = '';
      return;
    }
    var entries = decisiveEntries(result.view, result.status, state.lastChangedKey);
    evidenceLead.innerHTML =
      renderRecordContext(result) +
      '<p class="sheet-note">最多三条决定性证据（换过哪个词就先摆那个字段）。全文与逐字段裁决在下面展开。</p>';
    evidenceInline.innerHTML =
      entries.length > 0
        ? entries.map(renderEvidenceInline).join('')
        : '<p class="empty">这条记录没有可摆的支持证据。</p>';
    fullPanel.hidden = false;
    fullBody.innerHTML = renderFull(result);
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
    coverageBody.innerHTML =
      '<p>' +
      stats.total +
      ' 种组合里，' +
      stats.covered +
      ' 种能落到某条冻结记录上（至少两个词对上或相容），其余 ' +
      stats.uncovered +
      ' 种显示「这批证据没覆盖」。结论取三个词里最差的那一维，所以「有一维只到口径相容」不会被组合级的强坐标盖掉。</p>';
    coverageCounts.innerHTML = CODE_ORDER.map(function (code) {
      return (
        '<span class="count">' +
        escapeHtml(game.CONCLUSION_LABELS[code]) +
        ' ' +
        stats.byConclusion[code] +
        '</span>'
      );
    }).join('');
  }

  // ---- 底部抽屉：任务 / 分数 / 复盘 / 证据 / 说明 ----

  function openSheet(name, trigger) {
    state.sheet = name;
    state.sheetTrigger = trigger || null;
    sheetElement.hidden = false;
    sheetTitle.textContent = PANEL_TITLES[name] || '';
    sheetPanels.forEach(function (panel) {
      panel.hidden = panel.getAttribute('data-sheet-panel') !== name;
    });
    closeOptions(false);
    renderSheetIfOpen();
    sheetCloseButton.focus({ preventScroll: true });
  }

  function closeSheet() {
    if (sheetElement.hidden) return;
    var trigger = state.sheetTrigger;
    sheetElement.hidden = true;
    state.sheet = null;
    state.sheetTrigger = null;
    if (trigger && trigger.focus) trigger.focus({ preventScroll: true });
  }

  function renderSheetIfOpen() {
    if (!state.sheet) return;
    if (state.sheet === 'missions') renderMissions();
    else if (state.sheet === 'score') scoreTableBody.innerHTML = renderScoreTable();
    else if (state.sheet === 'review') renderReview();
    else if (state.sheet === 'evidence') renderEvidence();
    else if (state.sheet === 'help') renderCoverage();
  }

  function trapSheetTab(event) {
    if (event.key !== 'Tab' || sheetElement.hidden) return;
    var focusables = Array.prototype.slice
      .call(
        sheetElement.querySelectorAll(
          'button:not([disabled]), a[href], summary, [tabindex]:not([tabindex="-1"])'
        )
      )
      .filter(function (element) {
        return element.offsetParent !== null;
      });
    if (focusables.length === 0) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  // ---- 特效：飘分、进度、收录、通关 ----

  function showPoints(text) {
    if (reducedMotion()) return;
    var button = claimRow.querySelector('.claim-button');
    if (!button) return;
    var rect = button.getBoundingClientRect();
    var node = document.createElement('span');
    node.className = 'fx-points';
    node.textContent = text;
    node.style.left = Math.round(rect.left + rect.width / 2) + 'px';
    node.style.top = Math.round(rect.top) + 'px';
    fxLayer.appendChild(node);
    node.addEventListener('animationend', function () {
      node.remove();
    });
  }

  function pulseScore() {
    if (reducedMotion()) return;
    scoreValue.style.transition = 'transform .18s ease-out';
    scoreValue.style.transform = 'scale(1.28)';
    window.setTimeout(function () {
      scoreValue.style.transform = 'scale(1)';
    }, 190);
  }

  function celebrate() {
    if (reducedMotion()) return;
    var colors = ['#E9C46A', '#57C98A', '#5B9BE0', '#F4EEE2', '#E78B6B'];
    for (var i = 0; i < 18; i += 1) {
      var bit = document.createElement('i');
      bit.className = 'fx-confetti';
      bit.style.left = 6 + Math.random() * 88 + '%';
      bit.style.background = colors[i % colors.length];
      bit.style.animationDelay = Math.round(Math.random() * 260) + 'ms';
      bit.style.animationDuration = 1100 + Math.round(Math.random() * 600) + 'ms';
      bit.style.setProperty('--drift', Math.round(Math.random() * 160 - 80) + 'px');
      bit.style.setProperty('--spin', Math.round(Math.random() * 720 - 360) + 'deg');
      fxLayer.appendChild(bit);
      bit.addEventListener('animationend', function (event) {
        event.target.remove();
      });
    }
    var banner = document.createElement('div');
    banner.className = 'fx-banner';
    banner.textContent = '通关 · 31 / 31';
    fxLayer.appendChild(banner);
    banner.addEventListener('animationend', function () {
      banner.remove();
    });
  }

  // ---- 事件 ----

  slotElements.forEach(function (element) {
    element.addEventListener('click', function (event) {
      toggleOptions(element.getAttribute('data-slot'), event.detail === 0);
    });
    element.addEventListener('keydown', function (event) {
      var key = element.getAttribute('data-slot');
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        // 不开面板也能换词：方向键在候选里走一格，立刻看到判据变化
        event.preventDefault();
        cycleOption(key, event.key === 'ArrowRight' ? 1 : -1);
        return;
      }
      if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
      event.preventDefault();
      if (state.openSlot === key) focusOptionByValue(state.values[key]);
      else openOptions(key, true);
    });
  });

  function cycleOption(key, step) {
    var slot = slotByKey[key];
    if (!slot) return;
    var index = 0;
    slot.options.forEach(function (option, position) {
      if (option.value === state.values[key]) index = position;
    });
    var next = (index + step + slot.options.length) % slot.options.length;
    selectOption(key, slot.options[next].value);
  }

  optionList.addEventListener('click', function (event) {
    var button = event.target.closest ? event.target.closest('.option') : null;
    if (!button || !state.openSlot) return;
    event.stopPropagation();
    selectOption(state.openSlot, button.getAttribute('data-value'));
  });

  optionList.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeOptions(true);
      return;
    }
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
    var evidence = event.target.closest('[data-action="evidence"]');
    if (evidence) {
      openSheet('evidence', evidence);
    }
  });

  claimRow.addEventListener('click', function (event) {
    var submit = event.target.closest ? event.target.closest('[data-action="submit"]') : null;
    if (submit) submitCurrent();
  });

  dexElement.addEventListener('click', function (event) {
    var cell = event.target.closest ? event.target.closest('[data-combo]') : null;
    if (!cell) return;
    applyCombo(cell.getAttribute('data-combo'));
  });

  missionCurrent.addEventListener('click', function () {
    openSheet('missions', missionCurrent);
  });

  document.querySelectorAll('[data-sheet]').forEach(function (button) {
    if (button === missionCurrent) return;
    button.addEventListener('click', function () {
      openSheet(button.getAttribute('data-sheet'), button);
    });
  });

  document.querySelector('[data-action="close-options"]').addEventListener('click', function () {
    closeOptions(true);
  });

  sheetElement.addEventListener('click', function (event) {
    if (!event.target.closest) return;
    if (event.target.closest('[data-action="close-sheet"]')) {
      closeSheet();
      return;
    }
    var jump = event.target.closest('[data-combo]');
    if (jump) {
      closeSheet();
      applyCombo(jump.getAttribute('data-combo'));
    }
  });

  document.addEventListener('click', function (event) {
    if (!state.openSlot) return;
    if (event.target.closest && event.target.closest('#slot-options')) return;
    if (event.target.closest && event.target.closest('.slot')) return;
    closeOptions(false);
  });

  document.addEventListener('keydown', function (event) {
    trapSheetTab(event);
    if (event.key !== 'Escape') return;
    if (!sheetElement.hidden) {
      closeSheet();
      return;
    }
    if (state.openSlot) closeOptions(true);
  });

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

  soundToggle.addEventListener('click', function () {
    state.soundOn = !state.soundOn;
    soundToggle.setAttribute('aria-pressed', state.soundOn ? 'true' : 'false');
    soundToggle.textContent = state.soundOn ? '音效·开' : '音效·关';
    if (state.soundOn) playTone(660, 0.08, 'sine');
  });

  updateSentence();
  updateExpandedState();
  renderHud();
  renderVerdict(false);
  renderReview();
  renderCoverage();
})();
