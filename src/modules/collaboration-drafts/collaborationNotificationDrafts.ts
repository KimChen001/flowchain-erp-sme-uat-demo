import { apiJson } from "../../lib/api-client";

export type CollaborationNavigationLink = {
  label: string;
  moduleId: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  returnTo?: string;
  source?: string;
  reason?: string;
};

export type CollaborationDataLimitation = {
  label: string;
  description?: string;
  severity?: string;
  affectedModules?: string[];
};

export type CollaborationNotificationDraft = {
  id: string;
  draftNo: string;
  title: string;
  notificationType: string;
  notificationTypeLabel: string;
  channelType: string;
  channelLabel: string;
  audienceType: string;
  audienceLabel: string;
  recipientPreview: string[];
  sourceModule: string;
  sourceCategory: string;
  sourceObjectType: string;
  sourceObjectId: string;
  sourceObjectLabel: string;
  targetModule: string;
  targetEntityType: string;
  targetEntityId: string;
  targetEntityLabel: string;
  priority: "high" | "medium" | "low" | string;
  status: string;
  subject: string;
  messagePreview: string;
  keyEvidence: string[];
  businessImpact: string;
  requestedResponse: string;
  reviewChecklist: string[];
  missingInformation: string[];
  navigationLinks: CollaborationNavigationLink[];
  relatedActionDraftId?: string;
  relatedAiSuggestionId?: string;
  allowedActions: Array<{ label: string; previewOnly: boolean; reviewRequired: boolean }>;
  boundaryLabels: string[];
  dataLimitations: CollaborationDataLimitation[];
  auditPreview: {
    generatedAtLabel: string;
    sourceLabel: string;
    reviewRequirement: string;
    boundarySummary: string;
  };
  previewOnly: boolean;
  reviewRequired: boolean;
  requiresHumanReview: boolean;
};

export type NotificationChannelPolicy = {
  channelType: string;
  label: string;
  allowedUse: string[];
  boundarySummary: string;
  reviewRequired: boolean;
  previewOnly: boolean;
};

export type NotificationAudienceGroup = {
  audienceType: string;
  label: string;
  draftCount: number;
  highPriorityCount: number;
  dataLimitedCount: number;
  previewRecipients: string[];
};

export type NotificationSourceSummary = {
  sourceModule: string;
  sourceLabel: string;
  draftCount: number;
  highPriorityCount: number;
  dataLimitedCount: number;
  navigationLinks: CollaborationNavigationLink[];
};

export type CollaborationNotificationDraftsV2 = {
  summary: {
    totalDraftCount: number;
    internalDraftCount: number;
    supplierDraftCount: number;
    financeDraftCount: number;
    dataQualityDraftCount: number;
    receivingDraftCount: number;
    inventoryDraftCount: number;
    reportReviewDraftCount: number;
    highPriorityCount: number;
    dataLimitedCount: number;
    readyForReviewCount: number;
    overallStatusLabel: string;
  };
  drafts: CollaborationNotificationDraft[];
  channelPolicies: NotificationChannelPolicy[];
  audienceGroups: NotificationAudienceGroup[];
  sourceSummary: NotificationSourceSummary[];
  dataLimitations: CollaborationDataLimitation[];
  generatedAt: string;
  dataScopeLabel: string;
};

export function fetchCollaborationNotificationDrafts() {
  return apiJson<CollaborationNotificationDraftsV2>("/api/collaboration-notification-drafts");
}
