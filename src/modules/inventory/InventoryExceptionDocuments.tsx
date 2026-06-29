import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ClipboardCheck, FileSpreadsheet, LockKeyhole, Search, Shuffle, SlidersHorizontal, XCircle } from "lucide-react";
import ContextualImportActions from "../../components/import/ContextualImportActions";
import {
  DocumentActionBar,
  DocumentEvidencePanel,
  DocumentHeader,
  DocumentShell,
  DocumentStatusTimeline,
  statusTone,
} from "../../components/document/DocumentShell";
import { A, Card, Chip, inputStyle, KpiCard, Modal } from "../../components/ui";
import {
  buildInventoryExceptionDocuments,
  inventoryExceptionExportRows,
  inventoryExceptionSummary,
  type InventoryExceptionDocument,
  type InventoryExceptionDocumentStatus,
  type InventoryExceptionDocumentType,
} from "../../domain/inventory/exceptions";
import { exportRowsToCsv } from "../../lib/data-export";
import { fetchInventoryExceptions } from "./api";

function statusStyle(status: InventoryExceptionDocumentStatus) {
  if (status === "已关闭" || status === "已复核") return { color: A.green, bg: "#f0faf4" };
  if (status === "已驳回") return { color: A.red, bg: "#fff1f0" };
  if (status === "处理中") return { color: A.blue, bg: "#f0f6ff" };
  return { color: A.orange, bg: "#fff8f0" };
}

function typeColor(type: InventoryExceptionDocumentType) {
  if (type === "库存调整") return A.purple;
  if (type === "调拨差异") return A.indigo;
  if (type === "盘点差异关闭") return A.red;
  return A.orange;
}

function nextActionFor(status: InventoryExceptionDocumentStatus, fallback: string) {
  if (status === "已关闭") return "归档异常证据";
  if (status === "已复核") return "等待关闭";
  if (status === "已驳回") return "补充证据后退回复核";
  if (status === "处理中") return "跟进异常处理";
  return fallback;
}

