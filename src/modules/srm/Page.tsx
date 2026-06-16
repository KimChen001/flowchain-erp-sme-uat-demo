import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Award,
  Building2,
  ClipboardCheck,
  FileSpreadsheet,
  Handshake,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import ContextualImportActions from "../../components/import/ContextualImportActions";
import { A, Card, Chip, KpiCard, Modal, SectionHeader, SubTabs } from "../../components/ui";
import { CONTRACTS, RFQS } from "../../data/demo-data";
import {
  buildSrmSupplierRows,
  supplierCertificationReportRows,
  supplierDetailEvidence,
  supplierRiskReportRows,
  srmKpis,
  srmReportRows,
  type SupplierSrmRow,
} from "../../domain/srm/helpers";
import { exportRowsToCsv } from "../../lib/data-export";
import { fmt } from "../../lib/format";

type SrmTab = "overview" | "master" | "performance" | "risk" | "certification" | "sourcing" | "contracts" | "portal";

const tabs = [
  { id: "overview", label: "SRM 总览", icon: Sparkles },
  { id: "master", label: "供应商主数据", icon: Building2 },
  { id: "performance", label: "供应商绩效", icon: Award },
  { id: "risk", label: "供应商风险", icon: AlertTriangle },
  { id: "certification", label: "认证与准入", icon: ShieldCheck },
  { id: "sourcing", label: "RFx 参与", icon: ClipboardCheck },
  { id: "contracts", label: "合同与目录", icon: Handshake },
  { id: "portal", label: "供应商门户", icon: FileSpreadsheet },
] as const;

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
  toast.success("CSV 已导出");
}

