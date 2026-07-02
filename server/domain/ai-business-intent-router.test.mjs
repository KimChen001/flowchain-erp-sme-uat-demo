import test from 'node:test'
import assert from 'node:assert/strict'
import {
  AI_BUSINESS_INTENT_TAXONOMY,
  buildUnknownGuidedFallbackResponse,
  classifyAiBusinessIntent,
  isBroadAttentionPrompt,
  normalizeAiIntentName,
} from './ai-business-intent-router.mjs'

test('R131 AI business intent taxonomy normalizes compatible aliases', () => {
  assert.equal(normalizeAiIntentName('today_priority_query'), 'today_cockpit_priority_query')
  assert.equal(normalizeAiIntentName('procurement_risk_query'), 'procurement_exception_query')
  assert.equal(normalizeAiIntentName('prepare_purchase_request_draft'), 'draft_preview_query')
  assert.equal(AI_BUSINESS_INTENT_TAXONOMY.unknownGuidedFallback, 'unknown_guided_fallback')
})

test('R131 intent router returns deterministic metadata and explicit priority ordering', () => {
  const explicit = classifyAiBusinessIntent({ question: 'PO-2026-1282 为什么优先？' })
  assert.equal(explicit.intent, 'priority_explanation_query')
  assert.equal(explicit.modelPolicy, 'deterministic_only')
  assert.equal(explicit.routeReason, 'explicit_business_entity_priority')
  assert.ok(explicit.entities.some((item) => item.type === 'po' && item.id === 'PO-2026-1282'))

  const grounded = classifyAiBusinessIntent({
    question: '它和哪个 SKU 有关系？',
    sessionGrounding: { lastPrimaryEntity: { type: 'po', id: 'PO-2026-1282' } },
  })
  assert.equal(grounded.intent, 'relationship_reasoning_query')
  assert.equal(grounded.routeReason, 'session_grounded_entity')

  const broad = classifyAiBusinessIntent({ question: '有什么需要我注意的？' })
  assert.equal(broad.intent, 'attention_overview_query')
  assert.equal(broad.modelPolicy, 'deterministic_only')
  assert.equal(broad.routeReason, 'broad_attention_overview')
})

test('R132 broad attention detection is semantic and not a one-phrase prompt library', () => {
  for (const message of [
    '有什么需要我注意的？',
    '我现在要看什么？',
    '当前有什么问题？',
    '有什么风险？',
    '有没有什么异常？',
    '有什么需要跟进？',
    '当前情况怎么样？',
  ]) {
    assert.equal(isBroadAttentionPrompt(message), true, message)
    assert.equal(classifyAiBusinessIntent({ question: message }).intent, 'attention_overview_query', message)
  }
})

test('R133 guided fallback response is business-facing and model-free', () => {
  const classification = classifyAiBusinessIntent({ question: '写一首采购宣言' })
  const response = buildUnknownGuidedFallbackResponse({ question: '写一首采购宣言' }, classification)
  const serialized = JSON.stringify(response)

  assert.equal(response.intent.name, 'unknown_guided_fallback')
  assert.equal(response.providerStatus, 'deterministic')
  assert.equal(response.status, 'guided_fallback')
  assert.equal(response.usedWeb, false)
  assert.match(serialized, /今日优先事项/)
  assert.match(serialized, /库存风险/)
  assert.match(serialized, /供应商跟进/)
  assert.doesNotMatch(serialized, /外部 AI Provider|未启用外部|provider_disabled|debug|api key/i)
})
