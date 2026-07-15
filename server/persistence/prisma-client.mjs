import { validateDatabasePersistenceConfig } from './persistence-config.mjs'

let prismaClient

export async function createPrismaClient(env = process.env) {
  validateDatabasePersistenceConfig(env)
  const { PrismaClient } = await import('@prisma/client')
  const { PrismaPg } = await import('@prisma/adapter-pg')
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL })
  return new PrismaClient({ adapter })
}

export async function getPrismaClient(env = process.env) {
  validateDatabasePersistenceConfig(env)
  if (prismaClient) return prismaClient
  prismaClient = await createPrismaClient(env)
  return prismaClient
}

export async function disconnectPrismaClient() {
  if (!prismaClient) return
  await prismaClient.$disconnect()
  prismaClient = null
}
