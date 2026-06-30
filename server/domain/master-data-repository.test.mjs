import test from 'node:test'
import assert from 'node:assert/strict'
import { createJsonMasterDataRepository } from '../repositories/json-master-data-repository.mjs'
import { createDatabaseRepositoryRegistry, createRepositoryRegistry } from '../repositories/adapter-registry.mjs'
import { handleMasterDataRoute } from '../routes/master-data.routes.mjs'
import { findMasterItem, listMasterItems, listMasterSuppliers } from './master-data.mjs'
import { DATABASE_CONFIG_ERROR } from '../persistence/persistence-config.mjs'

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

test('database mode registry uses DB MasterDataRepository and keeps inventory fallback', async () => {
  const db = createDb()
  const registry = createRepositoryRegistry({ db, env: { FLOWCHAIN_PERSISTENCE_MODE: 'database' } })

  assert.equal(registry.mode, 'database')
  assert.equal(registry.masterData.adapter, 'db-master-data-v1')
  assert.equal(registry.actionDrafts.adapter, 'db-action-draft-v1')
  assert.equal(registry.auditLog.adapter, 'db-audit-log-v1')
  assert.equal(registry.procurementRead.adapter, 'db-procurement-read-v1')
  assert.equal(registry.inventoryRead.listItems()[0].sku, 'A100')
  await assert.rejects(
    () => registry.procurementRead.getDocument('po', 'PO-1'),
    (error) => error.message === DATABASE_CONFIG_ERROR && error.code === 'FLOWCHAIN_DATABASE_CONFIG_MISSING'
  )
})

test('database MasterDataRepository maps Prisma rows to current read shapes', async () => {
  const prisma = {
    item: {
      findMany: async () => [{
        id: 'ITEM-A100',
        tenantId: 'tenant-flowchain-sme',
        sku: 'A100',
        name: 'Motor A100',
        category: 'Components',
        unit: 'pcs',
        preferredSupplierId: 'SUP-001',
        status: 'active',
        metadata: { defaultWarehouseId: 'WH-MAIN', leadTimeDays: 7, moq: 100, batchMultiple: 10 },
      }],
    },
    supplier: {
      findMany: async () => [{
        id: 'SUP-001',
        code: 'ABC',
        name: 'ABC Components',
        category: 'Motors',
        status: 'active',
        riskLevel: 'low',
        score: 96,
        metadata: { defaultCurrency: 'CNY', paymentTermsId: 'NET45', preferred: true },
      }],
    },
    warehouse: {
      findMany: async () => [{
        id: 'WH-MAIN',
        code: 'MAIN',
        name: 'Main Warehouse',
        status: 'active',
        metadata: { type: 'warehouse' },
      }],
    },
    paymentTerm: {
      findMany: async () => [{ id: 'TERM-45', code: 'NET45', name: 'Net 45', days: 45, metadata: { status: 'active' } }],
    },
    taxCode: {
      findMany: async () => [{ id: 'TAX-STD-ID', code: 'TAX-STD', name: 'Standard Tax', rate: 0.13, metadata: { status: 'active' } }],
    },
  }
  const registry = createDatabaseRepositoryRegistry({
    db: createDb(),
    env: {
      FLOWCHAIN_PERSISTENCE_MODE: 'database',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/flowchain',
    },
    prisma,
  })

  const items = await registry.masterData.listItems()
  const item = await registry.masterData.getItem('A100')
  const suppliers = await registry.masterData.listSuppliers()
  const supplier = await registry.masterData.getSupplier('ABC Components')
  const warehouses = await registry.masterData.listWarehouses()
  const paymentTerms = await registry.masterData.listPaymentTerms()
  const taxCodes = await registry.masterData.listTaxCodes()

  assert.equal(items[0].id, 'ITEM-A100')
  assert.equal(item.preferredSupplierSource, 'matched_supplier_master')
  assert.equal(item.moq, 100)
  assert.equal(suppliers[0].paymentTermsId, 'NET45')
  assert.equal(supplier.preferred, true)
  assert.equal(warehouses[0].sourceType, 'database')
  assert.equal(paymentTerms[0].id, 'NET45')
  assert.equal(taxCodes[0].rate, 0.13)
})

test('database MasterDataRepository checks DATABASE_URL only when invoked', async () => {
  const registry = createRepositoryRegistry({
    db: createDb(),
    env: { FLOWCHAIN_PERSISTENCE_MODE: 'database' },
  })

  assert.equal(registry.masterData.adapter, 'db-master-data-v1')
  await assert.rejects(
    () => registry.masterData.listItems(),
    (error) => error.message === DATABASE_CONFIG_ERROR && error.code === 'FLOWCHAIN_DATABASE_CONFIG_MISSING'
  )
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
