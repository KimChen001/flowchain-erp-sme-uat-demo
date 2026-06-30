const DEFAULT_TENANT_ID = 'tenant-flowchain-sme'

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function text(value, fallback = '') {
  const next = String(value ?? '').trim()
  return next || fallback
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null))
}

function stableKey(value, fallback) {
  const key = text(value)
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
  return key || fallback
}

function supplierIdFor(supplier = {}, index = 0) {
  return text(supplier.id || supplier.supplierId, `SUP-${stableKey(supplier.name || supplier.code, String(index + 1).padStart(3, '0'))}`)
}

function itemIdFor(item = {}, index = 0) {
  return text(item.id || item.itemId || item.itemCode, `ITEM-${stableKey(item.sku || item.code || item.name, String(index + 1).padStart(3, '0'))}`)
}

function warehouseIdFor(warehouse = {}, index = 0) {
  return text(warehouse.id || warehouse.warehouseId, `WH-${stableKey(warehouse.name || warehouse.code, String(index + 1).padStart(3, '0'))}`)
}

function termIdFor(term = {}) {
  return text(term.id || term.paymentTermsId || term.code, 'NET30')
}

function taxCodeIdFor(code = {}) {
  return text(code.id || code.taxCodeId || code.code, 'TAX-STD')
}

function collectUnresolvedItemSuppliers(db = {}) {
  const supplierKeys = new Set(asArray(db.suppliers).flatMap((supplier, index) => {
    const id = supplierIdFor(supplier, index)
    return [id, supplier.name, supplier.code, supplier.supplierName].map((item) => text(item).toLowerCase()).filter(Boolean)
  }))
  return asArray(db.products)
    .map((item) => text(item.preferredSupplierId || item.supplierId || item.preferredSupplier || item.supplier || item.supplierName))
    .filter(Boolean)
    .filter((supplier) => !supplierKeys.has(supplier.toLowerCase()))
}

export function buildMasterDataSeedPlan(db = {}, options = {}) {
  const source = clone(db) || {}
  const tenantId = text(options.tenantId, DEFAULT_TENANT_ID)
  const suppliers = asArray(source.suppliers)
  const items = asArray(source.products)
  const warehouses = asArray(source.warehouses)
  const paymentTerms = asArray(source.paymentTerms)
  const taxCodes = asArray(source.taxCodes)
  const unresolvedSuppliers = [...new Set(collectUnresolvedItemSuppliers(source))]

  return {
    dryRun: options.dryRun !== false,
    tenantId,
    seedOrder: ['Tenant', 'PaymentTerm', 'TaxCode', 'Supplier', 'Warehouse', 'Item'],
    counts: {
      tenants: 1,
      paymentTerms: paymentTerms.length || 1,
      taxCodes: taxCodes.length || 1,
      suppliers: suppliers.length,
      warehouses: warehouses.length,
      items: items.length,
    },
    samples: {
      suppliers: suppliers.slice(0, 3).map((supplier, index) => ({ id: supplierIdFor(supplier, index), name: text(supplier.name || supplier.supplierName) })),
      items: items.slice(0, 3).map((item, index) => ({ id: itemIdFor(item, index), sku: text(item.sku || item.code || item.id) })),
      warehouses: warehouses.slice(0, 3).map((warehouse, index) => ({ id: warehouseIdFor(warehouse, index), name: text(warehouse.name || warehouse.label) })),
      paymentTerms: (paymentTerms.length ? paymentTerms : [{ id: 'NET30', label: 'Net 30' }]).slice(0, 3).map((term) => ({ id: termIdFor(term), label: text(term.label || term.name || term.id) })),
      taxCodes: (taxCodes.length ? taxCodes : [{ id: 'TAX-STD', label: 'Standard Tax' }]).slice(0, 3).map((code) => ({ id: taxCodeIdFor(code), label: text(code.label || code.name || code.id) })),
    },
    unresolvedReferences: {
      itemPreferredSuppliers: unresolvedSuppliers,
    },
    skippedEntityGroups: ['procurementDocuments', 'inventoryBalancesAndMovements', 'supplierInvoices', 'threeWayMatches', 'actionDrafts', 'auditHistory'],
    mutatesSource: false,
  }
}
