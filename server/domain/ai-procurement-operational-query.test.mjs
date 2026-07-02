import test from 'node:test'
import assert from 'node:assert/strict'
import { handleAiRoute } from '../routes/ai.routes.mjs'
import {
  aiProcurementOperationalCapabilityCatalog,
  buildAiProcurementOperationalResponse,
  detectAiProcurementOperationalIntent,
  normalizeProcurementOperationalMessage,
} from './ai-procurement-operational-query.mjs'

function createDb(overrides = {}) {
  return {
    products: [{ sku: 'A100', name: 'Motor A100' }],
    suppliers: [{ id: 'SUP-001', name: 'ABC Components' }],
    rfqs: [
      { id: 'RFQ-1001', status: '进行中', suppliers: 3, quoted: 1, sourceRequest: 'PR-1001' },
    ],
    purchaseRequests: [
      {
        pr: 'PR-1001',
        status: '已批准',
        requester: 'Kim Chen',
        buyer: 'Buyer A',
        supplier: 'ABC Components',
        sourceSku: 'A100',
        sourceName: 'Motor A100',
        quantity: 300,
        requiredDate: '2026-07-03',
        priority: '高',
        amount: 12000,
      },
      {
        pr: 'PR-1002',
        status: '待审批',
        requester: 'Alex Buyer',
        buyer: 'Buyer B',
        supplier: 'Beta Metals',
        sourceSku: 'B200',
        quantity: 80,
        requiredDate: '2026-07-05',
        priority: '中',
      },
      {
        pr: 'PR-1003',
        status: '已转PO',
        linkedPo: 'PO-1003',
        sourceSku: 'C300',
      },
    ],
    purchaseOrders: [
      {
        po: 'PO-1001',
        supplier: 'ABC Components',
        sourceRequest: 'PR-1001',
        eta: '2026-06-20',
        status: '部分到货',
        items: 300,
        received: 200,
        priority: '高',
      },
      {
        po: 'PO-1002',
        supplier: 'Beta Metals',
        eta: '2026-07-02',
        status: '已发出',
        items: 100,
        received: 0,
        priority: '中',
      },
      {
        po: 'PO-DONE',
        supplier: 'Closed Supplier',
        eta: '2026-06-01',
        status: '已完成',
        items: 20,
        received: 20,
      },
    ],
    receivingDocs: [
      {
        grn: 'GRN-1001',
        po: 'PO-1001',
        supplier: 'ABC Components',
        items: 300,
        passed: 200,
        failed: 0,
        status: '质检中',
      },
      {
        grn: 'GRN-1002',
        po: 'PO-1002',
        supplier: 'Beta Metals',
        items: 100,
        passed: 70,
        failed: 2,
        status: '异常处理',
      },
    ],
    inventoryMovements: [],
    ...overrides,
  }
}

function createRouteContext(body, db = createDb(), helpers = {}) {
  let response = null
  return {
    ctx: {
      req: { method: 'POST', headers: {}, body },
      res: {},
      url: new URL('/api/ai/chat', 'http://localhost'),
      db,
      readBody: async (req) => req.body,
      writeDb: async () => {},
      event(database, type, message, ref) {
        database.events = [{ type, message, ref }]
      },
      ensureRfqs(database) {
        return Array.isArray(database.rfqs) ? database.rfqs : []
      },
      ensurePurchaseRequests(database) {
        return Array.isArray(database.purchaseRequests) ? database.purchaseRequests : []
      },
      ensureInventoryMovements(database) {
        return Array.isArray(database.inventoryMovements) ? database.inventoryMovements : []
      },
      ...helpers,
      send(_res, status, payload) {
        response = { status, payload }
      },
    },
    get response() {
      return response
    },
  }
}

function businessSnapshot(db) {
  return structuredClone({
    rfqs: db.rfqs,
    purchaseRequests: db.purchaseRequests,
    purchaseOrders: db.purchaseOrders,
    receivingDocs: db.receivingDocs,
    inventoryMovements: db.inventoryMovements,
  })
}

