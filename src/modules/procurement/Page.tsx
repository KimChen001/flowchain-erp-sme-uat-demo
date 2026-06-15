import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  ClipboardCheck,
  CreditCard,
  DollarSign,
  Eye,
  FileSpreadsheet,
  FileText,
  Handshake,
  Package,
  Search,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { apiJson } from "../../lib/api-client";
import { exportRowsToCsv } from "../../lib/data-export";
import { fmt } from "../../lib/format";
import { A, Card, Chip, KpiCard, Modal, SectionHeader, SubTabs, inputStyle } from "../../components/ui";
import {
  DocumentActionBar,
  DocumentEvidencePanel,
  DocumentHeader,
  DocumentLinesTable,
  DocumentShell,
  DocumentStatusTimeline,
  DocumentTotals,
  statusTone,
  type TimelineStep,
} from "../../components/document/DocumentShell";
import type { SupplierInvoice, SupplierInvoiceStatus, SupplierInvoiceMatchStatus, PurchaseIntent, SupplierReconciliationStatement } from "../../types/scm";
import { CONTRACTS, PAYABLES, PORTAL_SUPPLIERS, RFQS, SUPPLIER_INVOICES, SUPPLIER_RECONCILIATION_STATEMENTS, purchaseOrders, receivingDocs } from "../../data/demo-data";
import {
  calculateInvoiceMatch,
  getInvoiceVarianceSummary,
  invoiceToMatchQueueItem,
  invoiceToPayable,
  isInvoicePayableReady,
  supplierInvoiceExportRows,
  type InvoiceMatchQueueItem,
} from "../../domain/procurement/invoice-matching";
import { getInvoiceLinkedDocuments, getStatementLinkedDocuments } from "../../domain/procurement/document-links";
import {
  getReconciliationStatusTone,
  getReconciliationSummary,
  isStatementException,
  reconciliationExportRows,
  reconciliationLineExportRows,
} from "../../domain/procurement/reconciliation";
import PurchasingRequests from "../purchase-requests/Page";
import PurchasingOrders from "../purchasing/Page";
import PurchasingRFQ from "../rfq/Page";

type SupplierPerformance = typeof PORTAL_SUPPLIERS[number] & {
  category?: string;
  received?: number;
  passed?: number;
  failed?: number;
  exceptions?: number;
  rejectRate?: number;
  score?: number;
  risk?: string;
  lastIssue?: string;
};

type PurTab = "requests" | "orders" | "rfq" | "contracts" | "invoices" | "match" | "payment" | "reconciliation" | "portal";

type ProcurementPanelProps = {
  intent?: PurchaseIntent | null;
  onOpenRfq?: () => void;
  view?: PurTab;
};

export default function ProcurementPanel({ intent = null, onOpenRfq, view }: ProcurementPanelProps) {
  if (view === "requests") return <PurchasingRequests intent={intent} onOpenRfq={onOpenRfq} />;
  if (view === "orders") return <PurchasingOrders />;
  if (view === "rfq") return <PurchasingRFQ />;
  if (view === "contracts") return <PurchasingContracts />;
  if (view === "invoices") return <SupplierInvoiceRegister />;
  if (view === "match") return <PurchasingMatch />;
  if (view === "payment") return <PurchasingPayment />;
  if (view === "reconciliation") return <SupplierReconciliationPanel />;
  if (view === "portal") return <PurchasingPortal />;

  return <PurchasingPanel intent={intent} />;
}

function PurchasingPanel({ intent }: { intent: PurchaseIntent | null }) {
  const [tab, setTab] = useState<PurTab>("requests");
  const tabs = [
    { id: "requests",  label: "采购申请",   icon: ClipboardCheck },
    { id: "orders",    label: "采购订单",   icon: FileText },
    { id: "rfq",       label: "询价 RFQ",   icon: FileSpreadsheet, count: RFQS.length },
    { id: "contracts", label: "框架合同",   icon: Handshake,       count: CONTRACTS.length },
    { id: "invoices",  label: "供应商发票", icon: FileText,        count: SUPPLIER_INVOICES.length },
    { id: "match",     label: "三单匹配",   icon: ShieldCheck,     count: SUPPLIER_INVOICES.filter((invoice) => invoice.matchStatus !== "自动匹配").length },
    { id: "payment",   label: "应付账款",   icon: CreditCard,      count: SUPPLIER_INVOICES.filter(isInvoicePayableReady).length },
    { id: "reconciliation", label: "供应商对账", icon: FileSpreadsheet, count: SUPPLIER_RECONCILIATION_STATEMENTS.length },
    { id: "portal",    label: "供应商门户", icon: Building2,       count: PORTAL_SUPPLIERS.length },
  ] as const;

  useEffect(() => {
    if (intent) setTab("requests");
  }, [intent?.createdAt]);

  return (
    <div className="space-y-4">
      <SubTabs tabs={tabs as any} value={tab} onChange={(v) => setTab(v as PurTab)} />
      {tab === "requests"  && <PurchasingRequests intent={intent} />}
      {tab === "orders"    && <PurchasingOrders />}
      {tab === "rfq"       && <PurchasingRFQ />}
      {tab === "contracts" && <PurchasingContracts />}
      {tab === "invoices"  && <SupplierInvoiceRegister />}
      {tab === "match"     && <PurchasingMatch />}
      {tab === "payment"   && <PurchasingPayment />}
      {tab === "reconciliation" && <SupplierReconciliationPanel />}
      {tab === "portal"    && <PurchasingPortal />}
    </div>
  );
}

