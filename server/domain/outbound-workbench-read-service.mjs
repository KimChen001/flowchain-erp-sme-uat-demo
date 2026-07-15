import { resolveProvisionedActor } from './pilot-identity.mjs'
import { outboundDecimalString as fixed, outboundDecimalUnits as units } from './outbound-transaction-policy.mjs'
import { SalesWorkbenchError } from './sales-order-workbench-service.mjs'

const fail = (code, message, status = 400) => { throw new SalesWorkbenchError(code, message, status) }
const iso = (value) => value ? new Date(value).toISOString() : null
const text = (value) => String(value ?? '').trim()
const q = (value) => fixed(units(value || 0))
const activeReservation = (row) => units(row.reservedQuantity) - units(row.consumedQuantity) - units(row.releasedQuantity)
const allocatable = (row) => activeReservation(row) - units(row.allocatedQuantity)
const rolesCanMutate = (role) => ['admin', 'manager', 'business-specialist', 'business_specialist'].includes(role)
const canRead = (actor, warehouseId) => actor.allWarehouses || actor.readWarehouseIds?.has(text(warehouseId))
const canOperate = (actor, warehouseId) => actor.allWarehouses || actor.operateWarehouseIds?.has(text(warehouseId))

function orderHeader(order) {
  return { id: order.id, orderNumber: order.orderNumber, customerId: order.customerId, customerName: order.customerName, promisedDate: iso(order.promisedDate), currency: order.currency, workflowStatus: order.workflowStatus, reservationStatus: order.reservationStatus, fulfillmentStatus: order.fulfillmentStatus, version: order.version, createdAt: iso(order.createdAt), updatedAt: iso(order.updatedAt) }
}
function lineModel(line) {
  const ordered = units(line.orderedQuantity), reserved = units(line.reservedQuantity), fulfilled = units(line.fulfilledQuantity)
  return { id: line.id, itemId: line.itemId, sku: line.sku, itemName: line.itemName, orderedQuantity: fixed(ordered), reservedQuantity: fixed(reserved), fulfilledQuantity: fixed(fulfilled), remainingToReserve: fixed(ordered - reserved - fulfilled), remainingToFulfill: fixed(ordered - fulfilled), unit: line.unit, version: line.version }
}
function reservationModel(row) {
  return { id: row.id, salesOrderLineId: row.salesOrderLineId, itemId: row.itemId, sku: row.sku, warehouseId: row.warehouseId, location: row.location || '', locationKey: row.locationKey, reservedQuantity: q(row.reservedQuantity), allocatedQuantity: q(row.allocatedQuantity), consumedQuantity: q(row.consumedQuantity), releasedQuantity: q(row.releasedQuantity), activeReservedQuantity: fixed(activeReservation(row)), allocatableQuantity: fixed(allocatable(row)), status: row.status, version: row.version }
}
function shipmentModel(row) { return { id: row.id, shipmentNumber: row.shipmentNumber, salesOrderId: row.salesOrderId, workflowStatus: row.workflowStatus, postingStatus: row.postingStatus, version: row.version, postedAt: iso(row.postedAt), postedBy: row.postedBy ? { id: row.postedBy.id, name: row.postedBy.name } : null, reversedAt: iso(row.reversedAt), reversedBy: row.reversedBy ? { id: row.reversedBy.id, name: row.reversedBy.name } : null, reversalReason: row.reversalReason, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) } }

