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

function failingReadContextRepositories() {
  const fail = async () => {
    throw new Error('buildAiReadContext should not run for deterministic RFQ UAT prompts')
  }
  return {
    procurementRead: { listDocuments: fail, listFollowups: fail, getSummary: fail },
    inventoryRead: { listItems: fail, listExceptions: fail, getSummary: fail },
    masterData: { listItems: fail, listSuppliers: fail },
  }
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

test('RFQ status query resolves RFQ id from active context', async () => {
  const db = createDb()
  const before = businessSnapshot(db)
  const route = createRouteContext({
    message: '这个 RFQ 现在什么状态？',
    activeContext: {
      module: 'procurement',
      entityType: 'rfq',
      entityId: 'RFQ-1001',
    },
  }, db)
  const handled = await handleAiRoute(route.ctx)

  assert.ok(handled)
  assert.equal(route.response.status, 200)
  assert.equal(route.response.payload.intent.name, 'rfq_status_query')
  assert.equal(route.response.payload.cards[0].type, 'rfq_status')
  assert.equal(route.response.payload.cards[0].data.rfqId, 'RFQ-1001')
  assert.ok(route.response.payload.evidence.some((item) => item.type === 'active_context' && item.id === 'RFQ-1001'))
  assert.deepEqual(businessSnapshot(db), before)
})

test('RFQ not found returns empty state behavior', () => {
  const response = buildAiRfqOperationalResponse(createDb(), { message: 'RFQ-404 status' })

  assert.equal(response.intent.name, 'rfq_status_query')
  assert.ok(response.cards.some((card) => card.type === 'empty_state'))
  assert.match(response.message, /没有找到 RFQ/)
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
  const actions = response.cards.find((card) => card.type === 'recommended_actions')?.actions || []
  const draft = actions.find((action) => action.kind === 'draft_preview' && action.draftType === 'supplier_followup_draft')
  assert.equal(draft?.requiresHumanReview, true)
  assert.equal(draft?.payload?.supplierIdOrName, 'RFQ RFQ-1001')
})

test('RFQ response query resolves RFQ id from active context', () => {
  const response = buildAiRfqOperationalResponse(createDb(), {
    message: '这个 RFQ 哪些供应商还没回复？',
    activeContext: {
      module: 'procurement',
      entityType: 'rfq',
      entityId: 'RFQ-1001',
    },
  })

  assert.equal(response.intent.name, 'rfq_response_query')
  assert.equal(response.intent.slots.rfqId, 'RFQ-1001')
  assert.equal(response.cards[0].type, 'rfq_response_summary')
  assert.equal(response.cards[0].data.rfqsWithPendingResponses, 1)
  assert.ok(response.evidence.some((item) => item.type === 'active_context' && item.id === 'RFQ-1001'))
})

test('explicit RFQ id overrides active RFQ context', () => {
  const response = buildAiRfqOperationalResponse(createDb(), {
    message: 'RFQ-1002 status',
    activeContext: {
      entityType: 'rfq',
      entityId: 'RFQ-1001',
    },
  })

  assert.equal(response.intent.name, 'rfq_status_query')
  assert.equal(response.cards[0].data.rfqId, 'RFQ-1002')
  assert.equal(response.evidence.some((item) => item.type === 'active_context'), false)
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

test('core RFQ UAT response prompts bypass read-context and external provider', async () => {
  const db = createDb()
  const before = businessSnapshot(db)
  const prompts = ['哪些 RFQ 没回复？', 'Which RFQs need response?']

  for (const message of prompts) {
    const route = createRouteContext({ message }, db)
    route.ctx.repositories = failingReadContextRepositories()
    await handleAiRoute(route.ctx)

    assert.equal(route.response.status, 200, message)
    assert.equal(route.response.payload.intent.name, 'rfq_response_query', message)
    assert.equal(route.response.payload.cards[0].type, 'rfq_response_summary', message)
    assert.equal(route.response.payload.fastPath, 'pre_read_context', message)
    assert.equal(route.response.payload.usedWeb, false, message)
    assert.notEqual(route.response.payload.provider, 'openai', message)
    assert.notEqual(route.response.payload.provider, 'doubao', message)
    assert.ok(route.response.payload.cards.some((card) => card.type === 'evidence'), message)
    assert.ok(route.response.payload.cards.some((card) => card.type === 'recommended_actions'), message)
  }

  assert.deepEqual(businessSnapshot(db), before)
})
