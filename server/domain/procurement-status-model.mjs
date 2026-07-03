export const PROCUREMENT_STATUS_GROUPS = Object.freeze({
  purchaseRequest: ['draft', 'requested', 'pending_review', 'needs_info', 'converted_to_rfq', 'cancelled'],
  sourcingEvent: ['draft', 'internal_review', 'open_draft', 'collecting_responses', 'response_review', 'award_recommended', 'closed', 'cancelled'],
  supplierResponse: ['draft', 'received', 'incomplete', 'shortlisted', 'not_selected'],
  awardRecommendation: ['draft', 'review_required', 'approved_for_po_draft', 'rejected'],
  poDraft: ['draft', 'review_required', 'ready_for_manual_issue', 'cancelled'],
})

const STATUS_ALIASES = Object.freeze({
  purchaseRequest: {
    草稿: 'draft',
    待审批: 'pending_review',
    已批准: 'requested',
    已驳回: 'cancelled',
    已转PO: 'converted_to_rfq',
    已取消: 'cancelled',
    draft: 'draft',
    requested: 'requested',
    pending_review: 'pending_review',
    needs_info: 'needs_info',
    converted_to_rfq: 'converted_to_rfq',
    cancelled: 'cancelled',
  },
  sourcingEvent: {
    草稿: 'draft',
    进行中: 'collecting_responses',
    比价中: 'response_review',
    已授标: 'award_recommended',
    已转PO: 'closed',
    已取消: 'cancelled',
    draft: 'draft',
    internal_review: 'internal_review',
    open_draft: 'open_draft',
    collecting_responses: 'collecting_responses',
    response_review: 'response_review',
    award_recommended: 'award_recommended',
    closed: 'closed',
    cancelled: 'cancelled',
  },
  supplierResponse: {
    draft: 'draft',
    received: 'received',
    incomplete: 'incomplete',
    shortlisted: 'shortlisted',
    not_selected: 'not_selected',
  },
  awardRecommendation: {
    draft: 'draft',
    review_required: 'review_required',
    approved_for_po_draft: 'approved_for_po_draft',
    rejected: 'rejected',
  },
  poDraft: {
    draft: 'draft',
    review_required: 'review_required',
    ready_for_manual_issue: 'ready_for_manual_issue',
    cancelled: 'cancelled',
  },
})

const SAFE_TRANSITIONS = Object.freeze({
  purchaseRequest: {
    draft: ['requested', 'needs_info', 'cancelled'],
    requested: ['pending_review', 'converted_to_rfq', 'cancelled'],
    pending_review: ['needs_info', 'converted_to_rfq', 'cancelled'],
    needs_info: ['requested', 'cancelled'],
    converted_to_rfq: [],
    cancelled: [],
  },
  sourcingEvent: {
    draft: ['internal_review', 'cancelled'],
    internal_review: ['open_draft', 'cancelled'],
    open_draft: ['collecting_responses', 'response_review', 'cancelled'],
    collecting_responses: ['response_review', 'cancelled'],
    response_review: ['award_recommended', 'cancelled'],
    award_recommended: ['closed', 'cancelled'],
    closed: [],
    cancelled: [],
  },
  supplierResponse: {
    draft: ['received', 'incomplete'],
    incomplete: ['received', 'not_selected'],
    received: ['shortlisted', 'not_selected'],
    shortlisted: ['not_selected'],
    not_selected: [],
  },
  awardRecommendation: {
    draft: ['review_required', 'rejected'],
    review_required: ['approved_for_po_draft', 'rejected'],
    approved_for_po_draft: [],
    rejected: [],
  },
  poDraft: {
    draft: ['review_required', 'cancelled'],
    review_required: ['ready_for_manual_issue', 'cancelled'],
    ready_for_manual_issue: ['cancelled'],
    cancelled: [],
  },
})

function text(value = '') {
  return String(value ?? '').trim()
}

export function normalizeProcurementStatus(documentType = '', status = '') {
  const type = text(documentType)
  const raw = text(status)
  const aliases = STATUS_ALIASES[type]
  if (!aliases) throw statusError('unsupported_document_type', `Unsupported procurement status group: ${type}.`, type, raw)
  const normalized = aliases[raw] || aliases[raw.toLowerCase()]
  if (!normalized || !PROCUREMENT_STATUS_GROUPS[type].includes(normalized)) {
    throw statusError('invalid_status', `Invalid ${type} status: ${raw}.`, type, raw)
  }
  return normalized
}

export function isValidProcurementStatus(documentType = '', status = '') {
  try {
    normalizeProcurementStatus(documentType, status)
    return true
  } catch {
    return false
  }
}

export function canTransitionProcurementStatus(documentType = '', fromStatus = '', toStatus = '') {
  const type = text(documentType)
  const from = normalizeProcurementStatus(type, fromStatus)
  const to = normalizeProcurementStatus(type, toStatus)
  return Boolean(SAFE_TRANSITIONS[type]?.[from]?.includes(to))
}

export function assertSafeProcurementTransition(documentType = '', fromStatus = '', toStatus = '') {
  if (!canTransitionProcurementStatus(documentType, fromStatus, toStatus)) {
    throw statusError('unsafe_status_transition', `Unsafe ${documentType} status transition: ${fromStatus} -> ${toStatus}.`, documentType, `${fromStatus}->${toStatus}`)
  }
  return normalizeProcurementStatus(documentType, toStatus)
}

function statusError(code, message, documentType, status) {
  const error = new Error(message)
  error.code = code
  error.documentType = documentType
  error.statusValue = status
  return error
}
