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
    const dir = await mkdtemp(path.join(tmpdir(), 'rfq-workbench-filter-'))
    const outfile = path.join(dir, 'filters.mjs')
    await build({
      entryPoints: ['src/modules/rfq/filters.ts'],
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

const rfqs = [
  {
    id: 'RFQ-1001',
    title: 'Motor A100 sourcing',
    category: 'Electrical',
    suppliers: 3,
    quoted: 0,
    bestPrice: 120,
    bestSupplier: 'ABC Components',
    due: '2026-06-18',
    status: '进行中',
    sourceRequest: 'PR-1001',
    sourceSku: 'A100',
    sourceName: 'Motor A100',
    invitedSuppliers: ['ABC Components', 'North Supply'],
  },
  {
    id: 'RFQ-1002',
    title: 'Bearing B200 spot buy',
    category: 'Mechanical',
    suppliers: 2,
    quoted: 2,
    bestPrice: 80,
    bestSupplier: 'Delta Plastics',
    due: '6月25日',
    status: '比价中',
    sourceRequest: 'PR-1002',
    sourceSku: 'B200',
    sourceName: 'Bearing B200',
    invitedSuppliers: ['Delta Plastics'],
  },
]

async function filterWith(filters) {
  const { mod } = await loadFilterModule()
  return mod.filterRfqsForWorkbench(rfqs, {
    ...mod.defaultRfqWorkbenchFilters,
    ...filters,
  })
}

test('default filters return all RFQs', async () => {
  assert.equal((await filterWith({})).length, 2)
})

test('filter by RFQ id', async () => {
  assert.deepEqual((await filterWith({ rfqId: '1001' })).map((rfq) => rfq.id), ['RFQ-1001'])
})

test('filter by supplier/bestSupplier', async () => {
  assert.deepEqual((await filterWith({ supplier: 'delta' })).map((rfq) => rfq.id), ['RFQ-1002'])
})

test('filter by SKU/title', async () => {
  assert.deepEqual((await filterWith({ skuOrItem: 'bearing' })).map((rfq) => rfq.id), ['RFQ-1002'])
})

test('filter by category', async () => {
  assert.deepEqual((await filterWith({ category: 'electrical' })).map((rfq) => rfq.id), ['RFQ-1001'])
})

test('filter by status', async () => {
  assert.deepEqual((await filterWith({ status: '比价中' })).map((rfq) => rfq.id), ['RFQ-1002'])
})

test('filter by response status', async () => {
  assert.deepEqual((await filterWith({ responseStatus: '未报价' })).map((rfq) => rfq.id), ['RFQ-1001'])
  assert.deepEqual((await filterWith({ responseStatus: '已报价' })).map((rfq) => rfq.id), ['RFQ-1002'])
})

test('filter by due date range', async () => {
  assert.deepEqual((await filterWith({ dueFrom: '2026-06-20', dueTo: '2026-06-30' })).map((rfq) => rfq.id), ['RFQ-1002'])
})

test('filter by source request', async () => {
  assert.deepEqual((await filterWith({ sourceRequest: 'PR-1001' })).map((rfq) => rfq.id), ['RFQ-1001'])
})

test('invalid date does not crash', async () => {
  assert.equal((await filterWith({ dueFrom: 'not-a-date' })).length, 2)
})
