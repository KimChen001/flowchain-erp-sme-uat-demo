export type SignReceiptStatus = "待签收" | "正常签收" | "部分签收" | "异常签收";

export type SignReceiptLine = {
  sku: string;
  itemName: string;
  shippedQty: number;
  receivedQty: number;
  damagedQty: number;
  unit: string;
  remarks?: string;
};

export type SignReceipt = {
  id: string;
  receiptNo: string;
  deliveryNo: string;
  salesOrderNo: string;
  customerName: string;
  receiverName: string;
  receiverPhone?: string;
  signDate: string;
  signLocation?: string;
  status: SignReceiptStatus;
  exceptionNote?: string;
  deliveryPerson?: string;
  reviewedBy?: string;
  signature?: string;
  lines: SignReceiptLine[];
};
