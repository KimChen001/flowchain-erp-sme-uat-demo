import {
  DOWNSTREAM_MOVEMENT_TYPES,
  RECEIVABLE_PO_STATUSES,
  RECEIVABLE_WORKFLOW_STATUSES,
  ReceivingCommandError,
  receivingDecimalString,
  receivingDecimalUnits,
} from './receiving-posting-command-service.mjs'

const ZERO = 0n
const text = (value = '') => String(value ?? '').trim()
const decimal = (value) => receivingDecimalString(receivingDecimalUnits(value ?? '0'))
const iso = (value) => value ? new Date(value).toISOString() : null
const add = (a, b) => receivingDecimalUnits(a) + receivingDecimalUnits(b)
const subtract = (a, b) => receivingDecimalUnits(a) - receivingDecimalUnits(b)

function fail(code, message, status = 400, details) {
  throw new ReceivingCommandError(code, message, status, details)
}

function tenantScope(context = {}) {
  const identity = context.identity || context
  if (!identity?.authenticated) fail('AUTHENTICATION_REQUIRED', 'Authentication is required.', 401)
  const tenantId = text(identity.tenantId)
  if (!tenantId) fail('TENANT_CONTEXT_REQUIRED', 'A server-resolved tenant context is required.', 403)
  return { tenantId, actorId: text(identity.userId), identity }
}

export function fulfillmentStatus(lines = []) {
  if (!lines.length || lines.every((line) => receivingDecimalUnits(line.receivedQuantity) <= ZERO)) return 'not_received'
  if (lines.every((line) => receivingDecimalUnits(line.receivedQuantity) >= receivingDecimalUnits(line.orderedQuantity))) return 'fully_received'
  return 'partially_received'
}

export function workflowStatusOf(po = {}) {
  return text(po.receivingBaseStatus) || (!['partially_received', 'fully_received'].includes(text(po.status)) ? text(po.status) : 'approved')
}

function lotSerialCapability(line) {
  return {
    state: line?.lotNumber || line?.serialData ? 'schema-ready' : 'not-requested',
    postingAvailable: false,
    message: 'Lot/Serial posting is not connected in this beta.',
  }
}

async function loadAggregate(prisma, tenantId, receivingDocumentId) {
  const receivingDocument = await prisma.receivingDocument.findFirst({ where: { id: receivingDocumentId, tenantId }, include: { lines: true } })
  if (!receivingDocument) fail('RECEIVING_NOT_FOUND', 'Receiving document was not found.', 404)
  const purchaseOrder = receivingDocument.poId
    ? await prisma.purchaseOrder.findFirst({ where: { id: receivingDocument.poId, tenantId }, include: { lines: true } })
    : null
  if (!purchaseOrder) fail('RECEIVING_NOT_FOUND', 'Related purchase order was not found.', 404)
  const warehouseIds = [...new Set([receivingDocument.warehouseId, ...receivingDocument.lines.map((line) => line.warehouseId)].filter(Boolean))]
  const warehouses = warehouseIds.length ? await prisma.warehouse.findMany({ where: { tenantId, id: { in: warehouseIds } } }) : []
  const supplier = receivingDocument.supplierId
    ? await prisma.supplier.findFirst({ where: { tenantId, id: receivingDocument.supplierId } })
    : null
  return { receivingDocument, purchaseOrder, warehouses: new Map(warehouses.map((row) => [row.id, row])), supplier }
}

