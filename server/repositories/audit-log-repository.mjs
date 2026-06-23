import { appendAuditEvent, ensureAuditLog } from '../domain/audit-foundation.mjs'

export function listAuditEvents(db = {}) {
  return ensureAuditLog(db)
}

export function recordAuditEvent(db = {}, entry = {}, options = {}) {
  return appendAuditEvent(db, entry, options)
}

