import { EXCEPTION_CASE_SEVERITIES, EXCEPTION_CASE_STATUSES } from './exception-case-model.mjs'

const ALLOWED_TRANSITIONS = Object.freeze({
  open: ['in_review', 'waiting_supplier', 'waiting_internal', 'cancelled'],
  in_review: ['waiting_supplier', 'waiting_internal', 'resolved', 'cancelled'],
  waiting_supplier: ['in_review', 'cancelled'],
  waiting_internal: ['in_review', 'cancelled'],
  resolved: ['closed'],
  closed: [],
  cancelled: [],
})

function text(value = '') {
  return String(value ?? '').trim()
}

function nowIso(input = {}) {
  return input.timestamp || input.now || new Date().toISOString()
}

function error(message, code, status = 400, details = {}) {
  const next = new Error(message)
  next.code = code
  next.status = status
  next.details = details
  return next
}

export function allowedNextExceptionCaseStatuses(status = 'open') {
  return [...(ALLOWED_TRANSITIONS[status] || [])]
}

export function validateExceptionCaseTransition(currentStatus = '', nextStatus = '', input = {}) {
  const from = text(currentStatus)
  const to = text(nextStatus)
  if (!EXCEPTION_CASE_STATUSES.includes(from)) return { ok: false, code: 'EXCEPTION_CASE_CURRENT_STATUS_INVALID', message: 'Current case status is invalid.' }
  if (!EXCEPTION_CASE_STATUSES.includes(to)) return { ok: false, code: 'EXCEPTION_CASE_NEXT_STATUS_INVALID', message: 'Next case status is invalid.' }
  if (!allowedNextExceptionCaseStatuses(from).includes(to)) {
    return { ok: false, code: 'EXCEPTION_CASE_TRANSITION_NOT_ALLOWED', message: `Transition ${from} -> ${to} is not allowed.` }
  }
  if ((to === 'resolved' || to === 'closed' || to === 'cancelled') && input.confirm !== true && input.explicitConfirmation !== true) {
    return { ok: false, code: 'EXCEPTION_CASE_TRANSITION_CONFIRMATION_REQUIRED', message: 'Explicit user confirmation is required for final case transitions.' }
  }
  if (to === 'closed' && !text(input.resolutionNote || input.note || input.reason)) {
    return { ok: false, code: 'EXCEPTION_CASE_RESOLUTION_NOTE_REQUIRED', message: 'Resolution note is required before closing an exception case.' }
  }
  return { ok: true, from, to }
}

export function assertExceptionCaseTransition(currentStatus, nextStatus, input = {}) {
  const result = validateExceptionCaseTransition(currentStatus, nextStatus, input)
  if (!result.ok) throw error(result.message, result.code, 400, result)
  return result
}

export function validateExceptionCaseFieldUpdate(input = {}) {
  const errors = []
  const fields = input.fields || input
  if (input.confirm !== true && input.explicitConfirmation !== true) errors.push('confirmation_required')
  if ('severity' in fields && !EXCEPTION_CASE_SEVERITIES.includes(fields.severity)) errors.push('severity_invalid')
  if ('dueDate' in fields && text(fields.dueDate) && Number.isNaN(Date.parse(fields.dueDate))) errors.push('due_date_invalid')
  if ('owner' in fields && !/^[\w\s\u4e00-\u9fa5@.\-()]{1,80}$/.test(text(fields.owner))) errors.push('owner_invalid')
  return { ok: errors.length === 0, errors }
}

export function normalizeCaseNote(input = {}) {
  const body = text(input.body || input.content || input.note)
  if (!body) throw error('Case note content is required.', 'EXCEPTION_CASE_NOTE_REQUIRED')
  return {
    noteId: input.noteId || `NOTE-${Date.now()}`,
    author: text(input.author || input.actor || 'current_user'),
    noteType: text(input.noteType || 'internal'),
    body,
    linkedRecords: input.linkedRecords || [],
    reviewStatus: input.reviewStatus || 'user_confirmed',
    createdAt: input.createdAt || nowIso(input),
    source: input.source || 'user_confirmed_note',
  }
}

export function buildResolutionPayload(input = {}, item = {}) {
  const resolutionSummary = text(input.resolutionSummary || input.resolutionNote || input.note)
  if (!resolutionSummary) throw error('Resolution note is required before closing an exception case.', 'EXCEPTION_CASE_RESOLUTION_NOTE_REQUIRED')
  if (input.confirm !== true && input.explicitConfirmation !== true) throw error('Explicit user confirmation is required to close an exception case.', 'EXCEPTION_CASE_CLOSE_CONFIRMATION_REQUIRED')
  return {
    resolutionId: input.resolutionId || `RES-${Date.now()}`,
    resolutionSummary,
    rootCause: text(input.rootCause || 'Requires business review'),
    actionTaken: text(input.actionTaken || 'Reviewed evidence and recorded closure note.'),
    remainingRisk: text(input.remainingRisk || 'Monitor for recurrence.'),
    linkedRecordsReviewed: input.linkedRecordsReviewed || (item.linkedRecords || []).map((record) => record.entityId || record.id).filter(Boolean),
    evidenceReviewed: input.evidenceReviewed || (item.evidenceItems || []).map((record) => record.id).filter(Boolean),
    dataLimitations: input.dataLimitations || item.dataLimitations || [],
    confirmedBy: text(input.actor || input.confirmedBy || 'current_user'),
    confirmedAt: nowIso(input),
  }
}

