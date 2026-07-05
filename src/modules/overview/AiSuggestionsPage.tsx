import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Boxes,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  Info,
  Link2,
  Package,
  ShieldCheck,
  ShoppingCart,
  Users,
} from "lucide-react";
import { A, Card, Chip, RecoveryActions } from "../../components/ui";
import { typography } from "../../components/ui/typography";
import type { ActionDraftPreviewRequest } from "../action-drafts/ActionDraftReviewShell";
import {
  fetchAiSuggestionsWorkbench,
  type AiSuggestionDraftPreview,
  type AiSuggestionItem,
  type AiSuggestionNavigationLink,
  type AiSuggestionsWorkbenchV2,
} from "./aiSuggestionsWorkbench";

type NavigateFn = (moduleId: string, focusTarget?: { entityType: string; entityId: string } | null, options?: { returnTo?: string; entityLabel?: string; source?: string; returnContext?: unknown }) => void;

const priorityStyles: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  high: { label: "高优先级", color: A.red, bg: "#fff1f0", dot: A.blue },
  medium: { label: "中优先级", color: A.orange, bg: "#fff8f0", dot: A.green },
  low: { label: "低优先级", color: A.blue, bg: "#eef4ff", dot: A.purple },
};

const categoryStyles: Record<string, { icon: typeof ShoppingCart; color: string; bg: string }> = {
  po: { icon: ShoppingCart, color: A.blue, bg: "#eef4ff" },
  inventory: { icon: Package, color: A.green, bg: "#ecfdf5" },
  supplier: { icon: Users, color: A.purple, bg: "#f5f3ff" },
  finance: { icon: CircleDollarSign, color: A.orange, bg: "#fff7ed" },
  data_quality: { icon: ShieldCheck, color: A.gray1, bg: A.gray6 },
};

function priorityStyle(priority = "") {
  return priorityStyles[priority] || priorityStyles.medium;
}

function categoryStyle(category = "") {
  return categoryStyles[category] || categoryStyles.data_quality;
}

function scrollButtonClass(primary = false) {
  return `inline-flex h-9 items-center justify-center rounded-md px-4 text-[13px] font-semibold transition-colors ${primary ? "text-white" : "border"}`;
}

function text(value: unknown, fallback = "—") {
  const next = String(value ?? "").trim();
  return next || fallback;
}

function focusFrom(link?: Pick<AiSuggestionNavigationLink, "entityType" | "entityId"> | null) {
  if (!link?.entityType || !link.entityId) return null;
  return { entityType: link.entityType, entityId: link.entityId };
}

function draftRequestFromSuggestion(item: AiSuggestionItem): ActionDraftPreviewRequest {
  const draft = item.draftPreview;
  const primary = draft?.navigationLinks?.[0] || item.navigationLinks[0];
  return {
    type: draft?.draftType || "exception_note",
    title: draft?.title || `${item.sourceObjectLabel} 内部复核草稿`,
    source: "ai_suggestions_workbench",
    originEvidence: item.navigationLinks.slice(0, 4).map((link) => ({
      type: link.entityType,
      id: link.entityId,
      label: link.entityLabel || link.label,
      status: item.categoryLabel,
      summary: link.reason || item.conclusion,
    })),
    payload: {
      relatedDocumentId: primary?.entityId || item.sourceObjectId,
      relatedDocumentType: primary?.entityType || item.sourceObjectType,
      reason: item.whyNow,
      message: draft?.previewSummary || item.suggestedAction,
      itemIdOrSku: item.category === "inventory" ? item.sourceObjectId : undefined,
      supplierIdOrName: item.category === "supplier" ? item.sourceObjectLabel : undefined,
      poId: item.category === "po" ? item.sourceObjectId : undefined,
    },
  };
}

