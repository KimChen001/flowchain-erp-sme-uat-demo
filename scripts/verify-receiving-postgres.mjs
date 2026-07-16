import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import EmbeddedPostgres from 'embedded-postgres'

const execFileAsync = promisify(execFile)
const root = resolve(import.meta.dirname, '..')
const baselineName = '20260715010000_baseline'
const baselineSqlPath = join(root, 'prisma', 'migrations', baselineName, 'migration.sql')
const preflightSqlPath = join(root, 'prisma', 'migrations', '20260715011000_receiving_posting_foundation', 'preflight.sql')
const node = process.execPath
const prismaCli = join(root, 'node_modules', 'prisma', 'build', 'index.js')
const testFiles = [
  'server/domain/receiving-posting-transaction.test.mjs',
  'server/domain/receiving-transaction-policy.test.mjs',
  'server/domain/receiving-reversal-transaction.test.mjs',
  'server/domain/receiving-workbench-query-service.test.mjs',
  'server/domain/pilot-workspace.test.mjs',
  'server/domain/pilot-import-service.test.mjs',
  'server/domain/pilot-operations-service.test.mjs',
]

function sanitize(value, secrets = []) {
  let output = String(value || '')
  for (const secret of secrets.filter(Boolean)) output = output.split(secret).join('[REDACTED]')
  return output.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[REDACTED_DATABASE_URL]')
}

async function run(command, args, { env = process.env, allowFailure = false, secrets = [] } = {}) {
  try {
    const result = await execFileAsync(command, args, { cwd: root, env, maxBuffer: 20 * 1024 * 1024 })
    const output = `${result.stdout || ''}${result.stderr || ''}`
    if (output.trim()) process.stdout.write(sanitize(output, secrets))
    return { code: 0, output }
  } catch (error) {
    const output = `${error.stdout || ''}${error.stderr || ''}`
    if (output.trim()) process.stdout.write(sanitize(output, secrets))
    if (!allowFailure) throw new Error(`${command} ${args.join(' ')} failed with exit code ${error.code}`)
    return { code: Number(error.code) || 1, output }
  }
}

async function availablePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close(() => resolvePort(address.port))
    })
  })
}

async function query(pg, database, sql, params = []) {
  const client = pg.getPgClient(database, '127.0.0.1')
  await client.connect()
  try {
    return await client.query(sql, params)
  } finally {
    await client.end()
  }
}

