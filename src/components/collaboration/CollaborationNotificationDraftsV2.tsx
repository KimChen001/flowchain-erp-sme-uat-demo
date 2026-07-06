import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BellRing, ClipboardCheck, FileText, Link2, ShieldCheck, Users } from "lucide-react";
import { A, Card, Chip } from "../../components/ui";
import { typography } from "../../components/ui/typography";
import type {
  CollaborationNavigationLink,
  CollaborationNotificationDraft,
  CollaborationNotificationDraftsV2 as CollaborationNotificationDraftsPayload,
} from "../../modules/collaboration-drafts/collaborationNotificationDrafts";

type NavigateFn = (moduleId: string, focusTarget?: { entityType: string; entityId: string } | null, options?: { returnTo?: string; entityLabel?: string; source?: string; returnContext?: unknown }) => void;
type FilterKey = "all" | "internal_followup" | "supplier_communication" | "finance_review" | "data_completion" | "receiving_exception" | "inventory_review" | "report_insight_review" | "high" | "limited";

const filterLabels: Record<FilterKey, string> = {
  all: "全部",
  internal_followup: "内部协同",
  supplier_communication: "供应商沟通",
  finance_review: "财务复核",
  data_completion: "数据补齐",
  receiving_exception: "收货异常",
  inventory_review: "库存复核",
  report_insight_review: "报表复核",
  high: "高优先级",
  limited: "数据限制",
};

const filterOrder: FilterKey[] = ["all", "internal_followup", "supplier_communication", "finance_review", "data_completion", "receiving_exception", "inventory_review", "report_insight_review", "high", "limited"];

const priorityStyle: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: "高优先级", color: A.red, bg: "#fff1f0" },
  medium: { label: "中优先级", color: A.orange, bg: "#fff7ed" },
  low: { label: "低优先级", color: A.blue, bg: "#eef4ff" },
};

function styleFor(priority = "") {
  return priorityStyle[priority] || priorityStyle.medium;
}

function focusFrom(link?: Pick<CollaborationNavigationLink, "entityType" | "entityId"> | null) {
  if (!link?.entityType || !link.entityId) return null;
  return { entityType: link.entityType, entityId: link.entityId };
}

function NavButton({ link, onNavigate }: { link: CollaborationNavigationLink; onNavigate: NavigateFn }) {
  return (
    <button
      type="button"
      data-testid="collaboration-draft-nav-link"
      onClick={() => onNavigate(link.moduleId, focusFrom(link), {
        returnTo: "collaboration-drafts",
        entityLabel: link.entityLabel || link.label,
        source: "collaborationNotificationDrafts",
        returnContext: {
          sourceModule: "collaboration-drafts",
          sourceRoute: "collaboration-drafts",
          sourceLabel: "协同通知草稿",
          returnLabel: "返回协同通知草稿",
          originIntent: "collaborationNotificationDrafts",
        },
      })}
      className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12px] font-semibold"
      style={{ background: "#eef4ff", color: A.blue }}
    >
      <Link2 size={13} /> {link.label}
    </button>
  );
}

function SummaryStrip({ payload }: { payload: CollaborationNotificationDraftsPayload }) {
  const rows = [
    ["草稿总数", payload.summary.totalDraftCount],
    ["内部协同", payload.summary.internalDraftCount],
    ["供应商沟通", payload.summary.supplierDraftCount],
    ["财务复核", payload.summary.financeDraftCount],
    ["数据补齐", payload.summary.dataQualityDraftCount],
    ["收货异常", payload.summary.receivingDraftCount],
    ["库存复核", payload.summary.inventoryDraftCount],
    ["报表复核", payload.summary.reportReviewDraftCount],
    ["高优先级", payload.summary.highPriorityCount],
    ["数据限制", payload.summary.dataLimitedCount],
    ["待人工复核", payload.summary.readyForReviewCount],
  ] as const;
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-11">
      {rows.map(([label, value]) => (
        <Card key={label} className="rounded-[16px] p-3">
          <div className="text-[11px]" style={{ color: A.sub }}>{label}</div>
          <div className="mt-1 text-[22px] font-bold tabular-nums" style={{ color: A.label }}>{value}</div>
        </Card>
      ))}
    </section>
  );
}

