import { useState } from "react";
import { ArrowRight, ChevronDown, GitBranch, Route, type LucideIcon } from "lucide-react";
import { A, Card, Chip } from "../../components/ui";

const operationalPath = [
  "采购申请 / PR",
  "寻源 / RFx",
  "采购订单 / PO",
  "收货 / GRN",
  "发票协同",
  "三单匹配",
  "退货 / 贷项",
];

const sourcingPath = [
  "RFI / RFP / RFQ",
  "授标 / 合同 / 目录",
  "采购申请 / PR",
  "采购订单 / PO",
];

function FlowStep({ label, emphasis = false }: { label: string; emphasis?: boolean }) {
  return (
    <div
      className="min-h-7 px-2.5 py-1.5 rounded-md text-[11px] font-semibold flex items-center justify-center text-center leading-4"
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
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="p-3">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold" style={{ color: A.label }}>采购执行与寻源协同流程</h2>
            <Chip label="PR · RFx · PO · GRN" color={A.blue} bg="#f0f6ff" />
          </div>
          <p className="text-[11px] mt-1 leading-4" style={{ color: A.sub }}>
            聚焦采购申请、寻源、订单、收货、发票协同、三单匹配与退货贷项。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden lg:grid grid-cols-3 gap-2 text-[10px] min-w-[260px]">
          <div className="rounded-lg p-2" style={{ background: A.gray6 }}>
            <div style={{ color: A.gray2 }}>证据链</div>
            <div className="font-semibold mt-0.5" style={{ color: A.label }}>关联单据</div>
          </div>
          <div className="rounded-lg p-2" style={{ background: A.gray6 }}>
            <div style={{ color: A.gray2 }}>匹配重点</div>
            <div className="font-semibold mt-0.5" style={{ color: A.label }}>PO / GRN</div>
          </div>
          <div className="rounded-lg p-2" style={{ background: A.gray6 }}>
            <div style={{ color: A.gray2 }}>库存影响</div>
            <div className="font-semibold mt-0.5" style={{ color: A.label }}>收货异常</div>
          </div>
          </div>
          <button onClick={() => setExpanded((value) => !value)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium"
            style={{ background: A.gray6, color: A.blue }}>
            {expanded ? "收起流程" : "展开流程"}
            <ChevronDown size={12} className={expanded ? "rotate-180 transition-transform" : "transition-transform"} />
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="grid gap-3 mt-4">
          <FlowRow title="采购执行" icon={Route} steps={operationalPath} emphasisIndexes={[0, 3, 5, 6]} />
          <FlowRow title="战略寻源" icon={GitBranch} steps={sourcingPath} emphasisIndexes={[0, 1]} />
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {operationalPath.map((step, index) => (
            <div key={step} className="flex items-center gap-1.5">
              <FlowStep label={step} emphasis={[0, 3, 5, 6].includes(index)} />
              {index < operationalPath.length - 1 && <ArrowRight size={12} style={{ color: A.gray2 }} />}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
