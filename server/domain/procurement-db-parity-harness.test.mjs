import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldSkipDbTests, withTestDatabase } from '../persistence/test-db-harness.mjs'
import { createDbProcurementReadRepository } from '../repositories/db-procurement-read-repository.mjs'
import { createJsonProcurementReadRepository } from '../repositories/json-procurement-read-repository.mjs'
import { createRepositoryRegistry } from '../repositories/adapter-registry.mjs'
import { handleAiRoute } from '../routes/ai.routes.mjs'
import { handleTodayCockpitRoute } from '../routes/today-cockpit.routes.mjs'
import { isDatabaseModeWriteBlocked } from './route-classification.mjs'

const env = {
  FLOWCHAIN_PERSISTENCE_MODE: 'database',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/flowchain',
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function createDb() {
  return {
    products: [{ sku: 'A100', name: 'Motor A100', currentStock: 4, safetyStock: 10, reorderPoint: 12, supplier: 'ABC Components', unit: 'pcs' }],
    suppliers: [{ id: 'SUP-1', name: 'ABC Components', category: 'Components', score: 92 }],
    purchaseRequests: [{
      pr: 'PR-PAR-1',
      sourceSku: 'A100',
      sourceName: 'Motor A100',
      itemId: 'ITEM-A100',
      supplier: 'ABC Components',
      supplierId: 'SUP-1',
      requester: 'Buyer A',
      buyer: 'Buyer B',
      requiredDate: '2026-07-05',
      quantity: 10,
      unit: 'pcs',
      unitPrice: 120,
      amount: 1200,
      currency: 'CNY',
      status: 'approved',
      priority: 'high',
      linkedRfq: 'RFQ-PAR-1',
      linkedPo: 'PO-PAR-1',
      source: 'mrp',
      reason: 'Low stock',
      createdAt: '2026-06-01',
      updatedAt: '2026-06-02',
    }],
    rfqs: [{
      id: 'RFQ-PAR-1',
      title: 'A100 RFQ',
      category: 'Motors',
      status: 'active',
      suppliers: 3,
      quoted: 1,
      due: '2026-06-20',
      bestPrice: 118,
      bestSupplier: 'ABC Components',
      supplierId: 'SUP-1',
      sourceRequest: 'PR-PAR-1',
      linkedPo: 'PO-PAR-1',
      sourceSku: 'A100',
      sourceName: 'Motor A100',
      itemId: 'ITEM-A100',
      quantity: 10,
      unit: 'pcs',
      currency: 'CNY',
      createdAt: '2026-06-03',
      updatedAt: '2026-06-04',
    }],
    purchaseOrders: [{
      po: 'PO-PAR-1',
      supplier: 'ABC Components',
      supplierId: 'SUP-1',
      eta: '2026-06-25',
      owner: 'Buyer B',
      amount: 1200,
      currency: 'CNY',
      items: 10,
      received: 4,
      totalOrderedQty: 10,
      totalReceivedQty: 4,
      status: 'issued',
      priority: 'high',
      sourceRequest: 'PR-PAR-1',
      sourceRfq: 'RFQ-PAR-1',
      sourceSku: 'A100',
      sourceName: 'Motor A100',
      itemId: 'ITEM-A100',
      lineCount: 1,
      createdAt: '2026-06-05',
      updatedAt: '2026-06-06',
    }],
    receivingDocs: [{
      grn: 'GRN-PAR-1',
      po: 'PO-PAR-1',
      supplier: 'ABC Components',
      supplierId: 'SUP-1',
      status: 'inspecting',
      arrived: '2026-06-26',
      receiver: 'Receiver A',
      warehouse: 'WH-MAIN',
      items: 5,
      passed: 4,
      failed: 1,
      currency: 'CNY',
      createdAt: '2026-06-26',
      updatedAt: '2026-06-26',
    }],
    supplierInvoices: [{
      invoiceNumber: 'INV-PAR-1',
      supplier: 'ABC Components',
      supplierId: 'SUP-1',
      relatedPo: 'PO-PAR-1',
      relatedGrn: 'GRN-PAR-1',
      invoiceDate: '2026-06-27',
      dueDate: '2026-07-27',
      amount: 1260,
      currency: 'CNY',
      status: 'pending',
      matchStatus: 'variance',
      varianceAmount: 60,
      createdAt: '2026-06-27',
      updatedAt: '2026-06-27',
    }],
    documentLinks: [{ sourceType: 'pr', sourceId: 'PR-PAR-1', targetType: 'po', targetId: 'PO-PAR-1', relationship: 'converted_po', relation: 'converted_po', label: 'PR to PO', status: 'active' }],
    procurementFollowups: [{ id: 'FOLLOWUP-PAR-1', type: 'invoice_variance', severity: 'high', status: 'open', owner: 'Buyer B', title: 'Invoice variance', message: 'Variance requires review', dueDate: '2026-07-01', supplierId: 'SUP-1', supplierName: 'ABC Components', documentType: 'invoice', documentId: 'INV-PAR-1' }],
    purchaseOrdersLegacy: [],
    events: [],
    auditLog: [],
  }
}

function createModel(records = []) {
  return {
    calls: [],
    findMany: async (query = {}) => {
      createModel.lastQuery = query
      return records
    },
  }
}

function date(value) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null
}

