import { createJsonMasterDataRepository } from './json-master-data-repository.mjs'
import { createJsonInventoryReadRepository } from './json-inventory-read-repository.mjs'
import { createJsonProcurementReadRepository } from './json-procurement-read-repository.mjs'
import { createJsonActionDraftRepository } from './json-action-draft-repository.mjs'
import { createInMemoryExceptionCaseRepository } from './exception-case-repository.mjs'
import { createAuditLogRepository } from './audit-log-repository.mjs'
import { createDbActionDraftRepository } from './db-action-draft-repository.mjs'
import { createDbAuditLogRepository } from './db-audit-log-repository.mjs'
import { createDbMasterDataRepository } from './db-master-data-repository.mjs'
import { createDbProcurementReadRepository } from './db-procurement-read-repository.mjs'
import { createDbInventoryReadRepository } from './db-inventory-read-repository.mjs'
import { createDisabledUserDataRuntimeRepository, createInMemoryUserDataRuntimeRepository } from './user-data-runtime-repository.mjs'
import { createInMemoryUserConfirmedActionRepository } from './user-confirmed-action-repository.mjs'
import { createInMemoryProcurementTransactionRepository } from './procurement-transaction-repository.mjs'
import { createDurableInventoryRepository } from './durable-inventory-repository.mjs'
import { createDurableSalesOrderRepository } from './durable-sales-order-repository.mjs'
import { createDurableProcurementRepository } from './durable-procurement-repository.mjs'
import path from 'node:path'

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

function createAiConversationRepository() {
  return {
    implemented: false,
    mode: 'future_adapter_placeholder',
    listConversations: () => [],
  }
}

function isUserImportCommitEnabled(env = process.env) {
  return env.FLOWCHAIN_ENABLE_USER_IMPORT_COMMIT === 'true'
}

function createUserDataRuntimeRepository({ db = {}, env = process.env } = {}) {
  if (!isUserImportCommitEnabled(env)) return createDisabledUserDataRuntimeRepository()
  if (!db.__userDataRuntimeState) db.__userDataRuntimeState = { batches: new Map(), datasets: new Map() }
  return createInMemoryUserDataRuntimeRepository({ state: db.__userDataRuntimeState })
}

export function createJsonRepositoryRegistry({ db = {}, env = process.env } = {}) {
  return {
    mode: PERSISTENCE_MODES.json,
    masterData: createJsonMasterDataRepository(db, {
      itemDataFile: path.resolve(env.FLOWCHAIN_ITEM_RUNTIME_FILE || 'data/item-master-runtime.json'),
      supplierDataFile: path.resolve(env.FLOWCHAIN_SUPPLIER_RUNTIME_FILE || 'data/supplier-master-runtime.json'),
      customerDataFile: path.resolve(env.FLOWCHAIN_CUSTOMER_RUNTIME_FILE || 'data/customer-master-runtime.json'),
    }),
    inventoryRead: createJsonInventoryReadRepository(db),
    inventoryRuntime: createDurableInventoryRepository({ dataFile: path.resolve(env.FLOWCHAIN_INVENTORY_RUNTIME_FILE || 'data/inventory-runtime.json') }),
    salesOrders: createDurableSalesOrderRepository({ dataFile: path.resolve(env.FLOWCHAIN_SALES_RUNTIME_FILE || 'data/sales-orders-runtime.json') }),
    procurementRuntime: createDurableProcurementRepository({ dataFile: path.resolve(env.FLOWCHAIN_PROCUREMENT_RUNTIME_FILE || 'data/procurement-transactions.json') }),
    procurementRead: createJsonProcurementReadRepository(db),
    actionDrafts: createJsonActionDraftRepository(db),
    exceptionCases: createInMemoryExceptionCaseRepository({ db }),
    auditLog: createAuditLogRepository(db),
    aiConversation: createAiConversationRepository(),
    userDataRuntime: createUserDataRuntimeRepository({ db, env }),
    userConfirmedActions: createInMemoryUserConfirmedActionRepository({ db }),
    procurementTransactions: createInMemoryProcurementTransactionRepository({ db }),
  }
}

export function createDatabaseRepositoryRegistry({ db = {}, env = process.env, prisma } = {}) {
  return {
    mode: PERSISTENCE_MODES.database,
    masterData: createDbMasterDataRepository({ env, prisma }),
    inventoryRead: createDbInventoryReadRepository({ env, prisma }),
    procurementRead: createDbProcurementReadRepository({ env, prisma }),
    actionDrafts: createDbActionDraftRepository({ db, env, prisma }),
    exceptionCases: createInMemoryExceptionCaseRepository({ db }),
    auditLog: createDbAuditLogRepository({ env, prisma }),
    aiConversation: createAiConversationRepository(),
    userDataRuntime: createUserDataRuntimeRepository({ db, env }),
    userConfirmedActions: createInMemoryUserConfirmedActionRepository({ db }),
    procurementTransactions: createInMemoryProcurementTransactionRepository({ db }),
  }
}

export function createRepositoryRegistry({ db = {}, env = process.env } = {}) {
  const mode = getPersistenceMode(env)
  if (mode === PERSISTENCE_MODES.database) return createDatabaseRepositoryRegistry({ db, env })
  return createJsonRepositoryRegistry({ db, env })
}
