import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAiEvidenceGraphResponse } from './ai-evidence-graph-query.mjs'

function createDb() {
  return {
    __dataMode: 'workspace',
    products: [{ sku: 'SKU-00412', name: '高扭矩伺服电机', currentStock: 34, reservedQuantity: 36, safetyStock: 50, supplier: '深圳新元电气', status: '低库存', riskLevel: '高' }],
    suppliers: [{ id: 'SUP-SZXY', name: '深圳新元电气', status: 'active', risk: 'medium' }],
    salesOrders: [{ salesOrderId: 'SO-2026-0412-A', customerName: '华东精密制造', sku: 'SKU-00412', orderedQty: 120, reservedQty: 36, promisedDate: '2026-07-12', priority: '高', linkedPurchaseOrders: ['PO-2026-1282'], linkedSuppliers: ['深圳新元电气'], status: 'shortage_risk' }],
    purchaseRequests: [{ pr: 'PR-2026-2401', sourceSku: 'SKU-00412', supplier: '深圳新元电气', quantity: 120, status: '已批准' }],
    rfqs: [{ id: 'RFQ-26-0046', sourceRequest: 'PR-2026-2401', sourceSku: 'SKU-00412', bestSupplier: '深圳新元电气', status: '进行中' }],
    purchaseOrders: [{ po: 'PO-2026-1282', sourceSku: 'SKU-00412', sourceRequest: 'PR-2026-2401', sourceRfq: 'RFQ-26-0046', supplier: '深圳新元电气', eta: '2026-07-10', items: 120, received: 20, status: '部分到货' }],
    receivingDocs: [{ grn: 'GRN-202605-0418', po: 'PO-2026-1282', supplier: '深圳新元电气', status: '待质检' }],
    supplierInvoices: [{ invoiceNumber: 'INV-SZ-260601', supplier: '深圳新元电气', relatedPo: 'PO-2026-1282', relatedGrn: 'GRN-202605-0418', amount: 82000, varianceAmount: 1200, matchStatus: '存在差异' }],
  }
}

function assertClean(text) {
  assert.doesNotMatch(text, /raw JSON|provider fallback|tool_result|entityType|documentType|ActionDraft|purchase_request_draft|response_card/i)
  assert.doesNotMatch(text, /Demo|UAT|演示数据|示例数据|样例数据|mock|sample|fake|fallback/i)
}

test('AI evidence graph answers explicit SKU evidence chain questions', () => {
  const result = buildAiEvidenceGraphResponse(createDb(), { question: 'SKU-00412 的证据链是什么？' })

  assert.equal(result.intent.name, 'evidence_graph_query')
  assert.match(result.content, /结论/)
  assert.match(result.content, /关键证据/)
  assert.match(result.content, /业务影响/)
  assert.match(result.content, /建议动作/)
  assert.match(result.content, /可点击跳转/)
  assert.match(result.content, /数据限制 \/ 不确定性/)
  assert.match(result.content, /SKU-00412/)
  assert.match(result.content, /PO-2026-1282/)
  assert.ok(result.evidence.some((item) => item.id === 'SKU-00412'))
  assert.ok(result.evidence.some((item) => item.id === 'PO-2026-1282'))
  assertClean(result.content)
})

test('AI evidence graph answers PO downstream impact questions without stealing non-graph prompts', () => {
  const result = buildAiEvidenceGraphResponse(createDb(), { question: 'PO-2026-1282 会影响哪些客户订单和 SKU？' })
  const draft = buildAiEvidenceGraphResponse(createDb(), { question: '帮我生成 PO-2026-1282 供应商跟进草稿' })

  assert.match(result.content, /SO-2026-0412-A/)
  assert.match(result.content, /SKU-00412/)
  assert.equal(draft, null)
  assertClean(result.content)
})

test('AI evidence graph reports missing anchor with business limitation', () => {
  const result = buildAiEvidenceGraphResponse(createDb(), { question: 'SKU-NOT-FOUND 的证据链是什么？' })

  assert.match(result.content, /当前工作区缺少完整关联记录/)
  assert.match(result.content, /当前工作区未找到对应业务记录/)
  assert.doesNotMatch(result.content, /record_not_found/)
  assertClean(result.content)
})
