import { createHash } from 'node:crypto'

export const AI_RETRIEVAL_AUDIT_EVENTS = new Set([
  'evidence_bundle_assembled',
  'evidence_clicked',
  'recommended_action_shown',
  'draft_preview_opened',
  'action_accepted',
  'action_rejected',
])

export const AI_MODEL_BOUNDARY = Object.freeze({
  providerDefault: 'disabled',
  vectorDatabase: 'disabled',
  deterministicResponsibilities: [
    'intent_classification',
    'entity_extraction',
    'evidence_bundle_assembly',
    'allowed_action_filtering',
    'fact_guardrail_validation',
  ],
  optionalModelResponsibilities: [
    'wording_only',
    'query_rewrite_suggestion',
    'rerank_suggestion',
  ],
  modelMustNot: [
    'create_business_facts',
    'override_immutable_facts',
    'submit_business_actions',
    'select_provider_by_default',
  ],
})

function text(value, fallback = '') {
  const next = String(value ?? '').trim()
  return next || fallback
}

function compact(value = {}) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ''))
}

function queryHash(query = '') {
  return createHash('sha256').update(text(query)).digest('hex').slice(0, 16)
}

function queryPreview(query = '') {
  return text(query).slice(0, 80)
}

function entityFromPayload(payload = {}) {
  const entity = payload.entity || payload.primaryEntity || {}
  return compact({
    type: text(entity.type || payload.entityType, 'ai_retrieval'),
    id: text(entity.id || payload.entityId),
  })
}

export function createAiRetrievalAuditEvent(eventType, payload = {}, options = {}) {
  const safeType = AI_RETRIEVAL_AUDIT_EVENTS.has(eventType) ? eventType : 'evidence_bundle_assembled'
  const now = options.now instanceof Date ? options.now : new Date()
  const entity = entityFromPayload(payload)
  return {
    tenantId: text(payload.tenantId, 'tenant-flowchain-sme'),
    timestamp: now.toISOString(),
    source: 'ai_assisted',
    module: 'ai-retrieval',
    action: 'ai_tool_invoked',
    entity,
    summary: text(payload.summary, `AI retrieval ${safeType}`),
    metadata: compact({
      aiRetrievalEventType: safeType,
      intent: text(payload.intent),
      queryHash: payload.query ? queryHash(payload.query) : undefined,
      queryPreview: payload.query ? queryPreview(payload.query) : undefined,
      evidenceIds: Array.isArray(payload.evidenceIds) ? payload.evidenceIds.map(text).filter(Boolean).slice(0, 10) : undefined,
      actionKind: text(payload.actionKind),
      actionLabel: text(payload.actionLabel).slice(0, 120),
      accepted: typeof payload.accepted === 'boolean' ? payload.accepted : undefined,
    }),
  }
}

export function getAiModelBoundaryState(env = {}) {
  return {
    providerDefault: 'disabled',
    vectorDatabase: false,
    smallModelEnabled: env.AI_SMALL_MODEL_ENABLED === 'true',
    deterministicFactsRequired: true,
    factOverrideAllowed: false,
    businessMutationAllowed: false,
    supportedOptionalModelUses: env.AI_SMALL_MODEL_ENABLED === 'true'
      ? ['wording_only', 'query_rewrite_suggestion', 'rerank_suggestion']
      : [],
  }
}

export function createNoopAiModelAdapter() {
  return Object.freeze({
    mode: 'noop',
    provider: 'none',
    async rewriteQuery(input = {}) {
      return { usedModel: false, query: text(input.query), reason: 'model boundary disabled by default' }
    },
    async rerankEvidence(input = {}) {
      return { usedModel: false, evidence: Array.isArray(input.evidence) ? input.evidence : [], reason: 'model boundary disabled by default' }
    },
    async wordAnswer(input = {}) {
      return { usedModel: false, answer: text(input.fallbackAnswer), reason: 'model boundary disabled by default' }
    },
  })
}

