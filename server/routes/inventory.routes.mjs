import { createJsonInventoryReadRepository } from '../repositories/json-inventory-read-repository.mjs'
import {
  buildInventoryAllocationReadModel,
  buildReservationPreview,
  buildShortageRisks,
  getSkuAvailability,
  listSkuAvailability,
  resolveAvailableToPromise,
  resolveDemandSupplyGap,
  resolvePurchaseOrderSupplyImpact,
  resolveSalesOrderAllocationImpact,
} from '../domain/inventory-allocation-read-model.mjs'

function query(url) {
  return {
    q: url.searchParams.get('q') || '',
    status: url.searchParams.get('status') || '',
    warehouse: url.searchParams.get('warehouse') || '',
    risk: url.searchParams.get('risk') || '',
    limit: url.searchParams.get('limit') || '',
  }
}

function inventoryReadRepository(ctx) {
  return ctx.repositories?.inventoryRuntime || ctx.repositories?.inventoryRead || createJsonInventoryReadRepository(ctx.db)
}

export async function handleInventoryRoute(ctx) {
  const { req, res, url, send } = ctx
  const repository = inventoryReadRepository(ctx)

  const allocationPath = /^\/api\/inventory\/(?:availability|allocation|shortages|demand-supply-gap|available-to-promise|reservation-preview|sales-order-impact|po-supply-impact)(?:\/.*)?$/.test(url.pathname)
  if (allocationPath && req.method !== 'GET') {
    send(res, 405, { error: 'Method not allowed' })
    return true
  }

  if (req.method === 'GET' && (url.pathname === '/api/inventory/availability' || url.pathname === '/api/inventory/allocation')) {
    const availability = listSkuAvailability(ctx.db, query(url))
    const model = buildInventoryAllocationReadModel(ctx.db)
    send(res, 200, {
      availability,
      allocation: availability,
      summary: model.summary,
      risks: model.risks,
      evidenceLinks: model.evidenceLinks,
      dataLimitations: model.dataLimitations,
    })
    return true
  }

  const availabilityMatch = url.pathname.match(/^\/api\/inventory\/(?:availability|allocation)\/([^/]+)$/)
  if (req.method === 'GET' && availabilityMatch) {
    const availability = getSkuAvailability(ctx.db, availabilityMatch[1])
    if (!availability) {
      send(res, 404, { error: 'Inventory availability not found' })
      return true
    }
    send(res, 200, {
      availability,
      allocation: availability,
      summary: {
        skuCount: 1,
        highRiskSkuCount: ['blocked', 'high'].includes(availability.riskLevel) ? 1 : 0,
        totalShortageQty: availability.shortageQty,
        reservedQty: availability.reservedQty,
        incomingPurchaseQty: availability.incomingPurchaseQty,
        atpInsufficientSkuCount: availability.availableToPromiseQty <= 0 && availability.salesDemandQty > 0 ? 1 : 0,
      },
      risks: ['blocked', 'high', 'medium'].includes(availability.riskLevel) ? [availability] : [],
      evidenceLinks: availability.evidence,
      dataLimitations: availability.dataLimitations,
    })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/inventory/shortages') {
    const risks = buildShortageRisks(ctx.db, query(url))
    send(res, 200, {
      risks,
      availability: risks,
      allocation: risks,
      summary: buildInventoryAllocationReadModel(ctx.db).summary,
      evidenceLinks: risks.flatMap((item) => item.evidence || []),
      dataLimitations: [...new Set(risks.flatMap((item) => item.dataLimitations || []))],
    })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/inventory/demand-supply-gap') {
    const gap = resolveDemandSupplyGap(ctx.db, url.searchParams.get('sku') || '')
    send(res, 200, { ...gap, availability: gap.gap, allocation: gap.gap, risks: gap.gap ? [gap.gap] : [], summary: buildInventoryAllocationReadModel(ctx.db).summary })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/inventory/available-to-promise') {
    const atp = resolveAvailableToPromise(ctx.db, url.searchParams.get('sku') || '')
    send(res, 200, { ...atp, availability: atp, allocation: atp, risks: [], summary: buildInventoryAllocationReadModel(ctx.db).summary })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/inventory/reservation-preview') {
    const reservationPreview = buildReservationPreview(ctx.db, {
      sku: url.searchParams.get('sku') || '',
      salesOrderId: url.searchParams.get('salesOrderId') || '',
      requestedQty: url.searchParams.get('requestedQty') || 0,
    })
    send(res, 200, {
      reservationPreview,
      availability: getSkuAvailability(ctx.db, reservationPreview.sku),
      allocation: getSkuAvailability(ctx.db, reservationPreview.sku),
      summary: buildInventoryAllocationReadModel(ctx.db).summary,
      risks: [],
      evidenceLinks: reservationPreview.evidenceLinks,
      dataLimitations: reservationPreview.dataLimitations,
    })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/inventory/sales-order-impact') {
    const impact = resolveSalesOrderAllocationImpact(ctx.db, url.searchParams.get('salesOrderId') || '')
    send(res, 200, { ...impact, availability: impact.availability, allocation: impact.availability, summary: buildInventoryAllocationReadModel(ctx.db).summary, risks: impact.availability ? [impact.availability] : [] })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/inventory/po-supply-impact') {
    const impact = resolvePurchaseOrderSupplyImpact(ctx.db, url.searchParams.get('poId') || '')
    send(res, 200, { ...impact, availability: impact.impactedSkus, allocation: impact.impactedSkus, summary: buildInventoryAllocationReadModel(ctx.db).summary, risks: impact.impactedSkus })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/inventory/items') {
    send(res, 200, { items: await repository.listItems(query(url)) })
    return true
  }

  if (req.method === 'POST' && url.pathname === '/api/inventory/items') {
    try {
      const item = await repository.upsertItem(await ctx.readBody(req))
      send(res, 201, { item })
    } catch (error) {
      send(res, error.status || 400, { error: error.message, code: error.code })
    }
    return true
  }

  const itemMatch = url.pathname.match(/^\/api\/inventory\/items\/([^/]+)$/)
  if (req.method === 'GET' && itemMatch) {
    const item = await repository.getItem(itemMatch[1])
    if (!item) {
      send(res, 404, { error: 'Inventory item not found' })
      return true
    }
    send(res, 200, { item })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/inventory/lots') {
    send(res, 200, { lots: await repository.listLots(query(url)) })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/inventory/serials') {
    send(res, 200, { serials: await repository.listSerials(query(url)) })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/inventory/movements') {
    send(res, 200, { movements: await repository.listMovements(query(url)) })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/inventory/exceptions') {
    send(res, 200, { exceptions: await repository.listExceptions(query(url)) })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/inventory/summary') {
    send(res, 200, { summary: await repository.getSummary() })
    return true
  }

  return false
}
