import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAiEvidenceReuseResponse } from './ai-evidence-reuse.mjs'
import { retrieveAiSopGuidance } from './ai-sop-retrieval.mjs'
import { buildAiSessionGroundedResponse, resolveAiSessionGrounding } from './ai-session-grounding.mjs'

function createPilotDb() {
  return {
    purchaseRequests: [
      { pr: 'PR-2026-2401', sourceSku: 'SKU-00412', sourceName: '伺服电机 750W', supplier: '深圳新元电气', requester: '张磊', buyer: '王志强', requiredDate: '2026-06-20', quantity: 20, amount: 42000, currency: 'CNY', status: '待审批' },
    ],
    rfqs: [
      { id: 'RFQ-26-0046', title: '高精度数控刀具', suppliers: 3, quoted: 1, due: '2026-06-22', status: '进行中', bestSupplier: '苏州刀具科技', sourceRequest: 'PR-2026-2401', linkedPo: 'PO-2026-1282', sourceSku: 'SKU-00412' },
    ],
    purchaseOrders: [
      { po: 'PO-2026-1282', supplier: '深圳新元电气', eta: '2026-05-25', owner: '王志强', amount: 82000, currency: 'CNY', items: 50, received: 20, status: '部分到货', sourceRequest: 'PR-2026-2401', sourceRfq: 'RFQ-26-0046', sourceSku: 'SKU-00412' },
      { po: 'PO-2026-1284', supplier: '苏州刀具科技', eta: '2026-06-30', amount: 9000, currency: 'CNY', items: 5, received: 0, status: '已发出' },
    ],
    receivingDocs: [
      { grn: 'GRN-202605-0418', po: 'PO-2026-1282', supplier: '深圳新元电气', status: '待质检', items: 20, passed: 18, failed: 2, warehouse: 'WH-A' },
    ],
    supplierInvoices: [],
    products: [
      { sku: 'SKU-00412', name: '伺服电机 750W', currentStock: 34, min: 50, reorderPoint: 50, unit: '台', warehouse: 'WH-A', status: '低库存', riskLevel: '高' },
    ],
    inventoryMovements: [],
    inventoryExceptions: [],
    suppliers: [{ id: 'SUP-SZXY', name: '深圳新元电气' }],
    forecastPlans: [],
    marketPrices: [],
    marketSignals: [],
    events: [],
    auditLog: [],
  }
}

test('R116 priority items expose deterministic business scoring signals', () => {
  const response = buildAiEvidenceReuseResponse(createPilotDb(), { moduleId: 'overview', message: '今天最需要处理什么？' }, { cache: {} })
  const items = response.cards.find((card) => card.type === 'procurement_followup_summary').data.priorityItems
  const first = items[0]

  assert.equal(first.id, 'PO-2026-1282')
  assert.equal(first.scoringSignals.overdueSignal, true)
  assert.equal(first.scoringSignals.severitySignal, '高')
  assert.equal(first.scoringSignals.dueDateSignal, '2026-05-25')
  assert.equal(first.scoringSignals.amountSignal, '金额较高')
  assert.match(first.scoringSignals.inventoryImpactSignal, /SKU-00412/)
  assert.equal(first.scoringSignals.receivingExceptionSignal, true)
  assert.deepEqual(items.map((item) => item.rank), items.map((_, index) => index + 1))
})

test('R117 SOP retrieval returns structured guidance without vector DB or provider', () => {
  const sop = retrieveAiSopGuidance({ query: '这种逾期 PO 通常怎么处理？' })

  assert.equal(sop.found, true)
  assert.equal(sop.guidance.id, 'SOP-PO-OVERDUE')
  assert.ok(sop.guidance.guidance.some((item) => item.includes('供应商最新 ETA')))
  assert.ok(sop.guidance.allowedActions.includes('po_followup_draft'))
  assert.match(sop.guidance.reviewBoundary, /不得自动/)
})

test('R117 SOP answer separates internal guidance from transactional evidence facts', () => {
  const response = buildAiEvidenceReuseResponse(createPilotDb(), { moduleId: 'overview', message: '逾期 PO 一般怎么处理？' }, { cache: {} })
  const workspace = response.cards.find((card) => card.type === 'evidence_workspace')

  assert.equal(response.intent.name, 'sop_retrieval_query')
  assert.equal(response.providerStatus, 'deterministic')
  assert.match(response.content, /处理建议\/内部规则/)
  assert.ok(response.evidence.some((item) => item.type === 'internal_sop' && item.id === 'SOP-PO-OVERDUE'))
  assert.equal(workspace.data.primaryObject, '逾期 PO 跟进')
  assert.doesNotMatch(JSON.stringify(response), /vector|embedding|openai|doubao/i)
})

test('R117 missing SOP returns limitation instead of hallucination', () => {
  const sop = retrieveAiSopGuidance({ query: '办公桌采购审批这种场景怎么办？' })

  assert.equal(sop.found, false)
  assert.match(sop.limitation, /未找到/)
})

test('R118 grounding reuses only unambiguous session context and activeContext matches', () => {
  const unambiguous = resolveAiSessionGrounding({
    message: '这个 PO 为什么优先？',
    sessionGrounding: { lastVisibleBusinessIds: { po: ['PO-2026-1282'] } },
  })
  const activeOnly = resolveAiSessionGrounding({
    message: '这个 RFQ 需要谁回复？',
    sessionGrounding: { activeContext: { entityType: 'rfq', entityId: 'RFQ-26-0046' }, lastVisibleBusinessIds: {} },
  })

  assert.equal(unambiguous.id, 'PO-2026-1282')
  assert.equal(activeOnly.id, 'RFQ-26-0046')
})

test('R118 grounding clarifies ambiguous or stale context and explicit ids override session', () => {
  const explicit = resolveAiSessionGrounding({
    message: '解释 PO-2026-1284 为什么优先',
    sessionGrounding: { lastVisibleBusinessIds: { po: ['PO-2026-1282'] } },
  })
  const ambiguous = buildAiSessionGroundedResponse(createPilotDb(), {
    message: '这个 PO 为什么优先？',
    sessionGrounding: {
      activeContext: { entityType: 'purchase_order', entityId: 'PO-2026-1284' },
      lastVisibleBusinessIds: { po: ['PO-2026-1282'] },
    },
  }, { cache: {} })
  const stale = buildAiSessionGroundedResponse(createPilotDb(), {
    message: '这个 SKU 风险高在哪里？',
    sessionGrounding: { lastVisibleBusinessIds: {} },
  }, { cache: {} })

  assert.equal(explicit, null)
  assert.equal(ambiguous.intent.name, 'session_grounding_clarification')
  assert.match(ambiguous.content, /PO-2026-1282 还是 PO-2026-1284/)
  assert.equal(stale.intent.name, 'session_grounding_clarification')
  assert.match(stale.content, /需要确认/)
})

