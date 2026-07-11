import { useEffect, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { A, Card, Chip } from "../../components/ui";
import PayablesPanel from "../procurement/PayablesPanel";
import SupplierInvoiceRegister from "../procurement/SupplierInvoiceRegister";
import SupplierReconciliationPanel from "../procurement/SupplierReconciliationPanel";
import { PURCHASE_RETURNS, SUPPLIER_CREDIT_MEMOS, SUPPLIER_RECONCILIATION_STATEMENTS } from "../../data/demo-data";
import { creditMemoExportRows } from "../../domain/procurement/returns";
import { creditMemoTaxSummary, formatTaxRate } from "../../domain/finance/tax";
import { exportRowsToCsv } from "../../lib/data-export";
import { fmt } from "../../lib/format";
import SettlementPreparation from "./SettlementPreparation";

export type FinanceTab = "invoices" | "payables" | "credits" | "reconciliation" | "settlement";

function CreditMemoOffsetPanel() {
  const rows = SUPPLIER_CREDIT_MEMOS.map((memo) => {
    const relatedReturn = PURCHASE_RETURNS.find((item) => item.returnNo === memo.relatedReturn || item.creditMemoId === memo.id || item.creditMemoId === memo.creditMemoNo);
    const statement = SUPPLIER_RECONCILIATION_STATEMENTS.find((item) => item.statementNo === memo.reconciliationStatement || item.supplier === memo.supplier);
    const offsetDone = ["已冲减应付", "已关闭"].includes(memo.apOffsetStatus) || ["已冲减应付", "已关闭"].includes(memo.status);
    return {
      memo,
      relatedReturn,
      statement,
      offsetDone,
      nextStep: offsetDone ? "复核对账影响" : memo.status === "待确认" ? "确认贷项通知" : memo.status === "已驳回" ? "复核驳回原因" : "复核 AP 冲减影响",
    };
  });

  function exportCsv() {
    if (rows.length === 0) {
      toast.warning("暂无可导出的数据");
      return;
    }
    exportRowsToCsv("finance-credit-memo-offset-export.csv", SUPPLIER_CREDIT_MEMOS.map((memo) => {
      const tax = creditMemoTaxSummary(memo);
      return {
        ...creditMemoExportRows([memo])[0],
        贷项未税金额: tax.netAmount,
        贷项税码: tax.taxCode,
        贷项税率: formatTaxRate(tax.taxRate),
        贷项税额: tax.taxAmount,
        贷项价税合计: tax.grossAmount,
      };
    }));
    toast.success("导出文件已生成", { description: "贷项冲减视图" });
  }

  return (
    <Card>
      <div className="px-5 py-4 flex items-start justify-between gap-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
        <div>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>贷项冲减可见性</h2>
          <p className="text-[11px] leading-5 mt-1 max-w-3xl" style={{ color: A.sub }}>
            面向发票与匹配协同复核供应商贷项通知、关联发票、AP 冲减状态与对账影响；采购退货流程仍由采购工作台处理。
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
              {["贷项通知", "供应商", "关联发票", "关联采购退货", "贷项税码", "贷项税率", "贷项未税金额", "贷项税额", "贷项价税合计", "AP 冲减状态", "对账影响", "负责人", "下一步"].map((header) => (
                <th key={header} className="text-left px-5 py-3 font-medium whitespace-nowrap" style={{ color: A.gray1 }}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ memo, relatedReturn, statement, offsetDone, nextStep }, index) => {
              const statusStyle = offsetDone ? { color: A.green, bg: "#f0faf4" } : memo.status === "已驳回" ? { color: A.red, bg: "#fff1f0" } : { color: A.orange, bg: "#fff8f0" };
              const tax = creditMemoTaxSummary(memo);
              return (
                <tr key={memo.id} style={{ borderBottom: index < rows.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                  <td className="px-5 py-3 font-medium whitespace-nowrap" style={{ color: A.blue }}>{memo.creditMemoNo}</td>
                  <td className="px-5 py-3 whitespace-nowrap" style={{ color: A.label }}>{memo.supplier}</td>
                  <td className="px-5 py-3 whitespace-nowrap" style={{ color: A.sub }}>{memo.relatedInvoice || "待关联"}</td>
                  <td className="px-5 py-3 whitespace-nowrap" style={{ color: A.sub }}>{relatedReturn?.returnNo || memo.relatedReturn || "待关联"}</td>
                  <td className="px-5 py-3 whitespace-nowrap" style={{ color: A.sub }}>{tax.taxCode}</td>
                  <td className="px-5 py-3 whitespace-nowrap" style={{ color: A.sub }}>{formatTaxRate(tax.taxRate)}</td>
                  <td className="px-5 py-3 whitespace-nowrap" style={{ color: A.sub }}>{fmt(tax.netAmount)}</td>
                  <td className="px-5 py-3 whitespace-nowrap" style={{ color: A.sub }}>{fmt(tax.taxAmount)}</td>
                  <td className="px-5 py-3 font-semibold whitespace-nowrap" style={{ color: A.label }}>{fmt(tax.grossAmount)}</td>
                  <td className="px-5 py-3 whitespace-nowrap"><Chip label={memo.apOffsetStatus} color={statusStyle.color} bg={statusStyle.bg} /></td>
                  <td className="px-5 py-3 whitespace-nowrap" style={{ color: statement?.totalVarianceAmount ? A.orange : A.gray1 }}>
                    {statement ? `${statement.statementNo} · ${statement.status}` : "待进入对账"}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap" style={{ color: A.sub }}>{memo.owner}</td>
                  <td className="px-5 py-3 whitespace-nowrap" style={{ color: A.blue }}>{nextStep}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function FinanceWorkbench({ initialView = "invoices" }: { initialView?: FinanceTab; onNavigate?: (routeId: string) => void }) {
  const [tab, setTab] = useState<FinanceTab>(initialView);
  useEffect(() => {
    if (initialView) setTab(initialView);
  }, [initialView]);

  return (
    <div className="space-y-4">
      {tab === "invoices" && <SupplierInvoiceRegister mode="finance" />}
      {tab === "payables" && <PayablesPanel />}
      {tab === "credits" && <CreditMemoOffsetPanel />}
      {tab === "reconciliation" && <SupplierReconciliationPanel />}
      {tab === "settlement" && <SettlementPreparation />}
    </div>
  );
}
