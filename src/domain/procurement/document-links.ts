import type { PurchaseOrder, PurchaseRequest, ReceivingDoc, SupplierInvoice } from "../../types/scm";
import { type DocumentTone, statusTone } from "../../components/document/DocumentShell";

export type DemoDocumentLink = {
  label: string;
  value: string;
  moduleId?: string;
  tone?: DocumentTone;
};

function present(value?: string) {
  return value && value !== "—";
}

export function documentLinkTone(status?: string): DocumentTone {
  return statusTone(status);
}

export function getInvoiceLinkedDocuments(
  invoice: SupplierInvoice,
  purchaseOrders: PurchaseOrder[],
  receivingDocs: ReceivingDoc[]
): DemoDocumentLink[] {
  const po = purchaseOrders.find((item) => item.po === invoice.relatedPo);
  const grn = receivingDocs.find((item) => item.grn === invoice.relatedGrn);
  return [
    po ? { label: "PO / 采购订单", value: po.po, moduleId: "purchasing", tone: documentLinkTone(po.status) } : undefined,
    grn ? { label: "GRN / 收货单", value: grn.grn, moduleId: "receiving", tone: documentLinkTone(grn.status) } : present(invoice.relatedGrn) ? { label: "GRN / 收货单", value: invoice.relatedGrn!, moduleId: "receiving", tone: "warning" as const } : undefined,
    { label: "三单匹配结果", value: invoice.matchStatus, moduleId: "procurement", tone: documentLinkTone(invoice.matchStatus) },
    invoice.postedToAp ? { label: "AP / 应付账款", value: invoice.paid ? "已付款" : `已过账应付 · ${invoice.invoiceNumber}`, moduleId: "procurement", tone: invoice.paid ? "success" as const : "purple" as const } : undefined,
  ].filter(Boolean) as DemoDocumentLink[];
}

export function getPoLinkedDocuments(
  po: PurchaseOrder,
  supplierInvoices: SupplierInvoice[],
  receivingDocs: ReceivingDoc[],
  purchaseRequests: PurchaseRequest[] = []
): DemoDocumentLink[] {
  const grns = receivingDocs.filter((item) => item.po === po.po);
  const invoices = supplierInvoices.filter((item) => item.relatedPo === po.po);
  const sourcePr = purchaseRequests.find((item) => item.pr === po.sourceRequest);
  return [
    po.sourceRequest ? { label: "来源 PR", value: po.sourceRequest, moduleId: "purchaseRequests", tone: documentLinkTone(sourcePr?.status) } : undefined,
    po.sourceRfq ? { label: "来源 RFQ", value: po.sourceRfq, moduleId: "rfq", tone: "info" as const } : undefined,
    ...grns.slice(0, 3).map((grn) => ({ label: "GRN / 收货单", value: grn.grn, moduleId: "receiving", tone: documentLinkTone(grn.status) })),
    ...invoices.slice(0, 3).map((invoice) => ({ label: "供应商发票", value: invoice.invoiceNumber, moduleId: "procurement", tone: documentLinkTone(invoice.status) })),
    invoices.some((invoice) => invoice.postedToAp) ? { label: "AP / 应付账款", value: "关联发票已过账", moduleId: "procurement", tone: "purple" as const } : undefined,
  ].filter(Boolean) as DemoDocumentLink[];
}

export function getGrnLinkedDocuments(
  grn: ReceivingDoc,
  purchaseOrders: PurchaseOrder[],
  supplierInvoices: SupplierInvoice[]
): DemoDocumentLink[] {
  const po = purchaseOrders.find((item) => item.po === grn.po);
  const invoices = supplierInvoices.filter((item) => item.relatedGrn === grn.grn || item.relatedPo === grn.po);
  return [
    po ? { label: "PO / 采购订单", value: po.po, moduleId: "purchasing", tone: documentLinkTone(po.status) } : { label: "PO / 采购订单", value: grn.po, moduleId: "purchasing", tone: "warning" },
    ...invoices.slice(0, 3).map((invoice) => ({ label: "供应商发票", value: invoice.invoiceNumber, moduleId: "procurement", tone: documentLinkTone(invoice.status) })),
    invoices.length ? { label: "三单匹配结果", value: invoices.some((invoice) => invoice.varianceType !== "无差异") ? "存在差异" : "可匹配", moduleId: "procurement", tone: invoices.some((invoice) => invoice.varianceType !== "无差异") ? "danger" as const : "success" as const } : undefined,
  ].filter(Boolean) as DemoDocumentLink[];
}
