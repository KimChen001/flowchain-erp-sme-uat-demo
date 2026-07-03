import { CheckCircle2, Clipboard, Edit3, FileClock, Save, X } from "lucide-react";
import { A, Chip } from "../../components/ui";
import { typography } from "../../components/ui/typography";

type PlanStep = {
  id?: string;
  order?: number;
  intent?: string;
  kind?: string;
  status?: string;
  condition?: string;
  dependsOn?: string;
  missingFields?: string[];
  corrections?: string[];
};

type BusinessDraft = {
  draftId?: string;
  draftType?: string;
  reviewStatus?: string;
  extractedFields?: Record<string, unknown>;
  suggestedFields?: Record<string, unknown>;
  missingFields?: string[];
  linkedRecords?: { type?: string; id?: string }[];
  evidence?: Record<string, unknown>[];
  dataLimitations?: string[];
  assumptions?: string[];
  auditPreview?: { action?: string; summary?: string }[];
};

export type BusinessActionPlanPanelProps = {
  originalText: string;
  normalizedText: string;
  corrections?: { from?: string; to?: string; message?: string }[];
  candidates?: { intent?: string; confidence?: number; requiresReview?: boolean }[];
  plan?: {
    planType?: string;
    steps?: PlanStep[];
    forbiddenAutonomousActions?: string[];
    auditPreview?: { action?: string; summary?: string }[];
  };
  drafts?: BusinessDraft[];
  onEditDraft?: () => void;
  onSaveDraft?: () => void;
  onConfirmSafeAction?: () => void;
  onMarkReviewed?: () => void;
  onCopyDraft?: () => void;
  onContinueFillingFields?: () => void;
  onCancel?: () => void;
};

const safeButtons = [
  { key: "edit", label: "Edit Draft", icon: Edit3 },
  { key: "save", label: "Save Draft", icon: Save },
  { key: "confirm", label: "Save Reviewed Draft", icon: CheckCircle2 },
  { key: "reviewed", label: "Mark Reviewed", icon: CheckCircle2 },
  { key: "copy", label: "Copy Draft", icon: Clipboard },
  { key: "continue", label: "Continue Filling Fields", icon: FileClock },
  { key: "cancel", label: "Cancel", icon: X },
] as const;

function formatValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "—";
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).filter(Boolean).slice(0, 3).join(" · ");
  return String(value);
}

function callbackFor(key: string, props: BusinessActionPlanPanelProps) {
  if (key === "edit") return props.onEditDraft;
  if (key === "save") return props.onSaveDraft;
  if (key === "confirm") return props.onConfirmSafeAction;
  if (key === "reviewed") return props.onMarkReviewed;
  if (key === "copy") return props.onCopyDraft;
  if (key === "continue") return props.onContinueFillingFields;
  return props.onCancel;
}

