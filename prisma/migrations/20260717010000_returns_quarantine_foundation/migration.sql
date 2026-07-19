CREATE TABLE "QuarantineInventoryBalance" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "itemName" TEXT,
  "warehouseId" TEXT NOT NULL,
  "warehouseKey" TEXT NOT NULL DEFAULT '',
  "location" TEXT,
  "locationKey" TEXT NOT NULL DEFAULT '',
  "onHandQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "unit" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "version" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuarantineInventoryBalance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QuarantineInventoryBalance_quantity_check" CHECK ("onHandQuantity" >= 0),
  CONSTRAINT "QuarantineInventoryBalance_status_check" CHECK ("status" IN ('active', 'closed')),
  CONSTRAINT "QuarantineInventoryBalance_version_check" CHECK ("version" >= 0)
);

CREATE TABLE "ReturnRequest" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "requestNumber" TEXT NOT NULL,
  "returnType" TEXT NOT NULL,
  "partnerId" TEXT,
  "partnerNameSnapshot" TEXT,
  "sourceDocumentType" TEXT NOT NULL,
  "sourceDocumentId" TEXT NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "reasonDetail" TEXT,
  "workflowStatus" TEXT NOT NULL DEFAULT 'draft',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "requestedById" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3),
  "submittedById" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancelledById" TEXT,
  "cancellationReason" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReturnRequest_type_check" CHECK ("returnType" IN ('supplier_return', 'customer_return')),
  CONSTRAINT "ReturnRequest_source_type_check" CHECK ("sourceDocumentType" IN ('ReceivingDocument', 'PurchaseOrder', 'SalesOrder', 'ShipmentDocument')),
  CONSTRAINT "ReturnRequest_status_check" CHECK ("workflowStatus" IN ('draft', 'submitted', 'authorized', 'rejected', 'partially_executed', 'executed', 'cancelled')),
  CONSTRAINT "ReturnRequest_reason_check" CHECK (length(trim("reasonCode")) > 0),
  CONSTRAINT "ReturnRequest_version_check" CHECK ("version" >= 0)
);

CREATE TABLE "ReturnRequestLine" (
  "id" TEXT NOT NULL,
  "returnRequestId" TEXT NOT NULL,
  "sourceDocumentLineId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "itemName" TEXT NOT NULL,
  "requestedQuantity" DECIMAL(18,4) NOT NULL,
  "unit" TEXT,
  "reasonCode" TEXT NOT NULL,
  "conditionCode" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  CONSTRAINT "ReturnRequestLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReturnRequestLine_quantity_check" CHECK ("requestedQuantity" > 0),
  CONSTRAINT "ReturnRequestLine_reason_check" CHECK (length(trim("reasonCode")) > 0),
  CONSTRAINT "ReturnRequestLine_version_check" CHECK ("version" >= 0)
);

CREATE TABLE "ReturnAuthorization" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "authorizationNumber" TEXT NOT NULL,
  "returnRequestId" TEXT NOT NULL,
  "workflowStatus" TEXT NOT NULL DEFAULT 'draft',
  "authorizedAt" TIMESTAMP(3),
  "authorizedById" TEXT,
  "rejectedAt" TIMESTAMP(3),
  "rejectedById" TEXT,
  "rejectionReason" TEXT,
  "expiresAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReturnAuthorization_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReturnAuthorization_status_check" CHECK ("workflowStatus" IN ('draft', 'approved', 'rejected', 'cancelled', 'partially_executed', 'executed', 'expired')),
  CONSTRAINT "ReturnAuthorization_version_check" CHECK ("version" >= 0)
);

CREATE TABLE "ReturnAuthorizationLine" (
  "id" TEXT NOT NULL,
  "returnAuthorizationId" TEXT NOT NULL,
  "returnRequestLineId" TEXT NOT NULL,
  "authorizedQuantity" DECIMAL(18,4) NOT NULL,
  "dispositionRoute" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  CONSTRAINT "ReturnAuthorizationLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReturnAuthorizationLine_quantity_check" CHECK ("authorizedQuantity" > 0),
  CONSTRAINT "ReturnAuthorizationLine_disposition_check" CHECK ("dispositionRoute" IN ('receive_to_quarantine', 'return_from_available', 'return_from_quarantine', 'release_quarantine_to_available', 'retain_in_quarantine')),
  CONSTRAINT "ReturnAuthorizationLine_version_check" CHECK ("version" >= 0)
);

