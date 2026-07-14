import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8')

test('frontend session storage migrates legacy keys and sends only the signed bearer token', async () => {
  const source = await read('src/lib/api-client.ts')
  assert.match(source, /AUTH_TOKEN_KEY = 'flowchain:auth-token'/)
  assert.match(source, /CURRENT_USER_KEY = 'flowchain:current-user'/)
  assert.match(source, /removeItem\(LEGACY_AUTH_TOKEN_KEY\)/)
  assert.match(source, /removeItem\(LEGACY_CURRENT_USER_KEY\)/)
  assert.match(source, /Authorization: `Bearer \$\{token\}`/)
  assert.doesNotMatch(source, /X-FlowChain-(?:Role|User)/i)
})

test('ApiError preserves structured workflow and optimistic-concurrency fields', async () => {
  const source = await read('src/lib/api-client.ts')
  for (const field of ['status', 'code', 'details', 'entityId', 'currentStatus', 'currentVersion', 'expectedVersion', 'payload']) {
    assert.match(source, new RegExp(`this\\.${field}\\s*=`), `ApiError must preserve ${field}`)
  }
})

test('formal entity lists use route-addressable entity links', async () => {
  const [requests, items, suppliers, orders] = await Promise.all([
    read('src/modules/purchase-requests/CanonicalProcurementPanel.tsx'),
    read('src/modules/master-data/ItemMasterWorkbench.tsx'),
    read('src/modules/srm/Page.tsx'),
    read('src/modules/procurement/Page.tsx'),
  ])
  assert.match(requests, /kind="purchase_request"/)
  assert.match(requests, /kind="purchase_order"/)
  assert.match(items, /kind="item"/)
  assert.match(items, /kind="supplier"/)
  assert.match(suppliers, /kind="supplier"/)
  assert.match(suppliers, /kind="item"/)
  assert.match(orders, /kind="purchase_request"/)
})
