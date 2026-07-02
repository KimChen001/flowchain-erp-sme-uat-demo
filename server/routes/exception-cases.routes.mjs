import { buildCaseNoteDraft, buildExceptionCaseDraftFromEvidence } from '../domain/exception-case-draft-builder.mjs'
import { createInMemoryExceptionCaseRepository } from '../repositories/exception-case-repository.mjs'

function repository(ctx) {
  return ctx.repositories?.exceptionCases || createInMemoryExceptionCaseRepository({ db: ctx.db })
}

function scopeFrom(ctx, body = {}) {
  return {
    tenantId: body.tenantId || ctx.req.headers['x-flowchain-tenant'] || 'demo-tenant',
    userId: body.userId || ctx.req.headers['x-flowchain-user'] || 'demo-user',
    dataMode: ctx.dataMode || body.dataMode || 'json',
  }
}

function sendError(send, res, error) {
  send(res, error?.status || 500, {
    error: error?.message || 'Exception case operation failed.',
    code: error?.code || 'EXCEPTION_CASE_OPERATION_FAILED',
    validation: error?.validation,
  })
}

export async function handleExceptionCasesRoute(ctx) {
  const { req, res, url, send, readBody } = ctx
  const repo = repository(ctx)

  if (req.method === 'GET' && url.pathname === '/api/exception-cases') {
    const filters = {
      status: url.searchParams.get('status') || '',
      caseType: url.searchParams.get('caseType') || '',
      severity: url.searchParams.get('severity') || '',
    }
    const cases = await repo.listCases(scopeFrom(ctx), filters)
    send(res, 200, { cases, createsBusinessDocument: false })
    return true
  }

  if (req.method === 'GET' && /^\/api\/exception-cases\/[^/]+$/.test(url.pathname)) {
    const caseId = decodeURIComponent(url.pathname.split('/').pop())
    const item = await repo.getCaseById(scopeFrom(ctx), caseId)
    if (!item) {
      send(res, 404, { error: 'Exception case not found.' })
      return true
    }
    send(res, 200, { case: item })
    return true
  }

  if (req.method === 'POST' && url.pathname === '/api/exception-cases/draft') {
    const body = await readBody(req)
    const draftInput = body.bundle || body.evidence || body.caseType ? buildExceptionCaseDraftFromEvidence(body) : body
    const draft = await repo.previewCaseDraft(scopeFrom(ctx, body), draftInput)
    send(res, 200, { draft, previewOnly: true, createsCaseRecord: false })
    return true
  }

  if (req.method === 'POST' && url.pathname === '/api/exception-cases') {
    const body = await readBody(req)
    try {
      const item = await repo.createCase(scopeFrom(ctx, body), body)
      ctx.event?.(ctx.db, 'exception_case_created', `Exception case ${item.caseId} created after user confirmation`, item.caseId)
      send(res, 201, { case: item, created: true, createsBusinessDocument: false })
    } catch (error) {
      sendError(send, res, error)
    }
    return true
  }

  if (req.method === 'POST' && /^\/api\/exception-cases\/[^/]+\/notes$/.test(url.pathname)) {
    const body = await readBody(req)
    const caseId = decodeURIComponent(url.pathname.split('/').at(-2))
    try {
      const item = await repo.addCaseNote(scopeFrom(ctx, body), caseId, body)
      if (!item) {
        send(res, 404, { error: 'Exception case not found.' })
        return true
      }
      send(res, 200, { case: item, noteSaved: true })
    } catch (error) {
      sendError(send, res, error)
    }
    return true
  }

  if (req.method === 'POST' && /^\/api\/exception-cases\/[^/]+\/status$/.test(url.pathname)) {
    const body = await readBody(req)
    const caseId = decodeURIComponent(url.pathname.split('/').at(-2))
    try {
      const item = await repo.updateCaseStatus(scopeFrom(ctx, body), caseId, body)
      if (!item) {
        send(res, 404, { error: 'Exception case not found.' })
        return true
      }
      send(res, 200, { case: item, statusUpdated: true })
    } catch (error) {
      sendError(send, res, error)
    }
    return true
  }

  if (req.method === 'POST' && /^\/api\/exception-cases\/[^/]+\/note-draft$/.test(url.pathname)) {
    const body = await readBody(req)
    const caseId = decodeURIComponent(url.pathname.split('/').at(-2))
    send(res, 200, { draft: buildCaseNoteDraft({ ...body, caseId }), previewOnly: true })
    return true
  }

  return false
}
