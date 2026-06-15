import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BarChart2,
  ClipboardList,
  Database,
  Eye,
  FileSpreadsheet,
  Package,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { apiJson } from "../../lib/api-client";
import { exportRowsToCsv } from "../../lib/data-export";
import { fmt } from "../../lib/format";
import {
  CONTRACTS,
  COUNT_PLANS,
  FORECAST_SKUS,
  INVENTORY_MOVEMENT_LEDGER,
  LOTS,
  PAYABLES,
  PORTAL_SUPPLIERS,
  PURCHASE_RETURNS,
  RFQS,
  SUPPLIER_CREDIT_MEMOS,
  SERIALS,
  SUPPLIER_INVOICES,
  SUPPLIER_RECONCILIATION_STATEMENTS,
  TRANSFERS,
  VARIANCES,
  forecastData,
  inventoryItems,
  purchaseOrders,
  receivingDocs,
  salesData,
  topProducts,
} from "../../data/demo-data";
import { inventoryPlan } from "../../domain/inventory/planning";
import { inventoryMovementExportRows } from "../../domain/inventory/movements";
import { METHOD_LABEL, runForecast, type Method } from "../../domain/forecast";
import { forecastProcurementProfileForSku } from "../../domain/forecast/purchase-request";
import { type MrpPlan } from "../../domain/mrp";
import { poTotals } from "../../domain/purchasing/helpers";
import {
  getInvoiceVarianceSummary,
  invoiceToMatchQueueItem,
  invoiceToPayable,
  isInvoicePayableReady,
  supplierInvoiceExportRows,
} from "../../domain/procurement/invoice-matching";
import {
  reconciliationExceptionRows,
  reconciliationExportRows,
  reconciliationLineExportRows,
} from "../../domain/procurement/reconciliation";
import {
  creditMemoExportRows,
  purchaseReturnExportRows,
  returnExceptionRows,
} from "../../domain/procurement/returns";
import type { AuditEntry, PurchaseRequest } from "../../types/scm";
import { A, Card, Chip, KpiCard, SectionHeader, SegmentedControl } from "../../components/ui";

type ReportModule = "销售" | "采购" | "库存" | "预测/MRP" | "供应商" | "审计";
type SourceKind = "Core" | "Computed" | "API" | "API fallback" | "Module";
type RouteId = "sales" | "procurement" | "finance" | "inventory" | "forecast" | `procurement:${string}` | `inventory:${string}` | `finance:${string}`;
type ReportRows = Record<string, unknown>[];

type ReportEntry = {
  id: string;
  name: string;
  module: ReportModule;
  description: string;
  source: string;
  sourceKind: SourceKind;
  updated: string;
  filename?: string;
  rows?: () => ReportRows;
  sourceModule?: RouteId;
  comingLaterReason?: string;
};

type ReportsPanelProps = {
  onNavigate?: (moduleId: string) => void;
  initialView?: "procurement" | "inventory" | "finance";
};

const FILTERS = ["全部", "销售", "采购", "库存", "预测/MRP", "供应商", "审计"] as const;
const DEFAULT_METHOD: Method = "hw";
const DEFAULT_HORIZON = 6;

const FUTURE_LABEL = (index: number) => {
  const totalIdx = 2026 * 12 + 5 + index;
  const y = Math.floor(totalIdx / 12);
  const m = (totalIdx % 12) + 1;
  return `${String(y).slice(-2)}/${m}月`;
};

function exportReport(filename: string, rows: ReportRows) {
  if (rows.length === 0) {
    toast.warning("暂无可导出的数据");
    return;
  }
  exportRowsToCsv(filename, rows);
  toast.success("CSV 已导出");
}

function badgeStyle(kind: SourceKind) {
  if (kind === "API") return { color: A.green, bg: "#f0faf4" };
  if (kind === "API fallback") return { color: A.orange, bg: "#fff8f0" };
  if (kind === "Module") return { color: A.gray1, bg: A.gray6 };
  if (kind === "Computed") return { color: A.purple, bg: "#faf3ff" };
  return { color: A.blue, bg: "#f0f6ff" };
}

function moduleColor(module: ReportModule) {
  return ({
    销售: A.blue,
    采购: A.purple,
    库存: A.green,
    "预测/MRP": A.orange,
    供应商: A.teal,
    审计: A.gray1,
  } satisfies Record<ReportModule, string>)[module];
}

function buildInventoryStockRows() {
  return inventoryItems.map((item) => {
    const plan = inventoryPlan(item);
    return {
      SKU: item.sku,
      品名: item.name,
      品类: item.category,
      库位: item.location,
      当前库存: item.qty,
      可用库存: plan.projectedAvailable,
      安全库存: item.min,
      最大库存: item.max,
      月需求: plan.monthlyDemand,
      提前期天数: plan.leadTimeDays,
      覆盖天数: plan.daysCover,
      ROP: plan.reorderPoint,
      建议补货量: plan.suggestedQty,
      单位: plan.unit,
      补货策略: plan.policy,
      供应商: plan.supplier,
      状态: item.status,
      是否需要询价: plan.needsSourcing ? "是" : "否",
      建议PR金额: plan.amount,
    };
  });
}

