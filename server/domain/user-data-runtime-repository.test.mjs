import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildNormalizedUserDataSnapshot,
  normalizeUserDataImportPayload,
} from './user-data-contract.mjs'
import { createInMemoryUserDataRuntimeRepository } from '../repositories/user-data-runtime-repository.mjs'

function payload(id = 'A') {
  return {
    sourceName: `repo-${id}`,
    tenantId: 'tenant-a',
    userId: 'user-a',
    purchaseOrders: [{ poId: `PO-IMPORT-${id}`, supplierName: `Supplier ${id}`, lines: [{ itemSku: `SKU-${id}`, quantity: '3' }] }],
    purchaseRequests: [{ prId: `PR-IMPORT-${id}`, itemSku: `SKU-${id}`, quantity: '3', requiredDate: '2026-07-10' }],
    products: [{ itemSku: `SKU-${id}`, itemName: `Item ${id}`, currentStock: '1', safetyStock: '4' }],
  }
}

test('R171 normalized user data snapshot is deterministic and scoped', () => {
  const first = normalizeUserDataImportPayload(payload('SNAP'), {
    importedAt: '2026-07-02T00:00:00.000Z',
    scope: { tenantId: 'tenant-a', userId: 'user-a' },
  })
  const second = normalizeUserDataImportPayload({
    userId: 'user-a',
    tenantId: 'tenant-a',
    products: [{ safetyStock: '4', currentStock: '1', itemName: 'Item SNAP', itemSku: 'SKU-SNAP' }],
    purchaseRequests: [{ requiredDate: '2026-07-10', quantity: '3', itemSku: 'SKU-SNAP', prId: 'PR-IMPORT-SNAP' }],
    purchaseOrders: [{ lines: [{ quantity: '3', itemSku: 'SKU-SNAP' }], supplierName: 'Supplier SNAP', poId: 'PO-IMPORT-SNAP' }],
    sourceName: 'repo-SNAP',
  }, {
    importedAt: '2026-07-02T00:00:00.000Z',
    scope: { tenantId: 'tenant-a', userId: 'user-a' },
  })

  assert.equal(first.normalizedSnapshot.normalizedSnapshotHash, second.normalizedSnapshot.normalizedSnapshotHash)
  assert.equal(first.normalizedSnapshot.scope.tenantId, 'tenant-a')
  assert.equal(first.normalizedSnapshot.scope.userId, 'user-a')
  assert.equal(first.normalizedSnapshot.validationSummary.ok, true)
  assert.equal(first.metadata.normalizedSnapshotHash, first.normalizedSnapshot.normalizedSnapshotHash)
})

test('R172 scoped repository persists active normalized records without global reads', async () => {
  const result = normalizeUserDataImportPayload(payload('A'), {
    scope: { tenantId: 'tenant-a', userId: 'user-a' },
  })
  const repository = createInMemoryUserDataRuntimeRepository()
  const batch = await repository.createImportBatch({
    scope: result.scope,
    datasetId: result.normalizedSnapshot.datasetId,
    snapshotHash: result.normalizedSnapshot.normalizedSnapshotHash,
    recordCounts: result.recordCounts,
    validationSummary: result.normalizedSnapshot.validationSummary,
  })
  const persisted = await repository.persistNormalizedRecords({
    scope: result.scope,
    datasetId: batch.datasetId,
    importBatchId: batch.importBatchId,
    normalizedSnapshot: result.normalizedSnapshot,
  })

  assert.equal(persisted.ok, true)
  assert.equal((await repository.getRecordsByType(result.scope, 'purchaseOrders'))[0].po, 'PO-IMPORT-A')
  assert.deepEqual(await repository.getRecordsByType({ tenantId: 'tenant-b', userId: 'user-a' }, 'purchaseOrders'), [])
  assert.deepEqual(await repository.getRecordsByType({ tenantId: 'tenant-a', userId: 'user-b' }, 'purchaseOrders'), [])
  const context = await repository.getAIReadableContext(result.scope)
  assert.equal(context.db.__dataMode, 'user')
  assert.equal(context.db.products[0].sku, 'SKU-A')
})

test('R172 repository deactivates only scoped active dataset', async () => {
  const repository = createInMemoryUserDataRuntimeRepository()
  const first = normalizeUserDataImportPayload(payload('ONE'), { scope: { tenantId: 'tenant-a', userId: 'user-a' } })
  const other = normalizeUserDataImportPayload(payload('OTHER'), { scope: { tenantId: 'tenant-a', userId: 'user-b' } })

  for (const result of [first, other]) {
    const batch = await repository.createImportBatch({
      scope: result.scope,
      datasetId: result.normalizedSnapshot.datasetId,
      snapshotHash: result.normalizedSnapshot.normalizedSnapshotHash,
      recordCounts: result.recordCounts,
    })
    await repository.persistNormalizedRecords({
      scope: result.scope,
      datasetId: batch.datasetId,
      importBatchId: batch.importBatchId,
      normalizedSnapshot: result.normalizedSnapshot,
    })
  }

  const active = await repository.getActiveDataset(first.scope)
  const deactivated = await repository.markImportBatchInactive(first.scope, active.importBatchId)
  assert.equal(deactivated.active, false)
  assert.equal(await repository.getActiveDataset(first.scope), null)
  assert.equal((await repository.getActiveDataset(other.scope)).scope.userId, 'user-b')
})

test('R173 snapshot builder uses stable record key order', () => {
  const snapshot = buildNormalizedUserDataSnapshot({
    products: [{ name: 'Part', sku: 'SKU-ORDER', currentStock: 2 }],
    purchaseOrders: [{ supplier: 'Supplier', po: 'PO-ORDER' }],
  }, {
    scope: { tenantId: 'tenant-order', userId: 'user-order' },
    sourceName: 'order-test',
    ok: true,
  })

  assert.deepEqual(Object.keys(snapshot.normalizedRecords), [
    'inventoryExceptions',
    'inventoryMovements',
    'products',
    'purchaseOrders',
    'purchaseRequests',
    'receivingDocs',
    'rfqs',
    'supplierInvoices',
    'suppliers',
  ])
  assert.match(snapshot.normalizedSnapshotHash, /^[a-f0-9]{64}$/)
})
