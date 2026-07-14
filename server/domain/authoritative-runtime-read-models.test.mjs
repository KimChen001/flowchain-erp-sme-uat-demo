import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createJsonMasterDataRepository } from '../repositories/json-master-data-repository.mjs'
import { createDurableInventoryRepository } from '../repositories/durable-inventory-repository.mjs'
import { createDurableSalesOrderRepository } from '../repositories/durable-sales-order-repository.mjs'
import { createDurableProcurementRepository } from '../repositories/durable-procurement-repository.mjs'
import { createBusinessReadContextService } from '../services/business-read-context-service.mjs'
import { buildRuntimeInventoryAllocation } from './runtime-inventory-allocation-read-model.mjs'
import { searchRuntimeBusinessContext } from './runtime-business-search.mjs'
import { buildRuntimeGovernedReport } from './runtime-report-read-model.mjs'
import { buildRuntimeEvidenceGraph } from './runtime-evidence-graph.mjs'
import { handleAiRoute } from '../routes/ai.routes.mjs'

function repositories(directory) {
  return {
    masterData: createJsonMasterDataRepository({}, { itemDataFile: join(directory, 'items.json'), supplierDataFile: join(directory, 'suppliers.json'), customerDataFile: join(directory, 'customers.json') }),
    inventoryRuntime: createDurableInventoryRepository({ dataFile: join(directory, 'inventory.json') }),
    salesOrders: createDurableSalesOrderRepository({ dataFile: join(directory, 'sales.json') }),
    procurementRuntime: createDurableProcurementRepository({ dataFile: join(directory, 'procurement.json') }),
  }
}

async function seed(repos) {
  const item = await repos.masterData.createItem({ itemId: 'ITEM-RUNTIME', sku: 'SKU-RUNTIME', itemName: 'Runtime Motor', status: 'active' }, 'tester')
  const supplier = await repos.masterData.createSupplier({ supplierCode: 'SUP-RUNTIME', supplierName: 'Runtime Supplier', status: 'active' }, 'tester')
  await repos.masterData.createItemSupplier(item.itemId, { supplierId: supplier.id, active: true, approved: true, preferred: true }, 'tester')
  await repos.inventoryRuntime.upsertItem({ itemId: item.itemId, sku: item.sku, itemName: item.itemName, onHandQuantity: 10, reservedQuantity: 2 })
  await repos.salesOrders.upsertOrder({ salesOrderId: 'SO-RUNTIME', customerName: 'Runtime Customer', itemId: item.itemId, sku: item.sku, orderedQty: 20, reservedQty: 2, fulfilledQty: 0 })
  await repos.procurementRuntime.transact(async document => {
    document.purchaseRequests.push({ id: 'PR-RUNTIME', status: 'approved', lines: [{ itemId: item.itemId, sku: item.sku, quantity: 5 }] })
    document.purchaseOrders.push(
      { id: 'PO-DRAFT-RUNTIME', sourcePrId: 'PR-RUNTIME', status: 'draft', supplierId: supplier.id, lines: [{ itemId: item.itemId, sku: item.sku, quantity: 100 }] },
      { id: 'PO-APPROVED-RUNTIME', sourcePrId: 'PR-RUNTIME', status: 'approved', supplierId: supplier.id, totalAmount: 500, lines: [{ itemId: item.itemId, sku: item.sku, quantity: 5 }] },
    )
  })
}

async function context(repos) { return await createBusinessReadContextService({ repositories: repos, dataMode: 'user' }).read() }

