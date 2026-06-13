export const purchaseRequestStatuses = new Set(['草稿', '待审批', '已批准', '已驳回', '已转PO', '已取消'])
export const purchaseOrderStatuses = new Set(['草稿', '待审批', '已审批', '已发出', '部分到货', '已完成', '已驳回', '已取消'])
export const priorities = new Set(['高', '中', '低'])
export const systemRequestSources = new Set(['forecast', 'inventory', 'mrp-release'])
export const postedReceivingStatuses = new Set(['已入库', '异常处理'])

export const workflowDefinitions = {
  purchaseRequest: {
    label: '采购申请',
    idField: 'pr',
    statuses: purchaseRequestStatuses,
    transitions: {
      草稿: ['待审批', '已取消'],
      待审批: ['已批准', '已驳回', '已取消'],
      已批准: ['已转PO', '已取消'],
      已驳回: ['草稿', '已取消'],
      已转PO: [],
      已取消: [],
    },
  },
  purchaseOrder: {
    label: '采购订单',
    idField: 'po',
    statuses: purchaseOrderStatuses,
    transitions: {
      草稿: ['待审批', '已取消'],
      待审批: ['已审批', '已驳回', '已取消'],
      已审批: ['已发出', '已取消'],
      已发出: ['部分到货', '已完成', '已取消'],
      部分到货: ['已完成', '已取消'],
      已完成: [],
      已驳回: ['草稿', '已取消'],
      已取消: [],
    },
  },
  rfq: {
    label: '询价单',
    idField: 'id',
    statuses: new Set(['进行中', '比价中', '已授标', '已转PO', '已关闭', '已取消']),
    transitions: {
      进行中: ['比价中', '已授标', '已取消'],
      比价中: ['进行中', '已授标', '已取消'],
      已授标: ['已转PO', '已关闭'],
      已转PO: ['已关闭'],
      已关闭: [],
      已取消: [],
    },
  },
  receivingDoc: {
    label: '收货单',
    idField: 'grn',
    statuses: new Set(['待收货', '质检中', '已入库', '异常处理']),
    transitions: {
      待收货: ['质检中'],
      质检中: ['已入库', '异常处理'],
      已入库: [],
      异常处理: [],
    },
  },
}

function nextSequenceId(items, field, prefix, start) {
  const max = items.reduce((acc, item) => {
    const match = String(item?.[field] || '').match(/(\d+)$/)
    return match ? Math.max(acc, Number(match[1])) : acc
  }, start - 1)
  return `${prefix}${max + 1}`
}

export function workflowError(message, status = 409) {
  const error = new Error(message)
  error.status = status
  return error
}

export function actorFromBody(body = {}, fallback = 'system') {
  return body.actor || body.updatedBy || body.postedBy || body.receiver || fallback
}

export function workflowEntityId(definition, entity) {
  return String(entity?.[definition.idField] || entity?.id || '')
}

function ensureAuditLog(db) {
  if (!Array.isArray(db.auditLog)) db.auditLog = []
  return db.auditLog
}

function recordAudit(db, entry) {
  const auditLog = ensureAuditLog(db)
  const timestamp = entry.timestamp || new Date().toISOString()
  const auditId = entry.auditId || nextSequenceId(auditLog, 'auditId', 'AUD-2026-', 1)
  const record = {
    auditId,
    id: auditId,
    timestamp,
    actor: entry.actor || 'system',
    source: entry.source || 'api',
    action: entry.action || 'status_transition',
    entityType: entry.entityType,
    entityId: entry.entityId,
    fromStatus: entry.fromStatus ?? null,
    toStatus: entry.toStatus ?? null,
    reason: entry.reason || '',
    metadata: entry.metadata || {},
  }
  auditLog.unshift(record)
  db.auditLog = auditLog.slice(0, 500)
  return record
}

export function createAuditLogEntry(db, entry) {
  return recordAudit(db, entry)
}

