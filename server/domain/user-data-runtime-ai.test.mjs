import test from 'node:test'
import assert from 'node:assert/strict'
import { handleAiRoute } from '../routes/ai.routes.mjs'
import { handleUserDataRoute } from '../routes/user-data.routes.mjs'
import { buildAiReadContext } from './ai-read-context.mjs'
import { buildTodayCockpit } from './today-cockpit-read-model.mjs'
import { normalizeUserDataImportPayload } from './user-data-contract.mjs'
import { createUserDataRuntimeDb } from './user-data-runtime.mjs'

const DEMO_ID_PATTERN = /PO-2026-1282|SKU-00412|RFQ-26-0046|PR-2026-2401|GRN-202605-0418|INV-SZ-260601|SUP-SZXY/

function importedPayload() {
  return {
    sourceName: 'phase-ad-import',
    purchaseOrders: [
      {
        poId: 'PO-IMPORT-0001',
        supplierName: '导入供应商一号',
        eta: '2026-06-27',
        owner: 'Imported Buyer',
        amount: '50000',
        received: '20',
        status: '已发出',
        sourceRequest: 'PR-IMPORT-0001',
        sourceRfq: 'RFQ-IMPORT-0001',
        lines: [{ itemSku: 'SKU-IMPORT-0001', name: '导入物料 Alpha', quantityOrdered: '80', quantity: '80', received: '20' }],
      },
    ],
    purchaseRequests: [
      { prId: 'PR-IMPORT-0001', itemSku: 'SKU-IMPORT-0001', sourceName: '导入物料 Alpha', supplierName: '导入供应商一号', quantity: '80', priority: '高', status: '已批准', requiredDate: '2026-07-04', linkedPo: 'PO-IMPORT-0001' },
    ],
    rfqs: [
      { rfqId: 'RFQ-IMPORT-0001', title: 'SKU-IMPORT-0001 导入询价', prId: 'PR-IMPORT-0001', suppliers: '4', quoted: '2', due: '2026-07-05', status: '进行中', bestSupplier: '导入供应商一号' },
    ],
    products: [
      { itemSku: 'SKU-IMPORT-0001', itemName: '导入物料 Alpha', currentStock: '3', availableQuantity: '3', min: '20', safetyStock: '20', reorderPoint: '35', status: '低库存', riskLevel: '高', supplierName: '导入供应商一号' },
    ],
    suppliers: [
      { supplierId: 'SUP-IMPORT-0001', supplierName: '导入供应商一号', risk: '高', riskStatus: '高风险', score: '70', openPoCount: '1', onTimeDelivery: '72', qualityScore: '80', nextAction: '确认剩余 60 件到货计划' },
    ],
    receivingDocs: [
      { grnId: 'GRN-IMPORT-0001', poId: 'PO-IMPORT-0001', supplierName: '导入供应商一号', status: '异常处理', items: '20', passed: '18', failed: '2' },
    ],
    supplierInvoices: [
      { invoiceNumber: 'INV-IMPORT-0001', poId: 'PO-IMPORT-0001', grnId: 'GRN-IMPORT-0001', supplierName: '导入供应商一号', amount: '50000', varianceAmount: '1500', matchStatus: '存在差异' },
    ],
    inventoryMovements: [
      { movementId: 'MV-IMPORT-0001', itemSku: 'SKU-IMPORT-0001', grnId: 'GRN-IMPORT-0001', adjustmentQty: '-2', status: '异常处理' },
    ],
    inventoryExceptions: [
      { id: 'IEX-IMPORT-0001', itemSku: 'SKU-IMPORT-0001', itemName: '导入物料 Alpha', quantityImpact: '-2', status: '待复核', nextAction: '复核导入库存差异' },
    ],
  }
}

function visibleText(payload = {}) {
  const cards = (payload.cards || []).flatMap((card) => [
    card.title,
    card.message,
    card.data?.conclusion,
    ...(card.data?.keyFacts || []),
    ...(card.data?.sections || []).flatMap((section) => [section.title, section.conclusion, ...(section.keyFacts || [])]),
    ...(card.data?.topPurchaseOrders || []).flatMap((row) => [row.poId, row.supplier, row.status, row.remainingQuantity]),
    ...(card.actions || []).flatMap((action) => [action.label, action.targetId, action.route]),
    ...(card.evidence || []).flatMap((item) => [item.id, item.label, item.summary, item.status]),
  ])
  const evidence = (payload.evidence || []).flatMap((item) => [item.id, item.label, item.summary, item.status])
  const sections = (payload.sections || []).flatMap((section) => [section.title, section.conclusion, ...(section.keyFacts || [])])
  return [payload.content, payload.message, ...cards, ...evidence, ...sections].filter(Boolean).join(' ')
}

function routeContext(question, db) {
  let response = null
  let providerCalls = 0
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
      writeDb: async () => {},
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
      dataMode: 'user',
      repositories: {},
    },
    get response() {
      return response
    },
    get providerCalls() {
      return providerCalls
    },
  }
}

