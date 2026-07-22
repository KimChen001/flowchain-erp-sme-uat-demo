import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { backfillTenantAuthorization } from "../../server/auth/authorization-backfill.mjs";
import { createMobileSyncService } from "../../server/domain/mobile-sync-service.mjs";
import { createPrismaClient } from "../../server/persistence/prisma-client.mjs";

const env = process.env;
const tenantId = "tenant-phase-5-2c1-sync";
const adminId = "phase-5-2c1-admin";
const admin = { authenticated: true, tenantId, userId: adminId, role: "admin" };
const feedData = (entityType, entityId, operation = "upsert", version = 0) => ({
  tenantId,
  entityType,
  entityId,
  operation,
  entityVersion: version,
  source: "phase_5_2c1_test",
  payloadHash: createHash("sha256").update(`${entityType}:${entityId}:${operation}:${version}`).digest("hex"),
  sensitivityGroups: [],
  moduleKey: entityType === "CustomerInvoice" ? "finance" : "procurement",
  authorizationClass: entityType === "CustomerInvoice" ? "finance.customer_invoice.read" : "procurement.purchase_order.read",
  resourceTenantId: tenantId,
});

async function createCustomActor(prisma, suffix, permissions) {
  const userId = `sync-${suffix}-user`, roleId = `sync-${suffix}-role`;
  await prisma.user.create({ data: { id: userId, tenantId, email: `${suffix}@phase-5-2c1.invalid`, name: suffix, role: "custom" } });
  await prisma.tenantRole.create({ data: { id: roleId, tenantId, roleKey: `sync-${suffix}`, name: suffix } });
  await prisma.tenantRolePermission.createMany({ data: permissions.map((permissionCode, index) => ({ id: `${roleId}-permission-${index}`, tenantId, roleId, permissionCode })) });
  await prisma.userRoleAssignment.create({ data: { id: `${roleId}-assignment`, tenantId, userId, roleId } });
  return { authenticated: true, tenantId, userId, role: "custom" };
}

async function collectInitial(service, registration, identity, pageSize = 50) {
  const responses = [];
  let response = await service.initial({ clientId: registration.clientId, deviceId: registration.rawDeviceId, pageSize }, { identity });
  responses.push(response);
  while (response.hasMore) {
    response = await service.initial({ clientId: registration.clientId, deviceId: registration.rawDeviceId, snapshotSessionId: response.snapshotSessionId, snapshotCursor: response.snapshotCursor }, { identity });
    responses.push(response);
  }
  return { responses, changes: responses.flatMap((item) => item.changes), cursor: responses.at(-1).cursor };
}

function registration(value, rawDeviceId) {
  return { ...value, rawDeviceId };
}

