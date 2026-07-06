import { buildAiSuggestionsWorkbenchV2 } from './ai-suggestions-workbench-v2.mjs'
import { buildCollaborationNotificationDraftsV2 } from './collaboration-notification-drafts-v2.mjs'
import { buildDataAccessQualityV2 } from './data-access-quality-v2.mjs'
import { buildOperationsControlTowerV2 } from './operations-control-tower-v2.mjs'
import { buildReportsAnalyticsV2 } from './reports-analytics-v2.mjs'
import { buildReviewFirstActionWorkflowV2 } from './review-first-action-workflow-v2.mjs'

export const FORBIDDEN_WORKSPACE_SETUP_ACTION_PATTERN = /自动批准|自动下单|正式创建\s*PO|下发\s*PO|发送\s*PO|发布\s*RFQ|邀请供应商|发送邮件|发送|推送|已发送|提交收货|Receive Submit|Submit Receipt|库存过账|Post Invoice|Approve Invoice|Mark as Paid|Payment execution|Export to Accounting|付款|会计过账|修改供应商主数据|更新银行账户|发布风险评级|自动黑名单|自动暂停供应商|自动修复|自动提交导入|自动覆盖数据|自动写入数据库|批量删除|清空数据|sent|delivered|dispatched|webhook|portal invite|保存配置|立即生效|自动应用|写入配置|修改权限|创建租户|切换租户/i
export const FORBIDDEN_WORKSPACE_SETUP_TECHNICAL_PATTERN = /JSON|dry-run|tenantId|userId|datasetId|writesDb|writesFiles|DB|database|tool_result|provider|fallback|deterministic|mock|fake|demo|UAT|sample data|demo data|response_card|entityType|documentType|raw enum|payload|webhook|API key/i

const GENERATED_AT = '2026-05-25T10:40:00.000Z'
const BOUNDARIES = ['配置草稿预览', '人工复核', '不形成正式业务处理', '不外发', '不写库存', '不写财务凭证', '不处理资金', '不改主数据', '不覆盖当前工作区数据']

