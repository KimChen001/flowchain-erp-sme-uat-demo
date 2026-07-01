import { buildInventoryExceptions, buildInventoryItems } from './inventory-read.mjs'
import {
  buildProcurementDocuments,
  buildProcurementFollowups,
  buildProcurementSummary,
} from './procurement-read-model.mjs'
import { buildTodayCockpit } from './today-cockpit-read-model.mjs'

function text(value, fallback = '') {
  const next = String(value ?? '').trim()
  return next || fallback
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function amount(value, currency = 'CNY') {
  if (value === undefined || value === null || value === '') return ''
  const prefix = currency === 'CNY' ? '¥' : `${currency} `
  return `${prefix}${toNumber(value).toLocaleString()}`
}

export function aiBusinessLabel(type = '', id = '') {
  const normalized = text(type).toLowerCase()
  const nextId = text(id)
  if (normalized === 'po' || normalized === 'purchase_order' || /^PO-/i.test(nextId)) return `采购单 ${nextId}`.trim()
  if (normalized === 'pr' || normalized === 'purchase_request' || /^PR-/i.test(nextId)) return `采购申请 ${nextId}`.trim()
  if (normalized === 'rfq' || /^RFQ-/i.test(nextId)) return `询价单 ${nextId}`.trim()
  if (normalized === 'grn' || normalized === 'receiving_doc' || /^GRN-/i.test(nextId)) return `收货单 ${nextId}`.trim()
  if (normalized === 'invoice' || normalized === 'supplier_invoice' || /^INV-/i.test(nextId)) return `发票 ${nextId}`.trim()
  if (normalized === 'sku' || normalized === 'inventory_item' || /^SKU-/i.test(nextId)) return nextId
  if (normalized === 'supplier') return `供应商 ${nextId}`.trim()
  return nextId
}

function entityTypeFromId(id = '') {
  if (/^PO-/i.test(id)) return 'po'
  if (/^PR-/i.test(id)) return 'pr'
  if (/^RFQ-/i.test(id)) return 'rfq'
  if (/^GRN-/i.test(id)) return 'grn'
  if (/^INV-/i.test(id)) return 'invoice'
  if (/^SKU-/i.test(id)) return 'sku'
  return ''
}

export function extractAiRetrievalEntities(query = '', data = {}) {
  const found = []
  const seen = new Set()
  const push = (type, id, label = '') => {
    const entityId = text(id)
    if (!type || !entityId) return
    const key = `${type}:${entityId.toLowerCase()}`
    if (seen.has(key)) return
    seen.add(key)
    found.push({ type, id: entityId, label: label || aiBusinessLabel(type, entityId) })
  }

  for (const match of text(query).matchAll(/\b(?:PO|PR|RFQ|GRN|INV|SKU)-[A-Z0-9-]+\b/gi)) {
    const id = match[0].toUpperCase()
    push(entityTypeFromId(id), id)
  }

  const suppliers = asArray(data.suppliers)
  for (const supplier of suppliers) {
    const name = text(supplier.name || supplier.supplierName)
    const id = text(supplier.id || supplier.supplierId || name)
    if (name && text(query).includes(name)) push('supplier', id, `供应商 ${name}`)
  }
  return found
}

export function classifyAiRetrievalIntent(query = '') {
  const message = text(query)
  if (/今天|今日|today/.test(message) && /处理|关注|跟进|优先|工作台/.test(message)) return 'today_priority_query'
  if (/库存|sku|物料|inventory|stock|shortage/i.test(message) && /风险|关注|为什么|原因|缺货|低库存|补货|够不够/.test(message)) return 'inventory_risk_query'
  if (/\b(?:PO|PR|RFQ|GRN|INV)-[A-Z0-9-]+\b/i.test(message) && /解释|优先|为什么/.test(message)) return 'priority_explanation_query'
  if (/rfq|询价/i.test(message) && /跟进|回复|授标|报价|pending|response/i.test(message)) return 'rfq_followup_query'
  if (/供应商|supplier/i.test(message) && /跟进|风险|关注|follow/i.test(message)) return 'supplier_followup_query'
  if (/收货|grn|receiving/i.test(message) && /异常|待质检|差异|问题/.test(message)) return 'receiving_exception_query'
  if (/pr|采购申请/i.test(message) && /状态|待审批|待转|有哪些/.test(message)) return 'pr_status_query'
  if (/采购|单据|三单|发票|po|pr|grn|procurement|purchase/i.test(message) && /风险|异常|待处理|差异|逾期|问题|待审批|待转/.test(message)) return 'procurement_risk_query'
  if (/\b(?:PO|PR|RFQ|GRN|INV|SKU)-[A-Z0-9-]+\b/i.test(message)) return 'evidence_bundle_query'
  return 'unknown_query'
}

function procurementRoute(type, id) {
  return type && id ? `/api/procurement/documents/${type}/${encodeURIComponent(id)}` : ''
}

function inventoryRoute(sku) {
  return sku ? `/api/inventory/items/${encodeURIComponent(sku)}` : '/api/inventory/items'
}

function evidence(type, id, label, summary = '', route = '', status = '') {
  return { type, id, label: label || aiBusinessLabel(type, id), summary, route, status }
}

function deepLink(label, target) {
  return { kind: target ? 'deep_link' : 'review', label, target: target || '' }
}

function skuDraftPreview(item, originEvidence = []) {
  const sku = text(item.sku || item.id)
  return {
    kind: 'draft_preview',
    label: `预览 ${sku || '该 SKU'} 补货 PR 草稿，需人工审阅后再保存。`,
    target: '',
    draftType: 'purchase_request_draft',
    draftTitle: `${sku || 'SKU'} 补货 PR 草稿预览`,
    payload: {
      itemIdOrSku: sku,
      quantity: toNumber(item.reorderPoint ?? item.safetyStock ?? item.min ?? item.availableQuantity, 1) || 1,
      reason: item.riskReason || '内部检索发现库存风险，仅生成审阅草稿。',
      warehouse: item.defaultWarehouseId || item.warehouse || item.location || '',
    },
    originEvidence,
  }
}

function readModels(data = {}) {
  const procurementDocuments = buildProcurementDocuments(data)
  const procurementFollowups = buildProcurementFollowups(data)
  const procurementSummary = buildProcurementSummary(data)
  const inventoryItems = buildInventoryItems(data)
  const inventoryExceptions = buildInventoryExceptions(data)
  const todayCockpit = buildTodayCockpit(data, {
    procurementDocuments,
    procurementFollowups,
    procurementSummary,
    inventoryItems,
    inventoryExceptions,
  })
  return { procurementDocuments, procurementFollowups, procurementSummary, inventoryItems, inventoryExceptions, todayCockpit }
}

function findDocument(models, id = '') {
  return models.procurementDocuments.find((item) => text(item.id).toLowerCase() === text(id).toLowerCase()) || null
}

function findSku(models, sku = '') {
  return models.inventoryItems.find((item) => text(item.sku).toLowerCase() === text(sku).toLowerCase()) || null
}

function relatedProcurementForSku(models, sku = '') {
  return models.procurementDocuments
    .filter((doc) => [doc.sourceSku, doc.sku, doc.itemId, doc.itemName, doc.sourceName].some((value) => text(value).toLowerCase() === text(sku).toLowerCase()))
    .map((doc) => ({ type: doc.documentType, id: doc.id, label: aiBusinessLabel(doc.documentType, doc.id), status: doc.status || doc.matchStatus || doc.invoiceStatus || '', route: procurementRoute(doc.documentType, doc.id) }))
}

function relatedDocsForDocument(models, document = {}) {
  const docId = text(document?.id)
  const explicit = asArray(document?.relatedDocuments)
    .map((doc) => findDocument(models, doc.id))
    .filter(Boolean)
  const explicitIds = new Set(explicit.map((doc) => doc.id))
  const relatedIds = [document?.sourceRequest, document?.sourceRfq, document?.linkedRfq, document?.linkedPr, document?.linkedPo, document?.relatedPo, document?.relatedGrn].map(text).filter(Boolean)
  return models.procurementDocuments
    .filter((candidate) =>
      explicitIds.has(candidate.id) ||
      relatedIds.includes(candidate.id) ||
      [candidate.sourceRequest, candidate.sourceRfq, candidate.relatedPo, candidate.relatedGrn, candidate.poId].map(text).includes(docId)
    )
    .map((doc) => ({ type: doc.documentType, id: doc.id, label: aiBusinessLabel(doc.documentType, doc.id), status: doc.status || doc.matchStatus || doc.invoiceStatus || '', route: procurementRoute(doc.documentType, doc.id) }))
}

function relatedInventoryForDocument(models, document = {}) {
  const candidates = [document.sourceSku, document.sku, document.itemId, document.itemName].map(text).filter(Boolean)
  const sourcePr = document.sourceRequest ? findDocument(models, document.sourceRequest) : null
  candidates.push(text(sourcePr?.sourceSku), text(sourcePr?.sku), text(sourcePr?.itemName))
  return models.inventoryItems
    .filter((item) => candidates.some((value) => value && [item.sku, item.itemName, item.id].map(text).includes(value)))
    .map((item) => ({ sku: item.sku, itemName: item.itemName, status: item.status, riskLevel: item.riskLevel, availableQuantity: item.availableQuantity, safetyStock: item.safetyStock, reorderPoint: item.reorderPoint, route: inventoryRoute(item.sku) }))
}

function supplierForDocument(document = {}) {
  const supplier = text(document.supplierName || document.supplier)
  return supplier ? { name: supplier, label: `供应商 ${supplier}` } : null
}

function buildDocumentBundle(models, entity, query, intent) {
  const document = findDocument(models, entity.id)
  if (!document) return null
  const type = document.documentType || entity.type
  const relatedDocuments = relatedDocsForDocument(models, document)
  const relatedInventory = relatedInventoryForDocument(models, document)
  const bundleEvidence = [
    evidence(type, document.id, aiBusinessLabel(type, document.id), document.status || document.matchStatus || document.invoiceStatus || '', procurementRoute(type, document.id), document.status || ''),
    ...relatedDocuments.map((doc) => evidence(doc.type, doc.id, doc.label, doc.status, doc.route, doc.status)),
    ...relatedInventory.map((item) => evidence('inventory_item', item.sku, `${item.sku} 库存风险`, item.status || item.riskLevel || '', item.route, item.status || '')),
  ]
  const facts = {
    id: document.id,
    type,
    label: aiBusinessLabel(type, document.id),
    supplier: document.supplierName || document.supplier || '',
    status: document.status || document.matchStatus || document.invoiceStatus || '',
    amount: document.amount ?? document.invoiceAmount ?? document.poAmount ?? null,
    currency: document.currency || 'CNY',
    amountLabel: amount(document.amount ?? document.invoiceAmount ?? document.poAmount, document.currency || 'CNY'),
    expectedDate: document.expectedDate || document.dueDate || document.requiredDate || document.date || '',
    sourceRequest: document.sourceRequest || document.linkedPr || '',
    sourceRfq: document.sourceRfq || document.linkedRfq || '',
  }
  return {
    query,
    intent,
    bundleType: type,
    primaryEntity: entity,
    title: facts.label,
    facts,
    evidence: bundleEvidence,
    relatedDocuments,
    relatedInventory,
    relatedSupplier: supplierForDocument(document),
    relatedFinancialSignals: type === 'invoice' || document.varianceAmount ? [{ id: document.id, varianceAmount: document.varianceAmount || 0, status: document.matchStatus || document.invoiceStatus || '' }] : [],
    allowedActions: [
      deepLink(`打开 ${document.id}，查看业务明细。`, procurementRoute(type, document.id)),
      type === 'po' ? deepLink(`打开 ${document.id}，查看未到货明细，并确认供应商剩余交期。`, procurementRoute(type, document.id)) : null,
      type === 'rfq' ? deepLink(`打开 ${document.id}，确认待回复供应商和授标依据。`, procurementRoute(type, document.id)) : null,
      type === 'grn' ? deepLink(`打开 ${document.id}，复核收货差异和质检状态。`, procurementRoute(type, document.id)) : null,
    ].filter(Boolean),
    limitations: relatedInventory.length ? [] : ['未找到直接关联的 SKU 库存风险。'],
    auditContext: { eventType: 'ai_evidence_bundle_assembled', entityType: type, entityId: document.id },
  }
}

function buildSkuBundle(models, entity, query, intent) {
  const item = findSku(models, entity.id)
  if (!item) return null
  const relatedDocuments = relatedProcurementForSku(models, item.sku)
  const exceptions = models.inventoryExceptions.filter((exception) => text(exception.sku).toLowerCase() === text(item.sku).toLowerCase())
  const bundleEvidence = [
    evidence('inventory_item', item.sku, `${item.sku} 库存风险`, item.riskReason || item.status || item.riskLevel || '', inventoryRoute(item.sku), item.status || ''),
    ...relatedDocuments.map((doc) => evidence(doc.type, doc.id, doc.label, doc.status, doc.route, doc.status)),
  ]
  const facts = {
    sku: item.sku,
    itemName: item.itemName,
    availableQuantity: item.availableQuantity,
    safetyStock: item.safetyStock,
    min: item.safetyStock,
    reorderPoint: item.reorderPoint,
    warehouse: item.defaultWarehouseId || item.location || '',
    status: item.status,
    riskLevel: item.riskLevel,
  }
  return {
    query,
    intent,
    bundleType: 'sku',
    primaryEntity: entity,
    title: `${item.sku} 库存证据`,
    facts,
    evidence: bundleEvidence,
    relatedDocuments,
    relatedInventory: [{ sku: item.sku, itemName: item.itemName, status: item.status, availableQuantity: item.availableQuantity, safetyStock: item.safetyStock, reorderPoint: item.reorderPoint }],
    relatedSupplier: null,
    relatedFinancialSignals: [],
    allowedActions: [
      deepLink(`查看 ${item.sku} 的库存覆盖与关联采购单。`, inventoryRoute(item.sku)),
      skuDraftPreview(item, bundleEvidence),
    ],
    limitations: exceptions.length ? [] : ['未发现该 SKU 的开放库存异常记录。'],
    auditContext: { eventType: 'ai_evidence_bundle_assembled', entityType: 'inventory_item', entityId: item.sku },
  }
}

function buildSupplierBundle(models, entity, query, intent) {
  const supplierName = text(entity.label).replace(/^供应商\s*/, '') || entity.id
  const documents = models.procurementDocuments.filter((doc) => text(doc.supplierName || doc.supplier).includes(supplierName) || text(entity.id) === text(doc.supplierId))
  return {
    query,
    intent,
    bundleType: 'supplier',
    primaryEntity: entity,
    title: `供应商 ${supplierName}`,
    facts: { supplier: supplierName, relatedDocumentCount: documents.length },
    evidence: documents.slice(0, 5).map((doc) => evidence(doc.documentType, doc.id, aiBusinessLabel(doc.documentType, doc.id), doc.status || doc.matchStatus || '', procurementRoute(doc.documentType, doc.id), doc.status || '')),
    relatedDocuments: documents.slice(0, 5).map((doc) => ({ type: doc.documentType, id: doc.id, label: aiBusinessLabel(doc.documentType, doc.id), status: doc.status || doc.matchStatus || '', route: procurementRoute(doc.documentType, doc.id) })),
    relatedInventory: [],
    relatedSupplier: { id: entity.id, name: supplierName, label: `供应商 ${supplierName}` },
    relatedFinancialSignals: [],
    allowedActions: [deepLink(`查看供应商 ${supplierName} 的相关采购事项。`, 'procurement')],
    limitations: documents.length ? [] : ['未找到该供应商的开放采购证据。'],
    auditContext: { eventType: 'ai_evidence_bundle_assembled', entityType: 'supplier', entityId: entity.id },
  }
}

export function buildAiEvidenceBundles(data = {}, input = {}) {
  const query = text(input.query || input.question || input.message)
  const intent = input.intent || classifyAiRetrievalIntent(query)
  const models = readModels(data)
  const entities = asArray(input.entities).length ? input.entities : extractAiRetrievalEntities(query, data)
  const bundles = entities
    .map((entity) => {
      if (entity.type === 'sku') return buildSkuBundle(models, entity, query, intent)
      if (entity.type === 'supplier') return buildSupplierBundle(models, entity, query, intent)
      return buildDocumentBundle(models, entity, query, intent)
    })
    .filter(Boolean)
  return {
    query,
    intent,
    entities,
    activeContext: input.activeContext || null,
    bundles,
    primaryBundle: bundles[0] || null,
    limitations: bundles.length ? [] : ['未找到可组装的内部证据包。'],
  }
}
