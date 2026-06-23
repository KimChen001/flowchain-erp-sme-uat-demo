import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  AlertTriangle,
  Award,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  Handshake,
  MoreHorizontal,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
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

const scoreDimensions = [
  {
    id: "compliance",
    title: "合规认证",
    weight: 20,
    owner: "SRM / 合规负责人",
    refresh: "证书类每日检查到期日并触发衰减",
    source: "供应商证照、工商状态、环保资质、海关 AEO",
    items: [
      { name: "ISO 9001", weight: 30, rule: "> 6 月 100；3-6 月 70；< 3 月 40；已过期 0" },
      { name: "营业执照", weight: 20, rule: "工商注册状态有效 100；注销或吊销 0" },
      { name: "环保资质", weight: 25, rule: "等级 A/B/C 映射 90/70/50，并叠加到期衰减" },
      { name: "海关 AEO", weight: 25, rule: "高级 100；一般 60；申请中 30；无 0" },
    ],
  },
  {
    id: "delivery",
    title: "交货准时",
    weight: 20,
    owner: "采购运营",
    refresh: "每次 GRN 入库后实时重算",
    source: "PO 承诺日期、GRN 实际到货日期、紧急订单标记",
    items: [
      { name: "准时交货率", weight: 40, rule: "近 90 天准时行数 / 总行数 * 100" },
      { name: "平均延迟天数", weight: 25, rule: "0 天 100；1 天 90；3 天 60；7 天以上 20，区间线性插值" },
      { name: "紧急响应能力", weight: 20, rule: "紧急订单准时率单独统计" },
      { name: "短交期能力", weight: 15, rule: "交货周期低于行业均值时加分，高于均值时衰减" },
    ],
  },
  {
    id: "performance",
    title: "综合绩效",
    weight: 20,
    owner: "采购负责人",
    refresh: "PO 关闭、质检完成或客诉关闭后更新",
    source: "PO 状态、质检单、RFx / PO 回复时间、客诉工单",
    items: [
      { name: "订单完成率", weight: 30, rule: "已关闭订单 / 总下单数 * 100" },
      { name: "质量合格率", weight: 35, rule: "质检通过数 / 总质检数，95% 以上映射为 100" },
      { name: "响应速度", weight: 20, rule: "24h 内 100；48h 80；72h 60；超时 30" },
      { name: "客诉处理", weight: 15, rule: "无客诉 100；有客诉按关闭率和关闭时长扣分" },
    ],
  },
  {
    id: "rfx",
    title: "RFx 参与",
    weight: 20,
    owner: "寻源负责人",
    refresh: "每次 RFx 关闭后触发",
    source: "RFx 邀请、报价、授标记录、报价偏差",
    items: [
      { name: "报价响应率", weight: 30, rule: "实际报价数 / 邀请数 * 100" },
      { name: "报价质量", weight: 30, rule: "报价与最终成交价偏差 <5% 为 100；5-15% 为 70；>15% 为 40" },
      { name: "参与频次", weight: 20, rule: "近 12 个月 RFx 参与次数按行业均值标准化" },
      { name: "中标率", weight: 20, rule: "中标次数 / 参与次数 * 100" },
    ],
  },
  {
    id: "risk",
    title: "风险评估",
    weight: 20,
    owner: "供应风险负责人",
    refresh: "外部财务数据每月同步，交付与集中度随业务事件更新",
    source: "外部评级、采购额占比、地区风险表、交付延迟记录",
    items: [
      { name: "财务稳定性", weight: 30, rule: "外部评级转换为 0-100 分" },
      { name: "交货延迟风险", weight: 35, rule: "延迟率越高分越低，与交货准时数据反向映射" },
      { name: "供应集中度", weight: 20, rule: "采购额占比 >50% 为 20；<20% 为 90" },
      { name: "地缘政治风险", weight: 15, rule: "按供应商注册地和人工维护地区风险系数表映射" },
    ],
  },
] as const;

function statusStyle(status: string) {
  if (["低", "已认证", "启用", "战略", "核心", "执行中"].includes(status)) return { color: A.green, bg: "#f0faf4" };
  if (["高", "整改中", "整改", "已到期"].includes(status)) return { color: A.red, bg: "#fff1f0" };
  return { color: A.orange, bg: "#fff8f0" };
}

