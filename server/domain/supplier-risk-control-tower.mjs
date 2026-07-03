function asArray(value) { return Array.isArray(value) ? value : [] }
function text(value = '') { return String(value ?? '').trim() }
function number(value, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback }
function unique(values = []) { return [...new Set(values.filter(Boolean))] }

export const SUPPLIER_RISK_BASELINE = Object.freeze({
  inspectedFiles: [
    'src/modules/srm/Page.tsx',
    'src/modules/srm/SupplierDetailModal.tsx',
    'src/domain/srm/helpers.ts',
    'server/domain/today-cockpit-read-model.mjs',
    'src/modules/overview/TodayCockpitPanel.tsx',
    'src/domain/relationships/resolver.ts',
  ],
  boundary: 'Supplier risk is evidence-derived from operational records and can draft exception/follow-up actions only. Supplier master mutation and external email remain disabled.',
})

export const SUPPLIER_SIGNAL_TYPES = Object.freeze([
  'po_delay',
  'late_delivery',
  'receiving_exception',
  'quality_hold',
  'invoice_mismatch',
  'rfq_no_response',
  'rfq_late_response',
  'price_variance',
  'critical_sku_dependency',
  'unresolved_exception_case',
  'missing_master_data',
])

export const CONTROL_TOWER_CATEGORIES = Object.freeze([
  'po_delay',
  'inventory_risk',
  'receiving_exception',
  'invoice_mismatch',
  'supplier_risk',
  'rfq_timing',
  'data_gap',
  'pending_review',
])

export const CONTROL_FORBIDDEN_SIDE_EFFECTS = Object.freeze({
  mutatesSupplierMaster: false,
  sendsExternalEmail: false,
  createsCaseAutomatically: false,
  closesCaseAutomatically: false,
  approves: false,
  paysInvoice: false,
  postsInvoice: false,
  issuesPo: false,
  postsInventory: false,
  mutatesInventoryBalance: false,
})

export function normalizeSupplierRiskSignal(input = {}) {
  const signalType = text(input.signalType || input.type)
  if (!SUPPLIER_SIGNAL_TYPES.includes(signalType)) throw new Error(`Invalid supplier risk signal type: ${signalType}`)
  const severity = ['critical', 'high', 'medium', 'low'].includes(text(input.severity)) ? text(input.severity) : 'medium'
  const impactBySeverity = { critical: 30, high: 22, medium: 12, low: 5 }
  return {
    id: text(input.id) || `SIG-${signalType}-${text(input.supplierId || input.supplierName || 'SUP')}`,
    supplierId: text(input.supplierId),
    supplierName: text(input.supplierName || input.supplier),
    signalType,
    severity,
    scoreImpact: number(input.scoreImpact, impactBySeverity[severity]),
    linkedRecords: asArray(input.linkedRecords),
    evidence: asArray(input.evidence),
    dataLimitations: asArray(input.dataLimitations),
    status: text(input.status || 'open'),
  }
}

