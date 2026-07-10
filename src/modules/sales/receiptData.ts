import type { SignReceipt } from "./receiptTypes";

export const SIGN_RECEIPTS: SignReceipt[] = [
  {
    id: "receipt-260710-001", receiptNo: "SR-2026-0710-001", deliveryNo: "DN-2026-0709-006", salesOrderNo: "SO-2026-0628-052",
    customerName: "苏州精工系统集成有限公司", receiverName: "张海峰", receiverPhone: "137****8291", signDate: "2026-07-10 15:26",
    signLocation: "苏州市工业园区客户一号仓", status: "正常签收", deliveryPerson: "赵宏伟", reviewedBy: "陈思远", signature: "张海峰（电子签名）",
    lines: [{ sku: "SKU-00815", itemName: "液压油缸 50mm", shippedQty: 18, receivedQty: 18, damagedQty: 0, unit: "件" }],
  },
  {
    id: "receipt-260709-002", receiptNo: "SR-2026-0709-002", deliveryNo: "DN-2026-0708-003", salesOrderNo: "SO-2026-0626-041",
    customerName: "成都锐创机器人科技有限公司", receiverName: "何雨", receiverPhone: "136****7720", signDate: "2026-07-10 11:18",
    signLocation: "成都市高新区客户收货区", status: "异常签收", exceptionNote: "2 箱外包装破损，开箱发现 1 套连接器变形。",
    deliveryPerson: "刘洋", reviewedBy: "李婷", signature: "何雨（异常签收）",
    lines: [{ sku: "SKU-00931", itemName: "工业机器人关节模组", shippedQty: 8, receivedQty: 7, damagedQty: 1, unit: "套", remarks: "损坏件隔离待处理" }],
  },
  {
    id: "receipt-260708-005", receiptNo: "SR-2026-0708-005", deliveryNo: "DN-2026-0707-002", salesOrderNo: "SO-2026-0622-033",
    customerName: "上海万联装备股份有限公司", receiverName: "顾晨", signDate: "2026-07-08 16:42", signLocation: "上海市嘉定区二号仓",
    status: "部分签收", exceptionNote: "客户实收 96 件，4 件因包装标签不清退回。", deliveryPerson: "高翔", reviewedBy: "王志强", signature: "顾晨（电子签名）",
    lines: [{ sku: "SKU-00623", itemName: "控制器主板 V3.2", shippedQty: 100, receivedQty: 96, damagedQty: 0, unit: "件", remarks: "4 件拒收" }],
  },
  {
    id: "receipt-260711-001", receiptNo: "SR-2026-0711-001", deliveryNo: "DN-2026-0710-001", salesOrderNo: "SO-2026-0702-018",
    customerName: "华南自动化设备有限公司", receiverName: "待客户签收", signDate: "2026-07-11", status: "待签收", deliveryPerson: "陈建国",
    lines: [
      { sku: "SKU-00412", itemName: "伺服电机 750W", shippedQty: 24, receivedQty: 0, damagedQty: 0, unit: "台" },
      { sku: "SKU-00623", itemName: "控制器主板 V3.2", shippedQty: 12, receivedQty: 0, damagedQty: 0, unit: "件" },
    ],
  },
];
