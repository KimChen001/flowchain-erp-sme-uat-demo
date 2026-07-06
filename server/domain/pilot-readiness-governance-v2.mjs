import { buildAiSuggestionsWorkbenchV2 } from './ai-suggestions-workbench-v2.mjs'
import { buildAuditIntegrationHistoryV2 } from './audit-integration-history-v2.mjs'
import { buildCollaborationNotificationDraftsV2 } from './collaboration-notification-drafts-v2.mjs'
import { buildDataAccessQualityV2 } from './data-access-quality-v2.mjs'
import { buildOperationsControlTowerV2 } from './operations-control-tower-v2.mjs'
import { buildReportsAnalyticsV2 } from './reports-analytics-v2.mjs'
import { buildReviewFirstActionWorkflowV2 } from './review-first-action-workflow-v2.mjs'
import { buildUserRolePermissionVisibilityV2 } from './user-role-permission-visibility-v2.mjs'
import { buildWorkspaceBoundaryVisibilityV2 } from './workspace-boundary-visibility-v2.mjs'
import { buildWorkspaceSetupConfigV2 } from './workspace-setup-config-v2.mjs'

export const FORBIDDEN_PILOT_READINESS_ACTION_PATTERN = /自动批准|自动下单|正式创建\s*PO|下发\s*PO|发送\s*PO|发布\s*RFQ|邀请供应商|发送邮件|发送|推送|已发送|提交收货|Receive Submit|Submit Receipt|库存过账|Post Invoice|Approve Invoice|Mark as Paid|Payment execution|Export to Accounting|付款|会计过账|修改供应商主数据|更新银行账户|发布风险评级|自动黑名单|自动暂停供应商|自动修复|自动提交导入|自动覆盖数据|自动写入数据库|批量删除|清空数据|sent|delivered|dispatched|webhook|portal invite|保存配置|保存权限|保存边界|保存历史|保存准备度|修改权限|修改历史|修改准备度|删除历史|立即生效|自动应用|分配角色|创建用户|删除用户|禁用用户|创建租户|切换租户|合并租户|迁移数据|同步数据|跨租户查询|写入配置|写入日志|推送日志|导出审计报告|生成正式审计报告|发送审计报告|启用试点|开启试点|上线|部署|生成正式报告|导出正式报告|发送报告/i
export const FORBIDDEN_PILOT_READINESS_TECHNICAL_PATTERN = /JSON|dry-run|tenantId|userId|datasetId|writesDb|writesFiles|DB|database|schema|environment|tool_result|provider|fallback|deterministic|mock|fake|demo|UAT|sample data|demo data|response_card|entityType|documentType|raw enum|payload|webhook|API key|Coupa|RBAC|production|deploy|go-live/i

const GENERATED_AT = '2026-05-25T12:30:00.000Z'
const DATA_SCOPE = '当前工作区数据'
const BOUNDARY_LABELS = ['草稿预览', '人工复核', '不改变业务对象状态', '不形成正式业务处理', '不启用真实外部系统', '数据不搬移', '不外发', '不写库存', '不写财务凭证', '不处理资金', '不改主数据', '不覆盖当前工作区数据', '仅内部留存']
const CORE_MODULES = ['今日工作台', 'AI 建议', '采购管理', '库存管理', '供应商管理', '财务协同', '报表与分析', '数据接入与质量', '行动草稿与人工复核', '协同通知草稿', '系统设置', '角色权限可见性', '工作区边界', '业务审计与历史']
const CORE_OBJECTS = ['PR', 'RFQ', 'PO', 'GRN', 'Invoice', 'Three-way Match', 'Supplier Operational Profile', 'SKU / Inventory', 'AI Suggestion', 'Action Draft', 'Collaboration Draft', 'Workspace Config Draft', 'Permission Review Draft', 'Boundary Review Draft']
const EXCLUDED_ACTIVITIES = ['不形成正式业务处理', '不外发', '不写库存', '不写财务凭证', '不处理资金', '不改主数据', '不覆盖当前工作区数据']
const STATUS = {
  observe: '可进入试点观察',
  review: '需人工复核',
  data: '需补充数据',
  governance: '需治理确认',
}