export default function InventoryExceptionDocuments() {
  const [documents, setDocuments] = useState<InventoryExceptionDocument[]>(() => buildInventoryExceptionDocuments());
  const [typeFilter, setTypeFilter] = useState<"全部" | InventoryExceptionDocumentType>("全部");
  const [statusFilter, setStatusFilter] = useState<"全部" | InventoryExceptionDocumentStatus>("全部");
  const [warehouseFilter, setWarehouseFilter] = useState("全部");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<InventoryExceptionDocument | null>(null);

  useEffect(() => {
    let alive = true;
    fetchInventoryExceptions(buildInventoryExceptionDocuments()).then((rows) => {
      if (alive) setDocuments(rows);
    });
    return () => {
      alive = false;
    };
  }, []);

  const warehouses = useMemo(() => ["全部", ...Array.from(new Set(documents.map((doc) => doc.warehouse)))], [documents]);
  const visible = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return documents.filter((doc) => {
      const matchType = typeFilter === "全部" || doc.type === typeFilter;
      const matchStatus = statusFilter === "全部" || doc.status === statusFilter;
      const matchWarehouse = warehouseFilter === "全部" || doc.warehouse === warehouseFilter;
      const matchSearch = !keyword || [doc.id, doc.sku, doc.itemName, doc.linkedMovement, doc.linkedDocument, doc.reason].some((value) => String(value || "").toLowerCase().includes(keyword));
      return matchType && matchStatus && matchWarehouse && matchSearch;
    });
  }, [documents, search, statusFilter, typeFilter, warehouseFilter]);
  const summary = inventoryExceptionSummary(documents);

  function updateStatus(doc: InventoryExceptionDocument, status: InventoryExceptionDocumentStatus, message: string) {
    setDocuments((rows) => rows.map((row) => row.id === doc.id ? { ...row, status, nextAction: nextActionFor(status, row.nextAction) } : row));
    setSelected((current) => current?.id === doc.id ? { ...current, status, nextAction: nextActionFor(status, current.nextAction) } : current);
    toast.success(message, { description: doc.id });
  }

  function exportCsv() {
    if (visible.length === 0) {
      toast.warning("暂无可导出的库存异常单据");
      return;
    }
    exportRowsToCsv("inventory-exception-documents-export.csv", inventoryExceptionExportRows(visible));
    toast.success("导出文件已生成", { description: "库存异常单据" });
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight" style={{ color: A.label }}>库存异常单据</h1>
            <p className="text-xs leading-5 mt-1 max-w-3xl" style={{ color: A.sub }}>
              汇总库存调整、调拨差异、盘点差异关闭和冻结/释放处理，解释库存事务流水背后的业务原因与证据链。
            </p>
          </div>
          <ContextualImportActions entityLabel="库存异常单据" templateName="库存异常" compact />
        </div>
      </Card>

      <div className="grid grid-cols-5 gap-3">
        <KpiCard label="待复核调整" value={String(summary.pendingAdjustment)} sub="库存调整" icon={SlidersHorizontal} color={A.purple} />
        <KpiCard label="调拨差异" value={String(summary.transferException)} sub="在途/签收差异" icon={Shuffle} color={A.indigo} />
        <KpiCard label="盘点差异" value={String(summary.countVariance)} sub="待关闭证据" icon={ClipboardCheck} color={A.red} />
        <KpiCard label="冻结库存" value={String(summary.frozenInventory)} sub="冻结/释放处理" icon={LockKeyhole} color={A.orange} />
        <KpiCard label="已关闭异常" value={String(summary.closed)} sub="归档完成" icon={CheckCircle2} color={A.green} />
      </div>

      <Card>
        <div className="px-5 py-3 grid grid-cols-1 md:grid-cols-5 gap-3" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as "全部" | InventoryExceptionDocumentType)} style={inputStyle}>
            {["全部", "库存调整", "调拨差异", "盘点差异关闭", "冻结 / 释放"].map((item) => <option key={item} value={item}>{item === "全部" ? "全部类型" : item}</option>)}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "全部" | InventoryExceptionDocumentStatus)} style={inputStyle}>
            {["全部", "待复核", "处理中", "已复核", "已关闭", "已驳回"].map((item) => <option key={item} value={item}>{item === "全部" ? "全部状态" : item}</option>)}
          </select>
          <select value={warehouseFilter} onChange={(event) => setWarehouseFilter(event.target.value)} style={inputStyle}>
            {warehouses.map((item) => <option key={item} value={item}>{item === "全部" ? "全部仓库" : item}</option>)}
          </select>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: A.gray2 }} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索单据 / SKU / 流水" className="pl-8" style={inputStyle} />
          </div>
          <button onClick={exportCsv} className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all hover:opacity-90" style={{ background: A.gray6, color: A.blue }}>
            <FileSpreadsheet size={13} /> 导出当前结果
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[1500px]">
            <thead>
              <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                {["单据编号", "类型", "SKU", "品名", "仓库 / 库位", "数量影响", "状态", "负责人", "关联流水", "下一步", "操作"].map((header) => (
                  <th key={header} className="text-left px-4 py-3 font-medium whitespace-nowrap" style={{ color: A.gray1 }}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((doc, index) => {
                const style = statusStyle(doc.status);
                return (
                  <tr key={doc.id} className="hover:bg-blue-50/40 transition-colors" style={{ borderBottom: index < visible.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap tabular-nums" style={{ color: A.blue }}>{doc.id}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><Chip label={doc.type} color={typeColor(doc.type)} bg={`${typeColor(doc.type)}18`} /></td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums" style={{ color: A.blue }}>{doc.sku}</td>
                    <td className="px-4 py-3 max-w-[220px] truncate" style={{ color: A.label }}>{doc.itemName}</td>
                    <td className="px-4 py-3 min-w-[150px]" style={{ color: A.sub }}>
                      <div style={{ color: A.label }}>{doc.warehouse}</div>
                      <div className="text-[10px]">{doc.location}</div>
                    </td>
                    <td className="px-4 py-3 min-w-[88px] text-center whitespace-nowrap tabular-nums font-semibold" style={{ color: doc.quantityImpact < 0 ? A.red : doc.quantityImpact > 0 ? A.green : A.gray2 }}>
                      {doc.quantityImpact > 0 ? "+" : ""}{doc.quantityImpact.toLocaleString("zh-CN")} {doc.unit}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap"><Chip label={doc.status} color={style.color} bg={style.bg} /></td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: A.label }}>{doc.owner}</td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums" style={{ color: A.indigo }}>{doc.linkedMovement || doc.linkedDocument}</td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: A.blue }}>{doc.nextAction}</td>
                    <td className="px-4 py-3 whitespace-nowrap min-w-[160px]">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setSelected(doc)} className="px-2.5 py-1 rounded-md text-[11px] font-medium" style={{ background: A.gray6, color: A.blue }}>详情</button>
                        <button onClick={() => updateStatus(doc, "已复核", "库存异常单据已标记复核")} className="px-2.5 py-1 rounded-md text-[11px] font-medium" style={{ background: "#f0faf4", color: A.green }}>复核</button>
                        <button onClick={() => toast("更多操作", { description: `${doc.id} · ${doc.nextAction}` })} className="px-2.5 py-1 rounded-md text-[11px] font-medium" style={{ background: A.gray6, color: A.gray1 }}>更多</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} width={960} title="库存异常单据" subtitle={selected?.id}>
        {selected && (
          <DocumentShell
            title="库存异常单据"
            documentNo={selected.id}
            moduleLabel="库存 / 异常单据"
            status={selected.status}
            statusTone={statusTone(selected.status)}
            subtitle={`${selected.type} · ${selected.sku} · ${selected.warehouse}`}
          >
            <DocumentHeader
              fields={[
                { label: "类型", value: selected.type },
                { label: "SKU", value: selected.sku },
                { label: "品名", value: selected.itemName },
                { label: "仓库 / 库位", value: `${selected.warehouse} / ${selected.location}` },
                { label: "数量影响", value: `${selected.quantityImpact > 0 ? "+" : ""}${selected.quantityImpact.toLocaleString("zh-CN")} ${selected.unit}`, tone: selected.quantityImpact < 0 ? "danger" : selected.quantityImpact > 0 ? "success" : "neutral" },
                { label: "负责人", value: selected.owner },
                { label: "关联流水", value: selected.linkedMovement || "—" },
                { label: "关联单据", value: selected.linkedDocument },
              ]}
            />
            <DocumentStatusTimeline steps={selected.timeline} />
            <DocumentEvidencePanel
              linkedDocuments={[
                selected.linkedMovement ? { label: "库存事务流水", value: selected.linkedMovement, moduleId: "inventory:movements", tone: "info" } : undefined,
                { label: "来源单据", value: selected.linkedDocument, moduleId: "inventory:exceptions", tone: "warning" },
              ].filter(Boolean) as any}
              evidence={[
                ...selected.evidence.map((item) => ({ label: item.label, value: item.value })),
                { label: "下一步", value: selected.nextAction, tone: "info" },
              ]}
              notes={selected.reason}
              confidence="库存事务流水与异常单据规则派生"
            />
            <DocumentActionBar>
              <button onClick={() => updateStatus(selected, "已复核", "库存异常单据已标记复核")} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "#f0faf4", color: A.green }}>标记已复核</button>
              <button onClick={() => updateStatus(selected, "已关闭", "库存异常单据已关闭")} className="text-xs px-3 py-1.5 rounded-lg font-medium text-white" style={{ background: A.blue }}>关闭异常</button>
              <button onClick={() => updateStatus(selected, "已驳回", "库存异常单据已退回复核")} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "#fff1f0", color: A.red }}><XCircle size={12} className="inline mr-1" />退回复核</button>
              <button onClick={() => setSelected(null)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: A.white, color: A.label, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)" }}>关闭</button>
            </DocumentActionBar>
          </DocumentShell>
        )}
      </Modal>
    </div>
  );
}
