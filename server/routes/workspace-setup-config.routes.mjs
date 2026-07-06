import { buildWorkspaceSetupConfigV2 } from '../domain/workspace-setup-config-v2.mjs'

export async function handleWorkspaceSetupConfigRoute(ctx) {
  const { req, res, url, db, send } = ctx

  if (req.method === 'GET' && url.pathname === '/api/workspace-setup-config') {
    send(res, 200, buildWorkspaceSetupConfigV2(db))
    return true
  }

  return false
}
