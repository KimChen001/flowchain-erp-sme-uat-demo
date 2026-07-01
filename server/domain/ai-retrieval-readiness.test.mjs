import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAiEvidenceBundles } from './ai-internal-retrieval.mjs'
import { buildAiRetrievalContext, validateAiRetrievalOutput } from './ai-retrieval-context.mjs'
import { createNoopAiModelAdapter, getAiModelBoundaryState } from './ai-retrieval-audit-boundary.mjs'
import {
  buildAiRetrievalSandboxPrompt,
  getAiRetrievalSandboxState,
  runAiRetrievalSandbox,
} from './ai-retrieval-sandbox.mjs'

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

test('R109 LLM sandbox is disabled by default and keeps fallback deterministic', async () => {
  const context = buildAiRetrievalContext(createPilotDb(), { query: '解释 PO-2026-1282 为什么优先' })
  const fallbackAnswer = 'PO-2026-1282 当前状态为部分到货，金额 ¥82,000，预计日期 2026-05-25。'
  const result = await runAiRetrievalSandbox(context, { fallbackAnswer })

  assert.equal(getAiRetrievalSandboxState({}).enabled, false)
  assert.equal(result.usedModel, false)
  assert.equal(result.answer, fallbackAnswer)
  assert.equal(result.guardrail.valid, true)
})

test('R109 sandbox prompt contains only facts evidence and allowed actions', () => {
  const context = buildAiRetrievalContext(createPilotDb(), { query: 'SKU-00412 为什么风险高？' })
  const prompt = buildAiRetrievalSandboxPrompt(context)

  assert.equal(prompt.role, 'wording_sandbox')
  assert.equal(prompt.immutableFacts.sku, 'SKU-00412')
  assert.ok(prompt.evidence.every((item) => item.id && !('type' in item)))
  assert.ok(prompt.allowedActions.some((action) => action.kind === 'draft_preview'))
  assert.equal(JSON.stringify(prompt).includes('auditContext'), false)
})

test('R110 retrieval readiness keeps core prompt families deterministic', () => {
  const db = createPilotDb()
  const prompts = [
    ['解释 PO-2026-1282 为什么优先', 'priority_explanation_query', 'PO-2026-1282'],
    ['SKU-00412 为什么风险高？', 'inventory_risk_query', 'SKU-00412'],
    ['RFQ-26-0046 需要怎么跟进？', 'rfq_followup_query', 'RFQ-26-0046'],
  ]

  for (const [query, intent, id] of prompts) {
    const first = buildAiEvidenceBundles(db, { query })
    const second = buildAiEvidenceBundles(db, { query })
    assert.deepEqual(first, second)
    assert.equal(first.intent, intent)
    assert.equal(first.primaryBundle.primaryEntity.id, id)
    assert.equal(JSON.stringify(first).includes('provider'), false)
  }
})

test('R110 readiness rejects internal labels and keeps review-first actions', () => {
  const context = buildAiRetrievalContext(createPilotDb(), { query: 'SKU-00412 为什么风险高？' })
  const draftPreview = context.allowedActions.find((action) => action.kind === 'draft_preview')

  assert.equal(draftPreview.requiresHumanReview, true)
  assert.equal(validateAiRetrievalOutput('inventory_item debug action-FOLLOWUP', context).valid, false)
})

test('R110 optional model surfaces remain no-op unless explicitly enabled', async () => {
  const state = getAiModelBoundaryState({})
  const adapter = createNoopAiModelAdapter()

  assert.equal(state.smallModelEnabled, false)
  assert.deepEqual(state.supportedOptionalModelUses, [])
  assert.equal((await adapter.wordAnswer({ fallbackAnswer: '确定性回答' })).usedModel, false)
})

