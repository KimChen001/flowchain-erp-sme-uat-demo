import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_AI_PROVIDER,
  SUPPORTED_AI_PROVIDERS,
  buildIntentExtractionRequest,
  getAiProviderConfig,
  isExternalAiProvider,
  normalizeAiProviderName,
  validateIntentExtractionResult,
} from './ai-provider-adapter.mjs'

const allowedIntents = [
  'supplier_status_query',
  'po_status_query',
  'prepare_purchase_request_draft',
  'unsupported',
]

test('AI provider adapter defaults to local provider', () => {
  assert.equal(DEFAULT_AI_PROVIDER, 'local')
  assert.ok(SUPPORTED_AI_PROVIDERS.includes('local'))
  assert.deepEqual(getAiProviderConfig({}), {
    provider: 'local',
    mode: 'local',
    intentExtractionEnabled: false,
    answerComposerEnabled: false,
  })
})

test('unknown provider falls back to local', () => {
  assert.equal(normalizeAiProviderName('unknown'), 'local')
  assert.equal(getAiProviderConfig({ AI_PROVIDER: 'unknown' }).provider, 'local')
})

test('external providers normalize correctly', () => {
  assert.equal(normalizeAiProviderName('OpenAI'), 'openai')
  assert.equal(normalizeAiProviderName(' doubao '), 'doubao')
  assert.equal(normalizeAiProviderName('DEEPSEEK'), 'deepseek')
  assert.equal(isExternalAiProvider('openai'), true)
  assert.equal(isExternalAiProvider('local'), false)
})

test('external provider intent extraction remains disabled unless flag is true', () => {
  assert.deepEqual(getAiProviderConfig({ AI_PROVIDER: 'openai' }), {
    provider: 'openai',
    mode: 'external',
    intentExtractionEnabled: false,
    answerComposerEnabled: false,
  })
  assert.equal(getAiProviderConfig({
    AI_PROVIDER: 'deepseek',
    AI_INTENT_EXTRACTION_ENABLED: 'true',
  }).intentExtractionEnabled, true)
  assert.equal(getAiProviderConfig({
    AI_PROVIDER: 'local',
    AI_INTENT_EXTRACTION_ENABLED: 'true',
  }).intentExtractionEnabled, false)
})

test('buildIntentExtractionRequest keeps only safe local request fields', () => {
  const request = buildIntentExtractionRequest({
    message: '  PO-1001 status ',
    moduleId: ' procurement ',
    activeContext: {
      module: 'procurement',
      entityType: 'purchase_request',
      entityId: 'PR-1001',
      entityLabel: 'PR-1001',
      extra: 'ignored',
    },
    availableIntents: ['po_status_query', '', null],
  })

  assert.equal(request.message, 'PO-1001 status')
  assert.equal(request.moduleId, 'procurement')
  assert.deepEqual(request.availableIntents, ['po_status_query'])
  assert.deepEqual(Object.keys(request.activeContext), ['module', 'entityType', 'entityId', 'entityLabel', 'view', 'route'])
})

test('allowed intent validates with object slots', () => {
  const result = validateIntentExtractionResult({
    intent: 'po_status_query',
    slots: { poId: 'PO-1001' },
    confidence: 0.86,
  }, allowedIntents)

  assert.deepEqual(result, {
    intent: 'po_status_query',
    slots: { poId: 'PO-1001' },
    confidence: 0.86,
    supported: true,
  })
})

test('unknown intent becomes unsupported', () => {
  const result = validateIntentExtractionResult({
    intent: 'approve_purchase_request',
    slots: { prId: 'PR-1001' },
    confidence: 0.99,
  }, allowedIntents)

  assert.equal(result.intent, 'unsupported')
  assert.deepEqual(result.slots, { prId: 'PR-1001' })
  assert.equal(result.confidence, 0)
  assert.equal(result.supported, false)
})

test('invalid slots become empty object and confidence is clamped', () => {
  const high = validateIntentExtractionResult({
    intent: 'supplier_status_query',
    slots: ['bad'],
    confidence: 1.8,
  }, allowedIntents)
  const invalid = validateIntentExtractionResult({
    intent: 'supplier_status_query',
    slots: null,
    confidence: 'not-a-number',
  }, allowedIntents)

  assert.deepEqual(high.slots, {})
  assert.equal(high.confidence, 1)
  assert.deepEqual(invalid.slots, {})
  assert.equal(invalid.confidence, 0)
})

test('adapter module exposes no network call surface', () => {
  assert.equal(typeof globalThis.fetch, 'function')
  assert.equal(Object.keys({
    buildIntentExtractionRequest,
    validateIntentExtractionResult,
    getAiProviderConfig,
  }).includes('fetch'), false)
})
