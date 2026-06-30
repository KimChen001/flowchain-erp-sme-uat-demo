import { actionDraftSchema, buildActionDraftSuggestion } from '../domain/action-draft-boundary.mjs'
import { buildPurchaseRequestDraftPreview } from '../domain/purchase-request-draft-preview.mjs'

export async function handleActionDraftsRoute(ctx) {
  const { req, res, url, send, readBody } = ctx

  if (req.method === 'GET' && url.pathname === '/api/action-drafts/schema') {
    send(res, 200, { schema: actionDraftSchema() })
    return true
  }

  if (req.method === 'POST' && url.pathname === '/api/action-drafts/preview') {
    const body = await readBody(req)
    if (body?.type === 'purchase_request_draft') {
      const result = buildPurchaseRequestDraftPreview(body, { db: ctx.db })
      if (!result.ok) {
        send(res, 400, result)
        return true
      }
      send(res, 200, { draft: result.draft, previewOnly: true })
      return true
    }
    const result = buildActionDraftSuggestion(body)
    if (!result.ok) {
      send(res, 400, result)
      return true
    }
    send(res, 200, { draft: result.draft, previewOnly: true })
    return true
  }

  return false
}
