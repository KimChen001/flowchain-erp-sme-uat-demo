import React from "react";
import { X } from "lucide-react";
import { A, Card, Chip } from "../ui";

export type DocumentTone = "neutral" | "info" | "success" | "warning" | "danger" | "purple";
export type DocumentField = {
  label: string;
  value: React.ReactNode;
  tone?: DocumentTone;
  helper?: React.ReactNode;
};
export type DocumentColumn<T> = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  render?: (row: T, index: number) => React.ReactNode;
};
export type DocumentTotal = {
  label: string;
  value: React.ReactNode;
  tone?: DocumentTone;
};
export type TimelineStep = {
  label: string;
  status: "done" | "current" | "warning" | "blocked" | "pending";
  helper?: React.ReactNode;
};
export type LinkedDocument = {
  label: string;
  value: string;
  moduleId?: string;
  tone?: DocumentTone;
};
export type EvidenceRow = {
  label: string;
  value: React.ReactNode;
  tone?: DocumentTone;
};

export function documentToneStyle(tone: DocumentTone = "neutral") {
  if (tone === "success") return { color: A.green, bg: "#f0faf4" };
  if (tone === "warning") return { color: A.orange, bg: "#fff8f0" };
  if (tone === "danger") return { color: A.red, bg: "#fff1f0" };
  if (tone === "purple") return { color: A.purple, bg: "#faf3ff" };
  if (tone === "info") return { color: A.blue, bg: "#f0f6ff" };
  return { color: A.gray1, bg: A.gray6 };
}

export function statusTone(status?: string): DocumentTone {
  if (!status) return "neutral";
  if (["已付款", "已过账应付", "已审批", "已批准", "已完成", "已入库", "自动匹配", "已解决"].includes(status)) return "success";
  if (["待审批", "待匹配", "人工复核", "质检中", "已发出", "部分到货"].includes(status)) return "warning";
  if (["存在差异", "已驳回", "已取消", "异常处理", "差异待处理", "重复发票"].includes(status)) return "danger";
  if (["已匹配", "已接收", "已签收"].includes(status)) return "info";
  return "neutral";
}