function buildAbcXyzRows() {
  const strategy: Record<string, string> = {
    AX: "自动补货 · 高服务水平 99%",
    AY: "周预测 · 服务 97%",
    AZ: "JIT · 紧密协同",
    BX: "月预测 · 服务 95%",
    BY: "月预测 · 服务 90%",
    BZ: "按订单生产",
    CX: "经济批量 · 季度补",
    CY: "按需采购",
    CZ: "按订单采购 · 不备库",
  };
  return inventoryItems.map((item, index) => {
    const annualValue = item.qty * (50 + (index * 73) % 800);
    const cov = 0.1 + ((index * 0.37) % 0.7);
    const abc = index < 2 ? "A" : index < 6 ? "B" : "C";
    const xyz = cov < 0.25 ? "X" : cov < 0.5 ? "Y" : "Z";
    return {
      SKU: item.sku,
      品名: item.name,
      品类: item.category,
      当前库存: item.qty,
      年价值: annualValue,
      CoV: Number(cov.toFixed(2)),
      ABC分类: abc,
      XYZ分类: xyz,
      策略: strategy[abc + xyz],
    };
  }).sort((a, b) => Number(b.年价值) - Number(a.年价值));
}

function buildForecastRows() {
  const sku = FORECAST_SKUS[0];
  const result = runForecast(sku.history, DEFAULT_METHOD, { alpha: 0.4, beta: 0.15, gamma: 0.25, season: 12 }, DEFAULT_HORIZON);
  const months = ["24/12月", "25/1月", "25/2月", "25/3月", "25/4月", "25/5月", "25/6月", "25/7月", "25/8月", "25/9月", "25/10月", "25/11月", "25/12月", "26/1月", "26/2月", "26/3月", "26/4月", "26/5月"];
  const errStd = result.rmse;
  return [
    ...sku.history.map((actual, index) => ({
      SKU: sku.sku,
      品名: sku.name,
      月份: months[index] || `历史${index + 1}`,
      数据类型: "历史",
      实际需求: actual,
      拟合值: result.fitted[index] ?? "",
      预测值: "",
      下限: "",
      上限: "",
      方法: METHOD_LABEL[DEFAULT_METHOD],
      场景: "base",
      预测期数: DEFAULT_HORIZON,
      MAPE: Number(result.mape.toFixed(2)),
      WMAPE: Number(result.wmape.toFixed(2)),
      RMSE: Number(result.rmse.toFixed(2)),
      MAE: Number(result.mae.toFixed(2)),
      TrackingSignal: Number(result.trackingSignal.toFixed(2)),
      TheilU: Number(result.theilU.toFixed(2)),
    })),
    ...result.forecast.map((forecast, index) => ({
      SKU: sku.sku,
      品名: sku.name,
      月份: FUTURE_LABEL(index),
      数据类型: "预测",
      实际需求: "",
      拟合值: "",
      预测值: Math.round(forecast),
      下限: Math.round(Math.max(0, forecast - 1.96 * errStd)),
      上限: Math.round(forecast + 1.96 * errStd),
      方法: METHOD_LABEL[DEFAULT_METHOD],
      场景: "base",
      预测期数: DEFAULT_HORIZON,
      MAPE: Number(result.mape.toFixed(2)),
      WMAPE: Number(result.wmape.toFixed(2)),
      RMSE: Number(result.rmse.toFixed(2)),
      MAE: Number(result.mae.toFixed(2)),
      TrackingSignal: Number(result.trackingSignal.toFixed(2)),
      TheilU: Number(result.theilU.toFixed(2)),
    })),
  ];
}

function buildForecastReconciliationRows() {
  const sku = FORECAST_SKUS[0];
  const profile = forecastProcurementProfileForSku(sku.sku);
  const result = runForecast(sku.history, DEFAULT_METHOD, { alpha: 0.4, beta: 0.15, gamma: 0.25, season: 12 }, DEFAULT_HORIZON);
  let inventory = sku.onHand;
  const rows = result.forecast.map((forecast, index) => {
    const inbound = index === 0 ? sku.open : 0;
    inventory = inventory + inbound - forecast;
    const gap = inventory < 0 ? -inventory : 0;
    const cover = forecast > 0 ? (inventory + forecast) / forecast : 0;
    return {
      month: FUTURE_LABEL(index),
      demand: Math.round(forecast),
      inbound,
      ending: Math.round(inventory),
      gap: Math.round(gap),
      cover,
      risk: inventory < 0 ? "高" : cover < 1.2 ? "中" : "低",
    };
  });
  const firstShortage = rows.find((row) => row.risk === "高")?.month || "";
  const peakGap = Math.max(0, ...rows.map((row) => row.gap));
  const suggestedQty = peakGap > 0 ? Math.ceil(peakGap * 1.1) : 0;
  return rows.map((row) => ({
    SKU: sku.sku,
    品名: sku.name,
    月份: row.month,
    预测需求: row.demand,
    计划入库: row.inbound,
    期末库存: row.ending,
    缺口: row.gap,
    覆盖倍数: Number(row.cover.toFixed(2)),
    风险等级: row.risk,
    服务水平: 95,
    建议采购量: suggestedQty,
    建议采购金额: suggestedQty * profile.unitPrice,
    首个缺料月份: firstShortage,
    供应商: profile.supplier,
    采购负责人: profile.buyer,
  }));
}

