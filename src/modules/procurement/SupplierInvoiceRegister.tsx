import { useMemo, useState } from "react";
import { AlertOctagon, CheckCircle2, CreditCard, FileSpreadsheet, FileText, MoreHorizontal, Search, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Modal, Card, Chip, KpiCard, A } from "../../components/ui";
import { DocumentActionBar, DocumentEvidencePanel, DocumentHeader, DocumentLinesTable, DocumentShell, DocumentStatusTimeline, DocumentTotals, statusTone, type TimelineStep } from "../../components/document/DocumentShell";
import { SUPPLIER_INVOICES, purchaseOrders, receivingDocs } from "../../data/demo-data";
import { getInvoiceLinkedDocuments } from "../../domain/procurement/document-links";
import { calculateInvoiceMatch, getInvoiceVarianceSummary, isInvoicePayableReady, supplierInvoiceExportRows } from "../../domain/procurement/invoice-matching";
import { calculateInvoiceTaxSummary, calculateLineTax, getTaxVarianceSummary } from "../../domain/finance/tax";
import { exportRowsToCsv } from "../../lib/data-export";
import { fmt } from "../../lib/format";
import type { SupplierInvoice, SupplierInvoiceStatus } from "../../types/scm";
import { matchStatusStyle } from "./shared";
import ContextualImportActions from "../../components/import/ContextualImportActions";
import {
  tableMinXlClass,
  tableScrollClass,
  tdActionClass,
  tdIdClass,
  tdNameClass,
  tdNowrapClass,
  tdNumericClass,
  thClass,
} from "../../components/ui/workbenchTable";

function invoiceStatusStyle(status: SupplierInvoiceStatus) {
  if (status === "存在差异" || status === "已驳回") return { color: A.red, bg: "#fff1f0" };
  if (status === "待匹配" || status === "待审批" || status === "已接收") return { color: A.orange, bg: "#fff8f0" };
  if (status === "已付款" || status === "已过账应付" || status === "已审批" || status === "已匹配") return { color: A.green, bg: "#f0faf4" };
  return { color: A.gray1, bg: A.gray6 };
}

