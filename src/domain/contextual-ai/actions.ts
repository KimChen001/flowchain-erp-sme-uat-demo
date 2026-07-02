export type ContextualAiIntent =
  | "explain_po_delay"
  | "explain_sku_shortage"
  | "analyze_supplier_risk"
  | "trace_receiving_exception"
  | "trace_invoice_matching_failure"
  | "preview_replenishment_draft"
  | "preview_supplier_followup_draft"
  | "preview_exception_note"
  | "preview_invoice_resolution_note";

export type ContextualAiLinkedRecord = {
  type: string;
  id: string;
  label?: string;
  route?: string;
};

export type ContextualAiAction = {
  id: string;
  label: string;
  intent: ContextualAiIntent;
  sourceModule: string;
  sourceEntityType: string;
  sourceEntityId: string;
  sourceRoute: string;
  linkedRecords: ContextualAiLinkedRecord[];
  allowedOutputType: "insight" | "draft_preview";
  requiresReview: true;
  mutationAllowed: false;
};

export type ContextualAiActionInput = {
  intent: ContextualAiIntent;
  sourceModule: string;
  sourceEntityType: string;
  sourceEntityId: string;
  sourceRoute: string;
  linkedRecords?: ContextualAiLinkedRecord[];
  allowedOutputType?: ContextualAiAction["allowedOutputType"];
  label?: string;
};

const intentLabels: Record<ContextualAiIntent, string> = {
  explain_po_delay: "Explain delay for",
  explain_sku_shortage: "Explain shortage for",
  analyze_supplier_risk: "Analyze supplier risk for",
  trace_receiving_exception: "Trace receiving exception for",
  trace_invoice_matching_failure: "Explain matching failure for",
  preview_replenishment_draft: "Preview replenishment PR draft for",
  preview_supplier_followup_draft: "Preview supplier follow-up draft for",
  preview_exception_note: "Preview exception handling note for",
  preview_invoice_resolution_note: "Preview resolution note for",
};

export function buildContextualAiAction(input: ContextualAiActionInput): ContextualAiAction {
  const label = input.label || `${intentLabels[input.intent]} ${input.sourceEntityId}`;
  return {
    id: `${input.intent}:${input.sourceEntityType}:${input.sourceEntityId}`,
    label,
    intent: input.intent,
    sourceModule: input.sourceModule,
    sourceEntityType: input.sourceEntityType,
    sourceEntityId: input.sourceEntityId,
    sourceRoute: input.sourceRoute,
    linkedRecords: input.linkedRecords || [],
    allowedOutputType: input.allowedOutputType || (input.intent.startsWith("preview_") ? "draft_preview" : "insight"),
    requiresReview: true,
    mutationAllowed: false,
  };
}

export function assertContextualAiActionSafe(action: ContextualAiAction) {
  return action.requiresReview === true && action.mutationAllowed === false;
}
