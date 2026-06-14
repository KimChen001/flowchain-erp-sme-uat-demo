import React, { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart2,
  CheckCircle2,
  Clock,
  DollarSign,
  Plus,
  Receipt,
  ShoppingCart,
  Sparkles,
  Tag,
  TrendingUp,
  Truck,
  Undo2,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { fmt } from "../../lib/format";
import { A, AppleTooltip, Card, Chip, Field, KpiCard, Modal, SectionHeader, SegmentedControl, SubTabs } from "../../components/ui";
import { salesData, topProducts, FULFILLMENT_STAGES } from "../../data/demo-data";

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    正常:   { color: A.green,  bg: "#f0faf4" },
    预警:   { color: A.orange, bg: "#fff8f0" },
    不足:   { color: A.red,    bg: "#fff1f0" },
    关注:   { color: A.orange, bg: "#fff8f0" },
    高风险: { color: A.red,    bg: "#fff1f0" },
    草稿:   { color: A.gray1,  bg: "#f2f2f7" },
    已确认: { color: A.blue,   bg: "#eff6ff" },
    拣货中: { color: A.orange, bg: "#fff8f0" },
    已发货: { color: A.purple, bg: "#faf3ff" },
    已交付: { color: A.green,  bg: "#f0faf4" },
    已关闭: { color: A.gray1,  bg: "#f2f2f7" },
    待审批: { color: A.orange, bg: "#fff8f0" },
    已审批: { color: A.blue,   bg: "#eff6ff" },
    已收货: { color: A.purple, bg: "#faf3ff" },
    已结案: { color: A.green,  bg: "#f0faf4" },
    生效中: { color: A.green,  bg: "#f0faf4" },
    待生效: { color: A.blue,   bg: "#eff6ff" },
    已停用: { color: A.gray1,  bg: "#f2f2f7" },
  };
  const s = map[status] ?? { color: A.gray1, bg: "#f2f2f7" };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ color: s.color, background: s.bg }}>
      {status}
    </span>
  );
}
const SALES_ORDERS: {
  id: string; customer: string; channel: "直销" | "经销" | "电商" | "OEM";
  amount: number; items: number; createdAt: string; promiseDate: string;
  status: "草稿" | "已确认" | "拣货中" | "已发货" | "已交付" | "已关闭";
  owner: string; payTerms: string;
}[] = [
  { id: "SO-26-001824", customer: "华东工业集团",   channel: "直销", amount: 1842000, items: 14, createdAt: "2026-05-20", promiseDate: "2026-06-02", status: "已发货", owner: "张磊", payTerms: "Net 60" },
  { id: "SO-26-001825", customer: "京海科技",       channel: "经销", amount: 624500,  items:  8, createdAt: "2026-05-22", promiseDate: "2026-06-05", status: "拣货中", owner: "陈晨", payTerms: "Net 30" },
  { id: "SO-26-001826", customer: "申联电子",       channel: "电商", amount: 86420,   items:  3, createdAt: "2026-05-24", promiseDate: "2026-05-28", status: "已交付", owner: "刘洋", payTerms: "预付" },
  { id: "SO-26-001827", customer: "北方机械",       channel: "OEM",  amount: 3160000, items: 22, createdAt: "2026-05-25", promiseDate: "2026-06-18", status: "已确认", owner: "张磊", payTerms: "Net 90" },
  { id: "SO-26-001828", customer: "粤海制造",       channel: "直销", amount: 945000,  items: 11, createdAt: "2026-05-26", promiseDate: "2026-06-08", status: "草稿",   owner: "陈晨", payTerms: "Net 45" },
  { id: "SO-26-001829", customer: "申联电子",       channel: "电商", amount: 28700,   items:  2, createdAt: "2026-05-26", promiseDate: "2026-05-29", status: "已发货", owner: "刘洋", payTerms: "预付" },
  { id: "SO-26-001830", customer: "通达供应链",     channel: "经销", amount: 412800,  items:  6, createdAt: "2026-05-27", promiseDate: "2026-06-10", status: "已确认", owner: "张磊", payTerms: "Net 30" },
];

