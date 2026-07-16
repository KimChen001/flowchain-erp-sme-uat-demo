import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createJsonMasterDataRepository } from '../repositories/json-master-data-repository.mjs'
import { createDurableInventoryRepository } from '../repositories/durable-inventory-repository.mjs'
import { createDurableProcurementRepository } from '../repositories/durable-procurement-repository.mjs'
import { handleImportPersistenceRoute } from '../routes/import-persistence.routes.mjs'
import { listImportAuditEvents, listImportBatches } from '../repositories/import-persistence-repository.mjs'

function setup(directory) {
  return {
    masterData: createJsonMasterDataRepository({}, { itemDataFile: join(directory, 'items.json'), supplierDataFile: join(directory, 'suppliers.json'), customerDataFile: join(directory, 'customers.json') }),
    inventoryRuntime: createDurableInventoryRepository({ dataFile: join(directory, 'inventory.json') }),
    procurementRuntime: createDurableProcurementRepository({ dataFile: join(directory, 'procurement.json') }),
  }
}

async function call(repositories, method, path, body) {
  let response
  const ctx = { req: { method, headers: {} }, res: {}, url: new URL(path, 'http://localhost'), db: { users: [] }, repositories, identity: { authenticated: true, userId: 'import-manager', name: 'Import Manager', role: 'manager' }, readBody: async () => body || {}, send(_res, status, payload) { response = { status, payload } } }
  assert.equal(await handleImportPersistenceRoute(ctx), true)
  return response
}

async function previewAndCommit(repositories, schemaId, rows, key) {
  const preview = await call(repositories, 'POST', '/api/imports/preview', { businessObject: schemaId, rows, validationErrors: [], validationWarnings: [] })
  assert.equal(preview.status, 200)
  const committed = await call(repositories, 'POST', `/api/imports/${preview.payload.previewId}/commit`, { businessObject: schemaId, snapshotHash: preview.payload.snapshotHash, idempotencyKey: key, userConfirmation: true })
  return { preview, committed }
}

