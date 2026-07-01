import { buildInventoryExceptions, buildInventoryItems, buildInventorySummary } from './inventory-read.mjs'
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

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function compact(value = '') {
  return text(value).toLowerCase().replace(/[^\w\u4e00-\u9fa5-]+/g, '')
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function amount(value = 0, currency = 'CNY') {
  const prefix = currency === 'CNY' ? '¥' : `${currency} `
  return `${prefix}${toNumber(value, 0).toLocaleString()}`
}

function docLabel(type = '', id = '') {
  const normalized = text(type).toLowerCase()
  const nextId = text(id)
  if (normalized === 'po' || normalized === 'purchase_order' || /^PO-/i.test(nextId)) return `采购单 ${nextId}`.trim()
  if (normalized === 'pr' || normalized === 'purchase_request' || /^PR-/i.test(nextId)) return `采购申请 ${nextId}`.trim()
  if (normalized === 'rfq' || /^RFQ-/i.test(nextId)) return `询价单 ${nextId}`.trim()
  if (normalized === 'grn' || normalized === 'receiving_doc' || /^GRN-/i.test(nextId)) return `收货单 ${nextId}`.trim()
  if (normalized === 'invoice' || normalized === 'supplier_invoice' || /^INV-/i.test(nextId)) return `发票 ${nextId}`.trim()
  if (normalized === 'threewaymatch' || /^MATCH-/i.test(nextId)) return `三单匹配 ${nextId}`.trim()
  if (normalized === 'inventory_item' || /^SKU-/i.test(nextId)) return nextId
  return nextId
}

function idFromRoute(route = '', pattern) {
  const raw = decodeURIComponent(text(route))
  return raw.match(pattern)?.[0] || ''
}

function businessEvidence(item = {}) {
  const type = text(item.type || item.documentType || item.entityType, 'evidence')
  const route = text(item.route)
  const rawId = text(item.id || item.documentId || item.sku)
  const businessId = idFromRoute(route, /\b(?:PO|PR|RFQ|GRN|INV|SKU)-[A-Z0-9-]+\b/i) ||
    rawId.match(/\b(?:PO|PR|RFQ|GRN|INV|SKU)-[A-Z0-9-]+\b/i)?.[0] ||
    rawId
  const id = /^action-|^FOLLOWUP-/i.test(rawId) ? businessId : rawId || businessId
  const status = text(item.status || item.matchStatus)
  const rawSummary = text(item.summary || item.reason || item.nextAction || item.status || item.label)
  const rawLabel = text(item.label || item.title || item.itemName || item.id)
  const available = item.availableQuantity ?? item.currentStock ?? item.qty
  const safety = item.safetyStock ?? item.min ?? item.reorderPoint

  if (/^action-/i.test(rawId) || /^FOLLOWUP-/i.test(rawId) || type === 'overdue_po') {
    if (/^RFQ-/i.test(id)) {
      return {
        type: 'rfq',
        id,
        label: `${docLabel('rfq', id)} 待供应商回复`,
        status: status === 'open' ? '' : status,
        summary: rawSummary || '需确认供应商回复与授标节奏。',
        route,
      }
    }
    if (/^INV-/i.test(id)) {
      return {
        type: 'invoice',
        id,
        label: `${docLabel('invoice', id)} 存在匹配差异`,
        status: status === 'open' ? '' : status,
        summary: rawSummary || '需复核 PO、GRN 与发票差异。',
        route,
      }
    }
    const poId = idFromRoute(route, /\bPO-[A-Z0-9-]+\b/i) || text(item.documentId).match(/\bPO-[A-Z0-9-]+\b/i)?.[0] || rawLabel.match(/\bPO-[A-Z0-9-]+\b/i)?.[0] || id.match(/\bPO-[A-Z0-9-]+\b/i)?.[0] || id
    return {
      type: poId ? 'po' : type,
      id: poId || id,
      label: poId ? `${docLabel('po', poId)} 已超过预计到货日` : rawLabel,
      status: status === 'open' ? '' : status,
      summary: rawSummary || '需要确认供应商剩余交期。',
      route,
    }
  }

  if (type === 'inventory_item') {
    const sku = id || text(item.sku)
    return {
      type,
      id: sku,
      label: sku ? `${docLabel(type, sku)} 库存风险` : rawLabel,
      status,
      summary: hasFiniteValue(available) || hasFiniteValue(safety)
        ? `${sku} 可用库存 ${text(available, '—')}，安全库存 ${text(safety, '—')}。`
        : rawSummary,
      route,
    }
  }

  if (type === 'rfq') {
    return {
      type,
      id,
      label: `${docLabel(type, id)} 仍在进行中`,
      status,
      summary: rawSummary || '需确认供应商回复与授标节奏。',
      route,
    }
  }

  const readable = docLabel(type, id)
  return {
    type,
    id,
    label: readable ? `${readable}${rawLabel && rawLabel !== id ? `：${rawLabel}` : ''}` : rawLabel,
    status,
    summary: rawSummary,
    route,
  }
}

function hasFiniteValue(value) {
  return value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value))
}