test('authoritative runtime keeps inventory, search, report and evidence semantics consistent after restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flowchain-runtime-read-models-'))
  try {
    const first = repositories(directory)
    await seed(first)
    const beforeRestart = await context(first)
    const model = buildRuntimeInventoryAllocation(beforeRestart)
    const availability = model.availability.find(row => row.sku === 'SKU-RUNTIME')
    assert.deepEqual({ onHand: availability.onHand, reserved: availability.reserved, available: availability.available, openSalesDemand: availability.openSalesDemand, incomingApprovedPo: availability.incomingApprovedPo, shortage: availability.shortage, availableToPromise: availability.availableToPromise }, { onHand: 10, reserved: 2, available: 8, openSalesDemand: 20, incomingApprovedPo: 5, shortage: 12, availableToPromise: -7 })
    assert.deepEqual(availability.purchaseOrderIds, ['PO-APPROVED-RUNTIME'])

    for (const [query, entityType] of [['Runtime Supplier', 'supplier'], ['Runtime Motor', 'item'], ['PR-RUNTIME', 'purchase_request'], ['PO-APPROVED-RUNTIME', 'purchase_order']]) {
      assert.equal(searchRuntimeBusinessContext(beforeRestart, query)[0]?.entityType, entityType)
    }
    assert.equal(searchRuntimeBusinessContext(beforeRestart, 'PO-2026-1282').length, 0)

    const report = buildRuntimeGovernedReport(beforeRestart, { subject: 'inventory' })
    assert.equal(report.kpis.find(row => row.id === 'inventory_risk_sku').currentValue, 1)
    assert.equal(report.details[0].shortage, availability.shortage)
    assert.ok(report.limitations.includes('warehouse_runtime_not_connected'))

    const graph = buildRuntimeEvidenceGraph(beforeRestart, { entityType: 'purchase_order', entityId: 'PO-APPROVED-RUNTIME' })
    assert.ok(graph.nodes.some(node => node.entityId === 'PR-RUNTIME'))
    assert.ok(graph.nodes.every(node => node.entityType && node.entityId && node.label && node.canonicalRoute && node.sourceRepository))

    let aiResponse
    await handleAiRoute({
      req: { method: 'POST', headers: {} }, res: {}, url: new URL('/api/ai/chat', 'http://localhost'), db: { __dataMode: 'user', products: [{ sku: 'GHOST-SKU' }], purchaseOrders: [{ po: 'PO-GHOST' }] }, dataMode: 'user', repositories: first,
      readBody: async () => ({ question: 'SKU-RUNTIME 库存怎么样？', moduleId: 'inventory' }), send(_res, status, payload) { aiResponse = { status, payload }; return true },
      writeDb: async () => {}, event: () => {}, ensurePurchaseRequests: db => db.purchaseRequests || [], ensureInventoryMovements: db => db.inventoryMovements || [], ensureRfqs: db => db.rfqs || [],
    })
    assert.equal(aiResponse.status, 200)
    assert.match(JSON.stringify(aiResponse.payload), /SKU-RUNTIME/)
    assert.doesNotMatch(JSON.stringify(aiResponse.payload), /GHOST-SKU|PO-GHOST/)

    const restartedContext = await context(repositories(directory))
    const restarted = buildRuntimeInventoryAllocation(restartedContext).availability.find(row => row.sku === 'SKU-RUNTIME')
    assert.deepEqual(restarted, availability)
    assert.equal(searchRuntimeBusinessContext(restartedContext, 'PO-APPROVED-RUNTIME').length, 1)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('empty authoritative runtime produces honest empty search, report and graph results', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flowchain-runtime-empty-'))
  try {
    const empty = await context(repositories(directory))
    assert.equal(searchRuntimeBusinessContext(empty, 'PO-2026-1282').length, 0)
    const report = buildRuntimeGovernedReport(empty, { subject: 'overview' })
    assert.equal(report.details.length, 0)
    assert.ok(report.kpis.every(metric => metric.currentValue === 0))
    assert.ok(report.limitations.length > 0)
    assert.ok(buildRuntimeEvidenceGraph(empty, { entityType: 'purchase_order', entityId: 'PO-2026-1282' }).dataLimitations.includes('record_not_found'))
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('runtime allocation reports missing quantities instead of manufacturing zero', () => {
  const model = buildRuntimeInventoryAllocation({ items: [{ sku: 'SKU-LIMITED' }], inventoryItems: [{ sku: 'SKU-LIMITED', onHandQuantity: 4 }], salesOrders: [], purchaseOrders: [], dataLimitations: [] })
  const row = model.availability[0]
  assert.equal(row.reserved, null)
  assert.equal(row.available, null)
  assert.equal(row.shortage, null)
  assert.ok(row.dataLimitations.includes('reserved_quantity_missing:SKU-LIMITED'))
})
