import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDurableInventoryRepository } from '../repositories/durable-inventory-repository.mjs'
import { createDurableSalesOrderRepository } from '../repositories/durable-sales-order-repository.mjs'
import { createSettingsRuntimeRepository } from '../repositories/settings-runtime-repository.mjs'
import { handleInventoryRoute } from '../routes/inventory.routes.mjs'
import { handleSalesDemandRoute } from '../routes/sales-demand.routes.mjs'
import { handleSettingsRuntimeRoute } from '../routes/settings-runtime.routes.mjs'
import { resolveRequestIdentity } from './local-signed-session.mjs'

const anonymous = { authenticated: false, userId: 'anonymous', name: 'Anonymous', role: 'viewer' }
const viewer = { authenticated: true, userId: 'viewer-1', name: 'Viewer', role: 'viewer' }
const specialist = { authenticated: true, userId: 'specialist-1', name: 'Specialist', role: 'business-specialist' }
const manager = { authenticated: true, userId: 'manager-1', name: 'Runtime Manager', role: 'manager' }

async function snapshot(file) {
  try { return await readFile(file, 'utf8') } catch (error) { if (error.code === 'ENOENT') return null; throw error }
}

async function call(handler, { method, path, body, identity, repositories }) {
  let response
  const ctx = {
    req: { method, headers: {} }, res: {}, url: new URL(path, 'http://local'),
    identity, repositories, readBody: async () => body || {},
    send(_res, status, payload) { response = { status, payload } },
  }
  assert.equal(await handler(ctx), true)
  return response
}

test('authoritative mutations use only centrally resolved identity and preserve denied runtime files', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'flowchain-mutation-auth-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const inventoryFile = join(directory, 'inventory.json')
  const salesFile = join(directory, 'sales.json')
  const settingsFile = join(directory, 'settings.json')
  const repositories = {
    inventoryRuntime: createDurableInventoryRepository({ dataFile: inventoryFile }),
    salesOrders: createDurableSalesOrderRepository({ dataFile: salesFile }),
    settingsRuntime: createSettingsRuntimeRepository({ dataFile: settingsFile }),
  }

  const inventoryBody = { sku: 'SKU-AUTH', itemName: 'Auth Item', onHandQuantity: 4 }
  assert.equal((await call(handleInventoryRoute, { method: 'POST', path: '/api/inventory/items', body: inventoryBody, identity: anonymous, repositories })).status, 401)
  assert.equal(await snapshot(inventoryFile), null)
  assert.equal((await call(handleInventoryRoute, { method: 'POST', path: '/api/inventory/items', body: inventoryBody, identity: viewer, repositories })).status, 403)
  assert.equal(await snapshot(inventoryFile), null)
  const inventoryWrite = await call(handleInventoryRoute, { method: 'POST', path: '/api/inventory/items', body: { ...inventoryBody, actor: 'forged' }, identity: manager, repositories })
  assert.equal(inventoryWrite.status, 201)
  assert.equal(inventoryWrite.payload.item.createdBy, manager.userId)
  assert.equal(inventoryWrite.payload.item.updatedBy, manager.userId)

  const salesBody = { salesOrderId: 'SO-AUTH', customerName: 'Auth Customer', sku: 'SKU-AUTH', orderedQty: 1 }
  assert.equal((await call(handleSalesDemandRoute, { method: 'POST', path: '/api/sales-demand/orders', body: salesBody, identity: anonymous, repositories })).status, 401)
  assert.equal(await snapshot(salesFile), null)
  assert.equal((await call(handleSalesDemandRoute, { method: 'POST', path: '/api/sales-demand/orders', body: salesBody, identity: viewer, repositories })).status, 403)
  assert.equal(await snapshot(salesFile), null)
  const salesWrite = await call(handleSalesDemandRoute, { method: 'POST', path: '/api/sales-demand/orders', body: { ...salesBody, actor: 'forged' }, identity: manager, repositories })
  assert.equal(salesWrite.status, 201)
  assert.equal(salesWrite.payload.order.createdBy, manager.userId)

  const settings = await repositories.settingsRuntime.getSettingsRuntime()
  const settingsBaseline = await snapshot(settingsFile)
  const settingsBody = { settings: { ...settings.company, workspaceName: 'Authorized Workspace' }, actor: { id: 'forged', name: 'Forged User', role: 'admin' } }
  assert.equal((await call(handleSettingsRuntimeRoute, { method: 'PATCH', path: '/api/settings-runtime/company', body: settingsBody, identity: anonymous, repositories })).status, 401)
  assert.equal(await snapshot(settingsFile), settingsBaseline)
  assert.equal((await call(handleSettingsRuntimeRoute, { method: 'PATCH', path: '/api/settings-runtime/company', body: settingsBody, identity: specialist, repositories })).status, 403)
  assert.equal(await snapshot(settingsFile), settingsBaseline)
  assert.equal((await call(handleSettingsRuntimeRoute, { method: 'PATCH', path: '/api/settings-runtime/company', body: settingsBody, identity: manager, repositories })).status, 200)
  const audit = (await repositories.settingsRuntime.listSettingsAuditEntries())[0]
  assert.deepEqual(audit.actor, { type: 'user', id: manager.userId, name: manager.name, role: manager.role })

  const forgedProductionHeaders = { headers: { 'x-flowchain-user': 'forged-admin', 'x-flowchain-role': 'admin' } }
  assert.equal(resolveRequestIdentity(forgedProductionHeaders, new Map(), 'secret', { NODE_ENV: 'production' }).authenticated, false)
  const testIdentity = resolveRequestIdentity(forgedProductionHeaders, new Map(), 'secret', { NODE_ENV: 'test' })
  assert.equal(testIdentity.source, 'explicit_test_headers')
  assert.equal(testIdentity.role, 'admin')
  const testHeaderWrite = await call(handleInventoryRoute, { method: 'POST', path: '/api/inventory/items', body: { sku: 'SKU-TEST-HEADER' }, identity: testIdentity, repositories })
  assert.equal(testHeaderWrite.status, 201)
  assert.equal(testHeaderWrite.payload.item.createdBy, 'forged-admin')
})
