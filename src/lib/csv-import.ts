import { csvEscape, downloadTextFile } from "./data-export";

export type CsvRow = Record<string, string>;

const HEADER_ALIASES: Record<string, string> = {
  sku: "SKU",
  "物料编码": "SKU",
  "产品编码": "SKU",
  "品名": "品名",
  "物料名称": "品名",
  "产品名称": "品名",
  qty: "数量",
  quantity: "数量",
  "数量": "数量",
  price: "单价",
  unitprice: "单价",
  "单价": "单价",
  supplier: "供应商",
  "供应商": "供应商",
  customer: "客户",
  "客户": "客户",
};

export function normalizeHeader(header: string) {
  const trimmed = header.replace(/^\ufeff/, "").trim();
  const key = trimmed.toLowerCase().replace(/\s+/g, "");
  return HEADER_ALIASES[key] || HEADER_ALIASES[trimmed] || trimmed;
}

export function parseCsvText(text: string): CsvRow[] {
  const rows = parseCsvMatrix(text.replace(/^\ufeff/, ""));
  const first = rows.find((row) => row.some((cell) => cell.trim() !== ""));
  if (!first) return [];
  const firstIndex = rows.indexOf(first);
  const headers = first.map(normalizeHeader);
  return rows.slice(firstIndex + 1)
    .filter((row) => row.some((cell) => cell.trim() !== ""))
    .map((row) => {
      const out: CsvRow = {};
      headers.forEach((header, index) => {
        if (!header) return;
        out[header] = (row[index] ?? "").trim();
      });
      return out;
    });
}

export function csvTemplateText(headers: string[], sampleRows: Record<string, unknown>[] = []) {
  const lines = [
    headers.map(csvEscape).join(","),
    ...sampleRows.map((row) => headers.map((header) => csvEscape(row[header] as any)).join(",")),
  ];
  return `\ufeff${lines.join("\r\n")}`;
}

export function downloadCsvTemplate(filename: string, headers: string[], sampleRows: Record<string, unknown>[] = []) {
  downloadTextFile(filename, csvTemplateText(headers, sampleRows), "text/csv;charset=utf-8");
}

export function validateRequiredFields(row: CsvRow, requiredFields: string[]) {
  return requiredFields.filter((field) => !String(row[field] ?? "").trim());
}

export function parseNumber(value: string | undefined) {
  const normalized = String(value ?? "").replace(/,/g, "").trim();
  if (normalized === "") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parsePositiveNumber(value: string | undefined) {
  const parsed = parseNumber(value);
  return parsed != null && parsed > 0 ? parsed : null;
}

export function parseNonNegativeNumber(value: string | undefined) {
  const parsed = parseNumber(value);
  return parsed != null && parsed >= 0 ? parsed : null;
}

export function parseInteger(value: string | undefined) {
  const parsed = parseNumber(value);
  return parsed != null && Number.isInteger(parsed) ? parsed : null;
}

export function parseDateLike(value: string | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

function parseCsvMatrix(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      if (char === "\r" && next === "\n") i++;
      continue;
    }
    cell += char;
  }
  row.push(cell);
  rows.push(row);
  return rows;
}
