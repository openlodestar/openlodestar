/* docs/assets/demo-lab.js
 *
 * 小游戏页的行为层：句子里的四个词就是操作面。点一个词 → 选一个新词 → 结论与引文
 * 立刻出现在句子下面，没有单独的“识别”按钮，也没有词库与拖拽这些第二套操作路径。
 *
 * 页面不重算判定、不联网、不读本地文件、不写存储；唯一的安全阀在 demo-game-match.js：
 * 组合对不上就显示「这批证据没覆盖」，不继承旧证据，也不显示成被拒收。
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
  var INITIAL_VALUES = {
    auctionHouse: '北京保利',
    dateText: '2021年12月5日',
    sessionPrefix: '禹贡Ⅰ',
    sessionSubtitle: '盛清御瓷新风尚'
  };
  var SESSION_SEPARATOR = '—';

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
    lastChangedKey: null
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
  var revealList = document.getElementById('reveal-list');

  function cloneValues(values) {
    return {
      auctionHouse: values.auctionHouse,
      dateText: values.dateText,
      sessionPrefix: values.sessionPrefix,
      sessionSubtitle: values.sessionSubtitle
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

  // ---- 句子与选项 ----

  function updateSentence() {
    slotElements.forEach(function (element) {
      var key = element.getAttribute('data-slot');
      element.textContent = state.values[key];
      element.setAttribute(
        'aria-label',
        slotLabel(key) + '，当前是「' + state.values[key] + '」，按回车或空格打开可换的词'
      );
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
    var currentStatus = game.resolve(data, demoData, state.values).status;
    var parts = [];
    slot.options.forEach(function (value) {
      var current = state.values[slot.key] === value;
      var status = current
        ? currentStatus
        : game.substitutionStatus(data, demoData, state.values, slot.key, value);
      var shortLabel = game.STATUS_SHORT[status] || status;
      parts.push(
        '<button type="button" class="option' +
          (current ? ' is-current' : '') +
          '" data-value="' +
          escapeHtml(value) +
          '" aria-pressed="' +
          (current ? 'true' : 'false') +
          '">' +
          escapeHtml(value) +
          '<span class="chip chip-' +
          escapeHtml(status) +
          '">' +
          escapeHtml(shortLabel) +
          '</span></button>'
      );
    });
    optionList.innerHTML = parts.join('');
    updateExpandedState();
    if (focusValue) {
      var buttons = optionList.querySelectorAll('.option');
      for (var i = 0; i < buttons.length; i += 1) {
        if (buttons[i].getAttribute('data-value') === focusValue) {
          buttons[i].focus({ preventScroll: true });
          break;
        }
      }
    }
  }

  function openOptions(key, focusInto) {
    state.openSlot = key;
    renderOptions(focusInto ? state.values[key] : null);
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
    if (state.openSlot) renderOptions(state.values[state.openSlot]);
    renderVerdict();
  }

  function selectOption(key, value) {
    if (!slotByKey[key] || slotByKey[key].options.indexOf(value) === -1) return;
    if (state.values[key] === value) return;
    var next = cloneValues(state.values);
    next[key] = value;
    setValues(next, key);
    if (state.openSlot === key) renderOptions(value);
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
    if (result.status === 'uncovered') {
      verdictElement.className = 'verdict verdict-uncovered';
      verdictElement.innerHTML = renderUncovered(result);
      fullPanel.hidden = true;
      fullBody.innerHTML = '';
      return;
    }
    verdictElement.className = 'verdict verdict-' + result.status;
    verdictElement.innerHTML = renderCovered(result);
    fullPanel.hidden = false;
    fullBody.innerHTML = renderFull(result);
  }

  function statusHead(status, label) {
    var parts = [];
    parts.push('<div class="verdict-head">');
    parts.push(
      '<span class="badge badge-' + escapeHtml(status) + '">' + escapeHtml(label) + '</span>'
    );
    if (isChanged()) {
      parts.push('<button type="button" class="link-button" data-action="reset">回到原句</button>');
    }
    parts.push('</div>');
    return parts.join('');
  }

  function renderCovered(result) {
    var view = result.view;
    var parts = [];
    parts.push(statusHead(result.status, result.label));
    parts.push('<p class="verdict-reason">' + escapeHtml(result.reason) + '</p>');
    parts.push('<p class="verdict-note">' + escapeHtml(result.hint) + '</p>');

    var notFoundField = null;
    view.fields.forEach(function (field) {
      if (field.verdict === 'not_found') notFoundField = field;
    });
    if (notFoundField) {
      parts.push(
        '<p class="verdict-note">「' +
          escapeHtml(notFoundField.label) +
          '」查过了：' +
          escapeHtml(CAUSE_LABELS[notFoundField.notFoundCause] || '这批来源里没有其他说法') +
          '。这是「这批证据里没有」，不是「世界上不存在」。</p>'
      );
    }

    var entries = decisiveEntries(view, result.status, state.lastChangedKey);
    if (entries.length > 0) {
      parts.push('<div class="decisive">');
      entries.forEach(function (entry) {
        parts.push(renderEvidenceInline(entry));
      });
      parts.push('</div>');
    }
    return parts.join('');
  }

  function renderUncovered(result) {
    var parts = [];
    parts.push(statusHead('uncovered', result.label));
    parts.push('<p class="verdict-reason">' + escapeHtml(result.reason) + '</p>');

    var counts = game.SLOT_KEYS.map(function (key) {
      return slotLabel(key) + ' ' + countRecordsWithValue(key, state.values[key]) + ' 条';
    });
    parts.push(
      '<p class="verdict-note">这四个词在冻结记录里各出现过：' +
        escapeHtml(counts.join(' · ')) +
        '。但没有任何一条记录同时写着这四个值。</p>'
    );

    var jumps = game.nearbyCovered(data, state.values, 3);
    if (jumps.length > 0) {
      parts.push('<p class="jump-label">换一两个词就能看到有证据的结论：</p>');
      parts.push('<div class="jumps">');
      jumps.forEach(function (jump) {
        var diff = describeDiff(jump.values);
        parts.push(
          '<button type="button" class="jump" data-combo="' +
            escapeHtml(jump.id) +
            '">' +
            escapeHtml(diff) +
            '<span class="chip chip-' +
            escapeHtml(jump.status) +
            '">' +
            escapeHtml(game.STATUS_SHORT[jump.status] || jump.status) +
            '</span></button>'
        );
      });
      parts.push('</div>');
    }
    return parts.join('');
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

    if (status === 'refuted') {
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
    parts.push('<span>家族 ' + escapeHtml(row.family) + '</span>');
    parts.push('<span>抓取于 ' + escapeHtml(formatTime(row.fetchedAt)) + '</span>');
    parts.push('</div>');
    parts.push('<blockquote>' + escapeHtml(row.quote) + '</blockquote>');
    parts.push(
      '<p class="ev-link"><a href="' + escapeHtml(row.url) + '">' + escapeHtml(row.url) + '</a></p>'
    );
    parts.push('</article>');
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

    if (combo.matched.length > 1) {
      var extra = combo.matched.filter(function (item) {
        return item.recordId !== combo.recordId;
      });
      parts.push(
        '<p class="verdict-note">同一组取值在冻结数据里另有 ' +
          extra.length +
          ' 条记录（' +
          extra
            .map(function (item) {
              return escapeHtml(item.bucket + ' / ' + item.recordId);
            })
            .join('、') +
          '）；这里展示门禁最高的那一条，其余记录不合并证据。</p>'
      );
    }

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
        '<span>家族 ' +
        escapeHtml(row.family) +
        '</span>' +
        '<span class="stat">抓取于 ' +
        escapeHtml(formatTime(row.fetchedAt)) +
        '</span></div>'
    );
    parts.push('<blockquote>' + escapeHtml(row.quote) + '</blockquote>');
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

  /** 某个槽位取值在多少条冻结记录里出现过（先把专场名拆成主名与副题） */
  function countRecordsWithValue(key, value) {
    var count = 0;
    Object.keys(records).forEach(function (recordId) {
      var triple = tripleOfRecord(records[recordId]);
      if (triple && triple[key] === value) count += 1;
    });
    return count;
  }

  function tripleOfRecord(record) {
    var byKey = {};
    (record.fields || []).forEach(function (field) {
      byKey[field.key] = field.value;
    });
    var session = byKey.sessionName || '';
    var at = session.indexOf(SESSION_SEPARATOR);
    if (!byKey.auctionHouse || !byKey.dateText || at <= 0) return null;
    return {
      auctionHouse: byKey.auctionHouse,
      dateText: byKey.dateText,
      sessionPrefix: session.slice(0, at),
      sessionSubtitle: session.slice(at + SESSION_SEPARATOR.length)
    };
  }

  function renderCoverage() {
    var stats = game.coverage(data);
    coverageBody.innerHTML =
      '<p>' +
      stats.total +
      ' 种组合里，有记录可查的只有 ' +
      stats.covered +
      ' 种（对 ' +
      stats.byStatus.strong +
      '、对得弱 ' +
      stats.byStatus.weak +
      '、不对 ' +
      stats.byStatus.refuted +
      '、查过没找到 ' +
      stats.byStatus.not_found +
      '），其余 ' +
      stats.uncovered +
      ' 种是跨记录拼出来的组合，显示「这批证据没覆盖」。每个可换词右边的小标签也来自这份矩阵。</p>';

    var counts = [
      ['组合总数', stats.total],
      ['有记录可查', stats.covered],
      ['对', stats.byStatus.strong],
      ['对得弱', stats.byStatus.weak],
      ['不对', stats.byStatus.refuted],
      ['查过没找到', stats.byStatus.not_found],
      ['没覆盖', stats.uncovered]
    ];
    coverageCounts.innerHTML = counts
      .map(function (item) {
        return '<span class="count">' + item[0] + ' ' + item[1] + '</span>';
      })
      .join('');

    var covered = data.combos.filter(function (combo) {
      return combo.status === 'covered' && combo.computation;
    });
    revealList.innerHTML = covered
      .map(function (combo) {
        return (
          '<button type="button" class="reveal-button" data-combo="' +
          escapeHtml(combo.id) +
          '">' +
          escapeHtml(combo.sentence) +
          '<span class="chip chip-' +
          escapeHtml(combo.computation.bucket) +
          '"> ' +
          escapeHtml(game.STATUS_SHORT[combo.computation.bucket] || combo.computation.bucket) +
          '</span></button>'
        );
      })
      .join('');
  }

  // ---- 事件 ----

  slotElements.forEach(function (element) {
    element.addEventListener('click', function (event) {
      toggleOptions(element.getAttribute('data-slot'), event.detail === 0);
    });
  });

  optionList.addEventListener('click', function (event) {
    var button = event.target.closest ? event.target.closest('.option') : null;
    if (!button || !state.openSlot) return;
    // 选完不收起面板：同一组里换个词再看结果只花一次点击
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
    var jump = event.target.closest('[data-combo]');
    if (jump) applyCombo(jump.getAttribute('data-combo'));
  });

  revealList.addEventListener('click', function (event) {
    var button = event.target.closest ? event.target.closest('[data-combo]') : null;
    if (!button) return;
    applyCombo(button.getAttribute('data-combo'));
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

  updateSentence();
  updateExpandedState();
  renderVerdict();
  renderCoverage();
})();
