import type React from "react";
import {
  AlertTriangle, BarChart2, ClipboardList, Database, FileCheck2, FileSpreadsheet,
  Gauge, Handshake, History, MessageSquareText, Package, Settings, TrendingUp, Upload, Users,
} from "lucide-react";

export type AppPageType = "module-overview" | "list" | "detail" | "create" | "edit" | "analysis" | "settings";

export type AppRouteDefinition = {
  id: string;
  path: string;
  moduleId: string;
  moduleLabel: string;
  label: string;
  description?: string;
  parentId?: string;
  defaultChildId?: string;
  icon?: React.ElementType;
  showInSidebar?: boolean;
  showInModuleNav?: boolean;
  showInBreadcrumb?: boolean;
  pageType?: AppPageType;
  currentActiveMenuId?: string;
  legacyIds?: string[];
  panelId?: string;
  viewId?: string;
  group?: "主导航" | "高级与内部";
  order: number;
};

const module = (definition: Omit<AppRouteDefinition, "showInSidebar" | "showInModuleNav" | "showInBreadcrumb">): AppRouteDefinition => ({
  ...definition, showInSidebar: true, showInModuleNav: false, showInBreadcrumb: true, pageType: definition.pageType || "module-overview",
});
const page = (definition: Omit<AppRouteDefinition, "showInSidebar" | "showInModuleNav" | "showInBreadcrumb">): AppRouteDefinition => ({
  ...definition, showInSidebar: true, showInModuleNav: true, showInBreadcrumb: true,
});

