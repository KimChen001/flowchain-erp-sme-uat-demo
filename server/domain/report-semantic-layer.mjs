import { importedDataOverlay, listImportedInventoryMovements } from '../repositories/import-persistence-repository.mjs'
import { readFileSync } from 'node:fs'

const standardScenario = JSON.parse(readFileSync(new URL('../../src/data/standard-business-scenario/contract-fixture.json', import.meta.url), 'utf8'))
const standardPurchaseByPo = new Map((standardScenario.purchaseChains || []).map((row) => [row.po, row]))

const SUBJECTS = Object.freeze({
  purchase_orders: { label: '采购订单', defaultDateField: 'date', detailRoute: '/app/procurement/orders', permissions: ['viewer', 'analyst', 'manager', 'admin'] },
  purchase_requests: { label: '采购申请', defaultDateField: 'date', detailRoute: '/app/procurement/requests', permissions: ['viewer', 'analyst', 'manager', 'admin'] },
  rfqs: { label: '询报价', defaultDateField: 'date', detailRoute: '/app/procurement/rfq', permissions: ['viewer', 'analyst', 'manager', 'admin'] },
  receiving: { label: '收货', defaultDateField: 'date', detailRoute: '/app/procurement/receiving', permissions: ['viewer', 'analyst', 'manager', 'admin'] },
  supplier_invoices: { label: '供应商发票', defaultDateField: 'date', detailRoute: '/app/finance/invoices', permissions: ['viewer', 'analyst', 'manager', 'admin'] },
  three_way_matches: { label: '三单匹配', defaultDateField: 'date', detailRoute: '/app/finance/three-way-match', permissions: ['viewer', 'analyst', 'manager', 'admin'] },
  reconciliation: { label: '供应商对账', defaultDateField: 'date', detailRoute: '/app/finance/reconciliation', permissions: ['viewer', 'analyst', 'manager', 'admin'] },
  settlement: { label: '结算', defaultDateField: 'date', detailRoute: '/app/finance/settlement', permissions: ['viewer', 'analyst', 'manager', 'admin'] },
  sales_orders: { label: '销售订单', defaultDateField: 'date', detailRoute: '/app/sales/orders', permissions: ['viewer', 'analyst', 'manager', 'admin'] },
  deliveries: { label: '发货', defaultDateField: 'date', detailRoute: '/app/sales/deliveries', permissions: ['viewer', 'analyst', 'manager', 'admin'] },
  receipts: { label: '签收', defaultDateField: 'date', detailRoute: '/app/sales/receipts', permissions: ['viewer', 'analyst', 'manager', 'admin'] },
  inventory_balances: { label: '库存余额', defaultDateField: 'date', detailRoute: '/app/inventory', permissions: ['viewer', 'analyst', 'manager', 'admin'] },
  inventory_movements: { label: '库存流水', defaultDateField: 'date', detailRoute: '/app/inventory/movements', permissions: ['viewer', 'analyst', 'manager', 'admin'] },
  suppliers: { label: '供应商', defaultDateField: 'date', detailRoute: '/app/master-data/suppliers', permissions: ['viewer', 'analyst', 'manager', 'admin'] },
})

const FIELD_BASE = [
  ['id', '业务编号', 'business_link', true, true, false], ['date', '业务日期', 'date', true, true, true],
  ['company', '公司', 'text', true, true, true], ['supplier', '供应商', 'business_link', true, true, true],
  ['customer', '客户', 'business_link', true, true, true], ['warehouse', '仓库', 'text', true, true, true],
  ['category', '品类', 'text', true, true, true], ['currency', '币种', 'enum', true, true, true],
  ['amount', '金额', 'currency', true, false, false], ['quantity', '数量', 'number', true, false, false],
  ['status', '状态', 'enum', true, true, true], ['owner', '负责人', 'text', true, true, true],
]

export const reportFieldCatalog = Object.freeze(Object.fromEntries(
  Object.keys(SUBJECTS).map((subject) => [
    subject,
    FIELD_BASE.map(([key, label, type, sortable, filterable, groupable]) => ({
      key, label, type, subject, description: `${SUBJECTS[subject].label}${label}`, source: subject,
      sortable, filterable, groupable, exportable: true, sensitive: false, requiredPermission: 'reports:view',
      format: type === 'date' ? 'YYYY-MM-DD' : type === 'currency' ? 'currency' : 'default', enumOptions: [],
      origin: 'system', customFieldId: null, enabledForReporting: true,
      ...(type === 'business_link' ? { entityType: key === 'supplier' ? 'supplier' : key === 'customer' ? 'customer' : subject, route: SUBJECTS[subject].detailRoute } : {}),
    })),
  ]),
))

