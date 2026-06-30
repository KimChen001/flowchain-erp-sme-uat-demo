import { createJsonProcurementReadRepository } from '../repositories/json-procurement-read-repository.mjs'

function query(url) {
  return {
    q: url.searchParams.get('q') || '',
    type: url.searchParams.get('type') || '',
    status: url.searchParams.get('status') || '',
    supplier: url.searchParams.get('supplier') || '',
    limit: url.searchParams.get('limit') || '',
  }
}

function procurementReadRepository(ctx) {
  return ctx.repositories?.procurementRead || createJsonProcurementReadRepository(ctx.db)
}

export async function handleProcurementReadRoute(ctx) {
  const { req, res, url, send } = ctx
  const repository = procurementReadRepository(ctx)

  if (req.method === 'GET' && url.pathname === '/api/procurement/documents') {
    const filters = query(url)
    if (filters.type && !repository.normalizeDocumentType(filters.type)) {
      send(res, 200, { documents: [] })
      return true
    }
    send(res, 200, { documents: repository.listDocuments(filters) })
    return true
  }

  const documentMatch = url.pathname.match(/^\/api\/procurement\/documents\/([^/]+)\/([^/]+)$/)
  if (req.method === 'GET' && documentMatch) {
    if (!repository.isDocumentType(documentMatch[1])) {
      send(res, 400, { error: 'Invalid procurement document type' })
      return true
    }
    const document = repository.getDocument(documentMatch[1], documentMatch[2])
    if (!document) {
      send(res, 404, { error: 'Procurement document not found' })
      return true
    }
    send(res, 200, { document })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/procurement/links') {
    send(res, 200, { links: repository.listLinks(query(url)) })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/procurement/followups') {
    send(res, 200, { followups: repository.listFollowups(query(url)) })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/procurement/summary') {
    send(res, 200, { summary: repository.getSummary() })
    return true
  }

  return false
}
