import { createAuditLogRepository } from '../repositories/audit-log-repository.mjs'
import { listImportAuditEvents } from '../repositories/import-persistence-repository.mjs'
import { listReportViewAuditEvents } from '../repositories/report-view-repository.mjs'
import { listSettingsAuditEntries } from '../repositories/settings-runtime-repository.mjs'

function auditLogRepository(ctx) {
  return ctx.repositories?.auditLog || createAuditLogRepository(ctx.db)
}

export async function handleAuditLogRoute(ctx) {
  const { req, res, url, send } = ctx
  const repository = auditLogRepository(ctx)

  if (req.method === 'GET' && url.pathname === '/api/audit-log') {
    const entityType = url.searchParams.get('entityType') || ''
    const entityId = url.searchParams.get('entityId') || ''
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') || 100)))
    const entries = await repository.listAuditEntries({ entityType, entityId, limit })
    send(res, 200, [...listImportAuditEvents(), ...listReportViewAuditEvents(), ...listSettingsAuditEntries(), ...entries].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))).slice(0, limit))
    return true
  }

  return false
}