function SupplierDetailModal({ row, onClose }: { row: SupplierSrmRow | null; onClose: () => void }) {
  if (!row) return null;
  const fields = supplierDetailEvidence(row);
  return (
    <Modal open={Boolean(row)} onClose={onClose} title={row.supplier.name} subtitle="供应商管理详情" width={900}>
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-3">
          {[
            ["供应商编码", row.supplier.code],
            ["品类", row.category],
            ["付款条款", row.supplier.paymentTerms],
            ["默认税码", row.supplier.defaultTaxCode],
            ["联系人", row.supplier.contact],
            ["邮箱", row.supplier.email],
            ["风险状态", row.supplier.riskStatus],
            ["认证状态", row.supplier.certificationStatus],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl p-3" style={{ background: A.gray6 }}>
              <div className="text-[10px]" style={{ color: A.gray2 }}>{label}</div>
              <div className="text-xs font-semibold mt-1 truncate" style={{ color: A.label }}>{value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-3">
          {fields.map((item) => (
            <div key={item.label} className="rounded-xl p-3" style={{ background: A.gray6 }}>
              <div className="text-[10px]" style={{ color: A.gray2 }}>{item.label}</div>
              <div className="text-xs font-semibold mt-1 truncate" style={{ color: item.label === "下一步" ? A.blue : A.label }}>{item.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4" style={{ boxShadow: "none", background: A.gray6 }}>
            <SectionHeader title="绩效证据" />
            <div className="text-xs leading-6" style={{ color: A.sub }}>
              准时率 {row.onTimeRate}% · 质量合格率 {row.qualityRate}% · 响应分 {row.responseScore} · SRM 风险分 {row.riskScore}
            </div>
          </Card>
          <Card className="p-4" style={{ boxShadow: "none", background: A.gray6 }}>
            <SectionHeader title="风险证据" />
            <div className="text-xs leading-6" style={{ color: A.sub }}>
              收货异常 {row.grnExceptionCount} · 发票差异 {row.invoiceVarianceCount} · 对账状态 {row.reconciliation?.status || "待生成"} · 建议 {row.nextAction}
            </div>
          </Card>
        </div>
      </div>
    </Modal>
  );
}

function SupplierTable({ rows, onDetail, mode }: { rows: SupplierSrmRow[]; onDetail: (row: SupplierSrmRow) => void; mode: SrmTab }) {
  const visible = mode === "risk"
    ? rows.filter((row) => row.supplier.riskStatus !== "低" || row.invoiceVarianceCount > 0 || row.reconciliationException)
    : mode === "certification"
      ? rows.filter((row) => row.supplier.certificationStatus !== "已认证" || row.supplier.status !== "启用")
      : rows;

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[1180px]">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["供应商", "品类", "评级", "准时率", "质量合格率", "响应分", "风险状态", "认证状态", "开放 PO", "发票差异", "对账异常", "下一步", "操作"].map((header) => (
                <th key={header} className="text-left px-4 py-3 font-medium whitespace-nowrap" style={{ color: A.gray1 }}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, index) => {
              const riskStyle = statusStyle(row.supplier.riskStatus);
              const certStyle = statusStyle(row.supplier.certificationStatus);
              return (
                <tr key={row.supplier.code} style={{ borderBottom: index < visible.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                  <td className="px-4 py-3 font-semibold whitespace-nowrap" style={{ color: A.label }}>
                    {row.supplier.name}
                    <div className="text-[10px] mt-0.5" style={{ color: A.gray2 }}>{row.supplier.code} · {row.flag}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: A.sub }}>{row.category}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: row.rating >= 4.5 ? A.green : row.rating >= 4 ? A.blue : A.orange }}>{row.rating.toFixed(1)}</td>
                  <td className="px-4 py-3" style={{ color: A.label }}>{row.onTimeRate}%</td>
                  <td className="px-4 py-3" style={{ color: A.label }}>{row.qualityRate}%</td>
                  <td className="px-4 py-3" style={{ color: A.label }}>{row.responseScore}</td>
                  <td className="px-4 py-3"><Chip label={row.supplier.riskStatus} color={riskStyle.color} bg={riskStyle.bg} /></td>
                  <td className="px-4 py-3"><Chip label={row.supplier.certificationStatus} color={certStyle.color} bg={certStyle.bg} /></td>
                  <td className="px-4 py-3 font-semibold" style={{ color: row.openPoCount ? A.blue : A.gray2 }}>{row.openPoCount}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: row.invoiceVarianceCount ? A.orange : A.green }}>{row.invoiceVarianceCount}</td>
                  <td className="px-4 py-3" style={{ color: row.reconciliationException ? A.red : A.green }}>{row.reconciliationException ? "需复核" : "稳定"}</td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: A.blue }}>{row.nextAction}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => onDetail(row)} className="px-2.5 py-1 rounded-md font-medium" style={{ background: A.gray6, color: A.blue }}>详情</button>
                      <button onClick={() => toast("更多操作", { description: `${row.supplier.name} · ${row.nextAction}` })} className="px-2.5 py-1 rounded-md font-medium" style={{ background: A.gray6, color: A.gray1 }}>更多</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function SrmPage({ initialView = "overview" }: { initialView?: SrmTab }) {
  const [tab, setTab] = useState<SrmTab>(initialView);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SupplierSrmRow | null>(null);

  useEffect(() => {
    if (initialView) setTab(initialView);
  }, [initialView]);

  const allRows = useMemo(() => buildSrmSupplierRows(), []);
  const query = search.trim().toLowerCase();
  const rows = useMemo(() => allRows.filter((row) =>
    !query || [row.supplier.name, row.supplier.code, row.category, row.supplier.riskStatus, row.supplier.certificationStatus].some((value) => String(value).toLowerCase().includes(query))
  ), [allRows, query]);
  const kpis = srmKpis(allRows);

  function exportCurrent() {
    if (tab === "risk") return exportCsv("supplier-risk-report.csv", supplierRiskReportRows());
    if (tab === "certification") return exportCsv("supplier-certification-report.csv", supplierCertificationReportRows());
    if (tab === "contracts") return exportCsv("srm-contract-catalog-export.csv", CONTRACTS.map((contract) => ({ 合同编号: contract.id, 供应商: contract.supplier, 范围: contract.scope, 承诺量: contract.commitVol, 价格条款: contract.price, 起始日期: contract.start, 到期日期: contract.end, 消耗率: contract.consumed, 状态: contract.status })));
    if (tab === "sourcing") return exportCsv("srm-rfx-participation-export.csv", RFQS.map((rfq) => ({ RFx编号: rfq.id, 标题: rfq.title, 品类: rfq.category, 邀请供应商: rfq.suppliers, 已报价: rfq.quoted, 最优供应商: rfq.bestSupplier, 最优报价: rfq.bestPrice, 截止日期: rfq.due, 状态: rfq.status })));
    return exportCsv("supplier-srm-performance-report.csv", srmReportRows());
  }

  return (
    <div className="space-y-4">
      <SupplierDetailModal row={selected} onClose={() => setSelected(null)} />

      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight" style={{ color: A.label }}>供应商管理</h1>
            <p className="text-xs leading-5 mt-1 max-w-3xl" style={{ color: A.sub }}>
              统一查看供应商主数据、绩效、风险、准入认证、RFx 参与、合同协同和对账影响，支撑采购与库存供应连续性。
            </p>
          </div>
          <ContextualImportActions entityLabel="供应商" templateName="供应商" compact />
        </div>
      </Card>

      <div className="grid grid-cols-5 gap-3">
        <KpiCard label="供应商总数" value={String(kpis.totalSuppliers)} sub="SRM 覆盖" icon={Building2} color={A.blue} />
        <KpiCard label="高风险供应商" value={String(kpis.highRiskSuppliers)} sub="风险或整改" icon={AlertTriangle} color={A.red} />
        <KpiCard label="待认证 / 待复核" value={String(kpis.certificationReview)} sub="准入状态" icon={ShieldCheck} color={A.orange} />
        <KpiCard label="开放 RFx" value={String(kpis.openRfqs)} sub="寻源参与" icon={ClipboardCheck} color={A.purple} />
        <KpiCard label="对账 / 发票异常" value={String(kpis.reconciliationOrInvoiceExceptions)} sub="需协同复核" icon={FileSpreadsheet} color={A.teal} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <SubTabs tabs={tabs as any} value={tab} onChange={(value) => setTab(value as SrmTab)} />
        <div className="flex items-center gap-2">
          <div className="h-8 px-2 rounded-lg flex items-center gap-1.5" style={{ background: A.white, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)" }}>
            <Search size={12} style={{ color: A.gray2 }} />
            <input value={search} onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索供应商"
              className="w-44 bg-transparent outline-none text-xs"
              style={{ color: A.label }} />
          </div>
          <button onClick={exportCurrent}
            className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5"
            style={{ background: "#f0f6ff", color: A.blue }}>
            <FileSpreadsheet size={13} /> 导出 CSV
          </button>
        </div>
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-3 gap-3">
          {rows.slice(0, 3).map((row) => {
            const style = statusStyle(row.flag);
            return (
              <Card key={row.supplier.code} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold" style={{ color: A.label }}>{row.supplier.name}</div>
                    <div className="text-[11px] mt-1" style={{ color: A.sub }}>{row.category} · {row.supplier.paymentTerms}</div>
                  </div>
                  <Chip label={row.flag} color={style.color} bg={style.bg} />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4">
                  {[
                    ["准时率", `${row.onTimeRate}%`],
                    ["质量", `${row.qualityRate}%`],
                    ["风险分", row.riskScore],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg p-2" style={{ background: A.gray6 }}>
                      <div className="text-[10px]" style={{ color: A.gray2 }}>{label}</div>
                      <div className="text-xs font-semibold mt-1" style={{ color: A.label }}>{value}</div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setSelected(row)} className="mt-4 w-full text-[11px] px-2.5 py-1.5 rounded-md font-medium" style={{ background: "#f0f6ff", color: A.blue }}>
                  查看 SRM 证据
                </button>
              </Card>
            );
          })}
        </div>
      )}

      {["overview", "master", "performance", "risk", "certification"].includes(tab) && (
        <SupplierTable rows={rows} mode={tab} onDetail={setSelected} />
      )}

      {tab === "sourcing" && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>{["RFx", "标题", "品类", "邀请/报价", "最优供应商", "最优报价", "截止日期", "状态"].map((h) => <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>)}</tr></thead>
              <tbody>{RFQS.map((rfq, index) => <tr key={rfq.id} style={{ borderBottom: index < RFQS.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-5 py-3 font-semibold" style={{ color: A.blue }}>{rfq.id}</td>
                <td className="px-5 py-3" style={{ color: A.label }}>{rfq.title}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{rfq.category}</td>
                <td className="px-5 py-3" style={{ color: A.label }}>{rfq.quoted}/{rfq.suppliers}</td>
                <td className="px-5 py-3" style={{ color: A.label }}>{rfq.bestSupplier}</td>
                <td className="px-5 py-3" style={{ color: A.green }}>{rfq.bestPrice}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{rfq.due}</td>
                <td className="px-5 py-3"><Chip label={rfq.status} color={rfq.status === "进行中" || rfq.status === "比价中" ? A.orange : A.green} bg={rfq.status === "进行中" || rfq.status === "比价中" ? "#fff8f0" : "#f0faf4"} /></td>
              </tr>)}</tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "contracts" && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>{["合同编号", "供应商", "范围", "承诺量", "价格条款", "起始", "到期", "消耗进度", "状态"].map((h) => <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>)}</tr></thead>
              <tbody>{CONTRACTS.map((contract, index) => {
                const style = statusStyle(contract.status);
                return <tr key={contract.id} style={{ borderBottom: index < CONTRACTS.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                  <td className="px-5 py-3 font-semibold" style={{ color: A.blue }}>{contract.id}</td>
                  <td className="px-5 py-3" style={{ color: A.label }}>{contract.supplier}</td>
                  <td className="px-5 py-3" style={{ color: A.sub }}>{contract.scope}</td>
                  <td className="px-5 py-3" style={{ color: A.label }}>{contract.commitVol}</td>
                  <td className="px-5 py-3" style={{ color: A.green }}>{contract.price}</td>
                  <td className="px-5 py-3" style={{ color: A.sub }}>{contract.start}</td>
                  <td className="px-5 py-3" style={{ color: A.sub }}>{contract.end}</td>
                  <td className="px-5 py-3" style={{ color: A.label }}>{Math.round(contract.consumed * 100)}%</td>
                  <td className="px-5 py-3"><Chip label={contract.status} color={style.color} bg={style.bg} /></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "portal" && (
        <Card className="p-5">
          <SectionHeader title="供应商门户协同概览" />
          <p className="text-xs leading-6" style={{ color: A.sub }}>
            SRM 汇总供应商主数据、绩效、风险、准入和合同协同；采购工作台中的供应商门户继续承载采购侧报价、订单和收货协作视图。
          </p>
          <div className="grid grid-cols-4 gap-3 mt-4">
            {rows.slice(0, 4).map((row) => (
              <div key={row.supplier.code} className="rounded-xl p-3" style={{ background: A.gray6 }}>
                <div className="text-xs font-semibold" style={{ color: A.label }}>{row.supplier.name}</div>
                <div className="text-[11px] mt-1 leading-5" style={{ color: A.sub }}>
                  门户分级 {row.flag} · 开放 PO {row.openPoCount} · 下一步 {row.nextAction}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
