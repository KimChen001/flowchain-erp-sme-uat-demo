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
    const dir = await mkdtemp(path.join(tmpdir(), 'po-workbench-filter-'))
    const outfile = path.join(dir, 'filters.mjs')
    await build({
      entryPoints: ['src/modules/purchasing/filters.ts'],
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

const orders = [
  {
    po: 'PO-1001',
    supplier: 'ABC Components',
    created: '2026-06-01',
    eta: '2026-06-15',
    owner: 'Buyer A',
    amount: 12000,
    items: 2,
    received: 0,
    status: '已发出',
    priority: '高',
    paid: false,
    source: 'forecast',
    sourceSku: 'A100',
    sourceName: 'Motor A100',
    lines: [
      {
        poLineId: 'PO-1001-L1',
        sku: 'A100',
        itemName: 'Motor A100',
        quantityOrdered: 10,
        quantityReceived: 0,
        quantityAccepted: 0,
        quantityRejected: 0,
        unit: 'pcs',
        unitPrice: 1200,
        currency: 'USD',
      },
    ],
  },
  {
    po: 'PO-1002',
    supplier: 'Delta Plastics',
    created: '2026-06-02',
    eta: '6月20日',
    owner: 'Buyer B',
    amount: 8000,
    items: 1,
    received: 1,
    status: '已完成',
    priority: '中',
    paid: true,
    source: 'manual',
    sourceSku: 'D200',
    sourceName: 'Delta Resin',
  },
]

async function filterWith(filters) {
  const { mod } = await loadFilterModule()
  return mod.filterPurchaseOrdersForWorkbench(orders, {
    ...mod.defaultPurchaseOrderWorkbenchFilters,
    ...filters,
  })
}

test('default filters return all orders', async () => {
  assert.equal((await filterWith({})).length, 2)
})

test('filters by PO number', async () => {
  assert.deepEqual((await filterWith({ poNumber: '1001' })).map((order) => order.po), ['PO-1001'])
})

test('filters by supplier', async () => {
  assert.deepEqual((await filterWith({ supplier: 'delta' })).map((order) => order.po), ['PO-1002'])
})

test('filters by status', async () => {
  assert.deepEqual((await filterWith({ status: '已完成' })).map((order) => order.po), ['PO-1002'])
})

test('filters by source', async () => {
  assert.deepEqual((await filterWith({ source: 'forecast' })).map((order) => order.po), ['PO-1001'])
})

test('filters by owner', async () => {
  assert.deepEqual((await filterWith({ owner: 'buyer b' })).map((order) => order.po), ['PO-1002'])
})

test('filters by ETA date range', async () => {
  assert.deepEqual((await filterWith({ etaFrom: '2026-06-16', etaTo: '2026-06-25' })).map((order) => order.po), ['PO-1002'])
})

test('invalid date does not crash', async () => {
  assert.equal((await filterWith({ etaFrom: 'not-a-date' })).length, 2)
})

test('filters by source SKU, source name, and line item fields', async () => {
  assert.deepEqual((await filterWith({ skuOrItem: 'A100' })).map((order) => order.po), ['PO-1001'])
  assert.deepEqual((await filterWith({ skuOrItem: 'resin' })).map((order) => order.po), ['PO-1002'])
})

test('empty fields do not filter', async () => {
  assert.equal((await filterWith({
    poNumber: '',
    supplier: '',
    skuOrItem: '',
    owner: '',
    etaFrom: '',
    etaTo: '',
  })).length, 2)
})
