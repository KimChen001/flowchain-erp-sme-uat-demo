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
    let mapping, batch, duplicate, lines;

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
      const committedRows = (await statement.listRows(batch.id, context)).items;
      await assert.rejects(() => statement.updateRow(batch.id, committedRows[0].id, { expectedVersion: committedRows[0].version, overrideReason: "must fail", changes: { amount: "1.0000" } }, context), (error) => error.code === "BANK_STATEMENT_BATCH_IMMUTABLE");
      await assert.rejects(() => prisma.bankStatementLine.update({ where: { id: lines[0].id }, data: { amount: "999.0000", remainingAmount: "999.0000" } }), /immutable/);
    });

    await t.test("exact file duplicate is blocked and mapping history remains versioned", async () => {
      const updated = await statement.updateMapping(mapping.id, { expectedVersion: mapping.version, name: "Fictitious bank CSV v2" }, context); assert.equal(updated.version, 2); assert.equal((await statement.getMapping(mapping.id, context)).status, "superseded");
      const bytes = await readFile(fixture); const upload = await statement.stageUpload({ fileName: "fictitious-bank-copy.csv", mimeType: "text/csv", contentBase64: bytes.toString("base64") }, context);
      duplicate = await statement.createBatch({ cashbookAccountId: "bank-account-1", mappingTemplateId: updated.id, uploadId: upload.uploadId, currency: "CNY" }, context); duplicate = await statement.parseBatch(duplicate.id, context); duplicate = await statement.validateBatch(duplicate.id, context);
      assert.equal(duplicate.validationStatus, "invalid"); assert.equal(duplicate.exactDuplicateRowCount, 2);
      const duplicateRows = (await statement.listRows(duplicate.id, context)).items;
      await statement.acceptDuplicate(duplicate.id, duplicateRows[0].id, { reason: "Link exact duplicate as controlled evidence" }, context);
      await statement.updateRow(duplicate.id, duplicateRows[1].id, { expectedVersion: duplicateRows[1].version, overrideReason: "Correct fictitious transaction identifier", changes: { transactionId: "TX-CORRECTED-UNIQUE" } }, context);
      assert.equal(await prisma.auditLog.count({ where: { tenantId, action: "bank_statement_duplicate_linked", entityId: duplicateRows[0].id } }), 1);
      assert.equal(await prisma.auditLog.count({ where: { tenantId, action: "bank_statement_row_overridden", entityId: duplicateRows[1].id } }), 1);
    });

    await t.test("full-statement balance match and controlled mismatch override are auditable", async () => {
      const active = (await statement.listMappings(context)).items.find((item) => item.status === "active");
      const original = await readFile(fixture, "utf8");
      const prepare = async (suffix, closingBalance) => {
        const content = original.replaceAll("TX-100", `TX-${suffix}`).replaceAll("BR-100", `BR-${suffix}`);
        const upload = await statement.stageUpload({ fileName: `full-${suffix}.csv`, mimeType: "text/csv", contentBase64: Buffer.from(content).toString("base64") }, context);
        let candidate = await statement.createBatch({ cashbookAccountId: "bank-account-1", mappingTemplateId: active.id, uploadId: upload.uploadId, currency: "CNY", coverageType: "full_statement", openingBalance: "10000.0000", closingBalance }, context);
        candidate = await statement.parseBatch(candidate.id, context);
        return statement.validateBatch(candidate.id, context);
      };
      const matchedBalance = await prepare("BAL-A-100", "11000.3750");
      assert.equal(matchedBalance.metadata.balanceDifference, "0.0000");
      assert.equal(matchedBalance.metadata.balanceOverrideRequired, false);
      const committed = await statement.commitBatch(matchedBalance.id, { expectedVersion: matchedBalance.version, idempotencyKey: "commit-balance-match" }, context);
      assert.equal(committed.workflowStatus, "committed");
      const committedBalanceBatch = await statement.getBatch(matchedBalance.id, context);
      const voided = await statement.voidBatch(matchedBalance.id, { expectedVersion: committedBalanceBatch.version, reason: "Controlled fictitious void" }, context);
      assert.equal(voided.workflowStatus, "voided");
      assert.ok((await statement.listLines({ status: "voided" }, context)).items.some((item) => item.batchId === matchedBalance.id));
      const mismatchedBalance = await prepare("BAL-B-100", "11001.0000");
      assert.equal(mismatchedBalance.validationStatus, "valid_with_warnings");
      assert.equal(mismatchedBalance.metadata.balanceDifference, "-0.6250");
      await assert.rejects(() => statement.commitBatch(mismatchedBalance.id, { expectedVersion: mismatchedBalance.version, idempotencyKey: "commit-balance-mismatch" }, context), (error) => error.code === "BANK_STATEMENT_BALANCE_MISMATCH" && error.details?.differenceAmount === "-0.6250");
      const overridden = await statement.commitBatch(mismatchedBalance.id, { expectedVersion: mismatchedBalance.version, idempotencyKey: "commit-balance-mismatch-override", overrideReason: "Fictitious bank export rounds a controlled balance field", supportingEvidence: { evidenceId: "FICTITIOUS-BALANCE-REVIEW-1" } }, context);
      assert.equal(overridden.workflowStatus, "committed");
      assert.equal(await prisma.auditLog.count({ where: { tenantId, action: "bank_statement_batch_committed", entityId: mismatchedBalance.id } }), 1);
    });

    await t.test("deterministic candidates and one-to-one confirmation preserve Cashbook", async () => {
      const target = lines.find((line) => line.direction === "credit");
      await prisma.settlementDocument.create({ data: { id: "settlement-bank-1", tenantId, settlementNumber: "SET-BANK-1", direction: "receipt", counterpartyType: "customer", counterpartyId: "customer-fictitious", counterpartyNameSnapshot: "虚构客户甲", cashbookAccountId: "bank-account-1", currency: "CNY", amount: target.amount, cashAmount: target.amount, totalSettlementAmount: target.amount, settlementDate: new Date("2026-07-01"), status: "posted", workflowStatus: "posted", postingStatus: "posted", externalReference: "BR-1001" } });
      await prisma.cashbookEntry.create({ data: { id: "cashbook-bank-1", tenantId, cashbookAccountId: "bank-account-1", settlementId: "settlement-bank-1", entryNumber: "CB-BANK-1", entryType: "settlement", direction: "inflow", amount: target.amount, currency: "CNY", occurredAt: new Date("2026-07-01"), balanceBefore: "3750.0000", balanceAfter: "5000.5000", postingBatchId: "posting-bank-1", metadata: { externalReference: "BR-1001" } } });
      const before = await prisma.cashbookEntry.findUnique({ where: { id: "cashbook-bank-1" } });
      const first = await reconciliation.generateCandidates(target.id, {}, context), second = await reconciliation.generateCandidates(target.id, {}, context); assert.deepEqual(first.candidates.map((item) => [item.cashbookEntryId, item.score, item.algorithmVersion]), second.candidates.map((item) => [item.cashbookEntryId, item.score, item.algorithmVersion])); assert.equal(first.candidates[0].evidence.recommendation, "recommended");
      const dismissed = await reconciliation.dismissCandidate(second.candidates[0].id, { reason: "Controlled fictitious candidate review" }, context); assert.equal(dismissed.status, "dismissed");
      assert.equal(await prisma.auditLog.count({ where: { tenantId, action: "bank_reconciliation_candidate_dismissed", entityId: dismissed.id } }), 1);
      await reconciliation.generateCandidates(target.id, {}, context);
      let group = await reconciliation.createGroup({ cashbookAccountId: "bank-account-1", currency: "CNY", direction: "credit", reconciliationDate: "2026-07-02", bankAllocations: [{ bankStatementLineId: target.id, allocatedAmount: target.amount }], cashbookAllocations: [{ cashbookEntryId: "cashbook-bank-1", allocatedAmount: target.amount }] }, context);
      const preview = await reconciliation.previewGroup(group.id, context); assert.equal(preview.allowed, true); assert.equal(preview.differenceAmount, "0.0000");
      const confirmed = await reconciliation.confirmGroup(group.id, { expectedVersion: group.version, idempotencyKey: "confirm-bank-1" }, context); assert.equal(confirmed.workflowStatus, "confirmed"); assert.equal(confirmed.cashbookMutation, false);
      const after = await prisma.cashbookEntry.findUnique({ where: { id: "cashbook-bank-1" } }); assert.equal(after.amount.toString(), before.amount.toString()); assert.equal(after.balanceBefore.toString(), before.balanceBefore.toString()); assert.equal(after.balanceAfter.toString(), before.balanceAfter.toString());
      const matched = await statement.getLine(target.id, context); assert.equal(matched.reconciliationStatus, "matched"); assert.equal(matched.remainingAmount, "0.0000");
      const currentBatch = await statement.getBatch(batch.id, context);
      await assert.rejects(() => statement.voidBatch(batch.id, { expectedVersion: currentBatch.version, reason: "Must reverse reconciliation first" }, context), (error) => error.code === "BANK_STATEMENT_BATCH_HAS_CONFIRMED_RECONCILIATION");
      const summary = await reconciliation.cashbookSummary("cashbook-bank-1", context); assert.equal(summary.bankReconciliationStatus, "reconciled_to_imported_statement");
      group = await reconciliation.getGroup(group.id, context); const reversed = await reconciliation.reverseGroup(group.id, { expectedVersion: group.version, reason: "Fictitious correction" }, context); assert.equal(reversed.allocationsRetained, true); assert.equal((await statement.getLine(target.id, context)).reconciliationStatus, "unmatched");
      await assert.rejects(() => reconciliation.reverseGroup(group.id, { expectedVersion: group.version + 1, reason: "again" }, context), (error) => error.code === "BANK_RECONCILIATION_NOT_REVERSIBLE");
    });

    await t.test("grouped topologies, mismatch gates, idempotency, and allocation races are deterministic", async () => {
      const activeLines = (await statement.listLines({ status: "active" }, context)).items;
      const credits = activeLines.filter((line) => line.direction === "credit");
      assert.ok(credits.length >= 2);
      const createEntry = async (id, amount, direction = "inflow", accountId = "bank-account-1", currency = "CNY") => {
        const settlementId = `${id}-settlement`;
        await prisma.settlementDocument.create({ data: { id: settlementId, tenantId, settlementNumber: settlementId.toUpperCase(), direction: direction === "inflow" ? "receipt" : "disbursement", counterpartyType: direction === "inflow" ? "customer" : "supplier", cashbookAccountId: accountId, currency, amount, cashAmount: amount, totalSettlementAmount: amount, settlementDate: new Date("2026-07-01"), status: "posted", workflowStatus: "posted", postingStatus: "posted" } });
        return prisma.cashbookEntry.create({ data: { id, tenantId, cashbookAccountId: accountId, settlementId, entryNumber: id.toUpperCase(), entryType: "settlement", direction, amount, currency, occurredAt: new Date("2026-07-01"), balanceBefore: "10000.0000", balanceAfter: "10000.0000", postingBatchId: `${id}-posting` } });
      };
      await createEntry("cash-topology-a", "500.0000");
      await createEntry("cash-topology-b", "750.5000");
      await createEntry("cash-topology-c", "2501.0000");
      await createEntry("cash-topology-d", "700.0000");
      await createEntry("cash-topology-wrong-direction", "1250.5000", "outflow");
      await prisma.cashbookAccount.create({ data: { id: "bank-account-other", tenantId, accountCode: "BANK-OTHER", name: "Other Fictitious Bank", accountType: "bank", currency: "CNY" } });
      await createEntry("cash-topology-other-account", "1250.5000", "inflow", "bank-account-other");

      let oneToMany = await reconciliation.createGroup({ cashbookAccountId: "bank-account-1", currency: "CNY", direction: "credit", reconciliationDate: "2026-07-05", bankAllocations: [{ bankStatementLineId: credits[0].id, allocatedAmount: "1250.5000" }], cashbookAllocations: [{ cashbookEntryId: "cash-topology-a", allocatedAmount: "500.0000" }, { cashbookEntryId: "cash-topology-b", allocatedAmount: "750.5000" }] }, context);
      assert.equal((await reconciliation.previewGroup(oneToMany.id, context)).allowed, true);
      const confirmedOneToMany = await reconciliation.confirmGroup(oneToMany.id, { expectedVersion: oneToMany.version, idempotencyKey: "confirm-one-to-many" }, context);
      assert.equal((await reconciliation.confirmGroup(oneToMany.id, { expectedVersion: oneToMany.version, idempotencyKey: "confirm-one-to-many" }, context)).idempotentReplay, true);
      await assert.rejects(() => reconciliation.confirmGroup(oneToMany.id, { expectedVersion: oneToMany.version + 1, idempotencyKey: "confirm-one-to-many" }, context), (error) => error.code === "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD");
      oneToMany = await reconciliation.getGroup(oneToMany.id, context);
      await reconciliation.reverseGroup(oneToMany.id, { expectedVersion: oneToMany.version, reason: "Topology test reset" }, context);
      assert.equal(confirmedOneToMany.cashbookMutation, false);

      let manyToOne = await reconciliation.createGroup({ cashbookAccountId: "bank-account-1", currency: "CNY", direction: "credit", reconciliationDate: "2026-07-05", bankAllocations: [{ bankStatementLineId: credits[0].id, allocatedAmount: "1250.5000" }, { bankStatementLineId: credits[1].id, allocatedAmount: "1250.5000" }], cashbookAllocations: [{ cashbookEntryId: "cash-topology-c", allocatedAmount: "2501.0000" }] }, context);
      assert.equal((await reconciliation.previewGroup(manyToOne.id, context)).allowed, true);
      await reconciliation.confirmGroup(manyToOne.id, { expectedVersion: manyToOne.version, idempotencyKey: "confirm-many-to-one" }, context);
      manyToOne = await reconciliation.getGroup(manyToOne.id, context);
      await reconciliation.reverseGroup(manyToOne.id, { expectedVersion: manyToOne.version, reason: "Topology test reset" }, context);

      let manyToMany = await reconciliation.createGroup({ cashbookAccountId: "bank-account-1", currency: "CNY", direction: "credit", reconciliationDate: "2026-07-05", bankAllocations: [{ bankStatementLineId: credits[0].id, allocatedAmount: "300.0000" }, { bankStatementLineId: credits[1].id, allocatedAmount: "400.0000" }], cashbookAllocations: [{ cashbookEntryId: "cash-topology-a", allocatedAmount: "200.0000" }, { cashbookEntryId: "cash-topology-d", allocatedAmount: "500.0000" }] }, context);
      assert.equal((await reconciliation.previewGroup(manyToMany.id, context)).allowed, true);
      await reconciliation.confirmGroup(manyToMany.id, { expectedVersion: manyToMany.version, idempotencyKey: "confirm-many-to-many" }, context);
      manyToMany = await reconciliation.getGroup(manyToMany.id, context);
      await reconciliation.reverseGroup(manyToMany.id, { expectedVersion: manyToMany.version, reason: "Topology test reset" }, context);

      const directionMismatch = await reconciliation.createGroup({ cashbookAccountId: "bank-account-1", currency: "CNY", direction: "credit", reconciliationDate: "2026-07-05", bankAllocations: [{ bankStatementLineId: credits[0].id, allocatedAmount: "1250.5000" }], cashbookAllocations: [{ cashbookEntryId: "cash-topology-wrong-direction", allocatedAmount: "1250.5000" }] }, context);
      assert.ok((await reconciliation.previewGroup(directionMismatch.id, context)).issues.some((issue) => issue.code === "BANK_RECONCILIATION_CASHBOOK_ENTRY_MISMATCH"));
      const accountMismatch = await reconciliation.createGroup({ cashbookAccountId: "bank-account-other", currency: "CNY", direction: "credit", reconciliationDate: "2026-07-05", bankAllocations: [{ bankStatementLineId: credits[0].id, allocatedAmount: "1250.5000" }], cashbookAllocations: [{ cashbookEntryId: "cash-topology-other-account", allocatedAmount: "1250.5000" }] }, context);
      assert.ok((await reconciliation.previewGroup(accountMismatch.id, context)).issues.some((issue) => issue.code === "BANK_RECONCILIATION_BANK_LINE_MISMATCH"));
      const currencyMismatch = await reconciliation.createGroup({ cashbookAccountId: "bank-account-1", currency: "USD", direction: "credit", reconciliationDate: "2026-07-05", bankAllocations: [{ bankStatementLineId: credits[0].id, allocatedAmount: "1250.5000" }], cashbookAllocations: [{ cashbookEntryId: "cash-topology-a", allocatedAmount: "1250.5000" }] }, context);
      assert.ok((await reconciliation.previewGroup(currencyMismatch.id, context)).issues.some((issue) => issue.code.includes("MISMATCH")));

      const raceEntry = await createEntry("cash-topology-race", "1250.5000");
      const raceInput = { cashbookAccountId: "bank-account-1", currency: "CNY", direction: "credit", reconciliationDate: "2026-07-06", bankAllocations: [{ bankStatementLineId: credits[0].id, allocatedAmount: "1250.5000" }], cashbookAllocations: [{ cashbookEntryId: raceEntry.id, allocatedAmount: "1250.5000" }] };
      const raceA = await reconciliation.createGroup(raceInput, context), raceB = await reconciliation.createGroup(raceInput, context);
      const race = await Promise.allSettled([reconciliation.confirmGroup(raceA.id, { expectedVersion: raceA.version, idempotencyKey: "confirm-race-a" }, context), reconciliation.confirmGroup(raceB.id, { expectedVersion: raceB.version, idempotencyKey: "confirm-race-b" }, context)]);
      assert.equal(race.filter((result) => result.status === "fulfilled").length, 1);
      assert.equal(race.filter((result) => result.status === "rejected").length, 1);
      assert.equal(await prisma.bankReconciliationGroup.count({ where: { id: { in: [raceA.id, raceB.id] }, workflowStatus: "confirmed" } }), 1);
      assert.equal((await prisma.bankStatementLine.findUnique({ where: { id: credits[0].id } })).matchedAmount.toString(), "1250.5");
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
      await prisma.tenant.create({ data: { id: "tenant-phase-5-3-other", name: "Other Fictitious Workspace" } });
      await prisma.user.create({ data: { id: "phase-5-3-other-admin", tenantId: "tenant-phase-5-3-other", email: "other@phase-5-3.invalid", name: "Other Admin", role: "admin" } });
      await backfillTenantAuthorization(prisma, "tenant-phase-5-3-other", { actorId: "phase-5-3-other-admin" });
      const otherContext = { identity: { authenticated: true, tenantId: "tenant-phase-5-3-other", userId: "phase-5-3-other-admin", role: "admin" } };
      await assert.rejects(() => statement.getMapping(mapping.id, otherContext), (error) => error.code === "BANK_STATEMENT_NOT_FOUND");
      await prisma.user.create({ data: { id: "phase-5-3-redacted-reader", tenantId, email: "redacted@phase-5-3.invalid", name: "Redacted Reader", role: "custom" } });
      await prisma.tenantRole.create({ data: { id: "phase-5-3-redacted-role", tenantId, roleKey: "phase-5-3-redacted", name: "Redacted Bank Reader" } });
      await prisma.tenantRolePermission.createMany({ data: ["finance.bank_statement.read", "finance.bank_mapping.read", "finance.bank_reconciliation.read"].map((permissionCode, index) => ({ id: `phase-5-3-redacted-permission-${index}`, tenantId, roleId: "phase-5-3-redacted-role", permissionCode })) });
      await prisma.userRoleAssignment.create({ data: { id: "phase-5-3-redacted-assignment", tenantId, userId: "phase-5-3-redacted-reader", roleId: "phase-5-3-redacted-role" } });
      const redactedContext = { identity: { authenticated: true, tenantId, userId: "phase-5-3-redacted-reader", role: "custom" } };
      const redactedLine = (await statement.listLines({ status: "active" }, redactedContext)).items[0];
      assert.equal(redactedLine.amount, null); assert.equal(redactedLine.counterpartyName, null); assert.equal(redactedLine.counterpartyAccountMasked, null);
    });
  } finally { await prisma.$disconnect(); }
});