CREATE TABLE "ReturnPostingDocument" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "postingNumber" TEXT NOT NULL,
  "returnAuthorizationId" TEXT NOT NULL,
  "postingType" TEXT NOT NULL,
  "workflowStatus" TEXT NOT NULL DEFAULT 'draft',
  "postingStatus" TEXT NOT NULL DEFAULT 'unposted',
  "warehouseId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0,
  "postedAt" TIMESTAMP(3),
  "postedById" TEXT,
  "reversedAt" TIMESTAMP(3),
  "reversedById" TEXT,
  "reversalReason" TEXT,
  "cancellationReason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReturnPostingDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReturnPostingDocument_type_check" CHECK ("postingType" IN ('customer_return_receipt', 'supplier_return_dispatch', 'quarantine_release')),
  CONSTRAINT "ReturnPostingDocument_workflow_check" CHECK ("workflowStatus" IN ('draft', 'ready', 'cancelled')),
  CONSTRAINT "ReturnPostingDocument_posting_check" CHECK ("postingStatus" IN ('unposted', 'posted', 'reversed')),
  CONSTRAINT "ReturnPostingDocument_version_check" CHECK ("version" >= 0)
);

CREATE TABLE "ReturnPostingLine" (
  "id" TEXT NOT NULL,
  "returnPostingId" TEXT NOT NULL,
  "returnAuthorizationLineId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "itemName" TEXT NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "unit" TEXT,
  "warehouseId" TEXT NOT NULL,
  "location" TEXT,
  "locationKey" TEXT NOT NULL DEFAULT '',
  "inventoryBalanceId" TEXT,
  "quarantineBalanceId" TEXT,
  "destinationInventoryBalanceId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  CONSTRAINT "ReturnPostingLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReturnPostingLine_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "ReturnPostingLine_target_check" CHECK (
    "inventoryBalanceId" IS NOT NULL OR
    "quarantineBalanceId" IS NOT NULL OR
    "destinationInventoryBalanceId" IS NOT NULL
  ),
  CONSTRAINT "ReturnPostingLine_version_check" CHECK ("version" >= 0)
);

CREATE UNIQUE INDEX "QuarantineInventoryBalance_tenantId_sku_warehouseKey_locationKey_key"
  ON "QuarantineInventoryBalance"("tenantId", "sku", "warehouseKey", "locationKey");
CREATE INDEX "QuarantineInventoryBalance_tenantId_sku_idx"
  ON "QuarantineInventoryBalance"("tenantId", "sku");
CREATE INDEX "QuarantineInventoryBalance_tenantId_warehouseId_locationKey_idx"
  ON "QuarantineInventoryBalance"("tenantId", "warehouseId", "locationKey");
CREATE INDEX "QuarantineInventoryBalance_tenantId_status_idx"
  ON "QuarantineInventoryBalance"("tenantId", "status");

CREATE UNIQUE INDEX "ReturnRequest_tenantId_requestNumber_key"
  ON "ReturnRequest"("tenantId", "requestNumber");
CREATE INDEX "ReturnRequest_tenantId_returnType_workflowStatus_idx"
  ON "ReturnRequest"("tenantId", "returnType", "workflowStatus");
CREATE INDEX "ReturnRequest_tenantId_sourceDocumentType_sourceDocumentId_idx"
  ON "ReturnRequest"("tenantId", "sourceDocumentType", "sourceDocumentId");
CREATE INDEX "ReturnRequest_tenantId_createdAt_idx"
  ON "ReturnRequest"("tenantId", "createdAt");

CREATE UNIQUE INDEX "ReturnRequestLine_returnRequestId_sourceDocumentLineId_key"
  ON "ReturnRequestLine"("returnRequestId", "sourceDocumentLineId");
CREATE INDEX "ReturnRequestLine_returnRequestId_idx"
  ON "ReturnRequestLine"("returnRequestId");
CREATE INDEX "ReturnRequestLine_itemId_sku_idx"
  ON "ReturnRequestLine"("itemId", "sku");

CREATE UNIQUE INDEX "ReturnAuthorization_tenantId_authorizationNumber_key"
  ON "ReturnAuthorization"("tenantId", "authorizationNumber");
CREATE INDEX "ReturnAuthorization_tenantId_returnRequestId_idx"
  ON "ReturnAuthorization"("tenantId", "returnRequestId");
CREATE INDEX "ReturnAuthorization_tenantId_workflowStatus_idx"
  ON "ReturnAuthorization"("tenantId", "workflowStatus");
CREATE INDEX "ReturnAuthorization_tenantId_createdAt_idx"
  ON "ReturnAuthorization"("tenantId", "createdAt");

CREATE UNIQUE INDEX "ReturnAuthorizationLine_returnAuthorizationId_returnRequestLineId_key"
  ON "ReturnAuthorizationLine"("returnAuthorizationId", "returnRequestLineId");
CREATE INDEX "ReturnAuthorizationLine_returnAuthorizationId_idx"
  ON "ReturnAuthorizationLine"("returnAuthorizationId");
