import type { ApprovalSnapshot, POStatus, PurchaseReturn, RecvStatus } from "../types/scm";

export const procurementData = [
  { category: "原材料",   amount: 12840000, pct: 38, yoy: 11.2 },
  { category: "半成品",   amount: 8920000,  pct: 26, yoy: 7.4  },
  { category: "包装材料", amount: 4470000,  pct: 13, yoy: -2.1 },
  { category: "设备耗材", amount: 3760000,  pct: 11, yoy: 4.8  },
  { category: "物流运输", amount: 4130000,  pct: 12, yoy: 9.3  },
];

export const procurementTrend = [
  { day: "周一", po: 8,  amount: 1240 },
  { day: "周二", po: 12, amount: 2840 },
  { day: "周三", po: 6,  amount: 1620 },
  { day: "周四", po: 15, amount: 3640 },
  { day: "周五", po: 11, amount: 2380 },
  { day: "周六", po: 3,  amount: 480  },
  { day: "周日", po: 1,  amount: 120  },
];

export const monthlyProcurement = [
  { month: "7月",  amount: 2640000, budget: 2800000 },
  { month: "8月",  amount: 2980000, budget: 2800000 },
  { month: "9月",  amount: 3120000, budget: 3000000 },
  { month: "10月", amount: 3240000, budget: 3200000 },
  { month: "11月", amount: 3680000, budget: 3500000 },
  { month: "12月", amount: 3412000, budget: 3600000 },
];

export const purchaseOrders: {
  po: string; supplier: string; created: string; eta: string; owner: string;
  amount: number; items: number; received: number; status: POStatus; priority: "高" | "中" | "低";
  paid: boolean; source?: string; sourceRequest?: string; sourceRfq?: string; sourceSku?: string; sourceName?: string; recommendedQty?: number;
  unit?: string; unitPrice?: number; reason?: string; approvalSnapshot?: ApprovalSnapshot | null;
}[] = [
  { po: "PO-2026-1287", supplier: "深圳新元电气",   created: "5月26日", eta: "6月02日", owner: "陈思远", amount: 1840000, items: 8,  received: 0,  status: "待审批",  priority: "高", paid: false },
  { po: "PO-2026-1286", supplier: "华东精工机械",   created: "5月25日", eta: "6月01日", owner: "李婷",   amount: 2640000, items: 12, received: 0,  status: "已审批",  priority: "高", paid: false },
  { po: "PO-2026-1285", supplier: "江苏铝合金集团", created: "5月24日", eta: "5月31日", owner: "王志强", amount: 980000,  items: 4,  received: 0,  status: "已发出",  priority: "中", paid: false },
  { po: "PO-2026-1284", supplier: "佛山标准件",     created: "5月22日", eta: "5月29日", owner: "李婷",   amount: 412000,  items: 18, received: 12, status: "部分到货",priority: "中", paid: false },
  { po: "PO-2026-1283", supplier: "深圳新元电气",   created: "5月19日", eta: "5月26日", owner: "陈思远", amount: 1280000, items: 6,  received: 6,  status: "已完成",  priority: "中", paid: true  },
  { po: "PO-2026-1282", supplier: "广州化工耗材",   created: "5月18日", eta: "5月25日", owner: "周浩",   amount: 348000,  items: 9,  received: 5,  status: "部分到货",priority: "低", paid: false },
  { po: "PO-2026-1281", supplier: "华东精工机械",   created: "5月16日", eta: "5月23日", owner: "李婷",   amount: 1920000, items: 7,  received: 7,  status: "已完成",  priority: "中", paid: true  },
  { po: "PO-2026-1280", supplier: "江苏铝合金集团", created: "5月14日", eta: "5月21日", owner: "王志强", amount: 760000,  items: 3,  received: 0,  status: "已取消",  priority: "低", paid: false },
  { po: "PO-2026-1279", supplier: "深圳新元电气",   created: "5月26日", eta: "6月03日", owner: "陈思远", amount: 528000,  items: 5,  received: 0,  status: "草稿",    priority: "低", paid: false },
];

