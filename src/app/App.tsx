import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Toaster, toast } from "sonner";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, ComposedChart, ReferenceLine, ReferenceArea,
} from "recharts";
import {
  Package, ShoppingCart, TrendingUp, DollarSign, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Bell, Search, ChevronRight,
  Activity, Truck, Sparkles, RefreshCw, Zap, Eye, Clock,
  CheckCircle2, XCircle, Minus, ChevronDown, BarChart2,
  ClipboardList, PackageCheck, FileText, ScanLine, MapPin, User,
  AlertCircle, ArrowRight, Plus, Filter, Calendar, Hash,
  X, Trash2, Check, Loader2, Camera, FileCheck2, Send,
  Layers, ArrowLeftRight, ClipboardCheck, Grid3x3, History, Boxes,
  Users, Receipt, Tag, Repeat, FileSpreadsheet, Handshake, Wallet,
  Inbox, ShieldCheck, AlertOctagon, Undo2, Building2, CreditCard,
} from "lucide-react";

// ─── Apple System Colors ──────────────────────────────────────────────────────
const A = {
  blue:   "#0071e3",
  green:  "#34c759",
  orange: "#ff9500",
  red:    "#ff3b30",
  purple: "#af52de",
  teal:   "#32ade6",
  indigo: "#5856d6",
  gray1:  "#8e8e93",
  gray2:  "#aeaeb2",
  gray3:  "#c7c7cc",
  gray4:  "#d1d1d6",
  gray5:  "#e5e5ea",
  gray6:  "#f2f2f7",
  label:  "#1d1d1f",
  sub:    "#86868b",
  white:  "#ffffff",
  bg:     "#f5f5f7",
};

// ─── Data ────────────────────────────────────────────────────────────────────
const salesData = [
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

const forecastData = [
  { month: "9月",  actual: 7580000,  forecast: 7200000,  lower: 6800000,  upper: 7600000  },
  { month: "10月", actual: 8120000,  forecast: 8000000,  lower: 7600000,  upper: 8400000  },
  { month: "11月", actual: 9340000,  forecast: 8800000,  lower: 8300000,  upper: 9300000  },
  { month: "12月", actual: 8760000,  forecast: 9200000,  lower: 8700000,  upper: 9700000  },
  { month: "1月",  actual: null,     forecast: 9600000,  lower: 9000000,  upper: 10200000 },
  { month: "2月",  actual: null,     forecast: 10200000, lower: 9500000,  upper: 10900000 },
  { month: "3月",  actual: null,     forecast: 11100000, lower: 10200000, upper: 12000000 },
];

const procurementData = [
  { category: "原材料",   amount: 12840000, pct: 38, yoy: 11.2 },
  { category: "半成品",   amount: 8920000,  pct: 26, yoy: 7.4  },
  { category: "包装材料", amount: 4470000,  pct: 13, yoy: -2.1 },
  { category: "设备耗材", amount: 3760000,  pct: 11, yoy: 4.8  },
  { category: "物流运输", amount: 4130000,  pct: 12, yoy: 9.3  },
];

const inventoryItems = [
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

const topProducts = [
  { name: "精密减速机 RS-200",   revenue: 3840000, growth: 12.4,  units: 284, margin: 38.2, returnRate: 0.4 },
  { name: "伺服驱动器 SD-750",   revenue: 2920000, growth: 8.7,   units: 391, margin: 34.7, returnRate: 0.6 },
  { name: "工业机器人关节模组", revenue: 2480000, growth: 21.3,  units: 128, margin: 42.1, returnRate: 0.2 },
  { name: "PLC 控制模块 C3000", revenue: 1860000, growth: -3.2,  units: 512, margin: 28.9, returnRate: 1.1 },
  { name: "气动执行器 PA-80",   revenue: 1340000, growth: 5.8,   units: 743, margin: 31.4, returnRate: 0.8 },
];

const supplierData = [
  { rank: 1, name: "华东精工机械",   cat: "机械部件", amount: 42800000, orders: 184, ontime: 98.4, quality: 99.1, grade: "S",  trend: "up"     },
  { rank: 2, name: "深圳新元电气",   cat: "电气元件", amount: 38600000, orders: 231, ontime: 96.7, quality: 97.8, grade: "A",  trend: "up"     },
  { rank: 3, name: "江苏铝合金集团", cat: "原材料",   amount: 31200000, orders: 98,  ontime: 99.2, quality: 98.4, grade: "S",  trend: "stable" },
  { rank: 4, name: "佛山标准件",     cat: "标准件",   amount: 18400000, orders: 412, ontime: 97.1, quality: 96.2, grade: "A",  trend: "stable" },
  { rank: 5, name: "广州化工耗材",   cat: "耗材",     amount: 12600000, orders: 156, ontime: 92.3, quality: 91.8, grade: "B",  trend: "down"   },
];

const monthlyProcurement = [
  { month: "7月",  amount: 2640000, budget: 2800000 },
  { month: "8月",  amount: 2980000, budget: 2800000 },
  { month: "9月",  amount: 3120000, budget: 3000000 },
  { month: "10月", amount: 3240000, budget: 3200000 },
  { month: "11月", amount: 3680000, budget: 3500000 },
  { month: "12月", amount: 3412000, budget: 3600000 },
];

const pieColors = [A.blue, A.green, A.orange, A.purple, A.teal];

// ─── Purchase Orders ─────────────────────────────────────────────────────────
type POStatus = "草稿" | "待审批" | "已审批" | "已发出" | "部分到货" | "已完成" | "已取消";
const purchaseOrders: {
  po: string; supplier: string; created: string; eta: string; owner: string;
  amount: number; items: number; received: number; status: POStatus; priority: "高" | "中" | "低";
  paid: boolean;
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

const poStatusMeta: Record<POStatus, { color: string; bg: string }> = {
  "草稿":     { color: A.gray1,  bg: A.gray6  },
  "待审批":   { color: A.orange, bg: "#fff8f0" },
  "已审批":   { color: A.indigo, bg: "#eef0ff" },
  "已发出":   { color: A.blue,   bg: "#f0f6ff" },
  "部分到货": { color: A.teal,   bg: "#e8f6fc" },
  "已完成":   { color: A.green,  bg: "#f0faf4" },
  "已取消":   { color: A.red,    bg: "#fff1f0" },
};

const poApprovalQueue = [
  { po: "PO-2026-1287", supplier: "深圳新元电气", amount: 1840000, requestor: "陈思远", wait: "4小时", reason: "伺服电机紧急补货" },
  { po: "PO-2026-1279", supplier: "深圳新元电气", amount: 528000,  requestor: "陈思远", wait: "1小时", reason: "驱动板季度备货" },
  { po: "PO-2026-1278", supplier: "上海仪表科技", amount: 92000,   requestor: "周浩",   wait: "30分钟", reason: "测量仪表更换" },
];

const procurementTrend = [
  { day: "周一", po: 8,  amount: 1240 },
  { day: "周二", po: 12, amount: 2840 },
  { day: "周三", po: 6,  amount: 1620 },
  { day: "周四", po: 15, amount: 3640 },
  { day: "周五", po: 11, amount: 2380 },
  { day: "周六", po: 3,  amount: 480  },
  { day: "周日", po: 1,  amount: 120  },
];

// ─── Receiving ───────────────────────────────────────────────────────────────
type RecvStatus = "待收货" | "已签收" | "质检中" | "已入库" | "异常处理";
const receivingDocs: {
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

const recvStatusMeta: Record<RecvStatus, { color: string; bg: string }> = {
  "待收货":   { color: A.gray1,  bg: A.gray6  },
  "已签收":   { color: A.blue,   bg: "#f0f6ff" },
  "质检中":   { color: A.orange, bg: "#fff8f0" },
  "已入库":   { color: A.green,  bg: "#f0faf4" },
  "异常处理": { color: A.red,    bg: "#fff1f0" },
};

const arrivalSchedule = [
  { time: "09:00", supplier: "佛山标准件",     po: "PO-2026-1284", dock: "Dock-02", driver: "王师傅 / 粤B·12846", status: "已到达" },
  { time: "10:30", supplier: "广州化工耗材",   po: "PO-2026-1282", dock: "Dock-04", driver: "李师傅 / 粤A·39201", status: "已到达" },
  { time: "13:00", supplier: "江苏铝合金集团", po: "PO-2026-1285", dock: "Dock-01", driver: "陈师傅 / 苏A·82014", status: "已到达" },
  { time: "14:30", supplier: "华东精工机械",   po: "PO-2026-1286", dock: "Dock-03", driver: "赵师傅 / 沪D·17729", status: "在途"  },
  { time: "16:00", supplier: "深圳新元电气",   po: "PO-2026-1287", dock: "Dock-02", driver: "—",                  status: "待发车" },
  { time: "17:30", supplier: "上海仪表科技",   po: "PO-2026-1278", dock: "Dock-04", driver: "—",                  status: "待发车" },
];

const qcExceptions = [
  { grn: "GRN-202605-0419", item: "聚氨酯密封胶 5L 装", po: "PO-2026-1282", qty: 12, failed: 2, type: "外观破损", action: "整批退货", severity: "中" },
  { grn: "GRN-202605-0419", item: "工业清洁剂 25L",     po: "PO-2026-1282", qty: 6,  failed: 1, type: "标签批次不符", action: "供应商补发", severity: "低" },
  { grn: "GRN-202605-0415", item: "伺服电机 750W",       po: "PO-2026-1276", qty: 24, failed: 3, type: "测试不通过", action: "已退回", severity: "高" },
];

const navItems = [
  { icon: BarChart2,     label: "总览",       id: "overview"     },
  { icon: Package,       label: "库存管理",   id: "inventory"    },
  { icon: ShoppingCart,  label: "产品销售",   id: "sales"        },
  { icon: TrendingUp,    label: "预测分析",   id: "forecast"     },
  { icon: ClipboardList, label: "采购订单",   id: "purchasing"   },
  { icon: PackageCheck,  label: "收货管理",   id: "receiving"    },
  { icon: DollarSign,    label: "采购费用",   id: "procurement"  },
];

// ─── AI Insights ──────────────────────────────────────────────────────────────
const AI_INSIGHTS: Record<string, { type: "risk" | "opportunity" | "info" | "action"; title: string; body: string; metric?: string }[]> = {
  overview: [
    { type: "risk",        title: "电气元件库存告急",   body: "伺服电机 750W 当前库存仅 34 件，按每周消耗 18 件计算，预计 36 小时内断货。控制器主板 V3.2 库存同样低于安全线。建议立即触发紧急采购，预计影响在制订单约 ¥84 万。", metric: "影响 ¥84 万" },
    { type: "opportunity", title: "机器人模组高速增长", body: "工业机器人关节模组 Q1 2026 增速 +21.3%，毛利率高达 42.1%，是当前产品线中增长最快、盈利最强的品类。建议将其列为 H2 2026 重点投入，全年营收有望突破 ¥6,800 万。", metric: "潜力 ¥6,800 万" },
    { type: "info",        title: "采购集中度偏高",     body: "前三大供应商采购额占比达 67.4%，华东精工单家占比 12.5%。供应链集中风险较高，建议逐步引入备选供应商，将前三集中度控制在 55% 以内。", metric: "集中度 67.4%" },
    { type: "action",      title: "双周滚动采购建议",   body: "过去 6 个月采购支出月均超预算 4.8%，主因紧急追单。AI 建议将原材料采购周期从月采调整为双周滚动，可降低库存资金占用约 ¥320 万，减少紧急采购频率。", metric: "节省 ¥320 万/年" },
  ],
  inventory: [
    { type: "risk",        title: "3 个 SKU 断货倒计时", body: "SKU-00412（伺服电机 750W）、SKU-00623（控制器主板 V3.2）、SKU-00287（铝合金型材 6063）均低于安全库存。控制器主板按当前消耗速率预计 36 小时内耗尽。", metric: "断货 36h 内" },
    { type: "opportunity", title: "过剩库存释放资金",   body: "不锈钢螺栓 M8×30 库存 85,000 件，周转率仅 3.4x，远低于品类均值 7.2x。建议与供应商协商退换或降低采购频次，可释放流动资金约 ¥48 万。", metric: "释放 ¥48 万" },
    { type: "info",        title: "库存健康度 72 / 100", body: "8,412 个活跃 SKU 中，82.3% 正常、10.1% 预警、7.6% 不足。健康度较上月提升 3.2 分，主要源于精密轴承类及时补货。" },
    { type: "action",      title: "建议开展 ABC 分类复审", body: "124 个 SKU 连续 90 天零出库，占用库位成本约 ¥12 万/年。建议对 C 类零动态 SKU 进行清退或转移，季度复审后预计可优化 15% 库位利用率。", metric: "优化 124 个库位" },
  ],
  sales: [
    { type: "opportunity", title: "机器人模组拉动强劲", body: "工业机器人关节模组毛利率 42.1%，同比增长 21.3%，是产品组合中的核心增长引擎。建议优先保证该品类库存充足，并在 Q1 增加销售资源投入。", metric: "预测年收入 ¥6,800 万" },
    { type: "risk",        title: "PLC 模块竞争力下滑", body: "PLC 控制模块 C3000 同比 -3.2%，退货率升至 1.1%（行业均值 0.5%）。产品版本迭代落后竞品约 8 个月，建议启动 C4000 升级项目以挽回市场份额。", metric: "风险 ¥186 万" },
    { type: "info",        title: "季节性规律稳定",     body: "连续 3 年数据显示，11 月为营收峰值（较年均高 28.4%），2 月为低谷（较年均低 18.2%）。当前 2 月预测 ¥1.02 亿符合历史规律，建议提前备货应对 Q2 回暖。" },
    { type: "action",      title: "客单价提升空间",     body: "当前客单价 ¥15.4 万低于行业均值 ¥18.2 万达 15.4%。TOP 10 大客户中有 6 家存在交叉销售机会尚未挖掘。建议专项推进，目标将客单价提升至 ¥17 万以上。", metric: "提升空间 10.4%" },
  ],
  forecast: [
    { type: "opportunity", title: "Q1 营收预测上修",   body: "综合近 3 个月实际超预测均值 4.8% 与制造业 PMI 回升信号，AI 将 Q1 营收预测从 ¥2.96 亿上修至 ¥3.09 亿，置信区间 ±8.2%。", metric: "上修 +¥1,300 万" },
    { type: "risk",        title: "2 月现金流压力",    body: "春节效应将导致 2 月订单量环比下降 35-40%，但采购成本相对刚性。预计 2 月经营性现金流承压，建议提前在 1 月末完成 ¥2,000 万以上回款确认。", metric: "现金流预警 ¥2,000 万" },
    { type: "info",        title: "模型准确率 94.2%",  body: "过去 6 个月 MAPE 为 5.8%，预测准确率 94.2%。营收预测优于订单量预测（95.1% vs 92.8%）。模型正持续接入新数据进行迭代优化。" },
    { type: "action",      title: "1 月紧急补货建议",  body: "基于预测模型，建议 1 月 10 日前完成铝合金型材、控制器主板、伺服电机的紧急采购，合计约 ¥340 万，可覆盖至 3 月底需求。", metric: "建议采购 ¥340 万" },
  ],
  purchasing: [
    { type: "risk",        title: "3 张高优先级 PO 待审批",  body: "PO-2026-1287（深圳新元电气 ¥184 万）已等待审批超过 4 小时，关联的伺服电机为 SKU-00412 紧急补货。如未在今日 18:00 前审批，预计周一将出现产线停工，影响在制订单约 ¥126 万。", metric: "停工风险 ¥126 万" },
    { type: "opportunity", title: "合并下单可锁价 +2.4%",   body: "AI 检测到本周 5 张针对深圳新元电气的草稿/待审批 PO，合计 ¥248 万。若合并为单一框架订单，根据 Q3 价格表可锁定 2.4% 折扣，节省约 ¥6 万；同时减少 4 次物流安排。", metric: "节省 ¥6 万" },
    { type: "info",        title: "采购周期同比缩短 18%",   body: "12 月平均下单至签收周期 6.8 天，去年同期 8.3 天。改善主要源于审批电子化和 3 家区域供应商引入。但江苏铝合金运输仍达 9.4 天，建议评估华东仓中转方案。" },
    { type: "action",      title: "签约前合规检查",         body: "PO-2026-1287、PO-2026-1286 金额均超过 ¥150 万阈值，按制度需财务总监会签且需附 2 家比价记录。当前仅 PO-1286 已附比价文件，PO-1287 缺失，建议补齐再提交审批。", metric: "合规 1/2 待补" },
  ],
  receiving: [
    { type: "risk",        title: "广州化工本月第 3 次质检异常", body: "GRN-202605-0419 检出外观破损 2 件、批次不符 1 件，是本月第 3 次质检不合格事件，累计不合格率达 8.7%（合同约定 ≤3%）。可启动质量索赔条款，建议同步暂停下单并要求驻厂整改。", metric: "不合格率 8.7%" },
    { type: "opportunity", title: "Dock 利用率仅 58%",      body: "本周 4 个 Dock 平均利用率 58%，Dock-04 利用率最低（41%）。可向上游供应商开放预约时段，提升至 75% 后，单日吞吐可从 18 单提升至 24 单，无需新增人力。", metric: "+33% 吞吐" },
    { type: "info",        title: "三单匹配自动通过率 92.4%", body: "本月 GRN/PO/发票三单自动匹配通过率 92.4%，剩余 7.6% 主要为数量小差异（±2%）。建议将自动匹配容差从 ±0.5% 调至 ±2%，可释放约 14 人时/月。" },
    { type: "action",      title: "14:30 到货需提前预备",    body: "华东精工 PO-2026-1286（¥264 万、12 行）将于 14:30 抵达 Dock-03。建议提前 30 分钟通知质检团队到位，并预清出 A 区高位货架，避免上次堵塞导致的 90 分钟延误。", metric: "预防 90 分钟延误" },
  ],
  procurement: [
    { type: "risk",        title: "铝合金原材料涨价风险", body: "铝合金期货 Q4 上涨 8.3%，若趋势延续至 Q1，全年原材料采购成本将增加约 ¥680 万。建议与江苏铝合金集团锁定半年期价格协议以规避波动。", metric: "成本风险 ¥680 万" },
    { type: "opportunity", title: "物流费用优化空间",    body: "物流运输费用 ¥413 万（占 12%）。通过合并采购批次并与 3PL 签订年框协议，AI 估计可降低物流成本 18-22%，全年节省 ¥74-90 万。", metric: "节省 ¥74-90 万" },
    { type: "info",        title: "广州化工绩效预警",   body: "广州化工耗材连续 2 季度准时交付率低于合同要求（约定 ≥96%，实际 92.3%），质量合格率 91.8% 亦不达标。按合同条款可申请违约金约 ¥18 万。", metric: "违约金 ¥18 万" },
    { type: "action",      title: "安全库存系数调整",   body: "11 月采购额超预算 10.5%，71% 源于紧急追单。AI 建议将安全库存系数从 1.2 调至 1.5，预计可将月均超支率从 4.8% 降至 1.2%，从根源减少紧急采购。", metric: "超支率降低 3.6pts" },
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(n: number) {
  if (n >= 1e8) return `¥${(n / 1e8).toFixed(2)}亿`;
  if (n >= 1e4) return `¥${(n / 1e4).toFixed(0)}万`;
  return `¥${n.toLocaleString()}`;
}

const insightMeta = {
  risk:        { color: A.red,    bg: "#fff1f0", label: "风险预警", icon: AlertTriangle },
  opportunity: { color: A.green,  bg: "#f0faf4", label: "增长机会", icon: TrendingUp    },
  info:        { color: A.blue,   bg: "#f0f6ff", label: "分析洞察", icon: Eye           },
  action:      { color: A.orange, bg: "#fff8f0", label: "行动建议", icon: Zap           },
};

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    正常:   { color: A.green,  bg: "#f0faf4" },
    预警:   { color: A.orange, bg: "#fff8f0" },
    不足:   { color: A.red,    bg: "#fff1f0" },
    关注:   { color: A.orange, bg: "#fff8f0" },
    高风险: { color: A.red,    bg: "#fff1f0" },
    草稿:   { color: A.gray1,  bg: "#f2f2f7" },
    已确认: { color: A.blue,   bg: "#eff6ff" },
    拣货中: { color: A.orange, bg: "#fff8f0" },
    已发货: { color: A.purple, bg: "#faf3ff" },
    已交付: { color: A.green,  bg: "#f0faf4" },
    已关闭: { color: A.gray1,  bg: "#f2f2f7" },
    待审批: { color: A.orange, bg: "#fff8f0" },
    已审批: { color: A.blue,   bg: "#eff6ff" },
    已收货: { color: A.purple, bg: "#faf3ff" },
    已结案: { color: A.green,  bg: "#f0faf4" },
    生效中: { color: A.green,  bg: "#f0faf4" },
    待生效: { color: A.blue,   bg: "#eff6ff" },
    已停用: { color: A.gray1,  bg: "#f2f2f7" },
  };
  const s = map[status] ?? { color: A.gray1, bg: "#f2f2f7" };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ color: s.color, background: s.bg }}>
      {status}
    </span>
  );
}

function Chip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ color, background: bg }}>
      {label}
    </span>
  );
}

// Apple-style card with clean shadow
function Card({ children, className = "", style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`bg-white rounded-2xl ${className}`}
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.06)", ...style }}>
      {children}
    </div>
  );
}

