import { AlertTriangle, ArrowRight, BarChart2, FileText, GitBranch, Link2, ShieldCheck } from "lucide-react";
import { A, Card, Chip, KpiCard, SectionHeader } from "../ui";
import type { ReportNavigationLink, ReportsAnalyticsV2 as ReportsAnalyticsV2Payload } from "../../modules/reports/reportsAnalytics";

type Props = {
  analytics: ReportsAnalyticsV2Payload | null;
  loading: boolean;
  error?: boolean;
  onNavigate?: (moduleId: string, focusTarget?: { entityType: string; entityId: string } | null, options?: { returnTo?: string; entityLabel?: string; source?: string; returnContext?: unknown }) => void;
};

function tone(value = "") {
  if (/高|high|P0|需优先/i.test(value)) return { color: A.red, bg: "#fff1f0" };
  if (/中|warning|风险|提醒/i.test(value)) return { color: A.orange, bg: "#fff8f0" };
  if (/低|可用|当前/i.test(value)) return { color: A.green, bg: "#f0faf4" };
  return { color: A.blue, bg: "#f0f6ff" };
}

function fmtMoney(value: unknown) {
  const amount = Number(value || 0);
  return `¥${amount.toLocaleString()}`;
}

function text(value: unknown, fallback = "—") {
  const next = String(value ?? "").trim();
  return next || fallback;
}

function focusFrom(link: ReportNavigationLink) {
  if (!link.entityType || !link.entityId) return null;
  if (link.entityType === "operations_control_tower" || link.entityType === "data_quality_issue") return null;
  return { entityType: link.entityType, entityId: link.entityId };
}

function NavButton({ link, onClick }: { link: ReportNavigationLink; onClick: (link: ReportNavigationLink) => void }) {
  return (
    <button data-testid="reports-analytics-nav-link" onClick={() => onClick(link)}
      className="px-2.5 py-1.5 rounded-md text-[11px] font-medium inline-flex items-center gap-1"
      style={{ background: "#f0f6ff", color: A.blue }}>
      <Link2 size={12} /> {link.label}
    </button>
  );
}

