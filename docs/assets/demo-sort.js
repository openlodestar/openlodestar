// docs/assets/demo-sort.js
/**
 * 证据分拣 · 玩法层（零依赖、无模块、无网络、无存档）
 *
 * 这一页只做三件事：发牌、按动作结算、把每条说法的真实判据摆出来。
 * **判定不在这里**：每条说法属于哪种状态，是构建时由引擎的维度函数算好、写进
 * `demo-sort-data.js` 的。本文件只查表，不改判、不放宽。
 *
 * 结算表全部来自数据里的 scoring：
 *   收下「完全对上」= 10 × 倍率（倍率只看连续命中：连击 0 是 ×1、1 是 ×2、2 起 ×3）
 *   收下相容/边缘 = 固定分，但连击归零（中段收会打断冲锋）
 *   每件器物的最后三拍不发命中，这三拍收旁证分值翻倍（兑现窗口）
 *   收下冲突/没对上 = 掉一颗心、连击归零；放走 = +1
 *   超时 = 0 分且连击归零；换下一件器物时连击清零
 *
 * 题库不是一副牌：`DATA.runs` 里有若干「内容不同」的牌局，每局抽一个，
 * 且排除最近两局——连打三局不会撞回同一副牌。
 */
(function () {
  'use strict';

  var DATA = window.LODESTAR_SORT;

  function runList() {
    if (!DATA) return [];
    if (DATA.runs && DATA.runs.length) return DATA.runs;
    // 只有一副牌的旧数据结构也照样能跑（不为了兼容而写分支逻辑，只兜这一处）
    return DATA.rounds ? [{ id: 'run-legacy', label: '', rounds: DATA.rounds, orders: DATA.orders }] : [];
  }

  var RUNS = runList();
  if (!RUNS.length) return;

  var R = DATA.scoring;
  /** 每拍给的时间：第一件 2.6 秒、第二件 2.3 秒（上一版 3.2/2.8 太宽，变成「看完就按」） */
  var CHIP_MS = [2600, 2300];
  var SWIPE = 34;
  /** 判定文字至少停留这么久，再发下一张牌（读得完一行再走） */
  var VERDICT_MS = 1200;
  var VERDICT_MS_REDUCED = 900;
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

  function isSideState(state) {
    return state === 'caliber' || state === 'edge';
  }

  /**
   * 一条说法 + 一个动作 = 这一拍的结果。
   * 纯函数：传入当前连击与「是否在兑现窗口里」，同一组输入永远是同一个结果，
   * 页面随时能重算给玩家看，测试也能逐条复算。
   */
  function outcomeOf(chip, action, combo, inWindow) {
    var meta = DATA.states[chip.state];
    var mult = multiplierOf(combo);
    if (action === 'timeout') {
      return {
        points: R.timeoutPoints,
        combo: 'reset',
        life: 0,
        tone: 'timeout',
        text: '超时 · 这一拍没判，连击断',
        verdict: 'timeout',
      };
    }
    if (action === 'accept') {
      if (chip.state === 'exact') {
        var hit = Math.round(R.hitBase * mult);
        return {
          points: hit,
          combo: 'up',
          life: 0,
          tone: 'hit',
          text: '完全对上 · 命中 +' + hit + '（×' + mult + '）',
          verdict: 'hit',
        };
      }
      var base = R.accept[chip.state];
      var doubled = !!(inWindow && isSideState(chip.state));
      var points = doubled ? base * R.windowBonus.multiplier : base;
      var life = R.acceptLife[chip.state];
      var mode = R.acceptCombo[chip.state];
      var parts = [meta.label + ' · ' + ACCEPT_TEXT[chip.state]];
      if (points > 0) parts.push('+' + points + (doubled ? '（窗口翻倍）' : ''));
      if (life < 0) parts.push('掉一颗心');
      if (mode === 'reset') parts.push('连击断');
      return {
        points: points,
        combo: mode,
        life: life,
        tone: life < 0 ? 'mismatch' : meta.tone,
        text: parts.join(' · '),
        verdict: life < 0 ? 'harm' : points > 0 ? 'side' : 'flat',
      };
    }
    // 放走
    if (chip.state === 'exact') {
      return {
        points: 0,
        combo: 'reset',
        life: 0,
        tone: 'mismatch',
        text: '漏判了 · 完全对上却放走，连击断',
        verdict: 'miss',
      };
    }
    var gain = R.reject[chip.state];
    var dropParts = [meta.label + ' · 放走'];
    if (gain > 0) dropParts.push('+' + gain);
    if (isSideState(chip.state)) {
      dropParts.push(
        inWindow
          ? '窗口里白丢 +' + R.accept[chip.state] * R.windowBonus.multiplier
          : '现在收不影响倍率',
      );
    }
    return {
      points: gain,
      combo: 'keep',
      life: 0,
      tone: meta.tone,
      text: dropParts.join(' · '),
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
    run: null,
    rounds: [],
    orders: [],
    order: null,
    sequence: [0, 1],
    roundIndex: 0,
    chipIndex: 0,
    score: 0,
    combo: 0,
    lives: R.lives,
    maxCombo: 0,
    hits: 0,
    misses: 0,
    timeouts: 0,
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
    lastOrder: '',
    recentRuns: [],
  };

  var dom = {
    score: document.getElementById('score'),
    mult: document.getElementById('combo-mult'),
    comboCount: document.getElementById('combo-count'),
    comboFill: document.getElementById('combo-fill'),
    hearts: document.getElementById('hearts'),
    roundTag: document.getElementById('round-tag'),
    beatDots: document.getElementById('beat-dots'),
    switchNote: document.getElementById('switch-note'),
    lot: document.getElementById('lot'),
    stage: document.getElementById('stage'),
    chip: document.getElementById('chip'),
    chipSlot: document.getElementById('chip-slot'),
    chipClaim: document.getElementById('chip-claim'),
    chipValue: document.getElementById('chip-value'),
    chipTag: document.getElementById('chip-tag'),
    timerFill: document.getElementById('timer-fill'),
    timerNum: document.getElementById('timer-num'),
    timerRow: document.getElementById('timer-row'),
    comboTrack: document.getElementById('combo-fill').parentNode,
    verdict: document.getElementById('verdict-line'),
    verdictLabel: document.getElementById('verdict-label'),
    verdictText: document.getElementById('verdict-text'),
    waitBar: document.getElementById('wait-bar'),
    waitFill: document.getElementById('wait-fill'),
    fx: document.getElementById('fx'),
    accept: document.getElementById('btn-accept'),
    reject: document.getElementById('btn-reject'),
    start: document.getElementById('start'),
    startBtn: document.getElementById('btn-start'),
    startScroll: document.getElementById('start-scroll'),
    startScrollHint: document.getElementById('start-scroll-hint'),
    startDetails: document.getElementById('start-details'),
    rulesText: document.getElementById('rules-text'),
    rulesBody: document.getElementById('rules-body'),
    result: document.getElementById('result'),
    grade: document.getElementById('grade'),
    gradeLabel: document.getElementById('grade-label'),
    finalScore: document.getElementById('final-score'),
    perfectScore: document.getElementById('perfect-score'),
    resultStats: document.getElementById('result-stats'),
    orderNote: document.getElementById('order-note'),
    reviewWrap: document.getElementById('review-wrap'),
    reviewSummary: document.getElementById('review-summary'),
    reviewToggle: document.getElementById('review-toggle'),
    reviewBody: document.getElementById('review-body'),
    again: document.getElementById('btn-again'),
  };

  var SLOT_IDS = ['auctionHouse', 'dateText', 'sessionName'];

  function round() {
    return SORT.rounds[SORT.sequence[SORT.roundIndex]];
  }

  function orderOfRound() {
    return SORT.order.rounds[SORT.roundIndex];
  }

  /** 当前这一拍在「牌面数组」里的位置（牌序只改先后，不改牌面） */
  function chipIndexOfBeat() {
    return orderOfRound()[SORT.chipIndex];
  }

  function currentChip() {
    var r = round();
    if (!r) return null;
    var index = chipIndexOfBeat();
    return index === undefined ? null : r.chips[index];
  }

  function inWindow() {
    var r = round();
    return !!r && SORT.chipIndex >= r.settleFrom;
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
    dom.mult.textContent = '×' + mult;
    dom.comboCount.textContent = '连击 ' + SORT.combo;
    dom.comboFill.style.width = Math.min(100, (SORT.combo / 3) * 100) + '%';
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
    var beat = SORT.chipIndex + 1;
    var total = r.chips.length;
    var windowBeat = inWindow();
    dom.roundTag.textContent =
      '第 ' + (SORT.roundIndex + 1) + '/' + SORT.rounds.length + ' 件 · ' +
      '第 ' + beat + '/' + total + ' 拍' +
      (windowBeat ? ' · 收尾窗口：现在收相容不亏倍率' : '');
    dom.roundTag.classList.toggle('is-window', windowBeat);
    renderDots(total);
  }

  /** 本件的十拍进度点：当前拍高亮，最后三拍（兑现窗口）描金边 */
  function renderDots(total) {
    if (!dom.beatDots) return;
    var html = '';
    for (var i = 0; i < total; i += 1) {
      var cls = 'beat-dot';
      if (i === SORT.chipIndex) cls += ' is-now';
      else if (i < SORT.chipIndex) cls += ' is-done';
      if (i >= total - R.settleBeats) cls += ' is-window';
      html += '<i class="' + cls + '"></i>';
    }
    dom.beatDots.innerHTML = html;
    dom.beatDots.setAttribute(
      'aria-label',
      '本件第 ' + (SORT.chipIndex + 1) + ' 拍，共 ' + total + ' 拍，最后 ' + R.settleBeats + ' 拍是兑现窗口',
    );
  }

  function renderLot() {
    var r = round();
    for (var i = 0; i < SLOT_IDS.length; i += 1) {
      var key = SLOT_IDS[i];
      document.getElementById('lot-' + key).textContent = r.lot.values[key];
      document.getElementById('row-' + key).classList.remove('is-hit', 'is-miss');
    }
  }

  function clearDecided() {
    dom.chip.classList.remove('is-decided');
    dom.chip.className = 'chip';
    dom.verdict.className = 'verdict-line';
    dom.verdictLabel.textContent = '';
    dom.verdictText.textContent = '上甩收下 · 下甩放走';
    dom.waitFill.style.width = '0%';
    dom.waitFill.style.transition = 'none';
  }

  function renderChip() {
    var chip = currentChip();
    var r = round();
    SORT.chip = chip;
    if (!chip) return;
    clearDecided();
    dom.chipSlot.textContent = chip.short;
    dom.chipClaim.textContent = r.lot.values[chip.slot];
    dom.chipValue.textContent = chip.value;
    dom.chipTag.hidden = !chip.demoOnly;
    dom.chip.style.transition = 'none';
    dom.chip.style.transform = 'translateY(0)';
    dom.chip.style.opacity = '1';
    if (!reduced()) {
      dom.chip.classList.remove('is-entering');
      void dom.chip.offsetWidth;
      dom.chip.classList.add('is-entering');
    }
    dom.chip.setAttribute(
      'aria-label',
      '本件' + chip.slotLabel + '是' + r.lot.values[chip.slot] +
        '，这条说法是' + chip.value + (chip.demoOnly ? '（语料外写法）' : ''),
    );
  }

  /** 判定写进牌面自身：牌不长脚走掉，判定行就在同一张卡里 */
  function setVerdict(text, tone) {
    dom.verdictLabel.textContent = text ? '这拍 ·' : '';
    dom.verdictText.textContent = text || '';
    dom.verdict.className = 'verdict-line' + (tone ? ' tone-' + tone : '');
    dom.chip.classList.toggle('is-decided', !!text);
    if (text) dom.chip.classList.add('tone-' + (tone || 'hint'));
  }

  /** 判定停留的这一秒多不是空白：卡片下面一条进度线走完，说明马上发下一拍 */
  function armWaitBar() {
    dom.waitFill.style.transition = 'none';
    dom.waitFill.style.width = '0%';
    void dom.waitFill.offsetWidth;
    var ms = reduced() ? VERDICT_MS_REDUCED : VERDICT_MS;
    dom.waitFill.style.transition = 'width ' + ms + 'ms linear';
    dom.waitFill.style.width = '100%';
  }

  var switchTimer = 0;
  function showSwitchNote() {
    if (!dom.switchNote) return;
    dom.switchNote.textContent = '换下一件 · 连击清零，倍率回到 ×1';
    dom.switchNote.classList.remove('is-in');
    void dom.switchNote.offsetWidth;
    dom.switchNote.classList.add('is-in');
    window.clearTimeout(switchTimer);
    switchTimer = window.setTimeout(function () {
      dom.switchNote.classList.remove('is-in');
      dom.switchNote.textContent = '';
    }, 1900);
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

  function damageFlash() {
    if (reduced()) return;
    var node = document.createElement('div');
    node.className = 'fx-vignette';
    document.body.appendChild(node);
    window.setTimeout(function () {
      if (node.parentNode) node.parentNode.removeChild(node);
    }, 520);
  }

  function shakeChip() {
    if (reduced()) return;
    dom.chip.classList.remove('is-shake');
    void dom.chip.offsetWidth;
    dom.chip.classList.add('is-shake');
    window.setTimeout(function () {
      dom.chip.classList.remove('is-shake');
    }, 320);
  }

  /** 甩得不够 / 点了卡片：立刻给一句否定反馈，计时不停 */
  function refuseFeedback(text) {
    setVerdict(text, 'hint');
    shakeChip();
  }

  var TONE_COLOR = {
    hit: '#46C98A',
    caliber: '#6FA8DC',
    edge: '#93AEBB',
    conflict: '#E4A93F',
    mismatch: '#E2705F',
    unknown: '#9AA0AA',
    timeout: '#E2705F',
    hint: '#E9C46A',
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
    var windowBeat = inWindow();
    var beforeCombo = SORT.combo;
    SORT.locked = true;
    stopTimer();
    dom.timerFill.style.width = action === 'timeout' ? '0%' : dom.timerFill.style.width;
    dom.timerNum.textContent = '0.0';
    dom.timerFill.classList.remove('is-low');
    dom.timerNum.classList.remove('is-low');

    var result = outcomeOf(chip, action, SORT.combo, windowBeat);
    // 先落账、再表演：动画只挂在结果上，减少动效时行为完全一样
    var next = applyOutcome(SORT.score, SORT.combo, SORT.lives, result);
    SORT.score = next.score;
    if (result.combo === 'up') SORT.maxCombo = Math.max(SORT.maxCombo, next.combo);
    SORT.combo = next.combo;
    SORT.lives = next.lives;
    if (result.verdict === 'hit') SORT.hits += 1;
    if (result.verdict === 'miss') SORT.misses += 1;
    if (action === 'timeout') SORT.timeouts += 1;
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
      comboBefore: beforeCombo,
      comboAfter: SORT.combo,
      inWindow: windowBeat,
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
    if (result.combo === 'reset' && action !== 'timeout') pulse(dom.comboTrack, 'is-broken');
    if (action === 'timeout') pulse(dom.timerRow, 'is-timeout');

    renderHud(result.points > 0);
    setVerdict(result.text, result.tone);
    armWaitBar();

    var color = TONE_COLOR[result.tone] || '#E9C46A';
    if (result.verdict === 'hit') {
      particles(color);
      floatText('+' + result.points, color);
      dom.chip.classList.add('is-hit-glow');
    } else if (result.verdict === 'harm') {
      damageFlash();
      floatText('−1 ♥', '#E2705F');
    } else if (result.points > 0) {
      floatText('+' + result.points, color);
    } else if (action === 'timeout') {
      floatText('超时', '#E2705F');
    }

    if (!reduced() && action !== 'timeout') {
      dom.chip.style.transition = 'transform .18s ease-out';
      dom.chip.style.transform = 'translateY(' + (action === 'accept' ? -6 : 6) + 'px) scale(.985)';
    }

    window.setTimeout(nextBeat, reduced() ? VERDICT_MS_REDUCED : VERDICT_MS);
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
      if (SORT.roundIndex + 1 >= SORT.rounds.length) {
        finish(null);
        return;
      }
      SORT.roundIndex += 1;
      SORT.chipIndex = 0;
      SORT.combo = 0;
      renderHud(false);
      renderLot();
      showSwitchNote();
    }
    renderRoundTag();
    renderChip();
    armTimer(CHIP_MS[Math.min(SORT.roundIndex, CHIP_MS.length - 1)]);
  }

  // ---- 开始与结束 ----

  /**
   * 抽一个牌局：排除最近两局，保证连打三局不撞回同一副牌；
   * 牌序与两件器物的先后也避开上一局。
   */
  function pickRun() {
    var candidates = [];
    for (var i = 0; i < RUNS.length; i += 1) {
      if (SORT.recentRuns.indexOf(RUNS[i].id) < 0) candidates.push(RUNS[i]);
    }
    if (!candidates.length) {
      SORT.recentRuns = [];
      candidates = RUNS.slice();
    }
    var run = candidates[Math.floor(Math.random() * candidates.length)];
    SORT.run = run;
    SORT.rounds = run.rounds;
    SORT.orders = run.orders;
    SORT.recentRuns.push(run.id);
    while (SORT.recentRuns.length > 2) SORT.recentRuns.shift();

    var order = SORT.orders[Math.floor(Math.random() * SORT.orders.length)];
    if (SORT.orders.length > 1 && order.id === SORT.lastOrder) {
      order = SORT.orders[(SORT.orders.indexOf(order) + 1) % SORT.orders.length];
    }
    SORT.lastOrder = order.id;
    SORT.order = order;
    SORT.sequence = SORT.rounds.map(function (_, index) { return index; });
    if (SORT.rounds.length > 1 && Math.random() < 0.5) SORT.sequence.reverse();
  }

  function startGame() {
    if (SORT.phase === 'playing') return;
    pickRun();
    SORT.phase = 'playing';
    SORT.roundIndex = 0;
    SORT.chipIndex = 0;
    SORT.score = 0;
    SORT.combo = 0;
    SORT.lives = R.lives;
    SORT.maxCombo = 0;
    SORT.hits = 0;
    SORT.misses = 0;
    SORT.timeouts = 0;
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

  function gradeOf(score, best) {
    for (var i = 0; i < DATA.grades.length; i += 1) {
      if (best > 0 && score >= best * DATA.grades[i].ratio) return DATA.grades[i];
    }
    return DATA.grades[DATA.grades.length - 1];
  }

  /** 这一拍按公开规则该怎么打：收下命中，收尾窗口里收旁证，其余放走 */
  function ruleWants(item) {
    if (item.state === 'exact') return 'accept';
    if (isSideState(item.state)) return item.inWindow ? 'accept' : 'reject';
    return 'reject';
  }

  function isOptimal(item) {
    return item.action === ruleWants(item);
  }

  /**
   * 这一局到底错在哪——只读本局日志，数出来、算出分差，再给一句下次怎么打。
   * 纯函数：同一份日志永远得到同一句话，测试可以直接喂一段日志复算。
   * 不按档位套模板：不管落到哪副牌、哪个等级，说的都是这一局实际犯的错。
   */
  function diagnoseLog(log) {
    var wrong = [];
    var missed = [];
    var windowLost = [];
    var midSide = [];
    var timeouts = 0;
    var windowPts = 0;
    for (var i = 0; i < log.length; i += 1) {
      var item = log[i];
      if (item.action === 'timeout') {
        timeouts += 1;
      } else if (item.action === 'accept') {
        if (item.state === 'conflict' || item.state === 'mismatch') wrong.push(item);
        else if (isSideState(item.state) && !item.inWindow) midSide.push(item);
      } else if (item.state === 'exact') {
        missed.push(item);
      } else if (isSideState(item.state) && item.inWindow) {
        windowLost.push(item);
        windowPts += R.accept[item.state] * R.windowBonus.multiplier;
      }
    }
    var count = wrong.length + missed.length + windowLost.length + midSide.length + timeouts;
    if (!count) {
      return {
        text: '二十拍全按最优解打，没有可再想的。',
        count: 0,
        wrong: 0,
        missed: 0,
        windowLost: 0,
        midSide: 0,
        timeouts: 0,
        windowPts: 0,
      };
    }
    var parts = [];
    if (missed.length) {
      parts.push('放走 ' + missed.length + ' 条完全对上（' + missed[0].value + ' 这类字面一样的要收）');
    }
    if (wrong.length) {
      parts.push('收下 ' + wrong.length + ' 条冲突/没对上，掉了 ' + wrong.length + ' 颗心');
    }
    if (windowLost.length) {
      parts.push('收尾窗口里漏收 ' + windowLost.length + ' 条旁证，少拿 ' + windowPts + ' 分');
    }
    if (midSide.length) {
      parts.push('中段收 ' + midSide.length + ' 条旁证，把连击断了');
    }
    if (timeouts) parts.push('超时 ' + timeouts + ' 拍');
    var advice;
    if (missed.length) advice = '完全一样的直接收，别犹豫。';
    else if (windowLost.length) advice = '最后三拍再看一眼器物卡：旁证这时候收才翻倍。';
    else if (midSide.length) advice = '中段旁证先放走，留到最后三拍。';
    else if (wrong.length) advice = '冲突和没对上指向别的值，收下只会掉心。';
    else advice = '先扫「本件」和「这条」再动手，别拖到超时。';
    return {
      text: '本局' + parts.join('；') + '。' + advice,
      count: count,
      wrong: wrong.length,
      missed: missed.length,
      windowLost: windowLost.length,
      midSide: midSide.length,
      timeouts: timeouts,
      windowPts: windowPts,
    };
  }

  var reviewExpanded = false;

  function renderReview(log) {
    var goodCount = 0;
    for (var i = 0; i < log.length; i += 1) {
      if (isOptimal(log[i])) goodCount += 1;
    }
    var badCount = log.length - goodCount;
    reviewExpanded = badCount === 0;
    if (dom.reviewWrap) {
      dom.reviewWrap.classList.toggle('is-collapsed', badCount > 0);
    }
    if (dom.reviewSummary) {
      dom.reviewSummary.textContent = badCount
        ? '先看 ' + badCount + ' 条可再想想；其余 ' + goodCount + ' 条判对了，已折叠'
        : '这 ' + log.length + ' 条都判对了';
    }
    if (dom.reviewToggle) {
      dom.reviewToggle.hidden = badCount === 0;
      dom.reviewToggle.textContent = '展开全部 ' + log.length + ' 条';
      dom.reviewToggle.setAttribute('aria-expanded', 'false');
    }
  }

  function toggleReview() {
    reviewExpanded = !reviewExpanded;
    if (dom.reviewWrap) dom.reviewWrap.classList.toggle('is-collapsed', !reviewExpanded);
    if (dom.reviewToggle) {
      dom.reviewToggle.textContent = reviewExpanded
        ? '只看要改的'
        : '展开全部 ' + SORT.log.length + ' 条';
      dom.reviewToggle.setAttribute('aria-expanded', reviewExpanded ? 'true' : 'false');
    }
  }

  function renderResult(reason) {
    var best = SORT.order ? SORT.order.best : 0;
    var grade = gradeOf(SORT.score, best);
    var diagnosis = diagnoseLog(SORT.log);
    dom.grade.textContent = grade.grade;
    dom.gradeLabel.textContent =
      (reason ? reason + ' · ' : '') + diagnosis.text;
    dom.finalScore.textContent = String(SORT.score);
    dom.perfectScore.textContent = String(best);
    dom.orderNote.textContent = SORT.order
      ? '这一牌序最优 ' + best + ' 分；只认字面相同最多 ' + SORT.order.literal +
        ' 分（' + Math.round((SORT.order.literal / best) * 100) + '%），见旁证就收 ' +
        SORT.order.eager + ' 分。'
      : '';
    var seconds = Math.max(1, Math.round((SORT.endedAt - SORT.startedAt) / 1000));
    var used = {};
    for (var i = 0; i < SORT.log.length; i += 1) {
      used[SORT.log[i].state] = (used[SORT.log[i].state] || 0) + 1;
    }
    var stats = [
      '命中 <b>' + SORT.hits + '</b>',
      '漏判 <b>' + SORT.misses + '</b>',
      '超时 <b>' + SORT.timeouts + '</b>',
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
        var want = ruleWants(item);
        var actText = item.action === 'accept' ? '收下' : item.action === 'timeout' ? '超时' : '放走';
        var score = item.points > 0 ? '+' + item.points : item.life < 0 ? '−1♥' : '0';
        var good = item.action === want;
        var cls = item.life < 0 || (item.state === 'exact' && item.action !== 'accept')
          ? 'is-bad'
          : good ? 'is-good' : 'is-loss';
        return (
          '<li class="' + cls + '">' +
          '<p class="rev-val"><span class="rev-idx">' + item.index + '</span>' +
          '<span class="rev-slot">' + item.short + '</span>' + escapeHtml(item.value) + '</p>' +
          '<p class="rev-meta"><span class="rev-state" style="color:' + TONE_COLOR[meta.tone] + '">' +
          meta.label + '</span>' + escapeHtml(item.note) + '</p>' +
          '<p class="rev-act">' + actText + ' <b>' + score + '</b> ' +
          (good ? '<span class="rev-flag">最优</span>' : '<span class="rev-flag is-loss">该' + (want === 'accept' ? '收下' : '放走') + '</span>') +
          '</p>' +
          '</li>'
        );
      })
      .join('');
    dom.reviewBody.innerHTML = rows;
    renderReview(SORT.log);
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
            : (R.accept[state] > 0
                ? '+' + R.accept[state] + (isSideState(state) ? '（窗口 ×' + R.windowBonus.multiplier + '）' : '')
                : '0') +
              (R.acceptLife[state] < 0 ? '，−1♥' : '') +
              (R.acceptCombo[state] === 'reset' ? '，连击断' : '');
        var reject =
          state === 'exact'
            ? '0，连击断'
            : (R.reject[state] > 0 ? '+' + R.reject[state] : '0') +
              (isSideState(state) ? '，现在收不亏倍率' : '');
        return (
          '<tr><td style="color:' + TONE_COLOR[meta.tone] + '">' + meta.label + '</td>' +
          '<td>' + accept + '</td><td>' + reject + '</td></tr>'
        );
      })
      .join('');
  }

  // ---- 开始页的滚动提示：能滚就明说，滚到底也明说 ----

  function updateScrollHint() {
    var box = dom.startScroll;
    var hint = dom.startScrollHint;
    if (!box || !hint) return;
    var overflow = box.scrollHeight - box.clientHeight;
    if (!(overflow > 4)) {
      hint.hidden = true;
      return;
    }
    var atEnd = box.scrollTop + box.clientHeight >= box.scrollHeight - 8;
    hint.hidden = false;
    hint.classList.toggle('is-done', atEnd);
    hint.textContent = atEnd ? '已到底 · 点「开始」开局' : '↕ 上下滑动查看完整规则';
  }

  // ---- 输入：指针（触屏/鼠标）、键盘、按钮 ----

  function onChipPointerDown(event) {
    if (SORT.phase !== 'playing' || SORT.locked) return;
    if (event.button !== undefined && event.button !== 0) return;
    SORT.drag = {
      id: event.pointerId,
      startY: event.clientY,
      startAt: now(),
      dy: 0,
      moved: false,
    };
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
    if (Math.abs(SORT.drag.dy) > 4) SORT.drag.moved = true;
    dom.chip.style.transition = 'none';
    dom.chip.style.transform = 'translateY(' + SORT.drag.dy + 'px)';
  }

  function onChipPointerUp(event) {
    if (!SORT.drag || SORT.drag.id !== event.pointerId) return;
    var dy = SORT.drag.dy;
    var moved = SORT.drag.moved;
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
    // 甩得不够 / 只是点了一下：立刻说清楚，计时照走
    if (!moved || Math.abs(dy) < 6) {
      refuseFeedback('点卡片不算数：上甩收下、下甩放走');
    } else {
      refuseFeedback('甩得不够（要 34px 以上）：再甩长一点');
    }
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
  if (dom.startScroll) dom.startScroll.addEventListener('scroll', updateScrollHint);
  if (dom.startDetails) {
    dom.startDetails.addEventListener('toggle', function () {
      updateScrollHint();
      window.setTimeout(updateScrollHint, 0);
    });
  }
  if (dom.reviewToggle) dom.reviewToggle.addEventListener('click', toggleReview);
  if (window.addEventListener) window.addEventListener('resize', updateScrollHint);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('visibilitychange', onVisibility);

  renderRules();
  renderHud(false);
  clearDecided();
  updateScrollHint();

  // 供一致性测试核对：规则表与结算函数是页面真正在用的那一份
  window.LODESTAR_SORT_RULES = {
    multiplierOf: multiplierOf,
    outcomeOf: outcomeOf,
    applyOutcome: applyOutcome,
    ruleWants: ruleWants,
    diagnoseLog: diagnoseLog,
    chipMs: CHIP_MS,
    verdictMs: VERDICT_MS,
    swipe: SWIPE,
    pickRun: pickRun,
    state: function () {
      return {
        phase: SORT.phase,
        score: SORT.score,
        combo: SORT.combo,
        lives: SORT.lives,
        roundIndex: SORT.roundIndex,
        chipIndex: SORT.chipIndex,
        runId: SORT.run ? SORT.run.id : null,
        orderId: SORT.order ? SORT.order.id : null,
        recentRuns: SORT.recentRuns.slice(),
        sequence: SORT.sequence.slice(),
        log: SORT.log.slice(),
      };
    },
  };
}());
