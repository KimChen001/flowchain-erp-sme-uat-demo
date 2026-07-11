import type { RfqRecord } from "../../types/scm";

export type RfqWorkbenchFilters = {
  query: string;
  rfqId: string;
  supplier: string;
  skuOrItem: string;
  category: string;
  status: string;
  responseStatus: "全部" | "未报价" | "部分报价" | "已报价";
  dueFrom: string;
  dueTo: string;
  sourceRequest: string;
  buyer: string;
};

export const defaultRfqWorkbenchFilters: RfqWorkbenchFilters = {
  query: "",
  rfqId: "",
  supplier: "",
  skuOrItem: "",
  category: "",
  status: "全部",
  responseStatus: "全部",
  dueFrom: "",
  dueTo: "",
  sourceRequest: "",
  buyer: "",
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

export function rfqResponseStatus(rfq: RfqRecord) {
  const quoted = Number(rfq.quoted || 0);
  const suppliers = Number(rfq.suppliers || 0);
  if (quoted <= 0) return "未报价";
  if (suppliers > 0 && quoted >= suppliers) return "已报价";
  return "部分报价";
}

function matchesSupplier(rfq: RfqRecord, query: string) {
  const suppliers = Array.isArray(rfq.invitedSuppliers) ? rfq.invitedSuppliers : [];
  return [rfq.bestSupplier, ...suppliers].some((value) => containsText(value, query));
}

function matchesSkuOrItem(rfq: RfqRecord, query: string) {
  return [rfq.sourceSku, rfq.sourceName, rfq.title].some((value) => containsText(value, query));
}

export function rfqMatchesWorkbenchFilters(rfq: RfqRecord, filters: RfqWorkbenchFilters) {
  if (filters.query && ![rfq.id, rfq.title, rfq.sourceSku, rfq.sourceName, rfq.sourceRequest, rfq.bestSupplier, ...(rfq.invitedSuppliers || [])].some((value) => containsText(value, filters.query))) return false;
  if (!filters.query && !containsText(rfq.id, filters.rfqId)) return false;
  if (!matchesSupplier(rfq, filters.supplier)) return false;
  if (!filters.query && !matchesSkuOrItem(rfq, filters.skuOrItem)) return false;
  if (!containsText(rfq.category, filters.category)) return false;
  if (filters.status !== "全部" && rfq.status !== filters.status) return false;
  if (filters.responseStatus !== "全部" && rfqResponseStatus(rfq) !== filters.responseStatus) return false;
  if (!dateInRange(rfq.due, filters.dueFrom, filters.dueTo)) return false;
  if (!containsText(rfq.sourceRequest, filters.sourceRequest)) return false;
  return true;
}

export function filterRfqsForWorkbench(rfqs: RfqRecord[], filters: RfqWorkbenchFilters) {
  return rfqs.filter((rfq) => rfqMatchesWorkbenchFilters(rfq, filters));
}
