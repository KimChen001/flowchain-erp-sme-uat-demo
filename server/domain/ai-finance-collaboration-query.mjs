import {
  buildProcurementSupplierInvoices,
  buildProcurementThreeWayMatches,
} from './procurement-read-model.mjs'

export const aiFinanceCollaborationCapabilityCatalog = Object.freeze([
  {
    intent: 'finance_pending_settlement_query',
    examples: ['查看待结算项', '哪些发票需要复核？', 'show pending settlement'],
    requiredSlots: [],
    optionalSlots: ['supplier', 'invoice', 'status'],
    responseCards: ['finance_pending_settlement_summary', 'three_way_match_summary', 'finance_boundary_notice', 'recommended_actions', 'evidence'],
    mode: 'read',
  },
  {
    intent: 'finance_variance_explanation_query',
    examples: ['解释差异原因', '哪些三单匹配有差异？', 'explain invoice variance'],
    requiredSlots: [],
    optionalSlots: ['supplier', 'invoice', 'varianceType'],
    responseCards: ['finance_variance_summary', 'three_way_match_summary', 'finance_boundary_notice', 'recommended_actions', 'evidence'],
    mode: 'read',
  },
  {
    intent: 'finance_next_actions_query',
    examples: ['下一步跟进', 'finance next actions'],
    requiredSlots: [],
    optionalSlots: ['supplier', 'invoice'],
    responseCards: ['finance_next_actions', 'finance_boundary_notice', 'recommended_actions', 'evidence'],
    mode: 'read',
  },
])

const FINANCE_BOUNDARY = '当前 Alpha 仅展示财务协同可见性：不执行付款、不做会计过账、不处理税务申报，也不进行最终审批。'

