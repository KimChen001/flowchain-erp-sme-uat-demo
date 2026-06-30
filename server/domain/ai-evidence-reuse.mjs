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
    .flatMap((item) => asArray(item?.evidence).length ? item.evidence : [item])
    .filter((item) => item && (item.id || item.label || item.summary))
    .map((item) => ({
      type: text(item.type || item.documentType || item.entityType, 'evidence'),
      id: text(item.id || item.documentId || item.sku),
      label: text(item.label || item.title || item.itemName || item.id),
      status: text(item.status || item.matchStatus),
      summary: text(item.summary || item.reason || item.nextAction || item.status || item.label),
      route: text(item.route),
    }))
    .filter((item, index, rows) => index === rows.findIndex((candidate) => `${candidate.type}:${candidate.id}:${candidate.summary}` === `${item.type}:${item.id}:${item.summary}`))
    .slice(0, 6)
}

function recommendedActions(items = []) {
  return asArray(items).slice(0, 3).map((item) => ({
    kind: item.route ? 'deep_link' : 'review',
    label: text(item.nextAction || item.title || '复核证据'),
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

function buildTodayCockpitResponse(models) {
  const cockpit = models.todayCockpit
  const actions = asArray(cockpit.recommendedActions).slice(0, 4)
  const followups = asArray(cockpit.followups).slice(0, 3)
  const inventoryRisks = asArray(cockpit.inventoryRisks).slice(0, 3)
  const evidence = evidenceItems([...actions, ...followups, ...inventoryRisks])
  const topAction = actions[0]?.title || followups[0]?.title || inventoryRisks[0]?.nextAction || '先复核采购和库存风险证据'
  return response({
    intent: 'today_cockpit_priority_query',
    content: `今天建议先处理：${topAction}。当前有 ${cockpit.summary.urgentFollowupCount || 0} 个紧急跟进、${cockpit.summary.lowStockCount || 0} 个库存风险，开放金额 ${amount(cockpit.summary.totalOpenAmount, cockpit.summary.currency || 'CNY')}。`,
    evidence,
    cards: [
      {
        type: 'procurement_followup_summary',
        title: '今日优先事项',
        data: {
          pendingPrCount: models.procurementSummary.openPrCount,
          approvedNotConvertedPrCount: models.procurementSummary.approvedNotConvertedPrCount || 0,
          pendingRfqResponseCount: models.procurementSummary.activeRfqCount,
          overduePoCount: models.procurementSummary.overduePoCount || 0,
          receivingExceptionCount: models.procurementSummary.pendingReceivingCount,
          topIssues: actions.map((item) => ({ title: item.title, reason: item.reason || item.nextAction })),
        },
      },
      { type: 'evidence', evidence },
      { type: 'recommended_actions', actions: recommendedActions(actions) },
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
            title: `${item.documentType} ${item.id}`,
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

  if (/供应商|supplier/i.test(message) && /跟进|follow|风险|关注/.test(message) && !/\bSUP-[A-Z0-9-]+\b/i.test(message)) {
    return buildSupplierFollowupResponse(models)
  }

  if (/采购|单据|三单|发票|po|pr|rfq|grn|procurement|purchase/i.test(message) && /风险|异常|待处理|差异|跟进|逾期|问题/.test(message)) {
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
    (/采购|单据|三单|发票|po|pr|rfq|grn|procurement|purchase/i.test(message) && /风险|异常|待处理|差异|跟进|逾期|问题/.test(message)) ||
    (/库存|sku|物料|inventory|stock|shortage/i.test(message) && /风险|关注|为什么|原因|缺货|低库存|补货|够不够/.test(message)) ||
    (/供应商|supplier/i.test(message) && /跟进|follow|风险|关注/.test(message) && !/\bSUP-[A-Z0-9-]+\b/i.test(message))
  )
  if (!isCockpitContext || !cockpitPrompt) return null
  return buildAiEvidenceReuseResponse(data, body, options)
}