function readModels(data = {}, cache = {}) {
  if (!cache.aiEvidenceReuse) {
    const procurementDocuments = buildProcurementDocuments(data)
    const procurementFollowups = buildProcurementFollowups(data)
    const procurementSummary = buildProcurementSummary(data)
    const inventoryItems = buildInventoryItems(data)
    const inventoryExceptions = buildInventoryExceptions(data)
    const inventorySummary = buildInventorySummary(data)
    cache.aiEvidenceReuse = {
      procurementDocuments,
      procurementFollowups,
      procurementSummary,
      inventoryItems,
      inventoryExceptions,
      inventorySummary,
      todayCockpit: buildTodayCockpit(data, {
        procurementDocuments,
        procurementFollowups,
        procurementSummary,
        inventoryItems,
        inventoryExceptions,
        inventorySummary,
      }),
    }
  }
  return cache.aiEvidenceReuse
}

function evidenceItems(items = []) {
  return asArray(items)
    .flatMap((item) => asArray(item?.evidence).length
      ? asArray(item.evidence).map((evidence) => ({
          ...evidence,
          id: evidence.id || item.documentId || item.sku || item.id,
          route: evidence.route || item.route,
          summary: item.reason || evidence.summary || item.summary,
          nextAction: item.nextAction || evidence.nextAction,
          availableQuantity: item.availableQuantity ?? evidence.availableQuantity,
          safetyStock: item.safetyStock ?? evidence.safetyStock,
          reorderPoint: item.reorderPoint ?? evidence.reorderPoint,
        }))
      : [item])
    .filter((item) => item && (item.id || item.label || item.summary))
    .map((item) => businessEvidence(item))
    .filter((item, index, rows) => index === rows.findIndex((candidate) => `${candidate.type}:${candidate.id}:${candidate.summary}` === `${item.type}:${item.id}:${item.summary}`))
    .slice(0, 6)
}

function targetId(item = {}) {
  const route = text(item.route)
  const evidence = asArray(item.evidence)[0] || {}
  return idFromRoute(route, /\b(?:PO|PR|RFQ|GRN|INV|SKU)-[A-Z0-9-]+\b/i) ||
    text(item.documentId || item.sku || evidence.id || item.id)
}

