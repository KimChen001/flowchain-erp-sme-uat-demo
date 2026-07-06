import { apiJson } from "../../lib/api-client";

export type BoundaryNavigationLink = {
  label: string;
  moduleId: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  returnTo?: string;
  source?: string;
  reason?: string;
};

export type BoundaryDataLimitation = {
  label: string;
  description?: string;
  severity?: string;
  affectedModules?: string[];
};

export type WorkspaceBoundaryVisibilityV2 = {
  summary: {
    boundaryScopeCount: number;
    dataOwnershipGroupCount: number;
    moduleBoundaryCount: number;
    documentBoundaryCount: number;
    aiBoundarySignalCount: number;
    collaborationBoundaryCount: number;
    roleBoundaryCount: number;
    dataQualityBoundaryIssueCount: number;
    boundaryDraftCount: number;
    dataLimitedCount: number;
    readinessLabel: string;
  };
  workspaceBoundaryProfile: {
    workspaceName: string;
    businessScopeLabel: string;
    operatingModeLabel: string;
    dataScopeLabel: string;
    boundaryStatusLabel: string;
    reviewModeLabel: string;
    boundaryPrinciples: string[];
  };
  boundaryScopes: Array<{
    id: string;
    scopeLabel: string;
    scopeGroup: string;
    businessPurpose: string;
    includedModules: string[];
    includedObjects: string[];
    allowedUse: string;
    boundarySummary: string;
    reviewRequired: boolean;
    previewOnly: boolean;
    navigationLinks: BoundaryNavigationLink[];
    dataLimitations: BoundaryDataLimitation[];
  }>;
  dataOwnershipGroups: Array<{
    id: string;
    ownerLabel: string;
    ownerRole: string;
    ownedObjects: string[];
    ownedModules: string[];
    stewardshipScope: string;
    reviewResponsibilities: string[];
    boundarySummary: string;
    navigationLinks: BoundaryNavigationLink[];
    dataLimitations: BoundaryDataLimitation[];
  }>;
  moduleBoundaryMatrix: Array<{
    id: string;
    moduleLabel: string;
    moduleId: string;
    boundaryGroup: string;
    dataUsed: string[];
    producedInsights: string[];
    reviewOutputs: string[];
    downstreamConsumers: string[];
    boundarySummary: string;
    navigationLinks: BoundaryNavigationLink[];
  }>;
  documentBoundaryMatrix: Array<{
    id: string;
    objectLabel: string;
    objectGroup: string;
    sourceModule: string;
    relatedModules: string[];
    boundaryOwnerRole: string;
    evidenceUse: string;
    aiUse: string;
    reviewUse: string;
    collaborationUse: string;
    restrictedUseSummary: string;
    navigationLinks: BoundaryNavigationLink[];
  }>;
  aiBoundaryAwareness: Array<{
    id: string;
    signalLabel: string;
    sourceModule: string;
    allowedAiUse: string;
    requiredEvidence: string[];
    dataLimitations: BoundaryDataLimitation[];
    reviewBoundary: string;
    restrictedUseSummary: string;
    navigationLinks: BoundaryNavigationLink[];
  }>;
  collaborationBoundaryPolicies: Array<{
    id: string;
    policyLabel: string;
    collaborationType: string;
    sourceChannelPolicy: string;
    allowedUse: string[];
    boundarySummary: string;
    reviewRequired: boolean;
    previewOnly: boolean;
    navigationLinks: BoundaryNavigationLink[];
  }>;
  roleBoundaryVisibility: Array<{
    id: string;
    roleLabel: string;
    roleGroup: string;
    visibleBoundaryScopes: string[];
    documentBoundaryAccess: string[];
    dataScopeAccess: string[];
    reviewBoundaryScopes: string[];
    restrictedBoundarySummary: string;
    navigationLinks: BoundaryNavigationLink[];
  }>;
  dataQualityBoundarySignals: Array<{
    id: string;
    signalLabel: string;
    sourceModule: string;
    affectedBoundaryScopes: string[];
    affectedObjects: string[];
    impactSummary: string;
    suggestedReview: string;
    navigationLinks: BoundaryNavigationLink[];
    dataLimitations: BoundaryDataLimitation[];
  }>;
  boundaryReviewDrafts: Array<{
    id: string;
    title: string;
    draftType: string;
    sourceModule: string;
    targetBoundaryScope: string;
    targetOwnerRole: string;
    status: string;
    priority: string;
    conclusion: string;
    proposedBoundaryPreview: string;
    keyEvidence: string[];
    reviewChecklist: string[];
    missingInformation: string[];
    boundaryLabels: string[];
    navigationLinks: BoundaryNavigationLink[];
    dataLimitations: BoundaryDataLimitation[];
    previewOnly: boolean;
    reviewRequired: boolean;
    requiresHumanReview: boolean;
  }>;
  sourceSummary: Array<{ sourceModule: string; sourceLabel: string; signalCount: number; navigationLinks: BoundaryNavigationLink[] }>;
  dataLimitations: BoundaryDataLimitation[];
  generatedAt: string;
  dataScopeLabel: string;
};

export function fetchWorkspaceBoundaryVisibility() {
  return apiJson<WorkspaceBoundaryVisibilityV2>("/api/workspace-boundary-visibility");
}