CREATE INDEX "ReturnAuthorizationLine_returnRequestLineId_idx"
  ON "ReturnAuthorizationLine"("returnRequestLineId");

CREATE UNIQUE INDEX "ReturnPostingDocument_tenantId_postingNumber_key"
  ON "ReturnPostingDocument"("tenantId", "postingNumber");
CREATE INDEX "ReturnPostingDocument_tenantId_returnAuthorizationId_idx"
  ON "ReturnPostingDocument"("tenantId", "returnAuthorizationId");
CREATE INDEX "ReturnPostingDocument_tenantId_postingType_postingStatus_idx"
  ON "ReturnPostingDocument"("tenantId", "postingType", "postingStatus");
CREATE INDEX "ReturnPostingDocument_tenantId_warehouseId_idx"
  ON "ReturnPostingDocument"("tenantId", "warehouseId");
CREATE INDEX "ReturnPostingDocument_tenantId_createdAt_idx"
  ON "ReturnPostingDocument"("tenantId", "createdAt");

CREATE UNIQUE INDEX "ReturnPostingLine_returnPostingId_returnAuthorizationLineId_key"
  ON "ReturnPostingLine"("returnPostingId", "returnAuthorizationLineId");
CREATE INDEX "ReturnPostingLine_returnPostingId_idx"
  ON "ReturnPostingLine"("returnPostingId");
CREATE INDEX "ReturnPostingLine_returnAuthorizationLineId_idx"
  ON "ReturnPostingLine"("returnAuthorizationLineId");
CREATE INDEX "ReturnPostingLine_inventoryBalanceId_idx"
  ON "ReturnPostingLine"("inventoryBalanceId");
CREATE INDEX "ReturnPostingLine_quarantineBalanceId_idx"
  ON "ReturnPostingLine"("quarantineBalanceId");
CREATE INDEX "ReturnPostingLine_destinationInventoryBalanceId_idx"
  ON "ReturnPostingLine"("destinationInventoryBalanceId");
CREATE INDEX "ReturnPostingLine_warehouseId_locationKey_idx"
  ON "ReturnPostingLine"("warehouseId", "locationKey");

ALTER TABLE "QuarantineInventoryBalance"
  ADD CONSTRAINT "QuarantineInventoryBalance_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuarantineInventoryBalance"
  ADD CONSTRAINT "QuarantineInventoryBalance_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuarantineInventoryBalance"
  ADD CONSTRAINT "QuarantineInventoryBalance_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReturnRequest"
  ADD CONSTRAINT "ReturnRequest_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnRequestLine"
  ADD CONSTRAINT "ReturnRequestLine_returnRequestId_fkey"
  FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReturnAuthorization"
  ADD CONSTRAINT "ReturnAuthorization_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnAuthorization"
  ADD CONSTRAINT "ReturnAuthorization_returnRequestId_fkey"
  FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnAuthorizationLine"
  ADD CONSTRAINT "ReturnAuthorizationLine_returnAuthorizationId_fkey"
  FOREIGN KEY ("returnAuthorizationId") REFERENCES "ReturnAuthorization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReturnAuthorizationLine"
  ADD CONSTRAINT "ReturnAuthorizationLine_returnRequestLineId_fkey"
  FOREIGN KEY ("returnRequestLineId") REFERENCES "ReturnRequestLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReturnPostingDocument"
  ADD CONSTRAINT "ReturnPostingDocument_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnPostingDocument"
  ADD CONSTRAINT "ReturnPostingDocument_returnAuthorizationId_fkey"
  FOREIGN KEY ("returnAuthorizationId") REFERENCES "ReturnAuthorization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnPostingLine"
  ADD CONSTRAINT "ReturnPostingLine_returnPostingId_fkey"
  FOREIGN KEY ("returnPostingId") REFERENCES "ReturnPostingDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReturnPostingLine"
  ADD CONSTRAINT "ReturnPostingLine_returnAuthorizationLineId_fkey"
  FOREIGN KEY ("returnAuthorizationLineId") REFERENCES "ReturnAuthorizationLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnPostingLine"
  ADD CONSTRAINT "ReturnPostingLine_inventoryBalanceId_fkey"
  FOREIGN KEY ("inventoryBalanceId") REFERENCES "InventoryBalance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnPostingLine"
  ADD CONSTRAINT "ReturnPostingLine_quarantineBalanceId_fkey"
  FOREIGN KEY ("quarantineBalanceId") REFERENCES "QuarantineInventoryBalance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnPostingLine"
  ADD CONSTRAINT "ReturnPostingLine_destinationInventoryBalanceId_fkey"
  FOREIGN KEY ("destinationInventoryBalanceId") REFERENCES "InventoryBalance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
