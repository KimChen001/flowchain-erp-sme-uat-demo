import test from 'node:test'
import assert from 'node:assert/strict'
import {
  findMasterItem,
  findMasterSupplier,
  listMasterItems,
  listMasterSuppliers,
  listMasterWarehouses,
  listPaymentTerms,
  listTaxCodes,
} from './master-data.mjs'
import {
  buildInventoryExceptions,
  buildInventoryItems,
  buildInventoryLots,
  buildInventoryMovements,
  buildInventorySerials,
  buildInventorySummary,
  filterInventoryRows,
  getInventoryItemBySku,
} from './inventory-read.mjs'
import {
  buildProcurementDocumentLinks,
  buildProcurementDocuments,
  buildProcurementFollowups,
  buildProcurementSummary,
  getProcurementDocument,
  normalizeProcurementDocumentType,
} from './procurement-read-model.mjs'
import { buildTodayCockpit } from './today-cockpit-read-model.mjs'
import { actionDraftSchema, buildActionDraftSuggestion } from './action-draft-boundary.mjs'
import { buildPurchaseRequestDraftPreview } from './purchase-request-draft-preview.mjs'
import { buildRfqDraftPreview, buildSupplierFollowupDraftPreview } from './rfq-and-supplier-followup-draft-preview.mjs'
import { listAuditEvents, recordAuditEvent } from '../repositories/audit-log-repository.mjs'
import { buildAiCockpitFastPathResponse, buildAiEvidenceReuseResponse } from './ai-evidence-reuse.mjs'
import { getAiProviderSafetyState } from './ai-provider-safety.mjs'
import {
  assertNoMutation,
  deepCloneFixture,
  expectCanonicalEvidence,
  expectNoSecrets,
  expectNoStackTrace,
  expectPreviewOnly,
  expectStableTopLevelFields,
  loadDemoDbSnapshot,
} from './json-adapter-contract-helpers.test.mjs'

const DEMO_NOW = '2026-06-30T00:00:00.000Z'

function withSnapshot(assertions) {
  const db = loadDemoDbSnapshot()
  const before = deepCloneFixture(db)
  const result = assertions(db)
  assertNoMutation(before, db)
  return result
}

function firstByDocumentType(documents, type) {
  return documents.find((item) => item.documentType === type)
}

function payloadText(value) {
  return JSON.stringify(value)
}

test('JSON adapter contract: master data reads stable reference shapes without mutation', () => {
  withSnapshot((db) => {
    const items = listMasterItems(db)
    const suppliers = listMasterSuppliers(db)
    const warehouses = listMasterWarehouses(db)
    const paymentTerms = listPaymentTerms(db)
    const taxCodes = listTaxCodes(db)

    assert.ok(items.length > 0)
    assert.ok(suppliers.length > 0)
    assert.equal(items.every((item) => item.id && item.sku && item.name && item.status), true)
    assert.equal(suppliers.every((supplier) => supplier.id && supplier.name && supplier.status), true)
    assert.equal(warehouses.every((warehouse) => warehouse.id && warehouse.name && warehouse.sourceType), true)
    assert.equal(paymentTerms.every((term) => term.id && typeof term.days === 'number'), true)
    assert.equal(taxCodes.every((code) => code.id && typeof code.rate === 'number'), true)

    const sampleItem = items[0]
    assert.deepEqual(findMasterItem(db, sampleItem.id), sampleItem)
    assert.deepEqual(findMasterItem(db, sampleItem.sku), sampleItem)
    assert.equal(findMasterItem(db, 'MISSING-SKU'), null)

    const sampleSupplier = suppliers[0]
    assert.deepEqual(findMasterSupplier(db, sampleSupplier.id), sampleSupplier)
    assert.deepEqual(findMasterSupplier(db, sampleSupplier.name), sampleSupplier)
    assert.equal(findMasterSupplier(db, 'MISSING-SUPPLIER'), null)
  })
})

