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
