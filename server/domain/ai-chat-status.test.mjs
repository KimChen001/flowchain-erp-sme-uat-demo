import test from 'node:test'
import assert from 'node:assert/strict'
import { handleAiRoute } from '../routes/ai.routes.mjs'
import {
  aiChatStatusCapabilityCatalog,
  buildAiChatStatusResponse,
  detectAiChatStatusIntent,
  normalizeAiChatMessage,
} from './ai-chat-status.mjs'

function createDb(overrides = {}) {
  return {
    products: [
      {
        sku: 'A100',
        name: 'Motor A100',
        category: 'Components',
        supplier: 'ABC Components',
        defaultWarehouseId: 'WH-MAIN',
        moq: 100,
      },
      {
        sku: 'B200',
        name: 'Bracket B200',
        category: 'Components',
        availableQuantity: 0,
        defaultWarehouseId: 'WH-SECONDARY',
        moq: 50,
      },
    ],
    suppliers: [
      {
        id: 'SUP-001',
        name: 'ABC Components',
        category: 'Motors',
        risk: '中',
        onTimeRate: 84,
        qualityRate: 90,
        preferred: true,
      },
    ],
    warehouses: [
      { id: 'WH-MAIN', name: 'Main Warehouse' },
    ],
    purchaseOrders: [
      {
        po: 'PO-1001',
        supplier: 'ABC Components',
        supplierId: 'SUP-001',
        eta: '2026-06-01',
        status: '已发出',
        priority: '高',
        lines: [{ sku: 'A100', itemId: 'ITEM-A100' }],
      },
    ],
    purchaseRequests: [
      {
        pr: 'PR-2001',
        status: '待审批',
        priority: '中',
        sourceSku: 'A100',
      },
    ],
    rfqs: [
      {
        id: 'RFQ-3001',
        status: '进行中',
        due: '2026-06-20',
        sku: 'A100',
      },
    ],
    receivingDocs: [
      {
        grn: 'GRN-4001',
        supplier: 'ABC Components',
        status: '异常处理',
        failed: 2,
        lines: [{ sku: 'A100' }],
      },
    ],
    inventoryMovements: [
      {
        id: 'MV-5001',
        sku: 'A100',
        warehouseId: 'WH-MAIN',
        quantity: 10,
      },
    ],
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
    products: db.products,
    suppliers: db.suppliers,
    purchaseOrders: db.purchaseOrders,
    purchaseRequests: db.purchaseRequests,
    rfqs: db.rfqs,
    receivingDocs: db.receivingDocs,
    inventoryMovements: db.inventoryMovements,
  })
}

test('AI chat status catalog documents read-only prompt patterns', () => {
  assert.equal(aiChatStatusCapabilityCatalog.length, 3)
  assert.ok(aiChatStatusCapabilityCatalog.every((item) => item.mode === 'read'))
  assert.deepEqual(
    aiChatStatusCapabilityCatalog.map((item) => item.intent),
    ['supplier_status_query', 'inventory_status_query', 'procurement_exception_query'],
  )
})

test('AI chat normalizes compatible message fields', () => {
  assert.equal(normalizeAiChatMessage({ message: 'Show supplier status' }), 'Show supplier status')
  assert.equal(normalizeAiChatMessage({ prompt: '今天库存有什么风险？' }), '今天库存有什么风险？')
  assert.equal(normalizeAiChatMessage({ question: 'Which purchase orders are overdue?' }), 'Which purchase orders are overdue?')
})

test('AI chat detects supported read-only status intents', () => {
  assert.equal(detectAiChatStatusIntent('supplier SUP-001 risk'), 'supplier_status_query')
  assert.equal(detectAiChatStatusIntent('Show item A100 inventory status'), 'inventory_status_query')
  assert.equal(detectAiChatStatusIntent('Show overdue POs'), 'procurement_exception_query')
})

test('supplier status query returns supplier card, evidence, and actions', () => {
  const response = buildAiChatStatusResponse(createDb(), { message: 'Show me supplier ABC status' }, { now: new Date('2026-06-25T00:00:00.000Z') })

  assert.equal(response.intent.name, 'supplier_status_query')
  assert.equal(response.intent.slots.supplier, 'SUP-001')
  assert.equal(response.cards[0].type, 'supplier_status')
  assert.equal(response.cards[0].data.supplierId, 'SUP-001')
  assert.equal(response.cards[0].data.scoreSource, 'derived_performance_fallback')
  assert.equal(response.cards[0].data.openPoCount, 1)
  assert.equal(response.cards[0].data.overduePoCount, 1)
  assert.ok(response.cards.some((card) => card.type === 'evidence'))
  assert.ok(response.cards.some((card) => card.type === 'recommended_actions'))
  assert.ok(response.evidence.some((item) => item.type === 'supplier_master'))
})

