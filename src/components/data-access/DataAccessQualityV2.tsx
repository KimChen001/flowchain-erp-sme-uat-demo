import { AlertTriangle, ArrowRight, Database, FileCheck2, GitBranch, Link2, ShieldCheck, Wand2 } from "lucide-react";
import { A, Card, Chip, KpiCard, SectionHeader } from "../ui";
import type { DataAccessNavigationLink, DataAccessQualityV2 as DataAccessQualityV2Payload } from "../../modules/imports/dataAccessQuality";

type FocusTarget = { entityType: string; entityId: string };

type Props = {
  quality: DataAccessQualityV2Payload | null;
  loading: boolean;
  error?: boolean;
  onNavigate?: (moduleId: string, focusTarget?: FocusTarget | null, options?: { returnTo?: string; entityLabel?: string; source?: string; returnContext?: unknown }) => void;
};

const severityTone: Record<string, { color: string; bg: string }> = {
  high: { color: A.red, bg: "#fff1f0" },
  warning: { color: A.orange, bg: "#fff8f0" },
  info: { color: A.blue, bg: "#f0f6ff" },
};

function toneFor(value = "") {
  if (/high|高|阻断/i.test(value)) return severityTone.high;
  if (/warning|需复核|提醒|中/i.test(value)) return severityTone.warning;
  if (/已接入|已映射|可用/i.test(value)) return { color: A.green, bg: "#f0faf4" };
  return severityTone.info;
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function joinValues(values: string[] = [], empty = "—") {
  return values.filter(Boolean).join("、") || empty;
}

function categoryLabel(value = "") {
  const labels: Record<string, string> = {
    missing_supplier_response: "缺失 supplier response",
    missing_grn_evidence: "缺失 GRN Line",
    missing_invoice_line: "缺失 Invoice Line",
    missing_supplier_profile_evidence: "缺失 supplier contact / certificate",
    unmapped_field: "未映射字段",
    inventory_procurement_evidence_gap: "库存 / 采购证据缺口",
    data_quality_gap: "关系断链",
  };
  return labels[value] || value || "质量问题";
}

function focusFrom(link: DataAccessNavigationLink): FocusTarget | null {
  if (!link.entityType || !link.entityId) return null;
  if (link.entityType === "operations_control_tower" || link.entityType === "ai_question") return null;
  return { entityType: link.entityType, entityId: link.entityId };
}

export function DataAccessQualityV2({ quality, loading, error = false, onNavigate }: Props) {
  const navigate = (link: DataAccessNavigationLink) => {
    onNavigate?.(link.moduleId, focusFrom(link), {
      returnTo: "imports",
      entityLabel: link.entityLabel,
      source: "dataAccessQuality",
      returnContext: {
        sourceModule: "imports",
        sourceRoute: "imports",
        sourceLabel: "数据接入与质量",
        originIntent: "dataAccessQuality",
        returnLabel: "返回数据接入与质量",
      },
    });
  };

  if (loading) {
    return (
      <Card className="p-5" data-testid="data-access-quality-v2">
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-56 rounded" style={{ background: A.gray5 }} />
          <div className="grid grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-20 rounded-lg" style={{ background: A.gray6 }} />)}
          </div>
        </div>
      </Card>
    );
  }

  if (error || !quality) {
    return (
      <Card className="p-5" data-testid="data-access-quality-v2">
        <SectionHeader title="Data Quality" />
        <div className="text-xs" style={{ color: A.red }}>数据接入与质量控制层暂不可用，请稍后重试。</div>
      </Card>
    );
  }

  const summary = quality.summary;

  return (
    <div className="space-y-4" data-testid="data-access-quality-v2">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h2 className="text-lg font-semibold tracking-tight" style={{ color: A.label }}>Data Quality</h2>
              <Chip label="数据接入与质量控制层" color={A.blue} bg="#f0f6ff" />
              <Chip label={quality.dataScopeLabel} color={A.green} bg="#f0faf4" />
            </div>
            <p className="text-xs leading-5 max-w-4xl" style={{ color: A.gray1 }}>
              统一查看数据源覆盖、字段映射、业务对象完整性、证据缺口和下游影响。所有修复建议仅生成草稿预览，并要求人工复核。
            </p>
          </div>
          <Chip label={summary.overallQualityLabel} color={toneFor(summary.overallQualityLabel).color} bg={toneFor(summary.overallQualityLabel).bg} />
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="数据源数量" value={String(summary.sourceCount)} sub={`已接入数据源 ${summary.connectedSourceCount}`} icon={Database} color={A.blue} />
        <KpiCard label="已映射字段" value={String(summary.mappedFieldCount)} sub={`未映射字段 ${summary.unmappedFieldCount}`} icon={FileCheck2} color={A.green} />
        <KpiCard label="高风险质量问题" value={String(summary.criticalIssueCount)} sub={`提醒 ${summary.warningIssueCount}`} icon={AlertTriangle} color={summary.criticalIssueCount ? A.red : A.orange} />
        <KpiCard label="关系断链" value={String(summary.relationshipGapCount)} sub={`证据缺口 ${summary.evidenceGapCount}`} icon={GitBranch} color={A.orange} />
        <KpiCard label="受影响 AI 判断" value={String(summary.affectedAiInsightCount)} sub={`风险与异常 ${summary.affectedControlTowerItemCount}`} icon={ShieldCheck} color={A.purple} />
      </div>

      <Card data-testid="data-source-coverage">
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${A.border}` }}>
          <SectionHeader title="Source Coverage / 数据源覆盖" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-xs">
            <thead><tr style={{ borderBottom: `1px solid ${A.border}` }}>{["数据源", "业务区域", "状态", "记录数", "最近更新", "覆盖范围", "缺失对象", "下游使用"].map((header) => <th key={header} className="px-4 py-3 text-left font-semibold whitespace-nowrap" style={{ color: A.gray1 }}>{header}</th>)}</tr></thead>
            <tbody>{quality.sources.map((source, index) => {
              const tone = toneFor(source.status);
              return (
                <tr key={source.id} style={{ borderBottom: index < quality.sources.length - 1 ? `1px solid ${A.border}` : "none" }}>
                  <td className="px-4 py-3 font-semibold" style={{ color: A.label }}>{source.label}</td>
                  <td className="px-4 py-3" style={{ color: A.sub }}>{source.businessArea}</td>
                  <td className="px-4 py-3"><Chip label={source.status} color={tone.color} bg={tone.bg} /></td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: A.label }}>{source.recordCount}</td>
                  <td className="px-4 py-3" style={{ color: A.sub }}>{source.lastUpdated}</td>
                  <td className="px-4 py-3" style={{ color: A.gray1 }}>{source.coverageLabel}</td>
                  <td className="px-4 py-3 min-w-[180px]" style={{ color: A.orange }}>{joinValues(source.missingObjects)}</td>
                  <td className="px-4 py-3 min-w-[220px]" style={{ color: A.blue }}>{joinValues(source.downstreamUsage)}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </Card>

      <Card data-testid="field-mapping-coverage">
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${A.border}` }}>
          <SectionHeader title="Field Mapping Coverage / 字段映射覆盖" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-xs">
            <thead><tr style={{ borderBottom: `1px solid ${A.border}` }}>{["来源字段", "标准业务字段", "业务对象", "状态", "置信度", "问题", "下游影响", "建议映射", "是否人工复核"].map((header) => <th key={header} className="px-4 py-3 text-left font-semibold whitespace-nowrap" style={{ color: A.gray1 }}>{header}</th>)}</tr></thead>
            <tbody>{quality.fieldMappings.map((row, index) => {
              const tone = toneFor(row.status);
              return (
                <tr key={`${row.sourceId}-${row.fieldLabel}`} style={{ borderBottom: index < quality.fieldMappings.length - 1 ? `1px solid ${A.border}` : "none" }}>
                  <td className="px-4 py-3 font-semibold" style={{ color: A.label }}>{row.fieldLabel}</td>
                  <td className="px-4 py-3" style={{ color: A.blue }}>{row.suggestedMapping}</td>
                  <td className="px-4 py-3" style={{ color: A.sub }}>{row.businessObject}</td>
                  <td className="px-4 py-3"><Chip label={row.status} color={tone.color} bg={tone.bg} /></td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: A.label }}>{pct(row.confidence)}</td>
                  <td className="px-4 py-3 min-w-[190px]" style={{ color: row.issue ? A.orange : A.sub }}>{row.issue || "无"}</td>
                  <td className="px-4 py-3 min-w-[210px]" style={{ color: A.gray1 }}>{row.downstreamImpact}</td>
                  <td className="px-4 py-3" style={{ color: A.blue }}>{row.suggestedMapping}</td>
                  <td className="px-4 py-3"><Chip label={row.reviewRequired ? "需要人工复核" : "无需复核"} color={row.reviewRequired ? A.orange : A.green} bg={row.reviewRequired ? "#fff8f0" : "#f0faf4"} /></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </Card>

      <Card data-testid="quality-issues">
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${A.border}` }}>
          <SectionHeader title="Quality Issues / 质量问题" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-xs">
            <thead><tr style={{ borderBottom: `1px solid ${A.border}` }}>{["严重性", "问题标题", "分类", "业务对象", "字段", "问题类型", "业务影响", "建议修复", "操作"].map((header) => <th key={header} className="px-4 py-3 text-left font-semibold whitespace-nowrap" style={{ color: A.gray1 }}>{header}</th>)}</tr></thead>
            <tbody>{quality.qualityIssues.map((issue, index) => {
              const tone = toneFor(issue.severity);
              return (
                <tr key={issue.id} style={{ borderBottom: index < quality.qualityIssues.length - 1 ? `1px solid ${A.border}` : "none" }}>
                  <td className="px-4 py-3"><Chip label={issue.severity === "high" ? "高" : "提醒"} color={tone.color} bg={tone.bg} /></td>
                  <td className="px-4 py-3 font-semibold min-w-[180px]" style={{ color: A.label }}>{issue.title}</td>
                  <td className="px-4 py-3" style={{ color: A.sub }}>{categoryLabel(issue.category)}</td>
                  <td className="px-4 py-3" style={{ color: A.blue }}>{issue.businessObjectLabel}</td>
                  <td className="px-4 py-3" style={{ color: A.sub }}>{issue.fieldLabel || "—"}</td>
                  <td className="px-4 py-3" style={{ color: A.orange }}>{issue.issueType}</td>
                  <td className="px-4 py-3 min-w-[240px]" style={{ color: A.gray1 }}>{issue.businessImpact}</td>
                  <td className="px-4 py-3 min-w-[220px]" style={{ color: A.blue }}>{issue.suggestedFix}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {issue.navigationLinks.slice(0, 2).map((link) => (
                        <button key={`${issue.id}-${link.label}`} onClick={() => navigate(link)} data-testid="data-quality-nav-link" className="px-2.5 py-1.5 rounded-md text-[11px] font-medium inline-flex items-center gap-1" style={{ background: "#f0f6ff", color: A.blue }}>
                          <Link2 size={12} /> {link.label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="p-5" data-testid="relationship-gaps">
          <SectionHeader title="Relationship Gaps / 关系断链" />
          <div className="space-y-3">
            {quality.relationshipGaps.map((gap) => {
              const tone = toneFor(gap.severity);
              return (
                <div key={gap.id} className="rounded-lg p-3" style={{ background: A.gray6, border: `1px solid ${A.border}` }}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-xs" style={{ color: A.label }}>{gap.fromObject} → {gap.toObject}</div>
                    <Chip label={gap.severity === "high" ? "高" : "提醒"} color={tone.color} bg={tone.bg} />
                  </div>
                  <div className="text-[11px] leading-5 mt-2" style={{ color: A.gray1 }}>{gap.missingRelationship} · {gap.explanation}</div>
                  <div className="text-[11px] leading-5" style={{ color: A.sub }}>{gap.affectedModule} · {gap.affectedAiQuestion}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {gap.navigationLinks.slice(0, 2).map((link) => (
                      <button key={`${gap.id}-${link.label}`} onClick={() => navigate(link)} data-testid="data-quality-nav-link" className="px-2.5 py-1.5 rounded-md text-[11px] font-medium inline-flex items-center gap-1" style={{ background: A.white, color: A.blue }}>
                        <ArrowRight size={12} /> {link.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5" data-testid="evidence-gaps">
          <SectionHeader title="Evidence Gaps / 证据缺口" />
          <div className="space-y-3">
            {quality.evidenceGaps.map((gap) => (
              <div key={gap.id} className="rounded-lg p-3" style={{ background: A.gray6, border: `1px solid ${A.border}` }}>
                <div className="font-semibold text-xs" style={{ color: A.label }}>{gap.evidenceType} · {gap.affectedObject}</div>
                <div className="text-[11px] leading-5 mt-1" style={{ color: A.orange }}>缺失证据：{gap.missingEvidence}</div>
                <div className="text-[11px] leading-5" style={{ color: A.gray1 }}>影响：{gap.consequence}</div>
                <div className="text-[11px] leading-5" style={{ color: A.blue }}>{gap.suggestedNextStep}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5" data-testid="downstream-impact">
        <SectionHeader title="Downstream Impact / 下游影响" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {quality.downstreamImpacts.map((impact) => (
            <div key={impact.id} className="rounded-lg p-3" style={{ background: A.gray6, border: `1px solid ${A.border}` }}>
              <div className="font-semibold text-xs" style={{ color: A.label }}>{impact.target}</div>
              <div className="text-[11px] leading-5 mt-1" style={{ color: A.blue }}>{impact.affectedQuestion}</div>
              <div className="text-[11px] leading-5 mt-1" style={{ color: A.gray1 }}>{impact.impactSummary}</div>
              <Chip label={impact.dataLimitationLabel} color={A.orange} bg="#fff8f0" />
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5" data-testid="review-first-fixes">
        <SectionHeader title="Review-first Fix Preview" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {quality.recommendedFixes.map((fix) => (
            <div key={fix.title} className="rounded-lg p-3 space-y-2" style={{ background: A.gray6, border: `1px solid ${A.border}` }}>
              <div className="flex items-center gap-2">
                <Wand2 size={14} style={{ color: A.blue }} />
                <div className="font-semibold text-xs" style={{ color: A.label }}>{fix.title}</div>
              </div>
              <div className="text-[11px] leading-5" style={{ color: A.gray1 }}>{fix.description}</div>
              <div className="flex flex-wrap gap-1.5">
                <Chip label="草稿预览" color={A.blue} bg="#f0f6ff" />
                <Chip label="人工复核" color={A.orange} bg="#fff8f0" />
                <Chip label="不自动写入" color={A.green} bg="#f0faf4" />
              </div>
              <div className="text-[11px] leading-5" style={{ color: A.sub }}>{fix.allowedNextStep}</div>
              <div className="fc-caption leading-5" style={{ color: A.gray2 }}>{joinValues(fix.prohibitedActions)}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5" data-testid="data-quality-limitations">
        <SectionHeader title="数据限制" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {quality.dataLimitations.map((item) => (
            <div key={item.label} className="rounded-lg p-3" style={{ background: "#fff8f0", border: `1px solid ${A.border}` }}>
              <div className="font-semibold text-xs" style={{ color: A.label }}>{item.label}</div>
              <div className="text-[11px] leading-5 mt-1" style={{ color: A.gray1 }}>{item.description}</div>
              <div className="fc-caption mt-2" style={{ color: A.orange }}>{joinValues(item.affectedModules)}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
