import { searchRuntimeBusinessContext } from '../domain/runtime-business-search.mjs'
import { readBusinessContext } from '../services/runtime-business-read-service.mjs'

export async function handleSearchRoute(ctx) {
  const { req, res, url, send } = ctx

  if (req.method === 'GET' && url.pathname === '/api/search') {
    const query = String(url.searchParams.get('q') || '').trim()
    const limit = Number(url.searchParams.get('limit') || 15)
    const context = await readBusinessContext(ctx)
    const results = query ? searchRuntimeBusinessContext(context, query, { limit }) : []
    send(res, 200, { query, results, total: results.length, dataLimitations: context.dataLimitations })
    return true
  }

  return false
}
