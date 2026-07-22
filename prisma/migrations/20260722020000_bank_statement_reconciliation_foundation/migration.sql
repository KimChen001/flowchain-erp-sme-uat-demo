-- Phase 5.3: additive bank statement import and reconciliation authority.

CREATE TABLE "BankStatementMappingTemplate" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "templateCode" TEXT NOT NULL, "name" TEXT NOT NULL,
  "bankName" TEXT, "formatType" TEXT NOT NULL, "cashbookAccountId" TEXT NOT NULL,
  "fileEncoding" TEXT NOT NULL DEFAULT 'auto_detect', "sheetName" TEXT,
  "headerRowNumber" INTEGER NOT NULL DEFAULT 1, "firstDataRowNumber" INTEGER NOT NULL DEFAULT 2,
  "dateFormat" TEXT, "decimalSeparator" TEXT NOT NULL DEFAULT '.', "thousandsSeparator" TEXT NOT NULL DEFAULT ',',
  "debitCreditMode" TEXT NOT NULL, "signConvention" TEXT NOT NULL, "timezone" TEXT NOT NULL,
  "columnMapping" JSONB NOT NULL, "status" TEXT NOT NULL DEFAULT 'active', "version" INTEGER NOT NULL DEFAULT 1,
  "createdById" TEXT NOT NULL, "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  CONSTRAINT "BankStatementMappingTemplate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BankStatementMappingTemplate_format_check" CHECK ("formatType" IN ('csv','xlsx')),
  CONSTRAINT "BankStatementMappingTemplate_encoding_check" CHECK ("fileEncoding" IN ('utf8','utf8_bom','gb18030','auto_detect')),
  CONSTRAINT "BankStatementMappingTemplate_mode_check" CHECK ("debitCreditMode" IN ('separate_columns','signed_amount','direction_and_amount')),
  CONSTRAINT "BankStatementMappingTemplate_sign_check" CHECK ("signConvention" IN ('positive_credit','positive_debit','explicit_direction')),
  CONSTRAINT "BankStatementMappingTemplate_rows_check" CHECK ("headerRowNumber" > 0 AND "firstDataRowNumber" > "headerRowNumber" AND "version" > 0),
  CONSTRAINT "BankStatementMappingTemplate_status_check" CHECK ("status" IN ('active','superseded','inactive'))
);
CREATE UNIQUE INDEX "BankStatementMappingTemplate_tenantId_templateCode_version_key" ON "BankStatementMappingTemplate"("tenantId","templateCode","version");
CREATE UNIQUE INDEX "BankStatementMappingTemplate_tenantId_id_key" ON "BankStatementMappingTemplate"("tenantId","id");
CREATE INDEX "BankStatementMappingTemplate_tenantId_templateCode_status_idx" ON "BankStatementMappingTemplate"("tenantId","templateCode","status");

