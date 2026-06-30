function text(value = '') {
  return String(value ?? '').trim()
}

function bool(value) {
  return ['1', 'true', 'yes'].includes(text(value).toLowerCase())
}

function databaseNameFromUrl(rawUrl = '') {
  try {
    const url = new URL(rawUrl)
    return url.pathname.replace(/^\/+/, '').split('?')[0]
  } catch {
    return ''
  }
}

function looksLikeProductionDatabaseUrl(rawUrl = '') {
  const value = text(rawUrl).toLowerCase()
  const dbName = databaseNameFromUrl(value).toLowerCase()
  return /\b(prod|production|prd)\b/.test(value) ||
    /(^|[_-])(prod|production|prd)($|[_-])/.test(dbName)
}

export function getTestDatabaseConfig(env = process.env) {
  const databaseUrlTest = text(env.DATABASE_URL_TEST)
  const allowProduction = bool(env.FLOWCHAIN_ALLOW_PRODUCTION_TEST_DB)
  const configured = Boolean(databaseUrlTest)
  const productionLike = configured && looksLikeProductionDatabaseUrl(databaseUrlTest)
  return {
    configured,
    databaseUrlTest,
    databaseName: configured ? databaseNameFromUrl(databaseUrlTest) : '',
    allowProduction,
    productionLike,
    skipReason: configured ? '' : 'DATABASE_URL_TEST is not configured.',
  }
}

export function assertSafeTestDatabaseConfig(env = process.env) {
  const config = getTestDatabaseConfig(env)
  if (!config.configured) return config
  if (config.productionLike && !config.allowProduction) {
    const error = new Error('DATABASE_URL_TEST appears to target a production database.')
    error.code = 'FLOWCHAIN_TEST_DB_UNSAFE'
    error.status = 400
    throw error
  }
  return config
}

export function envForTestDatabase(env = process.env) {
  const config = assertSafeTestDatabaseConfig(env)
  if (!config.configured) return { ...env }
  return {
    ...env,
    FLOWCHAIN_PERSISTENCE_MODE: 'database',
    DATABASE_URL: config.databaseUrlTest,
  }
}
