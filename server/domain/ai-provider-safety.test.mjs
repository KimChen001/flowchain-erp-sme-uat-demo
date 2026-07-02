import test from 'node:test'
import assert from 'node:assert/strict'
import { handleAiRoute } from '../routes/ai.routes.mjs'
import { getAiProviderSafetyState, isAiProviderEnabled } from './ai-provider-safety.mjs'

function createDb() {
  return {
    products: [{ sku: 'A100', name: 'Motor A100', moq: 100, availableQuantity: 24 }],
    suppliers: [{ id: 'SUP-001', name: 'ABC Components', risk: '中', onTimeRate: 90, qualityRate: 96 }],
    purchaseOrders: [{ po: 'PO-1001', supplier: 'ABC Components', status: '已发出', eta: '2026-07-10' }],
    purchaseRequests: [{ pr: 'PR-1001', status: '待审批', sourceSku: 'A100', amount: 12000 }],
    rfqs: [{ id: 'RFQ-1001', status: '进行中', suppliers: 3, quoted: 1 }],
    receivingDocs: [],
    inventoryMovements: [],
    forecastPlans: [],
    marketPrices: [],
    marketSignals: [],
    events: [],
    auditLog: [],
  }
}

function createRouteContext(body, db = createDb()) {
  let response = null
  let wrote = false
  return {
    ctx: {
      req: { method: 'POST', body, headers: {} },
      res: {},
      url: new URL('/api/ai/chat', 'http://localhost'),
      db,
      send(_res, status, payload) {
        response = { status, payload }
      },
      readBody: async (req) => req.body,
      writeDb: async () => { wrote = true },
      event: () => {},
      ensurePurchaseRequests: (nextDb) => nextDb.purchaseRequests || [],
      ensureInventoryMovements: (nextDb) => nextDb.inventoryMovements || [],
      ensureRfqs: (nextDb) => nextDb.rfqs || [],
      ensureEvents: (nextDb) => nextDb.events || [],
      ensureAuditLog: (nextDb) => nextDb.auditLog || [],
      supplierPerformance: () => [],
      supplierRecommendations: () => null,
      supplierQuoteCount: 0,
      openaiDispatcher: { dispatch() { throw new Error('OpenAI dispatcher should not be reached') } },
      arkDispatcher: { dispatch() { throw new Error('Ark dispatcher should not be reached') } },
      aiMaxTokens: 120,
    },
    get response() {
      return response
    },
    get wrote() {
      return wrote
    },
  }
}

function withEnv(patch, fn) {
  const keys = Object.keys(patch)
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const key of keys) {
        if (previous[key] === undefined) delete process.env[key]
        else process.env[key] = previous[key]
      }
    })
}

test('AI provider safety gate enables only exact true', () => {
  assert.equal(isAiProviderEnabled({}), false)
  assert.equal(isAiProviderEnabled({ AI_PROVIDER_ENABLED: 'false' }), false)
  assert.equal(isAiProviderEnabled({ AI_PROVIDER_ENABLED: 'FALSE' }), false)
  assert.equal(isAiProviderEnabled({ AI_PROVIDER_ENABLED: '1' }), false)
  assert.equal(isAiProviderEnabled({ AI_PROVIDER_ENABLED: 'yes' }), false)
  assert.equal(isAiProviderEnabled({ AI_PROVIDER_ENABLED: 'true' }), true)
})

test('AI provider safety state does not expose credentials', () => {
  const state = getAiProviderSafetyState({ OPENAI_API_KEY: 'fake-openai-key' })
  assert.equal(state.enabled, false)
  assert.match(state.reason, /disabled by default/)
  assert.equal(JSON.stringify(state).includes('fake-openai-key'), false)
})

test('API keys alone do not enable unmatched provider fallback', async () => {
  await withEnv({
    AI_PROVIDER_ENABLED: undefined,
    OPENAI_API_KEY: 'fake-openai-key',
    ARK_API_KEY: 'fake-ark-key',
    DOUBAO_API_KEY: 'fake-doubao-key',
  }, async () => {
    const route = createRouteContext({ message: 'write a poetic sourcing manifesto' })
    await handleAiRoute(route.ctx)

    assert.equal(route.response.status, 200)
    assert.equal(route.response.payload.status, 'guided_fallback')
    assert.equal(route.response.payload.intent.name, 'unknown_guided_fallback')
    assert.equal(route.response.payload.providerStatus, 'deterministic')
    assert.ok(route.response.payload.cards.some((card) => card.type === 'guided_fallback'))
    assert.deepEqual(route.response.payload.evidence, [])
    assert.equal(JSON.stringify(route.response.payload).includes('fake-openai-key'), false)
    assert.equal(JSON.stringify(route.response.payload).includes('fake-ark-key'), false)
    assert.equal(JSON.stringify(route.response.payload).includes('fake-doubao-key'), false)
    assert.equal(route.wrote, false)
  })
})

test('provider disabled gate does not block deterministic AI handlers', async () => {
  await withEnv({
    AI_PROVIDER_ENABLED: undefined,
    OPENAI_API_KEY: 'fake-openai-key',
  }, async () => {
    const route = createRouteContext({ message: 'supplier SUP-001 status' })
    const handled = await handleAiRoute(route.ctx)

    assert.equal(handled, true)
    assert.equal(route.response.status, 200)
    assert.equal(route.response.payload.intent.name, 'supplier_status_query')
    assert.ok(route.response.payload.cards.length > 0)
    assert.notEqual(route.response.payload.status, 'blocked')
  })
})

test('explicit enable flag allows provider-eligible fallback without adding keys', async () => {
  await withEnv({
    AI_PROVIDER_ENABLED: 'true',
    OPENAI_API_KEY: undefined,
    ARK_API_KEY: undefined,
    DOUBAO_API_KEY: undefined,
  }, async () => {
    const route = createRouteContext({ message: 'write a poetic sourcing manifesto' })
    await handleAiRoute(route.ctx)

    assert.equal(route.response.status, 200)
    assert.notEqual(route.response.payload.status, 'blocked')
    assert.notEqual(route.response.payload.intent?.name, 'provider_disabled')
    assert.equal(route.response.payload.provider, 'local')
    assert.match(route.response.payload.content, /采购订单/)
  })
})
