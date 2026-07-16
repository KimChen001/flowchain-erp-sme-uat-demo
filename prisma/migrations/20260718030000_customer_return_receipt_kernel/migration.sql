CREATE TABLE "QuarantineDispositionAllocation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "quarantineBalanceId" TEXT NOT NULL,
  "sourceMovementId" TEXT NOT NULL,
  "consumerMovementId" TEXT NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "reversedAt" TIMESTAMP(3),
  "reversedByMovementId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuarantineDispositionAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QuarantineDispositionAllocation_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "QuarantineDispositionAllocation_status_check" CHECK ("status" IN ('active', 'reversed')),
  CONSTRAINT "QuarantineDispositionAllocation_reversal_check" CHECK (
    ("status" = 'active' AND "reversedAt" IS NULL AND "reversedByMovementId" IS NULL) OR
    ("status" = 'reversed' AND "reversedAt" IS NOT NULL AND "reversedByMovementId" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "QuarantineDispositionAllocation_sourceMovementId_consumerMovementId_key"
  ON "QuarantineDispositionAllocation"("sourceMovementId", "consumerMovementId");
CREATE INDEX "QuarantineDispositionAllocation_tenantId_quarantineBalanceId_status_idx"
  ON "QuarantineDispositionAllocation"("tenantId", "quarantineBalanceId", "status");
CREATE INDEX "QuarantineDispositionAllocation_sourceMovementId_status_idx"
  ON "QuarantineDispositionAllocation"("sourceMovementId", "status");
CREATE INDEX "QuarantineDispositionAllocation_consumerMovementId_status_idx"
  ON "QuarantineDispositionAllocation"("consumerMovementId", "status");

ALTER TABLE "QuarantineDispositionAllocation"
  ADD CONSTRAINT "QuarantineDispositionAllocation_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuarantineDispositionAllocation"
  ADD CONSTRAINT "QuarantineDispositionAllocation_quarantineBalanceId_fkey"
  FOREIGN KEY ("quarantineBalanceId") REFERENCES "QuarantineInventoryBalance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuarantineDispositionAllocation"
  ADD CONSTRAINT "QuarantineDispositionAllocation_sourceMovementId_fkey"
  FOREIGN KEY ("sourceMovementId") REFERENCES "InventoryMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuarantineDispositionAllocation"
  ADD CONSTRAINT "QuarantineDispositionAllocation_consumerMovementId_fkey"
  FOREIGN KEY ("consumerMovementId") REFERENCES "InventoryMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuarantineDispositionAllocation"
  ADD CONSTRAINT "QuarantineDispositionAllocation_reversedByMovementId_fkey"
  FOREIGN KEY ("reversedByMovementId") REFERENCES "InventoryMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
