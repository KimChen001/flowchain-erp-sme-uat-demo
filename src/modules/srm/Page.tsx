import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Award,
  AlertTriangle,
  Building2,
  ClipboardCheck,
  FileSpreadsheet,
  Handshake,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import ContextualImportActions from "../../components/import/ContextualImportActions";
import { A, Card, Chip, KpiCard, SectionHeader, SubTabs } from "../../components/ui";
import { CONTRACTS, RFQS } from "../../data/demo-data";
import { SUPPLIER_MASTER } from "../../data/master-data";
import type { ActiveContext } from "../ai-assistant/Panel";
import type { CanonicalFocusTarget } from "../../lib/evidenceLinks";
import {
  buildSrmSupplierRows,
  supplierCertificationReportRows,
  srmKpis,
  srmReportRows,
  type SupplierSrmRow,
} from "../../domain/srm/helpers";
import { exportRowsToCsv } from "../../lib/data-export";
import { fetchSrmSupplierProfiles, type SrmSupplierProfile } from "./api";
import {
  defaultSrmSupplierWorkbenchFilters,
  filterSrmSuppliersForWorkbench,
  type SrmSupplierWorkbenchFilters,
  type SupplierFlagFilter,
} from "./filters";
import SrmOverview from "./SrmOverview";
import SupplierDetailModal from "./SupplierDetailModal";
import SupplierTable, { type SupplierTableMode } from "./SupplierTable";
import {
  tableMinMdClass,
  tableScrollClass,
  tdWideIdClass,
  tdWideNameClass,
  tdWideNowrapClass,
  tdWideNumericClass,
  thWideClass,
} from "../../components/ui/workbenchTable";

type SrmTab = "overview" | "master" | "performance" | "certification" | "sourcing" | "contracts";
type IncomingSrmTab = SrmTab | "risk" | "portal" | "scoring";
type NavigateFn = (moduleId: string, focusTarget?: CanonicalFocusTarget | null, options?: { returnTo?: string; entityLabel?: string; source?: string }) => void;

const tabs = [
  { id: "overview", label: "SRM 总览", icon: Sparkles },
  { id: "master", label: "供应商资料目录", icon: Building2 },
  { id: "performance", label: "绩效评分与风险队列", icon: Award },
  { id: "certification", label: "认证资料与准入复核", icon: ShieldCheck },
  { id: "sourcing", label: "RFx 参与", icon: ClipboardCheck },
  { id: "contracts", label: "合同与目录", icon: Handshake },
] as const;

const tabSubtitles: Record<SrmTab, string> = {
  overview: "聚焦供应商健康度、异常协同和下一步处理优先级。",
  master: "按供应商主档、联系人、商业条款、默认税码和当前记录状态查看资料。",
  performance: "跟踪供应商评分、准时率、质量、响应、开放 PO、发票差异和对账异常。",
  certification: "复核认证资料、准入状态、缺失文件、到期风险和整改事项。",
  sourcing: "汇总 RFx 邀请、报价参与和寻源结果。",
  contracts: "查看框架合同、目录覆盖、价格条款和消耗进度。",
};

function statusStyle(status: string) {
  if (["低", "已认证", "启用", "战略", "核心", "执行中"].includes(status)) return { color: A.green, bg: "#f0faf4" };
  if (["高", "整改中", "整改", "已到期"].includes(status)) return { color: A.red, bg: "#fff1f0" };
  return { color: A.orange, bg: "#fff8f0" };
}
function exportCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    toast.warning("暂无可导出的数据");
    return;
  }
  exportRowsToCsv(filename, rows);
  toast.success("导出文件已生成");
}

function uniqueOptions(values: Array<string | undefined>) {
  return ["全部", ...Array.from(new Set(values.filter(Boolean) as string[]))];
}

function supplierRowsForTab(rows: SupplierSrmRow[], tab: SrmTab) {
  if (tab === "performance") return rows;
  if (tab === "certification") return rows.filter((row) => row.supplier.certificationStatus !== "已认证" || row.supplier.status !== "启用");
  return rows;
}

function normalizeSrmTab(tab?: IncomingSrmTab): SrmTab {
  if (tab === "risk" || tab === "scoring") return "performance";
  if (tab === "portal") return "overview";
  return tab || "overview";
}

