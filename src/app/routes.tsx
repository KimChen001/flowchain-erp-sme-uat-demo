import {
  BarChart2,
  CircleDollarSign,
  FileSpreadsheet,
  Handshake,
  Package,
  TrendingUp,
  Upload,
} from "lucide-react";

export const navItems = [
  { icon: BarChart2, label: "每日工作台", id: "overview" },
  { icon: Handshake, label: "采购管理", id: "procurement" },
  { icon: Package, label: "库存管理", id: "inventory" },
  { icon: CircleDollarSign, label: "财务协同", id: "finance" },
  { icon: TrendingUp, label: "预测与 MRP", id: "forecast" },
  { icon: FileSpreadsheet, label: "报表中心", id: "reports" },
  { icon: Upload, label: "导入中心", id: "imports" },
] as const;

export const navGroups = [
  { label: "运营", itemIds: ["overview"] },
  { label: "供应链", itemIds: ["procurement", "inventory", "finance", "forecast"] },
  { label: "数据", itemIds: ["reports", "imports"] },
] as const;
