import { useEffect, useState } from "react";
import { CheckCircle2, CreditCard, FileSpreadsheet, FileText, HandCoins, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { A, Card, Chip, KpiCard, SubTabs } from "../../components/ui";
import PayablesPanel from "../procurement/PayablesPanel";
import SupplierInvoiceRegister from "../procurement/SupplierInvoiceRegister";
import SupplierReconciliationPanel from "../procurement/SupplierReconciliationPanel";
import { PURCHASE_RETURNS, SUPPLIER_CREDIT_MEMOS, SUPPLIER_RECONCILIATION_STATEMENTS } from "../../data/demo-data";
import { creditMemoExportRows } from "../../domain/procurement/returns";
import { creditMemoTaxSummary, formatTaxRate } from "../../domain/finance/tax";
import { exportRowsToCsv } from "../../lib/data-export";
import { fmt } from "../../lib/format";
import FinanceOverview from "./FinanceOverview";
import SettlementPreparation from "./SettlementPreparation";
import { financeSummaryCards } from "./finance-summary";

export type FinanceTab = "overview" | "invoices" | "payables" | "credits" | "reconciliation" | "settlement";

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
      nextStep: offsetDone ? "复核对账影响" : memo.status === "待确认" ? "确认贷项通知" : memo.status === "已驳回" ? "复核驳回原因" : "准备 AP 冲减",
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
    toast.success("CSV 已导出", { description: "贷项冲减视图" });
  }

  return (
    <Card>
      <div className="px-5 py-4 flex items-start justify-between gap-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
        <div>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>贷项冲减</h2>
          <p className="text-[11px] leading-5 mt-1 max-w-3xl" style={{ color: A.sub }}>
            面向财务协同复核供应商贷项通知、关联发票、AP 冲减状态与对账影响；采购退货流程仍由采购工作台处理。
          </p>
        </div>
        <button onClick={exportCsv}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all hover:opacity-90"
          style={{ background: A.gray6, color: A.blue }}>
          <FileSpreadsheet size={13} /> 导出 CSV
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

export default function FinanceWorkbench({ initialView = "overview" }: { initialView?: FinanceTab }) {
  const [tab, setTab] = useState<FinanceTab>(initialView);
  const tabs = [
    { id: "overview", label: "财务总览", icon: CheckCircle2 },
    { id: "invoices", label: "供应商发票", icon: FileText },
    { id: "payables", label: "应付账款", icon: CreditCard },
    { id: "credits", label: "贷项冲减", icon: ReceiptText },
    { id: "reconciliation", label: "供应商对账", icon: FileSpreadsheet },
    { id: "settlement", label: "结算准备", icon: HandCoins },
  ] as const;
  useEffect(() => {
    if (initialView) setTab(initialView);
  }, [initialView]);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight" style={{ color: A.label }}>财务协同</h1>
            <p className="text-xs leading-5 mt-1" style={{ color: A.sub }}>
              管理供应商发票、AP 状态、应付账款、贷项冲减、供应商对账与结算准备。
            </p>
            <div className="mt-3 rounded-xl px-3 py-2 text-[11px] leading-5" style={{ background: "#f0f6ff", color: A.blue }}>
              这里只展示协同可见性，不进入 GL、支付执行或会计过账。
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: A.green }}>
            <CheckCircle2 size={13} /> 财务工作台
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-4 gap-3">
        {financeSummaryCards().map((item) => (
          <KpiCard key={item.label} {...item} />
        ))}
      </div>
      <SubTabs tabs={tabs as any} value={tab} onChange={(value) => setTab(value as FinanceTab)} />
      {tab === "overview" && <FinanceOverview onOpenTab={setTab} />}
      {tab === "invoices" && <SupplierInvoiceRegister mode="finance" />}
      {tab === "payables" && <PayablesPanel />}
      {tab === "credits" && <CreditMemoOffsetPanel />}
      {tab === "reconciliation" && <SupplierReconciliationPanel />}
      {tab === "settlement" && <SettlementPreparation />}
    </div>
  );
}
