export type Priority = "高" | "中" | "低";

export type POStatus = "草稿" | "待审批" | "已审批" | "已发出" | "部分到货" | "已完成" | "已驳回" | "已取消";
export type PurchaseRequestStatus = "草稿" | "待审批" | "已批准" | "已驳回" | "已转PO" | "已取消";
export type RecvStatus = "待收货" | "已签收" | "质检中" | "已入库" | "异常处理";

export type ApprovalSnapshot = {
  source?: string;
  summary?: string;
  explanation?: string;
  ai?: Record<string, unknown>;
  mrp?: Record<string, unknown>;
  inventory?: Record<string, unknown>;
  forecast?: Record<string, unknown>;
  supplier?: Record<string, unknown>;
  createdAt?: string;
};

export type PurchaseOrderLine = {
  poLineId: string;
  poId?: string;
  sku: string;
  itemName: string;
  quantityOrdered: number;
  quantityReceived: number;
  quantityAccepted: number;
  quantityRejected: number;
  unit: string;
  unitPrice: number;
  currency: string;
  supplierId?: string;
  warehouseId?: string;
  requiredDate?: string;
  promisedDate?: string;
  status?: string;
};

export type PurchaseOrder = {
  po: string;
  supplier: string;
  created: string;
  eta: string;
  owner: string;
  amount: number;
  items: number;
  received: number;
  status: POStatus;
  priority: Priority;
  paid: boolean;
  source?: string;
  sourceRequest?: string;
  sourceRfq?: string;
  sourceSku?: string;
  sourceName?: string;
  recommendedQty?: number;
  unit?: string;
  unitPrice?: number;
  reason?: string;
  approvalSnapshot?: ApprovalSnapshot | null;
  lines?: PurchaseOrderLine[];
  lineCount?: number;
  totalOrderedQty?: number;
  totalReceivedQty?: number;
  totalAcceptedQty?: number;
  totalRejectedQty?: number;
  totalAmount?: number;
  itemsMeaning?: "lineCount" | "totalOrderedQty" | string;
  currency?: string;
  supplierId?: string;
  warehouseId?: string;
  erpStatus?: string;
  statusUpdatedAt?: string;
  lastAuditId?: string;
  auditTrailIds?: string[];
};

export type PurchaseOrderDraft = Omit<PurchaseOrder, "po" | "created"> & { po?: string; created?: string };

export type PurchaseRequest = {
  pr: string;
  source: string;
  sourceSku: string;
  sourceName: string;
  supplier: string;
  requester: string;
  buyer: string;
  created: string;
  requiredDate: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
  priority: Priority;
  status: PurchaseRequestStatus;
  reason: string;
  linkedPo?: string;
  forecastBasis?: {
    source?: string;
    peakGap?: number;
    serviceLevel?: number;
    safetyFactor?: number;
    stockoutMonths?: number;
    firstStockoutMonth?: string | null;
    projectedAvailable?: number;
    reorderPoint?: number;
    daysCover?: number;
    leadTimeDays?: number;
    moq?: number;
    batchMultiple?: number;
    plannedReceipt?: number;
    plannedReleasePeriod?: string;
    mrpException?: string;
    bomSourceSummary?: string;
    bomSources?: {
      parent: string;
      parentName?: string;
      top?: string;
      topName?: string;
      level?: number;
      demand: number;
    }[];
  } | null;
  approvalSnapshot?: ApprovalSnapshot | null;
  statusUpdatedAt?: string;
  lastAuditId?: string;
  auditTrailIds?: string[];
};

export type PurchaseIntent = {
  selectedPr?: string;
  sourceSku?: string;
  createdAt: number;
};

export type DemoUser = {
  id: string;
  company: string;
  name: string;
  email: string;
  role: string;
  createdAt?: string;
  lastLoginAt?: string;
};

export type ReceivingDocLine = {
  grnLineId?: string;
  poLineId?: string;
  poId?: string;
  sku: string;
  itemName?: string;
  receivedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  warehouseId?: string;
  unit?: string;
  status?: string;
};

export type ReceivingDoc = {
  grn: string;
  po: string;
  supplier: string;
  arrived: string;
  dock: string;
  receiver: string;
  items: number;
  passed: number;
  failed: number;
  status: RecvStatus;
  warehouse: string;
  lines?: ReceivingDocLine[];
  postedAt?: string;
  postedBy?: string;
  inventoryApplied?: boolean;
  inventoryMovementIds?: string[];
  statusUpdatedAt?: string;
  lastAuditId?: string;
  auditTrailIds?: string[];
};

export type AiConfidenceDimension = {
  key: "forecast" | "inventory" | "supplier" | "external" | string;
  label: string;
  score: number;
  level: "高" | "中" | "低";
  evidence: string[];
  warnings: string[];
};

export type AiConfidence = {
  score: number;
  level: "高" | "中" | "低";
  dimensions?: AiConfidenceDimension[];
  evidence: string[];
  warnings: string[];
  recommendedValidation: string;
  method: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  confidence?: AiConfidence;
};

export type MarketPrice = {
  symbol: string;
  name: string;
  category: string;
  price: number;
  unit: string;
  changePct: number;
  direction: string;
  asOf: string;
  source: string;
  procurementImpact?: string;
};

export type AuditEntry = {
  auditId: string;
  id?: string;
  timestamp: string;
  actor: string;
  source?: string;
  action: string;
  entityType: "purchaseRequest" | "purchaseOrder" | "rfq" | "receivingDoc" | string;
  entityId: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  reason?: string;
  metadata?: Record<string, unknown>;
};
