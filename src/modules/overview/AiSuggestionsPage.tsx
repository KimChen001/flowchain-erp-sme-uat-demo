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
type SuggestionFilterKey = "all" | "po" | "inventory" | "supplier" | "finance" | "data_quality" | "high" | "draft" | "limited";

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

const filterLabels: Record<SuggestionFilterKey, string> = {
  all: "全部",
  po: "采购",
  inventory: "库存",
  supplier: "供应商",
  finance: "财务",
  data_quality: "数据质量",
  high: "高优先级",
  draft: "可处理",
  limited: "数据缺口",
};

const filterOrder: SuggestionFilterKey[] = ["all", "high", "draft", "limited"];

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

function localDraftPreviewFor(item: AiSuggestionItem): AiSuggestionDraftPreview {
  const primary = item.navigationLinks[0];
  const draftType = item.category === "inventory"
    ? "purchase_request_draft"
    : item.category === "supplier"
      ? "supplier_followup_draft"
      : item.category === "finance"
        ? "exception_note"
        : "po_followup_draft";
  return {
    id: `draft-${item.id}`,
    title: `${item.sourceObjectLabel} 内部复核草稿`,
    draftType,
    sourceSuggestionId: item.id,
    sourceObjectLabel: item.sourceObjectLabel,
    targetModule: primary?.moduleId || item.sourceModule,
    targetEntityType: primary?.entityType || item.sourceObjectType,
    targetEntityId: primary?.entityId || item.sourceObjectId,
    targetEntityLabel: primary?.entityLabel || item.sourceObjectLabel,
    previewSummary: `${item.conclusion} ${item.suggestedAction}`,
    reviewRequired: true,
    requiresHumanReview: true,
    previewOnly: true,
    navigationLinks: [
      ...(primary ? [primary] : []),
      { label: "进入行动草稿与人工复核", moduleId: "review-actions", entityType: item.sourceObjectType, entityId: item.sourceObjectId, entityLabel: item.sourceObjectLabel },
    ],
    dataLimitations: item.dataLimitations,
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
          sourceLabel: "AI 摘要",
          returnLabel: "返回 AI 摘要",
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
    <section className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => {
        const style = categoryStyle(card.category);
        const Icon = style.icon;
        return (
          <Card key={card.title} className="rounded-xl p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: style.bg, color: style.color }}>
                <Icon size={19} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <div className="text-[12px] font-semibold" style={{ color: A.label }}>{card.title}</div>
                <div className="text-[22px] leading-7 font-bold tabular-nums" style={{ color: A.label }}>{card.value}</div>
                <Chip label={card.tag} color={style.color} bg={style.bg} />
              </div>
            </div>
          </Card>
        );
      })}
    </section>
  );
}

