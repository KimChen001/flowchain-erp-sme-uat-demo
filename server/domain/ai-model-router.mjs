function text(value, fallback = '') {
  const next = String(value ?? '').trim()
  return next || fallback
}

export const AI_MODEL_POLICIES = Object.freeze({
  deterministicOnly: 'deterministic_only',
  smallModelOptional: 'small_model_optional',
  llmWordingOptional: 'llm_wording_optional',
  llmDraftOptional: 'llm_draft_optional',
  providerDisabled: 'provider_disabled',
  guidedFallback: 'guided_fallback',
})

export const AI_MODEL_POLICY_DEFINITIONS = Object.freeze({
  [AI_MODEL_POLICIES.deterministicOnly]: {
    enabledByDefault: true,
    modelMayRun: false,
    description: 'Business facts and actions are resolved by deterministic FlowChain read models only.',
  },
  [AI_MODEL_POLICIES.smallModelOptional]: {
    enabledByDefault: false,
    modelMayRun: false,
    futureCapabilities: ['intent_classification', 'entity_extraction', 'query_rewriting', 'reranking'],
  },
  [AI_MODEL_POLICIES.llmWordingOptional]: {
    enabledByDefault: false,
    modelMayRun: false,
    futureCapabilities: ['explanation_wording_polish', 'sop_wording_polish'],
  },
  [AI_MODEL_POLICIES.llmDraftOptional]: {
    enabledByDefault: false,
    modelMayRun: false,
    futureCapabilities: ['draft_wording_polish'],
  },
  [AI_MODEL_POLICIES.providerDisabled]: {
    enabledByDefault: true,
    modelMayRun: false,
    description: 'External provider path remains blocked unless explicitly enabled elsewhere.',
  },
  [AI_MODEL_POLICIES.guidedFallback]: {
    enabledByDefault: true,
    modelMayRun: false,
    description: 'Unknown questions receive deterministic business choices instead of provider fallback.',
  },
})

export const AI_MODEL_FORBIDDEN_DECISIONS = Object.freeze([
  'counts',
  'status',
  'dates',
  'amounts',
  'po_overdue_status',
  'sku_risk',
  'rfq_reply_counts',
  'supplier_performance_facts',
  'action_execution',
])

export const AI_MODEL_OPTIONAL_TASKS = Object.freeze({
  smallModel: ['intent_classification', 'entity_extraction', 'query_rewriting', 'reranking'],
  llmWording: ['explanation_wording_polish', 'sop_wording_polish'],
  llmDraft: ['draft_wording_polish'],
})

const BUSINESS_FACT_INTENTS = new Set([
  'attention_overview_query',
  'today_cockpit_priority_query',
  'priority_explanation_query',
  'procurement_exception_query',
  'inventory_status_query',
  'rfq_followup_query',
  'supplier_followup_query',
  'receiving_exception_query',
  'pr_status_query',
  'relationship_reasoning_query',
  'data_limitation_query',
  'sop_retrieval_query',
  'entity_lookup_query',
])

export function normalizeAiModelPolicy(policy = '') {
  const normalized = text(policy)
  return AI_MODEL_POLICY_DEFINITIONS[normalized] ? normalized : AI_MODEL_POLICIES.deterministicOnly
}

export function modelPolicyForAiIntent(intent = '') {
  const normalized = text(intent)
  if (normalized === 'unknown_guided_fallback') return AI_MODEL_POLICIES.guidedFallback
  if (normalized === 'provider_disabled') return AI_MODEL_POLICIES.providerDisabled
  if (BUSINESS_FACT_INTENTS.has(normalized)) return AI_MODEL_POLICIES.deterministicOnly
  if (normalized === 'draft_preview_query') return AI_MODEL_POLICIES.deterministicOnly
  return AI_MODEL_POLICIES.deterministicOnly
}

export function routeAiModelPolicy(input = {}) {
  const modelPolicy = normalizeAiModelPolicy(input.modelPolicy || modelPolicyForAiIntent(input.intent))
  return {
    usedModel: false,
    modelPolicy,
    reason: 'disabled_by_default',
    deterministicFallback: true,
    providerCallsAllowed: false,
    externalProvider: 'none',
    forbiddenDecisions: AI_MODEL_FORBIDDEN_DECISIONS,
  }
}

export async function maybeUseSmallModelForIntent(input = {}) {
  return {
    ...routeAiModelPolicy({ ...input, modelPolicy: AI_MODEL_POLICIES.smallModelOptional }),
    optionalTasks: AI_MODEL_OPTIONAL_TASKS.smallModel,
  }
}

export async function maybeUseLlmForWording(input = {}) {
  return {
    ...routeAiModelPolicy({ ...input, modelPolicy: AI_MODEL_POLICIES.llmWordingOptional }),
    optionalTasks: AI_MODEL_OPTIONAL_TASKS.llmWording,
    answer: text(input.fallbackAnswer),
  }
}

export async function maybeUseLlmForDraftPolish(input = {}) {
  return {
    ...routeAiModelPolicy({ ...input, modelPolicy: AI_MODEL_POLICIES.llmDraftOptional }),
    optionalTasks: AI_MODEL_OPTIONAL_TASKS.llmDraft,
    draftText: text(input.fallbackDraftText),
  }
}
