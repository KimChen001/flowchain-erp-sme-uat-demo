import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle, Camera, Calendar, Check, CheckCircle2, Clock, DollarSign, Eye, FileCheck2,
  FileText, Filter, Hash, Lock, PackageCheck, Plus, Printer, Send, Sparkles, Trash2, Truck,
  User, X, XCircle,
} from "lucide-react";
import {
  Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { apiJson } from "../../lib/api-client";
import { fmt } from "../../lib/format";
import { procurementTrend, purchaseOrders } from "../../data/demo-data";
import type { POStatus, PurchaseOrder, ReceivingDoc, ReceivingDocLine } from "../../app/FlowChainApp";
import {
  A, AppleTooltip, Card, DocumentHistoryPanel, exportModulePdf, Field, inputStyle, KpiCard,
  lineStatusLabel, lineStatusStyle, Modal, NewPOModal, POStatusPill, SectionHeader,
  SegmentedControl, TrackShipmentModal,
} from "../../app/FlowChainApp";
import { lineRemaining, poLinesOf, poTotals, toNumber } from "../../domain/purchasing/helpers";
import { grnLinesOf, isPostedGrn } from "../../domain/receiving/helpers";

export default function PurchasingOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>(purchaseOrders);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"全部" | POStatus>("全部");
  const [selectedId, setSelectedId] = useState(purchaseOrders[0]?.po ?? "");
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
      toast.success(`${poId} 已批准`, { description: "已写入后端，刷新后仍会保留" });
    } catch (error) {
      toast.error("采购订单审批失败", { description: error instanceof Error ? error.message : "请确认 API 服务正在运行" });
    }
  }
  async function reject(poId: string) {
    try {
      await updatePOStatus(poId, "已驳回");
      toast.error(`${poId} 已驳回`, { description: "状态已保存到 API 数据源" });
    } catch (error) {
      toast.error("采购订单驳回失败", { description: error instanceof Error ? error.message : "请确认 API 服务正在运行" });
    }
  }
  async function cancel(poId: string) {
    if (!confirm(`确认取消 ${poId}？此操作不可撤销。`)) return;
    try {
      await updatePOStatus(poId, "已取消");
      toast(`${poId} 已取消`);
    } catch (error) {
      toast.error("采购订单取消失败", { description: error instanceof Error ? error.message : "请确认 API 服务正在运行" });
    }
  }
  async function send(poId: string) {
    try {
      await updatePOStatus(poId, "已发出");
      toast.success(`${poId} 已下发至供应商`, { description: "后端已记录状态变更" });
    } catch (error) {
      toast.error("采购订单下发失败", { description: error instanceof Error ? error.message : "请确认 API 服务正在运行" });
    }
  }
  function downloadPDF(poId: string) {
    exportModulePdf(`采购订单 ${poId}`, "新辰智能制造");
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
            {selectedPO.status === "待审批" && (
              <>
                <button onClick={() => approve(selectedPO.po)}
                  className="flex-1 text-xs py-2 rounded-lg font-medium text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
                  style={{ background: A.green }}>
                  <Check size={12} /> 批准订单
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
      <TrackShipmentModal open={trackOpen} onClose={() => setTrackOpen(false)} po={selectedPO} />
    </div>
  );
}

// ─── Scan Receive Modal ─────────────────────────────────────────────────────
export function ScanReceiveModal({ open, onClose, candidates, onReceive }: {
  open: boolean; onClose: () => void;
  candidates: PurchaseOrder[];
  onReceive: (grn: string, po: string, lines: ReceivingDocLine[]) => void | Promise<void>;
}) {
  const [scan, setScan] = useState("");
  const [scanning, setScanning] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const selectedPO = candidates.find((c) => c.po === scan);
  const openLines = poLinesOf(selectedPO).filter((line) => lineRemaining(line) > 0);
  const [lineDrafts, setLineDrafts] = useState<ReceivingDocLine[]>([]);

  useEffect(() => {
    if (!selectedPO) {
      setLineDrafts([]);
      return;
    }
    setLineDrafts(openLines.map((line) => {
      const remaining = lineRemaining(line);
      return {
        poLineId: line.poLineId,
        poId: selectedPO.po,
        sku: line.sku,
        itemName: line.itemName,
        receivedQty: remaining,
        acceptedQty: remaining,
        rejectedQty: 0,
        warehouseId: line.warehouseId || "MAIN",
        unit: line.unit,
      };
    }));
  }, [selectedPO?.po]);

  function simulateScan() {
    if (candidates.length === 0) {
      toast.error("暂无可收货 PO", { description: "请先在采购订单中把订单下发至供应商" });
      return;
    }
    setScanning(true);
    setTimeout(() => {
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      setScan(pick.po);
      setScanning(false);
    }, 900);
  }

  function updateLine(index: number, field: keyof ReceivingDocLine, value: string | number) {
    setLineDrafts((arr) => arr.map((line, i) => i === index ? { ...line, [field]: value } : line));
  }

  function validationMessage() {
    if (!selectedPO) return "PO 编号无效或不在可收货状态";
    if (lineDrafts.length === 0) return "该 PO 没有剩余可收货明细";
    for (const [index, line] of lineDrafts.entries()) {
      const received = toNumber(line.receivedQty);
      const accepted = toNumber(line.acceptedQty);
      const rejected = toNumber(line.rejectedQty);
      const sourceLine = openLines[index];
      if ([received, accepted, rejected].some((n) => n < 0)) return `${line.sku} 数量不能为负数`;
      if (accepted + rejected !== received) return `${line.sku} 合格 + 拒收必须等于本次收货`;
      if (received > lineRemaining(sourceLine)) return `${line.sku} 超过剩余可收货数量`;
    }
    return "";
  }

  async function confirm() {
    const po = candidates.find((c) => c.po === scan);
    if (!po) { toast.error("PO 编号无效或不在可收货状态"); return; }
    const error = validationMessage();
    if (error) { toast.error(error); return; }
    const grn = `GRN-202605-${String(424 + recent.length).padStart(4, "0")}`;
    await onReceive(grn, po.po, lineDrafts.map((line) => ({
      ...line,
      receivedQty: toNumber(line.receivedQty),
      acceptedQty: toNumber(line.acceptedQty),
      rejectedQty: toNumber(line.rejectedQty),
    })));
    setRecent([grn, ...recent].slice(0, 5));
    setScan("");
    toast.success(`${grn} 已创建`, { description: `${po.supplier} · ${lineDrafts.length} 行待质检` });
  }

  return (
    <Modal open={open} onClose={onClose} title="扫码收货" subtitle="扫描随车单据二维码，或手动输入 PO 编号">
      <div className="rounded-xl p-8 flex flex-col items-center"
        style={{ background: A.gray6, border: `1px dashed ${A.gray3}` }}>
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 relative overflow-hidden"
          style={{ background: A.white, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <Camera size={28} style={{ color: scanning ? A.blue : A.gray2 }} />
          {scanning && (
            <div className="absolute inset-x-0 h-0.5 animate-pulse"
              style={{ background: A.blue, top: "50%", boxShadow: `0 0 12px ${A.blue}` }} />
          )}
        </div>
        <button onClick={simulateScan} disabled={scanning}
          className="text-xs px-4 py-1.5 rounded-lg font-medium text-white"
          style={{ background: A.blue, opacity: scanning ? 0.6 : 1 }}>
          {scanning ? "扫描中…" : "模拟扫码"}
        </button>
        <span className="text-[10px] mt-2" style={{ color: A.gray2 }}>对准条码 5–10 cm</span>
      </div>

      <div className="mt-5">
        <Field label="PO 编号">
          <div className="flex gap-2">
            <input value={scan} onChange={(e) => setScan(e.target.value)}
              placeholder="PO-2026-xxxx" style={inputStyle} />
            <button onClick={confirm}
              className="text-xs px-4 rounded-lg font-medium text-white shrink-0"
              style={{ background: A.green }}>确认收货</button>
          </div>
        </Field>
      </div>

      {selectedPO && (
        <div className="mt-5">
          <div className="text-[11px] mb-2 font-medium" style={{ color: A.sub }}>本次收货明细</div>
          <div className="space-y-2 max-h-72 overflow-auto pr-1">
            {lineDrafts.map((line, index) => {
              const remaining = lineRemaining(openLines[index]);
              return (
                <div key={line.poLineId || `${line.sku}-${index}`} className="rounded-xl p-3" style={{ background: A.gray6 }}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold truncate" style={{ color: A.blue }}>{line.poLineId}</div>
                      <div className="text-xs font-medium truncate" style={{ color: A.label }}>{line.sku} · {line.itemName}</div>
                    </div>
                    <span className="text-[10px] shrink-0" style={{ color: A.gray2 }}>剩余 {remaining} {line.unit}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      ["receivedQty", "收货"],
                      ["acceptedQty", "合格"],
                      ["rejectedQty", "拒收"],
                    ].map(([field, label]) => (
                      <Field key={field} label={label}>
                        <input type="number" min={0}
                          value={String((line as any)[field] ?? 0)}
                          onChange={(e) => updateLine(index, field as keyof ReceivingDocLine, Number(e.target.value))}
                          style={inputStyle} />
                      </Field>
                    ))}
                    <Field label="仓库">
                      <input value={line.warehouseId || ""}
                        onChange={(e) => updateLine(index, "warehouseId", e.target.value)}
                        style={inputStyle} />
                    </Field>
                  </div>
                </div>
              );
            })}
            {lineDrafts.length === 0 && (
              <div className="rounded-xl p-4 text-center text-xs" style={{ background: A.gray6, color: A.gray2 }}>
                该 PO 没有剩余可收货明细。
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-5">
        <div className="text-[11px] mb-2 font-medium" style={{ color: A.sub }}>可收货 PO ({candidates.length})</div>
        <div className="space-y-1.5 max-h-40 overflow-auto">
          {candidates.map((p) => {
            const totals = poTotals(p);
            return (
              <button key={p.po} onClick={() => setScan(p.po)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors"
                style={{
                  background: scan === p.po ? "#f0f6ff" : A.gray6,
                  border: `1px solid ${scan === p.po ? A.blue + "40" : "transparent"}`,
                }}>
                <span className="font-medium" style={{ color: A.blue }}>{p.po}</span>
                <span style={{ color: A.label }}>{p.supplier}</span>
                <span style={{ color: A.sub }}>{totals.totalReceivedQty}/{totals.totalOrderedQty}</span>
              </button>
            );
          })}
        </div>
      </div>

      {recent.length > 0 && (
        <div className="mt-5 rounded-xl p-3" style={{ background: "#f0faf4" }}>
          <div className="text-[11px] font-medium mb-1.5" style={{ color: A.green }}>本次会话已创建</div>
          {recent.map((g) => (
            <div key={g} className="flex items-center gap-2 text-xs py-0.5" style={{ color: A.label }}>
              <CheckCircle2 size={11} style={{ color: A.green }} />
              {g}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ─── QC Inspection Modal ────────────────────────────────────────────────────
export function QCModal({ open, onClose, grn, onComplete }: {
  open: boolean; onClose: () => void;
  grn: ReceivingDoc | null;
  onComplete: (grnId: string, lines: ReceivingDocLine[], warehouse: string) => void;
}) {
  const [lineDrafts, setLineDrafts] = useState<ReceivingDocLine[]>([]);
  const [warehouse, setWarehouse] = useState("MAIN");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!grn) return;
    const lines = grnLinesOf(grn);
    setLineDrafts(lines.map((line) => ({
      ...line,
      acceptedQty: toNumber(line.acceptedQty, toNumber(line.receivedQty)),
      rejectedQty: toNumber(line.rejectedQty),
      warehouseId: line.warehouseId || grn.warehouse || "MAIN",
    })));
    setWarehouse(lines[0]?.warehouseId || grn.warehouse || "MAIN");
  }, [grn?.grn, grn?.status]);

  if (!grn) return null;
  const posted = isPostedGrn(grn);
  const totalReceived = lineDrafts.reduce((sum, line) => sum + toNumber(line.receivedQty), 0);
  const totalAccepted = lineDrafts.reduce((sum, line) => sum + toNumber(line.acceptedQty), 0);
  const totalRejected = lineDrafts.reduce((sum, line) => sum + toNumber(line.rejectedQty), 0);

  function updateLine(index: number, field: keyof ReceivingDocLine, value: string | number) {
    if (posted) return;
    setLineDrafts((arr) => arr.map((line, i) => i === index ? { ...line, [field]: value } : line));
  }

  function validationMessage() {
    for (const line of lineDrafts) {
      const received = toNumber(line.receivedQty);
      const accepted = toNumber(line.acceptedQty);
      const rejected = toNumber(line.rejectedQty);
      if ([received, accepted, rejected].some((n) => n < 0)) return `${line.sku} 数量不能为负数`;
      if (accepted > received) return `${line.sku} 合格数不能超过收货数`;
      if (rejected > received) return `${line.sku} 拒收数不能超过收货数`;
      if (accepted + rejected !== received) return `${line.sku} 合格 + 拒收必须等于本次收货`;
      if (!line.poLineId) return `${line.sku} 缺少 PO line 引用`;
    }
    return "";
  }

  function submit() {
    const error = validationMessage();
    if (error) { toast.error(error); return; }
    onComplete(grn.grn, lineDrafts.map((line) => ({
      ...line,
      receivedQty: toNumber(line.receivedQty),
      acceptedQty: toNumber(line.acceptedQty),
      rejectedQty: toNumber(line.rejectedQty),
      warehouseId: line.warehouseId || warehouse,
    })), warehouse);
    toast.success(`${grn.grn} 质检完成`, {
      description: `合格 ${totalAccepted} · 拒收 ${totalRejected} · 收货 ${totalReceived}`,
    });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} width={760}
      title={`质检 · ${grn.grn}`} subtitle={`${grn.supplier} · 关联 ${grn.po} · ${lineDrafts.length} 行明细`}
      footer={
        <>
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ background: A.white, color: A.label, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.1)" }}>
            {posted ? "关闭" : "稍后处理"}
          </button>
          {!posted && (
            <button onClick={submit}
              className="text-xs px-3 py-1.5 rounded-lg font-medium text-white flex items-center gap-1.5"
              style={{ background: A.blue }}>
              <FileCheck2 size={11} /> 完成质检并入库
            </button>
          )}
        </>
      }>
      {posted && (
        <div className="rounded-xl p-3 mb-4" style={{ background: "#fff8f0", border: "1px solid rgba(255,149,0,0.18)" }}>
          <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: A.orange }}>
            <Lock size={12} /> 已过账 GRN 只读
          </div>
          <div className="text-[11px] mt-1 leading-5" style={{ color: A.sub }}>
            已过账收货单不能直接修改数量、SKU、PO line 或仓库；后续需要正式冲销/退货流程。
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-xl p-3" style={{ background: A.gray6 }}>
          <div className="text-[10px]" style={{ color: A.gray1 }}>本次收货</div>
          <div className="text-xl font-semibold tabular-nums" style={{ color: A.label }}>{totalReceived}</div>
        </div>
        <div className="rounded-xl p-3" style={{ background: "#f0faf4" }}>
          <div className="text-[10px]" style={{ color: A.green }}>合格入库</div>
          <div className="text-xl font-semibold tabular-nums" style={{ color: A.green }}>{totalAccepted}</div>
        </div>
        <div className="rounded-xl p-3" style={{ background: "#fff1f0" }}>
          <div className="text-[10px]" style={{ color: A.red }}>拒收隔离</div>
          <div className="text-xl font-semibold tabular-nums" style={{ color: A.red }}>{totalRejected}</div>
        </div>
      </div>

      {(grn.postedAt || grn.postedBy || typeof grn.inventoryApplied === "boolean" || grn.inventoryMovementIds?.length) && (
        <div className="rounded-xl p-3 mb-4" style={{ background: A.gray6 }}>
          <div className="text-[11px] font-semibold mb-2" style={{ color: A.label }}>过账与库存应用</div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div><span style={{ color: A.gray2 }}>postedAt</span><div className="font-medium" style={{ color: A.label }}>{grn.postedAt ? new Date(grn.postedAt).toLocaleString("zh-CN") : "—"}</div></div>
            <div><span style={{ color: A.gray2 }}>postedBy</span><div className="font-medium" style={{ color: A.label }}>{grn.postedBy || "—"}</div></div>
            <div><span style={{ color: A.gray2 }}>inventoryApplied</span><div className="font-medium" style={{ color: grn.inventoryApplied ? A.green : A.gray1 }}>{grn.inventoryApplied ? "true" : "false"}</div></div>
            <div><span style={{ color: A.gray2 }}>movementIds</span><div className="font-medium truncate" style={{ color: A.blue }}>{grn.inventoryMovementIds?.join(", ") || "—"}</div></div>
          </div>
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ border: `0.5px solid ${A.gray4}` }}>
        <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_1fr] gap-2 px-3 py-2 text-[10px] font-medium" style={{ color: A.gray1, background: A.gray6 }}>
          <span>PO Line / SKU</span><span>收货</span><span>合格</span><span>拒收</span><span>仓库</span>
        </div>
        <div className="max-h-72 overflow-auto">
          {lineDrafts.map((line, index) => (
            <div key={line.grnLineId || line.poLineId || index}
              className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_1fr] gap-2 px-3 py-2.5 text-xs items-center"
              style={{ borderTop: index > 0 ? "0.5px solid rgba(0,0,0,0.05)" : "none" }}>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold truncate" style={{ color: A.blue }}>{line.poLineId || "legacy-match-by-sku"}</div>
                <div className="font-medium truncate" style={{ color: A.label }}>{line.sku} · {line.itemName}</div>
              </div>
              {(["receivedQty", "acceptedQty", "rejectedQty"] as const).map((field) => (
                <input key={field} type="number" min={0} disabled={posted}
                  value={String(line[field] ?? 0)}
                  onChange={(e) => updateLine(index, field, Number(e.target.value))}
                  style={{ ...inputStyle, height: 32, color: posted ? A.gray1 : A.label }} />
              ))}
              <input disabled={posted} value={line.warehouseId || ""}
                onChange={(e) => updateLine(index, "warehouseId", e.target.value)}
                style={{ ...inputStyle, height: 32, color: posted ? A.gray1 : A.label }} />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-5">
        <Field label="默认入库库区">
          <input value={warehouse} disabled={posted}
            onChange={(e) => setWarehouse(e.target.value)}
            style={{ ...inputStyle, color: posted ? A.gray1 : A.label }} />
        </Field>
        <Field label="质检员">
          <input value={grn.receiver || "刘建华"} disabled style={{ ...inputStyle, color: A.sub }} />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="备注（异常说明）">
          <textarea value={notes} disabled={posted}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={posted ? "已过账记录只读" : "可记录拒收、短装、破损、让步接收原因"}
            style={{ ...inputStyle, minHeight: 72, resize: "vertical", color: posted ? A.gray1 : A.label }} />
        </Field>
      </div>
    </Modal>
  );
}

function LegacyQCModal({ open, onClose, grn, onComplete }: {
  open: boolean; onClose: () => void;
  grn: ReceivingDoc | null;
  onComplete: (grnId: string, passed: number, failed: number, warehouse: string) => void;
}) {
  const [results, setResults] = useState<("pass" | "fail" | null)[]>([]);
  const [warehouse, setWarehouse] = useState("A 区");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (grn) setResults(Array(grn.items).fill(null));
  }, [grn?.grn]);

  if (!grn) return null;
  const passed = results.filter((r) => r === "pass").length;
  const failed = results.filter((r) => r === "fail").length;
  const remaining = results.filter((r) => r === null).length;
  const allDone = remaining === 0;

  function setAll(v: "pass" | "fail") { setResults(results.map(() => v)); }
  function setOne(i: number, v: "pass" | "fail") {
    setResults(results.map((r, idx) => idx === i ? v : r));
  }
  function submit() {
    if (!allDone) { toast.error(`还有 ${remaining} 项未检验`); return; }
    onComplete(grn.grn, passed, failed, warehouse);
    toast.success(`${grn.grn} 质检完成`, {
      description: `合格 ${passed} · 不合格 ${failed} · 入库 ${warehouse}`,
    });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} width={640}
      title={`质检 · ${grn.grn}`} subtitle={`${grn.supplier} · 关联 ${grn.po} · ${grn.items} 行明细`}
      footer={
        <>
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ background: A.white, color: A.label, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.1)" }}>稍后处理</button>
          <button onClick={submit} disabled={!allDone}
            className="text-xs px-3 py-1.5 rounded-lg font-medium text-white flex items-center gap-1.5"
            style={{ background: A.blue, opacity: allDone ? 1 : 0.5 }}>
            <FileCheck2 size={11} /> 完成质检并入库
          </button>
        </>
      }>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-xl p-3" style={{ background: "#f0faf4" }}>
          <div className="text-[10px]" style={{ color: A.green }}>合格</div>
          <div className="text-xl font-semibold tabular-nums" style={{ color: A.green }}>{passed}</div>
        </div>
        <div className="rounded-xl p-3" style={{ background: "#fff1f0" }}>
          <div className="text-[10px]" style={{ color: A.red }}>不合格</div>
          <div className="text-xl font-semibold tabular-nums" style={{ color: A.red }}>{failed}</div>
        </div>
        <div className="rounded-xl p-3" style={{ background: A.gray6 }}>
          <div className="text-[10px]" style={{ color: A.gray1 }}>待检</div>
          <div className="text-xl font-semibold tabular-nums" style={{ color: A.label }}>{remaining}</div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold" style={{ color: A.label }}>明细检验</span>
        <div className="flex gap-1.5">
          <button onClick={() => setAll("pass")}
            className="text-[11px] px-2 py-1 rounded-md font-medium" style={{ background: "#f0faf4", color: A.green }}>全部合格</button>
          <button onClick={() => setAll("fail")}
            className="text-[11px] px-2 py-1 rounded-md font-medium" style={{ background: "#fff1f0", color: A.red }}>全部不合格</button>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden max-h-64 overflow-y-auto" style={{ border: `0.5px solid ${A.gray4}` }}>
        {results.map((r, i) => (
          <div key={i} className="flex items-center px-3 py-2.5 text-xs"
            style={{ borderTop: i > 0 ? "0.5px solid rgba(0,0,0,0.05)" : "none" }}>
            <span className="w-6 text-center tabular-nums" style={{ color: A.gray2 }}>{i + 1}</span>
            <span className="flex-1 font-medium" style={{ color: A.label }}>
              批次 LOT-{String(2412001 + i).slice(-6)} · 数量 {Math.round(50 + Math.random() * 100)}
            </span>
            <div className="flex gap-1">
              <button onClick={() => setOne(i, "pass")}
                className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
                style={{
                  background: r === "pass" ? A.green : A.gray6,
                  color: r === "pass" ? A.white : A.gray2,
                }}>
                <Check size={12} />
              </button>
              <button onClick={() => setOne(i, "fail")}
                className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
                style={{
                  background: r === "fail" ? A.red : A.gray6,
                  color: r === "fail" ? A.white : A.gray2,
                }}>
                <X size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 mt-5">
        <Field label="入库库区">
          <select value={warehouse} onChange={(e) => setWarehouse(e.target.value)} style={inputStyle}>
            {["A 区", "B 区", "C 区", "D 区"].map((w) => <option key={w}>{w}</option>)}
          </select>
        </Field>
        <Field label="质检员">
          <input value={grn.receiver || "刘建华"} disabled style={{ ...inputStyle, color: A.sub }} />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="备注（异常说明）">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="如有不合格项，请说明原因（外观破损 / 数量不符 / 测试不通过…）"
            rows={2} style={{ ...inputStyle, resize: "none", fontFamily: "inherit" }} />
        </Field>
      </div>
    </Modal>
  );
}

// ─── Purchasing · RFQ ─────────────────────────────────────────────────────────
