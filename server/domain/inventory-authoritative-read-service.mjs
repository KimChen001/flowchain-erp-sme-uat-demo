import { resolveProvisionedActor } from "./pilot-identity.mjs";
import {
  outboundDecimalString,
  outboundDecimalUnits,
} from "./outbound-transaction-policy.mjs";

const text = (value) => String(value ?? "").trim();
const decimal = (value) =>
  outboundDecimalString(outboundDecimalUnits(value || 0));
const iso = (value) => (value ? new Date(value).toISOString() : null);

function positiveInteger(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0
    ? Math.min(parsed, maximum)
    : fallback;
}

function scopedWhere(actor) {
  if (actor.allWarehouses) return {};
  const warehouseIds = [...(actor.readWarehouseIds || [])];
  return warehouseIds.length
    ? { warehouseId: { in: warehouseIds } }
    : { warehouseId: { in: [] } };
}

function pageOptions(query = {}) {
  const page = positiveInteger(query.page, 1);
  const pageSize = positiveInteger(query.pageSize, 50, 200);
  return { page, pageSize, skip: (page - 1) * pageSize };
}

function direction(value) {
  return text(value).toLowerCase() === "asc" ? "asc" : "desc";
}

function movementOrder(query = {}) {
  const allowed = new Set([
    "occurredAt",
    "movementDate",
    "sku",
    "warehouseId",
    "movementType",
    "createdAt",
  ]);
  const sort = allowed.has(text(query.sort)) ? text(query.sort) : "occurredAt";
  return [{ [sort]: direction(query.direction) }, { id: "asc" }];
}

function balanceOrder(query = {}) {
  const allowed = new Set([
    "updatedAt",
    "sku",
    "warehouseId",
    "locationKey",
    "status",
    "createdAt",
  ]);
  const sort = allowed.has(text(query.sort)) ? text(query.sort) : "sku";
  return [
    { [sort]: direction(query.direction || (sort === "sku" ? "asc" : "desc")) },
    { id: "asc" },
  ];
}

function movementWhere(actor, query = {}) {
  return {
    tenantId: actor.tenantId,
    AND: [
      scopedWhere(actor),
      {
        ...(text(query.relatedSalesOrderId)
          ? { relatedSalesOrderId: text(query.relatedSalesOrderId) }
          : {}),
        ...(text(query.sourceDocumentId)
          ? { sourceDocumentId: text(query.sourceDocumentId) }
          : {}),
        ...(text(query.sourceDocumentLineId)
          ? { sourceDocumentLineId: text(query.sourceDocumentLineId) }
          : {}),
        ...(text(query.postingBatchId)
          ? { postingBatchId: text(query.postingBatchId) }
          : {}),
        ...(text(query.sku) ? { sku: text(query.sku) } : {}),
        ...(text(query.warehouseId)
          ? { warehouseId: text(query.warehouseId) }
          : {}),
        ...(text(query.locationKey)
          ? { locationKey: text(query.locationKey) }
          : {}),
        ...(text(query.movementType)
          ? { movementType: text(query.movementType) }
          : {}),
      },
    ],
  };
}

function balanceWhere(actor, query = {}) {
  return {
    tenantId: actor.tenantId,
    AND: [
      scopedWhere(actor),
      {
        ...(text(query.itemId) ? { itemId: text(query.itemId) } : {}),
        ...(text(query.sku) ? { sku: text(query.sku) } : {}),
        ...(text(query.warehouseId)
          ? { warehouseId: text(query.warehouseId) }
          : {}),
        ...(text(query.locationKey)
          ? { locationKey: text(query.locationKey) }
          : {}),
        ...(text(query.status) ? { status: text(query.status) } : {}),
      },
    ],
  };
}

function movementModel(row) {
  return {
    movementId: row.id,
    id: row.id,
    itemId: row.itemId,
    sku: row.sku,
    itemName: row.itemName,
    warehouseId: row.warehouseId,
    location: row.location || "",
    locationKey: row.locationKey,
    movementType: row.movementType,
    movementLabel: row.movementLabel || row.movementType,
    quantityIn: decimal(row.quantityIn),
    quantityOut: decimal(row.quantityOut),
    adjustmentQty: decimal(row.adjustmentQty),
    unit: row.unit,
    status: row.status,
    relatedSalesOrderId: row.relatedSalesOrderId,
    sourceDocumentId: row.sourceDocumentId,
    sourceDocumentLineId: row.sourceDocumentLineId,
    postingBatchId: row.postingBatchId,
    occurredAt: iso(row.occurredAt),
    date: iso(row.occurredAt),
  };
}

function balanceModel(row) {
  return {
    id: row.id,
    itemId: row.itemId,
    sku: row.sku,
    itemName: row.itemName,
    warehouseId: row.warehouseId,
    location: row.location || "",
    locationKey: row.locationKey,
    onHandQuantity: decimal(row.onHandQuantity),
    reservedQuantity: decimal(row.reservedQuantity),
    availableQuantity: decimal(row.availableQuantity),
    safetyStock: decimal(row.safetyStock),
    reorderPoint: decimal(row.reorderPoint),
    unit: row.unit,
    status: row.status,
    riskLevel: row.riskLevel,
    version: row.version,
    updatedAt: iso(row.updatedAt),
  };
}

export function createInventoryAuthoritativeReadService({ prisma } = {}) {
  if (!prisma) throw new Error("prisma is required");

  async function listMovements(query, context) {
    const actor = await resolveProvisionedActor(
      prisma,
      context?.identity || context,
    );
    const { page, pageSize, skip } = pageOptions(query);
    const where = movementWhere(actor, query);
    const [total, rows] = await Promise.all([
      prisma.inventoryMovement.count({ where }),
      prisma.inventoryMovement.findMany({
        where,
        orderBy: movementOrder(query),
        skip,
        take: pageSize,
      }),
    ]);
    return {
      dataSource: "Authoritative PostgreSQL",
      page,
      pageSize,
      total,
      movements: rows.map(movementModel),
    };
  }

  async function listBalances(query, context) {
    const actor = await resolveProvisionedActor(
      prisma,
      context?.identity || context,
    );
    const { page, pageSize, skip } = pageOptions(query);
    const where = balanceWhere(actor, query);
    const [total, rows] = await Promise.all([
      prisma.inventoryBalance.count({ where }),
      prisma.inventoryBalance.findMany({
        where,
        orderBy: balanceOrder(query),
        skip,
        take: pageSize,
      }),
    ]);
    return {
      dataSource: "Authoritative PostgreSQL",
      page,
      pageSize,
      total,
      balances: rows.map(balanceModel),
    };
  }

  return { listMovements, listBalances };
}
