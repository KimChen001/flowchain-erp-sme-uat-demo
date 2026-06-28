import test from 'node:test'
import assert from 'node:assert/strict'
import { handleAiRoute } from '../routes/ai.routes.mjs'
import {
  aiRfqOperationalCapabilityCatalog,
  buildAiRfqOperationalResponse,
  detectAiRfqOperationalIntent,
  normalizeRfqOperationalMessage,
} from './ai-rfq-operational-query.mjs'

function createDb(overrides = {}) {
  return {
    products: [
      { sku: 'A100', name: 'Motor A100' },
    ],
    suppliers: [
      { id: 'SUP-001', name: 'ABC Components' },
      { id: 'SUP-002', name: 'ABC Tools' },
      { id: 'SUP-003', name: 'Beta Metals' },
    ],
    rfqs: [
      {
        id: 'RFQ-1001',
        title: 'A100 motor RFQ',
        status: '进行中',
        suppliers: 3,
        quoted: 1,
        due: '2026-07-03',
        sourceSku: 'A100',
        invitedSuppliers: ['ABC Components', 'Beta Metals'],
        responses: [
          { supplierId: 'SUP-001', supplierName: 'ABC Components', responseStatus: 'responded' },
          { supplierId: 'SUP-003', supplierName: 'Beta Metals', responseStatus: 'pending' },
        ],
      },
      {
        id: 'RFQ-1002',
        title: 'B200 bracket RFQ',
        status: '比价中',
        suppliers: 2,
        quoted: 2,
        due: '2026-07-05',
        bestSupplier: 'ABC Components',
      },
    ],
    purchaseRequests: [],
    purchaseOrders: [],
    receivingDocs: [],
    inventoryMovements: [],
    ...overrides,
  }
}

function createRouteContext(body, db = createDb()) {
  let response = null
  return {
    ctx: {
      req: { method: 'POST', headers: {}, body },
      res: {},
      url: new URL('/api/ai/chat', 'http://localhost'),
      db,
      readBody: async (req) => req.body,
      writeDb: async () => {},
      event(database, type, message, ref) {
        database.events = [{ type, message, ref }]
      },
      ensureRfqs(database) {
        return Array.isArray(database.rfqs) ? database.rfqs : []
      },
      ensurePurchaseRequests(database) {
        return Array.isArray(database.purchaseRequests) ? database.purchaseRequests : []
      },
      ensureInventoryMovements(database) {
        return Array.isArray(database.inventoryMovements) ? database.inventoryMovements : []
      },
      send(_res, status, payload) {
        response = { status, payload }
      },
    },
    get response() {
      return response
    },
  }
}

function businessSnapshot(db) {
  return structuredClone({
    suppliers: db.suppliers,
    rfqs: db.rfqs,
    purchaseRequests: db.purchaseRequests,
    purchaseOrders: db.purchaseOrders,
  })
}

test('RFQ operational catalog documents read-only RFQ capabilities', () => {
  assert.equal(aiRfqOperationalCapabilityCatalog.length, 3)
  assert.deepEqual(
    aiRfqOperationalCapabilityCatalog.map((item) => item.intent),
    ['rfq_status_query', 'rfq_response_query', 'supplier_rfq_participation_query'],
  )
  assert.ok(aiRfqOperationalCapabilityCatalog.every((item) => item.mode === 'read'))
})

test('RFQ operational query normalizes compatible payload fields', () => {
  assert.equal(normalizeRfqOperationalMessage({ message: 'RFQ-1001 status' }), 'RFQ-1001 status')
  assert.equal(normalizeRfqOperationalMessage({ prompt: 'RFQ pending' }), 'RFQ pending')
  assert.equal(normalizeRfqOperationalMessage({ question: 'Show RFQs for ABC Components' }), 'Show RFQs for ABC Components')
  assert.equal(normalizeRfqOperationalMessage({ text: '哪些询价还没报价？' }), '哪些询价还没报价？')
})

test('RFQ operational intent detection keeps draft prompts out', () => {
  assert.equal(detectAiRfqOperationalIntent('RFQ-1001 status'), 'rfq_status_query')
  assert.equal(detectAiRfqOperationalIntent('RFQ pending supplier response'), 'rfq_response_query')
  assert.equal(detectAiRfqOperationalIntent('Show RFQs for ABC Components'), 'supplier_rfq_participation_query')
  assert.equal(detectAiRfqOperationalIntent('Create RFQ for A100 qty 1000'), null)
})

test('RFQ id prompt returns rfq_status card', async () => {
  const db = createDb()
  const before = businessSnapshot(db)
  const route = createRouteContext({ message: 'RFQ-1001 status' }, db)
  const handled = await handleAiRoute(route.ctx)

  assert.ok(handled)
  assert.equal(route.response.status, 200)
  assert.equal(route.response.payload.provider, 'local_rfq_operational_query')
  assert.equal(route.response.payload.intent.name, 'rfq_status_query')
  assert.equal(route.response.payload.cards[0].type, 'rfq_status')
  assert.equal(route.response.payload.cards[0].data.rfqId, 'RFQ-1001')
  assert.equal(route.response.payload.cards[0].data.respondedSupplierCount, 1)
  assert.equal(route.response.payload.cards[0].data.pendingSupplierCount, 1)
  assert.ok(route.response.payload.cards.some((card) => card.type === 'recommended_actions'))
  assert.deepEqual(businessSnapshot(db), before)
})

