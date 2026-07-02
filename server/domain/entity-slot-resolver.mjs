function text(value = '') {
  return String(value ?? '').trim()
}

const ID_PATTERNS = [
  ['po', /\bPO-\d{4}-\d{3,6}\b/gi],
  ['sku', /\bSKU-\d{3,8}\b/gi],
  ['grn', /\bGRN-\d{6}-\d{3,6}\b/gi],
  ['rfq', /\bRFQ-\d{2}-\d{3,6}\b/gi],
  ['invoice', /\bINV-[A-Z0-9-]+\b/gi],
  ['supplier', /\bSUP-\d{3,8}\b/gi],
  ['pr', /\bPR-\d{4}-\d{3,6}\b/gi],
]

const CONTEXT_TYPE_HINTS = {
  inventory: 'sku',
  sku: 'sku',
  item: 'sku',
  procurement: 'po',
  purchasing: 'po',
  purchase_orders: 'po',
  po: 'po',
  rfq: 'rfq',
  receiving: 'grn',
  invoice: 'invoice',
  supplier: 'supplier',
  srm: 'supplier',
  purchase_requests: 'pr',
  pr: 'pr',
}

export function resolveEntitySlots(input = '', options = {}) {
  const sourceContext = options.sourceContext || {}
  const records = options.records || {}
  const value = text(input)
  const resolvedEntities = []
  const unresolvedReferences = []
  const assumptions = []

  for (const [type, pattern] of ID_PATTERNS) {
    for (const match of value.matchAll(pattern)) {
      resolvedEntities.push(resolveKnownEntity(type, match[0].toUpperCase(), records, 'explicit_id'))
    }
  }

  for (const partial of value.matchAll(/\b\d{3,6}\b/g)) {
    if (resolvedEntities.some((entity) => entity.id.includes(partial[0]))) continue
    const typeHint = contextTypeHint(sourceContext)
    const resolved = typeHint ? resolvePartialId(typeHint, partial[0], records, sourceContext) : null
    if (resolved) {
      resolvedEntities.push(resolved)
      assumptions.push(`Resolved partial id ${partial[0]} as ${resolved.id} from ${sourceContext.sourceModule || sourceContext.sourceEntityType || 'context'}.`)
    } else {
      unresolvedReferences.push({ raw: partial[0], reason: typeHint ? 'record_not_found_or_ambiguous' : 'partial_id_requires_context', candidates: partialCandidates(partial[0], records) })
    }
  }

  const pronouns = resolvePronouns(value, sourceContext)
  resolvedEntities.push(...pronouns.resolved)
  unresolvedReferences.push(...pronouns.unresolved)
  assumptions.push(...pronouns.assumptions)

  const slots = extractSlots(value, resolvedEntities)
  const requiredSlots = requiredSlotsFor(options.intent)
  const missingSlots = requiredSlots.filter((slot) => slots[slot] === undefined && !entityCoversSlot(slot, resolvedEntities))

  return {
    resolvedEntities: uniqueEntities(resolvedEntities),
    unresolvedReferences,
    extractedSlots: slots,
    missingSlots,
    assumptions,
    provider: 'local',
    mutationAllowed: false,
  }
}

function resolveKnownEntity(type, id, records, source) {
  const matches = findRecords(type, id, records)
  return {
    type,
    id,
    source,
    confidence: matches.length ? 0.98 : 0.82,
    record: matches.length === 1 ? matches[0] : undefined,
    candidates: matches.length > 1 ? matches : undefined,
    dataLimitation: matches.length ? undefined : 'record_not_loaded_for_validation',
  }
}

function resolvePartialId(type, partial, records, sourceContext) {
  const candidates = partialCandidates(partial, records).filter((item) => item.type === type)
  if (candidates.length === 1) return { type, id: candidates[0].id, source: 'partial_id_context', confidence: 0.86, record: candidates[0].record }
  const sourceId = text(sourceContext.sourceEntityId || sourceContext.entityId)
  if (sourceId && sourceId.includes(partial)) return { type, id: sourceId, source: 'source_context_partial', confidence: 0.9 }
  return null
}

function partialCandidates(partial, records) {
  return Object.entries(records).flatMap(([type, list]) => {
    if (!Array.isArray(list)) return []
    return list.flatMap((record) => {
      const id = recordId(record)
      return id.includes(partial) ? [{ type: normalizeType(type), id, record }] : []
    })
  })
}

function findRecords(type, id, records) {
  return Object.values(records).flatMap((list) => Array.isArray(list) ? list : []).filter((record) => recordId(record).toUpperCase() === id.toUpperCase())
}

function recordId(record = {}) {
  return text(record.id || record.po || record.pr || record.sku || record.grn || record.invoiceNumber || record.supplierId || record.supplier)
}