export const receivingDocs: {
  grn: string; po: string; supplier: string; arrived: string; dock: string;
  receiver: string; items: number; passed: number; failed: number;
  status: RecvStatus; warehouse: string;
}[] = [
  { grn: "GRN-202605-0418", po: "PO-2026-1284", supplier: "佛山标准件",     arrived: "5月27日 09:14", dock: "Dock-02", receiver: "刘建华", items: 18, passed: 12, failed: 0, status: "已入库",  warehouse: "A 区" },
  { grn: "GRN-202605-0419", po: "PO-2026-1282", supplier: "广州化工耗材",   arrived: "5月27日 10:42", dock: "Dock-04", receiver: "孙明",   items: 9,  passed: 5,  failed: 2, status: "异常处理",warehouse: "C 区" },
  { grn: "GRN-202605-0420", po: "PO-2026-1285", supplier: "江苏铝合金集团", arrived: "5月27日 13:08", dock: "Dock-01", receiver: "刘建华", items: 4,  passed: 0,  failed: 0, status: "质检中",  warehouse: "—"    },
  { grn: "GRN-202605-0421", po: "PO-2026-1286", supplier: "华东精工机械",   arrived: "5月27日 14:30", dock: "Dock-03", receiver: "—",      items: 12, passed: 0,  failed: 0, status: "待收货",  warehouse: "—"    },
  { grn: "GRN-202605-0422", po: "PO-2026-1283", supplier: "深圳新元电气",   arrived: "5月26日 16:21", dock: "Dock-02", receiver: "孙明",   items: 6,  passed: 6,  failed: 0, status: "已入库",  warehouse: "D 区" },
  { grn: "GRN-202605-0423", po: "PO-2026-1281", supplier: "华东精工机械",   arrived: "5月26日 11:05", dock: "Dock-01", receiver: "刘建华", items: 7,  passed: 7,  failed: 0, status: "已入库",  warehouse: "A 区" },
];

export const arrivalSchedule = [
  { time: "09:00", supplier: "佛山标准件",     po: "PO-2026-1284", dock: "Dock-02", driver: "王师傅 / 粤B·12846", status: "已到达" },
  { time: "10:30", supplier: "广州化工耗材",   po: "PO-2026-1282", dock: "Dock-04", driver: "李师傅 / 粤A·39201", status: "已到达" },
  { time: "13:00", supplier: "江苏铝合金集团", po: "PO-2026-1285", dock: "Dock-01", driver: "陈师傅 / 苏A·82014", status: "已到达" },
  { time: "14:30", supplier: "华东精工机械",   po: "PO-2026-1286", dock: "Dock-03", driver: "赵师傅 / 沪D·17729", status: "在途"  },
  { time: "16:00", supplier: "深圳新元电气",   po: "PO-2026-1287", dock: "Dock-02", driver: "—",                  status: "待发车" },
  { time: "17:30", supplier: "上海仪表科技",   po: "PO-2026-1278", dock: "Dock-04", driver: "—",                  status: "待发车" },
];

export const qcExceptions = [
  { grn: "GRN-202605-0419", item: "聚氨酯密封胶 5L 装", po: "PO-2026-1282", qty: 12, failed: 2, type: "外观破损", action: "整批退货", severity: "中" },
  { grn: "GRN-202605-0419", item: "工业清洁剂 25L",     po: "PO-2026-1282", qty: 6,  failed: 1, type: "标签批次不符", action: "供应商补发", severity: "低" },
  { grn: "GRN-202605-0415", item: "伺服电机 750W",       po: "PO-2026-1276", qty: 24, failed: 3, type: "测试不通过", action: "已退回", severity: "高" },
];

export const RFQS: {
  id: string; title: string; category: string; suppliers: number; quoted: number;
  bestPrice: number; bestSupplier: string; due: string; status: "进行中" | "比价中" | "已授标" | "已转PO" | "已关闭" | "已取消";
}[] = [
  { id: "RFQ-26-0042", title: "Q3 铝合金型材集采",     category: "原材料",   suppliers: 6, quoted: 5, bestPrice: 18.6,  bestSupplier: "江苏铝合金集团", due: "2026-06-10", status: "比价中" },
  { id: "RFQ-26-0043", title: "标准紧固件年框",         category: "通用件",   suppliers: 8, quoted: 8, bestPrice:  0.42, bestSupplier: "佛山标准件",     due: "2026-05-30", status: "已授标" },
  { id: "RFQ-26-0044", title: "PCB 板代工",              category: "电子",     suppliers: 4, quoted: 3, bestPrice: 86.4,  bestSupplier: "深圳新元电气",   due: "2026-06-15", status: "进行中" },
  { id: "RFQ-26-0045", title: "切削液 12 个月供货",     category: "耗材",     suppliers: 5, quoted: 4, bestPrice: 24.8,  bestSupplier: "广州化工耗材",   due: "2026-06-08", status: "比价中" },
  { id: "RFQ-26-0046", title: "高精度数控刀具",         category: "工具",     suppliers: 3, quoted: 2, bestPrice:312.0,  bestSupplier: "华东精工机械",   due: "2026-06-22", status: "进行中" },
];

