import { normalizeBusinessCommand } from './business-command-normalizer.mjs'
import { extractBusinessActionIntents } from './business-action-intent-extractor.mjs'
import { resolveEntitySlots } from './entity-slot-resolver.mjs'
import { planCompoundBusinessCommand } from './compound-business-command-planner.mjs'
import {
  buildExceptionNoteDraft,
  buildPurchaseOrderDraft,
  buildPurchaseRequestDraft,
  buildRfqDraft,
  buildSourcingEventDraft,
  buildSupplierApplicationDraft,
  buildSupplierFollowupDraft,
} from './business-draft-builders.mjs'

const BUILDERS = {
  draft_supplier_application: buildSupplierApplicationDraft,
  draft_purchase_request: buildPurchaseRequestDraft,
  draft_sourcing_event: buildSourcingEventDraft,
  draft_rfq: buildRfqDraft,
  draft_purchase_order: buildPurchaseOrderDraft,
  draft_supplier_followup: buildSupplierFollowupDraft,
  draft_exception_note: buildExceptionNoteDraft,
}

export function intakeBusinessAction(input = '', options = {}) {
  const normalization = normalizeBusinessCommand(input)
  const extraction = extractBusinessActionIntents(input, { normalization })
  const primaryIntent = extraction.candidates.find((item) => item.kind === 'action_draft' || item.kind === 'diagnostic')?.intent
  const resolution = resolveEntitySlots(normalization.normalizedText, { ...options, intent: primaryIntent })
  const plan = planCompoundBusinessCommand(input, { ...options, normalization, extraction, resolution })
  const drafts = plan.steps
    .filter((step) => step.kind === 'action_draft')
    .flatMap((step) => {
      const builder = BUILDERS[step.intent]
      if (!builder) return []
      return [builder({ ...options, userText: input, resolution, sourceContext: options.sourceContext })]
    })

  return {
    normalization,
    intentExtraction: extraction,
    resolution,
    plan,
    drafts,
    provider: 'local',
    mutationAllowed: false,
    requiresReview: true,
  }
}
