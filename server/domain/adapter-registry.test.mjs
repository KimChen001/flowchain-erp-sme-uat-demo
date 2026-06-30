import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createJsonRepositoryRegistry,
  createRepositoryRegistry,
  getPersistenceMode,
} from '../repositories/adapter-registry.mjs'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function createDb() {
  return {
    products: [{ id: 'ITEM-A100', sku: 'A100', name: 'Motor', currentStock: 4, safetyStock: 10, reorderPoint: 12 }],
    suppliers: [{ id: 'SUP-001', name: 'ABC Components' }],
    purchaseRequests: [{ pr: 'PR-1', sourceSku: 'A100', status: '待审批', quantity: 5 }],
    rfqs: [{ id: 'RFQ-1', title: 'A100 RFQ', status: '进行中', suppliers: 2, quoted: 1 }],
    purchaseOrders: [{ po: 'PO-1', sourceSku: 'A100', supplier: 'ABC Components', status: '已发出' }],
    receivingDocs: [{ grn: 'GRN-1', po: 'PO-1', status: '质检中' }],
    inventoryMovements: [{ id: 'IM-1', sku: 'A100', quantity: -1, status: '待复核' }],
    auditLog: [],
  }
}

test('persistence mode defaults to json and unknown values fall back safely', () => {
  assert.equal(getPersistenceMode({}), 'json')
  assert.equal(getPersistenceMode({ FLOWCHAIN_PERSISTENCE_MODE: '' }), 'json')
  assert.equal(getPersistenceMode({ FLOWCHAIN_PERSISTENCE_MODE: 'json' }), 'json')
  assert.equal(getPersistenceMode({ FLOWCHAIN_PERSISTENCE_MODE: 'unknown' }), 'json')
  assert.equal(getPersistenceMode({ FLOWCHAIN_PERSISTENCE_MODE: 'database' }), 'database')
})

test('repository registry defaults to JSON without DATABASE_URL', () => {
  const db = createDb()
  const registry = createRepositoryRegistry({ db, env: {} })
  assert.equal(registry.mode, 'json')
  assert.deepEqual(Object.keys(registry), ['mode', 'masterData', 'inventoryRead', 'procurementRead', 'actionDrafts', 'auditLog', 'aiConversation'])
})

test('JSON repository registry exposes expected groups and delegates to current read models', () => {
  const db = createDb()
  const before = clone(db)
  const registry = createJsonRepositoryRegistry({ db })

  assert.equal(registry.masterData.listItems()[0].sku, 'A100')
  assert.equal(registry.masterData.getSupplier('SUP-001').name, 'ABC Components')
  assert.equal(registry.inventoryRead.getItem('A100').sku, 'A100')
  assert.equal(registry.inventoryRead.listMovements()[0].movementId, 'IM-1')
  assert.equal(registry.procurementRead.getDocument('po', 'PO-1').id, 'PO-1')
  assert.equal(registry.procurementRead.normalizeDocumentType('purchase-order'), 'po')
  assert.equal(registry.actionDrafts.getSchema().previewOnly, true)
  assert.equal(registry.aiConversation.implemented, false)
  assert.deepEqual(db, before)
})

test('action draft registry preview remains review-only and non-mutating', () => {
  const db = createDb()
  const before = clone(db)
  const registry = createRepositoryRegistry({ db, env: { FLOWCHAIN_PERSISTENCE_MODE: 'json' } })
  const result = registry.actionDrafts.previewDraft({
    type: 'purchase_request_draft',
    payload: { itemIdOrSku: 'A100' },
  }, { now: new Date('2026-06-30T00:00:00.000Z') })

  assert.equal(result.ok, true)
  assert.equal(result.draft.confirmationBoundary.previewOnly, true)
  assert.equal(result.draft.confirmationBoundary.submitted, false)
  assert.deepEqual(db, before)
})

test('audit log registry records only when explicitly called', () => {
  const db = createDb()
  const registry = createRepositoryRegistry({ db, env: {} })
  assert.deepEqual(registry.auditLog.listAuditEntries(), [])

  const record = registry.auditLog.recordAuditEntry({
    source: 'system',
    action: 'document_status_changed',
    module: 'test',
    entity: { type: 'contract', id: 'ADAPTER-REGISTRY' },
    summary: 'Adapter registry contract record',
  }, { now: new Date('2026-06-30T00:00:00.000Z') })

  assert.equal(record.entity.id, 'ADAPTER-REGISTRY')
  assert.equal(registry.auditLog.listAuditEntries().length, 1)
})

test('database mode placeholder only throws when explicitly selected', () => {
  assert.throws(
    () => createRepositoryRegistry({ db: createDb(), env: { FLOWCHAIN_PERSISTENCE_MODE: 'database' } }),
    /Database persistence adapter is not implemented yet/
  )
})
