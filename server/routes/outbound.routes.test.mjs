import assert from 'node:assert/strict'
import test from 'node:test'
import { OutboundCommandError } from '../domain/outbound-posting-command-service.mjs'
import { handleOutboundRoute } from './outbound.routes.mjs'

function route({ path = '/api/sales/orders/SO-1/reservations/reserve', method = 'POST', role = 'manager', authenticated = true, body = {}, headers = {}, env = {}, command, query } = {}) {
  let response
  const ctx = {
    req: { method, headers }, res: {}, url: new URL(path, 'http://localhost'),
    env: { FLOWCHAIN_PERSISTENCE_MODE: 'database', FLOWCHAIN_ENABLE_DB_OUTBOUND_POSTING: 'true', ...env },
    identity: { authenticated, tenantId: 'tenant-signed', userId: 'actor-signed', role },
    outboundCommandService: command, outboundQueryService: query,
    readBody: async () => body,
    send(_res, status, payload) { response = { status, payload } },
  }
  return { ctx, get response() { return response } }
}

test('outbound routes fail closed without explicit database capability', async () => {
  const call = route({ env: { FLOWCHAIN_ENABLE_DB_OUTBOUND_POSTING: 'false' } })
  assert.equal(await handleOutboundRoute(call.ctx), true)
  assert.equal(call.response.status, 409)
  assert.equal(call.response.payload.code, 'OUTBOUND_CAPABILITY_NOT_AVAILABLE')
})

test('outbound state and preview use only signed tenant context', async () => {
  let captured
  const query = {
    async getSalesOrderOutboundState(input, context) { captured = { input, context }; return { salesOrder: { id: input.salesOrderId } } },
    async previewSalesOrderReservation(input, context) { captured = { input, context }; return { allowed: true } },
  }
  const state = route({ method: 'GET', path: '/api/sales/orders/SO-1/outbound-state?tenantId=forged', query })
  await handleOutboundRoute(state.ctx)
  assert.equal(state.response.status, 200)
  assert.equal(captured.context.identity.tenantId, 'tenant-signed')
  const preview = route({ path: '/api/sales/orders/SO-1/reservations/preview', body: { tenantId: 'forged', allocations: [] }, query })
  await handleOutboundRoute(preview.ctx)
  assert.equal(preview.response.status, 200)
  assert.deepEqual(captured.input, { salesOrderId: 'SO-1', allocations: [] })
})

test('outbound mutation ignores forged tenant and actor fields and uses path identity', async () => {
  let captured
  const command = { async reserveSalesOrderInventory(input, context) { captured = { input, context }; return { entityId: input.salesOrderId } } }
  const call = route({ body: { tenantId: 'forged', actorId: 'forged', expectedOrderVersion: 0, idempotencyKey: 'idem-1', allocations: [] }, command })
  await handleOutboundRoute(call.ctx)
  assert.equal(call.response.status, 200)
  assert.equal(captured.input.salesOrderId, 'SO-1')
  assert.equal(captured.input.tenantId, undefined)
  assert.equal(captured.context.identity.tenantId, 'tenant-signed')
  assert.equal(JSON.stringify(captured).includes('actorId'), false)
})

test('viewer and buyer mutations are denied and stable command errors are sanitized', async () => {
  for (const role of ['viewer', 'buyer']) {
    const command = {
      async reserveSalesOrderInventory() {
        throw Object.assign(new Error('Permission denied.'), {
          name: 'AuthorizationError', code: 'AUTHORIZATION_PERMISSION_DENIED', status: 403,
        })
      },
    }
    const denied = route({ role, command })
    await handleOutboundRoute(denied.ctx)
    assert.equal(denied.response.status, 403)
    assert.equal(denied.response.payload.code, 'AUTHORIZATION_PERMISSION_DENIED')
  }
  const failed = route({ command: { async reserveSalesOrderInventory() { throw new OutboundCommandError('RESERVATION_INSUFFICIENT_AVAILABLE', 'Insufficient available inventory.', 422) } } })
  await handleOutboundRoute(failed.ctx)
  assert.deepEqual(failed.response, { status: 422, payload: { code: 'RESERVATION_INSUFFICIENT_AVAILABLE', message: 'Insufficient available inventory.' } })
})
