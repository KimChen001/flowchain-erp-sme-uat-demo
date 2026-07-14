import { buildRuntimeEvidenceGraph } from '../domain/runtime-evidence-graph.mjs'
import { readBusinessContext } from '../services/runtime-business-read-service.mjs'

function missingAnchor(ctx, entityType, entityId) {
  ctx.send(ctx.res, 404, { error: 'Evidence graph anchor not found', anchor: { entityType, entityId }, dataLimitations: ['record_not_found'] })
  return true
}

export async function handleEvidenceGraphRoute(ctx) {
  const { req, res, url, send } = ctx
  if (url.pathname.startsWith('/api/evidence-graph') && req.method !== 'GET') { send(res, 405, { error: 'Method not allowed' }); return true }
  if (req.method !== 'GET') return false
  let entityType = url.searchParams.get('entityType') || ''
  let entityId = url.searchParams.get('entityId') || ''
  const shortcuts = [
    [/^\/api\/evidence-graph\/sales-order\/([^/]+)$/, 'sales_order'], [/^\/api\/evidence-graph\/sku\/([^/]+)$/, 'item'],
    [/^\/api\/evidence-graph\/purchase-order\/([^/]+)$/, 'purchase_order'], [/^\/api\/evidence-graph\/purchase-request\/([^/]+)$/, 'purchase_request'],
    [/^\/api\/evidence-graph\/rfq\/([^/]+)$/, 'rfq'], [/^\/api\/evidence-graph\/receiving\/([^/]+)$/, 'receiving_doc'],
    [/^\/api\/evidence-graph\/supplier\/([^/]+)$/, 'supplier'], [/^\/api\/evidence-graph\/invoice\/([^/]+)$/, 'supplier_invoice'],
  ]
  if (!['/api/evidence-graph', '/api/evidence-graph/related'].includes(url.pathname)) {
    const matched = shortcuts.map(([pattern, type]) => ({ match: url.pathname.match(pattern), type })).find(row => row.match)
    if (!matched) return false
    entityType = matched.type; entityId = decodeURIComponent(matched.match[1])
  }
  const graph = buildRuntimeEvidenceGraph(await readBusinessContext(ctx), { entityType, entityId })
  if (graph.dataLimitations.includes('record_not_found')) return missingAnchor(ctx, entityType, entityId)
  send(res, 200, graph)
  return true
}
