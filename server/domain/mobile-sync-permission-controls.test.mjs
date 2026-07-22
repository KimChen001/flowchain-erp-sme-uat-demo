import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createDatabaseRepositoryRegistry } from "../repositories/adapter-registry.mjs";
import {
  getMobileSyncEntityPolicy,
  loadAuthorizedSyncProjection,
  validateMobileSyncEntityPolicy,
} from "./mobile-sync-entity-policy.mjs";
import { issueCursor, verifyCursor } from "./mobile-sync-service.mjs";

const enabledFinance = {
  FLOWCHAIN_PERSISTENCE_MODE: "database",
  FLOWCHAIN_ENABLE_DB_OPERATIONAL_FINANCE: "true",
};
const enabledReceiving = {
  FLOWCHAIN_PERSISTENCE_MODE: "database",
  FLOWCHAIN_ENABLE_DB_RECEIVING_POSTING: "true",
};
const actor = (permissions, options = {}) => ({
  tenantId: options.tenantId || "tenant-a",
  user: { id: "user-a" },
  permissionCodes: new Set(permissions),
  allWarehouses: Boolean(options.allWarehouses),
  readWarehouseIds: new Set(options.readWarehouseIds || []),
});

test("CustomerInvoice sync uses read permission and independently redacts amount and partner fields", async () => {
  assert.equal(getMobileSyncEntityPolicy("CustomerInvoice").requiredReadPermission, "finance.customer_invoice.read");
  const row = {
    id: "invoice-a",
    tenantId: "tenant-a",
    status: "issued",
    version: 3,
    currency: "CNY",
    totalAmount: "88.5000",
    customerId: "customer-secret",
    customerNameSnapshot: "Customer Secret",
    updatedAt: new Date("2026-07-22T00:00:00.000Z"),
  };
  const prisma = { customerInvoice: { findFirst: async () => row } };
  const readOnly = await loadAuthorizedSyncProjection({
    prisma,
    tenant: { operationalSettings: {} },
    actor: actor(["finance.customer_invoice.read"]),
    entityType: "CustomerInvoice",
    entityId: row.id,
    env: enabledFinance,
  });
  assert.equal(readOnly.id, row.id);
  assert.equal(readOnly.amount, null);
  assert.equal(readOnly.customerId, null);
  assert.equal(readOnly.customerNameSnapshot, null);

  const fullyVisible = await loadAuthorizedSyncProjection({
    prisma,
    tenant: { operationalSettings: {} },
    actor: actor(["finance.customer_invoice.read", "finance.amounts.read", "finance.partner_snapshot.read"]),
    entityType: "CustomerInvoice",
    entityId: row.id,
    env: enabledFinance,
  });
  assert.equal(fullyVisible.amount, "88.5000");
  assert.equal(fullyVisible.customerId, "customer-secret");
  assert.equal(fullyVisible.customerNameSnapshot, "Customer Secret");

  const createOnly = await loadAuthorizedSyncProjection({
    prisma,
    tenant: { operationalSettings: {} },
    actor: actor(["finance.customer_invoice.create", "finance.amounts.read", "finance.partner_snapshot.read"]),
    entityType: "CustomerInvoice",
    entityId: row.id,
    env: enabledFinance,
  });
  assert.equal(createOnly, null);
  assert.equal(await loadAuthorizedSyncProjection({ prisma, tenant: { operationalSettings: { modules: { finance: false } } }, actor: actor(["finance.customer_invoice.read"]), entityType: "CustomerInvoice", entityId: row.id, env: enabledFinance }), null);
  assert.equal(await loadAuthorizedSyncProjection({ prisma, tenant: { operationalSettings: {} }, actor: actor(["finance.customer_invoice.read"]), entityType: "CustomerInvoice", entityId: row.id, env: { ...enabledFinance, FLOWCHAIN_ENABLE_DB_OPERATIONAL_FINANCE: "false" } }), null);
  assert.equal(await loadAuthorizedSyncProjection({ prisma, tenant: { operationalSettings: {} }, actor: actor(["finance.customer_invoice.read"]), entityType: "UnknownEntity", entityId: row.id, env: enabledFinance }), null);
});

test("sync registry read boundaries reject create approve post and manage actions without an explicit exception", () => {
  assert.equal(validateMobileSyncEntityPolicy(), true);
  for (const action of ["create", "approve", "post", "manage"]) {
    assert.throws(
      () => validateMobileSyncEntityPolicy({ Broken: { requiredReadPermission: `module.entity.${action}` } }),
      /must be a read action/,
    );
  }
  assert.equal(validateMobileSyncEntityPolicy({ Exceptional: { requiredReadPermission: "legacy.entity.manage", readPermissionExceptionReason: "Documented legacy read boundary" } }), true);
});

