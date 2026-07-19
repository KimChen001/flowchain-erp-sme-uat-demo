import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeAuditEvent } from '../domain/audit-foundation.mjs'
import { withRuntimeFileMutex } from './runtime-file-mutex.mjs'

export const SETTINGS_SCHEMA_VERSION = 1

export const settingsSeed = {
  company: { companyName: '新辰智能制造', workspaceName: '供应链运营工作区', timezone: 'Asia/Shanghai', currency: 'CNY', locale: 'zh-CN' },
  roles: {
    users: [
      { id: 'USR-001', name: '张磊', email: 'zhanglei@example.com', role: '管理员', enabled: true },
      { id: 'USR-002', name: '林悦', email: 'linyue@example.com', role: '采购经理', enabled: true },
      { id: 'USR-003', name: '陈晨', email: 'chenchen@example.com', role: '仓库主管', enabled: true },
    ],
    roleOptions: ['管理员', '供应链经理', '采购经理', '仓库主管', '财务复核员', '只读访客'],
    permissions: {
      管理员: ['*'], 供应链经理: ['overview', 'procurement', 'inventory', 'sales', 'reports'],
      采购经理: ['overview', 'procurement', 'master-data'], 仓库主管: ['overview', 'inventory'], 财务复核员: ['overview', 'finance'], 只读访客: ['overview'],
    },
  },
  numbering: {
    rules: [
      { id: 'NUM-PO', document: '采购订单', prefix: 'PO', datePattern: 'YYYYMM', separator: '-', sequenceLength: 4, nextSequence: 128 },
      { id: 'NUM-PR', document: '采购申请', prefix: 'PR', datePattern: 'YYYYMM', separator: '-', sequenceLength: 4, nextSequence: 86 },
      { id: 'NUM-GRN', document: '采购收货单', prefix: 'GRN', datePattern: 'YYYYMMDD', separator: '-', sequenceLength: 3, nextSequence: 19 },
      { id: 'NUM-RR', document: 'Return Request', prefix: 'RR', datePattern: 'YYYYMM', separator: '-', sequenceLength: 4, nextSequence: 1 },
      { id: 'NUM-RA', document: 'Return Authorization', prefix: 'RA', datePattern: 'YYYYMM', separator: '-', sequenceLength: 4, nextSequence: 1 },
      { id: 'NUM-RP', document: 'Return Posting', prefix: 'RP', datePattern: 'YYYYMM', separator: '-', sequenceLength: 4, nextSequence: 1 },
      { id: 'NUM-SI', document: 'Supplier Invoice', prefix: 'SI', datePattern: 'YYYYMM', separator: '-', sequenceLength: 4, nextSequence: 1 },
      { id: 'NUM-CI', document: 'Customer Invoice', prefix: 'CI', datePattern: 'YYYYMM', separator: '-', sequenceLength: 4, nextSequence: 1 },
      { id: 'NUM-CM', document: 'Credit Memo / Credit Note', prefix: 'CM', datePattern: 'YYYYMM', separator: '-', sequenceLength: 4, nextSequence: 1 },
    ],
  },
  review: {
    policies: [
      { id: 'return-authorization', name: 'Return Authorization', enabled: true, reviewerRoles: ['admin', 'manager'] },
      { id: 'supplier-invoice-match-exception', name: 'Supplier Invoice Match Exception', enabled: true, reviewerRoles: ['admin', 'manager'] },
      { id: 'payable-approval', name: 'Payable Approval', enabled: true, reviewerRoles: ['admin', 'manager'] },
      { id: 'customer-credit-note-approval', name: 'Customer Credit Note Approval', enabled: true, reviewerRoles: ['admin', 'manager'] },
    ],
    amountThreshold: 100000, riskLevels: ['高'], inventoryTolerancePercent: 5, reviewerRoles: ['管理员', '采购经理', '财务复核员'], enabled: true,
  },
  modules: {
    defaultModule: 'overview',
    items: [
      ['overview', '今日工作台'], ['procurement', '采购执行'], ['inventory', '库存管理'], ['sales', '销售与需求'],
      ['finance', '结算管理'], ['reports', '报表中心'], ['master-data', '主数据'], ['settings', '系统管理'],
    ].map(([id, label], index) => ({ id, label, enabled: true, order: index + 1, roles: ['管理员', '供应链经理'] })),
  },
  ai: {
    capabilities: [
      { id: 'answer', label: '业务问答与解释', level: '允许' }, { id: 'draft', label: '生成业务草稿', level: '复核后允许' },
      { id: 'write', label: '业务数据变更', level: '仅生成待确认动作' }, { id: 'external', label: '对外发送', level: '禁止' },
    ],
    evidenceRequired: true,
    retainDays: 90,
  },
  advanced: { sessionTimeoutMinutes: 60, exportLimit: 5000, dateFormat: 'YYYY-MM-DD', negativeInventoryBlocked: true, maintenanceNotice: '' },
}

function snapshot(value) {
  return structuredClone(value)
}

function storageError(message, cause) {
  return Object.assign(new Error(message, { cause }), { statusCode: 500, code: 'settings_storage_error' })
}