function metric(id, label, subject, unit, aggregation, description, drilldownPath, extra = {}) {
  return { id, label, description, subject, unit, format: unit, aggregation, numerator: extra.numerator || aggregation, denominator: extra.denominator || null, dateField: 'date', applicableFilters: ['from', 'to', 'company', 'warehouse', 'supplier', 'customer', 'category', 'currency'], drilldownPath, emptyValue: 0, version: '2.0.0' }
}

export const reportMetricCatalog = Object.freeze([
  metric('sales_order_amount', '销售订单金额', 'sales_orders', 'currency', 'sum(amount)', '筛选范围内销售订单含税金额合计。', '/app/sales/orders'),
  metric('sales_order_count', '销售订单数量', 'sales_orders', 'number', 'count(id)', '筛选范围内销售订单数。', '/app/sales/orders'),
  metric('unshipped_amount', '未发货金额', 'sales_orders', 'currency', 'sum(amount where status != delivered)', '未完成发货的销售订单金额。', '/app/sales/orders?status=unshipped'),
  metric('delivery_completion_rate', '发货完成率', 'deliveries', 'percentage', 'delivered / ordered', '已完成发货订单数占应发货订单数。', '/app/sales/deliveries', { numerator: 'delivered orders', denominator: 'orders due for delivery' }),
  metric('on_time_delivery_rate', '准时交付率', 'deliveries', 'percentage', 'on_time / due', '按承诺日期完成交付的订单占比。', '/app/sales/deliveries?timeliness=on-time', { numerator: 'on-time deliveries', denominator: 'deliveries due' }),
  metric('purchase_order_amount', '采购订单金额', 'purchase_orders', 'currency', 'sum(amount)', '筛选范围内采购订单金额合计。', '/app/procurement/orders'),
  metric('open_po_count', '开放 PO', 'purchase_orders', 'number', 'count(open)', '未关闭、未取消采购订单数。', '/app/procurement/orders?status=open'),
  metric('overdue_po_amount', '逾期 PO 金额', 'purchase_orders', 'currency', 'sum(overdue amount)', '承诺日期早于范围结束且未完成的采购订单金额。', '/app/procurement/orders?overdue=true'),
  metric('rfq_response_rate', 'RFQ 响应率', 'rfqs', 'percentage', 'quoted / invited', '已报价供应商数占邀请供应商数。', '/app/procurement/rfq', { numerator: 'quoted suppliers', denominator: 'invited suppliers' }),
  metric('supplier_otif', '供应商 OTIF', 'receiving', 'percentage', 'on_time_in_full / due', '按承诺日期足量收货的订单占比。', '/app/reports/suppliers', { numerator: 'on-time in-full receipts', denominator: 'receipts due' }),
  metric('inventory_value', '库存金额', 'inventory_balances', 'currency', 'sum(quantity * unitCost)', '库存数量乘受控单位成本的合计。', '/app/inventory'),
  metric('inventory_turnover', '库存周转率', 'inventory_movements', 'number', 'annualized outbound / average inventory', '年化出库成本除以平均库存金额；无成本数据时为空。', '/app/inventory/movements'),
  metric('inventory_coverage_days', '库存覆盖天数', 'inventory_balances', 'days', 'quantity / demand * 30', '当前库存按月需求折算的覆盖天数。', '/app/inventory'),
  metric('inventory_risk_sku', '库存风险 SKU', 'inventory_balances', 'number', 'count(quantity < safetyStock)', '低于安全库存或缺货的 SKU 数。', '/app/inventory?risk=below-safety'),
  metric('invoice_amount', '发票总额', 'supplier_invoices', 'currency', 'sum(total)', '供应商发票含税金额合计。', '/app/finance/invoices'),
  metric('overdue_payable', '逾期应付', 'supplier_invoices', 'currency', 'sum(overdue unpaid)', '已到期且未结清发票金额。', '/app/finance/invoices?overdue=true'),
  metric('three_way_match_rate', '三单匹配率', 'three_way_matches', 'percentage', 'matched_without_block / in_scope', '无阻断差异的已匹配发票数占进入匹配范围的发票数。', '/app/finance/three-way-match', { numerator: 'matched invoices without blocking variance', denominator: 'in-scope invoices' }),
  metric('invoice_variance_amount', '差异金额', 'supplier_invoices', 'currency', 'sum(abs(variance))', '发票与采购/收货证据差异绝对值合计。', '/app/finance/invoices?variance=true'),
  metric('supplier_purchase_amount', '供应商采购金额', 'purchase_orders', 'currency', 'sum(amount)', '按供应商归集的采购订单金额。', '/app/reports/suppliers'),
  metric('supplier_risk_count', '风险供应商数量', 'suppliers', 'number', 'count(risk)', '风险等级为中或高的供应商数。', '/app/master-data/suppliers?risk=true'),
])

