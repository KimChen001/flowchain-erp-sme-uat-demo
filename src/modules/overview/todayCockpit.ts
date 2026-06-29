import { apiJson } from "../../lib/api-client";

export type TodayCockpitSeverity = "high" | "medium" | "low" | string;

export type TodayCockpitEvidence = {
  type?: string;
  id?: string;
  label?: string;
  status?: string;
  route?: string;
  summary?: string;
};

export type TodayCockpitTarget = {
  module?: string;
  entityType?: string;
  entityId?: string;
  documentType?: string;
};

export type TodayCockpitCard = {
  id: string;
  title: string;
  value: number | string;
  subtitle: string;
  severity: TodayCockpitSeverity;
  module: string;
  evidence?: TodayCockpitEvidence[];
  target?: TodayCockpitTarget;
  route?: string;
  valueKind?: "currency" | string;
  currency?: string;
};

export type TodayCockpitFollowup = {
  id: string;
  type: string;
  severity: TodayCockpitSeverity;
  title: string;
  message?: string;
  summary?: string;
  status: string;
  dueDate?: string;
  supplierName?: string;
  documentType?: string;
  documentId?: string;
  evidence?: TodayCockpitEvidence;
};

export type TodayCockpitInventoryRisk = {
  id: string;
  type: string;
  sku?: string;
  itemName?: string;
  warehouse?: string;
  availableQuantity?: number | null;
  reorderPoint?: number | null;
  safetyStock?: number | null;
  unit?: string;
  severity: TodayCockpitSeverity;
  status?: string;
  nextAction?: string;
  route?: string;
  target?: TodayCockpitTarget;
  evidence?: TodayCockpitEvidence[];
};

export type TodayCockpitDocument = {
  type: "pr" | "rfq" | "po" | "grn" | "invoice" | "threeWayMatch" | string;
  id: string;
  title: string;
  status: string;
  supplier?: string;
  amount?: number;
  currency?: string;
  date?: string;
  route?: string;
  target?: TodayCockpitTarget;
  evidence?: TodayCockpitEvidence[];
};

export type TodayCockpitMovement = {
  id: string;
  type: string;
  label?: string;
  sku?: string;
  itemName?: string;
  warehouse?: string;
  sourceDocument?: string;
  quantityIn?: number;
  quantityOut?: number;
  adjustmentQty?: number;
  unit?: string;
  status?: string;
  date?: string;
  route?: string;
  target?: TodayCockpitTarget;
  evidence?: TodayCockpitEvidence[];
};

export type TodayCockpitAction = {
  id: string;
  priority: TodayCockpitSeverity;
  title: string;
  reason?: string;
  nextAction?: string;
  module?: string;
  route?: string;
  target?: TodayCockpitTarget;
  evidence?: TodayCockpitEvidence[];
};

export type TodayCockpitResponse = {
  summary: Record<string, number | string>;
  cards: TodayCockpitCard[];
  followups: TodayCockpitFollowup[];
  inventoryRisks: TodayCockpitInventoryRisk[];
  recentDocuments: TodayCockpitDocument[];
  recentMovements: TodayCockpitMovement[];
  recommendedActions: TodayCockpitAction[];
  evidence: Record<string, unknown>;
};

export function fetchTodayCockpit() {
  return apiJson<TodayCockpitResponse>("/api/today-cockpit");
}
