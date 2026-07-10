import { buildReportsAnalyticsV2 } from '../domain/reports-analytics-v2.mjs'
import { buildGovernedReport, getReportCatalog } from '../domain/report-semantic-layer.mjs'

export async function handleReportsAnalyticsRoute(ctx) {
  const { req, res, url, db, send, readBody } = ctx

  if (req.method === 'GET' && url.pathname === '/api/reports-analytics') {
    send(res, 200, buildReportsAnalyticsV2(db))
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/reports/catalog') {
    send(res, 200, getReportCatalog())
    return true
  }

  if (req.method === 'POST' && url.pathname === '/api/reports/query') {
    const body = await readBody(req)
    send(res, 200, buildGovernedReport(db, body))
    return true
  }

  const dashboardMatch = url.pathname.match(/^\/api\/reports\/(overview|procurement|sales|inventory|finance|suppliers)$/)
  if (req.method === 'GET' && dashboardMatch) {
    const filters = Object.fromEntries(url.searchParams.entries())
    send(res, 200, buildGovernedReport(db, { subject: dashboardMatch[1], filters }))
    return true
  }

  return false
}