function normalizeType(type) {
  if (/sku|product|inventory/i.test(type)) return 'sku'
  if (/po|purchaseOrders/i.test(type)) return 'po'
  if (/pr|purchaseRequests/i.test(type)) return 'pr'
  if (/rfq/i.test(type)) return 'rfq'
  if (/grn|receiving/i.test(type)) return 'grn'
  if (/invoice/i.test(type)) return 'invoice'
  if (/supplier/i.test(type)) return 'supplier'
  return type
}

function contextTypeHint(sourceContext = {}) {
  const hint = text(sourceContext.sourceEntityType || sourceContext.entityType || sourceContext.sourceModule || sourceContext.module).toLowerCase()
  return CONTEXT_TYPE_HINTS[hint] || Object.entries(CONTEXT_TYPE_HINTS).find(([key]) => hint.includes(key))?.[1]
}

function resolvePronouns(value, sourceContext) {
  const resolved = []
  const unresolved = []
  const assumptions = []
  const pronounRules = [
    ['sku', /(这个|this)\s*(SKU|物料|item)/i],
    ['po', /(这个|this)\s*PO/i],
    ['supplier', /(这个|this)\s*(供应商|supplier)/i],
    ['pr', /(这个|this)\s*PR/i],
    ['rfq', /(这个|this)\s*RFQ/i],
  ]
  for (const [type, pattern] of pronounRules) {
    if (!pattern.test(value)) continue
    const contextId = text(sourceContext.sourceEntityId || sourceContext.entityId)
    const contextType = normalizeType(text(sourceContext.sourceEntityType || sourceContext.entityType))
    if (contextId && (!contextType || contextType === type)) {
      resolved.push({ type, id: contextId, source: 'context_pronoun', confidence: 0.88 })
      assumptions.push(`Resolved contextual pronoun to ${contextId}.`)
    } else {
      unresolved.push({ raw: pattern.source, type, reason: 'context_pronoun_requires_matching_source_context' })
    }
  }
  return { resolved, unresolved, assumptions }
}

function extractSlots(value, resolvedEntities) {
  const slots = {}
  const quantity = value.match(/(?:买|采购|申请|起草|数量|qty|quantity)?\s*(\d+(?:\.\d+)?)\s*(个|件|pcs?|台|套)(?![A-Za-z0-9-])/i)
  if (quantity) slots.quantity = { value: Number(quantity[1]), unit: quantity[2] || undefined, confidence: 0.84 }
  const date = value.match(/(下周[一二三四五六日天]?|明天|后天|\d{4}-\d{1,2}-\d{1,2})/)
  if (date) slots.requiredDate = { value: date[1], confidence: 0.72, needsNormalization: !/^\d{4}-/.test(date[1]) }
  const warehouse = value.match(/(WH-[A-Z0-9-]+|[一二三四五六七八九十A-Z0-9]+号?仓|仓库[ A-Z0-9一二三四五六七八九十]+)/i)
  if (warehouse) slots.warehouse = { value: warehouse[1], confidence: 0.78 }
  const costCenter = value.match(/(?:cost center|成本中心)[:： ]*([A-Z0-9-]+)/i)
  if (costCenter) slots.costCenter = { value: costCenter[1], confidence: 0.84 }
  const responseDeadline = value.match(/(?:response deadline|报价截止|回复截止)[:： ]*(下周[一二三四五六日天]?|明天|后天|\d{4}-\d{1,2}-\d{1,2})/i)
  if (responseDeadline) slots.responseDeadline = { value: responseDeadline[1], confidence: 0.78 }
  const supplier = resolvedEntities.find((item) => item.type === 'supplier')
  if (supplier) slots.supplier = { value: supplier.id, confidence: supplier.confidence }
  const sku = resolvedEntities.find((item) => item.type === 'sku')
  if (sku) slots.sku = { value: sku.id, confidence: sku.confidence }
  if (/原因|因为|reason/i.test(value)) slots.reason = { value: value, confidence: 0.5 }
  return slots
}

function requiredSlotsFor(intent) {
  const map = {
    draft_supplier_application: ['supplierName', 'category', 'contactPerson'],
    draft_purchase_request: ['sku', 'quantity', 'requiredDate', 'warehouse', 'costCenter'],
    draft_sourcing_event: ['sku', 'quantity', 'responseDeadline', 'evaluationCriteria'],
    draft_rfq: ['sku', 'quantity', 'responseDeadline'],
    draft_purchase_order: ['supplier', 'sku', 'quantity', 'price', 'deliveryDate'],
  }
  return map[intent] || []
}

function entityCoversSlot(slot, entities) {
  if (slot === 'sku') return entities.some((item) => item.type === 'sku')
  if (slot === 'supplier' || slot === 'supplierName') return entities.some((item) => item.type === 'supplier')
  return false
}

function uniqueEntities(items) {
  const seen = new Set()
  return items.filter((item) => {
    const key = `${item.type}:${item.id}:${item.source}`
    if (!item.id || seen.has(key)) return false
    seen.add(key)
    return true
  })
}
