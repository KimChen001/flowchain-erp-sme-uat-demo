import { apiJson } from "../../lib/api-client";

export type OperationSeverity = "info" | "warning" | "risk" | "success" | string;
export type OperationPriority = "P0" | "P1" | "P2" | "P3" | string;

export type OperationEvidence = {
  id: string;
  label: string;
  entityLabel: string;
  entityType: string;
  entityId: string;
  moduleId: string;
  evidenceType: string;
  summary: string;
  value?: string | number | null;
  status?: string;
  severity?: OperationSeverity;
  sourceLabel?: string;
  linkTarget?: { moduleId: string; entityType?: string; entityId?: string };
};

export type OperationNavigationLink = {
  label: string;
  moduleId: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  returnTo?: string;
  source?: string;
  reason?: string;
};

export type OperationReviewAction = {
  label: string;
  description: string;
  actionType: string;
  priority: string;
  reviewRequired: boolean;
  previewOnly: boolean;
  requiresHumanReview: boolean;
  targetModule?: string;
  targetEntityType?: string;
  targetEntityId?: string;
  draftType?: string;
  draftTitle?: string;
  payload?: Record<string, unknown>;
  boundary?: string;
};

export type OperationActionItem = {
  id: string;
  title: string;
  category: string;
  categoryLabel: string;
  severity: OperationSeverity;
  priority: OperationPriority;
  priorityScore: number;
  status: string;
  owner: string;
  ageLabel: string;
  dueLabel: string;
  businessObjectType: string;
  businessObjectId: string;
  businessObjectLabel: string;
  moduleId: string;
  entityType?: string;
  entityId?: string;
  reason: string;
  keyEvidence: OperationEvidence[];
  businessImpact: { area: string; impact: string; severity: OperationSeverity; explanation: string; affectedObjects?: string[] }[];
  suggestedNextStep: string;
  navigationLinks: OperationNavigationLink[];
  reviewActions: OperationReviewAction[];
  dataLimitations: { label: string; description: string; severity: OperationSeverity; missingData?: string[]; consequence?: string }[];
  blockedActions: string[];
  alignsWithAiToday?: boolean;
};

export type OperationsControlTowerResponse = {
  summary: {
    totalOpenItems: number;
    riskCount: number;
    warningCount: number;
    overdueCount: number;
    draftAvailableCount: number;
    dataGapCount: number;
    topPriorityLabel: string;
  };
  items: OperationActionItem[];
  generatedAt: string;
  dataScopeLabel: string;
  limitations: { label: string; description: string; severity: OperationSeverity; missingData?: string[]; consequence?: string }[];
  aiAlignment?: { intent: string; sharedEvidenceCount: number; topCategories: string[] };
};

export function fetchOperationsControlTower() {
  return apiJson<OperationsControlTowerResponse>("/api/operations-control-tower");
}