const CUSTOMERS: {
  code: string; name: string; tier: "A" | "B" | "C"; channel: string;
  ar: number; credit: number; ytd: number; lastOrder: string; nps: number; risk: "正常" | "关注" | "高风险";
}[] = [
  { code: "C-1001", name: "华东工业集团",   tier: "A", channel: "直销", ar: 4820000, credit: 8000000, ytd: 28600000, lastOrder: "2026-05-20", nps: 64, risk: "正常" },
  { code: "C-1002", name: "京海科技",       tier: "A", channel: "经销", ar: 1240000, credit: 3000000, ytd: 12400000, lastOrder: "2026-05-22", nps: 58, risk: "正常" },
  { code: "C-1003", name: "北方机械",       tier: "A", channel: "OEM",  ar: 6900000, credit: 10000000, ytd: 41200000, lastOrder: "2026-05-25", nps: 71, risk: "关注" },
  { code: "C-1004", name: "申联电子",       tier: "B", channel: "电商", ar: 86000,   credit: 500000,  ytd:  2840000, lastOrder: "2026-05-26", nps: 49, risk: "正常" },
  { code: "C-1005", name: "粤海制造",       tier: "B", channel: "直销", ar: 1840000, credit: 2500000, ytd:  9620000, lastOrder: "2026-05-26", nps: 52, risk: "高风险" },
  { code: "C-1006", name: "通达供应链",     tier: "B", channel: "经销", ar: 720000,  credit: 1500000, ytd:  6480000, lastOrder: "2026-05-27", nps: 61, risk: "正常" },
  { code: "C-1007", name: "西部重工",       tier: "C", channel: "直销", ar: 124000,  credit: 800000,  ytd:  1860000, lastOrder: "2026-04-18", nps: 42, risk: "关注" },
];


const RMAS: {
  id: string; so: string; customer: string; reason: "质量问题" | "型号错发" | "客户拒收" | "运输破损" | "保修退换";
  qty: number; amount: number; status: "待审批" | "已审批" | "已收货" | "已结案"; createdAt: string;
}[] = [
  { id: "RMA-26-0142", so: "SO-26-001801", customer: "华东工业集团", reason: "质量问题", qty:  3, amount: 28400, status: "已收货", createdAt: "2026-05-18" },
  { id: "RMA-26-0143", so: "SO-26-001815", customer: "申联电子",     reason: "运输破损", qty:  1, amount:  6200, status: "已审批", createdAt: "2026-05-22" },
  { id: "RMA-26-0144", so: "SO-26-001797", customer: "京海科技",     reason: "型号错发", qty:  2, amount: 14800, status: "待审批", createdAt: "2026-05-24" },
  { id: "RMA-26-0145", so: "SO-26-001820", customer: "粤海制造",     reason: "保修退换", qty:  5, amount: 42600, status: "待审批", createdAt: "2026-05-26" },
  { id: "RMA-26-0146", so: "SO-26-001782", customer: "北方机械",     reason: "客户拒收", qty:  8, amount: 96400, status: "已结案", createdAt: "2026-05-12" },
];

const PRICE_RULES: {
  id: string; name: string; scope: string; type: "阶梯折扣" | "客户专价" | "促销价" | "渠道价" | "合同价";
  discount: string; valid: string; status: "生效中" | "待生效" | "已停用";
}[] = [
  { id: "PR-001", name: "A 类客户阶梯",        scope: "全 SKU · A 类",     type: "阶梯折扣", discount: "5% / 8% / 12%",  valid: "2026-01-01 ~ 2026-12-31", status: "生效中" },
  { id: "PR-002", name: "华东工业 OEM 年框",   scope: "OEM 系列 12 SKU",   type: "合同价",   discount: "目录价 -18%",     valid: "2026-03-01 ~ 2027-02-28", status: "生效中" },
  { id: "PR-003", name: "电商 618 大促",        scope: "电商渠道 · 全品",   type: "促销价",   discount: "限时 -22%",       valid: "2026-06-01 ~ 2026-06-20", status: "待生效" },
  { id: "PR-004", name: "经销商保护价",         scope: "经销渠道",          type: "渠道价",   discount: "目录价 -12%",     valid: "2026-01-01 ~ 2026-12-31", status: "生效中" },
  { id: "PR-005", name: "粤海制造客户专价",     scope: "C-1005 · 6 SKU",    type: "客户专价", discount: "目录价 -15%",     valid: "2026-04-15 ~ 2026-10-15", status: "生效中" },
  { id: "PR-006", name: "Q1 清仓",              scope: "EOL 系列 8 SKU",    type: "促销价",   discount: "目录价 -35%",     valid: "2026-01-15 ~ 2026-03-31", status: "已停用" },
];

