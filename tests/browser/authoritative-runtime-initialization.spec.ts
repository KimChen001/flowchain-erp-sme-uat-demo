import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('flowchain:auth-token', 'runtime-init-gate')
    localStorage.setItem('flowchain:current-user', JSON.stringify({ id: 'runtime-manager', name: 'Runtime Manager', role: '采购经理' }))
  })
})

test('default mode is non-demo and customer master is empty, durable and refresh-safe', async ({ page, request }) => {
  const health = await (await request.get('/api/health')).json()
  expect(health.dataMode).toBe('user')
  expect(health.readsDemoData).toBe(false)
  expect(health.persistenceMode).toBe('json')
  expect(health.runtimeAdapters.customers).toBe('durable-customer-master-v1')

  await page.goto('/app/master-data/customers')
  await expect(page.getByText('真实客户主数据为空')).toBeVisible()
  await expect(page.getByText('CUS-001', { exact: false })).toHaveCount(0)
  await page.goto('/app/master-data/customers/CUS-001')
  await expect(page.getByRole('heading', { name: /未找到 客户 CUS-001/ })).toBeVisible()

  const code = `CUS-PW-${Date.now()}`
  const response = await request.post('/api/master-data/customers', {
    headers: { 'x-flowchain-role': 'manager', 'x-flowchain-user': 'runtime-manager' },
    data: { code, name: 'Playwright Customer', contact: 'Buyer', email: 'buyer@example.com', currency: 'CNY', status: 'active' },
  })
  expect(response.status()).toBe(201)
  await page.goto('/app/master-data/customers')
  await page.getByRole('link', { name: code }).first().click()
  await expect(page).toHaveURL(new RegExp(`/app/master-data/customers/${code}(?:\\?.*)?$`))
  await expect(page.getByRole('heading', { name: code })).toBeVisible()
  await expect(page.getByText('Playwright Customer', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: code })).toBeVisible()
  await expect(page.getByText('Playwright Customer', { exact: true })).toBeVisible()
})
