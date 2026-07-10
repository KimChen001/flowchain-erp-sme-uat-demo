import { apiJson } from "../../lib/api-client";

export type DashboardView = "overview" | "procurement" | "sales" | "inventory" | "finance" | "suppliers";
export type MetricDefinition = { id: string; label: string; description: string; subject: string; unit: string; format: string; aggregation: string; numerator: string; denominator: string | null; dateField: string; applicableFilters: string[]; drilldownPath: string; emptyValue: number; version: string; value: number };
export type ReportChart = { id: string; title: string; type: string; data?: Array<{ name?: string; period?: string; value: number }>; series?: Array<{ key: string; label: string; data: Array<{ period: string; value: number }> }>; drilldownPath: string };
export type GovernedReport = {
  query: Record<string, unknown>; generatedAt: string; dataScope: { label: string; company: string; currency: string; from: string; to: string; activeFilterCount: number };
  kpis: MetricDefinition[]; charts: ReportChart[]; rankings: ReportChart[]; details: Record<string, unknown>[]; warnings: string[]; limitations: string[];
  drilldowns: Array<{ metricId: string; path: string }>; exportRows: Record<string, unknown>[]; metricDefinitions: Omit<MetricDefinition, "value">[];
};
export type SavedReportView = { viewId: string; name: string; description: string; ownerId: string; ownerName: string; subject: string; sourceRoute: string; columns: string[]; filters: Record<string, string>; sorting: unknown[]; grouping: string[]; measures: string[]; visualization: string; visibility: "private" | "team"; isDefault: boolean; createdAt: string; updatedAt: string; lastOpenedAt: string; version: number };

export function fetchGovernedReport(view: DashboardView, filters: Record<string, string>) {
  return apiJson<GovernedReport>("/api/reports/query", { method: "POST", body: JSON.stringify({ subject: view, filters, limit: 50 }) });
}
export function listSavedReportViews(visibility = "") { return apiJson<{ views: SavedReportView[]; actor: { id: string; role: string } }>(`/api/report-views${visibility ? `?visibility=${visibility}` : ""}`); }
export function createSavedReportView(input: Partial<SavedReportView>) { return apiJson<{ view: SavedReportView; auditEventId: string }>("/api/report-views", { method: "POST", body: JSON.stringify(input) }); }
export function updateSavedReportView(id: string, input: Partial<SavedReportView>) { return apiJson<{ view: SavedReportView }>(`/api/report-views/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(input) }); }
export function cloneSavedReportView(id: string, name?: string) { return apiJson<{ view: SavedReportView }>(`/api/report-views/${encodeURIComponent(id)}/clone`, { method: "POST", body: JSON.stringify({ name }) }); }
export function deleteSavedReportView(id: string) { return apiJson<{ deleted: true }>(`/api/report-views/${encodeURIComponent(id)}`, { method: "DELETE" }); }
