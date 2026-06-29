import {
  buildProcurementDocumentLinks,
  buildProcurementDocuments,
  buildProcurementFollowups,
  buildProcurementSummary,
  filterProcurementRows,
  getProcurementDocument,
} from '../domain/procurement-read-model.mjs'

function query(url) {
  return {
    q: url.searchParams.get('q') || '',
    type: url.searchParams.get('type') || '',
    status: url.searchParams.get('status') || '',
    supplier: url.searchParams.get('supplier') || '',
    limit: url.searchParams.get('limit') || '',
  }
}

export async function handleProcurementReadRoute(ctx) {
  const { req, res, url, db, send } = ctx

  if (req.method === 'GET' && url.pathname === '/api/procurement/documents') {
    send(res, 200, { documents: filterProcurementRows(buildProcurementDocuments(db), query(url)) })
    return true
  }

  const documentMatch = url.pathname.match(/^\/api\/procurement\/documents\/([^/]+)\/([^/]+)$/)
  if (req.method === 'GET' && documentMatch) {
    const document = getProcurementDocument(db, documentMatch[1], documentMatch[2])
    if (!document) {
      send(res, 404, { error: 'Procurement document not found' })
      return true
    }
    send(res, 200, { document })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/procurement/links') {
    send(res, 200, { links: filterProcurementRows(buildProcurementDocumentLinks(db), query(url)) })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/procurement/followups') {
    send(res, 200, { followups: filterProcurementRows(buildProcurementFollowups(db), query(url)) })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/procurement/summary') {
    send(res, 200, { summary: buildProcurementSummary(db) })
    return true
  }

  return false
}
