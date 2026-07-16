import { resolveCurrentUser } from '../domain/context.mjs'
import { cloneReportView, createReportView, deleteReportView, getReportView, listReportViews, updateReportView } from '../repositories/report-view-repository.mjs'

function actorFrom(ctx) {
  if (ctx.identity?.authenticated) return { id: ctx.identity.userId, name: ctx.identity.name, role: ctx.identity.role }
  const user = resolveCurrentUser(ctx.db, ctx.req.headers.authorization || '')
  const requested = String(ctx.req.headers['x-flowchain-role'] || user.role || '').toLowerCase()
  const role = /admin|管理员/.test(requested) ? 'admin' : /manager|经理|approver/.test(requested) ? 'manager' : /viewer|只读/.test(requested) ? 'viewer' : 'analyst'
  return { id: String(ctx.req.headers['x-flowchain-user'] || user.id), name: user.name, role }
}

export async function handleReportViewsRoute(ctx) {
  const { req, res, url, send, readBody } = ctx; const actor = actorFrom(ctx)
  if (req.method === 'GET' && url.pathname === '/api/report-views') { send(res, 200, { views: listReportViews(actor, { visibility: url.searchParams.get('visibility') || '' }), actor }); return true }
  if (req.method === 'POST' && url.pathname === '/api/report-views') { const result = createReportView(await readBody(req), actor); send(res, result.status, result); return true }
  const cloneMatch = url.pathname.match(/^\/api\/report-views\/([^/]+)\/clone$/)
  if (req.method === 'POST' && cloneMatch) { const result = cloneReportView(decodeURIComponent(cloneMatch[1]), await readBody(req), actor); send(res, result.status, result); return true }
  const shareMatch = url.pathname.match(/^\/api\/report-views\/([^/]+)\/share$/)
  if (req.method === 'POST' && shareMatch) { const body = await readBody(req); const result = updateReportView(decodeURIComponent(shareMatch[1]), { visibility: body.visibility || 'team' }, actor); send(res, result.status, result); return true }
  const match = url.pathname.match(/^\/api\/report-views\/([^/]+)$/)
  if (req.method === 'GET' && match) { const view = getReportView(decodeURIComponent(match[1]), actor); send(res, view ? 200 : 404, view || { error: 'Report view not found.' }); return true }
  if (req.method === 'PUT' && match) { const result = updateReportView(decodeURIComponent(match[1]), await readBody(req), actor); send(res, result.status, result); return true }
  if (req.method === 'DELETE' && match) { const result = deleteReportView(decodeURIComponent(match[1]), actor); send(res, result.status, result); return true }
  return false
}
