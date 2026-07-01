import test from 'node:test'
import assert from 'node:assert/strict'
import { handleAiRoute } from '../routes/ai.routes.mjs'
import {
  buildAiFinanceCollaborationResponse,
  detectAiFinanceCollaborationIntent,
} from './ai-finance-collaboration-query.mjs'

function createDb() {
  return {
    supplierInvoices: [
      {
        id: 'SI-1',
        invoiceNumber: 'INV-SZ-260422',
        supplier: '深圳新元电气',
        relatedPo: 'PO-2026-1283',
        relatedGrn: 'GRN-202605-0422',
        invoiceDate: '2026-05-27',
        dueDate: '2026-06-26',
        total: 1455000,
        currency: 'CNY',
        status: '存在差异',
        matchStatus: '人工复核',
        varianceAmount: 8600,
      },
      {
        id: 'SI-2',
        invoiceNumber: 'INV-HD-260423',
        supplier: '华东精工机械',
        relatedPo: 'PO-2026-1281',
        relatedGrn: 'GRN-202605-0423',
        invoiceDate: '2026-05-26',
        dueDate: '2026-05-26',
        total: 2169600,
        currency: 'CNY',
        status: '已付款',
        matchStatus: '自动匹配',
        varianceAmount: 0,
      },
      {
        id: 'SI-3',
        invoiceNumber: 'INV-SZ-260425',
        supplier: '深圳新元电气',
        relatedPo: 'PO-2026-1287',
        invoiceDate: '2026-05-31',
        dueDate: '2026-06-30',
        total: 2079200,
        currency: 'CNY',
        status: '待匹配',
        matchStatus: '未匹配',
        varianceAmount: 2079200,
      },
    ],
    purchaseOrders: [
      { po: 'PO-2026-1283', supplier: '深圳新元电气', amount: 1446400, status: '已发出', sourceRequest: 'PR-1' },
      { po: 'PO-2026-1281', supplier: '华东精工机械', amount: 2169600, status: '已收货', sourceRequest: 'PR-2' },
      { po: 'PO-2026-1287', supplier: '深圳新元电气', amount: 1840000, status: '待审批', sourceRequest: 'PR-3' },
    ],
    receivingDocs: [
      { grn: 'GRN-202605-0422', po: 'PO-2026-1283', supplier: '深圳新元电气', status: '已入库', items: 6, passed: 6, failed: 0 },
      { grn: 'GRN-202605-0423', po: 'PO-2026-1281', supplier: '华东精工机械', status: '已入库', items: 7, passed: 7, failed: 0 },
    ],
    products: [],
    suppliers: [],
    rfqs: [],
    purchaseRequests: [],
    inventoryMovements: [],
    events: [],
    auditLog: [],
  }
}

function createRouteContext(body, db = createDb()) {
  let response = null
  let wrote = false
  return {
    ctx: {
      req: { method: 'POST', headers: {}, body },
      res: {},
      url: new URL('/api/ai/chat', 'http://localhost'),
      db,
      readBody: async (req) => req.body,
      writeDb: async () => { wrote = true },
      event: () => {},
      ensureRfqs: (database) => Array.isArray(database.rfqs) ? database.rfqs : [],
      ensurePurchaseRequests: (database) => Array.isArray(database.purchaseRequests) ? database.purchaseRequests : [],
      ensureInventoryMovements: (database) => Array.isArray(database.inventoryMovements) ? database.inventoryMovements : [],
      ensureEvents: (database) => Array.isArray(database.events) ? database.events : [],
      ensureAuditLog: (database) => Array.isArray(database.auditLog) ? database.auditLog : [],
      supplierPerformance: () => [],
      supplierRecommendations: () => null,
      supplierQuoteCount: 0,
      openaiDispatcher: { dispatch() { throw new Error('external provider should not be used') } },
      arkDispatcher: { dispatch() { throw new Error('external provider should not be used') } },
      aiMaxTokens: 120,
      repositories: {},
      send(_res, status, payload) {
        response = { status, payload }
      },
    },
    get response() {
      return response
    },
    get wrote() {
      return wrote
    },
  }
}

function businessSnapshot(db) {
  return structuredClone({
    supplierInvoices: db.supplierInvoices,
    purchaseOrders: db.purchaseOrders,
    receivingDocs: db.receivingDocs,
  })
}

test('finance collaboration intent detection is scoped to finance prompts', () => {
  assert.equal(detectAiFinanceCollaborationIntent('查看待结算项', { moduleId: 'finance' }), 'finance_pending_settlement_query')
  assert.equal(detectAiFinanceCollaborationIntent('解释差异原因', { moduleId: 'finance' }), 'finance_variance_explanation_query')
  assert.equal(detectAiFinanceCollaborationIntent('下一步跟进', { moduleId: 'finance' }), 'finance_next_actions_query')
  assert.equal(detectAiFinanceCollaborationIntent('下一步跟进', { moduleId: 'inventory' }), null)
})

test('finance pending settlement response is deterministic and boundary-only', () => {
  const response = buildAiFinanceCollaborationResponse(createDb(), { moduleId: 'finance', message: '查看待结算项' })

  assert.equal(response.provider, 'local_finance_collaboration_query')
  assert.equal(response.providerStatus, 'deterministic')
  assert.equal(response.mode, 'read')
  assert.equal(response.intent.name, 'finance_pending_settlement_query')
  assert.match(response.message, /不执行付款或过账/)
  assert.ok(response.cards.some((card) => card.type === 'finance_pending_settlement_summary'))
  assert.ok(response.cards.some((card) => card.type === 'three_way_match_summary'))
  assert.ok(response.cards.some((card) => card.type === 'finance_boundary_notice'))
})

test('finance visible prompts do not use provider and do not mutate business data', async () => {
  const prompts = [
    ['查看待结算项', 'finance_pending_settlement_query'],
    ['解释差异原因', 'finance_variance_explanation_query'],
    ['下一步跟进', 'finance_next_actions_query'],
    ['哪些发票需要复核？', 'finance_variance_explanation_query'],
    ['哪些三单匹配有差异？', 'finance_variance_explanation_query'],
  ]

  for (const [message, intent] of prompts) {
    const db = createDb()
    const before = businessSnapshot(db)
    const route = createRouteContext({ moduleId: 'finance', message }, db)
    const handled = await handleAiRoute(route.ctx)

    assert.equal(handled, true, message)
    assert.equal(route.response.status, 200, message)
    assert.equal(route.response.payload.intent.name, intent, message)
    assert.equal(route.response.payload.usedWeb, false, message)
    assert.equal(route.response.payload.externalMs, 0, message)
    assert.notEqual(route.response.payload.provider, 'openai', message)
    assert.notEqual(route.response.payload.provider, 'doubao', message)
    assert.notEqual(route.response.payload.intent.name, 'provider_disabled', message)
    assert.match(route.response.payload.message || route.response.payload.content, /不执行付款|不做会计过账|不处理税务申报|最终审批/, message)
    assert.ok(route.response.payload.cards.some((card) => card.type === 'finance_boundary_notice'), message)
    assert.ok(route.response.payload.cards.some((card) => card.type === 'recommended_actions'), message)
    const actions = route.response.payload.cards.find((card) => card.type === 'recommended_actions').actions
    assert.ok(actions.every((action) => !/^https?:\/\//i.test(action.target || '')), message)
    assert.deepEqual(businessSnapshot(db), before, message)
  }
})

