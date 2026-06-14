export async function handleInventoryMovementsRoute(ctx) {
  const { req, res, url, db, send, ensureInventoryMovements } = ctx

  if (req.method === 'GET' && url.pathname === '/api/inventory-movements') {
    return send(res, 200, ensureInventoryMovements(db))
  }

  return false
}