const STANDARD_SALES_MONTHLY = Object.freeze([
  { id: 'SO-M-2026-01', date: '2026-01-31', amount: 4820000, quantity: 312, customer: '华南自动化设备有限公司', category: '工业自动化', currency: 'CNY', company: '新辰智能制造', status: 'delivered', onTime: true },
  { id: 'SO-M-2026-02', date: '2026-02-28', amount: 3960000, quantity: 278, customer: '苏州精工系统集成有限公司', category: '工业自动化', currency: 'CNY', company: '新辰智能制造', status: 'delivered', onTime: true },
  { id: 'SO-M-2026-03', date: '2026-03-31', amount: 5310000, quantity: 394, customer: '华南自动化设备有限公司', category: '机械部件', currency: 'CNY', company: '新辰智能制造', status: 'delivered', onTime: false },
  { id: 'SO-M-2026-04', date: '2026-04-30', amount: 4750000, quantity: 341, customer: '苏州精工系统集成有限公司', category: '电气元件', currency: 'CNY', company: '新辰智能制造', status: 'partial', onTime: false },
  { id: 'SO-M-2026-05', date: '2026-05-31', amount: 6120000, quantity: 432, customer: '华南自动化设备有限公司', category: '电气元件', currency: 'CNY', company: '新辰智能制造', status: 'delivered', onTime: true },
  { id: 'SO-M-2026-06', date: '2026-06-30', amount: 5880000, quantity: 415, customer: '苏州精工系统集成有限公司', category: '机械部件', currency: 'CNY', company: '新辰智能制造', status: 'partial', onTime: true },
  { id: 'SO-M-2026-07', date: '2026-07-11', amount: 7240000, quantity: 501, customer: '华南自动化设备有限公司', category: '工业自动化', currency: 'CNY', company: '新辰智能制造', status: 'open', onTime: false },
])