function createPrisma() {
  const db = createDb()
  return {
    purchaseRequest: createModel(db.purchaseRequests.map((item) => ({
      id: item.pr,
      status: item.status,
      requester: item.requester,
      buyer: item.buyer,
      supplierId: item.supplierId,
      supplierName: item.supplier,
      priority: item.priority,
      requiredDate: date(item.requiredDate),
      amount: item.amount,
      currency: item.currency,
      reason: item.reason,
      source: item.source,
      linkedRfqId: item.linkedRfq,
      linkedPoId: item.linkedPo,
      createdAt: date(item.createdAt),
      updatedAt: date(item.updatedAt),
      metadata: {},
      lines: [{ sku: item.sourceSku, itemId: item.itemId, itemName: item.sourceName, quantity: item.quantity, unit: item.unit, unitPrice: item.unitPrice, amount: item.amount }],
    }))),
    rfq: createModel(db.rfqs.map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      status: item.status,
      supplierCount: item.suppliers,
      respondedSupplierCount: item.quoted,
      dueDate: date(item.due),
      bestPrice: item.bestPrice,
      awardedSupplier: item.bestSupplier,
      supplierId: item.supplierId,
      sourceRequestId: item.sourceRequest,
      linkedPoId: item.linkedPo,
      currency: item.currency,
      createdAt: date(item.createdAt),
      updatedAt: date(item.updatedAt),
      metadata: {},
      lines: [{ sku: item.sourceSku, itemId: item.itemId, itemName: item.sourceName, quantity: item.quantity, unit: item.unit }],
    }))),
    supplierQuotation: createModel([{ id: 'SQ-PAR-1', rfqId: 'RFQ-PAR-1', supplierName: 'ABC Components' }]),
    purchaseOrder: createModel(db.purchaseOrders.map((item) => ({
      id: item.po,
      status: item.status,
      supplierId: item.supplierId,
      supplierName: item.supplier,
      sourceRequestId: item.sourceRequest,
      sourceRfqId: item.sourceRfq,
      expectedDate: date(item.eta),
      amount: item.amount,
      currency: item.currency,
      owner: item.owner,
      priority: item.priority,
      createdAt: date(item.createdAt),
      updatedAt: date(item.updatedAt),
      metadata: {},
      lines: [{ sku: item.sourceSku, itemId: item.itemId, itemName: item.sourceName, orderedQuantity: item.totalOrderedQty, receivedQuantity: item.totalReceivedQty, unit: 'pcs', amount: item.amount }],
    }))),
    receivingDocument: createModel(db.receivingDocs.map((item) => ({
      id: item.grn,
      poId: item.po,
      supplierId: item.supplierId,
      supplierName: item.supplier,
      status: item.status,
      arrivedAt: date(item.arrived),
      receiver: item.receiver,
      warehouseId: item.warehouse,
      currency: item.currency,
      createdAt: date(item.createdAt),
      updatedAt: date(item.updatedAt),
      metadata: {},
      lines: [{ sku: 'A100', itemId: 'ITEM-A100', itemName: 'Motor A100', acceptedQty: item.passed, rejectedQty: item.failed, unit: 'pcs' }],
    }))),
    supplierInvoice: createModel(db.supplierInvoices.map((item) => ({
      id: item.invoiceNumber,
      supplierId: item.supplierId,
      supplierName: item.supplier,
      relatedPoId: item.relatedPo,
      relatedGrnId: item.relatedGrn,
      invoiceDate: date(item.invoiceDate),
      dueDate: date(item.dueDate),
      amount: item.amount,
      currency: item.currency,
      status: item.status,
      matchStatus: item.matchStatus,
      varianceAmount: item.varianceAmount,
      createdAt: date(item.createdAt),
      updatedAt: date(item.updatedAt),
      metadata: {},
      lines: [{ sku: 'A100', itemId: 'ITEM-A100', itemName: 'Motor A100', quantity: 10, unit: 'pcs', amount: item.amount }],
    }))),
    documentLink: createModel(db.documentLinks.map((item) => ({
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      targetType: item.targetType,
      targetId: item.targetId,
      relationship: item.relationship,
      status: item.status,
      metadata: { label: item.label },
    }))),
    procurementFollowup: createModel(db.procurementFollowups),
  }
}

