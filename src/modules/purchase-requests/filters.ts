import type { Priority, PurchaseRequest, PurchaseRequestStatus } from "../../types/scm";

export type PurchaseRequestWorkbenchFilters = {
  prNumber: string;
  supplier: string;
  skuOrItem: string;
  requester: string;
  buyer: string;
  status: "全部" | PurchaseRequestStatus;
  priority: "全部" | Priority;
  source: string;
  requiredFrom: string;
  requiredTo: string;
};

export const defaultPurchaseRequestWorkbenchFilters: PurchaseRequestWorkbenchFilters = {
  prNumber: "",
  supplier: "",
  skuOrItem: "",
  requester: "",
  buyer: "",
  status: "全部",
  priority: "全部",
  source: "全部",
  requiredFrom: "",
  requiredTo: "",
};

function normalizedText(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function containsText(value: unknown, query: string) {
  const needle = normalizedText(query);
  if (!needle) return true;
  return normalizedText(value).includes(needle);
}

function parseWorkbenchDate(value: unknown, referenceYear = new Date().getFullYear()) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const zh = raw.match(/(\d{1,2})月(\d{1,2})日/);
  if (zh) {
    const date = new Date(referenceYear, Number(zh[1]) - 1, Number(zh[2]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function dateInRange(value: unknown, from: string, to: string) {
  const fromDate = parseWorkbenchDate(from);
  const toDate = parseWorkbenchDate(to);
  if (!fromDate && !toDate) return true;
  const valueDate = parseWorkbenchDate(value, fromDate?.getFullYear() || toDate?.getFullYear() || new Date().getFullYear());
  if (!valueDate) return true;
  if (fromDate && valueDate < fromDate) return false;
  if (toDate && valueDate > toDate) return false;
  return true;
}

function matchesSkuOrItem(request: PurchaseRequest, query: string) {
  const needle = normalizedText(query);
  if (!needle) return true;
  return [request.sourceSku, request.sourceName].some((value) => containsText(value, needle));
}

export function purchaseRequestMatchesWorkbenchFilters(
  request: PurchaseRequest,
  filters: PurchaseRequestWorkbenchFilters,
) {
  if (!containsText(request.pr, filters.prNumber)) return false;
  if (!containsText(request.supplier, filters.supplier)) return false;
  if (!matchesSkuOrItem(request, filters.skuOrItem)) return false;
  if (!containsText(request.requester, filters.requester)) return false;
  if (!containsText(request.buyer, filters.buyer)) return false;
  if (filters.status !== "全部" && request.status !== filters.status) return false;
  if (filters.priority !== "全部" && request.priority !== filters.priority) return false;
  if (filters.source !== "全部" && request.source !== filters.source) return false;
  if (!dateInRange(request.requiredDate, filters.requiredFrom, filters.requiredTo)) return false;
  return true;
}

export function filterPurchaseRequestsForWorkbench(
  requests: PurchaseRequest[],
  filters: PurchaseRequestWorkbenchFilters,
) {
  return requests.filter((request) => purchaseRequestMatchesWorkbenchFilters(request, filters));
}