function number(value, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback }
function isoDate(value, fallback = '2026-07-11') {
  const raw = String(value || '').trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  const match = raw.match(/(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日/)
  if (match) return `${match[1] || '2026'}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`
  return fallback
}
function normalizeQuery(input = {}) {
  const filters = input.filters || input
  return {
    subject: input.subject || 'overview', from: filters.from || input.dateRange?.from || '2026-01-01', to: filters.to || input.dateRange?.to || '2026-07-11',
    company: filters.company || '', warehouse: filters.warehouse || '', supplier: filters.supplier || '', customer: filters.customer || '', category: filters.category || '', currency: filters.currency || 'CNY',
    dimensions: Array.isArray(input.dimensions) ? input.dimensions : [], measures: Array.isArray(input.measures) ? input.measures : [], sort: input.sort || null, limit: Math.min(200, Math.max(1, number(input.limit, 50))),
  }
}
function keep(row, query) {
  if (row.date && (row.date < query.from || row.date > query.to)) return false
  for (const key of ['company', 'warehouse', 'supplier', 'customer', 'category', 'currency']) {
    if (query[key] && row[key] && String(row[key]) !== String(query[key])) return false
  }
  return true
}
function sum(rows, key) { return rows.reduce((total, row) => total + number(row[key]), 0) }
function rate(numerator, denominator) { return denominator ? numerator / denominator * 100 : 0 }
function month(date) { return String(date || '').slice(0, 7) }
function group(rows, key, valueKey = 'amount') {
  const result = new Map()
  rows.forEach((row) => { const label = row[key] || '未分类'; result.set(label, (result.get(label) || 0) + number(row[valueKey], 1)) })
  return [...result.entries()].map(([name, value]) => ({ name, value }))
}
function mergeByKey(primary = [], fallback = [], key) {
  const seen = new Set(primary.map((row) => String(row[key] || '')).filter(Boolean))
  return [...primary, ...fallback.filter((row) => !seen.has(String(row[key] || '')))]
}
function sourceRows(data = {}) {
  const overlay = importedDataOverlay()
  const purchaseOrders = [...(overlay.purchaseOrders || []), ...(data.purchaseOrders || [])].map((row) => { const standard = standardPurchaseByPo.get(row.po || row.id); return { id: row.po || row.id, date: isoDate(standard?.poDate || row.created), supplier: row.supplier || row.supplierName, amount: number(row.amount || row.totalAmount || standard?.poAmount), quantity: number(row.items || row.totalOrderedQty || standard?.orderedQty), status: row.status, owner: row.owner, currency: row.currency || row.lines?.[0]?.currency || 'CNY', company: '新辰智能制造', category: row.category || '', sku: row.sourceSku || standard?.sku || '' } })
  const purchaseRequests = [...(overlay.purchaseRequests || []), ...(data.purchaseRequests || [])].map((row) => ({ id: row.pr, date: isoDate(row.created || row.requiredDate), supplier: row.supplier, amount: number(row.amount), quantity: number(row.quantity), status: row.status, owner: row.buyer || row.requester, currency: row.currency || 'CNY', company: '新辰智能制造', category: row.category || '', sku: row.sourceSku }))
  const rfqs = (data.rfqs || []).map((row) => ({ id: row.id, date: isoDate(row.createdAt || row.due), supplier: row.bestSupplier, amount: number(row.bestPrice) * number(row.quantity), quantity: number(row.quantity), status: row.status, currency: row.currency || 'CNY', company: '新辰智能制造', category: row.category, invited: number(row.suppliers || row.invitedSuppliers?.length), quoted: number(row.quoted) }))
  const receiving = (data.receivingDocs || []).map((row) => ({ id: row.grn, date: isoDate(row.arrived), supplier: row.supplier, warehouse: row.warehouse, amount: number(row.amount), quantity: number(row.items), status: row.status, currency: 'CNY', company: '新辰智能制造', accepted: number(row.passed), rejected: number(row.failed) }))
  const invoices = (overlay.supplierInvoices || []).map((row) => ({ id: row.invoiceNumber, date: isoDate(row.invoiceDate), dueDate: isoDate(row.dueDate), supplier: row.supplierCode, amount: number(row.total), variance: number(row.varianceAmount), status: row.status || 'open', currency: row.currency || 'CNY', company: '新辰智能制造', po: row.relatedPo, grn: row.relatedGrn }))
  const products = mergeByKey(overlay.products || [], data.products || [], 'sku')
  const balances = (overlay.inventoryBalances || []).length ? overlay.inventoryBalances.map((row) => ({ id: `${row.warehouse}/${row.bin}/${row.sku}`, date: isoDate(row.asOfDate), sku: row.sku, warehouse: row.warehouse, quantity: number(row.quantity), safetyStock: number(row.safetyStock), unitCost: number(row.unitCost), amount: number(row.quantity) * number(row.unitCost), status: row.status, currency: 'CNY', company: '新辰智能制造', category: row.category || '' })) : products.map((row) => ({ id: row.sku, date: '2026-07-11', sku: row.sku, warehouse: row.warehouse || '上海总仓', quantity: number(row.currentStock), safetyStock: number(row.safetyStock), monthlyDemand: number(row.monthlyDemand), unitCost: number(row.unitCost), amount: number(row.currentStock) * number(row.unitCost), status: row.stockoutRisk, currency: 'CNY', company: '新辰智能制造', category: row.category }))
  const suppliers = mergeByKey(overlay.suppliers || [], data.suppliers || [], 'name').map((row) => ({ id: row.code || row.name, date: isoDate(row.updatedAt), supplier: row.name, category: row.category, status: row.status, risk: row.risk, onTimeRate: number(row.onTimeRate), qualityRate: number(row.qualityRate), currency: row.currency || 'CNY', company: '新辰智能制造' }))
  const sales = STANDARD_SALES_MONTHLY.map((row) => ({ ...row }))
  return { purchase_orders: purchaseOrders, purchase_requests: purchaseRequests, rfqs, receiving, supplier_invoices: invoices, three_way_matches: invoices, reconciliation: overlay.supplierReconciliations || [], settlement: [], sales_orders: sales, deliveries: sales, receipts: sales, inventory_balances: balances, inventory_movements: listImportedInventoryMovements(), suppliers }
}

const DASHBOARD_METRICS = Object.freeze({
  overview: ['sales_order_amount', 'purchase_order_amount', 'inventory_value', 'overdue_payable', 'on_time_delivery_rate', 'three_way_match_rate', 'inventory_risk_sku', 'open_po_count'],
  procurement: ['purchase_order_amount', 'open_po_count', 'overdue_po_amount', 'rfq_response_rate'],
  sales: ['sales_order_amount', 'unshipped_amount', 'delivery_completion_rate', 'on_time_delivery_rate'],
  inventory: ['inventory_value', 'inventory_turnover', 'inventory_coverage_days', 'inventory_risk_sku'],
  finance: ['invoice_amount', 'overdue_payable', 'three_way_match_rate', 'invoice_variance_amount'],
  suppliers: ['supplier_purchase_amount', 'rfq_response_rate', 'supplier_otif', 'supplier_risk_count'],
})

function calculate(metricId, rows, query) {
  const po = rows.purchase_orders; const sales = rows.sales_orders; const invoices = rows.supplier_invoices; const balances = rows.inventory_balances; const rfqs = rows.rfqs; const receiving = rows.receiving; const suppliers = rows.suppliers
  const today = query.to
  const calculations = {
    sales_order_amount: () => sum(sales, 'amount'), sales_order_count: () => sales.length,
    unshipped_amount: () => sum(sales.filter((row) => row.status !== 'delivered'), 'amount'),
    delivery_completion_rate: () => rate(sales.filter((row) => row.status === 'delivered').length, sales.length),
    on_time_delivery_rate: () => rate(sales.filter((row) => row.onTime).length, sales.length),
    purchase_order_amount: () => sum(po, 'amount'), open_po_count: () => po.filter((row) => !/完成|取消|closed|cancelled/i.test(row.status || '')).length,
    overdue_po_amount: () => sum(po.filter((row) => row.date < today && !/完成|取消|closed|cancelled/i.test(row.status || '')), 'amount'),
    rfq_response_rate: () => rate(sum(rfqs, 'quoted'), sum(rfqs, 'invited')),
    supplier_otif: () => rate(receiving.filter((row) => row.rejected === 0).length, receiving.length),
    inventory_value: () => sum(balances, 'amount'), inventory_turnover: () => 0,
    inventory_coverage_days: () => { const applicable = balances.filter((row) => row.monthlyDemand > 0); return applicable.length ? applicable.reduce((total, row) => total + number(row.quantity) / number(row.monthlyDemand) * 30, 0) / applicable.length : 0 },
    inventory_risk_sku: () => balances.filter((row) => row.quantity < row.safetyStock).length,
    invoice_amount: () => sum(invoices, 'amount'), overdue_payable: () => sum(invoices.filter((row) => row.dueDate < today && !/paid|已结算/i.test(row.status || '')), 'amount'),
    three_way_match_rate: () => rate(invoices.filter((row) => number(row.variance) === 0).length, invoices.length),
    invoice_variance_amount: () => invoices.reduce((total, row) => total + Math.abs(number(row.variance)), 0),
    supplier_purchase_amount: () => sum(po, 'amount'), supplier_risk_count: () => suppliers.filter((row) => /中|高|medium|high/i.test(row.risk || '')).length,
  }
  return number(calculations[metricId]?.(), 0)
}

function trend(rows, key = 'amount') {
  const grouped = new Map()
  rows.forEach((row) => { const label = month(row.date); grouped.set(label, (grouped.get(label) || 0) + number(row[key])) })
  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, value]) => ({ period, value }))
}

