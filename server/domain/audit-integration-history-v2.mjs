import { buildAiSuggestionsWorkbenchV2 } from './ai-suggestions-workbench-v2.mjs'
import { buildCollaborationNotificationDraftsV2 } from './collaboration-notification-drafts-v2.mjs'
import { buildDataAccessQualityV2 } from './data-access-quality-v2.mjs'
import { buildOperationsControlTowerV2 } from './operations-control-tower-v2.mjs'
import { buildReportsAnalyticsV2 } from './reports-analytics-v2.mjs'
import { buildReviewFirstActionWorkflowV2 } from './review-first-action-workflow-v2.mjs'
import { buildUserRolePermissionVisibilityV2 } from './user-role-permission-visibility-v2.mjs'
import { buildWorkspaceBoundaryVisibilityV2 } from './workspace-boundary-visibility-v2.mjs'
import { buildWorkspaceSetupConfigV2 } from './workspace-setup-config-v2.mjs'

export const FORBIDDEN_AUDIT_HISTORY_ACTION_PATTERN = /自动批准|自动下单|正式创建\s*PO|下发\s*PO|发送\s*PO|发布\s*RFQ|邀请供应商|发送邮件|发送|推送|已发送|提交收货|Receive Submit|Submit Receipt|库存过账|Post Invoice|Approve Invoice|Mark as Paid|Payment execution|Export to Accounting|付款|会计过账|修改供应商主数据|更新银行账户|发布风险评级|自动黑名单|自动暂停供应商|自动修复|自动提交导入|自动覆盖数据|自动写入数据库|批量删除|清空数据|sent|delivered|dispatched|webhook|portal invite|保存配置|保存权限|保存边界|保存历史|修改权限|修改历史|删除历史|立即生效|自动应用|分配角色|创建用户|删除用户|禁用用户|创建租户|切换租户|合并租户|迁移数据|同步数据|跨租户查询|写入配置|写入日志|推送日志|导出审计报告|生成正式审计报告|发送审计报告/i
export const FORBIDDEN_AUDIT_HISTORY_TECHNICAL_PATTERN = /JSON|dry-run|tenantId|userId|datasetId|writesDb|writesFiles|DB|database|schema|environment|tool_result|provider|fallback|deterministic|mock|fake|demo|UAT|sample data|demo data|response_card|entityType|documentType|raw enum|payload|webhook|API key|Coupa|RBAC/i

const GENERATED_AT = '2026-05-25T12:10:00.000Z'
const READ_ONLY_BOUNDARIES = ['只读历史', '草稿预览', '人工复核', '不改变业务对象状态', '不形成正式业务处理', '不外发', '不写库存', '不写财务凭证', '不处理资金', '不改主数据', '不覆盖当前工作区数据', '仅内部留存']
const CATEGORY_LABELS = {
  ai_suggestion: 'AI 建议历史',
  action_draft: '行动草稿历史',
  collaboration_draft: '协同草稿历史',
  data_quality: '数据质量历史',
  reports_insight: '报表洞察历史',
  setup_config: '工作区配置历史',
  role_permission: '角色权限历史',
  workspace_boundary: '工作区边界历史',
  procurement_object: '采购对象历史',
  supplier_object: '供应商对象历史',
  inventory_object: '库存对象历史',
  finance_review: '财务复核历史',
}

