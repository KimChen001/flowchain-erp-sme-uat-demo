CREATE TABLE "StockTransferDocument" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "transferNumber" TEXT NOT NULL,
  "workflowStatus" TEXT NOT NULL DEFAULT 'draft',
  "postingStatus" TEXT NOT NULL DEFAULT 'unposted',
  "version" INTEGER NOT NULL DEFAULT 0,
  "postedAt" TIMESTAMP(3),
  "postedById" TEXT,
  "reversedAt" TIMESTAMP(3),
  "reversedById" TEXT,
  "cancellationReason" TEXT,
  "reversalReason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StockTransferDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StockTransferDocument_version_check" CHECK ("version" >= 0)
);

CREATE TABLE "StockTransferLine" (
  "id" TEXT NOT NULL,
  "transferId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "itemName" TEXT NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "unit" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  CONSTRAINT "StockTransferLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StockTransferLine_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "StockTransferLine_version_check" CHECK ("version" >= 0)
);

CREATE TABLE "StockTransferLeg" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "transferLineId" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "location" TEXT,
  "locationKey" TEXT NOT NULL DEFAULT '',
  "version" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  CONSTRAINT "StockTransferLeg_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StockTransferLeg_direction_check" CHECK ("direction" IN ('source', 'destination')),
  CONSTRAINT "StockTransferLeg_version_check" CHECK ("version" >= 0)
);

CREATE TABLE "CycleCountSession" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "countNumber" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "workflowStatus" TEXT NOT NULL DEFAULT 'draft',
  "blindCount" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 0,
  "submittedAt" TIMESTAMP(3),
  "submittedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "postedAt" TIMESTAMP(3),
  "postedById" TEXT,
  "cancellationReason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CycleCountSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CycleCountSession_version_check" CHECK ("version" >= 0)
);

CREATE TABLE "CycleCountLine" (
  "id" TEXT NOT NULL,
  "countSessionId" TEXT NOT NULL,
  "inventoryBalanceId" TEXT NOT NULL,
  "itemId" TEXT,
  "sku" TEXT NOT NULL,
  "itemName" TEXT,
  "warehouseId" TEXT NOT NULL,
  "location" TEXT,
  "locationKey" TEXT NOT NULL DEFAULT '',
  "unit" TEXT,
  "recordedOnHandQuantity" DECIMAL(18,4) NOT NULL,
  "recordedReservedQuantity" DECIMAL(18,4) NOT NULL,
  "recordedAvailableQuantity" DECIMAL(18,4) NOT NULL,
  "recordedBalanceVersion" INTEGER NOT NULL,
  "countedQuantity" DECIMAL(18,4),
  "varianceQuantity" DECIMAL(18,4),
  "version" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  CONSTRAINT "CycleCountLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CycleCountLine_recorded_check" CHECK ("recordedOnHandQuantity" >= 0 AND "recordedReservedQuantity" >= 0 AND "recordedAvailableQuantity" >= 0),
  CONSTRAINT "CycleCountLine_counted_check" CHECK ("countedQuantity" IS NULL OR "countedQuantity" >= 0),
  CONSTRAINT "CycleCountLine_version_check" CHECK ("version" >= 0 AND "recordedBalanceVersion" >= 0)
);

CREATE TABLE "InventoryAdjustmentDocument" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "adjustmentNumber" TEXT NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "notes" TEXT,
  "workflowStatus" TEXT NOT NULL DEFAULT 'draft',
  "postingStatus" TEXT NOT NULL DEFAULT 'unposted',
  "version" INTEGER NOT NULL DEFAULT 0,
  "postedAt" TIMESTAMP(3),
  "postedById" TEXT,
  "reversedAt" TIMESTAMP(3),
  "reversedById" TEXT,
  "cancellationReason" TEXT,
  "reversalReason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryAdjustmentDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryAdjustmentDocument_version_check" CHECK ("version" >= 0)
);

