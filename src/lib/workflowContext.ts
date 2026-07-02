export type WorkflowContext = {
  sourceModule: string;
  sourceEntityType?: string;
  sourceEntityId?: string;
  sourceRoute?: string;
  sourceLabel?: string;
  originIntent?: string;
  sourceQuery?: string;
  aiTrigger?: string;
  returnLabel?: string;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function compactContext(context: WorkflowContext) {
  return {
    sourceModule: clean(context.sourceModule) || "overview",
    sourceEntityType: clean(context.sourceEntityType),
    sourceEntityId: clean(context.sourceEntityId),
    sourceRoute: clean(context.sourceRoute),
    sourceLabel: clean(context.sourceLabel),
    originIntent: clean(context.originIntent),
    sourceQuery: clean(context.sourceQuery).slice(0, 80),
    aiTrigger: clean(context.aiTrigger).slice(0, 80),
    returnLabel: clean(context.returnLabel),
  };
}

export function buildReturnContext(input: WorkflowContext | null | undefined): WorkflowContext | null {
  if (!input?.sourceModule) return null;
  const context = compactContext(input);
  return {
    sourceModule: context.sourceModule,
    ...(context.sourceEntityType ? { sourceEntityType: context.sourceEntityType } : {}),
    ...(context.sourceEntityId ? { sourceEntityId: context.sourceEntityId } : {}),
    ...(context.sourceRoute ? { sourceRoute: context.sourceRoute } : {}),
    ...(context.sourceLabel ? { sourceLabel: context.sourceLabel } : {}),
    ...(context.originIntent ? { originIntent: context.originIntent } : {}),
    ...(context.sourceQuery ? { sourceQuery: context.sourceQuery } : {}),
    ...(context.aiTrigger ? { aiTrigger: context.aiTrigger } : {}),
    ...(context.returnLabel ? { returnLabel: context.returnLabel } : {}),
  };
}

export function encodeReturnContext(context: WorkflowContext | null | undefined) {
  const safe = buildReturnContext(context);
  if (!safe) return "";
  try {
    return encodeURIComponent(JSON.stringify(safe));
  } catch {
    return "";
  }
}

export function parseReturnContext(value: string | null | undefined): WorkflowContext | null {
  const raw = clean(value);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    if (!parsed || typeof parsed !== "object" || !clean(parsed.sourceModule)) return null;
    return buildReturnContext(parsed as WorkflowContext);
  } catch {
    return null;
  }
}

export function buildReturnUrl(route: string, context: WorkflowContext | null | undefined) {
  const target = clean(route) || "overview";
  const encoded = encodeReturnContext(context);
  if (!encoded) return target;
  return `${target}${target.includes("?") ? "&" : "?"}returnTo=${encoded}`;
}

export function formatReturnLabel(context: WorkflowContext | null | undefined) {
  const safe = buildReturnContext(context);
  if (!safe) return "Back to previous workflow";
  if (safe.returnLabel) return safe.returnLabel;
  if (safe.sourceLabel) return `Back to ${safe.sourceLabel}`;
  if (safe.sourceEntityId) return `Back to ${safe.sourceEntityId}`;
  if (safe.sourceModule === "overview" || safe.sourceModule === "todayCockpit") return "Back to Today Cockpit";
  return "Back to previous workflow";
}
