import { envForTestDatabase, getTestDatabaseConfig } from './test-db-config.mjs'
import { getPrismaClient } from './prisma-client.mjs'

export function shouldSkipDbTests(env = process.env) {
  const config = getTestDatabaseConfig(env)
  return {
    skip: !config.configured,
    reason: config.skipReason,
    config,
  }
}

export async function withTestDatabase(env = process.env, callback) {
  const skip = shouldSkipDbTests(env)
  if (skip.skip) {
    return { skipped: true, reason: skip.reason }
  }
  const clientEnv = envForTestDatabase(env)
  const prisma = await getPrismaClient(clientEnv)
  const result = typeof callback === 'function'
    ? await callback({ prisma, env: clientEnv, config: skip.config })
    : undefined
  return { skipped: false, result }
}
