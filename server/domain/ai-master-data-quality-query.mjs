import {
  listMasterItems,
  listMasterSuppliers,
  listMasterWarehouses,
  listPaymentTerms,
  listTaxCodes,
} from './master-data.mjs'

export const aiMasterDataQualityCapabilityCatalog = Object.freeze([
  {
    intent: 'master_data_quality_query',
    examples: ['检查主数据质量', '主数据质量怎么样？'],
    requiredSlots: [],
    optionalSlots: ['domain'],
    responseCards: ['master_data_quality_summary', 'master_data_missing_fields_summary', 'master_data_next_actions', 'master_data_boundary_notice', 'evidence', 'recommended_actions'],
    mode: 'read',
  },
  {
    intent: 'master_data_missing_defaults_query',
    examples: ['缺少哪些默认字段？', '哪些物料缺默认供应商或默认税码？'],
    requiredSlots: [],
    optionalSlots: ['field'],
    responseCards: ['master_data_missing_fields_summary', 'master_data_quality_summary', 'master_data_next_actions', 'master_data_boundary_notice', 'evidence', 'recommended_actions'],
    mode: 'read',
  },
  {
    intent: 'master_data_next_actions_query',
    examples: ['下一步建议', '主数据下一步怎么处理？'],
    requiredSlots: [],
    optionalSlots: ['priority'],
    responseCards: ['master_data_next_actions', 'master_data_quality_summary', 'master_data_missing_fields_summary', 'master_data_boundary_notice', 'evidence', 'recommended_actions'],
    mode: 'read',
  },
])

const MASTER_DATA_BOUNDARY = '当前 Alpha 仅展示主数据质量可见性：不创建或修改主数据、不执行导入、不审批启停，也不自动修复默认值。'