export function workflowAuditEntry(action, item = {}, input = {}, metadata = {}) {
  return {
    action,
    caseId: item.caseId,
    caseType: item.caseType,
    actor: text(input.actor || input.author || 'current_user'),
    timestamp: nowIso(input),
    summary: text(input.reason || input.note || input.resolutionNote || input.body || action),
    sourceEntityId: item.sourceEntityId,
    metadata,
  }
}

export function exceptionCaseAuditPolicyEntry(action, item = {}, input = {}, metadata = {}) {
  return {
    module: 'exception-cases',
    action,
    entity: { type: 'exceptionCase', id: item.caseId },
    summary: `${action.replaceAll('_', ' ')} for ${item.caseId}.`,
    metadata: {
      caseId: item.caseId,
      caseType: item.caseType,
      previousStatus: metadata.previousStatus,
      nextStatus: metadata.nextStatus,
      actor: text(input.actor || input.author || 'current_user'),
      sourceEntityId: item.sourceEntityId,
      timestamp: nowIso(input),
    },
  }
}

export function buildExceptionWorkflowDraft(input = {}) {
  const item = input.case || input.item || {}
  const draftType = input.draftType || 'internal_followup_note'
  const base = {
    caseId: item.caseId,
    draftType,
    sourceTrigger: input.sourceTrigger || 'case_workflow',
    reviewStatus: 'draft_only_requires_review',
    allowedUserActions: ['edit_draft', 'save_after_confirmation', 'copy_draft', 'cancel'],
    forbiddenAiActions: ['auto_save_note', 'auto_send_supplier_email', 'auto_close_case', 'auto_modify_business_data'],
    requiresReview: true,
    mutationAllowed: false,
    autonomousExecutionAllowed: false,
    auditPreview: [
      { action: `${draftType}_draft_generated`, summary: 'Draft prepared for user review only.' },
      { action: 'save_or_close_requires_confirmation', summary: 'User confirmation is required before saving or closing.' },
    ],
  }
  const evidenceSummary = (item.evidenceItems || []).map((evidence) => evidence.summary).filter(Boolean).slice(0, 2).join(' ')
  const linked = (item.linkedRecords || []).map((record) => record.entityId || record.id).filter(Boolean).join(', ')
  const bodyByType = {
    internal_followup_note: `Review ${item.caseId || 'this case'} (${item.caseType || 'exception'}). Evidence: ${evidenceSummary || item.summary || 'Evidence review required.'}`,
    supplier_followup_note: `Supplier follow-up draft for ${linked || item.sourceEntityId || item.caseId}: please review current exception status and provide recovery plan. Not sent automatically.`,
    resolution_note: `Resolution draft for ${item.caseId || 'case'}: summarize root cause, action taken, remaining risk, and evidence reviewed before user-confirmed closure.`,
    closure_summary: `Closure summary draft for ${item.caseId || 'case'}: status ${item.status || 'unknown'}, owner ${item.owner || 'unassigned'}, due ${item.dueDate || 'missing'}.`,
  }
  return {
    ...base,
    body: input.body || bodyByType[draftType] || bodyByType.internal_followup_note,
    missingFields: [
      !item.owner || item.owner === 'Unassigned' ? 'owner' : '',
      !item.dueDate ? 'dueDate' : '',
      draftType.includes('resolution') && !(item.evidenceItems || []).length ? 'evidenceReviewed' : '',
    ].filter(Boolean),
    assumptions: ['Draft Only', 'Requires Review', 'Not sent automatically', 'Not saved automatically'],
  }
}

export function summarizeExistingCaseWorkflow(item = {}) {
  if (!item || !item.caseId) return null
  const recommendation = item.status === 'waiting_supplier'
    ? 'preview_supplier_followup_draft'
    : item.status === 'resolved'
      ? 'review_case_closure'
      : item.status === 'closed'
        ? 'monitor_recurrence_before_reopening'
        : 'continue_case_workflow'
  return {
    caseId: item.caseId,
    status: item.status,
    owner: item.owner,
    dueDate: item.dueDate,
    sourceEntityId: item.sourceEntityId,
    recommendation,
    duplicateCreationRecommended: false,
    mutationAllowed: false,
  }
}
