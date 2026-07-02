function text(value, fallback = '') {
  const next = String(value ?? '').trim()
  return next || fallback
}

function compact(value = '') {
  return text(value).toLowerCase().replace(/[^\w\u4e00-\u9fa5-]+/g, '')
}

const ENTITY_PATTERNS = [
  ['po', /\bPO-[A-Z0-9-]+\b/gi],
  ['pr', /\bPR-[A-Z0-9-]+\b/gi],
  ['rfq', /\bRFQ-[A-Z0-9-]+\b/gi],
  ['grn', /\bGRN-[A-Z0-9-]+\b/gi],
  ['invoice', /\bINV-[A-Z0-9-]+\b/gi],
  ['sku', /\bSKU-[A-Z0-9-]+\b/gi],
  ['supplier', /\bSUP-[A-Z0-9-]+\b/gi],
]

export const AI_BUSINESS_INTENT_TAXONOMY = Object.freeze({
  attentionOverview: 'attention_overview_query',
  todayPriority: 'today_cockpit_priority_query',
  priorityExplanation: 'priority_explanation_query',
  procurementRisk: 'procurement_exception_query',
  inventoryRisk: 'inventory_status_query',
  rfqFollowup: 'rfq_followup_query',
  supplierFollowup: 'supplier_followup_query',
  receivingException: 'receiving_exception_query',
  prStatus: 'pr_status_query',
  relationshipReasoning: 'relationship_reasoning_query',
  dataLimitation: 'data_limitation_query',
  sopGuidance: 'sop_retrieval_query',
  draftPreview: 'draft_preview_query',
  entityLookup: 'entity_lookup_query',
  unknownGuidedFallback: 'unknown_guided_fallback',
})

export const AI_INTENT_ALIASES = Object.freeze({
  today_priority_query: AI_BUSINESS_INTENT_TAXONOMY.todayPriority,
  procurement_risk_query: AI_BUSINESS_INTENT_TAXONOMY.procurementRisk,
  inventory_risk_query: AI_BUSINESS_INTENT_TAXONOMY.inventoryRisk,
  sop_guidance_query: AI_BUSINESS_INTENT_TAXONOMY.sopGuidance,
  prepare_purchase_request_draft: AI_BUSINESS_INTENT_TAXONOMY.draftPreview,
  prepare_rfq_draft: AI_BUSINESS_INTENT_TAXONOMY.draftPreview,
})

export function normalizeAiIntentName(name = '') {
  const normalized = text(name)
  return AI_INTENT_ALIASES[normalized] || normalized || AI_BUSINESS_INTENT_TAXONOMY.unknownGuidedFallback
}

function entityMatches(message = '') {
  const entities = []
  for (const [type, pattern] of ENTITY_PATTERNS) {
    for (const match of message.matchAll(pattern)) {
      entities.push({ type, id: match[0].toUpperCase(), source: 'message' })
    }
  }
  return entities
}

function sessionEntities(body = {}) {
  const entities = []
  const active = body.activeContext || {}
  if (active.entityId || active.id) {
    entities.push({
      type: text(active.entityType || active.type || 'context'),
      id: text(active.entityId || active.id),
      source: 'active_context',
    })
  }
  const grounding = body.sessionGrounding || {}
  const primary = grounding.lastPrimaryEntity || {}
  if (primary.id) {
    entities.push({ type: text(primary.type || 'context'), id: text(primary.id), source: 'session_grounding' })
  }
  return entities.filter((item) => item.id)
}

function modelPolicyFor(intent) {
  if (intent === AI_BUSINESS_INTENT_TAXONOMY.unknownGuidedFallback) return 'guided_fallback'
  if (intent === AI_BUSINESS_INTENT_TAXONOMY.draftPreview) return 'deterministic_only'
  if (intent === AI_BUSINESS_INTENT_TAXONOMY.sopGuidance) return 'deterministic_only'
  return 'deterministic_only'
}

