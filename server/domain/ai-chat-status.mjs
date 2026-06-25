import {
  listMasterItems,
  listMasterSuppliers,
  listMasterWarehouses,
} from './master-data.mjs'

export const aiChatStatusCapabilityCatalog = Object.freeze([
  {
    intent: 'supplier_status_query',
    examples: ['现在 ABC Supplier 状态怎么样？', 'Show me supplier ABC status', 'supplier SUP-001 risk'],
    requiredSlots: ['supplier'],
    optionalSlots: ['timeWindow'],
    responseCards: ['supplier_status', 'evidence', 'recommended_actions'],
    mode: 'read',
  },
  {
    intent: 'inventory_status_query',
    examples: ['今天库存有什么风险？', 'Show item A100 inventory status', 'shortage risk'],
    requiredSlots: [],
    optionalSlots: ['item', 'warehouse', 'riskLevel'],
    responseCards: ['inventory_status', 'inventory_risk_summary', 'evidence', 'recommended_actions'],
    mode: 'read',
  },
  {
    intent: 'procurement_exception_query',
    examples: ['今天有哪些采购问题需要处理？', 'Show overdue POs', 'RFQ pending'],
    requiredSlots: [],
    optionalSlots: ['documentType', 'riskLevel', 'timeWindow'],
    responseCards: ['procurement_exception_summary', 'evidence', 'recommended_actions'],
    mode: 'read',
  },
])

const supplierIntentPattern = /供应商|supplier|SUP-[A-Z0-9-]+/i
const inventoryIntentPattern = /库存|inventory|stock|shortage|缺货|断货|补货|仓库|warehouse|SKU|item/i
const procurementIntentPattern = /采购|procurement|purchase|po\b|order|overdue|逾期|异常|问题|待处理|pending|rfq|pr\b|grn|receiving/i

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function normalizeAiChatMessage(body = {}) {
  return String(body.question || body.message || body.prompt || body.text || '').trim()
}

function normalizedText(value = '') {
  return String(value || '').trim().toLowerCase()
}

function compactText(value = '') {
  return normalizedText(value).replace(/[^\w\u4e00-\u9fa5-]+/g, '')
}

function containsValue(message, value) {
  const raw = normalizedText(value)
  if (!raw) return false
  return normalizedText(message).includes(raw) || compactText(message).includes(compactText(value))
}

function tokenMatch(message, value) {
  const tokens = normalizedText(value)
    .split(/[^\w\u4e00-\u9fa5-]+/)
    .filter((token) => token.length >= 2 && !['supplier', 'status', 'risk', 'item', 'show', '现在', '状态'].includes(token))
  return tokens.some((token) => normalizedText(message).includes(token))
}

function isTerminalStatus(status = '') {
  const normalized = String(status || '').trim().toLowerCase().replace(/\s+/g, '_')
  return new Set([
    '已完成',
    '已取消',
    '已关闭',
    '已驳回',
    '已转po',
    '已转_po',
    '已提交',
    '已过账',
    'completed',
    'complete',
    'closed',
    'cancelled',
    'canceled',
    'rejected',
    'converted',
    'converted_to_po',
    'submitted',
    'posted',
    'done',
  ]).has(normalized)
}

