import { buildRuntimeGovernedReport, getRuntimeReportCatalog } from '../domain/runtime-report-read-model.mjs'
import { readBusinessContext } from '../services/runtime-business-read-service.mjs'

export async function handleReportsAnalyticsRoute(ctx) {
  const { req, res, url, send, readBody } = ctx

  if (req.method === 'GET' && url.pathname === '/api/reports-analytics') {
    send(res, 200, buildRuntimeGovernedReport(await readBusinessContext(ctx), { subject: 'overview' }))
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/reports/catalog') {
    send(res, 200, getRuntimeReportCatalog())
    return true
  }

  if (req.method === 'POST' && url.pathname === '/api/reports/query') {
    const body = await readBody(req)
    send(res, 200, buildRuntimeGovernedReport(await readBusinessContext(ctx), body))
    return true
  }

  const dashboardMatch = url.pathname.match(/^\/api\/reports\/(overview|procurement|sales|inventory|finance|suppliers)$/)
  if (req.method === 'GET' && dashboardMatch) {
    const filters = Object.fromEntries(url.searchParams.entries())
    send(res, 200, buildRuntimeGovernedReport(await readBusinessContext(ctx), { subject: dashboardMatch[1], filters }))
    return true
  }

  return false
}
