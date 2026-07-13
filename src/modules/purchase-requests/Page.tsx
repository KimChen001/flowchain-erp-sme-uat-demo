import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import {
  Activity, AlertCircle, CheckCircle2, ClipboardCheck, FileCheck2, FileSpreadsheet, FileText, Filter, GitBranch,
  Loader2, Package, Plus, Send, Sparkles, XCircle, ShieldCheck,
} from "lucide-react";
import { apiJson } from "../../lib/api-client";
import { exportRowsToCsv } from "../../lib/data-export";
import { fmt } from "../../lib/format";
import { OWNERS, RFQS, SKU_CATALOG, SUPPLIER_LIST, purchaseOrders } from "../../data/demo-data";
import type { PurchaseIntent, PurchaseOrder, PurchaseRequest, PurchaseRequestStatus, RfqRecord, SupplierRecommendationResult } from "../../types/scm";
import { A, Card, Chip, DocumentHistoryPanel, Field, inputStyle, KpiCard, Modal, RecoveryActions, SectionHeader } from "../../components/ui";
import {
  DocumentActionBar,
  DocumentEvidencePanel,
  DocumentHeader,
  DocumentLinesTable,
  DocumentShell,
  DocumentStatusTimeline,
  DocumentTotals,
  statusTone,
  type TimelineStep,
} from "../../components/document/DocumentShell";
import ContextualImportActions from "../../components/import/ContextualImportActions";
import { BusinessEntityLink } from "../../components/business/BusinessEntityLink";
import { WorkbenchMoreMenu } from "../../components/ui/WorkbenchMoreMenu";
import {
  CompactKpiStrip,
  DetailFieldGrid,
  DetailSection,
  EvidenceSummaryPanel,
} from "../../components/business/BusinessObjectDetail";
import type { ActiveContext } from "../ai-assistant/Panel";
import CanonicalProcurementPanel from "./CanonicalProcurementPanel";
import {
  defaultPurchaseRequestWorkbenchFilters,
  filterPurchaseRequestsForWorkbench,
  type PurchaseRequestWorkbenchFilters,
} from "./filters";
import {
  tableMinLgClass,
  tableScrollClass,
  tableLinkClass,
  tdActionClass,
  tdIdClass,
  tdNameClass,
  tdNowrapClass,
  tdNumericClass,
  thClass,
} from "../../components/ui/workbenchTable";

type PurchaseRequestViewMode = "list" | "detail";

function prTimeline(pr: PurchaseRequest): TimelineStep[] {
  const rejected = pr.status === "已驳回" || pr.status === "已取消";
  const approved = pr.status === "已批准" || pr.status === "已转PO";
  const linkedPo = pr.linkedPo || purchaseOrders.find((order) => order.sourceRequest === pr.pr)?.po;
  return [
    { label: "草稿", status: pr.status === "草稿" ? "current" : "done", helper: pr.created },
    { label: "待审批", status: rejected ? "blocked" : approved ? "done" : pr.status === "待审批" ? "current" : "pending" },
    { label: "已批准", status: approved ? "done" : rejected ? "blocked" : "pending" },
    { label: "已转 PO / RFQ", status: pr.status === "已转PO" ? "done" : approved ? "current" : "pending", helper: linkedPo || "等待转单" },
    { label: rejected ? pr.status : "已关闭", status: rejected ? "blocked" : pr.status === "已转PO" ? "done" : "pending" },
  ];
}

function exportPurchaseRequestDetail(pr: PurchaseRequest) {
  const headerRows = [
    ["PR编号", pr.pr],
    ["申请人", pr.requester],
    ["采购负责人", pr.buyer],
    ["需求日期", pr.requiredDate],
    ["优先级", pr.priority],
    ["状态", pr.status],
    ["供应商", pr.supplier],
    ["来源", pr.source],
    ["来源SKU", pr.sourceSku],
    ["后续PO", pr.linkedPo || purchaseOrders.find((order) => order.sourceRequest === pr.pr)?.po || ""],
    ["来源说明", pr.approvalSnapshot?.summary || pr.reason || ""],
    ["金额", pr.amount],
    ["原因", pr.reason],
  ].map(([field, value]) => ({ section: "header", field, value }));
  const lineRows = [{
    section: "line",
    field: pr.sourceSku || pr.pr,
    value: pr.sourceName,
    数量: pr.quantity,
    单位: pr.unit,
    单价: pr.unitPrice,
    金额: pr.amount,
    供应商: pr.supplier,
  }];
  exportRowsToCsv(`purchase-request-detail-${pr.pr}.csv`, [...headerRows, ...lineRows]);
  toast.success("采购申请详情已导出");
}

function PRStatusPill({ status }: { status: string }) {
  const displayStatus = status || "未知";
  const m = prStatusTone(displayStatus);
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ color: m.color, background: m.bg }}>{displayPrStatus(displayStatus)}</span>
  );
}