export default function SrmPage({
  initialView = "overview",
  focus,
  onNavigate,
  onActiveContextChange,
}: {
  initialView?: IncomingSrmTab;
  focus?: { entityType: string; entityId: string; at: number } | null;
  onNavigate?: NavigateFn;
  onActiveContextChange?: (context: ActiveContext | null) => void;
}) {
  const [tab, setTab] = useState<SrmTab>(normalizeSrmTab(initialView));
  const [filters, setFilters] = useState<SrmSupplierWorkbenchFilters>(defaultSrmSupplierWorkbenchFilters);
  const [selected, setSelected] = useState<SupplierSrmRow | null>(null);
  const [supplierProfiles, setSupplierProfiles] = useState<SrmSupplierProfile[]>(SUPPLIER_MASTER);

  useEffect(() => {
    if (initialView) setTab(normalizeSrmTab(initialView));
  }, [initialView]);

  useEffect(() => {
    let alive = true;
    fetchSrmSupplierProfiles(SUPPLIER_MASTER)
      .then((profiles) => { if (alive) setSupplierProfiles(profiles); });
    return () => { alive = false; };
  }, []);

  const allRows = useMemo(() => buildSrmSupplierRows(supplierProfiles), [supplierProfiles]);
  const rows = useMemo(() => filterSrmSuppliersForWorkbench(allRows, filters), [allRows, filters]);
  const tabRows = useMemo(() => supplierRowsForTab(rows, tab), [rows, tab]);
  const kpis = srmKpis(allRows);
  const categoryOptions = useMemo(() => uniqueOptions(allRows.map((row) => row.category)), [allRows]);
  const riskOptions = useMemo(() => uniqueOptions(allRows.map((row) => row.supplier.riskStatus)), [allRows]);
  const certificationOptions = useMemo(() => uniqueOptions(allRows.map((row) => row.supplier.certificationStatus)), [allRows]);
  const statusOptions = useMemo(() => uniqueOptions(allRows.map((row) => row.supplier.status)), [allRows]);

  useEffect(() => {
    if (focus?.entityType !== "supplier" || !focus.entityId) return;
    const normalized = focus.entityId.toLowerCase();
    const row = allRows.find((item) =>
      item.supplier.code.toLowerCase() === normalized ||
      item.supplier.name.toLowerCase() === normalized ||
      item.supplier.matchNames?.some((name) => name.toLowerCase() === normalized)
    );
    if (!row) return;
    setTab("master");
    setSelected(row);
  }, [focus?.at, focus?.entityType, focus?.entityId, allRows]);

  function updateFilter<K extends keyof SrmSupplierWorkbenchFilters>(key: K, value: SrmSupplierWorkbenchFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  useEffect(() => {
    if (!selected) {
      onActiveContextChange?.(null);
      return;
    }
    onActiveContextChange?.({
      module: "srm",
      entityType: "supplier",
      entityId: selected.supplier.code,
      entityLabel: selected.supplier.name,
    });
    return () => onActiveContextChange?.(null);
  }, [selected?.supplier.code, selected?.supplier.name, onActiveContextChange]);

  function exportCurrent() {
    if (tab === "certification") return exportCsv("supplier-certification-report.csv", supplierCertificationReportRows(tabRows));
    if (tab === "contracts") return exportCsv("srm-contract-catalog-export.csv", CONTRACTS.map((contract) => ({ 合同编号: contract.id, 供应商: contract.supplier, 范围: contract.scope, 承诺量: contract.commitVol, 价格条款: contract.price, 起始日期: contract.start, 到期日期: contract.end, 消耗率: contract.consumed, 状态: contract.status })));
    if (tab === "sourcing") return exportCsv("srm-rfx-participation-export.csv", RFQS.map((rfq) => ({ RFx编号: rfq.id, 标题: rfq.title, 品类: rfq.category, 邀请供应商: rfq.suppliers, 已报价: rfq.quoted, 最优供应商: rfq.bestSupplier, 最优报价: rfq.bestPrice, 截止日期: rfq.due, 状态: rfq.status })));
    return exportCsv("supplier-srm-performance-report.csv", srmReportRows(tabRows));
  }

  return (
    <div className="space-y-4">
      <SupplierDetailModal row={selected} onClose={() => setSelected(null)} onOpenTab={(next) => setTab(next)} onNavigate={onNavigate} />

      <div className="flex justify-end">
          <ContextualImportActions entityLabel="供应商资料" templateName="供应商资料" compact={false} />
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-4 gap-3">
          <KpiCard label="供应商总数" value={String(kpis.totalSuppliers)} sub="SRM 覆盖" icon={Building2} color={A.blue} />
          <KpiCard label="高风险供应商" value={String(kpis.highRiskSuppliers)} sub="风险或整改" icon={AlertTriangle} color={A.red} />
          <KpiCard label="待认证 / 待复核" value={String(kpis.certificationReview)} sub="准入状态" icon={ShieldCheck} color={A.orange} />
          <KpiCard label="开放 RFx" value={String(kpis.openRfqs)} sub="寻源参与" icon={ClipboardCheck} color={A.purple} />
        </div>
      )}

      {(tab === "overview" || tab === "performance") && (
        <Card className="p-5">
          <SectionHeader title="风险判断来源" right={<Chip label="先复核后确认" color={A.blue} bg="#eef6ff" />} />
          <div className="grid grid-cols-4 gap-3 text-[11px] leading-5" style={{ color: A.sub }}>
            {[
              ["风险信号", "信号来自 PO 延误、质检冻结、发票差异、RFQ 响应和未关闭异常工单。"],
              ["生成内部跟进草稿", "风险跟进只打开内部草稿，负责人复核后才进入流程。"],
              ["供应商跟进备注草稿", "供应商沟通保持为草稿，不自动发送外部邮件。"],
              ["资料安全边界", "风险评分不修改供应商资料，也不会自动触发采购冻结。"],
            ].map(([title, body]) => (
              <div key={title} className="rounded-lg p-3" style={{ background: A.gray6, border: "0.5px solid rgba(0,0,0,0.06)" }}>
                <div className="font-semibold" style={{ color: A.label }}>{title}</div>
                <div className="mt-1">{body}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab !== "overview" && (
        <>
          <div className="flex items-center justify-between gap-3">
            <SubTabs tabs={tabs as any} value={tab} onChange={(value) => setTab(value as SrmTab)} />
            <div className="flex items-center gap-2">
              <button onClick={exportCurrent}
                className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5"
                style={{ background: "#f0f6ff", color: A.blue }}>
                <FileSpreadsheet size={13} /> 导出当前结果
              </button>
            </div>
          </div>

          <div className="text-xs leading-5 px-1" style={{ color: A.sub }}>{tabSubtitles[tab]}</div>
          {["master", "performance", "certification"].includes(tab) && (
            <Card className="p-4">
              <SectionHeader title={tabs.find((item) => item.id === tab)?.label || "供应商资料"} />
              <p className="text-xs leading-5" style={{ color: A.sub }}>{tabSubtitles[tab]}</p>
            </Card>
          )}

          {["master", "performance", "certification"].includes(tab) && (
            <Card className="p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-sm font-semibold" style={{ color: A.label }}>供应商查询</h2>
                  <p className="text-[11px] mt-0.5" style={{ color: A.sub }}>共 {allRows.length} 家，当前筛选 {tabRows.length} 家</p>
                </div>
                <button onClick={() => setFilters(defaultSrmSupplierWorkbenchFilters)}
                  className="h-8 px-3 rounded-lg text-xs font-medium"
                  style={{ background: A.gray6, color: A.label }}>
                  重置
                </button>
              </div>
              <div className="grid grid-cols-6 gap-2">
                <label className="h-8 px-2 rounded-lg flex items-center gap-1.5 col-span-2" style={{ background: A.white, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)" }}>
                  <Search size={12} style={{ color: A.gray2 }} />
                  <input value={filters.supplier} onChange={(event) => updateFilter("supplier", event.target.value)}
                    placeholder="供应商编码 / 名称"
                    className="w-full bg-transparent outline-none text-xs"
                    style={{ color: A.label }} />
                </label>
                {[
                  ["category", "品类", categoryOptions],
                  ["riskStatus", tab === "master" ? "资料风险" : "风险", riskOptions],
                  ["certificationStatus", "认证", certificationOptions],
                  ["status", "状态", statusOptions],
                ].map(([key, label, options]) => (
                  <select key={key as string} value={filters[key as keyof SrmSupplierWorkbenchFilters] as string}
                    onChange={(event) => updateFilter(key as keyof SrmSupplierWorkbenchFilters, event.target.value as never)}
                    className="h-8 rounded-lg px-2 text-xs outline-none"
                    style={{ background: A.white, color: A.label, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)" }}
                    aria-label={label as string}>
                    {(options as string[]).map((option) => <option key={option} value={option}>{label}: {option}</option>)}
                  </select>
                ))}
                {tab === "performance" && (
                  <>
                    <input value={filters.scoreFrom} onChange={(event) => updateFilter("scoreFrom", event.target.value)}
                      placeholder="评分从"
                      className="h-8 rounded-lg px-2 text-xs outline-none"
                      style={{ background: A.white, color: A.label, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)" }} />
                    <input value={filters.scoreTo} onChange={(event) => updateFilter("scoreTo", event.target.value)}
                      placeholder="评分到"
                      className="h-8 rounded-lg px-2 text-xs outline-none"
                      style={{ background: A.white, color: A.label, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)" }} />
                    {[
                      ["hasOpenPo", "开放 PO"],
                      ["hasInvoiceVariance", "发票差异"],
                      ["hasReconciliationException", "对账异常"],
                    ].map(([key, label]) => (
                      <select key={key} value={filters[key as keyof SrmSupplierWorkbenchFilters] as string}
                        onChange={(event) => updateFilter(key as keyof SrmSupplierWorkbenchFilters, event.target.value as SupplierFlagFilter as never)}
                        className="h-8 rounded-lg px-2 text-xs outline-none"
                        style={{ background: A.white, color: A.label, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)" }}
                        aria-label={label}>
                        {(["全部", "是", "否"] as const).map((option) => <option key={option} value={option}>{label}: {option}</option>)}
                      </select>
                    ))}
                  </>
                )}
              </div>
            </Card>
          )}
        </>
      )}

      {tab === "overview" && (
        <SrmOverview rows={rows} onDetail={setSelected} onOpenTab={(next) => setTab(next)} />
      )}

      {["master", "performance", "certification"].includes(tab) && (
        <SupplierTable rows={rows} mode={tab as SupplierTableMode} onDetail={setSelected} />
      )}

      {tab === "sourcing" && (
        <Card>
          <div className={tableScrollClass}>
            <table className={tableMinMdClass}>
              <thead><tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>{["RFx", "标题", "品类", "邀请/报价", "最优供应商", "最优报价", "截止日期", "状态"].map((h) => <th key={h} className={thWideClass} style={{ color: A.gray1 }}>{h}</th>)}</tr></thead>
              <tbody>{RFQS.map((rfq, index) => <tr key={rfq.id} style={{ borderBottom: index < RFQS.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className={tdWideIdClass} style={{ color: A.blue }}>{rfq.id}</td>
                <td className={`${tdWideNameClass} max-w-[260px] truncate`} style={{ color: A.label }}>{rfq.title}</td>
                <td className={tdWideNowrapClass} style={{ color: A.sub }}>{rfq.category}</td>
                <td className={tdWideNumericClass} style={{ color: A.label }}>{rfq.quoted}/{rfq.suppliers}</td>
                <td className={`${tdWideNameClass} max-w-[180px] truncate`} style={{ color: A.label }}>{rfq.bestSupplier}</td>
                <td className={tdWideNumericClass} style={{ color: A.green }}>{rfq.bestPrice}</td>
                <td className={tdWideNowrapClass} style={{ color: A.sub }}>{rfq.due}</td>
                <td className={tdWideNowrapClass}><Chip label={rfq.status} color={rfq.status === "进行中" || rfq.status === "比价中" ? A.orange : A.green} bg={rfq.status === "进行中" || rfq.status === "比价中" ? "#fff8f0" : "#f0faf4"} /></td>
              </tr>)}</tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "contracts" && (
        <Card>
          <div className={tableScrollClass}>
            <table className={tableMinMdClass}>
              <thead><tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>{["合同编号", "供应商", "范围", "承诺量", "价格条款", "起始", "到期", "消耗进度", "状态"].map((h) => <th key={h} className={thWideClass} style={{ color: A.gray1 }}>{h}</th>)}</tr></thead>
              <tbody>{CONTRACTS.map((contract, index) => {
                const style = statusStyle(contract.status);
                return <tr key={contract.id} style={{ borderBottom: index < CONTRACTS.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                  <td className={tdWideIdClass} style={{ color: A.blue }}>{contract.id}</td>
                  <td className={`${tdWideNameClass} max-w-[180px] truncate`} style={{ color: A.label }}>{contract.supplier}</td>
                  <td className={`${tdWideNameClass} max-w-[220px] truncate`} style={{ color: A.sub }}>{contract.scope}</td>
                  <td className={tdWideNumericClass} style={{ color: A.label }}>{contract.commitVol}</td>
                  <td className={tdWideNowrapClass} style={{ color: A.green }}>{contract.price}</td>
                  <td className={tdWideNowrapClass} style={{ color: A.sub }}>{contract.start}</td>
                  <td className={tdWideNowrapClass} style={{ color: A.sub }}>{contract.end}</td>
                  <td className={tdWideNumericClass} style={{ color: A.label }}>{Math.round(contract.consumed * 100)}%</td>
                  <td className={tdWideNowrapClass}><Chip label={contract.status} color={style.color} bg={style.bg} /></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
