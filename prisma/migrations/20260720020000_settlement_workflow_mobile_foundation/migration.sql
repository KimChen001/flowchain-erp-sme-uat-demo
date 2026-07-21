-- Phase 5.2B governed settlement workflow and mobile operations foundation.
-- Additive extension of the published Phase 5.2 settlement/cashbook facts.

ALTER TABLE "SettlementDocument"
  ADD COLUMN "workflowStatus" TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN "postingStatus" TEXT NOT NULL DEFAULT 'unposted',
  ADD COLUMN "submittedById" TEXT,
  ADD COLUMN "submittedAt" TIMESTAMP(3),
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "rejectedById" TEXT,
  ADD COLUMN "rejectedAt" TIMESTAMP(3),
  ADD COLUMN "rejectionReason" TEXT,
  ADD COLUMN "cancelledById" TEXT,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancellationReason" TEXT,
  ADD COLUMN "attachmentCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "clientMutationId" TEXT,
  ADD COLUMN "sourceDeviceId" TEXT,
  ADD COLUMN "lastWorkflowActionAt" TIMESTAMP(3),
  ADD COLUMN "cashAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "discountAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "totalSettlementAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "advanceCreatedAmount" DECIMAL(18,4) NOT NULL DEFAULT 0;

UPDATE "SettlementDocument" SET
  "workflowStatus" = CASE "status" WHEN 'posted' THEN 'posted' WHEN 'reversed' THEN 'reversed' WHEN 'cancelled' THEN 'cancelled' ELSE 'draft' END,
  "postingStatus" = CASE "status" WHEN 'posted' THEN 'posted' WHEN 'reversed' THEN 'reversed' ELSE 'unposted' END,
  "cashAmount" = "amount",
  "totalSettlementAmount" = "amount",
  "lastWorkflowActionAt" = COALESCE("reversedAt", "postedAt", "updatedAt", "createdAt");

ALTER TABLE "SettlementDocument" ADD CONSTRAINT "SettlementDocument_workflow_status_check"
  CHECK ("workflowStatus" IN ('draft','submitted','approved','rejected','cancelled','posted','reversed'));
ALTER TABLE "SettlementDocument" ADD CONSTRAINT "SettlementDocument_posting_status_check"
  CHECK ("postingStatus" IN ('unposted','posted','reversed'));
ALTER TABLE "SettlementDocument" ADD CONSTRAINT "SettlementDocument_totals_check"
  CHECK ("cashAmount" >= 0 AND "discountAmount" >= 0 AND "advanceCreatedAmount" >= 0 AND "totalSettlementAmount" >= 0);
CREATE INDEX "SettlementDocument_tenantId_workflowStatus_postingStatus_idx" ON "SettlementDocument"("tenantId","workflowStatus","postingStatus");
CREATE UNIQUE INDEX "SettlementDocument_tenantId_clientMutationId_key" ON "SettlementDocument"("tenantId","clientMutationId") WHERE "clientMutationId" IS NOT NULL;

ALTER TABLE "SettlementAllocation"
  ADD COLUMN "cashAppliedAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "discountAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "totalSettlementAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "discountReason" TEXT,
  ADD COLUMN "discountApprovedById" TEXT;
UPDATE "SettlementAllocation" SET "cashAppliedAmount" = "amount", "totalSettlementAmount" = "amount";
ALTER TABLE "SettlementAllocation" ADD CONSTRAINT "SettlementAllocation_totals_check"
  CHECK ("cashAppliedAmount" >= 0 AND "discountAmount" >= 0 AND "totalSettlementAmount" > 0 AND "totalSettlementAmount" = "cashAppliedAmount" + "discountAmount" AND "amount" = "totalSettlementAmount");

