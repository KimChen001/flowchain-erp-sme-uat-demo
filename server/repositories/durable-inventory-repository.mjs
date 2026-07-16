import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { withRuntimeFileMutex } from './runtime-file-mutex.mjs'

const clone = value => structuredClone(value)
const text = value => String(value ?? '').trim()
const number = (value, fallback = 0) => value === '' || value == null ? fallback : Number.isFinite(Number(value)) ? Number(value) : fallback

export const emptyInventoryRuntime = () => ({
  schemaVersion: 1,
  revision: 0,
  initialized: true,
  updatedAt: null,
  items: [], lots: [], serials: [], movements: [], exceptions: [], auditEvents: [],
})

async function atomicWrite(file, document) {
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`
  await mkdir(dirname(file), { recursive: true })
  try {
    await writeFile(temp, JSON.stringify(document, null, 2), 'utf8')
    await rename(temp, file)
  } catch (error) {
    await rm(temp, { force: true }).catch(() => {})
    throw error
  }
}

export function createDurableInventoryRepository({ dataFile }) {
  let document
  async function readLatest() {
    let latest
    try { latest = JSON.parse(await readFile(dataFile, 'utf8')) }
    catch (error) {
      if (error.code !== 'ENOENT') throw error
      latest = emptyInventoryRuntime()
    }
    return { ...emptyInventoryRuntime(), ...latest, initialized: true }
  }
  async function load() {
    if (!document) document = await readLatest()
    return document
  }
  async function transact(operation) {
    return withRuntimeFileMutex(dataFile, async () => {
      const working = clone(await readLatest())
      const result = await operation(working)
      working.revision = Number(working.revision || 0) + 1
      working.updatedAt = new Date().toISOString()
      await atomicWrite(dataFile, working)
      document = working
      return clone(result)
    })
  }
  function filter(rows, filters = {}) {
    const q = text(filters.q).toLowerCase()
    return rows.filter(row =>
      (!filters.status || text(row.status) === text(filters.status)) &&
      (!filters.warehouse || text(row.warehouseId || row.defaultWarehouseId) === text(filters.warehouse)) &&
      (!q || [row.sku, row.itemName, row.name, row.lotId, row.serialId, row.movementId, row.id].some(value => text(value).toLowerCase().includes(q))),
    ).slice(0, Math.max(1, number(filters.limit, rows.length || 1)))
  }
  return {
    mode: 'json', adapter: 'durable-inventory-runtime-v1', _dataFile: dataFile,
    async listItems(filters) { return clone(filter((await load()).items, filters)) },
    async getItem(key) { const decoded = decodeURIComponent(key); return clone((await load()).items.find(row => row.sku === decoded || row.itemId === decoded) || null) },
    async listLots(filters) { return clone(filter((await load()).lots, filters)) },
    async listSerials(filters) { return clone(filter((await load()).serials, filters)) },
    async listMovements(filters) { return clone(filter((await load()).movements, filters)) },
    async listExceptions(filters) { return clone(filter((await load()).exceptions, filters)) },
    async getSummary() {
      const doc = await load()
      return {
        itemCount: doc.items.length,
        lowStockCount: doc.items.filter(row => number(row.availableQuantity ?? row.onHandQuantity) < number(row.reorderPoint ?? row.safetyStock)).length,
        highRiskCount: doc.items.filter(row => ['blocked', 'high', '缺货'].includes(text(row.riskLevel || row.status))).length,
        movementCount: doc.movements.length, exceptionCount: doc.exceptions.length,
        lotCount: doc.lots.length, serialCount: doc.serials.length,
      }
    },
    async upsertItem(input, actor = 'system') {
      return transact(doc => {
        const sku = text(input.sku)
        if (!sku) { const error = new Error('SKU 必填'); Object.assign(error, { status: 400, code: 'SKU_REQUIRED' }); throw error }
        const index = doc.items.findIndex(row => row.sku === sku)
        const row = {
          ...(index >= 0 ? doc.items[index] : {}), ...input, sku,
          itemId: text(input.itemId) || text(input.id) || sku,
          itemName: text(input.itemName || input.name) || sku,
          onHandQuantity: number(input.onHandQuantity ?? input.qty),
          availableQuantity: number(input.availableQuantity ?? input.onHandQuantity ?? input.qty),
          reservedQuantity: number(input.reservedQuantity), safetyStock: number(input.safetyStock),
          reorderPoint: number(input.reorderPoint ?? input.safetyStock),
          ...(index >= 0 ? {} : { createdBy: actor }), updatedBy: actor, updatedAt: new Date().toISOString(),
        }
        if (index >= 0) doc.items[index] = row; else doc.items.push(row)
        return row
      })
    },
    async applyBalanceAdjustment(input, actor = 'system', metadata = {}) {
      return transact(doc => {
        const sku = text(input.sku)
        if (!sku) { const error = new Error('SKU 必填'); Object.assign(error, { status: 400, code: 'SKU_REQUIRED' }); throw error }
        const index = doc.items.findIndex(row => row.sku === sku && text(row.warehouseId) === text(input.warehouseId || input.warehouse))
        const previous = index >= 0 ? doc.items[index] : null
        const previousQuantity = previous ? number(previous.onHandQuantity) : 0
        const nextQuantity = number(input.quantity ?? input.onHandQuantity)
        const timestamp = new Date().toISOString()
        const row = { ...previous, ...input, sku, itemId: text(input.itemId || previous?.itemId || sku), itemName: text(input.itemName || previous?.itemName || sku), warehouseId: text(input.warehouseId || input.warehouse), binId: text(input.binId || input.bin), onHandQuantity: nextQuantity, availableQuantity: nextQuantity - number(input.reservedQuantity ?? previous?.reservedQuantity), reservedQuantity: number(input.reservedQuantity ?? previous?.reservedQuantity), updatedAt: timestamp }
        if (index >= 0) doc.items[index] = row; else doc.items.push(row)
        const movement = { movementId: `IMV-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`, movementType: previous ? 'inventory_adjustment' : 'opening_balance', sku, itemId: row.itemId, warehouseId: row.warehouseId, binId: row.binId, previousQuantity, quantity: nextQuantity - previousQuantity, resultingQuantity: nextQuantity, reason: text(input.reason || '正式库存余额导入'), operator: actor, timestamp, ...metadata }
        const auditEvent = { id: `AUD-INV-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`, action: 'inventory_balance_imported', entity: { type: 'inventory_item', id: sku }, actor, timestamp, metadata: { ...metadata, movementId: movement.movementId, previousQuantity, nextQuantity } }
        doc.movements.unshift(movement); doc.auditEvents.unshift(auditEvent)
        return { item: row, movement, auditEvent, operation: previous ? 'update' : 'insert' }
      })
    },
    async applyImportBatch(rows, actor = 'system', metadata = {}) {
      return transact(doc => {
        const changes = []
        for (const [index, input] of rows.entries()) {
          try {
            const sku = text(input.sku)
            if (!sku) { const error = new Error('SKU 必填'); Object.assign(error, { status: 400, code: 'SKU_REQUIRED' }); throw error }
            const quantity = Number(input.quantity)
            if (!Number.isFinite(quantity)) { const error = new Error('库存数量必须是有效数字'); Object.assign(error, { status: 422, code: 'INVENTORY_QUANTITY_INVALID' }); throw error }
            const itemIndex = doc.items.findIndex(row => row.sku === sku && text(row.warehouseId) === text(input.warehouseId || input.warehouse))
            const previous = itemIndex >= 0 ? doc.items[itemIndex] : null
            const previousQuantity = previous ? number(previous.onHandQuantity) : 0
            const timestamp = new Date().toISOString()
            const row = { ...previous, ...input, sku, itemId: text(input.itemId || previous?.itemId || sku), itemName: text(input.itemName || previous?.itemName || sku), warehouseId: text(input.warehouseId || input.warehouse), binId: text(input.binId || input.bin), onHandQuantity: quantity, availableQuantity: quantity - number(input.reservedQuantity ?? previous?.reservedQuantity), reservedQuantity: number(input.reservedQuantity ?? previous?.reservedQuantity), updatedAt: timestamp, ...metadata }
            if (itemIndex >= 0) doc.items[itemIndex] = row; else doc.items.push(row)
            const movement = { movementId: `IMV-${randomUUID()}`, movementType: previous ? 'inventory_adjustment' : 'opening_balance', sku, itemId: row.itemId, warehouseId: row.warehouseId, binId: row.binId, previousQuantity, quantity: quantity - previousQuantity, resultingQuantity: quantity, reason: text(input.reason || '正式库存余额导入'), operator: actor, timestamp, ...metadata }
            const auditEvent = { id: `AUD-INV-${randomUUID()}`, action: 'inventory_balance_imported', entity: { type: 'inventory_item', id: sku }, actor, timestamp, metadata: { ...metadata, movementId: movement.movementId, previousQuantity, nextQuantity: quantity } }
            doc.movements.unshift(movement); doc.auditEvents.unshift(auditEvent)
            changes.push({ repository: 'inventory-runtime', operation: previous ? 'update' : 'insert', entityId: sku, movementId: movement.movementId, auditEventId: auditEvent.id })
          } catch (error) {
            Object.assign(error, { failedRowNumber: index + 1 })
            throw error
          }
        }
        return changes
      })
    },
    async snapshot() { return clone(await load()) },
  }
}
