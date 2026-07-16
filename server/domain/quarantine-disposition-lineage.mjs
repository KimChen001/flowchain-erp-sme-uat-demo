import {
  outboundDecimalString as decimalString,
  outboundDecimalUnits as decimalUnits,
} from "./outbound-transaction-policy.mjs";

export class QuarantineLineageError extends Error {
  constructor(code, message, status = 409, details) {
    super(message);
    this.name = "QuarantineLineageError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const text = (value) => String(value ?? "").trim();
const fixed = (value) =>
  decimalString(typeof value === "bigint" ? value : decimalUnits(value || 0));

export async function allocateTrackedQuarantineConsumption({
  tx,
  tenantId,
  quarantineBalance,
  consumerMovement,
  quantity,
  idFactory,
}) {
  const quantityUnits = decimalUnits(quantity);
  const sources = await tx.inventoryMovement.findMany({
    where: {
      tenantId,
      movementType: "customer_return_quarantine_in",
      reversedByMovementId: null,
      occurredAt: { lte: consumerMovement.occurredAt },
      metadata: { path: ["balanceId"], equals: quarantineBalance.id },
    },
    include: {
      quarantineDispositionSources: {
        where: { status: "active" },
      },
    },
    orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
  });
  const layers = sources.map((source) => {
    const consumed = source.quarantineDispositionSources.reduce(
      (sum, allocation) => sum + decimalUnits(allocation.quantity),
      0n,
    );
    return {
      source,
      remaining: decimalUnits(source.quantityIn) - consumed,
    };
  });
  const trackedRemaining = layers.reduce(
    (sum, layer) => sum + (layer.remaining > 0n ? layer.remaining : 0n),
    0n,
  );
  const onHand = decimalUnits(quarantineBalance.onHandQuantity);
  if (trackedRemaining > onHand)
    throw new QuarantineLineageError(
      "QUARANTINE_LINEAGE_INTEGRITY_FAILED",
      "Tracked quarantine receipt layers exceed the current balance.",
      409,
      {
        quarantineBalanceId: quarantineBalance.id,
        trackedRemaining: fixed(trackedRemaining),
        onHand: fixed(onHand),
      },
    );
  let remainingToAllocate =
    quantityUnits - (onHand - trackedRemaining > quantityUnits
      ? quantityUnits
      : onHand - trackedRemaining);
  const allocations = [];
  for (const layer of layers) {
    if (remainingToAllocate <= 0n) break;
    if (layer.remaining <= 0n) continue;
    const allocated =
      layer.remaining < remainingToAllocate
        ? layer.remaining
        : remainingToAllocate;
    allocations.push(
      await tx.quarantineDispositionAllocation.create({
        data: {
          id: idFactory(),
          tenantId,
          quarantineBalanceId: quarantineBalance.id,
          sourceMovementId: layer.source.id,
          consumerMovementId: consumerMovement.id,
          quantity: fixed(allocated),
          status: "active",
          metadata: {
            allocationPolicy: "untracked_first_then_fifo_v1",
            sourcePostingId: layer.source.sourceDocumentId,
            consumerPostingId: consumerMovement.sourceDocumentId,
          },
        },
      }),
    );
    remainingToAllocate -= allocated;
  }
  if (remainingToAllocate > 0n)
    throw new QuarantineLineageError(
      "QUARANTINE_LINEAGE_INTEGRITY_FAILED",
      "Quarantine consumption could not be reconciled to untracked and tracked inventory.",
      409,
      {
        quarantineBalanceId: quarantineBalance.id,
        unallocatedQuantity: fixed(remainingToAllocate),
      },
    );
  return allocations;
}

export async function reverseTrackedQuarantineConsumption({
  tx,
  tenantId,
  consumerMovementId,
  reversalMovementId,
  reversedAt,
}) {
  return tx.quarantineDispositionAllocation.updateMany({
    where: {
      tenantId,
      consumerMovementId: text(consumerMovementId),
      status: "active",
    },
    data: {
      status: "reversed",
      reversedAt,
      reversedByMovementId: reversalMovementId,
    },
  });
}

export async function activeTrackedConsumption({
  prisma,
  tenantId,
  sourceMovementIds,
}) {
  if (!sourceMovementIds.length) return [];
  return prisma.quarantineDispositionAllocation.findMany({
    where: {
      tenantId,
      sourceMovementId: { in: sourceMovementIds },
      status: "active",
    },
    orderBy: [{ sourceMovementId: "asc" }, { id: "asc" }],
  });
}