function smartLinks({ order, reservations, shipments, movements, balances }) {
  const balanceFilters = balances.map((row) => ({ sku: row.sku, warehouseId: row.warehouseId, locationKey: row.locationKey }))
  return [
    { label: '预留记录', count: reservations.length, targetRouteId: 'sales:order-detail', targetType: 'reservation', targetId: order.id, filter: { salesOrderId: order.id }, enabled: true },
    { label: '发货单', count: shipments.length, targetRouteId: 'sales:shipment-detail', targetType: 'shipment', targetId: order.id, filter: { salesOrderId: order.id }, enabled: true },
    { label: '库存余额', count: balances.length, targetRouteId: 'inventory:stock', targetType: 'inventory_balance', targetId: order.id, filter: { naturalKeys: balanceFilters }, enabled: balances.length > 0, unavailableReason: balances.length ? null : '当前授权仓库没有余额记录' },
    { label: '库存流水', count: movements.length, targetRouteId: 'inventory:movements', targetType: 'inventory_movement', targetId: order.id, filter: { relatedSalesOrderId: order.id }, enabled: true },
    { label: '审计记录', count: null, targetRouteId: 'settings:audit', targetType: 'audit', targetId: order.id, filter: { entityType: 'SalesOrder', entityId: order.id }, enabled: true },
  ]
}

function reconciliation(order, balances, movements) {
  const checks = []
  for (const row of balances) {
    const calculated = units(row.onHandQuantity) - units(row.reservedQuantity), recorded = units(row.availableQuantity)
    checks.push({ status: calculated === recorded ? 'matched' : 'mismatch', rule: 'available = onHand - reserved', affectedEntity: { type: 'InventoryBalance', id: row.id }, calculated: fixed(calculated), recorded: fixed(recorded), difference: fixed(recorded - calculated), evidenceLinks: [{ type: 'inventory_balance', id: row.id }] })
  }
  for (const line of order.lines) {
    const ordered = units(line.orderedQuantity), reserved = units(line.reservedQuantity), fulfilled = units(line.fulfilledQuantity), valid = reserved >= 0n && fulfilled >= 0n && reserved + fulfilled <= ordered
    checks.push({ status: valid ? 'matched' : 'mismatch', rule: 'reserved + fulfilled <= ordered', affectedEntity: { type: 'SalesOrderLine', id: line.id }, calculated: fixed(reserved + fulfilled), recorded: fixed(ordered), difference: fixed(ordered - reserved - fulfilled), evidenceLinks: [{ type: 'sales_order', id: order.id }] })
  }
  for (const row of order.reservations) {
    const valid = units(row.consumedQuantity) + units(row.releasedQuantity) <= units(row.reservedQuantity) && units(row.allocatedQuantity) <= activeReservation(row)
    checks.push({ status: valid ? 'matched' : 'mismatch', rule: 'reservation quantities reconcile', affectedEntity: { type: 'InventoryReservation', id: row.id }, calculated: fixed(units(row.consumedQuantity) + units(row.releasedQuantity) + units(row.allocatedQuantity)), recorded: q(row.reservedQuantity), difference: fixed(activeReservation(row) - units(row.allocatedQuantity)), evidenceLinks: [{ type: 'reservation', id: row.id }] })
  }
  for (const shipment of order.shipments) for (const line of shipment.lines || []) {
    const allocationIds = new Set(line.allocations.map((row) => row.id)), effective = movements.filter((row) => allocationIds.has(row.sourceDocumentLineId)).reduce((sum, row) => sum + (row.movementType === 'shipment_posting' ? units(row.quantityOut) : row.movementType === 'shipment_reversal' ? -units(row.quantityIn) : 0n), 0n)
    const recorded = shipment.postingStatus === 'reversed' ? 0n : units(line.postedQuantity)
    checks.push({ status: effective === recorded ? 'matched' : 'mismatch', rule: 'posted quantity = posting movements - reversals', affectedEntity: { type: 'ShipmentLine', id: line.id }, calculated: fixed(effective), recorded: fixed(recorded), difference: fixed(recorded - effective), evidenceLinks: [{ type: 'shipment', id: shipment.id }] })
  }
  return { status: checks.some((row) => row.status === 'mismatch') ? 'mismatch' : checks.length ? 'matched' : 'unavailable', checks }
}

