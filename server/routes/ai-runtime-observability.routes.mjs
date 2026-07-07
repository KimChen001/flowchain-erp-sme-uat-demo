import { buildAiRuntimeEvaluationV2, buildAiRuntimeObservabilityV2 } from '../domain/ai-runtime-observability-v2.mjs'

export async function handleAiRuntimeObservabilityRoute(ctx) {
  const { req, res, url, db, send, readBody } = ctx

  if (req.method === 'GET' && url.pathname === '/api/ai-runtime/observability') {
    send(res, 200, buildAiRuntimeObservabilityV2(db, process.env))
    return true
  }

  if (req.method === 'POST' && url.pathname === '/api/ai-runtime/evaluate') {
    let body = {}
    try {
      body = await readBody(req)
    } catch {
      send(res, 400, { error: '评估问题无法读取，请重新输入。', dataScopeLabel: '当前工作区数据' })
      return true
    }
    const result = await buildAiRuntimeEvaluationV2(db, body, { env: process.env })
    send(res, result.status, result.body)
    return true
  }

  return false
}