function failingReadContextRepositories() {
  const fail = async () => {
    throw new Error('buildAiReadContext should not run for deterministic procurement UAT prompts')
  }
  return {
    procurementRead: { listDocuments: fail, listFollowups: fail, getSummary: fail },
    inventoryRead: { listItems: fail, listExceptions: fail, getSummary: fail },
    masterData: { listItems: fail, listSuppliers: fail },
  }
}

test('procurement operational catalog documents read-only capabilities', () => {
  assert.deepEqual(
    aiProcurementOperationalCapabilityCatalog.map((item) => item.intent),
    [
      'pr_status_query',
      'pr_conversion_status_query',
      'po_status_query',
      'po_overdue_query',
      'receiving_status_query',
      'receiving_exception_query',
      'procurement_followup_summary_query',
    ],
  )
  assert.ok(aiProcurementOperationalCapabilityCatalog.every((item) => item.mode === 'read'))
})

test('procurement operational query normalizes compatible payload fields', () => {
  assert.equal(normalizeProcurementOperationalMessage({ message: 'PR-1001 status' }), 'PR-1001 status')
  assert.equal(normalizeProcurementOperationalMessage({ prompt: 'PO-1001 status' }), 'PO-1001 status')
  assert.equal(normalizeProcurementOperationalMessage({ question: 'GRN-1001 status' }), 'GRN-1001 status')
  assert.equal(normalizeProcurementOperationalMessage({ text: '哪些收货有异常？' }), '哪些收货有异常？')
})

test('procurement operational intent detection keeps draft and RFQ prompts out', () => {
  assert.equal(detectAiProcurementOperationalIntent('PR-1001 status'), 'pr_status_query')
  assert.equal(detectAiProcurementOperationalIntent('这个 PR 为什么还没转 PO？', {
    activeContext: { entityType: 'purchase_request', entityId: 'PR-1001' },
  }), 'pr_conversion_status_query')
  assert.equal(detectAiProcurementOperationalIntent('PO-1001 receiving status'), 'receiving_status_query')
  assert.equal(detectAiProcurementOperationalIntent('哪些收货有异常？'), 'receiving_exception_query')
  assert.equal(detectAiProcurementOperationalIntent('Create RFQ for A100 qty 1000'), null)
  assert.equal(detectAiProcurementOperationalIntent('RFQ pending'), null)
})

test('Chinese helper phrases still resolve read-only procurement operational intents', () => {
  assert.equal(detectAiProcurementOperationalIntent('帮我看看采购有什么要跟？'), 'procurement_followup_summary_query')
  assert.equal(detectAiProcurementOperationalIntent('帮我看一下哪些 PO 快逾期了？'), 'po_overdue_query')
  assert.equal(detectAiProcurementOperationalIntent('帮我查一下 PR-1001 到哪一步了？'), 'pr_status_query')
  assert.equal(detectAiProcurementOperationalIntent('帮我看看这个 PR 为什么还没转 PO？', {
    activeContext: { entityType: 'purchase_request', entityId: 'PR-1001' },
  }), 'pr_conversion_status_query')
  assert.equal(detectAiProcurementOperationalIntent('帮我看看哪些收货有异常？'), 'receiving_exception_query')
  assert.equal(detectAiProcurementOperationalIntent('帮我查 PO-1001 收货怎么样？'), 'receiving_status_query')
})

test('explicit PR id returns pr_status_query and does not mutate data', async () => {
  const db = createDb()
  const before = businessSnapshot(db)
  const route = createRouteContext({ message: 'PR-1001 status' }, db)
  const handled = await handleAiRoute(route.ctx)

  assert.ok(handled)
  assert.equal(route.response.status, 200)
  assert.equal(route.response.payload.provider, 'local_procurement_operational_query')
  assert.equal(route.response.payload.intent.name, 'pr_status_query')
  assert.equal(route.response.payload.cards[0].type, 'pr_status')
  assert.equal(route.response.payload.cards[0].data.prId, 'PR-1001')
  assert.equal(route.response.payload.cards[0].data.linkedPo, 'PO-1001')
  assert.equal(route.response.payload.cards[0].data.linkedRfq, 'RFQ-1001')
  assert.deepEqual(businessSnapshot(db), before)
})

