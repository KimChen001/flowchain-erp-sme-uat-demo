import test from 'node:test'
import assert from 'node:assert/strict'
import { createJsonInventoryReadRepository } from '../repositories/json-inventory-read-repository.mjs'
import { createJsonProcurementReadRepository } from '../repositories/json-procurement-read-repository.mjs'
import { createRepositoryRegistry } from '../repositories/adapter-registry.mjs'
import { handleInventoryRoute } from '../routes/inventory.routes.mjs'
import { handleProcurementReadRoute } from '../routes/procurement-read.routes.mjs'
import { buildInventoryItems, buildInventorySummary } from './inventory-read.mjs'
import { buildProcurementDocuments, buildProcurementSummary } from './procurement-read-model.mjs'
import { buildTodayCockpit } from './today-cockpit-read-model.mjs'
import { buildAiCockpitFastPathResponse } from './ai-evidence-reuse.mjs'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function createDb() {
  return {
    products: [
      { sku: 'A100', name: 'Motor A100', currentStock: 12, safetyStock: 50, reorderPoint: 80, stockoutRisk: '高', unit: 'pcs' },
      { sku: 'B200', name: 'Bracket B200', currentStock: 160, safetyStock: 40, stockoutRisk: '低', unit: 'pcs' },
    ],
    inventoryMovements: [
      { movementId: 'IM-001', movementType: 'PurchaseReceipt', sku: 'A100', sourceDocument: 'GRN-001', quantityIn: 10, status: '已确认' },
      { movementId: 'IM-002', movementType: 'StockAdjustment', sku: 'A100', sourceDocument: 'ADJ-001', adjustmentQty: -2, status: '待复核' },
    ],
    purchaseRequests: [{ pr: 'PR-1', sourceSku: 'A100', sourceName: 'Motor A100', status: '已批准', quantity: 10, linkedPo: 'PO-1' }],
    rfqs: [{ id: 'RFQ-1', title: 'A100 RFQ', status: '进行中', suppliers: 2, quoted: 1, sourceRequest: 'PR-1', linkedPo: 'PO-1' }],
    purchaseOrders: [{ po: 'PO-1', sourceSku: 'A100', supplier: 'ABC Components', status: '已发出', sourceRequest: 'PR-1', sourceRfq: 'RFQ-1', eta: '2026-06-01' }],
    receivingDocs: [{ grn: 'GRN-1', po: 'PO-1', supplier: 'ABC Components', status: '质检中', items: 10 }],
    supplierInvoices: [{ invoiceNumber: 'INV-1', relatedPo: 'PO-1', relatedGrn: 'GRN-1', supplier: 'ABC Components', amount: 100, varianceAmount: 10, matchStatus: '存在差异' }],
    auditLog: [],
  }
}

function createRouteContext(pathname, db, repositories) {
  let response = null
  return {
    ctx: {
      req: { method: 'GET', headers: {} },
      res: {},
      url: new URL(pathname, 'http://localhost'),
      db,
      repositories,
      send(_res, status, payload) {
        response = { status, payload }
      },
    },
    get response() {
      return response
    },
  }
}

test('InventoryReadRepository delegates to existing read model shapes without mutation', () => {
  const db = createDb()
  const before = clone(db)
  const repository = createJsonInventoryReadRepository(db)

  assert.deepEqual(repository.listItems(), buildInventoryItems(db))
  assert.equal(repository.getItem('A100').sku, 'A100')
  assert.equal(repository.listMovements().length, 2)
  assert.equal(repository.listExceptions()[0].linkedMovement, 'IM-002')
  assert.deepEqual(repository.getSummary(), buildInventorySummary(db))
  assert.equal(repository.getItem('missing'), null)
  assert.deepEqual(db, before)
})

test('ProcurementReadRepository delegates to existing read model shapes without mutation', () => {
  const db = createDb()
  const before = clone(db)
  const repository = createJsonProcurementReadRepository(db)

  assert.deepEqual(repository.listDocuments(), buildProcurementDocuments(db))
  assert.deepEqual(repository.getSummary(), buildProcurementSummary(db))
  assert.equal(repository.getDocument('purchase-order', 'PO-1').documentType, 'po')
  assert.equal(repository.listLinks().some((link) => link.sourceType === 'pr' && link.targetType === 'po'), true)
  assert.equal(repository.listFollowups().some((item) => item.documentType === 'invoice'), true)
  assert.equal(repository.normalizeDocumentType('3wm'), 'threeWayMatch')
  assert.equal(repository.isDocumentType('customer'), false)
  assert.equal(repository.getDocument('po', 'missing'), null)
  assert.deepEqual(db, before)
})

test('adapter registry exposes procurement and inventory read repositories', () => {
  const db = createDb()
  const registry = createRepositoryRegistry({ db, env: {} })

  assert.equal(registry.inventoryRead.getItem('A100').itemName, 'Motor A100')
  assert.equal(registry.procurementRead.getDocument('rfq', 'RFQ-1').id, 'RFQ-1')
})

test('inventory and procurement routes use injected repositories while preserving response shape', async () => {
  const db = createDb()
  const before = clone(db)
  const repositories = createRepositoryRegistry({ db, env: {} })
  const inventoryRoute = createRouteContext('/api/inventory/items?q=A100', db, repositories)
  const inventoryMissing = createRouteContext('/api/inventory/items/missing', db, repositories)
  const procurementRoute = createRouteContext('/api/procurement/documents/purchase-order/PO-1', db, repositories)
  const procurementInvalid = createRouteContext('/api/procurement/documents/customer/CUST-1', db, repositories)

  assert.equal(await handleInventoryRoute(inventoryRoute.ctx), true)
  assert.equal(inventoryRoute.response.status, 200)
  assert.equal(inventoryRoute.response.payload.items.length, 1)

  assert.equal(await handleInventoryRoute(inventoryMissing.ctx), true)
  assert.equal(inventoryMissing.response.status, 404)
  assert.deepEqual(inventoryMissing.response.payload, { error: 'Inventory item not found' })

  assert.equal(await handleProcurementReadRoute(procurementRoute.ctx), true)
  assert.equal(procurementRoute.response.status, 200)
  assert.equal(procurementRoute.response.payload.document.documentType, 'po')

  assert.equal(await handleProcurementReadRoute(procurementInvalid.ctx), true)
  assert.equal(procurementInvalid.response.status, 400)
  assert.deepEqual(procurementInvalid.response.payload, { error: 'Invalid procurement document type' })
  assert.deepEqual(db, before)
})

test('Today Cockpit and deterministic AI remain compatible with read repository prep', () => {
  const db = createDb()
  const cockpit = buildTodayCockpit(db, { now: '2026-06-30T00:00:00.000Z' })
  const ai = buildAiCockpitFastPathResponse(db, { question: '今天工作台优先处理什么？', moduleId: 'overview' })

  assert.equal(cockpit.cards.length, 8)
  assert.equal(cockpit.recentDocuments.some((item) => item.type === 'po'), true)
  assert.equal(ai.provider, 'local')
  assert.equal(ai.readModelReuse, true)
  assert.ok(ai.evidence.length > 0)
})
