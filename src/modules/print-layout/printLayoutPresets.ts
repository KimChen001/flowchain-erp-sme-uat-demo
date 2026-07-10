import { PAGE_SIZES, type PrintDocumentType, type PrintLayoutElement, type PrintLayoutTemplate, type PrintTableColumn } from "./printLayoutTypes";

const field = (id: string, title: string, binding: string, x: number, y: number, width = 220): PrintLayoutElement => ({
  id, type: "field", title, field: binding, x, y, width, height: 28, visible: true, draggable: true, resizable: true,
  style: { fontSize: 12, align: "left" },
});

const columnsByType: Record<PrintDocumentType, PrintTableColumn[]> = {
  receive_sheet: [
    { key: "sku", title: "SKU", visible: true, width: 95 }, { key: "itemName", title: "商品名称", visible: true, width: 190 },
    { key: "quantity", title: "收货数量", visible: true, width: 80, align: "right" }, { key: "unit", title: "单位", visible: true, width: 55, align: "center" },
    { key: "batchNo", title: "批次", visible: true, width: 95 }, { key: "remarks", title: "备注", visible: true, width: 120 },
  ],
  delivery_note: [
    { key: "sku", title: "SKU", visible: true, width: 90 }, { key: "itemName", title: "商品名称", visible: true, width: 170 },
    { key: "orderedQty", title: "订单数", visible: true, width: 70, align: "right" }, { key: "shippedQty", title: "发货数", visible: true, width: 70, align: "right" },
    { key: "unit", title: "单位", visible: true, width: 50, align: "center" }, { key: "batchNo", title: "批次", visible: true, width: 90 },
    { key: "cartonCount", title: "箱数", visible: true, width: 55, align: "right" }, { key: "remarks", title: "备注", visible: true, width: 105 },
  ],
  sign_receipt: [
    { key: "sku", title: "SKU", visible: true, width: 90 }, { key: "itemName", title: "商品名称", visible: true, width: 180 },
    { key: "shippedQty", title: "发货数", visible: true, width: 75, align: "right" }, { key: "receivedQty", title: "实收数", visible: true, width: 75, align: "right" },
    { key: "damagedQty", title: "异常数", visible: true, width: 75, align: "right" }, { key: "unit", title: "单位", visible: true, width: 55, align: "center" },
    { key: "remarks", title: "备注", visible: true, width: 135 },
  ],
};

const common = (title: string, type: PrintDocumentType): PrintLayoutElement[] => [
  { id: "company", type: "field", title: "公司名称", field: "companyName", x: 52, y: 42, width: 690, height: 30, visible: true, draggable: true, resizable: true, required: true, style: { fontSize: 14, bold: true, align: "center" } },
  { id: "title", type: "text", title: "单据标题", value: title, x: 52, y: 78, width: 690, height: 44, visible: true, draggable: true, resizable: true, required: true, style: { fontSize: 24, bold: true, align: "center" } },
  field("documentNo", "单据编号", "documentNo", 52, 140, 300),
  field("documentDate", "日期", "documentDate", 442, 140, 300),
  field("warehouse", "仓库", "warehouse", 52, 174, 300),
  field("sourceOrderNo", "来源订单", "sourceOrderNo", 442, 174, 300),
  field("handler", "经办人", "handler", 52, 208, 300),
  { id: "lines", type: "table", title: "商品明细", field: "lines", x: 52, y: 320, width: 690, height: 330, visible: true, draggable: true, resizable: true, required: true, style: { fontSize: 11, bordered: true }, tableColumns: columnsByType[type] },
  field("remarks", "备注", "remarks", 52, 672, 690),
  { id: "signatures", type: "signature", title: "签字栏", value: "制单：__________    审核：__________    收货/交付：__________", x: 52, y: 742, width: 690, height: 58, visible: true, draggable: true, resizable: true, style: { fontSize: 12, align: "left", bordered: true } },
  { id: "footer", type: "footer", title: "页脚", value: "FlowChain ERP · 本单据由系统生成", x: 52, y: 1040, width: 560, height: 24, visible: true, draggable: true, resizable: true, style: { fontSize: 10, align: "left" } },
  { id: "pageNumber", type: "pageNumber", title: "页码", x: 620, y: 1040, width: 122, height: 24, visible: true, draggable: true, resizable: true, style: { fontSize: 10, align: "right" } },
];

function receivePreset(): PrintLayoutTemplate {
  const elements = common("标准入库单", "receive_sheet");
  elements.splice(6, 0,
    field("supplier", "供应商", "supplier", 52, 242, 300),
    field("receiveDate", "收货日期", "receiveDate", 442, 242, 300),
    field("receiver", "收货人", "receiver", 52, 276, 300),
    field("reviewedBy", "审核人", "reviewedBy", 442, 276, 300),
  );
  return { id: "default-receive-sheet", name: "标准入库单", documentType: "receive_sheet", isDefault: true, version: 1, page: { paper: "A4", orientation: "portrait", ...PAGE_SIZES.portrait, margin: 52 }, elements };
}

function deliveryPreset(): PrintLayoutTemplate {
  const elements = common("标准发货单", "delivery_note");
  elements.splice(6, 0,
    field("customer", "客户", "customer", 52, 242, 300), field("logisticsCompany", "物流公司", "logisticsCompany", 442, 242, 300),
    field("driver", "司机", "driver", 52, 276, 220), field("vehicleNo", "车辆", "vehicleNo", 292, 276, 220), field("cartonCount", "箱数", "cartonCount", 532, 276, 210),
  );
  return { id: "default-delivery-note", name: "标准发货单", documentType: "delivery_note", isDefault: true, version: 1, page: { paper: "A4", orientation: "portrait", ...PAGE_SIZES.portrait, margin: 52 }, elements };
}

function receiptPreset(): PrintLayoutTemplate {
  const elements = common("标准签收单", "sign_receipt");
  elements.splice(6, 0,
    field("customer", "客户", "customer", 52, 242, 300), field("receiverName", "签收人", "receiverName", 442, 242, 300),
    field("receiverPhone", "签收电话", "receiverPhone", 52, 276, 220), field("signDate", "签收日期", "signDate", 292, 276, 220), field("deliveryNo", "发货单", "deliveryNo", 532, 276, 210),
    field("exceptionNote", "异常说明", "exceptionNote", 52, 812, 690),
    { id: "customerSignature", type: "signature", title: "客户签名", field: "signature", x: 52, y: 856, width: 690, height: 72, visible: true, draggable: true, resizable: true, style: { fontSize: 12, bordered: true } },
  );
  return { id: "default-sign-receipt", name: "标准签收单", documentType: "sign_receipt", isDefault: true, version: 1, page: { paper: "A4", orientation: "portrait", ...PAGE_SIZES.portrait, margin: 52 }, elements };
}

export const DEFAULT_PRINT_TEMPLATES: Record<PrintDocumentType, PrintLayoutTemplate> = {
  receive_sheet: receivePreset(), delivery_note: deliveryPreset(), sign_receipt: receiptPreset(),
};

export function defaultPrintTemplate(type: PrintDocumentType): PrintLayoutTemplate {
  return structuredClone(DEFAULT_PRINT_TEMPLATES[type]);
}
