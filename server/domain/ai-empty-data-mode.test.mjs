import test from 'node:test'
import assert from 'node:assert/strict'
import { handleAiRoute } from '../routes/ai.routes.mjs'
import { buildAiReadContext } from './ai-read-context.mjs'
import { createEmptyDataset, resolveFlowchainDataMode } from './data-mode.mjs'
import { buildTodayCockpit } from './today-cockpit-read-model.mjs'
import { buildProcurementDocuments, buildProcurementSummary } from './procurement-read-model.mjs'
import { buildInventoryItems, buildInventorySummary } from './inventory-read.mjs'

const DEMO_IDS = [
  'PO-2026-1282',
  'SKU-00412',
  'RFQ-26-0046',
  'GRN-202605-0418',
  'INV-SZ-260601',
  'SUP-SZXY',
]

function createRouteContext(question) {
  const db = createEmptyDataset()
  let response = null
  let providerCalls = 0
  let writes = 0
  return {
    ctx: {
      req: { method: 'POST', body: { question }, headers: {} },
      res: {},
      url: new URL('/api/ai/chat', 'http://localhost'),
      db,
      send(_res, status, payload) {
        response = { status, payload }
      },
      readBody: async (req) => req.body,
      writeDb: async () => { writes += 1 },
      event: () => {},
      ensurePurchaseRequests: (nextDb) => nextDb.purchaseRequests || [],
      ensureInventoryMovements: (nextDb) => nextDb.inventoryMovements || [],
      ensureRfqs: (nextDb) => nextDb.rfqs || [],
      ensureEvents: (nextDb) => nextDb.events || [],
      ensureAuditLog: (nextDb) => nextDb.auditLog || [],
      supplierPerformance: (nextDb) => nextDb.suppliers || [],
      supplierRecommendations: () => null,
      supplierQuoteCount: 0,
      openaiDispatcher: { dispatch() { providerCalls += 1; throw new Error('provider should not be used') } },
      arkDispatcher: { dispatch() { providerCalls += 1; throw new Error('provider should not be used') } },
      aiMaxTokens: 120,
      dataMode: 'empty',
      repositories: {},
    },
    get response() {
      return response
    },
    get providerCalls() {
      return providerCalls
    },
    get writes() {
      return writes
    },
  }
}

function businessSnapshot(db) {
  return JSON.stringify({
    purchaseOrders: db.purchaseOrders,
    purchaseRequests: db.purchaseRequests,
    rfqs: db.rfqs,
    receivingDocs: db.receivingDocs,
    supplierInvoices: db.supplierInvoices,
    suppliers: db.suppliers,
    products: db.products,
    inventoryMovements: db.inventoryMovements,
    inventoryExceptions: db.inventoryExceptions,
    forecastPlans: db.forecastPlans,
    marketPrices: db.marketPrices,
    marketSignals: db.marketSignals,
  })
}

function visibleText(payload = {}) {
  const cards = (payload.cards || []).flatMap((card) => [
    card.id,
    card.type,
    card.title,
    card.message,
    card.data?.conclusion,
    ...(card.data?.keyFacts || []),
    ...(card.data?.sections || []).flatMap((section) => [section.title, section.conclusion, ...(section.keyFacts || [])]),
    ...(card.data?.topPurchaseOrders || []).flatMap((row) => [row.poId, row.supplier, row.status]),
    ...(card.actions || []).flatMap((action) => [action.label, action.targetId, action.route]),
    ...(card.evidence || []).flatMap((item) => [item.id, item.label, item.summary, item.status]),
  ])
  const evidence = (payload.evidence || []).flatMap((item) => [item.id, item.label, item.summary, item.status])
  const sections = (payload.sections || []).flatMap((section) => [section.title, section.conclusion, ...(section.keyFacts || [])])
  return [payload.content, payload.message, ...cards, ...evidence, ...sections].filter(Boolean).join(' ')
}

function assertNoDemoLeak(payload) {
  const serialized = JSON.stringify(payload)
  for (const id of DEMO_IDS) {
    assert.doesNotMatch(serialized, new RegExp(id.replaceAll('-', '\\-')))
  }
}