export function DocumentShell({
  title,
  subtitle,
  documentNo,
  moduleLabel,
  status,
  statusTone: tone,
  actions,
  children,
  onClose,
}: {
  title: string;
  subtitle?: React.ReactNode;
  documentNo?: React.ReactNode;
  moduleLabel?: React.ReactNode;
  status?: string;
  statusTone?: DocumentTone;
  actions?: React.ReactNode;
  children: React.ReactNode;
  onClose?: () => void;
}) {
  const style = documentToneStyle(tone || statusTone(status));
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {moduleLabel && <Chip label={String(moduleLabel)} color={A.blue} bg="#f0f6ff" />}
            {status && <Chip label={status} color={style.color} bg={style.bg} />}
          </div>
          <h2 className="text-lg font-semibold tracking-tight" style={{ color: A.label }}>{title}</h2>
          <div className="text-xs mt-1" style={{ color: A.sub }}>
            {documentNo && <span className="font-semibold tabular-nums" style={{ color: A.blue }}>{documentNo}</span>}
            {documentNo && subtitle ? <span> · </span> : null}
            {subtitle}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {actions}
          {onClose && (
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors" style={{ color: A.gray1 }}>
              <X size={15} />
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

export function DocumentHeader({ fields, columns = 4 }: { fields: DocumentField[]; columns?: 2 | 3 | 4 }) {
  return (
    <Card className="p-4">
      <div className={`grid gap-3 ${columns === 2 ? "grid-cols-2" : columns === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
        {fields.map((field) => {
          const style = documentToneStyle(field.tone);
          return (
            <div key={field.label} className="min-w-0">
              <div className="text-[10px] font-medium" style={{ color: A.gray2 }}>{field.label}</div>
              <div className="text-xs font-semibold mt-1 truncate" style={{ color: field.tone ? style.color : A.label }}>{field.value || "—"}</div>
              {field.helper && <div className="text-[10px] leading-4 mt-0.5 truncate" style={{ color: A.sub }}>{field.helper}</div>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function DocumentLinesTable<T extends Record<string, unknown>>({
  columns,
  rows,
  emptyText = "暂无明细行",
  compact = true,
}: {
  columns: DocumentColumn<T>[];
  rows: T[];
  emptyText?: string;
  compact?: boolean;
}) {
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {columns.map((column) => (
                <th key={column.key} className={`${column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : "text-left"} ${compact ? "px-3 py-2" : "px-4 py-3"} font-medium whitespace-nowrap`} style={{ color: A.gray1 }}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center" style={{ color: A.gray2 }}>{emptyText}</td>
              </tr>
            ) : rows.map((row, index) => (
              <tr key={String((row as any).id || (row as any).lineId || index)} style={{ borderBottom: index < rows.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                {columns.map((column) => (
                  <td key={column.key} className={`${column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : "text-left"} ${compact ? "px-3 py-2" : "px-4 py-3"} whitespace-nowrap`} style={{ color: A.label }}>
                    {column.render ? column.render(row, index) : String(row[column.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function DocumentTotals({ totals, columns = 4 }: { totals: DocumentTotal[]; columns?: 3 | 4 | 5 }) {
  return (
    <Card className="p-4">
      <div className={`grid gap-2 ${columns === 3 ? "grid-cols-3" : columns === 5 ? "grid-cols-5" : "grid-cols-4"}`}>
        {totals.map((total) => {
          const style = documentToneStyle(total.tone);
          return (
            <div key={total.label} className="rounded-lg px-3 py-2" style={{ background: total.tone ? style.bg : A.gray6 }}>
              <div className="text-[10px]" style={{ color: A.gray2 }}>{total.label}</div>
              <div className="text-sm font-semibold mt-0.5 truncate" style={{ color: total.tone ? style.color : A.label }}>{total.value}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function DocumentStatusTimeline({ steps }: { steps: TimelineStep[] }) {
  const colorFor = (status: TimelineStep["status"]) => {
    if (status === "done") return A.green;
    if (status === "current") return A.blue;
    if (status === "warning") return A.orange;
    if (status === "blocked") return A.red;
    return A.gray3;
  };
  return (
    <Card className="p-4">
      <div className="flex items-start overflow-x-auto pb-1">
        {steps.map((step, index) => {
          const color = colorFor(step.status);
          return (
            <div key={`${step.label}-${index}`} className="flex items-start min-w-[116px]">
              <div className="flex flex-col items-center">
                <div className="w-4 h-4 rounded-full" style={{ background: color, boxShadow: `0 0 0 3px ${color}18` }} />
                {index < steps.length - 1 && <div className="h-px w-20 mt-2" style={{ background: color }} />}
              </div>
              <div className="ml-2 -mt-0.5">
                <div className="text-xs font-semibold" style={{ color: step.status === "pending" ? A.gray1 : A.label }}>{step.label}</div>
                {step.helper && <div className="text-[10px] mt-0.5" style={{ color: A.gray2 }}>{step.helper}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function DocumentEvidencePanel({
  linkedDocuments = [],
  evidence = [],
  notes,
  confidence,
  provenance,
  onNavigate,
}: {
  linkedDocuments?: LinkedDocument[];
  evidence?: EvidenceRow[];
  notes?: React.ReactNode;
  confidence?: React.ReactNode;
  provenance?: React.ReactNode;
  onNavigate?: (moduleId: string) => void;
}) {
  return (
    <Card className="p-4">
      <div className="grid grid-cols-[0.9fr_1.1fr] gap-4">
        <div>
          <div className="text-xs font-semibold mb-2" style={{ color: A.label }}>关联单据</div>
          <div className="space-y-1.5">
            {linkedDocuments.length === 0 ? (
              <div className="text-[11px]" style={{ color: A.gray2 }}>暂无关联单据</div>
            ) : linkedDocuments.map((doc) => {
              const style = documentToneStyle(doc.tone || "info");
              return (
                <button key={`${doc.label}-${doc.value}`} onClick={() => doc.moduleId && onNavigate?.(doc.moduleId)}
                  disabled={!doc.moduleId || !onNavigate}
                  className="w-full rounded-lg px-2.5 py-2 text-left disabled:cursor-default"
                  style={{ background: style.bg, color: style.color }}>
                  <div className="text-[10px] font-medium">{doc.label}</div>
                  <div className="text-xs font-semibold mt-0.5 truncate">{doc.value}</div>
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold mb-2" style={{ color: A.label }}>证据 / 来源</div>
          <div className="grid grid-cols-2 gap-2">
            {evidence.map((row) => {
              const style = documentToneStyle(row.tone);
              return (
                <div key={row.label} className="rounded-lg px-2.5 py-2" style={{ background: row.tone ? style.bg : A.gray6 }}>
                  <div className="text-[10px]" style={{ color: A.gray2 }}>{row.label}</div>
                  <div className="text-[11px] font-semibold mt-0.5 truncate" style={{ color: row.tone ? style.color : A.label }}>{row.value || "—"}</div>
                </div>
              );
            })}
          </div>
          {(confidence || provenance || notes) && (
            <div className="mt-3 rounded-lg p-3 text-[11px] leading-5" style={{ background: A.gray6, color: A.sub }}>
              {confidence && <div><span className="font-semibold" style={{ color: A.gray1 }}>置信度：</span>{confidence}</div>}
              {provenance && <div><span className="font-semibold" style={{ color: A.gray1 }}>来源：</span>{provenance}</div>}
              {notes && <div><span className="font-semibold" style={{ color: A.gray1 }}>备注：</span>{notes}</div>}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export function DocumentActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {children}
    </div>
  );
}
