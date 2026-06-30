import { createJsonMasterDataRepository } from './json-master-data-repository.mjs'
import { createJsonInventoryReadRepository } from './json-inventory-read-repository.mjs'
import { createJsonProcurementReadRepository } from './json-procurement-read-repository.mjs'
import { createJsonActionDraftRepository } from './json-action-draft-repository.mjs'
import { createAuditLogRepository } from './audit-log-repository.mjs'
import { createDbActionDraftRepository } from './db-action-draft-repository.mjs'
import { createDbAuditLogRepository } from './db-audit-log-repository.mjs'

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

export function createJsonRepositoryRegistry({ db = {} } = {}) {
  return {
    mode: PERSISTENCE_MODES.json,
    masterData: createJsonMasterDataRepository(db),
    inventoryRead: createJsonInventoryReadRepository(db),
    procurementRead: createJsonProcurementReadRepository(db),
    actionDrafts: createJsonActionDraftRepository(db),
    auditLog: createAuditLogRepository(db),
    aiConversation: createAiConversationRepository(),
  }
}

export function createDatabaseRepositoryRegistry({ db = {}, env = process.env, prisma } = {}) {
  return {
    mode: PERSISTENCE_MODES.database,
    masterData: createJsonMasterDataRepository(db),
    inventoryRead: createJsonInventoryReadRepository(db),
    procurementRead: createJsonProcurementReadRepository(db),
    actionDrafts: createDbActionDraftRepository({ db, env, prisma }),
    auditLog: createDbAuditLogRepository({ env, prisma }),
    aiConversation: createAiConversationRepository(),
  }
}

export function createRepositoryRegistry({ db = {}, env = process.env } = {}) {
  const mode = getPersistenceMode(env)
  if (mode === PERSISTENCE_MODES.database) return createDatabaseRepositoryRegistry({ db, env })
  return createJsonRepositoryRegistry({ db })
}
