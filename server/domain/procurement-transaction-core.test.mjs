import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  assertSafeProcurementTransition,
  canTransitionProcurementStatus,
  normalizeProcurementStatus,
  PROCUREMENT_STATUS_GROUPS,
} from './procurement-status-model.mjs'
import {
  buildAwardRecommendationDraft,
  buildOperationalPurchaseRequestDetail,
  buildPoDraftFromAwardRecommendation,
  buildRfqDraftFromPurchaseRequest,
  buildSupplierResponse,
  compareSupplierResponses,
  PROCUREMENT_TRANSACTION_BASELINE,
} from './procurement-transaction-core.mjs'
import { createInMemoryProcurementTransactionRepository } from '../repositories/procurement-transaction-repository.mjs'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')

function readSource(...parts) {
  return fs.readFileSync(path.join(repoRoot, ...parts), 'utf8')
}

function createDb() {
  return {
    suppliers: [
      { code: 'SUP-A', name: 'Fast Precision', riskStatus: '低' },
      { code: 'SUP-B', name: 'Cheap Risky', riskStatus: '高' },
      { code: 'SUP-C', name: 'Balanced Supply', riskStatus: '中' },
    ],
    purchaseRequests: [
      {
        pr: 'PR-TX-1',
        status: '已批准',
        requester: 'Buyer A',
        sourceSku: 'SKU-TX',
        sourceName: 'Motor TX',
        quantity: 100,
        requiredDate: '2026-07-20',
        reason: 'Line replenishment',
        source: 'ai_assisted_draft',
        approvalSnapshot: { source: 'ai_assisted_draft', createdAt: '2026-07-03T00:00:00Z' },
      },
    ],
    rfqs: [{ id: 'RFQ-TX-1', sourceRequest: 'PR-TX-1', status: '进行中', title: 'Motor TX RFQ' }],
    purchaseOrders: [],
  }
}

test('R261 baseline documents inspected procurement transaction boundaries and current gaps', () => {
  assert.ok(PROCUREMENT_TRANSACTION_BASELINE.inspectedFiles.includes('server/domain/user-confirmed-business-action.mjs'))
  assert.equal(PROCUREMENT_TRANSACTION_BASELINE.chosenBoundaries.poDraft.includes('never issue'), true)
  assert.ok(PROCUREMENT_TRANSACTION_BASELINE.currentGaps.some((item) => /Supplier responses/.test(item)))
})

test('R262 procurement status model normalizes valid statuses and rejects invalid states', () => {
  assert.deepEqual(PROCUREMENT_STATUS_GROUPS.purchaseRequest, ['draft', 'requested', 'pending_review', 'needs_info', 'converted_to_rfq', 'cancelled'])
  assert.equal(normalizeProcurementStatus('purchaseRequest', '已批准'), 'requested')
  assert.equal(normalizeProcurementStatus('sourcingEvent', '比价中'), 'response_review')
  assert.equal(normalizeProcurementStatus('supplierResponse', 'received'), 'received')
  assert.equal(canTransitionProcurementStatus('purchaseRequest', 'requested', 'converted_to_rfq'), true)
  assert.equal(canTransitionProcurementStatus('poDraft', 'draft', 'ready_for_manual_issue'), false)
  assert.throws(() => normalizeProcurementStatus('purchaseRequest', 'approved_and_submitted'), /Invalid purchaseRequest status/)
  assert.throws(() => assertSafeProcurementTransition('sourcingEvent', 'draft', 'award_recommended'), /Unsafe sourcingEvent status transition/)
})

test('R263 PR operational detail exposes missing fields provenance linked RFQ and review-first actions', () => {
  const detail = buildOperationalPurchaseRequestDetail(createDb().purchaseRequests[0], { rfqs: createDb().rfqs })
  assert.equal(detail.id, 'PR-TX-1')
  assert.equal(detail.status, 'needs_info')
  assert.deepEqual(detail.missingFields.sort(), ['costCenter', 'warehouse'])
  assert.equal(detail.linkedSourcingRecords[0].id, 'RFQ-TX-1')
  assert.equal(detail.contextualActions.every((item) => item.reviewFirst), true)
  assert.equal(detail.sideEffects.submitsPr, false)
  assert.equal(detail.sideEffects.approvesPr, false)

  const confirmed = buildOperationalPurchaseRequestDetail({
    userConfirmedCreation: true,
    auditEventId: 'AUD-1',
    createdRecord: {
      id: 'PR-DRAFT-000001',
      status: 'draft',
      fields: { sku: 'SKU-C', quantity: 12, requiredDate: '2026-07-22' },
      provenance: { createdFromAiAssistedDraft: true, draftId: 'DRAFT-1', confirmedBy: 'user-a' },
    },
  })
  assert.equal(confirmed.audit.createdFromAiAssistedDraft, true)
  assert.equal(confirmed.audit.userConfirmedCreation, true)
  assert.equal(confirmed.audit.auditEventId, 'AUD-1')
})

