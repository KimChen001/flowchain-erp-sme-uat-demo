import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

let modulePromise

async function loadFilterModule() {
  if (modulePromise) return modulePromise
  modulePromise = (async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'pr-workbench-filter-'))
    const outfile = path.join(dir, 'filters.mjs')
    await build({
      entryPoints: ['src/modules/purchase-requests/filters.ts'],
      outfile,
      bundle: true,
      platform: 'node',
      format: 'esm',
      logLevel: 'silent',
    })
    const mod = await import(pathToFileURL(outfile).href)
    return { mod, cleanup: () => rm(dir, { recursive: true, force: true }) }
  })()
  return modulePromise
}

test.after(async () => {
  if (!modulePromise) return
  const loaded = await modulePromise
  await loaded.cleanup()
})

const requests = [
  {
    pr: 'PR-1001',
    source: 'forecast',
    sourceSku: 'A100',
    sourceName: 'Motor A100',
    supplier: 'ABC Components',
    requester: 'Planner A',
    buyer: 'Buyer A',
    created: '2026-06-01',
    requiredDate: '2026-06-18',
    quantity: 10,
    unit: 'pcs',
    unitPrice: 12,
    amount: 120,
    priority: '高',
    status: '待审批',
    reason: 'Demand signal',
  },
  {
    pr: 'PR-1002',
    source: 'inventory',
    sourceSku: 'B200',
    sourceName: 'Bearing B200',
    supplier: 'Delta Plastics',
    requester: 'Planner B',
    buyer: 'Buyer B',
    created: '2026-06-02',
    requiredDate: '6月25日',
    quantity: 20,
    unit: 'pcs',
    unitPrice: 8,
    amount: 160,
    priority: '中',
    status: '已批准',
    reason: 'Reorder point',
  },
]

async function filterWith(filters) {
  const { mod } = await loadFilterModule()
  return mod.filterPurchaseRequestsForWorkbench(requests, {
    ...mod.defaultPurchaseRequestWorkbenchFilters,
    ...filters,
  })
}

test('default filters return all requests', async () => {
  assert.equal((await filterWith({})).length, 2)
})

test('filter by PR number', async () => {
  assert.deepEqual((await filterWith({ prNumber: '1001' })).map((request) => request.pr), ['PR-1001'])
})

test('filter by supplier', async () => {
  assert.deepEqual((await filterWith({ supplier: 'delta' })).map((request) => request.pr), ['PR-1002'])
})

test('filter by SKU/item', async () => {
  assert.deepEqual((await filterWith({ skuOrItem: 'bearing' })).map((request) => request.pr), ['PR-1002'])
})

test('filter by requester', async () => {
  assert.deepEqual((await filterWith({ requester: 'planner a' })).map((request) => request.pr), ['PR-1001'])
})

test('filter by buyer', async () => {
  assert.deepEqual((await filterWith({ buyer: 'buyer b' })).map((request) => request.pr), ['PR-1002'])
})

test('filter by status', async () => {
  assert.deepEqual((await filterWith({ status: '已批准' })).map((request) => request.pr), ['PR-1002'])
})

test('filter by priority', async () => {
  assert.deepEqual((await filterWith({ priority: '高' })).map((request) => request.pr), ['PR-1001'])
})

test('filter by source', async () => {
  assert.deepEqual((await filterWith({ source: 'inventory' })).map((request) => request.pr), ['PR-1002'])
})

test('filter by required date range', async () => {
  assert.deepEqual((await filterWith({ requiredFrom: '2026-06-20', requiredTo: '2026-06-30' })).map((request) => request.pr), ['PR-1002'])
})

test('invalid date does not crash', async () => {
  assert.equal((await filterWith({ requiredFrom: 'not-a-date' })).length, 2)
})
