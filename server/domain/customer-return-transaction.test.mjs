import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  createCustomerReturnCommandService,
  CustomerReturnCommandError,
} from "./customer-return-command-service.mjs";
import { createSupplierReturnCommandService } from "./supplier-return-command-service.mjs";
import { createPrismaClient } from "../persistence/prisma-client.mjs";

const databaseUrl =
  process.env.DATABASE_URL_TEST || process.env.DATABASE_URL || "";
const enabled = Boolean(databaseUrl);
const tenantId = "tenant-customer-return-b3";
const otherTenantId = "tenant-customer-return-other-b3";
const warehouseId = "warehouse-customer-return-b3";
const itemId = "item-customer-return-b3";
const managerId = "manager-customer-return-b3";
const scopedUserId = "scoped-customer-return-b3";
const viewerId = "viewer-customer-return-b3";
const otherManagerId = "manager-customer-return-other-b3";
const sku = "CUST-RET-B3";
const availableBalanceId = "available-customer-return-b3";
const quarantineBalanceId = "quarantine-customer-return-b3";
const lineageBalanceId = "quarantine-lineage-customer-return-b3";
const env = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  DATABASE_URL_TEST: databaseUrl,
  FLOWCHAIN_PERSISTENCE_MODE: "database",
  FLOWCHAIN_ENABLE_DB_RETURNS_QUARANTINE: "true",
  FLOWCHAIN_ALLOW_LOCAL_ACTOR_BOOTSTRAP: "false",
  NODE_ENV: "test",
};
const identity = (userId, role, currentTenantId = tenantId) => ({
  authenticated: true,
  tenantId: currentTenantId,
  userId,
  role,
  source: "test",
});
const manager = { identity: identity(managerId, "manager") };

async function seed(prisma) {
  await prisma.tenant.createMany({
    data: [
      { id: tenantId, name: "Customer Return B3" },
      { id: otherTenantId, name: "Customer Return Other B3" },
    ],
  });
  await prisma.warehouse.create({
    data: {
      id: warehouseId,
      tenantId,
      code: "CUST-RET-B3",
      name: "Customer Return Warehouse",
    },
  });
  for (const user of [
    {
      id: managerId,
      tenantId,
      email: "manager-customer-b3@flowchain.invalid",
      name: "Manager",
      role: "manager",
    },
    {
      id: scopedUserId,
      tenantId,
      email: "scoped-customer-b3@flowchain.invalid",
      name: "Scoped",
      role: "business-specialist",
    },
    {
      id: viewerId,
      tenantId,
      email: "viewer-customer-b3@flowchain.invalid",
      name: "Viewer",
      role: "viewer",
    },
    {
      id: otherManagerId,
      tenantId: otherTenantId,
      email: "other-customer-b3@flowchain.invalid",
      name: "Other",
      role: "manager",
    },
  ])
    await prisma.user.create({ data: user });
  await prisma.userWarehouseScope.createMany({
    data: [
      {
        id: randomUUID(),
        tenantId,
        userId: managerId,
        warehouseId,
        accessLevel: "operate",
      },
      {
        id: randomUUID(),
        tenantId,
        userId: scopedUserId,
        warehouseId,
        accessLevel: "read",
      },
      {
        id: randomUUID(),
        tenantId,
        userId: viewerId,
        warehouseId,
        accessLevel: "read",
      },
    ],
  });
  await prisma.item.create({
    data: {
      id: itemId,
      tenantId,
      sku,
      name: "Customer Return Item",
      unit: "EA",
    },
  });
  await prisma.inventoryBalance.create({
    data: {
      id: availableBalanceId,
      tenantId,
      itemId,
      sku,
      itemName: "Customer Return Item",
      warehouseId,
      warehouseKey: warehouseId,
      location: "A-01",
      locationKey: "a-01",
      onHandQuantity: "10",
      reservedQuantity: "2",
      availableQuantity: "8",
      unit: "EA",
      status: "available",
    },
  });
  await prisma.quarantineInventoryBalance.createMany({
    data: [
      {
        id: quarantineBalanceId,
        tenantId,
        itemId,
        sku,
        itemName: "Customer Return Item",
        warehouseId,
        warehouseKey: warehouseId,
        location: "Q-01",
        locationKey: "q-01",
        onHandQuantity: "1",
        unit: "EA",
      },
      {
        id: lineageBalanceId,
        tenantId,
        itemId,
        sku,
        itemName: "Customer Return Item",
        warehouseId,
        warehouseKey: warehouseId,
        location: "Q-02",
        locationKey: "q-02",
        onHandQuantity: "0",
        unit: "EA",
      },
    ],
  });
}