function buildForecastBenchmarkRows() {
  const sku = FORECAST_SKUS[0];
  const methods: Method[] = ["naive", "sma", "ses", "holt", "hw"];
  const benchmark = methods.map((method) => {
    const result = runForecast(sku.history, method, { alpha: 0.4, beta: 0.15, gamma: 0.25, season: 12 }, DEFAULT_HORIZON);
    return { method, mape: result.mape, rmse: result.rmse };
  }).sort((a, b) => a.mape - b.mape);
  return benchmark.map((row, index) => ({
    SKU: sku.sku,
    品名: sku.name,
    方法: row.method,
    方法名称: METHOD_LABEL[row.method],
    MAPE: Number(row.mape.toFixed(2)),
    RMSE: Number(row.rmse.toFixed(2)),
    是否Champion: index === 0 ? "是" : "否",
    当前选择方法: row.method === DEFAULT_METHOD ? "是" : "否",
  }));
}

function reportFilterFromView(view?: ReportsPanelProps["initialView"]): typeof FILTERS[number] {
  if (view === "procurement") return "采购";
  if (view === "inventory") return "库存";
  if (view === "finance") return "采购";
  return "全部";
}

export default function ReportsPanel({ onNavigate, initialView }: ReportsPanelProps) {
  const [filter, setFilter] = useState<typeof FILTERS[number]>(() => reportFilterFromView(initialView));
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [savedPlans, setSavedPlans] = useState<any[]>([]);
  const [mrpPlan, setMrpPlan] = useState<MrpPlan | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);

  useEffect(() => {
    apiJson<PurchaseRequest[]>("/api/purchase-requests").then(setPurchaseRequests).catch(() => setPurchaseRequests([]));
    apiJson<any[]>("/api/forecast-plans").then(setSavedPlans).catch(() => setSavedPlans([]));
    apiJson<MrpPlan>("/api/mrp-plan?periods=6").then(setMrpPlan).catch(() => setMrpPlan(null));
    apiJson<AuditEntry[]>("/api/audit-log").then(setAuditLog).catch(() => setAuditLog([]));
  }, []);
  useEffect(() => {
    setFilter(reportFilterFromView(initialView));
  }, [initialView]);

  const reports = useMemo<ReportEntry[]>(() => [
    {
      id: "sales-monthly",
      name: "Sales Monthly Performance",
      module: "销售",
      description: "月度销售额、订单量与毛利率标准报表。",
      source: "salesData · operational dataset",
      sourceKind: "Core",
      updated: "2026 baseline",
      filename: "reports-sales-monthly-export.csv",
      sourceModule: "sales",
      rows: () => salesData.map((row) => ({ 月份: row.month, 销售额: row.revenue, 订单数: row.orders, 毛利率: row.margin })),
    },
    {
      id: "sales-products",
      name: "Top Products Report",
      module: "销售",
      description: "TOP 产品销售额、增长率、销量、毛利率与退货率。",
      source: "topProducts · operational dataset",
      sourceKind: "Core",
      updated: "2026 baseline",
      filename: "reports-sales-top-products-export.csv",
      sourceModule: "sales",
      rows: () => topProducts.map((row) => ({ 产品名称: row.name, 年销售额: row.revenue, 增长率: row.growth, 销售量: row.units, 毛利率: row.margin, 退货率: row.returnRate })),
    },
    {
      id: "sales-orders",
      name: "Sales Orders Report",
      module: "销售",
      description: "销售订单的当前 UI state 报表入口。",
      source: "Sales module local state",
      sourceKind: "Module",
      updated: "模块内导出可用",
      sourceModule: "sales",
      comingLaterReason: "销售订单数据目前是 Sales 页面内部 state；为避免重构边界，请在销售订单页使用模块内导出。",
    },
    {
      id: "sales-customers",
      name: "Customers Report",
      module: "销售",
      description: "客户主数据与信用风险报表入口。",
      source: "Sales module local state",
      sourceKind: "Module",
      updated: "模块内导出可用",
      sourceModule: "sales",
      comingLaterReason: "客户主数据目前是 Sales 页面内部常量；本轮不重构 Sales 数据边界。",
    },
    {
      id: "procurement-contracts",
      name: "Procurement Contracts Report",
      module: "采购",
      description: "框架合同、承诺量、价格条款、消耗进度与状态。",
      source: "CONTRACTS · operational dataset",
      sourceKind: "Core",
      updated: "2026 baseline",
      filename: "procurement-contracts-export.csv",
      sourceModule: "finance:reconciliation",
      rows: () => CONTRACTS.map((row) => ({ 合同号: row.id, 供应商: row.supplier, 范围: row.scope, 承诺量: row.commitVol, 价格条款: row.price, 开始日期: row.start, 结束日期: row.end, 已消耗百分比: Math.round(row.consumed * 100), 状态: row.status })),
    },
    {
      id: "supplier-invoices",
      name: "供应商发票台账报表",
      module: "采购",
      description: "供应商发票台账，包含 PO、GRN、金额、税额、匹配状态、发票状态、差异类型和 AP 过账字段。",
      source: "SUPPLIER_INVOICES · operational dataset",
      sourceKind: "Core",
      updated: "2026 baseline",
      filename: "supplier-invoices-report.csv",
      sourceModule: "finance",
      rows: () => supplierInvoiceExportRows(SUPPLIER_INVOICES),
    },
    {
      id: "invoice-match-exceptions",
      name: "发票三单匹配异常报表",
      module: "采购",
      description: "发票三单匹配异常，按 PO / GRN / 供应商发票展示差异金额、当前状态和建议动作。",
      source: "Supplier invoice dataset + matching helper",
      sourceKind: "Core",
      updated: "Computed standard report",
      filename: "invoice-match-exceptions-report.csv",
      sourceModule: "procurement:portal",
      rows: () => SUPPLIER_INVOICES
        .filter((invoice) => invoice.varianceType !== "无差异" || ["人工复核", "差异待处理"].includes(invoice.matchStatus))
        .map((invoice) => ({
          发票: invoice.invoiceNumber,
          供应商: invoice.supplier,
          PO: invoice.relatedPo || "",
          GRN: invoice.relatedGrn || "",
          差异类型: invoice.varianceType,
          差异金额: invoice.varianceAmount,
          匹配状态: invoice.matchStatus,
          发票状态: invoice.status,
          建议动作: getInvoiceVarianceSummary(invoice),
        })),
    },
    {
      id: "ap-ready-invoices",
      name: "AP 待处理 / 已过账发票报表",
      module: "采购",
      description: "已审批、已过账或已付款的供应商发票清单，用于过账应付、AP 台账和付款准备。",
      source: "SUPPLIER_INVOICES · operational dataset",
      sourceKind: "Core",
      updated: "2026 baseline",
      filename: "ap-ready-invoices-report.csv",
      sourceModule: "finance",
      rows: () => supplierInvoiceExportRows(SUPPLIER_INVOICES.filter((invoice) =>
        ["已审批", "已过账应付", "已付款"].includes(invoice.status) || isInvoicePayableReady(invoice)
      )),
    },
    {
      id: "match-queue",
      name: "三单匹配队列报表",
      module: "采购",
      description: "从供应商发票派生的三单匹配队列，比较 PO 订购金额、GRN 收货金额和发票金额。",
      source: "Supplier invoice dataset + matching helper",
      sourceKind: "Core",
      updated: "2026 baseline",
      filename: "procurement-match-queue-export.csv",
      sourceModule: "procurement",
      rows: () => SUPPLIER_INVOICES
        .map((invoice) => invoiceToMatchQueueItem(invoice, purchaseOrders, receivingDocs, SUPPLIER_INVOICES))
        .map((row) => ({
          匹配号: row.id,
          采购订单: row.po,
          收货单: row.grn,
          发票: row.invoiceNumber,
          供应商: row.supplier,
          PO金额: row.poAmt,
          GRN金额: row.grnAmt,
          发票金额: row.invAmt,
          差异类型: row.varianceType,
          差异金额: row.varianceAmount,
          匹配状态: row.matchStatus,
          发票状态: row.status,
        })),
    },
    {
      id: "payables",
      name: "Payables Report",
      module: "采购",
      description: "应付账款来自已审批/已过账供应商发票，并合并AP 余额、账期、到期日、账龄和付款状态。",
      source: "SUPPLIER_INVOICES + PAYABLES · operational dataset",
      sourceKind: "Core",
      updated: "2026 baseline",
      filename: "procurement-payables-export.csv",
      sourceModule: "procurement",
      rows: () => {
        const invoicePayables = SUPPLIER_INVOICES.filter(isInvoicePayableReady).map(invoiceToPayable);
        const merged = [
          ...invoicePayables,
          ...PAYABLES.filter((row) => !invoicePayables.some((invoiceItem) => invoiceItem.invoice === row.invoice)),
        ];
        return merged.map((row) => ({ 应付编号: row.id, 供应商: row.supplier, 发票: row.invoice, 金额: row.amount, 付款条款: row.terms, 到期日: row.due, 账龄天数: row.aging, 状态: row.status }));
      },
    },
    {
      id: "purchase-returns",
      name: "Purchase Return Register Report",
      module: "采购",
      description: "采购退货台账，包含供应商、PO、GRN、发票、退货原因、退货数量、退货金额、状态和贷项通知。",
      source: "PURCHASE_RETURNS · operational dataset",
      sourceKind: "Core",
      updated: "2026 baseline",
      filename: "purchase-returns-report.csv",
      sourceModule: "procurement",
      rows: () => purchaseReturnExportRows(PURCHASE_RETURNS),
    },
    {
      id: "supplier-credit-memos",
      name: "Supplier Credit Memo Report",
      module: "采购",
      description: "供应商贷项通知台账，包含关联退货、关联发票、贷项金额、状态、应付冲减状态和对账单。",
      source: "SUPPLIER_CREDIT_MEMOS · operational dataset",
      sourceKind: "Core",
      updated: "2026 baseline",
      filename: "supplier-credit-memos-report.csv",
      sourceModule: "procurement",
      rows: () => creditMemoExportRows(SUPPLIER_CREDIT_MEMOS),
    },
    {
      id: "purchase-return-credit-exceptions",
      name: "Return / Credit Exceptions Report",
      module: "采购",
      description: "退货和贷项异常，包含待审批、待贷项、已驳回、贷项待确认或仍有未冲减金额的业务单据。",
      source: "Purchase return + credit memo dataset",
      sourceKind: "Core",
      updated: "Computed standard report",
      filename: "purchase-return-credit-exceptions-report.csv",
      sourceModule: "procurement",
      rows: () => returnExceptionRows(PURCHASE_RETURNS, SUPPLIER_CREDIT_MEMOS),
    },
    {
      id: "supplier-reconciliation-statements",
      name: "Supplier Reconciliation Statement Report",
      module: "采购",
      description: "供应商对账单台账，包含供应商、对账期间、应付金额、已付金额、调整金额、差异金额、未结余额、逾期金额、状态与结算状态。",
      source: "SUPPLIER_RECONCILIATION_STATEMENTS · operational dataset",
      sourceKind: "Core",
      updated: "2026 baseline",
      filename: "supplier-reconciliation-report.csv",
      sourceModule: "procurement",
      rows: () => reconciliationExportRows(SUPPLIER_RECONCILIATION_STATEMENTS),
    },
    {
      id: "supplier-reconciliation-lines",
      name: "Supplier Reconciliation Lines Report",
      module: "采购",
      description: "供应商对账明细，按业务单据展示发票、应付、付款、调整和差异来源。",
      source: "SUPPLIER_RECONCILIATION_STATEMENTS.lines · operational dataset",
      sourceKind: "Core",
      updated: "2026 baseline",
      filename: "supplier-reconciliation-lines-report.csv",
      sourceModule: "procurement",
      rows: () => SUPPLIER_RECONCILIATION_STATEMENTS.flatMap(reconciliationLineExportRows),
    },
    {
      id: "supplier-reconciliation-exceptions",
      name: "Reconciliation Exceptions Report",
      module: "采购",
      description: "供应商对账异常，包含存在差异、已驳回、逾期应付或未结余额需复核的对账单。",
      source: "Supplier reconciliation dataset + rules",
      sourceKind: "Core",
      updated: "Computed standard report",
      filename: "supplier-reconciliation-exceptions-report.csv",
      sourceModule: "procurement",
      rows: () => reconciliationExceptionRows(SUPPLIER_RECONCILIATION_STATEMENTS),
    },
    {
      id: "supplier-performance",
      name: "Supplier Performance Report",
      module: "供应商",
      description: "供应商评分、准时率、质量率、响应分、PO 数和 YTD 采购额。",
      source: "PORTAL_SUPPLIERS · supplier performance API fallback",
      sourceKind: "API fallback",
      updated: "API fallback baseline",
      filename: "supplier-performance-export.csv",
      sourceModule: "procurement",
      rows: () => PORTAL_SUPPLIERS.map((row) => ({ 供应商: row.name, 评分: row.rating, 准时率: row.onTime, 质量率: row.quality, 响应分: row.resp, YTD_PO: row.po, YTD采购额: row.spend, 标签: row.flag })),
    },
    {
      id: "purchase-orders",
      name: "Purchase Orders Report",
      module: "采购",
      description: "采购订单列表、来源、金额、优先级、ETA 与收货进度。",
      source: "purchaseOrders · operational dataset",
      sourceKind: "Core",
      updated: "2026 baseline",
      filename: "procurement-purchase-orders-export.csv",
      sourceModule: "procurement:orders",
      rows: () => purchaseOrders.map((order) => {
        const totals = poTotals(order);
        const progress = totals.totalOrderedQty === 0 ? 0 : (totals.totalReceivedQty / totals.totalOrderedQty) * 100;
        return { PO编号: order.po, 供应商: order.supplier, 来源: order.source || "manual", 来源SKU: order.sourceSku || "", 来源名称: order.sourceName || "", 金额: order.amount, 明细行数: totals.lineCount, 优先级: order.priority, 负责人: order.owner, ETA: order.eta, 状态: order.status, 总订购数量: totals.totalOrderedQty, 总收货数量: totals.totalReceivedQty, 收货进度百分比: Number(progress.toFixed(1)) };
      }),
    },
    {
      id: "purchase-requests",
      name: "Purchase Requests Report",
      module: "采购",
      description: "采购申请队列、来源、供应商、数量、金额与审批状态。",
      source: "/api/purchase-requests",
      sourceKind: "API",
      updated: purchaseRequests.length ? "API loaded" : "API 暂无数据",
      filename: "procurement-purchase-requests-export.csv",
      sourceModule: "procurement:requests",
      rows: () => purchaseRequests.map((row) => ({ PR编号: row.pr, 来源: row.source, 来源SKU: row.sourceSku, 来源名称: row.sourceName, 供应商: row.supplier, 申请人: row.requester, 采购员: row.buyer, 数量: row.quantity, 单位: row.unit, 单价: row.unitPrice, 金额: row.amount, 需求日期: row.requiredDate, 优先级: row.priority, 状态: row.status, 申请原因: row.reason })),
    },
    {
      id: "rfq",
      name: "RFQ Report",
      module: "采购",
      description: "RFQ 标题、品类、邀请供应商数、报价数、最佳报价与状态。",
      source: "RFQS · operational dataset",
      sourceKind: "Core",
      updated: "2026 baseline",
      filename: "procurement-rfq-export.csv",
      sourceModule: "procurement:rfq",
      rows: () => RFQS.map((row) => ({ RFQ编号: row.id, 标题: row.title, 品类: row.category, 邀请供应商数: row.suppliers, 已报价供应商数: row.quoted, 最优报价: row.bestPrice, 最优供应商: row.bestSupplier, 截止日期: row.due, 状态: row.status })),
    },
    {
      id: "receiving",
      name: "Receiving / GRN Report",
      module: "采购",
      description: "收货单、供应商、到达时间、泊位、质检通过/失败数与入库状态。",
      source: "receivingDocs · operational dataset",
      sourceKind: "Core",
      updated: "2026 baseline",
      filename: "procurement-receiving-export.csv",
      sourceModule: "procurement:receiving",
      rows: () => receivingDocs.map((row) => ({ GRN: row.grn, PO编号: row.po, 供应商: row.supplier, 到达时间: row.arrived, 泊位: row.dock, 收货员: row.receiver, 行项: row.items, 通过数: row.passed, 失败数: row.failed, 仓库: row.warehouse, 状态: row.status })),
    },
    {
      id: "inventory-stock",
      name: "Inventory Stock Report",
      module: "库存",
      description: "库存、可用库存、安全线、ROP、建议补货量与建议 PR 金额。",
      source: "inventoryItems + inventoryPlan",
      sourceKind: "Core",
      updated: "Standard report",
      filename: "inventory-stock-export.csv",
      sourceModule: "inventory",
      rows: buildInventoryStockRows,
    },
    {
      id: "inventory-lots",
      name: "Inventory Lots Report",
      module: "库存",
      description: "批次、SKU、数量、供应商、入库日、效期、库位和 COA。",
      source: "LOTS · operational dataset",
      sourceKind: "Core",
      updated: "2026 baseline",
      filename: "inventory-lots-export.csv",
      sourceModule: "inventory",
      rows: () => LOTS.map((row) => ({ 批次号: row.lot, SKU: row.sku, 品名: row.name, 数量: row.qty, 供应商: row.supplier, 入库日: row.received, 效期: row.expiry, 库位: row.warehouse, COA: row.coa ? "有" : "无", 状态: row.status })),
    },
    {
      id: "inventory-serials",
      name: "Inventory Serials Report",
      module: "库存",
      description: "高值件序列号、所属批次、状态、库位和入库日。",
      source: "SERIALS · operational dataset",
      sourceKind: "Core",
      updated: "2026 baseline",
      filename: "inventory-serials-export.csv",
      sourceModule: "inventory",
      rows: () => SERIALS.map((row) => ({ 序列号: row.sn, SKU: row.sku, 所属批次: row.lot, 状态: row.status, 当前库位: row.warehouse, 入库日: row.received })),
    },
    {
      id: "inventory-transfers",
      name: "Inventory Transfers Report",
      module: "库存",
      description: "仓间调拨单、源/目标仓、SKU、数量、承运商、ETA 和状态。",
      source: "TRANSFERS · operational dataset",
      sourceKind: "Core",
      updated: "2026 baseline",
      filename: "inventory-transfers-export.csv",
      sourceModule: "inventory",
      rows: () => TRANSFERS.map((row) => ({ 调拨号: row.id, 源仓库: row.from, 目标仓库: row.to, SKU: row.sku, 品名: row.name, 数量: row.qty, 申请人: row.requester, 承运商: row.carrier, 创建日期: row.created, ETA: row.eta, 状态: row.status })),
    },
    {
      id: "cycle-count",
      name: "Cycle Count Plan Report",
      module: "库存",
      description: "循环盘点计划、库区、盘点员、范围、进度、差异和状态。",
      source: "COUNT_PLANS · operational dataset",
      sourceKind: "Core",
      updated: "2026 baseline",
      filename: "inventory-cycle-count-plans-export.csv",
      sourceModule: "inventory",
      rows: () => COUNT_PLANS.map((row) => ({ 计划号: row.id, 库区: row.zone, 排期: row.scheduled, 盘点员: row.counter, 方法: row.method, 计划范围: row.scope, 已盘点: row.counted, 进度百分比: Number(((row.counted / row.scope) * 100).toFixed(1)), 差异: row.variance, 状态: row.status })),
    },
    {
      id: "count-variance",
      name: "Count Variance Report",
      module: "库存",
      description: "盘点差异、账面数、实盘数、差异原因和差异金额。",
      source: "VARIANCES · operational dataset",
      sourceKind: "Core",
      updated: "2026 baseline",
      filename: "inventory-count-variances-export.csv",
      sourceModule: "inventory",
      rows: () => VARIANCES.map((row) => ({ 批次号: row.lot, SKU: row.sku, 品名: row.name, 账面数: row.book, 实盘数: row.actual, 差异: row.diff, 差异原因: row.reason, 差异金额: row.value })),
    },
    {
      id: "inventory-movement-ledger",
      name: "Inventory Movement Ledger Report",
      module: "库存",
      description: "库存事务流水、来源单据、入库数量、出库数量、调整数量、期末影响与关联证据。",
      source: "INVENTORY_MOVEMENT_LEDGER · operational dataset",
      sourceKind: "Core",
      updated: "2026 baseline",
      filename: "inventory-movement-ledger-report.csv",
      sourceModule: "inventory",
      rows: () => inventoryMovementExportRows(INVENTORY_MOVEMENT_LEDGER),
    },
    {
      id: "abc-xyz",
      name: "ABC/XYZ Classification Report",
      module: "库存",
      description: "库存价值与需求波动分类，并输出对应补货策略。",
      source: "inventoryItems · computed classification",
      sourceKind: "Computed",
      updated: "Computed standard report",
      filename: "inventory-abc-xyz-export.csv",
      sourceModule: "inventory",
      rows: buildAbcXyzRows,
    },
    {
      id: "forecast-result",
      name: "Forecast Result Report",
      module: "预测/MRP",
      description: "默认 SKU 的历史拟合、未来预测、置信区间和模型指标。",
      source: "FORECAST_SKUS + runForecast",
      sourceKind: "Computed",
      updated: "Standard baseline · HW / 6 periods",
      filename: "forecast-result-export.csv",
      sourceModule: "forecast",
      rows: buildForecastRows,
    },
    {
      id: "forecast-source",
      name: "Legacy Forecast Trend Report",
      module: "预测/MRP",
      description: "原始销售预测趋势、实际值、预测值和上下界。",
      source: "forecastData · operational dataset",
      sourceKind: "Core",
      updated: "2026 baseline",
      filename: "forecast-trend-export.csv",
      sourceModule: "forecast",
      rows: () => forecastData.map((row) => ({ 月份: row.month, 实际值: row.actual ?? "", 预测值: row.forecast, 下限: row.lower, 上限: row.upper })),
    },
    {
      id: "forecast-reconciliation",
      name: "Forecast Reconciliation Report",
      module: "预测/MRP",
      description: "默认 SKU 的预测需求、计划入库、期末库存、缺口和建议采购量。",
      source: "FORECAST_SKUS + forecastProcurementProfileForSku",
      sourceKind: "Computed",
      updated: "Standard baseline · service level 95%",
      filename: "forecast-reconciliation-export.csv",
      sourceModule: "forecast",
      rows: buildForecastReconciliationRows,
    },
    {
      id: "forecast-benchmark",
      name: "Forecast Benchmark Report",
      module: "预测/MRP",
      description: "Naive / SMA / SES / Holt / Holt-Winters 的 Champion/Challenger 对比。",
      source: "runForecast benchmark",
      sourceKind: "Computed",
      updated: "Computed standard report",
      filename: "forecast-benchmark-export.csv",
      sourceModule: "forecast",
      rows: buildForecastBenchmarkRows,
    },
    {
      id: "saved-plans",
      name: "Saved Forecast Plans Report",
      module: "预测/MRP",
      description: "已保存预测方案、指标和采购建议。",
      source: "/api/forecast-plans",
      sourceKind: "API",
      updated: savedPlans.length ? "API loaded" : "API 暂无数据",
      filename: "forecast-saved-plans-export.csv",
      sourceModule: "forecast",
      rows: () => savedPlans.map((plan) => ({ 方案ID: plan.id, SKU: plan.sku, 品名: plan.name, 单位: plan.unit || "", 方法: METHOD_LABEL[plan.method as Method] ?? plan.method, 预测期数: plan.horizon, MAPE: plan.metrics?.mape ?? "", WMAPE: plan.metrics?.wmape ?? "", RMSE: plan.metrics?.rmse ?? "", 建议供应商: plan.procurementSuggestion?.supplier || "", 建议采购量: plan.procurementSuggestion?.quantity ?? "", 建议采购金额: plan.procurementSuggestion?.amount ?? "", 优先级: plan.procurementSuggestion?.priority || "", 首个缺料月份: plan.procurementSuggestion?.firstStockoutMonth || "", 创建时间: plan.createdAt })),
    },
    {
      id: "mrp-exceptions",
      name: "MRP Exceptions Report",
      module: "预测/MRP",
      description: "MRP 计划例外、期间、数量、金额和建议动作。",
      source: "/api/mrp-plan?periods=6",
      sourceKind: "API",
      updated: mrpPlan ? "API loaded" : "API 暂无数据",
      filename: "mrp-exceptions-export.csv",
      sourceModule: "forecast",
      rows: () => (mrpPlan?.exceptions || []).map((row) => ({ SKU: row.sku, 品名: row.name, 期间: row.period, 异常类型: row.type, 数量: row.quantity, 金额: row.amount, 建议动作: row.action })),
    },
    {
      id: "mrp-planned-orders",
      name: "MRP Planned Orders Report",
      module: "预测/MRP",
      description: "MRP 行级 schedule 的毛需求、计划收货、净需求、计划释放和例外。",
      source: "/api/mrp-plan?periods=6",
      sourceKind: "API",
      updated: mrpPlan ? "API loaded" : "API 暂无数据",
      filename: "mrp-planned-orders-export.csv",
      sourceModule: "forecast",
      rows: () => (mrpPlan?.rows || []).flatMap((row) => row.schedule.map((line) => ({ SKU: row.sku, 品名: row.name, 期间: line.period, 需求: line.grossRequirement, 计划收货: line.scheduledReceipt, 计划释放: line.plannedRelease, 预计库存: line.projectedAvailable, 净需求: line.netRequirement, 异常: line.exception, BOM来源摘要: line.dependentDemandSources?.map((source) => `${source.parentName || source.parent}:${source.demand}`).join(" | ") || "" }))),
    },
    {
      id: "audit-log",
      name: "Audit Log Report",
      module: "审计",
      description: "工作流状态变更、动作、实体、操作者、原因与时间戳。",
      source: "/api/audit-log",
      sourceKind: "API",
      updated: auditLog.length ? "API loaded" : "API 暂无数据",
      filename: "audit-log-export.csv",
      rows: () => auditLog.map((row) => ({ 审计ID: row.auditId, 时间: row.timestamp, 操作者: row.actor, 来源: row.source || "", 动作: row.action, 实体类型: row.entityType, 实体ID: row.entityId, 原状态: row.fromStatus || "", 新状态: row.toStatus || "", 原因: row.reason || "" })),
    },
  ], [auditLog, mrpPlan, purchaseRequests, savedPlans]);

  const visibleReports = filter === "全部" ? reports : reports.filter((report) => report.module === filter);
  const exportReadyCount = reports.filter((report) => report.rows && !report.comingLaterReason).length;
  const apiCount = reports.filter((report) => report.sourceKind === "API" || report.sourceKind === "API fallback").length;
  const modulesCovered = new Set(reports.map((report) => report.module)).size;

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#f0f6ff", color: A.blue }}>
                <FileSpreadsheet size={17} />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight" style={{ color: A.label }}>报表中心</h1>
                <p className="text-xs mt-0.5" style={{ color: A.sub }}>统一查看标准经营报表、数据来源与 CSV 导出入口</p>
              </div>
            </div>
            <p className="text-xs leading-5 max-w-3xl" style={{ color: A.gray1 }}>
              报表中心导出预定义字段和业务/API 数据；如需导出某个业务页面的当前筛选或临时操作状态，请使用模块内导出。
            </p>
          </div>
          {onNavigate && (
            <button onClick={() => onNavigate("imports")}
              className="text-xs px-3 py-2 rounded-xl font-medium flex items-center gap-1.5 shrink-0"
              style={{ background: A.gray6, color: A.blue }}>
              <FileSpreadsheet size={13} /> 需要复核导入？打开数据管理
            </button>
          )}
          <SegmentedControl
            options={FILTERS.map((item) => ({ label: item, value: item }))}
            value={filter}
            onChange={(value) => setFilter(value as typeof FILTERS[number])}
          />
        </div>
      </Card>

      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="标准报表" value={String(reports.length)} sub="报表中心 v1" icon={FileSpreadsheet} color={A.blue} />
        <KpiCard label="覆盖模块" value={String(modulesCovered)} sub="销售/采购/库存/计划/审计" icon={Database} color={A.green} />
        <KpiCard label="API / Fallback" value={String(apiCount)} sub="只读现有端点" icon={RefreshCw} color={A.orange} />
        <KpiCard label="可导出" value={String(exportReadyCount)} sub="CSV 标准导出" icon={ShieldCheck} color={A.purple} />
      </div>

      <Card>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: A.label }}>标准报表目录</h2>
            <p className="text-[11px] mt-0.5" style={{ color: A.sub }}>{visibleReports.length} 个报表 · 当前筛选 {filter}</p>
          </div>
          <div className="flex items-center gap-3 text-[10px]" style={{ color: A.gray2 }}>
            <span className="flex items-center gap-1"><ShoppingCart size={11} /> 销售</span>
            <span className="flex items-center gap-1"><ClipboardList size={11} /> 采购</span>
            <span className="flex items-center gap-1"><Package size={11} /> 库存</span>
            <span className="flex items-center gap-1"><TrendingUp size={11} /> 计划</span>
            <span className="flex items-center gap-1"><BarChart2 size={11} /> 审计</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 p-4">
          {visibleReports.map((report) => {
            const sourceBadge = badgeStyle(report.sourceKind);
            const canExport = Boolean(report.rows && report.filename && !report.comingLaterReason);
            return (
              <div key={report.id} className="rounded-xl p-4" style={{ background: A.gray6, border: "0.5px solid rgba(0,0,0,0.06)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Chip label={report.module} color={moduleColor(report.module)} bg={`${moduleColor(report.module)}16`} />
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ color: sourceBadge.color, background: sourceBadge.bg }}>
                        {report.sourceKind}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold truncate" style={{ color: A.label }}>{report.name}</h3>
                    <p className="text-[11px] leading-5 mt-1" style={{ color: A.sub }}>{report.description}</p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-[80px_1fr] gap-y-1 text-[10px] leading-4">
                  <span style={{ color: A.gray2 }}>数据来源</span>
                  <span className="truncate" style={{ color: A.gray1 }}>{report.source}</span>
                  <span style={{ color: A.gray2 }}>更新时间</span>
                  <span style={{ color: A.gray1 }}>{report.updated}</span>
                </div>

                {report.comingLaterReason && (
                  <div className="mt-3 rounded-lg px-3 py-2 text-[10px] leading-4" style={{ background: A.white, color: A.gray1 }}>
                    {report.comingLaterReason}
                  </div>
                )}

                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => canExport && exportReport(report.filename!, report.rows!())}
                    disabled={!canExport}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all disabled:cursor-not-allowed"
                    style={{ background: canExport ? A.white : A.gray5, color: canExport ? A.blue : A.gray2, boxShadow: canExport ? "0 0 0 0.5px rgba(0,0,0,0.08)" : "none" }}>
                    <FileSpreadsheet size={13} /> 导出 CSV
                  </button>
                  {onNavigate && report.sourceModule && (
                    <button
                      onClick={() => onNavigate(report.sourceModule!)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all hover:opacity-90"
                      style={{ background: "transparent", color: A.gray1 }}>
                      <Eye size={13} /> 打开模块
                    </button>
                  )}
                  <span className="ml-auto text-[10px]" style={{ color: canExport ? A.green : A.orange }}>
                    {canExport ? "可导出" : "模块内导出"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