function validateSection(section, next) {
  if (!(section in settingsSeed)) throw Object.assign(new Error('未知设置分区'), { statusCode: 404 })
  if (!next || typeof next !== 'object' || Array.isArray(next)) throw Object.assign(new Error('设置内容格式无效'), { statusCode: 400 })
  if (section === 'company' && (!String(next.companyName || '').trim() || !String(next.workspaceName || '').trim())) throw Object.assign(new Error('公司名称与工作区名称不能为空'), { statusCode: 400 })
  if (section === 'roles' && !(Array.isArray(next.users) && next.users.some((user) => user.enabled && user.role === '管理员'))) throw Object.assign(new Error('至少保留一名已启用的管理员'), { statusCode: 409 })
  if (section === 'modules') {
    const items = Array.isArray(next.items) ? next.items : []
    for (const protectedId of ['overview', 'settings']) if (!items.some((item) => item.id === protectedId && item.enabled)) throw Object.assign(new Error('今日工作台与系统管理不能停用'), { statusCode: 409 })
    if (!items.some((item) => item.id === next.defaultModule && item.enabled)) throw Object.assign(new Error('默认模块必须处于启用状态'), { statusCode: 409 })
  }
  if (section === 'numbering') {
    const rules = Array.isArray(next.rules) ? next.rules : []
    const signatures = rules.map((rule) => `${String(rule.prefix || '').toUpperCase()}|${rule.datePattern || ''}|${rule.separator || ''}`)
    if (new Set(signatures).size !== signatures.length) throw Object.assign(new Error('编号前缀与日期格式组合存在冲突'), { statusCode: 409 })
  }
}

function validateDocument(document) {
  if (!document || typeof document !== 'object' || document.schemaVersion !== SETTINGS_SCHEMA_VERSION) throw storageError('系统设置文件版本无效')
  if (!document.settings || typeof document.settings !== 'object' || !Array.isArray(document.auditEntries)) throw storageError('系统设置文件结构无效')
  for (const section of Object.keys(settingsSeed)) validateSection(section, document.settings[section])
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    revision: Number(document.revision || 0),
    updatedAt: document.updatedAt || null,
    settings: snapshot(document.settings),
    auditEntries: snapshot(document.auditEntries),
  }
}

async function atomicWriteJson(dataFile, document) {
  await mkdir(path.dirname(dataFile), { recursive: true })
  const tempFile = `${dataFile}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  try {
    await writeFile(tempFile, `${JSON.stringify(document, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
    await rename(tempFile, dataFile)
  } catch (error) {
    await rm(tempFile, { force: true }).catch(() => {})
    throw storageError('系统设置写入失败', error)
  }
}

export function createSettingsRuntimeRepository({ dataFile }) {
  if (!dataFile) throw new Error('settings dataFile is required')
  let document = null
  let initialization = null

  async function readLatest() {
    try {
      return validateDocument(JSON.parse(await readFile(dataFile, 'utf8')))
    } catch (error) {
      if (error?.code === 'ENOENT') return null
      if (error?.code === 'settings_storage_error') throw error
      throw storageError('系统设置文件无法读取或 JSON 无效', error)
    }
  }

  async function load() {
    if (document) return document
    if (!initialization) initialization = withRuntimeFileMutex(dataFile, async () => {
      const latest = await readLatest()
      if (latest) document = latest
      else {
        const initial = { schemaVersion: SETTINGS_SCHEMA_VERSION, revision: 0, updatedAt: null, settings: snapshot(settingsSeed), auditEntries: [] }
        await atomicWriteJson(dataFile, initial)
        document = initial
      }
      return document
    })
    try { return await initialization } catch (error) { initialization = null; throw error }
  }

  return {
    async getSettingsRuntime() {
      const current = await load()
      return snapshot(current.settings)
    },
    async updateSettingsSection(section, next, actor = {}) {
      return withRuntimeFileMutex(dataFile, async () => {
        const current = await readLatest() || { schemaVersion: SETTINGS_SCHEMA_VERSION, revision: 0, updatedAt: null, settings: snapshot(settingsSeed), auditEntries: [] }
        validateSection(section, next)
        const before = snapshot(current.settings[section])
        const settings = { ...current.settings, [section]: snapshot(next) }
        const entry = normalizeAuditEvent({
          actor: { type: 'user', id: actor.id || 'USR-001', name: actor.name || '张磊', role: actor.role || '管理员' },
          source: 'manual', module: 'settings', action: 'document_status_changed', entity: { type: 'settings_section', id: section },
          summary: `更新${section}设置`, before, after: settings[section],
        })
        const nextDocument = {
          schemaVersion: SETTINGS_SCHEMA_VERSION,
          revision: current.revision + 1,
          updatedAt: new Date().toISOString(),
          settings,
          auditEntries: [entry, ...current.auditEntries].slice(0, 500),
        }
        await atomicWriteJson(dataFile, nextDocument)
        document = nextDocument
        return { settings: snapshot(settings[section]), audit: snapshot(entry) }
      })
    },
    async listSettingsAuditEntries() {
      const current = await load()
      return snapshot(current.auditEntries)
    },
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const defaultSettingsDataFile = path.resolve(__dirname, '..', '..', 'data', 'system-settings.json')
const defaultRepository = createSettingsRuntimeRepository({ dataFile: defaultSettingsDataFile })
export function getDefaultSettingsRuntimeRepository() {
  return defaultRepository
}
