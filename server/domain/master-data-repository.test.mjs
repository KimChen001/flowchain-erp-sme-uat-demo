import test from 'node:test'
import assert from 'node:assert/strict'
import { createJsonMasterDataRepository } from '../repositories/json-master-data-repository.mjs'
import { createRepositoryRegistry } from '../repositories/adapter-registry.mjs'
import { handleMasterDataRoute } from '../routes/master-data.routes.mjs'
import { findMasterItem, listMasterItems, listMasterSuppliers } from './master-data.mjs'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function createDb() {
  return {
    products: [
      { sku: 'A100', name: 'Motor A100', category: 'Components', unit: 'pcs', supplier: 'ABC Components', leadTimeDays: 7, moq: 100 },
      { sku: 'B200', name: 'Bracket B200', defaultWarehouseId: 'WH-SECONDARY' },
    ],
    suppliers: [
      { id: 'SUP-001', name: 'ABC Components', category: 'Motors', onTimeRate: 91, qualityRate: 96, preferred: true },
    ],
    warehouses: [{ id: 'WH-EXPLICIT', name: 'Explicit Warehouse' }],
    paymentTerms: [{ id: 'NET45', label: 'Net 45', days: 45 }],
    taxCodes: [{ id: 'TAX-ZERO', label: 'Zero Tax', rate: 0 }],
    inventoryMovements: [{ warehouseId: 'WH-MOVEMENT' }],
  }
}

function createRouteContext(pathname, db = createDb(), repositories) {
  let response = null
  return {
    ctx: {
      req: { method: 'GET', headers: {} },
      res: {},
      url: new URL(pathname, 'http://localhost'),
      db,
      repositories,
      send(_res, status, payload) {
        response = { status, payload }
      },
    },
    get response() {
      return response
    },
  }
}

test('MasterDataRepository delegates to existing read model shapes without mutation', () => {
  const db = createDb()
  const before = clone(db)
  const repository = createJsonMasterDataRepository(db)

  assert.deepEqual(repository.listItems(), listMasterItems(db))
  assert.deepEqual(repository.getItem('A100'), findMasterItem(db, 'A100'))
  assert.deepEqual(repository.listSuppliers(), listMasterSuppliers(db))
  assert.equal(repository.getSupplier('SUP-001').name, 'ABC Components')
  assert.equal(repository.listWarehouses().some((item) => item.id === 'WH-MOVEMENT'), true)
  assert.equal(repository.listPaymentTerms()[0].id, 'NET45')
  assert.equal(repository.listTaxCodes()[0].id, 'TAX-ZERO')
  assert.equal(repository.getItem('missing'), null)
  assert.equal(repository.getSupplier('missing'), null)
  assert.deepEqual(db, before)
})

test('adapter registry exposes MasterDataRepository in default JSON mode', () => {
  const db = createDb()
  const registry = createRepositoryRegistry({ db, env: {} })

  assert.equal(registry.mode, 'json')
  assert.equal(registry.masterData.getItem('A100').id, 'ITEM-A100')
  assert.equal(registry.masterData.listSuppliers()[0].id, 'SUP-001')
})

test('master data route uses injected repository while preserving response shape', async () => {
  const db = createDb()
  const before = clone(db)
  const repositories = createRepositoryRegistry({ db, env: {} })
  const itemsRoute = createRouteContext('/api/master-data/items', db, repositories)
  const itemRoute = createRouteContext('/api/master-data/items/ITEM-A100', db, repositories)
  const missingRoute = createRouteContext('/api/master-data/items/ITEM-MISSING', db, repositories)
  const suppliersRoute = createRouteContext('/api/master-data/suppliers', db, repositories)
  const warehousesRoute = createRouteContext('/api/master-data/warehouses', db, repositories)

  assert.equal(await handleMasterDataRoute(itemsRoute.ctx), true)
  assert.equal(itemsRoute.response.status, 200)
  assert.equal(itemsRoute.response.payload.items[0].id, 'ITEM-A100')

  assert.equal(await handleMasterDataRoute(itemRoute.ctx), true)
  assert.equal(itemRoute.response.status, 200)
  assert.equal(itemRoute.response.payload.item.sku, 'A100')

  assert.equal(await handleMasterDataRoute(missingRoute.ctx), true)
  assert.equal(missingRoute.response.status, 404)
  assert.deepEqual(missingRoute.response.payload, { error: 'Item not found' })

  assert.equal(await handleMasterDataRoute(suppliersRoute.ctx), true)
  assert.equal(suppliersRoute.response.payload.suppliers[0].name, 'ABC Components')

  assert.equal(await handleMasterDataRoute(warehousesRoute.ctx), true)
  assert.equal(warehousesRoute.response.payload.warehouses.some((item) => item.id === 'WH-SECONDARY'), true)
  assert.deepEqual(db, before)
})
