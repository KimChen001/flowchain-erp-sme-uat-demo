import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { withRuntimeFileMutex } from './runtime-file-mutex.mjs'

const clone = value => structuredClone(value)
const text = value => String(value ?? '').trim()
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0

export const emptySalesRuntime = () => ({ schemaVersion: 1, revision: 0, initialized: true, updatedAt: null, orders: [] })

async function atomicWrite(file, document) {
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`
  await mkdir(dirname(file), { recursive: true })
  try { await writeFile(temp, JSON.stringify(document, null, 2), 'utf8'); await rename(temp, file) }
  catch (error) { await rm(temp, { force: true }).catch(() => {}); throw error }
}

function normalize(input, previous = {}) {
  const orderedQty = number(input.orderedQty ?? previous.orderedQty)
  const reservedQty = number(input.reservedQty ?? previous.reservedQty)
  const fulfilledQty = number(input.fulfilledQty ?? previous.fulfilledQty)
  const shortageQty = Math.max(0, number(input.shortageQty ?? Math.max(0, orderedQty - reservedQty - fulfilledQty)))
  return {
    ...previous, ...input,
    salesOrderId: text(input.salesOrderId || input.id || previous.salesOrderId),
    customerName: text(input.customerName || previous.customerName),
    customerTier: text(input.customerTier || previous.customerTier),
    sku: text(input.sku || previous.sku), itemId: text(input.itemId || previous.itemId || input.sku || previous.sku),
    itemName: text(input.itemName || previous.itemName), orderedQty, reservedQty, fulfilledQty, shortageQty,
    promisedDate: text(input.promisedDate || previous.promisedDate), statusLabel: text(input.statusLabel || input.status || previous.statusLabel || '待处理'),
    priority: text(input.priority || previous.priority || '中'),
    deliveryRiskLevel: text(input.deliveryRiskLevel || previous.deliveryRiskLevel || (shortageQty > 0 ? 'high' : 'low')),
    deliveryRiskLabel: text(input.deliveryRiskLabel || previous.deliveryRiskLabel || (shortageQty > 0 ? '库存缺口' : '正常')),
    deliveryRiskReason: text(input.deliveryRiskReason || previous.deliveryRiskReason),
    linkedPurchaseOrders: Array.isArray(input.linkedPurchaseOrders) ? input.linkedPurchaseOrders : previous.linkedPurchaseOrders || [],
    linkedSuppliers: Array.isArray(input.linkedSuppliers) ? input.linkedSuppliers : previous.linkedSuppliers || [],
    linkedReceivingDocs: Array.isArray(input.linkedReceivingDocs) ? input.linkedReceivingDocs : previous.linkedReceivingDocs || [],
    linkedExceptionCases: Array.isArray(input.linkedExceptionCases) ? input.linkedExceptionCases : previous.linkedExceptionCases || [],
    evidence: Array.isArray(input.evidence) ? input.evidence : previous.evidence || [],
    dataLimitations: Array.isArray(input.dataLimitations) ? input.dataLimitations : previous.dataLimitations || [],
    updatedAt: new Date().toISOString(),
  }
}

function summary(orders) {
  const risky = orders.filter(row => row.deliveryRiskLevel !== 'low')
  return { totalOrders: orders.length, riskOrderCount: risky.length, highRiskOrderCount: risky.filter(row => ['blocked', 'high'].includes(row.deliveryRiskLevel)).length, shortageQty: orders.reduce((sum, row) => sum + number(row.shortageQty), 0), reservedQty: orders.reduce((sum, row) => sum + number(row.reservedQty), 0), affectedCustomerCount: new Set(risky.map(row => row.customerName)).size }
}

export function createDurableSalesOrderRepository({ dataFile }) {
  let document
  async function readLatest() {
    let latest
    try { latest = JSON.parse(await readFile(dataFile, 'utf8')) }
    catch (error) { if (error.code !== 'ENOENT') throw error; latest = emptySalesRuntime() }
    return { ...emptySalesRuntime(), ...latest, initialized: true }
  }
  async function load() { if (!document) document = await readLatest(); return document }
  async function transact(operation) { return withRuntimeFileMutex(dataFile, async () => { const working = clone(await readLatest()); const result = await operation(working); working.revision = Number(working.revision || 0) + 1; working.updatedAt = new Date().toISOString(); await atomicWrite(dataFile, working); document = working; return clone(result) }) }
  return {
    mode: 'json', adapter: 'durable-sales-order-runtime-v1', _dataFile: dataFile,
    async listOrders(filters = {}) {
      const q = text(filters.q).toLowerCase(); const rows = (await load()).orders
      return clone(rows.filter(row => (!filters.sku || row.sku === filters.sku) && (!filters.status || row.statusLabel === filters.status) && (!filters.risk || row.deliveryRiskLevel === filters.risk) && (!q || [row.salesOrderId, row.customerName, row.sku, row.itemName].some(value => text(value).toLowerCase().includes(q)))))
    },
    async getOrder(key) { return clone((await load()).orders.find(row => row.salesOrderId === decodeURIComponent(key)) || null) },
    async getSummary() { return summary((await load()).orders) },
    async upsertOrder(input, actor = 'system') {
      return transact(doc => { const id = text(input.salesOrderId || input.id)
        if (!id) { const error = new Error('客户订单号必填'); Object.assign(error, { status: 400, code: 'SALES_ORDER_ID_REQUIRED' }); throw error }
        const index = doc.orders.findIndex(row => row.salesOrderId === id); const row = normalize({ ...input, salesOrderId: id, ...(index >= 0 ? {} : { createdBy: actor }), updatedBy: actor }, index >= 0 ? doc.orders[index] : {})
        if (index >= 0) doc.orders[index] = row; else doc.orders.unshift(row)
        return row
      })
    },
  }
}