export function buildGovernedReport(data = {}, input = {}) {
  const query = normalizeQuery(input)
  const all = sourceRows(data)
  const filtered = Object.fromEntries(Object.entries(all).map(([subject, rows]) => [subject, rows.filter((row) => keep(row, query))]))
  const dashboard = DASHBOARD_METRICS[query.subject] ? query.subject : 'overview'
  const metricIds = query.measures.length ? query.measures.filter((id) => reportMetricCatalog.some((metricItem) => metricItem.id === id)) : DASHBOARD_METRICS[dashboard]
  const kpis = metricIds.map((id) => {
    const definition = reportMetricCatalog.find((item) => item.id === id)
    return { ...definition, value: calculate(id, filtered, query), generatedAt: new Date().toISOString() }
  })
  const primary = dashboard === 'sales' ? filtered.sales_orders : dashboard === 'inventory' ? filtered.inventory_balances : dashboard === 'finance' ? filtered.supplier_invoices : dashboard === 'suppliers' ? filtered.purchase_orders : filtered.purchase_orders
  const charts = dashboard === 'overview' ? [
    { id: 'sales_purchase_trend', title: '销售与采购金额趋势', type: 'line', series: [{ key: 'sales', label: '销售金额', data: trend(filtered.sales_orders) }, { key: 'purchase', label: '采购金额', data: trend(filtered.purchase_orders) }], drilldownPath: '/app/procurement/orders' },
    { id: 'ap_aging', title: 'AP Aging', type: 'bar', data: group(filtered.supplier_invoices, 'supplier'), drilldownPath: '/app/finance/invoices?aging=overdue' },
    { id: 'inventory_risk', title: '库存风险分布', type: 'bar', data: [{ name: '风险', value: filtered.inventory_balances.filter((row) => row.quantity < row.safetyStock).length }, { name: '正常', value: filtered.inventory_balances.filter((row) => row.quantity >= row.safetyStock).length }], drilldownPath: '/app/inventory?risk=below-safety' },
    { id: 'supplier_risk', title: '供应商风险 Top 5', type: 'bar', data: group(filtered.purchase_orders, 'supplier').sort((a, b) => b.value - a.value).slice(0, 5), drilldownPath: '/app/reports/suppliers' },
  ] : [
    { id: `${dashboard}_trend`, title: dashboard === 'finance' ? '发票金额趋势' : dashboard === 'sales' ? '销售订单趋势' : dashboard === 'inventory' ? '库存金额趋势' : dashboard === 'suppliers' ? '供应商采购金额排名' : '采购金额趋势', type: 'line', data: trend(primary), drilldownPath: SUBJECTS[dashboard === 'finance' ? 'supplier_invoices' : dashboard === 'sales' ? 'sales_orders' : dashboard === 'inventory' ? 'inventory_balances' : 'purchase_orders'].detailRoute },
    { id: `${dashboard}_distribution`, title: dashboard === 'inventory' ? '库存风险分布' : dashboard === 'finance' ? '匹配状态分布' : dashboard === 'sales' ? '客户销售贡献' : dashboard === 'suppliers' ? '供应商 OTIF 排名' : '品类支出占比', type: 'bar', data: group(primary, dashboard === 'sales' ? 'customer' : dashboard === 'inventory' ? 'status' : dashboard === 'finance' ? 'status' : 'supplier'), drilldownPath: SUBJECTS[dashboard === 'finance' ? 'supplier_invoices' : dashboard === 'sales' ? 'sales_orders' : dashboard === 'inventory' ? 'inventory_balances' : 'purchase_orders'].detailRoute },
  ]
  const details = primary.slice(0, query.limit)
  const warnings = []
  if (dashboard === 'inventory' && kpis.some((item) => item.id === 'inventory_turnover' && item.value === 0)) warnings.push('当前库存数据缺少完整出库成本，库存周转率暂不计算。')
  if (['overview', 'inventory'].includes(dashboard) && calculate('inventory_value', filtered, query) === 0) warnings.push('当前库存余额缺少受控单位成本，库存金额不使用估算值补齐。')
  if (dashboard === 'finance' && filtered.supplier_invoices.length === 0) warnings.push('当前筛选范围没有已导入供应商发票。')
  return {
    query, generatedAt: new Date().toISOString(), dataScope: { label: '当前工作区受治理数据', company: query.company || '全部公司', currency: query.currency, from: query.from, to: query.to, activeFilterCount: ['company', 'warehouse', 'supplier', 'customer', 'category'].filter((key) => query[key]).length },
    kpis, charts, rankings: charts.filter((chart) => /排名|Top/.test(chart.title)), details, warnings,
    limitations: warnings, drilldowns: kpis.map((item) => ({ metricId: item.id, path: item.drilldownPath })),
    exportRows: details, metricDefinitions: kpis.map(({ value, generatedAt, ...definition }) => definition),
  }
}

export function getReportCatalog() {
  return { subjects: Object.entries(SUBJECTS).map(([id, value]) => ({ id, ...value, fields: reportFieldCatalog[id].map((field) => field.key) })), fields: reportFieldCatalog, metrics: reportMetricCatalog, templates: DASHBOARD_METRICS }
}

export { SUBJECTS as reportSubjectCatalog, normalizeQuery as normalizeReportQuery }
