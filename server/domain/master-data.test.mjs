import test from 'node:test'
import assert from 'node:assert/strict'
import { handleMasterDataRoute } from '../routes/master-data.routes.mjs'
import {
  findMasterItem,
  findMasterSupplier,
  listMasterItems,
  listMasterSuppliers,
  listMasterWarehouses,
  listPaymentTerms,
  listTaxCodes,
} from './master-data.mjs'

function createRouteContext(method, pathname, db) {
  let response = null
  return {
    ctx: {
      req: { method, headers: {} },
      res: {},
      url: new URL(pathname, 'http://localhost'),
      db,
      send(_res, status, payload) {
        response = { status, payload }
      },
    },
    get response() {
      return response
    },
  }
}

function createDb() {
  return {
    products: [
      {
        sku: 'A100',
        name: 'Motor A100',
        category: 'Components',
        unit: 'pcs',
        supplier: 'ABC Components',
        leadTimeDays: 7,
        moq: 100,
        batchMultiple: 50,
      },
    ],
    suppliers: [
      {
        name: 'ABC Components',
        category: 'Motors',
        risk: '中',
        onTimeRate: 91,
        qualityRate: 96,
        preferred: true,
      },
    ],
  }
}

test('master data helper normalizes item read models', () => {
  const items = listMasterItems(createDb())
  assert.equal(items.length, 1)
  assert.deepEqual(items[0], {
    id: 'ITEM-A100',
    sku: 'A100',
    name: 'Motor A100',
    category: 'Components',
    baseUom: 'pcs',
    defaultWarehouseId: 'WH-MAIN',
    preferredSupplierId: 'SUP-ABC-COMPONENTS',
    leadTimeDays: 7,
    moq: 100,
    batchMultiple: 50,
    status: 'active',
  })
  assert.equal(findMasterItem(createDb(), 'A100')?.id, 'ITEM-A100')
})

test('master data helper normalizes supplier read models', () => {
  const suppliers = listMasterSuppliers(createDb())
  assert.equal(suppliers.length, 1)
  assert.deepEqual(suppliers[0], {
    id: 'SUP-ABC-COMPONENTS',
    name: 'ABC Components',
    status: 'active',
    risk: 'medium',
    score: 'A',
    defaultCurrency: 'USD',
    paymentTermsId: 'NET30',
    categories: ['Motors'],
    preferred: true,
  })
  assert.equal(findMasterSupplier(createDb(), 'ABC Components')?.id, 'SUP-ABC-COMPONENTS')
})

test('GET /api/master-data/items returns item collection', async () => {
  const route = createRouteContext('GET', '/api/master-data/items', createDb())
  const handled = await handleMasterDataRoute(route.ctx)

  assert.ok(handled)
  assert.equal(route.response.status, 200)
  assert.equal(route.response.payload.items.length, 1)
  assert.equal(route.response.payload.items[0].id, 'ITEM-A100')
})

test('GET /api/master-data/items/:id returns one item', async () => {
  const route = createRouteContext('GET', '/api/master-data/items/ITEM-A100', createDb())
  const handled = await handleMasterDataRoute(route.ctx)

  assert.ok(handled)
  assert.equal(route.response.status, 200)
  assert.equal(route.response.payload.item.sku, 'A100')
})

test('GET /api/master-data/items/:id returns 404 for missing item', async () => {
  const route = createRouteContext('GET', '/api/master-data/items/ITEM-MISSING', createDb())
  const handled = await handleMasterDataRoute(route.ctx)

  assert.ok(handled)
  assert.equal(route.response.status, 404)
  assert.deepEqual(route.response.payload, { error: 'Item not found' })
})

test('GET /api/master-data/suppliers returns supplier collection', async () => {
  const route = createRouteContext('GET', '/api/master-data/suppliers', createDb())
  const handled = await handleMasterDataRoute(route.ctx)

  assert.ok(handled)
  assert.equal(route.response.status, 200)
  assert.equal(route.response.payload.suppliers.length, 1)
  assert.equal(route.response.payload.suppliers[0].id, 'SUP-ABC-COMPONENTS')
})

test('GET /api/master-data/suppliers/:id returns one supplier', async () => {
  const route = createRouteContext('GET', '/api/master-data/suppliers/SUP-ABC-COMPONENTS', createDb())
  const handled = await handleMasterDataRoute(route.ctx)

  assert.ok(handled)
  assert.equal(route.response.status, 200)
  assert.equal(route.response.payload.supplier.name, 'ABC Components')
})

test('GET /api/master-data/suppliers/:id returns 404 for missing supplier', async () => {
  const route = createRouteContext('GET', '/api/master-data/suppliers/SUP-MISSING', createDb())
  const handled = await handleMasterDataRoute(route.ctx)

  assert.ok(handled)
  assert.equal(route.response.status, 404)
  assert.deepEqual(route.response.payload, { error: 'Supplier not found' })
})

test('GET /api/master-data/warehouses returns warehouse references', async () => {
  const db = createDb()
  const route = createRouteContext('GET', '/api/master-data/warehouses', db)
  const handled = await handleMasterDataRoute(route.ctx)

  assert.ok(handled)
  assert.equal(route.response.status, 200)
  assert.deepEqual(route.response.payload.warehouses, listMasterWarehouses(db))
  assert.equal(route.response.payload.warehouses[0].id, 'WH-MAIN')
})

test('GET /api/master-data/payment-terms returns payment term references', async () => {
  const db = createDb()
  const route = createRouteContext('GET', '/api/master-data/payment-terms', db)
  const handled = await handleMasterDataRoute(route.ctx)

  assert.ok(handled)
  assert.equal(route.response.status, 200)
  assert.deepEqual(route.response.payload.paymentTerms, listPaymentTerms(db))
  assert.equal(route.response.payload.paymentTerms[0].id, 'NET30')
})

test('GET /api/master-data/tax-codes returns tax code references', async () => {
  const db = createDb()
  const route = createRouteContext('GET', '/api/master-data/tax-codes', db)
  const handled = await handleMasterDataRoute(route.ctx)

  assert.ok(handled)
  assert.equal(route.response.status, 200)
  assert.deepEqual(route.response.payload.taxCodes, listTaxCodes(db))
  assert.equal(route.response.payload.taxCodes[0].id, 'TAX-STD')
})

