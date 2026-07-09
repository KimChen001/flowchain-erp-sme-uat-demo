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
    icon: BarChart2, label: "今日工作台", id: "overview",
    children: [
      { id: "overview", label: "今日待办" },
      { id: "overview:risks", label: "交付与库存风险" },
      { id: "overview:ai", label: "AI 摘要" },
    ],
  },
  {
    icon: ClipboardList, label: "销售", id: "sales",
    children: [
      { id: "sales", label: "客户订单" },
      { id: "sales:risks", label: "交付风险" },
      { id: "sales:evidence", label: "订单证据链" },
    ],
  },
  {
    icon: Handshake, label: "采购", id: "procurement",
    children: [
      { id: "procurement", label: "采购工作台" },
      { id: "procurement:requests", label: "采购申请" },
      { id: "procurement:rfq", label: "询价 / RFQ" },
      { id: "procurement:orders", label: "采购订单" },
      { id: "procurement:receiving", label: "收货" },
      { id: "procurement:invoices", label: "发票匹配" },
    ],
  },
  {
    icon: Package, label: "库存", id: "inventory",
    children: [
      { id: "inventory", label: "库存工作台" },
      { id: "inventory:movements", label: "出入库流水" },
      { id: "inventory:exceptions", label: "库存异常" },
      { id: "inventory:count", label: "盘点" },
    ],
  },
  {
    icon: Users, label: "供应商与对账", id: "srm",
    routeAliases: ["finance"],
    children: [
      { id: "srm:master", label: "供应商列表" },
      { id: "srm:performance", label: "供应商风险" },
      { id: "finance:invoices", label: "供应商发票" },
      { id: "procurement:match", label: "三单匹配" },
      { id: "finance:reconciliation", label: "供应商对账" },
    ],
  },
  {
    icon: FileSpreadsheet, label: "报表", id: "reports",
    children: [
      { id: "reports", label: "报表总览" },
      { id: "reports:procurement", label: "采购分析" },
      { id: "reports:inventory", label: "库存分析" },
      { id: "reports:delivery", label: "销售与交付" },
      { id: "reports:finance", label: "供应商与对账" },
      { id: "reports:quality", label: "数据质量" },
    ],
  },
  {
    icon: Database, label: "基础设置", id: "master-data",
    children: [
      { id: "master-data:items", label: "物料资料" },
      { id: "master-data:suppliers", label: "供应商资料" },
      { id: "master-data:warehouses", label: "仓库资料" },
      { id: "imports", label: "数据导入" },
      { id: "settings:numbering", label: "编号规则" },
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
    icon: Settings, label: "系统设置", id: "settings",
    children: [
      { id: "settings", label: "工作区配置" },
      { id: "settings:roles", label: "角色权限可见性" },
      { id: "settings:boundaries", label: "工作区边界" },
      { id: "settings:modules", label: "模块启用状态" },
      { id: "settings:review", label: "复核策略" },
      { id: "settings:ai", label: "AI 边界" },
      { id: "settings:collaboration", label: "协同草稿策略" },
      { id: "settings:data-quality", label: "数据质量设置" },
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
  { label: "主工作区", itemIds: ["overview"] },
  { label: "进销存业务", itemIds: ["sales", "procurement", "inventory", "srm"] },
  { label: "经营管理", itemIds: ["reports", "master-data"] },
  { label: "高级与内部", itemIds: ["forecast", "imports", "exception-cases", "collaboration-drafts", "review-actions", "audit-history", "pilot-readiness", "settings"], defaultCollapsed: true },
] as const;
