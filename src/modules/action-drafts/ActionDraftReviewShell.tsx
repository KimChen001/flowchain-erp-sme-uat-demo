import { Copy } from "lucide-react";
import { A, Chip, Modal } from "../../components/ui";
import { evidenceModuleId, normalizeEvidenceLinks, type CanonicalFocusTarget } from "../../lib/evidenceLinks";

export type ActionDraftPreviewRequest = {
  type: string;
  title?: string;
  source?: string;
  originEvidence?: Record<string, unknown>[];
  payload?: Record<string, unknown>;
};

export type ActionDraftPreview = {
  id: string;
  type: string;
  title: string;
  status: string;
  source: string;
  requiresConfirmation: boolean;
  originEvidence?: Record<string, unknown>[];
  payload?: Record<string, unknown>;
  validation?: {
    ok?: boolean;
    status?: string;
    errors?: string[];
    missingFields?: string[];
  };
  auditTrail?: { action?: string; summary?: string; timestamp?: string }[];
  confirmationBoundary?: {
    previewOnly?: boolean;
    submitted?: boolean;
    requiresUserReview?: boolean;
    futureConfirmation?: string;
  };
};

function text(value: unknown) {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "是" : "否";
  if (typeof value === "number") return Number.isFinite(value) ? value.toLocaleString() : "—";
  return String(value);
}

function compactObject(value: Record<string, unknown>) {
  return [
    value.supplierId || value.supplierIdOrName || value.supplierName || value.name,
    value.itemIdOrSku || value.sku || value.itemName,
    value.documentId || value.poId || value.rfqId || value.id,
    value.status || value.reason,
  ].filter(Boolean).map(text).slice(0, 3).join(" · ");
}

function businessValue(value: unknown) {
  if (Array.isArray(value)) {
    const items = value.map((item) => typeof item === "object" && item ? compactObject(item as Record<string, unknown>) : text(item)).filter(Boolean);
    return items.length ? items.slice(0, 3).join("；") : "—";
  }
  if (typeof value === "object" && value) return compactObject(value as Record<string, unknown>) || "需人工复核";
  return text(value);
}