function detailModel(aggregate, capabilities = {}) {
  const { receivingDocument: grn, purchaseOrder: po, warehouses, supplier } = aggregate
  const poLines = new Map(po.lines.map((line) => [line.id, line]))
  const posted = grn.postingStatus === 'posted'
  const lines = grn.lines.map((line) => {
    const poLine = poLines.get(line.purchaseOrderLineId) || {}
    const accepted = receivingDecimalUnits(line.acceptedQty)
    const currentReceived = receivingDecimalUnits(poLine.receivedQuantity)
    const previous = posted ? currentReceived - accepted : currentReceived
    const remaining = receivingDecimalUnits(poLine.orderedQuantity) - previous - accepted
    const warehouse = warehouses.get(line.warehouseId || grn.warehouseId)
    return {
      id: line.id,
      poLineId: line.purchaseOrderLineId,
      itemId: line.itemId,
      sku: line.sku,
      itemName: line.itemName,
      orderedQuantity: decimal(poLine.orderedQuantity),
      previouslyReceivedQuantity: receivingDecimalString(previous < ZERO ? ZERO : previous),
      acceptedQuantity: decimal(line.acceptedQty),
      rejectedQuantity: decimal(line.rejectedQty),
      remainingReceivableQuantity: receivingDecimalString(remaining < ZERO ? ZERO : remaining),
      unit: line.unit || poLine.unit,
      warehouse: warehouse ? { id: warehouse.id, code: warehouse.code, name: warehouse.name } : null,
      location: line.location || '',
      lotSerialCapability: lotSerialCapability(line),
    }
  })
  return {
    receivingDocument: {
      id: grn.id, documentNumber: grn.documentNumber || grn.id, workflowStatus: grn.workflowStatus,
      postingStatus: grn.postingStatus, qualityStatus: grn.status, version: grn.version,
      arrivedAt: iso(grn.arrivedAt), postedAt: iso(grn.postedAt), postedById: grn.postedById,
      reversedAt: iso(grn.reversedAt), reversedById: grn.reversedById, reversalReason: grn.reversalReason,
      receiver: grn.receiver, supplier: supplier ? { id: supplier.id, code: supplier.code, name: supplier.name } : { id: grn.supplierId, name: grn.supplierName || po.supplierName || 'Unknown' },
      warehouse: warehouses.get(grn.warehouseId) || null, currency: grn.currency,
    },
    purchaseOrder: {
      id: po.id, workflowStatus: workflowStatusOf(po), fulfillmentStatus: fulfillmentStatus(po.lines), version: po.version,
      supplier: { id: po.supplierId, name: po.supplierName || grn.supplierName || 'Unknown' }, expectedDate: iso(po.expectedDate),
    },
    lines,
    postingSummary: { lineCount: lines.length, acceptedQuantity: receivingDecimalString(lines.reduce((sum, line) => sum + receivingDecimalUnits(line.acceptedQuantity), ZERO)), rejectedQuantity: receivingDecimalString(lines.reduce((sum, line) => sum + receivingDecimalUnits(line.rejectedQuantity), ZERO)) },
    capabilities,
    limitations: ['Lot/Serial posting is not connected in this beta.', 'PO workflow and fulfillment are derived separately while the legacy status column remains mixed.'],
  }
}