test('R264 PR to RFQ draft creation requires confirmation and never sends awards or creates PO', () => {
  const detail = buildOperationalPurchaseRequestDetail(createDb().purchaseRequests[0])
  const rejected = buildRfqDraftFromPurchaseRequest(detail, { responseDeadline: '2026-07-10' })
  assert.equal(rejected.ok, false)
  assert.ok(rejected.validation.errors.some((item) => item.code === 'missing_confirmation'))

  const accepted = buildRfqDraftFromPurchaseRequest(detail, { confirm: true, responseDeadline: '2026-07-10', actor: 'buyer-a' })
  assert.equal(accepted.ok, true)
  assert.equal(accepted.record.status, 'internal_review')
  assert.equal(accepted.record.sourcePrId, 'PR-TX-1')
  assert.equal(accepted.sideEffects.sendsRfqExternally, false)
  assert.equal(accepted.sideEffects.awardsSupplier, false)
  assert.equal(accepted.sideEffects.createsIssuedPo, false)
})

test('R265 supplier response internal model represents missing fields and blocks unlinked response', async () => {
  const response = buildSupplierResponse({ rfqId: 'RFQ-TX-1', supplierName: 'Fast Precision', quotedPrice: 120, quantityOffered: 100 })
  assert.equal(response.status, 'incomplete')
  assert.ok(response.missingFields.includes('leadTimeDays'))
  assert.equal(response.sideEffects.mutatesSupplierMaster, false)
  assert.equal(response.sideEffects.createsIssuedPo, false)

  const repo = createInMemoryProcurementTransactionRepository({ db: createDb() })
  await assert.rejects(
    () => repo.createSupplierResponse({ supplierName: 'No Link', quotedPrice: 100, leadTimeDays: 5 }),
    (error) => error.code === 'SUPPLIER_RESPONSE_REQUIRES_RFQ'
  )
})

test('R266 supplier response comparison is deterministic and balances price lead time risk and completeness', () => {
  const db = createDb()
  const responses = [
    buildSupplierResponse({ id: 'RESP-A', rfqId: 'RFQ-TX-1', supplierId: 'SUP-A', supplierName: 'Fast Precision', quotedPrice: 128, quantityOffered: 100, leadTimeDays: 5 }),
    buildSupplierResponse({ id: 'RESP-B', rfqId: 'RFQ-TX-1', supplierId: 'SUP-B', supplierName: 'Cheap Risky', quotedPrice: 80, quantityOffered: 100, leadTimeDays: 30 }),
    buildSupplierResponse({ id: 'RESP-C', rfqId: 'RFQ-TX-1', supplierId: 'SUP-C', supplierName: 'Balanced Supply', quotedPrice: 112, quantityOffered: 80 }),
  ]
  const comparison = compareSupplierResponses(responses, { suppliers: db.suppliers })
  assert.equal(comparison.deterministic, true)
  assert.equal(comparison.rankedResponses[0].id, 'RESP-A')
  assert.ok(comparison.rankedResponses.find((item) => item.id === 'RESP-B').riskFlags.includes('high_supplier_risk'))
  assert.ok(comparison.rankedResponses.find((item) => item.id === 'RESP-C').riskFlags.includes('incomplete_response'))
  assert.deepEqual(comparison.rankedResponses.map((item) => item.id), compareSupplierResponses(responses, { suppliers: db.suppliers }).rankedResponses.map((item) => item.id))
})

