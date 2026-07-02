import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleAiRoute } from '../routes/ai.routes.mjs'
import { createAiUserScenarioDb } from './test-fixtures/ai-user-scenario.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const DEMO_ID_PATTERN = /PO-2026-1282|SKU-00412|RFQ-26-0046|PR-2026-2401|GRN-202605-0418|INV-SZ-260601|SUP-SZXY/

function createRouteContext(question, db = createAiUserScenarioDb()) {
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
      dataMode: 'test',
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

function visibleText(payload = {}) {
  const cards = (payload.cards || []).flatMap((card) => [
    card.id,
    card.type,
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
  })
}

test('R154 user-like fixture contains only user scenario ids for business records', () => {
  const db = createAiUserScenarioDb()
  const serialized = JSON.stringify(db)
  assert.match(serialized, /PO-USER-0001/)
  assert.match(serialized, /PR-USER-0001/)
  assert.match(serialized, /RFQ-USER-0001/)
  assert.match(serialized, /SKU-USER-0001/)
  assert.match(serialized, /GRN-USER-0001/)
  assert.match(serialized, /SUP-USER-0001/)
  assert.doesNotMatch(serialized, DEMO_ID_PATTERN)
})

test('R155 AI routes use user-like data ids and never leak demo ids', async () => {
  const cases = [
    { question: '今天最需要处理什么？', mustInclude: /PO-USER-0001|SKU-USER-0001|RFQ-USER-0001/ },
    { question: 'PO-USER-0001 为什么优先？', mustInclude: /PO-USER-0001/ },
    { question: 'SKU-USER-0001 为什么风险高？', mustInclude: /SKU-USER-0001/ },
    { question: 'RFQ-USER-0001 需要怎么跟进？', mustInclude: /RFQ-USER-0001/ },
    { question: '订单还有多少没有收货？', mustInclude: /PO-USER-0001|剩余\s*75|75\s*pcs/ },
    { question: '哪些供应商需要跟进？', mustInclude: /SUP-USER-0001|用户供应商一号/ },
    { question: '今天有什么需要我做的，订单还有多少没有收货，有哪些供应商会有潜在风险？', mustInclude: /PO-USER-0001|SKU-USER-0001|用户供应商一号/ },
  ]

  for (const item of cases) {
    const db = createAiUserScenarioDb()
    const before = businessSnapshot(db)
    const route = createRouteContext(item.question, db)
    assert.equal(await handleAiRoute(route.ctx), true)
    assert.equal(route.response.status, 200)
    assert.equal(route.providerCalls, 0)
    assert.equal(businessSnapshot(db), before)
    const text = visibleText(route.response.payload)
    assert.match(text, item.mustInclude)
    assert.doesNotMatch(JSON.stringify(route.response.payload), DEMO_ID_PATTERN)
  }
})

test('R155 receiving gap computes user-like remaining quantity', async () => {
  const route = createRouteContext('订单还有多少没有收货？')
  assert.equal(await handleAiRoute(route.ctx), true)
  const text = visibleText(route.response.payload)
  assert.match(text, /PO-USER-0001/)
  assert.match(text, /已收\s*45\s*\/\s*订购\s*120|剩余\s*75/)
  assert.match(text, /GRN-USER-0001/)
  assert.doesNotMatch(text, DEMO_ID_PATTERN)
})

test('R156 core runtime AI modules do not hardcode demo scenario ids', () => {
  const runtimeFiles = [
    'server/routes/ai.routes.mjs',
    'server/domain/ai-business-intent-router.mjs',
    'server/domain/ai-chat-status.mjs',
    'server/domain/ai-compound-query.mjs',
    'server/domain/ai-evidence-reuse.mjs',
    'server/domain/ai-model-router.mjs',
    'server/domain/ai-supplier-operational-query.mjs',
    'server/domain/ai-procurement-operational-query.mjs',
    'server/domain/ai-rfq-operational-query.mjs',
  ]

  for (const file of runtimeFiles) {
    const source = readFileSync(path.join(repoRoot, file), 'utf8')
    assert.doesNotMatch(source, DEMO_ID_PATTERN, file)
  }
})
