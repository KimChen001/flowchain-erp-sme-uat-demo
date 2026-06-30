import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildMasterDataSeedPlan } from '../server/persistence/seed-master-data-plan.mjs'
import { assertSafeTestDatabaseConfig, getTestDatabaseConfig } from '../server/persistence/test-db-config.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

function hasFlag(name) {
  return process.argv.includes(name)
}

async function main() {
  const dryRun = hasFlag('--dry-run') || !hasFlag('--apply')
  const sourcePath = path.join(root, 'data', 'scm-demo.json')
  const source = JSON.parse(await readFile(sourcePath, 'utf8'))
  const plan = buildMasterDataSeedPlan(source, { dryRun })
  const dbConfig = getTestDatabaseConfig(process.env)

  if (!dryRun) {
    assertSafeTestDatabaseConfig(process.env)
    throw new Error('DB seed apply mode is not implemented yet. Use --dry-run.')
  }

  console.log(JSON.stringify({
    mode: 'dry-run',
    databaseUrlTestConfigured: dbConfig.configured,
    plan,
  }, null, 2))
}

main().catch((error) => {
  console.error(error?.message || error)
  process.exitCode = 1
})
