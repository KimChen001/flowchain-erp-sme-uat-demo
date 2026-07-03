import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCollaborationNotificationDraft } from './collaboration-notification-draft.mjs'

test('collaboration notification draft is preview-only and never enables external send', () => {
  const draft = buildCollaborationNotificationDraft({
    sourceType: 'inventory_allocation',
    sourceId: 'SKU-00412',
    riskType: 'available_to_promise_risk',
    title: 'SKU-00412 可承诺量风险',
    message: '系统仅生成内部通知草稿，不会自动发送到外部协同工具。',
    audienceSuggestions: ['采购负责人', '销售运营'],
    evidenceLinks: [{ type: 'inventory_availability', id: 'SKU-00412' }],
  })
  assert.equal(draft.externalSendEnabled, false)
  assert.equal(draft.reviewRequired, true)
  assert.deepEqual(draft.channelOptions, ['email', 'slack', 'teams', 'dingtalk', 'wecom', 'feishu'])
  assert.match(draft.messagePreview, /不会自动发送/)
  assert.equal(Object.keys(draft).some((key) => /webhook|sendUrl|sendMethod|endpoint/i.test(key)), false)
})
