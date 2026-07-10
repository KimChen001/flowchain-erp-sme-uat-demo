import type { SalesReturnNote } from "./returnTypes";

export const SALES_RETURNS: SalesReturnNote[] = [
  {
    id: "return-260710-001", returnNo: "RTN-2026-0710-001", customer: "成都锐创机器人科技有限公司", salesOrderNo: "SO-2026-0626-041",
    deliveryNo: "DN-2026-0708-003", returnDate: "2026-07-10", returnReason: "运输损坏", status: "待收货", totalQuantity: 1,
    warehouse: "退货待检区", remarks: "承运商责任认定中，先隔离收货。", createdBy: "周浩", reviewedBy: "李婷",
    lines: [{ sku: "SKU-00931", itemName: "工业机器人关节模组", shippedQty: 8, returnQty: 1, receivedQty: 0, unit: "套", condition: "连接器变形", remarks: "客户已拍照取证" }],
  },
  {
    id: "return-260709-004", returnNo: "RTN-2026-0709-004", customer: "上海万联装备股份有限公司", salesOrderNo: "SO-2026-0622-033",
    deliveryNo: "DN-2026-0707-002", returnDate: "2026-07-09", returnReason: "包装标签不清", status: "处理中", totalQuantity: 4,
    warehouse: "退货待检区", remarks: "重新贴标后补发。", createdBy: "王志强", reviewedBy: "陈思远",
    lines: [{ sku: "SKU-00623", itemName: "控制器主板 V3.2", shippedQty: 100, returnQty: 4, receivedQty: 4, unit: "件", condition: "商品完好", remarks: "仅外箱标签问题" }],
  },
  {
    id: "return-260706-002", returnNo: "RTN-2026-0706-002", customer: "苏州精工系统集成有限公司", salesOrderNo: "SO-2026-0618-021",
    deliveryNo: "DN-2026-0702-005", returnDate: "2026-07-06", returnReason: "型号选错", status: "已完成", totalQuantity: 6,
    warehouse: "成品仓 A", createdBy: "孙明", reviewedBy: "李婷",
    lines: [{ sku: "SKU-00815", itemName: "液压油缸 50mm", shippedQty: 24, returnQty: 6, receivedQty: 6, unit: "件", condition: "未使用", remarks: "已复检入库" }],
  },
  {
    id: "return-260711-003", returnNo: "RTN-2026-0711-003", customer: "武汉启明智能制造有限公司", salesOrderNo: "SO-2026-0705-026",
    deliveryNo: "DN-2026-0710-004", returnDate: "2026-07-11", returnReason: "客户取消部分需求", status: "草稿", totalQuantity: 40,
    warehouse: "成品仓 A", remarks: "发货前取消，待业务审核是否转回可用库存。", createdBy: "孙明",
    lines: [{ sku: "SKU-00287", itemName: "铝合金型材 6063", shippedQty: 480, returnQty: 40, receivedQty: 0, unit: "米", condition: "未出库" }],
  },
];
