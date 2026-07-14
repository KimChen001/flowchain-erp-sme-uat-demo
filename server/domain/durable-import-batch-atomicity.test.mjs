import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDurableSupplierRepository, emptySupplierRuntime } from '../repositories/durable-supplier-repository.mjs'
import { createDurableItemMasterRepository } from '../repositories/durable-item-master-repository.mjs'
import { createDurableCustomerRepository, emptyCustomerRuntime } from '../repositories/durable-customer-repository.mjs'
import { createDurableInventoryRepository, emptyInventoryRuntime } from '../repositories/durable-inventory-repository.mjs'

const metadata = { importBatchId: 'IMP-ATOMIC-001', previewId: 'IPV-ATOMIC-001', snapshotHash: 'sha256:atomic' }
const fixedUpdatedAt = '2026-07-14T00:00:00.000Z'
const digest = value => createHash('sha256').update(value).digest('hex')

async function seed(file, document) {
  await writeFile(file, JSON.stringify({ ...document, revision: 7, updatedAt: fixedUpdatedAt }, null, 2), 'utf8')
}

async function unchanged(file, before) {
  const after = await readFile(file, 'utf8')
  assert.equal(digest(after), digest(before))
  assert.equal(after, before)
  const document = JSON.parse(after)
  assert.equal(document.revision, 7)
  assert.equal(document.updatedAt, fixedUpdatedAt)
  return document
}

test('each durable import repository discards the entire three-row batch when row two fails', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'flowchain-import-atomic-fail-'))
  t.after(() => rm(directory, { recursive: true, force: true }))

  const supplierFile = join(directory, 'suppliers.json')
  await seed(supplierFile, emptySupplierRuntime())
  const supplierBefore = await readFile(supplierFile, 'utf8')
  const suppliers = createDurableSupplierRepository({ dataFile: supplierFile })
  await assert.rejects(
    () => suppliers.applyImportBatch([
      { supplierCode: 'SUP-1', supplierName: 'Supplier 1', email: 'one@example.com', status: 'active' },
      { supplierCode: 'SUP-2', supplierName: 'Supplier 2', email: 'invalid-email', status: 'active' },
      { supplierCode: 'SUP-3', supplierName: 'Supplier 3', email: 'three@example.com', status: 'active' },
    ], 'import-manager', metadata),
    error => error.code === 'SUPPLIER_EMAIL_INVALID' && error.failedRowNumber === 2,
  )
  const supplierDocument = await unchanged(supplierFile, supplierBefore)
  assert.equal(supplierDocument.suppliers.length, 0)
  assert.equal(supplierDocument.auditEvents.length, 0)

  const itemFile = join(directory, 'items.json')
  await seed(itemFile, { schemaVersion: 1, items: [] })
  const itemBefore = await readFile(itemFile, 'utf8')
  const items = createDurableItemMasterRepository({ dataFile: itemFile })
  await assert.rejects(
    () => items.applyImportBatch([
      { sku: 'SKU-1', itemName: 'Item 1', baseUnit: '件' },
      { sku: '', itemName: 'Item 2', baseUnit: '件' },
      { sku: 'SKU-3', itemName: 'Item 3', baseUnit: '件' },
    ], 'import-manager', metadata),
    error => error.code === 'VALIDATION_ERROR' && error.failedRowNumber === 2,
  )
  assert.equal((await unchanged(itemFile, itemBefore)).items.length, 0)

  const customerFile = join(directory, 'customers.json')
  await seed(customerFile, emptyCustomerRuntime())
  const customerBefore = await readFile(customerFile, 'utf8')
  const customers = createDurableCustomerRepository({ dataFile: customerFile })
  await assert.rejects(
    () => customers.applyImportBatch([
      { code: 'CUS-1', name: 'Customer 1', email: 'one@example.com' },
      { code: 'CUS-2', name: 'Customer 2', email: 'invalid-email' },
      { code: 'CUS-3', name: 'Customer 3', email: 'three@example.com' },
    ], 'import-manager', metadata),
    error => error.code === 'CUSTOMER_EMAIL_INVALID' && error.failedRowNumber === 2,
  )
  const customerDocument = await unchanged(customerFile, customerBefore)
  assert.equal(customerDocument.customers.length, 0)
  assert.equal(customerDocument.auditEvents.length, 0)

  const inventoryFile = join(directory, 'inventory.json')
  await seed(inventoryFile, emptyInventoryRuntime())
  const inventoryBefore = await readFile(inventoryFile, 'utf8')
  const inventory = createDurableInventoryRepository({ dataFile: inventoryFile })
  await assert.rejects(
    () => inventory.applyImportBatch([
      { sku: 'SKU-1', warehouse: 'WH-1', quantity: 4 },
      { sku: 'SKU-2', warehouse: 'WH-1', quantity: 'not-a-number' },
      { sku: 'SKU-3', warehouse: 'WH-1', quantity: 6 },
    ], 'import-manager', metadata),
    error => error.code === 'INVENTORY_QUANTITY_INVALID' && error.failedRowNumber === 2,
  )
  const inventoryDocument = await unchanged(inventoryFile, inventoryBefore)
  assert.equal(inventoryDocument.items.length, 0)
  assert.equal(inventoryDocument.movements.length, 0)
  assert.equal(inventoryDocument.auditEvents.length, 0)
})