const localAiSuggestionsWorkbench: AiSuggestionsWorkbenchV2 = {
  summary: {
    totalSuggestionCount: 4,
    poSuggestionCount: 1,
    inventorySuggestionCount: 1,
    supplierSuggestionCount: 1,
    financeSuggestionCount: 1,
    dataQualitySuggestionCount: 0,
    highPriorityCount: 1,
    draftAvailableCount: 4,
    dataLimitedCount: 2,
    overallStatusLabel: "需优先复核",
  },
  suggestions: [
    {
      id: "local-po-followup",
      title: "建议优先跟进到货计划",
      category: "po",
      categoryLabel: "PO 建议",
      priority: "high",
      sourceModule: "procurement:orders",
      sourceObjectType: "purchase_order",
      sourceObjectId: "PO-2026-1282",
      sourceObjectLabel: "PO-2026-1282",
      conclusion: "到货计划已滞后，可能影响客户交付。",
      whyNow: "该采购订单的到货窗口已进入今日复核范围，需先确认供应商承诺时间。",
      keyEvidence: ["到货计划滞后 5 天", "关联订单金额 ¥98,300", "已收货数量低于计划数量"],
      businessImpact: "可能影响客户交付与生产排程。",
      suggestedAction: "查看 PO、收货与供应商证据后，预览内部跟进草稿。",
      navigationLinks: [
        { label: "查看 PO", moduleId: "procurement:orders", entityType: "purchase_order", entityId: "PO-2026-1282", entityLabel: "PO-2026-1282" },
        { label: "查看收货", moduleId: "procurement:receiving", entityType: "receiving_doc", entityId: "GRN-260901", entityLabel: "GRN-260901" },
      ],
      dataLimitations: [{ label: "供应商确认", description: "最新承诺时间仍需人工确认。", severity: "warning" }],
      reviewRequired: true,
      previewOnly: true,
      boundaryLabels: ["草稿预览", "内部复核", "不提交", "不外发", "不写库存"],
    },
    {
      id: "local-inventory-review",
      title: "建议复核可承诺量",
      category: "inventory",
      categoryLabel: "库存建议",
      priority: "medium",
      sourceModule: "inventory",
      sourceObjectType: "inventory_item",
      sourceObjectId: "SKU-00412",
      sourceObjectLabel: "SKU-00412",
      conclusion: "可承诺量接近安全线，需复核近期出入库。",
      whyNow: "该 SKU 关联未完采购与近期出库，今日需要确认可用库存。",
      keyEvidence: ["当前可用库存低于安全库存", "关联采购订单未完成", "近期出库记录复核中"],
      businessImpact: "可能影响订单承诺和补货计划。",
      suggestedAction: "查看 SKU 证据并预览补货复核草稿。",
      navigationLinks: [
        { label: "查看 SKU", moduleId: "inventory", entityType: "inventory_item", entityId: "SKU-00412", entityLabel: "SKU-00412" },
      ],
      dataLimitations: [],
      reviewRequired: true,
      previewOnly: true,
      boundaryLabels: ["草稿预览", "人工复核", "不写库存", "不覆盖当前工作区数据"],
    },
    {
      id: "local-supplier-risk",
      title: "建议跟进供应商报价",
      category: "supplier",
      categoryLabel: "供应商建议",
      priority: "low",
      sourceModule: "procurement:rfq",
      sourceObjectType: "rfq",
      sourceObjectId: "RFQ-26-0047",
      sourceObjectLabel: "RFQ-26-0047",
      conclusion: "报价回复不完整，需补齐交期与条款依据。",
      whyNow: "该 RFQ 已进入比价窗口，缺失回复会影响供应商选择。",
      keyEvidence: ["已报价数量低于邀请供应商数量", "最优报价需复核交期", "替代供应商仍待确认"],
      businessImpact: "可能影响补货成本和采购周期。",
      suggestedAction: "查看报价证据并预览供应商跟进说明。",
      navigationLinks: [
        { label: "查看 RFQ", moduleId: "procurement:rfq", entityType: "rfq", entityId: "RFQ-26-0047", entityLabel: "RFQ-26-0047" },
      ],
      dataLimitations: [{ label: "报价完整性", description: "部分供应商仍缺少交期说明。", severity: "warning" }],
      reviewRequired: true,
      previewOnly: true,
      boundaryLabels: ["草稿预览", "人工复核", "不外发", "不形成正式业务处理"],
    },
    {
      id: "local-finance-review",
      title: "建议复核发票差异",
      category: "finance",
      categoryLabel: "财务建议",
      priority: "medium",
      sourceModule: "procurement:invoices",
      sourceObjectType: "supplier_invoice",
      sourceObjectId: "INV-HD-260421",
      sourceObjectLabel: "INV-HD-260421",
      conclusion: "发票与收货记录存在差异，需复核来源证据。",
      whyNow: "差异会影响供应商对账与应付确认。",
      keyEvidence: ["发票金额与收货金额不一致", "关联 PO 待补充复核记录", "对账状态未关闭"],
      businessImpact: "可能影响供应商发票匹配和对账周期。",
      suggestedAction: "查看发票、PO 与收货证据，预览内部复核说明。",
      navigationLinks: [
        { label: "查看发票", moduleId: "procurement:invoices", entityType: "supplier_invoice", entityId: "INV-HD-260421", entityLabel: "INV-HD-260421" },
      ],
      dataLimitations: [],
      reviewRequired: true,
      previewOnly: true,
      boundaryLabels: ["草稿预览", "人工复核", "不写财务凭证", "不处理资金"],
    },
  ],
  draftPreviews: [],
  auditTrail: [],
  dataLimitations: [],
  generatedAt: new Date().toISOString(),
  dataScopeLabel: "当前工作区数据",
};

localAiSuggestionsWorkbench.draftPreviews = localAiSuggestionsWorkbench.suggestions.map((item) => localDraftPreviewFor(item));
localAiSuggestionsWorkbench.suggestions = localAiSuggestionsWorkbench.suggestions.map((item) => ({ ...item, draftPreview: localDraftPreviewFor(item) }));

function buildLocalAiSuggestionsWorkbench() {
  return localAiSuggestionsWorkbench;
}

