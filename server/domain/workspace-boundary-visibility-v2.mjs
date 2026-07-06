import { buildAiSuggestionsWorkbenchV2 } from './ai-suggestions-workbench-v2.mjs'
import { buildCollaborationNotificationDraftsV2 } from './collaboration-notification-drafts-v2.mjs'
import { buildDataAccessQualityV2 } from './data-access-quality-v2.mjs'
import { buildOperationsControlTowerV2 } from './operations-control-tower-v2.mjs'
import { buildReportsAnalyticsV2 } from './reports-analytics-v2.mjs'
import { buildReviewFirstActionWorkflowV2 } from './review-first-action-workflow-v2.mjs'
import { buildUserRolePermissionVisibilityV2 } from './user-role-permission-visibility-v2.mjs'
import { buildWorkspaceSetupConfigV2 } from './workspace-setup-config-v2.mjs'

export const FORBIDDEN_WORKSPACE_BOUNDARY_ACTION_PATTERN = /自动批准|自动下单|正式创建\s*PO|下发\s*PO|发送\s*PO|发布\s*RFQ|邀请供应商|发送邮件|发送|推送|已发送|提交收货|Receive Submit|Submit Receipt|库存过账|Post Invoice|Approve Invoice|Mark as Paid|Payment execution|Export to Accounting|付款|会计过账|修改供应商主数据|更新银行账户|发布风险评级|自动黑名单|自动暂停供应商|自动修复|自动提交导入|自动覆盖数据|自动写入数据库|批量删除|清空数据|sent|delivered|dispatched|webhook|portal invite|保存配置|保存权限|保存边界|修改权限|立即生效|自动应用|分配角色|创建用户|删除用户|禁用用户|创建租户|切换租户|合并租户|迁移数据|同步数据|跨租户查询|写入配置/i
export const FORBIDDEN_WORKSPACE_BOUNDARY_TECHNICAL_PATTERN = /JSON|dry-run|tenantId|userId|datasetId|writesDb|writesFiles|DB|database|schema|environment|tool_result|provider|fallback|deterministic|mock|fake|demo|UAT|sample data|demo data|response_card|entityType|documentType|raw enum|payload|webhook|API key|Coupa|RBAC/i

const GENERATED_AT = '2026-05-25T11:50:00.000Z'
const BOUNDARIES = ['边界草稿预览', '人工复核', '不创建或切换工作区', '数据不搬移', '不形成正式业务处理', '不覆盖当前工作区数据', '仅内部留存']