function byType(rows, type) {
  return rows.find((item) => item.documentType === type)
}

function stableShape(value) {
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, Array.isArray(item) ? item.map(stableShape) : stableShape(item)])
  )
}

function publicDocumentProjection(row = {}) {
  return stableShape({
    id: row.id,
    documentType: row.documentType,
    status: row.status,
    supplierName: row.supplierName,
    supplierId: row.supplierId,
    amount: row.amount,
    currency: row.currency,
    sourceSku: row.sourceSku,
    relatedDocuments: row.relatedDocuments,
  })
}

test('mocked procurement DB adapter matches JSON document list contract', async () => {
  const json = createJsonProcurementReadRepository(createDb())
  const database = createDbProcurementReadRepository({ env, prisma: createPrisma() })

  const jsonRows = await json.listDocuments()
  const dbRows = await database.listDocuments()

  assert.deepEqual(new Set(dbRows.map((item) => item.documentType)), new Set(jsonRows.map((item) => item.documentType)))
  for (const type of ['pr', 'rfq', 'po', 'grn', 'invoice', 'threeWayMatch']) {
    assert.deepEqual(publicDocumentProjection(byType(dbRows, type)), publicDocumentProjection(byType(jsonRows, type)))
  }
})

test('mocked procurement DB adapter matches JSON document detail contract', async () => {
  const json = createJsonProcurementReadRepository(createDb())
  const database = createDbProcurementReadRepository({ env, prisma: createPrisma() })
  const ids = {
    pr: 'PR-PAR-1',
    rfq: 'RFQ-PAR-1',
    po: 'PO-PAR-1',
    grn: 'GRN-PAR-1',
    invoice: 'INV-PAR-1',
    threeWayMatch: 'MATCH-INV-PAR-1',
  }

  for (const [type, id] of Object.entries(ids)) {
    const dbDetail = await database.getDocument(type, id)
    const jsonDetail = await json.getDocument(type, id)
    assert.deepEqual(publicDocumentProjection(dbDetail), publicDocumentProjection(jsonDetail), type)
  }
})

