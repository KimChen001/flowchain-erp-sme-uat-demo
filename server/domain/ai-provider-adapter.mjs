export const SUPPORTED_AI_PROVIDERS = Object.freeze(['local', 'openai', 'doubao', 'deepseek'])
export const DEFAULT_AI_PROVIDER = 'local'

export function normalizeAiProviderName(value = '') {
  const normalized = String(value || '').trim().toLowerCase()
  if (SUPPORTED_AI_PROVIDERS.includes(normalized)) return normalized
  return DEFAULT_AI_PROVIDER
}

export function isExternalAiProvider(provider = '') {
  return ['openai', 'doubao', 'deepseek'].includes(normalizeAiProviderName(provider))
}

function flagEnabled(value) {
  return String(value || '').trim().toLowerCase() === 'true'
}

export function getAiProviderConfig(env = {}) {
  const provider = normalizeAiProviderName(env.AI_PROVIDER || DEFAULT_AI_PROVIDER)
  const intentExtractionEnabled = flagEnabled(env.AI_INTENT_EXTRACTION_ENABLED)
  const answerComposerEnabled = flagEnabled(env.AI_ANSWER_COMPOSER_ENABLED)
  return {
    provider,
    mode: isExternalAiProvider(provider) ? 'external' : 'local',
    intentExtractionEnabled: isExternalAiProvider(provider) ? intentExtractionEnabled : false,
    answerComposerEnabled: isExternalAiProvider(provider) ? answerComposerEnabled : false,
  }
}

export function buildIntentExtractionRequest({
  message = '',
  activeContext = null,
  moduleId = '',
  availableIntents = [],
} = {}) {
  return {
    message: String(message || '').trim(),
    moduleId: String(moduleId || '').trim(),
    activeContext: activeContext && typeof activeContext === 'object' && !Array.isArray(activeContext)
      ? {
          module: String(activeContext.module || '').trim(),
          entityType: String(activeContext.entityType || '').trim(),
          entityId: String(activeContext.entityId || '').trim(),
          entityLabel: String(activeContext.entityLabel || '').trim(),
          view: String(activeContext.view || '').trim(),
          route: String(activeContext.route || '').trim(),
        }
      : null,
    availableIntents: Array.isArray(availableIntents)
      ? availableIntents.map((intent) => String(intent || '').trim()).filter(Boolean)
      : [],
  }
}

function normalizeConfidence(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.min(1, parsed))
}

export function validateIntentExtractionResult(result = {}, allowedIntents = []) {
  const allowed = new Set(Array.isArray(allowedIntents) ? allowedIntents : [])
  const rawIntent = String(result?.intent || result?.name || '').trim()
  const intent = allowed.has(rawIntent) ? rawIntent : 'unsupported'
  const slots = result?.slots && typeof result.slots === 'object' && !Array.isArray(result.slots)
    ? { ...result.slots }
    : {}
  const confidence = intent === 'unsupported' ? 0 : normalizeConfidence(result?.confidence)
  return {
    intent,
    slots,
    confidence,
    supported: intent !== 'unsupported',
  }
}
