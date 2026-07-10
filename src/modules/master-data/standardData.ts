export type CustomerMaster = {
  code: string; name: string; contact: string; phone: string; address: string; creditStatus: "正常" | "受限" | "待评估";
  paymentTerms: string; status: "启用" | "停用";
};

export type PrintTemplateCatalogItem = {
  id: string; name: string; documentType: string; isDefault: boolean; updatedAt: string;
};

export const CUSTOMER_MASTER: CustomerMaster[] = [
  { code: "CUS-001", name: "华南自动化设备有限公司", contact: "林志远", phone: "138****2018", address: "深圳市宝安区智能制造产业园", creditStatus: "正常", paymentTerms: "月结 30 天", status: "启用" },
  { code: "CUS-002", name: "苏州精工系统集成有限公司", contact: "张海峰", phone: "137****8291", address: "苏州市工业园区星港街 88 号", creditStatus: "正常", paymentTerms: "月结 45 天", status: "启用" },
  { code: "CUS-003", name: "武汉启明智能制造有限公司", contact: "黄文杰", phone: "139****1706", address: "武汉市东湖高新区光谷大道", creditStatus: "待评估", paymentTerms: "预付 30% / 到货 70%", status: "启用" },
  { code: "CUS-004", name: "成都锐创机器人科技有限公司", contact: "何雨", phone: "136****7720", address: "成都市高新区天府五街", creditStatus: "受限", paymentTerms: "款到发货", status: "启用" },
  { code: "CUS-005", name: "上海万联装备股份有限公司", contact: "顾晨", phone: "135****3902", address: "上海市嘉定区工业园区", creditStatus: "正常", paymentTerms: "月结 30 天", status: "启用" },
];

export const PRINT_TEMPLATE_CATALOG: PrintTemplateCatalogItem[] = [
  { id: "default-receive-sheet", name: "标准入库单", documentType: "采购收货单 / 入库单", isDefault: true, updatedAt: "2026-07-10 09:30" },
  { id: "default-delivery-note", name: "标准发货单", documentType: "销售出库单 / 发货单", isDefault: true, updatedAt: "2026-07-10 09:30" },
  { id: "default-sign-receipt", name: "标准签收单", documentType: "签收单", isDefault: true, updatedAt: "2026-07-10 09:30" },
];
