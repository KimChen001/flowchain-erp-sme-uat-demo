import { access, copyFile, mkdir, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { createDurableItemMasterRepository } from '../server/repositories/durable-item-master-repository.mjs'
import { createDurableSupplierRepository } from '../server/repositories/durable-supplier-repository.mjs'
import { createDurableCustomerRepository } from '../server/repositories/durable-customer-repository.mjs'
import { listMasterItems } from '../server/domain/master-data.mjs'

const root = resolve(import.meta.dirname, '..')
const source = join(root, 'data', 'scm-demo.json')
const targets = {
  items: resolve(process.env.FLOWCHAIN_ITEM_RUNTIME_FILE || join(root, 'data', 'item-master-runtime.json')),
  suppliers: resolve(process.env.FLOWCHAIN_SUPPLIER_RUNTIME_FILE || join(root, 'data', 'supplier-master-runtime.json')),
  customers: resolve(process.env.FLOWCHAIN_CUSTOMER_RUNTIME_FILE || join(root, 'data', 'customer-master-runtime.json')),
}

console.log('FlowChain explicit runtime seed targets:')
for (const [kind, file] of Object.entries(targets)) console.log(`- ${kind}: ${file}`)

if (!process.argv.includes('--confirm')) {
  console.error('No files were read or written. Re-run with --confirm to seed runtime data explicitly.')
  process.exitCode = 2
} else {
  const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
  const backupDirectory = join(root, 'data', 'backups', `runtime-seed-${stamp}`)
  await mkdir(backupDirectory, { recursive: true })
  for (const file of Object.values(targets)) {
    try {
      await access(file)
      await copyFile(file, join(backupDirectory, file.split(/[\\/]/).at(-1)))
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }

  const demo = JSON.parse(await readFile(source, 'utf8'))
  const items = createDurableItemMasterRepository({ dataFile: targets.items })
  const suppliers = createDurableSupplierRepository({ dataFile: targets.suppliers })
  const customers = createDurableCustomerRepository({ dataFile: targets.customers })

  const existingItems = await items.listItems()
  for (const item of listMasterItems(demo)) {
    if (existingItems.some(row => row.sku === item.sku)) continue
    await items.createItem(item, 'explicit-demo-seed')
  }

  const existingSuppliers = await suppliers.listSuppliers()
  for (const supplier of demo.suppliers || []) {
    const supplierCode = String(supplier.supplierCode || supplier.code || supplier.id || '').trim()
    if (!supplierCode || existingSuppliers.some(row => row.supplierCode === supplierCode)) continue
    await suppliers.createSupplier({
      ...supplier,
      supplierCode,
      supplierName: supplier.supplierName || supplier.name,
      status: 'active',
    }, 'explicit-demo-seed')
  }

  const existingCustomers = await customers.listCustomers()
  for (const customer of demo.customers || []) {
    const code = String(customer.code || customer.id || '').trim()
    if (!code || existingCustomers.some(row => row.code === code)) continue
    await customers.createCustomer({ ...customer, code, status: 'active' }, 'explicit-demo-seed')
  }

  console.log(`Backup directory: ${backupDirectory}`)
  console.log('Explicit runtime seed completed.')
}
