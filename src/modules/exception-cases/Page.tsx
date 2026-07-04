import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clipboard, FileClock, Link2, Plus, Save, Search, X } from "lucide-react";
import { toast } from "sonner";
import { A, Card, Chip, inputStyle } from "../../components/ui";
import { typography } from "../../components/ui/typography";
import { apiJson } from "../../lib/api-client";
import { resolveBusinessLinkedRecord } from "../../lib/businessLinks";
import type { CanonicalFocusTarget } from "../../lib/evidenceLinks";

type ExceptionCase = {
  caseId: string;
  caseType: string;
  title: string;
  summary: string;
  severity: "critical" | "high" | "medium" | "low";
  status: string;
  owner: string;
  dueDate?: string;
  sourceModule?: string;
  sourceEntityType?: string;
  sourceEntityId?: string;
  linkedRecords?: { entityType?: string; entityId?: string; displayLabel?: string; route?: string; relationshipLabel?: string }[];
  evidenceItems?: { id?: string; title?: string; summary?: string; riskLevel?: string; reason?: string; route?: string }[];
  dataLimitations?: string[];
  aiDiagnosisSummary?: string;
  recommendedReviewFirstActions?: string[];
  notes?: { noteId?: string; body?: string; author?: string; createdAt?: string }[];
  resolution?: { resolutionSummary?: string; rootCause?: string; actionTaken?: string; remainingRisk?: string; confirmedAt?: string };
  auditTrail?: { action?: string; actor?: string; timestamp?: string; summary?: string }[];
  auditMetadata?: Record<string, unknown>;
  updatedAt?: string;
};

type ExceptionCaseDraft = {
  draftId: string;
  sourceTrigger: string;
  proposedCaseFields: ExceptionCase;
  missingFields: string[];
  assumptions: string[];
  reviewStatus: string;
  forbiddenAiActions: string[];
  auditPreview: { action?: string; summary?: string }[];
  duplicateWarning?: { caseId?: string; title?: string; message?: string } | null;
  requiresReview: boolean;
  mutationAllowed: boolean;
  createsCaseRecord: boolean;
};

type ExceptionCaseSourceContext = {
  sourceTrigger: string;
  sourceModule?: string;
  sourceEntityType?: string;
  sourceEntityId?: string;
  sourceRoute?: string;
  caseType?: string;
  evidenceReferences?: { id?: string; title?: string; summary?: string; riskLevel?: string; reason?: string; route?: string }[];
  linkedRecords?: { entityType?: string; entityId?: string; displayLabel?: string; route?: string; relationshipLabel?: string }[];
  dataLimitations?: string[];
};

type Props = {
  onNavigate?: (moduleId: string, focusTarget?: CanonicalFocusTarget | null, options?: { returnTo?: string; entityLabel?: string; source?: string }) => void;
};

function severityStyle(severity: string) {
  if (severity === "critical" || severity === "high") return { color: A.red, bg: "#fff1f0" };
  if (severity === "medium") return { color: A.orange, bg: "#fff8f0" };
  return { color: A.green, bg: "#f0faf4" };
}

function statusStyle(status: string) {
  if (status === "closed" || status === "resolved") return { color: A.green, bg: "#f0faf4" };
  if (status === "waiting_supplier") return { color: A.orange, bg: "#fff8f0" };
  if (status === "cancelled") return { color: A.gray1, bg: A.gray5 };
  return { color: A.blue, bg: "#f0f6ff" };
}

const CASE_TYPE_LABELS: Record<string, string> = {
  supplier_risk: "供应商风险",
  receiving_exception: "收货异常",
  invoice_matching_exception: "发票匹配异常",
  inventory_risk: "库存风险",
  po_delay: "采购订单延期",
  procurement_exception: "采购异常",
  data_gap: "数据缺口",
  general_exception: "一般异常",
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: "严重",
  high: "高",
  medium: "中",
  low: "低",
  none: "无",
};

