import { resolveAuthorizationContext } from "../auth/authorization-service.mjs"
import { defaultRoleTemplates, legacyRoleTemplateMap } from "../auth/permission-catalog.mjs"

export class PilotIdentityError extends Error {
  constructor(code, message, status = 400, details) {
    super(message)
    this.name = 'PilotIdentityError'
    this.code = code
    this.status = status
    this.details = details
  }
}

const fail = (code, message, status, details) => { throw new PilotIdentityError(code, message, status, details) }
const text = value => String(value ?? '').trim()
const testPermissionCodes = role => {
  const roleKey = legacyRoleTemplateMap[text(role).toLowerCase()] || 'read-only-viewer'
  return new Set(defaultRoleTemplates.find(template => template.roleKey === roleKey)?.permissions || [])
}

export async function resolveProvisionedActor(prisma, identity, { allowMissingTestActor = false } = {}) {
  if (!identity?.authenticated) fail('AUTHENTICATION_REQUIRED', 'Authentication is required.', 401)
  const tenantId = text(identity.tenantId)
  const userId = text(identity.userId)
  if (!tenantId || !userId) fail('TENANT_CONTEXT_REQUIRED', 'A server-resolved tenant and actor are required.', 403)
  const user = await prisma.user.findFirst({ where: { id: userId, tenantId }, include: { warehouseScopes: true } })
  if (!user) {
    if (allowMissingTestActor && identity.source === 'test') return { user: { id: userId, tenantId, role: identity.role, status: 'active' }, tenantId, role: text(identity.role).toLowerCase(), complete: true, authenticated: true, permissionCodes: testPermissionCodes(identity.role), roleIds: [], permissionSourceRoleIds: new Map(), allWarehouses: true, readWarehouseIds: null, operateWarehouseIds: null }
    fail('ACTOR_NOT_PROVISIONED', 'The authenticated user is not provisioned for this workspace.', 403)
  }
  if (user.status !== 'active') fail('USER_DISABLED', 'The workspace user is disabled.', 403)
  const role = text(user.role).toLowerCase()
  if (text(identity.role).toLowerCase() !== role) fail('SESSION_STALE', 'User authorization changed. Sign in again.', 401)
  const authorization = await resolveAuthorizationContext(identity, { prisma })
  if (allowMissingTestActor && identity.source === 'test' && !authorization.complete) return { user, tenantId, role, ...authorization, allWarehouses: true, readWarehouseIds: null, operateWarehouseIds: null }
  return { user, tenantId, role, ...authorization, allWarehouses: false }
}

export function hasWarehouseAccess(actor, warehouseIds, level = 'read') {
  const ids = [...new Set((warehouseIds || []).map(text).filter(Boolean))]
  if (actor.allWarehouses) return true
  const allowed = level === 'operate' ? actor.operateWarehouseIds : actor.readWarehouseIds
  return ids.every(id => allowed?.has(id))
}

export function assertWarehouseAccess(actor, warehouseIds, level = 'read', { maskExistence = false } = {}) {
  if (hasWarehouseAccess(actor, warehouseIds, level)) return
  if (maskExistence) fail('RECEIVING_NOT_FOUND', 'Receiving document was not found.', 404)
  fail('WAREHOUSE_SCOPE_DENIED', `The actor lacks ${level} access to every receiving warehouse.`, 403)
}