CREATE TABLE "BankStatementImportBatch" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "batchNumber" TEXT NOT NULL, "cashbookAccountId" TEXT NOT NULL,
  "mappingTemplateId" TEXT NOT NULL, "mappingTemplateVersion" INTEGER NOT NULL, "uploadId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL, "fileMimeType" TEXT NOT NULL, "fileSha256" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL DEFAULT 'file_upload', "coverageType" TEXT NOT NULL DEFAULT 'transaction_export',
  "statementStartDate" TIMESTAMP(3), "statementEndDate" TIMESTAMP(3),
  "openingBalance" DECIMAL(18,4), "closingBalance" DECIMAL(18,4), "currency" TEXT NOT NULL,
  "bankNameSnapshot" TEXT, "accountIdentifierMasked" TEXT, "accountIdentifierHash" TEXT,
  "workflowStatus" TEXT NOT NULL DEFAULT 'draft', "validationStatus" TEXT NOT NULL DEFAULT 'not_validated',
  "totalRowCount" INTEGER NOT NULL DEFAULT 0, "acceptedRowCount" INTEGER NOT NULL DEFAULT 0,
  "errorRowCount" INTEGER NOT NULL DEFAULT 0, "exactDuplicateRowCount" INTEGER NOT NULL DEFAULT 0,
  "possibleDuplicateRowCount" INTEGER NOT NULL DEFAULT 0, "importedLineCount" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 0, "createdById" TEXT NOT NULL, "validatedById" TEXT,
  "committedById" TEXT, "voidedById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validatedAt" TIMESTAMP(3), "committedAt" TIMESTAMP(3), "voidedAt" TIMESTAMP(3), "voidReason" TEXT, "metadata" JSONB,
  CONSTRAINT "BankStatementImportBatch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BankStatementImportBatch_source_check" CHECK ("sourceType" IN ('file_upload','manual_template')),
  CONSTRAINT "BankStatementImportBatch_coverage_check" CHECK ("coverageType" IN ('full_statement','transaction_export')),
  CONSTRAINT "BankStatementImportBatch_workflow_check" CHECK ("workflowStatus" IN ('draft','validated','committed','voided','failed')),
  CONSTRAINT "BankStatementImportBatch_validation_check" CHECK ("validationStatus" IN ('not_validated','valid','valid_with_warnings','invalid')),
  CONSTRAINT "BankStatementImportBatch_counts_check" CHECK ("totalRowCount" >= 0 AND "acceptedRowCount" >= 0 AND "errorRowCount" >= 0 AND "exactDuplicateRowCount" >= 0 AND "possibleDuplicateRowCount" >= 0 AND "importedLineCount" >= 0)
);
CREATE UNIQUE INDEX "BankStatementImportBatch_tenantId_batchNumber_key" ON "BankStatementImportBatch"("tenantId","batchNumber");
CREATE UNIQUE INDEX "BankStatementImportBatch_tenantId_id_key" ON "BankStatementImportBatch"("tenantId","id");
CREATE INDEX "BankStatementImportBatch_tenantId_cashbookAccountId_workflowStatus_idx" ON "BankStatementImportBatch"("tenantId","cashbookAccountId","workflowStatus");
CREATE INDEX "BankStatementImportBatch_tenantId_cashbookAccountId_fileSha256_idx" ON "BankStatementImportBatch"("tenantId","cashbookAccountId","fileSha256");
CREATE UNIQUE INDEX "BankStatementImportBatch_committed_file_key" ON "BankStatementImportBatch"("tenantId","cashbookAccountId","fileSha256") WHERE "workflowStatus" = 'committed';

CREATE TABLE "BankStatementImportRow" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "batchId" TEXT NOT NULL, "sourceSheet" TEXT, "sourceRowNumber" INTEGER NOT NULL,
  "rawRowHash" TEXT NOT NULL, "rawData" JSONB NOT NULL, "normalizedTransactionId" TEXT,
  "normalizedTransactionDate" TIMESTAMP(3), "normalizedPostingDate" TIMESTAMP(3), "normalizedValueDate" TIMESTAMP(3),
  "normalizedDirection" TEXT, "normalizedAmount" DECIMAL(18,4), "normalizedCurrency" TEXT,
  "normalizedCounterpartyName" TEXT, "normalizedCounterpartyAccountMasked" TEXT, "normalizedCounterpartyAccountHash" TEXT,
  "normalizedDescription" TEXT, "normalizedBankReference" TEXT, "normalizedCustomerReference" TEXT,
  "normalizedRunningBalance" DECIMAL(18,4), "validationStatus" TEXT NOT NULL DEFAULT 'pending',
  "duplicateStatus" TEXT NOT NULL DEFAULT 'none', "issueCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "overrideData" JSONB, "overrideReason" TEXT, "overriddenById" TEXT, "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BankStatementImportRow_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BankStatementImportRow_validation_check" CHECK ("validationStatus" IN ('pending','valid','warning','error','accepted','excluded')),
  CONSTRAINT "BankStatementImportRow_duplicate_check" CHECK ("duplicateStatus" IN ('none','exact_duplicate','possible_duplicate')),
  CONSTRAINT "BankStatementImportRow_direction_check" CHECK ("normalizedDirection" IS NULL OR "normalizedDirection" IN ('credit','debit')),
  CONSTRAINT "BankStatementImportRow_amount_check" CHECK ("normalizedAmount" IS NULL OR "normalizedAmount" > 0)
);
CREATE UNIQUE INDEX "BankStatementImportRow_tenantId_batchId_sourceSheet_sourceRowNumber_key" ON "BankStatementImportRow"("tenantId","batchId","sourceSheet","sourceRowNumber");
CREATE UNIQUE INDEX "BankStatementImportRow_tenantId_id_key" ON "BankStatementImportRow"("tenantId","id");
CREATE INDEX "BankStatementImportRow_tenantId_batchId_validationStatus_duplicateStatus_idx" ON "BankStatementImportRow"("tenantId","batchId","validationStatus","duplicateStatus");

