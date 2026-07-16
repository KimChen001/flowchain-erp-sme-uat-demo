import {
  assertWarehouseAccess,
  hasWarehouseAccess,
  resolveProvisionedActor,
} from "./pilot-identity.mjs";
import {
  buildSupplierReturnDraftPlan,
  buildSupplierReturnPostingPlan,
  buildSupplierReturnReversalPlan,
  supplierReturnDecimalString as decimalString,
  supplierReturnDecimalUnits as decimalUnits,
} from "./supplier-return-transaction-policy.mjs";

export class SupplierReturnReadError extends Error {
  constructor(code, message, status = 400, details) {
    super(message);
    this.name = "SupplierReturnReadError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const text = (value) => String(value ?? "").trim();
const fixed = (value) => decimalString(decimalUnits(value || 0));
const postingRoles = new Set([
  "admin",
  "manager",
  "business-specialist",
  "business_specialist",
  "buyer",
]);

function capabilityState(capability) {
  return capability || {
    id: "return-posting",
    enabled: false,
    readReady: true,
    writeReady: false,
  };
}

function publicLine(line) {
  return {
    id: line.id,
    returnAuthorizationLineId: line.returnAuthorizationLineId,
    returnRequestLineId: line.returnRequestLineId,
    itemId: line.itemId,
    sku: line.sku,
    itemName: line.itemName,
    unit: line.unit,
    quantity: line.quantity || fixed(line.quantityUnits),
    dispositionRoute: line.dispositionRoute,
    balanceType: line.balanceType,
    balanceId: line.balanceId,
    inventoryBalanceId: line.inventoryBalanceId,
    quarantineBalanceId: line.quarantineBalanceId,
    warehouseId: line.warehouseId,
    location: line.location,
    locationKey: line.locationKey,
    remainingAuthorizedBefore: line.remainingAuthorizedBefore,
    remainingAuthorizedAfter: line.remainingAuthorizedAfter,
    version: line.version,
  };
}

function publicImpact(impact) {
  return Object.fromEntries(
    Object.entries(impact).filter(([key]) => key !== "quantityUnits"),
  );
}

function publicMovement(fact) {
  return Object.fromEntries(
    Object.entries(fact).filter(
      ([key]) => key !== "quantityUnits" && key !== "movement",
    ),
  );
}

function planModel(plan) {
  return {
    allowed: plan.allowed,
    blockingIssues: plan.blockingIssues,
    warnings: plan.warnings,
    normalizedPlan: {
      ...plan.normalizedPlan,
      lines: (plan.normalizedPlan?.lines || []).map(publicLine),
    },
    balanceImpacts: (plan.balanceImpacts || []).map(publicImpact),
    documentImpacts: plan.documentImpacts || [],
    movementFacts: (plan.movementFacts || []).map(publicMovement),
    reconciliationImpacts: plan.reconciliationImpacts || [],
    totalAuthorizedQuantity: plan.totalAuthorizedQuantity,
    executedQuantityBefore: plan.executedQuantityBefore,
    executedQuantityAfter: plan.executedQuantityAfter,
    authorizationStatusAfter: plan.authorizationStatusAfter,
    requestStatusAfter: plan.requestStatusAfter,
  };
}

function postingModel(posting) {
  return {
    id: posting.id,
    postingNumber: posting.postingNumber,
    postingType: posting.postingType,
    workflowStatus: posting.workflowStatus,
    postingStatus: posting.postingStatus,
    warehouseId: posting.warehouseId,
    returnAuthorizationId: posting.returnAuthorizationId,
    version: posting.version,
    readyAt: posting.readyAt?.toISOString?.() || null,
    readyById: posting.readyById,
    cancelledAt: posting.cancelledAt?.toISOString?.() || null,
    cancelledById: posting.cancelledById,
    cancellationReason: posting.cancellationReason,
    postedAt: posting.postedAt?.toISOString?.() || null,
    postedById: posting.postedById,
    reversedAt: posting.reversedAt?.toISOString?.() || null,
    reversedById: posting.reversedById,
    reversalReason: posting.reversalReason,
    postingBatchId: posting.metadata?.postingBatchId || null,
    reversalPostingBatchId:
      posting.metadata?.reversalPostingBatchId || null,
  };
}

export function createSupplierReturnReadService({
  prisma,
  capability,
  now = () => new Date(),
} = {}) {
  if (!prisma) throw new Error("prisma is required");
  const currentCapability = capabilityState(capability);

  async function actorFor(context) {
    const identity = context?.identity || context;
    return resolveProvisionedActor(prisma, identity);
  }

  async function previewDraft(authorizationId, input, context) {
    const actor = await actorFor(context);
    const plan = await buildSupplierReturnDraftPlan({
      prisma,
      tenantId: actor.tenantId,
      authorizationId,
      lines: input?.lines,
      now: now(),
    });
    if (plan.warehouseIds?.length)
      assertWarehouseAccess(actor, plan.warehouseIds, "operate");
    return {
      dataSource: "Authoritative PostgreSQL",
      transactionType: "supplier_return_dispatch",
      capability: currentCapability,
      preview: planModel(plan),
    };
  }

  async function previewReady(postingId, context) {
    const actor = await actorFor(context);
    const plan = await buildSupplierReturnPostingPlan({
      prisma,
      tenantId: actor.tenantId,
      postingId,
      now: now(),
      allowedWorkflowStatuses: ["draft"],
    });
    if (plan.warehouseIds?.length)
      assertWarehouseAccess(actor, plan.warehouseIds, "operate");
    return {
      dataSource: "Authoritative PostgreSQL",
      transactionType: "supplier_return_dispatch",
      action: "ready",
      capability: currentCapability,
      preview: planModel(plan),
    };
  }

  async function previewPost(postingId, context) {
    const actor = await actorFor(context);
    const plan = await buildSupplierReturnPostingPlan({
      prisma,
      tenantId: actor.tenantId,
      postingId,
      now: now(),
    });
    if (plan.warehouseIds?.length)
      assertWarehouseAccess(actor, plan.warehouseIds, "operate");
    return {
      dataSource: "Authoritative PostgreSQL",
      transactionType: "supplier_return_dispatch",
      action: "post",
      capability: currentCapability,
      preview: planModel(plan),
    };
  }

  async function previewReverse(postingId, context) {
    const actor = await actorFor(context);
    const plan = await buildSupplierReturnReversalPlan({
      prisma,
      tenantId: actor.tenantId,
      postingId,
    });
    if (plan.warehouseIds?.length)
      assertWarehouseAccess(actor, plan.warehouseIds, "operate");
    return {
      dataSource: "Authoritative PostgreSQL",
      transactionType: "supplier_return_dispatch",
      action: "reverse",
      capability: currentCapability,
      preview: planModel(plan),
    };
  }

  async function postingWorkbench(postingId, context) {
    const actor = await actorFor(context);
    const posting = await prisma.returnPostingDocument.findFirst({
      where: { id: text(postingId), tenantId: actor.tenantId },
      include: {
        lines: {
          include: {
            returnAuthorizationLine: {
              include: { returnRequestLine: true },
            },
          },
          orderBy: { id: "asc" },
        },
        returnAuthorization: {
          include: { returnRequest: true },
        },
      },
    });
    if (!posting)
      throw new SupplierReturnReadError(
        "RETURN_POSTING_NOT_FOUND",
        "Return posting was not found.",
        404,
      );
    assertWarehouseAccess(actor, [posting.warehouseId], "read", {
      maskExistence: true,
    });
    const canOperate =
      currentCapability.enabled &&
      postingRoles.has(actor.role) &&
      hasWarehouseAccess(actor, [posting.warehouseId], "operate");
    const [movements, audit] = await Promise.all([
      prisma.inventoryMovement.findMany({
        where: {
          tenantId: actor.tenantId,
          sourceDocumentType: "ReturnPostingDocument",
          sourceDocumentId: posting.id,
        },
        orderBy: { occurredAt: "asc" },
      }),
      prisma.auditLog.findMany({
        where: {
          tenantId: actor.tenantId,
          entityType: "ReturnPostingDocument",
          entityId: posting.id,
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    return {
      dataSource: "Authoritative PostgreSQL",
      capability: currentCapability,
      posting: postingModel(posting),
      returnAuthorization: {
        id: posting.returnAuthorization.id,
        authorizationNumber:
          posting.returnAuthorization.authorizationNumber,
        workflowStatus: posting.returnAuthorization.workflowStatus,
        version: posting.returnAuthorization.version,
      },
      returnRequest: {
        id: posting.returnAuthorization.returnRequest.id,
        requestNumber:
          posting.returnAuthorization.returnRequest.requestNumber,
        returnType: posting.returnAuthorization.returnRequest.returnType,
        workflowStatus:
          posting.returnAuthorization.returnRequest.workflowStatus,
        version: posting.returnAuthorization.returnRequest.version,
      },
      lines: posting.lines.map((line) => ({
        id: line.id,
        returnAuthorizationLineId: line.returnAuthorizationLineId,
        returnRequestLineId:
          line.returnAuthorizationLine.returnRequestLineId,
        sku: line.sku,
        itemName: line.itemName,
        quantity: fixed(line.quantity),
        unit: line.unit,
        warehouseId: line.warehouseId,
        location: line.location,
        locationKey: line.locationKey,
        balanceType: line.inventoryBalanceId
          ? "available"
          : "quarantine",
        balanceId:
          line.inventoryBalanceId || line.quarantineBalanceId,
        dispositionRoute:
          line.returnAuthorizationLine.dispositionRoute,
      })),
      availableActions: {
        revise:
          canOperate &&
          posting.workflowStatus === "draft" &&
          posting.postingStatus === "unposted",
        ready:
          canOperate &&
          posting.workflowStatus === "draft" &&
          posting.postingStatus === "unposted",
        cancel:
          canOperate &&
          ["draft", "ready"].includes(posting.workflowStatus) &&
          posting.postingStatus === "unposted",
        post:
          canOperate &&
          posting.workflowStatus === "ready" &&
          posting.postingStatus === "unposted",
        reverse:
          canOperate &&
          posting.postingStatus === "posted" &&
          !posting.reversedAt,
      },
      evidence: {
        movements: movements.map((movement) => ({
          id: movement.id,
          movementType: movement.movementType,
          postingBatchId: movement.postingBatchId,
          reversalOfMovementId: movement.reversalOfMovementId,
          reversedByMovementId: movement.reversedByMovementId,
          quantityIn: fixed(movement.quantityIn),
          quantityOut: fixed(movement.quantityOut),
          balanceType: movement.metadata?.balanceType,
          balanceId: movement.metadata?.balanceId,
          occurredAt: movement.occurredAt?.toISOString?.() || null,
        })),
        audit: audit.map((entry) => ({
          id: entry.id,
          action: entry.action,
          actorId: entry.actorId,
          createdAt: entry.createdAt?.toISOString?.() || null,
          metadata: entry.metadata,
        })),
      },
      limitations:
        posting.postingType === "customer_return_receipt"
          ? [
              "Phase 4B.3 customer return receipts increase quarantine inventory only.",
              "Quarantine release to available inventory remains unavailable until its transaction gate passes.",
            ]
          : [
              "Phase 4B.2 supports supplier return dispatch from available or quarantine inventory.",
              "Quarantine release to available inventory remains unavailable until its transaction gate passes.",
            ],
    };
  }

  return {
    previewDraft,
    previewReady,
    previewPost,
    previewReverse,
    postingWorkbench,
  };
}