function draftRequestFromPreview(draft: AiSuggestionDraftPreview): ActionDraftPreviewRequest {
  return {
    type: draft.draftType || "exception_note",
    title: draft.title,
    source: "ai_suggestions_workbench",
    originEvidence: draft.navigationLinks.slice(0, 4).map((link) => ({
      type: link.entityType,
      id: link.entityId,
      label: link.entityLabel || link.label,
      summary: link.reason || draft.previewSummary,
    })),
    payload: {
      relatedDocumentId: draft.targetEntityId,
      relatedDocumentType: draft.targetEntityType,
      reason: draft.previewSummary,
      message: draft.previewSummary,
      itemIdOrSku: draft.targetEntityType === "inventory_item" ? draft.targetEntityId : undefined,
      supplierIdOrName: draft.targetEntityType === "supplier" ? draft.targetEntityLabel : undefined,
      poId: draft.targetEntityType === "purchase_order" ? draft.targetEntityId : undefined,
    },
  };
}

function NavButton({ link, onNavigate }: { link: AiSuggestionNavigationLink; onNavigate: NavigateFn }) {
  return (
    <button
      type="button"
      data-testid="ai-suggestion-nav-link"
      onClick={() => onNavigate(link.moduleId, focusFrom(link), {
        returnTo: "overview:ai",
        entityLabel: link.entityLabel || link.label,
        source: "aiSuggestionsWorkbench",
        returnContext: {
          sourceModule: "overview",
          sourceRoute: "overview:ai",
          sourceLabel: "AI 建议",
          returnLabel: "返回 AI 建议",
          originIntent: "aiSuggestionsWorkbench",
        },
      })}
      className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12px] font-semibold"
      style={{ background: "#eef4ff", color: A.blue }}
    >
      <Link2 size={13} /> {link.label}
    </button>
  );
}

function SummaryCards({ workbench }: { workbench: AiSuggestionsWorkbenchV2 }) {
  const cards = [
    { title: "PO 建议", value: workbench.summary.poSuggestionCount, tag: "到货跟进", category: "po" },
    { title: "库存建议", value: workbench.summary.inventorySuggestionCount, tag: "可承诺复核", category: "inventory" },
    { title: "供应商建议", value: workbench.summary.supplierSuggestionCount, tag: "风险说明", category: "supplier" },
    { title: "财务建议", value: workbench.summary.financeSuggestionCount, tag: "差异复核", category: "finance" },
    { title: "高优先级", value: workbench.summary.highPriorityCount, tag: workbench.summary.overallStatusLabel, category: "data_quality" },
    { title: "数据限制", value: workbench.summary.dataLimitedCount, tag: "需说明", category: "data_quality" },
  ];

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
      {cards.map((card) => {
        const style = categoryStyle(card.category);
        const Icon = style.icon;
        return (
          <Card key={card.title} className="rounded-[20px] p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full" style={{ background: style.bg, color: style.color }}>
                <Icon size={24} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold" style={{ color: A.label }}>{card.title}</div>
                <div className="mt-1 text-[26px] leading-8 font-bold tabular-nums" style={{ color: A.label }}>{card.value}</div>
                <Chip label={card.tag} color={style.color} bg={style.bg} />
              </div>
            </div>
          </Card>
        );
      })}
    </section>
  );
}