const STATUS_LABELS: Record<string, string> = {
  open: "未关闭",
  new: "新建",
  in_review: "复核中",
  waiting_supplier: "等待供应商",
  waiting_internal: "等待内部处理",
  resolved: "已解决",
  closed: "已关闭",
  cancelled: "已取消",
};

const REVIEW_ACTION_LABELS: Record<string, string> = {
  create_case_after_review: "复核后创建工单",
  review_existing_case: "复核已有工单",
  preview_supplier_followup: "预览供应商跟进",
  preview_supplier_followup_note: "供应商跟进备注草稿",
  review_grn_evidence: "复核收货证据",
  review_case_closure: "复核工单关闭",
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  exception_case_created: "异常工单已创建",
  exception_case_fields_updated: "工单字段已更新",
  exception_case_status_changed: "工单状态已更新",
  exception_case_note_added: "工单备注已保存",
  exception_case_closed: "异常工单已关闭",
  exception_case_cancelled: "异常工单已取消",
};

function caseTypeLabel(value = "") {
  return CASE_TYPE_LABELS[value] || "一般异常";
}

function severityLabel(value = "") {
  return SEVERITY_LABELS[value] || "中";
}

function caseStatusLabel(value = "") {
  return STATUS_LABELS[value] || "未关闭";
}

function ownerLabel(value = "") {
  return value && value !== "Unassigned" ? value : "未分配";
}

function actorLabel(value = "") {
  return value === "current_user" ? "当前操作人" : value || "系统";
}

function reviewActionLabel(value = "") {
  return REVIEW_ACTION_LABELS[value] || "人工复核";
}

function auditActionLabel(value = "") {
  return AUDIT_ACTION_LABELS[value] || value || "审计记录";
}

function normalizeExceptionCaseError(error: unknown) {
  const message = error instanceof Error ? error.message.trim() : "";
  if (/not found|404/i.test(message)) return "暂未找到对应异常处理工单。该工单可能尚未创建，或当前筛选条件下不可见。";
  if (/failed to fetch|network|load failed/i.test(message)) return "异常处理工单暂不可用，请检查服务连接后重试。";
  return "异常处理工单暂不可用，请稍后重试。";
}

function formatDate(value?: string) {
  if (!value) return "—";
  return value.slice(0, 10);
}

function sourceContextFromSearch(): ExceptionCaseSourceContext | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const sourceEntityType = params.get("sourceEntityType") || params.get("entityType") || "";
  const sourceEntityId = params.get("sourceEntityId") || params.get("entityId") || "";
  if (!sourceEntityType || !sourceEntityId) return null;
  const sourceModule = params.get("sourceModule") || params.get("module") || "";
  const sourceRoute = params.get("sourceRoute") || params.get("route") || sourceModule;
  return {
    sourceTrigger: params.get("sourceTrigger") || "source_context",
    sourceModule,
    sourceEntityType,
    sourceEntityId,
    sourceRoute,
    caseType: params.get("caseType") || undefined,
    linkedRecords: [{ entityType: sourceEntityType, entityId: sourceEntityId, displayLabel: sourceEntityId, route: sourceRoute || sourceModule, relationshipLabel: "主要来源" }],
    dataLimitations: ["来源上下文由导航提供；关联关系深度取决于当前数据。"],
  };
}

