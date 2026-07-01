import { buildAiEvidenceReuseResponse } from './ai-evidence-reuse.mjs'

function text(value, fallback = '') {
  const next = String(value ?? '').trim()
  return next || fallback
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function compactEntityType(type = '') {
  const normalized = text(type).toLowerCase()
  if (['po', 'purchase_order'].includes(normalized)) return 'po'
  if (['pr', 'purchase_request'].includes(normalized)) return 'pr'
  if (['rfq'].includes(normalized)) return 'rfq'
  if (['sku', 'item', 'inventory_item'].includes(normalized)) return 'sku'
  if (['grn', 'receiving_doc'].includes(normalized)) return 'grn'
  if (['supplier'].includes(normalized)) return 'supplier'
  return normalized
}

function hasExplicitBusinessId(message = '') {
  return /\b(?:PO|PR|RFQ|GRN|INV|SKU)-[A-Z0-9-]+\b/i.test(message)
}

function hasReferenceLanguage(message = '') {
  return /(这个|这张|该|它|刚才|刚刚|上面|前面)/.test(message) && !/这个页面|当前页面/.test(message)
}

function requestedEntityType(message = '') {
  if (/\bPO\b|采购单|采购订单/i.test(message)) return 'po'
  if (/\bPR\b|采购申请/i.test(message)) return 'pr'
  if (/\bRFQ\b|询价/i.test(message)) return 'rfq'
  if (/\bSKU\b|物料|库存/i.test(message)) return 'sku'
  if (/\bGRN\b|收货/i.test(message)) return 'grn'
  if (/供应商|supplier/i.test(message)) return 'supplier'
  return ''
}

function candidatesForType(grounding = {}, type = '') {
  const normalized = compactEntityType(type)
  const visible = grounding.lastVisibleBusinessIds || {}
  const candidates = [...asArray(visible[normalized])]
  const active = grounding.activeContext || {}
  if (compactEntityType(active.entityType) === normalized && active.entityId) candidates.push(active.entityId)
  const primary = grounding.lastPrimaryEntity || {}
  if (compactEntityType(primary.type) === normalized && primary.id) candidates.push(primary.id)
  return [...new Set(candidates.map((item) => text(item).toUpperCase()).filter(Boolean))]
}

function rewriteMessageForEntity(message = '', type = '', id = '') {
  const normalized = compactEntityType(type)
  if (normalized === 'po' && /为什么|优先|原因|解释/.test(message)) return `解释 ${id} 为什么优先`
  if (normalized === 'sku' && /风险|哪里|为什么|库存|补货/.test(message)) return `${id} 为什么风险高？`
  if (normalized === 'rfq' && /回复|跟进|几家|报价|谁/.test(message)) return `${id} 需要怎么跟进？`
  if (normalized === 'grn') return `${id} 有没有收货异常？`
  if (normalized === 'pr') return `${id} 状态是什么？`
  return `${id} ${message}`
}

function clarification(type = '', candidates = []) {
  const label = type.toUpperCase()
  if (candidates.length > 1) return `我需要确认你说的是 ${candidates.join(' 还是 ')}？请点一下证据或直接输入 ${label} 编号。`
  return `我需要确认你说的 ${label} 是哪一个。请点一下证据或直接输入编号。`
}

function clarificationResponse({ message, type, candidates, reason }) {
  const content = clarification(type || '对象', candidates)
  return {
    provider: 'local',
    providerStatus: 'deterministic',
    mode: 'deterministic',
    intent: { name: 'session_grounding_clarification', confidence: 1, slots: { requestedType: type || '', reason } },
    content,
    message: content,
    cards: [{ type: 'ambiguous_match', title: '需要确认上下文', matches: candidates.map((id) => ({ id, label: id })) }],
    evidence: [],
    sessionGrounded: false,
    originalQuestion: message,
  }
}

export function resolveAiSessionGrounding(body = {}) {
  const message = text(body.question || body.message || body.prompt || body.text)
  if (!body.sessionGrounding) return null
  if (!message || hasExplicitBusinessId(message) || !hasReferenceLanguage(message)) return null
  const grounding = body.sessionGrounding || {}
  const type = requestedEntityType(message) || compactEntityType(grounding.lastPrimaryEntity?.type)
  if (!type) return { clarification: true, type: '', candidates: [], reason: 'missing_entity_type' }
  const candidates = candidatesForType(grounding, type)
  if (candidates.length !== 1) {
    return { clarification: true, type, candidates, reason: candidates.length ? 'ambiguous_candidates' : 'missing_candidates' }
  }
  return {
    clarification: false,
    type,
    id: candidates[0],
    question: rewriteMessageForEntity(message, type, candidates[0]),
  }
}

export function buildAiSessionGroundedResponse(data = {}, body = {}, options = {}) {
  const resolution = resolveAiSessionGrounding(body)
  if (!resolution) return null
  const message = text(body.question || body.message || body.prompt || body.text)
  if (resolution.clarification) return clarificationResponse({ message, ...resolution })
  const groundedBody = {
    ...body,
    question: resolution.question,
    message: resolution.question,
    sessionGrounding: undefined,
  }
  const result = buildAiEvidenceReuseResponse(data, groundedBody, options)
  if (!result) return clarificationResponse({ message, type: resolution.type, candidates: [resolution.id], reason: 'unsupported_grounded_prompt' })
  return {
    ...result,
    sessionGrounded: true,
    originalQuestion: message,
    groundedQuestion: resolution.question,
    intent: {
      ...result.intent,
      slots: {
        ...(result.intent?.slots || {}),
        sessionGrounding: { type: resolution.type, id: resolution.id },
      },
    },
  }
}