function asArray(value) { return Array.isArray(value) ? value : [] }
function number(value, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback }
function sanitize(value = '') {
  return String(value ?? '')
    .replace(/自动批准|自动下单|正式创建\s*PO|下发\s*PO|发送\s*PO|发布\s*RFQ|邀请供应商|发送邮件|发送|推送|已发送|提交收货/ig, '形成正式业务处理')
    .replace(/Receive Submit|Submit Receipt|库存过账|Post Invoice|Approve Invoice|Mark as Paid|Payment execution|Export to Accounting|会计过账|付款/ig, '正式资金或凭证处理')
    .replace(/修改供应商主数据|更新银行账户|发布风险评级|自动黑名单|自动暂停供应商/ig, '供应商资料正式变更')
    .replace(/自动修复|自动提交导入|自动覆盖数据|自动写入数据库|批量删除|清空数据|保存配置|保存权限|保存边界|修改权限|立即生效|自动应用|分配角色|创建用户|删除用户|禁用用户|创建租户|切换租户|合并租户|迁移数据|同步数据|跨租户查询|写入配置/ig, '边界或配置正式变更')
    .replace(/sent|delivered|dispatched|webhook|portal invite/ig, '外部触达动作')
    .replace(/JSON|dry-run|tenantId|userId|datasetId|writesDb|writesFiles|tool_result|provider|fallback|deterministic|mock|fake|demo|UAT|sample data|demo data|response_card|entityType|documentType|raw enum|payload|database|schema|environment|API key|Coupa|RBAC/ig, '当前工作区数据')
    .replace(/\bDB\b/g, '当前工作区数据')
}
function text(value, fallback = '') { return sanitize(String(value ?? '').trim() || fallback) }
function cleanList(items = []) { return asArray(items).map((item) => text(item)).filter(Boolean) }
function unique(items = []) { return Array.from(new Set(cleanList(items))) }
function uniqueBy(items = [], keyOf = (item) => item.id || item.label) {
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
function nav(label, moduleId, entityType = 'workspace_boundary', entityId = '') {
  return { label: text(label), moduleId, entityType, entityId: text(entityId), entityLabel: text(label), returnTo: 'settings:boundaries', source: 'workspaceBoundaryVisibility', reason: '从工作区边界查看来源。' }
}
function cleanLimitation(item, fallbackLabel = '当前工作区边界限制') {
  if (typeof item === 'string') return { label: text(item, fallbackLabel), description: text(item), severity: 'warning' }
  return {
    label: text(item?.label, fallbackLabel),
    description: text(item?.description || item?.consequence || item?.impactSummary, '需要结合当前工作区数据人工复核。'),
    severity: text(item?.severity, 'warning'),
    affectedModules: cleanList(item?.affectedModules || item?.affectedMetrics || item?.missingData),
  }
}

function buildProfile(workspace) {
  const profile = workspace.workspaceProfile || {}
  return {
    workspaceName: text(profile.workspaceName, '新辰智能制造'),
    businessScopeLabel: text(profile.businessScopeLabel, '进销存与供应链协同'),
    operatingModeLabel: text(profile.operatingModeLabel, '复核优先 · 草稿预览'),
    dataScopeLabel: '当前工作区数据',
    boundaryStatusLabel: '边界状态可见',
    reviewModeLabel: '边界变更仅生成复核草稿',
    boundaryPrinciples: BOUNDARIES,
  }
}

function boundaryScope(input) {
  return {
    id: input.id,
    scopeLabel: input.scopeLabel,
    scopeGroup: input.scopeGroup,
    businessPurpose: input.businessPurpose,
    includedModules: input.includedModules,
    includedObjects: input.includedObjects,
    allowedUse: input.allowedUse,
    boundarySummary: input.boundarySummary || '仅展示当前工作区边界状态，边界变更进入复核草稿。',
    reviewRequired: true,
    previewOnly: true,
    navigationLinks: input.navigationLinks,
    dataLimitations: input.dataLimitations || [],
  }
}
function buildBoundaryScopes({ workspace, roles, ai, collaboration, data, reports }) {
  const limitations = asArray(data.dataLimitations).map(cleanLimitation).slice(0, 2)
  return [
    boundaryScope({ id: 'procurement-boundary', scopeLabel: '采购业务边界', scopeGroup: '供应链', businessPurpose: '限定 PR、RFQ、PO、GRN、Invoice 和 Match 证据在当前工作区内解释。', includedModules: ['采购管理', '行动草稿与人工复核', 'AI 建议', '报表与分析'], includedObjects: ['PR', 'RFQ', 'PO', 'GRN', 'Invoice', 'Three-way Match'], allowedUse: '证据查看、AI 解释、草稿预览、人工复核。', navigationLinks: [nav('进入采购管理', 'procurement'), nav('进入行动草稿与人工复核', 'review-actions')] }),
    boundaryScope({ id: 'inventory-boundary', scopeLabel: '库存业务边界', scopeGroup: '供应链', businessPurpose: '限定 SKU、Inventory、ATP 和补货证据用于库存风险判断。', includedModules: ['库存管理', 'AI 建议', '报表与分析'], includedObjects: ['SKU / Inventory', 'ATP', '补货证据'], allowedUse: '库存风险解释和复核草稿。', navigationLinks: [nav('进入库存管理', 'inventory'), nav('进入 AI 建议', 'overview:ai')] }),
    boundaryScope({ id: 'supplier-boundary', scopeLabel: '供应商业务边界', scopeGroup: '供应链', businessPurpose: '限定供应商运营档案、RFQ、PO、GRN、Invoice 证据在供应商复核中使用。', includedModules: ['供应商管理', '协同通知草稿', '报表与分析'], includedObjects: ['Supplier Operational Profile', 'RFQ', 'PO', 'GRN', 'Invoice'], allowedUse: '供应商风险解释和协同草稿预览。', navigationLinks: [nav('进入供应商管理', 'srm'), nav('进入协同通知草稿', 'collaboration-drafts')] }),
    boundaryScope({ id: 'finance-boundary', scopeLabel: '财务协同边界', scopeGroup: '供应链', businessPurpose: '限定 Invoice、Three-way Match、variance 和 received-not-invoiced 证据用于财务复核。', includedModules: ['财务协同', '报表与分析', '行动草稿与人工复核'], includedObjects: ['Invoice', 'Three-way Match', 'variance evidence'], allowedUse: '差异解释和财务复核说明草稿。', navigationLinks: [nav('进入财务协同', 'finance')] }),
    boundaryScope({ id: 'data-quality-boundary', scopeLabel: '数据接入质量边界', scopeGroup: '数据', businessPurpose: '限定字段映射、数据质量事项和证据缺口对 AI、报表和草稿的影响。', includedModules: ['数据接入与质量'], includedObjects: ['field mapping', 'data quality issue', 'evidence gap'], allowedUse: '数据补齐复核和影响范围说明。', navigationLinks: [nav('进入数据接入与质量', 'imports')], dataLimitations: limitations }),
    boundaryScope({ id: 'ai-boundary', scopeLabel: 'AI 建议边界', scopeGroup: '运营', businessPurpose: '限定 AI 建议基于当前工作区数据、证据和数据限制生成。', includedModules: ['AI 建议'], includedObjects: ['AI Suggestion', 'evidence', 'review draft'], allowedUse: `解释、证据整理、草稿预览；AI 建议 ${number(ai.summary?.totalSuggestionCount)} 条。`, navigationLinks: [nav('进入 AI 建议', 'overview:ai')] }),
    boundaryScope({ id: 'collaboration-boundary', scopeLabel: '协同通知草稿边界', scopeGroup: '供应链', businessPurpose: '限定内部备注、供应商沟通草稿、财务复核说明和数据质量说明保持草稿预览。', includedModules: ['协同通知草稿'], includedObjects: ['internal note', 'supplier communication draft', 'finance review note', 'data completion note'], allowedUse: `协同草稿预览和人工复核；草稿 ${number(collaboration.summary?.totalDraftCount)} 条。`, navigationLinks: [nav('进入协同通知草稿', 'collaboration-drafts')] }),
    boundaryScope({ id: 'role-permission-boundary', scopeLabel: '角色权限边界', scopeGroup: '设置', businessPurpose: '限定角色、职责包、单据权限和复核链路只展示可见性状态。', includedModules: ['角色权限可见性'], includedObjects: ['role profile', 'permission bundle', 'document permission', 'review chain'], allowedUse: `权限状态查看和复核草稿；业务角色 ${number(roles.summary?.roleCount)} 个。`, navigationLinks: [nav('进入角色权限可见性', 'settings:roles')] }),
    boundaryScope({ id: 'workspace-config-boundary', scopeLabel: '工作区配置边界', scopeGroup: '设置', businessPurpose: '限定模块设置、编号规则、AI 边界和协同草稿策略只展示配置状态。', includedModules: ['系统设置'], includedObjects: ['module settings', 'numbering rules', 'AI boundary', 'collaboration policy'], allowedUse: `配置状态查看和配置复核草稿；模块 ${number(workspace.summary?.enabledModuleCount)} 个。`, navigationLinks: [nav('进入工作区配置', 'settings')] }),
  ]
}

function buildDataOwnershipGroups() {
  return [
    ['procurement-owner', '采购数据归属', '采购负责人 / 采购专员', ['PR', 'RFQ', 'PO', '采购证据'], ['采购管理', '行动草稿与人工复核'], '采购链路证据和草稿预览范围。', ['复核 PR / RFQ / PO 证据边界'], [nav('进入采购管理', 'procurement')]],
    ['inventory-owner', '收货与库存数据归属', '收货协同负责人 / 库存与计划负责人', ['GRN', 'SKU', '库存风险', '补货证据'], ['库存管理', '采购管理'], '收货与库存影响范围。', ['复核收货异常和库存风险边界'], [nav('进入库存管理', 'inventory')]],
    ['supplier-owner', '供应商数据归属', '供应商管理负责人', ['Supplier Operational Profile', '供应风险', '供应商沟通草稿'], ['供应商管理', '协同通知草稿'], '供应商风险和沟通草稿范围。', ['复核供应商证据和沟通边界'], [nav('进入供应商管理', 'srm')]],
    ['finance-owner', '财务复核数据归属', '财务复核负责人', ['Invoice', 'Three-way Match', 'variance evidence'], ['财务协同', '报表与分析'], '财务差异证据和说明草稿范围。', ['复核发票和三单匹配边界'], [nav('进入财务协同', 'finance')]],
    ['data-owner', '数据质量归属', '数据负责人', ['字段映射', '质量事项', '数据补齐草稿'], ['数据接入与质量'], '数据质量和补齐复核范围。', ['复核数据质量边界'], [nav('进入数据接入与质量', 'imports')]],
    ['config-owner', '配置与权限边界归属', '系统配置复核人', ['工作区配置', '角色权限', '边界复核草稿'], ['系统设置'], '配置、权限和边界可见性范围。', ['复核配置和权限边界'], [nav('进入工作区配置', 'settings'), nav('进入角色权限可见性', 'settings:roles')]],
    ['executive-owner', '管理层观察范围', '管理层只读观察者', ['今日行动', 'AI 建议', '报表洞察', '关键数据限制'], ['今日工作台', '报表与分析'], '只读观察汇总范围。', ['观察关键风险和数据限制'], [nav('进入报表与分析', 'reports')]],
  ].map(([id, ownerLabel, ownerRole, ownedObjects, ownedModules, stewardshipScope, reviewResponsibilities, navigationLinks]) => ({
    id, ownerLabel, ownerRole, ownedObjects, ownedModules, stewardshipScope, reviewResponsibilities, boundarySummary: '仅展示数据归属范围，边界变化进入复核草稿。', navigationLinks, dataLimitations: [],
  }))
}

function buildModuleBoundaryMatrix({ workspace, roles }) {
  const extra = [
    { id: 'settings', moduleLabel: '系统设置', navigationLinks: [nav('进入工作区配置', 'settings')] },
    { id: 'settings:roles', moduleLabel: '角色权限可见性', navigationLinks: [nav('进入角色权限可见性', 'settings:roles')] },
  ]
  return uniqueBy([...asArray(workspace.moduleSettings), ...extra], (item) => item.id).map((module) => ({
    id: module.id,
    moduleLabel: module.moduleLabel,
    moduleId: module.id,
    boundaryGroup: module.moduleGroup || '设置',
    dataUsed: unique(module.keyObjects || ['当前工作区数据']),
    producedInsights: unique(module.connectedInsights || ['边界状态']),
    reviewOutputs: module.moduleLabel === '角色权限可见性' ? ['权限复核草稿'] : module.moduleLabel === '系统设置' ? ['配置复核草稿', '边界复核草稿'] : ['草稿预览', '人工复核'],
    downstreamConsumers: unique(['AI 建议', '报表与分析', '行动草稿与人工复核'].filter(Boolean)),
    boundarySummary: '仅使用当前工作区数据，不创建或切换工作区。',
    navigationLinks: module.navigationLinks || [nav(`进入${module.moduleLabel}`, module.id)],
  })).filter((row) => row.moduleLabel !== '销售需求' || roles.summary?.roleCount)
}

function buildDocumentBoundaryMatrix(roles) {
  const rows = [
    ['PR', '采购', '采购管理', ['AI 建议', '行动草稿与人工复核'], '采购负责人', '采购需求证据', '解释优先级和数据限制', 'PR 优先级复核', '内部复核备注', '不形成正式采购处理', [nav('进入采购管理', 'procurement')]],
    ['RFQ', '寻源', '采购管理', ['供应商管理', '行动草稿与人工复核'], '寻源负责人', '报价证据', '解释报价节奏', 'RFQ 授标建议复核', '供应商沟通草稿', '不开放寻源正式发布', [nav('进入采购管理', 'procurement')]],
    ['Quote Comparison', '寻源', '采购管理', ['报表与分析'], '寻源负责人', '报价对比证据', '解释价格与交期差异', '授标建议复核', '内部协同备注', '不形成授标正式处理', [nav('进入采购管理', 'procurement')]],
    ['Award Recommendation Draft', '寻源', '行动草稿与人工复核', ['采购管理'], '采购负责人', '授标建议证据', '生成草稿预览', '人工复核', '内部留存说明', '不形成正式业务处理', [nav('进入行动草稿与人工复核', 'review-actions')]],
    ['PO', '采购', '采购管理', ['库存管理', '财务协同'], '采购负责人', '订单与到货证据', '解释延期和风险', 'PO 到货异常复核', '供应商沟通草稿', '不形成正式采购处理', [nav('进入采购管理', 'procurement')]],
    ['GRN', '收货', '采购管理', ['库存管理', '财务协同'], '收货协同负责人', '收货证据', '解释收货异常', 'GRN 收货异常复核', '收货异常说明', '不写库存', [nav('进入库存管理', 'inventory')]],
    ['Invoice', '财务', '财务协同', ['采购管理', '报表与分析'], '财务复核负责人', '发票证据', '解释差异', 'Invoice 差异复核', '财务复核说明', '不写财务凭证', [nav('进入财务协同', 'finance')]],
    ['Three-way Match', '财务', '财务协同', ['采购管理', '报表与分析'], '财务复核负责人', '三单匹配证据', '解释匹配差异', '差异复核', '财务差异说明', '不处理资金', [nav('进入财务协同', 'finance')]],
    ['Supplier Operational Profile', '供应商', '供应商管理', ['采购管理', '报表与分析'], '供应商管理负责人', '供应商运营证据', '解释供应风险', 'Supplier 风险复核', '供应商沟通草稿', '不改主数据', [nav('进入供应商管理', 'srm')]],
    ['SKU / Inventory', '库存', '库存管理', ['采购管理', 'AI 建议'], '库存与计划负责人', '库存风险证据', '解释补货风险', '库存风险复核', '库存复核说明', '不写库存', [nav('进入库存管理', 'inventory')]],
    ['Data Access Issue', '数据', '数据接入与质量', ['AI 建议', '报表与分析'], '数据负责人', '数据质量证据', '解释影响范围', 'Data Quality 补齐复核', '数据质量说明', '不覆盖当前工作区数据', [nav('进入数据接入与质量', 'imports')]],
    ['AI Suggestion', '运营', 'AI 建议', ['行动草稿与人工复核'], '数据负责人', 'AI 证据与限制', '解释和草稿预览', '人工复核', '协同草稿来源', '不形成正式业务处理', [nav('进入 AI 建议', 'overview:ai')]],
    ['Action Draft', '复核', '行动草稿与人工复核', ['采购管理', '财务协同'], '系统配置复核人', '草稿证据', '汇总证据', '人工复核', '内部留存', '不形成正式业务处理', [nav('进入行动草稿与人工复核', 'review-actions')]],
    ['Collaboration Draft', '协同', '协同通知草稿', ['供应商管理', '财务协同'], '采购负责人', '协同草稿证据', '解释协同原因', '人工复核', '草稿预览', '不外发', [nav('进入协同通知草稿', 'collaboration-drafts')]],
    ['Workspace Config Draft', '设置', '系统设置', ['角色权限可见性'], '系统配置复核人', '配置证据', '解释配置影响', '配置复核', '内部留存', '不形成配置正式变更', [nav('进入工作区配置', 'settings')]],
    ['Permission Review Draft', '设置', '角色权限可见性', ['系统设置'], '系统配置复核人', '权限证据', '解释权限影响', '权限复核', '内部留存', '不直接改变用户权限', [nav('进入角色权限可见性', 'settings:roles')]],
    ['Boundary Review Draft', '设置', '工作区边界', ['系统设置'], '系统配置复核人', '边界证据', '解释边界影响', '边界复核', '内部留存', '不创建或切换工作区', [nav('进入工作区边界', 'settings:boundaries')]],
  ]
  return rows.map(([objectLabel, objectGroup, sourceModule, relatedModules, boundaryOwnerRole, evidenceUse, aiUse, reviewUse, collaborationUse, restrictedUseSummary, navigationLinks], index) => ({
    id: `document-boundary-${index + 1}`,
    objectLabel, objectGroup, sourceModule, relatedModules, boundaryOwnerRole, evidenceUse, aiUse, reviewUse, collaborationUse, restrictedUseSummary, navigationLinks,
    roleSignal: number(roles.summary?.roleCount),
  }))
}

function buildAiBoundaryAwareness(ai) {
  return [
    ['current-workspace', 'AI 建议只基于当前工作区数据', 'AI 建议', '解释、证据整理、草稿预览', ['当前工作区数据', '来源对象', '关键证据'], '显示数据限制并进入人工复核', '不跨工作区推断'],
    ['evidence-required', 'AI 解释必须显示关键证据', 'AI 建议', '业务解释和风险说明', ['PR / RFQ / PO / GRN / Invoice 证据'], '证据不足时提示人工复核', '不输出无证据结论'],
    ['limitations-required', 'AI 建议必须显示数据限制', 'AI 建议', '展示影响范围和限制', ['数据质量事项', '证据缺口'], '限制影响草稿优先级', '不隐藏数据限制'],
    ['draft-review', 'AI 草稿只进入人工复核', '行动草稿与人工复核', '生成草稿预览', ['草稿内容', '来源证据'], '必须人工复核', '不形成正式业务处理'],
    ['no-business-effect', 'AI 不形成正式业务处理', 'AI 建议', '解释和建议下一步', ['边界标签'], '复核优先', '不写库存、不写财务凭证'],
    ['no-cross-workspace', 'AI 不跨工作区推断', 'AI 建议', '当前工作区内解释', ['当前工作区数据'], '边界复核', '不跨工作区解释或合并'],
    ['no-collab-touch', 'AI 不外发协同通知', '协同通知草稿', '生成协同草稿预览', ['协同草稿证据'], '草稿预览和人工复核', '不外发'],
    ['master-inventory-finance', 'AI 不改主数据 / 不写库存 / 不写财务凭证', '系统设置', '边界说明', ['主数据、库存、财务证据'], '配置复核', '不改主数据、不写库存、不写财务凭证'],
  ].map(([id, signalLabel, sourceModule, allowedAiUse, requiredEvidence, reviewBoundary, restrictedUseSummary]) => ({
    id, signalLabel, sourceModule, allowedAiUse, requiredEvidence, dataLimitations: asArray(ai.dataLimitations).map(cleanLimitation), reviewBoundary, restrictedUseSummary, navigationLinks: [nav('进入 AI 建议', 'overview:ai')],
  }))
}

function buildCollaborationBoundaryPolicies(collaboration) {
  return asArray(collaboration.channelPolicies).map((policy, index) => ({
    id: `collaboration-boundary-${index + 1}`,
    policyLabel: policy.label,
    collaborationType: policy.channelType,
    sourceChannelPolicy: policy.label,
    allowedUse: policy.allowedUse,
    boundarySummary: policy.boundarySummary,
    reviewRequired: true,
    previewOnly: true,
    navigationLinks: [nav('进入协同通知草稿', 'collaboration-drafts')],
  }))
}

function buildRoleBoundaryVisibility(roles) {
  return asArray(roles.roleProfiles).map((role) => ({
    id: `role-boundary-${role.id}`,
    roleLabel: role.roleLabel,
    roleGroup: role.roleGroup,
    visibleBoundaryScopes: unique(role.dataScopes.concat(role.visibleModules).slice(0, 6)),
    documentBoundaryAccess: unique(role.visibleObjects),
    dataScopeAccess: unique(role.dataScopes),
    reviewBoundaryScopes: unique(role.reviewScopes),
    restrictedBoundarySummary: role.restrictedScopes.join('；'),
    navigationLinks: role.navigationLinks?.length ? role.navigationLinks : [nav('进入角色权限可见性', 'settings:roles')],
  }))
}

function buildDataQualityBoundarySignals(data) {
  const issues = asArray(data.qualityIssues).slice(0, 5).map((issue, index) => ({
    id: `quality-boundary-issue-${index + 1}`,
    signalLabel: text(issue.title, '数据质量边界信号'),
    sourceModule: '数据接入与质量',
    affectedBoundaryScopes: ['数据接入质量边界', issue.affectedModule || 'AI 建议边界'],
    affectedObjects: unique([issue.businessObjectLabel, issue.fieldLabel, issue.businessObjectType]),
    impactSummary: text(issue.businessImpact || issue.explanation, '影响当前工作区边界判断。'),
    suggestedReview: text(issue.suggestedFix, '进入数据负责人复核。'),
    navigationLinks: issue.navigationLinks?.length ? issue.navigationLinks : [nav('进入数据接入与质量', 'imports')],
    dataLimitations: asArray(issue.dataLimitations).map(cleanLimitation),
  }))
  return [
    {
      id: 'field-mapping-boundary',
      signalLabel: '字段映射边界',
      sourceModule: '数据接入与质量',
      affectedBoundaryScopes: ['数据接入质量边界', 'AI 建议边界', '报表边界'],
      affectedObjects: ['字段映射', 'Data Access Issue'],
      impactSummary: `未映射字段 ${number(data.summary?.unmappedFieldCount)} 项会影响边界判断。`,
      suggestedReview: '复核字段映射和影响模块。',
      navigationLinks: [nav('进入数据接入与质量', 'imports')],
      dataLimitations: asArray(data.dataLimitations).map(cleanLimitation),
    },
    ...issues,
    {
      id: 'ai-report-collaboration-impact',
      signalLabel: 'AI 建议受影响 / 报表洞察受影响 / 协同草稿受影响',
      sourceModule: '数据接入与质量',
      affectedBoundaryScopes: ['AI 建议边界', '协同通知草稿边界', '数据接入质量边界'],
      affectedObjects: ['AI Suggestion', 'Collaboration Draft', 'Report Insight'],
      impactSummary: '数据质量事项会影响 AI、报表和协同草稿的证据解释。',
      suggestedReview: '进入数据负责人复核并保留数据限制说明。',
      navigationLinks: [nav('进入数据接入与质量', 'imports')],
      dataLimitations: asArray(data.dataLimitations).map(cleanLimitation),
    },
  ]
}

function boundaryDraft(input, index) {
  return {
    id: `boundary-review-draft-${index}`,
    title: input.title,
    draftType: 'boundary_review',
    sourceModule: input.sourceModule,
    targetBoundaryScope: input.targetBoundaryScope,
    targetOwnerRole: input.targetOwnerRole,
    status: '边界草稿预览',
    priority: input.priority || 'medium',
    conclusion: input.conclusion,
    proposedBoundaryPreview: input.proposedBoundaryPreview,
    keyEvidence: input.keyEvidence,
    reviewChecklist: input.reviewChecklist || ['确认边界范围', '确认数据归属', '确认是否仅内部留存'],
    missingInformation: input.missingInformation || ['需后续管理员确认'],
    boundaryLabels: BOUNDARIES,
    navigationLinks: input.navigationLinks,
    dataLimitations: input.dataLimitations || [],
    previewOnly: true,
    reviewRequired: true,
    requiresHumanReview: true,
  }
}
function buildBoundaryReviewDrafts({ workspace, roles, review, collaboration, data, ai }) {
  return [
    boundaryDraft({ title: '采购业务边界复核草稿', sourceModule: '采购管理', targetBoundaryScope: '采购业务边界', targetOwnerRole: '采购负责人', conclusion: '采购链路边界覆盖 PR、RFQ、PO、GRN 和 Invoice 证据。', proposedBoundaryPreview: '保留当前采购边界状态，边界变化进入人工复核。', keyEvidence: [`行动草稿 ${number(review.summary?.totalDraftCount)} 条`, `AI 建议 ${number(ai.summary?.totalSuggestionCount)} 条`], navigationLinks: [nav('进入采购管理', 'procurement'), nav('进入行动草稿与人工复核', 'review-actions')] }, 1),
    boundaryDraft({ title: '数据归属边界复核草稿', sourceModule: '数据接入与质量', targetBoundaryScope: '数据接入质量边界', targetOwnerRole: '数据负责人', priority: data.summary?.criticalIssueCount ? 'high' : 'medium', conclusion: '数据质量事项影响工作区边界判断。', proposedBoundaryPreview: '保留数据归属说明和数据限制，进入数据负责人复核。', keyEvidence: [`质量事项 ${number(data.summary?.criticalIssueCount) + number(data.summary?.warningIssueCount)} 项`, `字段映射 ${number(data.summary?.mappedFieldCount)} 项`], navigationLinks: [nav('进入数据接入与质量', 'imports')], dataLimitations: asArray(data.dataLimitations).map(cleanLimitation) }, 2),
    boundaryDraft({ title: 'AI 使用边界复核草稿', sourceModule: 'AI 建议', targetBoundaryScope: 'AI 建议边界', targetOwnerRole: '数据负责人', conclusion: 'AI 使用边界限定为解释、证据整理和草稿预览。', proposedBoundaryPreview: 'AI 只基于当前工作区数据，并显示证据与数据限制。', keyEvidence: [`AI 建议 ${number(ai.summary?.totalSuggestionCount)} 条`, '证据与数据限制'], navigationLinks: [nav('进入 AI 建议', 'overview:ai')] }, 3),
    boundaryDraft({ title: '协同通知边界复核草稿', sourceModule: '协同通知草稿', targetBoundaryScope: '协同通知草稿边界', targetOwnerRole: '采购负责人', conclusion: '协同通知保持草稿预览和人工复核边界。', proposedBoundaryPreview: '不外发，保留内部留存与人工复核。', keyEvidence: [`协同草稿 ${number(collaboration.summary?.totalDraftCount)} 条`, `策略 ${asArray(collaboration.channelPolicies).length} 条`], navigationLinks: [nav('进入协同通知草稿', 'collaboration-drafts')] }, 4),
    boundaryDraft({ title: '角色权限边界复核草稿', sourceModule: '角色权限可见性', targetBoundaryScope: '角色权限边界', targetOwnerRole: '系统配置复核人', conclusion: '角色权限边界仅展示权限状态。', proposedBoundaryPreview: '权限边界变化只生成复核草稿，不直接改变用户权限。', keyEvidence: [`业务角色 ${number(roles.summary?.roleCount)} 个`, `权限草稿 ${number(roles.summary?.permissionDraftCount)} 条`], navigationLinks: [nav('进入角色权限可见性', 'settings:roles')] }, 5),
    boundaryDraft({ title: '工作区配置边界复核草稿', sourceModule: '系统设置', targetBoundaryScope: '工作区配置边界', targetOwnerRole: '系统配置复核人', conclusion: '工作区配置边界覆盖模块、编号规则、AI 边界和协同策略。', proposedBoundaryPreview: '配置边界变化只生成复核草稿，不创建或切换工作区。', keyEvidence: [`配置草稿 ${number(workspace.summary?.configDraftCount)} 条`, `模块 ${number(workspace.summary?.enabledModuleCount)} 个`], navigationLinks: [nav('进入工作区配置', 'settings')] }, 6),
  ]
}

function buildSourceSummary({ workspace, roles, data, ai, collaboration, reports, review, tower }) {
  return [
    { sourceModule: '系统设置', sourceLabel: '工作区配置', signalCount: number(workspace.summary?.enabledModuleCount), navigationLinks: [nav('进入工作区配置', 'settings')] },
    { sourceModule: '角色权限可见性', sourceLabel: '角色权限边界', signalCount: number(roles.summary?.roleCount), navigationLinks: [nav('进入角色权限可见性', 'settings:roles')] },
    { sourceModule: '数据接入与质量', sourceLabel: '数据质量边界', signalCount: number(data.summary?.criticalIssueCount) + number(data.summary?.warningIssueCount), navigationLinks: [nav('进入数据接入与质量', 'imports')] },
    { sourceModule: 'AI 建议', sourceLabel: 'AI 边界信号', signalCount: number(ai.summary?.totalSuggestionCount), navigationLinks: [nav('进入 AI 建议', 'overview:ai')] },
    { sourceModule: '协同通知草稿', sourceLabel: '协同边界', signalCount: number(collaboration.summary?.totalDraftCount), navigationLinks: [nav('进入协同通知草稿', 'collaboration-drafts')] },
    { sourceModule: '报表与分析', sourceLabel: '报表边界', signalCount: asArray(reports.reportInsights).length, navigationLinks: [nav('进入报表与分析', 'reports')] },
    { sourceModule: '行动草稿与人工复核', sourceLabel: '复核边界', signalCount: number(review.summary?.totalDraftCount), navigationLinks: [nav('进入行动草稿与人工复核', 'review-actions')] },
    { sourceModule: '今日工作台', sourceLabel: '优先事项边界', signalCount: number(tower.summary?.totalOpenItems), navigationLinks: [nav('进入今日行动', 'overview')] },
  ]
}

export function buildWorkspaceBoundaryVisibilityV2(db = {}) {
  const workspace = buildWorkspaceSetupConfigV2(db) || {}
  const roles = buildUserRolePermissionVisibilityV2(db) || {}
  const review = buildReviewFirstActionWorkflowV2(db) || {}
  const collaboration = buildCollaborationNotificationDraftsV2(db) || {}
  const ai = buildAiSuggestionsWorkbenchV2(db) || {}
  const data = buildDataAccessQualityV2(db) || {}
  const reports = buildReportsAnalyticsV2(db) || {}
  const tower = buildOperationsControlTowerV2(db) || {}
  const workspaceBoundaryProfile = buildProfile(workspace)
  const boundaryScopes = buildBoundaryScopes({ workspace, roles, ai, collaboration, data, reports })
  const dataOwnershipGroups = buildDataOwnershipGroups()
  const moduleBoundaryMatrix = buildModuleBoundaryMatrix({ workspace, roles })
  const documentBoundaryMatrix = buildDocumentBoundaryMatrix(roles)
  const aiBoundaryAwareness = buildAiBoundaryAwareness(ai)
  const collaborationBoundaryPolicies = buildCollaborationBoundaryPolicies(collaboration)
  const roleBoundaryVisibility = buildRoleBoundaryVisibility(roles)
  const dataQualityBoundarySignals = buildDataQualityBoundarySignals(data)
  const boundaryReviewDrafts = buildBoundaryReviewDrafts({ workspace, roles, review, collaboration, data, ai })
  const sourceSummary = buildSourceSummary({ workspace, roles, data, ai, collaboration, reports, review, tower })
  const dataLimitations = uniqueBy([
    ...asArray(workspace.dataLimitations).map(cleanLimitation),
    ...asArray(roles.dataLimitations).map(cleanLimitation),
    ...asArray(data.dataLimitations).map(cleanLimitation),
    ...asArray(ai.dataLimitations).map(cleanLimitation),
    ...asArray(collaboration.dataLimitations).map(cleanLimitation),
    ...asArray(reports.dataLimitations).map(cleanLimitation),
  ], (item) => item.label).slice(0, 10)
  return {
    summary: {
      boundaryScopeCount: boundaryScopes.length,
      dataOwnershipGroupCount: dataOwnershipGroups.length,
      moduleBoundaryCount: moduleBoundaryMatrix.length,
      documentBoundaryCount: documentBoundaryMatrix.length,
      aiBoundarySignalCount: aiBoundaryAwareness.length,
      collaborationBoundaryCount: collaborationBoundaryPolicies.length,
      roleBoundaryCount: roleBoundaryVisibility.length,
      dataQualityBoundaryIssueCount: dataQualityBoundarySignals.length,
      boundaryDraftCount: boundaryReviewDrafts.length,
      dataLimitedCount: dataLimitations.length,
      readinessLabel: dataLimitations.length ? '需边界复核' : '边界状态可见',
    },
    workspaceBoundaryProfile,
    boundaryScopes,
    dataOwnershipGroups,
    moduleBoundaryMatrix,
    documentBoundaryMatrix,
    aiBoundaryAwareness,
    collaborationBoundaryPolicies,
    roleBoundaryVisibility,
    dataQualityBoundarySignals,
    boundaryReviewDrafts,
    sourceSummary,
    dataLimitations: dataLimitations.length ? dataLimitations : [cleanLimitation('当前工作区边界限制', '当前业务范围下仅展示工作区边界状态。')],
    generatedAt: GENERATED_AT,
    dataScopeLabel: '当前工作区数据',
  }
}