function route(intent, confidence, entities, routeReason, options = {}) {
  return {
    intent: normalizeAiIntentName(intent),
    confidence,
    entities,
    routeReason,
    needsClarification: Boolean(options.needsClarification),
    modelPolicy: options.modelPolicy || modelPolicyFor(normalizeAiIntentName(intent)),
  }
}

function hasBroadAttentionIntent(message = '') {
  const normalized = compact(message)
  if (!normalized) return false
  const hasAttentionVerb = /注意|要看|先看|优先|关注|提醒|跟进|风险|异常|问题|情况|怎么样|overview|attention|risk|issue/.test(message)
  const hasBroadScope = /有什么|有哪些|有没有|当前|现在|今天|今日|整体|全局|哪里|什么/.test(message)
  const isSpecificDomain = /采购|库存|供应商|RFQ|询价|收货|GRN|发票|PO|PR|SKU|数据|SOP|规则|草稿/i.test(message)
  return hasAttentionVerb && hasBroadScope && !isSpecificDomain && normalized.length <= 48
}

export function isBroadAttentionPrompt(message = '') {
  return hasBroadAttentionIntent(message)
}

export function isTechnicalProviderDiagnosticPrompt(message = '') {
  return /provider|openai|doubao|ark|模型|外部\s*AI|AI\s*Provider|debug|诊断|配置|api key|apikey/i.test(message)
}

export function classifyAiBusinessIntent(body = {}) {
  const message = text(body.question || body.message || body.prompt || body.text)
  const entities = [...entityMatches(message), ...sessionEntities(body)]
  const hasMessageEntity = entities.some((item) => item.source === 'message')
  const hasSessionEntity = entities.some((item) => item.source !== 'message')

  if (!message) {
    return route(AI_BUSINESS_INTENT_TAXONOMY.unknownGuidedFallback, 0.45, entities, 'empty_input', { needsClarification: true })
  }
  if (hasMessageEntity) {
    if (/关系|关联|来自|哪个|对应|linked|relat/i.test(message)) return route(AI_BUSINESS_INTENT_TAXONOMY.relationshipReasoning, 0.95, entities, 'explicit_business_entity_relationship')
    if (/优先|为什么|原因|解释|priority/i.test(message)) return route(AI_BUSINESS_INTENT_TAXONOMY.priorityExplanation, 0.94, entities, 'explicit_business_entity_priority')
    if (entities.some((item) => item.type === 'rfq') && /回复|报价|供应商|授标|跟进|response|quote|award/i.test(message)) return route(AI_BUSINESS_INTENT_TAXONOMY.rfqFollowup, 0.94, entities, 'explicit_rfq_task')
    return route(AI_BUSINESS_INTENT_TAXONOMY.entityLookup, 0.78, entities, 'explicit_business_entity')
  }
  if (hasSessionEntity && /这个|它|刚才|上面|关联|哪个|为什么|跟进|回复/.test(message)) {
    return route(AI_BUSINESS_INTENT_TAXONOMY.relationshipReasoning, 0.82, entities, 'session_grounded_entity')
  }
  if (/草稿|draft|生成|预览|准备/.test(message) && /PR|采购申请|RFQ|询价|供应商|跟进|补货/i.test(message)) return route(AI_BUSINESS_INTENT_TAXONOMY.draftPreview, 0.88, entities, 'specific_draft_preview_task')
  if (/数据.*(?:有限|不完整|依据|质量|缺口)|依据.*(?:不够|有限|不完整)|不确定|不能确定|limitations?|uncertain/i.test(message)) return route(AI_BUSINESS_INTENT_TAXONOMY.dataLimitation, 0.9, entities, 'data_limitation_task')
  if (/SOP|规则|流程|通常|一般|怎么处理|应该/.test(message)) return route(AI_BUSINESS_INTENT_TAXONOMY.sopGuidance, 0.86, entities, 'sop_guidance_task')
  if (/供应商|supplier/i.test(message) && /跟进|follow|风险|关注|推荐|建议/.test(message)) return route(AI_BUSINESS_INTENT_TAXONOMY.supplierFollowup, 0.88, entities, 'supplier_followup_task')
  if (/RFQ|询价/i.test(message) && /跟进|回复|报价|供应商|授标|pending|response/i.test(message)) return route(AI_BUSINESS_INTENT_TAXONOMY.rfqFollowup, 0.88, entities, 'rfq_followup_task')
  if (/收货|GRN|质检|入库|receiving/i.test(message) && /异常|问题|风险|待处理|跟进/.test(message)) return route(AI_BUSINESS_INTENT_TAXONOMY.receivingException, 0.86, entities, 'receiving_exception_task')
  if (/PR|采购申请/i.test(message) && /状态|待审批|转换|转.*PO|进度|status/i.test(message)) return route(AI_BUSINESS_INTENT_TAXONOMY.prStatus, 0.86, entities, 'pr_status_task')
  if (/采购|单据|三单|发票|收货|po|pr|rfq|grn|procurement|purchase/i.test(message) && /风险|异常|待处理|待审批|待转|差异|跟进|逾期|问题|为什么|原因|优先|有哪些/.test(message)) return route(AI_BUSINESS_INTENT_TAXONOMY.procurementRisk, 0.86, entities, 'procurement_risk_task')
  if (/库存|sku|物料|inventory|stock|shortage/i.test(message) && /风险|关注|为什么|原因|缺货|低库存|补货|够不够|异常/.test(message)) return route(AI_BUSINESS_INTENT_TAXONOMY.inventoryRisk, 0.86, entities, 'inventory_risk_task')
  if (/今天|今日|today/.test(message) && /处理|关注|跟进|优先|工作台|看什么/.test(message)) return route(AI_BUSINESS_INTENT_TAXONOMY.todayPriority, 0.86, entities, 'today_priority_task')
  if (hasBroadAttentionIntent(message)) return route(AI_BUSINESS_INTENT_TAXONOMY.attentionOverview, 0.8, entities, 'broad_attention_overview')
  return route(AI_BUSINESS_INTENT_TAXONOMY.unknownGuidedFallback, 0.5, entities, 'guided_fallback', { needsClarification: true })
}

