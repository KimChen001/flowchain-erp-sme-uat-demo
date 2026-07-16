ALTER TABLE "ReturnRequest"
  ADD COLUMN "sourceDocumentNumber" TEXT,
  ADD COLUMN "contextDocumentType" TEXT,
  ADD COLUMN "contextDocumentId" TEXT,
  ADD COLUMN "rejectedAt" TIMESTAMP(3),
  ADD COLUMN "rejectedById" TEXT,
  ADD COLUMN "rejectionReason" TEXT;

ALTER TABLE "ReturnRequest"
  ADD CONSTRAINT "ReturnRequest_context_type_check"
  CHECK (
    "contextDocumentType" IS NULL OR
    "contextDocumentType" IN (
      'ReceivingDocument',
      'PurchaseOrder',
      'SalesOrder',
      'ShipmentDocument'
    )
  );

ALTER TABLE "ReturnRequestLine"
  ADD COLUMN "sourceDocumentType" TEXT,
  ADD COLUMN "sourceDocumentId" TEXT,
  ADD COLUMN "sourceQuantity" DECIMAL(18,4),
  ADD COLUMN "sourceWarehouseIds" JSONB;

ALTER TABLE "ReturnRequestLine"
  ADD CONSTRAINT "ReturnRequestLine_source_type_check"
  CHECK (
    "sourceDocumentType" IS NULL OR
    "sourceDocumentType" IN ('ReceivingDocument', 'ShipmentDocument')
  ),
  ADD CONSTRAINT "ReturnRequestLine_source_quantity_check"
  CHECK ("sourceQuantity" IS NULL OR "sourceQuantity" > 0);

ALTER TABLE "ReturnAuthorization"
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelledById" TEXT,
  ADD COLUMN "cancellationReason" TEXT,
  ADD COLUMN "expiredAt" TIMESTAMP(3),
  ADD COLUMN "expiredById" TEXT;

CREATE INDEX "ReturnRequestLine_sourceDocumentType_sourceDocumentId_sourceDocumentLineId_idx"
  ON "ReturnRequestLine"(
    "sourceDocumentType",
    "sourceDocumentId",
    "sourceDocumentLineId"
  );

CREATE UNIQUE INDEX "ReturnAuthorization_one_active_per_request_key"
  ON "ReturnAuthorization"("returnRequestId")
  WHERE "workflowStatus" IN ('draft', 'approved', 'partially_executed');
