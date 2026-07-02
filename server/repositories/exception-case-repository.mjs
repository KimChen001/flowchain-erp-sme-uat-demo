import {
  createExceptionCaseDraft,
  normalizeExceptionCase,
  validateExceptionCase,
} from '../domain/exception-case-model.mjs'
import {
  assertExceptionCaseTransition,
  buildResolutionPayload,
  normalizeCaseNote,
  validateExceptionCaseFieldUpdate,
  workflowAuditEntry,
} from '../domain/exception-case-workflow.mjs'

function scopeKey(scope = {}) {
  return [
    scope.tenantId || 'demo-tenant',
    scope.userId || 'demo-user',
    scope.dataMode || scope.mode || 'json',
  ].join(':')
}

function ensureState(db = {}) {
  if (!db.__exceptionCaseState) {
    Object.defineProperty(db, '__exceptionCaseState', {
      value: { casesByScope: new Map(), draftsByScope: new Map() },
      enumerable: false,
      configurable: true,
      writable: true,
    })
  }
  return db.__exceptionCaseState
}

function listFor(state, scope) {
  const key = scopeKey(scope)
  if (!state.casesByScope.has(key)) state.casesByScope.set(key, [])
  return state.casesByScope.get(key)
}

function draftsFor(state, scope) {
  const key = scopeKey(scope)
  if (!state.draftsByScope.has(key)) state.draftsByScope.set(key, [])
  return state.draftsByScope.get(key)
}

