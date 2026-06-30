import { getPersistenceMode, PERSISTENCE_MODES } from '../repositories/adapter-registry.mjs'

export const DATABASE_CONFIG_ERROR = 'DATABASE_URL is required when FLOWCHAIN_PERSISTENCE_MODE=database.'

function text(value = '') {
  return String(value ?? '').trim()
}

export function getDatabaseUrl(env = process.env) {
  return text(env.DATABASE_URL)
}

export function getPersistenceConfig(env = process.env) {
  const mode = getPersistenceMode(env)
  const databaseUrl = getDatabaseUrl(env)
  return {
    mode,
    databaseConfigured: Boolean(databaseUrl),
    databaseUrl,
  }
}

export function validateDatabasePersistenceConfig(env = process.env) {
  const config = getPersistenceConfig(env)
  if (config.mode === PERSISTENCE_MODES.database && !config.databaseConfigured) {
    const error = new Error(DATABASE_CONFIG_ERROR)
    error.code = 'FLOWCHAIN_DATABASE_CONFIG_MISSING'
    error.status = 500
    throw error
  }
  return config
}

export function isDatabasePersistenceEnabled(env = process.env) {
  return getPersistenceMode(env) === PERSISTENCE_MODES.database
}