function asArray(value) { return Array.isArray(value) ? value : [] }
function number(value, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback }
function sanitize(value = '') {
  return String(value ?? '')
    .replace(/自动批准|自动下单|正式创建\s*PO|下发\s*PO|发送\s*PO|正式发布\s*RFQ|发布\s*RFQ|邀请供应商|发送邮件|发送|推送|已发送|提交收货/ig, '正式业务处理')
    .replace(/正式发布|发布/ig, '正式处理')
    .replace(/Receive Submit|Submit Receipt|库存过账|Post Invoice|Approve Invoice|Mark as Paid|Payment execution|Export to Accounting|会计过账|付款/ig, '正式资金或凭证处理')
    .replace(/修改供应商主数据|更新银行账户|发布风险评级|自动黑名单|自动暂停供应商/ig, '供应商资料正式变更')
    .replace(/自动修复|自动提交导入|自动覆盖数据|自动写入数据库|批量删除|清空数据|保存配置|保存权限|保存边界|保存历史|修改权限|修改历史|删除历史|立即生效|自动应用|分配角色|创建用户|删除用户|禁用用户|创建租户|切换租户|合并租户|迁移数据|同步数据|跨租户查询|写入配置|写入日志|推送日志|导出审计报告|生成正式审计报告|发送审计报告/ig, '正式变更')
    .replace(/sent|delivered|dispatched|webhook|portal invite/ig, '外部触达动作')
    .replace(/JSON|dry-run|tenantId|userId|datasetId|writesDb|writesFiles|tool_result|provider|fallback|deterministic|mock|fake|demo|UAT|sample data|demo data|response_card|entityType|documentType|raw enum|payload|database|schema|environment|API key|Coupa|RBAC/ig, '当前工作区数据')
    .replace(/\bDB\b/g, '当前工作区数据')
}
function text(value, fallback = '') { return sanitize(String(value ?? '').trim() || fallback) }
function cleanList(items = [], fallback = []) {
  const values = asArray(items).map((item) => text(typeof item === 'string' ? item : item?.label || item?.title || item?.summary || item?.description)).filter(Boolean)
  return values.length ? values : fallback
}
function uniqueBy(items = [], keyOf = (item) => item.id || item.label || item.title) {
  const seen = new Set()
  const out = []
  for (const item of items.filter(Boolean)) {
    const key = keyOf(item)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}
function compact(value = '') { return text(value).toLowerCase().replace(/[^\w\u4e00-\u9fa5-]+/g, '') || 'item' }
function priorityRank(value = '') {
  if (/高|high|P0|risk|阻断/i.test(text(value))) return 3
  if (/中|medium|P1|warning|需复核/i.test(text(value))) return 2
  return 1
}
function normalizePriority(value = '') {
  const rank = priorityRank(value)
  if (rank >= 3) return '高'
  if (rank >= 2) return '中'
  return '低'
}
function cleanLimitation(item, fallbackLabel = '当前数据范围限制') {
  if (typeof item === 'string') return { label: text(item, fallbackLabel), description: text(item), severity: 'warning' }
  return {
    label: text(item?.label, fallbackLabel),
    description: text(item?.description || item?.consequence || item?.impactSummary, '需要业务负责人结合来源证据复核。'),
    severity: text(item?.severity, 'warning'),
    affectedModules: cleanList(item?.affectedModules || item?.affectedMetrics || item?.missingData),
  }
}
function moduleLabel(moduleId = '') {
  const id = text(moduleId)
  if (id === 'overview') return '今日行动'
  if (id === 'overview:ai') return 'AI 建议'
  if (/review-actions/.test(id)) return '行动草稿与人工复核'
  if (/collaboration-drafts/.test(id)) return '协同通知草稿'
  if (/imports/.test(id)) return '数据接入与质量'
  if (/reports/.test(id)) return '报表与分析'
  if (/settings:roles/.test(id)) return '角色权限可见性'
  if (/settings:boundaries/.test(id)) return '工作区边界'
  if (/settings/.test(id)) return '工作区配置'
  if (/procurement/.test(id)) return '采购管理'
  if (/inventory/.test(id)) return '库存管理'
  if (/srm/.test(id)) return '供应商管理'
  if (/finance/.test(id)) return '财务协同'
  if (/master-data/.test(id)) return '基础资料'
  if (/exception-cases/.test(id)) return '异常处理工单'
  return id || '当前工作区'
}
function historyNav(label, moduleId, entityType = 'business_object', entityId = '', entityLabel = '') {
  return {
    label: text(label),
    moduleId: text(moduleId, 'overview'),
    entityType: text(entityType, 'business_object'),
    entityId: text(entityId),
    entityLabel: text(entityLabel || label),
    returnTo: 'audit-history',
    source: 'auditIntegrationHistory',
    reason: '从业务审计与历史回看来源。',
    returnContext: {
      sourceModule: 'audit-history',
      sourceRoute: 'audit-history',
      sourceLabel: '业务审计与历史',
      returnLabel: '返回业务审计与历史',
      originIntent: 'auditIntegrationHistory',
    },
  }
}
function cleanLink(link = {}, fallbackLabel = '打开来源') {
  return historyNav(
    link.label || link.entityLabel || fallbackLabel,
    link.moduleId || 'overview',
    link.entityType || 'business_object',
    link.entityId || link.id || '',
    link.entityLabel || link.label || fallbackLabel,
  )
}
function navigationLinks(links = [], fallback = historyNav('返回来源模块', 'overview')) {
  return uniqueBy(asArray(links).map((link) => cleanLink(link)), (link) => `${link.moduleId}:${link.entityType}:${link.entityId}:${link.label}`).concat(fallback).slice(0, 5)
}
function occurredAt(index) {
  const labels = ['今天 09:18', '今天 09:02', '今天 08:47', '今天 08:31', '昨天 17:20', '昨天 15:40', '本周一 11:10', '本周一 10:25', '上周五 16:05', '上周五 14:30']
  return labels[index % labels.length]
}
function makeTimeline(input, index) {
  const limits = asArray(input.dataLimitations).map((item) => cleanLimitation(item))
  return {
    id: text(input.id, `timeline-${index + 1}`),
    occurredAtLabel: text(input.occurredAtLabel, occurredAt(index)),
    category: input.category,
    categoryLabel: CATEGORY_LABELS[input.category] || '业务历史',
    title: text(input.title),
    sourceModule: moduleLabel(input.sourceModule),
    sourceObjectLabel: text(input.sourceObjectLabel, '当前工作区数据'),
    targetObjectLabel: text(input.targetObjectLabel, input.sourceObjectLabel || '历史记录'),
    actorRoleLabel: text(input.actorRoleLabel, '业务负责人'),
    priority: normalizePriority(input.priority),
    status: text(input.status, input.reviewRequired ? '待人工复核' : '只读历史'),
    summary: text(input.summary),
    keyEvidence: cleanList(input.keyEvidence, ['当前工作区来源证据']),
    reviewRequired: Boolean(input.reviewRequired),
    dataLimited: limits.length > 0 || Boolean(input.dataLimited),
    boundaryLabels: uniqueBy(cleanList([...(input.boundaryLabels || []), ...READ_ONLY_BOUNDARIES]), (item) => item).slice(0, 8),
    navigationLinks: navigationLinks(input.navigationLinks, historyNav('返回业务审计与历史', 'audit-history')),
    dataLimitations: limits,
  }
}

function buildHistoryProfile(workspace, boundary) {
  const setup = workspace.workspaceProfile || {}
  const profile = boundary.workspaceBoundaryProfile || {}
  return {
    workspaceName: text(profile.workspaceName || setup.workspaceName, '新辰智能制造'),
    businessScopeLabel: text(profile.businessScopeLabel || setup.businessScopeLabel, '进销存与供应链协同'),
    dataScopeLabel: '当前工作区数据',
    historyModeLabel: '只读历史',
    reviewModeLabel: '复核优先',
    historyPrinciples: ['历史记录不改变业务状态', '历史记录不形成正式业务处理', '仅展示复核痕迹和来源证据', '数据限制集中展示'],
  }
}

function buildAiSuggestionHistory(ai) {
  return asArray(ai.suggestions).slice(0, 10).map((item) => ({
    id: `ai-history-${item.id}`,
    suggestionLabel: text(item.title || item.sourceObjectLabel, 'AI 建议'),
    categoryLabel: text(item.categoryLabel, 'AI 建议'),
    sourceModule: moduleLabel(item.sourceModule || 'overview:ai'),
    conclusion: text(item.conclusion, 'AI 建议已生成，需结合证据人工复核。'),
    evidenceSummary: cleanList(item.keyEvidence, ['关键证据待复核']),
    businessImpact: text(item.businessImpact, '影响采购、库存、供应商或财务协同优先级。'),
    relatedDrafts: cleanList([item.draftPreview?.title], ['进入人工复核']),
    dataLimitations: asArray(item.dataLimitations).map((entry) => cleanLimitation(entry)),
    reviewBoundary: '进入人工复核',
    navigationLinks: navigationLinks(item.navigationLinks, historyNav('进入 AI 建议', 'overview:ai')),
  }))
}

function draftHistoryFromReview(review) {
  return asArray(review.drafts).slice(0, 10).map((draft) => ({
    id: `review-draft-history-${draft.id}`,
    draftLabel: text(draft.title, '行动草稿'),
    draftTypeLabel: text(draft.draftTypeLabel, '行动草稿'),
    sourceModule: moduleLabel(draft.sourceModule || 'review-actions'),
    targetObjectLabel: text(draft.targetEntityLabel || draft.sourceEntityLabel, '来源对象'),
    status: text(draft.status, '草稿预览'),
    priority: normalizePriority(draft.priority),
    conclusion: text(draft.conclusion, '该草稿仅供人工复核。'),
    reviewChecklist: cleanList(draft.reviewChecklist, ['确认来源证据', '确认业务影响', '确认数据限制']),
    boundaryLabels: cleanList(draft.boundaryLabels, READ_ONLY_BOUNDARIES),
    navigationLinks: navigationLinks(draft.navigationLinks, historyNav('进入行动草稿与人工复核', 'review-actions')),
    dataLimitations: asArray(draft.dataLimitations).map((entry) => cleanLimitation(entry)),
    previewOnly: true,
    reviewRequired: true,
    requiresHumanReview: true,
  }))
}
function draftHistoryFromSetup(workspace) {
  return asArray(workspace.setupReviewDrafts).map((draft) => ({
    id: `setup-${draft.id}`,
    draftLabel: text(draft.title, '配置复核草稿'),
    draftTypeLabel: '配置复核草稿',
    sourceModule: moduleLabel(draft.sourceModule || 'settings'),
    targetObjectLabel: text(draft.targetModule, '工作区配置'),
    status: text(draft.status, '草稿预览'),
    priority: normalizePriority(draft.priority),
    conclusion: text(draft.conclusion, '配置事项进入人工复核。'),
    reviewChecklist: cleanList(draft.reviewChecklist, ['确认配置范围', '确认业务影响']),
    boundaryLabels: cleanList(draft.boundaryLabels, READ_ONLY_BOUNDARIES),
    navigationLinks: navigationLinks(draft.navigationLinks, historyNav('进入工作区配置', 'settings')),
    dataLimitations: asArray(draft.dataLimitations).map((entry) => cleanLimitation(entry)),
    previewOnly: true,
    reviewRequired: true,
    requiresHumanReview: true,
  }))
}
function draftHistoryFromRoles(roles) {
  return asArray(roles.permissionReviewDrafts).map((draft) => ({
    id: `role-${draft.id}`,
    draftLabel: text(draft.title, '权限复核草稿'),
    draftTypeLabel: '权限复核草稿',
    sourceModule: moduleLabel(draft.sourceModule || 'settings:roles'),
    targetObjectLabel: text(draft.targetRole || draft.targetModule, '角色权限'),
    status: text(draft.status, '权限草稿预览'),
    priority: normalizePriority(draft.priority),
    conclusion: text(draft.conclusion, '权限事项进入人工复核。'),
    reviewChecklist: cleanList(draft.reviewChecklist, ['确认角色职责范围', '确认单据可见范围']),
    boundaryLabels: cleanList(draft.boundaryLabels, READ_ONLY_BOUNDARIES),
    navigationLinks: navigationLinks(draft.navigationLinks, historyNav('进入角色权限可见性', 'settings:roles')),
    dataLimitations: asArray(draft.dataLimitations).map((entry) => cleanLimitation(entry)),
    previewOnly: true,
    reviewRequired: true,
    requiresHumanReview: true,
  }))
}
function draftHistoryFromBoundary(boundary) {
  return asArray(boundary.boundaryReviewDrafts).map((draft) => ({
    id: `boundary-${draft.id}`,
    draftLabel: text(draft.title, '边界复核草稿'),
    draftTypeLabel: '边界复核草稿',
    sourceModule: moduleLabel(draft.sourceModule || 'settings:boundaries'),
    targetObjectLabel: text(draft.targetBoundaryScope, '工作区边界'),
    status: text(draft.status, '边界草稿预览'),
    priority: normalizePriority(draft.priority),
    conclusion: text(draft.conclusion, '边界事项进入人工复核。'),
    reviewChecklist: cleanList(draft.reviewChecklist, ['确认边界范围', '确认数据归属']),
    boundaryLabels: cleanList(draft.boundaryLabels, READ_ONLY_BOUNDARIES),
    navigationLinks: navigationLinks(draft.navigationLinks, historyNav('进入工作区边界', 'settings:boundaries')),
    dataLimitations: asArray(draft.dataLimitations).map((entry) => cleanLimitation(entry)),
    previewOnly: true,
    reviewRequired: true,
    requiresHumanReview: true,
  }))
}
function buildReviewDraftHistory(review, workspace, roles, boundary) {
  return uniqueBy([
    ...draftHistoryFromReview(review),
    ...draftHistoryFromSetup(workspace),
    ...draftHistoryFromRoles(roles),
    ...draftHistoryFromBoundary(boundary),
  ], (item) => item.id)
}

function buildCollaborationDraftHistory(collaboration) {
  return asArray(collaboration.drafts).slice(0, 12).map((draft) => ({
    id: `collaboration-history-${draft.id}`,
    draftLabel: text(draft.title, '协同草稿'),
    collaborationTypeLabel: text(draft.channelLabel || draft.notificationTypeLabel, '内部协同备注'),
    sourceModule: moduleLabel(draft.sourceModule || 'collaboration-drafts'),
    audienceLabel: text(draft.audienceLabel, '业务负责人'),
    sourceObjectLabel: text(draft.sourceObjectLabel, '来源对象'),
    messagePurpose: text(draft.subject || draft.messagePreview, '整理协同说明并进入人工复核。'),
    keyEvidence: cleanList(draft.keyEvidence, ['当前工作区来源证据']),
    boundaryLabels: cleanList(draft.boundaryLabels, READ_ONLY_BOUNDARIES),
    navigationLinks: navigationLinks(draft.navigationLinks, historyNav('进入协同通知草稿', 'collaboration-drafts')),
    dataLimitations: asArray(draft.dataLimitations).map((entry) => cleanLimitation(entry)),
    previewOnly: true,
    reviewRequired: true,
  }))
}

function buildDataAccessHistory(data) {
  const field = asArray(data.fieldMappings).filter((item) => item.reviewRequired || item.status !== '已映射').slice(0, 4).map((item, index) => ({
    id: `field-mapping-history-${index + 1}`,
    historyLabel: `字段映射历史：${text(item.fieldLabel)}`,
    sourceModule: '数据接入与质量',
    dataObjectLabel: text(item.businessObject || item.sourceLabel, '字段映射'),
    issueTypeLabel: text(item.status, '需复核'),
    affectedModules: cleanList([item.downstreamImpact], ['AI 建议', '报表与分析']),
    affectedInsights: cleanList([item.suggestedMapping, item.issue], ['字段映射需要人工确认']),
    suggestedReview: text(item.downstreamImpact || item.issue, '复核字段映射和影响模块。'),
    dataLimitations: [cleanLimitation('字段映射待复核', item.issue || '字段映射影响下游解释。')],
    navigationLinks: [historyNav('进入数据接入与质量', 'imports', 'data_quality_issue', item.canonicalField, item.fieldLabel)],
  }))
  const issues = asArray(data.qualityIssues).slice(0, 5).map((issue) => ({
    id: `quality-history-${issue.id}`,
    historyLabel: `数据质量事项历史：${text(issue.title)}`,
    sourceModule: '数据接入与质量',
    dataObjectLabel: text(issue.businessObjectLabel, '数据质量事项'),
    issueTypeLabel: text(issue.issueType, '证据缺口'),
    affectedModules: cleanList([issue.affectedModule, ...asArray(issue.affectedControlTowerCategories)], ['AI 建议', '报表与分析']),
    affectedInsights: cleanList([issue.businessImpact, issue.explanation], ['影响 AI、报表和草稿依据']),
    suggestedReview: text(issue.suggestedFix, '进入数据负责人复核。'),
    dataLimitations: asArray(issue.dataLimitations).map((entry) => cleanLimitation(entry)),
    navigationLinks: navigationLinks(issue.navigationLinks, historyNav('进入数据接入与质量', 'imports')),
  }))
  const fixes = asArray(data.recommendedFixes).map((fix, index) => ({
    id: `data-fix-history-${index + 1}`,
    historyLabel: text(fix.title, '数据补齐建议历史'),
    sourceModule: '数据接入与质量',
    dataObjectLabel: text(fix.targetObject, '数据补齐清单'),
    issueTypeLabel: '数据补齐',
    affectedModules: ['AI 建议', '报表与分析', '行动草稿与人工复核'],
    affectedInsights: [text(fix.description, '整理数据补齐影响。')],
    suggestedReview: '生成草稿预览并交由业务负责人复核。',
    dataLimitations: [],
    navigationLinks: [historyNav('进入数据接入与质量', 'imports')],
  }))
  const gaps = asArray(data.evidenceGaps).slice(0, 3).map((gap, index) => ({
    id: `evidence-gap-history-${index + 1}`,
    historyLabel: `证据缺口历史：${text(gap.title)}`,
    sourceModule: '数据接入与质量',
    dataObjectLabel: text(gap.affectedObject, '证据缺口'),
    issueTypeLabel: '证据缺口',
    affectedModules: ['AI 建议', '报表与分析', '草稿复核'],
    affectedInsights: cleanList([gap.consequence], ['证据缺口影响解释可信度']),
    suggestedReview: text(gap.suggestedNextStep, '补充来源证据并复核。'),
    dataLimitations: [cleanLimitation('证据缺口', gap.consequence)],
    navigationLinks: navigationLinks(gap.navigationLinks, historyNav('进入数据接入与质量', 'imports')),
  }))
  return uniqueBy([...field, ...issues, ...fixes, ...gaps], (item) => item.id)
}

function buildSettingsGovernanceHistory(workspace) {
  const modules = asArray(workspace.moduleSettings).slice(0, 4).map((item) => ({
    id: `setting-module-${item.id}`,
    historyLabel: `模块启用状态历史：${text(item.moduleLabel)}`,
    sourceModule: '工作区配置',
    targetSettingLabel: text(item.moduleLabel),
    governanceTypeLabel: '模块启用状态历史',
    status: text(item.statusLabel, '已启用'),
    conclusion: cleanList(item.connectedInsights, ['当前模块可用于业务复核。']).join('；'),
    keyEvidence: cleanList(item.keyObjects, ['当前工作区对象']),
    reviewChecklist: ['确认模块边界', '确认业务影响', '确认复核范围'],
    boundaryLabels: READ_ONLY_BOUNDARIES,
    navigationLinks: navigationLinks(item.navigationLinks, historyNav('进入工作区配置', 'settings')),
    dataLimitations: asArray(item.dataLimitations).map((entry) => cleanLimitation(entry)),
    previewOnly: true,
    reviewRequired: true,
  }))
  const policies = asArray(workspace.reviewPolicies).slice(0, 3).map((policy, index) => ({
    id: `setting-policy-${index + 1}`,
    historyLabel: `复核策略历史：${text(policy.policyLabel)}`,
    sourceModule: '工作区配置',
    targetSettingLabel: text(policy.appliesTo?.join?.('、') || policy.policyLabel),
    governanceTypeLabel: '复核策略历史',
    status: '复核优先',
    conclusion: text(policy.allowedUse, '生成草稿预览并整理证据。'),
    keyEvidence: cleanList(policy.appliesTo, ['行动草稿', '协同通知草稿']),
    reviewChecklist: ['确认复核策略', '确认草稿边界'],
    boundaryLabels: cleanList(policy.boundaryLabels, READ_ONLY_BOUNDARIES),
    navigationLinks: navigationLinks(policy.navigationLinks, historyNav('进入工作区配置', 'settings')),
    dataLimitations: [],
    previewOnly: true,
    reviewRequired: true,
  }))
  const numbering = asArray(workspace.numberingRules).slice(0, 3).map((rule) => ({
    id: `setting-number-${rule.objectType}`,
    historyLabel: `编号规则历史：${text(rule.objectLabel)}`,
    sourceModule: '工作区配置',
    targetSettingLabel: text(rule.objectLabel),
    governanceTypeLabel: '编号规则历史',
    status: text(rule.statusLabel, '当前规则可见'),
        conclusion: `当前前缀 ${text(rule.prefix)}，参考值 ${text(rule.example)}。`,
    keyEvidence: [text(rule.objectLabel), text(rule.prefix)],
    reviewChecklist: ['确认编号对象', '确认业务可读性'],
    boundaryLabels: READ_ONLY_BOUNDARIES,
    navigationLinks: [historyNav('进入工作区配置', 'settings')],
    dataLimitations: [],
    previewOnly: true,
    reviewRequired: true,
  }))
  const ai = asArray(workspace.aiAssistanceBoundaries).slice(0, 2).map((item) => ({
    id: `setting-ai-${item.id}`,
    historyLabel: `AI 边界历史：${text(item.boundaryLabel)}`,
    sourceModule: '工作区配置',
    targetSettingLabel: text(item.boundaryLabel),
    governanceTypeLabel: 'AI 边界历史',
    status: '复核优先',
    conclusion: text(item.allowedUse, 'AI 仅用于解释和草稿预览。'),
    keyEvidence: [text(item.restrictedUseBusinessWording, '不形成正式业务处理')],
    reviewChecklist: ['确认 AI 使用边界', '确认数据限制显示'],
    boundaryLabels: READ_ONLY_BOUNDARIES,
    navigationLinks: navigationLinks(item.navigationLinks, historyNav('进入 AI 建议', 'overview:ai')),
    dataLimitations: [],
    previewOnly: true,
    reviewRequired: true,
  }))
  const collaboration = asArray(workspace.collaborationDraftPolicies).slice(0, 2).map((item) => ({
    id: `setting-collaboration-${compact(item.policyLabel)}`,
    historyLabel: `协同草稿策略历史：${text(item.policyLabel)}`,
    sourceModule: '工作区配置',
    targetSettingLabel: text(item.policyLabel),
    governanceTypeLabel: '协同草稿策略历史',
    status: '草稿预览',
    conclusion: text(item.boundarySummary, '协同草稿进入人工复核。'),
    keyEvidence: cleanList(item.allowedUse, ['协同草稿预览']),
    reviewChecklist: ['确认协同对象', '确认边界说明'],
    boundaryLabels: READ_ONLY_BOUNDARIES,
    navigationLinks: navigationLinks(item.navigationLinks, historyNav('进入协同通知草稿', 'collaboration-drafts')),
    dataLimitations: [],
    previewOnly: true,
    reviewRequired: true,
  }))
  const quality = asArray(workspace.dataQualitySettings).map((item) => ({
    id: `setting-quality-${item.id}`,
    historyLabel: `数据质量设置历史：${text(item.settingLabel)}`,
    sourceModule: '工作区配置',
    targetSettingLabel: text(item.settingLabel),
    governanceTypeLabel: '数据质量设置历史',
    status: number(item.issueCount) ? '需复核' : '当前可见',
    conclusion: text(item.suggestedReview, '复核数据质量影响。'),
    keyEvidence: [`映射字段 ${number(item.mappedFieldsCount)} 项`, `质量事项 ${number(item.issueCount)} 项`],
    reviewChecklist: ['确认字段映射', '确认质量事项影响'],
    boundaryLabels: READ_ONLY_BOUNDARIES,
    navigationLinks: navigationLinks(item.navigationLinks, historyNav('进入数据接入与质量', 'imports')),
    dataLimitations: asArray(item.dataLimitations).map((entry) => cleanLimitation(entry)),
    previewOnly: true,
    reviewRequired: true,
  }))
  return uniqueBy([...modules, ...policies, ...numbering, ...ai, ...collaboration, ...quality, ...draftHistoryFromSetup(workspace).map((draft) => ({
    id: `setting-draft-${draft.id}`,
    historyLabel: `配置复核草稿历史：${draft.draftLabel}`,
    sourceModule: '工作区配置',
    targetSettingLabel: draft.targetObjectLabel,
    governanceTypeLabel: '配置复核草稿历史',
    status: draft.status,
    conclusion: draft.conclusion,
    keyEvidence: draft.reviewChecklist,
    reviewChecklist: draft.reviewChecklist,
    boundaryLabels: draft.boundaryLabels,
    navigationLinks: draft.navigationLinks,
    dataLimitations: draft.dataLimitations,
    previewOnly: true,
    reviewRequired: true,
  }))], (item) => item.id)
}

function buildRolePermissionHistory(roles) {
  const profiles = asArray(roles.roleProfiles).slice(0, 8).map((role) => ({
    id: `role-profile-${role.id}`,
    historyLabel: `业务角色历史：${text(role.roleLabel)}`,
    sourceModule: '角色权限可见性',
    roleLabel: text(role.roleLabel),
    permissionAreaLabel: text(role.roleGroup, '业务角色'),
    visibleObjects: cleanList(role.visibleObjects, ['业务对象']),
    reviewScopes: cleanList(role.reviewScopes, ['人工复核']),
    restrictedScopes: cleanList(role.restrictedScopes, ['只读历史']),
    boundaryLabels: cleanList(role.boundaryLabels, READ_ONLY_BOUNDARIES),
    navigationLinks: navigationLinks(role.navigationLinks, historyNav('进入角色权限可见性', 'settings:roles')),
    dataLimitations: asArray(role.dataLimitations).map((entry) => cleanLimitation(entry)),
  }))
  const bundles = asArray(roles.permissionBundles).slice(0, 4).map((bundle) => ({
    id: `role-bundle-${bundle.id}`,
    historyLabel: `职责包历史：${text(bundle.bundleLabel)}`,
    sourceModule: '角色权限可见性',
    roleLabel: cleanList(bundle.includedRoles, ['业务角色']).join('、'),
    permissionAreaLabel: text(bundle.bundleLabel, '职责包'),
    visibleObjects: cleanList(bundle.visibleObjects, ['业务对象']),
    reviewScopes: cleanList(bundle.reviewCapabilities, ['人工复核']),
    restrictedScopes: cleanList(bundle.restrictedCapabilities, ['只读历史']),
    boundaryLabels: cleanList(bundle.boundaryLabels, READ_ONLY_BOUNDARIES),
    navigationLinks: navigationLinks(bundle.navigationLinks, historyNav('进入角色权限可见性', 'settings:roles')),
    dataLimitations: [],
  }))
  const matrix = asArray(roles.documentPermissionMatrix).slice(0, 4).map((row) => ({
    id: `role-document-${row.documentType}`,
    historyLabel: `单据权限矩阵历史：${text(row.documentLabel)}`,
    sourceModule: '角色权限可见性',
    roleLabel: cleanList(row.visibleToRoles, ['业务角色']).join('、'),
    permissionAreaLabel: text(row.documentLabel),
    visibleObjects: [text(row.documentLabel)],
    reviewScopes: cleanList(row.reviewRoles, ['人工复核']),
    restrictedScopes: cleanList(row.restrictedRoles, ['只读历史']),
    boundaryLabels: READ_ONLY_BOUNDARIES,
    navigationLinks: navigationLinks(row.navigationLinks, historyNav('进入角色权限可见性', 'settings:roles')),
    dataLimitations: [],
  }))
  const scopes = asArray(roles.dataScopeGroups).slice(0, 3).map((scope) => ({
    id: `role-scope-${scope.id}`,
    historyLabel: `数据范围分组历史：${text(scope.scopeLabel)}`,
    sourceModule: '角色权限可见性',
    roleLabel: cleanList(scope.appliesToRoles, ['业务角色']).join('、'),
    permissionAreaLabel: text(scope.scopeLabel),
    visibleObjects: cleanList(scope.includedObjects, ['当前工作区数据']),
    reviewScopes: cleanList([scope.limitationSummary], ['人工复核']),
    restrictedScopes: ['只读历史'],
    boundaryLabels: READ_ONLY_BOUNDARIES,
    navigationLinks: navigationLinks(scope.navigationLinks, historyNav('进入角色权限可见性', 'settings:roles')),
    dataLimitations: [],
  }))
  const drafts = draftHistoryFromRoles(roles).map((draft) => ({
    id: `role-draft-history-${draft.id}`,
    historyLabel: `权限复核草稿历史：${draft.draftLabel}`,
    sourceModule: '角色权限可见性',
    roleLabel: draft.targetObjectLabel,
    permissionAreaLabel: draft.draftTypeLabel,
    visibleObjects: [draft.targetObjectLabel],
    reviewScopes: draft.reviewChecklist,
    restrictedScopes: draft.boundaryLabels,
    boundaryLabels: draft.boundaryLabels,
    navigationLinks: draft.navigationLinks,
    dataLimitations: draft.dataLimitations,
  }))
  return uniqueBy([...profiles, ...bundles, ...matrix, ...scopes, ...drafts], (item) => item.id)
}

function buildBoundaryReviewHistory(boundary) {
  const scopes = asArray(boundary.boundaryScopes).map((scope) => ({
    id: `boundary-scope-${scope.id}`,
    historyLabel: `工作区边界范围历史：${text(scope.scopeLabel)}`,
    sourceModule: '工作区边界',
    boundaryScopeLabel: text(scope.scopeLabel),
    ownerRoleLabel: '业务负责人',
    boundarySummary: text(scope.boundarySummary, '当前工作区边界状态可见。'),
    affectedObjects: cleanList(scope.includedObjects, ['当前工作区数据']),
    reviewChecklist: ['确认边界范围', '确认来源模块', '确认数据限制'],
    boundaryLabels: READ_ONLY_BOUNDARIES,
    navigationLinks: navigationLinks(scope.navigationLinks, historyNav('进入工作区边界', 'settings:boundaries')),
    dataLimitations: asArray(scope.dataLimitations).map((entry) => cleanLimitation(entry)),
    previewOnly: true,
    reviewRequired: true,
  }))
  const owners = asArray(boundary.dataOwnershipGroups).slice(0, 4).map((owner) => ({
    id: `boundary-owner-${owner.id}`,
    historyLabel: `数据归属历史：${text(owner.ownerLabel)}`,
    sourceModule: '工作区边界',
    boundaryScopeLabel: text(owner.ownerLabel),
    ownerRoleLabel: text(owner.ownerRole, '业务负责人'),
    boundarySummary: text(owner.boundarySummary, '仅展示数据归属范围。'),
    affectedObjects: cleanList(owner.ownedObjects, ['当前工作区数据']),
    reviewChecklist: cleanList(owner.reviewResponsibilities, ['确认数据归属']),
    boundaryLabels: READ_ONLY_BOUNDARIES,
    navigationLinks: navigationLinks(owner.navigationLinks, historyNav('进入工作区边界', 'settings:boundaries')),
    dataLimitations: asArray(owner.dataLimitations).map((entry) => cleanLimitation(entry)),
    previewOnly: true,
    reviewRequired: true,
  }))
  const modules = asArray(boundary.moduleBoundaryMatrix).slice(0, 3).map((row) => ({
    id: `boundary-module-${row.id}`,
    historyLabel: `模块边界历史：${text(row.moduleLabel)}`,
    sourceModule: '工作区边界',
    boundaryScopeLabel: text(row.boundaryGroup, '模块边界'),
    ownerRoleLabel: '系统配置复核人',
    boundarySummary: text(row.boundarySummary, '模块边界仅展示状态。'),
    affectedObjects: cleanList(row.dataUsed, ['当前工作区数据']),
    reviewChecklist: cleanList(row.reviewOutputs, ['人工复核']),
    boundaryLabels: READ_ONLY_BOUNDARIES,
    navigationLinks: navigationLinks(row.navigationLinks, historyNav('进入工作区边界', 'settings:boundaries')),
    dataLimitations: [],
    previewOnly: true,
    reviewRequired: true,
  }))
  const documents = asArray(boundary.documentBoundaryMatrix).slice(0, 4).map((row) => ({
    id: `boundary-document-${compact(row.objectLabel)}`,
    historyLabel: `业务对象边界历史：${text(row.objectLabel)}`,
    sourceModule: '工作区边界',
    boundaryScopeLabel: text(row.objectGroup, '业务对象边界'),
    ownerRoleLabel: text(row.boundaryOwnerRole, '业务负责人'),
    boundarySummary: text(row.restrictedUseSummary, '只读展示业务对象边界。'),
    affectedObjects: [text(row.objectLabel)],
    reviewChecklist: cleanList([row.reviewUse, row.collaborationUse], ['人工复核']),
    boundaryLabels: READ_ONLY_BOUNDARIES,
    navigationLinks: navigationLinks(row.navigationLinks, historyNav('进入工作区边界', 'settings:boundaries')),
    dataLimitations: [],
    previewOnly: true,
    reviewRequired: true,
  }))
  const ai = asArray(boundary.aiBoundaryAwareness).slice(0, 2).map((row) => ({
    id: `boundary-ai-${row.id}`,
    historyLabel: `AI 边界意识历史：${text(row.signalLabel)}`,
    sourceModule: '工作区边界',
    boundaryScopeLabel: 'AI 建议边界',
    ownerRoleLabel: '数据负责人',
    boundarySummary: text(row.reviewBoundary, 'AI 建议进入人工复核。'),
    affectedObjects: cleanList(row.requiredEvidence, ['AI Suggestion']),
    reviewChecklist: ['确认关键证据', '确认数据限制'],
    boundaryLabels: READ_ONLY_BOUNDARIES,
    navigationLinks: navigationLinks(row.navigationLinks, historyNav('进入 AI 建议', 'overview:ai')),
    dataLimitations: asArray(row.dataLimitations).map((entry) => cleanLimitation(entry)),
    previewOnly: true,
    reviewRequired: true,
  }))
  const collaboration = asArray(boundary.collaborationBoundaryPolicies).slice(0, 2).map((row) => ({
    id: `boundary-collaboration-${row.id}`,
    historyLabel: `协同边界策略历史：${text(row.policyLabel)}`,
    sourceModule: '工作区边界',
    boundaryScopeLabel: '协同通知草稿边界',
    ownerRoleLabel: '采购负责人',
    boundarySummary: text(row.boundarySummary, '协同草稿进入人工复核。'),
    affectedObjects: cleanList(row.allowedUse, ['Collaboration Draft']),
    reviewChecklist: ['确认协同对象', '确认仅内部留存'],
    boundaryLabels: READ_ONLY_BOUNDARIES,
    navigationLinks: navigationLinks(row.navigationLinks, historyNav('进入协同通知草稿', 'collaboration-drafts')),
    dataLimitations: [],
    previewOnly: true,
    reviewRequired: true,
  }))
  const roles = asArray(boundary.roleBoundaryVisibility).slice(0, 2).map((row) => ({
    id: `boundary-role-${row.id}`,
    historyLabel: `角色边界可见性历史：${text(row.roleLabel)}`,
    sourceModule: '工作区边界',
    boundaryScopeLabel: '角色权限边界',
    ownerRoleLabel: text(row.roleLabel, '业务角色'),
    boundarySummary: text(row.restrictedBoundarySummary, '只读展示角色边界。'),
    affectedObjects: cleanList(row.documentBoundaryAccess, ['业务对象']),
    reviewChecklist: cleanList(row.reviewBoundaryScopes, ['人工复核']),
    boundaryLabels: READ_ONLY_BOUNDARIES,
    navigationLinks: navigationLinks(row.navigationLinks, historyNav('进入角色权限可见性', 'settings:roles')),
    dataLimitations: [],
    previewOnly: true,
    reviewRequired: true,
  }))
  const quality = asArray(boundary.dataQualityBoundarySignals).slice(0, 2).map((row) => ({
    id: `boundary-quality-${row.id}`,
    historyLabel: `数据质量边界信号历史：${text(row.signalLabel)}`,
    sourceModule: '工作区边界',
    boundaryScopeLabel: '数据接入质量边界',
    ownerRoleLabel: '数据负责人',
    boundarySummary: text(row.impactSummary, '数据质量影响边界判断。'),
    affectedObjects: cleanList(row.affectedObjects, ['Data Access Issue']),
    reviewChecklist: [text(row.suggestedReview, '进入数据负责人复核。')],
    boundaryLabels: READ_ONLY_BOUNDARIES,
    navigationLinks: navigationLinks(row.navigationLinks, historyNav('进入数据接入与质量', 'imports')),
    dataLimitations: asArray(row.dataLimitations).map((entry) => cleanLimitation(entry)),
    previewOnly: true,
    reviewRequired: true,
  }))
  const drafts = draftHistoryFromBoundary(boundary).map((draft) => ({
    id: `boundary-draft-history-${draft.id}`,
    historyLabel: `边界复核草稿历史：${draft.draftLabel}`,
    sourceModule: '工作区边界',
    boundaryScopeLabel: draft.targetObjectLabel,
    ownerRoleLabel: '系统配置复核人',
    boundarySummary: draft.conclusion,
    affectedObjects: [draft.targetObjectLabel],
    reviewChecklist: draft.reviewChecklist,
    boundaryLabels: draft.boundaryLabels,
    navigationLinks: draft.navigationLinks,
    dataLimitations: draft.dataLimitations,
    previewOnly: true,
    reviewRequired: true,
  }))
  return uniqueBy([...scopes, ...owners, ...modules, ...documents, ...ai, ...collaboration, ...roles, ...quality, ...drafts], (item) => item.id)
}

function buildBusinessObjectHistory(boundary, reports, tower) {
  const reportSignals = asArray(reports.reportInsights).map((item) => text(item.title))
  const towerSignals = asArray(tower.items).map((item) => text(item.businessObjectLabel || item.title))
  const fromBoundary = asArray(boundary.documentBoundaryMatrix).map((row) => ({
    id: `object-history-${compact(row.objectLabel)}`,
    objectLabel: text(row.objectLabel),
    objectTypeLabel: text(row.objectGroup, '业务对象'),
    sourceModule: moduleLabel(row.sourceModule),
    relatedModules: cleanList(row.relatedModules, ['AI 建议', '行动草稿与人工复核']),
    evidenceUse: text(row.evidenceUse, '证据链历史'),
    aiUse: text(row.aiUse, 'AI 解释'),
    reviewUse: text(row.reviewUse, '人工复核'),
    collaborationUse: text(row.collaborationUse, '协同草稿'),
    latestSignalLabel: towerSignals.find((signal) => signal.includes(row.objectLabel.split(' ')[0])) || reportSignals[0] || '当前工作区历史可见',
    navigationLinks: navigationLinks(row.navigationLinks, historyNav('打开来源对象', 'overview')),
    dataLimitations: [],
  }))
  const required = [
    ['PR', '采购对象', '采购管理'],
    ['RFQ', '采购对象', '采购管理'],
    ['Quote Comparison', '采购对象', '采购管理'],
    ['Award Recommendation Draft', '采购对象', '行动草稿与人工复核'],
    ['PO', '采购对象', '采购管理'],
    ['GRN', '库存对象', '库存管理'],
    ['Invoice', '财务对象', '财务协同'],
    ['Three-way Match', '财务对象', '财务协同'],
    ['Supplier Operational Profile', '供应商对象', '供应商管理'],
    ['SKU / Inventory', '库存对象', '库存管理'],
    ['AI Suggestion', 'AI 建议', 'AI 建议'],
    ['Action Draft', '草稿对象', '行动草稿与人工复核'],
    ['Collaboration Draft', '草稿对象', '协同通知草稿'],
    ['Workspace Config Draft', '设置对象', '工作区配置'],
    ['Permission Review Draft', '设置对象', '角色权限可见性'],
    ['Boundary Review Draft', '设置对象', '工作区边界'],
  ].map(([objectLabel, objectTypeLabel, sourceModule]) => ({
    id: `object-required-${compact(objectLabel)}`,
    objectLabel,
    objectTypeLabel,
    sourceModule,
    relatedModules: ['AI 建议', '行动草稿与人工复核', '报表与分析'],
    evidenceUse: '证据链历史',
    aiUse: '解释和数据限制',
    reviewUse: '人工复核',
    collaborationUse: '协同草稿',
    latestSignalLabel: '当前工作区历史可见',
    navigationLinks: [historyNav(`进入${sourceModule}`, sourceModule === 'AI 建议' ? 'overview:ai' : sourceModule === '行动草稿与人工复核' ? 'review-actions' : sourceModule === '协同通知草稿' ? 'collaboration-drafts' : sourceModule === '工作区配置' ? 'settings' : sourceModule === '角色权限可见性' ? 'settings:roles' : sourceModule === '工作区边界' ? 'settings:boundaries' : sourceModule === '库存管理' ? 'inventory' : sourceModule === '供应商管理' ? 'srm' : sourceModule === '财务协同' ? 'finance' : 'procurement')],
    dataLimitations: [],
  }))
  return uniqueBy([...fromBoundary, ...required], (item) => item.objectLabel)
}

function buildTimeline({ aiHistory, reviewDraftHistory, collaborationDraftHistory, dataAccessHistory, settingsGovernanceHistory, rolePermissionHistory, boundaryReviewHistory, businessObjectHistory, reports }) {
  const rows = [
    ...aiHistory.slice(0, 4).map((item) => ({ id: `timeline-${item.id}`, category: 'ai_suggestion', title: item.suggestionLabel, sourceModule: 'AI 建议', sourceObjectLabel: item.categoryLabel, targetObjectLabel: item.relatedDrafts[0], actorRoleLabel: '业务负责人', priority: '中', status: '进入人工复核', summary: item.conclusion, keyEvidence: item.evidenceSummary, reviewRequired: true, dataLimited: item.dataLimitations.length > 0, boundaryLabels: [item.reviewBoundary], navigationLinks: item.navigationLinks, dataLimitations: item.dataLimitations })),
    ...reviewDraftHistory.slice(0, 4).map((item) => ({ id: `timeline-${item.id}`, category: 'action_draft', title: item.draftLabel, sourceModule: item.sourceModule, sourceObjectLabel: item.targetObjectLabel, targetObjectLabel: item.draftTypeLabel, actorRoleLabel: '复核负责人', priority: item.priority, status: item.status, summary: item.conclusion, keyEvidence: item.reviewChecklist, reviewRequired: true, dataLimited: item.dataLimitations.length > 0, boundaryLabels: item.boundaryLabels, navigationLinks: item.navigationLinks, dataLimitations: item.dataLimitations })),
    ...collaborationDraftHistory.slice(0, 3).map((item) => ({ id: `timeline-${item.id}`, category: 'collaboration_draft', title: item.draftLabel, sourceModule: item.sourceModule, sourceObjectLabel: item.sourceObjectLabel, targetObjectLabel: item.audienceLabel, actorRoleLabel: '协同负责人', priority: '中', status: '待人工复核', summary: item.messagePurpose, keyEvidence: item.keyEvidence, reviewRequired: true, dataLimited: item.dataLimitations.length > 0, boundaryLabels: item.boundaryLabels, navigationLinks: item.navigationLinks, dataLimitations: item.dataLimitations })),
    ...dataAccessHistory.slice(0, 4).map((item) => ({ id: `timeline-${item.id}`, category: 'data_quality', title: item.historyLabel, sourceModule: item.sourceModule, sourceObjectLabel: item.dataObjectLabel, targetObjectLabel: item.issueTypeLabel, actorRoleLabel: '数据负责人', priority: '中', status: '需复核', summary: item.suggestedReview, keyEvidence: item.affectedInsights, reviewRequired: true, dataLimited: true, boundaryLabels: ['数据限制', '人工复核'], navigationLinks: item.navigationLinks, dataLimitations: item.dataLimitations })),
    ...asArray(reports.reportInsights).slice(0, 2).map((item, index) => ({ id: `timeline-report-${index + 1}`, category: 'reports_insight', title: text(item.title, '报表洞察历史'), sourceModule: '报表与分析', sourceObjectLabel: '报表洞察', targetObjectLabel: '管理层观察', actorRoleLabel: '运营分析', priority: item.severity || '中', status: '只读历史', summary: text(item.conclusion, '报表洞察已生成。'), keyEvidence: cleanList(item.keyEvidence, ['报表证据']), reviewRequired: false, dataLimited: asArray(item.dataLimitations).length > 0, boundaryLabels: ['只读历史'], navigationLinks: navigationLinks(item.navigationLinks, historyNav('进入报表与分析', 'reports')), dataLimitations: asArray(item.dataLimitations).map((entry) => cleanLimitation(entry)) })),
    ...settingsGovernanceHistory.slice(0, 3).map((item) => ({ id: `timeline-${item.id}`, category: 'setup_config', title: item.historyLabel, sourceModule: item.sourceModule, sourceObjectLabel: item.targetSettingLabel, targetObjectLabel: item.governanceTypeLabel, actorRoleLabel: '系统配置复核人', priority: '中', status: item.status, summary: item.conclusion, keyEvidence: item.keyEvidence, reviewRequired: true, dataLimited: item.dataLimitations.length > 0, boundaryLabels: item.boundaryLabels, navigationLinks: item.navigationLinks, dataLimitations: item.dataLimitations })),
    ...rolePermissionHistory.slice(0, 3).map((item) => ({ id: `timeline-${item.id}`, category: 'role_permission', title: item.historyLabel, sourceModule: item.sourceModule, sourceObjectLabel: item.roleLabel, targetObjectLabel: item.permissionAreaLabel, actorRoleLabel: '系统配置复核人', priority: '中', status: '只读历史', summary: item.restrictedScopes.join('；'), keyEvidence: item.visibleObjects, reviewRequired: true, dataLimited: item.dataLimitations.length > 0, boundaryLabels: item.boundaryLabels, navigationLinks: item.navigationLinks, dataLimitations: item.dataLimitations })),
    ...boundaryReviewHistory.slice(0, 3).map((item) => ({ id: `timeline-${item.id}`, category: 'workspace_boundary', title: item.historyLabel, sourceModule: item.sourceModule, sourceObjectLabel: item.boundaryScopeLabel, targetObjectLabel: item.ownerRoleLabel, actorRoleLabel: item.ownerRoleLabel, priority: '中', status: '边界可见', summary: item.boundarySummary, keyEvidence: item.affectedObjects, reviewRequired: true, dataLimited: item.dataLimitations.length > 0, boundaryLabels: item.boundaryLabels, navigationLinks: item.navigationLinks, dataLimitations: item.dataLimitations })),
    ...businessObjectHistory.filter((item) => ['PR', 'RFQ', 'PO'].includes(item.objectLabel)).map((item) => ({ id: `timeline-procurement-${item.id}`, category: 'procurement_object', title: `采购对象历史：${item.objectLabel}`, sourceModule: item.sourceModule, sourceObjectLabel: item.objectLabel, targetObjectLabel: item.latestSignalLabel, actorRoleLabel: '采购负责人', priority: '中', status: '只读历史', summary: item.evidenceUse, keyEvidence: [item.aiUse, item.reviewUse], reviewRequired: false, dataLimited: false, boundaryLabels: ['只读历史'], navigationLinks: item.navigationLinks, dataLimitations: item.dataLimitations })),
    ...businessObjectHistory.filter((item) => item.objectLabel === 'Supplier Operational Profile').slice(0, 1).map((item) => ({ id: `timeline-supplier-${item.id}`, category: 'supplier_object', title: `供应商对象历史：${item.objectLabel}`, sourceModule: item.sourceModule, sourceObjectLabel: item.objectLabel, targetObjectLabel: item.latestSignalLabel, actorRoleLabel: '供应商管理负责人', priority: '中', status: '只读历史', summary: item.evidenceUse, keyEvidence: [item.aiUse, item.reviewUse], reviewRequired: false, dataLimited: false, boundaryLabels: ['只读历史'], navigationLinks: item.navigationLinks, dataLimitations: item.dataLimitations })),
    ...businessObjectHistory.filter((item) => item.objectLabel === 'SKU / Inventory').slice(0, 1).map((item) => ({ id: `timeline-inventory-${item.id}`, category: 'inventory_object', title: `库存对象历史：${item.objectLabel}`, sourceModule: item.sourceModule, sourceObjectLabel: item.objectLabel, targetObjectLabel: item.latestSignalLabel, actorRoleLabel: '库存与计划负责人', priority: '中', status: '只读历史', summary: item.evidenceUse, keyEvidence: [item.aiUse, item.reviewUse], reviewRequired: false, dataLimited: false, boundaryLabels: ['只读历史'], navigationLinks: item.navigationLinks, dataLimitations: item.dataLimitations })),
    ...businessObjectHistory.filter((item) => ['Invoice', 'Three-way Match'].includes(item.objectLabel)).slice(0, 1).map((item) => ({ id: `timeline-finance-${item.id}`, category: 'finance_review', title: `财务复核历史：${item.objectLabel}`, sourceModule: item.sourceModule, sourceObjectLabel: item.objectLabel, targetObjectLabel: item.latestSignalLabel, actorRoleLabel: '财务复核负责人', priority: '中', status: '只读历史', summary: item.evidenceUse, keyEvidence: [item.aiUse, item.reviewUse], reviewRequired: true, dataLimited: false, boundaryLabels: ['只读历史', '不写财务凭证', '不处理资金'], navigationLinks: item.navigationLinks, dataLimitations: item.dataLimitations })),
  ]
  return uniqueBy(rows.map((row, index) => makeTimeline(row, index)), (item) => item.id)
}

function buildSourceSummary({ ai, review, collaboration, data, reports, workspace, roles, boundary, timeline }) {
  return [
    ['AI 建议', number(ai.summary?.totalSuggestionCount), 'AI 建议历史', 'overview:ai'],
    ['行动草稿与人工复核', number(review.summary?.totalDraftCount), '行动草稿历史', 'review-actions'],
    ['协同通知草稿', number(collaboration.summary?.totalDraftCount), '协同草稿历史', 'collaboration-drafts'],
    ['数据接入与质量', number(data.summary?.criticalIssueCount) + number(data.summary?.warningIssueCount), '数据接入历史', 'imports'],
    ['报表与分析', asArray(reports.reportInsights).length, '报表洞察历史', 'reports'],
    ['工作区配置', number(workspace.summary?.enabledModuleCount), '设置治理历史', 'settings'],
    ['角色权限可见性', number(roles.summary?.roleCount), '角色权限历史', 'settings:roles'],
    ['工作区边界', number(boundary.summary?.boundaryScopeCount), '边界复核历史', 'settings:boundaries'],
  ].map(([sourceLabel, signalCount, historyAreaLabel, moduleId]) => ({
    sourceLabel,
    historyAreaLabel,
    historyCount: timeline.filter((item) => item.sourceModule === sourceLabel || item.categoryLabel === historyAreaLabel).length,
    signalCount,
    navigationLinks: [historyNav(`进入${sourceLabel}`, moduleId)],
  }))
}

function buildSummary({ timeline, aiHistory, reviewDraftHistory, collaborationDraftHistory, dataAccessHistory, settingsGovernanceHistory, rolePermissionHistory, boundaryReviewHistory, businessObjectHistory, dataLimitations }) {
  return {
    totalHistoryCount: timeline.length,
    aiHistoryCount: aiHistory.length,
    actionDraftHistoryCount: reviewDraftHistory.filter((item) => item.draftTypeLabel === '行动草稿' || !/配置|权限|边界/.test(item.draftTypeLabel)).length,
    collaborationHistoryCount: collaborationDraftHistory.length,
    dataQualityHistoryCount: dataAccessHistory.length,
    setupGovernanceHistoryCount: settingsGovernanceHistory.length,
    rolePermissionHistoryCount: rolePermissionHistory.length,
    boundaryHistoryCount: boundaryReviewHistory.length,
    businessObjectHistoryCount: businessObjectHistory.length,
    highPriorityCount: timeline.filter((item) => priorityRank(item.priority) >= 3).length,
    dataLimitedCount: timeline.filter((item) => item.dataLimited).length + dataLimitations.length,
    reviewRequiredCount: timeline.filter((item) => item.reviewRequired).length,
    readinessLabel: dataLimitations.length ? '需复核关注' : '历史可见',
  }
}

export function buildAuditIntegrationHistoryV2(db = {}, options = {}) {
  const generatedAt = options.generatedAt || GENERATED_AT
  const ai = buildAiSuggestionsWorkbenchV2(db, { generatedAt }) || {}
  const review = buildReviewFirstActionWorkflowV2(db, { generatedAt }) || {}
  const collaboration = buildCollaborationNotificationDraftsV2(db) || {}
  const data = buildDataAccessQualityV2(db, { generatedAt }) || {}
  const reports = buildReportsAnalyticsV2(db, { generatedAt }) || {}
  const tower = buildOperationsControlTowerV2(db, { generatedAt }) || {}
  const workspace = buildWorkspaceSetupConfigV2(db) || {}
  const roles = buildUserRolePermissionVisibilityV2(db) || {}
  const boundary = buildWorkspaceBoundaryVisibilityV2(db) || {}

  const historyProfile = buildHistoryProfile(workspace, boundary)
  const aiSuggestionHistory = buildAiSuggestionHistory(ai)
  const reviewDraftHistory = buildReviewDraftHistory(review, workspace, roles, boundary)
  const collaborationDraftHistory = buildCollaborationDraftHistory(collaboration)
  const dataAccessHistory = buildDataAccessHistory(data)
  const settingsGovernanceHistory = buildSettingsGovernanceHistory(workspace)
  const rolePermissionHistory = buildRolePermissionHistory(roles)
  const boundaryReviewHistory = buildBoundaryReviewHistory(boundary)
  const businessObjectHistory = buildBusinessObjectHistory(boundary, reports, tower)
  const timeline = buildTimeline({ aiHistory: aiSuggestionHistory, reviewDraftHistory, collaborationDraftHistory, dataAccessHistory, settingsGovernanceHistory, rolePermissionHistory, boundaryReviewHistory, businessObjectHistory, reports })
  const dataLimitations = uniqueBy([
    ...asArray(ai.dataLimitations),
    ...asArray(review.dataLimitations),
    ...asArray(collaboration.dataLimitations),
    ...asArray(data.dataLimitations),
    ...asArray(reports.dataLimitations),
    ...asArray(workspace.dataLimitations),
    ...asArray(roles.dataLimitations),
    ...asArray(boundary.dataLimitations),
    ...(timeline.length ? [] : [{ label: '当前历史范围限制', description: '当前工作区缺少可展示的业务历史。' }]),
  ].map((item) => cleanLimitation(item)), (item) => `${item.label}:${item.description}`).slice(0, 12)
  const sourceSummary = buildSourceSummary({ ai, review, collaboration, data, reports, workspace, roles, boundary, timeline })
  return {
    summary: buildSummary({ timeline, aiHistory: aiSuggestionHistory, reviewDraftHistory, collaborationDraftHistory, dataAccessHistory, settingsGovernanceHistory, rolePermissionHistory, boundaryReviewHistory, businessObjectHistory, dataLimitations }),
    historyProfile,
    timeline,
    aiSuggestionHistory,
    reviewDraftHistory,
    collaborationDraftHistory,
    dataAccessHistory,
    settingsGovernanceHistory,
    rolePermissionHistory,
    boundaryReviewHistory,
    businessObjectHistory,
    sourceSummary,
    dataLimitations,
    generatedAt,
    dataScopeLabel: '当前工作区数据',
  }
}