function actionLabel(item = {}) {
  const id = targetId(item)
  const route = text(item.route)
  const module = text(item.module)
  const type = text(item.documentType || item.type || item.target?.documentType)
  if (/^PO-/i.test(id) || /\/po\//i.test(route) || type === 'po') return `打开 ${id || '采购单'}，查看未到货明细，并确认供应商剩余交期。`
  if (/^RFQ-/i.test(id) || /\/rfq\//i.test(route) || type === 'rfq') return `打开 ${id || '询价单'}，确认待回复供应商和授标依据。`
  if (/^SKU-/i.test(id) || module === 'inventory' || type === 'inventory_item') return `查看 ${id || '该 SKU'} 的库存覆盖与关联采购单。`
  if (/^INV-/i.test(id) || type === 'invoice') return `打开 ${id || '发票'}，复核 PO、GRN 与发票差异。`
  return text(item.nextAction || item.title || '复核证据')
}

function recommendedActions(items = []) {
  return asArray(items).slice(0, 3).map((item) => ({
    kind: item.route ? 'deep_link' : 'review',
    label: actionLabel(item),
    target: item.route || '',
  }))
}

function response({ intent, confidence = 0.9, content, cards = [], evidence = [] }) {
  return {
    provider: 'local',
    providerStatus: 'deterministic',
    mode: 'deterministic',
    intent: { name: intent, confidence, slots: {} },
    content,
    message: content,
    cards,
    evidence,
    readModelReuse: true,
  }
}

function priorityRank(value = '') {
  if (['high', '高'].includes(text(value))) return 3
  if (['medium', '中'].includes(text(value))) return 2
  if (['low', '低'].includes(text(value))) return 1
  return 0
}

function isTerminalStatus(status = '') {
  return ['已完成', '已关闭', '已取消', '已驳回', '已转po', 'completed', 'closed', 'cancelled', 'canceled', 'rejected']
    .includes(text(status).toLowerCase())
}

function isPastDate(value = '', now = new Date()) {
  const raw = text(value)
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)?.[0]
  if (!iso) return false
  const date = new Date(`${iso}T00:00:00.000Z`)
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  return date < today
}

function topProcurementRiskDocuments(documents = []) {
  return documents
    .filter((item) =>
      toNumber(item.varianceAmount, 0) !== 0 ||
      /异常|差异|待|进行中|已发出|质检/.test(text(item.status || item.matchStatus || item.invoiceStatus))
    )
    .sort((a, b) =>
      Math.abs(toNumber(b.varianceAmount, 0)) - Math.abs(toNumber(a.varianceAmount, 0)) ||
      text(a.documentType).localeCompare(text(b.documentType)) ||
      text(a.id).localeCompare(text(b.id))
    )
    .slice(0, 5)
}

function procurementIssueType(document = {}) {
  if (document.documentType === 'po' && isPastDate(document.expectedDate || document.dueDate || document.eta) && !isTerminalStatus(document.status)) return 'overdue_purchase_order'
  if (document.documentType === 'pr' && !isTerminalStatus(document.status)) return 'pending_purchase_request'
  if (document.documentType === 'rfq' && !isTerminalStatus(document.status)) return 'pending_rfq'
  if (document.documentType === 'grn' && /异常|质检|待/.test(text(document.status))) return 'receiving_exception'
  if (document.documentType === 'invoice' || document.documentType === 'threeWayMatch') return 'invoice_match_exception'
  return 'procurement_followup'
}

function procurementIssueTitle(document = {}) {
  const readable = docLabel(document.documentType, document.id)
  const issueType = procurementIssueType(document)
  if (issueType === 'overdue_purchase_order') return `${readable} 已逾期`
  if (issueType === 'pending_purchase_request') return `${readable} 待处理`
  if (issueType === 'pending_rfq') return `${readable} 待回复`
  if (issueType === 'receiving_exception') return `${readable} 收货异常`
  if (issueType === 'invoice_match_exception') return `${readable} 存在匹配差异`
  return `${readable} 需要跟进`
}

function topInventoryRisks(items = [], exceptions = []) {
  const itemRisks = items
    .filter((item) => ['缺货', '低库存', '不足', '预警', '异常'].includes(item.status) || ['高', '中'].includes(item.riskLevel))
    .map((item) => ({
      ...item,
      id: item.sku,
      type: 'inventory_item',
      route: `/api/inventory/items/${encodeURIComponent(item.sku)}`,
      severity: item.riskLevel === '高' || item.status === '缺货' ? 'high' : 'medium',
      summary: `${item.itemName} · ${item.status} · 可用 ${item.availableQuantity?.toLocaleString?.() ?? item.availableQuantity}`,
    }))
  const exceptionRisks = exceptions
    .filter((item) => item.status !== '已关闭')
    .map((item) => ({
      ...item,
      type: 'inventory_exception',
      route: '/api/inventory/exceptions',
      severity: Math.abs(toNumber(item.quantityImpact, 0)) > 0 ? 'medium' : 'low',
      summary: `${item.sku || item.id} · ${item.status} · ${item.nextAction || item.reason || '复核库存异常'}`,
    }))
  return [...itemRisks, ...exceptionRisks]
    .sort((a, b) => priorityRank(b.severity) - priorityRank(a.severity) || text(a.id || a.sku).localeCompare(text(b.id || b.sku)))
    .slice(0, 5)
}

function skuFromMessage(message = '') {
  return message.match(/\b[A-Z]{1,8}[-]?\d{2,}\b/i)?.[0] || ''
}

function findInventoryItem(items = [], message = '') {
  const sku = skuFromMessage(message)
  const normalized = compact(message)
  return items.find((item) =>
    (sku && compact(item.sku) === compact(sku)) ||
    normalized.includes(compact(item.sku)) ||
    normalized.includes(compact(item.itemName))
  ) || null
}

function businessIdFromItem(item = {}) {
  const id = targetId(item)
  return id.match(/\b(?:PO|PR|RFQ|GRN|INV|SKU)-[A-Z0-9-]+\b/i)?.[0] || id
}

function severityLabel(value = '') {
  const rank = priorityRank(value)
  if (rank >= 3) return '高'
  if (rank === 2) return '中'
  if (rank === 1) return '低'
  return '待评估'
}

function findDocumentById(documents = [], id = '') {
  return asArray(documents).find((item) => text(item.id).toLowerCase() === text(id).toLowerCase()) || null
}

function relatedDocumentsFor(document = {}, models = {}) {
  document = document || {}
  const related = []
  const docId = text(document.id)
  if (document.sourceRequest) related.push(docLabel('pr', document.sourceRequest))
  if (document.sourceRfq) related.push(docLabel('rfq', document.sourceRfq))
  if (document.relatedPo) related.push(docLabel('po', document.relatedPo))
  if (document.relatedGrn) related.push(docLabel('grn', document.relatedGrn))
  for (const candidate of asArray(models.procurementDocuments)) {
    if (!docId || candidate.id === docId) continue
    const values = [candidate.sourceRequest, candidate.sourceRfq, candidate.relatedPo, candidate.relatedGrn, candidate.poId, candidate.purchaseOrderId]
    if (values.some((value) => text(value) === docId)) related.push(docLabel(candidate.documentType, candidate.id))
  }
  return [...new Set(related.filter(Boolean))].slice(0, 4)
}

function relatedInventoryRisksFor(document = {}, models = {}) {
  document = document || {}
  const relatedIds = [document.sourceSku, document.sku, document.itemId, document.itemName].map(text).filter(Boolean)
  if (document.sourceRequest) {
    const request = findDocumentById(models.procurementDocuments, document.sourceRequest)
    relatedIds.push(text(request?.sourceSku), text(request?.sku), text(request?.itemName))
  }
  return asArray(models.inventoryItems)
    .filter((item) => relatedIds.some((value) => value && [item.sku, item.itemName, item.id].map(text).includes(value)))
    .filter((item) => ['缺货', '低库存', '不足', '预警', '异常'].includes(item.status) || ['高', '中'].includes(item.riskLevel))
    .map((item) => `${item.sku} ${item.status || item.riskLevel}`)
    .slice(0, 3)
}

function priorityExplanation(item = {}, models = {}) {
  const id = businessIdFromItem(item)
  const document = findDocumentById(models.procurementDocuments, id)
  const status = text(item.status || document?.status || document?.matchStatus || document?.invoiceStatus)
  const dueDate = text(item.dueDate || document?.expectedDate || document?.dueDate || document?.requiredDate || document?.date)
  const reason = text(item.reason || item.summary || item.message || item.nextAction)
  const action = actionLabel(item)
  const amountText = hasFiniteValue(document?.amount) ? `金额 ${amount(document.amount, document.currency || 'CNY')}` : ''
  const receiving = relatedDocumentsFor(document, models).filter((value) => /收货单/.test(value)).join('、')
  const inventory = relatedInventoryRisksFor(document, models).join('、')
  const signals = [
    dueDate ? `预计/要求日期 ${dueDate}` : '',
    status ? `当前状态 ${status}` : '',
    amountText,
    receiving ? `关联${receiving}` : '',
    inventory ? `关联库存风险 ${inventory}` : '',
    reason,
  ].filter(Boolean)
  if (/^PO-/i.test(id)) {
    return `${id} 被列为优先事项，主要因为${signals.join('，')}。建议先确认未到货明细、供应商剩余交期和相关 SKU 库存覆盖。`
  }
  return `${docLabel(item.documentType || item.type, id) || text(item.title)} 被列为优先事项，主要因为${signals.join('，')}。建议${action.replace(/^打开\s*/, '').replace(/^查看\s*/, '')}`
}

function priorityItemsFromCockpit(models) {
  const cockpit = models.todayCockpit
  const source = [
    ...asArray(cockpit.recommendedActions),
    ...asArray(cockpit.followups).slice(0, 3),
    ...asArray(cockpit.inventoryRisks).slice(0, 3),
  ]
  const seen = new Set()
  return source
    .map((item) => {
      const id = businessIdFromItem(item)
      const document = findDocumentById(models.procurementDocuments, id)
      return {
        ...item,
        id: id || item.id,
        type: item.documentType || item.type || document?.documentType || item.target?.entityType || '',
        severity: severityLabel(item.priority || item.severity || document?.riskLevel),
        rankScore: priorityRank(item.priority || item.severity || document?.riskLevel),
        title: item.title || docLabel(document?.documentType || item.type, id),
        reason: item.reason || item.summary || item.message || item.nextAction,
        explanation: priorityExplanation(item, models),
        sourceDocument: docLabel(document?.documentType || item.documentType || item.type, id),
        relatedDocuments: relatedDocumentsFor(document, models),
        amount: document?.amount ?? item.amount,
        dueDate: item.dueDate || document?.expectedDate || document?.dueDate || document?.requiredDate || '',
        status: item.status || document?.status || document?.matchStatus || document?.invoiceStatus || '',
        evidence: evidenceItems([item]),
        recommendedActions: recommendedActions([item]),
      }
    })
    .filter((item) => item.id || item.title)
    .filter((item) => {
      const key = item.id || item.title
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((item, index) => ({ ...item, rank: index + 1 }))
    .slice(0, 6)
}

function buildPriorityExplanationResponse(models, message = '') {
  const priorities = priorityItemsFromCockpit(models)
  const requestedId = message.match(/\b(?:PO|PR|RFQ|GRN|INV|SKU)-[A-Z0-9-]+\b/i)?.[0] || ''
  const priority = priorities.find((item) => text(item.id).toLowerCase() === requestedId.toLowerCase()) || priorities[0]
  if (!priority) return null
  const evidence = evidenceItems([priority])
  return response({
    intent: 'priority_explanation_query',
    content: priority.explanation,
    evidence,
    cards: [
      {
        type: 'priority_explanation',
        title: `${priority.sourceDocument || priority.title} 优先级说明`,
        data: {
          priorityItems: [priority],
          topIssues: [{
            title: priority.sourceDocument || priority.title,
            reason: priority.explanation,
            rank: priority.rank,
            severity: priority.severity,
          }],
        },
      },
      { type: 'evidence', evidence },
      { type: 'recommended_actions', actions: priority.recommendedActions },
    ],
  })
}

function buildTodayCockpitResponse(models) {
  const cockpit = models.todayCockpit
  const priorityItems = priorityItemsFromCockpit(models)
  const actions = priorityItems.slice(0, 4)
  const followups = asArray(cockpit.followups).slice(0, 3)
  const inventoryRisks = asArray(cockpit.inventoryRisks).slice(0, 3)
  const evidence = evidenceItems(actions)
  const topPriority = priorityItems[0]
  const topAction = topPriority?.title || followups[0]?.title || inventoryRisks[0]?.nextAction || '先复核采购和库存风险证据'
  const overduePoCount = Math.max(
    toNumber(models.procurementSummary.overduePoCount, 0),
    asArray(cockpit.followups).filter((item) => text(item.type) === 'overdue_po' || /\bPO-/i.test(text(item.documentId)) && /超过预计|逾期/.test(text(item.title || item.summary))).length,
  )
  const shownFollowupCount = Math.min(toNumber(cockpit.summary.urgentFollowupCount, 0), followups.length)
  const shownInventoryRiskCount = Math.min(toNumber(cockpit.summary.lowStockCount, 0), inventoryRisks.length)
  return response({
    intent: 'today_cockpit_priority_query',
    content: `今天建议先处理：${topAction}。${topPriority?.explanation || '该事项在当前采购、库存和 RFQ 信号中排序最高。'}当前有 ${cockpit.summary.urgentFollowupCount || 0} 个紧急跟进、${cockpit.summary.lowStockCount || 0} 个库存风险，开放金额 ${amount(cockpit.summary.totalOpenAmount, cockpit.summary.currency || 'CNY')}；下方展示其中优先级最高的 ${shownFollowupCount || followups.length} 个跟进项和 ${shownInventoryRiskCount || inventoryRisks.length} 个库存风险。`,
    evidence,
    cards: [
      {
        type: 'procurement_followup_summary',
        title: '今日优先事项',
        data: {
          pendingPrCount: models.procurementSummary.openPrCount,
          approvedNotConvertedPrCount: models.procurementSummary.approvedNotConvertedPrCount || 0,
          pendingRfqResponseCount: models.procurementSummary.activeRfqCount,
          overduePoCount,
          receivingExceptionCount: models.procurementSummary.pendingReceivingCount,
          priorityItems,
          topIssues: actions.map((item) => ({
            title: item.sourceDocument || item.title,
            reason: item.explanation,
            rank: item.rank,
            severity: item.severity,
          })),
        },
      },
      { type: 'evidence', evidence },
      { type: 'recommended_actions', actions: actions.flatMap((item) => item.recommendedActions).slice(0, 3) },
    ],
  })
}

function buildProcurementRiskResponse(models) {
  const riskyDocuments = topProcurementRiskDocuments(models.procurementDocuments)
  const followups = asArray(models.procurementFollowups).slice(0, 5)
  const evidence = evidenceItems([...riskyDocuments, ...followups])
  const overduePoCount = models.procurementDocuments.filter((item) => procurementIssueType(item) === 'overdue_purchase_order').length
  const pendingPrCount = models.procurementDocuments.filter((item) => item.documentType === 'pr' && !isTerminalStatus(item.status)).length
  const pendingRfqCount = models.procurementDocuments.filter((item) => item.documentType === 'rfq' && !isTerminalStatus(item.status)).length
  const receivingIssueCount = models.procurementDocuments.filter((item) => procurementIssueType(item) === 'receiving_exception').length
  return response({
    intent: 'procurement_exception_query',
    content: `采购风险主要集中在 ${models.procurementSummary.invoiceExceptionCount || 0} 个发票差异、${models.procurementSummary.threeWayMatchExceptionCount || 0} 个三单匹配差异、${models.procurementSummary.pendingReceivingCount || 0} 个待收货或收货复核事项。建议优先打开高优先级跟进和金额差异最大的单据。`,
    evidence,
    cards: [
      {
        type: 'procurement_exception_summary',
        title: '采购风险摘要',
        data: {
          totalIssueCount: riskyDocuments.length + followups.length,
          overduePoCount,
          pendingPrCount,
          pendingRfqCount,
          receivingIssueCount,
          topIssues: riskyDocuments.slice(0, 3).map((item) => ({
            type: procurementIssueType(item),
            title: procurementIssueTitle(item),
            reason: item.exceptionReason || item.blockingReason || item.status || item.matchStatus,
          })),
        },
      },
      { type: 'evidence', evidence },
      { type: 'recommended_actions', actions: recommendedActions([...riskyDocuments, ...followups]) },
    ],
  })
}

function buildInventoryRiskResponse(models, message) {
  const matchedItem = findInventoryItem(models.inventoryItems, message)
  const risks = matchedItem ? [matchedItem] : topInventoryRisks(models.inventoryItems, models.inventoryExceptions)
  const evidence = evidenceItems(risks.map((item) => ({
    ...item,
    type: item.type || 'inventory_item',
    id: item.sku || item.id,
    label: item.itemName || item.type,
    status: item.status,
    route: item.route || (item.sku ? `/api/inventory/items/${encodeURIComponent(item.sku)}` : '/api/inventory/exceptions'),
    summary: item.riskReason || item.reason || item.nextAction || item.summary,
  })))
  const first = risks[0]
  return response({
    intent: 'inventory_status_query',
    content: matchedItem
      ? `${matchedItem.sku} 风险来自 ${matchedItem.status || matchedItem.riskLevel}：可用库存 ${matchedItem.availableQuantity?.toLocaleString?.() ?? matchedItem.availableQuantity}，安全库存 ${matchedItem.safetyStock?.toLocaleString?.() ?? matchedItem.safetyStock}，再订货点 ${matchedItem.reorderPoint?.toLocaleString?.() ?? matchedItem.reorderPoint}。建议复核库存证据后再准备补货动作。`
      : `当前需要关注 ${models.inventorySummary.lowStockCount || 0} 个库存风险、${models.inventorySummary.exceptionCount || 0} 个库存异常。建议先看高风险 SKU 和未关闭库存异常。`,
    evidence,
    cards: [
      {
        type: 'inventory_status',
        title: matchedItem ? `${matchedItem.sku} 库存风险` : '库存风险摘要',
        data: {
          sku: first?.sku || first?.id || '',
          name: first?.itemName || first?.type || '',
          availableQuantity: first?.availableQuantity ?? null,
          riskLevel: first?.riskLevel || first?.severity || 'medium',
          riskReason: first?.riskReason || first?.reason || first?.nextAction || '按库存读模型判断需要复核',
          defaultWarehouseId: first?.defaultWarehouseId || first?.warehouse || '',
        },
      },
      { type: 'evidence', evidence },
      { type: 'recommended_actions', actions: recommendedActions(risks) },
    ],
  })
}

function buildSupplierFollowupResponse(models) {
  const supplierFollowups = asArray(models.procurementFollowups)
    .filter((item) => item.supplierName)
    .sort((a, b) => priorityRank(b.severity) - priorityRank(a.severity) || text(a.supplierName).localeCompare(text(b.supplierName)))
    .slice(0, 5)
  const evidence = evidenceItems(supplierFollowups)
  return response({
    intent: 'supplier_followup_query',
    content: supplierFollowups.length
      ? `需要跟进的供应商主要是 ${supplierFollowups.map((item) => item.supplierName).filter(Boolean).slice(0, 3).join('、')}。请优先处理高优先级采购跟进和发票/收货差异证据。`
      : '当前采购读模型里没有需要供应商跟进的开放事项。',
    evidence,
    cards: [
      {
        type: 'procurement_followup_summary',
        title: '供应商跟进',
        data: {
          pendingPrCount: models.procurementSummary.openPrCount || 0,
          approvedNotConvertedPrCount: models.procurementSummary.approvedNotConvertedPrCount || 0,
          pendingRfqResponseCount: models.procurementSummary.activeRfqCount || 0,
          overduePoCount: models.procurementSummary.overduePoCount || 0,
          receivingExceptionCount: models.procurementSummary.pendingReceivingCount || 0,
          topIssues: supplierFollowups.map((item) => ({ title: item.supplierName, reason: item.title || item.message })),
        },
      },
      { type: 'evidence', evidence },
      { type: 'recommended_actions', actions: recommendedActions(supplierFollowups) },
    ],
  })
}

export function buildAiEvidenceReuseResponse(data = {}, body = {}, options = {}) {
  const message = text(body.question || body.message || body.prompt || body.text)
  if (!message) return null
  const normalized = compact(message)
  const models = readModels(data, options.cache || {})

  if (/\b(?:PO|PR|RFQ|GRN|INV|SKU)-[A-Z0-9-]+\b/i.test(message) && /优先|解释/.test(message)) {
    return buildPriorityExplanationResponse(models, message)
  }

  if (/供应商|supplier/i.test(message) && /跟进|follow|风险|关注/.test(message) && !/\bSUP-[A-Z0-9-]+\b/i.test(message)) {
    return buildSupplierFollowupResponse(models)
  }

  if (/采购|单据|三单|发票|收货|po|pr|rfq|grn|procurement|purchase/i.test(message) && /风险|异常|待处理|待审批|待转|差异|跟进|逾期|问题|为什么|原因|优先|有哪些/.test(message)) {
    return buildProcurementRiskResponse(models)
  }

  if (/库存|sku|物料|inventory|stock|shortage/i.test(message) && /风险|关注|为什么|原因|缺货|低库存|补货|够不够/.test(message)) {
    return buildInventoryRiskResponse(models, normalized)
  }

  if (/今天|今日|today/.test(message) && /处理|关注|跟进|优先|工作台/.test(message)) {
    return buildTodayCockpitResponse(models)
  }

  return null
}

export function buildAiCockpitFastPathResponse(data = {}, body = {}, options = {}) {
  const message = text(body.question || body.message || body.prompt || body.text)
  if (!message) return null
  const moduleId = text(body.moduleId || body.activeContext?.module)
  const isCockpitContext = !moduleId || moduleId === 'overview' || moduleId === 'today-cockpit'
  const cockpitPrompt = (
    (/今天|今日|today/.test(message) && /处理|关注|跟进|优先|工作台/.test(message)) ||
    (/采购|单据|三单|发票|收货|po|pr|rfq|grn|procurement|purchase/i.test(message) && /风险|异常|待处理|待审批|待转|差异|跟进|逾期|问题|为什么|原因|优先|有哪些/.test(message)) ||
    (/库存|sku|物料|inventory|stock|shortage/i.test(message) && /风险|关注|为什么|原因|缺货|低库存|补货|够不够/.test(message)) ||
    (/供应商|supplier/i.test(message) && /跟进|follow|风险|关注/.test(message) && !/\bSUP-[A-Z0-9-]+\b/i.test(message))
  )
  if (!isCockpitContext || !cockpitPrompt) return null
  return buildAiEvidenceReuseResponse(data, body, options)
}
