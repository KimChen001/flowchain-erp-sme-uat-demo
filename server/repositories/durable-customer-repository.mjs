import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { withRuntimeFileMutex } from './runtime-file-mutex.mjs'

const clone = value => structuredClone(value)
const text = value => String(value ?? '').trim()
const now = () => new Date().toISOString()

export const emptyCustomerRuntime = () => ({
  schemaVersion: 1,
  revision: 0,
  initialized: true,
  updatedAt: null,
  customers: [],
  auditEvents: [],
})

function customerError(code, message, status = 400, details = [], metadata = {}) {
  return Object.assign(new Error(message), { code, status, details, ...metadata })
}

function normalizedStatus(value, fallback = 'active') {
  const status = text(value || fallback).toLowerCase()
  if (['active', '启用'].includes(status)) return 'active'
  if (['inactive', '停用'].includes(status)) return 'inactive'
  throw customerError('CUSTOMER_STATUS_INVALID', '客户状态无效', 400, [{ field: 'status' }])
}

async function atomicWrite(file, document) {
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`
  await mkdir(dirname(file), { recursive: true })
  try {
    await writeFile(temp, JSON.stringify(document, null, 2), 'utf8')
    await rename(temp, file)
  } catch (error) {
    await rm(temp, { force: true }).catch(() => {})
    throw error
  }
}

export function createDurableCustomerRepository({ dataFile }) {
  let document

  async function readLatest() {
    let latest
    try {
      latest = JSON.parse(await readFile(dataFile, 'utf8'))
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      latest = emptyCustomerRuntime()
    }
    latest = { ...emptyCustomerRuntime(), ...latest, initialized: true }
    if (!Array.isArray(latest.customers)) latest.customers = []
    if (!Array.isArray(latest.auditEvents)) latest.auditEvents = []
    return latest
  }

  async function load() {
    if (!document) document = await readLatest()
    return document
  }

  async function transact(operation) {
    return withRuntimeFileMutex(dataFile, async () => {
      const working = clone(await readLatest())
      const result = await operation(working)
      working.revision = Number(working.revision || 0) + 1
      working.updatedAt = now()
      await atomicWrite(dataFile, working)
      document = working
      return clone(result)
    })
  }

  const find = (doc, key) => doc.customers.find(row =>
    [row.id, row.code, row.name].some(value => text(value).toLowerCase() === text(key).toLowerCase()),
  )

  function validate(doc, input, existing) {
    const code = text(input.code ?? existing?.code)
    const name = text(input.name ?? existing?.name)
    const email = text(input.email ?? existing?.email)
    if (!code) throw customerError('CUSTOMER_CODE_REQUIRED', '客户编号必填', 400, [{ field: 'code' }])
    if (!name) throw customerError('CUSTOMER_NAME_REQUIRED', '客户名称必填', 400, [{ field: 'name' }])
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw customerError('CUSTOMER_EMAIL_INVALID', '邮箱格式不正确', 400, [{ field: 'email' }])
    }
    if (doc.customers.some(row => row.id !== existing?.id && row.code.toLowerCase() === code.toLowerCase())) {
      throw customerError('CUSTOMER_CODE_DUPLICATE', '客户编号已存在', 409, [{ field: 'code' }])
    }
    return { code, name, email, status: normalizedStatus(input.status, existing?.status) }
  }

  const api = {
    mode: 'json',
    adapter: 'durable-customer-master-v1',
    _dataFile: dataFile,
    async listCustomers(filters = {}) {
      const query = text(filters.query).toLowerCase()
      const rows = (await load()).customers.filter(row =>
        (!filters.status || row.status === normalizedStatus(filters.status)) &&
        (!query || [row.code, row.name, row.contact, row.email].some(value => text(value).toLowerCase().includes(query))),
      )
      return clone(rows)
    },
    async getCustomer(key) {
      return clone(find(await load(), decodeURIComponent(key)) || null)
    },
    async createCustomer(input, actor = 'system') {
      return transact(doc => {
      const valid = validate(doc, input)
      const timestamp = now()
      const row = {
        id: `CUS-${randomUUID().slice(0, 8).toUpperCase()}`,
        code: valid.code,
        name: valid.name,
        contact: text(input.contact),
        email: valid.email,
        phone: text(input.phone),
        address: text(input.address),
        currency: text(input.currency) || 'CNY',
        creditStatus: text(input.creditStatus) || 'normal',
        paymentTerms: text(input.paymentTerms),
        paymentTermsId: text(input.paymentTermsId),
        status: valid.status,
        version: 1,
        createdBy: actor,
        createdAt: timestamp,
        updatedBy: actor,
        updatedAt: timestamp,
      }
      doc.customers.push(row)
      doc.auditEvents.push({ id: `AUD-${randomUUID()}`, action: 'created', customerId: row.id, actor, timestamp, version: 1 })
      return row
      })
    },
    async updateCustomer(key, input, actor = 'system') {
      return transact(doc => {
      const row = find(doc, decodeURIComponent(key))
      if (!row) throw customerError('CUSTOMER_NOT_FOUND', '客户不存在', 404)
      if (Number(input.expectedVersion) !== row.version) {
        throw customerError('VERSION_CONFLICT', '客户已被其他用户更新', 409, [], { currentVersion: row.version })
      }
      const valid = validate(doc, input, row)
      const previousStatus = row.status
      Object.assign(row, {
        code: valid.code,
        name: valid.name,
        email: valid.email,
        status: valid.status,
      })
      for (const field of ['contact', 'phone', 'address', 'currency', 'creditStatus', 'paymentTerms', 'paymentTermsId']) {
        if (input[field] !== undefined) row[field] = text(input[field])
      }
      row.version += 1
      row.updatedBy = actor
      row.updatedAt = now()
      doc.auditEvents.push({
        id: `AUD-${randomUUID()}`,
        action: previousStatus === row.status ? 'updated' : row.status === 'active' ? 'activated' : 'deactivated',
        customerId: row.id,
        actor,
        timestamp: row.updatedAt,
        version: row.version,
      })
      return row
      })
    },
    async applyImportBatch(rows, actor, metadata) {
      return transact(doc => {
        const changes = []
        for (const [index, input] of rows.entries()) {
          try {
            const existing = find(doc, input.code)
            const valid = validate(doc, input, existing)
            const timestamp = now()
            if (existing) {
              Object.assign(existing, input, { code: valid.code, name: valid.name, email: valid.email, status: valid.status, version: existing.version + 1, updatedBy: actor, updatedAt: timestamp, ...metadata })
              doc.auditEvents.push({ id: `AUD-${randomUUID()}`, action: 'import_updated', customerId: existing.id, actor, timestamp, version: existing.version, ...metadata })
              changes.push({ repository: 'customer-master-runtime', operation: 'update', entityId: existing.id })
            } else {
              const row = {
                id: `CUS-${randomUUID().slice(0, 8).toUpperCase()}`, code: valid.code, name: valid.name,
                contact: text(input.contact), email: valid.email, phone: text(input.phone), address: text(input.address),
                currency: text(input.currency) || 'CNY', creditStatus: text(input.creditStatus) || 'normal',
                paymentTerms: text(input.paymentTerms), paymentTermsId: text(input.paymentTermsId), status: valid.status,
                version: 1, createdBy: actor, createdAt: timestamp, updatedBy: actor, updatedAt: timestamp, ...metadata,
              }
              doc.customers.push(row)
              doc.auditEvents.push({ id: `AUD-${randomUUID()}`, action: 'import_created', customerId: row.id, actor, timestamp, version: 1, ...metadata })
              changes.push({ repository: 'customer-master-runtime', operation: 'insert', entityId: row.id })
            }
          } catch (error) {
            Object.assign(error, { failedRowNumber: index + 1 })
            throw error
          }
        }
        return changes
      })
    },
    async activateCustomer(key, expectedVersion, actor) {
      return api.updateCustomer(key, { status: 'active', expectedVersion }, actor)
    },
    async deactivateCustomer(key, expectedVersion, actor) {
      return api.updateCustomer(key, { status: 'inactive', expectedVersion }, actor)
    },
  }
  return api
}
