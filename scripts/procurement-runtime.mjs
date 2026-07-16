import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { emptyProcurementRuntime } from '../server/repositories/durable-procurement-repository.mjs'

const command = process.argv[2]
if (!process.argv.includes('--confirm')) {
  console.error('Refusing to change procurement runtime without --confirm')
  process.exit(2)
}
const file = resolve('data/procurement-transactions.json')
await mkdir(dirname(file), { recursive: true })
let current = emptyProcurementRuntime()
try { current = JSON.parse(await readFile(file, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
const backup = resolve(`data/backups/procurement-transactions-${timestamp}.json`)
await mkdir(dirname(backup), { recursive: true })
try { await copyFile(file, backup) } catch (error) { if (error.code !== 'ENOENT') throw error; await writeFile(backup, JSON.stringify(current, null, 2)) }

if (command === 'reset') {
  const keys = ['purchaseRequests','rfqs','purchaseOrders','receipts','supplierInvoices','matchRecords','purchaseReturns','workItems','auditEvents','auditEntries','idempotencyRecords']
  for (const key of keys) console.log(`${key}: ${Array.isArray(current[key]) ? current[key].length : 0}`)
  await writeFile(file, JSON.stringify(emptyProcurementRuntime(), null, 2), 'utf8')
  console.log(`Backup: ${backup}`)
} else if (command === 'seed') {
  console.error('Demo procurement seed is not available for runtime schema v2.')
  process.exit(3)
} else {
  console.error('Expected reset or seed')
  process.exit(2)
}
