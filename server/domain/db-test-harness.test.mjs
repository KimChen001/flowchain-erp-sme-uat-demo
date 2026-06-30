import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMasterDataSeedPlan } from '../persistence/seed-master-data-plan.mjs'
import { assertSafeTestDatabaseConfig, envForTestDatabase, getTestDatabaseConfig } from '../persistence/test-db-config.mjs'
import { shouldSkipDbTests, withTestDatabase } from '../persistence/test-db-harness.mjs'

function createDb() {
  return {
    products: [
      { sku: 'A100', name: 'Motor A100', supplier: 'ABC Components', moq: 100 },
      { sku: 'B200', name: 'Bracket B200', supplier: 'Missing Supplier' },
    ],
    suppliers: [{ id: 'SUP-001', name: 'ABC Components', category: 'Motors' }],
    warehouses: [{ id: 'WH-MAIN', name: 'Main Warehouse' }],
    paymentTerms: [{ id: 'NET45', label: 'Net 45', days: 45 }],
    taxCodes: [{ id: 'TAX-ZERO', label: 'Zero Tax', rate: 0 }],
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

test('test DB config skips cleanly without DATABASE_URL_TEST', () => {
  const config = getTestDatabaseConfig({})

  assert.equal(config.configured, false)
  assert.equal(config.skipReason, 'DATABASE_URL_TEST is not configured.')
  assert.deepEqual(shouldSkipDbTests({}), {
    skip: true,
    reason: 'DATABASE_URL_TEST is not configured.',
    config,
  })
})

test('test DB config refuses production-like test database URLs by default', () => {
  assert.throws(
    () => assertSafeTestDatabaseConfig({ DATABASE_URL_TEST: 'postgresql://user:pass@localhost:5432/flowchain_prod' }),
    (error) => error.code === 'FLOWCHAIN_TEST_DB_UNSAFE'
  )

  assert.equal(assertSafeTestDatabaseConfig({
    DATABASE_URL_TEST: 'postgresql://user:pass@localhost:5432/flowchain_prod',
    FLOWCHAIN_ALLOW_PRODUCTION_TEST_DB: 'true',
  }).allowProduction, true)
})

test('test DB env maps DATABASE_URL_TEST without touching production DATABASE_URL', () => {
  const env = envForTestDatabase({
    DATABASE_URL: 'postgresql://prod-user:pass@db:5432/flowchain',
    DATABASE_URL_TEST: 'postgresql://test-user:pass@localhost:5432/flowchain_test',
  })

  assert.equal(env.FLOWCHAIN_PERSISTENCE_MODE, 'database')
  assert.equal(env.DATABASE_URL, 'postgresql://test-user:pass@localhost:5432/flowchain_test')
})

test('withTestDatabase reports skip without opening Prisma when DATABASE_URL_TEST is absent', async () => {
  const result = await withTestDatabase({}, () => {
    throw new Error('callback should not run')
  })

  assert.deepEqual(result, {
    skipped: true,
    reason: 'DATABASE_URL_TEST is not configured.',
  })
})

test('master data seed plan is deterministic and does not mutate source', () => {
  const db = createDb()
  const before = clone(db)
  const first = buildMasterDataSeedPlan(db, { tenantId: 'tenant-test' })
  const second = buildMasterDataSeedPlan(db, { tenantId: 'tenant-test' })

  assert.deepEqual(first, second)
  assert.equal(first.dryRun, true)
  assert.equal(first.tenantId, 'tenant-test')
  assert.deepEqual(first.seedOrder, ['Tenant', 'PaymentTerm', 'TaxCode', 'Supplier', 'Warehouse', 'Item'])
  assert.equal(first.counts.items, 2)
  assert.equal(first.counts.suppliers, 1)
  assert.deepEqual(first.unresolvedReferences.itemPreferredSuppliers, ['Missing Supplier'])
  assert.equal(first.mutatesSource, false)
  assert.deepEqual(db, before)
})