function KpiCard({ label, value, sub, delta, positive, icon: Icon, color }: {
  label: string; value: string; sub?: string; delta?: string; positive?: boolean;
  icon: React.ElementType; color?: string;
}) {
  const c = color ?? A.blue;
  return (
    <Card className="p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${c}18` }}>
          <Icon size={16} style={{ color: c }} strokeWidth={1.8} />
        </div>
        {delta !== undefined && (
          <div className={`flex items-center gap-0.5 text-xs font-medium`}
            style={{ color: positive ? A.green : A.red }}>
            {positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {delta}
          </div>
        )}
      </div>
      <div>
        <div className="text-[22px] font-semibold tracking-tight" style={{ color: A.label }}>{value}</div>
        <div className="text-xs mt-0.5" style={{ color: A.sub }}>{label}</div>
        {sub && <div className="text-[11px] mt-0.5" style={{ color: A.gray2 }}>{sub}</div>}
      </div>
    </Card>
  );
}

// Apple-style segmented control
function SegmentedControl({ options, value, onChange }: {
  options: { label: string; value: string }[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex p-0.5 rounded-lg" style={{ background: A.gray5 }}>
      {options.map((opt) => (
        <button key={opt.value} onClick={() => onChange(opt.value)}
          className="px-3 py-1 rounded-md text-xs font-medium transition-all duration-150"
          style={value === opt.value
            ? { background: A.white, color: A.label, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }
            : { background: "transparent", color: A.sub }}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const AppleTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2.5 text-xs"
      style={{ background: "rgba(255,255,255,0.95)", boxShadow: "0 4px 20px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.08)", backdropFilter: "blur(20px)" }}>
      <div className="font-medium mb-1.5" style={{ color: A.label }}>{label}</div>
      {payload.map((p: any, i: number) => (
        p.value !== null && (
          <div key={i} className="flex justify-between gap-4">
            <span style={{ color: A.sub }}>{p.name}</span>
            <span className="font-medium" style={{ color: p.color }}>
              {typeof p.value === "number" && p.value > 10000 ? fmt(p.value) : p.value?.toLocaleString?.() ?? p.value}
            </span>
          </div>
        )
      ))}
    </div>
  );
};

// ─── Typewriter ───────────────────────────────────────────────────────────────
function TypewriterText({ text, speed = 14 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const idx = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    idx.current = 0;
    setDisplayed("");
    setDone(false);
    const tick = () => {
      if (idx.current < text.length) {
        idx.current++;
        setDisplayed(text.slice(0, idx.current));
        timer.current = setTimeout(tick, speed);
      } else {
        setDone(true);
      }
    };
    timer.current = setTimeout(tick, 80);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [text, speed]);

  return (
    <span>
      {displayed}
      {!done && <span className="inline-block w-0.5 h-3.5 rounded-full ml-px animate-pulse align-middle" style={{ background: A.blue }} />}
    </span>
  );
}

// ─── AI Panel ─────────────────────────────────────────────────────────────────
function AiPanel({ moduleId }: { moduleId: string }) {
  const insights = AI_INSIGHTS[moduleId] ?? [];
  const [activeIdx, setActiveIdx] = useState(0);
  const [scanning, setScanning] = useState(true);
  const [scanPct, setScanPct] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const startScan = useCallback(() => {
    setScanning(true);
    setScanPct(0);
    setActiveIdx(0);
    let p = 0;
    const step = () => {
      p += Math.random() * 22 + 10;
      if (p >= 100) { setScanPct(100); setScanning(false); }
      else { setScanPct(Math.round(p)); timer.current = setTimeout(step, 70); }
    };
    timer.current = setTimeout(step, 60);
  }, []);

  useEffect(() => {
    startScan();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [moduleId, refreshKey, startScan]);

  useEffect(() => {
    if (scanning) return;
    const id = setInterval(() => setActiveIdx((i) => (i + 1) % insights.length), 5500);
    return () => clearInterval(id);
  }, [scanning, insights.length]);

  const active = insights[activeIdx];
  const meta = active ? insightMeta[active.type] : null;
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  return (
    <div className="flex flex-col h-full bg-white" style={{ borderLeft: "0.5px solid rgba(0,0,0,0.1)" }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="relative w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #0071e3 0%, #34aadc 100%)" }}>
              <Sparkles size={13} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: A.label }}>AI 分析</div>
              <div className="text-[10px]" style={{ color: A.gray2 }}>供应链智能引擎</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px]" style={{ color: A.gray2 }}>{timeStr}</span>
            <button onClick={() => setRefreshKey((k) => k + 1)}
              className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100"
              style={{ color: A.gray1 }}>
              <RefreshCw size={11} className={scanning ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Scan bar */}
        <div className="rounded-lg p-2.5" style={{ background: A.gray6 }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium" style={{ color: scanning ? A.blue : A.green }}>
              {scanning ? "正在分析数据…" : "分析完成"}
            </span>
            <span className="text-[11px] font-medium" style={{ color: A.label }}>{scanPct}%</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: A.gray4 }}>
            <div className="h-full rounded-full transition-all duration-100"
              style={{ width: `${scanPct}%`, background: scanning ? A.blue : A.green }} />
          </div>
        </div>

        {/* Model tag */}
        <div className="flex items-center gap-2 mt-2.5">
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
            style={{ background: "#f0f6ff", color: A.blue }}>
            SupplyChain-LLM v2.4
          </span>
          <span className="text-[10px]" style={{ color: A.gray2 }}>置信度 94.2%</span>
        </div>
      </div>

      {/* Insights list */}
      <div className="flex-1 overflow-auto px-4 py-3 space-y-2">
        {scanning ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl p-3 space-y-2 animate-pulse" style={{ background: A.gray6 }}>
              <div className="h-2.5 rounded-full w-1/3" style={{ background: A.gray4 }} />
              <div className="h-3.5 rounded-full w-2/3" style={{ background: A.gray4 }} />
              <div className="h-2 rounded-full w-full" style={{ background: A.gray5 }} />
              <div className="h-2 rounded-full w-4/5" style={{ background: A.gray5 }} />
            </div>
          ))
        ) : (
          insights.map((ins, i) => {
            const m = insightMeta[ins.type];
            const Icon = m.icon;
            const isActive = i === activeIdx;
            return (
              <button key={i} onClick={() => setActiveIdx(i)} className="w-full text-left">
                <div className="rounded-xl p-3 transition-all duration-300"
                  style={{
                    background: isActive ? m.bg : A.gray6,
                    border: `1px solid ${isActive ? m.color + "30" : "transparent"}`,
                    opacity: isActive ? 1 : 0.7,
                  }}>
                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: `${m.color}20` }}>
                      <Icon size={10} style={{ color: m.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: m.color }}>
                          {m.label}
                        </span>
                        {ins.metric && isActive && (
                          <span className="text-[10px] font-medium px-1.5 py-px rounded-full"
                            style={{ background: `${m.color}18`, color: m.color }}>
                            {ins.metric}
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-semibold mb-1" style={{ color: A.label }}>{ins.title}</div>
                      {isActive && (
                        <div className="text-[11px] leading-relaxed" style={{ color: A.sub }}>
                          <TypewriterText text={ins.body} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer nav */}
      {!scanning && (
        <div className="px-4 pb-4 pt-2" style={{ borderTop: "0.5px solid rgba(0,0,0,0.06)" }}>
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {insights.map((_, i) => (
                <button key={i} onClick={() => setActiveIdx(i)}
                  className="rounded-full transition-all duration-300"
                  style={{ width: i === activeIdx ? 16 : 5, height: 5, background: i === activeIdx ? A.blue : A.gray4 }} />
              ))}
            </div>
            <span className="text-[10px]" style={{ color: A.gray2 }}>{activeIdx + 1} / {insights.length}</span>
          </div>
          <p className="text-[10px] mt-2" style={{ color: A.gray2 }}>
            基于 180 天历史数据 · 实时更新 · 仅供参考
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Sub-Tabs (ERP module navigation) ─────────────────────────────────────────
function SubTabs<T extends string>({ tabs, value, onChange }: {
  tabs: { id: T; label: string; count?: number | string; icon?: React.ElementType }[];
  value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}>
      {tabs.map((t) => {
        const Icon = t.icon;
        const isActive = value === t.id;
        return (
          <button key={t.id} onClick={() => onChange(t.id)}
            className="px-4 py-2.5 text-xs font-medium flex items-center gap-1.5 shrink-0 transition-colors relative"
            style={{
              color: isActive ? A.blue : A.gray1,
              background: "transparent",
            }}>
            {Icon && <Icon size={12} strokeWidth={isActive ? 2 : 1.8} />}
            {t.label}
            {t.count !== undefined && (
              <span className="text-[9px] px-1.5 py-px rounded-full font-semibold tabular-nums"
                style={{ background: isActive ? "#f0f6ff" : A.gray6, color: isActive ? A.blue : A.gray1 }}>
                {t.count}
              </span>
            )}
            {isActive && (
              <div className="absolute left-3 right-3 -bottom-px h-0.5 rounded-full" style={{ background: A.blue }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-sm font-semibold" style={{ color: A.label }}>{title}</h2>
      {right}
    </div>
  );
}

// ─── Panels ──────────────────────────────────────────────────────────────────
function OverviewPanel() {
  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="本月营收" value="¥8,760万" sub="5月 MTD" delta="+6.2%" positive icon={DollarSign} color={A.blue} />
        <KpiCard label="库存总值" value="¥2.34亿" sub="8,412 活跃 SKU" delta="-1.8%" positive={false} icon={Package} color={A.purple} />
        <KpiCard label="本月订单" value="612" sub="完成率 96.4%" delta="+11.7%" positive icon={ShoppingCart} color={A.green} />
        <KpiCard label="采购支出" value="¥3,412万" sub="预算 ¥3,600万" delta="+4.1%" positive={false} icon={Truck} color={A.orange} />
      </div>

      {/* Main chart + alerts */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="col-span-2 p-5">
          <SectionHeader title="全年营收趋势"
            right={<div className="flex items-center gap-4 text-xs" style={{ color: A.sub }}>
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-2.5 rounded-sm" style={{ background: A.blue }} /><span style={{ color: A.gray1 }}>营收 (左轴)</span></span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5 rounded" style={{ background: A.green }} /><span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: A.green, marginLeft: -2 }} /><span style={{ color: A.gray1 }}>毛利率 (右轴)</span></span>
            </div>}
          />
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={salesData} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="barRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"  stopColor={A.blue} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={A.blue} stopOpacity={0.55} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="0" stroke="rgba(0,0,0,0.05)" horizontal vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="l" tick={{ fontSize: 11, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `${v / 1e4}万`} width={52} domain={[0, "dataMax + 1000000"]} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: A.green, fontFamily: "Inter" }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `${v}%`} domain={[20, 42]} width={40} />
              <Tooltip content={<AppleTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)", radius: 6 }} />
              <Bar  yAxisId="l" dataKey="revenue" name="营收" fill="url(#barRev)" radius={[6, 6, 0, 0]} barSize={18} />
              <Line yAxisId="r" type="monotone" dataKey="margin" name="毛利率" stroke={A.green} strokeWidth={2}
                dot={{ r: 3.5, fill: A.white, strokeWidth: 2, stroke: A.green }}
                activeDot={{ r: 5, fill: A.green, stroke: A.white, strokeWidth: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="mt-2 flex items-center justify-between text-[10px]" style={{ color: A.gray1 }}>
            <span>柱状 = 月度营收 (单位: 万元)</span>
            <span>折线 = 综合毛利率 (%)</span>
          </div>
        </Card>

        <Card className="p-5 flex flex-col">
          <SectionHeader title="库存预警" />
          <div className="flex-1 space-y-0">
            {inventoryItems.filter((i) => i.status !== "正常").map((item, idx) => (
              <div key={item.sku} className="flex items-center gap-3 py-2.5"
                style={{ borderBottom: idx < inventoryItems.filter(i => i.status !== "正常").length - 1 ? "0.5px solid rgba(0,0,0,0.06)" : "none" }}>
                <div className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: item.status === "不足" ? A.red : A.orange }} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate" style={{ color: A.label }}>{item.name}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: A.gray2 }}>
                    {item.qty.toLocaleString()} / {item.min.toLocaleString()} · {item.location}
                  </div>
                </div>
                <StatusPill status={item.status} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Health metrics */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "供应链健康指数", value: 78,   suffix: "",  max: 100, color: A.blue,   note: "较上月 +3"      },
          { label: "订单履约率",     value: 96.4, suffix: "%", max: 100, color: A.green,  note: "目标 ≥ 95%"    },
          { label: "采购预算执行率", value: 94.8, suffix: "%", max: 100, color: A.orange, note: "12月 / 预算达成" },
        ].map((m) => (
          <Card key={m.label} className="p-5">
            <div className="flex items-end justify-between mb-3">
              <div>
                <div className="text-xs" style={{ color: A.sub }}>{m.label}</div>
                <div className="text-3xl font-semibold tracking-tight mt-0.5" style={{ color: A.label }}>
                  {m.value}<span className="text-lg" style={{ color: A.gray2 }}>{m.suffix}</span>
                </div>
              </div>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: A.gray5 }}>
              <div className="h-full rounded-full transition-all"
                style={{ width: `${(m.value / m.max) * 100}%`, background: m.color }} />
            </div>
            <div className="text-[11px] mt-2" style={{ color: A.gray2 }}>{m.note}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function InventoryOverview() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("全部");
  const filtered = inventoryItems.filter((i) => {
    const matchSearch = i.name.includes(search) || i.sku.includes(search);
    const matchStatus = filterStatus === "全部" || i.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="库存总 SKU" value="8,412" sub="活跃品种" icon={Package} color={A.blue} />
        <KpiCard label="库存不足" value="127" sub="低于安全线" delta="+8 vs 昨日" positive={false} icon={XCircle} color={A.red} />
        <KpiCard label="预警品种" value="89" sub="即将不足" delta="-3 vs 昨日" positive icon={AlertTriangle} color={A.orange} />
        <KpiCard label="库存周转率" value="4.8x" sub="年化均值" delta="+0.3x" positive icon={Activity} color={A.green} />
      </div>

      {/* Category health bars */}
      <Card className="p-5">
        <SectionHeader title="品类库存健康分布" />
        <div className="space-y-3">
          {[
            { cat: "机械部件", normal: 2980, warn: 180, low: 81 },
            { cat: "电气元件", normal: 289,  warn: 71,  low: 52 },
            { cat: "原材料",   normal: 1580, warn: 148, low: 92 },
            { cat: "耗材",     normal: 2100, warn: 32,  low: 8  },
            { cat: "标准件",   normal: 780,  warn: 16,  low: 3  },
          ].map((row) => {
            const total = row.normal + row.warn + row.low;
            return (
              <div key={row.cat} className="flex items-center gap-4">
                <span className="text-xs w-20 shrink-0" style={{ color: A.sub }}>{row.cat}</span>
                <div className="flex-1 h-5 rounded-lg overflow-hidden flex" style={{ background: A.gray5 }}>
                  <div style={{ width: `${(row.normal / total) * 100}%`, background: A.green }} />
                  <div style={{ width: `${(row.warn / total) * 100}%`, background: A.orange }} />
                  <div style={{ width: `${(row.low / total) * 100}%`, background: A.red }} />
                </div>
                <div className="flex items-center gap-3 text-[11px] w-52 shrink-0" style={{ color: A.gray1 }}>
                  <span className="text-green-500">{row.normal}</span>
                  <span style={{ color: A.orange }}>{row.warn}</span>
                  <span style={{ color: A.red }}>{row.low}</span>
                  <span style={{ color: A.gray2 }}>/ {total.toLocaleString()} SKU</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-5 mt-3 text-[11px]" style={{ color: A.gray2 }}>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: A.green }} />正常</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: A.orange }} />预警</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: A.red }} />不足</span>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <div className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}>
          <Search size={13} style={{ color: A.gray2 }} />
          <input
            className="flex-1 text-sm outline-none bg-transparent"
            placeholder="搜索 SKU 或品名…"
            style={{ color: A.label }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <SegmentedControl
            options={["全部", "正常", "预警", "不足"].map((s) => ({ label: s, value: s }))}
            value={filterStatus}
            onChange={setFilterStatus}
          />
          <span className="text-xs ml-1" style={{ color: A.gray2 }}>{filtered.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                {["SKU", "品名", "分类", "库存", "安全线", "库存率", "周转率", "库位", "末次入库", "状态"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => {
                const pct = Math.min((item.qty / item.max) * 100, 100);
                return (
                  <tr key={item.sku}
                    className="transition-colors hover:bg-blue-50/40"
                    style={{ borderBottom: i < filtered.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                    <td className="px-4 py-3 font-medium" style={{ color: A.blue }}>{item.sku}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: A.label }}>{item.name}</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{item.category}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: A.label }}>{item.qty.toLocaleString()}</td>
                    <td className="px-4 py-3" style={{ color: A.gray1 }}>{item.min.toLocaleString()}</td>
                    <td className="px-4 py-3 w-28">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: A.gray5 }}>
                          <div className="h-full rounded-full"
                            style={{ width: `${pct}%`, background: pct < 30 ? A.red : pct < 60 ? A.orange : A.green }} />
                        </div>
                        <span className="w-8 text-right text-[11px]" style={{ color: A.gray1 }}>{Math.round(pct)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ color: A.label }}>{item.turnover}x</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{item.location}</td>
                    <td className="px-4 py-3" style={{ color: A.gray1 }}>{item.lastIn}</td>
                    <td className="px-4 py-3"><StatusPill status={item.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Inventory · Lots & Serials ────────────────────────────────────────────────
const LOTS = [
  { lot: "LOT-260512-A01", sku: "SKU-00412", name: "伺服电机 750W",      qty: 24,    received: "5月12日", expiry: "—",         supplier: "深圳新元电气",   warehouse: "D-02-01", status: "可用",     coa: true  },
  { lot: "LOT-260514-B14", sku: "SKU-00287", name: "铝合金型材 6063",    qty: 148,   received: "5月14日", expiry: "—",         supplier: "江苏铝合金集团", warehouse: "B-01-05", status: "可用",     coa: true  },
  { lot: "LOT-260519-C08", sku: "SKU-00744", name: "聚氨酯密封胶",       qty: 320,   received: "5月19日", expiry: "27年5月",  supplier: "广州化工耗材",   warehouse: "C-02-11", status: "可用",     coa: true  },
  { lot: "LOT-260520-C09", sku: "SKU-00744", name: "聚氨酯密封胶",       qty: 600,   received: "5月20日", expiry: "27年5月",  supplier: "广州化工耗材",   warehouse: "C-02-12", status: "可用",     coa: false },
  { lot: "LOT-260521-D03", sku: "SKU-00934", name: "步进电机驱动板",     qty: 89,    received: "5月21日", expiry: "—",         supplier: "深圳新元电气",   warehouse: "D-03-07", status: "冻结",     coa: true  },
  { lot: "LOT-260506-B12", sku: "SKU-00391", name: "密封圈 NBR-70",       qty: 4200,  received: "5月06日", expiry: "26年8月",  supplier: "佛山标准件",     warehouse: "C-05-08", status: "近效期",   coa: true  },
  { lot: "LOT-260503-A22", sku: "SKU-00558", name: "不锈钢螺栓 M8×30",   qty: 85000, received: "5月03日", expiry: "—",         supplier: "佛山标准件",     warehouse: "A-07-22", status: "可用",     coa: true  },
  { lot: "LOT-260427-B06", sku: "SKU-00815", name: "液压油缸 50mm",      qty: 67,    received: "4月27日", expiry: "—",         supplier: "华东精工机械",   warehouse: "B-04-06", status: "可用",     coa: true  },
];

const SERIALS = [
  { sn: "SN-SVM-0001824",  sku: "SKU-00412", lot: "LOT-260512-A01", status: "在库",   warehouse: "D-02-01", received: "5月12日", expiry: "—" },
  { sn: "SN-SVM-0001825",  sku: "SKU-00412", lot: "LOT-260512-A01", status: "在库",   warehouse: "D-02-01", received: "5月12日", expiry: "—" },
  { sn: "SN-SVM-0001826",  sku: "SKU-00412", lot: "LOT-260512-A01", status: "已分配", warehouse: "—",       received: "5月12日", expiry: "—" },
  { sn: "SN-CTL-0000934",  sku: "SKU-00623", lot: "LOT-260413-D01", status: "在库",   warehouse: "D-01-03", received: "4月13日", expiry: "—" },
  { sn: "SN-CTL-0000935",  sku: "SKU-00623", lot: "LOT-260413-D01", status: "维修",   warehouse: "—",       received: "4月13日", expiry: "—" },
  { sn: "SN-DRV-0002148",  sku: "SKU-00934", lot: "LOT-260521-D03", status: "冻结",   warehouse: "D-03-07", received: "5月21日", expiry: "—" },
];

function InventoryLots() {
  const [tab, setTab] = useState<"lot" | "sn">("lot");
  const [filter, setFilter] = useState<"全部" | "可用" | "冻结" | "近效期" | "已分配">("全部");
  const lots = filter === "全部" ? LOTS : LOTS.filter((l) => l.status === filter);
  const serials = filter === "全部" || filter === "近效期" ? SERIALS : SERIALS.filter((s) => s.status === filter);

  function pillColor(s: string) {
    return s === "可用" || s === "在库" ? A.green
      : s === "近效期" || s === "维修" ? A.orange
      : s === "冻结" ? A.red
      : A.blue;
  }
  function pillBg(s: string) {
    return s === "可用" || s === "在库" ? "#f0faf4"
      : s === "近效期" || s === "维修" ? "#fff8f0"
      : s === "冻结" ? "#fff1f0"
      : "#f0f6ff";
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="活跃批次"   value={String(LOTS.length)}  sub="跨 5 个库区"                icon={Layers}      color={A.blue}   />
        <KpiCard label="序列号库存" value={SERIALS.length + " 件"} sub="高值件全程追溯"             icon={Hash}        color={A.purple} />
        <KpiCard label="近效期批次" value="1"                    sub="≤ 90 天到期" delta="预警"     positive={false} icon={Clock}       color={A.orange} />
        <KpiCard label="冻结批次"   value="1"                    sub="质量复检中"                  icon={ShieldCheck} color={A.red}    />
      </div>

      <Card>
        <div className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}>
          <SegmentedControl
            options={[{ label: "批次 (Lot)", value: "lot" }, { label: "序列号 (S/N)", value: "sn" }]}
            value={tab} onChange={(v) => setTab(v as any)} />
          <SegmentedControl
            options={["全部", "可用", "冻结", "近效期"].map((s) => ({ label: s, value: s }))}
            value={filter} onChange={(v) => setFilter(v as any)} />
          <span className="text-xs ml-auto" style={{ color: A.gray2 }}>{tab === "lot" ? lots.length : serials.length} 条</span>
          <button onClick={() => toast.success("已导出 FIFO 拣货清单")}
            className="text-[11px] px-2.5 py-1 rounded-md font-medium" style={{ background: A.gray6, color: A.label }}>导出 FIFO</button>
          <button onClick={() => toast("批次冻结提交 QA")}
            className="text-[11px] px-2.5 py-1 rounded-md font-medium text-white" style={{ background: A.blue }}>冻结批次</button>
        </div>
        <div className="overflow-x-auto">
          {tab === "lot" ? (
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                  {["批次号", "SKU", "品名", "数量", "供应商", "入库日", "效期", "库位", "COA", "状态", "操作"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lots.map((l, i) => (
                  <tr key={l.lot} className="hover:bg-blue-50/40 transition-colors"
                    style={{ borderBottom: i < lots.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                    <td className="px-4 py-3 font-medium tabular-nums" style={{ color: A.indigo }}>{l.lot}</td>
                    <td className="px-4 py-3" style={{ color: A.blue }}>{l.sku}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: A.label }}>{l.name}</td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: A.label }}>{l.qty.toLocaleString()}</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{l.supplier}</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{l.received}</td>
                    <td className="px-4 py-3" style={{ color: l.expiry !== "—" ? A.orange : A.gray3 }}>{l.expiry}</td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: A.label }}>{l.warehouse}</td>
                    <td className="px-4 py-3">
                      {l.coa ? <CheckCircle2 size={12} style={{ color: A.green }} /> : <X size={12} style={{ color: A.red }} />}
                    </td>
                    <td className="px-4 py-3"><Chip label={l.status} color={pillColor(l.status)} bg={pillBg(l.status)} /></td>
                    <td className="px-4 py-3">
                      <button onClick={() => toast(`批次 ${l.lot}`, { description: "追溯链：供应商→GRN→质检→入库→消耗" })}
                        className="text-[11px] px-2 py-1 rounded-md font-medium" style={{ background: A.gray6, color: A.label }}>追溯</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                  {["S/N", "SKU", "所属批次", "状态", "当前库位", "入库日", "操作"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {serials.map((s, i) => (
                  <tr key={s.sn} className="hover:bg-blue-50/40 transition-colors"
                    style={{ borderBottom: i < serials.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                    <td className="px-4 py-3 font-medium tabular-nums" style={{ color: A.purple }}>{s.sn}</td>
                    <td className="px-4 py-3" style={{ color: A.blue }}>{s.sku}</td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: A.indigo }}>{s.lot}</td>
                    <td className="px-4 py-3"><Chip label={s.status} color={pillColor(s.status)} bg={pillBg(s.status)} /></td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: A.label }}>{s.warehouse}</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{s.received}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => toast(`${s.sn} 全生命周期`, { description: "采购→入库→分配→出库→保修" })}
                        className="text-[11px] px-2 py-1 rounded-md font-medium" style={{ background: A.gray6, color: A.label }}>查看历史</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <SectionHeader title="近效期预警 (FEFO 策略)" />
        <div className="space-y-2">
          {LOTS.filter((l) => l.expiry !== "—").map((l) => {
            const isWarn = l.status === "近效期";
            return (
              <div key={l.lot} className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: isWarn ? "#fff8f0" : A.gray6 }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: isWarn ? `${A.orange}18` : `${A.green}18` }}>
                  <Clock size={13} style={{ color: isWarn ? A.orange : A.green }} />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-medium" style={{ color: A.label }}>{l.name} · {l.lot}</div>
                  <div className="text-[11px]" style={{ color: A.sub }}>剩余 {l.qty} · 效期 {l.expiry} · {l.warehouse}</div>
                </div>
                <button onClick={() => toast.success(`已生成 ${l.lot} 优先出库建议`)}
                  className="text-[11px] px-3 py-1.5 rounded-md font-medium" style={{ background: A.white, color: A.label, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)" }}>
                  生成出库建议
                </button>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ─── Inventory · Stock Transfer ────────────────────────────────────────────
const TRANSFERS = [
  { id: "TR-260527-001", from: "上海总仓", to: "苏州分仓",  sku: "SKU-00412", name: "伺服电机 750W",    qty: 12,  status: "在途",     created: "5月26日", eta: "5月28日", requester: "李婷",   carrier: "顺丰特运" },
  { id: "TR-260526-014", from: "上海总仓", to: "深圳分仓",  sku: "SKU-00623", name: "控制器主板 V3.2",  qty: 6,   status: "已发出",   created: "5月26日", eta: "5月29日", requester: "陈思远", carrier: "京东物流" },
  { id: "TR-260525-008", from: "苏州分仓", to: "上海总仓",  sku: "SKU-00744", name: "聚氨酯密封胶",     qty: 80,  status: "已签收",   created: "5月25日", eta: "5月27日", requester: "王志强", carrier: "德邦快运" },
  { id: "TR-260527-002", from: "深圳分仓", to: "上海总仓",  sku: "SKU-00934", name: "步进电机驱动板",   qty: 40,  status: "待审批",   created: "5月27日", eta: "5月30日", requester: "周浩",   carrier: "—" },
  { id: "TR-260524-019", from: "上海总仓", to: "天津分仓",  sku: "SKU-00558", name: "不锈钢螺栓 M8×30", qty: 12000, status: "已签收", created: "5月24日", eta: "5月26日", requester: "李婷",   carrier: "顺丰特运" },
];

function InventoryTransfers() {
  const [list, setList] = useState(TRANSFERS);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ from: "上海总仓", to: "苏州分仓", sku: SKU_CATALOG[0].sku, qty: 10 });

  function statusColor(s: string) {
    return s === "已签收" ? A.green : s === "在途" || s === "已发出" ? A.blue : s === "待审批" ? A.orange : A.gray1;
  }

  function approve(id: string) {
    setList((arr) => arr.map((t) => t.id === id ? { ...t, status: "已发出" } : t));
    toast.success(`${id} 已批准并下发 WMS`);
  }
  function receive(id: string) {
    setList((arr) => arr.map((t) => t.id === id ? { ...t, status: "已签收" } : t));
    toast.success(`${id} 已签收`, { description: "调入库存已更新" });
  }
  function createTransfer() {
    const item = SKU_CATALOG.find((s) => s.sku === form.sku)!;
    const id = `TR-260527-${String(Math.floor(Math.random() * 99)).padStart(3, "0")}`;
    setList((arr) => [{
      id, from: form.from, to: form.to, sku: form.sku, name: item.name,
      qty: form.qty, status: "待审批", created: "5月27日", eta: "5月30日",
      requester: "张磊", carrier: "—",
    }, ...arr]);
    setCreateOpen(false);
    toast.success(`${id} 调拨单已创建`, { description: `${form.from} → ${form.to} · ${form.qty} ${item.unit}` });
  }

  const onTransit = list.filter((t) => t.status === "在途" || t.status === "已发出").length;
  const pending = list.filter((t) => t.status === "待审批").length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="本月调拨" value={String(list.length)} sub="跨 4 个仓"     icon={ArrowLeftRight} color={A.blue}   />
        <KpiCard label="在途数量" value={String(onTransit)}   sub="平均时长 1.8 天"  icon={Truck}          color={A.teal}   />
        <KpiCard label="待审批"   value={String(pending)}      sub="平均 2.4 小时" delta={pending > 0 ? "需处理" : "无"} positive={pending === 0} icon={AlertCircle} color={A.orange} />
        <KpiCard label="调拨准时率" value="96.8%"               sub="同比 +2.1pts"   delta="+2.1pts" positive icon={Activity}     color={A.green}  />
      </div>

      <Card>
        <div className="flex items-center px-5 py-3.5 gap-3" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>仓间调拨单</h2>
          <span className="text-xs" style={{ color: A.gray2 }}>{list.length} 条</span>
          <button onClick={() => setCreateOpen(true)}
            className="ml-auto flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md font-medium text-white hover:opacity-90 transition-opacity"
            style={{ background: A.blue }}>
            <Plus size={11} /> 新建调拨单
          </button>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["调拨号", "源仓 → 目标仓", "SKU / 品名", "数量", "申请人", "承运商", "创建", "ETA", "状态", "操作"].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((t, i) => (
              <tr key={t.id} className="hover:bg-blue-50/40 transition-colors"
                style={{ borderBottom: i < list.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-4 py-3 font-medium tabular-nums" style={{ color: A.indigo }}>{t.id}</td>
                <td className="px-4 py-3" style={{ color: A.label }}>
                  {t.from} <ArrowRight size={10} className="inline mx-1" style={{ color: A.gray2 }} /> <span style={{ color: A.blue }}>{t.to}</span>
                </td>
                <td className="px-4 py-3" style={{ color: A.label }}>
                  <span style={{ color: A.blue }}>{t.sku}</span> · {t.name}
                </td>
                <td className="px-4 py-3 tabular-nums font-medium" style={{ color: A.label }}>{t.qty.toLocaleString()}</td>
                <td className="px-4 py-3" style={{ color: A.sub }}>{t.requester}</td>
                <td className="px-4 py-3" style={{ color: A.sub }}>{t.carrier}</td>
                <td className="px-4 py-3" style={{ color: A.gray1 }}>{t.created}</td>
                <td className="px-4 py-3" style={{ color: A.gray1 }}>{t.eta}</td>
                <td className="px-4 py-3"><Chip label={t.status} color={statusColor(t.status)} bg={`${statusColor(t.status)}18`} /></td>
                <td className="px-4 py-3">
                  {t.status === "待审批" && (
                    <button onClick={() => approve(t.id)} className="text-[11px] px-2 py-1 rounded-md font-medium text-white" style={{ background: A.blue }}>批准</button>
                  )}
                  {(t.status === "在途" || t.status === "已发出") && (
                    <button onClick={() => receive(t.id)} className="text-[11px] px-2 py-1 rounded-md font-medium text-white" style={{ background: A.green }}>签收</button>
                  )}
                  {t.status === "已签收" && (
                    <span className="text-[11px]" style={{ color: A.gray2 }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="新建调拨单" subtitle="跨仓库存调配"
        footer={<>
          <button onClick={() => setCreateOpen(false)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: A.white, color: A.label, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.1)" }}>取消</button>
          <button onClick={createTransfer} className="text-xs px-3 py-1.5 rounded-lg font-medium text-white" style={{ background: A.blue }}>提交审批</button>
        </>}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="源仓库">
            <select value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} style={inputStyle}>
              {["上海总仓", "苏州分仓", "深圳分仓", "天津分仓"].map((w) => <option key={w}>{w}</option>)}
            </select>
          </Field>
          <Field label="目标仓库">
            <select value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} style={inputStyle}>
              {["上海总仓", "苏州分仓", "深圳分仓", "天津分仓"].map((w) => <option key={w}>{w}</option>)}
            </select>
          </Field>
          <Field label="物料 SKU">
            <select value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} style={inputStyle}>
              {SKU_CATALOG.map((s) => <option key={s.sku} value={s.sku}>{s.sku} · {s.name}</option>)}
            </select>
          </Field>
          <Field label="调拨数量">
            <input type="number" min={1} value={form.qty}
              onChange={(e) => setForm({ ...form, qty: parseInt(e.target.value) || 0 })} style={inputStyle} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

// ─── Inventory · Cycle Count ────────────────────────────────────────────────
const COUNT_PLANS = [
  { id: "CC-2026-W21-A1", zone: "A 区高位", scheduled: "5月27日", counter: "刘建华", scope: 142, counted: 142, variance: 3,  status: "完成", method: "扫码盘点" },
  { id: "CC-2026-W21-A2", zone: "A 区平面", scheduled: "5月27日", counter: "孙明",   scope: 88,  counted: 88,  variance: 0,  status: "完成", method: "扫码盘点" },
  { id: "CC-2026-W21-B1", zone: "B 区原料", scheduled: "5月28日", counter: "刘建华", scope: 64,  counted: 32,  variance: 1,  status: "进行中", method: "人工" },
  { id: "CC-2026-W22-C1", zone: "C 区耗材", scheduled: "5月29日", counter: "—",     scope: 210, counted: 0,   variance: 0,  status: "待执行", method: "RFID 扫描" },
  { id: "CC-2026-W22-D1", zone: "D 区电气", scheduled: "5月30日", counter: "—",     scope: 124, counted: 0,   variance: 0,  status: "待执行", method: "扫码盘点" },
];

const VARIANCES = [
  { lot: "LOT-260512-A01", sku: "SKU-00412", name: "伺服电机 750W",    book: 24,   actual: 22,   diff: -2,  reason: "拣货漏记",       value: 5960 },
  { lot: "LOT-260506-B12", sku: "SKU-00391", name: "密封圈 NBR-70",     book: 4200, actual: 4203, diff: +3,  reason: "上次盘亏冲回",   value: 12   },
  { lot: "LOT-260503-A22", sku: "SKU-00558", name: "不锈钢螺栓 M8×30", book: 85000, actual: 84994, diff: -6, reason: "破损未登记",     value: 11   },
];

function InventoryCycleCount() {
  const [plans, setPlans] = useState(COUNT_PLANS);
  const completed = plans.filter((p) => p.status === "完成").length;
  const inProgress = plans.filter((p) => p.status === "进行中").length;
  const accuracy = ((plans.reduce((s, p) => s + (p.scope - Math.abs(p.variance)), 0) /
                    plans.reduce((s, p) => s + p.scope, 0)) * 100).toFixed(1);

  function start(id: string) {
    setPlans((arr) => arr.map((p) => p.id === id ? { ...p, status: "进行中", counter: "刘建华" } : p));
    toast.success(`${id} 已下发至手持终端`);
  }
  function complete(id: string) {
    setPlans((arr) => arr.map((p) => p.id === id ? { ...p, status: "完成", counted: p.scope } : p));
    toast.success(`${id} 盘点完成`);
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="本周计划"   value={String(plans.length)} sub="ABC 循环盘点"             icon={ClipboardCheck} color={A.blue}   />
        <KpiCard label="完成"        value={String(completed)}     sub={`完成率 ${(completed / plans.length * 100).toFixed(0)}%`} icon={CheckCircle2}   color={A.green}  />
        <KpiCard label="进行中"      value={String(inProgress)}    sub="手持终端实时同步"          icon={Loader2}        color={A.orange} />
        <KpiCard label="盘点准确率"  value={`${accuracy}%`}        sub="行业基准 99.5%"           delta={parseFloat(accuracy) >= 99.5 ? "达标" : "未达"} positive={parseFloat(accuracy) >= 99.5} icon={Activity} color={A.purple} />
      </div>

      <Card>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>循环盘点计划 (Cycle Count)</h2>
          <button onClick={() => toast("已按 ABC 重新生成下周计划")}
            className="text-[11px] px-2.5 py-1 rounded-md font-medium text-white" style={{ background: A.blue }}>
            生成下周计划
          </button>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["计划号", "库区", "排期", "盘点员", "方法", "进度", "差异", "状态", "操作"].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plans.map((p, i) => {
              const pct = (p.counted / p.scope) * 100;
              return (
                <tr key={p.id} className="hover:bg-blue-50/40 transition-colors"
                  style={{ borderBottom: i < plans.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                  <td className="px-4 py-3 font-medium tabular-nums" style={{ color: A.indigo }}>{p.id}</td>
                  <td className="px-4 py-3" style={{ color: A.label }}>{p.zone}</td>
                  <td className="px-4 py-3" style={{ color: A.sub }}>{p.scheduled}</td>
                  <td className="px-4 py-3" style={{ color: A.label }}>{p.counter}</td>
                  <td className="px-4 py-3"><Chip label={p.method} color={A.purple} bg="#f8f0ff" /></td>
                  <td className="px-4 py-3 w-32">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: A.gray5 }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct === 100 ? A.green : pct > 0 ? A.blue : A.gray3 }} />
                      </div>
                      <span className="text-[10px] tabular-nums w-12 text-right" style={{ color: A.gray1 }}>{p.counted}/{p.scope}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium tabular-nums" style={{ color: p.variance === 0 ? A.green : p.variance > 0 ? A.blue : A.red }}>
                    {p.variance === 0 ? "—" : (p.variance > 0 ? "+" : "") + p.variance}
                  </td>
                  <td className="px-4 py-3"><Chip label={p.status}
                    color={p.status === "完成" ? A.green : p.status === "进行中" ? A.orange : A.gray1}
                    bg={p.status === "完成" ? "#f0faf4" : p.status === "进行中" ? "#fff8f0" : A.gray6} /></td>
                  <td className="px-4 py-3">
                    {p.status === "待执行" && (
                      <button onClick={() => start(p.id)} className="text-[11px] px-2 py-1 rounded-md font-medium text-white" style={{ background: A.blue }}>开始</button>
                    )}
                    {p.status === "进行中" && (
                      <button onClick={() => complete(p.id)} className="text-[11px] px-2 py-1 rounded-md font-medium text-white" style={{ background: A.green }}>完结</button>
                    )}
                    {p.status === "完成" && (
                      <button onClick={() => toast(`${p.id} 报告已生成`)} className="text-[11px] px-2 py-1 rounded-md font-medium" style={{ background: A.gray6, color: A.label }}>报告</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>盘点差异待审批</h2>
          <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: "#fff8f0", color: A.orange }}>
            {VARIANCES.length} 项 · 合计 ¥{VARIANCES.reduce((s, v) => s + Math.abs(v.value), 0).toLocaleString()}
          </span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["批次", "SKU", "品名", "账面数", "实盘数", "差异", "差异原因", "差异金额", "操作"].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {VARIANCES.map((v, i) => (
              <tr key={v.lot} className="hover:bg-blue-50/40 transition-colors"
                style={{ borderBottom: i < VARIANCES.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-4 py-3 tabular-nums" style={{ color: A.indigo }}>{v.lot}</td>
                <td className="px-4 py-3" style={{ color: A.blue }}>{v.sku}</td>
                <td className="px-4 py-3 font-medium" style={{ color: A.label }}>{v.name}</td>
                <td className="px-4 py-3 tabular-nums" style={{ color: A.label }}>{v.book.toLocaleString()}</td>
                <td className="px-4 py-3 tabular-nums" style={{ color: A.label }}>{v.actual.toLocaleString()}</td>
                <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: v.diff < 0 ? A.red : A.blue }}>{v.diff > 0 ? "+" : ""}{v.diff}</td>
                <td className="px-4 py-3" style={{ color: A.sub }}>{v.reason}</td>
                <td className="px-4 py-3 tabular-nums" style={{ color: A.red }}>¥{v.value.toLocaleString()}</td>
                <td className="px-4 py-3 flex gap-1">
                  <button onClick={() => toast.success(`${v.lot} 差异已审批入账`)}
                    className="text-[11px] px-2 py-1 rounded-md font-medium text-white" style={{ background: A.blue }}>批准</button>
                  <button onClick={() => toast(`${v.lot} 已发起复盘`)}
                    className="text-[11px] px-2 py-1 rounded-md font-medium" style={{ background: A.gray6, color: A.label }}>复盘</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Inventory · ABC/XYZ Matrix ────────────────────────────────────────────
function InventoryABCXYZ() {
  // ABC by annual value contribution; XYZ by demand variability
  const items = inventoryItems.map((it, i) => {
    const annualValue = it.qty * (50 + (i * 73) % 800);    // synthetic
    const cov = 0.1 + ((i * 0.37) % 0.7);                  // synthetic CoV
    const abc = i < 2 ? "A" : i < 6 ? "B" : "C";
    const xyz = cov < 0.25 ? "X" : cov < 0.5 ? "Y" : "Z";
    return { ...it, annualValue, cov, abc, xyz };
  });

  const matrix: Record<string, typeof items> = {};
  for (const a of ["A", "B", "C"]) for (const x of ["X", "Y", "Z"]) matrix[a + x] = [];
  for (const it of items) matrix[it.abc + it.xyz].push(it);

  const strategy: Record<string, { policy: string; color: string }> = {
    AX: { policy: "自动补货 · 高服务水平 99%",   color: A.green   },
    AY: { policy: "周预测 · 服务 97%",            color: A.green   },
    AZ: { policy: "JIT · 紧密协同",                color: A.orange  },
    BX: { policy: "月预测 · 服务 95%",            color: A.blue    },
    BY: { policy: "月预测 · 服务 90%",            color: A.blue    },
    BZ: { policy: "按订单生产",                   color: A.orange  },
    CX: { policy: "经济批量 · 季度补",            color: A.gray1   },
    CY: { policy: "按需采购",                     color: A.gray1   },
    CZ: { policy: "按订单采购 · 不备库",          color: A.red     },
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="A 类 SKU"  value={String(items.filter((i) => i.abc === "A").length)} sub="贡献 80% 价值" icon={Boxes} color={A.green}  />
        <KpiCard label="B 类 SKU"  value={String(items.filter((i) => i.abc === "B").length)} sub="贡献 15% 价值" icon={Boxes} color={A.blue}   />
        <KpiCard label="C 类 SKU"  value={String(items.filter((i) => i.abc === "C").length)} sub="贡献 5% 价值"  icon={Boxes} color={A.gray1}  />
        <KpiCard label="Z 类不规则" value={String(items.filter((i) => i.xyz === "Z").length)} sub="CoV ≥ 0.5"    icon={AlertTriangle} color={A.red} />
      </div>

      <Card className="p-5">
        <SectionHeader title="ABC × XYZ 策略矩阵" right={
          <div className="flex gap-2 text-[10px]" style={{ color: A.sub }}>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: A.green }} />自动补货</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: A.blue }} />周期补</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: A.orange }} />按订单</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: A.red }} />不备库</span>
          </div>
        } />

        <div className="grid grid-cols-[80px_1fr_1fr_1fr] gap-1.5">
          <div></div>
          {["X (稳定)", "Y (波动)", "Z (不规则)"].map((h) => (
            <div key={h} className="text-[11px] font-semibold text-center pb-2" style={{ color: A.label }}>{h}</div>
          ))}
          {(["A", "B", "C"] as const).map((row) => (
            <>
              <div key={`label-${row}`} className="text-[11px] font-semibold flex items-center justify-end pr-2" style={{ color: A.label }}>
                {row} {row === "A" ? "(高值)" : row === "B" ? "(中值)" : "(低值)"}
              </div>
              {(["X", "Y", "Z"] as const).map((col) => {
                const cell = matrix[row + col];
                const s = strategy[row + col];
                return (
                  <div key={`${row}${col}`} className="rounded-xl p-3 min-h-24"
                    style={{ background: `${s.color}10`, border: `1px solid ${s.color}30` }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-base font-semibold" style={{ color: s.color }}>{row}{col}</span>
                      <span className="text-[10px] px-1.5 py-px rounded-full font-medium" style={{ background: A.white, color: s.color }}>
                        {cell.length} SKU
                      </span>
                    </div>
                    <div className="text-[10px] mb-2" style={{ color: A.sub }}>{s.policy}</div>
                    {cell.slice(0, 2).map((it) => (
                      <div key={it.sku} className="text-[10px] truncate" style={{ color: A.label }}>· {it.name}</div>
                    ))}
                    {cell.length > 2 && <div className="text-[10px]" style={{ color: A.gray2 }}>+{cell.length - 2} 更多</div>}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </Card>

      <Card>
        <div className="px-5 py-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>SKU 分类明细</h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["SKU", "品名", "年价值", "CoV", "ABC", "XYZ", "策略"].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.sort((a, b) => b.annualValue - a.annualValue).map((it, i) => {
              const s = strategy[it.abc + it.xyz];
              return (
                <tr key={it.sku} style={{ borderBottom: i < items.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                  <td className="px-4 py-3" style={{ color: A.blue }}>{it.sku}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: A.label }}>{it.name}</td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: A.label }}>¥{(it.annualValue / 1000).toFixed(0)}k</td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: A.sub }}>{it.cov.toFixed(2)}</td>
                  <td className="px-4 py-3"><Chip label={it.abc} color={it.abc === "A" ? A.green : it.abc === "B" ? A.blue : A.gray1} bg={it.abc === "A" ? "#f0faf4" : it.abc === "B" ? "#f0f6ff" : A.gray6} /></td>
                  <td className="px-4 py-3"><Chip label={it.xyz} color={it.xyz === "X" ? A.green : it.xyz === "Y" ? A.orange : A.red} bg={it.xyz === "X" ? "#f0faf4" : it.xyz === "Y" ? "#fff8f0" : "#fff1f0"} /></td>
                  <td className="px-4 py-3" style={{ color: s.color }}>{s.policy}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Inventory · Stock Movement History ────────────────────────────────────
const MOVEMENTS = [
  { ts: "5月27日 14:32", type: "出库", sku: "SKU-00412", qty: -2,  ref: "SO-26-08321", from: "D-02-01", to: "—",       op: "李婷",   reason: "销售出库" },
  { ts: "5月27日 11:18", type: "入库", sku: "SKU-00744", qty: +600, ref: "GRN-260514-A03", from: "—",     to: "C-02-12", op: "刘建华", reason: "采购入库" },
  { ts: "5月27日 09:45", type: "调拨", sku: "SKU-00623", qty: -6,  ref: "TR-260526-014", from: "D-01-03", to: "深圳分仓", op: "陈思远", reason: "调拨出库" },
  { ts: "5月27日 09:12", type: "调整", sku: "SKU-00558", qty: -6,  ref: "ADJ-260527-001", from: "A-07-22", to: "—",       op: "刘建华", reason: "盘点差异" },
  { ts: "5月26日 16:48", type: "出库", sku: "SKU-00934", qty: -3,  ref: "SO-26-08319", from: "D-03-07", to: "—",       op: "周浩",   reason: "工程领用" },
  { ts: "5月26日 14:22", type: "退货", sku: "SKU-00391", qty: +24, ref: "RMA-26-0042",  from: "客户退回",  to: "C-05-08", op: "孙明",   reason: "客户退货" },
  { ts: "5月26日 10:30", type: "入库", sku: "SKU-00287", qty: +148, ref: "GRN-260514-B14", from: "—",     to: "B-01-05", op: "刘建华", reason: "采购入库" },
  { ts: "5月25日 15:50", type: "冻结", sku: "SKU-00934", qty: 0,    ref: "QA-26-0117",  from: "D-03-07", to: "D-03-07",  op: "QA",     reason: "质量复检" },
];

function InventoryMovements() {
  const [typeFilter, setTypeFilter] = useState<"全部" | "入库" | "出库" | "调拨" | "调整" | "退货" | "冻结">("全部");
  const list = typeFilter === "全部" ? MOVEMENTS : MOVEMENTS.filter((m) => m.type === typeFilter);

  const typeColor = (t: string) => ({
    入库: A.green, 出库: A.blue, 调拨: A.purple, 调整: A.orange, 退货: A.teal, 冻结: A.red,
  } as Record<string, string>)[t];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        {[
          { l: "今日入库",  v: "748",     d: "+12% vs 昨", c: A.green  },
          { l: "今日出库",  v: "424",     d: "+8% vs 昨",  c: A.blue   },
          { l: "今日调拨",  v: "46",      d: "3 笔",       c: A.purple },
          { l: "异常调整",  v: "1",       d: "盘亏 ¥11",   c: A.orange },
        ].map((m) => (
          <Card key={m.l} className="p-5">
            <div className="text-xs" style={{ color: A.sub }}>{m.l}</div>
            <div className="text-2xl font-semibold tracking-tight mt-1" style={{ color: m.c }}>{m.v}</div>
            <div className="text-[11px] mt-1" style={{ color: A.gray2 }}>{m.d}</div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex items-center px-5 py-3.5 gap-3" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>库存事务流水 (Stock Ledger)</h2>
          <SegmentedControl
            options={["全部", "入库", "出库", "调拨", "调整", "退货", "冻结"].map((s) => ({ label: s, value: s }))}
            value={typeFilter} onChange={(v) => setTypeFilter(v as any)} />
          <button onClick={() => toast.success("已导出 Excel 全量流水")}
            className="ml-auto text-[11px] px-2.5 py-1 rounded-md font-medium" style={{ background: A.gray6, color: A.label }}>
            <FileSpreadsheet size={11} className="inline mr-1" /> 导出
          </button>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["时间", "类型", "SKU", "数量", "来源 → 去向", "凭证号", "操作员", "事由"].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((m, i) => (
              <tr key={i} className="hover:bg-blue-50/40 transition-colors"
                style={{ borderBottom: i < list.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-4 py-3 tabular-nums" style={{ color: A.sub }}>{m.ts}</td>
                <td className="px-4 py-3"><Chip label={m.type} color={typeColor(m.type)} bg={`${typeColor(m.type)}18`} /></td>
                <td className="px-4 py-3" style={{ color: A.blue }}>{m.sku}</td>
                <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: m.qty > 0 ? A.green : m.qty < 0 ? A.red : A.gray2 }}>
                  {m.qty > 0 ? "+" : ""}{m.qty || "—"}
                </td>
                <td className="px-4 py-3" style={{ color: A.label }}>
                  <span style={{ color: A.sub }}>{m.from}</span>
                  {" "}<ArrowRight size={9} className="inline" style={{ color: A.gray3 }} />{" "}
                  <span>{m.to}</span>
                </td>
                <td className="px-4 py-3 tabular-nums" style={{ color: A.indigo }}>{m.ref}</td>
                <td className="px-4 py-3" style={{ color: A.label }}>{m.op}</td>
                <td className="px-4 py-3" style={{ color: A.sub }}>{m.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Inventory · Warehouse Map (bin heatmap) ──────────────────────────────
function InventoryWarehouseMap() {
  // Synthetic 6×8 bin grid with fill %
  const grid: { code: string; fill: number; status: string }[][] = Array.from({ length: 6 }, (_, r) =>
    Array.from({ length: 10 }, (_, c) => {
      const fill = Math.min(100, Math.max(0, Math.round(40 + 50 * Math.sin(r + c * 0.7) + (r * c * 3) % 30)));
      const status = fill > 90 ? "满" : fill > 60 ? "高" : fill > 30 ? "中" : fill > 0 ? "低" : "空";
      return { code: `${String.fromCharCode(65 + r)}-${String(c + 1).padStart(2, "0")}`, fill, status };
    })
  );
  const totalBins = grid.flat().length;
  const usedBins = grid.flat().filter((g) => g.fill > 0).length;
  const overflow = grid.flat().filter((g) => g.fill > 90).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="总库位"   value={String(totalBins)}                       sub="A–F 区 · 10 排"            icon={Grid3x3} color={A.blue}   />
        <KpiCard label="利用率"   value={`${((usedBins / totalBins) * 100).toFixed(0)}%`} sub={`${usedBins} 个在用`}     icon={Boxes}   color={A.green}  />
        <KpiCard label="高密度区" value={String(overflow)}                         sub="≥ 90% 容量"   delta="需扩容" positive={false} icon={AlertTriangle} color={A.red} />
        <KpiCard label="空闲库位" value={String(totalBins - usedBins)}             sub="可接收新到货"               icon={Inbox}   color={A.gray1}  />
      </div>

      <Card className="p-5">
        <SectionHeader title="实时库位热力图"
          right={<div className="flex items-center gap-2 text-[10px]" style={{ color: A.sub }}>
            <span>低</span>
            <div className="flex h-2 w-32 rounded-full overflow-hidden">
              {[10, 30, 50, 70, 90].map((p, i) => (
                <div key={i} className="flex-1" style={{ background: `rgba(0,113,227,${p / 100})` }} />
              ))}
            </div>
            <span>高</span>
          </div>} />

        <div className="space-y-1.5">
          {grid.map((row, r) => (
            <div key={r} className="flex items-center gap-1.5">
              <span className="w-6 text-[10px] font-semibold text-right" style={{ color: A.gray1 }}>{String.fromCharCode(65 + r)}</span>
              {row.map((cell, c) => (
                <button key={c}
                  onClick={() => toast(`库位 ${cell.code}`, { description: `占用率 ${cell.fill}% · ${cell.status === "满" ? "请优先出库" : cell.status === "空" ? "可接收新货" : "正常运转"}` })}
                  className="flex-1 h-9 rounded-md transition-transform hover:scale-110 relative group"
                  style={{
                    background: cell.fill === 0 ? A.gray6 : `rgba(0,113,227,${0.15 + (cell.fill / 100) * 0.7})`,
                    border: cell.fill > 90 ? `1px solid ${A.red}` : "1px solid transparent",
                  }}>
                  <span className="text-[9px] font-medium tabular-nums" style={{ color: cell.fill > 50 ? A.white : A.label }}>{cell.fill}%</span>
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 whitespace-nowrap text-[10px] px-1.5 py-0.5 rounded text-white" style={{ background: A.label }}>
                    {cell.code}
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <SectionHeader title="拣货热度 TOP 10 库位"
          right={<span className="text-[10px]" style={{ color: A.gray2 }}>近 30 天</span>} />
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={[
            { bin: "A-07", picks: 412 }, { bin: "B-01", picks: 384 }, { bin: "D-02", picks: 356 },
            { bin: "C-05", picks: 312 }, { bin: "A-03", picks: 284 }, { bin: "D-01", picks: 268 },
            { bin: "B-04", picks: 241 }, { bin: "C-02", picks: 218 }, { bin: "D-03", picks: 196 }, { bin: "A-05", picks: 172 },
          ]} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="0" stroke="rgba(0,0,0,0.05)" vertical={false} />
            <XAxis dataKey="bin" tick={{ fontSize: 10, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} width={32} />
            <Tooltip content={<AppleTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
            <Bar dataKey="picks" name="拣货次数" fill={A.blue} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

// ─── Inventory · Master Wrapper ───────────────────────────────────────────────
type InvTab = "overview" | "lots" | "transfer" | "count" | "abcxyz" | "movements" | "bins";
function InventoryPanel() {
  const [tab, setTab] = useState<InvTab>("overview");
  const tabs = [
    { id: "overview",  label: "库存总览",  icon: Package,         count: "8,412" },
    { id: "lots",      label: "批次/序列号", icon: Layers,          count: LOTS.length },
    { id: "transfer",  label: "库间调拨",    icon: ArrowLeftRight,  count: TRANSFERS.length },
    { id: "count",     label: "循环盘点",    icon: ClipboardCheck,  count: COUNT_PLANS.length },
    { id: "abcxyz",    label: "ABC/XYZ 分类", icon: Boxes,           count: "10" },
    { id: "movements", label: "事务流水",    icon: History,         count: MOVEMENTS.length },
    { id: "bins",      label: "库位地图",    icon: Grid3x3,         count: "60" },
  ] as const;

  return (
    <div className="space-y-4">
      <SubTabs tabs={tabs as any} value={tab} onChange={(v) => setTab(v as InvTab)} />
      {tab === "overview"  && <InventoryOverview />}
      {tab === "lots"      && <InventoryLots />}
      {tab === "transfer"  && <InventoryTransfers />}
      {tab === "count"     && <InventoryCycleCount />}
      {tab === "abcxyz"    && <InventoryABCXYZ />}
      {tab === "movements" && <InventoryMovements />}
      {tab === "bins"      && <InventoryWarehouseMap />}
    </div>
  );
}

// ─── Sales · ERP Data ─────────────────────────────────────────────────────────
const SALES_ORDERS: {
  id: string; customer: string; channel: "直销" | "经销" | "电商" | "OEM";
  amount: number; items: number; createdAt: string; promiseDate: string;
  status: "草稿" | "已确认" | "拣货中" | "已发货" | "已交付" | "已关闭";
  owner: string; payTerms: string;
}[] = [
  { id: "SO-26-001824", customer: "华东工业集团",   channel: "直销", amount: 1842000, items: 14, createdAt: "2026-05-20", promiseDate: "2026-06-02", status: "已发货", owner: "张磊", payTerms: "Net 60" },
  { id: "SO-26-001825", customer: "京海科技",       channel: "经销", amount: 624500,  items:  8, createdAt: "2026-05-22", promiseDate: "2026-06-05", status: "拣货中", owner: "陈晨", payTerms: "Net 30" },
  { id: "SO-26-001826", customer: "申联电子",       channel: "电商", amount: 86420,   items:  3, createdAt: "2026-05-24", promiseDate: "2026-05-28", status: "已交付", owner: "刘洋", payTerms: "预付" },
  { id: "SO-26-001827", customer: "北方机械",       channel: "OEM",  amount: 3160000, items: 22, createdAt: "2026-05-25", promiseDate: "2026-06-18", status: "已确认", owner: "张磊", payTerms: "Net 90" },
  { id: "SO-26-001828", customer: "粤海制造",       channel: "直销", amount: 945000,  items: 11, createdAt: "2026-05-26", promiseDate: "2026-06-08", status: "草稿",   owner: "陈晨", payTerms: "Net 45" },
  { id: "SO-26-001829", customer: "申联电子",       channel: "电商", amount: 28700,   items:  2, createdAt: "2026-05-26", promiseDate: "2026-05-29", status: "已发货", owner: "刘洋", payTerms: "预付" },
  { id: "SO-26-001830", customer: "通达供应链",     channel: "经销", amount: 412800,  items:  6, createdAt: "2026-05-27", promiseDate: "2026-06-10", status: "已确认", owner: "张磊", payTerms: "Net 30" },
];

const CUSTOMERS: {
  code: string; name: string; tier: "A" | "B" | "C"; channel: string;
  ar: number; credit: number; ytd: number; lastOrder: string; nps: number; risk: "正常" | "关注" | "高风险";
}[] = [
  { code: "C-1001", name: "华东工业集团",   tier: "A", channel: "直销", ar: 4820000, credit: 8000000, ytd: 28600000, lastOrder: "2026-05-20", nps: 64, risk: "正常" },
  { code: "C-1002", name: "京海科技",       tier: "A", channel: "经销", ar: 1240000, credit: 3000000, ytd: 12400000, lastOrder: "2026-05-22", nps: 58, risk: "正常" },
  { code: "C-1003", name: "北方机械",       tier: "A", channel: "OEM",  ar: 6900000, credit: 10000000, ytd: 41200000, lastOrder: "2026-05-25", nps: 71, risk: "关注" },
  { code: "C-1004", name: "申联电子",       tier: "B", channel: "电商", ar: 86000,   credit: 500000,  ytd:  2840000, lastOrder: "2026-05-26", nps: 49, risk: "正常" },
  { code: "C-1005", name: "粤海制造",       tier: "B", channel: "直销", ar: 1840000, credit: 2500000, ytd:  9620000, lastOrder: "2026-05-26", nps: 52, risk: "高风险" },
  { code: "C-1006", name: "通达供应链",     tier: "B", channel: "经销", ar: 720000,  credit: 1500000, ytd:  6480000, lastOrder: "2026-05-27", nps: 61, risk: "正常" },
  { code: "C-1007", name: "西部重工",       tier: "C", channel: "直销", ar: 124000,  credit: 800000,  ytd:  1860000, lastOrder: "2026-04-18", nps: 42, risk: "关注" },
];

const FULFILLMENT_STAGES = [
  { stage: "草稿",   count:  8, value:  2840000 },
  { stage: "已确认", count: 14, value:  9620000 },
  { stage: "拣货中", count: 22, value: 12480000 },
  { stage: "已发货", count: 31, value: 18460000 },
  { stage: "已交付", count: 48, value: 24820000 },
];

const RMAS: {
  id: string; so: string; customer: string; reason: "质量问题" | "型号错发" | "客户拒收" | "运输破损" | "保修退换";
  qty: number; amount: number; status: "待审批" | "已审批" | "已收货" | "已结案"; createdAt: string;
}[] = [
  { id: "RMA-26-0142", so: "SO-26-001801", customer: "华东工业集团", reason: "质量问题", qty:  3, amount: 28400, status: "已收货", createdAt: "2026-05-18" },
  { id: "RMA-26-0143", so: "SO-26-001815", customer: "申联电子",     reason: "运输破损", qty:  1, amount:  6200, status: "已审批", createdAt: "2026-05-22" },
  { id: "RMA-26-0144", so: "SO-26-001797", customer: "京海科技",     reason: "型号错发", qty:  2, amount: 14800, status: "待审批", createdAt: "2026-05-24" },
  { id: "RMA-26-0145", so: "SO-26-001820", customer: "粤海制造",     reason: "保修退换", qty:  5, amount: 42600, status: "待审批", createdAt: "2026-05-26" },
  { id: "RMA-26-0146", so: "SO-26-001782", customer: "北方机械",     reason: "客户拒收", qty:  8, amount: 96400, status: "已结案", createdAt: "2026-05-12" },
];

const PRICE_RULES: {
  id: string; name: string; scope: string; type: "阶梯折扣" | "客户专价" | "促销价" | "渠道价" | "合同价";
  discount: string; valid: string; status: "生效中" | "待生效" | "已停用";
}[] = [
  { id: "PR-001", name: "A 类客户阶梯",        scope: "全 SKU · A 类",     type: "阶梯折扣", discount: "5% / 8% / 12%",  valid: "2026-01-01 ~ 2026-12-31", status: "生效中" },
  { id: "PR-002", name: "华东工业 OEM 年框",   scope: "OEM 系列 12 SKU",   type: "合同价",   discount: "目录价 -18%",     valid: "2026-03-01 ~ 2027-02-28", status: "生效中" },
  { id: "PR-003", name: "电商 618 大促",        scope: "电商渠道 · 全品",   type: "促销价",   discount: "限时 -22%",       valid: "2026-06-01 ~ 2026-06-20", status: "待生效" },
  { id: "PR-004", name: "经销商保护价",         scope: "经销渠道",          type: "渠道价",   discount: "目录价 -12%",     valid: "2026-01-01 ~ 2026-12-31", status: "生效中" },
  { id: "PR-005", name: "粤海制造客户专价",     scope: "C-1005 · 6 SKU",    type: "客户专价", discount: "目录价 -15%",     valid: "2026-04-15 ~ 2026-10-15", status: "生效中" },
  { id: "PR-006", name: "Q1 清仓",              scope: "EOL 系列 8 SKU",    type: "促销价",   discount: "目录价 -35%",     valid: "2026-01-15 ~ 2026-03-31", status: "已停用" },
];

// ─── Sales · Master Wrapper ───────────────────────────────────────────────────
type SalesTab = "overview" | "orders" | "customers" | "fulfillment" | "rma" | "pricing";
function SalesPanel() {
  const [tab, setTab] = useState<SalesTab>("overview");
  const tabs = [
    { id: "overview",    label: "销售总览",     icon: BarChart2,    count: "¥7.28亿" },
    { id: "orders",      label: "销售订单",     icon: Receipt,      count: SALES_ORDERS.length },
    { id: "customers",   label: "客户主数据",   icon: Users,        count: CUSTOMERS.length },
    { id: "fulfillment", label: "履约管道",     icon: Truck,        count: FULFILLMENT_STAGES.reduce((a, b) => a + b.count, 0) },
    { id: "rma",         label: "退货 RMA",     icon: Undo2,        count: RMAS.length },
    { id: "pricing",     label: "定价规则",     icon: Tag,          count: PRICE_RULES.length },
  ] as const;

  return (
    <div className="space-y-4">
      <SubTabs tabs={tabs as any} value={tab} onChange={(v) => setTab(v as SalesTab)} />
      {tab === "overview"    && <SalesOverview />}
      {tab === "orders"      && <SalesOrders />}
      {tab === "customers"   && <SalesCustomers />}
      {tab === "fulfillment" && <SalesFulfillment />}
      {tab === "rma"         && <SalesRMA />}
      {tab === "pricing"     && <SalesPricing />}
    </div>
  );
}

function SalesOverview() {
  const [tab, setTab] = useState<"revenue" | "orders">("revenue");

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="年度营收" value="¥7.28亿" sub="2026 YTD" delta="+18.4%" positive icon={DollarSign} color={A.blue} />
        <KpiCard label="年度订单" value="4,726" sub="完成 4,552 单" delta="+22.1%" positive icon={ShoppingCart} color={A.green} />
        <KpiCard label="综合毛利率" value="31.8%" sub="加权平均" delta="+2.4pts" positive icon={BarChart2} color={A.purple} />
        <KpiCard label="退货率" value="0.8%" sub="全年" delta="-0.2pts" positive icon={CheckCircle2} color={A.teal} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="col-span-2 p-5">
          <SectionHeader title="月度趋势"
            right={<SegmentedControl
              options={[{ label: "营收", value: "revenue" }, { label: "订单量", value: "orders" }]}
              value={tab} onChange={(v) => setTab(v as any)}
            />}
          />
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={salesData} barSize={18} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="barG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={tab === "revenue" ? A.blue : A.green} stopOpacity={1} />
                  <stop offset="100%" stopColor={tab === "revenue" ? A.blue : A.green} stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="0" stroke="rgba(0,0,0,0.05)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false}
                tickFormatter={(v) => tab === "revenue" ? `${v / 1e4}万` : `${v}`} width={48} />
              <Tooltip content={<AppleTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)", radius: 6 }} />
              <Bar dataKey={tab} name={tab === "revenue" ? "营收" : "订单量"} fill="url(#barG)" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <SectionHeader title="TOP 5 产品" />
          <div className="space-y-4">
            {topProducts.map((p, i) => (
              <div key={p.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium w-4 shrink-0 text-center rounded-md"
                      style={{ color: A.gray1, background: A.gray6, lineHeight: "1.4rem" }}>{i + 1}</span>
                    <span className="text-xs font-medium truncate" style={{ color: A.label }}>{p.name}</span>
                  </div>
                  <span className={`text-xs font-medium flex items-center gap-0.5 shrink-0 ml-2`}
                    style={{ color: p.growth >= 0 ? A.green : A.red }}>
                    {p.growth >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                    {Math.abs(p.growth)}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: A.gray5 }}>
                    <div className="h-full rounded-full" style={{ width: `${(p.revenue / topProducts[0].revenue) * 100}%`, background: A.blue }} />
                  </div>
                  <span className="text-[11px] shrink-0 w-14 text-right font-medium" style={{ color: A.sub }}>{fmt(p.revenue)}</span>
                </div>
                <div className="flex gap-3 mt-1 text-[10px]" style={{ color: A.gray2 }}>
                  <span>毛利 <span style={{ color: A.green }}>{p.margin}%</span></span>
                  <span>退货 <span style={{ color: p.returnRate > 0.8 ? A.red : A.gray1 }}>{p.returnRate}%</span></span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <div className="px-5 py-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>销售明细</h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["产品名称", "年销售额", "增长率", "销售量", "毛利率", "客单价", "退货率"].map((h) => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {topProducts.map((p, i) => (
              <tr key={p.name} className="hover:bg-blue-50/40 transition-colors"
                style={{ borderBottom: i < topProducts.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-5 py-3.5 font-medium" style={{ color: A.label }}>{p.name}</td>
                <td className="px-5 py-3.5 font-medium" style={{ color: A.blue }}>{fmt(p.revenue)}</td>
                <td className="px-5 py-3.5 font-medium" style={{ color: p.growth >= 0 ? A.green : A.red }}>
                  {p.growth >= 0 ? "+" : ""}{p.growth}%
                </td>
                <td className="px-5 py-3.5" style={{ color: A.label }}>{p.units.toLocaleString()}</td>
                <td className="px-5 py-3.5 font-medium" style={{ color: A.green }}>{p.margin}%</td>
                <td className="px-5 py-3.5" style={{ color: A.label }}>¥{Math.round(p.revenue / p.units / 10000)}万</td>
                <td className="px-5 py-3.5" style={{ color: p.returnRate > 0.8 ? A.red : A.gray1 }}>{p.returnRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Sales · Orders ───────────────────────────────────────────────────────────
function SalesOrders() {
  const [orders, setOrders] = useState(SALES_ORDERS);
  const [filter, setFilter] = useState<"全部" | "草稿" | "已确认" | "拣货中" | "已发货" | "已交付">("全部");
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState({ customer: "华东工业集团", channel: "直销" as const, amount: "", items: "", promiseDate: "2026-06-15", payTerms: "Net 30" });

  const filtered = filter === "全部" ? orders : orders.filter(o => o.status === filter);
  const totalValue = filtered.reduce((a, b) => a + b.amount, 0);

  const confirm = (id: string) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: "已确认" as const } : o));
    toast.success(`订单 ${id} 已确认`, { description: "已生成销售出库建议" });
  };
  const ship = (id: string) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: "已发货" as const } : o));
    toast.success(`订单 ${id} 已发货`, { description: "已通知物流系统创建运单" });
  };
  const createSO = () => {
    const amount = Number(form.amount);
    const items = Number(form.items);
    if (!amount || !items) { toast.error("请填写金额与行项数"); return; }
    const next = `SO-26-${String(1830 + orders.length + 1).padStart(6, "0")}`;
    setOrders(prev => [{
      id: next, customer: form.customer, channel: form.channel, amount, items,
      createdAt: "2026-05-27", promiseDate: form.promiseDate, status: "草稿", owner: "陈晨", payTerms: form.payTerms,
    }, ...prev]);
    setOpenNew(false);
    setForm({ customer: "华东工业集团", channel: "直销", amount: "", items: "", promiseDate: "2026-06-15", payTerms: "Net 30" });
    toast.success(`已创建 ${next}`, { description: "草稿订单已保存,等待销售经理确认" });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="活动订单"   value={String(orders.length)}                            sub="近 7 天" delta="+12"   positive icon={Receipt}     color={A.blue} />
        <KpiCard label="在途金额"   value={`¥${(totalValue / 1e4).toFixed(0)}万`}             sub="筛选合计"                       icon={DollarSign}  color={A.green} />
        <KpiCard label="平均周期"   value="6.4 天"                                            sub="确认 → 发货" delta="-0.8d" positive icon={Clock}      color={A.purple} />
        <KpiCard label="准时交付率" value="96.2%"                                             sub="本月 OTIF" delta="+1.4pts" positive icon={CheckCircle2} color={A.teal} />
      </div>

      <Card>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold" style={{ color: A.label }}>销售订单</h2>
            <SegmentedControl
              options={(["全部", "草稿", "已确认", "拣货中", "已发货", "已交付"] as const).map(v => ({ label: v, value: v }))}
              value={filter} onChange={(v) => setFilter(v as any)}
            />
          </div>
          <button onClick={() => setOpenNew(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white transition-all hover:opacity-90"
            style={{ background: A.blue }}>
            <Plus size={13} /> 新建销售订单
          </button>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["订单号", "客户", "渠道", "金额", "行项", "创建", "承诺交付", "付款条款", "状态", "操作"].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((o, i) => (
              <tr key={o.id} className="hover:bg-blue-50/40 transition-colors"
                style={{ borderBottom: i < filtered.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>{o.id}</td>
                <td className="px-5 py-3" style={{ color: A.label }}>{o.customer}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{o.channel}</td>
                <td className="px-5 py-3 font-medium" style={{ color: A.label }}>¥{(o.amount / 1e4).toFixed(1)}万</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{o.items}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{o.createdAt}</td>
                <td className="px-5 py-3" style={{ color: A.label }}>{o.promiseDate}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{o.payTerms}</td>
                <td className="px-5 py-3"><StatusPill status={o.status} /></td>
                <td className="px-5 py-3">
                  <div className="flex gap-1.5">
                    {o.status === "草稿"   && <button onClick={() => confirm(o.id)} className="px-2 py-1 text-[11px] font-medium rounded-md text-white" style={{ background: A.blue }}>确认</button>}
                    {o.status === "已确认" && <button onClick={() => ship(o.id)}    className="px-2 py-1 text-[11px] font-medium rounded-md text-white" style={{ background: A.green }}>发货</button>}
                    {(o.status === "拣货中" || o.status === "已发货") && <span className="text-[11px]" style={{ color: A.gray1 }}>—</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal open={openNew} onClose={() => setOpenNew(false)} title="新建销售订单" subtitle="请填写客户与基本信息" width={520}
        footer={<>
          <button onClick={() => setOpenNew(false)} className="px-3 py-1.5 text-xs font-medium rounded-lg" style={{ color: A.label, background: A.gray6 }}>取消</button>
          <button onClick={createSO} className="px-3 py-1.5 text-xs font-medium rounded-lg text-white" style={{ background: A.blue }}>创建草稿</button>
        </>}
      >
        <Field label="客户">
          <select value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
            style={{ borderColor: A.gray5, background: A.white }}>
            {CUSTOMERS.map(c => <option key={c.code}>{c.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="渠道">
            <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as any })}
              className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: A.gray5, background: A.white }}>
              {["直销", "经销", "电商", "OEM"].map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="付款条款">
            <select value={form.payTerms} onChange={(e) => setForm({ ...form, payTerms: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: A.gray5, background: A.white }}>
              {["预付", "Net 30", "Net 45", "Net 60", "Net 90"].map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="金额 (元)">
            <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="如 1840000" className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
              style={{ borderColor: A.gray5, background: A.white }} />
          </Field>
          <Field label="行项数">
            <input value={form.items} onChange={(e) => setForm({ ...form, items: e.target.value })}
              placeholder="如 12" className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
              style={{ borderColor: A.gray5, background: A.white }} />
          </Field>
        </div>
        <Field label="承诺交付日期">
          <input type="date" value={form.promiseDate} onChange={(e) => setForm({ ...form, promiseDate: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
            style={{ borderColor: A.gray5, background: A.white }} />
        </Field>
      </Modal>
    </div>
  );
}

// ─── Sales · Customers ────────────────────────────────────────────────────────
function SalesCustomers() {
  const [tier, setTier] = useState<"全部" | "A" | "B" | "C">("全部");
  const filtered = tier === "全部" ? CUSTOMERS : CUSTOMERS.filter(c => c.tier === tier);
  const totalAR = filtered.reduce((a, b) => a + b.ar, 0);
  const highRisk = filtered.filter(c => c.risk === "高风险").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="活跃客户" value={String(CUSTOMERS.length)} sub="近 90 天" delta="+3" positive icon={Users} color={A.blue} />
        <KpiCard label="应收账款" value={`¥${(totalAR / 1e4).toFixed(0)}万`} sub="筛选合计" icon={Wallet} color={A.orange} />
        <KpiCard label="高风险客户" value={String(highRisk)} sub="信用预警" delta={highRisk > 0 ? "需关注" : "—"} icon={AlertTriangle} color={A.red} />
        <KpiCard label="平均 NPS" value={String(Math.round(CUSTOMERS.reduce((a, b) => a + b.nps, 0) / CUSTOMERS.length))} sub="客户口碑" delta="+4" positive icon={Sparkles} color={A.green} />
      </div>

      <Card>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>客户主数据</h2>
          <SegmentedControl
            options={(["全部", "A", "B", "C"] as const).map(v => ({ label: v === "全部" ? v : `${v} 级`, value: v }))}
            value={tier} onChange={(v) => setTier(v as any)}
          />
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["客户编号", "名称", "等级", "渠道", "应收账款", "授信额度", "授信占用", "YTD 销售", "最近下单", "NPS", "风险"].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => {
              const util = c.ar / c.credit;
              return (
                <tr key={c.code} className="hover:bg-blue-50/40 transition-colors"
                  style={{ borderBottom: i < filtered.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                  <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>{c.code}</td>
                  <td className="px-5 py-3 font-medium" style={{ color: A.label }}>{c.name}</td>
                  <td className="px-5 py-3"><Chip label={c.tier} color={c.tier === "A" ? A.green : c.tier === "B" ? A.blue : A.gray1} bg={c.tier === "A" ? "rgba(52,199,89,0.1)" : c.tier === "B" ? "rgba(0,113,227,0.1)" : "rgba(142,142,147,0.1)"} /></td>
                  <td className="px-5 py-3" style={{ color: A.sub }}>{c.channel}</td>
                  <td className="px-5 py-3 font-medium" style={{ color: A.label }}>¥{(c.ar / 1e4).toFixed(0)}万</td>
                  <td className="px-5 py-3" style={{ color: A.sub }}>¥{(c.credit / 1e4).toFixed(0)}万</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: A.gray5 }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, util * 100)}%`, background: util > 0.8 ? A.red : util > 0.5 ? A.orange : A.green }} />
                      </div>
                      <span className="text-[11px] font-medium" style={{ color: util > 0.8 ? A.red : A.label }}>{(util * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>¥{(c.ytd / 1e4).toFixed(0)}万</td>
                  <td className="px-5 py-3" style={{ color: A.sub }}>{c.lastOrder}</td>
                  <td className="px-5 py-3 font-medium" style={{ color: c.nps > 60 ? A.green : c.nps > 50 ? A.blue : A.orange }}>{c.nps}</td>
                  <td className="px-5 py-3"><StatusPill status={c.risk} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Sales · Fulfillment Pipeline ─────────────────────────────────────────────
function SalesFulfillment() {
  const total = FULFILLMENT_STAGES.reduce((a, b) => a + b.count, 0);
  const totalValue = FULFILLMENT_STAGES.reduce((a, b) => a + b.value, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="在途订单"   value={String(total)}                                       sub="全部阶段"                       icon={Truck}       color={A.blue} />
        <KpiCard label="在途金额"   value={`¥${(totalValue / 1e4).toFixed(0)}万`}              sub="未交付合计"                     icon={DollarSign}  color={A.green} />
        <KpiCard label="平均履约时长" value="7.2 天"                                            sub="确认 → 交付" delta="-0.4d" positive icon={Clock}       color={A.purple} />
        <KpiCard label="OTIF"       value="96.2%"                                              sub="准时全量交付率" delta="+1.4pts" positive icon={CheckCircle2} color={A.teal} />
      </div>

      <Card className="p-5">
        <SectionHeader title="履约阶段漏斗" right={<span className="text-xs" style={{ color: A.gray1 }}>实时</span>} />
        <div className="space-y-3 mt-2">
          {FULFILLMENT_STAGES.map((s, i) => {
            const width = (s.count / FULFILLMENT_STAGES[0].count) * 100;
            const colors = [A.gray1, A.blue, A.orange, A.purple, A.green];
            return (
              <div key={s.stage}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium" style={{ color: A.label }}>{s.stage}</span>
                  <span className="text-xs" style={{ color: A.sub }}>
                    <span className="font-medium" style={{ color: A.label }}>{s.count}</span> 单 · ¥{(s.value / 1e4).toFixed(0)}万
                  </span>
                </div>
                <div className="h-7 rounded-lg flex items-center px-3" style={{ width: `${Math.max(15, width)}%`, background: `${colors[i]}1a`, border: `0.5px solid ${colors[i]}33` }}>
                  <span className="text-[11px] font-medium" style={{ color: colors[i] }}>
                    {((s.count / total) * 100).toFixed(1)}% · 转化率 {i < FULFILLMENT_STAGES.length - 1 ? ((FULFILLMENT_STAGES[i + 1].count / s.count) * 100).toFixed(0) + "%" : "—"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-5">
          <SectionHeader title="今日待发运" />
          <div className="space-y-3">
            {SALES_ORDERS.filter(o => o.status === "拣货中" || o.status === "已确认").slice(0, 4).map(o => (
              <div key={o.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: A.gray6 }}>
                <div className="min-w-0">
                  <div className="text-xs font-medium" style={{ color: A.label }}>{o.id} · {o.customer}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: A.sub }}>承诺 {o.promiseDate} · {o.items} 行项</div>
                </div>
                <StatusPill status={o.status} />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeader title="异常预警" />
          <div className="space-y-2">
            {[
              { label: "延迟风险订单", value: 4, color: A.red, hint: "承诺日 < 48h 且未发货" },
              { label: "缺货阻塞订单", value: 2, color: A.orange, hint: "等待补货 / 转厂" },
              { label: "信用挂起",     value: 1, color: A.purple, hint: "授信占用 > 90%" },
              { label: "待客户确认",   value: 3, color: A.blue, hint: "条款变更待客户回签" },
            ].map(x => (
              <div key={x.label} className="flex items-center justify-between p-3 rounded-lg" style={{ background: `${x.color}0d` }}>
                <div>
                  <div className="text-xs font-medium" style={{ color: A.label }}>{x.label}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: A.sub }}>{x.hint}</div>
                </div>
                <span className="text-lg font-semibold" style={{ color: x.color }}>{x.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Sales · RMA ──────────────────────────────────────────────────────────────
function SalesRMA() {
  const [rmas, setRmas] = useState(RMAS);
  const approve = (id: string) => {
    setRmas(prev => prev.map(r => r.id === id ? { ...r, status: "已审批" as const } : r));
    toast.success(`${id} 已审批`, { description: "已通知收货部门准备入库" });
  };
  const close = (id: string) => {
    setRmas(prev => prev.map(r => r.id === id ? { ...r, status: "已结案" as const } : r));
    toast.success(`${id} 已结案`, { description: "已生成贷项凭证" });
  };

  const totalAmt = rmas.reduce((a, b) => a + b.amount, 0);
  const byReason = ["质量问题", "型号错发", "客户拒收", "运输破损", "保修退换"].map(r => ({
    reason: r, count: rmas.filter(x => x.reason === r).length,
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="RMA 工单"  value={String(rmas.length)}                          sub="近 30 天"                  icon={Undo2}         color={A.orange} />
        <KpiCard label="退货金额"  value={`¥${(totalAmt / 1e4).toFixed(1)}万`}          sub="累计"                       icon={DollarSign}    color={A.red} />
        <KpiCard label="退货率"    value="0.8%"                                          sub="销售额占比" delta="-0.2pts" positive icon={TrendingUp} color={A.green} />
        <KpiCard label="待处理"    value={String(rmas.filter(r => r.status === "待审批").length)} sub="需审批"           icon={AlertCircle}   color={A.blue} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-5">
          <SectionHeader title="退货原因分布" />
          <div className="space-y-2.5">
            {byReason.map(r => (
              <div key={r.reason} className="flex items-center justify-between">
                <span className="text-xs" style={{ color: A.label }}>{r.reason}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: A.gray5 }}>
                    <div className="h-full rounded-full" style={{ width: `${(r.count / rmas.length) * 100}%`, background: A.orange }} />
                  </div>
                  <span className="text-xs font-medium w-6 text-right" style={{ color: A.label }}>{r.count}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="col-span-2">
          <div className="px-5 py-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
            <h2 className="text-sm font-semibold" style={{ color: A.label }}>RMA 明细</h2>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                {["RMA 单号", "客户", "原因", "数量", "金额", "状态", "操作"].map(h => (
                  <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rmas.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: i < rmas.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                  <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>{r.id}</td>
                  <td className="px-5 py-3" style={{ color: A.label }}>{r.customer}</td>
                  <td className="px-5 py-3" style={{ color: A.sub }}>{r.reason}</td>
                  <td className="px-5 py-3" style={{ color: A.label }}>{r.qty}</td>
                  <td className="px-5 py-3 font-medium" style={{ color: A.red }}>¥{r.amount.toLocaleString()}</td>
                  <td className="px-5 py-3"><StatusPill status={r.status} /></td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1.5">
                      {r.status === "待审批" && <button onClick={() => approve(r.id)} className="px-2 py-1 text-[11px] font-medium rounded-md text-white" style={{ background: A.blue }}>审批</button>}
                      {r.status === "已收货" && <button onClick={() => close(r.id)} className="px-2 py-1 text-[11px] font-medium rounded-md text-white" style={{ background: A.green }}>结案</button>}
                      {(r.status === "已审批" || r.status === "已结案") && <span className="text-[11px]" style={{ color: A.gray1 }}>—</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

// ─── Sales · Pricing ──────────────────────────────────────────────────────────
function SalesPricing() {
  const [rules, setRules] = useState(PRICE_RULES);
  const toggle = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, status: r.status === "生效中" ? "已停用" : "生效中" as any } : r));
    toast.success("规则状态已更新");
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="价格规则"   value={String(rules.length)}                              sub="全部"                            icon={Tag}        color={A.blue} />
        <KpiCard label="生效中"     value={String(rules.filter(r => r.status === "生效中").length)} sub="实时生效"                  icon={CheckCircle2} color={A.green} />
        <KpiCard label="本月调价"   value="8"                                                  sub="新增 / 修订" delta="+3" positive icon={Activity}   color={A.purple} />
        <KpiCard label="平均折扣"   value="14.6%"                                              sub="加权"                            icon={TrendingUp} color={A.orange} />
      </div>

      <Card>
        <div className="px-5 py-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>定价规则</h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["编号", "名称", "适用范围", "类型", "折扣 / 价格", "有效期", "状态", "操作"].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rules.map((r, i) => (
              <tr key={r.id} style={{ borderBottom: i < rules.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>{r.id}</td>
                <td className="px-5 py-3 font-medium" style={{ color: A.label }}>{r.name}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{r.scope}</td>
                <td className="px-5 py-3"><Chip label={r.type} color={A.purple} bg="rgba(175,82,222,0.1)" /></td>
                <td className="px-5 py-3 font-medium" style={{ color: A.label }}>{r.discount}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{r.valid}</td>
                <td className="px-5 py-3"><StatusPill status={r.status} /></td>
                <td className="px-5 py-3">
                  <button onClick={() => toggle(r.id)} className="px-2 py-1 text-[11px] font-medium rounded-md"
                    style={{ color: r.status === "生效中" ? A.red : A.green, background: r.status === "生效中" ? "rgba(255,59,48,0.1)" : "rgba(52,199,89,0.1)" }}>
                    {r.status === "生效中" ? "停用" : "启用"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Forecast Engine (real statistics) ───────────────────────────────────────
type Method = "naive" | "sma" | "ses" | "holt" | "hw";
const METHOD_LABEL: Record<Method, string> = {
  naive: "朴素法 (Naive)",
  sma:   "移动平均 (SMA-3)",
  ses:   "一次指数平滑 (SES)",
  holt:  "Holt 双参数 (含趋势)",
  hw:    "Holt-Winters (含趋势+季节)",
};

// Lewis (1982) industry standard MAPE bands
function mapeGrade(mape: number): { grade: string; color: string; band: string } {
  if (mape < 10) return { grade: "A", color: A.green,  band: "高度精确" };
  if (mape < 20) return { grade: "B", color: A.blue,   band: "良好" };
  if (mape < 50) return { grade: "C", color: A.orange, band: "合理" };
  return                  { grade: "D", color: A.red,    band: "不准确" };
}

// Coefficient-of-Variation based forecastability (XYZ classification)
function xyzClass(history: number[]): { cls: "X" | "Y" | "Z"; cov: number; note: string; color: string } {
  const mean = history.reduce((a, b) => a + b, 0) / history.length;
  const std  = Math.sqrt(history.reduce((s, v) => s + (v - mean) ** 2, 0) / history.length);
  const cov  = std / mean;
  if (cov < 0.25) return { cls: "X", cov, color: A.green,  note: "需求平稳 · 易预测" };
  if (cov < 0.50) return { cls: "Y", cov, color: A.orange, note: "中度波动 · 可预测" };
  return                   { cls: "Z", cov, color: A.red,    note: "高度不规则 · 难预测" };
}

// Z-score for normal distribution at a service level α
function zScore(serviceLevel: number): number {
  const table: Record<number, number> = { 50: 0, 80: 0.84, 85: 1.04, 90: 1.28, 95: 1.65, 97: 1.88, 98: 2.05, 99: 2.33, 99.5: 2.58 };
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  for (const k of keys) if (Math.abs(k - serviceLevel) < 0.01) return table[k];
  return 1.65;
}

function runForecast(
  history: number[], method: Method,
  params: { alpha: number; beta: number; gamma: number; season: number },
  horizon: number
): {
  fitted: (number | null)[]; forecast: number[];
  mape: number; rmse: number; mae: number; bias: number;
  wmape: number; smape: number; trackingSignal: number; theilU: number;
} {
  const { alpha, beta, gamma, season } = params;
  const n = history.length;
  const fitted: (number | null)[] = Array(n).fill(null);
  const forecast: number[] = [];

  if (method === "naive") {
    for (let i = 1; i < n; i++) fitted[i] = history[i - 1];
    for (let h = 0; h < horizon; h++) forecast.push(history[n - 1]);
  } else if (method === "sma") {
    const w = 3;
    for (let i = w; i < n; i++) {
      fitted[i] = (history[i - 1] + history[i - 2] + history[i - 3]) / w;
    }
    const last3 = (history[n - 1] + history[n - 2] + history[n - 3]) / w;
    for (let h = 0; h < horizon; h++) forecast.push(last3);
  } else if (method === "ses") {
    let level = history[0];
    fitted[0] = level;
    for (let i = 1; i < n; i++) {
      level = alpha * history[i] + (1 - alpha) * level;
      fitted[i] = level;
    }
    for (let h = 0; h < horizon; h++) forecast.push(level);
  } else if (method === "holt") {
    let level = history[0];
    let trend = history[1] - history[0];
    fitted[0] = level;
    for (let i = 1; i < n; i++) {
      const prevLevel = level;
      level = alpha * history[i] + (1 - alpha) * (level + trend);
      trend = beta * (level - prevLevel) + (1 - beta) * trend;
      fitted[i] = level + trend;
    }
    for (let h = 1; h <= horizon; h++) forecast.push(level + h * trend);
  } else if (method === "hw") {
    const seasonals: number[] = Array(season).fill(0);
    let level = history.slice(0, season).reduce((a, b) => a + b, 0) / season;
    let trend = (history.slice(season, season * 2).reduce((a, b) => a + b, 0) -
                 history.slice(0, season).reduce((a, b) => a + b, 0)) / (season * season);
    for (let i = 0; i < season; i++) seasonals[i] = history[i] / level;

    fitted[0] = level * seasonals[0];
    for (let i = 1; i < n; i++) {
      const s = seasonals[i % season];
      const prevLevel = level;
      level   = alpha * (history[i] / s) + (1 - alpha) * (level + trend);
      trend   = beta * (level - prevLevel) + (1 - beta) * trend;
      seasonals[i % season] = gamma * (history[i] / level) + (1 - gamma) * s;
      fitted[i] = (level + trend) * seasonals[i % season];
    }
    for (let h = 1; h <= horizon; h++) {
      forecast.push((level + h * trend) * seasonals[(n + h - 1) % season]);
    }
  }

  let sumAbsPct = 0, sumSq = 0, sumAbs = 0, sumErr = 0, cnt = 0;
  let sumActual = 0, sumSMAPE = 0;
  let sumNaiveSq = 0;
  for (let i = 0; i < n; i++) {
    if (fitted[i] == null || history[i] === 0) continue;
    const err = history[i] - (fitted[i] as number);
    sumAbsPct += Math.abs(err / history[i]);
    sumSq += err * err; sumAbs += Math.abs(err); sumErr += err; cnt++;
    sumActual += history[i];
    const denom = (Math.abs(history[i]) + Math.abs(fitted[i] as number)) / 2;
    if (denom > 0) sumSMAPE += Math.abs(err) / denom;
    if (i > 0) sumNaiveSq += (history[i] - history[i - 1]) ** 2;
  }
  const mae   = cnt ? sumAbs / cnt : 0;
  const rmse  = cnt ? Math.sqrt(sumSq / cnt) : 0;
  const bias  = cnt ? sumErr / cnt : 0;
  return {
    fitted, forecast: forecast.map((v) => Math.max(0, v)),
    mape:           cnt ? (sumAbsPct / cnt) * 100 : 0,
    rmse, mae, bias,
    wmape:          sumActual ? (sumAbs / sumActual) * 100 : 0,
    smape:          cnt ? (sumSMAPE / cnt) * 100 : 0,
    trackingSignal: mae ? sumErr / mae : 0,           // |TS| > 4 → bias warning
    theilU:         sumNaiveSq ? Math.sqrt(sumSq / sumNaiveSq) : 0, // <1 better than naive
  };
}

// 24 months of demand per SKU (with trend + seasonality + noise)
function genSeries(base: number, trend: number, seasonAmp: number, seed: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 24; i++) {
    const t = base + trend * i;
    const s = 1 + seasonAmp * Math.sin(((i % 12) / 12) * Math.PI * 2 - Math.PI / 2);
    const noise = 0.94 + ((Math.sin(i * 7.1 + seed) + 1) / 2) * 0.12;
    out.push(Math.round(t * s * noise));
  }
  return out;
}

const FORECAST_SKUS = [
  { sku: "SKU-00412", name: "伺服电机 750W",     onHand: 34,   open: 150, history: genSeries(120, 2.4,  0.18, 1.3), unit: "台" },
  { sku: "SKU-00623", name: "控制器主板 V3.2",   onHand: 12,   open: 60,  history: genSeries(46,  1.2,  0.22, 2.1), unit: "件" },
  { sku: "SKU-00287", name: "铝合金型材 6063",   onHand: 148,  open: 800, history: genSeries(620, 8,    0.14, 3.7), unit: "米" },
  { sku: "SKU-00142", name: "精密轴承 6204-ZZ",  onHand: 2840, open: 0,   history: genSeries(380, 4.6,  0.10, 4.5), unit: "件" },
  { sku: "SKU-00815", name: "液压油缸 50mm",     onHand: 67,   open: 0,   history: genSeries(140, 1.8,  0.16, 5.2), unit: "件" },
];

// Generate the trailing 24 months ending at the current month (May 2026 → 24-month window 2024-06 ~ 2026-05)
const MONTHS_24 = (() => {
  const NOW_Y = 2026, NOW_M = 5;        // 2026 年 5 月作为最后一格
  const out: string[] = [];
  for (let i = 23; i >= 0; i--) {
    const totalIdx = NOW_Y * 12 + (NOW_M - 1) - i;
    const y = Math.floor(totalIdx / 12);
    const m = (totalIdx % 12) + 1;
    out.push(`${String(y).slice(-2)}/${m}月`);
  }
  return out;
})();

// Forecast horizon labels start at 2026-06
const FUTURE_LABEL = (i: number) => {
  const totalIdx = 2026 * 12 + 5 + i;
  const y = Math.floor(totalIdx / 12);
  const m = (totalIdx % 12) + 1;
  return `${String(y).slice(-2)}/${m}月`;
};

function ForecastPanel() {
  const [skuIdx, setSkuIdx] = useState(0);
  const [method, setMethod] = useState<Method>("hw");
  const [alpha, setAlpha] = useState(0.4);
  const [beta,  setBeta]  = useState(0.15);
  const [gamma, setGamma] = useState(0.25);
  const [horizon, setHorizon] = useState(6);
  const [scenario, setScenario] = useState<"base" | "opt" | "pess">("base");
  const [promoLift, setPromoLift] = useState(0);
  const [serviceLevel, setServiceLevel] = useState<50 | 80 | 85 | 90 | 95 | 97 | 98 | 99 | 99.5>(95);
  const [leadTimeDays, setLeadTimeDays] = useState(14);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [committed, setCommitted] = useState(false);

  const sku = FORECAST_SKUS[skuIdx];

  const result = useMemo(() => runForecast(sku.history, method, { alpha, beta, gamma, season: 12 }, horizon),
    [sku, method, alpha, beta, gamma, horizon]);

  // Champion vs Challenger (auto-run all methods, surface best by MAPE)
  const benchmark = useMemo(() => {
    const methods: Method[] = ["naive", "sma", "ses", "holt", "hw"];
    return methods.map((m) => {
      const r = runForecast(sku.history, m, { alpha: 0.4, beta: 0.15, gamma: 0.25, season: 12 }, horizon);
      return { method: m, mape: r.mape, rmse: r.rmse };
    }).sort((a, b) => a.mape - b.mape);
  }, [sku, horizon]);

  const champion = benchmark[0];
  const aiSuggestsDifferent = champion.method !== method;

  // Apply scenario & promo lift to the raw forecast
  const scenarioMult = scenario === "opt" ? 1.12 : scenario === "pess" ? 0.88 : 1.0;
  const adjustedForecast = result.forecast.map((v, i) =>
    v * scenarioMult * (1 + promoLift / 100) * (1 + (i === 1 ? 0 : 0))
  );

  // Combined chart data (history + fitted + forecast bands)
  const historyData = useMemo(() => sku.history.map((h, i) => ({
    month: MONTHS_24[i], actual: h, fitted: result.fitted[i] ?? null,
  })), [sku, result]);

  const forecastChart = useMemo(() => {
    const errStd = result.rmse;
    const lastActual = sku.history[sku.history.length - 1];
    // Anchor point: repeat last historical actual so the forecast line visually connects from "今天"
    const arr: any[] = [{
      month: MONTHS_24[MONTHS_24.length - 1],
      forecast: lastActual, lower: lastActual, upper: lastActual, bandHeight: 0,
    }];
    for (let i = 0; i < horizon; i++) {
      const f = adjustedForecast[i];
      const lo = Math.max(0, f - 1.96 * errStd);
      const hi = f + 1.96 * errStd;
      arr.push({
        month: FUTURE_LABEL(i),
        forecast: f, lower: lo, upper: hi, bandHeight: hi - lo,
      });
    }
    return arr;
  }, [sku, result, adjustedForecast, horizon]);

  // Shared Y domain so the two side-by-side charts read on the same scale
  const yDomain = useMemo(() => {
    const allVals: number[] = [];
    historyData.forEach(d => { if (d.actual != null) allVals.push(d.actual); if (d.fitted != null) allVals.push(d.fitted); });
    forecastChart.forEach(d => { allVals.push(d.upper); allVals.push(d.lower); });
    const lo = Math.min(...allVals);
    const hi = Math.max(...allVals);
    const pad = (hi - lo) * 0.1;
    return [Math.max(0, Math.floor((lo - pad) / 10) * 10), Math.ceil((hi + pad) / 10) * 10];
  }, [historyData, forecastChart]);

  // Supply-demand reconciliation (next `horizon` months)
  const reconciliation = useMemo(() => {
    let inv = sku.onHand;
    const inbound = (m: number) => m === 0 ? sku.open : 0;
    return adjustedForecast.map((demand, i) => {
      inv = inv + inbound(i) - demand;
      const gap = inv < 0 ? -inv : 0;
      const cover = demand > 0 ? (inv + demand) / demand : 0;
      return {
        month: FUTURE_LABEL(i),
        demand: Math.round(demand),
        inbound: inbound(i),
        ending: Math.round(inv),
        gap: Math.round(gap),
        cover: cover,
        risk: inv < 0 ? "高" : cover < 1.2 ? "中" : "低",
      };
    });
  }, [sku, adjustedForecast]);

  const totalGap = reconciliation.reduce((s, r) => s + r.gap, 0);
  const stockoutMonths = reconciliation.filter((r) => r.risk === "高").length;

  function runEngine() {
    setRunning(true); setProgress(0); setCommitted(false);
    let p = 0;
    const step = () => {
      p += Math.random() * 18 + 10;
      if (p >= 100) { setProgress(100); setRunning(false); toast.success(`${METHOD_LABEL[method]} 已收敛`, { description: `MAPE ${result.mape.toFixed(1)}% · RMSE ${result.rmse.toFixed(0)}` }); }
      else { setProgress(Math.round(p)); setTimeout(step, 90); }
    };
    setTimeout(step, 60);
  }

  function applyAI() {
    setMethod(champion.method);
    toast(`已切换为 AI 推荐模型: ${METHOD_LABEL[champion.method]}`, {
      description: `MAPE ${champion.mape.toFixed(1)}% (较当前 ↓${(result.mape - champion.mape).toFixed(1)}pts)`,
    });
  }

  function commitPlan() {
    setCommitted(true);
    toast.success(`${sku.sku} 共识需求计划已发布`, {
      description: `${horizon} 个月 · 累计需求 ${reconciliation.reduce((s, r) => s + r.demand, 0).toLocaleString()} ${sku.unit} · 已同步至 MRP`,
    });
  }

  return (
    <div className="space-y-5">
      {/* Header KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="模型 MAPE" value={`${result.mape.toFixed(1)}%`} sub={`RMSE ${result.rmse.toFixed(0)}`}
          delta={aiSuggestsDifferent ? `AI ↓${(result.mape - champion.mape).toFixed(1)}pts` : "已最优"}
          positive={!aiSuggestsDifferent} icon={Activity} color={A.green} />
        <KpiCard label={`未来 ${horizon} 月需求`}
          value={reconciliation.reduce((s, r) => s + r.demand, 0).toLocaleString()}
          sub={sku.unit}
          delta={scenario !== "base" ? (scenario === "opt" ? "+12%" : "-12%") : promoLift ? `促销 +${promoLift}%` : "基准"}
          positive={scenario === "opt"} icon={TrendingUp} color={A.blue} />
        <KpiCard label="供需缺口" value={totalGap > 0 ? totalGap.toLocaleString() : "0"}
          sub={`${stockoutMonths} 个月断货风险`}
          delta={totalGap > 0 ? "需采购" : "充足"} positive={totalGap === 0}
          icon={AlertTriangle} color={totalGap > 0 ? A.red : A.green} />
        <KpiCard label="计划状态" value={committed ? "已发布" : "草稿"} sub="S&OP 共识需求"
          icon={committed ? CheckCircle2 : Clock} color={committed ? A.green : A.orange} />
      </div>

      {/* SKU selector */}
      <Card className="p-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-[10px] font-semibold uppercase tracking-widest px-2 shrink-0" style={{ color: A.gray2 }}>SKU</span>
          {FORECAST_SKUS.map((s, i) => (
            <button key={s.sku} onClick={() => { setSkuIdx(i); setCommitted(false); }}
              className="shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-all"
              style={skuIdx === i
                ? { background: "#f0f6ff", color: A.blue, boxShadow: `0 0 0 1px ${A.blue}30` }
                : { background: "transparent", color: A.gray1 }}>
              <span style={{ color: skuIdx === i ? A.blue : A.gray2 }}>{s.sku}</span>
              <span className="ml-2">{s.name}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Engine controls */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-5">
          <SectionHeader title="预测引擎"
            right={<span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "#f0f6ff", color: A.blue }}>v2.4</span>} />

          <Field label="算法">
            <select value={method} onChange={(e) => setMethod(e.target.value as Method)} style={inputStyle}>
              {(["naive","sma","ses","holt","hw"] as Method[]).map((m) => (
                <option key={m} value={m}>{METHOD_LABEL[m]}</option>
              ))}
            </select>
          </Field>

          <div className="space-y-4 mt-4">
            {[
              { label: "α (Level)",    val: alpha, set: setAlpha, enabled: method === "ses" || method === "holt" || method === "hw" },
              { label: "β (Trend)",    val: beta,  set: setBeta,  enabled: method === "holt" || method === "hw" },
              { label: "γ (Seasonal)", val: gamma, set: setGamma, enabled: method === "hw" },
            ].map((p) => (
              <div key={p.label} style={{ opacity: p.enabled ? 1 : 0.4 }}>
                <div className="flex justify-between text-[11px] mb-1">
                  <span style={{ color: A.sub }}>{p.label}</span>
                  <span className="font-medium tabular-nums" style={{ color: A.label }}>{p.val.toFixed(2)}</span>
                </div>
                <input type="range" min={0.05} max={0.95} step={0.05}
                  value={p.val} disabled={!p.enabled}
                  onChange={(e) => p.set(parseFloat(e.target.value))}
                  className="w-full h-1 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: A.blue, background: A.gray5 }} />
              </div>
            ))}

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span style={{ color: A.sub }}>预测期 (月)</span>
                <span className="font-medium tabular-nums" style={{ color: A.label }}>{horizon}</span>
              </div>
              <input type="range" min={3} max={12} step={1} value={horizon}
                onChange={(e) => setHorizon(parseInt(e.target.value))}
                className="w-full h-1 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: A.blue, background: A.gray5 }} />
            </div>
          </div>

          <button onClick={runEngine} disabled={running}
            className="w-full mt-5 text-xs py-2.5 rounded-xl font-medium text-white flex items-center justify-center gap-1.5"
            style={{ background: A.blue, opacity: running ? 0.6 : 1 }}>
            {running ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {running ? `运算中… ${progress}%` : "运行预测引擎"}
          </button>

          {running && (
            <div className="h-1 mt-2 rounded-full overflow-hidden" style={{ background: A.gray5 }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: A.blue }} />
            </div>
          )}

          {/* Accuracy metrics — industry standard suite */}
          <div className="mt-4 pt-4" style={{ borderTop: "0.5px solid rgba(0,0,0,0.06)" }}>
            {(() => {
              const g = mapeGrade(result.mape);
              const tsAlert = Math.abs(result.trackingSignal) > 4;
              const theilBetter = result.theilU < 1;
              return (
                <>
                  {/* Lewis grade banner */}
                  <div className="rounded-xl p-3 mb-3 flex items-center gap-3"
                    style={{ background: `${g.color}12`, border: `1px solid ${g.color}30` }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center font-semibold text-base"
                      style={{ background: g.color, color: A.white }}>{g.grade}</div>
                    <div className="flex-1">
                      <div className="text-xs font-semibold" style={{ color: A.label }}>Lewis 等级 · {g.band}</div>
                      <div className="text-[10px]" style={{ color: A.sub }}>MAPE {result.mape.toFixed(1)}% (A&lt;10 · B&lt;20 · C&lt;50 · D≥50)</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "MAPE",    val: `${result.mape.toFixed(1)}%`,  hint: "平均绝对百分比误差",  color: g.color },
                      { label: "WMAPE",   val: `${result.wmape.toFixed(1)}%`, hint: "按销量加权 MAPE",     color: A.label },
                      { label: "sMAPE",   val: `${result.smape.toFixed(1)}%`, hint: "对称 MAPE (无穷大保护)", color: A.label },
                      { label: "RMSE",    val: result.rmse.toFixed(0),         hint: "均方根误差",          color: A.label },
                      { label: "MAE",     val: result.mae.toFixed(0),          hint: "平均绝对误差",        color: A.label },
                      { label: "Bias",    val: (result.bias >= 0 ? "+" : "") + result.bias.toFixed(0),
                        hint: "误差均值 (>0 低估)", color: Math.abs(result.bias) < result.mae * 0.3 ? A.green : A.orange },
                      { label: "Tracking Signal",
                        val: (result.trackingSignal >= 0 ? "+" : "") + result.trackingSignal.toFixed(2),
                        hint: tsAlert ? "|TS|>4 系统性偏差" : "在 ±4 控制限内",
                        color: tsAlert ? A.red : A.green },
                      { label: "Theil's U",
                        val: result.theilU.toFixed(2),
                        hint: theilBetter ? "U<1 优于朴素法" : "U≥1 不如朴素法",
                        color: theilBetter ? A.green : A.red },
                    ].map((m) => (
                      <div key={m.label} className="rounded-lg p-2.5" style={{ background: A.gray6 }}>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px]" style={{ color: A.gray1 }}>{m.label}</span>
                        </div>
                        <div className="text-sm font-semibold tabular-nums mt-0.5" style={{ color: m.color }}>{m.val}</div>
                        <div className="text-[9px] mt-0.5" style={{ color: A.gray2 }}>{m.hint}</div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </Card>

        {/* Chart */}
        <Card className="col-span-2 p-5">
          <SectionHeader title={`${sku.sku} · ${sku.name}`}
            right={
              <div className="flex items-center gap-4 text-xs" style={{ color: A.sub }}>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5" style={{ background: A.blue }} /><span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: A.blue, marginLeft: -2 }} /><span style={{ color: A.gray1 }}>实际 (历史)</span></span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0" style={{ borderTop: `1.5px dotted ${A.green}` }} /><span style={{ color: A.gray1 }}>拟合 (训练)</span></span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0" style={{ borderTop: `2px dashed ${A.orange}` }} /><span style={{ color: A.gray1 }}>预测 (未来)</span></span>
              </div>
            } />

          {/* Two side-by-side panels: HISTORY (actual vs fitted) | FORECAST (prediction + 95% CI band) */}
          <div className="flex items-stretch rounded-xl overflow-hidden" style={{ border: `0.5px solid ${A.gray5}` }}>
            {/* LEFT — 历史拟合度 */}
            <div className="flex-1 min-w-0 p-3" style={{ background: "rgba(0,113,227,0.02)", borderRight: `1px dashed ${A.gray4}` }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold" style={{ color: A.blue }}>① 历史拟合 · 模型在 24 个月真实数据上的表现</span>
                <span className="text-[10px]" style={{ color: A.gray1 }}>2024-06 ~ 2026-05</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={historyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="0" stroke="rgba(0,0,0,0.05)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} interval={2} />
                  <YAxis domain={yDomain} tick={{ fontSize: 11, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} width={42} />
                  <Tooltip content={<AppleTooltip />} />
                  <Line type="monotone" dataKey="actual" name="实际" stroke={A.blue} strokeWidth={2}
                    dot={{ r: 2.5, fill: A.blue, strokeWidth: 0 }}
                    activeDot={{ r: 4.5, fill: A.blue, stroke: A.white, strokeWidth: 2 }}
                    isAnimationActive={false} />
                  <Line type="monotone" dataKey="fitted" name="拟合" stroke={A.green} strokeWidth={1.5}
                    strokeDasharray="3 3" dot={false} connectNulls
                    isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-1 text-[10px]" style={{ color: A.gray1 }}>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5" style={{ background: A.blue }} />实际销量</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0" style={{ borderTop: `1.5px dashed ${A.green}` }} />模型拟合</span>
                <span className="ml-auto">MAPE <span className="font-semibold" style={{ color: A.green }}>{result.mape.toFixed(1)}%</span></span>
              </div>
            </div>

            {/* RIGHT — 未来预测 */}
            <div className="p-3" style={{ background: "rgba(255,149,0,0.03)", width: `${Math.max(24, (horizon / (24 + horizon)) * 100 + 10)}%`, minWidth: 220 }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold" style={{ color: A.orange }}>② 未来 {horizon} 月预测 · 含 95% 置信带</span>
                <span className="text-[10px]" style={{ color: A.gray1 }}>{FUTURE_LABEL(0)} ~ {FUTURE_LABEL(horizon - 1)}</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={forecastChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ciG2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={A.orange} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={A.orange} stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="0" stroke="rgba(0,0,0,0.05)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
                  <YAxis domain={yDomain} tick={{ fontSize: 11, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} width={42} />
                  <Tooltip content={<AppleTooltip />} />
                  <Area type="monotone" dataKey="lower"      stackId="ci2" stroke="none" fill="transparent" isAnimationActive={false} legendType="none" />
                  <Area type="monotone" dataKey="bandHeight" stackId="ci2" name="95% 区间" stroke="none" fill="url(#ciG2)" isAnimationActive={false} />
                  <Line type="monotone" dataKey="forecast" name="预测" stroke={A.orange} strokeWidth={2.5}
                    strokeDasharray="6 4"
                    dot={{ r: 3.5, fill: A.white, strokeWidth: 2, stroke: A.orange }}
                    activeDot={{ r: 5, fill: A.orange, stroke: A.white, strokeWidth: 2 }}
                    isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-1 text-[10px]" style={{ color: A.gray1 }}>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0" style={{ borderTop: `2px dashed ${A.orange}` }} />预测中位</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-2 rounded-sm" style={{ background: `${A.orange}33` }} />95% 置信带</span>
              </div>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]" style={{ color: A.gray1 }}>
            <div><span style={{ color: A.blue, fontWeight: 500 }}>实际</span> 真实销量历史值,模型的训练原料</div>
            <div><span style={{ color: A.green, fontWeight: 500 }}>拟合</span> 模型对历史的"反推",越贴合实际越好</div>
            <div><span style={{ color: A.orange, fontWeight: 500 }}>预测</span> 模型对未来的外推 ± 1.96σ 置信带</div>
          </div>

          {/* AI consensus banner */}
          <div className="mt-4 rounded-xl p-3 flex items-center gap-3"
            style={{ background: aiSuggestsDifferent ? "#fff8f0" : "#f0faf4", border: `1px solid ${aiSuggestsDifferent ? A.orange : A.green}30` }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `linear-gradient(135deg, ${A.blue} 0%, #34aadc 100%)` }}>
              <Sparkles size={12} className="text-white" />
            </div>
            <div className="flex-1 text-[11px]" style={{ color: A.label }}>
              {aiSuggestsDifferent ? (
                <>
                  <span className="font-semibold">AI 推荐切换至 {METHOD_LABEL[champion.method]}</span>
                  ：在交叉验证中 MAPE 为 <span className="font-semibold" style={{ color: A.green }}>{champion.mape.toFixed(1)}%</span>，
                  优于当前模型 {(result.mape - champion.mape).toFixed(1)} 个百分点。
                </>
              ) : (
                <><span className="font-semibold">当前已是 5 模型基准中的最优解。</span> 可直接应用此预测进入 S&OP。</>
              )}
            </div>
            {aiSuggestsDifferent && (
              <button onClick={applyAI}
                className="text-[11px] px-3 py-1.5 rounded-lg font-medium text-white shrink-0 hover:opacity-90 transition-opacity"
                style={{ background: A.blue }}>采纳建议</button>
            )}
          </div>
        </Card>
      </div>

      {/* Scenario + benchmark + reconciliation */}
      <div className="grid grid-cols-3 gap-3">
        {/* Scenario planning */}
        <Card className="p-5">
          <SectionHeader title="情景规划 (What-If)" />
          <div className="space-y-1.5">
            {([
              { id: "pess", label: "悲观",   note: "-12% · 经济下行 / 客户流失", color: A.red    },
              { id: "base", label: "基准",   note: "模型基线",                    color: A.blue   },
              { id: "opt",  label: "乐观",   note: "+12% · 大客户中标 / 市场扩张", color: A.green  },
            ] as const).map((s) => (
              <button key={s.id} onClick={() => setScenario(s.id)}
                className="w-full text-left p-3 rounded-xl transition-all flex items-center gap-3"
                style={{
                  background: scenario === s.id ? `${s.color}12` : A.gray6,
                  border: `1px solid ${scenario === s.id ? s.color + "40" : "transparent"}`,
                }}>
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color }} />
                <div className="flex-1">
                  <div className="text-xs font-semibold" style={{ color: A.label }}>{s.label}情景</div>
                  <div className="text-[10px]" style={{ color: A.sub }}>{s.note}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-5">
            <div className="flex justify-between text-[11px] mb-1">
              <span style={{ color: A.sub }}>促销/活动叠加</span>
              <span className="font-medium tabular-nums" style={{ color: promoLift >= 0 ? A.green : A.red }}>
                {promoLift >= 0 ? "+" : ""}{promoLift}%
              </span>
            </div>
            <input type="range" min={-30} max={50} step={5} value={promoLift}
              onChange={(e) => setPromoLift(parseInt(e.target.value))}
              className="w-full h-1 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: A.purple }} />
            <div className="flex justify-between text-[9px] mt-1" style={{ color: A.gray2 }}>
              <span>-30%</span><span>基线</span><span>+50%</span>
            </div>
          </div>
        </Card>

        {/* Model benchmark */}
        <Card className="p-5">
          <SectionHeader title="模型对比 (Champion / Challenger)" />
          <div className="space-y-2">
            {benchmark.map((b, i) => {
              const max = Math.max(...benchmark.map((x) => x.mape));
              const isCurrent = b.method === method;
              const isChamp = i === 0;
              return (
                <div key={b.method}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] w-4" style={{ color: A.gray2 }}>{i + 1}</span>
                    <span className="text-xs flex-1 truncate" style={{ color: isCurrent ? A.blue : A.label, fontWeight: isCurrent ? 600 : 500 }}>
                      {METHOD_LABEL[b.method]}
                    </span>
                    {isChamp && <span className="text-[9px] px-1.5 py-px rounded-full font-semibold" style={{ background: "#f0faf4", color: A.green }}>BEST</span>}
                    {isCurrent && !isChamp && <span className="text-[9px] px-1.5 py-px rounded-full font-semibold" style={{ background: "#f0f6ff", color: A.blue }}>当前</span>}
                  </div>
                  <div className="flex items-center gap-2 pl-6">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: A.gray5 }}>
                      <div className="h-full rounded-full" style={{ width: `${(b.mape / max) * 100}%`, background: isChamp ? A.green : isCurrent ? A.blue : A.gray3 }} />
                    </div>
                    <span className="text-[11px] tabular-nums w-12 text-right" style={{ color: A.sub }}>{b.mape.toFixed(1)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 text-[10px]" style={{ color: A.gray2, borderTop: "0.5px solid rgba(0,0,0,0.06)" }}>
            交叉验证：留最后 6 个月作为测试集
          </div>
        </Card>

        {/* AI insights for current SKU */}
        <Card className="p-5">
          <SectionHeader title="AI 关键发现"
            right={<span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "#f0f6ff", color: A.blue }}>实时</span>} />
          <div className="space-y-2.5">
            {[
              {
                t: "info" as const,
                title: "强季节性 (γ 推荐 0.25)",
                body: `检出年度季节因子峰值 +${(Math.max(...sku.history) / (sku.history.reduce((a, b) => a + b, 0) / 24) - 1).toFixed(2)}x，建议 γ ≥ 0.20。`,
              },
              {
                t: stockoutMonths > 0 ? "risk" : "info" as const,
                title: stockoutMonths > 0 ? `${stockoutMonths} 个月断货风险` : "供需平衡",
                body: stockoutMonths > 0
                  ? `当前在手 ${sku.onHand} + 在途 ${sku.open}，未来 ${horizon} 月需求超出 ${totalGap.toLocaleString()} ${sku.unit}。`
                  : `在手 ${sku.onHand} + 在途 ${sku.open} 充足覆盖未来 ${horizon} 月需求。`,
              },
              {
                t: "action" as const,
                title: totalGap > 0 ? `建议追加采购 ${Math.ceil(totalGap * 1.1).toLocaleString()} ${sku.unit}` : "无需追加采购",
                body: totalGap > 0 ? `含 10% 安全库存系数，AI 建议于本月末前下单以避免断货。` : `当前计划已满足安全库存要求。`,
              },
            ].map((it, i) => {
              const m = insightMeta[it.t];
              const Icon = m.icon;
              return (
                <div key={i} className="rounded-xl p-3" style={{ background: m.bg }}>
                  <div className="flex items-start gap-2">
                    <Icon size={11} style={{ color: m.color }} className="mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <div className="text-[11px] font-semibold" style={{ color: A.label }}>{it.title}</div>
                      <div className="text-[10px] mt-0.5 leading-relaxed" style={{ color: A.sub }}>{it.body}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Inventory planning: Service Level + Safety Stock + Forecastability */}
      {(() => {
        const xyz = xyzClass(sku.history);
        const mean = sku.history.reduce((a, b) => a + b, 0) / sku.history.length;
        const std = Math.sqrt(sku.history.reduce((s, v) => s + (v - mean) ** 2, 0) / sku.history.length);
        const z = zScore(serviceLevel);
        const leadMonths = leadTimeDays / 30;
        // Safety Stock = z × σ_d × √L  (Browne's formula, demand variability dominant)
        const safetyStock = Math.ceil(z * std * Math.sqrt(leadMonths));
        const cycleStock  = Math.ceil(mean * leadMonths);
        const reorderPoint = Math.ceil(mean * leadMonths + safetyStock);
        const eoq = Math.ceil(Math.sqrt((2 * mean * 12 * 800) / (50 * 0.25))); // Wilson EOQ, K=800 setup, h=50*0.25
        const fillRate = serviceLevel; // simplified — assume CSL ≈ Fill Rate for illustration

        return (
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-5">
              <SectionHeader title="服务水平与安全库存"
                right={<span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{ background: "#eef0ff", color: A.indigo }}>z = {z.toFixed(2)}</span>} />

              <Field label={`服务水平 (CSL)`}>
                <div className="grid grid-cols-6 gap-1">
                  {([85, 90, 95, 97, 98, 99] as const).map((s) => (
                    <button key={s} onClick={() => setServiceLevel(s)}
                      className="text-[11px] py-1.5 rounded-md font-medium transition-colors"
                      style={{
                        background: serviceLevel === s ? A.blue : A.gray6,
                        color: serviceLevel === s ? A.white : A.gray1,
                      }}>{s}%</button>
                  ))}
                </div>
              </Field>

              <div className="mt-4">
                <div className="flex justify-between text-[11px] mb-1">
                  <span style={{ color: A.sub }}>采购提前期 (L)</span>
                  <span className="font-medium tabular-nums" style={{ color: A.label }}>{leadTimeDays} 天</span>
                </div>
                <input type="range" min={3} max={45} step={1} value={leadTimeDays}
                  onChange={(e) => setLeadTimeDays(parseInt(e.target.value))}
                  className="w-full h-1 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: A.blue }} />
              </div>

              <div className="mt-5 pt-4 space-y-2" style={{ borderTop: "0.5px solid rgba(0,0,0,0.06)" }}>
                {[
                  { k: "需求均值 (μ)",   v: `${Math.round(mean).toLocaleString()} ${sku.unit}/月` },
                  { k: "需求标准差 (σ)", v: `${Math.round(std).toLocaleString()} ${sku.unit}/月` },
                  { k: "周期库存",       v: `${cycleStock.toLocaleString()} ${sku.unit}`, hl: A.label },
                  { k: "安全库存 SS",    v: `${safetyStock.toLocaleString()} ${sku.unit}`, hl: A.orange },
                  { k: "再订货点 ROP",   v: `${reorderPoint.toLocaleString()} ${sku.unit}`, hl: A.blue },
                  { k: "经济订货量 EOQ", v: `${eoq.toLocaleString()} ${sku.unit}`, hl: A.purple },
                  { k: "预计填充率",     v: `${fillRate}%`, hl: A.green },
                ].map((r) => (
                  <div key={r.k} className="flex justify-between text-xs">
                    <span style={{ color: A.sub }}>{r.k}</span>
                    <span className="font-medium tabular-nums" style={{ color: r.hl || A.label }}>{r.v}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-lg p-2.5 text-[10px] leading-relaxed" style={{ background: "#f0f6ff", color: A.sub }}>
                <span style={{ color: A.label, fontWeight: 600 }}>SS = z × σ × √L</span>
                {" "}· EOQ = √(2DK/h) · ROP = μL + SS
              </div>
            </Card>

            <Card className="p-5">
              <SectionHeader title="可预测性诊断 (XYZ)" />
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-semibold"
                  style={{ background: `${xyz.color}18`, color: xyz.color }}>{xyz.cls}</div>
                <div className="flex-1">
                  <div className="text-xs font-semibold" style={{ color: A.label }}>{xyz.note}</div>
                  <div className="text-[10px]" style={{ color: A.sub }}>变异系数 CoV = {xyz.cov.toFixed(2)}</div>
                </div>
              </div>

              <div className="space-y-2 mt-3">
                {([
                  { c: "X", min: "0", max: "0.25", note: "稳定 · 自动补货", color: A.green },
                  { c: "Y", min: "0.25", max: "0.50", note: "波动 · 半月预测", color: A.orange },
                  { c: "Z", min: "0.50", max: "∞", note: "不规则 · 按订单生产", color: A.red },
                ] as const).map((row) => (
                  <div key={row.c} className="flex items-center gap-2 p-2 rounded-lg"
                    style={{ background: xyz.cls === row.c ? `${row.color}10` : A.gray6 }}>
                    <span className="text-[11px] font-semibold w-4" style={{ color: row.color }}>{row.c}</span>
                    <span className="text-[10px] tabular-nums w-20" style={{ color: A.sub }}>CoV {row.min}–{row.max}</span>
                    <span className="text-[10px]" style={{ color: A.label }}>{row.note}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-3 text-[10px] leading-relaxed" style={{ color: A.gray2, borderTop: "0.5px solid rgba(0,0,0,0.06)" }}>
                结合 ABC 价值分类形成 9 宫格策略矩阵：AX 高价值稳定品 100% 自动补货，CZ 低价值不规则品按需采购。
              </div>
            </Card>

            <Card className="p-5">
              <SectionHeader title="预测准确度 SLA 趋势" />
              <ResponsiveContainer width="100%" height={140}>
                <ComposedChart data={Array.from({ length: 12 }, (_, i) => ({
                  m: `${(i + 1)}月`,
                  mape: 6 + Math.sin(i * 0.7) * 3 + Math.random() * 2,
                  target: 10,
                }))} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="0" stroke="rgba(0,0,0,0.05)" vertical={false} />
                  <XAxis dataKey="m" tick={{ fontSize: 9, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} width={28} tickFormatter={(v) => `${v}%`} />
                  <Tooltip content={<AppleTooltip />} />
                  <Line type="monotone" dataKey="target" name="SLA 目标" stroke={A.red} strokeWidth={1} strokeDasharray="4 3" dot={false} />
                  <Line type="monotone" dataKey="mape"   name="实际 MAPE" stroke={A.blue} strokeWidth={2} dot={{ r: 2.5, fill: A.white, strokeWidth: 1.5, stroke: A.blue }} />
                </ComposedChart>
              </ResponsiveContainer>

              <div className="grid grid-cols-3 gap-2 mt-3">
                {[
                  { l: "12个月均值", v: "7.8%", c: A.green },
                  { l: "SLA 达成率", v: "92%",   c: A.green },
                  { l: "偏差天数",   v: "1/30",  c: A.orange },
                ].map((m) => (
                  <div key={m.l} className="rounded-lg p-2" style={{ background: A.gray6 }}>
                    <div className="text-[9px]" style={{ color: A.gray2 }}>{m.l}</div>
                    <div className="text-sm font-semibold tabular-nums" style={{ color: m.c }}>{m.v}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        );
      })()}

      {/* Demand-Supply Reconciliation */}
      <Card>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: A.label }}>需求 — 供给对账 (S&OP)</h2>
            <p className="text-[11px] mt-0.5" style={{ color: A.sub }}>
              起始在手 {sku.onHand.toLocaleString()} {sku.unit} · 待入库 {sku.open.toLocaleString()} {sku.unit}
            </p>
          </div>
          <button onClick={commitPlan} disabled={committed}
            className="text-xs px-4 py-2 rounded-xl font-medium text-white flex items-center gap-1.5 transition-opacity hover:opacity-90"
            style={{ background: committed ? A.green : A.blue, opacity: committed ? 0.7 : 1 }}>
            {committed ? <><CheckCircle2 size={12} /> 已发布 MRP</> : <><FileCheck2 size={12} /> 发布共识需求计划</>}
          </button>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["月份", "预测需求", "计划入库", "期末库存", "缺口", "覆盖月数", "风险", "AI 建议"].map((h) => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reconciliation.map((row, i) => {
              const riskColor = row.risk === "高" ? A.red : row.risk === "中" ? A.orange : A.green;
              return (
                <tr key={i} className="hover:bg-blue-50/40 transition-colors"
                  style={{ borderBottom: i < reconciliation.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                  <td className="px-5 py-3 font-medium" style={{ color: A.label }}>{row.month}</td>
                  <td className="px-5 py-3 tabular-nums" style={{ color: A.label }}>{row.demand.toLocaleString()}</td>
                  <td className="px-5 py-3 tabular-nums" style={{ color: row.inbound > 0 ? A.blue : A.gray3 }}>{row.inbound > 0 ? "+" + row.inbound.toLocaleString() : "—"}</td>
                  <td className="px-5 py-3 tabular-nums font-semibold" style={{ color: row.ending < 0 ? A.red : A.label }}>{row.ending.toLocaleString()}</td>
                  <td className="px-5 py-3 tabular-nums font-medium" style={{ color: row.gap > 0 ? A.red : A.gray3 }}>{row.gap > 0 ? row.gap.toLocaleString() : "—"}</td>
                  <td className="px-5 py-3 tabular-nums" style={{ color: A.sub }}>{row.cover.toFixed(1)}</td>
                  <td className="px-5 py-3"><StatusPill status={row.risk === "高" ? "不足" : row.risk === "中" ? "预警" : "正常"} /></td>
                  <td className="px-5 py-3" style={{ color: riskColor }}>
                    {row.risk === "高" ? `紧急补货 +${Math.ceil(row.gap * 1.1).toLocaleString()}`
                      : row.risk === "中" ? "提前下单" : "维持现状"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// Legacy forecast block removed in favor of S&OP engine above
function _ForecastLegacy_Unused() {
  return (
    <div style={{ display: "none" }}>
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="Q1 预测营收" value="¥3.09亿" sub="1—3月 (信心 91%)" delta="+12.8% YoY" positive icon={TrendingUp} color={A.blue} />
        <KpiCard label="预测准确率" value="94.2%" sub="MAPE 5.8%" icon={Activity} color={A.green} />
        <KpiCard label="需补货品种" value="342" sub="未来 30 天" delta="+24 vs 上期" positive={false} icon={AlertTriangle} color={A.red} />
        <KpiCard label="模型更新" value="2h 前" sub="持续学习中" icon={Clock} color={A.purple} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="col-span-2 p-5">
          <SectionHeader title="营收预测 vs 实际（含置信区间）"
            right={<div className="flex items-center gap-4 text-xs" style={{ color: A.sub }}>
              <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-0.5 rounded" style={{ background: A.blue }} />实际</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-0.5 rounded border-dashed" style={{ borderTop: `2px dashed ${A.orange}` }} />预测</span>
            </div>}
          />
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={forecastData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="confG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={A.orange} stopOpacity={0.1} />
                  <stop offset="100%" stopColor={A.orange} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="0" stroke="rgba(0,0,0,0.05)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1e4}万`} width={48} />
              <Tooltip content={<AppleTooltip />} />
              <Area type="monotone" dataKey="upper" name="上限" stroke="none" fill="url(#confG)" />
              <Area type="monotone" dataKey="lower" name="下限" stroke="none" fill="white" />
              <Line type="monotone" dataKey="actual" name="实际" stroke={A.blue} strokeWidth={2.5} dot={{ r: 3.5, fill: A.white, strokeWidth: 2, stroke: A.blue }} connectNulls={false} />
              <Line type="monotone" dataKey="forecast" name="预测" stroke={A.orange} strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3, fill: A.white, strokeWidth: 2, stroke: A.orange }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <SectionHeader title="季度预测" />
          <div className="space-y-4">
            {[
              { q: "Q3 2026", revenue: "¥3.09亿", conf: 91 },
              { q: "Q4 2026", revenue: "¥3.56亿", conf: 84 },
              { q: "Q1 2027", revenue: "¥3.84亿", conf: 76 },
              { q: "Q2 2027", revenue: "¥4.21亿", conf: 68 },
            ].map((row) => (
              <div key={row.q}>
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-xs font-medium" style={{ color: A.label }}>{row.q}</span>
                  <span className="text-sm font-semibold" style={{ color: A.blue }}>{row.revenue}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: A.gray5 }}>
                    <div className="h-full rounded-full" style={{ width: `${row.conf}%`, background: A.orange }} />
                  </div>
                  <span className="text-[11px] w-14 text-right" style={{ color: A.gray1 }}>置信 {row.conf}%</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <div className="px-5 py-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>30 天补货优先级</h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["品名", "当前库存", "预测消耗", "可用天数", "建议采购量", "建议时间", "预估金额", "紧迫度"].map((h) => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { name: "控制器主板 V3.2",  qty: 12,  consume: 48,  days: 7,  suggest: 60,  when: "立即",   cost: "¥72万", urgency: "不足" },
              { name: "伺服电机 750W",     qty: 34,  consume: 120, days: 8,  suggest: 150, when: "立即",   cost: "¥45万", urgency: "不足" },
              { name: "铝合金型材 6063",   qty: 148, consume: 620, days: 7,  suggest: 800, when: "48h 内", cost: "¥28万", urgency: "不足" },
              { name: "液压油缸 50mm",     qty: 67,  consume: 140, days: 14, suggest: 120, when: "本周内", cost: "¥31万", urgency: "预警" },
              { name: "密封垫片 φ80",      qty: 520, consume: 900, days: 17, suggest: 600, when: "本周内", cost: "¥9万",  urgency: "预警" },
            ].map((row, i) => (
              <tr key={row.name} className="hover:bg-blue-50/40 transition-colors"
                style={{ borderBottom: i < 4 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-5 py-3.5 font-medium" style={{ color: A.label }}>{row.name}</td>
                <td className="px-5 py-3.5" style={{ color: A.label }}>{row.qty}</td>
                <td className="px-5 py-3.5" style={{ color: A.sub }}>{row.consume}</td>
                <td className="px-5 py-3.5 font-semibold" style={{ color: row.days <= 10 ? A.red : A.orange }}>{row.days} 天</td>
                <td className="px-5 py-3.5 font-medium" style={{ color: A.green }}>{row.suggest}</td>
                <td className="px-5 py-3.5 font-medium" style={{ color: A.label }}>{row.when}</td>
                <td className="px-5 py-3.5 font-medium" style={{ color: A.orange }}>{row.cost}</td>
                <td className="px-5 py-3.5"><StatusPill status={row.urgency} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function ProcurementPanel() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="年度采购总额" value="¥3.41亿" sub="2026 YTD" delta="+9.2% YoY" positive={false} icon={DollarSign} color={A.blue} />
        <KpiCard label="活跃供应商" value="248" sub="较去年 +12 家" delta="+5.1%" positive icon={Truck} color={A.green} />
        <KpiCard label="平均交期" value="8.4天" sub="日历日" delta="-1.2天" positive icon={Clock} color={A.orange} />
        <KpiCard label="合同履约率" value="97.1%" sub="年度综合" delta="+0.8pts" positive icon={CheckCircle2} color={A.teal} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-5">
          <SectionHeader title="采购费用分布" />
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={procurementData} cx="50%" cy="50%" innerRadius={44} outerRadius={70} dataKey="amount" paddingAngle={2.5}>
                {procurementData.map((_, i) => <Cell key={i} fill={pieColors[i]} />)}
              </Pie>
              <Tooltip content={<AppleTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {procurementData.map((d, i) => (
              <div key={d.category} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-sm" style={{ background: pieColors[i] }} />
                  <span style={{ color: A.label }}>{d.category}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span style={{ color: d.yoy > 0 ? A.red : A.green }} className="font-medium">
                    {d.yoy > 0 ? "+" : ""}{d.yoy}%
                  </span>
                  <span className="font-medium" style={{ color: A.sub, minWidth: 48, textAlign: "right" }}>{fmt(d.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="col-span-2 p-5">
          <SectionHeader title="月度支出 vs 预算"
            right={<div className="flex items-center gap-4 text-xs" style={{ color: A.sub }}>
              <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: A.gray4 }} />预算</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: A.orange }} />实际</span>
            </div>}
          />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyProcurement} barGap={3} barSize={18} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="0" stroke="rgba(0,0,0,0.05)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1e4}万`} width={44} />
              <Tooltip content={<AppleTooltip />} cursor={{ fill: "rgba(0,0,0,0.02)", radius: 6 }} />
              <Bar dataKey="budget" name="预算" fill={A.gray4} radius={[4, 4, 0, 0]} />
              <Bar dataKey="amount" name="实际" fill={A.orange} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card>
        <div className="px-5 py-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>供应商排名</h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["#", "供应商", "品类", "年采购额", "订单数", "准时交付", "质量合格", "评级", "趋势"].map((h) => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {supplierData.map((row, i) => (
              <tr key={row.rank} className="hover:bg-blue-50/40 transition-colors"
                style={{ borderBottom: i < supplierData.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-5 py-3.5 font-medium" style={{ color: A.gray2 }}>{row.rank}</td>
                <td className="px-5 py-3.5 font-medium" style={{ color: A.label }}>{row.name}</td>
                <td className="px-5 py-3.5" style={{ color: A.sub }}>{row.cat}</td>
                <td className="px-5 py-3.5 font-semibold" style={{ color: A.blue }}>{fmt(row.amount)}</td>
                <td className="px-5 py-3.5" style={{ color: A.label }}>{row.orders}</td>
                <td className="px-5 py-3.5" style={{ color: row.ontime < 95 ? A.red : A.label }}>{row.ontime}%</td>
                <td className="px-5 py-3.5" style={{ color: row.quality < 95 ? A.red : A.label }}>{row.quality}%</td>
                <td className="px-5 py-3.5">
                  <Chip
                    label={row.grade}
                    color={row.grade === "S" ? A.purple : row.grade === "A" ? A.blue : A.orange}
                    bg={row.grade === "S" ? "#f8f0ff" : row.grade === "A" ? "#f0f6ff" : "#fff8f0"}
                  />
                </td>
                <td className="px-5 py-3.5">
                  {row.trend === "up"     && <ArrowUpRight   size={14} style={{ color: A.green }} />}
                  {row.trend === "down"   && <ArrowDownRight size={14} style={{ color: A.red }}   />}
                  {row.trend === "stable" && <Minus          size={14} style={{ color: A.gray2 }} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Catalog (for new PO line items) ─────────────────────────────────────────
const SKU_CATALOG = [
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

const SUPPLIER_LIST = ["深圳新元电气", "华东精工机械", "江苏铝合金集团", "佛山标准件", "广州化工耗材", "上海仪表科技"];
const OWNERS = ["陈思远", "李婷", "王志强", "周浩"];

// ─── Modal Primitive ─────────────────────────────────────────────────────────
function Modal({ open, onClose, title, subtitle, width = 560, children, footer }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string;
  width?: number; children: React.ReactNode; footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.32)", backdropFilter: "blur(10px)" }}
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl flex flex-col max-h-[88vh] overflow-hidden"
        style={{ width, boxShadow: "0 24px 60px rgba(0,0,0,0.24), 0 0 0 0.5px rgba(0,0,0,0.08)" }}>
        <div className="px-6 pt-5 pb-4 flex items-start justify-between" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <div>
            <h3 className="text-base font-semibold tracking-tight" style={{ color: A.label }}>{title}</h3>
            {subtitle && <p className="text-xs mt-0.5" style={{ color: A.sub }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
            style={{ color: A.gray1 }}>
            <X size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-auto px-6 py-5">{children}</div>
        {footer && <div className="px-6 py-4 flex items-center justify-end gap-2"
          style={{ borderTop: "0.5px solid rgba(0,0,0,0.06)", background: A.gray6 }}>{footer}</div>}
      </div>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-medium" style={{ color: A.sub }}>{label}</label>
      {children}
      {hint && <p className="text-[10px]" style={{ color: A.gray2 }}>{hint}</p>}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: 8, fontSize: 13, color: A.label,
  background: A.white, border: `0.5px solid ${A.gray4}`, outline: "none",
};

// ─── New PO Modal ────────────────────────────────────────────────────────────
function NewPOModal({ open, onClose, onCreate }: {
  open: boolean; onClose: () => void;
  onCreate: (po: typeof purchaseOrders[number]) => void;
}) {
  const [supplier, setSupplier] = useState(SUPPLIER_LIST[0]);
  const [owner, setOwner] = useState(OWNERS[0]);
  const [priority, setPriority] = useState<"高" | "中" | "低">("中");
  const [eta, setEta] = useState("6月03日");
  const [lines, setLines] = useState<{ sku: string; qty: number }[]>([{ sku: SKU_CATALOG[0].sku, qty: 10 }]);
  const [submitting, setSubmitting] = useState(false);

  const total = useMemo(() => lines.reduce((s, l) => {
    const c = SKU_CATALOG.find((x) => x.sku === l.sku);
    return s + (c ? c.price * l.qty : 0);
  }, 0), [lines]);

  function addLine() { setLines([...lines, { sku: SKU_CATALOG[0].sku, qty: 1 }]); }
  function removeLine(i: number) { setLines(lines.filter((_, idx) => idx !== i)); }
  function updateLine(i: number, patch: Partial<{ sku: string; qty: number }>) {
    setLines(lines.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }

  function reset() {
    setSupplier(SUPPLIER_LIST[0]); setOwner(OWNERS[0]); setPriority("中");
    setEta("6月03日"); setLines([{ sku: SKU_CATALOG[0].sku, qty: 10 }]);
  }

  function submit(asDraft: boolean) {
    if (lines.length === 0) { toast.error("请至少添加一行物料"); return; }
    if (lines.some((l) => l.qty <= 0)) { toast.error("数量必须大于 0"); return; }
    setSubmitting(true);
    setTimeout(() => {
      const po = {
        po: `PO-2026-${1288 + Math.floor(Math.random() * 50)}`,
        supplier, owner, priority, eta,
        created: "5月27日",
        amount: total,
        items: lines.length,
        received: 0,
        status: (asDraft ? "草稿" : "待审批") as POStatus,
        paid: false,
      };
      onCreate(po);
      setSubmitting(false);
      reset();
      onClose();
      toast.success(asDraft ? `${po.po} 已保存为草稿` : `${po.po} 已提交审批`, {
        description: `${supplier} · ${fmt(total)} · ${lines.length} 行物料`,
      });
    }, 600);
  }

  return (
    <Modal open={open} onClose={onClose} width={720}
      title="新建采购订单" subtitle="填写供应商、明细行与到期日，系统将自动生成 PO 编号"
      footer={
        <>
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ background: A.white, color: A.label, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.1)" }}>取消</button>
          <button onClick={() => submit(true)} disabled={submitting}
            className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ background: A.gray5, color: A.label }}>存为草稿</button>
          <button onClick={() => submit(false)} disabled={submitting}
            className="text-xs px-3 py-1.5 rounded-lg font-medium text-white flex items-center gap-1.5"
            style={{ background: A.blue, opacity: submitting ? 0.6 : 1 }}>
            {submitting ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
            提交审批
          </button>
        </>
      }>
      <div className="grid grid-cols-2 gap-4 mb-5">
        <Field label="供应商 *">
          <select value={supplier} onChange={(e) => setSupplier(e.target.value)} style={inputStyle}>
            {SUPPLIER_LIST.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="负责人 *">
          <select value={owner} onChange={(e) => setOwner(e.target.value)} style={inputStyle}>
            {OWNERS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="期望到货日 *">
          <input value={eta} onChange={(e) => setEta(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="优先级">
          <div className="flex gap-1.5">
            {(["高", "中", "低"] as const).map((p) => (
              <button key={p} onClick={() => setPriority(p)}
                className="flex-1 text-xs py-2 rounded-lg font-medium transition-colors"
                style={{
                  background: priority === p ? (p === "高" ? "#fff1f0" : p === "中" ? "#fff8f0" : A.gray6) : A.white,
                  color: priority === p ? (p === "高" ? A.red : p === "中" ? A.orange : A.gray1) : A.gray1,
                  boxShadow: `0 0 0 0.5px ${priority === p ? (p === "高" ? A.red : p === "中" ? A.orange : A.gray3) : A.gray4}`,
                }}>{p}</button>
            ))}
          </div>
        </Field>
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold" style={{ color: A.label }}>明细行 ({lines.length})</span>
        <button onClick={addLine} className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-md font-medium"
          style={{ background: "#f0f6ff", color: A.blue }}>
          <Plus size={11} /> 添加物料
        </button>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: `0.5px solid ${A.gray4}` }}>
        <table className="w-full text-xs">
          <thead style={{ background: A.gray6 }}>
            <tr>
              {["物料", "单价", "数量", "小计", ""].map((h) => (
                <th key={h} className="text-left px-3 py-2 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const c = SKU_CATALOG.find((x) => x.sku === l.sku)!;
              return (
                <tr key={i} style={{ borderTop: "0.5px solid rgba(0,0,0,0.05)" }}>
                  <td className="px-3 py-2">
                    <select value={l.sku} onChange={(e) => updateLine(i, { sku: e.target.value })}
                      style={{ ...inputStyle, padding: "5px 6px", border: "none", background: "transparent" }}>
                      {SKU_CATALOG.map((x) => <option key={x.sku} value={x.sku}>{x.sku} · {x.name}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 tabular-nums" style={{ color: A.sub }}>¥{c.price.toLocaleString()}</td>
                  <td className="px-3 py-2 w-24">
                    <input type="number" min={1} value={l.qty}
                      onChange={(e) => updateLine(i, { qty: Math.max(1, parseInt(e.target.value) || 0) })}
                      style={{ ...inputStyle, padding: "4px 8px" }} />
                  </td>
                  <td className="px-3 py-2 tabular-nums font-medium" style={{ color: A.label }}>
                    ¥{(c.price * l.qty).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 w-10">
                    <button onClick={() => removeLine(i)} disabled={lines.length === 1}
                      className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-red-50 transition-colors"
                      style={{ color: lines.length === 1 ? A.gray3 : A.red }}>
                      <Trash2 size={11} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 px-2">
        <span className="text-xs" style={{ color: A.sub }}>
          合计 {lines.length} 行 · 数量 {lines.reduce((s, l) => s + l.qty, 0)}
        </span>
        <div className="text-right">
          <div className="text-[10px]" style={{ color: A.gray2 }}>订单总额</div>
          <div className="text-xl font-semibold tracking-tight" style={{ color: A.blue }}>{fmt(total)}</div>
        </div>
      </div>

      {total > 1500000 && (
        <div className="mt-4 rounded-xl p-3 flex gap-3" style={{ background: "#fff8f0" }}>
          <AlertCircle size={14} style={{ color: A.orange }} className="shrink-0 mt-0.5" />
          <div className="text-[11px]" style={{ color: A.label }}>
            订单金额超过 ¥150 万，需财务总监会签且附 ≥ 2 家比价记录。
            <span style={{ color: A.orange }}>提交后将进入二级审批流。</span>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Track Shipment Modal ────────────────────────────────────────────────────
function TrackShipmentModal({ open, onClose, po }: {
  open: boolean; onClose: () => void; po: typeof purchaseOrders[number] | null;
}) {
  if (!po) return null;
  const steps = [
    { label: "供应商确认", time: "5月26日 10:14", done: true,                                                  loc: po.supplier },
    { label: "已发货",     time: "5月26日 16:48", done: po.status !== "草稿" && po.status !== "待审批" && po.status !== "已审批", loc: "供应商出库口" },
    { label: "运输中",     time: "5月27日 03:22", done: ["部分到货", "已完成"].includes(po.status),              loc: "G42 京沪高速 · 距 280km" },
    { label: "抵达月台",   time: po.eta + " 09:00", done: ["部分到货", "已完成"].includes(po.status),             loc: "Dock-02" },
    { label: "完成签收",   time: po.eta + " 11:30", done: po.status === "已完成",                                loc: "WMS 入库完成" },
  ];
  return (
    <Modal open={open} onClose={onClose} title={`物流跟踪 · ${po.po}`} subtitle={`${po.supplier} · ${fmt(po.amount)}`}>
      <div className="space-y-0">
        {steps.map((s, i) => (
          <div key={i} className="flex gap-4 pb-5">
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ background: s.done ? A.green : A.gray5, color: A.white }}>
                {s.done ? <Check size={13} /> : <Loader2 size={11} className={i === steps.findIndex((x) => !x.done) ? "animate-spin" : ""} />}
              </div>
              {i < steps.length - 1 && (
                <div className="w-px flex-1 mt-1" style={{ background: s.done ? A.green : A.gray5 }} />
              )}
            </div>
            <div className="flex-1 -mt-0.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: s.done ? A.label : A.gray1 }}>{s.label}</span>
                <span className="text-[11px] tabular-nums" style={{ color: A.gray2 }}>{s.time}</span>
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: A.sub }}>{s.loc}</div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ─── Purchasing Panel ────────────────────────────────────────────────────────
function POStatusPill({ status }: { status: POStatus }) {
  const m = poStatusMeta[status];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ color: m.color, background: m.bg }}>{status}</span>
  );
}

// ─── Purchasing · ERP Data ────────────────────────────────────────────────────
const RFQS: {
  id: string; title: string; category: string; suppliers: number; quoted: number;
  bestPrice: number; bestSupplier: string; due: string; status: "进行中" | "比价中" | "已授标" | "已关闭";
}[] = [
  { id: "RFQ-26-0042", title: "Q3 铝合金型材集采",     category: "原材料",   suppliers: 6, quoted: 5, bestPrice: 18.6,  bestSupplier: "江苏铝合金集团", due: "2026-06-10", status: "比价中" },
  { id: "RFQ-26-0043", title: "标准紧固件年框",         category: "通用件",   suppliers: 8, quoted: 8, bestPrice:  0.42, bestSupplier: "佛山标准件",     due: "2026-05-30", status: "已授标" },
  { id: "RFQ-26-0044", title: "PCB 板代工",              category: "电子",     suppliers: 4, quoted: 3, bestPrice: 86.4,  bestSupplier: "深圳新元电气",   due: "2026-06-15", status: "进行中" },
  { id: "RFQ-26-0045", title: "切削液 12 个月供货",     category: "耗材",     suppliers: 5, quoted: 4, bestPrice: 24.8,  bestSupplier: "广州化工耗材",   due: "2026-06-08", status: "比价中" },
  { id: "RFQ-26-0046", title: "高精度数控刀具",         category: "工具",     suppliers: 3, quoted: 2, bestPrice:312.0,  bestSupplier: "华东精工机械",   due: "2026-06-22", status: "进行中" },
];

const CONTRACTS: {
  id: string; supplier: string; scope: string; commitVol: string; price: string;
  start: string; end: string; consumed: number; status: "执行中" | "即将到期" | "已到期";
}[] = [
  { id: "BPA-26-001", supplier: "深圳新元电气",   scope: "PCB 板 / 控制板",     commitVol: "12,000 件",  price: "目录价 -14%", start: "2026-01-01", end: "2026-12-31", consumed: 0.42, status: "执行中" },
  { id: "BPA-26-002", supplier: "江苏铝合金集团", scope: "6061-T6 型材",         commitVol: "2,400 吨",  price: "RMB 18.60/kg", start: "2026-03-01", end: "2027-02-28", consumed: 0.18, status: "执行中" },
  { id: "BPA-26-003", supplier: "佛山标准件",     scope: "M3~M12 紧固件",        commitVol: "8M 件",     price: "目录价 -22%", start: "2026-04-01", end: "2026-06-30", consumed: 0.76, status: "即将到期" },
  { id: "BPA-25-009", supplier: "广州化工耗材",   scope: "切削液 / 防锈油",      commitVol: "180 吨",    price: "RMB 24.80/L", start: "2025-07-01", end: "2026-06-30", consumed: 0.92, status: "即将到期" },
  { id: "BPA-25-007", supplier: "上海仪表科技",   scope: "测量仪表",             commitVol: "320 台",    price: "目录价 -10%", start: "2025-01-01", end: "2025-12-31", consumed: 1.00, status: "已到期" },
];

const MATCH_QUEUE: {
  id: string; po: string; grn: string; invoice: string; supplier: string;
  poAmt: number; grnAmt: number; invAmt: number; variance: number; status: "已匹配" | "金额差异" | "数量差异" | "待匹配";
}[] = [
  { id: "M-26-0521", po: "PO-2026-0142", grn: "GRN-2026-0521", invoice: "INV-526481", supplier: "江苏铝合金集团", poAmt:  864000, grnAmt:  864000, invAmt:  864000, variance: 0,      status: "已匹配" },
  { id: "M-26-0522", po: "PO-2026-0148", grn: "GRN-2026-0522", invoice: "INV-526482", supplier: "深圳新元电气",   poAmt: 1240000, grnAmt: 1240000, invAmt: 1248600, variance: 8600,   status: "金额差异" },
  { id: "M-26-0523", po: "PO-2026-0151", grn: "GRN-2026-0523", invoice: "INV-526483", supplier: "佛山标准件",     poAmt:  148200, grnAmt:  142400, invAmt:  148200, variance: 5800,   status: "数量差异" },
  { id: "M-26-0524", po: "PO-2026-0156", grn: "GRN-2026-0524", invoice: "INV-526484", supplier: "上海仪表科技",   poAmt:  286400, grnAmt:  286400, invAmt:  286400, variance: 0,      status: "已匹配" },
  { id: "M-26-0525", po: "PO-2026-0162", grn: "—",             invoice: "INV-526485", supplier: "广州化工耗材",   poAmt:  64800,  grnAmt:  0,       invAmt:  64800,  variance: 64800, status: "待匹配" },
];

const PAYABLES: {
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

const PORTAL_SUPPLIERS: {
  name: string; rating: number; onTime: number; quality: number; resp: number; po: number; spend: number; flag: "战略" | "核心" | "备选" | "整改";
}[] = [
  { name: "深圳新元电气",   rating: 4.7, onTime: 96.8, quality: 99.2, resp: 92, po: 28, spend: 8460000, flag: "战略" },
  { name: "江苏铝合金集团", rating: 4.6, onTime: 94.2, quality: 98.6, resp: 88, po: 22, spend: 6240000, flag: "战略" },
  { name: "佛山标准件",     rating: 4.4, onTime: 92.4, quality: 97.8, resp: 90, po: 36, spend: 2840000, flag: "核心" },
  { name: "上海仪表科技",   rating: 4.5, onTime: 95.1, quality: 99.0, resp: 84, po: 14, spend: 1860000, flag: "核心" },
  { name: "广州化工耗材",   rating: 3.8, onTime: 86.4, quality: 94.2, resp: 76, po: 18, spend: 1240000, flag: "整改" },
  { name: "华东精工机械",   rating: 4.2, onTime: 91.6, quality: 97.4, resp: 82, po: 12, spend:  920000, flag: "备选" },
];

// ─── Purchasing · Master Wrapper ──────────────────────────────────────────────
type PurTab = "orders" | "rfq" | "contracts" | "match" | "payment" | "portal";
function PurchasingPanel() {
  const [tab, setTab] = useState<PurTab>("orders");
  const tabs = [
    { id: "orders",    label: "采购订单",   icon: FileText,        count: purchaseOrders.length },
    { id: "rfq",       label: "询价 RFQ",   icon: FileSpreadsheet, count: RFQS.length },
    { id: "contracts", label: "框架合同",   icon: Handshake,       count: CONTRACTS.length },
    { id: "match",     label: "三单匹配",   icon: ShieldCheck,     count: MATCH_QUEUE.length },
    { id: "payment",   label: "付款条款",   icon: CreditCard,      count: PAYABLES.length },
    { id: "portal",    label: "供应商门户", icon: Building2,       count: PORTAL_SUPPLIERS.length },
  ] as const;

  return (
    <div className="space-y-4">
      <SubTabs tabs={tabs as any} value={tab} onChange={(v) => setTab(v as PurTab)} />
      {tab === "orders"    && <PurchasingOrders />}
      {tab === "rfq"       && <PurchasingRFQ />}
      {tab === "contracts" && <PurchasingContracts />}
      {tab === "match"     && <PurchasingMatch />}
      {tab === "payment"   && <PurchasingPayment />}
      {tab === "portal"    && <PurchasingPortal />}
    </div>
  );
}

function PurchasingOrders() {
  const [orders, setOrders] = useState(purchaseOrders);
  const [filter, setFilter] = useState<"全部" | POStatus>("全部");
  const [selectedId, setSelectedId] = useState(orders[1].po);
  const [newOpen, setNewOpen] = useState(false);
  const [trackOpen, setTrackOpen] = useState(false);

  const selectedPO = orders.find((o) => o.po === selectedId) ?? orders[0];
  const filtered = filter === "全部" ? orders : orders.filter((o) => o.status === filter);

  const totalAmount   = orders.reduce((s, o) => s + o.amount, 0);
  const pendingApprov = orders.filter((o) => o.status === "待审批").length;
  const inTransit     = orders.filter((o) => o.status === "已发出" || o.status === "部分到货").length;

  function approve(poId: string) {
    setOrders((arr) => arr.map((o) => o.po === poId ? { ...o, status: "已审批" } : o));
    toast.success(`${poId} 已批准`, { description: "进入发货排程，预计 2 小时内推送至供应商" });
  }
  function reject(poId: string) {
    setOrders((arr) => arr.map((o) => o.po === poId ? { ...o, status: "已取消" } : o));
    toast.error(`${poId} 已驳回`, { description: "请通知采购员补充材料后重新提交" });
  }
  function cancel(poId: string) {
    if (!confirm(`确认取消 ${poId}？此操作不可撤销。`)) return;
    setOrders((arr) => arr.map((o) => o.po === poId ? { ...o, status: "已取消" } : o));
    toast(`${poId} 已取消`);
  }
  function send(poId: string) {
    setOrders((arr) => arr.map((o) => o.po === poId ? { ...o, status: "已发出" } : o));
    toast.success(`${poId} 已下发至供应商`, { description: "等待对方确认排产" });
  }
  function downloadPDF(poId: string) {
    toast(`正在生成 ${poId}.pdf …`, { description: "完成后将自动下载" });
  }

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="本月 PO 总额" value={fmt(totalAmount)} sub={`${purchaseOrders.length} 张订单`} delta="+12.4%" positive={false} icon={FileText}  color={A.blue}   />
        <KpiCard label="待审批" value={String(pendingApprov)}  sub="平均等待 2.4 小时"   delta="+1 vs 昨日" positive={false} icon={AlertCircle} color={A.orange} />
        <KpiCard label="在途订单" value={String(inTransit)}     sub="未来 7 天到货"        delta="¥624 万"     positive icon={Truck}        color={A.teal}   />
        <KpiCard label="本月完成率" value="84.6%" sub="按时交付 / 已完成"     delta="+3.2pts"     positive icon={CheckCircle2} color={A.green}  />
      </div>

      {/* Approval queue + trend */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-5">
          {(() => {
            const pending = orders.filter((o) => o.status === "待审批");
            return (
              <>
                <SectionHeader title="待审批队列"
                  right={<span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                    style={{ background: "#fff8f0", color: A.orange }}>{pending.length} 待处理</span>} />
                <div className="space-y-2.5">
                  {pending.length === 0 ? (
                    <div className="text-center py-10 text-xs" style={{ color: A.gray2 }}>
                      <CheckCircle2 size={22} className="mx-auto mb-2" style={{ color: A.green }} />
                      暂无待审批订单
                    </div>
                  ) : pending.map((q) => (
                    <div key={q.po} className="rounded-xl p-3" style={{ background: A.gray6 }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <button onClick={() => setSelectedId(q.po)}
                          className="text-xs font-semibold hover:underline" style={{ color: A.blue }}>{q.po}</button>
                        <span className="text-[10px] px-1.5 py-px rounded-full font-medium"
                          style={{ background: "#fff8f0", color: A.orange }}>优先级 {q.priority}</span>
                      </div>
                      <div className="text-xs font-medium mb-1" style={{ color: A.label }}>{q.supplier}</div>
                      <div className="text-[11px] mb-2.5" style={{ color: A.sub }}>{q.items} 行 · {q.owner} 提交</div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold tracking-tight" style={{ color: A.label }}>{fmt(q.amount)}</span>
                        <div className="flex gap-1.5">
                          <button onClick={() => reject(q.po)}
                            className="text-[11px] px-2.5 py-1 rounded-md font-medium transition-colors hover:bg-red-50"
                            style={{ background: A.white, color: A.gray1, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)" }}>驳回</button>
                          <button onClick={() => approve(q.po)}
                            className="text-[11px] px-2.5 py-1 rounded-md font-medium text-white transition-opacity hover:opacity-90"
                            style={{ background: A.blue }}>批准</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </Card>

        <Card className="col-span-2 p-5">
          <SectionHeader title="本周下单趋势"
            right={<div className="flex items-center gap-3 text-xs" style={{ color: A.sub }}>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: A.blue }} />订单数</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: A.purple }} />金额(万)</span>
            </div>} />
          <ResponsiveContainer width="100%" height={210}>
            <ComposedChart data={procurementTrend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="0" stroke="rgba(0,0,0,0.05)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="l" tick={{ fontSize: 11, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} width={32} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} width={40} />
              <Tooltip content={<AppleTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
              <Bar yAxisId="l" dataKey="po" name="订单数" fill={A.blue} radius={[5, 5, 0, 0]} barSize={20} />
              <Line yAxisId="r" type="monotone" dataKey="amount" name="金额(万)" stroke={A.purple} strokeWidth={2} dot={{ r: 3, fill: A.white, strokeWidth: 2, stroke: A.purple }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* PO Table + Detail */}
      <div className="grid grid-cols-5 gap-3">
        <Card className="col-span-3">
          <div className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}>
            <Filter size={13} style={{ color: A.gray2 }} />
            <SegmentedControl
              options={(["全部", "待审批", "已审批", "已发出", "部分到货", "已完成"] as const).map((s) => ({ label: s, value: s }))}
              value={filter} onChange={(v) => setFilter(v as any)}
            />
            <span className="text-xs ml-auto" style={{ color: A.gray2 }}>{filtered.length} 条</span>
            <button onClick={() => setNewOpen(true)}
              className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md font-medium text-white hover:opacity-90 transition-opacity"
              style={{ background: A.blue }}>
              <Plus size={11} /> 新建 PO
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                  {["PO 编号", "供应商", "金额", "项目", "到货进度", "ETA", "状态"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((o, i) => {
                  const pct = o.items === 0 ? 0 : (o.received / o.items) * 100;
                  const isSel = selectedPO.po === o.po;
                  return (
                    <tr key={o.po} onClick={() => setSelectedId(o.po)}
                      className="cursor-pointer transition-colors hover:bg-blue-50/40"
                      style={{
                        borderBottom: i < filtered.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none",
                        background: isSel ? "rgba(0,113,227,0.06)" : "transparent",
                      }}>
                      <td className="px-4 py-3 font-medium" style={{ color: A.blue }}>{o.po}</td>
                      <td className="px-4 py-3 font-medium" style={{ color: A.label }}>{o.supplier}</td>
                      <td className="px-4 py-3 font-semibold" style={{ color: A.label }}>{fmt(o.amount)}</td>
                      <td className="px-4 py-3" style={{ color: A.sub }}>{o.items}</td>
                      <td className="px-4 py-3 w-28">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: A.gray5 }}>
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct === 100 ? A.green : pct > 0 ? A.teal : A.gray4 }} />
                          </div>
                          <span className="text-[10px] w-8 text-right" style={{ color: A.gray1 }}>{o.received}/{o.items}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3" style={{ color: A.sub }}>{o.eta}</td>
                      <td className="px-4 py-3"><POStatusPill status={o.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* PO Detail */}
        <Card className="col-span-2 p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: A.gray2 }}>采购订单详情</div>
              <div className="text-base font-semibold tracking-tight" style={{ color: A.label }}>{selectedPO.po}</div>
            </div>
            <POStatusPill status={selectedPO.status} />
          </div>

          <div className="space-y-3 pb-4 mb-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
            {[
              { icon: Truck,    label: "供应商", value: selectedPO.supplier },
              { icon: User,     label: "负责人", value: selectedPO.owner    },
              { icon: Calendar, label: "下单 / ETA", value: `${selectedPO.created} → ${selectedPO.eta}` },
              { icon: Hash,     label: "明细行 / 已收", value: `${selectedPO.items} 行 / ${selectedPO.received} 行` },
            ].map((row) => {
              const Icon = row.icon;
              return (
                <div key={row.label} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: A.gray6 }}>
                    <Icon size={11} style={{ color: A.gray1 }} />
                  </div>
                  <span className="text-[11px] w-20" style={{ color: A.gray1 }}>{row.label}</span>
                  <span className="text-xs font-medium ml-auto" style={{ color: A.label }}>{row.value}</span>
                </div>
              );
            })}
          </div>

          {/* Timeline */}
          <div className="text-[10px] uppercase tracking-widest mb-3" style={{ color: A.gray2 }}>流程进度</div>
          <div className="space-y-3">
            {[
              { step: "创建",     done: true,                                                  date: selectedPO.created },
              { step: "审批",     done: !["草稿","待审批"].includes(selectedPO.status),         date: selectedPO.status === "待审批" ? "等待中" : "5月26日" },
              { step: "下发",     done: !["草稿","待审批","已审批"].includes(selectedPO.status), date: ["已发出","部分到货","已完成"].includes(selectedPO.status) ? "5月26日" : "—" },
              { step: "收货",     done: ["部分到货","已完成"].includes(selectedPO.status),       date: selectedPO.received > 0 ? "进行中" : "—" },
              { step: "对账付款", done: selectedPO.paid,                                       date: selectedPO.paid ? "已完成" : "—" },
            ].map((t, idx, arr) => (
              <div key={t.step} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: t.done ? A.green : A.gray5, color: A.white }}>
                    {t.done && <CheckCircle2 size={11} />}
                  </div>
                  {idx < arr.length - 1 && (
                    <div className="w-px h-5 mt-1" style={{ background: t.done ? A.green : A.gray5 }} />
                  )}
                </div>
                <div className="flex-1 -mt-0.5">
                  <div className="text-xs font-medium" style={{ color: t.done ? A.label : A.gray1 }}>{t.step}</div>
                  <div className="text-[10px]" style={{ color: A.gray2 }}>{t.date}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 mt-5">
            {selectedPO.status === "待审批" && (
              <>
                <button onClick={() => approve(selectedPO.po)}
                  className="flex-1 text-xs py-2 rounded-lg font-medium text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
                  style={{ background: A.green }}>
                  <Check size={12} /> 批准订单
                </button>
                <button onClick={() => reject(selectedPO.po)}
                  className="flex-1 text-xs py-2 rounded-lg font-medium" style={{ background: A.gray6, color: A.label }}>驳回</button>
              </>
            )}
            {selectedPO.status === "已审批" && (
              <button onClick={() => send(selectedPO.po)}
                className="flex-1 text-xs py-2 rounded-lg font-medium text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
                style={{ background: A.blue }}>
                <Send size={12} /> 下发至供应商
              </button>
            )}
            {(selectedPO.status === "已发出" || selectedPO.status === "部分到货" || selectedPO.status === "已完成") && (
              <button onClick={() => setTrackOpen(true)}
                className="flex-1 text-xs py-2 rounded-lg font-medium text-white hover:opacity-90 transition-opacity"
                style={{ background: A.blue }}>跟踪发货</button>
            )}
            <button onClick={() => downloadPDF(selectedPO.po)}
              className="flex-1 text-xs py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              style={{ background: A.gray6, color: A.label }}>下载 PDF</button>
            {!["已完成", "已取消"].includes(selectedPO.status) && (
              <button onClick={() => cancel(selectedPO.po)}
                className="text-xs px-3 py-2 rounded-lg font-medium hover:bg-red-50 transition-colors"
                style={{ background: A.white, color: A.red, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)" }}>
                <Trash2 size={11} />
              </button>
            )}
          </div>
        </Card>
      </div>

      <NewPOModal open={newOpen} onClose={() => setNewOpen(false)}
        onCreate={(po) => { setOrders((arr) => [po, ...arr]); setSelectedId(po.po); }} />
      <TrackShipmentModal open={trackOpen} onClose={() => setTrackOpen(false)} po={selectedPO} />
    </div>
  );
}

// ─── Scan Receive Modal ─────────────────────────────────────────────────────
function ScanReceiveModal({ open, onClose, onReceive }: {
  open: boolean; onClose: () => void;
  onReceive: (grn: string, po: string) => void;
}) {
  const [scan, setScan] = useState("");
  const [scanning, setScanning] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const candidates = purchaseOrders.filter((p) => ["已发出", "部分到货"].includes(p.status));

  function simulateScan() {
    setScanning(true);
    setTimeout(() => {
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      setScan(pick.po);
      setScanning(false);
    }, 900);
  }

  function confirm() {
    const po = candidates.find((c) => c.po === scan);
    if (!po) { toast.error("PO 编号无效或不在可收货状态"); return; }
    const grn = `GRN-202605-${String(424 + recent.length).padStart(4, "0")}`;
    onReceive(grn, po.po);
    setRecent([grn, ...recent].slice(0, 5));
    setScan("");
    toast.success(`${grn} 已创建`, { description: `${po.supplier} · ${po.items} 行待质检` });
  }

  return (
    <Modal open={open} onClose={onClose} title="扫码收货" subtitle="扫描随车单据二维码，或手动输入 PO 编号">
      <div className="rounded-xl p-8 flex flex-col items-center"
        style={{ background: A.gray6, border: `1px dashed ${A.gray3}` }}>
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 relative overflow-hidden"
          style={{ background: A.white, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <Camera size={28} style={{ color: scanning ? A.blue : A.gray2 }} />
          {scanning && (
            <div className="absolute inset-x-0 h-0.5 animate-pulse"
              style={{ background: A.blue, top: "50%", boxShadow: `0 0 12px ${A.blue}` }} />
          )}
        </div>
        <button onClick={simulateScan} disabled={scanning}
          className="text-xs px-4 py-1.5 rounded-lg font-medium text-white"
          style={{ background: A.blue, opacity: scanning ? 0.6 : 1 }}>
          {scanning ? "扫描中…" : "模拟扫码"}
        </button>
        <span className="text-[10px] mt-2" style={{ color: A.gray2 }}>对准条码 5–10 cm</span>
      </div>

      <div className="mt-5">
        <Field label="PO 编号">
          <div className="flex gap-2">
            <input value={scan} onChange={(e) => setScan(e.target.value)}
              placeholder="PO-2026-xxxx" style={inputStyle} />
            <button onClick={confirm}
              className="text-xs px-4 rounded-lg font-medium text-white shrink-0"
              style={{ background: A.green }}>确认收货</button>
          </div>
        </Field>
      </div>

      <div className="mt-5">
        <div className="text-[11px] mb-2 font-medium" style={{ color: A.sub }}>可收货 PO ({candidates.length})</div>
        <div className="space-y-1.5 max-h-40 overflow-auto">
          {candidates.map((p) => (
            <button key={p.po} onClick={() => setScan(p.po)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors"
              style={{
                background: scan === p.po ? "#f0f6ff" : A.gray6,
                border: `1px solid ${scan === p.po ? A.blue + "40" : "transparent"}`,
              }}>
              <span className="font-medium" style={{ color: A.blue }}>{p.po}</span>
              <span style={{ color: A.label }}>{p.supplier}</span>
              <span style={{ color: A.sub }}>{p.received}/{p.items} 行</span>
            </button>
          ))}
        </div>
      </div>

      {recent.length > 0 && (
        <div className="mt-5 rounded-xl p-3" style={{ background: "#f0faf4" }}>
          <div className="text-[11px] font-medium mb-1.5" style={{ color: A.green }}>本次会话已创建</div>
          {recent.map((g) => (
            <div key={g} className="flex items-center gap-2 text-xs py-0.5" style={{ color: A.label }}>
              <CheckCircle2 size={11} style={{ color: A.green }} />
              {g}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ─── QC Inspection Modal ────────────────────────────────────────────────────
function QCModal({ open, onClose, grn, onComplete }: {
  open: boolean; onClose: () => void;
  grn: typeof receivingDocs[number] | null;
  onComplete: (grnId: string, passed: number, failed: number, warehouse: string) => void;
}) {
  const [results, setResults] = useState<("pass" | "fail" | null)[]>([]);
  const [warehouse, setWarehouse] = useState("A 区");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (grn) setResults(Array(grn.items).fill(null));
  }, [grn?.grn]);

  if (!grn) return null;
  const passed = results.filter((r) => r === "pass").length;
  const failed = results.filter((r) => r === "fail").length;
  const remaining = results.filter((r) => r === null).length;
  const allDone = remaining === 0;

  function setAll(v: "pass" | "fail") { setResults(results.map(() => v)); }
  function setOne(i: number, v: "pass" | "fail") {
    setResults(results.map((r, idx) => idx === i ? v : r));
  }
  function submit() {
    if (!allDone) { toast.error(`还有 ${remaining} 项未检验`); return; }
    onComplete(grn.grn, passed, failed, warehouse);
    toast.success(`${grn.grn} 质检完成`, {
      description: `合格 ${passed} · 不合格 ${failed} · 入库 ${warehouse}`,
    });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} width={640}
      title={`质检 · ${grn.grn}`} subtitle={`${grn.supplier} · 关联 ${grn.po} · ${grn.items} 行明细`}
      footer={
        <>
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ background: A.white, color: A.label, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.1)" }}>稍后处理</button>
          <button onClick={submit} disabled={!allDone}
            className="text-xs px-3 py-1.5 rounded-lg font-medium text-white flex items-center gap-1.5"
            style={{ background: A.blue, opacity: allDone ? 1 : 0.5 }}>
            <FileCheck2 size={11} /> 完成质检并入库
          </button>
        </>
      }>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-xl p-3" style={{ background: "#f0faf4" }}>
          <div className="text-[10px]" style={{ color: A.green }}>合格</div>
          <div className="text-xl font-semibold tabular-nums" style={{ color: A.green }}>{passed}</div>
        </div>
        <div className="rounded-xl p-3" style={{ background: "#fff1f0" }}>
          <div className="text-[10px]" style={{ color: A.red }}>不合格</div>
          <div className="text-xl font-semibold tabular-nums" style={{ color: A.red }}>{failed}</div>
        </div>
        <div className="rounded-xl p-3" style={{ background: A.gray6 }}>
          <div className="text-[10px]" style={{ color: A.gray1 }}>待检</div>
          <div className="text-xl font-semibold tabular-nums" style={{ color: A.label }}>{remaining}</div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold" style={{ color: A.label }}>明细检验</span>
        <div className="flex gap-1.5">
          <button onClick={() => setAll("pass")}
            className="text-[11px] px-2 py-1 rounded-md font-medium" style={{ background: "#f0faf4", color: A.green }}>全部合格</button>
          <button onClick={() => setAll("fail")}
            className="text-[11px] px-2 py-1 rounded-md font-medium" style={{ background: "#fff1f0", color: A.red }}>全部不合格</button>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden max-h-64 overflow-y-auto" style={{ border: `0.5px solid ${A.gray4}` }}>
        {results.map((r, i) => (
          <div key={i} className="flex items-center px-3 py-2.5 text-xs"
            style={{ borderTop: i > 0 ? "0.5px solid rgba(0,0,0,0.05)" : "none" }}>
            <span className="w-6 text-center tabular-nums" style={{ color: A.gray2 }}>{i + 1}</span>
            <span className="flex-1 font-medium" style={{ color: A.label }}>
              批次 LOT-{String(2412001 + i).slice(-6)} · 数量 {Math.round(50 + Math.random() * 100)}
            </span>
            <div className="flex gap-1">
              <button onClick={() => setOne(i, "pass")}
                className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
                style={{
                  background: r === "pass" ? A.green : A.gray6,
                  color: r === "pass" ? A.white : A.gray2,
                }}>
                <Check size={12} />
              </button>
              <button onClick={() => setOne(i, "fail")}
                className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
                style={{
                  background: r === "fail" ? A.red : A.gray6,
                  color: r === "fail" ? A.white : A.gray2,
                }}>
                <X size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 mt-5">
        <Field label="入库库区">
          <select value={warehouse} onChange={(e) => setWarehouse(e.target.value)} style={inputStyle}>
            {["A 区", "B 区", "C 区", "D 区"].map((w) => <option key={w}>{w}</option>)}
          </select>
        </Field>
        <Field label="质检员">
          <input value={grn.receiver || "刘建华"} disabled style={{ ...inputStyle, color: A.sub }} />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="备注（异常说明）">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="如有不合格项，请说明原因（外观破损 / 数量不符 / 测试不通过…）"
            rows={2} style={{ ...inputStyle, resize: "none", fontFamily: "inherit" }} />
        </Field>
      </div>
    </Modal>
  );
}

// ─── Purchasing · RFQ ─────────────────────────────────────────────────────────
function PurchasingRFQ() {
  const [rfqs, setRfqs] = useState(RFQS);
  const award = (id: string) => {
    setRfqs(prev => prev.map(r => r.id === id ? { ...r, status: "已授标" as const } : r));
    toast.success(`${id} 已授标`, { description: "已自动生成 PO 草稿并发送给供应商" });
  };

  const totalSavings = 124800;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="活动询价" value={String(rfqs.length)} sub="近 30 天" delta="+2" positive icon={FileSpreadsheet} color={A.blue} />
        <KpiCard label="参与供应商" value={String(rfqs.reduce((a, b) => a + b.suppliers, 0))} sub="累计邀请" icon={Building2} color={A.purple} />
        <KpiCard label="本月节省" value={`¥${(totalSavings / 1e4).toFixed(1)}万`} sub="vs 目录价" delta="+18%" positive icon={TrendingUp} color={A.green} />
        <KpiCard label="平均周期" value="4.8 天" sub="发出 → 授标" delta="-1.2d" positive icon={Clock} color={A.teal} />
      </div>

      <Card>
        <div className="px-5 py-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>询价单</h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["RFQ 编号", "标题", "品类", "邀请 / 报价", "最优价", "最优供应商", "截止", "状态", "操作"].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rfqs.map((r, i) => (
              <tr key={r.id} style={{ borderBottom: i < rfqs.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>{r.id}</td>
                <td className="px-5 py-3 font-medium" style={{ color: A.label }}>{r.title}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{r.category}</td>
                <td className="px-5 py-3" style={{ color: A.label }}>
                  <span style={{ color: A.green, fontWeight: 500 }}>{r.quoted}</span>
                  <span style={{ color: A.gray1 }}> / {r.suppliers}</span>
                </td>
                <td className="px-5 py-3 font-medium" style={{ color: A.label }}>¥{r.bestPrice}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{r.bestSupplier}</td>
                <td className="px-5 py-3" style={{ color: A.label }}>{r.due}</td>
                <td className="px-5 py-3">
                  <Chip label={r.status} color={r.status === "已授标" ? A.green : r.status === "比价中" ? A.orange : r.status === "进行中" ? A.blue : A.gray1}
                    bg={r.status === "已授标" ? "rgba(52,199,89,0.1)" : r.status === "比价中" ? "rgba(255,149,0,0.1)" : r.status === "进行中" ? "rgba(0,113,227,0.1)" : "rgba(142,142,147,0.1)"} />
                </td>
                <td className="px-5 py-3">
                  {(r.status === "比价中" || r.status === "进行中") &&
                    <button onClick={() => award(r.id)} className="px-2 py-1 text-[11px] font-medium rounded-md text-white" style={{ background: A.blue }}>授标</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Purchasing · Contracts ───────────────────────────────────────────────────
function PurchasingContracts() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="活动合同"   value={String(CONTRACTS.filter(c => c.status !== "已到期").length)} sub="全部供应商" icon={Handshake} color={A.blue} />
        <KpiCard label="即将到期"   value={String(CONTRACTS.filter(c => c.status === "即将到期").length)} sub="30 天内"   icon={AlertTriangle} color={A.orange} />
        <KpiCard label="承诺总额"   value="¥1.42亿"                                                       sub="年化"        icon={DollarSign} color={A.green} />
        <KpiCard label="平均消耗率" value="58%"                                                            sub="承诺量进度"  icon={Activity}    color={A.purple} />
      </div>

      <Card>
        <div className="px-5 py-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>框架合同 (BPA)</h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["合同编号", "供应商", "范围", "承诺量", "价格条款", "起始", "到期", "消耗进度", "状态"].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CONTRACTS.map((c, i) => (
              <tr key={c.id} style={{ borderBottom: i < CONTRACTS.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>{c.id}</td>
                <td className="px-5 py-3 font-medium" style={{ color: A.label }}>{c.supplier}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{c.scope}</td>
                <td className="px-5 py-3" style={{ color: A.label }}>{c.commitVol}</td>
                <td className="px-5 py-3" style={{ color: A.green }}>{c.price}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{c.start}</td>
                <td className="px-5 py-3" style={{ color: c.status === "即将到期" ? A.orange : A.label }}>{c.end}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: A.gray5 }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, c.consumed * 100)}%`, background: c.consumed > 0.9 ? A.red : c.consumed > 0.7 ? A.orange : A.green }} />
                    </div>
                    <span className="text-[11px] font-medium" style={{ color: A.label }}>{(c.consumed * 100).toFixed(0)}%</span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <Chip label={c.status} color={c.status === "执行中" ? A.green : c.status === "即将到期" ? A.orange : A.gray1}
                    bg={c.status === "执行中" ? "rgba(52,199,89,0.1)" : c.status === "即将到期" ? "rgba(255,149,0,0.1)" : "rgba(142,142,147,0.1)"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Purchasing · 3-Way Match ─────────────────────────────────────────────────
function PurchasingMatch() {
  const [queue, setQueue] = useState(MATCH_QUEUE);
  const resolve = (id: string) => {
    setQueue(prev => prev.map(q => q.id === id ? { ...q, status: "已匹配" as const, variance: 0 } : q));
    toast.success(`${id} 差异已解决`, { description: "已生成调整凭证并通知供应商" });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="匹配队列"   value={String(queue.length)}                                       sub="近 7 天"                       icon={ShieldCheck} color={A.blue} />
        <KpiCard label="完全匹配率" value={`${((queue.filter(q => q.status === "已匹配").length / queue.length) * 100).toFixed(0)}%`} sub="3-Way 通过率" delta="+4pts" positive icon={CheckCircle2} color={A.green} />
        <KpiCard label="差异总额"   value={`¥${(queue.reduce((a, b) => a + b.variance, 0) / 1e4).toFixed(1)}万`} sub="待解决"             icon={AlertOctagon} color={A.red} />
        <KpiCard label="待匹配"     value={String(queue.filter(q => q.status === "待匹配" || q.status !== "已匹配").length)} sub="需人工" icon={AlertCircle} color={A.orange} />
      </div>

      <Card>
        <div className="px-5 py-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>三单匹配 (PO · GRN · Invoice)</h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["匹配号", "PO", "GRN", "发票", "供应商", "PO 金额", "GRN 金额", "发票金额", "差异", "状态", "操作"].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {queue.map((q, i) => (
              <tr key={q.id} style={{ borderBottom: i < queue.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>{q.id}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{q.po}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{q.grn}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{q.invoice}</td>
                <td className="px-5 py-3" style={{ color: A.label }}>{q.supplier}</td>
                <td className="px-5 py-3" style={{ color: A.label }}>¥{(q.poAmt / 1e4).toFixed(1)}万</td>
                <td className="px-5 py-3" style={{ color: A.label }}>¥{(q.grnAmt / 1e4).toFixed(1)}万</td>
                <td className="px-5 py-3" style={{ color: A.label }}>¥{(q.invAmt / 1e4).toFixed(1)}万</td>
                <td className="px-5 py-3 font-medium" style={{ color: q.variance === 0 ? A.green : A.red }}>{q.variance === 0 ? "—" : `¥${q.variance.toLocaleString()}`}</td>
                <td className="px-5 py-3">
                  <Chip label={q.status} color={q.status === "已匹配" ? A.green : q.status === "待匹配" ? A.gray1 : A.red}
                    bg={q.status === "已匹配" ? "rgba(52,199,89,0.1)" : q.status === "待匹配" ? "rgba(142,142,147,0.1)" : "rgba(255,59,48,0.1)"} />
                </td>
                <td className="px-5 py-3">
                  {q.status !== "已匹配" && <button onClick={() => resolve(q.id)} className="px-2 py-1 text-[11px] font-medium rounded-md text-white" style={{ background: A.blue }}>解决</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Purchasing · Payment ─────────────────────────────────────────────────────
function PurchasingPayment() {
  const [payables, setPayables] = useState(PAYABLES);
  const pay = (id: string) => {
    setPayables(prev => prev.map(p => p.id === id ? { ...p, status: "已付款" as const } : p));
    toast.success(`${id} 已付款`, { description: "已生成银行付款指令" });
  };

  const totalDue = payables.filter(p => p.status !== "已付款").reduce((a, b) => a + b.amount, 0);
  const overdue  = payables.filter(p => p.status === "逾期").reduce((a, b) => a + b.amount, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="应付总额"   value={`¥${(totalDue / 1e4).toFixed(0)}万`}    sub="未付清"                            icon={Wallet}      color={A.blue} />
        <KpiCard label="逾期金额"   value={`¥${(overdue / 1e4).toFixed(1)}万`}     sub={`${payables.filter(p => p.status === "逾期").length} 笔逾期`} icon={AlertOctagon} color={A.red} />
        <KpiCard label="7 天到期"   value="¥146万"                                  sub="3 笔"                              icon={Clock}       color={A.orange} />
        <KpiCard label="DPO"        value="48.2 天"                                 sub="应付账款周转天数" delta="+2.1d"    icon={CreditCard}  color={A.purple} />
      </div>

      <Card>
        <div className="px-5 py-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>应付账款</h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["AP 编号", "供应商", "发票", "金额", "条款", "到期日", "账龄", "状态", "操作"].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payables.map((p, i) => (
              <tr key={p.id} style={{ borderBottom: i < payables.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>{p.id}</td>
                <td className="px-5 py-3" style={{ color: A.label }}>{p.supplier}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{p.invoice}</td>
                <td className="px-5 py-3 font-medium" style={{ color: A.label }}>¥{p.amount.toLocaleString()}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{p.terms}</td>
                <td className="px-5 py-3" style={{ color: p.aging > 0 ? A.red : A.label }}>{p.due}</td>
                <td className="px-5 py-3 font-medium" style={{ color: p.aging > 0 ? A.red : p.aging > -7 ? A.orange : A.green }}>
                  {p.aging > 0 ? `逾期 ${p.aging} 天` : `还剩 ${Math.abs(p.aging)} 天`}
                </td>
                <td className="px-5 py-3">
                  <Chip label={p.status} color={p.status === "已付款" ? A.green : p.status === "逾期" ? A.red : p.status === "部分付款" ? A.orange : A.blue}
                    bg={p.status === "已付款" ? "rgba(52,199,89,0.1)" : p.status === "逾期" ? "rgba(255,59,48,0.1)" : p.status === "部分付款" ? "rgba(255,149,0,0.1)" : "rgba(0,113,227,0.1)"} />
                </td>
                <td className="px-5 py-3">
                  {p.status !== "已付款" && <button onClick={() => pay(p.id)} className="px-2 py-1 text-[11px] font-medium rounded-md text-white" style={{ background: A.green }}>付款</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Purchasing · Supplier Portal ─────────────────────────────────────────────
function PurchasingPortal() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="注册供应商" value={String(PORTAL_SUPPLIERS.length)} sub="活动" icon={Building2}    color={A.blue} />
        <KpiCard label="战略供应商" value={String(PORTAL_SUPPLIERS.filter(s => s.flag === "战略").length)} sub="核心合作" icon={Handshake} color={A.purple} />
        <KpiCard label="平均评分"   value={(PORTAL_SUPPLIERS.reduce((a, b) => a + b.rating, 0) / PORTAL_SUPPLIERS.length).toFixed(1)} sub="5 分制" delta="+0.2" positive icon={Sparkles} color={A.green} />
        <KpiCard label="整改中"     value={String(PORTAL_SUPPLIERS.filter(s => s.flag === "整改").length)} sub="质量 / 交付预警" icon={AlertTriangle} color={A.red} />
      </div>

      <Card>
        <div className="px-5 py-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>供应商绩效记分卡</h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["供应商", "评级", "准时率", "合格率", "响应度", "YTD PO", "YTD 采购额", "战略分级"].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PORTAL_SUPPLIERS.map((s, i) => (
              <tr key={s.name} style={{ borderBottom: i < PORTAL_SUPPLIERS.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-5 py-3 font-medium" style={{ color: A.label }}>{s.name}</td>
                <td className="px-5 py-3 font-medium" style={{ color: s.rating >= 4.5 ? A.green : s.rating >= 4.0 ? A.blue : A.orange }}>{s.rating.toFixed(1)} ★</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-14 h-1 rounded-full overflow-hidden" style={{ background: A.gray5 }}>
                      <div className="h-full rounded-full" style={{ width: `${s.onTime}%`, background: s.onTime >= 95 ? A.green : s.onTime >= 90 ? A.blue : A.orange }} />
                    </div>
                    <span className="text-[11px] font-medium" style={{ color: A.label }}>{s.onTime}%</span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-14 h-1 rounded-full overflow-hidden" style={{ background: A.gray5 }}>
                      <div className="h-full rounded-full" style={{ width: `${s.quality}%`, background: s.quality >= 98 ? A.green : s.quality >= 95 ? A.blue : A.orange }} />
                    </div>
                    <span className="text-[11px] font-medium" style={{ color: A.label }}>{s.quality}%</span>
                  </div>
                </td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{s.resp}</td>
                <td className="px-5 py-3" style={{ color: A.label }}>{s.po}</td>
                <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>¥{(s.spend / 1e4).toFixed(0)}万</td>
                <td className="px-5 py-3">
                  <Chip label={s.flag}
                    color={s.flag === "战略" ? A.purple : s.flag === "核心" ? A.blue : s.flag === "备选" ? A.gray1 : A.red}
                    bg={s.flag === "战略" ? "rgba(175,82,222,0.1)" : s.flag === "核心" ? "rgba(0,113,227,0.1)" : s.flag === "备选" ? "rgba(142,142,147,0.1)" : "rgba(255,59,48,0.1)"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Receiving Panel ─────────────────────────────────────────────────────────
function RecvStatusPill({ status }: { status: RecvStatus }) {
  const m = recvStatusMeta[status];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ color: m.color, background: m.bg }}>{status}</span>
  );
}

// ─── Receiving · ERP Data ─────────────────────────────────────────────────────
const ASNS: {
  id: string; po: string; supplier: string; eta: string; carrier: string;
  awb: string; cartons: number; weight: number; status: "在途" | "已抵港" | "清关中" | "已签收" | "延误";
}[] = [
  { id: "ASN-26-0421", po: "PO-2026-0142", supplier: "江苏铝合金集团", eta: "2026-05-28 14:00", carrier: "顺丰冷链", awb: "SF-26052812", cartons: 18, weight: 1280, status: "在途" },
  { id: "ASN-26-0422", po: "PO-2026-0148", supplier: "深圳新元电气",   eta: "2026-05-28 09:30", carrier: "京东物流", awb: "JD-26052804", cartons: 42, weight:  620, status: "已抵港" },
  { id: "ASN-26-0423", po: "PO-2026-0151", supplier: "佛山标准件",     eta: "2026-05-29 11:00", carrier: "德邦快运", awb: "DB-26052914", cartons: 12, weight:  840, status: "清关中" },
  { id: "ASN-26-0424", po: "PO-2026-0156", supplier: "上海仪表科技",   eta: "2026-05-30 16:30", carrier: "顺丰速运", awb: "SF-26053016", cartons:  6, weight:  120, status: "在途" },
  { id: "ASN-26-0425", po: "PO-2026-0162", supplier: "广州化工耗材",   eta: "2026-05-27 18:00", carrier: "中通快运", awb: "ZT-26052718", cartons:  9, weight:  360, status: "延误" },
  { id: "ASN-26-0426", po: "PO-2026-0164", supplier: "华东精工机械",   eta: "2026-05-31 10:00", carrier: "京东物流", awb: "JD-26053110", cartons: 24, weight: 1860, status: "在途" },
];

const QC_PLANS: {
  id: string; name: string; aql: string; sampleSize: string; criticalAQL: number; majorAQL: number; minorAQL: number;
  applies: string; method: string;
}[] = [
  { id: "QCP-001", name: "电子元器件 AQL 标准",   aql: "GB/T 2828.1 II", sampleSize: "N=125 → n=20",  criticalAQL: 0,    majorAQL: 1.0, minorAQL: 2.5, applies: "PCB / 控制板 / 传感器", method: "全项电测 + 外观" },
  { id: "QCP-002", name: "原材料抽检",            aql: "GB/T 2828.1 II", sampleSize: "N=500 → n=50",  criticalAQL: 0,    majorAQL: 1.5, minorAQL: 4.0, applies: "铝合金型材",            method: "光谱分析 + 力学" },
  { id: "QCP-003", name: "通用件免检",            aql: "供应商免检",     sampleSize: "N=∞ → n=0",     criticalAQL: 0,    majorAQL: 0,   minorAQL: 0,   applies: "M3~M12 紧固件",         method: "COA 核查" },
  { id: "QCP-004", name: "化工耗材",              aql: "GB/T 2828.1 II", sampleSize: "N=80 → n=13",   criticalAQL: 0,    majorAQL: 1.0, minorAQL: 2.5, applies: "切削液 / 防锈油",        method: "理化指标全检" },
  { id: "QCP-005", name: "精密工具",              aql: "GB/T 2828.1 III", sampleSize: "N=50 → n=20", criticalAQL: 0,    majorAQL: 0.65, minorAQL: 1.5, applies: "刀具 / 测量仪表",       method: "尺寸 + 硬度抽检" },
];

const EXCEPTIONS: {
  id: string; grn: string; type: "数量短缺" | "外观破损" | "型号错发" | "AQL 拒收" | "单据不符" | "运输异常";
  detail: string; severity: "高" | "中" | "低"; owner: string; status: "待处理" | "处理中" | "已闭环"; createdAt: string;
}[] = [
  { id: "EX-26-0184", grn: "GRN-2026-0518", type: "AQL 拒收",   detail: "Major 缺陷 3 件 > AQL 1.0, 批次整体拒收", severity: "高", owner: "李婷",   status: "处理中", createdAt: "2026-05-25" },
  { id: "EX-26-0185", grn: "GRN-2026-0521", type: "数量短缺",   detail: "实收 18 / 应收 20 (托盘 #4 缺失)",         severity: "中", owner: "刘建华", status: "处理中", createdAt: "2026-05-26" },
  { id: "EX-26-0186", grn: "GRN-2026-0522", type: "外观破损",   detail: "8 件包装受潮, 已隔离待评估",                severity: "中", owner: "王志强", status: "待处理", createdAt: "2026-05-26" },
  { id: "EX-26-0187", grn: "GRN-2026-0523", type: "型号错发",   detail: "实收 6061-T651 / 应收 6061-T6",             severity: "高", owner: "陈思远", status: "待处理", createdAt: "2026-05-27" },
  { id: "EX-26-0188", grn: "GRN-2026-0516", type: "单据不符",   detail: "发票金额与 PO 不符 (差异 ¥8,600)",          severity: "低", owner: "周浩",   status: "已闭环", createdAt: "2026-05-22" },
  { id: "EX-26-0189", grn: "GRN-2026-0509", type: "运输异常",   detail: "冷链温度记录超标 1.4°C × 4h",                severity: "高", owner: "李婷",   status: "已闭环", createdAt: "2026-05-19" },
];

const SUPPLIER_RETURNS: {
  id: string; po: string; supplier: string; reason: string; qty: number; amount: number;
  status: "已开单" | "已发出" | "已确认" | "已结案"; createdAt: string;
}[] = [
  { id: "SRN-26-082", po: "PO-2026-0128", supplier: "广州化工耗材",   reason: "理化指标不合格", qty:  12, amount:  18400, status: "已确认", createdAt: "2026-05-18" },
  { id: "SRN-26-083", po: "PO-2026-0136", supplier: "佛山标准件",     reason: "尺寸超差",        qty: 280, amount:   4200, status: "已发出", createdAt: "2026-05-22" },
  { id: "SRN-26-084", po: "PO-2026-0142", supplier: "江苏铝合金集团", reason: "AQL Major 超标",  qty:   3, amount:  86400, status: "已开单", createdAt: "2026-05-26" },
  { id: "SRN-26-085", po: "PO-2026-0118", supplier: "上海仪表科技",   reason: "校准证书缺失",    qty:   4, amount:  24800, status: "已结案", createdAt: "2026-05-10" },
];

// ─── Receiving · Master Wrapper ───────────────────────────────────────────────
type RecvTab = "ops" | "asn" | "qc" | "exceptions" | "returns";
function ReceivingPanel() {
  const [tab, setTab] = useState<RecvTab>("ops");
  const tabs = [
    { id: "ops",        label: "收货操作", icon: PackageCheck, count: receivingDocs.length },
    { id: "asn",        label: "ASN 预到货", icon: Inbox,      count: ASNS.length },
    { id: "qc",         label: "质检计划",   icon: ShieldCheck, count: QC_PLANS.length },
    { id: "exceptions", label: "异常工单",   icon: AlertOctagon, count: EXCEPTIONS.filter(e => e.status !== "已闭环").length },
    { id: "returns",    label: "退货供应商", icon: Undo2,        count: SUPPLIER_RETURNS.length },
  ] as const;

  return (
    <div className="space-y-4">
      <SubTabs tabs={tabs as any} value={tab} onChange={(v) => setTab(v as RecvTab)} />
      {tab === "ops"        && <ReceivingOps />}
      {tab === "asn"        && <ReceivingASN />}
      {tab === "qc"         && <ReceivingQC />}
      {tab === "exceptions" && <ReceivingExceptions />}
      {tab === "returns"    && <ReceivingReturns />}
    </div>
  );
}

function ReceivingASN() {
  const [asns, setAsns] = useState(ASNS);
  const checkin = (id: string) => {
    setAsns(prev => prev.map(a => a.id === id ? { ...a, status: "已签收" as const } : a));
    toast.success(`${id} 已签收`, { description: "已生成 GRN 单据, 进入质检流程" });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="预到货" value={String(asns.filter(a => a.status === "在途" || a.status === "已抵港").length)} sub="未来 48h" delta={`+${asns.filter(a => a.status === "在途").length}`} icon={Truck} color={A.blue} />
        <KpiCard label="今日到货" value={String(asns.filter(a => a.eta.startsWith("2026-05-27") || a.eta.startsWith("2026-05-28")).length)} sub="预计抵达" icon={Inbox} color={A.green} />
        <KpiCard label="延误"     value={String(asns.filter(a => a.status === "延误").length)} sub="超 ETA"  icon={AlertTriangle} color={A.red} />
        <KpiCard label="清关中"   value={String(asns.filter(a => a.status === "清关中").length)} sub="海关 / 国检" icon={Clock} color={A.orange} />
      </div>

      <Card>
        <div className="px-5 py-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>ASN 预到货通知</h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["ASN 编号", "PO", "供应商", "预计到达", "承运", "运单号", "件数", "重量(kg)", "状态", "操作"].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {asns.map((a, i) => (
              <tr key={a.id} style={{ borderBottom: i < asns.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>{a.id}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{a.po}</td>
                <td className="px-5 py-3" style={{ color: A.label }}>{a.supplier}</td>
                <td className="px-5 py-3" style={{ color: a.status === "延误" ? A.red : A.label }}>{a.eta}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{a.carrier}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{a.awb}</td>
                <td className="px-5 py-3" style={{ color: A.label }}>{a.cartons}</td>
                <td className="px-5 py-3" style={{ color: A.label }}>{a.weight}</td>
                <td className="px-5 py-3">
                  <Chip label={a.status}
                    color={a.status === "已签收" ? A.green : a.status === "已抵港" ? A.blue : a.status === "清关中" ? A.purple : a.status === "延误" ? A.red : A.orange}
                    bg={a.status === "已签收" ? "rgba(52,199,89,0.1)" : a.status === "已抵港" ? "rgba(0,113,227,0.1)" : a.status === "清关中" ? "rgba(175,82,222,0.1)" : a.status === "延误" ? "rgba(255,59,48,0.1)" : "rgba(255,149,0,0.1)"} />
                </td>
                <td className="px-5 py-3">
                  {(a.status === "已抵港" || a.status === "清关中") &&
                    <button onClick={() => checkin(a.id)} className="px-2 py-1 text-[11px] font-medium rounded-md text-white" style={{ background: A.blue }}>签收</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function ReceivingQC() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="质检计划"    value={String(QC_PLANS.length)}                        sub="生效中"                          icon={ShieldCheck} color={A.blue} />
        <KpiCard label="本月抽检批次" value="86"                                              sub="GB/T 2828.1"                     icon={ClipboardCheck} color={A.green} />
        <KpiCard label="一次合格率"   value="98.4%"                                           sub="FPY" delta="+0.6pts" positive    icon={CheckCircle2} color={A.purple} />
        <KpiCard label="拒收批次"     value="4"                                               sub="本月" delta="-2"  positive       icon={XCircle}    color={A.red} />
      </div>

      <Card>
        <div className="px-5 py-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>AQL 抽样计划 (GB/T 2828.1)</h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["计划编号", "名称", "AQL 等级", "抽样方案", "Critical", "Major", "Minor", "适用范围", "检验方法"].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {QC_PLANS.map((p, i) => (
              <tr key={p.id} style={{ borderBottom: i < QC_PLANS.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>{p.id}</td>
                <td className="px-5 py-3 font-medium" style={{ color: A.label }}>{p.name}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{p.aql}</td>
                <td className="px-5 py-3" style={{ color: A.label }}>{p.sampleSize}</td>
                <td className="px-5 py-3 font-medium" style={{ color: A.red }}>{p.criticalAQL}</td>
                <td className="px-5 py-3 font-medium" style={{ color: A.orange }}>{p.majorAQL}</td>
                <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>{p.minorAQL}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{p.applies}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{p.method}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-5">
        <SectionHeader title="AQL 接收 / 拒收判定示意" />
        <div className="grid grid-cols-3 gap-4 mt-2 text-xs">
          {[
            { label: "Critical (致命缺陷)", value: "AQL = 0",      desc: "零容忍, 发现即拒收整批", color: A.red },
            { label: "Major (主要缺陷)",     value: "AQL 1.0~1.5",  desc: "影响功能 / 使用, 抽样判定", color: A.orange },
            { label: "Minor (次要缺陷)",     value: "AQL 2.5~4.0",  desc: "外观 / 标识, 抽样判定",     color: A.blue },
          ].map(b => (
            <div key={b.label} className="p-4 rounded-xl" style={{ background: `${b.color}0d`, border: `0.5px solid ${b.color}33` }}>
              <div className="text-[11px] font-medium" style={{ color: b.color }}>{b.label}</div>
              <div className="text-base font-semibold mt-1" style={{ color: A.label }}>{b.value}</div>
              <div className="text-[11px] mt-1.5" style={{ color: A.sub }}>{b.desc}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ReceivingExceptions() {
  const [exs, setExs] = useState(EXCEPTIONS);
  const advance = (id: string) => {
    setExs(prev => prev.map(e => {
      if (e.id !== id) return e;
      const next = e.status === "待处理" ? "处理中" : "已闭环";
      return { ...e, status: next as any };
    }));
    toast.success("工单状态已更新");
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="开单异常" value={String(exs.length)} sub="近 30 天" icon={AlertOctagon} color={A.red} />
        <KpiCard label="待处理"   value={String(exs.filter(e => e.status === "待处理").length)} sub="待响应"   icon={AlertCircle} color={A.orange} />
        <KpiCard label="高优先级" value={String(exs.filter(e => e.severity === "高").length)} sub="需 24h 内闭环" icon={AlertTriangle} color={A.purple} />
        <KpiCard label="闭环率"   value={`${((exs.filter(e => e.status === "已闭环").length / exs.length) * 100).toFixed(0)}%`} sub="月度" delta="+8pts" positive icon={CheckCircle2} color={A.green} />
      </div>

      <Card>
        <div className="px-5 py-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>收货异常工单</h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["工单编号", "GRN", "异常类型", "详情", "严重度", "责任人", "创建", "状态", "操作"].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {exs.map((e, i) => (
              <tr key={e.id} style={{ borderBottom: i < exs.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>{e.id}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{e.grn}</td>
                <td className="px-5 py-3 font-medium" style={{ color: A.label }}>{e.type}</td>
                <td className="px-5 py-3" style={{ color: A.sub, maxWidth: 280 }}>{e.detail}</td>
                <td className="px-5 py-3">
                  <Chip label={e.severity}
                    color={e.severity === "高" ? A.red : e.severity === "中" ? A.orange : A.blue}
                    bg={e.severity === "高" ? "rgba(255,59,48,0.1)" : e.severity === "中" ? "rgba(255,149,0,0.1)" : "rgba(0,113,227,0.1)"} />
                </td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{e.owner}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{e.createdAt}</td>
                <td className="px-5 py-3">
                  <Chip label={e.status}
                    color={e.status === "已闭环" ? A.green : e.status === "处理中" ? A.blue : A.orange}
                    bg={e.status === "已闭环" ? "rgba(52,199,89,0.1)" : e.status === "处理中" ? "rgba(0,113,227,0.1)" : "rgba(255,149,0,0.1)"} />
                </td>
                <td className="px-5 py-3">
                  {e.status !== "已闭环" && <button onClick={() => advance(e.id)} className="px-2 py-1 text-[11px] font-medium rounded-md text-white" style={{ background: A.blue }}>{e.status === "待处理" ? "受理" : "闭环"}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function ReceivingReturns() {
  const [returns, setReturns] = useState(SUPPLIER_RETURNS);
  const advance = (id: string) => {
    setReturns(prev => prev.map(r => {
      if (r.id !== id) return r;
      const order = ["已开单", "已发出", "已确认", "已结案"] as const;
      const idx = order.indexOf(r.status as any);
      const next = order[Math.min(order.length - 1, idx + 1)];
      return { ...r, status: next };
    }));
    toast.success("退货状态已更新");
  };

  const totalAmt = returns.reduce((a, b) => a + b.amount, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="退货工单" value={String(returns.length)}                              sub="近 30 天"           icon={Undo2}        color={A.orange} />
        <KpiCard label="退货金额" value={`¥${(totalAmt / 1e4).toFixed(1)}万`}                 sub="累计"               icon={DollarSign}    color={A.red} />
        <KpiCard label="在途"     value={String(returns.filter(r => r.status === "已发出").length)} sub="待供应商确认" icon={Truck}        color={A.blue} />
        <KpiCard label="已结案"   value={String(returns.filter(r => r.status === "已结案").length)} sub="完成"           icon={CheckCircle2} color={A.green} />
      </div>

      <Card>
        <div className="px-5 py-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>退货供应商 (SRN)</h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["SRN 编号", "原 PO", "供应商", "原因", "数量", "金额", "创建", "状态", "操作"].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {returns.map((r, i) => (
              <tr key={r.id} style={{ borderBottom: i < returns.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>{r.id}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{r.po}</td>
                <td className="px-5 py-3" style={{ color: A.label }}>{r.supplier}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{r.reason}</td>
                <td className="px-5 py-3" style={{ color: A.label }}>{r.qty}</td>
                <td className="px-5 py-3 font-medium" style={{ color: A.red }}>¥{r.amount.toLocaleString()}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{r.createdAt}</td>
                <td className="px-5 py-3">
                  <Chip label={r.status}
                    color={r.status === "已结案" ? A.green : r.status === "已确认" ? A.purple : r.status === "已发出" ? A.blue : A.orange}
                    bg={r.status === "已结案" ? "rgba(52,199,89,0.1)" : r.status === "已确认" ? "rgba(175,82,222,0.1)" : r.status === "已发出" ? "rgba(0,113,227,0.1)" : "rgba(255,149,0,0.1)"} />
                </td>
                <td className="px-5 py-3">
                  {r.status !== "已结案" && <button onClick={() => advance(r.id)} className="px-2 py-1 text-[11px] font-medium rounded-md text-white" style={{ background: A.blue }}>推进</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function ReceivingOps() {
  const [docs, setDocs] = useState(receivingDocs);
  const [scanOpen, setScanOpen] = useState(false);
  const [qcOpen, setQcOpen] = useState(false);
  const [activeGrn, setActiveGrn] = useState<typeof receivingDocs[number] | null>(null);

  const todayReceived = docs.filter((d) => d.status === "已入库").length;
  const inQC          = docs.filter((d) => d.status === "质检中").length;
  const exceptions    = docs.filter((d) => d.status === "异常处理").length;
  const pending       = docs.filter((d) => d.status === "待收货").length;

  function startReceive(grnId: string, poId: string) {
    const supplier = purchaseOrders.find((p) => p.po === poId)?.supplier ?? "—";
    const items = purchaseOrders.find((p) => p.po === poId)?.items ?? 1;
    const now = new Date();
    const ts = `5月27日 ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setDocs((arr) => [{
      grn: grnId, po: poId, supplier, arrived: ts,
      dock: "Dock-02", receiver: "刘建华", items, passed: 0, failed: 0,
      status: "质检中", warehouse: "—",
    }, ...arr]);
  }

  function openQC(grn: typeof receivingDocs[number]) {
    if (grn.status === "已入库") { toast(`${grn.grn} 已完成入库`); return; }
    if (grn.status === "待收货") { toast.error(`${grn.grn} 尚未签收，请先签收`); return; }
    setActiveGrn(grn);
    setQcOpen(true);
  }

  function signIn(grn: typeof receivingDocs[number]) {
    setDocs((arr) => arr.map((d) => d.grn === grn.grn ? { ...d, status: "质检中", receiver: "刘建华" } : d));
    toast.success(`${grn.grn} 已签收`, { description: "已转入质检流程" });
  }

  function completeQC(grnId: string, passed: number, failed: number, warehouse: string) {
    setDocs((arr) => arr.map((d) => d.grn === grnId
      ? { ...d, passed, failed, warehouse, status: failed > 0 ? "异常处理" : "已入库" }
      : d));
  }

  function resolveException(grnId: string, action: string) {
    setDocs((arr) => arr.map((d) => d.grn === grnId ? { ...d, status: "已入库" } : d));
    toast.success(`异常已处理：${action}`);
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="今日已入库" value={String(todayReceived)} sub="¥482 万 入库价值" delta="+18%" positive icon={PackageCheck} color={A.green}  />
        <KpiCard label="待收货"     value={String(pending)}      sub="未来 24 小时"      delta="6 个 Dock" positive icon={Truck}        color={A.blue}   />
        <KpiCard label="质检中"     value={String(inQC)}         sub="平均 1.8 小时"     delta="-0.4h"      positive icon={ScanLine}     color={A.orange} />
        <KpiCard label="异常处理"   value={String(exceptions)}   sub="本月累计 12 起"    delta="+1 vs 昨日" positive={false} icon={AlertCircle} color={A.red}    />
      </div>

      {/* Schedule + Dock */}
      <div className="grid grid-cols-5 gap-3">
        <Card className="col-span-3 p-5">
          <SectionHeader title="今日到货排期"
            right={<span className="text-[11px]" style={{ color: A.gray2 }}>{arrivalSchedule.length} 车 · 4 个月台</span>} />
          <div className="space-y-0">
            {arrivalSchedule.map((s, i) => {
              const arrived = s.status === "已到达";
              const enroute = s.status === "在途";
              return (
                <div key={i} className="flex items-center gap-4 py-2.5"
                  style={{ borderBottom: i < arrivalSchedule.length - 1 ? "0.5px solid rgba(0,0,0,0.05)" : "none" }}>
                  <div className="w-12 text-xs font-semibold tabular-nums shrink-0" style={{ color: A.label }}>{s.time}</div>
                  <div className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: arrived ? A.green : enroute ? A.orange : A.gray3 }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium" style={{ color: A.label }}>{s.supplier}</div>
                    <div className="text-[11px]" style={{ color: A.gray2 }}>{s.po} · {s.driver}</div>
                  </div>
                  <Chip label={s.dock} color={A.indigo} bg="#eef0ff" />
                  <span className="text-[11px] font-medium w-14 text-right"
                    style={{ color: arrived ? A.green : enroute ? A.orange : A.gray1 }}>{s.status}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="col-span-2 p-5">
          <SectionHeader title="月台利用率"
            right={<span className="text-[11px]" style={{ color: A.gray2 }}>实时</span>} />
          <div className="space-y-3.5">
            {[
              { dock: "Dock-01", used: 78, jobs: 4, status: "占用中", color: A.green },
              { dock: "Dock-02", used: 62, jobs: 3, status: "占用中", color: A.green },
              { dock: "Dock-03", used: 51, jobs: 2, status: "等待",   color: A.orange },
              { dock: "Dock-04", used: 41, jobs: 2, status: "空闲",   color: A.gray2 },
            ].map((d) => (
              <div key={d.dock}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <MapPin size={11} style={{ color: A.gray2 }} />
                    <span className="text-xs font-medium" style={{ color: A.label }}>{d.dock}</span>
                    <span className="text-[10px] px-1.5 py-px rounded-full font-medium"
                      style={{ background: `${d.color}18`, color: d.color }}>{d.status}</span>
                  </div>
                  <span className="text-[11px]" style={{ color: A.gray1 }}>{d.jobs} 单 · {d.used}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: A.gray5 }}>
                  <div className="h-full rounded-full" style={{ width: `${d.used}%`, background: d.color }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 flex items-center justify-between" style={{ borderTop: "0.5px solid rgba(0,0,0,0.06)" }}>
            <div>
              <div className="text-[10px]" style={{ color: A.gray2 }}>平均利用率</div>
              <div className="text-xl font-semibold tracking-tight" style={{ color: A.label }}>58%</div>
            </div>
            <button className="text-[11px] px-3 py-1.5 rounded-lg font-medium" style={{ background: A.gray6, color: A.label }}>
              排程优化
            </button>
          </div>
        </Card>
      </div>

      {/* GRN list */}
      <Card>
        <div className="flex items-center px-5 py-3.5 gap-3" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>收货单 (GRN)</h2>
          <span className="text-xs" style={{ color: A.gray2 }}>{receivingDocs.length} 条</span>
          <div className="ml-auto flex gap-2">
            <button onClick={() => setScanOpen(true)}
              className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md font-medium hover:bg-gray-200 transition-colors"
              style={{ background: A.gray6, color: A.label }}>
              <ScanLine size={11} /> 扫码收货
            </button>
            <button onClick={() => setScanOpen(true)}
              className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md font-medium text-white hover:opacity-90 transition-opacity"
              style={{ background: A.blue }}>
              <Plus size={11} /> 新建收货单
            </button>
          </div>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["GRN", "关联 PO", "供应商", "到货时间", "Dock", "收货人", "质检", "入库", "状态", "操作"].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {docs.map((r, i) => (
              <tr key={r.grn} className="hover:bg-blue-50/40 transition-colors"
                style={{ borderBottom: i < docs.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-4 py-3 font-medium" style={{ color: A.blue }}>{r.grn}</td>
                <td className="px-4 py-3" style={{ color: A.indigo }}>{r.po}</td>
                <td className="px-4 py-3 font-medium" style={{ color: A.label }}>{r.supplier}</td>
                <td className="px-4 py-3" style={{ color: A.sub }}>{r.arrived}</td>
                <td className="px-4 py-3"><Chip label={r.dock} color={A.indigo} bg="#eef0ff" /></td>
                <td className="px-4 py-3" style={{ color: A.label }}>{r.receiver}</td>
                <td className="px-4 py-3 tabular-nums">
                  <span style={{ color: A.green }}>{r.passed}</span>
                  <span style={{ color: A.gray3 }}> / </span>
                  <span style={{ color: r.failed > 0 ? A.red : A.gray3 }}>{r.failed}</span>
                  <span style={{ color: A.gray3 }}> / </span>
                  <span style={{ color: A.label }}>{r.items}</span>
                </td>
                <td className="px-4 py-3" style={{ color: r.warehouse === "—" ? A.gray3 : A.label }}>{r.warehouse}</td>
                <td className="px-4 py-3"><RecvStatusPill status={r.status} /></td>
                <td className="px-4 py-3">
                  {r.status === "待收货" && (
                    <button onClick={() => signIn(r)}
                      className="text-[11px] px-2 py-1 rounded-md font-medium text-white hover:opacity-90 transition-opacity"
                      style={{ background: A.blue }}>签收</button>
                  )}
                  {r.status === "质检中" && (
                    <button onClick={() => openQC(r)}
                      className="text-[11px] px-2 py-1 rounded-md font-medium text-white hover:opacity-90 transition-opacity flex items-center gap-1"
                      style={{ background: A.orange }}>
                      <ScanLine size={10} /> 开始质检
                    </button>
                  )}
                  {r.status === "异常处理" && (
                    <button onClick={() => resolveException(r.grn, "已退货并补发")}
                      className="text-[11px] px-2 py-1 rounded-md font-medium hover:bg-red-100 transition-colors"
                      style={{ background: "#fff1f0", color: A.red }}>处理异常</button>
                  )}
                  {r.status === "已入库" && (
                    <button onClick={() => toast(`${r.grn} 详情`, { description: `入库 ${r.warehouse} · ${r.passed} 件合格` })}
                      className="text-[11px] px-2 py-1 rounded-md font-medium hover:bg-gray-200 transition-colors"
                      style={{ background: A.gray6, color: A.label }}>查看</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* QC exceptions */}
      <Card className="p-5">
        <SectionHeader title="质检异常处理"
          right={<span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
            style={{ background: "#fff1f0", color: A.red }}>{qcExceptions.length} 项待跟进</span>} />
        <div className="space-y-2.5">
          {qcExceptions.map((q, i) => {
            const sev = q.severity === "高" ? A.red : q.severity === "中" ? A.orange : A.gray1;
            return (
              <div key={i} className="flex items-center gap-4 p-3 rounded-xl"
                style={{ background: A.gray6, border: `1px solid ${sev}20` }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${sev}18` }}>
                  <AlertCircle size={14} style={{ color: sev }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold" style={{ color: A.label }}>{q.item}</span>
                    <Chip label={q.severity} color={sev} bg={`${sev}18`} />
                  </div>
                  <div className="text-[11px]" style={{ color: A.sub }}>
                    {q.grn} · {q.po} · 不合格 {q.failed}/{q.qty} · {q.type}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => resolveException(q.grn, q.action)}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-md flex items-center gap-1 transition-opacity hover:opacity-80"
                    style={{ background: A.white, color: A.label, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)" }}>
                    {q.action} <ArrowRight size={11} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <ScanReceiveModal open={scanOpen} onClose={() => setScanOpen(false)} onReceive={startReceive} />
      <QCModal open={qcOpen} onClose={() => setQcOpen(false)} grn={activeGrn} onComplete={completeQC} />
    </div>
  );
}

// ─── App Shell ────────────────────────────────────────────────────────────────
const PAGE_LABELS: Record<string, string> = {
  overview: "运营总览", inventory: "库存管理",
  sales: "产品销售", forecast: "预测分析",
  purchasing: "采购订单", receiving: "收货管理",
  procurement: "采购费用",
};

export default function App() {
  const [active, setActive] = useState("overview");
  const [aiVisible, setAiVisible] = useState(true);

  const panels: Record<string, React.ReactNode> = {
    overview:    <OverviewPanel />,
    inventory:   <InventoryPanel />,
    sales:       <SalesPanel />,
    forecast:    <ForecastPanel />,
    purchasing:  <PurchasingPanel />,
    receiving:   <ReceivingPanel />,
    procurement: <ProcurementPanel />,
  };

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: A.bg, fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <Toaster position="top-right" toastOptions={{
        style: { borderRadius: 14, fontSize: 12, fontFamily: "Inter", boxShadow: "0 8px 24px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.06)" },
      }} />

      {/* Sidebar — frosted glass, macOS-style */}
      <aside className="w-52 shrink-0 flex flex-col"
        style={{
          background: "rgba(246,246,248,0.88)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderRight: "0.5px solid rgba(0,0,0,0.1)",
        }}>
        {/* Logo */}
        <div className="px-5 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #0071e3 0%, #34aadc 100%)" }}>
              <Activity size={15} className="text-white" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: A.label }}>WSM</div>
              <div className="text-[10px]" style={{ color: A.gray1 }}>供应链管理</div>
            </div>
          </div>

          {/* System status pill */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "#f0faf4" }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ background: A.green }} />
            <span className="text-[11px] font-medium" style={{ color: A.green }}>系统正常运行</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5">
          <div className="text-[10px] font-semibold uppercase tracking-widest px-2 mb-2" style={{ color: A.gray2 }}>模块</div>
          {navItems.map((item) => {
            const isActive = active === item.id;
            return (
              <button key={item.id} onClick={() => setActive(item.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
                style={isActive
                  ? { background: A.white, color: A.blue, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }
                  : { background: "transparent", color: A.gray1 }}>
                <item.icon size={15} strokeWidth={isActive ? 2 : 1.8} />
                <span>{item.label}</span>
                {isActive && <ChevronRight size={12} className="ml-auto" style={{ color: A.blue }} />}
              </button>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-3 pb-5 space-y-1">
          <button
            onClick={() => setAiVisible((v) => !v)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
            style={aiVisible
              ? { background: "#f0f6ff", color: A.blue }
              : { background: "transparent", color: A.gray1 }}>
            <Sparkles size={15} strokeWidth={1.8} />
            <span>AI 分析</span>
            <div className={`ml-auto w-2 h-2 rounded-full transition-colors`}
              style={{ background: aiVisible ? A.blue : A.gray4 }} />
          </button>

          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-white/60 transition-colors">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
              style={{ background: "linear-gradient(135deg, #0071e3, #34aadc)" }}>
              张
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium" style={{ color: A.label }}>张磊</div>
              <div className="text-[10px]" style={{ color: A.gray2 }}>供应链经理</div>
            </div>
            <ChevronDown size={11} className="ml-auto shrink-0" style={{ color: A.gray2 }} />
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-12 flex items-center justify-between px-6 shrink-0"
          style={{
            background: "rgba(246,246,248,0.72)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderBottom: "0.5px solid rgba(0,0,0,0.08)",
          }}>
          <div className="flex items-center gap-2 text-sm">
            <span style={{ color: A.gray2 }}>WSM</span>
            <span style={{ color: A.gray3 }}>/</span>
            <span className="font-medium" style={{ color: A.label }}>{PAGE_LABELS[active]}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs cursor-pointer"
              style={{ background: A.white, borderColor: "rgba(0,0,0,0.08)", color: A.gray1 }}>
              <Search size={12} />
              <span>搜索</span>
              <kbd className="ml-3 text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: A.gray5, color: A.gray1 }}>⌘K</kbd>
            </div>
            <button className="relative w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-white"
              style={{ color: A.gray1 }}>
              <Bell size={15} strokeWidth={1.8} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: A.red }} />
            </button>
          </div>
        </header>

        {/* Content + AI panel */}
        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 overflow-auto p-6">
            <div className="max-w-6xl mx-auto">
              {panels[active]}
            </div>
          </main>

          {aiVisible && (
            <div className="w-72 shrink-0 overflow-hidden flex flex-col">
              <AiPanel moduleId={active} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
