import assert from "node:assert/strict";
import test from "node:test";
import { backfillTenantAuthorization } from "../../server/auth/authorization-backfill.mjs";
import { createBankStatementService } from "../../server/domain/bank-statement-service.mjs";
import { createPrismaClient } from "../../server/persistence/prisma-client.mjs";

const tenantId = "tenant-bank-projection", adminId = "bank-projection-admin";
const env = { ...process.env, FLOWCHAIN_PERSISTENCE_MODE: "database", FLOWCHAIN_ENABLE_DB_BANK_RECONCILIATION: "true", FLOWCHAIN_ATTACHMENT_STORAGE_PROVIDER: "local" };
const context = { identity: { authenticated: true, tenantId, userId: adminId, role: "admin" } };
const forbidden = /(?:rawRowHash|canonicalFingerprint|counterpartyAccountHash|accountIdentifierHash|payloadHash|clientSecret|accessToken|privateKey)/i;

function assertNoForbiddenFields(value) {
  assert.doesNotMatch(JSON.stringify(value), forbidden);
  if (!value || typeof value !== "object") return;
  for (const child of Object.values(value)) assertNoForbiddenFields(child);
}

test("real PostgreSQL bank projections apply current permissions recursively", async () => {
  const prisma = await createPrismaClient(env);
  try {
    await prisma.tenant.create({ data: { id: tenantId, name: "Projection Security Tenant", currency: "CNY" } });
    await prisma.user.create({ data: { id: adminId, tenantId, email: "projection-admin@example.invalid", name: "Projection Admin", role: "admin" } });
    await backfillTenantAuthorization(prisma, tenantId, { actorId: adminId });
    await prisma.cashbookAccount.create({ data: { id: "projection-account", tenantId, accountCode: "BANK-PROJ", name: "Fictitious Projection Bank", accountType: "bank", currency: "CNY", currentBalance: "0" } });
    const service = createBankStatementService({ prisma, env });
    const mapping = await service.createMapping({ templateCode: "PROJ", name: "Projection", formatType: "csv", cashbookAccountId: "projection-account", debitCreditMode: "signed_amount", signConvention: "positive_credit", columnMapping: { transactionId: "id", transactionDate: "date", signedAmount: "amount", counterpartyName: "partner", counterpartyAccount: "account" } }, context);
    const upload = await service.stageUpload({ fileName: "projection.csv", mimeType: "text/csv", contentBase64: Buffer.from("id,date,amount,partner,account,unknown\nT1,2026-07-23,12.3400,Fictitious Partner,6222000012345678,private\n").toString("base64") }, context);
    let batch = await service.createBatch({ cashbookAccountId: "projection-account", mappingTemplateId: mapping.id, uploadId: upload.uploadId, currency: "CNY" }, context);
    batch = await service.parseBatch(batch.id, context);
    const row = await prisma.bankStatementImportRow.findFirstOrThrow({ where: { tenantId, batchId: batch.id } });
    await prisma.bankStatementImportRow.update({ where: { id: row.id }, data: { overrideData: { before: { amount: "12.3400", partner: "Fictitious Partner" }, after: { amount: "10.0000", partner: "Corrected Partner" }, actor: { id: adminId, email: "private@example.invalid", authorizationContext: { accessToken: "never" } } } } });

    const full = (await service.listRows(batch.id, context)).items[0];
    assertNoForbiddenFields(full);
    assert.equal(full.overrideData.actor.email, undefined);
    assert.equal(full.rawData.unknown, null);

    const actor = await prisma.user.findUniqueOrThrow({ where: { id: adminId } });
    const assignment = await prisma.userRoleAssignment.findFirstOrThrow({ where: { tenantId, userId: actor.id }, include: { role: true } });
    await prisma.tenantRolePermission.deleteMany({ where: { tenantId, roleId: assignment.roleId, permissionCode: { in: ["finance.amounts.read", "finance.partner_snapshot.read"] } } });
    const redacted = (await service.listRows(batch.id, context)).items[0];
    assert.equal(redacted.normalizedAmount, null);
    assert.equal(redacted.normalizedCounterpartyName, null);
    assert.equal(redacted.rawData.amount, null);
    assert.equal(redacted.rawData.partner, null);
    assert.equal(redacted.overrideData.before.amount, null);
    assert.equal(redacted.overrideData.after.partner, null);
    assertNoForbiddenFields(redacted);
  } finally {
    await prisma.$disconnect();
  }
});