function text(value = '') {
  return String(value || '').trim()
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

export function normalizeMasterDataQualityMessage(body = {}) {
  return text(body.question || body.message || body.prompt || body.text)
}

function moduleIdFor(body = {}) {
  return text(body.moduleId || body.activeContext?.module).toLowerCase()
}

export function detectAiMasterDataQualityIntent(message = '', body = {}) {
  const content = text(message)
  if (!content) return null
  const moduleId = moduleIdFor(body)
  const isMasterDataContext = moduleId === 'master_data' || moduleId === 'master-data' || moduleId === 'masterdata'
  const mentionsMasterData = /主数据|master.?data|默认字段|默认供应商|默认仓库|默认税码|付款条款|税码|物料/i.test(content)
  if (!isMasterDataContext && !mentionsMasterData) return null
  if (/缺少|默认字段|默认供应商|默认仓库|默认税码|missing|default/i.test(content)) return 'master_data_missing_defaults_query'
  if (/下一步|建议|跟进|处理|next action|what next/i.test(content)) return 'master_data_next_actions_query'
  if (/质量|检查|健康|完整|quality|health|check/i.test(content) || isMasterDataContext) return 'master_data_quality_query'
  return null
}

function rawProducts(db = {}) {
  return asArray(db.products)
}

function rawSuppliers(db = {}) {
  return asArray(db.suppliers)
}

function missingTaxCode(item = {}) {
  return !text(item.defaultTaxCodeId || item.defaultTaxCode || item.taxCodeId || item.taxCode)
}

function missingDefaultWarehouse(item = {}, normalized = {}) {
  return !text(item.defaultWarehouseId || item.warehouseId || normalized.defaultWarehouseId)
}

function missingPaymentTerms(supplier = {}, normalized = {}) {
  return !text(supplier.paymentTermsId || supplier.paymentTerms || normalized.paymentTermsId)
}

function buildQualityModel(db = {}) {
  const items = listMasterItems(db)
  const suppliers = listMasterSuppliers(db)
  const warehouses = listMasterWarehouses(db)
  const paymentTerms = listPaymentTerms(db)
  const taxCodes = listTaxCodes(db)
  const rawItemRows = rawProducts(db)
  const rawSupplierRows = rawSuppliers(db)

  const itemIssues = items.flatMap((item, index) => {
    const raw = rawItemRows[index] || {}
    const issues = []
    if (!item.preferredSupplierId || item.preferredSupplierSource === 'missing') {
      issues.push({ entityType: 'item', entityId: item.id, label: item.sku || item.name, field: 'preferredSupplierId', severity: 'high', reason: '缺少默认供应商，采购和 RFQ 草稿需要人工补充。' })
    }
    if (item.preferredSupplierSource === 'derived_from_item_supplier_name' || item.preferredSupplierSource === 'fallback') {
      issues.push({ entityType: 'item', entityId: item.id, label: item.sku || item.name, field: 'preferredSupplierId', severity: 'medium', reason: '默认供应商未匹配到供应商主数据。' })
    }
    if (missingDefaultWarehouse(raw, item)) {
      issues.push({ entityType: 'item', entityId: item.id, label: item.sku || item.name, field: 'defaultWarehouseId', severity: 'medium', reason: '缺少默认仓库，收货和库存事务需要人工确认。' })
    }
    if (missingTaxCode(raw)) {
      issues.push({ entityType: 'item', entityId: item.id, label: item.sku || item.name, field: 'defaultTaxCode', severity: 'medium', reason: '缺少默认税码，发票税额拆分需要复核。' })
    }
    if (!item.leadTimeDays) {
      issues.push({ entityType: 'item', entityId: item.id, label: item.sku || item.name, field: 'leadTimeDays', severity: 'low', reason: '缺少采购提前期，MRP 和补货建议需要人工复核。' })
    }
    return issues
  })

  const supplierIssues = suppliers.flatMap((supplier, index) => {
    const raw = rawSupplierRows[index] || {}
    const issues = []
    if (supplier.scoreSource === 'missing') {
      issues.push({ entityType: 'supplier', entityId: supplier.id, label: supplier.name, field: 'score', severity: 'medium', reason: '缺少供应商评分，SRM 风险排序需要人工复核。' })
    }
    if (missingPaymentTerms(raw, supplier)) {
      issues.push({ entityType: 'supplier', entityId: supplier.id, label: supplier.name, field: 'paymentTermsId', severity: 'medium', reason: '缺少付款条款，AP 到期日可见性需要人工确认。' })
    }
    if (!text(supplier.defaultCurrency)) {
      issues.push({ entityType: 'supplier', entityId: supplier.id, label: supplier.name, field: 'defaultCurrency', severity: 'low', reason: '缺少默认币种，跨币种采购需要人工确认。' })
    }
    return issues
  })

  const referenceIssues = [
    ...warehouses.filter((warehouse) => warehouse.sourceType !== 'explicit_data').map((warehouse) => ({
      entityType: 'warehouse',
      entityId: warehouse.id,
      label: warehouse.name,
      field: 'warehouseReference',
      severity: warehouse.sourceType === 'default_reference' ? 'medium' : 'low',
      reason: warehouse.sourceType === 'default_reference' ? '仓库使用默认参考值。' : '仓库从物料或库存事务推导，建议补齐正式库位主数据。',
    })),
    ...paymentTerms.filter((term) => term.sourceType !== 'explicit_data').map((term) => ({
      entityType: 'payment_term',
      entityId: term.id,
      label: term.label,
      field: 'paymentTerms',
      severity: 'low',
      reason: '付款条款使用默认参考值，建议确认租户标准条款。',
    })),
    ...taxCodes.filter((code) => code.sourceType !== 'explicit_data').map((code) => ({
      entityType: 'tax_code',
      entityId: code.id,
      label: code.label,
      field: 'taxCode',
      severity: 'medium',
      reason: '税码使用默认参考值，发票税额拆分前需要确认。',
    })),
  ]

  const issues = [...itemIssues, ...supplierIssues, ...referenceIssues]
  return { items, suppliers, warehouses, paymentTerms, taxCodes, issues }
}

function qualityCard(model) {
  const high = model.issues.filter((issue) => issue.severity === 'high').length
  const medium = model.issues.filter((issue) => issue.severity === 'medium').length
  const low = model.issues.filter((issue) => issue.severity === 'low').length
  return {
    type: 'master_data_quality_summary',
    title: '主数据质量摘要',
    data: {
      itemCount: model.items.length,
      supplierCount: model.suppliers.length,
      warehouseCount: model.warehouses.length,
      paymentTermCount: model.paymentTerms.length,
      taxCodeCount: model.taxCodes.length,
      issueCount: model.issues.length,
      highIssueCount: high,
      mediumIssueCount: medium,
      lowIssueCount: low,
    },
  }
}

function missingFieldsCard(model) {
  return {
    type: 'master_data_missing_fields_summary',
    title: '缺少默认字段',
    data: {
      missingFieldCount: model.issues.length,
      topIssues: model.issues.slice(0, 8).map((issue) => ({ ...issue })),
    },
  }
}

function nextActionsCard(model) {
  const actions = []
  if (model.issues.some((issue) => issue.field === 'preferredSupplierId')) actions.push('先补齐物料默认供应商，避免 PR/RFQ 草稿需要人工重新选择供应商。')
  if (model.issues.some((issue) => issue.field === 'defaultTaxCode' || issue.field === 'taxCode')) actions.push('复核默认税码和税码参考值，降低发票税额拆分复核成本。')
  if (model.issues.some((issue) => issue.field === 'score')) actions.push('把缺少评分的供应商交给 SRM 复核，不在主数据页自动改分。')
  if (model.issues.some((issue) => issue.field === 'warehouseReference')) actions.push('确认默认仓库和库位来源，把推导值转成正式主数据。')
  if (!actions.length) actions.push('保持只读复核，优先抽查最近采购、库存和发票使用到的主数据。')
  return {
    type: 'master_data_next_actions',
    title: '主数据下一步',
    data: { actions },
  }
}

function boundaryCard() {
  return {
    type: 'master_data_boundary_notice',
    title: '主数据 Alpha 边界',
    data: { message: MASTER_DATA_BOUNDARY },
  }
}

function evidenceCard(evidence = []) {
  return { type: 'evidence', evidence }
}

function recommendedActionsCard() {
  return {
    type: 'recommended_actions',
    actions: [
      { label: '查看物料主数据', kind: 'deep_link', target: '/master-data?tab=items' },
      { label: '查看供应商主数据', kind: 'deep_link', target: '/master-data?tab=suppliers' },
      { label: '查看税码', kind: 'deep_link', target: '/master-data?tab=tax-codes' },
    ],
  }
}

export function buildAiMasterDataQualityResponse(db = {}, body = {}) {
  const message = normalizeMasterDataQualityMessage(body)
  const intentName = detectAiMasterDataQualityIntent(message, body)
  if (!intentName) return null
  const model = buildQualityModel(db)
  const evidence = [
    { type: 'master_data', id: 'items', summary: `${model.items.length} 条物料主数据。` },
    { type: 'master_data', id: 'suppliers', summary: `${model.suppliers.length} 条供应商主数据。` },
    { type: 'limited_data', id: 'master_data_alpha_boundary', summary: MASTER_DATA_BOUNDARY },
  ]
  const quality = qualityCard(model)
  const missing = missingFieldsCard(model)
  const actions = nextActionsCard(model)
  const orderedCards = intentName === 'master_data_missing_defaults_query'
    ? [missing, quality, actions]
    : intentName === 'master_data_next_actions_query'
      ? [actions, quality, missing]
      : [quality, missing, actions]
  const content = intentName === 'master_data_missing_defaults_query'
    ? `我列出主数据缺少或待确认的默认字段，共 ${model.issues.length} 项。${MASTER_DATA_BOUNDARY}`
    : intentName === 'master_data_next_actions_query'
      ? `我整理了主数据内部复核下一步，当前共有 ${model.issues.length} 项质量信号。${MASTER_DATA_BOUNDARY}`
      : `我检查了物料、供应商、仓库、付款条款和税码主数据，发现 ${model.issues.length} 项质量信号。${MASTER_DATA_BOUNDARY}`
  return {
    provider: 'local_master_data_quality_query',
    mode: 'read',
    content,
    message: content,
    intent: { name: intentName, confidence: 0.86, slots: { issueCount: model.issues.length } },
    cards: [...orderedCards, boundaryCard(), evidenceCard(evidence), recommendedActionsCard()],
    evidence,
    capabilityCatalog: aiMasterDataQualityCapabilityCatalog.map((item) => ({
      ...item,
      examples: [...item.examples],
      requiredSlots: [...item.requiredSlots],
      optionalSlots: [...item.optionalSlots],
      responseCards: [...item.responseCards],
    })),
  }
}
