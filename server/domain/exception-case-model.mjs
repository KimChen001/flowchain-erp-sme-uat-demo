export const EXCEPTION_CASE_TYPES = Object.freeze([
  'po_delay',
  'sku_shortage',
  'receiving_exception',
  'invoice_matching_failure',
  'supplier_risk',
  'rfq_timing_risk',
  'data_completeness_gap',
  'general_operational_exception',
])

export const EXCEPTION_CASE_STATUSES = Object.freeze([
  'open',
  'in_review',
  'waiting_supplier',
  'waiting_internal',
  'resolved',
  'closed',
  'cancelled',
])

export const EXCEPTION_CASE_SEVERITIES = Object.freeze(['critical', 'high', 'medium', 'low'])

export const FORBIDDEN_EXCEPTION_CASE_AI_ACTIONS = Object.freeze([
  'auto_create_case',
  'auto_close_case',
  'auto_resolve_case',
  'auto_send_supplier_email',
  'auto_modify_business_data',
  'auto_submit',
  'auto_approve',
  'auto_pay',
  'auto_post',
])

export const CASE_REVIEW_ACTIONS = Object.freeze([
  'edit_case_draft',
  'save_case_draft',
  'confirm_create_case',
  'copy_case_summary',
  'preview_followup_note',
  'cancel',
])

let caseCounter = 0
let draftCounter = 0

function text(value = '') {
  return String(value ?? '').trim()
}

function nextId(prefix) {
  const counter = prefix === 'ECD' ? ++draftCounter : ++caseCounter
  return `${prefix}-${String(counter).padStart(6, '0')}`
}

function validOrFallback(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback
}

function normalizeLinkedRecord(record = {}) {
  const type = text(record.entityType || record.type || record.sourceEntityType)
  const id = text(record.entityId || record.id || record.sourceEntityId)
  return {
    entityType: type || 'unknown',
    entityId: id,
    displayLabel: text(record.displayLabel || record.label) || id || 'Related record',
    route: text(record.route),
    relationshipLabel: text(record.relationshipLabel) || 'Related record',
    recordFound: record.recordFound !== false,
  }
}

function normalizeEvidenceItem(item = {}) {
  const riskLevel = validOrFallback(text(item.riskLevel), ['critical', 'high', 'medium', 'low', 'none'], 'none')
  return {
    id: text(item.id) || text(item.sourceEntityId) || 'evidence',
    title: text(item.title) || 'Evidence',
    sourceModule: text(item.sourceModule),
    sourceEntityType: text(item.sourceEntityType),
    sourceEntityId: text(item.sourceEntityId),
    evidenceType: text(item.evidenceType),
    summary: text(item.summary),
    riskLevel,
    reason: reasonText(item.reason),
    route: text(item.route),
  }
}

function reasonText(value) {
  const raw = text(value)
  if (!raw || ['高', '中', '低', 'high', 'medium', 'low'].includes(raw)) return 'Current evidence provides risk level separately; reason requires business review.'
  return raw
}

export function normalizeExceptionCase(input = {}) {
  const now = input.now || new Date().toISOString()
  const caseType = validOrFallback(input.caseType, EXCEPTION_CASE_TYPES, 'general_operational_exception')
  const severity = validOrFallback(input.severity, EXCEPTION_CASE_SEVERITIES, 'medium')
  const status = validOrFallback(input.status, EXCEPTION_CASE_STATUSES, 'open')
  const sourceEntityId = text(input.sourceEntityId)
  return {
    caseId: text(input.caseId) || nextId('EC'),
    caseType,
    title: text(input.title) || titleFor(caseType, sourceEntityId),
    summary: text(input.summary) || 'Exception case requires review.',
    severity,
    status,
    owner: text(input.owner) || 'Unassigned',
    dueDate: text(input.dueDate),
    sourceModule: text(input.sourceModule),
    sourceEntityType: text(input.sourceEntityType),
    sourceEntityId,
    linkedRecords: (input.linkedRecords || []).map(normalizeLinkedRecord).filter((item) => item.entityId),
    evidenceItems: (input.evidenceItems || input.evidence || []).map(normalizeEvidenceItem),
    dataLimitations: [...new Set((input.dataLimitations || []).map(text).filter(Boolean))],
    aiDiagnosisSummary: text(input.aiDiagnosisSummary),
    recommendedReviewFirstActions: input.recommendedReviewFirstActions || defaultActionsFor(caseType),
    draftReferences: input.draftReferences || [],
    notes: input.notes || [],
    auditMetadata: {
      sourceTrigger: text(input.auditMetadata?.sourceTrigger || input.sourceTrigger),
      createdBy: text(input.auditMetadata?.createdBy || input.createdBy || 'system'),
      confirmation: input.auditMetadata?.confirmation || 'user_confirmed',
      mutationBoundary: 'exception_case_only',
    },
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
  }
}

