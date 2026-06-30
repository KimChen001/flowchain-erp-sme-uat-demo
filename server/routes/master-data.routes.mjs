import { createJsonMasterDataRepository } from '../repositories/json-master-data-repository.mjs'

function masterDataRepository(ctx) {
  return ctx.repositories?.masterData || createJsonMasterDataRepository(ctx.db)
}

export async function handleMasterDataRoute(ctx) {
  const { req, res, url, send } = ctx
  const repository = masterDataRepository(ctx)

  if (req.method === 'GET' && url.pathname === '/api/master-data/items') {
    send(res, 200, { items: repository.listItems() })
    return true
  }

  const itemMatch = url.pathname.match(/^\/api\/master-data\/items\/([^/]+)$/)
  if (req.method === 'GET' && itemMatch) {
    const item = repository.getItem(itemMatch[1])
    if (!item) {
      send(res, 404, { error: 'Item not found' })
      return true
    }
    send(res, 200, { item })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/master-data/suppliers') {
    send(res, 200, { suppliers: repository.listSuppliers() })
    return true
  }

  const supplierMatch = url.pathname.match(/^\/api\/master-data\/suppliers\/([^/]+)$/)
  if (req.method === 'GET' && supplierMatch) {
    const supplier = repository.getSupplier(supplierMatch[1])
    if (!supplier) {
      send(res, 404, { error: 'Supplier not found' })
      return true
    }
    send(res, 200, { supplier })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/master-data/warehouses') {
    send(res, 200, { warehouses: repository.listWarehouses() })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/master-data/payment-terms') {
    send(res, 200, { paymentTerms: repository.listPaymentTerms() })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/master-data/tax-codes') {
    send(res, 200, { taxCodes: repository.listTaxCodes() })
    return true
  }

  return false
}