async function createAuthorization(
  prisma,
  {
    suffix,
    returnType = "customer_return",
    route = "receive_to_quarantine",
    quantity = "2",
  },
) {
  const quantities = Array.isArray(quantity) ? quantity : [quantity];
  const requestId = `request-customer-b3-${suffix}`;
  const authorizationId = `authorization-customer-b3-${suffix}`;
  await prisma.returnRequest.create({
    data: {
      id: requestId,
      tenantId,
      requestNumber: `RET-B3-${suffix}`,
      returnType,
      partnerId:
        returnType === "customer_return" ? "customer-b3" : "supplier-b3",
      partnerNameSnapshot:
        returnType === "customer_return" ? "Customer B3" : "Supplier B3",
      sourceDocumentType:
        returnType === "customer_return"
          ? "ShipmentDocument"
          : "ReceivingDocument",
      sourceDocumentId: `source-b3-${suffix}`,
      sourceDocumentNumber: `SOURCE-B3-${suffix}`,
      reasonCode: "governed_return",
      workflowStatus: "authorized",
      requestedById: managerId,
      submittedAt: new Date(),
      submittedById: managerId,
      lines: {
        create: quantities.map((lineQuantity, index) => ({
          id: `request-line-customer-b3-${suffix}-${index + 1}`,
          sourceDocumentType:
            returnType === "customer_return"
              ? "ShipmentDocument"
              : "ReceivingDocument",
          sourceDocumentId: `source-b3-${suffix}`,
          sourceDocumentLineId: `source-line-b3-${suffix}-${index + 1}`,
          sourceQuantity: "20",
          sourceWarehouseIds: [warehouseId],
          itemId,
          sku,
          itemName: "Customer Return Item",
          requestedQuantity: lineQuantity,
          unit: "EA",
          reasonCode: "governed_return",
        })),
      },
    },
  });
  return prisma.returnAuthorization.create({
    data: {
      id: authorizationId,
      tenantId,
      authorizationNumber: `AUTH-B3-${suffix}`,
      returnRequestId: requestId,
      workflowStatus: "approved",
      authorizedAt: new Date(),
      authorizedById: managerId,
      lines: {
        create: quantities.map((lineQuantity, index) => ({
          id: `authorization-line-customer-b3-${suffix}-${index + 1}`,
          returnRequestLineId: `request-line-customer-b3-${suffix}-${index + 1}`,
          authorizedQuantity: lineQuantity,
          dispositionRoute: route,
        })),
      },
    },
    include: { lines: true, returnRequest: true },
  });
}

const customerLines = (authorization, quantity, balanceId) => [
  {
    returnAuthorizationLineId: authorization.lines[0].id,
    quantity,
    quarantineBalanceId: balanceId,
  },
];

async function versions(prisma, postingId, authorization) {
  const [posting, auth, request] = await Promise.all([
    prisma.returnPostingDocument.findUnique({ where: { id: postingId } }),
    prisma.returnAuthorization.findUnique({
      where: { id: authorization.id },
    }),
    prisma.returnRequest.findUnique({
      where: { id: authorization.returnRequestId },
    }),
  ]);
  return { posting, auth, request };
}

