import { resolveProvisionedActor } from "./pilot-identity.mjs";
import {
  inventoryOperationDecimalString as fixed,
  inventoryOperationDecimalUnits as units,
} from "./inventory-operations-policy.mjs";

const text = (value) => String(value ?? "").trim();
const iso = (value) => (value ? new Date(value).toISOString() : null);
const canRead = (actor, warehouseId) =>
  actor.allWarehouses || actor.readWarehouseIds?.has(text(warehouseId));
const canOperate = (actor, warehouseId) =>
  actor.allWarehouses || actor.operateWarehouseIds?.has(text(warehouseId));
const mutator = (role) =>
  ["admin", "manager", "business-specialist", "business_specialist"].includes(
    role,
  );
const manager = (role) => ["admin", "manager"].includes(role);

function page(query = {}) {
  const number = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const size = Math.min(
    100,
    Math.max(1, Number.parseInt(query.pageSize, 10) || 20),
  );
  return { page: number, pageSize: size, skip: (number - 1) * size };
}

function scopeWhere(actor, field = "warehouseId") {
  if (actor.allWarehouses) return {};
  return { [field]: { in: [...(actor.readWarehouseIds || [])] } };
}

function transferWarehouses(transfer) {
  return [
    ...new Set(
      transfer.lines.flatMap((line) => line.legs.map((leg) => leg.warehouseId)),
    ),
  ];
}

function movementModel(row) {
  return {
    id: row.id,
    movementType: row.movementType,
    sku: row.sku,
    warehouseId: row.warehouseId,
    location: row.location || "",
    locationKey: row.locationKey,
    quantityIn: fixed(units(row.quantityIn)),
    quantityOut: fixed(units(row.quantityOut)),
    adjustmentQty: fixed(units(row.adjustmentQty)),
    postingBatchId: row.postingBatchId,
    sourceDocumentLineId: row.sourceDocumentLineId,
    reversalOfMovementId: row.reversalOfMovementId,
    reversedByMovementId: row.reversedByMovementId,
    occurredAt: iso(row.occurredAt),
  };
}

async function evidence(prisma, actor, entityType, entityId, warehouseIds) {
  if (!warehouseIds.every((id) => canRead(actor, id))) return [];
  return (
    await prisma.auditLog.findMany({
      where: { tenantId: actor.tenantId, entityType, entityId },
      include: { actor: true },
      orderBy: { createdAt: "asc" },
    })
  ).map((row) => ({
    eventType: row.action,
    title: row.summary,
    summary: row.summary,
    occurredAt: iso(row.createdAt),
    actor: row.actor ? { id: row.actor.id, name: row.actor.name } : null,
    entityType,
    entityId,
    commandType: row.metadata?.commandType || row.action,
    idempotencyKey: row.metadata?.idempotencyKey || null,
  }));
}

