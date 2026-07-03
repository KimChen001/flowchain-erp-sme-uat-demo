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
  { key: "edit", label: "编辑草稿", icon: Edit3 },
  { key: "save", label: "保存草稿", icon: Save },
  { key: "confirm", label: "保存已复核草稿", icon: CheckCircle2 },
  { key: "reviewed", label: "标记为已复核", icon: CheckCircle2 },
  { key: "copy", label: "复制草稿", icon: Clipboard },
  { key: "continue", label: "继续补充字段", icon: FileClock },
  { key: "cancel", label: "取消", icon: X },
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
          <p className={typography.compactMetadata}>业务动作计划</p>
          <h3 className={`${typography.subsectionTitle} break-words`}>{props.originalText}</h3>
          <p className={`${typography.metadata} mt-1 break-words`} style={{ color: A.sub }}>{props.normalizedText}</p>
        </div>
        <Chip label="仅生成草稿 / 需人工复核" color={A.blue} bg="#eef6ff" />
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
              置信度 {Math.round((candidate.confidence || 0) * 100)}% · {candidate.requiresReview ? "需要复核" : "无需复核"}
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {steps.map((step, index) => (
          <div key={step.id || `${step.intent}-${index}`} className="rounded-md border p-3" style={{ borderColor: A.border }}>
            <div className="flex flex-wrap items-center gap-2">
              <Chip label={`步骤 ${step.order || index + 1}`} color={A.label} bg={A.gray5} />
              <span className={typography.formLabel}>{step.intent}</span>
              <Chip label={step.status || "requires_review"} color={step.status === "blocked" ? A.red : A.green} bg={step.status === "blocked" ? "#fff1f0" : "#ecfdf5"} />
            </div>
            {(step.condition || step.dependsOn) && (
              <p className={`${typography.metadata} mt-2`} style={{ color: A.sub }}>
                {step.condition || "需要先完成前置步骤"} {step.dependsOn ? `· 依赖 ${step.dependsOn}` : ""}
              </p>
            )}
            {!!step.missingFields?.length && <p className={`${typography.metadata} mt-2`} style={{ color: A.orange }}>缺少字段：{step.missingFields.join(", ")}</p>}
          </div>
        ))}
      </div>

      {drafts.map((draft) => (
        <div key={draft.draftId} className="space-y-3 rounded-md border p-3" style={{ borderColor: A.border }}>
          <div className="flex flex-wrap items-center gap-2">
            <Chip label={draft.draftType || "business_draft"} color={A.blue} bg="#eef6ff" />
            <Chip label={draft.reviewStatus || "draft_only_requires_review"} color={A.green} bg="#ecfdf5" />
          </div>
          <FieldList title="已识别字段" values={draft.extractedFields} />
          <FieldList title="建议字段" values={draft.suggestedFields} />
          {!!draft.missingFields?.length && <p className={typography.metadata} style={{ color: A.orange }}>缺少字段：{draft.missingFields.join(", ")}</p>}
          {!!draft.dataLimitations?.length && <p className={typography.metadata} style={{ color: A.red }}>数据限制：{draft.dataLimitations.join(", ")}</p>}
          {!!draft.auditPreview?.length && <p className={typography.metadata} style={{ color: A.sub }}>审计预览：{draft.auditPreview.map((item) => item.action).join(", ")}</p>}
          <div className="rounded-md border p-3" style={{ borderColor: A.border, background: A.gray6 }}>
            <p className={typography.formLabel}>用户确认安全边界</p>
            <p className={`${typography.metadata} mt-1`} style={{ color: A.sub }}>支持的安全动作：创建供应商准入申请、创建 PR、创建寻源事件 / RFQ 草稿、保存供应商跟进备注、保存工单备注、保存已复核草稿。</p>
            <p className={`${typography.metadata} mt-1`} style={{ color: A.sub }}>不会自动提交审批、不会下发 PO、不会发送邮件、不会授标，也不会自动库存或发票过账。</p>
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