function scoreStyle(score: number) {
  if (score >= 85) return { label: "正常", color: A.green, bg: "#f0faf4" };
  if (score >= 65) return { label: "注意", color: A.orange, bg: "#fff8f0" };
  return { label: "需处理", color: A.red, bg: "#fff1f0" };
}

function supplierScoreSnapshot(row: SupplierSrmRow) {
  const certificationScore = row.supplier.certificationStatus === "已认证"
    ? 92
    : row.supplier.certificationStatus === "待复核"
      ? 72
      : 48;
  const deliveryScore = Math.round(row.onTimeRate);
  const performanceScore = Math.round(row.qualityRate * 0.42 + row.responseScore * 0.28 + Math.min(row.rating * 20, 100) * 0.3);
  const rfxScore = Math.min(100, Math.round(58 + row.rfqCount * 10 + row.activeRfqCount * 6));
  const riskAssessmentScore = Math.max(30, 100 - row.riskScore + (row.reconciliationException ? -8 : 0));
  const dimensions = [
    { id: "compliance", label: "合规认证", score: certificationScore, evidence: row.supplier.certificationStatus },
    { id: "delivery", label: "交货准时", score: deliveryScore, evidence: `准时率 ${row.onTimeRate}%` },
    { id: "performance", label: "综合绩效", score: performanceScore, evidence: `质量 ${row.qualityRate}% · 响应 ${row.responseScore}` },
    { id: "rfx", label: "RFx 参与", score: rfxScore, evidence: `${row.rfqCount} 次参与 / ${row.activeRfqCount} 个开放` },
    { id: "risk", label: "风险评估", score: riskAssessmentScore, evidence: `${row.supplier.riskStatus}风险 · 对账${row.reconciliationException ? "需复核" : "稳定"}` },
  ];
  return {
    overall: Math.round(dimensions.reduce((sum, item) => sum + item.score, 0) / dimensions.length),
    dimensions,
  };
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
  const score = supplierScoreSnapshot(row);
  const overallStyle = scoreStyle(score.overall);
  return (
    <Modal open={Boolean(row)} onClose={onClose} title={row.supplier.name} subtitle="供应商管理详情" width={980}>
      <div className="space-y-4">
        <div className="grid grid-cols-[220px_1fr] gap-3">
          <Card className="p-4" style={{ boxShadow: "none", background: A.gray6 }}>
            <div className="text-[11px] font-medium" style={{ color: A.sub }}>综合评分</div>
            <div className="flex items-end gap-2 mt-2">
              <div className="text-4xl font-semibold font-mono tracking-tight" style={{ color: overallStyle.color }}>{score.overall}</div>
              <Chip label={overallStyle.label} color={overallStyle.color} bg={overallStyle.bg} />
            </div>
            <div className="text-[11px] leading-5 mt-3" style={{ color: A.sub }}>
              分数由后端评分服务按当前规则版本返回；前端负责展示评分、证据和下一步动作。
            </div>
          </Card>
          <Card className="p-4" style={{ boxShadow: "none", background: A.gray6 }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold" style={{ color: A.label }}>五维评分依据</div>
              <span className="text-[10px]" style={{ color: A.gray2 }}>规则版本 SRM-SCORE-2026.06</span>
            </div>
            <div className="space-y-2">
              {score.dimensions.map((item) => {
                const style = scoreStyle(item.score);
                return (
                  <div key={item.id} className="grid grid-cols-[70px_1fr_34px_72px] items-center gap-2">
                    <div className="text-[11px] font-medium" style={{ color: A.label }}>{item.label}</div>
                    <div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: A.gray5 }}>
                        <div className="h-full rounded-full" style={{ width: `${item.score}%`, background: style.color }} />
                      </div>
                      <div className="text-[10px] mt-1 truncate" style={{ color: A.gray2 }}>{item.evidence}</div>
                    </div>
                    <div className="text-xs font-semibold font-mono text-right" style={{ color: style.color }}>{item.score}</div>
                    <Chip label={style.label} color={style.color} bg={style.bg} />
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

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
        <SrmOverview rows={rows} onDetail={setSelected} onOpenTab={setTab} />
      )}

      {["master", "performance", "risk", "certification"].includes(tab) && (
        <SupplierTable rows={rows} mode={tab} onDetail={setSelected} />
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

function SrmOverview({ rows, onDetail, onOpenTab }: { rows: SupplierSrmRow[]; onDetail: (row: SupplierSrmRow) => void; onOpenTab: (tab: SrmTab) => void }) {
  const [selectedCode, setSelectedCode] = useState(rows[0]?.supplier.code ?? "");
  const [filter, setFilter] = useState<"all" | "critical" | "warning" | "normal">("all");
  const [query, setQuery] = useState("");
  const selected = rows.find((row) => row.supplier.code === selectedCode) ?? rows[0];
  const filteredRows = rows.filter((row) => {
    const score = supplierScoreSnapshot(row).overall;
    const level = score < 65 ? "critical" : score < 85 ? "warning" : "normal";
    const matchesFilter = filter === "all" || filter === level;
    const matchesQuery = !query.trim() || [row.supplier.name, row.supplier.code, row.category, row.flag].some((value) =>
      String(value).toLowerCase().includes(query.trim().toLowerCase())
    );
    return matchesFilter && matchesQuery;
  });

  useEffect(() => {
    if (selected || rows.length === 0) return;
    setSelectedCode(rows[0].supplier.code);
  }, [rows, selected]);

  if (!selected) {
    return (
      <Card className="p-8 text-center text-sm" style={{ color: A.sub }}>
        暂无供应商数据
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-[380px_1fr] gap-4 min-h-[760px]">
      <Card className="overflow-hidden flex flex-col">
        <div className="p-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${A.border}` }}>
          <div className="flex-1 h-9 px-3 rounded-lg flex items-center gap-2" style={{ background: A.gray5 }}>
            <Search size={14} style={{ color: A.gray1 }} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索供应商..."
              className="w-full bg-transparent outline-none text-xs"
              style={{ color: A.label }}
            />
          </div>
          {[
            ["all", "全部"],
            ["critical", "严重"],
            ["warning", "预警"],
            ["normal", "正常"],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value as typeof filter)}
              className="h-9 px-3 rounded-md text-[11px] font-semibold transition-colors"
              style={filter === value ? { background: "#0f172a", color: A.white } : { color: A.sub }}>
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-[84px_84px_84px_84px_1fr] px-4 py-2 text-[11px]" style={{ background: A.gray6, color: A.gray2, borderBottom: `1px solid ${A.border}` }}>
          <span>综合绩效</span>
          <span>合规认证</span>
          <span>风险评估</span>
          <span>RFx 参与</span>
          <span>交货准时</span>
        </div>
        <div className="flex-1 overflow-auto">
          {filteredRows.map((row) => (
            <SupplierScoreListRow
              key={row.supplier.code}
              row={row}
              selected={row.supplier.code === selected.supplier.code}
              onClick={() => setSelectedCode(row.supplier.code)}
            />
          ))}
        </div>
      </Card>

      <SupplierPortraitPanel row={selected} onDetail={onDetail} onOpenScoring={() => onOpenTab("scoring")} />
    </div>
  );
}

function scoreBarColor(score: number) {
  return score >= 85 ? A.green : score >= 65 ? "#f59e0b" : A.red;
}

function ScoreBar({ label, score, compact = false }: { label: string; score: number; compact?: boolean }) {
  return (
    <div className={compact ? "" : "grid grid-cols-[72px_1fr_34px] items-center gap-2"}>
      {!compact && <div className="text-[11px]" style={{ color: A.sub }}>{label}</div>}
      <div>
        {compact && (
          <div className="flex justify-between mb-1">
            <span className="text-[10px]" style={{ color: A.sub }}>{label}</span>
            <span className="text-[10px] font-mono" style={{ color: scoreBarColor(score) }}>{score}</span>
          </div>
        )}
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: A.gray4 }}>
          <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(score, 100))}%`, background: scoreBarColor(score) }} />
        </div>
      </div>
      {!compact && <div className="text-[11px] font-semibold font-mono text-right" style={{ color: scoreBarColor(score) }}>{score}</div>}
    </div>
  );
}

function SupplierScoreListRow({ row, selected, onClick }: { row: SupplierSrmRow; selected: boolean; onClick: () => void }) {
  const snapshot = supplierScoreSnapshot(row);
  const overall = snapshot.overall;
  const dimensions = snapshot.dimensions;
  const dotColor = overall >= 85 ? A.green : overall >= 65 ? "#f59e0b" : A.red;
  const tierStyle = row.flag === "战略"
    ? { color: A.purple, bg: "#f5f3ff" }
    : row.flag === "核心"
      ? { color: A.blue, bg: "#f0f6ff" }
      : row.flag === "整改"
        ? { color: A.red, bg: "#fff1f0" }
        : { color: A.gray1, bg: A.gray6 };

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 transition-colors"
      style={{
        background: selected ? "#f0f6ff" : A.white,
        borderBottom: `1px solid ${A.border}`,
      }}>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dotColor }} />
        <div className="text-sm font-semibold flex-1 truncate" style={{ color: A.label }}>{row.supplier.name}</div>
        <Chip label={row.flag} color={tierStyle.color} bg={tierStyle.bg} />
        <span className="text-xs font-medium" style={{ color: A.gray1 }}>{row.rating.toFixed(1)}</span>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-2">
        {dimensions.map((item) => (
          <ScoreBar key={item.id} label={item.label.replace("认证", "").replace("评估", "").replace("参与", "")} score={item.score} compact />
        ))}
      </div>
    </button>
  );
}

function SupplierPortraitPanel({ row, onDetail, onOpenScoring }: { row: SupplierSrmRow; onDetail: (row: SupplierSrmRow) => void; onOpenScoring: () => void }) {
  const snapshot = supplierScoreSnapshot(row);
  const overallStyle = scoreStyle(snapshot.overall);
  const radarData = snapshot.dimensions.map((item) => ({
    dimension: item.label,
    score: item.score,
  }));
  const spend = row.portal?.spend ?? row.openPoCount * 380000 + row.rfqCount * 240000;
  const issueDimensions = snapshot.dimensions.filter((item) => item.score < 65);
  const defaultOpen = issueDimensions.length ? issueDimensions.map((item) => item.id) : [snapshot.dimensions[0]?.id].filter(Boolean);
  const [openDims, setOpenDims] = useState<string[]>(defaultOpen);

  useEffect(() => {
    setOpenDims(defaultOpen);
  }, [row.supplier.code]);

  function toggle(id: string) {
    setOpenDims((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-4 flex items-start justify-between" style={{ borderBottom: `1px solid ${A.border}` }}>
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: scoreBarColor(snapshot.overall) }} />
            <h2 className="text-lg font-semibold" style={{ color: A.label }}>{row.supplier.name}</h2>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Chip label={`${row.flag}供应商`} color={row.flag === "整改" ? A.red : A.blue} bg={row.flag === "整改" ? "#fff1f0" : "#f0f6ff"} />
            <span className="text-xs" style={{ color: A.sub }}>{row.category} · {row.supplier.contact}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onDetail(row)} className="h-8 px-3 rounded-lg text-xs font-medium"
            style={{ background: "#f0f6ff", color: A.blue }}>
            详情页
          </button>
          <button onClick={onOpenScoring} className="h-8 px-3 rounded-lg text-xs font-medium"
            style={{ background: A.gray6, color: A.gray1 }}>
            评分规则
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3" style={{ borderBottom: `1px solid ${A.border}` }}>
        {[
          { label: "年采购额", value: fmt(spend) },
          { label: "账期", value: row.supplier.paymentTerms },
          { label: "在途订单", value: `${row.openPoCount} 单` },
        ].map((item, index) => (
          <div key={item.label} className="px-5 py-4 text-center" style={{ borderRight: index < 2 ? `1px solid ${A.border}` : "none" }}>
            <div className="text-xs" style={{ color: A.gray1 }}>{item.label}</div>
            <div className="text-sm font-semibold mt-1 font-mono" style={{ color: A.label }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div className="px-5 py-5" style={{ borderBottom: `1px solid ${A.border}` }}>
        <div className="flex items-center justify-between">
          <SectionHeader title="综合画像" />
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: A.sub }}>综合评分</span>
            <span className="text-2xl font-semibold font-mono" style={{ color: overallStyle.color }}>{snapshot.overall}</span>
            <span className="text-xs" style={{ color: A.gray1 }}>{row.rating.toFixed(1)}</span>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} outerRadius={92}>
              <PolarGrid stroke={A.gray4} />
              <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12, fill: A.gray1 }} />
              <Radar dataKey="score" stroke={A.blue} fill={A.blue} fillOpacity={0.16} strokeWidth={2} dot={{ r: 3, fill: A.blue }} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: `1px solid ${A.border}`, fontSize: 12 }}
                formatter={(value) => [`${value} 分`, "评分"]}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="px-5 py-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: A.label }}>维度评分</h3>
            <p className="text-[11px] mt-1" style={{ color: A.gray1 }}>问题维度已自动展开，点击任意维度查看构成</p>
          </div>
          <button className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: A.gray1, background: A.gray6 }}>
            <MoreHorizontal size={15} />
          </button>
        </div>
        <div className="space-y-3">
          {snapshot.dimensions.map((dimension) => (
            <SupplierDimensionCard
              key={dimension.id}
              dimension={dimension}
              open={openDims.includes(dimension.id)}
              onToggle={() => toggle(dimension.id)}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}

function SupplierDimensionCard({
  dimension,
  open,
  onToggle,
}: {
  dimension: ReturnType<typeof supplierScoreSnapshot>["dimensions"][number];
  open: boolean;
  onToggle: () => void;
}) {
  const style = scoreStyle(dimension.score);
  const rule = scoreDimensions.find((item) => item.id === dimension.id);
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${A.border}`, background: A.white }}>
      <button onClick={onToggle} className="w-full grid grid-cols-[96px_1fr_36px_120px_16px] items-center gap-3 px-4 py-3 text-left">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={14} style={{ color: style.color }} />
          <span className="text-xs font-semibold" style={{ color: A.sub }}>{dimension.label}</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: A.gray4 }}>
          <div className="h-full rounded-full" style={{ width: `${dimension.score}%`, background: style.color }} />
        </div>
        <span className="text-xs font-semibold font-mono text-right" style={{ color: style.color }}>{dimension.score}</span>
        <span className="text-xs font-semibold truncate" style={{ color: style.color }}>{dimension.evidence}</span>
        <span className="text-xs" style={{ color: A.gray2 }}>{open ? "⌃" : "⌄"}</span>
      </button>
      {open && rule && (
        <div className="px-4 pb-4 pt-1" style={{ borderTop: `1px solid ${A.border}` }}>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {rule.items.map((item, index) => {
              const itemStyle = index === 0 && dimension.score < 65
                ? { color: A.red, bg: "#fff1f0", label: "需处理" }
                : index === 2 || dimension.score < 85
                  ? { color: A.orange, bg: "#fff8f0", label: "待改善" }
                  : { color: A.green, bg: "#f0faf4", label: "良好" };
              return (
                <div key={item.name} className="grid grid-cols-[96px_72px_1fr] items-center gap-2 text-xs">
                  <span style={{ color: A.sub }}>{item.name}</span>
                  <Chip label={itemStyle.label} color={itemStyle.color} bg={itemStyle.bg} />
                  <span className="truncate" style={{ color: A.gray2 }}>权重 {item.weight}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ScoringRulesWorkbench() {
  const thresholdRows = [
    { label: "正常", range: "≥ 85", color: A.green, bg: "#f0faf4", behavior: "保持监控，展示为绿色状态" },
    { label: "注意", range: "65-84", color: A.orange, bg: "#fff8f0", behavior: "进入关注队列，建议采购负责人复核" },
    { label: "需处理", range: "< 65", color: A.red, bg: "#fff1f0", behavior: "自动展开明细，生成下一步处理建议" },
  ];

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <SectionHeader title="供应商评分体系" />
            <p className="text-xs leading-6 max-w-3xl" style={{ color: A.sub }}>
              评分由后端按规则版本计算后通过 API 返回，前端仅展示结果、指标来源、阈值和证据链。采购负责人可在这里理解并调整权重，避免供应商评级成为黑箱。
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Chip label="规则版本 SRM-SCORE-2026.06" color={A.blue} bg="#f0f6ff" />
            <button
              onClick={() => toast("规则草稿", { description: "权重调整会先进入草稿，发布后由后端评分服务生效。" })}
              className="h-8 px-3 rounded-lg text-xs font-medium text-white"
              style={{ background: A.blue }}>
              新建规则草稿
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 mt-4">
          {[
            { label: "维度数", value: "5", sub: "合规 / 交付 / 绩效 / RFx / 风险", icon: SlidersHorizontal, color: A.blue },
            { label: "总权重", value: `${scoreDimensions.reduce((sum, item) => sum + item.weight, 0)}%`, sub: "当前规则已平衡", icon: CheckCircle2, color: A.green },
            { label: "风险阈值", value: "65", sub: "低于阈值自动展开", icon: AlertTriangle, color: A.red },
            { label: "刷新策略", value: "事件 + 定时", sub: "GRN / RFx / 证书 / 外部数据", icon: RefreshCw, color: A.purple },
          ].map((item) => (
            <KpiCard key={item.label} label={item.label} value={item.value} sub={item.sub} icon={item.icon} color={item.color} />
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-[1fr_320px] gap-4">
        <div className="space-y-3">
          {scoreDimensions.map((dimension, index) => (
            <Card key={dimension.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold"
                      style={{ background: "#f0f6ff", color: A.blue }}>
                      {index + 1}
                    </div>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: A.label }}>{dimension.title}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: A.gray2 }}>{dimension.source}</div>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xl font-semibold font-mono" style={{ color: A.label }}>{dimension.weight}%</div>
                  <div className="text-[10px]" style={{ color: A.gray2 }}>维度权重</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-[1fr_170px] gap-4">
                <div className="space-y-2">
                  {dimension.items.map((item) => (
                    <div key={item.name} className="grid grid-cols-[96px_44px_1fr] gap-3 items-start rounded-lg px-3 py-2"
                      style={{ background: A.gray6 }}>
                      <div className="text-[11px] font-medium" style={{ color: A.label }}>{item.name}</div>
                      <div className="text-[11px] font-semibold font-mono" style={{ color: A.blue }}>{item.weight}%</div>
                      <div className="text-[11px] leading-5" style={{ color: A.sub }}>{item.rule}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl p-3" style={{ background: A.gray6 }}>
                  <div className="text-[11px] font-semibold" style={{ color: A.label }}>刷新频率</div>
                  <div className="text-[11px] leading-5 mt-2" style={{ color: A.sub }}>{dimension.refresh}</div>
                  <div className="text-[11px] font-semibold mt-3" style={{ color: A.label }}>规则负责人</div>
                  <div className="text-[11px] leading-5 mt-1" style={{ color: A.sub }}>{dimension.owner}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="space-y-3">
          <Card className="p-4">
            <SectionHeader title="分数颜色阈值" />
            <div className="space-y-2">
              {thresholdRows.map((row) => (
                <div key={row.label} className="rounded-xl p-3" style={{ background: row.bg }}>
                  <div className="flex items-center justify-between">
                    <Chip label={row.label} color={row.color} bg={A.white} />
                    <span className="text-xs font-semibold font-mono" style={{ color: row.color }}>{row.range}</span>
                  </div>
                  <div className="text-[11px] leading-5 mt-2" style={{ color: A.sub }}>{row.behavior}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <SectionHeader title="发布与生效" />
            <div className="space-y-3 text-[11px] leading-5" style={{ color: A.sub }}>
              <div className="flex gap-2">
                <CheckCircle2 size={13} style={{ color: A.green }} className="mt-0.5 shrink-0" />
                <span>规则先保存为草稿，采购负责人确认后发布。</span>
              </div>
              <div className="flex gap-2">
                <CheckCircle2 size={13} style={{ color: A.green }} className="mt-0.5 shrink-0" />
                <span>发布后由后端评分服务重算供应商评分，前端刷新展示。</span>
              </div>
              <div className="flex gap-2">
                <CheckCircle2 size={13} style={{ color: A.green }} className="mt-0.5 shrink-0" />
                <span>低于 65 分的维度在供应商详情中自动展开证据。</span>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <SectionHeader title="AI 建议接入" />
            <p className="text-[11px] leading-5" style={{ color: A.sub }}>
              AI 只引用当前模块上下文和评分证据，输出“为什么风险升高”和“下一步建议”，不替代评分规则本身。
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
