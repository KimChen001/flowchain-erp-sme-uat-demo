import { buildHomeOverview, createBusinessReadContextService } from '../services/business-read-context-service.mjs'

export async function handleBusinessReadContextRoute(ctx) {
  const { req, res, url, send, repositories, dataMode } = ctx
  if (req.method !== 'GET') return false
  if (!['/api/business/read-context', '/api/home/overview'].includes(url.pathname)) return false
  const service = createBusinessReadContextService({ repositories, dataMode })
  const context = await service.read()
  send(res, 200, url.pathname === '/api/home/overview' ? buildHomeOverview(context) : context)
  return true
}
