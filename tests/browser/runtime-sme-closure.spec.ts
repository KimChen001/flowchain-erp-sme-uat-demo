import { test, expect, type Page } from '@playwright/test'

async function auth(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('flowchain:auth-token', 'runtime-gate')
    localStorage.setItem('flowchain:current-user', JSON.stringify({ id: 'runtime-manager', name: 'Runtime Manager', role: '采购经理' }))
  })
}
test.beforeEach(async ({ page }) => auth(page))

test('supplier master is authoritative and supports real create/detail state', async ({ page, request }) => {
  const code = `PW-${Date.now()}`
  const created = await request.post('/api/master-data/suppliers', { headers: { 'x-flowchain-role': 'manager', 'x-flowchain-user': 'runtime-manager' }, data: { supplierCode: code, supplierName: 'Playwright Supplier', status: 'active', categories: ['Test'], contactName: 'Tester', email: 'test@example.com', defaultCurrency: 'CNY', paymentTermsId: 'NET30' } })
  expect(created.status()).toBe(201)
  await page.goto('/app/master-data/suppliers')
  await expect(page.getByRole('heading', { name: '供应商', exact: true }).last()).toBeVisible()
  await expect(page.getByText('风险判断来源')).toHaveCount(0)
  await expect(page.getByText('SRM 总览')).toHaveCount(0)
  await expect(page.getByText('广州化工耗材')).toHaveCount(0)
  await page.getByRole('button', { name: code }).click()
  await expect(page.getByRole('heading', { name: 'Playwright Supplier' })).toBeVisible()
  await expect(page.getByText('暂无采购交易记录')).toBeVisible()
})

test('homepage overview uses runtime work and recent documents only', async ({ page }) => {
  await page.goto('/app/overview')
  await expect(page.getByRole('heading', { name: '首页概览' }).last()).toBeVisible()
  await expect(page.getByText('经营预警')).toHaveCount(0)
  await expect(page.getByText('业务概况')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '最近单据' })).toBeVisible()
  for (const label of ['待我处理', '风险异常', '今日变化']) {
    const card = page.getByRole('button', { name: new RegExp(label) })
    await expect(card).toBeVisible()
    await card.focus()
    await page.keyboard.press('Enter')
  }
  for (const id of ['PO-2026-1287', 'GRN-202605-0419', 'INV-HD-260421', 'SKU-00623']) await expect(page.getByText(id, { exact: false })).toHaveCount(0)
})

test('procurement runtime pages expose real records and no ghost controls', async ({ page }) => {
  await page.goto('/app/procurement/workbench')
  await expect(page.getByRole('button', { name: '新建采购申请' })).toBeVisible()
  await expect(page.getByText('详细视图')).toHaveCount(0)
  await expect(page.getByText(/导入采购|下载模板/)).toHaveCount(0)
  await page.goto('/app/procurement/requests')
  await expect(page.getByText('采购负责人')).toHaveCount(0)
  await expect(page.getByText('Header Comments')).toHaveCount(0)
  await expect(page.getByLabel('申请人')).toHaveValue('runtime-manager')
  await expect(page.getByLabel('预计单价 1')).toHaveValue('')
  await page.goto('/app/procurement/orders')
  const draft = page.getByText('not_sent').first()
  if (await draft.count()) await expect(draft).toBeVisible()
  for (const id of ['PO-2026-1287', 'GRN-202605-0419', 'INV-HD-260421']) await expect(page.getByText(id, { exact: false })).toHaveCount(0)
})