test('R267-R268 award recommendation and PO draft remain draft-only review-first without mutation side effects', () => {
  const responses = [
    buildSupplierResponse({ id: 'RESP-A', rfqId: 'RFQ-TX-1', supplierName: 'Fast Precision', quotedPrice: 128, quantityOffered: 100, leadTimeDays: 5 }),
    buildSupplierResponse({ id: 'RESP-B', rfqId: 'RFQ-TX-1', supplierName: 'Cheap Risky', quotedPrice: 80, quantityOffered: 100, leadTimeDays: 30, riskStatus: '高' }),
  ]
  const recommendation = buildAwardRecommendationDraft({ rfqId: 'RFQ-TX-1', comparison: compareSupplierResponses(responses, { suppliers: createDb().suppliers }) })
  assert.equal(recommendation.reviewStatus, 'review_required')
  assert.equal(recommendation.boundary.doesNotAwardSupplier, true)
  assert.equal(recommendation.boundary.doesNotCreatePo, true)
  assert.match(recommendation.auditPreview[0].summary, /Draft Only/)
  assert.equal(recommendation.sideEffects.awardsSupplier, false)

  const poDraft = buildPoDraftFromAwardRecommendation(recommendation, { sourcePr: 'PR-TX-1', taxCode: 'VAT13', deliveryLocation: 'WH-A' })
  assert.equal(poDraft.type, 'poDraft')
  assert.equal(poDraft.boundary.notIssued, true)
  assert.equal(poDraft.boundary.notSent, true)
  assert.equal(poDraft.boundary.notApproved, true)
  assert.equal(poDraft.sideEffects.issuesPo, false)
  assert.equal(poDraft.sideEffects.sendsSupplierNotification, false)
  assert.equal(poDraft.sideEffects.mutatesInventoryBalance, false)
})

test('R270 guardrails preserve confirmed action boundary provider-free UI and R250 cleanup', async () => {
  const confirmedBoundary = readSource('server', 'domain', 'user-confirmed-business-action.mjs')
  const shell = readSource('src', 'modules', 'action-drafts', 'ActionDraftReviewShell.tsx')
  const app = readSource('src', 'app', 'FlowChainApp.tsx')
  const relationships = readSource('src', 'domain', 'relationships', 'resolver.ts')
  const prPage = readSource('src', 'modules', 'purchase-requests', 'Page.tsx')
  const rfqPage = readSource('src', 'modules', 'rfq', 'Page.tsx')
  const allSource = [
    readSource('server', 'domain', 'procurement-transaction-core.mjs'),
    readSource('server', 'routes', 'procurement-transactions.routes.mjs'),
    readSource('server', 'repositories', 'procurement-transaction-repository.mjs'),
  ].join('\n')

  assert.match(confirmedBoundary, /send_rfq/)
  assert.match(confirmedBoundary, /issue_po/)
  assert.match(confirmedBoundary, /award_supplier/)
  assert.match(shell, /用户确认后也只保留允许范围内的安全内部记录/)
  assert.doesNotMatch(shell, /future work/)
  assert.doesNotMatch(app, /AI Command Center|AI Assistant<\/|standalone-ai/i)
  assert.match(prPage, /\/api\/procurement\/rfq-drafts\/from-pr/)
  assert.match(prPage, /PR → RFQ → Supplier Response → Award Recommendation → PO Draft/)
  assert.match(prPage, /no external RFQ send, no supplier award, no PO issue/)
  assert.doesNotMatch(prPage, /\/api\/rfqs",\s*\{\s*method:\s*"POST"/)
  assert.match(rfqPage, /\/api\/procurement\/award-recommendations\/draft/)
  assert.match(rfqPage, /Preview Award Recommendation/)
  assert.match(rfqPage, /PO Draft Preview/)
  assert.match(rfqPage, /no external send, no award mutation, no PO issue/)
  assert.doesNotMatch(allSource, /OPENAI_API_KEY|ARK_API_KEY|sk-[A-Za-z0-9]/)
  assert.doesNotMatch(allSource, /sendExternalEmail\s*:\s*true|issuesPo\s*:\s*true|awardsSupplier\s*:\s*true|postsInventory\s*:\s*true/)
  assert.doesNotMatch(allSource, /SKU-00412.*exception/i)
  assert.match(relationships, /resolveEntityRelationships/)
  assert.doesNotMatch(relationships, /fetch\(|apiJson|POST|PATCH/)
})