function asArray(value) { return Array.isArray(value) ? value : [] }
function number(value, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback }
function clamp(value, min = 0, max = 100) { return Math.max(min, Math.min(max, Math.round(number(value)))) }
function average(values) { const nums = values.map((value) => number(value)).filter((value) => Number.isFinite(value)); return nums.length ? clamp(nums.reduce((sum, value) => sum + value, 0) / nums.length) : 0 }
function sanitize(value = '') {
  return String(value ?? '')
    .replace(/自动批准|自动下单|正式创建\s*PO|下发\s*PO|发送\s*PO|发布\s*RFQ|邀请供应商|发送邮件|发送|推送|已发送|提交收货/ig, '正式业务处理')
    .replace(/Receive Submit|Submit Receipt|库存过账|Post Invoice|Approve Invoice|Mark as Paid|Payment execution|Export to Accounting|会计过账|付款/ig, '正式资金或凭证处理')
    .replace(/修改供应商主数据|更新银行账户|发布风险评级|自动黑名单|自动暂停供应商/ig, '供应商资料正式变更')
    .replace(/自动修复|自动提交导入|自动覆盖数据|自动写入数据库|批量删除|清空数据|保存配置|保存权限|保存边界|保存历史|保存准备度|修改权限|修改历史|修改准备度|删除历史|立即生效|自动应用|分配角色|创建用户|删除用户|禁用用户|创建租户|切换租户|合并租户|迁移数据|同步数据|跨租户查询|写入配置|写入日志|推送日志|导出审计报告|生成正式审计报告|发送审计报告|启用试点|开启试点|上线|部署|生成正式报告|导出正式报告|发送报告/ig, '正式变更')
    .replace(/sent|delivered|dispatched|webhook|portal invite/ig, '外部触达动作')
    .replace(/JSON|dry-run|tenantId|userId|datasetId|writesDb|writesFiles|tool_result|provider|fallback|deterministic|mock|fake|demo|UAT|sample data|demo data|response_card|entityType|documentType|raw enum|payload|database|schema|environment|API key|Coupa|RBAC|production|deploy|go-live/ig, DATA_SCOPE)
    .replace(/\bDB\b/g, DATA_SCOPE)
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
function cleanLimitation(item, fallbackLabel = '当前数据范围限制') {
  if (typeof item === 'string') return { label: text(item, fallbackLabel), description: text(item), severity: 'warning' }
  return {
    label: text(item?.label, fallbackLabel),
    description: text(item?.description || item?.consequence || item?.impactSummary, '需要业务负责人结合来源证据复核。'),
    severity: text(item?.severity, 'warning'),
    affectedModules: cleanList(item?.affectedModules || item?.affectedMetrics || item?.missingData),
  }
}
function nav(label, moduleId, entityType = 'pilot_readiness', entityId = '') {
  return {
    label: text(label),
    moduleId: text(moduleId, 'pilot-readiness'),
    entityType: text(entityType, 'pilot_readiness'),
    entityId: text(entityId),
    entityLabel: text(label),
    returnTo: 'pilot-readiness',
    source: 'pilotReadinessGovernance',
    reason: '从试点准备度查看来源模块。',
    returnContext: {
      sourceModule: 'pilot-readiness',
      sourceRoute: 'pilot-readiness',
      sourceLabel: '试点准备度',
      returnLabel: '返回试点准备度',
      originIntent: 'pilotReadinessGovernance',
    },
  }
}
function cleanLinks(links = [], fallback = nav('打开来源模块', 'overview')) {
  const mapped = asArray(links).map((link) => nav(link.label || link.entityLabel || '打开来源模块', link.moduleId || 'overview', link.entityType || 'pilot_readiness', link.entityId || link.id || ''))
  return uniqueBy([...mapped, fallback], (link) => `${link.moduleId}:${link.entityId}:${link.label}`).slice(0, 4)
}
function scoreFrom({ base = 86, blockers = 0, reviews = 0, limitations = 0, evidence = 0 }) {
  return clamp(base + Math.min(8, evidence) - blockers * 10 - reviews - limitations, 45, 96)
}
function statusFor(score, { blockers = 0, limitations = 0, governance = false } = {}) {
  if (governance) return STATUS.governance
  if (blockers > 0) return STATUS.data
  if (score >= 82) return STATUS.observe
  if (score < 72 || limitations > 6) return STATUS.data
  return STATUS.review
}
function deriveContexts(db) {
  const ai = buildAiSuggestionsWorkbenchV2(db) || {}
  const review = buildReviewFirstActionWorkflowV2(db) || {}
  const collaboration = buildCollaborationNotificationDraftsV2(db) || {}
  const data = buildDataAccessQualityV2(db) || {}
  const reports = buildReportsAnalyticsV2(db) || {}
  const tower = buildOperationsControlTowerV2(db) || {}
  const workspace = buildWorkspaceSetupConfigV2(db) || {}
  const roles = buildUserRolePermissionVisibilityV2(db) || {}
  const boundary = buildWorkspaceBoundaryVisibilityV2(db) || {}
  const audit = buildAuditIntegrationHistoryV2(db) || {}
  return { ai, review, collaboration, data, reports, tower, workspace, roles, boundary, audit }
}

function buildReadinessProfile({ workspace, boundary, audit }) {
  const setup = workspace.workspaceProfile || {}
  const profile = boundary.workspaceBoundaryProfile || audit.historyProfile || {}
  return {
    workspaceName: text(profile.workspaceName || setup.workspaceName, '新辰智能制造'),
    businessScopeLabel: text(profile.businessScopeLabel || setup.businessScopeLabel, '进销存与供应链协同'),
    dataScopeLabel: DATA_SCOPE,
    readinessModeLabel: '试点准备度可见',
    reviewModeLabel: '复核优先',
    readinessPrinciples: ['仅展示准备度，不改变业务状态', '试点事项只生成复核草稿', '不形成正式业务处理', '不启用真实外部系统', '数据不搬移', '数据限制集中展示'],
  }
}

function buildPilotScope({ workspace, boundary, audit }) {
  const moduleLabels = uniqueBy([
    ...CORE_MODULES,
    ...asArray(workspace.moduleSettings).map((item) => item.moduleLabel),
    '角色权限可见性',
    '工作区边界',
    '业务审计与历史',
  ].map((label) => ({ label: text(label) })), (item) => item.label).map((item) => item.label)
  const objectLabels = uniqueBy([
    ...CORE_OBJECTS,
    ...asArray(boundary.documentBoundaryMatrix).map((item) => item.objectLabel),
    ...asArray(audit.businessObjectHistory).map((item) => item.objectLabel),
  ].map((label) => ({ label: text(label) })), (item) => item.label).map((item) => item.label)
  return {
    scopeLabel: '当前工作区试点准备度范围',
    includedModules: moduleLabels,
    includedBusinessObjects: objectLabels,
    includedGovernanceAreas: ['数据准备度', 'AI 与复核边界', '协同草稿边界', '工作区配置', '角色权限可见性', '工作区边界', '业务审计与历史'],
    excludedActivities: EXCLUDED_ACTIVITIES,
    readinessSummary: '用于观察当前工作区是否具备试点评估条件，所有事项保持只读和复核优先。',
    navigationLinks: [
      nav('进入今日行动', 'overview'),
      nav('进入 AI 建议', 'overview:ai'),
      nav('进入业务审计与历史', 'audit-history'),
      nav('进入工作区配置', 'settings'),
    ],
  }
}

function moduleRow(input, ctx) {
  const limitations = asArray(input.dataLimitations).map((item) => cleanLimitation(item))
  const blockers = cleanList(input.blockers)
  const observations = cleanList(input.observations)
  const score = clamp(input.readinessScore)
  return {
    id: input.id,
    moduleLabel: text(input.moduleLabel),
    moduleGroup: text(input.moduleGroup, '治理'),
    readinessStatus: text(input.readinessStatus || statusFor(score, { blockers: blockers.length, limitations: limitations.length, governance: input.governance })),
    readinessScore: score,
    readinessEvidence: cleanList(input.readinessEvidence, ['当前工作区来源证据']),
    requiredReview: text(input.requiredReview, score >= 82 && !blockers.length ? '进入试点观察前抽样复核。' : '进入人工复核并确认数据限制。'),
    blockers,
    observations,
    relatedGovernanceAreas: cleanList(input.relatedGovernanceAreas, ['复核优先', '数据限制']),
    navigationLinks: cleanLinks(input.navigationLinks, nav(`进入${input.moduleLabel}`, input.moduleId || input.id)),
    dataLimitations: limitations,
    filterTags: cleanList(input.filterTags, []),
    sourceSignals: ctx ? cleanList(ctx, []) : [],
  }
}
function buildModuleReadinessMatrix(ctx) {
  const { ai, review, collaboration, data, reports, tower, workspace, roles, boundary, audit } = ctx
  const rows = [
    moduleRow({ id: 'overview', moduleId: 'overview', moduleLabel: '今日工作台', moduleGroup: '运营', readinessScore: scoreFrom({ base: 86, reviews: number(tower.summary?.riskCount), limitations: number(tower.summary?.dataGapCount) / 8, evidence: number(tower.summary?.totalOpenItems) / 4 }), readinessEvidence: [`今日事项 ${number(tower.summary?.totalOpenItems)} 项`, `草稿预览 ${number(tower.summary?.draftAvailableCount)} 项`], observations: ['适合观察今日行动和数据限制'], navigationLinks: [nav('进入今日行动', 'overview')], dataLimitations: tower.limitations }, ['Operations Control Tower v2']),
    moduleRow({ id: 'overview-ai', moduleId: 'overview:ai', moduleLabel: 'AI 建议', moduleGroup: '运营', readinessScore: scoreFrom({ base: 88, reviews: number(ai.summary?.highPriorityCount), limitations: number(ai.summary?.dataLimitedCount), evidence: number(ai.summary?.totalSuggestionCount) }), readinessEvidence: [`AI 建议 ${number(ai.summary?.totalSuggestionCount)} 条`, `草稿预览 ${number(ai.summary?.draftAvailableCount)} 条`], blockers: number(ai.summary?.dataLimitedCount) > 8 ? ['AI 数据限制需复核'] : [], observations: ['AI 只解释、组织证据、生成草稿预览'], navigationLinks: [nav('进入 AI 建议', 'overview:ai')], dataLimitations: ai.dataLimitations }, ['AI Suggestions Workbench v2', 'Audit Integration History v2']),
    moduleRow({ id: 'procurement', moduleId: 'procurement', moduleLabel: '采购管理', moduleGroup: '供应链', readinessScore: scoreFrom({ base: 88, reviews: number(reports.summary?.matchVarianceCount), limitations: number(data.summary?.evidenceGapCount) / 2, evidence: number(reports.summary?.totalPoCount) }), readinessEvidence: [`PO ${number(reports.summary?.totalPoCount)} 个`, `PR ${number(reports.summary?.totalPrCount)} 个`, `RFQ ${number(reports.summary?.totalRfqCount)} 个`], observations: ['采购对象证据可进入观察'], navigationLinks: [nav('进入采购管理', 'procurement')], dataLimitations: data.dataLimitations }, ['Reports Analytics v2', 'Data Access Quality v2']),
    moduleRow({ id: 'inventory', moduleId: 'inventory', moduleLabel: '库存管理', moduleGroup: '供应链', readinessScore: scoreFrom({ base: 84, reviews: number(reports.summary?.inventoryRiskCount), limitations: number(collaboration.summary?.inventoryDraftCount) / 2, evidence: number(collaboration.summary?.inventoryDraftCount) }), readinessEvidence: [`库存复核说明 ${number(collaboration.summary?.inventoryDraftCount)} 条`, `库存观察项 ${number(reports.summary?.inventoryRiskCount)} 项`], observations: ['库存风险解释需结合当前库存口径'], navigationLinks: [nav('进入库存管理', 'inventory')], dataLimitations: collaboration.dataLimitations }, ['Collaboration Notification Drafts v2']),
    moduleRow({ id: 'srm', moduleId: 'srm', moduleLabel: '供应商管理', moduleGroup: '供应链', readinessScore: scoreFrom({ base: 84, reviews: number(reports.summary?.supplierRiskCount), limitations: number(collaboration.summary?.supplierDraftCount), evidence: number(collaboration.summary?.supplierDraftCount) + 4 }), readinessEvidence: [`供应商沟通草稿 ${number(collaboration.summary?.supplierDraftCount)} 条`, `供应商观察项 ${number(reports.summary?.supplierRiskCount)} 项`], observations: ['供应商运营档案可进入观察'], navigationLinks: [nav('进入供应商管理', 'srm')], dataLimitations: collaboration.dataLimitations }, ['Reports Analytics v2', 'Collaboration Notification Drafts v2']),
    moduleRow({ id: 'finance', moduleId: 'finance', moduleLabel: '财务协同', moduleGroup: '供应链', readinessScore: scoreFrom({ base: 82, reviews: number(reports.summary?.matchVarianceCount), limitations: number(collaboration.summary?.financeDraftCount), evidence: number(reports.summary?.totalInvoiceCount) + number(reports.summary?.totalGrnCount) }), readinessEvidence: [`Invoice ${number(reports.summary?.totalInvoiceCount)} 个`, `GRN ${number(reports.summary?.totalGrnCount)} 个`, `匹配差异 ${number(reports.summary?.matchVarianceCount)} 项`], observations: ['财务差异仅用于复核说明'], navigationLinks: [nav('进入财务协同', 'finance')], dataLimitations: reports.dataLimitations }, ['Reports Analytics v2']),
    moduleRow({ id: 'reports', moduleId: 'reports', moduleLabel: '报表与分析', moduleGroup: '数据', readinessScore: scoreFrom({ base: 86, reviews: number(reports.summary?.dataQualityIssueCount), limitations: asArray(reports.dataLimitations).length, evidence: asArray(reports.reportInsights).length }), readinessEvidence: [`报表洞察 ${asArray(reports.reportInsights).length} 条`, `数据质量事项 ${number(reports.summary?.dataQualityIssueCount)} 项`], navigationLinks: [nav('进入报表与分析', 'reports')], dataLimitations: reports.dataLimitations }, ['Reports Analytics v2']),
    moduleRow({ id: 'imports', moduleId: 'imports', moduleLabel: '数据接入与质量', moduleGroup: '数据', readinessScore: scoreFrom({ base: 82, blockers: number(data.summary?.criticalIssueCount) ? 1 : 0, reviews: number(data.summary?.warningIssueCount), limitations: asArray(data.dataLimitations).length, evidence: number(data.summary?.mappedFieldCount) }), readinessEvidence: [`字段映射 ${number(data.summary?.mappedFieldCount)} 项`, `质量事项 ${number(data.summary?.criticalIssueCount) + number(data.summary?.warningIssueCount)} 项`], blockers: number(data.summary?.criticalIssueCount) ? ['数据质量阻塞项需复核'] : [], observations: ['字段映射与证据缺口影响 AI、报表和草稿'], navigationLinks: [nav('进入数据接入与质量', 'imports')], dataLimitations: data.dataLimitations }, ['Data Access Quality v2', 'Workspace Boundary Visibility v2']),
    moduleRow({ id: 'review-actions', moduleId: 'review-actions', moduleLabel: '行动草稿与人工复核', moduleGroup: '供应链', readinessScore: scoreFrom({ base: 86, reviews: number(review.summary?.waitingReviewCount), limitations: number(review.summary?.dataLimitedCount) / 8, evidence: number(review.summary?.totalDraftCount) / 4 }), readinessEvidence: [`行动草稿 ${number(review.summary?.totalDraftCount)} 条`, `等待人工复核 ${number(review.summary?.waitingReviewCount)} 条`], observations: ['所有行动保持草稿预览'], navigationLinks: [nav('进入行动草稿与人工复核', 'review-actions')], dataLimitations: review.dataLimitations }, ['Review-first Action Workflow v2', 'Audit Integration History v2']),
    moduleRow({ id: 'collaboration-drafts', moduleId: 'collaboration-drafts', moduleLabel: '协同通知草稿', moduleGroup: '供应链', readinessScore: scoreFrom({ base: 84, reviews: number(collaboration.summary?.readyForReviewCount), limitations: number(collaboration.summary?.dataLimitedCount) / 5, evidence: number(collaboration.summary?.totalDraftCount) / 3 }), readinessEvidence: [`协同草稿 ${number(collaboration.summary?.totalDraftCount)} 条`, `渠道策略 ${asArray(collaboration.channelPolicies).length} 条`], observations: ['草稿预览、人工复核、不外发'], navigationLinks: [nav('进入协同通知草稿', 'collaboration-drafts')], dataLimitations: collaboration.dataLimitations }, ['Collaboration Notification Drafts v2']),
    moduleRow({ id: 'settings', moduleId: 'settings', moduleLabel: '系统设置', moduleGroup: '治理', readinessScore: scoreFrom({ base: 86, reviews: number(workspace.summary?.configDraftCount), limitations: asArray(workspace.dataLimitations).length, evidence: number(workspace.summary?.enabledModuleCount) }), readinessEvidence: [`模块 ${number(workspace.summary?.enabledModuleCount)} 个`, `配置复核草稿 ${number(workspace.summary?.configDraftCount)} 条`], governance: true, navigationLinks: [nav('进入工作区配置', 'settings')], dataLimitations: workspace.dataLimitations }, ['Workspace Setup Config v2']),
    moduleRow({ id: 'settings-roles', moduleId: 'settings:roles', moduleLabel: '角色权限可见性', moduleGroup: '治理', readinessScore: scoreFrom({ base: 84, reviews: number(roles.summary?.permissionDraftCount), limitations: number(roles.summary?.dataLimitedCount), evidence: number(roles.summary?.roleCount) }), readinessEvidence: [`业务角色 ${number(roles.summary?.roleCount)} 个`, `权限复核草稿 ${number(roles.summary?.permissionDraftCount)} 条`], governance: true, blockers: ['角色权限复核项需确认'], navigationLinks: [nav('进入角色权限可见性', 'settings:roles')], dataLimitations: roles.dataLimitations }, ['User Role Permission Visibility v2']),
    moduleRow({ id: 'settings-boundaries', moduleId: 'settings:boundaries', moduleLabel: '工作区边界', moduleGroup: '治理', readinessScore: scoreFrom({ base: 84, reviews: number(boundary.summary?.boundaryDraftCount), limitations: number(boundary.summary?.dataLimitedCount), evidence: number(boundary.summary?.boundaryScopeCount) }), readinessEvidence: [`边界范围 ${number(boundary.summary?.boundaryScopeCount)} 个`, `边界复核草稿 ${number(boundary.summary?.boundaryDraftCount)} 条`], governance: true, blockers: ['工作区边界复核项需确认'], navigationLinks: [nav('进入工作区边界', 'settings:boundaries')], dataLimitations: boundary.dataLimitations }, ['Workspace Boundary Visibility v2']),
    moduleRow({ id: 'audit-history', moduleId: 'audit-history', moduleLabel: '业务审计与历史', moduleGroup: '治理', readinessScore: scoreFrom({ base: 88, reviews: number(audit.summary?.reviewRequiredCount) / 5, limitations: number(audit.summary?.dataLimitedCount) / 8, evidence: number(audit.summary?.totalHistoryCount) / 3 }), readinessEvidence: [`历史记录 ${number(audit.summary?.totalHistoryCount)} 条`, `业务对象历史 ${number(audit.summary?.businessObjectHistoryCount)} 项`], observations: ['历史覆盖可用于试点复核'], navigationLinks: [nav('进入业务审计与历史', 'audit-history')], dataLimitations: audit.dataLimitations }, ['Audit Integration History v2']),
  ]
  return rows
}

function assessment(input) {
  const limitations = asArray(input.dataLimitations).map((item) => cleanLimitation(item))
  return {
    id: input.id,
    assessmentLabel: text(input.assessmentLabel),
    sourceModule: text(input.sourceModule),
    readinessScore: clamp(input.readinessScore),
    coveredObjects: cleanList(input.coveredObjects),
    dataQualitySignals: cleanList(input.dataQualitySignals),
    evidenceGaps: cleanList(input.evidenceGaps, ['需人工确认来源证据']),
    affectedModules: cleanList(input.affectedModules),
    requiredReview: text(input.requiredReview, '进入人工复核。'),
    navigationLinks: cleanLinks(input.navigationLinks),
    dataLimitations: limitations,
  }
}
function buildDataReadinessAssessment({ data, boundary, audit }) {
  return [
    assessment({ id: 'field-mapping', assessmentLabel: '字段映射准备度', sourceModule: '数据接入与质量', readinessScore: scoreFrom({ base: 82, blockers: number(data.summary?.unmappedFieldCount) ? 1 : 0, evidence: number(data.summary?.mappedFieldCount) }), coveredObjects: ['字段映射', 'PR', 'PO', 'Invoice'], dataQualitySignals: [`已映射字段 ${number(data.summary?.mappedFieldCount)} 项`, `未映射字段 ${number(data.summary?.unmappedFieldCount)} 项`], evidenceGaps: asArray(data.fieldMappings).filter((item) => !item.isMapped).map((item) => item.fieldLabel), affectedModules: ['AI 建议', '报表与分析', '行动草稿与人工复核'], requiredReview: '复核未映射字段和影响模块。', navigationLinks: [nav('进入数据接入与质量', 'imports')], dataLimitations: data.dataLimitations }),
    assessment({ id: 'quality-issues', assessmentLabel: '数据质量事项准备度', sourceModule: '数据接入与质量', readinessScore: scoreFrom({ base: 80, blockers: number(data.summary?.criticalIssueCount) ? 1 : 0, reviews: number(data.summary?.warningIssueCount), evidence: number(data.summary?.sourceCount) }), coveredObjects: ['数据质量事项', '证据缺口'], dataQualitySignals: [`阻塞项 ${number(data.summary?.criticalIssueCount)} 项`, `需复核 ${number(data.summary?.warningIssueCount)} 项`], evidenceGaps: asArray(data.qualityIssues).map((item) => item.title), affectedModules: ['今日工作台', 'AI 建议', '报表与分析'], requiredReview: '数据负责人确认阻塞项和观察项。', navigationLinks: [nav('进入数据接入与质量', 'imports')], dataLimitations: data.dataLimitations }),
    assessment({ id: 'procurement-evidence', assessmentLabel: '采购证据准备度', sourceModule: '业务审计与历史', readinessScore: scoreFrom({ base: 86, limitations: asArray(audit.dataLimitations).length / 3, evidence: number(audit.summary?.businessObjectHistoryCount) }), coveredObjects: ['PR', 'RFQ', 'PO'], dataQualitySignals: [`业务对象历史 ${number(audit.summary?.businessObjectHistoryCount)} 项`], evidenceGaps: ['采购对象证据需抽样复核'], affectedModules: ['采购管理', 'AI 建议', '行动草稿与人工复核'], navigationLinks: [nav('进入业务审计与历史', 'audit-history'), nav('进入采购管理', 'procurement')], dataLimitations: audit.dataLimitations }),
    assessment({ id: 'receiving-invoice', assessmentLabel: '收货 / 发票关联准备度', sourceModule: '工作区边界', readinessScore: scoreFrom({ base: 84, limitations: asArray(boundary.dataLimitations).length / 3, evidence: number(boundary.summary?.documentBoundaryCount) }), coveredObjects: ['GRN', 'Invoice', 'Three-way Match'], dataQualitySignals: ['收货、发票和匹配证据边界可见'], evidenceGaps: ['差异证据需财务负责人复核'], affectedModules: ['采购管理', '库存管理', '财务协同'], navigationLinks: [nav('进入工作区边界', 'settings:boundaries'), nav('进入财务协同', 'finance')], dataLimitations: boundary.dataLimitations }),
    assessment({ id: 'supplier-profile', assessmentLabel: '供应商资料准备度', sourceModule: '工作区边界', readinessScore: scoreFrom({ base: 84, limitations: asArray(boundary.dataLimitations).length / 3, evidence: number(boundary.summary?.dataOwnershipGroupCount) }), coveredObjects: ['Supplier Operational Profile', 'RFQ', 'PO'], dataQualitySignals: ['供应商资料归属和边界可见'], evidenceGaps: ['供应商资料完整性需复核'], affectedModules: ['供应商管理', '采购管理', '协同通知草稿'], navigationLinks: [nav('进入供应商管理', 'srm'), nav('进入工作区边界', 'settings:boundaries')], dataLimitations: boundary.dataLimitations }),
    assessment({ id: 'ai-report-draft-limits', assessmentLabel: 'AI / 报表 / 草稿数据限制准备度', sourceModule: '数据接入与质量', readinessScore: scoreFrom({ base: 82, blockers: number(data.summary?.criticalIssueCount) ? 1 : 0, reviews: number(data.summary?.affectedControlTowerItemCount) / 10, limitations: asArray(data.dataLimitations).length, evidence: number(data.summary?.affectedAiInsightCount) + 4 }), coveredObjects: ['AI Suggestion', 'Action Draft', 'Report Insight'], dataQualitySignals: ['数据限制已集中展示'], evidenceGaps: ['受影响洞察需逐项复核'], affectedModules: ['AI 建议', '报表与分析', '行动草稿与人工复核'], navigationLinks: [nav('进入数据接入与质量', 'imports'), nav('进入 AI 建议', 'overview:ai')], dataLimitations: data.dataLimitations }),
  ]
}

function aiAssessment(input) {
  return {
    id: input.id,
    assessmentLabel: text(input.assessmentLabel),
    sourceModule: text(input.sourceModule, 'AI 建议'),
    readinessScore: clamp(input.readinessScore),
    supportedQuestions: cleanList(input.supportedQuestions),
    evidenceCoverage: cleanList(input.evidenceCoverage),
    reviewBoundary: text(input.reviewBoundary, 'AI 只解释、组织证据、生成草稿预览，需人工复核。'),
    draftBoundary: text(input.draftBoundary, '只生成草稿预览，不形成正式业务处理。'),
    dataLimitations: asArray(input.dataLimitations).map((item) => cleanLimitation(item)),
    navigationLinks: cleanLinks(input.navigationLinks, nav('进入 AI 建议', 'overview:ai')),
  }
}
function buildAiReadinessAssessment({ ai, audit, review }) {
  const base = scoreFrom({ base: 88, reviews: number(ai.summary?.highPriorityCount), limitations: number(ai.summary?.dataLimitedCount), evidence: number(ai.summary?.totalSuggestionCount) })
  const commonLimits = uniqueBy([...asArray(ai.dataLimitations), ...asArray(audit.dataLimitations)], (item) => item.label || item.description)
  const rows = [
    ['today-explain', '今日事项解释', ['今日行动优先级如何形成？', '哪些事项需要人工复核？'], ['今日事项', '行动草稿', '数据限制'], nav('进入今日行动', 'overview')],
    ['supplier-risk-explain', '供应商风险解释', ['供应商观察项来自哪些证据？'], ['供应商运营档案', '采购证据', '协同草稿'], nav('进入供应商管理', 'srm')],
    ['inventory-risk-explain', '库存风险解释', ['库存风险和补货证据是否充足？'], ['SKU / Inventory', '库存复核说明'], nav('进入库存管理', 'inventory')],
    ['po-grn-invoice-evidence', 'PO / GRN / Invoice 证据解释', ['PO、GRN、Invoice 证据如何串联？'], ['PO', 'GRN', 'Invoice', 'Three-way Match'], nav('进入采购管理', 'procurement')],
    ['data-limit-explain', '数据限制解释', ['哪些数据限制影响 AI、报表和草稿？'], ['数据质量事项', '证据缺口', '业务审计历史'], nav('进入数据接入与质量', 'imports')],
    ['draft-preview', '草稿预览生成', ['哪些建议可生成草稿预览？'], [`草稿预览 ${number(ai.summary?.draftAvailableCount)} 条`, `行动草稿 ${number(review.summary?.totalDraftCount)} 条`], nav('进入行动草稿与人工复核', 'review-actions')],
    ['human-review-nav', '人工复核跳转', ['如何从建议回到人工复核？'], ['来源模块跳转', '返回试点准备度', '人工复核'], nav('进入行动草稿与人工复核', 'review-actions')],
  ]
  return rows.map(([id, label, questions, evidence, link], index) => aiAssessment({ id, assessmentLabel: label, readinessScore: base - (index % 3) * 2, supportedQuestions: questions, evidenceCoverage: evidence, reviewBoundary: 'AI 只解释、组织证据、生成草稿预览，所有事项进入人工复核。', draftBoundary: '不形成正式业务处理，不外发，不写库存 / 财务凭证 / 主数据。', navigationLinks: [link], dataLimitations: commonLimits }))
}

function buildReviewWorkflowReadiness({ review, workspace, audit }) {
  const score = scoreFrom({ base: 86, reviews: number(review.summary?.waitingReviewCount), limitations: number(review.summary?.dataLimitedCount) / 8, evidence: number(review.summary?.totalDraftCount) / 4 })
  const common = uniqueBy([...asArray(review.dataLimitations), ...asArray(workspace.dataLimitations), ...asArray(audit.dataLimitations)], (item) => item.label || item.description)
  return [
    ['action-review', '行动草稿复核', '行动草稿与人工复核', ['PR 草稿', 'RFQ 草稿', 'PO 异常复核草稿'], nav('进入行动草稿与人工复核', 'review-actions')],
    ['config-review', '配置复核草稿', '工作区配置', ['配置复核草稿', '数据质量设置复核草稿'], nav('进入工作区配置', 'settings')],
    ['permission-review', '权限复核草稿', '角色权限可见性', ['权限复核草稿', '职责范围复核'], nav('进入角色权限可见性', 'settings:roles')],
    ['boundary-review', '边界复核草稿', '工作区边界', ['边界复核草稿', '数据归属复核'], nav('进入工作区边界', 'settings:boundaries')],
    ['collaboration-review', '协同通知草稿复核', '协同通知草稿', ['内部协同备注', '供应商沟通草稿', '财务复核说明'], nav('进入协同通知草稿', 'collaboration-drafts')],
  ].map(([id, workflowLabel, sourceModule, coveredDraftTypes, link], index) => ({
    id,
    workflowLabel: text(workflowLabel),
    sourceModule: text(sourceModule),
    readinessScore: clamp(score - index),
    coveredDraftTypes: cleanList(coveredDraftTypes),
    reviewStates: ['草稿预览', '等待人工复核', '需补充信息', '仅内部留存'],
    allowedTransitions: ['进入人工复核', '标记仅内部留存', '返回来源模块', '补充证据后复核'],
    boundaryLabels: BOUNDARY_LABELS,
    navigationLinks: cleanLinks([link]),
    dataLimitations: common.map((item) => cleanLimitation(item)),
  }))
}

function buildCollaborationReadiness({ collaboration, audit }) {
  const score = scoreFrom({ base: 84, reviews: number(collaboration.summary?.readyForReviewCount), limitations: number(collaboration.summary?.dataLimitedCount) / 5, evidence: number(collaboration.summary?.totalDraftCount) / 3 })
  const common = uniqueBy([...asArray(collaboration.dataLimitations), ...asArray(audit.dataLimitations)], (item) => item.label || item.description)
  return [
    ['internal-note', '内部协同备注', ['内部复核人', '采购负责人'], nav('进入协同通知草稿', 'collaboration-drafts')],
    ['supplier-communication', '供应商沟通草稿', ['采购负责人', '供应商管理负责人'], nav('进入供应商管理', 'srm')],
    ['finance-review-note', '财务复核说明', ['财务复核负责人'], nav('进入财务协同', 'finance')],
    ['data-quality-note', '数据质量说明', ['数据负责人'], nav('进入数据接入与质量', 'imports')],
    ['receiving-exception-note', '收货异常说明', ['收货协同负责人'], nav('进入采购管理', 'procurement')],
    ['inventory-review-note', '库存复核说明', ['库存与计划负责人'], nav('进入库存管理', 'inventory')],
    ['report-insight-note', '报表洞察复核说明', ['管理层只读观察者'], nav('进入报表与分析', 'reports')],
  ].map(([id, collaborationLabel, audienceGroups, link], index) => ({
    id,
    collaborationLabel: text(collaborationLabel),
    sourceModule: '协同通知草稿',
    readinessScore: clamp(score - (index % 2) * 2),
    supportedDraftTypes: cleanList([collaborationLabel, '草稿预览']),
    audienceGroups: cleanList(audienceGroups),
    channelPolicies: cleanList(asArray(collaboration.channelPolicies).map((item) => item.label), ['人工复核后内部留存']),
    reviewBoundary: '草稿预览、人工复核、不外发、不形成正式业务处理。',
    navigationLinks: cleanLinks([link]),
    dataLimitations: common.map((item) => cleanLimitation(item)),
  }))
}

function buildGovernanceReadiness({ workspace, roles, boundary }) {
  const rows = [
    ['workspace-config', '工作区配置准备度', '工作区配置', '配置与模块', [`模块 ${number(workspace.summary?.enabledModuleCount)} 个`, `配置复核草稿 ${number(workspace.summary?.configDraftCount)} 条`], '建议后续管理员确认', nav('进入工作区配置', 'settings'), workspace.dataLimitations],
    ['role-permission', '角色权限可见性准备度', '角色权限可见性', '角色权限', [`业务角色 ${number(roles.summary?.roleCount)} 个`, `权限复核草稿 ${number(roles.summary?.permissionDraftCount)} 条`], '权限边界需治理确认', nav('进入角色权限可见性', 'settings:roles'), roles.dataLimitations],
    ['workspace-boundary', '工作区边界准备度', '工作区边界', '工作区边界', [`边界范围 ${number(boundary.summary?.boundaryScopeCount)} 个`, `边界复核草稿 ${number(boundary.summary?.boundaryDraftCount)} 条`], '边界范围需治理确认', nav('进入工作区边界', 'settings:boundaries'), boundary.dataLimitations],
    ['numbering-rules', '编号规则准备度', '工作区配置', '编号规则', [`编号规则 ${asArray(workspace.numberingRules).length} 条`], '编号规则进入复核清单', nav('进入工作区配置', 'settings'), workspace.dataLimitations],
    ['ai-boundary', 'AI 边界准备度', '工作区配置', 'AI 边界', [`AI 边界 ${number(workspace.summary?.aiBoundaryCount)} 条`, `边界信号 ${number(boundary.summary?.aiBoundarySignalCount)} 条`], 'AI 只解释、组织证据、生成草稿预览', nav('进入 AI 建议', 'overview:ai'), boundary.dataLimitations],
    ['collaboration-policy', '协同草稿策略准备度', '工作区配置', '协同草稿策略', [`协同策略 ${number(workspace.summary?.collaborationPolicyCount)} 条`, `协同边界 ${number(boundary.summary?.collaborationBoundaryCount)} 条`], '草稿预览、人工复核、不外发', nav('进入协同通知草稿', 'collaboration-drafts'), workspace.dataLimitations],
    ['data-quality-setting', '数据质量设置准备度', '工作区配置', '数据质量设置', [`数据质量设置 ${asArray(workspace.dataQualitySettings).length} 项`, `边界信号 ${number(boundary.summary?.dataQualityBoundaryIssueCount)} 项`], '数据质量事项需进入复核清单', nav('进入数据接入与质量', 'imports'), boundary.dataLimitations],
  ]
  return rows.map(([id, governanceLabel, sourceModule, governanceArea, readinessEvidence, blockerSummary, link, limitations], index) => {
    const score = scoreFrom({ base: 86, reviews: index + 1, limitations: asArray(limitations).length, evidence: cleanList(readinessEvidence).length * 2 })
    return {
      id,
      governanceLabel: text(governanceLabel),
      sourceModule: text(sourceModule),
      readinessScore: score,
      governanceArea: text(governanceArea),
      readinessEvidence: cleanList(readinessEvidence),
      requiredReview: score >= 82 ? '建议后续管理员确认。' : '需治理确认后再进入观察。',
      blockerSummary: text(blockerSummary),
      navigationLinks: cleanLinks([link]),
      dataLimitations: asArray(limitations).map((item) => cleanLimitation(item)),
    }
  })
}

function buildAuditHistoryReadiness({ audit }) {
  const score = scoreFrom({ base: 88, reviews: number(audit.summary?.reviewRequiredCount) / 5, limitations: number(audit.summary?.dataLimitedCount) / 8, evidence: number(audit.summary?.totalHistoryCount) / 4 })
  return [
    ['ai-history', 'AI 建议历史', number(audit.summary?.aiHistoryCount), nav('进入业务审计与历史', 'audit-history')],
    ['review-draft-history', '草稿复核历史', number(audit.summary?.actionDraftHistoryCount), nav('进入业务审计与历史', 'audit-history')],
    ['collaboration-history', '协同草稿历史', number(audit.summary?.collaborationHistoryCount), nav('进入业务审计与历史', 'audit-history')],
    ['data-access-history', '数据接入历史', number(audit.summary?.dataQualityHistoryCount), nav('进入业务审计与历史', 'audit-history')],
    ['settings-history', '设置与权限历史', number(audit.summary?.setupGovernanceHistoryCount) + number(audit.summary?.rolePermissionHistoryCount), nav('进入业务审计与历史', 'audit-history')],
    ['boundary-history', '工作区边界历史', number(audit.summary?.boundaryHistoryCount), nav('进入业务审计与历史', 'audit-history')],
    ['business-object-history', '业务对象历史', number(audit.summary?.businessObjectHistoryCount), nav('进入业务审计与历史', 'audit-history')],
  ].map(([id, historyLabel, count, link], index) => ({
    id,
    historyLabel: text(historyLabel),
    sourceModule: '业务审计与历史',
    readinessScore: clamp(score - (index % 3) * 2),
    coveredHistoryTypes: [text(historyLabel), `覆盖 ${number(count)} 项`],
    timelineCoverage: `历史时间线覆盖 ${number(audit.summary?.totalHistoryCount)} 条记录`,
    navigationCoverage: '来源模块跳转保留返回试点准备度上下文。',
    dataLimitationCoverage: `数据限制 ${number(audit.summary?.dataLimitedCount)} 项集中展示`,
    reviewBoundary: '历史只读，复核优先，不改变业务对象状态。',
    navigationLinks: cleanLinks([link]),
    dataLimitations: asArray(audit.dataLimitations).map((item) => cleanLimitation(item)),
  }))
}

function buildRiskAndBlockerItems({ data, ai, review, collaboration, roles, boundary, audit, reports }) {
  return [
    ['data-quality-blocker', '数据质量阻塞项', '阻塞项', '数据准备度', '数据接入与质量', `阻塞项 ${number(data.summary?.criticalIssueCount)} 项影响 AI、报表和草稿。`, '数据负责人复核质量事项和证据缺口。', '数据负责人', '试点观察前', nav('进入数据接入与质量', 'imports'), data.dataLimitations],
    ['ai-data-limit-review', 'AI 数据限制复核项', '需复核', 'AI 与复核准备度', 'AI 建议', `AI 数据限制 ${number(ai.summary?.dataLimitedCount)} 项需说明。`, '确认 AI 只解释、组织证据、生成草稿预览。', '数据负责人', '本周复核', nav('进入 AI 建议', 'overview:ai'), ai.dataLimitations],
    ['action-draft-review', '行动草稿待复核项', '需复核', '复核链路准备度', '行动草稿与人工复核', `等待人工复核 ${number(review.summary?.waitingReviewCount)} 条。`, '业务负责人确认草稿预览和缺失信息。', '采购负责人', '本周复核', nav('进入行动草稿与人工复核', 'review-actions'), review.dataLimitations],
    ['collaboration-boundary-review', '协同草稿边界复核项', '需复核', '协同准备度', '协同通知草稿', `协同草稿 ${number(collaboration.summary?.totalDraftCount)} 条保持草稿预览。`, '确认不外发和仅内部留存边界。', '采购负责人', '本周复核', nav('进入协同通知草稿', 'collaboration-drafts'), collaboration.dataLimitations],
    ['role-permission-review', '角色权限复核项', '需复核', '治理准备度', '角色权限可见性', `权限复核草稿 ${number(roles.summary?.permissionDraftCount)} 条。`, '系统配置复核人确认角色和职责包。', '系统配置复核人', '治理确认前', nav('进入角色权限可见性', 'settings:roles'), roles.dataLimitations],
    ['workspace-boundary-review', '工作区边界复核项', '需复核', '治理准备度', '工作区边界', `边界复核草稿 ${number(boundary.summary?.boundaryDraftCount)} 条。`, '确认当前工作区边界和数据归属。', '系统配置复核人', '治理确认前', nav('进入工作区边界', 'settings:boundaries'), boundary.dataLimitations],
    ['audit-coverage-observation', '审计历史覆盖观察项', '观察项', '审计历史准备度', '业务审计与历史', `历史覆盖 ${number(audit.summary?.totalHistoryCount)} 条。`, '抽样复核来源模块跳转和数据限制。', '管理层只读观察者', '试点观察期', nav('进入业务审计与历史', 'audit-history'), audit.dataLimitations],
    ['supplier-risk-observation', '供应商风险观察项', '观察项', '供应商准备度', '供应商管理', `供应商观察项 ${number(reports.summary?.supplierRiskCount)} 项。`, '供应商管理负责人复核运营档案证据。', '供应商管理负责人', '试点观察期', nav('进入供应商管理', 'srm'), reports.dataLimitations],
    ['finance-variance-observation', '财务差异观察项', '观察项', '财务协同准备度', '财务协同', `匹配差异 ${number(reports.summary?.matchVarianceCount)} 项。`, '财务复核负责人确认差异说明。', '财务复核负责人', '试点观察期', nav('进入财务协同', 'finance'), reports.dataLimitations],
  ].map(([id, itemLabel, severity, readinessArea, sourceModule, impactSummary, requiredAction, ownerRole, dueLabel, link, limitations]) => ({
    id,
    itemLabel: text(itemLabel),
    severity: text(severity),
    readinessArea: text(readinessArea),
    sourceModule: text(sourceModule),
    impactSummary: text(impactSummary),
    requiredAction: text(requiredAction),
    ownerRole: text(ownerRole),
    dueLabel: text(dueLabel),
    navigationLinks: cleanLinks([link]),
    dataLimitations: asArray(limitations).map((item) => cleanLimitation(item)),
  }))
}

function buildPilotReviewChecklist({ data, ai, review, collaboration, roles, boundary, audit, reports }) {
  const rows = [
    ['overview-scope', '今日工作台范围确认', '试点范围', STATUS.observe, '管理层只读观察者', [`今日事项 ${number(buildOperationsControlTowerV2({}).summary?.totalOpenItems || 0)} 项`], '确认今日行动只读观察范围。', nav('进入今日行动', 'overview'), []],
    ['ai-boundary', 'AI 建议边界确认', 'AI 与复核准备度', STATUS.review, '数据负责人', [`AI 建议 ${number(ai.summary?.totalSuggestionCount)} 条`], '确认 AI 只解释、组织证据、生成草稿预览。', nav('进入 AI 建议', 'overview:ai'), ai.dataLimitations],
    ['data-quality', '数据质量确认', '数据准备度', number(data.summary?.criticalIssueCount) ? STATUS.data : STATUS.review, '数据负责人', [`质量事项 ${number(data.summary?.criticalIssueCount) + number(data.summary?.warningIssueCount)} 项`], '复核字段映射、证据缺口和数据限制。', nav('进入数据接入与质量', 'imports'), data.dataLimitations],
    ['review-chain', '行动草稿复核链路确认', '复核链路准备度', STATUS.review, '采购负责人', [`行动草稿 ${number(review.summary?.totalDraftCount)} 条`], '确认草稿预览和人工复核链路。', nav('进入行动草稿与人工复核', 'review-actions'), review.dataLimitations],
    ['collaboration-boundary', '协同通知草稿边界确认', '协同准备度', STATUS.review, '采购负责人', [`协同草稿 ${number(collaboration.summary?.totalDraftCount)} 条`], '确认不外发和内部留存边界。', nav('进入协同通知草稿', 'collaboration-drafts'), collaboration.dataLimitations],
    ['role-permission', '角色权限可见性确认', '治理准备度', STATUS.governance, '系统配置复核人', [`业务角色 ${number(roles.summary?.roleCount)} 个`], '确认角色、职责包和单据权限可见性。', nav('进入角色权限可见性', 'settings:roles'), roles.dataLimitations],
    ['workspace-boundary', '工作区边界确认', '治理准备度', STATUS.governance, '系统配置复核人', [`边界范围 ${number(boundary.summary?.boundaryScopeCount)} 个`], '确认当前工作区边界和数据归属。', nav('进入工作区边界', 'settings:boundaries'), boundary.dataLimitations],
    ['audit-history', '业务审计与历史确认', '审计历史准备度', STATUS.review, '系统配置复核人', [`历史记录 ${number(audit.summary?.totalHistoryCount)} 条`], '抽样复核历史覆盖、来源跳转和数据限制。', nav('进入业务审计与历史', 'audit-history'), audit.dataLimitations],
    ['procurement-evidence', '采购对象证据确认', '采购准备度', STATUS.review, '采购负责人', [`PO ${number(reports.summary?.totalPoCount)} 个`], '确认 PR、RFQ、PO、GRN、Invoice 证据。', nav('进入采购管理', 'procurement'), reports.dataLimitations],
    ['supplier-profile', '供应商运营档案确认', '供应商准备度', STATUS.observe, '供应商管理负责人', [`供应商观察项 ${number(reports.summary?.supplierRiskCount)} 项`], '确认供应商运营档案和沟通草稿边界。', nav('进入供应商管理', 'srm'), reports.dataLimitations],
    ['finance-evidence', '财务协同证据确认', '财务协同准备度', STATUS.observe, '财务复核负责人', [`匹配差异 ${number(reports.summary?.matchVarianceCount)} 项`], '确认发票、匹配差异和财务复核说明。', nav('进入财务协同', 'finance'), reports.dataLimitations],
  ]
  return rows.map(([id, checklistLabel, readinessArea, status, requiredReviewerRole, evidence, nextReviewStep, link, limitations]) => ({
    id,
    checklistLabel: text(checklistLabel),
    readinessArea: text(readinessArea),
    status: text(status),
    requiredReviewerRole: text(requiredReviewerRole),
    evidence: cleanList(evidence),
    nextReviewStep: text(nextReviewStep),
    navigationLinks: cleanLinks([link]),
    dataLimitations: asArray(limitations).map((item) => cleanLimitation(item)),
  }))
}

function pilotDraft(id, title, sourceModule, readinessArea, ownerRole, conclusion, evidence, link, limitations = []) {
  return {
    id,
    title: text(title),
    draftType: '试点复核草稿',
    sourceModule: text(sourceModule),
    readinessArea: text(readinessArea),
    ownerRole: text(ownerRole),
    status: '草稿预览',
    priority: '需复核',
    conclusion: text(conclusion),
    proposedPilotReviewPreview: '整理当前工作区准备度证据、数据限制和后续复核步骤，仅供人工复核。',
    keyEvidence: cleanList(evidence),
    reviewChecklist: ['确认来源证据', '确认数据限制', '确认只读边界', '确认后续复核角色'],
    missingInformation: ['需后续管理员确认', '需来源模块负责人抽样复核'],
    boundaryLabels: BOUNDARY_LABELS,
    navigationLinks: cleanLinks([link]),
    dataLimitations: asArray(limitations).map((item) => cleanLimitation(item)),
    previewOnly: true,
    reviewRequired: true,
    requiresHumanReview: true,
  }
}
function buildPilotReviewDrafts(ctx) {
  const { data, ai, review, collaboration, roles, boundary, audit } = ctx
  return [
    pilotDraft('pilot-scope-draft', '试点范围复核草稿', '试点准备度', '试点范围', '系统配置复核人', '当前工作区具备试点准备度观察基础，但需确认边界和数据限制。', CORE_MODULES.slice(0, 6), nav('进入工作区配置', 'settings'), boundary.dataLimitations),
    pilotDraft('data-readiness-draft', '数据准备度复核草稿', '数据接入与质量', '数据准备度', '数据负责人', '数据质量事项和证据缺口需要在试点观察前复核。', [`质量事项 ${number(data.summary?.criticalIssueCount) + number(data.summary?.warningIssueCount)} 项`, `字段映射 ${number(data.summary?.mappedFieldCount)} 项`], nav('进入数据接入与质量', 'imports'), data.dataLimitations),
    pilotDraft('ai-boundary-draft', 'AI 边界复核草稿', 'AI 建议', 'AI 与复核准备度', '数据负责人', 'AI 仅用于解释、组织证据和生成草稿预览。', [`AI 建议 ${number(ai.summary?.totalSuggestionCount)} 条`, `数据限制 ${number(ai.summary?.dataLimitedCount)} 项`], nav('进入 AI 建议', 'overview:ai'), ai.dataLimitations),
    pilotDraft('review-workflow-draft', '草稿与人工复核链路复核草稿', '行动草稿与人工复核', '复核链路准备度', '采购负责人', '行动草稿保持草稿预览和人工复核链路。', [`行动草稿 ${number(review.summary?.totalDraftCount)} 条`, `等待人工复核 ${number(review.summary?.waitingReviewCount)} 条`], nav('进入行动草稿与人工复核', 'review-actions'), review.dataLimitations),
    pilotDraft('collaboration-boundary-draft', '协同通知边界复核草稿', '协同通知草稿', '协同准备度', '采购负责人', '协同通知保持草稿预览、人工复核和不外发边界。', [`协同草稿 ${number(collaboration.summary?.totalDraftCount)} 条`, `渠道策略 ${asArray(collaboration.channelPolicies).length} 条`], nav('进入协同通知草稿', 'collaboration-drafts'), collaboration.dataLimitations),
    pilotDraft('role-boundary-draft', '角色权限与工作区边界复核草稿', '角色权限可见性', '治理准备度', '系统配置复核人', '角色权限和工作区边界需治理确认。', [`业务角色 ${number(roles.summary?.roleCount)} 个`, `边界范围 ${number(boundary.summary?.boundaryScopeCount)} 个`], nav('进入角色权限可见性', 'settings:roles'), roles.dataLimitations),
    pilotDraft('audit-coverage-draft', '审计历史覆盖复核草稿', '业务审计与历史', '审计历史准备度', '系统配置复核人', '业务审计与历史可用于试点复核抽样。', [`历史记录 ${number(audit.summary?.totalHistoryCount)} 条`, `业务对象历史 ${number(audit.summary?.businessObjectHistoryCount)} 项`], nav('进入业务审计与历史', 'audit-history'), audit.dataLimitations),
  ]
}

function buildSourceSummary(ctx) {
  const rows = [
    ['AI 建议', 'AI Suggestions Workbench v2', number(ctx.ai.summary?.totalSuggestionCount), nav('进入 AI 建议', 'overview:ai')],
    ['行动草稿与人工复核', 'Review-first Action Workflow v2', number(ctx.review.summary?.totalDraftCount), nav('进入行动草稿与人工复核', 'review-actions')],
    ['协同通知草稿', 'Collaboration Notification Drafts v2', number(ctx.collaboration.summary?.totalDraftCount), nav('进入协同通知草稿', 'collaboration-drafts')],
    ['数据接入与质量', 'Data Access Quality v2', number(ctx.data.summary?.criticalIssueCount) + number(ctx.data.summary?.warningIssueCount), nav('进入数据接入与质量', 'imports')],
    ['报表与分析', 'Reports Analytics v2', asArray(ctx.reports.reportInsights).length, nav('进入报表与分析', 'reports')],
    ['今日工作台', 'Operations Control Tower v2', number(ctx.tower.summary?.totalOpenItems), nav('进入今日行动', 'overview')],
    ['工作区配置', 'Workspace Setup Config v2', number(ctx.workspace.summary?.enabledModuleCount), nav('进入工作区配置', 'settings')],
    ['角色权限可见性', 'User Role Permission Visibility v2', number(ctx.roles.summary?.roleCount), nav('进入角色权限可见性', 'settings:roles')],
    ['工作区边界', 'Workspace Boundary Visibility v2', number(ctx.boundary.summary?.boundaryScopeCount), nav('进入工作区边界', 'settings:boundaries')],
    ['业务审计与历史', 'Audit Integration History v2', number(ctx.audit.summary?.totalHistoryCount), nav('进入业务审计与历史', 'audit-history')],
  ]
  return rows.map(([sourceModule, sourceLabel, signalCount, link]) => ({
    sourceModule: text(sourceModule),
    sourceLabel: text(sourceLabel),
    signalCount: number(signalCount),
    navigationLinks: cleanLinks([link]),
  }))
}

function collectDataLimitations(ctx) {
  return uniqueBy([
    ...asArray(ctx.data.dataLimitations),
    ...asArray(ctx.ai.dataLimitations),
    ...asArray(ctx.review.dataLimitations),
    ...asArray(ctx.collaboration.dataLimitations),
    ...asArray(ctx.workspace.dataLimitations),
    ...asArray(ctx.roles.dataLimitations),
    ...asArray(ctx.boundary.dataLimitations),
    ...asArray(ctx.audit.dataLimitations),
    ...asArray(ctx.reports.dataLimitations),
  ].map((item) => cleanLimitation(item)), (item) => item.label).slice(0, 14)
}

function buildSummary({ moduleReadinessMatrix, dataReadinessAssessment, aiReadinessAssessment, reviewWorkflowReadiness, collaborationReadiness, governanceReadiness, auditHistoryReadiness, riskAndBlockerItems, pilotReviewDrafts, dataLimitations }) {
  const readyModuleCount = moduleReadinessMatrix.filter((item) => item.readinessStatus === STATUS.observe).length
  const reviewNeededModuleCount = moduleReadinessMatrix.length - readyModuleCount
  const dataReadinessScore = average(dataReadinessAssessment.map((item) => item.readinessScore))
  const aiReadinessScore = average(aiReadinessAssessment.map((item) => item.readinessScore))
  const governanceReadinessScore = average(governanceReadiness.map((item) => item.readinessScore))
  const reviewWorkflowReadinessScore = average(reviewWorkflowReadiness.map((item) => item.readinessScore))
  const collaborationReadinessScore = average(collaborationReadiness.map((item) => item.readinessScore))
  const auditHistoryReadinessScore = average(auditHistoryReadiness.map((item) => item.readinessScore))
  const overallReadinessScore = average([dataReadinessScore, aiReadinessScore, governanceReadinessScore, reviewWorkflowReadinessScore, collaborationReadinessScore, auditHistoryReadinessScore, average(moduleReadinessMatrix.map((item) => item.readinessScore))])
  return {
    overallReadinessScore,
    readyModuleCount,
    reviewNeededModuleCount,
    blockedItemCount: riskAndBlockerItems.filter((item) => item.severity === '阻塞项').length,
    observationItemCount: riskAndBlockerItems.filter((item) => item.severity === '观察项').length,
    dataReadinessScore,
    aiReadinessScore,
    governanceReadinessScore,
    reviewWorkflowReadinessScore,
    collaborationReadinessScore,
    auditHistoryReadinessScore,
    pilotDraftCount: pilotReviewDrafts.length,
    dataLimitedCount: dataLimitations.length,
    readinessLabel: overallReadinessScore >= 82 ? '可进入试点观察' : overallReadinessScore >= 70 ? '需人工复核' : '需补充数据',
  }
}

export function buildPilotReadinessGovernanceV2(db = {}) {
  const ctx = deriveContexts(db)
  const readinessProfile = buildReadinessProfile(ctx)
  const pilotScope = buildPilotScope(ctx)
  const moduleReadinessMatrix = buildModuleReadinessMatrix(ctx)
  const dataReadinessAssessment = buildDataReadinessAssessment(ctx)
  const aiReadinessAssessment = buildAiReadinessAssessment(ctx)
  const reviewWorkflowReadiness = buildReviewWorkflowReadiness(ctx)
  const collaborationReadiness = buildCollaborationReadiness(ctx)
  const governanceReadiness = buildGovernanceReadiness(ctx)
  const auditHistoryReadiness = buildAuditHistoryReadiness(ctx)
  const riskAndBlockerItems = buildRiskAndBlockerItems(ctx)
  const pilotReviewChecklist = buildPilotReviewChecklist(ctx)
  const pilotReviewDrafts = buildPilotReviewDrafts(ctx)
  const sourceSummary = buildSourceSummary(ctx)
  const dataLimitations = collectDataLimitations(ctx)
  const summary = buildSummary({ moduleReadinessMatrix, dataReadinessAssessment, aiReadinessAssessment, reviewWorkflowReadiness, collaborationReadiness, governanceReadiness, auditHistoryReadiness, riskAndBlockerItems, pilotReviewDrafts, dataLimitations })

  return {
    summary,
    readinessProfile,
    pilotScope,
    moduleReadinessMatrix,
    dataReadinessAssessment,
    aiReadinessAssessment,
    reviewWorkflowReadiness,
    collaborationReadiness,
    governanceReadiness,
    auditHistoryReadiness,
    riskAndBlockerItems,
    pilotReviewChecklist,
    pilotReviewDrafts,
    sourceSummary,
    dataLimitations: dataLimitations.length ? dataLimitations : [cleanLimitation('当前数据范围限制', '当前工作区缺少完整试点准备度来源证据。')],
    generatedAt: GENERATED_AT,
    dataScopeLabel: DATA_SCOPE,
  }
}
