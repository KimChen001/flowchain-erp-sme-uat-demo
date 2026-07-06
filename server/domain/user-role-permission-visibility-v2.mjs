import { buildAiSuggestionsWorkbenchV2 } from './ai-suggestions-workbench-v2.mjs'
import { buildCollaborationNotificationDraftsV2 } from './collaboration-notification-drafts-v2.mjs'
import { buildDataAccessQualityV2 } from './data-access-quality-v2.mjs'
import { buildOperationsControlTowerV2 } from './operations-control-tower-v2.mjs'
import { buildReportsAnalyticsV2 } from './reports-analytics-v2.mjs'
import { buildReviewFirstActionWorkflowV2 } from './review-first-action-workflow-v2.mjs'
import { buildWorkspaceSetupConfigV2 } from './workspace-setup-config-v2.mjs'

export const FORBIDDEN_ROLE_PERMISSION_ACTION_PATTERN = /自动批准|自动下单|正式创建\s*PO|下发\s*PO|发送\s*PO|发布\s*RFQ|邀请供应商|发送邮件|发送|推送|已发送|提交收货|Receive Submit|Submit Receipt|库存过账|Post Invoice|Approve Invoice|Mark as Paid|Payment execution|Export to Accounting|付款|会计过账|修改供应商主数据|更新银行账户|发布风险评级|自动黑名单|自动暂停供应商|自动修复|自动提交导入|自动覆盖数据|自动写入数据库|批量删除|清空数据|sent|delivered|dispatched|webhook|portal invite|保存配置|保存权限|修改权限|立即生效|自动应用|分配角色|创建用户|删除用户|禁用用户|创建租户|切换租户|写入配置/i
export const FORBIDDEN_ROLE_PERMISSION_TECHNICAL_PATTERN = /JSON|dry-run|tenantId|userId|datasetId|writesDb|writesFiles|DB|database|tool_result|provider|fallback|deterministic|mock|fake|demo|UAT|sample data|demo data|response_card|entityType|documentType|raw enum|payload|webhook|API key|Coupa|RBAC/i

const GENERATED_AT = '2026-05-25T11:20:00.000Z'
const BOUNDARIES = ['权限草稿预览', '人工复核', '不直接改变用户权限', '不形成正式业务处理', '不覆盖当前工作区数据', '仅内部留存', '建议后续管理员确认']

