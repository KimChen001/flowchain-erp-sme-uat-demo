import { toast } from "sonner";
import { A, Card, Chip } from "../../components/ui";
import type { SupplierSrmRow } from "../../domain/srm/helpers";
import {
  tdActionClass,
  tdNameClass,
  tdNowrapClass,
  tdNumericClass,
  thClass,
} from "../../components/ui/workbenchTable";

export type SupplierTableMode = "master" | "performance" | "certification";

function statusStyle(status: string) {
  if (["低", "已认证", "启用", "战略", "核心", "执行中"].includes(status)) return { color: A.green, bg: "#f0faf4" };
  if (["高", "整改中", "整改", "已到期"].includes(status)) return { color: A.red, bg: "#fff1f0" };
  return { color: A.orange, bg: "#fff8f0" };
}

export default function SupplierTable({ rows, onDetail, mode }: { rows: SupplierSrmRow[]; onDetail: (row: SupplierSrmRow) => void; mode: SupplierTableMode }) {
  const visible = mode === "certification"
      ? rows.filter((row) => row.supplier.certificationStatus !== "已认证" || row.supplier.status !== "启用")
      : rows;

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[1180px]">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["供应商", "品类", "评级", "准时率", "质量合格率", "响应分", "风险状态", "认证状态", "开放 PO", "发票差异", "对账异常", "下一步", "操作"].map((header) => (
                <th key={header} className={thClass} style={{ color: A.gray1 }}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, index) => {
              const riskStyle = statusStyle(row.supplier.riskStatus);
              const certStyle = statusStyle(row.supplier.certificationStatus);
              return (
                <tr key={row.supplier.code} style={{ borderBottom: index < visible.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                  <td className={`${tdNameClass} max-w-[220px] font-semibold`} style={{ color: A.label }}>
                    <span className="block truncate">{row.supplier.name}</span>
                    <div className="text-[10px] mt-0.5" style={{ color: A.gray2 }}>{row.supplier.code} · {row.flag}</div>
                  </td>
                  <td className={tdNowrapClass} style={{ color: A.sub }}>{row.category}</td>
                  <td className={`${tdNumericClass} font-semibold`} style={{ color: row.rating >= 4.5 ? A.green : row.rating >= 4 ? A.blue : A.orange }}>{row.rating.toFixed(1)}</td>
                  <td className={tdNumericClass} style={{ color: A.label }}>{row.onTimeRate}%</td>
                  <td className={tdNumericClass} style={{ color: A.label }}>{row.qualityRate}%</td>
                  <td className={tdNumericClass} style={{ color: A.label }}>{row.responseScore}</td>
                  <td className={tdNowrapClass}><Chip label={row.supplier.riskStatus} color={riskStyle.color} bg={riskStyle.bg} /></td>
                  <td className={tdNowrapClass}><Chip label={row.supplier.certificationStatus} color={certStyle.color} bg={certStyle.bg} /></td>
                  <td className={`${tdNumericClass} font-semibold`} style={{ color: row.openPoCount ? A.blue : A.gray2 }}>{row.openPoCount}</td>
                  <td className={`${tdNumericClass} font-semibold`} style={{ color: row.invoiceVarianceCount ? A.orange : A.green }}>{row.invoiceVarianceCount}</td>
                  <td className={tdNowrapClass} style={{ color: row.reconciliationException ? A.red : A.green }}>{row.reconciliationException ? "需复核" : "稳定"}</td>
                  <td className={`${tdNameClass} max-w-[180px] truncate`} style={{ color: A.blue }}>{row.nextAction}</td>
                  <td className={tdActionClass}>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => onDetail(row)} className="px-2.5 py-1 rounded-md font-medium" style={{ background: A.gray6, color: A.blue }}>详情</button>
                      <button onClick={() => toast("更多操作", { description: `${row.supplier.name} · ${row.nextAction}` })} className="px-2.5 py-1 rounded-md font-medium" style={{ background: A.gray6, color: A.gray1 }}>更多</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
