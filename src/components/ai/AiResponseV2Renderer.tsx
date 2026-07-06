import type { ActionDraftPreviewRequest } from "../../modules/action-drafts/ActionDraftReviewShell";
import type { ReactNode } from "react";
import { A } from "../ui";
import { typography } from "../ui/typography";
import type {
  AiResponseV2,
  AiResponseV2EvidenceItem,
  AiResponseV2NavigationLink,
  AiResponseV2ReviewCard,
} from "../../domain/ai/response-contract";
import type { CanonicalFocusTarget } from "../../lib/evidenceLinks";

type NavigateOptions = {
  returnTo?: string;
  entityLabel?: string;
  source?: string;
  returnContext?: unknown;
};

type Navigate = (moduleId: string, focusTarget?: CanonicalFocusTarget | null, options?: NavigateOptions) => void;

const severityLabels: Record<string, string> = {
  info: "信息",
  warning: "提醒",
  risk: "风险",
  success: "正常",
};

const severityColors: Record<string, { color: string; bg: string }> = {
  info: { color: A.blue, bg: "#f0f6ff" },
  warning: { color: "#8a5a00", bg: "#fff7db" },
  risk: { color: A.red, bg: "#fff1f2" },
  success: { color: A.green, bg: "#effaf3" },
};

const confidenceLabels: Record<string, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

function text(value: unknown) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "number") return Number.isFinite(value) ? value.toLocaleString() : "";
  if (typeof value === "boolean") return value ? "是" : "否";
  if (typeof value === "object") return "";
  return String(value);
}

function asArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function Chip({ children, tone = "info" }: { children: ReactNode; tone?: string }) {
  const colors = severityColors[tone] || severityColors.info;
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: colors.color, background: colors.bg }}>
      {children}
    </span>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <div className="text-[11px] font-semibold" style={{ color: A.label }}>{title}</div>
      {children}
    </section>
  );
}

function focusTarget(entityType?: string, entityId?: string): CanonicalFocusTarget | null {
  if (!entityType || !entityId) return null;
  return { entityType, entityId };
}

function navigateLink(onNavigate: Navigate | undefined, link: AiResponseV2NavigationLink | AiResponseV2EvidenceItem, label: string) {
  if (!onNavigate) return undefined;
  const target = "linkTarget" in link ? link.linkTarget : link;
  const moduleId = target?.moduleId || ("moduleId" in link ? link.moduleId : "");
  if (!moduleId) return undefined;
  return () => onNavigate(moduleId, focusTarget(target.entityType, target.entityId), {
    returnTo: "returnTo" in link && link.returnTo ? link.returnTo : "ai-assistant",
    entityLabel: label,
    source: "source" in link && link.source ? link.source : "aiRuntimeGateway",
    returnContext: "returnContext" in link ? link.returnContext : {
      sourceModule: "ai-assistant",
      sourceRoute: "ai-assistant",
      sourceLabel: "AI 助手",
      returnLabel: "返回 AI 助手",
      originIntent: "aiRuntimeGateway",
    },
  });
}

function EvidenceRow({ item, onNavigate }: { item: AiResponseV2EvidenceItem; onNavigate?: Navigate }) {
  const label = text(item.entityLabel || item.label || item.entityId);
  const detail = [item.status, item.value !== undefined && item.value !== null ? text(item.value) : "", item.sourceLabel]
    .filter(Boolean)
    .join(" · ");
  const handleNavigate = navigateLink(onNavigate, item, label);
  return (
    <div className="rounded-lg px-2 py-1.5" style={{ background: A.gray6 }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`${typography.compactMetadata} font-semibold truncate`} style={{ color: A.label }}>{label}</div>
          {detail ? <div className={`${typography.compactMetadata} truncate`} style={{ color: A.gray2 }}>{detail}</div> : null}
        </div>
        {item.severity ? <Chip tone={item.severity}>{severityLabels[item.severity] || "提醒"}</Chip> : null}
      </div>
      {item.summary ? <div className="mt-1 text-[11px] leading-5" style={{ color: A.gray1 }}>{item.summary}</div> : null}
      {handleNavigate ? (
        <button
          type="button"
          onClick={handleNavigate}
          data-testid="ai-evidence-link"
          data-business-id={item.entityId}
          className="mt-1 text-[11px] font-medium hover:underline"
          style={{ color: A.blue }}
        >
          查看 {label}
        </button>
      ) : null}
    </div>
  );
}

function NavigationButton({ link, onNavigate }: { link: AiResponseV2NavigationLink; onNavigate?: Navigate }) {
  const label = text(link.label || link.entityId || link.moduleId);
  const handleNavigate = navigateLink(onNavigate, link, label);
  return (
    <button
      type="button"
      onClick={handleNavigate}
      disabled={!handleNavigate}
      data-testid="ai-evidence-link"
      data-business-id={link.entityId || link.moduleId}
      className="rounded-full px-2.5 py-1 text-[11px] font-medium disabled:cursor-not-allowed"
      style={{ background: A.white, color: handleNavigate ? A.blue : A.gray2, border: `1px solid ${A.border}` }}
    >
      {label}
    </button>
  );
}

function requestFromReviewCard(card: AiResponseV2ReviewCard): ActionDraftPreviewRequest | null {
  if (!card.draftType) return null;
  return {
    type: card.draftType,
    title: card.draftTitle || card.title,
    source: "ai_assistant",
    originEvidence: card.originEvidence || [],
    payload: {
      ...(card.payload || {}),
      reason: card.payload?.reason || card.description || card.allowedNextStep,
    },
  };
}

