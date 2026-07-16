import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const env = process.env
const checks = []
const check = (id, pass, remediation) => checks.push({ id, status: pass ? 'pass' : 'fail', ...(pass ? {} : { remediation }) })

check('persistence_mode', env.FLOWCHAIN_PERSISTENCE_MODE === 'database', 'Set FLOWCHAIN_PERSISTENCE_MODE=database.')
check('database_url', /^postgres(?:ql)?:\/\//i.test(String(env.DATABASE_URL || '')), 'Set DATABASE_URL to the Pilot PostgreSQL connection string.')
check('session_secret', String(env.FLOWCHAIN_LOCAL_SESSION_SECRET || '').length >= 32, 'Set FLOWCHAIN_LOCAL_SESSION_SECRET to at least 32 random characters.')
check('default_tenant', Boolean(String(env.FLOWCHAIN_DEFAULT_TENANT_ID || '').trim()), 'Set FLOWCHAIN_DEFAULT_TENANT_ID to the provisioned workspace id.')
check('receiving_posting', env.FLOWCHAIN_ENABLE_DB_RECEIVING_POSTING === 'true', 'Set FLOWCHAIN_ENABLE_DB_RECEIVING_POSTING=true.')
check('outbound_posting', env.FLOWCHAIN_ENABLE_DB_OUTBOUND_POSTING === 'true', 'Set FLOWCHAIN_ENABLE_DB_OUTBOUND_POSTING=true.')
check('inventory_operations', env.FLOWCHAIN_ENABLE_DB_INVENTORY_OPERATIONS === 'true', 'Set FLOWCHAIN_ENABLE_DB_INVENTORY_OPERATIONS=true.')
check('bootstrap_disabled', env.FLOWCHAIN_ALLOW_LOCAL_ACTOR_BOOTSTRAP !== 'true', 'Disable FLOWCHAIN_ALLOW_LOCAL_ACTOR_BOOTSTRAP outside disposable local tests.')
check('identity_migration', existsSync(path.join(root, 'prisma/migrations/20260715020000_pilot_identity_foundation/migration.sql')), 'Deploy the Pilot identity migration.')
check('import_migration', existsSync(path.join(root, 'prisma/migrations/20260715021000_pilot_import_foundation/migration.sql')), 'Deploy the Pilot import migration.')
check('inventory_operations_migration', existsSync(path.join(root, 'prisma/migrations/20260716010000_inventory_operations_foundation/migration.sql')), 'Deploy the Inventory Operations foundation migration.')

const report = { ready: checks.every(row => row.status === 'pass'), checkedAt: new Date().toISOString(), checks }
if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2))
else {
  console.log(`FlowChain Pilot deployment check: ${report.ready ? 'PASS' : 'FAIL'}`)
  for (const row of checks) console.log(`${row.status === 'pass' ? '[PASS]' : '[FAIL]'} ${row.id}${row.remediation ? ` — ${row.remediation}` : ''}`)
}
process.exitCode = report.ready ? 0 : 1
