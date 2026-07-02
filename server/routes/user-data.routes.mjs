import { normalizeUserDataImportPayload } from '../domain/user-data-contract.mjs'

export async function handleUserDataRoute(ctx) {
  const { req, res, url, send, readBody, db } = ctx

  if (req.method === 'POST' && url.pathname === '/api/user-data/import/dry-run') {
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

    send(res, result.ok ? 200 : 422, {
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
    })
    return true
  }

  return false
}
