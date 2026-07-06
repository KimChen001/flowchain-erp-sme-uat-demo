import { buildPilotReadinessGovernanceV2 } from '../domain/pilot-readiness-governance-v2.mjs'

export async function handlePilotReadinessGovernanceRoute(ctx) {
  const { req, res, url, db, send } = ctx

  if (req.method === 'GET' && url.pathname === '/api/pilot-readiness-governance') {
    send(res, 200, buildPilotReadinessGovernanceV2(db))
    return true
  }

  return false
}
