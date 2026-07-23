import assert from "node:assert/strict";
import test from "node:test";
import { scoreBankReconciliationCandidate } from "./bank-reconciliation-service.mjs";

const line = (overrides = {}) => ({ remainingAmount: "25.1250", transactionDate: new Date("2026-07-20T00:00:00Z"), bankReference: "PAYMENT INV-2026-001 SET-9001", customerReference: "RCPT-7001", description: "controlled import", counterpartyName: "Fictitious Partner", ...overrides });
const entry = (overrides = {}) => ({ amount: "100.5000", occurredAt: new Date("2026-07-20T00:00:00Z"), direction: "inflow", entryNumber: "CB-8001", metadata: { invoiceNumber: "INV/2026/001", paymentReference: "PAY-6001", receiptReference: "RCPT-7001" }, settlement: { settlementNumber: "SET.9001", counterpartyNameSnapshot: "Fictitious Partner" }, internalTransfer: null, ...overrides });

test("candidate v1.1 scoring uses remaining Decimal capacity", () => {
  const score = scoreBankReconciliationCandidate(line(), entry(), 251250n, 753750n);
  assert.equal(score.evidence.exactAmount, true);
  assert.equal(score.evidence.cashbookOriginalAmount, "100.5000");
  assert.equal(score.evidence.cashbookConfirmedAllocatedAmount, "75.3750");
  assert.equal(score.evidence.cashbookRemainingAmount, "25.1250");
  assert.equal(score.amountScore, 45);
});

test("document tokens match deterministically across punctuation and order", () => {
  const first = scoreBankReconciliationCandidate(line(), entry(), 251250n, 753750n);
  const second = scoreBankReconciliationCandidate(line({ bankReference: "SET 9001 PAYMENT INV2026001" }), entry(), 251250n, 753750n);
  assert.deepEqual(first.evidence.matchedDocumentTokens, ["INV2026001", "RCPT7001", "SET9001"]);
  assert.deepEqual(second.evidence.matchedDocumentTokens, first.evidence.matchedDocumentTokens);
  assert.equal(first.documentScore, 10);
  assert.equal(second.documentScore, 10);
});

test("ordinary words do not produce document or high reference scores", () => {
  const score = scoreBankReconciliationCandidate(line({ remainingAmount: "1.0000", bankReference: "PAYMENT RECEIPT CUSTOMER", customerReference: null }), entry({ metadata: { invoiceNumber: "PAYMENT" }, settlement: { settlementNumber: "RECEIPT", counterpartyNameSnapshot: null } }), 251250n, 753750n);
  assert.equal(score.documentScore, 0);
  assert.equal(score.referenceScore, 0);
  assert.ok(score.score < 50);
});

test("score is stable and rejects direction-independent accidental partner boosts", () => {
  const source = entry({ settlement: { settlementNumber: "SET-9001", counterpartyNameSnapshot: "Different Partner" } });
  const first = scoreBankReconciliationCandidate(line(), source, 251250n, 753750n);
  const second = scoreBankReconciliationCandidate(line(), source, 251250n, 753750n);
  assert.deepEqual(first, second);
  assert.equal(first.counterpartyScore, 0);
});