function PurchasingContracts() {
  const exportCsv = () => {
    if (CONTRACTS.length === 0) {
      toast.warning("暂无可导出的数据");
      return;
    }
    exportRowsToCsv("procurement-contracts-export.csv", CONTRACTS.map((contract) => ({
      合同编号: contract.id,
      供应商: contract.supplier,
      范围: contract.scope,
      承诺量: contract.commitVol,
      价格条款: contract.price,
      起始日期: contract.start,
      到期日期: contract.end,
      消耗进度百分比: Math.round(contract.consumed * 100),
      状态: contract.status,
    })));
    toast.success("CSV 已导出");
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="活动合同"   value={String(CONTRACTS.filter(c => c.status !== "已到期").length)} sub="全部供应商" icon={Handshake} color={A.blue} />
        <KpiCard label="即将到期"   value={String(CONTRACTS.filter(c => c.status === "即将到期").length)} sub="30 天内"   icon={AlertTriangle} color={A.orange} />
        <KpiCard label="承诺总额"   value="¥1.42亿"                                                       sub="年化"        icon={DollarSign} color={A.green} />
        <KpiCard label="平均消耗率" value="58%"                                                            sub="承诺量进度"  icon={Activity}    color={A.purple} />
      </div>

      <Card>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>框架合同 (BPA)</h2>
          <button onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all hover:opacity-90"
            style={{ background: A.gray6, color: A.blue }}>
            <FileSpreadsheet size={13} /> 导出 CSV
          </button>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["合同编号", "供应商", "范围", "承诺量", "价格条款", "起始", "到期", "消耗进度", "状态"].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CONTRACTS.map((c, i) => (
              <tr key={c.id} style={{ borderBottom: i < CONTRACTS.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>{c.id}</td>
                <td className="px-5 py-3 font-medium" style={{ color: A.label }}>{c.supplier}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{c.scope}</td>
                <td className="px-5 py-3" style={{ color: A.label }}>{c.commitVol}</td>
                <td className="px-5 py-3" style={{ color: A.green }}>{c.price}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{c.start}</td>
                <td className="px-5 py-3" style={{ color: c.status === "即将到期" ? A.orange : A.label }}>{c.end}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: A.gray5 }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, c.consumed * 100)}%`, background: c.consumed > 0.9 ? A.red : c.consumed > 0.7 ? A.orange : A.green }} />
                    </div>
                    <span className="text-[11px] font-medium" style={{ color: A.label }}>{(c.consumed * 100).toFixed(0)}%</span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <Chip label={c.status} color={c.status === "执行中" ? A.green : c.status === "即将到期" ? A.orange : A.gray1}
                    bg={c.status === "执行中" ? "rgba(52,199,89,0.1)" : c.status === "即将到期" ? "rgba(255,149,0,0.1)" : "rgba(142,142,147,0.1)"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function invoiceStatusStyle(status: SupplierInvoiceStatus) {
  if (status === "存在差异" || status === "已驳回") return { color: A.red, bg: "#fff1f0" };
  if (status === "待匹配" || status === "待审批" || status === "已接收") return { color: A.orange, bg: "#fff8f0" };
  if (status === "已付款" || status === "已过账应付" || status === "已审批" || status === "已匹配") return { color: A.green, bg: "#f0faf4" };
  return { color: A.gray1, bg: A.gray6 };
}

function matchStatusStyle(status: SupplierInvoiceMatchStatus) {
  if (status === "自动匹配" || status === "已解决") return { color: A.green, bg: "#f0faf4" };
  if (status === "差异待处理") return { color: A.red, bg: "#fff1f0" };
  if (status === "人工复核") return { color: A.orange, bg: "#fff8f0" };
  return { color: A.gray1, bg: A.gray6 };
}

function invoiceSourceLabel(source: SupplierInvoice["source"]) {
  return ({
    "supplier-portal": "供应商门户",
    "email-upload": "邮件上传",
    "manual-entry": "手工录入",
    "edi-sample": "EDI 样本",
  } satisfies Record<SupplierInvoice["source"], string>)[source];
}

function invoiceTimeline(invoice: SupplierInvoice): TimelineStep[] {
  const blocked = invoice.status === "已驳回" || invoice.duplicateRisk || invoice.varianceType === "重复发票";
  const hasVariance = invoice.status === "存在差异" || invoice.matchStatus === "差异待处理" || invoice.varianceType !== "无差异";
  const isPaid = invoice.status === "已付款" || invoice.paid;
  const isPosted = invoice.status === "已过账应付" || invoice.postedToAp || isPaid;
  const isApproved = invoice.status === "已审批" || isPosted;
  const isMatched = invoice.status === "已匹配" || invoice.matchStatus === "自动匹配" || invoice.matchStatus === "已解决" || isApproved;
  const wasReceived = invoice.status !== "草稿";
  return [
    { label: "已接收", status: wasReceived ? "done" : "pending", helper: invoice.receivedDate },
    { label: "待匹配", status: blocked ? "blocked" : isMatched || hasVariance ? "done" : "current", helper: invoice.matchStatus },
    { label: hasVariance ? "存在差异" : "已匹配", status: blocked ? "blocked" : hasVariance ? "warning" : isMatched ? "done" : "pending", helper: invoice.varianceType },
    { label: "已审批", status: isApproved ? "done" : blocked || hasVariance ? "pending" : "current", helper: invoice.approvalStatus || "等待 AP 审批" },
    { label: "已过账应付", status: isPosted ? "done" : "pending", helper: invoice.postedToAp ? "已进入应付" : "未过账" },
    { label: "已付款", status: isPaid ? "done" : "pending", helper: invoice.paid ? "付款完成" : "演示待付" },
  ];
}

function SupplierInvoiceRegister() {
  const [invoices, setInvoices] = useState<SupplierInvoice[]>(SUPPLIER_INVOICES);
  const [statusFilter, setStatusFilter] = useState("全部");
  const [varianceFilter, setVarianceFilter] = useState("全部");
  const [search, setSearch] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<SupplierInvoice | null>(null);

  const visibleInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices
      .filter((invoice) => statusFilter === "全部" || invoice.status === statusFilter)
      .filter((invoice) => varianceFilter === "全部" || invoice.varianceType === varianceFilter)
      .filter((invoice) => !q || [
        invoice.invoiceNumber,
        invoice.supplier,
        invoice.relatedPo,
        invoice.relatedGrn || "",
      ].some((value) => value.toLowerCase().includes(q)));
  }, [invoices, search, statusFilter, varianceFilter]);

  const pendingMatch = invoices.filter((invoice) => invoice.status === "待匹配" || invoice.matchStatus === "未匹配").length;
  const varianceInvoices = invoices.filter((invoice) => invoice.varianceType !== "无差异" || invoice.status === "存在差异");
  const pendingApproval = invoices.filter((invoice) => invoice.status === "已匹配" || invoice.status === "待审批").length;
  const posted = invoices.filter((invoice) => invoice.postedToAp).length;
  const dueSoonAmount = invoices
    .filter((invoice) => !invoice.paid && isInvoicePayableReady(invoice))
    .reduce((sum, invoice) => sum + invoice.total, 0);

  function updateInvoice(id: string, patch: Partial<SupplierInvoice>) {
    setInvoices((current) => current.map((invoice) => invoice.id === id ? { ...invoice, ...patch } : invoice));
    setSelectedInvoice((current) => current?.id === id ? { ...current, ...patch } : current);
  }

  function runMatch(invoice: SupplierInvoice) {
    const snapshot = calculateInvoiceMatch(invoice, purchaseOrders, receivingDocs, invoices);
    updateInvoice(invoice.id, {
      status: snapshot.status,
      matchStatus: snapshot.matchStatus,
      varianceType: snapshot.varianceType,
      varianceAmount: snapshot.varianceAmount,
      notes: snapshot.suggestedAction,
    });
    toast.success("匹配已刷新", { description: `${invoice.invoiceNumber} · ${snapshot.varianceType}` });
  }

  function approve(invoice: SupplierInvoice) {
    if (invoice.varianceType !== "无差异" && invoice.matchStatus !== "已解决") {
      toast.warning("仍有差异待处理", { description: "请先解决三单匹配差异，再标记审批。" });
      return;
    }
    updateInvoice(invoice.id, { status: "已审批", approvalStatus: "已审批" });
    toast.success(`${invoice.invoiceNumber} 已标记审批`);
  }

  function postToAp(invoice: SupplierInvoice) {
    if (!["已审批", "已过账应付"].includes(invoice.status)) {
      toast.warning("请先完成发票审批");
      return;
    }
    updateInvoice(invoice.id, { status: "已过账应付", postedToAp: true });
    toast.success(`${invoice.invoiceNumber} 已过账应付`, { description: "仅更新演示状态，不生成会计凭证。" });
  }

  function reject(invoice: SupplierInvoice) {
    updateInvoice(invoice.id, { status: "已驳回", matchStatus: "差异待处理", approvalStatus: "已驳回" });
    toast.success(`${invoice.invoiceNumber} 已驳回`);
  }

  function exportRegister() {
    if (invoices.length === 0) {
      toast.warning("暂无可导出的数据");
      return;
    }
    exportRowsToCsv("supplier-invoices-export.csv", supplierInvoiceExportRows(invoices));
    toast.success("供应商发票 CSV 已导出");
  }

  function exportInvoice(invoice: SupplierInvoice) {
    const headerRows = [
      ["发票ID", invoice.id],
      ["发票号码", invoice.invoiceNumber],
      ["供应商", invoice.supplier],
      ["PO", invoice.relatedPo || ""],
      ["GRN", invoice.relatedGrn || ""],
      ["发票日期", invoice.invoiceDate],
      ["接收日期", invoice.receivedDate],
      ["到期日", invoice.dueDate],
      ["付款条款", invoice.paymentTerms],
      ["AP负责人", invoice.apOwner || ""],
      ["来源", invoiceSourceLabel(invoice.source)],
      ["匹配状态", invoice.matchStatus],
      ["发票状态", invoice.status],
      ["审批状态", invoice.approvalStatus || ""],
      ["重复风险", invoice.duplicateRisk ? "是" : "否"],
      ["差异类型", invoice.varianceType],
      ["未税金额", invoice.subtotal],
      ["税额", invoice.tax],
      ["运费", invoice.freight || 0],
      ["发票总额", invoice.total],
      ["差异金额", invoice.varianceAmount],
      ["已过账应付", invoice.postedToAp ? "是" : "否"],
      ["已付款", invoice.paid ? "是" : "否"],
      ["备注", invoice.notes || ""],
    ].map(([field, value]) => ({ section: "header", field, value }));
    const lineRows = invoice.lines.map((line) => ({
      section: "line",
      field: line.lineId,
      value: `${line.sku} ${line.name}`,
      发票数量: line.quantity,
      单位: line.unit,
      单价: line.unitPrice,
      税率: line.taxRate,
      税额: line.taxAmount,
      行金额: line.lineTotal,
      订购数量: line.orderedQty ?? "",
      收货数量: line.receivedQty ?? "",
      匹配数量: line.matchedQty ?? "",
      差异类型: line.varianceType || invoice.varianceType,
      差异金额: line.varianceAmount ?? invoice.varianceAmount,
    }));
    exportRowsToCsv(`supplier-invoice-detail-${invoice.invoiceNumber}.csv`, [...headerRows, ...lineRows]);
    toast.success("供应商发票详情 CSV 已导出");
  }

  const selectedSnapshot = selectedInvoice
    ? calculateInvoiceMatch(selectedInvoice, purchaseOrders, receivingDocs, invoices)
    : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-6 gap-3">
        <KpiCard label="发票总数" value={String(invoices.length)} sub="发票台账" icon={FileText} color={A.blue} />
        <KpiCard label="待匹配" value={String(pendingMatch)} sub="需补齐 PO/GRN" icon={Search} color={A.orange} />
        <KpiCard label="差异发票" value={String(varianceInvoices.length)} sub={fmt(varianceInvoices.reduce((sum, invoice) => sum + invoice.varianceAmount, 0))} icon={AlertOctagon} color={A.red} />
        <KpiCard label="待审批" value={String(pendingApproval)} sub="匹配后审批" icon={CheckCircle2} color={A.green} />
        <KpiCard label="已过账应付" value={String(posted)} sub="进入应付账款" icon={Wallet} color={A.purple} />
        <KpiCard label="应付待付" value={fmt(dueSoonAmount)} sub="审批/过账发票" icon={CreditCard} color={A.teal} />
      </div>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: A.label }}>供应商发票台账</h2>
            <p className="text-[11px] mt-1" style={{ color: A.sub }}>
              管理供应商发票、发票行、三单匹配、审批和过账应付的演示状态，不写入真实财务系统。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}
              className="h-8 rounded-lg px-2 text-xs outline-none" style={{ background: A.gray6, color: A.label }}>
              {["全部", "待匹配", "存在差异", "已匹配", "待审批", "已审批", "已过账应付", "已付款"].map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={varianceFilter} onChange={(event) => setVarianceFilter(event.target.value)}
              className="h-8 rounded-lg px-2 text-xs outline-none" style={{ background: A.gray6, color: A.label }}>
              {["全部", "无差异", "价格差异", "数量差异", "税额差异", "运费差异", "缺少收货", "缺少PO", "重复发票"].map((item) => <option key={item}>{item}</option>)}
            </select>
            <div className="h-8 px-2 rounded-lg flex items-center gap-1.5" style={{ background: A.gray6 }}>
              <Search size={12} style={{ color: A.gray2 }} />
              <input value={search} onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索发票/供应商/PO/GRN"
                className="w-44 bg-transparent outline-none text-xs"
                style={{ color: A.label }} />
            </div>
            <button onClick={exportRegister}
              className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5"
              style={{ background: "#f0f6ff", color: A.blue }}>
              <FileSpreadsheet size={13} /> 导出 CSV
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                {["发票编号", "供应商", "PO", "GRN", "发票日期", "到期日", "金额", "税额", "付款条款", "匹配状态", "发票状态", "差异类型", "操作"].map((header) => (
                  <th key={header} className="text-left px-4 py-3 font-medium whitespace-nowrap" style={{ color: A.gray1 }}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleInvoices.map((invoice, index) => {
                const statusStyle = invoiceStatusStyle(invoice.status);
                const matchStyle = matchStatusStyle(invoice.matchStatus);
                return (
                  <tr key={invoice.id} style={{ borderBottom: index < visibleInvoices.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                    <td className="px-4 py-3 font-semibold" style={{ color: A.blue }}>{invoice.invoiceNumber}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: A.label }}>{invoice.supplier}</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{invoice.relatedPo || "—"}</td>
                    <td className="px-4 py-3" style={{ color: invoice.relatedGrn ? A.sub : A.orange }}>{invoice.relatedGrn || "缺少"}</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{invoice.invoiceDate}</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{invoice.dueDate}</td>
                    <td className="px-4 py-3 font-semibold" style={{ color: A.label }}>{fmt(invoice.total)}</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{fmt(invoice.tax)}</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{invoice.paymentTerms}</td>
                    <td className="px-4 py-3"><Chip label={invoice.matchStatus} color={matchStyle.color} bg={matchStyle.bg} /></td>
                    <td className="px-4 py-3"><Chip label={invoice.status} color={statusStyle.color} bg={statusStyle.bg} /></td>
                    <td className="px-4 py-3" style={{ color: invoice.varianceType === "无差异" ? A.green : A.red }}>{invoice.varianceType}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setSelectedInvoice(invoice)} className="px-2 py-1 rounded-md font-medium" style={{ background: A.gray6, color: A.blue }}>详情</button>
                        <button onClick={() => runMatch(invoice)} className="px-2 py-1 rounded-md font-medium" style={{ background: "#f0f6ff", color: A.blue }}>运行匹配</button>
                        <button onClick={() => approve(invoice)} className="px-2 py-1 rounded-md font-medium" style={{ background: "#f0faf4", color: A.green }}>审批</button>
                        <button onClick={() => postToAp(invoice)} className="px-2 py-1 rounded-md font-medium" style={{ background: "#faf3ff", color: A.purple }}>过账</button>
                        <button onClick={() => reject(invoice)} className="px-2 py-1 rounded-md font-medium" style={{ background: "#fff1f0", color: A.red }}>驳回</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={Boolean(selectedInvoice)}
        onClose={() => setSelectedInvoice(null)}
        width={980}
        title="供应商发票"
        subtitle="AP Invoice · ERP document form">
        {selectedInvoice && selectedSnapshot && (
          <DocumentShell
            title="供应商发票"
            documentNo={selectedInvoice.invoiceNumber}
            moduleLabel="采购 / 应付"
            status={selectedInvoice.status}
            subtitle={`${selectedInvoice.supplier} · PO ${selectedInvoice.relatedPo || "—"} · GRN ${selectedInvoice.relatedGrn || "缺少"}`}
          >
            <DocumentHeader
              fields={[
                { label: "发票ID", value: selectedInvoice.id },
                { label: "发票号码", value: selectedInvoice.invoiceNumber },
                { label: "供应商", value: selectedInvoice.supplier },
                { label: "PO", value: selectedInvoice.relatedPo || "—", tone: selectedInvoice.relatedPo ? "info" : "warning" },
                { label: "GRN", value: selectedInvoice.relatedGrn || "缺少", tone: selectedInvoice.relatedGrn ? "info" : "warning" },
                { label: "发票日期", value: selectedInvoice.invoiceDate },
                { label: "接收日期", value: selectedInvoice.receivedDate },
                { label: "到期日", value: selectedInvoice.dueDate },
                { label: "付款条款", value: selectedInvoice.paymentTerms },
                { label: "AP负责人", value: selectedInvoice.apOwner || "—" },
                { label: "来源", value: invoiceSourceLabel(selectedInvoice.source) },
                { label: "匹配状态", value: selectedInvoice.matchStatus, tone: statusTone(selectedInvoice.matchStatus) },
                { label: "发票状态", value: selectedInvoice.status, tone: statusTone(selectedInvoice.status) },
                { label: "审批状态", value: selectedInvoice.approvalStatus || "—" },
                { label: "重复风险", value: selectedInvoice.duplicateRisk ? "是" : "否", tone: selectedInvoice.duplicateRisk ? "danger" : "success" },
                { label: "差异类型", value: selectedSnapshot.varianceType, tone: selectedSnapshot.varianceType === "无差异" ? "success" : "danger" },
              ]}
            />
            <DocumentStatusTimeline steps={invoiceTimeline(selectedInvoice)} />
            <DocumentLinesTable
              rows={selectedInvoice.lines}
              columns={[
                { key: "sku", label: "SKU", render: (line) => <span style={{ color: A.blue }}>{String(line.sku)}</span> },
                { key: "name", label: "品名" },
                { key: "quantity", label: "发票数量", align: "right", render: (line) => Number(line.quantity).toLocaleString() },
                { key: "unit", label: "单位" },
                { key: "unitPrice", label: "单价", align: "right", render: (line) => fmt(Number(line.unitPrice || 0)) },
                { key: "taxRate", label: "税率", align: "right", render: (line) => `${Math.round(Number(line.taxRate || 0) * 100)}%` },
                { key: "taxAmount", label: "税额", align: "right", render: (line) => fmt(Number(line.taxAmount || 0)) },
                { key: "lineTotal", label: "行金额", align: "right", render: (line) => fmt(Number(line.lineTotal || 0)) },
                { key: "orderedQty", label: "订购数量", align: "right", render: (line) => line.orderedQty ?? "—" },
                { key: "receivedQty", label: "收货数量", align: "right", render: (line) => line.receivedQty ?? "—" },
                { key: "matchedQty", label: "匹配数量", align: "right", render: (line) => line.matchedQty ?? "—" },
                { key: "varianceType", label: "差异类型", render: (line) => String(line.varianceType || selectedInvoice.varianceType) },
                { key: "varianceAmount", label: "差异金额", align: "right", render: (line) => fmt(Number(line.varianceAmount ?? selectedInvoice.varianceAmount ?? 0)) },
              ]}
            />
            <DocumentTotals
              totals={[
                { label: "未税金额", value: fmt(selectedInvoice.subtotal) },
                { label: "税额", value: fmt(selectedInvoice.tax) },
                { label: "运费", value: fmt(selectedInvoice.freight || 0) },
                { label: "发票总额", value: fmt(selectedInvoice.total), tone: "info" },
                { label: "差异金额", value: fmt(selectedSnapshot.varianceAmount), tone: selectedSnapshot.varianceAmount ? "danger" : "success" },
              ]}
              columns={5}
            />
            <DocumentEvidencePanel
              linkedDocuments={getInvoiceLinkedDocuments(selectedInvoice, purchaseOrders, receivingDocs)}
              confidence={`${selectedInvoice.confidence || 0}%`}
              provenance={invoiceSourceLabel(selectedInvoice.source)}
              notes={selectedInvoice.notes || `${getInvoiceVarianceSummary(selectedInvoice)} 三单匹配为演示规则，用于比较 PO、GRN 与供应商发票的金额、数量与状态差异。`}
              evidence={[
                { label: "PO 金额", value: fmt(selectedSnapshot.poAmount) },
                { label: "GRN 金额", value: fmt(selectedSnapshot.grnAmount) },
                { label: "发票金额", value: fmt(selectedSnapshot.invoiceAmount) },
                { label: "匹配状态", value: selectedSnapshot.matchStatus, tone: statusTone(selectedSnapshot.matchStatus) },
                { label: "差异类型", value: selectedSnapshot.varianceType, tone: selectedSnapshot.varianceType === "无差异" ? "success" : "danger" },
                { label: "重复风险", value: selectedInvoice.duplicateRisk ? "是" : "否", tone: selectedInvoice.duplicateRisk ? "danger" : "success" },
              ]}
            />
            <DocumentActionBar>
              <button onClick={() => runMatch(selectedInvoice)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "#f0f6ff", color: A.blue }}>运行匹配</button>
              <button onClick={() => approve(selectedInvoice)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "#f0faf4", color: A.green }}>标记已审批</button>
              <button onClick={() => postToAp(selectedInvoice)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "#faf3ff", color: A.purple }}>过账到应付</button>
              <button onClick={() => reject(selectedInvoice)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "#fff1f0", color: A.red }}>驳回</button>
              <button onClick={() => exportInvoice(selectedInvoice)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: A.white, color: A.blue, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)" }}>导出 CSV</button>
              <button onClick={() => setSelectedInvoice(null)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: A.white, color: A.label, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)" }}>关闭</button>
            </DocumentActionBar>
          </DocumentShell>
        )}
      </Modal>
    </div>
  );
}

function PurchasingMatch() {
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
              三单匹配为演示规则，用于比较采购订单、收货单和供应商发票的金额、数量与状态差异。
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

function PurchasingPayment() {
  const invoicePayables = SUPPLIER_INVOICES.filter(isInvoicePayableReady).map(invoiceToPayable);
  const [payables, setPayables] = useState(() => [
    ...invoicePayables,
    ...PAYABLES.filter((item) => !invoicePayables.some((invoiceItem) => invoiceItem.invoice === item.invoice)),
  ]);
  const exportCsv = () => {
    if (payables.length === 0) {
      toast.warning("暂无可导出的数据");
      return;
    }
    exportRowsToCsv("procurement-payables-export.csv", payables.map((item) => ({
      应付编号: item.id,
      供应商: item.supplier,
      发票: item.invoice,
      金额: item.amount,
      条款: item.terms,
      到期日: item.due,
      账龄天数: item.aging,
      状态: item.status,
    })));
    toast.success("CSV 已导出");
  };
  const pay = (id: string) => {
    setPayables(prev => prev.map(p => p.id === id ? { ...p, status: "已付款" as const } : p));
    toast.success(`${id} 已标记付款`, { description: "仅更新演示状态，不生成银行付款指令。" });
  };

  const totalDue = payables.filter(p => p.status !== "已付款").reduce((a, b) => a + b.amount, 0);
  const overdue  = payables.filter(p => p.status === "逾期").reduce((a, b) => a + b.amount, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="应付总额"   value={`¥${(totalDue / 1e4).toFixed(0)}万`}    sub="来自已审批/过账发票"                icon={Wallet}      color={A.blue} />
        <KpiCard label="逾期金额"   value={`¥${(overdue / 1e4).toFixed(1)}万`}     sub={`${payables.filter(p => p.status === "逾期").length} 笔逾期`} icon={AlertOctagon} color={A.red} />
        <KpiCard label="7 天到期"   value="¥146万"                                  sub="3 笔"                              icon={Clock}       color={A.orange} />
        <KpiCard label="DPO"        value="48.2 天"                                 sub="应付账款周转天数" delta="+2.1d"    icon={CreditCard}  color={A.purple} />
      </div>

      <Card>
        <div className="px-5 py-4 flex items-start justify-between gap-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: A.label }}>应付账款</h2>
            <p className="text-[11px] mt-1" style={{ color: A.sub }}>
              应付账款来自已审批或已过账的供应商发票；供应商对账按供应商和期间汇总发票、应付、付款和差异，付款动作仅为演示状态。
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
              {["AP 编号", "供应商", "发票", "金额", "付款条款", "到期日", "账龄", "状态", "操作"].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payables.map((p, i) => (
              <tr key={p.id} style={{ borderBottom: i < payables.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>{p.id}</td>
                <td className="px-5 py-3" style={{ color: A.label }}>{p.supplier}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{p.invoice}</td>
                <td className="px-5 py-3 font-medium" style={{ color: A.label }}>¥{p.amount.toLocaleString()}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{p.terms}</td>
                <td className="px-5 py-3" style={{ color: p.aging > 0 ? A.red : A.label }}>{p.due}</td>
                <td className="px-5 py-3 font-medium" style={{ color: p.aging > 0 ? A.red : p.aging > -7 ? A.orange : A.green }}>
                  {p.aging > 0 ? `逾期 ${p.aging} 天` : `还剩 ${Math.abs(p.aging)} 天`}
                </td>
                <td className="px-5 py-3">
                  <Chip label={p.status} color={p.status === "已付款" ? A.green : p.status === "逾期" ? A.red : p.status === "部分付款" ? A.orange : A.blue}
                    bg={p.status === "已付款" ? "rgba(52,199,89,0.1)" : p.status === "逾期" ? "rgba(255,59,48,0.1)" : p.status === "部分付款" ? "rgba(255,149,0,0.1)" : "rgba(0,113,227,0.1)"} />
                </td>
                <td className="px-5 py-3">
                  {p.status !== "已付款" && <button onClick={() => pay(p.id)} className="px-2 py-1 text-[11px] font-medium rounded-md text-white" style={{ background: A.green }}>付款</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function statementPeriod(statement: SupplierReconciliationStatement) {
  return `${statement.periodStart} ~ ${statement.periodEnd}`;
}

function reconciliationChipStyle(status: string) {
  const tone = getReconciliationStatusTone(status);
  if (tone === "success") return { color: A.green, bg: "#f0faf4" };
  if (tone === "warning") return { color: A.orange, bg: "#fff8f0" };
  if (tone === "danger") return { color: A.red, bg: "#fff1f0" };
  return { color: A.gray1, bg: A.gray6 };
}

function reconciliationTimeline(statement: SupplierReconciliationStatement): TimelineStep[] {
  const rejected = statement.status === "已驳回";
  const closed = statement.status === "已关闭";
  const confirmed = statement.status === "已确认" || closed;
  const hasException = statement.status === "存在差异" || statement.exceptionCount > 0 || statement.totalVarianceAmount > 0;
  const settled = statement.settlementStatus === "已结算";
  const partiallySettled = statement.settlementStatus === "部分结算";

  return [
    { label: "草稿", status: statement.status === "草稿" ? "current" : "done", helper: statement.createdDate },
    {
      label: "待确认",
      status: rejected ? "blocked" : ["待确认", "存在差异", "已确认", "已关闭"].includes(statement.status) ? "done" : "pending",
      helper: statement.owner,
    },
    {
      label: rejected ? "已驳回" : hasException ? "存在差异" : "已确认",
      status: rejected ? "blocked" : hasException && !confirmed ? "warning" : confirmed ? "done" : statement.status === "待确认" ? "current" : "pending",
      helper: rejected ? statement.rejectReason : hasException ? `${statement.exceptionCount} 项异常` : statement.confirmedDate || "等待供应商确认",
    },
    {
      label: statement.settlementStatus,
      status: settled ? "done" : partiallySettled ? "warning" : statement.openBalance > 0 ? "current" : "pending",
      helper: statement.openBalance > 0 ? `未结 ${fmt(statement.openBalance)}` : "已结清",
    },
    { label: "已关闭", status: closed ? "done" : rejected ? "blocked" : "pending", helper: closed ? "对账关闭" : "可关闭" },
  ];
}

function SupplierReconciliationPanel() {
  const [statements, setStatements] = useState<SupplierReconciliationStatement[]>(SUPPLIER_RECONCILIATION_STATEMENTS);
  const [statusFilter, setStatusFilter] = useState("全部");
  const [settlementFilter, setSettlementFilter] = useState("全部");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("");
  const [selectedStatement, setSelectedStatement] = useState<SupplierReconciliationStatement | null>(null);

  const visibleStatements = useMemo(() => {
    const q = search.trim().toLowerCase();
    const p = period.trim().toLowerCase();
    return statements
      .filter((statement) => statusFilter === "全部" || statement.status === statusFilter)
      .filter((statement) => settlementFilter === "全部" || statement.settlementStatus === settlementFilter)
      .filter((statement) => !q || [statement.statementNo, statement.supplier, statement.supplierCode || ""].some((value) => value.toLowerCase().includes(q)))
      .filter((statement) => !p || statementPeriod(statement).toLowerCase().includes(p));
  }, [period, search, settlementFilter, statements, statusFilter]);

  const pending = statements.filter((statement) => statement.status === "待确认").length;
  const exceptions = statements.filter(isStatementException).length;
  const openBalance = statements.reduce((sum, statement) => sum + statement.openBalance, 0);
  const overdue = statements.reduce((sum, statement) => sum + statement.overdueAmount, 0);
  const paid = statements.reduce((sum, statement) => sum + statement.totalPaidAmount, 0);

  function updateStatement(id: string, patch: Partial<SupplierReconciliationStatement>) {
    setStatements((current) => current.map((statement) => statement.id === id ? { ...statement, ...patch } : statement));
    setSelectedStatement((current) => current?.id === id ? { ...current, ...patch } : current);
  }

  function confirm(statement: SupplierReconciliationStatement) {
    updateStatement(statement.id, { status: "已确认", confirmedDate: statement.confirmedDate || "2026-06-02", rejectReason: undefined });
    toast.success(`${statement.statementNo} 已标记确认`);
  }

  function reject(statement: SupplierReconciliationStatement) {
    updateStatement(statement.id, { status: "已驳回", rejectReason: statement.rejectReason || "供应商反馈金额或单据差异，需重新核对。" });
    toast.success(`${statement.statementNo} 已标记驳回`);
  }

  function close(statement: SupplierReconciliationStatement) {
    updateStatement(statement.id, { status: "已关闭" });
    toast.success(`${statement.statementNo} 已关闭`);
  }

  function exportList() {
    if (visibleStatements.length === 0) {
      toast.warning("暂无可导出的对账单");
      return;
    }
    exportRowsToCsv("supplier-reconciliation-export.csv", reconciliationExportRows(visibleStatements));
    toast.success("供应商对账单 CSV 已导出");
  }

  function exportDetail(statement: SupplierReconciliationStatement) {
    if (statement.lines.length === 0) {
      toast.warning("暂无可导出的对账明细");
      return;
    }
    exportRowsToCsv(`supplier-reconciliation-detail-${statement.statementNo}.csv`, reconciliationLineExportRows(statement));
    toast.success("对账明细 CSV 已导出");
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <KpiCard label="对账单数" value={String(statements.length)} sub="样本期间" icon={FileSpreadsheet} color={A.blue} />
        <KpiCard label="待确认" value={String(pending)} sub="供应商确认" icon={Clock} color={A.orange} />
        <KpiCard label="差异对账" value={String(exceptions)} sub="含逾期/驳回" icon={AlertOctagon} color={A.red} />
        <KpiCard label="未结算余额" value={fmt(openBalance)} sub="应付 - 已付" icon={Wallet} color={A.purple} />
        <KpiCard label="逾期应付" value={fmt(overdue)} sub="需 AP 复核" icon={AlertTriangle} color={A.orange} />
        <KpiCard label="本期已付" value={fmt(paid)} sub="演示付款状态" icon={CreditCard} color={A.green} />
      </div>

      <Card>
        <div className="px-5 py-4 flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: A.label }}>供应商对账单</h2>
            <p className="text-[11px] mt-1" style={{ color: A.sub }}>
              按供应商和对账期间汇总 PO、GRN、供应商发票、三单匹配、AP 与付款状态，仅用于演示环境样本数据。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}
              className="h-8 rounded-lg px-2 text-xs outline-none" style={{ background: A.gray6, color: A.label }}>
              {["全部", "待确认", "存在差异", "已确认", "已驳回", "已关闭"].map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={settlementFilter} onChange={(event) => setSettlementFilter(event.target.value)}
              className="h-8 rounded-lg px-2 text-xs outline-none" style={{ background: A.gray6, color: A.label }}>
              {["全部", "未结算", "部分结算", "已结算"].map((item) => <option key={item}>{item}</option>)}
            </select>
            <input value={period} onChange={(event) => setPeriod(event.target.value)} placeholder="期间"
              className="h-8 w-28 rounded-lg px-2 text-xs outline-none" style={{ background: A.gray6, color: A.label }} />
            <div className="h-8 px-2 rounded-lg flex items-center gap-1.5" style={{ background: A.gray6 }}>
              <Search size={13} style={{ color: A.gray1 }} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="供应商/单号"
                className="w-32 bg-transparent text-xs outline-none" style={{ color: A.label }} />
            </div>
            <button onClick={exportList}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all hover:opacity-90"
              style={{ background: A.gray6, color: A.blue }}>
              <FileSpreadsheet size={13} /> 导出 CSV
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                {["对账单号", "供应商", "对账期间", "发票数", "应付金额", "已付金额", "调整金额", "差异金额", "未结余额", "逾期金额", "状态", "结算状态", "操作"].map((header) => (
                  <th key={header} className="text-left px-5 py-3 font-medium whitespace-nowrap" style={{ color: A.gray1 }}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleStatements.map((statement, index) => (
                <tr key={statement.id} style={{ borderBottom: index < visibleStatements.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                  <td className="px-5 py-3 font-semibold whitespace-nowrap" style={{ color: A.blue }}>{statement.statementNo}</td>
                  <td className="px-5 py-3 whitespace-nowrap" style={{ color: A.label }}>{statement.supplier}</td>
                  <td className="px-5 py-3 whitespace-nowrap" style={{ color: A.sub }}>{statementPeriod(statement)}</td>
                  <td className="px-5 py-3" style={{ color: A.label }}>{statement.invoiceCount}</td>
                  <td className="px-5 py-3 font-medium whitespace-nowrap" style={{ color: A.label }}>{fmt(statement.totalPayableAmount)}</td>
                  <td className="px-5 py-3 font-medium whitespace-nowrap" style={{ color: A.green }}>{fmt(statement.totalPaidAmount)}</td>
                  <td className="px-5 py-3 whitespace-nowrap" style={{ color: statement.totalAdjustmentAmount ? A.orange : A.sub }}>{fmt(statement.totalAdjustmentAmount)}</td>
                  <td className="px-5 py-3 font-medium whitespace-nowrap" style={{ color: statement.totalVarianceAmount ? A.red : A.green }}>{statement.totalVarianceAmount ? fmt(statement.totalVarianceAmount) : "—"}</td>
                  <td className="px-5 py-3 font-medium whitespace-nowrap" style={{ color: statement.openBalance ? A.purple : A.green }}>{fmt(statement.openBalance)}</td>
                  <td className="px-5 py-3 font-medium whitespace-nowrap" style={{ color: statement.overdueAmount ? A.red : A.green }}>{statement.overdueAmount ? fmt(statement.overdueAmount) : "—"}</td>
                  <td className="px-5 py-3 whitespace-nowrap"><Chip label={statement.status} {...reconciliationChipStyle(statement.status)} /></td>
                  <td className="px-5 py-3 whitespace-nowrap"><Chip label={statement.settlementStatus} {...reconciliationChipStyle(statement.settlementStatus)} /></td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1 min-w-[260px]">
                      <button onClick={() => setSelectedStatement(statement)} className="px-2 py-1 text-[11px] font-medium rounded-md" style={{ background: A.gray6, color: A.blue }}>查看详情</button>
                      <button onClick={() => confirm(statement)} className="px-2 py-1 text-[11px] font-medium rounded-md" style={{ background: "#f0faf4", color: A.green }}>标记已确认</button>
                      <button onClick={() => reject(statement)} className="px-2 py-1 text-[11px] font-medium rounded-md" style={{ background: "#fff1f0", color: A.red }}>标记已驳回</button>
                      <button onClick={() => close(statement)} className="px-2 py-1 text-[11px] font-medium rounded-md" style={{ background: "#faf3ff", color: A.purple }}>关闭对账</button>
                      <button onClick={() => exportDetail(statement)} className="px-2 py-1 text-[11px] font-medium rounded-md" style={{ background: A.gray6, color: A.gray1 }}>导出明细</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={Boolean(selectedStatement)} onClose={() => setSelectedStatement(null)} width={1180}
        title={selectedStatement?.statementNo || "供应商对账单"}
        subtitle={selectedStatement ? `${selectedStatement.supplier} · ${statementPeriod(selectedStatement)}` : undefined}>
        {selectedStatement && (
          <DocumentShell
            title="供应商对账单"
            documentNo={selectedStatement.statementNo}
            moduleLabel="采购 / 对账"
            status={selectedStatement.status}
            statusTone={getReconciliationStatusTone(selectedStatement.status)}
            subtitle={`${selectedStatement.supplier} · ${statementPeriod(selectedStatement)}`}
          >
            <DocumentHeader
              fields={[
                { label: "对账单ID", value: selectedStatement.id },
                { label: "对账单号", value: selectedStatement.statementNo },
                { label: "供应商", value: selectedStatement.supplier, helper: selectedStatement.supplierCode || "—" },
                { label: "对账期间", value: statementPeriod(selectedStatement) },
                { label: "币种", value: selectedStatement.currency },
                { label: "负责人", value: selectedStatement.owner },
                { label: "创建日期", value: selectedStatement.createdDate },
                { label: "确认日期", value: selectedStatement.confirmedDate || "—" },
                { label: "状态", value: selectedStatement.status, tone: getReconciliationStatusTone(selectedStatement.status) },
                { label: "结算状态", value: selectedStatement.settlementStatus, tone: getReconciliationStatusTone(selectedStatement.settlementStatus) },
                { label: "来源", value: selectedStatement.source },
                { label: "拒绝原因", value: selectedStatement.rejectReason || "—", tone: selectedStatement.rejectReason ? "danger" : "neutral" },
              ]}
            />
            <DocumentStatusTimeline steps={reconciliationTimeline(selectedStatement)} />
            <DocumentLinesTable
              rows={selectedStatement.lines}
              columns={[
                { key: "bizType", label: "类型" },
                { key: "bizId", label: "业务单据", render: (line) => <span style={{ color: A.blue }}>{String(line.bizId)}</span> },
                { key: "documentDate", label: "日期" },
                { key: "dueDate", label: "到期日", render: (line) => line.dueDate || "—" },
                { key: "description", label: "描述" },
                { key: "payableAmount", label: "应付金额", align: "right", render: (line) => fmt(Number(line.payableAmount || 0)) },
                { key: "paidAmount", label: "已付金额", align: "right", render: (line) => fmt(Number(line.paidAmount || 0)) },
                { key: "varianceAmount", label: "差异金额", align: "right", render: (line) => Number(line.varianceAmount || 0) ? <span style={{ color: A.red }}>{fmt(Number(line.varianceAmount || 0))}</span> : "—" },
                { key: "status", label: "状态" },
                { key: "relatedPo", label: "关联 PO", render: (line) => line.relatedPo || "—" },
                { key: "relatedGrn", label: "关联 GRN", render: (line) => line.relatedGrn || "—" },
                { key: "relatedInvoice", label: "关联发票", render: (line) => line.relatedInvoice || "—" },
                { key: "notes", label: "备注", render: (line) => line.notes || line.matchStatus || "—" },
              ]}
            />
            <DocumentTotals
              columns={5}
              totals={[
                { label: "发票金额", value: fmt(selectedStatement.totalInvoiceAmount) },
                { label: "应付金额", value: fmt(selectedStatement.totalPayableAmount), tone: "info" },
                { label: "已付金额", value: fmt(selectedStatement.totalPaidAmount), tone: selectedStatement.totalPaidAmount ? "success" : "neutral" },
                { label: "调整金额", value: fmt(selectedStatement.totalAdjustmentAmount), tone: selectedStatement.totalAdjustmentAmount ? "warning" : "neutral" },
                { label: "差异金额", value: fmt(selectedStatement.totalVarianceAmount), tone: selectedStatement.totalVarianceAmount ? "danger" : "success" },
                { label: "未结余额", value: fmt(selectedStatement.openBalance), tone: selectedStatement.openBalance ? "purple" : "success" },
                { label: "逾期金额", value: fmt(selectedStatement.overdueAmount), tone: selectedStatement.overdueAmount ? "danger" : "success" },
              ]}
            />
            <DocumentEvidencePanel
              linkedDocuments={getStatementLinkedDocuments(selectedStatement, SUPPLIER_INVOICES, purchaseOrders, receivingDocs)}
              confidence={selectedStatement.confidence ? `${selectedStatement.confidence}%` : "—"}
              provenance={selectedStatement.source}
              notes={selectedStatement.notes || getReconciliationSummary(selectedStatement)}
              evidence={[
                { label: "发票数", value: selectedStatement.invoiceCount },
                { label: "异常数", value: selectedStatement.exceptionCount, tone: selectedStatement.exceptionCount ? "danger" : "success" },
                { label: "未结余额", value: fmt(selectedStatement.openBalance), tone: selectedStatement.openBalance ? "purple" : "success" },
                { label: "逾期金额", value: fmt(selectedStatement.overdueAmount), tone: selectedStatement.overdueAmount ? "danger" : "success" },
                { label: "结算状态", value: selectedStatement.settlementStatus, tone: getReconciliationStatusTone(selectedStatement.settlementStatus) },
                { label: "建议动作", value: getReconciliationSummary(selectedStatement), tone: isStatementException(selectedStatement) ? "warning" : "success" },
              ]}
            />
            <DocumentActionBar>
              <button onClick={() => confirm(selectedStatement)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "#f0faf4", color: A.green }}>标记已确认</button>
              <button onClick={() => reject(selectedStatement)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "#fff1f0", color: A.red }}>标记已驳回</button>
              <button onClick={() => close(selectedStatement)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "#faf3ff", color: A.purple }}>关闭对账</button>
              <button onClick={() => exportDetail(selectedStatement)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: A.white, color: A.blue, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)" }}>导出明细 CSV</button>
              <button onClick={() => setSelectedStatement(null)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: A.white, color: A.label, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)" }}>关闭</button>
            </DocumentActionBar>
          </DocumentShell>
        )}
      </Modal>
    </div>
  );
}

function PurchasingPortal() {
  const [suppliers, setSuppliers] = useState<SupplierPerformance[]>(PORTAL_SUPPLIERS);
  const [loading, setLoading] = useState(true);
  const exportCsv = () => {
    if (suppliers.length === 0) {
      toast.warning("暂无可导出的数据");
      return;
    }
    exportRowsToCsv("supplier-performance-export.csv", suppliers.map((supplier) => ({
      供应商: supplier.name,
      品类: supplier.category || "供应商",
      评级: supplier.rating,
      准时率: supplier.onTime,
      质量合格率: supplier.quality,
      质检异常: Number(supplier.exceptions || 0),
      拒收率: Number(supplier.rejectRate || 0),
      YTD采购订单: supplier.po,
      YTD采购额: supplier.spend,
      战略分级: supplier.flag,
      最近问题: supplier.lastIssue || "",
    })));
    toast.success("CSV 已导出");
  };

  useEffect(() => {
    let alive = true;
    apiJson<SupplierPerformance[]>("/api/supplier-performance")
      .then((data) => { if (alive) setSuppliers(data); })
      .catch(() => toast.error("供应商绩效 API 未连接", { description: "已显示本地样例绩效" }))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const strategic = suppliers.filter(s => s.flag === "战略").length;
  const avgRating = suppliers.length ? suppliers.reduce((a, b) => a + Number(b.rating || 0), 0) / suppliers.length : 0;
  const rectifying = suppliers.filter(s => s.flag === "整改").length;
  const exceptions = suppliers.reduce((sum, item) => sum + Number(item.exceptions || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="注册供应商" value={String(suppliers.length)} sub={loading ? "加载绩效" : "活动"} icon={Building2} color={A.blue} />
        <KpiCard label="战略供应商" value={String(strategic)} sub="核心合作" icon={Handshake} color={A.purple} />
        <KpiCard label="平均评分"   value={avgRating.toFixed(1)} sub="5 分制" delta={exceptions ? `${exceptions} 起质检异常` : "+0.2"} positive={!exceptions} icon={Sparkles} color={A.green} />
        <KpiCard label="整改中"     value={String(rectifying)} sub="质量 / 交付预警" icon={AlertTriangle} color={A.red} />
      </div>

      <Card>
        <div className="px-5 py-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold" style={{ color: A.label }}>供应商绩效记分卡</h2>
            <div className="flex items-center gap-3">
              <span className="text-[11px]" style={{ color: A.gray2 }}>PO + GRN 质检动态评分</span>
              <button onClick={exportCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all hover:opacity-90"
                style={{ background: A.gray6, color: A.blue }}>
                <FileSpreadsheet size={13} /> 导出 CSV
              </button>
            </div>
          </div>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["供应商", "评级", "准时率", "动态合格率", "质检异常", "YTD PO", "YTD 采购额", "战略分级"].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s, i) => (
              <tr key={s.name} style={{ borderBottom: i < suppliers.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-5 py-3 font-medium" style={{ color: A.label }}>
                  <div>{s.name}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: A.gray2 }}>{s.category || "供应商"}{s.lastIssue ? ` · ${s.lastIssue}` : ""}</div>
                </td>
                <td className="px-5 py-3 font-medium" style={{ color: s.rating >= 4.5 ? A.green : s.rating >= 4.0 ? A.blue : A.orange }}>{Number(s.rating || 0).toFixed(1)} ★</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-14 h-1 rounded-full overflow-hidden" style={{ background: A.gray5 }}>
                      <div className="h-full rounded-full" style={{ width: `${s.onTime}%`, background: s.onTime >= 95 ? A.green : s.onTime >= 90 ? A.blue : A.orange }} />
                    </div>
                    <span className="text-[11px] font-medium" style={{ color: A.label }}>{s.onTime}%</span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-14 h-1 rounded-full overflow-hidden" style={{ background: A.gray5 }}>
                      <div className="h-full rounded-full" style={{ width: `${s.quality}%`, background: s.quality >= 98 ? A.green : s.quality >= 95 ? A.blue : A.orange }} />
                    </div>
                    <span className="text-[11px] font-medium" style={{ color: A.label }}>{s.quality}%</span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <div className="font-medium" style={{ color: Number(s.exceptions || 0) > 0 ? A.red : A.green }}>{Number(s.exceptions || 0)} 起</div>
                  <div className="text-[10px]" style={{ color: A.gray2 }}>拒收率 {Number(s.rejectRate || 0).toFixed(1)}%</div>
                </td>
                <td className="px-5 py-3" style={{ color: A.label }}>{s.po}</td>
                <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>¥{(s.spend / 1e4).toFixed(0)}万</td>
                <td className="px-5 py-3">
                  <Chip label={s.flag}
                    color={s.flag === "战略" ? A.purple : s.flag === "核心" ? A.blue : s.flag === "备选" ? A.gray1 : A.red}
                    bg={s.flag === "战略" ? "rgba(175,82,222,0.1)" : s.flag === "核心" ? "rgba(0,113,227,0.1)" : s.flag === "备选" ? "rgba(142,142,147,0.1)" : "rgba(255,59,48,0.1)"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
