export type InventoryWarningLevel = "缺货" | "低库存" | "低于安全库存" | "低于再订货点" | "正常";

export type InventoryWarning = {
  sku: string; itemName: string; warehouse: string; currentStock: number; reservedQty: number; availableStock: number;
  safetyStock: number; reorderPoint: number; incomingQty: number; projectedAvailable: number; shortageQty: number;
  daysCover: number; riskLevel: InventoryWarningLevel; suggestedAction: string; affectedSalesOrders: string[]; incomingPurchaseOrders: string[];
};

export const INVENTORY_WARNINGS: InventoryWarning[] = [
  { sku: "SKU-00623", itemName: "控制器主板 V3.2", warehouse: "上海总仓", currentStock: 12, reservedQty: 12, availableStock: 0, safetyStock: 20, reorderPoint: 36, incomingQty: 6, projectedAvailable: 6, shortageQty: 24, daysCover: 0, riskLevel: "缺货", suggestedAction: "立即复核在途调拨并创建采购申请", affectedSalesOrders: ["SO-2026-0702-018", "SO-2026-0706-011"], incomingPurchaseOrders: ["PO-2026-1287"] },
  { sku: "SKU-00412", itemName: "伺服电机 750W", warehouse: "上海总仓", currentStock: 34, reservedQty: 24, availableStock: 10, safetyStock: 50, reorderPoint: 82, incomingQty: 24, projectedAvailable: 34, shortageQty: 48, daysCover: 4, riskLevel: "低于安全库存", suggestedAction: "核对到货日期并补充采购 48 台", affectedSalesOrders: ["SO-2026-0702-018"], incomingPurchaseOrders: ["PO-2026-1287"] },
  { sku: "SKU-00287", itemName: "铝合金型材 6063", warehouse: "原料仓 B", currentStock: 148, reservedQty: 80, availableStock: 68, safetyStock: 300, reorderPoint: 620, incomingQty: 800, projectedAvailable: 868, shortageQty: 0, daysCover: 3, riskLevel: "低于再订货点", suggestedAction: "跟踪 PO 到货，暂不重复下单", affectedSalesOrders: ["SO-2026-0705-026"], incomingPurchaseOrders: ["PO-2026-1285"] },
  { sku: "SKU-00815", itemName: "液压油缸 50mm", warehouse: "成品仓 A", currentStock: 67, reservedQty: 42, availableStock: 25, safetyStock: 80, reorderPoint: 120, incomingQty: 0, projectedAvailable: 25, shortageQty: 95, daysCover: 6, riskLevel: "低库存", suggestedAction: "创建采购申请并确认首选供应商交期", affectedSalesOrders: ["SO-2026-0628-052"], incomingPurchaseOrders: [] },
  { sku: "SKU-00142", itemName: "精密轴承 6204-ZZ", warehouse: "成品仓 A", currentStock: 2840, reservedQty: 320, availableStock: 2520, safetyStock: 500, reorderPoint: 900, incomingQty: 0, projectedAvailable: 2520, shortageQty: 0, daysCover: 28, riskLevel: "正常", suggestedAction: "维持现有补货节奏", affectedSalesOrders: ["SO-2026-0708-009"], incomingPurchaseOrders: [] },
];
