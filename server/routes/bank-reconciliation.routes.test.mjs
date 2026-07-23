import assert from "node:assert/strict";
import test from "node:test";
import { handleBankReconciliationRoute } from "./bank-reconciliation.routes.mjs";

function request({ path, method = "GET", body = {}, headers = {}, statement = {}, reconciliation = {}, authenticated = true }) {
  const sent = [];
  return { sent, ctx: { req: { method, headers }, res: {}, url: new URL(`http://local${path}`), identity: authenticated ? { authenticated: true, tenantId: "signed-tenant", userId: "signed-user" } : null, env: { FLOWCHAIN_PERSISTENCE_MODE: "database", FLOWCHAIN_ENABLE_DB_BANK_RECONCILIATION: "true" }, bankReconciliationPrisma: {}, bankStatementService: statement, bankReconciliationService: reconciliation, readBody: async () => body, send: (_res, status, payload) => sent.push({ status, payload }) } };
}

test("bank statement API routes cover mapping, durable staging, validation, duplicates and immutable lines", async () => {
  const calls = [];
  const statement = new Proxy({}, { get: (_target, method) => async (...args) => { calls.push([String(method), ...args]); return String(method).startsWith("list") ? { items: [] } : { id: "resource", method: String(method) }; } });
  const cases = [
    ["GET", "/api/finance/bank-mappings", "listMappings"], ["POST", "/api/finance/bank-mappings", "createMapping"], ["GET", "/api/finance/bank-mappings/MAP-1", "getMapping"], ["PATCH", "/api/finance/bank-mappings/MAP-1", "updateMapping"],
    ["POST", "/api/finance/bank-statements/uploads", "stageUpload"], ["GET", "/api/finance/bank-statements/batches", "listBatches"], ["POST", "/api/finance/bank-statements/batches", "createBatch"], ["GET", "/api/finance/bank-statements/batches/B-1", "getBatch"],
    ["POST", "/api/finance/bank-statements/batches/B-1/parse", "parseBatch"], ["POST", "/api/finance/bank-statements/batches/B-1/validate", "validateBatch"], ["POST", "/api/finance/bank-statements/batches/B-1/commit", "commitBatch"], ["POST", "/api/finance/bank-statements/batches/B-1/void", "voidBatch"],
    ["GET", "/api/finance/bank-statements/batches/B-1/rows", "listRows"], ["PATCH", "/api/finance/bank-statements/batches/B-1/rows/R-1", "updateRow"], ["POST", "/api/finance/bank-statements/batches/B-1/rows/R-1/exclude", "excludeRow"], ["POST", "/api/finance/bank-statements/batches/B-1/rows/R-1/accept-duplicate", "acceptDuplicate"], ["GET", "/api/finance/bank-statements/lines", "listLines"], ["GET", "/api/finance/bank-statements/lines/L-1", "getLine"],
  ];
  for (const [method, path, expected] of cases) { const item = request({ method, path, body: { tenantId: "forged", actorId: "forged", amount: "999999", candidateScore: 100 }, headers: { "idempotency-key": "header-key", "if-match": '"3"' }, statement }); assert.equal(await handleBankReconciliationRoute(item.ctx), true); assert.ok([200, 201].includes(item.sent[0].status)); assert.equal(calls.at(-1)[0], expected); assert.equal(calls.at(-1).at(-1).identity.tenantId, "signed-tenant"); }
  const commit = calls.find((call) => call[0] === "commitBatch"); assert.equal(commit[2].idempotencyKey, "header-key"); assert.equal(commit[2].expectedVersion, 3);
});

test("bank reconciliation API routes cover candidates, groups, confirmation, reversal and exceptions", async () => {
  const calls = [];
  const reconciliation = new Proxy({}, { get: (_target, method) => async (...args) => { calls.push([String(method), ...args]); return String(method).startsWith("list") ? { items: [] } : { id: "resource", method: String(method) }; } });
  const cases = [
    ["POST", "/api/finance/bank-reconciliation/lines/L-1/candidates/generate", "generateCandidates"], ["GET", "/api/finance/bank-reconciliation/lines/L-1/candidates", "listCandidates"], ["POST", "/api/finance/bank-reconciliation/candidates/C-1/dismiss", "dismissCandidate"],
    ["GET", "/api/finance/bank-reconciliation/groups", "listGroups"], ["POST", "/api/finance/bank-reconciliation/groups", "createGroup"], ["GET", "/api/finance/bank-reconciliation/groups/G-1", "getGroup"], ["PATCH", "/api/finance/bank-reconciliation/groups/G-1", "reviseGroup"], ["POST", "/api/finance/bank-reconciliation/groups/G-1/preview", "previewGroup"], ["POST", "/api/finance/bank-reconciliation/groups/G-1/confirm", "confirmGroup"], ["POST", "/api/finance/bank-reconciliation/groups/G-1/reverse", "reverseGroup"],
    ["GET", "/api/finance/bank-reconciliation/exceptions", "listExceptions"], ["POST", "/api/finance/bank-reconciliation/integrity/refresh", "refreshIntegrity"], ["POST", "/api/finance/bank-reconciliation/exceptions/E-1/resolve", "resolveException"], ["GET", "/api/finance/bank-reconciliation/cashbook-entries/CB-1/summary", "cashbookSummary"],
  ];
  for (const [method, path, expected] of cases) { const item = request({ method, path, body: { tenantId: "forged", actorId: "forged", totalBankAmount: "1", score: 100 }, headers: { "idempotency-key": "api-key", "if-match": "4" }, reconciliation }); await handleBankReconciliationRoute(item.ctx); assert.equal(calls.at(-1)[0], expected); assert.equal(calls.at(-1).at(-1).identity.tenantId, "signed-tenant"); }
  const confirm = calls.find((call) => call[0] === "confirmGroup"); assert.equal(confirm[2].idempotencyKey, "api-key"); assert.equal(confirm[2].expectedVersion, 4);
});

test("bank reconciliation routes fail closed for unsigned identity and sanitize unexpected failures", async () => {
  const unsigned = request({ path: "/api/finance/bank-statements/batches", authenticated: false }); await handleBankReconciliationRoute(unsigned.ctx); assert.deepEqual(unsigned.sent[0], { status: 401, payload: { code: "AUTHENTICATION_REQUIRED", message: "Authentication is required." } });
  const unsafe = request({ path: "/api/finance/bank-statements/batches", statement: { listBatches: async () => { throw new Error("P2002 secret_account_number"); } } }); await handleBankReconciliationRoute(unsafe.ctx); assert.deepEqual(unsafe.sent[0], { status: 500, payload: { code: "BANK_RECONCILIATION_FAILED", message: "Bank statement reconciliation could not be completed." } }); assert.doesNotMatch(JSON.stringify(unsafe.sent[0].payload), /P2002|account_number/);
});
