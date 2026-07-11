import { getSettingsRuntime, updateSettingsSection } from '../repositories/settings-runtime-repository.mjs'

export async function handleSettingsRuntimeRoute(ctx) {
  const { req, res, url, send, readBody } = ctx
  if (req.method === 'GET' && url.pathname === '/api/settings-runtime') {
    send(res, 200, getSettingsRuntime())
    return true
  }

  const match = url.pathname.match(/^\/api\/settings-runtime\/([a-z-]+)$/)
  if (req.method === 'PATCH' && match) {
    try {
      const body = await readBody(req)
      const result = updateSettingsSection(match[1], body.settings, body.actor)
      send(res, 200, result)
    } catch (error) {
      send(res, error?.statusCode || 400, { error: error?.message || '设置保存失败' })
    }
    return true
  }
  return false
}
