import { buildCollaborationNotificationDraftsV2 } from '../domain/collaboration-notification-drafts-v2.mjs'

export async function handleCollaborationNotificationDraftsRoute(ctx) {
  const { req, res, url, db, send } = ctx

  if (req.method === 'GET' && url.pathname === '/api/collaboration-notification-drafts') {
    send(res, 200, buildCollaborationNotificationDraftsV2(db))
    return true
  }

  return false
}
