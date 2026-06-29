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

function cloneRows(rows) {
  return asArray(rows).map((row) => ({ ...row }))
}

function normalizeRiskLevel(value) {
  const raw = text(value).toLowerCase()
  if (['高', 'high', 'shortage', '缺货', '不足'].includes(raw)) return '高'
  if (['中', 'medium', 'warning', '预警', '低库存'].includes(raw)) return '中'
  if (['低', 'low', 'normal', '正常'].includes(raw)) return '低'
  return raw ? text(value) : '低'
}

function stockStatus(item = {}, availableQuantity = 0, safetyStock = 0) {
  const explicit = text(item.inventoryStatus || item.stockStatus || item.status || item.stockoutRisk)
  if (['冻结', '异常', '缺货', '低库存', '正常'].includes(explicit)) return explicit
  if (availableQuantity <= 0) return '缺货'
  if (safetyStock > 0 && availableQuantity < safetyStock) return '低库存'
  if (safetyStock > 0 && availableQuantity <= safetyStock * 1.2) return '异常'
  return explicit || '正常'
}

function itemKey(item = {}, index = 0) {
  return text(item.sku || item.id || item.itemId || item.code, `SKU-${String(index + 1).padStart(5, '0')}`)
}

export function buildInventoryItems(data = {}) {
  return asArray(data.products).map((item, index) => {
    const sku = itemKey(item, index)
    const availableQuantity = toNumber(item.availableQuantity ?? item.currentStock ?? item.available ?? item.stock ?? item.quantityAvailable, 0)
    const onHandQuantity = toNumber(item.onHandQuantity ?? item.onHandQty ?? item.stockOnHand ?? item.currentStock ?? availableQuantity, availableQuantity)
    const reservedQuantity = toNumber(item.reservedQuantity ?? item.reservedQty ?? item.allocated ?? Math.max(0, onHandQuantity - availableQuantity), 0)
    const safetyStock = toNumber(item.safetyStock ?? item.minStock ?? item.min ?? item.minimumStock, 0)
    const reorderPoint = toNumber(item.reorderPoint ?? item.rop ?? item.moq ?? safetyStock, safetyStock)
    const status = stockStatus(item, availableQuantity, safetyStock)
    const riskLevel = normalizeRiskLevel(item.riskLevel || item.stockoutRisk || status)
    return {
      sku,
      itemName: text(item.itemName || item.name, sku),
      category: text(item.category, '未分类'),
      supplier: text(item.supplier || item.supplierName || item.preferredSupplier || item.preferredSupplierId),
      defaultWarehouseId: text(item.defaultWarehouseId || item.warehouseId || item.warehouse),
      location: text(item.location || item.defaultBin || item.bin),
      availableQuantity,
      onHandQuantity,
      reservedQuantity,
      safetyStock,
      reorderPoint,
      status,
      riskLevel,
      riskReason: text(item.riskReason || item.stockoutRisk || (riskLevel === '高' ? '低于安全库存或可用库存不足' : '库存风险按当前可用数量与安全库存判断')),
      unit: text(item.unit || item.uom || item.baseUom, '件'),
      updatedAt: text(item.updatedAt || item.lastUpdatedAt || item.lastIn),
    }
  })
}

export function getInventoryItemBySku(data = {}, sku = '') {
  const key = decodeURIComponent(text(sku)).toLowerCase()
  if (!key) return null
  return buildInventoryItems(data).find((item) => [item.sku, item.itemName].some((value) => text(value).toLowerCase() === key)) || null
}

export function buildInventoryLots(data = {}) {
  return cloneRows(data.inventoryLots || data.lots).map((lot, index) => ({
    lotId: text(lot.lotId || lot.lot || lot.id, `LOT-${String(index + 1).padStart(4, '0')}`),
    sku: text(lot.sku || lot.itemSku),
    itemName: text(lot.itemName || lot.name),
    warehouseId: text(lot.warehouseId || lot.warehouse),
    location: text(lot.location || lot.bin || lot.warehouse),
    quantity: toNumber(lot.quantity ?? lot.qty ?? lot.onHandQuantity, 0),
    qaStatus: text(lot.qaStatus || lot.qualityStatus || (lot.coa === false ? '待复核' : '可用')),
    expiryDate: text(lot.expiryDate || lot.expiry),
    supplier: text(lot.supplier || lot.supplierName),
    sourceDocument: text(lot.sourceDocument || lot.relatedGrn || lot.grn),
    status: text(lot.status, '可用'),
  }))
}

export function buildInventorySerials(data = {}) {
  return cloneRows(data.inventorySerials || data.serials).map((serial, index) => ({
    serialId: text(serial.serialId || serial.sn || serial.id, `SN-${String(index + 1).padStart(4, '0')}`),
    sku: text(serial.sku || serial.itemSku),
    itemName: text(serial.itemName || serial.name),
    warehouseId: text(serial.warehouseId || serial.warehouse),
    location: text(serial.location || serial.bin || serial.warehouse),
    status: text(serial.status, '在库'),
    owner: text(serial.owner),
    sourceDocument: text(serial.sourceDocument || serial.lot || serial.lotId),
    updatedAt: text(serial.updatedAt || serial.received),
  }))
}