test("warehouse tombstones enforce trusted tenant and warehouse scope and expose no old payload", async () => {
  const base = {
    prisma: {},
    tenant: { operationalSettings: {} },
    entityType: "ReceivingAttachment",
    entityId: "attachment-a",
    operation: "tombstone",
    env: enabledReceiving,
  };
  const warehouseA = actor(["receiving.read"], { readWarehouseIds: ["warehouse-a"] });
  const trusted = { tenantId: "tenant-a", resourceTenantId: "tenant-a", moduleKey: "receiving", authorizationClass: "receiving.read", scopeWarehouseIds: ["warehouse-a"] };
  assert.deepEqual(await loadAuthorizedSyncProjection({ ...base, actor: warehouseA, feedContext: trusted }), { id: "attachment-a", entityType: "ReceivingAttachment", tombstone: true });
  assert.equal(await loadAuthorizedSyncProjection({ ...base, actor: warehouseA, feedContext: { ...trusted, scopeWarehouseIds: ["warehouse-b"] } }), null);
  assert.equal(await loadAuthorizedSyncProjection({ ...base, actor: warehouseA, feedContext: { ...trusted, scopeWarehouseIds: [] } }), null);
  assert.equal(await loadAuthorizedSyncProjection({ ...base, actor: warehouseA, feedContext: { ...trusted, resourceTenantId: "tenant-b" } }), null);
  assert.deepEqual(await loadAuthorizedSyncProjection({ ...base, actor: actor(["receiving.read"], { allWarehouses: true }), feedContext: { ...trusted, scopeWarehouseIds: [] } }), { id: "attachment-a", entityType: "ReceivingAttachment", tombstone: true });
  assert.equal(await loadAuthorizedSyncProjection({ ...base, actor: actor(["receiving.read"], { allWarehouses: true }), feedContext: { ...trusted, resourceTenantId: null, scopeWarehouseIds: [] } }), null);
});

test("cursor key rotation verifies a cursor genuinely signed by the previous key", () => {
  const k1 = "previous-key-secret-that-is-at-least-32-characters";
  const k2 = "current-key-secret-that-is-at-least-32-characters";
  const claims = { issuedAt: 1_000, expiresAt: 9_000, tenantId: "tenant-a", userId: "user-a", clientId: "client-a", deviceIdHash: "device-a", lastSequence: "4", authorizationFingerprint: "fingerprint", snapshotSessionId: null };
  const previousCursor = issueCursor(claims, { NODE_ENV: "test", FLOWCHAIN_SYNC_CURSOR_CURRENT_KEY_ID: "k1", FLOWCHAIN_SYNC_CURSOR_CURRENT_SECRET: k1 });
  const rotated = { NODE_ENV: "test", FLOWCHAIN_SYNC_CURSOR_CURRENT_KEY_ID: "k2", FLOWCHAIN_SYNC_CURSOR_CURRENT_SECRET: k2, FLOWCHAIN_SYNC_CURSOR_PREVIOUS_KEYS: JSON.stringify({ k1 }) };
  assert.equal(verifyCursor(previousCursor, rotated, 2_000).keyId, "k1");
  assert.equal(verifyCursor(issueCursor(claims, rotated), rotated, 2_000).keyId, "k2");
  assert.throws(() => verifyCursor(previousCursor, { ...rotated, FLOWCHAIN_SYNC_CURSOR_PREVIOUS_KEYS: "{}" }, 2_000), (error) => error.code === "SYNC_CURSOR_KEY_UNKNOWN");
  assert.throws(() => verifyCursor(previousCursor.slice(0, -1) + (previousCursor.endsWith("a") ? "b" : "a"), rotated, 2_000), (error) => error.code === "SYNC_CURSOR_TAMPERED");
  assert.throws(() => verifyCursor(previousCursor, rotated, 10_000), (error) => error.code === "SYNC_CURSOR_EXPIRED");
  assert.throws(() => verifyCursor(previousCursor, { ...rotated, FLOWCHAIN_SYNC_CURSOR_PREVIOUS_KEYS: JSON.stringify({ k1: "weak" }) }, 2_000), (error) => error.code === "SYNC_CURSOR_KEY_WEAK");
});

test("database mode leaves the JSON procurement legacy runtime disabled unless explicitly enabled", async () => {
  const directory = await mkdtemp(join(tmpdir(), "flowchain-legacy-isolation-"));
  const sentinel = join(directory, "must-not-exist.json");
  try {
    const disabled = createDatabaseRepositoryRegistry({ env: { FLOWCHAIN_PERSISTENCE_MODE: "database", FLOWCHAIN_ENABLE_LEGACY_PROCUREMENT_RUNTIME: "false", FLOWCHAIN_PROCUREMENT_RUNTIME_FILE: sentinel }, prisma: {} });
    assert.equal(disabled.procurementLegacyRuntime, null);
    assert.equal(existsSync(sentinel), false);
    const enabled = createDatabaseRepositoryRegistry({ env: { FLOWCHAIN_PERSISTENCE_MODE: "database", FLOWCHAIN_ENABLE_LEGACY_PROCUREMENT_RUNTIME: "true", FLOWCHAIN_PROCUREMENT_RUNTIME_FILE: sentinel }, prisma: {} });
    assert.equal(enabled.procurementLegacyRuntime.adapter, "durable-procurement-runtime-v2");
    assert.equal(existsSync(sentinel), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