CREATE TABLE "InventoryAdjustmentLine" (
  "id" TEXT NOT NULL,
  "adjustmentId" TEXT NOT NULL,
  "inventoryBalanceId" TEXT NOT NULL,
  "itemId" TEXT,
  "sku" TEXT NOT NULL,
  "itemName" TEXT,
  "warehouseId" TEXT NOT NULL,
  "location" TEXT,
  "locationKey" TEXT NOT NULL DEFAULT '',
  "adjustmentQuantity" DECIMAL(18,4) NOT NULL,
  "unit" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  CONSTRAINT "InventoryAdjustmentLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryAdjustmentLine_quantity_check" CHECK ("adjustmentQuantity" <> 0),
  CONSTRAINT "InventoryAdjustmentLine_version_check" CHECK ("version" >= 0)
);

CREATE UNIQUE INDEX "StockTransferDocument_tenantId_transferNumber_key" ON "StockTransferDocument"("tenantId", "transferNumber");
CREATE INDEX "StockTransferDocument_tenantId_workflowStatus_idx" ON "StockTransferDocument"("tenantId", "workflowStatus");
CREATE INDEX "StockTransferDocument_tenantId_postingStatus_idx" ON "StockTransferDocument"("tenantId", "postingStatus");
CREATE INDEX "StockTransferDocument_tenantId_createdAt_idx" ON "StockTransferDocument"("tenantId", "createdAt");
CREATE INDEX "StockTransferLine_transferId_idx" ON "StockTransferLine"("transferId");
CREATE UNIQUE INDEX "StockTransferLeg_transferLineId_direction_key" ON "StockTransferLeg"("transferLineId", "direction");
CREATE INDEX "StockTransferLeg_tenantId_warehouseId_locationKey_idx" ON "StockTransferLeg"("tenantId", "warehouseId", "locationKey");
CREATE UNIQUE INDEX "CycleCountSession_tenantId_countNumber_key" ON "CycleCountSession"("tenantId", "countNumber");
CREATE INDEX "CycleCountSession_tenantId_warehouseId_idx" ON "CycleCountSession"("tenantId", "warehouseId");
CREATE INDEX "CycleCountSession_tenantId_workflowStatus_idx" ON "CycleCountSession"("tenantId", "workflowStatus");
CREATE INDEX "CycleCountSession_tenantId_createdAt_idx" ON "CycleCountSession"("tenantId", "createdAt");
CREATE UNIQUE INDEX "CycleCountLine_countSessionId_inventoryBalanceId_key" ON "CycleCountLine"("countSessionId", "inventoryBalanceId");
CREATE INDEX "CycleCountLine_countSessionId_idx" ON "CycleCountLine"("countSessionId");
CREATE INDEX "CycleCountLine_warehouseId_locationKey_idx" ON "CycleCountLine"("warehouseId", "locationKey");
CREATE UNIQUE INDEX "InventoryAdjustmentDocument_tenantId_adjustmentNumber_key" ON "InventoryAdjustmentDocument"("tenantId", "adjustmentNumber");
CREATE INDEX "InventoryAdjustmentDocument_tenantId_workflowStatus_idx" ON "InventoryAdjustmentDocument"("tenantId", "workflowStatus");
CREATE INDEX "InventoryAdjustmentDocument_tenantId_postingStatus_idx" ON "InventoryAdjustmentDocument"("tenantId", "postingStatus");
CREATE INDEX "InventoryAdjustmentDocument_tenantId_createdAt_idx" ON "InventoryAdjustmentDocument"("tenantId", "createdAt");
CREATE INDEX "InventoryAdjustmentLine_adjustmentId_idx" ON "InventoryAdjustmentLine"("adjustmentId");
CREATE INDEX "InventoryAdjustmentLine_warehouseId_locationKey_idx" ON "InventoryAdjustmentLine"("warehouseId", "locationKey");

ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransferDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockTransferLeg" ADD CONSTRAINT "StockTransferLeg_transferLineId_fkey" FOREIGN KEY ("transferLineId") REFERENCES "StockTransferLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CycleCountLine" ADD CONSTRAINT "CycleCountLine_countSessionId_fkey" FOREIGN KEY ("countSessionId") REFERENCES "CycleCountSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryAdjustmentLine" ADD CONSTRAINT "InventoryAdjustmentLine_adjustmentId_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "InventoryAdjustmentDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
