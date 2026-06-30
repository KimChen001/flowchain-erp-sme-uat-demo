import test from 'node:test'
import assert from 'node:assert/strict'
import { DATABASE_CONFIG_ERROR } from '../persistence/persistence-config.mjs'
import { createDatabaseRepositoryRegistry, createJsonRepositoryRegistry, createRepositoryRegistry } from '../repositories/adapter-registry.mjs'
import { createJsonMasterDataRepository } from '../repositories/json-master-data-repository.mjs'
import { createDbMasterDataRepository } from '../repositories/db-master-data-repository.mjs'
import { createJsonProcurementReadRepository } from '../repositories/json-procurement-read-repository.mjs'
import { createDbProcurementReadRepository } from '../repositories/db-procurement-read-repository.mjs'
import { createJsonInventoryReadRepository } from '../repositories/json-inventory-read-repository.mjs'
import { createDbInventoryReadRepository } from '../repositories/db-inventory-read-repository.mjs'
import { createJsonActionDraftRepository } from '../repositories/json-action-draft-repository.mjs'
import { createDbActionDraftRepository } from '../repositories/db-action-draft-repository.mjs'
import { createAuditLogRepository } from '../repositories/audit-log-repository.mjs'
import { createDbAuditLogRepository } from '../repositories/db-audit-log-repository.mjs'