CREATE TABLE "BankStatementLine" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "batchId" TEXT NOT NULL, "cashbookAccountId" TEXT NOT NULL,
  "lineNumber" INTEGER NOT NULL, "bankTransactionId" TEXT, "transactionDate" TIMESTAMP(3) NOT NULL,
  "postingDate" TIMESTAMP(3), "valueDate" TIMESTAMP(3), "direction" TEXT NOT NULL, "amount" DECIMAL(18,4) NOT NULL,
  "currency" TEXT NOT NULL, "counterpartyName" TEXT, "counterpartyAccountMasked" TEXT, "counterpartyAccountHash" TEXT,
  "description" TEXT, "bankReference" TEXT, "customerReference" TEXT, "runningBalance" DECIMAL(18,4),
  "canonicalFingerprint" TEXT NOT NULL, "exactDuplicateOfLineId" TEXT,
  "reconciliationStatus" TEXT NOT NULL DEFAULT 'unmatched', "matchedAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "remainingAmount" DECIMAL(18,4) NOT NULL, "status" TEXT NOT NULL DEFAULT 'active', "version" INTEGER NOT NULL DEFAULT 0,
  "sourceRowId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "metadata" JSONB,
  CONSTRAINT "BankStatementLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BankStatementLine_direction_check" CHECK ("direction" IN ('credit','debit')),
  CONSTRAINT "BankStatementLine_status_check" CHECK ("status" IN ('active','voided')),
  CONSTRAINT "BankStatementLine_reconciliation_check" CHECK ("reconciliationStatus" IN ('unmatched','partially_matched','matched','exception','voided')),
  CONSTRAINT "BankStatementLine_amount_check" CHECK ("amount" > 0 AND "matchedAmount" >= 0 AND "remainingAmount" >= 0 AND "matchedAmount" + "remainingAmount" = "amount")
);
CREATE UNIQUE INDEX "BankStatementLine_tenantId_batchId_lineNumber_key" ON "BankStatementLine"("tenantId","batchId","lineNumber");
CREATE UNIQUE INDEX "BankStatementLine_tenantId_id_key" ON "BankStatementLine"("tenantId","id");
CREATE UNIQUE INDEX "BankStatementLine_sourceRowId_key" ON "BankStatementLine"("sourceRowId");
CREATE INDEX "BankStatementLine_tenantId_cashbookAccountId_reconciliationStatus_status_idx" ON "BankStatementLine"("tenantId","cashbookAccountId","reconciliationStatus","status");
CREATE INDEX "BankStatementLine_tenantId_cashbookAccountId_bankTransactionId_idx" ON "BankStatementLine"("tenantId","cashbookAccountId","bankTransactionId");
CREATE INDEX "BankStatementLine_tenantId_cashbookAccountId_canonicalFingerprint_idx" ON "BankStatementLine"("tenantId","cashbookAccountId","canonicalFingerprint");
CREATE UNIQUE INDEX "BankStatementLine_active_transaction_id_key" ON "BankStatementLine"("tenantId","cashbookAccountId","bankTransactionId") WHERE "status" = 'active' AND "bankTransactionId" IS NOT NULL;
CREATE UNIQUE INDEX "BankStatementLine_active_fingerprint_key" ON "BankStatementLine"("tenantId","cashbookAccountId","canonicalFingerprint") WHERE "status" = 'active' AND "bankTransactionId" IS NULL;

CREATE TABLE "BankReconciliationCandidate" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "bankStatementLineId" TEXT NOT NULL, "cashbookEntryId" TEXT NOT NULL,
  "settlementDocumentId" TEXT, "candidateType" TEXT NOT NULL, "score" INTEGER NOT NULL, "algorithmVersion" TEXT NOT NULL,
  "amountScore" INTEGER NOT NULL, "dateScore" INTEGER NOT NULL, "referenceScore" INTEGER NOT NULL,
  "counterpartyScore" INTEGER NOT NULL, "documentScore" INTEGER NOT NULL, "evidence" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active', "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "generatedById" TEXT NOT NULL, "dismissedAt" TIMESTAMP(3), "dismissedById" TEXT, "dismissalReason" TEXT,
  "expiresAt" TIMESTAMP(3), "metadata" JSONB,
  CONSTRAINT "BankReconciliationCandidate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BankReconciliationCandidate_type_check" CHECK ("candidateType" IN ('exact_reference','exact_amount_date','strong_composite','possible_match')),
  CONSTRAINT "BankReconciliationCandidate_status_check" CHECK ("status" IN ('active','dismissed','accepted','expired','superseded')),
  CONSTRAINT "BankReconciliationCandidate_score_check" CHECK ("score" >= 0 AND "score" <= 100)
);
CREATE UNIQUE INDEX "BankReconciliationCandidate_tenantId_bankStatementLineId_cashbookEntryId_algorithmVersion_key" ON "BankReconciliationCandidate"("tenantId","bankStatementLineId","cashbookEntryId","algorithmVersion");
CREATE INDEX "BankReconciliationCandidate_tenantId_bankStatementLineId_status_score_idx" ON "BankReconciliationCandidate"("tenantId","bankStatementLineId","status","score");

