const SOP_ITEMS = Object.freeze([
  {
    id: 'SOP-PO-OVERDUE',
    topic: '逾期 PO 跟进',
    appliesTo: ['po', 'overdue_purchase_order'],
    trigger: ['逾期 PO', '超过预计日期', '部分到货'],
    guidance: [
      '确认剩余未到货数量和供应商最新 ETA。',
      '评估关联 SKU 的库存覆盖和客户交付影响。',
      '必要时更新预计日期，并保留供应商回复证据。',
    ],
    allowedActions: ['deep_link', 'po_followup_draft'],
    reviewBoundary: '仅提供内部处理建议和跟进草稿；不得自动改交期、创建 PO 或发送消息。',
  },
  {
    id: 'SOP-RFQ-PENDING',
    topic: 'RFQ 待回复跟进',
    appliesTo: ['rfq', 'pending_rfq_response'],
    trigger: ['RFQ 待回复', '报价未回复', '供应商提醒'],
    guidance: [
      '确认待回复供应商数量和报价截止日。',
      '提醒供应商补充报价或预计回复时间。',
      '授标前复核 PR、SKU、数量和付款条款依据。',
    ],
    allowedActions: ['deep_link', 'supplier_followup_draft'],
    reviewBoundary: '仅生成供应商提醒草稿；不得自动授标或发送 RFQ。',
  },
  {
    id: 'SOP-SKU-LOW-STOCK',
    topic: '低库存 SKU 补货',
    appliesTo: ['sku', 'inventory_item', 'low_inventory'],
    trigger: ['低库存', '安全库存', '补货'],
    guidance: [
      '先确认可用库存、安全库存和再订货点。',
      '检查是否已有 PR、RFQ 或 PO 覆盖该 SKU。',
      '缺口明确后只生成 PR 草稿预览，交由采购人工审阅。',
    ],
    allowedActions: ['deep_link', 'purchase_request_draft'],
    reviewBoundary: '补货建议只生成待复核草稿预览；不得自动创建 PR、RFQ 或 PO。',
  },
  {
    id: 'SOP-GRN-EXCEPTION',
    topic: '收货异常复核',
    appliesTo: ['grn', 'receiving_exception'],
    trigger: ['收货异常', '待质检', '差异'],
    guidance: [
      '复核 GRN、PO 和质检记录是否一致。',
      '确认不合格数量、差异原因和仓库处理人。',
      '如影响交付，通知采购确认供应商补发或贷项处理。',
    ],
    allowedActions: ['deep_link', 'po_followup_draft'],
    reviewBoundary: '只提供复核步骤和内部跟进草稿；不得自动入库、关闭异常或过账。',
  },
  {
    id: 'SOP-SUPPLIER-FOLLOWUP',
    topic: '供应商跟进',
    appliesTo: ['supplier', 'supplier_followup'],
    trigger: ['供应商跟进', '交期确认', '报价回复'],
    guidance: [
      '先聚合开放 PO、待回复 RFQ、收货异常和发票差异。',
      '按交付影响和金额优先级安排跟进。',
      '供应商消息需人工审阅后再发送或记录。',
    ],
    allowedActions: ['deep_link', 'supplier_followup_draft'],
    reviewBoundary: '不得自动发送消息或更新供应商主数据。',
  },
])

function text(value, fallback = '') {
  const next = String(value ?? '').trim()
  return next || fallback
}

function compact(value = '') {
  return text(value).toLowerCase()
}

function topicFromQuery(query = '', entityType = '') {
  const message = compact(query)
  if (/逾期|超过预计|部分到货|overdue/.test(message) || entityType === 'po') return 'SOP-PO-OVERDUE'
  if (/rfq|询价|报价|待回复/.test(message) || entityType === 'rfq') return 'SOP-RFQ-PENDING'
  if (/sku|库存|安全库存|补货|低库存/.test(message) || entityType === 'sku') return 'SOP-SKU-LOW-STOCK'
  if (/grn|收货|质检|差异/.test(message) || entityType === 'grn') return 'SOP-GRN-EXCEPTION'
  if (/供应商|supplier|交期/.test(message) || entityType === 'supplier') return 'SOP-SUPPLIER-FOLLOWUP'
  return ''
}

export function listAiSopItems() {
  return SOP_ITEMS.map((item) => ({
    ...item,
    appliesTo: [...item.appliesTo],
    trigger: [...item.trigger],
    guidance: [...item.guidance],
    allowedActions: [...item.allowedActions],
  }))
}

export function retrieveAiSopGuidance(input = {}) {
  const id = topicFromQuery(input.query || input.message || '', input.entityType)
  const item = SOP_ITEMS.find((next) => next.id === id) || null
  if (!item) {
    return {
      found: false,
      limitation: '未找到匹配的内部 SOP；请提供 PO、RFQ、SKU、GRN 或供应商场景。',
      guidance: null,
    }
  }
  return {
    found: true,
    guidance: {
      ...item,
      appliesTo: [...item.appliesTo],
      trigger: [...item.trigger],
      guidance: [...item.guidance],
      allowedActions: [...item.allowedActions],
    },
  }
}