const env = {
  FLOWCHAIN_PERSISTENCE_MODE: 'database',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/flowchain',
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function keys(value = {}) {
  return Object.keys(value || {}).sort()
}

function assertSameKeys(actual, expected, label) {
  assert.deepEqual(keys(actual), keys(expected), label)
}

function assertContainsKeys(actual, expected, label) {
  for (const key of keys(expected)) {
    assert.equal(Object.hasOwn(actual || {}, key), true, `${label}: ${key}`)
  }
}

function createDb() {
  return {
    products: [
      { sku: 'A100', name: 'Motor A100', category: 'Components', supplier: 'ABC Components', currentStock: 12, onHandQuantity: 18, reservedQuantity: 6, safetyStock: 50, reorderPoint: 80, unit: 'pcs', stockoutRisk: '高' },
    ],
    suppliers: [{ id: 'SUP-1', name: 'ABC Components', category: 'Components', risk: 'low', score: 95 }],
    warehouses: [{ id: 'WH-MAIN', name: 'Main Warehouse' }],
    paymentTerms: [{ id: 'NET30', label: 'Net 30', days: 30 }],
    taxCodes: [{ id: 'TAX-STD', label: 'Standard Tax', rate: 0.13 }],
    inventoryLots: [{ lot: 'LOT-A100-01', sku: 'A100', name: 'Motor A100', warehouse: 'WH-MAIN', qty: 12, supplier: 'ABC Components' }],
    inventorySerials: [{ sn: 'SN-A100-001', sku: 'A100', warehouse: 'WH-MAIN', status: '在库', lot: 'LOT-A100-01' }],
    inventoryMovements: [{ movementId: 'IM-1', movementType: 'StockAdjustment', sku: 'A100', itemName: 'Motor A100', warehouse: 'WH-MAIN', adjustmentQty: -2, status: '待复核', sourceDocument: 'ADJ-1' }],
    purchaseRequests: [{ pr: 'PR-1', sourceSku: 'A100', sourceName: 'Motor A100', supplier: 'ABC Components', status: '已批准', quantity: 10, amount: 1200, linkedRfq: 'RFQ-1', linkedPo: 'PO-1' }],
    rfqs: [{ id: 'RFQ-1', title: 'A100 RFQ', status: '进行中', suppliers: 3, quoted: 1, sourceRequest: 'PR-1', linkedPo: 'PO-1', bestSupplier: 'ABC Components' }],
    purchaseOrders: [{ po: 'PO-1', sourceSku: 'A100', sourceName: 'Motor A100', supplier: 'ABC Components', status: '已发出', items: 10, received: 4, amount: 1200, sourceRequest: 'PR-1', sourceRfq: 'RFQ-1' }],
    receivingDocs: [{ grn: 'GRN-1', po: 'PO-1', supplier: 'ABC Components', status: '质检中', items: 5, passed: 4, failed: 1 }],
    supplierInvoices: [{ invoiceNumber: 'INV-1', supplier: 'ABC Components', relatedPo: 'PO-1', relatedGrn: 'GRN-1', amount: 1260, varianceAmount: 60, matchStatus: '存在差异' }],
    auditLog: [],
  }
}

function createModel(records = []) {
  return { findMany: async () => records }
}

function createMasterPrisma() {
  return {
    item: createModel([{ id: 'ITEM-A100', sku: 'A100', name: 'Motor A100', category: 'Components', unit: 'pcs', preferredSupplierId: 'SUP-1', status: 'active', safetyStock: 50, reorderPoint: 80, metadata: { defaultWarehouseId: 'WH-MAIN', supplier: 'ABC Components', moq: 1 } }]),
    supplier: createModel([{ id: 'SUP-1', code: 'ABC', name: 'ABC Components', category: 'Components', status: 'active', riskLevel: 'low', score: 95, metadata: { paymentTermsId: 'NET30' } }]),
    warehouse: createModel([{ id: 'WH-MAIN', code: 'WH-MAIN', name: 'Main Warehouse', status: 'active', metadata: {} }]),
    paymentTerm: createModel([{ id: 'TERM-NET30', code: 'NET30', name: 'Net 30', days: 30, metadata: {} }]),
    taxCode: createModel([{ id: 'TAX-STD-ID', code: 'TAX-STD', name: 'Standard Tax', rate: 0.13, metadata: {} }]),
  }
}

function createProcurementPrisma() {
  return {
    purchaseRequest: createModel([{ id: 'PR-1', status: '已批准', supplierName: 'ABC Components', linkedRfqId: 'RFQ-1', linkedPoId: 'PO-1', amount: 1200, currency: 'CNY', metadata: {}, createdAt: new Date('2026-06-01'), updatedAt: new Date('2026-06-02'), lines: [{ sku: 'A100', itemName: 'Motor A100', quantity: 10, amount: 1200 }] }]),
    rfq: createModel([{ id: 'RFQ-1', title: 'A100 RFQ', status: '进行中', supplierCount: 3, respondedSupplierCount: 1, awardedSupplier: 'ABC Components', sourceRequestId: 'PR-1', linkedPoId: 'PO-1', currency: 'CNY', metadata: {}, createdAt: new Date('2026-06-02'), updatedAt: new Date('2026-06-03'), lines: [{ sku: 'A100', itemName: 'Motor A100', quantity: 10 }] }]),
    supplierQuotation: createModel([{ id: 'SQ-1', rfqId: 'RFQ-1' }]),
    purchaseOrder: createModel([{ id: 'PO-1', status: '已发出', supplierName: 'ABC Components', sourceRequestId: 'PR-1', sourceRfqId: 'RFQ-1', amount: 1200, currency: 'CNY', metadata: {}, createdAt: new Date('2026-06-03'), updatedAt: new Date('2026-06-04'), lines: [{ sku: 'A100', itemName: 'Motor A100', orderedQuantity: 10, receivedQuantity: 4, amount: 1200 }] }]),
    receivingDocument: createModel([{ id: 'GRN-1', poId: 'PO-1', supplierName: 'ABC Components', status: '质检中', currency: 'CNY', metadata: {}, createdAt: new Date('2026-06-04'), updatedAt: new Date('2026-06-05'), lines: [{ sku: 'A100', itemName: 'Motor A100', acceptedQty: 4, rejectedQty: 1 }] }]),
    supplierInvoice: createModel([{ id: 'INV-1', supplierName: 'ABC Components', relatedPoId: 'PO-1', relatedGrnId: 'GRN-1', amount: 1260, currency: 'CNY', status: 'pending', matchStatus: '存在差异', varianceAmount: 60, metadata: {}, createdAt: new Date('2026-06-05'), updatedAt: new Date('2026-06-06'), lines: [{ sku: 'A100', itemName: 'Motor A100', amount: 1260 }] }]),
    documentLink: createModel([]),
    procurementFollowup: createModel([]),
  }
}

function createInventoryPrisma() {
  return {
    item: createModel([]),
    inventoryBalance: createModel([{ id: 'BAL-1', itemId: 'ITEM-A100', sku: 'A100', itemName: 'Motor A100', warehouseId: 'WH-MAIN', availableQuantity: 12, onHandQuantity: 18, reservedQuantity: 6, safetyStock: 50, reorderPoint: 80, unit: 'pcs', riskLevel: '高', updatedAt: new Date('2026-06-02'), metadata: { category: 'Components', supplier: 'ABC Components' } }]),
    inventoryLot: createModel([{ id: 'LOT-A100-01', sku: 'A100', itemName: 'Motor A100', warehouseId: 'WH-MAIN', quantity: 12, supplierName: 'ABC Components', updatedAt: new Date('2026-06-02') }]),
    inventorySerial: createModel([{ id: 'SN-A100-001', sku: 'A100', warehouseId: 'WH-MAIN', status: '在库', sourceDocument: 'LOT-A100-01', updatedAt: new Date('2026-06-02') }]),
    inventoryMovement: createModel([{ id: 'IM-1', sku: 'A100', itemName: 'Motor A100', warehouseId: 'WH-MAIN', movementType: 'StockAdjustment', sourceDocument: 'ADJ-1', adjustmentQty: -2, status: '待复核', evidence: [], timeline: [] }]),
    inventoryException: createModel([]),
  }
}

test('database registry selects all migrated DB adapters and JSON registry remains database-free', async () => {
  const db = createDb()
  const json = createRepositoryRegistry({ db, env: {} })
  const database = createRepositoryRegistry({ db, env: { FLOWCHAIN_PERSISTENCE_MODE: 'database' } })

  assert.equal(json.mode, 'json')
  assert.equal(json.inventoryRead.getItem('A100').sku, 'A100')
  assert.equal(json.procurementRead.getDocument('po', 'PO-1').id, 'PO-1')

  assert.equal(database.masterData.adapter, 'db-master-data-v1')
  assert.equal(database.procurementRead.adapter, 'db-procurement-read-v1')
  assert.equal(database.inventoryRead.adapter, 'db-inventory-read-v1')
  assert.equal(database.actionDrafts.adapter, 'db-action-draft-v1')
  assert.equal(database.auditLog.adapter, 'db-audit-log-v1')
  await assert.rejects(() => database.inventoryRead.listItems(), (error) => error.message === DATABASE_CONFIG_ERROR)
  await assert.rejects(() => database.procurementRead.listDocuments(), (error) => error.message === DATABASE_CONFIG_ERROR)
})

test('master data JSON and DB adapters expose matching public row shapes', async () => {
  const json = createJsonMasterDataRepository(createDb())
  const database = createDbMasterDataRepository({ env, prisma: createMasterPrisma() })

  assertSameKeys(await database.listItems().then((rows) => rows[0]), json.listItems()[0], 'item keys')
  assertSameKeys(await database.listSuppliers().then((rows) => rows[0]), json.listSuppliers()[0], 'supplier keys')
  assertSameKeys(await database.listWarehouses().then((rows) => rows[0]), json.listWarehouses()[0], 'warehouse keys')
  assertSameKeys(await database.listPaymentTerms().then((rows) => rows[0]), json.listPaymentTerms()[0], 'payment term keys')
  assertSameKeys(await database.listTaxCodes().then((rows) => rows[0]), json.listTaxCodes()[0], 'tax code keys')
})

test('procurement and inventory DB adapters preserve public read shapes without write methods', async () => {
  const db = createDb()
  const procurementJson = createJsonProcurementReadRepository(db)
  const procurementDb = createDbProcurementReadRepository({ env, prisma: createProcurementPrisma() })
  const inventoryJson = createJsonInventoryReadRepository(db)
  const inventoryDb = createDbInventoryReadRepository({ env, prisma: createInventoryPrisma() })

  assertSameKeys((await procurementDb.listDocuments({ type: 'po' }))[0], procurementJson.listDocuments({ type: 'po' })[0], 'po keys')
  assertSameKeys(await procurementDb.getDocument('invoice', 'INV-1'), procurementJson.getDocument('invoice', 'INV-1'), 'invoice keys')
  assertSameKeys(await procurementDb.getSummary(), procurementJson.getSummary(), 'procurement summary keys')
  assertSameKeys((await inventoryDb.listItems())[0], inventoryJson.listItems()[0], 'inventory item keys')
  assertSameKeys((await inventoryDb.listMovements())[0], inventoryJson.listMovements()[0], 'inventory movement keys')
  assertSameKeys(await inventoryDb.getSummary(), inventoryJson.getSummary(), 'inventory summary keys')

  for (const repository of [procurementDb, inventoryDb]) {
    for (const method of Object.keys(repository)) {
      assert.doesNotMatch(method, /create|update|delete|persist|confirm|post|save/i)
    }
  }
})

test('action draft preview and audit log keep parity boundaries without mutating source DB', async () => {
  const db = createDb()
  const before = clone(db)
  const jsonDrafts = createJsonActionDraftRepository(db)
  const dbDrafts = createDbActionDraftRepository({ db, env })
  const request = { type: 'purchase_request_draft', payload: { itemIdOrSku: 'A100', quantity: 10 } }

  const jsonPreview = jsonDrafts.previewDraft(request, { now: new Date('2026-06-30T00:00:00.000Z') })
  const dbPreview = dbDrafts.previewDraft(request, { now: new Date('2026-06-30T00:00:00.000Z') })
  assertSameKeys(dbPreview, jsonPreview, 'draft preview response keys')
  assertSameKeys(dbPreview.draft, jsonPreview.draft, 'draft keys')
  assert.equal(dbPreview.draft.confirmationBoundary.previewOnly, true)
  assert.deepEqual(db, before)

  const writes = []
  const dbAudit = createDbAuditLogRepository({
    env,
    prisma: {
      auditLog: {
        create: async ({ data }) => {
          writes.push(data)
          return { ...data, createdAt: data.createdAt || new Date('2026-06-30T00:00:00.000Z') }
        },
        findMany: async () => writes.map((item) => ({ ...item, createdAt: item.createdAt || new Date('2026-06-30T00:00:00.000Z') })),
      },
    },
  })
  const jsonAudit = createAuditLogRepository({ auditLog: [] })
  const entry = {
    source: 'system',
    action: 'parity_checked',
    entity: { type: 'system', id: 'DB-PARITY' },
    summary: 'Parity checked with Bearer abc.def.ghi',
    metadata: { token: 'secret' },
  }
  const jsonRecord = jsonAudit.recordAuditEntry(entry, { now: new Date('2026-06-30T00:00:00.000Z') })
  const dbRecord = await dbAudit.recordAuditEntry(entry, { now: new Date('2026-06-30T00:00:00.000Z') })
  assertContainsKeys(dbRecord, jsonRecord, 'audit record keys')
  assert.doesNotMatch(JSON.stringify(dbRecord), /Bearer abc|"token":"secret"/)
})