function Detail({ draft, onNavigate }: { draft: CollaborationNotificationDraft | null; onNavigate: NavigateFn }) {
  if (!draft) {
    return (
      <Card className="rounded-[20px] p-5" data-testid="collaboration-draft-detail">
        <div className="text-sm" style={{ color: A.sub }}>当前筛选下暂无草稿。</div>
      </Card>
    );
  }
  const priority = styleFor(draft.priority);
  const fields = [
    ["通知类型", draft.notificationTypeLabel],
    ["协同对象", draft.audienceLabel],
    ["来源对象", draft.sourceObjectLabel],
    ["目标业务对象", draft.targetEntityLabel],
    ["收件人预览", draft.recipientPreview.join("、")],
    ["主题", draft.subject],
    ["消息草稿预览", draft.messagePreview],
    ["关键证据", draft.keyEvidence],
    ["业务影响", draft.businessImpact],
    ["请求回复", draft.requestedResponse],
    ["复核清单", draft.reviewChecklist],
    ["缺失信息", draft.missingInformation],
    ["数据限制", draft.dataLimitations.length ? draft.dataLimitations.map((item) => `${item.label}：${item.description || "需要人工确认"}`) : ["当前无额外限制"]],
    ["边界说明", draft.boundaryLabels],
    ["审计预览", [draft.auditPreview.sourceLabel, draft.auditPreview.reviewRequirement, draft.auditPreview.boundarySummary]],
  ] as const;

  return (
    <Card className="rounded-[20px] p-5" data-testid="collaboration-draft-detail">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={typography.sectionTitle} style={{ color: A.label }}>{draft.title}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <Chip label={priority.label} color={priority.color} bg={priority.bg} />
            <Chip label={draft.status} color={A.blue} bg="#eef4ff" />
            <Chip label="草稿预览" color={A.green} bg="#ecfdf5" />
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border p-4" style={{ borderColor: A.border, background: "#fbfdff" }}>
        <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold" style={{ color: A.label }}>
          <BellRing size={15} /> Message Preview
        </div>
        <div className="text-[13px] leading-6" style={{ color: A.sub }}>
          <div className="font-semibold" style={{ color: A.label }}>{draft.subject}</div>
          <div className="mt-1">{draft.messagePreview}</div>
          <div className="mt-2">草稿预览 · 人工复核后使用 · 不外发 · 不形成正式业务处理</div>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border" style={{ borderColor: A.border }}>
        {fields.map(([label, value], index) => (
          <div key={label} className="grid grid-cols-[140px_1fr] gap-4 px-4 py-3" style={{ borderTop: index ? `1px solid ${A.border}` : "none", background: index % 2 ? "#fbfdff" : A.white }}>
            <div className="text-[13px] font-semibold" style={{ color: A.label }}>{label}</div>
            <div className="text-[13px] leading-6" style={{ color: A.sub }}>
              {Array.isArray(value) ? (
                <ul className="list-disc space-y-1 pl-4">
                  {value.map((item) => <li key={item}>{item}</li>)}
                </ul>
              ) : value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border p-3" style={{ borderColor: A.border, background: A.white }}>
        <div className="mb-2 text-[13px] font-semibold" style={{ color: A.label }}>可点击跳转</div>
        <div className="flex flex-wrap gap-2">
          {draft.navigationLinks.map((link) => <NavButton key={`${link.moduleId}-${link.entityType}-${link.entityId}-${link.label}`} link={link} onNavigate={onNavigate} />)}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5">
        {["预览草稿", "进入人工复核", "标记仅内部留存", "打开来源对象", "打开行动草稿"].map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              if (label === "进入人工复核" || label === "打开行动草稿") onNavigate("review-actions", focusFrom({ entityType: draft.targetEntityType, entityId: draft.targetEntityId }), { returnTo: "collaboration-drafts", entityLabel: draft.targetEntityLabel, source: "collaborationNotificationDrafts", returnContext: { sourceModule: "collaboration-drafts", sourceRoute: "collaboration-drafts", sourceLabel: "协同通知草稿", returnLabel: "返回协同通知草稿" } });
              if (label === "打开来源对象") onNavigate(draft.targetModule, focusFrom({ entityType: draft.targetEntityType, entityId: draft.targetEntityId }), { returnTo: "collaboration-drafts", entityLabel: draft.targetEntityLabel, source: "collaborationNotificationDrafts", returnContext: { sourceModule: "collaboration-drafts", sourceRoute: "collaboration-drafts", sourceLabel: "协同通知草稿", returnLabel: "返回协同通知草稿" } });
            }}
            className="h-8 rounded-md border px-2 text-[11px] font-semibold"
            style={{ borderColor: index === 1 ? A.blue : A.border, background: index === 1 ? A.blue : A.white, color: index === 1 ? A.white : A.label }}
          >
            {label}
          </button>
        ))}
      </div>
    </Card>
  );
}