test('connected formal imports persist to durable repositories and replay safely', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flowchain-durable-import-'))
  try {
    const repositories = setup(directory)
    const { committed: supplier } = await previewAndCommit(repositories, 'supplier-master', [{ code: 'SUP-IMPORT', name: 'Imported Supplier', category: 'parts', contact: 'Owner', email: 'owner@example.com', currency: 'CNY', status: 'active' }], 'supplier-import-1')
    assert.equal(supplier.status, 201)
    assert.deepEqual(supplier.payload.targetRepositories, ['supplier-master-runtime'])
    assert.equal((await repositories.masterData.getSupplier('SUP-IMPORT')).supplierName, 'Imported Supplier')

    const { committed: item } = await previewAndCommit(repositories, 'item-master', [{ sku: 'SKU-IMPORT', name: 'Imported Item', category: 'parts', unit: '件', defaultWarehouse: 'WH-1', safetyStock: 2, status: 'active' }], 'item-import-1')
    assert.equal(item.status, 201)
    assert.equal((await repositories.masterData.getManagedItem('SKU-IMPORT')).itemName, 'Imported Item')

    const { committed: customer } = await previewAndCommit(repositories, 'customer-master', [{ code: 'CUS-IMPORT', name: 'Imported Customer', contact: 'Buyer', email: 'buyer@example.com', currency: 'CNY', status: 'active' }], 'customer-import-1')
    assert.equal(customer.status, 201)
    assert.equal((await repositories.masterData.getCustomer('CUS-IMPORT')).name, 'Imported Customer')

    const { preview: inventoryPreview, committed: inventory } = await previewAndCommit(repositories, 'inventory-balance', [{ sku: 'SKU-IMPORT', warehouse: 'WH-1', bin: 'A-01', quantity: 12, asOfDate: '2026-07-14', status: 'available' }], 'inventory-import-1')
    assert.equal(inventory.status, 201)
    const document = JSON.parse(await readFile(join(directory, 'inventory.json'), 'utf8'))
    assert.equal(document.items[0].onHandQuantity, 12)
    assert.equal(document.movements[0].resultingQuantity, 12)
    assert.equal(document.auditEvents[0].action, 'inventory_balance_imported')

    const replay = await call(repositories, 'POST', `/api/imports/${inventoryPreview.payload.previewId}/commit`, { businessObject: 'inventory-balance', snapshotHash: inventoryPreview.payload.snapshotHash, idempotencyKey: 'inventory-import-1', userConfirmation: true })
    assert.equal(replay.status, 200)
    assert.equal(replay.payload.replayed, true)
    const afterReplay = JSON.parse(await readFile(join(directory, 'inventory.json'), 'utf8'))
    assert.equal(afterReplay.movements.length, 1)
    const restarted = setup(directory)
    assert.equal((await restarted.inventoryRuntime.getItem('SKU-IMPORT')).onHandQuantity, 12)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('purchase request import remains preview-only and cannot claim a committed batch', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flowchain-pr-import-preview-'))
  try {
    const repositories = setup(directory)
    const { committed: result } = await previewAndCommit(repositories, 'purchase-request', [{ pr: 'PR-IMPORT', sourceSku: 'OTHER', quantity: 1, unit: '件', requiredDate: '2026-08-01', priority: '中', status: 'draft' }], 'pr-import-disabled')
    assert.equal(result.status, 501)
    assert.equal(result.payload.code, 'PURCHASE_REQUEST_IMPORT_NOT_CONNECTED')
    assert.equal((await repositories.procurementRuntime.snapshot()).purchaseRequests.length, 0)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('atomic import failure reports row two, commits zero rows, and does not reserve idempotency success', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flowchain-import-route-atomic-fail-'))
  try {
    const repositories = setup(directory)
    const preview = await call(repositories, 'POST', '/api/imports/preview', {
      businessObject: 'supplier-master',
      rows: [1, 2, 3].map(index => ({ code: `SUP-ATOMIC-${index}`, name: `Atomic Supplier ${index}`, category: 'parts', contact: 'Owner', email: `atomic-${index}@example.com`, currency: 'CNY', status: 'active' })),
      validationErrors: [], validationWarnings: [],
    })
    const batchesBefore = listImportBatches().length
    const auditsBefore = listImportAuditEvents().length
    const apply = repositories.masterData.applySupplierImportBatch
    repositories.masterData.applySupplierImportBatch = (rows, actor, metadata) => apply(rows.map((row, index) => index === 1 ? { ...row, email: 'invalid-email' } : row), actor, metadata)
    const input = { businessObject: 'supplier-master', snapshotHash: preview.payload.snapshotHash, idempotencyKey: `atomic-route-${directory}`, userConfirmation: true }
    const failed = await call(repositories, 'POST', `/api/imports/${preview.payload.previewId}/commit`, input)
    assert.equal(failed.status, 422)
    assert.equal(failed.payload.code, 'IMPORT_BATCH_ATOMIC_COMMIT_FAILED')
    assert.equal(failed.payload.failedRowNumber, 2)
    assert.equal(failed.payload.committedRows, 0)
    await assert.rejects(() => readFile(join(directory, 'suppliers.json'), 'utf8'), error => error.code === 'ENOENT')
    assert.equal(listImportBatches().length, batchesBefore)
    assert.equal(listImportAuditEvents().length, auditsBefore)

    repositories.masterData.applySupplierImportBatch = apply
    const retry = await call(repositories, 'POST', `/api/imports/${preview.payload.previewId}/commit`, input)
    assert.equal(retry.status, 201)
    assert.equal(retry.payload.atomic, true)
    assert.equal(retry.payload.inserted, 3)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('durable supplier import rejects fake rollback without changing formal data or audit history', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flowchain-durable-rollback-'))
  try {
    const repositories = setup(directory)
    const { committed } = await previewAndCommit(repositories, 'supplier-master', [{ code: 'SUP-NO-ROLLBACK', name: 'Durable Supplier', category: 'parts', contact: 'Owner', email: 'durable@example.com', currency: 'CNY', status: 'active' }], `supplier-no-rollback-${directory}`)
    assert.equal(committed.status, 201)
    assert.equal(committed.payload.rollbackAvailable, false)
    const auditsBefore = listImportAuditEvents().length

    const rollback = await call(repositories, 'POST', `/api/import-batches/${committed.payload.importBatchId}/rollback`, { reason: 'must not fake rollback' })
    assert.equal(rollback.status, 409)
    assert.equal(rollback.payload.code, 'DURABLE_IMPORT_ROLLBACK_NOT_SUPPORTED')
    assert.equal(rollback.payload.rollbackAvailable, false)
    assert.equal((await repositories.masterData.getSupplier('SUP-NO-ROLLBACK')).supplierName, 'Durable Supplier')
    assert.equal(listImportAuditEvents().length, auditsBefore)
    assert.equal(listImportAuditEvents().some(event => event.action === 'import_batch_rolled_back' && event.entity.id === committed.payload.importBatchId), false)

    const batch = await call(repositories, 'GET', `/api/import-batches/${committed.payload.importBatchId}`)
    assert.equal(batch.status, 200)
    assert.equal(batch.payload.status, 'committed')
    assert.equal(batch.payload.rollbackAvailable, false)
    assert.equal(batch.payload.persistenceScope, 'process-memory-metadata')
    assert.deepEqual(batch.payload.targetRepositories, ['supplier-master-runtime'])
    assert.ok(batch.payload.limitations.length > 0)
  } finally { await rm(directory, { recursive: true, force: true }) }
})