function purchaseRequestSourceMeta(source: string) {
  if (source === "forecast") return { label: "预测", icon: Sparkles, color: A.blue, bg: "#f0f6ff" };
  if (source === "inventory") return { label: "库存补货", icon: Package, color: A.orange, bg: "#fff8f0" };
  if (source === "mrp-release") return { label: "MRP释放", icon: GitBranch, color: A.purple, bg: "#f5f0ff" };
  if (source === "csv-import") return { label: "CSV 导入", icon: FileSpreadsheet, color: A.teal, bg: "#eefcf8" };
  if (source === "sales-risk") return { label: "客户订单交付风险", icon: AlertCircle, color: A.red, bg: "#fff1f0" };
  if (source === "ai-draft") return { label: "AI 建议草稿", icon: Sparkles, color: A.purple, bg: "#f5f0ff" };
  return { label: "手工", icon: FileText, color: A.gray1, bg: A.gray6 };
}

function requesterDepartment(requester: string) {
  if (requester.includes("张")) return "供应链计划";
  if (requester.includes("李")) return "生产运营";
  if (requester.includes("陈")) return "采购运营";
  return "制造中心";
}

function displayPrStatus(status: string) {
  const map: Record<string, string> = {
    草稿: "草稿",
    待审批: "待复核",
    已批准: "已通过",
    已驳回: "已拒绝",
    已转PO: "已创建采购订单",
    已取消: "已取消",
  };
  return map[status] || status || "待确认";
}

function prStatusTone(status: string) {
  if (status === "已批准" || status === "已转PO") return { color: A.green, bg: "#f0faf4" };
  if (status === "已驳回" || status === "已取消") return { color: A.red, bg: "#fff1f0" };
  if (status === "待审批") return { color: A.orange, bg: "#fff8f0" };
  return { color: A.gray1, bg: A.gray6 };
}

function linkedPoForPr(pr: PurchaseRequest) {
  return pr.linkedPo || purchaseOrders.find((order) => order.sourceRequest === pr.pr)?.po || "";
}

function linkedRfqForPr(pr: PurchaseRequest) {
  return (RFQS as RfqRecord[]).find((rfq) => (rfq.sourceRequest || rfq.sourcePrId) === pr.pr)?.id || "";
}

function nextStepForPr(pr: PurchaseRequest) {
  if (pr.status === "草稿") return "提交复核";
  if (pr.status === "待审批") return "等待负责人复核";
  if (pr.status === "已批准") return pr.source === "inventory" ? "待创建采购订单" : "待发起询价";
  if (pr.status === "已转PO") return "跟踪关联采购订单";
  if (pr.status === "已驳回") return "查看拒绝原因";
  if (pr.status === "已取消") return "查看取消原因";
  return "需人工复核";
}

type PrLineView = {
  lineId: string;
  sku: string;
  itemName: string;
  quantity: number;
  unit: string;
  needByDate: string;
  warehouse: string;
  supplier: string;
  category: string;
  unitPrice: number;
  amount: number;
  sourceDemand: string;
  sourceShortage: string;
  customerOrder: string;
  linkedRfqLine: string;
  linkedPoLine: string;
  status: string;
  risk: string;
};

function buildPrLines(pr: PurchaseRequest): PrLineView[] {
  const baseQty = Number(pr.quantity || 0);
  const basePrice = Number(pr.unitPrice || 0);
  const linkedPo = linkedPoForPr(pr);
  const linkedRfq = linkedRfqForPr(pr);
  return [
    {
      lineId: `${pr.pr}-L1`,
      sku: pr.sourceSku || "SKU-待确认",
      itemName: pr.sourceName || "采购申请物料",
      quantity: baseQty,
      unit: pr.unit || "件",
      needByDate: pr.requiredDate,
      warehouse: pr.forecastBasis?.plannedReleasePeriod ? "华东成品仓" : "总装线边仓",
      supplier: pr.supplier || "待推荐",
      category: "生产物料",
      unitPrice: basePrice,
      amount: Number(pr.amount || baseQty * basePrice),
      sourceDemand: pr.source === "inventory" ? "来源于库存缺口" : purchaseRequestSourceMeta(pr.source).label,
      sourceShortage: pr.forecastBasis?.peakGap ? `缺口 ${pr.forecastBasis.peakGap}` : "安全库存低于再订货点",
      customerOrder: pr.source === "sales-risk" ? pr.reason.match(/SO-[\w-]+/)?.[0] || "—" : "—",
      linkedRfqLine: linkedRfq ? `${linkedRfq}-L1` : "—",
      linkedPoLine: linkedPo ? `${linkedPo}-L1` : "—",
      status: pr.status === "已转PO" ? "已创建采购订单" : pr.status === "已批准" ? "待发起询价" : "仍待复核",
      risk: pr.priority === "高" ? "高优先级，需复核需求日期" : "需确认供应商与价格",
    },
  ];
}

