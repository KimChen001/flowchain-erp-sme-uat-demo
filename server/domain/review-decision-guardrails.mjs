export const DECISIONS = Object.freeze({
  approve: 'approve',
  reject: 'reject',
  requestChanges: 'request_changes',
  cancel: 'cancel',
  defer: 'defer',
})

export const REJECTION_DECISIONS = Object.freeze([
  DECISIONS.reject,
  DECISIONS.requestChanges,
  DECISIONS.cancel,
])

const DECISION_ALIASES = Object.freeze({
  approved: DECISIONS.approve,
  approval: DECISIONS.approve,
  pass: DECISIONS.approve,
  rejected: DECISIONS.reject,
  deny: DECISIONS.reject,
  denied: DECISIONS.reject,
  return: DECISIONS.requestChanges,
  returned: DECISIONS.requestChanges,
  request_change: DECISIONS.requestChanges,
  changes_requested: DECISIONS.requestChanges,
  cancelled: DECISIONS.cancel,
  canceled: DECISIONS.cancel,
  postpone: DECISIONS.defer,
  deferred: DECISIONS.defer,
})

function text(value = '') {
  return String(value ?? '').trim()
}

export function normalizeReviewDecision(input = {}) {
  const raw = typeof input === 'string' ? input : input.decision
  const normalized = text(raw).toLowerCase()
  return DECISION_ALIASES[normalized] || normalized
}

export function requiresDecisionReason(decision) {
  return REJECTION_DECISIONS.includes(normalizeReviewDecision(decision))
}

export function validateReviewDecision(input = {}) {
  const decision = normalizeReviewDecision(input)
  const reason = text(input.reason)
  const note = text(input.note)
  const owner = text(input.owner)
  const dueDate = text(input.dueDate)
  const allowed = Object.values(DECISIONS)

  if (!allowed.includes(decision)) {
    return {
      ok: false,
      decision,
      error: '请选择有效的复核结论。',
      errors: [{ code: 'invalid_review_decision', message: '请选择有效的复核结论。' }],
    }
  }

  if (requiresDecisionReason(decision) && !reason) {
    const message = decision === DECISIONS.reject
      ? '拒绝必须填写原因。'
      : decision === DECISIONS.requestChanges
        ? '要求修改必须填写原因。'
        : '取消必须填写原因。'
    return {
      ok: false,
      decision,
      error: message,
      errors: [{ code: 'decision_reason_required', message }],
    }
  }

  const warnings = []
  if (decision === DECISIONS.defer && !owner && !dueDate) {
    warnings.push({ code: 'defer_followup_recommended', message: '延期建议填写负责人或后续日期。' })
  }

  return {
    ok: true,
    decision,
    reason,
    note,
    owner,
    dueDate,
    warnings,
  }
}

export function buildDecisionAuditSummary(input = {}) {
  const result = validateReviewDecision(input)
  const decisionLabel = ({
    [DECISIONS.approve]: '批准',
    [DECISIONS.reject]: '拒绝',
    [DECISIONS.requestChanges]: '要求修改',
    [DECISIONS.cancel]: '取消',
    [DECISIONS.defer]: '延期处理',
  })[result.decision] || '未知结论'

  if (!result.ok) {
    return {
      ok: false,
      decision: result.decision,
      summary: `复核结论未通过校验：${result.error}`,
      errors: result.errors,
    }
  }

  const reasonPart = result.reason ? `；原因：${result.reason}` : ''
  const notePart = result.note ? `；备注：${result.note}` : ''
  const followupPart = result.owner || result.dueDate ? `；后续：${[result.owner, result.dueDate].filter(Boolean).join(' / ')}` : ''

  return {
    ok: true,
    decision: result.decision,
    summary: `${decisionLabel}${reasonPart}${notePart}${followupPart}`,
    warnings: result.warnings,
  }
}
