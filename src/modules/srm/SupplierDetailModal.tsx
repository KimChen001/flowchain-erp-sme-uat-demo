import { A, Card, Chip, SectionHeader } from "../../components/ui";
import {
  BusinessObjectDetailModal,
  CompactKpiStrip,
  DataLimitationsPanel,
  DetailFieldGrid,
  DetailSection,
  EvidenceSummaryPanel,
  ReviewActionPanel,
} from "../../components/business/BusinessObjectDetail";
import { supplierDetailEvidence, type SupplierSrmRow } from "../../domain/srm/helpers";
import { scoreStyle, supplierScoreSnapshot } from "./scoring";

export default function SupplierDetailModal({ row, onClose }: { row: SupplierSrmRow | null; onClose: () => void }) {
  if (!row) return null;
  const fields = supplierDetailEvidence(row);
  const score = supplierScoreSnapshot(row);
  const overallStyle = scoreStyle(score.overall);
  const dataLimitations = [
    row.supplier.certificationStatus !== "已认证" ? "certification_review_required" : "",
    row.invoiceVarianceCount > 0 ? "invoice_variance_review_required" : "",
    row.reconciliationException ? "reconciliation_review_required" : "",
  ].filter(Boolean);
  return (
    <BusinessObjectDetailModal open={Boolean(row)} onClose={onClose} title={row.supplier.name} subtitle={`${row.supplier.code} · ${row.category}`} width={1120}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip label={row.supplier.status} color={row.supplier.status === "启用" ? A.green : A.orange} bg={row.supplier.status === "启用" ? "#f0faf4" : "#fff8f0"} />
          <Chip label={row.supplier.certificationStatus} color={row.supplier.certificationStatus === "已认证" ? A.green : A.orange} bg={row.supplier.certificationStatus === "已认证" ? "#f0faf4" : "#fff8f0"} />
          <Chip label={`${row.supplier.riskStatus}风险`} color={row.supplier.riskStatus === "高" ? A.red : row.supplier.riskStatus === "中" ? A.orange : A.green} bg={row.supplier.riskStatus === "高" ? "#fff1f0" : row.supplier.riskStatus === "中" ? "#fff8f0" : "#f0faf4"} />
        </div>

        <CompactKpiStrip items={[
          { label: "综合评分", value: score.overall, tone: score.overall < 65 ? "danger" : score.overall < 85 ? "warning" : "good" },
          { label: "开放 PO", value: `${row.openPoCount} 单`, tone: row.openPoCount ? "info" : "default" },
          { label: "发票差异", value: row.invoiceVarianceCount, tone: row.invoiceVarianceCount ? "warning" : "good" },
          { label: "对账异常", value: row.reconciliationException ? "需复核" : "稳定", tone: row.reconciliationException ? "danger" : "good" },
        ]} />

        <DetailSection title="基本资料">
          <DetailFieldGrid fields={[
            { label: "供应商编码", value: row.supplier.code },
            { label: "供应商名称", value: row.supplier.name },
            { label: "品类", value: row.category },
            { label: "类型", value: row.flag === "整改" ? "整改关注" : row.flag },
            { label: "联系人", value: row.supplier.contact },
            { label: "邮箱", value: row.supplier.email },
            { label: "电话", value: row.supplier.phone },
            { label: "付款条款", value: row.supplier.paymentTerms },
            { label: "默认税码", value: row.supplier.defaultTaxCode },
            { label: "默认币种", value: row.supplier.currency },
            { label: "税号", value: row.supplier.taxId },
            { label: "当前记录", value: row.supplier.status },
          ]} />
        </DetailSection>

        <div className="grid grid-cols-[220px_1fr] gap-3">
          <Card className="p-4" style={{ boxShadow: "none", background: A.gray6 }}>
            <div className="text-[11px] font-medium" style={{ color: A.sub }}>综合评分</div>
            <div className="flex items-end gap-2 mt-2">
              <div className="text-4xl font-semibold font-mono tracking-tight" style={{ color: overallStyle.color }}>{score.overall}</div>
              <Chip label={overallStyle.label} color={overallStyle.color} bg={overallStyle.bg} />
            </div>
            <div className="text-[11px] leading-5 mt-3" style={{ color: A.sub }}>
              评分按当前规则版本计算，前端展示评分、证据和下一步动作；后续可接入服务端评分能力。
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

        <DetailSection title="认证资料">
          <DetailFieldGrid fields={[
            { label: "认证状态", value: row.supplier.certificationStatus, tone: row.supplier.certificationStatus === "已认证" ? "good" : "warning" },
            { label: "准入状态", value: row.supplier.status, tone: row.supplier.status === "启用" ? "good" : "warning" },
            { label: "缺失资料", value: row.supplier.certificationStatus === "已认证" ? "无" : "营业执照 / 质量体系", tone: row.supplier.certificationStatus === "已认证" ? "good" : "warning" },
            { label: "整改事项", value: row.supplier.certificationStatus === "已认证" ? "年度复核" : row.nextAction, tone: "info" },
          ]} />
        </DetailSection>

        <EvidenceSummaryPanel groups={[
          { label: "相关 PO", value: `${row.poCount} 单 / 开放 ${row.openPoCount}` },
          { label: "RFx", value: `${row.rfqCount} 次 / 开放 ${row.activeRfqCount}` },
          { label: "发票与对账", value: `发票差异 ${row.invoiceVarianceCount} · 对账状态 ${row.reconciliation?.status || "待生成"}`, tone: row.invoiceVarianceCount || row.reconciliationException ? "warning" : "good" },
          { label: "收货与退货", value: `收货异常 ${row.grnExceptionCount} · 退货 ${row.returnCount}` },
        ]} />

        <DataLimitationsPanel
          items={dataLimitations}
          labelFor={(item) => ({
            certification_review_required: "认证资料需负责人复核",
            invoice_variance_review_required: "存在发票差异，需财务协同确认",
            reconciliation_review_required: "对账存在异常，需人工复核",
            current_workspace_data_limited: "当前数据范围有限，需人工复核",
          } as Record<string, string>)[item] || item}
        />

        <DetailSection title="AI 辅助与内部草稿">
          <div className="grid grid-cols-3 gap-3 text-[11px] leading-5" style={{ color: A.sub }}>
            <div className="rounded-lg p-3" style={{ background: A.white }}>风险信号：PO 延误、收货异常、发票差异、RFQ 响应和未关闭异常工单。</div>
            <div className="rounded-lg p-3" style={{ background: A.white }}>供应商跟进备注草稿：仅供内部负责人确认，不自动发送外部邮件。</div>
            <div className="rounded-lg p-3" style={{ background: A.white }}>生成内部跟进草稿：负责人复核后才进入整改流程。</div>
          </div>
        </DetailSection>

        <ReviewActionPanel objectLabel={`供应商 ${row.supplier.code}`} />
      </div>
    </BusinessObjectDetailModal>
  );
}
