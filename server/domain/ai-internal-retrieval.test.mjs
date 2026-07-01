import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildAiEvidenceBundles,
  classifyAiRetrievalIntent,
  extractAiRetrievalEntities,
} from './ai-internal-retrieval.mjs'

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

test('R101 PO evidence bundle includes deterministic procurement inventory and finance facts', () => {
  const result = buildAiEvidenceBundles(createPilotDb(), { query: '解释 PO-2026-1282 为什么优先' })
  const bundle = result.primaryBundle

  assert.equal(result.intent, 'priority_explanation_query')
  assert.equal(bundle.facts.id, 'PO-2026-1282')
  assert.equal(bundle.facts.status, '部分到货')
  assert.equal(bundle.facts.expectedDate, '2026-05-25')
  assert.equal(bundle.facts.supplier, '深圳新元电气')
  assert.equal(bundle.facts.amount, 82000)
  assert.ok(bundle.relatedDocuments.some((item) => item.id === 'PR-2026-2401'))
  assert.ok(bundle.relatedDocuments.some((item) => item.id === 'RFQ-26-0046'))
  assert.ok(bundle.relatedDocuments.some((item) => item.id === 'GRN-202605-0418'))
  assert.ok(bundle.relatedDocuments.some((item) => item.id === 'INV-SZ-260601'))
  assert.ok(bundle.relatedInventory.some((item) => item.sku === 'SKU-00412'))
  assert.ok(bundle.allowedActions.every((action) => ['deep_link', 'review', 'edit', 'draft_preview'].includes(action.kind)))
})

test('R101 SKU evidence bundle includes stock facts and review-first draft candidate', () => {
  const result = buildAiEvidenceBundles(createPilotDb(), { query: 'SKU-00412 为什么风险高？' })
  const bundle = result.primaryBundle

  assert.equal(bundle.bundleType, 'sku')
  assert.equal(bundle.facts.sku, 'SKU-00412')
  assert.equal(bundle.facts.availableQuantity, 34)
  assert.equal(bundle.facts.safetyStock, 50)
  assert.equal(bundle.facts.reorderPoint, 50)
  assert.equal(bundle.facts.warehouse, 'WH-A')
  assert.ok(bundle.relatedDocuments.some((item) => item.id === 'PO-2026-1282'))
  assert.ok(bundle.allowedActions.some((action) => action.kind === 'draft_preview' && action.draftType === 'purchase_request_draft'))
})

test('R101 RFQ evidence bundle includes response facts and linked documents', () => {
  const result = buildAiEvidenceBundles(createPilotDb(), { query: 'RFQ-26-0046 需要怎么跟进？' })
  const bundle = result.primaryBundle

  assert.equal(bundle.bundleType, 'rfq')
  assert.equal(bundle.facts.id, 'RFQ-26-0046')
  assert.equal(bundle.facts.status, '进行中')
  assert.equal(bundle.facts.expectedDate, '2026-06-22')
  assert.equal(bundle.facts.sourceRequest, 'PR-2026-2401')
  assert.ok(bundle.relatedDocuments.some((item) => item.id === 'PO-2026-1282'))
  assert.ok(bundle.allowedActions.some((action) => /RFQ-26-0046|业务明细/.test(action.label)))
})

test('R102 deterministic entity extraction detects SCM ids and suppliers', () => {
  const entities = extractAiRetrievalEntities('帮我看 PO-2026-1282、SKU-00412、RFQ-26-0046、GRN-202605-0418 和深圳新元电气', createPilotDb())

  assert.deepEqual(entities.map((item) => `${item.type}:${item.id}`), [
    'po:PO-2026-1282',
    'sku:SKU-00412',
    'rfq:RFQ-26-0046',
    'grn:GRN-202605-0418',
    'supplier:SUP-SZXY',
  ])
})

test('R102 deterministic intent extraction maps Chinese SCM prompts', () => {
  assert.equal(classifyAiRetrievalIntent('今天最需要处理什么？'), 'today_priority_query')
  assert.equal(classifyAiRetrievalIntent('解释 PO-2026-1282 为什么优先'), 'priority_explanation_query')
  assert.equal(classifyAiRetrievalIntent('哪些采购单据有风险？'), 'procurement_risk_query')
  assert.equal(classifyAiRetrievalIntent('SKU-00412 为什么风险高？'), 'inventory_risk_query')
  assert.equal(classifyAiRetrievalIntent('哪些 RFQ 需要跟进？'), 'rfq_followup_query')
  assert.equal(classifyAiRetrievalIntent('哪些供应商需要跟进？'), 'supplier_followup_query')
  assert.equal(classifyAiRetrievalIntent('有没有收货异常？'), 'receiving_exception_query')
  assert.equal(classifyAiRetrievalIntent('待审批 PR 有哪些？'), 'pr_status_query')
})

test('R103 retrieval service returns primary bundle and limitations without provider usage', () => {
  const result = buildAiEvidenceBundles(createPilotDb(), { query: '看一下 PO-2026-1282 的证据' })

  assert.equal(result.primaryBundle.facts.id, 'PO-2026-1282')
  assert.equal(Array.isArray(result.bundles), true)
  assert.equal(Array.isArray(result.limitations), true)
  assert.equal(JSON.stringify(result).includes('provider'), false)
})
