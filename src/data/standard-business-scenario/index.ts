import { purchaseOrders, receivingDocs, RFQS } from "../procurement";
import { SUPPLIER_INVOICES, SUPPLIER_RECONCILIATION_STATEMENTS } from "../settlement";

export const STANDARD_SCENARIO_ID = "standard-business-scenario";

export const THREE_WAY_MATCHES = SUPPLIER_INVOICES.map((invoice) => {
  const line = invoice.lines[0];
  const po = purchaseOrders.find((item) => item.po === invoice.relatedPo);
  const grn = receivingDocs.find((item) => item.grn === invoice.relatedGrn);
  return {
    id: `MATCH-${invoice.invoiceNumber}`,
    matchId: `MATCH-${invoice.invoiceNumber}`,
    supplier: invoice.supplier,
    supplierCode: invoice.supplierCode,
    po: invoice.relatedPo,
    grn: invoice.relatedGrn || "",
    invoice: invoice.invoiceNumber,
    poAmount: po?.amount ?? line?.lineSubtotal ?? invoice.subtotal,
    grnAmount: line ? line.receivedQty * line.unitPrice : 0,
    invoiceAmount: invoice.total,
    orderedQuantity: line?.orderedQty ?? po?.items ?? 0,
    receivedQuantity: line?.receivedQty ?? grn?.passed ?? 0,
    invoiceQuantity: line?.quantity ?? 0,
    poUnitPrice: line?.orderedQty ? (po?.amount ?? line.lineSubtotal) / line.orderedQty : line?.unitPrice ?? 0,
    invoiceUnitPrice: line?.unitPrice ?? 0,
    priceVariance: invoice.varianceType === "价格差异" ? invoice.varianceAmount : 0,
    quantityVariance: invoice.varianceType === "数量差异" || invoice.varianceType === "缺少收货" ? invoice.varianceAmount : 0,
    taxVariance: invoice.varianceType === "税额差异" ? invoice.varianceAmount : 0,
    freightVariance: invoice.varianceType === "运费差异" ? invoice.varianceAmount : 0,
    totalVariance: invoice.varianceAmount,
    status: invoice.matchStatus,
    toleranceRule: "金额 0.5% / 数量 0 / 税额 1 元",
    comments: invoice.notes,
    createdAt: invoice.receivedDate,
    updatedAt: invoice.invoiceDate,
    lines: invoice.lines.map((item) => ({
      lineId: item.lineId,
      sku: item.sku,
      itemName: item.name,
      poLine: item.poLine,
      grnLine: item.grnLine || "",
      orderedQty: item.orderedQty,
      receivedQty: item.receivedQty,
      invoiceQty: item.quantity,
      poUnitPrice: item.orderedQty ? item.lineSubtotal / item.orderedQty : item.unitPrice,
      invoiceUnitPrice: item.unitPrice,
      varianceType: item.varianceType || invoice.varianceType,
      varianceAmount: item.varianceAmount ?? invoice.varianceAmount,
    })),
    history: [
      { time: invoice.receivedDate, action: "收到供应商发票", operator: invoice.owner },
      { time: invoice.invoiceDate, action: `执行三单匹配：${invoice.matchStatus}`, operator: invoice.apOwner || "赵敏" },
    ],
  };
});

export const SETTLEMENT_DOCUMENTS = SUPPLIER_RECONCILIATION_STATEMENTS
  .filter((statement) => statement.settlementStatus !== "未结算")
  .map((statement, index) => ({
    id: `SET-2026-${String(index + 1).padStart(4, "0")}`,
    settlementNo: `SET-2026-${String(index + 1).padStart(4, "0")}`,
    supplier: statement.supplier,
    supplierCode: statement.supplierCode,
    settlementDate: statement.confirmedDate || statement.createdDate,
    currency: statement.currency,
    invoiceAmount: statement.totalInvoiceAmount,
    creditAmount: Math.max(0, statement.totalAdjustmentAmount),
    adjustmentAmount: statement.totalVarianceAmount,
    actualSettlementAmount: statement.totalPaidAmount,
    reconciliationStatement: statement.statementNo,
    invoices: statement.lines.filter((line) => line.relatedInvoice).map((line) => line.relatedInvoice).filter((value, position, values) => value && values.indexOf(value) === position),
    status: statement.settlementStatus,
    comments: statement.notes,
    history: [
      { time: statement.createdDate, action: "由对账单生成结算资料", operator: statement.owner },
      { time: statement.confirmedDate || statement.createdDate, action: statement.settlementStatus, operator: "赵敏" },
    ],
  }));

export const STANDARD_BUSINESS_CHAIN = SUPPLIER_INVOICES.map((invoice) => ({
  purchaseRequest: purchaseOrders.find((po) => po.po === invoice.relatedPo)?.sourceRequest || "",
  rfq: purchaseOrders.find((po) => po.po === invoice.relatedPo)?.sourceRfq || RFQS.find((rfq) => rfq.bestSupplier === invoice.supplier)?.id || "",
  purchaseOrder: invoice.relatedPo,
  receivingDocument: invoice.relatedGrn || "",
  supplierInvoice: invoice.invoiceNumber,
  threeWayMatch: `MATCH-${invoice.invoiceNumber}`,
  reconciliationStatement: SUPPLIER_RECONCILIATION_STATEMENTS.find((statement) => statement.lines.some((line) => line.relatedInvoice === invoice.invoiceNumber))?.statementNo || "",
  settlementDocument: SETTLEMENT_DOCUMENTS.find((settlement) => settlement.invoices.includes(invoice.invoiceNumber))?.settlementNo || "",
}));

export const STANDARD_SCENARIO_DISTRIBUTION = { normal: 80, attention: 15, exception: 5 } as const;
