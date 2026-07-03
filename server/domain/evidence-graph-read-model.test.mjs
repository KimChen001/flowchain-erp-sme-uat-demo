import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildEvidenceGraph,
  resolveRelatedRecords,
  tracePurchaseOrderDeliveryImpact,
  traceSalesOrderEvidence,
  traceSkuSupplyDemandEvidence,
  traceSupplierOperationalEvidence,
} from './evidence-graph-read-model.mjs'

function createDb() {
  return {
    __dataMode: 'workspace',
    products: [
      { sku: 'SKU-00412', name: '高扭矩伺服电机', currentStock: 34, reservedQuantity: 68, safetyStock: 50, reorderPoint: 50, supplier: '深圳新元电气', status: '低库存', riskLevel: '高' },
    ],
    suppliers: [
      { id: 'SUP-SZXY', name: '深圳新元电气', status: 'active', risk: 'medium', onTimeRate: 82, qualityRate: 96 },
    ],
    salesOrders: [
      { salesOrderId: 'SO-2026-0412-A', customerName: '华东精密制造', sku: 'SKU-00412', itemName: '高扭矩伺服电机', orderedQty: 120, reservedQty: 36, fulfilledQty: 0, promisedDate: '2026-07-12', priority: '高', linkedPurchaseOrders: ['PO-2026-1282'], linkedSuppliers: ['深圳新元电气'], status: 'shortage_risk' },
    ],
    purchaseRequests: [
      { pr: 'PR-2026-2401', sourceSku: 'SKU-00412', sourceName: '高扭矩伺服电机', supplier: '深圳新元电气', quantity: 120, requiredDate: '2026-07-08', status: '已批准', priority: '高' },
    ],
    rfqs: [
      { id: 'RFQ-26-0046', title: '高扭矩伺服电机补货询价', sourceRequest: 'PR-2026-2401', sourceSku: 'SKU-00412', bestSupplier: '深圳新元电气', suppliers: 3, quoted: 2, due: '2026-07-05', status: '进行中' },
    ],
    purchaseOrders: [
      { po: 'PO-2026-1282', sourceSku: 'SKU-00412', sourceName: '高扭矩伺服电机', sourceRequest: 'PR-2026-2401', sourceRfq: 'RFQ-26-0046', supplier: '深圳新元电气', eta: '2026-07-10', items: 120, received: 20, status: '部分到货', amount: 82000, currency: 'CNY' },
    ],
    receivingDocs: [
      { grn: 'GRN-202605-0418', po: 'PO-2026-1282', supplier: '深圳新元电气', status: '待质检', items: 20, passed: 18, failed: 2 },
    ],
    supplierInvoices: [
      { invoiceNumber: 'INV-SZ-260601', supplier: '深圳新元电气', relatedPo: 'PO-2026-1282', relatedGrn: 'GRN-202605-0418', amount: 82000, currency: 'CNY', varianceAmount: 1200, matchStatus: '存在差异' },
    ],
    inventoryExceptions: [
      { id: 'IEX-1', sku: 'SKU-00412', status: '待复核', quantityImpact: -2, reason: '盘点差异' },
    ],
    exceptionCases: [
      { caseId: 'CASE-PO-1282', sourceEntityId: 'PO-2026-1282', status: 'open', severity: 'high', summary: '采购到货延迟复核' },
    ],
  }
}

function nodeTypes(graph) {
  return new Set(graph.nodes.map((node) => node.type))
}

function nodeIds(graph) {
  return new Set(graph.nodes.map((node) => node.id))
}

test('sales order anchor traces customer order SKU PO supplier receiving invoice and risks', () => {
  const graph = traceSalesOrderEvidence(createDb(), 'SO-2026-0412-A')
  const types = nodeTypes(graph)
  const ids = nodeIds(graph)

  assert.equal(graph.anchor.type, 'customer_order')
  assert.equal(types.has('customer_order'), true)
  assert.equal(types.has('inventory_availability'), true)
  assert.equal(types.has('purchase_order'), true)
  assert.equal(types.has('supplier'), true)
  assert.equal(types.has('receiving_doc'), true)
  assert.equal(types.has('supplier_invoice'), true)
  assert.equal(ids.has('SO-2026-0412-A'), true)
  assert.equal(ids.has('SKU-00412'), true)
  assert.equal(ids.has('PO-2026-1282'), true)
  assert.ok(graph.primaryPath.length >= 4)
  assert.ok(graph.riskSignals.length >= 1)
  assert.ok(Array.isArray(graph.dataLimitations))
})

