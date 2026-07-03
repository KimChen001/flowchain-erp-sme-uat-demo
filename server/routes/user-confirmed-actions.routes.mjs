import {
  BUSINESS_ACTION_EXECUTION_BASELINE,
  buildUserConfirmedActionAuditEntry,
  validateUserConfirmedActionRequest,
} from '../domain/user-confirmed-business-action.mjs'
import { createInMemoryUserConfirmedActionRepository } from '../repositories/user-confirmed-action-repository.mjs'

function repository(ctx = {}) {
  return ctx.repositories?.userConfirmedActions || createInMemoryUserConfirmedActionRepository({ db: ctx.db })
}

function text(value = '') {
  return String(value ?? '').trim()
}

function scopeFrom(ctx = {}, body = {}) {
  return {
    tenantId: body.scope?.tenantId || body.tenantId || ctx.req.headers['x-flowchain-tenant'] || 'tenant-flowchain-sme',
    userId: body.scope?.userId || body.userId || body.actor || ctx.req.headers['x-flowchain-user'] || 'user-local',
    dataMode: body.scope?.dataMode || body.dataMode || ctx.dataMode || 'json',
  }
}

async function recordAuditBestEffort(ctx = {}, record = {}) {
  try {
    if (ctx.repositories?.auditLog?.recordAuditEntry) {
      return await ctx.repositories.auditLog.recordAuditEntry(buildUserConfirmedActionAuditEntry(record))
    }
  } catch {}
  return null
}

export async function handleUserConfirmedActionsRoute(ctx) {
  const { req, res, url, send, readBody } = ctx
  const repo = repository(ctx)

  if (req.method === 'GET' && url.pathname === '/api/user-confirmed-actions/baseline') {
    send(res, 200, {
      baseline: BUSINESS_ACTION_EXECUTION_BASELINE,
      provider: 'local',
      mutationAllowed: false,
      autonomousExecutionAllowed: false,
    })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/user-confirmed-actions') {
    const scope = scopeFrom(ctx, {
      tenantId: url.searchParams.get('tenantId'),
      userId: url.searchParams.get('userId'),
      dataMode: url.searchParams.get('dataMode'),
    })
    const actions = await repo.listConfirmedActions(scope, {
      actionType: text(url.searchParams.get('actionType')),
      createdRecordType: text(url.searchParams.get('createdRecordType')),
    })
    send(res, 200, { actions, scope, writesFiles: false, overwritesDemoData: false })
    return true
  }

  if (req.method === 'POST' && url.pathname === '/api/user-confirmed-actions/validate') {
    const body = await readBody(req)
    const validation = validateUserConfirmedActionRequest({ ...body, scope: scopeFrom(ctx, body) })
    send(res, validation.ok ? 200 : 422, validation)
    return true
  }

  if (req.method === 'POST' && url.pathname === '/api/user-confirmed-actions') {
    const body = await readBody(req)
    try {
      const record = await repo.executeConfirmedAction({ ...body, scope: scopeFrom(ctx, body) })
      const auditEvent = await recordAuditBestEffort(ctx, record)
      send(res, 201, {
        ok: true,
        action: record,
        createdRecord: record.createdRecord,
        createdRecordId: record.createdRecordId,
        status: record.status,
        auditEventId: auditEvent?.id || null,
        sideEffects: record.sideEffects,
        writesFiles: false,
        overwritesDemoData: false,
        mutatesLinkedBusinessRecords: false,
      })
    } catch (error) {
      send(res, error?.status || 500, {
        ok: false,
        error: error?.message || 'User-confirmed action failed.',
        code: error?.code || 'USER_CONFIRMED_ACTION_FAILED',
        validation: error?.validation,
        writesFiles: false,
        overwritesDemoData: false,
        mutatesLinkedBusinessRecords: false,
      })
    }
    return true
  }

  return false
}
