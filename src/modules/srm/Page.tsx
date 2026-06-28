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
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import ContextualImportActions from "../../components/import/ContextualImportActions";
import { A, Card, Chip, KpiCard, SectionHeader, SubTabs } from "../../components/ui";
import { CONTRACTS, RFQS } from "../../data/demo-data";
import { SUPPLIER_MASTER } from "../../data/master-data";
import type { ActiveContext } from "../ai-assistant/Panel";
import {
  buildSrmSupplierRows,
  supplierCertificationReportRows,
  supplierRiskReportRows,
  srmKpis,
  srmReportRows,
  type SupplierSrmRow,
} from "../../domain/srm/helpers";
import { exportRowsToCsv } from "../../lib/data-export";
import { fetchSrmSupplierProfiles, type SrmSupplierProfile } from "./api";
import ScoringRulesWorkbench from "./ScoringRulesWorkbench";
import SrmOverview from "./SrmOverview";
import SupplierDetailModal from "./SupplierDetailModal";
import SupplierTable, { type SupplierTableMode } from "./SupplierTable";
import { scoreDimensions } from "./scoring";

type SrmTab = "overview" | "master" | "performance" | "risk" | "certification" | "sourcing" | "contracts" | "portal" | "scoring";

const tabs = [
  { id: "overview", label: "SRM 总览", icon: Sparkles },
  { id: "master", label: "供应商主数据", icon: Building2 },
  { id: "performance", label: "供应商绩效", icon: Award },
  { id: "risk", label: "供应商风险", icon: AlertTriangle },
  { id: "certification", label: "认证与准入", icon: ShieldCheck },
  { id: "scoring", label: "评分体系", icon: SlidersHorizontal },
  { id: "sourcing", label: "RFx 参与", icon: ClipboardCheck },
  { id: "contracts", label: "合同与目录", icon: Handshake },
  { id: "portal", label: "供应商门户", icon: FileSpreadsheet },
] as const;

const tabSubtitles: Record<SrmTab, string> = {
  overview: "聚焦供应商健康度、异常协同和下一步处理优先级。",
  master: "查看供应商主档、商业条款、默认税码和基础状态。",
  performance: "跟踪准时率、质量合格率、响应分和绩效证据。",
  risk: "识别高风险、收货异常、发票差异和对账影响供应商。",
  certification: "复核供应商准入、认证状态、整改和到期风险。",
  scoring: "维护供应商评分维度、指标权重、阈值颜色和刷新频率，让评分不再是黑箱。",
  sourcing: "汇总 RFx 邀请、报价参与和寻源结果。",
  contracts: "查看框架合同、目录覆盖、价格条款和消耗进度。",
  portal: "汇总供应商协同状态；采购侧报价、订单与收货协同仍在采购工作台处理。",
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
  toast.success("CSV 已导出");
}

export default function SrmPage({
  initialView = "overview",
  onActiveContextChange,
}: {
  initialView?: SrmTab;
  onActiveContextChange?: (context: ActiveContext | null) => void;
}) {
  const [tab, setTab] = useState<SrmTab>(initialView);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SupplierSrmRow | null>(null);
  const [supplierProfiles, setSupplierProfiles] = useState<SrmSupplierProfile[]>(SUPPLIER_MASTER);

  useEffect(() => {
    if (initialView) setTab(initialView);
  }, [initialView]);

  useEffect(() => {
    let alive = true;
    fetchSrmSupplierProfiles(SUPPLIER_MASTER)
      .then((profiles) => { if (alive) setSupplierProfiles(profiles); });
    return () => { alive = false; };
  }, []);

  const allRows = useMemo(() => buildSrmSupplierRows(supplierProfiles), [supplierProfiles]);
  const query = search.trim().toLowerCase();
  const rows = useMemo(() => allRows.filter((row) =>
    !query || [row.supplier.name, row.supplier.code, row.category, row.supplier.riskStatus, row.supplier.certificationStatus].some((value) => String(value).toLowerCase().includes(query))
  ), [allRows, query]);
  const kpis = srmKpis(allRows);

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
    if (tab === "risk") return exportCsv("supplier-risk-report.csv", supplierRiskReportRows(allRows));
    if (tab === "certification") return exportCsv("supplier-certification-report.csv", supplierCertificationReportRows(allRows));
    if (tab === "scoring") return exportCsv("srm-score-rules-export.csv", scoreDimensions.flatMap((dimension) =>
      dimension.items.map((item) => ({
        维度: dimension.title,
        维度权重: `${dimension.weight}%`,
        子指标: item.name,
        子指标权重: `${item.weight}%`,
        计算规则: item.rule,
        数据来源: dimension.source,
        刷新频率: dimension.refresh,
        负责人: dimension.owner,
      }))
    ));
    if (tab === "contracts") return exportCsv("srm-contract-catalog-export.csv", CONTRACTS.map((contract) => ({ 合同编号: contract.id, 供应商: contract.supplier, 范围: contract.scope, 承诺量: contract.commitVol, 价格条款: contract.price, 起始日期: contract.start, 到期日期: contract.end, 消耗率: contract.consumed, 状态: contract.status })));
    if (tab === "sourcing") return exportCsv("srm-rfx-participation-export.csv", RFQS.map((rfq) => ({ RFx编号: rfq.id, 标题: rfq.title, 品类: rfq.category, 邀请供应商: rfq.suppliers, 已报价: rfq.quoted, 最优供应商: rfq.bestSupplier, 最优报价: rfq.bestPrice, 截止日期: rfq.due, 状态: rfq.status })));
    return exportCsv("supplier-srm-performance-report.csv", srmReportRows(allRows));
  }

  return (
    <div className="space-y-4">
      <SupplierDetailModal row={selected} onClose={() => setSelected(null)} />

      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight" style={{ color: A.label }}>供应商管理</h1>
            <p className="text-xs leading-5 mt-1 max-w-3xl" style={{ color: A.sub }}>
              点击供应商查看 360° 画像，展开各维度了解评分构成。
            </p>
          </div>
          <ContextualImportActions entityLabel="供应商" templateName="供应商" compact />
        </div>
      </Card>

      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="供应商总数" value={String(kpis.totalSuppliers)} sub="SRM 覆盖" icon={Building2} color={A.blue} />
        <KpiCard label="高风险供应商" value={String(kpis.highRiskSuppliers)} sub="风险或整改" icon={AlertTriangle} color={A.red} />
        <KpiCard label="待认证 / 待复核" value={String(kpis.certificationReview)} sub="准入状态" icon={ShieldCheck} color={A.orange} />
        <KpiCard label="开放 RFx" value={String(kpis.openRfqs)} sub="寻源参与" icon={ClipboardCheck} color={A.purple} />
      </div>

      {tab !== "overview" && (
        <>
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

          <div className="text-xs leading-5 px-1" style={{ color: A.sub }}>{tabSubtitles[tab]}</div>
        </>
      )}

      {tab === "overview" && (
        <SrmOverview rows={rows} onDetail={setSelected} onOpenTab={(next) => setTab(next)} />
      )}

      {["master", "performance", "risk", "certification"].includes(tab) && (
        <SupplierTable rows={rows} mode={tab as SupplierTableMode} onDetail={setSelected} />
      )}

      {tab === "scoring" && (
        <ScoringRulesWorkbench />
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