export function BusinessActionPlanPanel(props: BusinessActionPlanPanelProps) {
  const steps = props.plan?.steps || [];
  const drafts = props.drafts || [];
  return (
    <section className="space-y-4 rounded-lg border bg-white p-4" style={{ borderColor: A.border }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={typography.compactMetadata}>Business action plan</p>
          <h3 className={`${typography.subsectionTitle} break-words`}>{props.originalText}</h3>
          <p className={`${typography.metadata} mt-1 break-words`} style={{ color: A.sub }}>{props.normalizedText}</p>
        </div>
        <Chip label="Draft Only / Requires Review" color={A.blue} bg="#eef6ff" />
      </div>

      {!!props.corrections?.length && (
        <div className="grid gap-2">
          {props.corrections.map((item) => (
            <p key={`${item.from}-${item.to}`} className={typography.metadata} style={{ color: A.orange }}>
              {item.message || `我理解 "${item.from}" 是 "${item.to}"。`}
            </p>
          ))}
        </div>
      )}

      <div className="grid gap-2 md:grid-cols-2">
        {(props.candidates || []).map((candidate) => (
          <div key={candidate.intent} className="rounded-md border p-3" style={{ borderColor: A.border }}>
            <p className={typography.formLabel}>{candidate.intent}</p>
            <p className={typography.metadata} style={{ color: A.sub }}>
              confidence {Math.round((candidate.confidence || 0) * 100)}% · review {candidate.requiresReview ? "required" : "not required"}
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {steps.map((step, index) => (
          <div key={step.id || `${step.intent}-${index}`} className="rounded-md border p-3" style={{ borderColor: A.border }}>
            <div className="flex flex-wrap items-center gap-2">
              <Chip label={`Step ${step.order || index + 1}`} color={A.label} bg={A.gray5} />
              <span className={typography.formLabel}>{step.intent}</span>
              <Chip label={step.status || "requires_review"} color={step.status === "blocked" ? A.red : A.green} bg={step.status === "blocked" ? "#fff1f0" : "#ecfdf5"} />
            </div>
            {(step.condition || step.dependsOn) && (
              <p className={`${typography.metadata} mt-2`} style={{ color: A.sub }}>
                {step.condition || "requires prior step"} {step.dependsOn ? `· depends on ${step.dependsOn}` : ""}
              </p>
            )}
            {!!step.missingFields?.length && <p className={`${typography.metadata} mt-2`} style={{ color: A.orange }}>Missing: {step.missingFields.join(", ")}</p>}
          </div>
        ))}
      </div>

      {drafts.map((draft) => (
        <div key={draft.draftId} className="space-y-3 rounded-md border p-3" style={{ borderColor: A.border }}>
          <div className="flex flex-wrap items-center gap-2">
            <Chip label={draft.draftType || "business_draft"} color={A.blue} bg="#eef6ff" />
            <Chip label={draft.reviewStatus || "draft_only_requires_review"} color={A.green} bg="#ecfdf5" />
          </div>
          <FieldList title="Provided Fields" values={draft.extractedFields} />
          <FieldList title="Suggested Fields" values={draft.suggestedFields} />
          {!!draft.missingFields?.length && <p className={typography.metadata} style={{ color: A.orange }}>Missing fields: {draft.missingFields.join(", ")}</p>}
          {!!draft.dataLimitations?.length && <p className={typography.metadata} style={{ color: A.red }}>Data limitations: {draft.dataLimitations.join(", ")}</p>}
          {!!draft.auditPreview?.length && <p className={typography.metadata} style={{ color: A.sub }}>Audit preview: {draft.auditPreview.map((item) => item.action).join(", ")}</p>}
          <div className="rounded-md border p-3" style={{ borderColor: A.border, background: A.gray6 }}>
            <p className={typography.formLabel}>User-confirmed safe action boundary</p>
            <p className={`${typography.metadata} mt-1`} style={{ color: A.sub }}>Supported safe actions: Create Supplier Application · Create PR · Create Sourcing Event / RFQ Draft · Save Supplier Follow-up Note · Save Case Note · Save Reviewed Draft.</p>
            <p className={`${typography.metadata} mt-1`} style={{ color: A.sub }}>This will not submit for approval. This will not issue a PO. This will not send email. This will not award a supplier. This will not post inventory or invoice entries.</p>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        {safeButtons.map((button) => {
          const Icon = button.icon;
          return (
            <button
              key={button.key}
              type="button"
              onClick={callbackFor(button.key, props)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 ${typography.denseButton}`}
              style={{ background: button.key === "cancel" ? A.gray6 : "#f0f6ff", color: button.key === "cancel" ? A.sub : A.blue }}
            >
              <Icon size={14} />
              {button.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function FieldList({ title, values }: { title: string; values?: Record<string, unknown> }) {
  const entries = Object.entries(values || {});
  if (!entries.length) return null;
  return (
    <div>
      <p className={typography.formLabel}>{title}</p>
      <div className="mt-1 grid gap-1 md:grid-cols-2">
        {entries.map(([key, value]) => (
          <p key={key} className={typography.metadata} style={{ color: A.sub }}>
            {key}: {formatValue(value)}
          </p>
        ))}
      </div>
    </div>
  );
}
