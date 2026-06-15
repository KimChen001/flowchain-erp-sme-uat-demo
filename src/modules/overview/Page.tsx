import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ClipboardList,
  FileCheck2,
  FileSpreadsheet,
  Package,
  PackageCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { apiJson } from "../../lib/api-client";
import { exportRowsToCsv } from "../../lib/data-export";
import { fmt } from "../../lib/format";
import { A, Card, Chip, KpiCard, Modal, SectionHeader } from "../../components/ui";
import { FORECAST_SKUS, inventoryItems, purchaseOrders, receivingDocs, RFQS, PORTAL_SUPPLIERS, PURCHASE_RETURNS, SUPPLIER_CREDIT_MEMOS, SUPPLIER_INVOICES, SUPPLIER_RECONCILIATION_STATEMENTS } from "../../data/demo-data";
import { inventoryPlan } from "../../domain/inventory/planning";
import { isStatementException, statementToCockpitSignal } from "../../domain/procurement/reconciliation";
import { calculateReturnFinancialImpact, isReturnException, returnToCockpitSignal } from "../../domain/procurement/returns";
import type { PurchaseOrder, PurchaseRequest, PurchaseReturn, ReceivingDoc, RfqRecord, SupplierInvoice, SupplierReconciliationStatement } from "../../types/scm";

type SupplierPerformance = typeof PORTAL_SUPPLIERS[number] & {
  category?: string;
  exceptions?: number;
  rejectRate?: number;
  score?: number;
  risk?: string;
  lastIssue?: string;
};

type OverviewPanelProps = {
  onNavigate: (moduleId: string) => void;
  onPrepareReplenishmentRequest: (sku: string) => void;
  onOpenAi: () => void;
};

type ActionRow = {
  priority: "高" | "中" | "低";
  title: string;
  object: string;
  evidence: string;
  module: string;
  moduleId: string;
  cta: string;
  detail: EvidenceDetail;
  onClick?: () => void;
};

type EvidenceItem = {
  label: string;
  value: string | number;
};

type EvidenceDetail = {
  id: string;
  title: string;
  priority: "高" | "中" | "低";
  object: string;
  module: string;
  moduleId: string;
  businessReason: string;
  evidence: EvidenceItem[];
  confidence?: string;
  riskScore?: string;
  suggestedAction: string;
};

type DecisionCard = {
  id: string;
  recommendation: string;
  businessImpact: string;
  evidenceUsed: string;
  confidence: string;
  riskWarning: string;
  suggestedAction: string;
  module: string;
  moduleId: string;
  detail: EvidenceDetail;
  onAction?: () => void;
};

function priorityStyle(priority: ActionRow["priority"]) {
  if (priority === "高") return { color: A.red, bg: "#fff1f0" };
  if (priority === "中") return { color: A.orange, bg: "#fff8f0" };
  return { color: A.green, bg: "#f0faf4" };
}

function overviewReplenishmentActions() {
  return inventoryItems
    .filter((item) => item.status !== "正常")
    .map((item) => {
      const plan = inventoryPlan(item);
      return {
        ...item,
        plan,
        shortage: Math.max(0, item.min - item.qty),
      };
    })
    .sort((a, b) => {
      const score = (item: { status: string; plan: { amount: number }; shortage: number }) =>
        (item.status === "不足" ? 1_000_000 : 0) + item.plan.amount + item.shortage * 100;
      return score(b) - score(a);
    });
}

function safeFilenamePart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "detail";
}

function evidenceRowsForExport(detail: EvidenceDetail) {
  return detail.evidence.map((item) => ({
    对象: detail.object,
    标题: detail.title,
    优先级: detail.priority,
    模块: detail.module,
    证据项: item.label,
    证据值: item.value,
    业务原因: detail.businessReason,
    置信度或风险分: detail.confidence || detail.riskScore || "",
    建议动作: detail.suggestedAction,
  }));
}

function buildPrEvidence(item: PurchaseRequest): EvidenceDetail {
  return {
    id: `pr-${item.pr}`,
    title: "采购申请审批证据",
    priority: item.priority,
    object: item.pr,
    module: "采购申请",
    moduleId: "purchaseRequests",
    businessReason: "高优先级采购申请会影响后续 PO 下达、供应连续性和交付承诺，需要优先确认审批依据。",
    evidence: [
      { label: "PR 编号", value: item.pr },
      { label: "来源 SKU", value: item.sourceSku || item.sourceName || "—" },
      { label: "申请金额", value: fmt(Number(item.amount || 0)) },
      { label: "申请数量", value: `${Number(item.quantity || 0).toLocaleString()} ${item.unit || ""}` },
      { label: "建议供应商", value: item.supplier || "待确认" },
      { label: "申请人", value: item.requester || "—" },
      { label: "采购员", value: item.buyer || "—" },
      { label: "申请原因", value: item.reason || "等待审批" },
    ],
    confidence: "84% · 中高",
    suggestedAction: "打开采购申请，确认数量、金额和供应商后再审批。",
  };
}

function buildPoEvidence(item: PurchaseOrder): EvidenceDetail {
  return {
    id: `po-${item.po}`,
    title: "采购订单审批证据",
    priority: item.priority,
    object: item.po,
    module: "采购订单",
    moduleId: "purchasing",
    businessReason: "待审批 PO 会影响供应商备料和 ETA，金额较高或优先级较高时需要尽快复核。",
    evidence: [
      { label: "PO 编号", value: item.po },
      { label: "供应商", value: item.supplier },
      { label: "状态", value: item.status },
      { label: "金额", value: fmt(item.amount) },
      { label: "ETA", value: item.eta },
      { label: "负责人", value: item.owner },
      { label: "行项数", value: item.items },
      { label: "已收货行项", value: item.received },
    ],
    confidence: "80% · 中高",
    suggestedAction: "打开采购订单，复核金额、ETA 和收货进度。",
  };
}

