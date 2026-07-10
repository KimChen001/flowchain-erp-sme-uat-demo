import { BiDashboard } from "./BiDashboard";
import { ReportLibraryV2 } from "./ReportLibraryV2";
import type { DashboardView } from "./governedReports";

type NavigateFn = (moduleId: string, focusTarget?: { entityType: string; entityId: string } | null, options?: { returnTo?: string; entityLabel?: string; source?: string; returnContext?: unknown }) => void;
type ReportsPanelProps = { onNavigate?: NavigateFn; initialView?: DashboardView | "library" };
export const REPORT_DATA_SOURCE_LABEL = "API / 当前数据范围";

export default function ReportsPanel({ onNavigate, initialView = "overview" }: ReportsPanelProps) {
  if (initialView === "library") return <ReportLibraryV2 />;
  return <BiDashboard view={initialView} onNavigate={onNavigate} />;
}
