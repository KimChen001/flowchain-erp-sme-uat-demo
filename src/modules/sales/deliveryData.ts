import type { DeliveryNote } from "./deliveryTypes";

export const DELIVERY_NOTES: DeliveryNote[] = [
  {
    id: "delivery-260710-001", deliveryNo: "DN-2026-0710-001", salesOrderNo: "SO-2026-0702-018", customerId: "CUS-001",
    customerName: "华南自动化设备有限公司", warehouse: "成品仓 A", deliveryDate: "2026-07-10", expectedArrivalDate: "2026-07-11",
    logisticsCompany: "顺丰重货", carrier: "华南干线一组", driver: "陈建国", driverPhone: "138****2468", vehicleNo: "粤B·6F218",
    status: "运输中", totalQuantity: 36, cartonCount: 6, remarks: "到货前 2 小时联系客户仓库。", createdBy: "周浩", reviewedBy: "李婷",
    lines: [
      { sku: "SKU-00412", itemName: "伺服电机 750W", orderedQty: 24, shippedQty: 24, unit: "台", batchNo: "B260705-01", cartonCount: 4 },
      { sku: "SKU-00623", itemName: "控制器主板 V3.2", orderedQty: 12, shippedQty: 12, unit: "件", batchNo: "B260704-03", cartonCount: 2, remarks: "防静电包装" },
    ],
  },
  {
    id: "delivery-260709-006", deliveryNo: "DN-2026-0709-006", salesOrderNo: "SO-2026-0628-052", customerId: "CUS-002",
    customerName: "苏州精工系统集成有限公司", warehouse: "成品仓 A", deliveryDate: "2026-07-09", expectedArrivalDate: "2026-07-10",
    logisticsCompany: "德邦物流", carrier: "苏南专线", driver: "赵宏伟", driverPhone: "139****1120", vehicleNo: "苏E·93K72",
    status: "已签收", totalQuantity: 18, cartonCount: 3, createdBy: "王志强", reviewedBy: "陈思远",
    lines: [{ sku: "SKU-00815", itemName: "液压油缸 50mm", orderedQty: 18, shippedQty: 18, unit: "件", batchNo: "B260702-06", cartonCount: 3 }],
  },
  {
    id: "delivery-260710-004", deliveryNo: "DN-2026-0710-004", salesOrderNo: "SO-2026-0705-026", customerId: "CUS-003",
    customerName: "武汉启明智能制造有限公司", warehouse: "原料及半成品仓 B", deliveryDate: "2026-07-10", expectedArrivalDate: "2026-07-12",
    logisticsCompany: "安能物流", status: "待发货", totalQuantity: 480, cartonCount: 12, remarks: "等待客户确认卸货窗口。", createdBy: "孙明",
    lines: [{ sku: "SKU-00287", itemName: "铝合金型材 6063", orderedQty: 480, shippedQty: 480, unit: "米", batchNo: "AL260706", cartonCount: 12 }],
  },
  {
    id: "delivery-260708-003", deliveryNo: "DN-2026-0708-003", salesOrderNo: "SO-2026-0626-041", customerId: "CUS-004",
    customerName: "成都锐创机器人科技有限公司", warehouse: "成品仓 A", deliveryDate: "2026-07-08", expectedArrivalDate: "2026-07-10",
    logisticsCompany: "京东物流", driver: "刘洋", vehicleNo: "川A·21P86", status: "异常", totalQuantity: 8, cartonCount: 2,
    remarks: "运输途中外包装破损，已通知承运商取证。", createdBy: "周浩", reviewedBy: "李婷",
    lines: [{ sku: "SKU-00931", itemName: "工业机器人关节模组", orderedQty: 8, shippedQty: 8, unit: "套", batchNo: "J260630", cartonCount: 2, remarks: "2 箱外包装待检查" }],
  },
  {
    id: "delivery-260711-002", deliveryNo: "DN-2026-0711-002", salesOrderNo: "SO-2026-0708-009", customerId: "CUS-001",
    customerName: "华南自动化设备有限公司", warehouse: "成品仓 A", deliveryDate: "2026-07-11", expectedArrivalDate: "2026-07-12",
    status: "待拣货", totalQuantity: 60, cartonCount: 5, createdBy: "孙明",
    lines: [{ sku: "SKU-00142", itemName: "精密轴承 6204-ZZ", orderedQty: 60, shippedQty: 60, unit: "件", batchNo: "BR260708", cartonCount: 5 }],
  },
];

export const deliveryCustomers = Array.from(new Set(DELIVERY_NOTES.map((note) => note.customerName)));
