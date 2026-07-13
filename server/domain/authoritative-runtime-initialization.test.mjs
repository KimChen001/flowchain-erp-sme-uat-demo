import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { resolveFlowchainDataMode } from './data-mode.mjs'
import { createScmServer } from '../routes/scm-legacy.routes.mjs'
import { createDurableItemMasterRepository } from '../repositories/durable-item-master-repository.mjs'
import { createDurableSupplierRepository } from '../repositories/durable-supplier-repository.mjs'
import { createDurableCustomerRepository } from '../repositories/durable-customer-repository.mjs'
import { createDurableInventoryRepository } from '../repositories/durable-inventory-repository.mjs'
import { createDurableSalesOrderRepository } from '../repositories/durable-sales-order-repository.mjs'
import { createDurableProcurementRepository } from '../repositories/durable-procurement-repository.mjs'
import { handleMasterDataRoute } from '../routes/master-data.routes.mjs'

async function missing(file) {
  await assert.rejects(() => access(file), error => error.code === 'ENOENT')
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  return server.address().port
}

async function close(server) {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
}

async function requestJson(port, method, path, body, headers = {}) {
  const raw = body === undefined ? '' : JSON.stringify(body)
  return await new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1', port, method, path,
      headers: { ...headers, ...(raw ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(raw) } : {}) },
    }, response => {
      const chunks = []
      response.on('data', chunk => chunks.push(chunk))
      response.on('end', () => resolve({ status: response.statusCode, payload: JSON.parse(Buffer.concat(chunks).toString('utf8')) }))
    })
    request.on('error', reject)
    if (raw) request.write(raw)
    request.end()
  })
}

test('default data mode is user and demo reads require an explicit opt-in', () => {
  const defaults = resolveFlowchainDataMode({})
  assert.equal(defaults.mode, 'user')
  assert.equal(defaults.readsDemoData, false)
  assert.equal(defaults.isDefaulted, true)
  assert.equal(resolveFlowchainDataMode({ FLOWCHAIN_DATA_MODE: 'demo' }).readsDemoData, true)
  assert.equal(resolveFlowchainDataMode({ FLOWCHAIN_DATA_MODE: 'empty' }).readsDemoData, false)
  assert.equal(resolveFlowchainDataMode({ FLOWCHAIN_DATA_MODE: 'invalid' }).mode, 'user')
})

