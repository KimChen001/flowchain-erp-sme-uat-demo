import type { ItemMaster, PaymentTerm, SupplierMaster, TaxCode, WarehouseBin } from "../types/scm";

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

export const TAX_CODES: TaxCode[] = [
  { code: "VAT13-IN", name: "进项税 13%", rate: 0.13, type: "进项税", region: "中国大陆", isDefault: true, status: "启用", description: "标准采购物料进项税率，用于供应商发票税额拆分。" },
  { code: "VAT09-IN", name: "进项税 9%", rate: 0.09, type: "进项税", region: "中国大陆", isDefault: false, status: "启用", description: "物流、运输或部分服务类采购进项税率。" },
  { code: "VAT06-IN", name: "进项税 6%", rate: 0.06, type: "进项税", region: "中国大陆", isDefault: false, status: "启用", description: "技术服务、咨询服务等低税率采购场景。" },
  { code: "VAT00-EX", name: "免税采购", rate: 0, type: "免税", region: "中国大陆", isDefault: false, status: "待复核", description: "免税或不计税采购场景，需财务复核适用范围。" },
];

export const PAYMENT_TERMS: PaymentTerm[] = [
  { code: "NET30", name: "Net 30", netDays: 30, discountRule: "无现金折扣", dueDateRule: "发票日期后 30 天到期", status: "启用", description: "标准供应商付款条款，适用于多数采购发票。" },
  { code: "NET45", name: "Net 45", netDays: 45, discountRule: "无现金折扣", dueDateRule: "发票日期后 45 天到期", status: "启用", description: "核心原材料供应商常用账期。" },
  { code: "NET60", name: "Net 60", netDays: 60, discountRule: "无现金折扣", dueDateRule: "发票日期后 60 天到期", status: "启用", description: "长期合作供应商或框架协议账期。" },
  { code: "DOR", name: "Due on receipt", netDays: 0, discountRule: "到票即付", dueDateRule: "发票接收日到期", status: "待复核", description: "即时付款条款，需结算准备中重点复核。" },
];

export const ITEM_MASTER: ItemMaster[] = [
  { sku: "SKU-00142", name: "精密轴承 6204-ZZ", category: "机械部件", specification: "6204-ZZ / 高速密封", unit: "件", defaultWarehouse: "上海总仓", defaultBin: "A-03-12", safetyStock: 500, maxStock: 5000, reorderPoint: 820, leadTimeDays: 14, batchManaged: true, serialManaged: false, qaRequired: true, defaultSupplier: "华东精工机械", defaultTaxCode: "VAT13-IN", status: "启用" },
  { sku: "SKU-00287", name: "铝合金型材 6063", category: "原材料", specification: "6063-T5 / 6m", unit: "米", defaultWarehouse: "上海总仓", defaultBin: "B-01-05", safetyStock: 300, maxStock: 2000, reorderPoint: 584, leadTimeDays: 12, batchManaged: true, serialManaged: false, qaRequired: true, defaultSupplier: "江苏铝合金集团", defaultTaxCode: "VAT13-IN", status: "启用" },
  { sku: "SKU-00391", name: "密封圈 NBR-70", category: "耗材", specification: "NBR-70 / 多规格", unit: "件", defaultWarehouse: "上海总仓", defaultBin: "C-05-08", safetyStock: 2000, maxStock: 20000, reorderPoint: 3500, leadTimeDays: 7, batchManaged: true, serialManaged: false, qaRequired: false, defaultSupplier: "佛山标准件", defaultTaxCode: "VAT13-IN", status: "启用" },
  { sku: "SKU-00412", name: "伺服电机 750W", category: "电气元件", specification: "750W / 220V", unit: "台", defaultWarehouse: "上海总仓", defaultBin: "D-02-01", safetyStock: 50, maxStock: 200, reorderPoint: 72, leadTimeDays: 18, batchManaged: true, serialManaged: true, qaRequired: true, defaultSupplier: "深圳新元电气", defaultTaxCode: "VAT13-IN", status: "启用" },
  { sku: "SKU-00558", name: "不锈钢螺栓 M8×30", category: "标准件", specification: "M8×30 / 304", unit: "件", defaultWarehouse: "上海总仓", defaultBin: "A-07-22", safetyStock: 10000, maxStock: 100000, reorderPoint: 18000, leadTimeDays: 10, batchManaged: true, serialManaged: false, qaRequired: false, defaultSupplier: "佛山标准件", defaultTaxCode: "VAT13-IN", status: "启用" },
  { sku: "SKU-00623", name: "控制器主板 V3.2", category: "电气元件", specification: "V3.2 / 工业控制", unit: "件", defaultWarehouse: "上海总仓", defaultBin: "D-01-03", safetyStock: 20, maxStock: 80, reorderPoint: 40, leadTimeDays: 10, batchManaged: true, serialManaged: true, qaRequired: true, defaultSupplier: "深圳新元电气", defaultTaxCode: "VAT13-IN", status: "启用" },
  { sku: "SKU-00744", name: "聚氨酯密封胶", category: "耗材", specification: "5L / 工业级", unit: "桶", defaultWarehouse: "上海总仓", defaultBin: "C-02-11", safetyStock: 200, maxStock: 3000, reorderPoint: 420, leadTimeDays: 9, batchManaged: true, serialManaged: false, qaRequired: true, defaultSupplier: "广州化工耗材", defaultTaxCode: "VAT13-IN", status: "启用" },
  { sku: "SKU-00815", name: "液压油缸 50mm", category: "机械部件", specification: "50mm / 双作用", unit: "件", defaultWarehouse: "上海总仓", defaultBin: "B-04-06", safetyStock: 80, maxStock: 300, reorderPoint: 112, leadTimeDays: 16, batchManaged: true, serialManaged: false, qaRequired: true, defaultSupplier: "华东精工机械", defaultTaxCode: "VAT13-IN", status: "待完善" },
  { sku: "SKU-00934", name: "步进电机驱动板", category: "电气元件", specification: "48V / 4A", unit: "件", defaultWarehouse: "上海总仓", defaultBin: "D-03-07", safetyStock: 60, maxStock: 250, reorderPoint: 96, leadTimeDays: 14, batchManaged: true, serialManaged: true, qaRequired: true, defaultSupplier: "深圳新元电气", defaultTaxCode: "VAT13-IN", status: "启用" },
  { sku: "SKU-01021", name: "气动手指夹持器", category: "机械部件", specification: "平行夹持 / 中型", unit: "件", defaultWarehouse: "上海总仓", defaultBin: "B-06-14", safetyStock: 100, maxStock: 800, reorderPoint: 160, leadTimeDays: 12, batchManaged: false, serialManaged: false, qaRequired: true, defaultSupplier: "华东精工机械", defaultTaxCode: "VAT13-IN", status: "启用" },
];

