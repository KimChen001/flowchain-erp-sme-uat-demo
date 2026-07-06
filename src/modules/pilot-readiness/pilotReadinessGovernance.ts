import { apiJson } from "../../lib/api-client";

export type PilotNavigationLink = {
  label: string;
  moduleId: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  returnTo?: string;
  source?: string;
  reason?: string;
  returnContext?: unknown;
};

export type PilotDataLimitation = {
  label: string;
  description?: string;
  severity?: string;
  affectedModules?: string[];
};

export type PilotSummary = {
  overallReadinessScore: number;
  readyModuleCount: number;
  reviewNeededModuleCount: number;
  blockedItemCount: number;
  observationItemCount: number;
  dataReadinessScore: number;
  aiReadinessScore: number;
  governanceReadinessScore: number;
  reviewWorkflowReadinessScore: number;
  collaborationReadinessScore: number;
  auditHistoryReadinessScore: number;
  pilotDraftCount: number;
  dataLimitedCount: number;
  readinessLabel: string;
};

export type PilotReadinessGovernanceV2 = {
  summary: PilotSummary;
  readinessProfile: {
    workspaceName: string;
    businessScopeLabel: string;
    dataScopeLabel: string;
    readinessModeLabel: string;
    reviewModeLabel: string;
    readinessPrinciples: string[];
  };
  pilotScope: {
    scopeLabel: string;
    includedModules: string[];
    includedBusinessObjects: string[];
    includedGovernanceAreas: string[];
    excludedActivities: string[];
    readinessSummary: string;
    navigationLinks: PilotNavigationLink[];
  };
  moduleReadinessMatrix: Array<Record<string, any>>;
  dataReadinessAssessment: Array<Record<string, any>>;
  aiReadinessAssessment: Array<Record<string, any>>;
  reviewWorkflowReadiness: Array<Record<string, any>>;
  collaborationReadiness: Array<Record<string, any>>;
  governanceReadiness: Array<Record<string, any>>;
  auditHistoryReadiness: Array<Record<string, any>>;
  riskAndBlockerItems: Array<Record<string, any>>;
  pilotReviewChecklist: Array<Record<string, any>>;
  pilotReviewDrafts: Array<Record<string, any>>;
  sourceSummary: Array<Record<string, any>>;
  dataLimitations: PilotDataLimitation[];
  generatedAt: string;
  dataScopeLabel: string;
};

export function fetchPilotReadinessGovernance() {
  return apiJson<PilotReadinessGovernanceV2>("/api/pilot-readiness-governance");
}
