import { useState } from "react";
import { CreditCard, FileSpreadsheet, FileText, HandCoins, ReceiptText } from "lucide-react";
import { A, Card, SubTabs } from "../../components/ui";
import PayablesPanel from "../procurement/PayablesPanel";
import PurchaseReturnsPanel from "../procurement/PurchaseReturnsPanel";
import SupplierInvoiceRegister from "../procurement/SupplierInvoiceRegister";
import SupplierReconciliationPanel from "../procurement/SupplierReconciliationPanel";

type FinanceTab = "invoices" | "payables" | "credits" | "reconciliation" | "settlement";

function SettlementPreparation() {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>结算准备</h2>
          <p className="text-[11px] leading-5 mt-1 max-w-2xl" style={{ color: A.sub }}>
            汇总供应商发票、应付账款、贷项冲减和供应商对账状态，支持付款前的结算复核与证据链检查。
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-[10px] min-w-[300px]">
          {[
            ["发票状态", "匹配 / 审批 / AP"],
            ["贷项冲减", "待确认 / 已冲减"],
            ["对账状态", "差异 / 未结 / 已结"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg p-2" style={{ background: A.gray6 }}>
              <div style={{ color: A.gray2 }}>{label}</div>
              <div className="font-semibold mt-0.5" style={{ color: A.label }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default function FinanceWorkbench() {
  const [tab, setTab] = useState<FinanceTab>("invoices");
  const tabs = [
    { id: "invoices", label: "供应商发票", icon: FileText },
    { id: "payables", label: "应付账款", icon: CreditCard },
    { id: "credits", label: "贷项冲减", icon: ReceiptText },
    { id: "reconciliation", label: "供应商对账", icon: FileSpreadsheet },
    { id: "settlement", label: "结算准备", icon: HandCoins },
  ] as const;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h1 className="text-lg font-semibold tracking-tight" style={{ color: A.label }}>财务协同</h1>
        <p className="text-xs leading-5 mt-1" style={{ color: A.sub }}>
          管理供应商发票、AP 状态、应付账款、贷项冲减、供应商对账与结算准备。
        </p>
      </Card>
      <SubTabs tabs={tabs as any} value={tab} onChange={(value) => setTab(value as FinanceTab)} />
      {tab === "invoices" && <SupplierInvoiceRegister mode="finance" />}
      {tab === "payables" && <PayablesPanel />}
      {tab === "credits" && <PurchaseReturnsPanel />}
      {tab === "reconciliation" && <SupplierReconciliationPanel />}
      {tab === "settlement" && <SettlementPreparation />}
    </div>
  );
}