async function evidence(prisma, actor, order) {
  const shipmentIds = order.shipments.map((row) => row.id), reservationIds = order.reservations.map((row) => row.id)
  const [audits, events, movements] = await Promise.all([
    prisma.auditLog.findMany({ where: { tenantId: actor.tenantId, OR: [{ entityType: 'SalesOrder', entityId: order.id }, { entityType: 'ShipmentDocument', entityId: { in: shipmentIds } }] }, include: { actor: true }, orderBy: { createdAt: 'asc' } }),
    reservationIds.length ? prisma.inventoryReservationEvent.findMany({ where: { tenantId: actor.tenantId, reservationId: { in: reservationIds } }, include: { actor: true, commandExecution: true }, orderBy: { createdAt: 'asc' } }) : [],
    prisma.inventoryMovement.findMany({ where: { tenantId: actor.tenantId, relatedSalesOrderId: order.id }, orderBy: { occurredAt: 'asc' } }),
  ])
  const rows = [
    ...audits.map((row) => ({ eventType: row.action, title: row.summary, summary: row.summary, occurredAt: iso(row.createdAt), actor: row.actor ? { id: row.actor.id, name: row.actor.name } : null, entityType: row.entityType, entityId: row.entityId, commandType: row.metadata?.commandType || row.action, commandExecutionId: row.metadata?.commandExecutionId || null, idempotencyKey: row.metadata?.idempotencyKey || null, evidenceLinks: [{ type: row.entityType, id: row.entityId }], limitations: [] })),
    ...events.map((row) => ({ eventType: `reservation_${row.eventType}`, title: `库存预留${({ reserved: '已创建', released: '已释放', allocated: '已分配', deallocated: '已取消分配', consumed: '已消耗', restored: '已恢复' })[row.eventType] || '已更新'}`, summary: `${q(row.quantity)} · ${row.reservationId}`, occurredAt: iso(row.createdAt), actor: row.actor ? { id: row.actor.id, name: row.actor.name } : null, entityType: 'InventoryReservation', entityId: row.reservationId, commandType: row.commandType, commandExecutionId: row.commandExecutionId, idempotencyKey: row.commandExecution?.idempotencyKey || null, evidenceLinks: [{ type: 'reservation', id: row.reservationId }], limitations: [] })),
    ...movements.filter((row) => canRead(actor, row.warehouseId)).map((row) => ({ eventType: row.movementType, title: row.movementType === 'shipment_reversal' ? '发货冲销流水已创建' : '发货出库流水已创建', summary: `${row.sku} · ${row.warehouseId || '未指定仓库'} · ${q(row.quantityOut || row.quantityIn)}`, occurredAt: iso(row.occurredAt), actor: row.actorId ? { id: row.actorId, name: row.actorId } : null, entityType: 'InventoryMovement', entityId: row.id, commandType: row.movementType, commandExecutionId: null, idempotencyKey: null, evidenceLinks: [{ type: 'inventory_movement', id: row.id }], limitations: [] })),
  ].sort((a, b) => String(a.occurredAt).localeCompare(String(b.occurredAt)))
  return { timeline: rows, movements: movements.filter((row) => canRead(actor, row.warehouseId)).map((row) => ({ id: row.id, movementType: row.movementType, sku: row.sku, itemName: row.itemName, warehouseId: row.warehouseId, location: row.location || '', quantityIn: q(row.quantityIn), quantityOut: q(row.quantityOut), postingBatchId: row.postingBatchId, sourceDocumentId: row.sourceDocumentId, sourceDocumentLineId: row.sourceDocumentLineId, reversalOfMovementId: row.reversalOfMovementId, reversedByMovementId: row.reversedByMovementId, occurredAt: iso(row.occurredAt) })) }
}