export const SUPPLIER_MASTER: SupplierMaster[] = [
  { code: "SUP-SZ-ELEC", name: "深圳新元电气", category: "电气元件", contact: "刘工", email: "liugong@szxinyuan.example", phone: "0755-8800-1201", paymentTerms: "NET30", currency: "CNY", taxId: "91440300SZXY2026", defaultTaxCode: "VAT13-IN", rating: 4.7, onTimeRate: 96.8, qualityRate: 99.2, riskStatus: "低", certificationStatus: "已认证", status: "启用" },
  { code: "SUP-HD-MECH", name: "华东精工机械", category: "机械部件", contact: "王经理", email: "sales@hdjinggong.example", phone: "021-6600-1820", paymentTerms: "NET30", currency: "CNY", taxId: "91310000HDJG2026", defaultTaxCode: "VAT13-IN", rating: 4.2, onTimeRate: 91.6, qualityRate: 97.4, riskStatus: "中", certificationStatus: "待复核", status: "启用" },
  { code: "SUP-JS-ALU", name: "江苏铝合金集团", category: "原材料", contact: "赵主管", email: "zhao@jsaluminum.example", phone: "025-8800-2618", paymentTerms: "NET45", currency: "CNY", taxId: "91320000JSAL2026", defaultTaxCode: "VAT13-IN", rating: 4.6, onTimeRate: 94.2, qualityRate: 98.6, riskStatus: "低", certificationStatus: "已认证", status: "启用" },
  { code: "SUP-FS-STD", name: "佛山标准件", category: "标准件", contact: "陈主管", email: "chen@fsfastener.example", phone: "0757-6600-4920", paymentTerms: "NET30", currency: "CNY", taxId: "91440600FSBJ2026", defaultTaxCode: "VAT13-IN", rating: 4.4, onTimeRate: 92.4, qualityRate: 97.8, riskStatus: "低", certificationStatus: "已认证", status: "启用" },
  { code: "SUP-GZ-CHEM", name: "广州化工耗材", category: "耗材", contact: "黄经理", email: "huang@gzchem.example", phone: "020-8800-7744", paymentTerms: "NET30", currency: "CNY", taxId: "91440100GZHC2026", defaultTaxCode: "VAT13-IN", rating: 3.8, onTimeRate: 86.4, qualityRate: 94.2, riskStatus: "高", certificationStatus: "整改中", status: "待完善" },
  { code: "SUP-SH-METER", name: "上海仪表科技", category: "设备耗材", contact: "孙工", email: "sun@shmeter.example", phone: "021-7700-3188", paymentTerms: "NET60", currency: "CNY", taxId: "91310000SHYB2026", defaultTaxCode: "VAT13-IN", rating: 4.5, onTimeRate: 95.1, qualityRate: 99.0, riskStatus: "低", certificationStatus: "已认证", status: "启用" },
];

export const WAREHOUSE_BINS: WarehouseBin[] = [
  { warehouseCode: "WH-SH-01", warehouseName: "上海总仓", zone: "A 区高位", bin: "A-03-12", capacity: 5000, utilization: 0.57, temperatureRequirement: "常温", qaStatus: "可用", available: true, owner: "刘建华" },
  { warehouseCode: "WH-SH-01", warehouseName: "上海总仓", zone: "B 区原料", bin: "B-01-05", capacity: 2000, utilization: 0.74, temperatureRequirement: "常温", qaStatus: "可用", available: true, owner: "刘建华" },
  { warehouseCode: "WH-SH-01", warehouseName: "上海总仓", zone: "C 区耗材", bin: "C-02-11", capacity: 3000, utilization: 0.31, temperatureRequirement: "阴凉", qaStatus: "待复核", available: true, owner: "孙明" },
  { warehouseCode: "WH-SH-01", warehouseName: "上海总仓", zone: "C 区耗材", bin: "C-05-08", capacity: 20000, utilization: 0.62, temperatureRequirement: "常温", qaStatus: "可用", available: true, owner: "孙明" },
  { warehouseCode: "WH-SH-01", warehouseName: "上海总仓", zone: "D 区电气", bin: "D-01-03", capacity: 80, utilization: 0.15, temperatureRequirement: "防静电", qaStatus: "可用", available: true, owner: "陈思远" },
  { warehouseCode: "WH-SH-01", warehouseName: "上海总仓", zone: "D 区电气", bin: "D-03-07", capacity: 250, utilization: 0.36, temperatureRequirement: "防静电", qaStatus: "冻结", available: false, owner: "陈思远" },
];