test('JSON adapter contract: inventory read model exposes item, lot, serial, movement, exception, and summary shapes', () => {
  withSnapshot((db) => {
    const items = buildInventoryItems(db)
    const movements = buildInventoryMovements(db)
    const exceptions = buildInventoryExceptions(db)
    const summary = buildInventorySummary(db)
    const lots = buildInventoryLots(db)
    const serials = buildInventorySerials(db)

    assert.ok(items.length > 0)
    assert.equal(items.every((item) => item.sku && item.itemName && typeof item.availableQuantity === 'number'), true)
    assert.equal(movements.every((movement) => movement.movementId && movement.movementType && typeof movement.quantityIn === 'number'), true)
    assert.equal(exceptions.every((item) => item.id && item.type && item.status), true)
    assert.equal(lots.every((lot) => lot.lotId && typeof lot.quantity === 'number'), true)
    assert.equal(serials.every((serial) => serial.serialId && serial.status), true)
    assert.deepEqual(Object.keys(summary), ['itemCount', 'lowStockCount', 'highRiskCount', 'movementCount', 'exceptionCount', 'lotCount', 'serialCount'])

    const sample = items[0]
    assert.deepEqual(getInventoryItemBySku(db, sample.sku), sample)
    assert.equal(getInventoryItemBySku(db, 'MISSING-SKU'), null)
    assert.ok(filterInventoryRows(items, { q: sample.sku, limit: 1 }).length <= 1)
    expectNoSecrets({ items, movements, exceptions, summary })
    expectNoStackTrace({ items, movements, exceptions, summary })
  })
})

test('JSON adapter contract: inventory read model handles missing arrays safely', () => {
  const minimal = {}
  assert.deepEqual(buildInventoryItems(minimal), [])
  assert.deepEqual(buildInventoryMovements(minimal), [])
  assert.deepEqual(buildInventoryLots(minimal), [])
  assert.deepEqual(buildInventorySerials(minimal), [])
  assert.deepEqual(buildInventoryExceptions(minimal), [])
  assert.deepEqual(buildInventorySummary(minimal), {
    itemCount: 0,
    lowStockCount: 0,
    highRiskCount: 0,
    movementCount: 0,
    exceptionCount: 0,
    lotCount: 0,
    serialCount: 0,
  })
})

test('JSON adapter contract: procurement read model normalizes canonical document types and lookups', () => {
  withSnapshot((db) => {
    const documents = buildProcurementDocuments(db)
    const links = buildProcurementDocumentLinks(db)
    const followups = buildProcurementFollowups(db, { now: DEMO_NOW })
    const summary = buildProcurementSummary(db)
    const expectedTypes = new Set(['pr', 'rfq', 'po', 'grn'])

    assert.ok(documents.length > 0)
    assert.ok([...expectedTypes].every((type) => documents.some((item) => item.documentType === type)))
    assert.equal(documents.every((document) => document.id && document.documentType && document.title && Array.isArray(document.evidence)), true)
    assert.equal(links.every((link) => link.sourceType && link.sourceId && link.targetType && link.targetId), true)
    assert.equal(followups.every((item) => item.id && item.type && item.documentType && item.documentId), true)
    assert.deepEqual(Object.keys(summary), [
      'documentCount',
      'purchaseRequestCount',
      'rfqCount',
      'purchaseOrderCount',
      'receivingDocCount',
      'supplierInvoiceCount',
      'threeWayMatchCount',
      'followupCount',
      'highSeverityFollowupCount',
      'openPrCount',
      'activeRfqCount',
      'openPoCount',
      'pendingReceivingCount',
      'invoiceExceptionCount',
      'threeWayMatchExceptionCount',
      'totalOpenAmount',
      'currency',
      'urgentFollowupCount',
    ])

    for (const type of ['pr', 'rfq', 'po', 'grn', 'invoice', 'threeWayMatch']) {
      const sample = firstByDocumentType(documents, type)
      if (sample) assert.deepEqual(getProcurementDocument(db, type, sample.id), sample)
    }
    assert.equal(normalizeProcurementDocumentType('purchase-order'), 'po')
    assert.equal(normalizeProcurementDocumentType('3wm'), 'threeWayMatch')
    assert.equal(getProcurementDocument(db, 'invalid-type', 'DOC-1'), null)
    assert.equal(getProcurementDocument(db, 'po', 'MISSING-PO'), null)
    expectNoSecrets({ documents, links, followups, summary })
    expectNoStackTrace({ documents, links, followups, summary })
  })
})

test('JSON adapter contract: today cockpit aggregation is deterministic and draft-first', () => {
  withSnapshot((db) => {
    const first = buildTodayCockpit(db, { now: DEMO_NOW })
    const second = buildTodayCockpit(db, { now: DEMO_NOW })

    assert.deepEqual(first, second)
    expectStableTopLevelFields(first, [
      'summary',
      'cards',
      'followups',
      'salesRisks',
      'allocationRisks',
      'inventoryRisks',
      'recentDocuments',
      'recentMovements',
      'recommendedActions',
      'evidence',
    ])
    assert.equal(first.cards.length, 12)
    assert.equal(first.recommendedActions.every((item) => item.id && item.nextAction && item.route !== undefined), true)
    for (const group of Object.values(first.evidence)) {
      for (const item of Array.isArray(group) ? group : []) {
        if (item?.type && item?.id) expectCanonicalEvidence(item)
      }
    }
    assert.equal(payloadText(first).includes('previewOnly":false'), false)
    expectNoSecrets(first)
    expectNoStackTrace(first)
  })
})