test('SKU anchor includes affected sales orders linked purchase orders suppliers and receiving docs', () => {
  const graph = traceSkuSupplyDemandEvidence(createDb(), 'SKU-00412')

  assert.equal(graph.anchor.type, 'inventory_availability')
  assert.equal(graph.relatedRecords.salesOrders.some((item) => item.id === 'SO-2026-0412-A'), true)
  assert.equal(graph.relatedRecords.purchaseOrders.some((item) => item.id === 'PO-2026-1282'), true)
  assert.equal(graph.relatedRecords.suppliers.some((item) => item.label === '深圳新元电气'), true)
  assert.equal(graph.relatedRecords.receivingDocs.some((item) => item.id === 'GRN-202605-0418'), true)
  assert.equal(graph.edges.some((edge) => edge.relation === 'supplied_by_po'), true)
})

test('PO anchor includes impacted SKU affected customer orders supplier and receiving docs', () => {
  const graph = tracePurchaseOrderDeliveryImpact(createDb(), 'PO-2026-1282')

  assert.equal(graph.anchor.type, 'purchase_order')
  assert.equal(graph.relatedRecords.inventoryAvailability.some((item) => item.id === 'SKU-00412'), true)
  assert.equal(graph.relatedRecords.salesOrders.some((item) => item.id === 'SO-2026-0412-A'), true)
  assert.equal(graph.relatedRecords.suppliers.some((item) => item.label === '深圳新元电气'), true)
  assert.equal(graph.relatedRecords.receivingDocs.some((item) => item.id === 'GRN-202605-0418'), true)
})

test('supplier anchor includes related purchase orders receiving records and delivery risks', () => {
  const graph = traceSupplierOperationalEvidence(createDb(), '深圳新元电气')

  assert.equal(graph.anchor.type, 'supplier')
  assert.equal(graph.relatedRecords.purchaseOrders.some((item) => item.id === 'PO-2026-1282'), true)
  assert.equal(graph.relatedRecords.receivingDocs.some((item) => item.id === 'GRN-202605-0418'), true)
  assert.equal(graph.relatedRecords.salesOrders.some((item) => item.id === 'SO-2026-0412-A'), true)
})

test('missing anchor returns business data limitation without stack traces', () => {
  const graph = buildEvidenceGraph(createDb(), { entityType: 'sku', entityId: 'SKU-NOT-FOUND' })
  const payload = JSON.stringify(graph)

  assert.equal(graph.dataLimitations.includes('record_not_found'), true)
  assert.doesNotMatch(payload, /stack|trace|demo_data|sample_data|mock_data|fallback_data|uat_data/i)
})

test('graph dedupes nodes and edges', () => {
  const graph = buildEvidenceGraph(createDb(), { entityType: 'sku', entityId: 'SKU-00412' })
  const nodeKeys = graph.nodes.map((node) => `${node.type}:${node.id}`)
  const edgeKeys = graph.edges.map((edge) => `${edge.from}:${edge.relation}:${edge.to}`)

  assert.equal(nodeKeys.length, new Set(nodeKeys).size)
  assert.equal(edgeKeys.length, new Set(edgeKeys).size)
})

test('buildEvidenceGraph and related records are read-only', () => {
  const db = createDb()
  const before = JSON.stringify(db)
  const graph = buildEvidenceGraph(db, { entityType: 'purchase_order', entityId: 'PO-2026-1282' })
  const related = resolveRelatedRecords(db, { entityType: 'purchase_order', entityId: 'PO-2026-1282' })

  assert.equal(JSON.stringify(db), before)
  assert.equal(graph.relatedRecords.purchaseOrders.length > 0, true)
  assert.equal(related.relatedRecords.purchaseOrders.length > 0, true)
})