export const CONTRACTS: {
  id: string; supplier: string; scope: string; commitVol: string; price: string;
  start: string; end: string; consumed: number; status: "执行中" | "即将到期" | "已到期";
}[] = [
  { id: "BPA-26-001", supplier: "深圳新元电气",   scope: "PCB 板 / 控制板",     commitVol: "12,000 件",  price: "目录价 -14%", start: "2026-01-01", end: "2026-12-31", consumed: 0.42, status: "执行中" },
  { id: "BPA-26-002", supplier: "江苏铝合金集团", scope: "6061-T6 型材",         commitVol: "2,400 吨",  price: "RMB 18.60/kg", start: "2026-03-01", end: "2027-02-28", consumed: 0.18, status: "执行中" },
  { id: "BPA-26-003", supplier: "佛山标准件",     scope: "M3~M12 紧固件",        commitVol: "8M 件",     price: "目录价 -22%", start: "2026-04-01", end: "2026-06-30", consumed: 0.76, status: "即将到期" },
  { id: "BPA-25-009", supplier: "广州化工耗材",   scope: "切削液 / 防锈油",      commitVol: "180 吨",    price: "RMB 24.80/L", start: "2025-07-01", end: "2026-06-30", consumed: 0.92, status: "即将到期" },
  { id: "BPA-25-007", supplier: "上海仪表科技",   scope: "测量仪表",             commitVol: "320 台",    price: "目录价 -10%", start: "2025-01-01", end: "2025-12-31", consumed: 1.00, status: "已到期" },
];

export const MATCH_QUEUE: {
  id: string; po: string; grn: string; invoice: string; supplier: string;
  poAmt: number; grnAmt: number; invAmt: number; variance: number; status: "已匹配" | "金额差异" | "数量差异" | "待匹配";
}[] = [
  { id: "M-26-0521", po: "PO-2026-0142", grn: "GRN-2026-0521", invoice: "INV-526481", supplier: "江苏铝合金集团", poAmt:  864000, grnAmt:  864000, invAmt:  864000, variance: 0,      status: "已匹配" },
  { id: "M-26-0522", po: "PO-2026-0148", grn: "GRN-2026-0522", invoice: "INV-526482", supplier: "深圳新元电气",   poAmt: 1240000, grnAmt: 1240000, invAmt: 1248600, variance: 8600,   status: "金额差异" },
  { id: "M-26-0523", po: "PO-2026-0151", grn: "GRN-2026-0523", invoice: "INV-526483", supplier: "佛山标准件",     poAmt:  148200, grnAmt:  142400, invAmt:  148200, variance: 5800,   status: "数量差异" },
  { id: "M-26-0524", po: "PO-2026-0156", grn: "GRN-2026-0524", invoice: "INV-526484", supplier: "上海仪表科技",   poAmt:  286400, grnAmt:  286400, invAmt:  286400, variance: 0,      status: "已匹配" },
  { id: "M-26-0525", po: "PO-2026-0162", grn: "—",             invoice: "INV-526485", supplier: "广州化工耗材",   poAmt:  64800,  grnAmt:  0,       invAmt:  64800,  variance: 64800, status: "待匹配" },
];