function UnusedPurchaseRequestForm({ open, onClose, onCreate }: {
  open: boolean;
  onClose: () => void;
  onCreate: (request: Partial<PurchaseRequest>) => Promise<PurchaseRequest>;
}) {
  const [sku, setSku] = useState(SKU_CATALOG[0].sku);
  const [supplier, setSupplier] = useState(SUPPLIER_LIST[0]);
  const [requester, setRequester] = useState("张磊");
  const [buyer, setBuyer] = useState(OWNERS[0]);
  const [priority, setPriority] = useState<"高" | "中" | "低">("中");
  const [requiredDate, setRequiredDate] = useState("6月20日");
  const [quantity, setQuantity] = useState(10);
  const [reason, setReason] = useState("生产计划新增需求，需要采购补料。");
  const [submitting, setSubmitting] = useState(false);

  const item = SKU_CATALOG.find((entry) => entry.sku === sku) || SKU_CATALOG[0];
  const amount = Math.max(0, Number(quantity || 0)) * Number(item.price || 0);

  function reset() {
    setSku(SKU_CATALOG[0].sku);
    setSupplier(SUPPLIER_LIST[0]);
    setRequester("张磊");
    setBuyer(OWNERS[0]);
    setPriority("中");
    setRequiredDate("6月20日");
    setQuantity(10);
    setReason("生产计划新增需求，需要采购补料。");
  }

  async function submit(asDraft: boolean) {
    if (!sku || quantity <= 0) {
      toast.error("请选择物料并填写大于 0 的数量");
      return;
    }
    setSubmitting(true);
    try {
      await Promise.resolve();
      toast.success(asDraft ? "采购申请草稿预览已生成" : "提交复核预览已生成", {
        description: `${item.sku} · ${quantity.toLocaleString()} 件 · ${fmt(amount)} · 不写入业务数据`,
      });
    } catch (error) {
      toast.error("采购申请预览失败", { description: error instanceof Error ? error.message : "请检查当前输入" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} width={720}
      title="新建采购申请草稿预览" subtitle="仅用于复核前预览，不创建正式申请、不触发审批流程"
      footer={
        <>
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ background: A.white, color: A.label, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.1)" }}>取消</button>
          <button onClick={() => submit(true)} disabled={submitting}
            className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ background: A.gray5, color: A.label }}>保存草稿预览</button>
          <button onClick={() => submit(false)} disabled={submitting}
            className="text-xs px-3 py-1.5 rounded-lg font-medium text-white flex items-center gap-1.5"
            style={{ background: A.blue, opacity: submitting ? 0.6 : 1 }}>
            {submitting ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
            提交复核预览
          </button>
        </>
      }>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Field label="申请人 / Requester *">
          <input value={requester} onChange={(e) => setRequester(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="采购负责人">
          <select value={buyer} onChange={(e) => setBuyer(e.target.value)} style={inputStyle}>
            {OWNERS.map((owner) => <option key={owner}>{owner}</option>)}
          </select>
        </Field>
        <Field label="物料 *">
          <select value={sku} onChange={(e) => setSku(e.target.value)} style={inputStyle}>
            {SKU_CATALOG.map((entry) => <option key={entry.sku} value={entry.sku}>{entry.sku} · {entry.name}</option>)}
          </select>
        </Field>
        <Field label="建议供应商">
          <select value={supplier} onChange={(e) => setSupplier(e.target.value)} style={inputStyle}>
            {SUPPLIER_LIST.map((entry) => <option key={entry}>{entry}</option>)}
          </select>
        </Field>
        <Field label="需求日期">
          <input value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="优先级">
          <select value={priority} onChange={(e) => setPriority(e.target.value as "高" | "中" | "低")} style={inputStyle}>
            {(["高", "中", "低"] as const).map((entry) => <option key={entry}>{entry}</option>)}
          </select>
        </Field>
        <Field label="数量 *">
          <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value || 0))} style={inputStyle} />
        </Field>
        <Field label="预估金额">
          <div className="h-[35px] rounded-lg px-3 flex items-center text-sm font-semibold" style={{ background: A.gray6, color: A.label }}>
            {fmt(amount)}
          </div>
        </Field>
      </div>
      <Field label="申请原因 / 用途">
        <textarea value={reason} onChange={(e) => setReason(e.target.value)}
          className="w-full min-h-[92px] rounded-lg px-3 py-2 text-sm outline-none resize-none"
          style={{ background: A.white, color: A.label, border: `0.5px solid ${A.gray4}` }} />
      </Field>
    </Modal>
  );
}

