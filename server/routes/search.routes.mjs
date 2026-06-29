import { searchGlobalBusinessRecords } from '../domain/global-business-search.mjs'

export async function handleSearchRoute(ctx) {
  const { req, res, url, db, send } = ctx

  if (req.method === 'GET' && url.pathname === '/api/search') {
    const query = String(url.searchParams.get('q') || '').trim()
    const limit = Number(url.searchParams.get('limit') || 15)
    const results = query ? searchGlobalBusinessRecords(query, db, { limit }) : []
    send(res, 200, { query, results, total: results.length })
    return true
  }

  return false
}
