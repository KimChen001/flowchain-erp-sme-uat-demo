import {
  BarChart2,
  CircleDollarSign,
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
  History,
  Settings,
} from "lucide-react";

export const navItems = [
  {
    icon: BarChart2, label: "每日工作台", id: "overview",
    children: [
      { id: "overview", label: "今日行动" },
      { id: "overview:ai", label: "AI 建议" },
    ],
  },
  {
    icon: ClipboardList, label: "销售需求", id: "sales",
    children: [
      { id: "sales", label: "客户订单" },
      { id: "sales:risks", label: "交付风险" },
      { id: "sales:evidence", label: "订单证据链" },
    ],
  },
  {
    icon: Handshake, label: "采购管理", id: "procurement",
    children: [
      { id: "procurement", label: "采购工作台" },
      { id: "procurement:requests", label: "采购申请" },
      { id: "procurement:rfq", label: "寻源 / RFx" },
      { id: "procurement:orders", label: "采购订单" },
      { id: "procurement:contracts", label: "框架合同" },
      { id: "procurement:receiving", label: "收货协同" },
      { id: "procurement:invoices", label: "发票协同" },
      { id: "procurement:match", label: "三单匹配" },
      { id: "procurement:returns", label: "采购退货 / 贷项" },
    ],
  },
  {
    icon: Package, label: "库存管理", id: "inventory",
    children: [
      { id: "inventory", label: "库存工作台" },
      { id: "inventory:movements", label: "库存事务流水" },
      { id: "inventory:exceptions", label: "库存异常单据" },
      { id: "inventory:lots", label: "批次 / 序列号" },
      { id: "inventory:transfer", label: "库间调拨" },
      { id: "inventory:count", label: "循环盘点" },
      { id: "inventory:abcxyz", label: "ABC/XYZ 分类" },
      { id: "inventory:bins", label: "库位地图" },
    ],
  },
  {
    icon: Users, label: "供应商管理", id: "srm",
    children: [
      { id: "srm", label: "SRM 总览" },
      { id: "srm:master", label: "供应商资料目录" },
      { id: "srm:performance", label: "绩效评分与风险队列" },
      { id: "srm:certification", label: "认证资料与准入复核" },
      { id: "srm:sourcing", label: "RFx 参与" },
      { id: "srm:contracts", label: "合同与目录" },
    ],
  },
  {
    icon: Database, label: "基础资料", id: "master-data",
    children: [
      { id: "master-data", label: "基础资料总览" },
      { id: "master-data:items", label: "物料资料" },
      { id: "master-data:suppliers", label: "供应商资料" },
      { id: "master-data:warehouses", label: "仓库资料" },
      { id: "master-data:tax-codes", label: "条款与税码" },
      { id: "master-data:payment-terms", label: "付款条款" },
    ],
  },
  {
    icon: CircleDollarSign, label: "财务协同", id: "finance",
    children: [
      { id: "finance", label: "财务总览" },
      { id: "finance:invoices", label: "供应商发票" },
      { id: "finance:payables", label: "应付账款" },
      { id: "finance:credits", label: "贷项冲减" },
      { id: "finance:reconciliation", label: "供应商对账" },
      { id: "finance:settlement", label: "结算准备" },
    ],
  },
  {
    icon: TrendingUp, label: "预测与 MRP 物料需求计划", id: "forecast",
    children: [
      { id: "forecast:cockpit", label: "计划驾驶舱" },
      { id: "forecast:demand", label: "需求预测" },
      { id: "forecast:mrp", label: "MRP 计划" },
      { id: "forecast:replenishment", label: "补货工作台" },
      { id: "forecast:parameters", label: "计划参数" },
    ],
  },
  {
    icon: FileSpreadsheet, label: "报表与分析", id: "reports",
    children: [
      { id: "reports", label: "报表总览" },
      { id: "reports:procurement", label: "采购报表" },
      { id: "reports:inventory", label: "库存报表" },
      { id: "reports:finance", label: "供应商报表" },
      { id: "reports:delivery", label: "交付风险报表" },
      { id: "reports:quality", label: "数据质量报表" },
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
    icon: Settings, label: "系统设置", id: "settings",
    children: [
      { id: "settings", label: "工作区配置" },
      { id: "settings:roles", label: "角色权限可见性" },
      { id: "settings:boundaries", label: "工作区边界" },
      { id: "settings:modules", label: "模块启用状态" },
      { id: "settings:review", label: "复核策略" },
      { id: "settings:numbering", label: "编号规则" },
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
  { label: "运营", itemIds: ["overview"] },
  { label: "供应链", itemIds: ["sales", "procurement", "inventory", "srm", "finance", "forecast", "exception-cases", "collaboration-drafts", "review-actions"] },
  { label: "数据", itemIds: ["master-data", "reports", "imports"] },
  { label: "治理", itemIds: ["audit-history", "settings"] },
] as const;
