import test from 'node:test'
import assert from 'node:assert/strict'
import { handleMasterDataRoute } from '../routes/master-data.routes.mjs'
import { handleCapabilitiesRoute } from '../routes/capabilities.routes.mjs'

const repository = {
  listManagedItems: async () => [
    { itemId: 'I-1', category: '原材料', status: 'active' },
    { itemId: 'I-2', category: '停用品类', status: 'inactive' },
  ],
  listWarehouses: async () => [
    { id: 'W-1', warehouseCode: 'WH-1', warehouseName: '一号仓', status: 'active', bin: 'A-01' },
    { id: 'W-2', warehouseCode: 'WH-2', warehouseName: '停用仓', status: 'inactive' },
  ],
  listPaymentTerms: async () => [{ id: 'NET30', code: 'NET30', label: '30 天', status: 'active' }],
  listTaxCodes: async () => [{ id: 'VAT13', code: 'VAT13', label: '增值税 13%', rate: 0.13, status: 'active' }],
}

async function call(handler, path) {
  let response
  const ctx = { req: { method: 'GET', headers: {} }, res: {}, url: new URL(path, 'http://local'), repositories: { masterData: repository }, db: {}, send(_res, status, payload) { response = { status, payload } } }
  assert.equal(await handler(ctx), true)
  return response
}

test('formal selector APIs return active minimal options', async () => {
  for (const name of ['departments', 'currencies', 'units', 'commodities', 'warehouses', 'payment-terms', 'tax-codes']) {
    const response = await call(handleMasterDataRoute, `/api/master-data/${name}/select`)
    assert.equal(response.status, 200)
    assert.ok(response.payload.options.length > 0, `${name} selector should have an active option`)
    for (const option of response.payload.options) assert.deepEqual(Object.keys(option).filter(key => !['id', 'code', 'label', 'metadata'].includes(key)), [])
  }
  const warehouses = await call(handleMasterDataRoute, '/api/master-data/warehouses/select')
  assert.deepEqual(warehouses.payload.options.map(row => row.code), ['WH-1'])
})

test('capability registry hides preview and unavailable modules by default', async () => {
  const response = await call(handleCapabilitiesRoute, '/api/capabilities')
  const byId = Object.fromEntries(response.payload.capabilities.map(row => [row.id, row]))
  assert.equal(byId.procurement.maturity, 'stable')
  assert.equal(byId.imports.maturity, 'beta')
  assert.equal(byId.forecast.enabled, false)
  assert.equal(byId.finance.enabled, false)
})
