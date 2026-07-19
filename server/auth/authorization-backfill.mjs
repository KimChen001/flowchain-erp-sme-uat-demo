import { createHash, randomUUID } from "node:crypto"
import { defaultRoleTemplates, legacyRoleTemplateMap } from "./permission-catalog.mjs"

const stableId = (...parts) => `AUTH-${createHash("sha256").update(parts.join(":"), "utf8").digest("hex").slice(0, 28)}`
const normalizedLegacyRole = (value) => String(value || "").trim().toLowerCase()

export async function backfillTenantAuthorization(prisma, tenantId, { actorId = null, requestId = null, idFactory = randomUUID } = {}) {
  if (!prisma || !tenantId) throw new Error("prisma and tenantId are required")
  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { id: true } })
    if (!tenant) return { tenantId, createdRoles: 0, createdGrants: 0, createdAssignments: 0, unknownLegacyRoles: [] }

    let createdRoles = 0
    let createdGrants = 0
    let createdAssignments = 0
    const roles = new Map()
    for (const template of defaultRoleTemplates) {
      const id = stableId(tenantId, "role", template.roleKey)
      const existing = await tx.tenantRole.findUnique({ where: { tenantId_roleKey: { tenantId, roleKey: template.roleKey } } })
      const role = existing || await tx.tenantRole.create({ data: {
        id, tenantId, roleKey: template.roleKey, name: template.name,
        description: `FlowChain default role template: ${template.name}`,
        status: "active", isDefaultTemplate: true, createdById: actorId, updatedById: actorId,
      } })
      if (!existing) createdRoles += 1
      roles.set(template.roleKey, role)
      for (const permissionCode of template.permissions) {
        const grantId = stableId(tenantId, "grant", role.id, permissionCode)
        const existingGrant = await tx.tenantRolePermission.findUnique({ where: { roleId_permissionCode: { roleId: role.id, permissionCode } } })
        if (!existingGrant) {
          await tx.tenantRolePermission.create({ data: { id: grantId, tenantId, roleId: role.id, permissionCode, createdById: actorId } })
          createdGrants += 1
        }
      }
    }

    const users = await tx.user.findMany({ where: { tenantId }, select: { id: true, role: true } })
    const warehouses = await tx.warehouse.findMany({ where: { tenantId }, select: { id: true } })
    const unknownLegacyRoles = []
    for (const user of users) {
      const legacyRole = normalizedLegacyRole(user.role)
      const roleKey = legacyRoleTemplateMap[legacyRole] || "read-only-viewer"
      if (!legacyRoleTemplateMap[legacyRole]) unknownLegacyRoles.push({ userId: user.id, legacyRole })
      const role = roles.get(roleKey)
      const existing = await tx.userRoleAssignment.findUnique({ where: { userId_roleId: { userId: user.id, roleId: role.id } } })
      if (!existing) {
        await tx.userRoleAssignment.create({ data: { id: stableId(tenantId, "assignment", user.id, role.id), tenantId, userId: user.id, roleId: role.id, status: "active", createdById: actorId } })
        createdAssignments += 1
      }
      // Legacy admins previously bypassed warehouse scopes. Materialize the same
      // access as explicit UserWarehouseScope rows so role names are no longer a scope authority.
      if (roleKey === "workspace-administrator") {
        for (const warehouse of warehouses) {
          await tx.userWarehouseScope.upsert({
            where: { tenantId_userId_warehouseId: { tenantId, userId: user.id, warehouseId: warehouse.id } },
            create: { id: stableId(tenantId, "warehouse-scope", user.id, warehouse.id), tenantId, userId: user.id, warehouseId: warehouse.id, accessLevel: "operate" },
            update: { accessLevel: "operate" },
          })
        }
      }
    }

    if (createdRoles || createdGrants || createdAssignments) {
      await tx.auditLog.create({ data: {
        id: idFactory(), tenantId, actorId, source: "authorization_backfill", module: "settings",
        action: "authorization_legacy_role_backfilled", entityType: "Tenant", entityId: tenantId,
        summary: `Backfilled ${createdAssignments} legacy user role assignments.`,
        metadata: { before: { authority: "User.role" }, after: { authority: "TenantRolePermission" }, actor: actorId, permissionCodes: [], createdRoles, createdGrants, createdAssignments, unknownLegacyRoles, requestId, timestamp: new Date().toISOString() },
      } })
    }
    return { tenantId, createdRoles, createdGrants, createdAssignments, unknownLegacyRoles }
  }, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 30_000 })
}

export async function backfillAllTenantAuthorization(prisma, options = {}) {
  const tenants = await prisma.tenant.findMany({ select: { id: true }, orderBy: { id: "asc" } })
  const results = []
  for (const tenant of tenants) results.push(await backfillTenantAuthorization(prisma, tenant.id, options))
  return results
}
