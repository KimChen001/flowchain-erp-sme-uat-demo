import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CreditCard, FileSpreadsheet, FileText, HandCoins, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { A, Card, Chip, KpiCard, SubTabs } from "../../components/ui";
import PayablesPanel from "../procurement/PayablesPanel";
import SupplierInvoiceRegister from "../procurement/SupplierInvoiceRegister";
import SupplierReconciliationPanel from "../procurement/SupplierReconciliationPanel";
import { PAYABLES, PURCHASE_RETURNS, SUPPLIER_CREDIT_MEMOS, SUPPLIER_INVOICES, SUPPLIER_RECONCILIATION_STATEMENTS } from "../../data/demo-data";
import { creditMemoExportRows } from "../../domain/procurement/returns";
import { invoiceToPayable, isInvoicePayableReady } from "../../domain/procurement/invoice-matching";
import { exportRowsToCsv } from "../../lib/data-export";
import { fmt } from "../../lib/format";

type FinanceTab = "invoices" | "payables" | "credits" | "reconciliation" | "settlement";

const financePayables = [
  ...SUPPLIER_INVOICES.filter(isInvoicePayableReady).map(invoiceToPayable),
  ...PAYABLES.filter((item) => !SUPPLIER_INVOICES.some((invoice) => invoice.invoiceNumber === item.invoice)),
];

function financeSummaryCards() {
  const openPayables = financePayables.filter((item) => item.status !== "已付款");
  const creditOffset = SUPPLIER_CREDIT_MEMOS
    .filter((memo) => ["已确认", "已冲减应付", "已关闭"].includes(memo.status))
    .reduce((sum, memo) => sum + memo.totalCredit, 0);
  const reconciliationExceptions = SUPPLIER_RECONCILIATION_STATEMENTS.filter((item) =>
    item.exceptionCount > 0 || item.totalVarianceAmount > 0 || ["存在差异", "已驳回"].includes(item.status)
  );
  const settlementReady = settlementRows().filter((row) => row.readiness === "可结算").length;

  return [
    { label: "供应商发票", value: String(SUPPLIER_INVOICES.length), sub: "发票登记与匹配状态", icon: FileText, color: A.blue },
    { label: "应付敞口", value: fmt(openPayables.reduce((sum, item) => sum + item.amount, 0)), sub: `${openPayables.length} 笔未关闭 AP`, icon: CreditCard, color: A.purple },
    { label: "贷项冲减", value: fmt(creditOffset), sub: `${SUPPLIER_CREDIT_MEMOS.length} 张贷项通知`, icon: ReceiptText, color: A.teal },
    { label: "对账异常", value: String(reconciliationExceptions.length), sub: "差异、驳回或逾期需复核", icon: AlertTriangle, color: A.orange },
    { label: "结算准备", value: String(settlementReady), sub: "供应商可进入结算复核", icon: HandCoins, color: A.green },
  ];
}

function settlementRows() {
  const suppliers = Array.from(new Set([
    ...SUPPLIER_INVOICES.map((invoice) => invoice.supplier),
    ...financePayables.map((payable) => payable.supplier),
    ...SUPPLIER_CREDIT_MEMOS.map((memo) => memo.supplier),
    ...SUPPLIER_RECONCILIATION_STATEMENTS.map((statement) => statement.supplier),
  ]));

  return suppliers.map((supplier) => {
    const invoices = SUPPLIER_INVOICES.filter((invoice) => invoice.supplier === supplier);
    const payables = financePayables.filter((payable) => payable.supplier === supplier && payable.status !== "已付款");
    const credits = SUPPLIER_CREDIT_MEMOS.filter((memo) => memo.supplier === supplier);
    const reconciliation = SUPPLIER_RECONCILIATION_STATEMENTS.find((statement) => statement.supplier === supplier);
    const invoiceAmount = invoices
      .filter((invoice) => ["已审批", "已过账应付", "已付款"].includes(invoice.status) || invoice.postedToAp)
      .reduce((sum, invoice) => sum + invoice.total, 0);
    const creditAmount = credits
      .filter((memo) => ["已确认", "已冲减应付", "已关闭"].includes(memo.status))
      .reduce((sum, memo) => sum + memo.totalCredit, 0);
    const openPayable = Math.max(0, payables.reduce((sum, payable) => sum + payable.amount, 0) - creditAmount);
    const blocked = Boolean(reconciliation && (reconciliation.exceptionCount > 0 || reconciliation.totalVarianceAmount > 0 || reconciliation.status === "已驳回"));
    const hasPendingCredit = credits.some((memo) => ["草稿", "待确认", "已驳回"].includes(memo.status));
    const readiness = blocked ? "暂缓" : hasPendingCredit || openPayable > 0 ? "需复核" : "可结算";
    const nextStep = blocked
      ? "先关闭对账差异"
      : hasPendingCredit
        ? "确认贷项冲减"
        : openPayable > 0
          ? "复核 AP 余额"
          : "进入结算复核";

    return {
      supplier,
      invoiceAmount,
      creditAmount,
      openPayable,
      reconciliationStatus: reconciliation?.status || "待生成",
      readiness,
      owner: reconciliation?.owner || invoices[0]?.apOwner || credits[0]?.owner || "财务协同",
      nextStep,
    };
  }).sort((a, b) => b.openPayable - a.openPayable);
}

