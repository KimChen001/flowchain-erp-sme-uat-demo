import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DECISIONS,
  REJECTION_DECISIONS,
  buildDecisionAuditSummary,
  normalizeReviewDecision,
  requiresDecisionReason,
  validateReviewDecision,
} from './review-decision-guardrails.mjs'

test('review decision constants expose reason-required decisions', () => {
  assert.deepEqual(REJECTION_DECISIONS, [DECISIONS.reject, DECISIONS.requestChanges, DECISIONS.cancel])
  assert.equal(normalizeReviewDecision('rejected'), DECISIONS.reject)
  assert.equal(requiresDecisionReason('cancelled'), true)
  assert.equal(requiresDecisionReason('approve'), false)
})

test('reject without reason is blocked with business-facing message', () => {
  const result = validateReviewDecision({ decision: 'reject' })
  assert.equal(result.ok, false)
  assert.equal(result.errors[0].code, 'decision_reason_required')
  assert.match(result.error, /拒绝必须填写原因/)
  assert.doesNotMatch(JSON.stringify(result), /stack|trace|internal|undefined|null/i)
})

test('request changes without reason is blocked', () => {
  const result = validateReviewDecision({ decision: 'request_changes', reason: '   ' })
  assert.equal(result.ok, false)
  assert.match(result.error, /要求修改必须填写原因/)
})

test('cancel without reason is blocked', () => {
  const result = validateReviewDecision({ decision: 'cancel' })
  assert.equal(result.ok, false)
  assert.match(result.error, /取消必须填写原因/)
})

test('approve without reason is allowed and may carry note', () => {
  const result = validateReviewDecision({ decision: 'approve', note: '库存影响已复核' })
  assert.equal(result.ok, true)
  assert.equal(result.reason, '')
  assert.equal(result.note, '库存影响已复核')
})

test('reject with trimmed reason is allowed', () => {
  const result = validateReviewDecision({ decision: 'reject', reason: '  缺少供应商交期确认  ' })
  assert.equal(result.ok, true)
  assert.equal(result.reason, '缺少供应商交期确认')
})

test('defer is allowed and recommends follow-up owner or due date', () => {
  const result = validateReviewDecision({ decision: 'defer' })
  assert.equal(result.ok, true)
  assert.equal(result.warnings[0].code, 'defer_followup_recommended')
})

test('audit summary stays concise and business-readable', () => {
  const summary = buildDecisionAuditSummary({
    decision: 'request_changes',
    reason: '请补充质检记录',
    owner: '王敏',
    dueDate: '2026-07-08',
  })
  assert.equal(summary.ok, true)
  assert.match(summary.summary, /要求修改；原因：请补充质检记录；后续：王敏 \/ 2026-07-08/)
  assert.doesNotMatch(JSON.stringify(summary), /raw JSON|tool_result|provider|fallback|stack|trace/i)
})
