import test from 'node:test'
import assert from 'node:assert/strict'
import { handleAiRoute } from '../routes/ai.routes.mjs'

function createDb() {
  return {
    products: [
      {
        id: 'ITEM-A100',
        sku: 'A100',
        name: 'Motor A100',
        currentStock: 4,
        min: 20,
        moq: 10,
        reorderPoint: 15,
        unit: 'pcs',
        baseUom: 'pcs',
        defaultWarehouseId: 'WH-A',
        preferredSupplierId: 'SUP-001',
        preferredSupplierSource: 'matched_supplier_master',
        status: '低库存',
        riskLevel: '高',
      },
    ],
    warehouses: [{ id: 'WH-A', name: 'Main Warehouse', sourceType: 'default_reference' }],
    suppliers: [{ id: 'SUP-001', name: 'ABC Components', status: 'active', risk: 'medium', score: 82 }],
    rfqs: [
      {
        id: 'RFQ-1001',
        title: 'A100 RFQ',
        status: '进行中',
        suppliers: 2,
        quoted: 1,
        due: '2026-07-03',
        sourceSku: 'A100',
        sourceRequest: 'PR-1001',
        responses: [
          { supplierId: 'SUP-001', supplierName: 'ABC Components', responseStatus: 'pending' },
        ],
      },
    ],
    purchaseRequests: [
      { pr: 'PR-1001', status: '已批准', sourceSku: 'A100', sourceName: 'Motor A100', quantity: 100, requiredDate: '2026-07-05', supplier: 'ABC Components', priority: '高' },
      { pr: 'PR-1002', status: '待审批', sourceSku: 'A100', quantity: 40, requiredDate: '2026-07-06', supplier: 'ABC Components', priority: '中' },
    ],
    purchaseOrders: [
      { po: 'PO-1001', supplier: 'ABC Components', eta: '2026-06-20', status: '已发出', items: 100, received: 40, sourceRequest: 'PR-1001', priority: '高' },
    ],
    receivingDocs: [
      { grn: 'GRN-1001', po: 'PO-1001', supplier: 'ABC Components', items: 100, passed: 35, failed: 5, status: '异常处理', warehouse: 'WH-A' },
    ],
    inventoryMovements: [
      { movementId: 'MV-1001', sku: 'A100', itemName: 'Motor A100', quantity: -6, status: 'posted', warehouse: 'WH-A' },
    ],
    inventoryExceptions: [
      { id: 'IEX-1001', sku: 'A100', itemName: 'Motor A100', status: '待复核', quantityImpact: -6, nextAction: '复核低库存' },
    ],
    salesForecasts: [
      { sku: 'A100', period: '2026-W27', demand: 120 },
    ],
    forecastPlans: [
      { id: 'FC-1001', sku: 'A100', name: 'A100 Forecast', method: 'moving_average', metrics: { mape: 0.18, rmse: 4.2 } },
    ],
    bom: [],
    marketPrices: [],
    marketSignals: [],
    events: [],
    auditLog: [],
  }
}

function createRouteContext(body, db = createDb(), helpers = {}) {
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
      ...helpers,
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
    products: db.products,
    suppliers: db.suppliers,
    rfqs: db.rfqs,
    purchaseRequests: db.purchaseRequests,
    purchaseOrders: db.purchaseOrders,
    receivingDocs: db.receivingDocs,
    inventoryMovements: db.inventoryMovements,
    inventoryExceptions: db.inventoryExceptions,
    forecastPlans: db.forecastPlans,
  })
}

function failingReadContextRepositories() {
  const fail = async () => {
    throw new Error('buildAiReadContext should not run for deterministic Alpha quick prompts')
  }
  return {
    procurementRead: { listDocuments: fail, listFollowups: fail, getSummary: fail },
    inventoryRead: { listItems: fail, listExceptions: fail, getSummary: fail },
    masterData: { listItems: fail, listSuppliers: fail },
  }
}

const alphaCriticalPrompts = [
  { moduleId: 'overview', message: '今天最需要处理什么？', intent: 'today_cockpit_priority_query' },
  { moduleId: 'overview', message: '哪些采购单据有风险？', intent: 'procurement_exception_query' },
  { moduleId: 'overview', message: '哪些库存项目需要关注？', intent: 'inventory_status_query' },
  { moduleId: 'procurement', message: '今天采购有什么要跟？', intent: 'procurement_followup_summary_query' },
  { moduleId: 'procurement', message: '哪些 PO 快逾期？', intent: 'po_overdue_query' },
  { moduleId: 'procurement', message: '哪些 RFQ 没回复？', intent: 'rfq_response_query' },
  { moduleId: 'procurement', message: '哪些采购申请还没转 PO？', intent: 'pr_conversion_status_query' },
  { moduleId: 'procurement', message: '哪些收货有异常？', intent: 'receiving_exception_query' },
  { moduleId: 'inventory', message: '查看库存风险', intent: 'inventory_status_query' },
  { moduleId: 'inventory', message: '解释库存异常', intent: 'inventory_status_query' },
  { moduleId: 'inventory', message: '准备 PR 草稿 A100 50 明天', intent: 'prepare_purchase_request_draft' },
  { moduleId: 'forecast', message: '哪些 SKU 有 MRP 例外？', intent: 'planning_status_query' },
  { moduleId: 'forecast', message: 'MRP 计划释放有哪些需要审阅？', intent: 'planning_status_query' },
  { moduleId: 'forecast', message: '这个 forecast 的 MAPE 怎么样？', intent: 'planning_status_query' },
]

test('Alpha-critical AI quick prompts bypass read-context, provider, and mutation', async () => {
  const db = createDb()
  const before = businessSnapshot(db)

  for (const prompt of alphaCriticalPrompts) {
    const route = createRouteContext(prompt, db, { repositories: failingReadContextRepositories() })
    const handled = await handleAiRoute(route.ctx)

    assert.equal(handled, true, prompt.message)
    assert.equal(route.response.status, 200, prompt.message)
    assert.equal(route.response.payload.intent.name, prompt.intent, prompt.message)
    assert.equal(route.response.payload.fastPath, 'pre_read_context', prompt.message)
    assert.equal(route.response.payload.usedWeb, false, prompt.message)
    assert.equal(route.response.payload.externalMs, 0, prompt.message)
    assert.notEqual(route.response.payload.provider, 'openai', prompt.message)
    assert.notEqual(route.response.payload.provider, 'doubao', prompt.message)
    assert.ok(Array.isArray(route.response.payload.cards), prompt.message)
    assert.ok(route.response.payload.cards.length > 0, prompt.message)
    assert.ok(
      route.response.payload.evidence?.length ||
        route.response.payload.cards.some((card) => card.type === 'evidence' || card.type === 'missing_fields'),
      prompt.message,
    )
    assert.ok(
      route.response.payload.cards.some((card) => card.type === 'recommended_actions' || card.type === 'pr_draft'),
      prompt.message,
    )
    assert.deepEqual(businessSnapshot(db), before, prompt.message)
  }
})
