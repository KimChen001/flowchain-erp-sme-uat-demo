import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAiInventoryAllocationResponse } from './ai-inventory-allocation-query.mjs'
import { getAiToolRegistry } from './ai-tool-registry.mjs'

const db = {
  products: [
    { sku: 'SKU-00412', itemName: '高扭矩伺服电机', currentStock: 40, reservedQuantity: 30, safetyStock: 60, reorderPoint: 70, unit: '件', riskLevel: '高', supplier: '深圳新元电气' },
  ],
  salesOrders: [
    { salesOrderId: 'SO-HIGH', customerName: '华东精密制造', customerTier: '重点客户', sku: 'SKU-00412', itemName: '高扭矩伺服电机', orderedQty: 100, reservedQty: 20, promisedDate: '2026-07-12', priority: '高', linkedPurchaseOrders: ['PO-2026-1282'], linkedSuppliers: ['深圳新元电气'] },
    { salesOrderId: 'SO-MID', customerName: '宁波电子科技', customerTier: '常规客户', sku: 'SKU-00412', itemName: '高扭矩伺服电机', orderedQty: 40, reservedQty: 10, promisedDate: '2026-07-18', priority: '中', linkedPurchaseOrders: ['PO-2026-1282'], linkedSuppliers: ['深圳新元电气'] },
  ],
  purchaseOrders: [
    { po: 'PO-2026-1282', supplier: '深圳新元电气', status: '已发出', eta: '2026-07-02', sourceSku: 'SKU-00412', sourceName: '高扭矩伺服电机', items: 80, received: 20 },
  ],
  receivingDocs: [
    { grn: 'GRN-2026-7788', po: 'PO-2026-1282', supplier: '深圳新元电气', status: '部分收货', items: 20 },
  ],
  suppliers: [
    { id: 'SUP-SZXY', name: '深圳新元电气', risk: '中', status: '启用' },
  ],
}

const forbidden = /Demo|UAT|演示数据|示例数据|样例数据|mock|sample|fake|fallback|provider fallback|tool_result|entityType|documentType|raw JSON|ActionDraft|purchase_request_draft|response_card/i

test('AI inventory allocation explains shortage with evidence and safe wording', () => {
  const result = buildAiInventoryAllocationResponse(db, { question: 'SKU-00412 为什么缺货？', moduleId: 'inventory' })
  assert.ok(result)
  assert.match(result.message, /结论/)
  assert.match(result.message, /关键证据/)
  assert.match(result.message, /业务影响/)
  assert.match(result.message, /建议动作/)
  assert.match(result.message, /可点击跳转/)
  assert.match(result.message, /数据限制 \/ 不确定性/)
  assert.match(result.message, /SKU-00412/)
  assert.match(result.message, /SO-HIGH/)
  assert.match(result.message, /PO-2026-1282/)
  assert.doesNotMatch(JSON.stringify(result), forbidden)
})

test('AI inventory allocation answers ATP and projected negative questions', () => {
  const atp = buildAiInventoryAllocationResponse(db, { question: 'SKU-00412 当前可承诺量是多少？' })
  assert.match(atp.message, /可承诺量/)
  assert.match(atp.message, /SKU-00412/)

  const negative = buildAiInventoryAllocationResponse(db, { question: '哪些 SKU 预计可用量为负？' })
  assert.match(negative.message, /预计可用/)
  assert.match(negative.message, /SKU-00412/)
  assert.doesNotMatch(JSON.stringify(negative), forbidden)
})

test('AI inventory allocation tools are read-only and audited', () => {
  const registry = getAiToolRegistry()
  for (const name of ['getInventoryAvailability', 'getSkuAllocation', 'getInventoryShortageRisks', 'getDemandSupplyGap', 'getAvailableToPromise', 'getReservationPreview', 'getSalesOrderAllocationImpact', 'getPurchaseOrderSupplyImpact']) {
    const tool = registry.find((item) => item.name === name)
    assert.ok(tool, name)
    assert.equal(tool.mode, 'read')
    assert.equal(tool.writesBusinessData, false)
    assert.equal(tool.requiresUserReview, false)
    assert.equal(tool.audit.recordInvocation, true)
  }
})
