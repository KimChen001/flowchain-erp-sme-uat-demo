import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle, Camera, Calendar, Check, CheckCircle2, Clock, DollarSign, Eye, FileCheck2, FileSpreadsheet,
  FileText, Filter, Hash, Lock, PackageCheck, Plus, Printer, Send, Sparkles, Trash2, Truck,
  User, X, XCircle,
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
  Modal, SectionHeader, SegmentedControl,
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
import { exportModulePdf } from "../../lib/pdf-export";
import { NewPOModal } from "./components/NewPOModal";
import { POStatusPill } from "./components/POStatusPill";
import { TrackShipmentModal } from "./components/TrackShipmentModal";
import { lineRemaining, lineStatusLabel, lineStatusStyle, poLinesOf, poTotals, toNumber } from "../../domain/purchasing/helpers";
import { grnLinesOf, isPostedGrn } from "../../domain/receiving/helpers";
import { getPoLinkedDocuments } from "../../domain/procurement/document-links";

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

export default function PurchasingOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>(purchaseOrders);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"全部" | POStatus>("全部");
  const [selectedId, setSelectedId] = useState(purchaseOrders[0]?.po ?? "");
  const [newOpen, setNewOpen] = useState(false);
  const [trackOpen, setTrackOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

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

  const selectedPO = orders.find((o) => o.po === selectedId) ?? orders[0] ?? null;
  const selectedPOLines = poLinesOf(selectedPO);
  const selectedPOTotals = poTotals(selectedPO);
  const filtered = filter === "全部" ? orders : orders.filter((o) => o.status === filter);

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
  function downloadPDF(poId: string) {
    exportModulePdf(`采购订单 ${poId}`, "新辰智能制造");
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
    toast.success("CSV 已导出");
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

      {/* PO Table + Detail */}
      <div className="grid grid-cols-5 gap-3">
        <Card className="col-span-3">
          <div className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}>
            <Filter size={13} style={{ color: A.gray2 }} />
            <SegmentedControl
              options={(["全部", "待审批", "已审批", "已发出", "部分到货", "已完成"] as const).map((s) => ({ label: s, value: s }))}
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
              <Plus size={11} /> 新建 PO
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                  {["PO 编号", "供应商", "来源", "金额", "项目", "到货进度", "ETA", "状态"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((o, i) => {
                  const totals = poTotals(o);
                  const pct = totals.totalOrderedQty === 0 ? 0 : (totals.totalReceivedQty / totals.totalOrderedQty) * 100;
                  const isSel = selectedPO?.po === o.po;
                  return (
                    <tr key={o.po} onClick={() => setSelectedId(o.po)}
                      className="cursor-pointer transition-colors hover:bg-blue-50/40"
                      style={{
                        borderBottom: i < filtered.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none",
                        background: isSel ? "rgba(0,113,227,0.06)" : "transparent",
                      }}>
                      <td className="px-4 py-3 font-medium" style={{ color: A.blue }}>{o.po}</td>
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* PO Detail */}
        <Card className="col-span-2 p-5">
          {!selectedPO ? (
            <div className="py-16 text-center text-xs" style={{ color: A.gray2 }}>
              暂无采购订单。可从采购申请批准后转为 PO，或手工新建订单。
            </div>
          ) : (
            <>
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: A.gray2 }}>采购订单详情</div>
              <div className="text-base font-semibold tracking-tight" style={{ color: A.label }}>{selectedPO.po}</div>
            </div>
            <POStatusPill status={selectedPO.status} />
          </div>

          <div className="space-y-3 pb-4 mb-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
            {[
              { icon: Truck,    label: "供应商", value: selectedPO.supplier },
              { icon: User,     label: "负责人", value: selectedPO.owner    },
              { icon: Calendar, label: "下单 / ETA", value: `${selectedPO.created} → ${selectedPO.eta}` },
              { icon: Hash,     label: "明细行 / 数量", value: `${selectedPOTotals.lineCount} 行 / ${selectedPOTotals.totalOrderedQty.toLocaleString()} ${selectedPOLines[0]?.unit || ""}` },
              { icon: PackageCheck, label: "已收 / 合格", value: `${selectedPOTotals.totalReceivedQty.toLocaleString()} / ${selectedPOTotals.totalAcceptedQty.toLocaleString()}` },
              { icon: DollarSign, label: "订单金额", value: fmt(selectedPOTotals.totalAmount || selectedPO.amount) },
            ].map((row) => {
              const Icon = row.icon;
              return (
                <div key={row.label} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: A.gray6 }}>
                    <Icon size={11} style={{ color: A.gray1 }} />
                  </div>
                  <span className="text-[11px] w-20" style={{ color: A.gray1 }}>{row.label}</span>
                  <span className="text-xs font-medium ml-auto" style={{ color: A.label }}>{row.value}</span>
                </div>
              );
            })}
          </div>

          <div className="mb-4 pb-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: A.gray2 }}>PO Lines</div>
              <span className="text-[10px]" style={{ color: A.gray2 }}>
                items = 明细行数 · 数量看 totalOrderedQty
              </span>
            </div>
            <div className="space-y-2 max-h-72 overflow-auto pr-1">
              {selectedPOLines.map((line) => {
                const style = lineStatusStyle(line.status);
                return (
                  <div key={line.poLineId} className="rounded-xl p-3" style={{ background: A.gray6 }}>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[10px] font-semibold truncate" style={{ color: A.blue }}>{line.poLineId}</span>
                      <span className="text-[10px] px-1.5 py-px rounded-full font-medium shrink-0" style={{ color: style.color, background: style.bg }}>
                        {lineStatusLabel(line.status)}
                      </span>
                    </div>
                    <div className="text-xs font-semibold truncate" style={{ color: A.label }}>
                      {line.sku} · {line.itemName}
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 mt-2">
                      {[
                        ["订购", line.quantityOrdered],
                        ["已收", line.quantityReceived],
                        ["合格", line.quantityAccepted],
                        ["拒收", line.quantityRejected],
                      ].map(([label, value]) => (
                        <div key={label as string} className="rounded-lg px-2 py-1.5" style={{ background: A.white }}>
                          <div className="text-[9px]" style={{ color: A.gray2 }}>{label}</div>
                          <div className="text-[11px] font-semibold tabular-nums" style={{ color: A.label }}>
                            {Number(value).toLocaleString()} {line.unit}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-[10px]" style={{ color: A.sub }}>
                      <span>单价 {line.currency} {toNumber(line.unitPrice).toLocaleString()}</span>
                      <span className="text-right">仓库 {line.warehouseId || "MAIN"}</span>
                    </div>
                  </div>
                );
              })}
              {selectedPOLines.length === 0 && (
                <div className="rounded-xl p-4 text-center text-xs" style={{ background: A.gray6, color: A.gray2 }}>
                  该订单暂无明细行，已保留原有头信息展示。
                </div>
              )}
            </div>
          </div>

          {["forecast", "purchase-request", "rfq-award"].includes(selectedPO.source || "") && (
            <div className="rounded-xl p-3 mb-4" style={{ background: "#f0f6ff", border: "1px solid rgba(0,113,227,0.12)" }}>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold mb-2" style={{ color: A.blue }}>
                <Sparkles size={12} /> {selectedPO.source === "rfq-award" ? "RFQ 授标依据" : selectedPO.source === "purchase-request" ? "采购申请依据" : "预测生成依据"}
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                {[
                  ...(selectedPO.sourceRequest ? [["来源申请", selectedPO.sourceRequest]] : []),
                  ...(selectedPO.sourceRfq ? [["来源 RFQ", selectedPO.sourceRfq]] : []),
                  ["SKU", `${selectedPO.sourceSku || "—"} ${selectedPO.sourceName || ""}`],
                  ["建议数量", `${Number(selectedPO.recommendedQty || 0).toLocaleString()} ${selectedPO.unit || ""}`],
                  ["单价", selectedPO.unitPrice ? fmt(selectedPO.unitPrice) : "—"],
                  ["原因", selectedPO.reason || "预测净缺口触发"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div style={{ color: A.gray2 }}>{label}</div>
                    <div className="font-medium mt-0.5" style={{ color: A.label }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedPO.approvalSnapshot && (
            <div className="rounded-xl p-3 mb-4" style={{ background: A.gray6, border: "1px solid rgba(0,0,0,0.05)" }}>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold mb-2" style={{ color: A.label }}>
                <FileCheck2 size={12} /> 继承审批快照
              </div>
              <div className="text-xs font-semibold leading-5" style={{ color: A.label }}>
                {selectedPO.approvalSnapshot.summary || selectedPO.reason || "已继承采购申请审批依据"}
              </div>
              {selectedPO.approvalSnapshot.explanation && (
                <div className="text-[10px] leading-4 mt-1" style={{ color: A.sub }}>{selectedPO.approvalSnapshot.explanation}</div>
              )}
              <div className="grid grid-cols-2 gap-2 mt-2 text-[10px]">
                {[
                  ["来源", selectedPO.approvalSnapshot.source || selectedPO.source || "—"],
                  ["来源申请", selectedPO.sourceRequest || "—"],
                  ["供应商", String((selectedPO.approvalSnapshot.supplier as any)?.name || selectedPO.supplier || "—")],
                  ["快照时间", selectedPO.approvalSnapshot.createdAt ? new Date(selectedPO.approvalSnapshot.createdAt).toLocaleString("zh-CN") : "—"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div style={{ color: A.gray2 }}>{label}</div>
                    <div className="font-medium truncate" style={{ color: A.label }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DocumentHistoryPanel
            entityType="purchaseOrder"
            entityId={selectedPO.po}
            title="订单状态历史"
            refreshKey={selectedPO.lastAuditId || selectedPO.auditTrailIds?.join(",") || selectedPO.status}
          />

          {/* Timeline */}
          <div className="text-[10px] uppercase tracking-widest mb-3" style={{ color: A.gray2 }}>流程进度</div>
          <div className="space-y-3">
            {[
              { step: "创建",     done: true,                                                  date: selectedPO.created },
              { step: "审批",     done: !["草稿","待审批"].includes(selectedPO.status),         date: selectedPO.status === "待审批" ? "等待中" : "5月26日" },
              { step: "下发",     done: !["草稿","待审批","已审批"].includes(selectedPO.status), date: ["已发出","部分到货","已完成"].includes(selectedPO.status) ? "5月26日" : "—" },
              { step: "收货",     done: ["部分到货","已完成"].includes(selectedPO.status),       date: selectedPO.received > 0 ? "进行中" : "—" },
              { step: "对账付款", done: selectedPO.paid,                                       date: selectedPO.paid ? "已完成" : "—" },
            ].map((t, idx, arr) => (
              <div key={t.step} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: t.done ? A.green : A.gray5, color: A.white }}>
                    {t.done && <CheckCircle2 size={11} />}
                  </div>
                  {idx < arr.length - 1 && (
                    <div className="w-px h-5 mt-1" style={{ background: t.done ? A.green : A.gray5 }} />
                  )}
                </div>
                <div className="flex-1 -mt-0.5">
                  <div className="text-xs font-medium" style={{ color: t.done ? A.label : A.gray1 }}>{t.step}</div>
                  <div className="text-[10px]" style={{ color: A.gray2 }}>{t.date}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 mt-5">
            <button onClick={() => setDetailOpen(true)}
              className="flex-1 text-xs py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-1.5"
              style={{ background: A.gray6, color: A.blue }}>
              <Eye size={12} /> 查看详情
            </button>
            {selectedPO.status === "待审批" && (
              <>
                <button onClick={() => approve(selectedPO.po)}
                  className="flex-1 text-xs py-2 rounded-lg font-medium text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
                  style={{ background: A.green }}>
                  <Check size={12} /> 审批订单
                </button>
                <button onClick={() => reject(selectedPO.po)}
                  className="flex-1 text-xs py-2 rounded-lg font-medium" style={{ background: A.gray6, color: A.label }}>驳回</button>
              </>
            )}
            {selectedPO.status === "已审批" && (
              <button onClick={() => send(selectedPO.po)}
                className="flex-1 text-xs py-2 rounded-lg font-medium text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
                style={{ background: A.blue }}>
                <Send size={12} /> 下发至供应商
              </button>
            )}
            {(selectedPO.status === "已发出" || selectedPO.status === "部分到货" || selectedPO.status === "已完成") && (
              <button onClick={() => setTrackOpen(true)}
                className="flex-1 text-xs py-2 rounded-lg font-medium text-white hover:opacity-90 transition-opacity"
                style={{ background: A.blue }}>跟踪发货</button>
            )}
            <button onClick={() => downloadPDF(selectedPO.po)}
              className="flex-1 text-xs py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              style={{ background: A.gray6, color: A.label }}>下载 PDF</button>
            {!["已完成", "已取消"].includes(selectedPO.status) && (
              <button onClick={() => cancel(selectedPO.po)}
                className="text-xs px-3 py-2 rounded-lg font-medium hover:bg-red-50 transition-colors"
                style={{ background: A.white, color: A.red, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)" }}>
                <Trash2 size={11} />
              </button>
            )}
          </div>
            </>
          )}
        </Card>
      </div>

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
      <Modal open={detailOpen && Boolean(selectedPO)} onClose={() => setDetailOpen(false)} width={980}
        title="采购订单" subtitle="PO · ERP document form">
        {selectedPO && (
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
            <DocumentActionBar>
              <button onClick={() => setTrackOpen(true)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "#f0f6ff", color: A.blue }}>打开收货</button>
              <button onClick={() => toast("供应商发票位于采购工作台", { description: "请打开采购工作台的供应商发票 tab 查看关联发票。" })} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "#faf3ff", color: A.purple }}>打开供应商发票</button>
              <button onClick={() => exportPoDetail(selectedPO)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: A.white, color: A.blue, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)" }}>导出 CSV</button>
              <button onClick={() => setDetailOpen(false)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: A.white, color: A.label, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)" }}>关闭</button>
            </DocumentActionBar>
          </DocumentShell>
        )}
      </Modal>
      <TrackShipmentModal open={trackOpen} onClose={() => setTrackOpen(false)} po={selectedPO} />
    </div>
  );
}

// ─── Scan Receive Modal ─────────────────────────────────────────────────────
