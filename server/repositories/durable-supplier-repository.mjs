import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const now = () => new Date().toISOString()
const clone = value => structuredClone(value)
const text = value => String(value ?? '').trim()
const number = (value, fallback = 0) => value === '' || value == null ? fallback : Number(value)

function fail(code, message, status = 400, details = []) {
  const error = new Error(message)
  Object.assign(error, { code, status, details })
  throw error
}

export const emptySupplierRuntime = () => ({
  schemaVersion: 1,
  revision: 0,
  initialized: true,
  updatedAt: null,
  suppliers: [],
  itemSupplierRelationships: [],
  auditEvents: [],
})

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

const sensitive = supplier => ({
  ...supplier,
  bankAccountNumber: supplier.bankAccountNumber
    ? `****${supplier.bankAccountNumber.slice(-4)}`
    : '',
})

const selector = (supplier, relationship) => ({
  id: supplier.id,
  name: supplier.supplierName,
  supplierCode: supplier.supplierCode,
  supplierName: supplier.supplierName,
  status: supplier.status,
  categories: supplier.categories,
  preferred: Boolean(relationship?.preferred),
  defaultCurrency: supplier.defaultCurrency,
  paymentTermsId: supplier.paymentTermsId,
})

export function createDurableSupplierRepository({ dataFile }) {
  let document

  async function load() {
    if (document) return document
    try {
      document = JSON.parse(await readFile(dataFile, 'utf8'))
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      document = emptySupplierRuntime()
    }
    document = { ...emptySupplierRuntime(), ...document, initialized: true }
    return document
  }

  async function save() {
    document.revision = Number(document.revision || 0) + 1
    document.updatedAt = now()
    await atomicWrite(dataFile, document)
  }

  const findSupplier = (doc, key) => doc.suppliers.find(row =>
    [row.id, row.supplierCode, row.supplierName].some(value =>
      text(value).toLowerCase() === text(key).toLowerCase(),
    ),
  )

  function validateSupplier(doc, input, existing = null) {
    const supplierCode = text(input.supplierCode ?? existing?.supplierCode)
    const supplierName = text(input.supplierName ?? input.name ?? existing?.supplierName)
    if (!supplierCode) fail('SUPPLIER_CODE_REQUIRED', '供应商编号必填', 400, [{ field: 'supplierCode' }])
    if (!supplierName) fail('SUPPLIER_NAME_REQUIRED', '供应商名称必填', 400, [{ field: 'supplierName' }])
    if (doc.suppliers.some(row => row.id !== existing?.id && row.supplierCode.toLowerCase() === supplierCode.toLowerCase())) {
      fail('SUPPLIER_CODE_DUPLICATE', '供应商编号已存在', 409, [{ field: 'supplierCode' }])
    }
    const email = text(input.email ?? existing?.email)
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fail('SUPPLIER_EMAIL_INVALID', '邮箱格式不正确', 400, [{ field: 'email' }])
    }
    const deliveryCycleDays = number(input.deliveryCycleDays ?? existing?.deliveryCycleDays)
    if (!Number.isFinite(deliveryCycleDays) || deliveryCycleDays < 0) {
      fail('DELIVERY_CYCLE_INVALID', '送货周期不能小于 0', 400, [{ field: 'deliveryCycleDays' }])
    }
    for (const [field, code] of [['creditCode', 'CREDIT_CODE_DUPLICATE'], ['taxIdentificationNumber', 'TAX_ID_DUPLICATE']]) {
      const value = text(input[field] ?? existing?.[field])
      if (value && doc.suppliers.some(row => row.id !== existing?.id && text(row[field]).toLowerCase() === value.toLowerCase())) {
        fail(code, `${field} 已存在`, 409, [{ field }])
      }
    }
    const status = text(input.status ?? existing?.status ?? 'draft')
    if (!['draft', 'active', 'inactive'].includes(status)) fail('SUPPLIER_STATUS_INVALID', '供应商状态无效')
    return { supplierCode, supplierName, email, deliveryCycleDays, status }
  }

  function validateRelationship(input, supplier, item) {
    const active = input.active !== false
    if (active && supplier.status !== 'active') fail('SUPPLIER_INACTIVE', '停用供应商不能建立或启用关系')
    if (active && (!item || item.status !== 'active')) fail('ITEM_INACTIVE', '停用或不存在的 SKU 不能建立或启用关系')
    const leadTimeDays = number(input.leadTimeDays)
    const minimumOrderQuantity = number(input.minimumOrderQuantity, 1)
    const referencePrice = number(input.referencePrice)
    if (!Number.isFinite(leadTimeDays) || leadTimeDays < 0) fail('LEAD_TIME_INVALID', 'Lead Time 不能小于 0')
    if (!Number.isFinite(minimumOrderQuantity) || minimumOrderQuantity <= 0) fail('MOQ_INVALID', 'MOQ 必须大于 0')
    if (!Number.isFinite(referencePrice) || referencePrice < 0) fail('REFERENCE_PRICE_INVALID', '参考价不能小于 0')
    return { active, leadTimeDays, minimumOrderQuantity, referencePrice }
  }

  return {
    mode: 'json',
    adapter: 'durable-supplier-master-v1',
    _dataFile: dataFile,

    async listSuppliers(filters = {}) {
      const doc = await load()
      const query = text(filters.query).toLowerCase()
      return clone(doc.suppliers.filter(row =>
        (!filters.status || row.status === filters.status) &&
        (!filters.category || row.categories.includes(filters.category)) &&
        (!query || [row.supplierCode, row.supplierName, row.contactName].some(value => text(value).toLowerCase().includes(query))),
      ).map(sensitive))
    },

    async getSupplier(key, { privileged = false } = {}) {
      const row = findSupplier(await load(), decodeURIComponent(key))
      return row ? clone(privileged ? row : sensitive(row)) : null
    },

    async createSupplier(input, actor) {
      const doc = await load()
      const valid = validateSupplier(doc, input)
      const timestamp = now()
      const row = {
        id: `SUP-${randomUUID().slice(0, 8).toUpperCase()}`,
        supplierCode: valid.supplierCode,
        supplierName: valid.supplierName,
        shortName: text(input.shortName),
        mnemonicCode: text(input.mnemonicCode),
        status: valid.status,
        businessType: text(input.businessType),
        categories: Array.isArray(input.categories) ? input.categories.map(text).filter(Boolean) : [],
        contactName: text(input.contactName),
        telephone: text(input.telephone),
        email: valid.email,
        fax: text(input.fax),
        country: text(input.country),
        regionId: text(input.regionId),
        cityId: text(input.cityId),
        postalCode: text(input.postalCode),
        address: text(input.address),
        deliveryCycleDays: valid.deliveryCycleDays,
        defaultCurrency: text(input.defaultCurrency) || 'CNY',
        paymentTermsId: text(input.paymentTermsId) || 'NET30',
        settlementMethod: text(input.settlementMethod),
        creditCode: text(input.creditCode),
        taxIdentificationNumber: text(input.taxIdentificationNumber),
        bankName: text(input.bankName),
        bankAccountName: text(input.bankAccountName),
        bankAccountNumber: text(input.bankAccountNumber),
        internalComment: text(input.internalComment),
        version: 1,
        createdBy: actor,
        createdAt: timestamp,
        updatedBy: actor,
        updatedAt: timestamp,
      }
      doc.suppliers.push(row)
      doc.auditEvents.push({ id: `AUD-${randomUUID()}`, action: 'created', supplierId: row.id, actor, timestamp, version: 1 })
      await save()
      return clone(sensitive(row))
    },

    async updateSupplier(key, input, actor) {
      const doc = await load()
      const row = findSupplier(doc, decodeURIComponent(key))
      if (!row) fail('SUPPLIER_NOT_FOUND', '供应商不存在', 404)
      if (Number(input.expectedVersion) !== row.version) fail('VERSION_CONFLICT', '供应商已被其他用户更新', 409)
      const valid = validateSupplier(doc, input, row)
      const before = { ...row }
      const fields = ['shortName', 'mnemonicCode', 'businessType', 'categories', 'contactName', 'telephone', 'fax', 'country', 'regionId', 'cityId', 'postalCode', 'address', 'defaultCurrency', 'paymentTermsId', 'settlementMethod', 'creditCode', 'taxIdentificationNumber', 'bankName', 'bankAccountName', 'bankAccountNumber', 'internalComment']
      Object.assign(row, { supplierCode: valid.supplierCode, supplierName: valid.supplierName, email: valid.email, deliveryCycleDays: valid.deliveryCycleDays, status: valid.status })
      for (const field of fields) {
        if (input[field] !== undefined) row[field] = Array.isArray(input[field]) ? input[field].map(text).filter(Boolean) : text(input[field])
      }
      row.version++
      row.updatedBy = actor
      row.updatedAt = now()
      doc.auditEvents.push({
        id: `AUD-${randomUUID()}`,
        action: before.status !== row.status ? (row.status === 'active' ? 'activated' : 'deactivated') : 'updated',
        supplierId: row.id,
        actor,
        timestamp: row.updatedAt,
        version: row.version,
        bankDetailsChanged: before.bankAccountNumber !== row.bankAccountNumber,
      })
      await save()
      return clone(sensitive(row))
    },

    async selectSuppliers(filters = {}) {
      const doc = await load()
      const query = text(filters.query).toLowerCase()
      return clone(doc.suppliers.filter(row =>
        row.status === 'active' && (!query || [row.supplierCode, row.supplierName].some(value => value.toLowerCase().includes(query))),
      ).map(row => selector(row)))
    },

    async listItemSuppliers(itemId) {
      const doc = await load()
      return clone(doc.itemSupplierRelationships.filter(row => row.itemId === itemId).map(row => ({
        ...row,
        supplier: selector(findSupplier(doc, row.supplierId) || {}, row),
      })))
    },

    async listSupplierItems(supplierId) {
      return clone((await load()).itemSupplierRelationships.filter(row => row.supplierId === supplierId))
    },

    async listAllItemSupplierRelationships() {
      return clone((await load()).itemSupplierRelationships)
    },

    async createItemSupplier(itemId, input, actor, item) {
      const doc = await load()
      const supplier = findSupplier(doc, input.supplierId)
      if (!supplier) fail('SUPPLIER_NOT_FOUND', '供应商不存在', 404)
      if (doc.itemSupplierRelationships.some(row => row.itemId === itemId && row.supplierId === supplier.id)) {
        fail('RELATIONSHIP_DUPLICATE', '该 SKU 与供应商的关系已存在', 409)
      }
      const valid = validateRelationship(input, supplier, item)
      if (input.preferred) doc.itemSupplierRelationships.filter(row => row.itemId === itemId).forEach(row => { row.preferred = false })
      const timestamp = now()
      const row = {
        relationshipId: `ISR-${randomUUID().slice(0, 8).toUpperCase()}`,
        itemId,
        supplierId: supplier.id,
        supplierSku: text(input.supplierSku),
        active: valid.active,
        approved: input.approved !== false,
        preferred: Boolean(input.preferred),
        priority: number(input.priority),
        purchaseUnit: text(input.purchaseUnit) || item.purchaseUnit || item.baseUnit,
        referencePrice: valid.referencePrice,
        currency: text(input.currency) || supplier.defaultCurrency,
        leadTimeDays: valid.leadTimeDays,
        minimumOrderQuantity: valid.minimumOrderQuantity,
        contractId: text(input.contractId),
        version: 1,
        createdBy: actor,
        createdAt: timestamp,
        updatedBy: actor,
        updatedAt: timestamp,
      }
      doc.itemSupplierRelationships.push(row)
      doc.auditEvents.push({ id: `AUD-${randomUUID()}`, action: 'item_relationship_added', supplierId: supplier.id, itemId, relationshipId: row.relationshipId, actor, timestamp })
      await save()
      return clone(row)
    },

    async updateItemSupplier(itemId, relationshipId, input, actor, item) {
      const doc = await load()
      const row = doc.itemSupplierRelationships.find(candidate => candidate.itemId === itemId && candidate.relationshipId === relationshipId)
      if (!row) fail('RELATIONSHIP_NOT_FOUND', 'SKU–供应商关系不存在', 404)
      if (Number(input.expectedVersion) !== row.version) fail('VERSION_CONFLICT', '关系已被其他用户更新', 409)
      const supplier = findSupplier(doc, row.supplierId)
      const valid = validateRelationship({ ...row, ...input }, supplier, item)
      if (input.preferred) doc.itemSupplierRelationships.filter(candidate => candidate.itemId === itemId && candidate.relationshipId !== relationshipId).forEach(candidate => { candidate.preferred = false })
      for (const field of ['supplierSku', 'approved', 'preferred', 'priority', 'purchaseUnit', 'currency', 'contractId']) {
        if (input[field] !== undefined) row[field] = input[field]
      }
      Object.assign(row, valid)
      row.version++
      row.updatedBy = actor
      row.updatedAt = now()
      doc.auditEvents.push({ id: `AUD-${randomUUID()}`, action: 'item_relationship_updated', supplierId: row.supplierId, itemId, relationshipId, actor, timestamp: row.updatedAt })
      await save()
      return clone(row)
    },

    async approvedSuppliersForItem(itemId) {
      const doc = await load()
      return clone(doc.itemSupplierRelationships.filter(row => row.itemId === itemId && row.active && row.approved).map(row => {
        const supplier = findSupplier(doc, row.supplierId)
        return supplier?.status === 'active' ? {
          ...selector(supplier, row),
          relationshipId: row.relationshipId,
          referencePrice: row.referencePrice,
          currency: row.currency,
          leadTimeDays: row.leadTimeDays,
          minimumOrderQuantity: row.minimumOrderQuantity,
        } : null
      }).filter(Boolean))
    },

    async snapshot() {
      return clone(await load())
    },
  }
}
