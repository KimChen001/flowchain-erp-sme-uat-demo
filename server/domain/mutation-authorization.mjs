const DEFAULT_MESSAGE = '当前用户无权执行该操作。'

export function authorizeMutation(ctx, { allowedRoles = [], action = 'mutate', resource = 'authoritative-runtime' } = {}) {
  const identity = ctx.identity
  if (!identity?.authenticated) {
    ctx.send(ctx.res, 401, {
      code: 'AUTHENTICATION_REQUIRED',
      message: '请先登录后再执行该操作。',
      action,
      resource,
    })
    return { blocked: true, identity: null }
  }
  if (!allowedRoles.includes(identity.role)) {
    ctx.send(ctx.res, 403, {
      code: 'PERMISSION_DENIED',
      message: DEFAULT_MESSAGE,
      action,
      resource,
    })
    return { blocked: true, identity }
  }
  return { blocked: false, identity }
}
