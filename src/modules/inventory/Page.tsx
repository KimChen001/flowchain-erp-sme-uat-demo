import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Activity, AlertCircle, AlertTriangle, ArrowLeftRight, ArrowRight, Boxes, CheckCircle2,
  ClipboardCheck, Clock, FileSpreadsheet, Grid3x3, Hash, History, Inbox, Layers,
  Loader2, Package, Plus, Search, ShieldCheck, Truck, X, XCircle,
} from "lucide-react";
import { apiJson } from "../../lib/api-client";
import { exportRowsToCsv } from "../../lib/data-export";
import { fmt } from "../../lib/format";
import { toNumber } from "../../domain/purchasing/helpers";
import { inventoryPlan } from "../../domain/inventory/planning";
import { inventoryPurchaseRequestPayload } from "../../domain/inventory/purchase-request";
import type { PurchaseRequest } from "../../types/scm";
import {
  COUNT_PLANS, inventoryItems, LOTS, MOVEMENTS, SERIALS, SKU_CATALOG, supplierData, TRANSFERS, VARIANCES,
} from "../../data/demo-data";
import {
  A, AppleTooltip, Card, Chip, Field, inputStyle, KpiCard, Modal, SectionHeader, SegmentedControl, SubTabs,
} from "../../components/ui";

function supplierRecommendation(name: string) {
  const supplier = supplierData.find((item) => item.name === name);
  if (!supplier) {
    return {
      score: 68,
      grade: "\u5f85\u8bc4\u4f30",
      note: "\u7f3a\u5c11\u5b8c\u6574\u4f9b\u5e94\u5546\u7ee9\u6548\uff0c\u5efa\u8bae\u8865\u5145\u51c6\u65f6\u7387\u3001\u8d28\u91cf\u5408\u683c\u7387\u548c\u62a5\u4ef7\u8bb0\u5f55\u540e\u518d\u81ea\u52a8\u63a8\u8350\u3002",
      color: A.orange,
    };
  }
  const gradeScore = supplier.grade === "S" ? 100 : supplier.grade === "A" ? 88 : supplier.grade === "B" ? 72 : 60;
  const trendScore = supplier.trend === "up" ? 5 : supplier.trend === "down" ? -8 : 0;
  const score = Math.round(supplier.ontime * 0.38 + supplier.quality * 0.42 + gradeScore * 0.16 + trendScore);
  const color = score >= 92 ? A.green : score >= 84 ? A.blue : score >= 74 ? A.orange : A.red;
  const grade = score >= 92 ? "\u4f18\u5148\u63a8\u8350" : score >= 84 ? "\u53ef\u63a8\u8350" : score >= 74 ? "\u9700\u590d\u6838" : "\u9ad8\u98ce\u9669";
  return {
    score,
    grade,
    color,
    note: `\u51c6\u65f6\u7387 ${supplier.ontime}% \u00b7 \u8d28\u91cf ${supplier.quality}% \u00b7 ${supplier.grade} \u7ea7\u4f9b\u5e94\u5546 \u00b7 ${supplier.trend === "up" ? "\u8d8b\u52bf\u6539\u5584" : supplier.trend === "down" ? "\u8d8b\u52bf\u4e0b\u6ed1" : "\u8d8b\u52bf\u7a33\u5b9a"}`,
  };
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    "\u6b63\u5e38":   { color: A.green,  bg: "#f0faf4" },
    "\u9884\u8b66":   { color: A.orange, bg: "#fff8f0" },
    "\u4e0d\u8db3":   { color: A.red,    bg: "#fff1f0" },
    "\u5173\u6ce8":   { color: A.orange, bg: "#fff8f0" },
  };
  const m = map[status] || { color: A.gray1, bg: A.gray6 };
  return (
    <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ color: m.color, background: m.bg }}>
      {status}
    </span>
  );
}

function exportCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    toast.warning("暂无可导出的数据");
    return;
  }
  exportRowsToCsv(filename, rows);
  toast.success("CSV 已导出");
}