export function CollaborationNotificationDraftsV2({ payload, onNavigate }: { payload: CollaborationNotificationDraftsPayload; onNavigate: NavigateFn }) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [selectedId, setSelectedId] = useState(payload.drafts[0]?.id || "");
  const counts = useMemo(() => {
    const result = Object.fromEntries(filterOrder.map((key) => [key, 0])) as Record<FilterKey, number>;
    result.all = payload.drafts.length;
    payload.drafts.forEach((draft) => {
      if (draft.notificationType in result) result[draft.notificationType as FilterKey] += 1;
      if (draft.priority === "high") result.high += 1;
      if (draft.dataLimitations.length) result.limited += 1;
    });
    return result;
  }, [payload.drafts]);
  const filtered = useMemo(() => {
    if (activeFilter === "all") return payload.drafts;
    if (activeFilter === "high") return payload.drafts.filter((draft) => draft.priority === "high");
    if (activeFilter === "limited") return payload.drafts.filter((draft) => draft.dataLimitations.length);
    return payload.drafts.filter((draft) => draft.notificationType === activeFilter);
  }, [activeFilter, payload.drafts]);

  useEffect(() => {
    setSelectedId((current) => filtered.some((draft) => draft.id === current) ? current : filtered[0]?.id || "");
  }, [filtered]);

  const selected = filtered.find((draft) => draft.id === selectedId) || filtered[0] || null;

  return (
    <div className="space-y-4" data-testid="collaboration-notification-drafts">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[24px] leading-8 font-bold tracking-normal" style={{ color: A.label }}>Collaboration Notification Drafts</h1>
            <Chip label="协同通知草稿" color={A.blue} bg="#eef4ff" />
            <Chip label={payload.dataScopeLabel} color={A.green} bg="#ecfdf5" />
          </div>
          <div className="mt-2 max-w-4xl rounded-md px-3 py-2 text-[13px] leading-5" style={{ background: "#eef4ff", color: A.blue }}>
            所有通知仅为草稿预览，需人工复核，不会自动外发或形成正式业务处理。
          </div>
        </div>
      </section>

      <SummaryStrip payload={payload} />

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
        <Card className="rounded-[20px] p-4">
          <h2 className={typography.sectionTitle} style={{ color: A.label }}>Channel Policies</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            {payload.channelPolicies.map((policy) => (
              <div key={policy.channelType} className="rounded-xl border p-3" style={{ borderColor: A.border, background: A.white }}>
                <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: A.label }}><ShieldCheck size={15} /> {policy.label}</div>
                <div className="mt-2 text-[12px] leading-5" style={{ color: A.sub }}>{policy.allowedUse.join("；")}</div>
                <div className="mt-2 text-[12px] leading-5" style={{ color: A.blue }}>{policy.boundarySummary}</div>
                <div className="mt-2 flex gap-2">
                  <Chip label="preview-only" color={A.green} bg="#ecfdf5" />
                  <Chip label="review required" color={A.blue} bg="#eef4ff" />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="rounded-[20px] p-4">
          <h2 className={typography.sectionTitle} style={{ color: A.label }}>Audience & Source Summary</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            {payload.audienceGroups.map((group) => (
              <div key={group.audienceType} className="rounded-xl border p-3" style={{ borderColor: A.border }}>
                <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: A.label }}><Users size={15} /> {group.label}</div>
                <div className="mt-1 text-[12px]" style={{ color: A.sub }}>{group.draftCount} 条 · 高优先级 {group.highPriorityCount} · 数据限制 {group.dataLimitedCount}</div>
                <div className="mt-2 text-[12px]" style={{ color: A.blue }}>{group.previewRecipients.join("、")}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2" data-testid="collaboration-source-summary">
            {payload.sourceSummary.map((source) => (
              <div key={source.sourceModule} className="rounded-lg px-3 py-2" style={{ background: A.gray6 }}>
                <div className="text-[12px] font-semibold" style={{ color: A.label }}>{source.sourceLabel}</div>
                <div className="mt-1 text-[11px]" style={{ color: A.sub }}>{source.draftCount} 条草稿 · 高优先级 {source.highPriorityCount}</div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(560px,0.95fr)_minmax(620px,1.05fr)]">
        <Card className="rounded-[20px] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className={typography.sectionTitle} style={{ color: A.label }}>Draft Inbox</h2>
            <div className="flex flex-wrap gap-2" data-testid="collaboration-draft-filters">
              {filterOrder.map((key) => {
                const active = activeFilter === key;
                return (
                  <button key={key} type="button" data-testid="collaboration-draft-filter" onClick={() => setActiveFilter(key)}
                    className="inline-flex h-8 items-center gap-1 rounded-md border px-3 text-[12px] font-semibold"
                    style={{ borderColor: active ? A.blue : A.border, background: active ? "#eef4ff" : A.white, color: active ? A.blue : A.label }}>
                    <span>{filterLabels[key]}</span><span>{counts[key]}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[920px] text-left" data-testid="collaboration-draft-table">
              <thead style={{ background: "#fbfdff" }}>
                <tr>
                  {["优先级", "草稿编号", "草稿标题", "类型", "协同对象", "来源对象", "状态", "audience", "关键证据", "请求回复", "操作"].map((header) => (
                    <th key={header} className="px-3 py-3 text-[12px] font-semibold" style={{ color: A.gray1 }}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((draft, index) => {
                  const priority = styleFor(draft.priority);
                  return (
                    <tr key={draft.id} data-testid="collaboration-draft-row" onClick={() => setSelectedId(draft.id)} className="cursor-pointer" style={{ borderTop: index ? `1px solid ${A.border}` : "none", background: draft.id === selected?.id ? "#f8fbff" : A.white }}>
                      <td className="px-3 py-3"><Chip label={priority.label} color={priority.color} bg={priority.bg} /></td>
                      <td className="px-3 py-3 text-[12px] tabular-nums" style={{ color: A.blue }}>{draft.draftNo}</td>
                      <td className="px-3 py-3 text-[13px] font-semibold" style={{ color: A.label }}>{draft.title}</td>
                      <td className="px-3 py-3 text-[12px]" style={{ color: A.sub }}>{draft.notificationTypeLabel}</td>
                      <td className="px-3 py-3 text-[12px]" style={{ color: A.sub }}>{draft.audienceLabel}</td>
                      <td className="px-3 py-3 text-[12px]" style={{ color: A.blue }}>{draft.sourceObjectLabel}</td>
                      <td className="px-3 py-3 text-[12px]" style={{ color: A.sub }}>{draft.status}</td>
                      <td className="px-3 py-3 text-[12px]" style={{ color: A.sub }}>{draft.recipientPreview[0]}</td>
                      <td className="px-3 py-3 text-[12px]" style={{ color: A.sub }}>{draft.keyEvidence[0]}</td>
                      <td className="px-3 py-3 text-[12px]" style={{ color: A.sub }}>{draft.requestedResponse}</td>
                      <td className="px-3 py-3"><button type="button" className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: A.blue }}>查看 <ArrowRight size={13} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <Detail draft={selected} onNavigate={onNavigate} />
      </section>
    </div>
  );
}
