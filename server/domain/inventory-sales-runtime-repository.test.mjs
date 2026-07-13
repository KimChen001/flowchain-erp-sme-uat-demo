import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createDurableInventoryRepository } from '../repositories/durable-inventory-repository.mjs'
import { createDurableSalesOrderRepository } from '../repositories/durable-sales-order-repository.mjs'

test('inventory runtime initializes empty and persists only explicit records', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flowchain-inventory-'))
  try {
    const file = join(directory, 'inventory.json'), repository = createDurableInventoryRepository({ dataFile: file })
    assert.deepEqual(await repository.listItems({}), [])
    await repository.upsertItem({ itemId: 'ITEM-RUNTIME', sku: 'SKU-RUNTIME', itemName: 'Runtime item', availableQuantity: 3, reorderPoint: 10 })
    assert.equal((await repository.listItems({}))[0].sku, 'SKU-RUNTIME')
    assert.equal((await repository.getSummary()).lowStockCount, 1)
    assert.doesNotMatch(await readFile(file, 'utf8'), /SKU-00412/)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('sales runtime initializes empty and restores deep-link detail from disk', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flowchain-sales-'))
  try {
    const file = join(directory, 'sales.json'), repository = createDurableSalesOrderRepository({ dataFile: file })
    assert.deepEqual(await repository.listOrders(), [])
    await repository.upsertOrder({ salesOrderId: 'SO-RUNTIME', customerName: 'Runtime customer', sku: 'SKU-RUNTIME', orderedQty: 8, reservedQty: 3 })
    const reloaded = createDurableSalesOrderRepository({ dataFile: file })
    assert.equal((await reloaded.getOrder('SO-RUNTIME')).shortageQty, 5)
    assert.equal((await reloaded.getSummary()).totalOrders, 1)
    assert.doesNotMatch(await readFile(file, 'utf8'), /SO-2026-0412-A/)
  } finally { await rm(directory, { recursive: true, force: true }) }
})
