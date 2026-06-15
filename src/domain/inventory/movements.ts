import type { InventoryMovement, InventoryMovementStatus, InventoryMovementType } from "../../types/scm";

export const INVENTORY_MOVEMENT_TYPE_LABELS: Record<InventoryMovementType, string> = {
  PurchaseReceipt: "采购入库",
  PurchaseReturn: "采购退货",
  SalesDelivery: "销售出库",
  SalesReturn: "销售退货",
  StockAdjustment: "库存调整",
  StockTransfer: "库存调拨",
  CycleCountVariance: "盘点差异",
};

export const INVENTORY_MOVEMENT_STATUS_FILTERS: ("全部" | InventoryMovementStatus)[] = ["全部", "已登记", "待复核", "已确认", "异常处理", "已关闭", "已取消"];
export const INVENTORY_MOVEMENT_TYPE_FILTERS: ("全部" | InventoryMovementType)[] = ["全部", "PurchaseReceipt", "PurchaseReturn", "SalesDelivery", "SalesReturn", "StockAdjustment", "StockTransfer", "CycleCountVariance"];

export function netInventoryImpact(movement: InventoryMovement) {
  return Number((movement.quantityIn - movement.quantityOut + movement.adjustmentQty).toFixed(3));
}

export function isInventoryMovementException(movement: InventoryMovement) {
  return movement.status === "待复核" || movement.status === "异常处理" || movement.movementType === "CycleCountVariance";
}

export function inventoryMovementSummary(movements: InventoryMovement[]) {
  return {
    count: movements.length,
    inboundQty: movements.reduce((sum, item) => sum + Number(item.quantityIn || 0), 0),
    outboundQty: movements.reduce((sum, item) => sum + Number(item.quantityOut || 0), 0),
    adjustmentQty: movements.reduce((sum, item) => sum + Number(item.adjustmentQty || 0), 0),
    exceptionCount: movements.filter(isInventoryMovementException).length,
  };
}

export function filterInventoryMovements(
  movements: InventoryMovement[],
  filters: { type: string; status: string; warehouse: string; search: string },
) {
  const keyword = filters.search.trim().toLowerCase();
  return movements.filter((item) => {
    const matchType = filters.type === "全部" || item.movementType === filters.type;
    const matchStatus = filters.status === "全部" || item.status === filters.status;
    const matchWarehouse = filters.warehouse === "全部" || item.warehouse === filters.warehouse;
    const matchSearch = !keyword || [
      item.movementId,
      item.sku,
      item.itemName,
      item.sourceDocument,
      item.relatedPo,
      item.relatedGrn,
      item.relatedReturn,
      item.relatedSalesOrder,
    ].some((value) => String(value || "").toLowerCase().includes(keyword));
    return matchType && matchStatus && matchWarehouse && matchSearch;
  });
}

export function inventoryMovementExportRows(movements: InventoryMovement[]) {
  return movements.map((item) => ({
    单据号: item.movementId,
    类型: item.movementLabel,
    日期: item.date,
    SKU: item.sku,
    品名: item.itemName,
    仓库: item.warehouse,
    库位: item.location,
    来源单据: item.sourceDocument,
    关联PO: item.relatedPo || "",
    关联GRN: item.relatedGrn || "",
    关联退货: item.relatedReturn || "",
    关联销售订单: item.relatedSalesOrder || "",
    入库: item.quantityIn,
    出库: item.quantityOut,
    调整: item.adjustmentQty,
    单位: item.unit,
    期末影响: netInventoryImpact(item),
    状态: item.status,
    负责人: item.owner,
    原因: item.reason,
    库存影响: item.inventoryImpact,
    关联证据: item.evidence.map((evidence) => `${evidence.label}:${evidence.value}`).join("；"),
  }));
}
