import test from 'node:test'
import assert from 'node:assert/strict'
import { createScmServer } from '../routes/scm-legacy.routes.mjs'
import { handleAiRoute } from '../routes/ai.routes.mjs'
import { handleContextRoute } from '../routes/context.routes.mjs'
import { normalizeAuditEvent } from './audit-foundation.mjs'
import { getAiToolRegistry } from './ai-tool-registry.mjs'
import { listAuditEvents, recordAuditEvent } from '../repositories/audit-log-repository.mjs'

function createRouteContext(method, pathname, options = {}) {
  let response = null
  return {
    ctx: {
      req: {
        method,
        headers: options.headers || {},
      },
      res: {},
      url: new URL(pathname, 'http://localhost'),
      db: options.db || {},
      send(_res, status, payload) {
        response = { status, payload }
      },
    },
    get response() {
      return response
    },
  }
}

test('server factory imports with backend foundation routes', () => {
  assert.equal(typeof createScmServer, 'function')
})

test('GET /api/me returns current user, tenant, and permissions context', async () => {
  const route = createRouteContext('GET', '/api/me')
  const handled = await handleContextRoute(route.ctx)

  assert.ok(handled)
  assert.equal(route.response.status, 200)
  assert.equal(route.response.payload.user.id, 'user-buyer-001')
  assert.equal(route.response.payload.user.name, 'FlowChain Buyer')
  assert.equal(route.response.payload.user.email, 'buyer@flowchain.local')
  assert.equal(route.response.payload.user.role, 'buyer')
  assert.equal(route.response.payload.tenant.id, 'tenant-flowchain-sme')
  assert.equal(route.response.payload.permissionsContext.canPrepareDrafts, true)
  assert.equal(route.response.payload.permissionsContext.canSubmitDocuments, true)
  assert.equal(route.response.payload.permissionsContext.canApproveDocuments, false)
})

test('GET /api/me can reuse existing bearer user context', async () => {
  const route = createRouteContext('GET', '/api/me', {
    headers: { authorization: 'Bearer token-123' },
    db: {
      users: [
        {
          id: 'USR-001',
          token: 'token-123',
          name: 'Alex Buyer',
          email: 'alex@example.com',
          role: 'manager',
          department: 'Procurement',
          locale: 'en-US',
        },
      ],
    },
  })

  const handled = await handleContextRoute(route.ctx)

  assert.ok(handled)
  assert.equal(route.response.status, 200)
  assert.equal(route.response.payload.user.id, 'USR-001')
  assert.equal(route.response.payload.user.email, 'alex@example.com')
  assert.equal(route.response.payload.permissionsContext.canApproveDocuments, true)
})

test('GET /api/tenants/current returns minimal tenant context', async () => {
  const route = createRouteContext('GET', '/api/tenants/current')
  const handled = await handleContextRoute(route.ctx)

  assert.ok(handled)
  assert.equal(route.response.status, 200)
  assert.equal(route.response.payload.id, 'tenant-flowchain-sme')
  assert.equal(route.response.payload.currency, 'USD')
  assert.equal(route.response.payload.settings.allowAiDraftPreparation, true)
  assert.equal(route.response.payload.settings.requireUserReviewForAiDrafts, true)
})

test('GET /api/ai/tools returns controlled AI tool registry', async () => {
  const route = createRouteContext('GET', '/api/ai/tools')
  const handled = await handleAiRoute(route.ctx)

  assert.ok(handled)
  assert.equal(route.response.status, 200)
  assert.equal(route.response.payload.tools.length, 19)
  assert.ok(route.response.payload.tools.some((tool) => tool.name === 'getSupplierStatus'))
  assert.ok(route.response.payload.tools.some((tool) => tool.name === 'getPurchaseRequestStatus'))
  assert.ok(route.response.payload.tools.some((tool) => tool.name === 'getReceivingExceptions'))
  assert.ok(route.response.payload.tools.some((tool) => tool.name === 'getRfqSupplierResponses'))
  assert.ok(route.response.payload.tools.some((tool) => tool.name === 'preparePurchaseRequestDraft'))
  assert.equal(route.response.payload.tools.find((tool) => tool.name === 'getSupplierStatus').mode, 'read')
  assert.equal(route.response.payload.tools.find((tool) => tool.name === 'prepareRfqDraft').requiresUserReview, true)
  assert.equal(route.response.payload.tools.every((tool) => tool.writesBusinessData === false), true)
})

test('AI tool registry returns defensive copies', () => {
  const first = getAiToolRegistry()
  first[0].inputSchema.query = 'changed'

  const second = getAiToolRegistry()
  assert.equal(second[0].inputSchema.query, 'string')
})

test('audit foundation normalizes and records reusable audit events', () => {
  const now = new Date('2026-06-24T10:30:00.000Z')
  const normalized = normalizeAuditEvent({
    id: 'AUD-TEST-001',
    source: 'ai_assisted',
    module: 'ai',
    action: 'ai_tool_invoked',
    entity: { type: 'ai_tool', id: 'getSupplierStatus' },
    summary: 'AI tool invocation recorded.',
    metadata: { confidence: 'high' },
  }, { now })

  assert.equal(normalized.id, 'AUD-TEST-001')
  assert.equal(normalized.tenantId, 'tenant-flowchain-sme')
  assert.equal(normalized.timestamp, '2026-06-24T10:30:00.000Z')
  assert.equal(normalized.source, 'ai_assisted')
  assert.equal(normalized.entity.type, 'ai_tool')
  assert.deepEqual(normalized.before, null)

  const db = {}
  const recorded = recordAuditEvent(db, normalized, { now })
  assert.equal(recorded.id, 'AUD-TEST-001')
  assert.equal(listAuditEvents(db).length, 1)
})