export function createInventoryOperationsReadService({
  prisma,
  capabilities = {},
} = {}) {
  if (!prisma) throw new Error("prisma is required");
  const enabled = Object.values(capabilities).every(
    (entry) => entry?.enabled === true,
  );

  async function entryData(context) {
    const actor = await resolveProvisionedActor(
      prisma,
      context?.identity || context,
    );
    const warehouseWhere = actor.allWarehouses
      ? { tenantId: actor.tenantId, status: "active" }
      : {
          tenantId: actor.tenantId,
          status: "active",
          id: { in: [...(actor.readWarehouseIds || [])] },
        };
    const [warehouses, balances, items] = await Promise.all([
      prisma.warehouse.findMany({
        where: warehouseWhere,
        orderBy: { code: "asc" },
      }),
      prisma.inventoryBalance.findMany({
        where: { tenantId: actor.tenantId, ...scopeWhere(actor) },
        orderBy: [
          { sku: "asc" },
          { warehouseId: "asc" },
          { locationKey: "asc" },
        ],
      }),
      prisma.item.findMany({
        where: { tenantId: actor.tenantId, status: "active" },
        orderBy: { sku: "asc" },
      }),
    ]);
    return {
      dataSource: "Authoritative PostgreSQL",
      capabilities,
      warehouses: warehouses.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        canOperate: canOperate(actor, row.id),
      })),
      items: items.map((row) => ({
        id: row.id,
        sku: row.sku,
        name: row.name,
        unit: row.unit,
      })),
      balances: balances.map((row) => ({
        id: row.id,
        itemId: row.itemId,
        sku: row.sku,
        itemName: row.itemName,
        warehouseId: row.warehouseId,
        location: row.location || "",
        locationKey: row.locationKey,
        onHandQuantity: fixed(units(row.onHandQuantity)),
        reservedQuantity: fixed(units(row.reservedQuantity)),
        availableQuantity: fixed(units(row.availableQuantity)),
        unit: row.unit,
        version: row.version,
        canOperate: canOperate(actor, row.warehouseId),
      })),
    };
  }

  async function listTransfers(query, context) {
    const actor = await resolveProvisionedActor(
        prisma,
        context?.identity || context,
      ),
      paging = page(query);
    const where = {
      tenantId: actor.tenantId,
      ...(text(query.workflowStatus)
        ? { workflowStatus: text(query.workflowStatus) }
        : {}),
      ...(text(query.postingStatus)
        ? { postingStatus: text(query.postingStatus) }
        : {}),
    };
    const candidates = await prisma.stockTransferDocument.findMany({
      where,
      include: { lines: { include: { legs: true } } },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    });
    const visible = candidates.filter((row) =>
      transferWarehouses(row).every((id) => canRead(actor, id)),
    );
    return {
      dataSource: "Authoritative PostgreSQL",
      page: paging.page,
      pageSize: paging.pageSize,
      total: visible.length,
      capabilities,
      transfers: visible
        .slice(paging.skip, paging.skip + paging.pageSize)
        .map((row) => ({
          id: row.id,
          transferNumber: row.transferNumber,
          workflowStatus: row.workflowStatus,
          postingStatus: row.postingStatus,
          version: row.version,
          lineCount: row.lines.length,
          sourceWarehouses: [
            ...new Set(
              row.lines.flatMap((line) =>
                line.legs
                  .filter((leg) => leg.direction === "source")
                  .map((leg) => leg.warehouseId),
              ),
            ),
          ],
          destinationWarehouses: [
            ...new Set(
              row.lines.flatMap((line) =>
                line.legs
                  .filter((leg) => leg.direction === "destination")
                  .map((leg) => leg.warehouseId),
              ),
            ),
          ],
          createdAt: iso(row.createdAt),
          updatedAt: iso(row.updatedAt),
        })),
    };
  }

  async function transferWorkbench(id, context) {
    const actor = await resolveProvisionedActor(
      prisma,
      context?.identity || context,
    );
    const transfer = await prisma.stockTransferDocument.findFirst({
      where: { id: text(id), tenantId: actor.tenantId },
      include: {
        lines: {
          include: { legs: { orderBy: { direction: "asc" } } },
          orderBy: { id: "asc" },
        },
      },
    });
    if (
      !transfer ||
      !transferWarehouses(transfer).every((warehouseId) =>
        canRead(actor, warehouseId),
      )
    ) {
      const error = new Error("Stock transfer was not found.");
      error.code = "TRANSFER_NOT_FOUND";
      error.status = 404;
      throw error;
    }
    const movements = await prisma.inventoryMovement.findMany({
      where: {
        tenantId: actor.tenantId,
        sourceDocumentType: "StockTransferDocument",
        sourceDocumentId: transfer.id,
      },
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
    });
    const warehouses = transferWarehouses(transfer),
      operate = warehouses.every((warehouseId) =>
        canOperate(actor, warehouseId),
      );
    const availableActions = {
      canEdit:
        enabled &&
        mutator(actor.role) &&
        operate &&
        transfer.workflowStatus === "draft" &&
        transfer.postingStatus === "unposted",
      canReady:
        enabled &&
        mutator(actor.role) &&
        operate &&
        transfer.workflowStatus === "draft" &&
        transfer.postingStatus === "unposted",
      canCancel:
        enabled &&
        mutator(actor.role) &&
        operate &&
        ["draft", "ready"].includes(transfer.workflowStatus) &&
        transfer.postingStatus === "unposted",
      canPost:
        enabled &&
        mutator(actor.role) &&
        operate &&
        transfer.workflowStatus === "ready" &&
        transfer.postingStatus === "unposted",
      canReverse:
        enabled &&
        mutator(actor.role) &&
        operate &&
        transfer.postingStatus === "posted",
      blockingReasonCodes: [],
    };
    if (!enabled)
      availableActions.blockingReasonCodes.push(
        "INVENTORY_OPERATIONS_CAPABILITY_NOT_AVAILABLE",
      );
    if (!operate)
      availableActions.blockingReasonCodes.push("WAREHOUSE_SCOPE_DENIED");
    const posted = movements.filter((row) =>
        ["stock_transfer_out", "stock_transfer_in"].includes(row.movementType),
      ),
      reversals = movements.filter((row) =>
        row.movementType.includes("reversal"),
      );
    const transferNet = movements.reduce(
      (sum, row) => sum + units(row.quantityIn) - units(row.quantityOut),
      0n,
    );
    const reconciliation = {
      status:
        transfer.postingStatus === "unposted"
          ? "unavailable"
          : transferNet === 0n &&
              posted.length === transfer.lines.length * 2 &&
              (transfer.postingStatus !== "reversed" ||
                reversals.length === transfer.lines.length * 2)
            ? "matched"
            : "mismatch",
      checks: [
        {
          rule: "transfer net inventory change = 0",
          recorded: fixed(transferNet),
        },
        {
          rule: "two posting movements per line",
          recorded: String(posted.length),
          expected: String(transfer.lines.length * 2),
        },
      ],
    };
    const smartLinks = movements.map((row) => ({
      id: `movement-${row.id}`,
      label: row.movementType,
      count: 1,
      targetRouteId: "inventory:movements",
      targetType: "inventory_movement",
      targetId: row.id,
      filter: {
        sourceDocumentId: transfer.id,
        sourceDocumentLineId: row.sourceDocumentLineId,
      },
      enabled: true,
      unavailableReason: null,
    }));
    return {
      dataSource: "Authoritative PostgreSQL",
      transfer: {
        ...transfer,
        createdAt: iso(transfer.createdAt),
        updatedAt: iso(transfer.updatedAt),
        postedAt: iso(transfer.postedAt),
        reversedAt: iso(transfer.reversedAt),
      },
      lines: transfer.lines.map((line) => ({
        id: line.id,
        itemId: line.itemId,
        sku: line.sku,
        itemName: line.itemName,
        quantity: fixed(units(line.quantity)),
        unit: line.unit,
        version: line.version,
        source: line.legs.find((leg) => leg.direction === "source"),
        destination: line.legs.find((leg) => leg.direction === "destination"),
      })),
      movements: movements.map(movementModel),
      availableActions,
      capabilities,
      evidence: await evidence(
        prisma,
        actor,
        "StockTransferDocument",
        transfer.id,
        warehouses,
      ),
      smartLinks,
      reconciliation,
      limitations: [
        "Atomic source-to-destination transfer; in-transit workflow is not supported.",
      ],
    };
  }

  async function listCountSessions(query, context) {
    const actor = await resolveProvisionedActor(
        prisma,
        context?.identity || context,
      ),
      paging = page(query);
    const where = {
      tenantId: actor.tenantId,
      ...scopeWhere(actor),
      ...(text(query.workflowStatus)
        ? { workflowStatus: text(query.workflowStatus) }
        : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.cycleCountSession.count({ where }),
      prisma.cycleCountSession.findMany({
        where,
        include: { lines: true },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        skip: paging.skip,
        take: paging.pageSize,
      }),
    ]);
    return {
      dataSource: "Authoritative PostgreSQL",
      ...paging,
      total,
      capabilities,
      counts: rows.map((row) => ({
        id: row.id,
        countNumber: row.countNumber,
        warehouseId: row.warehouseId,
        workflowStatus: row.workflowStatus,
        blindCount: row.blindCount,
        version: row.version,
        lineCount: row.lines.length,
        createdAt: iso(row.createdAt),
        updatedAt: iso(row.updatedAt),
      })),
    };
  }

  async function countWorkbench(id, context) {
    const actor = await resolveProvisionedActor(
      prisma,
      context?.identity || context,
    );
    const session = await prisma.cycleCountSession.findFirst({
      where: { id: text(id), tenantId: actor.tenantId },
      include: { lines: { orderBy: { id: "asc" } } },
    });
    if (!session || !canRead(actor, session.warehouseId)) {
      const error = new Error("Cycle count was not found.");
      error.code = "COUNT_NOT_FOUND";
      error.status = 404;
      throw error;
    }
    const reveal =
      !session.blindCount ||
      manager(actor.role) ||
      ["submitted", "reviewed", "posted"].includes(session.workflowStatus);
    const movements = await prisma.inventoryMovement.findMany({
      where: {
        tenantId: actor.tenantId,
        sourceDocumentType: "CycleCountSession",
        sourceDocumentId: session.id,
      },
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
    });
    const operate = canOperate(actor, session.warehouseId);
    const availableActions = {
      canEdit:
        enabled &&
        mutator(actor.role) &&
        operate &&
        ["draft", "in_progress"].includes(session.workflowStatus),
      canSubmit:
        enabled &&
        mutator(actor.role) &&
        operate &&
        ["draft", "in_progress"].includes(session.workflowStatus) &&
        session.lines.every((line) => line.countedQuantity !== null),
      canReview:
        enabled &&
        manager(actor.role) &&
        operate &&
        session.workflowStatus === "submitted",
      canPost:
        enabled &&
        manager(actor.role) &&
        operate &&
        session.workflowStatus === "reviewed",
      canCancel:
        enabled &&
        mutator(actor.role) &&
        operate &&
        !["posted", "cancelled"].includes(session.workflowStatus),
      blockingReasonCodes: [],
    };
    if (!enabled)
      availableActions.blockingReasonCodes.push(
        "INVENTORY_OPERATIONS_CAPABILITY_NOT_AVAILABLE",
      );
    const checks = session.lines.map((line) => ({
      rule: "variance = counted - recorded",
      lineId: line.id,
      status:
        line.countedQuantity === null
          ? "unavailable"
          : units(line.countedQuantity) - units(line.recordedOnHandQuantity) ===
              units(line.varianceQuantity)
            ? "matched"
            : "mismatch",
    }));
    return {
      dataSource: "Authoritative PostgreSQL",
      session: {
        ...session,
        submittedAt: iso(session.submittedAt),
        reviewedAt: iso(session.reviewedAt),
        postedAt: iso(session.postedAt),
        createdAt: iso(session.createdAt),
        updatedAt: iso(session.updatedAt),
      },
      lines: session.lines.map((line) => ({
        id: line.id,
        inventoryBalanceId: line.inventoryBalanceId,
        itemId: line.itemId,
        sku: line.sku,
        itemName: line.itemName,
        warehouseId: line.warehouseId,
        location: line.location || "",
        locationKey: line.locationKey,
        unit: line.unit,
        recordedOnHandQuantity: reveal
          ? fixed(units(line.recordedOnHandQuantity))
          : null,
        recordedReservedQuantity: reveal
          ? fixed(units(line.recordedReservedQuantity))
          : null,
        recordedAvailableQuantity: reveal
          ? fixed(units(line.recordedAvailableQuantity))
          : null,
        countedQuantity:
          line.countedQuantity === null
            ? null
            : fixed(units(line.countedQuantity)),
        varianceQuantity:
          reveal && line.varianceQuantity !== null
            ? fixed(units(line.varianceQuantity))
            : null,
        version: line.version,
      })),
      movements: movements.map(movementModel),
      availableActions,
      capabilities,
      evidence: await evidence(prisma, actor, "CycleCountSession", session.id, [
        session.warehouseId,
      ]),
      reconciliation: {
        status:
          session.workflowStatus !== "posted"
            ? "unavailable"
            : checks.every((row) => row.status === "matched")
              ? "matched"
              : "mismatch",
        checks,
      },
      limitations: [
        "Posted cycle counts cannot be reversed; use a governed inventory adjustment.",
      ],
    };
  }

  async function listAdjustments(query, context) {
    const actor = await resolveProvisionedActor(
        prisma,
        context?.identity || context,
      ),
      paging = page(query);
    const candidates = await prisma.inventoryAdjustmentDocument.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(text(query.workflowStatus)
          ? { workflowStatus: text(query.workflowStatus) }
          : {}),
        ...(text(query.postingStatus)
          ? { postingStatus: text(query.postingStatus) }
          : {}),
      },
      include: { lines: true },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    });
    const visible = candidates.filter((row) =>
      row.lines.every((line) => canRead(actor, line.warehouseId)),
    );
    return {
      dataSource: "Authoritative PostgreSQL",
      page: paging.page,
      pageSize: paging.pageSize,
      total: visible.length,
      capabilities,
      adjustments: visible
        .slice(paging.skip, paging.skip + paging.pageSize)
        .map((row) => ({
          id: row.id,
          adjustmentNumber: row.adjustmentNumber,
          reasonCode: row.reasonCode,
          workflowStatus: row.workflowStatus,
          postingStatus: row.postingStatus,
          version: row.version,
          lineCount: row.lines.length,
          createdAt: iso(row.createdAt),
          updatedAt: iso(row.updatedAt),
        })),
    };
  }

  async function adjustmentWorkbench(id, context) {
    const actor = await resolveProvisionedActor(
      prisma,
      context?.identity || context,
    );
    const adjustment = await prisma.inventoryAdjustmentDocument.findFirst({
      where: { id: text(id), tenantId: actor.tenantId },
      include: { lines: { orderBy: { id: "asc" } } },
    });
    const warehouses = adjustment
      ? [...new Set(adjustment.lines.map((line) => line.warehouseId))]
      : [];
    if (
      !adjustment ||
      !warehouses.every((warehouseId) => canRead(actor, warehouseId))
    ) {
      const error = new Error("Inventory adjustment was not found.");
      error.code = "ADJUSTMENT_NOT_FOUND";
      error.status = 404;
      throw error;
    }
    const movements = await prisma.inventoryMovement.findMany({
      where: {
        tenantId: actor.tenantId,
        sourceDocumentType: "InventoryAdjustmentDocument",
        sourceDocumentId: adjustment.id,
      },
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
    });
    const operate = warehouses.every((warehouseId) =>
      canOperate(actor, warehouseId),
    );
    const availableActions = {
      canEdit:
        enabled &&
        mutator(actor.role) &&
        operate &&
        adjustment.workflowStatus === "draft",
      canReady:
        enabled &&
        mutator(actor.role) &&
        operate &&
        adjustment.workflowStatus === "draft",
      canCancel:
        enabled &&
        mutator(actor.role) &&
        operate &&
        ["draft", "ready"].includes(adjustment.workflowStatus) &&
        adjustment.postingStatus === "unposted",
      canPost:
        enabled &&
        manager(actor.role) &&
        operate &&
        adjustment.workflowStatus === "ready" &&
        adjustment.postingStatus === "unposted",
      canReverse:
        enabled &&
        manager(actor.role) &&
        operate &&
        adjustment.postingStatus === "posted",
      blockingReasonCodes: [],
    };
    if (!enabled)
      availableActions.blockingReasonCodes.push(
        "INVENTORY_OPERATIONS_CAPABILITY_NOT_AVAILABLE",
      );
    const effective = movements.reduce(
        (sum, row) => sum + units(row.adjustmentQty),
        0n,
      ),
      expected =
        adjustment.postingStatus === "posted"
          ? adjustment.lines.reduce(
              (sum, line) => sum + units(line.adjustmentQuantity),
              0n,
            )
          : 0n;
    return {
      dataSource: "Authoritative PostgreSQL",
      adjustment: {
        ...adjustment,
        postedAt: iso(adjustment.postedAt),
        reversedAt: iso(adjustment.reversedAt),
        createdAt: iso(adjustment.createdAt),
        updatedAt: iso(adjustment.updatedAt),
      },
      lines: adjustment.lines.map((line) => ({
        ...line,
        adjustmentQuantity: fixed(units(line.adjustmentQuantity)),
      })),
      movements: movements.map(movementModel),
      availableActions,
      capabilities,
      evidence: await evidence(
        prisma,
        actor,
        "InventoryAdjustmentDocument",
        adjustment.id,
        warehouses,
      ),
      smartLinks: movements.map((row) => ({
        id: `movement-${row.id}`,
        label: row.movementType,
        count: 1,
        targetRouteId: "inventory:movements",
        targetType: "inventory_movement",
        targetId: row.id,
        filter: {
          sourceDocumentId: adjustment.id,
          sourceDocumentLineId: row.sourceDocumentLineId,
        },
        enabled: true,
        unavailableReason: null,
      })),
      reconciliation: {
        status:
          adjustment.postingStatus === "unposted"
            ? "unavailable"
            : effective === expected
              ? "matched"
              : "mismatch",
        checks: [
          {
            rule: "effective movement delta = document delta",
            recorded: fixed(effective),
            expected: fixed(expected),
          },
        ],
      },
      limitations: ["Adjustments only target existing inventory balances."],
    };
  }

  return {
    entryData,
    listTransfers,
    transferWorkbench,
    listCountSessions,
    countWorkbench,
    listAdjustments,
    adjustmentWorkbench,
  };
}
