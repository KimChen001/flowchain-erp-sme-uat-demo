import { buildReportsAnalyticsV2 } from '../domain/reports-analytics-v2.mjs'

export async function handleReportsAnalyticsRoute(ctx) {
  const { req, res, url, db, send } = ctx

  if (req.method === 'GET' && url.pathname === '/api/reports-analytics') {
    send(res, 200, buildReportsAnalyticsV2(db))
    return true
  }

  return false
}
