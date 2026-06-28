import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

let modulePromise

async function loadSrmApiModule() {
  if (modulePromise) return modulePromise
  modulePromise = (async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'srm-api-'))
    const outfile = path.join(dir, 'api.mjs')
    await build({
      entryPoints: ['src/modules/srm/api.ts'],
      outfile,
      bundle: true,
      platform: 'node',
      format: 'esm',
      external: ['react', 'react-dom'],
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

const fallbackSuppliers = [
  {
    code: 'SUP-001',
    name: 'Fallback Supplier',
    category: '机械部件',
    contact: '王经理',
    email: 'supplier@example.test',
    phone: '021-0000',
    paymentTerms: 'NET30',
    currency: 'CNY',
    taxId: 'TAX-ID',
    defaultTaxCode: 'VAT13-IN',
    rating: 4.2,
    onTimeRate: 91,
    qualityRate: 96,
    riskStatus: '中',
    certificationStatus: '已认证',
    status: '启用',
  },
]

test('normalizeSrmSupplierProfiles maps API identity fields and preserves SRM-only fields', async () => {
  const { mod } = await loadSrmApiModule()
  const rows = mod.normalizeSrmSupplierProfiles([
    {
      id: 'SUP-001',
      name: 'API Supplier',
      categories: ['电气元件'],
      paymentTermsId: 'NET45',
      defaultCurrency: 'USD',
      status: 'active',
      risk: 'high',
      score: '4.8',
      preferred: true,
    },
  ], fallbackSuppliers)

  assert.equal(rows[0].code, 'SUP-001')
  assert.equal(rows[0].name, 'API Supplier')
  assert.equal(rows[0].category, '电气元件')
  assert.equal(rows[0].paymentTerms, 'NET45')
  assert.equal(rows[0].currency, 'USD')
  assert.equal(rows[0].status, '启用')
  assert.equal(rows[0].riskStatus, '高')
  assert.equal(rows[0].rating, 4.8)
  assert.equal(rows[0].contact, '王经理')
  assert.equal(rows[0].email, 'supplier@example.test')
  assert.equal(rows[0].phone, '021-0000')
  assert.equal(rows[0].taxId, 'TAX-ID')
  assert.equal(rows[0].defaultTaxCode, 'VAT13-IN')
  assert.equal(rows[0].onTimeRate, 91)
  assert.equal(rows[0].qualityRate, 96)
  assert.equal(rows[0].certificationStatus, '已认证')
})

test('normalizeSrmSupplierProfiles returns fallback when API list is undefined', async () => {
  const { mod } = await loadSrmApiModule()
  assert.equal(mod.normalizeSrmSupplierProfiles(undefined, fallbackSuppliers), fallbackSuppliers)
})

test('normalizeSrmSupplierProfiles merges by supplier id or code', async () => {
  const { mod } = await loadSrmApiModule()
  const rows = mod.normalizeSrmSupplierProfiles([
    {
      id: 'SUP-001',
      name: 'Renamed Supplier',
      risk: '低',
    },
  ], fallbackSuppliers)

  assert.equal(rows[0].code, 'SUP-001')
  assert.equal(rows[0].name, 'Renamed Supplier')
  assert.equal(rows[0].riskStatus, '低')
  assert.equal(rows[0].contact, '王经理')
  assert.equal(rows[0].onTimeRate, 91)
  assert.equal(rows[0].qualityRate, 96)
})

test('normalizeSrmSupplierProfiles creates a reasonable row for API-only suppliers', async () => {
  const { mod } = await loadSrmApiModule()
  const rows = mod.normalizeSrmSupplierProfiles([
    {
      id: 'SUP-NEW',
      name: 'New Supplier',
      categories: ['原材料'],
      paymentTermsId: 'NET60',
      defaultCurrency: 'CNY',
      status: 'pending',
      risk: 'medium',
      preferred: false,
    },
  ], [])

  assert.equal(rows[0].code, 'SUP-NEW')
  assert.equal(rows[0].name, 'New Supplier')
  assert.equal(rows[0].category, '原材料')
  assert.equal(rows[0].paymentTerms, 'NET60')
  assert.equal(rows[0].currency, 'CNY')
  assert.equal(rows[0].status, '待完善')
  assert.equal(rows[0].riskStatus, '中')
  assert.equal(rows[0].certificationStatus, '待复核')
  assert.equal(rows[0].rating, 0)
  assert.equal(rows[0].onTimeRate, 0)
  assert.equal(rows[0].qualityRate, 0)
})

test('normalizeSrmSupplierProfiles maps inactive and disabled supplier status consistently', async () => {
  const { mod } = await loadSrmApiModule()
  const rows = mod.normalizeSrmSupplierProfiles([
    { id: 'SUP-001', name: 'Inactive Supplier', status: 'disabled', risk: '高' },
  ], fallbackSuppliers)

  assert.equal(rows[0].status, '停用')
  assert.equal(rows[0].riskStatus, '高')
  assert.equal(rows[0].onTimeRate, 91)
  assert.equal(rows[0].qualityRate, 96)
})
