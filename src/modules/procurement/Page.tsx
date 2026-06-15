import { useEffect, useState } from "react";
import { Building2, ClipboardCheck, FileSpreadsheet, FileText, Handshake, PackageCheck, RotateCcw, ShieldCheck } from "lucide-react";
import { SubTabs } from "../../components/ui";
import { CONTRACTS, PORTAL_SUPPLIERS, PURCHASE_RETURNS, RFQS, SUPPLIER_INVOICES } from "../../data/demo-data";
import { isReturnException } from "../../domain/procurement/returns";
import type { PurchaseIntent } from "../../types/scm";
import ContractsPanel from "./ContractsPanel";
import ProcurementWorkflowMap from "./ProcurementWorkflowMap";
import PurchaseReturnsPanel from "./PurchaseReturnsPanel";
import SupplierInvoiceRegister from "./SupplierInvoiceRegister";
import SupplierPortalPanel from "./SupplierPortalPanel";
import ThreeWayMatchPanel from "./ThreeWayMatchPanel";
import PurchasingRequests from "../purchase-requests/Page";
import PurchasingOrders from "../purchasing/Page";
import PurchasingRFQ from "../rfq/Page";
import ReceivingPanel from "../receiving/Page";

type PurTab = "requests" | "rfq" | "orders" | "contracts" | "receiving" | "invoices" | "match" | "returns" | "portal";

type ProcurementPanelProps = {
  intent?: PurchaseIntent | null;
  onOpenRfq?: () => void;
  view?: PurTab;
};

export default function ProcurementPanel({ intent = null, onOpenRfq, view }: ProcurementPanelProps) {
  if (view === "requests") return <PurchasingRequests intent={intent} onOpenRfq={onOpenRfq} />;
  if (view === "orders") return <PurchasingOrders />;
  if (view === "rfq") return <PurchasingRFQ />;
  if (view === "contracts") return <ContractsPanel />;
  if (view === "invoices") return <SupplierInvoiceRegister mode="procurement" />;
  if (view === "match") return <ThreeWayMatchPanel />;
  if (view === "returns") return <PurchaseReturnsPanel />;
  if (view === "receiving") return <ReceivingPanel />;
  if (view === "portal") return <SupplierPortalPanel />;

  return <PurchasingPanel intent={intent} />;
}

function PurchasingPanel({ intent }: { intent: PurchaseIntent | null }) {
  const [tab, setTab] = useState<PurTab>("requests");
  const tabs = [
    { id: "requests",  label: "采购申请",   icon: ClipboardCheck },
    { id: "rfq",       label: "寻源 / RFx", icon: FileSpreadsheet, count: RFQS.length },
    { id: "orders",    label: "采购订单",   icon: FileText },
    { id: "contracts", label: "框架合同",   icon: Handshake,       count: CONTRACTS.length },
    { id: "receiving", label: "收货协同",   icon: PackageCheck },
    { id: "invoices",  label: "发票协同",   icon: FileText,        count: SUPPLIER_INVOICES.filter((invoice) => invoice.matchStatus !== "自动匹配" || invoice.varianceType !== "无差异").length },
    { id: "match",     label: "三单匹配",   icon: ShieldCheck,     count: SUPPLIER_INVOICES.filter((invoice) => invoice.matchStatus !== "自动匹配").length },
    { id: "returns",   label: "采购退货 / 贷项", icon: RotateCcw,  count: PURCHASE_RETURNS.filter((row) => isReturnException(row)).length },
    { id: "portal",    label: "供应商门户", icon: Building2,       count: PORTAL_SUPPLIERS.length },
  ] as const;

  useEffect(() => {
    if (intent) setTab("requests");
  }, [intent?.createdAt]);

  return (
    <div className="space-y-4">
      <ProcurementWorkflowMap />
      <SubTabs tabs={tabs as any} value={tab} onChange={(v) => setTab(v as PurTab)} />
      {tab === "requests"  && <PurchasingRequests intent={intent} />}
      {tab === "orders"    && <PurchasingOrders />}
      {tab === "rfq"       && <PurchasingRFQ />}
      {tab === "contracts" && <ContractsPanel />}
      {tab === "receiving" && <ReceivingPanel />}
      {tab === "invoices"  && <SupplierInvoiceRegister mode="procurement" />}
      {tab === "match"     && <ThreeWayMatchPanel />}
      {tab === "returns"   && <PurchaseReturnsPanel />}
      {tab === "portal"    && <SupplierPortalPanel />}
    </div>
  );
}
