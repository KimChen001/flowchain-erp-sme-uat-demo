import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Lock, Upload } from "lucide-react";
import { toast } from "sonner";
import { A, Card, Chip } from "../../components/ui";
import { apiJson } from "../../lib/api-client";
import { exportRowsToWorkbook, parseExcelFile, type ParsedWorkbook } from "../../lib/excel/excelWorkbookService";

type ImportType = "items" | "suppliers" | "warehouses" | "locations" | "open_purchase_orders" | "opening_inventory_balances";
type Preview = { id: string; importType: ImportType; status: "ready" | "blocked"; totalRows: number; validRows: number; invalidRows: number; issues: number; fileHash: string; writesBusinessObjects: false };
type ImportIssue = { id: string; rowNumber: number; field?: string; code: string; message: string; rawValue?: string };

const CONFIG: Record<ImportType, { label: string; description: string; fields: string[]; dangerous?: boolean }> = {
  items: { label: "物料", description: "SKU、名称、单位与状态", fields: ["sku", "name", "unit", "status", "preferredSupplierCode"] },
  suppliers: { label: "供应商", description: "供应商编号、名称、币种与付款条款", fields: ["code", "name", "currency", "status", "paymentTermCode"] },
  warehouses: { label: "仓库", description: "仅管理员可提交仓库主数据", fields: ["code", "name", "status"] },
  locations: { label: "库位", description: "必须关联当前工作区已有仓库", fields: ["warehouseCode", "code", "name", "status"] },
  open_purchase_orders: { label: "期初未结采购订单", description: "仅允许受支持的开放状态与已存在主数据", fields: ["poNumber", "supplierCode", "sku", "orderedQuantity", "receivedQuantity", "unit", "currency", "status", "expectedDate"] },
  opening_inventory_balances: { label: "期初库存余额", description: "正式提交后生成不可变库存事务并永久锁定二次期初导入", fields: ["sku", "warehouseCode", "location", "quantity", "unit"], dangerous: true },
};

