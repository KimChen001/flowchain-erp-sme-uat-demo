import { buildCurrentContext, currentTenantContext } from '../domain/context.mjs'

export async function handleContextRoute(ctx) {
  const { req, res, url, db, send } = ctx

  if (req.method === 'GET' && url.pathname === '/api/me') {
    send(res, 200, buildCurrentContext(db, req.headers.authorization || ''))
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/tenants/current') {
    send(res, 200, currentTenantContext)
    return true
  }

  return false
}
