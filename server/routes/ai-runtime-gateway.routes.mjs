import { buildAiRuntimeReadinessV2, buildAiRuntimeResponseV2Async } from '../domain/ai-runtime-gateway-v2.mjs'

export async function handleAiRuntimeGatewayRoute(ctx) {
  const { req, res, url, db, send, readBody } = ctx

  if (req.method === 'GET' && url.pathname === '/api/ai-runtime/readiness') {
    send(res, 200, buildAiRuntimeReadinessV2(db, process.env))
    return true
  }

  if (req.method === 'POST' && url.pathname === '/api/ai-runtime/respond') {
    let body = {}
    try {
      body = await readBody(req)
    } catch {
      send(res, 400, { error: '问题内容无法读取，请重新输入。', dataScopeLabel: '当前工作区数据' })
      return true
    }
    const result = await buildAiRuntimeResponseV2Async(db, body, { env: process.env })
    send(res, result.status, result.body)
    return true
  }

  return false
}
