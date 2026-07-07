import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAiCockpitFastPathResponse, buildAiEvidenceReuseResponse } from './ai-evidence-reuse.mjs'
import { handleAiRoute } from '../routes/ai.routes.mjs'

function createDb() {
  return {
    purchaseRequests: [
      { pr: 'PR-2026-2400', sourceSku: 'SKU-00287', sourceName: '铝合金型材 6063', supplier: '江苏铝合金集团', requester: '张磊', buyer: '王志强', requiredDate: '2026-07-05', quantity: 1000, amount: 142000, currency: 'CNY', status: '已批准', linkedPo: 'PO-2026-1301' },
    ],
    rfqs: [
      { id: 'RFQ-26-0047', title: 'SKU-00287 采购询价', suppliers: 3, quoted: 1, due: '2026-06-20', status: '进行中', sourceRequest: 'PR-2026-2400', linkedPo: 'PO-2026-1301', bestSupplier: '江苏铝合金集团' },
    ],
    purchaseOrders: [
      { po: 'PO-2026-1301', supplier: '江苏铝合金集团', eta: '2026-06-12', owner: '王志强', amount: 142000, currency: 'CNY', items: 1000, received: 400, status: '已发出', sourceRequest: 'PR-2026-2400', sourceRfq: 'RFQ-26-0047' },
    ],
    receivingDocs: [
      { grn: 'GRN-202606-0430', po: 'PO-2026-1301', supplier: '江苏铝合金集团', status: '异常处理', items: 400, passed: 390, failed: 10, warehouse: 'A 区' },
    ],
    supplierInvoices: [
      { invoiceNumber: 'INV-JS-260620', supplier: '江苏铝合金集团', relatedPo: 'PO-2026-1301', relatedGrn: 'GRN-202606-0430', amount: 142000, currency: 'CNY', varianceAmount: 8600, matchStatus: '存在差异' },
    ],
    products: [
      { sku: 'SKU-00287', name: '铝合金型材 6063', currentStock: 12, min: 50, reorderPoint: 80, unit: 'kg', warehouse: 'WH-A', status: '低库存', riskLevel: '高' },
    ],
    inventoryMovements: [
      { movementId: 'MV-2026-0001', movementType: 'CycleCountVariance', sku: 'SKU-00287', itemName: '铝合金型材 6063', warehouse: 'WH-A', sourceDocument: 'GRN-202606-0430', adjustmentQty: -8, status: '异常处理', unit: 'kg' },
    ],
    inventoryExceptions: [
      { id: 'IEX-2026-0001', type: '盘点差异关闭', sku: 'SKU-00287', itemName: '铝合金型材 6063', warehouse: 'WH-A', quantityImpact: -8, unit: 'kg', status: '待复核', nextAction: '复核盘点差异' },
    ],
    suppliers: [{ id: 'SUP-001', name: '江苏铝合金集团' }],
    forecastPlans: [],
    marketPrices: [],
    marketSignals: [],
    events: [],
    auditLog: [],
  }
}

function businessSnapshot(db) {
  return JSON.stringify({
    purchaseRequests: db.purchaseRequests,
    rfqs: db.rfqs,
    purchaseOrders: db.purchaseOrders,
    receivingDocs: db.receivingDocs,
    supplierInvoices: db.supplierInvoices,
    products: db.products,
    inventoryMovements: db.inventoryMovements,
    inventoryExceptions: db.inventoryExceptions,
  })
}

function createRouteContext(body, db = createDb(), helpers = {}) {
  let response = null
  let wrote = false
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
      writeDb: async () => { wrote = true },
      event: () => {},
      ensurePurchaseRequests: (nextDb) => nextDb.purchaseRequests || [],
      ensureInventoryMovements: (nextDb) => nextDb.inventoryMovements || [],
      ensureRfqs: (nextDb) => nextDb.rfqs || [],
      ensureEvents: (nextDb) => nextDb.events || [],
      ensureAuditLog: (nextDb) => nextDb.auditLog || [],
      supplierPerformance: () => [],
      supplierRecommendations: () => null,
      supplierQuoteCount: 0,
      openaiDispatcher: { dispatch() { throw new Error('provider should not be reached') } },
      arkDispatcher: { dispatch() { throw new Error('provider should not be reached') } },
      aiMaxTokens: 120,
      ...helpers,
    },
    get response() {
      return response
    },
    get wrote() {
      return wrote
    },
  }
}

function withEnv(patch, fn) {
  const keys = Object.keys(patch)
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const key of keys) {
        if (previous[key] === undefined) delete process.env[key]
        else process.env[key] = previous[key]
      }
    })
}

