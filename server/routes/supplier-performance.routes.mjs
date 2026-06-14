export async function handleSupplierPerformanceRoute(ctx) {
  const { req, res, url, db, send, supplierPerformance } = ctx

  if (req.method === 'GET' && url.pathname === '/api/supplier-performance') {
    return send(res, 200, supplierPerformance(db))
  }

  return false
}
