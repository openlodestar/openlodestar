// docs/assets/demo-sort.js
/**
 * 证据分拣 · 玩法层（零依赖、无模块、无网络、无存档）
 *
 * 这一页只做三件事：发牌、按动作结算、把每条说法的真实判据摆出来。
 * **判定不在这里**：每条说法属于哪种状态，是构建时由引擎的维度函数算好、写进
 * `demo-sort-data.js` 的。本文件只查表，不改判、不放宽。
 *
 * 结算表全部来自数据里的 scoring：
 *   收下「完全对上」= 10 × 倍率；放走它 = 漏判（0 分、连击归零）
 *   收下相容/边缘 = 小分，连击冻结；放走 = 小分，连击 +1
 *   收下冲突/没对上 = 掉一颗心、连击归零；放走 = 小分，连击 +1
 *   超时 = 当作放走，但 0 分且连击归零
 */
(function () {
  'use strict';

  var DATA = window.LODESTAR_SORT;
  if (!DATA || !DATA.rounds || !DATA.rounds.length) return;

  var R = DATA.scoring;
  var CHIP_MS = [3200, 2800];
  var SWIPE = 34;
  var reduceQuery =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');

  function reduced() {
    return !!(reduceQuery && reduceQuery.matches);
  }

  function multiplierOf(combo) {
    var m = R.multiplier;
    return Math.min(m.cap, 1 + Math.floor(combo / m.per) * m.step);
  }

  /** 收下这一档时，除了状态名还要说的半句话（状态名本身不重复） */
  var ACCEPT_TEXT = {
    caliber: '只算旁证',
    edge: '不能当支撑',
    conflict: '它指向别的值',
    mismatch: '写的不是这个',
    unknown: '判不了',
  };

  /**
   * 一条说法 + 一个动作 = 这一拍的结果。
   * 纯函数：传入当前的连击数，同一个 (chip, action, combo) 永远是同一个结果，
   * 页面随时能重算给玩家看，测试也能逐条复算。
   */
  function outcomeOf(chip, action, combo) {
    var meta = DATA.states[chip.state];
    var mult = multiplierOf(combo);
    if (action === 'timeout') {
      return {
        points: 0,
        combo: 'reset',
        life: 0,
        tone: meta.tone,
        text: meta.label + ' · 超时，连击断',
        verdict: 'timeout',
      };
    }
    if (action === 'accept') {
      if (chip.state === 'exact') {
        return {
          points: Math.round(R.hitBase * mult),
          combo: 'up',
          life: 0,
          tone: 'hit',
          text: meta.label + ' · 命中 +' + Math.round(R.hitBase * mult),
          verdict: 'hit',
        };
      }
      var points = R.accept[chip.state];
      var life = R.acceptLife[chip.state];
      var mode = R.acceptCombo[chip.state];
      var parts = [meta.label + ' · ' + ACCEPT_TEXT[chip.state]];
      if (points > 0) parts.push('+' + points);
      if (life < 0) parts.push('掉一颗心');
      if (mode === 'freeze') parts.push('连击冻结');
      if (mode === 'reset') parts.push('连击断');
      return {
        points: points,
        combo: mode,
        life: life,
        tone: life < 0 ? 'mismatch' : meta.tone,
        text: parts.join(' · '),
        verdict: life < 0 ? 'harm' : 'side',
      };
    }
    // 放走
    if (chip.state === 'exact') {
      return {
        points: 0,
        combo: 'reset',
        life: 0,
        tone: 'mismatch',
        text: meta.label + ' · 漏判，连击断',
        verdict: 'miss',
      };
    }
    return {
      points: R.reject[chip.state],
      combo: 'up',
      life: 0,
      tone: 'hit',
      text: meta.label + ' · 放走 +' + R.reject[chip.state],
      verdict: 'drop',
    };
  }

  /** 结算的累加规则：分数、连击、心，三样都只在这里改 */
  function applyOutcome(score, combo, lives, result) {
    return {
      score: Math.max(0, score + result.points),
      combo:
        result.combo === 'up' ? combo + 1 : result.combo === 'reset' ? 0 : combo,
      lives: Math.max(0, lives + result.life),
    };
  }

  var SORT = {
    phase: 'idle',
    roundIndex: 0,
    chipIndex: 0,
    score: 0,
    combo: 0,
    lives: R.lives,
    maxCombo: 0,
    hits: 0,
    log: [],
    locked: false,
    deadline: 0,
    duration: 0,
    remaining: 0,
    raf: 0,
    startedAt: 0,
    endedAt: 0,
    chip: null,
    drag: null,
  };

  var dom = {
    score: document.getElementById('score'),
    mult: document.getElementById('combo-mult'),
    comboCount: document.getElementById('combo-count'),
    comboFill: document.getElementById('combo-fill'),
    hearts: document.getElementById('hearts'),
    roundTag: document.getElementById('round-tag'),
    lot: document.getElementById('lot'),
    stage: document.getElementById('stage'),
    chip: document.getElementById('chip'),
    chipSlot: document.getElementById('chip-slot'),
    chipClaim: document.getElementById('chip-claim'),
    chipValue: document.getElementById('chip-value'),
    chipTag: document.getElementById('chip-tag'),
    timerFill: document.getElementById('timer-fill'),
    timerNum: document.getElementById('timer-num'),
    comboTrack: document.getElementById('combo-fill').parentNode,
    verdict: document.getElementById('verdict-line'),
    fx: document.getElementById('fx'),
    accept: document.getElementById('btn-accept'),
    reject: document.getElementById('btn-reject'),
    start: document.getElementById('start'),
    startBtn: document.getElementById('btn-start'),
    rulesText: document.getElementById('rules-text'),
    rulesBody: document.getElementById('rules-body'),
    result: document.getElementById('result'),
    grade: document.getElementById('grade'),
    gradeLabel: document.getElementById('grade-label'),
    finalScore: document.getElementById('final-score'),
    perfectScore: document.getElementById('perfect-score'),
    resultStats: document.getElementById('result-stats'),
    reviewBody: document.getElementById('review-body'),
    again: document.getElementById('btn-again'),
  };

  var SLOT_IDS = ['auctionHouse', 'dateText', 'sessionName'];

  function round() {
    return DATA.rounds[SORT.roundIndex];
  }

  function currentChip() {
    var r = round();
    return r ? r.chips[SORT.chipIndex] : null;
  }

  function now() {
    return window.performance && window.performance.now
      ? window.performance.now()
      : Date.now();
  }

  // ---- 渲染 ----

  function renderHud(bump) {
    dom.score.textContent = String(SORT.score);
    var mult = multiplierOf(SORT.combo);
    dom.mult.textContent = '×' + mult.toFixed(1);
    dom.comboCount.textContent = '连击 ' + SORT.combo;
    dom.comboFill.style.width = Math.min(100, (SORT.combo / (R.multiplier.per * 4)) * 100) + '%';
    dom.mult.classList.toggle('is-hot', mult >= 2);
    var heartNodes = dom.hearts.children;
    for (var i = 0; i < heartNodes.length; i += 1) {
      heartNodes[i].classList.toggle('is-lost', i >= SORT.lives);
    }
    dom.hearts.setAttribute(
      'aria-label',
      SORT.lives > 0 ? '还剩 ' + SORT.lives + ' 颗心' : '心已掉光',
    );
    if (bump) {
      dom.score.classList.remove('is-bump');
      void dom.score.offsetWidth;
      dom.score.classList.add('is-bump');
    }
  }

  function renderRoundTag() {
    var r = round();
    dom.roundTag.textContent =
      '第 ' + (SORT.roundIndex + 1) + '/' + DATA.rounds.length + ' 件 · ' +
      (SORT.chipIndex + 1) + '/' + r.chips.length;
  }

  function renderLot() {
    var r = round();
    for (var i = 0; i < SLOT_IDS.length; i += 1) {
      var key = SLOT_IDS[i];
      document.getElementById('lot-' + key).textContent = r.lot.values[key];
      document.getElementById('row-' + key).classList.remove('is-hit', 'is-miss');
    }
  }

  function renderChip() {
    var chip = currentChip();
    var r = round();
    SORT.chip = chip;
    dom.chipSlot.textContent = chip.short;
    dom.chipClaim.textContent = r.lot.values[chip.slot];
    dom.chipValue.textContent = chip.value;
    dom.chipTag.hidden = !chip.demoOnly;
    dom.chip.style.transition = 'none';
    dom.chip.style.transform = 'translateY(0)';
    dom.chip.style.opacity = '1';
    dom.chip.classList.remove('is-dragging', 'is-settling');
    if (!reduced()) {
      dom.chip.classList.remove('is-entering');
      void dom.chip.offsetWidth;
      dom.chip.classList.add('is-entering');
    }
    dom.chip.setAttribute(
      'aria-label',
      '本件' + chip.slotLabel + '是' + r.lot.values[chip.slot] +
        '，这条说法是' + chip.value + (chip.demoOnly ? '（演示用词）' : ''),
    );
  }

  function setVerdict(text, tone) {
    dom.verdict.textContent = text;
    dom.verdict.className = 'verdict-line' + (tone ? ' tone-' + tone : '');
  }

  // ---- 特效 ----

  function pulse(node, className) {
    if (!node || reduced()) return;
    node.classList.remove(className);
    void node.offsetWidth;
    node.classList.add(className);
    window.setTimeout(function () {
      node.classList.remove(className);
    }, 520);
  }

  function floatText(text, color) {
    if (reduced()) return;
    var chipRect = dom.chip.getBoundingClientRect();
    var stageRect = dom.stage.getBoundingClientRect();
    var node = document.createElement('span');
    node.className = 'fx-float';
    node.textContent = text;
    node.style.color = color || '#E9C46A';
    node.style.left = chipRect.left - stageRect.left + chipRect.width / 2 + 'px';
    node.style.top = chipRect.top - stageRect.top - 26 + 'px';
    dom.fx.appendChild(node);
    window.setTimeout(function () {
      if (node.parentNode) node.parentNode.removeChild(node);
    }, 640);
  }

  function particles(color) {
    if (reduced()) return;
    var chipRect = dom.chip.getBoundingClientRect();
    var stageRect = dom.stage.getBoundingClientRect();
    var cx = chipRect.left - stageRect.left + chipRect.width / 2;
    var cy = chipRect.top - stageRect.top + chipRect.height / 2;
    for (var i = 0; i < 12; i += 1) {
      var angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.3;
      var distance = 46 + Math.random() * 34;
      var node = document.createElement('span');
      node.className = 'fx-spark';
      node.style.left = cx + 'px';
      node.style.top = cy + 'px';
      node.style.background = color;
      node.style.setProperty('--dx', Math.cos(angle) * distance + 'px');
      node.style.setProperty('--dy', Math.sin(angle) * distance + 'px');
      dom.fx.appendChild(node);
      window.setTimeout(function (n) {
        return function () {
          if (n.parentNode) n.parentNode.removeChild(n);
        };
      }(node), 560);
    }
  }

  function ring(color) {
    if (reduced()) return;
    var chipRect = dom.chip.getBoundingClientRect();
    var stageRect = dom.stage.getBoundingClientRect();
    var node = document.createElement('span');
    node.className = 'fx-burst';
    node.style.borderColor = color;
    node.style.left = chipRect.left - stageRect.left + chipRect.width / 2 + 'px';
    node.style.top = chipRect.top - stageRect.top + chipRect.height / 2 + 'px';
    node.style.width = node.style.height = '90px';
    dom.fx.appendChild(node);
    window.setTimeout(function () {
      if (node.parentNode) node.parentNode.removeChild(node);
    }, 460);
  }

  function damageFlash() {
    if (reduced()) return;
    var node = document.createElement('div');
    node.className = 'fx-vignette';
    document.body.appendChild(node);
    window.setTimeout(function () {
      if (node.parentNode) node.parentNode.removeChild(node);
    }, 520);
  }

  var TONE_COLOR = {
    hit: '#46C98A',
    caliber: '#6FA8DC',
    edge: '#93AEBB',
    conflict: '#E4A93F',
    mismatch: '#E2705F',
    unknown: '#9AA0AA',
  };

  // ---- 计时 ----

  function stopTimer() {
    if (SORT.raf) {
      window.cancelAnimationFrame(SORT.raf);
      SORT.raf = 0;
    }
  }

  function armTimer(ms) {
    SORT.duration = ms;
    SORT.remaining = ms;
    SORT.deadline = now() + ms;
    stopTimer();
    tick();
  }

  function tick() {
    if (SORT.phase !== 'playing' || SORT.locked) return;
    var left = SORT.deadline - now();
    SORT.remaining = Math.max(0, left);
    var ratio = SORT.duration > 0 ? SORT.remaining / SORT.duration : 0;
    var low = ratio < 0.34;
    dom.timerFill.style.width = (ratio * 100).toFixed(1) + '%';
    dom.timerFill.classList.toggle('is-low', low);
    var label = (SORT.remaining / 1000).toFixed(1);
    if (dom.timerNum.textContent !== label) dom.timerNum.textContent = label;
    dom.timerNum.classList.toggle('is-low', low);
    if (left <= 0) {
      decide('timeout');
      return;
    }
    SORT.raf = window.requestAnimationFrame(tick);
  }

  // ---- 一拍的结算 ----

  function decide(action) {
    if (SORT.phase !== 'playing' || SORT.locked) return;
    var chip = SORT.chip;
    if (!chip) return;
    SORT.locked = true;
    stopTimer();
    dom.timerFill.style.width = '0%';
    dom.timerNum.textContent = '0.0';
    dom.timerFill.classList.remove('is-low');
    dom.timerNum.classList.remove('is-low');

    var result = outcomeOf(chip, action, SORT.combo);
    // 先落账、再表演：动画只挂在结果上，减少动效时行为完全一样
    var next = applyOutcome(SORT.score, SORT.combo, SORT.lives, result);
    SORT.score = next.score;
    if (result.combo === 'up') SORT.maxCombo = Math.max(SORT.maxCombo, next.combo);
    SORT.combo = next.combo;
    SORT.lives = next.lives;
    if (result.verdict === 'hit') SORT.hits += 1;
    SORT.log.push({
      index: SORT.log.length + 1,
      round: SORT.roundIndex + 1,
      slot: chip.slot,
      slotLabel: chip.slotLabel,
      short: chip.short,
      value: chip.value,
      state: chip.state,
      note: chip.note,
      action: action,
      points: result.points,
      life: result.life,
      comboAfter: SORT.combo,
    });

    if (chip.state === 'exact' && action === 'accept') {
      document.getElementById('row-' + chip.slot).classList.add('is-hit');
    }
    if (result.life < 0) {
      dom.lot.classList.remove('is-harm');
      void dom.lot.offsetWidth;
      dom.lot.classList.add('is-harm');
      window.setTimeout(function () {
        dom.lot.classList.remove('is-harm');
      }, 520);
    }
    if (result.combo === 'freeze') pulse(dom.comboTrack, 'is-frozen');
    if (result.combo === 'reset' && action !== 'timeout') pulse(dom.comboTrack, 'is-broken');

    renderHud(result.points > 0);
    setVerdict(result.text, result.tone);

    var color = TONE_COLOR[result.tone] || '#E9C46A';
    if (result.verdict === 'hit') {
      particles(color);
      ring(color);
      floatText('+' + result.points, color);
    } else if (result.verdict === 'harm') {
      damageFlash();
      floatText('−1 ♥', '#E2705F');
    } else if (result.points > 0) {
      floatText('+' + result.points, color);
    }

    if (!reduced()) {
      if (action === 'accept') {
        dom.chip.style.transition = 'transform .18s ease-in, opacity .18s ease-in';
        dom.chip.style.transform = 'translateY(-64px) scale(.92)';
      } else {
        dom.chip.style.transition = 'transform .18s ease-in, opacity .18s ease-in';
        dom.chip.style.transform = 'translateY(' + (action === 'timeout' ? 26 : 84) + 'px)';
      }
      dom.chip.style.opacity = '0';
    }

    window.setTimeout(nextBeat, reduced() ? 90 : 300);
  }

  function nextBeat() {
    SORT.locked = false;
    if (SORT.lives <= 0) {
      finish('心掉光了');
      return;
    }
    var r = round();
    SORT.chipIndex += 1;
    if (SORT.chipIndex >= r.chips.length) {
      if (SORT.roundIndex + 1 >= DATA.rounds.length) {
        finish(null);
        return;
      }
      SORT.roundIndex += 1;
      SORT.chipIndex = 0;
      renderLot();
      renderRoundTag();
      setVerdict('换一件', 'hit');
    } else {
      renderRoundTag();
      setVerdict('', '');
    }
    renderChip();
    armTimer(CHIP_MS[Math.min(SORT.roundIndex, CHIP_MS.length - 1)]);
  }

  // ---- 开始与结束 ----

  function startGame() {
    if (SORT.phase === 'playing') return;
    SORT.phase = 'playing';
    SORT.roundIndex = 0;
    SORT.chipIndex = 0;
    SORT.score = 0;
    SORT.combo = 0;
    SORT.lives = R.lives;
    SORT.maxCombo = 0;
    SORT.hits = 0;
    SORT.log = [];
    SORT.locked = false;
    SORT.chip = null;
    SORT.startedAt = now();
    dom.start.hidden = true;
    dom.result.hidden = true;
    dom.accept.disabled = false;
    dom.reject.disabled = false;
    renderLot();
    renderRoundTag();
    renderHud(false);
    setVerdict('', '');
    renderChip();
    armTimer(CHIP_MS[0]);
  }

  function finish(reason) {
    SORT.phase = 'over';
    stopTimer();
    SORT.endedAt = now();
    dom.accept.disabled = true;
    dom.reject.disabled = true;
    dom.chip.style.opacity = '0';
    renderResult(reason);
    dom.result.hidden = false;
    dom.again.focus({ preventScroll: true });
  }

  function gradeOf(score) {
    for (var i = 0; i < DATA.grades.length; i += 1) {
      if (score >= DATA.grades[i].min) return DATA.grades[i];
    }
    return DATA.grades[DATA.grades.length - 1];
  }

  function renderResult(reason) {
    var grade = gradeOf(SORT.score);
    dom.grade.textContent = grade.grade;
    dom.gradeLabel.textContent = reason ? reason + ' · ' + grade.label : grade.label;
    dom.finalScore.textContent = String(SORT.score);
    dom.perfectScore.textContent = String(DATA.perfectScore);
    var seconds = Math.max(1, Math.round((SORT.endedAt - SORT.startedAt) / 1000));
    var used = {};
    for (var i = 0; i < SORT.log.length; i += 1) {
      used[SORT.log[i].state] = (used[SORT.log[i].state] || 0) + 1;
    }
    var stats = [
      '命中 <b>' + SORT.hits + '</b>',
      '最高连击 <b>' + SORT.maxCombo + '</b>',
      '用时 <b>' + seconds + 's</b>',
    ];
    var order = ['exact', 'caliber', 'edge', 'conflict', 'mismatch', 'unknown'];
    for (var k = 0; k < order.length; k += 1) {
      var state = order[k];
      stats.push(DATA.states[state].label + ' <b>' + (used[state] || 0) + '</b>');
    }
    dom.resultStats.innerHTML = stats
      .map(function (text) {
        return '<li>' + text + '</li>';
      })
      .join('');

    var rows = SORT.log
      .map(function (item) {
        var meta = DATA.states[item.state];
        var good = (item.state === 'exact' && item.action === 'accept') ||
          (item.state !== 'exact' && item.action === 'reject');
        var cls = item.life < 0 || (item.state === 'exact' && item.action !== 'accept')
          ? 'is-bad'
          : good ? 'is-good' : '';
        var actText = item.action === 'accept' ? '收下' : item.action === 'timeout' ? '超时' : '放走';
        var score = item.points > 0 ? '+' + item.points : item.life < 0 ? '−1♥' : '0';
        return (
          '<li class="' + cls + '">' +
          '<p class="rev-val"><span class="rev-idx">' + item.index + '</span>' +
          '<span class="rev-slot">' + item.short + '</span>' + escapeHtml(item.value) + '</p>' +
          '<p class="rev-meta"><span class="rev-state" style="color:' + TONE_COLOR[meta.tone] + '">' +
          meta.label + '</span>' + escapeHtml(item.note) + '</p>' +
          '<p class="rev-act">' + actText + ' <b>' + score + '</b></p>' +
          '</li>'
        );
      })
      .join('');
    dom.reviewBody.innerHTML = rows;
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---- 启动说明里的分值表（与 scoring 同一份数据，不另写一套） ----

  function renderRules() {
    dom.rulesText.textContent = R.note;
    var order = ['exact', 'caliber', 'edge', 'conflict', 'mismatch', 'unknown'];
    dom.rulesBody.innerHTML = order
      .map(function (state) {
        var meta = DATA.states[state];
        var accept =
          state === 'exact'
            ? R.hitBase + '×倍率，连击+1'
            : (R.accept[state] > 0 ? '+' + R.accept[state] : '0') +
              (R.acceptLife[state] < 0 ? '，−1♥' : '') +
              (R.acceptCombo[state] === 'freeze'
                ? '，连击冻结'
                : R.acceptCombo[state] === 'reset' ? '，连击断' : '');
        var reject =
          state === 'exact'
            ? '0，连击断'
            : '+' + R.reject[state] + '，连击+1';
        return (
          '<tr><td style="color:' + TONE_COLOR[meta.tone] + '">' + meta.label + '</td>' +
          '<td>' + accept + '</td><td>' + reject + '</td></tr>'
        );
      })
      .join('');
  }

  // ---- 输入：指针（触屏/鼠标）、键盘、按钮 ----

  function onChipPointerDown(event) {
    if (SORT.phase !== 'playing' || SORT.locked) return;
    if (event.button !== undefined && event.button !== 0) return;
    SORT.drag = { id: event.pointerId, startY: event.clientY, dy: 0 };
    dom.chip.classList.remove('is-settling');
    dom.chip.classList.add('is-dragging');
    if (dom.chip.setPointerCapture) {
      try {
        dom.chip.setPointerCapture(event.pointerId);
      } catch (error) {
        /* 某些浏览器在合成事件上会抛，忽略即可：不影响按钮与键盘路径 */
      }
    }
  }

  function onChipPointerMove(event) {
    if (!SORT.drag || SORT.drag.id !== event.pointerId) return;
    SORT.drag.dy = event.clientY - SORT.drag.startY;
    dom.chip.style.transition = 'none';
    dom.chip.style.transform = 'translateY(' + SORT.drag.dy + 'px)';
  }

  function onChipPointerUp(event) {
    if (!SORT.drag || SORT.drag.id !== event.pointerId) return;
    var dy = SORT.drag.dy;
    SORT.drag = null;
    dom.chip.classList.remove('is-dragging');
    if (SORT.phase !== 'playing' || SORT.locked) return;
    if (dy <= -SWIPE) {
      decide('accept');
      return;
    }
    if (dy >= SWIPE) {
      decide('reject');
      return;
    }
    dom.chip.classList.add('is-settling');
    dom.chip.style.transform = 'translateY(0)';
  }

  function onKeyDown(event) {
    if (event.defaultPrevented) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    var key = event.key;
    if (key === 'ArrowUp' || key === 'w' || key === 'W') {
      event.preventDefault();
      if (SORT.phase === 'playing') decide('accept');
      return;
    }
    if (key === 'ArrowDown' || key === 's' || key === 'S') {
      event.preventDefault();
      if (SORT.phase === 'playing') decide('reject');
      return;
    }
    if (key === ' ' || key === 'Enter') {
      if (SORT.phase === 'playing') return;
      event.preventDefault();
      startGame();
    }
  }

  function onVisibility() {
    if (document.hidden) {
      if (SORT.phase === 'playing' && !SORT.locked) {
        SORT.remaining = Math.max(0, SORT.deadline - now());
        stopTimer();
      }
      return;
    }
    if (SORT.phase === 'playing' && !SORT.locked && !SORT.raf) {
      SORT.deadline = now() + SORT.remaining;
      tick();
    }
  }

  // ---- 绑定 ----

  dom.chip.addEventListener('pointerdown', onChipPointerDown);
  dom.chip.addEventListener('pointermove', onChipPointerMove);
  dom.chip.addEventListener('pointerup', onChipPointerUp);
  dom.chip.addEventListener('pointercancel', onChipPointerUp);
  dom.accept.addEventListener('click', function () {
    decide('accept');
  });
  dom.reject.addEventListener('click', function () {
    decide('reject');
  });
  dom.startBtn.addEventListener('click', startGame);
  dom.again.addEventListener('click', startGame);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('visibilitychange', onVisibility);

  renderRules();
  renderHud(false);

  // 供一致性测试核对：规则表与结算函数是页面真正在用的那一份
  window.LODESTAR_SORT_RULES = {
    multiplierOf: multiplierOf,
    outcomeOf: outcomeOf,
    applyOutcome: applyOutcome,
    chipMs: CHIP_MS,
    state: function () {
      return {
        phase: SORT.phase,
        score: SORT.score,
        combo: SORT.combo,
        lives: SORT.lives,
        roundIndex: SORT.roundIndex,
        chipIndex: SORT.chipIndex,
        log: SORT.log.slice(),
      };
    },
  };
}());
