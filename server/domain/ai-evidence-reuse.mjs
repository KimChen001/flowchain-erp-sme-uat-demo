import { buildInventoryExceptions, buildInventoryItems, buildInventorySummary } from './inventory-read.mjs'
import {
  buildProcurementDocuments,
  buildProcurementFollowups,
  buildProcurementSummary,
} from './procurement-read-model.mjs'
import { buildTodayCockpit } from './today-cockpit-read-model.mjs'
import { retrieveAiSopGuidance } from './ai-sop-retrieval.mjs'

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
    .filter((item) => item && (item.id || item.documentId || item.sku || item.label || item.summary))
    .map((item) => businessEvidence(item))
    .filter((item, index, rows) => index === rows.findIndex((candidate) => `${candidate.type}:${candidate.id}:${candidate.summary}` === `${item.type}:${item.id}:${item.summary}`))
    .slice(0, 6)
}

function targetId(item = {}) {
  const route = text(item.route)
  const evidence = asArray(item.evidence)[0] || {}
  return idFromRoute(route, /\b(?:PO|PR|RFQ|GRN|INV|SKU)-[A-Z0-9-]+\b/i) ||
    text(item.documentId || evidence.id || item.id || item.sku)
}

function businessFamilyForId(id = '', fallback = '') {
  if (/^PO-/i.test(id)) return 'po'
  if (/^PR-/i.test(id)) return 'pr'
  if (/^RFQ-/i.test(id)) return 'rfq'
  if (/^GRN-/i.test(id)) return 'grn'
  if (/^SKU-/i.test(id)) return 'sku'
  return fallback || id
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
  return asArray(items).slice(0, 3).flatMap((item) => {
    const id = targetId(item)
    const route = text(item.route)
    const type = text(item.documentType || item.type || item.target?.documentType)
    const itemEvidence = evidenceItems([item])
    const actions = [{
      kind: route ? 'deep_link' : 'review',
      label: actionLabel(item),
      target: route,
    }]
    if (/^SKU-/i.test(id) || type === 'inventory_item') {
      actions.push({
        kind: 'draft_preview',
        label: `预览 ${id || '该 SKU'} 补货 PR 草稿，需人工审阅后再保存。`,
        target: '',
        draftType: 'purchase_request_draft',
        draftTitle: `${id || 'SKU'} 补货 PR 草稿预览`,
        requiresHumanReview: true,
        payload: {
          itemIdOrSku: id || item.sku || item.itemId,
          quantity: toNumber(item.reorderPoint ?? item.safetyStock ?? item.min ?? item.availableQuantity, 1) || 1,
          reason: item.riskReason || item.reason || item.summary || 'AI 库存风险建议，仅生成审阅草稿。',
          warehouse: item.defaultWarehouseId || item.warehouse || item.location || '',
        },
        originEvidence: itemEvidence,
      })
    }
    if (/^PO-/i.test(id) || type === 'po') {
      actions.push({
        kind: 'draft_preview',
        label: `预览 ${id || '该 PO'} 供应商跟进草稿，需人工审阅后再发送。`,
        target: '',
        draftType: 'po_followup_draft',
        draftTitle: `${id || 'PO'} 供应商跟进草稿预览`,
        requiresHumanReview: true,
        payload: {
          poId: id,
          message: `请确认 ${id} 剩余未到货部分的预计交期。该采购单${item.dueDate || item.expectedDate ? `预计日期为 ${item.dueDate || item.expectedDate}` : ''}，当前状态为 ${item.status || '待确认'}。`,
          reason: item.reason || item.summary || 'AI 基于采购证据建议跟进供应商交期。',
        },
        originEvidence: itemEvidence,
      })
    }
    if (/^RFQ-/i.test(id) || type === 'rfq') {
      actions.push({
        kind: 'draft_preview',
        label: `预览 ${id || '该 RFQ'} 供应商提醒草稿，需人工审阅后再发送。`,
        target: '',
        draftType: 'supplier_followup_draft',
        draftTitle: `${id || 'RFQ'} 供应商提醒草稿预览`,
        requiresHumanReview: true,
        payload: {
          supplierIdOrName: item.supplierName || item.awardedSupplier || item.bestSupplier || `RFQ ${id}`,
          message: `请确认 ${id} 的报价回复状态及预计回复时间。${item.dueDate ? `当前报价截止日期为 ${item.dueDate}。` : ''}`,
          reason: item.reason || item.summary || 'AI 基于 RFQ 待回复证据建议跟进。',
        },
        originEvidence: itemEvidence,
      })
    }
    if (/^GRN-/i.test(id) || type === 'grn' || type === 'receiving_doc') {
      actions.push({
        kind: 'draft_preview',
        label: `预览 ${id || '该 GRN'} 收货异常跟进草稿，需人工审阅后再处理。`,
        target: '',
        draftType: 'po_followup_draft',
        draftTitle: `${id || 'GRN'} 收货异常跟进草稿预览`,
        requiresHumanReview: true,
        payload: {
          poId: item.relatedPo || item.poId || id,
          message: `请复核 ${id} 的收货差异和质检状态，并确认是否影响对应 PO 的剩余交付。`,
          reason: item.reason || item.summary || 'AI 基于收货异常证据建议内部复核。',
        },
        originEvidence: itemEvidence,
      })
    }
    return actions
  })
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

function evidenceWorkspaceFor(document = {}, models = {}, evidence = [], limitations = []) {
  if (!document?.id) return null
  const related = relatedDocumentsFor(document, models)
  const inventorySignals = relatedInventoryRisksFor(document, models)
  const facts = [
    document.status ? `状态：${document.status}` : '',
    document.expectedDate || document.dueDate || document.requiredDate ? `日期：${document.expectedDate || document.dueDate || document.requiredDate}` : '',
    document.supplierName || document.supplier ? `供应商：${document.supplierName || document.supplier}` : '',
    hasFiniteValue(document.amount) ? `金额：${amount(document.amount, document.currency || 'CNY')}` : '',
    document.supplierCount ? `邀请供应商：${document.supplierCount} 家` : '',
    document.respondedSupplierCount !== undefined ? `已回复：${document.respondedSupplierCount} 家` : '',
    document.pendingSupplierCount !== undefined ? `待回复：${document.pendingSupplierCount} 家` : '',
  ].filter(Boolean)
  return {
    type: 'evidence_workspace',
    title: '证据工作区',
    data: {
      primaryObject: docLabel(document.documentType, document.id),
      keyFacts: facts,
      relatedDocuments: related,
      inventorySignals,
      supplierSignals: [document.supplierName || document.supplier].filter(Boolean),
      limitations: limitations.length ? limitations : [
        related.length ? '' : '未找到更多直接关联单据。',
        inventorySignals.length ? '' : '未找到直接关联的库存风险。',
      ].filter(Boolean),
    },
    evidence,
  }
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

function priorityScoringSignals(item = {}, document = {}, models = {}) {
  const dueDate = text(item.dueDate || document?.expectedDate || document?.dueDate || document?.requiredDate || '')
  const status = text(item.status || document?.status || document?.matchStatus || document?.invoiceStatus)
  const amountValue = toNumber(document?.amount ?? item.amount, 0)
  const inventoryImpact = relatedInventoryRisksFor(document, models)
  return {
    overdueSignal: Boolean(dueDate && isPastDate(dueDate) && !isTerminalStatus(status)),
    severitySignal: severityLabel(item.priority || item.severity || document?.riskLevel),
    dueDateSignal: dueDate,
    amountSignal: amountValue >= 50000 ? '金额较高' : amountValue > 0 ? '有金额影响' : '',
    inventoryImpactSignal: inventoryImpact.length ? `关联库存风险：${inventoryImpact.join('、')}` : '',
    receivingExceptionSignal: relatedDocumentsFor(document, models).some((value) => /收货单/.test(value)) || document?.documentType === 'grn',
    supplierRfqPendingSignal: document?.documentType === 'rfq' ? toNumber(document.pendingSupplierCount, 0) > 0 : /供应商|RFQ|待回复/.test(text(item.reason || item.summary || item.title)),
  }
}

function priorityItemsFromCockpit(models) {
  const cockpit = models.todayCockpit
  const source = [
    ...asArray(cockpit.recommendedActions).map((item, sourceIndex) => ({ ...item, sourceIndex })),
    ...asArray(cockpit.followups).slice(0, 3).map((item, sourceIndex) => ({ ...item, sourceIndex: sourceIndex + 100 })),
    ...asArray(cockpit.inventoryRisks).slice(0, 3).map((item, sourceIndex) => ({ ...item, sourceIndex: sourceIndex + 200 })),
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
        scoringSignals: priorityScoringSignals(item, document, models),
        sourceIndex: item.sourceIndex,
      }
    })
    .filter((item) => item.id || item.title)
    .filter((item) => {
      const key = item.id || item.title
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) =>
      b.rankScore - a.rankScore ||
      text(a.dueDate || '9999-12-31').localeCompare(text(b.dueDate || '9999-12-31')) ||
      toNumber(a.sourceIndex, 9999) - toNumber(b.sourceIndex, 9999) ||
      text(a.id).localeCompare(text(b.id))
    )
    .map((item, index) => ({ ...item, rank: index + 1 }))
    .slice(0, 6)
}