async function createReadyCustomerReceipt(
  service,
  authorization,
  {
    suffix,
    quantity,
    balanceId = quarantineBalanceId,
  },
) {
  const draft = await service.createDraft(
    {
      authorizationId: authorization.id,
      postingNumber: `POST-CUST-B3-${suffix}`,
      expectedAuthorizationVersion: authorization.version,
      lines: customerLines(authorization, quantity, balanceId),
      idempotencyKey: `create-customer-b3-${suffix}`,
    },
    manager,
  );
  await service.readyPosting(
    draft.entityId,
    {
      expectedPostingVersion: draft.posting.version,
      idempotencyKey: `ready-customer-b3-${suffix}`,
    },
    manager,
  );
  return draft;
}

async function postCustomer(
  service,
  prisma,
  draft,
  authorization,
  suffix,
) {
  const current = await versions(prisma, draft.entityId, authorization);
  return service.postReceipt(
    draft.entityId,
    {
      expectedPostingVersion: current.posting.version,
      expectedAuthorizationVersion: current.auth.version,
      expectedRequestVersion: current.request.version,
      idempotencyKey: `post-customer-b3-${suffix}`,
    },
    manager,
  );
}

async function reverseCustomer(
  service,
  prisma,
  draft,
  authorization,
  suffix,
) {
  const current = await versions(prisma, draft.entityId, authorization);
  return service.reverseReceipt(
    draft.entityId,
    {
      expectedPostingVersion: current.posting.version,
      expectedAuthorizationVersion: current.auth.version,
      expectedRequestVersion: current.request.version,
      reason: "Governed customer receipt reversal",
      idempotencyKey: `reverse-customer-b3-${suffix}`,
    },
    manager,
  );
}

