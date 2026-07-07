const DATA_SCOPE = '当前工作区数据'
const MAX_REFS = 12
const MAX_BREADCRUMBS = 6
const MAX_TEXT = 160
const TECHNICAL_PATTERN = /JSON|dry-run|tenantId|userId|datasetId|writesDb|writesFiles|DB|database|schema|environment|tool_result|provider|model|endpoint|token|API key|API|fallback|deterministic|mock|fake|demo|UAT|sample data|demo data|response_card|entityType|documentType|raw enum|payload|webhook|Coupa|RBAC|production|deploy|go-live|system prompt|prompt package|OpenAI|DeepSeek|Doubao|豆包/i
const ACTION_PATTERN = /自动批准|自动下单|正式创建\s*PO|下发\s*PO|发送\s*PO|发布\s*RFQ|邀请供应商|发送邮件|发送|推送|已发送|提交收货|Receive Submit|Submit Receipt|库存过账|Post Invoice|Approve Invoice|Mark as Paid|Payment execution|Export to Accounting|付款|会计过账|修改供应商主数据|更新银行账户|发布风险评级|自动黑名单|自动暂停供应商|自动修复|自动提交导入|自动覆盖数据|自动写入数据库|批量删除|清空数据|sent|delivered|dispatched|webhook|portal invite|保存配置|保存权限|保存边界|保存历史|保存准备度|修改权限|修改历史|修改准备度|删除历史|立即生效|自动应用|分配角色|创建用户|删除用户|禁用用户|创建租户|切换租户|合并租户|迁移数据|同步数据|跨租户查询|写入配置|写入日志|推送日志|导出审计报告|生成正式审计报告|发送审计报告|启用试点|开启试点|上线|部署|生成正式报告|导出正式报告|发送报告/i

