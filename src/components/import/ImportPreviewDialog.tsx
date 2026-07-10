import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { A, Card, Chip, Modal } from "../ui";
import type { ExcelBusinessSchema } from "../../lib/excel/excelSchemas";
import type { ParsedWorkbook } from "../../lib/excel/excelWorkbookService";
import { exportRowsToWorkbook } from "../../lib/excel/excelWorkbookService";
import { autoMapHeaders, validateImportRows } from "../../lib/excel/importValidationService";
import { createImportTask, type ImportTask } from "../../lib/excel/importTaskService";
import { commitBusinessImport, previewBusinessImport, type ImportPreviewResponse } from "../../lib/excel/importPersistenceApi";

type Props = { workbook: ParsedWorkbook | null; schema: ExcelBusinessSchema; onClose: () => void; onReupload: () => void };

export function ImportPreviewDialog({ workbook, schema, onClose, onReupload }: Props) {
  const navigate = useNavigate();
  const [sheetName, setSheetName] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [task, setTask] = useState<ImportTask | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");

  useEffect(() => {
    const nextSheet = workbook?.sheetNames[0] || "";
    setSheetName(nextSheet); setTask(null); setPreview(null); setIdempotencyKey(crypto.randomUUID());
    setMapping(nextSheet && workbook ? autoMapHeaders(workbook.headers[nextSheet], schema) : {});
  }, [workbook, schema]);

  const headers = workbook?.headers[sheetName] || [];
  const rows = workbook?.sheets[sheetName] || [];
  const validation = useMemo(() => validateImportRows(rows, headers, schema, mapping), [rows, headers, schema, mapping]);
  const invalidatePreview = () => { setPreview(null); setTask(null); setIdempotencyKey(crypto.randomUUID()); };
  function changeSheet(value: string) { setSheetName(value); setMapping(workbook ? autoMapHeaders(workbook.headers[value], schema) : {}); invalidatePreview(); }

  async function createPreview() {
    if (!workbook || validation.errorRows) return;
    setSubmitting(true);
    try {
      const next = await previewBusinessImport({
        businessObject: schema.id, schemaVersion: "1", fileMetadata: { name: workbook.fileName, size: workbook.fileSize }, sheetName, fieldMapping: mapping,
        rows: validation.rows.map((row) => row.normalized),
        validationErrors: validation.rows.flatMap((row) => row.issues.filter((issue) => issue.level === "error")),
        validationWarnings: validation.rows.flatMap((row) => row.issues.filter((issue) => issue.level === "warning")),
      });
      setPreview(next);
      toast.success("后端导入预览已生成", { description: `预览 ${next.previewId} · 业务数据尚未写入` });
    } catch (error) { toast.error("无法生成后端预览", { description: error instanceof Error ? error.message : "请稍后重试" }); }
    finally { setSubmitting(false); }
  }

  async function confirmImport() {
    if (!workbook || !preview || validation.errorRows) return;
    setSubmitting(true);
    try {
      const committed = await commitBusinessImport(preview.previewId, { previewId: preview.previewId, businessObject: schema.id, snapshotHash: preview.snapshotHash, idempotencyKey, userConfirmation: true, acceptedWarningCodes: preview.validationSummary.warningRows ? ["preview_warnings_reviewed"] : [] });
      const allIssues = validation.rows.flatMap((row) => row.issues);
      const next = createImportTask({
        originalFileName: workbook.fileName, sheetName, businessObject: schema.label, sourcePage: window.location.pathname, uploadedBy: "当前用户",
        totalRows: rows.length, validRows: validation.validRows, warningRows: validation.warningRows, errorRows: validation.errorRows, fieldMapping: mapping,
        validationErrors: allIssues.filter((item) => item.level === "error"), validationWarnings: allIssues.filter((item) => item.level === "warning"),
        previewId: preview.previewId, snapshotHash: preview.snapshotHash, importBatchId: committed.importBatchId, auditEventId: committed.auditEventId,
        inserted: committed.inserted, updated: committed.updated, skipped: committed.skipped, rollbackAvailable: committed.rollbackAvailable,
      });
      setTask(next);
      toast.success(`导入批次 ${committed.importBatchId} 已提交`, { description: `新增 ${committed.inserted} · 更新 ${committed.updated} · 跳过 ${committed.skipped}` });
    } catch (error) { toast.error("正式导入失败", { description: error instanceof Error ? error.message : "请稍后重试" }); }
    finally { setSubmitting(false); }
  }

  async function downloadFailedRows() {
    if (!workbook) return;
    const failed = validation.rows.filter((row) => row.level === "error").flatMap((row) => row.issues.filter((issue) => issue.level === "error").map((issue) => ({ 原始行号: row.rowNumber, 原始数据: JSON.stringify(row.original), 错误字段: issue.field, 错误原因: issue.reason, 修复建议: issue.suggestion })));
    if (!failed.length) return toast.warning("当前没有失败行");
    const filename = await exportRowsToWorkbook(`${schema.id}-failed-rows`, failed, "失败行");
    toast.success("失败行已下载", { description: filename });
  }

  return <Modal open={Boolean(workbook)} onClose={onClose} width={1120} title={`${schema.label} Excel 导入`} subtitle={workbook ? `${workbook.fileName} · ${(workbook.fileSize / 1024).toFixed(1)} KB` : undefined}>
    {workbook && <div className="space-y-4" data-testid="excel-import-preview">
      {task && <Card className="p-4" data-testid="import-task-result" style={{ background: "#f0faf4" }}><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-sm font-semibold" style={{ color: A.green }}>导入批次 {task.importBatchId} 已提交</div><div className="mt-1 text-xs" style={{ color: A.sub }}>新增 {task.inserted} · 更新 {task.updated} · 跳过 {task.skipped} · 审计 {task.auditEventId}</div></div><div className="flex gap-2"><button onClick={() => navigate(`/app/imports?task=${task.importBatchId}`)} className="px-3 py-2 text-xs font-semibold rounded-lg" style={{ background: A.white, color: A.blue }}>查看任务</button><button onClick={downloadFailedRows} className="px-3 py-2 text-xs font-semibold rounded-lg" style={{ background: A.white, color: A.red }}>下载失败行</button><button onClick={onReupload} className="px-3 py-2 text-xs font-semibold rounded-lg" style={{ background: A.white, color: A.label }}><RotateCcw size={12} className="inline mr-1" />重新上传</button></div></div></Card>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3"><Card className="p-4"><div className="fc-caption" style={{ color: A.gray2 }}>原始文件</div><div className="mt-1 text-sm font-semibold truncate">{workbook.fileName}</div><div className="mt-1 text-xs" style={{ color: A.sub }}>{rows.length} 行 · {headers.length} 列</div></Card><Card className="p-4"><label className="fc-caption" style={{ color: A.gray2 }}>选择 Sheet</label><select value={sheetName} onChange={(event) => changeSheet(event.target.value)} className="mt-2 w-full rounded-lg px-3 py-2 text-sm" style={{ background: A.gray6 }}>{workbook.sheetNames.map((name) => <option key={name}>{name}</option>)}</select></Card><Card className="p-4"><div className="fc-caption" style={{ color: A.gray2 }}>校验摘要</div><div className="mt-2 flex flex-wrap gap-2"><Chip label={`有效 ${validation.validRows}`} color={A.green} bg="#f0faf4" /><Chip label={`警告 ${validation.warningRows}`} color={A.orange} bg="#fff8f0" /><Chip label={`错误 ${validation.errorRows}`} color={A.red} bg="#fff1f0" /></div></Card></div>
      <Card><div className="px-4 py-3 font-semibold text-sm" style={{ borderBottom: `1px solid ${A.border}` }}>字段映射</div><div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">{schema.fields.map((field) => <label key={field.key} className="flex items-center gap-3 text-xs"><span className="w-32 shrink-0 font-medium">{field.label}{field.required && <span style={{ color: A.red }}> *</span>}</span><select value={mapping[field.key] || ""} onChange={(event) => { setMapping((current) => ({ ...current, [field.key]: event.target.value })); invalidatePreview(); }} className="min-w-0 flex-1 rounded-lg px-3 py-2" style={{ background: A.gray6 }}><option value="">不映射</option>{headers.map((header) => <option key={header}>{header}</option>)}</select></label>)}</div></Card>
      <Card><div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${A.border}` }}><div className="font-semibold text-sm">前 20 行预览与校验</div>{validation.errorRows > 0 && <button onClick={downloadFailedRows} className="text-xs font-semibold text-red-600"><Download size={12} className="inline mr-1" />下载失败行</button>}</div><div className="overflow-x-auto max-h-[320px]"><table className="w-full min-w-[900px] text-xs"><thead><tr>{["行号", "状态", ...schema.fields.slice(0, 6).map((field) => field.label), "问题 / 修复建议"].map((header) => <th key={header} className="px-3 py-2 text-left whitespace-nowrap" style={{ color: A.gray1 }}>{header}</th>)}</tr></thead><tbody>{validation.rows.slice(0, 20).map((row) => <tr key={row.rowNumber} style={{ background: row.level === "error" ? "#fff7f7" : "transparent", borderTop: `1px solid ${A.border}` }}><td className="px-3 py-2">{row.rowNumber}</td><td className="px-3 py-2">{row.level === "valid" ? <CheckCircle2 size={14} color={A.green} /> : <AlertTriangle size={14} color={row.level === "error" ? A.red : A.orange} />}</td>{schema.fields.slice(0, 6).map((field) => <td key={field.key} className="px-3 py-2 whitespace-nowrap">{String(row.normalized[field.key] ?? "")}</td>)}<td className="px-3 py-2 min-w-[280px]" style={{ color: row.level === "error" ? A.red : A.orange }}>{row.issues.map((item) => `${item.field}：${item.reason}（${item.suggestion}）`).join("；") || "—"}</td></tr>)}</tbody></table></div></Card>
      {preview && !task && <Card className="p-3" style={{ background: "#f0f6ff" }} data-testid="server-import-preview"><div className="text-xs font-semibold" style={{ color: A.blue }}>后端预览 {preview.previewId}</div><div className="mt-1 text-[11px]" style={{ color: A.sub }}>快照 {preview.snapshotHash.slice(0, 12)}… · {preview.validationSummary.validRows} 行可提交 · 预览阶段未写文件、未写业务数据</div></Card>}
      <div className="flex flex-wrap justify-end gap-2"><button onClick={onReupload} className="px-4 py-2 text-xs font-semibold rounded-lg" style={{ background: A.gray6, color: A.label }}><RotateCcw size={13} className="inline mr-1" />重新上传</button>{!preview ? <button onClick={createPreview} disabled={!rows.length || validation.errorRows > 0 || submitting} className="px-4 py-2 text-xs font-semibold rounded-lg text-white disabled:opacity-40" style={{ background: A.blue }}><FileSpreadsheet size={13} className="inline mr-1" />{submitting ? "生成中…" : "生成后端预览"}</button> : <button onClick={confirmImport} disabled={submitting || Boolean(task)} className="px-4 py-2 text-xs font-semibold rounded-lg text-white disabled:opacity-40" style={{ background: A.green }}><FileSpreadsheet size={13} className="inline mr-1" />{submitting ? "提交中…" : "确认正式导入"}</button>}</div>
    </div>}
  </Modal>;
}
