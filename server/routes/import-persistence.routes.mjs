import { resolveCurrentUser } from '../domain/context.mjs'
import {
  commitImportPreview,
  createImportPreview,
  getImportBatch,
  importBusinessConfigs,
  listImportBatches,
  rollbackImportBatch,
} from '../repositories/import-persistence-repository.mjs'

function roleFor(user = {}) {
  const raw = String(user.role || '').toLowerCase()
  if (/admin|管理员/.test(raw)) return 'admin'
  if (/manager|经理|approver|供应链经理/.test(raw)) return 'manager'
  if (/viewer|只读/.test(raw)) return 'viewer'
  return 'analyst'
}

function baselineFor(db = {}, schemaId = '') {
  const config = importBusinessConfigs[schemaId]
  if (!config) return []
  if (config.collection === 'purchaseRequests') return db.purchaseRequests || []
  if (config.collection === 'suppliers') return db.suppliers || []
  if (config.collection === 'products') return db.products || []
  return Array.isArray(db[config.collection]) ? db[config.collection] : []
}

export async function handleImportPersistenceRoute(ctx) {
  const { req, res, url, db, send, readBody } = ctx
  const user = resolveCurrentUser(db, req.headers.authorization || '')

  if (req.method === 'POST' && url.pathname === '/api/imports/preview') {
    const body = await readBody(req)
    const result = createImportPreview(body, { actor: user.name, relationships: {
      skus: (db.products || []).map((row) => String(row.sku || row.itemSku || '')),
      suppliers: (db.suppliers || []).flatMap((row) => [row.code, row.id, row.name].filter(Boolean).map(String)),
      purchaseOrders: (db.purchaseOrders || []).map((row) => String(row.po || row.id || '')),
      receivingDocs: (db.receivingDocs || []).map((row) => String(row.grn || row.id || '')),
    } })
    send(res, result.ok ? 200 : result.status || 422, result)
    return true
  }

  const commitMatch = url.pathname.match(/^\/api\/imports\/([^/]+)\/commit$/)
  if (req.method === 'POST' && commitMatch) {
    const body = await readBody(req)
    const previewId = decodeURIComponent(commitMatch[1])
    const result = commitImportPreview(previewId, body, { actor: user.name, baselineRecords: baselineFor(db, String(body.businessObject || body.schemaId || '')) })
    send(res, result.ok ? 201 : result.status || 422, result)
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/import-batches') {
    send(res, 200, { batches: listImportBatches() })
    return true
  }

  const batchMatch = url.pathname.match(/^\/api\/import-batches\/([^/]+)$/)
  if (req.method === 'GET' && batchMatch) {
    const batch = getImportBatch(decodeURIComponent(batchMatch[1]))
    send(res, batch ? 200 : 404, batch || { error: 'Import batch not found.' })
    return true
  }

  const rollbackMatch = url.pathname.match(/^\/api\/import-batches\/([^/]+)\/rollback$/)
  if (req.method === 'POST' && rollbackMatch) {
    const body = await readBody(req)
    const result = rollbackImportBatch(decodeURIComponent(rollbackMatch[1]), body, { actor: user.name, role: roleFor({ role: req.headers['x-flowchain-role'] || user.role }) })
    send(res, result.ok ? 200 : result.status || 422, result)
    return true
  }

  return false
}
