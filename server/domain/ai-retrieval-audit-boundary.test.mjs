import test from 'node:test'
import assert from 'node:assert/strict'
import {
  AI_MODEL_BOUNDARY,
  createAiRetrievalAuditEvent,
  createNoopAiModelAdapter,
  getAiModelBoundaryState,
} from './ai-retrieval-audit-boundary.mjs'

test('R107 audit event records retrieval usage without full chat content', () => {
  const event = createAiRetrievalAuditEvent('evidence_bundle_assembled', {
    query: '请把 PO-2026-1282 的全部上下文、聊天历史和长文本都解释一下',
    intent: 'priority_explanation_query',
    entity: { type: 'po', id: 'PO-2026-1282' },
    evidenceIds: ['PO-2026-1282', 'PR-2026-2401', 'RFQ-26-0046'],
  }, { now: new Date('2026-07-01T08:00:00.000Z') })

  assert.equal(event.source, 'ai_assisted')
  assert.equal(event.module, 'ai-retrieval')
  assert.equal(event.action, 'ai_tool_invoked')
  assert.deepEqual(event.entity, { type: 'po', id: 'PO-2026-1282' })
  assert.equal(event.metadata.aiRetrievalEventType, 'evidence_bundle_assembled')
  assert.equal(event.metadata.queryHash.length, 16)
  assert.equal(event.metadata.queryPreview.length <= 80, true)
  assert.equal(JSON.stringify(event).includes('全部上下文、聊天历史和长文本都解释一下'.repeat(2)), false)
})

test('R107 audit event covers evidence clicks and action decisions with compact metadata', () => {
  const shown = createAiRetrievalAuditEvent('recommended_action_shown', {
    entityType: 'sku',
    entityId: 'SKU-00412',
    actionKind: 'draft_preview',
    actionLabel: '预览 SKU-00412 补货 PR 草稿，需人工审阅后再保存。',
  })
  const accepted = createAiRetrievalAuditEvent('action_accepted', {
    entityType: 'sku',
    entityId: 'SKU-00412',
    actionKind: 'draft_preview',
    accepted: true,
  })

  assert.equal(shown.metadata.aiRetrievalEventType, 'recommended_action_shown')
  assert.equal(shown.metadata.actionKind, 'draft_preview')
  assert.equal(accepted.metadata.aiRetrievalEventType, 'action_accepted')
  assert.equal(accepted.metadata.accepted, true)
})

test('R108 model boundary documents deterministic ownership and disabled provider defaults', () => {
  assert.equal(AI_MODEL_BOUNDARY.providerDefault, 'disabled')
  assert.equal(AI_MODEL_BOUNDARY.vectorDatabase, 'disabled')
  assert.ok(AI_MODEL_BOUNDARY.deterministicResponsibilities.includes('entity_extraction'))
  assert.ok(AI_MODEL_BOUNDARY.modelMustNot.includes('override_immutable_facts'))

  const state = getAiModelBoundaryState({})
  assert.equal(state.smallModelEnabled, false)
  assert.equal(state.factOverrideAllowed, false)
  assert.equal(state.businessMutationAllowed, false)
  assert.deepEqual(state.supportedOptionalModelUses, [])
})

test('R108 no-op model adapter is the default boundary for rewrite rerank and wording', async () => {
  const adapter = createNoopAiModelAdapter()

  assert.equal(adapter.provider, 'none')
  assert.deepEqual(await adapter.rewriteQuery({ query: 'PO-2026-1282 为什么优先' }), {
    usedModel: false,
    query: 'PO-2026-1282 为什么优先',
    reason: 'model boundary disabled by default',
  })
  assert.deepEqual(await adapter.rerankEvidence({ evidence: [{ id: 'PO-2026-1282' }] }), {
    usedModel: false,
    evidence: [{ id: 'PO-2026-1282' }],
    reason: 'model boundary disabled by default',
  })
  assert.deepEqual(await adapter.wordAnswer({ fallbackAnswer: '请先查看证据。' }), {
    usedModel: false,
    answer: '请先查看证据。',
    reason: 'model boundary disabled by default',
  })
})

