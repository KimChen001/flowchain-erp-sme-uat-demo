import { normalizeBusinessCommand } from './business-command-normalizer.mjs'

function text(value = '') {
  return String(value ?? '').trim()
}

function hasAny(value, patterns) {
  return patterns.some((pattern) => pattern.test(value))
}

const DANGEROUS_ACTIONS = [
  { phrase: '下单', action: 'issue_po', downgradedIntent: 'draft_purchase_order' },
  { phrase: '发给供应商', action: 'send_to_supplier', downgradedIntent: 'draft_supplier_followup' },
  { phrase: '发邮件', action: 'send_email', downgradedIntent: 'draft_supplier_followup' },
  { phrase: '审批', action: 'approve', downgradedIntent: 'draft_exception_note' },
  { phrase: '付款', action: 'pay', downgradedIntent: 'draft_exception_note' },
  { phrase: '过账', action: 'post', downgradedIntent: 'draft_exception_note' },
]

const ACTION_RULES = [
  { intent: 'draft_supplier_application', terms: ['supplier'], confidence: 0.9, patterns: [/供应商申请|新增供应商|申请.*供应商|supplier application|onboard/i] },
  { intent: 'draft_purchase_request', terms: ['purchase_request', 'sku'], confidence: 0.9, patterns: [/起草.*PR|开个?申请|采购申请|请购单|补货申请|买\s*\d+|PR\b|purchase request|库存不够.*申请/i] },
  { intent: 'draft_sourcing_event', terms: ['sourcing_event'], confidence: 0.88, patterns: [/sourcing event|寻源事件|创建.*寻源|填一下.*sourcing/i] },
  { intent: 'draft_rfq', terms: ['rfq', 'supplier'], confidence: 0.88, patterns: [/RFQ\b|询价|报价请求|找供应商报价|供应商报价|request for quote|quote request/i] },
  { intent: 'draft_purchase_order', terms: ['purchase_order'], confidence: 0.9, patterns: [/起草.*PO|生成.*PO|转成\s*PO|purchase order|下单|采购订单/i] },
  { intent: 'draft_supplier_followup', terms: ['supplier', 'purchase_order'], confidence: 0.86, patterns: [/催.*供应商|供应商.*跟进|写.*跟进|催货|follow.?up|发给供应商|发邮件/i] },
  { intent: 'draft_exception_note', terms: ['grn', 'invoice'], confidence: 0.82, patterns: [/异常.*处理意见|处理建议|invoice mismatch|三单匹配.*建议|收货异常/i] },
]

const DIAGNOSTIC_RULES = [
  { intent: 'today_attention', patterns: [/今天|今日|优先|待办|attention/i], confidence: 0.78 },
  { intent: 'explain_po_delay', patterns: [/PO-[A-Z0-9-]+.*(延期|延迟|delay)|订单.*(延期|延迟)/i], confidence: 0.86 },
  { intent: 'explain_sku_shortage', patterns: [/SKU-[A-Z0-9-]+.*(不够|短缺|缺货|库存)|\b\d{4,6}\b.*(不够|短缺|缺货|库存)|库存不够|低于安全库存/i], confidence: 0.88 },
  { intent: 'analyze_supplier_risk', patterns: [/供应商.*风险|supplier.*risk/i], confidence: 0.82 },
  { intent: 'trace_receiving_exception', patterns: [/收货异常|GRN-[A-Z0-9-]+.*异常/i], confidence: 0.84 },
  { intent: 'trace_invoice_matching_failure', patterns: [/invoice mismatch|三单匹配|发票.*差异/i], confidence: 0.84 },
  { intent: 'analyze_rfq_timing', patterns: [/RFQ.*(超时|时效|timing)|询价.*(超时|进度)/i], confidence: 0.82 },
  { intent: 'find_related_records', patterns: [/关联|关系|related|linked/i], confidence: 0.78 },
  { intent: 'check_data_completeness', patterns: [/数据.*完整|缺字段|缺失|completeness/i], confidence: 0.78 },
]

function riskyActions(value) {
  return DANGEROUS_ACTIONS.filter((item) => value.includes(item.phrase))
}

function compoundMarkers(value) {
  return /(然后|再|之后|如果|不够就|based on|after|then|,|，)/i.test(value)
}

export function extractBusinessActionIntents(input = '', options = {}) {
  const normalization = options.normalization || normalizeBusinessCommand(input)
  const source = `${normalization.originalText} ${normalization.normalizedText}`
  const candidates = []
  const dangerous = riskyActions(source)

  for (const rule of DIAGNOSTIC_RULES) {
    if (hasAny(source, rule.patterns)) candidates.push(candidate(rule.intent, 'diagnostic', rule.confidence, normalization, rule.patterns, dangerous))
  }
  for (const rule of ACTION_RULES) {
    if (hasAny(source, rule.patterns) || rule.terms.some((term) => normalization.normalizedBusinessTerms.some((item) => item.term === term))) {
      candidates.push(candidate(rule.intent, 'action_draft', rule.confidence, normalization, rule.patterns, dangerous))
    }
  }

  for (const item of dangerous) {
    if (!candidates.some((candidateItem) => candidateItem.intent === item.downgradedIntent)) {
      candidates.push(candidate(item.downgradedIntent, 'action_draft', 0.76, normalization, [], dangerous))
    }
  }

  if (normalization.normalizedBusinessTerms.some((item) => item.term === 'sourcing_event') && !candidates.some((item) => item.intent === 'draft_rfq')) {
    candidates.push(candidate('draft_rfq', 'action_draft', 0.62, normalization, [], dangerous, true))
  }

  const unique = uniqueCandidates(candidates)
  if (unique.length > 1 && compoundMarkers(source)) {
    unique.unshift({
      intent: 'compound_business_action',
      kind: 'compound',
      confidence: 0.82,
      matchedTerms: normalization.normalizedBusinessTerms.map((item) => item.term),
      correctionAssumptions: normalization.corrections,
      requiresReview: true,
      mutationAllowed: false,
      dangerousActionHandling: dangerous,
    })
  }

  if (!unique.length) {
    unique.push({
      intent: 'guided_business_action_choice',
      kind: 'fallback',
      confidence: 0.45,
      matchedTerms: [],
      correctionAssumptions: normalization.corrections,
      requiresReview: true,
      mutationAllowed: false,
      needsClarification: true,
    })
  }

  return {
    originalText: normalization.originalText,
    normalizedText: normalization.normalizedText,
    candidates: unique,
    dangerousActionHandling: dangerous.map((item) => ({ ...item, autonomousExecutionAllowed: false })),
    provider: 'local',
    mutationAllowed: false,
  }
}

function candidate(intent, kind, confidence, normalization, patterns, dangerous, ambiguous = false) {
  return {
    intent,
    kind,
    confidence,
    matchedTerms: normalization.normalizedBusinessTerms.map((item) => item.term),
    correctionAssumptions: normalization.corrections,
    requiresReview: kind !== 'diagnostic',
    mutationAllowed: false,
    autonomousExecutionAllowed: false,
    ambiguous,
    dangerousActionHandling: dangerous.map((item) => ({ ...item, autonomousExecutionAllowed: false })),
  }
}

function uniqueCandidates(items) {
  const seen = new Set()
  return items.filter((item) => {
    const key = item.intent
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
