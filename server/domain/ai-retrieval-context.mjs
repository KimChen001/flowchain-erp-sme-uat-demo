import { buildAiEvidenceBundles } from './ai-internal-retrieval.mjs'

const ALLOWED_ACTION_KINDS = new Set(['deep_link', 'review', 'edit', 'draft_preview'])
const INTERNAL_TERMS = [
  'documentType',
  'entityType',
  'inventory_item',
  'tool_result',
  'debug',
  'repository',
  'response_card',
  'action-FOLLOWUP',
  'supplier_boundary_notice',
  'master_data_boundary_notice',
  'auditContext',
  'bundleType',
]
const KNOWN_STATUS_VALUES = ['待审批', '进行中', '部分到货', '待质检', '存在差异', '低库存', '待复核', '已完成', '已关闭', '已取消', '已收货']

function text(value, fallback = '') {
  const next = String(value ?? '').trim()
  return next || fallback
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null))
}

function sanitizeAction(action = {}) {
  const kind = ALLOWED_ACTION_KINDS.has(action.kind) ? action.kind : 'review'
  return {
    kind,
    label: text(action.label),
    target: text(action.target),
    draftType: action.draftType ? text(action.draftType) : undefined,
    draftTitle: action.draftTitle ? text(action.draftTitle) : undefined,
    payload: action.kind === 'draft_preview' ? clone(action.payload || {}) : undefined,
    requiresHumanReview: kind !== 'deep_link',
  }
}

function compactFacts(facts = {}) {
  return Object.fromEntries(
    Object.entries(facts)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [key, value])
  )
}

function publicEvidence(evidence = []) {
  return asArray(evidence).map((item) => ({
    id: text(item.id),
    label: text(item.label),
    summary: text(item.summary || item.status),
    route: text(item.route),
    status: text(item.status),
  }))
}

function hasUnsupportedAction(action = {}) {
  if (!ALLOWED_ACTION_KINDS.has(action.kind)) return true
  if (action.autoSubmit || action.autoApprove || action.mutate || action.method === 'POST') return true
  if (action.kind === 'draft_preview' && !action.requiresHumanReview) return true
  return false
}

export function buildAiRetrievalContext(data = {}, input = {}) {
  const retrieval = buildAiEvidenceBundles(data, input)
  const bundle = retrieval.primaryBundle
  const actions = asArray(bundle?.allowedActions).map(sanitizeAction)
  return {
    question: retrieval.query,
    intent: retrieval.intent,
    entities: clone(retrieval.entities),
    primaryEntity: clone(bundle?.primaryEntity || null),
    immutableFacts: compactFacts(bundle?.facts || {}),
    evidence: publicEvidence(bundle?.evidence || []),
    relatedDocuments: clone(bundle?.relatedDocuments || []),
    relatedInventory: clone(bundle?.relatedInventory || []),
    relatedSupplier: clone(bundle?.relatedSupplier || null),
    relatedFinancialSignals: clone(bundle?.relatedFinancialSignals || []),
    allowedActions: actions,
    limitations: [...asArray(retrieval.limitations), ...asArray(bundle?.limitations)],
    responseRules: [
      '只能使用 immutableFacts 和 evidence 中存在的事实。',
      '不输出内部字段名、调试标签、工具调用名或数据结构名。',
      '不得声称已经执行审批、下单、收货、发票匹配或提交动作。',
      'draft_preview 只表示草稿预览，必须由用户人工审阅后再保存。',
    ],
  }
}

export function validateAiRetrievalActions(actions = []) {
  const violations = []
  for (const [index, action] of asArray(actions).entries()) {
    if (hasUnsupportedAction(action)) {
      violations.push({ code: 'unsafe_action', index, actionKind: text(action.kind, 'unknown') })
    }
  }
  return { valid: violations.length === 0, violations }
}

export function validateAiRetrievalOutput(output = '', context = {}) {
  const message = text(output)
  const violations = []
  for (const term of INTERNAL_TERMS) {
    if (message.includes(term)) violations.push({ code: 'internal_term_leak', term })
  }

  const facts = context.immutableFacts || {}
  const expectedStatus = text(facts.status)
  if (expectedStatus) {
    for (const status of KNOWN_STATUS_VALUES) {
      if (status !== expectedStatus && message.includes(status)) {
        violations.push({ code: 'fact_status_mismatch', expected: expectedStatus, actual: status })
      }
    }
  }

  const expectedAmount = text(facts.amountLabel)
  for (const match of message.matchAll(/¥\s*[\d,]+(?:\.\d+)?/g)) {
    if (expectedAmount && text(match[0]) !== expectedAmount) {
      violations.push({ code: 'unsupported_amount', expected: expectedAmount, actual: text(match[0]) })
    }
  }

  const allowedDates = new Set(Object.values(facts).filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(text(value))).map(text))
  for (const match of message.matchAll(/\b20\d{2}-\d{2}-\d{2}\b/g)) {
    if (!allowedDates.has(match[0])) violations.push({ code: 'unsupported_date', actual: match[0] })
  }

  const actionCheck = validateAiRetrievalActions(context.allowedActions)
  violations.push(...actionCheck.violations)
  return { valid: violations.length === 0, violations }
}

