import { createExceptionCaseDraft, titleFor } from './exception-case-model.mjs'

const EVIDENCE_TO_CASE_TYPE = {
  po_delay: 'po_delay',
  sku_shortage: 'sku_shortage',
  receiving_exception: 'receiving_exception',
  invoice_matching: 'invoice_matching_failure',
  invoice_matching_failure: 'invoice_matching_failure',
  supplier_risk: 'supplier_risk',
  rfq_timing: 'rfq_timing_risk',
  rfq_timing_risk: 'rfq_timing_risk',
}

const SOURCE_TYPE_TO_CASE_TYPE = {
  purchaseOrder: 'po_delay',
  po: 'po_delay',
  sku: 'sku_shortage',
  item: 'sku_shortage',
  grn: 'receiving_exception',
  receiving: 'receiving_exception',
  invoice: 'invoice_matching_failure',
  supplier: 'supplier_risk',
  rfq: 'rfq_timing_risk',
  data: 'data_completeness_gap',
}

function text(value = '') {
  return String(value ?? '').trim()
}

function severityFromEvidence(evidence = []) {
  if (evidence.some((item) => item.riskLevel === 'critical')) return 'critical'
  if (evidence.some((item) => item.riskLevel === 'high')) return 'high'
  if (evidence.some((item) => item.riskLevel === 'medium')) return 'medium'
  return 'low'
}

function sourceFromBundle(bundle = {}) {
  const evidence = bundle.evidence || bundle.evidenceItems || []
  const first = evidence[0] || {}
  return {
    sourceModule: text(first.sourceModule) || moduleFor(bundle.sourceEntityType),
    sourceEntityType: text(bundle.sourceEntityType || first.sourceEntityType),
    sourceEntityId: text(bundle.sourceEntityId || first.sourceEntityId),
  }
}

function normalizedSourceContext(input = {}) {
  const context = input.sourceContext || input
  const sourceEntityType = text(context.sourceEntityType || context.entityType)
  const sourceEntityId = text(context.sourceEntityId || context.entityId)
  const sourceModule = text(context.sourceModule || context.module) || moduleFor(sourceEntityType)
  const sourceRoute = text(context.sourceRoute || context.route)
  const caseType = text(input.caseType || context.caseType) || SOURCE_TYPE_TO_CASE_TYPE[sourceEntityType] || 'general_operational_exception'
  const linkedRecords = input.linkedRecords || context.linkedRecords || (sourceEntityType && sourceEntityId
    ? [{ entityType: sourceEntityType, entityId: sourceEntityId, displayLabel: sourceEntityId, route: sourceRoute || sourceModule, relationshipLabel: 'Primary source' }]
    : [])
  return {
    sourceModule,
    sourceEntityType,
    sourceEntityId,
    sourceRoute,
    caseType,
    linkedRecords,
    evidenceReferences: input.evidenceReferences || context.evidenceReferences || [],
    dataLimitations: input.dataLimitations || context.dataLimitations || [],
  }
}

export function hasExceptionCaseSourceContext(input = {}) {
  const context = normalizedSourceContext(input)
  return Boolean(context.sourceEntityType && context.sourceEntityId && context.caseType)
}

