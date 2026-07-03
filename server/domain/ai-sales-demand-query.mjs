import {
  buildCustomerDeliveryRisks,
  buildSalesDemandReadModel,
  getSalesOrderById,
  resolvePurchaseOrderSalesImpact,
  resolveSkuDemandImpact,
} from './sales-demand-read-model.mjs'

function text(value, fallback = '') {
  const next = String(value ?? '').trim()
  return next || fallback
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function qty(value = 0) {
  return Number(value || 0).toLocaleString('zh-CN')
}

function question(body = {}) {
  return text(body.question || body.message || body.prompt || body.text)
}

function detectSku(message = '') {
  return text(message).match(/\bSKU-[A-Z0-9-]+\b/i)?.[0] || ''
}

function detectPo(message = '') {
  return text(message).match(/\bPO-[A-Z0-9-]+\b/i)?.[0] || ''
}

function detectSalesOrder(message = '') {
  return text(message).match(/\bSO-[A-Z0-9-]+\b/i)?.[0] || ''
}

function hasSalesDemandIntent(message = '', body = {}) {
  const moduleId = text(body.moduleId || body.activeContext?.module).toLowerCase()
  if (moduleId === 'sales') return true
  return /客户订单|销售需求|销售订单|缺货.*客户|影响哪些客户|哪个客户订单|\bSO-[A-Z0-9-]+\b|sales.*risk|customer.*order|customer.*delivery/i.test(message)
}

function evidenceCard(evidence = []) {
  return { type: 'evidence', evidence }
}

function recommendedActions(actions = []) {
  return { type: 'recommended_actions', actions }
}

function orderCard(order) {
  return {
    type: 'sales_order_delivery_risk',
    title: `${order.customerName} · ${order.salesOrderId}`,
    data: {
      keyFacts: [
        `SKU ${order.sku} / ${order.itemName}`,
        `订单 ${qty(order.orderedQty)}，已预留 ${qty(order.reservedQty)}，缺口 ${qty(order.shortageQty)}`,
        `承诺日期 ${order.promisedDate || '待确认'}，风险 ${order.deliveryRiskLabel}`,
      ],
      businessImpact: order.deliveryRiskReason,
      suggestedAction: '先复核库存分配、采购在途和供应商风险，再决定是否生成内部交付风险草稿。',
      limitations: order.dataLimitations,
    },
    evidence: order.evidence,
  }
}

function salesEvidence(order) {
  return asArray(order?.evidence).map((item) => ({
    ...item,
    route: item.route,
  }))
}

function response({ intent, message, orders = [], evidence = [], dataLimitations = [], summary = {} }) {
  const topOrders = orders.slice(0, 5)
  return {
    message,
    content: message,
    provider: 'deterministic',
    providerStatus: 'deterministic',
    intent: { name: intent, confidence: 0.92, slots: {} },
    evidence,
    cards: [
      {
        type: 'sales_demand_summary',
        title: '销售需求交付风险',
        data: {
          keyFacts: [
            `交付风险订单 ${summary.riskOrderCount ?? topOrders.length}`,
            `缺口数量 ${qty(summary.shortageQty || topOrders.reduce((sum, order) => sum + order.shortageQty, 0))}`,
            `受影响客户 ${summary.affectedCustomerCount ?? new Set(topOrders.map((order) => order.customerName)).size}`,
          ],
          businessImpact: topOrders.map((order) => `${order.salesOrderId} ${order.customerName}: ${order.deliveryRiskReason}`),
          limitations: dataLimitations,
        },
        evidence,
      },
      ...topOrders.slice(0, 3).map(orderCard),
      evidenceCard(evidence),
      recommendedActions([
        { kind: 'deep_link', label: '打开销售需求', target: 'sales' },
        { kind: 'review', label: '复核库存分配与采购在途证据', target: 'sales' },
      ]),
    ],
  }
}

export function buildAiSalesDemandResponse(db = {}, body = {}) {
  const msg = question(body)
  if (!msg || !hasSalesDemandIntent(msg, body)) return null
  const sku = detectSku(msg)
  const poId = detectPo(msg)
  const salesOrderId = detectSalesOrder(msg) || (text(body.activeContext?.entityType) === 'sales_order' ? text(body.activeContext?.entityId) : '')

  if (sku) {
    const impact = resolveSkuDemandImpact(db, sku)
    const orders = impact.orders
    const evidence = impact.evidenceLinks
    return response({
      intent: 'sku_demand_impact_query',
      message: orders.length
        ? `结论：${sku} 当前影响 ${orders.length} 个客户订单，合计缺口 ${qty(impact.summary.shortageQty)}。关键证据包括客户订单、库存分配、采购在途和供应商记录；建议优先复核高风险订单的承诺日期与补货进度。`
        : `结论：当前工作区未找到 ${sku} 关联客户订单。当前工作区缺少完整库存分配记录，因此交付风险需人工复核。`,
      orders,
      evidence,
      summary: impact.summary,
      dataLimitations: impact.dataLimitations,
    })
  }

  if (poId) {
    const impact = resolvePurchaseOrderSalesImpact(db, poId)
    return response({
      intent: 'purchase_order_sales_impact_query',
      message: impact.orders.length
        ? `结论：${poId} 关联 ${impact.orders.length} 个客户订单，若采购到货延迟，可能影响 ${impact.orders.map((order) => order.customerName).join('、')} 的承诺交付。建议先复核 PO 状态、收货记录和订单缺口。`
        : `结论：当前工作区未找到 ${poId} 直接关联的客户订单。当前工作区缺少完整采购订单关联，因此交付风险需人工复核。`,
      orders: impact.orders,
      evidence: impact.evidenceLinks,
      summary: impact.summary,
      dataLimitations: impact.dataLimitations,
    })
  }

  if (salesOrderId) {
    const order = getSalesOrderById(db, salesOrderId)
    if (order) {
      const evidence = salesEvidence(order)
      return response({
        intent: 'sales_order_impact_query',
        message: `结论：${order.salesOrderId} 当前为${order.deliveryRiskLabel}。关键证据是 ${order.sku} 订单 ${qty(order.orderedQty)}、已预留 ${qty(order.reservedQty)}、缺口 ${qty(order.shortageQty)}；业务影响是 ${order.deliveryRiskReason} 建议动作是复核库存分配、采购在途和供应商风险后再处理。`,
        orders: [order],
        evidence,
        summary: { riskOrderCount: order.deliveryRiskLevel === 'low' ? 0 : 1, shortageQty: order.shortageQty, affectedCustomerCount: 1 },
        dataLimitations: order.dataLimitations,
      })
    }
  }

  const model = buildSalesDemandReadModel(db)
  const risky = buildCustomerDeliveryRisks(db)
  const orders = model.orders.filter((order) => order.deliveryRiskLevel !== 'low')
  const top = orders[0]
  const intent = /今天|处理|需要我/i.test(msg)
    ? 'sales_demand_today_priority_query'
    : /最危险|最高风险|why|为什么/i.test(msg)
      ? 'sales_order_highest_risk_query'
      : 'customer_delivery_risk_query'
  const message = top
    ? `结论：当前最需要关注 ${top.salesOrderId}（${top.customerName}），风险为${top.deliveryRiskLabel}，缺口 ${qty(top.shortageQty)}，承诺日期 ${top.promisedDate || '待确认'}。关键证据包括 ${top.sku} 库存分配、关联采购订单、供应商和收货记录；业务影响是 ${top.deliveryRiskReason} 建议动作是先复核高风险订单，再查看库存与采购在途。`
    : '结论：当前工作区没有明显客户订单交付风险。仍建议定期复核库存分配、采购在途和供应商风险。'
  return response({
    intent,
    message,
    orders,
    evidence: model.evidenceLinks,
    summary: model.summary,
    dataLimitations: model.dataLimitations,
  })
}