export function deriveSupplierRiskSignals(input = {}) {
  const supplierName = text(input.supplierName || input.supplier?.name || input.supplier)
  const supplierId = text(input.supplierId || input.supplier?.code || input.supplier?.id)
  const asOfDate = input.asOfDate || input.businessDate
  const signals = []
  for (const po of asArray(input.purchaseOrders).filter((row) => sameSupplier(row, supplierName, supplierId))) {
    if (/延期|逾期|overdue|late/i.test(text(po.status || po.reason)) || isPast(po.eta || po.expectedDate, asOfDate)) {
      signals.push(normalizeSupplierRiskSignal({ supplierId, supplierName, signalType: 'po_delay', severity: 'high', linkedRecords: [{ type: 'po', id: text(po.po || po.id) }], evidence: [{ type: 'po', id: text(po.po || po.id), summary: text(po.status || po.eta) }] }))
    }
    if (text(po.sourceSku) && /关键|critical/i.test(text(po.priority || po.criticality))) {
      signals.push(normalizeSupplierRiskSignal({ supplierId, supplierName, signalType: 'critical_sku_dependency', severity: 'medium', linkedRecords: [{ type: 'sku', id: text(po.sourceSku) }], evidence: [{ type: 'sku', id: text(po.sourceSku), summary: 'Critical SKU exposure' }] }))
    }
  }
  for (const grn of asArray(input.receivingDocs).filter((row) => sameSupplier(row, supplierName, supplierId))) {
    if (/异常|拒收|质检|hold|冻结|待检/i.test(text(grn.status))) signals.push(normalizeSupplierRiskSignal({ supplierId, supplierName, signalType: /hold|冻结|待检/i.test(text(grn.status)) ? 'quality_hold' : 'receiving_exception', severity: 'high', linkedRecords: [{ type: 'grn', id: text(grn.grn || grn.id) }], evidence: [{ type: 'grn', id: text(grn.grn || grn.id), summary: text(grn.status) }] }))
  }
  for (const invoice of asArray(input.supplierInvoices).filter((row) => sameSupplier(row, supplierName, supplierId))) {
    if (number(invoice.varianceAmount) || /差异|异常|variance/i.test(text(invoice.matchStatus || invoice.status))) signals.push(normalizeSupplierRiskSignal({ supplierId, supplierName, signalType: 'invoice_mismatch', severity: 'high', linkedRecords: [{ type: 'invoice', id: text(invoice.invoiceNumber || invoice.id) }], evidence: [{ type: 'invoice', id: text(invoice.invoiceNumber || invoice.id), summary: text(invoice.matchStatus || invoice.varianceAmount) }] }))
  }
  for (const rfq of asArray(input.rfqs).filter((row) => sameSupplier({ supplier: row.bestSupplier }, supplierName, supplierId) || asArray(row.supplierNames).some((name) => text(name) === supplierName))) {
    if (number(rfq.suppliers) > number(rfq.quoted)) signals.push(normalizeSupplierRiskSignal({ supplierId, supplierName, signalType: 'rfq_no_response', severity: 'medium', linkedRecords: [{ type: 'rfq', id: text(rfq.id || rfq.rfqId) }], evidence: [{ type: 'rfq', id: text(rfq.id || rfq.rfqId), summary: `${number(rfq.quoted)} / ${number(rfq.suppliers)} quoted` }] }))
  }
  for (const item of asArray(input.exceptionCases).filter((row) => sameSupplier({ supplier: row.supplierName || row.sourceEntityId }, supplierName, supplierId))) {
    if (!['closed', 'cancelled'].includes(text(item.status))) signals.push(normalizeSupplierRiskSignal({ supplierId, supplierName, signalType: 'unresolved_exception_case', severity: item.status === 'waiting_supplier' ? 'high' : 'medium', linkedRecords: [{ type: 'exceptionCase', id: text(item.caseId || item.id) }], evidence: [{ type: 'exceptionCase', id: text(item.caseId || item.id), summary: text(item.status) }] }))
  }
  if (!supplierName || !supplierId) signals.push(normalizeSupplierRiskSignal({ supplierId, supplierName, signalType: 'missing_master_data', severity: 'medium', dataLimitations: ['missing_supplier_identity'] }))
  return signals
}

function sameSupplier(row = {}, name = '', id = '') {
  return (name && text(row.supplier || row.supplierName || row.name) === name) || (id && text(row.supplierId || row.supplierCode || row.code || row.id) === id)
}

function isPast(value = '', asOfDate = undefined) {
  const raw = text(value)
  const parsed = raw ? Date.parse(raw) : NaN
  const reference = asOfDate ? new Date(asOfDate) : new Date()
  return raw && !Number.isNaN(parsed) && !Number.isNaN(reference.getTime()) && new Date(parsed) < reference
}

export function resolveSupplierRiskScore(input = {}) {
  const signals = input.signals || deriveSupplierRiskSignals(input)
  const score = Math.min(100, signals.reduce((sum, signal) => sum + number(signal.scoreImpact), 0))
  const riskLevel = score >= 70 ? 'high' : score >= 35 ? 'medium' : 'low'
  return {
    supplierId: text(input.supplierId || signals[0]?.supplierId),
    supplierName: text(input.supplierName || signals[0]?.supplierName),
    riskLevel,
    score,
    topContributingSignals: [...signals].sort((a, b) => b.scoreImpact - a.scoreImpact).slice(0, 5),
    confidence: signals.length ? 'evidence_based' : 'low_no_evidence',
    dataLimitations: unique(signals.flatMap((signal) => signal.dataLimitations)),
    mutationAllowed: false,
    sideEffects: { ...CONTROL_FORBIDDEN_SIDE_EFFECTS },
  }
}

export function buildSupplierRiskExplanation(input = {}) {
  const score = input.scoreResult || resolveSupplierRiskScore(input)
  return {
    ...score,
    reason: score.topContributingSignals.map((signal) => `${signal.signalType}:${signal.severity}`).join(', ') || 'No material supplier risk signal found.',
    businessImpact: score.topContributingSignals.some((signal) => signal.signalType === 'critical_sku_dependency') ? 'Critical SKU supply continuity may be affected.' : 'Review supplier operational performance before new commitments.',
    linkedRecords: score.topContributingSignals.flatMap((signal) => signal.linkedRecords),
    evidence: score.topContributingSignals.flatMap((signal) => signal.evidence),
    recommendedReviewFirstActions: ['Explain supplier risk', 'Preview supplier follow-up note', 'Create supplier risk exception case draft', 'Review affected SKUs'],
  }
}