CREATE TABLE "BankReconciliationGroup" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "reconciliationNumber" TEXT NOT NULL, "cashbookAccountId" TEXT NOT NULL,
  "currency" TEXT NOT NULL, "direction" TEXT NOT NULL, "reconciliationDate" TIMESTAMP(3) NOT NULL,
  "workflowStatus" TEXT NOT NULL DEFAULT 'draft', "integrityStatus" TEXT NOT NULL DEFAULT 'matched',
  "totalBankAmount" DECIMAL(18,4) NOT NULL DEFAULT 0, "totalCashbookAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "differenceAmount" DECIMAL(18,4) NOT NULL DEFAULT 0, "algorithmVersion" TEXT NOT NULL,
  "confirmedById" TEXT, "confirmedAt" TIMESTAMP(3), "reversedById" TEXT, "reversedAt" TIMESTAMP(3),
  "reversalReason" TEXT, "version" INTEGER NOT NULL DEFAULT 0, "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "metadata" JSONB,
  CONSTRAINT "BankReconciliationGroup_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BankReconciliationGroup_direction_check" CHECK ("direction" IN ('credit','debit')),
  CONSTRAINT "BankReconciliationGroup_workflow_check" CHECK ("workflowStatus" IN ('draft','confirmed','reversed','exception')),
  CONSTRAINT "BankReconciliationGroup_integrity_check" CHECK ("integrityStatus" IN ('matched','mismatch','unavailable')),
  CONSTRAINT "BankReconciliationGroup_totals_check" CHECK ("totalBankAmount" >= 0 AND "totalCashbookAmount" >= 0)
);
CREATE UNIQUE INDEX "BankReconciliationGroup_tenantId_reconciliationNumber_key" ON "BankReconciliationGroup"("tenantId","reconciliationNumber");
CREATE UNIQUE INDEX "BankReconciliationGroup_tenantId_id_key" ON "BankReconciliationGroup"("tenantId","id");
CREATE INDEX "BankReconciliationGroup_tenantId_cashbookAccountId_workflowStatus_idx" ON "BankReconciliationGroup"("tenantId","cashbookAccountId","workflowStatus");

CREATE TABLE "BankReconciliationBankLineAllocation" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "reconciliationGroupId" TEXT NOT NULL,
  "bankStatementLineId" TEXT NOT NULL, "allocatedAmount" DECIMAL(18,4) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BankReconciliationBankLineAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BankReconciliationBankLineAllocation_amount_check" CHECK ("allocatedAmount" > 0)
);
CREATE UNIQUE INDEX "BankReconciliationBankLineAllocation_reconciliationGroupId_bankStatementLineId_key" ON "BankReconciliationBankLineAllocation"("reconciliationGroupId","bankStatementLineId");
CREATE INDEX "BankReconciliationBankLineAllocation_tenantId_bankStatementLineId_idx" ON "BankReconciliationBankLineAllocation"("tenantId","bankStatementLineId");

CREATE TABLE "BankReconciliationCashbookAllocation" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "reconciliationGroupId" TEXT NOT NULL,
  "cashbookEntryId" TEXT NOT NULL, "settlementDocumentId" TEXT, "internalTransferId" TEXT,
  "allocatedAmount" DECIMAL(18,4) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BankReconciliationCashbookAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BankReconciliationCashbookAllocation_amount_check" CHECK ("allocatedAmount" > 0)
);
CREATE UNIQUE INDEX "BankReconciliationCashbookAllocation_reconciliationGroupId_cashbookEntryId_key" ON "BankReconciliationCashbookAllocation"("reconciliationGroupId","cashbookEntryId");
CREATE INDEX "BankReconciliationCashbookAllocation_tenantId_cashbookEntryId_idx" ON "BankReconciliationCashbookAllocation"("tenantId","cashbookEntryId");

