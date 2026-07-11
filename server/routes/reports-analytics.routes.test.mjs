import test from 'node:test'
import assert from 'node:assert/strict'
import { handleReportsAnalyticsRoute } from './reports-analytics.routes.mjs'

test('POST /api/reports/query returns the governed dashboard contract', async () => {
  let response = null
  const ctx = {
    req: { method: 'POST' }, res: {}, url: new URL('/api/reports/query', 'http://localhost'),
    db: { suppliers: [{ name: '深圳新元电气' }, { name: '华东精工机械' }], products: [], purchaseOrders: [], receivingDocs: [], rfqs: [] },
    async readBody() { return { subject: 'finance', filters: { currency: 'CNY' }, comparison: 'previous_period' } },
    send(_res, status, payload) { response = { status, payload } },
  }
  const handled = await handleReportsAnalyticsRoute(ctx)
  assert.equal(handled, true)
  assert.equal(response.status, 200)
  for (const key of ['kpis', 'charts', 'details', 'columnDefinitions', 'exportRows', 'dataScope']) assert.ok(key in response.payload, `missing ${key}`)
})
