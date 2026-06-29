import { listMasterItems, listMasterSuppliers } from './master-data.mjs'
import {
  activeContextEvidence,
  activeContextEntity,
} from './ai-active-context.mjs'

export const aiSupplierOperationalCapabilityCatalog = Object.freeze([
  {
    intent: 'supplier_operational_summary_query',
    examples: [
      'ABC Components PO invoice contract inventory',
      '这个供应商相关的 PO 和发票',
      'SUP-001 有哪些未结 PO 和发票差异？',
    ],
    requiredSlots: ['supplier'],
    optionalSlots: ['sections'],
    responseCards: [
      'supplier_operational_summary',
      'supplier_related_po_summary',
      'supplier_invoice_summary',
      'supplier_contract_summary',
      'supplier_inventory_risk_summary',
      'supplier_rfq_summary',
      'evidence',
      'recommended_actions',
    ],
    mode: 'read',
  },
  {
    intent: 'supplier_operational_comparison_query',
    examples: [
      '对比 ABC Components 和 Delta Plastics',
      '比较 SUP-001 和 SUP-002 的 PO、发票和库存风险',
    ],
    requiredSlots: ['supplierIds'],
    optionalSlots: ['sections'],
    responseCards: ['supplier_operational_comparison', 'evidence', 'recommended_actions'],
    mode: 'read',
  },
])

const GENERIC_SUPPLIER_WORDS = new Set([
  'supplier',
  'vendor',
  'status',
  'risk',
  'operational',
  'summary',
  'recent',
  'show',
  'view',
  'compare',
  'components',
  'company',
  '供应商',
  '相关',
  '运营',
  '情况',
  '最近',
  '跟进',
  '对比',
  '比较',
  '查看',
])

const SECTION_KEYWORDS = {
  purchase_orders: /(?:\bpo\b|purchase\s*orders?|采购订单|未结\s*po|逾期\s*po)/i,
  invoices: /(?:invoice|invoices|发票|对账|reconciliation|贷项|credit\s*memo|差异)/i,
  contracts: /(?:contract|contracts|合同|目录|catalog|bpa|最近合同)/i,
  inventory: /(?:inventory|stock|库存|物料|缺货|断货|风险)/i,
  rfqs: /(?:\brfq\b|\brfx\b|询价|报价|参与)/i,
}

const OPERATIONAL_PATTERN = /(?:\bpo\b|purchase\s*order|invoice|contract|inventory|stock|\brfq\b|\brfx\b|operational|operations?|summary|follow.?up|compare|related|采购订单|发票|合同|库存|物料|询价|报价|运营|相关|跟进|要跟|对比|比较|还有多少|分别)/i
const STATUS_ONLY_PATTERN = /(?:status|状态|risk|风险|score|评分|怎么样)[\s？?。!！]*$/i
const DRAFT_PATTERN = /(?:create|prepare|generate|start|draft|生成|创建|准备|起草|新建|帮我生成|帮我起)/i
const PR_OR_RFQ_DRAFT_PATTERN = /(?:\bpr\b|purchase\s*request|采购申请|\brfq\b|询价|报价请求)/i

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function cleanText(value = '') {
  return String(value || '').trim()
}

export function normalizeSupplierSearchText(value = '') {
  return cleanText(value).toLowerCase().replace(/\s+/g, ' ')
}

function compactText(value = '') {
  return normalizeSupplierSearchText(value).replace(/[^\w\u4e00-\u9fa5-]+/g, '')
}

function stableKey(value = '', fallback = 'SUPPLIER') {
  const key = cleanText(value)
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
  return key || fallback
}

function uniqueStrings(values = []) {
  const seen = new Set()
  const result = []
  for (const value of values) {
    const text = cleanText(value)
    const key = normalizeSupplierSearchText(text)
    if (!text || seen.has(key)) continue
    seen.add(key)
    result.push(text)
  }
  return result
}

function idForSupplier(raw = {}, index = 0) {
  return cleanText(raw.id || raw.supplierId || raw.code || raw.supplierCode || raw.legacyCode) ||
    `SUP-${stableKey(raw.name || raw.supplierName, String(index + 1).padStart(3, '0'))}`
}

function supplierValues(raw = {}) {
  return uniqueStrings([
    raw.id,
    raw.supplierId,
    raw.code,
    raw.supplierCode,
    raw.legacyCode,
    raw.name,
    raw.supplierName,
    raw.legacyName,
    raw.sourceName,
    ...asArray(raw.matchNames),
    ...asArray(raw.aliases),
  ])
}

function mergeSupplierCandidate(existing, next) {
  if (!existing) return next
  return {
    ...next,
    ...existing,
    supplierId: existing.supplierId || next.supplierId,
    supplierName: existing.supplierName || next.supplierName,
    status: existing.status || next.status,
    risk: existing.risk || next.risk,
    score: existing.score || next.score,
    paymentTerms: existing.paymentTerms || next.paymentTerms,
    currency: existing.currency || next.currency,
    category: existing.category || next.category,
    aliases: uniqueStrings([...(existing.aliases || []), ...(next.aliases || [])]),
    sourceTypes: uniqueStrings([...(existing.sourceTypes || []), ...(next.sourceTypes || [])]),
  }
}

