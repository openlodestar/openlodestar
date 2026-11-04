/* docs/assets/demo.js
 *
 * 交互演示页的行为层：只做"选一条记录 → 展示构建时算好的判定与证据"。
 * 判定、计票、门禁、坐标都在构建时由引擎算完并冻结在 demo-data.js 里；
 * 这里不再重算任何判定，唯一做的检查是"证据与字段值是否对得上"（见 demo-match.js）。
 *
 * 页面必须能在 file:// 下双击打开、断网可用：不联网、不读本地文件、不写存储。
 */
(function () {
  'use strict';

  var data = window.LODESTAR_DEMO;
  var api = window.LODESTAR_MATCH;
  if (!data || !api) return;

  var ENTRIES = [];
  data.cases.forEach(function (caseInfo) {
    var sourceByUrl = {};
    (caseInfo.sources || []).forEach(function (source) {
      sourceByUrl[source.url] = source;
    });
    caseInfo.records.forEach(function (record) {
      ENTRIES.push({
        caseInfo: caseInfo,
        record: record,
        sourceByUrl: sourceByUrl,
        view: api.buildView(record)
      });
    });
  });

  var BUCKET_ORDER = ['strong', 'weak', 'refuted', 'not_found'];
  var BUCKET_LABELS = {
    strong: '强',
    weak: '弱',
    refuted: '被反驳',
    not_found: '查不到'
  };
  var BUCKET_HINTS = {
    strong: '两个以上独立来源都支持，关键字段同页共现',
    weak: '字段都成立，但只有一个独立来源',
    refuted: '另有独立来源直接反驳其中某个字段',
    not_found: '查过页面，这批证据里没有任何一处提到'
  };
  var RELATION_LABELS = {
    supports: '支持',
    refutes: '反对',
    irrelevant: '不涉及'
  };
  var TIER_LABELS = {
    official: '官方',
    primary: '一手报道',
    aggregator: '聚合站',
    unlisted: '未列名'
  };
  var CAUSE_LABELS = {
    budget: '预算用完，还没查完',
    coverage: '这批候选来源没覆盖到',
    genuinely_absent: '这批来源里确实没有'
  };

  var state = { filter: 'all', current: 0 };

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function visibleEntries() {
    if (state.filter === 'all') return ENTRIES;
    return ENTRIES.filter(function (entry) {
      return entry.view.bucket === state.filter;
    });
  }

  function countByBucket(bucket) {
    return ENTRIES.filter(function (entry) {
      return entry.view.bucket === bucket;
    }).length;
  }

  function renderFilters() {
    var parts = [];
    parts.push(filterButton('all', '全部', ENTRIES.length));
    BUCKET_ORDER.forEach(function (bucket) {
      parts.push(filterButton(bucket, BUCKET_LABELS[bucket], countByBucket(bucket)));
    });
    document.getElementById('bucket-filter').innerHTML = parts.join('');
  }

  function filterButton(key, label, count) {
    var active = state.filter === key ? ' aria-pressed="true"' : ' aria-pressed="false"';
    return (
      '<button type="button" class="chip' +
      (state.filter === key ? ' is-active' : '') +
      '" data-action="filter" data-bucket="' +
      escapeHtml(key) +
      '"' +
      active +
      '>' +
      escapeHtml(label) +
      ' <span class="count">' +
      count +
      '</span></button>'
    );
  }

  function renderList() {
    var entries = visibleEntries();
    if (entries.length === 0) {
      document.getElementById('record-list').innerHTML = '<p class="empty">这一类现在没有记录。</p>';
      return;
    }
    if (state.current >= entries.length) state.current = 0;
    var parts = [];
    entries.forEach(function (entry, index) {
      var view = entry.view;
      var selected = index === state.current ? ' is-current' : '';
      parts.push(
        '<button type="button" class="record' +
          selected +
          '" data-action="select" data-index="' +
          index +
          '">' +
          '<span class="record-title">' +
          escapeHtml(view.title) +
          '</span>' +
          '<span class="record-meta">' +
          '<span class="badge badge-' +
          escapeHtml(view.bucket) +
          '">' +
          escapeHtml(view.bucketLabel) +
          '</span>' +
          '<span class="case">' +
          escapeHtml(entry.caseInfo.title) +
          '</span>' +
          '</span>' +
          '</button>'
      );
    });
    document.getElementById('record-list').innerHTML = parts.join('');
  }

  function renderPanel() {
    var entries = visibleEntries();
    if (entries.length === 0) {
      document.getElementById('record-panel').innerHTML = '';
      return;
    }
    var entry = entries[state.current];
    var view = entry.view;
    var html = [];

    html.push('<header class="panel-head">');
    html.push('<p class="eyebrow">' + escapeHtml(entry.caseInfo.title) + '</p>');
    html.push('<h2>' + escapeHtml(view.title) + '</h2>');
    html.push('<p class="query">提问：' + escapeHtml(entry.caseInfo.query) + '</p>');
    html.push('</header>');

    html.push('<div class="status status-' + escapeHtml(view.bucket) + '">');
    html.push('<span class="badge badge-' + escapeHtml(view.bucket) + '">' + escapeHtml(view.bucketLabel) + '</span>');
    html.push('<p class="status-reason">' + escapeHtml(view.reason) + '</p>');
    if (view.gate === 'uncovered') {
      html.push(
        '<p class="status-note">记录里有字段的值对不上构建时参与计算的值。这时既不沿用旧证据，也不判成被拒收，只显示「这批证据没覆盖」。</p>'
      );
    }
    html.push('</div>');

    html.push('<h3>这段记忆拆成哪几个字段</h3>');
    html.push('<div class="fields">');
    view.fields.forEach(function (field) {
      html.push(renderField(field, entry));
    });
    html.push('</div>');

    html.push(renderCooccurrence(view));
    html.push(renderAnchor(view));

    html.push('<footer class="panel-foot">');
    html.push(
      '<p>判定由引擎在构建数据时算好并冻结，页面只切换展示；每条引文都能回到下面那份页面节选。' +
        '数据来自冻结批次 <code>examples/' +
        escapeHtml(entry.caseInfo.id) +
        '/</code>，采集时间 ' +
        escapeHtml(entry.caseInfo.capturedAt || '未记录') +
        '。</p>'
    );
    html.push('</footer>');

    document.getElementById('record-panel').innerHTML = html.join('');
  }

  function renderField(field, entry) {
    var parts = [];
    parts.push('<section class="field field-state-' + escapeHtml(field.state) + '">');
    parts.push('<div class="field-head">');
    parts.push('<span class="field-label">' + escapeHtml(field.label) + '</span>');
    if (field.role === 'key') parts.push('<span class="role">关键字段</span>');
    parts.push('<span class="field-value">' + escapeHtml(field.value) + '</span>');
    parts.push('</div>');

    if (field.state === 'uncovered') {
      parts.push('<p class="uncovered">这批证据没覆盖：' + escapeHtml(field.reason) + '</p>');
      parts.push('</section>');
      return parts.join('');
    }

    parts.push('<div class="field-verdict">');
    parts.push(
      '<span class="verdict verdict-' +
        escapeHtml(field.verdict) +
        '">' +
        escapeHtml(api.verdictLabel(field.verdict)) +
        '</span>'
    );
    parts.push('<span class="stat">独立支持 ' + field.supportCount + ' · 反对 ' + field.refuteCount + '</span>');
    parts.push('<span class="stat">证据等级 ' + escapeHtml(field.evidenceGrade) + '</span>');
    parts.push(
      '<span class="stat">比对过 ' + field.examinedPages + ' 页</span>'
    );
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
        parts.push(renderEvidence(row, entry));
      });
    }
    parts.push('</div>');
    parts.push('</section>');
    return parts.join('');
  }

  function renderEvidence(row, entry) {
    var source = entry.sourceByUrl[row.url] || null;
    var publisher = source ? source.publisher : row.domain;
    var parts = [];
    parts.push('<article class="evidence-row">');
    parts.push(
      '<div class="evidence-meta"><span class="relation relation-' +
        escapeHtml(row.relation) +
        '">' +
        escapeHtml(RELATION_LABELS[row.relation] || row.relation) +
        '</span>' +
        '<span class="publisher">' +
        escapeHtml(publisher) +
        '</span>' +
        '<span class="tier">' +
        escapeHtml(TIER_LABELS[row.tier] || row.tier) +
        '</span>' +
        '<span class="family">家族 ' +
        escapeHtml(row.family) +
        '</span></div>'
    );
    parts.push('<blockquote>' + escapeHtml(row.quote) + '</blockquote>');
    if (row.note) parts.push('<p class="evidence-note">' + escapeHtml(row.note) + '</p>');
    parts.push('<p class="evidence-link"><a href="' + escapeHtml(row.url) + '">' + escapeHtml(row.url) + '</a></p>');
    if (source && source.excerpt) {
      parts.push(
        '<details><summary>看这页的快照节选（' +
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
    if (view.gate === 'uncovered') {
      parts.push('<p>没有可用的证据匹配，共现结论不沿用。</p>');
    } else if (view.cooccurrence.count === 0) {
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
    if (view.gate === 'uncovered') {
      parts.push('<p>不给坐标：这批证据没覆盖当前字段值，旧坐标也不能沿用。</p>');
    } else if (view.anchor === null) {
      parts.push('<p>不给坐标：整条记录被拒收，坐标库不收这条。</p>');
    } else if (view.anchor.grade === 'strong') {
      parts.push('<p>给<strong>强坐标</strong>（' + escapeHtml(view.anchor.evidenceGrade) + '），下游默认可读。</p>');
    } else {
      parts.push(
        '<p>只给<strong>弱坐标</strong>（' +
          escapeHtml(view.anchor.evidenceGrade) +
          '），默认不可读——单一独立来源撑不起一条可用坐标。</p>'
      );
    }
    if (view.anchor !== null && view.gate !== 'uncovered') {
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
      if (view.anchor.stale) parts.push('<p class="stale">这条坐标已标为过期，不应再当结论读。</p>');
    }
    parts.push('</div>');
    return parts.join('');
  }

  function renderLegend() {
    var parts = [];
    BUCKET_ORDER.forEach(function (bucket) {
      parts.push(
        '<div class="legend-item"><span class="badge badge-' +
          bucket +
          '">' +
          BUCKET_LABELS[bucket] +
          '</span><span>' +
          BUCKET_HINTS[bucket] +
          '</span></div>'
      );
    });
    document.getElementById('legend').innerHTML = parts.join('');
  }

  function renderAll() {
    renderFilters();
    renderList();
    renderPanel();
  }

  document.addEventListener('click', function (event) {
    var target = event.target.closest ? event.target.closest('[data-action]') : null;
    if (!target) return;
    var action = target.getAttribute('data-action');
    if (action === 'filter') {
      state.filter = target.getAttribute('data-bucket') || 'all';
      state.current = 0;
      renderAll();
    } else if (action === 'select') {
      var index = Number(target.getAttribute('data-index'));
      if (Number.isFinite(index)) {
        state.current = index;
        renderAll();
      }
    }
  });

  renderLegend();
  renderAll();
})();
