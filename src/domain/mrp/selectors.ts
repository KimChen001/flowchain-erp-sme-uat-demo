import type { MrpPlan, MrpPlanRow } from "./types";

export function selectMrpRow(plan: MrpPlan | null | undefined, sku: string): MrpPlanRow | null {
  return plan?.rows.find((row) => row.sku === sku) ?? null;
}
