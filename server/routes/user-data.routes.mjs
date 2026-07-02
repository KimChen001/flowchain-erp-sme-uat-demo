import { normalizeUserDataImportPayload } from '../domain/user-data-contract.mjs'

function compactPreviewPayload(result) {
  return {
    ok: result.ok,
    dryRun: true,
    recordCounts: result.recordCounts,
    warnings: result.warnings,
    errors: result.errors,
    metadata: result.metadata,
    normalizedPreviewCounts: result.recordCounts,
    importPreview: result.importPreview,
    writesFiles: false,
    writesDb: false,
    overwritesDemoData: false,
  }
}

function compactRecords(result, limit = 5) {
  const data = result.normalizedData || {}
  return {
    purchaseOrders: (data.purchaseOrders || []).slice(0, limit).map((row) => ({
      po: row.po,
      supplier: row.supplier,
      status: row.status,
      eta: row.eta,
      amount: row.amount,
    })),
    products: (data.products || []).slice(0, limit).map((row) => ({
      sku: row.sku,
      name: row.name,
      currentStock: row.currentStock,
      safetyStock: row.safetyStock,
      reorderPoint: row.reorderPoint,
      riskLevel: row.riskLevel,
    })),
    suppliers: (data.suppliers || []).slice(0, limit).map((row) => ({
      id: row.id,
      name: row.name,
      risk: row.risk,
      riskStatus: row.riskStatus,
    })),
    rfqs: (data.rfqs || []).slice(0, limit).map((row) => ({
      id: row.id,
      sourceRequest: row.sourceRequest,
      suppliers: row.suppliers,
      quoted: row.quoted,
      status: row.status,
    })),
    receivingDocs: (data.receivingDocs || []).slice(0, limit).map((row) => ({
      grn: row.grn,
      po: row.po,
      supplier: row.supplier,
      status: row.status,
      items: row.items,
    })),
  }
}

export async function handleUserDataRoute(ctx) {
  const { req, res, url, send, readBody, db } = ctx

  if (req.method === 'POST' && (url.pathname === '/api/user-data/import/dry-run' || url.pathname === '/api/user-data/import/preview')) {
    let body
    try {
      body = await readBody(req)
    } catch {
      send(res, 400, {
        ok: false,
        errors: [{ code: 'invalid_json', message: 'Request body must be valid JSON.', path: 'body', severity: 'error' }],
        warnings: [],
        recordCounts: {},
      })
      return true
    }

    const before = JSON.stringify(db)
    const result = normalizeUserDataImportPayload(body, { importedAt: new Date().toISOString() })
    if (JSON.stringify(db) !== before) {
      send(res, 500, {
        ok: false,
        errors: [{ code: 'dry_run_mutation_detected', message: 'Import dry-run attempted to mutate runtime data.', path: 'db', severity: 'error' }],
        warnings: [],
        recordCounts: {},
      })
      return true
    }

    const payload = compactPreviewPayload(result)
    if (url.pathname.endsWith('/preview')) {
      payload.normalizedRecords = compactRecords(result, 5)
      payload.previewLimit = 5
    }
    send(res, result.ok ? 200 : 422, payload)
    return true
  }

  return false
}
