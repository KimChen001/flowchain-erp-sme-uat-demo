import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  CircleDollarSign,
  FileCheck2,
  FileSpreadsheet,
  Package,
  PackageCheck,
  TrendingUp,
  Truck,
  Users,
} from "lucide-react";
import { apiJson } from "../../lib/api-client";
import { exportRowsToCsv } from "../../lib/data-export";
import { fmt } from "../../lib/format";
import { A, Card, Chip, KpiCard, Modal, SectionHeader } from "../../components/ui";
import { INVENTORY_MOVEMENT_LEDGER, purchaseOrders, receivingDocs, RFQS, PORTAL_SUPPLIERS, PURCHASE_RETURNS, SUPPLIER_CREDIT_MEMOS, SUPPLIER_INVOICES, SUPPLIER_RECONCILIATION_STATEMENTS } from "../../data/demo-data";
import { INVENTORY_MOVEMENT_TYPE_LABELS, isInventoryMovementException, netInventoryImpact } from "../../domain/inventory/movements";
import { isStatementException, statementToCockpitSignal } from "../../domain/procurement/reconciliation";
import { calculateReturnFinancialImpact, isReturnException, returnToCockpitSignal } from "../../domain/procurement/returns";
import { masterDataQualitySignals } from "../../domain/master-data/helpers";
import type { PurchaseOrder, PurchaseRequest, ReceivingDoc, RfqRecord, SupplierInvoice } from "../../types/scm";
import type { ActionDraftPreviewRequest } from "../action-drafts/ActionDraftReviewShell";
import { TodayCockpitRecentDocuments } from "./TodayCockpitPanel";
import AiSuggestionsPage from "./AiSuggestionsPage";
import { fetchTodayCockpit, type TodayCockpitResponse } from "./todayCockpit";
import {
  buildForecastEvidence,
  buildInventoryEvidence,
  buildInventoryMovementEvidence,
  buildInvoiceEvidence,
  buildMasterDataEvidence,
  buildPoEvidence,
  buildPrEvidence,
  buildPurchaseReturnEvidence,
  buildReceivingEvidence,
  buildReconciliationEvidence,
  buildRfqEvidence,
  buildSupplierEvidence,
  evidenceRowsForExport,
  overviewReplenishmentActions,
  safeFilenamePart,
  type EvidenceDetail,
  type SupplierPerformance,
} from "./overviewEvidence";

