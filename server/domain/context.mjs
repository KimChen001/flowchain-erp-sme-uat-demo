export const currentTenantContext = Object.freeze({
  id: 'tenant-flowchain-sme',
  name: 'FlowChain SME Workspace',
  industry: 'Manufacturing / Distribution',
  currency: 'USD',
  timezone: 'America/Los_Angeles',
  defaultWarehouseId: 'WH-MAIN',
  settings: {
    allowAiDraftPreparation: true,
    requireUserReviewForAiDrafts: true,
    defaultDocumentStatus: 'draft',
  },
})

const defaultUser = Object.freeze({
  id: 'user-buyer-001',
  name: 'FlowChain Buyer',
  email: 'buyer@flowchain.local',
  role: 'buyer',
  department: 'Procurement',
  locale: 'zh-CN',
})

const roleLabels = {
  buyer: 'Buyer',
  approver: 'Approver',
  admin: 'Admin',
}

function tokenFromAuthorization(authorization = '') {
  return String(authorization || '').replace(/^Bearer\s+/i, '').trim()
}

function publicUser(user) {
  if (!user) return null
  const { token, ...safeUser } = user
  return safeUser
}

export function resolveCurrentUser(db = {}, authorization = '') {
  const token = tokenFromAuthorization(authorization)
  const users = Array.isArray(db.users) ? db.users : []
  const matchedUser = token ? users.find((user) => user.token === token) : null
  const user = publicUser(matchedUser) || defaultUser
  return {
    id: user.id || defaultUser.id,
    name: user.name || defaultUser.name,
    email: user.email || defaultUser.email,
    role: user.role || defaultUser.role,
    department: user.department || 'Procurement',
    locale: user.locale || defaultUser.locale,
  }
}

export function permissionsForUser(user = defaultUser) {
  const role = String(user.role || defaultUser.role).toLowerCase()
  const isApprover = role.includes('approver') || role.includes('admin') || role.includes('manager')
  return {
    roleLabel: roleLabels[role] || user.role || defaultUser.role,
    canPrepareDrafts: true,
    canSubmitDocuments: true,
    canApproveDocuments: isApprover,
  }
}

export function buildCurrentContext(db = {}, authorization = '') {
  const user = resolveCurrentUser(db, authorization)
  return {
    user,
    tenant: {
      id: currentTenantContext.id,
      name: currentTenantContext.name,
    },
    permissionsContext: permissionsForUser(user),
  }
}
