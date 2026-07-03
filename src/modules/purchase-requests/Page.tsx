import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Activity, AlertCircle, CheckCircle2, ClipboardCheck, FileCheck2, FileSpreadsheet, FileText, Filter, GitBranch,
  Loader2, Package, Plus, Send, Sparkles, XCircle, ShieldCheck,
} from "lucide-react";
import { apiJson } from "../../lib/api-client";
import { exportRowsToCsv } from "../../lib/data-export";
import { fmt } from "../../lib/format";
import { OWNERS, SKU_CATALOG, SUPPLIER_LIST, purchaseOrders } from "../../data/demo-data";
import type { PurchaseIntent, PurchaseOrder, PurchaseRequest, PurchaseRequestStatus, RfqRecord, SupplierRecommendationResult } from "../../types/scm";
import { A, Card, DocumentHistoryPanel, Field, inputStyle, KpiCard, Modal, RecoveryActions, SectionHeader } from "../../components/ui";
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
import type { ActiveContext } from "../ai-assistant/Panel";
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
  const map: Record<PurchaseRequestStatus, { color: string; bg: string }> = {
    草稿: { color: A.gray1, bg: A.gray6 },
    待审批: { color: A.orange, bg: "#fff8f0" },
    已批准: { color: A.blue, bg: "#f0f6ff" },
    已驳回: { color: A.red, bg: "#fff1f0" },
    已转PO: { color: A.green, bg: "#f0faf4" },
    已取消: { color: A.gray1, bg: A.gray6 },
  };
  const displayStatus = status || "未知";
  const m = map[displayStatus as PurchaseRequestStatus] ?? { color: A.gray1, bg: A.gray6 };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ color: m.color, background: m.bg }}>{displayStatus}</span>
  );
}

function purchaseRequestSourceMeta(source: string) {
  if (source === "forecast") return { label: "预测", icon: Sparkles, color: A.blue, bg: "#f0f6ff" };
  if (source === "inventory") return { label: "库存补货", icon: Package, color: A.orange, bg: "#fff8f0" };
  if (source === "mrp-release") return { label: "MRP释放", icon: GitBranch, color: A.purple, bg: "#f5f0ff" };
  return { label: "手工", icon: FileText, color: A.gray1, bg: A.gray6 };
}