function databaseUrl({ port, user, password, database }) {
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@127.0.0.1:${port}/${database}?schema=public`
}

function databaseEnv(url) {
  return {
    ...process.env,
    DATABASE_URL: url,
    DATABASE_URL_TEST: url,
    FLOWCHAIN_PERSISTENCE_MODE: 'database',
    FLOWCHAIN_REQUIRE_REAL_POSTGRES_TESTS: 'true',
    NODE_ENV: 'test',
  }
}

async function deploy(url, options = {}) {
  return run(node, [prismaCli, 'migrate', 'deploy'], { ...options, env: databaseEnv(url) })
}

async function resolveBaseline(url, secrets) {
  await run(node, [prismaCli, 'migrate', 'resolve', '--applied', baselineName], { env: databaseEnv(url), secrets })
}

async function assertFreshSchema(pg, database) {
  const table = await query(pg, database, `SELECT to_regclass('"BusinessCommandExecution"') AS name`)
  assert.equal(table.rows[0].name, '"BusinessCommandExecution"')
  const balanceUnique = await query(pg, database, `
    SELECT indexdef FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'InventoryBalance'
      AND indexdef ILIKE '%UNIQUE%' AND indexdef LIKE '%"warehouseKey"%'
      AND indexdef LIKE '%"locationKey"%'
  `)
  assert.equal(balanceUnique.rowCount, 1)
  const idempotencyUnique = await query(pg, database, `
    SELECT indexdef FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'BusinessCommandExecution'
      AND indexdef ILIKE '%UNIQUE%' AND indexdef LIKE '%"idempotencyKey"%'
  `)
  assert.equal(idempotencyUnique.rowCount, 1)
  const postingColumns = await query(pg, database, `
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ReceivingDocument'
      AND column_name IN ('postingStatus', 'postedAt', 'reversedAt', 'version')
  `)
  assert.equal(postingColumns.rowCount, 4)
}

async function runDbTests(url, label, files = testFiles, secrets = []) {
  console.log(`\n[${label}] Running real PostgreSQL transaction tests`)
  const result = await run(node, ['--test', '--test-concurrency=1', '--test-reporter=tap', ...files], { env: databaseEnv(url), secrets })
  assert.match(result.output, /# fail 0(?:\r?\n|$)/, `${label} reported test failures`)
  assert.match(result.output, /# skipped 0(?:\r?\n|$)/, `${label} skipped a required database test`)
  return result.output
}

async function seedBaselineMarker(pg, database) {
  await query(pg, database, `
    INSERT INTO "Tenant" ("id", "name", "updatedAt") VALUES ('baseline-tenant', 'Baseline Tenant', NOW());
    INSERT INTO "Warehouse" ("id", "tenantId", "code", "name", "updatedAt") VALUES ('baseline-warehouse', 'baseline-tenant', 'BASE', 'Baseline Warehouse', NOW());
    INSERT INTO "Item" ("id", "tenantId", "sku", "name", "unit", "updatedAt") VALUES ('baseline-item', 'baseline-tenant', 'BASE-SKU', 'Baseline Item', 'EA', NOW());
    INSERT INTO "InventoryBalance" ("id", "tenantId", "itemId", "sku", "itemName", "warehouseId", "location", "availableQuantity", "onHandQuantity", "reservedQuantity", "unit", "updatedAt")
    VALUES ('baseline-balance', 'baseline-tenant', 'baseline-item', 'BASE-SKU', 'Baseline Item', 'baseline-warehouse', ' A-01 ', 3, 3, 0, 'EA', NOW());
  `)
}

async function verifyBaselineUpgrade(pg, database, url, secrets) {
  console.log('\n[baseline-upgrade] Applying authoritative baseline only')
  await query(pg, database, await readFile(baselineSqlPath, 'utf8'))
  await resolveBaseline(url, secrets)
  await seedBaselineMarker(pg, database)
  console.log('[baseline-upgrade] Applying additive receiving migration')
  await deploy(url, { secrets })
  const preserved = await query(pg, database, `
    SELECT "onHandQuantity"::text AS quantity, "warehouseKey", "locationKey", "version"
    FROM "InventoryBalance" WHERE "id" = 'baseline-balance'
  `)
  assert.deepEqual(preserved.rows[0], { quantity: '3.0000', warehouseKey: 'baseline-warehouse', locationKey: 'a-01', version: 0 })
  await runDbTests(url, 'baseline-upgrade', ['server/domain/receiving-posting-transaction.test.mjs'], secrets)
}

async function verifyDuplicatePreflight(pg, database, url, secrets) {
  console.log('\n[duplicate-preflight] Creating duplicate legacy balance keys')
  await query(pg, database, await readFile(baselineSqlPath, 'utf8'))
  await resolveBaseline(url, secrets)
  await query(pg, database, `
    INSERT INTO "Tenant" ("id", "name", "updatedAt") VALUES ('duplicate-tenant', 'Duplicate Tenant', NOW());
    INSERT INTO "Warehouse" ("id", "tenantId", "code", "name", "updatedAt") VALUES ('duplicate-warehouse', 'duplicate-tenant', 'DUP', 'Duplicate Warehouse', NOW());
    INSERT INTO "Item" ("id", "tenantId", "sku", "name", "unit", "updatedAt") VALUES ('duplicate-item', 'duplicate-tenant', 'DUP-SKU', 'Duplicate Item', 'EA', NOW());
    INSERT INTO "InventoryBalance" ("id", "tenantId", "itemId", "sku", "warehouseId", "location", "availableQuantity", "onHandQuantity", "reservedQuantity", "updatedAt") VALUES
      ('duplicate-balance-a', 'duplicate-tenant', 'duplicate-item', 'DUP-SKU', 'duplicate-warehouse', ' A-01 ', 1, 1, 0, NOW()),
      ('duplicate-balance-b', 'duplicate-tenant', 'duplicate-item', 'DUP-SKU', 'duplicate-warehouse', 'a-01', 2, 2, 0, NOW());
  `)
  const preflight = await query(pg, database, await readFile(preflightSqlPath, 'utf8'))
  assert.equal(preflight.rowCount, 1)
  assert.equal(Number(preflight.rows[0].duplicateCount), 2)
  const failedDeploy = await deploy(url, { allowFailure: true, secrets })
  assert.notEqual(failedDeploy.code, 0, 'additive migration unexpectedly accepted duplicate balances')
  assert.match(failedDeploy.output, /FLOWCHAIN_INVENTORY_BALANCE_DUPLICATES/)
  const remaining = await query(pg, database, `SELECT count(*)::int AS count, sum("onHandQuantity")::text AS quantity FROM "InventoryBalance" WHERE "tenantId" = 'duplicate-tenant'`)
  assert.deepEqual(remaining.rows[0], { count: 2, quantity: '3.0000' })
  console.log('[duplicate-preflight] PASS: migration stopped; both rows and quantities remain unchanged. Remediation requires business-approved correction; no SQL was auto-run.')
}

async function main() {
  if (process.env.DATABASE_URL_TEST) {
    console.log('DATABASE_URL_TEST is set; its secret is not displayed. This full verification uses a new embedded cluster so fresh/upgrade/destructive scenarios remain isolated.')
  } else {
    console.log('DATABASE_URL_TEST is not set; using a workspace-local embedded PostgreSQL cluster.')
  }
  const port = await availablePort()
  const user = 'flowchain_verifier'
  const password = `local-${randomUUID()}`
  const directory = await mkdtemp(join(tmpdir(), 'flowchain-receiving-pg-'))
  const pg = new EmbeddedPostgres({
    databaseDir: directory,
    user,
    password,
    port,
    persistent: false,
    onLog: () => {},
    onError: (error) => process.stderr.write(`${sanitize(error, [password])}\n`),
  })
  const databases = {
    fresh: 'flowchain_receiving_fresh_test',
    baseline: 'flowchain_receiving_baseline_test',
    duplicate: 'flowchain_receiving_duplicate_test',
  }
  const secrets = [password]
  try {
    await pg.initialise()
    await pg.start()
    for (const database of Object.values(databases)) await pg.createDatabase(database)
    const identity = await query(pg, databases.fresh, 'SELECT version(), current_database(), current_user')
    console.log(`PostgreSQL: ${identity.rows[0].version}`)
    console.log(`Connection: host=127.0.0.1 port=${port} database=${identity.rows[0].current_database} user=${identity.rows[0].current_user} schema=public`)

    const freshUrl = databaseUrl({ port, user, password, database: databases.fresh })
    console.log('\n[fresh] Running prisma migrate deploy')
    await deploy(freshUrl, { secrets })
    await assertFreshSchema(pg, databases.fresh)
    await runDbTests(freshUrl, 'fresh', testFiles, secrets)

    const baselineUrl = databaseUrl({ port, user, password, database: databases.baseline })
    await verifyBaselineUpgrade(pg, databases.baseline, baselineUrl, secrets)

    const duplicateUrl = databaseUrl({ port, user, password, database: databases.duplicate })
    await verifyDuplicatePreflight(pg, databases.duplicate, duplicateUrl, secrets)

    console.log('\nPostgreSQL receiving verification: PASS')
  } finally {
    await pg.stop().catch(() => {})
    await rm(directory, { recursive: true, force: true }).catch(() => {})
  }
}

main().catch((error) => {
  console.error(`PostgreSQL receiving verification: FAIL\n${sanitize(error?.stack || error)}`)
  process.exit(1)
})
