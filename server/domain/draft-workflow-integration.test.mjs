import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')

function readSource(...parts) {
  return fs.readFileSync(path.join(repoRoot, ...parts), 'utf8')
}

test('inventory replenishment opens draft preview instead of creating purchase requests', () => {
  const app = readSource('src', 'app', 'FlowChainApp.tsx')
  const inventory = readSource('src', 'modules', 'inventory', 'Page.tsx')

  assert.match(app, /function ReplenishmentRequestModal/)
  assert.match(app, /onPreviewDraft/)
  assert.match(app, /type: draftType/)
  assert.match(app, /purchase_request_draft/)
  assert.match(app, /rfq_draft/)
  assert.match(app, /\/api\/action-drafts\/preview/)
  assert.doesNotMatch(app, /submitReplenishmentRequest/)
  assert.doesNotMatch(app, /inventoryPurchaseRequestPayload/)
  assert.doesNotMatch(app, /提交采购申请/)
  assert.doesNotMatch(app, /生成补货采购申请/)

  assert.match(app, /<InventoryPanel[^>]+onReviewActionDraft=\{openActionDraftReview\}/)
  assert.match(inventory, /onReviewActionDraft/)
  assert.match(inventory, /function inventoryDraftRequest/)
  assert.match(inventory, /purchase_request_draft/)
  assert.match(inventory, /rfq_draft/)
  assert.match(inventory, /预览 PR 草稿/)
  assert.match(inventory, /预览 RFQ 草稿/)
  assert.match(inventory, /查看批次\/序列号/)
  assert.match(inventory, /返回库存列表/)
  assert.match(inventory, /查看事务流水/)
  assert.match(inventory, /查看异常单据/)
  assert.match(inventory, /inventoryReadFallbackScopes/)
  assert.match(inventory, /演示数据回落/)
  assert.doesNotMatch(inventory, /\/api\/purchase-requests/)
  assert.doesNotMatch(inventory, /inventoryPurchaseRequestPayload/)
  assert.doesNotMatch(inventory, /apiJson<PurchaseRequest>/)
})

test('Today Cockpit maps reviewable actions to supported draft previews with fallback copy', () => {
  const cockpit = readSource('src', 'modules', 'overview', 'TodayCockpitPanel.tsx')

  assert.match(cockpit, /function actionDraftRequest/)
  assert.match(cockpit, /purchase_request_draft/)
  assert.match(cockpit, /rfq_draft/)
  assert.match(cockpit, /po_followup_draft/)
  assert.match(cockpit, /supplier_followup_draft/)
  assert.match(cockpit, /当前动作需要人工复核，尚未接入草稿预览。/)
  assert.doesNotMatch(cockpit, /\/api\/purchase-requests/)
  assert.doesNotMatch(cockpit, /JSON\.stringify/)
})

test('action draft preview route remains preview-only and does not use persistence writes', () => {
  const route = readSource('server', 'routes', 'action-drafts.routes.mjs')

  assert.match(route, /\/api\/action-drafts\/preview/)
  assert.match(route, /previewOnly: true/)
  assert.doesNotMatch(route, /writeDb/)
  assert.doesNotMatch(route, /saveDb/)
  assert.doesNotMatch(route, /createPurchaseRequest/)
})
