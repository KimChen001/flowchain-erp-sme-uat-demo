import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildAiRetrievalContext,
  validateAiRetrievalActions,
  validateAiRetrievalOutput,
} from './ai-retrieval-context.mjs'

function createPilotDb() {
  return {
    purchaseRequests: [
      { pr: 'PR-2026-2401', sourceSku: 'SKU-00412', sourceName: '伺服电机 750W', supplier: '深圳新元电气', requester: '张磊', buyer: '王志强', requiredDate: '2026-06-20', quantity: 20, amount: 42000, currency: 'CNY', status: '待审批' },
    ],
    rfqs: [
      { id: 'RFQ-26-0046', title: '高精度数控刀具', suppliers: 3, quoted: 1, due: '2026-06-22', status: '进行中', bestSupplier: '苏州刀具科技', sourceRequest: 'PR-2026-2401', linkedPo: 'PO-2026-1282' },
    ],
    purchaseOrders: [
      { po: 'PO-2026-1282', supplier: '深圳新元电气', eta: '2026-05-25', owner: '王志强', amount: 82000, currency: 'CNY', items: 50, received: 20, status: '部分到货', sourceRequest: 'PR-2026-2401', sourceRfq: 'RFQ-26-0046', sourceSku: 'SKU-00412' },
    ],
    receivingDocs: [
      { grn: 'GRN-202605-0418', po: 'PO-2026-1282', supplier: '深圳新元电气', status: '待质检', items: 20, passed: 18, failed: 2, warehouse: 'WH-A' },
    ],
    supplierInvoices: [
      { invoiceNumber: 'INV-SZ-260601', supplier: '深圳新元电气', relatedPo: 'PO-2026-1282', relatedGrn: 'GRN-202605-0418', amount: 82000, currency: 'CNY', varianceAmount: 1200, matchStatus: '存在差异' },
    ],
    products: [
      { sku: 'SKU-00412', name: '伺服电机 750W', currentStock: 34, min: 50, reorderPoint: 50, unit: '台', warehouse: 'WH-A', status: '低库存', riskLevel: '高' },
    ],
    inventoryMovements: [],
    inventoryExceptions: [
      { id: 'IEX-1', sku: 'SKU-00412', itemName: '伺服电机 750W', status: '待复核', quantityImpact: -2, reason: '盘点差异' },
    ],
    suppliers: [{ id: 'SUP-SZXY', name: '深圳新元电气' }],
    forecastPlans: [],
    marketPrices: [],
    marketSignals: [],
    events: [],
    auditLog: [],
  }
}

test('R104 context separates immutable facts evidence and allowed wording', () => {
  const context = buildAiRetrievalContext(createPilotDb(), { query: '解释 PO-2026-1282 为什么优先' })

  assert.equal(context.immutableFacts.id, 'PO-2026-1282')
  assert.equal(context.immutableFacts.status, '部分到货')
  assert.ok(context.evidence.some((item) => item.id === 'PO-2026-1282'))
  assert.ok(context.allowedActions.every((action) => action.requiresHumanReview || action.kind === 'deep_link'))
  assert.ok(context.responseRules.some((rule) => rule.includes('只能使用')))
  assert.equal(JSON.stringify(context).includes('provider'), false)
})

test('R105 guardrail flags internal implementation labels', () => {
  const context = buildAiRetrievalContext(createPilotDb(), { query: '解释 PO-2026-1282 为什么优先' })
  const result = validateAiRetrievalOutput('debug: documentType=po entityType=po inventory_item linked in tool_result', context)

  assert.equal(result.valid, false)
  assert.ok(result.violations.some((item) => item.code === 'internal_term_leak' && item.term === 'documentType'))
  assert.ok(result.violations.some((item) => item.term === 'inventory_item'))
})

test('R105 guardrail flags fact rewrites and unsupported dates or amounts', () => {
  const context = buildAiRetrievalContext(createPilotDb(), { query: '解释 PO-2026-1282 为什么优先' })
  const result = validateAiRetrievalOutput('PO-2026-1282 已完成，金额 ¥99,999，预计 2026-08-01。', context)

  assert.equal(result.valid, false)
  assert.ok(result.violations.some((item) => item.code === 'fact_status_mismatch'))
  assert.ok(result.violations.some((item) => item.code === 'unsupported_amount'))
  assert.ok(result.violations.some((item) => item.code === 'unsupported_date'))
})

test('R106 allowed actions remain compatible and reject auto-submit actions', () => {
  const context = buildAiRetrievalContext(createPilotDb(), { query: 'SKU-00412 为什么风险高？' })

  assert.ok(context.allowedActions.some((action) => action.kind === 'draft_preview' && action.draftType === 'purchase_request_draft'))
  assert.equal(validateAiRetrievalActions(context.allowedActions).valid, true)

  const unsafe = validateAiRetrievalActions([{ kind: 'submit_purchase_request', autoSubmit: true }])
  assert.equal(unsafe.valid, false)
  assert.ok(unsafe.violations.some((item) => item.code === 'unsafe_action'))
})

