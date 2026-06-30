import {
  findMasterItem,
  findMasterSupplier,
  listMasterItems,
  listMasterSuppliers,
  listMasterWarehouses,
  listPaymentTerms,
  listTaxCodes,
} from '../domain/master-data.mjs'
import {
  buildInventoryExceptions,
  buildInventoryItems,
  buildInventoryLots,
  buildInventoryMovements,
  buildInventorySerials,
  buildInventorySummary,
  filterInventoryRows,
  getInventoryItemBySku,
} from '../domain/inventory-read.mjs'
import {
  buildProcurementDocumentLinks,
  buildProcurementDocuments,
  buildProcurementFollowups,
  buildProcurementSummary,
  filterProcurementRows,
  getProcurementDocument,
  normalizeProcurementDocumentType,
} from '../domain/procurement-read-model.mjs'
import { createJsonActionDraftRepository } from './json-action-draft-repository.mjs'
import { createAuditLogRepository } from './audit-log-repository.mjs'

export const PERSISTENCE_MODES = Object.freeze({
  json: 'json',
  database: 'database',
})

function text(value = '') {
  return String(value ?? '').trim().toLowerCase()
}

export function getPersistenceMode(env = process.env) {
  const requested = text(env.FLOWCHAIN_PERSISTENCE_MODE)
  if (!requested) return PERSISTENCE_MODES.json
  if (requested === PERSISTENCE_MODES.database) return PERSISTENCE_MODES.database
  return PERSISTENCE_MODES.json
}

function createMasterDataRepository(db = {}) {
  return {
    listItems: () => listMasterItems(db),
    getItem: (idOrSku) => findMasterItem(db, idOrSku),
    listSuppliers: () => listMasterSuppliers(db),
    getSupplier: (idOrName) => findMasterSupplier(db, idOrName),
    listWarehouses: () => listMasterWarehouses(db),
    listPaymentTerms: () => listPaymentTerms(db),
    listTaxCodes: () => listTaxCodes(db),
  }
}

function createInventoryReadRepository(db = {}) {
  return {
    listItems: (filters = {}) => filterInventoryRows(buildInventoryItems(db), filters),
    listInventoryItems: (filters = {}) => filterInventoryRows(buildInventoryItems(db), filters),
    getItem: (idOrSku) => getInventoryItemBySku(db, idOrSku),
    getInventoryItem: (idOrSku) => getInventoryItemBySku(db, idOrSku),
    listLots: (filters = {}) => filterInventoryRows(buildInventoryLots(db), filters),
    listSerials: (filters = {}) => filterInventoryRows(buildInventorySerials(db), filters),
    listMovements: (filters = {}) => filterInventoryRows(buildInventoryMovements(db), filters),
    listExceptions: (filters = {}) => filterInventoryRows(buildInventoryExceptions(db), filters),
    getSummary: () => buildInventorySummary(db),
  }
}

function createProcurementReadRepository(db = {}) {
  return {
    listDocuments: (filters = {}) => filterProcurementRows(buildProcurementDocuments(db), filters),
    getDocument: (type, id) => getProcurementDocument(db, type, id),
    listLinks: (filters = {}) => filterProcurementRows(buildProcurementDocumentLinks(db), filters),
    listFollowups: (filters = {}) => filterProcurementRows(buildProcurementFollowups(db), filters),
    getSummary: () => buildProcurementSummary(db),
    normalizeDocumentType: (type) => normalizeProcurementDocumentType(type),
  }
}

function createAiConversationRepository() {
  return {
    implemented: false,
    mode: 'future_adapter_placeholder',
    listConversations: () => [],
  }
}

export function createJsonRepositoryRegistry({ db = {} } = {}) {
  return {
    mode: PERSISTENCE_MODES.json,
    masterData: createMasterDataRepository(db),
    inventoryRead: createInventoryReadRepository(db),
    procurementRead: createProcurementReadRepository(db),
    actionDrafts: createJsonActionDraftRepository(db),
    auditLog: createAuditLogRepository(db),
    aiConversation: createAiConversationRepository(),
  }
}

export function createDatabaseRepositoryRegistry() {
  throw new Error('Database persistence adapter is not implemented yet. Use FLOWCHAIN_PERSISTENCE_MODE=json.')
}

export function createRepositoryRegistry({ db = {}, env = process.env } = {}) {
  const mode = getPersistenceMode(env)
  if (mode === PERSISTENCE_MODES.database) return createDatabaseRepositoryRegistry()
  return createJsonRepositoryRegistry({ db })
}
