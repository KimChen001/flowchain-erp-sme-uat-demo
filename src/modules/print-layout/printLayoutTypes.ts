export type PrintDocumentType = "receive_sheet" | "delivery_note" | "sign_receipt";

export type PrintPageConfig = {
  paper: "A4";
  orientation: "portrait" | "landscape";
  width: number;
  height: number;
  margin: number;
};

export type PrintTableColumn = {
  key: string;
  title: string;
  visible: boolean;
  width?: number;
  align?: "left" | "center" | "right";
};

export type PrintElementType = "text" | "field" | "table" | "comment" | "terms" | "barcode" | "qrcode" | "signature" | "line" | "footer" | "pageNumber";

export type PrintLayoutElement = {
  id: string;
  type: PrintElementType;
  title: string;
  value?: string;
  field?: string;
  placeholder?: string;
  contentMode?: "static" | "field" | "instance";
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  draggable: boolean;
  resizable: boolean;
  required?: boolean;
  style?: {
    fontSize?: number;
    fontWeight?: number;
    bold?: boolean;
    align?: "left" | "center" | "right";
    bordered?: boolean;
    borderWidth?: number;
    lineHeight?: number;
  };
  tableColumns?: PrintTableColumn[];
};

export type PrintLayoutTemplate = {
  id: string;
  name: string;
  documentType: PrintDocumentType;
  isDefault?: boolean;
  version: number;
  page: PrintPageConfig;
  elements: PrintLayoutElement[];
  updatedAt?: string;
};

export type PrintDocumentData = Record<string, unknown> & {
  documentNo: string;
  companyName: string;
  lines: Array<Record<string, unknown>>;
};

export type PrintFieldOption = { key: string; label: string };

export type PrintInstanceOverrides = {
  documentType: PrintDocumentType;
  documentNo: string;
  values: Record<string, string>;
  updatedAt: string;
};

export const PAGE_SIZES = {
  portrait: { width: 794, height: 1123 },
  landscape: { width: 1123, height: 794 },
} as const;
