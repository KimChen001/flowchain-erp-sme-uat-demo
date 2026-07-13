const port = process.env.PLAYWRIGHT_API_PORT || '18787'
const { rm } = await import('node:fs/promises')
const { join } = await import('node:path')
const { tmpdir } = await import('node:os')

process.env.SCM_API_PORT = port
process.env.FLOWCHAIN_INVENTORY_RUNTIME_FILE = join(tmpdir(), `flowchain-browser-inventory-${port}.json`)
process.env.FLOWCHAIN_SALES_RUNTIME_FILE = join(tmpdir(), `flowchain-browser-sales-${port}.json`)
process.env.FLOWCHAIN_ITEM_RUNTIME_FILE = join(tmpdir(), `flowchain-browser-items-${port}.json`)
process.env.FLOWCHAIN_SUPPLIER_RUNTIME_FILE = join(tmpdir(), `flowchain-browser-suppliers-${port}.json`)
process.env.FLOWCHAIN_CUSTOMER_RUNTIME_FILE = join(tmpdir(), `flowchain-browser-customers-${port}.json`)
process.env.FLOWCHAIN_PROCUREMENT_RUNTIME_FILE = join(tmpdir(), `flowchain-browser-procurement-${port}.json`)
await Promise.all([
  rm(process.env.FLOWCHAIN_INVENTORY_RUNTIME_FILE, { force: true }),
  rm(process.env.FLOWCHAIN_SALES_RUNTIME_FILE, { force: true }),
  rm(process.env.FLOWCHAIN_ITEM_RUNTIME_FILE, { force: true }),
  rm(process.env.FLOWCHAIN_SUPPLIER_RUNTIME_FILE, { force: true }),
  rm(process.env.FLOWCHAIN_CUSTOMER_RUNTIME_FILE, { force: true }),
  rm(process.env.FLOWCHAIN_PROCUREMENT_RUNTIME_FILE, { force: true }),
])

await import('../server/index.mjs')