CREATE TABLE "BankReconciliationException" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "reconciliationGroupId" TEXT NOT NULL,
  "bankStatementLineId" TEXT, "cashbookEntryId" TEXT, "exceptionType" TEXT NOT NULL,
  "severity" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'open', "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3), "resolvedById" TEXT, "resolution" JSONB, "metadata" JSONB,
  CONSTRAINT "BankReconciliationException_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BankReconciliationException_type_check" CHECK ("exceptionType" IN ('cashbook_entry_reversed','settlement_reversed','batch_voided','bank_line_voided','allocation_mismatch','duplicate_detected_after_commit','missing_evidence','other')),
  CONSTRAINT "BankReconciliationException_severity_check" CHECK ("severity" IN ('warning','blocking')),
  CONSTRAINT "BankReconciliationException_status_check" CHECK ("status" IN ('open','resolved','dismissed'))
);
CREATE INDEX "BankReconciliationException_tenantId_status_severity_idx" ON "BankReconciliationException"("tenantId","status","severity");
CREATE INDEX "BankReconciliationException_tenantId_reconciliationGroupId_idx" ON "BankReconciliationException"("tenantId","reconciliationGroupId");

ALTER TABLE "BankStatementMappingTemplate" ADD CONSTRAINT "BankStatementMappingTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankStatementMappingTemplate" ADD CONSTRAINT "BankStatementMappingTemplate_tenantId_cashbookAccountId_fkey" FOREIGN KEY ("tenantId","cashbookAccountId") REFERENCES "CashbookAccount"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankStatementImportBatch" ADD CONSTRAINT "BankStatementImportBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankStatementImportBatch" ADD CONSTRAINT "BankStatementImportBatch_tenantId_cashbookAccountId_fkey" FOREIGN KEY ("tenantId","cashbookAccountId") REFERENCES "CashbookAccount"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankStatementImportBatch" ADD CONSTRAINT "BankStatementImportBatch_tenantId_mappingTemplateId_fkey" FOREIGN KEY ("tenantId","mappingTemplateId") REFERENCES "BankStatementMappingTemplate"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankStatementImportBatch" ADD CONSTRAINT "BankStatementImportBatch_tenantId_uploadId_fkey" FOREIGN KEY ("tenantId","uploadId") REFERENCES "StagedUpload"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankStatementImportRow" ADD CONSTRAINT "BankStatementImportRow_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankStatementImportRow" ADD CONSTRAINT "BankStatementImportRow_tenantId_batchId_fkey" FOREIGN KEY ("tenantId","batchId") REFERENCES "BankStatementImportBatch"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_tenantId_batchId_fkey" FOREIGN KEY ("tenantId","batchId") REFERENCES "BankStatementImportBatch"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_tenantId_cashbookAccountId_fkey" FOREIGN KEY ("tenantId","cashbookAccountId") REFERENCES "CashbookAccount"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_sourceRowId_fkey" FOREIGN KEY ("sourceRowId") REFERENCES "BankStatementImportRow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankReconciliationCandidate" ADD CONSTRAINT "BankReconciliationCandidate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankReconciliationCandidate" ADD CONSTRAINT "BankReconciliationCandidate_tenantId_bankStatementLineId_fkey" FOREIGN KEY ("tenantId","bankStatementLineId") REFERENCES "BankStatementLine"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankReconciliationCandidate" ADD CONSTRAINT "BankReconciliationCandidate_cashbookEntryId_fkey" FOREIGN KEY ("cashbookEntryId") REFERENCES "CashbookEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankReconciliationCandidate" ADD CONSTRAINT "BankReconciliationCandidate_settlementDocumentId_fkey" FOREIGN KEY ("settlementDocumentId") REFERENCES "SettlementDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankReconciliationGroup" ADD CONSTRAINT "BankReconciliationGroup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankReconciliationGroup" ADD CONSTRAINT "BankReconciliationGroup_tenantId_cashbookAccountId_fkey" FOREIGN KEY ("tenantId","cashbookAccountId") REFERENCES "CashbookAccount"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankReconciliationBankLineAllocation" ADD CONSTRAINT "BankReconciliationBankLineAllocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankReconciliationBankLineAllocation" ADD CONSTRAINT "BankReconciliationBankLineAllocation_tenantId_reconciliationGroupId_fkey" FOREIGN KEY ("tenantId","reconciliationGroupId") REFERENCES "BankReconciliationGroup"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankReconciliationBankLineAllocation" ADD CONSTRAINT "BankReconciliationBankLineAllocation_tenantId_bankStatementLineId_fkey" FOREIGN KEY ("tenantId","bankStatementLineId") REFERENCES "BankStatementLine"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankReconciliationCashbookAllocation" ADD CONSTRAINT "BankReconciliationCashbookAllocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankReconciliationCashbookAllocation" ADD CONSTRAINT "BankReconciliationCashbookAllocation_tenantId_reconciliationGroupId_fkey" FOREIGN KEY ("tenantId","reconciliationGroupId") REFERENCES "BankReconciliationGroup"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankReconciliationCashbookAllocation" ADD CONSTRAINT "BankReconciliationCashbookAllocation_cashbookEntryId_fkey" FOREIGN KEY ("cashbookEntryId") REFERENCES "CashbookEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankReconciliationCashbookAllocation" ADD CONSTRAINT "BankReconciliationCashbookAllocation_settlementDocumentId_fkey" FOREIGN KEY ("settlementDocumentId") REFERENCES "SettlementDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankReconciliationException" ADD CONSTRAINT "BankReconciliationException_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankReconciliationException" ADD CONSTRAINT "BankReconciliationException_tenantId_reconciliationGroupId_fkey" FOREIGN KEY ("tenantId","reconciliationGroupId") REFERENCES "BankReconciliationGroup"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankReconciliationException" ADD CONSTRAINT "BankReconciliationException_bankStatementLineId_fkey" FOREIGN KEY ("bankStatementLineId") REFERENCES "BankStatementLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankReconciliationException" ADD CONSTRAINT "BankReconciliationException_cashbookEntryId_fkey" FOREIGN KEY ("cashbookEntryId") REFERENCES "CashbookEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION flowchain_bank_line_formal_immutable() RETURNS trigger AS $$
BEGIN
  IF ROW(NEW."tenantId",NEW."batchId",NEW."cashbookAccountId",NEW."lineNumber",NEW."bankTransactionId",NEW."transactionDate",NEW."postingDate",NEW."valueDate",NEW."direction",NEW."amount",NEW."currency",NEW."counterpartyName",NEW."counterpartyAccountMasked",NEW."counterpartyAccountHash",NEW."description",NEW."bankReference",NEW."customerReference",NEW."runningBalance",NEW."canonicalFingerprint",NEW."sourceRowId") IS DISTINCT FROM ROW(OLD."tenantId",OLD."batchId",OLD."cashbookAccountId",OLD."lineNumber",OLD."bankTransactionId",OLD."transactionDate",OLD."postingDate",OLD."valueDate",OLD."direction",OLD."amount",OLD."currency",OLD."counterpartyName",OLD."counterpartyAccountMasked",OLD."counterpartyAccountHash",OLD."description",OLD."bankReference",OLD."customerReference",OLD."runningBalance",OLD."canonicalFingerprint",OLD."sourceRowId") THEN
    RAISE EXCEPTION 'Committed bank statement line formal fields are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "BankStatementLine_formal_immutable" BEFORE UPDATE ON "BankStatementLine" FOR EACH ROW EXECUTE FUNCTION flowchain_bank_line_formal_immutable();

