export const EXCEPTION_VALIDATION_SCENARIO = {
  id: "exception-validation-scenario",
  enabledByDefault: false,
  cases: [
    { id: "EX-MISSING-GRN", type: "缺少 GRN", entity: "INV-SZ-260425", severity: "error" },
    { id: "EX-DUPLICATE-INVOICE", type: "重复发票", entity: "INV-FO-DUPLICATE", severity: "error" },
    { id: "EX-QUANTITY-VARIANCE", type: "数量差异", entity: "INV-GZ-260419", severity: "warning" },
    { id: "EX-PRICE-VARIANCE", type: "单价差异", entity: "INV-JS-260420", severity: "warning" },
    { id: "EX-FREIGHT-VARIANCE", type: "运费差异", entity: "INV-SZ-260422", severity: "warning" },
    { id: "EX-LOW-STOCK", type: "低于安全库存", entity: "SKU-00412", severity: "warning" },
    { id: "EX-RECEIPT-DAMAGE", type: "客户异常签收", entity: "SR-2026-0709-002", severity: "warning" },
  ],
} as const;
