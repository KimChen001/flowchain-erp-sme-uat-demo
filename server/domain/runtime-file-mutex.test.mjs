import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { tmpdir } from 'node:os'
import { createDurableProcurementRepository } from '../repositories/durable-procurement-repository.mjs'
import { createDurableInventoryRepository } from '../repositories/durable-inventory-repository.mjs'
import { createDurableSupplierRepository } from '../repositories/durable-supplier-repository.mjs'
import { createDurableItemMasterRepository } from '../repositories/durable-item-master-repository.mjs'
import { createDurableCustomerRepository } from '../repositories/durable-customer-repository.mjs'
import { createDurableSalesOrderRepository } from '../repositories/durable-sales-order-repository.mjs'
import { createSettingsRuntimeRepository } from '../repositories/settings-runtime-repository.mjs'

async function runtimeDocument(file) {
  return JSON.parse(await readFile(file, 'utf8'))
}

function assertRuntimeMetadata(document, revision, schemaVersion = 1) {
  assert.equal(document.revision, revision)
  assert.equal(document.schemaVersion, schemaVersion)
  assert.ok(document.updatedAt)
}

test('procurement JSON transactions serialize concurrent writes and advance revision', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flowchain-mutex-'))
  try {
    const file = join(directory, 'procurement.json')
    const repository = createDurableProcurementRepository({ dataFile: file })
    const sameFileRepository = createDurableProcurementRepository({ dataFile: relative(process.cwd(), file) })
    await Promise.all(Array.from({ length: 8 }, (_, index) => (index % 2 ? repository : sameFileRepository).transact(document => {
      document.workItems.push({ id: `W-${index}` })
    })))
    const snapshot = await createDurableProcurementRepository({ dataFile: file }).snapshot()
    assert.equal(snapshot.workItems.length, 8)
    assertRuntimeMetadata(snapshot, 8, 2)

    const failed = repository.transact(document => { document.workItems.push({ id: 'MUST-NOT-PERSIST' }); throw new Error('expected failure') })
    const queued = sameFileRepository.transact(document => { document.workItems.push({ id: 'AFTER-FAILURE' }) })
    await assert.rejects(failed, /expected failure/)
    await queued
    const afterFailure = await createDurableProcurementRepository({ dataFile: file }).snapshot()
    assert.equal(afterFailure.workItems.length, 9)
    assert.equal(afterFailure.workItems.some(row => row.id === 'MUST-NOT-PERSIST'), false)
    assert.equal(afterFailure.workItems.some(row => row.id === 'AFTER-FAILURE'), true)
    assertRuntimeMetadata(afterFailure, 9, 2)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('inventory serializes eight balance adjustments and preserves them after restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flowchain-inventory-mutex-'))
  try {
    const file = join(directory, 'inventory.json')
    const repository = createDurableInventoryRepository({ dataFile: file })
    await Promise.all(Array.from({ length: 8 }, (_, index) => repository.applyBalanceAdjustment({ sku: 'SKU-MUTEX', warehouse: 'WH-1', bin: 'A-1', quantity: index + 1 }, 'tester')))
    const document = await runtimeDocument(file)
    assert.equal(document.movements.length, 8)
    assertRuntimeMetadata(document, 8)
    const restarted = createDurableInventoryRepository({ dataFile: file })
    assert.equal((await restarted.listMovements({})).length, 8)
    assert.equal((await restarted.getItem('SKU-MUTEX')).onHandQuantity, 8)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('supplier serializes eight creates without losing audit or runtime metadata', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flowchain-supplier-mutex-'))
  try {
    const file = join(directory, 'suppliers.json')
    const repository = createDurableSupplierRepository({ dataFile: file })
    await Promise.all(Array.from({ length: 8 }, (_, index) => repository.createSupplier({ supplierCode: `SUP-M${index}`, supplierName: `Supplier ${index}`, status: 'active' }, 'tester')))
    const document = await runtimeDocument(file)
    assert.equal(document.suppliers.length, 8)
    assert.equal(document.auditEvents.length, 8)
    assertRuntimeMetadata(document, 8)
    assert.equal((await createDurableSupplierRepository({ dataFile: file }).listSuppliers()).length, 8)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('item master serializes eight creates and survives repository restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flowchain-item-mutex-'))
  try {
    const file = join(directory, 'items.json')
    const repository = createDurableItemMasterRepository({ dataFile: file })
    await Promise.all(Array.from({ length: 8 }, (_, index) => repository.createItem({ sku: `SKU-M${index}`, itemName: `Item ${index}`, baseUnit: '件' }, 'tester')))
    const document = await runtimeDocument(file)
    assert.equal(document.items.length, 8)
    assertRuntimeMetadata(document, 8)
    assert.equal((await createDurableItemMasterRepository({ dataFile: file }).listItems()).length, 8)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('customer serializes eight creates with audit entries and restart completeness', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flowchain-customer-mutex-'))
  try {
    const file = join(directory, 'customers.json')
    const repository = createDurableCustomerRepository({ dataFile: file })
    await Promise.all(Array.from({ length: 8 }, (_, index) => repository.createCustomer({ code: `CUS-M${index}`, name: `Customer ${index}`, status: 'active' }, 'tester')))
    const document = await runtimeDocument(file)
    assert.equal(document.customers.length, 8)
    assert.equal(document.auditEvents.length, 8)
    assertRuntimeMetadata(document, 8)
    assert.equal((await createDurableCustomerRepository({ dataFile: file }).listCustomers()).length, 8)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('sales order serializes eight upserts and survives repository restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flowchain-sales-mutex-'))
  try {
    const file = join(directory, 'sales.json')
    const repository = createDurableSalesOrderRepository({ dataFile: file })
    await Promise.all(Array.from({ length: 8 }, (_, index) => repository.upsertOrder({ salesOrderId: `SO-M${index}`, customerName: `Customer ${index}`, sku: `SKU-M${index}`, orderedQty: index + 1 })))
    const document = await runtimeDocument(file)
    assert.equal(document.orders.length, 8)
    assertRuntimeMetadata(document, 8)
    assert.equal((await createDurableSalesOrderRepository({ dataFile: file }).listOrders()).length, 8)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('settings runtime serializes writes across repository instances', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flowchain-settings-mutex-'))
  try {
    const file = join(directory, 'settings.json')
    const first = createSettingsRuntimeRepository({ dataFile: file })
    const second = createSettingsRuntimeRepository({ dataFile: relative(process.cwd(), file) })
    const settings = await first.getSettingsRuntime()
    const updates = [...Object.entries(settings), ['advanced', { ...settings.advanced, exportLimit: settings.advanced.exportLimit + 1 }]]
    await Promise.all(updates.map(([section, value], index) => (index % 2 ? first : second).updateSettingsSection(section, value, { id: `USR-${index}`, name: `User ${index}`, role: '管理员' })))
    const document = await runtimeDocument(file)
    assert.equal(document.auditEntries.length, 8)
    assertRuntimeMetadata(document, 8)
    assert.equal((await createSettingsRuntimeRepository({ dataFile: file }).listSettingsAuditEntries()).length, 8)
  } finally { await rm(directory, { recursive: true, force: true }) }
})
