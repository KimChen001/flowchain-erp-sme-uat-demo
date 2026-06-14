import {
  BarChart2,
  ClipboardCheck,
  ClipboardList,
  FileSpreadsheet,
  Handshake,
  Package,
  PackageCheck,
  ShoppingCart,
  TrendingUp,
  Upload,
} from "lucide-react";

export const navItems = [
  { icon: BarChart2, label: "每日工作台", id: "overview" },
  { icon: Package, label: "库存", id: "inventory" },
  { icon: ClipboardCheck, label: "采购申请", id: "purchaseRequests" },
  { icon: ClipboardList, label: "采购订单", id: "purchasing" },
  { icon: FileSpreadsheet, label: "供应商报价", id: "rfq" },
  { icon: PackageCheck, label: "收货", id: "receiving" },
  { icon: Handshake, label: "供应商与绩效", id: "procurement" },
  { icon: FileSpreadsheet, label: "报表中心", id: "reports" },
  { icon: Upload, label: "导入中心", id: "imports" },
  { icon: ShoppingCart, label: "销售表现", id: "sales" },
  { icon: TrendingUp, label: "高级计划", id: "forecast" },
] as const;

export const navGroups = [
  { label: "首页", itemIds: ["overview"] },
  { label: "库存", itemIds: ["inventory"] },
  { label: "采购", itemIds: ["purchaseRequests", "purchasing", "rfq"] },
  { label: "收货", itemIds: ["receiving"] },
  { label: "供应商", itemIds: ["procurement"] },
  { label: "报表 / 绩效", itemIds: ["reports", "imports", "sales"] },
  { label: "高级计划", itemIds: ["forecast"] },
] as const;
