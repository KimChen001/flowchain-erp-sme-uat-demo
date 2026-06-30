import test from 'node:test'
import assert from 'node:assert/strict'
import { createDatabaseRepositoryRegistry } from '../repositories/adapter-registry.mjs'
import { createDbInventoryReadRepository } from '../repositories/db-inventory-read-repository.mjs'
import { createJsonInventoryReadRepository } from '../repositories/json-inventory-read-repository.mjs'
import { shouldSkipDbTests, withTestDatabase } from '../persistence/test-db-harness.mjs'
import { handleInventoryRoute } from '../routes/inventory.routes.mjs'

const env = {
  FLOWCHAIN_PERSISTENCE_MODE: 'database',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/flowchain',
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function date(value) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null
}

function createDb() {
  return {
    products: [
      {
        sku: 'A100',
        id: 'ITEM-A100',
        itemId: 'ITEM-A100',
        name: 'Motor A100',
        itemName: 'Motor A100',
        category: 'Components',
        supplier: 'ABC Components',
        defaultWarehouseId: 'WH-MAIN',
        warehouseId: 'WH-MAIN',
        location: 'A-01',
        currentStock: 12,
        availableQuantity: 12,
        onHandQuantity: 18,
        reservedQuantity: 6,
        safetyStock: 50,
        reorderPoint: 80,
        unit: 'pcs',
        riskLevel: '高',
        stockoutRisk: '高',
        updatedAt: '2026-06-02',
      },
      {
        sku: 'B200',
        id: 'ITEM-B200',
        itemId: 'ITEM-B200',
        name: 'Bracket B200',
        itemName: 'Bracket B200',
        category: 'Metal',
        supplier: 'DEF Metals',
        defaultWarehouseId: 'WH-MAIN',
        currentStock: 160,
        availableQuantity: 160,
        onHandQuantity: 160,
        reservedQuantity: 0,
        safetyStock: 40,
        reorderPoint: 80,
        unit: 'pcs',
        status: 'active',
        updatedAt: '2026-06-03',
      },
    ],
    inventoryLots: [{
      lot: 'LOT-A100-01',
      lotId: 'LOT-A100-01',
      sku: 'A100',
      itemName: 'Motor A100',
      warehouse: 'WH-MAIN',
      warehouseId: 'WH-MAIN',
      location: 'A-01',
      qty: 12,
      quantity: 12,
      qaStatus: '可用',
      expiryDate: '2026-12-31',
      supplier: 'ABC Components',
      sourceDocument: 'GRN-1',
      status: '可用',
    }],
    inventorySerials: [{
      sn: 'SN-A100-001',
      serialId: 'SN-A100-001',
      sku: 'A100',
      itemName: 'Motor A100',
      warehouse: 'WH-MAIN',
      warehouseId: 'WH-MAIN',
      location: 'A-01',
      status: '在库',
      owner: 'Ops',
      sourceDocument: 'LOT-A100-01',
      updatedAt: '2026-06-02',
    }],
    inventoryMovements: [{
      movementId: 'IM-DB-1',
      movementType: 'StockAdjustment',
      movementLabel: 'Adjustment',
      date: '2026-06-04',
      sku: 'A100',
      itemName: 'Motor A100',
      warehouse: 'WH-MAIN',
      location: 'A-01',
      sourceDocument: 'ADJ-1',
      quantityIn: 0,
      quantityOut: 0,
      adjustmentQty: -2,
      status: '待复核',
      owner: 'Chen',
      unit: 'pcs',
      reason: 'Cycle count variance',
      evidence: [{ label: 'count', value: 'cycle' }],
      timeline: [{ label: 'created', value: '2026-06-04' }],
    }],
    inventoryExceptions: [{
      id: 'IEX-DB-1',
      type: '库存调整',
      sku: 'A100',
      itemName: 'Motor A100',
      warehouse: 'WH-MAIN',
      location: 'A-01',
      quantityImpact: -2,
      unit: 'pcs',
      status: '待复核',
      owner: 'Chen',
      linkedMovement: 'IM-DB-1',
      linkedDocument: 'ADJ-1',
      nextAction: '复核库存影响',
      reason: 'Cycle count variance',
    }],
  }
}

