import { buildInventoryAllocationReadModel } from './inventory-allocation-read-model.mjs'
import {
  buildProcurementPurchaseOrders,
  buildProcurementPurchaseRequests,
  buildProcurementReceivingDocs,
  buildProcurementSupplierInvoices,
  buildProcurementThreeWayMatches,
} from './procurement-read-model.mjs'
import { buildSalesDemandReadModel } from './sales-demand-read-model.mjs'

function asArray(value) { return Array.isArray(value) ? value : [] }
function text(value, fallback = '') { const next = String(value ?? '').trim(); return next || fallback }
function number(value, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback }
function compact(items = []) { return asArray(items).filter(Boolean) }
function uniqueBy(items = [], keyOf = (item) => item.id || item.label) {
  const seen = new Set()
  const out = []
  for (const item of compact(items)) {
    const key = keyOf(item)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}
function includesAny(row = {}, values = []) {
  const haystack = Object.values(row).flatMap((value) => Array.isArray(value) ? value : [value]).join(' ')
  return values.some((value) => text(value) && haystack.includes(text(value)))
}
function riskRank(value = '') {
  const raw = text(value)
  if (/已阻塞|阻塞|高风险|缺货|异常|差异|blocked|high/i.test(raw)) return 4
  if (/需关注|部分|中|待复核|medium/i.test(raw)) return 3
  if (/待|未|low/i.test(raw)) return 2
  return 1
}
function node(kind, row = {}, extra = {}) {
  const id = text(extra.id || row.id || row.salesOrderId || row.sku || row.poId || row.invoiceId)
  if (!id) return null
  return {
    kind,
    id,
    label: text(extra.label || row.label || row.title || id, id),
    status: text(extra.status ?? row.status ?? row.statusLabel ?? row.riskLabel ?? row.matchStatus ?? row.invoiceStatus),
    summary: text(extra.summary || row.summary || row.riskReason || row.deliveryRiskReason || row.reason),
    moduleId: text(extra.moduleId, 'overview'),
    entityType: text(extra.entityType, 'business_object'),
    amount: extra.amount ?? row.amount ?? null,
    quantity: extra.quantity ?? row.quantity ?? null,
    supplierName: text(extra.supplierName ?? row.supplierName ?? row.supplier),
  }
}
function link(label, moduleId, entityType, entityId, entityLabel = '') {
  return {
    label: text(label),
    moduleId: text(moduleId, 'overview'),
    entityType: text(entityType, 'business_object'),
    entityId: text(entityId),
    entityLabel: text(entityLabel || entityId || label),
    returnTo: 'core-business-chain',
    source: 'coreBusinessChainV1',
    reason: '查看销售、库存、采购、收货、发票和财务协同证据链。',
    returnContext: {
      sourceModule: 'overview',
      sourceRoute: 'overview',
      sourceLabel: '今日行动',
      returnLabel: '返回 今日行动',
      originIntent: 'coreBusinessChain',
    },
  }
}
function evidence(label, row = {}, moduleId = 'overview', entityType = 'business_object') {
  const id = text(row.id || row.salesOrderId || row.sku || row.poId || row.invoiceId || row.label)
  if (!id) return null
  return {
    id: `${moduleId}-${id}-${label}`,
    sourceModule: label,
    objectLabel: id,
    evidenceLabel: label,
    evidenceSummary: text(row.summary || row.riskReason || row.deliveryRiskReason || row.status || row.statusLabel || row.matchStatus, `${id} 需结合来源证据复核。`),
    entityLabel: id,
    entityType,
    entityId: id,
    moduleId,
    severity: riskRank(row.status || row.statusLabel || row.riskLabel || row.matchStatus) >= 4 ? 'risk' : 'warning',
    navigationLinks: [link(`查看${id}`, moduleId, entityType, id)],
  }
}
function limitation(label, description, missingData = []) {
  return {
    label,
    description,
    severity: 'warning',
    missingData,
    consequence: '会影响主链解释、草稿优先级和后续人工复核判断。',
  }
}
function reviewDraft(chainNode = {}) {
  const po = chainNode.procurement?.purchaseOrders?.[0]
  const sku = chainNode.inventory?.sku
  return {
    title: `${po?.id || sku || '主链'} 人工复核草稿`,
    description: '汇总销售需求、库存风险、采购、收货、发票和财务协同证据，仅供人工复核。',
    previewOnly: true,
    reviewRequired: true,
    requiresHumanReview: true,
    prohibitedActions: ['不形成正式业务处理', '不外发', '不写库存', '不写财务凭证', '不处理资金', '不改主数据'],
    allowedNextStep: '进入人工复核或打开来源模块。',
    targetModule: 'review-actions',
    targetEntityType: po ? 'purchase_order' : 'inventory_item',
    targetEntityId: po?.id || sku || '',
    draftType: po ? 'po_followup_draft' : 'purchase_request_draft',
    draftTitle: `${po?.id || sku || '主链'} 人工复核草稿`,
    payload: {
      source: 'ai_assistant',
      reviewOnly: true,
      previewOnly: true,
      requiresHumanReview: true,
      poId: po?.id || '',
      itemIdOrSku: sku || '',
      reason: '基于核心业务链证据整理复核草稿。',
      message: '请复核来源证据、数据限制和业务影响后，再决定后续处理方式。',
    },
    originEvidence: buildChainEvidenceSummaryV1(chainNode).slice(0, 5).map((item) => ({
      type: item.entityType,
      id: item.entityId,
      label: item.entityLabel,
      summary: item.evidenceSummary,
    })),
  }
}

export function buildSalesDemandToInventoryLinksV1(db = {}) {
  const sales = buildSalesDemandReadModel(db)
  const inventory = buildInventoryAllocationReadModel(db)
  return sales.orders.map((order) => {
    const availability = inventory.availability.find((item) => item.sku === order.sku) || null
    return {
      salesOrderId: order.salesOrderId,
      sku: order.sku,
      order,
      availability,
      shortageQty: number(order.shortageQty) + number(availability?.shortageQty),
      riskLabel: availability?.riskLabel || order.deliveryRiskLabel || order.statusLabel,
    }
  })
}

export function buildInventoryToProcurementLinksV1(db = {}) {
  const inventory = buildInventoryAllocationReadModel(db)
  const requests = buildProcurementPurchaseRequests(db)
  const orders = buildProcurementPurchaseOrders(db)
  return inventory.availability.map((item) => {
    const sku = item.sku
    const requestRows = requests.filter((row) => row.sku === sku || row.itemId === sku || includesAny(row, [sku]))
    const orderIds = uniqueBy([
      ...asArray(item.affectedSalesOrders).flatMap((order) => asArray(order.linkedPurchaseOrders).map((po) => ({ id: po.id }))),
      ...asArray(item.linkedPurchaseOrders).map((po) => ({ id: po.poId || po.id })),
    ], (row) => row.id).map((row) => row.id)
    const orderRows = uniqueBy([
      ...orders.filter((row) => orderIds.includes(row.id)),
      ...orders.filter((row) => row.sku === sku || row.itemId === sku || includesAny(row, [sku])),
    ], (row) => row.id)
    return { sku, availability: item, purchaseRequests: requestRows, purchaseOrders: orderRows }
  })
}

export function buildProcurementToReceivingLinksV1(db = {}) {
  const orders = buildProcurementPurchaseOrders(db)
  const receivingDocs = buildProcurementReceivingDocs(db)
  return orders.map((po) => ({
    poId: po.id,
    po,
    receivingDocs: receivingDocs.filter((grn) => grn.poId === po.id || grn.po === po.id || asArray(po.linkedGrns).includes(grn.id)),
  }))
}

export function buildReceivingToInvoiceLinksV1(db = {}) {
  const receivingDocs = buildProcurementReceivingDocs(db)
  const invoices = buildProcurementSupplierInvoices(db)
  return receivingDocs.map((grn) => ({
    grnId: grn.id,
    grn,
    invoices: invoices.filter((invoice) => invoice.relatedGrn === grn.id || invoice.grnId === grn.id || invoice.relatedPo === grn.poId),
  }))
}

export function buildInvoiceToFinanceLinksV1(db = {}) {
  const invoices = buildProcurementSupplierInvoices(db)
  const matches = buildProcurementThreeWayMatches(db)
  return invoices.map((invoice) => ({
    invoiceId: invoice.id,
    invoice,
    threeWayMatch: matches.find((match) => match.invoiceId === invoice.id || match.invoice === invoice.id) || null,
    financeImpact: {
      status: invoice.matchStatus || invoice.invoiceStatus || '待复核',
      varianceAmount: number(invoice.varianceAmount),
      summary: number(invoice.varianceAmount)
        ? `${invoice.id} 存在差异金额 ${invoice.varianceAmount}，需财务协同复核。`
        : `${invoice.id} 需确认发票、收货和采购订单匹配状态。`,
    },
  }))
}

export function buildCoreBusinessChainV1(db = {}) {
  const salesToInventory = buildSalesDemandToInventoryLinksV1(db)
  const inventoryToProcurement = buildInventoryToProcurementLinksV1(db)
  const procurementToReceiving = buildProcurementToReceivingLinksV1(db)
  const receivingToInvoice = buildReceivingToInvoiceLinksV1(db)
  const invoiceToFinance = buildInvoiceToFinanceLinksV1(db)
  const orders = buildProcurementPurchaseOrders(db)
  const receivingDocs = buildProcurementReceivingDocs(db)
  const invoices = buildProcurementSupplierInvoices(db)

  const chains = salesToInventory.map((item) => {
    const procurement = inventoryToProcurement.find((row) => row.sku === item.sku) || { purchaseRequests: [], purchaseOrders: [] }
    const explicitPoIds = asArray(item.order.linkedPurchaseOrders).map((po) => text(po.id || po)).filter(Boolean)
    const purchaseOrders = uniqueBy([
      ...asArray(procurement.purchaseOrders),
      ...orders.filter((po) => explicitPoIds.includes(po.id)),
    ], (po) => po.id).slice(0, 5)
    const receiving = uniqueBy(purchaseOrders.flatMap((po) =>
      (procurementToReceiving.find((row) => row.poId === po.id)?.receivingDocs || [])
    ), (grn) => grn.id).slice(0, 5)
    const relatedInvoices = uniqueBy([
      ...receiving.flatMap((grn) => receivingToInvoice.find((row) => row.grnId === grn.id)?.invoices || []),
      ...purchaseOrders.flatMap((po) => invoices.filter((invoice) => invoice.relatedPo === po.id || invoice.poId === po.id)),
    ], (invoice) => invoice.id).slice(0, 5)
    const finance = relatedInvoices.map((invoice) => invoiceToFinance.find((row) => row.invoiceId === invoice.id)).filter(Boolean)
    const syntheticFinance = relatedInvoices.length ? [] : purchaseOrders.map((po) => ({
      invoiceId: '',
      invoice: null,
      threeWayMatch: null,
      financeImpact: {
        status: '发票记录待补充',
        varianceAmount: 0,
        summary: `${po.id} 已关联采购和收货证据，发票记录或差异说明需补充后再财务协同复核。`,
      },
    }))
    const chainNode = {
      id: `CHAIN-${item.order.salesOrderId}`,
      salesDemand: node('sales_demand', item.order, {
        id: item.order.salesOrderId,
        moduleId: 'sales',
        entityType: 'customer_order',
        summary: `${item.order.customerName} ${item.order.sku} 缺口 ${item.order.shortageQty}`,
      }),
      inventory: {
        sku: item.sku,
        availability: node('inventory_risk', item.availability || {}, {
          id: item.sku,
          moduleId: 'inventory',
          entityType: 'inventory_item',
          status: item.riskLabel,
          summary: item.availability?.riskReason || item.order.deliveryRiskReason,
        }),
      },
      replenishment: {
        purchaseRequests: asArray(procurement.purchaseRequests).map((row) => node('purchase_request', row, { moduleId: 'procurement:requests', entityType: 'purchase_request' })).filter(Boolean).slice(0, 5),
        suggestedQty: number(item.availability?.shortageQty || item.order.shortageQty),
      },
      procurement: {
        purchaseOrders: purchaseOrders.map((po) => node('purchase_order', po, { moduleId: 'procurement:orders', entityType: 'purchase_order' })).filter(Boolean),
      },
      receiving: {
        receivingDocs: receiving.map((grn) => node('receiving_doc', grn, { moduleId: 'procurement:receiving', entityType: 'receiving_doc' })).filter(Boolean),
      },
      invoice: {
        supplierInvoices: relatedInvoices.map((invoice) => node('supplier_invoice', invoice, { moduleId: 'finance', entityType: 'supplier_invoice' })).filter(Boolean),
      },
      finance: {
        impacts: [...finance, ...syntheticFinance].map((row) => row.financeImpact).slice(0, 5),
      },
    }
    chainNode.summary = buildChainEvidenceSummaryV1(chainNode)
    chainNode.navigationLinks = buildChainNavigationLinksV1(chainNode)
    chainNode.dataLimitations = buildChainDataLimitationsV1(chainNode)
    chainNode.reviewDraftSuggestions = buildChainReviewDraftSuggestionsV1(chainNode)
    chainNode.priorityScore = number(item.shortageQty) + riskRank(item.riskLabel) * 100 + receiving.filter((grn) => riskRank(grn.status) >= 4).length * 80
    return chainNode
  }).sort((a, b) => b.priorityScore - a.priorityScore)

  return {
    version: 'v1',
    generatedAt: '2026-05-25T13:00:00.000Z',
    chains,
    summary: {
      chainCount: chains.length,
      highRiskChainCount: chains.filter((chain) => Math.max(riskRank(chain.salesDemand?.status), riskRank(chain.inventory?.availability?.status)) >= 4).length,
      invoiceGapCount: chains.filter((chain) => !chain.invoice.supplierInvoices.length).length,
      reviewDraftCount: chains.reduce((sum, chain) => sum + chain.reviewDraftSuggestions.length, 0),
    },
    dataScopeLabel: '当前工作区数据',
  }
}

export function findBusinessChainByEntityV1(chain, { entityType = '', entityId = '' } = {}) {
  const key = text(entityId).toLowerCase()
  const type = text(entityType).toLowerCase()
  const chains = asArray(chain?.chains || chain)
  if (!key && !type) return chains[0] || null
  return chains.find((item) => {
    const candidates = [
      item.salesDemand,
      item.inventory?.availability,
      ...asArray(item.replenishment?.purchaseRequests),
      ...asArray(item.procurement?.purchaseOrders),
      ...asArray(item.receiving?.receivingDocs),
      ...asArray(item.invoice?.supplierInvoices),
    ]
    return candidates.some((candidate) => {
      const idMatches = !key || text(candidate?.id).toLowerCase() === key || text(candidate?.label).toLowerCase() === key
      const typeMatches = !type || text(candidate?.entityType || candidate?.kind).toLowerCase() === type || text(candidate?.kind).toLowerCase().includes(type)
      return idMatches && typeMatches
    })
  }) || null
}

export function buildChainEvidenceSummaryV1(chainNode = {}) {
  return compact([
    evidence('销售需求', chainNode.salesDemand, 'sales', 'customer_order'),
    evidence('库存风险', chainNode.inventory?.availability, 'inventory', 'inventory_item'),
    ...asArray(chainNode.replenishment?.purchaseRequests).map((row) => evidence('补货建议 / PR 草稿', row, 'procurement:requests', 'purchase_request')),
    ...asArray(chainNode.procurement?.purchaseOrders).map((row) => evidence('采购订单', row, 'procurement:orders', 'purchase_order')),
    ...asArray(chainNode.receiving?.receivingDocs).map((row) => evidence('收货 / GRN', row, 'procurement:receiving', 'receiving_doc')),
    ...asArray(chainNode.invoice?.supplierInvoices).map((row) => evidence('发票差异', row, 'finance', 'supplier_invoice')),
    ...asArray(chainNode.finance?.impacts).map((row, index) => ({
      id: `finance-impact-${index + 1}`,
      sourceModule: '财务协同',
      objectLabel: row.status || '财务协同',
      evidenceLabel: '财务协同',
      evidenceSummary: row.summary,
      entityLabel: row.status || '财务协同',
      entityType: 'finance_review',
      entityId: row.status || `finance-impact-${index + 1}`,
      moduleId: 'finance',
      severity: number(row.varianceAmount) ? 'risk' : 'warning',
      navigationLinks: [link('查看财务协同', 'finance', 'finance_review', row.status || '')],
    })),
  ]).slice(0, 12)
}

export function buildChainNavigationLinksV1(chainNode = {}) {
  return uniqueBy(buildChainEvidenceSummaryV1(chainNode).flatMap((item) => item.navigationLinks || []), (item) => `${item.moduleId}:${item.entityType}:${item.entityId}`).slice(0, 8)
}

export function buildChainDataLimitationsV1(chainNode = {}) {
  const limitations = []
  if (!chainNode.salesDemand?.id) limitations.push(limitation('销售需求证据不足', '当前链路没有明确客户订单。', ['销售需求']))
  if (!chainNode.inventory?.availability?.id) limitations.push(limitation('库存可用量证据不足', '当前链路没有明确 SKU 可用量和可承诺量。', ['库存可用量']))
  if (!asArray(chainNode.replenishment?.purchaseRequests).length) limitations.push(limitation('补货建议待补充', '当前链路没有可直接对应的 PR 草稿或采购申请记录。', ['PR 草稿']))
  if (!asArray(chainNode.procurement?.purchaseOrders).length) limitations.push(limitation('采购订单证据不足', '当前链路没有可直接对应的采购订单。', ['采购订单']))
  if (!asArray(chainNode.receiving?.receivingDocs).length) limitations.push(limitation('收货证据待补充', '当前链路没有可直接对应的收货记录。', ['GRN']))
  if (!asArray(chainNode.invoice?.supplierInvoices).length) limitations.push(limitation('发票差异证据待补充', '当前链路没有可直接对应的供应商发票或差异记录。', ['发票', '三单匹配']))
  return limitations.slice(0, 6)
}

export function buildChainReviewDraftSuggestionsV1(chainNode = {}) {
  return [reviewDraft(chainNode)]
}

export function sanitizeCoreBusinessChainForAiV1(chainNode = {}) {
  return {
    id: chainNode.id,
    salesDemand: chainNode.salesDemand,
    inventory: chainNode.inventory,
    replenishment: chainNode.replenishment,
    procurement: chainNode.procurement,
    receiving: chainNode.receiving,
    invoice: chainNode.invoice,
    finance: chainNode.finance,
    summary: buildChainEvidenceSummaryV1(chainNode),
    navigationLinks: buildChainNavigationLinksV1(chainNode),
    dataLimitations: buildChainDataLimitationsV1(chainNode),
    reviewDraftSuggestions: buildChainReviewDraftSuggestionsV1(chainNode),
  }
}
