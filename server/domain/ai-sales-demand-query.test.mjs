import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAiSalesDemandResponse } from './ai-sales-demand-query.mjs'
import { getAiToolRegistry } from './ai-tool-registry.mjs'

function createDb() {
  return {
    products: [{ sku: 'SKU-00412', itemName: '高扭矩伺服电机', currentStock: 20, safetyStock: 60, reservedQuantity: 20, unit: '件', riskLevel: '高', supplier: '深圳新元电气' }],
    purchaseOrders: [{ po: 'PO-2026-1282', supplier: '深圳新元电气', status: '延迟', eta: '2026-07-20', sourceSku: 'SKU-00412', sourceName: '高扭矩伺服电机' }],
    receivingDocs: [],
    suppliers: [{ id: 'SUP-001', name: '深圳新元电气', risk: '高风险', status: '启用' }],
    salesOrders: [{ salesOrderId: 'SO-HIGH', customerName: '华东精密制造', sku: 'SKU-00412', itemName: '高扭矩伺服电机', orderedQty: 100, reservedQty: 20, promisedDate: '2026-07-12', linkedPurchaseOrders: ['PO-2026-1282'], linkedSuppliers: ['深圳新元电气'] }],
  }
}

function assertCleanAiPayload(payload) {
  const serialized = JSON.stringify(payload)
  assert.equal(/raw JSON|provider fallback|tool_result|entityType|documentType|ActionDraft|purchase_request_draft|response_card/i.test(serialized), false)
  assert.equal(/Demo|UAT|演示数据|示例数据|样例数据|sample data|demo data|UAT data/i.test(serialized), false)
  assert.equal(payload.providerStatus, 'deterministic')
  assert.equal(payload.cards.some((card) => card.type === 'recommended_actions'), true)
  assert.equal(payload.evidence.length > 0, true)
}

test('AI sales demand query answers delivery risk with evidence and clean wording', () => {
  const payload = buildAiSalesDemandResponse(createDb(), { moduleId: 'sales', question: '哪些客户订单有交付风险？' })
  assert.equal(payload.intent.name, 'customer_delivery_risk_query')
  assert.match(payload.message, /SO-HIGH/)
  assert.match(payload.message, /SKU-00412/)
  assert.match(payload.message, /建议/)
  assertCleanAiPayload(payload)
})

test('AI sales demand query handles SKU and PO impact questions', () => {
  const sku = buildAiSalesDemandResponse(createDb(), { question: 'SKU-00412 缺货会影响哪些客户订单？' })
  assert.equal(sku.intent.name, 'sku_demand_impact_query')
  assert.match(sku.message, /影响 1 个客户订单/)
  assertCleanAiPayload(sku)

  const po = buildAiSalesDemandResponse(createDb(), { question: 'PO-2026-1282 延迟会影响哪些销售订单？' })
  assert.equal(po.intent.name, 'purchase_order_sales_impact_query')
  assert.match(po.message, /华东精密制造/)
  assertCleanAiPayload(po)
})

test('AI sales demand tools are read-only and audited', () => {
  const tools = getAiToolRegistry().filter((tool) => tool.module === 'sales')
  assert.deepEqual(tools.map((tool) => tool.name), [
    'getSalesDemandSummary',
    'getCustomerDeliveryRisks',
    'getSalesOrderImpact',
    'getSkuDemandImpact',
    'getPurchaseOrderSalesImpact',
  ])
  for (const tool of tools) {
    assert.equal(tool.mode, 'read')
    assert.equal(tool.writesBusinessData, false)
    assert.equal(tool.requiresUserReview, false)
    assert.equal(tool.audit.recordInvocation, true)
  }
})
