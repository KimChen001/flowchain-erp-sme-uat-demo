import type { ReceivingDoc } from "../../types/scm";
import type { DeliveryNote } from "../sales/deliveryTypes";
import type { SignReceipt } from "../sales/receiptTypes";
import type { PrintDocumentData, PrintDocumentType, PrintFieldOption } from "./printLayoutTypes";

export const printFieldOptions: Record<PrintDocumentType, PrintFieldOption[]> = {
  receive_sheet: ["companyName", "documentNo", "documentDate", "supplier", "warehouse", "sourceOrderNo", "handler", "receiver", "receiveDate", "createdBy", "reviewedBy", "remarks"].map((key) => ({ key, label: ({ companyName: "公司名称", documentNo: "单据编号", documentDate: "单据日期", supplier: "供应商", warehouse: "仓库", sourceOrderNo: "采购订单", handler: "经办人", receiver: "收货人", receiveDate: "收货日期", createdBy: "创建人", reviewedBy: "审核人", remarks: "备注" } as Record<string, string>)[key] })),
  delivery_note: ["companyName", "documentNo", "documentDate", "customer", "warehouse", "sourceOrderNo", "handler", "deliveryDate", "logisticsCompany", "driver", "vehicleNo", "cartonCount", "createdBy", "reviewedBy", "remarks"].map((key) => ({ key, label: ({ companyName: "公司名称", documentNo: "单据编号", documentDate: "单据日期", customer: "客户", warehouse: "仓库", sourceOrderNo: "销售订单", handler: "经办人", deliveryDate: "发货日期", logisticsCompany: "物流公司", driver: "司机", vehicleNo: "车辆", cartonCount: "箱数", createdBy: "创建人", reviewedBy: "审核人", remarks: "备注" } as Record<string, string>)[key] })),
  sign_receipt: ["companyName", "documentNo", "documentDate", "receiptNo", "deliveryNo", "sourceOrderNo", "customer", "receiverName", "receiverPhone", "signDate", "exceptionNote", "deliveryPerson", "reviewedBy", "signature", "remarks"].map((key) => ({ key, label: ({ companyName: "公司名称", documentNo: "单据编号", documentDate: "单据日期", receiptNo: "签收单号", deliveryNo: "发货单号", sourceOrderNo: "销售订单", customer: "客户", receiverName: "签收人", receiverPhone: "签收电话", signDate: "签收日期", exceptionNote: "异常说明", deliveryPerson: "配送人", reviewedBy: "审核人", signature: "客户签名", remarks: "备注" } as Record<string, string>)[key] })),
};

export function adaptReceiveSheet(grn: ReceivingDoc): PrintDocumentData {
  const lines = (grn.lines?.length ? grn.lines : [{ sku: "SUMMARY", itemName: "收货汇总", receivedQty: grn.items, unit: "件" }]).map((line) => ({
    sku: line.sku, itemName: line.itemName || "—", quantity: line.receivedQty, unit: line.unit || "件", batchNo: "—", remarks: line.rejectedQty ? `拒收 ${line.rejectedQty}` : line.status || "",
  }));
  return {
    companyName: "新辰智能制造", documentNo: grn.grn, documentDate: grn.arrived, supplier: grn.supplier, warehouse: grn.warehouse,
    sourceOrderNo: grn.po, handler: grn.receiver, receiver: grn.receiver, receiveDate: grn.arrived, createdBy: grn.postedBy || grn.receiver,
    reviewedBy: grn.status === "已入库" ? "李婷" : "待审核", remarks: grn.failed ? `存在 ${grn.failed} 件拒收` : "按采购订单收货", lines,
  };
}

export function adaptDeliveryNote(note: DeliveryNote): PrintDocumentData {
  return {
    companyName: "新辰智能制造", documentNo: note.deliveryNo, documentDate: note.deliveryDate, customer: note.customerName, warehouse: note.warehouse,
    sourceOrderNo: note.salesOrderNo, handler: note.createdBy, deliveryDate: note.deliveryDate, logisticsCompany: note.logisticsCompany || "—", driver: note.driver || "—",
    vehicleNo: note.vehicleNo || "—", cartonCount: note.cartonCount ?? "—", createdBy: note.createdBy, reviewedBy: note.reviewedBy || "待审核", remarks: note.remarks || "",
    lines: note.lines.map((line) => ({ ...line })),
  };
}

export function adaptSignReceipt(receipt: SignReceipt): PrintDocumentData {
  return {
    companyName: "新辰智能制造", documentNo: receipt.receiptNo, receiptNo: receipt.receiptNo, documentDate: receipt.signDate, deliveryNo: receipt.deliveryNo,
    sourceOrderNo: receipt.salesOrderNo, customer: receipt.customerName, warehouse: receipt.signLocation || "客户收货点", handler: receipt.deliveryPerson || "—",
    receiverName: receipt.receiverName, receiverPhone: receipt.receiverPhone || "—", signDate: receipt.signDate, exceptionNote: receipt.exceptionNote || "无",
    deliveryPerson: receipt.deliveryPerson || "—", reviewedBy: receipt.reviewedBy || "待审核", signature: receipt.signature || "待签名", remarks: receipt.exceptionNote || "",
    lines: receipt.lines.map((line) => ({ ...line })),
  };
}