function text(value = '', fallback = '') {
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

function money(value = 0, currency = 'CNY') {
  const prefix = currency === 'CNY' ? '¥' : `${currency} `
  return `${prefix}${toNumber(value, 0).toLocaleString()}`
}

function normalizeFinanceMessage(body = {}) {
  return text(body.question || body.message || body.prompt || body.text)
}

function hasFinanceContext(body = {}, message = '') {
  const moduleId = text(body.moduleId || body.activeContext?.module)
  if (moduleId) return moduleId === 'finance'
  return /财务|待结算|结算|应付|付款|过账|三单匹配|finance|settlement|payable|three.?way/i.test(message)
}

export function detectAiFinanceCollaborationIntent(message = '', body = {}) {
  const raw = text(message)
  if (!raw || !hasFinanceContext(body, raw)) return null
  if (/下一步|跟进|next/i.test(raw)) return 'finance_next_actions_query'
  if (/差异|原因|复核|三单匹配|variance|match/i.test(raw)) return 'finance_variance_explanation_query'
  if (/待结算|结算|应付|付款|发票|invoice|settlement|payable/i.test(raw)) return 'finance_pending_settlement_query'
  return null
}

function invoiceIsPending(invoice = {}) {
  const status = text(invoice.invoiceStatus || invoice.status || invoice.matchStatus)
  if (/已付款|已关闭|已完成/.test(status)) return false
  return true
}

function invoiceHasVariance(invoice = {}) {
  return toNumber(invoice.varianceAmount, 0) !== 0 || !/自动匹配|已匹配|无差异/.test(text(invoice.matchStatus))
}

function topInvoices(invoices = []) {
  return invoices.slice(0, 5).map((invoice) => ({
    invoiceId: invoice.id,
    supplier: invoice.supplier,
    amount: invoice.amount,
    currency: invoice.currency,
    dueDate: invoice.dueDate,
    matchStatus: invoice.matchStatus,
    invoiceStatus: invoice.invoiceStatus,
    varianceAmount: invoice.varianceAmount,
    relatedPo: invoice.relatedPo,
    relatedGrn: invoice.relatedGrn,
    reason: invoiceHasVariance(invoice)
      ? `匹配状态 ${invoice.matchStatus || invoice.invoiceStatus}，差异金额 ${money(invoice.varianceAmount, invoice.currency)}`
      : `待结算协同状态 ${invoice.invoiceStatus || invoice.matchStatus}`,
  }))
}

function evidenceForInvoices(invoices = [], matches = []) {
  const invoiceEvidence = invoices.slice(0, 4).map((invoice) => ({
    type: 'supplier_invoice',
    id: invoice.id,
    label: invoice.id,
    status: invoice.invoiceStatus || invoice.matchStatus,
    summary: `${invoice.supplier || '供应商'} ${money(invoice.amount, invoice.currency)} ${invoice.matchStatus || ''}`.trim(),
    route: invoice.id ? `/finance?view=invoices&invoiceId=${encodeURIComponent(invoice.id)}` : '/finance?view=invoices',
  }))
  const matchEvidence = matches.slice(0, 2).map((match) => ({
    type: 'threeWayMatch',
    id: match.id,
    label: match.id,
    status: match.matchStatus || match.status,
    summary: `${match.invoice} / ${match.po || '缺 PO'} / ${match.grn || '缺 GRN'}`,
    route: match.invoice ? `/finance?view=invoices&invoiceId=${encodeURIComponent(match.invoice)}` : '/finance?view=invoices',
  }))
  return [...invoiceEvidence, ...matchEvidence]
}

function evidenceCard(evidence = []) {
  return { type: 'evidence', evidence }
}

function recommendedActions(actions = []) {
  return { type: 'recommended_actions', actions }
}

function boundaryCard() {
  return {
    type: 'finance_boundary_notice',
    title: '财务协同边界',
    data: {
      boundary: FINANCE_BOUNDARY,
      paymentExecution: 'disabled',
      accountingPosting: 'disabled',
      taxFiling: 'disabled',
      finalApproval: 'disabled',
    },
  }
}

function financeReadModels(db = {}) {
  const invoices = buildProcurementSupplierInvoices(db)
  const matches = buildProcurementThreeWayMatches(db)
  const pendingInvoices = invoices.filter(invoiceIsPending)
  const varianceInvoices = invoices.filter(invoiceHasVariance)
  const varianceMatches = matches.filter((match) => toNumber(match.varianceAmount, 0) !== 0 || !/自动匹配|已匹配/.test(text(match.matchStatus)))
  return { invoices, matches, pendingInvoices, varianceInvoices, varianceMatches }
}

function buildPendingSettlementResponse(db = {}) {
  const { invoices, matches, pendingInvoices, varianceInvoices, varianceMatches } = financeReadModels(db)
  const totalPendingAmount = pendingInvoices.reduce((sum, invoice) => sum + toNumber(invoice.amount, 0), 0)
  const evidence = evidenceForInvoices(pendingInvoices.length ? pendingInvoices : invoices, varianceMatches)
  return {
    message: `当前 Alpha 可展示待复核 / 待结算协同视图，但不执行付款或过账。共识别 ${pendingInvoices.length} 张待协同发票，金额 ${money(totalPendingAmount)}；其中 ${varianceInvoices.length} 张存在差异或需复核。${FINANCE_BOUNDARY}`,
    intent: { name: 'finance_pending_settlement_query', confidence: 0.9, slots: {} },
    cards: [
      {
        type: 'finance_pending_settlement_summary',
        title: '待结算协同摘要',
        data: {
          invoiceCount: invoices.length,
          pendingSettlementCount: pendingInvoices.length,
          pendingAmount: totalPendingAmount,
          varianceInvoiceCount: varianceInvoices.length,
          threeWayVarianceCount: varianceMatches.length,
          topInvoices: topInvoices(pendingInvoices.length ? pendingInvoices : invoices),
        },
      },
      {
        type: 'three_way_match_summary',
        title: '三单匹配差异',
        data: {
          matchCount: matches.length,
          varianceCount: varianceMatches.length,
          topMatches: varianceMatches.slice(0, 5).map((match) => ({
            matchId: match.id,
            invoice: match.invoice,
            po: match.po,
            grn: match.grn,
            supplier: match.supplier,
            status: match.matchStatus || match.status,
            varianceAmount: match.varianceAmount,
            reason: match.blockingReason || match.exceptionReason,
          })),
        },
      },
      boundaryCard(),
      evidenceCard(evidence),
      recommendedActions([
        { label: '打开财务发票协同', kind: 'deep_link', target: '/finance?view=invoices' },
        { label: '查看应付账款', kind: 'deep_link', target: '/finance?view=payables' },
        { label: '查看结算准备', kind: 'deep_link', target: '/finance?view=settlement' },
      ]),
    ],
    evidence,
  }
}

function buildVarianceResponse(db = {}) {
  const { varianceInvoices, varianceMatches } = financeReadModels(db)
  const top = varianceInvoices.length ? varianceInvoices : []
  const evidence = evidenceForInvoices(top, varianceMatches)
  const totalVariance = varianceInvoices.reduce((sum, invoice) => sum + Math.abs(toNumber(invoice.varianceAmount, 0)), 0)
  return {
    message: `差异主要来自数量差异、价格差异、缺少收货、运费差异或重复发票风险。当前可见 ${varianceInvoices.length} 张差异发票，差异金额 ${money(totalVariance)}；请按 PO、GRN、发票证据复核。${FINANCE_BOUNDARY}`,
    intent: { name: 'finance_variance_explanation_query', confidence: 0.9, slots: {} },
    cards: [
      {
        type: 'finance_variance_summary',
        title: '财务差异原因',
        data: {
          varianceInvoiceCount: varianceInvoices.length,
          totalVarianceAmount: totalVariance,
          topVariances: topInvoices(top),
        },
      },
      {
        type: 'three_way_match_summary',
        title: '三单匹配差异',
        data: {
          matchCount: varianceMatches.length,
          varianceCount: varianceMatches.length,
          topMatches: varianceMatches.slice(0, 5).map((match) => ({
            matchId: match.id,
            invoice: match.invoice,
            po: match.po,
            grn: match.grn,
            supplier: match.supplier,
            status: match.matchStatus || match.status,
            varianceAmount: match.varianceAmount,
            reason: match.blockingReason || match.exceptionReason,
          })),
        },
      },
      boundaryCard(),
      evidenceCard(evidence),
      recommendedActions([
        { label: '打开差异发票', kind: 'deep_link', target: '/finance?view=invoices' },
        { label: '查看供应商对账', kind: 'deep_link', target: '/finance?view=reconciliation' },
        { label: '查看相关采购单据', kind: 'deep_link', target: '/procurement?view=invoices' },
      ]),
    ],
    evidence,
  }
}

function buildNextActionsResponse(db = {}) {
  const { pendingInvoices, varianceInvoices, varianceMatches } = financeReadModels(db)
  const actions = [
    {
      title: '先复核差异发票',
      reason: `${varianceInvoices.length} 张发票存在差异或需人工复核，先确认 PO/GRN/发票证据。`,
      target: '/finance?view=invoices',
    },
    {
      title: '再同步采购/收货证据',
      reason: `${varianceMatches.length} 条三单匹配差异需要采购、收货和 AP 协同确认。`,
      target: '/procurement?view=invoices',
    },
    {
      title: '最后进入结算准备观察',
      reason: `${pendingInvoices.length} 张待协同发票只进入可见性复核，不执行付款或过账。`,
      target: '/finance?view=settlement',
    },
  ]
  const evidence = evidenceForInvoices(varianceInvoices.length ? varianceInvoices : pendingInvoices, varianceMatches)
  return {
    message: `建议先复核差异，再补齐采购/收货证据，最后查看结算准备视图。${FINANCE_BOUNDARY}`,
    intent: { name: 'finance_next_actions_query', confidence: 0.86, slots: {} },
    cards: [
      {
        type: 'finance_next_actions',
        title: '财务下一步跟进',
        data: {
          actions,
          blockedActions: ['付款执行', '会计过账', '税务申报', '最终审批'],
        },
      },
      boundaryCard(),
      evidenceCard(evidence),
      recommendedActions(actions.map((action) => ({ label: action.title, kind: 'deep_link', target: action.target }))),
    ],
    evidence,
  }
}

export function buildAiFinanceCollaborationResponse(db = {}, body = {}) {
  const message = normalizeFinanceMessage(body)
  const intent = detectAiFinanceCollaborationIntent(message, body)
  if (!intent) return null
  const response = intent === 'finance_variance_explanation_query'
    ? buildVarianceResponse(db)
    : intent === 'finance_next_actions_query'
      ? buildNextActionsResponse(db)
      : buildPendingSettlementResponse(db)
  return {
    provider: 'local_finance_collaboration_query',
    providerStatus: 'deterministic',
    mode: 'read',
    content: response.message,
    ...response,
    capabilityCatalog: aiFinanceCollaborationCapabilityCatalog.map((item) => ({
      ...item,
      examples: [...item.examples],
      requiredSlots: [...item.requiredSlots],
      optionalSlots: [...item.optionalSlots],
      responseCards: [...item.responseCards],
    })),
  }
}