test('activeContext purchase_request resolves PR status', async () => {
  const db = createDb()
  const before = businessSnapshot(db)
  const route = createRouteContext({
    message: '这个 PR 到哪一步了？',
    activeContext: {
      module: 'procurement',
      entityType: 'purchase_request',
      entityId: 'PR-1001',
    },
  }, db)
  await handleAiRoute(route.ctx)

  assert.equal(route.response.payload.intent.name, 'pr_status_query')
  assert.equal(route.response.payload.cards[0].data.prId, 'PR-1001')
  assert.ok(route.response.payload.evidence.some((item) => item.type === 'active_context' && item.id === 'PR-1001'))
  assert.deepEqual(businessSnapshot(db), before)
})

test('explicit PR id overrides activeContext', () => {
  const response = buildAiProcurementOperationalResponse(createDb(), {
    message: 'PR-1002 status',
    activeContext: {
      entityType: 'purchase_request',
      entityId: 'PR-1001',
    },
  })

  assert.equal(response.intent.name, 'pr_status_query')
  assert.equal(response.cards[0].data.prId, 'PR-1002')
  assert.equal(response.evidence.some((item) => item.type === 'active_context'), false)
})

test('missing and not found PR status return safe cards', () => {
  const missing = buildAiProcurementOperationalResponse(createDb(), { message: '这个 PR 到哪一步了？' })
  const notFound = buildAiProcurementOperationalResponse(createDb(), { message: 'PR-404 status' })

  assert.equal(missing.intent.name, 'pr_status_query')
  assert.ok(missing.cards.some((card) => card.type === 'missing_fields'))
  assert.equal(notFound.intent.name, 'pr_status_query')
  assert.ok(notFound.cards.some((card) => card.type === 'empty_state'))
})

test('PR conversion prompt with id returns status and summary prompt returns backlog', async () => {
  const db = createDb()
  const before = businessSnapshot(db)
  const specific = createRouteContext({ message: 'PR-1001 可以转 PO 吗？' }, db)
  await handleAiRoute(specific.ctx)

  assert.equal(specific.response.payload.intent.name, 'pr_conversion_status_query')
  assert.equal(specific.response.payload.cards[0].type, 'pr_conversion_status')
  assert.equal(specific.response.payload.cards[0].data.linkedPo, 'PO-1001')

  const summary = buildAiProcurementOperationalResponse(db, { message: '哪些 PR 还没转 PO？' })
  assert.equal(summary.intent.name, 'pr_conversion_status_query')
  assert.equal(summary.cards[0].type, 'pr_conversion_summary')
  assert.equal(summary.cards[0].data.approvedNotConvertedCount, 0)
  assert.equal(summary.cards[0].data.pendingApprovalCount, 1)
  assert.deepEqual(businessSnapshot(db), before)
})