export function createOutboundWorkbenchReadService({ prisma, capabilities = {} } = {}) {
  if (!prisma) throw new Error('prisma is required')
  async function loadOrder(id, context) {
    const actor = await resolveProvisionedActor(prisma, context?.identity || context)
    const order = await prisma.salesOrder.findFirst({ where: { id: text(id), tenantId: actor.tenantId }, include: { lines: { orderBy: { id: 'asc' } }, reservations: { orderBy: { reservedAt: 'asc' } }, shipments: { include: { postedBy: true, reversedBy: true, lines: { include: { allocations: true }, orderBy: { id: 'asc' } } }, orderBy: { createdAt: 'asc' } } } })
    if (!order) fail('SALES_ORDER_NOT_FOUND', 'Sales order was not found.', 404)
    return { actor, order }
  }
  async function orderWorkbench(id, context) {
    const { actor, order } = await loadOrder(id, context), itemIds = order.lines.map((line) => line.itemId)
    const balanceWhere = { tenantId: actor.tenantId, itemId: { in: itemIds } }; if (!actor.allWarehouses) balanceWhere.warehouseId = { in: [...actor.readWarehouseIds] }
    const balances = await prisma.inventoryBalance.findMany({ where: balanceWhere, orderBy: [{ sku: 'asc' }, { warehouseId: 'asc' }, { locationKey: 'asc' }] })
    const ev = await evidence(prisma, actor, order), reservations = order.reservations.filter((row) => canRead(actor, row.warehouseId))
    const mutable = rolesCanMutate(actor.role), confirmed = order.workflowStatus === 'confirmed', operateWarehouses = balances.filter((row) => canOperate(actor, row.warehouseId))
    const availableActions = { canEditDraft: mutable && order.workflowStatus === 'draft', canConfirm: mutable && order.workflowStatus === 'draft' && order.lines.length > 0, canHold: mutable && confirmed, canResume: mutable && order.workflowStatus === 'on_hold', canReserve: mutable && confirmed && operateWarehouses.some((row) => units(row.availableQuantity) > 0n), canRelease: mutable && confirmed && reservations.some((row) => canOperate(actor, row.warehouseId) && allocatable(row) > 0n), canCreateShipment: mutable && confirmed && reservations.some((row) => canOperate(actor, row.warehouseId) && allocatable(row) > 0n), blockingReasonCodes: [], primaryAction: order.workflowStatus === 'draft' ? 'confirm' : confirmed ? 'reserve' : order.workflowStatus === 'on_hold' ? 'resume' : null }
    if (!mutable) availableActions.blockingReasonCodes.push('PERMISSION_DENIED')
    if (confirmed && !operateWarehouses.length) availableActions.blockingReasonCodes.push('WAREHOUSE_SCOPE_DENIED')
    const availability = order.lines.map((line) => ({ salesOrderLineId: line.id, itemId: line.itemId, sku: line.sku, itemName: line.itemName, totalOnHand: fixed(balances.filter((row) => row.itemId === line.itemId).reduce((sum, row) => sum + units(row.onHandQuantity), 0n)), totalReserved: fixed(balances.filter((row) => row.itemId === line.itemId).reduce((sum, row) => sum + units(row.reservedQuantity), 0n)), totalAvailable: fixed(balances.filter((row) => row.itemId === line.itemId).reduce((sum, row) => sum + units(row.availableQuantity), 0n)), balances: balances.filter((row) => row.itemId === line.itemId).map((row) => ({ id: row.id, warehouseId: row.warehouseId, location: row.location || '', locationKey: row.locationKey, onHandQuantity: q(row.onHandQuantity), reservedQuantity: q(row.reservedQuantity), availableQuantity: q(row.availableQuantity), actorScope: canOperate(actor, row.warehouseId) ? 'operate' : 'read', selectable: canOperate(actor, row.warehouseId) })) }))
    const links = smartLinks({ order, reservations, shipments: order.shipments, movements: ev.movements, balances })
    const recon = reconciliation(order, balances, ev.movements)
    return { dataSource: 'Authoritative PostgreSQL', order: orderHeader(order), lines: order.lines.map(lineModel), availability, reservations: reservations.map(reservationModel), shipments: order.shipments.map(shipmentModel), movements: ev.movements, availableActions, smartLinks: links, evidence: ev.timeline, reconciliation: recon, aiExplain: { conclusion: recon.status === 'matched' ? '当前订单的库存、预留与履约事实一致。' : '当前订单存在需要人工复核的对账差异。', keyEvidence: ev.timeline.slice(-5).map((row) => ({ label: row.title, entityType: row.entityType, entityId: row.entityId })), businessImpact: availableActions.canReserve ? '可继续预留或创建发货草稿。' : '当前状态或权限阻止下一步交易。', suggestedAction: availableActions.primaryAction || '查看证据与对账结果', links: links.filter((row) => row.enabled).slice(0, 4), limitations: ['说明为确定性只读解释，不执行 Reserve、Post 或 Reverse。'], uncertainty: ev.timeline.length ? '低' : '中' }, capabilities }
  }
  async function shipmentWorkbench(id, context) {
    const actor = await resolveProvisionedActor(prisma, context?.identity || context)
    const shipment = await prisma.shipmentDocument.findFirst({ where: { id: text(id), tenantId: actor.tenantId }, include: { postedBy: true, reversedBy: true, salesOrder: true, lines: { include: { salesOrderLine: true, allocations: { include: { reservation: true }, orderBy: { id: 'asc' } } }, orderBy: { id: 'asc' } } } })
    if (!shipment) fail('SHIPMENT_NOT_FOUND', 'Shipment was not found.', 404)
    const allocations = shipment.lines.flatMap((line) => line.allocations); if (allocations.some((row) => !canRead(actor, row.warehouseId))) fail('WAREHOUSE_SCOPE_DENIED', 'Shipment was not found.', 404)
    const orderData = await orderWorkbench(shipment.salesOrderId, context), mutable = rolesCanMutate(actor.role), operate = allocations.every((row) => canOperate(actor, row.warehouseId))
    const availableActions = { canCancel: mutable && operate && shipment.postingStatus === 'unposted' && ['draft', 'ready'].includes(shipment.workflowStatus), canPost: mutable && operate && shipment.postingStatus === 'unposted' && shipment.workflowStatus === 'ready', canReverse: mutable && operate && shipment.postingStatus === 'posted', blockingReasonCodes: [], primaryAction: shipment.postingStatus === 'posted' ? 'reverse' : shipment.postingStatus === 'unposted' ? 'post' : null }
    if (!mutable) availableActions.blockingReasonCodes.push('PERMISSION_DENIED'); if (!operate) availableActions.blockingReasonCodes.push('WAREHOUSE_SCOPE_DENIED')
    const movements = orderData.movements.filter((row) => row.sourceDocumentId === shipment.id)
    return { dataSource: 'Authoritative PostgreSQL', shipment: shipmentModel(shipment), salesOrder: orderHeader(shipment.salesOrder), lines: shipment.lines.map((line) => ({ id: line.id, salesOrderLineId: line.salesOrderLineId, sku: line.sku, itemName: line.salesOrderLine.itemName, requestedQuantity: q(line.requestedQuantity), postedQuantity: q(line.postedQuantity), unit: line.unit, version: line.version })), allocations: allocations.map((row) => ({ id: row.id, reservationId: row.reservationId, warehouseId: row.warehouseId, location: row.location || '', locationKey: row.locationKey, quantity: q(row.quantity), status: row.status, movementLink: movements.find((movement) => movement.sourceDocumentLineId === row.id && movement.movementType === 'shipment_posting')?.id || null, reversalMovementLink: movements.find((movement) => movement.sourceDocumentLineId === row.id && movement.movementType === 'shipment_reversal')?.id || null })), availableActions, evidence: orderData.evidence.filter((row) => row.entityId === shipment.id || row.summary.includes(shipment.shipmentNumber) || row.eventType.includes('shipment')), smartLinks: [{ label: '销售订单', count: 1, targetRouteId: 'sales:order-detail', targetType: 'sales_order', targetId: shipment.salesOrderId, filter: {}, enabled: true }, ...orderData.smartLinks], reconciliation: orderData.reconciliation, aiExplain: orderData.aiExplain, movements }
  }
  return { orderWorkbench, shipmentWorkbench }
}
