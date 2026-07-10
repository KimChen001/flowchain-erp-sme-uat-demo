import { useRef, useState } from "react";
import { Download, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { downloadExcelTemplate, parseExcelFile, type ParsedWorkbook } from "../../lib/excel/excelWorkbookService";
import { schemaForEntity } from "../../lib/excel/excelSchemas";
import { ImportPreviewDialog } from "./ImportPreviewDialog";

type ContextualImportActionsProps = { entityLabel: string; templateName?: string; compact?: boolean };

export default function ContextualImportActions({ entityLabel, templateName, compact = false }: ContextualImportActionsProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [parsing, setParsing] = useState(false);
  const [workbook, setWorkbook] = useState<ParsedWorkbook | null>(null);
  const schema = schemaForEntity(templateName || entityLabel);
  async function selectFile(file?: File) {
    if (!file) return;
    setParsing(true);
    try { setWorkbook(await parseExcelFile(file)); } catch (error) { toast.error("无法解析 Excel 文件", { description: error instanceof Error ? error.message : "请检查文件格式" }); } finally { setParsing(false); }
  }
  function downloadTemplate() { const filename = downloadExcelTemplate(schema); toast.success("模板已下载", { description: filename }); }
  const buttonClass = compact ? "h-8 px-2.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5" : "h-9 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5";
  return <>
    <input ref={inputRef} type="file" className="hidden" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" onChange={(event) => { selectFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />
    <div className="inline-flex items-center gap-1.5" data-testid="excel-import-actions">
      <button type="button" onClick={() => inputRef.current?.click()} className={buttonClass} style={{ background: "#f0f6ff", color: "#2563eb" }}>{parsing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}导入{compact ? "" : ` ${entityLabel}`}</button>
      <button type="button" onClick={downloadTemplate} className={buttonClass} style={{ background: "#f8fafc", color: "#475569" }}><Download size={13} />下载模板</button>
    </div>
    <ImportPreviewDialog workbook={workbook} schema={schema} onClose={() => setWorkbook(null)} onReupload={() => { setWorkbook(null); window.setTimeout(() => inputRef.current?.click(), 0); }} />
  </>;
}
