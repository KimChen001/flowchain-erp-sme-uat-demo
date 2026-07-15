import { authorizeMutation } from '../domain/mutation-authorization.mjs'
import { createSalesOrderReadService, createSalesOrderWorkbenchService, SalesWorkbenchError } from '../domain/sales-order-workbench-service.mjs'
import { PilotIdentityError } from '../domain/pilot-identity.mjs'
import { getPrismaClient } from '../persistence/prisma-client.mjs'

const decode = (value) => decodeURIComponent(value)
function errorResponse(ctx, error) {
  if (!(error instanceof SalesWorkbenchError) && !(error instanceof PilotIdentityError)) throw error
  ctx.send(ctx.res, error.status || 400, { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) })
}

export async function handleSalesOrderWorkbenchRoute(ctx) {
  const path = ctx.url.pathname
  const collection = path === '/api/sales/orders'
  const detail = path.match(/^\/api\/sales\/orders\/([^/]+)$/)
  const transition = path.match(/^\/api\/sales\/orders\/([^/]+)\/(confirm|hold|resume)$/)
  if (!collection && !detail && !transition) return false
  if (!ctx.identity?.authenticated) { ctx.send(ctx.res, 401, { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication is required.' }); return true }
  if (String((ctx.env || process.env).FLOWCHAIN_PERSISTENCE_MODE || '').toLowerCase() !== 'database') { ctx.send(ctx.res, 409, { code: 'OUTBOUND_CAPABILITY_NOT_AVAILABLE', message: 'Authoritative sales orders require database persistence.' }); return true }
  const isRead = collection && ctx.req.method === 'GET'
  const isCreate = collection && ctx.req.method === 'POST'
  const isEdit = detail && ctx.req.method === 'PATCH'
  const isTransition = transition && ctx.req.method === 'POST'
  if (!isRead && !isCreate && !isEdit && !isTransition) return false
  const authorization = isRead ? null : authorizeMutation(ctx, { allowedRoles: ['admin', 'manager', 'business-specialist', 'business_specialist'], action: 'sales-order-lifecycle', resource: 'database-outbound' })
  if (authorization?.blocked) return true
  try {
    const prisma = ctx.outboundPrisma || await getPrismaClient(ctx.env || process.env)
    const context = { identity: isRead ? ctx.identity : authorization.identity }
    if (isRead) {
      const query = Object.fromEntries(ctx.url.searchParams.entries())
      ctx.send(ctx.res, 200, await createSalesOrderReadService({ prisma }).listOrders(query, context)); return true
    }
    const body = await ctx.readBody(ctx.req), service = createSalesOrderWorkbenchService({ prisma })
    if (isCreate) ctx.send(ctx.res, 201, await service.createOrder(body, context))
    else if (isEdit) ctx.send(ctx.res, 200, await service.reviseOrder(decode(detail[1]), body, context))
    else ctx.send(ctx.res, 200, await service[`${transition[2]}Order`](decode(transition[1]), body, context))
  } catch (error) { errorResponse(ctx, error) }
  return true
}