export function buildSupplierRiskExceptionCaseDraft(input = {}) {
  const explanation = input.explanation || buildSupplierRiskExplanation(input)
  const existing = asArray(input.existingCases).find((item) => text(item.caseType) === 'supplier_risk' && !['closed', 'cancelled'].includes(text(item.status)))
  return {
    id: input.id || `CASE-DRAFT-SUP-${explanation.supplierId || explanation.supplierName || 'UNKNOWN'}`,
    type: 'exceptionCaseDraft',
    caseType: 'supplier_risk',
    linkedSupplier: { supplierId: explanation.supplierId, supplierName: explanation.supplierName },
    linkedRecords: explanation.linkedRecords,
    evidenceSignals: explanation.topContributingSignals,
    businessImpact: explanation.businessImpact,
    suggestedOwner: input.owner || 'supplier_manager',
    dataLimitations: explanation.dataLimitations,
    duplicateWarning: existing ? { existingCaseId: text(existing.caseId || existing.id), status: text(existing.status) } : null,
    recommendedAction: existing?.status === 'waiting_supplier' ? 'preview_supplier_followup_note' : existing?.status === 'resolved' ? 'review_case_closure' : 'create_case_after_review',
    autoCreateCase: false,
    mutationAllowed: false,
    sideEffects: { ...CONTROL_FORBIDDEN_SIDE_EFFECTS },
  }
}

export function normalizeControlTowerWorkItem(input = {}) {
  const category = text(input.category)
  if (!CONTROL_TOWER_CATEGORIES.includes(category)) throw new Error(`Invalid control tower category: ${category}`)
  const priority = ['critical', 'high', 'medium', 'low'].includes(text(input.priority)) ? text(input.priority) : 'medium'
  return {
    id: text(input.id) || `WORK-${category}-${text(input.sourceEntityId || input.title || 'ITEM')}`,
    priority,
    category,
    title: text(input.title),
    conclusion: text(input.conclusion),
    sourceModule: text(input.sourceModule),
    sourceEntity: { type: text(input.sourceEntityType), id: text(input.sourceEntityId) },
    linkedRecords: asArray(input.linkedRecords),
    evidence: asArray(input.evidence),
    businessImpact: text(input.businessImpact),
    recommendedNextAction: text(input.recommendedNextAction || 'Review evidence'),
    owner: text(input.owner || 'Unassigned'),
    dueDate: text(input.dueDate),
    exceptionCase: input.exceptionCase || null,
    workflowStatus: text(input.workflowStatus || input.exceptionCase?.status || 'open'),
    dataLimitations: asArray(input.dataLimitations),
    navigationTarget: input.navigationTarget || { module: input.sourceModule, entityType: input.sourceEntityType, entityId: input.sourceEntityId },
    sideEffects: { ...CONTROL_FORBIDDEN_SIDE_EFFECTS },
  }
}

