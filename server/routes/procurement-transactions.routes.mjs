import { createInMemoryProcurementTransactionRepository } from '../repositories/procurement-transaction-repository.mjs'

function repository(ctx = {}) {
  return ctx.repositories?.procurementTransactions || createInMemoryProcurementTransactionRepository({ db: ctx.db })
}

function scopeFrom(ctx = {}, body = {}) {
  return {
    tenantId: body.scope?.tenantId || body.tenantId || ctx.req.headers['x-flowchain-tenant'] || 'tenant-flowchain-sme',
    userId: body.scope?.userId || body.userId || body.actor || ctx.req.headers['x-flowchain-user'] || 'user-local',
    dataMode: body.scope?.dataMode || body.dataMode || ctx.dataMode || 'json',
  }
}

async function sendError(send, res, error) {
  send(res, error?.status || 500, {
    ok: false,
    error: error?.message || 'Procurement transaction operation failed.',
    code: error?.code || 'PROCUREMENT_TRANSACTION_FAILED',
    response: error?.response,
    writesFiles: false,
    overwritesDemoData: false,
    mutatesLinkedBusinessRecords: false,
  })
}

export async function handleProcurementTransactionsRoute(ctx) {
  const { req, res, url, send, readBody } = ctx
  const repo = repository(ctx)

  if (req.method === 'GET' && url.pathname === '/api/procurement/transaction-baseline') {
    send(res, 200, { baseline: await repo.getBaseline(), provider: 'local', mutationAllowed: false })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/procurement/transaction-chain') {
    const scope = scopeFrom(ctx, {
      tenantId: url.searchParams.get('tenantId'),
      userId: url.searchParams.get('userId'),
      dataMode: url.searchParams.get('dataMode'),
    })
    send(res, 200, { chain: await repo.getChain(scope, { prId: url.searchParams.get('prId') || '', rfqId: url.searchParams.get('rfqId') || '' }) })
    return true
  }

  const prDetailMatch = url.pathname.match(/^\/api\/procurement\/purchase-requests\/([^/]+)\/operational-detail$/)
  if (req.method === 'GET' && prDetailMatch) {
    const detail = await repo.getPurchaseRequestDetail(decodeURIComponent(prDetailMatch[1]), scopeFrom(ctx))
    if (!detail) send(res, 404, { ok: false, error: 'Purchase request not found.' })
    else send(res, 200, { detail, writesFiles: false, mutatesLinkedBusinessRecords: false })
    return true
  }

  if (req.method === 'POST' && url.pathname === '/api/procurement/rfq-drafts/from-pr') {
    const body = await readBody(req)
    try {
      const result = await repo.createRfqDraftFromPr(body, scopeFrom(ctx, body))
      send(res, result.ok ? 201 : 422, result)
    } catch (error) {
      await sendError(send, res, error)
    }
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/procurement/supplier-responses') {
    const scope = scopeFrom(ctx, {
      tenantId: url.searchParams.get('tenantId'),
      userId: url.searchParams.get('userId'),
      dataMode: url.searchParams.get('dataMode'),
    })
    send(res, 200, { responses: await repo.listSupplierResponses(scope, { rfqId: url.searchParams.get('rfqId') || '' }) })
    return true
  }

  if (req.method === 'POST' && url.pathname === '/api/procurement/supplier-responses') {
    const body = await readBody(req)
    try {
      send(res, 201, { ok: true, response: await repo.createSupplierResponse(body, scopeFrom(ctx, body)), writesFiles: false, mutatesSupplierMaster: false })
    } catch (error) {
      await sendError(send, res, error)
    }
    return true
  }

  if (req.method === 'POST' && url.pathname === '/api/procurement/supplier-responses/compare') {
    const body = await readBody(req)
    try {
      send(res, 200, { ok: true, comparison: await repo.compareResponses(body, scopeFrom(ctx, body)) })
    } catch (error) {
      await sendError(send, res, error)
    }
    return true
  }

  if (req.method === 'POST' && url.pathname === '/api/procurement/award-recommendations/draft') {
    const body = await readBody(req)
    try {
      send(res, 201, { ok: true, recommendation: await repo.buildAwardRecommendation(body, scopeFrom(ctx, body)) })
    } catch (error) {
      await sendError(send, res, error)
    }
    return true
  }

  if (req.method === 'POST' && url.pathname === '/api/procurement/po-drafts/from-award') {
    const body = await readBody(req)
    try {
      send(res, 201, { ok: true, poDraft: await repo.buildPoDraft(body, scopeFrom(ctx, body)) })
    } catch (error) {
      await sendError(send, res, error)
    }
    return true
  }

  return false
}
