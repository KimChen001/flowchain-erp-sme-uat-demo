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
    const dir = await mkdtemp(path.join(tmpdir(), 'srm-supplier-workbench-filter-'))
    const outfile = path.join(dir, 'filters.mjs')
    await build({
      entryPoints: ['src/modules/srm/filters.ts'],
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

const rows = [
  {
    supplier: {
      code: 'SUP-001',
      name: 'Alpha Components',
      legacyName: 'Alpha Legacy',
      matchNames: ['Alpha CN'],
      category: 'Electrical',
      riskStatus: '低',
      certificationStatus: '已认证',
      status: '启用',
    },
    category: 'Electrical',
    rating: 4.7,
    openPoCount: 3,
    invoiceVarianceCount: 0,
    reconciliationException: false,
  },
  {
    supplier: {
      code: 'SUP-002',
      name: 'Beta Metals',
      category: 'Metals',
      riskStatus: '高',
      certificationStatus: '整改中',
      status: '待完善',
    },
    category: 'Metals',
    rating: 3.8,
    openPoCount: 0,
    invoiceVarianceCount: 2,
    reconciliationException: true,
  },
]

async function filterWith(filters) {
  const { mod } = await loadFilterModule()
  return mod.filterSrmSuppliersForWorkbench(rows, {
    ...mod.defaultSrmSupplierWorkbenchFilters,
    ...filters,
  })
}

test('default filters return rows', async () => {
  assert.equal((await filterWith({})).length, 2)
})

test('filter by supplier code/name and relationship names', async () => {
  assert.deepEqual((await filterWith({ supplier: 'SUP-001' })).map((row) => row.supplier.code), ['SUP-001'])
  assert.deepEqual((await filterWith({ supplier: 'beta' })).map((row) => row.supplier.code), ['SUP-002'])
  assert.deepEqual((await filterWith({ supplier: 'alpha cn' })).map((row) => row.supplier.code), ['SUP-001'])
})

test('filter by category', async () => {
  assert.deepEqual((await filterWith({ category: 'Metals' })).map((row) => row.supplier.code), ['SUP-002'])
})

test('filter by risk status', async () => {
  assert.deepEqual((await filterWith({ riskStatus: '高' })).map((row) => row.supplier.code), ['SUP-002'])
})

test('filter by certification', async () => {
  assert.deepEqual((await filterWith({ certificationStatus: '已认证' })).map((row) => row.supplier.code), ['SUP-001'])
})

test('filter by status', async () => {
  assert.deepEqual((await filterWith({ status: '待完善' })).map((row) => row.supplier.code), ['SUP-002'])
})

test('filter by score range', async () => {
  assert.deepEqual((await filterWith({ scoreFrom: '4', scoreTo: '5' })).map((row) => row.supplier.code), ['SUP-001'])
})

test('filter by open PO flag', async () => {
  assert.deepEqual((await filterWith({ hasOpenPo: '否' })).map((row) => row.supplier.code), ['SUP-002'])
})

test('filter by invoice variance flag', async () => {
  assert.deepEqual((await filterWith({ hasInvoiceVariance: '是' })).map((row) => row.supplier.code), ['SUP-002'])
})

test('filter by reconciliation exception flag', async () => {
  assert.deepEqual((await filterWith({ hasReconciliationException: '是' })).map((row) => row.supplier.code), ['SUP-002'])
})

test('invalid score does not crash', async () => {
  assert.equal((await filterWith({ scoreFrom: 'not-a-number' })).length, 2)
})
