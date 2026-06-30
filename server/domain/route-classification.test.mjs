import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DATABASE_MODE_MUTATION_BLOCKED_ERROR,
  ROUTE_CLASSES,
  classifyRoute,
  databaseModeMutationBlockedPayload,
  isDatabaseModeWriteBlocked,
  isLegacyMutationRoute,
  listRouteClassifications,
} from './route-classification.mjs'

test('route classification covers read preview legacy mutation and diagnostics routes', () => {
  assert.equal(classifyRoute('GET', '/api/health').classification, ROUTE_CLASSES.diagnostics)
  assert.equal(classifyRoute('GET', '/api/procurement/documents').classification, ROUTE_CLASSES.readOnly)
  assert.equal(classifyRoute('POST', '/api/action-drafts/preview').classification, ROUTE_CLASSES.previewOnly)
  assert.equal(classifyRoute('POST', '/api/purchase-requests').classification, ROUTE_CLASSES.legacyMutation)
  assert.equal(classifyRoute('PATCH', '/api/receiving-docs/GRN-1').classification, ROUTE_CLASSES.legacyMutation)
  assert.equal(classifyRoute('GET', '/index.html').classification, ROUTE_CLASSES.static)
})

test('database mode blocks legacy mutation routes but allows read and preview routes', () => {
  const blocked = [
    ['POST', '/api/auth/login'],
    ['POST', '/api/forecast-plans'],
    ['POST', '/api/sop-cycle'],
    ['POST', '/api/market-prices/refresh'],
    ['POST', '/api/purchase-requests'],
    ['PATCH', '/api/purchase-requests/PR-1/status'],
    ['POST', '/api/purchase-requests/PR-1/convert-to-po'],
    ['POST', '/api/rfqs'],
    ['PATCH', '/api/rfqs/RFQ-1/status'],
    ['POST', '/api/purchase-orders'],
    ['PATCH', '/api/purchase-orders/PO-1/status'],
    ['POST', '/api/receiving-docs'],
    ['PATCH', '/api/receiving-docs/GRN-1'],
  ]

  for (const [method, pathname] of blocked) {
    assert.equal(isLegacyMutationRoute(method, pathname), true, pathname)
    assert.equal(isDatabaseModeWriteBlocked({ persistenceMode: 'database', method, pathname }), true, pathname)
    assert.equal(isDatabaseModeWriteBlocked({ persistenceMode: 'json', method, pathname }), false, pathname)
  }

  const allowed = [
    ['GET', '/api/health'],
    ['GET', '/api/master-data/items'],
    ['GET', '/api/procurement/documents'],
    ['GET', '/api/inventory/items'],
    ['POST', '/api/action-drafts/preview'],
    ['POST', '/api/ai/chat'],
  ]

  for (const [method, pathname] of allowed) {
    assert.equal(isDatabaseModeWriteBlocked({ persistenceMode: 'database', method, pathname }), false, pathname)
  }
})

test('route classification metadata includes major route groups and clean block payload', () => {
  const groups = new Set(listRouteClassifications().map((route) => route.group))

  for (const group of ['ai', 'master-data', 'procurement-read', 'inventory-read', 'action-drafts', 'purchase-requests', 'rfqs', 'purchase-orders', 'receiving', 'forecast', 'planning', 'market', 'auth']) {
    assert.equal(groups.has(group), true, group)
  }

  assert.deepEqual(databaseModeMutationBlockedPayload(), {
    error: DATABASE_MODE_MUTATION_BLOCKED_ERROR,
  })
  assert.doesNotMatch(JSON.stringify(databaseModeMutationBlockedPayload()), /stack|trace|DATABASE_URL|OPENAI_API_KEY/)
})

test('database mode route metadata reflects migrated master data read adapter', () => {
  assert.equal(classifyRoute('GET', '/api/master-data/items').databaseMode, 'allowed-db-read')
  assert.equal(classifyRoute('GET', '/api/procurement/documents').databaseMode, 'allowed-json-read-fallback')
  assert.equal(classifyRoute('GET', '/api/inventory/items').databaseMode, 'allowed-json-read-fallback')
})
