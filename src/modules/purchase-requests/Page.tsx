import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Activity, AlertCircle, CheckCircle2, ClipboardCheck, FileCheck2, FileSpreadsheet, FileText, Filter, GitBranch,
  Loader2, Package, Plus, Send, Sparkles, XCircle, ShieldCheck,
} from "lucide-react";
import { apiJson } from "../../lib/api-client";
import { exportRowsToCsv } from "../../lib/data-export";
import { fmt } from "../../lib/format";
import { OWNERS, SKU_CATALOG, SUPPLIER_LIST } from "../../data/demo-data";
import type { PurchaseIntent, PurchaseOrder, PurchaseRequest, PurchaseRequestStatus, RfqRecord, SupplierRecommendationResult } from "../../types/scm";
import { A, Card, DocumentHistoryPanel, Field, inputStyle, KpiCard, Modal, SegmentedControl } from "../../components/ui";

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
      toast.error("采购申请提交失败", { description: error instanceof Error ? error.message : "请确认 API 服务正在运行" });
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

export default function PurchaseRequestsPage({ intent, onOpenRfq }: { intent: PurchaseIntent | null; onOpenRfq?: () => void }) {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"全部" | PurchaseRequestStatus>("全部");
  const [selectedId, setSelectedId] = useState("");
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
      .catch(() => toast.error("采购申请 API 未连接", { description: "请确认 API 服务正在运行" }))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [intent?.createdAt]);

  const filtered = filter === "全部" ? requests : requests.filter((item) => item.status === filter);
  const selected = requests.find((item) => item.pr === selectedId) ?? requests[0];
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
    toast.success("CSV 已导出");
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
      toast.success(`${pr} 已批准`, { description: "可转为采购订单继续执行" });
    } catch (error) {
      toast.error("采购申请审批失败", { description: error instanceof Error ? error.message : "请确认 API 服务正在运行" });
    }
  }

  async function rejectRequest(pr: string) {
    try {
      await updateRequestStatus(pr, "已驳回");
      toast.error(`${pr} 已驳回`, { description: "状态已写入后端" });
    } catch (error) {
      toast.error("采购申请驳回失败", { description: error instanceof Error ? error.message : "请确认 API 服务正在运行" });
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
    setFilter("全部");
    return created;
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
      const rfq = await apiJson<RfqRecord>("/api/rfqs", {
        method: "POST",
        body: JSON.stringify({
          title: `${selected.sourceSku || "SKU"} ${selected.sourceName || ""} 采购询价`.trim(),
          category: selected.source || "采购申请",
          suppliers: invitedSuppliers.length,
          quoted: 0,
          bestPrice: Number(supplierRecommendationResult?.primary?.unitPrice || selected.unitPrice || 0),
          bestSupplier: supplierRecommendationResult?.primary?.supplier || selected.supplier || "",
          due: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString().slice(0, 10),
          status: "进行中",
          sourceRequest: selected.pr,
          sourceSku: selected.sourceSku,
          sourceName: selected.sourceName,
          quantity: selected.quantity,
          unit: selected.unit,
          reason: supplierRecommendationResult?.primary
            ? `${supplierRecommendationResult?.rfqReason || "替代询价"} 主推 ${supplierRecommendationResult.primary.supplier}，合同 ${supplierRecommendationResult.primary.contractId || "无"}，产能 ${supplierRecommendationResult.primary.capacityStatus || "未知"}，币种 ${supplierRecommendationResult.primary.currency || "CNY"}。`
            : supplierRecommendationResult?.rfqReason || selected.reason || "采购申请需要补充报价或备选供应商。",
          invitedSuppliers,
        }),
      });
      toast.success(`${rfq.id} 已发起`, { description: `${selected.pr} · 已邀请 ${invitedSuppliers.length} 家供应商` });
      onOpenRfq?.();
    } catch (error) {
      toast.error("RFQ 发起失败", { description: error instanceof Error ? error.message : "请确认 API 服务正在运行" });
    } finally {
      setCreatingRfq(false);
    }
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
          <button onClick={() => setFilter("全部")}
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

      <div className="grid grid-cols-5 gap-3">
        <Card className="col-span-3">
          <div className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}>
            <Filter size={13} style={{ color: A.gray2 }} />
            <SegmentedControl
              options={(["全部", "待审批", "已批准", "已驳回", "已转PO"] as const).map((s) => ({ label: s, value: s }))}
              value={filter} onChange={(v) => setFilter(v as any)}
            />
            <span className="text-xs ml-auto" style={{ color: A.gray2 }}>{filtered.length} 条</span>
            <button onClick={exportCsv}
              className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md font-medium hover:opacity-90 transition-opacity"
              style={{ background: A.gray6, color: A.blue }}>
              <FileSpreadsheet size={11} /> 导出 CSV
            </button>
            <button onClick={() => setNewOpen(true)}
              className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md font-medium text-white hover:opacity-90 transition-opacity"
              style={{ background: A.blue }}>
              <Plus size={11} /> 新建 PR
            </button>
          </div>
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-xs" style={{ color: A.gray2 }}>
              暂无采购申请。可在预测分析中生成预测补货申请。
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                  {["PR 编号", "来源", "物料", "供应商", "数量", "金额", "状态"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => {
                  const isSelected = selected?.pr === item.pr;
                  const sourceMeta = purchaseRequestSourceMeta(item.source);
                  const SourceIcon = sourceMeta.icon;
                  return (
                    <tr key={item.pr} onClick={() => setSelectedId(item.pr)}
                      className="cursor-pointer hover:bg-blue-50/40 transition-colors"
                      style={{
                        borderBottom: idx < filtered.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none",
                        background: isSelected ? "rgba(0,113,227,0.06)" : "transparent",
                      }}>
                      <td className="px-4 py-3 font-medium" style={{ color: A.blue }}>{item.pr}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                          style={{ background: sourceMeta.bg, color: sourceMeta.color }}>
                          <SourceIcon size={10} />
                          {sourceMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium" style={{ color: A.label }}>{item.sourceSku || "—"}</div>
                        <div className="text-[10px] mt-0.5 truncate max-w-28" style={{ color: A.gray2 }}>{item.sourceName}</div>
                      </td>
                      <td className="px-4 py-3" style={{ color: A.label }}>{item.supplier}</td>
                      <td className="px-4 py-3 tabular-nums" style={{ color: A.sub }}>{Number(item.quantity || 0).toLocaleString()} {item.unit}</td>
                      <td className="px-4 py-3 font-semibold" style={{ color: A.label }}>{fmt(item.amount)}</td>
                      <td className="px-4 py-3"><PRStatusPill status={item.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

        <Card className="col-span-2 p-5">
          {selected ? (
            <>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: A.gray2 }}>采购申请详情</div>
                  <div className="text-base font-semibold tracking-tight" style={{ color: A.label }}>{selected.pr}</div>
                </div>
                <PRStatusPill status={selected.status} />
              </div>

              <div className="space-y-3 pb-4 mb-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                {[
                  { label: "物料", value: `${selected.sourceSku || "—"} ${selected.sourceName || ""}` },
                  { label: "供应商", value: selected.supplier },
                  { label: "申请 / 采购", value: `${selected.requester} / ${selected.buyer}` },
                  { label: "需求日期", value: selected.requiredDate },
                  { label: "建议数量", value: `${Number(selected.quantity || 0).toLocaleString()} ${selected.unit}` },
                  { label: "预估金额", value: fmt(selected.amount) },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between gap-3 text-xs">
                    <span style={{ color: A.gray1 }}>{row.label}</span>
                    <span className="font-medium text-right" style={{ color: A.label }}>{row.value}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-xl p-3 mb-4" style={{
                background: supplierRecommendationResult?.needsRfq ? "#fff8f0" : "#f0faf4",
                border: `1px solid ${supplierRecommendationResult?.needsRfq ? "rgba(255,149,0,0.16)" : "rgba(52,199,89,0.12)"}`,
              }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: supplierRecommendationResult?.needsRfq ? A.orange : A.green }}>
                    <ShieldCheck size={12} /> 后端供应商推荐
                  </div>
                  {supplierRecommendationResult?.primary ? (
                    <span className="text-xs font-semibold tabular-nums" style={{ color: supplierRecommendationResult.primary.score >= 84 ? A.green : A.orange }}>
                      {supplierRecommendationResult.primary.score}
                    </span>
                  ) : (
                    <span className="text-[10px]" style={{ color: A.gray2 }}>加载中</span>
                  )}
                </div>
                {supplierRecommendationResult?.primary ? (
                  <>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-semibold truncate" style={{ color: A.label }}>{supplierRecommendationResult.primary.supplier}</span>
                      <span style={{ color: A.sub }}>
                        ¥{Number(supplierRecommendationResult.primary.unitPrice || 0).toLocaleString()} · {supplierRecommendationResult.primary.leadTimeDays}天
                      </span>
                    </div>
                    <div className="text-[10px] leading-4 mt-1" style={{ color: A.sub }}>{supplierRecommendationResult.primary.note}</div>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-[10px]">
                      <div><span style={{ color: A.gray2 }}>备选</span><div className="font-medium truncate" style={{ color: A.label }}>{supplierRecommendationResult.backup?.supplier || "—"}</div></div>
                      <div><span style={{ color: A.gray2 }}>拆单</span><div className="font-medium" style={{ color: supplierRecommendationResult.split.length ? A.blue : A.gray1 }}>{supplierRecommendationResult.split.length ? `${supplierRecommendationResult.split.length} 家` : "无需"}</div></div>
                      <div><span style={{ color: A.gray2 }}>RFQ</span><div className="font-medium" style={{ color: supplierRecommendationResult.needsRfq ? A.orange : A.green }}>{supplierRecommendationResult.needsRfq ? "建议" : "不需要"}</div></div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-[10px]">
                      <div>
                        <span style={{ color: A.gray2 }}>合同</span>
                        <div className="font-medium truncate" style={{ color: supplierRecommendationResult.primary.contractId ? A.purple : A.gray1 }}>
                          {supplierRecommendationResult.primary.contractId
                            ? `${supplierRecommendationResult.primary.contractId} · ${Math.round(Number(supplierRecommendationResult.primary.contractDiscount || 0) * 100)}%`
                            : "无框架"}
                        </div>
                      </div>
                      <div>
                        <span style={{ color: A.gray2 }}>币种</span>
                        <div className="font-medium" style={{ color: supplierRecommendationResult.primary.currency && supplierRecommendationResult.primary.currency !== "CNY" ? A.orange : A.label }}>
                          {supplierRecommendationResult.primary.currency || "CNY"}{supplierRecommendationResult.primary.currency && supplierRecommendationResult.primary.currency !== "CNY" ? ` ×${Number(supplierRecommendationResult.primary.fxRate || 1).toFixed(2)}` : ""}
                        </div>
                      </div>
                      <div>
                        <span style={{ color: A.gray2 }}>产能</span>
                        <div className="font-medium truncate" style={{ color: supplierRecommendationResult.primary.capacityStatus === "不足" ? A.red : supplierRecommendationResult.primary.capacityStatus === "紧张" ? A.orange : A.green }}>
                          {supplierRecommendationResult.primary.capacityStatus || "可承诺"} · {Number(supplierRecommendationResult.primary.availableCapacity || supplierRecommendationResult.primary.capacity || 0).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    {supplierRecommendationResult.needsRfq && (
                      <div className="mt-2 text-[10px] leading-4" style={{ color: A.orange }}>{supplierRecommendationResult.rfqReason}</div>
                    )}
                    <button onClick={createRfqFromSelected} disabled={creatingRfq}
                      className="mt-2 h-7 px-2.5 rounded-md text-[11px] font-semibold text-white inline-flex items-center gap-1.5 disabled:opacity-60"
                      style={{ background: supplierRecommendationResult.needsRfq ? A.orange : A.blue }}>
                      {creatingRfq ? <Loader2 size={11} className="animate-spin" /> : <FileSpreadsheet size={11} />}
                      {supplierRecommendationResult.needsRfq ? "发起 RFQ" : "替代询价"}
                    </button>
                  </>
                ) : (
                  <div className="text-[10px] leading-4" style={{ color: A.sub }}>
                    当前 SKU 缺少后端报价候选，建议先维护供应商报价或发起 RFQ。
                    <div>
                      <button onClick={createRfqFromSelected} disabled={creatingRfq}
                        className="mt-2 h-7 px-2.5 rounded-md text-[11px] font-semibold text-white inline-flex items-center gap-1.5 disabled:opacity-60"
                        style={{ background: A.orange }}>
                        {creatingRfq ? <Loader2 size={11} className="animate-spin" /> : <FileSpreadsheet size={11} />}
                        发起 RFQ
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {selected.forecastBasis && (
                <div className="rounded-xl p-3 mb-4" style={{
                  background: selected.source === "inventory" ? "#fff8f0" : selected.source === "mrp-release" ? "#f5f0ff" : "#f0f6ff",
                  border: `1px solid ${selected.source === "inventory" ? "rgba(255,149,0,0.16)" : selected.source === "mrp-release" ? "rgba(175,82,222,0.14)" : "rgba(0,113,227,0.12)"}`,
                }}>
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold mb-2" style={{ color: selected.source === "inventory" ? A.orange : selected.source === "mrp-release" ? A.purple : A.blue }}>
                    {selected.source === "inventory" ? <Package size={12} /> : selected.source === "mrp-release" ? <GitBranch size={12} /> : <Sparkles size={12} />}
                    {selected.source === "inventory" ? "库存控制证据" : selected.source === "mrp-release" ? "MRP 释放证据" : "预测证据"}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    {(selected.source === "inventory" ? [
                      ["可用库存", `${Number(selected.forecastBasis.projectedAvailable || 0).toLocaleString()} ${selected.unit}`],
                      ["再订货点 ROP", `${Number(selected.forecastBasis.reorderPoint || 0).toLocaleString()} ${selected.unit}`],
                      ["覆盖天数", `${selected.forecastBasis.daysCover ?? "—"} 天`],
                      ["提前期 / MOQ", `${selected.forecastBasis.leadTimeDays ?? "—"} 天 / ${selected.forecastBasis.moq ?? "—"}`],
                    ] : selected.source === "mrp-release" ? [
                      ["计划入库", `${Number(selected.forecastBasis.plannedReceipt || 0).toLocaleString()} ${selected.unit}`],
                      ["计划释放期", selected.forecastBasis.plannedReleasePeriod || "—"],
                      ["最大净需求", `${Number(selected.forecastBasis.peakGap || 0).toLocaleString()} ${selected.unit}`],
                      ["例外 / 服务水平", `${selected.forecastBasis.mrpException || "—"} / ${selected.forecastBasis.serviceLevel || "—"}%`],
                    ] : [
                      ["峰值缺口", `${Number(selected.forecastBasis.peakGap || 0).toLocaleString()} ${selected.unit}`],
                      ["服务水平", `${selected.forecastBasis.serviceLevel || "—"}%`],
                      ["安全系数", `${Math.round(Number(selected.forecastBasis.safetyFactor || 1) * 100)}%`],
                      ["首个断货月", selected.forecastBasis.firstStockoutMonth || "—"],
                    ]).map(([label, value]) => (
                      <div key={label}>
                        <div style={{ color: A.gray2 }}>{label}</div>
                        <div className="font-medium mt-0.5" style={{ color: A.label }}>{value}</div>
                      </div>
                    ))}
                  </div>
                  {selected.source === "mrp-release" && selected.forecastBasis.bomSourceSummary && (
                    <div className="mt-2 rounded-lg p-2 text-[10px] leading-4" style={{ background: "rgba(175,82,222,0.08)", color: A.sub }}>
                      <span className="font-semibold" style={{ color: A.purple }}>BOM 来源：</span>
                      {selected.forecastBasis.bomSourceSummary}
                    </div>
                  )}
                  <div className="mt-2 text-[10px] leading-4" style={{ color: A.sub }}>{selected.reason}</div>
                </div>
              )}

              {selected.approvalSnapshot && (
                <div className="rounded-xl p-3 mb-4" style={{ background: A.gray6, border: "1px solid rgba(0,0,0,0.05)" }}>
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold mb-2" style={{ color: A.label }}>
                    <FileCheck2 size={12} /> 审批快照
                  </div>
                  <div className="text-xs font-semibold leading-5" style={{ color: A.label }}>
                    {selected.approvalSnapshot.summary || "已锁定本次申请依据"}
                  </div>
                  {selected.approvalSnapshot.explanation && (
                    <div className="text-[10px] leading-4 mt-1" style={{ color: A.sub }}>{selected.approvalSnapshot.explanation}</div>
                  )}
                  <div className="grid grid-cols-2 gap-2 mt-2 text-[10px]">
                    {[
                      ["来源", selected.approvalSnapshot.source || selected.source],
                      ["供应商", String((selected.approvalSnapshot.supplier as any)?.name || selected.supplier || "—")],
                      ["评分", String((selected.approvalSnapshot.supplier as any)?.score || (selected.approvalSnapshot.supplier as any)?.grade || "—")],
                      ["快照时间", selected.approvalSnapshot.createdAt ? new Date(selected.approvalSnapshot.createdAt).toLocaleString("zh-CN") : "—"],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <div style={{ color: A.gray2 }}>{label}</div>
                        <div className="font-medium truncate" style={{ color: A.label }}>{value}</div>
                      </div>
                    ))}
                  </div>
                  {Array.isArray((selected.approvalSnapshot.mrp as any)?.bomSources) && (selected.approvalSnapshot.mrp as any).bomSources.length > 0 && (
                    <div className="mt-3 pt-3" style={{ borderTop: "0.5px solid rgba(0,0,0,0.06)" }}>
                      <div className="text-[10px] font-semibold mb-1.5" style={{ color: A.purple }}>BOM 展开证据</div>
                      <div className="space-y-1.5">
                        {((selected.approvalSnapshot.mrp as any).bomSources as any[]).slice(0, 4).map((source, index) => (
                          <div key={`${source.parent || index}-${source.top || index}`} className="flex items-center justify-between gap-3 text-[10px]">
                            <span className="truncate" style={{ color: A.sub }}>
                              L{source.level || 1} · {source.parentName || source.parent || "父项"}{source.topName ? ` / ${source.topName}` : ""}
                            </span>
                            <span className="font-semibold tabular-nums" style={{ color: A.label }}>
                              {Number(source.demand || 0).toLocaleString()} {selected.unit}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {Array.isArray((selected.approvalSnapshot.mrp as any)?.schedule) && (selected.approvalSnapshot.mrp as any).schedule.length > 0 && (
                    <div className="mt-3 pt-3" style={{ borderTop: "0.5px solid rgba(0,0,0,0.06)" }}>
                      <div className="text-[10px] font-semibold mb-1.5" style={{ color: A.label }}>MRP 分期证据</div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {((selected.approvalSnapshot.mrp as any).schedule as any[]).slice(0, 3).map((line) => (
                          <div key={line.period} className="rounded-lg px-2 py-1.5" style={{ background: A.white }}>
                            <div className="text-[9px]" style={{ color: A.gray2 }}>{line.period}</div>
                            <div className="text-[10px] font-semibold" style={{ color: A.label }}>
                              BOM {Number(line.dependentDemand || 0).toLocaleString()} / 入库 {Number(line.plannedReceipt || 0).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <DocumentHistoryPanel
                entityType="purchaseRequest"
                entityId={selected.pr}
                title="审批历史"
                refreshKey={selected.lastAuditId || selected.auditTrailIds?.join(",") || selected.status}
              />

              <div className="flex flex-wrap gap-2">
                {selected.status === "待审批" && (
                  <>
                    <button onClick={() => approveRequest(selected.pr)}
                      className="h-8 px-3 rounded-lg text-xs font-semibold text-white" style={{ background: A.blue }}>
                      批准申请
                    </button>
                    <button onClick={() => rejectRequest(selected.pr)}
                      className="h-8 px-3 rounded-lg text-xs font-semibold" style={{ background: "#fff1f0", color: A.red }}>
                      驳回
                    </button>
                  </>
                )}
                {selected.status === "已批准" && (
                  <button onClick={() => convertRequest(selected.pr)}
                    className="h-8 px-3 rounded-lg text-xs font-semibold text-white" style={{ background: A.green }}>
                    转采购订单
                  </button>
                )}
                {selected.linkedPo && (
                  <span className="h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center"
                    style={{ background: "#f0faf4", color: A.green }}>
                    已生成 {selected.linkedPo}
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="py-16 text-center text-xs" style={{ color: A.gray2 }}>选择一张采购申请查看详情</div>
          )}
        </Card>
      </div>
      <NewPRModal open={newOpen} onClose={() => setNewOpen(false)} onCreate={createManualRequest} />
    </div>
  );
}
