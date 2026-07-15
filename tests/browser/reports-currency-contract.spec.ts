import { expect, test, type Page } from '@playwright/test'

const user = { id: 'reports-currency-user', company: '新辰智能制造', name: '张磊', email: 'reports-currency@example.com', role: '供应链经理' }

async function authenticate(page: Page) {
  await page.addInitScript(profile => {
    localStorage.setItem('flowchain:auth-token', 'reports-currency-token')
    localStorage.setItem('flowchain:current-user', JSON.stringify(profile))
  }, user)
}

function collectRuntimeErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  return errors
}

test('reports overview renders an unfiltered single-currency scope safely', async ({ page }) => {
  await authenticate(page)
  const errors = collectRuntimeErrors(page)
  await page.route('**/api/reports/query', async route => {
    const response = await route.fetch()
    const payload = await response.json()
    payload.dataScope = {
      ...payload.dataScope,
      currencyCode: 'CNY',
      currencyLabel: '人民币（CNY）',
      currencies: ['CNY'],
      currencyAggregationStatus: 'single_currency',
      currencyAmounts: [{ currencyCode: 'CNY', currencyLabel: '人民币（CNY）', amount: 100 }],
      fxConverted: false,
    }
    payload.kpis = payload.kpis.map((item: { unit: string }) => item.unit === 'currency' ? { ...item, value: 100, currentValue: 100, dataStatus: 'complete', limitations: [] } : item)
    await route.fulfill({ response, json: payload })
  })
  await page.goto('/app/reports/overview')
  await expect(page.getByTestId('bi-dashboard')).toHaveAttribute('data-view', 'overview')
  await expect(page.getByText('币种：人民币（CNY）')).toBeVisible()
  await expect(page.getByRole('button', { name: /采购订单金额/ })).toContainText(/¥\s?100/)
  await expect(page.getByText('经营总览模块加载失败')).toHaveCount(0)
  expect(errors.join('\n')).not.toContain('Invalid currency code')
})

test('reports overview presents an unconverted multi-currency scope without crashing', async ({ page }) => {
  await authenticate(page)
  const errors = collectRuntimeErrors(page)
  await page.route('**/api/reports/query', async route => {
    const response = await route.fetch()
    const payload = await response.json()
    payload.dataScope = {
      ...payload.dataScope,
      currencyCode: null,
      currencyLabel: '多币种，未折算',
      currencies: ['CNY', 'USD'],
      currencyAggregationStatus: 'multi_currency_unconverted',
      currencyAmounts: [
        { currencyCode: 'CNY', currencyLabel: '人民币（CNY）', amount: 100 },
        { currencyCode: 'USD', currencyLabel: '美元（USD）', amount: 200 },
      ],
      fxConverted: false,
    }
    payload.kpis = payload.kpis.map((item: { unit: string }) => item.unit === 'currency' ? { ...item, value: null, currentValue: null, dataStatus: 'incomplete', limitations: ['multi_currency_unconverted'] } : item)
    await route.fulfill({ response, json: payload })
  })
  await page.goto('/app/reports/overview')
  await expect(page.getByTestId('bi-dashboard')).toHaveAttribute('data-view', 'overview')
  await expect(page.getByTestId('reports-multi-currency-status')).toContainText('多币种，未折算')
  await expect(page.getByTestId('reports-multi-currency-status')).toContainText('请选择币种')
  await expect(page.getByText('经营总览模块加载失败')).toHaveCount(0)
  expect(errors.join('\n')).not.toContain('Invalid currency code')
})
