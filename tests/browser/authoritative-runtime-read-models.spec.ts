import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('scm-demo-token', 'runtime-read-model-gate')
    localStorage.setItem('scm-demo-user', JSON.stringify({ id: 'runtime-reader', name: 'Runtime Reader', role: '供应链经理' }))
  })
})

test('inventory search reports AI and evidence use the same runtime records without ghost fixtures', async ({ page, request }) => {
  const suffix = Date.now()
  const sku = `RUNTIME-CUTOVER-${suffix}`
  const salesOrderId = `SO-CUTOVER-${suffix}`
  const supplierCode = `SUP-CUTOVER-${suffix}`

  const supplierResponse = await request.post('/api/master-data/suppliers', { headers: { 'x-flowchain-role': 'manager' }, data: { supplierCode, supplierName: `Runtime Supplier ${suffix}`, status: 'active' } })
  expect(supplierResponse.status()).toBe(201)
  const itemResponse = await request.post('/api/master-data/items', { headers: { 'x-flowchain-role': 'manager' }, data: { sku, itemName: `Runtime Item ${suffix}`, baseUnit: '件', status: 'active', purchasable: true } })
  expect(itemResponse.status()).toBe(201)
  const item = (await itemResponse.json()).item
  expect((await request.post('/api/inventory/items', { data: { itemId: item.itemId, sku, itemName: item.itemName, onHandQuantity: 10, reservedQuantity: 2 } })).status()).toBe(201)
  expect((await request.post('/api/sales-demand/orders', { data: { salesOrderId, customerName: `Runtime Customer ${suffix}`, itemId: item.itemId, sku, itemName: item.itemName, orderedQty: 20, reservedQty: 2, fulfilledQty: 0, statusLabel: '待交付' } })).status()).toBe(201)

  const allocation = await (await request.get(`/api/inventory/availability/${sku}`)).json()
  expect(allocation.availability).toMatchObject({ sku, onHand: 10, reserved: 2, available: 8, openSalesDemand: 20, shortage: 12 })

  for (const query of [sku, supplierCode, salesOrderId]) {
    const search = await (await request.get(`/api/search?q=${encodeURIComponent(query)}`)).json()
    expect(search.total).toBeGreaterThan(0)
    expect(search.results.every((row: any) => row.canonicalRoute.startsWith('/app/') && row.sourceRepository)).toBe(true)
  }
  const ghost = await (await request.get('/api/search?q=PO-2026-1282')).json()
  expect(ghost.total).toBe(0)

  const report = await (await request.post('/api/reports/query', { data: { subject: 'inventory' } })).json()
  expect(report.details.find((row: any) => row.id === sku)).toMatchObject({ quantity: 10, reserved: 2, available: 8, shortage: 12 })
  expect(report.dataScope.filterOptions.suppliers).toContain(`Runtime Supplier ${suffix}`)
  expect(JSON.stringify(report)).not.toContain('深圳新元电气')

  const graph = await (await request.get(`/api/evidence-graph?entityType=sales_order&entityId=${salesOrderId}`)).json()
  expect(graph.nodes.some((node: any) => node.entityId === sku)).toBe(true)
  expect(graph.nodes.every((node: any) => node.entityType && node.entityId && node.label && node.canonicalRoute && node.sourceRepository)).toBe(true)

  const ai = await (await request.post('/api/ai/chat', { data: { question: `${sku} 库存怎么样？`, moduleId: 'inventory' } })).json()
  expect(JSON.stringify(ai)).toContain(sku)
  expect(JSON.stringify(ai)).not.toMatch(/SKU-00412|PO-2026-1282|深圳新元电气/)

  await page.goto('/app/reports/inventory')
  await expect(page.getByTestId('bi-dashboard')).toBeVisible()
  await expect(page.locator('body')).toContainText(sku)
  await expect(page.locator('body')).not.toContainText('深圳新元电气')
})
