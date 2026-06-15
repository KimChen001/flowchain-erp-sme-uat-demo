import { ArrowRight, GitBranch, Route, type LucideIcon } from "lucide-react";
import { A, Card, Chip } from "../../components/ui";

const operationalPath = [
  "PR / 采购申请",
  "RFx / 寻源",
  "PO / 采购订单",
  "GRN / 收货",
  "Supplier Invoice / 供应商发票",
  "Three-way Match / 三单匹配",
  "Purchase Return / Credit Memo / 退货贷项",
  "AP / 应付账款",
  "Supplier Reconciliation / 供应商对账",
];

const sourcingPath = [
  "RFx / RFI / RFP / RFQ",
  "Award / Contract / Catalog",
  "PR / 采购申请",
  "PO / 采购订单",
];

function FlowStep({ label, emphasis = false }: { label: string; emphasis?: boolean }) {
  return (
    <div
      className="min-h-9 px-3 py-2 rounded-lg text-[11px] font-semibold flex items-center justify-center text-center leading-4"
      style={{
        color: emphasis ? A.blue : A.label,
        background: emphasis ? "#f0f6ff" : A.gray6,
        boxShadow: emphasis ? `0 0 0 1px ${A.blue}30` : "0 0 0 0.5px rgba(0,0,0,0.05)",
      }}
    >
      {label}
    </div>
  );
}

function FlowRow({ title, icon, steps, emphasisIndexes = [] }: { title: string; icon: LucideIcon; steps: string[]; emphasisIndexes?: number[] }) {
  const Icon = icon;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon size={14} style={{ color: A.blue }} />
        <span className="text-xs font-semibold" style={{ color: A.label }}>{title}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {steps.map((step, index) => (
          <div key={`${title}-${step}`} className="flex items-center gap-1.5">
            <FlowStep label={step} emphasis={emphasisIndexes.includes(index)} />
            {index < steps.length - 1 && <ArrowRight size={13} style={{ color: A.gray2 }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProcurementWorkflowMap() {
  return (
    <Card className="p-5">
      <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold" style={{ color: A.label }}>采购到付款与寻源协同流程</h2>
            <Chip label="P2P / Sourcing" color={A.blue} bg="#f0f6ff" />
          </div>
          <p className="text-xs mt-1 leading-5" style={{ color: A.sub }}>
            统一管理采购申请、寻源、订单、收货、发票、匹配、退货贷项、应付与供应商对账。
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-[10px] min-w-[300px]">
          <div className="rounded-lg p-2" style={{ background: A.gray6 }}>
            <div style={{ color: A.gray2 }}>证据链</div>
            <div className="font-semibold mt-0.5" style={{ color: A.label }}>关联单据</div>
          </div>
          <div className="rounded-lg p-2" style={{ background: A.gray6 }}>
            <div style={{ color: A.gray2 }}>财务影响</div>
            <div className="font-semibold mt-0.5" style={{ color: A.label }}>应付冲减</div>
          </div>
          <div className="rounded-lg p-2" style={{ background: A.gray6 }}>
            <div style={{ color: A.gray2 }}>库存影响</div>
            <div className="font-semibold mt-0.5" style={{ color: A.label }}>收货异常</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 mt-5">
        <FlowRow title="Operational P2P" icon={Route} steps={operationalPath} emphasisIndexes={[0, 3, 5, 6, 8]} />
        <FlowRow title="Strategic sourcing" icon={GitBranch} steps={sourcingPath} emphasisIndexes={[0, 1]} />
      </div>
    </Card>
  );
}