test('all six durable business repositories obey read-no-write on a missing file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flowchain-read-no-write-'))
  try {
    const files = Object.fromEntries(['item', 'supplier', 'customer', 'inventory', 'sales', 'procurement'].map(name => [name, join(directory, `${name}.json`)]))
    const item = createDurableItemMasterRepository({ dataFile: files.item })
    const supplier = createDurableSupplierRepository({ dataFile: files.supplier })
    const customer = createDurableCustomerRepository({ dataFile: files.customer })
    const inventory = createDurableInventoryRepository({ dataFile: files.inventory })
    const sales = createDurableSalesOrderRepository({ dataFile: files.sales })
    const procurement = createDurableProcurementRepository({ dataFile: files.procurement })

    assert.deepEqual(await item.listItems(), [])
    assert.deepEqual(await supplier.listSuppliers(), [])
    assert.deepEqual(await customer.listCustomers(), [])
    assert.deepEqual(await inventory.listItems(), [])
    assert.deepEqual(await sales.listOrders(), [])
    assert.deepEqual(await procurement.list('pr'), [])
    assert.deepEqual((await procurement.snapshot()).purchaseOrders, [])

    await Promise.all(Object.values(files).map(missing))
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('customer master validates, versions, activates and survives restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flowchain-customer-'))
  try {
    const file = join(directory, 'customers.json')
    const repository = createDurableCustomerRepository({ dataFile: file })
    const created = await repository.createCustomer({ code: 'CUS-RUNTIME', name: 'Runtime Customer', email: 'buyer@example.com', status: 'active' }, 'admin')
    assert.equal(created.version, 1)
    await assert.rejects(
      () => repository.createCustomer({ code: 'CUS-RUNTIME', name: 'Duplicate' }, 'admin'),
      error => error.code === 'CUSTOMER_CODE_DUPLICATE',
    )
    await assert.rejects(
      () => repository.updateCustomer(created.id, { email: 'invalid', expectedVersion: 1 }, 'admin'),
      error => error.code === 'CUSTOMER_EMAIL_INVALID',
    )
    const inactive = await repository.updateCustomer(created.id, { status: 'inactive', expectedVersion: 1 }, 'admin')
    assert.equal(inactive.status, 'inactive')
    assert.equal(inactive.version, 2)
    await assert.rejects(
      () => repository.updateCustomer(created.id, { name: 'Stale', expectedVersion: 1 }, 'admin'),
      error => error.code === 'VERSION_CONFLICT',
    )
    const restarted = createDurableCustomerRepository({ dataFile: file })
    const restored = await restarted.getCustomer('CUS-RUNTIME')
    assert.equal(restored.status, 'inactive')
    assert.equal(restored.email, 'buyer@example.com')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('customer API supports empty list, create, update, deactivate and restart-safe detail', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flowchain-customer-api-'))
  const file = join(directory, 'customers.json')
  const call = async (repository, method, path, body) => {
    let response
    const ctx = {
      req: { method, headers: { 'x-flowchain-role': 'manager', 'x-flowchain-user': 'admin' } },
      res: {},
      url: new URL(path, 'http://localhost'),
      repositories: { masterData: repository },
      send(_res, status, payload) { response = { status, payload } },
      readBody: async () => body || {},
    }
    assert.equal(await handleMasterDataRoute(ctx), true)
    return response
  }
  try {
    const repository = createDurableCustomerRepository({ dataFile: file })
    assert.deepEqual((await call(repository, 'GET', '/api/master-data/customers')).payload.customers, [])
    await missing(file)
    const created = (await call(repository, 'POST', '/api/master-data/customers', {
      code: 'CUS-API', name: 'API Customer', email: 'api@example.com', status: 'active',
    })).payload.customer
    const updated = (await call(repository, 'PATCH', `/api/master-data/customers/${created.id}`, {
      contact: 'Updated Contact', expectedVersion: created.version,
    })).payload.customer
    assert.equal(updated.contact, 'Updated Contact')
    const inactive = (await call(repository, 'POST', `/api/master-data/customers/${created.id}/deactivate`, {
      expectedVersion: updated.version,
    })).payload.customer
    assert.equal(inactive.status, 'inactive')
    const restarted = createDurableCustomerRepository({ dataFile: file })
    const detail = await call(restarted, 'GET', '/api/master-data/customers/CUS-API')
    assert.equal(detail.status, 200)
    assert.equal(detail.payload.customer.version, 3)
    assert.equal((await call(restarted, 'GET', '/api/master-data/customers/missing')).status, 404)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('health reports authoritative mode/adapters and local login is independent of demo db', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flowchain-health-user-'))
  const keys = [
    'FLOWCHAIN_DATA_MODE', 'FLOWCHAIN_ITEM_RUNTIME_FILE', 'FLOWCHAIN_SUPPLIER_RUNTIME_FILE',
    'FLOWCHAIN_CUSTOMER_RUNTIME_FILE', 'FLOWCHAIN_INVENTORY_RUNTIME_FILE', 'FLOWCHAIN_SALES_RUNTIME_FILE',
  ]
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]))
  const demoFile = new URL('../../data/scm-demo.json', import.meta.url)
  const demoBefore = await readFile(demoFile)
  let server
  try {
    delete process.env.FLOWCHAIN_DATA_MODE
    for (const key of keys.slice(1)) process.env[key] = join(directory, `${key}.json`)
    server = createScmServer()
    const port = await listen(server)
    const health = await requestJson(port, 'GET', '/api/health')
    assert.equal(health.payload.dataMode, 'user')
    assert.equal(health.payload.readsDemoData, false)
    assert.equal(health.payload.persistenceMode, 'json')
    assert.equal(health.payload.runtimeAdapters.items, 'durable-item-master-v1')
    assert.equal(health.payload.runtimeAdapters.customers, 'durable-customer-master-v1')
    assert.equal(typeof health.payload.commitSha, 'string')
    assert.equal(typeof health.payload.branch, 'string')
    assert.equal(typeof health.payload.worktree, 'string')

    const login = await requestJson(port, 'POST', '/api/auth/login', { email: 'owner@example.com', name: 'Owner', company: 'Runtime Co' })
    assert.equal(login.status, 200)
    assert.doesNotMatch(login.payload.token, /^demo-/)
    const me = await requestJson(port, 'GET', '/api/auth/me', undefined, { Authorization: `Bearer ${login.payload.token}` })
    assert.equal(me.status, 200)
    assert.equal(me.payload.email, 'owner@example.com')
    assert.deepEqual(await readFile(demoFile), demoBefore)
    for (const key of keys.slice(1)) await missing(process.env[key])
  } finally {
    if (server?.listening) await close(server)
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
    await rm(directory, { recursive: true, force: true })
  }
})