export const appRouteRegistry: AppRouteDefinition[] = [
  module({ id: "overview", path: "/app/overview", moduleId: "overview", moduleLabel: "首页", label: "今日待办", description: "查看今天需要关注的经营事项。", icon: BarChart2, defaultChildId: "overview", group: "主导航", order: 10 }),
  page({ id: "overview:risks", path: "/app/overview/risks", moduleId: "overview", moduleLabel: "首页", label: "经营预警", description: "查看跨模块经营风险。", parentId: "overview", pageType: "analysis", viewId: "risks", order: 11 }),
  page({ id: "overview:ai", path: "/app/overview/ai", moduleId: "overview", moduleLabel: "首页", label: "AI 摘要", description: "查看基于业务数据的辅助摘要。", parentId: "overview", pageType: "analysis", viewId: "ai", order: 12 }),

  module({ id: "master-data", path: "/app/master-data", moduleId: "master-data", moduleLabel: "基础资料", label: "基础资料总览", description: "统一维护商品、客户、供应商、仓库库位、税码、付款条款与打印模板。", icon: Database, defaultChildId: "master-data:items", group: "主导航", order: 20 }),
  page({ id: "master-data:items", path: "/app/master-data/items", moduleId: "master-data", moduleLabel: "基础资料", label: "商品资料 / 物料资料", description: "维护商品、SKU 和物料属性。", parentId: "master-data", pageType: "list", viewId: "items", order: 21 }),
  page({ id: "master-data:suppliers", path: "/app/master-data/suppliers", moduleId: "master-data", moduleLabel: "基础资料", label: "供应商", description: "维护供应商基本资料、认证和绩效摘要。", parentId: "master-data", pageType: "list", panelId: "srm", viewId: "master", legacyIds: ["srm", "srm:master"], order: 22 }),
  page({ id: "master-data:customers", path: "/app/master-data/customers", moduleId: "master-data", moduleLabel: "基础资料", label: "客户", description: "维护客户联系人、信用和付款条款。", parentId: "master-data", pageType: "list", viewId: "customers", order: 23 }),
  page({ id: "master-data:warehouses", path: "/app/master-data/warehouses", moduleId: "master-data", moduleLabel: "基础资料", label: "仓库资料", description: "维护仓库和库区资料。", parentId: "master-data", pageType: "list", viewId: "warehouses", order: 24 }),
  page({ id: "master-data:bins", path: "/app/master-data/bins", moduleId: "master-data", moduleLabel: "基础资料", label: "库位 / 货位", description: "查看库位容量和可用状态。", parentId: "master-data", pageType: "list", panelId: "inventory", viewId: "bins", order: 25 }),
  page({ id: "master-data:payment-terms", path: "/app/master-data/payment-terms", moduleId: "master-data", moduleLabel: "基础资料", label: "支付方式 / 付款条款", description: "维护支付方式和付款规则。", parentId: "master-data", pageType: "list", viewId: "payment-terms", order: 26 }),
  page({ id: "master-data:tax-codes", path: "/app/master-data/tax-codes", moduleId: "master-data", moduleLabel: "基础资料", label: "税码", description: "维护税率和适用区域。", parentId: "master-data", pageType: "list", viewId: "tax-codes", order: 27 }),
  page({ id: "master-data:print-templates", path: "/app/master-data/print-templates", moduleId: "master-data", moduleLabel: "基础资料", label: "打印模板", description: "管理业务单据打印模板目录。", parentId: "master-data", pageType: "list", viewId: "print-templates", order: 28 }),

  module({ id: "procurement", path: "/app/procurement", moduleId: "procurement", moduleLabel: "采购管理", label: "采购管理", description: "管理采购订单、收货、退货、申请与询价。", icon: Handshake, defaultChildId: "procurement:orders", group: "主导航", order: 30 }),
  page({ id: "procurement:orders", path: "/app/procurement/orders", moduleId: "procurement", moduleLabel: "采购管理", label: "采购订单", description: "查看采购订单及履约状态。", parentId: "procurement", pageType: "list", viewId: "orders", legacyIds: ["purchasing"], order: 31 }),
  page({ id: "procurement:receiving", path: "/app/procurement/receiving", moduleId: "procurement", moduleLabel: "采购管理", label: "采购收货单 / 入库单", description: "管理采购到货、质检与入库记录。", parentId: "procurement", pageType: "list", viewId: "receiving", legacyIds: ["receiving"], order: 32 }),
  { id: "procurement:receiving:new", path: "/app/procurement/receiving/new", moduleId: "procurement", moduleLabel: "采购管理", label: "新建收货单", description: "创建采购收货草稿。", parentId: "procurement:receiving", pageType: "create", currentActiveMenuId: "procurement:receiving", panelId: "procurement", viewId: "receiving-new", showInSidebar: false, showInModuleNav: false, showInBreadcrumb: true, order: 32.1 },
  { id: "procurement:receiving:edit", path: "/app/procurement/receiving/:id/edit", moduleId: "procurement", moduleLabel: "采购管理", label: "编辑收货单", description: "编辑采购收货草稿。", parentId: "procurement:receiving", pageType: "edit", currentActiveMenuId: "procurement:receiving", panelId: "procurement", viewId: "receiving-edit", showInSidebar: false, showInModuleNav: false, showInBreadcrumb: true, order: 32.2 },
  page({ id: "procurement:returns", path: "/app/procurement/returns", moduleId: "procurement", moduleLabel: "采购管理", label: "采购退货单", description: "处理采购退货和供应商返运。", parentId: "procurement", pageType: "list", viewId: "returns", order: 33 }),
  page({ id: "procurement:requests", path: "/app/procurement/requests", moduleId: "procurement", moduleLabel: "采购管理", label: "采购申请", description: "查看采购需求与申请。", parentId: "procurement", pageType: "list", viewId: "requests", legacyIds: ["purchaseRequests"], order: 34 }),
  page({ id: "procurement:rfq", path: "/app/procurement/rfq", moduleId: "procurement", moduleLabel: "采购管理", label: "询价 / RFQ", description: "管理询价、报价和比价。", parentId: "procurement", pageType: "list", viewId: "rfq", legacyIds: ["rfq"], order: 35 }),
  { id: "procurement:contracts", path: "/app/procurement/contracts", moduleId: "procurement", moduleLabel: "采购管理", label: "框架合同", description: "查看现有框架合同目录。", parentId: "procurement", pageType: "list", viewId: "contracts", showInSidebar: false, showInModuleNav: false, showInBreadcrumb: true, order: 36 },

  module({ id: "sales", path: "/app/sales", moduleId: "sales", moduleLabel: "销售管理", label: "销售订单", description: "管理销售订单和客户履约。", icon: ClipboardList, defaultChildId: "sales:orders", viewId: "orders", group: "主导航", order: 40 }),
  page({ id: "sales:orders", path: "/app/sales/orders", moduleId: "sales", moduleLabel: "销售管理", label: "销售订单", description: "管理客户订单、数量和承诺日期。", parentId: "sales", pageType: "list", viewId: "orders", order: 41 }),
  page({ id: "sales:delivery", path: "/app/sales/deliveries", moduleId: "sales", moduleLabel: "销售管理", label: "销售出库单 / 发货单", description: "管理拣货、出库和物流发运。", parentId: "sales", pageType: "list", viewId: "delivery", order: 42 }),
  { id: "sales:delivery:new", path: "/app/sales/deliveries/new", moduleId: "sales", moduleLabel: "销售管理", label: "新建发货单", description: "创建销售发货草稿。", parentId: "sales:delivery", pageType: "create", currentActiveMenuId: "sales:delivery", viewId: "delivery-new", showInSidebar: false, showInModuleNav: false, showInBreadcrumb: true, order: 42.1 },
  { id: "sales:delivery:edit", path: "/app/sales/deliveries/:id/edit", moduleId: "sales", moduleLabel: "销售管理", label: "编辑发货单", description: "编辑销售发货草稿。", parentId: "sales:delivery", pageType: "edit", currentActiveMenuId: "sales:delivery", viewId: "delivery-edit", showInSidebar: false, showInModuleNav: false, showInBreadcrumb: true, order: 42.2 },
  page({ id: "sales:receipts", path: "/app/sales/receipts", moduleId: "sales", moduleLabel: "销售管理", label: "签收单", description: "记录客户签收和收货差异。", parentId: "sales", pageType: "list", viewId: "receipts", order: 43 }),
  { id: "sales:receipts:new", path: "/app/sales/receipts/new", moduleId: "sales", moduleLabel: "销售管理", label: "新建签收单", description: "创建客户签收草稿。", parentId: "sales:receipts", pageType: "create", currentActiveMenuId: "sales:receipts", viewId: "receipts-new", showInSidebar: false, showInModuleNav: false, showInBreadcrumb: true, order: 43.1 },
  page({ id: "sales:returns", path: "/app/sales/returns", moduleId: "sales", moduleLabel: "销售管理", label: "销售退货单", description: "处理客户退货和退回入库。", parentId: "sales", pageType: "list", viewId: "returns", order: 44 }),
  { id: "sales:returns:new", path: "/app/sales/returns/new", moduleId: "sales", moduleLabel: "销售管理", label: "新建销售退货单", description: "创建销售退货草稿。", parentId: "sales:returns", pageType: "create", currentActiveMenuId: "sales:returns", viewId: "returns-new", showInSidebar: false, showInModuleNav: false, showInBreadcrumb: true, order: 44.1 },
  page({ id: "sales:risks", path: "/app/sales/risks", moduleId: "sales", moduleLabel: "销售管理", label: "交付风险", description: "识别影响交付承诺的风险。", parentId: "sales", pageType: "analysis", viewId: "risks", order: 45 }),
  page({ id: "sales:evidence", path: "/app/sales/evidence", moduleId: "sales", moduleLabel: "销售管理", label: "订单证据链", description: "查看销售订单的跨单据关联。", parentId: "sales", pageType: "analysis", viewId: "evidence", order: 46 }),

  module({ id: "inventory", path: "/app/inventory", moduleId: "inventory", moduleLabel: "库存管理", label: "库存查询", description: "查看库存余额、可用量和补货参数。", icon: Package, defaultChildId: "inventory:stock", viewId: "overview", group: "主导航", order: 50 }),
  page({ id: "inventory:stock", path: "/app/inventory/stock", moduleId: "inventory", moduleLabel: "库存管理", label: "库存查询", description: "按 SKU 和仓库查看库存。", parentId: "inventory", pageType: "list", viewId: "overview", order: 51 }),
  page({ id: "inventory:movements", path: "/app/inventory/movements", moduleId: "inventory", moduleLabel: "库存管理", label: "库存流水", description: "查看入库、出库、调拨和调整流水。", parentId: "inventory", pageType: "list", viewId: "movements", order: 52 }),
  page({ id: "inventory:adjustments", path: "/app/inventory/adjustments", moduleId: "inventory", moduleLabel: "库存管理", label: "库存调整单", description: "管理盘盈、盘亏和报损调整。", parentId: "inventory", pageType: "list", viewId: "adjustments", order: 53 }),
  { id: "inventory:adjustments:new", path: "/app/inventory/adjustments/new", moduleId: "inventory", moduleLabel: "库存管理", label: "新建库存调整单", description: "创建库存调整草稿。", parentId: "inventory:adjustments", pageType: "create", currentActiveMenuId: "inventory:adjustments", viewId: "adjustments-new", showInSidebar: false, showInModuleNav: false, showInBreadcrumb: true, order: 53.1 },
  page({ id: "inventory:count", path: "/app/inventory/counts", moduleId: "inventory", moduleLabel: "库存管理", label: "库存盘点", description: "管理盘点计划和盘点差异。", parentId: "inventory", pageType: "list", viewId: "count", order: 54 }),
  page({ id: "inventory:warnings", path: "/app/inventory/warnings", moduleId: "inventory", moduleLabel: "库存管理", label: "库存预警", description: "查看安全库存和再订货风险。", parentId: "inventory", pageType: "list", viewId: "warnings", order: 55 }),
  page({ id: "inventory:transfer", path: "/app/inventory/transfers", moduleId: "inventory", moduleLabel: "库存管理", label: "仓库调拨", description: "查看仓库间调拨和在途状态。", parentId: "inventory", pageType: "list", viewId: "transfer", order: 56 }),
  page({ id: "inventory:lots", path: "/app/inventory/lots", moduleId: "inventory", moduleLabel: "库存管理", label: "批次 / 序列号", description: "追踪批次、序列号和效期。", parentId: "inventory", pageType: "list", viewId: "lots", order: 57 }),
  page({ id: "inventory:bins", path: "/app/inventory/bins", moduleId: "inventory", moduleLabel: "库存管理", label: "库位管理", description: "查看库位容量和可用状态。", parentId: "inventory", pageType: "list", viewId: "bins", legacyIds: ["inventory:warehouse-map"], order: 58 }),
  page({ id: "inventory:exceptions", path: "/app/inventory/exceptions", moduleId: "inventory", moduleLabel: "库存管理", label: "库存异常", description: "处理库存差异、冻结和调拨异常。", parentId: "inventory", pageType: "list", viewId: "exceptions", order: 59 }),

  module({ id: "finance", path: "/app/finance", moduleId: "finance", moduleLabel: "结算管理", label: "结算管理", description: "管理费用、发票、对账和结算。", icon: Users, defaultChildId: "finance:invoices", viewId: "overview", group: "主导航", order: 60 }),
  page({ id: "finance:invoices", path: "/app/finance/invoices", moduleId: "finance", moduleLabel: "结算管理", label: "供应商发票", description: "查看供应商发票及匹配状态。", parentId: "finance", pageType: "list", viewId: "invoices", order: 61 }),
  page({ id: "finance:payables", path: "/app/finance/payables", moduleId: "finance", moduleLabel: "结算管理", label: "费用单 / 应付", description: "查看费用和应付项目。", parentId: "finance", pageType: "list", viewId: "payables", order: 62 }),
  page({ id: "finance:credits", path: "/app/finance/credits", moduleId: "finance", moduleLabel: "结算管理", label: "预付款 / 贷项", description: "查看预付款和贷项记录。", parentId: "finance", pageType: "list", viewId: "credits", order: 63 }),
  page({ id: "finance:reconciliation", path: "/app/finance/reconciliation", moduleId: "finance", moduleLabel: "结算管理", label: "对账单", description: "核对业务往来和差异。", parentId: "finance", pageType: "list", viewId: "reconciliation", order: 64 }),
  page({ id: "finance:settlement", path: "/app/finance/settlement", moduleId: "finance", moduleLabel: "结算管理", label: "结算单", description: "查看结算与核销状态。", parentId: "finance", pageType: "list", viewId: "settlement", order: 65 }),
  page({ id: "finance:three-way-match", path: "/app/finance/three-way-match", moduleId: "finance", moduleLabel: "结算管理", label: "三单匹配", description: "比对采购订单、收货单和发票。", parentId: "finance", pageType: "analysis", panelId: "procurement", viewId: "match", legacyIds: ["procurement:match"], order: 66 }),

  module({ id: "reports", path: "/app/reports", moduleId: "reports", moduleLabel: "报表中心", label: "经营统计", description: "查看采购、销售、库存和结算报表。", icon: FileSpreadsheet, defaultChildId: "reports", group: "主导航", order: 70 }),
  page({ id: "reports:procurement", path: "/app/reports/procurement", moduleId: "reports", moduleLabel: "报表中心", label: "采购报表", parentId: "reports", pageType: "analysis", viewId: "procurement", order: 71 }),
  page({ id: "reports:delivery", path: "/app/reports/delivery", moduleId: "reports", moduleLabel: "报表中心", label: "销售报表", parentId: "reports", pageType: "analysis", viewId: "delivery", order: 72 }),
  page({ id: "reports:inventory", path: "/app/reports/inventory", moduleId: "reports", moduleLabel: "报表中心", label: "库存报表", parentId: "reports", pageType: "analysis", viewId: "inventory", order: 73 }),
  page({ id: "reports:finance", path: "/app/reports/finance", moduleId: "reports", moduleLabel: "报表中心", label: "结算报表", parentId: "reports", pageType: "analysis", viewId: "finance", order: 74 }),
  page({ id: "reports:quality", path: "/app/reports/quality", moduleId: "reports", moduleLabel: "报表中心", label: "数据质量", parentId: "reports", pageType: "analysis", viewId: "quality", order: 75 }),

  module({ id: "settings", path: "/app/settings", moduleId: "settings", moduleLabel: "系统管理", label: "系统参数", description: "管理编号、权限、菜单和系统策略。", icon: Settings, defaultChildId: "settings", pageType: "settings", group: "主导航", order: 80 }),
  page({ id: "settings:numbering", path: "/app/settings/numbering", moduleId: "settings", moduleLabel: "系统管理", label: "编号规则", parentId: "settings", pageType: "settings", viewId: "numbering", order: 81 }),
  page({ id: "settings:roles", path: "/app/settings/roles", moduleId: "settings", moduleLabel: "系统管理", label: "角色权限", parentId: "settings", pageType: "settings", viewId: "roles", order: 82 }),
  page({ id: "settings:modules", path: "/app/settings/modules", moduleId: "settings", moduleLabel: "系统管理", label: "菜单 / 模块", parentId: "settings", pageType: "settings", viewId: "modules", order: 83 }),
  page({ id: "settings:audit", path: "/app/settings/audit", moduleId: "settings", moduleLabel: "系统管理", label: "操作日志", parentId: "settings", pageType: "settings", panelId: "audit-history", viewId: "settings", legacyIds: ["audit-history:settings"], order: 84 }),
  page({ id: "settings:ai", path: "/app/settings/ai", moduleId: "settings", moduleLabel: "系统管理", label: "AI 设置", parentId: "settings", pageType: "settings", viewId: "ai", order: 85 }),
  page({ id: "settings:review", path: "/app/settings/review", moduleId: "settings", moduleLabel: "系统管理", label: "复核策略", parentId: "settings", pageType: "settings", viewId: "review", order: 86 }),

  module({ id: "forecast", path: "/app/forecast", moduleId: "forecast", moduleLabel: "预测与 MRP", label: "计划驾驶舱", icon: TrendingUp, defaultChildId: "forecast:cockpit", viewId: "cockpit", group: "高级与内部", order: 110 }),
  page({ id: "forecast:cockpit", path: "/app/forecast/cockpit", moduleId: "forecast", moduleLabel: "预测与 MRP", label: "计划驾驶舱", parentId: "forecast", pageType: "analysis", viewId: "cockpit", order: 111 }),
  page({ id: "forecast:demand", path: "/app/forecast/demand", moduleId: "forecast", moduleLabel: "预测与 MRP", label: "需求预测", parentId: "forecast", pageType: "analysis", viewId: "demand", order: 112 }),
  page({ id: "forecast:mrp", path: "/app/forecast/mrp", moduleId: "forecast", moduleLabel: "预测与 MRP", label: "MRP 计划", parentId: "forecast", pageType: "analysis", viewId: "mrp", order: 113 }),
  page({ id: "forecast:replenishment", path: "/app/forecast/replenishment", moduleId: "forecast", moduleLabel: "预测与 MRP", label: "补货工作台", parentId: "forecast", pageType: "analysis", viewId: "replenishment", order: 114 }),
  page({ id: "forecast:parameters", path: "/app/forecast/parameters", moduleId: "forecast", moduleLabel: "预测与 MRP", label: "计划参数", parentId: "forecast", pageType: "settings", viewId: "parameters", order: 115 }),
  module({ id: "imports", path: "/app/imports", moduleId: "imports", moduleLabel: "数据接入与质量", label: "导入任务", icon: Upload, defaultChildId: "imports", group: "高级与内部", order: 120 }),
  page({ id: "imports:templates", path: "/app/imports/templates", moduleId: "imports", moduleLabel: "数据接入与质量", label: "字段映射", parentId: "imports", pageType: "settings", viewId: "templates", order: 121 }),
  page({ id: "imports:validation", path: "/app/imports/validation", moduleId: "imports", moduleLabel: "数据接入与质量", label: "质量检查", parentId: "imports", pageType: "analysis", viewId: "validation", order: 122 }),
  page({ id: "imports:failed", path: "/app/imports/failed", moduleId: "imports", moduleLabel: "数据接入与质量", label: "失败项处理", parentId: "imports", pageType: "list", viewId: "failed", order: 123 }),
  module({ id: "exception-cases", path: "/app/exception-cases", moduleId: "exception-cases", moduleLabel: "异常处理工单", label: "工单列表", icon: AlertTriangle, defaultChildId: "exception-cases", group: "高级与内部", order: 130 }),
  page({ id: "exception-cases:open", path: "/app/exception-cases/open", moduleId: "exception-cases", moduleLabel: "异常处理工单", label: "未关闭工单", parentId: "exception-cases", pageType: "list", viewId: "open", order: 131 }),
  page({ id: "exception-cases:review", path: "/app/exception-cases/review", moduleId: "exception-cases", moduleLabel: "异常处理工单", label: "复核队列", parentId: "exception-cases", pageType: "list", viewId: "review", order: 132 }),
  module({ id: "collaboration-drafts", path: "/app/collaboration-drafts", moduleId: "collaboration-drafts", moduleLabel: "协同通知草稿", label: "通知草稿列表", icon: MessageSquareText, defaultChildId: "collaboration-drafts", group: "高级与内部", order: 140 }),
  page({ id: "collaboration-drafts:review", path: "/app/collaboration-drafts/review", moduleId: "collaboration-drafts", moduleLabel: "协同通知草稿", label: "人工复核视图", parentId: "collaboration-drafts", pageType: "list", viewId: "review", order: 141 }),
  page({ id: "collaboration-drafts:limited", path: "/app/collaboration-drafts/limited", moduleId: "collaboration-drafts", moduleLabel: "协同通知草稿", label: "数据限制草稿", parentId: "collaboration-drafts", pageType: "list", viewId: "limited", order: 142 }),
  module({ id: "review-actions", path: "/app/review-actions", moduleId: "review-actions", moduleLabel: "行动草稿与人工复核", label: "行动草稿工作台", icon: FileCheck2, defaultChildId: "review-actions", group: "高级与内部", order: 150 }),
  page({ id: "review-actions:waiting", path: "/app/review-actions/waiting", moduleId: "review-actions", moduleLabel: "行动草稿与人工复核", label: "等待人工复核", parentId: "review-actions", pageType: "list", viewId: "waiting", order: 151 }),
  page({ id: "review-actions:data-limited", path: "/app/review-actions/data-limited", moduleId: "review-actions", moduleLabel: "行动草稿与人工复核", label: "数据限制草稿", parentId: "review-actions", pageType: "list", viewId: "data-limited", order: 152 }),
  module({ id: "audit-history", path: "/app/audit-history", moduleId: "audit-history", moduleLabel: "业务审计与历史", label: "历史总览", icon: History, defaultChildId: "audit-history", group: "高级与内部", order: 160 }),
  page({ id: "audit-history:ai", path: "/app/audit-history/ai", moduleId: "audit-history", moduleLabel: "业务审计与历史", label: "AI 建议历史", parentId: "audit-history", pageType: "list", viewId: "ai", order: 161 }),
  page({ id: "audit-history:drafts", path: "/app/audit-history/drafts", moduleId: "audit-history", moduleLabel: "业务审计与历史", label: "草稿复核历史", parentId: "audit-history", pageType: "list", viewId: "drafts", order: 162 }),
  page({ id: "audit-history:data", path: "/app/audit-history/data", moduleId: "audit-history", moduleLabel: "业务审计与历史", label: "数据接入历史", parentId: "audit-history", pageType: "list", viewId: "data", order: 163 }),
  page({ id: "audit-history:objects", path: "/app/audit-history/objects", moduleId: "audit-history", moduleLabel: "业务审计与历史", label: "业务对象历史", parentId: "audit-history", pageType: "list", viewId: "objects", order: 164 }),
  module({ id: "pilot-readiness", path: "/app/pilot-readiness", moduleId: "pilot-readiness", moduleLabel: "试点准备度", label: "准备度总览", icon: Gauge, defaultChildId: "pilot-readiness", group: "高级与内部", order: 170 }),
  page({ id: "pilot-readiness:modules", path: "/app/pilot-readiness/modules", moduleId: "pilot-readiness", moduleLabel: "试点准备度", label: "模块准备度", parentId: "pilot-readiness", pageType: "analysis", viewId: "modules", order: 171 }),
  page({ id: "pilot-readiness:data", path: "/app/pilot-readiness/data", moduleId: "pilot-readiness", moduleLabel: "试点准备度", label: "数据准备度", parentId: "pilot-readiness", pageType: "analysis", viewId: "data", order: 172 }),
  page({ id: "pilot-readiness:ai", path: "/app/pilot-readiness/ai", moduleId: "pilot-readiness", moduleLabel: "试点准备度", label: "AI 与复核准备度", parentId: "pilot-readiness", pageType: "analysis", viewId: "ai", order: 173 }),
  page({ id: "pilot-readiness:governance", path: "/app/pilot-readiness/governance", moduleId: "pilot-readiness", moduleLabel: "试点准备度", label: "治理准备度", parentId: "pilot-readiness", pageType: "analysis", viewId: "governance", order: 174 }),
  page({ id: "pilot-readiness:checklist", path: "/app/pilot-readiness/checklist", moduleId: "pilot-readiness", moduleLabel: "试点准备度", label: "试点复核清单", parentId: "pilot-readiness", pageType: "list", viewId: "checklist", order: 175 }),
];

