-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "receivingBaseStatus" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PurchaseOrderLine" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ReceivingDocument" ADD COLUMN     "documentNumber" TEXT,
ADD COLUMN     "postedAt" TIMESTAMP(3),
ADD COLUMN     "postedById" TEXT,
ADD COLUMN     "postingStatus" TEXT NOT NULL DEFAULT 'unposted',
ADD COLUMN     "reversalReason" TEXT,
ADD COLUMN     "reversedAt" TIMESTAMP(3),
ADD COLUMN     "reversedById" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "workflowStatus" TEXT NOT NULL DEFAULT 'draft';

-- AlterTable
ALTER TABLE "ReceivingLine" ADD COLUMN     "location" TEXT,
ADD COLUMN     "locationKey" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "lotNumber" TEXT,
ADD COLUMN     "purchaseOrderLineId" TEXT,
ADD COLUMN     "serialData" JSONB,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "warehouseId" TEXT;

-- AlterTable
ALTER TABLE "InventoryBalance" ADD COLUMN     "locationKey" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "warehouseKey" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "InventoryMovement" ADD COLUMN     "actorId" TEXT,
ADD COLUMN     "locationKey" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "postingBatchId" TEXT,
ADD COLUMN     "reversalOfMovementId" TEXT,
ADD COLUMN     "reversedByMovementId" TEXT,
ADD COLUMN     "sourceDocumentId" TEXT,
ADD COLUMN     "sourceDocumentLineId" TEXT,
ADD COLUMN     "sourceDocumentType" TEXT;

-- Normalize existing nullable warehouse/location values before enforcing the
-- authoritative balance natural key. Duplicate rows fail the migration; no
-- business record is automatically deleted or merged.
UPDATE "ReceivingLine" SET "locationKey" = lower(trim(coalesce("location", '')));
UPDATE "ReceivingDocument" SET "workflowStatus" = coalesce(nullif(trim("status"), ''), 'draft');
UPDATE "InventoryBalance"
SET "warehouseKey" = coalesce("warehouseId", ''),
    "locationKey" = lower(trim(coalesce("location", '')));
UPDATE "InventoryMovement" SET "locationKey" = lower(trim(coalesce("location", '')));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "InventoryBalance"
    GROUP BY "tenantId", "sku", "warehouseKey", "locationKey"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'FLOWCHAIN_INVENTORY_BALANCE_DUPLICATES: run preflight.sql and remediate duplicate natural keys before applying this migration';
  END IF;
END $$;

-- CreateTable
CREATE TABLE "BusinessCommandExecution" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "commandType" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "entityType" TEXT,
    "entityId" TEXT,
    "resultPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BusinessCommandExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessCommandExecution_tenantId_entityType_entityId_idx" ON "BusinessCommandExecution"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessCommandExecution_tenantId_commandType_idempotencyKe_key" ON "BusinessCommandExecution"("tenantId", "commandType", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ReceivingDocument_tenantId_postingStatus_idx" ON "ReceivingDocument"("tenantId", "postingStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ReceivingDocument_tenantId_documentNumber_key" ON "ReceivingDocument"("tenantId", "documentNumber");

-- CreateIndex
CREATE INDEX "ReceivingLine_purchaseOrderLineId_idx" ON "ReceivingLine"("purchaseOrderLineId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryBalance_tenantId_sku_warehouseKey_locationKey_key" ON "InventoryBalance"("tenantId", "sku", "warehouseKey", "locationKey");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMovement_reversalOfMovementId_key" ON "InventoryMovement"("reversalOfMovementId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMovement_reversedByMovementId_key" ON "InventoryMovement"("reversedByMovementId");

-- CreateIndex
CREATE INDEX "InventoryMovement_tenantId_relatedGrnId_movementType_idx" ON "InventoryMovement"("tenantId", "relatedGrnId", "movementType");

-- CreateIndex
CREATE INDEX "InventoryMovement_tenantId_sku_warehouseId_locationKey_idx" ON "InventoryMovement"("tenantId", "sku", "warehouseId", "locationKey");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMovement_tenantId_movementType_sourceDocumentLineI_key" ON "InventoryMovement"("tenantId", "movementType", "sourceDocumentLineId");

-- AddForeignKey
ALTER TABLE "BusinessCommandExecution" ADD CONSTRAINT "BusinessCommandExecution_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