export default function PilotImportWorkbench() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [importType, setImportType] = useState<ImportType>("items");
  const [workbook, setWorkbook] = useState<ParsedWorkbook | null>(null);
  const [sheet, setSheet] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [issues, setIssues] = useState<ImportIssue[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ id: string; status: string; committedRows: number; idempotentReplay: boolean } | null>(null);
  const headers = workbook?.headers[sheet] || [];
  const rows = workbook?.sheets[sheet] || [];
  const config = CONFIG[importType];
  const mappedCount = useMemo(() => config.fields.filter(field => mapping[field]).length, [config.fields, mapping]);

  function resetRun(nextType = importType) {
    setImportType(nextType); setWorkbook(null); setSheet(""); setMapping({}); setPreview(null); setIssues([]); setConfirmed(false); setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function chooseFile(file?: File) {
    if (!file) return;
    if (!/\.(csv|xlsx)$/i.test(file.name)) return toast.error("仅支持 CSV 或 XLSX 文件");
    if (file.size > 10 * 1024 * 1024) return toast.error("文件不能超过 10 MB");
    setBusy(true);
    try {
      const parsed = await parseExcelFile(file); const firstSheet = parsed.sheetNames[0] || ""; const nextHeaders = parsed.headers[firstSheet] || [];
      setWorkbook(parsed); setSheet(firstSheet); setMapping(Object.fromEntries(config.fields.map(field => [field, nextHeaders.find(header => header.toLowerCase() === field.toLowerCase()) || ""])));
      setPreview(null); setIssues([]); setConfirmed(false); setResult(null);
    } catch (error) { toast.error("无法解析文件", { description: error instanceof Error ? error.message : "请检查文件" }); }
    finally { setBusy(false); }
  }

  async function dryRun() {
    if (!workbook || !sheet) return;
    setBusy(true); setPreview(null); setIssues([]); setResult(null); setConfirmed(false);
    try {
      const next = await apiJson<Preview>("/api/imports/preview", { method: "POST", body: JSON.stringify({ importType, fileName: workbook.fileName, fileSize: workbook.fileSize, mapping, rows }) });
      setPreview(next);
      if (next.issues) setIssues((await apiJson<{ issues: ImportIssue[] }>(`/api/imports/${encodeURIComponent(next.id)}/issues`)).issues);
      toast[next.status === "ready" ? "success" : "warning"](next.status === "ready" ? "Dry Run 已通过" : "Dry Run 发现阻断问题");
    } catch (error) { toast.error("Dry Run 失败", { description: error instanceof Error ? error.message : "请稍后重试" }); }
    finally { setBusy(false); }
  }

  async function commit() {
    if (!preview || preview.status !== "ready" || !confirmed) return;
    setBusy(true);
    try {
      const next = await apiJson<{ id: string; status: string; committedRows: number; idempotentReplay: boolean }>(`/api/imports/${encodeURIComponent(preview.id)}/commit`, { method: "POST", body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }) });
      setResult(next); toast.success(`已原子提交 ${next.committedRows} 行`);
    } catch (error) { toast.error("正式提交失败", { description: error instanceof Error ? error.message : "没有写入任何业务数据" }); }
    finally { setBusy(false); }
  }

  async function exportDataset(dataset: string) {
    setBusy(true);
    try {
      const payload = await apiJson<{ rows: Record<string, unknown>[]; truncated: boolean }>(`/api/pilot/exports/${dataset}`);
      if (!payload.rows.length) return toast.warning("当前范围没有可导出数据");
      const filename = await exportRowsToWorkbook(`flowchain-${dataset}`, payload.rows);
      toast.success("导出已生成", { description: `${filename}${payload.truncated ? " · 结果已截断为 5000 行" : ""}` });
    } catch (error) { toast.error("导出失败", { description: error instanceof Error ? error.message : "请稍后重试" }); }
    finally { setBusy(false); }
  }

  return <Card className="p-5" data-testid="pilot-import-workbench">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="flex items-center gap-2"><FileSpreadsheet size={18} color={A.blue} /><h2 className="text-base font-semibold">Pilot 数据导入工作台</h2><Chip label="PostgreSQL" color={A.green} bg="#f0faf4" /></div><p className="mt-1 text-xs" style={{ color: A.sub }}>上传 → 字段映射 → Dry Run → 问题修复 → 人工确认 → 原子提交与审计。预览阶段不写业务数据。</p></div>
      <div className="text-[11px] text-right" style={{ color: A.gray1 }}>CSV / XLSX · 最大 10 MB · 1–5000 行</div>
    </div>

    <div className="mt-4 grid grid-cols-2 lg:grid-cols-6 gap-2">
      {(Object.keys(CONFIG) as ImportType[]).map(type => <button key={type} onClick={() => resetRun(type)} className="rounded-xl p-3 text-left" style={{ border: `1px solid ${type === importType ? A.blue : A.border}`, background: type === importType ? "#f0f6ff" : A.white }}><div className="text-xs font-semibold" style={{ color: type === importType ? A.blue : A.label }}>{CONFIG[type].label}</div><div className="mt-1 text-[11px] leading-4" style={{ color: A.sub }}>{CONFIG[type].description}</div></button>)}
    </div>

    {config.dangerous && <div className="mt-3 flex gap-2 rounded-xl p-3 text-xs" style={{ background: "#fff8f0", color: A.orange }}><Lock size={15} className="shrink-0" /><span>期初库存只允许成功提交一次；提交会创建正式库存事务、更新余额并锁定工作区，之后不得重新导入。</span></div>}

    <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
      <label className="rounded-xl p-4 cursor-pointer" style={{ border: `1px dashed ${A.blue}`, background: "#f8fbff" }}><input ref={inputRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={event => chooseFile(event.target.files?.[0])} /><div className="flex items-center gap-2 text-sm font-semibold" style={{ color: A.blue }}><Upload size={16} />{workbook ? "更换文件" : "选择 CSV / XLSX"}</div><div className="mt-2 text-xs truncate" style={{ color: A.sub }}>{workbook ? `${workbook.fileName} · ${rows.length} 行` : "原始文件不会保存到数据库"}</div></label>
      <label className="rounded-xl p-4" style={{ border: `1px solid ${A.border}` }}><span className="text-xs font-semibold">Sheet</span><select className="mt-2 w-full rounded-lg p-2 text-xs" value={sheet} disabled={!workbook} onChange={event => { setSheet(event.target.value); setPreview(null); setIssues([]); }} style={{ background: A.gray6 }}>{workbook?.sheetNames.map(name => <option key={name}>{name}</option>)}</select></label>
      <div className="rounded-xl p-4" style={{ border: `1px solid ${A.border}` }}><div className="text-xs font-semibold">当前步骤</div><div className="mt-2 text-xs" style={{ color: result ? A.green : preview?.status === "blocked" ? A.red : A.blue }}>{result ? "提交完成并记录审计" : preview ? (preview.status === "ready" ? "Dry Run 通过，等待人工确认" : "Dry Run 阻断，请修复后重新上传") : workbook ? "配置字段映射并运行 Dry Run" : "等待上传文件"}</div></div>
    </div>

    {workbook && <div className="mt-4"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">字段映射</h3><span className="text-[11px]" style={{ color: A.sub }}>已映射 {mappedCount}/{config.fields.length}</span></div><div className="mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">{config.fields.map(field => <label key={field} className="rounded-lg p-2" style={{ background: A.gray6 }}><span className="block text-[11px] font-medium">{field}</span><select value={mapping[field] || ""} onChange={event => { setMapping(current => ({ ...current, [field]: event.target.value })); setPreview(null); setIssues([]); }} className="mt-1 w-full bg-transparent text-xs"><option value="">不映射</option>{headers.map(header => <option key={header}>{header}</option>)}</select></label>)}</div></div>}

    {preview && <div className="mt-4 rounded-xl p-4" style={{ background: preview.status === "ready" ? "#f0faf4" : "#fff1f0" }}><div className="flex items-center gap-2">{preview.status === "ready" ? <CheckCircle2 size={16} color={A.green} /> : <AlertTriangle size={16} color={A.red} />}<span className="text-sm font-semibold">Dry Run {preview.status === "ready" ? "通过" : "已阻断"}</span><Chip label={`${preview.validRows}/${preview.totalRows} 有效`} color={preview.status === "ready" ? A.green : A.red} bg={A.white} /></div><div className="mt-2 text-[11px]" style={{ color: A.sub }}>批次 {preview.id} · 文件哈希 {preview.fileHash.slice(0, 12)}… · 业务写入：否</div></div>}

    {issues.length > 0 && <div className="mt-3 overflow-x-auto"><table className="w-full text-xs"><thead><tr>{["行", "字段", "代码", "问题", "原值"].map(value => <th key={value} className="p-2 text-left" style={{ color: A.gray1 }}>{value}</th>)}</tr></thead><tbody>{issues.slice(0, 100).map(item => <tr key={item.id} style={{ borderTop: `1px solid ${A.border}` }}><td className="p-2">{item.rowNumber || "文件"}</td><td className="p-2">{item.field || "—"}</td><td className="p-2" style={{ color: A.red }}>{item.code}</td><td className="p-2">{item.message}</td><td className="p-2">{item.rawValue || "—"}</td></tr>)}</tbody></table></div>}

    <div className="mt-4 flex flex-wrap items-center justify-end gap-3"><button onClick={dryRun} disabled={!workbook || busy || Boolean(result)} className="rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-40" style={{ background: A.blue, color: A.white }}>{busy && !preview ? "校验中…" : "运行 Dry Run"}</button>{preview?.status === "ready" && !result && <><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />我已复核文件、映射与校验结果</label><button onClick={commit} disabled={!confirmed || busy} className="rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-40" style={{ background: A.green, color: A.white }}>{busy ? "提交中…" : "确认正式提交"}</button></>}{result && <Chip label={`已提交 ${result.committedRows} 行`} color={A.green} bg="#f0faf4" />}</div>
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4" style={{ borderColor: A.border }}><span className="mr-1 text-xs font-semibold">当前权限范围导出</span>{[["receiving_documents","收货单"],["inventory_movements","库存事务"],["inventory_balances","库存余额"],["import_issues","导入问题"]].map(([dataset,label])=><button key={dataset} disabled={busy} onClick={()=>void exportDataset(dataset)} className="rounded-lg px-3 py-2 text-xs disabled:opacity-40" style={{ background: A.gray6, color: A.blue }}><Download size={13} className="mr-1 inline"/>{label}</button>)}</div>
  </Card>;
}
