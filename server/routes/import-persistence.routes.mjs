import { resolveCurrentUser } from '../domain/context.mjs'
import { authorizeMutation } from '../domain/mutation-authorization.mjs'
import {
  createImportPreview,
  getImportBatch,
  importBusinessConfigs,
  listImportBatches,
  rollbackImportBatch,
  validateDurableImportCommit,
  recordDurableImportCommit,
} from '../repositories/import-persistence-repository.mjs'

async function relationshipSnapshot(ctx) {
  const [items, suppliers, procurement] = await Promise.all([
    ctx.repositories?.masterData?.listManagedItems?.() || [],
    ctx.repositories?.masterData?.listSuppliers?.() || [],
    ctx.repositories?.procurementRuntime?.snapshot?.() || {},
  ])
  return {
    skus: items.flatMap(row => [row.sku, row.itemId].filter(Boolean).map(String)),
    suppliers: suppliers.flatMap(row => [row.supplierCode, row.id, row.supplierName].filter(Boolean).map(String)),
    purchaseOrders: (procurement.purchaseOrders || []).map(row => String(row.id || row.po || '')),
    receivingDocs: (procurement.receipts || []).map(row => String(row.id || row.grn || '')),
  }
}

async function applyDurableRows(ctx, validation, actor) {
  const rows = validation.preview.normalizedRows
  const schemaId = validation.preview.schemaId
  if (schemaId === 'purchase-request') { const error = new Error('采购申请正式导入尚未接通，请继续使用预览并从采购申请入口创建。'); Object.assign(error, { status: 501, code: 'PURCHASE_REQUEST_IMPORT_NOT_CONNECTED' }); throw error }
  if (!['supplier-master', 'item-master', 'customer-master', 'inventory-balance'].includes(schemaId)) { const error = new Error('该业务对象当前仅支持预览，正式导入尚未接通。'); Object.assign(error, { status: 501, code: 'IMPORT_COMMIT_NOT_CONNECTED' }); throw error }
  const changes = []
  for (const row of rows) {
    if (schemaId === 'supplier-master') {
      const existing = await ctx.repositories.masterData.getSupplier(row.code)
      const record = existing
        ? await ctx.repositories.masterData.updateSupplier(existing.id, { supplierCode: row.code, supplierName: row.name, categories: [row.category].filter(Boolean), contact: row.contact, email: row.email, defaultCurrency: row.currency, status: row.status, expectedVersion: existing.version }, actor)
        : await ctx.repositories.masterData.createSupplier({ supplierCode: row.code, supplierName: row.name, categories: [row.category].filter(Boolean), contact: row.contact, email: row.email, defaultCurrency: row.currency, status: row.status }, actor)
      changes.push({ repository: 'supplier-master-runtime', operation: existing ? 'update' : 'insert', entityId: record.id })
    }
    if (schemaId === 'item-master') {
      const existing = await ctx.repositories.masterData.getManagedItem(row.sku)
      const input = { sku: row.sku, itemName: row.name, category: row.category, baseUnit: row.unit, defaultWarehouseId: row.defaultWarehouse, safetyStock: row.safetyStock, status: row.status, expectedVersion: existing?.version }
      const record = existing ? await ctx.repositories.masterData.updateItem(existing.itemId, input, actor) : await ctx.repositories.masterData.createItem(input, actor)
      changes.push({ repository: 'item-master-runtime', operation: existing ? 'update' : 'insert', entityId: record.itemId })
    }
    if (schemaId === 'customer-master') {
      const existing = await ctx.repositories.masterData.getCustomer(row.code)
      const input = { code: row.code, name: row.name, contact: row.contact, email: row.email, currency: row.currency, status: row.status, expectedVersion: existing?.version }
      const record = existing ? await ctx.repositories.masterData.updateCustomer(existing.id, input, actor) : await ctx.repositories.masterData.createCustomer(input, actor)
      changes.push({ repository: 'customer-master-runtime', operation: existing ? 'update' : 'insert', entityId: record.id })
    }
    if (schemaId === 'inventory-balance') {
      const result = await ctx.repositories.inventoryRuntime.applyBalanceAdjustment({ sku: row.sku, warehouse: row.warehouse, bin: row.bin, quantity: row.quantity, asOfDate: row.asOfDate, status: row.status, reason: '正式库存余额导入' }, actor, { previewId: validation.preview.previewId, snapshotHash: validation.preview.snapshotHash })
      changes.push({ repository: 'inventory-runtime', operation: result.operation, entityId: result.item.sku, movementId: result.movement.movementId, auditEventId: result.auditEvent.id })
    }
  }
  return changes
}

