import type { ApprovalSnapshot, POStatus, RecvStatus, SupplierInvoice } from "../types/scm";

function genSeries(base: number, trend: number, seasonAmp: number, seed: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 18; i++) {
    const season = Math.sin((i / 12) * Math.PI * 2) * seasonAmp;
    const noise = Math.sin((i + seed) * 1.7) * seasonAmp * 0.22;
    out.push(Math.max(0, Math.round(base + i * trend + season + noise)));
  }
  return out;
}

export const salesData = [
  { month: "1月",  revenue: 4820000,  orders: 312,  margin: 28.4 },
  { month: "2月",  revenue: 3960000,  orders: 278,  margin: 26.1 },
  { month: "3月",  revenue: 5310000,  orders: 394,  margin: 29.8 },
  { month: "4月",  revenue: 4750000,  orders: 341,  margin: 27.6 },
  { month: "5月",  revenue: 6120000,  orders: 432,  margin: 31.2 },
  { month: "6月",  revenue: 5880000,  orders: 415,  margin: 30.4 },
  { month: "7月",  revenue: 7240000,  orders: 501,  margin: 33.1 },
  { month: "8月",  revenue: 6890000,  orders: 488,  margin: 32.7 },
  { month: "9月",  revenue: 7580000,  orders: 534,  margin: 34.2 },
  { month: "10月", revenue: 8120000,  orders: 571,  margin: 35.6 },
  { month: "11月", revenue: 9340000,  orders: 648,  margin: 36.9 },
  { month: "12月", revenue: 8760000,  orders: 612,  margin: 35.1 },
];

export const forecastData = [
  { month: "9月",  actual: 7580000,  forecast: 7200000,  lower: 6800000,  upper: 7600000  },
  { month: "10月", actual: 8120000,  forecast: 8000000,  lower: 7600000,  upper: 8400000  },
  { month: "11月", actual: 9340000,  forecast: 8800000,  lower: 8300000,  upper: 9300000  },
  { month: "12月", actual: 8760000,  forecast: 9200000,  lower: 8700000,  upper: 9700000  },
  { month: "1月",  actual: null,     forecast: 9600000,  lower: 9000000,  upper: 10200000 },
  { month: "2月",  actual: null,     forecast: 10200000, lower: 9500000,  upper: 10900000 },
  { month: "3月",  actual: null,     forecast: 11100000, lower: 10200000, upper: 12000000 },
];

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

export const inventoryItems = [
  { sku: "SKU-00142", name: "精密轴承 6204-ZZ",   category: "机械部件", qty: 2840,  min: 500,   max: 5000,  status: "正常", location: "A-03-12", turnover: 8.2,  lastIn: "5月22日" },
  { sku: "SKU-00287", name: "铝合金型材 6063",    category: "原材料",   qty: 148,   min: 300,   max: 2000,  status: "预警", location: "B-01-05", turnover: 12.4, lastIn: "5月06日" },
  { sku: "SKU-00391", name: "密封圈 NBR-70",      category: "耗材",     qty: 12400, min: 2000,  max: 20000, status: "正常", location: "C-05-08", turnover: 6.1,  lastIn: "5月24日" },
  { sku: "SKU-00412", name: "伺服电机 750W",      category: "电气元件", qty: 34,    min: 50,    max: 200,   status: "不足", location: "D-02-01", turnover: 18.7, lastIn: "4月29日" },
  { sku: "SKU-00558", name: "不锈钢螺栓 M8×30",  category: "标准件",   qty: 85000, min: 10000, max: 100000,status: "正常", location: "A-07-22", turnover: 3.4,  lastIn: "5月19日" },
  { sku: "SKU-00623", name: "控制器主板 V3.2",    category: "电气元件", qty: 12,    min: 20,    max: 80,    status: "不足", location: "D-01-03", turnover: 22.1, lastIn: "4月13日" },
  { sku: "SKU-00744", name: "聚氨酯密封胶",       category: "耗材",     qty: 920,   min: 200,   max: 3000,  status: "正常", location: "C-02-11", turnover: 5.8,  lastIn: "5月14日" },
  { sku: "SKU-00815", name: "液压油缸 50mm",      category: "机械部件", qty: 67,    min: 80,    max: 300,   status: "预警", location: "B-04-06", turnover: 9.6,  lastIn: "5月12日" },
  { sku: "SKU-00934", name: "步进电机驱动板",     category: "电气元件", qty: 89,    min: 60,    max: 250,   status: "正常", location: "D-03-07", turnover: 14.2, lastIn: "5月23日" },
  { sku: "SKU-01021", name: "气动手指夹持器",     category: "机械部件", qty: 241,   min: 100,   max: 800,   status: "正常", location: "B-06-14", turnover: 7.3,  lastIn: "5月21日" },
];