function ReviewCard({
  card,
  onReviewActionDraft,
}: {
  card: AiResponseV2ReviewCard;
  onReviewActionDraft?: (request: ActionDraftPreviewRequest) => void;
}) {
  const request = requestFromReviewCard(card);
  return (
    <div className="rounded-lg px-2 py-1.5" style={{ background: A.gray6 }}>
      <div className="flex items-start justify-between gap-2">
        <div className={`${typography.compactMetadata} font-semibold`} style={{ color: A.label }}>{card.title}</div>
        <Chip tone="warning">草稿预览</Chip>
      </div>
      <div className="mt-1 text-[11px] leading-5" style={{ color: A.gray1 }}>{card.description}</div>
      <div className="mt-1 text-[10px] leading-4" style={{ color: A.gray2 }}>
        需人工复核 · 不会外发 · 不提交 · 不写入财务凭证 · 不改供应商资料
      </div>
      {request && onReviewActionDraft ? (
        <button
          type="button"
          onClick={() => onReviewActionDraft(request)}
          data-testid="ai-action-draft-preview"
          data-draft-type={request.type}
          className="mt-1 rounded-full px-2.5 py-1 text-[11px] font-medium hover:underline"
          style={{ background: A.white, color: A.blue, border: `1px solid ${A.border}` }}
        >
          审阅草稿
        </button>
      ) : (
        <div className="mt-1 text-[11px]" style={{ color: A.blue }}>{card.allowedNextStep}</div>
      )}
    </div>
  );
}

export function AiResponseV2Renderer({
  response,
  onNavigate,
  onReviewActionDraft,
}: {
  response: AiResponseV2;
  onNavigate?: Navigate;
  onReviewActionDraft?: (request: ActionDraftPreviewRequest) => void;
}) {
  if (!response || response.version !== "v2") return null;
  const conclusion = response.conclusion;
  return (
    <div data-testid="ai-response-v2" className="rounded-xl px-3 py-2.5 space-y-3" style={{ background: A.white, border: `1px solid ${A.border}` }}>
      <Section title="结论">
        <div className="space-y-1">
          <div className="text-[12px] font-semibold leading-5" style={{ color: A.label }}>{conclusion.title}</div>
          <div className="text-[11px] leading-5" style={{ color: A.gray1 }}>{conclusion.summary}</div>
          <div className="flex flex-wrap gap-1.5">
            <Chip tone={conclusion.severity}>{severityLabels[conclusion.severity] || "信息"}</Chip>
            <Chip>可信度 {confidenceLabels[conclusion.confidence] || "中"}</Chip>
            <span className="inline-flex rounded-full px-2 py-0.5 text-[10px]" style={{ color: A.gray1, background: A.gray6 }}>
              {response.scope?.dataScopeLabel || "当前工作区数据"}
            </span>
          </div>
        </div>
      </Section>

      <Section title="关键证据 / 依据">
        <div className="space-y-1.5">
          {asArray(response.keyEvidence).slice(0, 5).map((item) => (
            <EvidenceRow key={item.id} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      </Section>

      <Section title="业务影响">
        <div className="space-y-1">
          {asArray(response.businessImpact).slice(0, 4).map((item) => (
            <div key={`${item.area}-${item.impact}`} className="rounded-lg px-2 py-1.5" style={{ background: A.gray6 }}>
              <div className="flex items-center justify-between gap-2">
                <div className={`${typography.compactMetadata} font-semibold truncate`} style={{ color: A.label }}>{item.area} · {item.impact}</div>
                <Chip tone={item.severity}>{severityLabels[item.severity] || "提醒"}</Chip>
              </div>
              <div className="mt-1 text-[11px] leading-5" style={{ color: A.gray1 }}>{item.explanation}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="建议操作 / 建议动作">
        <div className="space-y-1">
          {asArray(response.recommendedActions).slice(0, 4).map((action) => (
            <div key={`${action.label}-${action.targetEntityId || action.targetModule}`} className="rounded-lg px-2 py-1.5" style={{ background: A.gray6 }}>
              <div className={`${typography.compactMetadata} font-semibold`} style={{ color: A.label }}>{action.label}</div>
              <div className="mt-1 text-[11px] leading-5" style={{ color: A.gray1 }}>{action.description}</div>
              {action.reviewRequired ? <div className="mt-1 text-[10px]" style={{ color: A.gray2 }}>需人工复核后继续</div> : null}
            </div>
          ))}
        </div>
      </Section>

      <Section title="可点击跳转">
        <div className="flex flex-wrap gap-1.5">
          {asArray(response.navigationLinks).slice(0, 6).map((link) => (
            <NavigationButton key={`${link.label}-${link.moduleId}-${link.entityId || ""}`} link={link} onNavigate={onNavigate} />
          ))}
        </div>
      </Section>

      <Section title="数据限制">
        <div className="space-y-1">
          {asArray(response.dataLimitations).slice(0, 4).map((item) => (
            <div key={item.label} className="rounded-lg px-2 py-1.5" style={{ background: A.gray6 }}>
              <div className={`${typography.compactMetadata} font-semibold`} style={{ color: A.label }}>{item.label}</div>
              <div className="mt-1 text-[11px] leading-5" style={{ color: A.gray1 }}>{item.description}</div>
              {item.consequence ? <div className="mt-1 text-[10px]" style={{ color: A.gray2 }}>{item.consequence}</div> : null}
            </div>
          ))}
        </div>
      </Section>

      <Section title="内部复核 / 草稿预览">
        <div className="space-y-1">
          {asArray(response.reviewCards).slice(0, 4).map((card) => (
            <ReviewCard key={`${card.title}-${card.targetEntityId || ""}`} card={card} onReviewActionDraft={onReviewActionDraft} />
          ))}
        </div>
      </Section>
    </div>
  );
}
