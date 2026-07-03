import {
  buildEvidenceGraph,
  resolveRelatedRecords,
  traceInvoiceEvidence,
  tracePurchaseOrderDeliveryImpact,
  traceReceivingEvidence,
  traceSalesOrderEvidence,
  traceSkuSupplyDemandEvidence,
  traceSupplierOperationalEvidence,
} from '../domain/evidence-graph-read-model.mjs'

function methodNotAllowed(ctx) {
  ctx.send(ctx.res, 405, { error: 'Method not allowed' })
  return true
}

function depth(url) {
  const value = Number(url.searchParams.get('depth') || 2)
  return Number.isFinite(value) ? Math.max(1, Math.min(3, value)) : 2
}

function missingAnchor(send, res, entityType = '', entityId = '') {
  send(res, 404, {
    error: 'Evidence graph anchor not found',
    anchor: { entityType, entityId },
    dataLimitations: ['record_not_found'],
  })
  return true
}

function sendGraph(send, res, graph) {
  if (graph.dataLimitations?.includes('record_not_found') && graph.nodes.length <= 1) {
    return missingAnchor(send, res, graph.anchor?.type, graph.anchor?.id)
  }
  send(res, 200, graph)
  return true
}

export async function handleEvidenceGraphRoute(ctx) {
  const { req, res, url, db, send } = ctx

  if (url.pathname.startsWith('/api/evidence-graph') && req.method !== 'GET') {
    return methodNotAllowed(ctx)
  }

  if (req.method === 'GET' && url.pathname === '/api/evidence-graph') {
    const entityType = url.searchParams.get('entityType') || ''
    const entityId = url.searchParams.get('entityId') || ''
    return sendGraph(send, res, buildEvidenceGraph(db, { entityType, entityId, depth: depth(url) }))
  }

  if (req.method === 'GET' && url.pathname === '/api/evidence-graph/related') {
    const entityType = url.searchParams.get('entityType') || ''
    const entityId = url.searchParams.get('entityId') || ''
    const result = resolveRelatedRecords(db, { entityType, entityId, depth: depth(url) })
    if (result.dataLimitations?.includes('record_not_found') && result.nodes.length <= 1) return missingAnchor(send, res, entityType, entityId)
    send(res, 200, result)
    return true
  }

  const salesOrder = url.pathname.match(/^\/api\/evidence-graph\/sales-order\/([^/]+)$/)
  if (req.method === 'GET' && salesOrder) return sendGraph(send, res, traceSalesOrderEvidence(db, salesOrder[1]))

  const sku = url.pathname.match(/^\/api\/evidence-graph\/sku\/([^/]+)$/)
  if (req.method === 'GET' && sku) return sendGraph(send, res, traceSkuSupplyDemandEvidence(db, sku[1]))

  const po = url.pathname.match(/^\/api\/evidence-graph\/purchase-order\/([^/]+)$/)
  if (req.method === 'GET' && po) return sendGraph(send, res, tracePurchaseOrderDeliveryImpact(db, po[1]))

  const pr = url.pathname.match(/^\/api\/evidence-graph\/purchase-request\/([^/]+)$/)
  if (req.method === 'GET' && pr) return sendGraph(send, res, buildEvidenceGraph(db, { entityType: 'purchase_request', entityId: pr[1], depth: depth(url) }))

  const rfq = url.pathname.match(/^\/api\/evidence-graph\/rfq\/([^/]+)$/)
  if (req.method === 'GET' && rfq) return sendGraph(send, res, buildEvidenceGraph(db, { entityType: 'rfq', entityId: rfq[1], depth: depth(url) }))

  const receiving = url.pathname.match(/^\/api\/evidence-graph\/receiving\/([^/]+)$/)
  if (req.method === 'GET' && receiving) return sendGraph(send, res, traceReceivingEvidence(db, receiving[1]))

  const supplier = url.pathname.match(/^\/api\/evidence-graph\/supplier\/([^/]+)$/)
  if (req.method === 'GET' && supplier) return sendGraph(send, res, traceSupplierOperationalEvidence(db, supplier[1]))

  const invoice = url.pathname.match(/^\/api\/evidence-graph\/invoice\/([^/]+)$/)
  if (req.method === 'GET' && invoice) return sendGraph(send, res, traceInvoiceEvidence(db, invoice[1]))

  return false
}
