import assert from 'node:assert/strict'
import test from 'node:test'
import { createJsonDb } from '../repositories/json-db.mjs'
import {
  buildCollaborationNotificationDraftsV2,
  FORBIDDEN_COLLABORATION_DRAFT_ACTION_PATTERN,
  FORBIDDEN_COLLABORATION_DRAFT_TECHNICAL_PATTERN,
} from './collaboration-notification-drafts-v2.mjs'
import { buildAiSuggestionsWorkbenchV2 } from './ai-suggestions-workbench-v2.mjs'
import { buildReviewFirstActionWorkflowV2 } from './review-first-action-workflow-v2.mjs'
import { handleCollaborationNotificationDraftsRoute } from '../routes/collaboration-notification-drafts.routes.mjs'

const db = await createJsonDb('./data/scm-demo.json').read()

function visibleText(payload) {
  return JSON.stringify({
    drafts: payload.drafts.map((draft) => ({
      title: draft.title,
      notificationTypeLabel: draft.notificationTypeLabel,
      channelLabel: draft.channelLabel,
      audienceLabel: draft.audienceLabel,
      recipientPreview: draft.recipientPreview,
      sourceObjectLabel: draft.sourceObjectLabel,
      targetEntityLabel: draft.targetEntityLabel,
      status: draft.status,
      subject: draft.subject,
      messagePreview: draft.messagePreview,
      keyEvidence: draft.keyEvidence,
      businessImpact: draft.businessImpact,
      requestedResponse: draft.requestedResponse,
      reviewChecklist: draft.reviewChecklist,
      missingInformation: draft.missingInformation,
      navigationLabels: draft.navigationLinks.map((link) => link.label),
      allowedActions: draft.allowedActions.map((action) => action.label),
      boundaryLabels: draft.boundaryLabels,
      dataLimitations: draft.dataLimitations,
      auditPreview: draft.auditPreview,
    })),
    channelPolicies: payload.channelPolicies,
    audienceGroups: payload.audienceGroups,
    sourceSummary: payload.sourceSummary.map((source) => ({
      sourceLabel: source.sourceLabel,
      draftCount: source.draftCount,
      highPriorityCount: source.highPriorityCount,
    })),
    dataLimitations: payload.dataLimitations,
  })
}

test('collaboration notification drafts returns full top-level contract', () => {
  const result = buildCollaborationNotificationDraftsV2(db)
  for (const key of ['summary', 'drafts', 'channelPolicies', 'audienceGroups', 'sourceSummary', 'dataLimitations', 'generatedAt', 'dataScopeLabel']) {
    assert.ok(Object.hasOwn(result, key), key)
  }
  assert.equal(result.dataScopeLabel, '当前工作区数据')
  assert.ok(result.drafts.length > 0)
  assert.ok(result.channelPolicies.length >= 7)
})

test('summary counts are derived from drafts', () => {
  const { summary, drafts } = buildCollaborationNotificationDraftsV2(db)
  assert.equal(summary.totalDraftCount, drafts.length)
  assert.equal(summary.internalDraftCount, drafts.filter((draft) => draft.notificationType === 'internal_followup').length)
  assert.equal(summary.supplierDraftCount, drafts.filter((draft) => draft.notificationType === 'supplier_communication').length)
  assert.equal(summary.financeDraftCount, drafts.filter((draft) => ['finance_review', 'invoice_variance_review'].includes(draft.notificationType)).length)
  assert.equal(summary.dataQualityDraftCount, drafts.filter((draft) => draft.notificationType === 'data_completion').length)
  assert.equal(summary.receivingDraftCount, drafts.filter((draft) => draft.notificationType === 'receiving_exception').length)
  assert.equal(summary.inventoryDraftCount, drafts.filter((draft) => draft.notificationType === 'inventory_review').length)
  assert.equal(summary.reportReviewDraftCount, drafts.filter((draft) => draft.notificationType === 'report_insight_review').length)
  assert.equal(summary.highPriorityCount, drafts.filter((draft) => draft.priority === 'high').length)
  assert.equal(summary.dataLimitedCount, drafts.filter((draft) => draft.dataLimitations.length).length)
})

