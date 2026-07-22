import assert from "node:assert/strict";
import test from "node:test";
import { backfillTenantAuthorization } from "../../server/auth/authorization-backfill.mjs";
import { createBankReconciliationService } from "../../server/domain/bank-reconciliation-service.mjs";
import { createBankStatementService } from "../../server/domain/bank-statement-service.mjs";
import { createPrismaClient } from "../../server/persistence/prisma-client.mjs";

const tenantId = "tenant-bank-hardening", userId = "bank-hardening-admin";
const context = { identity: { authenticated: true, tenantId, userId, role: "admin" } };
const env = { ...process.env, FLOWCHAIN_PERSISTENCE_MODE: "database", FLOWCHAIN_ENABLE_DB_BANK_RECONCILIATION: "true", FLOWCHAIN_ATTACHMENT_STORAGE_PROVIDER: "local" };

test("real PostgreSQL bank security hardening controls", async (t) => {
  const prisma = await createPrismaClient(env);
  try {
    await prisma.tenant.create({ data: { id: tenantId, name: "Bank Hardening Tenant", currency: "CNY" } });
    await prisma.user.create({ data: { id: userId, tenantId, email: "admin@bank-hardening.invalid", name: "Admin", role: "admin" } });
    await backfillTenantAuthorization(prisma, tenantId, { actorId: userId });
    await prisma.cashbookAccount.create({ data: { id: "hardening-account", tenantId, accountCode: "BANK-H", name: "Fictitious Bank", accountType: "bank", currency: "CNY", currentBalance: "0" } });
    const statement = createBankStatementService({ prisma, env }), reconciliation = createBankReconciliationService({ prisma, env });

    await t.test("mapping secrets are rejected before mapping or audit persistence", async () => {
      const before = [await prisma.bankStatementMappingTemplate.count(), await prisma.auditLog.count()];
      await assert.rejects(() => statement.createMapping({ templateCode: "SECRET", name: "Unsafe", formatType: "csv", cashbookAccountId: "hardening-account", debitCreditMode: "signed_amount", signConvention: "positive_credit", columnMapping: { transactionId: "id" }, metadata: { clientSecret: "not-stored" } }, context), (error) => error.code === "BANK_MAPPING_SECRET_FIELD_FORBIDDEN" && !JSON.stringify(error).includes("not-stored"));
      assert.deepEqual([await prisma.bankStatementMappingTemplate.count(), await prisma.auditLog.count()], before);
    });

    await t.test("same-batch fingerprint duplicate is raised during validation", async () => {
      const mapping = await statement.createMapping({ templateCode: "DUP", name: "Duplicate", formatType: "csv", cashbookAccountId: "hardening-account", debitCreditMode: "signed_amount", signConvention: "positive_credit", timezone: "UTC", columnMapping: { transactionId: "transaction_id", transactionDate: "transaction_date", signedAmount: "signed_amount", currency: "currency", bankReference: "bank_reference" } }, context);
      const csv = "transaction_id,transaction_date,signed_amount,currency,bank_reference\nDUP-1,2026-07-06,20.0000,CNY,SAME\nDUP-2,2026-07-06,20.0000,CNY,SAME\nDUP-2,2026-07-07,21.0000,CNY,OTHER\n";
      const upload = await statement.stageUpload({ fileName: "duplicates.csv", mimeType: "text/csv", contentBase64: Buffer.from(csv).toString("base64") }, context);
      let batch = await statement.createBatch({ cashbookAccountId: "hardening-account", mappingTemplateId: mapping.id, uploadId: upload.uploadId, currency: "CNY" }, context); batch = await statement.parseBatch(batch.id, context); batch = await statement.validateBatch(batch.id, context);
      assert.equal(batch.validationStatus, "invalid"); const rows = (await statement.listRows(batch.id, context)).items; assert.ok(rows[1].issueCodes.includes("BANK_ROW_DUPLICATE_FINGERPRINT_IN_BATCH")); assert.equal(rows[1].overrideData.duplicateSource, "same_batch_row"); assert.equal(rows[1].overrideData.duplicateOfRowId, rows[0].id); assert.ok(rows[2].issueCodes.includes("BANK_ROW_DUPLICATE_TRANSACTION_ID_IN_BATCH")); assert.equal(rows[2].overrideData.duplicateOfRowId, rows[1].id);
    });

    await t.test("GET services are read-only", async () => {
      const snapshot = async () => [await prisma.bankReconciliationGroup.count(), await prisma.bankReconciliationException.count(), await prisma.auditLog.count(), await prisma.domainChangeFeed.count(), await prisma.businessCommandExecution.count()];
      const before = await snapshot(); await reconciliation.listGroups({}, context); await reconciliation.listExceptions(context); await statement.listLines({}, context); assert.deepEqual(await snapshot(), before);
    });

    await t.test("tenant composite allocation FK rejects a cross-tenant parent", async () => {
      await prisma.tenant.create({ data: { id: "tenant-bank-other", name: "Other", currency: "CNY" } });
      await prisma.cashbookAccount.create({ data: { id: "other-account", tenantId: "tenant-bank-other", accountCode: "OTHER", name: "Other", accountType: "bank", currency: "CNY", currentBalance: "0" } });
      await prisma.settlementDocument.create({ data: { id: "other-settlement", tenantId: "tenant-bank-other", settlementNumber: "OTHER-SET", direction: "receipt", counterpartyType: "customer", cashbookAccountId: "other-account", currency: "CNY", amount: "1", cashAmount: "1", totalSettlementAmount: "1", settlementDate: new Date(), status: "posted", workflowStatus: "posted", postingStatus: "posted" } });
      await prisma.cashbookEntry.create({ data: { id: "other-entry", tenantId: "tenant-bank-other", cashbookAccountId: "other-account", settlementId: "other-settlement", entryNumber: "OTHER-1", entryType: "settlement", direction: "inflow", amount: "1", currency: "CNY", occurredAt: new Date(), balanceBefore: "0", balanceAfter: "1", postingBatchId: "other" } });
      await prisma.bankReconciliationGroup.create({ data: { id: "hardening-group", tenantId, reconciliationNumber: "BR-H", cashbookAccountId: "hardening-account", currency: "CNY", direction: "credit", reconciliationDate: new Date(), algorithmVersion: "bank-match-v1.1", createdById: userId } });
      await assert.rejects(() => prisma.bankReconciliationCashbookAllocation.create({ data: { id: "cross-tenant-allocation", tenantId, reconciliationGroupId: "hardening-group", cashbookEntryId: "other-entry", allocatedAmount: "1" } }), (error) => error.code === "P2003" || error.cause?.code === "23503");
    });
  } finally { await prisma.$disconnect(); }
});
