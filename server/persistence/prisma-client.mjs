import { validateDatabasePersistenceConfig } from './persistence-config.mjs'

let prismaClient

export async function getPrismaClient(env = process.env) {
  validateDatabasePersistenceConfig(env)
  if (prismaClient) return prismaClient

  const { PrismaClient } = await import('@prisma/client')
  prismaClient = new PrismaClient()
  return prismaClient
}

export async function disconnectPrismaClient() {
  if (!prismaClient) return
  await prismaClient.$disconnect()
  prismaClient = null
}
