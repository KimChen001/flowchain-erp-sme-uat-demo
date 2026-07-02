import { createBusinessActionDraft } from './business-action-draft-contract.mjs'

function entityId(resolution, type) {
  return resolution?.resolvedEntities?.find((item) => item.type === type)?.id
}

function slotValue(resolution, key) {
  const value = resolution?.extractedSlots?.[key]
  return value?.value ?? value
}

function linkedRecords(resolution) {
  return (resolution?.resolvedEntities || []).map((item) => ({ type: item.type, id: item.id, source: item.source }))
}

function missing(requiredFields, fields) {
  return requiredFields.filter((field) => fields[field] === undefined || fields[field] === '')
}

function shortageSuggestion(evidence = {}) {
  const currentStock = evidence.availableQuantity ?? evidence.currentStock
  const safetyStock = evidence.safetyStock ?? evidence.reorderPoint
  if (Number.isFinite(currentStock) && Number.isFinite(safetyStock) && safetyStock > currentStock) {
    return { suggestedQuantity: safetyStock - currentStock, currentStock, safetyStock, shortfall: safetyStock - currentStock }
  }
  return {}
}

export function buildSupplierApplicationDraft(context = {}) {
  const requiredFields = ['supplierName', 'contactPerson', 'category']
  const fields = {
    supplierName: slotValue(context.resolution, 'supplier') || context.supplierName,
    contactPerson: context.contactPerson,
    category: context.category,
    countryRegion: context.countryRegion,
    reasonForOnboarding: context.reasonForOnboarding || slotValue(context.resolution, 'reason'),
    expectedSpend: context.expectedSpend,
    relatedSkuOrCategory: entityId(context.resolution, 'sku') || context.relatedSkuOrCategory,
    riskNotes: context.riskNotes,
    missingDocuments: context.missingDocuments || ['business_license', 'tax_registration', 'bank_account_proof'],
  }
  return createBusinessActionDraft({
    draftType: 'supplier_application',
    userText: context.userText,
    sourceContext: context.sourceContext,
    extractedFields: compact(fields),
    requiredFields,
    missingFields: missing(requiredFields, fields),
    linkedRecords: linkedRecords(context.resolution),
    dataLimitations: missing(requiredFields, fields).length ? ['supplier_application_partial_fields'] : [],
    assumptions: ['Supplier onboarding draft is review-first and does not create supplier master data.'],
  })
}

export function buildPurchaseRequestDraft(context = {}) {
  const requiredFields = ['sku', 'quantity', 'requiredDate', 'warehouse', 'costCenter']
  const evidenceSuggestion = shortageSuggestion(context.shortageEvidence || {})
  const fields = {
    sku: entityId(context.resolution, 'sku') || context.sku,
    itemName: context.itemName || context.shortageEvidence?.itemName,
    quantity: slotValue(context.resolution, 'quantity') || context.quantity || evidenceSuggestion.suggestedQuantity,
    requiredDate: slotValue(context.resolution, 'requiredDate') || context.requiredDate,
    warehouse: slotValue(context.resolution, 'warehouse') || context.warehouse,
    reason: slotValue(context.resolution, 'reason') || context.reason || (evidenceSuggestion.shortfall ? 'Inventory below safety stock.' : undefined),
    suggestedSupplier: context.suggestedSupplier,
    costCenter: slotValue(context.resolution, 'costCenter') || context.costCenter,
  }
  return createBusinessActionDraft({
    draftType: 'purchase_request',
    userText: context.userText,
    sourceContext: context.sourceContext,
    extractedFields: compact(fields),
    suggestedFields: compact(evidenceSuggestion),
    requiredFields,
    missingFields: missing(requiredFields, fields),
    linkedRecords: linkedRecords(context.resolution),
    evidence: context.shortageEvidence ? [{ type: 'inventory_shortage', ...context.shortageEvidence }] : [],
    dataLimitations: missing(requiredFields, fields).length ? ['purchase_request_partial_fields'] : [],
    assumptions: ['Purchase request draft is not submitted and does not reserve inventory.'],
  })
}

export function buildSourcingEventDraft(context = {}) {
  const requiredFields = ['itemOrCategory', 'quantity', 'responseDeadline', 'evaluationCriteria']
  const fields = {
    eventTitle: context.eventTitle || title('Sourcing event', entityId(context.resolution, 'sku')),
    sourcingType: context.sourcingType || 'RFQ',
    itemOrCategory: entityId(context.resolution, 'sku') || context.itemOrCategory,
    quantity: slotValue(context.resolution, 'quantity') || context.quantity,
    requiredDate: slotValue(context.resolution, 'requiredDate') || context.requiredDate,
    invitedSuppliers: context.invitedSuppliers,
    responseDeadline: slotValue(context.resolution, 'responseDeadline') || context.responseDeadline,
    evaluationCriteria: context.evaluationCriteria,
    linkedPrOrSku: entityId(context.resolution, 'pr') || entityId(context.resolution, 'sku'),
    suggestedAwardBasis: context.suggestedAwardBasis || 'lowest_total_landed_cost_after_quality_review',
  }
  return draftWithLimitations('sourcing_event', requiredFields, fields, context, 'Sourcing event draft is review-only and does not invite suppliers.')
}

