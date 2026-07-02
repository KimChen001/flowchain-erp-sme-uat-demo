import { Brain, FileText, Link2, ShieldCheck, X } from "lucide-react";
import { A, Card, Chip } from "../ui";
import type { ContextualAiAction, ContextualAiLinkedRecord } from "../../domain/contextual-ai/actions";

export type ContextualAIInsight = {
  title: string;
  sourceContext: string;
  trigger: string;
  conclusion: string;
  riskLevel?: string;
  reason?: string;
  evidence: string[];
  impact: string[];
  recommendedActions: ContextualAiAction[];
  linkedRecords: ContextualAiLinkedRecord[];
  limitations: string[];
  provenance: string;
  auditPreview?: string;
};

function actionTone(action: ContextualAiAction) {
  return action.allowedOutputType === "draft_preview"
    ? { color: A.orange, bg: "#fff8f0" }
    : { color: A.blue, bg: "#f0f6ff" };
}

export function ContextualAIInsightPanel({
  insight,
  onClose,
  onAction,
}: {
  insight: ContextualAIInsight | null;
  onClose: () => void;
  onAction?: (action: ContextualAiAction) => void;
}) {
  if (!insight) return null;
  return (
    <Card className="p-4" style={{ border: `1px solid ${A.blue}33` }} data-testid="contextual-ai-insight-panel">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Chip label="Contextual AI insight" color={A.blue} bg="#f0f6ff" />
            <Chip label="Review-first" color={A.green} bg="#f0faf4" />
            <Chip label="No mutation" color={A.gray1} bg={A.gray6} />
          </div>
          <h3 className="mt-2 text-sm font-semibold" style={{ color: A.label }}>{insight.title}</h3>
          <div className="mt-1 text-[11px] leading-5" style={{ color: A.sub }}>{insight.sourceContext} · {insight.trigger}</div>
        </div>
        <button onClick={onClose} className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center" style={{ color: A.gray1, background: A.gray6 }}>
          <X size={14} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-3">
        <div className="space-y-3">
          <div className="rounded-xl p-3" style={{ background: A.gray6 }}>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: A.label }}><Brain size={12} /> Conclusion</div>
            <div className="mt-1 text-xs leading-5" style={{ color: A.sub }}>{insight.conclusion}</div>
            {(insight.riskLevel || insight.reason) && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-lg px-2.5 py-2" style={{ background: A.white }}>
                  <div className="text-[10px]" style={{ color: A.gray2 }}>Risk level</div>
                  <div className="text-[11px] font-semibold" style={{ color: insight.riskLevel === "高" ? A.red : A.label }}>{insight.riskLevel || "未标注"}</div>
                </div>
                <div className="rounded-lg px-2.5 py-2" style={{ background: A.white }}>
                  <div className="text-[10px]" style={{ color: A.gray2 }}>Reason</div>
                  <div className="text-[11px] font-semibold truncate" style={{ color: A.label }}>{insight.reason || "当前数据未提供明确原因，建议复核相关记录。"}</div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Section title="Key evidence" items={insight.evidence} />
            <Section title="Business impact" items={insight.impact} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl p-3" style={{ background: "#f0f6ff" }}>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: A.blue }}><ShieldCheck size={12} /> Recommended actions</div>
            <div className="mt-2 space-y-2">
              {insight.recommendedActions.map((action) => {
                const tone = actionTone(action);
                return (
                  <button
                    key={action.id}
                    onClick={() => onAction?.(action)}
                    className="w-full rounded-lg px-2.5 py-2 text-left"
                    style={{ background: A.white, color: tone.color, boxShadow: `0 0 0 0.5px ${A.border}` }}
                  >
                    <div className="text-[11px] font-semibold">{action.label}</div>
                    <div className="mt-0.5 text-[10px]" style={{ color: A.gray2 }}>
                      {action.allowedOutputType} · requiresReview: true · mutationAllowed: false
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <LinkedRecords records={insight.linkedRecords} />
            <Section title="Data limitations" items={insight.limitations} />
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-xl p-3 text-[11px] leading-5" style={{ background: A.gray6, color: A.sub }}>
        <span className="font-semibold" style={{ color: A.gray1 }}>Provenance:</span> {insight.provenance}
        {insight.auditPreview && <span> · <span className="font-semibold" style={{ color: A.gray1 }}>Audit preview:</span> {insight.auditPreview}</span>}
      </div>
    </Card>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl p-3" style={{ background: A.gray6 }}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: A.label }}><FileText size={12} /> {title}</div>
      <div className="mt-2 space-y-1.5">
        {(items.length ? items : ["No current data available."]).map((item) => (
          <div key={item} className="text-[11px] leading-5" style={{ color: A.sub }}>{item}</div>
        ))}
      </div>
    </div>
  );
}

function LinkedRecords({ records }: { records: ContextualAiLinkedRecord[] }) {
  return (
    <div className="rounded-xl p-3" style={{ background: A.gray6 }}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: A.label }}><Link2 size={12} /> Linked records</div>
      <div className="mt-2 space-y-1.5">
        {(records.length ? records : [{ type: "limitation", id: "No linked records found" }]).map((record) => (
          <div key={`${record.type}-${record.id}`} className="rounded-lg px-2 py-1.5" style={{ background: A.white }}>
            <div className="text-[10px]" style={{ color: A.gray2 }}>{record.type}</div>
            <div className="text-[11px] font-semibold truncate" style={{ color: A.label }}>{record.id}{record.label ? ` · ${record.label}` : ""}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