type OverviewPanelProps = {
  initialView?: string;
  onNavigate: (moduleId: string, focusTarget?: { entityType: string; entityId: string } | null, options?: { returnTo?: string; entityLabel?: string; source?: string; returnContext?: unknown }) => void;
  onPrepareReplenishmentRequest: (sku: string) => void;
  onOpenAi: () => void;
  onReviewActionDraft?: (request: ActionDraftPreviewRequest) => void;
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

export default function OverviewPanel({ initialView = "", onNavigate, onPrepareReplenishmentRequest, onOpenAi, onReviewActionDraft }: OverviewPanelProps) {
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceDetail | null>(null);
  const [showAllActions, setShowAllActions] = useState(false);
  const [showMoreSummary, setShowMoreSummary] = useState(false);
  const [todayCockpit, setTodayCockpit] = useState<TodayCockpitResponse | null>(null);
  const [todayCockpitLoading, setTodayCockpitLoading] = useState(true);
  const [todayCockpitError, setTodayCockpitError] = useState(false);
  const [dashboardOrders, setDashboardOrders] = useState<PurchaseOrder[]>(purchaseOrders);
  const [dashboardRequests, setDashboardRequests] = useState<PurchaseRequest[]>([]);
  const [dashboardRfqs, setDashboardRfqs] = useState<RfqRecord[]>(RFQS);
  const [dashboardReceiving, setDashboardReceiving] = useState<ReceivingDoc[]>(receivingDocs);
  const [dashboardSuppliers, setDashboardSuppliers] = useState<SupplierPerformance[]>(PORTAL_SUPPLIERS);

  useEffect(() => {
    let alive = true;
    fetchTodayCockpit()
      .then((data) => { if (alive) { setTodayCockpit(data); setTodayCockpitError(false); } })
      .catch(() => { if (alive) { setTodayCockpit(null); setTodayCockpitError(true); } })
      .finally(() => { if (alive) setTodayCockpitLoading(false); });
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
  const inventoryMovementRisks = INVENTORY_MOVEMENT_LEDGER
    .filter(isInventoryMovementException)
    .sort((a, b) => Math.abs(netInventoryImpact(b)) - Math.abs(netInventoryImpact(a)));
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
      moduleId: "procurement:requests",
      cta: "打开 PR",
      detail: buildPrEvidence(item),
    })),
    ...pendingOrders.slice(0, 1).map((item) => ({
      priority: item.priority,
      title: "复核待审批采购订单",
      object: item.po,
      evidence: `${item.supplier} · ${fmt(item.amount)} · ETA ${item.eta}`,
      module: "采购订单",
      moduleId: "procurement:orders",
      cta: "打开 PO",
      detail: buildPoEvidence(item),
    })),
    ...(topRiskSku ? [{
      priority: "高" as const,
      title: "审阅 MRP 计划订单",
      object: topRiskSku.sku,
      evidence: `覆盖 ${topRiskSku.plan.daysCover} 天 · 建议 ${topRiskSku.plan.suggestedQty.toLocaleString()} ${topRiskSku.plan.unit} · ${fmt(topRiskSku.plan.amount)}`,
      module: "预测与 MRP",
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
      moduleId: "procurement:receiving",
      cta: "处理 GRN",
      detail: buildReceivingEvidence(item),
    })),
    ...inventoryMovementRisks.slice(0, 1).map((item) => ({
      priority: item.status === "异常处理" || item.movementType === "CycleCountVariance" ? "高" as const : "中" as const,
      title: item.movementType === "CycleCountVariance" ? "盘点差异待关闭" : "待复核库存移动",
      object: item.movementId,
      evidence: `${INVENTORY_MOVEMENT_TYPE_LABELS[item.movementType]} · ${item.sourceDocument} · 期末影响 ${netInventoryImpact(item).toLocaleString()} ${item.unit}`,
      module: "库存事务流水",
      moduleId: "inventory:exceptions",
      cta: "查看异常单据",
      detail: buildInventoryMovementEvidence(item),
    })),
    ...invoiceRisks.slice(0, 1).map((item) => ({
      priority: item.varianceType === "重复发票" || item.varianceType === "缺少收货" ? "高" as const : "中" as const,
      title: "复核供应商发票差异",
      object: item.invoiceNumber,
      evidence: `${item.relatedPo || "无 PO"} / ${item.relatedGrn || "缺少 GRN"} · ${item.varianceType} · 差异 ${fmt(item.varianceAmount || 0)}`,
      module: "发票协同",
      moduleId: "procurement:invoices",
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
        moduleId: "procurement:returns",
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
        moduleId: "finance:reconciliation",
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
      moduleId: "procurement:rfq",
      cta: "查看 RFQ",
      detail: buildRfqEvidence(item),
    })),
    ...inventoryRiskItems.slice(1, 3).map((item) => ({
      priority: item.status === "不足" ? "高" as const : "中" as const,
      title: "处理库存短缺 SKU",
      object: item.sku,
      evidence: `${item.name} · 当前 ${item.qty.toLocaleString()} / 安全 ${item.min.toLocaleString()} · ROP ${item.plan.reorderPoint}`,
      module: "库存",
      moduleId: "inventory:movements",
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
      moduleId: "srm:performance",
      cta: "查看供应商",
      detail: buildSupplierEvidence(item),
    })),
  ].slice(0, 8);

  const inventoryDecisionDetail = topRiskSku ? buildInventoryEvidence(topRiskSku, "forecast") : buildForecastEvidence(undefined);
  const supplierDecisionDetail = buildSupplierEvidence(supplierRisks[0] || dashboardSuppliers[0] || PORTAL_SUPPLIERS[0]!);
  const rfqDecisionDetail = buildRfqEvidence(openRfqs[0] || dashboardRfqs[0] || RFQS[0]!);
  const invoiceDecisionDetail = invoiceRisks[0] ? buildInvoiceEvidence(invoiceRisks[0]) : null;
  const masterDataSignal = masterDataQualitySignals();
  const decisionCards: DecisionCard[] = [
    {
      id: "inventory-replenishment",
      recommendation: topRiskSku ? `复核 ${topRiskSku.sku} 补货建议` : "复核库存补货建议",
      businessImpact: topRiskSku ? `${fmt(topRiskSku.plan.amount)} 计划补货金额` : "库存风险稳定",
      evidenceUsed: topRiskSku ? `覆盖 ${topRiskSku.plan.daysCover} 天 · ROP ${topRiskSku.plan.reorderPoint} · 建议 ${topRiskSku.plan.suggestedQty.toLocaleString()} ${topRiskSku.plan.unit}` : "库存覆盖、ROP、MRP 例外",
      confidence: "88% · 高",
      riskWarning: topRiskSku && topRiskSku.plan.daysCover <= topRiskSku.plan.leadTimeDays ? "覆盖天数低于采购提前期，存在断供风险。" : "当前建议为滚动复核，不会自动创建单据。",
      suggestedAction: topRiskSku && !topRiskSku.plan.needsSourcing ? "预览补货 PR 草稿" : "打开预测与 MRP",
      module: "预测与 MRP",
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
      moduleId: "srm:performance",
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
      moduleId: "procurement:rfq",
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
      moduleId: "srm:performance",
      detail: supplierRisks[0] ? buildSupplierEvidence(supplierRisks[0]) : null,
    },
    {
      level: invoiceRisks.length ? (invoiceRisks[0].varianceType === "重复发票" || invoiceRisks[0].varianceType === "缺少收货" ? "高" : "中") : "低",
      object: invoiceRisks[0]?.invoiceNumber || "供应商发票",
      title: "发票金额 / 收货差异",
      evidence: invoiceRisks[0] ? `${invoiceRisks[0].supplier} · ${invoiceRisks[0].varianceType} · ${fmt(invoiceRisks[0].varianceAmount || 0)}` : "发票匹配状态稳定",
      next: "复核 PO、GRN 和发票",
      moduleId: "procurement:invoices",
      detail: invoiceRisks[0] ? buildInvoiceEvidence(invoiceRisks[0]) : null,
    },
    {
      level: "中",
      object: "SKU-00412",
      title: "预测偏差",
      evidence: "高价值电气件近期需求波动，建议检查 Tracking Signal 与服务水平",
      next: "打开预测与 MRP 查看模型依据",
      moduleId: "forecast",
      detail: buildForecastEvidence(topRiskSku),
    },
    {
      level: openRfqs.length ? "中" : "低",
      object: openRfqs[0]?.id || "RFQ",
      title: "价格异常",
      evidence: openRfqs[0] ? `${openRfqs[0].title} 仍在比价，最佳报价 ${openRfqs[0].bestPrice}` : "暂无未决报价风险",
      next: "复核报价差异并锁定供应商",
      moduleId: "procurement:rfq",
      detail: openRfqs[0] ? buildRfqEvidence(openRfqs[0]) : null,
    },
    {
      level: "低",
      object: "基础资料控制",
      title: "基础资料质量",
      evidence: `缺少默认税码 ${masterDataSignal.missingTaxCode} · 缺少默认供应商 ${masterDataSignal.missingSupplier} · 库位需复核 ${masterDataSignal.inactiveBins}`,
      next: "复核税码、供应商和库位维护状态",
      moduleId: "master-data",
      detail: buildMasterDataEvidence(),
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
    { label: "库存周转", value: "8.4x", note: "加权指标", color: A.blue },
    { label: "预测准确率", value: "92.1%", note: "MAPE 7.9%", color: A.purple },
    { label: "采购周期", value: "6.4d", note: "PR → PO", color: A.orange },
    { label: "供应商评分", value: "88", note: "综合评分", color: A.teal },
    { label: "待审批 PR 金额", value: fmt(openPrValue), note: "待审批", color: A.red },
    { label: "未关闭 PO 金额", value: fmt(openPoValue), note: "未关闭", color: A.gray1 },
  ];

  const quickLinks = [
    { label: "基础资料", id: "master-data" },
    { label: "采购管理", id: "procurement" },
    { label: "销售管理", id: "sales" },
    { label: "库存管理", id: "inventory" },
    { label: "结算管理", id: "finance" },
    { label: "报表中心", id: "reports" },
  ];
  const visibleKpis = [
    kpis[0],
    kpis[1],
    { label: "待审批 PR / PO", value: String(pendingRequests.length + pendingOrders.length), sub: `${fmt(openPrValue)} PR · ${fmt(openPoValue)} PO`, icon: FileCheck2, color: A.orange },
    { label: "库存 / 供应风险", value: String(inventoryRiskItems.length + supplierRisks.length), sub: `${topRiskSku?.sku || "库存稳定"} · ${supplierRisks[0]?.name || "供应稳定"}`, icon: Package, color: A.teal },
  ];
  const focusCards = [
    risks.find((risk) => risk.title === "库存短缺"),
    risks.find((risk) => risk.title === "供应商延迟 / 质量"),
    risks.find((risk) => risk.title === "发票金额 / 收货差异"),
  ].filter(Boolean) as typeof risks[number][];

  function exportEvidence(detail: EvidenceDetail) {
    exportRowsToCsv(`cockpit-evidence-${safeFilenamePart(detail.object)}.csv`, evidenceRowsForExport(detail));
    toast.success("证据文件已生成");
  }

  function renderEvidenceModal() {
    return (
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
              <FileSpreadsheet size={13} /> 导出证据
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
                  <div className="fc-caption" style={{ color: A.gray2 }}>{item.label}</div>
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
                    <div className="fc-caption" style={{ color: A.gray2 }}>{item.label}</div>
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
    );
  }

  const recentDocuments = todayCockpit?.recentDocuments.slice(0, 6) || [];
  const todaySummaryCards = [
    { label: "交付风险", value: String(receivingRisks.length + pendingOrders.length), sub: pendingOrders[0]?.po || receivingRisks[0]?.grn || "交付稳定", icon: Truck, color: A.blue },
    { label: "采购待处理", value: String(pendingRequests.length + pendingOrders.length + openRfqs.length), sub: `${pendingRequests.length} PR · ${pendingOrders.length} PO · ${openRfqs.length} RFQ`, icon: ClipboardList, color: A.orange },
    { label: "库存风险", value: String(inventoryRiskItems.length + inventoryMovementRisks.length), sub: topRiskSku?.sku || inventoryMovementRisks[0]?.movementId || "库存稳定", icon: Package, color: A.green },
  ];
  const riskKpis = [
    { label: "采购风险", value: String(pendingOrders.length + receivingRisks.length + openRfqs.length), sub: pendingOrders[0]?.po || receivingRisks[0]?.grn || openRfqs[0]?.id || "稳定", icon: Truck, color: A.blue },
    { label: "库存风险", value: String(inventoryRiskItems.length + inventoryMovementRisks.length), sub: topRiskSku?.sku || inventoryMovementRisks[0]?.movementId || "稳定", icon: Package, color: A.green },
    { label: "供应商风险", value: String(supplierRisks.length + reconciliationRisks.length), sub: supplierRisks[0]?.name || reconciliationRisks[0]?.supplier || "稳定", icon: Users, color: A.purple },
    { label: "财务异常", value: String(invoiceRisks.length + returnRisks.length), sub: invoiceRisks[0]?.invoiceNumber || returnRisks[0]?.returnNo || "稳定", icon: CircleDollarSign, color: A.orange },
  ];
  const riskCategories = [
    { title: "采购风险", rows: risks.filter((risk) => ["库存短缺", "价格异常"].includes(risk.title) || risk.object.startsWith("PO")).slice(0, 2), color: A.blue },
    { title: "库存风险", rows: risks.filter((risk) => risk.title === "库存短缺" || risk.title === "预测偏差").slice(0, 2), color: A.green },
    { title: "供应商风险", rows: risks.filter((risk) => risk.title === "供应商延迟 / 质量" || risk.title === "价格异常").slice(0, 2), color: A.purple },
    { title: "财务异常", rows: risks.filter((risk) => risk.title === "发票金额 / 收货差异" || risk.title === "基础资料质量").slice(0, 2), color: A.orange },
  ];

  if (initialView === "ai") {
    return <AiSuggestionsPage onNavigate={onNavigate} onReviewActionDraft={onReviewActionDraft} onOpenAi={onOpenAi} />;
  }

  if (initialView === "risks") {
    return (
      <div className="space-y-4">
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="fc-section-title" style={{ color: A.label }}>风险与异常</h2>
              <p className="mt-1 max-w-3xl text-[14px] leading-6" style={{ color: A.sub }}>
                聚合采购、销售、库存和结算异常，优先进入对应业务单据处理。
              </p>
            </div>
            <button onClick={() => onNavigate("exception-cases")}
              className="inline-flex h-9 items-center gap-1.5 rounded-md px-4 text-[13px] font-semibold text-white"
              style={{ background: A.blue }}>
              异常处理工单 <ArrowRight size={14} />
            </button>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {riskKpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="p-4">
            <SectionHeader title="风险分类" />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {riskCategories.map((category) => (
                <div key={category.title} className="rounded-xl border p-3" style={{ borderColor: A.border, background: A.white }}>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: category.color }} />
                    <div className="text-[13px] font-semibold" style={{ color: A.label }}>{category.title}</div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {category.rows.map((risk) => {
                      const style = priorityStyle(risk.level as ActionRow["priority"]);
                      return (
                        <button key={`${category.title}-${risk.title}`} type="button" onClick={() => risk.detail && setSelectedEvidence(risk.detail)}
                          className="w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50"
                          style={{ background: A.gray6 }}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[12px] font-semibold" style={{ color: A.label }}>{risk.title}</span>
                            <Chip label={risk.level} color={style.color} bg={style.bg} />
                          </div>
                          <div className="mt-1 truncate text-[11px]" style={{ color: A.sub }}>{risk.object} · {risk.evidence}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="px-5 py-4" style={{ borderBottom: `1px solid ${A.border}` }}>
              <h2 className="text-[16px] font-semibold" style={{ color: A.label }}>异常清单</h2>
              <p className="mt-1 text-[12px]" style={{ color: A.sub }}>按交付、现金和供应连续性影响排序。</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead style={{ background: "#fbfdff" }}>
                  <tr>
                    {["等级", "异常", "对象", "依据", "入口"].map((header) => (
                      <th key={header} className="px-4 py-3 text-[12px] font-semibold" style={{ color: A.gray1 }}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {risks.slice(0, 6).map((risk, index) => {
                    const style = priorityStyle(risk.level as ActionRow["priority"]);
                    return (
                      <tr key={`${risk.title}-${risk.object}`} style={{ borderTop: index ? `1px solid ${A.border}` : "none" }}>
                        <td className="px-4 py-3"><Chip label={risk.level} color={style.color} bg={style.bg} /></td>
                        <td className="px-4 py-3 text-[13px] font-semibold" style={{ color: A.label }}>{risk.title}</td>
                        <td className="px-4 py-3 text-[13px] tabular-nums" style={{ color: A.blue }}>{risk.object}</td>
                        <td className="px-4 py-3 text-[13px]" style={{ color: A.sub }}>{risk.evidence}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {risk.detail && (
                              <button onClick={() => setSelectedEvidence(risk.detail)}
                                className="rounded-md px-2.5 py-1.5 text-[12px] font-semibold"
                                style={{ background: "#eef4ff", color: A.blue }}>
                                证据入口
                              </button>
                            )}
                            <button onClick={() => onNavigate(risk.moduleId)}
                              className="rounded-md px-2.5 py-1.5 text-[12px] font-semibold"
                              style={{ background: A.gray6, color: A.label }}>
                              打开模块
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
        </div>

        {renderEvidenceModal()}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {false && <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h2 className="fc-section-title" style={{ color: A.label }}>今日经营概览</h2>
              <Chip label="运营工作台" color={A.blue} bg="#f0f6ff" />
              <span className="fc-caption px-2 py-0.5 rounded-full font-medium" style={{ color: A.green, background: "#f0faf4" }}>
                今日更新
              </span>
            </div>
            <p className="text-sm" style={{ color: A.sub }}>从今日待办、业务预警、进销存快捷入口和 AI 摘要开始处理。</p>
            <div className="mt-3 rounded-xl px-3 py-2 text-xs leading-5" style={{ background: "#f8fafc", color: A.sub, border: `1px solid ${A.border}` }}>
              今日重点集中在销售交付、采购待处理、库存预警和结算差异；供应商资料回到基础资料维护。
            </div>
          </div>
          <button onClick={() => onNavigate("overview:ai", null, {
            returnTo: "overview",
            entityLabel: "AI 摘要",
            source: "todayCockpit",
            returnContext: {
              sourceModule: "todayCockpit",
              sourceRoute: "overview",
              sourceLabel: "今日行动",
              returnLabel: "返回 今日行动",
              originIntent: "openAiSummary",
            },
          })}
            className="inline-flex h-9 items-center gap-1.5 rounded-md px-4 text-[13px] font-semibold"
            style={{ background: "#eef4ff", color: A.blue }}>
            查看 AI 摘要 <ArrowRight size={14} />
          </button>
        </div>
      </Card>}

      {false && <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {todaySummaryCards.map((kpi) => (
          <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} sub={kpi.sub} icon={kpi.icon} color={kpi.color} />
        ))}
      </div>}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold" style={{ color: A.label }}>今日需处理</h2>
              <p className="text-[11px] mt-0.5" style={{ color: A.sub }}>按交付、现金和供应连续性影响排序。</p>
            </div>
            <button onClick={() => setShowAllActions((value) => !value)}
              className="text-[11px] px-3 py-1.5 rounded-md font-medium"
              style={{ background: showAllActions ? A.gray6 : "#eef4ff", color: A.blue }}>
              {showAllActions ? "收起队列" : `查看全部 ${actionRows.length} 项`}
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {(showAllActions ? actionRows : actionRows.slice(0, 5)).map((row) => {
              const style = priorityStyle(row.priority);
              return (
                <div key={`${row.title}-${row.object}`} className="flex items-center justify-between gap-3 rounded-lg px-3 py-3 border" style={{ background: A.white, borderColor: A.border }}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Chip label={row.priority} color={style.color} bg={style.bg} />
                      <div className="text-[12px] font-semibold" style={{ color: A.label }}>{row.title}</div>
                    </div>
                    <div className="text-[11px] mt-1 truncate" style={{ color: A.sub }}>{row.object} · {row.evidence}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={row.onClick || (() => onNavigate(row.moduleId))}
                      className="text-[11px] px-2.5 py-1.5 rounded-md font-medium text-white"
                      style={{ background: A.blue }}>
                      {row.cta}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>今日状态</h2>
          <div className="mt-3 grid gap-3">{[
            { label: "待我处理", value: actionRows.length, color: A.blue },
            { label: "风险异常", value: risks.length, color: A.orange },
            { label: "今日变化", value: recentDocuments.length, color: A.green },
          ].map((item) => <div key={item.label} className="rounded-xl border p-3" style={{borderColor:A.border}}><div className="text-[11px]" style={{color:A.sub}}>{item.label}</div><div className="mt-1 text-2xl font-bold tabular-nums" style={{color:item.color}}>{item.value}</div></div>)}</div>
          <button onClick={() => onNavigate("overview:ai")} className="mt-3 w-full rounded-md px-3 py-2 text-[12px] font-semibold" style={{background:"#eef4ff",color:A.blue}}>让 AI 解释今日重点</button>
        </Card>
        {false && <Card className="col-span-2 p-4">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: A.label }}>进入工作台</h2>
            <p className="text-[11px] mt-0.5" style={{ color: A.sub }}>先进入模块，详细表格在模块内展开。</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {quickLinks.map((link) => {
              const signal = link.id === "procurement" ? `${pendingRequests.length + pendingOrders.length}`
                : link.id === "inventory" ? `${inventoryRiskItems.length}`
                  : link.id === "srm" ? `${supplierRisks.length}`
                    : link.id === "finance" ? `${invoiceRisks.length}`
                      : "MRP";
              return (
                <button key={link.id} onClick={() => onNavigate(link.id)}
                  className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-[11px] font-medium hover:bg-slate-50 transition-colors"
                  style={{ background: A.white, borderColor: A.border, color: A.label }}>
                  <span className="truncate">{link.label}</span>
                  <span className="rounded px-1.5 py-px fc-caption" style={{ background: "#eef4ff", color: A.blue }}>{signal}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-4 rounded-lg border px-3 py-3" style={{ borderColor: A.border, background: A.gray6 }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[12px] font-semibold" style={{ color: A.label }}>轻量入口</h3>
                <p className="fc-caption mt-0.5" style={{ color: A.sub }}>AI 摘要只作轻入口，完整问答在 AI 助手。</p>
              </div>
              <button onClick={() => onNavigate("overview:ai", null, {
                returnTo: "overview",
                entityLabel: "AI 摘要",
                source: "todayCockpit",
                returnContext: {
                  sourceModule: "todayCockpit",
                  sourceRoute: "overview",
                  sourceLabel: "今日行动",
                  returnLabel: "返回 今日行动",
                  originIntent: "openAiSummary",
                },
              })}
                className="text-[11px] px-3 py-1.5 rounded-md font-medium"
                style={{ background: A.white, color: A.blue }}>
                打开 AI 摘要
              </button>
            </div>
          </div>
          <div data-testid="core-business-chain-entry" className="mt-3 rounded-lg border px-3 py-3" style={{ borderColor: A.border, background: A.white }}>
            <div className="flex items-start gap-2">
              <div className="mt-0.5 grid h-7 w-7 place-items-center rounded-md" style={{ background: "#f0f6ff", color: A.blue }}>
                <TrendingUp size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate text-[12px] font-semibold" style={{ color: A.label }}>核心业务链</h3>
                  <span className="rounded px-1.5 py-px fc-caption" style={{ background: "#fff8f0", color: A.orange }}>
                    待复核
                  </span>
                </div>
                <p className="mt-1 fc-caption leading-4" style={{ color: A.sub }}>
                  销售订单、SKU 库存风险、PO、收货和供应商发票放在同一条证据线上查看。
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button onClick={() => onNavigate("sales:evidence", { entityType: "sales_order", entityId: "SO-2026-0412-A" }, {
                    returnTo: "overview",
                    entityLabel: "SO-2026-0412-A",
                    source: "coreBusinessChain",
                    returnContext: {
                      sourceModule: "overview",
                      sourceRoute: "overview",
                      sourceLabel: "今日行动",
                      returnLabel: "返回 今日行动",
                      originIntent: "coreBusinessChain",
                    },
                  })}
                    className="rounded-md px-2.5 py-1.5 text-[11px] font-medium"
                    style={{ background: "#eef4ff", color: A.blue }}>
                    查看主链证据
                  </button>
                  <button onClick={onOpenAi}
                    className="rounded-md px-2.5 py-1.5 text-[11px] font-medium"
                    style={{ background: A.gray6, color: A.label }}>
                    询问 AI
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Card>}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2"><Card className="p-4"><h2 className="text-sm font-semibold" style={{color:A.label}}>业务概况</h2><div className="mt-3 grid grid-cols-2 gap-3">{riskKpis.map((item)=><div key={item.label} className="rounded-lg border p-3" style={{borderColor:A.border}}><div className="text-[11px]" style={{color:A.sub}}>{item.label}</div><div className="mt-1 text-xl font-bold">{item.value}</div></div>)}</div></Card><Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: A.label }}>最近单据</h2>
            <p className="text-[11px] mt-0.5" style={{ color: A.sub }}>近期采购、收货、报价和发票协同记录。</p>
          </div>
          {todayCockpitLoading && <span className="text-[11px]" style={{ color: A.sub }}>加载中</span>}
          {todayCockpitError && <span className="text-[11px]" style={{ color: A.orange }}>最近单据暂不可用</span>}
        </div>
        <div className="mt-3">
          <TodayCockpitRecentDocuments documents={recentDocuments} onNavigate={onNavigate} />
        </div>
      </Card></div>

      {renderEvidenceModal()}
    </div>
  );
}