export default function AiSuggestionsPage({
  onNavigate,
  onReviewActionDraft,
  onOpenAi,
}: {
  onNavigate: NavigateFn;
  onReviewActionDraft?: (request: ActionDraftPreviewRequest) => void;
  onOpenAi?: () => void;
}) {
  const [workbench, setWorkbench] = useState<AiSuggestionsWorkbenchV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [activeFilter, setActiveFilter] = useState<SuggestionFilterKey>("all");

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
        setWorkbench(buildLocalAiSuggestionsWorkbench());
        setError(true);
        setSelectedId((current) => current || localAiSuggestionsWorkbench.suggestions[0]?.id || "");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  const filterCounts = useMemo(() => {
    const suggestions = workbench?.suggestions || [];
    const counts = Object.fromEntries(filterOrder.map((key) => [key, 0])) as Record<SuggestionFilterKey, number>;
    counts.all = suggestions.length;
    suggestions.forEach((item) => {
      if (item.category in counts) counts[item.category as SuggestionFilterKey] += 1;
      if (item.priority === "high") counts.high += 1;
      if (item.draftPreview) counts.draft += 1;
      if (item.dataLimitations.length > 0) counts.limited += 1;
    });
    return counts;
  }, [workbench]);

  const filteredSuggestions = useMemo(() => {
    const suggestions = workbench?.suggestions || [];
    const sorted = [...suggestions].sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] ?? 3) - ({ high: 0, medium: 1, low: 2 }[b.priority] ?? 3));
    if (activeFilter === "all") return sorted.slice(0, 5);
    if (activeFilter === "high") return suggestions.filter((item) => item.priority === "high");
    if (activeFilter === "draft") return suggestions.filter((item) => Boolean(item.draftPreview));
    if (activeFilter === "limited") return suggestions.filter((item) => item.dataLimitations.length > 0);
    return suggestions.filter((item) => item.category === activeFilter);
  }, [activeFilter, workbench]);

  useEffect(() => {
    if (!filteredSuggestions.length) {
      setSelectedId("");
      return;
    }
    setSelectedId((current) => filteredSuggestions.some((item) => item.id === current) ? current : filteredSuggestions[0].id);
  }, [filteredSuggestions]);

  const selected = useMemo(() => {
    if (!workbench?.suggestions.length) return null;
    return filteredSuggestions.find((item) => item.id === selectedId) || filteredSuggestions[0] || null;
  }, [filteredSuggestions, selectedId, workbench]);

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

  if (!workbench) {
    return (
      <Card className="p-6" data-testid="ai-suggestions-workbench">
        <h2 className="fc-section-title" style={{ color: A.label }}>AI 重点</h2>
        <div className="mt-3 text-sm" style={{ color: A.red }}>AI 重点暂不可用，请稍后重试。</div>
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
          <h2 className="fc-section-title" style={{ color: A.label }}>AI 重点</h2>
          <div className="mt-2 text-[15px] font-semibold" style={{color:A.label}}>今天建议先处理 {Math.min(5, workbench.suggestions.length)} 件事</div>
          <div className="mt-1 text-[13px]" style={{color:A.sub}}>其中 {workbench.summary.highPriorityCount} 项会阻断后续流程</div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={onOpenAi} className={scrollButtonClass(true)} style={{ background: A.blue }}>问 AI 继续追问</button>
          <a href="#ai-suggestions-list" className={scrollButtonClass()} style={{ borderColor: A.border, color: A.label, background: A.white }}>查看今日建议</a>
          <a href="#ai-draft-review" className={scrollButtonClass()} style={{ borderColor: A.border, color: A.label, background: A.white }}>查看待复核草稿</a>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">{[{label:"高优先级",value:workbench.summary.highPriorityCount},{label:"待确认动作",value:workbench.summary.draftAvailableCount},{label:"数据缺口",value:workbench.summary.dataLimitedCount}].map(item=><Card key={item.label} className="p-3"><div className="text-[11px]" style={{color:A.sub}}>{item.label}</div><div className="mt-1 text-2xl font-bold tabular-nums">{item.value}</div></Card>)}</section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(460px,0.92fr)_minmax(620px,1.08fr)]" id="ai-suggestions-list">
        <Card className="rounded-[20px] p-4">
          <h2 className={typography.sectionTitle} style={{ color: A.label }}>重点建议</h2>
          <div className="mt-3 flex flex-wrap gap-2" data-testid="ai-suggestion-filters">
            {filterOrder.map((key) => {
              const active = activeFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  data-testid="ai-suggestion-filter"
                  onClick={() => setActiveFilter(key)}
                  className="inline-flex h-8 items-center gap-1 rounded-md border px-3 text-[12px] font-semibold transition-colors"
                  style={{ borderColor: active ? A.blue : A.border, background: active ? "#eef4ff" : A.white, color: active ? A.blue : A.label }}
                >
                  <span>{filterLabels[key]}</span>
                  <span className="tabular-nums" style={{ color: active ? A.blue : A.sub }}>{filterCounts[key]}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 space-y-3">
            {filteredSuggestions.map((item) => {
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
                    <div />
                    <ArrowRight size={15} style={{ color: A.gray2 }} />
                  </div>
                </button>
              );
            })}
            {!filteredSuggestions.length && (
              <div className="rounded-xl border px-4 py-8 text-center" style={{ borderColor: A.border, background: "#fbfdff" }}>
                <div className="text-[14px] font-semibold" style={{ color: A.label }}>当前分类暂无 AI 摘要</div>
                <div className="mt-1 text-[12px]" style={{ color: A.sub }}>可切换全部或查看今日行动。</div>
                <div className="mt-4 flex justify-center gap-2">
                  <button type="button" onClick={() => setActiveFilter("all")} className="h-8 rounded-md px-3 text-[12px] font-semibold text-white" style={{ background: A.blue }}>查看全部</button>
                  <button type="button" onClick={() => onNavigate("overview")} className="h-8 rounded-md border px-3 text-[12px] font-semibold" style={{ borderColor: A.border, color: A.label, background: A.white }}>查看今日行动</button>
                </div>
              </div>
            )}
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
                  { label: "关键证据", icon: FileText, body: selected.keyEvidence.slice(0, 3), bg: "#ecfdf5", color: A.green },
                  { label: "业务影响", icon: ShieldCheck, body: selected.businessImpact, bg: "#fff7ed", color: A.orange },
                  { label: "建议动作", icon: ArrowRight, body: selected.suggestedAction, bg: "#f5f3ff", color: A.purple },
                  { label: "数据限制", icon: Info, body: selected.dataLimitations.length ? selected.dataLimitations.slice(0, 2).map((item) => `${item.label}：${item.description || "需要人工确认"}`) : ["当前无额外限制"], bg: A.gray6, color: A.gray1 },
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
                  {[...selected.navigationLinks, ...(selected.draftPreview?.navigationLinks.slice(1) || [])].slice(0, 4).map((link) => <NavButton key={`${link.moduleId}-${link.entityType}-${link.entityId}-${link.label}`} link={link} onNavigate={onNavigate} />)}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-[12px] leading-5" style={{ color: A.sub }}>内部复核 · 草稿预览 · 人工确认后再进入后续流程。</div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={onOpenAi}
                    className="inline-flex h-9 items-center justify-center rounded-md border px-4 text-[13px] font-semibold"
                    style={{ borderColor: A.border, color: A.blue, background: A.white }}
                  >
                    问 AI 继续追问
                  </button>
                  <button
                    type="button"
                    onClick={() => previewDraft(draftRequestFromSuggestion(selected))}
                    className="inline-flex h-9 items-center justify-center rounded-md px-4 text-[13px] font-semibold text-white"
                    style={{ background: A.blue }}
                  >
                    预览草稿
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm" style={{ color: A.sub }}>当前没有可展示的 AI 摘要。</div>
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
                <div className="mt-4 rounded-lg px-3 py-2 text-[11px] leading-5" style={{ background: A.gray6, color: A.sub }}>
                  草稿预览需人工复核，不形成正式业务处理，不外发。
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => previewDraft(draftRequestFromPreview(draft))} className="h-8 whitespace-nowrap rounded-md border px-1.5 text-[11px] font-semibold" style={{ borderColor: A.border, color: A.label, background: A.white }}>预览草稿</button>
                  <button
                    type="button"
                    onClick={() => onNavigate("review-actions", focusFrom({ entityType: draft.targetEntityType, entityId: draft.targetEntityId }), {
                      returnTo: "overview:ai",
                      entityLabel: draft.targetEntityLabel,
                      source: "aiSuggestionsWorkbench",
                      returnContext: { sourceModule: "overview", sourceRoute: "overview:ai", sourceLabel: "AI 摘要", returnLabel: "返回 AI 摘要" },
                    })}
                    className="h-8 whitespace-nowrap rounded-md px-1.5 text-[11px] font-semibold text-white"
                    style={{ background: A.blue }}
                  >
                    进入人工复核
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
