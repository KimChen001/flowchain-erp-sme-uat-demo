import { createAuditLogRepository } from '../repositories/audit-log-repository.mjs'
import { listImportAuditEvents } from '../repositories/import-persistence-repository.mjs'
import { listReportViewAuditEvents } from '../repositories/report-view-repository.mjs'
import { getDefaultSettingsRuntimeRepository } from '../repositories/settings-runtime-repository.mjs'
import { getPrismaClient } from '../persistence/prisma-client.mjs'
import { resolveProvisionedActor } from '../domain/pilot-identity.mjs'
import { assertAuthorized, can } from '../auth/authorization-service.mjs'

function auditLogRepository(ctx) {
  return ctx.repositories?.auditLog || createAuditLogRepository(ctx.db)
}

export async function handleAuditLogRoute(ctx) {
  const { req, res, url, send } = ctx
  const repository = auditLogRepository(ctx)

  if (req.method === 'GET' && url.pathname === '/api/audit-log') {
    const databaseMode = String((ctx.env || process.env).FLOWCHAIN_PERSISTENCE_MODE || '').toLowerCase() === 'database'
    let sensitive = true
    if (databaseMode) {
      const actor = await resolveProvisionedActor(await getPrismaClient(ctx.env || process.env), ctx.identity)
      assertAuthorized({ actor, permission: 'audit.read', tenantId: actor.tenantId })
      sensitive = can({ actor, permission: 'audit.read_sensitive', tenantId: actor.tenantId })
    }
    const entityType = url.searchParams.get('entityType') || ''
    const entityId = url.searchParams.get('entityId') || ''
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') || 100)))
    const entries = await repository.listAuditEntries({ ...(ctx.identity?.tenantId ? { tenantId: ctx.identity.tenantId } : {}), entityType, entityId, limit })
    const settingsAudit = databaseMode ? [] : await (ctx.repositories?.settingsRuntime || getDefaultSettingsRuntimeRepository()).listSettingsAuditEntries()
    const visible = [...listImportAuditEvents(), ...listReportViewAuditEvents(), ...settingsAudit, ...entries].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))).slice(0, limit).map(entry => sensitive ? entry : { ...entry, metadata: null, before: entry.before === undefined ? undefined : null, after: entry.after === undefined ? undefined : null, redacted: true, fieldVisibility: { metadata: { visible: false, reasonCode: 'FIELD_PERMISSION_DENIED', permission: 'audit.read_sensitive' } } })
    send(res, 200, visible)
    return true
  }

  return false
}