test('explicit PO id returns po_status_query and not found/missing are safe', async () => {
  const db = createDb()
  const before = businessSnapshot(db)
  const route = createRouteContext({ message: 'PO-1001 现在什么状态？' }, db)
  await handleAiRoute(route.ctx)

  assert.equal(route.response.payload.intent.name, 'po_status_query')
  assert.equal(route.response.payload.cards[0].type, 'po_status')
  assert.equal(route.response.payload.cards[0].data.poId, 'PO-1001')
  assert.equal(route.response.payload.cards[0].data.receivingStatus, 'partial')
  const actions = route.response.payload.cards.find((card) => card.type === 'recommended_actions')?.actions || []
  const followupDraft = actions.find((action) => action.kind === 'draft_preview' && action.draftType === 'po_followup_draft')
  assert.equal(followupDraft?.requiresHumanReview, true)
  assert.equal(followupDraft?.payload?.poId, 'PO-1001')

  const missing = buildAiProcurementOperationalResponse(db, { message: '这个 PO 现在什么状态？' })
  const notFound = buildAiProcurementOperationalResponse(db, { message: 'PO-404 status' })
  assert.ok(missing.cards.some((card) => card.type === 'missing_fields'))
  assert.ok(notFound.cards.some((card) => card.type === 'empty_state'))
  assert.deepEqual(businessSnapshot(db), before)
})

test('broad overdue PO prompt returns po_overdue_query and empty state works', () => {
  const response = buildAiProcurementOperationalResponse(createDb(), {
    message: '哪些 PO 快逾期了？',
  }, { now: new Date('2026-06-28T00:00:00.000Z') })

  assert.equal(response.intent.name, 'po_overdue_query')
  assert.equal(response.cards[0].type, 'po_overdue_summary')
  assert.equal(response.cards[0].data.overdueCount, 1)
  assert.equal(response.cards[0].data.dueSoonCount, 1)

  const empty = buildAiProcurementOperationalResponse(createDb({
    purchaseOrders: [{ po: 'PO-OK', status: '已完成', eta: '2026-06-01' }],
  }), { message: 'overdue PO' }, { now: new Date('2026-06-28T00:00:00.000Z') })
  assert.equal(empty.cards[0].data.overdueCount, 0)
  assert.ok(empty.cards.some((card) => card.type === 'empty_state'))
})

test('receiving status works by GRN id and by linked PO', async () => {
  const db = createDb()
  const before = businessSnapshot(db)
  const grn = createRouteContext({ message: 'GRN-1002 status' }, db)
  await handleAiRoute(grn.ctx)

  assert.equal(grn.response.payload.intent.name, 'receiving_status_query')
  assert.equal(grn.response.payload.cards[0].type, 'receiving_status')
  assert.equal(grn.response.payload.cards[0].data.receivingId, 'GRN-1002')
  assert.equal(grn.response.payload.cards[0].data.exception, true)

  const po = buildAiProcurementOperationalResponse(db, { message: 'PO-1001 receiving status' })
  assert.equal(po.intent.name, 'receiving_status_query')
  assert.equal(po.intent.slots.poId, 'PO-1001')
  assert.equal(po.cards[0].data.receivingId, 'GRN-1001')
  assert.deepEqual(businessSnapshot(db), before)
})

test('broad receiving exception prompt returns summary and empty state works', () => {
  const response = buildAiProcurementOperationalResponse(createDb(), { message: '哪些收货有异常？' })

  assert.equal(response.intent.name, 'receiving_exception_query')
  assert.equal(response.cards[0].type, 'receiving_exception_summary')
  assert.equal(response.cards[0].data.exceptionCount, 1)
  assert.equal(response.cards[0].data.topExceptions[0].receivingId, 'GRN-1002')

  const empty = buildAiProcurementOperationalResponse(createDb({ receivingDocs: [] }), { message: 'receiving exceptions' })
  assert.equal(empty.cards[0].data.exceptionCount, 0)
  assert.ok(empty.cards.some((card) => card.type === 'empty_state'))
})

test('procurement follow-up summary returns read-only counts', async () => {
  const db = createDb()
  const before = businessSnapshot(db)
  const route = createRouteContext({ message: '今天采购有什么要跟？' }, db)
  await handleAiRoute(route.ctx)

  assert.equal(route.response.payload.intent.name, 'procurement_followup_summary_query')
  assert.equal(route.response.payload.cards[0].type, 'procurement_followup_summary')
  assert.equal(route.response.payload.cards[0].data.pendingPrCount, 1)
  assert.equal(route.response.payload.cards[0].data.pendingRfqResponseCount, 1)
  assert.equal(route.response.payload.cards[0].data.receivingExceptionCount, 1)
  assert.deepEqual(businessSnapshot(db), before)
})

