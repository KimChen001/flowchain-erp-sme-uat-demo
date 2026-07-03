import {
  buildAwardRecommendationDraft,
  buildOperationalPurchaseRequestDetail,
  buildPoDraftFromAwardRecommendation,
  buildRfqDraftFromPurchaseRequest,
  buildSupplierResponse,
  compareSupplierResponses,
  PROCUREMENT_TRANSACTION_BASELINE,
} from '../domain/procurement-transaction-core.mjs'

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null))
}

function text(value = '') {
  return String(value ?? '').trim()
}

function scopeKey(scope = {}) {
  return `${text(scope.tenantId) || 'tenant-flowchain-sme'}::${text(scope.userId) || 'user-local'}::${text(scope.dataMode) || 'json'}`
}

function ensureState(db = {}) {
  if (!db.__procurementTransactionState) {
    Object.defineProperty(db, '__procurementTransactionState', {
      value: { recordsByScope: new Map(), counters: new Map() },
      enumerable: false,
      configurable: true,
      writable: true,
    })
  }
  return db.__procurementTransactionState
}

function bucket(state, scope = {}) {
  const key = scopeKey(scope)
  if (!state.recordsByScope.has(key)) {
    state.recordsByScope.set(key, { rfqDrafts: [], supplierResponses: [], comparisons: [], awardRecommendations: [], poDrafts: [] })
  }
  return state.recordsByScope.get(key)
}

function nextId(state, scope = {}, prefix = 'PTX') {
  const key = `${scopeKey(scope)}::${prefix}`
  const next = Number(state.counters.get(key) || 0) + 1
  state.counters.set(key, next)
  return `${prefix}-${String(next).padStart(6, '0')}`
}

function findPurchaseRequest(db = {}, id = '') {
  const wanted = text(id)
  return (Array.isArray(db.purchaseRequests) ? db.purchaseRequests : []).find((item) => text(item.pr || item.prId || item.id) === wanted) || null
}

export function createInMemoryProcurementTransactionRepository({ db = {} } = {}) {
  const repository = {
    adapter: 'in-memory-procurement-transaction-v1',
    getBaseline: async () => clone(PROCUREMENT_TRANSACTION_BASELINE),
    getPurchaseRequestDetail: async (id = '', scope = {}) => {
      const pr = findPurchaseRequest(db, id)
      return pr ? buildOperationalPurchaseRequestDetail(pr, { rfqs: db.rfqs || [] }) : null
    },
    createRfqDraftFromPr: async (input = {}, scope = {}) => {
      const state = ensureState(db)
      const pr = input.prDetail || buildOperationalPurchaseRequestDetail(findPurchaseRequest(db, input.prId) || input.pr || {}, { rfqs: db.rfqs || [] })
      const result = buildRfqDraftFromPurchaseRequest(pr, { ...input, id: nextId(state, scope, input.actionType === 'create_sourcing_event' ? 'SRC-DRAFT' : 'RFQ-DRAFT') })
      if (result.ok) bucket(state, scope).rfqDrafts.unshift(result.record)
      return clone(result)
    },
    createSupplierResponse: async (input = {}, scope = {}) => {
      const state = ensureState(db)
      const response = buildSupplierResponse({ ...input, id: input.id || nextId(state, scope, 'RESP') })
      if (!response.rfqId) {
        const error = new Error('Supplier response requires linked RFQ or sourcing event.')
        error.status = 422
        error.code = 'SUPPLIER_RESPONSE_REQUIRES_RFQ'
        error.response = response
        throw error
      }
      bucket(state, scope).supplierResponses.unshift(response)
      return clone(response)
    },
    listSupplierResponses: async (scope = {}, filters = {}) => {
      const rows = bucket(ensureState(db), scope).supplierResponses
      return clone(rows.filter((item) => !filters.rfqId || item.rfqId === filters.rfqId || item.sourcingEventId === filters.rfqId))
    },
    compareResponses: async (input = {}, scope = {}) => {
      const state = ensureState(db)
      const responses = input.responses || bucket(state, scope).supplierResponses.filter((item) => !input.rfqId || item.rfqId === input.rfqId || item.sourcingEventId === input.rfqId)
      const comparison = { id: nextId(state, scope, 'CMP'), rfqId: input.rfqId || responses[0]?.rfqId || '', ...compareSupplierResponses(responses, { suppliers: db.suppliers || db.supplierMasters || [] }) }
      bucket(state, scope).comparisons.unshift(comparison)
      return clone(comparison)
    },
    buildAwardRecommendation: async (input = {}, scope = {}) => {
      const state = ensureState(db)
      const comparison = input.comparison || bucket(state, scope).comparisons.find((item) => item.id === input.comparisonId || item.rfqId === input.rfqId) || await repository.compareResponses(input, scope)
      const recommendation = buildAwardRecommendationDraft({ ...input, id: input.id || nextId(state, scope, 'AWARD-DRAFT'), comparison })
      bucket(state, scope).awardRecommendations.unshift(recommendation)
      return clone(recommendation)
    },
    buildPoDraft: async (input = {}, scope = {}) => {
      const state = ensureState(db)
      const recommendation = input.recommendation || bucket(state, scope).awardRecommendations.find((item) => item.id === input.awardRecommendationId || item.rfqId === input.rfqId) || {}
      const poDraft = buildPoDraftFromAwardRecommendation(recommendation, { ...input, id: input.id || nextId(state, scope, 'PO-DRAFT') })
      bucket(state, scope).poDrafts.unshift(poDraft)
      return clone(poDraft)
    },
    getChain: async (scope = {}, filters = {}) => {
      const store = bucket(ensureState(db), scope)
      return clone({
        purchaseRequestId: text(filters.prId),
        rfqId: text(filters.rfqId),
        rfqDrafts: store.rfqDrafts.filter((item) => (!filters.prId || item.sourcePrId === filters.prId) && (!filters.rfqId || item.id === filters.rfqId || item.fields?.sourcePrId === filters.prId)),
        supplierResponses: store.supplierResponses.filter((item) => !filters.rfqId || item.rfqId === filters.rfqId || item.sourcingEventId === filters.rfqId),
        comparisons: store.comparisons.filter((item) => !filters.rfqId || item.rfqId === filters.rfqId),
        awardRecommendations: store.awardRecommendations.filter((item) => !filters.rfqId || item.rfqId === filters.rfqId),
        poDrafts: store.poDrafts.filter((item) => !filters.rfqId || item.sourceRfq === filters.rfqId),
      })
    },
    _debugState: () => clone(Array.from(ensureState(db).recordsByScope.values())),
  }
  return repository
}