// ─── Sales · Master Wrapper ───────────────────────────────────────────────────
type SalesTab = "overview" | "orders" | "customers" | "fulfillment" | "rma" | "pricing";
export default function SalesPanel() {
  const [tab, setTab] = useState<SalesTab>("overview");
  const tabs = [
    { id: "overview",    label: "销售总览",     icon: BarChart2,    count: "¥7.28亿" },
    { id: "orders",      label: "销售订单",     icon: Receipt,      count: SALES_ORDERS.length },
    { id: "customers",   label: "客户主数据",   icon: Users,        count: CUSTOMERS.length },
    { id: "fulfillment", label: "履约管道",     icon: Truck,        count: FULFILLMENT_STAGES.reduce((a, b) => a + b.count, 0) },
    { id: "rma",         label: "退货 RMA",     icon: Undo2,        count: RMAS.length },
    { id: "pricing",     label: "定价规则",     icon: Tag,          count: PRICE_RULES.length },
  ] as const;

  return (
    <div className="space-y-4">
      <SubTabs tabs={tabs as any} value={tab} onChange={(v) => setTab(v as SalesTab)} />
      {tab === "overview"    && <SalesOverview />}
      {tab === "orders"      && <SalesOrders />}
      {tab === "customers"   && <SalesCustomers />}
      {tab === "fulfillment" && <SalesFulfillment />}
      {tab === "rma"         && <SalesRMA />}
      {tab === "pricing"     && <SalesPricing />}
    </div>
  );
}
function SalesOverview() {
  const [tab, setTab] = useState<"revenue" | "orders">("revenue");

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="年度营收" value="¥7.28亿" sub="2026 YTD" delta="+18.4%" positive icon={DollarSign} color={A.blue} />
        <KpiCard label="年度订单" value="4,726" sub="完成 4,552 单" delta="+22.1%" positive icon={ShoppingCart} color={A.green} />
        <KpiCard label="综合毛利率" value="31.8%" sub="加权平均" delta="+2.4pts" positive icon={BarChart2} color={A.purple} />
        <KpiCard label="退货率" value="0.8%" sub="全年" delta="-0.2pts" positive icon={CheckCircle2} color={A.teal} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="col-span-2 p-5">
          <SectionHeader title="月度趋势"
            right={<SegmentedControl
              options={[{ label: "营收", value: "revenue" }, { label: "订单量", value: "orders" }]}
              value={tab} onChange={(v) => setTab(v as any)}
            />}
          />
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={salesData} barSize={18} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="barG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={tab === "revenue" ? A.blue : A.green} stopOpacity={1} />
                  <stop offset="100%" stopColor={tab === "revenue" ? A.blue : A.green} stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="0" stroke="rgba(0,0,0,0.05)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false}
                tickFormatter={(v) => tab === "revenue" ? `${v / 1e4}万` : `${v}`} width={48} />
              <Tooltip content={<AppleTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)", radius: 6 }} />
              <Bar dataKey={tab} name={tab === "revenue" ? "营收" : "订单量"} fill="url(#barG)" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <SectionHeader title="TOP 5 产品" />
          <div className="space-y-4">
            {topProducts.map((p, i) => (
              <div key={p.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium w-4 shrink-0 text-center rounded-md"
                      style={{ color: A.gray1, background: A.gray6, lineHeight: "1.4rem" }}>{i + 1}</span>
                    <span className="text-xs font-medium truncate" style={{ color: A.label }}>{p.name}</span>
                  </div>
                  <span className={`text-xs font-medium flex items-center gap-0.5 shrink-0 ml-2`}
                    style={{ color: p.growth >= 0 ? A.green : A.red }}>
                    {p.growth >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                    {Math.abs(p.growth)}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: A.gray5 }}>
                    <div className="h-full rounded-full" style={{ width: `${(p.revenue / topProducts[0].revenue) * 100}%`, background: A.blue }} />
                  </div>
                  <span className="text-[11px] shrink-0 w-14 text-right font-medium" style={{ color: A.sub }}>{fmt(p.revenue)}</span>
                </div>
                <div className="flex gap-3 mt-1 text-[10px]" style={{ color: A.gray2 }}>
                  <span>毛利 <span style={{ color: A.green }}>{p.margin}%</span></span>
                  <span>退货 <span style={{ color: p.returnRate > 0.8 ? A.red : A.gray1 }}>{p.returnRate}%</span></span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <div className="px-5 py-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>销售明细</h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["产品名称", "年销售额", "增长率", "销售量", "毛利率", "客单价", "退货率"].map((h) => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {topProducts.map((p, i) => (
              <tr key={p.name} className="hover:bg-blue-50/40 transition-colors"
                style={{ borderBottom: i < topProducts.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-5 py-3.5 font-medium" style={{ color: A.label }}>{p.name}</td>
                <td className="px-5 py-3.5 font-medium" style={{ color: A.blue }}>{fmt(p.revenue)}</td>
                <td className="px-5 py-3.5 font-medium" style={{ color: p.growth >= 0 ? A.green : A.red }}>
                  {p.growth >= 0 ? "+" : ""}{p.growth}%
                </td>
                <td className="px-5 py-3.5" style={{ color: A.label }}>{p.units.toLocaleString()}</td>
                <td className="px-5 py-3.5 font-medium" style={{ color: A.green }}>{p.margin}%</td>
                <td className="px-5 py-3.5" style={{ color: A.label }}>¥{Math.round(p.revenue / p.units / 10000)}万</td>
                <td className="px-5 py-3.5" style={{ color: p.returnRate > 0.8 ? A.red : A.gray1 }}>{p.returnRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Sales · Orders ───────────────────────────────────────────────────────────
function SalesOrders() {
  const [orders, setOrders] = useState(SALES_ORDERS);
  const [filter, setFilter] = useState<"全部" | "草稿" | "已确认" | "拣货中" | "已发货" | "已交付">("全部");
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState({ customer: "华东工业集团", channel: "直销" as const, amount: "", items: "", promiseDate: "2026-06-15", payTerms: "Net 30" });

  const filtered = filter === "全部" ? orders : orders.filter(o => o.status === filter);
  const totalValue = filtered.reduce((a, b) => a + b.amount, 0);

  const confirm = (id: string) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: "已确认" as const } : o));
    toast.success(`订单 ${id} 已确认`, { description: "已生成销售出库建议" });
  };
  const ship = (id: string) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: "已发货" as const } : o));
    toast.success(`订单 ${id} 已发货`, { description: "已通知物流系统创建运单" });
  };
  const createSO = () => {
    const amount = Number(form.amount);
    const items = Number(form.items);
    if (!amount || !items) { toast.error("请填写金额与行项数"); return; }
    const next = `SO-26-${String(1830 + orders.length + 1).padStart(6, "0")}`;
    setOrders(prev => [{
      id: next, customer: form.customer, channel: form.channel, amount, items,
      createdAt: "2026-05-27", promiseDate: form.promiseDate, status: "草稿", owner: "陈晨", payTerms: form.payTerms,
    }, ...prev]);
    setOpenNew(false);
    setForm({ customer: "华东工业集团", channel: "直销", amount: "", items: "", promiseDate: "2026-06-15", payTerms: "Net 30" });
    toast.success(`已创建 ${next}`, { description: "草稿订单已保存,等待销售经理确认" });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="活动订单"   value={String(orders.length)}                            sub="近 7 天" delta="+12"   positive icon={Receipt}     color={A.blue} />
        <KpiCard label="在途金额"   value={`¥${(totalValue / 1e4).toFixed(0)}万`}             sub="筛选合计"                       icon={DollarSign}  color={A.green} />
        <KpiCard label="平均周期"   value="6.4 天"                                            sub="确认 → 发货" delta="-0.8d" positive icon={Clock}      color={A.purple} />
        <KpiCard label="准时交付率" value="96.2%"                                             sub="本月 OTIF" delta="+1.4pts" positive icon={CheckCircle2} color={A.teal} />
      </div>

      <Card>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold" style={{ color: A.label }}>销售订单</h2>
            <SegmentedControl
              options={(["全部", "草稿", "已确认", "拣货中", "已发货", "已交付"] as const).map(v => ({ label: v, value: v }))}
              value={filter} onChange={(v) => setFilter(v as any)}
            />
          </div>
          <button onClick={() => setOpenNew(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white transition-all hover:opacity-90"
            style={{ background: A.blue }}>
            <Plus size={13} /> 新建销售订单
          </button>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["订单号", "客户", "渠道", "金额", "行项", "创建", "承诺交付", "付款条款", "状态", "操作"].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((o, i) => (
              <tr key={o.id} className="hover:bg-blue-50/40 transition-colors"
                style={{ borderBottom: i < filtered.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>{o.id}</td>
                <td className="px-5 py-3" style={{ color: A.label }}>{o.customer}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{o.channel}</td>
                <td className="px-5 py-3 font-medium" style={{ color: A.label }}>¥{(o.amount / 1e4).toFixed(1)}万</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{o.items}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{o.createdAt}</td>
                <td className="px-5 py-3" style={{ color: A.label }}>{o.promiseDate}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{o.payTerms}</td>
                <td className="px-5 py-3"><StatusPill status={o.status} /></td>
                <td className="px-5 py-3">
                  <div className="flex gap-1.5">
                    {o.status === "草稿"   && <button onClick={() => confirm(o.id)} className="px-2 py-1 text-[11px] font-medium rounded-md text-white" style={{ background: A.blue }}>确认</button>}
                    {o.status === "已确认" && <button onClick={() => ship(o.id)}    className="px-2 py-1 text-[11px] font-medium rounded-md text-white" style={{ background: A.green }}>发货</button>}
                    {(o.status === "拣货中" || o.status === "已发货") && <span className="text-[11px]" style={{ color: A.gray1 }}>—</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal open={openNew} onClose={() => setOpenNew(false)} title="新建销售订单" subtitle="请填写客户与基本信息" width={520}
        footer={<>
          <button onClick={() => setOpenNew(false)} className="px-3 py-1.5 text-xs font-medium rounded-lg" style={{ color: A.label, background: A.gray6 }}>取消</button>
          <button onClick={createSO} className="px-3 py-1.5 text-xs font-medium rounded-lg text-white" style={{ background: A.blue }}>创建草稿</button>
        </>}
      >
        <Field label="客户">
          <select value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
            style={{ borderColor: A.gray5, background: A.white }}>
            {CUSTOMERS.map(c => <option key={c.code}>{c.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="渠道">
            <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as any })}
              className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: A.gray5, background: A.white }}>
              {["直销", "经销", "电商", "OEM"].map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="付款条款">
            <select value={form.payTerms} onChange={(e) => setForm({ ...form, payTerms: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: A.gray5, background: A.white }}>
              {["预付", "Net 30", "Net 45", "Net 60", "Net 90"].map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="金额 (元)">
            <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="如 1840000" className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
              style={{ borderColor: A.gray5, background: A.white }} />
          </Field>
          <Field label="行项数">
            <input value={form.items} onChange={(e) => setForm({ ...form, items: e.target.value })}
              placeholder="如 12" className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
              style={{ borderColor: A.gray5, background: A.white }} />
          </Field>
        </div>
        <Field label="承诺交付日期">
          <input type="date" value={form.promiseDate} onChange={(e) => setForm({ ...form, promiseDate: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
            style={{ borderColor: A.gray5, background: A.white }} />
        </Field>
      </Modal>
    </div>
  );
}

// ─── Sales · Customers ────────────────────────────────────────────────────────
function SalesCustomers() {
  const [tier, setTier] = useState<"全部" | "A" | "B" | "C">("全部");
  const filtered = tier === "全部" ? CUSTOMERS : CUSTOMERS.filter(c => c.tier === tier);
  const totalAR = filtered.reduce((a, b) => a + b.ar, 0);
  const highRisk = filtered.filter(c => c.risk === "高风险").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="活跃客户" value={String(CUSTOMERS.length)} sub="近 90 天" delta="+3" positive icon={Users} color={A.blue} />
        <KpiCard label="应收账款" value={`¥${(totalAR / 1e4).toFixed(0)}万`} sub="筛选合计" icon={Wallet} color={A.orange} />
        <KpiCard label="高风险客户" value={String(highRisk)} sub="信用预警" delta={highRisk > 0 ? "需关注" : "—"} icon={AlertTriangle} color={A.red} />
        <KpiCard label="平均 NPS" value={String(Math.round(CUSTOMERS.reduce((a, b) => a + b.nps, 0) / CUSTOMERS.length))} sub="客户口碑" delta="+4" positive icon={Sparkles} color={A.green} />
      </div>

      <Card>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>客户主数据</h2>
          <SegmentedControl
            options={(["全部", "A", "B", "C"] as const).map(v => ({ label: v === "全部" ? v : `${v} 级`, value: v }))}
            value={tier} onChange={(v) => setTier(v as any)}
          />
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["客户编号", "名称", "等级", "渠道", "应收账款", "授信额度", "授信占用", "YTD 销售", "最近下单", "NPS", "风险"].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => {
              const util = c.ar / c.credit;
              return (
                <tr key={c.code} className="hover:bg-blue-50/40 transition-colors"
                  style={{ borderBottom: i < filtered.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                  <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>{c.code}</td>
                  <td className="px-5 py-3 font-medium" style={{ color: A.label }}>{c.name}</td>
                  <td className="px-5 py-3"><Chip label={c.tier} color={c.tier === "A" ? A.green : c.tier === "B" ? A.blue : A.gray1} bg={c.tier === "A" ? "rgba(52,199,89,0.1)" : c.tier === "B" ? "rgba(0,113,227,0.1)" : "rgba(142,142,147,0.1)"} /></td>
                  <td className="px-5 py-3" style={{ color: A.sub }}>{c.channel}</td>
                  <td className="px-5 py-3 font-medium" style={{ color: A.label }}>¥{(c.ar / 1e4).toFixed(0)}万</td>
                  <td className="px-5 py-3" style={{ color: A.sub }}>¥{(c.credit / 1e4).toFixed(0)}万</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: A.gray5 }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, util * 100)}%`, background: util > 0.8 ? A.red : util > 0.5 ? A.orange : A.green }} />
                      </div>
                      <span className="text-[11px] font-medium" style={{ color: util > 0.8 ? A.red : A.label }}>{(util * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>¥{(c.ytd / 1e4).toFixed(0)}万</td>
                  <td className="px-5 py-3" style={{ color: A.sub }}>{c.lastOrder}</td>
                  <td className="px-5 py-3 font-medium" style={{ color: c.nps > 60 ? A.green : c.nps > 50 ? A.blue : A.orange }}>{c.nps}</td>
                  <td className="px-5 py-3"><StatusPill status={c.risk} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Sales · Fulfillment Pipeline ─────────────────────────────────────────────
function SalesFulfillment() {
  const total = FULFILLMENT_STAGES.reduce((a, b) => a + b.count, 0);
  const totalValue = FULFILLMENT_STAGES.reduce((a, b) => a + b.value, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="在途订单"   value={String(total)}                                       sub="全部阶段"                       icon={Truck}       color={A.blue} />
        <KpiCard label="在途金额"   value={`¥${(totalValue / 1e4).toFixed(0)}万`}              sub="未交付合计"                     icon={DollarSign}  color={A.green} />
        <KpiCard label="平均履约时长" value="7.2 天"                                            sub="确认 → 交付" delta="-0.4d" positive icon={Clock}       color={A.purple} />
        <KpiCard label="OTIF"       value="96.2%"                                              sub="准时全量交付率" delta="+1.4pts" positive icon={CheckCircle2} color={A.teal} />
      </div>

      <Card className="p-5">
        <SectionHeader title="履约阶段漏斗" right={<span className="text-xs" style={{ color: A.gray1 }}>实时</span>} />
        <div className="space-y-3 mt-2">
          {FULFILLMENT_STAGES.map((s, i) => {
            const width = (s.count / FULFILLMENT_STAGES[0].count) * 100;
            const colors = [A.gray1, A.blue, A.orange, A.purple, A.green];
            return (
              <div key={s.stage}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium" style={{ color: A.label }}>{s.stage}</span>
                  <span className="text-xs" style={{ color: A.sub }}>
                    <span className="font-medium" style={{ color: A.label }}>{s.count}</span> 单 · ¥{(s.value / 1e4).toFixed(0)}万
                  </span>
                </div>
                <div className="h-7 rounded-lg flex items-center px-3" style={{ width: `${Math.max(15, width)}%`, background: `${colors[i]}1a`, border: `0.5px solid ${colors[i]}33` }}>
                  <span className="text-[11px] font-medium" style={{ color: colors[i] }}>
                    {((s.count / total) * 100).toFixed(1)}% · 转化率 {i < FULFILLMENT_STAGES.length - 1 ? ((FULFILLMENT_STAGES[i + 1].count / s.count) * 100).toFixed(0) + "%" : "—"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-5">
          <SectionHeader title="今日待发运" />
          <div className="space-y-3">
            {SALES_ORDERS.filter(o => o.status === "拣货中" || o.status === "已确认").slice(0, 4).map(o => (
              <div key={o.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: A.gray6 }}>
                <div className="min-w-0">
                  <div className="text-xs font-medium" style={{ color: A.label }}>{o.id} · {o.customer}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: A.sub }}>承诺 {o.promiseDate} · {o.items} 行项</div>
                </div>
                <StatusPill status={o.status} />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeader title="异常预警" />
          <div className="space-y-2">
            {[
              { label: "延迟风险订单", value: 4, color: A.red, hint: "承诺日 < 48h 且未发货" },
              { label: "缺货阻塞订单", value: 2, color: A.orange, hint: "等待补货 / 转厂" },
              { label: "信用挂起",     value: 1, color: A.purple, hint: "授信占用 > 90%" },
              { label: "待客户确认",   value: 3, color: A.blue, hint: "条款变更待客户回签" },
            ].map(x => (
              <div key={x.label} className="flex items-center justify-between p-3 rounded-lg" style={{ background: `${x.color}0d` }}>
                <div>
                  <div className="text-xs font-medium" style={{ color: A.label }}>{x.label}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: A.sub }}>{x.hint}</div>
                </div>
                <span className="text-lg font-semibold" style={{ color: x.color }}>{x.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Sales · RMA ──────────────────────────────────────────────────────────────
function SalesRMA() {
  const [rmas, setRmas] = useState(RMAS);
  const approve = (id: string) => {
    setRmas(prev => prev.map(r => r.id === id ? { ...r, status: "已审批" as const } : r));
    toast.success(`${id} 已审批`, { description: "已通知收货部门准备入库" });
  };
  const close = (id: string) => {
    setRmas(prev => prev.map(r => r.id === id ? { ...r, status: "已结案" as const } : r));
    toast.success(`${id} 已结案`, { description: "已生成贷项凭证" });
  };

  const totalAmt = rmas.reduce((a, b) => a + b.amount, 0);
  const byReason = ["质量问题", "型号错发", "客户拒收", "运输破损", "保修退换"].map(r => ({
    reason: r, count: rmas.filter(x => x.reason === r).length,
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="RMA 工单"  value={String(rmas.length)}                          sub="近 30 天"                  icon={Undo2}         color={A.orange} />
        <KpiCard label="退货金额"  value={`¥${(totalAmt / 1e4).toFixed(1)}万`}          sub="累计"                       icon={DollarSign}    color={A.red} />
        <KpiCard label="退货率"    value="0.8%"                                          sub="销售额占比" delta="-0.2pts" positive icon={TrendingUp} color={A.green} />
        <KpiCard label="待处理"    value={String(rmas.filter(r => r.status === "待审批").length)} sub="需审批"           icon={AlertCircle}   color={A.blue} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-5">
          <SectionHeader title="退货原因分布" />
          <div className="space-y-2.5">
            {byReason.map(r => (
              <div key={r.reason} className="flex items-center justify-between">
                <span className="text-xs" style={{ color: A.label }}>{r.reason}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: A.gray5 }}>
                    <div className="h-full rounded-full" style={{ width: `${(r.count / rmas.length) * 100}%`, background: A.orange }} />
                  </div>
                  <span className="text-xs font-medium w-6 text-right" style={{ color: A.label }}>{r.count}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="col-span-2">
          <div className="px-5 py-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
            <h2 className="text-sm font-semibold" style={{ color: A.label }}>RMA 明细</h2>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                {["RMA 单号", "客户", "原因", "数量", "金额", "状态", "操作"].map(h => (
                  <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rmas.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: i < rmas.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                  <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>{r.id}</td>
                  <td className="px-5 py-3" style={{ color: A.label }}>{r.customer}</td>
                  <td className="px-5 py-3" style={{ color: A.sub }}>{r.reason}</td>
                  <td className="px-5 py-3" style={{ color: A.label }}>{r.qty}</td>
                  <td className="px-5 py-3 font-medium" style={{ color: A.red }}>¥{r.amount.toLocaleString()}</td>
                  <td className="px-5 py-3"><StatusPill status={r.status} /></td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1.5">
                      {r.status === "待审批" && <button onClick={() => approve(r.id)} className="px-2 py-1 text-[11px] font-medium rounded-md text-white" style={{ background: A.blue }}>审批</button>}
                      {r.status === "已收货" && <button onClick={() => close(r.id)} className="px-2 py-1 text-[11px] font-medium rounded-md text-white" style={{ background: A.green }}>结案</button>}
                      {(r.status === "已审批" || r.status === "已结案") && <span className="text-[11px]" style={{ color: A.gray1 }}>—</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

// ─── Sales · Pricing ──────────────────────────────────────────────────────────
function SalesPricing() {
  const [rules, setRules] = useState(PRICE_RULES);
  const toggle = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, status: r.status === "生效中" ? "已停用" : "生效中" as any } : r));
    toast.success("规则状态已更新");
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="价格规则"   value={String(rules.length)}                              sub="全部"                            icon={Tag}        color={A.blue} />
        <KpiCard label="生效中"     value={String(rules.filter(r => r.status === "生效中").length)} sub="实时生效"                  icon={CheckCircle2} color={A.green} />
        <KpiCard label="本月调价"   value="8"                                                  sub="新增 / 修订" delta="+3" positive icon={Activity}   color={A.purple} />
        <KpiCard label="平均折扣"   value="14.6%"                                              sub="加权"                            icon={TrendingUp} color={A.orange} />
      </div>

      <Card>
        <div className="px-5 py-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>定价规则</h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["编号", "名称", "适用范围", "类型", "折扣 / 价格", "有效期", "状态", "操作"].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rules.map((r, i) => (
              <tr key={r.id} style={{ borderBottom: i < rules.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>{r.id}</td>
                <td className="px-5 py-3 font-medium" style={{ color: A.label }}>{r.name}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{r.scope}</td>
                <td className="px-5 py-3"><Chip label={r.type} color={A.purple} bg="rgba(175,82,222,0.1)" /></td>
                <td className="px-5 py-3 font-medium" style={{ color: A.label }}>{r.discount}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{r.valid}</td>
                <td className="px-5 py-3"><StatusPill status={r.status} /></td>
                <td className="px-5 py-3">
                  <button onClick={() => toggle(r.id)} className="px-2 py-1 text-[11px] font-medium rounded-md"
                    style={{ color: r.status === "生效中" ? A.red : A.green, background: r.status === "生效中" ? "rgba(255,59,48,0.1)" : "rgba(52,199,89,0.1)" }}>
                    {r.status === "生效中" ? "停用" : "启用"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