CREATE TABLE "PartnerAdvance" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "advanceNumber" TEXT NOT NULL, "advanceType" TEXT NOT NULL,
  "supplierId" TEXT, "customerId" TEXT, "currency" TEXT NOT NULL, "originalAmount" DECIMAL(18,4) NOT NULL,
  "appliedAmount" DECIMAL(18,4) NOT NULL DEFAULT 0, "remainingAmount" DECIMAL(18,4) NOT NULL,
  "sourceSettlementId" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'open', "version" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT, "reversedAt" TIMESTAMP(3), "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerAdvance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PartnerAdvance_type_check" CHECK ("advanceType" IN ('supplier_advance','customer_advance')),
  CONSTRAINT "PartnerAdvance_status_check" CHECK ("status" IN ('open','partially_applied','fully_applied','reversed')),
  CONSTRAINT "PartnerAdvance_partner_check" CHECK (("advanceType"='supplier_advance' AND "supplierId" IS NOT NULL AND "customerId" IS NULL) OR ("advanceType"='customer_advance' AND "customerId" IS NOT NULL AND "supplierId" IS NULL)),
  CONSTRAINT "PartnerAdvance_amounts_check" CHECK ("originalAmount" > 0 AND "appliedAmount" >= 0 AND "remainingAmount" >= 0 AND "appliedAmount" + "remainingAmount" = "originalAmount"),
  CONSTRAINT "PartnerAdvance_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$')
);
CREATE UNIQUE INDEX "PartnerAdvance_tenantId_advanceNumber_key" ON "PartnerAdvance"("tenantId","advanceNumber");
CREATE UNIQUE INDEX "PartnerAdvance_tenantId_id_key" ON "PartnerAdvance"("tenantId","id");
CREATE INDEX "PartnerAdvance_tenantId_advanceType_status_idx" ON "PartnerAdvance"("tenantId","advanceType","status");
CREATE INDEX "PartnerAdvance_tenantId_sourceSettlementId_idx" ON "PartnerAdvance"("tenantId","sourceSettlementId");

CREATE TABLE "AdvanceApplicationDocument" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "applicationNumber" TEXT NOT NULL, "advanceId" TEXT NOT NULL,
  "payableObligationId" TEXT, "receivableObligationId" TEXT, "appliedAmount" DECIMAL(18,4) NOT NULL, "currency" TEXT NOT NULL,
  "workflowStatus" TEXT NOT NULL DEFAULT 'draft', "postingStatus" TEXT NOT NULL DEFAULT 'unposted', "version" INTEGER NOT NULL DEFAULT 0,
  "submittedById" TEXT, "submittedAt" TIMESTAMP(3), "approvedById" TEXT, "approvedAt" TIMESTAMP(3),
  "postedById" TEXT, "postedAt" TIMESTAMP(3), "reversedById" TEXT, "reversedAt" TIMESTAMP(3), "reversalReason" TEXT,
  "clientMutationId" TEXT, "sourceDeviceId" TEXT, "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdvanceApplicationDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdvanceApplicationDocument_obligation_check" CHECK (("payableObligationId" IS NOT NULL)::int + ("receivableObligationId" IS NOT NULL)::int = 1),
  CONSTRAINT "AdvanceApplicationDocument_amount_check" CHECK ("appliedAmount" > 0),
  CONSTRAINT "AdvanceApplicationDocument_workflow_check" CHECK ("workflowStatus" IN ('draft','submitted','approved','cancelled','posted','reversed')),
  CONSTRAINT "AdvanceApplicationDocument_posting_check" CHECK ("postingStatus" IN ('unposted','posted','reversed'))
);
CREATE UNIQUE INDEX "AdvanceApplicationDocument_tenantId_applicationNumber_key" ON "AdvanceApplicationDocument"("tenantId","applicationNumber");
CREATE UNIQUE INDEX "AdvanceApplicationDocument_tenantId_id_key" ON "AdvanceApplicationDocument"("tenantId","id");
CREATE INDEX "AdvanceApplicationDocument_tenantId_advanceId_postingStatus_idx" ON "AdvanceApplicationDocument"("tenantId","advanceId","postingStatus");