function invoiceSourceLabel(source: SupplierInvoice["source"]) {
  return ({
    "supplier-portal": "供应商门户",
    "email-upload": "邮件上传",
    "manual-entry": "手工录入",
    "edi-sample": "EDI",
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
    { label: "已付款", status: isPaid ? "done" : "pending", helper: invoice.paid ? "付款完成" : "待付款" },
  ];
}

type SupplierInvoiceRegisterProps = {
  mode?: "procurement" | "finance";
};

export default function SupplierInvoiceRegister({ mode = "finance" }: SupplierInvoiceRegisterProps) {
  const [invoices, setInvoices] = useState<SupplierInvoice[]>(SUPPLIER_INVOICES);
  const [statusFilter, setStatusFilter] = useState("全部");
  const [varianceFilter, setVarianceFilter] = useState("全部");
  const [search, setSearch] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<SupplierInvoice | null>(null);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const isProcurementMode = mode === "procurement";

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
    setOpenActionId(null);
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
    toast.success(`${invoice.invoiceNumber} 已标记为已审批`);
  }

  function postToAp(invoice: SupplierInvoice) {
    if (!["已审批", "已过账应付"].includes(invoice.status)) {
      toast.warning("请先完成发票审批");
      return;
    }
    updateInvoice(invoice.id, { status: "已过账应付", postedToAp: true });
    toast.success(`${invoice.invoiceNumber} 已过账应付`, { description: "状态已更新，请继续复核应付影响。" });
  }

  function reject(invoice: SupplierInvoice) {
    updateInvoice(invoice.id, { status: "已驳回", matchStatus: "差异待处理", approvalStatus: "已驳回" });
    toast.success(`${invoice.invoiceNumber} 已驳回`);
  }

  function exportRegister() {
    if (visibleInvoices.length === 0) {
      toast.warning("暂无可导出的数据");
      return;
    }
    exportRowsToCsv("supplier-invoices-export.csv", supplierInvoiceExportRows(visibleInvoices));
    toast.success("导出文件已生成", { description: `${visibleInvoices.length} 条发票` });
  }

  function exportInvoice(invoice: SupplierInvoice) {
    const taxSummary = calculateInvoiceTaxSummary(invoice);
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
      ["税码", taxSummary.taxCodes.join(" / ")],
      ["税率", taxSummary.taxRates.join(" / ")],
      ["未税金额", invoice.subtotal],
      ["税额", invoice.tax],
      ["价税合计", invoice.subtotal + invoice.tax],
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
      税码: calculateLineTax(line).taxCode,
      发票数量: line.quantity,
      单位: line.unit,
      单价: line.unitPrice,
      税率: line.taxRate,
      未税金额: line.lineSubtotal,
      税额: line.taxAmount,
      价税合计: line.lineTotal,
      订购数量: line.orderedQty ?? "",
      收货数量: line.receivedQty ?? "",
      匹配数量: line.matchedQty ?? "",
      差异类型: line.varianceType || invoice.varianceType,
      差异金额: line.varianceAmount ?? invoice.varianceAmount,
    }));
    exportRowsToCsv(`supplier-invoice-detail-${invoice.invoiceNumber}.csv`, [...headerRows, ...lineRows]);
    toast.success("导出文件已生成", { description: "供应商发票详情" });
  }

  const selectedSnapshot = selectedInvoice
    ? calculateInvoiceMatch(selectedInvoice, purchaseOrders, receivingDocs, invoices)
    : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-6 gap-3">
        <KpiCard label={isProcurementMode ? "协同发票" : "发票总数"} value={String(invoices.length)} sub={isProcurementMode ? "PO / GRN 协同" : "发票台账"} icon={FileText} color={A.blue} />
        <KpiCard label="待匹配" value={String(pendingMatch)} sub="需补齐 PO/GRN" icon={Search} color={A.orange} />
        <KpiCard label="差异发票" value={String(varianceInvoices.length)} sub={fmt(varianceInvoices.reduce((sum, invoice) => sum + invoice.varianceAmount, 0))} icon={AlertOctagon} color={A.red} />
        <KpiCard label={isProcurementMode ? "待采购确认" : "待审批"} value={String(pendingApproval)} sub={isProcurementMode ? "匹配后确认" : "匹配后审批"} icon={CheckCircle2} color={A.green} />
        <KpiCard label={isProcurementMode ? "已关联应付" : "已过账应付"} value={String(posted)} sub={isProcurementMode ? "财务协同跟进" : "进入应付账款"} icon={Wallet} color={A.purple} />
        <KpiCard label={isProcurementMode ? "后续处理金额" : "应付待付"} value={fmt(dueSoonAmount)} sub={isProcurementMode ? "审批/差异跟进" : "审批/过账发票"} icon={CreditCard} color={A.teal} />
      </div>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: A.label }}>{isProcurementMode ? "发票协同" : "供应商发票台账"}</h2>
            <p className="text-[11px] mt-1" style={{ color: A.sub }}>
                {isProcurementMode
                ? "围绕 PO / GRN 匹配、发票差异、税额拆分、采购确认、关联退货贷项与下一步动作形成协同证据链。"
                : "管理供应商发票、发票行、税额拆分、三单匹配、审批状态与过账应付，形成 AP 处理证据链。"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isProcurementMode && <ContextualImportActions entityLabel="发票" templateName="发票" compact />}
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
              <FileSpreadsheet size={13} /> 导出当前结果
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <div className={tableScrollClass}>
          <table className={tableMinXlClass}>
            <thead>
              <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                {["发票编号", "供应商", "PO", "GRN", "发票日期", "到期日", "未税金额", "税额", "价税合计", "付款条款", "匹配状态", "发票状态", "差异类型", "操作"].map((header) => (
                  <th key={header} className={thClass} style={{ color: A.gray1 }}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleInvoices.map((invoice, index) => {
                const statusStyle = invoiceStatusStyle(invoice.status);
                const matchStyle = matchStatusStyle(invoice.matchStatus);
                return (
                  <tr key={invoice.id} style={{ borderBottom: index < visibleInvoices.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                    <td className={tdIdClass} style={{ color: A.blue }}>{invoice.invoiceNumber}</td>
                    <td className={`${tdNameClass} max-w-[180px] truncate font-medium`} style={{ color: A.label }}>{invoice.supplier}</td>
                    <td className={tdNowrapClass} style={{ color: A.sub }}>{invoice.relatedPo || "—"}</td>
                    <td className={tdNowrapClass} style={{ color: invoice.relatedGrn ? A.sub : A.orange }}>{invoice.relatedGrn || "缺少"}</td>
                    <td className={tdNowrapClass} style={{ color: A.sub }}>{invoice.invoiceDate}</td>
                    <td className={tdNowrapClass} style={{ color: A.sub }}>{invoice.dueDate}</td>
                    <td className={tdNumericClass} style={{ color: A.sub }}>{fmt(invoice.subtotal)}</td>
                    <td className={tdNumericClass} style={{ color: A.sub }}>{fmt(invoice.tax)}</td>
                    <td className={`${tdNumericClass} font-semibold`} style={{ color: A.label }}>{fmt(invoice.total)}</td>
                    <td className={tdNowrapClass} style={{ color: A.sub }}>{invoice.paymentTerms}</td>
                    <td className={tdNowrapClass}><Chip label={invoice.matchStatus} color={matchStyle.color} bg={matchStyle.bg} /></td>
                    <td className={tdNowrapClass}><Chip label={invoice.status} color={statusStyle.color} bg={statusStyle.bg} /></td>
                    <td className={tdNowrapClass} style={{ color: invoice.varianceType === "无差异" ? A.green : A.red }}>{invoice.varianceType}</td>
                    <td className={tdActionClass}>
                      <div className="relative flex items-center gap-1">
                        <button onClick={() => setSelectedInvoice(invoice)} className="px-2 py-1 rounded-md font-medium" style={{ background: A.gray6, color: A.blue }}>详情</button>
                        <button onClick={() => setOpenActionId((current) => current === invoice.id ? null : invoice.id)} className="px-2 py-1 rounded-md font-medium flex items-center gap-1" style={{ background: A.gray6, color: A.gray1 }}>
                          更多 <MoreHorizontal size={12} />
                        </button>
                        {openActionId === invoice.id && (
                          <div className="absolute right-0 top-7 z-20 w-28 rounded-lg p-1 shadow-lg" style={{ background: A.white, boxShadow: "0 10px 30px rgba(15,23,42,0.12)" }}>
                            <button onClick={() => runMatch(invoice)} className="w-full text-left px-2 py-1.5 rounded-md font-medium" style={{ color: A.blue }}>运行匹配</button>
                            <button onClick={() => approve(invoice)} className="w-full text-left px-2 py-1.5 rounded-md font-medium" style={{ color: A.green }}>审批确认</button>
                            {!isProcurementMode && <button onClick={() => postToAp(invoice)} className="w-full text-left px-2 py-1.5 rounded-md font-medium" style={{ color: A.purple }}>过账应付</button>}
                            <button onClick={() => reject(invoice)} className="w-full text-left px-2 py-1.5 rounded-md font-medium" style={{ color: A.red }}>驳回</button>
                          </div>
                        )}
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
        subtitle={isProcurementMode ? "采购协同 · 发票匹配" : "财务协同 · 供应商发票"}>
        {selectedInvoice && selectedSnapshot && (
          (() => {
            const taxSummary = calculateInvoiceTaxSummary(selectedInvoice);
            return (
          <DocumentShell
            title="供应商发票"
            documentNo={selectedInvoice.invoiceNumber}
            moduleLabel={isProcurementMode ? "采购 / 发票协同" : "财务 / 发票与应付"}
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
                { label: "税码", value: taxSummary.taxCodes.join(" / ") || "待维护" },
                { label: "税率", value: taxSummary.taxRates.join(" / ") || "待维护" },
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
                { key: "taxCode", label: "税码", render: (line) => calculateLineTax(line).taxCode },
                { key: "taxRate", label: "税率", align: "right", render: (line) => `${Math.round(Number(line.taxRate || 0) * 100)}%` },
                { key: "lineSubtotal", label: "未税金额", align: "right", render: (line) => fmt(Number(line.lineSubtotal || 0)) },
                { key: "taxAmount", label: "税额", align: "right", render: (line) => fmt(Number(line.taxAmount || 0)) },
                { key: "lineTotal", label: "价税合计", align: "right", render: (line) => fmt(Number(line.lineTotal || 0)) },
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
                { label: "价税合计", value: fmt(selectedInvoice.subtotal + selectedInvoice.tax), tone: "info" },
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
              notes={selectedInvoice.notes || `${getInvoiceVarianceSummary(selectedInvoice)} 三单匹配用于比较 PO、GRN 与供应商发票的金额、数量与状态差异。`}
              evidence={[
                { label: "PO 金额", value: fmt(selectedSnapshot.poAmount) },
                { label: "GRN 金额", value: fmt(selectedSnapshot.grnAmount) },
                { label: "发票金额", value: fmt(selectedSnapshot.invoiceAmount) },
                { label: "税码 / 税率", value: `${taxSummary.taxCodes.join(" / ")} · ${taxSummary.taxRates.join(" / ")}` },
                { label: "税额拆分", value: getTaxVarianceSummary(selectedInvoice), tone: selectedInvoice.varianceType === "税额差异" ? "warning" : "success" },
                { label: "匹配状态", value: selectedSnapshot.matchStatus, tone: statusTone(selectedSnapshot.matchStatus) },
                { label: "差异类型", value: selectedSnapshot.varianceType, tone: selectedSnapshot.varianceType === "无差异" ? "success" : "danger" },
                { label: "重复风险", value: selectedInvoice.duplicateRisk ? "是" : "否", tone: selectedInvoice.duplicateRisk ? "danger" : "success" },
              ]}
            />
            <DocumentActionBar>
              <button onClick={() => runMatch(selectedInvoice)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "#f0f6ff", color: A.blue }}>运行匹配</button>
              <button onClick={() => approve(selectedInvoice)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "#f0faf4", color: A.green }}>标记已审批</button>
              {!isProcurementMode && <button onClick={() => postToAp(selectedInvoice)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "#faf3ff", color: A.purple }}>过账到应付</button>}
              <button onClick={() => reject(selectedInvoice)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "#fff1f0", color: A.red }}>驳回</button>
              <button onClick={() => exportInvoice(selectedInvoice)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: A.white, color: A.blue, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)" }}>导出详情</button>
              <button onClick={() => setSelectedInvoice(null)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: A.white, color: A.label, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)" }}>关闭</button>
            </DocumentActionBar>
          </DocumentShell>
            );
          })()
        )}
      </Modal>
    </div>
  );
}
