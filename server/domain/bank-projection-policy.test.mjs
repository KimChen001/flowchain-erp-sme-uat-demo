import assert from "node:assert/strict";
import test from "node:test";
import { assertSafeBankMappingConfiguration, bankActorVisibility, sanitizeBankImportRawData, sanitizeBankOverrideData } from "./bank-projection-policy.mjs";
import { buildBankImportRowDto, buildBankStatementLineDto } from "./bank-statement-dto.mjs";
import { buildBankAiContextDto, buildBankReconciliationExceptionDto, buildBankReconciliationGroupDto } from "./bank-reconciliation-dto.mjs";

const actor = (...permissions) => ({ permissionCodes: new Set(["finance.bank_statement.read", ...permissions]) });
const mapping = { debitAmount: "借方金额", counterpartyName: "Counter_Party-Name", counterpartyAccount: "对方账号" };

test("raw and historical override data are recursively classified using current permissions", () => {
  const visibility = bankActorVisibility(actor());
  const raw = sanitizeBankImportRawData({ rawData: { "借方金额": "99.0000", "Counter_Party-Name": "Partner", nested: [{ 对方账号: "6222000012345678", access_token: "never" }], unknown: "private" }, columnMapping: mapping, actorVisibility: visibility });
  assert.equal(raw.value["借方金额"], null); assert.equal(raw.value["Counter_Party-Name"], null); assert.equal(raw.value.nested[0]["对方账号"], null); assert.ok(!("access_token" in raw.value.nested[0])); assert.equal(raw.value.unknown, null);
  const override = sanitizeBankOverrideData({ overrideData: { before: { amount: "10", customerName: "A", privateKey: "never" }, after: { amount: "20", customerName: "B" }, reason: "corrected" }, columnMapping: mapping, actorVisibility: visibility });
  assert.equal(override.value.before.amount, null); assert.equal(override.value.after.customerName, null); assert.ok(!("privateKey" in override.value.before)); assert.equal(override.value.reason, "corrected");
});

test("secret-like strings and override actors cannot bypass recursive projection", () => {
  const visibility = bankActorVisibility(actor("finance.amounts.read", "finance.partner_snapshot.read"));
  const raw = sanitizeBankImportRawData({ rawData: { transaction_id: "password=must-not-return", note: { id: "api_secret:must-not-return" } }, actorVisibility: visibility });
  assert.ok(!("transaction_id" in raw.value));
  assert.ok(!("id" in raw.value.note));
  const override = sanitizeBankOverrideData({ overrideData: { actor: { id: "U1", name: "Reviewer", email: "private@example.invalid", authorizationContext: { token: "never" } } }, actorVisibility: visibility });
  assert.deepEqual(override.value.actor, { id: "U1", displayName: "Reviewer" });
});

test("explicit DTO allowlists never expose hashes, raw Prisma metadata, or nested unauthorized values", () => {
  const limited = actor();
  const row = buildBankImportRowDto({ id: "R", batchId: "B", rawData: { 借方金额: "1", 对方账号: "full" }, overrideData: { before: { amount: "1" } }, normalizedCounterpartyAccountHash: "hash", rawRowHash: "hash", metadata: { secret: "never" }, issueCodes: [] }, limited, mapping);
  const line = buildBankStatementLineDto({ id: "L", amount: "1", matchedAmount: "0", remainingAmount: "1", counterpartyName: "Partner", counterpartyAccountHash: "hash", canonicalFingerprint: "hash", status: "active" }, limited);
  const group = buildBankReconciliationGroupDto({ id: "G", workflowStatus: "confirmed", integrityStatus: "matched", totalBankAmount: "1", totalCashbookAmount: "1", differenceAmount: "0", bankAllocations: [{ id: "BA", allocatedAmount: "1", bankStatementLine: { id: "L", amount: "1", counterpartyName: "Partner", counterpartyAccountHash: "hash" } }], cashbookAllocations: [{ id: "CA", allocatedAmount: "1", cashbookEntry: { id: "CB", amount: "1", settlement: { id: "S", amount: "1", counterpartyNameSnapshot: "Partner", metadata: { token: "never" } } } }], exceptions: [] }, limited);
  const serialized = JSON.stringify({ row, line, group });
  assert.doesNotMatch(serialized, /canonicalFingerprint|rawRowHash|counterpartyAccountHash|"metadata"|never|Partner|full/);
  assert.equal(group.bankAllocations[0].allocatedAmount, null); assert.equal(group.cashbookAllocations[0].cashbookEntry.amount, null);
});

test("mapping secret validator reports paths without echoing values", () => {
  assert.throws(() => assertSafeBankMappingConfiguration({ metadata: { adapter: [{ client_secret: "do-not-echo" }] } }), (error) => error.code === "BANK_MAPPING_SECRET_FIELD_FORBIDDEN" && error.details.paths[0] === "metadata.adapter[0].client_secret" && !JSON.stringify(error).includes("do-not-echo"));
  assert.throws(() => assertSafeBankMappingConfiguration({ metadata: { adapterConfig: "client_secret=do-not-echo" } }), (error) => error.details.paths[0] === "metadata.adapterConfig" && !JSON.stringify(error).includes("do-not-echo"));
  assert.doesNotThrow(() => assertSafeBankMappingConfiguration({ metadata: { credentialsStored: false } }));
  assert.throws(() => assertSafeBankMappingConfiguration({ metadata: { credentialsStored: true } }), (error) => error.details.paths[0] === "metadata.credentialsStored");
  assert.doesNotThrow(() => assertSafeBankMappingConfiguration({ columnMapping: { transactionId: "流水号" }, metadata: { parserVersion: "1" } }));
});

test("AI and exception DTOs expose only allowlisted summaries", () => {
  const limited = actor();
  const ai = buildBankAiContextDto({ validationSummary: { status: "valid", acceptedRowCount: 1, rawData: { password: "never" } }, candidateEvidenceSummary: { algorithmVersion: "bank-match-v1.1", score: 80, recommendation: "recommended", matchedDocumentTokens: ["INV001"], rawData: "never", counterpartyName: "Partner" }, totalBankAmount: "9", counterpartyName: "Partner" }, limited);
  const exception = buildBankReconciliationExceptionDto({ id: "E1", status: "open", severity: "blocking", metadata: { detectedBy: "integrity", message: "review", rawData: "never", token: "never" } }, limited);
  const serialized = JSON.stringify({ ai, exception });
  assert.doesNotMatch(serialized, /rawData|password|token|Partner|"9\.0000"/);
  assert.equal(ai.reconciliationSummary.totalBankAmount, null);
  assert.equal(ai.reconciliationSummary.counterpartyName, null);
});
