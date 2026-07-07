import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAiReadContext } from './ai-read-context.mjs'
import { buildAiCompoundQueryResponse } from './ai-compound-query.mjs'
import { createEmptyDataset } from './data-mode.mjs'
import { normalizeUserDataImportPayload } from './user-data-contract.mjs'
import { createUserDataRuntimeDb } from './user-data-runtime.mjs'
import { createInMemoryUserDataRuntimeRepository } from '../repositories/user-data-runtime-repository.mjs'

function payload() {
  return {
    sourceName: 'phase-r177-import',
    tenantId: 'tenant-r177',
    userId: 'user-r177',
    purchaseOrders: [
      { poId: 'PO-R177-1', supplierName: 'R177 Supplier', status: '已发出', received: '2', lines: [{ itemSku: 'SKU-R177-1', quantity: '10', received: '2' }] },
    ],
    purchaseRequests: [
      { prId: 'PR-R177-1', itemSku: 'SKU-R177-1', supplierName: 'R177 Supplier', quantity: '10', requiredDate: '2026-07-12' },
    ],
    products: [
      { itemSku: 'SKU-R177-1', itemName: 'R177 Item', currentStock: '1', safetyStock: '6', reorderPoint: '8', riskLevel: '高' },
    ],
    suppliers: [
      { supplierId: 'SUP-R177-1', supplierName: 'R177 Supplier', risk: '高', riskStatus: '高风险' },
    ],
    receivingDocs: [
      { grnId: 'GRN-R177-1', poId: 'PO-R177-1', supplierName: 'R177 Supplier', status: '异常处理', items: '2' },
    ],
    supplierInvoices: [
      { invoiceNumber: 'INV-R177-1', poId: 'PO-R177-1', grnId: 'GRN-R177-1', supplierName: 'R177 Supplier', amount: '1000', varianceAmount: '80' },
    ],
  }
}

async function persist(repository, result) {
  const batch = await repository.createImportBatch({
    scope: result.scope,
    datasetId: result.normalizedSnapshot.datasetId,
    snapshotHash: result.normalizedSnapshot.normalizedSnapshotHash,
    recordCounts: result.recordCounts,
    validationSummary: result.normalizedSnapshot.validationSummary,
  })
  await repository.persistNormalizedRecords({
    scope: result.scope,
    datasetId: batch.datasetId,
    importBatchId: batch.importBatchId,
    normalizedSnapshot: result.normalizedSnapshot,
  })
  return batch
}

function compoundSummary(db) {
  const response = buildAiCompoundQueryResponse(db, {
    question: '今天有什么需要我做的，订单还有多少没有收货，有哪些供应商会有潜在风险？',
  }, {
    ensurePurchaseRequests: (nextDb) => nextDb.purchaseRequests || [],
    ensureInventoryMovements: (nextDb) => nextDb.inventoryMovements || [],
    ensureRfqs: (nextDb) => nextDb.rfqs || [],
  })
  return {
    intent: response.intent.name,
    evidenceCount: response.evidence.length,
    actionCount: response.cards.flatMap((card) => card.actions || []).length,
    text: JSON.stringify(response),
  }
}

test('R177 AI read context loads active DB-backed user dataset by tenant user scope', async () => {
  const result = normalizeUserDataImportPayload(payload(), {
    scope: { tenantId: 'tenant-r177', userId: 'user-r177' },
  })
  const repository = createInMemoryUserDataRuntimeRepository()
  const batch = await persist(repository, result)

  const context = await buildAiReadContext(createEmptyDataset({ mode: 'user' }), {
    dataMode: 'user',
    userDataScope: { tenantId: 'tenant-r177', userId: 'user-r177' },
    repositories: { userDataRuntime: repository },
  })

  assert.equal(context.userDataRuntime.active, true)
  assert.equal(context.userDataRuntime.importBatchId, batch.importBatchId)
  assert.equal(context.db.__dataMode, 'user')
  assert.equal(context.db.purchaseOrders[0].po, 'PO-R177-1')
  assert.equal(context.db.products[0].sku, 'SKU-R177-1')
})

test('R177 missing active user dataset returns safe missing context without workspace fallback', async () => {
  const context = await buildAiReadContext(createEmptyDataset({ mode: 'user' }), {
    dataMode: 'user',
    userDataScope: { tenantId: 'tenant-r177', userId: 'missing-user' },
    repositories: { userDataRuntime: createInMemoryUserDataRuntimeRepository() },
  })

  assert.equal(context.userDataRuntime.active, false)
  assert.equal(context.userDataRuntime.reason, 'no_active_user_dataset')
  assert.equal(context.db.__dataMode, 'user')
  assert.equal(context.db.purchaseOrders.length, 0)
})

test('R178 compound query parity holds for runtime and DB-backed user data context', async () => {
  const result = normalizeUserDataImportPayload(payload(), {
    scope: { tenantId: 'tenant-r177', userId: 'user-r177' },
  })
  const runtimeDb = createUserDataRuntimeDb(result)
  const repository = createInMemoryUserDataRuntimeRepository()
  await persist(repository, result)
  const persistedContext = await buildAiReadContext(createEmptyDataset({ mode: 'user' }), {
    dataMode: 'user',
    userDataScope: result.scope,
    repositories: { userDataRuntime: repository },
  })

  const runtime = compoundSummary(runtimeDb)
  const persisted = compoundSummary(persistedContext.db)

  assert.equal(persisted.intent, runtime.intent)
  assert.equal(persisted.evidenceCount, runtime.evidenceCount)
  assert.equal(persisted.actionCount > 0, true)
  assert.equal(runtime.actionCount > 0, true)
  assert.match(persisted.text, /PO-R177-1|SKU-R177-1|R177 Supplier/)
  assert.match(runtime.text, /PO-R177-1|SKU-R177-1|R177 Supplier/)
  assert.doesNotMatch(persisted.text, /PO-2026-1282|SKU-00412|SUP-SZXY/)
})
