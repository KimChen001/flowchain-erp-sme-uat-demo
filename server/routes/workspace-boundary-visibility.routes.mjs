import { buildWorkspaceBoundaryVisibilityV2 } from '../domain/workspace-boundary-visibility-v2.mjs'

export async function handleWorkspaceBoundaryVisibilityRoute(ctx) {
  const { req, res, url, db, send } = ctx

  if (req.method === 'GET' && url.pathname === '/api/workspace-boundary-visibility') {
    send(res, 200, buildWorkspaceBoundaryVisibilityV2(db))
    return true
  }

  return false
}