test('RFQ missing id returns missing field card', () => {
  const response = buildAiRfqOperationalResponse(createDb(), { message: '这个 RFQ 现在到哪一步了？' })

  assert.equal(response.intent.name, 'rfq_status_query')
  assert.ok(response.cards.some((card) => card.type === 'missing_fields'))
  assert.ok(response.evidence.some((item) => item.type === 'rfq'))
})

test('RFQ not found returns empty state behavior', () => {
  const response = buildAiRfqOperationalResponse(createDb(), { message: 'RFQ-404 status' })

  assert.equal(response.intent.name, 'rfq_status_query')
  assert.ok(response.cards.some((card) => card.type === 'empty_state'))
  assert.match(response.message, /could not find/i)
})

test('general pending RFQ response prompt returns response summary', () => {
  const response = buildAiRfqOperationalResponse(createDb(), { message: 'Which RFQs are waiting for supplier responses?' })

  assert.equal(response.intent.name, 'rfq_response_query')
  assert.equal(response.cards[0].type, 'rfq_response_summary')
  assert.equal(response.cards[0].data.totalOpenRfqs, 2)
  assert.equal(response.cards[0].data.rfqsWithPendingResponses, 1)
  assert.equal(response.cards[0].data.topPendingRfqs[0].rfqId, 'RFQ-1001')
})

test('RFQ-specific response prompt returns response summary for one RFQ', () => {
  const response = buildAiRfqOperationalResponse(createDb(), { prompt: 'RFQ-1001 哪些供应商还没回复？' })

  assert.equal(response.intent.name, 'rfq_response_query')
  assert.equal(response.intent.slots.rfqId, 'RFQ-1001')
  assert.equal(response.cards[0].data.rfqsWithPendingResponses, 1)
  assert.ok(response.evidence.some((item) => item.type === 'supplier_response_evidence'))
})

test('RFQ response query returns empty state when no pending responses exist', () => {
  const response = buildAiRfqOperationalResponse(createDb({
    rfqs: [{ id: 'RFQ-DONE', status: '已授标', suppliers: 2, quoted: 2 }],
  }), { message: 'RFQ pending supplier response' })

  assert.equal(response.intent.name, 'rfq_response_query')
  assert.equal(response.cards[0].data.rfqsWithPendingResponses, 0)
  assert.ok(response.cards.some((card) => card.type === 'empty_state'))
})

test('supplier name prompt returns supplier RFQ participation card', () => {
  const response = buildAiRfqOperationalResponse(createDb(), { message: 'Show RFQs for ABC Components' })

  assert.equal(response.intent.name, 'supplier_rfq_participation_query')
  assert.equal(response.cards[0].type, 'supplier_rfq_participation')
  assert.equal(response.cards[0].data.supplierId, 'SUP-001')
  assert.equal(response.cards[0].data.totalRfqs, 2)
  assert.equal(response.cards[0].data.respondedCount, 2)
})

test('supplier id prompt works for RFQ participation', () => {
  const response = buildAiRfqOperationalResponse(createDb(), { message: '供应商 SUP-001 参与了哪些 RFQ？' })

  assert.equal(response.intent.name, 'supplier_rfq_participation_query')
  assert.equal(response.cards[0].data.supplierId, 'SUP-001')
})

test('ambiguous supplier RFQ participation returns ambiguous card', () => {
  const response = buildAiRfqOperationalResponse(createDb(), { message: 'ABC supplier RFQ status' })

  assert.equal(response.intent.name, 'supplier_rfq_participation_query')
  assert.ok(response.cards.some((card) => card.type === 'ambiguous_match'))
})

test('supplier with no RFQ participation returns empty state', () => {
  const response = buildAiRfqOperationalResponse(createDb(), { message: 'Show RFQs for SUP-002' })

  assert.equal(response.intent.name, 'supplier_rfq_participation_query')
  assert.equal(response.cards[0].data.totalRfqs, 0)
  assert.ok(response.cards.some((card) => card.type === 'empty_state'))
})

test('RFQ pending route returns RFQ response query and does not mutate data', async () => {
  const db = createDb()
  const before = businessSnapshot(db)
  const route = createRouteContext({ text: 'RFQ pending' }, db)
  const handled = await handleAiRoute(route.ctx)

  assert.ok(handled)
  assert.equal(route.response.status, 200)
  assert.equal(route.response.payload.intent.name, 'rfq_response_query')
  assert.equal(route.response.payload.cards[0].type, 'rfq_response_summary')
  assert.deepEqual(businessSnapshot(db), before)
})
