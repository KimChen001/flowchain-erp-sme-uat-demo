import { USER_DATA_ARRAY_KEYS } from '../domain/user-data-contract.mjs'
import { createUserDataRuntimeDb } from '../domain/user-data-runtime.mjs'

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null))
}

function text(value = '') {
  return String(value ?? '').trim()
}

export function normalizeUserDataScope(scope = {}) {
  return {
    tenantId: text(scope.tenantId) || 'tenant-flowchain-sme',
    userId: text(scope.userId) || 'user-local',
  }
}

function scopeKey(scope = {}) {
  const normalized = normalizeUserDataScope(scope)
  return `${normalized.tenantId}::${normalized.userId}`
}

function scopedDatasetKey(scope = {}, datasetId = '') {
  return `${scopeKey(scope)}::${text(datasetId)}`
}

function assertScope(scope = {}) {
  const normalized = normalizeUserDataScope(scope)
  if (!normalized.tenantId || !normalized.userId) {
    const error = new Error('User data runtime scope requires tenantId and userId.')
    error.code = 'USER_DATA_SCOPE_REQUIRED'
    throw error
  }
  return normalized
}

function emptyRecords() {
  return Object.fromEntries(USER_DATA_ARRAY_KEYS.map((key) => [key, []]))
}

function recordsFromSnapshot(snapshot = {}) {
  const records = snapshot.normalizedRecords || snapshot.normalizedData || {}
  return Object.fromEntries(USER_DATA_ARRAY_KEYS.map((key) => [key, clone(Array.isArray(records[key]) ? records[key] : [])]))
}

export function createInMemoryUserDataRuntimeRepository({ seed = [] } = {}) {
  const batches = new Map()
  const datasets = new Map()

  function activeDataset(scope = {}) {
    const normalizedScope = assertScope(scope)
    return Array.from(datasets.values()).find((dataset) =>
      dataset.active &&
      dataset.scope.tenantId === normalizedScope.tenantId &&
      dataset.scope.userId === normalizedScope.userId
    ) || null
  }

  const repository = {
    adapter: 'in-memory-user-data-runtime-v1',
    createImportBatch: async (input = {}) => {
      const scope = assertScope(input.scope)
      const importBatchId = text(input.importBatchId) || `uib-${batches.size + 1}`
      const datasetId = text(input.datasetId) || `uds-${scope.tenantId}-${scope.userId}`
      const batch = {
        importBatchId,
        datasetId,
        scope,
        status: input.status || 'previewed',
        snapshotHash: text(input.snapshotHash || input.normalizedSnapshotHash),
        recordCounts: clone(input.recordCounts || {}),
        validationSummary: clone(input.validationSummary || {}),
        createdAt: input.createdAt || new Date().toISOString(),
        active: input.active !== false,
      }
      batches.set(scopedDatasetKey(scope, importBatchId), batch)
      return clone(batch)
    },
    persistNormalizedRecords: async (input = {}) => {
      const scope = assertScope(input.scope)
      const datasetId = text(input.datasetId)
      const importBatchId = text(input.importBatchId)
      if (!datasetId || !importBatchId) {
        const error = new Error('Persisting user data requires datasetId and importBatchId.')
        error.code = 'USER_DATA_DATASET_REQUIRED'
        throw error
      }
      const records = recordsFromSnapshot(input.normalizedSnapshot || input)
      for (const dataset of datasets.values()) {
        if (dataset.scope.tenantId === scope.tenantId && dataset.scope.userId === scope.userId) dataset.active = false
      }
      const dataset = {
        datasetId,
        importBatchId,
        scope,
        active: true,
        records,
        recordCounts: Object.fromEntries(USER_DATA_ARRAY_KEYS.map((key) => [key, records[key].length])),
        validationSummary: clone(input.validationSummary || input.normalizedSnapshot?.validationSummary || {}),
        snapshotHash: text(input.snapshotHash || input.normalizedSnapshot?.normalizedSnapshotHash),
        createdAt: input.createdAt || new Date().toISOString(),
      }
      datasets.set(scopedDatasetKey(scope, datasetId), dataset)
      return {
        ok: true,
        datasetId,
        importBatchId,
        recordCounts: clone(dataset.recordCounts),
      }
    },
    getActiveDataset: async (scope = {}) => clone(activeDataset(scope)),
    getRecordsByType: async (scope = {}, recordType = '') => {
      const dataset = activeDataset(scope)
      if (!dataset || !USER_DATA_ARRAY_KEYS.includes(recordType)) return []
      return clone(dataset.records[recordType] || [])
    },
    getAIReadableContext: async (scope = {}) => {
      const dataset = activeDataset(scope)
      if (!dataset) return null
      return {
        scope: clone(dataset.scope),
        datasetId: dataset.datasetId,
        importBatchId: dataset.importBatchId,
        recordCounts: clone(dataset.recordCounts),
        db: createUserDataRuntimeDb({
          normalizedData: dataset.records,
          recordCounts: dataset.recordCounts,
          metadata: {
            sourceName: 'user-data-runtime-repository',
            dryRun: false,
            recordCounts: dataset.recordCounts,
          },
          warnings: [],
          errors: [],
        }, { sourceName: 'user-data-runtime-repository' }),
      }
    },
    markImportBatchInactive: async (scope = {}, importBatchId = '') => {
      const normalizedScope = assertScope(scope)
      let changed = null
      for (const dataset of datasets.values()) {
        if (
          dataset.scope.tenantId === normalizedScope.tenantId &&
          dataset.scope.userId === normalizedScope.userId &&
          dataset.importBatchId === importBatchId
        ) {
          dataset.active = false
          changed = dataset
        }
      }
      const batch = batches.get(scopedDatasetKey(normalizedScope, importBatchId))
      if (batch) {
        batch.active = false
        batch.status = 'inactive'
      }
      return changed ? clone(changed) : null
    },
    _debugState: () => ({ batches: clone(Array.from(batches.values())), datasets: clone(Array.from(datasets.values())) }),
  }

  seed.forEach((item) => {
    const scope = assertScope(item.scope)
    const importBatchId = text(item.importBatchId) || `seed-${seed.indexOf(item) + 1}`
    const datasetId = text(item.datasetId) || `seed-dataset-${seed.indexOf(item) + 1}`
    const records = recordsFromSnapshot(item.normalizedSnapshot || item)
    datasets.set(scopedDatasetKey(scope, datasetId), {
      datasetId,
      importBatchId,
      scope,
      active: item.active !== false,
      records,
      recordCounts: Object.fromEntries(USER_DATA_ARRAY_KEYS.map((key) => [key, records[key].length])),
      validationSummary: clone(item.validationSummary || {}),
      snapshotHash: text(item.snapshotHash),
      createdAt: item.createdAt || new Date().toISOString(),
    })
  })

  return repository
}

export function createDisabledUserDataRuntimeRepository() {
  return {
    adapter: 'disabled-user-data-runtime-v1',
    createImportBatch: async () => {
      const error = new Error('User data runtime persistence is disabled by default.')
      error.code = 'USER_DATA_RUNTIME_DISABLED'
      throw error
    },
    persistNormalizedRecords: async () => {
      const error = new Error('User data runtime persistence is disabled by default.')
      error.code = 'USER_DATA_RUNTIME_DISABLED'
      throw error
    },
    getActiveDataset: async () => null,
    getRecordsByType: async () => [],
    getAIReadableContext: async () => null,
    markImportBatchInactive: async () => null,
  }
}
