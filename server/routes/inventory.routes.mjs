import { createJsonInventoryReadRepository } from '../repositories/json-inventory-read-repository.mjs'

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
  return ctx.repositories?.inventoryRead || createJsonInventoryReadRepository(ctx.db)
}

export async function handleInventoryRoute(ctx) {
  const { req, res, url, send } = ctx
  const repository = inventoryReadRepository(ctx)

  if (req.method === 'GET' && url.pathname === '/api/inventory/items') {
    send(res, 200, { items: await repository.listItems(query(url)) })
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