function buildInventoryEvidence(item: ReturnType<typeof overviewReplenishmentActions>[number], moduleId = "inventory"): EvidenceDetail {
  return {
    id: `inventory-${item.sku}`,
    title: "库存短缺证据",
    priority: item.plan.priority,
    object: item.sku,
    module: moduleId === "forecast" ? "高级计划" : "库存",
    moduleId,
    businessReason: "库存低于再订货点或覆盖天数低于采购提前期，可能影响后续生产和客户订单交付。",
    evidence: [
      { label: "SKU", value: item.sku },
      { label: "品名", value: item.name },
      { label: "当前库存", value: `${item.qty.toLocaleString()} ${item.plan.unit}` },
      { label: "可用库存", value: `${item.plan.projectedAvailable.toLocaleString()} ${item.plan.unit}` },
      { label: "安全库存", value: `${item.min.toLocaleString()} ${item.plan.unit}` },
      { label: "ROP", value: `${item.plan.reorderPoint.toLocaleString()} ${item.plan.unit}` },
      { label: "覆盖天数", value: `${item.plan.daysCover} 天` },
      { label: "建议补货量", value: `${item.plan.suggestedQty.toLocaleString()} ${item.plan.unit}` },
      { label: "预估金额", value: fmt(item.plan.amount) },
      { label: "建议供应商", value: item.plan.supplier },
      { label: "采购负责人", value: item.plan.buyer },
    ],
    confidence: "88% · 高",
    suggestedAction: item.plan.needsSourcing ? "打开 RFQ 或采购申请，先补齐报价依据。" : "打开高级计划复核，必要时生成补货 PR。",
  };
}

function buildRfqEvidence(item: RfqRecord): EvidenceDetail {
  return {
    id: `rfq-${item.id}`,
    title: "RFQ 价格风险证据",
    priority: "中",
    object: item.id,
    module: "供应商报价",
    moduleId: "rfq",
    businessReason: "未关闭 RFQ 仍在报价或比价阶段，可能影响补货成本和供应商锁定节奏。",
    evidence: [
      { label: "RFQ 编号", value: item.id },
      { label: "标题", value: item.title },
      { label: "品类", value: item.category },
      { label: "邀请供应商数", value: item.suppliers },
      { label: "已报价供应商数", value: item.quoted },
      { label: "最优供应商", value: item.bestSupplier },
      { label: "最优报价", value: item.bestPrice },
      { label: "状态", value: item.status },
      { label: "截止日期", value: item.due },
    ],
    confidence: "78% · 中",
    suggestedAction: "打开 RFQ，复核报价差异并决定是否授标或继续询价。",
  };
}

function buildReceivingEvidence(item: ReceivingDoc): EvidenceDetail {
  return {
    id: `grn-${item.grn}`,
    title: "收货异常证据",
    priority: item.status === "异常处理" ? "高" : "中",
    object: item.grn,
    module: "收货",
    moduleId: "receiving",
    businessReason: "待收货、质检中或异常处理的 GRN 会影响可用库存和 PO 关闭，需要跟进收货结果。",
    evidence: [
      { label: "GRN", value: item.grn },
      { label: "供应商", value: item.supplier },
      { label: "关联 PO", value: item.po },
      { label: "状态", value: item.status },
      { label: "到达时间", value: item.arrived },
      { label: "通过数", value: item.passed },
      { label: "失败数", value: item.failed },
      { label: "仓库", value: item.warehouse },
      { label: "收货员", value: item.receiver },
    ],
    riskScore: item.status === "异常处理" ? "82 / 100" : "64 / 100",
    suggestedAction: "打开收货模块，确认签收、质检或异常处理状态。",
  };
}

function buildInvoiceEvidence(item: SupplierInvoice): EvidenceDetail {
  const priority = item.varianceType === "重复发票" || item.varianceType === "缺少收货" ? "高" : item.varianceType === "无差异" ? "低" : "中";
  return {
    id: `invoice-${item.id}`,
    title: "供应商发票匹配证据",
    priority,
    object: item.invoiceNumber,
    module: "供应商发票",
    moduleId: "procurement",
    businessReason: "供应商发票需要与采购订单和收货单一致后，才能进入审批、过账应付和付款准备状态。",
    evidence: [
      { label: "发票号码", value: item.invoiceNumber },
      { label: "供应商", value: item.supplier },
      { label: "PO", value: item.relatedPo || "缺少 PO" },
      { label: "GRN", value: item.relatedGrn || "缺少收货" },
      { label: "发票金额", value: fmt(item.total) },
      { label: "税额", value: fmt(item.tax) },
      { label: "运费", value: fmt(item.freight || 0) },
      { label: "差异类型", value: item.varianceType },
      { label: "差异金额", value: fmt(item.varianceAmount || 0) },
      { label: "匹配状态", value: item.matchStatus },
      { label: "发票状态", value: item.status },
      { label: "来源", value: item.source },
    ],
    confidence: `${item.confidence || 76}% · ${item.matchStatus === "自动匹配" ? "高" : "需复核"}`,
    suggestedAction: item.varianceType === "无差异" ? "打开供应商发票，确认是否审批或过账应付。" : "打开供应商发票，复核 PO、GRN 和发票差异。",
  };
}

