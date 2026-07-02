import { normalizeBusinessCommand } from './business-command-normalizer.mjs'
import { extractBusinessActionIntents } from './business-action-intent-extractor.mjs'
import { resolveEntitySlots } from './entity-slot-resolver.mjs'

const FORBIDDEN_AUTONOMOUS_ACTIONS = Object.freeze(['submit', 'approve', 'pay', 'post', 'send_email', 'issue_po', 'modify_business_data'])

function choosePrimaryEntity(resolution) {
  return resolution?.resolvedEntities?.[0]?.id
}

function step(intent, index, resolution, options = {}) {
  return {
    id: `step-${index}`,
    order: index,
    intent,
    kind: intent.startsWith('draft_') ? 'action_draft' : 'diagnostic',
    entity: options.entity || choosePrimaryEntity(resolution),
    status: options.status || (intent.startsWith('draft_') ? 'requires_review' : 'ready'),
    dependsOn: options.dependsOn,
    condition: options.condition,
    missingFields: options.missingFields || [],
    corrections: options.corrections || [],
    requiresUserReview: intent.startsWith('draft_'),
    mutationAllowed: false,
  }
}

export function planCompoundBusinessCommand(input = '', options = {}) {
  const normalization = options.normalization || normalizeBusinessCommand(input)
  const extraction = options.extraction || extractBusinessActionIntents(input, { normalization })
  const primaryIntent = extraction.candidates.find((item) => item.kind !== 'compound')?.intent
  const resolution = options.resolution || resolveEntitySlots(normalization.normalizedText, { ...options, intent: primaryIntent })
  const source = `${normalization.originalText} ${normalization.normalizedText}`
  const corrections = normalization.corrections.map((item) => `${item.from} -> ${item.to}`)
  const steps = []

  if (/看下|是不是不够|够不够|库存不够|低于安全库存/i.test(source)) {
    steps.push(step('explain_sku_shortage', 1, resolution))
  }

  const actionIntents = extraction.candidates.filter((item) => item.kind === 'action_draft').map((item) => item.intent)
  for (const intent of actionIntents) {
    if (steps.some((item) => item.intent === intent)) continue
    const index = steps.length + 1
    const previous = steps[index - 2]
    const conditional = /如果|不够就|if/i.test(source) && intent === 'draft_purchase_request'
    const dependency = dependencyFor(intent, previous, source)
    steps.push(step(intent, index, resolution, {
      dependsOn: dependency?.dependsOn,
      condition: conditional ? 'if shortage confirmed' : dependency?.condition,
      status: blockedStatus(intent, source),
      missingFields: missingFor(intent, resolution, source),
      corrections,
    }))
  }

  if (!steps.length) {
    steps.push({
      id: 'step-1',
      order: 1,
      intent: 'guided_business_action_choice',
      kind: 'fallback',
      status: 'needs_clarification',
      missingFields: ['business action'],
      requiresUserReview: true,
      mutationAllowed: false,
    })
  }

  relinkDependencies(steps, source)
  const planType = inferPlanType(steps, source)
  return {
    planType,
    originalText: normalization.originalText,
    normalizedText: normalization.normalizedText,
    steps,
    dependencies: steps.filter((item) => item.dependsOn).map((item) => ({ step: item.id, dependsOn: item.dependsOn, condition: item.condition })),
    conditions: steps.flatMap((item) => item.condition ? [{ step: item.id, condition: item.condition }] : []),
    assumptions: [...resolution.assumptions, ...normalization.corrections.map((item) => item.message)],
    forbiddenAutonomousActions: [...FORBIDDEN_AUTONOMOUS_ACTIONS],
    requiresUserConfirmation: true,
    mutationAllowed: false,
    auditPreview: [
      { action: 'command_interpreted', summary: normalization.normalizedText },
      { action: 'business_action_plan_prepared', summary: `${steps.length} reviewable step(s), no autonomous mutation.` },
    ],
  }
}

function dependencyFor(intent, previous, source) {
  if (!previous) return null
  if (intent === 'draft_rfq' && /基于|based on|根据|为这个 PR/i.test(source)) return { dependsOn: previous.id, condition: 'after PR draft reviewed' }
  if (intent === 'draft_purchase_order' && /报价|quote|RFQ|根据|转成/i.test(source)) return { dependsOn: previous.id, condition: 'after supplier quote exists' }
  if (intent === 'draft_sourcing_event' && previous.intent === 'draft_purchase_request') return { dependsOn: previous.id, condition: 'after PR draft reviewed' }
  if (previous.kind === 'diagnostic') return { dependsOn: previous.id, condition: 'if diagnostic supports action' }
  return null
}

function relinkDependencies(steps, source) {
  const pr = steps.find((item) => item.intent === 'draft_purchase_request')
  const rfq = steps.find((item) => item.intent === 'draft_rfq' || item.intent === 'draft_sourcing_event')
  const po = steps.find((item) => item.intent === 'draft_purchase_order')
  if (pr && rfq && !rfq.dependsOn) {
    rfq.dependsOn = pr.id
    rfq.condition = rfq.condition || 'after PR draft reviewed'
  }
  if (rfq && po) {
    po.dependsOn = rfq.id
    po.condition = 'after supplier quote exists'
    po.status = 'blocked'
    po.missingFields = [...new Set([...(po.missingFields || []), 'supplier quote', 'approved supplier price'])]
  }
  if (/不够就/i.test(source) && pr) pr.condition = 'if shortage confirmed'
}

function blockedStatus(intent, source) {
  if (intent === 'draft_purchase_order' && /报价|RFQ|quote|下单/i.test(source)) return 'blocked'
  return 'requires_review'
}

function missingFor(intent, resolution) {
  const map = {
    draft_purchase_request: ['sku', 'quantity', 'requiredDate', 'warehouse', 'costCenter'],
    draft_sourcing_event: ['itemOrCategory', 'quantity', 'responseDeadline', 'evaluationCriteria'],
    draft_rfq: ['itemOrCategory', 'quantity', 'responseDeadline'],
    draft_purchase_order: ['supplier', 'price', 'deliveryDate', 'paymentTerms', 'taxCode'],
    draft_supplier_application: ['supplierName', 'contactPerson', 'category'],
  }
  const extracted = resolution?.extractedSlots || {}
  const entities = resolution?.resolvedEntities || []
  return (map[intent] || []).filter((field) => {
    if (field === 'sku' || field === 'itemOrCategory') return !entities.some((item) => item.type === 'sku' || item.type === 'pr')
    if (field === 'supplier') return !entities.some((item) => item.type === 'supplier')
    return extracted[field] === undefined
  })
}

function inferPlanType(steps, source) {
  if (steps[0]?.kind === 'fallback') return 'fallback'
  if (steps.some((item) => item.kind === 'diagnostic') && steps.some((item) => item.kind === 'action_draft')) return 'diagnostic_then_action'
  if (steps.length > 1 || /(然后|再|之后|如果|不够就)/i.test(source)) return 'compound_action'
  return 'single_action'
}
