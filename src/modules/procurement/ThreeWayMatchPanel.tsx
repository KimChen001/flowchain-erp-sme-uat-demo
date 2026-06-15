import { useState } from "react";
import { AlertCircle, AlertOctagon, CheckCircle2, FileSpreadsheet, Package, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Modal, Card, Chip, KpiCard, A } from "../../components/ui";
import { SUPPLIER_INVOICES, purchaseOrders, receivingDocs } from "../../data/demo-data";
import { exportRowsToCsv } from "../../lib/data-export";
import { fmt } from "../../lib/format";
import { invoiceToMatchQueueItem, type InvoiceMatchQueueItem } from "../../domain/procurement/invoice-matching";
import { matchStatusStyle } from "./shared";

export default function ThreeWayMatchPanel() {
  const [queue, setQueue] = useState<InvoiceMatchQueueItem[]>(() =>
    SUPPLIER_INVOICES.map((invoice) => invoiceToMatchQueueItem(invoice, purchaseOrders, receivingDocs, SUPPLIER_INVOICES))
  );
  const [selected, setSelected] = useState<InvoiceMatchQueueItem | null>(null);
  const exportCsv = () => {
    if (queue.length === 0) {
      toast.warning("暂无可导出的数据");
      return;
    }
    exportRowsToCsv("invoice-three-way-match-export.csv", queue.map((item) => ({
      匹配号: item.id,
      采购订单: item.po,
      收货单: item.grn,
      发票: item.invoiceNumber,
      供应商: item.supplier,
      PO金额: item.poAmt,
      GRN金额: item.grnAmt,
      发票金额: item.invAmt,
      差异类型: item.varianceType,
      差异金额: item.varianceAmount,
      匹配状态: item.matchStatus,
      发票状态: item.status,
    })));
    toast.success("CSV 已导出");
  };
  const resolve = (id: string) => {
    setQueue(prev => prev.map(q => q.id === id ? { ...q, matchStatus: "已解决", status: "已匹配", varianceAmount: 0, varianceType: "无差异" } : q));
    toast.success(`${id} 差异已解决`, { description: "仅更新演示匹配状态，不生成会计凭证。" });
  };
  const rejectInvoice = (id: string) => {
    setQueue(prev => prev.map(q => q.id === id ? { ...q, status: "已驳回", matchStatus: "差异待处理" } : q));
    toast.success(`${id} 已退回发票`);
  };
  const markMatched = (id: string) => {
    setQueue(prev => prev.map(q => q.id === id ? { ...q, status: "已匹配", matchStatus: "已解决", varianceAmount: 0, varianceType: "无差异" } : q));
    toast.success(`${id} 已标记匹配`);
  };

  const varianceTotal = queue.reduce((sum, row) => sum + Number(row.varianceAmount || 0), 0);
  const autoMatched = queue.length ? Math.round((queue.filter((row) => row.matchStatus === "自动匹配").length / queue.length) * 100) : 0;
  const missingGrn = queue.filter((row) => row.varianceType === "缺少收货").length;
  const duplicateRisk = queue.filter((row) => row.duplicateRisk || row.varianceType === "重复发票").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-3">
        <KpiCard label="匹配队列" value={String(queue.length)} sub="PO / GRN / 发票" icon={ShieldCheck} color={A.blue} />
        <KpiCard label="自动匹配率" value={`${autoMatched}%`} sub="容差内通过" icon={CheckCircle2} color={A.green} />
        <KpiCard label="差异总额" value={fmt(varianceTotal)} sub="待处理" icon={AlertOctagon} color={A.red} />
        <KpiCard label="缺少收货" value={String(missingGrn)} sub="GRN 未完成" icon={Package} color={A.orange} />
        <KpiCard label="重复风险" value={String(duplicateRisk)} sub="供应商+发票号" icon={AlertCircle} color={A.purple} />
      </div>

      <Card>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: A.label }}>三单匹配 (PO · GRN · Supplier Invoice)</h2>
            <p className="text-[11px] mt-1" style={{ color: A.sub }}>
              三单匹配为演示规则，用于比较采购订单、收货单和供应商发票的金额、数量与状态差异；差异可通过发票更正、采购退货、供应商贷项、AP 调整或供应商对账处理。
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
              {["匹配号", "PO", "GRN", "发票", "供应商", "PO 金额", "GRN 金额", "发票金额", "差异类型", "差异金额", "匹配状态", "操作"].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {queue.map((q, i) => (
              <tr key={q.id} style={{ borderBottom: i < queue.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>{q.id}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{q.po}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{q.grn}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{q.invoiceNumber}</td>
                <td className="px-5 py-3" style={{ color: A.label }}>{q.supplier}</td>
                <td className="px-5 py-3" style={{ color: A.label }}>¥{(q.poAmt / 1e4).toFixed(1)}万</td>
                <td className="px-5 py-3" style={{ color: A.label }}>¥{(q.grnAmt / 1e4).toFixed(1)}万</td>
                <td className="px-5 py-3" style={{ color: A.label }}>¥{(q.invAmt / 1e4).toFixed(1)}万</td>
                <td className="px-5 py-3 font-medium" style={{ color: q.varianceType === "无差异" ? A.green : A.red }}>{q.varianceType}</td>
                <td className="px-5 py-3 font-medium" style={{ color: q.varianceAmount === 0 ? A.green : A.red }}>{q.varianceAmount === 0 ? "—" : fmt(q.varianceAmount)}</td>
                <td className="px-5 py-3">
                  <Chip label={q.matchStatus} {...matchStatusStyle(q.matchStatus)} />
                </td>
                <td className="px-5 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => setSelected(q)} className="px-2 py-1 text-[11px] font-medium rounded-md" style={{ background: A.gray6, color: A.blue }}>查看发票</button>
                    {q.matchStatus !== "自动匹配" && <button onClick={() => resolve(q.id)} className="px-2 py-1 text-[11px] font-medium rounded-md text-white" style={{ background: A.blue }}>解决差异</button>}
                    <button onClick={() => markMatched(q.id)} className="px-2 py-1 text-[11px] font-medium rounded-md" style={{ background: "#f0faf4", color: A.green }}>标记匹配</button>
                    <button onClick={() => rejectInvoice(q.id)} className="px-2 py-1 text-[11px] font-medium rounded-md" style={{ background: "#fff1f0", color: A.red }}>退回</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} width={620}
        title={selected?.invoiceNumber || "发票匹配"}
        subtitle={selected ? `${selected.po} · ${selected.grn}` : undefined}>
        {selected && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[
                ["PO Ordered", fmt(selected.poAmt), A.blue],
                ["GRN Received", fmt(selected.grnAmt), A.green],
                ["Invoice Billed", fmt(selected.invAmt), A.orange],
              ].map(([label, value, color]) => (
                <div key={String(label)} className="rounded-xl p-3" style={{ background: A.gray6 }}>
                  <div className="text-[10px]" style={{ color: A.gray2 }}>{label}</div>
                  <div className="text-sm font-semibold mt-1" style={{ color: String(color) }}>{value}</div>
                </div>
              ))}
            </div>
            <div className="rounded-xl p-3" style={{ background: selected.varianceType === "无差异" ? "#f0faf4" : "#fff8f0" }}>
              <div className="text-xs font-semibold" style={{ color: selected.varianceType === "无差异" ? A.green : A.orange }}>
                {selected.varianceType} · {selected.matchStatus}
              </div>
              <div className="text-[11px] leading-5 mt-1" style={{ color: A.sub }}>
                PO = ordered，GRN = received，Invoice = billed。当前差异金额 {fmt(selected.varianceAmount)}，请在供应商发票台账中查看行项目证据；本结果仅为演示匹配预检。
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