function roleFor(user = {}) {
  const raw = String(user.role || '').toLowerCase()
  if (/admin|管理员/.test(raw)) return 'admin'
  if (/manager|经理|approver|供应链经理/.test(raw)) return 'manager'
  if (/viewer|只读/.test(raw)) return 'viewer'
  return 'analyst'
}

function baselineFor(db = {}, schemaId = '') {
  const config = importBusinessConfigs[schemaId]
  if (!config) return []
  if (config.collection === 'purchaseRequests') return db.purchaseRequests || []
  if (config.collection === 'suppliers') return db.suppliers || []
  if (config.collection === 'products') return db.products || []
  return Array.isArray(db[config.collection]) ? db[config.collection] : []
}

export async function handleImportPersistenceRoute(ctx) {
  const { req, res, url, db, send, readBody } = ctx
  const user = ctx.identity?.authenticated ? { id: ctx.identity.userId, name: ctx.identity.name, role: ctx.identity.role } : resolveCurrentUser(db, req.headers.authorization || '')

  if (req.method === 'POST' && url.pathname === '/api/imports/preview') {
    const body = await readBody(req)
    const result = createImportPreview(body, { actor: user.name, relationships: await relationshipSnapshot(ctx) })
    send(res, result.ok ? 200 : result.status || 422, result)
    return true
  }

  const commitMatch = url.pathname.match(/^\/api\/imports\/([^/]+)\/commit$/)
  if (req.method === 'POST' && commitMatch) {
    const authorization = authorizeMutation(ctx, { allowedRoles: ['admin', 'manager', 'business-specialist'], action: 'commit', resource: 'durable-import' })
    if (authorization.blocked) return true
    const body = await readBody(req)
    const previewId = decodeURIComponent(commitMatch[1])
    const validation = validateDurableImportCommit(previewId, body, { relationships: await relationshipSnapshot(ctx) })
    if (!validation.ok) { send(res, validation.status || 422, validation); return true }
    if (validation.replayed) { send(res, 200, { ...validation.result, replayed: true }); return true }
    try {
      const changes = await applyDurableRows(ctx, validation, authorization.identity.userId)
      send(res, 201, recordDurableImportCommit(validation, changes, { actor: authorization.identity.userId }))
    } catch (error) {
      send(res, error.status || 422, { code: error.code || 'IMPORT_COMMIT_FAILED', message: error.message, details: error.details || [] })
    }
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/import-batches') {
    send(res, 200, { batches: listImportBatches() })
    return true
  }

  const batchMatch = url.pathname.match(/^\/api\/import-batches\/([^/]+)$/)
  if (req.method === 'GET' && batchMatch) {
    const batch = getImportBatch(decodeURIComponent(batchMatch[1]))
    send(res, batch ? 200 : 404, batch || { error: 'Import batch not found.' })
    return true
  }

  const rollbackMatch = url.pathname.match(/^\/api\/import-batches\/([^/]+)\/rollback$/)
  if (req.method === 'POST' && rollbackMatch) {
    const authorization = authorizeMutation(ctx, { allowedRoles: ['admin', 'manager'], action: 'rollback', resource: 'durable-import' })
    if (authorization.blocked) return true
    const body = await readBody(req)
    const result = rollbackImportBatch(decodeURIComponent(rollbackMatch[1]), body, { actor: authorization.identity.name, role: roleFor(authorization.identity) })
    send(res, result.ok ? 200 : result.status || 422, result)
    return true
  }

  return false
}