function assertNoObjectSpecificAction(payload) {
  const actions = (payload.cards || []).flatMap((card) => card.actions || [])
  for (const action of actions) {
    const text = [action.id, action.label, action.targetId, action.route].filter(Boolean).join(' ')
    assert.doesNotMatch(text, /PO-|PR-|RFQ-|SKU-|GRN-|INV-|SUP-/)
  }
}

function assertNoObjectSpecificEvidence(payload) {
  const evidence = [
    ...(payload.evidence || []),
    ...(payload.cards || []).flatMap((card) => card.evidence || []),
  ]
  for (const item of evidence) {
    const text = [item.id, item.label, item.summary, item.status, item.route].filter(Boolean).join(' ')
    assert.doesNotMatch(text, /PO-|PR-|RFQ-|SKU-|GRN-|INV-|SUP-/)
  }
}

test('R151 resolves data modes without implicitly enabling demo for empty or user data', () => {
  assert.deepEqual(resolveFlowchainDataMode({}).mode, 'demo')
  assert.equal(resolveFlowchainDataMode({ FLOWCHAIN_DATA_MODE: 'empty' }).readsDemoData, false)
  assert.equal(resolveFlowchainDataMode({ FLOWCHAIN_DATA_MODE: 'user' }).readsDemoData, false)
  assert.equal(resolveFlowchainDataMode({ FLOWCHAIN_DATA_MODE: 'test' }).dataSource, 'in-memory-test')
  assert.equal(resolveFlowchainDataMode({ FLOWCHAIN_DATA_MODE: 'invalid' }).mode, 'demo')
})

test('R152 core read models handle empty business data', async () => {
  const db = createEmptyDataset()
  const procurementDocuments = buildProcurementDocuments(db)
  const inventoryItems = buildInventoryItems(db)
  assert.deepEqual(procurementDocuments, [])
  assert.deepEqual(inventoryItems, [])
  assert.equal(buildProcurementSummary(procurementDocuments, []).openPoCount, 0)
  assert.equal(buildInventorySummary(inventoryItems, []).lowStockCount, 0)
  assert.equal(buildTodayCockpit(db).summary.openPoCount, 0)
  const context = await buildAiReadContext(db, { dataMode: 'empty', repositories: {} })
  assert.equal(context.dataMode, 'empty')
  assert.deepEqual(context.repositoryBacked, { procurementRead: false, inventoryRead: false, masterData: false })
})

test('R153 empty dataset AI routes answer without demo evidence, provider, or object actions', async () => {
  const prompts = [
    '今天最需要处理什么？',
    '有什么需要我注意的？',
    '订单还有多少没有收货？',
    '哪些供应商需要跟进？',
    '什么数据会比较有限？',
    '今天有什么需要我做的，订单还有多少没有收货，有哪些供应商会有潜在风险？',
  ]

  for (const question of prompts) {
    const route = createRouteContext(question)
    const before = businessSnapshot(route.ctx.db)
    assert.equal(await handleAiRoute(route.ctx), true)
    assert.equal(route.response.status, 200)
    assert.equal(route.providerCalls, 0)
    assert.equal(businessSnapshot(route.ctx.db), before)
    assertNoDemoLeak(route.response.payload)
    assertNoObjectSpecificAction(route.response.payload)
    assertNoObjectSpecificEvidence(route.response.payload)
    assert.doesNotMatch(JSON.stringify(route.response.payload), /draft_preview|draft_prepared/)
    assert.match(visibleText(route.response.payload), /没有|暂无|有限|未发现|当前/)
  }
})

test('R153 empty compound query keeps deterministic structured sections', async () => {
  const route = createRouteContext('今天有什么需要我做的，订单还有多少没有收货，有哪些供应商会有潜在风险？')
  assert.equal(await handleAiRoute(route.ctx), true)
  assert.equal(route.response.status, 200)
  assert.equal(route.response.payload.intent.name, 'compound_business_query')
  assert.ok((route.response.payload.sections || []).length >= 2)
  assertNoDemoLeak(route.response.payload)
  assert.equal(route.providerCalls, 0)
})
