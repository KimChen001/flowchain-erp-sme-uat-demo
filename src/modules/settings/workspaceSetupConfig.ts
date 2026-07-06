import { apiJson } from "../../lib/api-client";

export type WorkspaceSetupNavigationLink = {
  label: string;
  moduleId: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  returnTo?: string;
  source?: string;
  reason?: string;
};

export type WorkspaceSetupDataLimitation = {
  label: string;
  description?: string;
  severity?: string;
  affectedModules?: string[];
};

export type WorkspaceModuleSetting = {
  id: string;
  moduleLabel: string;
  moduleGroup: string;
  statusLabel: string;
  operatingMode: string;
  reviewModeLabel: string;
  visibleEntryLabel: string;
  keyObjects: string[];
  connectedInsights: string[];
  configurationNotes: string[];
  navigationLinks: WorkspaceSetupNavigationLink[];
  dataLimitations: WorkspaceSetupDataLimitation[];
};

export type WorkspaceReviewPolicy = {
  id: string;
  policyLabel: string;
  appliesTo: string[];
  reviewRequirement: string;
  allowedUse: string;
  boundaryLabels: string[];
  sourceModule: string;
  navigationLinks: WorkspaceSetupNavigationLink[];
};

export type WorkspaceNumberingRule = {
  objectType: string;
  objectLabel: string;
  prefix: string;
  example: string;
  statusLabel: string;
  reviewRequired: boolean;
  sourceModule: string;
};

export type WorkspaceDataQualitySetting = {
  id: string;
  settingLabel: string;
  sourceModule: string;
  mappedFieldsCount: number;
  issueCount: number;
  affectedModules: string[];
  suggestedReview: string;
  navigationLinks: WorkspaceSetupNavigationLink[];
  dataLimitations: WorkspaceSetupDataLimitation[];
};

export type WorkspaceAiAssistanceBoundary = {
  id: string;
  boundaryLabel: string;
  allowedUse: string;
  restrictedUseBusinessWording: string;
  reviewRequired: boolean;
  previewOnly: boolean;
  relatedModule: string;
  navigationLinks: WorkspaceSetupNavigationLink[];
};

export type WorkspaceCollaborationDraftPolicy = {
  channelType: string;
  policyLabel: string;
  allowedUse: string[];
  boundarySummary: string;
  reviewRequired: boolean;
  previewOnly: boolean;
  navigationLinks: WorkspaceSetupNavigationLink[];
};

export type WorkspaceSetupReviewDraft = {
  id: string;
  title: string;
  draftType: string;
  sourceModule: string;
  targetModule: string;
  status: string;
  priority: string;
  conclusion: string;
  proposedConfigPreview: string;
  keyEvidence: string[];
  reviewChecklist: string[];
  boundaryLabels: string[];
  navigationLinks: WorkspaceSetupNavigationLink[];
  dataLimitations: WorkspaceSetupDataLimitation[];
  previewOnly: boolean;
  reviewRequired: boolean;
  requiresHumanReview: boolean;
};

export type WorkspaceSetupSourceSummary = {
  sourceModule: string;
  sourceLabel: string;
  statusLabel: string;
  insightCount: number;
  navigationLinks: WorkspaceSetupNavigationLink[];
};

export type WorkspaceSetupConfigV2 = {
  summary: {
    enabledModuleCount: number;
    reviewFirstModuleCount: number;
    draftOnlyPolicyCount: number;
    dataQualityIssueCount: number;
    aiBoundaryCount: number;
    collaborationPolicyCount: number;
    configDraftCount: number;
    setupReadinessLabel: string;
  };
  workspaceProfile: {
    workspaceName: string;
    businessScopeLabel: string;
    operatingModeLabel: string;
    dataScopeLabel: string;
    setupStatusLabel: string;
  };
  moduleSettings: WorkspaceModuleSetting[];
  reviewPolicies: WorkspaceReviewPolicy[];
  numberingRules: WorkspaceNumberingRule[];
  dataQualitySettings: WorkspaceDataQualitySetting[];
  aiAssistanceBoundaries: WorkspaceAiAssistanceBoundary[];
  collaborationDraftPolicies: WorkspaceCollaborationDraftPolicy[];
  setupReviewDrafts: WorkspaceSetupReviewDraft[];
  sourceSummary: WorkspaceSetupSourceSummary[];
  dataLimitations: WorkspaceSetupDataLimitation[];
  generatedAt: string;
};

export function fetchWorkspaceSetupConfig() {
  return apiJson<WorkspaceSetupConfigV2>("/api/workspace-setup-config");
}
