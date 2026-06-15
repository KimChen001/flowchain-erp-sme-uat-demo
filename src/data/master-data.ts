export const supplierData = [
  { rank: 1, name: "华东精工机械",   cat: "机械部件", amount: 42800000, orders: 184, ontime: 98.4, quality: 99.1, grade: "S",  trend: "up"     },
  { rank: 2, name: "深圳新元电气",   cat: "电气元件", amount: 38600000, orders: 231, ontime: 96.7, quality: 97.8, grade: "A",  trend: "up"     },
  { rank: 3, name: "江苏铝合金集团", cat: "原材料",   amount: 31200000, orders: 98,  ontime: 99.2, quality: 98.4, grade: "S",  trend: "stable" },
  { rank: 4, name: "佛山标准件",     cat: "标准件",   amount: 18400000, orders: 412, ontime: 97.1, quality: 96.2, grade: "A",  trend: "stable" },
  { rank: 5, name: "广州化工耗材",   cat: "耗材",     amount: 12600000, orders: 156, ontime: 92.3, quality: 91.8, grade: "B",  trend: "down"   },
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
