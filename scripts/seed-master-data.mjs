import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { seedMasterData } from '../server/persistence/seed-master-data.mjs'

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
  const result = await seedMasterData(source, { dryRun })
  console.log(JSON.stringify({
    mode: result.mode,
    rowCounts: result.rowCounts,
    upsertedCounts: result.upsertedCounts || null,
    plan: result.plan,
  }, null, 2))
}

main().catch((error) => {
  console.error(error?.message || error)
  process.exitCode = 1
})
