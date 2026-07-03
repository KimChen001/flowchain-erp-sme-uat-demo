import { A, Card, Chip, Modal, SectionHeader } from "../../components/ui";
import { supplierDetailEvidence, type SupplierSrmRow } from "../../domain/srm/helpers";
import { scoreStyle, supplierScoreSnapshot } from "./scoring";

export default function SupplierDetailModal({ row, onClose }: { row: SupplierSrmRow | null; onClose: () => void }) {
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

        <Card className="p-4" style={{ boxShadow: "none", background: A.gray6 }}>
          <SectionHeader title="Supplier Risk Evidence" />
          <div className="grid grid-cols-3 gap-3 text-[11px] leading-5" style={{ color: A.sub }}>
            <div>Explain evidence before action: PO delay, receiving exception, invoice mismatch, RFQ response, and open exception cases.</div>
            <div>Preview supplier follow-up note only; no external email send and no supplier master data mutation.</div>
            <div>Create case draft only; owner confirmation is required before supplier remediation work starts.</div>
          </div>
        </Card>
      </div>
    </Modal>
  );
}
