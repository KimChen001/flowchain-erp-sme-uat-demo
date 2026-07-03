import {
  listMasterItems,
  listMasterSuppliers,
  listMasterWarehouses,
} from './master-data.mjs'
import { buildInventoryItems } from './inventory-read.mjs'
import { listSkuAvailability } from './inventory-allocation-read-model.mjs'
import { listSalesOrders } from './sales-demand-read-model.mjs'

const TYPE_ALIASES = {
  sales_order: ['客户订单', '销售需求', '销售订单', '交付风险', 'customer order', 'sales order'],
  purchase_request: ['pr', '采购申请', '申请'],
  rfq: ['rfq', 'rfx', '询价', '报价', '寻源'],
  purchase_order: ['po', '采购订单', '订单'],
  receiving_doc: ['grn', '收货', '收货单', '入库'],
  supplier_invoice: ['invoice', 'inv', '发票', '供应商发票'],
  supplier: ['supplier', '供应商'],
  item: ['item', 'sku', '物料', '品名'],
  inventory_item: ['inventory', '库存', '低库存', '补货'],
  inventory_availability: ['库存可用量', '可承诺量', '供需缺口', '库存分配', 'ATP'],
  warehouse: ['warehouse', '仓库'],
  bin: ['bin', '库位'],
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function text(value) {
  return String(value ?? '').trim()
}

function lower(value) {
  return text(value).toLowerCase()
}

function numberText(value) {
  const amount = Number(value || 0)
  return Number.isFinite(amount)
    ? amount.toLocaleString('en-US', { maximumFractionDigits: 2 })
    : '0'
}

function money(value) {
  const amount = Number(value || 0)
  return Number.isFinite(amount) && amount > 0 ? `¥${numberText(amount)}` : ''
}

function compact(values) {
  return values.map(text).filter(Boolean)
}

function evidence(label, value) {
  const next = text(value)
  return next ? { label, value: next } : null
}

function makeResult({
  type,
  label,
  subtitle,
  status,
  moduleId,
  entityType = type,
  entityId,
  entityLabel = label,
  fields = {},
  evidence: evidenceRows = [],
}) {
  return {
    id: `${type}:${entityId || label}`,
    type,
    label: text(label),
    subtitle: text(subtitle),
    status: text(status),
    moduleId,
    entityType,
    entityId: text(entityId || label),
    entityLabel: text(entityLabel || label),
    deepLink: moduleId,
    evidence: evidenceRows.filter(Boolean),
    score: 0,
    matchedFields: [],
    fields,
  }
}

function fieldMap(result) {
  const aliases = TYPE_ALIASES[result.type] || []
  return {
    type: aliases.join(' '),
    label: result.label,
    status: result.status,
    subtitle: result.subtitle,
    entityId: result.entityId,
    entityLabel: result.entityLabel,
    ...result.fields,
  }
}

function tokenized(query) {
  return normalizeSearchQuery(query).split(/\s+/).filter(Boolean)
}

export function normalizeSearchQuery(query) {
  return lower(query).replace(/\s+/g, ' ')
}

function matchField(value, query, tokens) {
  const candidate = lower(value)
  if (!candidate || !query) return null
  if (candidate === query) return 120
  if (candidate.startsWith(query)) return 95
  if (candidate.includes(query)) return 72
  if (tokens.length > 1 && tokens.every((token) => candidate.includes(token))) return 62
  return null
}

export function rankSearchResult(result, query) {
  const normalized = normalizeSearchQuery(query)
  const tokens = tokenized(query)
  if (!normalized) return { ...result, score: 0, matchedFields: [] }

  const fields = fieldMap(result)
  const matchedFields = []
  let score = 0
  for (const [field, value] of Object.entries(fields)) {
    const fieldScore = matchField(value, normalized, tokens)
    if (fieldScore === null) continue
    matchedFields.push(field)
    const weighted = ['entityId', 'label'].includes(field)
      ? fieldScore
      : field === 'status'
        ? Math.min(fieldScore, 68)
        : Math.min(fieldScore, 78)
    score = Math.max(score, weighted)
  }

  if (tokens.length > 1) {
    const allText = lower(Object.values(fields).join(' '))
    if (tokens.every((token) => allText.includes(token))) {
      score = Math.max(score, 58)
      if (!matchedFields.includes('combined')) matchedFields.push('combined')
    }
  }

  return { ...result, score, matchedFields }
}

function purchaseRequestResults(db) {
  return asArray(db.purchaseRequests).map((item) => makeResult({
    type: 'purchase_request',
    label: item.pr,
    subtitle: compact([item.supplier, item.sourceSku || item.sourceName, money(item.amount)]).join(' · '),
    status: item.status,
    moduleId: 'procurement:requests',
    entityId: item.pr,
    fields: {
      pr: item.pr,
      supplier: item.supplier,
      sku: item.sourceSku,
      itemName: item.sourceName,
      requester: item.requester,
      buyer: item.buyer,
      priority: item.priority,
      reason: item.reason,
      linkedPo: item.linkedPo,
    },
    evidence: [
      evidence('供应商', item.supplier),
      evidence('SKU', item.sourceSku),
      evidence('金额', money(item.amount)),
      evidence('状态', item.status),
    ],
  }))
}

function salesOrderResults(db) {
  return listSalesOrders(db).map((item) => makeResult({
    type: 'sales_order',
    label: item.salesOrderId,
    subtitle: compact([item.customerName, item.sku, item.itemName, item.promisedDate]).join(' · '),
    status: item.deliveryRiskLabel,
    moduleId: 'sales',
    entityType: 'sales_order',
    entityId: item.salesOrderId,
    entityLabel: `${item.customerName} · ${item.salesOrderId}`,
    fields: {
      salesOrderId: item.salesOrderId,
      customerName: item.customerName,
      sku: item.sku,
      itemName: item.itemName,
      risk: item.deliveryRiskLabel,
      reason: item.deliveryRiskReason,
      linkedPo: item.linkedPurchaseOrders.map((po) => po.id).join(' '),
    },
    evidence: [
      evidence('客户', item.customerName),
      evidence('SKU', item.sku),
      evidence('承诺日期', item.promisedDate),
      evidence('风险', item.deliveryRiskLabel),
    ],
  }))
}

function rfqResults(db) {
  return asArray(db.rfqs).map((item) => makeResult({
    type: 'rfq',
    label: item.id,
    subtitle: compact([item.title, item.bestSupplier, item.due]).join(' · '),
    status: item.status,
    moduleId: 'procurement:rfq',
    entityId: item.id,
    entityLabel: item.title || item.id,
    fields: {
      rfq: item.id,
      title: item.title,
      category: item.category,
      supplier: item.bestSupplier,
      sourceRequest: item.sourceRequest,
      sku: item.sourceSku,
      itemName: item.sourceName,
      linkedPo: item.linkedPo,
    },
    evidence: [
      evidence('标题', item.title),
      evidence('最优供应商', item.bestSupplier),
      evidence('截止日期', item.due),
      evidence('状态', item.status),
    ],
  }))
}

function purchaseOrderResults(db) {
  return asArray(db.purchaseOrders).map((item) => makeResult({
    type: 'purchase_order',
    label: item.po,
    subtitle: compact([item.supplier, money(item.amount), item.eta ? `ETA ${item.eta}` : '']).join(' · '),
    status: item.status,
    moduleId: 'procurement:orders',
    entityId: item.po,
    fields: {
      po: item.po,
      supplier: item.supplier,
      owner: item.owner,
      sourceRequest: item.sourceRequest,
      sourceRfq: item.sourceRfq,
      sku: item.sourceSku,
      itemName: item.sourceName,
      eta: item.eta,
      priority: item.priority,
      lines: asArray(item.lines).map((line) => compact([line.sku, line.itemName, line.warehouseId]).join(' ')).join(' '),
    },
    evidence: [
      evidence('供应商', item.supplier),
      evidence('金额', money(item.amount)),
      evidence('ETA', item.eta),
      evidence('状态', item.status),
    ],
  }))
}

function receivingResults(db) {
  return asArray(db.receivingDocs).map((item) => makeResult({
    type: 'receiving_doc',
    label: item.grn,
    subtitle: compact([item.supplier, item.po, item.arrived]).join(' · '),
    status: item.status,
    moduleId: 'procurement:receiving',
    entityId: item.grn,
    fields: {
      grn: item.grn,
      po: item.po,
      supplier: item.supplier,
      receiver: item.receiver,
      warehouse: item.warehouse,
      lines: asArray(item.lines).map((line) => compact([line.sku, line.itemName, line.warehouseId]).join(' ')).join(' '),
    },
    evidence: [
      evidence('关联 PO', item.po),
      evidence('供应商', item.supplier),
      evidence('仓库', item.warehouse),
      evidence('状态', item.status),
    ],
  }))
}

function supplierInvoiceResults(db) {
  return asArray(db.supplierInvoices).map((item) => {
    const invoiceId = item.invoiceNumber || item.invoiceNo || item.id
    return makeResult({
      type: 'supplier_invoice',
      label: invoiceId,
      subtitle: compact([item.supplier, item.relatedPo, item.relatedGrn, money(item.amount)]).join(' · '),
      status: item.status || item.matchStatus,
      moduleId: 'procurement:invoices',
      entityId: invoiceId,
      fields: {
        invoice: invoiceId,
        supplier: item.supplier,
        po: item.relatedPo,
        grn: item.relatedGrn,
        varianceType: item.varianceType,
        matchStatus: item.matchStatus,
      },
      evidence: [
        evidence('供应商', item.supplier),
        evidence('关联 PO', item.relatedPo),
        evidence('关联 GRN', item.relatedGrn),
        evidence('差异', item.varianceType),
        evidence('状态', item.status || item.matchStatus),
      ],
    })
  })
}

function supplierResults(db) {
  return listMasterSuppliers(db).map((item) => makeResult({
    type: 'supplier',
    label: item.name,
    subtitle: compact([item.id, asArray(item.categories).join('/'), item.risk]).join(' · '),
    status: item.status,
    moduleId: 'srm:master',
    entityId: item.id,
    entityLabel: item.name,
    fields: {
      supplier: item.name,
      supplierId: item.id,
      categories: asArray(item.categories).join(' '),
      risk: item.risk,
      score: item.score,
    },
    evidence: [
      evidence('供应商编码', item.id),
      evidence('风险', item.risk),
      evidence('评分', item.score),
      evidence('状态', item.status),
    ],
  }))
}

function itemResults(db) {
  return listMasterItems(db).map((item) => makeResult({
    type: 'item',
    label: item.sku || item.id,
    subtitle: compact([item.name, item.category, item.defaultWarehouseId]).join(' · '),
    status: item.status,
    moduleId: 'master-data:items',
    entityId: item.id,
    entityLabel: item.name,
    fields: {
      sku: item.sku,
      itemId: item.id,
      itemName: item.name,
      category: item.category,
      warehouse: item.defaultWarehouseId,
      preferredSupplierId: item.preferredSupplierId,
    },
    evidence: [
      evidence('品名', item.name),
      evidence('品类', item.category),
      evidence('默认仓库', item.defaultWarehouseId),
      evidence('状态', item.status),
    ],
  }))
}

function inventoryStatus(item) {
  const currentStock = Number(item.currentStock ?? item.available ?? item.stock ?? 0)
  const safetyStock = Number(item.safetyStock ?? item.minStock ?? item.min ?? 0)
  const explicit = text(item.stockoutRisk || item.inventoryStatus || item.risk)
  if (explicit) return explicit
  if (Number.isFinite(safetyStock) && safetyStock > 0 && currentStock <= safetyStock) return '低库存'
  return text(item.status)
}

function inventoryResults(db) {
  return buildInventoryItems(db)
    .filter((item) => item.availableQuantity !== undefined || item.safetyStock !== undefined || item.riskLevel)
    .map((item) => {
      const sku = item.sku
      const currentStock = Number(item.availableQuantity || 0)
      const safetyStock = Number(item.safetyStock || 0)
      const status = item.status || item.riskLevel
      const warehouse = item.defaultWarehouseId
      return makeResult({
        type: 'inventory_item',
        label: sku,
        subtitle: compact([
          item.itemName,
          status,
          warehouse,
          `可用 ${numberText(currentStock)}${text(item.unit)}`,
          safetyStock > 0 ? `安全库存 ${numberText(safetyStock)}${text(item.unit)}` : '',
        ]).join(' · '),
        status,
        moduleId: 'inventory',
        entityId: sku,
        entityLabel: item.itemName || sku,
        fields: {
          sku,
          itemName: item.itemName,
          category: item.category,
          warehouse,
          supplier: item.supplier,
          currentStock,
          safetyStock,
          risk: item.riskLevel || status,
          aliases: '库存 低库存 缺货 补货 安全库存 stock inventory reorder shortage',
        },
        evidence: [
          evidence('品名', item.itemName),
          evidence('可用库存', `${numberText(currentStock)}${text(item.unit)}`),
          evidence('安全库存', safetyStock > 0 ? `${numberText(safetyStock)}${text(item.unit)}` : ''),
          evidence('状态', status),
        ],
      })
    })
}

function inventoryAvailabilityResults(db) {
  return listSkuAvailability(db)
    .map((item) => makeResult({
      type: 'inventory_availability',
      label: item.sku,
      subtitle: compact([
        item.itemName,
        `库存可用量 ${numberText(item.availableQty)}${text(item.unit)}`,
        `可承诺量 ${numberText(item.availableToPromiseQty)}${text(item.unit)}`,
        `供需缺口 ${numberText(item.shortageQty)}${text(item.unit)}`,
      ]).join(' · '),
      status: item.riskLabel,
      moduleId: 'inventory',
      entityType: 'inventory_item',
      entityId: item.sku,
      entityLabel: item.itemName || item.sku,
      fields: {
        sku: item.sku,
        itemName: item.itemName,
        availabilityLabel: '库存可用量 可承诺量 供需缺口 库存分配 ATP',
        availableQty: item.availableQty,
        availableToPromiseQty: item.availableToPromiseQty,
        shortageQty: item.shortageQty,
        projectedAvailableQty: item.projectedAvailableQty,
        linkedSalesOrders: item.affectedSalesOrders.map((order) => order.salesOrderId).join(' '),
        linkedPurchaseOrders: item.linkedPurchaseOrders.map((po) => po.poId).join(' '),
      },
      evidence: [
        evidence('库存可用量', `${numberText(item.availableQty)}${text(item.unit)}`),
        evidence('可承诺量', `${numberText(item.availableToPromiseQty)}${text(item.unit)}`),
        evidence('供需缺口', `${numberText(item.shortageQty)}${text(item.unit)}`),
        evidence('客户订单', item.affectedSalesOrders.map((order) => order.salesOrderId).join('、')),
        evidence('采购订单', item.linkedPurchaseOrders.map((po) => po.poId).join('、')),
      ],
    }))
}

function warehouseResults(db) {
  return listMasterWarehouses(db).map((item) => makeResult({
    type: item.type === 'bin' ? 'bin' : 'warehouse',
    label: item.id,
    subtitle: compact([item.name, item.type, item.parentId]).join(' · '),
    status: item.status,
    moduleId: 'master-data:warehouses',
    entityId: item.id,
    entityLabel: item.name,
    fields: {
      warehouse: item.id,
      name: item.name,
      type: item.type,
      parentId: item.parentId,
    },
    evidence: [
      evidence('名称', item.name),
      evidence('类型', item.type),
      evidence('父级', item.parentId),
      evidence('状态', item.status),
    ],
  }))
}

export function buildGlobalBusinessSearchIndex(contextOrData = {}) {
  const db = contextOrData.db || contextOrData
  return [
    ...salesOrderResults(db),
    ...purchaseRequestResults(db),
    ...rfqResults(db),
    ...purchaseOrderResults(db),
    ...receivingResults(db),
    ...supplierInvoiceResults(db),
    ...supplierResults(db),
    ...itemResults(db),
    ...inventoryResults(db),
    ...inventoryAvailabilityResults(db),
    ...warehouseResults(db),
  ]
}

export function searchGlobalBusinessRecords(query, contextOrData = {}, options = {}) {
  const normalized = normalizeSearchQuery(query)
  if (!normalized) return []
  const limit = Math.max(1, Number(options.limit || 15))
  return buildGlobalBusinessSearchIndex(contextOrData)
    .map((result) => rankSearchResult(result, normalized))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.type.localeCompare(b.type) || a.label.localeCompare(b.label))
    .slice(0, limit)
}
