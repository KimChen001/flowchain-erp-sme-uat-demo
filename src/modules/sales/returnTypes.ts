export type SalesReturnStatus = "草稿" | "待审核" | "待收货" | "处理中" | "已完成" | "已驳回";

export type SalesReturnLine = {
  sku: string;
  itemName: string;
  shippedQty: number;
  returnQty: number;
  receivedQty: number;
  unit: string;
  condition: string;
  remarks?: string;
};

export type SalesReturnNote = {
  id: string;
  returnNo: string;
  customer: string;
  salesOrderNo: string;
  deliveryNo: string;
  returnDate: string;
  returnReason: string;
  status: SalesReturnStatus;
  totalQuantity: number;
  warehouse: string;
  lines: SalesReturnLine[];
  remarks?: string;
  createdBy: string;
  reviewedBy?: string;
};
