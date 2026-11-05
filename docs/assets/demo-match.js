/* docs/assets/demo-match.js
 *
 * 纯函数：把冻结记录换算成页面要显示的判定。
 *
 * 这里唯一重要的一条：**证据按「记录号 + 字段名 + 字段值」匹配**。
 * 底稿里的证据是按断言编号挂靠的，而断言编号里没有字段值；一旦字段值被改写，
 * 只按编号去找证据就会把旧证据继承过来，甚至显示成"被拒收"。
 * 值对不上时本模块只输出 `uncovered`（这批证据没覆盖），绝不输出 supported/refuted。
 *
 * 不碰 DOM、不读网络，浏览器与 Node 测试共用同一份实现。
 */
(function (root) {
  'use strict';

  /** 取这个字段当前应该展示的证据行：字段名与字段值都要相等 */
  function matchEvidence(record, field) {
    var rows = record && Array.isArray(record.evidence) ? record.evidence : [];
    return rows.filter(function (row) {
      return row.fieldKey === field.key && row.fieldValue === field.value;
    });
  }

  /**
   * 单字段视图。state 只有两种：
   * - covered：构建时的字段值与页面当前值一致，判定可以直接沿用；
   * - uncovered：值对不上，或该成立的字段一条匹配证据都没有 —— 只报告"没覆盖"。
   */
  function fieldView(record, field) {
    var computed =
      record && record.computation && record.computation.fieldVerdicts
        ? record.computation.fieldVerdicts[field.key]
        : null;
    if (!computed || computed.fieldValue !== field.value) {
      return {
        key: field.key,
        label: field.label,
        role: field.role,
        value: field.value,
        state: 'uncovered',
        dimensionState: 'unknown',
        dimensionLabel: DIMENSION_STATE_LABELS.unknown,
        reason: '这个字段的值与构建时参与计算的值不一致，证据不覆盖当前值。',
        evidence: []
      };
    }
    var evidence = matchEvidence(record, field);
    // 判成 supported / refuted 的字段必须有匹配证据行；没有就说明数据与证据脱钩了
    if (evidence.length === 0 && computed.verdict !== 'not_found') {
      return {
        key: field.key,
        label: field.label,
        role: field.role,
        value: field.value,
        state: 'uncovered',
        dimensionState: 'unknown',
        dimensionLabel: DIMENSION_STATE_LABELS.unknown,
        reason: '找不到与「' + field.value + '」匹配的证据行，不沿用旧结论。',
        evidence: []
      };
    }
    return {
      key: field.key,
      label: field.label,
      role: field.role,
      value: field.value,
      state: 'covered',
      verdict: computed.verdict,
      evidenceGrade: computed.evidenceGrade,
      supportCount: computed.supportCount,
      refuteCount: computed.refuteCount,
      notFoundCause: computed.notFoundCause,
      examinedPages: computed.examinedPages,
      dimensionState: computed.dimensionState || 'unknown',
      dimensionLabel: DIMENSION_STATE_LABELS[computed.dimensionState] || DIMENSION_STATE_LABELS.unknown,
      evidence: evidence
    };
  }

  /**
   * 判据维度状态（六态）。呈现约束：
   * 口径相容只能说"很可能是同一件，只是说法不同"，不许写成"对"或"一致"；
   * 边缘相容只能说"没有矛盾，但这不能证明"；冲突只挂候选，不许压成"反对"。
   */
  var DIMENSION_STATE_LABELS = {
    exact: '完全对上',
    caliber: '口径相容（很可能是同一件，只是说法不同）',
    edge: '边缘相容（没有矛盾，但这不能证明）',
    conflict: '冲突候选（不是"反对"）',
    mismatch: '没对上',
    unknown: '无从判断'
  };

  /** 对外只发三档：强坐标 / 弱坐标 / 无坐标 */
  var GATE_LABELS = {
    strong: '强坐标',
    weak: '弱坐标',
    rejected: '无坐标',
    uncovered: '无坐标（这批证据没覆盖）'
  };

  var VERDICT_LABELS = {
    supported: '支持',
    refuted: '反驳',
    conflicting: '互相矛盾',
    not_found: '查不到'
  };

  /** 记录级视图：任一字段 uncovered，整条记录都不沿用旧门禁与旧坐标 */
  function buildView(record) {
    var fields = (record.fields || []).map(function (field) {
      return fieldView(record, field);
    });
    var uncovered = fields.filter(function (field) {
      return field.state === 'uncovered';
    });
    var gate = uncovered.length > 0 ? 'uncovered' : record.computation.gate;
    var bucket = gate === 'uncovered' ? 'uncovered' : record.bucket;
    var anchor = gate === 'uncovered' ? null : record.computation.anchor;
    var reason = record.computation.reason;
    if (uncovered.length > 0) {
      reason =
        '记录里这些字段的值对不上构建时的值：' +
        uncovered
          .map(function (field) {
            return field.label;
          })
          .join('、') +
        '。不沿用旧判定，也不判成被拒收——只标注这批证据没覆盖。';
    }
    return {
      recordId: record.recordId,
      caseId: record.caseId,
      title: record.title,
      bucket: bucket,
      gate: gate,
      gateLabel: GATE_LABELS[gate],
      coordinate: gate === 'strong' ? 'strong' : gate === 'weak' ? 'weak' : 'none',
      coordinateLabel: gate === 'strong' ? '强坐标' : gate === 'weak' ? '弱坐标' : '无坐标',
      // 冲突只作候选单独挂标记，绝不压成"反对"
      conflictCandidates: fields
        .filter(function (field) {
          return field.dimensionState === 'conflict';
        })
        .map(function (field) {
          return { key: field.key, label: field.label, dimensionLabel: field.dimensionLabel };
        }),
      bucketLabel: gate === 'uncovered' ? GATE_LABELS.uncovered : record.bucket,
      reason: reason,
      fields: fields,
      keyFieldValues: record.computation.keyFieldValues,
      cooccurrence: record.computation.cooccurrence,
      dimensionGrade: record.computation.dimensionGrade || null,
      anchor: anchor,
      keyFieldsCovered: fields
        .filter(function (field) {
          return field.role === 'key';
        })
        .every(function (field) {
          return field.state === 'covered' && field.verdict === 'supported';
        })
    };
  }

  function verdictLabel(verdict) {
    return VERDICT_LABELS[verdict] || verdict || '';
  }

  root.LODESTAR_MATCH = {
    matchEvidence: matchEvidence,
    fieldView: fieldView,
    buildView: buildView,
    verdictLabel: verdictLabel,
    GATE_LABELS: GATE_LABELS,
    DIMENSION_STATE_LABELS: DIMENSION_STATE_LABELS
  };
})(typeof window !== 'undefined' ? window : globalThis);
