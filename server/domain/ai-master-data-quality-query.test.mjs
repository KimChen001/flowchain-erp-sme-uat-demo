import test from 'node:test'
import assert from 'node:assert/strict'
import { handleAiRoute } from '../routes/ai.routes.mjs'
import {
  aiMasterDataQualityCapabilityCatalog,
  buildAiMasterDataQualityResponse,
  detectAiMasterDataQualityIntent,
  normalizeMasterDataQualityMessage,
} from './ai-master-data-quality-query.mjs'

function createDb(overrides = {}) {
  return {
    products: [
      {
        sku: 'A100',
        name: 'Motor A100',
        supplier: 'ABC Components',
        defaultTaxCode: 'TAX-STD',
        defaultWarehouseId: 'WH-A',
        leadTimeDays: 7,
      },
      {
        sku: 'B200',
        name: 'Bracket B200',
        supplier: 'Unlisted Supplier',
      },
      {
        sku: 'C300',
        name: 'Cap C300',
      },
    ],
    suppliers: [
      {
        id: 'SUP-001',
        name: 'ABC Components',
        score: 'A',
        paymentTermsId: 'NET30',
        defaultCurrency: 'USD',
      },
      {
        id: 'SUP-002',
        name: 'No Score Supplier',
      },
    ],
    warehouses: [{ id: 'WH-A', name: 'Main Warehouse' }],
    paymentTerms: [{ id: 'NET30', label: 'Net 30', days: 30 }],
    taxCodes: [],
    purchaseRequests: [],
    rfqs: [],
    purchaseOrders: [],
    receivingDocs: [],
    inventoryMovements: [],
    events: [],
    auditLog: [],
    ...overrides,
  }
}

function createRouteContext(body, db = createDb()) {
  let response = null
  let wrote = false
  return {
    ctx: {
      req: { method: 'POST', headers: {}, body },
      res: {},
      url: new URL('/api/ai/chat', 'http://localhost'),
      db,
      readBody: async (req) => req.body,
      writeDb: async () => { wrote = true },
      event: () => {},
      ensureRfqs: (database) => Array.isArray(database.rfqs) ? database.rfqs : [],
      ensurePurchaseRequests: (database) => Array.isArray(database.purchaseRequests) ? database.purchaseRequests : [],
      ensureInventoryMovements: (database) => Array.isArray(database.inventoryMovements) ? database.inventoryMovements : [],
      ensureEvents: (database) => Array.isArray(database.events) ? database.events : [],
      ensureAuditLog: (database) => Array.isArray(database.auditLog) ? database.auditLog : [],
      supplierPerformance: (database) => database.suppliers || [],
      supplierRecommendations: () => null,
      supplierQuoteCount: 1,
      openaiDispatcher: { dispatch() { throw new Error('external provider should not be used') } },
      arkDispatcher: { dispatch() { throw new Error('external provider should not be used') } },
      aiMaxTokens: 120,
      repositories: {},
      send(_res, status, payload) {
        response = { status, payload }
      },
    },
    get response() {
      return response
    },
    get wrote() {
      return wrote
    },
  }
}

function businessSnapshot(db) {
  return structuredClone({
    products: db.products,
    suppliers: db.suppliers,
    warehouses: db.warehouses,
    paymentTerms: db.paymentTerms,
    taxCodes: db.taxCodes,
  })
}

test('master data quality catalog documents read-only capabilities', () => {
  assert.deepEqual(aiMasterDataQualityCapabilityCatalog.map((item) => item.intent), [
    'master_data_quality_query',
    'master_data_missing_defaults_query',
    'master_data_next_actions_query',
  ])
  assert.ok(aiMasterDataQualityCapabilityCatalog.every((item) => item.mode === 'read'))
})

test('master data quality query normalizes payload fields and detects scoped intents', () => {
  assert.equal(normalizeMasterDataQualityMessage({ message: '检查主数据质量' }), '检查主数据质量')
  assert.equal(normalizeMasterDataQualityMessage({ prompt: '缺少哪些默认字段？' }), '缺少哪些默认字段？')
  assert.equal(detectAiMasterDataQualityIntent('检查主数据质量', { moduleId: 'master-data' }), 'master_data_quality_query')
  assert.equal(detectAiMasterDataQualityIntent('缺少哪些默认字段？', { moduleId: 'master_data' }), 'master_data_missing_defaults_query')
  assert.equal(detectAiMasterDataQualityIntent('下一步建议', { moduleId: 'master-data' }), 'master_data_next_actions_query')
  assert.equal(detectAiMasterDataQualityIntent('下一步建议', { moduleId: 'procurement' }), null)
})

test('master data quality response is deterministic, localized, and boundary-only', () => {
  const response = buildAiMasterDataQualityResponse(createDb(), { moduleId: 'master-data', question: '检查主数据质量' })

  assert.equal(response.provider, 'local_master_data_quality_query')
  assert.equal(response.mode, 'read')
  assert.equal(response.intent.name, 'master_data_quality_query')
  assert.match(response.content, /主数据|质量信号/)
  assert.match(response.content, /不创建或修改主数据|不执行导入|不审批启停|不自动修复默认值/)
  assert.ok(response.cards.some((card) => card.type === 'master_data_quality_summary'))
  assert.ok(response.cards.some((card) => card.type === 'master_data_missing_fields_summary'))
  assert.ok(response.cards.some((card) => card.type === 'master_data_next_actions'))
  assert.ok(response.cards.some((card) => card.type === 'master_data_boundary_notice'))
})

test('master data visible prompts do not use provider and do not mutate business data', async () => {
  const cases = [
    ['检查主数据质量', 'master_data_quality_query', 'master_data_quality_summary'],
    ['缺少哪些默认字段？', 'master_data_missing_defaults_query', 'master_data_missing_fields_summary'],
    ['下一步建议', 'master_data_next_actions_query', 'master_data_next_actions'],
  ]

  for (const [question, intentName, cardType] of cases) {
    const db = createDb()
    const before = businessSnapshot(db)
    const route = createRouteContext({ moduleId: 'master-data', question }, db)
    await handleAiRoute(route.ctx)

    assert.equal(route.response.status, 200, question)
    assert.equal(route.response.payload.provider, 'local_master_data_quality_query', question)
    assert.equal(route.response.payload.intent.name, intentName, question)
    assert.equal(route.response.payload.mode, 'read', question)
    assert.equal(route.response.payload.usedWeb, false, question)
    assert.equal(route.response.payload.externalMs, 0, question)
    assert.equal(route.response.payload.fastPath, 'pre_read_context', question)
    assert.ok(route.response.payload.cards.some((card) => card.type === cardType), question)
    assert.match(route.response.payload.content, /不创建或修改主数据|不执行导入|不审批启停|不自动修复默认值/, question)
    assert.equal(route.wrote, false, question)
    assert.deepEqual(businessSnapshot(db), before, question)
  }
})
