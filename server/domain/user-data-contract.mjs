import { createHash } from 'node:crypto'

export const USER_DATA_ARRAY_KEYS = Object.freeze([
  'purchaseOrders',
  'purchaseRequests',
  'rfqs',
  'products',
  'suppliers',
  'receivingDocs',
  'supplierInvoices',
  'inventoryMovements',
  'inventoryExceptions',
])

const NUMERIC_FIELDS = new Set([
  'quantity',
  'quantityOrdered',
  'amount',
  'received',
  'receivedQuantity',
  'currentStock',
  'availableQuantity',
  'safetyStock',
  'reorderPoint',
  'min',
  'items',
  'passed',
  'failed',
  'suppliers',
  'quoted',
  'varianceAmount',
  'quantityImpact',
])

const DATE_FIELDS = new Set([
  'eta',
  'expectedDate',
  'due',
  'dueDate',
  'requiredDate',
  'importedAt',
  'date',
])

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function text(value) {
  return String(value ?? '').trim()
}

function cloneRow(row) {
  return JSON.parse(JSON.stringify(row || {}))
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]))
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value))
}

function coerceNumber(value) {
  if (value === '' || value === null || value === undefined) return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : value
}

function isValidDateLike(value) {
  const raw = text(value)
  if (!raw) return true
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!iso) return false
  const date = new Date(`${raw}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === raw
}

function addIssue(collection, code, message, path, severity = 'warning') {
  collection.push({ code, message, path, severity })
}

function sourcePayload(payload) {
  const root = asObject(payload)
  return asObject(root.data || root.businessData || root.records || root)
}

function normalizePurchaseOrder(row, index, issues) {
  const next = cloneRow(row)
  if (!next.po && next.poId) next.po = next.poId
  if (!next.supplier && next.supplierName) next.supplier = next.supplierName
  if (Array.isArray(next.lines)) {
    next.lines = next.lines.map((line, lineIndex) => {
      const normalizedLine = cloneRow(line)
      if (!normalizedLine.sku && normalizedLine.itemSku) normalizedLine.sku = normalizedLine.itemSku
      for (const key of Object.keys(normalizedLine)) {
        if (NUMERIC_FIELDS.has(key)) normalizedLine[key] = coerceNumber(normalizedLine[key])
      }
      if (!text(normalizedLine.sku)) addIssue(issues, 'missing_sku', 'PO line is missing SKU.', `purchaseOrders[${index}].lines[${lineIndex}].sku`)
      if (normalizedLine.quantity !== undefined && typeof normalizedLine.quantity !== 'number') addIssue(issues, 'invalid_quantity', 'PO line quantity must be numeric.', `purchaseOrders[${index}].lines[${lineIndex}].quantity`, 'error')
      return normalizedLine
    })
  }
  return next
}

function normalizePurchaseRequest(row) {
  const next = cloneRow(row)
  if (!next.pr && next.prId) next.pr = next.prId
  if (!next.sourceSku && next.itemSku) next.sourceSku = next.itemSku
  if (!next.supplier && next.supplierName) next.supplier = next.supplierName
  return next
}

function normalizeRfq(row) {
  const next = cloneRow(row)
  if (!next.id && next.rfqId) next.id = next.rfqId
  if (!next.sourceRequest && next.prId) next.sourceRequest = next.prId
  if (!next.bestSupplier && next.supplierName) next.bestSupplier = next.supplierName
  return next
}

function normalizeProduct(row) {
  const next = cloneRow(row)
  if (!next.sku && next.itemSku) next.sku = next.itemSku
  if (!next.name && next.itemName) next.name = next.itemName
  if (!next.supplier && next.supplierName) next.supplier = next.supplierName
  return next
}

function normalizeSupplier(row) {
  const next = cloneRow(row)
  if (!next.name && next.supplierName) next.name = next.supplierName
  if (!next.id && next.supplierId) next.id = next.supplierId
  return next
}

function normalizeReceivingDoc(row) {
  const next = cloneRow(row)
  if (!next.grn && next.grnId) next.grn = next.grnId
  if (!next.po && next.poId) next.po = next.poId
  if (!next.supplier && next.supplierName) next.supplier = next.supplierName
  return next
}

function normalizeSupplierInvoice(row) {
  const next = cloneRow(row)
  if (!next.invoiceNumber && next.invoiceId) next.invoiceNumber = next.invoiceId
  if (!next.relatedPo && next.poId) next.relatedPo = next.poId
  if (!next.relatedGrn && next.grnId) next.relatedGrn = next.grnId
  if (!next.supplier && next.supplierName) next.supplier = next.supplierName
  return next
}

function normalizeInventoryMovement(row) {
  const next = cloneRow(row)
  if (!next.sku && next.itemSku) next.sku = next.itemSku
  if (!next.sourceDocument && next.grnId) next.sourceDocument = next.grnId
  return next
}

function normalizeInventoryException(row) {
  const next = cloneRow(row)
  if (!next.sku && next.itemSku) next.sku = next.itemSku
  if (!next.itemName && next.name) next.itemName = next.name
  return next
}

const NORMALIZERS = {
  purchaseOrders: normalizePurchaseOrder,
  purchaseRequests: normalizePurchaseRequest,
  rfqs: normalizeRfq,
  products: normalizeProduct,
  suppliers: normalizeSupplier,
  receivingDocs: normalizeReceivingDoc,
  supplierInvoices: normalizeSupplierInvoice,
  inventoryMovements: normalizeInventoryMovement,
  inventoryExceptions: normalizeInventoryException,
}

function normalizeRow(key, row, index, issues) {
  const normalizer = NORMALIZERS[key] || cloneRow
  const next = normalizer(row, index, issues)
  for (const field of Object.keys(next)) {
    if (NUMERIC_FIELDS.has(field)) next[field] = coerceNumber(next[field])
    if (DATE_FIELDS.has(field) && !isValidDateLike(next[field])) {
      addIssue(issues, 'invalid_date', `${field} must use YYYY-MM-DD format.`, `${key}[${index}].${field}`, 'error')
    }
  }
  return next
}

function idSet(rows, fields) {
  return new Set(rows.map((row) => fields.map((field) => text(row[field])).find(Boolean)).filter(Boolean))
}

function validateNormalizedData(normalizedData, issues) {
  const poIds = idSet(normalizedData.purchaseOrders, ['po', 'poId', 'id'])
  const prIds = idSet(normalizedData.purchaseRequests, ['pr', 'prId', 'id'])
  const grnIds = idSet(normalizedData.receivingDocs, ['grn', 'grnId', 'id'])

  normalizedData.purchaseOrders.forEach((po, index) => {
    if (!text(po.supplier || po.supplierName)) addIssue(issues, 'missing_supplier', 'Purchase order is missing supplier.', `purchaseOrders[${index}].supplier`)
  })
  normalizedData.purchaseRequests.forEach((pr, index) => {
    if (!text(pr.sourceSku || pr.sku || pr.itemSku)) addIssue(issues, 'missing_sku', 'Purchase request is missing SKU.', `purchaseRequests[${index}].sourceSku`)
    if (pr.quantity !== undefined && typeof pr.quantity !== 'number') addIssue(issues, 'invalid_quantity', 'Purchase request quantity must be numeric.', `purchaseRequests[${index}].quantity`, 'error')
  })
  normalizedData.products.forEach((product, index) => {
    if (!text(product.sku || product.itemSku)) addIssue(issues, 'missing_sku', 'Product is missing SKU.', `products[${index}].sku`)
  })
  normalizedData.receivingDocs.forEach((doc, index) => {
    const poId = text(doc.po || doc.poId)
    if (poId && !poIds.has(poId)) addIssue(issues, 'unknown_po_reference', `GRN references unknown PO ${poId}.`, `receivingDocs[${index}].po`)
  })
  normalizedData.rfqs.forEach((rfq, index) => {
    const prId = text(rfq.sourceRequest || rfq.pr || rfq.prId)
    if (prId && !prIds.has(prId)) addIssue(issues, 'unknown_pr_reference', `RFQ references unknown PR ${prId}.`, `rfqs[${index}].sourceRequest`)
  })
  normalizedData.supplierInvoices.forEach((invoice, index) => {
    const poId = text(invoice.relatedPo || invoice.po || invoice.poId)
    const grnId = text(invoice.relatedGrn || invoice.grn || invoice.grnId)
    if (poId && !poIds.has(poId)) addIssue(issues, 'unknown_po_reference', `Invoice references unknown PO ${poId}.`, `supplierInvoices[${index}].relatedPo`)
    if (grnId && !grnIds.has(grnId)) addIssue(issues, 'unknown_grn_reference', `Invoice references unknown GRN ${grnId}.`, `supplierInvoices[${index}].relatedGrn`)
  })
}

export function buildUserDataRecordCounts(data = {}) {
  return Object.fromEntries(USER_DATA_ARRAY_KEYS.map((key) => [key, asArray(data[key]).length]))
}

export function buildUserDataScope(input = {}) {
  const root = asObject(input)
  const scope = asObject(root.scope)
  return {
    tenantId: text(scope.tenantId || root.tenantId) || 'tenant-flowchain-sme',
    userId: text(scope.userId || root.userId) || 'user-local',
  }
}

export function buildNormalizedUserDataSnapshot(normalizedData = {}, options = {}) {
  const scope = buildUserDataScope(options.scope || options)
  const recordCounts = buildUserDataRecordCounts(normalizedData)
  const datasetId = text(options.datasetId) || `uds-${scope.tenantId}-${scope.userId}`
  const previewId = text(options.previewId) || `udp-${createHash('sha256').update(stableStringify({ scope, recordCounts, normalizedData })).digest('hex').slice(0, 16)}`
  const snapshotBody = {
    version: 1,
    scope,
    datasetId,
    recordCounts,
    normalizedRecords: stableValue(Object.fromEntries(USER_DATA_ARRAY_KEYS.map((key) => [key, asArray(normalizedData[key])]))),
  }
  const normalizedSnapshotHash = createHash('sha256').update(stableStringify(snapshotBody)).digest('hex')
  return {
    ...snapshotBody,
    previewId,
    normalizedSnapshotHash,
    validationSummary: {
      ok: Boolean(options.ok),
      warningCount: asArray(options.warnings).length,
      errorCount: asArray(options.errors).length,
    },
    source: {
      sourceName: text(options.sourceName) || 'user-import',
      rowCounts: recordCounts,
    },
  }
}

export function buildUserDataImportPreview(normalizedData = {}, { limit = 5 } = {}) {
  return {
    purchaseOrders: asArray(normalizedData.purchaseOrders).slice(0, limit).map((row) => ({ id: text(row.po || row.poId || row.id), supplier: text(row.supplier || row.supplierName), status: text(row.status) })),
    products: asArray(normalizedData.products).slice(0, limit).map((row) => ({ sku: text(row.sku || row.itemSku), name: text(row.name || row.itemName), currentStock: row.currentStock })),
    suppliers: asArray(normalizedData.suppliers).slice(0, limit).map((row) => ({ id: text(row.id || row.supplierId || row.code), name: text(row.name || row.supplierName), risk: text(row.risk || row.riskStatus) })),
    rfqs: asArray(normalizedData.rfqs).slice(0, limit).map((row) => ({ id: text(row.id || row.rfqId), sourceRequest: text(row.sourceRequest || row.prId), quoted: row.quoted, suppliers: row.suppliers })),
    receivingDocs: asArray(normalizedData.receivingDocs).slice(0, limit).map((row) => ({ id: text(row.grn || row.grnId || row.id), po: text(row.po || row.poId), status: text(row.status) })),
  }
}

export function normalizeUserDataImportPayload(payload = {}, options = {}) {
  const source = sourcePayload(payload)
  const issues = []
  const normalizedData = Object.fromEntries(USER_DATA_ARRAY_KEYS.map((key) => [key, asArray(source[key]).map((row, index) => normalizeRow(key, row, index, issues))]))
  const recordCounts = buildUserDataRecordCounts(normalizedData)
  validateNormalizedData(normalizedData, issues)
  const totalRecords = Object.values(recordCounts).reduce((sum, count) => sum + count, 0)
  if (!totalRecords) addIssue(issues, 'empty_payload', 'No importable business records were provided.', 'payload')

  const errors = issues.filter((issue) => issue.severity === 'error')
  const warnings = issues.filter((issue) => issue.severity !== 'error')
  const importedAt = options.importedAt || new Date().toISOString()
  const scope = buildUserDataScope({ ...asObject(payload), ...options.scope })
  const sourceName = text(asObject(payload).sourceName) || 'user-import'
  const normalizedSnapshot = buildNormalizedUserDataSnapshot(normalizedData, {
    scope,
    sourceName,
    ok: errors.length === 0,
    warnings,
    errors,
    datasetId: options.datasetId || asObject(payload).datasetId,
    previewId: options.previewId || asObject(payload).previewId,
  })
  return {
    ok: errors.length === 0,
    normalizedData,
    normalizedSnapshot,
    scope,
    recordCounts,
    warnings,
    errors,
    metadata: {
      sourceName,
      importedAt,
      dryRun: true,
      previewId: normalizedSnapshot.previewId,
      datasetId: normalizedSnapshot.datasetId,
      normalizedSnapshotHash: normalizedSnapshot.normalizedSnapshotHash,
      scope,
      recordCounts,
      warnings,
      errors,
    },
    importPreview: buildUserDataImportPreview(normalizedData),
  }
}