export function createReceivingWorkbenchQueryService({ prisma, capabilities = {} } = {}) {
  if (!prisma) throw new Error('Prisma client is required for receiving workbench queries.')

  async function getReceivingDetail({ receivingDocumentId }, context) {
    const scope = tenantScope(context)
    return detailModel(await loadAggregate(prisma, scope.tenantId, receivingDocumentId), capabilities)
  }

  async function getReceivingImpactPreview({ receivingDocumentId, operation }, context) {
    const scope = tenantScope(context)
    const aggregate = await loadAggregate(prisma, scope.tenantId, receivingDocumentId)
    const detail = detailModel(aggregate, capabilities)
    const { receivingDocument: grn, purchaseOrder: po } = aggregate
    if (!['post', 'reverse'].includes(operation)) fail('RECEIVING_VALIDATION_FAILED', 'operation must be post or reverse.')
    const balances = await prisma.inventoryBalance.findMany({ where: { tenantId: scope.tenantId, sku: { in: grn.lines.map((line) => line.sku).filter(Boolean) } } })
    const balanceMap = new Map(balances.map((row) => [`${row.sku}|${row.warehouseId || ''}|${row.locationKey}`, row]))
    const blockingIssues = []
    const warnings = []
    const inventoryImpacts = []
    const purchaseOrderImpacts = []
    const poLineMap = new Map(po.lines.map((line) => [line.id, line]))
    const originalMovements = operation === 'reverse' ? await prisma.inventoryMovement.findMany({ where: { tenantId: scope.tenantId, relatedGrnId: grn.id, movementType: 'receipt_posting' } }) : []
    if (operation === 'post') {
      if (grn.postingStatus !== 'unposted') blockingIssues.push({ code: 'RECEIVING_ALREADY_POSTED', message: 'Receiving is not unposted.' })
      if (!RECEIVABLE_WORKFLOW_STATUSES.has(grn.workflowStatus)) blockingIssues.push({ code: 'RECEIVING_VALIDATION_FAILED', message: `Workflow ${grn.workflowStatus} does not allow posting.` })
      if (!RECEIVABLE_PO_STATUSES.has(po.status)) blockingIssues.push({ code: 'RECEIVING_VALIDATION_FAILED', message: `PO workflow ${po.status} does not allow receiving.` })
      for (const line of grn.lines) {
        const poLine = poLineMap.get(line.purchaseOrderLineId)
        if (!poLine) { blockingIssues.push({ code: 'RECEIVING_VALIDATION_FAILED', message: `Line ${line.id} is not linked to the PO.` }); continue }
        const accepted = receivingDecimalUnits(line.acceptedQty)
        const before = receivingDecimalUnits(poLine.receivedQuantity)
        const ordered = receivingDecimalUnits(poLine.orderedQuantity)
        if (accepted <= ZERO) blockingIssues.push({ code: 'RECEIVING_VALIDATION_FAILED', message: `Line ${line.id} accepted quantity must be positive.` })
        if (before + accepted > ordered) blockingIssues.push({ code: 'RECEIVING_OVER_RECEIPT', message: `Line ${line.id} exceeds remaining receivable quantity.` })
        const key = `${line.sku}|${line.warehouseId || grn.warehouseId || ''}|${line.locationKey}`
        const balance = balanceMap.get(key)
        const onHandBefore = receivingDecimalUnits(balance?.onHandQuantity)
        const availableBefore = receivingDecimalUnits(balance?.availableQuantity)
        inventoryImpacts.push({ sku: line.sku, warehouseId: line.warehouseId || grn.warehouseId, location: line.location || '', onHandBefore: receivingDecimalString(onHandBefore), onHandDelta: receivingDecimalString(accepted), onHandAfter: receivingDecimalString(onHandBefore + accepted), availableBefore: receivingDecimalString(availableBefore), availableDelta: receivingDecimalString(accepted), availableAfter: receivingDecimalString(availableBefore + accepted) })
        purchaseOrderImpacts.push({ poLineId: poLine.id, receivedBefore: receivingDecimalString(before), receivedDelta: receivingDecimalString(accepted), receivedAfter: receivingDecimalString(before + accepted), remainingAfter: receivingDecimalString(ordered - before - accepted) })
      }
    } else {
      if (!text(grn.reversalReason)) warnings.push({ code: 'REVERSAL_REASON_REQUIRED_ON_CONFIRM', message: 'A reversal reason is required when confirming.' })
      if (grn.postingStatus !== 'posted') blockingIssues.push({ code: grn.postingStatus === 'reversed' ? 'RECEIVING_ALREADY_REVERSED' : 'RECEIVING_REVERSAL_NOT_SAFE', message: 'Only a posted receiving can be reversed.' })
      if (!originalMovements.length) blockingIssues.push({ code: 'RECEIVING_REVERSAL_NOT_SAFE', message: 'Original receipt movements are missing.' })
      for (const movement of originalMovements) {
        const downstream = await prisma.inventoryMovement.findFirst({ where: { tenantId: scope.tenantId, sku: movement.sku, warehouseId: movement.warehouseId, occurredAt: { gt: movement.occurredAt }, movementType: { in: DOWNSTREAM_MOVEMENT_TYPES } }, select: { id: true, movementType: true } })
        if (downstream) blockingIssues.push({ code: 'RECEIVING_REVERSAL_NOT_SAFE', message: `Downstream ${downstream.movementType} movement prevents reversal.` })
        const key = `${movement.sku}|${movement.warehouseId || ''}|${movement.locationKey}`
        const balance = balanceMap.get(key)
        const quantity = receivingDecimalUnits(movement.quantityIn)
        const onHandBefore = receivingDecimalUnits(balance?.onHandQuantity)
        const availableBefore = receivingDecimalUnits(balance?.availableQuantity)
        if (!balance || onHandBefore < quantity || availableBefore < quantity) blockingIssues.push({ code: 'RECEIVING_REVERSAL_NOT_SAFE', message: `Balance for ${movement.sku} is insufficient.` })
        inventoryImpacts.push({ sku: movement.sku, warehouseId: movement.warehouseId, location: movement.location || '', originalMovementId: movement.id, postingBatchId: movement.postingBatchId, onHandBefore: receivingDecimalString(onHandBefore), onHandDelta: receivingDecimalString(-quantity), onHandAfter: receivingDecimalString(onHandBefore - quantity), availableBefore: receivingDecimalString(availableBefore), availableDelta: receivingDecimalString(-quantity), availableAfter: receivingDecimalString(availableBefore - quantity) })
        const line = grn.lines.find((row) => row.id === movement.sourceDocumentLineId)
        const poLine = poLineMap.get(line?.purchaseOrderLineId)
        if (poLine) {
          const before = receivingDecimalUnits(poLine.receivedQuantity)
          if (before < quantity) blockingIssues.push({ code: 'RECEIVING_REVERSAL_NOT_SAFE', message: `PO line ${poLine.id} received quantity is insufficient.` })
          purchaseOrderImpacts.push({ poLineId: poLine.id, receivedBefore: receivingDecimalString(before), receivedDelta: receivingDecimalString(-quantity), receivedAfter: receivingDecimalString(before - quantity), remainingAfter: receivingDecimalString(receivingDecimalUnits(poLine.orderedQuantity) - before + quantity) })
        }
      }
    }
    const projectedLines = po.lines.map((line) => {
      const impact = purchaseOrderImpacts.find((row) => row.poLineId === line.id)
      return { ...line, receivedQuantity: impact?.receivedAfter ?? line.receivedQuantity }
    })
    return {
      operation, allowed: blockingIssues.length === 0, blockingIssues, warnings, inventoryImpacts, purchaseOrderImpacts,
      statusImpact: { poWorkflowStatus: workflowStatusOf(po), poFulfillmentBefore: fulfillmentStatus(po.lines), poFulfillmentAfter: fulfillmentStatus(projectedLines), receivingPostingBefore: grn.postingStatus, receivingPostingAfter: operation === 'post' ? 'posted' : 'reversed' },
      factsToCreate: { inventoryMovementCount: operation === 'post' ? grn.lines.length : originalMovements.length, auditEventCount: 1, commandExecutionCount: 1 },
      limitations: ['Lot/Serial posting is not connected in this beta.'],
    }
  }

  async function getReceivingEvidenceTimeline({ receivingDocumentId }, context) {
    const scope = tenantScope(context)
    const aggregate = await loadAggregate(prisma, scope.tenantId, receivingDocumentId)
    const [movements, audits, executions] = await Promise.all([
      prisma.inventoryMovement.findMany({ where: { tenantId: scope.tenantId, relatedGrnId: receivingDocumentId }, orderBy: { occurredAt: 'asc' } }),
      prisma.auditLog.findMany({ where: { tenantId: scope.tenantId, entityType: 'ReceivingDocument', entityId: receivingDocumentId }, orderBy: { createdAt: 'asc' } }),
      prisma.businessCommandExecution.findMany({ where: { tenantId: scope.tenantId, entityType: 'ReceivingDocument', entityId: receivingDocumentId }, orderBy: { createdAt: 'asc' } }),
    ])
    const events = [{ id: `created-${receivingDocumentId}`, type: 'business_fact', event: 'receiving_created', occurredAt: iso(aggregate.receivingDocument.createdAt), label: `Receiving ${aggregate.receivingDocument.documentNumber || receivingDocumentId} created`, postedFact: true }]
    for (const movement of movements) events.push({ id: movement.id, type: 'business_fact', event: 'inventory_movement_created', occurredAt: iso(movement.occurredAt), label: `${movement.movementType} ${movement.sku} ${decimal(add(movement.quantityIn, -receivingDecimalUnits(movement.quantityOut)))}`, actorId: movement.actorId, postedFact: true, data: { movementId: movement.id, postingBatchId: movement.postingBatchId, quantityIn: decimal(movement.quantityIn), quantityOut: decimal(movement.quantityOut), reversalOfMovementId: movement.reversalOfMovementId } })
    for (const audit of audits) {
      const metadata = audit.metadata && typeof audit.metadata === 'object' ? audit.metadata : {}
      events.push({ id: audit.id, type: 'audit', event: audit.action, occurredAt: iso(audit.createdAt), label: audit.summary, actorId: audit.actorId, postedFact: false, data: metadata })
      for (const [index, change] of (metadata.balanceChanges || []).entries()) {
        events.push({ id: `${audit.id}-balance-${index}`, type: 'business_fact', event: 'inventory_balance_changed', occurredAt: iso(audit.createdAt), label: `Inventory ${change.sku} balance ${change.before.onHandQuantity} → ${change.after.onHandQuantity}`, actorId: audit.actorId, postedFact: true, data: change })
      }
      for (const [index, change] of (metadata.purchaseOrderLineChanges || []).entries()) {
        events.push({ id: `${audit.id}-po-line-${index}`, type: 'business_fact', event: 'purchase_order_line_received_changed', occurredAt: iso(audit.createdAt), label: `PO received ${change.receivedBefore} → ${change.receivedAfter}`, actorId: audit.actorId, postedFact: true, data: change })
      }
      if (metadata.before?.poStatus !== metadata.after?.poStatus) {
        events.push({ id: `${audit.id}-po-fulfillment`, type: 'business_fact', event: 'purchase_order_fulfillment_changed', occurredAt: iso(audit.createdAt), label: `PO fulfillment ${metadata.before.poStatus} → ${metadata.after.poStatus}`, actorId: audit.actorId, postedFact: true, data: { before: metadata.before.poStatus, after: metadata.after.poStatus } })
      }
    }
    for (const execution of executions) events.push({ id: execution.id, type: 'human_activity', event: execution.commandType, occurredAt: iso(execution.completedAt || execution.createdAt), label: `${execution.commandType} command ${execution.status}`, postedFact: false, data: { idempotencyKey: execution.idempotencyKey, idempotentReplay: false } })
    events.push({ id: `lot-serial-${receivingDocumentId}`, type: 'limitation', event: 'lot_serial_unavailable', occurredAt: iso(aggregate.receivingDocument.updatedAt), label: 'Lot/Serial posting is not connected in this beta.', postedFact: false })
    return { receivingDocumentId, events: events.sort((a, b) => String(a.occurredAt).localeCompare(String(b.occurredAt))) }
  }

  async function getReceivingSmartLinks({ receivingDocumentId }, context) {
    const scope = tenantScope(context)
    const aggregate = await loadAggregate(prisma, scope.tenantId, receivingDocumentId)
    const [movementCount, balanceCount, auditCount, reversalCount] = await Promise.all([
      prisma.inventoryMovement.count({ where: { tenantId: scope.tenantId, relatedGrnId: receivingDocumentId } }),
      prisma.inventoryBalance.count({ where: { tenantId: scope.tenantId, sku: { in: aggregate.receivingDocument.lines.map((line) => line.sku).filter(Boolean) } } }),
      prisma.auditLog.count({ where: { tenantId: scope.tenantId, entityType: 'ReceivingDocument', entityId: receivingDocumentId } }),
      prisma.inventoryMovement.count({ where: { tenantId: scope.tenantId, relatedGrnId: receivingDocumentId, movementType: 'receipt_reversal' } }),
    ])
    return { links: [
      { label: 'Purchase Order', count: 1, targetType: 'purchase_order', targetId: aggregate.purchaseOrder.id, enabled: true },
      { label: 'Movements', count: movementCount, targetType: 'inventory_movement', filter: { relatedGrnId: receivingDocumentId }, enabled: movementCount > 0 },
      { label: 'Balances', count: balanceCount, targetType: 'inventory_balance', filter: { receivingDocumentId }, enabled: balanceCount > 0 },
      { label: 'Audit', count: auditCount, targetType: 'audit', filter: { entityType: 'ReceivingDocument', entityId: receivingDocumentId }, enabled: auditCount > 0 },
      { label: 'Reversal', count: reversalCount, targetType: 'receipt_reversal', filter: { relatedGrnId: receivingDocumentId }, enabled: reversalCount > 0 },
    ] }
  }

  async function getPurchaseOrderReceivingSummary({ purchaseOrderId }, context) {
    const scope = tenantScope(context)
    const po = await prisma.purchaseOrder.findFirst({ where: { id: purchaseOrderId, tenantId: scope.tenantId }, include: { lines: true } })
    if (!po) fail('RECEIVING_NOT_FOUND', 'Purchase order was not found.', 404)
    const receipts = await prisma.receivingDocument.findMany({ where: { tenantId: scope.tenantId, poId: purchaseOrderId }, select: { id: true, postingStatus: true } })
    const movementCount = await prisma.inventoryMovement.count({ where: { tenantId: scope.tenantId, relatedPoId: purchaseOrderId } })
    return { purchaseOrder: { id: po.id, workflowStatus: workflowStatusOf(po), fulfillmentStatus: fulfillmentStatus(po.lines) }, receiptsCount: receipts.length, postedReceiptsCount: receipts.filter((row) => row.postingStatus === 'posted').length, reversedReceiptsCount: receipts.filter((row) => row.postingStatus === 'reversed').length, movementCount, receivedQuantitySummary: receivingDecimalString(po.lines.reduce((sum, line) => sum + receivingDecimalUnits(line.receivedQuantity), ZERO)) }
  }

  return { getReceivingDetail, getReceivingImpactPreview, getReceivingEvidenceTimeline, getReceivingSmartLinks, getPurchaseOrderReceivingSummary }
}
