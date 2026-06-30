import { buildInventoryItems } from './inventory-read.mjs'
import { findMasterItem, findMasterSupplier } from './master-data.mjs'
import { toActionDraftEvidence } from './action-draft-boundary.mjs'

function text(value, fallback = '') {
  const next = String(value ?? '').trim()
  return next || fallback
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function toNumberOrNull(value) {
  if (value === '' || value === undefined || value === null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function cleanObject(value = {}) {
  return Object.fromEntries(Object.entries(value || {}).filter(([, item]) => item !== undefined && item !== ''))
}

function draftId(now = new Date()) {
  const stamp = now.toISOString().slice(0, 10).replace(/-/g, '')
  return `DRAFT-PURCHASE-REQUEST-${stamp}-${String(now.getTime()).slice(-6)}`
}

function findInventoryItem(db = {}, rawSku = '') {
  const key = text(rawSku).toLowerCase()
  if (!key) return null
  return buildInventoryItems(db).find((item) =>
    [item.sku, item.itemName].some((value) => text(value).toLowerCase() === key)
  ) || null
}

function supplierSuggestion(db = {}, item = {}) {
  const masterItem = findMasterItem(db, item.sku)
  const supplierId = text(masterItem?.preferredSupplierId || item.supplier)
  const supplier = findMasterSupplier(db, supplierId) || findMasterSupplier(db, item.supplier)
  if (supplier) {
    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      source: masterItem?.preferredSupplierSource || 'matched_supplier_master',
    }
  }
  if (supplierId) {
    return {
      supplierId,
      supplierName: supplierId,
      source: masterItem?.preferredSupplierSource || 'inventory_item_supplier',
    }
  }
  return null
}

function suggestedQuantityFromInventory(item = {}) {
  const available = toNumberOrNull(item.availableQuantity)
  const reorderPoint = toNumberOrNull(item.reorderPoint)
  const safetyStock = toNumberOrNull(item.safetyStock)
  if (available === null || (reorderPoint === null && safetyStock === null)) return null
  const target = Math.max(reorderPoint ?? 0, safetyStock ?? 0)
  const gap = Math.max(0, target - available)
  return gap > 0 ? gap : null
}

export function validatePurchaseRequestDraftPayload(payload = {}, options = {}) {
  const errors = []
  const warnings = []
  if (!text(payload.itemIdOrSku || payload.sku)) errors.push('Missing required field: itemIdOrSku')
  if (!payload.quantity && !payload.suggestedQuantity) warnings.push('Quantity requires manual review.')
  if (options.itemMissing) errors.push(`No inventory item matched ${text(payload.itemIdOrSku || payload.sku, 'requested SKU')}.`)
  return {
    ok: errors.length === 0 && warnings.length === 0,
    status: errors.length ? 'invalid' : warnings.length ? 'needs_review' : 'ready_for_review',
    errors,
    warnings,
    missingFields: [
      ...(!text(payload.itemIdOrSku || payload.sku) ? ['itemIdOrSku'] : []),
      ...(!payload.quantity && !payload.suggestedQuantity ? ['quantity'] : []),
    ],
  }
}

export function buildPurchaseRequestDraftPreview(input = {}, options = {}) {
  const db = options.db || {}
  const now = options.now instanceof Date ? options.now : new Date()
  const payloadInput = input.payload || {}
  const sku = text(payloadInput.itemIdOrSku || payloadInput.sku || input.itemIdOrSku || input.sku)
  if (!sku) {
    return {
      ok: false,
      status: 'invalid',
      error: 'Missing required field: itemIdOrSku',
      validation: validatePurchaseRequestDraftPayload({ itemIdOrSku: '', quantity: payloadInput.quantity }),
    }
  }

  const item = findInventoryItem(db, sku)
  if (!item) {
    return {
      ok: false,
      status: 'not_found',
      error: `No inventory item matched ${sku}.`,
      validation: validatePurchaseRequestDraftPayload({ ...payloadInput, itemIdOrSku: sku }, { itemMissing: true }),
    }
  }

  const explicitQuantity = toNumberOrNull(payloadInput.quantity)
  const suggestedQuantity = explicitQuantity ?? suggestedQuantityFromInventory(item)
  const supplier = supplierSuggestion(db, item)
  const draftPayload = cleanObject({
    itemIdOrSku: item.sku,
    itemName: item.itemName,
    warehouse: text(payloadInput.warehouse || payloadInput.warehouseId || item.defaultWarehouseId || item.location),
    suggestedQuantity,
    quantity: explicitQuantity ?? '',
    unit: text(payloadInput.unit || item.unit),
    reason: text(payloadInput.reason || input.reason || item.riskReason || 'Inventory risk requires replenishment review.'),
    supplierSuggestion: supplier,
    urgency: text(payloadInput.urgency || payloadInput.severity || item.riskLevel),
    severity: text(payloadInput.severity || item.riskLevel),
    availableQuantity: item.availableQuantity,
    reorderPoint: item.reorderPoint,
    safetyStock: item.safetyStock,
    requiresConfirmation: true,
  })
  const validation = validatePurchaseRequestDraftPayload(draftPayload)
  const originEvidence = [
    ...asArray(input.originEvidence),
    { type: 'inventory_item', id: item.sku, label: item.itemName, status: item.status, summary: item.riskReason, route: `/api/inventory/items/${encodeURIComponent(item.sku)}` },
    ...(supplier ? [{ type: 'supplier_master', id: supplier.supplierId, label: supplier.supplierName, summary: `Supplier suggestion source: ${supplier.source}` }] : []),
  ].map(toActionDraftEvidence).filter((entry) => entry.id || entry.label || entry.summary).slice(0, 6)

  return {
    ok: true,
    draft: {
      id: text(input.id, draftId(now)),
      type: 'purchase_request_draft',
      title: text(input.title, `Purchase Request Draft · ${item.sku}`),
      status: 'preview',
      source: text(input.source, 'today_cockpit'),
      createdBy: cleanObject(input.createdBy || { type: 'system', id: 'flowchain', name: 'FlowChain' }),
      createdAt: input.createdAt || now.toISOString(),
      requiresConfirmation: true,
      originEvidence,
      payload: draftPayload,
      validation,
      auditTrail: [
        {
          action: 'purchase_request_draft_previewed',
          source: 'draft_preview',
          timestamp: input.createdAt || now.toISOString(),
          summary: 'Purchase request draft preview prepared. No PR record was created.',
        },
      ],
      confirmationBoundary: {
        previewOnly: true,
        submitted: false,
        requiresUserReview: true,
        futureConfirmation: 'create_purchase_request',
      },
    },
  }
}
