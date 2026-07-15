ALTER TABLE "Tenant" ADD COLUMN "openingBalanceLockedAt" TIMESTAMP(3);

CREATE TABLE "WarehouseLocation" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "warehouseId" TEXT NOT NULL,
  "code" TEXT NOT NULL, "locationKey" TEXT NOT NULL, "name" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "WarehouseLocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WarehouseLocation_status_check" CHECK ("status" IN ('active', 'inactive'))
);

CREATE TABLE "ImportBatch" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "importType" TEXT NOT NULL,
  "fileName" TEXT NOT NULL, "fileHash" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'uploaded',
  "totalRows" INTEGER NOT NULL DEFAULT 0, "validRows" INTEGER NOT NULL DEFAULT 0,
  "invalidRows" INTEGER NOT NULL DEFAULT 0, "committedRows" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "committedAt" TIMESTAMP(3), "idempotencyKey" TEXT, "mapping" JSONB, "summary" JSONB,
  "normalizedRows" JSONB, CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ImportBatch_status_check" CHECK ("status" IN ('uploaded','validated','blocked','ready','committing','completed','failed','cancelled'))
);

CREATE TABLE "ImportIssue" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "importBatchId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL, "field" TEXT, "code" TEXT NOT NULL, "message" TEXT NOT NULL,
  "rawValue" TEXT, CONSTRAINT "ImportIssue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WarehouseLocation_tenantId_warehouseId_locationKey_key" ON "WarehouseLocation"("tenantId","warehouseId","locationKey");
CREATE INDEX "WarehouseLocation_tenantId_warehouseId_idx" ON "WarehouseLocation"("tenantId","warehouseId");
CREATE UNIQUE INDEX "ImportBatch_tenantId_importType_idempotencyKey_key" ON "ImportBatch"("tenantId","importType","idempotencyKey");
CREATE INDEX "ImportBatch_tenantId_status_createdAt_idx" ON "ImportBatch"("tenantId","status","createdAt");
CREATE INDEX "ImportIssue_tenantId_importBatchId_rowNumber_idx" ON "ImportIssue"("tenantId","importBatchId","rowNumber");

ALTER TABLE "WarehouseLocation" ADD CONSTRAINT "WarehouseLocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WarehouseLocation" ADD CONSTRAINT "WarehouseLocation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportIssue" ADD CONSTRAINT "ImportIssue_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportIssue" ADD CONSTRAINT "ImportIssue_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