CREATE OR REPLACE FUNCTION flowchain_bank_group_confirmed_immutable() RETURNS trigger AS $$
BEGIN
  IF OLD."workflowStatus" IN ('confirmed','reversed') AND ROW(NEW."tenantId",NEW."cashbookAccountId",NEW."currency",NEW."direction",NEW."reconciliationDate",NEW."totalBankAmount",NEW."totalCashbookAmount",NEW."algorithmVersion") IS DISTINCT FROM ROW(OLD."tenantId",OLD."cashbookAccountId",OLD."currency",OLD."direction",OLD."reconciliationDate",OLD."totalBankAmount",OLD."totalCashbookAmount",OLD."algorithmVersion") THEN
    RAISE EXCEPTION 'Confirmed reconciliation formal fields are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "BankReconciliationGroup_confirmed_immutable" BEFORE UPDATE ON "BankReconciliationGroup" FOR EACH ROW EXECUTE FUNCTION flowchain_bank_group_confirmed_immutable();

ALTER TABLE "TenantRolePermission" DROP CONSTRAINT "TenantRolePermission_permissionCode_catalog_check";
ALTER TABLE "TenantRolePermission" ADD CONSTRAINT "TenantRolePermission_permissionCode_catalog_check" CHECK (
  "permissionCode" IN (
    'settings.workspace.read','settings.workspace.manage','settings.users.read','settings.users.manage','settings.roles.read','settings.roles.manage','settings.roles.assign','settings.numbering.read','settings.numbering.manage','settings.review_policy.read','settings.review_policy.manage','settings.modules.read','settings.modules.manage','settings.import.manage','settings.warehouse_import.manage','settings.diagnostics.read','settings.export.read','audit.read','audit.read_sensitive',
    'returns.request.read','returns.request.create','returns.request.revise','returns.request.submit','returns.request.cancel','returns.customer_request.manage','returns.authorization.read','returns.authorization.approve','returns.authorization.reject','returns.authorization.cancel','returns.authorization.expire','returns.posting.read','returns.posting.prepare','returns.posting.ready','returns.posting.post','returns.posting.cancel','returns.posting.reverse','returns.quarantine.read','returns.quarantine.release_prepare','returns.quarantine.release_post','returns.quarantine.release_reverse',
    'receiving.read','receiving.prepare','receiving.post','receiving.reverse','sales_order.read','sales_order.create','sales_order.revise','sales_order.submit','sales_order.cancel','shipment.read','shipment.prepare','shipment.post','shipment.reverse','inventory.balance.read','inventory.transfer.read','inventory.transfer.create','inventory.transfer.post','inventory.transfer.reverse','inventory.count.read','inventory.count.create','inventory.count.submit','inventory.count.review','inventory.count.post','inventory.count.reverse','inventory.adjustment.read','inventory.adjustment.create','inventory.adjustment.approve','inventory.adjustment.post','inventory.adjustment.reverse',
    'finance.overview.read','finance.amounts.read','finance.partner_snapshot.read','procurement.prices.read','finance.supplier_invoice.read','finance.supplier_invoice.create','finance.supplier_invoice.revise','finance.supplier_invoice.submit','finance.supplier_invoice.approve','finance.three_way_match.read','finance.three_way_match.execute','finance.match_exception.review','finance.payable.read','finance.payable.hold','finance.payable.release','finance.payable.mark_export_ready','finance.supplier_credit.read','finance.supplier_credit.create','finance.supplier_credit.approve','finance.customer_invoice.read','finance.customer_invoice.create','finance.customer_invoice.submit','finance.customer_invoice.approve','finance.customer_invoice.issue','finance.receivable.read','finance.receivable.dispute','finance.receivable.resolve_dispute','finance.receivable.record_external_reference','finance.customer_credit.read','finance.customer_credit.create','finance.customer_credit.approve',
    'finance.cashbook.read','finance.cashbook.manage','finance.settlement.read','finance.settlement.create','finance.settlement.revise','finance.settlement.submit','finance.settlement.approve','finance.settlement.reject','finance.settlement.cancel','finance.settlement.post','finance.settlement.reverse','finance.settlement.reconciliation.read','finance.advance.read','finance.advance.create','finance.advance.submit','finance.advance.approve','finance.advance.post','finance.advance.reverse','finance.internal_transfer.read','finance.internal_transfer.create','finance.internal_transfer.submit','finance.internal_transfer.approve','finance.internal_transfer.post','finance.internal_transfer.reverse','finance.settlement_discount.apply','finance.settlement_attachment.read','finance.settlement_attachment.manage',
    'finance.bank_statement.read','finance.bank_statement.import','finance.bank_statement.validate','finance.bank_statement.commit','finance.bank_statement.void','finance.bank_statement.export','finance.bank_mapping.read','finance.bank_mapping.manage','finance.bank_reconciliation.read','finance.bank_reconciliation.generate_candidates','finance.bank_reconciliation.confirm','finance.bank_reconciliation.reverse','finance.bank_reconciliation.dismiss_candidate','finance.bank_reconciliation.resolve_exception','finance.bank_reconciliation.export',
    'procurement.purchase_order.read','procurement.purchase_order.approve','procurement.purchase_order.reject','procurement.purchase_order.revise','mobile.sync.use','mobile.tasks.read','mobile.procurement.approval.read','mobile.procurement.approval.execute','mobile.receiving.read','mobile.receiving.prepare','mobile.receiving.post'
  )
);
