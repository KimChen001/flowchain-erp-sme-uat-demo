import test from 'node:test'
import assert from 'node:assert/strict'
import { handleAiRoute } from '../routes/ai.routes.mjs'

function createDb() {
  return {
    products: [
      { sku: 'A100', name: 'Motor A100', unit: 'pcs', supplier: 'ABC Components', moq: 100, availableQuantity: 24 },
    ],
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

function createRouteContext(body, {
  db = createDb(),
  writeDb = async () => {},
  event = (database, type, message, ref) => {
    database.events = [...(database.events || []), { type, message, ref }]
  },
  openaiDispatcher = { dispatch() { throw new Error('provider should not be reached') } },
  arkDispatcher = { dispatch() { throw new Error('ark should not be reached') } },
} = {}) {
  let response = null
  return {
    ctx: {
      req: { method: 'POST', body, headers: { authorization: 'Bearer user-token' } },
      res: {},
      url: new URL('/api/ai/chat', 'http://localhost'),
      db,
      send(_res, status, payload) {
        response = { status, payload }
      },
      readBody: async (req) => req.body,
      writeDb,
      event,
      ensurePurchaseRequests: (nextDb) => nextDb.purchaseRequests || [],
      ensureInventoryMovements: (nextDb) => nextDb.inventoryMovements || [],
      ensureRfqs: (nextDb) => nextDb.rfqs || [],
      ensureEvents: (nextDb) => nextDb.events || [],
      ensureAuditLog: (nextDb) => nextDb.auditLog || [],
      supplierPerformance: () => [],
      supplierRecommendations: () => null,
      supplierQuoteCount: 0,
      openaiDispatcher,
      arkDispatcher,
      aiMaxTokens: 120,
    },
    get response() {
      return response
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

test('read-only AI answer returns 200 when audit persistence fails', async () => {
  const route = createRouteContext(
    { message: 'supplier SUP-001 status' },
    { writeDb: async () => { throw new Error('disk write failed with internal path C:/secret/db.json') } },
  )

  await handleAiRoute(route.ctx)

  assert.equal(route.response.status, 200)
  assert.equal(route.response.payload.intent.name, 'supplier_status_query')
  assert.ok(route.response.payload.cards.length > 0)
  assert.equal(JSON.stringify(route.response.payload).includes('secret'), false)
})

test('draft preparation response survives audit persistence failure', async () => {
  const route = createRouteContext(
    { message: 'prepare PR draft for A100 qty 120' },
    { writeDb: async () => { throw new Error('audit unavailable') } },
  )

  await handleAiRoute(route.ctx)

  assert.equal(route.response.status, 200)
  assert.equal(route.response.payload.intent.name, 'prepare_purchase_request_draft')
  assert.ok(route.response.payload.cards.some((card) => card.type === 'pr_draft'))
  assert.equal(JSON.stringify(route.response.payload).includes('audit unavailable'), false)
})

test('guided fallback is still safe when audit write fails', async () => {
  await withEnv({
    AI_PROVIDER_ENABLED: undefined,
    OPENAI_API_KEY: 'fake-openai-key',
  }, async () => {
    const route = createRouteContext(
      { message: 'write a poetic sourcing manifesto' },
      { writeDb: async () => { throw new Error('audit storage unavailable') } },
    )

    await handleAiRoute(route.ctx)

    assert.equal(route.response.status, 200)
    assert.equal(route.response.payload.providerStatus, 'deterministic')
    assert.equal(route.response.payload.intent.name, 'unknown_guided_fallback')
    assert.equal(route.response.payload.status, 'guided_fallback')
    assert.equal(JSON.stringify(route.response.payload).includes('fake-openai-key'), false)
    assert.equal(JSON.stringify(route.response.payload).includes('audit storage unavailable'), false)
  })
})

test('configured provider failure returns sanitized degraded local fallback', async () => {
  await withEnv({
    AI_PROVIDER_ENABLED: 'true',
    AI_PROVIDER: 'openai',
    OPENAI_API_KEY: 'sk-fake-raw-secret',
  }, async () => {
    const route = createRouteContext(
      { message: 'write a poetic sourcing manifesto' },
      {
        openaiDispatcher: {
          dispatch() {
            throw new Error('OpenAI API error 500: sk-fake-raw-secret https://api.openai.com/v1/responses raw body')
          },
        },
      },
    )

    await handleAiRoute(route.ctx)

    assert.equal(route.response.status, 200)
    assert.equal(route.response.payload.degraded, true)
    assert.equal(route.response.payload.providerStatus, 'degraded')
    assert.equal(route.response.payload.errorCode, 'provider_unavailable')
    assert.equal(route.response.payload.error, undefined)
    assert.match(route.response.payload.content, /采购订单/)
    const serialized = JSON.stringify(route.response.payload)
    assert.equal(serialized.includes('sk-fake-raw-secret'), false)
    assert.equal(serialized.includes('api.openai.com'), false)
    assert.equal(serialized.includes('raw body'), false)
  })
})
