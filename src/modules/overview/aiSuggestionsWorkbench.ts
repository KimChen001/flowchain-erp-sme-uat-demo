import { apiJson } from "../../lib/api-client";

export type AiSuggestionPriority = "high" | "medium" | "low" | string;

export type AiSuggestionNavigationLink = {
  label: string;
  moduleId: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  returnTo?: string;
  source?: string;
  reason?: string;
};

export type AiSuggestionDataLimitation = {
  label: string;
  description?: string;
  severity?: string;
};

export type AiSuggestionDraftPreview = {
  id: string;
  title: string;
  draftType: string;
  sourceSuggestionId: string;
  sourceObjectLabel: string;
  targetModule: string;
  targetEntityType: string;
  targetEntityId: string;
  targetEntityLabel: string;
  previewSummary: string;
  reviewRequired: boolean;
  requiresHumanReview?: boolean;
  previewOnly: boolean;
  navigationLinks: AiSuggestionNavigationLink[];
  dataLimitations: AiSuggestionDataLimitation[];
};

export type AiSuggestionItem = {
  id: string;
  title: string;
  category: string;
  categoryLabel: string;
  priority: AiSuggestionPriority;
  sourceModule: string;
  sourceObjectType: string;
  sourceObjectId: string;
  sourceObjectLabel: string;
  conclusion: string;
  whyNow: string;
  keyEvidence: string[];
  businessImpact: string;
  suggestedAction: string;
  navigationLinks: AiSuggestionNavigationLink[];
  draftPreview?: AiSuggestionDraftPreview;
  dataLimitations: AiSuggestionDataLimitation[];
  reviewRequired: boolean;
  previewOnly: boolean;
  boundaryLabels: string[];
};

export type AiSuggestionAuditRow = {
  id: string;
  generatedAtLabel: string;
  suggestionTitle: string;
  sourceObjectLabel: string;
  evidenceSourceLabel: string;
  outputType: string;
  reviewRequirement: string;
  dataLimitationSummary: string;
  navigationLinks: AiSuggestionNavigationLink[];
};

export type AiSuggestionsWorkbenchV2 = {
  summary: {
    totalSuggestionCount: number;
    poSuggestionCount: number;
    inventorySuggestionCount: number;
    supplierSuggestionCount: number;
    financeSuggestionCount: number;
    dataQualitySuggestionCount: number;
    highPriorityCount: number;
    draftAvailableCount: number;
    dataLimitedCount: number;
    overallStatusLabel: string;
  };
  suggestions: AiSuggestionItem[];
  draftPreviews: AiSuggestionDraftPreview[];
  auditTrail: AiSuggestionAuditRow[];
  dataLimitations: AiSuggestionDataLimitation[];
  generatedAt: string;
  dataScopeLabel: string;
};

export function fetchAiSuggestionsWorkbench() {
  return apiJson<AiSuggestionsWorkbenchV2>("/api/ai-suggestions-workbench");
}