function NewPRModal({ open, onClose, onCreate }: {
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
      const created = await onCreate({
        source: "manual",
        sourceSku: item.sku,
        sourceName: item.name,
        supplier,
        requester,
        buyer,
        requiredDate,
        quantity,
        unit: "件",
        unitPrice: item.price,
        amount,
        priority,
        status: asDraft ? "草稿" : "待审批",
        reason,
        approvalSnapshot: {
          source: "manual",
          summary: `${item.sku} ${item.name} · ${quantity.toLocaleString()} 件 · ${fmt(amount)}`,
          explanation: `Requester ${requester} 手工提交采购申请：${reason}`,
          supplier: { name: supplier, buyer, unitPrice: item.price, amount },
          createdAt: new Date().toISOString(),
        },
      });
      reset();
      onClose();
      toast.success(asDraft ? `${created.pr} 已保存草稿` : `${created.pr} 已提交审批`, {
        description: `${item.name} · ${quantity.toLocaleString()} 件 · ${fmt(amount)}`,
      });
    } catch (error) {
      toast.error("采购申请提交失败", { description: error instanceof Error ? error.message : "请检查服务连接状态" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} width={720}
      title="新建采购申请" subtitle="Requester 填写需求，审批通过后再转采购订单"
      footer={
        <>
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ background: A.white, color: A.label, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.1)" }}>取消</button>
          <button onClick={() => submit(true)} disabled={submitting}
            className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ background: A.gray5, color: A.label }}>存为草稿</button>
          <button onClick={() => submit(false)} disabled={submitting}
            className="text-xs px-3 py-1.5 rounded-lg font-medium text-white flex items-center gap-1.5"
            style={{ background: A.blue, opacity: submitting ? 0.6 : 1 }}>
            {submitting ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
            提交审批
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
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<PurchaseRequestWorkbenchFilters>(defaultPurchaseRequestWorkbenchFilters);
  const [selectedId, setSelectedId] = useState("");
  const [viewMode, setViewMode] = useState<PurchaseRequestViewMode>("list");
  const [supplierRecommendationResult, setSupplierRecommendationResult] = useState<SupplierRecommendationResult | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [creatingRfq, setCreatingRfq] = useState(false);

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

  async function updateRequestStatus(pr: string, status: PurchaseRequestStatus) {
    const updated = await apiJson<PurchaseRequest>(`/api/purchase-requests/${encodeURIComponent(pr)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    setRequests((arr) => arr.map((item) => item.pr === pr ? updated : item));
    return updated;
  }

  async function approveRequest(pr: string) {
    try {
      await updateRequestStatus(pr, "已批准");
      toast.success(`${pr} 已批准`, { description: "已完成审批，可转为采购订单继续执行" });
    } catch (error) {
      toast.error("采购申请审批失败", { description: error instanceof Error ? error.message : "请检查服务连接状态" });
    }
  }

  async function rejectRequest(pr: string) {
    try {
      await updateRequestStatus(pr, "已驳回");
      toast.error(`${pr} 已驳回`, { description: "状态已更新" });
    } catch (error) {
      toast.error("采购申请驳回失败", { description: error instanceof Error ? error.message : "请检查服务连接状态" });
    }
  }

  async function convertRequest(pr: string) {
    try {
      const result = await apiJson<{ request: PurchaseRequest; po: PurchaseOrder }>(`/api/purchase-requests/${encodeURIComponent(pr)}/convert-to-po`, {
        method: "POST",
      });
      setRequests((arr) => arr.map((item) => item.pr === pr ? result.request : item));
      toast.success(`${pr} 已转为 ${result.po.po}`, { description: "采购订单已进入待审批队列" });
    } catch (error) {
      toast.error("采购申请转 PO 失败", { description: error instanceof Error ? error.message : "请先批准申请，再转采购订单" });
    }
  }

  async function createManualRequest(payload: Partial<PurchaseRequest>) {
    const created = await apiJson<PurchaseRequest>("/api/purchase-requests", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setRequests((arr) => [created, ...arr]);
    setSelectedId(created.pr);
    setFilters(defaultPurchaseRequestWorkbenchFilters);
    return created;
  }

  function updateFilter<K extends keyof PurchaseRequestWorkbenchFilters>(key: K, value: PurchaseRequestWorkbenchFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setFilters(defaultPurchaseRequestWorkbenchFilters);
  }

  function openDetail(pr: string) {
    setSelectedId(pr);
    setViewMode("detail");
  }

  function returnToList() {
    setViewMode("list");
  }

  async function createRfqFromSelected() {
    if (!selected) return;
    const candidates = supplierRecommendationResult?.candidates || [];
    const invitedSuppliers = Array.from(new Set([
      supplierRecommendationResult?.primary?.supplier,
      supplierRecommendationResult?.backup?.supplier,
      selected.supplier,
      ...candidates.map((item) => item.supplier),
    ].filter(Boolean) as string[]));
    setCreatingRfq(true);
    try {
      const result = await apiJson<{ ok: boolean; record?: { id: string; status: string } }>("/api/procurement/rfq-drafts/from-pr", {
        method: "POST",
        body: JSON.stringify({
          pr: {
            id: selected.pr,
            sku: selected.sourceSku,
            itemName: selected.sourceName,
            quantity: selected.quantity,
            requiredDate: selected.requiredDate,
            warehouse: selected.forecastBasis?.plannedReleasePeriod || "",
            costCenter: "",
            reason: selected.reason,
          },
          prId: selected.pr,
          confirm: true,
          actor: "current_user",
          responseDeadline: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString().slice(0, 10),
          candidateSuppliers: invitedSuppliers,
          evaluationCriteria: ["total_cost", "lead_time", "supplier_risk", "data_completeness"],
        }),
      });
      toast.success(`${result.record?.id || "RFQ 草稿"} 已创建为内部草稿`, { description: "未外发 RFQ、未邀请供应商、未授标、未创建 PO" });
      onOpenRfq?.();
    } catch (error) {
      toast.error("RFQ 草稿创建失败", { description: error instanceof Error ? error.message : "请检查服务连接状态" });
    } finally {
      setCreatingRfq(false);
    }
  }

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
          { label: "状态", value: selected.status, tone: statusTone(selected.status) },
          { label: "供应商", value: selected.supplier || "—" },
          { label: "来源", value: purchaseRequestSourceMeta(selected.source).label },
          { label: "来源 SKU", value: selected.sourceSku || "—", helper: selected.sourceName },
          { label: "数量", value: `${Number(selected.quantity || 0).toLocaleString()} ${selected.unit}` },
          { label: "单价", value: fmt(selected.unitPrice || 0) },
          { label: "金额", value: fmt(selected.amount || 0), tone: "info" },
        ]}
      />
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
        title="审批历史"
        refreshKey={selected.lastAuditId || selected.auditTrailIds?.join(",") || selected.status}
      />
      <Card className="p-4" style={{ background: "#f8fbff", border: "0.5px solid rgba(0,113,227,0.14)" }}>
        <div className="text-xs font-semibold mb-2" style={{ color: A.label }}>PR → RFQ → Supplier Response → Award Recommendation → PO Draft</div>
        <div className="grid grid-cols-5 gap-2 text-[11px]">
          {[
            ["PR", selected.pr, selected.status],
            ["RFQ 草稿", selected.linkedPo ? "已转后续单据" : "可创建内部草稿", "先复核后确认"],
            ["Supplier Response", "内部录入", "no external portal"],
            ["Award Recommendation", "仅预览推荐", "does not award"],
            ["PO Draft", "仅草稿", "not issued"],
          ].map(([label, value, helper]) => (
            <div key={label} className="rounded-lg p-2" style={{ background: A.white, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.06)" }}>
              <div className="font-semibold" style={{ color: A.label }}>{label}</div>
              <div className="mt-1 tabular-nums" style={{ color: A.blue }}>{value}</div>
              <div className="mt-0.5" style={{ color: A.gray2 }}>{helper}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-[11px]" style={{ color: A.sub }}>
          Safe boundary: no external RFQ send, no supplier award, no PO issue, no approval, no payment/posting, no inventory mutation.
        </div>
      </Card>
      <DocumentActionBar>
        <RecoveryActions
          actions={[
            { key: "list", label: "返回列表", onClick: returnToList, kind: "list" },
            { key: "module", label: "返回采购工作台", onClick: () => onNavigate?.("procurement"), kind: "module", tone: "subtle" },
          ]}
        />
        {selected.status === "待审批" && <button onClick={() => approveRequest(selected.pr)} className="text-xs px-3 py-1.5 rounded-lg font-medium text-white" style={{ background: A.blue }}>批准申请</button>}
        {selected.status === "待审批" && <button onClick={() => rejectRequest(selected.pr)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "#fff1f0", color: A.red }}>驳回</button>}
        {selected.status === "已批准" && <button onClick={() => convertRequest(selected.pr)} className="text-xs px-3 py-1.5 rounded-lg font-medium text-white" style={{ background: A.green }}>转采购订单</button>}
        <button onClick={createRfqFromSelected} disabled={creatingRfq} className="text-xs px-3 py-1.5 rounded-lg font-medium text-white disabled:opacity-60" style={{ background: supplierRecommendationResult?.needsRfq ? A.orange : A.blue }}>创建 RFQ 草稿</button>
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
        <NewPRModal open={newOpen} onClose={() => setNewOpen(false)} onCreate={createManualRequest} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
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
            <button onClick={() => toast.success(`已筛选 ${filtered.length} 条采购申请`)} className="h-8 px-3 rounded-lg text-xs font-medium text-white" style={{ background: A.blue }}>查询</button>
            <button onClick={resetFilters} className="h-8 px-3 rounded-lg text-xs font-medium" style={{ background: A.gray6, color: A.label }}>重置</button>
            <button onClick={exportCsv} className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5" style={{ background: "#f0f6ff", color: A.blue }}><FileSpreadsheet size={13} /> 导出当前结果</button>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-3">
          <Field label="PR 编号"><input value={filters.prNumber} onChange={(event) => updateFilter("prNumber", event.target.value)} placeholder="PR-2026" style={inputStyle} /></Field>
          <Field label="供应商"><input value={filters.supplier} onChange={(event) => updateFilter("supplier", event.target.value)} placeholder="供应商名称" style={inputStyle} /></Field>
          <Field label="物料 / SKU"><input value={filters.skuOrItem} onChange={(event) => updateFilter("skuOrItem", event.target.value)} placeholder="SKU 或品名" style={inputStyle} /></Field>
          <Field label="申请人"><input value={filters.requester} onChange={(event) => updateFilter("requester", event.target.value)} placeholder="Requester" style={inputStyle} /></Field>
          <Field label="采购负责人"><input value={filters.buyer} onChange={(event) => updateFilter("buyer", event.target.value)} placeholder="Buyer" style={inputStyle} /></Field>
          <Field label="状态"><select value={filters.status} onChange={(event) => updateFilter("status", event.target.value as PurchaseRequestWorkbenchFilters["status"])} style={inputStyle}>{statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select></Field>
          <Field label="优先级"><select value={filters.priority} onChange={(event) => updateFilter("priority", event.target.value as PurchaseRequestWorkbenchFilters["priority"])} style={inputStyle}>{priorityOptions.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></Field>
          <Field label="来源"><select value={filters.source} onChange={(event) => updateFilter("source", event.target.value)} style={inputStyle}><option value="全部">全部</option>{sourceOptions.map((source) => <option key={source} value={source}>{purchaseRequestSourceMeta(source).label}</option>)}</select></Field>
          <Field label="需求起始"><input value={filters.requiredFrom} onChange={(event) => updateFilter("requiredFrom", event.target.value)} placeholder="2026-06-01" style={inputStyle} /></Field>
          <Field label="需求结束"><input value={filters.requiredTo} onChange={(event) => updateFilter("requiredTo", event.target.value)} placeholder="2026-06-30" style={inputStyle} /></Field>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}>
          <div>
            <div className="text-sm font-semibold" style={{ color: A.label }}>采购申请列表</div>
            <div className="text-[11px] mt-0.5" style={{ color: A.sub }}>共 {requests.length} 条，当前筛选 {filtered.length} 条</div>
          </div>
          <span className="text-xs ml-auto flex items-center gap-1.5" style={{ color: A.gray2 }}><Filter size={13} /> 当前结果</span>
          <ContextualImportActions entityLabel="PR" compact />
          <button onClick={() => setNewOpen(true)} className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md font-medium text-white hover:opacity-90 transition-opacity" style={{ background: A.blue }}><Plus size={11} /> 新建 PR</button>
        </div>
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-xs" style={{ color: A.gray2 }}>暂无采购申请。可在预测分析中生成预测补货申请。</div>
        ) : (
          <div className={tableScrollClass}>
            <table className={tableMinLgClass}>
              <thead>
                <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                  {["PR 编号", "来源", "物料", "供应商", "申请 / 采购", "需求日期", "数量", "金额", "优先级", "状态", "操作"].map((h) => (
                    <th key={h} className={thClass} style={{ color: A.gray1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => {
                  const sourceMeta = purchaseRequestSourceMeta(item.source);
                  const SourceIcon = sourceMeta.icon;
                  return (
                    <tr key={item.pr} className="hover:bg-blue-50/40 transition-colors" style={{ borderBottom: idx < filtered.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                      <td className={tdIdClass}><button onClick={() => openDetail(item.pr)} className={tableLinkClass} style={{ color: A.blue }}>{item.pr}</button></td>
                      <td className={tdNowrapClass}><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: sourceMeta.bg, color: sourceMeta.color }}><SourceIcon size={10} />{sourceMeta.label}</span></td>
                      <td className={`${tdNameClass} max-w-[240px]`}><div className="font-medium truncate" style={{ color: A.label }}>{item.sourceSku || "—"}</div><div className="text-[10px] mt-0.5 truncate" style={{ color: A.gray2 }}>{item.sourceName}</div></td>
                      <td className={`${tdNameClass} max-w-[180px] truncate`} style={{ color: A.label }}>{item.supplier}</td>
                      <td className={tdNowrapClass} style={{ color: A.sub }}>{item.requester} / {item.buyer}</td>
                      <td className={tdNowrapClass} style={{ color: A.sub }}>{item.requiredDate}</td>
                      <td className={tdNumericClass} style={{ color: A.sub }}>{Number(item.quantity || 0).toLocaleString()} {item.unit}</td>
                      <td className={`${tdNumericClass} font-semibold`} style={{ color: A.label }}>{fmt(item.amount)}</td>
                      <td className={tdNowrapClass} style={{ color: item.priority === "高" ? A.red : item.priority === "中" ? A.orange : A.green }}>{item.priority}</td>
                      <td className={tdNowrapClass}><PRStatusPill status={item.status} /></td>
                      <td className={tdActionClass}><button onClick={() => openDetail(item.pr)} className="px-2 py-1 text-[11px] font-medium rounded-md" style={{ background: "#f0f6ff", color: A.blue }}>查看详情</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <NewPRModal open={newOpen} onClose={() => setNewOpen(false)} onCreate={createManualRequest} />
    </div>
  );
}
