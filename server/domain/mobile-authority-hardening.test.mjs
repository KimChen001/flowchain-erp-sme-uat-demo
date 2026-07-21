import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createLocalDurableAttachmentStorage } from "./attachment-storage-provider.mjs";
import { derivePayableSettlementStatus, deriveReceivableSettlementStatus, assertAdvanceApplicationEligibility } from "./obligation-status-policy.mjs";
import { getMobileSyncEntityPolicy, loadAuthorizedSyncProjection } from "./mobile-sync-entity-policy.mjs";
import { receivingDecimalString, receivingDecimalUnits } from "./receiving-transaction-policy.mjs";
import { createMobileSyncService } from "./mobile-sync-service.mjs";

const actor = (permissions = []) => ({ tenantId: "tenant-a", user: { id: "user-a" }, permissionCodes: new Set(permissions), allWarehouses: false, readWarehouseIds: new Set(["warehouse-a"]) });

test("sync policy fails closed and redacts unauthorized purchase-order fields", async () => {
  assert.equal(getMobileSyncEntityPolicy("UnknownEntity"), null);
  const prisma = { purchaseOrder: { findFirst: async () => ({ id: "po-a", tenantId: "tenant-a", status: "pending_approval", version: 1, updatedAt: new Date(), amount: "100.0000", supplierId: "sup-a", supplierName: "Secret Supplier", currency: "CNY", metadata: {}, lines: [{ id: "line-a", sku: "SKU-A", itemName: "Item A", orderedQuantity: "1.0000", receivedQuantity: "0.0000", unit: "pcs", unitPrice: "10.0000", amount: "10.0000" }] }) } };
  const projection = await loadAuthorizedSyncProjection({ prisma, tenant: { operationalSettings: {} }, actor: actor(["procurement.purchase_order.read"]), entityType: "PurchaseOrder", entityId: "po-a" });
  assert.equal(projection.amount, null);
  assert.equal(projection.supplierId, null);
  assert.equal(projection.lines[0].unitPrice, null);
  assert.equal(projection.lines[0].lineAmount, null);
});

test("cursor claims expire and new cursors use the configured current key", () => {
  const env = { NODE_ENV: "test", FLOWCHAIN_SYNC_CURSOR_CURRENT_KEY_ID: "k2", FLOWCHAIN_SYNC_CURSOR_CURRENT_SECRET: "current-secret-that-is-at-least-32-characters-long", FLOWCHAIN_SYNC_CURSOR_PREVIOUS_KEYS: JSON.stringify({ k1: "previous-secret-that-is-at-least-32-characters-long" }) };
  let clock = 1000;
  const service = createMobileSyncService({ prisma: {}, env, now: () => new Date(clock), cursorTtlSeconds: 1 });
  const cursor = service.issueCursor({ issuedAt: 1000, expiresAt: 2000, tenantId: "tenant-a", userId: "user-a", clientId: "client-a", deviceIdHash: "device-a", lastSequence: "4", authorizationFingerprint: "fingerprint", snapshotSessionId: null });
  assert.equal(service.verifyCursor(cursor).keyId, "k2");
  assert.throws(() => service.verifyCursor(cursor.replace(/.$/, "x")), (error) => error.code === "SYNC_CURSOR_TAMPERED");
  clock = 3000;
  assert.throws(() => service.verifyCursor(cursor), (error) => error.code === "SYNC_CURSOR_EXPIRED");
});

test("fixed decimal policy keeps receiving boundaries exact", () => {
  const sum = receivingDecimalUnits("0.1") + receivingDecimalUnits("0.2");
  assert.equal(receivingDecimalString(sum), "0.3000");
  assert.equal(receivingDecimalString(receivingDecimalUnits("1.0000") - receivingDecimalUnits("0.0001")), "0.9999");
  assert.throws(() => receivingDecimalUnits("0.00001"), /four decimal places/);
});

test("advance status derivation preserves partial settlement and eligibility blocks", () => {
  assert.equal(derivePayableSettlementStatus({ originalAmount: "100", approvedCreditAmount: "0", outstandingAmount: "70" }), "partially_settled");
  assert.equal(deriveReceivableSettlementStatus({ originalAmount: "100", approvedCreditAmount: "0", outstandingAmount: "100" }), "open");
  assert.throws(() => assertAdvanceApplicationEligibility({ status: "held", outstandingAmount: "10" }, "payable"), (error) => error.code === "ADVANCE_APPLICATION_OBLIGATION_NOT_ELIGIBLE");
  assert.throws(() => assertAdvanceApplicationEligibility({ status: "disputed", outstandingAmount: "10" }, "receivable"), (error) => error.code === "ADVANCE_APPLICATION_OBLIGATION_NOT_ELIGIBLE");
});

test("durable attachment storage verifies atomic writes and production boundaries", async () => {
  assert.throws(() => createLocalDurableAttachmentStorage({ env: { NODE_ENV: "production", FLOWCHAIN_ATTACHMENT_STORAGE_PROVIDER: "local" } }), (error) => error.code === "ATTACHMENT_STORAGE_CONFIG_REQUIRED");
  assert.throws(() => createLocalDurableAttachmentStorage({ env: { NODE_ENV: "production", FLOWCHAIN_ATTACHMENT_STORAGE_PROVIDER: "local", FLOWCHAIN_UPLOAD_STORAGE_DIR: join(tmpdir(), "flowchain-prod-invalid") } }), (error) => error.code === "ATTACHMENT_STORAGE_PATH_INVALID");
  const root = await mkdtemp(join(tmpdir(), "flowchain-attachment-test-"));
  try {
    const storage = createLocalDurableAttachmentStorage({ rootDirectory: root, env: { NODE_ENV: "test" }, digest: (bytes) => Buffer.from(bytes).toString("hex") });
    await storage.put("tenant-a/upload-a", Buffer.from("evidence"), Buffer.from("evidence").toString("hex"));
    assert.equal((await readFile(join(root, "tenant-a", "upload-a"))).toString(), "evidence");
    assert.equal(await storage.verifyHash("tenant-a/upload-a", Buffer.from("evidence").toString("hex")), true);
  } finally { await rm(root, { recursive: true, force: true }); }
});
