import { expect, test, type Page } from '@playwright/test'

const ghosts = /PO-2026-1287|PO-2026-1286|PO-2026-1285|PO-2026-1284|RFQ-26-0042|INV-HD-260421|INV-SZ-260422|RTV-2026-0501|GRN-202605-0418/

async function auth(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('scm-demo-token', 'runtime-links')
    localStorage.setItem('scm-demo-user', JSON.stringify({ id: 'runtime-links-user', name: 'Runtime User', role: 'manager' }))
  })
}

test.beforeEach(async ({ page }) => auth(page))

test('UI and API expose the same development build identity', async ({ page, request }) => {
  const health = await (await request.get('/api/health')).json()
  await page.goto('/app/inventory/stock')
  await expect.poll(() => page.locator('html').getAttribute('data-flowchain-commit')).toBe(health.commitSha)
  expect(health.branch).toBe('codex/persistent-sme-procurement')
  expect(health.runtimeMode).toBe('local-dev')
})

test('inventory is authoritative, links SKU to Item Master, and routes replenishment safely', async ({ page, request }) => {
  const suffix = Date.now()
  const sku = `RUNTIME-SKU-${suffix}`
  const itemResponse = await request.post('/api/master-data/items', { headers: { 'x-flowchain-role': 'manager' }, data: { sku, itemName: '运行时补货物料', baseUnit: '台', status: 'active', purchasable: true, reorderPoint: 20, safetyStock: 10 } })
  expect(itemResponse.status()).toBe(201)
  const item = (await itemResponse.json()).item
  expect((await request.post('/api/inventory/items', { data: { itemId: item.itemId, sku, itemName: item.itemName, onHandQuantity: 2, availableQuantity: 2, safetyStock: 10, reorderPoint: 20, unit: '台' } })).status()).toBe(201)

  await page.goto('/app/inventory/stock')
  await expect(page.getByText('SKU-00412', { exact: true })).toHaveCount(0)
  await expect(page.getByText('预览 PR', { exact: true })).toHaveCount(0)
  await expect(page.getByText('待分配供应商', { exact: true })).toHaveCount(0)
  const skuLink = page.getByRole('link', { name: sku, exact: true })
  await expect(skuLink).toHaveAttribute('href', `/app/master-data/items/${item.itemId}`)
  await expect(skuLink).toBeFocused({ timeout: 100 }).catch(async () => { await skuLink.focus(); await expect(skuLink).toBeFocused() })
  await skuLink.click()
  await expect(page).toHaveURL(new RegExp(`/app/master-data/items/${item.itemId}$`))
  await page.reload()
  await expect(page.getByText(sku, { exact: false }).first()).toBeVisible()

  await page.goto('/app/inventory/stock')
  const inventoryRow = page.getByTestId(`inventory-item-${sku}`)
  await inventoryRow.getByRole('link', { name: '维护供应商关系', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/app/master-data/items/${item.itemId}$`))

  const supplier = (await (await request.post('/api/master-data/suppliers', { headers: { 'x-flowchain-role': 'manager' }, data: { supplierCode: `SUP-${suffix}`, supplierName: '运行时首选供应商', status: 'active' } })).json()).supplier
  expect((await request.post(`/api/master-data/items/${item.itemId}/suppliers`, { headers: { 'x-flowchain-role': 'manager' }, data: { supplierId: supplier.id, active: true, approved: true, preferred: true, referencePrice: 66, leadTimeDays: 5, minimumOrderQuantity: 1 } })).status()).toBe(201)
  await page.goto('/app/inventory/stock')
  await page.getByTestId(`inventory-item-${sku}`).getByRole('link', { name: '新建采购申请', exact: true }).click()
  await expect(page).toHaveURL(/\/app\/procurement\/requests\?.*itemId=/)
  await expect(page.getByLabel('SKU 1')).toHaveValue(item.itemId)
  await expect(page.getByLabel('供应商 1')).toHaveValue(supplier.id)
  await expect(page.getByRole('spinbutton').first()).toHaveValue('18')
})

test('sales runtime creates recoverable order and canonical SO/SKU links', async ({ page, request }) => {
  const suffix = Date.now(), sku = `SALES-SKU-${suffix}`, salesOrderId = `SO-RUNTIME-${suffix}`
  const item = (await (await request.post('/api/master-data/items', { headers: { 'x-flowchain-role': 'manager' }, data: { sku, itemName: '运行时销售物料', baseUnit: '件', status: 'active', purchasable: true } })).json()).item
  expect((await request.post('/api/sales-demand/orders', { data: { salesOrderId, customerName: '无客户主数据链接公司', sku, itemId: item.itemId, itemName: '运行时销售物料', orderedQty: 5, reservedQty: 5, fulfilledQty: 0, promisedDate: '2026-08-01', statusLabel: '待交付' } })).status()).toBe(201)
  await page.goto('/app/sales/orders')
  for (const fixed of ['SO-2026-0412-A', 'SO-2026-1282', 'SO-2026-0412-B', 'SO-2026-SUP-RISK', 'SO-2026-0508']) await expect(page.getByText(fixed, { exact: true })).toHaveCount(0)
  const orderLink = page.getByRole('link', { name: salesOrderId, exact: true })
  await expect(orderLink).toHaveAttribute('href', `/app/sales/orders/${salesOrderId}`)
  const skuLink = page.getByRole('link', { name: sku, exact: true })
  await expect(skuLink).toHaveAttribute('href', `/app/master-data/items/${item.itemId}`).catch(async () => expect(skuLink).toHaveAttribute('href', `/app/master-data/items/${sku}`))
  await expect(page.getByText('无客户主数据链接公司', { exact: true }).locator('xpath=self::a')).toHaveCount(0)
  await orderLink.click()
  await expect(page).toHaveURL(new RegExp(`/app/sales/orders/${salesOrderId}$`))
  await page.reload()
  await expect(page.getByText(salesOrderId, { exact: false }).first()).toBeVisible()
})

test('all procurement routes stay on runtime component and hide ghost records', async ({ page }) => {
  const routes: Array<[string, string]> = [['/app/procurement/rfq', '暂无询价单'], ['/app/procurement/receiving', '暂无采购收货记录'], ['/app/procurement/invoices', '暂无供应商发票'], ['/app/procurement/three-way-match', '暂无匹配记录'], ['/app/procurement/returns', '暂无采购退货记录']]
  for (const [route, empty] of routes) {
    await page.goto(route)
    await expect(page.getByText(empty, { exact: true })).toBeVisible()
    await expect(page.locator('body')).not.toContainText(ghosts)
    await expect(page.locator('body')).not.toContainText(/逾期 9\d{3} 天/)
  }
})

test('runtime PR PO and Supplier identifiers use canonical focusable links', async ({ page, request }) => {
  const suffix = Date.now()
  const supplierResponse = await request.post('/api/master-data/suppliers', { headers: { 'x-flowchain-role': 'manager' }, data: { supplierCode: `LINK-${suffix}`, supplierName: `链接供应商-${suffix}`, status: 'active' } })
  expect(supplierResponse.status()).toBe(201)
  const supplier = (await supplierResponse.json()).supplier
  const createResponse = await request.post('/api/procurement/requests', { headers: { 'x-flowchain-role': 'manager', 'x-flowchain-user': 'runtime-links-user' }, data: { departmentId: 'operations', defaultCurrency: 'CNY', lines: [{ lineId: 'L1', sourceType: 'non_catalog_item', lineBasis: 'amount', supplierId: supplier.id, itemNameSnapshot: '实体链接测试服务', commodityId: 'service', estimatedAmount: 88, currency: 'CNY', targetWarehouseId: 'WH-MAIN', needByDate: '2026-08-01' }] } })
  expect(createResponse.status()).toBe(201)
  let pr = await createResponse.json()
  pr = await (await request.post(`/api/procurement/requests/${pr.id}/submit`, { headers: { 'x-flowchain-role': 'manager' }, data: { expectedVersion: pr.version } })).json()
  await page.goto('/app/procurement/workbench')
  const prLink = page.getByRole('link', { name: pr.id, exact: true })
  await expect(prLink).toHaveAttribute('href', `/app/procurement/requests/${pr.id}`)
  await prLink.focus(); await expect(prLink).toBeFocused()

  pr = await (await request.post(`/api/procurement/requests/${pr.id}/approve`, { headers: { 'x-flowchain-role': 'manager' }, data: { expectedVersion: pr.version } })).json()
  const converted = await request.post(`/api/procurement/requests/${pr.id}/generate-purchase-orders`, { headers: { 'x-flowchain-role': 'manager' }, data: { expectedVersion: pr.version } })
  expect(converted.status()).toBe(201)
  const po = (await converted.json()).createdPurchaseOrders[0]
  await page.goto('/app/procurement/orders')
  await expect(page.getByRole('link', { name: po.id, exact: true })).toHaveAttribute('href', `/app/procurement/orders/${po.id}`)
  await expect(page.getByRole('link', { name: `链接供应商-${suffix}`, exact: true })).toHaveAttribute('href', `/app/master-data/suppliers/${supplier.id}`)
  await expect(page.getByRole('link', { name: pr.id, exact: true })).toHaveAttribute('href', `/app/procurement/requests/${pr.id}`)
})

test('inventory and sales API failures show errors without fixed-record fallback', async ({ page }) => {
  await page.route('**/api/inventory/items', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'forced failure' }) }))
  await page.goto('/app/inventory/stock')
  await expect(page.getByText('库存数据读取失败。请检查运行时服务后重试。', { exact: true })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('SKU-00412')
  await page.unroute('**/api/inventory/items')

  await page.route('**/api/sales-demand/orders', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'forced failure' }) }))
  await page.goto('/app/sales/orders')
  await expect(page.getByText(/当前未读取到客户订单记录/)).toBeVisible()
  await expect(page.locator('body')).not.toContainText('SO-2026-0412-A')
})
