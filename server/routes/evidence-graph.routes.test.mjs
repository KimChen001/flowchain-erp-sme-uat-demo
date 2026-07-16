import test from 'node:test'
import assert from 'node:assert/strict'
import { handleEvidenceGraphRoute } from './evidence-graph.routes.mjs'

function createDb() {
  return {
    __dataMode: 'workspace',
    products: [{ sku: 'SKU-00412', name: '高扭矩伺服电机', currentStock: 34, reservedQuantity: 36, safetyStock: 50, supplier: '深圳新元电气', status: '低库存', riskLevel: '高' }],
    suppliers: [{ id: 'SUP-SZXY', name: '深圳新元电气', status: 'active', risk: 'medium' }],
    salesOrders: [{ salesOrderId: 'SO-2026-0412-A', customerName: '华东精密制造', sku: 'SKU-00412', itemName: '高扭矩伺服电机', orderedQty: 120, reservedQty: 36, promisedDate: '2026-07-12', priority: '高', linkedPurchaseOrders: ['PO-2026-1282'], linkedSuppliers: ['深圳新元电气'], status: 'shortage_risk' }],
    purchaseRequests: [{ pr: 'PR-2026-2401', sourceSku: 'SKU-00412', supplier: '深圳新元电气', quantity: 120, status: '已批准' }],
    rfqs: [{ id: 'RFQ-26-0046', sourceRequest: 'PR-2026-2401', sourceSku: 'SKU-00412', bestSupplier: '深圳新元电气', status: '进行中' }],
    purchaseOrders: [{ po: 'PO-2026-1282', sourceSku: 'SKU-00412', sourceRequest: 'PR-2026-2401', sourceRfq: 'RFQ-26-0046', supplier: '深圳新元电气', eta: '2026-07-10', items: 120, received: 20, status: '部分到货' }],
    receivingDocs: [{ grn: 'GRN-202605-0418', po: 'PO-2026-1282', supplier: '深圳新元电气', status: '待质检' }],
    supplierInvoices: [{ invoiceNumber: 'INV-SZ-260601', supplier: '深圳新元电气', relatedPo: 'PO-2026-1282', relatedGrn: 'GRN-202605-0418', amount: 82000, varianceAmount: 1200, matchStatus: '存在差异' }],
  }
}

function createRoute(method, path, db = createDb()) {
  let response = null
  return {
    ctx: {
      req: { method },
      res: {},
      url: new URL(path, 'http://localhost'),
      db,
      send(_res, status, payload) {
        response = { status, payload }
      },
    },
    get response() {
      return response
    },
  }
}

test('GET /api/evidence-graph builds read-only graph by query anchor', async () => {
  const route = createRoute('GET', '/api/evidence-graph?entityType=sales_order&entityId=SO-2026-0412-A&depth=2')
  const handled = await handleEvidenceGraphRoute(route.ctx)

  assert.equal(handled, true)
  assert.equal(route.response.status, 200)
  assert.equal(route.response.payload.anchor.id, 'SO-2026-0412-A')
  assert.equal(route.response.payload.nodes.some((node) => node.id === 'SKU-00412'), true)
  assert.equal(route.response.payload.edges.some((edge) => edge.relation === 'references_item'), true)
  assert.ok(route.response.payload.nodes.every((node) => node.entityType && node.entityId && node.canonicalRoute && node.sourceRepository))
})

test('evidence graph shortcut routes return expected related records', async () => {
  const route = createRoute('GET', '/api/evidence-graph/purchase-order/PO-2026-1282')
  await handleEvidenceGraphRoute(route.ctx)

  assert.equal(route.response.status, 200)
  assert.equal(route.response.payload.relatedRecords.purchaseRequests.some((item) => item.id === 'PR-2026-2401'), true)
  assert.equal(route.response.payload.relatedRecords.receivingDocs.some((item) => item.id === 'GRN-202605-0418'), true)
})

test('GET /api/evidence-graph/related returns compact related records', async () => {
  const route = createRoute('GET', '/api/evidence-graph/related?entityType=sku&entityId=SKU-00412')
  await handleEvidenceGraphRoute(route.ctx)

  assert.equal(route.response.status, 200)
  assert.equal(route.response.payload.relatedRecords.salesOrders.some((item) => item.id === 'SO-2026-0412-A'), true)
  assert.equal(route.response.payload.relatedRecords.inventoryItems.some((item) => item.id === 'SKU-00412'), true)
  assert.ok(Array.isArray(route.response.payload.nodes))
})

test('evidence graph missing anchor returns 404 with business limitation', async () => {
  const route = createRoute('GET', '/api/evidence-graph/sku/SKU-NOT-FOUND')
  await handleEvidenceGraphRoute(route.ctx)

  assert.equal(route.response.status, 404)
  assert.deepEqual(route.response.payload.dataLimitations, ['record_not_found'])
  assert.doesNotMatch(JSON.stringify(route.response.payload), /stack|trace|DATABASE_URL/)
})

test('evidence graph routes are GET-only and non-mutating', async () => {
  const db = createDb()
  const before = JSON.stringify(db)
  const route = createRoute('POST', '/api/evidence-graph', db)
  const handled = await handleEvidenceGraphRoute(route.ctx)

  assert.equal(handled, true)
  assert.equal(route.response.status, 405)
  assert.equal(JSON.stringify(db), before)
})