export default function PurchaseRequestsPage({
  intent,
  focus,
  onOpenRfq,
  onNavigate,
  onActiveContextChange,
}: {
  intent: PurchaseIntent | null;
  focus?: { entityType: string; entityId: string; at: number } | null;
  onOpenRfq?: () => void;
  onNavigate?: (moduleId: string) => void;
  onActiveContextChange?: (context: ActiveContext | null) => void;
}) {
  if (true) return <CanonicalProcurementPanel onNavigate={onNavigate} focus={focus} />;
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<PurchaseRequestWorkbenchFilters>(() => {
    const params = new URLSearchParams(window.location.search);
    return Object.fromEntries(Object.entries(defaultPurchaseRequestWorkbenchFilters).map(([key, fallback]) => [key, params.get(key) || fallback])) as PurchaseRequestWorkbenchFilters;
  });
  const [selectedId, setSelectedId] = useState("");
  const [viewMode, setViewMode] = useState<PurchaseRequestViewMode>("list");
  const [supplierRecommendationResult, setSupplierRecommendationResult] = useState<SupplierRecommendationResult | null>(null);
  const [moreFilters, setMoreFilters] = useState(false);

  useEffect(() => {
    let alive = true;
    apiJson<PurchaseRequest[]>("/api/purchase-requests")
      .then((data) => {
        if (!alive) return;
        setRequests(data);
        setSelectedId((current) => {
          if (intent?.selectedPr && data.some((item) => item.pr === intent.selectedPr)) return intent.selectedPr;
          if (intent?.sourceSku) {
            const bySku = data.find((item) => item.sourceSku === intent.sourceSku && !["已转PO", "已驳回", "已取消"].includes(item.status));
            if (bySku) return bySku.pr;
          }
          return data.some((item) => item.pr === current) ? current : data[0]?.pr ?? "";
        });
      })
      .catch(() => toast.error("采购申请服务暂不可用", { description: "请检查服务连接状态" }))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [intent?.createdAt]);

  useEffect(() => {
    if (focus?.entityType !== "purchase_request" || !focus.entityId) return;
    if (!requests.some((item) => item.pr === focus.entityId)) return;
    setSelectedId(focus.entityId);
    setViewMode("detail");
  }, [focus?.at, focus?.entityType, focus?.entityId, requests]);

  const filtered = filterPurchaseRequestsForWorkbench(requests, filters);
  const sourceOptions = Array.from(new Set(requests.map((item) => item.source || "manual"))).sort();
  const statusOptions = ["全部", "草稿", "待审批", "已批准", "已驳回", "已转PO", "已取消"] as const;
  const priorityOptions = ["全部", "高", "中", "低"] as const;
  const selected = requests.find((item) => item.pr === selectedId) ?? filtered[0] ?? requests[0];
  const pending = requests.filter((item) => item.status === "待审批").length;
  const approved = requests.filter((item) => item.status === "已批准").length;
  const converted = requests.filter((item) => item.status === "已转PO").length;
  const amount = requests.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const exportCsv = () => {
    if (filtered.length === 0) {
      toast.warning("暂无可导出的数据");
      return;
    }
    exportRowsToCsv("procurement-purchase-requests-export.csv", filtered.map((item) => ({
      PR编号: item.pr,
      来源: item.source,
      来源SKU: item.sourceSku,
      来源名称: item.sourceName,
      供应商: item.supplier,
      申请人: item.requester,
      采购员: item.buyer,
      数量: item.quantity,
      单位: item.unit,
      单价: item.unitPrice,
      金额: item.amount,
      需求日期: item.requiredDate,
      优先级: item.priority,
      状态: item.status,
      申请原因: item.reason,
    })));
    toast.success("导出文件已生成");
  };

  useEffect(() => {
    if (!selected?.sourceSku) {
      setSupplierRecommendationResult(null);
      return;
    }
    let alive = true;
    const params = new URLSearchParams({
      sku: selected.sourceSku,
      quantity: String(Number(selected.quantity || 0)),
      supplier: selected.supplier || "",
    });
    apiJson<SupplierRecommendationResult>(`/api/supplier-recommendations?${params.toString()}`)
      .then((data) => { if (alive) setSupplierRecommendationResult(data); })
      .catch(() => { if (alive) setSupplierRecommendationResult(null); });
    return () => { alive = false; };
  }, [selected?.pr, selected?.sourceSku, selected?.quantity, selected?.supplier]);

  useEffect(() => {
    if (viewMode !== "detail" || !selected) {
      onActiveContextChange?.(null);
      return;
    }
    onActiveContextChange?.({
      module: "procurement",
      entityType: "purchase_request",
      entityId: selected.pr,
      entityLabel: selected.sourceName ? `${selected.pr} · ${selected.sourceName}` : selected.pr,
      view: "requests",
    });
    return () => onActiveContextChange?.(null);
  }, [viewMode, selected?.pr, selected?.sourceName, onActiveContextChange]);

  function updateFilter<K extends keyof PurchaseRequestWorkbenchFilters>(key: K, value: PurchaseRequestWorkbenchFilters[K]) {
    const updated = { ...filters, [key]: value };
    setFilters(updated);
    const next = new URLSearchParams();
    Object.entries(updated).forEach(([filterKey, filterValue]) => { if (filterValue !== defaultPurchaseRequestWorkbenchFilters[filterKey as keyof PurchaseRequestWorkbenchFilters]) next.set(filterKey, String(filterValue)); });
    setSearchParams(next, { replace: true });
  }

  function resetFilters() {
    setFilters(defaultPurchaseRequestWorkbenchFilters);
    setSearchParams({}, { replace: true });
  }

  function openDetail(pr: string) {
    navigate(`/app/procurement/requests/${encodeURIComponent(pr)}?returnTo=${encodeURIComponent(`/app/procurement/requests${window.location.search}`)}&returnLabel=${encodeURIComponent("所有采购申请")}`);
  }

  function returnToList() {
    setViewMode("list");
  }

  const selectedPrLines = selected ? buildPrLines(selected) : [];
  const selectedLinkedPo = selected ? linkedPoForPr(selected) : "";
  const selectedLinkedRfq = selected ? linkedRfqForPr(selected) : "";

  const detailContent = selected && (
    <DocumentShell
      title="采购申请"
      documentNo={selected.pr}
      moduleLabel="采购申请 / PR"
      status={selected.status}
      subtitle={`${selected.requester} → ${selected.buyer} · ${selected.sourceSku || "—"}`}
    >
      <DocumentHeader
        fields={[
          { label: "PR编号", value: selected.pr },
          { label: "申请人", value: selected.requester },
          { label: "采购负责人", value: selected.buyer },
          { label: "需求日期", value: selected.requiredDate },
          { label: "优先级", value: selected.priority, tone: selected.priority === "高" ? "danger" : selected.priority === "中" ? "warning" : "success" },
          { label: "状态", value: displayPrStatus(selected.status), tone: statusTone(selected.status) },
          { label: "供应商", value: selected.supplier || "—" },
          { label: "来源", value: purchaseRequestSourceMeta(selected.source).label },
          { label: "来源 SKU", value: selected.sourceSku || "—", helper: selected.sourceName },
          { label: "数量", value: `${Number(selected.quantity || 0).toLocaleString()} ${selected.unit}` },
          { label: "单价", value: fmt(selected.unitPrice || 0) },
          { label: "金额", value: fmt(selected.amount || 0), tone: "info" },
        ]}
      />
      <DetailSection title="概览" right={<Chip label="业务对象详情" color={A.blue} bg="#f0f6ff" />}>
        <DetailFieldGrid fields={[
          { label: "PR 编号", value: selected.pr, tone: "info" },
          { label: "状态", value: displayPrStatus(selected.status), tone: selected.status === "待审批" ? "warning" : "good" },
          { label: "申请人", value: selected.requester },
          { label: "申请部门", value: requesterDepartment(selected.requester) },
          { label: "提交日期", value: selected.created },
          { label: "需求日期", value: selected.requiredDate, tone: selected.priority === "高" ? "warning" : "default" },
          { label: "优先级", value: selected.priority, tone: selected.priority === "高" ? "danger" : "default" },
          { label: "申请原因", value: selected.reason },
          { label: "目标仓库", value: selectedPrLines[0]?.warehouse },
          { label: "预估金额", value: fmt(selected.amount || 0), tone: "info" },
          { label: "来源", value: purchaseRequestSourceMeta(selected.source).label },
          { label: "当前负责人", value: selected.buyer },
          { label: "下一步", value: nextStepForPr(selected), tone: "info" },
        ]} />
      </DetailSection>
      <DocumentStatusTimeline steps={prTimeline(selected)} />
      <DocumentLinesTable
        rows={[{
          id: selected.pr,
          sku: selected.sourceSku || "—",
          name: selected.sourceName || "采购申请物料",
          quantity: selected.quantity,
          unit: selected.unit,
          unitPrice: selected.unitPrice,
          amount: selected.amount,
          supplier: selected.supplier,
          reason: selected.reason,
        }]}
        columns={[
          { key: "sku", label: "SKU", render: (line) => <span style={{ color: A.blue }}>{String(line.sku)}</span> },
          { key: "name", label: "品名" },
          { key: "quantity", label: "数量", align: "right", render: (line) => Number(line.quantity || 0).toLocaleString() },
          { key: "unit", label: "单位" },
          { key: "unitPrice", label: "单价", align: "right", render: (line) => fmt(Number(line.unitPrice || 0)) },
          { key: "amount", label: "金额", align: "right", render: (line) => fmt(Number(line.amount || 0)) },
          { key: "supplier", label: "建议供应商" },
          { key: "reason", label: "备注" },
        ]}
      />
      <DetailSection title="明细行" right={<Chip label={`${selectedPrLines.length} 行`} color={A.blue} bg="#f0f6ff" />}>
        <div className={tableScrollClass}>
          <table className="w-full min-w-[1180px] text-xs">
            <thead>
              <tr style={{ borderBottom: `1px solid ${A.border}` }}>
                {["PR Line 编号", "SKU / 物料", "物料名称", "数量", "单位", "需求日期", "目标仓库", "推荐供应商", "采购品类", "预估单价", "预估金额", "关联缺口", "关联客户订单", "行状态", "行级风险提示"].map((header) => (
                  <th key={header} className={thClass} style={{ color: A.gray1 }}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selectedPrLines.map((line, index) => (
                <tr key={line.lineId} style={{ borderBottom: index < selectedPrLines.length - 1 ? `1px solid ${A.border}` : "none" }}>
                  <td className={tdIdClass} style={{ color: A.blue }}>{line.lineId}</td>
                  <td className={tdNowrapClass} style={{ color: A.blue }}>{line.sku}</td>
                  <td className={tdNameClass}>{line.itemName}</td>
                  <td className={tdNumericClass}>{line.quantity.toLocaleString()}</td>
                  <td className={tdNowrapClass}>{line.unit}</td>
                  <td className={tdNowrapClass}>{line.needByDate}</td>
                  <td className={tdNowrapClass}>{line.warehouse}</td>
                  <td className={tdNameClass}>{line.supplier}</td>
                  <td className={tdNowrapClass}>{line.category}</td>
                  <td className={tdNumericClass}>{fmt(line.unitPrice)}</td>
                  <td className={tdNumericClass}>{fmt(line.amount)}</td>
                  <td className={tdNameClass}>{line.sourceShortage}</td>
                  <td className={tdNowrapClass}>{line.customerOrder}</td>
                  <td className={tdNowrapClass}><Chip label={line.status} color={line.status.includes("仍待") ? A.orange : A.green} bg={line.status.includes("仍待") ? "#fff8f0" : "#f0faf4"} /></td>
                  <td className={tdNameClass}>{line.risk}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DetailSection>
      <DetailSection title="复核状态 / 复核人">
        <DetailFieldGrid fields={[
          { label: "当前复核人", value: selected.buyer },
          { label: "复核节点", value: selected.status === "待审批" ? "采购负责人复核" : "业务负责人复核" },
          { label: "状态", value: displayPrStatus(selected.status), tone: selected.status === "待审批" ? "warning" : "default" },
          { label: "截止时间 / age", value: selected.requiredDate },
          { label: "复核备注", value: selected.approvalSnapshot?.summary || "需人工复核需求、供应商和预算口径" },
          { label: "拒绝 / 要求修改 / 取消原因", value: selected.status === "已驳回" ? selected.reason : "暂无" },
        ]} columns={3} />
      </DetailSection>
      <DocumentTotals
        totals={[
          { label: "申请数量", value: `${Number(selected.quantity || 0).toLocaleString()} ${selected.unit}` },
          { label: "申请金额", value: fmt(selected.amount || 0), tone: "info" },
          { label: "推荐单价", value: fmt(selected.unitPrice || 0) },
          { label: "后续 PO", value: selected.linkedPo || purchaseOrders.find((order) => order.sourceRequest === selected.pr)?.po || "—" },
        ]}
      />
      <DocumentEvidencePanel
        linkedDocuments={[
          ...(selected.linkedPo ? [{ label: "PO / 采购订单", value: selected.linkedPo, moduleId: "procurement:orders", tone: "success" as const }] : []),
          ...purchaseOrders.filter((order) => order.sourceRequest === selected.pr).slice(0, 2).map((order) => ({ label: "PO / 采购订单", value: order.po, moduleId: "procurement:orders", tone: statusTone(order.status) })),
          ...(selected.source === "forecast" || selected.source === "mrp-release" ? [{ label: "预测与 MRP", value: selected.source, moduleId: "forecast", tone: "info" as const }] : []),
          ...(selected.source === "inventory" ? [{ label: "库存补货证据", value: selected.sourceSku || selected.source, moduleId: "inventory", tone: "warning" as const }] : []),
        ]}
        onNavigate={onNavigate}
        provenance={selected.approvalSnapshot?.source || selected.source}
        notes={selected.reason || selected.approvalSnapshot?.summary}
        evidence={[
          { label: "来源", value: purchaseRequestSourceMeta(selected.source).label },
          { label: "审批快照", value: selected.approvalSnapshot?.createdAt ? new Date(selected.approvalSnapshot.createdAt).toLocaleString("zh-CN") : "—" },
          { label: "推荐供应商", value: supplierRecommendationResult?.primary?.supplier || selected.supplier || "—" },
          { label: "推荐评分", value: supplierRecommendationResult?.primary?.score || "—" },
          { label: "RFQ / 计划证据", value: supplierRecommendationResult?.needsRfq ? "建议 RFQ" : selected.forecastBasis ? "已有计划证据" : "可直接采购", tone: supplierRecommendationResult?.needsRfq ? "warning" : "success" },
          { label: "状态", value: selected.status, tone: statusTone(selected.status) },
        ]}
      />
      <DocumentHistoryPanel
        entityType="purchaseRequest"
        entityId={selected.pr}
        title="历史记录"
        refreshKey={selected.lastAuditId || selected.auditTrailIds?.join(",") || selected.status}
      />
      <DetailSection title="关联单据">
        <DetailFieldGrid fields={[
          { label: "关联 RFQ", value: selectedLinkedRfq, tone: "info" },
          { label: "关联 PO", value: selectedLinkedPo || "尚未创建", tone: selectedLinkedPo ? "good" : "warning" },
          { label: "关联 GRN / Receipt", value: selectedLinkedPo ? "收货记录待复核" : "暂未关联" },
          { label: "关联 Invoice", value: "当前未读取到完整发票记录" },
          { label: "关联 Exception Case", value: selected.priority === "高" ? "需关注交付风险" : "暂无" },
          { label: "关联客户订单", value: "SO-2026-0718" },
          { label: "关联 SKU", value: selected.sourceSku || "待确认", tone: "info" },
        ]} />
      </DetailSection>
      <EvidenceSummaryPanel groups={[
        { label: "证据链", value: `客户订单 / 库存风险 → ${selected.sourceSku || "SKU"} → PR Line → ${selected.pr} → RFQ 草稿 / PO 草稿`, tone: "info" },
        { label: "库存缺口", value: selectedPrLines[0]?.sourceShortage || "需人工复核", tone: "warning" },
        { label: "客户订单风险", value: selectedPrLines[1]?.customerOrder || "待关联", tone: "warning" },
      ]} />
      <DocumentActionBar>
        <RecoveryActions
          actions={[
            { key: "list", label: "返回列表", onClick: returnToList, kind: "list" },
            { key: "request-list", label: "返回采购申请列表", onClick: returnToList, kind: "list", tone: "subtle" },
            { key: "module", label: "返回采购工作台", onClick: () => onNavigate?.("procurement"), kind: "module", tone: "subtle" },
            { key: "source", label: "返回来源对象", onClick: () => onNavigate?.(selected.source === "inventory" ? "inventory" : "sales"), kind: "module", tone: "subtle" },
            { key: "evidence", label: "返回证据链", onClick: () => onNavigate?.("sales:evidence"), kind: "module", tone: "subtle" },
            { key: "back", label: "返回上一级", onClick: returnToList, kind: "list", tone: "subtle" },
          ]}
        />
        <button onClick={() => exportPurchaseRequestDetail(selected)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: A.white, color: A.blue, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)" }}>导出详情</button>
      </DocumentActionBar>
    </DocumentShell>
  );

  if (viewMode === "detail") {
    return (
      <div className="space-y-5">
        {selected ? detailContent : (
          <Card className="p-8 text-center text-xs" style={{ color: A.gray2 }}>
            未找到采购申请。
            <button onClick={returnToList} className="ml-3 px-3 py-1.5 rounded-lg font-medium" style={{ background: A.gray6, color: A.blue }}>返回列表</button>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <CanonicalProcurementPanel onNavigate={onNavigate} />
      {intent?.sourceSku && (
        <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-3"
          style={{ background: "#f0f6ff", border: `0.5px solid ${A.blue}30` }}>
          <div className="flex items-center gap-2 min-w-0">
            <ClipboardCheck size={14} style={{ color: A.blue }} />
            <div className="text-xs" style={{ color: A.label }}>
              已从首页补货动作定位到 <span className="font-semibold tabular-nums">{intent.sourceSku}</span>
              {selected ? ` · ${selected.pr}` : ""}
            </div>
          </div>
          <button onClick={resetFilters}
            className="text-[11px] px-2.5 py-1 rounded-md font-medium"
            style={{ background: A.white, color: A.blue, boxShadow: "0 0 0 0.5px rgba(0,113,227,0.18)" }}>
            查看全部
          </button>
        </div>
      )}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="采购申请金额" value={fmt(amount)} sub={loading ? "加载中" : `${requests.length} 张申请`} icon={ClipboardCheck} color={A.blue} />
        <KpiCard label="待审批 PR" value={String(pending)} sub="预测/库存/手工申请" positive={pending === 0} icon={AlertCircle} color={A.orange} />
        <KpiCard label="已批准" value={String(approved)} sub="等待转 PO" positive icon={CheckCircle2} color={A.green} />
        <KpiCard label="已转 PO" value={String(converted)} sub="进入采购执行" positive icon={FileText} color={A.purple} />
      </div>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <SectionHeader title="采购申请查询" />
            <div className="text-xs mt-1" style={{ color: A.sub }}>按 PR、供应商、物料、申请人、采购负责人和需求日期查询申请记录</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setMoreFilters((value) => !value)} className="h-8 px-3 rounded-lg text-xs font-medium" style={{ background: A.gray6, color: A.blue }}>更多筛选</button>
            <button onClick={resetFilters} className="h-8 px-3 rounded-lg text-xs font-medium" style={{ background: A.gray6, color: A.label }}>重置</button>
            <button onClick={exportCsv} className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5" style={{ background: "#f0f6ff", color: A.blue }}><FileSpreadsheet size={13} /> 导出当前结果</button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="搜索 PR / SKU / 品名"><input value={filters.query} onChange={(event) => updateFilter("query", event.target.value)} placeholder="PR、SKU 或品名" style={inputStyle} /></Field>
          <Field label="状态"><select aria-label="状态" value={filters.status} onChange={(event) => updateFilter("status", event.target.value as PurchaseRequestWorkbenchFilters["status"])} style={inputStyle}>{statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select></Field>
          <Field label="优先级"><select aria-label="优先级" value={filters.priority} onChange={(event) => updateFilter("priority", event.target.value as PurchaseRequestWorkbenchFilters["priority"])} style={inputStyle}>{priorityOptions.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></Field>
          <Field label="需求日期"><input type="date" value={filters.requiredTo} onChange={(event) => updateFilter("requiredTo", event.target.value)} style={inputStyle} /></Field>
        </div>
        {moreFilters && <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Field label="申请人"><input value={filters.requester} onChange={(event) => updateFilter("requester", event.target.value)} style={inputStyle} /></Field>
          <Field label="采购负责人"><input value={filters.buyer} onChange={(event) => updateFilter("buyer", event.target.value)} style={inputStyle} /></Field>
          <Field label="供应商"><input value={filters.supplier} onChange={(event) => updateFilter("supplier", event.target.value)} style={inputStyle} /></Field>
          <Field label="来源"><select value={filters.source} onChange={(event) => updateFilter("source", event.target.value)} style={inputStyle}><option value="全部">全部</option>{sourceOptions.map((source) => <option key={source} value={source}>{purchaseRequestSourceMeta(source).label}</option>)}</select></Field>
          <Field label="需求日期起"><input type="date" value={filters.requiredFrom} onChange={(event) => updateFilter("requiredFrom", event.target.value)} style={inputStyle} /></Field>
          <Field label="需求日期止"><input type="date" value={filters.requiredTo} onChange={(event) => updateFilter("requiredTo", event.target.value)} style={inputStyle} /></Field>
        </div>}
      </Card>

      <Card>
        <div className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}>
          <div>
            <div className="text-sm font-semibold" style={{ color: A.label }}>采购申请列表</div>
            <div className="text-[11px] mt-0.5" style={{ color: A.sub }}>共 {requests.length} 条，当前筛选 {filtered.length} 条</div>
          </div>
          <span className="text-xs ml-auto flex items-center gap-1.5" style={{ color: A.gray2 }}><Filter size={13} /> 当前结果</span>
          <ContextualImportActions entityLabel="采购申请" templateName="采购申请" compact={false} />
        </div>
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-xs" style={{ color: A.gray2 }}>暂无采购申请。可在预测分析中生成预测补货申请。</div>
        ) : (
          <div className={tableScrollClass}>
            <table className={tableMinLgClass}>
              <thead>
                <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                  {["PR / 物料", "申请信息", "需求日期", "状态", "优先级", "预估金额", "后续进度", "操作"].map((h) => (
                    <th key={h} className={thClass} style={{ color: A.gray1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => {
                  return (
                    <tr key={item.pr} className="h-16 hover:bg-blue-50/40 transition-colors" style={{ borderBottom: idx < filtered.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                      <td className={tdIdClass}><BusinessEntityLink entityType="purchase_request" entityId={item.pr} className={tableLinkClass}>{item.pr}</BusinessEntityLink><div className="mt-1 text-[11px] font-normal" style={{color:A.sub}}>{item.sourceSku || "—"} · {item.sourceName || "未命名物料"}</div></td>
                      <td className={tdNameClass}>{item.requester}<div className="mt-1 text-[11px]" style={{color:A.sub}}>{requesterDepartment(item.requester)} · {item.buyer || "待分配"}</div></td>
                      <td className={tdNowrapClass} style={{ color: A.sub }}>{item.requiredDate}</td>
                      <td className={tdNowrapClass}><PRStatusPill status={item.status} /></td>
                      <td className={tdNowrapClass} style={{ color: item.priority === "高" ? A.red : item.priority === "中" ? A.orange : A.green }}>{item.priority}</td>
                      <td className={`${tdNumericClass} font-semibold`} style={{ color: A.label }}>{fmt(item.amount)}</td>
                      <td className={tdNameClass} style={{ color: A.sub }}><div>RFQ：{linkedRfqForPr(item) || "未创建"}</div><div>PO：{linkedPoForPr(item) || "未创建"}</div><div style={{color:A.blue}}>下一步：{nextStepForPr(item)}</div></td>
                      <td className={tdActionClass}>
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openDetail(item.pr)} className="px-2 py-1 text-[11px] font-medium rounded-md" style={{ background: "#f0f6ff", color: A.blue }}>查看</button>
                          <WorkbenchMoreMenu><button onClick={() => openDetail(item.pr)} className="w-full rounded px-2 py-1.5 text-left text-[11px] hover:bg-slate-50">查看明细</button>{item.source && <button onClick={() => openDetail(item.pr)} className="w-full rounded px-2 py-1.5 text-left text-[11px] hover:bg-slate-50">查看来源需求</button>}{linkedRfqForPr(item) && <button onClick={() => openDetail(item.pr)} className="w-full rounded px-2 py-1.5 text-left text-[11px] hover:bg-slate-50">查看关联 RFQ</button>}{linkedPoForPr(item) && <button onClick={() => openDetail(item.pr)} className="w-full rounded px-2 py-1.5 text-left text-[11px] hover:bg-slate-50">查看关联 PO</button>}</WorkbenchMoreMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
