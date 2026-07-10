import {
  BarChart2,
  FileSpreadsheet,
  Handshake,
  Database,
  AlertTriangle,
  MessageSquareText,
  Package,
  Users,
  TrendingUp,
  Upload,
  ClipboardList,
  FileCheck2,
  Gauge,
  History,
  Settings,
} from "lucide-react";

export const navItems = [
  {
    icon: BarChart2, label: "首页", id: "overview",
    children: [
      { id: "overview", label: "今日待办" },
      { id: "overview:risks", label: "经营预警" },
      { id: "overview:ai", label: "AI 摘要" },
    ],
  },
  {
    icon: Database, label: "基础资料", id: "master-data",
    routeAliases: ["srm"],
    children: [
      { id: "master-data:items", label: "商品资料 / 物料资料" },
      { id: "master-data:warehouses", label: "仓库资料" },
      { id: "inventory:bins", label: "库位 / 货位" },
      { id: "srm:master", label: "供应商" },
      { id: "master-data:customers", label: "客户" },
      { id: "master-data:payment-terms", label: "支付方式 / 付款条款" },
      { id: "master-data:tax-codes", label: "税码" },
      { id: "master-data:print-templates", label: "打印模板" },
    ],
  },
  {
    icon: Handshake, label: "采购管理", id: "procurement",
    children: [
      { id: "procurement:orders", label: "采购订单" },
      { id: "procurement:receiving", label: "采购收货单 / 入库单" },
      { id: "procurement:returns", label: "采购退货单" },
      { id: "procurement:requests", label: "采购申请" },
      { id: "procurement:rfq", label: "询价 / RFQ" },
    ],
  },
  {
    icon: ClipboardList, label: "销售管理", id: "sales",
    children: [
      { id: "sales", label: "销售订单" },
      { id: "sales:delivery", label: "销售出库单 / 发货单" },
      { id: "sales:receipts", label: "签收单" },
      { id: "sales:returns", label: "销售退货单" },
      { id: "sales:risks", label: "交付风险" },
      { id: "sales:evidence", label: "订单证据链" },
    ],
  },
  {
    icon: Package, label: "库存管理", id: "inventory",
    children: [
      { id: "inventory", label: "库存查询" },
      { id: "inventory:movements", label: "库存流水" },
      { id: "inventory:adjustments", label: "库存调整单" },
      { id: "inventory:count", label: "库存盘点" },
      { id: "inventory:warnings", label: "库存预警" },
      { id: "inventory:transfer", label: "仓库调拨" },
      { id: "inventory:lots", label: "批次 / 序列号" },
      { id: "inventory:bins", label: "库位管理" },
      { id: "inventory:exceptions", label: "库存异常" },
    ],
  },
  {
    icon: Users, label: "结算管理", id: "finance",
    children: [
      { id: "finance:invoices", label: "供应商发票" },
      { id: "finance:payables", label: "费用单 / 应付" },
      { id: "finance:credits", label: "预付款 / 贷项" },
      { id: "finance:reconciliation", label: "对账单" },
      { id: "finance:settlement", label: "结算单" },
      { id: "procurement:match", label: "三单匹配" },
    ],
  },
  {
    icon: FileSpreadsheet, label: "报表中心", id: "reports",
    children: [
      { id: "reports:procurement", label: "采购报表" },
      { id: "reports:delivery", label: "销售报表" },
      { id: "reports:inventory", label: "库存报表" },
      { id: "reports:finance", label: "结算报表" },
      { id: "reports", label: "经营统计" },
      { id: "reports:quality", label: "数据质量" },
    ],
  },
  {
    icon: Settings, label: "系统管理", id: "settings",
    children: [
      { id: "settings:numbering", label: "编号规则" },
      { id: "settings:roles", label: "角色权限" },
      { id: "settings:modules", label: "菜单 / 模块" },
      { id: "settings", label: "系统参数" },
      { id: "audit-history:settings", label: "操作日志" },
      { id: "settings:ai", label: "AI 设置" },
      { id: "settings:review", label: "复核策略" },
    ],
  },
  {
    icon: TrendingUp, label: "预测与 MRP", id: "forecast",
    children: [
      { id: "forecast:cockpit", label: "计划驾驶舱" },
      { id: "forecast:demand", label: "需求预测" },
      { id: "forecast:mrp", label: "MRP 计划" },
      { id: "forecast:replenishment", label: "补货工作台" },
      { id: "forecast:parameters", label: "计划参数" },
    ],
  },
  {
    icon: AlertTriangle, label: "异常处理工单", id: "exception-cases",
    children: [
      { id: "exception-cases", label: "工单列表" },
      { id: "exception-cases:open", label: "未关闭工单" },
      { id: "exception-cases:review", label: "复核队列" },
    ],
  },
  {
    icon: MessageSquareText, label: "协同通知草稿", id: "collaboration-drafts",
    children: [
      { id: "collaboration-drafts", label: "通知草稿列表" },
      { id: "collaboration-drafts:review", label: "人工复核视图" },
      { id: "collaboration-drafts:limited", label: "数据限制草稿" },
    ],
  },
  {
    icon: FileCheck2, label: "行动草稿与人工复核", id: "review-actions",
    children: [
      { id: "review-actions", label: "行动草稿工作台" },
      { id: "review-actions:waiting", label: "等待人工复核" },
      { id: "review-actions:data-limited", label: "数据限制草稿" },
    ],
  },
  {
    icon: History, label: "业务审计与历史", id: "audit-history",
    children: [
      { id: "audit-history", label: "历史总览" },
      { id: "audit-history:ai", label: "AI 建议历史" },
      { id: "audit-history:drafts", label: "草稿复核历史" },
      { id: "audit-history:data", label: "数据接入历史" },
      { id: "audit-history:settings", label: "设置与权限历史" },
      { id: "audit-history:objects", label: "业务对象历史" },
    ],
  },
  {
    icon: Gauge, label: "试点准备度", id: "pilot-readiness",
    children: [
      { id: "pilot-readiness", label: "准备度总览" },
      { id: "pilot-readiness:modules", label: "模块准备度" },
      { id: "pilot-readiness:data", label: "数据准备度" },
      { id: "pilot-readiness:ai", label: "AI 与复核准备度" },
      { id: "pilot-readiness:governance", label: "治理准备度" },
      { id: "pilot-readiness:checklist", label: "试点复核清单" },
    ],
  },
  {
    icon: Upload, label: "数据接入与质量", id: "imports",
    children: [
      { id: "imports", label: "导入任务" },
      { id: "imports:templates", label: "字段映射" },
      { id: "imports:validation", label: "质量检查" },
      { id: "imports:failed", label: "失败项处理" },
    ],
  },
] as const;

export const navGroups = [
  { label: "主导航", itemIds: ["overview", "master-data", "procurement", "sales", "inventory", "finance", "reports", "settings"] },
  { label: "高级与内部", itemIds: ["forecast", "imports", "exception-cases", "collaboration-drafts", "review-actions", "audit-history", "pilot-readiness"], defaultCollapsed: true },
] as const;
