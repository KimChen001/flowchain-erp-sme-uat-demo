import {
  buildCustomerDeliveryRisks,
  buildSalesDemandReadModel,
  buildSalesDemandSummary,
  getSalesOrderById,
  listSalesOrders,
  resolvePurchaseOrderSalesImpact,
  resolveSalesDemandEvidence,
  resolveSkuDemandImpact,
} from '../domain/sales-demand-read-model.mjs'

function query(url) {
  return {
    q: url.searchParams.get('q') || '',
    sku: url.searchParams.get('sku') || '',
    status: url.searchParams.get('status') || '',
    risk: url.searchParams.get('risk') || '',
    limit: url.searchParams.get('limit') || '',
  }
}

function methodNotAllowed(ctx) {
  ctx.send(ctx.res, 405, { error: 'Method not allowed' })
  return true
}

export async function handleSalesDemandRoute(ctx) {
  const { req, res, url, db, send } = ctx

  if (url.pathname.startsWith('/api/sales-demand') && req.method !== 'GET') {
    return methodNotAllowed(ctx)
  }

  if (req.method === 'GET' && url.pathname === '/api/sales-demand/summary') {
    const model = buildSalesDemandReadModel(db)
    send(res, 200, { summary: buildSalesDemandSummary(db), evidenceLinks: model.evidenceLinks, dataLimitations: model.dataLimitations })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/sales-demand/orders') {
    const model = buildSalesDemandReadModel(db)
    send(res, 200, { orders: listSalesOrders(db, query(url)), summary: model.summary, evidenceLinks: model.evidenceLinks, dataLimitations: model.dataLimitations })
    return true
  }

  const orderMatch = url.pathname.match(/^\/api\/sales-demand\/orders\/([^/]+)$/)
  if (req.method === 'GET' && orderMatch) {
    const order = getSalesOrderById(db, orderMatch[1])
    if (!order) {
      send(res, 404, { error: 'Sales order not found', dataLimitations: ['record_not_found'] })
      return true
    }
    const evidence = resolveSalesDemandEvidence(db, orderMatch[1])
    send(res, 200, { order, evidenceLinks: evidence.evidenceLinks, dataLimitations: evidence.dataLimitations })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/sales-demand/risks') {
    const model = buildSalesDemandReadModel(db)
    send(res, 200, { risks: buildCustomerDeliveryRisks(db), summary: model.summary, evidenceLinks: model.evidenceLinks, dataLimitations: model.dataLimitations })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/sales-demand/impact') {
    const sku = url.searchParams.get('sku') || ''
    const impact = resolveSkuDemandImpact(db, sku)
    send(res, 200, impact)
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/sales-demand/po-impact') {
    const poId = url.searchParams.get('poId') || ''
    const impact = resolvePurchaseOrderSalesImpact(db, poId)
    send(res, 200, impact)
    return true
  }

  return false
}
