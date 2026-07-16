import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { createPrismaClient } from "../persistence/prisma-client.mjs";
import { createInventoryOperationsCommandService } from "./inventory-operations-command-service.mjs";
import { createInventoryOperationsReadService } from "./inventory-operations-read-service.mjs";

const realPostgres =
  Boolean(process.env.DATABASE_URL) &&
  process.env.FLOWCHAIN_REQUIRE_REAL_POSTGRES_TESTS === "true";
const env = {
  ...process.env,
  FLOWCHAIN_PERSISTENCE_MODE: "database",
  FLOWCHAIN_ENABLE_DB_INVENTORY_OPERATIONS: "true",
};
let prisma;
if (!realPostgres) {
  test("inventory operations PostgreSQL transactions are routed to test:db:inventory-operations", () =>
    assert.equal(realPostgres, false));
} else {
  before(async () => {
    prisma = await createPrismaClient(env);
  });
  after(async () => {
    await prisma?.$disconnect();
  });

  const identity = (tenantId, userId, role = "manager") => ({
    identity: {
      authenticated: true,
      tenantId,
      userId,
      role,
      source: "signed-session",
    },
  });
  const capabilities = {
    "stock-transfer": { enabled: true },
    "cycle-count": { enabled: true },
    "inventory-adjustment-document": { enabled: true },
  };

  async function seed() {
    const suffix = randomUUID(),
      tenantId = `tenant-${suffix}`,
      managerId = `manager-${suffix}`,
      specialistId = `specialist-${suffix}`,
      viewerId = `viewer-${suffix}`;
    const warehouseA = `warehouse-a-${suffix}`,
      warehouseB = `warehouse-b-${suffix}`,
      itemId = `item-${suffix}`,
      balanceA = `balance-a-${suffix}`,
      balanceB = `balance-b-${suffix}`;
    await prisma.tenant.create({
      data: { id: tenantId, name: "Inventory Operations Test" },
    });
    await prisma.user.createMany({
      data: [
        {
          id: managerId,
          tenantId,
          email: `${managerId}@example.com`,
          name: "Manager",
          role: "manager",
        },
        {
          id: specialistId,
          tenantId,
          email: `${specialistId}@example.com`,
          name: "Specialist",
          role: "business-specialist",
        },
        {
          id: viewerId,
          tenantId,
          email: `${viewerId}@example.com`,
          name: "Viewer",
          role: "viewer",
        },
      ],
    });
    await prisma.warehouse.createMany({
      data: [
        {
          id: warehouseA,
          tenantId,
          code: `A-${suffix}`,
          name: "Warehouse A",
          status: "active",
        },
        {
          id: warehouseB,
          tenantId,
          code: `B-${suffix}`,
          name: "Warehouse B",
          status: "active",
        },
      ],
    });
    await prisma.userWarehouseScope.createMany({
      data: [
        ...[managerId, specialistId].flatMap((userId) =>
          [warehouseA, warehouseB].map((warehouseId) => ({
            id: randomUUID(),
            tenantId,
            userId,
            warehouseId,
            accessLevel: "operate",
          })),
        ),
        {
          id: randomUUID(),
          tenantId,
          userId: viewerId,
          warehouseId: warehouseA,
          accessLevel: "read",
        },
      ],
    });
    await prisma.item.create({
      data: {
        id: itemId,
        tenantId,
        sku: `SKU-${suffix}`,
        name: "Inventory Test Item",
        unit: "EA",
        status: "active",
      },
    });
    await prisma.inventoryBalance.createMany({
      data: [
        {
          id: balanceA,
          tenantId,
          itemId,
          sku: `SKU-${suffix}`,
          itemName: "Inventory Test Item",
          warehouseId: warehouseA,
          warehouseKey: warehouseA,
          location: "A-01",
          locationKey: "a-01",
          onHandQuantity: "10",
          reservedQuantity: "2",
          availableQuantity: "8",
          unit: "EA",
          status: "available",
        },
        {
          id: balanceB,
          tenantId,
          itemId,
          sku: `SKU-${suffix}`,
          itemName: "Inventory Test Item",
          warehouseId: warehouseB,
          warehouseKey: warehouseB,
          location: "B-01",
          locationKey: "b-01",
          onHandQuantity: "5",
          reservedQuantity: "0",
          availableQuantity: "5",
          unit: "EA",
          status: "available",
        },
      ],
    });
    return {
      tenantId,
      managerId,
      specialistId,
      viewerId,
      warehouseA,
      warehouseB,
      itemId,
      balanceA,
      balanceB,
      sku: `SKU-${suffix}`,
    };
  }

  test("stock transfer posts two balanced movements, replays once, and reverses safely", async () => {
    const ids = await seed(),
      service = createInventoryOperationsCommandService({ prisma, env }),
      ctx = identity(ids.tenantId, ids.managerId);
    const created = await service.createTransfer(
      {
        transferNumber: `TR-${randomUUID()}`,
        idempotencyKey: "transfer-create",
        lines: [
          {
            itemId: ids.itemId,
            quantity: "3",
            source: { warehouseId: ids.warehouseA, location: "A-01" },
            destination: { warehouseId: ids.warehouseB, location: "B-01" },
          },
        ],
      },
      ctx,
    );
    assert.equal(
      await prisma.inventoryMovement.count({
        where: { tenantId: ids.tenantId },
      }),
      0,
    );
    const ready = await service.readyTransfer(
      created.transfer.id,
      { expectedTransferVersion: 0, idempotencyKey: "transfer-ready" },
      ctx,
    );
    const posted = await service.postTransfer(
      created.transfer.id,
      {
        expectedTransferVersion: ready.transfer.version,
        idempotencyKey: "transfer-post",
      },
      ctx,
    );
    assert.equal(posted.movementIds.length, 2);
    assert.equal(
      (
        await service.postTransfer(
          created.transfer.id,
          {
            expectedTransferVersion: ready.transfer.version,
            idempotencyKey: "transfer-post",
          },
          ctx,
        )
      ).idempotentReplay,
      true,
    );
    const [a, b] = await Promise.all([
      prisma.inventoryBalance.findUnique({ where: { id: ids.balanceA } }),
      prisma.inventoryBalance.findUnique({ where: { id: ids.balanceB } }),
    ]);
    assert.deepEqual(
      [
        a.onHandQuantity.toString(),
        a.reservedQuantity.toString(),
        a.availableQuantity.toString(),
      ],
      ["7", "2", "5"],
    );
    assert.deepEqual(
      [
        b.onHandQuantity.toString(),
        b.reservedQuantity.toString(),
        b.availableQuantity.toString(),
      ],
      ["8", "0", "8"],
    );
    const movements = await prisma.inventoryMovement.findMany({
      where: { tenantId: ids.tenantId, sourceDocumentId: created.transfer.id },
    });
    assert.deepEqual(
      new Set(movements.map((row) => row.postingBatchId)),
      new Set([posted.postingBatchId]),
    );
    const reversed = await service.reverseTransfer(
      created.transfer.id,
      {
        expectedTransferVersion: posted.transfer.version,
        idempotencyKey: "transfer-reverse",
        reason: "Test correction",
      },
      ctx,
    );
    assert.equal(reversed.movementIds.length, 2);
    const [restoredA, restoredB] = await Promise.all([
      prisma.inventoryBalance.findUnique({ where: { id: ids.balanceA } }),
      prisma.inventoryBalance.findUnique({ where: { id: ids.balanceB } }),
    ]);
    assert.deepEqual(
      [
        restoredA.onHandQuantity.toString(),
        restoredA.reservedQuantity.toString(),
        restoredA.availableQuantity.toString(),
      ],
      ["10", "2", "8"],
    );
    assert.deepEqual(
      [
        restoredB.onHandQuantity.toString(),
        restoredB.availableQuantity.toString(),
      ],
      ["5", "5"],
    );
    await assert.rejects(
      () =>
        service.reverseTransfer(
          created.transfer.id,
          {
            expectedTransferVersion: reversed.transfer.version,
            idempotencyKey: "transfer-reverse-again",
            reason: "Again",
          },
          ctx,
        ),
      (error) => error.code === "TRANSFER_ALREADY_REVERSED",
    );
    const workbench = await createInventoryOperationsReadService({
      prisma,
      capabilities,
    }).transferWorkbench(created.transfer.id, ctx);
    assert.equal(workbench.reconciliation.status, "matched");
    assert.equal(workbench.movements.length, 4);
  });

  test("blind cycle count protects snapshot, requires review, and posts fixed-scale variance", async () => {
    const ids = await seed(),
      service = createInventoryOperationsCommandService({ prisma, env });
    const specialist = identity(
        ids.tenantId,
        ids.specialistId,
        "business-specialist",
      ),
      manager = identity(ids.tenantId, ids.managerId);
    const created = await service.createCount(
      {
        countNumber: `CC-${randomUUID()}`,
        warehouseId: ids.warehouseA,
        blindCount: true,
        balanceIds: [ids.balanceA],
        idempotencyKey: "count-create",
      },
      specialist,
    );
    const blind = await createInventoryOperationsReadService({
      prisma,
      capabilities,
    }).countWorkbench(created.session.id, specialist);
    assert.equal(blind.lines[0].recordedOnHandQuantity, null);
    const entered = await service.reviseCount(
      created.session.id,
      {
        expectedSessionVersion: 0,
        idempotencyKey: "count-enter",
        counts: [
          {
            countLineId: created.session.lines[0].id,
            countedQuantity: "11",
            expectedLineVersion: 0,
          },
        ],
      },
      specialist,
    );
    const submitted = await service.submitCount(
      created.session.id,
      {
        expectedSessionVersion: entered.session.version,
        idempotencyKey: "count-submit",
      },
      specialist,
    );
    await assert.rejects(
      () =>
        service.postCount(
          created.session.id,
          {
            expectedSessionVersion: submitted.session.version,
            idempotencyKey: "count-specialist-post",
          },
          specialist,
        ),
      (error) => error.code === "PERMISSION_DENIED",
    );
    const reviewed = await service.reviewCount(
      created.session.id,
      {
        expectedSessionVersion: submitted.session.version,
        idempotencyKey: "count-review",
      },
      manager,
    );
    const [snapshotLine, currentBalance] = await Promise.all([
      prisma.cycleCountLine.findUnique({ where: { id: created.session.lines[0].id } }),
      prisma.inventoryBalance.findUnique({ where: { id: ids.balanceA } }),
    ]);
    assert.deepEqual(
      [
        currentBalance.version,
        currentBalance.onHandQuantity.toString(),
        currentBalance.reservedQuantity.toString(),
        currentBalance.availableQuantity.toString(),
      ],
      [
        snapshotLine.recordedBalanceVersion,
        snapshotLine.recordedOnHandQuantity.toString(),
        snapshotLine.recordedReservedQuantity.toString(),
        snapshotLine.recordedAvailableQuantity.toString(),
      ],
    );
    const posted = await service.postCount(
      created.session.id,
      {
        expectedSessionVersion: reviewed.session.version,
        idempotencyKey: "count-post",
      },
      manager,
    );
    assert.equal(posted.movementIds.length, 1);
    const balance = await prisma.inventoryBalance.findUnique({
      where: { id: ids.balanceA },
    });
    assert.deepEqual(
      [
        balance.onHandQuantity.toString(),
        balance.reservedQuantity.toString(),
        balance.availableQuantity.toString(),
      ],
      ["11", "2", "9"],
    );
    const workbench = await createInventoryOperationsReadService({
      prisma,
      capabilities,
    }).countWorkbench(created.session.id, manager);
    assert.equal(workbench.reconciliation.status, "matched");
    assert.equal(workbench.lines[0].varianceQuantity, "1.0000");
  });

  test("cycle count fails closed when balance changes after snapshot", async () => {
    const ids = await seed(),
      service = createInventoryOperationsCommandService({ prisma, env }),
      ctx = identity(ids.tenantId, ids.managerId);
    const created = await service.createCount(
      {
        countNumber: `CC-STALE-${randomUUID()}`,
        warehouseId: ids.warehouseA,
        blindCount: false,
        balanceIds: [ids.balanceA],
        idempotencyKey: "stale-count-create",
      },
      ctx,
    );
    const entered = await service.reviseCount(
      created.session.id,
      {
        expectedSessionVersion: 0,
        idempotencyKey: "stale-count-enter",
        counts: [
          {
            countLineId: created.session.lines[0].id,
            countedQuantity: "10",
            expectedLineVersion: 0,
          },
        ],
      },
      ctx,
    );
    const submitted = await service.submitCount(
      created.session.id,
      {
        expectedSessionVersion: entered.session.version,
        idempotencyKey: "stale-count-submit",
      },
      ctx,
    );
    const reviewed = await service.reviewCount(
      created.session.id,
      {
        expectedSessionVersion: submitted.session.version,
        idempotencyKey: "stale-count-review",
      },
      ctx,
    );
    await prisma.inventoryBalance.update({
      where: { id: ids.balanceA },
      data: {
        onHandQuantity: "9",
        availableQuantity: "7",
        version: { increment: 1 },
      },
    });
    await assert.rejects(
      () =>
        service.postCount(
          created.session.id,
          {
            expectedSessionVersion: reviewed.session.version,
            idempotencyKey: "stale-count-post",
          },
          ctx,
        ),
      (error) => error.code === "COUNT_BALANCE_CHANGED",
    );
    assert.equal(
      await prisma.inventoryMovement.count({
        where: { tenantId: ids.tenantId, sourceDocumentId: created.session.id },
      }),
      0,
    );
  });

  test("governed adjustment posts, enforces roles and reserved inventory, then reverses", async () => {
    const ids = await seed(),
      service = createInventoryOperationsCommandService({ prisma, env });
    const specialist = identity(
        ids.tenantId,
        ids.specialistId,
        "business-specialist",
      ),
      manager = identity(ids.tenantId, ids.managerId);
    const created = await service.createAdjustment(
      {
        adjustmentNumber: `ADJ-${randomUUID()}`,
        reasonCode: "damage",
        notes: "Damaged stock",
        idempotencyKey: "adjust-create",
        lines: [{ inventoryBalanceId: ids.balanceA, adjustmentQuantity: "-2" }],
      },
      specialist,
    );
    assert.equal(
      (
        await prisma.inventoryBalance.findUnique({
          where: { id: ids.balanceA },
        })
      ).onHandQuantity.toString(),
      "10",
    );
    const ready = await service.readyAdjustment(
      created.adjustment.id,
      { expectedAdjustmentVersion: 0, idempotencyKey: "adjust-ready" },
      specialist,
    );
    await assert.rejects(
      () =>
        service.postAdjustment(
          created.adjustment.id,
          {
            expectedAdjustmentVersion: ready.adjustment.version,
            idempotencyKey: "adjust-specialist-post",
          },
          specialist,
        ),
      (error) => error.code === "PERMISSION_DENIED",
    );
    const posted = await service.postAdjustment(
      created.adjustment.id,
      {
        expectedAdjustmentVersion: ready.adjustment.version,
        idempotencyKey: "adjust-post",
      },
      manager,
    );
    let balance = await prisma.inventoryBalance.findUnique({
      where: { id: ids.balanceA },
    });
    assert.deepEqual(
      [
        balance.onHandQuantity.toString(),
        balance.reservedQuantity.toString(),
        balance.availableQuantity.toString(),
      ],
      ["8", "2", "6"],
    );
    const reversed = await service.reverseAdjustment(
      created.adjustment.id,
      {
        expectedAdjustmentVersion: posted.adjustment.version,
        idempotencyKey: "adjust-reverse",
        reason: "Correction",
      },
      manager,
    );
    balance = await prisma.inventoryBalance.findUnique({
      where: { id: ids.balanceA },
    });
    assert.deepEqual(
      [
        balance.onHandQuantity.toString(),
        balance.reservedQuantity.toString(),
        balance.availableQuantity.toString(),
      ],
      ["10", "2", "8"],
    );
    assert.equal(reversed.movementIds.length, 1);
    const workbench = await createInventoryOperationsReadService({
      prisma,
      capabilities,
    }).adjustmentWorkbench(created.adjustment.id, manager);
    assert.equal(workbench.reconciliation.status, "matched");
  });

  test("capability, role, tenant, and warehouse boundaries fail closed", async () => {
    const ids = await seed(),
      disabled = createInventoryOperationsCommandService({
        prisma,
        env: { ...env, FLOWCHAIN_ENABLE_DB_INVENTORY_OPERATIONS: "false" },
      });
    await assert.rejects(
      () =>
        disabled.createAdjustment(
          {
            adjustmentNumber: "DISABLED",
            reasonCode: "damage",
            idempotencyKey: "disabled",
            lines: [
              { inventoryBalanceId: ids.balanceA, adjustmentQuantity: "1" },
            ],
          },
          identity(ids.tenantId, ids.managerId),
        ),
      (error) => error.code === "INVENTORY_OPERATIONS_CAPABILITY_NOT_AVAILABLE",
    );
    const service = createInventoryOperationsCommandService({ prisma, env });
    await assert.rejects(
      () =>
        service.createCount(
          {
            countNumber: "VIEWER",
            warehouseId: ids.warehouseA,
            balanceIds: [ids.balanceA],
            idempotencyKey: "viewer",
          },
          identity(ids.tenantId, ids.viewerId, "viewer"),
        ),
      (error) => error.code === "PERMISSION_DENIED",
    );
    const read = createInventoryOperationsReadService({ prisma, capabilities });
    await assert.rejects(
      () =>
        read.adjustmentWorkbench(
          "missing",
          identity(ids.tenantId, ids.viewerId, "viewer"),
        ),
      (error) => error.code === "ADJUSTMENT_NOT_FOUND" && error.status === 404,
    );
  });
}
