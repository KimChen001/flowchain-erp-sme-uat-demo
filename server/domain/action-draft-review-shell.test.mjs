import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')

function readSource(...parts) {
  return fs.readFileSync(path.join(repoRoot, ...parts), 'utf8')
}

test('action draft review shell keeps dangerous actions disabled and exposes confirmed safe actions', () => {
  const shell = readSource('src', 'modules', 'action-drafts', 'ActionDraftReviewShell.tsx')
  const planPanel = readSource('src', 'modules', 'action-drafts', 'BusinessActionPlanPanel.tsx')

  assert.match(shell, /export function ActionDraftReviewShell/)
  assert.match(shell, /审阅工作区：可编辑草稿，用户确认后也只保留允许范围内的安全内部记录/)
  assert.match(shell, /预览 \/ 保存边界/)
  assert.match(shell, /confirmed-action-boundary/)
  assert.match(shell, /PR 复核记录/)
  assert.match(shell, /RFQ 复核记录/)
  assert.match(shell, /供应商跟进复核记录/)
  assert.match(planPanel, /不会自动提交审批/)
  assert.match(planPanel, /不会下发 PO/)
  assert.match(planPanel, /不会发送邮件/)
  assert.match(planPanel, /不会授标/)
  assert.match(planPanel, /不会自动库存或发票过账/)
  assert.match(shell, /draftButtonClass = `h-8 rounded-lg px-3 \$\{typography\.denseButton\} disabled:cursor-not-allowed`/)
  assert.match(shell, /onConfirmSafeAction/)
  assert.match(shell, /confirmedActionLabel/)
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
  assert.match(app, /\/api\/user-confirmed-actions/)
  assert.match(app, /<ActionDraftReviewShell/)
  assert.match(app, /onSaveDraft=\{saveActionDraftReview\}/)
  assert.match(app, /onConfirmSafeAction=\{confirmSafeActionDraft\}/)
  assert.match(app, /createsBusinessDocument/)
  assert.match(cockpit, /草稿预览/)
  assert.match(cockpit, /actionDraftRequest\(item\)/)
  assert.match(ai, /actionDraftRequestFromCard/)
  assert.match(ai, /审阅草稿/)
  assert.match(inventory, /source: "inventory_replenishment"/)
  assert.match(inventory, /type: draftType/)
  assert.match(inventory, /originEvidence/)
  assert.doesNotMatch(app, /\/api\/purchase-requests/)
})
