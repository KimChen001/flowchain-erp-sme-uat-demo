import { buildTodayCockpit } from '../domain/today-cockpit-read-model.mjs'

export async function handleTodayCockpitRoute(ctx) {
  const { req, res, url, db, send } = ctx

  if (req.method === 'GET' && url.pathname === '/api/today-cockpit') {
    send(res, 200, buildTodayCockpit(db))
    return true
  }

  return false
}
