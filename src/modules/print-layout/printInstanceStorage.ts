import type { PrintDocumentType, PrintInstanceOverrides } from "./printLayoutTypes";

export function printInstanceStorageKey(documentType: PrintDocumentType, documentNo: string) {
  return `flowchain:print-instance:${documentType}:${documentNo}`;
}

export function loadPrintInstance(documentType: PrintDocumentType, documentNo: string): PrintInstanceOverrides {
  try {
    const stored = JSON.parse(localStorage.getItem(printInstanceStorageKey(documentType, documentNo)) || "null") as PrintInstanceOverrides | null;
    if (stored?.documentType === documentType && stored.documentNo === documentNo && stored.values) return stored;
  } catch { /* Recover with an empty, document-scoped instance. */ }
  return { documentType, documentNo, values: {}, updatedAt: "" };
}

export function savePrintInstance(documentType: PrintDocumentType, documentNo: string, values: Record<string, string>) {
  const instance: PrintInstanceOverrides = { documentType, documentNo, values, updatedAt: new Date().toISOString() };
  localStorage.setItem(printInstanceStorageKey(documentType, documentNo), JSON.stringify(instance));
  return instance;
}

export function clearPrintInstance(documentType: PrintDocumentType, documentNo: string) {
  localStorage.removeItem(printInstanceStorageKey(documentType, documentNo));
}