test('mocked procurement DB adapter matches JSON links followups and summary shapes', async () => {
  const json = createJsonProcurementReadRepository(createDb())
  const database = createDbProcurementReadRepository({ env, prisma: createPrisma() })

  const [jsonLinks, dbLinks] = await Promise.all([json.listLinks(), database.listLinks()])
  const [jsonFollowups, dbFollowups] = await Promise.all([json.listFollowups(), database.listFollowups()])
  const [jsonSummary, dbSummary] = await Promise.all([json.getSummary(), database.getSummary()])

  assert.equal(dbLinks.some((link) => link.sourceType === 'pr' && link.targetType === 'po'), true)
  assert.equal(jsonLinks.some((link) => link.sourceType === 'pr' && link.targetType === 'po'), true)
  assert.equal(jsonFollowups.some((item) => item.type === 'invoice_variance' && item.documentType === 'invoice'), true)
  assert.deepEqual(stableShape(dbFollowups.find((item) => item.id === 'FOLLOWUP-PAR-1')), {
    documentId: 'INV-PAR-1',
    documentType: 'invoice',
    dueDate: '2026-07-01',
    id: 'FOLLOWUP-PAR-1',
    message: 'Variance requires review',
    owner: 'Buyer B',
    severity: 'high',
    status: 'open',
    summary: 'Variance requires review',
    supplierId: 'SUP-1',
    supplierName: 'ABC Components',
    title: 'Invoice variance',
    type: 'invoice_variance',
  })
  for (const key of ['documentCount', 'purchaseRequestCount', 'rfqCount', 'purchaseOrderCount', 'receivingDocCount', 'supplierInvoiceCount', 'threeWayMatchCount', 'currency']) {
    assert.equal(dbSummary[key], jsonSummary[key], key)
  }
  assert.equal(dbSummary.followupCount >= jsonSummary.followupCount, true)
})

test('mocked procurement DB adapter handles invalid types missing documents and no mutation', async () => {
  const prisma = createPrisma()
  const source = createDb()
  const before = clone(source)
  const database = createDbProcurementReadRepository({ env, prisma })

  assert.equal(database.normalizeDocumentType('supplier-invoice'), 'invoice')
  assert.equal(database.isDocumentType('customer'), false)
  assert.equal(await database.getDocument('po', 'PO-MISSING'), null)
  await database.listDocuments({ q: 'A100' })
  assert.deepEqual(source, before)
  for (const key of Object.keys(database)) {
    assert.doesNotMatch(key, /create|update|delete|persist|post|confirm/i)
  }
})

test('procurement DB parity optional live path skips cleanly without DATABASE_URL_TEST', async () => {
  assert.equal(shouldSkipDbTests({}).skip, true)
  const result = await withTestDatabase({}, async ({ prisma, env: liveEnv }) => {
    const repository = createDbProcurementReadRepository({ env: liveEnv, prisma })
    const documents = await repository.listDocuments({ limit: 5 })
    return documents.map((item) => item.documentType)
  })
  assert.deepEqual(result, {
    skipped: true,
    reason: 'DATABASE_URL_TEST is not configured.',
  })
})

test('Today Cockpit AI procurement compatibility and DB guard remain stable', async () => {
  const db = createDb()
  const registry = createRepositoryRegistry({ db, env: {} })
  let cockpitResponse = null
  await handleTodayCockpitRoute({
    req: { method: 'GET' },
    res: {},
    url: new URL('/api/today-cockpit', 'http://localhost'),
    db,
    repositories: registry,
    send(_res, status, payload) {
      cockpitResponse = { status, payload }
    },
  })

  let aiResponse = null
  await handleAiRoute({
    req: { method: 'POST', body: { message: 'PR-PAR-1 status' }, headers: {} },
    res: {},
    url: new URL('/api/ai/chat', 'http://localhost'),
    db,
    repositories: registry,
    send(_res, status, payload) {
      aiResponse = { status, payload }
    },
    readBody: async (req) => req.body,
    writeDb: async () => {},
    event: () => {},
    ensurePurchaseRequests: (nextDb) => nextDb.purchaseRequests || [],
    ensureInventoryMovements: (nextDb) => nextDb.inventoryMovements || [],
    ensureRfqs: (nextDb) => nextDb.rfqs || [],
    supplierPerformance: () => [],
    supplierRecommendations: () => null,
    supplierQuoteCount: 0,
    openaiDispatcher: { dispatch() { throw new Error('provider should not be reached') } },
    arkDispatcher: { dispatch() { throw new Error('ark should not be reached') } },
    aiMaxTokens: 120,
  })

  assert.equal(cockpitResponse.status, 200)
  assert.equal(aiResponse.status, 200)
  assert.equal(aiResponse.payload.intent.name, 'pr_status_query')
  assert.equal(isDatabaseModeWriteBlocked({ persistenceMode: 'database', method: 'POST', pathname: '/api/purchase-requests' }), true)
  assert.equal(isDatabaseModeWriteBlocked({ persistenceMode: 'database', method: 'GET', pathname: '/api/procurement/documents' }), false)
})
