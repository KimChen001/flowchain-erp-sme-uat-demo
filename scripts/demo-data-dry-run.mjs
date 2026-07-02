import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const COUNT_KEYS = [
  'purchaseOrders',
  'purchaseRequests',
  'rfqs',
  'products',
  'receivingDocs',
  'supplierInvoices',
  'suppliers',
]

export function summarizeDemoDataDryRun(source = {}, { operation = 'clear' } = {}) {
  const counts = Object.fromEntries(COUNT_KEYS.map((key) => [key, Array.isArray(source[key]) ? source[key].length : 0]))
  return {
    operation,
    dryRun: true,
    writesFiles: false,
    deletesUserData: false,
    protectedSource: 'data/scm-demo.json',
    wouldSeed: operation === 'seed' ? counts : {},
    wouldClear: operation === 'clear' || operation === 'reset' ? counts : {},
    wouldReset: operation === 'reset' ? counts : {},
    counts,
    message: 'Dry-run only. No files are written and no user data is touched.',
  }
}

export async function runDemoDataDryRun({ argv = process.argv, cwd = root } = {}) {
  const operation = ['seed', 'clear', 'reset'].includes(argv[2]) ? argv[2] : 'clear'
  const sourcePath = path.join(cwd, 'data', 'scm-demo.json')
  const source = JSON.parse(await readFile(sourcePath, 'utf8'))
  return summarizeDemoDataDryRun(source, { operation })
}

async function main() {
  const result = await runDemoDataDryRun()
  console.log(JSON.stringify(result, null, 2))
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((error) => {
    console.error(error?.message || error)
    process.exitCode = 1
  })
}