function buildPurchaseReturnEvidence(item: PurchaseReturn): EvidenceDetail {
  const impact = calculateReturnFinancialImpact(item, SUPPLIER_CREDIT_MEMOS);
  const linkedCredit = SUPPLIER_CREDIT_MEMOS.find((memo) => memo.relatedReturn === item.returnNo || memo.id === item.creditMemoId || memo.creditMemoNo === item.creditMemoId);
  return {
    id: `purchase-return-${item.id}`,
    title: "采购退货 / 贷项证据",
    priority: item.status === "已驳回" || item.status === "待贷项" ? "高" : "中",
    object: item.returnNo,
    module: "采购退货 / 贷项",
    moduleId: "procurement",
    businessReason: "采购退货和供应商贷项用于处理拒收、数量/价格差异、重复发票和应付冲减，避免异常发票直接进入付款。",
    evidence: [
      { label: "退货单号", value: item.returnNo },
      { label: "供应商", value: item.supplier },
      { label: "PO", value: item.relatedPo },
      { label: "GRN", value: item.relatedGrn },
      { label: "发票", value: item.relatedInvoice || "—" },
      { label: "退货原因", value: item.reason },
      { label: "退货数量", value: item.returnQty },
      { label: "退货金额", value: fmt(item.total) },
      { label: "未冲减金额", value: fmt(impact) },
      { label: "贷项通知", value: linkedCredit?.creditMemoNo || "待贷项" },
      { label: "贷项状态", value: linkedCredit?.status || "未收到" },
      { label: "退货状态", value: item.status },
    ],
    confidence: item.confidence ? `${item.confidence}% · 样本规则` : "样本规则",
    suggestedAction: "打开采购工作台，复核退货、贷项通知和 AP/对账影响。",
  };
}

function buildReconciliationEvidence(item: SupplierReconciliationStatement): EvidenceDetail {
  const signal = statementToCockpitSignal(item);
  return {
    id: `reconciliation-${item.id}`,
    title: "供应商对账证据",
    priority: signal.priority,
    object: item.statementNo,
    module: "供应商对账",
    moduleId: "procurement",
    businessReason: "供应商对账单按供应商和期间汇总发票、应付、付款和差异，帮助 AP 复核未结余额、逾期应付和供应商确认结果。",
    evidence: [
      { label: "对账单号", value: item.statementNo },
      { label: "供应商", value: item.supplier },
      { label: "对账期间", value: `${item.periodStart} ~ ${item.periodEnd}` },
      { label: "应付金额", value: fmt(item.totalPayableAmount) },
      { label: "已付金额", value: fmt(item.totalPaidAmount) },
      { label: "调整金额", value: fmt(item.totalAdjustmentAmount) },
      { label: "差异金额", value: fmt(item.totalVarianceAmount) },
      { label: "未结余额", value: fmt(item.openBalance) },
      { label: "逾期金额", value: fmt(item.overdueAmount) },
      { label: "状态", value: item.status },
      { label: "结算状态", value: item.settlementStatus },
    ],
    confidence: item.confidence ? `${item.confidence}% · 样本规则` : "样本规则",
    suggestedAction: item.status === "已驳回" ? "打开供应商对账，复核拒绝原因和相关发票/AP。" : "打开供应商对账，复核差异、未结余额和逾期应付。",
  };
}

function buildSupplierEvidence(item: SupplierPerformance): EvidenceDetail {
  const rejectRate = Number(item.rejectRate || (100 - Number(item.quality || 0)) * 0.35).toFixed(1);
  const exceptions = Number(item.exceptions || (item.flag === "整改" ? 3 : 1));
  return {
    id: `supplier-${item.name}`,
    title: "供应商风险证据",
    priority: item.flag === "整改" || exceptions > 2 ? "中" : "低",
    object: item.name,
    module: "供应商与绩效",
    moduleId: "procurement",
    businessReason: "供应商准时率、质量率和异常次数会影响交付承诺、收货质量和替代供应商策略。",
    evidence: [
      { label: "供应商", value: item.name },
      { label: "标签", value: item.flag || "需复核" },
      { label: "准时率", value: `${Number(item.onTime || 0).toFixed(1)}%` },
      { label: "质量率", value: `${Number(item.quality || 0).toFixed(1)}%` },
      { label: "响应分", value: Number(item.resp || 0).toFixed(0) },
      { label: "拒收率样本", value: `${rejectRate}%` },
      { label: "异常次数样本", value: exceptions },
      { label: "YTD 采购额", value: fmt(Number(item.spend || 0)) },
    ],
    confidence: "81% · 中高",
    suggestedAction: "打开供应商与绩效，复核异常记录和备选供应商。",
  };
}

function buildForecastEvidence(inventoryRisk: ReturnType<typeof overviewReplenishmentActions>[number] | undefined): EvidenceDetail {
  const sku = FORECAST_SKUS.find((item) => item.sku === inventoryRisk?.sku) || FORECAST_SKUS[0];
  return {
    id: `forecast-${sku.sku}`,
    title: "预测 / MRP 证据",
    priority: inventoryRisk?.plan.priority || "中",
    object: sku.sku,
    module: "高级计划",
    moduleId: "forecast",
    businessReason: "预测准确率和 MRP 例外共同决定是否需要释放计划订单，避免过早采购或短缺。",
    evidence: [
      { label: "SKU", value: sku.sku },
      { label: "品名", value: sku.name },
      { label: "期初库存", value: `${sku.onHand.toLocaleString()} ${sku.unit}` },
      { label: "计划入库", value: `${sku.open.toLocaleString()} ${sku.unit}` },
      { label: "预测准确率样本", value: "92.1%" },
      { label: "MRP 例外", value: inventoryRisk ? `${inventoryRisk.plan.priority}优先级 · ${inventoryRisk.plan.action}` : "中优先级 · 继续监控" },
      { label: "建议释放量", value: inventoryRisk ? `${inventoryRisk.plan.suggestedQty.toLocaleString()} ${inventoryRisk.plan.unit}` : "按计划复核" },
      { label: "短缺窗口", value: inventoryRisk ? `${inventoryRisk.plan.daysCover} 天覆盖` : "未来 6 期滚动检查" },
    ],
    confidence: "83% · 中高",
    suggestedAction: "打开高级计划，查看预测依据、MRP 行和例外明细。",
  };
}