function asArray(value) { return Array.isArray(value) ? value : [] }
function rawText(value, fallback = '') { return String(value ?? '').trim() || fallback }
function cleanText(value = '', fallback = '') {
  return rawText(value, fallback)
    .replace(new RegExp(ACTION_PATTERN.source, 'ig'), '正式业务处理')
    .replace(new RegExp(TECHNICAL_PATTERN.source, 'ig'), DATA_SCOPE)
    .slice(0, MAX_TEXT)
}
function confidenceRank(value = '') {
  if (value === 'high') return 3
  if (value === 'medium') return 2
  return 1
}
function normalizeConfidence(value = '') {
  return ['high', 'medium', 'low'].includes(value) ? value : 'medium'
}
function normalizeSource(value = '') {
  return ['activePage', 'previousResponse', 'evidence', 'navigation', 'reviewCard', 'session'].includes(value) ? value : 'previousResponse'
}
function normalizeEntityType(value = '', label = '', id = '') {
  const raw = `${value} ${label} ${id}`
  if (/purchase_order|采购订单|\bPO\b|^PO-/i.test(raw)) return 'PO'
  if (/purchase_request|采购申请|\bPR\b|^PR-/i.test(raw)) return 'PR'
  if (/rfq|询价|报价|^RFQ-/i.test(raw)) return 'RFQ'
  if (/receiving|grn|收货|^GRN-/i.test(raw)) return 'GRN'
  if (/invoice|发票|已收未票|^INV-/i.test(raw)) return 'Invoice'
  if (/inventory|item|sku|物料|^SKU-/i.test(raw)) return 'SKU'
  if (/supplier|供应商|供方/i.test(raw)) return 'Supplier'
  if (/warehouse|仓库/i.test(raw)) return 'Warehouse'
  if (/report|报表/i.test(raw)) return 'Report'
  if (/risk|风险/i.test(raw)) return 'Risk'
  if (/draft|草稿|review/i.test(raw)) return 'ActionDraft'
  return 'Unknown'
}
function entityModule(type = '') {
  const map = {
    PO: 'procurement:orders',
    PR: 'procurement:requests',
    RFQ: 'procurement:rfq',
    GRN: 'procurement:receiving',
    Invoice: 'finance',
    Supplier: 'srm',
    SKU: 'inventory',
    Risk: 'overview',
    ActionDraft: 'review-actions',
  }
  return map[type] || 'overview'
}
function businessTypeLabel(type = '') {
  const map = {
    PO: '采购订单',
    PR: '采购申请',
    RFQ: '询价单',
    GRN: '收货记录',
    Invoice: '发票',
    Supplier: '供应商',
    SKU: 'SKU',
    Warehouse: '仓库',
    Report: '报表',
    Risk: '风险',
    ActionDraft: '人工复核草稿',
  }
  return map[type] || '业务对象'
}
function moduleLabel(moduleId = '') {
  if (/srm/.test(moduleId)) return '供应商风险'
  if (/inventory/.test(moduleId)) return '库存风险'
  if (/finance/.test(moduleId)) return '财务协同'
  if (/procurement/.test(moduleId)) return '采购管理'
  if (/imports/.test(moduleId)) return '数据依据'
  if (/review-actions/.test(moduleId)) return '人工复核'
  if (/overview:ai/.test(moduleId)) return 'AI 建议'
  return '当前工作区'
}
function makeEntityRef(input = {}, fallbackSource = 'previousResponse') {
  const entityId = cleanText(input.entityId || input.id || input.targetEntityId)
  const entityLabel = cleanText(input.entityLabel || input.objectLabel || input.label || input.title || entityId, entityId || '业务对象')
  const entityType = normalizeEntityType(input.entityType || input.type || input.targetEntityType, entityLabel, entityId)
  return {
    entityType,
    entityId,
    entityLabel,
    source: normalizeSource(input.source || fallbackSource),
    confidence: normalizeConfidence(input.confidence || (entityId ? 'high' : 'medium')),
  }
}
function dedupeRefs(refs = []) {
  const seen = new Set()
  return refs
    .filter((ref) => ref?.entityLabel)
    .sort((a, b) => confidenceRank(b.confidence) - confidenceRank(a.confidence))
    .filter((ref) => {
      const key = `${ref.entityType}:${ref.entityId || ref.entityLabel}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, MAX_REFS)
}
function compactNavigation(link = {}, source = 'navigation') {
  return {
    label: cleanText(link.label || link.entityLabel || link.moduleId, '来源证据'),
    moduleId: cleanText(link.moduleId || entityModule(normalizeEntityType(link.entityType, link.entityLabel, link.entityId)), 'overview'),
    entityType: normalizeEntityType(link.entityType, link.entityLabel || link.label, link.entityId),
    entityId: cleanText(link.entityId),
    entityLabel: cleanText(link.entityLabel || link.label || link.entityId, '来源证据'),
    returnTo: 'ai-assistant',
    source,
  }
}
function compactEvidence(item = {}) {
  return {
    id: cleanText(item.id || item.entityId || item.entityLabel),
    label: cleanText(item.evidenceLabel || item.label || item.entityLabel, '来源证据'),
    entityType: normalizeEntityType(item.entityType, item.entityLabel || item.label, item.entityId || item.id),
    entityId: cleanText(item.entityId || item.id),
    entityLabel: cleanText(item.entityLabel || item.objectLabel || item.label || item.id, '来源证据'),
    moduleId: cleanText(item.moduleId || entityModule(normalizeEntityType(item.entityType, item.entityLabel, item.entityId)), 'overview'),
    source: 'evidence',
  }
}
function visibleText(value) {
  if (Array.isArray(value)) return value.map(visibleText).join(' ')
  if (!value || typeof value !== 'object') return String(value ?? '')
  return Object.entries(value)
    .filter(([key]) => !/^(id|entityId|moduleId|returnTo|source|intentHint|lastResponseId)$/i.test(key))
    .map(([, item]) => visibleText(item))
    .join(' ')
}
function isClean(value) {
  const text = visibleText(value)
  return !TECHNICAL_PATTERN.test(text) && !ACTION_PATTERN.test(text)
}

export function extractBusinessContextFromAiResponseV2(response = {}) {
  const refs = []
  const navigationRefs = []
  const evidenceRefs = []
  for (const item of asArray(response.keyEvidence)) {
    const evidence = compactEvidence(item)
    evidenceRefs.push(evidence)
    refs.push(makeEntityRef({ ...evidence, source: 'evidence', confidence: 'high' }))
  }
  for (const link of asArray(response.navigationLinks)) {
    const nav = compactNavigation(link, 'navigation')
    navigationRefs.push(nav)
    refs.push(makeEntityRef({ ...nav, source: 'navigation', confidence: nav.entityId ? 'high' : 'medium' }))
  }
  for (const card of asArray(response.reviewCards)) {
    refs.push(makeEntityRef({
      entityType: card.targetEntityType,
      entityId: card.targetEntityId,
      entityLabel: card.title,
      source: 'reviewCard',
      confidence: card.targetEntityId ? 'high' : 'medium',
    }))
    for (const origin of asArray(card.originEvidence)) {
      refs.push(makeEntityRef({ ...origin, entityType: origin.type, entityId: origin.id, entityLabel: origin.label, source: 'reviewCard', confidence: 'medium' }))
    }
  }
  return {
    previousIntent: cleanText(response.intent),
    previousQuestion: cleanText(response.query),
    previousConclusionTitle: cleanText(response.conclusion?.title),
    previousEntityRefs: dedupeRefs(refs),
    previousNavigationRefs: navigationRefs.slice(0, MAX_REFS),
    previousEvidenceRefs: evidenceRefs.slice(0, MAX_REFS),
    previousModuleId: cleanText(response.scope?.module),
    previousFocusTarget: response.scope?.entityId ? {
      entityType: cleanText(response.scope?.entityType),
      entityId: cleanText(response.scope?.entityId),
      entityLabel: cleanText(response.scope?.entityId),
    } : null,
    lastResponseId: cleanText(response.responseId),
  }
}

export function sanitizeConversationContextV2(context = {}) {
  return normalizeConversationContextV2(context)
}

export function normalizeConversationContextV2(input = {}) {
  const extracted = input.previousResponse && typeof input.previousResponse === 'object'
    ? extractBusinessContextFromAiResponseV2(input.previousResponse)
    : {}
  const previousEntityRefs = dedupeRefs([
    ...asArray(input.previousEntityRefs).map((item) => makeEntityRef(item, item?.source || 'session')),
    ...asArray(input.entityRefs).map((item) => makeEntityRef(item, item?.source || 'session')),
    ...asArray(input.previousEvidenceRefs).map((item) => makeEntityRef({ ...item, source: 'evidence' }, 'evidence')),
    ...asArray(input.previousNavigationRefs).map((item) => makeEntityRef({ ...item, source: 'navigation' }, 'navigation')),
    ...asArray(extracted.previousEntityRefs),
  ])
  return {
    previousIntent: cleanText(input.previousIntent || input.intentCarryOver || extracted.previousIntent),
    previousQuestion: cleanText(input.previousQuestion || extracted.previousQuestion),
    previousConclusionTitle: cleanText(input.previousConclusionTitle || input.previousAnswerSummary || extracted.previousConclusionTitle),
    previousEntityRefs,
    previousNavigationRefs: [
      ...asArray(input.previousNavigationRefs).map((item) => compactNavigation(item)),
      ...asArray(extracted.previousNavigationRefs),
    ].slice(0, MAX_REFS),
    previousEvidenceRefs: [
      ...asArray(input.previousEvidenceRefs).map(compactEvidence),
      ...asArray(extracted.previousEvidenceRefs),
    ].slice(0, MAX_REFS),
    previousModuleId: cleanText(input.previousModuleId || extracted.previousModuleId),
    previousViewId: cleanText(input.previousViewId),
    previousFocusTarget: input.previousFocusTarget && typeof input.previousFocusTarget === 'object' ? {
      entityType: cleanText(input.previousFocusTarget.entityType),
      entityId: cleanText(input.previousFocusTarget.entityId),
      entityLabel: cleanText(input.previousFocusTarget.entityLabel || input.previousFocusTarget.entityId),
    } : extracted.previousFocusTarget || null,
    breadcrumbTrail: asArray(input.breadcrumbTrail).slice(0, MAX_BREADCRUMBS).map((item) => ({
      label: cleanText(item.label, '上下文'),
      moduleId: cleanText(item.moduleId || 'overview'),
      entityLabel: cleanText(item.entityLabel || item.label, '当前对象'),
      returnTo: 'ai-assistant',
    })),
    lastResponseId: cleanText(input.lastResponseId || extracted.lastResponseId),
    returnContext: input.returnContext && typeof input.returnContext === 'object' ? {
      returnTo: 'ai-assistant',
      returnLabel: cleanText(input.returnContext.returnLabel || '返回 AI 助手'),
      sourceModuleId: cleanText(input.returnContext.sourceModuleId),
      sourceViewId: cleanText(input.returnContext.sourceViewId),
    } : null,
  }
}

function activeEntityRef(activeContext = {}) {
  const focus = activeContext?.focusTarget || activeContext
  if (!focus?.entityId && !focus?.entityLabel) return null
  return makeEntityRef({
    entityType: focus.entityType,
    entityId: focus.entityId,
    entityLabel: focus.entityLabel || focus.entityId,
    source: 'activePage',
    confidence: 'high',
  }, 'activePage')
}

function sessionEntityRefs(session = {}) {
  const refs = []
  const primary = session.lastPrimaryEntity
  if (primary) refs.push(makeEntityRef({ entityType: primary.type, entityId: primary.id, entityLabel: primary.label || primary.id, source: 'session', confidence: 'high' }, 'session'))
  const ids = session.lastVisibleBusinessIds || {}
  for (const [type, values] of Object.entries(ids)) {
    for (const id of asArray(values)) refs.push(makeEntityRef({ entityType: type, entityId: id, entityLabel: id, source: 'session', confidence: 'medium' }, 'session'))
  }
  return refs
}

export function buildConversationGroundingV2({ request = {}, previousContext = {}, previousResponse = null, activeContext = null } = {}) {
  const normalized = normalizeConversationContextV2({
    ...previousContext,
    previousResponse: previousResponse || previousContext.previousResponse,
  })
  const activeRef = activeEntityRef(activeContext || { focusTarget: request.focusTarget })
  const refs = dedupeRefs([
    ...(activeRef ? [activeRef] : []),
    ...normalized.previousEntityRefs,
    ...sessionEntityRefs(request.sessionGrounding || {}),
  ])
  const context = {
    ...normalized,
    previousEntityRefs: refs,
    previousIntent: cleanText(normalized.previousIntent || request.sessionGrounding?.lastIntent),
    previousModuleId: cleanText(normalized.previousModuleId || request.activeModuleId),
    previousViewId: cleanText(normalized.previousViewId || request.activeViewId),
  }
  return {
    context,
    entityRefs: refs,
    evidenceRefs: normalized.previousEvidenceRefs,
    navigationRefs: normalized.previousNavigationRefs,
    activeRef,
    hasContext: refs.length > 0 || Boolean(context.previousIntent),
  }
}

function requestedTypes(message = '') {
  const text = rawText(message)
  const types = []
  if (/这个\s*PO|该\s*PO|PO|采购订单|this\s*PO/i.test(text)) types.push('PO')
  if (/供应商|供方|supplier/i.test(text)) types.push('Supplier')
  if (/SKU|物料|item/i.test(text)) types.push('SKU')
  if (/发票|invoice/i.test(text)) types.push('Invoice')
  if (/GRN|收货/i.test(text)) types.push('GRN')
  if (/草稿|人工复核|draft/i.test(text)) types.push('ActionDraft')
  if (/风险|risk/i.test(text)) types.push('Risk')
  return [...new Set(types)]
}
function hasFollowUpReference(message = '') {
  return /这个|它|刚刚那个|刚才那个|上一个|那个|这条|这张|继续看|展开证据|为什么优先|相关对象|上一层|返回刚才|this|it|that one|previous one|go back|continue|drill down|show related objects|why is it priority/i.test(message)
}
function intentCarryOver(message = '', previousIntent = '') {
  if (/供应商风险|supplier risk/i.test(message)) return 'supplier_risk'
  if (/数据|补哪个|fix first/i.test(message) && previousIntent === 'data_incomplete') return 'data_incomplete'
  if (/相关对象|related objects|和哪些/i.test(message)) return 'related_objects'
  if (/为什么优先|why is it priority/i.test(message)) return 'po_priority'
  return cleanText(previousIntent)
}
function chooseRef(refs = [], types = []) {
  const filtered = types.length ? refs.filter((ref) => types.includes(ref.entityType)) : refs
  return filtered.sort((a, b) => confidenceRank(b.confidence) - confidenceRank(a.confidence))[0] || null
}

export function resolveFollowUpReferenceV2({ message = '', conversationGrounding = {} } = {}) {
  const refs = asArray(conversationGrounding.entityRefs)
  const types = requestedTypes(message)
  const isFollowUp = hasFollowUpReference(message)
  const intent = intentCarryOver(message, conversationGrounding.context?.previousIntent)
  if (!isFollowUp && !types.length) {
    return { resolvedFrom: 'currentMessage', entityRefs: [], intentCarryOver: intent, confidence: 'low' }
  }
  if (!refs.length) {
    return {
      resolvedFrom: 'notResolved',
      entityRefs: [],
      intentCarryOver: intent,
      confidence: 'low',
      limitationLabel: '当前上下文不足，需要先选择具体对象或打开来源证据。',
    }
  }
  const chosen = chooseRef(refs, types)
  if (!chosen) {
    return {
      resolvedFrom: 'notResolved',
      entityRefs: [],
      intentCarryOver: intent,
      confidence: 'low',
      limitationLabel: '当前上下文不足，需要先选择具体对象或打开来源证据。',
    }
  }
  const sameType = refs.filter((ref) => ref.entityType === chosen.entityType)
  const ambiguous = isFollowUp && !types.length && sameType.length > 1
  return {
    resolvedFrom: chosen.source === 'activePage' ? 'activePage' : chosen.source === 'session' ? 'session' : 'previousResponse',
    entityRefs: [chosen, ...refs.filter((ref) => ref !== chosen && ref.entityType !== 'Unknown').slice(0, 4)],
    intentCarryOver: intent,
    confidence: ambiguous ? 'medium' : chosen.confidence,
    limitationLabel: ambiguous ? '当前上下文包含多个相关对象，需要人工确认后继续。' : '',
  }
}

export function buildContextBreadcrumbsV2(conversationGrounding = {}, resolvedContext = {}) {
  const refs = asArray(resolvedContext.entityRefs).length ? resolvedContext.entityRefs : asArray(conversationGrounding.entityRefs).slice(0, 2)
  const trail = asArray(conversationGrounding.context?.breadcrumbTrail)
  const breadcrumbs = [
    ...trail,
    ...(conversationGrounding.context?.previousIntent ? [{
      label: `来自上一轮：${moduleLabel(conversationGrounding.context.previousModuleId)} / ${cleanText(conversationGrounding.context.previousConclusionTitle || conversationGrounding.context.previousIntent, '业务上下文')}`,
      moduleId: conversationGrounding.context.previousModuleId || 'overview',
      entityLabel: cleanText(conversationGrounding.context.previousConclusionTitle || '业务上下文'),
      returnTo: 'ai-assistant',
    }] : []),
    ...refs.map((ref) => ({
      label: `${businessTypeLabel(ref.entityType)}：${cleanText(ref.entityLabel || ref.entityId)}`,
      moduleId: entityModule(ref.entityType),
      entityLabel: cleanText(ref.entityLabel || ref.entityId),
      returnTo: 'ai-assistant',
    })),
  ].filter((item) => item.label)
  return breadcrumbs.slice(0, MAX_BREADCRUMBS).filter(isClean)
}

export function buildFollowUpSuggestionsV2(response = {}, conversationGrounding = {}) {
  const intent = response.intent || conversationGrounding.context?.previousIntent || ''
  const suggestions = [
    { label: '展开相关对象', prompt: '展开这个对象的相关对象。', intentHint: 'related_objects', requiresReview: true },
    { label: '查看证据限制', prompt: '我应该先看哪个证据？', intentHint: 'data_incomplete', requiresReview: true },
    { label: '进入人工复核', prompt: '打开这个对象的人工复核草稿。', intentHint: 'review_first', requiresReview: true },
    { label: intent === 'supplier_risk' ? '返回供应商风险' : '返回上一层', prompt: intent === 'supplier_risk' ? '回到刚刚那个供应商风险。' : '返回刚才的业务上下文。', intentHint: intent || 'context_return', requiresReview: true },
  ]
  return suggestions.filter(isClean).slice(0, 4)
}

export function boundedConversationSummaryV2(conversationGrounding = {}, resolvedContext = {}) {
  return {
    previousIntent: cleanText(conversationGrounding.context?.previousIntent),
    resolvedFrom: cleanText(resolvedContext.resolvedFrom || 'currentMessage'),
    intentCarryOver: cleanText(resolvedContext.intentCarryOver),
    confidence: normalizeConfidence(resolvedContext.confidence),
    entityRefs: asArray(resolvedContext.entityRefs).slice(0, 5).map((ref) => ({
      entityType: ref.entityType,
      entityId: cleanText(ref.entityId),
      entityLabel: cleanText(ref.entityLabel),
      source: normalizeSource(ref.source),
      confidence: normalizeConfidence(ref.confidence),
    })),
    evidenceRefs: asArray(conversationGrounding.evidenceRefs).slice(0, 5).map((item) => ({ id: item.id, label: item.label, entityLabel: item.entityLabel })),
    navigationRefs: asArray(conversationGrounding.navigationRefs).slice(0, 5).map((item) => ({ label: item.label, moduleId: item.moduleId, entityLabel: item.entityLabel, returnTo: 'ai-assistant' })),
  }
}