export function buildInventoryMovements(data = {}) {
  return cloneRows(data.inventoryMovements).map((movement, index) => {
    const quantity = toNumber(movement.quantity ?? movement.qty ?? movement.deltaQty, 0)
    const movementType = text(movement.movementType || movement.type, quantity < 0 ? 'StockAdjustment' : 'PurchaseReceipt')
    return {
      movementId: text(movement.movementId || movement.id, `IM-${String(index + 1).padStart(4, '0')}`),
      movementType,
      movementLabel: text(movement.movementLabel || movement.type || movementType),
      date: text(movement.date || movement.ts || movement.timestamp || movement.createdAt),
      sku: text(movement.sku || movement.itemSku || movement.sourceSku),
      itemName: text(movement.itemName || movement.name || movement.sourceName),
      warehouse: text(movement.warehouse || movement.warehouseId || movement.to || movement.from),
      location: text(movement.location || movement.bin || movement.to || movement.from),
      sourceDocument: text(movement.sourceDocument || movement.ref || movement.documentNo || movement.relatedDocument),
      quantityIn: toNumber(movement.quantityIn ?? movement.inQty ?? (quantity > 0 ? quantity : 0), 0),
      quantityOut: toNumber(movement.quantityOut ?? movement.outQty ?? (quantity < 0 ? Math.abs(quantity) : 0), 0),
      adjustmentQty: toNumber(movement.adjustmentQty ?? movement.adjustQty ?? (movementType === 'StockAdjustment' ? quantity : 0), 0),
      status: text(movement.status, '已登记'),
      owner: text(movement.owner || movement.op || movement.operator),
      unit: text(movement.unit || movement.uom, '件'),
      relatedPo: text(movement.relatedPo || movement.po || movement.poId),
      relatedGrn: text(movement.relatedGrn || movement.grn || movement.grnId),
      relatedReturn: text(movement.relatedReturn || movement.returnId),
      relatedSalesOrder: text(movement.relatedSalesOrder || movement.salesOrderId),
      inventoryImpact: text(movement.inventoryImpact),
      reason: text(movement.reason),
      evidence: asArray(movement.evidence).map((item) => ({ label: text(item.label), value: text(item.value) })),
      timeline: asArray(movement.timeline).map((item) => ({ label: text(item.label), value: text(item.value) })),
    }
  })
}

function exceptionStatus(status = '') {
  if (status === '已关闭' || status === '已确认') return status === '已确认' ? '已复核' : '已关闭'
  if (status === '已取消') return '已驳回'
  if (status === '异常处理') return '处理中'
  return '待复核'
}

export function buildInventoryExceptions(data = {}) {
  const explicit = cloneRows(data.inventoryExceptions || data.inventoryExceptionDocuments)
  if (explicit.length) {
    return explicit.map((doc, index) => ({
      id: text(doc.id || doc.exceptionId, `IEX-${String(index + 1).padStart(4, '0')}`),
      type: text(doc.type, '库存调整'),
      sku: text(doc.sku || doc.itemSku),
      itemName: text(doc.itemName || doc.name),
      warehouse: text(doc.warehouse || doc.warehouseId),
      location: text(doc.location || doc.bin),
      quantityImpact: toNumber(doc.quantityImpact ?? doc.deltaQty, 0),
      unit: text(doc.unit || doc.uom, '件'),
      status: text(doc.status, '待复核'),
      owner: text(doc.owner),
      linkedMovement: text(doc.linkedMovement || doc.movementId),
      linkedDocument: text(doc.linkedDocument || doc.sourceDocument),
      nextAction: text(doc.nextAction),
      reason: text(doc.reason),
    }))
  }
  return buildInventoryMovements(data)
    .filter((movement) =>
      ['待复核', '异常处理'].includes(movement.status) ||
      ['StockAdjustment', 'StockTransfer', 'CycleCountVariance'].includes(movement.movementType)
    )
    .map((movement, index) => ({
      id: `IEX-READ-${String(index + 1).padStart(4, '0')}`,
      type: movement.movementType === 'StockTransfer' ? '调拨差异' : movement.movementType === 'CycleCountVariance' ? '盘点差异关闭' : '库存调整',
      sku: movement.sku,
      itemName: movement.itemName,
      warehouse: movement.warehouse,
      location: movement.location,
      quantityImpact: toNumber(movement.quantityIn - movement.quantityOut + movement.adjustmentQty, 0),
      unit: movement.unit,
      status: exceptionStatus(movement.status),
      owner: movement.owner,
      linkedMovement: movement.movementId,
      linkedDocument: movement.sourceDocument,
      nextAction: movement.status === '已关闭' ? '归档异常证据' : '复核库存影响',
      reason: movement.reason,
    }))
}

export function buildInventorySummary(data = {}) {
  const items = buildInventoryItems(data)
  const movements = buildInventoryMovements(data)
  const exceptions = buildInventoryExceptions(data)
  return {
    itemCount: items.length,
    lowStockCount: items.filter((item) => ['低库存', '缺货', '不足', '预警'].includes(item.status) || ['高', '中'].includes(item.riskLevel)).length,
    highRiskCount: items.filter((item) => item.riskLevel === '高' || item.status === '缺货').length,
    movementCount: movements.length,
    exceptionCount: exceptions.filter((item) => item.status !== '已关闭').length,
    lotCount: buildInventoryLots(data).length,
    serialCount: buildInventorySerials(data).length,
  }
}

export function filterInventoryRows(rows = [], query = {}) {
  const q = text(query.q).toLowerCase()
  const status = text(query.status)
  const warehouse = text(query.warehouse)
  const risk = text(query.risk)
  const limit = Math.max(0, toNumber(query.limit, 0))
  const filtered = asArray(rows).filter((row) => {
    const haystack = Object.values(row).join(' ').toLowerCase()
    const matchQ = !q || haystack.includes(q)
    const matchStatus = !status || row.status === status
    const matchWarehouse = !warehouse || row.warehouse === warehouse || row.warehouseId === warehouse || row.defaultWarehouseId === warehouse
    const matchRisk = !risk || row.riskLevel === risk
    return matchQ && matchStatus && matchWarehouse && matchRisk
  })
  return limit > 0 ? filtered.slice(0, limit) : filtered
}