const normalizePath = (value: string) => value.length > 1 ? value.replace(/\/+$/, "") : value;

export function routeByPath(pathname: string) {
  const path = normalizePath(pathname);
  return appRouteRegistry.find((route) => route.path === path)
    || appRouteRegistry.find((route) => route.path.includes(":") && new RegExp(`^${route.path.replace(/:[^/]+/g, "[^/]+")}$`).test(path));
}

export function routeById(id: string) {
  return appRouteRegistry.find((route) => route.id === id)
    || appRouteRegistry.find((route) => route.legacyIds?.includes(id));
}

export function routePathForId(id: string) {
  return routeById(id)?.path || "/app/overview";
}

export function moduleRoute(moduleId: string) {
  return appRouteRegistry.find((route) => route.moduleId === moduleId && !route.parentId);
}

export function defaultRouteForModule(moduleId: string) {
  const root = moduleRoute(moduleId);
  return routeById(root?.defaultChildId || root?.id || "overview") || root;
}

export function routesForModule(moduleId: string) {
  return appRouteRegistry.filter((route) => route.moduleId === moduleId && route.showInModuleNav).sort((a, b) => a.order - b.order);
}

export function breadcrumbRoutes(route: AppRouteDefinition) {
  const home = routeById("overview")!;
  const ancestors: AppRouteDefinition[] = [];
  let current: AppRouteDefinition | undefined = route;
  while (current) {
    ancestors.unshift(current);
    current = current.parentId ? routeById(current.parentId) : undefined;
  }
  const result = route.moduleId === "overview" ? ancestors : [home, ...ancestors];
  return result.filter((item, index) => item.showInBreadcrumb !== false && result.findIndex((candidate) => candidate.id === item.id) === index);
}

export function recoveryModuleForPath(pathname: string) {
  return appRouteRegistry.find((route) => !route.parentId && pathname.startsWith(`${route.path}/`));
}

const modules = appRouteRegistry.filter((route) => route.showInSidebar && !route.parentId).sort((a, b) => a.order - b.order);

export const navItems = modules.map((root) => ({
  icon: root.icon || Database,
  label: root.moduleLabel,
  id: root.moduleId,
  routeId: root.id,
  children: routesForModule(root.moduleId).map((route) => ({ id: route.id, label: route.label, path: route.path })),
}));

export const navGroups = (["主导航", "高级与内部"] as const).map((label) => ({
  label,
  itemIds: modules.filter((route) => route.group === label).map((route) => route.moduleId),
  defaultCollapsed: label === "高级与内部",
}));