export const topProducts = [
  { name: "精密减速机 RS-200",   revenue: 3840000, growth: 12.4,  units: 284, margin: 38.2, returnRate: 0.4 },
  { name: "伺服驱动器 SD-750",   revenue: 2920000, growth: 8.7,   units: 391, margin: 34.7, returnRate: 0.6 },
  { name: "工业机器人关节模组", revenue: 2480000, growth: 21.3,  units: 128, margin: 42.1, returnRate: 0.2 },
  { name: "PLC 控制模块 C3000", revenue: 1860000, growth: -3.2,  units: 512, margin: 28.9, returnRate: 1.1 },
  { name: "气动执行器 PA-80",   revenue: 1340000, growth: 5.8,   units: 743, margin: 31.4, returnRate: 0.8 },
];

export const supplierData = [
  { rank: 1, name: "华东精工机械",   cat: "机械部件", amount: 42800000, orders: 184, ontime: 98.4, quality: 99.1, grade: "S",  trend: "up"     },
  { rank: 2, name: "深圳新元电气",   cat: "电气元件", amount: 38600000, orders: 231, ontime: 96.7, quality: 97.8, grade: "A",  trend: "up"     },
  { rank: 3, name: "江苏铝合金集团", cat: "原材料",   amount: 31200000, orders: 98,  ontime: 99.2, quality: 98.4, grade: "S",  trend: "stable" },
  { rank: 4, name: "佛山标准件",     cat: "标准件",   amount: 18400000, orders: 412, ontime: 97.1, quality: 96.2, grade: "A",  trend: "stable" },
  { rank: 5, name: "广州化工耗材",   cat: "耗材",     amount: 12600000, orders: 156, ontime: 92.3, quality: 91.8, grade: "B",  trend: "down"   },
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

export const LOTS = [
  { lot: "LOT-260512-A01", sku: "SKU-00412", name: "伺服电机 750W",      qty: 24,    received: "5月12日", expiry: "—",         supplier: "深圳新元电气",   warehouse: "D-02-01", status: "可用",     coa: true  },
  { lot: "LOT-260514-B14", sku: "SKU-00287", name: "铝合金型材 6063",    qty: 148,   received: "5月14日", expiry: "—",         supplier: "江苏铝合金集团", warehouse: "B-01-05", status: "可用",     coa: true  },
  { lot: "LOT-260519-C08", sku: "SKU-00744", name: "聚氨酯密封胶",       qty: 320,   received: "5月19日", expiry: "27年5月",  supplier: "广州化工耗材",   warehouse: "C-02-11", status: "可用",     coa: true  },
  { lot: "LOT-260520-C09", sku: "SKU-00744", name: "聚氨酯密封胶",       qty: 600,   received: "5月20日", expiry: "27年5月",  supplier: "广州化工耗材",   warehouse: "C-02-12", status: "可用",     coa: false },
  { lot: "LOT-260521-D03", sku: "SKU-00934", name: "步进电机驱动板",     qty: 89,    received: "5月21日", expiry: "—",         supplier: "深圳新元电气",   warehouse: "D-03-07", status: "冻结",     coa: true  },
  { lot: "LOT-260506-B12", sku: "SKU-00391", name: "密封圈 NBR-70",       qty: 4200,  received: "5月06日", expiry: "26年8月",  supplier: "佛山标准件",     warehouse: "C-05-08", status: "近效期",   coa: true  },
  { lot: "LOT-260503-A22", sku: "SKU-00558", name: "不锈钢螺栓 M8×30",   qty: 85000, received: "5月03日", expiry: "—",         supplier: "佛山标准件",     warehouse: "A-07-22", status: "可用",     coa: true  },
  { lot: "LOT-260427-B06", sku: "SKU-00815", name: "液压油缸 50mm",      qty: 67,    received: "4月27日", expiry: "—",         supplier: "华东精工机械",   warehouse: "B-04-06", status: "可用",     coa: true  },
];

export const SERIALS = [
  { sn: "SN-SVM-0001824",  sku: "SKU-00412", lot: "LOT-260512-A01", status: "在库",   warehouse: "D-02-01", received: "5月12日", expiry: "—" },
  { sn: "SN-SVM-0001825",  sku: "SKU-00412", lot: "LOT-260512-A01", status: "在库",   warehouse: "D-02-01", received: "5月12日", expiry: "—" },
  { sn: "SN-SVM-0001826",  sku: "SKU-00412", lot: "LOT-260512-A01", status: "已分配", warehouse: "—",       received: "5月12日", expiry: "—" },
  { sn: "SN-CTL-0000934",  sku: "SKU-00623", lot: "LOT-260413-D01", status: "在库",   warehouse: "D-01-03", received: "4月13日", expiry: "—" },
  { sn: "SN-CTL-0000935",  sku: "SKU-00623", lot: "LOT-260413-D01", status: "维修",   warehouse: "—",       received: "4月13日", expiry: "—" },
  { sn: "SN-DRV-0002148",  sku: "SKU-00934", lot: "LOT-260521-D03", status: "冻结",   warehouse: "D-03-07", received: "5月21日", expiry: "—" },
];

export const TRANSFERS = [
  { id: "TR-260527-001", from: "上海总仓", to: "苏州分仓",  sku: "SKU-00412", name: "伺服电机 750W",    qty: 12,  status: "在途",     created: "5月26日", eta: "5月28日", requester: "李婷",   carrier: "顺丰特运" },
  { id: "TR-260526-014", from: "上海总仓", to: "深圳分仓",  sku: "SKU-00623", name: "控制器主板 V3.2",  qty: 6,   status: "已发出",   created: "5月26日", eta: "5月29日", requester: "陈思远", carrier: "京东物流" },
  { id: "TR-260525-008", from: "苏州分仓", to: "上海总仓",  sku: "SKU-00744", name: "聚氨酯密封胶",     qty: 80,  status: "已签收",   created: "5月25日", eta: "5月27日", requester: "王志强", carrier: "德邦快运" },
  { id: "TR-260527-002", from: "深圳分仓", to: "上海总仓",  sku: "SKU-00934", name: "步进电机驱动板",   qty: 40,  status: "待审批",   created: "5月27日", eta: "5月30日", requester: "周浩",   carrier: "—" },
  { id: "TR-260524-019", from: "上海总仓", to: "天津分仓",  sku: "SKU-00558", name: "不锈钢螺栓 M8×30", qty: 12000, status: "已签收", created: "5月24日", eta: "5月26日", requester: "李婷",   carrier: "顺丰特运" },
];

export const COUNT_PLANS = [
  { id: "CC-2026-W21-A1", zone: "A 区高位", scheduled: "5月27日", counter: "刘建华", scope: 142, counted: 142, variance: 3,  status: "完成", method: "扫码盘点" },
  { id: "CC-2026-W21-A2", zone: "A 区平面", scheduled: "5月27日", counter: "孙明",   scope: 88,  counted: 88,  variance: 0,  status: "完成", method: "扫码盘点" },
  { id: "CC-2026-W21-B1", zone: "B 区原料", scheduled: "5月28日", counter: "刘建华", scope: 64,  counted: 32,  variance: 1,  status: "进行中", method: "人工" },
  { id: "CC-2026-W22-C1", zone: "C 区耗材", scheduled: "5月29日", counter: "—",     scope: 210, counted: 0,   variance: 0,  status: "待执行", method: "RFID 扫描" },
  { id: "CC-2026-W22-D1", zone: "D 区电气", scheduled: "5月30日", counter: "—",     scope: 124, counted: 0,   variance: 0,  status: "待执行", method: "扫码盘点" },
];

export const VARIANCES = [
  { lot: "LOT-260512-A01", sku: "SKU-00412", name: "伺服电机 750W",    book: 24,   actual: 22,   diff: -2,  reason: "拣货漏记",       value: 5960 },
  { lot: "LOT-260506-B12", sku: "SKU-00391", name: "密封圈 NBR-70",     book: 4200, actual: 4203, diff: +3,  reason: "上次盘亏冲回",   value: 12   },
  { lot: "LOT-260503-A22", sku: "SKU-00558", name: "不锈钢螺栓 M8×30", book: 85000, actual: 84994, diff: -6, reason: "破损未登记",     value: 11   },
];

export const MOVEMENTS = [
  { ts: "5月27日 14:32", type: "出库", sku: "SKU-00412", qty: -2,  ref: "SO-26-08321", from: "D-02-01", to: "—",       op: "李婷",   reason: "销售出库" },
  { ts: "5月27日 11:18", type: "入库", sku: "SKU-00744", qty: +600, ref: "GRN-260514-A03", from: "—",     to: "C-02-12", op: "刘建华", reason: "采购入库" },
  { ts: "5月27日 09:45", type: "调拨", sku: "SKU-00623", qty: -6,  ref: "TR-260526-014", from: "D-01-03", to: "深圳分仓", op: "陈思远", reason: "调拨出库" },
  { ts: "5月27日 09:12", type: "调整", sku: "SKU-00558", qty: -6,  ref: "ADJ-260527-001", from: "A-07-22", to: "—",       op: "刘建华", reason: "盘点差异" },
  { ts: "5月26日 16:48", type: "出库", sku: "SKU-00934", qty: -3,  ref: "SO-26-08319", from: "D-03-07", to: "—",       op: "周浩",   reason: "工程领用" },
  { ts: "5月26日 14:22", type: "退货", sku: "SKU-00391", qty: +24, ref: "RMA-26-0042",  from: "客户退回",  to: "C-05-08", op: "孙明",   reason: "客户退货" },
  { ts: "5月26日 10:30", type: "入库", sku: "SKU-00287", qty: +148, ref: "GRN-260514-B14", from: "—",     to: "B-01-05", op: "刘建华", reason: "采购入库" },
  { ts: "5月25日 15:50", type: "冻结", sku: "SKU-00934", qty: 0,    ref: "QA-26-0117",  from: "D-03-07", to: "D-03-07",  op: "QA",     reason: "质量复检" },
];

export const FULFILLMENT_STAGES = [
  { stage: "草稿",   count:  8, value:  2840000 },
  { stage: "已确认", count: 14, value:  9620000 },
  { stage: "拣货中", count: 22, value: 12480000 },
  { stage: "已发货", count: 31, value: 18460000 },
  { stage: "已交付", count: 48, value: 24820000 },
];

export const FORECAST_SKUS = [
  { sku: "SKU-00412", name: "伺服电机 750W",     onHand: 34,   open: 150, history: genSeries(120, 2.4,  0.18, 1.3), unit: "台" },
  { sku: "SKU-00623", name: "控制器主板 V3.2",   onHand: 12,   open: 60,  history: genSeries(46,  1.2,  0.22, 2.1), unit: "件" },
  { sku: "SKU-00287", name: "铝合金型材 6063",   onHand: 148,  open: 800, history: genSeries(620, 8,    0.14, 3.7), unit: "米" },
  { sku: "SKU-00142", name: "精密轴承 6204-ZZ",  onHand: 2840, open: 0,   history: genSeries(380, 4.6,  0.10, 4.5), unit: "件" },
  { sku: "SKU-00815", name: "液压油缸 50mm",     onHand: 67,   open: 0,   history: genSeries(140, 1.8,  0.16, 5.2), unit: "件" },
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

export const PAYABLES: {
  id: string; supplier: string; invoice: string; amount: number; due: string;
  aging: number; terms: string; status: "待付款" | "已付款" | "逾期" | "部分付款";
}[] = [
  { id: "AP-26-1842", supplier: "深圳新元电气",   invoice: "INV-526482", amount: 1248600, due: "2026-06-20", aging: -24, terms: "Net 30", status: "待付款" },
  { id: "AP-26-1843", supplier: "江苏铝合金集团", invoice: "INV-526481", amount:  864000, due: "2026-06-05", aging:  -9, terms: "Net 45", status: "待付款" },
  { id: "AP-26-1844", supplier: "佛山标准件",     invoice: "INV-526440", amount:  286400, due: "2026-05-15", aging:  12, terms: "Net 30", status: "逾期" },
  { id: "AP-26-1845", supplier: "上海仪表科技",   invoice: "INV-526484", amount:  286400, due: "2026-06-26", aging: -30, terms: "Net 60", status: "部分付款" },
  { id: "AP-26-1846", supplier: "广州化工耗材",   invoice: "INV-526392", amount:  124800, due: "2026-05-20", aging:   7, terms: "Net 30", status: "逾期" },
  { id: "AP-26-1847", supplier: "华东精工机械",   invoice: "INV-526408", amount:  642000, due: "2026-05-22", aging:   5, terms: "Net 30", status: "已付款" },
];

export const SUPPLIER_INVOICES: SupplierInvoice[] = [
  {
    id: "SI-2026-0418",
    invoiceNumber: "INV-FO-260418",
    supplier: "佛山标准件",
    supplierCode: "SUP-FS-STD",
    relatedPo: "PO-2026-1284",
    relatedGrn: "GRN-202605-0418",
    invoiceDate: "2026-05-27",
    receivedDate: "2026-05-27",
    dueDate: "2026-06-26",
    currency: "CNY",
    subtotal: 380000,
    tax: 49400,
    freight: 0,
    total: 429400,
    paymentTerms: "Net 30",
    owner: "李婷",
    apOwner: "赵敏",
    source: "supplier-portal",
    status: "已过账应付",
    matchStatus: "自动匹配",
    varianceType: "无差异",
    varianceAmount: 0,
    approvalStatus: "已审批",
    postedToAp: true,
    paid: false,
    confidence: 94,
    notes: "PO、GRN 与发票金额在容差内，已进入应付。",
    lines: [
      { lineId: "SI-2026-0418-L1", sku: "SKU-00558", name: "不锈钢螺栓 M8×30", poLine: "PO-2026-1284-L001", grnLine: "GRN-202605-0418-L001", quantity: 120000, unit: "件", unitPrice: 3.1667, taxRate: 0.13, taxAmount: 49400, lineSubtotal: 380000, lineTotal: 429400, orderedQty: 120000, receivedQty: 120000, matchedQty: 120000, varianceType: "无差异", varianceAmount: 0 },
    ],
  },
  {
    id: "SI-2026-0419",
    invoiceNumber: "INV-GZ-260419",
    supplier: "广州化工耗材",
    supplierCode: "SUP-GZ-CHEM",
    relatedPo: "PO-2026-1282",
    relatedGrn: "GRN-202605-0419",
    invoiceDate: "2026-05-28",
    receivedDate: "2026-05-28",
    dueDate: "2026-06-27",
    currency: "CNY",
    subtotal: 332000,
    tax: 43160,
    freight: 14840,
    total: 390000,
    paymentTerms: "Net 30",
    owner: "周浩",
    apOwner: "赵敏",
    source: "email-upload",
    status: "存在差异",
    matchStatus: "差异待处理",
    varianceType: "数量差异",
    varianceAmount: 42000,
    approvalStatus: "待复核",
    postedToAp: false,
    paid: false,
    confidence: 76,
    notes: "发票数量超过 GRN 合格数量，需确认拒收品是否补发或贷项处理。",
    lines: [
      { lineId: "SI-2026-0419-L1", sku: "SKU-00744", name: "聚氨酯密封胶", poLine: "PO-2026-1282-L001", grnLine: "GRN-202605-0419-L001", quantity: 9, unit: "桶", unitPrice: 36888.89, taxRate: 0.13, taxAmount: 43160, lineSubtotal: 332000, lineTotal: 375160, orderedQty: 9, receivedQty: 7, matchedQty: 7, varianceType: "数量差异", varianceAmount: 42000 },
    ],
  },
  {
    id: "SI-2026-0420",
    invoiceNumber: "INV-JS-260420",
    supplier: "江苏铝合金集团",
    supplierCode: "SUP-JS-ALU",
    relatedPo: "PO-2026-1285",
    relatedGrn: "GRN-202605-0420",
    invoiceDate: "2026-05-29",
    receivedDate: "2026-05-29",
    dueDate: "2026-07-13",
    currency: "CNY",
    subtotal: 1012000,
    tax: 131560,
    freight: 0,
    total: 1143560,
    paymentTerms: "Net 45",
    owner: "王志强",
    apOwner: "赵敏",
    source: "edi-sample",
    status: "存在差异",
    matchStatus: "差异待处理",
    varianceType: "价格差异",
    varianceAmount: 32000,
    approvalStatus: "待复核",
    postedToAp: false,
    paid: false,
    confidence: 79,
    notes: "发票单价高于 PO 价格，需采购确认是否有调价协议。",
    lines: [
      { lineId: "SI-2026-0420-L1", sku: "SKU-00287", name: "铝合金型材 6063", poLine: "PO-2026-1285-L001", grnLine: "GRN-202605-0420-L001", quantity: 52000, unit: "米", unitPrice: 19.4615, taxRate: 0.13, taxAmount: 131560, lineSubtotal: 1012000, lineTotal: 1143560, orderedQty: 52000, receivedQty: 52000, matchedQty: 52000, varianceType: "价格差异", varianceAmount: 32000 },
    ],
  },
  {
    id: "SI-2026-0421",
    invoiceNumber: "INV-HD-260421",
    supplier: "华东精工机械",
    supplierCode: "SUP-HD-MECH",
    relatedPo: "PO-2026-1286",
    relatedGrn: "GRN-202605-0421",
    invoiceDate: "2026-05-29",
    receivedDate: "2026-05-30",
    dueDate: "2026-06-29",
    currency: "CNY",
    subtotal: 2640000,
    tax: 343200,
    freight: 0,
    total: 2983200,
    paymentTerms: "Net 30",
    owner: "李婷",
    apOwner: "赵敏",
    source: "supplier-portal",
    status: "待匹配",
    matchStatus: "人工复核",
    varianceType: "缺少收货",
    varianceAmount: 2983200,
    approvalStatus: "待匹配",
    postedToAp: false,
    paid: false,
    confidence: 68,
    notes: "发票已到，但 GRN 尚未完成签收，暂不进入应付。",
    lines: [
      { lineId: "SI-2026-0421-L1", sku: "SKU-00815", name: "液压油缸 50mm", poLine: "PO-2026-1286-L001", grnLine: "GRN-202605-0421-L001", quantity: 12, unit: "件", unitPrice: 220000, taxRate: 0.13, taxAmount: 343200, lineSubtotal: 2640000, lineTotal: 2983200, orderedQty: 12, receivedQty: 0, matchedQty: 0, varianceType: "缺少收货", varianceAmount: 2983200 },
    ],
  },
  {
    id: "SI-2026-0422",
    invoiceNumber: "INV-SZ-260422",
    supplier: "深圳新元电气",
    supplierCode: "SUP-SZ-ELEC",
    relatedPo: "PO-2026-1283",
    relatedGrn: "GRN-202605-0422",
    invoiceDate: "2026-05-27",
    receivedDate: "2026-05-27",
    dueDate: "2026-06-26",
    currency: "CNY",
    subtotal: 1280000,
    tax: 166400,
    freight: 8600,
    total: 1455000,
    paymentTerms: "Net 30",
    owner: "陈思远",
    apOwner: "赵敏",
    source: "manual-entry",
    status: "存在差异",
    matchStatus: "人工复核",
    varianceType: "运费差异",
    varianceAmount: 8600,
    approvalStatus: "待复核",
    postedToAp: false,
    paid: false,
    confidence: 82,
    notes: "货款匹配，发票额外运费需确认是否合同允许。",
    lines: [
      { lineId: "SI-2026-0422-L1", sku: "SKU-00623", name: "控制器主板 V3.2", poLine: "PO-2026-1283-L001", grnLine: "GRN-202605-0422-L001", quantity: 6, unit: "件", unitPrice: 213333.33, taxRate: 0.13, taxAmount: 166400, lineSubtotal: 1280000, lineTotal: 1446400, orderedQty: 6, receivedQty: 6, matchedQty: 6, varianceType: "运费差异", varianceAmount: 8600 },
    ],
  },
  {
    id: "SI-2026-0423",
    invoiceNumber: "INV-HD-260423",
    supplier: "华东精工机械",
    supplierCode: "SUP-HD-MECH",
    relatedPo: "PO-2026-1281",
    relatedGrn: "GRN-202605-0423",
    invoiceDate: "2026-05-26",
    receivedDate: "2026-05-26",
    dueDate: "2026-05-26",
    currency: "CNY",
    subtotal: 1920000,
    tax: 249600,
    freight: 0,
    total: 2169600,
    paymentTerms: "Due on receipt",
    owner: "李婷",
    apOwner: "赵敏",
    source: "edi-sample",
    status: "已付款",
    matchStatus: "自动匹配",
    varianceType: "无差异",
    varianceAmount: 0,
    approvalStatus: "已审批",
    postedToAp: true,
    paid: true,
    confidence: 96,
    notes: "三单匹配通过，已完成演示付款状态。",
    lines: [
      { lineId: "SI-2026-0423-L1", sku: "SKU-00142", name: "精密轴承 6204-ZZ", poLine: "PO-2026-1281-L001", grnLine: "GRN-202605-0423-L001", quantity: 7, unit: "批", unitPrice: 274285.71, taxRate: 0.13, taxAmount: 249600, lineSubtotal: 1920000, lineTotal: 2169600, orderedQty: 7, receivedQty: 7, matchedQty: 7, varianceType: "无差异", varianceAmount: 0 },
    ],
  },
  {
    id: "SI-2026-0424",
    invoiceNumber: "INV-FO-260418",
    supplier: "佛山标准件",
    supplierCode: "SUP-FS-STD",
    relatedPo: "PO-2026-1284",
    relatedGrn: "GRN-202605-0418",
    invoiceDate: "2026-05-30",
    receivedDate: "2026-05-30",
    dueDate: "2026-06-29",
    currency: "CNY",
    subtotal: 380000,
    tax: 49400,
    freight: 0,
    total: 429400,
    paymentTerms: "Net 30",
    owner: "李婷",
    apOwner: "赵敏",
    source: "email-upload",
    status: "存在差异",
    matchStatus: "差异待处理",
    varianceType: "重复发票",
    varianceAmount: 429400,
    approvalStatus: "已拦截",
    postedToAp: false,
    paid: false,
    duplicateRisk: true,
    confidence: 91,
    notes: "同供应商同发票号已存在，需退回或合并附件。",
    lines: [
      { lineId: "SI-2026-0424-L1", sku: "SKU-00558", name: "不锈钢螺栓 M8×30", poLine: "PO-2026-1284-L001", grnLine: "GRN-202605-0418-L001", quantity: 120000, unit: "件", unitPrice: 3.1667, taxRate: 0.13, taxAmount: 49400, lineSubtotal: 380000, lineTotal: 429400, orderedQty: 120000, receivedQty: 120000, matchedQty: 120000, varianceType: "重复发票", varianceAmount: 429400 },
    ],
  },
  {
    id: "SI-2026-0425",
    invoiceNumber: "INV-SZ-260425",
    supplier: "深圳新元电气",
    supplierCode: "SUP-SZ-ELEC",
    relatedPo: "PO-2026-1287",
    invoiceDate: "2026-05-31",
    receivedDate: "2026-05-31",
    dueDate: "2026-06-30",
    currency: "CNY",
    subtotal: 1840000,
    tax: 239200,
    freight: 0,
    total: 2079200,
    paymentTerms: "Net 30",
    owner: "陈思远",
    apOwner: "赵敏",
    source: "supplier-portal",
    status: "待匹配",
    matchStatus: "未匹配",
    varianceType: "缺少收货",
    varianceAmount: 2079200,
    approvalStatus: "待匹配",
    postedToAp: false,
    paid: false,
    confidence: 64,
    notes: "PO 待审批且暂无 GRN，发票暂挂起。",
    lines: [
      { lineId: "SI-2026-0425-L1", sku: "SKU-00412", name: "伺服电机 750W", poLine: "PO-2026-1287-L001", quantity: 8, unit: "台", unitPrice: 230000, taxRate: 0.13, taxAmount: 239200, lineSubtotal: 1840000, lineTotal: 2079200, orderedQty: 8, receivedQty: 0, matchedQty: 0, varianceType: "缺少收货", varianceAmount: 2079200 },
    ],
  },
];

export const PORTAL_SUPPLIERS: {
  name: string; rating: number; onTime: number; quality: number; resp: number; po: number; spend: number; flag: "战略" | "核心" | "备选" | "整改";
}[] = [
  { name: "深圳新元电气",   rating: 4.7, onTime: 96.8, quality: 99.2, resp: 92, po: 28, spend: 8460000, flag: "战略" },
  { name: "江苏铝合金集团", rating: 4.6, onTime: 94.2, quality: 98.6, resp: 88, po: 22, spend: 6240000, flag: "战略" },
  { name: "佛山标准件",     rating: 4.4, onTime: 92.4, quality: 97.8, resp: 90, po: 36, spend: 2840000, flag: "核心" },
  { name: "上海仪表科技",   rating: 4.5, onTime: 95.1, quality: 99.0, resp: 84, po: 14, spend: 1860000, flag: "核心" },
  { name: "广州化工耗材",   rating: 3.8, onTime: 86.4, quality: 94.2, resp: 76, po: 18, spend: 1240000, flag: "整改" },
  { name: "华东精工机械",   rating: 4.2, onTime: 91.6, quality: 97.4, resp: 82, po: 12, spend:  920000, flag: "备选" },
];

export const SKU_CATALOG = [
  { sku: "SKU-00142", name: "精密轴承 6204-ZZ",  unit: "件", price: 86,    suppliers: ["华东精工机械"] },
  { sku: "SKU-00287", name: "铝合金型材 6063",   unit: "米", price: 142,   suppliers: ["江苏铝合金集团"] },
  { sku: "SKU-00391", name: "密封圈 NBR-70",     unit: "件", price: 4,     suppliers: ["佛山标准件", "广州化工耗材"] },
  { sku: "SKU-00412", name: "伺服电机 750W",     unit: "台", price: 2980,  suppliers: ["深圳新元电气"] },
  { sku: "SKU-00558", name: "不锈钢螺栓 M8×30", unit: "件", price: 1.8,   suppliers: ["佛山标准件"] },
  { sku: "SKU-00623", name: "控制器主板 V3.2",   suppliers: ["深圳新元电气"], unit: "件", price: 12400 },
  { sku: "SKU-00744", name: "聚氨酯密封胶",      unit: "桶", price: 320,   suppliers: ["广州化工耗材"] },
  { sku: "SKU-00815", name: "液压油缸 50mm",     unit: "件", price: 4600,  suppliers: ["华东精工机械"] },
  { sku: "SKU-00934", name: "步进电机驱动板",    unit: "件", price: 1840,  suppliers: ["深圳新元电气"] },
  { sku: "SKU-01021", name: "气动手指夹持器",    unit: "件", price: 820,   suppliers: ["华东精工机械"] },
];

export const SUPPLIER_LIST = ["深圳新元电气", "华东精工机械", "江苏铝合金集团", "佛山标准件", "广州化工耗材", "上海仪表科技"];

export const OWNERS = ["陈思远", "李婷", "王志强", "周浩"];