export function resolveTodayCockpitWorkItems(input = {}) {
  const items = []
  const asOfDate = input.asOfDate || input.businessDate
  for (const po of asArray(input.purchaseOrders)) {
    if (/延期|逾期|overdue/i.test(text(po.status || po.reason)) || isPast(po.eta || po.expectedDate, asOfDate)) items.push(normalizeControlTowerWorkItem({ category: 'po_delay', priority: 'high', title: `${text(po.po || po.id)} delayed`, conclusion: 'PO delivery needs review.', sourceModule: 'procurement', sourceEntityType: 'po', sourceEntityId: text(po.po || po.id), linkedRecords: [{ type: 'po', id: text(po.po || po.id) }], evidence: [{ type: 'po', id: text(po.po || po.id), summary: text(po.status || po.eta) }], businessImpact: 'Potential production or inventory shortage.', dueDate: text(po.eta || po.expectedDate) }))
  }
  for (const inv of asArray(input.supplierInvoices)) {
    if (number(inv.varianceAmount) || /差异|variance|异常/i.test(text(inv.matchStatus || inv.status))) items.push(normalizeControlTowerWorkItem({ category: 'invoice_mismatch', priority: 'high', title: `${text(inv.invoiceNumber || inv.id)} mismatch`, conclusion: 'Invoice matching variance requires finance/procurement review.', sourceModule: 'finance', sourceEntityType: 'invoice', sourceEntityId: text(inv.invoiceNumber || inv.id), linkedRecords: [{ type: 'invoice', id: text(inv.invoiceNumber || inv.id) }, { type: 'po', id: text(inv.relatedPo) }].filter((item) => item.id), evidence: [{ type: 'invoice', id: text(inv.invoiceNumber || inv.id), summary: text(inv.matchStatus || inv.varianceAmount) }], businessImpact: 'Payment should remain blocked until review.' }))
  }
  for (const grn of asArray(input.receivingDocs)) {
    if (/异常|hold|冻结|待检|质检/i.test(text(grn.status))) items.push(normalizeControlTowerWorkItem({ category: 'receiving_exception', priority: 'high', title: `${text(grn.grn || grn.id)} receiving exception`, conclusion: 'Receiving or quality exception requires review.', sourceModule: 'receiving', sourceEntityType: 'grn', sourceEntityId: text(grn.grn || grn.id), linkedRecords: [{ type: 'grn', id: text(grn.grn || grn.id) }, { type: 'po', id: text(grn.po) }].filter((item) => item.id), evidence: [{ type: 'grn', id: text(grn.grn || grn.id), summary: text(grn.status) }], businessImpact: 'Inventory availability may be delayed.' }))
  }
  const suppliers = unique([...asArray(input.suppliers).map((s) => text(s.name || s.supplierName)), ...asArray(input.purchaseOrders).map((po) => text(po.supplier))])
  for (const supplier of suppliers.filter(Boolean)) {
    const explanation = buildSupplierRiskExplanation({ ...input, supplierName: supplier, asOfDate })
    if (explanation.score > 0) items.push(normalizeControlTowerWorkItem({ category: 'supplier_risk', priority: explanation.riskLevel === 'high' ? 'high' : 'medium', title: `${supplier} supplier risk`, conclusion: explanation.reason, sourceModule: 'srm', sourceEntityType: 'supplier', sourceEntityId: supplier, linkedRecords: explanation.linkedRecords, evidence: explanation.evidence, businessImpact: explanation.businessImpact, recommendedNextAction: 'Review supplier risk evidence' }))
  }
  for (const item of asArray(input.exceptionCases)) {
    if (item.status === 'resolved') items.push(normalizeControlTowerWorkItem({ category: 'pending_review', priority: 'medium', title: `${item.caseId} resolved pending closure`, conclusion: 'Resolved case still needs closure review.', sourceModule: 'exception-cases', sourceEntityType: 'exceptionCase', sourceEntityId: item.caseId, exceptionCase: { id: item.caseId, status: item.status }, linkedRecords: item.linkedRecords || [], evidence: item.evidenceItems || [], businessImpact: 'Close or reopen with evidence.' }))
  }
  return sortWorkItems(dedupeByCase(items, input.exceptionCases || []))
}

function dedupeByCase(items, cases) {
  const openCaseByEntity = new Map(asArray(cases).filter((c) => !['closed', 'cancelled'].includes(text(c.status))).map((c) => [text(c.sourceEntityId), c]))
  return items.map((item) => {
    const existing = openCaseByEntity.get(item.sourceEntity.id)
    return existing ? { ...item, exceptionCase: { id: text(existing.caseId || existing.id), status: text(existing.status) }, recommendedNextAction: 'Open existing case instead of creating duplicate' } : item
  })
}

export function sortWorkItems(items = []) {
  const weight = { critical: 4, high: 3, medium: 2, low: 1 }
  return [...items].sort((a, b) => (weight[b.priority] - weight[a.priority]) || Number(Boolean(b.exceptionCase)) - Number(Boolean(a.exceptionCase)) || text(a.id).localeCompare(text(b.id)))
}

export function buildControlTowerAiInsight(input = {}) {
  const workItems = input.workItems || resolveTodayCockpitWorkItems(input)
  return {
    intent: 'today_cockpit_control_tower_insight',
    summary: workItems.slice(0, 3).map((item) => `${item.title}: ${item.conclusion}`).join(' '),
    workItems,
    dataLimitations: unique(workItems.flatMap((item) => item.dataLimitations)),
    workflowStatuses: workItems.map((item) => ({ id: item.id, status: item.workflowStatus, caseStatus: item.exceptionCase?.status || '' })),
    mutationAllowed: false,
    standaloneAiNavigation: false,
    sideEffects: { ...CONTROL_FORBIDDEN_SIDE_EFFECTS },
  }
}
