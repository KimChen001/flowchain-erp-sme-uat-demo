import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  createSupplierReturnCommandService,
  SupplierReturnCommandError,
} from "./supplier-return-command-service.mjs";
import { createSupplierReturnReadService } from "./supplier-return-read-service.mjs";
import { createPrismaClient } from "../persistence/prisma-client.mjs";

const databaseUrl =
  process.env.DATABASE_URL_TEST || process.env.DATABASE_URL || "";
const enabled = Boolean(databaseUrl);
const tenantId = "tenant-supplier-return-b2";
const warehouseId = "warehouse-supplier-return-b2";
const itemId = "item-supplier-return-b2";
const sku = "SUP-RET-B2";
const managerId = "manager-supplier-return-b2";
const scopedUserId = "scoped-supplier-return-b2";
const viewerId = "viewer-supplier-return-b2";
const otherTenantId = "tenant-supplier-return-other-b2";
const otherManagerId = "manager-supplier-return-other-b2";
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

async function seed(prisma) {
  await prisma.tenant.createMany({
    data: [
      { id: tenantId, name: "Supplier Return B2" },
      { id: otherTenantId, name: "Supplier Return Other B2" },
    ],
  });
  await prisma.warehouse.create({
    data: {
      id: warehouseId,
      tenantId,
      code: "SUP-RET-B2",
      name: "Supplier Return Warehouse",
    },
  });
  for (const user of [
    { id: managerId, tenantId, email: "manager-b2@flowchain.invalid", name: "Manager", role: "manager" },
    { id: scopedUserId, tenantId, email: "scoped-b2@flowchain.invalid", name: "Scoped", role: "business-specialist" },
    { id: viewerId, tenantId, email: "viewer-b2@flowchain.invalid", name: "Viewer", role: "viewer" },
    { id: otherManagerId, tenantId: otherTenantId, email: "other-b2@flowchain.invalid", name: "Other", role: "manager" },
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
      name: "Supplier Return Item",
      unit: "EA",
    },
  });
  await prisma.inventoryBalance.create({
    data: {
      id: "available-supplier-return-b2",
      tenantId,
      itemId,
      sku,
      itemName: "Supplier Return Item",
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
  await prisma.quarantineInventoryBalance.create({
    data: {
      id: "quarantine-supplier-return-b2",
      tenantId,
      itemId,
      sku,
      itemName: "Supplier Return Item",
      warehouseId,
      warehouseKey: warehouseId,
      location: "Q-01",
      locationKey: "q-01",
      onHandQuantity: "5",
      unit: "EA",
    },
  });
}

async function createAuthorization(
  prisma,
  {
    suffix,
    route = "return_from_available",
    authorizedQuantities = ["2"],
  },
) {
  const requestId = `request-${suffix}`;
  const authorizationId = `authorization-${suffix}`;
  const requestLineIds = authorizedQuantities.map(
    (_, index) => `request-line-${suffix}-${index + 1}`,
  );
  await prisma.returnRequest.create({
    data: {
      id: requestId,
      tenantId,
      requestNumber: `RET-${suffix}`,
      returnType: "supplier_return",
      partnerId: "supplier-b2",
      partnerNameSnapshot: "Supplier B2",
      sourceDocumentType: "ReceivingDocument",
      sourceDocumentId: `receiving-${suffix}`,
      sourceDocumentNumber: `GRN-${suffix}`,
      contextDocumentType: "PurchaseOrder",
      contextDocumentId: `purchase-order-${suffix}`,
      reasonCode: "supplier_return",
      workflowStatus: "authorized",
      requestedById: managerId,
      submittedAt: new Date(),
      submittedById: managerId,
      version: 0,
      lines: {
        create: authorizedQuantities.map((quantity, index) => ({
          id: requestLineIds[index],
          sourceDocumentType: "ReceivingDocument",
          sourceDocumentId: `receiving-${suffix}`,
          sourceDocumentLineId: `receiving-line-${suffix}-${index + 1}`,
          sourceQuantity: "20",
          sourceWarehouseIds: [warehouseId],
          itemId,
          sku,
          itemName: "Supplier Return Item",
          requestedQuantity: quantity,
          unit: "EA",
          reasonCode: "supplier_return",
        })),
      },
    },
  });
  const authorization = await prisma.returnAuthorization.create({
    data: {
      id: authorizationId,
      tenantId,
      authorizationNumber: `AUTH-${suffix}`,
      returnRequestId: requestId,
      workflowStatus: "approved",
      authorizedAt: new Date(),
      authorizedById: managerId,
      version: 0,
      lines: {
        create: authorizedQuantities.map((quantity, index) => ({
          id: `authorization-line-${suffix}-${index + 1}`,
          returnRequestLineId: requestLineIds[index],
          authorizedQuantity: quantity,
          dispositionRoute: route,
        })),
      },
    },
    include: { lines: true, returnRequest: true },
  });
  return authorization;
}

function postingLines(authorization, quantities, balanceType = "available") {
  return authorization.lines.map((line, index) => ({
    returnAuthorizationLineId: line.id,
    quantity: quantities[index],
    inventoryBalanceId:
      balanceType === "available" ? "available-supplier-return-b2" : "",
    quarantineBalanceId:
      balanceType === "quarantine"
        ? "quarantine-supplier-return-b2"
        : "",
  }));
}

async function currentVersions(prisma, postingId, authorizationId, requestId) {
  const [posting, authorization, request] = await Promise.all([
    prisma.returnPostingDocument.findUnique({ where: { id: postingId } }),
    prisma.returnAuthorization.findUnique({ where: { id: authorizationId } }),
    prisma.returnRequest.findUnique({ where: { id: requestId } }),
  ]);
  return { posting, authorization, request };
}

async function ready(service, posting, context, key) {
  return service.readyPosting(
    posting.id,
    {
      expectedPostingVersion: posting.version,
      idempotencyKey: key,
    },
    context,
  );
}

async function post(service, prisma, postingId, authorizationId, requestId, context, key) {
  const versions = await currentVersions(
    prisma,
    postingId,
    authorizationId,
    requestId,
  );
  return service.postSupplierReturn(
    postingId,
    {
      expectedPostingVersion: versions.posting.version,
      expectedAuthorizationVersion: versions.authorization.version,
      expectedRequestVersion: versions.request.version,
      idempotencyKey: key,
    },
    context,
  );
}

async function reverse(service, prisma, postingId, authorizationId, requestId, context, key) {
  const versions = await currentVersions(
    prisma,
    postingId,
    authorizationId,
    requestId,
  );
  return service.reverseSupplierReturn(
    postingId,
    {
      expectedPostingVersion: versions.posting.version,
      expectedAuthorizationVersion: versions.authorization.version,
      expectedRequestVersion: versions.request.version,
      reason: "Approved supplier return reversal",
      idempotencyKey: key,
    },
    context,
  );
}

test(
  "supplier return posting is atomic, cumulative, scoped, idempotent, and safely reversible",
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
    const manager = { identity: identity(managerId, "manager") };
    const service = createSupplierReturnCommandService({ prisma, env });
    const serviceB = createSupplierReturnCommandService({ prisma: prismaB, env });
    try {
      await seed(prisma);

      const lifecycleAuthorization = await createAuthorization(prisma, {
        suffix: "LIFECYCLE",
        authorizedQuantities: ["1"],
      });
      const lifecycleDraft = await service.createPostingDraft(
        {
          authorizationId: lifecycleAuthorization.id,
          postingNumber: "POST-LIFECYCLE",
          expectedAuthorizationVersion: 0,
          lines: postingLines(lifecycleAuthorization, ["0.5000"]),
          idempotencyKey: "create-lifecycle-b2",
        },
        manager,
      );
      const revised = await service.revisePostingDraft(
        lifecycleDraft.entityId,
        {
          postingNumber: "POST-LIFECYCLE-REVISED",
          expectedPostingVersion: 0,
          lines: postingLines(lifecycleAuthorization, ["0.7500"]),
          idempotencyKey: "revise-lifecycle-b2",
        },
        manager,
      );
      assert.equal(revised.posting.version, 1);
      const cancelled = await service.cancelPosting(
        lifecycleDraft.entityId,
        {
          expectedPostingVersion: 1,
          reason: "Lifecycle cancellation coverage",
          idempotencyKey: "cancel-lifecycle-b2",
        },
        manager,
      );
      assert.equal(cancelled.posting.workflowStatus, "cancelled");

      const availableAuthorization = await createAuthorization(prisma, {
        suffix: "AVAILABLE",
        authorizedQuantities: ["1.5000", "2.5000"],
      });
      const firstDraft = await service.createPostingDraft(
        {
          authorizationId: availableAuthorization.id,
          postingNumber: "POST-AVAILABLE-1",
          expectedAuthorizationVersion: 0,
          lines: postingLines(availableAuthorization, ["1", "1"]),
          idempotencyKey: "create-available-1-b2",
        },
        manager,
      );
      const firstReady = await ready(
        service,
        firstDraft.posting,
        manager,
        "ready-available-1-b2",
      );
      const firstPosted = await post(
        service,
        prisma,
        firstDraft.entityId,
        availableAuthorization.id,
        availableAuthorization.returnRequestId,
        manager,
        "post-available-1-b2",
      );
      assert.equal(firstPosted.returnAuthorization.workflowStatus, "partially_executed");
      assert.equal(firstPosted.returnRequest.workflowStatus, "partially_executed");
      const firstReplay = await service.postSupplierReturn(
        firstDraft.entityId,
        {
          expectedPostingVersion: firstReady.posting.version,
          expectedAuthorizationVersion: 0,
          expectedRequestVersion: 0,
          idempotencyKey: "post-available-1-b2",
        },
        manager,
      );
      assert.equal(firstReplay.idempotentReplay, true);
      await assert.rejects(
        service.postSupplierReturn(
          firstDraft.entityId,
          {
            expectedPostingVersion: firstReady.posting.version + 1,
            expectedAuthorizationVersion: 1,
            expectedRequestVersion: 1,
            idempotencyKey: "post-available-1-b2",
          },
          manager,
        ),
        (error) =>
          error instanceof SupplierReturnCommandError &&
          error.code === "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD",
      );
      let available = await prisma.inventoryBalance.findUnique({
        where: { id: "available-supplier-return-b2" },
      });
      assert.equal(String(available.onHandQuantity), "8");
      assert.equal(String(available.reservedQuantity), "2");
      assert.equal(String(available.availableQuantity), "6");
      assert.equal(available.version, 1);

      const secondDraft = await service.createPostingDraft(
        {
          authorizationId: availableAuthorization.id,
          postingNumber: "POST-AVAILABLE-2",
          expectedAuthorizationVersion: 1,
          lines: postingLines(availableAuthorization, ["0.5000", "1.5000"]),
          idempotencyKey: "create-available-2-b2",
        },
        manager,
      );
      await ready(
        service,
        secondDraft.posting,
        manager,
        "ready-available-2-b2",
      );
      const secondPosted = await post(
        service,
        prisma,
        secondDraft.entityId,
        availableAuthorization.id,
        availableAuthorization.returnRequestId,
        manager,
        "post-available-2-b2",
      );
      assert.equal(secondPosted.returnAuthorization.workflowStatus, "executed");
      assert.equal(secondPosted.returnRequest.workflowStatus, "executed");
      available = await prisma.inventoryBalance.findUnique({
        where: { id: "available-supplier-return-b2" },
      });
      assert.equal(String(available.onHandQuantity), "6");
      assert.equal(String(available.reservedQuantity), "2");
      assert.equal(String(available.availableQuantity), "4");
      assert.equal(available.version, 2);

      const reversedSecond = await reverse(
        service,
        prisma,
        secondDraft.entityId,
        availableAuthorization.id,
        availableAuthorization.returnRequestId,
        manager,
        "reverse-available-2-b2",
      );
      assert.equal(
        reversedSecond.returnAuthorization.workflowStatus,
        "partially_executed",
      );
      await reverse(
        service,
        prisma,
        firstDraft.entityId,
        availableAuthorization.id,
        availableAuthorization.returnRequestId,
        manager,
        "reverse-available-1-b2",
      );
      available = await prisma.inventoryBalance.findUnique({
        where: { id: "available-supplier-return-b2" },
      });
      assert.equal(String(available.onHandQuantity), "10");
      assert.equal(String(available.reservedQuantity), "2");
      assert.equal(String(available.availableQuantity), "8");
      assert.equal(
        (
          await prisma.returnAuthorization.findUnique({
            where: { id: availableAuthorization.id },
          })
        ).workflowStatus,
        "approved",
      );

      const quarantineAuthorization = await createAuthorization(prisma, {
        suffix: "QUARANTINE",
        route: "return_from_quarantine",
        authorizedQuantities: ["3"],
      });
      const quarantineDraft = await service.createPostingDraft(
        {
          authorizationId: quarantineAuthorization.id,
          postingNumber: "POST-QUARANTINE",
          expectedAuthorizationVersion: 0,
          lines: postingLines(
            quarantineAuthorization,
            ["2"],
            "quarantine",
          ),
          idempotencyKey: "create-quarantine-b2",
        },
        manager,
      );
      await ready(
        service,
        quarantineDraft.posting,
        manager,
        "ready-quarantine-b2",
      );
      await post(
        service,
        prisma,
        quarantineDraft.entityId,
        quarantineAuthorization.id,
        quarantineAuthorization.returnRequestId,
        manager,
        "post-quarantine-b2",
      );
      let quarantine = await prisma.quarantineInventoryBalance.findUnique({
        where: { id: "quarantine-supplier-return-b2" },
      });
      assert.equal(String(quarantine.onHandQuantity), "3");
      await reverse(
        service,
        prisma,
        quarantineDraft.entityId,
        quarantineAuthorization.id,
        quarantineAuthorization.returnRequestId,
        manager,
        "reverse-quarantine-b2",
      );
      quarantine = await prisma.quarantineInventoryBalance.findUnique({
        where: { id: "quarantine-supplier-return-b2" },
      });
      assert.equal(String(quarantine.onHandQuantity), "5");

      const protectedAuthorization = await createAuthorization(prisma, {
        suffix: "RESERVED",
        authorizedQuantities: ["2"],
      });
      const protectedDraft = await service.createPostingDraft(
        {
          authorizationId: protectedAuthorization.id,
          postingNumber: "POST-RESERVED",
          expectedAuthorizationVersion: 0,
          lines: postingLines(protectedAuthorization, ["2"]),
          idempotencyKey: "create-reserved-b2",
        },
        manager,
      );
      await ready(
        service,
        protectedDraft.posting,
        manager,
        "ready-reserved-b2",
      );
      const protectedPostingLine = await prisma.returnPostingLine.findFirst({
        where: { returnPostingId: protectedDraft.entityId },
      });
      await prisma.returnPostingLine.update({
        where: { id: protectedPostingLine.id },
        data: { itemName: "Tampered posting snapshot" },
      });
      await assert.rejects(
        post(
          service,
          prisma,
          protectedDraft.entityId,
          protectedAuthorization.id,
          protectedAuthorization.returnRequestId,
          manager,
          "post-tampered-line-b2",
        ),
        (error) =>
          error instanceof SupplierReturnCommandError &&
          error.code === "RETURN_POSTING_LINE_IDENTITY_MISMATCH",
      );
      await prisma.returnPostingLine.update({
        where: { id: protectedPostingLine.id },
        data: { itemName: "Supplier Return Item" },
      });
      await prisma.inventoryBalance.update({
        where: { id: "available-supplier-return-b2" },
        data: {
          reservedQuantity: "9",
          availableQuantity: "1",
          version: { increment: 1 },
        },
      });
      const protectedBefore = await prisma.inventoryMovement.count({
        where: { sourceDocumentId: protectedDraft.entityId },
      });
      await assert.rejects(
        post(
          service,
          prisma,
          protectedDraft.entityId,
          protectedAuthorization.id,
          protectedAuthorization.returnRequestId,
          manager,
          "post-reserved-b2",
        ),
        (error) =>
          error instanceof SupplierReturnCommandError &&
          error.code === "RETURN_AVAILABLE_INVENTORY_INSUFFICIENT",
      );
      assert.equal(
        await prisma.inventoryMovement.count({
          where: { sourceDocumentId: protectedDraft.entityId },
        }),
        protectedBefore,
      );
      await prisma.inventoryBalance.update({
        where: { id: "available-supplier-return-b2" },
        data: {
          reservedQuantity: "2",
          availableQuantity: "8",
          version: { increment: 1 },
        },
      });

      const concurrentAuthorization = await createAuthorization(prisma, {
        suffix: "CONCURRENT",
        authorizedQuantities: ["2"],
      });
      const concurrentDrafts = [];
      for (const number of [1, 2]) {
        const draft = await service.createPostingDraft(
          {
            authorizationId: concurrentAuthorization.id,
            postingNumber: `POST-CONCURRENT-${number}`,
            expectedAuthorizationVersion: 0,
            lines: postingLines(concurrentAuthorization, ["2"]),
            idempotencyKey: `create-concurrent-${number}-b2`,
          },
          manager,
        );
        await ready(
          service,
          draft.posting,
          manager,
          `ready-concurrent-${number}-b2`,
        );
        concurrentDrafts.push(draft);
      }
      const concurrentVersions = await currentVersions(
        prisma,
        concurrentDrafts[0].entityId,
        concurrentAuthorization.id,
        concurrentAuthorization.returnRequestId,
      );
      const results = await Promise.allSettled([
        service.postSupplierReturn(
          concurrentDrafts[0].entityId,
          {
            expectedPostingVersion: 1,
            expectedAuthorizationVersion:
              concurrentVersions.authorization.version,
            expectedRequestVersion: concurrentVersions.request.version,
            idempotencyKey: "post-concurrent-1-b2",
          },
          manager,
        ),
        serviceB.postSupplierReturn(
          concurrentDrafts[1].entityId,
          {
            expectedPostingVersion: 1,
            expectedAuthorizationVersion:
              concurrentVersions.authorization.version,
            expectedRequestVersion: concurrentVersions.request.version,
            idempotencyKey: "post-concurrent-2-b2",
          },
          manager,
        ),
      ]);
      assert.equal(
        results.filter((entry) => entry.status === "fulfilled").length,
        1,
      );
      assert.equal(
        results.filter((entry) => entry.status === "rejected").length,
        1,
      );
      const concurrentWinner = results.find(
        (entry) => entry.status === "fulfilled",
      ).value;
      available = await prisma.inventoryBalance.findUnique({
        where: { id: "available-supplier-return-b2" },
      });
      assert.equal(String(available.onHandQuantity), "8");
      assert.equal(String(available.availableQuantity), "6");
      await reverse(
        service,
        prisma,
        concurrentWinner.entityId,
        concurrentAuthorization.id,
        concurrentAuthorization.returnRequestId,
        manager,
        "reverse-concurrent-winner-b2",
      );

      const scopedAuthorization = await createAuthorization(prisma, {
        suffix: "SCOPE",
        authorizedQuantities: ["1"],
      });
      await assert.rejects(
        service.createPostingDraft(
          {
            authorizationId: scopedAuthorization.id,
            postingNumber: "POST-SCOPE",
            expectedAuthorizationVersion: 0,
            lines: postingLines(scopedAuthorization, ["1"]),
            idempotencyKey: "create-scope-b2",
          },
          { identity: identity(scopedUserId, "business-specialist") },
        ),
        (error) => error.code === "WAREHOUSE_SCOPE_DENIED",
      );
      await assert.rejects(
        service.createPostingDraft(
          {
            authorizationId: scopedAuthorization.id,
            postingNumber: "POST-VIEWER",
            expectedAuthorizationVersion: 0,
            lines: postingLines(scopedAuthorization, ["1"]),
            idempotencyKey: "create-viewer-b2",
          },
          { identity: identity(viewerId, "viewer") },
        ),
        (error) => error.code === "AUTHORIZATION_PERMISSION_DENIED",
      );
      await assert.rejects(
        service.createPostingDraft(
          {
            authorizationId: scopedAuthorization.id,
            postingNumber: "POST-CROSS-TENANT",
            expectedAuthorizationVersion: 0,
            lines: postingLines(scopedAuthorization, ["1"]),
            idempotencyKey: "create-cross-tenant-b2",
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
          error instanceof SupplierReturnCommandError &&
          error.code === "RETURN_AUTHORIZATION_NOT_FOUND",
      );

      const tamperAuthorization = await createAuthorization(prisma, {
        suffix: "TAMPER",
        authorizedQuantities: ["1"],
      });
      const tamperDraft = await service.createPostingDraft(
        {
          authorizationId: tamperAuthorization.id,
          postingNumber: "POST-TAMPER",
          expectedAuthorizationVersion: 0,
          lines: postingLines(tamperAuthorization, ["1"]),
          idempotencyKey: "create-tamper-b2",
        },
        manager,
      );
      await ready(
        service,
        tamperDraft.posting,
        manager,
        "ready-tamper-b2",
      );
      await post(
        service,
        prisma,
        tamperDraft.entityId,
        tamperAuthorization.id,
        tamperAuthorization.returnRequestId,
        manager,
        "post-tamper-b2",
      );
      const originalMovement = await prisma.inventoryMovement.findFirst({
        where: {
          sourceDocumentId: tamperDraft.entityId,
          movementType: "supplier_return_out",
        },
      });
      const readService = createSupplierReturnReadService({
        prisma,
        capability: { enabled: true, readReady: true, writeReady: true },
      });
      const workbench = () => readService.postingWorkbench(tamperDraft.entityId, manager);
      const baselineReconciliation = (await workbench()).reconciliation;
      assert.equal(baselineReconciliation.status, "matched", JSON.stringify(baselineReconciliation.lines.flatMap((line) => line.checks.filter((check) => check.status !== "matched"))));
      const assertTamperDetected = async (label, mutate, restore) => {
        await mutate();
        try {
          assert.equal((await workbench()).reconciliation.status, "mismatch", `${label} must be detected`);
        } finally {
          await restore();
        }
      };
      const movementMutations = [
        ["source document type", { sourceDocumentType: "TamperedDocument" }],
        ["source document id", { sourceDocumentId: "tampered-posting" }],
        ["source document line", { sourceDocumentLineId: "tampered-line" }],
        ["sku", { sku: "TAMPERED-SKU" }],
        ["unit", { unit: "case" }],
        ["location", { location: "TAMPERED" }],
        ["location key", { locationKey: "tampered-location" }],
        ["posting batch", { postingBatchId: "tampered-batch" }],
        ["quantity in", { quantityIn: "0.2500" }],
        ["quantity out", { quantityOut: "0.5000" }],
        ["adjustment quantity", { adjustmentQty: "0.2500" }],
      ];
      for (const [label, data] of movementMutations) {
        await assertTamperDetected(
          label,
          () => prisma.inventoryMovement.update({ where: { id: originalMovement.id }, data }),
          () => prisma.inventoryMovement.update({ where: { id: originalMovement.id }, data: originalMovement }),
        );
      }
      for (const [label, metadata] of [
        ["movement balance type", { ...originalMovement.metadata, balanceType: "quarantine" }],
        ["movement balance id", { ...originalMovement.metadata, balanceId: "tampered-balance" }],
      ]) {
        await assertTamperDetected(
          label,
          () => prisma.inventoryMovement.update({ where: { id: originalMovement.id }, data: { metadata } }),
          () => prisma.inventoryMovement.update({ where: { id: originalMovement.id }, data: { metadata: originalMovement.metadata } }),
        );
      }
      const postAudit = await prisma.auditLog.findFirst({ where: { entityId: tamperDraft.entityId, action: "supplier_return_posted" } });
      const originalAuditMetadata = structuredClone(postAudit.metadata);
      const impactMutations = [
        ["missing balance impacts", (metadata) => ({ ...metadata, balanceImpacts: [] })],
        ["impact quantity", (metadata) => ({ ...metadata, balanceImpacts: metadata.balanceImpacts.map((impact) => ({ ...impact, quantity: "0.5000" })) })],
        ["impact on hand before", (metadata) => ({ ...metadata, balanceImpacts: metadata.balanceImpacts.map((impact) => ({ ...impact, onHandBefore: "999.0000" })) })],
        ["impact on hand after", (metadata) => ({ ...metadata, balanceImpacts: metadata.balanceImpacts.map((impact) => ({ ...impact, onHandAfter: "999.0000" })) })],
        ["impact available before", (metadata) => ({ ...metadata, balanceImpacts: metadata.balanceImpacts.map((impact) => ({ ...impact, availableBefore: "999.0000" })) })],
        ["impact available after", (metadata) => ({ ...metadata, balanceImpacts: metadata.balanceImpacts.map((impact) => ({ ...impact, availableAfter: "999.0000" })) })],
        ["impact reserved after", (metadata) => ({ ...metadata, balanceImpacts: metadata.balanceImpacts.map((impact) => ({ ...impact, reservedAfter: "999.0000" })) })],
      ];
      for (const [label, change] of impactMutations) {
        await assertTamperDetected(
          label,
          () => prisma.auditLog.update({ where: { id: postAudit.id }, data: { metadata: change(structuredClone(originalAuditMetadata)) } }),
          () => prisma.auditLog.update({ where: { id: postAudit.id }, data: { metadata: originalAuditMetadata } }),
        );
      }
      for (const [label, model, id, tamperedStatus] of [
        ["authorization workflow", prisma.returnAuthorization, tamperAuthorization.id, "approved"],
        ["request workflow", prisma.returnRequest, tamperAuthorization.returnRequestId, "authorized"],
      ]) {
        await assertTamperDetected(
          label,
          () => model.update({ where: { id }, data: { workflowStatus: tamperedStatus } }),
          () => model.update({ where: { id }, data: { workflowStatus: "executed" } }),
        );
      }
      await prisma.inventoryMovement.update({
        where: { id: originalMovement.id },
        data: {
          metadata: {
            ...originalMovement.metadata,
            balanceId: "tampered-balance",
          },
        },
      });
      const beforeUnsafeReverse = await prisma.inventoryBalance.findUnique({
        where: { id: "available-supplier-return-b2" },
      });
      await assert.rejects(
        reverse(
          service,
          prisma,
          tamperDraft.entityId,
          tamperAuthorization.id,
          tamperAuthorization.returnRequestId,
          manager,
          "reverse-tamper-failed-b2",
        ),
        (error) =>
          error instanceof SupplierReturnCommandError &&
          error.code === "RETURN_REVERSAL_NOT_SAFE",
      );
      const afterUnsafeReverse = await prisma.inventoryBalance.findUnique({
        where: { id: "available-supplier-return-b2" },
      });
      assert.equal(
        String(afterUnsafeReverse.onHandQuantity),
        String(beforeUnsafeReverse.onHandQuantity),
      );
      await prisma.inventoryMovement.update({
        where: { id: originalMovement.id },
        data: { metadata: originalMovement.metadata },
      });
      await reverse(
        service,
        prisma,
        tamperDraft.entityId,
        tamperAuthorization.id,
        tamperAuthorization.returnRequestId,
        manager,
        "reverse-tamper-cleanup-b2",
      );
      const reversedReconciliation = (await workbench()).reconciliation;
      assert.equal(reversedReconciliation.status, "matched", JSON.stringify(reversedReconciliation.lines.flatMap((line) => line.checks.filter((check) => check.status !== "matched"))));
      const reversedOriginal = await prisma.inventoryMovement.findUnique({ where: { id: originalMovement.id } });
      const compensation = await prisma.inventoryMovement.findFirst({ where: { reversalOfMovementId: originalMovement.id } });
      await assertTamperDetected(
        "reversal forward link",
        () => prisma.inventoryMovement.update({ where: { id: originalMovement.id }, data: { reversedByMovementId: null } }),
        () => prisma.inventoryMovement.update({ where: { id: originalMovement.id }, data: { reversedByMovementId: reversedOriginal.reversedByMovementId } }),
      );
      await assertTamperDetected(
        "reversal inverse quantity",
        () => prisma.inventoryMovement.update({ where: { id: compensation.id }, data: { quantityIn: "0.5000" } }),
        () => prisma.inventoryMovement.update({ where: { id: compensation.id }, data: { quantityIn: compensation.quantityIn } }),
      );
      await assertTamperDetected(
        "reversal batch separation",
        () => prisma.inventoryMovement.update({ where: { id: compensation.id }, data: { postingBatchId: originalMovement.postingBatchId } }),
        () => prisma.inventoryMovement.update({ where: { id: compensation.id }, data: { postingBatchId: compensation.postingBatchId } }),
      );

      const rollbackAuthorization = await createAuthorization(prisma, {
        suffix: "ROLLBACK",
        authorizedQuantities: ["1"],
      });
      const rollbackDraft = await service.createPostingDraft(
        {
          authorizationId: rollbackAuthorization.id,
          postingNumber: "POST-ROLLBACK",
          expectedAuthorizationVersion: 0,
          lines: postingLines(rollbackAuthorization, ["1"]),
          idempotencyKey: "create-rollback-b2",
        },
        manager,
      );
      await ready(
        service,
        rollbackDraft.posting,
        manager,
        "ready-rollback-b2",
      );
      const rollbackService = createSupplierReturnCommandService({
        prisma,
        env,
        faultInjector: async (point) => {
          if (point === "before_command_complete")
            throw new Error("injected supplier return failure");
        },
      });
      const balanceBeforeRollback = await prisma.inventoryBalance.findUnique({
        where: { id: "available-supplier-return-b2" },
      });
      await assert.rejects(
        post(
          rollbackService,
          prisma,
          rollbackDraft.entityId,
          rollbackAuthorization.id,
          rollbackAuthorization.returnRequestId,
          manager,
          "post-rollback-b2",
        ),
        /injected supplier return failure/,
      );
      const balanceAfterRollback = await prisma.inventoryBalance.findUnique({
        where: { id: "available-supplier-return-b2" },
      });
      assert.equal(
        String(balanceAfterRollback.onHandQuantity),
        String(balanceBeforeRollback.onHandQuantity),
      );
      assert.equal(
        await prisma.inventoryMovement.count({
          where: { sourceDocumentId: rollbackDraft.entityId },
        }),
        0,
      );
      assert.equal(
        await prisma.businessCommandExecution.count({
          where: {
            tenantId,
            commandType: "post_supplier_return_dispatch",
            idempotencyKey: "post-rollback-b2",
          },
        }),
        0,
      );
    } finally {
      await prismaB.$disconnect();
      await prisma.$disconnect();
    }
  },
);