function assertCleanAiPayload(payload) {
  const serialized = JSON.stringify(payload)
  assert.equal(/```|###|\bcards\s*:|\bevidence\s*:|\bintent\s*:/i.test(payload.content), false)
  assert.equal(/fake-openai-key|fake-ark-key|fake-doubao-key/.test(serialized), false)
  assert.equal(payload.provider, 'local')
  assert.equal(payload.readModelReuse, true)
  assert.ok(payload.evidence.every((item) => item.type && (item.id || item.label || item.summary)))
}

test('AI evidence reuse answers today cockpit priority questions from read models', () => {
  const db = createDb()
  const before = businessSnapshot(db)
  const response = buildAiEvidenceReuseResponse(db, { message: '今天最需要处理什么？' }, { cache: {} })

  assert.equal(response.intent.name, 'today_cockpit_priority_query')
  assert.match(response.content, /紧急跟进/)
  assert.ok(response.cards.some((card) => card.type === 'procurement_followup_summary'))
  assert.ok(response.cards.some((card) => card.type === 'evidence'))
  assert.ok(response.evidence.length > 0)
  assertCleanAiPayload(response)
  assert.equal(businessSnapshot(db), before)
})

test('AI cockpit fast path handles overview priority prompts before provider fallback', () => {
  const db = createDb()
  const before = businessSnapshot(db)
  const response = buildAiCockpitFastPathResponse(db, { moduleId: 'overview', message: '今天最需要处理什么？' }, { cache: {} })

  assert.equal(response.intent.name, 'today_cockpit_priority_query')
  assert.equal(response.providerStatus, 'deterministic')
  assert.equal(response.mode, 'deterministic')
  assert.match(response.message, /今天建议先处理/)
  assert.ok(response.cards.some((card) => card.type === 'procurement_followup_summary'))
  assert.ok(response.cards.some((card) => card.type === 'evidence'))
  assertCleanAiPayload(response)
  assert.equal(businessSnapshot(db), before)
})

test('AI cockpit fast path only handles cockpit-style module context', () => {
  const response = buildAiCockpitFastPathResponse(createDb(), { moduleId: 'srm', message: '今天最需要处理什么？' }, { cache: {} })

  assert.equal(response, null)
})

test('AI evidence reuse answers procurement risk questions with canonical evidence', () => {
  const response = buildAiEvidenceReuseResponse(createDb(), { message: '哪些采购单据有风险？' }, { cache: {} })

  assert.equal(response.intent.name, 'procurement_exception_query')
  assert.ok(response.cards.some((card) => card.type === 'procurement_exception_summary'))
  assert.ok(response.evidence.some((item) => ['invoice', 'threeWayMatch', 'po', 'grn'].includes(item.type)))
  assertCleanAiPayload(response)
})

test('AI evidence reuse answers inventory and SKU risk questions', () => {
  const response = buildAiEvidenceReuseResponse(createDb(), { message: '这个 SKU-00287 为什么风险高？' }, { cache: {} })

  assert.equal(response.intent.name, 'inventory_status_query')
  assert.match(response.content, /SKU-00287/)
  assert.ok(response.cards.some((card) => card.type === 'inventory_status'))
  assert.ok(response.evidence.some((item) => item.type === 'inventory_item' && item.id === 'SKU-00287'))
  assertCleanAiPayload(response)
})

test('AI evidence reuse answers supplier follow-up questions without provider calls', async () => {
  await withEnv({
    AI_PROVIDER_ENABLED: undefined,
    OPENAI_API_KEY: 'fake-openai-key',
    ARK_API_KEY: 'fake-ark-key',
    DOUBAO_API_KEY: 'fake-doubao-key',
  }, async () => {
    const db = createDb()
    const before = businessSnapshot(db)
    const route = createRouteContext({ message: '哪些供应商需要跟进？' }, db)
    const handled = await handleAiRoute(route.ctx)

    assert.equal(handled, true)
    assert.equal(route.response.status, 200)
    assert.equal(route.response.payload.intent.name, 'supplier_followup_query')
    assert.notEqual(route.response.payload.providerStatus, 'blocked')
    assert.equal(route.wrote, false)
    assertCleanAiPayload(route.response.payload)
    assert.equal(businessSnapshot(db), before)
  })
})

test('AI route returns deterministic cockpit answer with placeholder provider keys present', async () => {
  await withEnv({
    AI_PROVIDER_ENABLED: undefined,
    OPENAI_API_KEY: 'fake-openai-key',
    ARK_API_KEY: 'fake-ark-key',
    DOUBAO_API_KEY: 'fake-doubao-key',
  }, async () => {
    const db = createDb()
    const before = businessSnapshot(db)
    const route = createRouteContext({ moduleId: 'overview', message: '今天最需要处理什么？' }, db)
    const handled = await handleAiRoute(route.ctx)

    assert.equal(handled, true)
    assert.equal(route.response.status, 200)
    assert.equal(route.response.payload.intent.name, 'today_cockpit_priority_query')
    assert.equal(route.response.payload.providerStatus, 'deterministic')
    assert.notEqual(route.response.payload.providerStatus, 'blocked')
    assert.equal(route.wrote, false)
    assertCleanAiPayload(route.response.payload)
    assert.equal(businessSnapshot(db), before)
  })
})

test('AI cockpit answer survives audit write failure because persistence is not awaited', async () => {
  const route = createRouteContext(
    { moduleId: 'overview', message: '今天最需要处理什么？' },
    createDb(),
    { writeDb: async () => { throw new Error('audit persistence should not be called') } },
  )

  await handleAiRoute(route.ctx)

  assert.equal(route.response.status, 200)
  assert.equal(route.response.payload.intent.name, 'today_cockpit_priority_query')
  assert.equal(route.response.payload.providerStatus, 'deterministic')
  assertCleanAiPayload(route.response.payload)
})
