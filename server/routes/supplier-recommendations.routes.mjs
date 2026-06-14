export async function handleSupplierRecommendationsRoute(ctx) {
  const { req, res, url, db, send, supplierRecommendations } = ctx

  if (req.method === 'GET' && url.pathname === '/api/supplier-recommendations') {
    return send(res, 200, supplierRecommendations(db, {
      sku: url.searchParams.get('sku') || '',
      quantity: Number(url.searchParams.get('quantity') || 0),
      currentSupplier: url.searchParams.get('supplier') || '',
    }))
  }

  return false
}
