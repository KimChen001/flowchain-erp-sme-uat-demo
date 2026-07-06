import { buildAiSuggestionsWorkbenchV2 } from './ai-suggestions-workbench-v2.mjs'
import { buildDataAccessQualityV2 } from './data-access-quality-v2.mjs'
import { buildOperationsControlTowerV2 } from './operations-control-tower-v2.mjs'
import { buildReportsAnalyticsV2 } from './reports-analytics-v2.mjs'
import { buildReviewFirstActionWorkflowV2 } from './review-first-action-workflow-v2.mjs'

export const FORBIDDEN_COLLABORATION_DRAFT_ACTION_PATTERN = /自动批准|自动下单|正式创建\s*PO|下发\s*PO|发送\s*PO|发布\s*RFQ|邀请供应商|发送邮件|发送|推送|已发送|提交收货|Receive Submit|Submit Receipt|库存过账|Post Invoice|Approve Invoice|Mark as Paid|Payment execution|Export to Accounting|付款|会计过账|修改供应商主数据|更新银行账户|发布风险评级|自动黑名单|自动暂停供应商|自动修复|自动提交导入|自动覆盖数据|自动写入数据库|批量删除|清空数据|sent|delivered|dispatched|webhook|portal invite/i
export const FORBIDDEN_COLLABORATION_DRAFT_TECHNICAL_PATTERN = /JSON|dry-run|tenantId|userId|datasetId|writesDb|writesFiles|DB|database|tool_result|provider|fallback|deterministic|mock|fake|demo|UAT|sample data|demo data|response_card|entityType|documentType|raw enum|payload|webhook/i

const GENERATED_AT = '2026-05-25T10:30:00.000Z'
const COMMON_BOUNDARIES = ['草稿预览', '人工复核', '人工确认后使用', '不形成正式业务处理', '不外发', '仅内部留存']
const TYPE_LABELS = {
  internal_followup: '内部协同通知草稿',
  supplier_communication: '供应商沟通草稿',
  finance_review: '财务复核通知草稿',
  data_completion: '数据补齐通知草稿',
  receiving_exception: '收货异常通知草稿',
  inventory_review: '库存风险复核通知草稿',
  report_insight_review: '报表洞察复核通知草稿',
  rfq_followup: 'RFQ 跟进通知草稿',
  invoice_variance_review: '发票差异复核通知草稿',
}
const CHANNEL_LABELS = {
  internal_note: '内部协同备注',
  supplier_message_draft: '供应商沟通草稿',
  finance_note: '财务复核说明',
  data_quality_note: '数据质量说明',
  receiving_note: '收货异常说明',
  inventory_note: '库存复核说明',
  report_note: '报表洞察复核说明',
}
const AUDIENCE_LABELS = {
  internal_procurement: '采购协同负责人',
  internal_inventory: '库存与计划负责人',
  internal_finance: '财务复核负责人',
  internal_data_owner: '数据负责人',
  supplier_contact_preview: '供应商联系人预览',
  manager_review: '经理复核',
}