function payloadLabel(key: string) {
  const labels: Record<string, string> = {
    itemIdOrSku: "物料 / SKU",
    itemName: "物料名称",
    warehouse: "仓库",
    warehouseId: "仓库",
    quantity: "数量",
    unit: "单位",
    reason: "原因",
    supplierIdOrName: "供应商",
    message: "消息草稿",
    severity: "优先级",
    dueDate: "截止日期",
  };
  return labels[key] || key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

function copyTextForDraft(draft: ActionDraftPreview | null) {
  if (!draft) return "";
  const payload = Object.entries(draft.payload || {})
    .map(([key, value]) => `${payloadLabel(key)}: ${businessValue(value)}`)
    .join("\n");
  const warnings = draft.validation?.errors?.length ? `\nValidation: ${draft.validation.errors.join("; ")}` : "";
  return `${draft.title}\nType: ${draft.type}\nStatus: ${draft.status}\n${payload}${warnings}`.trim();
}

export function ActionDraftReviewShell({
  open,
  loading = false,
  error = "",
  draft,
  onClose,
  onCancelPreview,
  onNavigate,
}: {
  open: boolean;
  loading?: boolean;
  error?: string;
  draft: ActionDraftPreview | null;
  onClose: () => void;
  onCancelPreview: () => void;
  onNavigate?: (moduleId: string, focusTarget?: CanonicalFocusTarget | null) => void;
}) {
  const validation = draft?.validation;
  const evidence = normalizeEvidenceLinks(draft?.originEvidence || [], { source: "actionDraft" }).slice(0, 6);
  const audit = draft?.auditTrail?.[0];

  async function copyDraft() {
    const content = copyTextForDraft(draft);
    if (!content || !navigator?.clipboard) return;
    await navigator.clipboard.writeText(content);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={draft?.title || "动作草稿预览"}
      subtitle="仅供审阅，不会创建、提交、发送或过账任何业务记录"
      width={860}
      footer={(
        <>
          <button type="button" onClick={onClose} className="h-8 rounded-lg px-3 text-xs font-medium" style={{ background: A.white, color: A.label }}>
            关闭
          </button>
          <button type="button" onClick={onCancelPreview} className="h-8 rounded-lg px-3 text-xs font-medium" style={{ background: A.white, color: A.gray1 }}>
            取消草稿
          </button>
          <button type="button" onClick={copyDraft} disabled={!draft} className="h-8 rounded-lg px-3 text-xs font-medium disabled:cursor-not-allowed" style={{ background: A.white, color: draft ? A.blue : A.gray2 }}>
            <Copy size={12} className="mr-1 inline" />复制草稿内容
          </button>
          <button type="button" disabled className="h-8 rounded-lg px-3 text-xs font-medium text-white disabled:cursor-not-allowed" style={{ background: A.gray3 }}>
            确认提交
          </button>
        </>
      )}
    >
      {loading ? (
        <div className="rounded-lg border px-4 py-5 text-[12px]" style={{ borderColor: A.border, color: A.sub }}>正在生成草稿预览...</div>
      ) : error ? (
        <div className="rounded-lg border px-4 py-5 text-[12px] leading-5" style={{ borderColor: "#ffd6d6", background: "#fff1f0", color: A.red }}>{error}</div>
      ) : draft ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-lg px-3 py-2" style={{ background: A.gray6 }}>
              <div className="text-[10px]" style={{ color: A.gray2 }}>类型</div>
              <div className="mt-1 text-[12px] font-semibold" style={{ color: A.label }}>{draft.type}</div>
            </div>
            <div className="rounded-lg px-3 py-2" style={{ background: A.gray6 }}>
              <div className="text-[10px]" style={{ color: A.gray2 }}>状态</div>
              <div className="mt-1"><Chip label={draft.status || "preview"} color={A.blue} bg="#eef4ff" /></div>
            </div>
            <div className="rounded-lg px-3 py-2" style={{ background: A.gray6 }}>
              <div className="text-[10px]" style={{ color: A.gray2 }}>来源</div>
              <div className="mt-1 text-[12px] font-semibold" style={{ color: A.label }}>{draft.source || "preview"}</div>
            </div>
            <div className="rounded-lg px-3 py-2" style={{ background: A.gray6 }}>
              <div className="text-[10px]" style={{ color: A.gray2 }}>确认边界</div>
              <div className="mt-1 text-[12px] font-semibold" style={{ color: A.orange }}>{draft.requiresConfirmation ? "需要人工确认" : "仅预览"}</div>
            </div>
          </div>

          <section>
            <div className="mb-2 text-[12px] font-semibold" style={{ color: A.label }}>业务内容</div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {Object.entries(draft.payload || {}).length ? Object.entries(draft.payload || {}).map(([key, value]) => (
                <div key={key} className="rounded-lg border px-3 py-2" style={{ borderColor: A.border }}>
                  <div className="text-[10px]" style={{ color: A.gray2 }}>{payloadLabel(key)}</div>
                  <div className="mt-1 text-[12px] font-semibold leading-5" style={{ color: A.label }}>{businessValue(value)}</div>
                </div>
              )) : (
                <div className="rounded-lg border px-3 py-3 text-[12px]" style={{ borderColor: A.border, color: A.sub }}>暂无可展示字段</div>
              )}
            </div>
          </section>

          <section>
            <div className="mb-2 text-[12px] font-semibold" style={{ color: A.label }}>来源证据</div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {evidence.length ? evidence.map((link, index) => {
                const moduleId = evidenceModuleId(link);
                return (
                  <div key={`${link.entityType}-${link.entityId}-${index}`} className="rounded-lg border px-3 py-2" style={{ borderColor: A.border }}>
                    {link.clickable && moduleId && onNavigate ? (
                      <button type="button" onClick={() => onNavigate(moduleId, link.focusTarget || null)} className="text-left text-[12px] font-semibold hover:underline" style={{ color: A.blue }}>
                        {[link.entityType, link.entityId].filter(Boolean).join(" · ")}
                      </button>
                    ) : (
                      <div className="text-[12px] font-semibold" style={{ color: A.label }}>{link.label}</div>
                    )}
                    <div className="mt-1 text-[10px] leading-4" style={{ color: A.gray2 }}>{link.status || link.label}</div>
                  </div>
                );
              }) : (
                <div className="rounded-lg border px-3 py-3 text-[12px]" style={{ borderColor: A.border, color: A.sub }}>暂无来源证据</div>
              )}
            </div>
          </section>

          <section className="rounded-lg px-3 py-3" style={{ background: validation?.ok ? "#f0faf4" : "#fff8f0" }}>
            <div className="text-[12px] font-semibold" style={{ color: validation?.ok ? A.green : A.orange }}>
              {validation?.ok ? "校验通过" : "需要补充或人工复核"}
            </div>
            {validation?.errors?.length ? (
              <div className="mt-1 space-y-1">
                {validation.errors.map((item) => <div key={item} className="text-[11px]" style={{ color: A.sub }}>{item}</div>)}
              </div>
            ) : (
              <div className="mt-1 text-[11px]" style={{ color: A.sub }}>该草稿仍不会自动提交，后续确认能力是 future work。</div>
            )}
          </section>

          <section className="rounded-lg px-3 py-3 text-[11px] leading-5" style={{ background: A.gray6, color: A.sub }}>
            <span className="font-semibold" style={{ color: A.gray1 }}>审计预览：</span>
            {audit?.summary || "Preview draft prepared. No business record was created or submitted."}
          </section>
        </div>
      ) : (
        <div className="rounded-lg border px-4 py-5 text-[12px]" style={{ borderColor: A.border, color: A.sub }}>暂无草稿预览</div>
      )}
    </Modal>
  );
}
