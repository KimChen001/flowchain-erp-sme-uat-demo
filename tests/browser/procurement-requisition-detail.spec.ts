import { test, expect } from '@playwright/test'
test.beforeEach(async({page})=>page.addInitScript(()=>{localStorage.setItem('flowchain:auth-token','detail');localStorage.setItem('flowchain:current-user',JSON.stringify({id:'detail-user',name:'Detail User',role:'采购经理'}))}))

test('procurement requisition list and detail use runtime business objects', async ({ page, request }) => {
  const code = `DETAIL-${Date.now()}`
  const supplierResponse = await request.post('/api/master-data/suppliers', {
    headers: { 'x-flowchain-role': 'manager' },
    data: { supplierCode: code, supplierName: code, status: 'active' },
  })
  const supplier = (await supplierResponse.json()).supplier
  const prResponse = await request.post('/api/procurement/requests', {
    headers: { 'x-flowchain-role': 'manager', 'x-flowchain-user': 'detail-user' },
    data: {
      departmentId: 'operations', defaultCurrency: 'CNY',
      lines: [{ lineId: 'L1', sourceType: 'non_catalog_item', lineBasis: 'amount', supplierId: supplier.id, itemNameSnapshot: '详情测试服务', commodityId: 'service', estimatedAmount: 99, currency: 'CNY', targetWarehouseId: 'WH-MAIN', needByDate: '2026-08-01', internalLineComment: '详情内部备注' }],
    },
  })
  expect(prResponse.status()).toBe(201)
  const pr = await prResponse.json()
  await page.goto('/app/procurement/requests')
  await expect(page.getByText(pr.id, { exact: true })).toBeVisible()
  await page.goto(`/app/procurement/requests/${pr.id}`)
  await expect(page.getByText(pr.id, { exact: true }).first()).toBeVisible()
  await expect(page.getByText('详情测试服务')).toBeVisible()
  await expect(page.getByText('详情内部备注')).toBeVisible()
  await expect(page.getByText('暂无关联采购订单')).toBeVisible()
})
