import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle, CheckCircle2, FileSpreadsheet,
  FileText, Filter, Plus, Sparkles, Truck,
} from "lucide-react";
import {
  Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { apiJson } from "../../lib/api-client";
import { exportRowsToCsv } from "../../lib/data-export";
import { fmt } from "../../lib/format";
import { procurementTrend, purchaseOrders, receivingDocs, SUPPLIER_INVOICES } from "../../data/demo-data";
import type { POStatus, PurchaseOrder, ReceivingDoc, ReceivingDocLine } from "../../types/scm";
import {
  A, AppleTooltip, Card, DocumentHistoryPanel, Field, inputStyle, KpiCard,
  SectionHeader,
} from "../../components/ui";
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
import { NewPOModal } from "./components/NewPOModal";
import { POStatusPill } from "./components/POStatusPill";
import { TrackShipmentModal } from "./components/TrackShipmentModal";
import { lineStatusLabel, poLinesOf, poTotals, toNumber } from "../../domain/purchasing/helpers";
import { grnLinesOf, isPostedGrn } from "../../domain/receiving/helpers";
import { getPoLinkedDocuments } from "../../domain/procurement/document-links";
import type { ActiveContext } from "../ai-assistant/Panel";
import {
  defaultPurchaseOrderWorkbenchFilters,
  filterPurchaseOrdersForWorkbench,
  type PurchaseOrderWorkbenchFilters,
} from "./filters";

type PurchaseOrderViewMode = "list" | "detail";

function poTimeline(po: PurchaseOrder): TimelineStep[] {
  const cancelled = po.status === "已取消" || po.status === "已驳回";
  const statusOrder = ["草稿", "待审批", "已审批", "已发出", "部分到货", "已完成"] as const;
  const currentIndex = Math.max(0, statusOrder.indexOf(po.status as any));
  const receivedTotal = poTotals(po).totalReceivedQty || Number(po.received || 0);
  return [
    { label: "草稿", status: cancelled ? "done" : currentIndex > 0 ? "done" : "current", helper: po.created },
    { label: "待审批", status: cancelled ? "blocked" : currentIndex > 1 ? "done" : po.status === "待审批" ? "current" : "pending", helper: po.status === "已驳回" ? "已驳回" : "审批队列" },
    { label: "已审批", status: currentIndex > 2 ? "done" : po.status === "已审批" ? "current" : "pending" },
    { label: "已发出", status: currentIndex > 3 ? "done" : po.status === "已发出" ? "current" : "pending", helper: po.eta },
    { label: "部分到货", status: cancelled ? "pending" : currentIndex > 4 ? "done" : po.status === "部分到货" ? "warning" : receivedTotal > 0 ? "warning" : "pending", helper: `${receivedTotal.toLocaleString()} 已收` },
    { label: "已完成", status: po.status === "已完成" ? "done" : cancelled ? "blocked" : "pending", helper: cancelled ? po.status : po.paid ? "下游已付款" : "待下游发票/AP" },
  ];
}

function exportPoDetail(po: PurchaseOrder) {
  const lines = poLinesOf(po);
  const totals = poTotals(po);
  const headerRows = [
    ["PO编号", po.po],
    ["供应商", po.supplier],
    ["创建日期", po.created],
    ["ETA", po.eta],
    ["采购负责人", po.owner],
    ["优先级", po.priority],
    ["状态", po.status],
    ["付款状态", po.paid ? "已付款" : "未付款"],
    ["来源类型", po.source || "manual"],
    ["来源PR", po.sourceRequest || ""],
    ["来源RFQ", po.sourceRfq || ""],
    ["来源SKU", po.sourceSku || ""],
    ["关联GRN", receivingDocs.filter((item) => item.po === po.po).map((item) => item.grn).join(", ")],
    ["关联发票", SUPPLIER_INVOICES.filter((item) => item.relatedPo === po.po).map((item) => item.invoiceNumber).join(", ")],
    ["金额", totals.totalAmount || po.amount],
  ].map(([field, value]) => ({ section: "header", field, value }));
  const lineRows = lines.map((line) => ({
    section: "line",
    field: line.poLineId,
    value: `${line.sku} ${line.itemName}`,
    订购数量: line.quantityOrdered,
    已收货数量: line.quantityReceived,
    合格数量: line.quantityAccepted,
    拒收数量: line.quantityRejected,
    单位: line.unit,
    单价: line.unitPrice,
    金额: toNumber(line.quantityOrdered) * toNumber(line.unitPrice),
    仓库: line.warehouseId || "",
    状态: line.status || "",
  }));
  exportRowsToCsv(`purchase-order-detail-${po.po}.csv`, [...headerRows, ...lineRows]);
  toast.success("采购订单详情 CSV 已导出");
}

export default function PurchasingOrdersPage({
  onActiveContextChange,
}: {
  onActiveContextChange?: (context: ActiveContext | null) => void;
}) {
  const [orders, setOrders] = useState<PurchaseOrder[]>(purchaseOrders);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<PurchaseOrderWorkbenchFilters>(defaultPurchaseOrderWorkbenchFilters);
  const [selectedId, setSelectedId] = useState(purchaseOrders[0]?.po ?? "");
  const [viewMode, setViewMode] = useState<PurchaseOrderViewMode>("list");
  const [newOpen, setNewOpen] = useState(false);
  const [trackOpen, setTrackOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    apiJson<PurchaseOrder[]>("/api/purchase-orders")
      .then((data) => {
        if (!alive) return;
        setOrders(data);
        setSelectedId((current) => data.some((o) => o.po === current) ? current : data[0]?.po ?? "");
      })
      .catch(() => toast.error("采购订单 API 未连接", { description: "请先运行 npm run api，再运行 npm run dev" }))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const filtered = filterPurchaseOrdersForWorkbench(orders, filters);
  const sourceOptions = Array.from(new Set(orders.map((order) => order.source || "manual"))).sort();
  const statusOptions = ["全部", "草稿", "待审批", "已审批", "已发出", "部分到货", "已完成", "已驳回", "已取消"] as const;
  const selectedPO = orders.find((o) => o.po === selectedId) ?? filtered[0] ?? orders[0] ?? null;
  const selectedPOLines = poLinesOf(selectedPO);
  const selectedPOTotals = poTotals(selectedPO);

  useEffect(() => {
    if (!filtered.length) {
      if (selectedId) setSelectedId("");
      return;
    }
    if (!filtered.some((order) => order.po === selectedId)) {
      setSelectedId(filtered[0].po);
    }
  }, [filtered, selectedId]);

  useEffect(() => {
    if (viewMode !== "detail" || !selectedPO) {
      onActiveContextChange?.(null);
      return;
    }
    onActiveContextChange?.({
      module: "procurement",
      entityType: "purchase_order",
      entityId: selectedPO.po,
      entityLabel: `${selectedPO.po} · ${selectedPO.supplier}`,
      view: "orders",
    });
    return () => onActiveContextChange?.(null);
  }, [viewMode, selectedPO?.po, selectedPO?.supplier, onActiveContextChange]);

  const totalAmount   = orders.reduce((s, o) => s + o.amount, 0);
  const pendingApprov = orders.filter((o) => o.status === "待审批").length;
  const inTransit     = orders.filter((o) => o.status === "已发出" || o.status === "部分到货").length;

  async function updatePOStatus(poId: string, status: POStatus) {
    const updated = await apiJson<PurchaseOrder>(`/api/purchase-orders/${encodeURIComponent(poId)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    setOrders((arr) => arr.map((o) => o.po === poId ? updated : o));
    return updated;
  }

  async function approve(poId: string) {
    try {
      await updatePOStatus(poId, "已审批");
      toast.success(`${poId} 已审批`, { description: "审批状态已更新" });
    } catch (error) {
      toast.error("采购订单审批失败", { description: error instanceof Error ? error.message : "请检查服务连接状态" });
    }
  }
  async function reject(poId: string) {
    try {
      await updatePOStatus(poId, "已驳回");
      toast.error(`${poId} 已驳回`, { description: "状态已更新" });
    } catch (error) {
      toast.error("采购订单驳回失败", { description: error instanceof Error ? error.message : "请检查服务连接状态" });
    }
  }
  async function cancel(poId: string) {
    if (!confirm(`确认取消 ${poId}？此操作不可撤销。`)) return;
    try {
      await updatePOStatus(poId, "已取消");
      toast(`${poId} 已取消`);
    } catch (error) {
      toast.error("采购订单取消失败", { description: error instanceof Error ? error.message : "请检查服务连接状态" });
    }
  }
  async function send(poId: string) {
    try {
      await updatePOStatus(poId, "已发出");
      toast.success(`${poId} 已下发至供应商`, { description: "状态变更已记录" });
    } catch (error) {
      toast.error("采购订单下发失败", { description: error instanceof Error ? error.message : "请检查服务连接状态" });
    }
  }
  function updateFilter<K extends keyof PurchaseOrderWorkbenchFilters>(key: K, value: PurchaseOrderWorkbenchFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }
  function resetFilters() {
    setFilters(defaultPurchaseOrderWorkbenchFilters);
  }
  function openDetail(poId: string) {
    setSelectedId(poId);
    setViewMode("detail");
  }
  function returnToList() {
    setViewMode("list");
  }
  function exportCsv() {
    if (filtered.length === 0) {
      toast.warning("暂无可导出的数据");
      return;
    }
    exportRowsToCsv("procurement-purchase-orders-export.csv", filtered.map((order) => {
      const totals = poTotals(order);
      const progress = totals.totalOrderedQty === 0 ? 0 : (totals.totalReceivedQty / totals.totalOrderedQty) * 100;
      return {
        PO编号: order.po,
        供应商: order.supplier,
        来源: order.source || "manual",
        来源SKU: order.sourceSku || "",
        来源名称: order.sourceName || "",
        金额: order.amount,
        明细行数: totals.lineCount,
        优先级: order.priority,
        负责人: order.owner,
        ETA: order.eta,
        状态: order.status,
        总订购数量: totals.totalOrderedQty,
        总收货数量: totals.totalReceivedQty,
        收货进度百分比: Number(progress.toFixed(1)),
      };
    }));
    toast.success("导出文件已生成");
  }

  const detailContent = selectedPO && (
    <DocumentShell
      title="采购订单"
      documentNo={selectedPO.po}
      moduleLabel="采购"
      status={selectedPO.status}
      subtitle={`${selectedPO.supplier} · ETA ${selectedPO.eta}`}
    >
      <DocumentHeader
        fields={[
          { label: "PO编号", value: selectedPO.po },
          { label: "供应商", value: selectedPO.supplier },
          { label: "创建日期", value: selectedPO.created },
          { label: "ETA", value: selectedPO.eta },
          { label: "采购负责人", value: selectedPO.owner },
          { label: "优先级", value: selectedPO.priority, tone: selectedPO.priority === "高" ? "danger" : selectedPO.priority === "中" ? "warning" : "success" },
          { label: "状态", value: selectedPO.status, tone: statusTone(selectedPO.status) },
          { label: "来源类型", value: selectedPO.source || "manual" },
          { label: "来源 PR", value: selectedPO.sourceRequest || "—" },
          { label: "来源 RFQ", value: selectedPO.sourceRfq || "—" },
          { label: "来源 SKU", value: selectedPO.sourceSku || "—", helper: selectedPO.sourceName },
          { label: "金额", value: fmt(selectedPOTotals.totalAmount || selectedPO.amount), tone: "info" },
        ]}
      />
      <DocumentStatusTimeline steps={poTimeline(selectedPO)} />
      <DocumentLinesTable
        rows={selectedPOLines.length ? selectedPOLines : [{
          poLineId: `${selectedPO.po}-SUMMARY`,
          sku: selectedPO.sourceSku || "SUMMARY",
          itemName: selectedPO.sourceName || "采购订单汇总行",
          quantityOrdered: selectedPO.recommendedQty || selectedPO.items || 0,
          quantityReceived: selectedPO.received || 0,
          quantityAccepted: selectedPO.received || 0,
          quantityRejected: 0,
          unit: selectedPO.unit || "行",
          unitPrice: selectedPO.unitPrice || selectedPO.amount,
          currency: selectedPO.currency || "CNY",
        }]}
        columns={[
          { key: "poLineId", label: "行号", render: (line) => <span style={{ color: A.blue }}>{String(line.poLineId)}</span> },
          { key: "sku", label: "SKU" },
          { key: "itemName", label: "品名" },
          { key: "quantityOrdered", label: "订单数量", align: "right", render: (line) => Number(line.quantityOrdered || 0).toLocaleString() },
          { key: "unit", label: "单位" },
          { key: "unitPrice", label: "单价", align: "right", render: (line) => fmt(Number(line.unitPrice || 0)) },
          { key: "quantityReceived", label: "已收货数量", align: "right", render: (line) => Number(line.quantityReceived || 0).toLocaleString() },
          { key: "quantityRejected", label: "拒收数量", align: "right", render: (line) => Number(line.quantityRejected || 0).toLocaleString() },
          { key: "warehouseId", label: "仓库", render: (line) => String(line.warehouseId || selectedPO.warehouseId || "MAIN") },
          { key: "status", label: "状态", render: (line) => String(line.status || lineStatusLabel(line.status)) },
        ]}
      />
      <DocumentTotals
        totals={[
          { label: "采购金额", value: fmt(selectedPOTotals.totalAmount || selectedPO.amount), tone: "info" },
          { label: "订单数量", value: selectedPOTotals.totalOrderedQty.toLocaleString() },
          { label: "已收货数量", value: selectedPOTotals.totalReceivedQty.toLocaleString(), tone: selectedPOTotals.totalReceivedQty ? "success" : "neutral" },
          { label: "未收货数量", value: Math.max(0, selectedPOTotals.totalOrderedQty - selectedPOTotals.totalReceivedQty).toLocaleString(), tone: selectedPOTotals.totalOrderedQty > selectedPOTotals.totalReceivedQty ? "warning" : "success" },
          { label: "收货进度", value: `${selectedPOTotals.totalOrderedQty ? Math.round((selectedPOTotals.totalReceivedQty / selectedPOTotals.totalOrderedQty) * 100) : 0}%` },
        ]}
        columns={5}
      />
      <DocumentEvidencePanel
        linkedDocuments={getPoLinkedDocuments(selectedPO, SUPPLIER_INVOICES, receivingDocs)}
        provenance={selectedPO.source || "manual"}
        notes={selectedPO.reason || selectedPO.approvalSnapshot?.summary || "采购订单详情用于审批、收货和供应商协同复核。"}
        evidence={[
          { label: "来源 PR", value: selectedPO.sourceRequest || "—" },
          { label: "来源 RFQ", value: selectedPO.sourceRfq || "—" },
          { label: "审批快照", value: selectedPO.approvalSnapshot?.createdAt ? new Date(selectedPO.approvalSnapshot.createdAt).toLocaleString("zh-CN") : "—" },
          { label: "关联 GRN", value: receivingDocs.filter((item) => item.po === selectedPO.po).length },
          { label: "关联发票", value: SUPPLIER_INVOICES.filter((item) => item.relatedPo === selectedPO.po).length },
          { label: "付款状态", value: selectedPO.paid ? "已付款" : "未付款", tone: selectedPO.paid ? "success" : "warning" },
        ]}
      />
      <DocumentHistoryPanel
        entityType="purchaseOrder"
        entityId={selectedPO.po}
        title="订单状态历史"
        refreshKey={selectedPO.lastAuditId || selectedPO.auditTrailIds?.join(",") || selectedPO.status}
      />
      <DocumentActionBar>
        <button onClick={returnToList} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: A.white, color: A.label, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)" }}>返回列表</button>
        {selectedPO.status === "待审批" && <button onClick={() => approve(selectedPO.po)} className="text-xs px-3 py-1.5 rounded-lg font-medium text-white" style={{ background: A.green }}>审批订单</button>}
        {selectedPO.status === "待审批" && <button onClick={() => reject(selectedPO.po)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "#fff1f0", color: A.red }}>驳回</button>}
        {selectedPO.status === "已审批" && <button onClick={() => send(selectedPO.po)} className="text-xs px-3 py-1.5 rounded-lg font-medium text-white" style={{ background: A.blue }}>下发至供应商</button>}
        {(selectedPO.status === "已发出" || selectedPO.status === "部分到货" || selectedPO.status === "已完成") && <button onClick={() => setTrackOpen(true)} className="text-xs px-3 py-1.5 rounded-lg font-medium text-white" style={{ background: A.blue }}>跟踪发货</button>}
        {!["已完成", "已取消"].includes(selectedPO.status) && <button onClick={() => cancel(selectedPO.po)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "#fff1f0", color: A.red }}>取消订单</button>}
        <button onClick={() => toast("发票协同位于采购管理", { description: "请打开采购管理的发票协同视图查看关联发票。" })} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "#faf3ff", color: A.purple }}>打开发票协同</button>
        <button onClick={() => exportPoDetail(selectedPO)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: A.white, color: A.blue, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)" }}>导出 CSV</button>
      </DocumentActionBar>
    </DocumentShell>
  );

  if (viewMode === "detail") {
    return (
      <div className="space-y-5">
        {selectedPO ? detailContent : (
          <Card className="p-8 text-center text-xs" style={{ color: A.gray2 }}>
            未找到采购订单。
            <button onClick={returnToList} className="ml-3 px-3 py-1.5 rounded-lg font-medium" style={{ background: A.gray6, color: A.blue }}>返回列表</button>
          </Card>
        )}
        <NewPOModal open={newOpen} onClose={() => setNewOpen(false)}
          onCreate={async (po) => {
            const created = await apiJson<PurchaseOrder>("/api/purchase-orders", {
              method: "POST",
              body: JSON.stringify(po),
            });
            setOrders((arr) => [created, ...arr]);
            setSelectedId(created.po);
            return created;
          }} />
        <TrackShipmentModal open={trackOpen} onClose={() => setTrackOpen(false)} po={selectedPO} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="本月 PO 总额" value={fmt(totalAmount)} sub={loading ? "加载中" : `${orders.length} 张订单`} delta="+12.4%" positive={false} icon={FileText}  color={A.blue}   />
        <KpiCard label="待审批" value={String(pendingApprov)}  sub="平均等待 2.4 小时"   delta="+1 vs 昨日" positive={false} icon={AlertCircle} color={A.orange} />
        <KpiCard label="在途订单" value={String(inTransit)}     sub="未来 7 天到货"        delta="¥624 万"     positive icon={Truck}        color={A.teal}   />
        <KpiCard label="本月完成率" value="84.6%" sub="按时交付 / 已完成"     delta="+3.2pts"     positive icon={CheckCircle2} color={A.green}  />
      </div>

      {/* Approval queue + trend */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-5">
          {(() => {
            const pending = orders.filter((o) => o.status === "待审批");
            return (
              <>
                <SectionHeader title="待审批队列"
                  right={<span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                    style={{ background: "#fff8f0", color: A.orange }}>{pending.length} 待处理</span>} />
                <div className="space-y-2.5">
                  {pending.length === 0 ? (
                    <div className="text-center py-10 text-xs" style={{ color: A.gray2 }}>
                      <CheckCircle2 size={22} className="mx-auto mb-2" style={{ color: A.green }} />
                      暂无待审批订单
                    </div>
                  ) : pending.map((q) => (
                    <div key={q.po} className="rounded-xl p-3" style={{ background: A.gray6 }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <button onClick={() => setSelectedId(q.po)}
                          className="text-xs font-semibold hover:underline" style={{ color: A.blue }}>{q.po}</button>
                        <span className="text-[10px] px-1.5 py-px rounded-full font-medium"
                          style={{ background: "#fff8f0", color: A.orange }}>优先级 {q.priority}</span>
                      </div>
                      <div className="text-xs font-medium mb-1" style={{ color: A.label }}>{q.supplier}</div>
                      <div className="text-[11px] mb-2.5" style={{ color: A.sub }}>
                        {q.source === "forecast" ? `${q.sourceSku} · 预测补货` : `${q.items} 行`} · {q.owner} 提交
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold tracking-tight" style={{ color: A.label }}>{fmt(q.amount)}</span>
                        <div className="flex gap-1.5">
                          <button onClick={() => reject(q.po)}
                            className="text-[11px] px-2.5 py-1 rounded-md font-medium transition-colors hover:bg-red-50"
                            style={{ background: A.white, color: A.gray1, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)" }}>驳回</button>
                          <button onClick={() => approve(q.po)}
                            className="text-[11px] px-2.5 py-1 rounded-md font-medium text-white transition-opacity hover:opacity-90"
                            style={{ background: A.blue }}>批准</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </Card>

        <Card className="col-span-2 p-5">
          <SectionHeader title="本周下单趋势"
            right={<div className="flex items-center gap-3 text-xs" style={{ color: A.sub }}>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: A.blue }} />订单数</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: A.purple }} />金额(万)</span>
            </div>} />
          <ResponsiveContainer width="100%" height={210}>
            <ComposedChart data={procurementTrend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="0" stroke="rgba(0,0,0,0.05)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="l" tick={{ fontSize: 11, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} width={32} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} width={40} />
              <Tooltip content={<AppleTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
              <Bar yAxisId="l" dataKey="po" name="订单数" fill={A.blue} radius={[5, 5, 0, 0]} barSize={20} />
              <Line yAxisId="r" type="monotone" dataKey="amount" name="金额(万)" stroke={A.purple} strokeWidth={2} dot={{ r: 3, fill: A.white, strokeWidth: 2, stroke: A.purple }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <SectionHeader title="采购订单查询" />
            <div className="text-xs mt-1" style={{ color: A.sub }}>
              按 PO、供应商、物料、状态和 ETA 查询采购执行记录
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => toast.success(`已筛选 ${filtered.length} 条采购订单`)}
              className="h-8 px-3 rounded-lg text-xs font-medium text-white"
              style={{ background: A.blue }}>
              查询
            </button>
            <button onClick={resetFilters}
              className="h-8 px-3 rounded-lg text-xs font-medium"
              style={{ background: A.gray6, color: A.label }}>
              重置
            </button>
            <button onClick={exportCsv}
              className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5"
              style={{ background: "#f0f6ff", color: A.blue }}>
              <FileSpreadsheet size={13} /> 导出当前结果
            </button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <Field label="PO 编号">
            <input value={filters.poNumber} onChange={(event) => updateFilter("poNumber", event.target.value)}
              placeholder="PO-2026-1287" style={inputStyle} />
          </Field>
          <Field label="供应商">
            <input value={filters.supplier} onChange={(event) => updateFilter("supplier", event.target.value)}
              placeholder="供应商名称" style={inputStyle} />
          </Field>
          <Field label="物料 / SKU">
            <input value={filters.skuOrItem} onChange={(event) => updateFilter("skuOrItem", event.target.value)}
              placeholder="SKU 或品名" style={inputStyle} />
          </Field>
          <Field label="状态">
            <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value as PurchaseOrderWorkbenchFilters["status"])}
              style={inputStyle}>
              {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </Field>
          <Field label="来源">
            <select value={filters.source} onChange={(event) => updateFilter("source", event.target.value)}
              style={inputStyle}>
              <option value="全部">全部</option>
              {sourceOptions.map((source) => (
                <option key={source} value={source}>{source === "forecast" ? "预测" : source === "manual" ? "手工" : source}</option>
              ))}
            </select>
          </Field>
          <Field label="负责人">
            <input value={filters.owner} onChange={(event) => updateFilter("owner", event.target.value)}
              placeholder="采购负责人" style={inputStyle} />
          </Field>
          <Field label="ETA 起始">
            <input value={filters.etaFrom} onChange={(event) => updateFilter("etaFrom", event.target.value)}
              placeholder="2026-06-01" style={inputStyle} />
          </Field>
          <Field label="ETA 结束">
            <input value={filters.etaTo} onChange={(event) => updateFilter("etaTo", event.target.value)}
              placeholder="2026-06-30" style={inputStyle} />
          </Field>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}>
          <div>
            <div className="text-sm font-semibold" style={{ color: A.label }}>采购订单列表</div>
            <div className="text-[11px] mt-0.5" style={{ color: A.sub }}>共 {orders.length} 条，当前筛选 {filtered.length} 条</div>
          </div>
          <span className="text-xs ml-auto flex items-center gap-1.5" style={{ color: A.gray2 }}>
            <Filter size={13} /> 当前结果
          </span>
          <ContextualImportActions entityLabel="PO" compact />
          <button onClick={() => setNewOpen(true)}
            className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md font-medium text-white hover:opacity-90 transition-opacity"
            style={{ background: A.blue }}>
            <Plus size={11} /> 新建 PO
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                {["PO 编号", "供应商", "来源", "金额", "项目", "到货进度", "ETA", "状态", "操作"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((o, i) => {
                const totals = poTotals(o);
                const pct = totals.totalOrderedQty === 0 ? 0 : (totals.totalReceivedQty / totals.totalOrderedQty) * 100;
                return (
                  <tr key={o.po}
                    className="transition-colors hover:bg-blue-50/40"
                    style={{ borderBottom: i < filtered.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                    <td className="px-4 py-3 font-medium">
                      <button onClick={() => openDetail(o.po)} className="hover:underline" style={{ color: A.blue }}>{o.po}</button>
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: A.label }}>{o.supplier}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={{ background: o.source === "forecast" ? "#f0f6ff" : A.gray6, color: o.source === "forecast" ? A.blue : A.gray1 }}>
                        {o.source === "forecast" ? <Sparkles size={10} /> : <FileText size={10} />}
                        {o.source === "forecast" ? "预测" : "手工"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold" style={{ color: A.label }}>{fmt(o.amount)}</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{totals.lineCount}</td>
                    <td className="px-4 py-3 w-28">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: A.gray5 }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct === 100 ? A.green : pct > 0 ? A.teal : A.gray4 }} />
                        </div>
                        <span className="text-[10px] w-12 text-right" style={{ color: A.gray1 }}>{totals.totalReceivedQty}/{totals.totalOrderedQty}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{o.eta}</td>
                    <td className="px-4 py-3"><POStatusPill status={o.status} /></td>
                    <td className="px-4 py-3">
                      <button onClick={() => openDetail(o.po)}
                        className="px-2 py-1 text-[11px] font-medium rounded-md"
                        style={{ background: "#f0f6ff", color: A.blue }}>
                        查看详情
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-xs" style={{ color: A.gray2 }}>
                    当前条件下暂无采购订单
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <NewPOModal open={newOpen} onClose={() => setNewOpen(false)}
        onCreate={async (po) => {
          const created = await apiJson<PurchaseOrder>("/api/purchase-orders", {
            method: "POST",
            body: JSON.stringify(po),
          });
          setOrders((arr) => [created, ...arr]);
          setSelectedId(created.po);
          return created;
        }} />
      <TrackShipmentModal open={trackOpen} onClose={() => setTrackOpen(false)} po={selectedPO} />
    </div>
  );
}

// ─── Scan Receive Modal ─────────────────────────────────────────────────────
