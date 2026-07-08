import { FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { A, Card, Chip } from "../../components/ui";
import { exportRowsToCsv } from "../../lib/data-export";
import { fmt } from "../../lib/format";
import { readinessStyle, settlementRows } from "./finance-summary";

export default function SettlementPreparation() {
  const rows = settlementRows();

  function exportCsv() {
    if (rows.length === 0) {
      toast.warning("暂无可导出的数据");
      return;
    }
    exportRowsToCsv("finance-settlement-readiness-export.csv", rows.map((row) => ({
      供应商: row.supplier,
      发票金额: row.invoiceAmount,
      贷项冲减: row.creditAmount,
      未结应付: row.openPayable,
      对账状态: row.reconciliationStatus,
      结算准备: row.readiness,
      负责人: row.owner,
      下一步: row.nextStep,
    })));
    toast.success("导出文件已生成", { description: "结算资料准备清单" });
  }

  return (
    <Card>
      <div className="px-5 py-4 flex items-start justify-between gap-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
        <div>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>结算资料准备</h2>
          <p className="text-[11px] leading-5 mt-1 max-w-2xl" style={{ color: A.sub }}>
            汇总供应商发票、应付可见性、贷项冲减和供应商对账状态，形成付款前的资料复核清单；不执行付款或会计过账。
          </p>
        </div>
        <button onClick={exportCsv}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all hover:opacity-90"
          style={{ background: A.gray6, color: A.blue }}>
          <FileSpreadsheet size={13} /> 导出当前结果
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["供应商", "发票金额", "贷项冲减", "未结应付", "对账状态", "资料准备", "负责人", "下一步"].map((header) => (
                <th key={header} className="text-left px-5 py-3 font-medium whitespace-nowrap" style={{ color: A.gray1 }}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const style = readinessStyle(row.readiness);
              return (
                <tr key={row.supplier} style={{ borderBottom: index < rows.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                  <td className="px-5 py-3 font-medium whitespace-nowrap" style={{ color: A.label }}>{row.supplier}</td>
                  <td className="px-5 py-3 whitespace-nowrap" style={{ color: A.sub }}>{fmt(row.invoiceAmount)}</td>
                  <td className="px-5 py-3 whitespace-nowrap" style={{ color: A.green }}>{fmt(row.creditAmount)}</td>
                  <td className="px-5 py-3 font-semibold whitespace-nowrap" style={{ color: row.openPayable > 0 ? A.orange : A.label }}>{fmt(row.openPayable)}</td>
                  <td className="px-5 py-3 whitespace-nowrap" style={{ color: A.sub }}>{row.reconciliationStatus}</td>
                  <td className="px-5 py-3 whitespace-nowrap"><Chip label={row.readiness} color={style.color} bg={style.bg} /></td>
                  <td className="px-5 py-3 whitespace-nowrap" style={{ color: A.sub }}>{row.owner}</td>
                  <td className="px-5 py-3 whitespace-nowrap" style={{ color: A.blue }}>{row.nextStep}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