export function buildUnknownGuidedFallbackResponse(body = {}, classification = classifyAiBusinessIntent(body)) {
  const choices = [
    { label: '今日优先事项', prompt: '有什么需要我注意的？', intent: AI_BUSINESS_INTENT_TAXONOMY.attentionOverview },
    { label: '库存风险', prompt: '哪些 SKU 有库存风险？', intent: AI_BUSINESS_INTENT_TAXONOMY.inventoryRisk },
    { label: '供应商跟进', prompt: '哪些供应商需要跟进？', intent: AI_BUSINESS_INTENT_TAXONOMY.supplierFollowup },
    { label: 'RFQ 回复', prompt: '哪些 RFQ 需要关注？', intent: AI_BUSINESS_INTENT_TAXONOMY.rfqFollowup },
    { label: '收货异常', prompt: '今天有哪些收货异常？', intent: AI_BUSINESS_INTENT_TAXONOMY.receivingException },
    { label: '数据不完整项', prompt: '哪些数据依据不够完整？', intent: AI_BUSINESS_INTENT_TAXONOMY.dataLimitation },
  ]
  const message = '我还不能确定你想看哪类业务数据。你可以选择：今日优先事项、库存风险、供应商跟进、RFQ 回复、收货异常、数据不完整项。'
  return {
    provider: 'local',
    providerStatus: 'deterministic',
    mode: 'deterministic',
    status: 'guided_fallback',
    intent: { name: AI_BUSINESS_INTENT_TAXONOMY.unknownGuidedFallback, confidence: classification.confidence, slots: {} },
    aiBusinessIntent: classification,
    message,
    content: message,
    cards: [
      { type: 'guided_fallback', title: '选择业务方向', data: { choices, routeReason: classification.routeReason } },
      { type: 'recommended_actions', actions: choices.map((choice) => ({ kind: 'prompt', label: choice.label, prompt: choice.prompt, target: '' })) },
    ],
    evidence: [],
    readModelReuse: true,
    usedWeb: false,
  }
}
