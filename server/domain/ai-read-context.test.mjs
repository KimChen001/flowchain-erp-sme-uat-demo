import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAiCockpitFastPathResponse } from './ai-evidence-reuse.mjs'
import { buildAiReadContext } from './ai-read-context.mjs'
import { handleAiRoute } from '../routes/ai.routes.mjs'

function createDb() {
  return {
    products: [{ sku: 'JSON-1', name: 'JSON Item', currentStock: 10, safetyStock: 20, unit: 'pcs' }],
    suppliers: [],
    purchaseOrders: [],
    purchaseRequests: [],
    rfqs: [],
    receivingDocs: [],
    inventoryMovements: [],
    forecastPlans: [],
    marketPrices: [],
    marketSignals: [],
    events: [],
    auditLog: [],
  }
}

function repositoryContext() {
  return {
    repositories: {
      masterData: {
        listItems: async () => [{ sku: 'A100', name: 'Motor A100' }],
        listSuppliers: async () => [{ id: 'SUP-1', name: 'ABC Components' }],
      },
      procurementRead: {
        listDocuments: async () => [{ id: 'PO-DB-1', documentType: 'po', status: 'issued', supplierName: 'ABC Components', amount: 1200, currency: 'CNY', evidence: [{ type: 'po', id: 'PO-DB-1', label: 'PO-DB-1' }] }],
        listFollowups: async () => [{ id: 'FOLLOWUP-DB-1', type: 'po_overdue', title: 'Review PO', documentType: 'po', documentId: 'PO-DB-1', status: 'open', evidence: [{ type: 'po', id: 'PO-DB-1', label: 'PO-DB-1' }] }],
        getSummary: async () => ({ documentCount: 1, purchaseOrderCount: 1, followupCount: 1 }),
      },
      inventoryRead: {
        listItems: async () => [{ sku: 'A100', itemName: 'Motor A100', availableQuantity: 2, safetyStock: 10, status: '低库存', riskLevel: '高', unit: 'pcs' }],
        listExceptions: async () => [{ id: 'IEX-DB-1', sku: 'A100', status: '待复核', nextAction: 'Review shortage', quantityImpact: -8 }],
        getSummary: async () => ({ itemCount: 1, lowStockCount: 1, highRiskCount: 1, exceptionCount: 1 }),
      },
      auditLog: {
        mode: 'database',
        recordAiEventBestEffort: async () => ({ ok: true }),
      },
    },
  }
}

function routeContext({ db = createDb(), ctxPatch = repositoryContext(), body = { message: 'A100 库存风险为什么' } } = {}) {
  let response = null
  return {
    ctx: {
      req: { method: 'POST', body, headers: {} },
      res: {},
      url: new URL('/api/ai/chat', 'http://localhost'),
      db,
      send(_res, status, payload) {
        response = { status, payload }
      },
      readBody: async (req) => req.body,
      writeDb: async () => {
        throw new Error('JSON write should not be used')
      },
      event: () => {
        throw new Error('JSON event should not be used')
      },
      ensurePurchaseRequests: (nextDb) => nextDb.purchaseRequests || [],
      ensureInventoryMovements: (nextDb) => nextDb.inventoryMovements || [],
      ensureRfqs: (nextDb) => nextDb.rfqs || [],
      supplierPerformance: () => [],
      supplierRecommendations: () => null,
      supplierQuoteCount: 0,
      openaiDispatcher: { dispatch() { throw new Error('provider should not be reached') } },
      arkDispatcher: { dispatch() { throw new Error('ark should not be reached') } },
      aiMaxTokens: 120,
      ...ctxPatch,
    },
    get response() {
      return response
    },
  }
}

test('AI read context builds evidence cache from repositories without mutating db', async () => {
  const db = createDb()
  const before = JSON.stringify(db)
  const context = await buildAiReadContext(db, repositoryContext())

  assert.equal(context.repositoryBacked.masterData, true)
  assert.equal(context.repositoryBacked.procurementRead, true)
  assert.equal(context.repositoryBacked.inventoryRead, true)
  assert.equal(context.cache.aiEvidenceReuse.inventoryItems[0].sku, 'A100')
  assert.equal(context.cache.aiEvidenceReuse.procurementDocuments[0].id, 'PO-DB-1')
  assert.equal(context.masterData.items[0].sku, 'A100')
  assert.equal(JSON.stringify(db), before)
})

test('AI evidence reuse can answer from repository-backed cache', async () => {
  const db = createDb()
  const context = await buildAiReadContext(db, repositoryContext())
  const result = buildAiCockpitFastPathResponse(db, { message: 'A100 库存风险为什么', moduleId: 'overview' }, { cache: context.cache })

  assert.equal(result.intent.name, 'inventory_status_query')
  assert.equal(result.cards.some((card) => JSON.stringify(card).includes('A100')), true)
  assert.equal(JSON.stringify(result).includes('JSON-1'), false)
})

test('AI route uses repository-backed read cache for deterministic evidence answers', async () => {
  const route = routeContext()

  await handleAiRoute(route.ctx)

  assert.equal(route.response.status, 200)
  assert.equal(route.response.payload.intent.name, 'inventory_status_query')
  assert.equal(JSON.stringify(route.response.payload).includes('A100'), true)
  assert.equal(JSON.stringify(route.response.payload).includes('JSON-1'), false)
})

test('AI read context surfaces DB config errors only when DB-backed reads are invoked', async () => {
  await assert.rejects(
    () => buildAiReadContext(createDb(), {
      repositories: {
        inventoryRead: {
          listItems: async () => { const error = new Error('DATABASE_URL is required when FLOWCHAIN_PERSISTENCE_MODE=database.'); error.code = 'FLOWCHAIN_DATABASE_CONFIG_MISSING'; throw error },
          listExceptions: async () => [],
          getSummary: async () => ({}),
        },
      },
    }),
    (error) => error.code === 'FLOWCHAIN_DATABASE_CONFIG_MISSING'
  )
})
