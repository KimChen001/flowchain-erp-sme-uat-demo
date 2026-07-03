import {
  buildInventoryAllocationReadModel,
  buildReservationPreview,
  getSkuAvailability,
  resolveAvailableToPromise,
  resolveDemandSupplyGap,
  resolvePurchaseOrderSupplyImpact,
  resolveSalesOrderAllocationImpact,
} from './inventory-allocation-read-model.mjs'

function text(value, fallback = '') {
  const next = String(value ?? '').trim()
  return next || fallback
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

function hasInventoryAllocationIntent(message = '', body = {}) {
  const moduleId = text(body.moduleId || body.activeContext?.module).toLowerCase()
  if (/采购申请|PR\s*草稿|补货.*草稿|生成.*草稿|准备.*PR/i.test(message)) return false
  const explicitAllocation = /库存分配|库存可用量|可承诺量|ATP|还能卖|供需缺口|预留|占用库存|预计可用|在途采购|补缺口|客户订单.*库存/i.test(message)
  const explicitShortageReason = /\bSKU-[A-Z0-9-]+\b/i.test(message) && /为什么.*缺货|缺货.*为什么|缺货原因/.test(message)
  return explicitAllocation || explicitShortageReason || (moduleId === 'inventory' && /可承诺|ATP|供需|预留|预计可用/.test(message))
}

function evidenceCard(evidence = []) {
  return { type: 'evidence', title: '可点击跳转', evidence }
}

function recommendedActions(actions = []) {
  return { type: 'recommended_actions', title: '建议动作', actions }
}

function allocationCard(item) {
  return {
    type: 'inventory_allocation_summary',
    title: `${item.sku} 库存分配`,
    data: {
      keyFacts: [
        `实物库存 ${qty(item.onHandQty)}，已预留 ${qty(item.reservedQty)}`,
        `销售需求 ${qty(item.salesDemandQty)}，可用量 ${qty(item.availableQty)}，可承诺量 ${qty(item.availableToPromiseQty)}`,
        `在途采购 ${qty(item.incomingPurchaseQty)}，预计可用 ${qty(item.projectedAvailableQty)}，缺口 ${qty(item.shortageQty)}`,
      ],
      businessImpact: item.deliveryRiskPropagation,
      suggestedAction: '先复核客户订单、在途采购和供应商交付，再决定是否生成采购申请草稿预览或内部通知草稿。',
      limitations: item.dataLimitations,
    },
    evidence: item.evidence,
  }
}

function response({ intent, message, items = [], evidence = [], dataLimitations = [], summary = {} }) {
  return {
    message,
    content: message,
    provider: 'deterministic',
    providerStatus: 'deterministic',
    intent: { name: intent, confidence: 0.93, slots: {} },
    evidence,
    cards: [
      {
        type: 'inventory_allocation_answer',
        title: '库存分配分析',
        data: {
          conclusion: message.split('关键证据')[0].trim(),
          keyEvidence: evidence.slice(0, 5).map((item) => `${item.label || item.id}${item.summary ? `：${item.summary}` : ''}`),
          businessImpact: items.slice(0, 3).map((item) => `${item.sku}：${item.deliveryRiskPropagation || item.riskReason}`),
          suggestedAction: '人工复核库存分配、客户订单和采购在途；系统不会自动锁定库存、自动出库或自动创建采购订单。',
          dataLimitations,
          summary,
        },
        evidence,
      },
      ...items.slice(0, 3).map(allocationCard),
      evidenceCard(evidence),
      recommendedActions([
        { kind: 'deep_link', label: '打开库存可用量', target: 'inventory' },
        { kind: 'deep_link', label: '打开销售需求', target: 'sales' },
        { kind: 'review', label: '生成内部通知草稿', target: 'inventory', externalSendEnabled: false },
      ]),
    ],
  }
}

function insufficientMessage() {
  return '当前工作区缺少完整库存分配记录，因此可承诺量和预留建议需人工复核。'
}

export function buildAiInventoryAllocationResponse(db = {}, body = {}) {
  const msg = question(body)
  if (!msg || !hasInventoryAllocationIntent(msg, body)) return null
  const sku = detectSku(msg) || (text(body.activeContext?.entityType) === 'inventory_item' ? text(body.activeContext?.entityId) : '')
  const poId = detectPo(msg)
  const salesOrderId = detectSalesOrder(msg)

  if (salesOrderId && /预留|占用|订单/.test(msg)) {
    const impact = resolveSalesOrderAllocationImpact(db, salesOrderId)
    const item = impact.availability
    const evidence = impact.evidenceLinks || []
    return response({
      intent: 'sales_order_allocation_impact_query',
      message: item
        ? `结论：${salesOrderId} 关联 ${item.sku}，当前可承诺量 ${qty(item.availableToPromiseQty)}，建议预留 ${qty(impact.reservationPreview.reservationSuggestedQty)}，预留缺口 ${qty(impact.reservationPreview.reservationShortageQty)}。关键证据包括客户订单、库存可用量、在途采购和供应商记录。业务影响：${item.deliveryRiskPropagation} 建议动作：人工复核后再继续处理。可点击跳转见证据链接。数据限制 / 不确定性：${impact.dataLimitations.join('、') || '当前记录可支持初步判断'}。`
        : `结论：${salesOrderId} 暂无法形成完整库存分配判断。${insufficientMessage()}`,
      items: item ? [item] : [],
      evidence,
      dataLimitations: impact.dataLimitations,
      summary: { salesOrderId },
    })
  }

  if (poId) {
    const impact = resolvePurchaseOrderSupplyImpact(db, poId)
    const items = impact.impactedSkus || []
    return response({
      intent: 'purchase_order_supply_impact_query',
      message: items.length
        ? `结论：${poId} 影响 ${items.map((item) => item.sku).join('、')} 的在途采购补缺口，关联客户订单 ${impact.affectedSalesOrders.map((order) => order.salesOrderId).join('、') || '待补充'}。关键证据包括 PO、SKU 库存可用量、客户订单和收货记录。业务影响：若到货延迟，可能扩大供需缺口并影响客户交付。建议动作：先复核 PO ETA、GRN 和供应商承诺，再生成内部通知草稿。可点击跳转见证据链接。数据限制 / 不确定性：${impact.dataLimitations.join('、') || '当前记录可支持初步判断'}。`
        : `结论：当前工作区未找到 ${poId} 关联的库存补缺口记录。${insufficientMessage()}`,
      items,
      evidence: impact.evidenceLinks,
      dataLimitations: impact.dataLimitations,
      summary: { poId, impactedSkuCount: items.length },
    })
  }

  if (sku) {
    const item = getSkuAvailability(db, sku)
    if (!item) {
      return response({
        intent: 'sku_inventory_allocation_query',
        message: `结论：当前工作区未找到 ${sku} 的库存可用量记录。${insufficientMessage()}`,
        dataLimitations: ['record_not_found'],
      })
    }
    const atp = resolveAvailableToPromise(db, sku)
    const gap = resolveDemandSupplyGap(db, sku)
    const reservation = buildReservationPreview(db, { sku, requestedQty: item.shortageQty || item.salesDemandQty })
    const asksAtp = /可承诺量|ATP|还能卖/.test(msg)
    const asksWhy = /为什么|原因|缺货|缺口/.test(msg)
    const asksReservation = /预留/.test(msg)
    const conclusion = asksAtp
      ? `结论：${sku} 当前可承诺量为 ${qty(atp.availableToPromiseQty)}，可用量 ${qty(atp.availableQty)}，预计可用 ${qty(atp.projectedAvailableQty)}。`
      : asksReservation
        ? `结论：${sku} 当前建议预留 ${qty(reservation.reservationSuggestedQty)}，可预留 ${qty(reservation.reservableQty)}，预留缺口 ${qty(reservation.reservationShortageQty)}。`
        : asksWhy
          ? `结论：${sku} 当前${item.riskLabel}，缺口 ${qty(item.shortageQty)}，主要原因是销售需求 ${qty(item.salesDemandQty)}、已预留 ${qty(item.reservedQty)} 与在途采购 ${qty(item.incomingPurchaseQty)} 之间存在供需差。`
          : `结论：${sku} 当前可用量 ${qty(item.availableQty)}，可承诺量 ${qty(item.availableToPromiseQty)}，供需缺口 ${qty(item.shortageQty)}。`
    return response({
      intent: asksAtp ? 'available_to_promise_query' : asksReservation ? 'reservation_preview_query' : asksWhy ? 'demand_supply_gap_query' : 'sku_inventory_allocation_query',
      message: `${conclusion} 关键证据包括 SKU 库存、客户订单 ${item.affectedSalesOrders.map((order) => order.salesOrderId).join('、') || '待补充'}、在途采购 ${item.linkedPurchaseOrders.map((po) => po.poId).join('、') || '待补充'} 和供应商记录。业务影响：${item.deliveryRiskPropagation} 建议动作：先复核库存分配和采购到货，再决定是否生成采购申请草稿预览或内部通知草稿。可点击跳转见证据链接。数据限制 / 不确定性：${gap.dataLimitations.join('、') || '当前记录可支持初步判断'}。`,
      items: [item],
      evidence: item.evidence,
      dataLimitations: item.dataLimitations,
      summary: { availableToPromiseQty: item.availableToPromiseQty, shortageQty: item.shortageQty },
    })
  }

  const model = buildInventoryAllocationReadModel(db)
  const projectedNegative = model.availability.filter((item) => item.projectedAvailableQty < 0)
  const items = /预计可用量为负|预计可用.*负/.test(msg) ? projectedNegative : model.risks
  const top = items[0]
  return response({
    intent: /今天|最需要|处理/.test(msg) ? 'inventory_today_priority_query' : 'inventory_shortage_risk_query',
    message: top
      ? `结论：库存方面最需要处理 ${top.sku}，当前${top.riskLabel}，可承诺量 ${qty(top.availableToPromiseQty)}，预计可用 ${qty(top.projectedAvailableQty)}，缺口 ${qty(top.shortageQty)}。关键证据包括库存可用量、客户订单、在途采购、供应商和收货记录。业务影响：${top.deliveryRiskPropagation} 建议动作：先复核供需缺口和预留冲突，再生成内部通知草稿。可点击跳转见证据链接。数据限制 / 不确定性：${top.dataLimitations.join('、') || '当前记录可支持初步判断'}。`
      : '结论：当前工作区没有明显库存分配风险。仍建议定期复核可承诺量、供需缺口和预留建议。',
    items,
    evidence: model.evidenceLinks,
    dataLimitations: model.dataLimitations,
    summary: model.summary,
  })
}