function parseBusinessDate(value = '', now = new Date()) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00.000Z`)
  const zh = raw.match(/(\d{1,2})月(\d{1,2})日/)
  if (zh) {
    const year = now.getUTCFullYear()
    return new Date(Date.UTC(year, Number(zh[1]) - 1, Number(zh[2])))
  }
  return null
}

function isPastDate(value = '', now = new Date()) {
  const parsed = parseBusinessDate(value, now)
  if (!parsed) return false
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  return parsed < today
}

function purchaseOrderId(po = {}) {
  return String(po.po || po.poId || po.id || '')
}

function poSupplierId(po = {}) {
  return String(po.supplierId || po.vendorId || '')
}

function poSupplierName(po = {}) {
  return String(po.supplier || po.supplierName || po.vendor || '')
}

function poDate(po = {}) {
  return po.promisedDate || po.requiredDate || po.eta || po.due || ''
}

function isOpenPurchaseOrder(po = {}) {
  return !isTerminalStatus(po.status)
}

function isOverduePurchaseOrder(po = {}, now = new Date()) {
  return isOpenPurchaseOrder(po) && isPastDate(poDate(po), now)
}

function itemQuantity(item = {}) {
  for (const key of ['availableQuantity', 'onHandQuantity', 'onHandQty', 'stockOnHand', 'stock', 'quantityAvailable']) {
    if (item[key] !== undefined && item[key] !== null && item[key] !== '') return toNumber(item[key], null)
  }
  return null
}

function rawItemFor(db = {}, item = {}) {
  return asArray(db.products).find((product) =>
    [product.id, product.itemId, product.sku, product.code, product.name, product.itemName]
      .some((value) => value && [item.id, item.sku, item.name].some((candidate) => normalizedText(value) === normalizedText(candidate)))
  ) || {}
}

function quantityForItem(db = {}, item = {}) {
  const normalizedQuantity = itemQuantity(item)
  return normalizedQuantity === null ? itemQuantity(rawItemFor(db, item)) : normalizedQuantity
}

function purchaseRequestsFor(db = {}, options = {}) {
  if (typeof options.ensurePurchaseRequests === 'function') return asArray(options.ensurePurchaseRequests(db))
  return asArray(db.purchaseRequests)
}

function inventoryMovementsFor(db = {}, options = {}) {
  if (typeof options.ensureInventoryMovements === 'function') return asArray(options.ensureInventoryMovements(db))
  return asArray(db.inventoryMovements)
}

function movementItemMatches(movement = {}, item = {}) {
  return [movement.itemId, movement.sku, movement.itemSku, movement.sourceSku, movement.itemName, movement.name]
    .some((value) => value && [item.id, item.sku, item.name].some((candidate) => normalizedText(value) === normalizedText(candidate)))
}

function movementQuantity(movement = {}) {
  for (const key of ['quantity', 'qty', 'deltaQty', 'acceptedQty', 'receivedQty']) {
    if (movement[key] !== undefined && movement[key] !== null && movement[key] !== '') return toNumber(movement[key], 0)
  }
  return 0
}

function resolveSupplierMatches(db = {}, message = '') {
  const suppliers = listMasterSuppliers(db)
  const idMatch = message.match(/\bSUP-[A-Z0-9-]+\b/i)?.[0]
  if (idMatch) {
    return {
      slot: idMatch.toUpperCase(),
      matches: suppliers.filter((supplier) => normalizedText(supplier.id) === normalizedText(idMatch)),
    }
  }
  const matches = suppliers.filter((supplier) =>
    containsValue(message, supplier.name) ||
    containsValue(message, supplier.id) ||
    tokenMatch(message, supplier.name)
  )
  const unique = Array.from(new Map(matches.map((supplier) => [supplier.id, supplier])).values())
  return { slot: idMatch || '', matches: unique }
}

function resolveItemMatches(db = {}, message = '') {
  const items = listMasterItems(db)
  const skuMatch = message.match(/\b[A-Z]{1,6}[-]?\d{2,}\b/i)?.[0]
  const matches = items.filter((item) =>
    containsValue(message, item.sku) ||
    containsValue(message, item.id) ||
    containsValue(message, item.name) ||
    (skuMatch && normalizedText(item.sku) === normalizedText(skuMatch)) ||
    tokenMatch(message, item.name)
  )
  const unique = Array.from(new Map(matches.map((item) => [item.id, item])).values())
  return { slot: skuMatch || '', matches: unique }
}

function recommendedActions(actions = []) {
  return { type: 'recommended_actions', actions }
}

function evidenceCard(evidence = []) {
  return { type: 'evidence', evidence }
}

function buildSupplierStatusResponse(db = {}, message = '', options = {}) {
  const { matches, slot } = resolveSupplierMatches(db, message)
  const intent = { name: 'supplier_status_query', confidence: slot ? 0.9 : 0.82, slots: { supplier: slot || '' } }
  if (matches.length === 0) {
    const missing = {
      type: 'missing_fields',
      fields: [{ name: 'supplier', reason: 'No matching supplier was found in Master Data.' }],
    }
    return {
      message: 'I could not find that supplier in Master Data. Please provide a supplier id or a more specific supplier name.',
      intent,
      cards: [missing, recommendedActions([{ label: 'View suppliers', kind: 'deep_link', target: '/srm?view=suppliers' }])],
      evidence: [{ type: 'supplier_master', id: '', summary: 'No supplier master match.' }],
    }
  }
  if (matches.length > 1) {
    return {
      message: 'I found more than one supplier match. Please choose a supplier id to continue.',
      intent: { ...intent, confidence: 0.64, slots: { supplier: slot || 'ambiguous' } },
      cards: [
        {
          type: 'ambiguous_match',
          matches: matches.slice(0, 5).map((supplier) => ({ supplierId: supplier.id, name: supplier.name })),
        },
        recommendedActions([{ label: 'View suppliers', kind: 'deep_link', target: '/srm?view=suppliers' }]),
      ],
      evidence: [{ type: 'supplier_master', id: '', summary: `${matches.length} supplier master records matched.` }],
    }
  }

  const supplier = matches[0]
  const openPos = asArray(db.purchaseOrders).filter((po) =>
    isOpenPurchaseOrder(po) &&
    (normalizedText(poSupplierId(po)) === normalizedText(supplier.id) || normalizedText(poSupplierName(po)) === normalizedText(supplier.name))
  )
  const overduePos = openPos.filter((po) => isOverduePurchaseOrder(po, options.now))
  const receivingIssues = asArray(db.receivingDocs).filter((doc) =>
    normalizedText(doc.supplier || doc.supplierName) === normalizedText(supplier.name) &&
    (doc.status === '异常处理' || toNumber(doc.failed ?? doc.rejectedQty, 0) > 0)
  )
  const data = {
    supplierId: supplier.id,
    name: supplier.name,
    status: supplier.status,
    risk: supplier.risk,
    score: supplier.score,
    scoreSource: supplier.scoreSource,
    defaultCurrency: supplier.defaultCurrency,
    paymentTermsId: supplier.paymentTermsId,
    categories: supplier.categories,
    preferred: supplier.preferred,
    openPoCount: openPos.length,
    overduePoCount: overduePos.length,
    recentIssueCount: receivingIssues.length,
  }
  const evidence = [
    { type: 'supplier_master', id: supplier.id, summary: 'Matched supplier from Master Data.' },
    { type: 'supplier_score_source', id: supplier.id, summary: `Score source is ${supplier.scoreSource}.` },
  ]
  if (openPos.length) evidence.push({ type: 'purchase_order', id: 'open_purchase_orders', summary: `${openPos.length} related open purchase orders found.` })
  if (overduePos.length) evidence.push({ type: 'purchase_order', id: purchaseOrderId(overduePos[0]), summary: `${overduePos.length} related purchase orders appear overdue.` })
  if (receivingIssues.length) evidence.push({ type: 'receiving', id: receivingIssues[0].grn || receivingIssues[0].id || '', summary: `${receivingIssues.length} related receiving issues found.` })

  return {
    message: `${supplier.name} is ${supplier.status}. Risk is ${supplier.risk}, with score ${supplier.score || 'not available'}.`,
    intent: { ...intent, slots: { supplier: supplier.id } },
    cards: [
      { type: 'supplier_status', title: supplier.name, data },
      evidenceCard(evidence),
      recommendedActions([
        { label: 'View supplier', kind: 'deep_link', target: `/srm?view=supplier&supplierId=${encodeURIComponent(supplier.id)}` },
        { label: 'Review open purchase orders', kind: 'deep_link', target: `/procurement?view=purchase-orders&supplierId=${encodeURIComponent(supplier.id)}` },
        { label: 'Review supplier performance', kind: 'deep_link', target: `/srm?view=performance&supplierId=${encodeURIComponent(supplier.id)}` },
      ]),
    ],
    evidence,
  }
}

function buildInventoryStatusResponse(db = {}, message = '', options = {}) {
  const { matches, slot } = resolveItemMatches(db, message)
  const items = listMasterItems(db)
  const warehouses = listMasterWarehouses(db)
  const intent = { name: 'inventory_status_query', confidence: slot ? 0.88 : 0.8, slots: { item: slot || '' } }

  if (matches.length > 1) {
    return {
      message: 'I found more than one item match. Please provide an item sku or item id.',
      intent: { ...intent, confidence: 0.62, slots: { item: 'ambiguous' } },
      cards: [
        { type: 'ambiguous_match', matches: matches.slice(0, 5).map((item) => ({ itemId: item.id, sku: item.sku, name: item.name })) },
        recommendedActions([{ label: 'View item master', kind: 'deep_link', target: '/inventory?view=items' }]),
      ],
      evidence: [{ type: 'item_master', id: '', summary: `${matches.length} item master records matched.` }],
    }
  }

  if (matches.length === 1) {
    const item = matches[0]
    const quantity = quantityForItem(db, item)
    const movements = inventoryMovementsFor(db, options).filter((movement) => movementItemMatches(movement, item))
    const movementDelta = movements.reduce((sum, movement) => sum + movementQuantity(movement), 0)
    const hasQuantity = quantity !== null
    const riskLevel = hasQuantity
      ? quantity <= 0
        ? 'high'
        : quantity < item.moq
          ? 'medium'
          : 'low'
      : 'unknown'
    const riskReason = hasQuantity
      ? (quantity <= 0 ? 'Available quantity is zero or below.' : quantity < item.moq ? 'Available quantity is below MOQ.' : 'Available quantity is at or above MOQ.')
      : 'Current data does not expose a safe stock balance.'
    const warehouse = warehouses.find((record) => record.id === item.defaultWarehouseId)
    const data = {
      itemId: item.id,
      sku: item.sku,
      name: item.name,
      status: item.status,
      category: item.category,
      baseUom: item.baseUom,
      defaultWarehouseId: item.defaultWarehouseId,
      preferredSupplierId: item.preferredSupplierId,
      preferredSupplierSource: item.preferredSupplierSource,
      availableQuantity: hasQuantity ? quantity : null,
      riskLevel,
      riskReason,
      recentMovementCount: movements.length,
    }
    const evidence = [
      { type: 'item_master', id: item.id, summary: 'Matched item from Master Data.' },
      warehouse
        ? { type: 'warehouse_reference', id: warehouse.id, summary: `Warehouse source type is ${warehouse.sourceType}.` }
        : { type: 'warehouse_reference', id: item.defaultWarehouseId, summary: 'Warehouse reference was not found in Master Data.' },
    ]
    if (movements.length) evidence.push({ type: 'inventory_movement', id: movements[0].id || movements[0].movementId || '', summary: `${movements.length} related inventory movements found; observed delta ${movementDelta}.` })
    if (!hasQuantity) evidence.push({ type: 'missing_quantity_evidence', id: item.id, summary: 'No safe current stock balance field is available.' })

    return {
      message: hasQuantity
        ? `${item.sku || item.name} has available quantity ${quantity} ${item.baseUom}.`
        : `${item.sku || item.name} is available in item master, but current stock balance is not available from the current data.`,
      intent: { ...intent, slots: { item: item.sku || item.id } },
      cards: [
        { type: 'inventory_status', title: item.sku || item.name, data },
        evidenceCard(evidence),
        recommendedActions([
          { label: 'View item master', kind: 'deep_link', target: `/inventory?view=item&itemId=${encodeURIComponent(item.id)}` },
          { label: 'Review inventory movements', kind: 'deep_link', target: `/inventory?view=movements&itemId=${encodeURIComponent(item.id)}` },
          { label: 'Review procurement options', kind: 'deep_link', target: `/procurement?view=options&itemId=${encodeURIComponent(item.id)}` },
        ]),
      ],
      evidence,
    }
  }

  const movementCount = inventoryMovementsFor(db, options).length
  const quantityItems = items.filter((item) => quantityForItem(db, item) !== null)
  const riskItems = quantityItems.filter((item) => quantityForItem(db, item) <= 0 || quantityForItem(db, item) < item.moq)
  const evidence = [
    { type: 'item_master', id: 'items', summary: `${items.length} item master records available.` },
    movementCount
      ? { type: 'inventory_movement', id: 'inventory_movements', summary: `${movementCount} inventory movement records available.` }
      : { type: 'missing_quantity_evidence', id: 'inventory_balance', summary: 'No inventory movement or balance evidence is available.' },
  ]
  if (!quantityItems.length) evidence.push({ type: 'missing_quantity_evidence', id: 'stock_balance', summary: 'No safe current stock balance fields were found on item records.' })

  return {
    message: riskItems.length
      ? `${riskItems.length} items show conservative inventory risk signals.`
      : 'No item-level stock balance risk can be confirmed from the current data.',
    intent,
    cards: [
      {
        type: 'inventory_risk_summary',
        title: 'Inventory risk summary',
        data: {
          itemCount: items.length,
          itemsWithQuantityEvidence: quantityItems.length,
          riskItemCount: riskItems.length,
          movementCount,
          topRiskItems: riskItems.slice(0, 5).map((item) => ({
            itemId: item.id,
            sku: item.sku,
            name: item.name,
            availableQuantity: quantityForItem(db, item),
            riskLevel: quantityForItem(db, item) <= 0 ? 'high' : 'medium',
          })),
        },
      },
      evidenceCard(evidence),
      recommendedActions([
        { label: 'View item master', kind: 'deep_link', target: '/inventory?view=items' },
        { label: 'Review inventory movements', kind: 'deep_link', target: '/inventory?view=movements' },
        { label: 'Review procurement options', kind: 'deep_link', target: '/procurement?view=options' },
      ]),
    ],
    evidence,
  }
}

function buildProcurementExceptionResponse(db = {}, message = '', options = {}) {
  const purchaseOrders = asArray(db.purchaseOrders)
  const purchaseRequests = purchaseRequestsFor(db, options)
  const rfqs = asArray(db.rfqs)
  const receivingDocs = asArray(db.receivingDocs)
  const overduePos = purchaseOrders.filter((po) => isOverduePurchaseOrder(po, options.now))
  const pendingPrs = purchaseRequests.filter((pr) => !isTerminalStatus(pr.status))
  const pendingRfqs = rfqs.filter((rfq) => !isTerminalStatus(rfq.status))
  const receivingIssues = receivingDocs.filter((doc) => doc.status === '异常处理' || toNumber(doc.failed ?? doc.rejectedQty, 0) > 0)
  const topIssues = [
    ...overduePos.map((po) => ({
      type: 'overdue_purchase_order',
      id: purchaseOrderId(po),
      title: `${purchaseOrderId(po)} is overdue`,
      severity: po.priority === '高' ? 'high' : 'medium',
      reason: 'Expected delivery date has passed.',
      relatedSupplierId: poSupplierId(po),
      relatedItemIds: asArray(po.lines).map((line) => line.itemId || line.sku).filter(Boolean),
    })),
    ...receivingIssues.map((doc) => ({
      type: 'receiving_issue',
      id: doc.grn || doc.id || '',
      title: `${doc.grn || doc.id || 'Receiving document'} needs follow-up`,
      severity: doc.status === '异常处理' ? 'high' : 'medium',
      reason: doc.status === '异常处理' ? 'Receiving document is in exception handling.' : 'Receiving document includes rejected quantity.',
      relatedSupplierId: doc.supplierId || '',
      relatedItemIds: asArray(doc.lines).map((line) => line.itemId || line.sku).filter(Boolean),
    })),
    ...pendingPrs.slice(0, 3).map((pr) => ({
      type: 'pending_purchase_request',
      id: pr.pr || pr.id || '',
      title: `${pr.pr || pr.id || 'Purchase request'} is pending`,
      severity: pr.priority === '高' ? 'high' : 'medium',
      reason: `Purchase request status is ${pr.status || 'open'}.`,
      relatedSupplierId: pr.supplierId || '',
      relatedItemIds: [pr.itemId || pr.sourceSku || pr.sku].filter(Boolean),
    })),
    ...pendingRfqs.slice(0, 3).map((rfq) => ({
      type: 'pending_rfq',
      id: rfq.id || rfq.rfq || '',
      title: `${rfq.id || rfq.rfq || 'RFQ'} is pending`,
      severity: isPastDate(rfq.due, options.now) ? 'high' : 'medium',
      reason: `RFQ status is ${rfq.status || 'open'}.`,
      relatedSupplierId: '',
      relatedItemIds: [rfq.itemId || rfq.sku || rfq.sourceSku].filter(Boolean),
    })),
  ].slice(0, 8)
  const totalIssueCount = overduePos.length + pendingPrs.length + pendingRfqs.length + receivingIssues.length
  const evidence = [
    { type: 'purchase_order', id: 'purchase_orders', summary: `${purchaseOrders.length} purchase orders inspected.` },
    { type: 'purchase_request', id: 'purchase_requests', summary: `${purchaseRequests.length} purchase requests inspected.` },
    { type: 'rfq', id: 'rfqs', summary: `${rfqs.length} RFQs inspected.` },
    { type: 'receiving', id: 'receiving_docs', summary: `${receivingDocs.length} receiving documents inspected.` },
  ]
  if (!totalIssueCount) evidence.push({ type: 'empty_state', id: 'procurement_exceptions', summary: 'No procurement exceptions were found in current data.' })

  return {
    message: totalIssueCount
      ? `I found ${totalIssueCount} procurement items that may need follow-up.`
      : 'No procurement exceptions are visible in the current data.',
    intent: {
      name: 'procurement_exception_query',
      confidence: /overdue|逾期|po\b|purchase order/i.test(message) ? 0.9 : 0.82,
      slots: {
        documentType: /rfq/i.test(message) ? 'rfq' : /pr\b/i.test(message) ? 'purchase_request' : /po\b|overdue|逾期/i.test(message) ? 'purchase_order' : '',
      },
    },
    cards: [
      {
        type: 'procurement_exception_summary',
        title: 'Procurement exception summary',
        data: {
          totalIssueCount,
          overduePoCount: overduePos.length,
          pendingPrCount: pendingPrs.length,
          pendingRfqCount: pendingRfqs.length,
          receivingIssueCount: receivingIssues.length,
          topIssues,
        },
      },
      evidenceCard(evidence),
      recommendedActions([
        { label: 'View overdue POs', kind: 'deep_link', target: '/procurement?view=purchase-orders&filter=overdue' },
        { label: 'Review pending PRs', kind: 'deep_link', target: '/procurement?view=purchase-requests&filter=pending' },
        { label: 'Review RFQs', kind: 'deep_link', target: '/procurement?view=rfqs&filter=pending' },
        { label: 'Review receiving issues', kind: 'deep_link', target: '/receiving?filter=issues' },
      ]),
    ],
    evidence,
  }
}

export function detectAiChatStatusIntent(message = '') {
  const text = String(message || '').trim()
  if (!text) return null
  if (supplierIntentPattern.test(text)) return 'supplier_status_query'
  if (inventoryIntentPattern.test(text)) return 'inventory_status_query'
  if (procurementIntentPattern.test(text)) return 'procurement_exception_query'
  return null
}

export function buildAiChatStatusResponse(db = {}, body = {}, options = {}) {
  const message = normalizeAiChatMessage(body)
  const intent = detectAiChatStatusIntent(message)
  if (!intent) return null
  const response = intent === 'supplier_status_query'
    ? buildSupplierStatusResponse(db, message, options)
    : intent === 'inventory_status_query'
      ? buildInventoryStatusResponse(db, message, options)
      : buildProcurementExceptionResponse(db, message, options)
  return {
    provider: 'local_status_query',
    mode: 'read',
    content: response.message,
    ...response,
    capabilityCatalog: aiChatStatusCapabilityCatalog.map((item) => ({ ...item, examples: [...item.examples], requiredSlots: [...item.requiredSlots], optionalSlots: [...item.optionalSlots], responseCards: [...item.responseCards] })),
  }
}
