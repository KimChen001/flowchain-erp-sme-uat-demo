import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')

function readSource(...parts) {
  return fs.readFileSync(path.join(repoRoot, ...parts), 'utf8')
}

test('action draft review shell is preview-only and keeps confirmation disabled', () => {
  const shell = readSource('src', 'modules', 'action-drafts', 'ActionDraftReviewShell.tsx')

  assert.match(shell, /export function ActionDraftReviewShell/)
  assert.match(shell, /审阅工作区：可编辑和保存草稿，但不会创建、提交、发送或过账任何业务记录/)
  assert.match(shell, /预览 \/ 保存边界/)
  assert.match(shell, /不会创建 PR、RFQ、PO、GRN 或库存事务/)
  assert.match(shell, /确认提交/)
  assert.match(shell, /draftButtonClass = `h-8 rounded-lg px-3 \$\{typography\.denseButton\} disabled:cursor-not-allowed`/)
  assert.match(shell, /disabled className=\{`\$\{draftButtonClass\} text-white`\}/)
  assert.match(shell, /取消草稿/)
  assert.match(shell, /重置修改/)
  assert.match(shell, /保存草稿/)
  assert.match(shell, /复制草稿内容/)
  assert.doesNotMatch(shell, /JSON\.stringify/)
})

test('action draft review shell renders business payload, validation, audit, and evidence safely', () => {
  const shell = readSource('src', 'modules', 'action-drafts', 'ActionDraftReviewShell.tsx')

  assert.match(shell, /function businessValue/)
  assert.match(shell, /function payloadLabel/)
  assert.match(shell, /function isEditableScalar/)
  assert.match(shell, /function editValue/)
  assert.match(shell, /updatePayloadField/)
  assert.match(shell, /normalizeEvidenceLinks\(activeDraft\?\.originEvidence \|\| \[\], \{ source: "actionDraft" \}\)/)
  assert.match(shell, /navigationIntentFromEvidenceLink\(link, \{ source: "actionDraft" \}\)/)
  assert.match(shell, /onNavigate\(intent\.activeId, intent\.focusTarget \|\| null\)/)
  assert.match(shell, /需要补充或人工复核/)
  assert.match(shell, /审计预览/)
})

test('Today Cockpit AI and inventory can open review shell without business write actions', () => {
  const app = readSource('src', 'app', 'FlowChainApp.tsx')
  const cockpit = readSource('src', 'modules', 'overview', 'TodayCockpitPanel.tsx')
  const ai = readSource('src', 'modules', 'ai-assistant', 'Panel.tsx')
  const inventory = readSource('src', 'modules', 'inventory', 'Page.tsx')

  assert.match(app, /\/api\/action-drafts\/preview/)
  assert.match(app, /\/api\/action-drafts\/save/)
  assert.match(app, /<ActionDraftReviewShell/)
  assert.match(app, /onSaveDraft=\{saveActionDraftReview\}/)
  assert.match(app, /createsBusinessDocument/)
  assert.match(cockpit, /草稿预览/)
  assert.match(cockpit, /actionDraftRequest\(item\)/)
  assert.match(ai, /actionDraftRequestFromCard/)
  assert.match(ai, /审阅草稿/)
  assert.match(inventory, /source: "inventory_replenishment"/)
  assert.match(inventory, /type: draftType/)
  assert.match(inventory, /originEvidence/)
  assert.doesNotMatch(app, /\/api\/purchase-requests/)
  assert.doesNotMatch(app, /confirmDraft/)
})
