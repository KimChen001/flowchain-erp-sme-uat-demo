import { authorizeMutation } from '../domain/mutation-authorization.mjs'
import { createSalesOrderReadService, createSalesOrderWorkbenchService, SalesWorkbenchError } from '../domain/sales-order-workbench-service.mjs'
import { PilotIdentityError } from '../domain/pilot-identity.mjs'
import { createOutboundWorkbenchReadService } from '../domain/outbound-workbench-read-service.mjs'
import { getPrismaClient } from '../persistence/prisma-client.mjs'

const decode = (value) => decodeURIComponent(value)
function errorResponse(ctx, error) {
  if (!(error instanceof SalesWorkbenchError) && !(error instanceof PilotIdentityError)) throw error
  ctx.send(ctx.res, error.status || 400, { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) })
}

export async function handleSalesOrderWorkbenchRoute(ctx) {
  const path = ctx.url.pathname
  const collection = path === '/api/sales/orders'
  const entryData = path === '/api/sales/order-entry-data'
  const detail = path.match(/^\/api\/sales\/orders\/([^/]+)$/)
  const transition = path.match(/^\/api\/sales\/orders\/([^/]+)\/(confirm|hold|resume)$/)
  const orderRead = path.match(/^\/api\/sales\/orders\/([^/]+)\/(workbench|evidence|links|reconciliation)$/)
  const shipmentRead = path.match(/^\/api\/sales\/shipments\/([^/]+)\/(workbench|evidence|links|reconciliation)$/)
  if (!collection && !entryData && !detail && !transition && !orderRead && !shipmentRead) return false
  if (!ctx.identity?.authenticated) { ctx.send(ctx.res, 401, { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication is required.' }); return true }
  if (String((ctx.env || process.env).FLOWCHAIN_PERSISTENCE_MODE || '').toLowerCase() !== 'database') { ctx.send(ctx.res, 409, { code: 'OUTBOUND_CAPABILITY_NOT_AVAILABLE', message: 'Authoritative sales orders require database persistence.' }); return true }
  const isRead = (collection || entryData || orderRead || shipmentRead) && ctx.req.method === 'GET'
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
      if (entryData) { ctx.send(ctx.res, 200, await createSalesOrderReadService({ prisma }).entryData(context)); return true }
      if (orderRead || shipmentRead) {
        const service = createOutboundWorkbenchReadService({ prisma })
        const result = orderRead ? await service.orderWorkbench(decode(orderRead[1]), context) : await service.shipmentWorkbench(decode(shipmentRead[1]), context)
        const section = (orderRead || shipmentRead)[2]
        ctx.send(ctx.res, 200, section === 'workbench' ? result : result[section]); return true
      }
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
