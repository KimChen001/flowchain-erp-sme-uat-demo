import { validateAiRetrievalOutput } from './ai-retrieval-context.mjs'

function text(value, fallback = '') {
  const next = String(value ?? '').trim()
  return next || fallback
}

export function getAiRetrievalSandboxState(env = {}) {
  const enabled = env.AI_RETRIEVAL_LLM_SANDBOX === 'true'
  return {
    enabled,
    defaultEnabled: false,
    mode: enabled ? 'sandbox' : 'disabled',
    providerCallsAllowed: enabled,
    factOverrideAllowed: false,
    businessMutationAllowed: false,
    vectorDatabase: false,
  }
}

export function buildAiRetrievalSandboxPrompt(context = {}) {
  return {
    role: 'wording_sandbox',
    instruction: 'Rewrite the deterministic evidence summary for readability only. Do not add facts, actions, or internal labels.',
    immutableFacts: context.immutableFacts || {},
    evidence: Array.isArray(context.evidence) ? context.evidence : [],
    allowedActions: Array.isArray(context.allowedActions) ? context.allowedActions : [],
    responseRules: Array.isArray(context.responseRules) ? context.responseRules : [],
  }
}

export async function runAiRetrievalSandbox(context = {}, options = {}) {
  const state = getAiRetrievalSandboxState(options.env || {})
  if (!state.enabled) {
    return {
      usedModel: false,
      state,
      answer: text(options.fallbackAnswer),
      guardrail: validateAiRetrievalOutput(options.fallbackAnswer || '', context),
      reason: 'AI retrieval LLM sandbox is disabled by default.',
    }
  }

  const adapter = options.adapter
  if (!adapter || typeof adapter.wordAnswer !== 'function') {
    return {
      usedModel: false,
      state,
      answer: text(options.fallbackAnswer),
      guardrail: validateAiRetrievalOutput(options.fallbackAnswer || '', context),
      reason: 'AI retrieval LLM sandbox requires an explicit wording adapter.',
    }
  }

  const result = await adapter.wordAnswer({
    prompt: buildAiRetrievalSandboxPrompt(context),
    fallbackAnswer: text(options.fallbackAnswer),
  })
  const answer = text(result?.answer, options.fallbackAnswer)
  const guardrail = validateAiRetrievalOutput(answer, context)
  return {
    usedModel: Boolean(result?.usedModel) && guardrail.valid,
    state,
    answer: guardrail.valid ? answer : text(options.fallbackAnswer),
    guardrail,
    reason: guardrail.valid ? 'sandbox wording accepted' : 'sandbox wording rejected by retrieval guardrail',
  }
}