export default function ExceptionCasesPage({ onNavigate }: Props) {
  const [cases, setCases] = useState<ExceptionCase[]>([]);
  const [selected, setSelected] = useState<ExceptionCase | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<ExceptionCaseDraft | null>(null);
  const [guidedDraftState, setGuidedDraftState] = useState("请从今日驾驶舱、业务记录或智能洞察中选择风险来源后，再创建异常工单草稿。");
  const [noteDraft, setNoteDraft] = useState("");
  const [workflowDraft, setWorkflowDraft] = useState("");

  async function loadCases() {
    setLoading(true);
    try {
      const payload = await apiJson<{ cases: ExceptionCase[] }>("/api/exception-cases");
      setCases(payload.cases);
      if (selected) setSelected(payload.cases.find((item) => item.caseId === selected.caseId) || null);
    } catch (error) {
      console.warn("Failed to load exception cases", error);
      toast.error("异常处理工单暂不可用", { description: normalizeExceptionCaseError(error) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCases();
  }, []);

  const visible = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return cases.filter((item) => {
      const statusMatch = statusFilter === "all" || item.status === statusFilter || (statusFilter === "high" && ["critical", "high"].includes(item.severity));
      const textMatch = !keyword || [item.caseId, item.title, item.caseType, item.owner, item.sourceEntityId].some((value) => String(value || "").toLowerCase().includes(keyword));
      return statusMatch && textMatch;
    });
  }, [cases, query, statusFilter]);

  async function openDraft() {
    const sourceContext = sourceContextFromSearch();
    if (!sourceContext) {
      setDraft(null);
      setGuidedDraftState("异常处理工单需要关联具体业务记录。请从今日驾驶舱、采购订单、收货单、发票匹配、供应商风险或库存风险进入后再创建草稿。");
      toast.message("请先选择风险来源", { description: "异常处理工单需要关联具体业务记录。" });
      return;
    }
    try {
      const payload = await apiJson<{ draft: ExceptionCaseDraft; previewOnly: boolean; createsCaseRecord: boolean }>("/api/exception-cases/draft", {
        method: "POST",
        body: JSON.stringify(sourceContext),
      });
      if (!payload.previewOnly || payload.createsCaseRecord) throw new Error("工单草稿边界返回了不安全的创建标记。");
      setDraft(payload.draft);
      setGuidedDraftState("");
    } catch (error) {
      console.warn("Failed to preview exception case draft", error);
      toast.error("工单草稿暂不可用", { description: normalizeExceptionCaseError(error) });
    }
  }

  async function confirmCreateCase() {
    if (!draft) return;
    const payload = await apiJson<{ case: ExceptionCase; created: boolean }>("/api/exception-cases", {
      method: "POST",
      body: JSON.stringify({
        confirm: true,
        sourceTrigger: draft.sourceTrigger,
        case: {
          ...draft.proposedCaseFields,
          owner: draft.proposedCaseFields.owner === "Unassigned" ? "运营复核" : draft.proposedCaseFields.owner,
          dueDate: draft.proposedCaseFields.dueDate || "2026-07-10",
        },
      }),
    });
    setDraft(null);
    setCases((current) => [payload.case, ...current.filter((item) => item.caseId !== payload.case.caseId)]);
    setSelected(payload.case);
    toast.success("异常工单已创建", { description: payload.case.caseId });
  }

  async function previewNote(item: ExceptionCase) {
    const payload = await apiJson<{ draft: { body: string; reviewStatus: string; mutationAllowed: boolean } }>(`/api/exception-cases/${encodeURIComponent(item.caseId)}/note-draft`, {
      method: "POST",
      body: JSON.stringify({ summary: item.summary, noteType: "internal_followup_note" }),
    });
    if (payload.draft.mutationAllowed) throw new Error("备注草稿边界不安全。");
    setNoteDraft(payload.draft.body);
  }

  async function saveNote(item: ExceptionCase) {
    if (!noteDraft.trim()) return;
    const payload = await apiJson<{ case: ExceptionCase }>(`/api/exception-cases/${encodeURIComponent(item.caseId)}/notes`, {
      method: "POST",
      body: JSON.stringify({ confirm: true, body: noteDraft, author: "current_user" }),
    });
    setSelected(payload.case);
    setCases((current) => current.map((row) => row.caseId === payload.case.caseId ? payload.case : row));
    setNoteDraft("");
    toast.success("工单备注已确认保存", { description: item.caseId });
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className={typography.pageTitle} style={{ color: A.label }}>异常处理工单</h1>
            <p className={`${typography.metadata} mt-1 max-w-3xl`} style={{ color: A.sub }}>
              将运营风险沉淀为可复核工单，关联记录、依据、备注和审计来源。
            </p>
          </div>
          <button onClick={openDraft} className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-white ${typography.denseButton}`} style={{ background: A.blue }}>
            <Plus size={14} /> 生成内部跟进草稿
          </button>
        </div>
      </Card>

      <Card>
        <div className="grid gap-3 px-5 py-3 md:grid-cols-[1fr_180px_180px]" style={{ borderBottom: `1px solid ${A.border}` }}>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: A.gray2 }} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索工单、负责人、关联记录" className="pl-8" style={inputStyle} />
          </div>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={inputStyle}>
            <option value="open">未关闭</option>
            <option value="high">高严重度</option>
            <option value="waiting_supplier">等待供应商</option>
            <option value="in_review">复核中</option>
            <option value="all">全部工单</option>
          </select>
          <button onClick={loadCases} className={`rounded-lg px-3 ${typography.denseButton}`} style={{ background: A.gray6, color: A.blue }}>
            {loading ? "加载中" : "刷新"}
          </button>
        </div>

        {visible.length === 0 ? (
          <div className="px-5 py-8">
            <p className={typography.subsectionTitle} style={{ color: A.label }}>暂无异常处理工单</p>
            <p className={`${typography.metadata} mt-1`} style={{ color: A.sub }}>
              异常处理工单需要从具体风险来源创建，例如今日驾驶舱中的 PO 延迟、收货异常、发票差异、供应商风险或库存风险。请先进入对应风险记录，再预览工单草稿。
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left">
              <thead>
                <tr style={{ borderBottom: `1px solid ${A.border}` }}>
                  {["工单", "类型", "严重度", "状态", "负责人", "到期", "主记录", "更新"].map((header) => (
                    <th key={header} className={`px-4 py-3 ${typography.tableHeader}`} style={{ color: A.gray1 }}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => {
                  const severity = severityStyle(item.severity);
                  const status = statusStyle(item.status);
                  return (
                    <tr key={item.caseId} className="cursor-pointer hover:bg-blue-50/40" onClick={() => { setSelected(item); setNoteDraft(""); setWorkflowDraft(""); }} style={{ borderBottom: `1px solid ${A.border}` }}>
                      <td className={`px-4 py-3 ${typography.tableLink}`} style={{ color: A.blue }}>{item.caseId}<div className={typography.metadata} style={{ color: A.label }}>{item.title}</div></td>
                      <td className={`px-4 py-3 ${typography.tableCell}`}>{caseTypeLabel(item.caseType)}</td>
                      <td className="px-4 py-3"><Chip label={severityLabel(item.severity)} color={severity.color} bg={severity.bg} /></td>
                      <td className="px-4 py-3"><Chip label={caseStatusLabel(item.status)} color={status.color} bg={status.bg} /></td>
                      <td className={`px-4 py-3 ${typography.tableCell}`}>{ownerLabel(item.owner)}</td>
                      <td className={`px-4 py-3 ${typography.tableCell}`}>{formatDate(item.dueDate)}</td>
                      <td className={`px-4 py-3 ${typography.tableCell}`}>{item.sourceEntityId || "—"}</td>
                      <td className={`px-4 py-3 ${typography.tableCell}`}>{formatDate(item.updatedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {draft && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className={typography.compactMetadata} style={{ color: A.sub }}>先复核后确认的工单创建流程</p>
              <h2 className={typography.sectionTitle} style={{ color: A.label }}>{draft.proposedCaseFields.title}</h2>
            </div>
            <Chip label="仅生成草稿 / 需人工复核" color={A.blue} bg="#eef6ff" />
          </div>
          {draft.duplicateWarning && <p className={`${typography.metadata} mt-3`} style={{ color: A.orange }}>重复提醒：{draft.duplicateWarning.message} {draft.duplicateWarning.caseId}</p>}
          <div className="mt-3 grid gap-2 md:grid-cols-4">
            <DraftMetric label="类型" value={caseTypeLabel(draft.proposedCaseFields.caseType)} />
            <DraftMetric label="严重度" value={severityLabel(draft.proposedCaseFields.severity)} />
            <DraftMetric label="负责人" value={ownerLabel(draft.proposedCaseFields.owner)} />
            <DraftMetric label="到期日期" value={draft.proposedCaseFields.dueDate || "缺失"} />
          </div>
          {!!draft.missingFields.length && <p className={`${typography.metadata} mt-3`} style={{ color: A.orange }}>缺少字段：{draft.missingFields.join(", ")}</p>}
          <p className={`${typography.metadata} mt-3`} style={{ color: A.sub }}>审计预览：{draft.auditPreview.map((item) => item.action).join(", ")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={confirmCreateCase} className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-white ${typography.denseButton}`} style={{ background: A.green }}>
              <CheckCircle2 size={14} /> 确认创建工单
            </button>
            <button onClick={() => setDraft(null)} className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 ${typography.denseButton}`} style={{ background: A.gray6, color: A.sub }}>
              <X size={14} /> 取消
            </button>
          </div>
        </Card>
      )}

      {!draft && guidedDraftState && (
        <Card className="p-4">
          <p className={typography.subsectionTitle} style={{ color: A.label }}>生成内部跟进草稿</p>
          <p className={`${typography.metadata} mt-1`} style={{ color: A.sub }}>{guidedDraftState}</p>
        </Card>
      )}

      {selected && (
        <CaseDetail
          item={selected}
          noteDraft={noteDraft}
          workflowDraft={workflowDraft}
          setNoteDraft={setNoteDraft}
          onPreviewNote={previewNote}
          onPreviewWorkflowDraft={async (item, draftType) => {
            const payload = await apiJson<{ draft: { body: string; mutationAllowed: boolean } }>(`/api/exception-cases/${encodeURIComponent(item.caseId)}/workflow-draft`, {
              method: "POST",
              body: JSON.stringify({ draftType }),
            });
            if (payload.draft.mutationAllowed) throw new Error("流程草稿边界不安全。");
            setWorkflowDraft(payload.draft.body);
          }}
          onSaveNote={saveNote}
          onUpdateFields={async (item, fields) => {
            const payload = await apiJson<{ case: ExceptionCase }>(`/api/exception-cases/${encodeURIComponent(item.caseId)}`, {
              method: "PATCH",
              body: JSON.stringify({ confirm: true, fields, actor: "current_user" }),
            });
            setSelected(payload.case);
            setCases((current) => current.map((row) => row.caseId === payload.case.caseId ? payload.case : row));
            toast.success("工单字段已更新", { description: item.caseId });
          }}
          onChangeStatus={async (item, status, payloadFields = {}) => {
            const payload = await apiJson<{ case: ExceptionCase }>(`/api/exception-cases/${encodeURIComponent(item.caseId)}/status`, {
              method: "POST",
              body: JSON.stringify({ confirm: true, status, actor: "current_user", ...payloadFields }),
            });
            setSelected(payload.case);
            setCases((current) => current.map((row) => row.caseId === payload.case.caseId ? payload.case : row));
            toast.success("工单状态已更新", { description: `${item.caseId} -> ${caseStatusLabel(status)}` });
          }}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}

function DraftMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3" style={{ borderColor: A.border }}>
      <p className={typography.compactMetadata} style={{ color: A.sub }}>{label}</p>
      <p className={typography.formLabel} style={{ color: A.label }}>{value || "—"}</p>
    </div>
  );
}

function CaseDetail({
  item,
  noteDraft,
  workflowDraft,
  setNoteDraft,
  onPreviewNote,
  onPreviewWorkflowDraft,
  onSaveNote,
  onUpdateFields,
  onChangeStatus,
  onNavigate,
}: {
  item: ExceptionCase;
  noteDraft: string;
  workflowDraft: string;
  setNoteDraft: (value: string) => void;
  onPreviewNote: (item: ExceptionCase) => void;
  onPreviewWorkflowDraft: (item: ExceptionCase, draftType: string) => void;
  onSaveNote: (item: ExceptionCase) => void;
  onUpdateFields: (item: ExceptionCase, fields: Partial<Pick<ExceptionCase, "owner" | "dueDate" | "severity">>) => void;
  onChangeStatus: (item: ExceptionCase, status: string, payload?: Record<string, unknown>) => void;
  onNavigate?: Props["onNavigate"];
}) {
  const links = (item.linkedRecords || []).map((record) => resolveBusinessLinkedRecord(record));
  const [owner, setOwner] = useState(ownerLabel(item.owner));
  const [dueDate, setDueDate] = useState(formatDate(item.dueDate) === "—" ? "" : formatDate(item.dueDate));
  const [severity, setSeverity] = useState(item.severity);
  const [resolutionNote, setResolutionNote] = useState(item.resolution?.resolutionSummary || "");
  const [pendingTransition, setPendingTransition] = useState<{ status: string; payload?: Record<string, unknown> } | null>(null);
  const nextStatuses = allowedNextStatuses(item.status);
  useEffect(() => {
    setOwner(ownerLabel(item.owner));
    setDueDate(formatDate(item.dueDate) === "—" ? "" : formatDate(item.dueDate));
    setSeverity(item.severity);
    setResolutionNote(item.resolution?.resolutionSummary || "");
    setPendingTransition(null);
  }, [item.caseId, item.owner, item.dueDate, item.severity, item.resolution?.resolutionSummary]);
  const primaryRecord = item.linkedRecords?.[0]?.displayLabel || item.linkedRecords?.[0]?.entityId || item.sourceEntityId || "—";
  function requestTransition(status: string, payload?: Record<string, unknown>) {
    if (["cancelled", "resolved", "closed"].includes(status)) {
      setPendingTransition({ status, payload });
      return;
    }
    onChangeStatus(item, status, payload);
  }
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={typography.compactMetadata} style={{ color: A.sub }}>{item.caseId}</p>
          <h2 className={typography.sectionTitle} style={{ color: A.label }}>{item.title}</h2>
          <p className={`${typography.body} mt-2 max-w-4xl`} style={{ color: A.sub }}>{item.summary}</p>
        </div>
        <div className="flex gap-2">
          <Chip label={severityLabel(item.severity)} {...severityStyle(item.severity)} />
          <Chip label={caseStatusLabel(item.status)} {...statusStyle(item.status)} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <DraftMetric label="负责人" value={ownerLabel(item.owner)} />
        <DraftMetric label="到期日期" value={formatDate(item.dueDate)} />
        <DraftMetric label="来源模块" value={item.sourceModule || "—"} />
        <DraftMetric label="来源对象" value={item.sourceEntityId || "—"} />
      </div>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className={typography.subsectionTitle} style={{ color: A.label }}>关联记录</h3>
          <div className="mt-2 space-y-2">
            {links.length ? links.map((link) => (
              <button
                key={`${link.entityType}-${link.entityId}`}
                onClick={() => link.routeAvailable && onNavigate?.(link.route, link.focusTarget || null, { returnTo: "exception-cases", entityLabel: link.displayLabel, source: "exceptionCase" })}
                disabled={!link.routeAvailable}
                className={`flex w-full items-center justify-between rounded-md border p-3 text-left ${typography.metadata} disabled:cursor-not-allowed`}
                style={{ borderColor: A.border, color: link.routeAvailable ? A.blue : A.gray1, background: A.white }}
              >
                <span><Link2 size={13} className="mr-1 inline" />{link.displayLabel}</span>
                <span>{link.relationshipLabel}</span>
              </button>
            )) : <p className={typography.metadata} style={{ color: A.sub }}>暂无关联记录。</p>}
          </div>
        </div>
        <div>
          <h3 className={typography.subsectionTitle} style={{ color: A.label }}>依据</h3>
          <div className="mt-2 space-y-2">
            {(item.evidenceItems || []).map((evidence) => (
              <div key={evidence.id} className="rounded-md border p-3" style={{ borderColor: A.border }}>
                <div className="flex items-center justify-between gap-2">
                  <p className={typography.formLabel} style={{ color: A.label }}>{evidence.title}</p>
                  <Chip label={severityLabel(evidence.riskLevel || "none")} {...severityStyle(evidence.riskLevel || "low")} />
                </div>
                <p className={`${typography.metadata} mt-1`} style={{ color: A.sub }}>{evidence.summary}</p>
                <p className={`${typography.metadata} mt-1`} style={{ color: A.gray1 }}>{evidence.reason}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-md border p-4" style={{ borderColor: A.border }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className={typography.subsectionTitle} style={{ color: A.label }}>流程控制</h3>
            <p className={typography.metadata} style={{ color: A.sub }}>更新需用户确认，并记录在工单审计轨迹中；不会改动关联业务记录。</p>
          </div>
          <Chip label={`当前：${caseStatusLabel(item.status)}`} {...statusStyle(item.status)} />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_160px_150px_auto]">
          <input value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="负责人" style={inputStyle} />
          <input value={dueDate} onChange={(event) => setDueDate(event.target.value)} type="date" style={inputStyle} />
          <select value={severity} onChange={(event) => setSeverity(event.target.value as ExceptionCase["severity"])} style={inputStyle}>
            {["critical", "high", "medium", "low"].map((value) => <option key={value} value={value}>{severityLabel(value)}</option>)}
          </select>
          <button onClick={() => onUpdateFields(item, { owner, dueDate, severity })} className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-white ${typography.denseButton}`} style={{ background: A.blue }}>
            <Save size={14} /> 更新字段
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {nextStatuses.map((status) => (
            <button
              key={status}
              onClick={() => requestTransition(status, { reason: `将工单状态调整为 ${caseStatusLabel(status)}` })}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 ${typography.denseButton}`}
              style={{ background: status === "cancelled" ? "#fff1f0" : "#f0f6ff", color: status === "cancelled" ? A.red : A.blue }}
            >
              {statusLabel(status)}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_auto]">
          <textarea value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} placeholder="关闭工单前需填写处理结论" rows={2} style={{ ...inputStyle, height: "auto", resize: "vertical" }} />
          <button onClick={() => onPreviewWorkflowDraft(item, "resolution_note")} className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 ${typography.denseButton}`} style={{ background: "#f0f6ff", color: A.blue }}>
            <FileClock size={14} /> 处理结论草稿
          </button>
          <button
            onClick={() => requestTransition("closed", { resolutionNote, rootCause: "用户已复核工单依据", actionTaken: "已在工单流程中确认处理结论", remainingRisk: "持续监控复发风险" })}
            disabled={item.status !== "resolved" || !resolutionNote.trim()}
            className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-white ${typography.denseButton} disabled:cursor-not-allowed disabled:opacity-60`}
            style={{ background: A.green }}
          >
            <CheckCircle2 size={14} /> 关闭工单
          </button>
        </div>
        {pendingTransition && (
          <div data-testid="exception-transition-confirmation" className="mt-3 rounded-md border p-3" style={{ borderColor: A.orange, background: "#fff8f0" }}>
            <p className={typography.formLabel} style={{ color: A.label }}>确认最终状态变更</p>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              <DraftMetric label="工单 ID" value={item.caseId} />
              <DraftMetric label="当前状态" value={caseStatusLabel(item.status)} />
              <DraftMetric label="下一状态" value={caseStatusLabel(pendingTransition.status)} />
              <DraftMetric label="关联主记录" value={primaryRecord} />
              <DraftMetric label="需要处理结论" value={pendingTransition.status === "closed" ? "是" : "否"} />
              <DraftMetric label="审计预览" value={`exception_case_${pendingTransition.status === "closed" ? "closed" : "status_changed"}`} />
            </div>
            <p className={`${typography.metadata} mt-2`} style={{ color: A.sub }}>关联 PO、GRN、发票、SKU、供应商记录不会被修改。</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => {
                  onChangeStatus(item, pendingTransition.status, pendingTransition.payload);
                  setPendingTransition(null);
                }}
                disabled={pendingTransition.status === "closed" && !resolutionNote.trim()}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-white ${typography.denseButton} disabled:cursor-not-allowed disabled:opacity-60`}
                style={{ background: pendingTransition.status === "cancelled" ? A.red : A.green }}
              >
                <CheckCircle2 size={14} /> 确认状态变更
              </button>
              <button onClick={() => setPendingTransition(null)} className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 ${typography.denseButton}`} style={{ background: A.gray6, color: A.sub }}>
                <X size={14} /> 保持当前状态
              </button>
            </div>
          </div>
        )}
        {workflowDraft && <p className={`${typography.metadata} mt-3 rounded-md p-3`} style={{ background: A.gray6, color: A.label }}>{workflowDraft}</p>}
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className={typography.subsectionTitle} style={{ color: A.label }}>智能诊断与动作</h3>
          <p className={`${typography.metadata} mt-2`} style={{ color: A.sub }}>{item.aiDiagnosisSummary || "暂无智能诊断摘要。"}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(item.recommendedReviewFirstActions || []).map((action) => <Chip key={action} label={reviewActionLabel(action)} color={A.blue} bg="#eef6ff" />)}
          </div>
        </div>
        <div>
          <h3 className={typography.subsectionTitle} style={{ color: A.label }}>备注与来源</h3>
          <p className={`${typography.metadata} mt-2`} style={{ color: A.sub }}>数据限制：{(item.dataLimitations || []).join(", ") || "无"}</p>
          <p className={`${typography.metadata} mt-1`} style={{ color: A.sub }}>审计来源：{String(item.auditMetadata?.sourceTrigger || "user_confirmed")}</p>
          {(item.notes || []).map((note) => <p key={note.noteId} className={`${typography.metadata} mt-2 rounded-md p-2`} style={{ background: A.gray6, color: A.label }}>{note.body}</p>)}
          {(item.auditTrail || []).map((entry, index) => <p key={`${entry.action}-${index}`} className={`${typography.metadata} mt-2`} style={{ color: A.sub }}>{auditActionLabel(entry.action)} · {actorLabel(entry.actor)} · {formatDate(entry.timestamp)}</p>)}
        </div>
      </section>

      <div className="mt-5 rounded-md border p-3" style={{ borderColor: A.border }}>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => onPreviewNote(item)} className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 ${typography.denseButton}`} style={{ background: "#f0f6ff", color: A.blue }}>
            <FileClock size={14} /> 预览跟进备注
          </button>
          <button onClick={() => onPreviewWorkflowDraft(item, "supplier_followup_note")} className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 ${typography.denseButton}`} style={{ background: "#fff8f0", color: A.orange }}>
            <FileClock size={14} /> 供应商跟进草稿
          </button>
          <button onClick={() => navigator.clipboard?.writeText(item.summary)} className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 ${typography.denseButton}`} style={{ background: A.gray6, color: A.sub }}>
            <Clipboard size={14} /> 复制摘要
          </button>
        </div>
        {noteDraft && (
          <div className="mt-3">
            <textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} rows={3} style={{ ...inputStyle, height: "auto", resize: "vertical" }} />
            <button onClick={() => onSaveNote(item)} className={`mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-white ${typography.denseButton}`} style={{ background: A.green }}>
              <Save size={14} /> 确认后保存备注
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}

function allowedNextStatuses(status: string) {
  const map: Record<string, string[]> = {
    open: ["in_review", "waiting_supplier", "waiting_internal", "cancelled"],
    in_review: ["waiting_supplier", "waiting_internal", "resolved", "cancelled"],
    waiting_supplier: ["in_review", "cancelled"],
    waiting_internal: ["in_review", "cancelled"],
    resolved: [],
  };
  return map[status] || [];
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    in_review: "移至复核中",
    waiting_supplier: "标记为等待供应商",
    waiting_internal: "标记为等待内部",
    resolved: "标记为已解决",
    cancelled: "取消工单",
    closed: "关闭工单",
  };
  return labels[status] || status;
}