CREATE TABLE "InternalTransferDocument" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "transferNumber" TEXT NOT NULL, "fromCashbookAccountId" TEXT NOT NULL,
  "toCashbookAccountId" TEXT NOT NULL, "currency" TEXT NOT NULL, "amount" DECIMAL(18,4) NOT NULL, "transferDate" TIMESTAMP(3) NOT NULL,
  "externalReference" TEXT, "memo" TEXT, "workflowStatus" TEXT NOT NULL DEFAULT 'draft', "postingStatus" TEXT NOT NULL DEFAULT 'unposted',
  "version" INTEGER NOT NULL DEFAULT 0, "submittedById" TEXT, "submittedAt" TIMESTAMP(3), "approvedById" TEXT, "approvedAt" TIMESTAMP(3),
  "rejectedById" TEXT, "rejectedAt" TIMESTAMP(3), "rejectionReason" TEXT, "cancelledById" TEXT, "cancelledAt" TIMESTAMP(3), "cancellationReason" TEXT,
  "postedById" TEXT, "postedAt" TIMESTAMP(3), "reversedById" TEXT, "reversedAt" TIMESTAMP(3), "reversalReason" TEXT,
  "clientMutationId" TEXT, "sourceDeviceId" TEXT, "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InternalTransferDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InternalTransferDocument_accounts_check" CHECK ("fromCashbookAccountId" <> "toCashbookAccountId"),
  CONSTRAINT "InternalTransferDocument_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "InternalTransferDocument_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "InternalTransferDocument_workflow_check" CHECK ("workflowStatus" IN ('draft','submitted','approved','rejected','cancelled','posted','reversed')),
  CONSTRAINT "InternalTransferDocument_posting_check" CHECK ("postingStatus" IN ('unposted','posted','reversed'))
);
CREATE UNIQUE INDEX "InternalTransferDocument_tenantId_transferNumber_key" ON "InternalTransferDocument"("tenantId","transferNumber");
CREATE UNIQUE INDEX "InternalTransferDocument_tenantId_id_key" ON "InternalTransferDocument"("tenantId","id");
CREATE INDEX "InternalTransferDocument_tenantId_workflowStatus_postingStatus_idx" ON "InternalTransferDocument"("tenantId","workflowStatus","postingStatus");

CREATE TABLE "StagedUpload" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "fileName" TEXT NOT NULL, "mimeType" TEXT NOT NULL, "sizeBytes" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL, "storageKey" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'staged', "createdById" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "boundAt" TIMESTAMP(3), "deletedAt" TIMESTAMP(3), "metadata" JSONB,
  CONSTRAINT "StagedUpload_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StagedUpload_size_check" CHECK ("sizeBytes" > 0 AND "sizeBytes" <= 20971520),
  CONSTRAINT "StagedUpload_hash_check" CHECK ("sha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "StagedUpload_status_check" CHECK ("status" IN ('staged','bound','expired','deleted'))
);
CREATE UNIQUE INDEX "StagedUpload_tenantId_id_key" ON "StagedUpload"("tenantId","id");
CREATE INDEX "StagedUpload_tenantId_status_expiresAt_idx" ON "StagedUpload"("tenantId","status","expiresAt");
CREATE INDEX "StagedUpload_tenantId_sha256_idx" ON "StagedUpload"("tenantId","sha256");

CREATE TABLE "SettlementAttachment" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "settlementId" TEXT NOT NULL, "uploadId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL, "mimeType" TEXT NOT NULL, "sizeBytes" INTEGER NOT NULL, "sha256" TEXT NOT NULL,
  "attachmentType" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'active', "sourceDeviceId" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "deletedAt" TIMESTAMP(3), "metadata" JSONB,
  CONSTRAINT "SettlementAttachment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SettlementAttachment_type_check" CHECK ("attachmentType" IN ('payment_proof','receipt_proof','approval_evidence','other')),
  CONSTRAINT "SettlementAttachment_status_check" CHECK ("status" IN ('active','deleted')),
  CONSTRAINT "SettlementAttachment_hash_check" CHECK ("sha256" ~ '^[a-f0-9]{64}$')
);
CREATE UNIQUE INDEX "SettlementAttachment_tenantId_id_key" ON "SettlementAttachment"("tenantId","id");
CREATE INDEX "SettlementAttachment_tenantId_settlementId_status_idx" ON "SettlementAttachment"("tenantId","settlementId","status");
CREATE INDEX "SettlementAttachment_tenantId_sha256_idx" ON "SettlementAttachment"("tenantId","sha256");