function createModel(records = []) {
  return {
    calls: [],
    findMany: async (query = {}) => {
      createModel.lastQuery = query
      return records
    },
  }
}

function createPrisma() {
  const db = createDb()
  return {
    item: createModel([db.products[1]].map((item) => ({
      id: item.id,
      sku: item.sku,
      name: item.name,
      category: item.category,
      unit: item.unit,
      safetyStock: item.safetyStock,
      reorderPoint: item.reorderPoint,
      status: item.status,
      updatedAt: date(item.updatedAt),
      preferredSupplierId: 'SUP-2',
      metadata: {
        supplier: item.supplier,
        defaultWarehouseId: item.defaultWarehouseId,
        availableQuantity: item.availableQuantity,
        onHandQuantity: item.onHandQuantity,
        reservedQuantity: item.reservedQuantity,
      },
    }))),
    inventoryBalance: createModel([db.products[0]].map((item) => ({
      id: 'BAL-A100-WH',
      itemId: item.itemId,
      sku: item.sku,
      itemName: item.itemName,
      warehouseId: item.warehouseId,
      location: item.location,
      availableQuantity: item.availableQuantity,
      onHandQuantity: item.onHandQuantity,
      reservedQuantity: item.reservedQuantity,
      safetyStock: item.safetyStock,
      reorderPoint: item.reorderPoint,
      unit: item.unit,
      riskLevel: item.riskLevel,
      updatedAt: date(item.updatedAt),
      metadata: { category: item.category, supplier: item.supplier },
    }))),
    inventoryLot: createModel(db.inventoryLots.map((item) => ({
      id: item.lotId,
      sku: item.sku,
      itemName: item.itemName,
      warehouseId: item.warehouseId,
      location: item.location,
      quantity: item.quantity,
      qaStatus: item.qaStatus,
      expiryDate: date(item.expiryDate),
      supplierName: item.supplier,
      sourceDocument: item.sourceDocument,
      status: item.status,
      updatedAt: date('2026-06-02'),
      metadata: {},
    }))),
    inventorySerial: createModel(db.inventorySerials.map((item) => ({
      id: item.serialId,
      sku: item.sku,
      itemName: item.itemName,
      warehouseId: item.warehouseId,
      location: item.location,
      status: item.status,
      owner: item.owner,
      sourceDocument: item.sourceDocument,
      updatedAt: date(item.updatedAt),
    }))),
    inventoryMovement: createModel(db.inventoryMovements.map((item) => ({
      id: item.movementId,
      movementType: item.movementType,
      movementLabel: item.movementLabel,
      movementDate: date(item.date),
      sku: item.sku,
      itemName: item.itemName,
      warehouseId: item.warehouse,
      location: item.location,
      sourceDocument: item.sourceDocument,
      quantityIn: item.quantityIn,
      quantityOut: item.quantityOut,
      adjustmentQty: item.adjustmentQty,
      status: item.status,
      owner: item.owner,
      unit: item.unit,
      reason: item.reason,
      evidence: item.evidence,
      timeline: item.timeline,
    }))),
    inventoryException: createModel(db.inventoryExceptions.map((item) => ({
      id: item.id,
      type: item.type,
      sku: item.sku,
      itemName: item.itemName,
      warehouseId: item.warehouse,
      location: item.location,
      quantityImpact: item.quantityImpact,
      unit: item.unit,
      status: item.status,
      owner: item.owner,
      linkedMovementId: item.linkedMovement,
      linkedDocument: item.linkedDocument,
      nextAction: item.nextAction,
      reason: item.reason,
      updatedAt: date('2026-06-04'),
    }))),
  }
}