test("real PostgreSQL mobile sync controls", async (t) => {
  const prisma = await createPrismaClient(env);
  try {
    await prisma.tenant.create({ data: { id: tenantId, name: "Phase 5.2C.1 Sync Controls" } });
    await prisma.warehouse.createMany({ data: [
      { id: "sync-warehouse-a", tenantId, code: "SYNC-A", name: "Sync Warehouse A" },
      { id: "sync-warehouse-b", tenantId, code: "SYNC-B", name: "Sync Warehouse B" },
    ] });
    await prisma.user.create({ data: { id: adminId, tenantId, email: "admin@phase-5-2c1.invalid", name: "Admin", role: "admin" } });
    await backfillTenantAuthorization(prisma, tenantId, { actorId: adminId });
    const readOnly = await createCustomActor(prisma, "read-only", ["mobile.sync.use", "finance.customer_invoice.read"]);
    const createOnly = await createCustomActor(prisma, "create-only", ["mobile.sync.use", "finance.customer_invoice.create", "finance.amounts.read", "finance.partner_snapshot.read"]);

    await prisma.item.create({ data: { id: "sync-item", tenantId, sku: "SYNC-ITEM", name: "Sync Item" } });
    await prisma.salesOrder.create({ data: { id: "sync-sales-order", tenantId, orderNumber: "SO-SYNC", customerId: "sync-customer", customerName: "Sync Customer", currency: "CNY" } });
    await prisma.shipmentDocument.create({ data: { id: "sync-shipment", tenantId, shipmentNumber: "SHIP-SYNC", salesOrderId: "sync-sales-order", workflowStatus: "ready", postingStatus: "posted" } });
    await prisma.customerInvoice.create({ data: { id: "sync-customer-invoice", tenantId, invoiceNumber: "CI-SYNC", salesOrderId: "sync-sales-order", shipmentId: "sync-shipment", customerId: "sync-customer", customerNameSnapshot: "Sync Customer", invoiceDate: new Date("2026-07-22"), dueDate: new Date("2026-08-22"), subtotalAmount: "88.5000", totalAmount: "88.5000", currency: "CNY", status: "issued" } });

    await t.test("read-only CustomerInvoice users sync redacted data while create-only users get neither projection nor tombstone", async () => {
      const service = createMobileSyncService({ prisma, env });
      const readDevice = "customer-invoice-read-device";
      const createDevice = "customer-invoice-create-device";
      const readRegistration = registration(await service.register({ deviceId: readDevice, platform: "pwa" }, { identity: readOnly }), readDevice);
      const createRegistration = registration(await service.register({ deviceId: createDevice, platform: "pwa" }, { identity: createOnly }), createDevice);
      const readInitial = await collectInitial(service, readRegistration, readOnly);
      const createInitial = await collectInitial(service, createRegistration, createOnly);
      const readProjection = readInitial.changes.find((item) => item.entityType === "CustomerInvoice" && item.entityId === "sync-customer-invoice")?.projection;
      assert.ok(readProjection);
      assert.equal(readProjection.amount, null);
      assert.equal(readProjection.customerId, null);
      assert.equal(createInitial.changes.some((item) => item.entityType === "CustomerInvoice"), false);

      await prisma.domainChangeFeed.create({ data: feedData("CustomerInvoice", "sync-customer-invoice", "tombstone", 1) });
      const readIncremental = await service.changes({ clientId: readRegistration.clientId, deviceId: readDevice, cursor: readInitial.cursor }, { identity: readOnly });
      const createIncremental = await service.changes({ clientId: createRegistration.clientId, deviceId: createDevice, cursor: createInitial.cursor }, { identity: createOnly });
      assert.deepEqual(readIncremental.changes.at(-1).projection, { id: "sync-customer-invoice", entityType: "CustomerInvoice", tombstone: true });
      assert.equal(createIncremental.changes.some((item) => item.entityType === "CustomerInvoice"), false);
    });

    await t.test("keyset initial sync converges with concurrent lower/higher inserts and updates", async () => {
      for (const id of ["PO-B", "PO-C", "PO-D"]) await prisma.purchaseOrder.create({ data: { id, tenantId, status: "pending_approval", supplierId: "supplier-sync", supplierName: "Sync Supplier", amount: "10.0000", currency: "CNY", version: 0 } });
      const service = createMobileSyncService({ prisma, env });
      const deviceId = "keyset-device";
      const registered = registration(await service.register({ deviceId, platform: "pwa" }, { identity: admin }), deviceId);
      const first = await service.initial({ clientId: registered.clientId, deviceId, pageSize: 2 }, { identity: admin });
      assert.equal(first.hasMore, true);
      assert.equal(first.nextEntityType, "PurchaseOrder");
      assert.equal(first.lastId, "PO-C");
      assert.equal(first.consistencyContract, "convergent_keyset_initial_sync");

      await prisma.purchaseOrder.create({ data: { id: "PO-A", tenantId, status: "pending_approval", supplierName: "Lower Insert", amount: "11.0000", currency: "CNY", version: 0 } });
      await prisma.domainChangeFeed.create({ data: feedData("PurchaseOrder", "PO-A", "upsert", 0) });
      await prisma.purchaseOrder.create({ data: { id: "PO-Z", tenantId, status: "pending_approval", supplierName: "Higher Insert", amount: "12.0000", currency: "CNY", version: 0 } });
      await prisma.domainChangeFeed.create({ data: feedData("PurchaseOrder", "PO-Z", "upsert", 0) });
      for (const id of ["PO-B", "PO-D"]) {
        const updated = await prisma.purchaseOrder.update({ where: { id }, data: { status: "approved", version: { increment: 1 } } });
        await prisma.domainChangeFeed.create({ data: feedData("PurchaseOrder", id, "upsert", updated.version) });
      }

      const snapshotChanges = [...first.changes];
      let page = first;
      while (page.hasMore) {
        page = await service.initial({ clientId: registered.clientId, deviceId, snapshotSessionId: page.snapshotSessionId, snapshotCursor: page.snapshotCursor }, { identity: admin });
        snapshotChanges.push(...page.changes);
      }
      const incremental = await service.changes({ clientId: registered.clientId, deviceId, cursor: page.cursor }, { identity: admin });
      const clientState = new Map();
      for (const change of [...snapshotChanges, ...incremental.changes]) {
        if (change.entityType !== "PurchaseOrder") continue;
        const previous = clientState.get(change.entityId);
        if (!previous || Number(change.projection.version ?? -1) >= Number(previous.version ?? -1)) clientState.set(change.entityId, change.projection);
      }
      const serverRows = await prisma.purchaseOrder.findMany({ where: { tenantId }, orderBy: { id: "asc" } });
      assert.deepEqual([...clientState.keys()].sort(), serverRows.map((row) => row.id));
      for (const row of serverRows) {
        assert.equal(clientState.get(row.id).status, row.status);
        assert.equal(clientState.get(row.id).version, row.version);
      }
      assert.ok(snapshotChanges.filter((change) => change.entityId === "PO-Z").length + incremental.changes.filter((change) => change.entityId === "PO-Z").length >= 2);

      const expiring = await service.initial({ clientId: registered.clientId, deviceId, pageSize: 1 }, { identity: admin });
      await prisma.syncSnapshotSession.update({ where: { id: expiring.snapshotSessionId }, data: { expiresAt: new Date("2000-01-01T00:00:00.000Z") } });
      await assert.rejects(() => service.initial({ clientId: registered.clientId, deviceId, snapshotSessionId: expiring.snapshotSessionId, snapshotCursor: expiring.snapshotCursor }, { identity: admin }), (error) => error.code === "SYNC_SNAPSHOT_EXPIRED");

      const invalidated = await service.initial({ clientId: registered.clientId, deviceId, pageSize: 1 }, { identity: admin });
      await prisma.tenant.update({ where: { id: tenantId }, data: { version: { increment: 1 } } });
      const reset = await service.initial({ clientId: registered.clientId, deviceId, snapshotSessionId: invalidated.snapshotSessionId, snapshotCursor: invalidated.snapshotCursor }, { identity: admin });
      assert.equal(reset.code, "SYNC_AUTHORIZATION_CHANGED");
      assert.equal((await prisma.syncSnapshotSession.findUnique({ where: { id: invalidated.snapshotSessionId } })).status, "invalidated");
      await assert.rejects(() => service.initial({ clientId: registered.clientId, deviceId, snapshotSessionId: "wrong-session", snapshotCursor: invalidated.snapshotCursor }, { identity: admin }), (error) => error.code === "SYNC_SNAPSHOT_SCOPE_MISMATCH");
    });

    await t.test("acknowledgements remain monotonic under real concurrent PostgreSQL requests", async () => {
      for (let index = 0; index < 25; index += 1) await prisma.domainChangeFeed.create({ data: feedData("UnknownEntity", `ack-${index}`) });
      const service = createMobileSyncService({ prisma, env });
      const deviceId = "ack-device";
      const registered = registration(await service.register({ deviceId, platform: "pwa" }, { identity: admin }), deviceId);
      const claims = (lastSequence, overrides = {}) => ({ tenantId, userId: adminId, clientId: registered.clientId, deviceIdHash: registered.deviceIdHash, lastSequence: String(lastSequence), authorizationFingerprint: registered.authorizationFingerprint, snapshotSessionId: null, ...overrides });
      const cursor20 = service.issueCursor(claims(20));
      const cursor10 = service.issueCursor(claims(10));
      const concurrent = await Promise.allSettled([
        service.acknowledge({ clientId: registered.clientId, deviceId, cursor: cursor20 }, { identity: admin }),
        service.acknowledge({ clientId: registered.clientId, deviceId, cursor: cursor10 }, { identity: admin }),
      ]);
      assert.ok(concurrent.some((result) => result.status === "fulfilled"));
      assert.equal(String((await prisma.syncClient.findUnique({ where: { id: registered.clientId } })).lastAcknowledgedSequence), "20");
      assert.equal((await service.acknowledge({ clientId: registered.clientId, deviceId, cursor: cursor20 }, { identity: admin })).acknowledgedSequence, "20");
      await assert.rejects(() => service.acknowledge({ clientId: registered.clientId, deviceId, cursor: cursor10 }, { identity: admin }), (error) => error.code === "SYNC_ACKNOWLEDGEMENT_REGRESSION");
      await assert.rejects(() => service.acknowledge({ clientId: registered.clientId, deviceId: "wrong-device", cursor: cursor20 }, { identity: admin }), (error) => error.code === "SYNC_DEVICE_MISMATCH");
      await assert.rejects(() => service.acknowledge({ clientId: registered.clientId, deviceId, cursor: service.issueCursor(claims(999_999)) }, { identity: admin }), (error) => error.code === "SYNC_CURSOR_SEQUENCE_INVALID");
      await assert.rejects(() => service.acknowledge({ clientId: registered.clientId, deviceId, cursor: service.issueCursor(claims(20, { expiresAt: Date.now() - 1 })) }, { identity: admin }), (error) => error.code === "SYNC_CURSOR_EXPIRED");

      const authorizationCursor = service.issueCursor(claims(20));
      await prisma.tenant.update({ where: { id: tenantId }, data: { version: { increment: 1 } } });
      await assert.rejects(() => service.acknowledge({ clientId: registered.clientId, deviceId, cursor: authorizationCursor }, { identity: admin }), (error) => error.code === "SYNC_AUTHORIZATION_CHANGED" && error.details?.resetRequired === true);

      const revokedDevice = "revoked-device";
      const revoked = registration(await service.register({ deviceId: revokedDevice, platform: "pwa" }, { identity: admin }), revokedDevice);
      const revokedCursor = service.issueCursor({ ...claims(20), clientId: revoked.clientId, deviceIdHash: revoked.deviceIdHash, authorizationFingerprint: revoked.authorizationFingerprint });
      await service.revoke(revoked.clientId, { deviceId: revokedDevice }, { identity: admin });
      await assert.rejects(() => service.acknowledge({ clientId: revoked.clientId, deviceId: revokedDevice, cursor: revokedCursor }, { identity: admin }), (error) => error.code === "SYNC_CLIENT_REVOKED");
    });
  } finally {
    await prisma.$disconnect();
  }
});
