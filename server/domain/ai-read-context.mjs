import { buildTodayCockpit } from './today-cockpit-read-model.mjs'

function isRepositoryAvailable(repository, methods = []) {
  return repository && methods.every((method) => typeof repository[method] === 'function')
}

async function readProcurement(repository) {
  if (!isRepositoryAvailable(repository, ['listDocuments', 'listFollowups', 'getSummary'])) return null
  const [procurementDocuments, procurementFollowups, procurementSummary] = await Promise.all([
    repository.listDocuments(),
    repository.listFollowups(),
    repository.getSummary(),
  ])
  return { procurementDocuments, procurementFollowups, procurementSummary }
}

async function readInventory(repository) {
  if (!isRepositoryAvailable(repository, ['listItems', 'listExceptions', 'getSummary'])) return null
  const [inventoryItems, inventoryExceptions, inventorySummary] = await Promise.all([
    repository.listItems(),
    repository.listExceptions(),
    repository.getSummary(),
  ])
  return { inventoryItems, inventoryExceptions, inventorySummary }
}

async function readMasterData(repository) {
  if (!isRepositoryAvailable(repository, ['listItems', 'listSuppliers'])) return null
  const [items, suppliers] = await Promise.all([
    repository.listItems(),
    repository.listSuppliers(),
  ])
  return { items, suppliers }
}

export async function buildAiReadContext(db = {}, ctx = {}) {
  const repositories = ctx.repositories || {}
  const [procurement, inventory, masterData] = await Promise.all([
    readProcurement(repositories.procurementRead),
    readInventory(repositories.inventoryRead),
    readMasterData(repositories.masterData),
  ])

  const repositoryBacked = {
    procurementRead: Boolean(procurement),
    inventoryRead: Boolean(inventory),
    masterData: Boolean(masterData),
  }
  const cache = {}

  if (procurement || inventory) {
    const aiEvidenceReuse = {
      procurementDocuments: procurement?.procurementDocuments || [],
      procurementFollowups: procurement?.procurementFollowups || [],
      procurementSummary: procurement?.procurementSummary || {},
      inventoryItems: inventory?.inventoryItems || [],
      inventoryExceptions: inventory?.inventoryExceptions || [],
      inventorySummary: inventory?.inventorySummary || {},
    }
    aiEvidenceReuse.todayCockpit = buildTodayCockpit(db, aiEvidenceReuse)
    cache.aiEvidenceReuse = aiEvidenceReuse
  }

  return {
    db,
    cache,
    repositoryBacked,
    masterData: masterData || null,
  }
}
