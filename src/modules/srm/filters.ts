import { supplierRelationshipKeys, type SupplierSrmRow } from "../../domain/srm/helpers";

export type SupplierFlagFilter = "全部" | "是" | "否";

export type SrmSupplierWorkbenchFilters = {
  supplier: string;
  category: string;
  riskStatus: string;
  certificationStatus: string;
  status: string;
  scoreFrom: string;
  scoreTo: string;
  hasOpenPo: SupplierFlagFilter;
  hasInvoiceVariance: SupplierFlagFilter;
  hasReconciliationException: SupplierFlagFilter;
};

export const defaultSrmSupplierWorkbenchFilters: SrmSupplierWorkbenchFilters = {
  supplier: "",
  category: "全部",
  riskStatus: "全部",
  certificationStatus: "全部",
  status: "全部",
  scoreFrom: "",
  scoreTo: "",
  hasOpenPo: "全部",
  hasInvoiceVariance: "全部",
  hasReconciliationException: "全部",
};

function normalized(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function matchesSelect(value: unknown, filterValue: string) {
  return filterValue === "全部" || normalized(value) === normalized(filterValue);
}

function parseNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function matchesFlag(filterValue: SupplierFlagFilter, actual: boolean) {
  if (filterValue === "全部") return true;
  return filterValue === "是" ? actual : !actual;
}

export function filterSrmSuppliersForWorkbench(
  rows: SupplierSrmRow[],
  filters: SrmSupplierWorkbenchFilters = defaultSrmSupplierWorkbenchFilters,
) {
  const supplierQuery = normalized(filters.supplier);
  const scoreFrom = parseNumber(filters.scoreFrom);
  const scoreTo = parseNumber(filters.scoreTo);

  return rows.filter((row) => {
    const supplierMatches = !supplierQuery || supplierRelationshipKeys(row.supplier).some((key) => key.includes(supplierQuery));
    const score = Number(row.rating);

    return supplierMatches
      && matchesSelect(row.category, filters.category)
      && matchesSelect(row.supplier.riskStatus, filters.riskStatus)
      && matchesSelect(row.supplier.certificationStatus, filters.certificationStatus)
      && matchesSelect(row.supplier.status, filters.status)
      && (scoreFrom === null || score >= scoreFrom)
      && (scoreTo === null || score <= scoreTo)
      && matchesFlag(filters.hasOpenPo, row.openPoCount > 0)
      && matchesFlag(filters.hasInvoiceVariance, row.invoiceVarianceCount > 0)
      && matchesFlag(filters.hasReconciliationException, Boolean(row.reconciliationException));
  });
}
