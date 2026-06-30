import test from 'node:test'
import assert from 'node:assert/strict'
import { createDatabaseRepositoryRegistry, createRepositoryRegistry } from '../repositories/adapter-registry.mjs'
import { handleActionDraftsRoute } from '../routes/action-drafts.routes.mjs'
import { DATABASE_CONFIG_ERROR } from '../persistence/persistence-config.mjs'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function createDb() {
  return {
    products: [{ sku: 'A100', name: 'Motor A100', currentStock: 4, safetyStock: 10, supplier: 'ABC Components' }],
    suppliers: [{ id: 'SUP-1', name: 'ABC Components' }],
    purchaseRequests: [],
    rfqs: [],
    purchaseOrders: [],
    receivingDocs: [],
  }
}

function createRouteContext({ method = 'POST', pathname = '/api/action-drafts', body = {}, db = createDb(), repositories } = {}) {
  let response = null
  let wrote = false
  return {
    ctx: {
      req: { method, body },
      res: {},
      url: new URL(pathname, 'http://localhost'),
      db,
      repositories,
      send(_res, status, payload) {
        response = { status, payload }
      },
      readBody: async (req) => req.body,
      writeDb: async () => { wrote = true },
    },
    get response() {
      return response
    },
    get wrote() {
      return wrote
    },
  }
}

function draft() {
  return {
    id: 'DRAFT-SAVE-1',
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

test('action draft preview route remains non-mutating and never calls persistDraft', async () => {
  const db = createDb()
  const before = clone(db)
  const repositories = {
    actionDrafts: {
      getSchema: () => ({}),
      previewDraft: () => ({ ok: true, draft: draft() }),
      persistDraft: async () => {
        throw new Error('persistDraft should not run for preview')
      },
    },
  }
  const route = createRouteContext({
    pathname: '/api/action-drafts/preview',
    body: { type: 'purchase_request_draft', payload: { itemIdOrSku: 'A100', quantity: 10 } },
    db,
    repositories,
  })

  assert.equal(await handleActionDraftsRoute(route.ctx), true)
  assert.equal(route.response.status, 200)
  assert.equal(route.response.payload.previewOnly, true)
  assert.equal(route.wrote, false)
  assert.deepEqual(db, before)
})

test('JSON mode save route returns demo-safe not implemented without mutating business data', async () => {
  const db = createDb()
  const before = clone(db)
  const route = createRouteContext({
    db,
    repositories: createRepositoryRegistry({ db, env: {} }),
    body: { draft: draft() },
  })

  assert.equal(await handleActionDraftsRoute(route.ctx), true)
  assert.equal(route.response.status, 501)
  assert.deepEqual(route.response.payload, { error: 'Action draft persistence is only available in database mode.' })
  assert.equal(route.wrote, false)
  assert.deepEqual(db, before)
})

test('database mode save route persists only the action draft shell', async () => {
  const writes = []
  const prisma = {
    actionDraft: {
      create: async ({ data, include }) => {
        writes.push({ data, include })
        return {
          ...data,
          createdAt: new Date('2026-06-30T00:00:00.000Z'),
          updatedAt: new Date('2026-06-30T00:00:00.000Z'),
          validations: [{ id: `${data.id}-VAL`, ok: true, missingFields: [], warnings: [], errors: [] }],
          auditTrail: [{ id: `${data.id}-AUD`, action: 'ai_draft_prepared', summary: 'Prepared draft' }],
        }
      },
    },
  }
  const db = createDb()
  const before = clone(db)
  const repositories = createDatabaseRepositoryRegistry({
    db,
    env: {
      FLOWCHAIN_PERSISTENCE_MODE: 'database',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/flowchain',
    },
    prisma,
  })
  const route = createRouteContext({ db, repositories, body: { draft: draft() } })

  assert.equal(await handleActionDraftsRoute(route.ctx), true)
  assert.equal(route.response.status, 201)
  assert.equal(route.response.payload.persisted, true)
  assert.equal(route.response.payload.createsBusinessDocument, false)
  assert.equal(route.response.payload.draft.id, 'DRAFT-SAVE-1')
  assert.equal(writes.length, 1)
  assert.equal(writes[0].data.type, 'purchase_request_draft')
  assert.deepEqual(db, before)
})

test('database mode save route returns clean config error without DATABASE_URL', async () => {
  const db = createDb()
  const route = createRouteContext({
    db,
    repositories: createRepositoryRegistry({ db, env: { FLOWCHAIN_PERSISTENCE_MODE: 'database' } }),
    body: { draft: draft() },
  })

  assert.equal(await handleActionDraftsRoute(route.ctx), true)
  assert.equal(route.response.status, 500)
  assert.deepEqual(route.response.payload, {
    error: DATABASE_CONFIG_ERROR,
    code: 'FLOWCHAIN_DATABASE_CONFIG_MISSING',
  })
  assert.doesNotMatch(JSON.stringify(route.response.payload), /stack|postgres|password/)
})
