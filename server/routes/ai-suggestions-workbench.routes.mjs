import { buildAiSuggestionsWorkbenchV2 } from '../domain/ai-suggestions-workbench-v2.mjs'

export async function handleAiSuggestionsWorkbenchRoute(ctx) {
  const { req, res, url, db, send } = ctx

  if (req.method === 'GET' && url.pathname === '/api/ai-suggestions-workbench') {
    send(res, 200, buildAiSuggestionsWorkbenchV2(db))
    return true
  }

  return false
}
