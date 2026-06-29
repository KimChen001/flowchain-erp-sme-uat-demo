import {
  buildInventoryExceptions,
  buildInventoryItems,
  buildInventoryLots,
  buildInventoryMovements,
  buildInventorySerials,
  buildInventorySummary,
  filterInventoryRows,
  getInventoryItemBySku,
} from '../domain/inventory-read.mjs'

function query(url) {
  return {
    q: url.searchParams.get('q') || '',
    status: url.searchParams.get('status') || '',
    warehouse: url.searchParams.get('warehouse') || '',
    risk: url.searchParams.get('risk') || '',
    limit: url.searchParams.get('limit') || '',
  }
}

export async function handleInventoryRoute(ctx) {
  const { req, res, url, db, send } = ctx

  if (req.method === 'GET' && url.pathname === '/api/inventory/items') {
    send(res, 200, { items: filterInventoryRows(buildInventoryItems(db), query(url)) })
    return true
  }

  const itemMatch = url.pathname.match(/^\/api\/inventory\/items\/([^/]+)$/)
  if (req.method === 'GET' && itemMatch) {
    const item = getInventoryItemBySku(db, itemMatch[1])
    if (!item) {
      send(res, 404, { error: 'Inventory item not found' })
      return true
    }
    send(res, 200, { item })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/inventory/lots') {
    send(res, 200, { lots: filterInventoryRows(buildInventoryLots(db), query(url)) })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/inventory/serials') {
    send(res, 200, { serials: filterInventoryRows(buildInventorySerials(db), query(url)) })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/inventory/movements') {
    send(res, 200, { movements: filterInventoryRows(buildInventoryMovements(db), query(url)) })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/inventory/exceptions') {
    send(res, 200, { exceptions: filterInventoryRows(buildInventoryExceptions(db), query(url)) })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/inventory/summary') {
    send(res, 200, { summary: buildInventorySummary(db) })
    return true
  }

  return false
}