test('successful three-row batches write once, carry trace metadata, and survive repository restart', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'flowchain-import-atomic-success-'))
  t.after(() => rm(directory, { recursive: true, force: true }))

  const supplierFile = join(directory, 'suppliers.json')
  await seed(supplierFile, emptySupplierRuntime())
  const suppliers = createDurableSupplierRepository({ dataFile: supplierFile })
  const supplierChanges = await suppliers.applyImportBatch([1, 2, 3].map(index => ({ supplierCode: `SUP-${index}`, supplierName: `Supplier ${index}`, email: `supplier-${index}@example.com`, status: 'active' })), 'import-manager', metadata)
  assert.equal(supplierChanges.length, 3)
  const supplierDocument = JSON.parse(await readFile(supplierFile, 'utf8'))
  assert.equal(supplierDocument.revision, 8)
  assert.ok(supplierDocument.suppliers.every(row => row.importBatchId === metadata.importBatchId && row.previewId === metadata.previewId))
  assert.equal((await createDurableSupplierRepository({ dataFile: supplierFile }).listSuppliers()).length, 3)

  const itemFile = join(directory, 'items.json')
  await seed(itemFile, { schemaVersion: 1, items: [] })
  const items = createDurableItemMasterRepository({ dataFile: itemFile })
  await items.applyImportBatch([1, 2, 3].map(index => ({ sku: `SKU-${index}`, itemName: `Item ${index}`, baseUnit: '件' })), 'import-manager', metadata)
  const itemDocument = JSON.parse(await readFile(itemFile, 'utf8'))
  assert.equal(itemDocument.revision, 8)
  assert.ok(itemDocument.items.every(row => row.importBatchId === metadata.importBatchId && row.snapshotHash === metadata.snapshotHash))
  assert.equal((await createDurableItemMasterRepository({ dataFile: itemFile }).listItems()).length, 3)

  const customerFile = join(directory, 'customers.json')
  await seed(customerFile, emptyCustomerRuntime())
  const customers = createDurableCustomerRepository({ dataFile: customerFile })
  await customers.applyImportBatch([1, 2, 3].map(index => ({ code: `CUS-${index}`, name: `Customer ${index}`, email: `customer-${index}@example.com` })), 'import-manager', metadata)
  const customerDocument = JSON.parse(await readFile(customerFile, 'utf8'))
  assert.equal(customerDocument.revision, 8)
  assert.ok(customerDocument.customers.every(row => row.importBatchId === metadata.importBatchId && row.previewId === metadata.previewId))
  assert.equal((await createDurableCustomerRepository({ dataFile: customerFile }).listCustomers()).length, 3)

  const inventoryFile = join(directory, 'inventory.json')
  await seed(inventoryFile, emptyInventoryRuntime())
  const inventory = createDurableInventoryRepository({ dataFile: inventoryFile })
  await inventory.applyImportBatch([1, 2, 3].map(index => ({ sku: `INV-${index}`, warehouse: 'WH-1', quantity: index })), 'import-manager', metadata)
  const inventoryDocument = JSON.parse(await readFile(inventoryFile, 'utf8'))
  assert.equal(inventoryDocument.revision, 8)
  assert.equal(inventoryDocument.items.length, 3)
  assert.equal(inventoryDocument.movements.length, 3)
  assert.equal(inventoryDocument.auditEvents.length, 3)
  assert.ok(inventoryDocument.items.every(row => row.importBatchId === metadata.importBatchId))
  assert.ok(inventoryDocument.movements.every(row => row.previewId === metadata.previewId))
  assert.ok(inventoryDocument.auditEvents.every(row => row.metadata.snapshotHash === metadata.snapshotHash))
  assert.equal((await createDurableInventoryRepository({ dataFile: inventoryFile }).listItems()).length, 3)
})
