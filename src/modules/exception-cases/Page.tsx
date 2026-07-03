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

function caseTypeLabel(value: string) {
  return value.replaceAll("_", " ");
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
    linkedRecords: [{ entityType: sourceEntityType, entityId: sourceEntityId, displayLabel: sourceEntityId, route: sourceRoute || sourceModule, relationshipLabel: "Primary source" }],
    dataLimitations: ["Source context was provided by navigation; linked relationship depth depends on current data."],
  };
}

export default function ExceptionCasesPage({ onNavigate }: Props) {
  const [cases, setCases] = useState<ExceptionCase[]>([]);
  const [selected, setSelected] = useState<ExceptionCase | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<ExceptionCaseDraft | null>(null);
  const [guidedDraftState, setGuidedDraftState] = useState("Select a risk from Today Cockpit, a business record, or an AI insight to create an exception case draft.");
  const [noteDraft, setNoteDraft] = useState("");
  const [workflowDraft, setWorkflowDraft] = useState("");

  async function loadCases() {
    setLoading(true);
    try {
      const payload = await apiJson<{ cases: ExceptionCase[] }>("/api/exception-cases");
      setCases(payload.cases);
      if (selected) setSelected(payload.cases.find((item) => item.caseId === selected.caseId) || null);
    } catch (error) {
      toast.error("Exception cases unavailable", { description: error instanceof Error ? error.message : "" });
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
      setGuidedDraftState("Select a risk from Today Cockpit, a business record, or an AI insight to create an exception case draft.");
      toast.message("Select source context before creating a case draft");
      return;
    }
    const payload = await apiJson<{ draft: ExceptionCaseDraft; previewOnly: boolean; createsCaseRecord: boolean }>("/api/exception-cases/draft", {
      method: "POST",
      body: JSON.stringify(sourceContext),
    });
    if (!payload.previewOnly || payload.createsCaseRecord) throw new Error("Case draft boundary returned unsafe creation flags.");
    setDraft(payload.draft);
    setGuidedDraftState("");
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
          owner: draft.proposedCaseFields.owner === "Unassigned" ? "Operations Review" : draft.proposedCaseFields.owner,
          dueDate: draft.proposedCaseFields.dueDate || "2026-07-10",
        },
      }),
    });
    setDraft(null);
    setCases((current) => [payload.case, ...current.filter((item) => item.caseId !== payload.case.caseId)]);
    setSelected(payload.case);
    toast.success("Exception case created", { description: payload.case.caseId });
  }

  async function previewNote(item: ExceptionCase) {
    const payload = await apiJson<{ draft: { body: string; reviewStatus: string; mutationAllowed: boolean } }>(`/api/exception-cases/${encodeURIComponent(item.caseId)}/note-draft`, {
      method: "POST",
      body: JSON.stringify({ summary: item.summary, noteType: "internal_followup_note" }),
    });
    if (payload.draft.mutationAllowed) throw new Error("Note draft boundary is unsafe.");
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
    toast.success("Case note saved after confirmation", { description: item.caseId });
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className={typography.pageTitle} style={{ color: A.label }}>Exception Cases</h1>
            <p className={`${typography.metadata} mt-1 max-w-3xl`} style={{ color: A.sub }}>
              Track operational risks as reviewable cases with linked records, evidence, notes, and audit provenance.
            </p>
          </div>
          <button onClick={openDraft} className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-white ${typography.denseButton}`} style={{ background: A.blue }}>
            <Plus size={14} /> Create case draft
          </button>
        </div>
      </Card>

      <Card>
        <div className="grid gap-3 px-5 py-3 md:grid-cols-[1fr_180px_180px]" style={{ borderBottom: `1px solid ${A.border}` }}>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: A.gray2 }} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search case, owner, linked record" className="pl-8" style={inputStyle} />
          </div>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={inputStyle}>
            <option value="open">Open</option>
            <option value="high">High severity</option>
            <option value="waiting_supplier">Waiting supplier</option>
            <option value="in_review">In review</option>
            <option value="all">All cases</option>
          </select>
          <button onClick={loadCases} className={`rounded-lg px-3 ${typography.denseButton}`} style={{ background: A.gray6, color: A.blue }}>
            {loading ? "Loading" : "Refresh"}
          </button>
        </div>

        {visible.length === 0 ? (
          <div className="px-5 py-8">
            <p className={typography.subsectionTitle} style={{ color: A.label }}>No exception cases found.</p>
            <p className={`${typography.metadata} mt-1`} style={{ color: A.sub }}>
              AI may suggest cases from risks, but user confirmation is required to create them.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left">
              <thead>
                <tr style={{ borderBottom: `1px solid ${A.border}` }}>
                  {["Case", "Type", "Severity", "Status", "Owner", "Due", "Primary record", "Updated"].map((header) => (
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
                      <td className="px-4 py-3"><Chip label={item.severity} color={severity.color} bg={severity.bg} /></td>
                      <td className="px-4 py-3"><Chip label={item.status} color={status.color} bg={status.bg} /></td>
                      <td className={`px-4 py-3 ${typography.tableCell}`}>{item.owner || "Unassigned"}</td>
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
              <p className={typography.compactMetadata} style={{ color: A.sub }}>Review-first create case flow</p>
              <h2 className={typography.sectionTitle} style={{ color: A.label }}>{draft.proposedCaseFields.title}</h2>
            </div>
            <Chip label="Draft Only / Requires Review" color={A.blue} bg="#eef6ff" />
          </div>
          {draft.duplicateWarning && <p className={`${typography.metadata} mt-3`} style={{ color: A.orange }}>Duplicate warning: {draft.duplicateWarning.message} {draft.duplicateWarning.caseId}</p>}
          <div className="mt-3 grid gap-2 md:grid-cols-4">
            <DraftMetric label="Type" value={caseTypeLabel(draft.proposedCaseFields.caseType)} />
            <DraftMetric label="Severity" value={draft.proposedCaseFields.severity} />
            <DraftMetric label="Owner" value={draft.proposedCaseFields.owner || "Missing"} />
            <DraftMetric label="Due date" value={draft.proposedCaseFields.dueDate || "Missing"} />
          </div>
          {!!draft.missingFields.length && <p className={`${typography.metadata} mt-3`} style={{ color: A.orange }}>Missing fields: {draft.missingFields.join(", ")}</p>}
          <p className={`${typography.metadata} mt-3`} style={{ color: A.sub }}>Audit preview: {draft.auditPreview.map((item) => item.action).join(", ")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={confirmCreateCase} className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-white ${typography.denseButton}`} style={{ background: A.green }}>
              <CheckCircle2 size={14} /> Confirm create case
            </button>
            <button onClick={() => setDraft(null)} className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 ${typography.denseButton}`} style={{ background: A.gray6, color: A.sub }}>
              <X size={14} /> Cancel
            </button>
          </div>
        </Card>
      )}

      {!draft && guidedDraftState && (
        <Card className="p-4">
          <p className={typography.subsectionTitle} style={{ color: A.label }}>Create case draft</p>
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
            if (payload.draft.mutationAllowed) throw new Error("Workflow draft boundary is unsafe.");
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
            toast.success("Case fields updated", { description: item.caseId });
          }}
          onChangeStatus={async (item, status, payloadFields = {}) => {
            const payload = await apiJson<{ case: ExceptionCase }>(`/api/exception-cases/${encodeURIComponent(item.caseId)}/status`, {
              method: "POST",
              body: JSON.stringify({ confirm: true, status, actor: "current_user", ...payloadFields }),
            });
            setSelected(payload.case);
            setCases((current) => current.map((row) => row.caseId === payload.case.caseId ? payload.case : row));
            toast.success("Case status updated", { description: `${item.caseId} -> ${status}` });
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
  const [owner, setOwner] = useState(item.owner || "");
  const [dueDate, setDueDate] = useState(formatDate(item.dueDate) === "—" ? "" : formatDate(item.dueDate));
  const [severity, setSeverity] = useState(item.severity);
  const [resolutionNote, setResolutionNote] = useState(item.resolution?.resolutionSummary || "");
  const [pendingTransition, setPendingTransition] = useState<{ status: string; payload?: Record<string, unknown> } | null>(null);
  const nextStatuses = allowedNextStatuses(item.status);
  useEffect(() => {
    setOwner(item.owner || "");
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
          <Chip label={item.severity} {...severityStyle(item.severity)} />
          <Chip label={item.status} {...statusStyle(item.status)} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <DraftMetric label="Owner" value={item.owner || "Unassigned"} />
        <DraftMetric label="Due date" value={formatDate(item.dueDate)} />
        <DraftMetric label="Source module" value={item.sourceModule || "—"} />
        <DraftMetric label="Source entity" value={item.sourceEntityId || "—"} />
      </div>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className={typography.subsectionTitle} style={{ color: A.label }}>Linked records</h3>
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
            )) : <p className={typography.metadata} style={{ color: A.sub }}>No linked records available.</p>}
          </div>
        </div>
        <div>
          <h3 className={typography.subsectionTitle} style={{ color: A.label }}>Evidence</h3>
          <div className="mt-2 space-y-2">
            {(item.evidenceItems || []).map((evidence) => (
              <div key={evidence.id} className="rounded-md border p-3" style={{ borderColor: A.border }}>
                <div className="flex items-center justify-between gap-2">
                  <p className={typography.formLabel} style={{ color: A.label }}>{evidence.title}</p>
                  <Chip label={evidence.riskLevel || "none"} {...severityStyle(evidence.riskLevel || "low")} />
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
            <h3 className={typography.subsectionTitle} style={{ color: A.label }}>Workflow controls</h3>
            <p className={typography.metadata} style={{ color: A.sub }}>Updates are user-confirmed and recorded on the case audit trail. Linked business records are not changed.</p>
          </div>
          <Chip label={`Current: ${item.status}`} {...statusStyle(item.status)} />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_160px_150px_auto]">
          <input value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="Owner" style={inputStyle} />
          <input value={dueDate} onChange={(event) => setDueDate(event.target.value)} type="date" style={inputStyle} />
          <select value={severity} onChange={(event) => setSeverity(event.target.value as ExceptionCase["severity"])} style={inputStyle}>
            {["critical", "high", "medium", "low"].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <button onClick={() => onUpdateFields(item, { owner, dueDate, severity })} className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-white ${typography.denseButton}`} style={{ background: A.blue }}>
            <Save size={14} /> Update fields
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {nextStatuses.map((status) => (
            <button
              key={status}
              onClick={() => requestTransition(status, { reason: `Move case to ${status}` })}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 ${typography.denseButton}`}
              style={{ background: status === "cancelled" ? "#fff1f0" : "#f0f6ff", color: status === "cancelled" ? A.red : A.blue }}
            >
              {statusLabel(status)}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_auto]">
          <textarea value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} placeholder="Resolution note required before Close Case" rows={2} style={{ ...inputStyle, height: "auto", resize: "vertical" }} />
          <button onClick={() => onPreviewWorkflowDraft(item, "resolution_note")} className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 ${typography.denseButton}`} style={{ background: "#f0f6ff", color: A.blue }}>
            <FileClock size={14} /> Resolution draft
          </button>
          <button
            onClick={() => requestTransition("closed", { resolutionNote, rootCause: "User reviewed case evidence", actionTaken: "Resolution confirmed in case workflow", remainingRisk: "Monitor recurrence" })}
            disabled={item.status !== "resolved" || !resolutionNote.trim()}
            className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-white ${typography.denseButton} disabled:cursor-not-allowed disabled:opacity-60`}
            style={{ background: A.green }}
          >
            <CheckCircle2 size={14} /> Close Case
          </button>
        </div>
        {pendingTransition && (
          <div data-testid="exception-transition-confirmation" className="mt-3 rounded-md border p-3" style={{ borderColor: A.orange, background: "#fff8f0" }}>
            <p className={typography.formLabel} style={{ color: A.label }}>Confirm final case transition</p>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              <DraftMetric label="Case ID" value={item.caseId} />
              <DraftMetric label="Current status" value={item.status} />
              <DraftMetric label="Next status" value={pendingTransition.status} />
              <DraftMetric label="Linked primary record" value={primaryRecord} />
              <DraftMetric label="Resolution note required" value={pendingTransition.status === "closed" ? "Yes" : "No"} />
              <DraftMetric label="Audit preview" value={`exception_case_${pendingTransition.status === "closed" ? "closed" : "status_changed"}`} />
            </div>
            <p className={`${typography.metadata} mt-2`} style={{ color: A.sub }}>Linked PO/GRN/Invoice/SKU/Supplier records will not be changed.</p>
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
                <CheckCircle2 size={14} /> Confirm transition
              </button>
              <button onClick={() => setPendingTransition(null)} className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 ${typography.denseButton}`} style={{ background: A.gray6, color: A.sub }}>
                <X size={14} /> Keep current status
              </button>
            </div>
          </div>
        )}
        {workflowDraft && <p className={`${typography.metadata} mt-3 rounded-md p-3`} style={{ background: A.gray6, color: A.label }}>{workflowDraft}</p>}
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className={typography.subsectionTitle} style={{ color: A.label }}>AI diagnosis and actions</h3>
          <p className={`${typography.metadata} mt-2`} style={{ color: A.sub }}>{item.aiDiagnosisSummary || "No AI diagnosis summary stored."}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(item.recommendedReviewFirstActions || []).map((action) => <Chip key={action} label={action} color={A.blue} bg="#eef6ff" />)}
          </div>
        </div>
        <div>
          <h3 className={typography.subsectionTitle} style={{ color: A.label }}>Notes and provenance</h3>
          <p className={`${typography.metadata} mt-2`} style={{ color: A.sub }}>Data limitations: {(item.dataLimitations || []).join(", ") || "None"}</p>
          <p className={`${typography.metadata} mt-1`} style={{ color: A.sub }}>Audit source: {String(item.auditMetadata?.sourceTrigger || "user_confirmed")}</p>
          {(item.notes || []).map((note) => <p key={note.noteId} className={`${typography.metadata} mt-2 rounded-md p-2`} style={{ background: A.gray6, color: A.label }}>{note.body}</p>)}
          {(item.auditTrail || []).map((entry, index) => <p key={`${entry.action}-${index}`} className={`${typography.metadata} mt-2`} style={{ color: A.sub }}>{entry.action} · {formatDate(entry.timestamp)}</p>)}
        </div>
      </section>

      <div className="mt-5 rounded-md border p-3" style={{ borderColor: A.border }}>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => onPreviewNote(item)} className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 ${typography.denseButton}`} style={{ background: "#f0f6ff", color: A.blue }}>
            <FileClock size={14} /> Preview follow-up note
          </button>
          <button onClick={() => onPreviewWorkflowDraft(item, "supplier_followup_note")} className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 ${typography.denseButton}`} style={{ background: "#fff8f0", color: A.orange }}>
            <FileClock size={14} /> Supplier follow-up draft
          </button>
          <button onClick={() => navigator.clipboard?.writeText(item.summary)} className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 ${typography.denseButton}`} style={{ background: A.gray6, color: A.sub }}>
            <Clipboard size={14} /> Copy summary
          </button>
        </div>
        {noteDraft && (
          <div className="mt-3">
            <textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} rows={3} style={{ ...inputStyle, height: "auto", resize: "vertical" }} />
            <button onClick={() => onSaveNote(item)} className={`mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-white ${typography.denseButton}`} style={{ background: A.green }}>
              <Save size={14} /> Save note after confirmation
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
    in_review: "Move to In Review",
    waiting_supplier: "Mark Waiting Supplier",
    waiting_internal: "Mark Waiting Internal",
    resolved: "Mark Resolved",
    cancelled: "Cancel Case",
    closed: "Close Case",
  };
  return labels[status] || status;
}
