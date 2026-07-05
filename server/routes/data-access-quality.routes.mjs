import { buildDataAccessQualityV2 } from '../domain/data-access-quality-v2.mjs'

export async function handleDataAccessQualityRoute(ctx) {
  const { req, res, url, db, send } = ctx

  if (req.method === 'GET' && url.pathname === '/api/data-access-quality') {
    send(res, 200, buildDataAccessQualityV2(db))
    return true
  }

  return false
}