export default function AiSuggestionsPage({
  onNavigate,
  onReviewActionDraft,
}: {
  onNavigate: NavigateFn;
  onReviewActionDraft?: (request: ActionDraftPreviewRequest) => void;
}) {
  const [workbench, setWorkbench] = useState<AiSuggestionsWorkbenchV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchAiSuggestionsWorkbench()
      .then((data) => {
        if (!alive) return;
        setWorkbench(data);
        setError(false);
        setSelectedId((current) => current || data.suggestions[0]?.id || "");
      })
      .catch(() => {
        if (!alive) return;
        setWorkbench(null);
        setError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  const selected = useMemo(() => {
    if (!workbench?.suggestions.length) return null;
    return workbench.suggestions.find((item) => item.id === selectedId) || workbench.suggestions[0];
  }, [selectedId, workbench]);

  function previewDraft(request: ActionDraftPreviewRequest) {
    onReviewActionDraft?.(request);
  }

  if (loading) {
    return (
      <Card className="p-6" data-testid="ai-suggestions-workbench">
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-48 rounded" style={{ background: A.gray5 }} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-24 rounded-[20px]" style={{ background: A.gray6 }} />)}
          </div>
          <div className="h-80 rounded-[20px]" style={{ background: A.gray6 }} />
        </div>
      </Card>
    );
  }

  if (error || !workbench) {
    return (
      <Card className="p-6" data-testid="ai-suggestions-workbench">
        <h1 className="text-[24px] leading-8 font-bold tracking-normal" style={{ color: A.label }}>AI 建议</h1>
        <div className="mt-3 text-sm" style={{ color: A.red }}>AI 建议暂不可用，请稍后重试。</div>
        <div className="mt-4">
          <RecoveryActions actions={[{ key: "reload", label: "重新加载", onClick: () => window.location.reload(), kind: "list" }]} />
        </div>
      </Card>
    );
  }

  const selectedPriority = priorityStyle(selected?.priority);

  return (
    <div className="space-y-4" data-testid="ai-suggestions-workbench">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[24px] leading-8 font-bold tracking-normal" style={{ color: A.label }}>AI 建议</h1>
            <Chip label={workbench.dataScopeLabel} color={A.green} bg="#ecfdf5" />
          </div>
          <div className="mt-2 inline-flex max-w-4xl items-start gap-2 rounded-md px-3 py-2 text-[13px] leading-5" style={{ background: "#eef4ff", color: A.blue }}>
            <Info size={15} className="mt-0.5 shrink-0" />
            <span>AI 仅生成解释、证据整理与行动草稿；所有动作需人工复核，不形成审批、下单、资金处理或外发动作。</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a href="#ai-suggestions-list" className={scrollButtonClass(true)} style={{ background: A.blue }}>查看今日建议</a>
          <a href="#ai-draft-review" className={scrollButtonClass()} style={{ borderColor: A.border, color: A.label, background: A.white }}>查看待复核草稿</a>
          <a href="#ai-audit-log" className={scrollButtonClass()} style={{ borderColor: A.border, color: A.label, background: A.white }}>查看审计记录</a>
        </div>
      </section>

      <SummaryCards workbench={workbench} />

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(460px,0.92fr)_minmax(620px,1.08fr)]" id="ai-suggestions-list">
        <Card className="rounded-[20px] p-4">
          <h2 className={typography.sectionTitle} style={{ color: A.label }}>AI 建议列表</h2>
          <div className="mt-3 space-y-3">
            {workbench.suggestions.map((item) => {
              const style = priorityStyle(item.priority);
              const category = categoryStyle(item.category);
              const active = item.id === selected?.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className="w-full rounded-xl border px-4 py-3 text-left transition-colors"
                  style={{ borderColor: active ? A.blue : A.border, background: active ? "#f8fbff" : A.white }}
                  data-testid="ai-suggestion-row"
                >
                  <div className="grid grid-cols-[12px_auto_1fr_auto_16px] items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: style.dot }} />
                    <div className="flex flex-col gap-1">
                      <Chip label={style.label} color={style.color} bg={style.bg} />
                      <Chip label={item.categoryLabel} color={category.color} bg={category.bg} />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-semibold" style={{ color: A.label }}>{item.title}</div>
                      <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-[12px]" style={{ color: A.sub }}>
                        <span>来源对象：<span style={{ color: A.blue }}>{item.sourceObjectLabel}</span></span>
                        <span>影响：{item.businessImpact}</span>
                      </div>
                      <div className="mt-1 truncate text-[12px]" style={{ color: A.gray1 }}>证据：{item.keyEvidence[0] || "待人工复核"}</div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {item.draftPreview && <Chip label="草稿预览" color={A.blue} bg="#eef4ff" />}
                      {item.dataLimitations.length > 0 && <Chip label="数据限制" color={A.orange} bg="#fff7ed" />}
                    </div>
                    <ArrowRight size={15} style={{ color: A.gray2 }} />
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="rounded-[20px] p-4" data-testid="ai-suggestion-detail">
          {selected ? (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className={typography.sectionTitle} style={{ color: A.label }}>建议详情</h2>
                <div className="flex flex-wrap gap-2">
                  <Chip label={selected.categoryLabel} color={categoryStyle(selected.category).color} bg={categoryStyle(selected.category).bg} />
                  <Chip label={selectedPriority.label} color={selectedPriority.color} bg={selectedPriority.bg} />
                </div>
              </div>
              <div className="overflow-hidden rounded-xl border" style={{ borderColor: A.border }}>
                <div className="flex items-center gap-2 px-4 py-3" style={{ background: A.white, borderBottom: `1px solid ${A.border}` }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: A.blue }} />
                  <h3 className="text-[14px] font-semibold" style={{ color: A.label }}>{selected.title}</h3>
                </div>
                {[
                  { label: "结论", icon: ClipboardCheck, body: selected.conclusion, bg: "#eef4ff", color: A.blue },
                  { label: "为什么建议优先处理", icon: Info, body: selected.whyNow, bg: "#fff7ed", color: A.orange },
                  { label: "关键证据", icon: FileText, body: selected.keyEvidence, bg: "#ecfdf5", color: A.green },
                  { label: "业务影响", icon: ShieldCheck, body: selected.businessImpact, bg: "#fff7ed", color: A.orange },
                  { label: "建议动作", icon: ArrowRight, body: selected.suggestedAction, bg: "#f5f3ff", color: A.purple },
                  { label: "数据限制", icon: Info, body: selected.dataLimitations.length ? selected.dataLimitations.map((item) => `${item.label}：${item.description || "需要人工确认"}`) : ["当前无额外限制"], bg: A.gray6, color: A.gray1 },
                  { label: "边界说明", icon: ShieldCheck, body: selected.boundaryLabels, bg: "#eef4ff", color: A.blue },
                ].map((row, index) => {
                  const Icon = row.icon;
                  return (
                    <div key={row.label} className="grid grid-cols-[154px_1fr] gap-4 px-4 py-3" style={{ borderTop: index ? `1px solid ${A.border}` : "none", background: index % 2 ? "#fbfdff" : A.white }}>
                      <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: A.label }}>
                        <span className="flex h-7 w-7 items-center justify-center rounded-md" style={{ background: row.bg, color: row.color }}><Icon size={15} /></span>
                        {row.label}
                      </div>
                      <div className="text-[13px] leading-6" style={{ color: A.sub }}>
                        {Array.isArray(row.body) ? (
                          <ul className="list-disc space-y-1 pl-4">
                            {row.body.map((entry) => <li key={entry}>{entry}</li>)}
                          </ul>
                        ) : row.body}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 rounded-xl border p-3" style={{ borderColor: A.border, background: A.white }}>
                <div className="mb-2 text-[13px] font-semibold" style={{ color: A.label }}>可点击跳转</div>
                <div className="flex flex-wrap gap-2">
                  {selected.navigationLinks.map((link) => <NavButton key={`${link.moduleId}-${link.entityType}-${link.entityId}-${link.label}`} link={link} onNavigate={onNavigate} />)}
                  {selected.draftPreview?.navigationLinks.slice(1).map((link) => <NavButton key={`${link.moduleId}-${link.entityType}-${link.entityId}-${link.label}`} link={link} onNavigate={onNavigate} />)}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-[12px] leading-5" style={{ color: A.sub }}>内部复核 · 草稿预览 · 人工确认后再进入后续流程。</div>
                <button
                  type="button"
                  onClick={() => previewDraft(draftRequestFromSuggestion(selected))}
                  className="inline-flex h-9 items-center justify-center rounded-md px-4 text-[13px] font-semibold text-white"
                  style={{ background: A.blue }}
                >
                  生成跟进草稿
                </button>
              </div>
            </>
          ) : (
            <div className="text-sm" style={{ color: A.sub }}>当前没有可展示的 AI 建议。</div>
          )}
        </Card>
      </section>

      <section id="ai-draft-review">
        <h2 className={`${typography.sectionTitle} mb-3`} style={{ color: A.label }}>待人工复核草稿</h2>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {workbench.draftPreviews.slice(0, 6).map((draft) => {
            const Icon = draft.draftType === "purchase_request_draft" ? Boxes : draft.draftType === "supplier_followup_draft" ? Users : FileText;
            return (
              <Card key={draft.id} className="rounded-[20px] p-4" data-testid="ai-draft-preview-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: "#eef4ff", color: A.blue }}>
                      <Icon size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-semibold" style={{ color: A.label }}>{draft.title}</div>
                      <div className="mt-1 text-[12px] leading-5" style={{ color: A.sub }}>{draft.previewSummary}</div>
                      <div className="mt-1 text-[12px]" style={{ color: A.sub }}>对象：{draft.sourceObjectLabel}</div>
                    </div>
                  </div>
                  <Chip label="待复核" color={A.blue} bg="#eef4ff" />
                </div>
                <div className="mt-4 grid grid-cols-[1fr_1fr_1.35fr] gap-2">
                  <button type="button" onClick={() => previewDraft(draftRequestFromPreview(draft))} className="h-8 whitespace-nowrap rounded-md border px-1.5 text-[11px] font-semibold" style={{ borderColor: A.border, color: A.label, background: A.white }}>预览草稿</button>
                  <button
                    type="button"
                    onClick={() => onNavigate(draft.targetModule, focusFrom({ entityType: draft.targetEntityType, entityId: draft.targetEntityId }), {
                      returnTo: "overview:ai",
                      entityLabel: draft.targetEntityLabel,
                      source: "aiSuggestionsWorkbench",
                      returnContext: { sourceModule: "overview", sourceRoute: "overview:ai", sourceLabel: "AI 建议", returnLabel: "返回 AI 建议" },
                    })}
                    className="h-8 whitespace-nowrap rounded-md px-1.5 text-[11px] font-semibold text-white"
                    style={{ background: A.blue }}
                  >
                    进入工作台
                  </button>
                  <button type="button" className="h-8 whitespace-nowrap rounded-md border px-1.5 text-[11px] font-semibold" style={{ borderColor: A.border, color: A.label, background: A.white }}>标记仅内部留存</button>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section id="ai-audit-log">
        <h2 className={`${typography.sectionTitle} mb-3`} style={{ color: A.label }}>AI 审计记录</h2>
        <Card className="overflow-hidden rounded-[20px]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left">
              <thead style={{ background: "#fbfdff" }}>
                <tr>
                  {["时间", "AI 建议", "来源对象", "证据来源", "输出类型", "人工复核要求", "数据限制"].map((header) => (
                    <th key={header} className="px-4 py-3 text-[12px] font-semibold" style={{ color: A.gray1 }}>{header}</th>
                  ))}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {workbench.auditTrail.map((row, index) => (
                  <tr key={row.id} style={{ borderTop: index ? `1px solid ${A.border}` : "none" }}>
                    <td className="px-4 py-2.5 text-[13px]" style={{ color: A.sub }}>{row.generatedAtLabel}</td>
                    <td className="px-4 py-2.5 text-[13px]" style={{ color: A.label }}>{row.suggestionTitle}</td>
                    <td className="px-4 py-2.5 text-[13px] tabular-nums" style={{ color: A.blue }}>{row.sourceObjectLabel}</td>
                    <td className="px-4 py-2.5 text-[13px]" style={{ color: A.sub }}>{row.evidenceSourceLabel}</td>
                    <td className="px-4 py-2.5 text-[13px]" style={{ color: A.sub }}>{row.outputType}</td>
                    <td className="px-4 py-2.5 text-[13px]" style={{ color: A.sub }}>{row.reviewRequirement}</td>
                    <td className="px-4 py-2.5 text-[13px]" style={{ color: A.sub }}>{row.dataLimitationSummary}</td>
                    <td className="px-4 py-2.5 text-right">{row.navigationLinks[0] ? <NavButton link={row.navigationLinks[0]} onNavigate={onNavigate} /> : <ArrowRight size={15} style={{ color: A.gray2 }} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}
