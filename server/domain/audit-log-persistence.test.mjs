import test from 'node:test'
import assert from 'node:assert/strict'
import { createDatabaseRepositoryRegistry } from '../repositories/adapter-registry.mjs'
import { handleActionDraftsRoute } from '../routes/action-drafts.routes.mjs'
import { handleAiRoute } from '../routes/ai.routes.mjs'
import {
  legacyMutationBlockedAuditEntry,
  recordDatabaseAuditBestEffort,
} from './audit-policy.mjs'

function createDb() {
  return {
    products: [{ sku: 'A100', name: 'Motor A100', currentStock: 4, safetyStock: 10, supplier: 'ABC Components' }],
    suppliers: [{ id: 'SUP-001', name: 'ABC Components', risk: '中', onTimeRate: 90, qualityRate: 96 }],
    purchaseRequests: [{ pr: 'PR-1001', status: '待审批', sourceSku: 'A100', amount: 12000 }],
    purchaseOrders: [{ po: 'PO-1001', supplier: 'ABC Components', status: '已发出', eta: '2026-07-10' }],
    rfqs: [{ id: 'RFQ-1001', status: '进行中', suppliers: 3, quoted: 1 }],
    receivingDocs: [],
    inventoryMovements: [],
    forecastPlans: [],
    marketPrices: [],
    marketSignals: [],
    events: [],
    auditLog: [],
  }
}

function draft() {
  return {
    id: 'DRAFT-AUDIT-1',
    tenantId: 'tenant-flowchain-sme',
    type: 'purchase_request_draft',
    title: 'Purchase request draft',
    status: 'preview',
    source: 'test',
    requiresConfirmation: true,
    confirmationBoundary: { previewOnly: true, submitted: false },
    originEvidence: [{ type: 'inventory_item', id: 'A100' }],
    payload: { itemIdOrSku: 'A100', quantity: 10 },
    validation: { ok: true, missingFields: [], warnings: [], errors: [] },
    auditTrail: [{ action: 'ai_draft_prepared', summary: 'Prepared draft' }],
  }
}

function createActionDraftRoute({ body, repositories, db = createDb(), pathname = '/api/action-drafts' } = {}) {
  let response = null
  return {
    ctx: {
      req: { method: 'POST', body },
      res: {},
      url: new URL(pathname, 'http://localhost'),
      db,
      repositories,
      send(_res, status, payload) {
        response = { status, payload }
      },
      readBody: async (req) => req.body,
    },
    get response() {
      return response
    },
  }
}

function createAiRoute({ repositories } = {}) {
  const db = createDb()
  let response = null
  return {
    ctx: {
      req: { method: 'POST', body: { message: 'supplier SUP-001 status' }, headers: { authorization: 'Bearer user-token' } },
      res: {},
      url: new URL('/api/ai/chat', 'http://localhost'),
      db,
      repositories,
      send(_res, status, payload) {
        response = { status, payload }
      },
      readBody: async (req) => req.body,
      writeDb: async () => {
        throw new Error('JSON audit should not be used in database mode')
      },
      event: () => {
        throw new Error('JSON event should not be used in database mode')
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
    },
    get response() {
      return response
    },
  }
}

function createPrismaRecorder() {
  const auditWrites = []
  return {
    auditWrites,
    prisma: {
      actionDraft: {
        create: async ({ data }) => ({
          ...data,
          createdAt: new Date('2026-06-30T00:00:00.000Z'),
          updatedAt: new Date('2026-06-30T00:00:00.000Z'),
          validations: [],
          auditTrail: [],
        }),
      },
      auditLog: {
        create: async ({ data }) => {
          auditWrites.push(data)
          return {
            ...data,
            createdAt: data.createdAt || new Date('2026-06-30T00:00:00.000Z'),
          }
        },
        findMany: async () => auditWrites.map((item) => ({
          ...item,
          createdAt: item.createdAt || new Date('2026-06-30T00:00:00.000Z'),
        })),
      },
    },
  }
}

function databaseRepositories(prisma) {
  return createDatabaseRepositoryRegistry({
    db: createDb(),
    env: {
      FLOWCHAIN_PERSISTENCE_MODE: 'database',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/flowchain',
    },
    prisma,
  })
}

test('action draft save records best-effort DB audit without creating business documents', async () => {
  const { prisma, auditWrites } = createPrismaRecorder()
  const repositories = databaseRepositories(prisma)
  const route = createActionDraftRoute({ repositories, body: { draft: draft() } })

  assert.equal(await handleActionDraftsRoute(route.ctx), true)

  assert.equal(route.response.status, 201)
  assert.equal(route.response.payload.createsBusinessDocument, false)
  assert.equal(auditWrites.length, 1)
  assert.equal(auditWrites[0].action, 'draft_saved')
  assert.equal(auditWrites[0].entityType, 'actionDraft')
  assert.equal(auditWrites[0].entityId, 'DRAFT-AUDIT-1')
  assert.doesNotMatch(JSON.stringify(auditWrites), /itemIdOrSku|quantity|Bearer|DATABASE_URL|postgresql:\/\/user:pass/)
})

test('audit failure does not break action draft preview', async () => {
  const repositories = {
    actionDrafts: {
      getSchema: () => ({}),
      previewDraft: () => ({ ok: true, draft: draft() }),
    },
    auditLog: {
      mode: 'database',
      recordAuditEntry: async () => {
        throw new Error('audit unavailable with DATABASE_URL=postgresql://user:pass@db/app')
      },
    },
  }
  const route = createActionDraftRoute({
    repositories,
    pathname: '/api/action-drafts/preview',
    body: { type: 'purchase_request_draft', payload: { itemIdOrSku: 'A100', quantity: 10 } },
  })

  assert.equal(await handleActionDraftsRoute(route.ctx), true)

  assert.equal(route.response.status, 200)
  assert.equal(route.response.payload.previewOnly, true)
  assert.doesNotMatch(JSON.stringify(route.response.payload), /postgresql:\/\/user:pass|DATABASE_URL/)
})

test('legacy mutation blocked audit omits request body and redacts secrets', async () => {
  const writes = []
  const repositories = {
    auditLog: {
      mode: 'database',
      recordAuditEntry: async (entry) => {
        writes.push(entry)
        return entry
      },
    },
  }

  const result = await recordDatabaseAuditBestEffort(
    { repositories },
    legacyMutationBlockedAuditEntry({ method: 'POST', pathname: '/api/purchase-requests' }),
  )

  assert.equal(result.ok, true)
  assert.equal(writes[0].action, 'legacy_mutation_blocked')
  assert.equal(writes[0].entity.id, 'POST /api/purchase-requests')
  assert.doesNotMatch(JSON.stringify(writes), /sourceSku|quantity|authorization|Bearer|DATABASE_URL/)
})

test('read-only AI answer survives DB audit adapter failure', async () => {
  const repositories = {
    auditLog: {
      mode: 'database',
      recordAiEventBestEffort: async () => ({ ok: false, errorCode: 'FLOWCHAIN_DATABASE_CONFIG_MISSING' }),
    },
  }
  const route = createAiRoute({ repositories })

  await handleAiRoute(route.ctx)

  assert.equal(route.response.status, 200)
  assert.equal(route.response.payload.intent.name, 'supplier_status_query')
  assert.ok(route.response.payload.cards.length > 0)
  assert.doesNotMatch(JSON.stringify(route.response.payload), /FLOWCHAIN_DATABASE_CONFIG_MISSING|DATABASE_URL|Bearer/)
})
