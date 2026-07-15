import { randomUUID } from 'node:crypto'
import { getPrismaClient, disconnectPrismaClient } from '../server/persistence/prisma-client.mjs'

const args = new Map(process.argv.slice(2).map(value => {
  const [key, ...rest] = value.replace(/^--/, '').split('=')
  return [key, rest.join('=') || 'true']
}))
const value = (name, fallback = '') => String(args.get(name) || process.env[`FLOWCHAIN_PILOT_${name.replace(/-/g, '_').toUpperCase()}`] || fallback).trim()
const databaseUrl = String(process.env.DATABASE_URL || '')
const productionLike = process.env.NODE_ENV === 'production' || (databaseUrl && !/127\.0\.0\.1|localhost/i.test(databaseUrl))
if (!databaseUrl) throw new Error('DATABASE_URL is required.')
if (productionLike && value('confirm-production') !== 'true') throw new Error('Production-like databases require --confirm-production=true.')

const tenantId = value('tenant-id', process.env.FLOWCHAIN_DEFAULT_TENANT_ID)
if (!tenantId) throw new Error('--tenant-id or FLOWCHAIN_DEFAULT_TENANT_ID is required.')
const config = {
  tenantId,
  workspaceName: value('workspace-name', 'FlowChain Pilot Workspace'),
  adminEmail: value('admin-email', 'admin@flowchain.local').toLowerCase(),
  adminName: value('admin-name', 'Initial Admin'),
  warehouseCode: value('warehouse-code', 'MAIN'),
  warehouseName: value('warehouse-name', 'Demo 主仓'),
}

const prisma = await getPrismaClient(process.env)
try {
  const result = await prisma.$transaction(async tx => {
    let tenant = await tx.tenant.findUnique({ where: { id: config.tenantId } })
    if (!tenant) tenant = await tx.tenant.create({ data: { id: config.tenantId, name: config.workspaceName } })
    let warehouse = await tx.warehouse.findFirst({ where: { tenantId: tenant.id, code: config.warehouseCode } })
    if (!warehouse) warehouse = await tx.warehouse.create({ data: { id: `WH-${randomUUID()}`, tenantId: tenant.id, code: config.warehouseCode, name: config.warehouseName, status: 'active' } })
    let admin = await tx.user.findFirst({ where: { tenantId: tenant.id, email: config.adminEmail } })
    if (!admin) admin = await tx.user.create({ data: { id: `USR-${randomUUID()}`, tenantId: tenant.id, email: config.adminEmail, name: config.adminName, role: 'admin', status: 'active', defaultWarehouseId: warehouse.id } })
    let kim = await tx.user.findFirst({ where: { tenantId: tenant.id, email: 'kim@example.com' } })
    if (!kim) kim = await tx.user.create({ data: { id: `USR-${randomUUID()}`, tenantId: tenant.id, email: 'kim@example.com', name: 'Kim', role: 'manager', jobTitle: '供应链经理', status: 'active', defaultWarehouseId: warehouse.id } })
    await tx.userWarehouseScope.upsert({ where: { tenantId_userId_warehouseId: { tenantId: tenant.id, userId: kim.id, warehouseId: warehouse.id } }, create: { id: randomUUID(), tenantId: tenant.id, userId: kim.id, warehouseId: warehouse.id, accessLevel: 'operate' }, update: {} })
    return { tenantId: tenant.id, workspaceName: tenant.name, warehouseId: warehouse.id, adminEmail: admin.email, kimEmail: kim.email }
  })
  console.log(`Pilot workspace ready: tenant=${result.tenantId} workspace=${result.workspaceName} warehouse=${result.warehouseId} users=${result.adminEmail},${result.kimEmail}`)
} finally {
  await disconnectPrismaClient()
}
