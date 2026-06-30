import { createJsonActionDraftRepository } from '../repositories/json-action-draft-repository.mjs'

function actionDraftRepository(ctx) {
  return ctx.repositories?.actionDrafts || createJsonActionDraftRepository(ctx.db)
}

export async function handleActionDraftsRoute(ctx) {
  const { req, res, url, send, readBody } = ctx
  const repository = actionDraftRepository(ctx)

  if (req.method === 'GET' && url.pathname === '/api/action-drafts/schema') {
    send(res, 200, { schema: repository.getSchema() })
    return true
  }

  if (req.method === 'POST' && url.pathname === '/api/action-drafts/preview') {
    const body = await readBody(req)
    const result = repository.previewDraft(body)
    if (!result.ok) {
      send(res, 400, result)
      return true
    }
    send(res, 200, { draft: result.draft, previewOnly: true })
    return true
  }

  return false
}
