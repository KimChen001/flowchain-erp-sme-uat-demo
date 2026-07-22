import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { backfillTenantAuthorization } from "../../server/auth/authorization-backfill.mjs";
import { createBankReconciliationService } from "../../server/domain/bank-reconciliation-service.mjs";
import { createBankStatementService } from "../../server/domain/bank-statement-service.mjs";
import { createPrismaClient } from "../../server/persistence/prisma-client.mjs";

const tenantId = "tenant-phase-5-3-bank";
const userId = "phase-5-3-admin";
const context = { identity: { authenticated: true, tenantId, userId, role: "admin" } };
const fixture = new URL("../fixtures/bank-statements/utf8-separate-debit-credit.csv", import.meta.url);
const env = { ...process.env, FLOWCHAIN_PERSISTENCE_MODE: "database", FLOWCHAIN_ENABLE_DB_BANK_RECONCILIATION: "true", FLOWCHAIN_ATTACHMENT_STORAGE_PROVIDER: "local" };

test("real PostgreSQL bank statement and reconciliation authority", async (t) => {
  const prisma = await createPrismaClient(env);
  try {
    await prisma.tenant.create({ data: { id: tenantId, name: "Fictitious Phase 5.3 Workspace", currency: "CNY" } });
    await prisma.user.create({ data: { id: userId, tenantId, email: "admin@phase-5-3.invalid", name: "Phase 5.3 Admin", role: "admin" } });
    await backfillTenantAuthorization(prisma, tenantId, { actorId: userId });
    await prisma.cashbookAccount.create({ data: { id: "bank-account-1", tenantId, accountCode: "BANK-CNY", name: "Fictitious CNY Bank", accountType: "bank", currency: "CNY", currentBalance: "5000.0000" } });

    const statement = createBankStatementService({ prisma, env });
    const reconciliation = createBankReconciliationService({ prisma, env });
    let mapping, batch, lines;

    await t.test("mapping, durable upload, parse, validate and immutable commit", async () => {
      mapping = await statement.createMapping({ templateCode: "FICT-CNY", name: "Fictitious bank CSV", bankName: "Fictitious Bank", formatType: "csv", cashbookAccountId: "bank-account-1", fileEncoding: "utf8", headerRowNumber: 1, firstDataRowNumber: 2, dateFormat: "YYYY-MM-DD", decimalSeparator: ".", thousandsSeparator: ",", debitCreditMode: "separate_columns", signConvention: "explicit_direction", timezone: "Asia/Shanghai", columnMapping: { transactionId: "交易编号", transactionDate: "交易日期", debitAmount: "借方金额", creditAmount: "贷方金额", currency: "币种", counterpartyName: "对方名称", counterpartyAccount: "对方账号", description: "摘要", bankReference: "银行参考", runningBalance: "余额" } }, context);
      const bytes = await readFile(fixture); const upload = await statement.stageUpload({ fileName: "fictitious-bank.csv", mimeType: "text/csv", contentBase64: bytes.toString("base64") }, context);
      batch = await statement.createBatch({ cashbookAccountId: "bank-account-1", mappingTemplateId: mapping.id, uploadId: upload.uploadId, currency: "CNY", coverageType: "transaction_export" }, context);
      batch = await statement.parseBatch(batch.id, context); assert.equal(batch.totalRowCount, 2); assert.equal(batch.errorRowCount, 0);
      batch = await statement.validateBatch(batch.id, context); assert.equal(batch.validationStatus, "valid"); assert.deepEqual(batch.limitations, ["This export does not prove complete period balances"]);
      const committed = await statement.commitBatch(batch.id, { expectedVersion: batch.version, idempotencyKey: "commit-bank-1" }, context); assert.equal(committed.importedLineCount, 2); assert.equal(committed.cashbookMutation, false);
      assert.deepEqual(await statement.commitBatch(batch.id, { expectedVersion: batch.version, idempotencyKey: "commit-bank-1" }, context), { ...committed, idempotentReplay: true });
      await assert.rejects(() => statement.commitBatch(batch.id, { expectedVersion: batch.version + 1, idempotencyKey: "commit-bank-1" }, context), (error) => error.code === "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD");
      lines = (await statement.listLines({}, context)).items; assert.equal(lines.length, 2); assert.equal(lines[0].counterpartyAccountHash, undefined); assert.match(lines[0].counterpartyAccountMasked, /^\*{4}\d{4}$/);
      await assert.rejects(() => prisma.bankStatementLine.update({ where: { id: lines[0].id }, data: { amount: "999.0000", remainingAmount: "999.0000" } }), /immutable/);
    });

    await t.test("exact file duplicate is blocked and mapping history remains versioned", async () => {
      const updated = await statement.updateMapping(mapping.id, { expectedVersion: mapping.version, name: "Fictitious bank CSV v2" }, context); assert.equal(updated.version, 2); assert.equal((await statement.getMapping(mapping.id, context)).status, "superseded");
      const bytes = await readFile(fixture); const upload = await statement.stageUpload({ fileName: "fictitious-bank-copy.csv", mimeType: "text/csv", contentBase64: bytes.toString("base64") }, context);
      let duplicate = await statement.createBatch({ cashbookAccountId: "bank-account-1", mappingTemplateId: updated.id, uploadId: upload.uploadId, currency: "CNY" }, context); duplicate = await statement.parseBatch(duplicate.id, context); duplicate = await statement.validateBatch(duplicate.id, context);
      assert.equal(duplicate.validationStatus, "invalid"); assert.equal(duplicate.exactDuplicateRowCount, 2);
    });

    await t.test("deterministic candidates and one-to-one confirmation preserve Cashbook", async () => {
      const target = lines.find((line) => line.direction === "credit");
      await prisma.settlementDocument.create({ data: { id: "settlement-bank-1", tenantId, settlementNumber: "SET-BANK-1", direction: "receipt", counterpartyType: "customer", counterpartyId: "customer-fictitious", counterpartyNameSnapshot: "虚构客户甲", cashbookAccountId: "bank-account-1", currency: "CNY", amount: target.amount, cashAmount: target.amount, totalSettlementAmount: target.amount, settlementDate: new Date("2026-07-01"), status: "posted", workflowStatus: "posted", postingStatus: "posted", externalReference: "BR-1001" } });
      await prisma.cashbookEntry.create({ data: { id: "cashbook-bank-1", tenantId, cashbookAccountId: "bank-account-1", settlementId: "settlement-bank-1", entryNumber: "CB-BANK-1", entryType: "settlement", direction: "inflow", amount: target.amount, currency: "CNY", occurredAt: new Date("2026-07-01"), balanceBefore: "3750.0000", balanceAfter: "5000.5000", postingBatchId: "posting-bank-1", metadata: { externalReference: "BR-1001" } } });
      const before = await prisma.cashbookEntry.findUnique({ where: { id: "cashbook-bank-1" } });
      const first = await reconciliation.generateCandidates(target.id, {}, context), second = await reconciliation.generateCandidates(target.id, {}, context); assert.deepEqual(first.candidates.map((item) => [item.cashbookEntryId, item.score, item.algorithmVersion]), second.candidates.map((item) => [item.cashbookEntryId, item.score, item.algorithmVersion])); assert.equal(first.candidates[0].evidence.recommendation, "recommended");
      let group = await reconciliation.createGroup({ cashbookAccountId: "bank-account-1", currency: "CNY", direction: "credit", reconciliationDate: "2026-07-02", bankAllocations: [{ bankStatementLineId: target.id, allocatedAmount: target.amount }], cashbookAllocations: [{ cashbookEntryId: "cashbook-bank-1", allocatedAmount: target.amount }] }, context);
      const preview = await reconciliation.previewGroup(group.id, context); assert.equal(preview.allowed, true); assert.equal(preview.differenceAmount, "0.0000");
      const confirmed = await reconciliation.confirmGroup(group.id, { expectedVersion: group.version, idempotencyKey: "confirm-bank-1" }, context); assert.equal(confirmed.workflowStatus, "confirmed"); assert.equal(confirmed.cashbookMutation, false);
      const after = await prisma.cashbookEntry.findUnique({ where: { id: "cashbook-bank-1" } }); assert.equal(after.amount.toString(), before.amount.toString()); assert.equal(after.balanceBefore.toString(), before.balanceBefore.toString()); assert.equal(after.balanceAfter.toString(), before.balanceAfter.toString());
      const matched = await statement.getLine(target.id, context); assert.equal(matched.reconciliationStatus, "matched"); assert.equal(matched.remainingAmount, "0.0000");
      const summary = await reconciliation.cashbookSummary("cashbook-bank-1", context); assert.equal(summary.bankReconciliationStatus, "reconciled_to_imported_statement");
      group = await reconciliation.getGroup(group.id, context); const reversed = await reconciliation.reverseGroup(group.id, { expectedVersion: group.version, reason: "Fictitious correction" }, context); assert.equal(reversed.allocationsRetained, true); assert.equal((await statement.getLine(target.id, context)).reconciliationStatus, "unmatched");
      await assert.rejects(() => reconciliation.reverseGroup(group.id, { expectedVersion: group.version + 1, reason: "again" }, context), (error) => error.code === "BANK_RECONCILIATION_NOT_REVERSIBLE");
    });

    await t.test("partial allocations, over-allocation and integrity exceptions are controlled", async () => {
      const target = lines.find((line) => line.direction === "debit");
      await prisma.settlementDocument.create({ data: { id: "settlement-bank-2", tenantId, settlementNumber: "SET-BANK-2", direction: "disbursement", counterpartyType: "supplier", cashbookAccountId: "bank-account-1", currency: "CNY", amount: target.amount, cashAmount: target.amount, totalSettlementAmount: target.amount, settlementDate: new Date("2026-07-02"), status: "posted", workflowStatus: "posted", postingStatus: "posted" } });
      await prisma.cashbookEntry.create({ data: { id: "cashbook-bank-2", tenantId, cashbookAccountId: "bank-account-1", settlementId: "settlement-bank-2", entryNumber: "CB-BANK-2", entryType: "settlement", direction: "outflow", amount: target.amount, currency: "CNY", occurredAt: new Date("2026-07-02"), balanceBefore: "5000.5000", balanceAfter: "4750.3750", postingBatchId: "posting-bank-2" } });
      const half = "100.0000"; let group = await reconciliation.createGroup({ cashbookAccountId: "bank-account-1", currency: "CNY", direction: "debit", reconciliationDate: "2026-07-03", bankAllocations: [{ bankStatementLineId: target.id, allocatedAmount: half }], cashbookAllocations: [{ cashbookEntryId: "cashbook-bank-2", allocatedAmount: half }] }, context); await reconciliation.confirmGroup(group.id, { expectedVersion: group.version, idempotencyKey: "confirm-partial" }, context); assert.equal((await statement.getLine(target.id, context)).reconciliationStatus, "partially_matched");
      const bad = await reconciliation.createGroup({ cashbookAccountId: "bank-account-1", currency: "CNY", direction: "debit", reconciliationDate: "2026-07-03", bankAllocations: [{ bankStatementLineId: target.id, allocatedAmount: "200.1251" }], cashbookAllocations: [{ cashbookEntryId: "cashbook-bank-2", allocatedAmount: "200.1251" }] }, context); assert.equal((await reconciliation.previewGroup(bad.id, context)).allowed, false); await assert.rejects(() => reconciliation.confirmGroup(bad.id, { expectedVersion: bad.version, idempotencyKey: "confirm-over" }, context), (error) => error.code === "BANK_RECONCILIATION_OVER_ALLOCATION");
      await prisma.cashbookEntry.create({ data: { id: "cashbook-bank-2-reversal", tenantId, cashbookAccountId: "bank-account-1", settlementId: "settlement-bank-2", entryNumber: "CB-BANK-2-R", entryType: "reversal", direction: "inflow", amount: target.amount, currency: "CNY", occurredAt: new Date("2026-07-04"), balanceBefore: "4750.3750", balanceAfter: "5000.5000", postingBatchId: "posting-bank-2-r", reversalOfEntryId: "cashbook-bank-2" } });
      await prisma.cashbookEntry.update({ where: { id: "cashbook-bank-2" }, data: { reversedByEntryId: "cashbook-bank-2-reversal" } });
      const exceptions = await reconciliation.listExceptions(context); assert.ok(exceptions.items.some((item) => item.exceptionType === "cashbook_entry_reversed" && item.severity === "blocking"));
      group = (await reconciliation.listGroups({}, context)).items.find((item) => item.id === group.id); assert.equal(group.integrityStatus, "mismatch"); assert.equal(group.conclusion, "Reconciliation evidence exception");
    });

    await t.test("capability and tenant boundaries fail closed", async () => {
      const disabled = createBankStatementService({ prisma, env: { ...env, FLOWCHAIN_ENABLE_DB_BANK_RECONCILIATION: "false" } }); await assert.rejects(() => disabled.listBatches({}, context), (error) => error.code === "BANK_RECONCILIATION_CAPABILITY_NOT_AVAILABLE");
      await assert.rejects(() => statement.listBatches({}, { identity: { ...context.identity, tenantId: "forged-tenant" } }), (error) => error.name === "PilotIdentityError" || ["PILOT_IDENTITY_NOT_PROVISIONED", "AUTHORIZATION_TENANT_MISMATCH"].includes(error.code));
    });
  } finally { await prisma.$disconnect(); }
});
