import test from 'node:test'
import assert from 'node:assert/strict'
import { handleAiRoute } from '../routes/ai.routes.mjs'

function createDb(overrides = {}) {
  return {
    products: [
      { id: 'ITEM-A100', sku: 'A100', name: 'Motor A100', currentStock: 4, min: 20, moq: 10, reorderPoint: 15, safetyStock: 12, unit: 'pcs', baseUom: 'pcs', defaultWarehouseId: 'WH-A', preferredSupplierId: 'SUP-001', supplier: 'ABC Components', defaultTaxCode: 'TAX-STD', status: '低库存', riskLevel: '高', leadTimeDays: 7 },
      { id: 'ITEM-B200', sku: 'B200', name: 'Bracket B200', supplier: 'Unlisted Supplier', status: '待完善' },
    ],
    warehouses: [{ id: 'WH-A', name: 'Main Warehouse', sourceType: 'explicit_data' }],
    suppliers: [
      { id: 'SUP-001', supplierId: 'SUP-001', name: 'ABC Components', supplierName: 'ABC Components', status: 'active', risk: '高', score: 68, paymentTermsId: 'NET30', defaultCurrency: 'USD' },
      { id: 'SUP-002', name: 'No Score Supplier', risk: '中' },
    ],
    paymentTerms: [{ id: 'NET30', label: 'Net 30', days: 30 }],
    taxCodes: [{ id: 'TAX-STD', label: 'Standard Tax', rate: 0.1 }],
    rfqs: [
      { id: 'RFQ-1001', rfq: 'RFQ-1001', title: 'A100 RFQ', status: '进行中', suppliers: 2, quoted: 1, due: '2026-07-03', sourceSku: 'A100', sourceRequest: 'PR-1001', bestSupplier: 'ABC Components', invitedSuppliers: ['ABC Components', 'No Score Supplier'], responses: [{ supplierId: 'SUP-001', supplierName: 'ABC Components', responseStatus: 'pending' }] },
    ],
    purchaseRequests: [
      { pr: 'PR-1001', id: 'PR-1001', status: '已批准', sourceSku: 'A100', sourceName: 'Motor A100', quantity: 100, requiredDate: '2026-07-05', supplier: 'ABC Components', priority: '高' },
      { pr: 'PR-1002', id: 'PR-1002', status: '待审批', sourceSku: 'A100', quantity: 40, requiredDate: '2026-07-06', supplier: 'ABC Components', priority: '中' },
    ],
    purchaseOrders: [
      { po: 'PO-1001', id: 'PO-1001', supplier: 'ABC Components', supplierId: 'SUP-001', eta: '2026-06-20', status: '已发出', items: 100, received: 40, sourceRequest: 'PR-1001', priority: '高', lines: [{ sku: 'A100', quantity: 100 }] },
    ],
    receivingDocs: [
      { grn: 'GRN-1001', id: 'GRN-1001', po: 'PO-1001', supplier: 'ABC Components', supplierId: 'SUP-001', items: 100, passed: 35, failed: 5, status: '异常处理', warehouse: 'WH-A', lines: [{ sku: 'A100', rejectedQty: 5 }] },
    ],
    supplierInvoices: [
      { id: 'SI-1001', invoiceNumber: 'INV-1001', supplier: 'ABC Components', supplierCode: 'SUP-001', relatedPo: 'PO-1001', relatedGrn: 'GRN-1001', amount: 1000, currency: 'USD', status: '存在差异', matchStatus: '差异待处理', varianceType: '数量差异', varianceAmount: 120 },
    ],
    inventoryMovements: [
      { movementId: 'MV-1001', id: 'MV-1001', sku: 'A100', itemName: 'Motor A100', quantity: -6, status: 'posted', warehouse: 'WH-A' },
    ],
    inventoryExceptions: [
      { id: 'IEX-1001', sku: 'A100', itemName: 'Motor A100', status: '待复核', quantityImpact: -6, nextAction: '复核低库存' },
    ],
    salesForecasts: [{ sku: 'A100', period: '2026-W27', demand: 120 }],
    forecastPlans: [{ id: 'FC-1001', sku: 'A100', name: 'A100 Forecast', method: 'moving_average', metrics: { mape: 0.18, rmse: 4.2 }, procurementSuggestion: { quantity: 50, amount: 5000, supplier: 'ABC Components', priority: '高' } }],
    bom: [],
    marketPrices: [],
    marketSignals: [],
    events: [],
    auditLog: [],
    ...overrides,
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
      supplierPerformance: (database) => database.suppliers || [],
      supplierRecommendations: () => null,
      supplierQuoteCount: 1,
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
    products: db.products,
    suppliers: db.suppliers,
    warehouses: db.warehouses,
    paymentTerms: db.paymentTerms,
    taxCodes: db.taxCodes,
    rfqs: db.rfqs,
    purchaseRequests: db.purchaseRequests,
    purchaseOrders: db.purchaseOrders,
    receivingDocs: db.receivingDocs,
    supplierInvoices: db.supplierInvoices,
    inventoryMovements: db.inventoryMovements,
    inventoryExceptions: db.inventoryExceptions,
    forecastPlans: db.forecastPlans,
  })
}

async function ask(body, db = createDb()) {
  const before = businessSnapshot(db)
  const route = createRouteContext(body, db)
  await handleAiRoute(route.ctx)
  assert.equal(route.response?.status, 200, body.question)
  assert.deepEqual(businessSnapshot(db), before, body.question)
  return route.response.payload
}

function card(payload, type) {
  return payload.cards.find((item) => item.type === type)
}

