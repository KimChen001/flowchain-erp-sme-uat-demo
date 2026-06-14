import type { MrpBomEvidence, MrpPlanRow, MrpScheduleEvidenceLine } from "./types";

export function buildMrpBomSourceSummary(row: MrpPlanRow | null, unit: string): string {
  return row?.bomSources?.length
    ? row.bomSources
      .map((source) => `${source.parentName || source.parent} ${Number(source.demand || 0).toLocaleString()} ${unit}`)
      .join("；")
    : "";
}

export function buildMrpScheduleEvidence(row: MrpPlanRow | null): MrpScheduleEvidenceLine[] {
  return row?.schedule
    .filter((line) => line.dependentDemand > 0 || line.plannedReceipt > 0)
    .slice(0, 6)
    .map((line) => ({
      period: line.period,
      grossRequirement: line.grossRequirement,
      independentDemand: line.independentDemand,
      dependentDemand: line.dependentDemand,
      plannedReceipt: line.plannedReceipt,
      plannedReleasePeriod: line.plannedReleasePeriod,
      exception: line.exception,
      sources: line.dependentDemandSources || [],
    })) || [];
}

export function buildMrpBomEvidence(row: MrpPlanRow | null): MrpBomEvidence | null {
  return row ? {
    bomSources: row.bomSources || [],
    dependentDemandTotal: row.schedule.reduce((sum, line) => sum + Number(line.dependentDemand || 0), 0),
    grossRequirementTotal: row.schedule.reduce((sum, line) => sum + Number(line.grossRequirement || 0), 0),
    schedule: buildMrpScheduleEvidence(row),
  } : null;
}