export function createInMemoryExceptionCaseRepository({ db = {} } = {}) {
  return {
    previewCaseDraft: async (scope = {}, draftInput = {}) => {
      const state = ensureState(db)
      const draft = createExceptionCaseDraft(draftInput)
      const duplicate = findDuplicate(listFor(state, scope), draft.proposedCaseFields)
      const nextDraft = duplicate
        ? { ...draft, duplicateWarning: { caseId: duplicate.caseId, title: duplicate.title, message: 'Open case already exists for this source entity and case type.' } }
        : draft
      draftsFor(state, scope).unshift(nextDraft)
      return nextDraft
    },
    createCase: async (scope = {}, input = {}) => {
      const state = ensureState(db)
      if (input.confirm !== true && input.explicitConfirmation !== true) {
        const error = new Error('Explicit user confirmation is required to create an exception case.')
        error.status = 400
        error.code = 'EXCEPTION_CASE_CONFIRMATION_REQUIRED'
        throw error
      }
      const fields = input.case || input.proposedCaseFields || input
      const validation = validateExceptionCase({ ...fields, status: fields.status || 'open', severity: fields.severity || 'medium' })
      if (!validation.ok) {
        const error = new Error(`Invalid exception case: ${validation.errors.join(', ')}`)
        error.status = 400
        error.code = 'EXCEPTION_CASE_VALIDATION_FAILED'
        error.validation = validation
        throw error
      }
      const item = normalizeExceptionCase({
        ...fields,
        auditMetadata: { ...(fields.auditMetadata || {}), confirmation: 'user_confirmed', sourceTrigger: input.sourceTrigger || fields.sourceTrigger },
        notes: fields.notes || [],
        auditTrail: [
          ...(fields.auditTrail || []),
          workflowAuditEntry('exception_case_created', fields, input, { status: fields.status || 'open' }),
        ],
      })
      listFor(state, scope).unshift(item)
      return item
    },
    listCases: async (scope = {}, filters = {}) => {
      const state = ensureState(db)
      const rows = [...listFor(state, scope)]
      return rows.filter((item) => {
        if (filters.status && item.status !== filters.status) return false
        if (filters.caseType && item.caseType !== filters.caseType) return false
        if (filters.severity && item.severity !== filters.severity) return false
        return true
      })
    },
    getCaseById: async (scope = {}, caseId = '') => {
      const state = ensureState(db)
      return listFor(state, scope).find((item) => item.caseId === caseId) || null
    },
    addCaseNote: async (scope = {}, caseId = '', noteInput = {}) => {
      const state = ensureState(db)
      const rows = listFor(state, scope)
      const index = rows.findIndex((item) => item.caseId === caseId)
      if (index < 0) return null
      if (noteInput.confirm !== true && noteInput.explicitConfirmation !== true) {
        const error = new Error('Explicit user confirmation is required to save a case note.')
        error.status = 400
        error.code = 'EXCEPTION_CASE_NOTE_CONFIRMATION_REQUIRED'
        throw error
      }
      const note = normalizeCaseNote(noteInput)
      rows[index] = {
        ...rows[index],
        notes: [...(rows[index].notes || []), note],
        auditTrail: [...(rows[index].auditTrail || []), workflowAuditEntry('exception_case_note_added', rows[index], noteInput, { noteType: note.noteType })],
        updatedAt: note.createdAt,
      }
      return rows[index]
    },
    updateCaseStatus: async (scope = {}, caseId = '', statusInput = {}) => {
      const state = ensureState(db)
      const rows = listFor(state, scope)
      const index = rows.findIndex((item) => item.caseId === caseId)
      if (index < 0) return null
      const current = rows[index]
      const transition = assertExceptionCaseTransition(current.status, statusInput.status, statusInput)
      const resolution = statusInput.status === 'closed' ? buildResolutionPayload(statusInput, current) : current.resolution
      const note = statusInput.note || statusInput.reason || statusInput.resolutionNote
        ? normalizeCaseNote({ ...statusInput, body: statusInput.note || statusInput.reason || statusInput.resolutionNote, noteType: statusInput.status === 'closed' ? 'resolution' : 'system' })
        : null
      rows[index] = {
        ...current,
        status: statusInput.status,
        resolution,
        notes: note ? [...(current.notes || []), note] : current.notes,
        auditTrail: [
          ...(current.auditTrail || []),
          workflowAuditEntry(statusInput.status === 'closed' ? 'exception_case_closed' : 'exception_case_status_changed', current, statusInput, {
            previousStatus: transition.from,
            nextStatus: transition.to,
          }),
        ],
        updatedAt: statusInput.timestamp || new Date().toISOString(),
      }
      return rows[index]
    },
    updateCaseFields: async (scope = {}, caseId = '', updateInput = {}) => {
      const state = ensureState(db)
      const rows = listFor(state, scope)
      const index = rows.findIndex((item) => item.caseId === caseId)
      if (index < 0) return null
      const validation = validateExceptionCaseFieldUpdate(updateInput)
      if (!validation.ok) {
        const error = new Error(`Invalid exception case field update: ${validation.errors.join(', ')}`)
        error.status = 400
        error.code = validation.errors.includes('confirmation_required')
          ? 'EXCEPTION_CASE_UPDATE_CONFIRMATION_REQUIRED'
          : 'EXCEPTION_CASE_FIELD_UPDATE_INVALID'
        error.validation = validation
        throw error
      }
      const fields = updateInput.fields || updateInput
      const allowed = Object.fromEntries(Object.entries(fields).filter(([key]) => ['owner', 'dueDate', 'severity'].includes(key)))
      rows[index] = {
        ...rows[index],
        ...allowed,
        auditTrail: [...(rows[index].auditTrail || []), workflowAuditEntry('exception_case_fields_updated', rows[index], updateInput, { fields: Object.keys(allowed) })],
        updatedAt: updateInput.timestamp || new Date().toISOString(),
      }
      return rows[index]
    },
    findDuplicateCase: async (scope = {}, fields = {}) => {
      const state = ensureState(db)
      return findDuplicate(listFor(state, scope), fields)
    },
  }
}

function findDuplicate(rows, fields = {}) {
  return rows.find((item) =>
    item.caseType === fields.caseType &&
    item.sourceEntityType === fields.sourceEntityType &&
    item.sourceEntityId === fields.sourceEntityId &&
    !['closed', 'cancelled', 'resolved'].includes(item.status)
  ) || null
}