function InventoryOverview() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("全部");
  const [generatedRequests, setGeneratedRequests] = useState<Record<string, string>>({});
  const plannedItems = inventoryItems.map((item) => ({ ...item, plan: inventoryPlan(item) }));
  const filtered = plannedItems.filter((i) => {
    const matchSearch = i.name.includes(search) || i.sku.includes(search);
    const matchStatus = filterStatus === "全部" || i.status === filterStatus;
    return matchSearch && matchStatus;
  });
  const shortageItems = plannedItems.filter((i) => i.plan.suggestedQty > 0);
  const highPriority = shortageItems.filter((i) => i.plan.priority === "高").length;
  const replenishmentAmount = shortageItems.reduce((sum, item) => sum + item.plan.amount, 0);
  const avgTurnover = inventoryItems.reduce((sum, item) => sum + item.turnover, 0) / inventoryItems.length;
  const weightedCoverage = plannedItems.reduce((sum, item) => sum + item.plan.daysCover * Math.max(item.plan.monthlyDemand, 1), 0) /
    plannedItems.reduce((sum, item) => sum + Math.max(item.plan.monthlyDemand, 1), 0);

  async function createInventoryRequest(item: typeof plannedItems[number]) {
    if (item.plan.suggestedQty <= 0) {
      toast("当前无需生成 PR", { description: `${item.sku} 仍高于再订货点，建议继续监控。` });
      return;
    }
    if (item.plan.needsSourcing) {
      toast("请先补齐供应商与报价", { description: `${item.sku} 已低于 ROP，但缺少有效供应商或单价，建议先发起 RFQ。` });
      return;
    }
    if (generatedRequests[item.sku]) {
      toast("已生成库存 PR", { description: `${generatedRequests[item.sku]} 已在采购申请队列中。` });
      return;
    }
    try {
      const created = await apiJson<PurchaseRequest>("/api/purchase-requests", {
        method: "POST",
        body: JSON.stringify(inventoryPurchaseRequestPayload(item)),
      });
      setGeneratedRequests((current) => ({ ...current, [item.sku]: created.pr }));
      toast.success(`${created.pr} 已生成`, { description: `${item.sku} · ${item.plan.suggestedQty.toLocaleString()} ${item.plan.unit}` });
    } catch (error) {
      toast.error("库存 PR 生成失败", { description: error instanceof Error ? error.message : "请确认 API 服务正在运行" });
    }
  }

  function exportStockCsv() {
    exportCsv("inventory-stock-export.csv", filtered.map((item) => ({
      "SKU": item.sku,
      "品名": item.name,
      "品类": item.category,
      "库位": item.location,
      "当前库存": item.qty,
      "可用库存": item.plan.projectedAvailable,
      "安全库存": item.min,
      "最大库存": item.max,
      "月需求": item.plan.monthlyDemand,
      "提前期天数": item.plan.leadTimeDays,
      "覆盖天数": item.plan.daysCover,
      "ROP": item.plan.reorderPoint,
      "建议补货量": item.plan.suggestedQty,
      "单位": item.plan.unit,
      "补货策略": item.plan.policy,
      "供应商": item.plan.supplier,
      "状态": item.status,
      "是否需要询价": item.plan.needsSourcing ? "是" : "否",
      "建议PR金额": item.plan.amount,
      "已生成PR": generatedRequests[item.sku] || "",
    })));
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="SKU 总数" value={String(inventoryItems.length)} sub="库存控制台" icon={Package} color={A.blue} />
        <KpiCard label="需补货 SKU" value={String(shortageItems.length)} sub={`${highPriority} 个高优先级`} delta="按 ROP 计算" positive={false} icon={XCircle} color={A.red} />
        <KpiCard label="建议 PR 金额" value={fmt(replenishmentAmount)} sub="MOQ/批量修正后" icon={ClipboardCheck} color={A.orange} />
        <KpiCard label="加权覆盖天数" value={`${weightedCoverage.toFixed(0)}天`} sub={`周转 ${avgTurnover.toFixed(1)}x`} positive icon={Activity} color={A.green} />
      </div>

      <Card className="p-5">
        <SectionHeader title="库存补货控制台" right={
          <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: "#fff8f0", color: A.orange }}>
            ROP + MOQ + 在途/分配
          </span>
        } />
        <div className="grid grid-cols-4 gap-3">
          {shortageItems.slice(0, 4).map((item) => {
            const score = supplierRecommendation(item.plan.supplier);
            return (
              <div key={item.sku} className="p-3 rounded-lg" style={{ background: A.gray6, border: "0.5px solid rgba(0,0,0,0.06)" }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-semibold tabular-nums" style={{ color: A.blue }}>{item.sku}</div>
                  <Chip label={item.plan.priority} color={item.plan.priority === "高" ? A.red : item.plan.priority === "中" ? A.orange : A.green} bg={item.plan.priority === "高" ? "#fff1f0" : item.plan.priority === "中" ? "#fff8f0" : "#f0faf4"} />
                </div>
                <div className="text-xs font-medium mt-1 truncate" style={{ color: A.label }}>{item.name}</div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-[10px]">
                  <div><div style={{ color: A.gray2 }}>覆盖</div><div className="font-semibold" style={{ color: item.plan.daysCover <= item.plan.leadTimeDays ? A.red : A.label }}>{item.plan.daysCover}天</div></div>
                  <div><div style={{ color: A.gray2 }}>ROP</div><div className="font-semibold" style={{ color: A.label }}>{item.plan.reorderPoint}</div></div>
                  <div><div style={{ color: A.gray2 }}>建议</div><div className="font-semibold" style={{ color: A.label }}>{item.plan.suggestedQty}</div></div>
                </div>
                <div className="text-[10px] mt-2 leading-relaxed" style={{ color: A.sub }}>
                  {item.plan.supplier} · 评分 {score.score} · {item.plan.policy}
                </div>
                <button onClick={() => createInventoryRequest(item)}
                  className="mt-3 w-full text-[11px] px-2.5 py-1.5 rounded-md font-medium text-white flex items-center justify-center gap-1.5"
                  style={{ background: generatedRequests[item.sku] ? A.green : A.blue }}>
                  <ClipboardCheck size={11} />
                  {generatedRequests[item.sku] ? generatedRequests[item.sku] : item.plan.action}
                </button>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Category health bars */}
      <Card className="p-5">
        <SectionHeader title="品类库存健康分布" />
        <div className="space-y-3">
          {[
            { cat: "机械部件", normal: 2980, warn: 180, low: 81 },
            { cat: "电气元件", normal: 289,  warn: 71,  low: 52 },
            { cat: "原材料",   normal: 1580, warn: 148, low: 92 },
            { cat: "耗材",     normal: 2100, warn: 32,  low: 8  },
            { cat: "标准件",   normal: 780,  warn: 16,  low: 3  },
          ].map((row) => {
            const total = row.normal + row.warn + row.low;
            return (
              <div key={row.cat} className="flex items-center gap-4">
                <span className="text-xs w-20 shrink-0" style={{ color: A.sub }}>{row.cat}</span>
                <div className="flex-1 h-5 rounded-lg overflow-hidden flex" style={{ background: A.gray5 }}>
                  <div style={{ width: `${(row.normal / total) * 100}%`, background: A.green }} />
                  <div style={{ width: `${(row.warn / total) * 100}%`, background: A.orange }} />
                  <div style={{ width: `${(row.low / total) * 100}%`, background: A.red }} />
                </div>
                <div className="flex items-center gap-3 text-[11px] w-52 shrink-0" style={{ color: A.gray1 }}>
                  <span className="text-green-500">{row.normal}</span>
                  <span style={{ color: A.orange }}>{row.warn}</span>
                  <span style={{ color: A.red }}>{row.low}</span>
                  <span style={{ color: A.gray2 }}>/ {total.toLocaleString()} SKU</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-5 mt-3 text-[11px]" style={{ color: A.gray2 }}>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: A.green }} />正常</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: A.orange }} />预警</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: A.red }} />不足</span>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <div className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}>
          <Search size={13} style={{ color: A.gray2 }} />
          <input
            className="flex-1 text-sm outline-none bg-transparent"
            placeholder="搜索 SKU 或品名…"
            style={{ color: A.label }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <SegmentedControl
            options={["全部", "正常", "预警", "不足"].map((s) => ({ label: s, value: s }))}
            value={filterStatus}
            onChange={setFilterStatus}
          />
          <span className="text-xs ml-1" style={{ color: A.gray2 }}>{filtered.length}</span>
          <button onClick={exportStockCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all hover:opacity-90"
            style={{ background: A.gray6, color: A.blue }}>
            <FileSpreadsheet size={13} /> 导出 CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                {["SKU", "品名", "库存/可用", "安全线", "覆盖", "ROP", "建议量", "策略", "供应商", "状态", "动作"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => {
                const pct = Math.min((item.qty / item.max) * 100, 100);
                return (
                  <tr key={item.sku}
                    className="transition-colors hover:bg-blue-50/40"
                    style={{ borderBottom: i < filtered.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                    <td className="px-4 py-3 font-medium" style={{ color: A.blue }}>{item.sku}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color: A.label }}>{item.name}</div>
                      <div className="text-[10px]" style={{ color: A.sub }}>{item.category} · {item.location}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color: A.label }}>{item.qty.toLocaleString()}</div>
                      <div className="text-[10px]" style={{ color: A.sub }}>可用 {item.plan.projectedAvailable.toLocaleString()} {item.plan.unit}</div>
                    </td>
                    <td className="px-4 py-3" style={{ color: A.gray1 }}>{item.min.toLocaleString()}</td>
                    <td className="px-4 py-3 w-28">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: A.gray5 }}>
                          <div className="h-full rounded-full"
                            style={{ width: `${pct}%`, background: pct < 30 ? A.red : pct < 60 ? A.orange : A.green }} />
                        </div>
                        <span className="w-10 text-right text-[11px]" style={{ color: item.plan.daysCover <= item.plan.leadTimeDays ? A.red : A.gray1 }}>{item.plan.daysCover}天</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: A.label }}>{item.plan.reorderPoint.toLocaleString()}</td>
                    <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: item.plan.suggestedQty > 0 ? A.orange : A.gray2 }}>
                      {item.plan.suggestedQty > 0 ? `${item.plan.suggestedQty.toLocaleString()} ${item.plan.unit}` : "—"}
                    </td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{item.plan.policy}</td>
                    <td className="px-4 py-3" style={{ color: A.label }}>{item.plan.supplier}</td>
                    <td className="px-4 py-3"><StatusPill status={item.status} /></td>
                    <td className="px-4 py-3">
                      <button onClick={() => createInventoryRequest(item)}
                        disabled={item.plan.suggestedQty <= 0}
                        className="text-[11px] px-2 py-1 rounded-md font-medium"
                        style={{
                          background: item.plan.suggestedQty > 0 ? (generatedRequests[item.sku] ? "#f0faf4" : item.plan.needsSourcing ? "#fff8f0" : A.gray6) : A.gray6,
                          color: item.plan.suggestedQty > 0 ? (generatedRequests[item.sku] ? A.green : item.plan.needsSourcing ? A.orange : A.label) : A.gray2,
                        }}>
                        {generatedRequests[item.sku] ? generatedRequests[item.sku] : item.plan.suggestedQty > 0 ? item.plan.needsSourcing ? "补报价" : "生成 PR" : "监控"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Inventory · Lots & Serials ────────────────────────────────────────────────


function InventoryLots() {
  const [tab, setTab] = useState<"lot" | "sn">("lot");
  const [filter, setFilter] = useState<"全部" | "可用" | "冻结" | "近效期" | "已分配">("全部");
  const lots = filter === "全部" ? LOTS : LOTS.filter((l) => l.status === filter);
  const serials = filter === "全部" || filter === "近效期" ? SERIALS : SERIALS.filter((s) => s.status === filter);

  function pillColor(s: string) {
    return s === "可用" || s === "在库" ? A.green
      : s === "近效期" || s === "维修" ? A.orange
      : s === "冻结" ? A.red
      : A.blue;
  }
  function pillBg(s: string) {
    return s === "可用" || s === "在库" ? "#f0faf4"
      : s === "近效期" || s === "维修" ? "#fff8f0"
      : s === "冻结" ? "#fff1f0"
      : "#f0f6ff";
  }

  function exportLotsCsv() {
    if (tab === "lot") {
      exportCsv("inventory-lots-export.csv", lots.map((lot) => ({
        "批次号": lot.lot,
        "SKU": lot.sku,
        "品名": lot.name,
        "数量": lot.qty,
        "供应商": lot.supplier,
        "入库日": lot.received,
        "效期": lot.expiry,
        "库位": lot.warehouse,
        "COA": lot.coa ? "有" : "无",
        "状态": lot.status,
      })));
      return;
    }
    exportCsv("inventory-serials-export.csv", serials.map((serial) => ({
      "序列号": serial.sn,
      "SKU": serial.sku,
      "所属批次": serial.lot,
      "状态": serial.status,
      "当前库位": serial.warehouse,
      "入库日": serial.received,
    })));
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="活跃批次"   value={String(LOTS.length)}  sub="跨 5 个库区"                icon={Layers}      color={A.blue}   />
        <KpiCard label="序列号库存" value={SERIALS.length + " 件"} sub="高值件全程追溯"             icon={Hash}        color={A.purple} />
        <KpiCard label="近效期批次" value="1"                    sub="≤ 90 天到期" delta="预警"     positive={false} icon={Clock}       color={A.orange} />
        <KpiCard label="冻结批次"   value="1"                    sub="质量复检中"                  icon={ShieldCheck} color={A.red}    />
      </div>

      <Card>
        <div className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}>
          <SegmentedControl
            options={[{ label: "批次 (Lot)", value: "lot" }, { label: "序列号 (S/N)", value: "sn" }]}
            value={tab} onChange={(v) => setTab(v as any)} />
          <SegmentedControl
            options={["全部", "可用", "冻结", "近效期"].map((s) => ({ label: s, value: s }))}
            value={filter} onChange={(v) => setFilter(v as any)} />
          <span className="text-xs ml-auto" style={{ color: A.gray2 }}>{tab === "lot" ? lots.length : serials.length} 条</span>
          <button onClick={exportLotsCsv}
            className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md font-medium" style={{ background: A.gray6, color: A.blue }}>
            <FileSpreadsheet size={11} /> 导出 CSV
          </button>
          <button onClick={() => toast("批次冻结提交 QA")}
            className="text-[11px] px-2.5 py-1 rounded-md font-medium text-white" style={{ background: A.blue }}>冻结批次</button>
        </div>
        <div className="overflow-x-auto">
          {tab === "lot" ? (
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                  {["批次号", "SKU", "品名", "数量", "供应商", "入库日", "效期", "库位", "COA", "状态", "操作"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lots.map((l, i) => (
                  <tr key={l.lot} className="hover:bg-blue-50/40 transition-colors"
                    style={{ borderBottom: i < lots.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                    <td className="px-4 py-3 font-medium tabular-nums" style={{ color: A.indigo }}>{l.lot}</td>
                    <td className="px-4 py-3" style={{ color: A.blue }}>{l.sku}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: A.label }}>{l.name}</td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: A.label }}>{l.qty.toLocaleString()}</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{l.supplier}</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{l.received}</td>
                    <td className="px-4 py-3" style={{ color: l.expiry !== "—" ? A.orange : A.gray3 }}>{l.expiry}</td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: A.label }}>{l.warehouse}</td>
                    <td className="px-4 py-3">
                      {l.coa ? <CheckCircle2 size={12} style={{ color: A.green }} /> : <X size={12} style={{ color: A.red }} />}
                    </td>
                    <td className="px-4 py-3"><Chip label={l.status} color={pillColor(l.status)} bg={pillBg(l.status)} /></td>
                    <td className="px-4 py-3">
                      <button onClick={() => toast(`批次 ${l.lot}`, { description: "追溯链：供应商→GRN→质检→入库→消耗" })}
                        className="text-[11px] px-2 py-1 rounded-md font-medium" style={{ background: A.gray6, color: A.label }}>追溯</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                  {["S/N", "SKU", "所属批次", "状态", "当前库位", "入库日", "操作"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {serials.map((s, i) => (
                  <tr key={s.sn} className="hover:bg-blue-50/40 transition-colors"
                    style={{ borderBottom: i < serials.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                    <td className="px-4 py-3 font-medium tabular-nums" style={{ color: A.purple }}>{s.sn}</td>
                    <td className="px-4 py-3" style={{ color: A.blue }}>{s.sku}</td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: A.indigo }}>{s.lot}</td>
                    <td className="px-4 py-3"><Chip label={s.status} color={pillColor(s.status)} bg={pillBg(s.status)} /></td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: A.label }}>{s.warehouse}</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{s.received}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => toast(`${s.sn} 全生命周期`, { description: "采购→入库→分配→出库→保修" })}
                        className="text-[11px] px-2 py-1 rounded-md font-medium" style={{ background: A.gray6, color: A.label }}>查看历史</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <SectionHeader title="近效期预警 (FEFO 策略)" />
        <div className="space-y-2">
          {LOTS.filter((l) => l.expiry !== "—").map((l) => {
            const isWarn = l.status === "近效期";
            return (
              <div key={l.lot} className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: isWarn ? "#fff8f0" : A.gray6 }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: isWarn ? `${A.orange}18` : `${A.green}18` }}>
                  <Clock size={13} style={{ color: isWarn ? A.orange : A.green }} />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-medium" style={{ color: A.label }}>{l.name} · {l.lot}</div>
                  <div className="text-[11px]" style={{ color: A.sub }}>剩余 {l.qty} · 效期 {l.expiry} · {l.warehouse}</div>
                </div>
                <button onClick={() => toast.success(`已生成 ${l.lot} 优先出库建议`)}
                  className="text-[11px] px-3 py-1.5 rounded-md font-medium" style={{ background: A.white, color: A.label, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)" }}>
                  生成出库建议
                </button>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ─── Inventory · Stock Transfer ────────────────────────────────────────────

function InventoryTransfers() {
  const [list, setList] = useState(TRANSFERS);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ from: "上海总仓", to: "苏州分仓", sku: SKU_CATALOG[0].sku, qty: 10 });

  function statusColor(s: string) {
    return s === "已签收" ? A.green : s === "在途" || s === "已发出" ? A.blue : s === "待审批" ? A.orange : A.gray1;
  }

  function approve(id: string) {
    setList((arr) => arr.map((t) => t.id === id ? { ...t, status: "已发出" } : t));
    toast.success(`${id} 已批准并下发 WMS`);
  }
  function receive(id: string) {
    setList((arr) => arr.map((t) => t.id === id ? { ...t, status: "已签收" } : t));
    toast.success(`${id} 已签收`, { description: "调入库存已更新" });
  }
  function createTransfer() {
    const item = SKU_CATALOG.find((s) => s.sku === form.sku)!;
    const id = `TR-260527-${String(Math.floor(Math.random() * 99)).padStart(3, "0")}`;
    setList((arr) => [{
      id, from: form.from, to: form.to, sku: form.sku, name: item.name,
      qty: form.qty, status: "待审批", created: "5月27日", eta: "5月30日",
      requester: "张磊", carrier: "—",
    }, ...arr]);
    setCreateOpen(false);
    toast.success(`${id} 调拨单已创建`, { description: `${form.from} → ${form.to} · ${form.qty} ${item.unit}` });
  }

  function exportTransfersCsv() {
    exportCsv("inventory-transfers-export.csv", list.map((transfer) => ({
      "调拨号": transfer.id,
      "源仓库": transfer.from,
      "目标仓库": transfer.to,
      "SKU": transfer.sku,
      "品名": transfer.name,
      "数量": transfer.qty,
      "申请人": transfer.requester,
      "承运商": transfer.carrier,
      "创建日期": transfer.created,
      "ETA": transfer.eta,
      "状态": transfer.status,
    })));
  }

  const onTransit = list.filter((t) => t.status === "在途" || t.status === "已发出").length;
  const pending = list.filter((t) => t.status === "待审批").length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="本月调拨" value={String(list.length)} sub="跨 4 个仓"     icon={ArrowLeftRight} color={A.blue}   />
        <KpiCard label="在途数量" value={String(onTransit)}   sub="平均时长 1.8 天"  icon={Truck}          color={A.teal}   />
        <KpiCard label="待审批"   value={String(pending)}      sub="平均 2.4 小时" delta={pending > 0 ? "需处理" : "无"} positive={pending === 0} icon={AlertCircle} color={A.orange} />
        <KpiCard label="调拨准时率" value="96.8%"               sub="同比 +2.1pts"   delta="+2.1pts" positive icon={Activity}     color={A.green}  />
      </div>

      <Card>
        <div className="flex items-center px-5 py-3.5 gap-3" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>仓间调拨单</h2>
          <span className="text-xs" style={{ color: A.gray2 }}>{list.length} 条</span>
          <button onClick={exportTransfersCsv}
            className="ml-auto flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md font-medium hover:opacity-90 transition-opacity"
            style={{ background: A.gray6, color: A.blue }}>
            <FileSpreadsheet size={11} /> 导出 CSV
          </button>
          <button onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md font-medium text-white hover:opacity-90 transition-opacity"
            style={{ background: A.blue }}>
            <Plus size={11} /> 新建调拨单
          </button>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["调拨号", "源仓 → 目标仓", "SKU / 品名", "数量", "申请人", "承运商", "创建", "ETA", "状态", "操作"].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((t, i) => (
              <tr key={t.id} className="hover:bg-blue-50/40 transition-colors"
                style={{ borderBottom: i < list.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-4 py-3 font-medium tabular-nums" style={{ color: A.indigo }}>{t.id}</td>
                <td className="px-4 py-3" style={{ color: A.label }}>
                  {t.from} <ArrowRight size={10} className="inline mx-1" style={{ color: A.gray2 }} /> <span style={{ color: A.blue }}>{t.to}</span>
                </td>
                <td className="px-4 py-3" style={{ color: A.label }}>
                  <span style={{ color: A.blue }}>{t.sku}</span> · {t.name}
                </td>
                <td className="px-4 py-3 tabular-nums font-medium" style={{ color: A.label }}>{t.qty.toLocaleString()}</td>
                <td className="px-4 py-3" style={{ color: A.sub }}>{t.requester}</td>
                <td className="px-4 py-3" style={{ color: A.sub }}>{t.carrier}</td>
                <td className="px-4 py-3" style={{ color: A.gray1 }}>{t.created}</td>
                <td className="px-4 py-3" style={{ color: A.gray1 }}>{t.eta}</td>
                <td className="px-4 py-3"><Chip label={t.status} color={statusColor(t.status)} bg={`${statusColor(t.status)}18`} /></td>
                <td className="px-4 py-3">
                  {t.status === "待审批" && (
                    <button onClick={() => approve(t.id)} className="text-[11px] px-2 py-1 rounded-md font-medium text-white" style={{ background: A.blue }}>批准</button>
                  )}
                  {(t.status === "在途" || t.status === "已发出") && (
                    <button onClick={() => receive(t.id)} className="text-[11px] px-2 py-1 rounded-md font-medium text-white" style={{ background: A.green }}>签收</button>
                  )}
                  {t.status === "已签收" && (
                    <span className="text-[11px]" style={{ color: A.gray2 }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="新建调拨单" subtitle="跨仓库存调配"
        footer={<>
          <button onClick={() => setCreateOpen(false)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: A.white, color: A.label, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.1)" }}>取消</button>
          <button onClick={createTransfer} className="text-xs px-3 py-1.5 rounded-lg font-medium text-white" style={{ background: A.blue }}>提交审批</button>
        </>}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="源仓库">
            <select value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} style={inputStyle}>
              {["上海总仓", "苏州分仓", "深圳分仓", "天津分仓"].map((w) => <option key={w}>{w}</option>)}
            </select>
          </Field>
          <Field label="目标仓库">
            <select value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} style={inputStyle}>
              {["上海总仓", "苏州分仓", "深圳分仓", "天津分仓"].map((w) => <option key={w}>{w}</option>)}
            </select>
          </Field>
          <Field label="物料 SKU">
            <select value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} style={inputStyle}>
              {SKU_CATALOG.map((s) => <option key={s.sku} value={s.sku}>{s.sku} · {s.name}</option>)}
            </select>
          </Field>
          <Field label="调拨数量">
            <input type="number" min={1} value={form.qty}
              onChange={(e) => setForm({ ...form, qty: parseInt(e.target.value) || 0 })} style={inputStyle} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

// ─── Inventory · Cycle Count ────────────────────────────────────────────────


function InventoryCycleCount() {
  const [plans, setPlans] = useState(COUNT_PLANS);
  const completed = plans.filter((p) => p.status === "完成").length;
  const inProgress = plans.filter((p) => p.status === "进行中").length;
  const accuracy = ((plans.reduce((s, p) => s + (p.scope - Math.abs(p.variance)), 0) /
                    plans.reduce((s, p) => s + p.scope, 0)) * 100).toFixed(1);

  function start(id: string) {
    setPlans((arr) => arr.map((p) => p.id === id ? { ...p, status: "进行中", counter: "刘建华" } : p));
    toast.success(`${id} 已下发至手持终端`);
  }
  function complete(id: string) {
    setPlans((arr) => arr.map((p) => p.id === id ? { ...p, status: "完成", counted: p.scope } : p));
    toast.success(`${id} 盘点完成`);
  }

  function exportCountPlansCsv() {
    exportCsv("inventory-cycle-count-plans-export.csv", plans.map((plan) => ({
      "计划号": plan.id,
      "库区": plan.zone,
      "排期": plan.scheduled,
      "盘点员": plan.counter,
      "方法": plan.method,
      "计划范围": plan.scope,
      "已盘点": plan.counted,
      "进度百分比": Number(((plan.counted / plan.scope) * 100).toFixed(1)),
      "差异": plan.variance,
      "状态": plan.status,
    })));
  }

  function exportVariancesCsv() {
    exportCsv("inventory-count-variances-export.csv", VARIANCES.map((variance) => ({
      "批次号": variance.lot,
      "SKU": variance.sku,
      "品名": variance.name,
      "账面数": variance.book,
      "实盘数": variance.actual,
      "差异": variance.diff,
      "差异原因": variance.reason,
      "差异金额": variance.value,
    })));
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="本周计划"   value={String(plans.length)} sub="ABC 循环盘点"             icon={ClipboardCheck} color={A.blue}   />
        <KpiCard label="完成"        value={String(completed)}     sub={`完成率 ${(completed / plans.length * 100).toFixed(0)}%`} icon={CheckCircle2}   color={A.green}  />
        <KpiCard label="进行中"      value={String(inProgress)}    sub="手持终端实时同步"          icon={Loader2}        color={A.orange} />
        <KpiCard label="盘点准确率"  value={`${accuracy}%`}        sub="行业基准 99.5%"           delta={parseFloat(accuracy) >= 99.5 ? "达标" : "未达"} positive={parseFloat(accuracy) >= 99.5} icon={Activity} color={A.purple} />
      </div>

      <Card>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>循环盘点计划 (Cycle Count)</h2>
          <div className="flex items-center gap-2">
            <button onClick={exportCountPlansCsv}
              className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md font-medium" style={{ background: A.gray6, color: A.blue }}>
              <FileSpreadsheet size={11} /> 导出 CSV
            </button>
            <button onClick={() => toast("已按 ABC 重新生成下周计划")}
              className="text-[11px] px-2.5 py-1 rounded-md font-medium text-white" style={{ background: A.blue }}>
              生成下周计划
            </button>
          </div>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["计划号", "库区", "排期", "盘点员", "方法", "进度", "差异", "状态", "操作"].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plans.map((p, i) => {
              const pct = (p.counted / p.scope) * 100;
              return (
                <tr key={p.id} className="hover:bg-blue-50/40 transition-colors"
                  style={{ borderBottom: i < plans.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                  <td className="px-4 py-3 font-medium tabular-nums" style={{ color: A.indigo }}>{p.id}</td>
                  <td className="px-4 py-3" style={{ color: A.label }}>{p.zone}</td>
                  <td className="px-4 py-3" style={{ color: A.sub }}>{p.scheduled}</td>
                  <td className="px-4 py-3" style={{ color: A.label }}>{p.counter}</td>
                  <td className="px-4 py-3"><Chip label={p.method} color={A.purple} bg="#f8f0ff" /></td>
                  <td className="px-4 py-3 w-32">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: A.gray5 }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct === 100 ? A.green : pct > 0 ? A.blue : A.gray3 }} />
                      </div>
                      <span className="text-[10px] tabular-nums w-12 text-right" style={{ color: A.gray1 }}>{p.counted}/{p.scope}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium tabular-nums" style={{ color: p.variance === 0 ? A.green : p.variance > 0 ? A.blue : A.red }}>
                    {p.variance === 0 ? "—" : (p.variance > 0 ? "+" : "") + p.variance}
                  </td>
                  <td className="px-4 py-3"><Chip label={p.status}
                    color={p.status === "完成" ? A.green : p.status === "进行中" ? A.orange : A.gray1}
                    bg={p.status === "完成" ? "#f0faf4" : p.status === "进行中" ? "#fff8f0" : A.gray6} /></td>
                  <td className="px-4 py-3">
                    {p.status === "待执行" && (
                      <button onClick={() => start(p.id)} className="text-[11px] px-2 py-1 rounded-md font-medium text-white" style={{ background: A.blue }}>开始</button>
                    )}
                    {p.status === "进行中" && (
                      <button onClick={() => complete(p.id)} className="text-[11px] px-2 py-1 rounded-md font-medium text-white" style={{ background: A.green }}>完结</button>
                    )}
                    {p.status === "完成" && (
                      <button onClick={() => toast(`${p.id} 报告已生成`)} className="text-[11px] px-2 py-1 rounded-md font-medium" style={{ background: A.gray6, color: A.label }}>报告</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>盘点差异待审批</h2>
          <div className="flex items-center gap-2">
            <button onClick={exportVariancesCsv}
              className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md font-medium" style={{ background: A.gray6, color: A.blue }}>
              <FileSpreadsheet size={11} /> 导出 CSV
            </button>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: "#fff8f0", color: A.orange }}>
              {VARIANCES.length} 项 · 合计 ¥{VARIANCES.reduce((s, v) => s + Math.abs(v.value), 0).toLocaleString()}
            </span>
          </div>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["批次", "SKU", "品名", "账面数", "实盘数", "差异", "差异原因", "差异金额", "操作"].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {VARIANCES.map((v, i) => (
              <tr key={v.lot} className="hover:bg-blue-50/40 transition-colors"
                style={{ borderBottom: i < VARIANCES.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-4 py-3 tabular-nums" style={{ color: A.indigo }}>{v.lot}</td>
                <td className="px-4 py-3" style={{ color: A.blue }}>{v.sku}</td>
                <td className="px-4 py-3 font-medium" style={{ color: A.label }}>{v.name}</td>
                <td className="px-4 py-3 tabular-nums" style={{ color: A.label }}>{v.book.toLocaleString()}</td>
                <td className="px-4 py-3 tabular-nums" style={{ color: A.label }}>{v.actual.toLocaleString()}</td>
                <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: v.diff < 0 ? A.red : A.blue }}>{v.diff > 0 ? "+" : ""}{v.diff}</td>
                <td className="px-4 py-3" style={{ color: A.sub }}>{v.reason}</td>
                <td className="px-4 py-3 tabular-nums" style={{ color: A.red }}>¥{v.value.toLocaleString()}</td>
                <td className="px-4 py-3 flex gap-1">
                  <button onClick={() => toast.success(`${v.lot} 差异已审批入账`)}
                    className="text-[11px] px-2 py-1 rounded-md font-medium text-white" style={{ background: A.blue }}>批准</button>
                  <button onClick={() => toast(`${v.lot} 已发起复盘`)}
                    className="text-[11px] px-2 py-1 rounded-md font-medium" style={{ background: A.gray6, color: A.label }}>复盘</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Inventory · ABC/XYZ Matrix ────────────────────────────────────────────
function InventoryABCXYZ() {
  // ABC by annual value contribution; XYZ by demand variability
  const items = inventoryItems.map((it, i) => {
    const annualValue = it.qty * (50 + (i * 73) % 800);    // synthetic
    const cov = 0.1 + ((i * 0.37) % 0.7);                  // synthetic CoV
    const abc = i < 2 ? "A" : i < 6 ? "B" : "C";
    const xyz = cov < 0.25 ? "X" : cov < 0.5 ? "Y" : "Z";
    return { ...it, annualValue, cov, abc, xyz };
  });

  const matrix: Record<string, typeof items> = {};
  for (const a of ["A", "B", "C"]) for (const x of ["X", "Y", "Z"]) matrix[a + x] = [];
  for (const it of items) matrix[it.abc + it.xyz].push(it);

  const strategy: Record<string, { policy: string; color: string }> = {
    AX: { policy: "自动补货 · 高服务水平 99%",   color: A.green   },
    AY: { policy: "周预测 · 服务 97%",            color: A.green   },
    AZ: { policy: "JIT · 紧密协同",                color: A.orange  },
    BX: { policy: "月预测 · 服务 95%",            color: A.blue    },
    BY: { policy: "月预测 · 服务 90%",            color: A.blue    },
    BZ: { policy: "按订单生产",                   color: A.orange  },
    CX: { policy: "经济批量 · 季度补",            color: A.gray1   },
    CY: { policy: "按需采购",                     color: A.gray1   },
    CZ: { policy: "按订单采购 · 不备库",          color: A.red     },
  };
  const sortedItems = [...items].sort((a, b) => b.annualValue - a.annualValue);

  function exportAbcXyzCsv() {
    exportCsv("inventory-abc-xyz-export.csv", sortedItems.map((item) => ({
      "SKU": item.sku,
      "品名": item.name,
      "品类": item.category,
      "当前库存": item.qty,
      "年价值": item.annualValue,
      "CoV": Number(item.cov.toFixed(2)),
      "ABC分类": item.abc,
      "XYZ分类": item.xyz,
      "策略": strategy[item.abc + item.xyz].policy,
    })));
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="A 类 SKU"  value={String(items.filter((i) => i.abc === "A").length)} sub="贡献 80% 价值" icon={Boxes} color={A.green}  />
        <KpiCard label="B 类 SKU"  value={String(items.filter((i) => i.abc === "B").length)} sub="贡献 15% 价值" icon={Boxes} color={A.blue}   />
        <KpiCard label="C 类 SKU"  value={String(items.filter((i) => i.abc === "C").length)} sub="贡献 5% 价值"  icon={Boxes} color={A.gray1}  />
        <KpiCard label="Z 类不规则" value={String(items.filter((i) => i.xyz === "Z").length)} sub="CoV ≥ 0.5"    icon={AlertTriangle} color={A.red} />
      </div>

      <Card className="p-5">
        <SectionHeader title="ABC × XYZ 策略矩阵" right={
          <div className="flex gap-2 text-[10px]" style={{ color: A.sub }}>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: A.green }} />自动补货</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: A.blue }} />周期补</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: A.orange }} />按订单</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: A.red }} />不备库</span>
          </div>
        } />

        <div className="grid grid-cols-[80px_1fr_1fr_1fr] gap-1.5">
          <div></div>
          {["X (稳定)", "Y (波动)", "Z (不规则)"].map((h) => (
            <div key={h} className="text-[11px] font-semibold text-center pb-2" style={{ color: A.label }}>{h}</div>
          ))}
          {(["A", "B", "C"] as const).map((row) => (
            <>
              <div key={`label-${row}`} className="text-[11px] font-semibold flex items-center justify-end pr-2" style={{ color: A.label }}>
                {row} {row === "A" ? "(高值)" : row === "B" ? "(中值)" : "(低值)"}
              </div>
              {(["X", "Y", "Z"] as const).map((col) => {
                const cell = matrix[row + col];
                const s = strategy[row + col];
                return (
                  <div key={`${row}${col}`} className="rounded-xl p-3 min-h-24"
                    style={{ background: `${s.color}10`, border: `1px solid ${s.color}30` }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-base font-semibold" style={{ color: s.color }}>{row}{col}</span>
                      <span className="text-[10px] px-1.5 py-px rounded-full font-medium" style={{ background: A.white, color: s.color }}>
                        {cell.length} SKU
                      </span>
                    </div>
                    <div className="text-[10px] mb-2" style={{ color: A.sub }}>{s.policy}</div>
                    {cell.slice(0, 2).map((it) => (
                      <div key={it.sku} className="text-[10px] truncate" style={{ color: A.label }}>· {it.name}</div>
                    ))}
                    {cell.length > 2 && <div className="text-[10px]" style={{ color: A.gray2 }}>+{cell.length - 2} 更多</div>}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </Card>

      <Card>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>SKU 分类明细</h2>
          <button onClick={exportAbcXyzCsv}
            className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md font-medium" style={{ background: A.gray6, color: A.blue }}>
            <FileSpreadsheet size={11} /> 导出 CSV
          </button>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["SKU", "品名", "年价值", "CoV", "ABC", "XYZ", "策略"].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((it, i) => {
              const s = strategy[it.abc + it.xyz];
              return (
                <tr key={it.sku} style={{ borderBottom: i < items.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                  <td className="px-4 py-3" style={{ color: A.blue }}>{it.sku}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: A.label }}>{it.name}</td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: A.label }}>¥{(it.annualValue / 1000).toFixed(0)}k</td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: A.sub }}>{it.cov.toFixed(2)}</td>
                  <td className="px-4 py-3"><Chip label={it.abc} color={it.abc === "A" ? A.green : it.abc === "B" ? A.blue : A.gray1} bg={it.abc === "A" ? "#f0faf4" : it.abc === "B" ? "#f0f6ff" : A.gray6} /></td>
                  <td className="px-4 py-3"><Chip label={it.xyz} color={it.xyz === "X" ? A.green : it.xyz === "Y" ? A.orange : A.red} bg={it.xyz === "X" ? "#f0faf4" : it.xyz === "Y" ? "#fff8f0" : "#fff1f0"} /></td>
                  <td className="px-4 py-3" style={{ color: s.color }}>{s.policy}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Inventory · Stock Movement History ────────────────────────────────────
type InventoryMovement = typeof MOVEMENTS[number] & Record<string, any> & {
  id?: string;
  movementId?: string;
  sourceType?: string;
  sourceId?: string;
  grnId?: string;
  poId?: string;
  poLineId?: string;
  warehouseId?: string;
  quantity?: number;
  timestamp?: string;
  po?: string;
  operator?: string;
  status?: string;
};

function InventoryMovements() {
  const [typeFilter, setTypeFilter] = useState<"全部" | "入库" | "出库" | "调拨" | "调整" | "退货" | "冻结">("全部");
  const [apiMovements, setApiMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    apiJson<InventoryMovement[]>("/api/inventory-movements")
      .then((data) => {
        if (!alive) return;
        setApiMovements(data.map((item) => ({
          ...item,
          id: item.id || item.movementId,
          ts: item.ts || item.timestamp || "",
          type: item.type || (toNumber(item.quantity, toNumber(item.qty)) >= 0 ? "入库" : "出库"),
          qty: toNumber(item.qty, toNumber(item.quantity)),
          ref: item.ref || item.sourceId || item.grnId || item.movementId || "—",
          from: item.from || (item.sourceType === "GRN" ? "供应商" : "—"),
          to: item.to || item.warehouseId || "MAIN",
          op: item.op || item.operator || "系统",
        })));
      })
      .catch(() => toast.error("库存流水服务暂不可用", { description: "已显示当前库存流水快照" }))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  const sourceList: InventoryMovement[] = [...apiMovements, ...(MOVEMENTS as InventoryMovement[])];
  const list = typeFilter === "全部" ? sourceList : sourceList.filter((m) => m.type === typeFilter);
  const inboundQty = list.filter((m) => m.type === "入库").reduce((sum, item) => sum + Math.max(0, toNumber(item.qty, toNumber(item.quantity))), 0);
  const outboundQty = list.filter((m) => m.type === "出库").reduce((sum, item) => sum + Math.abs(Math.min(0, toNumber(item.qty, toNumber(item.quantity)))), 0);
  const apiCount = apiMovements.length;

  const typeColor = (t: string) => ({
    入库: A.green, 出库: A.blue, 调拨: A.purple, 调整: A.orange, 退货: A.teal, 冻结: A.red,
  } as Record<string, string>)[t];
  const formatMovementTime = (value: string) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  };

  function exportMovementsCsv() {
    exportCsv("inventory-movements-export.csv", list.map((movement) => ({
      "事务号": movement.movementId || movement.id || "legacy",
      "时间": formatMovementTime(movement.timestamp || movement.ts),
      "类型": movement.type,
      "SKU": movement.sku,
      "数量": toNumber(movement.qty, toNumber(movement.quantity)),
      "仓库": movement.warehouseId || movement.to || "—",
      "来源单据": movement.sourceId || movement.grnId || movement.ref,
      "PO": movement.poId || movement.po || "",
      "PO Line": movement.poLineId || "",
      "操作人": movement.op,
      "状态": movement.status || "",
      "事由": movement.reason || "",
    })));
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        {[
          { l: "今日入库",  v: String(inboundQty || 748), d: apiCount ? `${apiCount} 条 API 流水` : "+12% vs 昨", c: A.green  },
          { l: "今日出库",  v: String(outboundQty || 424), d: loading ? "加载中" : "+8% vs 昨",  c: A.blue   },
          { l: "今日调拨",  v: String(list.filter((m) => m.type === "调拨").length), d: "调拨笔数", c: A.purple },
          { l: "异常调整",  v: String(list.filter((m) => m.type === "调整" || m.type === "冻结").length), d: "调整/冻结", c: A.orange },
        ].map((m) => (
          <Card key={m.l} className="p-5">
            <div className="text-xs" style={{ color: A.sub }}>{m.l}</div>
            <div className="text-2xl font-semibold tracking-tight mt-1" style={{ color: m.c }}>{m.v}</div>
            <div className="text-[11px] mt-1" style={{ color: A.gray2 }}>{m.d}</div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex items-center px-5 py-3.5 gap-3" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>库存事务流水 (Stock Ledger)</h2>
          <SegmentedControl
            options={["全部", "入库", "出库", "调拨", "调整", "退货", "冻结"].map((s) => ({ label: s, value: s }))}
            value={typeFilter} onChange={(v) => setTypeFilter(v as any)} />
          <button onClick={exportMovementsCsv}
            className="ml-auto text-[11px] px-2.5 py-1 rounded-md font-medium" style={{ background: A.gray6, color: A.label }}>
            <FileSpreadsheet size={11} className="inline mr-1" /> 导出 CSV
          </button>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["时间", "Movement", "类型", "SKU", "数量", "来源凭证", "PO / Line", "库位", "操作员", "事由"].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((m, i) => (
              <tr key={i} className="hover:bg-blue-50/40 transition-colors"
                style={{ borderBottom: i < list.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-4 py-3 tabular-nums" style={{ color: A.sub }}>{formatMovementTime(m.timestamp || m.ts)}</td>
                <td className="px-4 py-3 tabular-nums" style={{ color: A.blue }}>
                  <div className="max-w-28 truncate">{m.movementId || m.id || "legacy"}</div>
                  <div className="text-[9px]" style={{ color: A.gray2 }}>{m.sourceType || m.type}</div>
                </td>
                <td className="px-4 py-3"><Chip label={m.type} color={typeColor(m.type)} bg={`${typeColor(m.type)}18`} /></td>
                <td className="px-4 py-3" style={{ color: A.blue }}>{m.sku}</td>
                <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: toNumber(m.qty, toNumber(m.quantity)) > 0 ? A.green : toNumber(m.qty, toNumber(m.quantity)) < 0 ? A.red : A.gray2 }}>
                  {toNumber(m.qty, toNumber(m.quantity)) > 0 ? "+" : ""}{toNumber(m.qty, toNumber(m.quantity)) || "—"}
                </td>
                <td className="px-4 py-3" style={{ color: A.label }}>
                  <div className="font-medium">{m.sourceId || m.grnId || m.ref}</div>
                  <div className="text-[9px]" style={{ color: A.gray2 }}>
                    <span>{m.from}</span>{" "}<ArrowRight size={9} className="inline" style={{ color: A.gray3 }} />{" "}<span>{m.to}</span>
                  </div>
                </td>
                <td className="px-4 py-3 tabular-nums" style={{ color: A.indigo }}>
                  <div>{m.poId || m.po || "—"}</div>
                  <div className="text-[9px] max-w-28 truncate" style={{ color: A.gray2 }}>{m.poLineId || "—"}</div>
                </td>
                <td className="px-4 py-3" style={{ color: A.label }}>{m.warehouseId || m.to || "—"}</td>
                <td className="px-4 py-3" style={{ color: A.label }}>{m.op}</td>
                <td className="px-4 py-3" style={{ color: A.sub }}>{m.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Inventory · Warehouse Map (bin heatmap) ──────────────────────────────
function InventoryWarehouseMap() {
  // Synthetic 6×8 bin grid with fill %
  const grid: { code: string; fill: number; status: string }[][] = Array.from({ length: 6 }, (_, r) =>
    Array.from({ length: 10 }, (_, c) => {
      const fill = Math.min(100, Math.max(0, Math.round(40 + 50 * Math.sin(r + c * 0.7) + (r * c * 3) % 30)));
      const status = fill > 90 ? "满" : fill > 60 ? "高" : fill > 30 ? "中" : fill > 0 ? "低" : "空";
      return { code: `${String.fromCharCode(65 + r)}-${String(c + 1).padStart(2, "0")}`, fill, status };
    })
  );
  const totalBins = grid.flat().length;
  const usedBins = grid.flat().filter((g) => g.fill > 0).length;
  const overflow = grid.flat().filter((g) => g.fill > 90).length;

  function exportBinsCsv() {
    exportCsv("inventory-bin-utilization-export.csv", grid.flat().map((bin) => ({
      "库位": bin.code,
      "占用率": bin.fill,
      "状态": bin.status,
    })));
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="总库位"   value={String(totalBins)}                       sub="A–F 区 · 10 排"            icon={Grid3x3} color={A.blue}   />
        <KpiCard label="利用率"   value={`${((usedBins / totalBins) * 100).toFixed(0)}%`} sub={`${usedBins} 个在用`}     icon={Boxes}   color={A.green}  />
        <KpiCard label="高密度区" value={String(overflow)}                         sub="≥ 90% 容量"   delta="需扩容" positive={false} icon={AlertTriangle} color={A.red} />
        <KpiCard label="空闲库位" value={String(totalBins - usedBins)}             sub="可接收新到货"               icon={Inbox}   color={A.gray1}  />
      </div>

      <Card className="p-5">
        <SectionHeader title="实时库位热力图"
          right={<div className="flex items-center gap-2 text-[10px]" style={{ color: A.sub }}>
            <button onClick={exportBinsCsv}
              className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md font-medium" style={{ background: A.gray6, color: A.blue }}>
              <FileSpreadsheet size={11} /> 导出 CSV
            </button>
            <span>低</span>
            <div className="flex h-2 w-32 rounded-full overflow-hidden">
              {[10, 30, 50, 70, 90].map((p, i) => (
                <div key={i} className="flex-1" style={{ background: `rgba(0,113,227,${p / 100})` }} />
              ))}
            </div>
            <span>高</span>
          </div>} />

        <div className="space-y-1.5">
          {grid.map((row, r) => (
            <div key={r} className="flex items-center gap-1.5">
              <span className="w-6 text-[10px] font-semibold text-right" style={{ color: A.gray1 }}>{String.fromCharCode(65 + r)}</span>
              {row.map((cell, c) => (
                <button key={c}
                  onClick={() => toast(`库位 ${cell.code}`, { description: `占用率 ${cell.fill}% · ${cell.status === "满" ? "请优先出库" : cell.status === "空" ? "可接收新货" : "正常运转"}` })}
                  className="flex-1 h-9 rounded-md transition-transform hover:scale-110 relative group"
                  style={{
                    background: cell.fill === 0 ? A.gray6 : `rgba(0,113,227,${0.15 + (cell.fill / 100) * 0.7})`,
                    border: cell.fill > 90 ? `1px solid ${A.red}` : "1px solid transparent",
                  }}>
                  <span className="text-[9px] font-medium tabular-nums" style={{ color: cell.fill > 50 ? A.white : A.label }}>{cell.fill}%</span>
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 whitespace-nowrap text-[10px] px-1.5 py-0.5 rounded text-white" style={{ background: A.label }}>
                    {cell.code}
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <SectionHeader title="拣货热度 TOP 10 库位"
          right={<span className="text-[10px]" style={{ color: A.gray2 }}>近 30 天</span>} />
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={[
            { bin: "A-07", picks: 412 }, { bin: "B-01", picks: 384 }, { bin: "D-02", picks: 356 },
            { bin: "C-05", picks: 312 }, { bin: "A-03", picks: 284 }, { bin: "D-01", picks: 268 },
            { bin: "B-04", picks: 241 }, { bin: "C-02", picks: 218 }, { bin: "D-03", picks: 196 }, { bin: "A-05", picks: 172 },
          ]} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="0" stroke="rgba(0,0,0,0.05)" vertical={false} />
            <XAxis dataKey="bin" tick={{ fontSize: 10, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} width={32} />
            <Tooltip content={<AppleTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
            <Bar dataKey="picks" name="拣货次数" fill={A.blue} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

// ─── Inventory · Master Wrapper ───────────────────────────────────────────────
type InvTab = "overview" | "lots" | "transfer" | "count" | "abcxyz" | "movements" | "bins";
export default function InventoryPage() {
  const [tab, setTab] = useState<InvTab>("overview");
  const tabs = [
    { id: "overview",  label: "库存总览",  icon: Package,         count: "8,412" },
    { id: "lots",      label: "批次/序列号", icon: Layers,          count: LOTS.length },
    { id: "transfer",  label: "库间调拨",    icon: ArrowLeftRight,  count: TRANSFERS.length },
    { id: "count",     label: "循环盘点",    icon: ClipboardCheck,  count: COUNT_PLANS.length },
    { id: "abcxyz",    label: "ABC/XYZ 分类", icon: Boxes,           count: "10" },
    { id: "movements", label: "事务流水",    icon: History,         count: MOVEMENTS.length },
    { id: "bins",      label: "库位地图",    icon: Grid3x3,         count: "60" },
  ] as const;

  return (
    <div className="space-y-4">
      <SubTabs tabs={tabs as any} value={tab} onChange={(v) => setTab(v as InvTab)} />
      {tab === "overview"  && <InventoryOverview />}
      {tab === "lots"      && <InventoryLots />}
      {tab === "transfer"  && <InventoryTransfers />}
      {tab === "count"     && <InventoryCycleCount />}
      {tab === "abcxyz"    && <InventoryABCXYZ />}
      {tab === "movements" && <InventoryMovements />}
      {tab === "bins"      && <InventoryWarehouseMap />}
    </div>
  );
}
