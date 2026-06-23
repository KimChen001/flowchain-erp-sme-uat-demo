import { listAuditEvents } from '../repositories/audit-log-repository.mjs'

export async function handleAuditLogRoute(ctx) {
  const { req, res, url, db, send } = ctx

  if (req.method === 'GET' && url.pathname === '/api/audit-log') {
    const entityType = url.searchParams.get('entityType') || ''
    const entityId = url.searchParams.get('entityId') || ''
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') || 100)))
    const entries = listAuditEvents(db)
      .filter((entry) => !entityType || entry.entityType === entityType)
      .filter((entry) => !entityId || entry.entityId === entityId)
      .slice(0, limit)
    return send(res, 200, entries)
  }

  return false
}