export function ReportsAnalyticsV2({ analytics, loading, error = false, onNavigate }: Props) {
  const navigate = (link: ReportNavigationLink) => {
    onNavigate?.(link.moduleId, focusFrom(link), {
      returnTo: "reports",
      entityLabel: link.entityLabel,
      source: "reportsAnalytics",
      returnContext: {
        sourceModule: "reports",
        sourceRoute: "reports",
        sourceLabel: "Reports & Analytics",
        originIntent: "reportsAnalytics",
        returnLabel: "返回 Reports & Analytics",
      },
    });
  };

  if (loading) {
    return (
      <Card className="p-5" data-testid="reports-analytics-v2">
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-64 rounded" style={{ background: A.gray5 }} />
          <div className="grid grid-cols-5 gap-3">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-20 rounded-lg" style={{ background: A.gray6 }} />)}</div>
        </div>
      </Card>
    );
  }

  if (error || !analytics) {
    return (
      <Card className="p-5" data-testid="reports-analytics-v2">
        <SectionHeader title="Reports & Analytics" />
        <div className="text-xs" style={{ color: A.red }}>跨模块运营分析暂不可用，请稍后重试。</div>
      </Card>
    );
  }

  const summary = analytics.summary;
  const healthTone = tone(summary.overallHealthLabel);

  return (
    <div className="space-y-4" data-testid="reports-analytics-v2">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h1 className="text-xl font-semibold tracking-tight" style={{ color: A.label }}>Reports & Analytics</h1>
              <Chip label="跨模块运营分析" color={A.blue} bg="#f0f6ff" />
              <Chip label={analytics.dataScopeLabel} color={A.green} bg="#f0faf4" />
            </div>
            <p className="text-xs leading-5 max-w-4xl" style={{ color: A.gray1 }}>
              汇总 PR → RFQ → PO → GRN → Invoice → Match 的运营瓶颈、供应商风险、库存风险、财务协同和数据质量影响。报表只展示证据和复核建议，不形成正式财务报表，不形成审计报告，不外发。
            </p>
          </div>
          <Chip label={summary.overallHealthLabel} color={healthTone.color} bg={healthTone.bg} />
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="PR" value={String(summary.totalPrCount)} sub={`RFQ ${summary.totalRfqCount}`} icon={FileText} color={A.blue} />
        <KpiCard label="PO" value={String(summary.totalPoCount)} sub={`GRN ${summary.totalGrnCount}`} icon={GitBranch} color={A.green} />
        <KpiCard label="Invoice" value={String(summary.totalInvoiceCount)} sub={`三单匹配差异 ${summary.matchVarianceCount}`} icon={BarChart2} color={A.orange} />
        <KpiCard label="风险供应商" value={String(summary.supplierRiskCount)} sub={`库存风险 ${summary.inventoryRiskCount}`} icon={AlertTriangle} color={A.red} />
        <KpiCard label="风险与异常" value={String(summary.controlTowerOpenItemCount)} sub={`数据质量问题 ${summary.dataQualityIssueCount}`} icon={ShieldCheck} color={A.purple} />
      </div>

      <Card data-testid="reports-p2p-pipeline">
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${A.border}` }}>
          <SectionHeader title="P2P Pipeline Analytics" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-xs">
            <thead><tr style={{ borderBottom: `1px solid ${A.border}` }}>{["阶段", "数量", "风险", "金额", "平均年龄 / 周期", "Top issue", "跳转"].map((header) => <th key={header} className="px-4 py-3 text-left font-semibold whitespace-nowrap" style={{ color: A.gray1 }}>{header}</th>)}</tr></thead>
            <tbody>{analytics.p2pPipeline.map((stage, index) => (
              <tr key={stage.stage} style={{ borderBottom: index < analytics.p2pPipeline.length - 1 ? `1px solid ${A.border}` : "none" }}>
                <td className="px-4 py-3 font-semibold" style={{ color: A.label }}>{stage.label}</td>
                <td className="px-4 py-3 tabular-nums" style={{ color: A.label }}>{stage.count}</td>
                <td className="px-4 py-3 tabular-nums" style={{ color: stage.riskCount ? A.orange : A.green }}>{stage.riskCount}</td>
                <td className="px-4 py-3 tabular-nums" style={{ color: A.sub }}>{fmtMoney(stage.amount)}</td>
                <td className="px-4 py-3" style={{ color: A.sub }}>{stage.averageAgeLabel}</td>
                <td className="px-4 py-3 min-w-[220px]" style={{ color: A.gray1 }}>{stage.topIssue}</td>
                <td className="px-4 py-3">{stage.navigationLinks.slice(0, 1).map((link) => <NavButton key={link.label} link={link} onClick={navigate} />)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>

      <Card data-testid="reports-supplier-risk">
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${A.border}` }}>
          <SectionHeader title="Supplier Risk Analytics" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-xs">
            <thead><tr style={{ borderBottom: `1px solid ${A.border}` }}>{["供应商", "品类", "PO 数", "Open PO", "RFQ 数", "收货异常", "发票差异", "已收未票金额", "风险等级", "建议复核", "跳转供应商运营档案"].map((header) => <th key={header} className="px-4 py-3 text-left font-semibold whitespace-nowrap" style={{ color: A.gray1 }}>{header}</th>)}</tr></thead>
            <tbody>{analytics.supplierAnalytics.slice(0, 6).map((row, index) => {
              const rowTone = tone(text(row.riskLevel));
              return (
                <tr key={text(row.supplierName)} style={{ borderBottom: index < Math.min(analytics.supplierAnalytics.length, 6) - 1 ? `1px solid ${A.border}` : "none" }}>
                  <td className="px-4 py-3 font-semibold" style={{ color: A.label }}>{text(row.supplierName)}</td>
                  <td className="px-4 py-3" style={{ color: A.sub }}>{text(row.category)}</td>
                  <td className="px-4 py-3">{text(row.poCount, "0")}</td>
                  <td className="px-4 py-3">{text(row.openPoCount, "0")}</td>
                  <td className="px-4 py-3">{text(row.rfqCount, "0")}</td>
                  <td className="px-4 py-3">{text(row.grnExceptionCount, "0")}</td>
                  <td className="px-4 py-3">{text(row.invoiceVarianceCount, "0")}</td>
                  <td className="px-4 py-3">{text(row.receivedNotInvoicedAmount, "0")}</td>
                  <td className="px-4 py-3"><Chip label={text(row.riskLevel)} color={rowTone.color} bg={rowTone.bg} /></td>
                  <td className="px-4 py-3 min-w-[220px]" style={{ color: A.blue }}>{text(row.suggestedReview)}</td>
                  <td className="px-4 py-3">{(row.navigationLinks as ReportNavigationLink[]).slice(0, 1).map((link) => <NavButton key={link.label} link={link} onClick={navigate} />)}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </Card>

      <Card data-testid="reports-inventory-risk">
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${A.border}` }}>
          <SectionHeader title="Inventory Risk Analytics" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-xs">
            <thead><tr style={{ borderBottom: `1px solid ${A.border}` }}>{["SKU", "物料", "仓库", "可用库存", "安全库存", "缺口数量", "关联 PR", "关联 PO", "关联 RFQ", "风险等级", "建议复核", "跳转"].map((header) => <th key={header} className="px-4 py-3 text-left font-semibold whitespace-nowrap" style={{ color: A.gray1 }}>{header}</th>)}</tr></thead>
            <tbody>{analytics.inventoryAnalytics.slice(0, 6).map((row, index) => {
              const rowTone = tone(text(row.riskLevel));
              return (
                <tr key={text(row.sku)} style={{ borderBottom: index < Math.min(analytics.inventoryAnalytics.length, 6) - 1 ? `1px solid ${A.border}` : "none" }}>
                  <td className="px-4 py-3 font-semibold" style={{ color: A.blue }}>{text(row.sku)}</td>
                  <td className="px-4 py-3" style={{ color: A.label }}>{text(row.itemName)}</td>
                  <td className="px-4 py-3" style={{ color: A.sub }}>{text(row.warehouse)}</td>
                  <td className="px-4 py-3">{text(row.availableQty, "0")}</td>
                  <td className="px-4 py-3">{text(row.safetyStock, "0")}</td>
                  <td className="px-4 py-3" style={{ color: Number(row.shortageQty || 0) > 0 ? A.red : A.green }}>{text(row.shortageQty, "0")}</td>
                  <td className="px-4 py-3">{text(row.relatedPr)}</td>
                  <td className="px-4 py-3">{text(row.relatedPo)}</td>
                  <td className="px-4 py-3">{text(row.relatedRfq)}</td>
                  <td className="px-4 py-3"><Chip label={text(row.riskLevel)} color={rowTone.color} bg={rowTone.bg} /></td>
                  <td className="px-4 py-3 min-w-[200px]" style={{ color: A.blue }}>{text(row.suggestedReview)}</td>
                  <td className="px-4 py-3">{(row.navigationLinks as ReportNavigationLink[]).slice(0, 2).map((link) => <NavButton key={link.label} link={link} onClick={navigate} />)}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </Card>

      <Card data-testid="reports-finance-collaboration">
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${A.border}` }}>
          <SectionHeader title="Finance Collaboration Analytics" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-xs">
            <thead><tr style={{ borderBottom: `1px solid ${A.border}` }}>{["Invoice", "Supplier", "PO", "GRN", "差异类型", "差异金额", "已收未票金额", "匹配状态", "建议复核", "跳转"].map((header) => <th key={header} className="px-4 py-3 text-left font-semibold whitespace-nowrap" style={{ color: A.gray1 }}>{header}</th>)}</tr></thead>
            <tbody>{analytics.financeAnalytics.map((row, index) => (
              <tr key={`${text(row.invoiceId)}-${index}`} style={{ borderBottom: index < analytics.financeAnalytics.length - 1 ? `1px solid ${A.border}` : "none" }}>
                <td className="px-4 py-3 font-semibold" style={{ color: A.label }}>{text(row.invoiceId)}</td>
                <td className="px-4 py-3">{text(row.supplier)}</td>
                <td className="px-4 py-3">{text(row.relatedPo)}</td>
                <td className="px-4 py-3">{text(row.relatedGrn)}</td>
                <td className="px-4 py-3" style={{ color: A.orange }}>{text(row.varianceType)}</td>
                <td className="px-4 py-3">{fmtMoney(row.varianceAmount)}</td>
                <td className="px-4 py-3">{text(row.receivedNotInvoicedAmount, "0")}</td>
                <td className="px-4 py-3"><Chip label={text(row.matchStatus)} color={A.orange} bg="#fff8f0" /></td>
                <td className="px-4 py-3 min-w-[220px]" style={{ color: A.blue }}>{text(row.suggestedReview)}</td>
                <td className="px-4 py-3">{(row.navigationLinks as ReportNavigationLink[]).slice(0, 2).map((link) => <NavButton key={link.label} link={link} onClick={navigate} />)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="p-5" data-testid="reports-control-tower">
          <SectionHeader title="风险与异常分析" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {analytics.controlTowerAnalytics.map((row) => (
              <div key={row.category} className="rounded-lg p-3" style={{ background: A.gray6, border: `1px solid ${A.border}` }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-xs" style={{ color: A.label }}>{row.categoryLabel}</div>
                  <Chip label={text(row.count, "0")} color={Number(row.highRiskCount || 0) ? A.orange : A.green} bg={Number(row.highRiskCount || 0) ? "#fff8f0" : "#f0faf4"} />
                </div>
                <div className="text-[11px] leading-5 mt-1" style={{ color: A.sub }}>high risk count {text(row.highRiskCount, "0")} · draft available {text(row.draftAvailableCount, "0")}</div>
                <div className="text-[11px] leading-5" style={{ color: A.blue }}>top priority item：{text(row.topPriorityItem)}</div>
                <div className="text-[11px] leading-5" style={{ color: A.gray1 }}>{text(row.businessImpact)}</div>
                {(row.navigationLinks as ReportNavigationLink[]).slice(0, 1).map((link) => <NavButton key={link.label} link={link} onClick={navigate} />)}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5" data-testid="reports-data-quality-impact">
          <SectionHeader title="Data Quality Impact" />
          <div className="text-[11px] leading-5 mb-3" style={{ color: A.sub }}>
            影响范围：AI Response Contract v2 · 风险与异常 · Three-way Match · Data Access & Quality
          </div>
          <div className="space-y-3">
            {analytics.dataQualityImpact.map((row) => (
              <div key={`${row.issueCategory}-${row.affectedModule}`} className="rounded-lg p-3" style={{ background: A.gray6, border: `1px solid ${A.border}` }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-xs" style={{ color: A.label }}>{text(row.issueCategory)}</div>
                  <Chip label={`${text(row.issueCount, "0")} 项`} color={A.orange} bg="#fff8f0" />
                </div>
                <div className="text-[11px] leading-5 mt-1" style={{ color: A.blue }}>{text(row.affectedModule)} · {text(row.affectedMetric)}</div>
                <div className="text-[11px] leading-5" style={{ color: A.gray1 }}>{text(row.impactSummary)}</div>
                {(row.navigationLinks as ReportNavigationLink[]).slice(0, 1).map((link) => <NavButton key={link.label} link={link} onClick={navigate} />)}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5" data-testid="reports-insight-cards">
        <SectionHeader title="Report Insight Cards" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {analytics.reportInsights.map((card) => {
            const cardTone = tone(card.severity);
            return (
              <div key={card.title} className="rounded-lg p-4 space-y-3" style={{ background: A.gray6, border: `1px solid ${A.border}` }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-sm" style={{ color: A.label }}>{card.title}</div>
                  <Chip label={card.severity === "high" ? "高" : "提醒"} color={cardTone.color} bg={cardTone.bg} />
                </div>
                <div className="text-[11px] leading-5" style={{ color: A.label }}>结论：{card.conclusion}</div>
                <div className="text-[11px] leading-5" style={{ color: A.gray1 }}>关键证据：{card.keyEvidence.join("；")}</div>
                <div className="text-[11px] leading-5" style={{ color: A.gray1 }}>业务影响：{card.businessImpact}</div>
                <div className="text-[11px] leading-5" style={{ color: A.blue }}>建议动作：{card.suggestedAction}</div>
                <div className="flex flex-wrap gap-1.5">
                  <Chip label="内部复核" color={A.orange} bg="#fff8f0" />
                  <Chip label="草稿预览" color={A.blue} bg="#f0f6ff" />
                  <Chip label="数据限制" color={A.gray1} bg={A.white} />
                </div>
                <div className="flex flex-wrap gap-1.5">{card.navigationLinks.slice(0, 2).map((link) => <NavButton key={link.label} link={link} onClick={navigate} />)}</div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-5" data-testid="reports-data-limitations">
        <SectionHeader title="数据限制" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {analytics.dataLimitations.map((item) => (
            <div key={item.label} className="rounded-lg p-3" style={{ background: "#fff8f0", border: `1px solid ${A.border}` }}>
              <div className="font-semibold text-xs" style={{ color: A.label }}>{item.label}</div>
              <div className="text-[11px] leading-5 mt-1" style={{ color: A.gray1 }}>{item.description}</div>
              <div className="fc-caption mt-2" style={{ color: A.orange }}>{item.affectedMetrics.join("、")}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
