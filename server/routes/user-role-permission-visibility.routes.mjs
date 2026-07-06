import { buildUserRolePermissionVisibilityV2 } from '../domain/user-role-permission-visibility-v2.mjs'

export async function handleUserRolePermissionVisibilityRoute(ctx) {
  const { req, res, url, db, send } = ctx

  if (req.method === 'GET' && url.pathname === '/api/user-role-permission-visibility') {
    send(res, 200, buildUserRolePermissionVisibilityV2(db))
    return true
  }

  return false
}
