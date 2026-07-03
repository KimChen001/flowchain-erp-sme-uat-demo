function text(value, fallback = '') {
  const next = String(value ?? '').trim()
  return next || fallback
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

const CHANNEL_OPTIONS = Object.freeze(['email', 'slack', 'teams', 'dingtalk', 'wecom', 'feishu'])

export function buildCollaborationNotificationDraft({
  sourceType = 'inventory_allocation',
  sourceId = '',
  riskType = 'inventory_allocation_risk',
  title = '',
  message = '',
  evidenceLinks = [],
  audienceSuggestions = [],
  dataLimitations = [],
} = {}) {
  const id = text(sourceId || riskType || sourceType, 'notification')
  return {
    notificationDraftId: `CND-${id}`.replace(/[^\w-]/g, '-').slice(0, 80),
    sourceType: text(sourceType, 'inventory_allocation'),
    sourceId: text(sourceId),
    riskType: text(riskType, 'inventory_allocation_risk'),
    channelOptions: [...CHANNEL_OPTIONS],
    audienceSuggestions: asArray(audienceSuggestions).map(text).filter(Boolean),
    title: text(title, '内部通知草稿'),
    messagePreview: text(message, '系统仅生成内部通知草稿，不会自动发送到外部协同工具。'),
    evidenceLinks: asArray(evidenceLinks).slice(0, 12),
    reviewRequired: true,
    externalSendEnabled: false,
    dataLimitations: asArray(dataLimitations).map(text).filter(Boolean),
  }
}
