import test from 'node:test'
import assert from 'node:assert/strict'
import { ReceivingCommandError } from '../domain/receiving-posting-command-service.mjs'
import { handleReceivingRoute } from './receiving.routes.mjs'

function route({ path = '/api/procurement/receiving/GRN-1/post', method = 'POST', role = 'manager', authenticated = true, tenantId = 'tenant-server', body = {}, headers = {}, env = {}, service, queryService } = {}) {
  let response
  const identity = { authenticated, userId: authenticated ? 'actor-server' : 'anonymous', name: 'Server Actor', email: '', role, tenantId }
  const ctx = {
    req: { method, headers },
    res: {},
    url: new URL(path, 'http://localhost'),
    db: {},
    env: {
      FLOWCHAIN_PERSISTENCE_MODE: 'database',
      FLOWCHAIN_ENABLE_DB_RECEIVING_POSTING: 'true',
      ...env,
    },
    identity,
    receivingPostingService: service,
    receivingWorkbenchQueryService: queryService,
    readBody: async () => body,
    send(_res, status, payload) { response = { status, payload } },
  }
  return { ctx, get response() { return response } }
}

test('formal receiving routes fail closed when database capability is disabled', async () => {
  const call = route({ env: { FLOWCHAIN_ENABLE_DB_RECEIVING_POSTING: 'false' } })
  assert.equal(await handleReceivingRoute(call.ctx), true)
  assert.equal(call.response.status, 409)
  assert.equal(call.response.payload.code, 'CAPABILITY_NOT_AVAILABLE')
})

test('database workbench GET routes use server identity and preview remains a read call', async () => {
  let captured
  const queryService = {
    async getReceivingDetail(input, context) { captured = { input, context }; return { receivingDocument: { id: input.receivingDocumentId } } },
    async getReceivingImpactPreview(input, context) { captured = { input, context }; return { operation: input.operation, allowed: true } },
    async getReceivingReconciliation(input, context) { captured = { input, context }; return { status: 'matched', entries: [] } },
  }
  const detail = route({ method: 'GET', path: '/api/procurement/receiving/GRN-1?tenantId=forged', headers: { 'x-flowchain-tenant': 'forged' }, queryService })
  await handleReceivingRoute(detail.ctx)
  assert.equal(detail.response.status, 200)
  assert.equal(captured.context.identity.tenantId, 'tenant-server')
  assert.deepEqual(captured.input, { receivingDocumentId: 'GRN-1' })
  const preview = route({ method: 'GET', path: '/api/procurement/receiving/GRN-1/impact-preview?operation=post', queryService })
  await handleReceivingRoute(preview.ctx)
  assert.equal(preview.response.status, 200)
  assert.deepEqual(captured.input, { receivingDocumentId: 'GRN-1', operation: 'post' })
  const reconciliation = route({ method: 'GET', path: '/api/procurement/receiving/GRN-1/reconciliation', queryService })
  await handleReceivingRoute(reconciliation.ctx)
  assert.equal(reconciliation.response.status, 200)
  assert.deepEqual(captured.input, { receivingDocumentId: 'GRN-1' })
})

test('workbench GET routes enforce authentication and capability for preview', async () => {
  const anonymous = route({ method: 'GET', path: '/api/procurement/receiving/GRN-1', authenticated: false, queryService: {} })
  await handleReceivingRoute(anonymous.ctx)
  assert.equal(anonymous.response.status, 401)
  const disabled = route({ method: 'GET', path: '/api/procurement/receiving/GRN-1/impact-preview?operation=post', env: { FLOWCHAIN_ENABLE_DB_RECEIVING_POSTING: 'false' }, queryService: {} })
  await handleReceivingRoute(disabled.ctx)
  assert.equal(disabled.response.status, 409)
  assert.equal(disabled.response.payload.code, 'CAPABILITY_NOT_AVAILABLE')
})

test('formal receiving routes enforce authentication and manager authorization', async () => {
  const anonymous = route({ authenticated: false })
  await handleReceivingRoute(anonymous.ctx)
  assert.equal(anonymous.response.status, 401)

  const viewer = route({ role: 'viewer' })
  await handleReceivingRoute(viewer.ctx)
  assert.equal(viewer.response.status, 403)
})

test('route passes only centrally resolved identity and ignores forged actor and tenant input', async () => {
  let captured
  const service = {
    async postReceiving(input, context) {
      captured = { input, context }
      return { receivingDocument: { id: input.receivingDocumentId }, movements: [], affectedBalances: [], idempotentReplay: false }
    },
  }
  const call = route({
    body: { idempotencyKey: 'idem-1', tenantId: 'tenant-forged', actorId: 'actor-forged', expectedVersion: 3 },
    headers: { 'x-flowchain-tenant': 'tenant-header-forged' },
    service,
  })
  await handleReceivingRoute(call.ctx)
  assert.equal(call.response.status, 200)
  assert.deepEqual(captured.input, { receivingDocumentId: 'GRN-1', idempotencyKey: 'idem-1', expectedVersion: 3 })
  assert.equal(captured.context.identity.tenantId, 'tenant-server')
  assert.equal(captured.context.identity.userId, 'actor-server')
  assert.equal(JSON.stringify(captured).includes('tenant-forged'), false)
})

test('route supports reversal and maps stable command errors without returning 200', async () => {
  const service = {
    async reverseReceiving() {
      throw new ReceivingCommandError('RECEIVING_REVERSAL_NOT_SAFE', 'unsafe downstream consumption', 409)
    },
  }
  const call = route({ path: '/api/procurement/receiving/GRN-1/reverse', body: { idempotencyKey: 'reverse-1', reason: 'operator correction' }, service })
  await handleReceivingRoute(call.ctx)
  assert.equal(call.response.status, 409)
  assert.equal(call.response.payload.code, 'RECEIVING_REVERSAL_NOT_SAFE')
})

test('missing tenant is rejected by the command boundary with TENANT_CONTEXT_REQUIRED', async () => {
  const service = {
    async postReceiving() {
      throw new ReceivingCommandError('TENANT_CONTEXT_REQUIRED', 'tenant required', 403)
    },
  }
  const call = route({ tenantId: '', body: { idempotencyKey: 'idem-no-tenant' }, service })
  await handleReceivingRoute(call.ctx)
  assert.equal(call.response.status, 403)
  assert.equal(call.response.payload.code, 'TENANT_CONTEXT_REQUIRED')
})
