function asArray(value) {
  return Array.isArray(value) ? value : []
}

function text(value, fallback = '') {
  const next = String(value ?? '').trim()
  return next || fallback
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function lower(value) {
  return text(value).toLowerCase()
}

function evidence(type, id, summary = '') {
  return [{ type, id, summary: text(summary) || id }]
}

function rowDateValue(value = '') {
  const raw = text(value)
  if (!raw) return null
  const iso = raw.match(/^20\d{2}-\d{2}-\d{2}/)?.[0]
  if (iso) return new Date(`${iso}T00:00:00Z`).getTime()
  const chinese = raw.match(/(\d{1,2})月(\d{1,2})日/)
  if (chinese) {
    return new Date(`2026-${String(chinese[1]).padStart(2, '0')}-${String(chinese[2]).padStart(2, '0')}T00:00:00Z`).getTime()
  }
  return null
}

function poId(po = {}, index = 0) {
  return text(po.po || po.poId || po.id, `PO-READ-${String(index + 1).padStart(4, '0')}`)
}

function prId(pr = {}, index = 0) {
  return text(pr.pr || pr.prId || pr.id, `PR-READ-${String(index + 1).padStart(4, '0')}`)
}

function rfqId(rfq = {}, index = 0) {
  return text(rfq.id || rfq.rfq || rfq.rfqId, `RFQ-READ-${String(index + 1).padStart(4, '0')}`)
}

function grnId(grn = {}, index = 0) {
  return text(grn.grn || grn.grnId || grn.id, `GRN-READ-${String(index + 1).padStart(4, '0')}`)
}

function invoiceId(invoice = {}, index = 0) {
  return text(invoice.invoiceNumber || invoice.invoiceId || invoice.id, `INV-READ-${String(index + 1).padStart(4, '0')}`)
}

export function buildProcurementPurchaseRequests(data = {}) {
  return asArray(data.purchaseRequests).map((request, index) => {
    const id = prId(request, index)
    return {
      type: 'purchase_request',
      id,
      status: text(request.status, '待处理'),
      requester: text(request.requester),
      buyer: text(request.buyer),
      supplier: text(request.supplier),
      sku: text(request.sourceSku || request.sku || request.itemId),
      itemName: text(request.sourceName || request.itemName || request.name),
      quantity: toNumber(request.quantity || request.recommendedQty, 0),
      unit: text(request.unit),
      unitPrice: toNumber(request.unitPrice, 0),
      amount: toNumber(request.amount, 0),
      priority: text(request.priority),
      requiredDate: text(request.requiredDate || request.eta),
      linkedRfq: text(request.linkedRfq || request.rfqId),
      linkedPo: text(request.linkedPo || request.poId),
      source: text(request.source),
      reason: text(request.reason),
      evidence: evidence('purchase_request', id, request.reason),
    }
  })
}

export function buildProcurementRfqs(data = {}) {
  return asArray(data.rfqs).map((rfq, index) => {
    const id = rfqId(rfq, index)
    const supplierCount = toNumber(rfq.suppliers ?? asArray(rfq.invitedSuppliers).length, 0)
    const respondedSupplierCount = toNumber(rfq.quoted ?? rfq.respondedSupplierCount, 0)
    return {
      type: 'rfq',
      id,
      title: text(rfq.title, id),
      category: text(rfq.category),
      status: text(rfq.status, '进行中'),
      supplierCount,
      respondedSupplierCount,
      pendingSupplierCount: Math.max(0, supplierCount - respondedSupplierCount),
      dueDate: text(rfq.due || rfq.dueDate),
      bestPrice: toNumber(rfq.bestPrice, 0),
      awardedSupplier: text(rfq.bestSupplier || rfq.awardedSupplier),
      linkedPr: text(rfq.sourceRequest || rfq.linkedPr),
      linkedPo: text(rfq.linkedPo),
      sku: text(rfq.sourceSku || rfq.sku),
      itemName: text(rfq.sourceName || rfq.itemName),
      quantity: toNumber(rfq.quantity, 0),
      unit: text(rfq.unit),
      evidence: evidence('rfq', id, rfq.reason || rfq.title),
    }
  })
}

export function buildProcurementPurchaseOrders(data = {}) {
  const grnsByPo = new Map()
  for (const grn of asArray(data.receivingDocs)) {
    const key = text(grn.po || grn.poId)
    if (!key) continue
    if (!grnsByPo.has(key)) grnsByPo.set(key, [])
    grnsByPo.get(key).push(grn)
  }

  return asArray(data.purchaseOrders).map((po, index) => {
    const id = poId(po, index)
    const lines = asArray(po.lines)
    const orderedQuantity = toNumber(po.totalOrderedQty ?? po.items ?? po.recommendedQty, 0)
    const receivedQuantity = toNumber(po.totalReceivedQty ?? po.received, 0)
    const linkedGrns = asArray(grnsByPo.get(id)).map((grn, grnIndex) => grnId(grn, grnIndex))
    return {
      type: 'purchase_order',
      id,
      status: text(po.status, '待处理'),
      supplier: text(po.supplier),
      sourceRequest: text(po.sourceRequest || po.linkedPr),
      linkedRfq: text(po.sourceRfq || po.linkedRfq),
      expectedDate: text(po.eta || po.expectedDate || po.requiredDate),
      amount: toNumber(po.amount ?? po.totalAmount, 0),
      orderedQuantity,
      receivedQuantity,
      receivingStatus: receivedQuantity <= 0 ? '未收货' : receivedQuantity < orderedQuantity ? '部分收货' : '已收货',
      linkedGrns,
      lineCount: toNumber(po.lineCount ?? lines.length, lines.length),
      owner: text(po.owner || po.buyer),
      priority: text(po.priority),
      sku: text(po.sourceSku || lines.find((line) => line?.sku)?.sku),
      itemName: text(po.sourceName || lines.find((line) => line?.itemName)?.itemName),
      evidence: evidence('purchase_order', id, po.reason || `${id} ${text(po.status)}`),
    }
  })
}

export function buildProcurementReceivingDocs(data = {}) {
  const invoicesByGrn = new Map()
  for (const invoice of asArray(data.supplierInvoices)) {
    const key = text(invoice.relatedGrn || invoice.grn || invoice.grnId)
    if (!key) continue
    if (!invoicesByGrn.has(key)) invoicesByGrn.set(key, [])
    invoicesByGrn.get(key).push(invoice)
  }

  return asArray(data.receivingDocs).map((grn, index) => {
    const id = grnId(grn, index)
    const lines = asArray(grn.lines)
    const acceptedQty = lines.length
      ? lines.reduce((sum, line) => sum + toNumber(line.acceptedQty ?? line.passed, 0), 0)
      : toNumber(grn.passed, 0)
    const rejectedQty = lines.length
      ? lines.reduce((sum, line) => sum + toNumber(line.rejectedQty ?? line.failed, 0), 0)
      : toNumber(grn.failed, 0)
    return {
      type: 'receiving_doc',
      id,
      po: text(grn.po || grn.poId),
      supplier: text(grn.supplier),
      status: text(grn.status, '质检中'),
      arrived: text(grn.arrived || grn.createdAt),
      receiver: text(grn.receiver),
      warehouse: text(grn.warehouse || grn.warehouseId),
      receivedQuantity: toNumber(grn.items, acceptedQty + rejectedQty),
      acceptedQty,
      rejectedQty,
      linkedInvoices: asArray(invoicesByGrn.get(id)).map((invoice, invoiceIndex) => invoiceId(invoice, invoiceIndex)),
      evidence: evidence('receiving_doc', id, `${text(grn.po)} ${text(grn.status)}`),
    }
  })
}

export function buildProcurementSupplierInvoices(data = {}) {
  return asArray(data.supplierInvoices).map((invoice, index) => {
    const id = invoiceId(invoice, index)
    const amount = toNumber(invoice.amount ?? invoice.total ?? invoice.grossAmount, 0)
    const varianceAmount = toNumber(invoice.varianceAmount ?? invoice.variance ?? invoice.priceVariance, 0)
    return {
      type: 'supplier_invoice',
      id,
      supplier: text(invoice.supplier || invoice.supplierName),
      relatedPo: text(invoice.relatedPo || invoice.po || invoice.poId),
      relatedGrn: text(invoice.relatedGrn || invoice.grn || invoice.grnId),
      invoiceDate: text(invoice.invoiceDate || invoice.date),
      dueDate: text(invoice.dueDate),
      amount,
      currency: text(invoice.currency, 'CNY'),
      matchStatus: text(invoice.matchStatus, varianceAmount ? '存在差异' : '待匹配'),
      invoiceStatus: text(invoice.status || invoice.invoiceStatus, '待处理'),
      varianceAmount,
      evidence: evidence('supplier_invoice', id, `${id} ${amount}`),
    }
  })
}

export function buildProcurementThreeWayMatches(data = {}) {
  const pos = new Map(buildProcurementPurchaseOrders(data).map((po) => [po.id, po]))
  const grns = new Map(buildProcurementReceivingDocs(data).map((grn) => [grn.id, grn]))
  return buildProcurementSupplierInvoices(data).map((invoice) => {
    const po = pos.get(invoice.relatedPo) || null
    const grn = grns.get(invoice.relatedGrn) || null
    const varianceAmount = toNumber(invoice.varianceAmount, Math.abs(toNumber(invoice.amount) - toNumber(po?.amount)))
    return {
      type: 'three_way_match',
      id: `MATCH-${invoice.id}`,
      po: invoice.relatedPo,
      grn: invoice.relatedGrn,
      invoice: invoice.id,
      supplier: invoice.supplier || po?.supplier || grn?.supplier || '',
      poAmount: toNumber(po?.amount, 0),
      grnAmount: toNumber(grn?.acceptedQty, 0),
      invoiceAmount: toNumber(invoice.amount, 0),
      varianceAmount,
      status: invoice.matchStatus || (varianceAmount ? '存在差异' : '已匹配'),
      evidence: [
        ...evidence('supplier_invoice', invoice.id, invoice.status),
        ...(po ? evidence('purchase_order', po.id, po.status) : []),
        ...(grn ? evidence('receiving_doc', grn.id, grn.status) : []),
      ],
    }
  })
}

export function buildProcurementDocuments(data = {}) {
  return [
    ...buildProcurementPurchaseRequests(data),
    ...buildProcurementRfqs(data),
    ...buildProcurementPurchaseOrders(data),
    ...buildProcurementReceivingDocs(data),
    ...buildProcurementSupplierInvoices(data),
    ...buildProcurementThreeWayMatches(data),
  ]
}

export function getProcurementDocument(data = {}, type = '', id = '') {
  const wantedType = text(type)
  const wantedId = decodeURIComponent(text(id)).toLowerCase()
  if (!wantedType || !wantedId) return null
  return buildProcurementDocuments(data).find((document) =>
    document.type === wantedType && lower(document.id) === wantedId
  ) || null
}

export function buildProcurementDocumentLinks(data = {}) {
  const links = []
  for (const rfq of buildProcurementRfqs(data)) {
    if (rfq.linkedPr) links.push({ sourceType: 'purchase_request', sourceId: rfq.linkedPr, targetType: 'rfq', targetId: rfq.id, relation: 'sourced_rfq' })
    if (rfq.linkedPo) links.push({ sourceType: 'rfq', sourceId: rfq.id, targetType: 'purchase_order', targetId: rfq.linkedPo, relation: 'awarded_po' })
  }
  for (const po of buildProcurementPurchaseOrders(data)) {
    if (po.sourceRequest) links.push({ sourceType: 'purchase_request', sourceId: po.sourceRequest, targetType: 'purchase_order', targetId: po.id, relation: 'converted_po' })
    if (po.linkedRfq) links.push({ sourceType: 'rfq', sourceId: po.linkedRfq, targetType: 'purchase_order', targetId: po.id, relation: 'awarded_po' })
    for (const grn of po.linkedGrns) links.push({ sourceType: 'purchase_order', sourceId: po.id, targetType: 'receiving_doc', targetId: grn, relation: 'received_by' })
  }
  for (const invoice of buildProcurementSupplierInvoices(data)) {
    if (invoice.relatedPo) links.push({ sourceType: 'purchase_order', sourceId: invoice.relatedPo, targetType: 'supplier_invoice', targetId: invoice.id, relation: 'invoiced_by' })
    if (invoice.relatedGrn) links.push({ sourceType: 'receiving_doc', sourceId: invoice.relatedGrn, targetType: 'supplier_invoice', targetId: invoice.id, relation: 'matched_invoice' })
  }
  return links
}

export function buildProcurementFollowups(data = {}, options = {}) {
  const nowMs = options.now ? new Date(options.now).getTime() : Date.now()
  const items = []
  for (const po of buildProcurementPurchaseOrders(data)) {
    const dueMs = rowDateValue(po.expectedDate)
    if (dueMs && dueMs < nowMs && !['已完成', '已取消', '已收货'].includes(po.status)) {
      items.push({
        type: 'overdue_po',
        id: po.id,
        severity: 'high',
        owner: po.owner,
        summary: `${po.id} 预计日期 ${po.expectedDate}，当前状态 ${po.status}`,
        documentType: 'purchase_order',
        documentId: po.id,
      })
    }
  }
  for (const rfq of buildProcurementRfqs(data)) {
    if (rfq.pendingSupplierCount > 0 && !['已授标', '已转PO', '已关闭', '已取消'].includes(rfq.status)) {
      items.push({
        type: 'pending_rfq_response',
        id: rfq.id,
        severity: rfq.pendingSupplierCount > 1 ? 'medium' : 'low',
        owner: '',
        summary: `${rfq.id} 仍有 ${rfq.pendingSupplierCount} 家供应商待回复`,
        documentType: 'rfq',
        documentId: rfq.id,
      })
    }
  }
  for (const invoice of buildProcurementSupplierInvoices(data)) {
    if (Math.abs(toNumber(invoice.varianceAmount)) > 0 || /差异|异常|待复核/.test(invoice.matchStatus)) {
      items.push({
        type: 'invoice_variance',
        id: invoice.id,
        severity: 'high',
        owner: '',
        summary: `${invoice.id} 差异金额 ${invoice.varianceAmount}`,
        documentType: 'supplier_invoice',
        documentId: invoice.id,
      })
    }
  }
  return items
}

export function buildProcurementSummary(data = {}) {
  const documents = buildProcurementDocuments(data)
  const followups = buildProcurementFollowups(data)
  return {
    documentCount: documents.length,
    purchaseRequestCount: documents.filter((item) => item.type === 'purchase_request').length,
    rfqCount: documents.filter((item) => item.type === 'rfq').length,
    purchaseOrderCount: documents.filter((item) => item.type === 'purchase_order').length,
    receivingDocCount: documents.filter((item) => item.type === 'receiving_doc').length,
    supplierInvoiceCount: documents.filter((item) => item.type === 'supplier_invoice').length,
    threeWayMatchCount: documents.filter((item) => item.type === 'three_way_match').length,
    followupCount: followups.length,
    highSeverityFollowupCount: followups.filter((item) => item.severity === 'high').length,
  }
}

export function filterProcurementRows(rows = [], query = {}) {
  const q = lower(query.q)
  const type = text(query.type)
  const status = text(query.status)
  const supplier = lower(query.supplier)
  const limit = Math.max(0, toNumber(query.limit, 0))
  const filtered = asArray(rows).filter((row) => {
    const haystack = Object.values(row).join(' ').toLowerCase()
    return (!q || haystack.includes(q)) &&
      (!type || row.type === type) &&
      (!status || row.status === status || row.invoiceStatus === status || row.matchStatus === status) &&
      (!supplier || lower(row.supplier).includes(supplier))
  })
  return limit > 0 ? filtered.slice(0, limit) : filtered
}
