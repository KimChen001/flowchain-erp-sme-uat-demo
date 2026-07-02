import { createEmptyDataset } from './data-mode.mjs'
import { USER_DATA_ARRAY_KEYS } from './user-data-contract.mjs'

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null))
}

export function createUserDataRuntimeDb(importResult = {}, options = {}) {
  const normalizedData = importResult.normalizedData || importResult
  const db = {
    ...createEmptyDataset({ mode: 'user' }),
    __dataMode: 'user',
    __userDataImport: {
      sourceName: importResult.metadata?.sourceName || options.sourceName || 'user-import',
      importedAt: importResult.metadata?.importedAt || options.importedAt || new Date().toISOString(),
      dryRun: Boolean(importResult.metadata?.dryRun ?? true),
      recordCounts: importResult.recordCounts || {},
      warnings: importResult.warnings || [],
      errors: importResult.errors || [],
    },
  }

  for (const key of USER_DATA_ARRAY_KEYS) {
    db[key] = clone(asArray(normalizedData[key]))
  }

  return db
}
