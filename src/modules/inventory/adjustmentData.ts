import type { InventoryAdjustment } from "./adjustmentTypes";

export const INVENTORY_ADJUSTMENTS: InventoryAdjustment[] = [
  { id: "adj-0710-001", adjustmentNo: "ADJ-2026-0710-001", warehouse: "上海总仓", adjustmentType: "盘亏", reason: "循环盘点差异", status: "已审核", createdBy: "刘建华", createdAt: "2026-07-10 10:18", reviewedBy: "李婷", reviewedAt: "2026-07-10 11:02", movementNo: "IM-20260710-0041", remarks: "复核拣货记录后确认盘亏。", lines: [
    { sku: "SKU-00412", itemName: "伺服电机 750W", beforeQty: 34, adjustmentQty: -2, afterQty: 32, unit: "台", reason: "拣货漏记" },
    { sku: "SKU-00558", itemName: "不锈钢螺栓 M8×30", beforeQty: 85000, adjustmentQty: -6, afterQty: 84994, unit: "件", reason: "破损未登记" },
  ] },
  { id: "adj-0709-006", adjustmentNo: "ADJ-2026-0709-006", warehouse: "苏州分仓", adjustmentType: "盘盈", reason: "月度盘点差异", status: "待审核", createdBy: "孙明", createdAt: "2026-07-09 16:42", lines: [
    { sku: "SKU-00391", itemName: "密封圈 NBR-70", beforeQty: 4200, adjustmentQty: 3, afterQty: 4203, unit: "件", reason: "上次盘亏冲回", remarks: "待复核旧盘点记录" },
  ] },
  { id: "adj-0708-003", adjustmentNo: "ADJ-2026-0708-003", warehouse: "深圳分仓", adjustmentType: "报损", reason: "质量复检报损", status: "草稿", createdBy: "周浩", createdAt: "2026-07-08 14:05", remarks: "等待 QA 附件。", lines: [
    { sku: "SKU-00934", itemName: "步进电机驱动板", beforeQty: 89, adjustmentQty: -3, afterQty: 86, unit: "件", reason: "测试不通过" },
  ] },
  { id: "adj-0705-002", adjustmentNo: "ADJ-2026-0705-002", warehouse: "成品仓 A", adjustmentType: "其他", reason: "库位合并校正", status: "已驳回", createdBy: "王志强", createdAt: "2026-07-05 09:24", reviewedBy: "李婷", reviewedAt: "2026-07-05 10:12", remarks: "需拆分为库位转移，不应调整总库存。", lines: [
    { sku: "SKU-00142", itemName: "精密轴承 6204-ZZ", beforeQty: 2840, adjustmentQty: -40, afterQty: 2800, unit: "件", reason: "库位合并" },
  ] },
];