export function buildRfqDraft(context = {}) {
  const requiredFields = ['itemOrCategory', 'quantity', 'responseDeadline']
  const fields = {
    sourcePrOrSku: entityId(context.resolution, 'pr') || entityId(context.resolution, 'sku'),
    itemOrCategory: entityId(context.resolution, 'sku') || context.itemOrCategory,
    quantity: slotValue(context.resolution, 'quantity') || context.quantity,
    candidateSuppliers: context.candidateSuppliers,
    responseDeadline: slotValue(context.resolution, 'responseDeadline') || context.responseDeadline,
    termsRequirements: context.termsRequirements,
  }
  return draftWithLimitations('rfq', requiredFields, fields, context, 'RFQ draft is not sent to suppliers automatically.')
}

export function buildPurchaseOrderDraft(context = {}) {
  const requiredFields = ['supplier', 'itemLines', 'price', 'quantity', 'deliveryDate', 'paymentTerms', 'taxCode', 'deliveryLocation']
  const fields = {
    supplier: entityId(context.resolution, 'supplier') || context.supplier,
    linkedRfqOrQuotation: entityId(context.resolution, 'rfq') || context.linkedRfqOrQuotation,
    itemLines: context.itemLines,
    price: context.price,
    quantity: slotValue(context.resolution, 'quantity') || context.quantity,
    deliveryDate: slotValue(context.resolution, 'requiredDate') || context.deliveryDate,
    paymentTerms: context.paymentTerms,
    taxCode: context.taxCode,
    deliveryLocation: context.deliveryLocation,
    missingApprovals: context.missingApprovals || ['buyer_review', 'finance_review'],
  }
  const limitations = missing(requiredFields, fields)
  if (!fields.price || !fields.supplier) limitations.push('supplier_quote_or_price_missing')
  return createBusinessActionDraft({
    draftType: 'purchase_order',
    userText: context.userText,
    sourceContext: context.sourceContext,
    extractedFields: compact(fields),
    requiredFields,
    missingFields: missing(requiredFields, fields),
    linkedRecords: linkedRecords(context.resolution),
    dataLimitations: unique(limitations),
    assumptions: ['Purchase order remains draft-only; AI cannot issue PO or send it to suppliers.'],
  })
}

export function buildSupplierFollowupDraft(context = {}) {
  return createBusinessActionDraft({
    draftType: 'supplier_followup',
    userText: context.userText,
    sourceContext: context.sourceContext,
    extractedFields: compact({ supplier: entityId(context.resolution, 'supplier') || context.supplier, relatedPo: entityId(context.resolution, 'po'), messagePurpose: 'follow_up' }),
    requiredFields: ['supplier', 'messagePurpose'],
    linkedRecords: linkedRecords(context.resolution),
    assumptions: ['Follow-up text is prepared as a draft and is not sent automatically.'],
  })
}

export function buildExceptionNoteDraft(context = {}) {
  return createBusinessActionDraft({
    draftType: 'exception_note',
    userText: context.userText,
    sourceContext: context.sourceContext,
    extractedFields: compact({ relatedGrn: entityId(context.resolution, 'grn'), relatedInvoice: entityId(context.resolution, 'invoice'), recommendation: context.recommendation }),
    requiredFields: ['recommendation'],
    linkedRecords: linkedRecords(context.resolution),
    assumptions: ['Exception note is draft-only and does not approve, post, or pay anything.'],
  })
}

function draftWithLimitations(draftType, requiredFields, fields, context, assumption) {
  return createBusinessActionDraft({
    draftType,
    userText: context.userText,
    sourceContext: context.sourceContext,
    extractedFields: compact(fields),
    requiredFields,
    missingFields: missing(requiredFields, fields),
    linkedRecords: linkedRecords(context.resolution),
    dataLimitations: missing(requiredFields, fields).length ? [`${draftType}_partial_fields`] : [],
    assumptions: [assumption],
  })
}

function compact(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined && value !== ''))
}

function unique(items) {
  return [...new Set(items.filter(Boolean))]
}

function title(prefix, id) {
  return id ? `${prefix} for ${id}` : prefix
}
