import { expect, test, type APIRequestContext } from '@playwright/test'

async function signedManager(request: APIRequestContext) {
  const response = await request.post('/api/auth/login', {
    data: { company: '新辰智能制造', name: '授权门禁经理', email: `auth-${Date.now()}@example.com` },
  })
  expect(response.status()).toBe(200)
  return (await response.json()).token as string
}

test('authoritative mutations reject anonymous and viewer identities and accept signed manager identity', async ({ request }) => {
  const suffix = Date.now()
  const inventoryBody = { sku: `AUTH-SKU-${suffix}`, itemName: '授权测试物料', onHandQuantity: 3, actor: 'forged-user' }
  const salesBody = { salesOrderId: `AUTH-SO-${suffix}`, customerName: '授权测试客户', sku: inventoryBody.sku, orderedQty: 2, actor: 'forged-user' }

  expect((await request.post('/api/inventory/items', { data: inventoryBody })).status()).toBe(401)
  expect((await request.post('/api/inventory/items', { headers: { 'x-flowchain-role': 'viewer', 'x-flowchain-user': 'viewer-user' }, data: inventoryBody })).status()).toBe(403)
  expect((await request.post('/api/sales-demand/orders', { data: salesBody })).status()).toBe(401)
  expect((await request.post('/api/sales-demand/orders', { headers: { 'x-flowchain-role': 'viewer', 'x-flowchain-user': 'viewer-user' }, data: salesBody })).status()).toBe(403)

  const settingsResponse = await request.get('/api/settings-runtime')
  expect(settingsResponse.status()).toBe(200)
  const settings = await settingsResponse.json()
  const settingsBody = { settings: { ...settings.company, workspaceName: `授权工作区-${suffix}` }, actor: { id: 'forged-user', name: '伪造管理员', role: 'admin' } }
  expect((await request.patch('/api/settings-runtime/company', { data: settingsBody })).status()).toBe(401)
  expect((await request.patch('/api/settings-runtime/company', { headers: { 'x-flowchain-role': 'business-specialist', 'x-flowchain-user': 'specialist-user' }, data: settingsBody })).status()).toBe(403)

  const token = await signedManager(request)
  const headers = { authorization: `Bearer ${token}` }
  const inventoryWrite = await request.post('/api/inventory/items', { headers, data: inventoryBody })
  expect(inventoryWrite.status()).toBe(201)
  expect((await inventoryWrite.json()).item).toMatchObject({ sku: inventoryBody.sku, createdBy: expect.not.stringContaining('forged') })
  const salesWrite = await request.post('/api/sales-demand/orders', { headers, data: salesBody })
  expect(salesWrite.status()).toBe(201)
  expect((await salesWrite.json()).order).toMatchObject({ salesOrderId: salesBody.salesOrderId, createdBy: expect.not.stringContaining('forged') })
  expect((await request.patch('/api/settings-runtime/company', { headers, data: settingsBody })).status()).toBe(200)

  const auditResponse = await request.get('/api/audit-log')
  expect(auditResponse.status()).toBe(200)
  const persisted = await auditResponse.json()
  const settingsAudit = persisted.find((entry: { entity?: { type?: string } }) => entry.entity?.type === 'settings_section')
  expect(settingsAudit.actor.name).toBe('授权门禁经理')
  expect(settingsAudit.actor.name).not.toBe('伪造管理员')
})