export const PURCHASE_RETURNS: PurchaseReturn[] = [
  {
    id: "RTV-2026-0501",
    returnNo: "RTV-2026-0501",
    supplier: "广州化工耗材",
    supplierCode: "SUP-GZ-CHEM",
    relatedPo: "PO-2026-1282",
    relatedGrn: "GRN-202605-0419",
    relatedInvoice: "INV-GZ-260419",
    relatedMatchId: "MATCH-INV-GZ-260419",
    returnDate: "2026-05-29",
    createdDate: "2026-05-29",
    owner: "周浩",
    warehouse: "C 区",
    currency: "CNY",
    reason: "质检拒收",
    status: "待贷项",
    approvalStatus: "已审批",
    subtotal: 37168.14,
    tax: 4831.86,
    total: 42000,
    returnQty: 2,
    acceptedImpactQty: 0,
    rejectedImpactQty: 2,
    source: "receiving-qc",
    confidence: 82,
    notes: "GRN 拒收数量已隔离，等待供应商补发或开具贷项通知。",
    lines: [
      { lineId: "RTV-2026-0501-L1", sku: "SKU-00744", name: "聚氨酯密封胶", unit: "桶", orderedQty: 9, receivedQty: 7, acceptedQty: 5, rejectedQty: 2, returnQty: 2, unitPrice: 18584.07, taxRate: 0.13, returnAmount: 37168.14, taxAmount: 4831.86, totalAmount: 42000, reason: "质检拒收", relatedPoLine: "PO-2026-1282-L001", relatedGrnLine: "GRN-202605-0419-L001", relatedInvoiceLine: "SI-2026-0419-L1", notes: "外观破损，退回供应商确认。" },
    ],
  },
  {
    id: "RTV-2026-0502",
    returnNo: "RTV-2026-0502",
    supplier: "深圳新元电气",
    supplierCode: "SUP-SZ-ELEC",
    relatedPo: "PO-2026-1283",
    relatedGrn: "GRN-202605-0422",
    relatedInvoice: "INV-SZ-260422",
    relatedMatchId: "MATCH-INV-SZ-260422",
    returnDate: "2026-05-30",
    createdDate: "2026-05-30",
    owner: "陈思远",
    warehouse: "D 区",
    currency: "CNY",
    reason: "合同条款差异",
    status: "已生成贷项",
    approvalStatus: "已审批",
    creditMemoId: "CM-SZ-2026-0528",
    subtotal: 7610.62,
    tax: 989.38,
    total: 8600,
    returnQty: 0,
    acceptedImpactQty: 0,
    rejectedImpactQty: 0,
    source: "invoice-variance",
    confidence: 88,
    notes: "货物已验收入库，针对发票额外运费登记供应商贷项通知。",
    lines: [
      { lineId: "RTV-2026-0502-L1", sku: "FREIGHT", name: "合同外运费差异", unit: "项", orderedQty: 1, receivedQty: 1, acceptedQty: 1, rejectedQty: 0, returnQty: 0, unitPrice: 7610.62, taxRate: 0.13, returnAmount: 7610.62, taxAmount: 989.38, totalAmount: 8600, reason: "合同条款差异", relatedPoLine: "PO-2026-1283-L001", relatedGrnLine: "GRN-202605-0422-L001", relatedInvoiceLine: "SI-2026-0422-L1", notes: "冲减发票额外运费，不退实物。" },
    ],
  },
  {
    id: "RTV-2026-0503",
    returnNo: "RTV-2026-0503",
    supplier: "江苏铝合金集团",
    supplierCode: "SUP-JS-ALU",
    relatedPo: "PO-2026-1285",
    relatedGrn: "GRN-202605-0420",
    relatedInvoice: "INV-JS-260420",
    relatedMatchId: "MATCH-INV-JS-260420",
    returnDate: "2026-05-31",
    createdDate: "2026-05-31",
    owner: "王志强",
    warehouse: "B 区",
    currency: "CNY",
    reason: "价格差异",
    status: "已生成贷项",
    approvalStatus: "已审批",
    creditMemoId: "CM-JS-2026-0531",
    subtotal: 28318.58,
    tax: 3681.42,
    total: 32000,
    returnQty: 0,
    acceptedImpactQty: 0,
    rejectedImpactQty: 0,
    source: "invoice-variance",
    confidence: 79,
    notes: "供应商发票单价高于 PO 单价，贷项用于冲减差异金额。",
    lines: [
      { lineId: "RTV-2026-0503-L1", sku: "SKU-00287", name: "铝合金型材 6063 价格差异", unit: "米", orderedQty: 52000, receivedQty: 52000, acceptedQty: 52000, rejectedQty: 0, returnQty: 0, unitPrice: 0.5446, taxRate: 0.13, returnAmount: 28318.58, taxAmount: 3681.42, totalAmount: 32000, reason: "价格差异", relatedPoLine: "PO-2026-1285-L001", relatedGrnLine: "GRN-202605-0420-L001", relatedInvoiceLine: "SI-2026-0420-L1", notes: "价格差异贷项，不影响收货数量。" },
    ],
  },
  {
    id: "RTV-2026-0504",
    returnNo: "RTV-2026-0504",
    supplier: "华东精工机械",
    supplierCode: "SUP-HD-MECH",
    relatedPo: "PO-2026-1286",
    relatedGrn: "GRN-202605-0421",
    relatedInvoice: "INV-HD-260421",
    relatedMatchId: "MATCH-INV-HD-260421",
    returnDate: "2026-06-01",
    createdDate: "2026-06-01",
    owner: "李婷",
    warehouse: "待收货",
    currency: "CNY",
    reason: "数量差异",
    status: "待审批",
    approvalStatus: "待审批",
    subtotal: 2640000,
    tax: 343200,
    total: 2983200,
    returnQty: 12,
    acceptedImpactQty: 12,
    rejectedImpactQty: 0,
    source: "manual-review",
    confidence: 68,
    notes: "发票已到但 GRN 未完成签收，先登记异常处理单；待收货确认后决定退货或释放匹配。",
    lines: [
      { lineId: "RTV-2026-0504-L1", sku: "SKU-00815", name: "液压油缸 50mm", unit: "件", orderedQty: 12, receivedQty: 0, acceptedQty: 0, rejectedQty: 0, returnQty: 12, unitPrice: 220000, taxRate: 0.13, returnAmount: 2640000, taxAmount: 343200, totalAmount: 2983200, reason: "数量差异", relatedPoLine: "PO-2026-1286-L001", relatedGrnLine: "GRN-202605-0421-L001", relatedInvoiceLine: "SI-2026-0421-L1", notes: "未签收前保持异常处理状态，待收货确认后更新库存影响。" },
    ],
  },
  {
    id: "RTV-2026-0505",
    returnNo: "RTV-2026-0505",
    supplier: "佛山标准件",
    supplierCode: "SUP-FS-STD",
    relatedPo: "PO-2026-1284",
    relatedGrn: "GRN-202605-0418",
    relatedInvoice: "INV-FO-260418",
    relatedMatchId: "MATCH-INV-FO-260418",
    returnDate: "2026-05-30",
    createdDate: "2026-05-30",
    owner: "李婷",
    warehouse: "A 区",
    currency: "CNY",
    reason: "重复发票",
    status: "已生成贷项",
    approvalStatus: "已拦截",
    creditMemoId: "CM-FO-2026-0530",
    subtotal: 380000,
    tax: 49400,
    total: 429400,
    returnQty: 0,
    acceptedImpactQty: 0,
    rejectedImpactQty: 0,
    source: "invoice-variance",
    confidence: 91,
    notes: "重复发票已拦截，贷项/冲销用于关闭 AP 风险。",
    lines: [
      { lineId: "RTV-2026-0505-L1", sku: "SKU-00558", name: "不锈钢螺栓 M8×30 重复发票", unit: "件", orderedQty: 120000, receivedQty: 120000, acceptedQty: 120000, rejectedQty: 0, returnQty: 0, unitPrice: 3.1667, taxRate: 0.13, returnAmount: 380000, taxAmount: 49400, totalAmount: 429400, reason: "重复发票", relatedPoLine: "PO-2026-1284-L001", relatedGrnLine: "GRN-202605-0418-L001", relatedInvoiceLine: "SI-2026-0424-L1", notes: "不退实物，冲销重复发票金额。" },
    ],
  },
  {
    id: "RTV-2026-0506",
    returnNo: "RTV-2026-0506",
    supplier: "广州化工耗材",
    supplierCode: "SUP-GZ-CHEM",
    relatedPo: "PO-2026-1282",
    relatedGrn: "GRN-202605-0419",
    relatedInvoice: "INV-GZ-260419",
    relatedMatchId: "MATCH-INV-GZ-260419",
    returnDate: "2026-06-02",
    createdDate: "2026-06-02",
    owner: "周浩",
    warehouse: "C 区",
    currency: "CNY",
    reason: "运输损坏",
    status: "已驳回",
    approvalStatus: "已驳回",
    creditMemoId: "CM-GZ-2026-0531",
    subtotal: 15929.2,
    tax: 2070.8,
    total: 18000,
    returnQty: 1,
    acceptedImpactQty: 0,
    rejectedImpactQty: 1,
    source: "supplier-confirmation",
    confidence: 61,
    notes: "供应商认为损坏发生在厂内搬运，暂不同意贷项；需采购和仓库复核证据。",
    lines: [
      { lineId: "RTV-2026-0506-L1", sku: "SKU-00744", name: "聚氨酯密封胶 运输损坏", unit: "桶", orderedQty: 9, receivedQty: 7, acceptedQty: 5, rejectedQty: 1, returnQty: 1, unitPrice: 15929.2, taxRate: 0.13, returnAmount: 15929.2, taxAmount: 2070.8, totalAmount: 18000, reason: "运输损坏", relatedPoLine: "PO-2026-1282-L001", relatedGrnLine: "GRN-202605-0419-L001", relatedInvoiceLine: "SI-2026-0419-L1", notes: "供应商驳回，待照片和承运记录确认。" },
    ],
  },
];
