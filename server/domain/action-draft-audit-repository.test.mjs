import test from 'node:test'
import assert from 'node:assert/strict'
import { createJsonActionDraftRepository } from '../repositories/json-action-draft-repository.mjs'
import { createAuditLogRepository } from '../repositories/audit-log-repository.mjs'
import { createRepositoryRegistry } from '../repositories/adapter-registry.mjs'
import { handleActionDraftsRoute } from '../routes/action-drafts.routes.mjs'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function createDb() {
  return {
    products: [{ sku: 'SKU-R18', name: 'Round 18 Part', currentStock: 3, safetyStock: 10, reorderPoint: 12, unit: 'pcs', supplier: 'SUP-001', riskLevel: '高' }],
    suppliers: [{ id: 'SUP-001', name: 'ABC Components' }, { id: 'SUP-002', name: 'Delta Plastics' }],
    auditLog: [],
    purchaseRequests: [],
    rfqs: [],
  }
}

function createRouteContext({ body = {}, db = createDb(), repositories } = {}) {
  let response = null
  let wrote = false
  return {
    ctx: {
      req: { method: body ? 'POST' : 'GET', body },
      res: {},
      url: new URL(body ? '/api/action-drafts/preview' : '/api/action-drafts/schema', 'http://localhost'),
      db,
      repositories,
      send(_res, status, payload) {
        response = { status, payload }
      },
      readBody: async (req) => req.body,
      writeDb: async () => { wrote = true },
    },
    get response() {
      return response
    },
    get wrote() {
      return wrote
    },
  }
}

test('ActionDraftRepository exposes schema, validation, and preview-only methods', () => {
  const db = createDb()
  const before = clone(db)
  const repository = createJsonActionDraftRepository(db)

  assert.equal(repository.getSchema().previewOnly, true)
  assert.deepEqual(repository.validateDraft({ type: 'rfq_draft', payload: { itemIdOrSku: 'SKU-R18' } }).missingFields, ['quantity'])

  const pr = repository.previewDraft({ type: 'purchase_request_draft', payload: { itemIdOrSku: 'SKU-R18' } }, { now: new Date('2026-06-30T00:00:00.000Z') })
  const rfq = repository.previewDraft({ type: 'rfq_draft', payload: { itemIdOrSku: 'SKU-R18', quantity: 20 } }, { now: new Date('2026-06-30T00:00:00.000Z') })
  const followup = repository.previewDraft({ type: 'supplier_followup_draft', payload: { supplierIdOrName: 'SUP-001', message: 'Please confirm delivery.' } }, { now: new Date('2026-06-30T00:00:00.000Z') })

  for (const result of [pr, rfq, followup]) {
    assert.equal(result.ok, true)
    assert.equal(result.draft.requiresConfirmation, true)
    assert.equal(result.draft.confirmationBoundary.previewOnly, true)
    assert.equal(result.draft.confirmationBoundary.submitted, false)
  }
  assert.equal(repository.previewDraft({ type: 'unsupported_draft', payload: {} }).status, 'unsupported_type')
  assert.deepEqual(db, before)
})

test('action draft route uses injected repository while preserving response shape', async () => {
  const db = createDb()
  const before = clone(db)
  const repositories = createRepositoryRegistry({ db, env: {} })
  const route = createRouteContext({
    db,
    repositories,
    body: { type: 'rfq_draft', payload: { itemIdOrSku: 'SKU-R18', quantity: 20 } },
  })

  assert.equal(await handleActionDraftsRoute(route.ctx), true)
  assert.equal(route.response.status, 200)
  assert.equal(route.response.payload.previewOnly, true)
  assert.equal(route.response.payload.draft.type, 'rfq_draft')
  assert.equal(route.wrote, false)
  assert.deepEqual(db, before)
})

test('AuditLogRepository filters entries and keeps best-effort AI audit non-throwing', () => {
  const db = createDb()
  const repository = createAuditLogRepository(db)
  const record = repository.recordAuditEntry({
    source: 'system',
    module: 'audit',
    action: 'document_status_changed',
    entity: { type: 'actionDraft', id: 'DRAFT-R18' },
    summary: 'Recorded through repository',
    metadata: { token: 'redacted' },
  }, { now: new Date('2026-06-30T00:00:00.000Z') })

  assert.equal(record.entity.id, 'DRAFT-R18')
  assert.equal(repository.listAuditEntries({ entityType: 'actionDraft' }).length, 1)
  assert.equal(repository.listAuditEntries({ entityId: 'missing' }).length, 0)

  const bestEffort = repository.recordAiEventBestEffort({
    action: 'ai_draft_prepared',
    module: 'ai',
    entity: { type: 'actionDraft', id: 'DRAFT-AI' },
    summary: 'AI audit through repository',
  })
  assert.equal(bestEffort.ok, true)
  assert.equal(repository.listAuditEntries({ entityId: 'DRAFT-AI' }).length, 1)
})
