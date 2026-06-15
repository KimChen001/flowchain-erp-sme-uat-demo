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
import type { SupplierInvoice, SupplierInvoiceStatus, SupplierInvoiceMatchStatus, PurchaseIntent } from "../../types/scm";
import { CONTRACTS, PAYABLES, PORTAL_SUPPLIERS, RFQS, SUPPLIER_INVOICES, purchaseOrders, receivingDocs } from "../../data/demo-data";
import {
  calculateInvoiceMatch,
  getInvoiceVarianceSummary,
  invoiceToMatchQueueItem,
  invoiceToPayable,
  isInvoicePayableReady,
  supplierInvoiceExportRows,
  type InvoiceMatchQueueItem,
} from "../../domain/procurement/invoice-matching";
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

type PurTab = "requests" | "orders" | "rfq" | "contracts" | "invoices" | "match" | "payment" | "portal";

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
    exportRowsToCsv(`supplier-invoice-${invoice.invoiceNumber}.csv`, invoice.lines.map((line) => ({
      发票号码: invoice.invoiceNumber,
      供应商: invoice.supplier,
      PO: invoice.relatedPo,
      GRN: invoice.relatedGrn || "",
      SKU: line.sku,
      品名: line.name,
      发票数量: line.quantity,
      单位: line.unit,
      单价: line.unitPrice,
      税额: line.taxAmount,
      行总额: line.lineTotal,
      订购数量: line.orderedQty ?? "",
      收货数量: line.receivedQty ?? "",
      差异类型: line.varianceType || invoice.varianceType,
      差异金额: line.varianceAmount ?? invoice.varianceAmount,
    })));
    toast.success("发票明细 CSV 已导出");
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
              PO 支持发票、发票行、三单匹配、审批和过账应付的演示状态，不写入真实财务系统。
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
        width={900}
        title={selectedInvoice?.invoiceNumber || "供应商发票"}
        subtitle={selectedInvoice ? `${selectedInvoice.supplier} · ${selectedInvoice.status}` : undefined}
        footer={selectedInvoice && (
          <>
            <button onClick={() => runMatch(selectedInvoice)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "#f0f6ff", color: A.blue }}>运行匹配</button>
            <button onClick={() => approve(selectedInvoice)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "#f0faf4", color: A.green }}>标记已审批</button>
            <button onClick={() => postToAp(selectedInvoice)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "#faf3ff", color: A.purple }}>过账到应付</button>
            <button onClick={() => exportInvoice(selectedInvoice)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: A.white, color: A.blue, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)" }}>导出 CSV</button>
            <button onClick={() => setSelectedInvoice(null)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: A.white, color: A.label, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)" }}>关闭</button>
          </>
        )}>
        {selectedInvoice && selectedSnapshot && (
          <div className="space-y-4">
            <div className="grid grid-cols-5 gap-2">
              {[
                ["PO", selectedInvoice.relatedPo || "—", A.blue],
                ["GRN", selectedInvoice.relatedGrn || "缺少", selectedInvoice.relatedGrn ? A.label : A.orange],
                ["发票总额", fmt(selectedInvoice.total), A.label],
                ["差异", selectedInvoice.varianceAmount ? fmt(selectedInvoice.varianceAmount) : "无", selectedInvoice.varianceAmount ? A.red : A.green],
                ["置信度", `${selectedInvoice.confidence || 0}%`, A.green],
              ].map(([label, value, color]) => (
                <div key={String(label)} className="rounded-xl p-3" style={{ background: A.gray6 }}>
                  <div className="text-[10px]" style={{ color: A.gray2 }}>{label}</div>
                  <div className="text-sm font-semibold mt-1 truncate" style={{ color: String(color) }}>{value}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl p-3" style={{ background: "#f0f6ff" }}>
                <div className="text-[11px] font-semibold" style={{ color: A.blue }}>匹配快照</div>
                <div className="grid grid-cols-2 gap-y-1 mt-2 text-[10px]">
                  <span style={{ color: A.gray2 }}>PO 金额</span><span style={{ color: A.label }}>{fmt(selectedSnapshot.poAmount)}</span>
                  <span style={{ color: A.gray2 }}>GRN 金额</span><span style={{ color: A.label }}>{fmt(selectedSnapshot.grnAmount)}</span>
                  <span style={{ color: A.gray2 }}>发票金额</span><span style={{ color: A.label }}>{fmt(selectedSnapshot.invoiceAmount)}</span>
                  <span style={{ color: A.gray2 }}>差异类型</span><span style={{ color: selectedSnapshot.varianceType === "无差异" ? A.green : A.red }}>{selectedSnapshot.varianceType}</span>
                  <span style={{ color: A.gray2 }}>匹配状态</span><span style={{ color: A.label }}>{selectedSnapshot.matchStatus}</span>
                </div>
              </div>
              <div className="rounded-xl p-3" style={{ background: A.gray6 }}>
                <div className="text-[11px] font-semibold" style={{ color: A.label }}>发票摘要</div>
                <div className="grid grid-cols-2 gap-y-1 mt-2 text-[10px]">
                  <span style={{ color: A.gray2 }}>发票日期</span><span>{selectedInvoice.invoiceDate}</span>
                  <span style={{ color: A.gray2 }}>接收日期</span><span>{selectedInvoice.receivedDate}</span>
                  <span style={{ color: A.gray2 }}>到期日</span><span>{selectedInvoice.dueDate}</span>
                  <span style={{ color: A.gray2 }}>付款条款</span><span>{selectedInvoice.paymentTerms}</span>
                  <span style={{ color: A.gray2 }}>未税/税额</span><span>{fmt(selectedInvoice.subtotal)} / {fmt(selectedInvoice.tax)}</span>
                  <span style={{ color: A.gray2 }}>运费</span><span>{fmt(selectedInvoice.freight || 0)}</span>
                </div>
              </div>
              <div className="rounded-xl p-3" style={{ background: "#fff8f0" }}>
                <div className="text-[11px] font-semibold" style={{ color: A.orange }}>来源与证据</div>
                <div className="text-[10px] leading-5 mt-2" style={{ color: A.sub }}>
                  来源：{invoiceSourceLabel(selectedInvoice.source)}<br />
                  AP 负责人：{selectedInvoice.apOwner}<br />
                  备注：{selectedInvoice.notes || getInvoiceVarianceSummary(selectedInvoice)}
                </div>
              </div>
            </div>

            <Card>
              <div className="px-4 py-3" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                <h3 className="text-xs font-semibold" style={{ color: A.label }}>发票行项目</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                      {["SKU", "品名", "发票数量", "单价", "税额", "行总额", "订购数", "收货数", "差异类型"].map((header) => (
                        <th key={header} className="text-left px-4 py-2 font-medium whitespace-nowrap" style={{ color: A.gray1 }}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoice.lines.map((line) => (
                      <tr key={line.lineId}>
                        <td className="px-4 py-2" style={{ color: A.blue }}>{line.sku}</td>
                        <td className="px-4 py-2 font-medium" style={{ color: A.label }}>{line.name}</td>
                        <td className="px-4 py-2">{line.quantity.toLocaleString()} {line.unit}</td>
                        <td className="px-4 py-2">{fmt(line.unitPrice)}</td>
                        <td className="px-4 py-2">{fmt(line.taxAmount)}</td>
                        <td className="px-4 py-2 font-semibold">{fmt(line.lineTotal)}</td>
                        <td className="px-4 py-2">{line.orderedQty ?? "—"}</td>
                        <td className="px-4 py-2">{line.receivedQty ?? "—"}</td>
                        <td className="px-4 py-2" style={{ color: (line.varianceType || selectedInvoice.varianceType) === "无差异" ? A.green : A.red }}>
                          {line.varianceType || selectedInvoice.varianceType}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
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
              三单匹配用于比较采购订单、收货单和供应商发票，识别价格、数量、税额和收货差异。
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
                PO = ordered，GRN = received，Invoice = billed。当前差异金额 {fmt(selected.varianceAmount)}，请在供应商发票台账中查看行项目证据。
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
        <KpiCard label="应付总额"   value={`¥${(totalDue / 1e4).toFixed(0)}万`}    sub="未付清"                            icon={Wallet}      color={A.blue} />
        <KpiCard label="逾期金额"   value={`¥${(overdue / 1e4).toFixed(1)}万`}     sub={`${payables.filter(p => p.status === "逾期").length} 笔逾期`} icon={AlertOctagon} color={A.red} />
        <KpiCard label="7 天到期"   value="¥146万"                                  sub="3 笔"                              icon={Clock}       color={A.orange} />
        <KpiCard label="DPO"        value="48.2 天"                                 sub="应付账款周转天数" delta="+2.1d"    icon={CreditCard}  color={A.purple} />
      </div>

      <Card>
        <div className="px-5 py-4 flex items-start justify-between gap-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: A.label }}>应付账款</h2>
            <p className="text-[11px] mt-1" style={{ color: A.sub }}>
              应付账款来自已审批或已过账的供应商发票；付款动作仅为演示状态。
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
              {["AP 编号", "供应商", "发票", "金额", "条款", "到期日", "账龄", "状态", "操作"].map(h => (
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