function readinessStyle(status: string) {
  if (status === "可结算") return { color: A.green, bg: "#f0faf4" };
  if (status === "暂缓") return { color: A.red, bg: "#fff1f0" };
  return { color: A.orange, bg: "#fff8f0" };
}

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
    exportRowsToCsv("finance-credit-memo-offset-export.csv", creditMemoExportRows(SUPPLIER_CREDIT_MEMOS));
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
              {["贷项通知", "供应商", "关联发票", "关联采购退货", "贷项金额", "AP 冲减状态", "对账影响", "负责人", "下一步"].map((header) => (
                <th key={header} className="text-left px-5 py-3 font-medium whitespace-nowrap" style={{ color: A.gray1 }}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ memo, relatedReturn, statement, offsetDone, nextStep }, index) => {
              const statusStyle = offsetDone ? { color: A.green, bg: "#f0faf4" } : memo.status === "已驳回" ? { color: A.red, bg: "#fff1f0" } : { color: A.orange, bg: "#fff8f0" };
              return (
                <tr key={memo.id} style={{ borderBottom: index < rows.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                  <td className="px-5 py-3 font-medium whitespace-nowrap" style={{ color: A.blue }}>{memo.creditMemoNo}</td>
                  <td className="px-5 py-3 whitespace-nowrap" style={{ color: A.label }}>{memo.supplier}</td>
                  <td className="px-5 py-3 whitespace-nowrap" style={{ color: A.sub }}>{memo.relatedInvoice || "待关联"}</td>
                  <td className="px-5 py-3 whitespace-nowrap" style={{ color: A.sub }}>{relatedReturn?.returnNo || memo.relatedReturn || "待关联"}</td>
                  <td className="px-5 py-3 font-semibold whitespace-nowrap" style={{ color: A.label }}>{fmt(memo.totalCredit)}</td>
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

function SettlementPreparation() {
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
    toast.success("CSV 已导出", { description: "结算准备清单" });
  }

  return (
    <Card>
      <div className="px-5 py-4 flex items-start justify-between gap-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
        <div>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>结算准备</h2>
          <p className="text-[11px] leading-5 mt-1 max-w-2xl" style={{ color: A.sub }}>
            汇总供应商发票、应付账款、贷项冲减和供应商对账状态，形成付款前的结算准备清单。
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
              {["供应商", "发票金额", "贷项冲减", "未结应付", "对账状态", "结算准备", "负责人", "下一步"].map((header) => (
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

export default function FinanceWorkbench({ initialView = "invoices" }: { initialView?: FinanceTab }) {
  const [tab, setTab] = useState<FinanceTab>(initialView);
  const tabs = [
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
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: A.green }}>
            <CheckCircle2 size={13} /> 财务工作台
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-5 gap-3">
        {financeSummaryCards().map((item) => (
          <KpiCard key={item.label} {...item} />
        ))}
      </div>
      <SubTabs tabs={tabs as any} value={tab} onChange={(value) => setTab(value as FinanceTab)} />
      {tab === "invoices" && <SupplierInvoiceRegister mode="finance" />}
      {tab === "payables" && <PayablesPanel />}
      {tab === "credits" && <CreditMemoOffsetPanel />}
      {tab === "reconciliation" && <SupplierReconciliationPanel />}
      {tab === "settlement" && <SettlementPreparation />}
    </div>
  );
}