function addCandidate(map, raw = {}, sourceType = 'source', index = 0) {
  const values = supplierValues(raw)
  if (!values.length) return
  const id = idForSupplier(raw, index)
  const name = cleanText(raw.name || raw.supplierName || values.find((value) => !/^SUP[-\w]+$/i.test(value)) || id)
  const candidate = {
    supplierId: id,
    supplierName: name,
    status: raw.status || raw.supplierStatus || '',
    risk: raw.risk || raw.riskStatus || '',
    score: raw.score || raw.rating || raw.grade || '',
    paymentTerms: raw.paymentTermsId || raw.paymentTerms || '',
    currency: raw.defaultCurrency || raw.currency || '',
    category: raw.category || raw.type || asArray(raw.categories)[0] || '',
    aliases: values,
    sourceTypes: [sourceType],
  }
  const keys = [id, name, ...values].map(normalizeSupplierSearchText).filter(Boolean)
  const existingKey = keys.find((key) => map.has(key))
  const merged = mergeSupplierCandidate(existingKey ? map.get(existingKey) : null, candidate)
  const mergedKeys = [merged.supplierId, merged.supplierName, ...asArray(merged.aliases)].map(normalizeSupplierSearchText).filter(Boolean)
  for (const key of new Set([...keys, ...mergedKeys])) map.set(key, merged)
}

function supplierRefsFromRecord(record = {}) {
  return [
    record.supplier,
    record.supplierName,
    record.vendor,
    record.vendorName,
    record.supplierId,
    record.vendorId,
    record.supplierCode,
    record.bestSupplier,
    ...asArray(record.invitedSuppliers),
    ...asArray(record.suppliersList),
    ...asArray(record.participants).flatMap((item) => [item.supplier, item.supplierName, item.supplierId, item.name]),
    ...asArray(record.responses).flatMap((item) => [item.supplier, item.supplierName, item.supplierId, item.name]),
  ].filter(Boolean)
}

export function buildSupplierEntityIndex(db = {}, _options = {}) {
  const map = new Map()
  listMasterSuppliers(db).forEach((supplier, index) => addCandidate(map, supplier, 'master_supplier', index))
  asArray(db.suppliers).forEach((supplier, index) => addCandidate(map, supplier, 'raw_supplier', index))

  const relationSources = [
    ['purchase_order', db.purchaseOrders],
    ['supplier_invoice', db.supplierInvoices || db.invoices || db.payables],
    ['supplier_reconciliation', db.supplierReconciliationStatements || db.reconciliationStatements],
    ['contract', db.contracts || db.supplierContracts],
    ['rfq', db.rfqs],
    ['receiving', db.receivingDocs],
    ['inventory_item', db.products],
  ]
  for (const [sourceType, records] of relationSources) {
    asArray(records).forEach((record, index) => {
      const refs = sourceType === 'inventory_item'
        ? [record.preferredSupplier, record.preferredSupplierName, record.preferredSupplierId, record.defaultSupplier, record.supplier, record.supplierName]
        : supplierRefsFromRecord(record)
      refs.filter(Boolean).forEach((value) => addCandidate(map, { name: value }, sourceType, index))
    })
  }

  const candidatesById = new Map()
  for (const candidate of map.values()) {
    const key = normalizeSupplierSearchText(candidate.supplierId || candidate.supplierName)
    candidatesById.set(key, mergeSupplierCandidate(candidatesById.get(key), candidate))
  }
  const candidates = Array.from(candidatesById.values())
  const lookup = new Map()
  for (const candidate of candidates) {
    for (const value of [candidate.supplierId, candidate.supplierName, ...asArray(candidate.aliases)]) {
      const raw = normalizeSupplierSearchText(value)
      const compact = compactText(value)
      if (raw) lookup.set(raw, [...(lookup.get(raw) || []), candidate])
      if (compact && compact !== raw) lookup.set(compact, [...(lookup.get(compact) || []), candidate])
    }
  }
  return { candidates, lookup }
}

function uniqueCandidates(candidates = []) {
  return Array.from(new Map(candidates.map((candidate) => [normalizeSupplierSearchText(candidate.supplierId || candidate.supplierName), candidate])).values())
}

function directMatchesForText(text = '', supplierIndex) {
  const normalized = normalizeSupplierSearchText(text)
  const compact = compactText(text)
  const direct = [
    ...(supplierIndex.lookup.get(normalized) || []),
    ...(supplierIndex.lookup.get(compact) || []),
  ]
  return uniqueCandidates(direct)
}

