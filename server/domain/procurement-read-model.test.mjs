import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildProcurementDocumentLinks,
  buildProcurementDocuments,
  buildProcurementFollowups,
  buildProcurementSummary,
  filterProcurementRows,
  getProcurementDocument,
} from './procurement-read-model.mjs'

const fixture = {
  purchaseRequests: [
    {
      pr: 'PR-2026-2400',
      sourceSku: 'SKU-00287',
      sourceName: '铝合金型材 6063',
      supplier: '江苏铝合金集团',
      requester: '张磊',
      buyer: '王志强',
      requiredDate: '2026-07-05',
      quantity: 1000,
      unitPrice: 142,
      amount: 142000,
      status: '已批准',
      linkedPo: 'PO-2026-1301',
    },
  ],
  rfqs: [
    {
      id: 'RFQ-26-0047',
      title: 'SKU-00287 采购询价',
      suppliers: 3,
      quoted: 1,
      due: '2026-06-20',
      status: '进行中',
      sourceRequest: 'PR-2026-2400',
      linkedPo: 'PO-2026-1301',
    },
  ],
  purchaseOrders: [
    {
      po: 'PO-2026-1301',
      supplier: '江苏铝合金集团',
      eta: '2026-06-12',
      owner: '王志强',
      amount: 142000,
      items: 1000,
      received: 400,
      status: '已发出',
      sourceRequest: 'PR-2026-2400',
      sourceRfq: 'RFQ-26-0047',
    },
  ],
  receivingDocs: [
    {
      grn: 'GRN-202606-0430',
      po: 'PO-2026-1301',
      supplier: '江苏铝合金集团',
      status: '已入库',
      items: 400,
      passed: 390,
      failed: 10,
      warehouse: 'A 区',
    },
  ],
  supplierInvoices: [
    {
      invoiceNumber: 'INV-JS-260620',
      supplier: '江苏铝合金集团',
      relatedPo: 'PO-2026-1301',
      relatedGrn: 'GRN-202606-0430',
      amount: 142000,
      varianceAmount: 8600,
      matchStatus: '存在差异',
    },
  ],
}

test('procurement read model builds stable document rows', () => {
  const documents = buildProcurementDocuments(fixture)
  assert.equal(documents.some((row) => row.type === 'purchase_request' && row.id === 'PR-2026-2400'), true)
  assert.equal(documents.some((row) => row.type === 'three_way_match' && row.id === 'MATCH-INV-JS-260620'), true)
  const po = documents.find((row) => row.id === 'PO-2026-1301')
  assert.equal(po.amount, 142000)
  assert.equal(po.receivingStatus, '部分收货')
})

test('procurement document links preserve upstream and downstream references', () => {
  const links = buildProcurementDocumentLinks(fixture)
  assert.deepEqual(
    links.find((link) => link.sourceId === 'PR-2026-2400' && link.targetId === 'PO-2026-1301'),
    { sourceType: 'purchase_request', sourceId: 'PR-2026-2400', targetType: 'purchase_order', targetId: 'PO-2026-1301', relation: 'converted_po' }
  )
  assert.equal(links.some((link) => link.sourceId === 'PO-2026-1301' && link.targetId === 'GRN-202606-0430'), true)
})

test('procurement followups capture overdue POs, pending RFQs, and invoice variance', () => {
  const followups = buildProcurementFollowups(fixture, { now: '2026-06-29T00:00:00Z' })
  assert.equal(followups.some((item) => item.type === 'overdue_po' && item.documentId === 'PO-2026-1301'), true)
  assert.equal(followups.some((item) => item.type === 'pending_rfq_response' && item.documentId === 'RFQ-26-0047'), true)
  assert.equal(followups.some((item) => item.type === 'invoice_variance' && item.documentId === 'INV-JS-260620'), true)
})

test('procurement lookup and filters support API read paths', () => {
  assert.equal(getProcurementDocument(fixture, 'purchase_order', 'PO-2026-1301')?.supplier, '江苏铝合金集团')
  const filtered = filterProcurementRows(buildProcurementDocuments(fixture), { q: 'SKU-00287', type: 'purchase_request' })
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0].id, 'PR-2026-2400')
})

test('procurement summary counts each read-model family', () => {
  assert.deepEqual(buildProcurementSummary(fixture), {
    documentCount: 6,
    purchaseRequestCount: 1,
    rfqCount: 1,
    purchaseOrderCount: 1,
    receivingDocCount: 1,
    supplierInvoiceCount: 1,
    threeWayMatchCount: 1,
    followupCount: 3,
    highSeverityFollowupCount: 2,
  })
})