function stable(value) {
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined))
}

function itemProjection(item = {}) {
  return stable({
    sku: item.sku,
    itemName: item.itemName,
    category: item.category,
    supplier: item.supplier,
    availableQuantity: item.availableQuantity,
    onHandQuantity: item.onHandQuantity,
    reservedQuantity: item.reservedQuantity,
    safetyStock: item.safetyStock,
    reorderPoint: item.reorderPoint,
    status: item.status,
    riskLevel: item.riskLevel,
    unit: item.unit,
  })
}

test('mocked inventory DB adapter matches JSON item list and detail contract', async () => {
  const json = createJsonInventoryReadRepository(createDb())
  const database = createDbInventoryReadRepository({ env, prisma: createPrisma() })

  const jsonItems = json.listItems()
  const dbItems = await database.listItems()

  assert.deepEqual(dbItems.map((item) => item.sku), jsonItems.map((item) => item.sku))
  for (const sku of ['A100', 'B200']) {
    assert.deepEqual(itemProjection(await database.getItem(sku)), itemProjection(json.getItem(sku)), sku)
  }
})

test('mocked inventory DB adapter matches JSON lots serials movements exceptions and summary', async () => {
  const json = createJsonInventoryReadRepository(createDb())
  const database = createDbInventoryReadRepository({ env, prisma: createPrisma() })

  assert.deepEqual(stable((await database.listLots())[0]), stable(json.listLots()[0]))
  assert.deepEqual(stable((await database.listSerials())[0]), stable(json.listSerials()[0]))
  assert.deepEqual(stable((await database.listMovements())[0]), stable(json.listMovements()[0]))
  assert.deepEqual(stable((await database.listExceptions())[0]), stable(json.listExceptions()[0]))

  const dbSummary = await database.getSummary()
  const jsonSummary = json.getSummary()
  for (const key of ['itemCount', 'lowStockCount', 'highRiskCount', 'movementCount', 'exceptionCount', 'lotCount', 'serialCount']) {
    assert.equal(dbSummary[key], jsonSummary[key], key)
  }
})

test('database registry inventory route uses DB adapter and remains read-only', async () => {
  const db = createDb()
  const before = clone(db)
  const repositories = createDatabaseRepositoryRegistry({ db, env, prisma: createPrisma() })

  assert.equal(repositories.inventoryRead.adapter, 'db-inventory-read-v1')
  for (const [path, key] of [
    ['/api/inventory/items', 'items'],
    ['/api/inventory/items/A100', 'item'],
    ['/api/inventory/lots', 'lots'],
    ['/api/inventory/serials', 'serials'],
    ['/api/inventory/movements', 'movements'],
    ['/api/inventory/exceptions', 'exceptions'],
    ['/api/inventory/summary', 'summary'],
  ]) {
    let response = null
    const handled = await handleInventoryRoute({
      req: { method: 'GET' },
      res: {},
      url: new URL(path, 'http://localhost'),
      db,
      repositories,
      send(_res, status, payload) {
        response = { status, payload }
      },
    })
    assert.equal(handled, true, path)
    assert.equal(response.status, 200, path)
    assert.equal(response.payload[key] !== undefined, true, path)
  }

  assert.deepEqual(db, before)
  for (const method of Object.keys(repositories.inventoryRead)) {
    assert.doesNotMatch(method, /create|update|delete|persist|confirm|post|save/i)
  }
})

test('inventory DB parity optional live path skips cleanly without DATABASE_URL_TEST', async () => {
  assert.equal(shouldSkipDbTests({}).skip, true)
  const result = await withTestDatabase({}, async ({ prisma, env: liveEnv }) => {
    const repository = createDbInventoryReadRepository({ env: liveEnv, prisma })
    return repository.getSummary()
  })
  assert.deepEqual(result, {
    skipped: true,
    reason: 'DATABASE_URL_TEST is not configured.',
  })
})