function asArray(value) { return Array.isArray(value) ? value : [] }
function text(value, fallback = '') {
  const raw = String(value ?? '').trim() || fallback
  return sanitize(raw)
}
function number(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
function sanitize(value = '') {
  return String(value ?? '')
    .replace(/自动批准|自动下单|正式创建\s*PO|下发\s*PO|发送\s*PO|发布\s*RFQ|邀请供应商|发送邮件|发送|推送|已发送|提交收货/ig, '形成正式业务处理')
    .replace(/Receive Submit|Submit Receipt|库存过账|Post Invoice|Approve Invoice|Mark as Paid|Payment execution|Export to Accounting|会计过账|付款/ig, '正式资金或凭证处理')
    .replace(/修改供应商主数据|更新银行账户|发布风险评级|自动黑名单|自动暂停供应商/ig, '供应商资料正式变更')
    .replace(/自动修复|自动提交导入|自动覆盖数据|自动写入数据库|批量删除|清空数据|保存配置|立即生效|自动应用|写入配置|修改权限|创建租户|切换租户/ig, '配置正式变更')
    .replace(/sent|delivered|dispatched|webhook|portal invite/ig, '外部触达动作')
    .replace(/JSON|dry-run|tenantId|userId|datasetId|writesDb|writesFiles|tool_result|provider|fallback|deterministic|mock|fake|demo|UAT|sample data|demo data|response_card|entityType|documentType|raw enum|payload|database|API key/ig, '当前工作区数据')
    .replace(/\bDB\b/g, '当前工作区数据')
}
function compact(value = '') {
  return text(value).toLowerCase().replace(/[^\w\u4e00-\u9fa5-]+/g, '')
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
function nav(label, moduleId, entityType = 'workspace_config', entityId = '') {
  return { label: text(label), moduleId, entityType, entityId: text(entityId), entityLabel: text(label), returnTo: 'settings', source: 'workspaceSetupConfig', reason: '从工作区配置查看来源。' }
}
function cleanLimitation(item, fallbackLabel = '当前配置可见性限制') {
  if (typeof item === 'string') return { label: text(item, fallbackLabel), description: text(item), severity: 'warning' }
  return {
    label: text(item?.label, fallbackLabel),
    description: text(item?.description || item?.consequence || item?.impactSummary, '需要结合当前业务范围人工复核。'),
    severity: text(item?.severity, 'warning'),
    affectedModules: asArray(item?.affectedModules || item?.affectedMetrics || item?.missingData).map((value) => text(value)).filter(Boolean),
  }
}
function moduleSetting(input) {
  return {
    id: input.id,
    moduleLabel: input.moduleLabel,
    moduleGroup: input.moduleGroup,
    statusLabel: '已启用',
    operatingMode: input.operatingMode || '当前工作区可见',
    reviewModeLabel: input.reviewModeLabel || '复核优先',
    visibleEntryLabel: input.visibleEntryLabel || input.moduleLabel,
    keyObjects: input.keyObjects || [],
    connectedInsights: input.connectedInsights || [],
    configurationNotes: input.configurationNotes || ['当前为配置状态展示，配置变更仅生成复核草稿。'],
    navigationLinks: input.navigationLinks || [nav(`进入${input.moduleLabel}`, input.id)],
    dataLimitations: input.dataLimitations || [],
  }
}
function buildModuleSettings({ ai, review, collaboration, data, reports, tower }) {
  return [
    moduleSetting({ id: 'overview', moduleLabel: '今日工作台', moduleGroup: '运营', keyObjects: ['今日行动', '最近单据'], connectedInsights: [`今日优先事项 ${number(tower.summary?.totalOpenItems)} 项`], navigationLinks: [nav('进入今日行动', 'overview')] }),
    moduleSetting({ id: 'overview:ai', moduleLabel: 'AI 建议', moduleGroup: '运营', keyObjects: ['建议', '证据', '草稿预览'], connectedInsights: [`AI 建议 ${number(ai.summary?.totalSuggestionCount)} 条`], navigationLinks: [nav('进入 AI 建议', 'overview:ai')] }),
    moduleSetting({ id: 'procurement', moduleLabel: '采购管理', moduleGroup: '供应链', keyObjects: ['PR', 'RFQ', 'PO', 'GRN', 'Invoice'], connectedInsights: ['采购到货、报价和发票证据'], navigationLinks: [nav('进入采购管理', 'procurement')] }),
    moduleSetting({ id: 'inventory', moduleLabel: '库存管理', moduleGroup: '供应链', keyObjects: ['SKU', '库存风险', '补货证据'], connectedInsights: [`库存复核草稿 ${number(collaboration.summary?.inventoryDraftCount)} 条`], navigationLinks: [nav('进入库存管理', 'inventory')] }),
    moduleSetting({ id: 'srm', moduleLabel: '供应商管理', moduleGroup: '供应链', keyObjects: ['供应商档案', '供应风险', '报价证据'], connectedInsights: [`供应商沟通草稿 ${number(collaboration.summary?.supplierDraftCount)} 条`], navigationLinks: [nav('进入供应商管理', 'srm')] }),
    moduleSetting({ id: 'finance', moduleLabel: '财务协同', moduleGroup: '供应链', keyObjects: ['Invoice', '三单匹配', '差异说明'], connectedInsights: [`财务复核草稿 ${number(collaboration.summary?.financeDraftCount)} 条`], navigationLinks: [nav('进入财务协同', 'finance')] }),
    moduleSetting({ id: 'reports', moduleLabel: '报表与分析', moduleGroup: '数据', keyObjects: ['报表洞察', 'P2P 链路', '数据限制'], connectedInsights: [`报表洞察 ${asArray(reports.reportInsights).length} 条`], navigationLinks: [nav('进入报表与分析', 'reports')] }),
    moduleSetting({ id: 'imports', moduleLabel: '数据接入与质量', moduleGroup: '数据', keyObjects: ['字段映射', '质量事项', '数据补齐'], connectedInsights: [`数据质量事项 ${number(data.summary?.criticalIssueCount) + number(data.summary?.warningIssueCount)} 项`], navigationLinks: [nav('进入数据接入与质量', 'imports')] }),
    moduleSetting({ id: 'review-actions', moduleLabel: '行动草稿与人工复核', moduleGroup: '供应链', keyObjects: ['行动草稿', '复核状态', '生命周期'], connectedInsights: [`复核草稿 ${number(review.summary?.totalDraftCount)} 条`], navigationLinks: [nav('进入行动草稿与人工复核', 'review-actions')] }),
    moduleSetting({ id: 'collaboration-drafts', moduleLabel: '协同通知草稿', moduleGroup: '供应链', keyObjects: ['通知草稿', '协同对象', '消息草稿预览'], connectedInsights: [`协同通知草稿 ${number(collaboration.summary?.totalDraftCount)} 条`], navigationLinks: [nav('进入协同通知草稿', 'collaboration-drafts')] }),
    moduleSetting({ id: 'exception-cases', moduleLabel: '异常处理工单', moduleGroup: '供应链', keyObjects: ['异常工单', '复核队列'], connectedInsights: ['保留独立异常处理入口'], navigationLinks: [nav('进入异常处理工单', 'exception-cases')] }),
    moduleSetting({ id: 'master-data', moduleLabel: '基础资料', moduleGroup: '数据', keyObjects: ['物料', '供应商', '仓库', '条款'], connectedInsights: ['基础资料影响采购、库存和供应商证据'], navigationLinks: [nav('进入基础资料', 'master-data')] }),
  ]
}
function buildReviewPolicies(review) {
  const lifecycle = review.lifecyclePolicy || {}
  return asArray(lifecycle.boundaryLabels || BOUNDARIES).slice(0, 8).map((label, index) => ({
    id: `review-policy-${index + 1}`,
    policyLabel: text(label),
    appliesTo: ['行动草稿', '协同通知草稿', '配置复核草稿'].slice(0, index % 3 + 1),
    reviewRequirement: '需人工复核',
    allowedUse: '生成草稿预览并整理证据。',
    boundaryLabels: BOUNDARIES,
    sourceModule: '行动草稿与人工复核',
    navigationLinks: [nav('进入行动草稿与人工复核', 'review-actions')],
  }))
}
function buildNumberingRules() {
  return [
    ['purchase_request', 'PR', 'PR', 'PR-2026-0001'],
    ['rfq', 'RFQ', 'RFQ', 'RFQ-26-0001'],
    ['purchase_order', 'PO', 'PO', 'PO-2026-0001'],
    ['receiving_doc', 'GRN', 'GRN', 'GRN-202605-0001'],
    ['supplier_invoice', 'Invoice', 'INV', 'INV-2026-0001'],
    ['action_draft', 'Action Draft', 'ACT', 'ACT-0001'],
    ['collaboration_draft', 'Collaboration Draft', 'CND', 'CND-0001'],
    ['exception_case', 'Exception Case', 'EXC', 'EXC-0001'],
    ['supplier', 'Supplier', 'SUP', 'SUP-0001'],
    ['sku', 'SKU', 'SKU', 'SKU-00001'],
  ].map(([objectType, objectLabel, prefix, example]) => ({
    objectType,
    objectLabel,
    prefix,
    example,
    statusLabel: '当前规则可见',
    reviewRequired: true,
    sourceModule: '工作区配置',
  }))
}
function buildDataQualitySettings(data) {
  return [
    {
      id: 'field-mapping-coverage',
      settingLabel: '字段映射覆盖',
      sourceModule: '数据接入与质量',
      mappedFieldsCount: number(data.summary?.mappedFieldCount),
      issueCount: number(data.summary?.unmappedFieldCount),
      affectedModules: ['采购管理', '报表与分析', 'AI 建议'],
      suggestedReview: '复核未映射字段与受影响模块。',
      navigationLinks: [nav('进入数据接入与质量', 'imports')],
      dataLimitations: asArray(data.dataLimitations).map(cleanLimitation),
    },
    {
      id: 'quality-issues',
      settingLabel: '数据质量事项',
      sourceModule: '数据接入与质量',
      mappedFieldsCount: number(data.summary?.mappedFieldCount),
      issueCount: number(data.summary?.criticalIssueCount) + number(data.summary?.warningIssueCount),
      affectedModules: ['今日工作台', '行动草稿与人工复核', '报表与分析'],
      suggestedReview: '复核质量事项对建议和报表的影响。',
      navigationLinks: [nav('查看质量事项', 'imports')],
      dataLimitations: asArray(data.dataLimitations).map(cleanLimitation),
    },
  ]
}
function buildAiBoundaries(ai) {
  return [
    ['ai-explain', '解释业务证据', '解释、证据整理、优先级说明', '不形成正式业务处理'],
    ['ai-draft', '生成草稿预览', '生成行动或协同草稿预览', '需人工复核后使用'],
    ['ai-review', '辅助人工复核', '汇总关键证据和数据限制', '不写库存、不写财务凭证'],
    ['ai-navigation', '证据跳转辅助', '提供来源对象和复核入口', '不改主数据、不处理资金'],
  ].map(([id, boundaryLabel, allowedUse, restrictedUseBusinessWording]) => ({
    id,
    boundaryLabel,
    allowedUse,
    restrictedUseBusinessWording,
    reviewRequired: true,
    previewOnly: true,
    relatedModule: `AI 建议 ${number(ai.summary?.totalSuggestionCount)} 条`,
    navigationLinks: [nav('进入 AI 建议', 'overview:ai')],
  }))
}
function buildCollaborationPolicies(collaboration) {
  return asArray(collaboration.channelPolicies).map((policy) => ({
    channelType: policy.channelType,
    policyLabel: policy.label,
    allowedUse: policy.allowedUse,
    boundarySummary: policy.boundarySummary,
    reviewRequired: true,
    previewOnly: true,
    navigationLinks: [nav('进入协同通知草稿', 'collaboration-drafts')],
  }))
}
function setupDraft(input, index) {
  return {
    id: `setup-draft-${index}`,
    title: input.title,
    draftType: 'workspace_config_review',
    sourceModule: input.sourceModule,
    targetModule: input.targetModule,
    status: '草稿预览',
    priority: input.priority || 'medium',
    conclusion: input.conclusion,
    proposedConfigPreview: input.proposedConfigPreview,
    keyEvidence: input.keyEvidence,
    reviewChecklist: input.reviewChecklist || ['确认配置范围', '确认业务影响', '确认是否仅内部留存'],
    boundaryLabels: BOUNDARIES,
    navigationLinks: input.navigationLinks,
    dataLimitations: input.dataLimitations || [],
    previewOnly: true,
    reviewRequired: true,
    requiresHumanReview: true,
  }
}
function buildSetupReviewDrafts({ data, collaboration, ai, review }) {
  return [
    setupDraft({
      title: '数据质量设置复核草稿',
      sourceModule: '数据接入与质量',
      targetModule: '工作区配置',
      priority: data.summary?.criticalIssueCount ? 'high' : 'medium',
      conclusion: '数据质量事项会影响 AI 建议和报表结论。',
      proposedConfigPreview: '保留当前质量检查可见性，并生成数据负责人复核清单。',
      keyEvidence: [`质量事项 ${number(data.summary?.criticalIssueCount) + number(data.summary?.warningIssueCount)} 项`, `字段映射 ${number(data.summary?.mappedFieldCount)} 项`],
      navigationLinks: [nav('进入数据接入与质量', 'imports'), nav('进入行动草稿与人工复核', 'review-actions')],
      dataLimitations: asArray(data.dataLimitations).map(cleanLimitation),
    }, 1),
    setupDraft({
      title: '协同通知草稿策略复核草稿',
      sourceModule: '协同通知草稿',
      targetModule: '工作区配置',
      priority: collaboration.summary?.highPriorityCount ? 'high' : 'medium',
      conclusion: '协同草稿策略已覆盖内部、供应商、财务、数据、收货、库存和报表复核。',
      proposedConfigPreview: '维持草稿预览与人工复核边界，供管理员后续确认。',
      keyEvidence: [`协同草稿 ${number(collaboration.summary?.totalDraftCount)} 条`, `策略 ${asArray(collaboration.channelPolicies).length} 条`],
      navigationLinks: [nav('进入协同通知草稿', 'collaboration-drafts'), nav('进入行动草稿与人工复核', 'review-actions')],
    }, 2),
    setupDraft({
      title: 'AI 辅助边界复核草稿',
      sourceModule: 'AI 建议',
      targetModule: '工作区配置',
      priority: ai.summary?.highPriorityCount ? 'high' : 'medium',
      conclusion: 'AI 辅助仅用于解释、证据整理和草稿预览。',
      proposedConfigPreview: '保留人工复核和草稿预览边界，不形成正式业务处理。',
      keyEvidence: [`AI 建议 ${number(ai.summary?.totalSuggestionCount)} 条`, `待复核草稿 ${number(review.summary?.totalDraftCount)} 条`],
      navigationLinks: [nav('进入 AI 建议', 'overview:ai'), nav('进入行动草稿与人工复核', 'review-actions')],
      dataLimitations: asArray(ai.dataLimitations).map(cleanLimitation),
    }, 3),
  ]
}
function sourceSummary(moduleSettings) {
  return moduleSettings.map((module) => ({
    sourceModule: module.id,
    sourceLabel: module.moduleLabel,
    statusLabel: module.statusLabel,
    insightCount: module.connectedInsights.length,
    navigationLinks: module.navigationLinks.slice(0, 2),
  }))
}

export function buildWorkspaceSetupConfigV2(db = {}) {
  const ai = buildAiSuggestionsWorkbenchV2(db) || {}
  const review = buildReviewFirstActionWorkflowV2(db) || {}
  const collaboration = buildCollaborationNotificationDraftsV2(db) || {}
  const data = buildDataAccessQualityV2(db) || {}
  const reports = buildReportsAnalyticsV2(db) || {}
  const tower = buildOperationsControlTowerV2(db) || {}
  const moduleSettings = buildModuleSettings({ ai, review, collaboration, data, reports, tower })
  const reviewPolicies = buildReviewPolicies(review)
  const numberingRules = buildNumberingRules()
  const dataQualitySettings = buildDataQualitySettings(data)
  const aiAssistanceBoundaries = buildAiBoundaries(ai)
  const collaborationDraftPolicies = buildCollaborationPolicies(collaboration)
  const setupReviewDrafts = buildSetupReviewDrafts({ data, collaboration, ai, review })
  const dataLimitations = uniqueBy([
    ...asArray(data.dataLimitations).map(cleanLimitation),
    ...asArray(ai.dataLimitations).map(cleanLimitation),
    ...asArray(collaboration.dataLimitations).map(cleanLimitation),
    ...asArray(reports.dataLimitations).map(cleanLimitation),
  ], (item) => item.label).slice(0, 10)
  return {
    summary: {
      enabledModuleCount: moduleSettings.length,
      reviewFirstModuleCount: moduleSettings.filter((module) => /复核/.test(module.reviewModeLabel)).length,
      draftOnlyPolicyCount: reviewPolicies.length,
      dataQualityIssueCount: dataQualitySettings.reduce((sum, item) => sum + item.issueCount, 0),
      aiBoundaryCount: aiAssistanceBoundaries.length,
      collaborationPolicyCount: collaborationDraftPolicies.length,
      configDraftCount: setupReviewDrafts.length,
      setupReadinessLabel: dataLimitations.length ? '需配置复核' : '配置可见',
    },
    workspaceProfile: {
      workspaceName: text(db.companyName || db.workspaceName || '新辰智能制造'),
      businessScopeLabel: '进销存与供应链协同',
      operatingModeLabel: '复核优先 · 草稿预览',
      dataScopeLabel: '当前工作区数据',
      setupStatusLabel: '配置状态可见',
    },
    moduleSettings,
    reviewPolicies,
    numberingRules,
    dataQualitySettings,
    aiAssistanceBoundaries,
    collaborationDraftPolicies,
    setupReviewDrafts,
    sourceSummary: sourceSummary(moduleSettings),
    dataLimitations: dataLimitations.length ? dataLimitations : [cleanLimitation('当前配置可见性限制', '当前业务范围下仅展示配置状态。')],
    generatedAt: GENERATED_AT,
  }
}
