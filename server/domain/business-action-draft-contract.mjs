export const BUSINESS_DRAFT_TYPES = Object.freeze([
  'supplier_application',
  'purchase_request',
  'sourcing_event',
  'rfq',
  'purchase_order',
  'supplier_followup',
  'exception_note',
])

export const ALLOWED_DRAFT_USER_ACTIONS = Object.freeze([
  'edit_draft',
  'save_draft',
  'mark_reviewed',
  'copy_draft',
  'continue_filling_fields',
  'cancel',
])

export const FORBIDDEN_AI_ACTIONS = Object.freeze([
  'auto_submit',
  'auto_approve',
  'auto_pay',
  'auto_post',
  'auto_send_email',
  'auto_modify_business_data',
  'issue_po',
])

let draftCounter = 0
let sessionCounter = 0

function nextId(prefix) {
  const next = prefix === 'BAD' ? ++draftCounter : ++sessionCounter
  return `${prefix}-${String(next).padStart(6, '0')}`
}

function text(value = '') {
  return String(value ?? '').trim()
}

export function createBusinessActionDraft(input = {}) {
  const draftType = BUSINESS_DRAFT_TYPES.includes(input.draftType) ? input.draftType : 'exception_note'
  const requiredFields = Array.isArray(input.requiredFields) ? input.requiredFields : []
  const fields = input.extractedFields || {}
  const missingFields = Array.isArray(input.missingFields)
    ? input.missingFields
    : requiredFields.filter((field) => fields[field] === undefined || fields[field] === '')
  const draft = {
    draftId: input.draftId || nextId('BAD'),
    draftType,
    sourceTrigger: input.sourceTrigger || 'natural_language',
    userText: text(input.userText),
    sourceContext: input.sourceContext || {},
    extractedFields: fields,
    suggestedFields: input.suggestedFields || {},
    requiredFields,
    missingFields,
    linkedRecords: input.linkedRecords || [],
    evidence: input.evidence || [],
    dataLimitations: input.dataLimitations || [],
    assumptions: input.assumptions || [],
    reviewStatus: input.reviewStatus || 'draft_only_requires_review',
    allowedUserActions: [...ALLOWED_DRAFT_USER_ACTIONS],
    forbiddenAiActions: [...FORBIDDEN_AI_ACTIONS],
    requiresReview: true,
    mutationAllowed: false,
    autonomousExecutionAllowed: false,
    createsBusinessDocument: false,
    auditPreview: input.auditPreview || [
      { action: 'command_interpreted', summary: text(input.userText) || 'Natural language draft request interpreted.' },
      { action: 'draft_generated', summary: `${draftType} draft prepared for review only.` },
    ],
  }
  return draft
}

export function createDraftSession(draft, options = {}) {
  return {
    sessionId: options.sessionId || nextId('BDS'),
    draftId: draft.draftId,
    draftType: draft.draftType,
    currentFields: { ...(draft.extractedFields || {}), ...(draft.suggestedFields || {}) },
    missingFields: [...(draft.missingFields || [])],
    updateHistory: [
      { action: 'draft_generated', summary: `${draft.draftType} draft opened for multi-turn completion.`, userText: draft.userText || '' },
    ],
    reviewStatus: 'draft_only_requires_review',
    sourceContext: draft.sourceContext || {},
    conflicts: [],
    auditPreview: [...(draft.auditPreview || [])],
    requiresReview: true,
    mutationAllowed: false,
    forbiddenAiActions: [...FORBIDDEN_AI_ACTIONS],
  }
}

export function updateDraftSession(session, update = {}, resolver = {}) {
  const newFields = update.fields || {}
  const conflicts = []
  const currentFields = { ...(session.currentFields || {}) }
  for (const [key, value] of Object.entries(newFields)) {
    if (currentFields[key] !== undefined && currentFields[key] !== value) {
      conflicts.push({ field: key, existingValue: currentFields[key], proposedValue: value, requiresReview: true })
      continue
    }
    currentFields[key] = value
  }
  if (resolver.extractedSlots) {
    for (const [key, slot] of Object.entries(resolver.extractedSlots)) {
      const value = slot?.value ?? slot
      if (currentFields[key] !== undefined && currentFields[key] !== value) {
        conflicts.push({ field: key, existingValue: currentFields[key], proposedValue: value, requiresReview: true })
        continue
      }
      currentFields[key] = value
    }
  }
  const missingFields = (session.missingFields || []).filter((field) => currentFields[field] === undefined || currentFields[field] === '')
  const updateEntry = {
    action: conflicts.length ? 'user_added_fields_with_conflict' : 'user_added_fields',
    summary: update.userText || 'User supplied additional draft fields.',
    conflicts,
  }
  return {
    ...session,
    currentFields,
    missingFields,
    conflicts: [...(session.conflicts || []), ...conflicts],
    updateHistory: [...(session.updateHistory || []), updateEntry],
    auditPreview: [
      ...(session.auditPreview || []),
      { action: 'user_added_fields', summary: update.userText || 'User supplied additional draft fields.' },
      ...(conflicts.length ? [{ action: 'field_conflict_requires_review', summary: `${conflicts.length} field conflict(s) require review.` }] : []),
    ],
    requiresReview: true,
    mutationAllowed: false,
  }
}