function asArray(value) { return Array.isArray(value) ? value : [] }
function number(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
function sanitize(value = '') {
  return String(value ?? '')
    .replace(/自动批准|自动下单|正式创建\s*PO|下发\s*PO|发送\s*PO|发布\s*RFQ|邀请供应商|发送邮件|发送|推送|已发送|提交收货/ig, '形成正式业务处理')
    .replace(/Receive Submit|Submit Receipt|库存过账|Post Invoice|Approve Invoice|Mark as Paid|Payment execution|Export to Accounting|会计过账|付款/ig, '正式资金或凭证处理')
    .replace(/修改供应商主数据|更新银行账户|发布风险评级|自动黑名单|自动暂停供应商/ig, '供应商资料正式变更')
    .replace(/自动修复|自动提交导入|自动覆盖数据|自动写入数据库|批量删除|清空数据|保存配置|保存权限|修改权限|立即生效|自动应用|分配角色|创建用户|删除用户|禁用用户|创建租户|切换租户|写入配置/ig, '权限或配置正式变更')
    .replace(/sent|delivered|dispatched|webhook|portal invite/ig, '外部触达动作')
    .replace(/JSON|dry-run|tenantId|userId|datasetId|writesDb|writesFiles|tool_result|provider|fallback|deterministic|mock|fake|demo|UAT|sample data|demo data|response_card|entityType|documentType|raw enum|payload|database|API key|Coupa|RBAC/ig, '当前工作区数据')
    .replace(/\bDB\b/g, '当前工作区数据')
}
function text(value, fallback = '') {
  const raw = String(value ?? '').trim() || fallback
  return sanitize(raw)
}
function cleanList(items = []) {
  return asArray(items).map((item) => text(item)).filter(Boolean)
}
function unique(items = []) {
  return Array.from(new Set(cleanList(items)))
}
function uniqueBy(items = [], keyOf = (item) => item.id || item.label) {
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
function nav(label, moduleId, entityType = 'role_permission_visibility', entityId = '') {
  return { label: text(label), moduleId, entityType, entityId: text(entityId), entityLabel: text(label), returnTo: 'settings:roles', source: 'userRolePermissionVisibility', reason: '从角色权限可见性查看来源。' }
}
function cleanLimitation(item, fallbackLabel = '当前权限可见性限制') {
  if (typeof item === 'string') return { label: text(item, fallbackLabel), description: text(item), severity: 'warning' }
  return {
    label: text(item?.label, fallbackLabel),
    description: text(item?.description || item?.consequence || item?.impactSummary, '需要结合当前业务范围人工复核。'),
    severity: text(item?.severity, 'warning'),
    affectedModules: cleanList(item?.affectedModules || item?.affectedMetrics || item?.missingData),
  }
}

const ROLE_BLUEPRINTS = [
  {
    id: 'requester', roleCode: 'requester', roleLabel: '需求提交人', roleGroup: '采购需求',
    businessPurpose: '查看自己的 PR 与需求证据，发起需求草稿预览并跟踪 PR 复核状态。',
    visibleModules: ['今日工作台', '采购管理', 'AI 建议'],
    visibleObjects: ['PR', 'AI Suggestion', 'Action Draft'],
    reviewScopes: ['PR 优先级复核'],
    draftScopes: ['需求草稿预览'],
    dataScopes: ['采购数据范围'],
    restrictedScopes: ['不形成正式采购处理', '不处理发票或收货正式动作'],
    navigationLinks: [nav('进入采购管理', 'procurement'), nav('进入 AI 建议', 'overview:ai')],
  },
  {
    id: 'buyer', roleCode: 'buyer', roleLabel: '采购专员', roleGroup: '采购执行',
    businessPurpose: '查看 PR、RFQ、PO 和供应商报价证据，维护采购协同说明草稿。',
    visibleModules: ['采购管理', '供应商管理', '协同通知草稿', '行动草稿与人工复核'],
    visibleObjects: ['PR', 'RFQ', 'PO', 'Quote Comparison', 'Collaboration Draft'],
    reviewScopes: ['PO 跟进复核', '供应商沟通复核'],
    draftScopes: ['RFQ 草稿预览', 'PO 跟进草稿预览', '采购协同说明草稿'],
    dataScopes: ['采购数据范围', '供应商数据范围'],
    restrictedScopes: ['不形成正式采购处理', '不处理资金或财务凭证'],
    navigationLinks: [nav('进入采购管理', 'procurement'), nav('进入协同通知草稿', 'collaboration-drafts')],
  },
  {
    id: 'sourcing_manager', roleCode: 'sourcing_lead', roleLabel: '寻源负责人', roleGroup: '寻源复核',
    businessPurpose: '查看 RFQ、报价对比和授标建议草稿，复核供应商报价节奏和风险。',
    visibleModules: ['采购管理', '供应商管理', '行动草稿与人工复核', '报表与分析'],
    visibleObjects: ['RFQ', 'Quote Comparison', 'Award Recommendation Draft', 'Supplier Operational Profile'],
    reviewScopes: ['RFQ 授标建议复核'],
    draftScopes: ['授标建议草稿', 'RFQ 复核草稿'],
    dataScopes: ['采购数据范围', '供应商数据范围'],
    restrictedScopes: ['不开放寻源正式发布', '不开放供应商外部参与动作', '不形成授标正式处理'],
    navigationLinks: [nav('进入采购管理', 'procurement'), nav('进入供应商管理', 'srm')],
  },
  {
    id: 'procurement_manager', roleCode: 'procurement_lead', roleLabel: '采购负责人', roleGroup: '采购复核',
    businessPurpose: '查看 PR → RFQ → PO → GRN → Invoice 证据链，复核高优先级采购建议和供应商沟通草稿。',
    visibleModules: ['今日工作台', '采购管理', 'AI 建议', '行动草稿与人工复核', '协同通知草稿'],
    visibleObjects: ['PR', 'RFQ', 'PO', 'GRN', 'Invoice', 'Action Draft', 'Collaboration Draft'],
    reviewScopes: ['PR 优先级复核', 'PO 到货异常复核', '供应商沟通复核'],
    draftScopes: ['PO 跟进草稿', '供应商沟通草稿'],
    dataScopes: ['采购数据范围', '供应商数据范围'],
    restrictedScopes: ['不形成正式采购处理'],
    navigationLinks: [nav('进入今日行动', 'overview'), nav('进入行动草稿与人工复核', 'review-actions')],
  },
  {
    id: 'receiving_coordinator', roleCode: 'receiving_coordinator', roleLabel: '收货协同负责人', roleGroup: '收货协同',
    businessPurpose: '查看 PO、GRN、收货异常证据和库存影响，复核收货异常通知草稿。',
    visibleModules: ['采购管理', '库存管理', '协同通知草稿'],
    visibleObjects: ['PO', 'GRN', 'SKU / Inventory', 'Collaboration Draft'],
    reviewScopes: ['GRN 收货异常复核', 'PO 到货异常复核'],
    draftScopes: ['收货异常复核草稿'],
    dataScopes: ['采购数据范围', '库存数据范围'],
    restrictedScopes: ['不提交正式收货', '不写库存', '不形成库存正式处理'],
    navigationLinks: [nav('进入库存管理', 'inventory'), nav('进入协同通知草稿', 'collaboration-drafts')],
  },
  {
    id: 'inventory_planner', roleCode: 'inventory_planner', roleLabel: '库存与计划负责人', roleGroup: '库存计划',
    businessPurpose: '查看 SKU、库存风险、ATP 和补货建议，复核库存风险草稿和关联采购对象。',
    visibleModules: ['库存管理', '预测与 MRP 物料需求计划', '采购管理', 'AI 建议'],
    visibleObjects: ['SKU / Inventory', 'PR', 'PO', 'RFQ', 'AI Suggestion'],
    reviewScopes: ['库存风险复核'],
    draftScopes: ['库存复核草稿', '补货建议草稿预览'],
    dataScopes: ['库存数据范围', '采购数据范围'],
    restrictedScopes: ['不形成 PR 正式处理', '不锁库', '不写库存'],
    navigationLinks: [nav('进入库存管理', 'inventory'), nav('进入 AI 建议', 'overview:ai')],
  },
  {
    id: 'supplier_manager', roleCode: 'supplier_manager', roleLabel: '供应商管理负责人', roleGroup: '供应商管理',
    businessPurpose: '查看供应商运营档案、风险、绩效、报价回复、GRN 异常和 Invoice variance 证据。',
    visibleModules: ['供应商管理', '采购管理', '报表与分析', '协同通知草稿'],
    visibleObjects: ['Supplier Operational Profile', 'RFQ', 'GRN', 'Invoice', 'Collaboration Draft'],
    reviewScopes: ['Supplier 风险复核', '供应商沟通复核'],
    draftScopes: ['供应商沟通草稿', '供应商资料复核草稿'],
    dataScopes: ['供应商数据范围', '采购数据范围'],
    restrictedScopes: ['不改主数据', '不变更银行资料', '不形成风险等级正式处理', '不形成供应商暂停处理'],
    navigationLinks: [nav('进入供应商管理', 'srm'), nav('进入报表与分析', 'reports')],
  },
  {
    id: 'finance_reviewer', roleCode: 'finance_reviewer', roleLabel: '财务复核负责人', roleGroup: '财务复核',
    businessPurpose: '查看 Invoice、Three-way Match、Received-not-invoiced 和 variance 证据，复核财务差异说明草稿。',
    visibleModules: ['财务协同', '采购管理', '报表与分析', '行动草稿与人工复核'],
    visibleObjects: ['Invoice', 'Three-way Match', 'PO', 'GRN', 'Action Draft'],
    reviewScopes: ['Invoice 差异复核'],
    draftScopes: ['财务差异复核说明草稿'],
    dataScopes: ['财务协同数据范围', '采购数据范围'],
    restrictedScopes: ['不写财务凭证', '不处理资金', '不形成财务系统外部处理'],
    navigationLinks: [nav('进入财务协同', 'finance'), nav('进入行动草稿与人工复核', 'review-actions')],
  },
  {
    id: 'data_steward', roleCode: 'data_steward', roleLabel: '数据负责人', roleGroup: '数据治理',
    businessPurpose: '查看数据接入与质量、字段映射、数据缺口和数据影响范围，复核数据补齐草稿。',
    visibleModules: ['数据接入与质量', '报表与分析', 'AI 建议', '行动草稿与人工复核'],
    visibleObjects: ['Data Access Issue', 'AI Suggestion', 'Action Draft'],
    reviewScopes: ['Data Quality 补齐复核'],
    draftScopes: ['数据补齐复核草稿'],
    dataScopes: ['数据接入质量范围'],
    restrictedScopes: ['不形成数据正式覆盖', '不覆盖当前工作区数据'],
    navigationLinks: [nav('进入数据接入与质量', 'imports'), nav('进入报表与分析', 'reports')],
  },
  {
    id: 'config_reviewer', roleCode: 'config_reviewer', roleLabel: '系统配置复核人', roleGroup: '配置复核',
    businessPurpose: '查看系统设置、工作区配置、模块启用状态、编号规则、AI 边界和协同草稿策略。',
    visibleModules: ['系统设置', '数据接入与质量', '行动草稿与人工复核'],
    visibleObjects: ['Workspace Config Draft', 'Action Draft', 'Collaboration Draft'],
    reviewScopes: ['Workspace Config 变更复核', '权限复核'],
    draftScopes: ['配置复核草稿', '权限草稿预览'],
    dataScopes: ['系统配置范围'],
    restrictedScopes: ['不直接改变用户权限', '不形成配置正式变更'],
    navigationLinks: [nav('进入工作区配置', 'settings'), nav('进入行动草稿与人工复核', 'review-actions')],
  },
  {
    id: 'executive_observer', roleCode: 'executive_observer', roleLabel: '管理层只读观察者', roleGroup: '管理层观察',
    businessPurpose: '查看今日行动、AI 建议、报表与分析、关键风险摘要、证据链和数据限制。',
    visibleModules: ['今日工作台', 'AI 建议', '报表与分析', '异常处理工单'],
    visibleObjects: ['AI Suggestion', 'Report Insight', 'Exception Case'],
    reviewScopes: ['关键风险观察'],
    draftScopes: ['仅查看草稿状态'],
    dataScopes: ['管理层汇总范围'],
    restrictedScopes: ['只读观察', '不形成正式业务处理', '不进入执行动作'],
    navigationLinks: [nav('进入今日行动', 'overview'), nav('进入报表与分析', 'reports')],
  },
]

function buildRoleProfiles({ workspace, review, collaboration, ai, data }) {
  const limitation = [
    ...asArray(workspace.dataLimitations),
    ...asArray(data.dataLimitations),
    ...asArray(ai.dataLimitations),
    ...asArray(collaboration.dataLimitations),
  ].map(cleanLimitation).slice(0, 3)
  return ROLE_BLUEPRINTS.map((role, index) => ({
    ...role,
    userPreviewCount: index < 4 ? 2 : 1,
    userPreviewLabels: index < 4 ? ['张磊', '李娜'] : ['张磊'],
    visibleModules: unique(role.visibleModules),
    visibleObjects: unique(role.visibleObjects),
    reviewScopes: unique([...role.reviewScopes, ...(index % 3 === 0 ? ['人工复核'] : [])]),
    draftScopes: unique(role.draftScopes),
    dataScopes: unique(role.dataScopes),
    restrictedScopes: unique(role.restrictedScopes),
    boundaryLabels: BOUNDARIES,
    navigationLinks: role.navigationLinks,
    dataLimitations: limitation,
    sourceSignals: [
      `行动草稿 ${number(review.summary?.totalDraftCount)} 条`,
      `协同草稿 ${number(collaboration.summary?.totalDraftCount)} 条`,
      `AI 建议 ${number(ai.summary?.totalSuggestionCount)} 条`,
    ],
  }))
}

function buildPermissionBundles(roleProfiles) {
  const bundles = [
    ['request-bundle', '需求提交职责包', '聚焦 PR 需求证据、草稿预览和复核状态。', ['需求提交人']],
    ['buyer-bundle', '采购执行职责包', '覆盖 PR、RFQ、PO、报价证据和采购协同草稿。', ['采购专员', '采购负责人']],
    ['sourcing-bundle', '寻源复核职责包', '覆盖报价对比、授标建议草稿和供应商风险。', ['寻源负责人', '采购负责人']],
    ['receiving-bundle', '收货协同职责包', '覆盖 PO、GRN、收货异常和库存影响。', ['收货协同负责人']],
    ['inventory-bundle', '库存计划职责包', '覆盖 SKU、库存风险、ATP、补货建议和关联采购对象。', ['库存与计划负责人']],
    ['supplier-bundle', '供应商管理职责包', '覆盖供应商运营档案、绩效风险和沟通草稿。', ['供应商管理负责人']],
    ['finance-bundle', '财务复核职责包', '覆盖 Invoice、三单匹配和财务差异说明草稿。', ['财务复核负责人']],
    ['data-bundle', '数据治理职责包', '覆盖字段映射、数据缺口、数据影响范围和数据补齐草稿。', ['数据负责人']],
    ['config-bundle', '系统配置复核职责包', '覆盖工作区配置、AI 边界、编号规则和权限复核草稿。', ['系统配置复核人']],
    ['executive-bundle', '管理层只读职责包', '覆盖今日行动、AI 建议、报表洞察和关键风险观察。', ['管理层只读观察者']],
  ]
  return bundles.map(([id, bundleLabel, businessPurpose, includedRoles]) => {
    const roles = roleProfiles.filter((role) => includedRoles.includes(role.roleLabel))
    return {
      id,
      bundleLabel,
      businessPurpose,
      includedRoles,
      visibleModules: unique(roles.flatMap((role) => role.visibleModules)),
      visibleObjects: unique(roles.flatMap((role) => role.visibleObjects)),
      draftCapabilities: unique(roles.flatMap((role) => role.draftScopes)),
      reviewCapabilities: unique(roles.flatMap((role) => role.reviewScopes)),
      restrictedCapabilities: unique(roles.flatMap((role) => role.restrictedScopes)),
      boundaryLabels: BOUNDARIES,
      navigationLinks: roles.flatMap((role) => role.navigationLinks).slice(0, 3),
    }
  })
}

function documentRow(input) {
  return {
    documentType: input.documentType,
    documentLabel: input.documentLabel,
    visibleToRoles: input.visibleToRoles,
    draftPreviewRoles: input.draftPreviewRoles || [],
    reviewRoles: input.reviewRoles || [],
    dataOwnerRoles: input.dataOwnerRoles || ['数据负责人'],
    restrictedRoles: input.restrictedRoles || [],
    boundarySummary: input.boundarySummary || '仅展示权限状态，权限变更进入复核草稿。',
    navigationLinks: input.navigationLinks || [],
  }
}

function buildDocumentPermissionMatrix() {
  return [
    documentRow({ documentType: 'pr', documentLabel: 'PR', visibleToRoles: ['需求提交人', '采购专员', '采购负责人'], draftPreviewRoles: ['需求提交人'], reviewRoles: ['采购负责人'], navigationLinks: [nav('进入采购管理', 'procurement')] }),
    documentRow({ documentType: 'rfq', documentLabel: 'RFQ', visibleToRoles: ['采购专员', '寻源负责人', '采购负责人'], draftPreviewRoles: ['采购专员'], reviewRoles: ['寻源负责人', '采购负责人'], navigationLinks: [nav('进入采购管理', 'procurement')] }),
    documentRow({ documentType: 'quote_comparison', documentLabel: 'Quote Comparison', visibleToRoles: ['采购专员', '寻源负责人', '采购负责人'], reviewRoles: ['寻源负责人'], navigationLinks: [nav('进入采购管理', 'procurement')] }),
    documentRow({ documentType: 'award_recommendation', documentLabel: 'Award Recommendation Draft', visibleToRoles: ['寻源负责人', '采购负责人'], draftPreviewRoles: ['寻源负责人'], reviewRoles: ['采购负责人'], restrictedRoles: ['需求提交人'], navigationLinks: [nav('进入行动草稿与人工复核', 'review-actions')] }),
    documentRow({ documentType: 'po', documentLabel: 'PO', visibleToRoles: ['采购专员', '采购负责人', '收货协同负责人', '财务复核负责人'], draftPreviewRoles: ['采购专员'], reviewRoles: ['采购负责人'], navigationLinks: [nav('进入采购管理', 'procurement')] }),
    documentRow({ documentType: 'grn', documentLabel: 'GRN', visibleToRoles: ['收货协同负责人', '采购负责人', '财务复核负责人'], draftPreviewRoles: ['收货协同负责人'], reviewRoles: ['收货协同负责人'], navigationLinks: [nav('进入采购管理', 'procurement')] }),
    documentRow({ documentType: 'invoice', documentLabel: 'Invoice', visibleToRoles: ['财务复核负责人', '采购负责人'], draftPreviewRoles: ['财务复核负责人'], reviewRoles: ['财务复核负责人'], navigationLinks: [nav('进入财务协同', 'finance')] }),
    documentRow({ documentType: 'three_way_match', documentLabel: 'Three-way Match', visibleToRoles: ['财务复核负责人', '采购负责人'], reviewRoles: ['财务复核负责人'], navigationLinks: [nav('进入财务协同', 'finance')] }),
    documentRow({ documentType: 'supplier_profile', documentLabel: 'Supplier Operational Profile', visibleToRoles: ['供应商管理负责人', '采购负责人', '寻源负责人'], draftPreviewRoles: ['供应商管理负责人'], reviewRoles: ['供应商管理负责人'], navigationLinks: [nav('进入供应商管理', 'srm')] }),
    documentRow({ documentType: 'sku_inventory', documentLabel: 'SKU / Inventory', visibleToRoles: ['库存与计划负责人', '收货协同负责人', '采购负责人'], draftPreviewRoles: ['库存与计划负责人'], reviewRoles: ['库存与计划负责人'], navigationLinks: [nav('进入库存管理', 'inventory')] }),
    documentRow({ documentType: 'data_access_issue', documentLabel: 'Data Access Issue', visibleToRoles: ['数据负责人', '系统配置复核人'], draftPreviewRoles: ['数据负责人'], reviewRoles: ['数据负责人'], navigationLinks: [nav('进入数据接入与质量', 'imports')] }),
    documentRow({ documentType: 'ai_suggestion', documentLabel: 'AI Suggestion', visibleToRoles: ['管理层只读观察者', '采购负责人', '数据负责人', '库存与计划负责人'], draftPreviewRoles: ['采购负责人', '库存与计划负责人'], reviewRoles: ['采购负责人', '数据负责人'], navigationLinks: [nav('进入 AI 建议', 'overview:ai')] }),
    documentRow({ documentType: 'action_draft', documentLabel: 'Action Draft', visibleToRoles: ['采购负责人', '财务复核负责人', '数据负责人', '系统配置复核人'], draftPreviewRoles: ['采购专员', '数据负责人'], reviewRoles: ['采购负责人', '系统配置复核人'], navigationLinks: [nav('进入行动草稿与人工复核', 'review-actions')] }),
    documentRow({ documentType: 'collaboration_draft', documentLabel: 'Collaboration Draft', visibleToRoles: ['采购专员', '供应商管理负责人', '财务复核负责人', '系统配置复核人'], draftPreviewRoles: ['采购专员', '供应商管理负责人'], reviewRoles: ['采购负责人', '系统配置复核人'], navigationLinks: [nav('进入协同通知草稿', 'collaboration-drafts')] }),
    documentRow({ documentType: 'workspace_config_draft', documentLabel: 'Workspace Config Draft', visibleToRoles: ['系统配置复核人', '数据负责人'], draftPreviewRoles: ['系统配置复核人'], reviewRoles: ['系统配置复核人'], navigationLinks: [nav('进入工作区配置', 'settings')] }),
  ]
}

function buildReviewChainVisibility({ review, collaboration, reports }) {
  const reportCount = asArray(reports.reportInsights).length
  const totalDrafts = number(review.summary?.totalDraftCount)
  const collaborationCount = number(collaboration.summary?.totalDraftCount)
  return [
    ['pr-priority', 'PR 优先级复核链路', 'PR', `高优先级采购建议或待复核草稿 ${totalDrafts} 条`, ['采购负责人'], ['需求提交人', '管理层只读观察者'], '超过复核时限时进入采购负责人关注列表。', [nav('进入行动草稿与人工复核', 'review-actions')]],
    ['rfq-award', 'RFQ 授标建议复核链路', 'RFQ / Quote Comparison', '报价对比存在供应商风险或价格差异。', ['寻源负责人', '采购负责人'], ['采购专员'], '授标建议仅保留为草稿预览。', [nav('进入采购管理', 'procurement')]],
    ['po-arrival', 'PO 到货异常复核链路', 'PO / GRN', '到货节奏、短缺或延期影响采购计划。', ['采购负责人', '收货协同负责人'], ['库存与计划负责人'], '异常信息进入内部复核清单。', [nav('进入采购管理', 'procurement')]],
    ['grn-exception', 'GRN 收货异常复核链路', 'GRN', '收货异常或数量差异影响库存判断。', ['收货协同负责人'], ['采购负责人', '财务复核负责人'], '仅生成收货异常复核草稿。', [nav('进入协同通知草稿', 'collaboration-drafts')]],
    ['invoice-variance', 'Invoice 差异复核链路', 'Invoice / Three-way Match', '三单匹配差异或已收未票证据需要复核。', ['财务复核负责人'], ['采购负责人'], '财务说明保持草稿预览。', [nav('进入财务协同', 'finance')]],
    ['supplier-risk', 'Supplier 风险复核链路', 'Supplier Operational Profile', '供应商风险、绩效或交付异常需要复核。', ['供应商管理负责人', '采购负责人'], ['管理层只读观察者'], '风险结论仅用于内部复核。', [nav('进入供应商管理', 'srm')]],
    ['data-quality', 'Data Quality 补齐复核链路', 'Data Access Issue', '字段映射或证据缺口影响 AI 与报表。', ['数据负责人'], ['系统配置复核人'], `报表洞察 ${reportCount} 条作为影响来源。`, [nav('进入数据接入与质量', 'imports')]],
    ['workspace-config', 'Workspace Config 变更复核链路', 'Workspace Config Draft', `配置与协同策略草稿 ${collaborationCount} 条可见。`, ['系统配置复核人'], ['数据负责人'], '权限和配置变化只生成复核草稿。', [nav('进入工作区配置', 'settings')]],
  ].map(([id, chainLabel, appliesTo, triggerConditionLabel, reviewRoles, observerRoles, escalationPreview, navigationLinks]) => ({
    id,
    chainLabel,
    appliesTo,
    triggerConditionLabel,
    reviewRoles,
    observerRoles,
    escalationPreview,
    boundaryLabels: BOUNDARIES,
    navigationLinks,
  }))
}

function buildDataScopeGroups(workspace) {
  const moduleLabels = asArray(workspace.moduleSettings).map((module) => module.moduleLabel)
  return [
    ['procurement-scope', '采购数据范围', ['需求提交人', '采购专员', '寻源负责人', '采购负责人'], ['采购管理', '行动草稿与人工复核'], ['PR', 'RFQ', 'PO', 'GRN', 'Invoice'], '仅展示当前工作区采购链路证据。', [nav('进入采购管理', 'procurement')]],
    ['inventory-scope', '库存数据范围', ['库存与计划负责人', '收货协同负责人'], ['库存管理', '预测与 MRP 物料需求计划'], ['SKU / Inventory', 'PO', 'GRN'], '库存影响需要结合采购和收货证据复核。', [nav('进入库存管理', 'inventory')]],
    ['supplier-scope', '供应商数据范围', ['供应商管理负责人', '采购负责人', '寻源负责人'], ['供应商管理', '采购管理'], ['Supplier Operational Profile', 'RFQ', 'GRN', 'Invoice'], '供应商资料变化仅进入复核草稿。', [nav('进入供应商管理', 'srm')]],
    ['finance-scope', '财务协同数据范围', ['财务复核负责人', '采购负责人'], ['财务协同', '采购管理'], ['Invoice', 'Three-way Match', 'PO', 'GRN'], '财务证据仅用于差异复核说明。', [nav('进入财务协同', 'finance')]],
    ['data-quality-scope', '数据接入质量范围', ['数据负责人', '系统配置复核人'], ['数据接入与质量', '报表与分析'], ['Data Access Issue', '字段映射', '数据限制'], '数据补齐变化不覆盖当前工作区数据。', [nav('进入数据接入与质量', 'imports')]],
    ['executive-scope', '管理层汇总范围', ['管理层只读观察者'], ['今日工作台', 'AI 建议', '报表与分析'], ['AI Suggestion', 'Report Insight', 'Exception Case'], '只读观察关键风险、洞察和数据限制。', [nav('进入报表与分析', 'reports')]],
    ['config-scope', '系统配置范围', ['系统配置复核人'], moduleLabels.filter((label) => ['系统设置', '数据接入与质量', '协同通知草稿', '行动草稿与人工复核'].includes(label)).concat('系统设置'), ['Workspace Config Draft', 'Collaboration Draft', 'Action Draft'], '权限与配置变化只进入复核草稿。', [nav('进入工作区配置', 'settings')]],
  ].map(([id, scopeLabel, appliesToRoles, includedModules, includedObjects, limitationSummary, navigationLinks]) => ({
    id,
    scopeLabel,
    appliesToRoles,
    includedModules: unique(includedModules),
    includedObjects,
    limitationSummary,
    navigationLinks,
  }))
}

function rolesForModule(label) {
  return ROLE_BLUEPRINTS.filter((role) => role.visibleModules.includes(label)).map((role) => role.roleLabel)
}
function buildModuleVisibilityMatrix(workspace) {
  const extra = [{ id: 'settings', moduleLabel: '系统设置', moduleGroup: '设置', navigationLinks: [nav('进入工作区配置', 'settings')] }]
  return uniqueBy([...asArray(workspace.moduleSettings), ...extra], (module) => module.id).map((module) => {
    const visible = rolesForModule(module.moduleLabel)
    return {
      id: module.id,
      moduleLabel: module.moduleLabel,
      moduleId: module.id,
      visibleToRoles: visible.length ? visible : ['系统配置复核人'],
      reviewRoles: visible.filter((role) => /负责人|复核人/.test(role)).slice(0, 4),
      draftOnlyRoles: visible.filter((role) => !/只读/.test(role)).slice(0, 4),
      restrictedActionSummary: '不直接改变用户权限，不形成正式业务处理。',
      sourceModule: module.moduleLabel,
      navigationLinks: module.navigationLinks || [nav(`进入${module.moduleLabel}`, module.id)],
    }
  })
}

function buildReviewPermissionPolicies({ workspace, review, collaboration, ai }) {
  const workspacePolicies = asArray(workspace.reviewPolicies).slice(0, 4).map((policy, index) => ({
    id: `workspace-review-${index + 1}`,
    policyLabel: policy.policyLabel,
    appliesToModule: '系统设置',
    allowedRoles: ['系统配置复核人', '数据负责人'],
    reviewRequired: true,
    previewOnly: true,
    boundaryLabels: policy.boundaryLabels || BOUNDARIES,
    sourceModule: '工作区配置',
    navigationLinks: [nav('进入工作区配置', 'settings')],
  }))
  const lifecycle = asArray(review.lifecyclePolicy?.boundaryLabels).slice(0, 3).map((label, index) => ({
    id: `review-workflow-${index + 1}`,
    policyLabel: text(label),
    appliesToModule: '行动草稿与人工复核',
    allowedRoles: ['采购负责人', '财务复核负责人', '数据负责人', '系统配置复核人'],
    reviewRequired: true,
    previewOnly: true,
    boundaryLabels: BOUNDARIES,
    sourceModule: '行动草稿与人工复核',
    navigationLinks: [nav('进入行动草稿与人工复核', 'review-actions')],
  }))
  return [
    ...workspacePolicies,
    ...lifecycle,
    {
      id: 'collaboration-boundary',
      policyLabel: '协同通知草稿复核边界',
      appliesToModule: '协同通知草稿',
      allowedRoles: ['采购负责人', '供应商管理负责人', '财务复核负责人', '系统配置复核人'],
      reviewRequired: true,
      previewOnly: true,
      boundaryLabels: BOUNDARIES,
      sourceModule: `协同通知草稿 ${number(collaboration.summary?.totalDraftCount)} 条`,
      navigationLinks: [nav('进入协同通知草稿', 'collaboration-drafts')],
    },
    {
      id: 'ai-boundary',
      policyLabel: 'AI 建议复核边界',
      appliesToModule: 'AI 建议',
      allowedRoles: ['采购负责人', '库存与计划负责人', '数据负责人', '管理层只读观察者'],
      reviewRequired: true,
      previewOnly: true,
      boundaryLabels: BOUNDARIES,
      sourceModule: `AI 建议 ${number(ai.summary?.totalSuggestionCount)} 条`,
      navigationLinks: [nav('进入 AI 建议', 'overview:ai')],
    },
  ]
}

function buildRestrictedActionPolicies() {
  return [
    ['purchase-boundary', '采购正式处理边界', 'PR / RFQ / PO', '不形成正式采购处理。', '生成采购草稿预览并进入人工复核。', '采购管理', [nav('进入采购管理', 'procurement')]],
    ['sourcing-boundary', '寻源发布边界', 'RFQ / Award Recommendation Draft', '不开放寻源正式发布或外部参与动作。', '生成 RFQ / 授标建议草稿。', '采购管理', [nav('进入行动草稿与人工复核', 'review-actions')]],
    ['receiving-boundary', '收货处理边界', 'PO / GRN', '不提交正式收货，不写库存。', '生成收货异常复核草稿。', '库存管理', [nav('进入协同通知草稿', 'collaboration-drafts')]],
    ['inventory-boundary', '库存处理边界', 'SKU / Inventory', '不锁库，不写库存。', '生成库存复核草稿。', '库存管理', [nav('进入库存管理', 'inventory')]],
    ['finance-boundary', '财务处理边界', 'Invoice / Three-way Match', '不写财务凭证，不处理资金。', '生成财务差异复核说明草稿。', '财务协同', [nav('进入财务协同', 'finance')]],
    ['supplier-boundary', '供应商资料边界', 'Supplier Operational Profile', '不改主数据，不变更银行资料。', '生成供应商资料复核草稿。', '供应商管理', [nav('进入供应商管理', 'srm')]],
    ['data-boundary', '数据覆盖边界', 'Data Access Issue', '不覆盖当前工作区数据。', '生成数据补齐复核草稿。', '数据接入与质量', [nav('进入数据接入与质量', 'imports')]],
    ['permission-boundary', '配置与权限边界', 'Workspace Config Draft', '不直接改变用户权限，不形成配置正式变更。', '生成配置 / 权限复核草稿。', '系统设置', [nav('进入工作区配置', 'settings')]],
    ['ai-boundary', 'AI 建议边界', 'AI Suggestion', '不形成正式业务处理。', '整理证据并生成草稿预览。', 'AI 建议', [nav('进入 AI 建议', 'overview:ai')]],
    ['collaboration-boundary', '协同草稿边界', 'Collaboration Draft', '不外发，不形成正式业务处理。', '生成协同通知草稿并进入人工复核。', '协同通知草稿', [nav('进入协同通知草稿', 'collaboration-drafts')]],
  ].map(([id, actionLabel, appliesTo, restrictedReason, safeAlternative, sourceModule, navigationLinks]) => ({
    id,
    actionLabel,
    appliesTo,
    restrictedReason,
    safeAlternative,
    boundaryLabels: BOUNDARIES,
    sourceModule,
    navigationLinks,
  }))
}

function permissionDraft(input, index) {
  return {
    id: `permission-review-draft-${index}`,
    title: input.title,
    draftType: 'permission_review',
    sourceModule: input.sourceModule,
    targetRole: input.targetRole,
    targetModule: input.targetModule,
    status: '权限草稿预览',
    priority: input.priority || 'medium',
    conclusion: input.conclusion,
    proposedPermissionPreview: input.proposedPermissionPreview,
    keyEvidence: input.keyEvidence,
    reviewChecklist: input.reviewChecklist || ['确认角色职责范围', '确认单据可见范围', '确认是否仅内部留存'],
    missingInformation: input.missingInformation || ['需后续管理员确认'],
    boundaryLabels: BOUNDARIES,
    navigationLinks: input.navigationLinks,
    dataLimitations: input.dataLimitations || [],
    previewOnly: true,
    reviewRequired: true,
    requiresHumanReview: true,
  }
}
function buildPermissionReviewDrafts({ workspace, review, collaboration, data, ai }) {
  const commonLimitations = asArray(workspace.dataLimitations).map(cleanLimitation).slice(0, 2)
  return [
    permissionDraft({
      title: '采购职责包复核草稿',
      sourceModule: '采购管理',
      targetRole: '采购专员 / 采购负责人',
      targetModule: '采购管理',
      priority: review.summary?.highPriorityCount ? 'high' : 'medium',
      conclusion: '采购职责包覆盖 PR、RFQ、PO 与采购草稿预览。',
      proposedPermissionPreview: '保留采购执行与复核职责分层，权限变化进入人工复核。',
      keyEvidence: [`行动草稿 ${number(review.summary?.totalDraftCount)} 条`, `AI 建议 ${number(ai.summary?.totalSuggestionCount)} 条`],
      navigationLinks: [nav('进入采购管理', 'procurement'), nav('进入行动草稿与人工复核', 'review-actions')],
      dataLimitations: commonLimitations,
    }, 1),
    permissionDraft({
      title: '财务复核角色边界草稿',
      sourceModule: '财务协同',
      targetRole: '财务复核负责人',
      targetModule: '财务协同',
      conclusion: '财务复核仅覆盖 Invoice、三单匹配与差异说明草稿。',
      proposedPermissionPreview: '保留财务证据查看和差异复核说明，不开放资金或凭证正式处理。',
      keyEvidence: [`协同草稿 ${number(collaboration.summary?.financeDraftCount)} 条`, 'Invoice / Three-way Match 证据链'],
      navigationLinks: [nav('进入财务协同', 'finance'), nav('进入协同通知草稿', 'collaboration-drafts')],
    }, 2),
    permissionDraft({
      title: '数据负责人权限范围草稿',
      sourceModule: '数据接入与质量',
      targetRole: '数据负责人',
      targetModule: '数据接入与质量',
      priority: data.summary?.criticalIssueCount ? 'high' : 'medium',
      conclusion: '数据负责人需要查看字段映射、数据缺口和影响范围。',
      proposedPermissionPreview: '保留数据补齐复核草稿和质量影响查看，不覆盖当前工作区数据。',
      keyEvidence: [`质量事项 ${number(data.summary?.criticalIssueCount) + number(data.summary?.warningIssueCount)} 项`, `字段映射 ${number(data.summary?.mappedFieldCount)} 项`],
      navigationLinks: [nav('进入数据接入与质量', 'imports'), nav('进入报表与分析', 'reports')],
      dataLimitations: asArray(data.dataLimitations).map(cleanLimitation),
    }, 3),
    permissionDraft({
      title: '系统配置复核人边界草稿',
      sourceModule: '系统设置',
      targetRole: '系统配置复核人',
      targetModule: '系统设置',
      conclusion: '系统配置复核人可查看工作区配置、AI 边界和协同草稿策略。',
      proposedPermissionPreview: '权限和配置变化只生成复核草稿，不直接改变用户权限。',
      keyEvidence: [`配置复核草稿 ${number(workspace.summary?.configDraftCount)} 条`, `模块 ${number(workspace.summary?.enabledModuleCount)} 个`],
      navigationLinks: [nav('进入工作区配置', 'settings'), nav('进入行动草稿与人工复核', 'review-actions')],
    }, 4),
    permissionDraft({
      title: '管理层只读观察范围草稿',
      sourceModule: '报表与分析',
      targetRole: '管理层只读观察者',
      targetModule: '报表与分析',
      conclusion: '管理层只读观察者查看今日行动、AI 建议、报表洞察和关键风险摘要。',
      proposedPermissionPreview: '保留只读观察范围，不进入执行动作。',
      keyEvidence: [`AI 建议 ${number(ai.summary?.totalSuggestionCount)} 条`, '报表洞察与风险摘要'],
      navigationLinks: [nav('进入今日行动', 'overview'), nav('进入报表与分析', 'reports')],
    }, 5),
  ]
}

function buildSourceSummary({ workspace, review, collaboration, data, ai, reports, tower }) {
  return [
    { sourceModule: '系统设置', sourceLabel: '工作区配置', signalCount: number(workspace.summary?.enabledModuleCount), navigationLinks: [nav('进入工作区配置', 'settings')] },
    { sourceModule: '行动草稿与人工复核', sourceLabel: '复核链路', signalCount: number(review.summary?.totalDraftCount), navigationLinks: [nav('进入行动草稿与人工复核', 'review-actions')] },
    { sourceModule: '协同通知草稿', sourceLabel: '协同草稿边界', signalCount: number(collaboration.summary?.totalDraftCount), navigationLinks: [nav('进入协同通知草稿', 'collaboration-drafts')] },
    { sourceModule: 'AI 建议', sourceLabel: 'AI 复核边界', signalCount: number(ai.summary?.totalSuggestionCount), navigationLinks: [nav('进入 AI 建议', 'overview:ai')] },
    { sourceModule: '数据接入与质量', sourceLabel: '数据质量范围', signalCount: number(data.summary?.criticalIssueCount) + number(data.summary?.warningIssueCount), navigationLinks: [nav('进入数据接入与质量', 'imports')] },
    { sourceModule: '报表与分析', sourceLabel: '管理层汇总范围', signalCount: asArray(reports.reportInsights).length, navigationLinks: [nav('进入报表与分析', 'reports')] },
    { sourceModule: '今日工作台', sourceLabel: '优先事项来源', signalCount: number(tower.summary?.totalOpenItems), navigationLinks: [nav('进入今日行动', 'overview')] },
  ]
}

export function buildUserRolePermissionVisibilityV2(db = {}) {
  const workspace = buildWorkspaceSetupConfigV2(db) || {}
  const review = buildReviewFirstActionWorkflowV2(db) || {}
  const collaboration = buildCollaborationNotificationDraftsV2(db) || {}
  const ai = buildAiSuggestionsWorkbenchV2(db) || {}
  const data = buildDataAccessQualityV2(db) || {}
  const reports = buildReportsAnalyticsV2(db) || {}
  const tower = buildOperationsControlTowerV2(db) || {}
  const roleProfiles = buildRoleProfiles({ workspace, review, collaboration, ai, data })
  const permissionBundles = buildPermissionBundles(roleProfiles)
  const documentPermissionMatrix = buildDocumentPermissionMatrix()
  const reviewChainVisibility = buildReviewChainVisibility({ review, collaboration, reports })
  const dataScopeGroups = buildDataScopeGroups(workspace)
  const moduleVisibilityMatrix = buildModuleVisibilityMatrix(workspace)
  const reviewPermissionPolicies = buildReviewPermissionPolicies({ workspace, review, collaboration, ai })
  const restrictedActionPolicies = buildRestrictedActionPolicies()
  const permissionReviewDrafts = buildPermissionReviewDrafts({ workspace, review, collaboration, data, ai })
  const sourceSummary = buildSourceSummary({ workspace, review, collaboration, data, ai, reports, tower })
  const dataLimitations = uniqueBy([
    ...asArray(workspace.dataLimitations).map(cleanLimitation),
    ...asArray(data.dataLimitations).map(cleanLimitation),
    ...asArray(ai.dataLimitations).map(cleanLimitation),
    ...asArray(collaboration.dataLimitations).map(cleanLimitation),
    ...asArray(reports.dataLimitations).map(cleanLimitation),
  ], (item) => item.label).slice(0, 10)
  return {
    summary: {
      roleCount: roleProfiles.length,
      activeUserPreviewCount: roleProfiles.reduce((sum, role) => sum + role.userPreviewCount, 0),
      permissionBundleCount: permissionBundles.length,
      documentPermissionCount: documentPermissionMatrix.length,
      reviewChainCount: reviewChainVisibility.length,
      dataScopeGroupCount: dataScopeGroups.length,
      moduleVisibilityCount: moduleVisibilityMatrix.length,
      reviewPermissionCount: reviewPermissionPolicies.length,
      restrictedActionCount: restrictedActionPolicies.length,
      permissionDraftCount: permissionReviewDrafts.length,
      dataLimitedCount: dataLimitations.length,
      readinessLabel: dataLimitations.length ? '需权限复核' : '权限状态可见',
    },
    roleProfiles,
    permissionBundles,
    documentPermissionMatrix,
    reviewChainVisibility,
    dataScopeGroups,
    moduleVisibilityMatrix,
    reviewPermissionPolicies,
    restrictedActionPolicies,
    permissionReviewDrafts,
    sourceSummary,
    dataLimitations: dataLimitations.length ? dataLimitations : [cleanLimitation('当前权限可见性限制', '当前业务范围下仅展示角色权限状态。')],
    generatedAt: GENERATED_AT,
    dataScopeLabel: '当前工作区数据',
  }
}