test('drafts cover at least five collaboration notification types', () => {
  const types = new Set(buildCollaborationNotificationDraftsV2(db).drafts.map((draft) => draft.notificationType))
  for (const expected of ['internal_followup', 'supplier_communication', 'finance_review', 'data_completion', 'receiving_exception', 'inventory_review', 'report_insight_review']) {
    assert.ok(types.has(expected), expected)
  }
})

test('each draft carries evidence source target audience and review content', () => {
  const { drafts } = buildCollaborationNotificationDraftsV2(db)
  for (const draft of drafts) {
    assert.ok(draft.id)
    assert.ok(draft.draftNo)
    assert.ok(draft.sourceModule)
    assert.ok(draft.sourceObjectType)
    assert.ok(draft.sourceObjectId)
    assert.ok(draft.sourceObjectLabel)
    assert.ok(draft.targetModule)
    assert.ok(draft.targetEntityType)
    assert.ok(draft.targetEntityId !== undefined)
    assert.ok(draft.audienceType)
    assert.ok(draft.audienceLabel)
    assert.ok(draft.subject)
    assert.ok(draft.messagePreview)
    assert.ok(draft.keyEvidence.length)
    assert.ok(draft.businessImpact)
    assert.ok(draft.requestedResponse)
    assert.ok(draft.navigationLinks.length)
    assert.ok(draft.boundaryLabels.length)
    assert.equal(draft.previewOnly, true)
    assert.equal(draft.reviewRequired, true)
    assert.equal(draft.requiresHumanReview, true)
  }
})

test('channel policies are preview-only and review-required', () => {
  const { channelPolicies } = buildCollaborationNotificationDraftsV2(db)
  for (const policy of channelPolicies) {
    assert.equal(policy.previewOnly, true)
    assert.equal(policy.reviewRequired, true)
    assert.ok(policy.boundarySummary)
    assert.ok(policy.allowedUse.length)
  }
})

test('visible collaboration draft text avoids forbidden wording', () => {
  const text = visibleText(buildCollaborationNotificationDraftsV2(db))
  assert.doesNotMatch(text, FORBIDDEN_COLLABORATION_DRAFT_ACTION_PATTERN)
  assert.doesNotMatch(text, FORBIDDEN_COLLABORATION_DRAFT_TECHNICAL_PATTERN)
})

test('empty data returns minimum structure and limitations without throwing', () => {
  const result = buildCollaborationNotificationDraftsV2({})
  assert.ok(result.summary)
  assert.ok(Array.isArray(result.drafts))
  assert.ok(result.channelPolicies.length >= 7)
  assert.ok(result.dataLimitations.length)
})

test('collaboration drafts align with AI suggestions and review workflow sources', () => {
  const result = buildCollaborationNotificationDraftsV2(db)
  const ai = buildAiSuggestionsWorkbenchV2(db)
  const review = buildReviewFirstActionWorkflowV2(db)
  const aiSources = new Set(ai.suggestions.map((item) => `${item.sourceObjectType}:${item.sourceObjectId}`))
  const reviewTargets = new Set(review.drafts.map((item) => `${item.targetEntityType}:${item.targetEntityId}`))
  assert.ok(result.drafts.some((draft) => aiSources.has(`${draft.sourceObjectType}:${draft.sourceObjectId}`) || draft.relatedAiSuggestionId))
  assert.ok(result.drafts.some((draft) => reviewTargets.has(`${draft.targetEntityType}:${draft.targetEntityId}`) || draft.relatedActionDraftId))
})

test('route GET /api/collaboration-notification-drafts returns payload', async () => {
  let status = 0
  let payload = null
  const handled = await handleCollaborationNotificationDraftsRoute({
    req: { method: 'GET' },
    res: {},
    url: new URL('/api/collaboration-notification-drafts', 'http://localhost'),
    db,
    send(_res, nextStatus, nextPayload) {
      status = nextStatus
      payload = nextPayload
    },
  })
  assert.equal(handled, true)
  assert.equal(status, 200)
  assert.ok(payload.summary)
  assert.ok(payload.drafts.length)
})
