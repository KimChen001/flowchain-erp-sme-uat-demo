import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  DollarSign,
  Minus,
  Truck,
} from "lucide-react";
import { fmt } from "../../lib/format";
import { A, AppleTooltip, Card, Chip, KpiCard, SectionHeader } from "../../components/ui";
import { monthlyProcurement, procurementData, supplierData } from "../../data/demo-data";

const pieColors = [A.blue, A.green, A.orange, A.purple, A.teal];

export default function SuppliersPanel() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="年度采购总额" value="¥3.41亿" sub="2026 YTD" delta="+9.2% YoY" positive={false} icon={DollarSign} color={A.blue} />
        <KpiCard label="活跃供应商" value="248" sub="较去年 +12 家" delta="+5.1%" positive icon={Truck} color={A.green} />
        <KpiCard label="平均交期" value="8.4天" sub="日历日" delta="-1.2天" positive icon={Clock} color={A.orange} />
        <KpiCard label="合同履约率" value="97.1%" sub="年度综合" delta="+0.8pts" positive icon={CheckCircle2} color={A.teal} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-5">
          <SectionHeader title="采购费用分布" />
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={procurementData} cx="50%" cy="50%" innerRadius={44} outerRadius={70} dataKey="amount" paddingAngle={2.5}>
                {procurementData.map((_, i) => <Cell key={i} fill={pieColors[i]} />)}
              </Pie>
              <Tooltip content={<AppleTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {procurementData.map((d, i) => (
              <div key={d.category} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-sm" style={{ background: pieColors[i] }} />
                  <span style={{ color: A.label }}>{d.category}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span style={{ color: d.yoy > 0 ? A.red : A.green }} className="font-medium">
                    {d.yoy > 0 ? "+" : ""}{d.yoy}%
                  </span>
                  <span className="font-medium" style={{ color: A.sub, minWidth: 48, textAlign: "right" }}>{fmt(d.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="col-span-2 p-5">
          <SectionHeader title="月度支出 vs 预算"
            right={<div className="flex items-center gap-4 text-xs" style={{ color: A.sub }}>
              <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: A.gray4 }} />预算</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: A.orange }} />实际</span>
            </div>}
          />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyProcurement} barGap={3} barSize={18} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="0" stroke="rgba(0,0,0,0.05)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1e4}万`} width={44} />
              <Tooltip content={<AppleTooltip />} cursor={{ fill: "rgba(0,0,0,0.02)", radius: 6 }} />
              <Bar dataKey="budget" name="预算" fill={A.gray4} radius={[4, 4, 0, 0]} />
              <Bar dataKey="amount" name="实际" fill={A.orange} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card>
        <div className="px-5 py-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>供应商排名</h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["#", "供应商", "品类", "年采购额", "订单数", "准时交付", "质量合格", "评级", "趋势"].map((h) => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {supplierData.map((row, i) => (
              <tr key={row.rank} className="hover:bg-blue-50/40 transition-colors"
                style={{ borderBottom: i < supplierData.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-5 py-3.5 font-medium" style={{ color: A.gray2 }}>{row.rank}</td>
                <td className="px-5 py-3.5 font-medium" style={{ color: A.label }}>{row.name}</td>
                <td className="px-5 py-3.5" style={{ color: A.sub }}>{row.cat}</td>
                <td className="px-5 py-3.5 font-semibold" style={{ color: A.blue }}>{fmt(row.amount)}</td>
                <td className="px-5 py-3.5" style={{ color: A.label }}>{row.orders}</td>
                <td className="px-5 py-3.5" style={{ color: row.ontime < 95 ? A.red : A.label }}>{row.ontime}%</td>
                <td className="px-5 py-3.5" style={{ color: row.quality < 95 ? A.red : A.label }}>{row.quality}%</td>
                <td className="px-5 py-3.5">
                  <Chip
                    label={row.grade}
                    color={row.grade === "S" ? A.purple : row.grade === "A" ? A.blue : A.orange}
                    bg={row.grade === "S" ? "#f8f0ff" : row.grade === "A" ? "#f0f6ff" : "#fff8f0"}
                  />
                </td>
                <td className="px-5 py-3.5">
                  {row.trend === "up"     && <ArrowUpRight   size={14} style={{ color: A.green }} />}
                  {row.trend === "down"   && <ArrowDownRight size={14} style={{ color: A.red }}   />}
                  {row.trend === "stable" && <Minus          size={14} style={{ color: A.gray2 }} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
