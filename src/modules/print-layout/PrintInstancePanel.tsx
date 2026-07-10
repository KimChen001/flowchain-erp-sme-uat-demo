import type { PrintDocumentType } from "./printLayoutTypes";

export const printInstanceFields: Record<PrintDocumentType, Array<{ key: string; label: string }>> = {
  receive_sheet: [
    { key: "receiving-note", label: "收货备注" }, { key: "quality-note", label: "质检说明" },
    { key: "supplier-delivery-note", label: "供应商送货说明" }, { key: "warehouse-note", label: "入库补充说明" },
  ],
  delivery_note: [
    { key: "delivery-note", label: "发货备注" }, { key: "packing-note", label: "包装说明" },
    { key: "customer-request", label: "客户特别要求" }, { key: "transport-note", label: "运输说明" },
  ],
  sign_receipt: [
    { key: "receipt-note", label: "签收备注" }, { key: "customer-comments", label: "客户 Comments" },
    { key: "damage-note", label: "损坏说明" }, { key: "exception-note", label: "异常说明" },
  ],
};

export default function PrintInstancePanel({ documentType, values, onChange }: {
  documentType: PrintDocumentType;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return <div className="print-inspector-section" data-testid="print-instance-panel">
    <div className="print-inspector-title">本次打印内容</div>
    <p className="print-instance-help">只保存到当前单据，不修改业务数据，也不影响其他单据。</p>
    <div className="print-property-form">
      {printInstanceFields[documentType].map((field) => <label key={field.key}>{field.label}
        <textarea aria-label={field.label} rows={3} value={values[`instance-${field.key}`] || ""} onChange={(event) => onChange(field.key, event.target.value)} />
      </label>)}
    </div>
  </div>;
}
