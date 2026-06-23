import {
  findMasterItem,
  findMasterSupplier,
  listMasterItems,
  listMasterSuppliers,
  listMasterWarehouses,
  listPaymentTerms,
  listTaxCodes,
} from '../domain/master-data.mjs'

export async function handleMasterDataRoute(ctx) {
  const { req, res, url, db, send } = ctx

  if (req.method === 'GET' && url.pathname === '/api/master-data/items') {
    send(res, 200, { items: listMasterItems(db) })
    return true
  }

  const itemMatch = url.pathname.match(/^\/api\/master-data\/items\/([^/]+)$/)
  if (req.method === 'GET' && itemMatch) {
    const item = findMasterItem(db, itemMatch[1])
    if (!item) {
      send(res, 404, { error: 'Item not found' })
      return true
    }
    send(res, 200, { item })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/master-data/suppliers') {
    send(res, 200, { suppliers: listMasterSuppliers(db) })
    return true
  }

  const supplierMatch = url.pathname.match(/^\/api\/master-data\/suppliers\/([^/]+)$/)
  if (req.method === 'GET' && supplierMatch) {
    const supplier = findMasterSupplier(db, supplierMatch[1])
    if (!supplier) {
      send(res, 404, { error: 'Supplier not found' })
      return true
    }
    send(res, 200, { supplier })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/master-data/warehouses') {
    send(res, 200, { warehouses: listMasterWarehouses(db) })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/master-data/payment-terms') {
    send(res, 200, { paymentTerms: listPaymentTerms(db) })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/master-data/tax-codes') {
    send(res, 200, { taxCodes: listTaxCodes(db) })
    return true
  }

  return false
}

