import { getDefaultSettingsRuntimeRepository } from '../repositories/settings-runtime-repository.mjs'

function settingsRepository(ctx) {
  return ctx.repositories?.settingsRuntime || getDefaultSettingsRuntimeRepository()
}

export async function handleSettingsRuntimeRoute(ctx) {
  const { req, res, url, send, readBody } = ctx
  const repository = settingsRepository(ctx)
  if (req.method === 'GET' && url.pathname === '/api/settings-runtime') {
    try {
      send(res, 200, await repository.getSettingsRuntime())
    } catch (error) {
      send(res, error?.statusCode || 500, { error: error?.message || '系统设置读取失败' })
    }
    return true
  }

  const match = url.pathname.match(/^\/api\/settings-runtime\/([a-z-]+)$/)
  if (req.method === 'PATCH' && match) {
    try {
      const body = await readBody(req)
      const result = await repository.updateSettingsSection(match[1], body.settings, body.actor)
      send(res, 200, result)
    } catch (error) {
      send(res, error?.statusCode || 400, { error: error?.message || '设置保存失败' })
    }
    return true
  }
  return false
}
