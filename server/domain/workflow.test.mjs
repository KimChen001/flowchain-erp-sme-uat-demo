import test from 'node:test'
import assert from 'node:assert/strict'
import { applyWorkflowTransition, recordWorkflowCreation } from './workflow.mjs'

function createDb() {
  return { auditLog: [] }
}

test('PR workflow transitions from draft to converted PO', () => {
  const db = createDb()
  const pr = { pr: 'PR-T-001', status: '草稿' }
  recordWorkflowCreation(db, 'purchaseRequest', pr)
  applyWorkflowTransition(db, 'purchaseRequest', pr, '待审批')
  applyWorkflowTransition(db, 'purchaseRequest', pr, '已批准')
  applyWorkflowTransition(db, 'purchaseRequest', pr, '已转PO')
  assert.equal(pr.status, '已转PO')
  assert.equal(db.auditLog.length, 4)
})

test('PO workflow transitions through approval, issue, receipt, and completion', () => {
  const db = createDb()
  const po = { po: 'PO-T-001', status: '待审批' }
  recordWorkflowCreation(db, 'purchaseOrder', po)
  applyWorkflowTransition(db, 'purchaseOrder', po, '已审批')
  applyWorkflowTransition(db, 'purchaseOrder', po, '已发出')
  applyWorkflowTransition(db, 'purchaseOrder', po, '部分到货')
  applyWorkflowTransition(db, 'purchaseOrder', po, '已完成')
  assert.equal(po.status, '已完成')
  assert.equal(db.auditLog.length, 5)
})

test('RFQ workflow transitions from active to converted PO', () => {
  const db = createDb()
  const rfq = { id: 'RFQ-T-001', status: '进行中' }
  recordWorkflowCreation(db, 'rfq', rfq)
  applyWorkflowTransition(db, 'rfq', rfq, '比价中')
  applyWorkflowTransition(db, 'rfq', rfq, '已授标')
  applyWorkflowTransition(db, 'rfq', rfq, '已转PO')
  assert.equal(rfq.status, '已转PO')
  assert.equal(db.auditLog.length, 4)
})

test('GRN workflow transitions from pending receipt to posted inbound', () => {
  const db = createDb()
  const grn = { grn: 'GRN-T-001', status: '待收货' }
  recordWorkflowCreation(db, 'receivingDoc', grn)
  applyWorkflowTransition(db, 'receivingDoc', grn, '质检中')
  applyWorkflowTransition(db, 'receivingDoc', grn, '已入库')
  assert.equal(grn.status, '已入库')
  assert.equal(db.auditLog.length, 3)
})
