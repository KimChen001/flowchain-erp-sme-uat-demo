export type DeliveryStatus = "待拣货" | "待发货" | "运输中" | "已送达" | "已签收" | "异常";

export type DeliveryLine = {
  sku: string;
  itemName: string;
  orderedQty: number;
  shippedQty: number;
  unit: string;
  batchNo?: string;
  cartonCount?: number;
  remarks?: string;
};

export type DeliveryNote = {
  id: string;
  deliveryNo: string;
  salesOrderNo: string;
  customerId?: string;
  customerName: string;
  warehouse: string;
  deliveryDate: string;
  expectedArrivalDate?: string;
  logisticsCompany?: string;
  carrier?: string;
  driver?: string;
  driverPhone?: string;
  vehicleNo?: string;
  status: DeliveryStatus;
  totalQuantity: number;
  cartonCount?: number;
  remarks?: string;
  createdBy: string;
  reviewedBy?: string;
  lines: DeliveryLine[];
};
