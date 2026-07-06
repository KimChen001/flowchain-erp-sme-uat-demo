import { apiJson } from "../../lib/api-client";

export type AuditNavigationLink = {
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

export type AuditDataLimitation = {
  label: string;
  description?: string;
  severity?: string;
  affectedModules?: string[];
};

export type AuditTimelineItem = {
  id: string;
  occurredAtLabel: string;
  category: string;
  categoryLabel: string;
  title: string;
  sourceModule: string;
  sourceObjectLabel: string;
  targetObjectLabel: string;
  actorRoleLabel: string;
  priority: string;
  status: string;
  summary: string;
  keyEvidence: string[];
  reviewRequired: boolean;
  dataLimited: boolean;
  boundaryLabels: string[];
  navigationLinks: AuditNavigationLink[];
  dataLimitations: AuditDataLimitation[];
};

export type AuditIntegrationHistoryV2 = {
  summary: {
    totalHistoryCount: number;
    aiHistoryCount: number;
    actionDraftHistoryCount: number;
    collaborationHistoryCount: number;
    dataQualityHistoryCount: number;
    setupGovernanceHistoryCount: number;
    rolePermissionHistoryCount: number;
    boundaryHistoryCount: number;
    businessObjectHistoryCount: number;
    highPriorityCount: number;
    dataLimitedCount: number;
    reviewRequiredCount: number;
    readinessLabel: string;
  };
  historyProfile: {
    workspaceName: string;
    businessScopeLabel: string;
    dataScopeLabel: string;
    historyModeLabel: string;
    reviewModeLabel: string;
    historyPrinciples: string[];
  };
  timeline: AuditTimelineItem[];
  aiSuggestionHistory: Array<Record<string, any>>;
  reviewDraftHistory: Array<Record<string, any>>;
  collaborationDraftHistory: Array<Record<string, any>>;
  dataAccessHistory: Array<Record<string, any>>;
  settingsGovernanceHistory: Array<Record<string, any>>;
  rolePermissionHistory: Array<Record<string, any>>;
  boundaryReviewHistory: Array<Record<string, any>>;
  businessObjectHistory: Array<Record<string, any>>;
  sourceSummary: Array<Record<string, any>>;
  dataLimitations: AuditDataLimitation[];
  generatedAt: string;
  dataScopeLabel: string;
};

export function fetchAuditIntegrationHistory() {
  return apiJson<AuditIntegrationHistoryV2>("/api/audit-integration-history");
}