export function validateExceptionCase(input = {}) {
  const errors = []
  if (!text(input.title)) errors.push('title_required')
  if (!EXCEPTION_CASE_TYPES.includes(input.caseType)) errors.push('case_type_invalid')
  if (!EXCEPTION_CASE_STATUSES.includes(input.status || 'open')) errors.push('status_invalid')
  if (!EXCEPTION_CASE_SEVERITIES.includes(input.severity || 'medium')) errors.push('severity_invalid')
  if (!text(input.sourceEntityId)) errors.push('source_entity_required')
  return { ok: errors.length === 0, errors }
}

export function createExceptionCaseDraft(input = {}) {
  const proposed = normalizeExceptionCase({
    ...input.proposedCaseFields,
    ...input,
    caseId: input.proposedCaseFields?.caseId || '',
    status: input.proposedCaseFields?.status || 'open',
    auditMetadata: { sourceTrigger: input.sourceTrigger || 'ai_insight', confirmation: 'not_created_from_draft' },
  })
  const missingFields = [
    !proposed.owner || proposed.owner === 'Unassigned' ? 'owner' : '',
    !proposed.dueDate ? 'dueDate' : '',
    !proposed.severity ? 'severity' : '',
    !proposed.sourceEntityId ? 'sourceEntityId' : '',
  ].filter(Boolean)
  return {
    draftId: text(input.draftId) || nextId('ECD'),
    sourceTrigger: text(input.sourceTrigger) || 'ai_insight',
    proposedCaseFields: proposed,
    missingFields: [...new Set([...(input.missingFields || []), ...missingFields])],
    assumptions: input.assumptions || ['Draft Only', 'Requires Review', 'User confirmation is required before case creation.'],
    reviewStatus: 'draft_only_requires_review',
    allowedUserActions: [...CASE_REVIEW_ACTIONS],
    forbiddenAiActions: [...FORBIDDEN_EXCEPTION_CASE_AI_ACTIONS],
    auditPreview: input.auditPreview || [
      { action: 'case_draft_generated', summary: `${proposed.caseType} case draft prepared for review.` },
      { action: 'case_creation_requires_confirmation', summary: 'No exception case record is created until explicit user confirmation.' },
    ],
    duplicateWarning: input.duplicateWarning || null,
    requiresReview: true,
    mutationAllowed: false,
    autonomousExecutionAllowed: false,
    createsCaseRecord: false,
  }
}

export function titleFor(caseType, sourceEntityId = '') {
  const labels = {
    po_delay: 'PO delay case',
    sku_shortage: 'SKU shortage case',
    receiving_exception: 'Receiving exception case',
    invoice_matching_failure: 'Invoice matching failure case',
    supplier_risk: 'Supplier risk case',
    rfq_timing_risk: 'RFQ timing risk case',
    data_completeness_gap: 'Data completeness gap case',
    general_operational_exception: 'Operational exception case',
  }
  return sourceEntityId ? `${labels[caseType] || labels.general_operational_exception}: ${sourceEntityId}` : labels[caseType] || labels.general_operational_exception
}

export function defaultActionsFor(caseType) {
  const common = ['assign_owner', 'review_evidence', 'add_internal_note']
  if (caseType === 'po_delay') return [...common, 'preview_supplier_followup']
  if (caseType === 'sku_shortage') return [...common, 'preview_purchase_request_draft']
  if (caseType === 'invoice_matching_failure') return [...common, 'review_three_way_match']
  if (caseType === 'receiving_exception') return [...common, 'review_grn_evidence']
  return common
}