test('JSON adapter contract: action draft previews are review-only and non-mutating', () => {
  withSnapshot((db) => {
    const item = buildInventoryItems(db)[0]
    const supplier = listMasterSuppliers(db)[0]
    const schema = actionDraftSchema()
    const generic = buildActionDraftSuggestion({
      type: 'inventory_exception_closure_draft',
      payload: { exceptionId: 'IEX-CONTRACT', resolution: 'Review stock adjustment evidence' },
    }, { now: new Date(DEMO_NOW) })
    const pr = buildPurchaseRequestDraftPreview({
      type: 'purchase_request_draft',
      payload: { itemIdOrSku: item.sku },
    }, { db, now: new Date(DEMO_NOW) })
    const rfq = buildRfqDraftPreview({
      type: 'rfq_draft',
      payload: { itemIdOrSku: item.sku, quantity: 10 },
    }, { db, now: new Date(DEMO_NOW) })
    const followup = buildSupplierFollowupDraftPreview({
      type: 'supplier_followup_draft',
      payload: { supplierIdOrName: supplier.id, message: 'Please confirm open delivery risk.' },
    }, { db, now: new Date(DEMO_NOW) })
    const unsupported = buildActionDraftSuggestion({ type: 'autonomous_payment', payload: {} })
    const missing = buildActionDraftSuggestion({ type: 'po_followup_draft', payload: { poId: 'PO-ONLY' } })

    assert.equal(schema.previewOnly, true)
    assert.ok(schema.supportedTypes.map((type) => type.type).includes('supplier_followup_draft'))
    assert.equal(generic.ok, true)
    assert.equal(pr.ok, true)
    assert.equal(rfq.ok, true)
    assert.equal(followup.ok, true)
    expectPreviewOnly(generic)
    expectPreviewOnly(pr)
    expectPreviewOnly(rfq)
    expectPreviewOnly(followup)
    assert.equal(unsupported.ok, false)
    assert.equal(unsupported.status, 'unsupported_type')
    assert.equal(missing.draft.validation.status, 'needs_review')
    assert.equal(payloadText({ pr, rfq, followup }).includes('submitted":true'), false)
  })
})

test('JSON adapter contract: audit log lists and records safe entries without leaking secrets', () => {
  const db = { auditLog: [] }
  const before = deepCloneFixture(db)
  assert.deepEqual(listAuditEvents(db), [])
  assert.deepEqual(before.auditLog, [])

  const record = recordAuditEvent(db, {
    source: 'ai_assisted',
    action: 'ai_chat_requested',
    module: 'ai',
    entity: { type: 'conversation', id: 'CONTRACT-AI' },
    summary: 'AI contract audit record',
    metadata: { provider: 'local' },
  }, { now: new Date(DEMO_NOW) })

  assert.equal(record.source, 'ai_assisted')
  assert.equal(record.action, 'ai_chat_requested')
  assert.equal(listAuditEvents(db)[0].id, record.id)
  expectNoSecrets(db.auditLog)
  expectNoStackTrace(db.auditLog)
})

test('JSON adapter contract: AI evidence reuse and provider-disabled fallback stay deterministic and safe', () => {
  withSnapshot((db) => {
    const body = { question: '今天工作台优先处理什么？', moduleId: 'overview' }
    const first = buildAiCockpitFastPathResponse(db, body, {})
    const second = buildAiEvidenceReuseResponse(db, body, {})
    const providerSafety = getAiProviderSafetyState({
      AI_PROVIDER_ENABLED: 'false',
      OPENAI_API_KEY: 'sk-contract-fake',
      ARK_API_KEY: 'sk-contract-fake',
      DOUBAO_API_KEY: 'sk-contract-fake',
    })

    assert.ok(first)
    assert.deepEqual(first, second)
    assert.equal(first.provider, 'local')
    assert.equal(first.mode, 'deterministic')
    assert.equal(first.readModelReuse, true)
    assert.ok(first.evidence.length > 0)
    first.evidence.forEach(expectCanonicalEvidence)
    assert.equal(providerSafety.enabled, false)
    expectNoSecrets({ first, providerSafety })
    expectNoStackTrace({ first, providerSafety })
  })
})
