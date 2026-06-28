import test from 'node:test'
import assert from 'node:assert/strict'
import {
  activeContextEntity,
  messageUsesContextReference,
  normalizeAiActiveContext,
  resolveContextualEntityId,
} from './ai-active-context.mjs'

test('AI active context normalizes canonical payload fields', () => {
  assert.deepEqual(normalizeAiActiveContext({
    activeContext: {
      module: 'procurement',
      entityType: 'rfq',
      entityId: 'RFQ-1001',
      entityLabel: 'A100 motor RFQ',
      view: 'rfqs',
      route: '/procurement?view=rfqs',
    },
  }), {
    module: 'procurement',
    entityType: 'rfq',
    entityId: 'RFQ-1001',
    entityLabel: 'A100 motor RFQ',
    view: 'rfqs',
    route: '/procurement?view=rfqs',
  })
})

test('AI active context supports compatible alias keys', () => {
  assert.equal(normalizeAiActiveContext({ activeEntity: { type: 'vendor', id: 'SUP-001' } }).entityType, 'supplier')
  assert.equal(normalizeAiActiveContext({ context: { kind: 'material', id: 'ITEM-A100' } }).entityType, 'item')
  assert.equal(normalizeAiActiveContext({ currentContext: { entityType: 'purchase requisition', entityId: 'PR-1001' } }).entityType, 'purchase_request')
})

test('AI active context detects contextual entity phrases', () => {
  assert.ok(messageUsesContextReference('这个 RFQ 现在什么状态？', 'rfq'))
  assert.ok(messageUsesContextReference('这个供应商最近怎么样？', 'supplier'))
  assert.ok(messageUsesContextReference('这个 item 库存够不够？', 'item'))
  assert.ok(messageUsesContextReference('这个 PR 到哪一步了？', 'purchase_request'))
})

test('AI active context rejects incompatible entity types', () => {
  const body = { activeContext: { entityType: 'rfq', entityId: 'RFQ-1001' } }

  assert.equal(activeContextEntity(body, 'supplier'), null)
  assert.deepEqual(resolveContextualEntityId(body, '这个供应商最近怎么样？', 'supplier'), {
    entityId: '',
    source: 'missing',
    context: null,
  })
})

test('AI active context keeps explicit message ids ahead of context ids', () => {
  const result = resolveContextualEntityId(
    { activeContext: { entityType: 'rfq', entityId: 'RFQ-1001' } },
    'RFQ-1002 status',
    'rfq',
    'RFQ-1002',
  )

  assert.equal(result.entityId, 'RFQ-1002')
  assert.equal(result.source, 'explicit_message')
  assert.equal(result.context, null)
})
