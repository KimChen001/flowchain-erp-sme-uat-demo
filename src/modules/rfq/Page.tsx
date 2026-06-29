import { useEffect, useState } from "react";
import { Building2, Clock, FileSpreadsheet, Filter, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { apiJson } from "../../lib/api-client";
import { exportRowsToCsv } from "../../lib/data-export";
import { RFQS } from "../../data/demo-data";
import type { RfqRecord } from "../../types/scm";
import { A, Card, Chip, DocumentHistoryPanel, Field, inputStyle, KpiCard, SectionHeader } from "../../components/ui";
import ContextualImportActions from "../../components/import/ContextualImportActions";
import type { ActiveContext } from "../ai-assistant/Panel";
import {
  defaultRfqWorkbenchFilters,
  filterRfqsForWorkbench,
  rfqResponseStatus,
  type RfqWorkbenchFilters,
} from "./filters";

type RfqViewMode = "list" | "detail";

export default function PurchasingRFQPage({
  onActiveContextChange,
}: {
  onActiveContextChange?: (context: ActiveContext | null) => void;
}) {
  const [rfqs, setRfqs] = useState<RfqRecord[]>(RFQS);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(RFQS[0]?.id ?? "");
  const [viewMode, setViewMode] = useState<RfqViewMode>("list");
  const [filters, setFilters] = useState<RfqWorkbenchFilters>(defaultRfqWorkbenchFilters);

  useEffect(() => {
    let alive = true;
    apiJson<RfqRecord[]>("/api/rfqs")
      .then((data) => {
        if (!alive) return;
        setRfqs(data);
        setSelectedId((current) => data.some((item) => item.id === current) ? current : data[0]?.id ?? "");
      })
      .catch(() => toast.error("RFQ 服务暂不可用", { description: "已显示当前询价快照" }))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const filtered = filterRfqsForWorkbench(rfqs, filters);
  const selectedRfq = rfqs.find((item) => item.id === selectedId) ?? filtered[0] ?? rfqs[0] ?? null;
  const statusOptions = Array.from(new Set(rfqs.map((item) => item.status).filter(Boolean))).sort();

  useEffect(() => {
    if (viewMode !== "detail" || !selectedRfq) {
      onActiveContextChange?.(null);
      return;
    }
    onActiveContextChange?.({
      module: "procurement",
      entityType: "rfq",
      entityId: selectedRfq.id,
      entityLabel: selectedRfq.title || selectedRfq.id,
      view: "rfqs",
    });
    return () => onActiveContextChange?.(null);
  }, [viewMode, selectedRfq?.id, selectedRfq?.title, onActiveContextChange]);

  const exportCsv = () => {
    if (filtered.length === 0) {
      toast.warning("暂无可导出的数据");
      return;
    }
    exportRowsToCsv("procurement-rfq-export.csv", filtered.map((rfq) => ({
      RFQ编号: rfq.id,
      标题: rfq.title,
      品类: rfq.category,
      邀请供应商数: rfq.suppliers,
      已报价供应商数: rfq.quoted,
      报价状态: rfqResponseStatus(rfq),
      最优价: rfq.bestPrice,
      最优供应商: rfq.bestSupplier,
      截止日期: rfq.due,
      状态: rfq.status,
      来源申请: rfq.sourceRequest || "",
      来源SKU: rfq.sourceSku || "",
      关联PO: rfq.linkedPo || "",
    })));
    toast.success("导出文件已生成");
  };

  const award = async (id: string) => {
    try {
      const updated = await apiJson<RfqRecord>(`/api/rfqs/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "已授标" }),
      });
      setRfqs(prev => prev.map(r => r.id === id ? updated : r));
      setSelectedId(updated.id);
      toast.success(`${id} 已授标`, { description: updated.linkedPo ? `已生成 ${updated.linkedPo} 待审批订单` : "已更新授标结果" });
    } catch (error) {
      toast.error("RFQ 授标失败", { description: error instanceof Error ? error.message : "请确认 API 服务正在运行" });
    }
  };

  const totalSavings = 124800;
  const rfqStatusStyle = (status: string) => ({
    color: status === "已授标" || status === "已转PO" ? A.green : status === "比价中" ? A.orange : status === "进行中" ? A.blue : A.gray1,
    bg: status === "已授标" || status === "已转PO" ? "rgba(52,199,89,0.1)" : status === "比价中" ? "rgba(255,149,0,0.1)" : status === "进行中" ? "rgba(0,113,227,0.1)" : "rgba(142,142,147,0.1)",
  });

  function updateFilter<K extends keyof RfqWorkbenchFilters>(key: K, value: RfqWorkbenchFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setFilters(defaultRfqWorkbenchFilters);
  }

  function openDetail(id: string) {
    setSelectedId(id);
    setViewMode("detail");
  }

  function returnToList() {
    setViewMode("list");
  }

  const detailContent = selectedRfq && (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: A.gray2 }}>RFx / 供应商报价请求详情</div>
          <div className="flex items-center gap-2">
            <div className="text-xl font-semibold tracking-tight" style={{ color: A.label }}>{selectedRfq.id}</div>
            <Chip label={selectedRfq.status} {...rfqStatusStyle(selectedRfq.status)} />
          </div>
          <div className="text-xs mt-1" style={{ color: A.sub }}>{selectedRfq.title}</div>
        </div>
        <button onClick={returnToList} className="h-8 px-3 rounded-lg text-xs font-medium" style={{ background: A.gray6, color: A.blue }}>返回列表</button>
      </div>
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          ["来源申请", selectedRfq.sourceRequest || "—"],
          ["来源 SKU", `${selectedRfq.sourceSku || "—"} ${selectedRfq.sourceName || ""}`],
          ["品类", selectedRfq.category],
          ["报价状态", rfqResponseStatus(selectedRfq)],
          ["邀请 / 报价", `${selectedRfq.quoted} / ${selectedRfq.suppliers}`],
          ["最优供应商", selectedRfq.bestSupplier || "—"],
          ["授标价格", selectedRfq.bestPrice ? `¥${Number(selectedRfq.bestPrice).toLocaleString()}` : "—"],
          ["生成 PO", selectedRfq.linkedPo || "—"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl p-3" style={{ background: A.gray6 }}>
            <div className="text-[10px]" style={{ color: A.gray2 }}>{label}</div>
            <div className="text-xs font-semibold mt-1" style={{ color: A.label }}>{value}</div>
          </div>
        ))}
      </div>
      <DocumentHistoryPanel
        entityType="rfq"
        entityId={selectedRfq.id}
        title="报价请求历史"
        refreshKey={selectedRfq.lastAuditId || selectedRfq.auditTrailIds?.join(",") || selectedRfq.status}
      />
      <div className="flex flex-wrap gap-2 mt-5">
        {(selectedRfq.status === "比价中" || selectedRfq.status === "进行中") && (
          <button onClick={() => award(selectedRfq.id)} className="px-3 py-1.5 text-xs font-medium rounded-lg text-white" style={{ background: A.blue }}>授标</button>
        )}
        <button onClick={exportCsv} className="px-3 py-1.5 text-xs font-medium rounded-lg" style={{ background: A.white, color: A.blue, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)" }}>导出详情</button>
      </div>
    </Card>
  );

  if (viewMode === "detail") {
    return (
      <div className="space-y-4">
        {selectedRfq ? detailContent : (
          <Card className="p-8 text-center text-xs" style={{ color: A.gray2 }}>
            未找到 RFQ。
            <button onClick={returnToList} className="ml-3 px-3 py-1.5 rounded-lg font-medium" style={{ background: A.gray6, color: A.blue }}>返回列表</button>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="活动询价" value={String(rfqs.length)} sub={loading ? "加载中" : "近 30 天"} delta="+2" positive icon={FileSpreadsheet} color={A.blue} />
        <KpiCard label="参与供应商" value={String(rfqs.reduce((a, b) => a + b.suppliers, 0))} sub="累计邀请" icon={Building2} color={A.purple} />
        <KpiCard label="本月节省" value={`¥${(totalSavings / 1e4).toFixed(1)}万`} sub="vs 目录价" delta="+18%" positive icon={TrendingUp} color={A.green} />
        <KpiCard label="平均周期" value="4.8 天" sub="发出 → 授标" delta="-1.2d" positive icon={Clock} color={A.teal} />
      </div>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <SectionHeader title="RFQ 查询" />
            <div className="text-xs mt-1" style={{ color: A.sub }}>按 RFQ、供应商、物料、状态、报价状态和截止日期查询询价记录</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => toast.success(`已筛选 ${filtered.length} 条 RFQ`)}
              className="h-8 px-3 rounded-lg text-xs font-medium text-white" style={{ background: A.blue }}>查询</button>
            <button onClick={resetFilters}
              className="h-8 px-3 rounded-lg text-xs font-medium" style={{ background: A.gray6, color: A.label }}>重置</button>
            <button onClick={exportCsv}
              className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5" style={{ background: "#f0f6ff", color: A.blue }}>
              <FileSpreadsheet size={13} /> 导出当前结果
            </button>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-3">
          <Field label="RFQ 编号"><input value={filters.rfqId} onChange={(event) => updateFilter("rfqId", event.target.value)} placeholder="RFQ-2026" style={inputStyle} /></Field>
          <Field label="供应商"><input value={filters.supplier} onChange={(event) => updateFilter("supplier", event.target.value)} placeholder="供应商名称" style={inputStyle} /></Field>
          <Field label="物料 / SKU"><input value={filters.skuOrItem} onChange={(event) => updateFilter("skuOrItem", event.target.value)} placeholder="SKU 或标题" style={inputStyle} /></Field>
          <Field label="品类"><input value={filters.category} onChange={(event) => updateFilter("category", event.target.value)} placeholder="品类" style={inputStyle} /></Field>
          <Field label="来源 PR"><input value={filters.sourceRequest} onChange={(event) => updateFilter("sourceRequest", event.target.value)} placeholder="PR-2026" style={inputStyle} /></Field>
          <Field label="状态"><select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)} style={inputStyle}><option value="全部">全部</option>{statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select></Field>
          <Field label="报价状态"><select value={filters.responseStatus} onChange={(event) => updateFilter("responseStatus", event.target.value as RfqWorkbenchFilters["responseStatus"])} style={inputStyle}>{(["全部", "未报价", "部分报价", "已报价"] as const).map((status) => <option key={status} value={status}>{status}</option>)}</select></Field>
          <Field label="截止起始"><input value={filters.dueFrom} onChange={(event) => updateFilter("dueFrom", event.target.value)} placeholder="2026-06-01" style={inputStyle} /></Field>
          <Field label="截止结束"><input value={filters.dueTo} onChange={(event) => updateFilter("dueTo", event.target.value)} placeholder="2026-06-30" style={inputStyle} /></Field>
        </div>
      </Card>

      <Card>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: A.label }}>寻源 / RFx</h2>
            <p className="text-[11px] mt-1" style={{ color: A.sub }}>
              共 {rfqs.length} 条，当前筛选 {filtered.length} 条；RFx 可由采购申请触发询价，中标结果可进入采购订单。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs flex items-center gap-1.5" style={{ color: A.gray2 }}><Filter size={13} /> 当前结果</span>
            <ContextualImportActions entityLabel="RFx" compact />
          </div>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["RFQ 编号", "标题", "品类", "邀请 / 报价", "最优价", "最优供应商", "截止", "状态", "操作"].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
              const style = rfqStatusStyle(r.status);
              return (
                <tr key={r.id}
                  className="hover:bg-blue-50/40 transition-colors"
                  style={{ borderBottom: i < filtered.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                  <td className="px-5 py-3 font-medium"><button onClick={() => openDetail(r.id)} className="hover:underline" style={{ color: A.blue }}>{r.id}</button></td>
                  <td className="px-5 py-3 font-medium" style={{ color: A.label }}>
                    <div>{r.title}</div>
                    {(r.sourceRequest || r.linkedPo) && (
                      <div className="text-[10px] mt-0.5" style={{ color: A.gray2 }}>
                        {[r.sourceRequest, r.sourceSku, r.linkedPo ? `已生成 ${r.linkedPo}` : ""].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3" style={{ color: A.sub }}>{r.category}</td>
                  <td className="px-5 py-3" style={{ color: A.label }}>
                    <span style={{ color: A.green, fontWeight: 500 }}>{r.quoted}</span>
                    <span style={{ color: A.gray1 }}> / {r.suppliers}</span>
                    <div className="text-[10px] mt-0.5" style={{ color: A.gray2 }}>{rfqResponseStatus(r)}</div>
                  </td>
                  <td className="px-5 py-3 font-medium" style={{ color: A.label }}>¥{r.bestPrice}</td>
                  <td className="px-5 py-3" style={{ color: A.sub }}>{r.bestSupplier}</td>
                  <td className="px-5 py-3" style={{ color: A.label }}>{r.due}</td>
                  <td className="px-5 py-3">
                    <Chip label={r.status} color={style.color} bg={style.bg} />
                  </td>
                  <td className="px-5 py-3">
                    {(r.status === "比价中" || r.status === "进行中") &&
                      <button onClick={() => award(r.id)} className="px-2 py-1 text-[11px] font-medium rounded-md text-white mr-2" style={{ background: A.blue }}>授标</button>}
                    <button onClick={() => openDetail(r.id)} className="px-2 py-1 text-[11px] font-medium rounded-md" style={{ background: "#f0f6ff", color: A.blue }}>查看详情</button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-12 text-center text-xs" style={{ color: A.gray2 }}>当前条件下暂无 RFQ</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