test(
  "customer return receipt is quarantine-only, cumulative, concurrent, idempotent, scoped, lineage-safe, and reversible",
  { skip: !enabled },
  async () => {
    const prisma = await createPrismaClient({
      ...env,
      DATABASE_URL: databaseUrl,
    });
    const prismaB = await createPrismaClient({
      ...env,
      DATABASE_URL: databaseUrl,
    });
    const service = createCustomerReturnCommandService({ prisma, env });
    const serviceB = createCustomerReturnCommandService({
      prisma: prismaB,
      env,
    });
    const supplierService = createSupplierReturnCommandService({
      prisma,
      env,
    });
    try {
      await seed(prisma);
      const availableBefore = await prisma.inventoryBalance.findUnique({
        where: { id: availableBalanceId },
      });

      const aggregateAuthorization = await createAuthorization(prisma, {
        suffix: "AGGREGATE",
        quantity: ["0.5000", "1.5000"],
      });
      const aggregateDraft = await service.createDraft(
        {
          authorizationId: aggregateAuthorization.id,
          postingNumber: "POST-CUST-B3-AGGREGATE",
          expectedAuthorizationVersion: 0,
          lines: aggregateAuthorization.lines.map((line, index) => ({
            returnAuthorizationLineId: line.id,
            quantity: index === 0 ? "0.5000" : "1.5000",
            quarantineBalanceId,
          })),
          idempotencyKey: "create-customer-b3-AGGREGATE",
        },
        manager,
      );
      await service.readyPosting(
        aggregateDraft.entityId,
        {
          expectedPostingVersion: 0,
          idempotencyKey: "ready-customer-b3-AGGREGATE",
        },
        manager,
      );
      await postCustomer(
        service,
        prisma,
        aggregateDraft,
        aggregateAuthorization,
        "AGGREGATE",
      );
      let aggregateBalance =
        await prisma.quarantineInventoryBalance.findUnique({
          where: { id: quarantineBalanceId },
        });
      assert.equal(String(aggregateBalance.onHandQuantity), "3");
      assert.equal(aggregateBalance.version, 1);
      await reverseCustomer(
        service,
        prisma,
        aggregateDraft,
        aggregateAuthorization,
        "AGGREGATE",
      );
      aggregateBalance = await prisma.quarantineInventoryBalance.findUnique({
        where: { id: quarantineBalanceId },
      });
      assert.equal(String(aggregateBalance.onHandQuantity), "1");
      assert.equal(aggregateBalance.version, 2);

      const cumulativeAuthorization = await createAuthorization(prisma, {
        suffix: "CUMULATIVE",
        quantity: "3",
      });
      const first = await createReadyCustomerReceipt(
        service,
        cumulativeAuthorization,
        { suffix: "CUMULATIVE-1", quantity: "2" },
      );
      const firstPosted = await postCustomer(
        service,
        prisma,
        first,
        cumulativeAuthorization,
        "CUMULATIVE-1",
      );
      assert.equal(
        firstPosted.returnAuthorization.workflowStatus,
        "partially_executed",
      );
      let quarantine = await prisma.quarantineInventoryBalance.findUnique({
        where: { id: quarantineBalanceId },
      });
      assert.equal(String(quarantine.onHandQuantity), "3");
      let available = await prisma.inventoryBalance.findUnique({
        where: { id: availableBalanceId },
      });
      assert.deepEqual(
        {
          onHand: String(available.onHandQuantity),
          reserved: String(available.reservedQuantity),
          available: String(available.availableQuantity),
          version: available.version,
        },
        {
          onHand: String(availableBefore.onHandQuantity),
          reserved: String(availableBefore.reservedQuantity),
          available: String(availableBefore.availableQuantity),
          version: availableBefore.version,
        },
      );
      const firstReplay = await service.postReceipt(
        first.entityId,
        {
          expectedPostingVersion: 1,
          expectedAuthorizationVersion: 0,
          expectedRequestVersion: 0,
          idempotencyKey: "post-customer-b3-CUMULATIVE-1",
        },
        manager,
      );
      assert.equal(firstReplay.idempotentReplay, true);
      await assert.rejects(
        service.postReceipt(
          first.entityId,
          {
            expectedPostingVersion: 2,
            expectedAuthorizationVersion: 1,
            expectedRequestVersion: 1,
            idempotencyKey: "post-customer-b3-CUMULATIVE-1",
          },
          manager,
        ),
        (error) =>
          error instanceof CustomerReturnCommandError &&
          error.code === "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD",
      );

      const refreshedCumulative = await prisma.returnAuthorization.findUnique({
        where: { id: cumulativeAuthorization.id },
        include: { lines: true, returnRequest: true },
      });
      const second = await createReadyCustomerReceipt(
        service,
        refreshedCumulative,
        { suffix: "CUMULATIVE-2", quantity: "1" },
      );
      const secondPosted = await postCustomer(
        service,
        prisma,
        second,
        refreshedCumulative,
        "CUMULATIVE-2",
      );
      assert.equal(
        secondPosted.returnAuthorization.workflowStatus,
        "executed",
      );
      quarantine = await prisma.quarantineInventoryBalance.findUnique({
        where: { id: quarantineBalanceId },
      });
      assert.equal(String(quarantine.onHandQuantity), "4");
      await reverseCustomer(
        service,
        prisma,
        second,
        refreshedCumulative,
        "CUMULATIVE-2",
      );
      quarantine = await prisma.quarantineInventoryBalance.findUnique({
        where: { id: quarantineBalanceId },
      });
      assert.equal(String(quarantine.onHandQuantity), "3");

      const integrityAuthorization = await createAuthorization(prisma, {
        suffix: "INTEGRITY",
        quantity: "1",
      });
      const integrity = await createReadyCustomerReceipt(
        service,
        integrityAuthorization,
        { suffix: "INTEGRITY", quantity: "1" },
      );
      await postCustomer(
        service,
        prisma,
        integrity,
        integrityAuthorization,
        "INTEGRITY",
      );
      const originalMovement = await prisma.inventoryMovement.findFirst({
        where: {
          sourceDocumentId: integrity.entityId,
          movementType: "customer_return_quarantine_in",
        },
      });
      await prisma.inventoryMovement.update({
        where: { id: originalMovement.id },
        data: {
          metadata: {
            ...originalMovement.metadata,
            balanceId: "tampered-balance",
          },
        },
      });
      await assert.rejects(
        reverseCustomer(
          service,
          prisma,
          integrity,
          integrityAuthorization,
          "INTEGRITY-UNSAFE",
        ),
        (error) =>
          error instanceof CustomerReturnCommandError &&
          error.code === "RETURN_REVERSAL_NOT_SAFE",
      );
      await prisma.inventoryMovement.update({
        where: { id: originalMovement.id },
        data: { metadata: originalMovement.metadata },
      });
      await reverseCustomer(
        service,
        prisma,
        integrity,
        integrityAuthorization,
        "INTEGRITY-CLEANUP",
      );

      const concurrentAuthorization = await createAuthorization(prisma, {
        suffix: "CONCURRENT",
        quantity: "2",
      });
      const concurrentDrafts = [];
      for (const suffix of ["CONCURRENT-1", "CONCURRENT-2"])
        concurrentDrafts.push(
          await createReadyCustomerReceipt(
            service,
            concurrentAuthorization,
            { suffix, quantity: "2" },
          ),
        );
      const concurrentVersions = await versions(
        prisma,
        concurrentDrafts[0].entityId,
        concurrentAuthorization,
      );
      const concurrent = await Promise.allSettled([
        service.postReceipt(
          concurrentDrafts[0].entityId,
          {
            expectedPostingVersion: 1,
            expectedAuthorizationVersion: concurrentVersions.auth.version,
            expectedRequestVersion: concurrentVersions.request.version,
            idempotencyKey: "post-customer-b3-CONCURRENT-1",
          },
          manager,
        ),
        serviceB.postReceipt(
          concurrentDrafts[1].entityId,
          {
            expectedPostingVersion: 1,
            expectedAuthorizationVersion: concurrentVersions.auth.version,
            expectedRequestVersion: concurrentVersions.request.version,
            idempotencyKey: "post-customer-b3-CONCURRENT-2",
          },
          manager,
        ),
      ]);
      assert.equal(
        concurrent.filter((entry) => entry.status === "fulfilled").length,
        1,
      );
      assert.equal(
        concurrent.filter((entry) => entry.status === "rejected").length,
        1,
      );

      const lineageAuthorization = await createAuthorization(prisma, {
        suffix: "LINEAGE",
        quantity: "2",
      });
      const lineageReceipt = await createReadyCustomerReceipt(
        service,
        lineageAuthorization,
        { suffix: "LINEAGE", quantity: "2", balanceId: lineageBalanceId },
      );
      await postCustomer(
        service,
        prisma,
        lineageReceipt,
        lineageAuthorization,
        "LINEAGE",
      );
      const supplierAuthorization = await createAuthorization(prisma, {
        suffix: "LINEAGE-SUPPLIER",
        returnType: "supplier_return",
        route: "return_from_quarantine",
        quantity: "1",
      });
      const supplierDraft = await supplierService.createPostingDraft(
        {
          authorizationId: supplierAuthorization.id,
          postingNumber: "POST-SUPPLIER-B3-LINEAGE",
          expectedAuthorizationVersion: 0,
          lines: [
            {
              returnAuthorizationLineId: supplierAuthorization.lines[0].id,
              quantity: "1",
              quarantineBalanceId: lineageBalanceId,
            },
          ],
          idempotencyKey: "create-supplier-b3-lineage",
        },
        manager,
      );
      await supplierService.readyPosting(
        supplierDraft.entityId,
        {
          expectedPostingVersion: 0,
          idempotencyKey: "ready-supplier-b3-lineage",
        },
        manager,
      );
      let supplierCurrent = await versions(
        prisma,
        supplierDraft.entityId,
        supplierAuthorization,
      );
      await supplierService.postSupplierReturn(
        supplierDraft.entityId,
        {
          expectedPostingVersion: supplierCurrent.posting.version,
          expectedAuthorizationVersion: supplierCurrent.auth.version,
          expectedRequestVersion: supplierCurrent.request.version,
          idempotencyKey: "post-supplier-b3-lineage",
        },
        manager,
      );
      assert.equal(
        await prisma.quarantineDispositionAllocation.count({
          where: {
            tenantId,
            quarantineBalanceId: lineageBalanceId,
            status: "active",
          },
        }),
        1,
      );
      await assert.rejects(
        reverseCustomer(
          service,
          prisma,
          lineageReceipt,
          lineageAuthorization,
          "LINEAGE-BLOCKED",
        ),
        (error) =>
          error instanceof CustomerReturnCommandError &&
          error.code === "RETURN_REVERSAL_NOT_SAFE",
      );
      supplierCurrent = await versions(
        prisma,
        supplierDraft.entityId,
        supplierAuthorization,
      );
      await supplierService.reverseSupplierReturn(
        supplierDraft.entityId,
        {
          expectedPostingVersion: supplierCurrent.posting.version,
          expectedAuthorizationVersion: supplierCurrent.auth.version,
          expectedRequestVersion: supplierCurrent.request.version,
          reason: "Restore lineage inventory",
          idempotencyKey: "reverse-supplier-b3-lineage",
        },
        manager,
      );
      await reverseCustomer(
        service,
        prisma,
        lineageReceipt,
        lineageAuthorization,
        "LINEAGE-SAFE",
      );

      const scopeAuthorization = await createAuthorization(prisma, {
        suffix: "SCOPE",
        quantity: "1",
      });
      await assert.rejects(
        service.createDraft(
          {
            authorizationId: scopeAuthorization.id,
            postingNumber: "POST-CUSTOMER-B3-SCOPE",
            expectedAuthorizationVersion: 0,
            lines: customerLines(
              scopeAuthorization,
              "1",
              quarantineBalanceId,
            ),
            idempotencyKey: "create-customer-b3-scope",
          },
          {
            identity: identity(
              scopedUserId,
              "business-specialist",
            ),
          },
        ),
        (error) => error.code === "WAREHOUSE_SCOPE_DENIED",
      );
      await assert.rejects(
        service.createDraft(
          {
            authorizationId: scopeAuthorization.id,
            postingNumber: "POST-CUSTOMER-B3-VIEWER",
            expectedAuthorizationVersion: 0,
            lines: customerLines(
              scopeAuthorization,
              "1",
              quarantineBalanceId,
            ),
            idempotencyKey: "create-customer-b3-viewer",
          },
          { identity: identity(viewerId, "viewer") },
        ),
        (error) => error.code === "AUTHORIZATION_PERMISSION_DENIED",
      );
      await assert.rejects(
        service.createDraft(
          {
            authorizationId: scopeAuthorization.id,
            postingNumber: "POST-CUSTOMER-B3-CROSS-TENANT",
            expectedAuthorizationVersion: 0,
            lines: customerLines(
              scopeAuthorization,
              "1",
              quarantineBalanceId,
            ),
            idempotencyKey: "create-customer-b3-cross-tenant",
          },
          {
            identity: identity(
              otherManagerId,
              "manager",
              otherTenantId,
            ),
          },
        ),
        (error) =>
          error instanceof CustomerReturnCommandError &&
          error.code === "RETURN_AUTHORIZATION_NOT_FOUND",
      );

      available = await prisma.inventoryBalance.findUnique({
        where: { id: availableBalanceId },
      });
      assert.deepEqual(
        {
          onHand: String(available.onHandQuantity),
          reserved: String(available.reservedQuantity),
          available: String(available.availableQuantity),
          version: available.version,
        },
        {
          onHand: String(availableBefore.onHandQuantity),
          reserved: String(availableBefore.reservedQuantity),
          available: String(availableBefore.availableQuantity),
          version: availableBefore.version,
        },
      );
      assert.equal(
        await prisma.inventoryMovement.count({
          where: {
            tenantId,
            movementType: "customer_return_quarantine_in",
          },
        }) > 0,
        true,
      );
      assert.equal(
        await prisma.inventoryMovement.count({
          where: {
            tenantId,
            movementType: "customer_return_receipt_reversal",
          },
        }) > 0,
        true,
      );
    } finally {
      await prismaB.$disconnect();
      await prisma.$disconnect();
    }
  },
);