function actionTargets(payload) {
  return payload.cards
    .filter((item) => item.type === 'recommended_actions')
    .flatMap((item) => item.actions || [])
    .map((action) => action.target)
    .filter(Boolean)
}

function assertInternalTargets(payload, label) {
  for (const target of actionTargets(payload)) {
    assert.match(target, /^\//, `${label}: ${target}`)
    assert.doesNotMatch(target, /^\/\//, `${label}: ${target}`)
    assert.doesNotMatch(target, /^https?:/i, `${label}: ${target}`)
  }
}

test('R84 RFQ pending response counts align with RFQ evidence and internal targets', async () => {
  const payload = await ask({ moduleId: 'procurement', question: '哪些 RFQ 没回复？' })
  const summary = card(payload, 'rfq_response_summary')
  assert.equal(payload.intent.name, 'rfq_response_query')
  assert.equal(summary.data.rfqsWithPendingResponses, 1)
  assert.equal(summary.data.topPendingRfqs[0].rfqId, 'RFQ-1001')
  assert.equal(summary.data.topPendingRfqs[0].pendingSupplierCount, 1)
  assert.ok(payload.evidence.some((item) => item.type === 'rfq' && item.id === 'RFQ-1001'))
  assertInternalTargets(payload, 'rfq pending response')
})

test('R84 inventory risk distinguishes confirmed balances from missing stock balance evidence', async () => {
  const payload = await ask({ moduleId: 'inventory', question: '查看库存风险' })
  const summary = card(payload, 'inventory_risk_summary')
  assert.equal(payload.intent.name, 'inventory_status_query')
  assert.equal(summary.data.stockBalanceEvidence, 'available')
  assert.equal(summary.data.topRiskItems[0].sku, 'A100')
  assert.match(payload.content, /已确认库存余额风险|库存事务风险|MRP\/计划风险/)
  assert.ok(payload.evidence.some((item) => item.type === 'item_master' && item.id === 'items'))
  assert.ok(payload.evidence.some((item) => item.type === 'inventory_movement' && item.id === 'inventory_movements'))
  assertInternalTargets(payload, 'inventory risk')

  const missingBalanceDb = createDb({
    products: [{ id: 'ITEM-C300', sku: 'C300', name: 'Controller C300', moq: 10, supplier: 'ABC Components' }],
    inventoryMovements: [],
    inventoryExceptions: [],
  })
  const missingPayload = await ask({ moduleId: 'inventory', question: '查看库存风险' }, missingBalanceDb)
  const missingSummary = card(missingPayload, 'inventory_risk_summary')
  assert.equal(missingSummary.data.stockBalanceEvidence, 'missing')
  assert.match(missingPayload.content, /缺少可用库存余额字段|缺少库存余额证据|不能直接判断真实缺货/)
  assert.ok(missingPayload.evidence.some((item) => item.type === 'missing_quantity_evidence'))
})

test('R84 finance settlement stays evidence-backed and never offers payment or posting', async () => {
  const payload = await ask({ moduleId: 'finance', question: '查看待结算项' })
  const settlement = card(payload, 'finance_pending_settlement_summary')
  const boundary = card(payload, 'finance_boundary_notice')
  assert.equal(payload.intent.name, 'finance_pending_settlement_query')
  assert.equal(settlement.data.pendingSettlementCount, 1)
  assert.equal(settlement.data.varianceInvoiceCount, 1)
  assert.match(boundary.data.boundary, /不执行付款/)
  assert.match(boundary.data.boundary, /过账/)
  assert.ok(payload.evidence.some((item) => item.type === 'supplier_invoice' && item.id === 'INV-1001'))
  assert.ok(payload.evidence.some((item) => item.type === 'threeWayMatch'))
  assert.doesNotMatch(JSON.stringify(actionTargets(payload)), /payment|posting|付款|过账/i)
  assertInternalTargets(payload, 'finance settlement')
})

test('R84 supplier risk evidence aligns with PO RFQ invoice and inventory signals', async () => {
  const payload = await ask({ moduleId: 'srm', question: '查看高风险供应商' })
  const summary = card(payload, 'supplier_high_risk_summary')
  const supplier = summary.data.topSuppliers.find((item) => item.supplierId === 'SUP-001')
  assert.equal(payload.intent.name, 'supplier_high_risk_summary_query')
  assert.ok(supplier)
  assert.equal(supplier.risk, '高')
  assert.equal(supplier.pendingRfqResponseCount, 1)
  assert.equal(supplier.invoiceIssueCount, 1)
  assert.equal(supplier.inventoryRiskItemCount, 1)
  assert.ok(summary.data.overduePoCount >= 1)
  assert.match(card(payload, 'supplier_boundary_notice').data.message, /不创建 RFQ|不发送供应商消息|不变更评分/)
  assertInternalTargets(payload, 'supplier risk')
})

test('R84 master data issues are backed by issue rows and read-only boundary copy', async () => {
  const payload = await ask({ moduleId: 'master-data', question: '检查主数据质量' })
  const quality = card(payload, 'master_data_quality_summary')
  const missing = card(payload, 'master_data_missing_fields_summary')
  const boundary = card(payload, 'master_data_boundary_notice')
  assert.equal(payload.intent.name, 'master_data_quality_query')
  assert.equal(quality.data.issueCount, missing.data.missingFieldCount)
  assert.equal(missing.data.topIssues.length, missing.data.missingFieldCount)
  assert.ok(missing.data.topIssues.every((item) => item.entityType && item.entityId && item.field && item.reason))
  assert.match(boundary.data.message, /不创建或修改主数据|不自动修复默认值/)
  assert.ok(payload.evidence.some((item) => item.type === 'master_data' && item.id === 'items'))
  assertInternalTargets(payload, 'master data quality')
})
