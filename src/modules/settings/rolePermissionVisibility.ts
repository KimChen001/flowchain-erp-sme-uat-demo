import { apiJson } from "../../lib/api-client";

export type RolePermissionNavigationLink = {
  label: string;
  moduleId: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  returnTo?: string;
  source?: string;
  reason?: string;
};

export type RolePermissionDataLimitation = {
  label: string;
  description?: string;
  severity?: string;
  affectedModules?: string[];
};

export type RoleProfile = {
  id: string;
  roleLabel: string;
  roleCode: string;
  roleGroup: string;
  businessPurpose: string;
  userPreviewCount: number;
  userPreviewLabels: string[];
  visibleModules: string[];
  visibleObjects: string[];
  reviewScopes: string[];
  draftScopes: string[];
  dataScopes: string[];
  restrictedScopes: string[];
  boundaryLabels: string[];
  navigationLinks: RolePermissionNavigationLink[];
  dataLimitations: RolePermissionDataLimitation[];
};

export type PermissionBundle = {
  id: string;
  bundleLabel: string;
  businessPurpose: string;
  includedRoles: string[];
  visibleModules: string[];
  visibleObjects: string[];
  draftCapabilities: string[];
  reviewCapabilities: string[];
  restrictedCapabilities: string[];
  boundaryLabels: string[];
  navigationLinks: RolePermissionNavigationLink[];
};

export type DocumentPermissionRow = {
  documentType: string;
  documentLabel: string;
  visibleToRoles: string[];
  draftPreviewRoles: string[];
  reviewRoles: string[];
  dataOwnerRoles: string[];
  restrictedRoles: string[];
  boundarySummary: string;
  navigationLinks: RolePermissionNavigationLink[];
};

export type ReviewChainVisibility = {
  id: string;
  chainLabel: string;
  appliesTo: string;
  triggerConditionLabel: string;
  reviewRoles: string[];
  observerRoles: string[];
  escalationPreview: string;
  boundaryLabels: string[];
  navigationLinks: RolePermissionNavigationLink[];
};

export type DataScopeGroup = {
  id: string;
  scopeLabel: string;
  appliesToRoles: string[];
  includedModules: string[];
  includedObjects: string[];
  limitationSummary: string;
  navigationLinks: RolePermissionNavigationLink[];
};

export type ModuleVisibilityRow = {
  id: string;
  moduleLabel: string;
  moduleId: string;
  visibleToRoles: string[];
  reviewRoles: string[];
  draftOnlyRoles: string[];
  restrictedActionSummary: string;
  sourceModule: string;
  navigationLinks: RolePermissionNavigationLink[];
};

export type ReviewPermissionPolicy = {
  id: string;
  policyLabel: string;
  appliesToModule: string;
  allowedRoles: string[];
  reviewRequired: boolean;
  previewOnly: boolean;
  boundaryLabels: string[];
  sourceModule: string;
  navigationLinks: RolePermissionNavigationLink[];
};

export type RestrictedActionPolicy = {
  id: string;
  actionLabel: string;
  appliesTo: string;
  restrictedReason: string;
  safeAlternative: string;
  boundaryLabels: string[];
  sourceModule: string;
  navigationLinks: RolePermissionNavigationLink[];
};

export type PermissionReviewDraft = {
  id: string;
  title: string;
  draftType: string;
  sourceModule: string;
  targetRole: string;
  targetModule: string;
  status: string;
  priority: string;
  conclusion: string;
  proposedPermissionPreview: string;
  keyEvidence: string[];
  reviewChecklist: string[];
  missingInformation: string[];
  boundaryLabels: string[];
  navigationLinks: RolePermissionNavigationLink[];
  dataLimitations: RolePermissionDataLimitation[];
  previewOnly: boolean;
  reviewRequired: boolean;
  requiresHumanReview: boolean;
};

export type UserRolePermissionVisibilityV2 = {
  summary: {
    roleCount: number;
    activeUserPreviewCount: number;
    permissionBundleCount: number;
    documentPermissionCount: number;
    reviewChainCount: number;
    dataScopeGroupCount: number;
    moduleVisibilityCount: number;
    reviewPermissionCount: number;
    restrictedActionCount: number;
    permissionDraftCount: number;
    dataLimitedCount: number;
    readinessLabel: string;
  };
  roleProfiles: RoleProfile[];
  permissionBundles: PermissionBundle[];
  documentPermissionMatrix: DocumentPermissionRow[];
  reviewChainVisibility: ReviewChainVisibility[];
  dataScopeGroups: DataScopeGroup[];
  moduleVisibilityMatrix: ModuleVisibilityRow[];
  reviewPermissionPolicies: ReviewPermissionPolicy[];
  restrictedActionPolicies: RestrictedActionPolicy[];
  permissionReviewDrafts: PermissionReviewDraft[];
  sourceSummary: Array<{ sourceModule: string; sourceLabel: string; signalCount: number; navigationLinks: RolePermissionNavigationLink[] }>;
  dataLimitations: RolePermissionDataLimitation[];
  generatedAt: string;
  dataScopeLabel: string;
};

export function fetchUserRolePermissionVisibility() {
  return apiJson<UserRolePermissionVisibilityV2>("/api/user-role-permission-visibility");
}