test('core procurement UAT prompts bypass read-context and external provider', async () => {
  const db = createDb()
  const before = businessSnapshot(db)
  const prompts = [
    ['今天采购有什么要跟？', 'procurement_followup_summary_query', 'procurement_followup_summary'],
    ['哪些 PO 快逾期？', 'po_overdue_query', 'po_overdue_summary'],
    ['哪些采购申请还没转 PO？', 'pr_conversion_status_query', 'pr_conversion_summary'],
    ['哪些收货有异常？', 'receiving_exception_query', 'receiving_exception_summary'],
    ['What procurement items need follow-up?', 'procurement_followup_summary_query', 'procurement_followup_summary'],
    ['Which POs are overdue?', 'po_overdue_query', 'po_overdue_summary'],
  ]

  for (const [message, intent, cardType] of prompts) {
    const route = createRouteContext({ message }, db, { repositories: failingReadContextRepositories() })
    await handleAiRoute(route.ctx)

    assert.equal(route.response.status, 200, message)
    assert.equal(route.response.payload.intent.name, intent, message)
    assert.equal(route.response.payload.cards[0].type, cardType, message)
    assert.equal(route.response.payload.fastPath, 'pre_read_context', message)
    assert.equal(route.response.payload.usedWeb, false, message)
    assert.notEqual(route.response.payload.provider, 'openai', message)
    assert.notEqual(route.response.payload.provider, 'doubao', message)
    assert.ok(route.response.payload.cards.some((card) => card.type === 'evidence'), message)
    assert.ok(route.response.payload.cards.some((card) => card.type === 'recommended_actions'), message)
  }

  assert.deepEqual(businessSnapshot(db), before)
})

test('intent precedence preserves draft, RFQ, and existing supplier/inventory routes', async () => {
  const db = createDb()

  const prDraftCn = createRouteContext({ message: '帮我生成 PR A100 300 urgent' }, db)
  await handleAiRoute(prDraftCn.ctx)
  assert.equal(prDraftCn.response.payload.intent.name, 'prepare_purchase_request_draft')

  const prDraftStart = createRouteContext({ message: '帮我起一个 PR A100 300' }, db)
  await handleAiRoute(prDraftStart.ctx)
  assert.equal(prDraftStart.response.payload.intent.name, 'prepare_purchase_request_draft')

  const rfqDraftCn = createRouteContext({ message: '帮我做一个 RFQ for A100 qty 1000' }, db)
  await handleAiRoute(rfqDraftCn.ctx)
  assert.equal(rfqDraftCn.response.payload.intent.name, 'prepare_rfq_draft')

  const rfqDraft = createRouteContext({ message: 'Create RFQ for A100 qty 1000' }, db)
  await handleAiRoute(rfqDraft.ctx)
  assert.equal(rfqDraft.response.payload.intent.name, 'prepare_rfq_draft')

  const rfqPending = createRouteContext({ message: 'RFQ pending' }, db)
  await handleAiRoute(rfqPending.ctx)
  assert.equal(rfqPending.response.payload.intent.name, 'rfq_response_query')

  const prDraft = createRouteContext({ message: 'PR A100 300 urgent' }, db)
  await handleAiRoute(prDraft.ctx)
  assert.equal(prDraft.response.payload.intent.name, 'prepare_purchase_request_draft')

  const supplier = createRouteContext({ message: 'supplier SUP-001 status' }, db)
  await handleAiRoute(supplier.ctx)
  assert.equal(supplier.response.payload.intent.name, 'supplier_status_query')

  const inventory = createRouteContext({ message: 'A100 inventory status' }, db)
  await handleAiRoute(inventory.ctx)
  assert.equal(inventory.response.payload.intent.name, 'inventory_status_query')
})
