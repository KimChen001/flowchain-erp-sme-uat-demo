import { buildAuditIntegrationHistoryV2 } from '../domain/audit-integration-history-v2.mjs'

export async function handleAuditIntegrationHistoryRoute(ctx) {
  const { req, res, url, db, send } = ctx

  if (req.method === 'GET' && url.pathname === '/api/audit-integration-history') {
    send(res, 200, buildAuditIntegrationHistoryV2(db))
    return true
  }

  return false
}
