export type InventoryAdjustmentType = "盘盈" | "盘亏" | "初始化" | "报损" | "其他";
export type InventoryAdjustmentStatus = "草稿" | "待审核" | "已审核" | "已驳回";

export type InventoryAdjustmentLine = {
  sku: string;
  itemName: string;
  beforeQty: number;
  adjustmentQty: number;
  afterQty: number;
  unit: string;
  reason?: string;
  remarks?: string;
};

export type InventoryAdjustment = {
  id: string;
  adjustmentNo: string;
  warehouse: string;
  adjustmentType: InventoryAdjustmentType;
  reason: string;
  status: InventoryAdjustmentStatus;
  createdBy: string;
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  remarks?: string;
  movementNo?: string;
  lines: InventoryAdjustmentLine[];
};
