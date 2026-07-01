import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildAiEvidenceReuseResponse } from './ai-evidence-reuse.mjs'

function createPilotDb() {
  return {
    purchaseRequests: [
      { pr: 'PR-2026-2401', sourceSku: 'SKU-00412', sourceName: '伺服电机 750W', supplier: '深圳新元电气', requester: '张磊', buyer: '王志强', requiredDate: '2026-06-20', quantity: 20, amount: 42000, currency: 'CNY', status: '待审批' },
    ],
    rfqs: [
      { id: 'RFQ-26-0046', title: '高精度数控刀具', suppliers: 3, quoted: 1, due: '2026-06-22', status: '进行中', bestSupplier: '苏州刀具科技' },
    ],
    purchaseOrders: [
      { po: 'PO-2026-1282', supplier: '深圳新元电气', eta: '2026-05-25', owner: '王志强', amount: 82000, currency: 'CNY', items: 50, received: 20, status: '部分到货', sourceRequest: 'PR-2026-2401' },
      { po: 'PO-2026-1284', supplier: '华东精工机械', eta: '2026-05-29', owner: '李娜', amount: 60900, currency: 'CNY', items: 12, received: 3, status: '部分到货' },
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
    suppliers: [],
    forecastPlans: [],
    marketPrices: [],
    marketSignals: [],
    events: [],
    auditLog: [],
  }
}

function visibleAiText(payload) {
  const parts = [payload.content, payload.message]
  for (const card of payload.cards || []) {
    parts.push(card.title)
    for (const issue of card.data?.topIssues || []) parts.push(issue.title, issue.reason)
    for (const evidence of card.evidence || []) parts.push(evidence.label, evidence.summary, evidence.status)
    for (const action of card.actions || []) parts.push(action.label)
  }
  for (const evidence of payload.evidence || []) parts.push(evidence.label, evidence.summary, evidence.status)
  return parts.filter(Boolean).join('\n')
}

test('R91 today priority output hides internal keys and keeps deterministic counts coherent', () => {
  const response = buildAiEvidenceReuseResponse(createPilotDb(), { moduleId: 'overview', message: '今天最需要处理什么？' }, { cache: {} })
  const visible = visibleAiText(response)
  const summary = response.cards.find((card) => card.type === 'procurement_followup_summary')

  assert.equal(response.intent.name, 'today_cockpit_priority_query')
  assert.match(response.content, /下方展示其中优先级最高的/)
  assert.ok(summary.data.overduePoCount > 0)
  assert.match(visible, /采购单 PO-2026-1282 已超过预计到货日/)
  assert.match(visible, /SKU-00412.*库存/)
  assert.match(visible, /询价单 RFQ-26-0046/)
  assert.doesNotMatch(visible, /action-FOLLOWUP|overdue_po|inventory_item|supplier_boundary_notice|master_data_boundary_notice|tool_result|response_card|repository|debug|evidence\s*·/i)
})

test('R91 suggested actions are object-linked business actions', () => {
  const response = buildAiEvidenceReuseResponse(createPilotDb(), { message: '今天最需要处理什么？' }, { cache: {} })
  const actions = response.cards.find((card) => card.type === 'recommended_actions').actions.map((item) => item.label)

  assert.ok(actions.some((label) => /打开 PO-2026-1282，查看未到货明细/.test(label)))
  assert.ok(actions.some((label) => /查看 SKU-00412 的库存覆盖/.test(label)))
  assert.ok(actions.some((label) => /打开 RFQ-26-0046，确认待回复供应商/.test(label)))
  assert.equal(actions.some((label) => /打开采购单据并确认责任人|复核证据|action-/.test(label)), false)
})

test('R91 AI evidence UI renders business labels instead of entity type keys', () => {
  const source = readFileSync(new URL('../../src/modules/ai-assistant/Panel.tsx', import.meta.url), 'utf8')

  assert.match(source, /const title = `依据：\$\{label\}`/)
  assert.match(source, /raw\.summary/)
  assert.doesNotMatch(source, /link\.entityType[^\\n]+link\.entityId/)
})