CREATE TABLE "ReceivingAttachment" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "receivingDocumentId" TEXT NOT NULL, "uploadId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL, "mimeType" TEXT NOT NULL, "sizeBytes" INTEGER NOT NULL, "sha256" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active', "sourceDeviceId" TEXT, "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "deletedAt" TIMESTAMP(3), "metadata" JSONB,
  CONSTRAINT "ReceivingAttachment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReceivingAttachment_status_check" CHECK ("status" IN ('active','deleted')),
  CONSTRAINT "ReceivingAttachment_hash_check" CHECK ("sha256" ~ '^[a-f0-9]{64}$')
);
CREATE UNIQUE INDEX "ReceivingAttachment_tenantId_id_key" ON "ReceivingAttachment"("tenantId","id");
CREATE INDEX "ReceivingAttachment_tenantId_receivingDocumentId_status_idx" ON "ReceivingAttachment"("tenantId","receivingDocumentId","status");
CREATE UNIQUE INDEX "ReceivingDocument_tenantId_id_key" ON "ReceivingDocument"("tenantId","id");

CREATE TABLE "DomainChangeFeed" (
  "sequence" BIGSERIAL NOT NULL, "tenantId" TEXT NOT NULL, "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL,
  "operation" TEXT NOT NULL, "entityVersion" INTEGER, "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actorId" TEXT, "source" TEXT NOT NULL, "requestId" TEXT, "payloadHash" TEXT NOT NULL, "sensitivityGroups" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DomainChangeFeed_pkey" PRIMARY KEY ("sequence"),
  CONSTRAINT "DomainChangeFeed_operation_check" CHECK ("operation" IN ('upsert','tombstone','access_epoch')),
  CONSTRAINT "DomainChangeFeed_hash_check" CHECK ("payloadHash" ~ '^[a-f0-9]{64}$')
);
CREATE INDEX "DomainChangeFeed_tenantId_sequence_idx" ON "DomainChangeFeed"("tenantId","sequence");
CREATE INDEX "DomainChangeFeed_tenantId_entityType_entityId_idx" ON "DomainChangeFeed"("tenantId","entityType","entityId");

CREATE TABLE "SyncClient" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "userId" TEXT NOT NULL, "deviceIdHash" TEXT NOT NULL,
  "platform" TEXT NOT NULL, "appVersion" TEXT, "deviceName" TEXT, "status" TEXT NOT NULL DEFAULT 'active',
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lastAcknowledgedSequence" BIGINT NOT NULL DEFAULT 0,
  "authorizationFingerprint" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "revokedAt" TIMESTAMP(3),
  CONSTRAINT "SyncClient_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SyncClient_platform_check" CHECK ("platform" IN ('web','pwa','ios','android','other')),
  CONSTRAINT "SyncClient_status_check" CHECK ("status" IN ('active','revoked')),
  CONSTRAINT "SyncClient_device_hash_check" CHECK ("deviceIdHash" ~ '^[a-f0-9]{64}$')
);
CREATE UNIQUE INDEX "SyncClient_tenantId_userId_deviceIdHash_key" ON "SyncClient"("tenantId","userId","deviceIdHash");
CREATE UNIQUE INDEX "SyncClient_tenantId_id_key" ON "SyncClient"("tenantId","id");
CREATE INDEX "SyncClient_tenantId_status_lastSeenAt_idx" ON "SyncClient"("tenantId","status","lastSeenAt");

ALTER TABLE "CashbookEntry" ALTER COLUMN "settlementId" DROP NOT NULL;
ALTER TABLE "CashbookEntry" ADD COLUMN "internalTransferId" TEXT;
ALTER TABLE "CashbookEntry" DROP CONSTRAINT "CashbookEntry_type_check";
ALTER TABLE "CashbookEntry" ADD CONSTRAINT "CashbookEntry_type_check" CHECK ("entryType" IN ('settlement','reversal','transfer_out','transfer_in','transfer_reversal_out','transfer_reversal_in'));
ALTER TABLE "CashbookEntry" ADD CONSTRAINT "CashbookEntry_source_check" CHECK (("settlementId" IS NOT NULL)::int + ("internalTransferId" IS NOT NULL)::int = 1);
CREATE UNIQUE INDEX "CashbookEntry_internalTransferId_entryType_key" ON "CashbookEntry"("internalTransferId","entryType");
CREATE INDEX "CashbookEntry_tenantId_internalTransferId_idx" ON "CashbookEntry"("tenantId","internalTransferId");