export function resolveSupplierByExplicitText(text = '', supplierIndex) {
  const exact = directMatchesForText(text, supplierIndex)
  if (exact.length) return { raw: cleanText(text), matches: exact, matchType: 'exact' }
  const normalized = normalizeSupplierSearchText(text)
  const compact = compactText(text)
  const matches = supplierIndex.candidates.filter((candidate) =>
    asArray(candidate.aliases).some((alias) => {
      const aliasText = normalizeSupplierSearchText(alias)
      const aliasCompact = compactText(alias)
      return (aliasText && normalized.includes(aliasText)) || (aliasCompact && compact.includes(aliasCompact))
    })
  )
  if (matches.length) return { raw: cleanText(text), matches: uniqueCandidates(matches), matchType: 'contains' }

  const tokenMatches = supplierIndex.candidates.filter((candidate) => {
    const tokens = asArray(candidate.aliases)
      .flatMap((alias) => normalizeSupplierSearchText(alias).split(/[^\w\u4e00-\u9fa5-]+/))
      .filter((token) => token.length >= 3 && !GENERIC_SUPPLIER_WORDS.has(token))
    return tokens.some((token) => normalized.includes(token))
  })
  return { raw: cleanText(text), matches: uniqueCandidates(tokenMatches), matchType: tokenMatches.length ? 'token' : 'none' }
}

export function findSupplierMentions(message = '', supplierIndex) {
  const text = cleanText(message)
  if (!text) return []
  const mentions = []
  for (const match of text.matchAll(/\bSUP-[A-Z0-9-]+\b/gi)) {
    const resolved = resolveSupplierByExplicitText(match[0], supplierIndex)
    if (resolved.matches.length) mentions.push(resolved)
  }

  for (const candidate of supplierIndex.candidates) {
    const aliases = asArray(candidate.aliases)
      .filter((alias) => cleanText(alias).length >= 2)
      .sort((a, b) => cleanText(b).length - cleanText(a).length)
    const matchedAlias = aliases.find((alias) => {
      const raw = normalizeSupplierSearchText(alias)
      const compact = compactText(alias)
      const normalizedMessage = normalizeSupplierSearchText(text)
      const compactMessage = compactText(text)
      return (raw && normalizedMessage.includes(raw)) || (compact && compactMessage.includes(compact))
    })
    if (matchedAlias) mentions.push({ raw: matchedAlias, matches: [candidate], matchType: 'contains' })
  }

  if (!mentions.length) {
    const resolved = resolveSupplierByExplicitText(text, supplierIndex)
    if (resolved.matches.length) mentions.push(resolved)
  }

  if (mentions.length === 1 && mentions[0].matches.length > 1) return mentions

  const bySupplier = new Map()
  for (const mention of mentions) {
    for (const candidate of mention.matches) {
      const key = normalizeSupplierSearchText(candidate.supplierId || candidate.supplierName)
      bySupplier.set(key, { raw: mention.raw, matches: [candidate], matchType: mention.matchType })
    }
  }
  return Array.from(bySupplier.values())
}

export function resolveSupplierFromActiveContext(activeContext, supplierIndex) {
  if (!activeContext || activeContext.entityType !== 'supplier') return { source: 'missing', matches: [], raw: '' }
  const resolved = resolveSupplierByExplicitText(activeContext.entityId || activeContext.entityLabel || '', supplierIndex)
  if (resolved.matches.length) return { ...resolved, source: 'active_context', context: activeContext }
  const byLabel = resolveSupplierByExplicitText(activeContext.entityLabel || '', supplierIndex)
  return { ...byLabel, source: byLabel.matches.length ? 'active_context' : 'missing', context: activeContext }
}

export function resolveSupplierEntities(message = '', db = {}, options = {}) {
  const supplierIndex = options.supplierIndex || buildSupplierEntityIndex(db, options)
  const explicitMentions = findSupplierMentions(message, supplierIndex)
  if (explicitMentions.length) {
    const ambiguous = explicitMentions.find((mention) => mention.matches.length > 1)
    if (ambiguous) return { source: 'explicit_message', status: 'ambiguous', mentions: explicitMentions, supplierIndex }
    return {
      source: 'explicit_message',
      status: 'resolved',
      suppliers: uniqueCandidates(explicitMentions.flatMap((mention) => mention.matches)),
      mentions: explicitMentions,
      supplierIndex,
    }
  }
  const context = activeContextEntity(options.body || {}, 'supplier')
  const contextual = resolveSupplierFromActiveContext(context, supplierIndex)
  if (contextual.matches.length > 1) return { source: 'active_context', status: 'ambiguous', mentions: [contextual], supplierIndex }
  if (contextual.matches.length === 1) {
    return {
      source: 'active_context',
      status: 'resolved',
      suppliers: contextual.matches,
      mentions: [contextual],
      context,
      supplierIndex,
    }
  }
  return { source: 'missing', status: 'missing', suppliers: [], mentions: [], supplierIndex }
}

function isTerminalStatus(status = '') {
  const normalized = normalizeSupplierSearchText(status).replace(/\s+/g, '_')
  return new Set([
    '已完成',
    '已关闭',
    '已取消',
    '已驳回',
    '已转po',
    '已签收',
    '已入库',
    '已付款',
    'completed',
    'complete',
    'closed',
    'cancelled',
    'canceled',
    'rejected',
    'converted',
    'converted_to_po',
    'posted',
    'paid',
    'done',
  ]).has(normalized)
}

