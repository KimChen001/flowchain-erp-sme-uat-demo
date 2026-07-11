import { normalizeAuditEvent } from '../domain/audit-foundation.mjs'

const seed = {
  company: { companyName: '新辰智能制造', workspaceName: '供应链运营工作区', timezone: 'Asia/Shanghai', currency: 'CNY', locale: 'zh-CN' },
  roles: {
    users: [
      { id: 'USR-001', name: '张磊', email: 'zhanglei@example.com', role: '管理员', enabled: true },
      { id: 'USR-002', name: '林悦', email: 'linyue@example.com', role: '采购经理', enabled: true },
      { id: 'USR-003', name: '陈晨', email: 'chenchen@example.com', role: '仓库主管', enabled: true },
    ],
    roleOptions: ['管理员', '供应链经理', '采购经理', '仓库主管', '财务复核员', '只读访客'],
  },
  numbering: {
    rules: [
      { id: 'NUM-PO', document: '采购订单', prefix: 'PO', datePattern: 'YYYYMM', separator: '-', sequenceLength: 4, nextSequence: 128 },
      { id: 'NUM-PR', document: '采购申请', prefix: 'PR', datePattern: 'YYYYMM', separator: '-', sequenceLength: 4, nextSequence: 86 },
      { id: 'NUM-GRN', document: '采购收货单', prefix: 'GRN', datePattern: 'YYYYMMDD', separator: '-', sequenceLength: 3, nextSequence: 19 },
    ],
  },
  review: {
    amountThreshold: 100000,
    riskLevels: ['高'],
    inventoryTolerancePercent: 5,
    reviewerRoles: ['管理员', '采购经理', '财务复核员'],
    enabled: true,
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
      { id: 'answer', label: '业务问答与解释', level: '允许' },
      { id: 'draft', label: '生成业务草稿', level: '复核后允许' },
      { id: 'write', label: '业务数据变更', level: '仅生成待确认动作' },
      { id: 'external', label: '对外发送', level: '禁止' },
    ],
    evidenceRequired: true,
    retainDays: 90,
  },
  advanced: {
    sessionTimeoutMinutes: 60,
    exportLimit: 5000,
    dateFormat: 'YYYY-MM-DD',
    negativeInventoryBlocked: true,
    maintenanceNotice: '',
  },
}

let state = structuredClone(seed)
const auditEntries = []

function snapshot(value) {
  return structuredClone(value)
}

function validateSection(section, next) {
  if (!(section in seed)) throw Object.assign(new Error('未知设置分区'), { statusCode: 404 })
  if (!next || typeof next !== 'object' || Array.isArray(next)) throw Object.assign(new Error('设置内容格式无效'), { statusCode: 400 })
  if (section === 'company' && (!String(next.companyName || '').trim() || !String(next.workspaceName || '').trim())) {
    throw Object.assign(new Error('公司名称与工作区名称不能为空'), { statusCode: 400 })
  }
  if (section === 'roles') {
    const users = Array.isArray(next.users) ? next.users : []
    if (!users.some((user) => user.enabled && user.role === '管理员')) {
      throw Object.assign(new Error('至少保留一名已启用的管理员'), { statusCode: 409 })
    }
  }
  if (section === 'modules') {
    const items = Array.isArray(next.items) ? next.items : []
    for (const protectedId of ['overview', 'settings']) {
      if (!items.some((item) => item.id === protectedId && item.enabled)) {
        throw Object.assign(new Error('今日工作台与系统管理不能停用'), { statusCode: 409 })
      }
    }
    if (!items.some((item) => item.id === next.defaultModule && item.enabled)) {
      throw Object.assign(new Error('默认模块必须处于启用状态'), { statusCode: 409 })
    }
  }
  if (section === 'numbering') {
    const rules = Array.isArray(next.rules) ? next.rules : []
    const signatures = rules.map((rule) => `${String(rule.prefix || '').toUpperCase()}|${rule.datePattern || ''}|${rule.separator || ''}`)
    if (new Set(signatures).size !== signatures.length) throw Object.assign(new Error('编号前缀与日期格式组合存在冲突'), { statusCode: 409 })
  }
}

export function getSettingsRuntime() {
  return snapshot(state)
}

export function updateSettingsSection(section, next, actor = {}) {
  validateSection(section, next)
  const before = snapshot(state[section])
  state = { ...state, [section]: snapshot(next) }
  const entry = normalizeAuditEvent({
    actor: { type: 'user', id: actor.id || 'USR-001', name: actor.name || '张磊', role: actor.role || '管理员' },
    source: 'manual',
    module: 'settings',
    action: 'document_status_changed',
    entity: { type: 'settings_section', id: section },
    summary: `更新${section}设置`,
    before,
    after: state[section],
  })
  auditEntries.unshift(entry)
  return { settings: snapshot(state[section]), audit: snapshot(entry) }
}

export function listSettingsAuditEntries() {
  return snapshot(auditEntries)
}
