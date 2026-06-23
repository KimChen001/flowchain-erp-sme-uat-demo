const defaultWarehouse = Object.freeze({
  id: 'WH-MAIN',
  name: 'Main Warehouse',
  type: 'warehouse',
  status: 'active',
  parentId: null,
})

const defaultPaymentTerms = Object.freeze([
  { id: 'NET30', label: 'Net 30', days: 30, status: 'active' },
])

const defaultTaxCodes = Object.freeze([
  { id: 'TAX-STD', label: 'Standard Tax', rate: 0.1, status: 'active' },
])

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function stableKey(value, fallback) {
  const key = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
  return key || fallback
}

function itemIdFor(item = {}, index = 0) {
  if (item.id || item.itemId || item.itemCode) return String(item.id || item.itemId || item.itemCode)
  const sku = item.sku || item.code || item.name
  return `ITEM-${stableKey(sku, String(index + 1).padStart(3, '0'))}`
}

function supplierIdFor(supplier = {}, index = 0) {
  if (supplier.id || supplier.supplierId) return String(supplier.id || supplier.supplierId)
  return `SUP-${stableKey(supplier.name || supplier.code, String(index + 1).padStart(3, '0'))}`
}

function normalizeRisk(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === '高' || raw === 'high') return 'high'
  if (raw === '低' || raw === 'low') return 'low'
  if (raw === '中' || raw === 'medium') return 'medium'
  return raw || 'medium'
}

function supplierScoreFor(supplier = {}) {
  if (supplier.score || supplier.rating || supplier.grade) return String(supplier.score || supplier.rating || supplier.grade)
  const onTime = toNumber(supplier.onTimeRate, 0)
  const quality = toNumber(supplier.qualityRate, 0)
  const average = onTime || quality ? (onTime + quality) / (onTime && quality ? 2 : 1) : 0
  if (average >= 90) return 'A'
  if (average >= 80) return 'B+'
  if (average >= 70) return 'B'
  return 'C'
}

export function normalizeMasterItem(item = {}, index = 0) {
  const sku = String(item.sku || item.code || item.id || item.itemId || '').trim()
  const supplierId = item.preferredSupplierId || item.supplierId || (item.supplier ? `SUP-${stableKey(item.supplier, 'PREFERRED')}` : '')
  return {
    id: itemIdFor(item, index),
    sku,
    name: item.name || item.itemName || sku || `Item ${index + 1}`,
    category: item.category || 'Uncategorized',
    baseUom: item.baseUom || item.uom || item.unit || 'pcs',
    defaultWarehouseId: item.defaultWarehouseId || item.warehouseId || defaultWarehouse.id,
    preferredSupplierId: supplierId,
    leadTimeDays: toNumber(item.leadTimeDays ?? item.leadTime ?? item.leadTimePeriods, 0),
    moq: toNumber(item.moq ?? item.minimumOrderQuantity, 1),
    batchMultiple: toNumber(item.batchMultiple, 1),
    status: item.status || 'active',
  }
}

export function listMasterItems(db = {}) {
  return asArray(db.products).map(normalizeMasterItem)
}

export function findMasterItem(db = {}, id = '') {
  const key = decodeURIComponent(String(id || '')).toLowerCase()
  return listMasterItems(db).find((item) =>
    [item.id, item.sku, item.name].some((value) => String(value || '').toLowerCase() === key)
  ) || null
}

export function normalizeMasterSupplier(supplier = {}, index = 0) {
  const category = supplier.category || supplier.type || 'General'
  return {
    id: supplierIdFor(supplier, index),
    name: supplier.name || supplier.supplierName || `Supplier ${index + 1}`,
    status: supplier.status || 'active',
    risk: normalizeRisk(supplier.risk),
    score: supplierScoreFor(supplier),
    defaultCurrency: supplier.defaultCurrency || supplier.currency || 'USD',
    paymentTermsId: supplier.paymentTermsId || supplier.paymentTerms || 'NET30',
    categories: Array.isArray(supplier.categories) ? supplier.categories : [category].filter(Boolean),
    preferred: Boolean(supplier.preferred),
  }
}

export function listMasterSuppliers(db = {}) {
  return asArray(db.suppliers).map(normalizeMasterSupplier)
}

export function findMasterSupplier(db = {}, id = '') {
  const key = decodeURIComponent(String(id || '')).toLowerCase()
  return listMasterSuppliers(db).find((supplier) =>
    [supplier.id, supplier.name].some((value) => String(value || '').toLowerCase() === key)
  ) || null
}

export function listMasterWarehouses(db = {}) {
  const explicit = asArray(db.warehouses).map((warehouse, index) => ({
    id: warehouse.id || warehouse.warehouseId || `WH-${stableKey(warehouse.name, String(index + 1).padStart(3, '0'))}`,
    name: warehouse.name || warehouse.label || warehouse.id || `Warehouse ${index + 1}`,
    type: warehouse.type || 'warehouse',
    status: warehouse.status || 'active',
    parentId: warehouse.parentId ?? null,
  }))
  const inferredIds = new Set([
    ...listMasterItems(db).map((item) => item.defaultWarehouseId),
    ...asArray(db.inventoryMovements).map((movement) => movement.warehouseId),
  ].filter(Boolean))
  const inferred = Array.from(inferredIds)
    .filter((id) => !explicit.some((warehouse) => warehouse.id === id))
    .map((id) => ({ ...defaultWarehouse, id, name: id === defaultWarehouse.id ? defaultWarehouse.name : id }))
  const warehouses = [...explicit, ...inferred]
  return warehouses.length ? warehouses : [{ ...defaultWarehouse }]
}

export function listPaymentTerms(db = {}) {
  const terms = asArray(db.paymentTerms).map((term) => ({
    id: term.id || term.paymentTermsId || term.code || 'NET30',
    label: term.label || term.name || term.id || 'Net 30',
    days: toNumber(term.days ?? term.netDays, 30),
    status: term.status || 'active',
  }))
  return terms.length ? terms : defaultPaymentTerms.map((term) => ({ ...term }))
}

export function listTaxCodes(db = {}) {
  const codes = asArray(db.taxCodes).map((code) => ({
    id: code.id || code.taxCodeId || code.code || 'TAX-STD',
    label: code.label || code.name || code.id || 'Standard Tax',
    rate: toNumber(code.rate, 0),
    status: code.status || 'active',
  }))
  return codes.length ? codes : defaultTaxCodes.map((code) => ({ ...code }))
}
