export const auditSources = new Set(['manual', 'ai_assisted', 'system'])

export const auditActions = new Set([
  'user_context_loaded',
  'tenant_context_loaded',
  'ai_chat_requested',
  'ai_tool_invoked',
  'ai_draft_prepared',
  'document_draft_saved',
  'document_status_changed',
  'inventory_movement_recorded',
  'grn_posted',
])

function compactObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined))
}

function nextAuditId(now = new Date()) {
  const stamp = now.toISOString().slice(0, 10).replace(/-/g, '')
  return `AUD-${stamp}-${String(now.getTime()).slice(-6)}`
}

export function normalizeAuditEvent(entry = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date()
  const source = auditSources.has(entry.source) ? entry.source : 'system'
  return {
    id: entry.id || entry.auditId || nextAuditId(now),
    tenantId: entry.tenantId || 'tenant-flowchain-sme',
    timestamp: entry.timestamp || now.toISOString(),
    actor: compactObject(entry.actor || {
      type: 'system',
      id: 'system',
      name: 'System',
      role: 'system',
    }),
    source,
    module: entry.module || 'system',
    action: entry.action || 'document_status_changed',
    entity: compactObject(entry.entity || {
      type: entry.entityType || 'system',
      id: entry.entityId || '',
    }),
    summary: entry.summary || entry.reason || '',
    before: entry.before ?? null,
    after: entry.after ?? null,
    metadata: entry.metadata || {},
  }
}

export function ensureAuditLog(db = {}) {
  if (!Array.isArray(db.auditLog)) db.auditLog = []
  return db.auditLog
}

export function appendAuditEvent(db = {}, entry = {}, options = {}) {
  const auditLog = ensureAuditLog(db)
  const record = normalizeAuditEvent(entry, options)
  auditLog.unshift(record)
  db.auditLog = auditLog.slice(0, 500)
  return record
}