test('supplier id query resolves canonical supplier id', async () => {
  const db = createDb()
  const before = businessSnapshot(db)
  const route = createRouteContext({ prompt: 'supplier SUP-001 risk' }, db)
  const handled = await handleAiRoute(route.ctx)

  assert.ok(handled)
  assert.equal(route.response.status, 200)
  assert.equal(route.response.payload.intent.name, 'supplier_status_query')
  assert.equal(route.response.payload.cards[0].data.supplierId, 'SUP-001')
  assert.deepEqual(businessSnapshot(db), before)
})

test('supplier query returns missing field card when supplier is not found', () => {
  const response = buildAiChatStatusResponse(createDb(), { message: 'supplier Missing Vendor status' })

  assert.equal(response.intent.name, 'supplier_status_query')
  assert.ok(response.cards.some((card) => card.type === 'missing_fields'))
  assert.ok(response.evidence.some((item) => item.type === 'supplier_master'))
})

test('supplier query returns ambiguous match card when multiple suppliers match', () => {
  const response = buildAiChatStatusResponse(createDb({
    suppliers: [
      { id: 'SUP-001', name: 'ABC Components' },
      { id: 'SUP-002', name: 'ABC Tools' },
    ],
  }), { message: 'ABC supplier status' })

  assert.equal(response.intent.name, 'supplier_status_query')
  assert.ok(response.cards.some((card) => card.type === 'ambiguous_match'))
})

test('item-specific inventory query returns missing quantity evidence when balance is unavailable', async () => {
  const db = createDb()
  const before = businessSnapshot(db)
  const route = createRouteContext({ message: 'A100 库存怎么样？' }, db)
  const handled = await handleAiRoute(route.ctx)

  assert.ok(handled)
  assert.equal(route.response.status, 200)
  assert.equal(route.response.payload.intent.name, 'inventory_status_query')
  assert.equal(route.response.payload.cards[0].type, 'inventory_status')
  assert.equal(route.response.payload.cards[0].data.sku, 'A100')
  assert.equal(route.response.payload.cards[0].data.availableQuantity, null)
  assert.ok(route.response.payload.evidence.some((item) => item.type === 'missing_quantity_evidence'))
  assert.ok(route.response.payload.cards.some((card) => card.type === 'recommended_actions'))
  assert.deepEqual(businessSnapshot(db), before)
})

test('general inventory risk query returns inventory risk summary', () => {
  const response = buildAiChatStatusResponse(createDb(), { prompt: '今天库存有什么风险？' })

  assert.equal(response.intent.name, 'inventory_status_query')
  assert.equal(response.cards[0].type, 'inventory_risk_summary')
  assert.equal(response.cards[0].data.riskItemCount, 1)
  assert.ok(response.cards.some((card) => card.type === 'evidence'))
})

test('procurement exception query returns ranked exception summary and actions', async () => {
  const db = createDb()
  const before = businessSnapshot(db)
  const route = createRouteContext({ message: '今天有哪些采购问题需要处理？' }, db)
  const handled = await handleAiRoute(route.ctx)

  assert.ok(handled)
  assert.equal(route.response.status, 200)
  assert.equal(route.response.payload.intent.name, 'procurement_exception_query')
  assert.equal(route.response.payload.cards[0].type, 'procurement_exception_summary')
  assert.equal(route.response.payload.cards[0].data.overduePoCount, 1)
  assert.equal(route.response.payload.cards[0].data.pendingPrCount, 1)
  assert.equal(route.response.payload.cards[0].data.pendingRfqCount, 1)
  assert.equal(route.response.payload.cards[0].data.receivingIssueCount, 1)
  assert.ok(route.response.payload.cards[0].data.topIssues.some((issue) => issue.type === 'overdue_purchase_order'))
  assert.ok(route.response.payload.cards.some((card) => card.type === 'recommended_actions'))
  assert.deepEqual(businessSnapshot(db), before)
})

test('overdue PO prompt is handled as procurement exception query', () => {
  const response = buildAiChatStatusResponse(createDb(), { message: 'Which purchase orders are overdue?' }, { now: new Date('2026-06-25T00:00:00.000Z') })

  assert.equal(response.intent.name, 'procurement_exception_query')
  assert.equal(response.intent.slots.documentType, 'purchase_order')
  assert.equal(response.cards[0].data.overduePoCount, 1)
})

test('procurement exception query returns empty state when no issues are available', () => {
  const response = buildAiChatStatusResponse(createDb({
    purchaseOrders: [{ po: 'PO-OK', status: '已完成', eta: '2026-06-01' }],
    purchaseRequests: [],
    rfqs: [],
    receivingDocs: [],
  }), { message: 'pending procurement issues' })

  assert.equal(response.intent.name, 'procurement_exception_query')
  assert.equal(response.cards[0].type, 'procurement_exception_summary')
  assert.equal(response.cards[0].data.totalIssueCount, 0)
  assert.ok(response.evidence.some((item) => item.type === 'empty_state'))
})

test('unsupported AI chat prompts fall through deterministic status handler', () => {
  const response = buildAiChatStatusResponse(createDb(), { message: 'Explain forecast assumptions' })

  assert.equal(response, null)
})
