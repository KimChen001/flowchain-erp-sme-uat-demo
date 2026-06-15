import { useEffect, useState } from "react";
import { Building2, Clock, FileSpreadsheet, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { apiJson } from "../../lib/api-client";
import { exportRowsToCsv } from "../../lib/data-export";
import { RFQS } from "../../data/demo-data";
import type { RfqRecord } from "../../types/scm";
import { A, Card, Chip, DocumentHistoryPanel, KpiCard } from "../../components/ui";

export default function PurchasingRFQPage() {
  const [rfqs, setRfqs] = useState<RfqRecord[]>(RFQS);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(RFQS[0]?.id ?? "");

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

  const selectedRfq = rfqs.find((item) => item.id === selectedId) ?? rfqs[0] ?? null;
  const exportCsv = () => {
    if (rfqs.length === 0) {
      toast.warning("暂无可导出的数据");
      return;
    }
    exportRowsToCsv("procurement-rfq-export.csv", rfqs.map((rfq) => ({
      RFQ编号: rfq.id,
      标题: rfq.title,
      品类: rfq.category,
      邀请供应商数: rfq.suppliers,
      已报价供应商数: rfq.quoted,
      最优价: rfq.bestPrice,
      最优供应商: rfq.bestSupplier,
      截止日期: rfq.due,
      状态: rfq.status,
      来源申请: rfq.sourceRequest || "",
      来源SKU: rfq.sourceSku || "",
      关联PO: rfq.linkedPo || "",
    })));
    toast.success("CSV 已导出");
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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="活动询价" value={String(rfqs.length)} sub={loading ? "加载中" : "近 30 天"} delta="+2" positive icon={FileSpreadsheet} color={A.blue} />
        <KpiCard label="参与供应商" value={String(rfqs.reduce((a, b) => a + b.suppliers, 0))} sub="累计邀请" icon={Building2} color={A.purple} />
        <KpiCard label="本月节省" value={`¥${(totalSavings / 1e4).toFixed(1)}万`} sub="vs 目录价" delta="+18%" positive icon={TrendingUp} color={A.green} />
        <KpiCard label="平均周期" value="4.8 天" sub="发出 → 授标" delta="-1.2d" positive icon={Clock} color={A.teal} />
      </div>

      <Card>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: A.label }}>寻源 / RFx</h2>
            <p className="text-[11px] mt-1" style={{ color: A.sub }}>
              RFx 可用于战略寻源，也可由采购申请触发询价；中标结果可进入合同、目录价或采购订单。
            </p>
          </div>
          <button onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all hover:opacity-90"
            style={{ background: A.gray6, color: A.blue }}>
            <FileSpreadsheet size={13} /> 导出 CSV
          </button>
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
            {rfqs.map((r, i) => {
              const style = rfqStatusStyle(r.status);
              return (
                <tr key={r.id} onClick={() => setSelectedId(r.id)}
                  className="cursor-pointer hover:bg-blue-50/40 transition-colors"
                  style={{
                    borderBottom: i < rfqs.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none",
                    background: selectedRfq?.id === r.id ? "rgba(0,113,227,0.06)" : "transparent",
                  }}>
                  <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>{r.id}</td>
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
                  </td>
                  <td className="px-5 py-3 font-medium" style={{ color: A.label }}>¥{r.bestPrice}</td>
                  <td className="px-5 py-3" style={{ color: A.sub }}>{r.bestSupplier}</td>
                  <td className="px-5 py-3" style={{ color: A.label }}>{r.due}</td>
                  <td className="px-5 py-3">
                    <Chip label={r.status} color={style.color} bg={style.bg} />
                  </td>
                  <td className="px-5 py-3">
                    {(r.status === "比价中" || r.status === "进行中") &&
                      <button onClick={() => award(r.id)} className="px-2 py-1 text-[11px] font-medium rounded-md text-white" style={{ background: A.blue }}>授标</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {selectedRfq && (
        <Card className="p-5">
          <div className="grid grid-cols-5 gap-4">
            <div className="col-span-2">
              <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: A.gray2 }}>RFx / 供应商报价请求详情</div>
              <div className="flex items-center gap-2 mb-3">
                <div className="text-base font-semibold tracking-tight" style={{ color: A.label }}>{selectedRfq.id}</div>
                <Chip label={selectedRfq.status} {...rfqStatusStyle(selectedRfq.status)} />
              </div>
              <div className="space-y-2 text-xs">
                {[
                  ["标题", selectedRfq.title],
                  ["来源申请", selectedRfq.sourceRequest || "—"],
                  ["最优供应商", selectedRfq.bestSupplier || "—"],
                  ["授标价格", selectedRfq.bestPrice ? `¥${Number(selectedRfq.bestPrice).toLocaleString()}` : "—"],
                  ["生成 PO", selectedRfq.linkedPo || "—"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <span style={{ color: A.gray1 }}>{label}</span>
                    <span className="font-medium text-right" style={{ color: A.label }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="col-span-3">
              <DocumentHistoryPanel
                entityType="rfq"
                entityId={selectedRfq.id}
                title="报价请求历史"
                refreshKey={selectedRfq.lastAuditId || selectedRfq.auditTrailIds?.join(",") || selectedRfq.status}
              />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