export function appendEntityAudit(entity, audit) {
  if (!entity || !audit) return
  entity.statusUpdatedAt = audit.timestamp
  entity.lastAuditId = audit.auditId
  entity.auditTrailIds = Array.isArray(entity.auditTrailIds) ? entity.auditTrailIds : []
  entity.auditTrailIds = [audit.auditId, ...entity.auditTrailIds.filter((id) => id !== audit.auditId)].slice(0, 20)
}

export function recordWorkflowCreation(db, entityType, entity, options = {}) {
  const definition = workflowDefinitions[entityType]
  if (!definition) throw workflowError(`unknown workflow entity type: ${entityType}`, 500)
  const entityId = workflowEntityId(definition, entity)
  const status = entity.status || options.status
  if (!entityId) throw workflowError(`${definition.label} is missing workflow id`, 400)
  if (!definition.statuses.has(status)) {
    throw workflowError(`invalid ${definition.label} status: ${status}`, 400)
  }
  const audit = recordAudit(db, {
    actor: options.actor,
    source: options.source || 'api',
    action: options.action || `${entityType}_created`,
    entityType,
    entityId,
    fromStatus: null,
    toStatus: status,
    reason: options.reason || `${definition.label} created`,
    metadata: options.metadata || {},
  })
  appendEntityAudit(entity, audit)
  return audit
}

export function canTransition(entityType, fromStatus, toStatus) {
  const definition = workflowDefinitions[entityType]
  if (!definition || !definition.statuses.has(fromStatus) || !definition.statuses.has(toStatus)) return false
  if (fromStatus === toStatus) return true
  return new Set(definition.transitions[fromStatus] || []).has(toStatus)
}

export function assertValidTransition(entityType, fromStatus, toStatus) {
  const definition = workflowDefinitions[entityType]
  if (!definition) throw workflowError(`unknown workflow entity type: ${entityType}`, 500)
  if (!definition.statuses.has(toStatus)) {
    throw workflowError(`invalid ${definition.label} status: ${toStatus}`, 400)
  }
  if (!definition.statuses.has(fromStatus)) {
    throw workflowError(`invalid current ${definition.label} status: ${fromStatus}`, 400)
  }
  if (!canTransition(entityType, fromStatus, toStatus)) {
    throw workflowError(`${definition.label} cannot transition from ${fromStatus} to ${toStatus}`)
  }
}

export function transitionEntity(db, entityType, entity, nextStatus, options = {}) {
  const definition = workflowDefinitions[entityType]
  if (!definition) throw workflowError(`unknown workflow entity type: ${entityType}`, 500)
  const entityId = workflowEntityId(definition, entity)
  const currentStatus = entity.status
  if (!entityId) throw workflowError(`${definition.label} is missing workflow id`, 400)
  assertValidTransition(entityType, currentStatus, nextStatus)
  if (currentStatus === nextStatus) return { changed: false, audit: null }

  const audit = createAuditLogEntry(db, {
    entityType,
    entityId,
    fromStatus: currentStatus,
    toStatus: nextStatus,
    actor: options.actor,
    source: options.source || 'api',
    action: options.action || `${entityType}_status_changed`,
    reason: options.reason || '',
    metadata: options.metadata,
  })
  entity.status = nextStatus
  appendEntityAudit(entity, audit)
  return { changed: true, audit }
}

export function applyWorkflowTransition(db, entityType, entity, nextStatus, options = {}) {
  return transitionEntity(db, entityType, entity, nextStatus, options)
}

export function recordValidationBlocked(db, entityType, entity, action, reason, metadata = {}) {
  const definition = workflowDefinitions[entityType]
  if (!definition) return null
  const entityId = workflowEntityId(definition, entity)
  if (!entityId) return null
  const audit = createAuditLogEntry(db, {
    entityType,
    entityId,
    fromStatus: entity.status || null,
    toStatus: entity.status || null,
    actor: metadata.actor || 'system',
    source: metadata.source || 'api',
    action: 'system_validation_blocked',
    reason: reason || action,
    metadata: { action, ...metadata },
  })
  appendEntityAudit(entity, audit)
  return audit
}
