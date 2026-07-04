import { useEffect, useState } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { CheckCircle2, MoreHorizontal, Search } from "lucide-react";
import { A, Card, Chip, SectionHeader } from "../../components/ui";
import type { SupplierSrmRow } from "../../domain/srm/helpers";
import { fmt } from "../../lib/format";
import { scoreDimensions, scoreStyle, supplierScoreSnapshot } from "./scoring";

export default function SrmOverview({
  rows,
  onDetail,
  onOpenTab,
}: {
  rows: SupplierSrmRow[];
  onDetail: (row: SupplierSrmRow) => void;
  onOpenTab: (tab: "performance") => void;
}) {
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

      <SupplierPortraitPanel row={selected} onDetail={onDetail} onOpenScoring={() => onOpenTab("performance")} />
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
  const spend = row.supplierOperationsProfile?.spend ?? row.openPoCount * 380000 + row.rfqCount * 240000;
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
            绩效与风险
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
            <p className="text-[11px] mt-1" style={{ color: A.gray1 }}>问题维度默认展开，点击任意维度查看构成</p>
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