function asArray(value) { return Array.isArray(value) ? value : [] }
function text(value, fallback = '') {
  const raw = String(value ?? '').trim() || fallback
  return sanitize(raw)
}
function number(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
function compact(value = '') {
  return text(value).toLowerCase().replace(/[^\w\u4e00-\u9fa5-]+/g, '')
}
function sanitize(value = '') {
  return String(value ?? '')
    .replace(/自动批准|approve|approved/ig, '人工复核确认')
    .replace(/自动下单|正式创建\s*PO|下发\s*PO|发送\s*PO|发布\s*RFQ|邀请供应商|发送邮件|发送|推送|已发送|提交收货/ig, '形成正式业务处理')
    .replace(/Receive Submit|Submit Receipt|库存过账|Post Invoice|Approve Invoice|Mark as Paid|Payment execution|Export to Accounting|会计过账|付款/ig, '正式资金或凭证处理')
    .replace(/修改供应商主数据|更新银行账户|发布风险评级|自动黑名单|自动暂停供应商/ig, '供应商资料正式变更')
    .replace(/自动修复|自动提交导入|自动覆盖数据|自动写入数据库|批量删除|清空数据/ig, '覆盖当前工作区数据')
    .replace(/sent|delivered|dispatched|webhook|portal invite/ig, '外部触达动作')
    .replace(/JSON|dry-run|tenantId|userId|datasetId|writesDb|writesFiles|tool_result|provider|fallback|deterministic|mock|fake|demo|UAT|sample data|demo data|response_card|entityType|documentType|raw enum|payload|database/ig, '当前工作区数据')
    .replace(/\bDB\b/g, '当前工作区数据')
}
function priorityRank(value = '') {
  if (/P0|高|high|risk|阻断/i.test(text(value))) return 4
  if (/P1|中|warning|需复核/i.test(text(value))) return 3
  return 1
}
function normalizePriority(value = '') {
  const rank = priorityRank(value)
  if (rank >= 4) return 'high'
  if (rank >= 3) return 'medium'
  return 'low'
}
function uniqueBy(items = [], keyOf = (item) => item.id) {
  const seen = new Set()
  const result = []
  for (const item of items.filter(Boolean)) {
    const key = keyOf(item)
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }
  return result
}
function entityTypeFor(type = '') {
  if (type === 'po') return 'purchase_order'
  if (type === 'grn') return 'receiving_doc'
  if (type === 'invoice' || type === 'match') return 'supplier_invoice'
  if (type === 'inventory') return 'inventory_item'
  if (type === 'data_quality') return 'data_quality_issue'
  if (type === 'ai_suggestions') return 'ai_suggestions'
  if (type === 'review_workflow') return 'review_workflow'
  if (type === 'reports') return 'report_metric'
  return type || 'business_object'
}
function moduleFor(type = '') {
  if (type === 'pr') return 'procurement:requests'
  if (type === 'rfq') return 'procurement:rfq'
  if (type === 'po') return 'procurement:orders'
  if (type === 'grn') return 'procurement:receiving'
  if (type === 'invoice' || type === 'match') return 'procurement:invoices'
  if (type === 'supplier') return 'srm:master'
  if (type === 'inventory') return 'inventory'
  if (type === 'data_quality') return 'imports'
  if (type === 'reports') return 'reports'
  if (type === 'ai_suggestions') return 'overview:ai'
  if (type === 'review_workflow') return 'review-actions'
  return 'overview'
}
function labelFor(type = '', id = '') {
  if (type === 'supplier') return text(id, '供应商')
  if (type === 'inventory') return /^SKU-/i.test(text(id)) ? text(id) : `SKU ${text(id)}`.trim()
  if (type === 'data_quality') return '数据接入与质量'
  if (type === 'reports') return '报表与分析'
  if (type === 'ai_suggestions') return 'AI 建议'
  if (type === 'review_workflow') return '行动草稿与人工复核'
  if (type === 'rfq') return /^RFQ-/i.test(text(id)) ? text(id) : `RFQ ${text(id)}`.trim()
  if (type === 'grn') return /^GRN-/i.test(text(id)) ? text(id) : `GRN ${text(id)}`.trim()
  if (type === 'invoice') return /^INV/i.test(text(id)) ? text(id) : `Invoice ${text(id)}`.trim()
  if (type === 'match') return `三单匹配 ${text(id)}`.trim()
  if (type === 'pr') return /^PR-/i.test(text(id)) ? text(id) : `PR ${text(id)}`.trim()
  return /^PO-/i.test(text(id)) ? text(id) : `PO ${text(id)}`.trim()
}
function nav(label, type, id = '', reason = '') {
  return {
    label: text(label),
    moduleId: moduleFor(type),
    entityType: entityTypeFor(type),
    entityId: text(id),
    entityLabel: labelFor(type, id),
    returnTo: 'collaboration-drafts',
    source: 'collaborationNotificationDrafts',
    reason: text(reason, '查看通知草稿来源证据。'),
  }
}
function normalizeLink(link = {}) {
  return {
    label: text(link.label || link.entityLabel, '打开来源对象'),
    moduleId: text(link.moduleId, 'overview'),
    entityType: text(link.entityType, 'business_object'),
    entityId: text(link.entityId || link.id),
    entityLabel: text(link.entityLabel || link.label, '来源对象'),
    returnTo: 'collaboration-drafts',
    source: 'collaborationNotificationDrafts',
    reason: text(link.reason, '查看通知草稿来源证据。'),
  }
}
function normalizeLinks(items = []) {
  return uniqueBy(asArray(items).map(normalizeLink), (link) => `${link.moduleId}:${link.entityType}:${link.entityId}:${link.label}`).slice(0, 5)
}
function normalizeEvidence(items = [], fallback = '') {
  const rows = asArray(items).map((item) => {
    if (typeof item === 'string') return text(item)
    return text(item.summary || item.label || item.explanation || item.value || item.description)
  }).filter(Boolean)
  return (rows.length ? rows : [fallback || '当前工作区证据支持该草稿，仍需人工复核。']).slice(0, 5)
}
function limitation(label, description, affectedModules = []) {
  return { label: text(label), description: text(description, '需要人工结合业务证据复核。'), severity: 'warning', affectedModules: asArray(affectedModules).map((item) => text(item)).filter(Boolean) }
}
function cleanLimitations(items = [], fallback = '当前数据范围限制') {
  return asArray(items).map((item) => {
    if (typeof item === 'string') return limitation(item, item)
    return limitation(item?.label || fallback, item?.description || item?.consequence || item?.impactSummary, item?.affectedModules || item?.affectedMetrics || item?.missingData)
  }).slice(0, 4)
}
function draftNo(index) { return `CND-${String(index).padStart(4, '0')}` }
function channelPolicy(channelType, label, allowedUse, boundarySummary) {
  return {
    channelType,
    label,
    allowedUse: asArray(allowedUse).map((item) => text(item)),
    boundarySummary: text(boundarySummary),
    reviewRequired: true,
    previewOnly: true,
  }
}
function channelPolicies() {
  return [
    channelPolicy('internal_note', '内部协同备注', ['生成内部协同草稿', '供人工复核后使用'], '仅作为协同可见性，不形成正式业务处理。'),
    channelPolicy('supplier_message_draft', '供应商沟通草稿', ['生成供应商沟通草稿预览', '人工复核后再决定是否使用'], '仅为草稿预览，不外发，不改主数据。'),
    channelPolicy('finance_note', '财务复核说明', ['生成发票差异复核说明', '生成内部财务协同备注'], '不写财务凭证，不处理资金。'),
    channelPolicy('data_quality_note', '数据质量说明', ['生成数据补齐清单', '生成字段映射建议说明'], '不覆盖当前工作区数据，不进行自动处理。'),
    channelPolicy('receiving_note', '收货异常说明', ['生成收货异常说明'], '不写库存，不形成正式收货处理。'),
    channelPolicy('inventory_note', '库存复核说明', ['生成库存风险复核说明'], '不写库存，不锁定库存，不生成正式单据。'),
    channelPolicy('report_note', '报表洞察复核说明', ['生成报表洞察复核备注'], '不形成正式财务报表或审计报告。'),
  ]
}
function makeDraft(input = {}, index = 1) {
  const notificationType = input.notificationType || 'internal_followup'
  const channelType = input.channelType || 'internal_note'
  const audienceType = input.audienceType || 'manager_review'
  const typeLinks = notificationType === 'data_completion'
    ? [nav('打开数据接入与质量', 'data_quality', input.sourceObjectId || input.id)]
    : notificationType === 'report_insight_review'
      ? [nav('打开报表与分析', 'reports', input.sourceObjectId || input.id)]
      : []
  const links = normalizeLinks([
    ...typeLinks,
    ...(input.navigationLinks || []),
    nav('打开 AI 建议', 'ai_suggestions', input.relatedAiSuggestionId || input.sourceObjectId),
    nav('进入人工复核', 'review_workflow', input.relatedActionDraftId || input.sourceObjectId),
  ]).slice(0, 5)
  const limits = cleanLimitations(input.dataLimitations)
  const sourceObjectType = text(input.sourceObjectType || input.targetEntityType || 'business_object')
  const sourceObjectId = text(input.sourceObjectId || input.targetEntityId || input.id)
  const targetEntityType = text(input.targetEntityType || sourceObjectType)
  const targetEntityId = text(input.targetEntityId || sourceObjectId)
  const targetModule = text(input.targetModule || links[0]?.moduleId || moduleFor(targetEntityType))
  const evidence = normalizeEvidence(input.keyEvidence, input.subject)
  return {
    id: text(input.id, `collab-${index}`),
    draftNo: text(input.draftNo, draftNo(index)),
    title: text(input.title),
    notificationType,
    notificationTypeLabel: TYPE_LABELS[notificationType] || TYPE_LABELS.internal_followup,
    channelType,
    channelLabel: CHANNEL_LABELS[channelType] || CHANNEL_LABELS.internal_note,
    audienceType,
    audienceLabel: AUDIENCE_LABELS[audienceType] || AUDIENCE_LABELS.manager_review,
    recipientPreview: asArray(input.recipientPreview).length ? asArray(input.recipientPreview).map((item) => text(item)) : [AUDIENCE_LABELS[audienceType] || '经理复核'],
    sourceModule: text(input.sourceModule || links[0]?.moduleId || targetModule),
    sourceCategory: text(input.sourceCategory || notificationType),
    sourceObjectType,
    sourceObjectId,
    sourceObjectLabel: text(input.sourceObjectLabel || labelFor(sourceObjectType, sourceObjectId)),
    targetModule,
    targetEntityType,
    targetEntityId,
    targetEntityLabel: text(input.targetEntityLabel || labelFor(targetEntityType, targetEntityId)),
    priority: normalizePriority(input.priority),
    status: text(input.status, limits.length ? '需要补充信息' : '等待人工复核'),
    subject: text(input.subject || input.title),
    messagePreview: text(input.messagePreview || `${input.title}。请结合关键证据进行人工复核，确认后再进入后续业务处理。`),
    keyEvidence: evidence,
    businessImpact: text(input.businessImpact || '该事项会影响跨部门协同优先级。'),
    requestedResponse: text(input.requestedResponse || '请复核证据、补充必要说明，并确认是否作为内部留存。'),
    reviewChecklist: normalizeEvidence(input.reviewChecklist, '确认来源对象、关键证据和业务影响。'),
    missingInformation: normalizeEvidence(input.missingInformation, '如缺少字段或关系，请补充后再复核。'),
    navigationLinks: links,
    relatedActionDraftId: text(input.relatedActionDraftId),
    relatedAiSuggestionId: text(input.relatedAiSuggestionId),
    allowedActions: [
      { label: '预览草稿', previewOnly: true, reviewRequired: true },
      { label: '进入人工复核', previewOnly: true, reviewRequired: true },
      { label: '标记仅内部留存', previewOnly: true, reviewRequired: true },
      { label: '打开来源对象', previewOnly: true, reviewRequired: true },
      { label: '打开行动草稿', previewOnly: true, reviewRequired: true },
    ],
    boundaryLabels: uniqueBy([...(input.boundaryLabels || []), ...COMMON_BOUNDARIES, ...(input.extraBoundaries || [])], (item) => item).map((item) => text(item)).slice(0, 10),
    dataLimitations: limits,
    auditPreview: {
      generatedAtLabel: '当前工作区',
      sourceLabel: text(input.auditSource || input.sourceLabel || '协同通知草稿适配层'),
      reviewRequirement: '需人工复核',
      boundarySummary: '仅草稿预览，不形成正式业务处理。',
    },
    previewOnly: true,
    reviewRequired: true,
    requiresHumanReview: true,
  }
}
function fromAiSuggestion(item = {}, index = 1) {
  const category = item.category
  const type = category === 'supplier' ? 'supplier_communication' : category === 'finance' ? 'finance_review' : category === 'inventory' ? 'inventory_review' : category === 'data_quality' ? 'data_completion' : 'internal_followup'
  const channel = type === 'supplier_communication' ? 'supplier_message_draft' : type === 'finance_review' ? 'finance_note' : type === 'inventory_review' ? 'inventory_note' : type === 'data_completion' ? 'data_quality_note' : 'internal_note'
  const audience = type === 'supplier_communication' ? 'supplier_contact_preview' : type === 'finance_review' ? 'internal_finance' : type === 'inventory_review' ? 'internal_inventory' : type === 'data_completion' ? 'internal_data_owner' : 'internal_procurement'
  return makeDraft({
    id: `ai-${item.id}`,
    title: `${item.sourceObjectLabel} ${TYPE_LABELS[type]}`,
    notificationType: type,
    channelType: channel,
    audienceType: audience,
    recipientPreview: [AUDIENCE_LABELS[audience], '经理复核'],
    sourceModule: 'overview:ai',
    sourceCategory: `ai_${category}`,
    sourceObjectType: item.sourceObjectType,
    sourceObjectId: item.sourceObjectId,
    sourceObjectLabel: item.sourceObjectLabel,
    targetModule: item.navigationLinks?.[0]?.moduleId || item.sourceModule,
    targetEntityType: item.navigationLinks?.[0]?.entityType || item.sourceObjectType,
    targetEntityId: item.navigationLinks?.[0]?.entityId || item.sourceObjectId,
    targetEntityLabel: item.navigationLinks?.[0]?.entityLabel || item.sourceObjectLabel,
    priority: item.priority,
    subject: item.title,
    messagePreview: `${item.conclusion} ${item.suggestedAction}。请人工复核后使用该协同草稿。`,
    keyEvidence: item.keyEvidence,
    businessImpact: item.businessImpact,
    requestedResponse: type === 'supplier_communication' ? '请补充交期、报价或异常说明，由采购负责人复核后留存。' : '请复核证据并确认下一步内部协同安排。',
    reviewChecklist: ['确认来源对象', '确认关键证据', '确认是否需要补充信息'],
    missingInformation: item.dataLimitations?.length ? item.dataLimitations.map((entry) => entry.label) : ['暂无额外缺失信息'],
    navigationLinks: item.navigationLinks,
    relatedAiSuggestionId: item.id,
    dataLimitations: item.dataLimitations,
    extraBoundaries: type === 'finance_review' ? ['不写财务凭证', '不处理资金'] : type === 'inventory_review' ? ['不写库存'] : type === 'data_completion' ? ['不覆盖当前工作区数据'] : type === 'supplier_communication' ? ['不改主数据'] : [],
    auditSource: 'AI 建议',
  }, index)
}
function fromReviewDraft(item = {}, index = 1) {
  const category = item.sourceCategory || item.draftType
  const type = /supplier/i.test(category) ? 'supplier_communication' : /invoice|match|variance|finance/i.test(category) ? 'finance_review' : /receiving|grn/i.test(category) ? 'receiving_exception' : /inventory|replenishment/i.test(category) ? 'inventory_review' : /data|field/i.test(category) ? 'data_completion' : 'internal_followup'
  return makeDraft({
    id: `review-${item.id}`,
    title: `${item.title} 协同通知草稿`,
    notificationType: type,
    channelType: type === 'supplier_communication' ? 'supplier_message_draft' : type === 'finance_review' ? 'finance_note' : type === 'receiving_exception' ? 'receiving_note' : type === 'inventory_review' ? 'inventory_note' : type === 'data_completion' ? 'data_quality_note' : 'internal_note',
    audienceType: type === 'finance_review' ? 'internal_finance' : type === 'inventory_review' ? 'internal_inventory' : type === 'data_completion' ? 'internal_data_owner' : type === 'supplier_communication' ? 'supplier_contact_preview' : 'internal_procurement',
    sourceModule: 'review-actions',
    sourceCategory: category,
    sourceObjectType: item.sourceEntityType,
    sourceObjectId: item.sourceEntityId,
    sourceObjectLabel: item.sourceEntityLabel,
    targetModule: item.targetModule,
    targetEntityType: item.targetEntityType,
    targetEntityId: item.targetEntityId,
    targetEntityLabel: item.targetEntityLabel,
    priority: item.priority,
    subject: item.title,
    messagePreview: item.proposedDraftContent,
    keyEvidence: item.keyEvidence,
    businessImpact: item.businessImpact,
    requestedResponse: '请复核草稿内容、补充缺失信息，并确认是否仅内部留存。',
    reviewChecklist: item.reviewChecklist,
    missingInformation: item.missingInformation,
    navigationLinks: item.navigationLinks,
    relatedActionDraftId: item.id,
    dataLimitations: item.dataLimitations,
    extraBoundaries: item.boundaryLabels,
    auditSource: '行动草稿与人工复核',
  }, index)
}
function fromTowerItem(item = {}, index = 1) {
  const raw = `${item.category} ${item.title}`
  const type = /supplier|rfq/i.test(raw) ? 'supplier_communication' : /invoice|match|finance/i.test(raw) ? 'finance_review' : /receiving|grn/i.test(raw) ? 'receiving_exception' : /inventory|sku/i.test(raw) ? 'inventory_review' : /data/i.test(raw) ? 'data_completion' : 'internal_followup'
  return makeDraft({
    id: `tower-${item.id}`,
    title: `${item.businessObjectLabel || item.title} ${TYPE_LABELS[type]}`,
    notificationType: type,
    channelType: type === 'supplier_communication' ? 'supplier_message_draft' : type === 'finance_review' ? 'finance_note' : type === 'receiving_exception' ? 'receiving_note' : type === 'inventory_review' ? 'inventory_note' : type === 'data_completion' ? 'data_quality_note' : 'internal_note',
    audienceType: type === 'finance_review' ? 'internal_finance' : type === 'inventory_review' ? 'internal_inventory' : type === 'data_completion' ? 'internal_data_owner' : type === 'supplier_communication' ? 'supplier_contact_preview' : 'internal_procurement',
    sourceModule: 'overview',
    sourceCategory: item.category,
    sourceObjectType: item.businessObjectType || item.entityType,
    sourceObjectId: item.businessObjectId || item.entityId,
    sourceObjectLabel: item.businessObjectLabel,
    targetModule: item.moduleId,
    targetEntityType: item.entityType,
    targetEntityId: item.entityId,
    targetEntityLabel: item.businessObjectLabel,
    priority: item.priority,
    subject: item.title,
    messagePreview: `${item.reason || item.title} ${item.suggestedNextStep || '请安排人工复核。'}`,
    keyEvidence: item.keyEvidence,
    businessImpact: asArray(item.businessImpact).map((entry) => entry.explanation || entry.impact || entry),
    requestedResponse: '请确认该事项是否需要进入人工复核或仅内部留存。',
    reviewChecklist: ['确认业务对象', '确认影响范围', '确认后续复核负责人'],
    missingInformation: item.dataLimitations?.length ? item.dataLimitations.map((entry) => entry.label) : ['暂无额外缺失信息'],
    navigationLinks: item.navigationLinks,
    dataLimitations: item.dataLimitations,
    auditSource: '今日行动优先级',
  }, index)
}
function fromDataQuality(issue = {}, index = 1) {
  return makeDraft({
    id: `data-${issue.id}`,
    title: `${issue.businessObjectLabel || issue.title} 数据补齐通知草稿`,
    notificationType: 'data_completion',
    channelType: 'data_quality_note',
    audienceType: 'internal_data_owner',
    sourceModule: 'imports',
    sourceCategory: 'data_quality',
    sourceObjectType: issue.businessObjectType || 'data_quality',
    sourceObjectId: issue.businessObjectId || issue.id,
    sourceObjectLabel: issue.businessObjectLabel || issue.title,
    targetModule: 'imports',
    targetEntityType: 'data_quality_issue',
    targetEntityId: issue.id,
    targetEntityLabel: issue.title,
    priority: issue.severity,
    subject: issue.title,
    messagePreview: `${issue.explanation || issue.title}。请数据负责人补齐字段或关系，并由业务负责人复核。`,
    keyEvidence: [issue.fieldLabel, issue.explanation, issue.businessImpact].filter(Boolean),
    businessImpact: issue.businessImpact,
    requestedResponse: '请补齐缺失字段、确认受影响模块，并记录人工复核结果。',
    reviewChecklist: ['确认缺失字段', '确认影响模块', '确认补齐责任人'],
    missingInformation: [issue.fieldLabel || '待补齐字段', issue.issueType || '待确认问题类型'],
    navigationLinks: [nav('打开数据接入与质量', 'data_quality', issue.id), ...(issue.navigationLinks || [])],
    dataLimitations: issue.dataLimitations,
    extraBoundaries: ['不覆盖当前工作区数据'],
    auditSource: '数据接入与质量',
  }, index)
}
function fromReportInsight(insight = {}, index = 1) {
  return makeDraft({
    id: `report-${compact(insight.title)}`,
    title: `${insight.title} 复核通知草稿`,
    notificationType: 'report_insight_review',
    channelType: 'report_note',
    audienceType: 'manager_review',
    sourceModule: 'reports',
    sourceCategory: insight.insightType,
    sourceObjectType: 'reports',
    sourceObjectId: compact(insight.title),
    sourceObjectLabel: '报表与分析',
    targetModule: 'reports',
    targetEntityType: 'report_metric',
    targetEntityId: compact(insight.title),
    targetEntityLabel: insight.title,
    priority: insight.severity,
    subject: insight.title,
    messagePreview: `${insight.conclusion} ${insight.suggestedAction}`,
    keyEvidence: insight.keyEvidence,
    businessImpact: insight.businessImpact,
    requestedResponse: '请复核洞察结论、证据和数据限制，确认是否进入内部留存。',
    reviewChecklist: ['确认洞察结论', '确认关联证据', '确认数据限制'],
    missingInformation: insight.dataLimitations?.length ? insight.dataLimitations.map((entry) => entry.label) : ['暂无额外缺失信息'],
    navigationLinks: [nav('打开报表与分析', 'reports', compact(insight.title)), ...(insight.navigationLinks || [])],
    dataLimitations: insight.dataLimitations,
    extraBoundaries: ['不写财务凭证', '不处理资金'],
    auditSource: '报表与分析',
  }, index)
}
function fromReceivingPipeline(stage = {}, index = 1) {
  const link = normalizeLinks(stage.navigationLinks)[0]
  return makeDraft({
    id: `receiving-${compact(stage.stage || stage.label || 'grn')}`,
    title: 'GRN 收货异常通知草稿',
    notificationType: 'receiving_exception',
    channelType: 'receiving_note',
    audienceType: 'internal_procurement',
    sourceModule: 'reports',
    sourceCategory: 'receiving_pipeline',
    sourceObjectType: 'grn',
    sourceObjectId: link?.entityId || 'GRN',
    sourceObjectLabel: link?.entityLabel || 'GRN 收货证据',
    targetModule: link?.moduleId || 'procurement:receiving',
    targetEntityType: link?.entityType || 'receiving_doc',
    targetEntityId: link?.entityId || '',
    targetEntityLabel: link?.entityLabel || 'GRN 收货证据',
    priority: stage.riskCount ? 'high' : 'medium',
    subject: 'GRN 收货证据需复核',
    messagePreview: `${stage.topIssue || '收货证据需要复核'}。请仓库与采购负责人核对 GRN、PO 和异常原因。`,
    keyEvidence: [`GRN 阶段记录 ${number(stage.count)} 条`, `风险记录 ${number(stage.riskCount)} 条`, stage.topIssue].filter(Boolean),
    businessImpact: '收货证据不完整会影响三单匹配、库存可用性和后续财务协同。',
    requestedResponse: '请确认收货异常原因、补充必要证据，并记录人工复核结论。',
    reviewChecklist: ['确认 GRN 与 PO 关系', '确认异常原因', '确认是否影响库存与发票匹配'],
    missingInformation: stage.dataLimitations?.length ? stage.dataLimitations : ['待确认 GRN Line 与异常原因'],
    navigationLinks: stage.navigationLinks,
    dataLimitations: stage.dataLimitations,
    extraBoundaries: ['不写库存'],
    auditSource: '报表与分析',
  }, index)
}
function buildAudienceGroups(drafts = []) {
  return Object.entries(AUDIENCE_LABELS).map(([audienceType, label]) => {
    const rows = drafts.filter((draft) => draft.audienceType === audienceType)
    return {
      audienceType,
      label,
      draftCount: rows.length,
      highPriorityCount: rows.filter((draft) => draft.priority === 'high').length,
      dataLimitedCount: rows.filter((draft) => draft.dataLimitations.length).length,
      previewRecipients: uniqueBy(rows.flatMap((draft) => draft.recipientPreview), (item) => item).slice(0, 4),
    }
  }).filter((group) => group.draftCount > 0)
}
function buildSourceSummary(drafts = []) {
  const groups = new Map()
  for (const draft of drafts) {
    const key = draft.sourceModule || 'overview'
    if (!groups.has(key)) groups.set(key, { sourceModule: key, sourceLabel: sourceLabel(key), draftCount: 0, highPriorityCount: 0, dataLimitedCount: 0, navigationLinks: [] })
    const group = groups.get(key)
    group.draftCount += 1
    if (draft.priority === 'high') group.highPriorityCount += 1
    if (draft.dataLimitations.length) group.dataLimitedCount += 1
    group.navigationLinks.push(...draft.navigationLinks.slice(0, 1))
  }
  return [...groups.values()].map((group) => ({ ...group, navigationLinks: normalizeLinks(group.navigationLinks).slice(0, 3) }))
}
function sourceLabel(moduleId = '') {
  if (moduleId === 'overview:ai') return 'AI 建议'
  if (moduleId === 'review-actions') return '行动草稿与人工复核'
  if (moduleId === 'overview') return '今日行动'
  if (moduleId === 'imports') return '数据接入与质量'
  if (moduleId === 'reports') return '报表与分析'
  if (/procurement/.test(moduleId)) return '采购管理'
  if (/inventory/.test(moduleId)) return '库存管理'
  if (/srm/.test(moduleId)) return '供应商管理'
  return '当前工作区'
}
function buildSummary(drafts = []) {
  return {
    totalDraftCount: drafts.length,
    internalDraftCount: drafts.filter((draft) => draft.notificationType === 'internal_followup').length,
    supplierDraftCount: drafts.filter((draft) => draft.notificationType === 'supplier_communication').length,
    financeDraftCount: drafts.filter((draft) => ['finance_review', 'invoice_variance_review'].includes(draft.notificationType)).length,
    dataQualityDraftCount: drafts.filter((draft) => draft.notificationType === 'data_completion').length,
    receivingDraftCount: drafts.filter((draft) => draft.notificationType === 'receiving_exception').length,
    inventoryDraftCount: drafts.filter((draft) => draft.notificationType === 'inventory_review').length,
    reportReviewDraftCount: drafts.filter((draft) => draft.notificationType === 'report_insight_review').length,
    highPriorityCount: drafts.filter((draft) => draft.priority === 'high').length,
    dataLimitedCount: drafts.filter((draft) => draft.dataLimitations.length).length,
    readyForReviewCount: drafts.filter((draft) => draft.status === '等待人工复核').length,
    overallStatusLabel: drafts.some((draft) => draft.priority === 'high') ? '需优先复核' : '等待复核',
  }
}

export function buildCollaborationNotificationDraftsV2(db = {}) {
  const ai = buildAiSuggestionsWorkbenchV2(db) || {}
  const review = buildReviewFirstActionWorkflowV2(db) || {}
  const tower = buildOperationsControlTowerV2(db) || {}
  const data = buildDataAccessQualityV2(db) || {}
  const reports = buildReportsAnalyticsV2(db) || {}
  const rows = [
    ...asArray(reports.reportInsights).slice(0, 2).map((item, index) => fromReportInsight(item, index + 1)),
    ...asArray(reports.p2pPipeline).filter((stage) => stage.stage === 'GRN').slice(0, 1).map((item, index) => fromReceivingPipeline(item, index + 11)),
    ...asArray(ai.suggestions).slice(0, 7).map((item, index) => fromAiSuggestion(item, index + 1)),
    ...asArray(review.drafts).slice(0, 7).map((item, index) => fromReviewDraft(item, index + 21)),
    ...asArray(tower.items).slice(0, 6).map((item, index) => fromTowerItem(item, index + 41)),
    ...asArray(data.qualityIssues).slice(0, 4).map((item, index) => fromDataQuality(item, index + 61)),
    ...asArray(reports.reportInsights).slice(2, 4).map((item, index) => fromReportInsight(item, index + 81)),
  ]
  const preferredTypes = ['internal_followup', 'supplier_communication', 'finance_review', 'data_completion', 'receiving_exception', 'inventory_review', 'report_insight_review']
  const seeded = []
  for (const type of preferredTypes) {
    const row = rows.find((draft) => draft.notificationType === type)
    if (row) seeded.push(row)
  }
  const drafts = uniqueBy([...seeded, ...rows], (draft) => draft.id)
    .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority) || a.draftNo.localeCompare(b.draftNo))
    .slice(0, 20)
    .map((draft, index) => ({ ...draft, draftNo: draftNo(index + 1) }))
  const dataLimitations = [
    ...cleanLimitations(ai.dataLimitations),
    ...cleanLimitations(review.dataLimitations),
    ...cleanLimitations(tower.limitations),
    ...cleanLimitations(data.dataLimitations),
    ...cleanLimitations(reports.dataLimitations),
  ].slice(0, 10)
  return {
    summary: buildSummary(drafts),
    drafts,
    channelPolicies: channelPolicies(),
    audienceGroups: buildAudienceGroups(drafts),
    sourceSummary: buildSourceSummary(drafts),
    dataLimitations: dataLimitations.length ? dataLimitations : [limitation('当前数据范围限制', '当前工作区没有足够记录生成完整协同通知草稿。')],
    generatedAt: GENERATED_AT,
    dataScopeLabel: '当前工作区数据',
  }
}