function parseBusinessDate(value = '', now = new Date()) {
  const raw = cleanText(value)
  if (!raw || raw === '—') return null
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00.000Z`)
  const zh = raw.match(/(\d{1,2})月(\d{1,2})日/)
  if (zh) return new Date(Date.UTC(now.getUTCFullYear(), Number(zh[1]) - 1, Number(zh[2])))
  return null
}

function dateState(value = '', now = new Date()) {
  const parsed = parseBusinessDate(value, now)
  if (!parsed) return { overdue: false, dueSoon: false, parseable: false }
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const diffDays = Math.floor((parsed.getTime() - today.getTime()) / 86400000)
  return { overdue: diffDays < 0, dueSoon: diffDays >= 0 && diffDays <= 7, parseable: true, diffDays }
}

function supplierKeys(supplier = {}) {
  return new Set([supplier.supplierId, supplier.supplierName, ...asArray(supplier.aliases)].map(normalizeSupplierSearchText).filter(Boolean))
}

function recordMatchesSupplier(record = {}, supplier = {}) {
  const keys = supplierKeys(supplier)
  return supplierRefsFromRecord(record).some((value) => keys.has(normalizeSupplierSearchText(value)))
}

function poIdFor(po = {}) {
  return cleanText(po.po || po.id || po.poId || po.number)
}

function poDateFor(po = {}) {
  return po.expectedDate || po.promisedDate || po.requiredDate || po.eta || po.due || ''
}

function purchaseOrdersFor(db = {}, supplier = {}) {
  return asArray(db.purchaseOrders).filter((po) => recordMatchesSupplier(po, supplier))
}

function invoiceIdFor(invoice = {}) {
  return cleanText(invoice.invoiceNumber || invoice.invoice || invoice.id || invoice.invoiceId)
}

function invoicesFor(db = {}, supplier = {}) {
  return asArray(db.supplierInvoices || db.invoices || db.payables).filter((invoice) => recordMatchesSupplier(invoice, supplier))
}

function reconciliationsFor(db = {}, supplier = {}) {
  return asArray(db.supplierReconciliationStatements || db.reconciliationStatements).filter((statement) => recordMatchesSupplier(statement, supplier))
}

function creditMemosFor(db = {}, supplier = {}) {
  return asArray(db.supplierCreditMemos || db.creditMemos).filter((memo) => recordMatchesSupplier(memo, supplier))
}

function contractsFor(db = {}, supplier = {}) {
  return asArray(db.contracts || db.supplierContracts).filter((contract) => recordMatchesSupplier(contract, supplier))
}

function rfqsFor(db = {}, supplier = {}) {
  return asArray(db.rfqs).filter((rfq) => recordMatchesSupplier(rfq, supplier))
}

function itemQuantity(item = {}) {
  for (const key of ['availableQuantity', 'onHandQuantity', 'onHandQty', 'stockOnHand', 'currentStock', 'stock', 'qty', 'quantityAvailable']) {
    if (item[key] !== undefined && item[key] !== null && item[key] !== '') return toNumber(item[key], null)
  }
  return null
}

function itemMinimum(item = {}) {
  for (const key of ['safetyStock', 'reorderPoint', 'min', 'moq']) {
    if (item[key] !== undefined && item[key] !== null && item[key] !== '') return toNumber(item[key], null)
  }
  return null
}

function itemMatchesSupplier(item = {}, supplier = {}) {
  const keys = supplierKeys(supplier)
  return [
    item.preferredSupplierId,
    item.preferredSupplier,
    item.preferredSupplierName,
    item.defaultSupplier,
    item.supplier,
    item.supplierName,
  ].some((value) => keys.has(normalizeSupplierSearchText(value)))
}

function itemsFor(db = {}, supplier = {}) {
  const masterItems = listMasterItems(db)
  const rawProducts = asArray(db.products)
  const merged = new Map()
  rawProducts.forEach((item) => merged.set(cleanText(item.id || item.sku || item.name), item))
  masterItems.forEach((item) => {
    const key = cleanText(item.id || item.sku || item.name)
    merged.set(key, { ...(merged.get(key) || {}), ...item })
  })
  return Array.from(merged.values()).filter((item) => itemMatchesSupplier(item, supplier))
}

function buildPoSummary(db = {}, supplier = {}, now = new Date()) {
  const orders = purchaseOrdersFor(db, supplier)
  const open = orders.filter((po) => !isTerminalStatus(po.status))
  const withState = orders.map((po) => ({ po, state: dateState(poDateFor(po), now) }))
  const overdue = withState.filter((row) => !isTerminalStatus(row.po.status) && row.state.overdue)
  const dueSoon = withState.filter((row) => !isTerminalStatus(row.po.status) && row.state.dueSoon)
  return {
    card: {
      type: 'supplier_related_po_summary',
      title: 'Related POs',
      data: {
        supplierId: supplier.supplierId,
        totalPoCount: orders.length,
        openPoCount: open.length,
        overduePoCount: overdue.length,
        dueSoonPoCount: dueSoon.length,
        topPurchaseOrders: orders.slice(0, 3).map((po) => {
          const state = dateState(poDateFor(po), now)
          return {
            poId: poIdFor(po),
            status: po.status || '',
            expectedDate: poDateFor(po),
            amount: toNumber(po.amount ?? po.totalAmount, null),
            overdue: !isTerminalStatus(po.status) && state.overdue,
            dueSoon: !isTerminalStatus(po.status) && state.dueSoon,
          }
        }),
      },
    },
    evidence: orders.length
      ? [{ type: 'purchase_order', id: orders[0] ? poIdFor(orders[0]) : '', summary: `${orders.length} related purchase orders found.` }]
      : [{ type: 'limited_data', id: supplier.supplierId, summary: 'No related purchase orders were found.' }],
  }
}

function buildInvoiceSummary(db = {}, supplier = {}) {
  const invoices = invoicesFor(db, supplier)
  const statements = reconciliationsFor(db, supplier)
  const creditMemos = creditMemosFor(db, supplier)
  const issueInvoices = invoices.filter((invoice) =>
    toNumber(invoice.varianceAmount, 0) !== 0 ||
    !/无差异|自动匹配|paid|已付款|已审批/i.test(`${invoice.varianceType || ''} ${invoice.matchStatus || ''} ${invoice.status || ''}`)
  )
  const pendingReview = invoices.filter((invoice) => /待复核|待匹配|人工复核|差异|pending|review/i.test(`${invoice.status || ''} ${invoice.matchStatus || ''} ${invoice.approvalStatus || ''}`))
  const creditMemoAmount = creditMemos.reduce((sum, memo) => sum + toNumber(memo.total ?? memo.amount ?? memo.creditAmount, 0), 0)
  const reconciliation = statements[0] || null
  return {
    hasReliableData: invoices.length || statements.length || creditMemos.length,
    card: {
      type: 'supplier_invoice_summary',
      title: 'Invoice and reconciliation',
      data: {
        supplierId: supplier.supplierId,
        invoiceCount: invoices.length,
        invoiceVarianceCount: issueInvoices.length,
        pendingReviewCount: pendingReview.length,
        creditMemoAmount,
        reconciliationStatus: reconciliation?.status || reconciliation?.settlementStatus || '',
        topIssues: [...issueInvoices, ...pendingReview].slice(0, 3).map((invoice) => ({
          invoiceId: invoiceIdFor(invoice),
          status: invoice.status || '',
          matchStatus: invoice.matchStatus || '',
          varianceType: invoice.varianceType || '',
          varianceAmount: toNumber(invoice.varianceAmount, null),
        })),
      },
    },
    evidence: invoices.length
      ? [{ type: 'supplier_invoice', id: invoices[0] ? invoiceIdFor(invoices[0]) : '', summary: `${invoices.length} supplier invoices found.` }]
      : statements.length
        ? [{ type: 'supplier_reconciliation', id: statements[0]?.id || statements[0]?.statementNo || '', summary: `${statements.length} reconciliation statements found.` }]
        : [{ type: 'limited_data', id: supplier.supplierId, summary: 'Invoice and reconciliation data is not available for this supplier.' }],
  }
}

function buildContractSummary(db = {}, supplier = {}, now = new Date()) {
  const contracts = contractsFor(db, supplier)
  const active = contracts.filter((contract) => /执行中|active|有效/i.test(String(contract.status || '')))
  const expired = contracts.filter((contract) => /已到期|expired/i.test(String(contract.status || '')) || dateState(contract.end || contract.endDate, now).overdue)
  const expiring = contracts.filter((contract) => /即将到期|expiring/i.test(String(contract.status || '')) || dateState(contract.end || contract.endDate, now).dueSoon)
  return {
    hasReliableData: contracts.length > 0,
    card: {
      type: 'supplier_contract_summary',
      title: 'Contracts',
      data: {
        supplierId: supplier.supplierId,
        activeContractCount: active.length,
        expiringContractCount: expiring.length,
        expiredContractCount: expired.length,
        topContracts: contracts.slice(0, 3).map((contract) => ({
          contractId: contract.id || contract.contractId || contract.number || '',
          scope: contract.scope || contract.title || contract.name || '',
          status: contract.status || '',
          startDate: contract.start || contract.startDate || '',
          endDate: contract.end || contract.endDate || '',
          consumed: contract.consumed ?? contract.consumedRate ?? null,
        })),
      },
    },
    evidence: contracts.length
      ? [{ type: 'contract', id: contracts[0]?.id || contracts[0]?.contractId || '', summary: `${contracts.length} contracts found.` }]
      : [{ type: 'limited_data', id: supplier.supplierId, summary: 'Contract data is not available for this supplier.' }],
  }
}

function buildInventorySummary(db = {}, supplier = {}) {
  const items = itemsFor(db, supplier)
  const riskItems = items.filter((item) => {
    const qty = itemQuantity(item)
    const min = itemMinimum(item)
    return /高|中|不足|预警|high|medium|short/i.test(String(item.stockoutRisk || item.riskLevel || item.status || '')) ||
      (qty !== null && min !== null && qty < min)
  })
  return {
    hasReliableData: items.length > 0,
    card: {
      type: 'supplier_inventory_risk_summary',
      title: 'Inventory risk',
      data: {
        supplierId: supplier.supplierId,
        relatedItemCount: items.length,
        inventoryRiskItemCount: riskItems.length,
        topRiskItems: riskItems.slice(0, 3).map((item) => ({
          itemId: item.id || item.itemId || item.sku || '',
          sku: item.sku || item.code || '',
          itemName: item.name || item.itemName || '',
          availableQuantity: itemQuantity(item),
          minimumQuantity: itemMinimum(item),
          riskLevel: item.stockoutRisk || item.riskLevel || item.status || '',
        })),
      },
    },
    evidence: items.length
      ? [{ type: 'item_master', id: items[0]?.id || items[0]?.sku || '', summary: `${items.length} related items found through supplier references.` }]
      : [{ type: 'limited_data', id: supplier.supplierId, summary: 'No reliable item-to-supplier inventory link was found.' }],
  }
}

function normalizeRfqStatus(status = '') {
  const raw = cleanText(status)
  const lower = normalizeSupplierSearchText(raw)
  if (['进行中', '比价中', 'open', 'active', 'pending'].includes(lower)) return 'open'
  if (['已授标', 'awarded'].includes(lower)) return 'awarded'
  if (['已转po', 'converted', 'converted_to_po'].includes(lower)) return 'converted_to_po'
  if (['已关闭', '已取消', 'closed', 'cancelled', 'canceled'].includes(lower)) return 'closed'
  return raw || 'unknown'
}

function buildRfqSummary(db = {}, supplier = {}) {
  const rfqs = rfqsFor(db, supplier)
  const open = rfqs.filter((rfq) => normalizeRfqStatus(rfq.status) === 'open')
  const pendingResponse = open.filter((rfq) => toNumber(rfq.suppliers, 0) > toNumber(rfq.quoted, 0))
  return {
    hasReliableData: rfqs.length > 0,
    card: {
      type: 'supplier_rfq_summary',
      title: 'RFQ participation',
      data: {
        supplierId: supplier.supplierId,
        totalRfqCount: rfqs.length,
        openRfqCount: open.length,
        pendingResponseCount: pendingResponse.length,
        topRfqs: rfqs.slice(0, 3).map((rfq) => ({
          rfqId: rfq.id || rfq.rfq || rfq.rfqId || '',
          title: rfq.title || '',
          status: normalizeRfqStatus(rfq.status),
          dueDate: rfq.due || rfq.dueDate || rfq.quotationDeadline || '',
        })),
      },
    },
    evidence: rfqs.length
      ? [{ type: 'rfq', id: rfqs[0]?.id || rfqs[0]?.rfq || '', summary: `${rfqs.length} RFQ records reference this supplier.` }]
      : [{ type: 'limited_data', id: supplier.supplierId, summary: 'No RFQ participation was found for this supplier.' }],
  }
}

function nextActionFor(summary) {
  if (summary.overduePoCount > 0 && summary.invoiceIssueCount > 0) return '优先跟进逾期 PO 和发票差异'
  if (summary.overduePoCount > 0) return '优先跟进逾期 PO'
  if (summary.invoiceIssueCount > 0) return '优先复核发票和对账差异'
  if (summary.inventoryRiskItemCount > 0) return '复核关联物料库存风险'
  if (summary.expiringContractCount > 0) return '复核即将到期合同'
  return '保持常规跟进'
}

function supplierSummaryCard(supplier, sectionData) {
  const summary = {
    supplierId: supplier.supplierId,
    supplierName: supplier.supplierName,
    status: supplier.status,
    risk: supplier.risk,
    score: supplier.score,
    paymentTerms: supplier.paymentTerms,
    currency: supplier.currency,
    category: supplier.category,
    openPoCount: sectionData.po.card.data.openPoCount,
    overduePoCount: sectionData.po.card.data.overduePoCount,
    invoiceIssueCount: sectionData.invoice.card.data.invoiceVarianceCount,
    activeContractCount: sectionData.contract.card.data.activeContractCount,
    expiringContractCount: sectionData.contract.card.data.expiringContractCount,
    inventoryRiskItemCount: sectionData.inventory.card.data.inventoryRiskItemCount,
    openRfqCount: sectionData.rfq.card.data.openRfqCount,
  }
  return {
    type: 'supplier_operational_summary',
    title: supplier.supplierName,
    data: {
      ...summary,
      nextAction: nextActionFor(summary),
    },
  }
}

function buildSections(db = {}, supplier = {}, options = {}) {
  return {
    po: buildPoSummary(db, supplier, options.now),
    invoice: buildInvoiceSummary(db, supplier),
    contract: buildContractSummary(db, supplier, options.now),
    inventory: buildInventorySummary(db, supplier),
    rfq: buildRfqSummary(db, supplier),
  }
}

function evidenceCard(evidence = []) {
  return { type: 'evidence', evidence }
}

function recommendedActions(actions = []) {
  return { type: 'recommended_actions', actions }
}

function missingFieldCard(name, reason) {
  return { type: 'missing_fields', fields: [{ name, reason }] }
}

function emptyStateCard(title, reason) {
  return { type: 'empty_state', title, reason }
}

function ambiguousCard(matches = []) {
  return {
    type: 'ambiguous_match',
    field: 'supplier',
    matches: matches.slice(0, 5).map((supplier) => ({
      supplierId: supplier.supplierId,
      name: supplier.supplierName,
    })),
  }
}

function sectionsFromMessage(message = '') {
  const sections = Object.entries(SECTION_KEYWORDS)
    .filter(([, pattern]) => pattern.test(message))
    .map(([section]) => section)
  return sections.length ? sections : ['purchase_orders', 'invoices', 'contracts', 'inventory', 'rfqs']
}

export function detectAiSupplierOperationalIntent(message = '', body = {}) {
  const text = cleanText(message)
  if (!text) return null
  if (DRAFT_PATTERN.test(text) && PR_OR_RFQ_DRAFT_PATTERN.test(text)) return null
  const hasOperational = OPERATIONAL_PATTERN.test(text)
  const comparison = /(?:compare|comparison|versus| vs |对比|比较|分别|哪个更|哪家更|还有多少)/i.test(text)
  if (!hasOperational && !comparison) return null
  if (comparison) return 'supplier_operational_comparison_query'
  const context = activeContextEntity(body, 'supplier')
  const hasContextReference = /(?:这个|当前|该|本)\s*供应商|\b(?:this|current)\s+supplier\b/i.test(text)
  if (context && hasContextReference) return 'supplier_operational_summary_query'
  if (/供应商|supplier|vendor|\bSUP-[A-Z0-9-]+\b/i.test(text) && !STATUS_ONLY_PATTERN.test(text)) {
    return 'supplier_operational_summary_query'
  }
  return null
}

function buildAmbiguousResponse(intentName, resolution) {
  const matches = uniqueCandidates(resolution.mentions.flatMap((mention) => mention.matches))
  const evidence = [{ type: 'supplier_master', id: '', summary: `${matches.length} supplier candidates matched the request.` }]
  return {
    message: 'I found more than one supplier match. Please provide a supplier id to continue.',
    intent: { name: intentName, confidence: 0.62, slots: { supplierIds: ['ambiguous'] } },
    cards: [
      ambiguousCard(matches),
      evidenceCard(evidence),
      recommendedActions([{ label: 'Review suppliers', kind: 'deep_link', target: '/srm' }]),
    ],
    evidence,
  }
}

function buildMissingResponse(intentName) {
  const evidence = [{ type: 'supplier_master', id: '', summary: 'No supplier was resolved from the message or active context.' }]
  return {
    message: 'Please provide a supplier name or supplier id for this read-only lookup.',
    intent: { name: intentName, confidence: 0.58, slots: { supplierIds: [] } },
    cards: [
      missingFieldCard('supplier', 'No supplier was resolved from the message or active context.'),
      evidenceCard(evidence),
      recommendedActions([{ label: 'Review suppliers', kind: 'deep_link', target: '/srm' }]),
    ],
    evidence,
  }
}

function buildSummaryResponse(db = {}, supplier = {}, resolution = {}, body = {}, options = {}) {
  const sections = sectionsFromMessage(normalizeSupplierOperationalMessage(body))
  const sectionData = buildSections(db, supplier, options)
  const summary = supplierSummaryCard(supplier, sectionData)
  const evidence = [
    { type: 'supplier_master', id: supplier.supplierId, summary: `Resolved supplier ${supplier.supplierName}.` },
    ...(resolution.context ? [activeContextEvidence(resolution.context, 'supplier')].filter(Boolean) : []),
    ...sectionData.po.evidence,
    ...sectionData.invoice.evidence,
    ...sectionData.contract.evidence,
    ...sectionData.inventory.evidence,
    ...sectionData.rfq.evidence,
  ]
  const cards = [
    summary,
    sectionData.po.card,
    ...(sectionData.invoice.hasReliableData ? [sectionData.invoice.card] : []),
    ...(sectionData.contract.hasReliableData ? [sectionData.contract.card] : []),
    ...(sectionData.inventory.hasReliableData ? [sectionData.inventory.card] : []),
    ...(sectionData.rfq.hasReliableData ? [sectionData.rfq.card] : []),
    evidenceCard(evidence),
    recommendedActions([
      { label: 'Open supplier', kind: 'deep_link', target: `/srm?supplierId=${encodeURIComponent(supplier.supplierId)}` },
      { label: 'Review procurement', kind: 'deep_link', target: `/procurement?supplierId=${encodeURIComponent(supplier.supplierId)}` },
      { label: 'Review inventory', kind: 'deep_link', target: `/inventory?supplierId=${encodeURIComponent(supplier.supplierId)}` },
    ]),
  ]
  return {
    message: `我找到 ${supplier.supplierName} 的采购、发票、合同和库存相关信息。`,
    intent: {
      name: 'supplier_operational_summary_query',
      confidence: resolution.source === 'explicit_message' ? 0.88 : 0.8,
      slots: { supplierIds: [supplier.supplierId], sections },
    },
    cards,
    evidence,
  }
}

function comparisonRow(db = {}, supplier = {}, options = {}) {
  const sections = buildSections(db, supplier, options)
  const data = supplierSummaryCard(supplier, sections).data
  return {
    supplierId: supplier.supplierId,
    supplierName: supplier.supplierName,
    openPoCount: data.openPoCount,
    overduePoCount: data.overduePoCount,
    invoiceIssueCount: data.invoiceIssueCount,
    activeContractCount: data.activeContractCount,
    inventoryRiskItemCount: data.inventoryRiskItemCount,
    openRfqCount: data.openRfqCount,
    nextAction: data.nextAction,
  }
}

function buildComparisonResponse(db = {}, suppliers = [], resolution = {}, body = {}, options = {}) {
  if (suppliers.length === 1) return buildSummaryResponse(db, suppliers[0], resolution, body, options)
  const limited = suppliers.slice(0, 3)
  const rows = limited.map((supplier) => comparisonRow(db, supplier, options))
  const evidence = [
    { type: 'supplier_master', id: 'supplier_comparison', summary: `${limited.length} suppliers resolved for comparison.` },
    ...(suppliers.length > 3 ? [{ type: 'limited_data', id: 'supplier_limit', summary: 'Comparison is limited to the first three resolved suppliers.' }] : []),
  ]
  return {
    message: `我对比了 ${limited.map((supplier) => supplier.supplierName).join('、')} 的 PO、发票、合同和库存风险。`,
    intent: {
      name: 'supplier_operational_comparison_query',
      confidence: 0.86,
      slots: { supplierIds: limited.map((supplier) => supplier.supplierId), sections: sectionsFromMessage(normalizeSupplierOperationalMessage(body)) },
    },
    cards: [
      {
        type: 'supplier_operational_comparison',
        title: '供应商运营对比',
        data: { suppliers: rows },
      },
      evidenceCard(evidence),
      recommendedActions([
        { label: 'Open suppliers', kind: 'deep_link', target: '/srm' },
        { label: 'Review procurement', kind: 'deep_link', target: '/procurement' },
        { label: 'Review inventory', kind: 'deep_link', target: '/inventory' },
      ]),
    ],
    evidence,
  }
}

export function normalizeSupplierOperationalMessage(body = {}) {
  return String(body.question || body.message || body.prompt || body.text || '').trim()
}

export function buildAiSupplierOperationalResponse(db = {}, body = {}, options = {}) {
  const message = normalizeSupplierOperationalMessage(body)
  const resolution = resolveSupplierEntities(message, db, { ...options, body })
  let intent = detectAiSupplierOperationalIntent(message, body)
  if (!intent && resolution.source === 'explicit_message' && resolution.status === 'resolved' && resolution.suppliers.length > 1) {
    intent = 'supplier_operational_comparison_query'
  }
  if (!intent && OPERATIONAL_PATTERN.test(message) && !DRAFT_PATTERN.test(message) && resolution.source === 'explicit_message' && resolution.status === 'resolved') {
    intent = resolution.suppliers.length > 1 ? 'supplier_operational_comparison_query' : 'supplier_operational_summary_query'
  }
  if (!intent) return null
  if (resolution.status === 'ambiguous') {
    return {
      provider: 'local_supplier_operational_query',
      mode: 'read',
      content: 'I found more than one supplier match. Please provide a supplier id to continue.',
      ...buildAmbiguousResponse(intent, resolution),
      capabilityCatalog: aiSupplierOperationalCapabilityCatalog.map((item) => ({
        ...item,
        examples: [...item.examples],
        requiredSlots: [...item.requiredSlots],
        optionalSlots: [...item.optionalSlots],
        responseCards: [...item.responseCards],
      })),
    }
  }
  if (resolution.status !== 'resolved' || !resolution.suppliers.length) {
    return {
      provider: 'local_supplier_operational_query',
      mode: 'read',
      content: 'Please provide a supplier name or supplier id for this read-only lookup.',
      ...buildMissingResponse(intent),
      capabilityCatalog: aiSupplierOperationalCapabilityCatalog.map((item) => ({
        ...item,
        examples: [...item.examples],
        requiredSlots: [...item.requiredSlots],
        optionalSlots: [...item.optionalSlots],
        responseCards: [...item.responseCards],
      })),
    }
  }
  const response = intent === 'supplier_operational_comparison_query'
    ? buildComparisonResponse(db, resolution.suppliers, resolution, body, options)
    : buildSummaryResponse(db, resolution.suppliers[0], resolution, body, options)
  return {
    provider: 'local_supplier_operational_query',
    mode: 'read',
    content: response.message,
    ...response,
    capabilityCatalog: aiSupplierOperationalCapabilityCatalog.map((item) => ({
      ...item,
      examples: [...item.examples],
      requiredSlots: [...item.requiredSlots],
      optionalSlots: [...item.optionalSlots],
      responseCards: [...item.responseCards],
    })),
  }
}