ALTER TABLE "PartnerAdvance" ADD CONSTRAINT "PartnerAdvance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerAdvance" ADD CONSTRAINT "PartnerAdvance_tenantId_sourceSettlementId_fkey" FOREIGN KEY ("tenantId","sourceSettlementId") REFERENCES "SettlementDocument"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdvanceApplicationDocument" ADD CONSTRAINT "AdvanceApplicationDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdvanceApplicationDocument" ADD CONSTRAINT "AdvanceApplicationDocument_tenantId_advanceId_fkey" FOREIGN KEY ("tenantId","advanceId") REFERENCES "PartnerAdvance"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdvanceApplicationDocument" ADD CONSTRAINT "AdvanceApplicationDocument_tenantId_payableObligationId_fkey" FOREIGN KEY ("tenantId","payableObligationId") REFERENCES "PayableObligation"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdvanceApplicationDocument" ADD CONSTRAINT "AdvanceApplicationDocument_tenantId_receivableObligationId_fkey" FOREIGN KEY ("tenantId","receivableObligationId") REFERENCES "ReceivableObligation"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InternalTransferDocument" ADD CONSTRAINT "InternalTransferDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InternalTransferDocument" ADD CONSTRAINT "InternalTransferDocument_tenantId_fromCashbookAccountId_fkey" FOREIGN KEY ("tenantId","fromCashbookAccountId") REFERENCES "CashbookAccount"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InternalTransferDocument" ADD CONSTRAINT "InternalTransferDocument_tenantId_toCashbookAccountId_fkey" FOREIGN KEY ("tenantId","toCashbookAccountId") REFERENCES "CashbookAccount"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StagedUpload" ADD CONSTRAINT "StagedUpload_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementAttachment" ADD CONSTRAINT "SettlementAttachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementAttachment" ADD CONSTRAINT "SettlementAttachment_tenantId_settlementId_fkey" FOREIGN KEY ("tenantId","settlementId") REFERENCES "SettlementDocument"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementAttachment" ADD CONSTRAINT "SettlementAttachment_tenantId_uploadId_fkey" FOREIGN KEY ("tenantId","uploadId") REFERENCES "StagedUpload"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReceivingAttachment" ADD CONSTRAINT "ReceivingAttachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReceivingAttachment" ADD CONSTRAINT "ReceivingAttachment_tenantId_receivingDocumentId_fkey" FOREIGN KEY ("tenantId","receivingDocumentId") REFERENCES "ReceivingDocument"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReceivingAttachment" ADD CONSTRAINT "ReceivingAttachment_tenantId_uploadId_fkey" FOREIGN KEY ("tenantId","uploadId") REFERENCES "StagedUpload"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DomainChangeFeed" ADD CONSTRAINT "DomainChangeFeed_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyncClient" ADD CONSTRAINT "SyncClient_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyncClient" ADD CONSTRAINT "SyncClient_tenantId_userId_fkey" FOREIGN KEY ("tenantId","userId") REFERENCES "User"("tenantId","id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashbookEntry" ADD CONSTRAINT "CashbookEntry_tenantId_internalTransferId_fkey" FOREIGN KEY ("tenantId","internalTransferId") REFERENCES "InternalTransferDocument"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The file hash is immutable after insertion; evidence deletion is a tombstone operation.
CREATE OR REPLACE FUNCTION flowchain_attachment_hash_immutable() RETURNS trigger AS $$
BEGIN
  IF NEW."sha256" IS DISTINCT FROM OLD."sha256" OR NEW."uploadId" IS DISTINCT FROM OLD."uploadId" THEN
    RAISE EXCEPTION 'Attachment evidence hash and upload reference are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "SettlementAttachment_hash_immutable" BEFORE UPDATE ON "SettlementAttachment" FOR EACH ROW EXECUTE FUNCTION flowchain_attachment_hash_immutable();
CREATE TRIGGER "ReceivingAttachment_hash_immutable" BEFORE UPDATE ON "ReceivingAttachment" FOR EACH ROW EXECUTE FUNCTION flowchain_attachment_hash_immutable();

ALTER TABLE "TenantRolePermission" DROP CONSTRAINT "TenantRolePermission_permissionCode_catalog_check";
ALTER TABLE "TenantRolePermission" ADD CONSTRAINT "TenantRolePermission_permissionCode_catalog_check" CHECK ("permissionCode" IN (
  'settings.workspace.read','settings.workspace.manage','settings.users.read','settings.users.manage','settings.roles.read','settings.roles.manage','settings.roles.assign','settings.numbering.read','settings.numbering.manage','settings.review_policy.read','settings.review_policy.manage','settings.modules.read','settings.modules.manage','settings.import.manage','settings.warehouse_import.manage','settings.diagnostics.read','settings.export.read','audit.read','audit.read_sensitive',
  'returns.request.read','returns.request.create','returns.request.revise','returns.request.submit','returns.request.cancel','returns.customer_request.manage','returns.authorization.read','returns.authorization.approve','returns.authorization.reject','returns.authorization.cancel','returns.authorization.expire','returns.posting.read','returns.posting.prepare','returns.posting.ready','returns.posting.post','returns.posting.cancel','returns.posting.reverse','returns.quarantine.read','returns.quarantine.release_prepare','returns.quarantine.release_post','returns.quarantine.release_reverse',
  'receiving.read','receiving.prepare','receiving.post','receiving.reverse','sales_order.read','sales_order.create','sales_order.revise','sales_order.submit','sales_order.cancel','shipment.read','shipment.prepare','shipment.post','shipment.reverse','inventory.balance.read','inventory.transfer.read','inventory.transfer.create','inventory.transfer.post','inventory.transfer.reverse','inventory.count.read','inventory.count.create','inventory.count.submit','inventory.count.review','inventory.count.post','inventory.count.reverse','inventory.adjustment.read','inventory.adjustment.create','inventory.adjustment.approve','inventory.adjustment.post','inventory.adjustment.reverse',
  'finance.overview.read','finance.amounts.read','finance.partner_snapshot.read','procurement.prices.read','finance.supplier_invoice.read','finance.supplier_invoice.create','finance.supplier_invoice.revise','finance.supplier_invoice.submit','finance.supplier_invoice.approve','finance.three_way_match.read','finance.three_way_match.execute','finance.match_exception.review','finance.payable.read','finance.payable.hold','finance.payable.release','finance.payable.mark_export_ready','finance.supplier_credit.read','finance.supplier_credit.create','finance.supplier_credit.approve','finance.customer_invoice.read','finance.customer_invoice.create','finance.customer_invoice.submit','finance.customer_invoice.approve','finance.customer_invoice.issue','finance.receivable.read','finance.receivable.dispute','finance.receivable.resolve_dispute','finance.receivable.record_external_reference','finance.customer_credit.read','finance.customer_credit.create','finance.customer_credit.approve',
  'finance.cashbook.read','finance.cashbook.manage','finance.settlement.read','finance.settlement.create','finance.settlement.revise','finance.settlement.submit','finance.settlement.approve','finance.settlement.reject','finance.settlement.cancel','finance.settlement.post','finance.settlement.reverse','finance.settlement.reconciliation.read','finance.advance.read','finance.advance.create','finance.advance.submit','finance.advance.approve','finance.advance.post','finance.advance.reverse','finance.internal_transfer.read','finance.internal_transfer.create','finance.internal_transfer.submit','finance.internal_transfer.approve','finance.internal_transfer.post','finance.internal_transfer.reverse','finance.settlement_discount.apply','finance.settlement_attachment.read','finance.settlement_attachment.manage',
  'procurement.purchase_order.read','procurement.purchase_order.approve','procurement.purchase_order.reject','procurement.purchase_order.revise','mobile.sync.use','mobile.tasks.read','mobile.procurement.approval.read','mobile.procurement.approval.execute','mobile.receiving.read','mobile.receiving.prepare','mobile.receiving.post'
));