export default function OverviewPanel({ onNavigate, onPrepareReplenishmentRequest, onOpenAi }: OverviewPanelProps) {
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceDetail | null>(null);
  const [dashboardOrders, setDashboardOrders] = useState<PurchaseOrder[]>(purchaseOrders);
  const [dashboardRequests, setDashboardRequests] = useState<PurchaseRequest[]>([]);
  const [dashboardRfqs, setDashboardRfqs] = useState<RfqRecord[]>(RFQS);
  const [dashboardReceiving, setDashboardReceiving] = useState<ReceivingDoc[]>(receivingDocs);
  const [dashboardSuppliers, setDashboardSuppliers] = useState<SupplierPerformance[]>(PORTAL_SUPPLIERS);

  useEffect(() => {
    let alive = true;
    apiJson<PurchaseOrder[]>("/api/purchase-orders").then((data) => { if (alive) setDashboardOrders(data); }).catch(() => {});
    apiJson<PurchaseRequest[]>("/api/purchase-requests").then((data) => { if (alive) setDashboardRequests(data); }).catch(() => {});
    apiJson<RfqRecord[]>("/api/rfqs").then((data) => { if (alive) setDashboardRfqs(data); }).catch(() => {});
    apiJson<ReceivingDoc[]>("/api/receiving-docs").then((data) => { if (alive) setDashboardReceiving(data); }).catch(() => {});
    apiJson<SupplierPerformance[]>("/api/supplier-performance").then((data) => { if (alive) setDashboardSuppliers(data); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const inventoryRiskItems = useMemo(() => overviewReplenishmentActions(), []);
  const pendingRequests = dashboardRequests.filter((item) => item.status === "待审批");
  const highPriorityRequests = pendingRequests.filter((item) => item.priority === "高");
  const pendingOrders = dashboardOrders.filter((item) => item.status === "待审批");
  const receivingRisks = dashboardReceiving.filter((item) => item.status === "待收货" || item.status === "质检中" || item.status === "异常处理");
  const openRfqs = dashboardRfqs.filter((item) => item.status === "进行中" || item.status === "比价中");
  const supplierRisks = dashboardSuppliers.filter((item) => item.flag === "整改" || Number(item.rejectRate || 0) > 5 || Number(item.exceptions || 0) > 0);
  const invoiceRisks = SUPPLIER_INVOICES.filter((item) =>
    item.varianceType !== "无差异" || ["待匹配", "存在差异"].includes(item.status) || ["人工复核", "差异待处理"].includes(item.matchStatus)
  ).sort((a, b) => Number(b.varianceAmount || 0) - Number(a.varianceAmount || 0));
  const returnRisks = PURCHASE_RETURNS
    .filter((item) => isReturnException(item, SUPPLIER_CREDIT_MEMOS))
    .sort((a, b) => calculateReturnFinancialImpact(b, SUPPLIER_CREDIT_MEMOS) - calculateReturnFinancialImpact(a, SUPPLIER_CREDIT_MEMOS));
  const reconciliationRisks = SUPPLIER_RECONCILIATION_STATEMENTS
    .filter(isStatementException)
    .sort((a, b) => (b.totalVarianceAmount + b.overdueAmount + b.openBalance * 0.1) - (a.totalVarianceAmount + a.overdueAmount + a.openBalance * 0.1));
  const mrpExceptions = inventoryRiskItems.filter((item) => item.plan.suggestedQty > 0).length;
  const openPrValue = pendingRequests.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const openPoValue = dashboardOrders
    .filter((item) => !["已完成", "已取消", "已驳回"].includes(item.status))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const topRiskSku = inventoryRiskItems[0];
  const actionRows: ActionRow[] = [
    ...highPriorityRequests.slice(0, 2).map((item) => ({
      priority: "高" as const,
      title: "审批高优先级采购申请",
      object: item.pr,
      evidence: `${item.sourceSku || item.sourceName} · ${fmt(Number(item.amount || 0))} · ${item.reason || "等待审批"}`,
      module: "采购申请",
      moduleId: "purchaseRequests",
      cta: "打开 PR",
      detail: buildPrEvidence(item),
    })),
    ...pendingOrders.slice(0, 1).map((item) => ({
      priority: item.priority,
      title: "复核待审批采购订单",
      object: item.po,
      evidence: `${item.supplier} · ${fmt(item.amount)} · ETA ${item.eta}`,
      module: "采购订单",
      moduleId: "purchasing",
      cta: "打开 PO",
      detail: buildPoEvidence(item),
    })),
    ...(topRiskSku ? [{
      priority: "高" as const,
      title: "释放 MRP planned order",
      object: topRiskSku.sku,
      evidence: `覆盖 ${topRiskSku.plan.daysCover} 天 · 建议 ${topRiskSku.plan.suggestedQty.toLocaleString()} ${topRiskSku.plan.unit} · ${fmt(topRiskSku.plan.amount)}`,
      module: "高级计划",
      moduleId: "forecast",
      cta: "查看计划",
      detail: buildInventoryEvidence(topRiskSku, "forecast"),
    }] : []),
    ...receivingRisks.slice(0, 1).map((item) => ({
      priority: item.status === "异常处理" ? "高" as const : "中" as const,
      title: "跟进待收货 GRN",
      object: item.grn,
      evidence: `${item.supplier} · ${item.status} · PO ${item.po}`,
      module: "收货",
      moduleId: "receiving",
      cta: "处理 GRN",
      detail: buildReceivingEvidence(item),
    })),
    ...invoiceRisks.slice(0, 1).map((item) => ({
      priority: item.varianceType === "重复发票" || item.varianceType === "缺少收货" ? "高" as const : "中" as const,
      title: "复核供应商发票差异",
      object: item.invoiceNumber,
      evidence: `${item.relatedPo || "无 PO"} / ${item.relatedGrn || "缺少 GRN"} · ${item.varianceType} · 差异 ${fmt(item.varianceAmount || 0)}`,
      module: "供应商发票",
      moduleId: "procurement",
      cta: "查看发票",
      detail: buildInvoiceEvidence(item),
    })),
    ...returnRisks.slice(0, 1).map((item) => {
      const signal = returnToCockpitSignal(item, SUPPLIER_CREDIT_MEMOS);
      return {
        priority: item.status === "已驳回" || item.status === "待贷项" ? "高" as const : "中" as const,
        title: signal.title,
        object: item.returnNo,
        evidence: `${signal.supplier} · ${item.reason} · 未冲减 ${fmt(signal.amount)}`,
        module: "采购退货 / 贷项",
        moduleId: "procurement",
        cta: "查看退货",
        detail: buildPurchaseReturnEvidence(item),
      };
    }),
    ...reconciliationRisks.slice(0, 1).map((item) => {
      const signal = statementToCockpitSignal(item);
      return {
        priority: signal.priority,
        title: signal.title,
        object: item.statementNo,
        evidence: signal.evidence,
        module: "供应商对账",
        moduleId: "procurement",
        cta: "查看对账",
        detail: buildReconciliationEvidence(item),
      };
    }),
    ...openRfqs.slice(0, 1).map((item) => ({
      priority: "中" as const,
      title: "复核 RFQ 报价差异",
      object: item.id,
      evidence: `${item.title} · 已报价 ${item.quoted}/${item.suppliers} · 最优 ${item.bestSupplier}`,
      module: "供应商报价",
      moduleId: "rfq",
      cta: "查看 RFQ",
      detail: buildRfqEvidence(item),
    })),
    ...inventoryRiskItems.slice(1, 3).map((item) => ({
      priority: item.status === "不足" ? "高" as const : "中" as const,
      title: "处理库存短缺 SKU",
      object: item.sku,
      evidence: `${item.name} · 当前 ${item.qty.toLocaleString()} / 安全 ${item.min.toLocaleString()} · ROP ${item.plan.reorderPoint}`,
      module: "库存",
      moduleId: "inventory",
      cta: "补货",
      detail: buildInventoryEvidence(item),
      onClick: () => onPrepareReplenishmentRequest(item.sku),
    })),
    ...supplierRisks.slice(0, 1).map((item) => ({
      priority: "中" as const,
      title: "复核供应商异常",
      object: item.name,
      evidence: `${item.flag || "需复核"} · 准时率 ${Number(item.onTime || 0).toFixed(1)}% · 质量 ${Number(item.quality || 0).toFixed(1)}%`,
      module: "供应商与绩效",
      moduleId: "procurement",
      cta: "查看供应商",
      detail: buildSupplierEvidence(item),
    })),
  ].slice(0, 8);

  const inventoryDecisionDetail = topRiskSku ? buildInventoryEvidence(topRiskSku, "forecast") : buildForecastEvidence(undefined);
  const supplierDecisionDetail = buildSupplierEvidence(supplierRisks[0] || dashboardSuppliers[0] || PORTAL_SUPPLIERS[0]!);
  const rfqDecisionDetail = buildRfqEvidence(openRfqs[0] || dashboardRfqs[0] || RFQS[0]!);
  const invoiceDecisionDetail = invoiceRisks[0] ? buildInvoiceEvidence(invoiceRisks[0]) : null;
  const decisionCards: DecisionCard[] = [
    {
      id: "inventory-replenishment",
      recommendation: topRiskSku ? `复核 ${topRiskSku.sku} 补货建议` : "复核库存补货建议",
      businessImpact: topRiskSku ? `${fmt(topRiskSku.plan.amount)} 计划补货金额` : "库存风险稳定",
      evidenceUsed: topRiskSku ? `覆盖 ${topRiskSku.plan.daysCover} 天 · ROP ${topRiskSku.plan.reorderPoint} · 建议 ${topRiskSku.plan.suggestedQty.toLocaleString()} ${topRiskSku.plan.unit}` : "库存覆盖、ROP、MRP 例外",
      confidence: "88% · 高",
      riskWarning: topRiskSku && topRiskSku.plan.daysCover <= topRiskSku.plan.leadTimeDays ? "覆盖天数低于采购提前期，存在断供风险。" : "当前建议为滚动复核，不会自动创建单据。",
      suggestedAction: topRiskSku && !topRiskSku.plan.needsSourcing ? "生成补货 PR" : "打开高级计划",
      module: "高级计划",
      moduleId: "forecast",
      detail: inventoryDecisionDetail,
      onAction: topRiskSku && !topRiskSku.plan.needsSourcing ? () => onPrepareReplenishmentRequest(topRiskSku.sku) : undefined,
    },
    {
      id: "supplier-risk",
      recommendation: `复核 ${supplierDecisionDetail.object} 供应风险`,
      businessImpact: "降低延期、拒收和替代采购风险",
      evidenceUsed: supplierDecisionDetail.evidence.slice(2, 7).map((item) => `${item.label} ${item.value}`).join(" · "),
      confidence: "81% · 中高",
      riskWarning: "供应商风险建议仅用于复核，不会自动切换供应商。",
      suggestedAction: "打开供应商与绩效",
      module: "供应商与绩效",
      moduleId: "procurement",
      detail: supplierDecisionDetail,
    },
    {
      id: "rfq-price",
      recommendation: `复核 ${rfqDecisionDetail.object} 报价差异`,
      businessImpact: "帮助锁定补货成本和供应商选择依据",
      evidenceUsed: [
        rfqDecisionDetail.evidence.slice(4, 8).map((item) => `${item.label} ${item.value}`).join(" · "),
        invoiceDecisionDetail ? `发票差异 ${invoiceDecisionDetail.object} · ${invoiceDecisionDetail.evidence.find((item) => item.label === "差异类型")?.value}` : "",
      ].filter(Boolean).join(" · "),
      confidence: "78% · 中",
      riskWarning: "RFQ 仍需人工确认价格、交期和条款后再授标。",
      suggestedAction: "打开 RFQ",
      module: "供应商报价",
      moduleId: "rfq",
      detail: rfqDecisionDetail,
    },
  ];

  const risks = [
    {
      level: inventoryRiskItems.some((item) => item.status === "不足") ? "高" : "中",
      object: topRiskSku?.sku || "库存池",
      title: "库存短缺",
      evidence: topRiskSku ? `${topRiskSku.name} 覆盖 ${topRiskSku.plan.daysCover} 天，低于提前期 ${topRiskSku.plan.leadTimeDays} 天` : "当前未识别短缺 SKU",
      next: "检查 MRP 建议量并准备 PR",
      moduleId: "inventory",
      detail: topRiskSku ? buildInventoryEvidence(topRiskSku) : null,
    },
    {
      level: supplierRisks.length ? "中" : "低",
      object: supplierRisks[0]?.name || "供应商池",
      title: "供应商延迟 / 质量",
      evidence: supplierRisks[0] ? `${supplierRisks[0].flag} · 响应 ${Number(supplierRisks[0].resp || 0).toFixed(0)} · 质量 ${Number(supplierRisks[0].quality || 0).toFixed(1)}%` : "关键供应商绩效稳定",
      next: "复核供应商绩效和备选供应商",
      moduleId: "procurement",
      detail: supplierRisks[0] ? buildSupplierEvidence(supplierRisks[0]) : null,
    },
    {
      level: invoiceRisks.length ? (invoiceRisks[0].varianceType === "重复发票" || invoiceRisks[0].varianceType === "缺少收货" ? "高" : "中") : "低",
      object: invoiceRisks[0]?.invoiceNumber || "供应商发票",
      title: "发票金额 / 收货差异",
      evidence: invoiceRisks[0] ? `${invoiceRisks[0].supplier} · ${invoiceRisks[0].varianceType} · ${fmt(invoiceRisks[0].varianceAmount || 0)}` : "发票匹配状态稳定",
      next: "复核 PO、GRN 和 Invoice",
      moduleId: "procurement",
      detail: invoiceRisks[0] ? buildInvoiceEvidence(invoiceRisks[0]) : null,
    },
    {
      level: "中",
      object: "SKU-00412",
      title: "预测偏差",
      evidence: "高价值电气件近期需求波动，建议检查 Tracking Signal 与服务水平",
      next: "打开高级计划查看模型依据",
      moduleId: "forecast",
      detail: buildForecastEvidence(topRiskSku),
    },
    {
      level: openRfqs.length ? "中" : "低",
      object: openRfqs[0]?.id || "RFQ",
      title: "价格异常",
      evidence: openRfqs[0] ? `${openRfqs[0].title} 仍在比价，最佳报价 ${openRfqs[0].bestPrice}` : "暂无未决报价风险",
      next: "复核报价差异并锁定供应商",
      moduleId: "rfq",
      detail: openRfqs[0] ? buildRfqEvidence(openRfqs[0]) : null,
    },
    {
      level: "低",
      object: "LOT-260506-B12",
      title: "近效期 / 冻结库存",
      evidence: "密封圈 NBR-70 近效期，步进电机驱动板存在冻结批次",
      next: "按 FEFO 或 QA 复检处理",
      moduleId: "inventory",
      detail: null,
    },
  ] as const;

  const kpis = [
    { label: "今日待办", value: String(actionRows.length), sub: "按优先级排序", icon: ClipboardList, color: A.blue },
    { label: "高风险事项", value: String(actionRows.filter((item) => item.priority === "高").length), sub: "需今日处理", icon: AlertTriangle, color: A.red },
    { label: "待审批 PR", value: String(pendingRequests.length), sub: fmt(openPrValue), icon: FileCheck2, color: A.orange },
    { label: "待收货 GRN", value: String(receivingRisks.length), sub: "签收/质检/异常", icon: PackageCheck, color: A.teal },
    { label: "发票差异", value: String(invoiceRisks.length), sub: invoiceRisks[0]?.invoiceNumber || "稳定", icon: FileSpreadsheet, color: A.purple },
    { label: "库存风险 SKU", value: String(inventoryRiskItems.length), sub: topRiskSku?.sku || "稳定", icon: Package, color: A.green },
  ];

  const pulse = [
    { label: "OTIF", value: "96.2%", note: "本月交付", color: A.green },
    { label: "Inventory Turnover", value: "8.4x", note: "样本加权", color: A.blue },
    { label: "Forecast Accuracy", value: "92.1%", note: "MAPE 7.9%", color: A.purple },
    { label: "Purchase Cycle", value: "6.4d", note: "PR → PO", color: A.orange },
    { label: "Supplier Score", value: "88", note: "综合评分", color: A.teal },
    { label: "Open PR Value", value: fmt(openPrValue), note: "待审批", color: A.red },
    { label: "Open PO Value", value: fmt(openPoValue), note: "未关闭", color: A.gray1 },
  ];

  const quickLinks = [
    { label: "采购申请", id: "purchaseRequests" },
    { label: "采购订单", id: "purchasing" },
    { label: "采购工作台", id: "procurement" },
    { label: "库存", id: "inventory" },
    { label: "高级计划", id: "forecast" },
    { label: "报表中心", id: "reports" },
    { label: "导入中心", id: "imports" },
  ];

  function exportEvidence(detail: EvidenceDetail) {
    exportRowsToCsv(`cockpit-evidence-${safeFilenamePart(detail.object)}.csv`, evidenceRowsForExport(detail));
    toast.success("证据 CSV 已导出");
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-xl font-semibold tracking-tight" style={{ color: A.label }}>今日运营驾驶舱</h1>
              <Chip label="演示环境" color={A.blue} bg="#f0f6ff" />
              <Chip label="样本数据" color={A.gray1} bg={A.gray6} />
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ color: A.green, background: "#f0faf4" }}>
                今日更新
              </span>
            </div>
            <p className="text-sm" style={{ color: A.sub }}>从重点动作、运营风险、决策建议和证据包开始演示。</p>
          </div>
          <div className="flex items-center gap-2">
            {quickLinks.map((link) => (
              <button key={link.id} onClick={() => onNavigate(link.id)}
                className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium transition-opacity hover:opacity-90"
                style={{ color: A.gray1, background: A.gray6 }}>
                {link.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-6 gap-2">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} sub={kpi.sub} icon={kpi.icon} color={kpi.color} />
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
        <Card>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: A.label }}>今日关键动作</h2>
              <p className="text-[11px] mt-0.5" style={{ color: A.sub }}>最多展示 8 条，先处理影响交付、现金和供应连续性的事项。</p>
            </div>
            <Chip label={`${actionRows.length} actions`} color={A.blue} bg="#f0f6ff" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                  {["优先级", "动作", "对象", "依据", "模块", "下一步"].map((header) => (
                    <th key={header} className="text-left px-4 py-3 font-medium whitespace-nowrap" style={{ color: A.gray1 }}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {actionRows.map((row, index) => {
                  const style = priorityStyle(row.priority);
                  return (
                    <tr key={`${row.title}-${row.object}`} className="hover:bg-blue-50/40 transition-colors"
                      style={{ borderBottom: index < actionRows.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                      <td className="px-4 py-3"><Chip label={row.priority} color={style.color} bg={style.bg} /></td>
                      <td className="px-4 py-3 font-semibold" style={{ color: A.label }}>{row.title}</td>
                      <td className="px-4 py-3 tabular-nums" style={{ color: A.blue }}>{row.object}</td>
                      <td className="px-4 py-3 min-w-[260px]" style={{ color: A.sub }}>{row.evidence}</td>
                      <td className="px-4 py-3" style={{ color: A.gray1 }}>{row.module}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setSelectedEvidence(row.detail)}
                            className="text-[11px] px-2 py-1 rounded-md font-medium"
                            style={{ background: A.gray6, color: A.blue }}>
                            查看证据
                          </button>
                          <button onClick={row.onClick || (() => onNavigate(row.moduleId))}
                            className="text-[11px] px-2.5 py-1 rounded-md font-medium"
                            style={{ background: style.bg, color: style.color }}>
                            {row.cta}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <SectionHeader title="运营风险 Top Risks" />
            <div className="space-y-2">
              {risks.map((risk) => {
                const style = priorityStyle(risk.level as ActionRow["priority"]);
                return (
                  <div key={risk.title}
                    className="w-full text-left rounded-xl p-3 transition-colors hover:bg-blue-50/60"
                    style={{ background: A.gray6 }}>
                    <button onClick={() => onNavigate(risk.moduleId)} className="w-full text-left">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold" style={{ color: A.label }}>{risk.title}</div>
                        <Chip label={risk.level} color={style.color} bg={style.bg} />
                      </div>
                      <div className="text-[11px] mt-1" style={{ color: A.blue }}>{risk.object}</div>
                      <div className="text-[10px] leading-4 mt-1" style={{ color: A.sub }}>{risk.evidence}</div>
                      <div className="text-[10px] mt-2 font-medium" style={{ color: style.color }}>{risk.next}</div>
                    </button>
                    {risk.detail && (
                      <button onClick={() => setSelectedEvidence(risk.detail)}
                        className="text-[10px] mt-2 font-medium"
                        style={{ color: A.blue }}>
                        查看证据
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-4">
            <SectionHeader title="AI 决策卡"
              right={<button onClick={onOpenAi} className="text-[11px] px-2 py-1 rounded-md font-medium" style={{ background: "#f0f6ff", color: A.blue }}>打开 AI</button>} />
            <div className="space-y-2">
              {decisionCards.map((card) => (
                <div key={card.id} className="rounded-xl p-3" style={{ background: "#f0f6ff" }}>
                  <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: A.blue }}>
                    <Sparkles size={13} /> {card.recommendation}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3 text-[10px]">
                    <div className="rounded-lg p-2" style={{ background: A.white }}>
                      <div style={{ color: A.gray2 }}>业务影响</div>
                      <div className="font-semibold mt-0.5 truncate" style={{ color: A.red }}>{card.businessImpact}</div>
                    </div>
                    <div className="rounded-lg p-2" style={{ background: A.white }}>
                      <div style={{ color: A.gray2 }}>置信度</div>
                      <div className="font-semibold mt-0.5" style={{ color: A.green }}>{card.confidence}</div>
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] leading-4" style={{ color: A.sub }}>
                    <span className="font-medium" style={{ color: A.gray1 }}>证据：</span>{card.evidenceUsed}
                  </div>
                  <div className="mt-1 text-[10px] leading-4" style={{ color: A.orange }}>
                    {card.riskWarning}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-1.5">
                    <button onClick={() => setSelectedEvidence(card.detail)}
                      className="text-[11px] px-2 py-1.5 rounded-md font-medium"
                      style={{ background: A.white, color: A.blue }}>
                      查看证据
                    </button>
                    <button onClick={() => onNavigate(card.moduleId)}
                      className="text-[11px] px-2 py-1.5 rounded-md font-medium"
                      style={{ background: A.white, color: A.label }}>
                      打开模块
                    </button>
                    <button onClick={() => exportEvidence(card.detail)}
                      className="text-[11px] px-2 py-1.5 rounded-md font-medium"
                      style={{ background: A.white, color: A.gray1 }}>
                      导出证据
                    </button>
                  </div>
                  <button onClick={card.onAction || (() => onNavigate(card.moduleId))}
                    className="mt-2 w-full text-[11px] px-2 py-1.5 rounded-md font-medium text-white"
                    style={{ background: A.blue }}>
                    {card.suggestedAction}
                  </button>
                </div>
              ))}
            </div>
            <div className="text-[10px] leading-4 mt-2" style={{ color: A.gray2 }}>
              确定性演示逻辑，不会自动创建 PR/RFQ/PO 或修改库存。
            </div>
          </Card>
        </div>
      </div>

      <Card className="p-4">
        <SectionHeader title="核心运营脉搏" />
        <div className="grid grid-cols-7 gap-2">
          {pulse.map((item) => (
            <div key={item.label} className="rounded-xl p-3" style={{ background: A.gray6 }}>
              <div className="text-[10px] truncate" style={{ color: A.gray2 }}>{item.label}</div>
              <div className="text-base font-semibold mt-1 truncate" style={{ color: item.color }}>{item.value}</div>
              <div className="text-[10px] mt-0.5 truncate" style={{ color: A.sub }}>{item.note}</div>
            </div>
          ))}
        </div>
      </Card>

      <Modal
        open={Boolean(selectedEvidence)}
        onClose={() => setSelectedEvidence(null)}
        width={760}
        title={selectedEvidence?.title || "证据详情"}
        subtitle={selectedEvidence ? `${selectedEvidence.object} · ${selectedEvidence.module}` : undefined}
        footer={selectedEvidence && (
          <>
            <button onClick={() => {
              onNavigate(selectedEvidence.moduleId);
              setSelectedEvidence(null);
            }}
              className="text-xs px-3 py-1.5 rounded-lg font-medium text-white"
              style={{ background: A.blue }}>
              打开模块
            </button>
            <button onClick={() => exportEvidence(selectedEvidence)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5"
              style={{ background: A.white, color: A.blue, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)" }}>
              <FileSpreadsheet size={13} /> 导出证据 CSV
            </button>
            <button onClick={() => setSelectedEvidence(null)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium"
              style={{ background: A.white, color: A.label, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)" }}>
              关闭
            </button>
          </>
        )}>
        {selectedEvidence && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "优先级", value: selectedEvidence.priority, color: priorityStyle(selectedEvidence.priority).color },
                { label: "相关对象", value: selectedEvidence.object, color: A.blue },
                { label: "相关模块", value: selectedEvidence.module, color: A.label },
                { label: selectedEvidence.confidence ? "置信度" : "风险分", value: selectedEvidence.confidence || selectedEvidence.riskScore || "—", color: A.green },
              ].map((item) => (
                <div key={item.label} className="rounded-xl p-3" style={{ background: A.gray6 }}>
                  <div className="text-[10px]" style={{ color: A.gray2 }}>{item.label}</div>
                  <div className="text-sm font-semibold mt-1 truncate" style={{ color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div className="rounded-xl p-3" style={{ background: "#f0f6ff" }}>
              <div className="text-[11px] font-semibold mb-1" style={{ color: A.blue }}>业务原因</div>
              <div className="text-xs leading-5" style={{ color: A.sub }}>{selectedEvidence.businessReason}</div>
            </div>

            <div>
              <div className="text-xs font-semibold mb-2" style={{ color: A.label }}>证据列表</div>
              <div className="grid grid-cols-2 gap-2">
                {selectedEvidence.evidence.map((item) => (
                  <div key={item.label} className="rounded-xl px-3 py-2.5" style={{ background: A.gray6 }}>
                    <div className="text-[10px]" style={{ color: A.gray2 }}>{item.label}</div>
                    <div className="text-xs font-semibold mt-1 break-words" style={{ color: A.label }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl p-3" style={{ background: "#f0faf4" }}>
              <div className="text-[11px] font-semibold mb-1" style={{ color: A.green }}>建议下一步</div>
              <div className="text-xs leading-5" style={{ color: A.sub }}>{selectedEvidence.suggestedAction}</div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
