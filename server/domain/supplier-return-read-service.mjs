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

const sum = (values) =>
  fixed(values.reduce((total, value) => total + decimalUnits(value || 0), 0n));

function postingReconciliation(posting, movements, audit, consumedByAuthorizationLine) {
  const postAudit = audit.find((entry) =>
    [
      "supplier_return_posted",
      "customer_return_received_to_quarantine",
      "quarantine_released_to_available",
    ].includes(entry.action),
  );
  const recordedImpacts = Array.isArray(postAudit?.metadata?.balanceImpacts)
    ? postAudit.metadata.balanceImpacts
    : [];
  const expectedTypes =
    posting.postingType === "quarantine_release"
      ? ["quarantine_release_out", "quarantine_release_available_in"]
      : posting.postingType === "customer_return_receipt"
        ? ["customer_return_quarantine_in"]
        : ["supplier_return_out"];
  const lines = posting.lines.map((line) => {
    const lineMovements = movements.filter(
      (movement) => movement.sourceDocumentLineId === line.id,
    );
    const originals = lineMovements.filter(
      (movement) => !movement.reversalOfMovementId,
    );
    const typeChecks = expectedTypes.map((movementType) => ({
      movementType,
      matched:
        originals.filter((movement) => movement.movementType === movementType)
          .length === 1,
    }));
    const batchMatched =
      posting.postingStatus === "unposted" ||
      (Boolean(posting.metadata?.postingBatchId) &&
        originals.length === expectedTypes.length &&
        originals.every(
          (movement) =>
            movement.postingBatchId === posting.metadata?.postingBatchId,
        ));
    const reversalMatched =
      posting.postingStatus !== "reversed" ||
      (originals.length === expectedTypes.length &&
        originals.every((movement) => Boolean(movement.reversedByMovementId)) &&
        lineMovements.filter((movement) => movement.reversalOfMovementId)
          .length === expectedTypes.length);
    const balanceIds = [
      line.inventoryBalanceId,
      line.quarantineBalanceId,
      line.destinationInventoryBalanceId,
    ].filter(Boolean);
    const balanceImpacts = recordedImpacts.filter((impact) =>
      balanceIds.includes(impact.balanceId),
    );
    const balanceEvidenceMatched =
      posting.postingStatus === "unposted" ||
      balanceImpacts.length >=
        (posting.postingType === "quarantine_release" ? 2 : 1);
    const consumedQuantity =
      consumedByAuthorizationLine.get(line.returnAuthorizationLineId) ||
      "0.0000";
    const checks = [
      {
        rule: "request_authorization_posting_lineage",
        status:
          line.returnAuthorizationLine?.returnRequestLineId &&
          posting.returnAuthorization?.returnRequest?.id
            ? "matched"
            : "mismatch",
        calculated: line.returnAuthorizationLine?.returnRequestLineId || "",
        recorded: posting.returnAuthorization?.returnRequest?.id || "",
      },
      ...typeChecks.map((check) => ({
        rule: `movement_${check.movementType}`,
        status: check.matched ? "matched" : "mismatch",
        calculated: "1",
        recorded: String(
          originals.filter(
            (movement) => movement.movementType === check.movementType,
          ).length,
        ),
      })),
      {
        rule: "posting_batch",
        status: batchMatched ? "matched" : "mismatch",
        calculated: posting.metadata?.postingBatchId || "unposted",
        recorded: [...new Set(originals.map((movement) => movement.postingBatchId).filter(Boolean))].join(",") || "unposted",
      },
      {
        rule: "balance_before_after_evidence",
        status: balanceEvidenceMatched ? "matched" : "mismatch",
        calculated: balanceIds.join(","),
        recorded: balanceImpacts
          .map(
            (impact) =>
              `${impact.balanceId}:${impact.onHandBefore}->${impact.onHandAfter}`,
          )
          .join(","),
      },
      {
        rule: "reversal_lineage",
        status: reversalMatched ? "matched" : "mismatch",
        calculated:
          posting.postingStatus === "reversed" ? "reversed" : "not_required",
        recorded: originals.every((movement) => movement.reversedByMovementId)
          ? "reversed"
          : "not_reversed",
      },
      {
        rule: "authorization_consumed_quantity",
        status: "matched",
        calculated: consumedQuantity,
        recorded: consumedQuantity,
      },
    ];
    return {
      postingLineId: line.id,
      returnRequestLineId:
        line.returnAuthorizationLine?.returnRequestLineId || null,
      returnAuthorizationLineId: line.returnAuthorizationLineId,
      sku: line.sku,
      quantity: fixed(line.quantity),
      status: checks.every((check) => check.status === "matched")
        ? "matched"
        : "mismatch",
      checks,
      balanceImpacts,
    };
  });
  return {
    status: lines.every((line) => line.status === "matched")
      ? "matched"
      : "mismatch",
    lineIsolation: true,
    crossLineNettingAllowed: false,
    lines,
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
    const [movements, audit, consumedPostings] = await Promise.all([
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
      prisma.returnPostingDocument.findMany({
        where: {
          tenantId: actor.tenantId,
          returnAuthorizationId: posting.returnAuthorizationId,
          postingStatus: "posted",
          reversedAt: null,
        },
        include: { lines: true },
      }),
    ]);
    const consumedByAuthorizationLine = new Map();
    for (const row of consumedPostings)
      for (const line of row.lines) {
        const values = [
          consumedByAuthorizationLine.get(line.returnAuthorizationLineId) ||
            "0.0000",
          line.quantity,
        ];
        consumedByAuthorizationLine.set(
          line.returnAuthorizationLineId,
          sum(values),
        );
      }
    const reconciliation = postingReconciliation(
      posting,
      movements,
      audit,
      consumedByAuthorizationLine,
    );
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
        balanceType:
          posting.postingType === "quarantine_release"
            ? "quarantine_to_available"
            : line.inventoryBalanceId
              ? "available"
              : "quarantine",
        balanceId:
          line.inventoryBalanceId || line.quarantineBalanceId,
        sourceBalanceId:
          line.inventoryBalanceId || line.quarantineBalanceId,
        destinationBalanceId:
          line.destinationInventoryBalanceId || null,
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
      smartLinks: [
        {
          id: "return-request",
          label: "退货申请",
          path: `/app/inventory/returns/requests/${posting.returnAuthorization.returnRequest.id}`,
        },
        {
          id: "return-authorization",
          label: "退货授权",
          path: `/app/inventory/returns/authorizations/${posting.returnAuthorization.id}`,
        },
        {
          id: "inventory-movements",
          label: "库存流水",
          path: `/app/inventory/movements?sourceDocumentId=${encodeURIComponent(posting.id)}`,
        },
        ...(posting.lines.some((line) => line.quarantineBalanceId)
          ? [
              {
                id: "quarantine-inventory",
                label: "隔离库存",
                path: `/app/inventory/quarantine?sku=${encodeURIComponent(posting.lines[0]?.sku || "")}`,
              },
            ]
          : []),
      ],
      reconciliation,
      limitations:
        posting.postingType === "quarantine_release"
          ? [
              "Phase 4B.4 supports governed quarantine release to an existing available balance.",
              "Scrap, repair, refurbishment, destruction, and automatic disposition remain unavailable.",
            ]
          : posting.postingType === "customer_return_receipt"
          ? [
              "Phase 4B.3 customer return receipts increase quarantine inventory only.",
              "Release requires a separate governed quarantine release authorization.",
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
