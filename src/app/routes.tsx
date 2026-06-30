import {
  BarChart2,
  CircleDollarSign,
  FileSpreadsheet,
  Handshake,
  Database,
  Package,
  Users,
  TrendingUp,
  Upload,
} from "lucide-react";

export const navItems = [
  {
    icon: BarChart2, label: "每日工作台", id: "overview",
    children: [
      { id: "overview", label: "今日行动" },
      { id: "overview:risks", label: "风险与异常" },
      { id: "overview:ai", label: "AI 建议" },
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
      { id: "procurement:portal", label: "供应商门户" },
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
      { id: "srm:master", label: "供应商主数据" },
      { id: "srm:performance", label: "供应商绩效" },
      { id: "srm:risk", label: "供应商风险" },
      { id: "srm:certification", label: "认证与准入" },
      { id: "srm:scoring", label: "评分体系" },
      { id: "srm:sourcing", label: "RFx 参与" },
      { id: "srm:contracts", label: "合同与目录" },
      { id: "srm:portal", label: "供应商门户" },
    ],
  },
  {
    icon: Database, label: "主数据", id: "master-data",
    children: [
      { id: "master-data", label: "主数据总览" },
      { id: "master-data:items", label: "物料主数据" },
      { id: "master-data:suppliers", label: "供应商主数据" },
      { id: "master-data:warehouses", label: "仓库 / 库位" },
      { id: "master-data:tax-codes", label: "税码" },
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
    icon: FileSpreadsheet, label: "报表中心", id: "reports",
    children: [
      { id: "reports", label: "跨模块报表" },
      { id: "reports:procurement", label: "采购报表" },
      { id: "reports:inventory", label: "库存报表" },
      { id: "reports:finance", label: "财务报表" },
    ],
  },
  {
    icon: Upload, label: "数据管理", id: "imports",
    children: [
      { id: "imports", label: "导入任务记录" },
      { id: "imports:templates", label: "模板管理" },
      { id: "imports:validation", label: "数据校验结果" },
      { id: "imports:failed", label: "失败行处理" },
    ],
  },
] as const;

export const navGroups = [
  { label: "运营", itemIds: ["overview"] },
  { label: "供应链", itemIds: ["procurement", "inventory", "srm", "master-data", "finance", "forecast"] },
  { label: "数据", itemIds: ["reports", "imports"] },
] as const;