function importRouteContext(pathname = '/api/user-data/import/preview', body = importedPayload(), db = createUserDataRuntimeDb(normalizeUserDataImportPayload({}))) {
  let response = null
  return {
    ctx: {
      req: { method: 'POST', body, headers: {} },
      res: {},
      url: new URL(pathname, 'http://localhost'),
      db,
      readBody: async (req) => req.body,
      send(_res, status, payload) {
        response = { status, payload }
      },
    },
    get response() {
      return response
    },
  }
}

test('R164 creates user-mode runtime DB compatible with read context and cockpit', async () => {
  const normalized = normalizeUserDataImportPayload(importedPayload(), { importedAt: '2026-07-02T00:00:00.000Z' })
  assert.equal(normalized.ok, true)
  const db = createUserDataRuntimeDb(normalized)
  assert.equal(db.__dataMode, 'user')
  assert.equal(db.__userDataImport.sourceName, 'phase-ad-import')
  assert.equal(db.purchaseOrders[0].po, 'PO-IMPORT-0001')
  assert.equal(db.products[0].sku, 'SKU-IMPORT-0001')

  const cockpit = buildTodayCockpit(db)
  assert.ok(cockpit.summary.openPoCount >= 1)
  const readContext = await buildAiReadContext(db, { dataMode: 'user', repositories: {} })
  assert.equal(readContext.dataMode, 'user')
  assert.equal(readContext.db.purchaseOrders[0].po, 'PO-IMPORT-0001')
})

test('R165 AI answers imported user data without demo leakage provider or mutation', async () => {
  const prompts = [
    { question: '今天最需要处理什么？', mustInclude: /PO-IMPORT-0001|SKU-IMPORT-0001|RFQ-IMPORT-0001/ },
    { question: '有什么需要我注意的？', mustInclude: /PO-IMPORT-0001|GRN-IMPORT-0001|INV-IMPORT-0001|SKU-IMPORT-0001|RFQ-IMPORT-0001|导入供应商一号/ },
    { question: '订单还有多少没有收货？', mustInclude: /PO-IMPORT-0001|剩余\s*60|60/ },
    { question: '哪些供应商需要跟进？', mustInclude: /SUP-IMPORT-0001|导入供应商一号/ },
    { question: 'PO-IMPORT-0001 为什么优先？', mustInclude: /PO-IMPORT-0001/ },
    { question: 'SKU-IMPORT-0001 为什么风险高？', mustInclude: /SKU-IMPORT-0001/ },
    { question: 'RFQ-IMPORT-0001 需要怎么跟进？', mustInclude: /RFQ-IMPORT-0001|2|4/ },
    { question: '今天有什么需要我做的，订单还有多少没有收货，有哪些供应商会有潜在风险？', mustInclude: /PO-IMPORT-0001|SKU-IMPORT-0001|导入供应商一号/ },
  ]

  for (const item of prompts) {
    const db = createUserDataRuntimeDb(normalizeUserDataImportPayload(importedPayload()))
    const before = JSON.stringify(db)
    const route = routeContext(item.question, db)
    assert.equal(await handleAiRoute(route.ctx), true)
    assert.equal(route.response.status, 200)
    assert.equal(route.providerCalls, 0)
    assert.equal(JSON.stringify(db), before)
    const text = visibleText(route.response.payload)
    assert.match(text, item.mustInclude)
    assert.doesNotMatch(JSON.stringify(route.response.payload), DEMO_ID_PATTERN)
  }
})

test('R166 import preview route returns compact normalized records only', async () => {
  const db = createUserDataRuntimeDb(normalizeUserDataImportPayload({}))
  const before = JSON.stringify(db)
  const route = importRouteContext('/api/user-data/import/preview', importedPayload(), db)
  assert.equal(await handleUserDataRoute(route.ctx), true)
  assert.equal(route.response.status, 200)
  assert.equal(route.response.payload.ok, true)
  assert.equal(route.response.payload.previewLimit, 5)
  assert.equal(route.response.payload.normalizedRecords.purchaseOrders[0].po, 'PO-IMPORT-0001')
  assert.equal(route.response.payload.normalizedRecords.products[0].sku, 'SKU-IMPORT-0001')
  assert.equal(route.response.payload.normalizedRecords.rfqs[0].id, 'RFQ-IMPORT-0001')
  assert.equal(route.response.payload.normalizedData, undefined)
  assert.equal(JSON.stringify(db), before)
  assert.doesNotMatch(JSON.stringify(route.response.payload), DEMO_ID_PATTERN)
})

test('R166 import preview caps compact output', async () => {
  const payload = importedPayload()
  payload.purchaseOrders = Array.from({ length: 8 }, (_, index) => ({
    poId: `PO-IMPORT-CAP-${index + 1}`,
    supplierName: '导入供应商一号',
    lines: [{ itemSku: 'SKU-IMPORT-0001', quantityOrdered: '1' }],
  }))
  const route = importRouteContext('/api/user-data/import/preview', payload)
  assert.equal(await handleUserDataRoute(route.ctx), true)
  assert.equal(route.response.status, 200)
  assert.equal(route.response.payload.normalizedRecords.purchaseOrders.length, 5)
  assert.equal(route.response.payload.recordCounts.purchaseOrders, 8)
})
