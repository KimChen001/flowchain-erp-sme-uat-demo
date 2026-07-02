function asText(value = '') {
  return String(value ?? '').trim()
}

function compactText(value = '') {
  return asText(value).toLowerCase().replace(/\s+/g, ' ')
}

export const BUSINESS_TERM_ALIASES = Object.freeze([
  { term: 'supplier', canonical: 'supplier', labels: ['supplier', 'suplier', 'vendor', '供应商', '供应尚'] },
  { term: 'sourcing_event', canonical: 'sourcing event', labels: ['sourcing event', 'sourcing evnet', 'source event', '寻源事件', '寻原事件'] },
  { term: 'purchase_request', canonical: 'PR', labels: ['PR', 'purchase request', 'purchase requisition', 'purchse request', '采购申请', '请购单', '补货申请'] },
  { term: 'rfq', canonical: 'RFQ', labels: ['RFQ', 'request for quote', 'quote request', '询价', '报价请求'] },
  { term: 'purchase_order', canonical: 'PO', labels: ['PO', 'purchase order', '采购订单', '下单'] },
  { term: 'grn', canonical: 'GRN', labels: ['GRN', 'receiving', '收货', '到货'] },
  { term: 'invoice', canonical: 'invoice', labels: ['invoice', '发票', 'invoice matching', '三单匹配'] },
  { term: 'sku', canonical: 'SKU', labels: ['SKU', 'item', '物料', '产品'] },
])

const TYPO_CONFIDENCE = Object.freeze({
  suplier: 0.94,
  '供应尚': 0.9,
  'sourcing evnet': 0.96,
  '寻原事件': 0.92,
  'purchse request': 0.95,
})

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function labelPattern(label) {
  if (/^[a-z0-9 ]+$/i.test(label)) return new RegExp(`\\b${escapeRegExp(label)}\\b`, 'gi')
  return new RegExp(escapeRegExp(label), 'g')
}

export function normalizeBusinessCommand(input = '') {
  const originalText = asText(input)
  const detectedAliases = []
  const corrections = []
  const normalizedBusinessTerms = []
  let normalizedText = originalText

  for (const group of BUSINESS_TERM_ALIASES) {
    for (const label of group.labels) {
      const matches = [...originalText.matchAll(labelPattern(label))]
      if (!matches.length) continue
      const isCanonical = compactText(label) === compactText(group.canonical)
      detectedAliases.push({
        term: group.term,
        alias: label,
        canonical: group.canonical,
        confidence: TYPO_CONFIDENCE[compactText(label)] || (isCanonical ? 1 : 0.88),
        reviewRequired: !isCanonical,
      })
      normalizedBusinessTerms.push({ term: group.term, canonical: group.canonical })
      if (!isCanonical) {
        corrections.push({
          from: label,
          to: group.canonical,
          term: group.term,
          confidence: TYPO_CONFIDENCE[compactText(label)] || 0.88,
          reviewRequired: true,
          message: `我理解 "${label}" 是 "${group.canonical}"。`,
        })
      }
      normalizedText = normalizedText.replace(labelPattern(label), group.canonical)
    }
  }

  return {
    originalText,
    normalizedText: normalizedText.replace(/\s+/g, ' ').trim(),
    detectedAliases: uniqueBy(detectedAliases, (item) => `${item.term}:${item.alias}`),
    corrections: uniqueBy(corrections, (item) => `${item.term}:${item.from}`),
    normalizedBusinessTerms: uniqueBy(normalizedBusinessTerms, (item) => item.term),
    provider: 'local',
    mutationAllowed: false,
  }
}

function uniqueBy(items, keyFn) {
  const seen = new Set()
  return items.filter((item) => {
    const key = keyFn(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