export function buildExceptionCaseDraftFromSourceContext(input = {}) {
  const context = normalizedSourceContext(input)
  const evidence = input.evidenceItems || input.evidence || context.evidenceReferences || []
  const dataLimitations = [...context.dataLimitations]
  if (!evidence.length) dataLimitations.push('source_context_has_no_evidence_items')
  if (!context.linkedRecords.length) dataLimitations.push('linked_records_not_available')
  return createExceptionCaseDraft({
    sourceTrigger: input.sourceTrigger || context.sourceModule || 'source_context',
    caseType: context.caseType,
    title: input.title || titleFor(context.caseType, context.sourceEntityId),
    summary: input.summary || `${context.sourceEntityId} requires exception case review from ${context.sourceModule || 'business context'}.`,
    severity: input.severity || severityFromEvidence(evidence),
    status: 'open',
    owner: input.suggestedOwner || input.owner || '',
    dueDate: input.suggestedDueDate || input.dueDate || '',
    sourceModule: context.sourceModule,
    sourceEntityType: context.sourceEntityType,
    sourceEntityId: context.sourceEntityId,
    linkedRecords: context.linkedRecords,
    evidenceItems: evidence,
    dataLimitations,
    aiDiagnosisSummary: input.aiDiagnosisSummary || 'Draft prepared from explicit source context. Evidence must be reviewed before creating a case.',
    recommendedReviewFirstActions: input.recommendedReviewFirstActions,
    assumptions: [
      'Draft Only',
      'Requires Review',
      'Source context was explicit; missing relationships were not invented.',
      ...(input.assumptions || []),
    ],
  })
}

export function buildExceptionCaseDraftFromEvidence(input = {}) {
  const evidence = input.evidenceItems || input.evidence || input.bundle?.evidence || []
  const bundle = input.bundle || input
  const firstEvidence = evidence[0] || {}
  const caseType = input.caseType || EVIDENCE_TO_CASE_TYPE[firstEvidence.evidenceType] || EVIDENCE_TO_CASE_TYPE[input.evidenceType] || 'general_operational_exception'
  const source = sourceFromBundle(bundle)
  const linkedRecords = [...(input.linkedRecords || bundle.linkedRecords || [])]
  const dataLimitations = [...(input.dataLimitations || bundle.dataLimitations || [])]
  if (!linkedRecords.length) dataLimitations.push('linked_records_not_available')

  return createExceptionCaseDraft({
    sourceTrigger: input.sourceTrigger || 'ai_insight',
    caseType,
    title: input.title || titleFor(caseType, source.sourceEntityId),
    summary: input.summary || firstEvidence.summary || 'Exception case suggested from operational evidence.',
    severity: input.severity || severityFromEvidence(evidence),
    status: 'open',
    owner: input.suggestedOwner || input.owner || '',
    dueDate: input.suggestedDueDate || input.dueDate || '',
    ...source,
    linkedRecords,
    evidenceItems: evidence,
    dataLimitations,
    aiDiagnosisSummary: input.aiDiagnosisSummary || firstEvidence.reason || '',
    recommendedReviewFirstActions: input.recommendedReviewFirstActions,
    assumptions: [
      'Draft Only',
      'Requires Review',
      'Evidence and linked records are copied as references only.',
      ...(input.assumptions || []),
    ],
  })
}

export function buildCaseNoteDraft(input = {}) {
  return {
    draftId: input.draftId || `ECN-${Date.now()}`,
    caseId: text(input.caseId),
    noteType: input.noteType || 'internal_followup_note',
    body: text(input.body || input.summary || 'Please review the exception case evidence and next action.'),
    sourceTrigger: input.sourceTrigger || 'case_detail',
    reviewStatus: 'draft_only_requires_review',
    allowedUserActions: ['edit_note', 'save_note_after_confirmation', 'copy_note', 'cancel'],
    forbiddenAiActions: ['auto_save_note', 'auto_send_supplier_email', 'auto_close_case', 'auto_modify_business_data'],
    auditPreview: [
      { action: 'note_draft_generated', summary: 'Case note draft prepared for review.' },
      { action: 'note_save_requires_confirmation', summary: 'User confirmation is required before saving note.' },
    ],
    requiresReview: true,
    mutationAllowed: false,
    autonomousExecutionAllowed: false,
  }
}

function moduleFor(entityType = '') {
  if (entityType === 'sku' || entityType === 'item') return 'inventory'
  if (entityType === 'supplier') return 'srm'
  if (entityType === 'grn' || entityType === 'receiving') return 'receiving'
  if (entityType === 'invoice') return 'invoice-matching'
  if (entityType === 'rfq') return 'procurement'
  return 'procurement'
}
