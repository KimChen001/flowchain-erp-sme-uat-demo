import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAiReadContext } from './ai-read-context.mjs'
import { createEmptyDataset } from './data-mode.mjs'
import { normalizeUserDataImportPayload } from './user-data-contract.mjs'
import { createInMemoryUserDataRuntimeRepository } from '../repositories/user-data-runtime-repository.mjs'
import { createAuditLogRepository } from '../repositories/audit-log-repository.mjs'
import { handleUserDataRoute } from '../routes/user-data.routes.mjs'

function payload(label, scope) {
  return {
    sourceName: `phase-r179-${label}`,
    ...scope,
    purchaseOrders: [{ poId: `PO-${label}`, supplierName: `Supplier ${label}`, lines: [{ itemSku: `SKU-${label}`, quantity: '5' }] }],
    purchaseRequests: [{ prId: `PR-${label}`, itemSku: `SKU-${label}`, quantity: '5', requiredDate: '2026-07-12' }],
    products: [{ itemSku: `SKU-${label}`, itemName: `Item ${label}`, currentStock: '1', safetyStock: '4' }],
  }
}

async function persist(repository, result) {
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
  return batch
}

function routeContext({ body, repository, db = createEmptyDataset({ mode: 'user' }) }) {
  let response = null
  return {
    ctx: {
      req: { method: 'POST', body, headers: {} },
      res: {},
      url: new URL('/api/user-data/import/deactivate', 'http://localhost'),
      db,
      repositories: {
        userDataRuntime: repository,
        auditLog: createAuditLogRepository(db),
      },
      readBody: async (req) => req.body,
      send(_res, status, payload) {
        response = { status, payload }
      },
    },
    get response() {
      return response
    },
  }
}

async function withDeactivateFlag(fn) {
  const previous = process.env.FLOWCHAIN_ENABLE_USER_IMPORT_COMMIT
  process.env.FLOWCHAIN_ENABLE_USER_IMPORT_COMMIT = 'true'
  try {
    await fn()
  } finally {
    if (previous === undefined) delete process.env.FLOWCHAIN_ENABLE_USER_IMPORT_COMMIT
    else process.env.FLOWCHAIN_ENABLE_USER_IMPORT_COMMIT = previous
  }
}

test('R179 tenant and user scopes isolate repository reads and AI context', async () => {
  const repository = createInMemoryUserDataRuntimeRepository()
  const tenantAUserA = normalizeUserDataImportPayload(payload('A1', { tenantId: 'tenant-a', userId: 'user-a' }), { scope: { tenantId: 'tenant-a', userId: 'user-a' } })
  const tenantAUserB = normalizeUserDataImportPayload(payload('A2', { tenantId: 'tenant-a', userId: 'user-b' }), { scope: { tenantId: 'tenant-a', userId: 'user-b' } })
  const tenantBUserA = normalizeUserDataImportPayload(payload('B1', { tenantId: 'tenant-b', userId: 'user-a' }), { scope: { tenantId: 'tenant-b', userId: 'user-a' } })
  await persist(repository, tenantAUserA)
  await persist(repository, tenantAUserB)
  await persist(repository, tenantBUserA)

  assert.equal((await repository.getRecordsByType({ tenantId: 'tenant-a', userId: 'user-a' }, 'purchaseOrders'))[0].po, 'PO-A1')
  assert.equal((await repository.getRecordsByType({ tenantId: 'tenant-a', userId: 'user-b' }, 'purchaseOrders'))[0].po, 'PO-A2')
  assert.equal((await repository.getRecordsByType({ tenantId: 'tenant-b', userId: 'user-a' }, 'purchaseOrders'))[0].po, 'PO-B1')

  const context = await buildAiReadContext(createEmptyDataset({ mode: 'user' }), {
    dataMode: 'user',
    userDataScope: { tenantId: 'tenant-a', userId: 'user-a' },
    repositories: { userDataRuntime: repository },
  })
  assert.equal(context.db.purchaseOrders[0].po, 'PO-A1')
  assert.doesNotMatch(JSON.stringify(context.db), /PO-A2|PO-B1/)
})

test('R180 deactivate requires confirmation and scoped import batch', async () => {
  await withDeactivateFlag(async () => {
    const repository = createInMemoryUserDataRuntimeRepository()
    const result = normalizeUserDataImportPayload(payload('ROLL', { tenantId: 'tenant-r180', userId: 'user-r180' }), { scope: { tenantId: 'tenant-r180', userId: 'user-r180' } })
    const batch = await persist(repository, result)

    const missingConfirmation = routeContext({
      repository,
      body: { scope: result.scope, importBatchId: batch.importBatchId },
    })
    assert.equal(await handleUserDataRoute(missingConfirmation.ctx), true)
    assert.equal(missingConfirmation.response.status, 422)
    assert.equal(missingConfirmation.response.payload.errors[0].code, 'missing_confirmation')
    assert.equal((await repository.getActiveDataset(result.scope)).active, true)

    const wrongScope = routeContext({
      repository,
      body: { scope: { tenantId: 'tenant-r180', userId: 'other-user' }, importBatchId: batch.importBatchId, confirmDeactivate: true },
    })
    assert.equal(await handleUserDataRoute(wrongScope.ctx), true)
    assert.equal(wrongScope.response.status, 404)
    assert.equal((await repository.getActiveDataset(result.scope)).active, true)
  })
})

test('R180 successful deactivate is non-destructive and ignored by AI read context', async () => {
  await withDeactivateFlag(async () => {
    const db = createEmptyDataset({ mode: 'user' })
    const repository = createInMemoryUserDataRuntimeRepository()
    const result = normalizeUserDataImportPayload(payload('DONE', { tenantId: 'tenant-r180', userId: 'user-r180' }), { scope: { tenantId: 'tenant-r180', userId: 'user-r180' } })
    const batch = await persist(repository, result)
    const before = JSON.stringify({ ...db, auditLog: [] })
    const route = routeContext({
      db,
      repository,
      body: { scope: result.scope, importBatchId: batch.importBatchId, confirmDeactivate: true },
    })

    assert.equal(await handleUserDataRoute(route.ctx), true)
    assert.equal(route.response.status, 200)
    assert.equal(route.response.payload.deactivated, true)
    assert.equal(route.response.payload.status, 'inactive')
    assert.equal(route.response.payload.writesFiles, false)
    assert.equal(route.response.payload.overwritesDemoData, false)
    assert.equal(JSON.stringify({ ...db, auditLog: [] }), before)
    assert.equal(db.auditLog[0].action, 'user_import_deactivated')

    const state = repository._debugState()
    assert.equal(state.datasets[0].active, false)
    assert.equal(state.datasets[0].records.purchaseOrders[0].po, 'PO-DONE')
    const context = await buildAiReadContext(createEmptyDataset({ mode: 'user' }), {
      dataMode: 'user',
      userDataScope: result.scope,
      repositories: { userDataRuntime: repository },
    })
    assert.equal(context.userDataRuntime.active, false)
    assert.equal(context.db.purchaseOrders.length, 0)
  })
})
