/* docs/assets/demo-lab.js
 *
 * 小游戏页的行为层。一回合是一条连贯的线：
 * 拖一张候选卡进槽位 → 判定卡翻面、判据换新 → 能领的分数变成宝箱落在场上 →
 * 亲手开箱 → 分数从箱里飞进八格图鉴、格子点亮 → 提示自动指向下一步该换哪一维。
 *
 * 布局是一屏定死的：顶栏 / 进度 / 句子 / 判定卡 / 候选卡托盘 / 动作坞各占一行。
 * 判定卡与宝箱、飞分都在这一屏里完成，长内容（任务、分数表、复盘、证据、说明）都收进
 * 底部抽屉，触发才展开，所以任何一行变长都不会把页面撑出滚动条。
 *
 * 玩法只有一条规则：**每种结论只在第一次被收进图鉴时给分**。同一组重复收是 0 分，
 * 换个组合收同一个结论也是 0 分，所以分数条填满（31 分）就等于八种结论都亲眼看过。
 * 重复组合与该档已收也会出一只**空箱**——玩家开箱后看到明确理由，不会静默不加分。
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
  // 维度严重度与 demo-game-match.js 完全一致：越靠前越差
  var SEVERITY = ['conflict', 'mismatch', 'unknown', 'edge', 'caliber', 'exact'];
  // 主界面只用两个字以内的关键词：完整说法放在 title / 证据抽屉里
  var MINI_CODE = {
    strong: '强坐标',
    weak: '弱坐标',
    caliber: '口径',
    edge: '边缘',
    conflict: '冲突',
    mismatch: '没对上',
    unknown: '无从',
    uncovered: '没覆盖'
  };
  var MINI_STATE = {
    exact: '对上',
    caliber: '口径',
    edge: '边缘',
    conflict: '冲突',
    mismatch: '没对上',
    unknown: '无从'
  };
  var MINI_SLOT = {
    auctionHouse: '机构',
    dateText: '时间',
    sessionName: '专场'
  };
  // 开箱粒子数：档位越高，箱子越华丽
  var SPARK_COUNT = {
    strong: 14,
    weak: 10,
    caliber: 7,
    edge: 5,
    conflict: 5,
    mismatch: 4,
    unknown: 3,
    uncovered: 2
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
    activeSlot: 'dateText',
    lastChangedKey: null,
    progress: loadProgress(),
    confirmReset: false,
    toastTimer: null,
    sheet: null,
    sheetTrigger: null,
    soundOn: false,
    chest: null,
    opening: false,
    pendingCode: null,
    verdictToken: 0,
    commitTimer: null,
    dockToken: 0,
    suggestTimer: null,
    press: null
  };

  var slotElements = Array.prototype.slice.call(document.querySelectorAll('.slot'));
  var trayList = document.getElementById('tray-list');
  var traySlot = document.getElementById('tray-slot');
  var chestDock = document.getElementById('chest-dock');
  var chestStage = document.getElementById('chest-stage');
  var chestCaption = document.getElementById('chest-caption');
  var loopHint = document.getElementById('loop-hint');
  var verdictElement = document.getElementById('verdict');
  var dexElement = document.getElementById('dex');
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
  var gameShell = document.getElementById('game');

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

  function slotElementOf(key) {
    for (var i = 0; i < slotElements.length; i += 1) {
      if (slotElements[i].getAttribute('data-slot') === key) return slotElements[i];
    }
    return null;
  }

  function focusSlot(key) {
    var element = slotElementOf(key);
    if (element) element.focus({ preventScroll: true });
  }

  function focusChest() {
    var node = chestDock.querySelector('.chest');
    if (node) node.focus({ preventScroll: true });
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
    state.chest = null;
    state.opening = false;
    state.pendingCode = null;
    ++state.dockToken;
    try {
      window.localStorage.removeItem(game.STORAGE_KEY);
    } catch (error) {
      // 同上：清不掉也只是刷新后回来
    }
    renderHud();
    flushCommit();
    renderReview();
    renderSheetIfOpen();
    showToast('存档已清空：分数归零，图鉴重新开始。');
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

  function renderHud(popCode, pendingCode) {
    var score = game.scoreOf(state.progress, data);
    var target = game.targetOf(data);
    var scored = game.scoredCodes(state.progress, data);
    var count = Object.keys(scored).length;
    var cleared = score >= target;

    scoreValue.textContent = String(score);
    scoreTarget.textContent = String(target);
    scoreCount.textContent = count + ' / ' + CODE_ORDER.length;
    scoreFill.style.width = (target > 0 ? Math.min(100, (score / target) * 100) : 0) + '%';
    scoreBar.setAttribute('aria-valuenow', String(score));
    scoreBar.setAttribute('aria-valuemax', String(target));
    scoreBar.classList.toggle('is-cleared', cleared);

    dexElement.innerHTML = CODE_ORDER.map(function (code) {
      var collected = !!scored[code];
      var label = MINI_CODE[code] || game.CONCLUSION_SHORT[code];
      var points = '+' + game.pointsFor(data, code);
      var arriving = pendingCode === code && collected;
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
          (arriving ? ' is-arriving' : '') +
          '" data-combo="' +
          escapeHtml(scored[code]) +
          '" title="' +
          escapeHtml(game.CONCLUSION_LABELS[code]) + '：点一下回到收下它的那一组">' +
          inner +
          '</button></li>'
        );
      }
      return '<li class="dex-cell" title="还没收过「' + escapeHtml(game.CONCLUSION_LABELS[code]) + '」">' + inner + '</li>';
    }).join('');

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
        ? '还没收过任何一组：拖一张候选卡换个词，开箱就是收录。'
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

  // ---- 句子、候选卡托盘与换词 ----

  function updateSentence() {
    slotElements.forEach(function (element) {
      var key = element.getAttribute('data-slot');
      element.textContent = state.values[key];
      element.setAttribute(
        'aria-label',
        slotLabel(key) +
          '，当前是「' +
          state.values[key] +
          '」，左右方向键换词；有宝箱时按回车开箱'
      );
      if (game.isDemoOnly(data, key, state.values[key])) element.classList.add('is-demo');
      else element.classList.remove('is-demo');
    });
  }

  function updateSlotClasses() {
    slotElements.forEach(function (element) {
      var key = element.getAttribute('data-slot');
      element.classList.toggle('is-active', key === state.activeSlot);
    });
  }

  function setActiveSlot(key) {
    if (!slotByKey[key]) return;
    var changed = state.activeSlot !== key;
    state.activeSlot = key;
    updateSlotClasses();
    if (changed) renderTray();
  }

  function renderTray(preserveFocus) {
    var slot = slotByKey[state.activeSlot];
    if (!slot) return;
    var previous = document.activeElement;
    var focusedValue =
      preserveFocus && previous && trayList.contains(previous)
        ? previous.getAttribute('data-value')
        : null;
    traySlot.textContent = slot.label;
    var result = game.resolve(data, demoData, state.values);
    trayList.innerHTML = slot.options
      .map(function (option) {
        var current = state.values[slot.key] === option.value;
        // 小标说的是"这个词这一维的判据"，不是整句结论——整句结论另写在判定卡上
        var dimension = current
          ? dimensionOfResult(result, slot.key)
          : game.substitutionDimension(data, demoData, state.values, slot.key, option.value);
        var conclusionLabel = game.CONCLUSION_LABELS[dimension.conclusion] || dimension.conclusion;
        return (
          '<div class="word-card' +
          (current ? ' is-current' : '') +
          '" role="button" tabindex="0" data-slot="' +
          escapeHtml(slot.key) +
          '" data-value="' +
          escapeHtml(option.value) +
          '" aria-pressed="' +
          (current ? 'true' : 'false') +
          '" aria-label="' +
          escapeHtml(
            slot.label +
              '换成「' +
              option.value +
              '」，换过去整句会判成「' +
              conclusionLabel +
              '」'
          ) +
          '" title="' +
          escapeHtml(option.note + '｜换过去整句会判成「' + conclusionLabel + '」') +
          '"><span class="word-card-value">' +
          escapeHtml(option.value) +
          '</span><span class="word-card-foot"><span class="chip chip-' +
          escapeHtml(dimension.state) +
          '">' +
          escapeHtml(dimension.label) +
          '</span>' +
          (option.demoOnly ? demoTag() : '') +
          '</span></div>'
        );
      })
      .join('');
    if (focusedValue) {
      var cards = trayList.querySelectorAll('.word-card');
      for (var i = 0; i < cards.length; i += 1) {
        if (cards[i].getAttribute('data-value') === focusedValue) {
          cards[i].focus({ preventScroll: true });
          return;
        }
      }
    }
  }

  function activateValue(key, value, source) {
    var changed = state.values[key] !== value;
    setActiveSlot(key);
    applyChange(key, value, { immediate: true, source: source });
    if (changed) playTone(680, 0.07, 'triangle');
    if (source === 'card' || source === 'keyboard') focusChest();
  }

  function activateCard(card, source) {
    if (!card) return;
    activateValue(card.getAttribute('data-slot'), card.getAttribute('data-value'), source || 'card');
  }

  function applyChange(key, value, options) {
    var opts = options || {};
    if (!slotByKey[key]) return;
    if (!game.optionOf(data, key, value)) return;
    if (state.values[key] === value) {
      var element = slotElementOf(key);
      if (element) {
        element.classList.remove('is-receiving');
        void element.offsetWidth;
        element.classList.add('is-receiving');
      }
      return;
    }
    settlePendingNow();
    var next = cloneValues(state.values);
    next[key] = value;
    state.values = next;
    state.lastChangedKey = key;
    state.activeSlot = key;
    updateSentence();
    updateSlotClasses();
    renderTray(true);
    var target = slotElementOf(key);
    if (target) {
      target.classList.remove('is-receiving');
      void target.offsetWidth;
      target.classList.add('is-receiving');
    }
    if (opts.immediate) flushCommit();
    else queueCommit();
  }

  function queueCommit() {
    if (state.commitTimer) window.clearTimeout(state.commitTimer);
    state.commitTimer = window.setTimeout(function () {
      state.commitTimer = null;
      flushCommit();
    }, 140);
  }

  /** 一次落定：判定卡翻面换内容、宝箱按新结论重摆，两者只做一次 */
  function flushCommit() {
    if (state.commitTimer) {
      window.clearTimeout(state.commitTimer);
      state.commitTimer = null;
    }
    var result = game.resolve(data, demoData, state.values);
    var token = ++state.verdictToken;
    renderChest(result);
    updateSlotClasses();
    if (reducedMotion()) {
      paintVerdict(result);
      return;
    }
    verdictElement.classList.remove('is-flipping');
    void verdictElement.offsetWidth;
    verdictElement.classList.add('is-flipping');
    window.setTimeout(function () {
      if (token !== state.verdictToken) return;
      paintVerdict(result);
    }, 135);
    window.setTimeout(function () {
      if (token !== state.verdictToken) return;
      verdictElement.classList.remove('is-flipping');
    }, 320);
  }

  function paintVerdict(result) {
    CODE_ORDER.forEach(function (code) {
      verdictElement.classList.remove('verdict-' + code);
    });
    verdictElement.classList.add('verdict-' + result.status);
    verdictElement.innerHTML = renderCovered(result);
    if (state.sheet === 'evidence') renderEvidence(result);
  }

  function cycleOption(key, step) {
    var slot = slotByKey[key];
    if (!slot) return;
    var index = 0;
    slot.options.forEach(function (option, position) {
      if (option.value === state.values[key]) index = position;
    });
    var next = (index + step + slot.options.length) % slot.options.length;
    applyChange(key, slot.options[next].value, { source: 'key' });
  }

  function setValues(next, changedKey) {
    settlePendingNow();
    state.values = cloneValues(next);
    state.lastChangedKey = changedKey || null;
    updateSentence();
    updateSlotClasses();
    renderTray(true);
    flushCommit();
  }

  function resetToInitial() {
    setValues(INITIAL_VALUES, null);
    state.activeSlot = 'dateText';
    updateSlotClasses();
    renderTray(true);
  }

  function applyCombo(comboId) {
    var combo = game.comboById(data, comboId);
    if (!combo) return;
    var changedKey = null;
    Object.keys(INITIAL_VALUES).some(function (key) {
      if (state.values[key] !== combo.values[key]) {
        changedKey = key;
        return true;
      }
      return false;
    });
    setValues(combo.values, changedKey);
    if (changedKey) {
      state.activeSlot = changedKey;
      updateSlotClasses();
      renderTray(true);
    }
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

  function worstOf(dimensions) {
    for (var i = 0; i < SEVERITY.length; i += 1) {
      for (var j = 0; j < dimensions.length; j += 1) {
        if (dimensions[j].state === SEVERITY[i]) return dimensions[j];
      }
    }
    return dimensions[0] || null;
  }

  /** 下一步该换哪一维：取判据最差的那一维；全对上时换专场名做探索 */
  function suggestedSlot(result) {
    var dimensions = (result && result.dimensions) || [];
    if (dimensions.length === 0) return state.activeSlot || 'sessionName';
    if (result.status === 'uncovered') {
      var positive = dimensions.filter(function (dimension) {
        return (
          dimension.state === 'exact' ||
          dimension.state === 'caliber' ||
          dimension.state === 'edge'
        );
      });
      var weakest = positive.length > 0 ? worstOf(positive) : dimensions[0];
      return weakest ? weakest.slot : 'sessionName';
    }
    var worst = worstOf(dimensions);
    if (worst && worst.state !== 'exact') return worst.slot;
    return 'sessionName';
  }

  function setSuggestedSlot(key) {
    slotElements.forEach(function (element) {
      var hit = key && element.getAttribute('data-slot') === key;
      element.classList.remove('is-suggested');
      if (hit) {
        void element.offsetWidth;
        element.classList.add('is-suggested');
      }
    });
    if (state.suggestTimer) {
      window.clearTimeout(state.suggestTimer);
      state.suggestTimer = null;
    }
    if (key) {
      state.suggestTimer = window.setTimeout(function () {
        state.suggestTimer = null;
        slotElements.forEach(function (element) {
          element.classList.remove('is-suggested');
        });
      }, 3800);
    }
  }

  // ---- 宝箱：判定出可领就先摆箱，开箱才结算 ----

  function chestMarkup(chest) {
    var label = game.CONCLUSION_SHORT[chest.code] || chest.code;
    var className;
    var aria;
    if (chest.claimable) {
      className = 'chest chest-' + chest.code + ' is-ready';
      aria = '开箱：' + (game.CONCLUSION_LABELS[chest.code] || label) + '，+' + chest.points + ' 分';
    } else {
      className = 'chest chest-empty is-empty';
      aria = '空箱：' + emptyReason(chest);
    }
    return (
      '<button type="button" class="' +
      className +
      '" id="chest" data-action="open-chest" aria-label="' +
      escapeHtml(aria) +
      '"><span class="chest-inner" aria-hidden="true">' +
      '<span class="chest-glow"></span>' +
      '<span class="chest-beam"></span>' +
      '<span class="chest-lid"><span class="chest-band"></span></span>' +
      '<span class="chest-body"><span class="chest-band"></span></span>' +
      '<span class="chest-lock"></span>' +
      '<span class="chest-points">' +
      (chest.claimable ? '+' + chest.points : '0') +
      '</span></span></button>'
    );
  }

  function emptyReason(chest) {
    var short = game.CONCLUSION_SHORT[chest.code] || '';
    if (chest.reason === 'repeated-combo') return '这组重复了：同一组只算第一次，不会再加分。';
    if (chest.reason === 'conclusion-taken') {
      return '「' + short + '」这档收过了：同一档只算第一次，换别的档才有分。';
    }
    return '这一组不在冻结矩阵里，收不了。';
  }

  function renderChest(result) {
    if (state.opening) return;
    ++state.dockToken;
    setSuggestedSlot(null);
    if (game.isCleared(state.progress, data)) {
      state.chest = null;
      hideChestStage();
      updateLoopHint('cleared');
      return;
    }
    var combo = game.findCombo(data, state.values);
    var check = game.evaluateSubmission(state.progress, data, combo);
    var chest = {
      code: result.status,
      points: game.pointsFor(data, result.status),
      claimable: !!check.ok,
      reason: check.reason || '',
      result: result,
      comboId: combo ? combo.id : ''
    };
    state.chest = chest;
    if (chest.claimable) {
      showChestStage(chest);
      updateLoopHint('judge', chest);
    } else {
      hideChestStage();
      updateLoopHint('judge', chest);
    }
  }

  /** 有分可领：箱子立刻居中弹出，暗场压住棋盘，必须玩家亲手点 */
  function showChestStage(chest) {
    chestDock.innerHTML = chestMarkup(chest);
    chestStage.hidden = false;
    if (gameShell) gameShell.classList.add('is-chesting');
    chestCaption.textContent = '点一下开箱';
    var node = chestDock.querySelector('.chest');
    if (!node) return;
    window.setTimeout(function () {
      if (state.chest !== chest || state.opening) return;
      try {
        node.focus({ preventScroll: true });
      } catch (error) {
        node.focus();
      }
    }, 80);
  }

  function hideChestStage() {
    chestStage.hidden = true;
    chestDock.innerHTML = '';
    if (gameShell) gameShell.classList.remove('is-chesting');
  }

  function updateLoopHint(mode, chest, points) {
    loopHint.classList.remove('is-warn');
    if (mode === 'cleared') {
      loopHint.innerHTML = '<strong>通关</strong>八档收齐，不再出箱';
      return;
    }
    if (mode === 'settled') {
      loopHint.innerHTML =
        '<strong>+' +
        points +
        '</strong>下一步：换「' +
        escapeHtml(slotLabel(suggestedSlot(chest.result))) +
        '」';
      return;
    }
    if (!chest) {
      loopHint.textContent = '';
      return;
    }
    if (mode === 'empty' || !chest.claimable) {
      loopHint.classList.add('is-warn');
      loopHint.innerHTML =
        '<strong>0 分</strong>' +
        escapeHtml(shortEmptyReason(chest)) +
        ' · 换「' +
        escapeHtml(slotLabel(suggestedSlot(chest.result))) +
        '」';
      return;
    }
    loopHint.textContent = '';
  }

  function shortEmptyReason(chest) {
    if (chest.reason === 'repeated-combo') return '这组收过了';
    if (chest.reason === 'conclusion-taken') return '这档收过了';
    return '不在这批里';
  }

  function settlePendingNow() {
    if (!state.opening) return;
    state.opening = false;
    state.pendingCode = null;
    state.chest = null;
    ++state.dockToken;
    renderHud();
    hideChestStage();
  }

  function dexCellRect(code) {
    var index = CODE_ORDER.indexOf(code);
    if (index < 0) return null;
    var cell = dexElement.children[index];
    return cell ? cell.getBoundingClientRect() : null;
  }

  // 点击反馈：光标处一圈扩散的光斑 + 开箱时的一下爆闪
  function rippleAt(x, y) {
    if (reducedMotion()) return;
    var node = document.createElement('span');
    node.className = 'ripple';
    node.style.left = x + 'px';
    node.style.top = y + 'px';
    fxLayer.appendChild(node);
    node.addEventListener('animationend', function () {
      node.remove();
    });
  }

  function flashAt(x, y) {
    if (reducedMotion()) return;
    var node = document.createElement('div');
    node.className = 'fx-flash';
    node.style.setProperty('--x', x + 'px');
    node.style.setProperty('--y', y + 'px');
    fxLayer.appendChild(node);
    node.addEventListener('animationend', function () {
      node.remove();
    });
  }

  function spawnSparks(chest) {
    if (reducedMotion()) return;
    var count = chest.claimable ? SPARK_COUNT[chest.code] || 0 : 0;
    if (count === 0) return;
    var node = chestDock.querySelector('.chest');
    if (!node) return;
    for (var i = 0; i < count; i += 1) {
      var spark = document.createElement('i');
      spark.className = 'chest-spark';
      spark.style.setProperty('--sx', Math.round(Math.random() * 74 - 37) + 'px');
      spark.style.setProperty('--sy', Math.round(-18 - Math.random() * 48) + 'px');
      spark.style.animationDelay = Math.round(Math.random() * 120) + 'ms';
      node.appendChild(spark);
      spark.addEventListener('animationend', function (event) {
        event.target.remove();
      });
    }
  }

  /** 分数从箱子里飞进对应图鉴格：WAAPI 走一条弧线，失败就立即落袋 */
  function flyPoints(fromRect, toRect, points, done) {
    if (reducedMotion() || !fromRect || !toRect) {
      done();
      return;
    }
    var node = document.createElement('span');
    node.className = 'fx-fly';
    node.textContent = '+' + points;
    fxLayer.appendChild(node);
    var sx = fromRect.left + fromRect.width / 2;
    var sy = fromRect.top + fromRect.height / 2;
    var ex = toRect.left + toRect.width / 2;
    var ey = toRect.top + toRect.height / 2;
    var cx = (sx + ex) / 2 + (ex > sx ? 20 : -20);
    var cy = Math.min(sy, ey) - 46;
    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      if (node.parentNode) node.remove();
      done();
    }
    try {
      if (typeof node.animate !== 'function') {
        finish();
        return;
      }
      var animation = node.animate(
        [
          { transform: 'translate(' + sx + 'px,' + sy + 'px) scale(.55)', opacity: 0.25 },
          { offset: 0.55, transform: 'translate(' + cx + 'px,' + cy + 'px) scale(1.18)', opacity: 1 },
          { transform: 'translate(' + ex + 'px,' + ey + 'px) scale(.9)', opacity: 1 }
        ],
        { duration: 560, easing: 'cubic-bezier(.25,.6,.3,1)', fill: 'forwards' }
      );
      animation.onfinish = finish;
    } catch (error) {
      window.setTimeout(finish, 0);
      return;
    }
    window.setTimeout(finish, 900);
  }

  function openChest() {
    var chest = state.chest;
    if (!chest || state.opening) return;
    if (game.isCleared(state.progress, data)) return;
    var node = chestDock.querySelector('.chest');
    var chestRect = node ? node.getBoundingClientRect() : chestStage.getBoundingClientRect();
    state.opening = true;
    if (node) {
      node.classList.remove('is-ready');
      node.classList.add('is-open');
    }
    flashAt(chestRect.left + chestRect.width / 2, chestRect.top + chestRect.height * 0.4);
    spawnSparks(chest);
    playTone(520, 0.1, 'square');

    var combo = game.findCombo(data, state.values);
    var wasCleared = game.isCleared(state.progress, data);
    var result = game.submit(state.progress, data, combo);
    if (!result.ok) {
      // 判定卡与箱子之间状态被改过：按空箱处理，但理由照样说清
      state.opening = false;
      state.chest = null;
      hideChestStage();
      updateLoopHint('empty', chest);
      showToast(rejectionText(result));
      return;
    }
    state.progress = result.progress;
    saveProgress();
    state.pendingCode = result.code;
    renderHud(null, result.code);
    playTone(760, 0.16, 'triangle');
    window.setTimeout(function () {
      playTone(1040, 0.2, 'triangle');
    }, 110);

    var landed = false;
    function finish() {
      if (landed) return;
      landed = true;
      state.pendingCode = null;
      state.opening = false;
      state.chest = null;
      renderHud(result.code);
      pulseScore();
      renderReview();
      renderSheetIfOpen();
      var suggested = suggestedSlot(chest.result);
      setSuggestedSlot(suggested);
      updateLoopHint(result.cleared ? 'cleared' : 'settled', chest, result.points);
      if (!result.cleared) {
        setActiveSlot(suggested);
        focusSlot(suggested);
      }
      if (result.cleared && !wasCleared) {
        celebrate();
      }
    }
    // 箱盖掀开 → 暗场先退 → 分数从原位置飞进图鉴
    window.setTimeout(function () {
      hideChestStage();
      flyPoints(chestRect, dexCellRect(result.code), result.points, finish);
    }, reducedMotion() ? 0 : 240);
  }

  // ---- 判定卡 ----

  function statusHead(result) {
    var parts = [];
    parts.push('<div class="verdict-head">');
    parts.push(
      '<span class="badge badge-' +
        escapeHtml(result.status) +
        '" title="' +
        escapeHtml(result.label) +
        '">' +
        escapeHtml(MINI_CODE[result.status] || result.label) +
        '<span class="sr-only">' +
        escapeHtml(result.label) +
        '</span></span>'
    );
    parts.push(renderMiniDims(result));
    if (isChanged()) {
      parts.push(
        '<button type="button" class="link-button" data-action="reset" title="回到最初那句" aria-label="回到最初那句">↺</button>'
      );
    }
    parts.push(
      '<button type="button" class="link-button" data-action="evidence" title="逐维判据、引文与来源，点开才看">' +
        (result.status === 'uncovered' ? '看看为什么' : '判据') +
        '</button>'
    );
    parts.push('</div>');
    return parts.join('');
  }

  /** 主界面只放三个关键词小签：哪一维、什么状态。完整说法在 title 与证据抽屉里 */
  function renderMiniDims(result) {
    if (!result.dimensions || result.dimensions.length === 0) return '';
    var parts = ['<span class="mini-dims">'];
    result.dimensions.forEach(function (dimension) {
      parts.push(
        '<span class="mini-dim mini-' +
          escapeHtml(dimension.state) +
          '" title="' +
          escapeHtml(
            dimension.label +
              '：' +
              game.dimensionLabel(dimension.state) +
              ' · 你写的是「' +
              dimension.value +
              '」'
          ) +
          '">' +
          escapeHtml(MINI_SLOT[dimension.slot] || dimension.label) +
          ' <b>' +
          escapeHtml(MINI_STATE[dimension.state]) +
          '</b></span>'
      );
    });
    parts.push('</span>');
    return parts.join('');
  }

  function renderCovered(result) {
    var parts = [];
    parts.push(statusHead(result));
    if (result.status === 'uncovered') {
      var positive = result.dimensions.filter(function (dimension) {
        return (
          dimension.state === 'exact' ||
          dimension.state === 'caliber' ||
          dimension.state === 'edge'
        );
      }).length;
      parts.push('<p class="verdict-note">不到结论：只有 ' + positive + ' 维沾边</p>');
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
      '<p class="verdict-reason">' +
      escapeHtml(result.reason) +
      '</p>' +
      (result.status === 'uncovered'
        ? renderUncoveredDimensions(result)
        : renderDimensions(result)) +
      (function () {
        var hint = game.nextHint(result);
        return hint ? '<p class="verdict-next"><strong>下一步</strong>' + escapeHtml(hint) + '</p>' : '';
      })() +
      (result.view.conflictCandidates.length > 0
        ? '<p class="verdict-note">冲突只作候选：' +
          escapeHtml(
            result.view.conflictCandidates
              .map(function (item) {
                return item.label;
              })
              .join('、')
          ) +
          ' 的判据是「冲突候选」，页面不会把它压成「反对」。</p>'
        : '') +
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

  // ---- 特效：进度、通关 ----

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
    // 横幅落在图鉴与托盘之间的空档，别压住刚点亮的那一排
    var dex = document.getElementById('dex');
    if (dex) {
      var dexRect = dex.getBoundingClientRect();
      banner.style.top = Math.round(dexRect.bottom + 30) + 'px';
    }
    fxLayer.appendChild(banner);
    banner.addEventListener('animationend', function () {
      banner.remove();
    });
  }

  // ---- 拖拽：零依赖指针事件，触屏用横滑浏览、上拖换词 ----

  function onCardPointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    var card = event.target.closest ? event.target.closest('.word-card') : null;
    if (!card || !trayList.contains(card)) return;
    if (state.opening) settlePendingNow();
    var rect = card.getBoundingClientRect();
    state.press = {
      card: card,
      slotKey: card.getAttribute('data-slot'),
      value: card.getAttribute('data-value'),
      startX: event.clientX,
      startY: event.clientY,
      rect: rect,
      touch: event.pointerType !== 'mouse',
      dragging: false,
      over: false,
      ghost: null
    };
    window.addEventListener('pointermove', onCardPointerMove);
    window.addEventListener('pointerup', onCardPointerUp);
    window.addEventListener('pointercancel', onCardPointerCancel);
  }

  function onCardPointerMove(event) {
    var press = state.press;
    if (!press) return;
    var dx = event.clientX - press.startX;
    var dy = event.clientY - press.startY;
    if (!press.dragging) {
      if (Math.abs(dx) + Math.abs(dy) < 7) return;
      // 触屏上横向先动 = 拨卡浏览，交给原生横向滚动
      if (press.touch && Math.abs(dx) > Math.abs(dy)) {
        endPress(false);
        return;
      }
      startGhost(press);
    }
    if (event.cancelable) event.preventDefault();
    press.ghost.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    var slotEl = slotElementOf(press.slotKey);
    if (!slotEl) return;
    var rect = slotEl.getBoundingClientRect();
    var near =
      event.clientX >= rect.left - 30 &&
      event.clientX <= rect.right + 30 &&
      event.clientY >= rect.top - 32 &&
      event.clientY <= rect.bottom + 32;
    if (near !== press.over) {
      press.over = near;
      slotEl.classList.toggle('is-drop-target', near);
    }
  }

  function onCardPointerUp(event) {
    var press = state.press;
    if (!press) return;
    var dragging = press.dragging;
    var over = press.over;
    var ghost = press.ghost;
    var x = event.clientX;
    var y = event.clientY;
    endPress(!!ghost);
    if (!dragging) {
      activateCard(press.card, 'card');
      return;
    }
    if (over) {
      snapGhost(ghost, press, true, function () {
        activateValue(press.slotKey, press.value, 'card');
      });
      return;
    }
    snapGhost(ghost, press, false, null);
    var dropped = document.elementFromPoint(x, y);
    if (dropped && dropped.closest && dropped.closest('.slot')) {
      showToast('这张卡只能换「' + slotLabel(press.slotKey) + '」，落点不对，已经弹回。');
    }
  }

  function onCardPointerCancel() {
    var press = state.press;
    if (!press) return;
    if (press.ghost) press.ghost.remove();
    endPress(false);
  }

  function startGhost(press) {
    var ghost = press.card.cloneNode(true);
    ghost.classList.add('word-card-ghost');
    ghost.removeAttribute('tabindex');
    ghost.removeAttribute('role');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.style.width = press.rect.width + 'px';
    ghost.style.height = press.rect.height + 'px';
    ghost.style.left = press.rect.left + 'px';
    ghost.style.top = press.rect.top + 'px';
    document.body.appendChild(ghost);
    press.ghost = ghost;
    press.dragging = true;
    press.card.classList.add('is-lifted');
    document.body.classList.add('is-dragging');
    slotElements.forEach(function (element) {
      if (element.getAttribute('data-slot') !== press.slotKey) {
        element.classList.add('is-drop-muted');
      }
    });
    playTone(420, 0.04, 'sine');
  }

  function endPress(keepGhost) {
    var press = state.press;
    if (!press) return;
    state.press = null;
    window.removeEventListener('pointermove', onCardPointerMove);
    window.removeEventListener('pointerup', onCardPointerUp);
    window.removeEventListener('pointercancel', onCardPointerCancel);
    document.body.classList.remove('is-dragging');
    slotElements.forEach(function (element) {
      element.classList.remove('is-drop-target');
      element.classList.remove('is-drop-muted');
    });
    if (press.card) press.card.classList.remove('is-lifted');
    if (press.ghost && !keepGhost) press.ghost.remove();
  }

  function snapGhost(ghost, press, valid, done) {
    if (!ghost) {
      if (done) done();
      return;
    }
    if (reducedMotion()) {
      ghost.remove();
      if (done) done();
      return;
    }
    if (valid) {
      var slotEl = slotElementOf(press.slotKey);
      var dx = 0;
      var dy = -60;
      if (slotEl) {
        var rect = slotEl.getBoundingClientRect();
        dx = rect.left + rect.width / 2 - (press.rect.left + press.rect.width / 2);
        dy = rect.top + rect.height / 2 - (press.rect.top + press.rect.height / 2);
      }
      ghost.style.transition = 'transform .17s cubic-bezier(.2,.9,.3,1), opacity .17s ease';
      ghost.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(.7)';
      ghost.style.opacity = '0';
      window.setTimeout(function () {
        ghost.remove();
        if (done) done();
      }, 170);
      return;
    }
    ghost.style.transition = 'transform .22s cubic-bezier(.3,1.4,.5,1), opacity .22s ease';
    ghost.style.transform = 'translate(0,0)';
    window.setTimeout(function () {
      ghost.remove();
      if (done) done();
    }, 210);
  }

  // ---- 事件 ----

  slotElements.forEach(function (element) {
    var key = element.getAttribute('data-slot');
    element.addEventListener('click', function () {
      setActiveSlot(key);
    });
    element.addEventListener('focus', function () {
      setActiveSlot(key);
    });
    element.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        // 聚焦槽位 → 左右方向键切词 → 回车开箱：不碰鼠标也能走完整局
        event.preventDefault();
        setActiveSlot(key);
        cycleOption(key, event.key === 'ArrowRight' ? 1 : -1);
        return;
      }
      if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
      event.preventDefault();
      if (state.chest) {
        openChest();
        return;
      }
      setActiveSlot(key);
      var current = trayList.querySelector('.word-card.is-current');
      if (current) current.focus({ preventScroll: true });
    });
  });

  trayList.addEventListener('pointerdown', onCardPointerDown);

  trayList.addEventListener('keydown', function (event) {
    var card = event.target.closest ? event.target.closest('.word-card') : null;
    if (!card) return;
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      activateCard(card, 'keyboard');
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      focusSlot(state.activeSlot);
      return;
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    var cards = Array.prototype.slice.call(trayList.querySelectorAll('.word-card'));
    var index = cards.indexOf(card);
    if (index < 0) return;
    var step = event.key === 'ArrowRight' ? 1 : cards.length - 1;
    cards[(index + step) % cards.length].focus({ preventScroll: true });
  });

  chestStage.addEventListener('click', function (event) {
    if (!event.target.closest) return;
    if (event.target.closest('[data-action="open-chest"]')) openChest();
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

  dexElement.addEventListener('click', function (event) {
    var cell = event.target.closest ? event.target.closest('[data-combo]') : null;
    if (!cell) return;
    applyCombo(cell.getAttribute('data-combo'));
  });

  document.querySelectorAll('[data-sheet]').forEach(function (button) {
    button.addEventListener('click', function () {
      openSheet(button.getAttribute('data-sheet'), button);
    });
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

  document.addEventListener('keydown', function (event) {
    trapSheetTab(event);
    // 箱子是模态：Tab 不许跑到暗场后面去，Esc 与回车等价，都算亲手开箱
    if (!chestStage.hidden) {
      if (event.key === 'Tab') {
        event.preventDefault();
        var chestNode = chestDock.querySelector('.chest');
        if (chestNode) chestNode.focus({ preventScroll: true });
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        openChest();
        return;
      }
    }
    if (event.key !== 'Escape') return;
    if (!sheetElement.hidden) {
      closeSheet();
    }
  });

  // 光标波纹：任何可点的东西按下就在指针处亮一下
  document.addEventListener(
    'pointerdown',
    function (event) {
      if (!event.target.closest) return;
      if (!event.target.closest('.slot,.word-card,.chip-btn,.chest,.dex-cell,.link-button')) return;
      rippleAt(event.clientX, event.clientY);
    },
    { passive: true }
  );

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
    soundToggle.setAttribute('title', state.soundOn ? '音效已开，再点一下静音' : '音效默认关闭，打开后只在操作时响');
    if (state.soundOn) playTone(660, 0.08, 'sine');
  });

  updateSentence();
  updateSlotClasses();
  renderTray();
  renderHud();
  var initial = game.resolve(data, demoData, state.values);
  paintVerdict(initial);
  renderChest(initial);
  renderReview();
  renderCoverage();
})();
