import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, RefreshCw, SlidersHorizontal } from "lucide-react";
import { A, Card, Chip, KpiCard, SectionHeader } from "../../components/ui";
import { scoreDimensions } from "./scoring";

export default function ScoringRulesWorkbench() {
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
              onClick={() => toast("规则草稿", { description: "权重调整会先进入草稿，发布后用于后续评分刷新。" })}
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
            { label: "刷新策略", value: "事件 + 复核", sub: "GRN / RFx / 证书 / 风险规则", icon: RefreshCw, color: A.purple },
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
                <span>发布后用于后续评分刷新，前端展示更新后的评分和证据。</span>
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

