function normalizedText(value = '') {
  return String(value || '').trim().toLowerCase()
}

function cleanText(value = '') {
  return String(value || '').trim()
}

function normalizeEntityType(value = '') {
  const raw = normalizedText(value).replace(/[\s-]+/g, '_')
  if (['rfq', 'rfx', 'request_for_quotation', 'quotation_request', '询价', '报价请求'].includes(raw)) return 'rfq'
  if (['supplier', 'vendor', 'srm_supplier', '供应商'].includes(raw)) return 'supplier'
  if (['item', 'sku', 'product', 'material', 'inventory_item', '物料'].includes(raw)) return 'item'
  if (['pr', 'purchase_request', 'purchase_requisition', '采购申请'].includes(raw)) return 'purchase_request'
  return raw
}

export function normalizeAiActiveContext(body = {}) {
  const raw = body.activeContext || body.activeEntity || body.context || body.currentContext || null
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const context = {
    module: cleanText(raw.module),
    entityType: normalizeEntityType(raw.entityType || raw.type || raw.kind),
    entityId: cleanText(raw.entityId || raw.id || raw.entityID),
    entityLabel: cleanText(raw.entityLabel || raw.label || raw.name || raw.title),
    view: cleanText(raw.view),
    route: cleanText(raw.route),
  }
  return Object.values(context).some(Boolean) ? context : null
}

export function activeContextEntity(body = {}, expectedEntityType = '') {
  const context = normalizeAiActiveContext(body)
  const expected = normalizeEntityType(expectedEntityType)
  if (!context || !expected || context.entityType !== expected || !context.entityId) return null
  return context
}

export function messageUsesContextReference(message = '', entityType = '') {
  const text = cleanText(message)
  if (!text) return false
  const normalized = normalizedText(text)
  const type = normalizeEntityType(entityType)

  if (type === 'rfq') {
    return /\b(?:this|current)\s+rfq\b/i.test(text) ||
      /(?:这个|当前|该|本)\s*(?:rfq|询价|报价请求)/i.test(text) ||
      /\brfq\b.*(?:status|状态|到哪一步|现在)/i.test(text)
  }
  if (type === 'supplier') {
    return /\b(?:this|current)\s+supplier\b/i.test(text) ||
      /(?:这个|当前|该|本)\s*供应商/i.test(text) ||
      /\bsupplier\b.*(?:status|risk|performance|recent)/i.test(text)
  }
  if (type === 'item') {
    return /\b(?:this|current)\s+(?:item|sku|material)\b/i.test(text) ||
      /(?:这个|当前|该|本)\s*(?:item|sku|物料|料号|商品)/i.test(text) ||
      /\bitem\b.*(?:inventory|stock|status|risk)/i.test(text)
  }
  if (type === 'purchase_request') {
    return /\b(?:this|current)\s+pr\b/i.test(text) ||
      /\b(?:this|current)\s+purchase\s+(?:request|requisition)\b/i.test(text) ||
      /(?:这个|当前|该|本)\s*(?:pr|采购申请)/i.test(text) ||
      normalized.includes('purchase request status')
  }
  return false
}

export function resolveContextualEntityId(body = {}, message = '', expectedEntityType = '', explicitId = '') {
  if (explicitId) {
    return { entityId: cleanText(explicitId), source: 'explicit_message', context: null }
  }
  const context = activeContextEntity(body, expectedEntityType)
  if (!context || !messageUsesContextReference(message, expectedEntityType)) {
    return { entityId: '', source: 'missing', context: null }
  }
  return { entityId: context.entityId, source: 'active_context', context }
}

export function activeContextEvidence(context = null, entityType = '') {
  if (!context?.entityId) return null
  const type = normalizeEntityType(entityType) || context.entityType || 'entity'
  const label = type === 'purchase_request' ? 'Purchase request' : type.toUpperCase()
  return {
    type: 'active_context',
    id: context.entityId,
    summary: `${label} id was resolved from active context.`,
  }
}