function buildPriorityExplanationResponse(models, message = '') {
  const priorities = priorityItemsFromCockpit(models)
  const requestedId = message.match(/\b(?:PO|PR|RFQ|GRN|INV|SKU)-[A-Z0-9-]+\b/i)?.[0] || ''
  const priority = priorities.find((item) => text(item.id).toLowerCase() === requestedId.toLowerCase()) || priorities[0]
  if (!priority) return null
  const evidence = evidenceItems([priority])
  const document = findDocumentById(models.procurementDocuments, priority.id)
  const workspace = evidenceWorkspaceFor(document, models, evidence)
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
      workspace,
      { type: 'evidence', evidence },
      { type: 'recommended_actions', actions: priority.recommendedActions },
    ].filter(Boolean),
  })
}

function buildTodayCockpitResponse(models) {
  const cockpit = models.todayCockpit
  const priorityItems = priorityItemsFromCockpit(models)
  const actions = priorityItems.slice(0, 4)
  const primaryActions = []
  const seenActionFamilies = new Set()
  for (const item of priorityItems) {
    const id = text(item.id)
    const family = businessFamilyForId(id, item.type)
    if (seenActionFamilies.has(family)) continue
    const action = item.recommendedActions.find((next) => next.kind === 'deep_link') || item.recommendedActions[0]
    if (action) {
      primaryActions.push(action)
      seenActionFamilies.add(family)
    }
    if (primaryActions.length >= 3) break
  }
  const supplementalActions = actions
    .flatMap((item) => item.recommendedActions.filter((action) => action.kind === 'draft_preview'))
    .sort((a, b) => (a.draftType === 'purchase_request_draft' ? 0 : 1) - (b.draftType === 'purchase_request_draft' ? 0 : 1))
  const followups = asArray(cockpit.followups).slice(0, 3)
  const inventoryRisks = asArray(cockpit.inventoryRisks).slice(0, 3)
  const evidenceSourceItems = []
  const seenEvidenceFamilies = new Set()
  for (const item of priorityItems) {
    const family = businessFamilyForId(text(item.id), item.type)
    if (!family || seenEvidenceFamilies.has(family)) continue
    evidenceSourceItems.push(item)
    seenEvidenceFamilies.add(family)
    if (evidenceSourceItems.length >= 4) break
  }
  const evidence = evidenceItems(evidenceSourceItems.length ? evidenceSourceItems : actions)
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
      { type: 'recommended_actions', actions: [...primaryActions, ...supplementalActions].slice(0, 4) },
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

function buildRfqFollowupResponse(models, message = '') {
  const requestedId = message.match(/\bRFQ-[A-Z0-9-]+\b/i)?.[0] || ''
  const rfq = asArray(models.procurementDocuments)
    .find((item) => item.documentType === 'rfq' && (!requestedId || text(item.id).toLowerCase() === requestedId.toLowerCase()))
  if (!rfq) return null
  const evidence = evidenceItems([rfq])
  const workspace = evidenceWorkspaceFor(rfq, models, evidence)
  const pending = toNumber(rfq.pendingSupplierCount, Math.max(0, toNumber(rfq.supplierCount, 0) - toNumber(rfq.respondedSupplierCount, 0)))
  return response({
    intent: 'rfq_followup_query',
    content: `${rfq.id} 当前状态为 ${rfq.status || '进行中'}，已邀请 ${toNumber(rfq.supplierCount, 0)} 家供应商，已回复 ${toNumber(rfq.respondedSupplierCount, 0)} 家，仍有 ${pending} 家待回复。${rfq.dueDate ? `报价截止日期为 ${rfq.dueDate}。` : ''}${rfq.linkedPr ? `该 RFQ 来自采购申请 ${rfq.linkedPr}。` : ''}${rfq.linkedPo ? `后续已关联采购单 ${rfq.linkedPo}。` : ''}建议先确认待回复供应商和授标依据。`,
    evidence,
    cards: [
      {
        type: 'procurement_followup_summary',
        title: `${docLabel('rfq', rfq.id)} 跟进`,
        data: {
          pendingRfqResponseCount: pending,
          topIssues: [{
            title: docLabel('rfq', rfq.id),
            reason: `${pending} 家供应商待回复${rfq.dueDate ? `，截止 ${rfq.dueDate}` : ''}`,
          }],
        },
      },
      workspace,
      { type: 'evidence', evidence },
      { type: 'recommended_actions', actions: recommendedActions([rfq]) },
    ].filter(Boolean),
  })
}

function idsFromMessage(message = '') {
  return [...message.matchAll(/\b(?:PO|PR|RFQ|GRN|INV|SKU)-[A-Z0-9-]+\b/gi)].map((match) => match[0].toUpperCase())
}

function contextualBusinessId(body = {}, family = '') {
  const matchesFamily = (type = '', id = '') => {
    const normalized = text(type).toLowerCase()
    if (family === 'po') return normalized === 'po' || normalized === 'purchase_order' || /^PO-/i.test(id)
    return false
  }
  const candidates = [
    body.activeContext,
    body.sessionGrounding?.activeContext,
    body.sessionGrounding?.lastPrimaryEntity,
    ...asArray(body.sessionGrounding?.lastVisibleBusinessIds?.[family]).map((id) => ({ id, type: family })),
  ]
  for (const candidate of candidates) {
    const id = text(candidate?.entityId || candidate?.id)
    const type = text(candidate?.entityType || candidate?.type)
    if (id && matchesFamily(type, id)) return id.toUpperCase()
  }
  return ''
}

function documentById(models = {}, id = '') {
  return findDocumentById(models.procurementDocuments, id)
}

function inventoryById(models = {}, id = '') {
  return asArray(models.inventoryItems).find((item) => text(item.sku).toLowerCase() === text(id).toLowerCase()) || null
}

function buildRelationshipResponse(models, message = '', body = {}) {
  if (!/关系|关联|对应|从哪个|来自|转\s*PO|后面|有关/.test(message)) return null
  const ids = idsFromMessage(message)
  const contextualPo = !ids.some((id) => /^PO-/i.test(id)) && /(?:这个|该|此)?\s*\bPO\b/i.test(message)
    ? contextualBusinessId(body, 'po')
    : ''
  if (contextualPo) ids.unshift(contextualPo)
  const docs = ids.map((id) => documentById(models, id)).filter(Boolean)
  const skus = ids.map((id) => inventoryById(models, id)).filter(Boolean)
  const evidence = evidenceItems([...docs, ...skus.map((item) => ({ ...item, type: 'inventory_item', id: item.sku, route: `/api/inventory/items/${encodeURIComponent(item.sku)}` }))])
  const po = docs.find((doc) => doc.documentType === 'po')
  const pr = docs.find((doc) => doc.documentType === 'pr') || (po?.sourceRequest ? documentById(models, po.sourceRequest) : null)
  const rfq = docs.find((doc) => doc.documentType === 'rfq') || (po?.sourceRfq ? documentById(models, po.sourceRfq) : null)
  const grn = docs.find((doc) => doc.documentType === 'grn') || asArray(models.procurementDocuments).find((doc) => doc.documentType === 'grn' && [doc.relatedPo, doc.poId].map(text).includes(text(po?.id)))
  const sku = skus[0] || (po ? relatedInventoryRisksFor(po, models)[0] : '')

  if (po && sku) {
    return response({
      intent: 'relationship_reasoning_query',
      content: `${po.id} 与 ${typeof sku === 'string' ? sku.split(' ')[0] : sku.sku} 的关系来自${pr ? `采购申请 ${pr.id}` : '当前采购链路'}：该采购链路关联库存风险，采购单当前${po.status || '待跟进'}${grn ? `，相关收货单 ${grn.id} 仍需复核` : ''}。因此该 SKU 的风险需要和 PO 剩余交期一起确认。`,
      evidence,
      cards: [
        evidenceWorkspaceFor(po, models, evidence),
        { type: 'evidence', evidence },
        { type: 'recommended_actions', actions: recommendedActions([po]) },
      ].filter(Boolean),
    })
  }
  if (po && pr) {
    return response({
      intent: 'relationship_reasoning_query',
      content: `${po.id} 来源于采购申请 ${pr.id}。当前 ${po.id} 状态为 ${po.status || '待确认'}，${pr.id} 状态为 ${pr.status || '待确认'}。`,
      evidence,
      cards: [evidenceWorkspaceFor(po, models, evidence), { type: 'evidence', evidence }].filter(Boolean),
    })
  }
  if (rfq) {
    const linkedPo = rfq.linkedPo || asArray(models.procurementDocuments).find((doc) => doc.documentType === 'po' && text(doc.sourceRfq) === text(rfq.id))?.id
    return response({
      intent: 'relationship_reasoning_query',
      content: linkedPo
        ? `${rfq.id} 后续已关联采购单 ${linkedPo}。${rfq.linkedPr ? `该 RFQ 来自采购申请 ${rfq.linkedPr}。` : ''}`
        : `${rfq.id} 当前没有找到已转 PO 的证据。`,
      evidence,
      cards: [evidenceWorkspaceFor(rfq, models, evidence), { type: 'evidence', evidence }].filter(Boolean),
    })
  }
  if (grn) {
    const relatedPo = grn.relatedPo || grn.poId || ''
    return response({
      intent: 'relationship_reasoning_query',
      content: relatedPo ? `${grn.id} 对应采购单 ${relatedPo}，当前收货状态为 ${grn.status || '待确认'}。` : `${grn.id} 当前没有找到对应 PO 的证据。`,
      evidence,
      cards: [evidenceWorkspaceFor(grn, models, evidence), { type: 'evidence', evidence }].filter(Boolean),
    })
  }
  if (skus[0]) {
    const related = asArray(models.procurementDocuments).find((doc) => [doc.sourceSku, doc.sku, doc.itemId].map(text).includes(text(skus[0].sku)))
    return response({
      intent: 'relationship_reasoning_query',
      content: related ? `${skus[0].sku} 的风险与 ${docLabel(related.documentType, related.id)} 有关，请一起确认库存覆盖和采购交期。` : `${skus[0].sku} 当前没有找到直接关联采购单证据。`,
      evidence,
      cards: [{ type: 'evidence', evidence }],
    })
  }
  return response({
    intent: 'relationship_reasoning_query',
    content: '我没有找到这几个对象之间的直接关系证据。请提供 PO、PR、RFQ、GRN 或 SKU 编号后再查询。',
    evidence: [],
    cards: [{ type: 'empty_state', title: '未找到关系证据', data: { reason: '缺少可验证的关联单据或库存证据。' } }],
  })
}

function buildSopResponse(models, message = '') {
  if (!/SOP|规则|流程|通常|一般|怎么处理|应该/.test(message)) return null
  const sop = retrieveAiSopGuidance({ query: message })
  if (!sop.found) {
    return response({
      intent: 'sop_retrieval_query',
      content: sop.limitation,
      cards: [{ type: 'empty_state', title: '未找到内部处理建议', data: { reason: sop.limitation } }],
      evidence: [],
    })
  }
  const guidance = sop.guidance
  return response({
    intent: 'sop_retrieval_query',
    content: `处理建议/内部规则：${guidance.guidance.join('；')}。边界：${guidance.reviewBoundary}`,
    evidence: [{ type: 'internal_sop', id: guidance.id, label: guidance.topic, summary: guidance.reviewBoundary }],
    cards: [
      {
        type: 'evidence_workspace',
        title: '内部处理建议',
        data: {
          primaryObject: guidance.topic,
          keyFacts: guidance.guidance,
          relatedDocuments: [],
          inventorySignals: [],
          supplierSignals: [],
          limitations: [guidance.reviewBoundary],
        },
        evidence: [{ type: 'internal_sop', id: guidance.id, label: guidance.topic, summary: guidance.reviewBoundary }],
      },
      {
        type: 'recommended_actions',
        actions: guidance.allowedActions.includes('po_followup_draft') || guidance.allowedActions.includes('supplier_followup_draft') || guidance.allowedActions.includes('purchase_request_draft')
          ? [{ kind: 'review', label: '按内部处理建议复核业务证据后，再预览对应 ActionDraft。', target: '' }]
          : [],
      },
    ],
  })
}

export function buildAiEvidenceReuseResponse(data = {}, body = {}, options = {}) {
  const message = text(body.question || body.message || body.prompt || body.text)
  if (!message) return null
  const normalized = compact(message)
  const models = readModels(data, options.cache || {})

  const sop = buildSopResponse(models, message)
  if (sop) return sop

  const relationship = buildRelationshipResponse(models, message, body)
  if (relationship) return relationship

  if (/\b(?:PO|PR|RFQ|GRN|INV|SKU)-[A-Z0-9-]+\b/i.test(message) && /优先|解释/.test(message)) {
    return buildPriorityExplanationResponse(models, message)
  }

  if (/\bRFQ-[A-Z0-9-]+\b/i.test(message) && /跟进|回复|报价|供应商|授标|pending|response/i.test(message)) {
    return buildRfqFollowupResponse(models, message)
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
