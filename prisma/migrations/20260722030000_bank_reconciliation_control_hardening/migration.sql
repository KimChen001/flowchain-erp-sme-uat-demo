-- Fail closed when historical relationships do not belong to the child tenant.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "BankReconciliationCandidate" c JOIN "CashbookEntry" p ON p."id" = c."cashbookEntryId" WHERE p."tenantId" <> c."tenantId")
    OR EXISTS (SELECT 1 FROM "BankReconciliationCandidate" c JOIN "SettlementDocument" p ON p."id" = c."settlementDocumentId" WHERE p."tenantId" <> c."tenantId")
    OR EXISTS (SELECT 1 FROM "BankReconciliationCashbookAllocation" c JOIN "CashbookEntry" p ON p."id" = c."cashbookEntryId" WHERE p."tenantId" <> c."tenantId")
    OR EXISTS (SELECT 1 FROM "BankReconciliationCashbookAllocation" c JOIN "SettlementDocument" p ON p."id" = c."settlementDocumentId" WHERE p."tenantId" <> c."tenantId")
    OR EXISTS (SELECT 1 FROM "BankReconciliationCashbookAllocation" c JOIN "InternalTransferDocument" p ON p."id" = c."internalTransferId" WHERE p."tenantId" <> c."tenantId")
    OR EXISTS (SELECT 1 FROM "BankReconciliationException" c JOIN "BankStatementLine" p ON p."id" = c."bankStatementLineId" WHERE p."tenantId" <> c."tenantId")
    OR EXISTS (SELECT 1 FROM "BankReconciliationException" c JOIN "CashbookEntry" p ON p."id" = c."cashbookEntryId" WHERE p."tenantId" <> c."tenantId")
    OR EXISTS (SELECT 1 FROM "BankReconciliationException" c JOIN "BankReconciliationGroup" p ON p."id" = c."reconciliationGroupId" WHERE p."tenantId" <> c."tenantId")
  THEN RAISE EXCEPTION 'BANK_TENANT_RELATION_MISMATCH: bank reconciliation relationship crosses tenant boundary' USING ERRCODE = '23514';
  END IF;
END $$;

CREATE UNIQUE INDEX "CashbookEntry_tenantId_id_key" ON "CashbookEntry"("tenantId", "id");

ALTER TABLE "BankReconciliationCandidate" ADD CONSTRAINT "BankReconciliationCandidate_tenantId_cashbookEntryId_fkey" FOREIGN KEY ("tenantId","cashbookEntryId") REFERENCES "CashbookEntry"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankReconciliationCandidate" ADD CONSTRAINT "BankReconciliationCandidate_tenantId_settlementDocumentId_fkey" FOREIGN KEY ("tenantId","settlementDocumentId") REFERENCES "SettlementDocument"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankReconciliationCashbookAllocation" ADD CONSTRAINT "BankReconciliationCashbookAllocation_tenantId_cashbookEntryId_fkey" FOREIGN KEY ("tenantId","cashbookEntryId") REFERENCES "CashbookEntry"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankReconciliationCashbookAllocation" ADD CONSTRAINT "BankReconciliationCashbookAllocation_tenantId_settlementDocumentId_fkey" FOREIGN KEY ("tenantId","settlementDocumentId") REFERENCES "SettlementDocument"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankReconciliationCashbookAllocation" ADD CONSTRAINT "BankReconciliationCashbookAllocation_tenantId_internalTransferId_fkey" FOREIGN KEY ("tenantId","internalTransferId") REFERENCES "InternalTransferDocument"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankReconciliationException" ADD CONSTRAINT "BankReconciliationException_tenantId_bankStatementLineId_fkey" FOREIGN KEY ("tenantId","bankStatementLineId") REFERENCES "BankStatementLine"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankReconciliationException" ADD CONSTRAINT "BankReconciliationException_tenantId_cashbookEntryId_fkey" FOREIGN KEY ("tenantId","cashbookEntryId") REFERENCES "CashbookEntry"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "BankReconciliationCandidate_tenantId_cashbookEntryId_status_idx" ON "BankReconciliationCandidate"("tenantId", "cashbookEntryId", "status");
CREATE INDEX "BankReconciliationCashbookAllocation_tenantId_cashbookEntryId_group_idx" ON "BankReconciliationCashbookAllocation"("tenantId", "cashbookEntryId", "reconciliationGroupId");

ALTER TABLE "BankReconciliationException" DROP CONSTRAINT "BankReconciliationException_status_check";
ALTER TABLE "BankReconciliationException" ADD CONSTRAINT "BankReconciliationException_status_check" CHECK ("status" IN ('open','resolved','dismissed','acknowledged','dismissed_with_risk'));
ALTER TABLE "BankReconciliationGroup" DROP CONSTRAINT "BankReconciliationGroup_integrity_check";
ALTER TABLE "BankReconciliationGroup" ADD CONSTRAINT "BankReconciliationGroup_integrity_check" CHECK ("integrityStatus" IN ('matched','mismatch','unavailable','accepted_risk'));
